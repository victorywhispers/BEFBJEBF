import { chatLimitService } from './ChatLimitService.js';
import { db } from './Db.service.js';
import { addCopyButtons } from '../utils/helpers.js';

class KeyValidationService {
    constructor() {
        this.STORAGE_KEY = 'wormgpt_access_key';
        this.BASE_URL = 'https://wormgpt-api.onrender.com';  // Hardcoded production URL
        this.FRONTEND_URL = 'https://wormgpt-frontend.onrender.com'; // Frontend base URL
        this.SESSION_KEY = 'validated';
        this.VALIDATION_STATE_KEY = 'key_validation_state'; // Add new state key
    }

    validateKeyFormat(key) {
        const keyPattern = /^WR-[A-Z0-9]{10}$/;
        return keyPattern.test(key.toUpperCase());
    }

    async validateKey(key) {
        try {
            if (!this.validateKeyFormat(key)) {
                return { 
                    valid: false, 
                    message: 'Invalid key format. Key should start with WR- followed by 10 characters' 
                };
            }

            const apiKey = await generateApiKey();
            const response = await fetch(`${this.BASE_URL}/validation.html`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ key: key.toUpperCase() })
            });

            const data = await response.json();
            console.log('Server response:', data);

            // Server-side validation check
            if (!data.valid) {
                return data;
            }

            // Client-side expiry check
            const now = new Date();
            const expiryTime = new Date(data.expiryTime);

            if (now >= expiryTime) {
                this.clearValidation(false); // Don't redirect immediately
                return {
                    valid: false,
                    message: 'This key has expired'
                };
            }

            if (data.valid) {
                // Save valid state
                const validationState = {
                    key: key.toUpperCase(),
                    expiryTime: data.expiryTime,
                    type: data.type,
                    activatedAt: new Date().toISOString(),
                    isValid: true,
                    lastVerified: new Date().toISOString()
                };
                
                await this.saveKeyToDatabase(validationState);
                sessionStorage.setItem(this.SESSION_KEY, 'true');
                localStorage.setItem(this.SESSION_KEY, 'true');
                localStorage.setItem(this.VALIDATION_STATE_KEY, JSON.stringify(validationState));
                
                // Reset chat limits AND immediately update display
                await chatLimitService.resetChatLimit();
                await chatLimitService.updateDisplay(); // First update after reset
                
                // Update display elements
                const displayElement = document.querySelector('.chat-limit-display');
                const remainingChatsCount = document.querySelector('#remaining-chats-count');
                
                if (displayElement) {
                    displayElement.textContent = '40 messages remaining today';
                }
                if (remainingChatsCount) {
                    remainingChatsCount.textContent = '40 chats remaining';
                }

                // Immediately initialize copy buttons after successful validation
                setTimeout(() => {
                    addCopyButtons();
                }, 100); // Small delay to ensure DOM is updated

                return {
                    valid: true,
                    message: 'Key validated successfully',
                    expiryTime: data.expiryTime,
                    type: data.type
                };
            }

        } catch (error) {
            console.error('Key validation error:', error);
            return { 
                valid: false, 
                message: 'Server error during validation' 
            };
        }
    }

    async saveKeyToDatabase(keyData) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(keyData));
            return true;
        } catch (error) {
            console.error('Failed to save key to storage:', error);
            return false;
        }
    }

    async getKeyData() {
        try {
            const keyData = localStorage.getItem(this.STORAGE_KEY);
            return keyData ? JSON.parse(keyData) : null;
        } catch (error) {
            console.error('Failed to get key data:', error);
            return null;
        }
    }

    async isKeyValid() {
        try {
            const keyData = await this.getKeyData();
            if (!keyData) return false;

            const now = new Date();
            const expiryTime = new Date(keyData.expiryTime);

            // Strict expiry check
            if (now >= expiryTime) {
                this.clearValidation(); // This will redirect to the correct path now
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error checking key validity:', error);
            this.clearValidation();
            return false;
        }
    }

    async getRemainingTime() {
        const keyData = await this.getKeyData();
        if (!keyData) return null;

        const now = new Date();
        const expiryTime = new Date(keyData.expiryTime);
        const diff = expiryTime - now;

        // If expired or negative time, clear validation
        if (diff <= 0) {
            this.clearValidation();
            return null;
        }

        return {
            hours: Math.max(0, Math.floor(diff / (1000 * 60 * 60))),
            minutes: Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)))
        };
    }

    clearValidation(shouldRedirect = true) {
        // Clear all storage
        sessionStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.VALIDATION_STATE_KEY);
        
        // Redirect to validation page with correct path
        if (shouldRedirect && !window.location.pathname.includes('validation.html')) {
            window.location.replace(`${this.FRONTEND_URL}/validation.html`);
        }
    }
}

async function generateApiKey() {
    const secret = 'wormgpt_secret_key_2024';  // Match server's SECRET_KEY
    const message = 'wormgpt_api';
    
    const encoder = new TextEncoder();
    const keyData = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign(
        'HMAC',
        keyData,
        encoder.encode(message)
    );
    
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export const keyValidationService = new KeyValidationService();
