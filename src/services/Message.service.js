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
    
    if (sender !== "user") {
        newMessage.classList.add("message-model");
        newMessage.innerHTML = `
            <div class="message-header">
                <h3 class="message-role">${selectedPersonalityTitle || 'Assistant'}</h3>
                <button class="btn-refresh btn-textual material-symbols-outlined" title="Regenerate response">
                    refresh
                </button>
            </div>
            <div class="message-text"></div>
        `;

        // Add refresh button handler
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
            helpers.addCopyButtons();
        }
    } else {
        newMessage.innerHTML = `
            <div class="message-header">
                <h3 class="message-role">You:</h3>
            </div>
            <div class="message-text">${helpers.getDecoded(msg)}</div>
        `;
    }

    messageContainer.appendChild(newMessage);
    helpers.messageContainerScrollToBottom();
    return newMessage;
}

export async function regenerate(responseElement, db) {
    try {
        // Get and validate elements
        const refreshBtn = responseElement.querySelector('.btn-refresh');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<span class="material-symbols-outlined loading">sync</span>';
            refreshBtn.disabled = true;
        }

        // Get current chat and message index
        const chat = await chatsService.getCurrentChat(db);
        const elementIndex = [...responseElement.parentElement.children].indexOf(responseElement);
        const lastIndex = responseElement.parentElement.children.length - 1;

        // Only allow regeneration of the last model response
        if (elementIndex !== lastIndex) {
            ErrorService.showError('Can only regenerate the most recent response');
            if (refreshBtn) {
                refreshBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>';
                refreshBtn.disabled = false;
            }
            return;
        }

        // Get the previous message text (user's message)
        const message = responseElement.previousElementSibling.querySelector(".message-text").textContent;
        
        // Update chat content and remove current response
        chat.content = chat.content.slice(0, elementIndex);
        await db.chats.put(chat);
        responseElement.remove();

        // Generate new response without decrementing chat limit
        const settings = settingsService.getSettings();
        const selectedPersonality = await personalityService.getSelected();
        
        const generativeModel = new GoogleGenerativeAI(settings.apiKey).getGenerativeModel({
            model: settings.model,
            systemInstruction: settingsService.getSystemPrompt()
        });

        const result = await generativeModel.generateContent(message);
        const response = await result.response;
        const messageElement = await insertMessage("model", "", selectedPersonality.name, null, db);
        const messageText = messageElement.querySelector('.message-text');
        
        const text = response.text();
        messageText.innerHTML = marked.parse(text);
        helpers.messageContainerScrollToBottom();

        // Update chat history with new response
        const currentChat = await chatsService.getCurrentChat(db);
        currentChat.content.push({ 
            role: "model", 
            personality: selectedPersonality.name, 
            parts: [{ text: text }] 
        });
        await db.chats.put(currentChat);

    } catch (error) {
        console.error('Error regenerating message:', error);
        ErrorService.showError('Failed to regenerate response. Please try again.');
        
        // Reset refresh button if it exists
        const refreshBtn = responseElement?.querySelector('.btn-refresh');
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

export class TelegramAuthService {
    constructor() {
        this.storageKey = 'telegram_auth';
    }

    saveAuthData(initData) {
        try {
            // Parse the Telegram WebApp init data
            const urlParams = new URLSearchParams(initData);
            const user = JSON.parse(urlParams.get('user'));
            
            // Store user ID and auth data
            const authData = {
                userId: user.id,
                username: user.username,
                key: localStorage.getItem('access_key'),
                timestamp: Date.now()
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(authData));
        } catch (error) {
            console.error('Error saving Telegram auth data:', error);
            throw error;
        }
    }

    getAuthData() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey));
        } catch {
            return null;
        }
    }

    validateCurrentUser(initData) {
        try {
            const storedAuth = this.getAuthData();
            if (!storedAuth) return false;

            // Get current user from Telegram WebApp data
            const urlParams = new URLSearchParams(initData);
            const currentUser = JSON.parse(urlParams.get('user'));

            // Check if current user matches stored user
            return storedAuth.userId === currentUser.id;
        } catch (error) {
            console.error('Error validating Telegram user:', error);
            return false;
        }
    }

    clearAuth() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem('access_key');
    }
}

export const telegramAuthService = new TelegramAuthService();
