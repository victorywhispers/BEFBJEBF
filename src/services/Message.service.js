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
                <button class="btn-refresh btn-textual material-symbols-outlined" title="Regenerate response">
                    refresh
                </button>
            </div>
            <div class="message-role-api" style="display: none;">${sender}</div>
            <div class="message-text"></div>
        `;
        // Add click handler for refresh button
        const refreshBtn = newMessage.querySelector('.btn-refresh');
        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                try {
                    await regenerate(newMessage, db);
                } catch (error) {
                    console.error('Regeneration failed:', error);
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
    let refreshBtn = null;
    try {
        // Verify response element exists
        if (!responseElement) {
            throw new Error('Response element not found');
        }

        // Get and store refresh button first
        refreshBtn = responseElement.querySelector('.btn-refresh');
        if (!refreshBtn) {
            throw new Error('Refresh button not found');
        }

        // Store original content and update UI
        const originalContent = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<span class="material-symbols-outlined loading">sync</span>';
        refreshBtn.disabled = true;

        // Get previous message element and verify it exists
        const previousElement = responseElement.previousElementSibling;
        if (!previousElement) {
            throw new Error('Previous message not found');
        }

        // Get message text element and verify it exists
        const messageTextElement = previousElement.querySelector(".message-text");
        if (!messageTextElement) {
            throw new Error('Message text element not found');
        }

        // Get user message
        const userMessage = messageTextElement.textContent;
        if (!userMessage) {
            throw new Error('No message content found');
        }

        // Get chat index and update DB
        const elementIndex = [...responseElement.parentElement.children].indexOf(responseElement);
        const chat = await chatsService.getCurrentChat(db);
        
        // Update chat content and save
        chat.content = chat.content.slice(0, elementIndex);
        await db.chats.put(chat);

        // Remove subsequent messages
        while (responseElement.nextElementSibling) {
            responseElement.nextElementSibling.remove();
        }
        responseElement.remove();

        // Generate new response
        await send(userMessage, db);

    } catch (error) {
        console.error('Error regenerating message:', error);
        ErrorService.showError(`Failed to regenerate message: ${error.message}`, 'error');
        
        // Reset button state if we have the button
        if (refreshBtn) {
            refreshBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>';
            refreshBtn.disabled = false;
        }
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

        // Reduced artificial delay from 1000ms to 500ms
        await new Promise(resolve => setTimeout(resolve, 1000));

        const remaining = await chatLimitService.getRemainingChats();
        if (remaining <= 0) {
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
            
            throw new Error('Chat limit reached');
        }

        await chatLimitService.decrementChatLimit();
        await chatLimitService.updateDisplay();

        const selectedPersonality = await personalityService.getSelected();
        if (!selectedPersonality) {
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

        if (!await chatsService.getCurrentChat(db)) {
            const result = await generativeModel.generateContent('Please generate a short title for the following request from a user, only reply with the short title, nothing else: ' + msg);
            const title = result.response.text();
            const id = await chatsService.addChat(title, msg, db); // Pass the first message
            document.querySelector(`#chat${id}`).click();
        }

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

        try {
            const result = await chat.sendMessage(msg);
            const response = await result.response;
            const messageElement = await insertMessage("model", "", selectedPersonality.name, null, db);
            const messageText = messageElement.querySelector('.message-text');
            
            const text = response.text();
            messageText.innerHTML = marked.parse(text);
            helpers.messageContainerScrollToBottom();

            // Save both messages in chat history
            const currentChat = await chatsService.getCurrentChat(db);
            if (!currentChat.content.some(m => m.role === "user" && m.parts[0].text === msg)) {
                currentChat.content.push({ role: "user", parts: [{ text: msg }] });
            }
            currentChat.content.push({ 
                role: "model", 
                personality: selectedPersonality.name, 
                parts: [{ text: text }] 
            });
            await db.chats.put(currentChat);

            const refreshBtn = messageElement.querySelector('.btn-refresh');
            if (refreshBtn) {
                refreshBtn.onclick = async () => {
                    await regenerate(messageElement, db); // Pass db here
                };
            }
        } catch (error) {
            console.error('Error in chat response:', error);
            throw error;
        } finally {
            // Re-enable send button and message input
            sendButton.disabled = false;
            sendButton.innerHTML = originalContent;
            messageInput.setAttribute('contenteditable', 'true');
            messageInput.focus();
        }

    } catch (error) {
        console.error('Error sending message:', error);
        if (error.message !== 'Chat limit reached') {
            ErrorService.showError('Failed to send message. Please try again.', 'error');
        }
        // Re-enable controls even if there's an error
        sendButton.disabled = false;
        sendButton.innerHTML = 'send';
        messageInput.setAttribute('contenteditable', 'true');
        throw error;
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
