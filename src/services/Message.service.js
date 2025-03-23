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
                <h3 class="message-role">${selectedPersonalityTitle || 'Lisa'}</h3>
                <button class="btn-refresh btn-textual material-symbols-outlined" title="Regenerate response">
                    refresh
                </button>
            </div>
            <div class="message-text"></div>
        `;

        // Add refresh button handler
        const refreshBtn = newMessage.querySelector('.btn-refresh');
        if (refreshBtn) {
            // Add processing state flag
            let isProcessing = false;
            
            refreshBtn.onclick = async () => {
                // Check if this is the last response first
                const lastMessage = newMessage.parentElement.lastElementChild;
                if (newMessage !== lastMessage) {
                    ErrorService.showError('Can only regenerate the most recent response');
                    return;
                }

                // Prevent multiple clicks while processing
                if (isProcessing) {
                    return;
                }
                
                try {
                    isProcessing = true;
                    refreshBtn.disabled = true;
                    refreshBtn.innerHTML = '<span class="material-symbols-outlined loading">sync</span>';
                    
                    await regenerate(newMessage, db);
                } catch (error) {
                    console.error('Regeneration failed:', error);
                    // Reset button state on error
                    refreshBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>';
                } finally {
                    isProcessing = false;
                    refreshBtn.disabled = false;
                }
            };
        }

        if (!netStream && msg) {
            const messageText = newMessage.querySelector('.message-text');
            messageText.innerHTML = marked.parse(msg);
            helpers.addCopyButtons(); // Add copy buttons immediately after parsing markdown
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
    let refreshBtn = null;
    const sendButton = document.querySelector("#btn-send");
    const messageInput = document.querySelector("#messageInput");
    const originalContent = sendButton.innerHTML;
    
    try {
        // Check if this is the last response
        const lastMessage = responseElement.parentElement.lastElementChild;
        if (responseElement !== lastMessage) {
            ErrorService.showError('Can only regenerate the most recent response');
            return;
        }

        // Disable all controls immediately
        sendButton.disabled = true;
        sendButton.innerHTML = '<span class="material-symbols-outlined loading">sync</span>';
        messageInput.setAttribute('contenteditable', 'false');
        messageInput.style.opacity = '0.7';
        
        // Get and disable refresh button
        refreshBtn = responseElement.querySelector('.btn-refresh');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="material-symbols-outlined loading">sync</span>';
        }

        // Add artificial delay for UX
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get the original user message
        const message = responseElement.previousElementSibling.querySelector(".message-text").textContent;
        const selectedPersonality = await personalityService.getSelected();
        if (!selectedPersonality) {
            throw new Error('No personality selected');
        }

        // Get settings and create generative model
        const settings = settingsService.getSettings();
        const generativeModel = new GoogleGenerativeAI(settings.apiKey).getGenerativeModel({
            model: settings.model,
            systemInstruction: settingsService.getSystemPrompt()
        });

        // Get the original message and its index
        const elementIndex = [...responseElement.parentElement.children].indexOf(responseElement);
        const chat = await chatsService.getCurrentChat(db);
        
        // Keep only history up to this message's position
        chat.content = chat.content.slice(0, elementIndex);
        
        // Get all history up to current message for context
        const cleanHistory = chat.content.map(msg => ({
            role: msg.role,
            parts: msg.parts
        }));

        const chatContext = generativeModel.startChat({
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
                ...cleanHistory  // Include ALL chat history
            ]
        });

        // Remove old response and generate new one
        responseElement.remove();
        const result = await chatContext.sendMessage(message);
        const response = await result.response;

        // Create new message element with personality name
        const messageElement = await insertMessage(
            "model", 
            "", 
            selectedPersonality.name, // Pass personality name here
            null, 
            db
        );
        const messageText = messageElement.querySelector('.message-text');
        const text = response.text();
        
        messageText.innerHTML = marked.parse(text);
        helpers.addCopyButtons();
        helpers.messageContainerScrollToBottom();

        // Update chat history with personality info
        chat.content.push({ 
            role: "model",
            personality: selectedPersonality.name, // Keep personality in history
            parts: [{ text: text }]
        });
        await db.chats.put(chat);

    } catch (error) {
        console.error('Error regenerating message:', error);
        ErrorService.showError('Failed to regenerate response. Please try again.');
    } finally {
        // Re-enable all controls
        sendButton.disabled = false;
        sendButton.innerHTML = originalContent;
        messageInput.setAttribute('contenteditable', 'true');
        messageInput.style.opacity = '1';
        
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

        // Check remaining chats and decrement only once
        const remaining = await chatLimitService.getRemainingChats();
        if (remaining <= 0) {
            showLimitReachedAlert();
            throw new Error('Chat limit reached');
        }

        // Decrement chat limit once per message
        await chatLimitService.decrementChatLimit();
        await chatLimitService.updateDisplay();

        // Rest of the send function...
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
            helpers.addCopyButtons(); // Add copy buttons immediately after parsing markdown
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
