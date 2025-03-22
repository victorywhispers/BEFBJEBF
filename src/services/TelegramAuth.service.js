export class TelegramAuthService {
    constructor() {
        this.storageKey = 'telegram_auth';
    }

    async saveAuthData(initData) {
        try {
            // Parse the Telegram WebApp init data
            const urlParams = new URLSearchParams(initData);
            const user = JSON.parse(urlParams.get('user'));
            
            const authData = {
                userId: user.id,
                username: user.username,
                key: localStorage.getItem('access_key'),
                timestamp: Date.now()
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(authData));
            return true;
        } catch (error) {
            console.error('Error saving Telegram auth data:', error);
            return false;
        }
    }

    getCurrentUser() {
        try {
            const authData = localStorage.getItem(this.storageKey);
            return authData ? JSON.parse(authData) : null;
        } catch {
            return null;
        }
    }

    validateCurrentUser(initData) {
        try {
            const storedAuth = this.getCurrentUser();
            if (!storedAuth) return false;

            const urlParams = new URLSearchParams(initData);
            const currentUser = JSON.parse(urlParams.get('user'));

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
