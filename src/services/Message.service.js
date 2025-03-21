import { GoogleGenerativeAI } from "@google/generative-ai"
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import * as settingsService from "./Settings.service.js";
import * as personalityService from "./Personality.service.js";
import * as chatsService from "./Chats.service.js";
import * as helpers from "../utils/helpers.js";
import { chatLimitService } from './ChatLimitService.js';
import { ErrorService } from './Error.service.js';

export async function insertMessage(sender, msg, selectedPersonalityTitle = null, netStream = null, db = null) {
    const newMessage = document.createElement("div");
    newMessage.classList.add("message");
    const messageContainer = document.querySelector(".message-container");
    messageContainer.append(newMessage);

    if (sender !== "user") {
        newMessage.classList.add("message-model");
        const messageRole = selectedPersonalityTitle;
        newMessage.innerHTML = `
            <div class="message-header">
                <h3 class="message-role">${messageRole}</h3>
                <button class="btn-refresh btn-textual material-symbols-outlined">refresh</button>
            </div>
            <div class="message-role-api" style="display: none;">${sender}</div>
            <div class="message-text"></div>
        `;

        // Add refresh button handler immediately
        const refreshBtn = newMessage.querySelector('.btn-refresh');
        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                try {
                    await regenerate(newMessage, db);
                } catch (error) {
                    console.error('Refresh failed:', error);
                }
            };
        }

        if (!netStream && msg) {
            const messageText = newMessage.querySelector('.message-text');
            messageText.innerHTML = marked.parse(msg);
            helpers.addCopyButtons(); // Add copy buttons after parsing markdown
        }
        return newMessage;
    } else {
        const messageRole = "You:";
        newMessage.innerHTML = `
            <div class="message-header">
                <h3 class="message-role">${messageRole}</h3>
            </div>
            <div class="message-role-api" style="display: none;">${sender}</div>
            <div class="message-text">${helpers.getDecoded(msg)}</div>
        `;
    }
    
    newMessage.innerHTML = marked.parse(msg);
    messageContainer.appendChild(newMessage);
    
    // Add this line to ensure copy buttons are added immediately
    helpers.addCopyButtons();
    
    helpers.messageContainerScrollToBottom();
    
    return newMessage;
}

export async function regenerate(responseElement, db) {
    try {
        // Get the user's message that triggered this response
        const previousElement = responseElement.previousElementSibling;
        if (!previousElement) {
            ErrorService.showError('Cannot regenerate: No previous message found', 'error');
            return;
        }

        // Fix message text extraction
        const messageText = previousElement.querySelector('.message-text');
        if (!messageText) {
            ErrorService.showError('Cannot regenerate: Message element not found', 'error');
            return;
        }

        // Get raw text content and clean it
        const userMessageText = messageText.textContent.trim();
        if (!userMessageText) {
            ErrorService.showError('Cannot regenerate: Empty message content', 'error');
            return;
        }

        // Show loading state on refresh button
        const refreshBtn = responseElement.querySelector('.btn-refresh');
        if (!refreshBtn) {
            ErrorService.showError('Cannot regenerate: Refresh button not found', 'error');
            return;
        }

        const originalContent = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<span class="material-symbols-outlined loading">sync</span>';
        refreshBtn.disabled = true;

        try {
            // Remove this response and messages after it
            const messagesToRemove = Array.from(responseElement.parentElement.children)
                .slice(elementIndex);
            messagesToRemove.forEach(msg => msg.remove());

            // Update chat history
            const chat = await chatsService.getCurrentChat(db);
            if (chat) {
                chat.content = chat.content.slice(0, elementIndex);
                await db.chats.put(chat);
            }
            
            // Generate new response
            await send(userMessageText, db);
            
        } catch (error) {
            console.error('Failed to regenerate:', error);
            ErrorService.showError('Failed to regenerate response', 'error');
        } finally {
            // Reset button state
            refreshBtn.innerHTML = originalContent;
            refreshBtn.disabled = false;
        }

    } catch (error) {
        console.error('Regenerate error:', error);
        ErrorService.showError('Failed to regenerate response', 'error');
    }
}

export async function send(msg, db) {
    const sendButton = document.querySelector("#btn-send");
    const messageInput = document.querySelector("#messageInput");
    const originalContent = sendButton.innerHTML;
    
    try {
        // Disable controls
        sendButton.disabled = true;
        sendButton.innerHTML = '<span class="material-symbols-outlined loading">sync</span>';
        messageInput.setAttribute('contenteditable', 'false');

        const remaining = await chatLimitService.getRemainingChats();
        if (remaining <= 0) {
            showLimitReachedAlert();
            throw new Error('Chat limit reached');
        }

        await chatLimitService.decrementChatLimit();
        await chatLimitService.updateDisplay();

        const selectedPersonality = await personalityService.getSelected();
        if (!selectedPersonality) {
            ErrorService.showError('No personality selected', 'error');
            return;
        }

        const settings = settingsService.getSettings();
        if (!settings.apiKey || !msg) {
            return;
        }

        const generativeModel = new GoogleGenerativeAI(settings.apiKey).getGenerativeModel({
            model: settings.model,
            systemInstruction: settingsService.getSystemPrompt()
        });

        // First create and show user message
        await insertMessage("user", msg);

        // Handle chat creation with retry
        if (!await chatsService.getCurrentChat(db)) {
            try {
                const result = await generativeModel.generateContent('Please generate a short title for the following request from a user, only reply with the short title, nothing else: ' + msg);
                const title = result.response.text();
                const id = await chatsService.addChat(title, msg, db);
                document.querySelector(`#chat${id}`).click();
            } catch (error) {
                ErrorService.showError('Failed to create chat. Retrying...', 'warning');
                return;
            }
        }

        // Handle message stream with retry
        let retries = 3;
        while (retries > 0) {
            try {
                const chat = generativeModel.startChat({
                    generationConfig: {
                        maxOutputTokens: settings.maxTokens,
                        temperature: settings.temperature / 100
                    },
                    safetySettings: settings.safetySettings,
                    history: [
                        {
                            role: "user",
                            parts: [{ text: `Personality Name: ${selectedPersonality.name}, Personality Description: ${selectedPersonality.description}, Personality Prompt: ${selectedPersonality.prompt}. Your level of aggression is ${selectedPersonality.aggressiveness} out of 3. Your sensuality is ${selectedPersonality.sensuality} out of 3.` }]
                        },
                        {
                            role: "model",
                            parts: [{ text: "okie dokie. from now on, I will be acting as the personality you have chosen" }]
                        },
                        ...(selectedPersonality.toneExamples ? selectedPersonality.toneExamples.map((tone) => {
                            return { role: "model", parts: [{ text: tone }] }
                        }) : []),
                        ...(await chatsService.getCurrentChat(db)).content.map((msg) => {
                            return { role: msg.role, parts: msg.parts }
                        })
                    ]
                });

                const result = await chat.sendMessage(msg);
                const response = await result.response;
                const messageElement = await insertMessage("model", "", selectedPersonality.name, null, db);
                const messageText = messageElement.querySelector('.message-text');
                
                const text = response.text();
                messageText.innerHTML = marked.parse(text);
                helpers.messageContainerScrollToBottom();
                
                // Success - break the retry loop
                break;
            } catch (error) {
                retries--;
                if (retries === 0) {
                    throw error;
                }
                ErrorService.showError(`Retrying... ${retries} attempts left`, 'warning');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

    } catch (error) {
        console.error('Error sending message:', error);
        if (error.message !== 'Chat limit reached') {
            ErrorService.showError('Failed to send message. Please try again.', 'error');
        }
    } finally {
        // Re-enable controls
        sendButton.disabled = false;
        sendButton.innerHTML = originalContent;
        messageInput.setAttribute('contenteditable', 'true');
        messageInput.focus();
    }
}

function showLimitReachedAlert() {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'custom-alert';
    alertDiv.innerHTML = `
        <img src="https://upload.wikimedia.org/wikipedia/commons/5/5a/Wormgpt.svg" alt="WormGPT">
        <h3>Daily Limit Reached</h3>
        <p>You have reached your daily message limit. Please try again tomorrow or upgrade your key for unlimited access.</p>
        <button onclick="this.parentElement.remove()" class="alert-button">Got it</button>
    `;
    document.body.appendChild(alertDiv);
    
    // Add fade-in animation
    requestAnimationFrame(() => {
        alertDiv.style.opacity = '0';
        alertDiv.style.transform = 'translate(-50%, -48%)';
        requestAnimationFrame(() => {
            alertDiv.style.opacity = '1';
            alertDiv.style.transform = 'translate(-50%, -50%)';
        });
    });
}
