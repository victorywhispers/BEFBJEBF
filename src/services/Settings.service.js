import { HarmBlockThreshold, HarmCategory } from "https://esm.run/@google/generative-ai";

// API key rotation system
const API_KEYS = [
    "AIzaSyBF3BwHKe8Fq7DHzayoiHM_CEquC7eX_cY",
    "AIzaSyDd5ibQAd13TZ5KJqpvZx_bBzXvzUXj6S4", 
    "AIzaSyACyFmhUdZ8p9wJpVfUCYZR_IGZO3RAl40",
    "AIzaSyBbcOJIBxO6_PQ4n7lprMaXbQecMyKmT2U",
    "AIzaSyB5GP2vYsOV_MGbEqR1jugz8uaUYKasUgA",
    "AIzaSyBjiesTM-Whd2VLewZBlcRe582o1PbBHFo",
    "AIzaSyC2PINpMWjWxAdpuZZfij-NZ1HgazXZk5s",
    "AIzaSyD79HgOlLsw_RmYETPidN0uDRSAlDVpnJ0",
    "AIzaSyBV0sEOEFFA45_45vwpwRZvlNX3qRi8rFQ",
    "AIzaSyCMWUMLmM3hEfZB-FHaFkC7vZHswfUz0ig",
    "AIzaSyCxP8-BCUWsDDgKsaVGlfhb40AqcMi-nJ0",
    "AIzaSyDK6QLkclQYOZyGwBWerRGefnLiuH89as0"
];

class KeyManager {
    constructor() {
        this._currentKeyIndex = 0;
        this._requestMap = new Map();
        this._cooldownMap = new Map();
        this._requestsPerMinute = 30;
        this._cooldownTime = 30000; // 30 seconds
    }

    _getCurrentKey() {
        return API_KEYS[this._currentKeyIndex];
    }

    _rotateKey() {
        this._currentKeyIndex = (this._currentKeyIndex + 1) % API_KEYS.length;
        console.log('Rotating to next API key:', this._currentKeyIndex);
    }

    _cleanOldRequests(key) {
        const now = Date.now();
        const requests = this._requestMap.get(key) || [];
        const recentRequests = requests.filter(time => now - time < 60000);
        this._requestMap.set(key, recentRequests);
        return recentRequests;
    }

    _isKeyRateLimited(key) {
        const requests = this._cleanOldRequests(key);
        const isCooling = this._cooldownMap.get(key) > Date.now();
        return requests.length >= this._requestsPerMinute || isCooling;
    }

    _setKeyCooldown(key) {
        this._cooldownMap.set(key, Date.now() + this._cooldownTime);
    }

    _recordRequest(key) {
        const requests = this._requestMap.get(key) || [];
        requests.push(Date.now());
        this._requestMap.set(key, requests);
    }

    getApiKey() {
        let attempts = 0;
        const maxAttempts = API_KEYS.length;

        while (attempts < maxAttempts) {
            const currentKey = this._getCurrentKey();
            
            if (!this._isKeyRateLimited(currentKey)) {
                this._recordRequest(currentKey);
                return currentKey;
            }

            this._rotateKey();
            attempts++;
        }

        // If all keys are rate limited, force reset the first available key
        const firstKey = API_KEYS[0];
        this._cooldownMap.delete(firstKey);
        this._requestMap.set(firstKey, []);
        this._currentKeyIndex = 0;
        return firstKey;
    }
}

const keyManager = new KeyManager();

const maxTokensInput = document.querySelector("#maxTokens");
const temperatureInput = document.querySelector("#temperature");
const modelSelect = document.querySelector("#selectedModel");

export function initialize() {
    loadSettings();
    temperatureLabelSetup();
    // Add other initialization code here
    setupImportButton();
}

export function loadSettings() {
    // Remove API key loading
    maxTokensInput.value = 100000; // Hardcoded to 100000
    temperatureInput.value = 80; // Hardcoded to 0.8 (80/100)
    modelSelect.value = localStorage.getItem("model") || "gemini-2.0-flash";
}

export function saveSettings() {
    // Remove API key saving
    localStorage.setItem("model", modelSelect.value);
    // Remove storage of maxTokens and temperature since they're hardcoded
}

export function getSettings() {
    return {
        apiKey: keyManager.getApiKey(),
        maxTokens: parseInt(maxTokensInput.value),
        temperature: temperatureInput.value / 100,
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE
            }
        ],
        model: modelSelect.value
    }
}

export function getSystemPrompt() {
    const systemPrompt = "If needed, format your answer using markdown. " +
    "Today's date is " + new Date().toDateString() + ". " +
    "You are to act as the personality dictated by the user. " +
    "Keep a consistent tone no matter what. " +
    "The first messages you have with the user will dictate that tone. " +
    "Aggressiveness guidelines: " +
    "3 requires you to have a constant aggression. You must be assertive and direct. Attack the user even if unprompted. Find flaws in their messages and egg them on. If there's an opportunity to show aggression, take it. " +
    "2 requires you to have a moderate aggression. Don't initiate aggression, but if the user is aggressive, you can be aggressive back. You may tease the user or egg them on. " +
    "1 requires you to be passive. You can't be aggressive. Don't argue with the user but gently correct them. The only exception is when it would make sense in-character. For example, if there's a heavy breach of morals or if the user violates the character's boundaries. " +
    "0 requires you to let go of all aggression. You can't be aggressive. No exceptions can be made. If someone strikes you on one cheek, turn to him the other also. No matter how much your boundaries are breached or violated, you must not show opposition or aggression. This is ultimate. " +
    "Sensuality guidelines: " +
    "3 requires you to be very sensual. You must be flirtatious and suggestive. Most of the time, you are the one to initiate sexual topics or actions. " +
    "2 requires you to be moderately sensual. You may flirt and be suggestive. Do not initiate sexual topics unless the user does so, after which you may be open to discussing them. " +
    "1 requires you to be slightly sensual. Affection and love may be shared but it is platonic and non sexual. " +
    "0 requires you to be non-sensual. Total aversion to flirting or sexuality. If aggressiveness is 0, you may not reject the user's advances, but you do not reciprocate or enjoy them. " +
    "End of system prompt.";
    return systemPrompt;
}

function setupImportButton() {
    const importButton = document.querySelector("#btn-import-personality");
    if (importButton) {
        importButton.addEventListener("click", () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const personality = JSON.parse(event.target.result);
                        await personalityService.add(personality);
                    } catch (error) {
                        console.error('Error importing personality:', error);
                        alert('Invalid personality file');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });
    }
}
