<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WormGPT, by Hecabrus</title>
    <link rel="shortcut icon" href="https://upload.wikimedia.org/wikipedia/commons/4/4a/Wormgpt.svg" type="image/x-icon">
    <link rel="stylesheet" href="./styles/main.css">
    <link rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.css">
    <link rel="stylesheet" href="styles/error.css">
    <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-VCHJXFGB08"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());

        gtag('config', 'G-VCHJXFGB08');
    </script>

</head>


<body>
    <div class="container">
        <div class="sidebar">
            <div class="header">
                <button class="material-symbols-outlined btn-textual" id="btn-hide-sidebar">
                    menu <!-- Changed from arrow_back_ios_new to menu -->
                </button>
                <img src="https://upload.wikimedia.org/wikipedia/commons/5/5a/Wormgpt.svg" id="gemin-pro-logo">
                <div id="title-div">
                    <div id="wormgpt-branding" class="animated-text">WormGPT</div>
                    <div id="powered-by">powered by Hecabrus</div>
                </div>
                <button class="badge" id="btn-whatsnew">
                    <span id="badge-version"></span>
                </button>
            </div>
            <div class="navbar">
                <div class="navbar-tab">Chats</div>
                <div class="navbar-tab">Models</div> <!-- Changed from Personalities -->
                <div class="navbar-tab">Settings</div>
                <div class="navbar-tab">User</div> <!-- New tab -->
                <div class="navbar-tab">Tasks</div>
                <div id="navbar-tab-highlight"></div>
            </div>
            <div id="sidebar-content">
                <div class="sidebar-section">
                    <div class="btn-array">
                        <button id="btn-new-chat">
                            <span class="material-symbols-outlined">add</span>
                            <span>New Chat</span>
                        </button>
                        <button id="btn-reset-chat">
                            <span class="material-symbols-outlined">clear_all</span>
                            Clear All
                        </button>
                    </div>

                    <input type="radio" name="currentChat" value="none" checked>
                    <div id="chatHistorySection">
                    </div>
                </div>

                <div class="sidebar-section" id="personalitySection">
                    <div id="personalitiesDiv"></div>
                    <div class="btn-array" id="btn-array-personality-section">
                        <button id="btn-add-personality">
                            <span class="material-symbols-outlined">add</span>
                            Add
                        </button>
                        <button id="btn-import-personality">Import</button> <!-- Uncomment this -->
                    </div>
                </div>

                <div class="sidebar-section">
                    <h3>Generation Settings</h3>
                    <div class="generation-settings">
                        <div>
                            <label class="setting-label" for="selectedModel"><span class="material-symbols-outlined">neurology</span>Model</label>
                            <select id="selectedModel" class="input-field">
                                <option value="gemini-2.0-flash" selected>WormGPT 1.0</option>
                            </select>
                        </div>
                        <div>
                            <label class="setting-label" for="maxTokens"><span class="material-symbols-outlined">generating_tokens</span>Max Output Tokens</label>
                            <input type="number" id="maxTokens" class="input-field" min="1" max="100000" value="100000" readonly></input>
                        </div>
                        <div>
                            <label for="temperature">Temperature</label>
                            <div class="btn-array">
                                <input type="range" min="80" max="80" id="temperature" class="slider" value="80" readonly>
                                <label id="label-temperature">0.8</label>
                            </div>
                        </div>
                    </div>
                    <h3>Support</h3> 
                    <div class="btn-array">
                        <a href="https://t.me/hecabruss" target="_blank" rel="noopener noreferrer" 
                            class="card card-telegram">
                            <span class="telegram-logo">TELEGRAM</span>
                        </a>
                    </div>
                </div>

                <!-- Add new sidebar section for User -->
                <div class="sidebar-section">
                    <h3>Chat Limits</h3>
                    <div class="user-stats">
                        <div class="chat-limit-display">
                            <span class="material-symbols-outlined">chat</span>
                            <div class="limit-info">
                                <div class="limit-count" id="remaining-chats-count"></div>
                                <div class="limit-reset">Resets in 24h</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Move Bonus Account section above Available Tasks -->
                <div class="sidebar-section" id="tasksSection">
                    <!-- Bonus Account section first -->
                    <h3>Bonus Account</h3>
                    <div class="user-stats">
                        <div class="bonus-display">
                            <span class="material-symbols-outlined">stars</span>
                            <div class="limit-info">
                                <div id="bonus-messages-count">0 bonus messages</div>
                                <div class="bonus-info">Never expires</div>
                            </div>
                        </div>
                    </div>

                    <!-- Available Tasks section second -->
                    <h3 style="margin-top: 20px;">Available Tasks</h3>
                    <div class="tasks-container">
                        <div class="task-card" id="task1">
                            <div class="task-header">
                                <span class="material-symbols-outlined">task_alt</span>
                                <h4>Task 1: Join & Earn 20 Bonus Messages</h4>
                            </div>
                            <div class="task-content">
                                <p>1. Click the bot link below</p>
                                <p>2. Join 2 required channels</p>
                                <p>3. Click "Joined" in bot</p>
                                <p>4. Wait 2 minutes for verification</p>
                                <div class="task-reward">
                                    <span class="material-symbols-outlined">chat</span>
                                    20 Bonus Messages
                                </div>
                                <div class="task-actions">
                                    <a href="https://t.me/Get_Chatgpt2Bot?start=7903500450" 
                                       target="_blank" 
                                       class="task-button" 
                                       id="task1-button">
                                        Start Task
                                    </a>
                                    <div class="task-timer hidden">
                                        <span class="material-symbols-outlined">schedule</span>
                                        Verifying: <span id="task1-timer">120</span>s
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>


            <div class="credits">
                Made by Hecabrus
            </div>
        </div>

        <div id="mainContent">
            <div class="header">
                <button class="material-symbols-outlined btn-textual" id="btn-show-sidebar">
                    menu
                </button>
            </div>
            <div class="message-container">
                <!-- Rest of your messages -->
            </div>
            <div id="message-box">
                <span contenteditable placeholder="Send a message" id="messageInput" class="input-field"></span>
                <button type="submit" class="btn-textual material-symbols-outlined" id="btn-send">send</button>
            </div>
        </div>
    </div>

    <div class="overlay">
        <div class="header">
            <button class="btn-textual" id="btn-hide-overlay">BACK</button>
        </div>
        <div class="overlay-content">
            <form id="form-add-personality">
                <div class="stepper first-step" id="stepper-add-personality">
                    <div class="stepper-content">
                        <div class="step active">
                            <!-- we match the name property of each input to the corresponding key in our personality model (Personality.service.js) -->
                            <h3>Basic Info</h3>
                            <input style="display: none;" name="id">
                            <label for="name">Name:</label>
                            <input type="text" name="name" placeholder="Mario" list="name-list">
                            <label for="description">Description:</label>
                            <input type="text" name="description" placeholder="A  plumber with a shroom addiction.">
                            <label for="image">Image URL:</label>
                            <input type="text" name="image" placeholder="https://example.com/mario.png">
                            <label for="prompt">System Prompt:</label>
                            <textarea type="text" name="prompt"
                                placeholder="You are to act as main character from the Mario video game series..."
                                style="height: 5rem; resize:vertical"></textarea>
                        </div>
                        <div class="step">
                            <h3>Personality</h3>
                            <label for="aggressiveness">Aggressiveness:</label>
                            <input type="range" name="aggressiveness" min="0" max="3" step="1"
                                list="aggressiveness-steps">
                            <datalist id="aggressiveness-steps">
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                            </datalist>
                            <label for="sensuality">Sensuality:</label>
                            <input type="range" name="sensuality" min="0" max="3" step="1" list="sensuality-steps">
                            <datalist id="sensuality-steps">
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                            </datalist>
                            <h3>Tweaks</h3>
                            <!-- internet access toggle -->
                            <div style="display: flex; gap: 0.25rem; align-items: center;">
                                <input id="internet-access" type="checkbox" name="internetEnabled"></input>
                                <label for="internet-access">Internet Access</label>
                                <span class="material-symbols-outlined"
                                    style="font-size: 0.885rem; opacity: 0.6; cursor:default"
                                    title="Enhance the model's responses with online search queries. Useful for fact checking and grounding. Currently still in development.">info</span>
                            </div>
                            <!-- roleplay toggle -->
                            <div style="display: flex; gap: 0.25rem; align-items: center;">
                                <input id="roleplay" type="checkbox" name="roleplayEnabled"></input>
                                <label for="roleplay">Roleplay</label>
                                <span class="material-symbols-outlined"
                                    style="font-size: 0.885rem; opacity: 0.6; cursor:default"
                                    title="This attribute enhances your roleplay experience by enabling a new game-ified interface. Currently still in development.">info</span>
                            </div>
                        </div>
                        <div class="step">
                            <div>
                                <h3 style="display:inline">Tone Examples</h3>
                                <span style="opacity: 60%; font-size: 90%; font-style: italic;">Optional</span>
                            </div>
                            <input type="text" name="tone-example-1" class="tone-example"
                                placeholder="I'm a plumber, not a doctor. Lets-a go!">
                            <button type="button" id="btn-add-tone-example"
                                class="material-symbols-outlined">add_circle</button>
                        </div>
                    </div>
                    <div class="stepper-footer">
                        <button id="btn-stepper-previous" type="button">Previous</button>
                        <div id="stepper-progress"></div>
                        <button id="btn-stepper-next" type="button">Next</button>
                        <button id="btn-stepper-submit" type="submit">Submit</button>
                    </div>
                </div>
            </form>


            <div id="whats-new">
                <h1 id="header-version">What's New in </h1>
                <ul id="changelog">
                    <li>Stability improvements</li>
                    <li>Join my telegram channel for any doubt or any bugs: <a href="https://t.me/hecabruss" target="_blank">Telegram Channel</a></li>
                </ul>
            </div>
        </div>


    </div>

    <script type="module" src="main.js"></script>
    <script type="module">
        import { tasksService } from './services/Tasks.service.js';

        document.addEventListener('DOMContentLoaded', () => {
            // Check if task is already completed
            if (tasksService.isTaskCompleted('task1')) {
                const taskCard = document.getElementById('task1');
                if (taskCard) {
                    taskCard.style.display = 'none';
                }
            }

            const task1Button = document.getElementById('task1-button');
            const timerDiv = document.querySelector('.task-timer');
            
            if (task1Button) {
                task1Button.addEventListener('click', () => {
                    timerDiv.classList.remove('hidden');
                    let timeLeft = 120;
                    const timerSpan = document.getElementById('task1-timer');
                    
                    const timer = setInterval(async () => {
                        timeLeft--;
                        if (timerSpan) timerSpan.textContent = timeLeft;
                        
                        if (timeLeft <= 0) {
                            clearInterval(timer);
                            // Complete task and update UI
                            const taskContent = document.querySelector('#task1 .task-content');
                            if (taskContent) {
                                taskContent.innerHTML = `
                                    <div class="task-success">
                                        <span class="material-symbols-outlined">check_circle</span>
                                        Task completed! 20 bonus messages added to your account
                                    </div>
                                `;
                            }
                            
                            await tasksService.completeTask('task1');
                            
                            // Hide task card after completion
                            setTimeout(() => {
                                const taskCard = document.getElementById('task1');
                                if (taskCard) {
                                    taskCard.classList.add('completed');
                                    taskCard.style.display = 'none';
                                }
                            }, 3000);
                        }
                    }, 1000);
                });
            }
        });
    </script>
</body>

</html>
