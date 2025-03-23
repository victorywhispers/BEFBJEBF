import { HarmBlockThreshold, HarmCategory } from "https://esm.run/@google/generative-ai";

// Remove API key input reference
const maxTokensInput = document.querySelector("#maxTokens");
const temperatureInput = document.querySelector("#temperature");
const modelSelect = document.querySelector("#selectedModel");

export function initialize() {
    loadSettings();
    temperatureLabelSetup();
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
        apiKey: "AIzaSyDK6QLkclQYOZyGwBWerRGefnLiuH89as0", // Hardcoded API key
        maxTokens: maxTokensInput.value,
        temperature: temperatureInput.value,
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
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.addEventListener('change', () => {
                const file = fileInput.files[0];
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const personality = JSON.parse(e.target.result);
                        if (!personality.name || !personality.description || !personality.prompt) {
                            throw new Error("Invalid personality file format");
                        }
                        personalityService.add(personality);
                    } catch (error) {
                        alert("Error importing personality: " + error.message);
                    }
                };
                reader.readAsText(file);
            });
            fileInput.click();
            fileInput.remove();
        });
    }
}
