import { tasksService } from './Tasks.service.js';

export class ChatLimitService {
    constructor() {
        this.storageKey = 'chat_limits';
        this.processingMessage = false;
    }

    async initializeChatLimit() {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) {
            const initial = {
                remaining: 40,
                total: 40,
                lastReset: new Date().toISOString()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(initial));
            return initial.remaining;
        }
        await this.checkDailyReset();
        return JSON.parse(stored).remaining;
    }

    async checkDailyReset() {
        const limits = JSON.parse(localStorage.getItem(this.storageKey));
        if (!limits) return;

        const lastReset = new Date(limits.lastReset);
        const now = new Date();
        
        // Check if it's a new day
        if (lastReset.getDate() !== now.getDate() || 
            lastReset.getMonth() !== now.getMonth() || 
            lastReset.getFullYear() !== now.getFullYear()) {
            // Reset daily limit
            limits.remaining = 40;
            limits.total = 40;
            limits.lastReset = now.toISOString();
            localStorage.setItem(this.storageKey, JSON.stringify(limits));
        }
    }

    async canSendMessage() {
        await this.checkDailyReset();
        const limits = JSON.parse(localStorage.getItem(this.storageKey));
        const bonusMessages = tasksService.getBonusMessages();
        
        return (limits && limits.remaining > 0) || bonusMessages > 0;
    }

    async decrementChatLimit() {
        // Prevent multiple decrements for the same message
        if (this.processingMessage) {
            return await this.getRemainingChats();
        }

        try {
            this.processingMessage = true;
            await this.checkDailyReset();
            const limits = JSON.parse(localStorage.getItem(this.storageKey));
            
            // First try to use regular chat limit
            if (limits && limits.remaining > 0) {
                limits.remaining--;
                localStorage.setItem(this.storageKey, JSON.stringify(limits));
                return limits.remaining;
            }
            
            // If no regular chats left, use bonus messages
            if (tasksService.useBonusMessage()) {
                return 0; // Return 0 for regular chats since we used a bonus
            }
            
            return -1; // No messages available
        } finally {
            // Reset the processing flag after a delay
            setTimeout(() => {
                this.processingMessage = false;
            }, 1000);
        }
    }

    async getRemainingChats() {
        await this.checkDailyReset();
        const limits = JSON.parse(localStorage.getItem(this.storageKey));
        return limits ? limits.remaining : 0;
    }

    async resetChatLimit() {
        const initial = {
            remaining: 40,
            total: 40,
            lastReset: new Date().toISOString()
        };
        localStorage.setItem(this.storageKey, JSON.stringify(initial));
        return initial.remaining;
    }

    async updateDisplay() {
        const remaining = await this.getRemainingChats();
        const bonusMessages = tasksService.getBonusMessages();
        const displayElement = document.querySelector('.chat-limit-display');
        
        if (displayElement) {
            if (remaining > 0) {
                displayElement.textContent = `${remaining} messages remaining today + ${bonusMessages} bonus`;
            } else if (bonusMessages > 0) {
                displayElement.textContent = `${bonusMessages} bonus messages remaining`;
            } else {
                displayElement.textContent = 'No messages remaining';
            }
        }
    }
}

export const chatLimitService = new ChatLimitService();
