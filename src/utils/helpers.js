import DOMPurify from 'dompurify';
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

// Description: This file contains helper functions that are used throughout the application.

export function hideElement(element) {
    if (!element) {
        return;
    }
    element.style.transition = 'opacity 0.2s';
    element.style.opacity = '0';
    setTimeout(function () {
        element.style.display = 'none';
    }, 200);
}

export function showElement(element, wait) {
    if (!element) {
        return;
    }
    let timeToWait = 0
    if (wait) {
        timeToWait = 200;
    }
    setTimeout(function () {
        element.style.display = 'flex';
        element.style.opacity = '0';  //required as certain elements arent opacity 0 despite being hidden
        element.style.transition = 'opacity 0.2s';
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                element.style.opacity = '1';
            });
        });
    }, timeToWait);
}

export function darkenCard(element) {
    let elementBackgroundImageURL = element.style.backgroundImage.match(/url\((.*?)\)/)[1].replace(/('|")/g, '');
    element.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('${elementBackgroundImageURL}')`;
}


export function lightenCard(element) {
    let elementBackgroundImageURL = element.style.backgroundImage.match(/url\((.*?)\)/)[1].replace(/('|")/g, '');
    element.style.backgroundImage = `url('${elementBackgroundImageURL}')`;
}

export function getVersion(){
    return "0.9";
}

export function getSanitized(string) {
    return DOMPurify.sanitize(string.trim(), {breaks: true});
}

function getUnescaped(innerHTML){
    return innerHTML.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function getMdNewLined(innerHTML){
    //replace <br> with \n
    //also collapse multiple newlines into one
    return innerHTML.replace(/<br>/g, "\n").replace(/\n{2,}/g, "\n");
}

export function getEncoded(innerHTML){
    return getUnescaped(getMdNewLined(innerHTML)).trim();
}

export function getDecoded(encoded){
    //reescape, convert to md
    return marked.parse(encoded.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), {breaks: true});
}

export function messageContainerScrollToBottom(){
    const container = document.querySelector(".message-container");
    container.scrollBy({
        top: container.scrollHeight
    });
}

export function addCopyButtons() {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(code => {
        // Get language from class
        const language = code.className.replace('language-', '');
        
        // Create wrapper div if not exists
        let wrapper = code.closest('.code-block-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            wrapper.setAttribute('data-language', language || 'text');
            code.parentNode.insertBefore(wrapper, code);
            wrapper.appendChild(code);
            
            // Add copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-code-button';
            copyButton.innerHTML = '<span class="material-symbols-outlined">content_copy</span>';
            
            // Add mouseover event to ensure button is visible
            wrapper.addEventListener('mouseenter', () => {
                copyButton.style.opacity = '1';
            });
            
            wrapper.addEventListener('mouseleave', () => {
                copyButton.style.opacity = '0';
            });
            
            copyButton.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent event bubbling
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
    
    // Add click handler to message container to ensure copy buttons are always available
    const messageContainer = document.querySelector('.message-container');
    if (messageContainer && !messageContainer.hasAttribute('copy-handler')) {
        messageContainer.setAttribute('copy-handler', 'true');
        messageContainer.addEventListener('click', (e) => {
            if (e.target.closest('pre code')) {
                addCopyButtons();
            }
        });
    }
}
