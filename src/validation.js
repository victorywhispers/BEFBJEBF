import { telegramAuthService } from './services/TelegramAuth.service.js';
import { keyValidationService } from './services/KeyValidationService.js';
import { PrivacyPolicy } from './components/Privacy.component.js';
import { TermsAndConditions } from './components/Terms.component.js';

class ValidationPage {
    constructor() {
        this.initialize();
    }

    initialize() {
        const verifyBtn = document.getElementById('verifyKeyBtn');
        const keyInput = document.getElementById('verificationKeyInput');
        const statusElement = document.getElementById('verificationStatus');
        const privacyBtn = document.getElementById('privacyBtn');
        const termsBtn = document.getElementById('termsBtn');

        // Update button state based on input
        const updateButtonState = () => {
            const isEmpty = !keyInput.value.trim();
            verifyBtn.className = `verify-button ${isEmpty ? 'get-key' : 'verify'}`;
            verifyBtn.innerHTML = isEmpty ? 
                '<span class="material-symbols-outlined">download</span>Get Key' :
                '<span class="material-symbols-outlined">check_circle</span>Verify';
                
            verifyBtn.onclick = isEmpty ?
                () => window.open('https://t.me/HecKeys_bot', '_blank') :
                this.handleVerification;
        };

        const handleVerification = async () => {
            try {
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = '<span class="material-symbols-outlined loading">sync</span>Verifying...';

                const result = await keyValidationService.validateKey(keyInput.value.trim());

                if (result.valid) {
                    // Save Telegram auth data
                    const webAppData = window.Telegram?.WebApp?.initData;
                    if (webAppData) {
                        await telegramAuthService.saveAuthData(webAppData);
                    }

                    statusElement.innerHTML = `
                        <div class="success-message">
                            <span class="material-symbols-outlined">check_circle</span>
                            ${result.message}
                        </div>`;

                    setTimeout(() => window.location.href = './index.html', 1500);
                } else {
                    statusElement.innerHTML = `
                        <div class="error-message">
                            <span class="material-symbols-outlined">error</span>
                            ${result.message}
                        </div>`;
                }
            } catch (error) {
                console.error('Verification error:', error);
                statusElement.innerHTML = `
                    <div class="error-message">
                        <span class="material-symbols-outlined">error</span>
                        Error connecting to server
                    </div>`;
            } finally {
                verifyBtn.disabled = false;
                updateButtonState();
            }
        };

        keyInput.addEventListener('input', updateButtonState);
        updateButtonState();

        // Handle privacy and terms navigation
        privacyBtn.onclick = () => {
            const privacyPage = new PrivacyPolicy();
            document.body.appendChild(privacyPage.container);
        };

        termsBtn.onclick = () => {
            const termsPage = new TermsAndConditions();
            document.body.appendChild(termsPage.container);
        };
    }
}

// Initialize the page
new ValidationPage();
