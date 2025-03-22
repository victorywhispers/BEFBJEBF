import * as messageService from '../services/Message.service';
import * as dbService from '../services/Db.service';
import * as helpers from '../utils/helpers';
import { chatLimitService } from '../services/ChatLimitService.js';
import { keyValidationService } from '../services/KeyValidationService.js';
import { ErrorService } from '../services/Error.service.js'; // Add this import
import { telegramAuthService } from '../services/TelegramAuth.service.js';

const messageInput = document.querySelector("#messageInput");
const sendMessageButton = document.querySelector("#btn-send");

export class ChatInput {
    constructor() {
        this.form = document.querySelector("#message-box");
        this.messageInput = document.querySelector("#messageInput");
        this.sendButton = document.querySelector("#btn-send");
        this.remainingChatsElement = document.querySelector("#remaining-chats-count");
        
        // Initialize the component
        this.initialize();
        this.setupMessageObserver();
    }

    async initialize() {
        try {
            // Initialize chat limits asynchronously
            this.remainingChats = await chatLimitService.initializeChatLimit();
            this.updateRemainingChatsDisplay();
            this.checkKeyValidity();
            this.init();
        } catch (error) {
            console.error('Failed to initialize chat input:', error);
            this.remainingChats = 0;
            this.updateRemainingChatsDisplay();
        }
    }

    async checkKeyValidity() {
        const webAppData = window.Telegram?.WebApp?.initData;
        if (!webAppData) {
            ErrorService.showError('Must be opened through Telegram WebApp');
            return false;
        }

        if (!telegramAuthService.validateCurrentUser(webAppData)) {
            telegramAuthService.clearAuth();
            window.location.href = '../validation.html';
            return false;
        }

        return true;
    }

    updateRemainingChatsDisplay() {
        this.remainingChatsElement.textContent = `${this.remainingChats} chats remaining`;
        
        if (this.remainingChats <= 2) {
            this.remainingChatsElement.classList.add('warning');
        } else {
            this.remainingChatsElement.classList.remove('warning');
        }
    }

    async handleSubmit() {
        try {
            const canSend = await chatLimitService.canSendMessage();
            if (!canSend) {
                ErrorService.showError('Daily message limit reached. Please wait for tomorrow or upgrade your key.', 'error');
                return;
            }

            const message = helpers.getEncoded(this.messageInput.innerHTML);
            // Check if message is empty or contains only whitespace
            if (!message || !message.trim()) {
                return;
            }

            this.messageInput.innerHTML = "";
            await messageService.send(message, dbService.db);

            // Update the remaining chats count
            this.remainingChats = await chatLimitService.decrementChatLimit();
            this.updateRemainingChatsDisplay();
        } catch (error) {
            console.error('Error sending message:', error);
            ErrorService.showError('Failed to send message. Please try again.', 'error');
        }
    }

    showCustomAlert(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'custom-alert';
        alertDiv.innerHTML = `
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/5a/Wormgpt.svg" alt="WormGPT">
            <h3>Chat Limit Reached</h3>
            <p>${message || 'You have exhausted your daily chat limit. Please try again tomorrow.'}</p>
            <button onclick="this.parentElement.remove()">Got it</button>
        `;
        document.body.appendChild(alertDiv);
    }

    setupMessageObserver() {
        // Create an observer to watch for new messages
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    // Call addCopyButtons whenever new messages are added
                    this.addCopyButtonsToNewMessages(mutation.addedNodes);
                }
            });
        });

        // Start observing the message container
        const messageContainer = document.querySelector('.message-container');
        observer.observe(messageContainer, { childList: true, subtree: true });
    }

    addCopyButtonsToNewMessages(nodes) {
        nodes.forEach(node => {
            if (node.classList && node.classList.contains('ai-message')) {
                const codeBlocks = node.querySelectorAll('pre code');
                if (codeBlocks.length > 0) {
                    codeBlocks.forEach(code => {
                        // Wrap code block if not already wrapped
                        let wrapper = code.closest('.code-block-wrapper');
                        if (!wrapper) {
                            wrapper = document.createElement('div');
                            wrapper.className = 'code-block-wrapper';
                            code.parentNode.insertBefore(wrapper, code);
                            wrapper.appendChild(code);
                        }

                        // Add copy button if not exists
                        if (!wrapper.querySelector('.copy-code-button')) {
                            const copyButton = document.createElement('button');
                            copyButton.className = 'copy-code-button';
                            copyButton.innerHTML = '<span class="material-symbols-outlined">content_copy</span>';
                            
                            copyButton.addEventListener('click', async () => {
                                const text = code.textContent;
                                try {
                                    await navigator.clipboard.writeText(text);
                                    copyButton.innerHTML = '<span class="material-symbols-outlined">check</span>';
                                    setTimeout(() => {
                                        copyButton.innerHTML = '<span class="material-symbols-outlined">content_copy</span>';
                                    }, 2000);
                                } catch (err) {
                                    console.error('Failed to copy code:', err);
                                }
                            });
                            
                            wrapper.appendChild(copyButton);
                        }
                    });
                }
            }
        });
    }

    init() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit();
        });

        this.sendButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.handleSubmit();
        });
    }
}

// Initialize the chat input
const chatInput = new ChatInput();
