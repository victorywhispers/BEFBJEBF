import { chatLimitService } from './ChatLimitService.js';
import { db } from './Db.service.js';

class KeyValidationService {
    constructor() {
        this.STORAGE_KEY = 'wormgpt_access_key';
        this.BASE_URL = 'https://wormgpt-api.onrender.com';  // Hardcoded production URL
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
            console.log('Sending request to:', `${this.BASE_URL}/validate-key`);
            
            const response = await fetch(`${this.BASE_URL}/validate-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ key: key.toUpperCase() })
            });

            if (!response.ok) {
                console.error('Server response not OK:', response.status);
                return { 
                    valid: false, 
                    message: 'Server validation failed' 
                };
            }

            const data = await response.json();
            console.log('Server response:', data);

            if (data.valid) {
                await this.saveKeyToDatabase({
                    key: key.toUpperCase(),
                    expiryTime: data.expiryTime,
                    type: data.type,
                    activatedAt: new Date().toISOString()
                });
            }
            
            return data;
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
            return now < expiryTime;
        } catch (error) {
            console.error('Error checking key validity:', error);
            return false;
        }
    }

    async getRemainingTime() {
        const keyData = await this.getKeyData();
        if (!keyData) return null;

        const now = new Date();
        const expiryTime = new Date(keyData.expiryTime);
        const diff = expiryTime - now;

        return {
            hours: Math.floor(diff / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        };
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
