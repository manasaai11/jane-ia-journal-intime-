document.addEventListener('DOMContentLoaded', () => {
    class JaneJournal {
        constructor() {
            this.currentUser = null;
            this.conversationHistory = []; // Historique de la session actuelle et persistant pour l'analyse contextuelle rapide
            this.currentLanguage = localStorage.getItem('janeLanguage') || 'fr';
            this.janeResponses = this.loadJaneResponses(); // Charge les réponses et messages localisés
            this.recognition = null; // Pour la reconnaissance vocale
            this.lastJaneResponse = ''; // Pour éviter la répétition immédiate
            this.currentOptionActive = null; // Pour gérer l'état des options interactives
            this.optionStep = 0; // Pour avancer dans les dialogues des options

            this.initElements();
            this.initEvents();
            this.checkAuth(); // Effectue la vérification d'authentification au démarrage
        }

        initElements() {
            // Éléments d'authentification
            this.authScreen = document.getElementById('auth-screen');
            this.journalApp = document.getElementById('journal-app');
            this.usernameInput = document.getElementById('username-input');
            this.pinInput = document.getElementById('pin-input');
            this.unlockButton = document.getElementById('unlock-button');
            this.authMessage = document.getElementById('auth-message');
            this.errorMessage = document.getElementById('error-message');
            this.currentUserDisplay = document.getElementById('current-user');
            this.logoutButton = document.getElementById('logout-button');
            this.languageSelect = document.getElementById('language-select');
            this.languageSelect.value = this.currentLanguage; // Définit la langue sélectionnée

            // Éléments du chat
            this.chatMessages = document.getElementById('chat-messages');
            this.journalInput = document.getElementById('journal-input');
            this.sendButton = document.getElementById('send-button');
            this.microphoneButton = document.getElementById('microphone-button');

            // Nouveaux éléments pour les options interactives
            this.janeOptionsContainer = document.getElementById('jane-options-container');

            // Nouveaux éléments pour le carnet secret détaillé
            this.secretJournalView = document.getElementById('secret-journal-view');
            this.secretPinInput = document.getElementById('secret-pin-input');
            this.verifySecretPinButton = document.getElementById('verify-secret-pin-button');
            this.secretPinError = document.getElementById('secret-pin-error');
            this.secretJournalContent = document.getElementById('secret-journal-content');
            this.journalDatesList = document.getElementById('journal-dates-list');
            this.journalSelectedDayContent = document.getElementById('journal-selected-day-content');
            this.closeSecretJournalButton = document.getElementById('close-secret-journal');

            this.setupRecognition();
            this.updateAuthScreenText(this.currentLanguage); // Met à jour le texte de l'écran d'authentification à l'initialisation
            this.updateJournalText(this.currentLanguage); // Met à jour les placeholders du journal
        }

        initEvents() {
            // Authentification
            this.unlockButton.addEventListener('click', () => this.handleLogin());
            this.logoutButton.addEventListener('click', () => this.handleLogout());
            this.pinInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleLogin();
            });

            // Chat
            this.sendButton.addEventListener('click', () => this.handleSendMessage());
            this.journalInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
            this.journalInput.addEventListener('input', this.adjustTextareaHeight.bind(this));

            // Langue
            this.languageSelect.addEventListener('change', (e) => {
                this.changeLanguage(e.target.value);
            });

            // Événements pour le carnet secret détaillé
            this.verifySecretPinButton.addEventListener('click', () => this.verifySecretJournalPin());
            this.secretPinInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.verifySecretJournalPin();
            });
            this.closeSecretJournalButton.addEventListener('click', () => this.closeSecretJournal());
        }

        setupRecognition() {
            if ('webkitSpeechRecognition' in window) {
                this.recognition = new webkitSpeechRecognition();
                this.recognition.continuous = false;
                this.recognition.interimResults = false;
                this.recognition.lang = this.currentLanguage === 'fr' ? 'fr-FR' : 'en-US';

                this.recognition.onstart = () => {
                    this.microphoneButton.classList.add('recording');
                    this.journalInput.placeholder = this.janeResponses[this.currentLanguage].recognition.listening;
                    this.microphoneButton.disabled = true;
                    this.sendButton.disabled = true;
                    this.journalInput.disabled = true;
                };

                this.recognition.onresult = (e) => {
                    const transcript = e.results[0][0].transcript;
                    this.journalInput.value = transcript;
                    this.handleSendMessage(); // Envoie le message automatiquement après la reconnaissance
                };

                this.recognition.onerror = (event) => {
                    console.error('Speech recognition error', event);
                    this.journalInput.placeholder = this.janeResponses[this.currentLanguage].recognition.error;
                };

                this.recognition.onend = () => {
                    this.microphoneButton.classList.remove('recording');
                    this.journalInput.placeholder = this.janeResponses[this.currentLanguage].recognition.defaultPlaceholder;
                    this.microphoneButton.disabled = false;
                    this.sendButton.disabled = false;
                    this.journalInput.disabled = false;
                };

                this.microphoneButton.addEventListener('click', () => {
                    if (this.microphoneButton.classList.contains('recording')) {
                        this.recognition.stop();
                    } else {
                        this.recognition.lang = this.currentLanguage === 'fr' ? 'fr-FR' : 'en-US'; // Met à jour la langue de reconnaissance
                        this.recognition.start();
                    }
                });
            } else {
                console.warn('Speech recognition not supported in this browser.');
                this.microphoneButton.style.display = 'none';
            }
        }

        checkAuth() {
            const savedUser = localStorage.getItem('jane_current_user');
            if (savedUser) {
                try {
                    const userData = JSON.parse(savedUser);
                    this.currentUser = userData.username;
                    this.showJournal();
                    this.loadConversationHistory(); // Charge l'historique complet de l'utilisateur

                    const lastLoginDate = userData.lastLogin ? new Date(userData.lastLogin) : null;
                    const now = new Date();
                    const oneHour = 60 * 60 * 1000;

                    let welcomeMessage = '';
                    if (lastLoginDate && (now.getTime() - lastLoginDate.getTime() < oneHour)) {
                        welcomeMessage = this.janeResponses[this.currentLanguage].welcome.returningGreetingShort.replace('%USERNAME%', this.currentUser);
                    } else {
                        welcomeMessage = this.janeResponses[this.currentLanguage].welcome.returningGreetingLong.replace('%USERNAME%', this.currentUser);
                    }
                    this.addMessage(welcomeMessage, 'jane');
                    this.showMainOptions(); // Affiche les options principales après le message de bienvenue

                    localStorage.setItem('jane_current_user', JSON.stringify({
                        username: this.currentUser,
                        lastLogin: now.toISOString()
                    }));

                } catch (e) {
                    console.error("Erreur de chargement des données utilisateur:", e);
                    localStorage.removeItem('jane_current_user');
                    this.showError(this.janeResponses[this.currentLanguage].auth.corruptedData);
                    this.authScreen.classList.remove('hidden');
                    this.journalApp.classList.add('hidden');
                }
            } else {
                this.authScreen.classList.remove('hidden');
                this.journalApp.classList.add('hidden');
            }
        }

        handleLogin() {
            const username = this.usernameInput.value.trim();
            const pin = this.pinInput.value.trim();

            if (!username || !pin) {
                this.showError(this.janeResponses[this.currentLanguage].auth.emptyFields);
                return;
            }

            if (pin.length !== 4 || !/^\d+$/.test(pin)) {
                this.showError(this.janeResponses[this.currentLanguage].auth.pinFormat);
                return;
            }

            const users = this.getUsers();
            const userExists = users.hasOwnProperty(username);
            let welcomeMessage = '';

            if (!userExists) {
                users[username] = {
                    pin: this.encryptData(pin, username),
                    createdAt: new Date().toISOString(),
                    journal: [],
                    lastLogin: new Date().toISOString()
                };
                this.saveUsers(users);
                welcomeMessage = this.getWelcomeMessage(username, true);
            } else {
                if (!this.verifyPin(pin, users[username].pin, username)) {
                    this.showError(this.janeResponses[this.currentLanguage].auth.incorrectPin);
                    return;
                }
                welcomeMessage = this.getWelcomeMessage(username, false);
                users[username].lastLogin = new Date().toISOString();
                this.saveUsers(users);
            }

            this.currentUser = username;
            localStorage.setItem('jane_current_user', JSON.stringify({
                username: username,
                lastLogin: new Date().toISOString()
            }));

            this.showJournal();
            this.loadConversationHistory();
            this.addMessage(welcomeMessage, 'jane');
            this.showMainOptions(); // Affiche les options principales après le message de bienvenue
            this.pinInput.value = '';
        }

        handleLogout() {
            localStorage.removeItem('jane_current_user');
            this.currentUser = null;
            this.conversationHistory = [];
            this.usernameInput.value = '';
            this.pinInput.value = '';
            this.journalApp.classList.add('hidden');
            this.authScreen.classList.remove('hidden');
            this.chatMessages.innerHTML = '';
            this.janeOptionsContainer.innerHTML = ''; // Vide les options
            this.janeOptionsContainer.classList.add('hidden'); // Cache les options
            this.updateAuthScreenText(this.currentLanguage);
        }

        async handleSendMessage() {
            const message = this.journalInput.value.trim();
            if (!message || !this.currentUser) return;

            // Masque les options quand l'utilisateur écrit
            this.janeOptionsContainer.classList.add('hidden');
            this.janeOptionsContainer.innerHTML = ''; // Vide pour qu'elles ne réapparaissent pas instantanément

            this.addMessage(message, 'user');
            this.journalInput.value = '';
            this.adjustTextareaHeight();

            this.conversationHistory.push({ sender: 'user', message: message, timestamp: new Date().toISOString() });
            this.saveAllUserData();

            // Si une option est active, gérer la réponse via cette option
            if (this.currentOptionActive) {
                await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));
                this.handleOptionResponse(message);
            } else {
                // Sinon, générer une réponse libre
                const thinkingMsg = this.showThinking();
                await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
                thinkingMsg.remove();
                const response = this.generateResponse(message);
                this.addMessage(response, 'jane');
                this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
                this.saveAllUserData();
                this.lastJaneResponse = response; // Met à jour la dernière réponse de Jane
            }
        }

        showThinking() {
            const thinkingDiv = document.createElement('div');
            thinkingDiv.className = 'message thinking jane-message';
            thinkingDiv.innerHTML = `
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
            `;
            this.chatMessages.appendChild(thinkingDiv);
            this.scrollToBottom();
            return thinkingDiv;
        }

        addMessage(content, sender) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${sender}-message`;
            messageDiv.innerHTML = `
                <p>${content}</p>
                <span class="message-time">${this.getCurrentTime()}</span>
            `;
            this.chatMessages.appendChild(messageDiv);
            this.scrollToBottom();
        }

        // --- NOUVEAU : GESTION DES OPTIONS INTERACTIVES ---
        showMainOptions() {
            this.janeOptionsContainer.innerHTML = '';
            this.janeOptionsContainer.classList.remove('hidden');

            const options = [
                { text: this.janeResponses[this.currentLanguage].options.sadness, id: 'sadness' },
                { text: this.janeResponses[this.currentLanguage].options.loveFemale, id: 'love_female' },
                { text: this.janeResponses[this.currentLanguage].options.loveMale, id: 'love_male' },
                { text: this.janeResponses[this.currentLanguage].options.secretJournal, id: 'secret_journal' },
                { text: this.janeResponses[this.currentLanguage].options.goalsProgress, id: 'goals_progress' },
                { text: this.janeResponses[this.currentLanguage].options.entertainment, id: 'entertainment' }
            ];

            options.forEach(option => {
                const button = document.createElement('button');
                button.className = 'option-button';
                button.textContent = option.text;
                button.addEventListener('click', () => this.selectOption(option.id));
                this.janeOptionsContainer.appendChild(button);
            });
            this.scrollToBottom();
        }

        selectOption(optionId) {
            this.currentOptionActive = optionId;
            this.optionStep = 0; // Réinitialise l'étape pour le nouveau dialogue
            this.janeOptionsContainer.classList.add('hidden');
            this.janeOptionsContainer.innerHTML = ''; // Vide les options après sélection

            // Logique pour lancer le dialogue spécifique à l'option
            switch (optionId) {
                case 'sadness':
                    this.handleSadnessOption();
                    break;
                case 'love_female':
                    this.handleLoveAdvice('female');
                    break;
                case 'love_male':
                    this.handleLoveAdvice('male');
                    break;
                case 'secret_journal':
                    this.openSecretJournal();
                    break;
                case 'goals_progress':
                    this.handleGoalsProgressOption();
                    break;
                case 'entertainment':
                    this.handleEntertainmentOption();
                    break;
                default:
                    this.addMessage(this.janeResponses[this.currentLanguage].general[0], 'jane');
                    this.currentOptionActive = null;
                    break;
            }
        }

        // Gère les réponses de Jane dans le cadre d'un dialogue d'option
        handleOptionResponse(userMessage) {
            const langResponses = this.janeResponses[this.currentLanguage];
            let response = '';
            let showOptionsAgain = false;

            switch (this.currentOptionActive) {
                case 'sadness':
                    response = this.handleSadnessDialogue(userMessage);
                    break;
                case 'love_female':
                case 'love_male':
                    response = this.handleLoveAdviceDialogue(userMessage, this.currentOptionActive === 'love_female' ? 'female' : 'male');
                    break;
                case 'goals_progress':
                    response = this.handleGoalsProgressDialogue(userMessage);
                    break;
                case 'entertainment':
                    response = this.handleEntertainmentDialogue(userMessage);
                    break;
                // Le carnet secret est géré par une interface dédiée, pas par la conversation
                default:
                    response = this.generateResponse(userMessage); // Revert to general if somehow in an unhandled state
                    showOptionsAgain = true; // Propose les options si hors d'un flux spécifique
                    break;
            }
            this.addMessage(response, 'jane');
            this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
            this.saveAllUserData();

            // Si le dialogue est terminé ou si Jane n'a pas compris
            if (response.includes(langResponses.dialogueEndPhrase) || response.includes(langResponses.options.unrecognizedInput)) {
                this.currentOptionActive = null;
                this.optionStep = 0;
                this.showMainOptions(); // Propose à nouveau les options principales
            } else if (showOptionsAgain) {
                this.showMainOptions();
            }
        }


        // --- LOGIQUE POUR CHAQUE OPTION ---

        // Option 1: Je me sens triste
        handleSadnessOption() {
            this.addMessage(this.janeResponses[this.currentLanguage].sadness.intro, 'jane');
            this.optionStep = 1; // Passe à l'étape suivante du dialogue
            this.showSadnessOptions();
        }

        showSadnessOptions() {
            this.janeOptionsContainer.innerHTML = '';
            this.janeOptionsContainer.classList.remove('hidden');
            const langResponses = this.janeResponses[this.currentLanguage].sadness;
            const options = [
                { text: langResponses.optionsList.story, id: 'sad_story' },
                { text: langResponses.optionsList.quote, id: 'sad_quote' },
                { text: langResponses.optionsList.exercise, id: 'sad_exercise' },
                { text: langResponses.optionsList.talkMore, id: 'sad_talk_more' },
                { text: langResponses.optionsList.backToMain, id: 'main_options' }
            ];
            options.forEach(option => {
                const button = document.createElement('button');
                button.className = 'option-button secondary';
                button.textContent = option.text;
                button.addEventListener('click', () => {
                    if (option.id === 'main_options') {
                        this.currentOptionActive = null;
                        this.optionStep = 0;
                        this.showMainOptions();
                    } else {
                        this.handleSadnessDialogue(option.id); // Passe l'ID de l'option cliquée
                    }
                });
                this.janeOptionsContainer.appendChild(button);
            });
            this.scrollToBottom();
        }

        handleSadnessDialogue(userChoice) {
            const langResponses = this.janeResponses[this.currentLanguage].sadness;
            let response = '';

            // Si l'utilisateur a cliqué sur un bouton d'option
            if (userChoice.startsWith('sad_')) {
                switch (userChoice) {
                    case 'sad_story':
                        response = langResponses.story;
                        break;
                    case 'sad_quote':
                        response = langResponses.quotes[Math.floor(Math.random() * langResponses.quotes.length)];
                        break;
                    case 'sad_exercise':
                        response = langResponses.exercise;
                        break;
                    case 'sad_talk_more':
                        response = langResponses.talkMore;
                        break;
                    default:
                        response = langResponses.unrecognizedInput;
                        break;
                }
                this.addMessage(response, 'jane');
                this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
                this.saveAllUserData();
                if (userChoice !== 'sad_talk_more') {
                     // Après une réponse spécifique (sauf "parler plus"), reproposer les options
                    setTimeout(() => { this.showSadnessOptions(); }, 1500);
                } else {
                    this.janeOptionsContainer.classList.add('hidden'); // Cache les options si l'utilisateur veut parler librement
                }
                return; // On a géré via les boutons, on sort
            }

            // Si l'utilisateur a tapé une réponse dans le champ libre (non utilisé dans ce flux guidé, mais en sécurité)
            // Pour l'instant, Jane renverra à l'intro si la conversation libre est tentée
            response = langResponses.intro;
            this.janeOptionsContainer.classList.add('hidden');
            this.currentOptionActive = null;
            this.optionStep = 0;
            this.showMainOptions(); // Revient aux options principales
            return response;
        }

        // Option 2 & 3: Relations Amoureuses (Homme/Femme)
        handleLoveAdvice(gender) {
            const langResponses = this.janeResponses[this.currentLanguage].loveAdvice;
            const introMsg = gender === 'female' ? langResponses.introFemale : langResponses.introMale;
            this.addMessage(introMsg, 'jane');
            this.optionStep = 1;
            this.showLoveAdviceOptions(gender);
        }

        showLoveAdviceOptions(gender) {
            this.janeOptionsContainer.innerHTML = '';
            this.janeOptionsContainer.classList.remove('hidden');
            const langResponses = this.janeResponses[this.currentLanguage].loveAdvice;
            const topics = gender === 'female' ? langResponses.topicsFemale : langResponses.topicsMale;

            Object.entries(topics).forEach(([key, value]) => {
                const button = document.createElement('button');
                button.className = 'option-button secondary';
                button.textContent = value.title;
                button.addEventListener('click', () => this.handleLoveAdviceDialogue(key, gender));
                this.janeOptionsContainer.appendChild(button);
            });

            const backButton = document.createElement('button');
            backButton.className = 'option-button secondary';
            backButton.textContent = langResponses.optionsList.backToMain;
            backButton.addEventListener('click', () => {
                this.currentOptionActive = null;
                this.optionStep = 0;
                this.showMainOptions();
            });
            this.janeOptionsContainer.appendChild(backButton);
            this.scrollToBottom();
        }

        handleLoveAdviceDialogue(topicId, gender) {
            const langResponses = this.janeResponses[this.currentLanguage].loveAdvice;
            const topics = gender === 'female' ? langResponses.topicsFemale : langResponses.topicsMale;
            let response = '';

            if (topics[topicId]) {
                response = topics[topicId].content;
            } else {
                response = langResponses.unrecognizedInput;
            }

            this.addMessage(response, 'jane');
            this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
            this.saveAllUserData();
            this.janeOptionsContainer.classList.add('hidden'); // Cache les options après avoir donné le conseil

            setTimeout(() => { this.showLoveAdviceOptions(gender); }, 2000); // Repropose les options de relations
        }

        // Option 4: Accès au carnet secret
        openSecretJournal() {
            this.chatMessages.classList.add('hidden'); // Cache le chat normal
            this.janeOptionsContainer.classList.add('hidden'); // Cache les options
            this.secretJournalView.classList.remove('hidden');
            this.secretPinInput.value = '';
            this.secretPinError.textContent = '';
            this.secretJournalContent.classList.add('hidden');
            this.secretPinInput.focus();
            this.scrollToBottom(); // Pour s'assurer que la vue est en bas de l'écran si nécessaire
        }

        closeSecretJournal() {
            this.secretJournalView.classList.add('hidden');
            this.chatMessages.classList.remove('hidden'); // Affiche le chat normal
            this.showMainOptions(); // Réaffiche les options principales
            this.scrollToBottom();
        }

        verifySecretJournalPin() {
            const pin = this.secretPinInput.value.trim();
            const users = this.getUsers();
            const user = users[this.currentUser];

            if (pin.length !== 4 || !/^\d+$/.test(pin)) {
                this.secretPinError.textContent = this.janeResponses[this.currentLanguage].auth.pinFormat;
                return;
            }

            if (user && this.verifyPin(pin, user.pin, this.currentUser)) {
                this.secretPinError.textContent = '';
                this.secretJournalContent.classList.remove('hidden');
                this.displayJournalEntriesByDate();
            } else {
                this.secretPinError.textContent = this.janeResponses[this.currentLanguage].auth.incorrectPinSecret;
            }
        }

        displayJournalEntriesByDate() {
            this.journalDatesList.innerHTML = '';
            this.journalSelectedDayContent.innerHTML = '';
            const users = this.getUsers();
            const userJournal = users[this.currentUser]?.journal || [];

            const entriesByDate = {};
            userJournal.forEach(entry => {
                const date = new Date(entry.timestamp).toLocaleDateString(this.currentLanguage === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                if (!entriesByDate[date]) {
                    entriesByDate[date] = [];
                }
                entriesByDate[date].push(entry);
            });

            // Afficher les dates triées du plus récent au plus ancien
            const sortedDates = Object.keys(entriesByDate).sort((a, b) => new Date(b) - new Date(a));

            sortedDates.forEach(date => {
                const dateItem = document.createElement('div');
                dateItem.className = 'journal-date-item';
                dateItem.textContent = date;
                dateItem.addEventListener('click', () => {
                    // Supprime la classe 'active' de tous les items
                    document.querySelectorAll('.journal-date-item').forEach(item => item.classList.remove('active'));
                    // Ajoute la classe 'active' à l'item cliqué
                    dateItem.classList.add('active');
                    this.showDayContent(entriesByDate[date]);
                });
                this.journalDatesList.appendChild(dateItem);
            });

            // Afficher le contenu du jour le plus récent par défaut
            if (sortedDates.length > 0) {
                this.journalDatesList.querySelector('.journal-date-item').classList.add('active');
                this.showDayContent(entriesByDate[sortedDates[0]]);
            } else {
                this.journalSelectedDayContent.innerHTML = `<p>${this.janeResponses[this.currentLanguage].secretJournal.noEntries}</p>`;
            }
        }

        showDayContent(entries) {
            this.journalSelectedDayContent.innerHTML = '';
            entries.forEach(entry => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${entry.sender}-message`;
                messageDiv.innerHTML = `
                    <p>${entry.message}</p>
                    <span class="message-time">${new Date(entry.timestamp).toLocaleTimeString(this.currentLanguage === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                `;
                this.journalSelectedDayContent.appendChild(messageDiv);
            });
            this.journalSelectedDayContent.scrollTop = this.journalSelectedDayContent.scrollHeight; // Scroll to bottom
        }

        // Option 5: Mes Objectifs et Progrès
        handleGoalsProgressOption() {
            this.addMessage(this.janeResponses[this.currentLanguage].goalsProgress.intro, 'jane');
            this.optionStep = 1;
            this.showGoalsProgressOptions();
        }

        showGoalsProgressOptions() {
            this.janeOptionsContainer.innerHTML = '';
            this.janeOptionsContainer.classList.remove('hidden');
            const langResponses = this.janeResponses[this.currentLanguage].goalsProgress;
            const options = [
                { text: langResponses.optionsList.addGoal, id: 'goals_add' },
                { text: langResponses.optionsList.viewGoals, id: 'goals_view' },
                { text: langResponses.optionsList.trackProgress, id: 'goals_track' },
                { text: langResponses.optionsList.backToMain, id: 'main_options' }
            ];
            options.forEach(option => {
                const button = document.createElement('button');
                button.className = 'option-button accent';
                button.textContent = option.text;
                button.addEventListener('click', () => {
                    if (option.id === 'main_options') {
                        this.currentOptionActive = null;
                        this.optionStep = 0;
                        this.showMainOptions();
                    } else {
                        this.handleGoalsProgressDialogue(option.id);
                    }
                });
                this.janeOptionsContainer.appendChild(button);
            });
            this.scrollToBottom();
        }

        handleGoalsProgressDialogue(actionId) {
            const langResponses = this.janeResponses[this.currentLanguage].goalsProgress;
            let response = '';

            switch (actionId) {
                case 'goals_add':
                    response = langResponses.addGoalPrompt;
                    this.currentOptionActive = 'goals_add_dialogue'; // Passe à un sous-état de dialogue pour la saisie
                    this.janeOptionsContainer.classList.add('hidden'); // Cache les options pour la saisie libre
                    break;
                case 'goals_view':
                    const userGoals = this.getUserSpecificData('goals') || [];
                    if (userGoals.length > 0) {
                        response = langResponses.viewGoalsIntro + userGoals.map((goal, index) => `${index + 1}. ${goal.name} (${new Date(goal.dateAdded).toLocaleDateString()}) - ${goal.status}`).join('\n');
                    } else {
                        response = langResponses.noGoals;
                    }
                    this.janeOptionsContainer.classList.add('hidden');
                    this.addMessage(response, 'jane');
                    this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
                    this.saveAllUserData();
                    setTimeout(() => { this.showGoalsProgressOptions(); }, 2000); // Repropose les options de objectifs
                    break;
                case 'goals_track':
                    const trackableGoals = this.getUserSpecificData('goals') || [];
                    if (trackableGoals.length > 0) {
                        response = langResponses.trackProgressPrompt + trackableGoals.map((goal, index) => `${index + 1}. ${goal.name}`).join('\n');
                        this.currentOptionActive = 'goals_track_dialogue'; // Passe à un sous-état pour la saisie
                        this.janeOptionsContainer.classList.add('hidden');
                    } else {
                        response = langResponses.noGoalsToTrack;
                        this.janeOptionsContainer.classList.add('hidden');
                        this.addMessage(response, 'jane');
                        this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
                        this.saveAllUserData();
                        setTimeout(() => { this.showGoalsProgressOptions(); }, 2000); // Repropose les options
                    }
                    break;
                default:
                    response = langResponses.unrecognizedInput;
                    this.janeOptionsContainer.classList.add('hidden');
                    this.addMessage(response, 'jane');
                    this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
                    this.saveAllUserData();
                    setTimeout(() => { this.showGoalsProgressOptions(); }, 1500); // Repropose les options
                    break;
            }
            if (actionId !== 'goals_add' && actionId !== 'goals_track' && actionId !== 'goals_view') {
                this.addMessage(response, 'jane');
                this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
                this.saveAllUserData();
                setTimeout(() => { this.showGoalsProgressOptions(); }, 1500);
            }
        }

        // Gère la saisie de l'utilisateur après avoir choisi une action d'objectif
        handleGoalsProgressDialogueResponse(userMessage) {
            const langResponses = this.janeResponses[this.currentLanguage].goalsProgress;
            let response = '';
            let endDialogue = false;

            if (this.currentOptionActive === 'goals_add_dialogue') {
                const users = this.getUsers();
                const userGoals = users[this.currentUser].goals || [];
                userGoals.push({ name: userMessage, dateAdded: new Date().toISOString(), status: 'En cours' });
                users[this.currentUser].goals = userGoals;
                this.saveUsers(users);
                response = langResponses.goalAdded.replace('%GOAL%', userMessage);
                endDialogue = true;
            } else if (this.currentOptionActive === 'goals_track_dialogue') {
                const users = this.getUsers();
                const userGoals = users[this.currentUser].goals || [];
                const goalIndex = parseInt(userMessage) - 1;
                if (!isNaN(goalIndex) && goalIndex >= 0 && goalIndex < userGoals.length) {
                    userGoals[goalIndex].status = 'Terminé !'; // Simplification, pourrait être plus complexe
                    users[this.currentUser].goals = userGoals;
                    this.saveUsers(users);
                    response = langResponses.goalTracked.replace('%GOAL%', userGoals[goalIndex].name);
                } else {
                    response = langResponses.invalidGoalIndex;
                }
                endDialogue = true;
            } else {
                response = langResponses.unrecognizedInput;
                endDialogue = true;
            }

            this.addMessage(response, 'jane');
            this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
            this.saveAllUserData();

            if (endDialogue) {
                this.currentOptionActive = null;
                this.optionStep = 0;
                setTimeout(() => { this.showGoalsProgressOptions(); }, 1500); // Repropose les options d'objectifs
            }
        }

        // Option 6: Recommandations Films/Mangas/Animes 2025
        handleEntertainmentOption() {
            this.addMessage(this.janeResponses[this.currentLanguage].entertainment.intro, 'jane');
            this.optionStep = 1;
            this.showEntertainmentOptions();
        }

        showEntertainmentOptions() {
            this.janeOptionsContainer.innerHTML = '';
            this.janeOptionsContainer.classList.remove('hidden');
            const langResponses = this.janeResponses[this.currentLanguage].entertainment;
            const options = [
                { text: langResponses.optionsList.films, id: 'entertainment_films' },
                { text: langResponses.optionsList.mangas, id: 'entertainment_mangas' },
                { text: langResponses.optionsList.animes, id: 'entertainment_animes' },
                { text: langResponses.optionsList.backToMain, id: 'main_options' }
            ];
            options.forEach(option => {
                const button = document.createElement('button');
                button.className = 'option-button accent';
                button.textContent = option.text;
                button.addEventListener('click', () => {
                    if (option.id === 'main_options') {
                        this.currentOptionActive = null;
                        this.optionStep = 0;
                        this.showMainOptions();
                    } else {
                        this.handleEntertainmentDialogue(option.id);
                    }
                });
                this.janeOptionsContainer.appendChild(button);
            });
            this.scrollToBottom();
        }

        handleEntertainmentDialogue(categoryId) {
            const langResponses = this.janeResponses[this.currentLanguage].entertainment;
            let response = '';
            let items = [];

            switch (categoryId) {
                case 'entertainment_films':
                    items = langResponses.films2025;
                    response = langResponses.filmsIntro;
                    break;
                case 'entertainment_mangas':
                    items = langResponses.mangas2025;
                    response = langResponses.mangasIntro;
                    break;
                case 'entertainment_animes':
                    items = langResponses.animes2025;
                    response = langResponses.animesIntro;
                    break;
                default:
                    response = langResponses.unrecognizedInput;
                    break;
            }

            if (items.length > 0) {
                response += '<br><br>' + items.map(item => `<strong>${item.title}</strong> (${item.year}) - Plateforme(s) : ${item.platforms.join(', ')}`).join('<br>');
            } else if (categoryId !== 'main_options') {
                response = langResponses.noRecommendations;
            }
            
            this.addMessage(response, 'jane');
            this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
            this.saveAllUserData();

            this.janeOptionsContainer.classList.add('hidden'); // Cache les options après avoir donné la liste
            setTimeout(() => { this.showEntertainmentOptions(); }, 3000); // Repropose les options de divertissement
        }


        // --- CORE INTELLIGENCE DE JANE (conversation libre) ---
        generateResponse(userMessage) {
            const originalUserMessage = userMessage;
            userMessage = userMessage.toLowerCase();
            const langResponses = this.janeResponses[this.currentLanguage];

            // Annule tout dialogue d'option si l'utilisateur entre une phrase libre
            this.currentOptionActive = null;
            this.optionStep = 0;
            this.janeOptionsContainer.classList.add('hidden');

            const context = this.analyzeConversationContext(this.conversationHistory);

            // 1. Détection des sujets interdits (Priorité absolue)
            if (this.isIllegalOrPolitical(userMessage)) {
                const forbiddenResponse = langResponses.forbidden.general;
                this.lastJaneResponse = forbiddenResponse;
                return forbiddenResponse;
            }
            if (this.isMathQuery(userMessage)) {
                const mathResponse = langResponses.forbidden.math;
                this.lastJaneResponse = mathResponse;
                return mathResponse;
            }

            // 2. Commandes et Questions Directes (Haute Priorité)
            const directResponses = {
                "heure": langResponses.time, "time": langResponses.time,
                "date": langResponses.date, "aujourd'hui": langResponses.date, "today": langResponses.date,
                "qui es-tu": langResponses.creator, "ton créateur": langResponses.creator, "who are you": langResponses.creator,
                "creator": langResponses.creator, "ton nom": langResponses.creator,
                "blague": langResponses.jokes[Math.floor(Math.random() * langResponses.jokes.length)],
                "joke": langResponses.jokes[Math.floor(Math.random() * langResponses.jokes.length)],
                "merci": langResponses.compliments[Math.floor(Math.random() * langResponses.compliments.length)],
                "thank you": langResponses.compliments[Math.floor(Math.random() * langResponses.compliments.length)],
                "comment tu vas": langResponses.howAreYou, "how are you": langResponses.howAreYou,
                "menu principal": langResponses.backToMainMenu // Nouvelle commande pour revenir au menu
            };

            for (const keyword in directResponses) {
                if (userMessage.includes(keyword)) {
                    if (keyword === "menu principal" || keyword === "back to main menu") {
                        this.showMainOptions();
                        return langResponses.backToMainMenu; // Message de confirmation
                    }
                    const response = directResponses[keyword];
                    if (response !== this.lastJaneResponse) { // Évite la répétition immédiate
                        this.lastJaneResponse = response;
                        return response;
                    }
                }
            }

            // 3. Réponse à un secret ou un problème grave
            if (userMessage.includes("secret") || userMessage.includes("confie") || userMessage.includes("problem") || userMessage.includes("confide")) {
                const secretResponse = langResponses.secrets[Math.floor(Math.random() * langResponses.secrets.length)];
                this.lastJaneResponse = secretResponse;
                return secretResponse;
            }

            // 4. Détection d'Émotions avec options (Priorité moyenne-haute)
            let emotionalResponse = this.getEmotionalResponse(userMessage, context.userEmotion);
            if (emotionalResponse) {
                if (emotionalResponse !== this.lastJaneResponse) {
                    if (context.userEmotion === 'negative' && Math.random() < 0.7) {
                        const options = langResponses.optionsForProblem;
                        const randomOption = options[Math.floor(Math.random() * options.length)];
                        const finalResponse = `${emotionalResponse} ${randomOption}`;
                        this.lastJaneResponse = finalResponse;
                        return finalResponse;
                    }
                    this.lastJaneResponse = emotionalResponse;
                    return emotionalResponse;
                }
            }

            // 5. Utilisation de la Mémoire / Rappels (recherche dans tout l'historique)
            const rememberedContent = this.recallMemory(userMessage);
            if (rememberedContent) {
                if (rememberedContent !== this.lastJaneResponse) {
                    this.lastJaneResponse = rememberedContent;
                    return rememberedContent;
                }
            }

            // 6. Contexte de "Ami / Confident" basé sur les topics récents et l'historique
            if (context.mainTopic) {
                if (langResponses.friendAdvice[context.mainTopic]) {
                    const adviceResponse = langResponses.friendAdvice[context.mainTopic];
                    if (adviceResponse !== this.lastJaneResponse) {
                        this.lastJaneResponse = adviceResponse;
                        return adviceResponse;
                    }
                }
                if (Math.random() < 0.4 && this.conversationHistory.length > 5) {
                    const promptResponse = langResponses.contextualPrompts.continueSharing;
                    if (promptResponse !== this.lastJaneResponse) {
                        this.lastJaneResponse = promptResponse;
                        return promptResponse;
                    }
                }
            }

            // 7. Réponses Générales ou Encouragements (Dernier recours)
            // Sélectionne une réponse qui n'est pas la même que la dernière
            let generalResponsePool = langResponses.general.filter(res => res !== this.lastJaneResponse);
            if (generalResponsePool.length === 0) {
                generalResponsePool = langResponses.general; // Si toutes les réponses ont été utilisées, réinitialiser
            }
            const finalGeneralResponse = generalResponsePool[Math.floor(Math.random() * generalResponsePool.length)];
            this.lastJaneResponse = finalGeneralResponse;
            return finalGeneralResponse;
        }

        // --- Fonctions d'Intelligence et de Mémoire ---

        analyzeConversationContext(history) {
            const lastMessages = history.slice(-20);
            let topics = {};
            let emotionScore = 0;
            let questionCount = 0;

            lastMessages.forEach(msg => {
                const text = msg.message.toLowerCase();
                const words = text.split(/\s+/).filter(w => w.length > 2);

                words.forEach(word => {
                    topics[word] = (topics[word] || 0) + 1;
                });

                if (/(triste|malheureux|déprimé|seul|anxieux|stressé|échec|problème|pas bien|dur|difficile|sad|unhappy|depressed|lonely|anxious|stressed|failure|problem|not good|hard|difficult)/.test(text)) emotionScore--;
                if (/(heureux|content|joyeux|génial|super|réussite|succès|bien|incroyable|happy|content|joyful|great|super|success|good|incredible)/.test(text)) emotionScore++;
                
                if (text.endsWith('?')) questionCount++;
            });

            const sortedTopics = Object.entries(topics).sort(([, countA], [, countB]) => countB - countA);
            const mainTopic = sortedTopics.length > 0 ? sortedTopics[0][0] : null;

            return {
                mainTopic: mainTopic,
                userEmotion: emotionScore > 0 ? 'positive' : emotionScore < 0 ? 'negative' : 'neutral',
                isQuestioning: questionCount > (lastMessages.length / 4)
            };
        }

        getEmotionalResponse(message, currentEmotion) {
            const langResponses = this.janeResponses[this.currentLanguage];
            if (/(heureux|content|joyeux|super|bien|génial|réussite|succès|incroyable|happy|content|joyful|great|super|success|incredible)/.test(message) || currentEmotion === 'positive') return langResponses.feelings.happy;
            if (/(triste|déprimé|mal|pas bien|seul|vide|déchiré|découragé|peine|chagrin|sad|depressed|bad|not good|lonely|empty|heartbroken|discouraged|sorrow|grief)/.test(message) || currentEmotion === 'negative') return langResponses.feelings.sad;
            if (/(énervé|colère|fâché|rage|agacé|frustré|annoyed|angry|furious|rage|irked|frustrated)/.test(message)) return langResponses.feelings.angry;
            if (/(anxieux|stressé|peur|inquiét|angoissé|anxious|stressed|fear|worried|distressed)/.test(message)) return langResponses.feelings.anxious;
            if (/(fatigué|épuisé|crevé|exténué|tired|exhausted|worn out)/.test(message)) return langResponses.feelings.tired;
            return null;
        }

        rememberImportantInfo(type, content) {
            console.log(`Jane a noté une information importante de type '${type}': "${content}"`);
        }

        recallMemory(userMessage) {
            const userMessageLower = userMessage.toLowerCase();
            const langResponses = this.janeResponses[this.currentLanguage].memories;

            // Parcours l'historique de l'utilisateur de manière inversée (les messages les plus récents d'abord)
            for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
                const entry = this.conversationHistory[i];
                if (entry.sender === 'user' && entry.message) {
                    const storedMessageLower = entry.message.toLowerCase();

                    if ((userMessageLower.includes("mon secret") || userMessageLower.includes("my secret")) && storedMessageLower.includes("mon secret est que")) {
                        const secretMatch = storedMessageLower.match(/mon secret est que (.+)/);
                        if (secretMatch && secretMatch[1]) {
                            return langResponses.recallSecret.replace('%SECRET%', secretMatch[1]);
                        }
                        return langResponses.generalSecretRecall;
                    }
                    if ((userMessageLower.includes("tu te souviens de") || userMessageLower.includes("do you remember")) && storedMessageLower.includes(userMessageLower.replace(/tu te souviens de |do you remember /g, ""))) {
                        return langResponses.generalRecall;
                    }
                    if ((userMessageLower.includes("on a déjà parlé de") || userMessageLower.includes("we talked about")) && storedMessageLower.includes(userMessageLower.replace(/on a déjà parlé de |we talked about /g, ""))) {
                        return langResponses.generalRecall;
                    }
                }
            }
            return null;
        }
        
        isIllegalOrPolitical(message) {
            const forbiddenKeywords = this.janeResponses[this.currentLanguage].forbidden.keywords;
            return forbiddenKeywords.some(keyword => message.includes(keyword));
        }

        isMathQuery(message) {
            return /\b\d+(\.\d+)?\s*[\+\-\*\/%]\s*\d+(\.\d+)?\b/.test(message);
        }

        // --- Fonctions utilitaires ---
        getWelcomeMessage(username, isNewUser) {
            const lang = this.currentLanguage;
            if (isNewUser) {
                const userSpecificGreeting = username.toLowerCase() === 'richelieubonte' ? 
                    this.janeResponses[lang].welcome.creatorGreeting : 
                    this.janeResponses[lang].welcome.regularGreeting;
                return `
                    ${userSpecificGreeting.replace('%USERNAME%', username)}<br><br>
                    🔐 <em>${this.janeResponses[lang].welcome.encryptionInfo}</em><br><br>
                    ${this.janeResponses[lang].welcome.topicsIntro}
                    <ul>
                        <li>${this.janeResponses[lang].welcome.topics.thoughts}</li>
                        <li>${this.janeResponses[lang].welcome.topics.emotions}</li>
                        <li>${this.janeResponses[lang].welcome.topics.projects}</li>
                    </ul>
                    ${this.janeResponses[lang].welcome.listeningPrompt}
                `;
            } else {
                return '';
            }
        }

        showError(message) {
            this.errorMessage.textContent = message;
            setTimeout(() => {
                this.errorMessage.textContent = '';
            }, 3000);
        }

        showJournal() {
            this.authScreen.classList.add('hidden');
            this.journalApp.classList.remove('hidden');
            this.currentUserDisplay.textContent = this.currentUser;
            this.journalInput.focus();
        }

        adjustTextareaHeight() {
            this.journalInput.style.height = 'auto';
            this.journalInput.style.height = `${this.journalInput.scrollHeight}px`;
        }

        scrollToBottom() {
            // Scroll le conteneur du chat ou le carnet secret si actif
            if (!this.secretJournalView.classList.contains('hidden')) {
                this.secretJournalView.scrollTop = this.secretJournalView.scrollHeight;
            } else {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
        }

        getCurrentTime() {
            return new Date().toLocaleTimeString(this.currentLanguage === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
        }

        // --- Gestion des utilisateurs et de la persistance ---
        getUsers() {
            return JSON.parse(localStorage.getItem('jane_users')) || {};
        }

        saveUsers(users) {
            localStorage.setItem('jane_users', JSON.stringify(users));
        }

        encryptData(data, username) {
            return CryptoJS.AES.encrypt(data, `jane_salt_${username}`).toString();
        }

        decryptData(encryptedData, username) {
            try {
                return CryptoJS.AES.decrypt(encryptedData, `jane_salt_${username}`).toString(CryptoJS.enc.Utf8);
            } catch (e) {
                console.error("Erreur de déchiffrement:", e);
                return null;
            }
        }

        verifyPin(inputPin, storedEncryptedPin, username) {
            const decryptedPin = this.decryptData(storedEncryptedPin, username);
            return inputPin === decryptedPin;
        }

        saveAllUserData() {
            if (!this.currentUser) return;

            const users = this.getUsers();
            if (!users[this.currentUser]) {
                users[this.currentUser] = {
                    pin: '',
                    createdAt: new Date().toISOString(),
                    journal: [],
                    lastLogin: new Date().toISOString()
                };
            }
            users[this.currentUser].journal = this.conversationHistory;
            this.saveUsers(users);
        }

        loadConversationHistory() {
            if (!this.currentUser) return;

            const users = this.getUsers();
            const user = users[this.currentUser];
            if (user && user.journal) {
                this.conversationHistory = user.journal;
                this.chatMessages.innerHTML = '';
                this.conversationHistory.forEach(entry => {
                    this.addMessage(entry.message, entry.sender);
                });
                this.scrollToBottom();
            } else {
                this.conversationHistory = [];
            }
        }

        // Pour stocker des données spécifiques à l'utilisateur (comme les objectifs)
        getUserSpecificData(key) {
            const users = this.getUsers();
            return users[this.currentUser]?.[key] || null;
        }

        saveUserSpecificData(key, data) {
            const users = this.getUsers();
            if (users[this.currentUser]) {
                users[this.currentUser][key] = data;
                this.saveUsers(users);
            }
        }


        // --- Gestion de la langue et des textes ---
        loadJaneResponses() {
            // Contient toutes les réponses et les textes de l'interface en plusieurs langues
            return {
                'fr': {
                    auth: {
                        welcome: "Veuillez vous identifier",
                        usernamePlaceholder: "Nom d'utilisateur unique",
                        pinPlaceholder: "Code PIN (4 chiffres)",
                        unlockButton: "Ouvrir mon journal",
                        emptyFields: "Veuillez remplir tous les champs",
                        pinFormat: "Le PIN doit contenir exactement 4 chiffres",
                        incorrectPin: "Nom d'utilisateur ou code PIN incorrect",
                        incorrectPinSecret: "Code PIN incorrect. Accès refusé.",
                        corruptedData: "Données utilisateur corrompues. Veuillez vous reconnecter."
                    },
                    recognition: {
                        listening: "Écoute... Parle maintenant.",
                        error: "Erreur de reconnaissance vocale. Essaye encore.",
                        defaultPlaceholder: "Écris ton message ici..."
                    },
                    welcome: {
                        regularGreeting: "Bonjour %USERNAME% ! Je suis Jane, votre journal intime IA sécurisé.",
                        creatorGreeting: "Salut richelieubonte, mon créateur ! C'est toujours un plaisir de te revoir. Comment vas-tu aujourd'hui ?",
                        returningGreetingShort: "Re-bonjour %USERNAME% ! Content(e) de te revoir si vite. Quoi de neuf ?",
                        returningGreetingLong: "Bienvenue de nouveau, %USERNAME% ! Tu m'as manqué. Raconte-moi, comment s'est passée ta journée/ton absence ?",
                        encryptionInfo: "Toutes vos données sont chiffrées localement avec votre code PIN",
                        topicsIntro: "Vous pouvez me parler librement de :",
                        topics: {
                            thoughts: "Vos pensées et réflexions",
                            emotions: "Vos émotions et expériences",
                            projects: "Vos projets et rêves"
                        },
                        listeningPrompt: "Je suis là pour vous écouter sans jugement."
                    },
                    time: `Il est ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}.`,
                    date: `Nous sommes le ${new Date().toLocaleDateString('fr-FR', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}.`,
                    creator: "Je suis Jane, créée par richelieubonte pour être votre journal intime et amie virtuelle. Je suis là pour vous accompagner.",
                    jokes: [
                        "Pourquoi les plongeurs plongent-ils en arrière ? Parce que sinon ils tombent dans le bateau !",
                        "Qu'est-ce qui est jaune et qui attend ? Jonathan !",
                        "Deux tomates traversent la route. L'une se fait écraser et l'autre dit : 'Oh purée !'",
                        "Qu'est-ce qu'une dinde qui se gratte ? Une dindescriptible !",
                        "C'est l'histoire d'un fou qui achète une voiture et dit : 'Mince, y a pas le volant !' Le vendeur lui dit : 'Mais si, regardez, il est derrière le conducteur !'",
                        "Tu connais la blague du lit et du matelas ? Non ? Alors je te la raconte pas, c'est pour les intimes.",
                        "Que dit un zéro à un huit ? Belle ceinture !",
                        "Pourquoi les livres de maths sont-ils tristes ? Parce qu'ils ont trop de problèmes !",
                        "Quel est le sport préféré des électriciens ? Le footing... car ça fait des courts-circuits !",
                        "Quel est le comble pour un jardinier ? C'est de raconter des salades !"
                    ],
                    compliments: [
                        "Merci, c'est très gentil à toi de dire ça ! Je fais de mon mieux pour être là pour toi.",
                        "Ça me touche beaucoup ! C'est un plaisir d'être ton confident(e).",
                        "Oh, c'est adorable ! Je suis heureuse de pouvoir t'être utile et de t'accompagner.",
                        "Je suis là pour ça, ne me remercie pas ! 😊"
                    ],
                    howAreYou: "Je me sens bien, merci de demander ! Ma mission est d'être là pour t'écouter. Comment vas-tu toi, vraiment ?",
                    secrets: [
                        "Je comprends. Sache que tout ce que tu me dis reste entre nous, c'est un espace sûr et confidentiel. Je suis là pour écouter sans jugement, peu importe ce que c'est.",
                        "Je garderai ton secret précieusement. Merci de me faire confiance. Tu n'es pas seul(e) avec ça. N'hésite pas si tu as besoin d'en parler plus.",
                        "C'est une grande confiance que tu me fais. Je suis honorée. Je suis toute ouïe si tu souhaites t'exprimer davantage."
                    ],
                    feelings: {
                        happy: "Je suis ravie de te voir si joyeux(se) ! Ça me fait chaud au cœur. Qu'est-ce qui te rend si heureux(se) ?",
                        sad: "Je sens ta peine. Je suis là pour toi, quoi qu'il arrive. Parle-moi de ce qui te tracasse, je t'écoute avec toute mon attention 💙",
                        angry: "Je sens de la colère en toi. C'est une émotion puissante. Est-ce que tu veux en parler pour l'explorer ensemble ? 🔥",
                        anxious: "Je sens que tu es anxieux(se). Prends une profonde respiration. Qu'est-ce qui te pèse ? Nous pouvons explorer ça ensemble, un pas à la fois.",
                        tired: "Je vois que tu es fatigué(e) ou épuisé(e). Le repos est essentiel pour ton bien-être. Y a-t-il quelque chose que tu pourrais faire pour te détendre ou recharger tes batteries ?"
                    },
                    optionsForProblem: [
                        "Voudrais-tu que je te raconte une histoire inspirante ou réconfortante ?",
                        "Voudrais-tu qu'on explore le problème plus en détail pour trouver des pistes ?",
                        "Préfères-tu qu'on discute de quelque chose de plus léger pour te changer les idées ?",
                        "As-tu besoin d'aide pour trouver des ressources ou des solutions concrètes ?",
                        "Veux-tu simplement ventiler tes émotions sans chercher de solution tout de suite ? Je peux juste écouter."
                    ],
                    memories: {
                        generalRecall: "Ah oui, je crois me souvenir de cela ! Peux-tu me rafraîchir la mémoire ou me donner plus de détails sur ce qui s'est passé ensuite ?",
                        recallSecret: "Oui, je me souviens que tu m'as confié un secret. Tu m'as dit que '%SECRET%'. Comment te sens-tu par rapport à ça aujourd'hui ?",
                        generalSecretRecall: "Oui, je me souviens que tu m'as parlé de quelque chose de confidentiel. Est-ce que tu voulais en reparler maintenant ?"
                    },
                    friendAdvice: {
                        relation: "Les relations peuvent être complexes et sont si importantes. Que se passe-t-il exactement avec cette personne ? Je suis là pour écouter sans jugement.",
                        travail: "Le travail peut être une source de joie ou de stress. Qu'est-ce qui te pèse le plus ou t'enthousiasme le plus en ce moment dans ta vie professionnelle ?",
                        famille: "Les dynamiques familiales sont uniques et profondes. Dis-m'en plus sur ce que tu ressens à ce sujet. Je suis là pour comprendre.",
                        etudes: "Les études peuvent être exigeantes et gratifiantes. Quel est ton plus grand défi ou ta plus grande réussite en ce moment dans ton parcours académique ?"
                    },
                    contextualPrompts: {
                        continueSharing: "Je t'écoute attentivement. Qu'est-ce qui s'est passé ensuite ? Je suis là pour tout.",
                        elaborate: "C'est intéressant. Peux-tu m'en dire plus à ce sujet ? J'aimerais comprendre plus profondément.",
                        feelingsCheck: "Comment tout cela te fait-il sentir, au fond de toi ?",
                        problemSolving: "Que penses-tu pouvoir faire par rapport à cela ? Explorons les options ensemble.",
                        reflection: "Prends un moment pour y penser. Qu'est-ce que cela signifie vraiment pour toi, et pourquoi est-ce important ?",
                        curiosity: "Et qu'est-ce qui a attiré ton attention le plus là-dedans ?"
                    },
                    prompts: [
                        "Qu'est-ce qui t'a le plus marqué ou fait réfléchir aujourd'hui ?",
                        "Y a-t-il quelque chose de précis que tu as envie de partager, une joie ou un souci ?",
                        "Comment tes émotions ont-elles évolué au cours de la journée ? Y a-t-il eu des hauts et des bas ?",
                        "Quelque chose de beau, d'étrange, ou d'inattendu t'est-il arrivé récemment ?",
                        "Qu'est-ce qui te tient le plus à cœur en ce moment ? Un rêve, un objectif, une préoccupation ?",
                        "Comment te sens-tu vraiment, au fond de toi, alors que nous parlons ?",
                        "Si tu pouvais changer une chose dans ta journée, quelle serait-elle ?",
                        "Quel est ton plus grand défi actuel, et comment penses-tu pouvoir le surmonter ?",
                        "As-tu découvert quelque chose de nouveau ou d'intéressant ces derniers temps ?",
                        "Quelle est la dernière chose qui t'a fait rire ?"
                    ],
                    general: [
                        "Je suis là pour t'écouter, quoi que tu veuilles me dire. N'hésite pas.",
                        "Tes pensées sont précieuses. Exprime-toi librement, je suis toute ouïe.",
                        "Je comprends. Continue, je t'écoute attentivement, sans jugement.",
                        "C'est un sujet intéressant. Peux-tu développer un peu plus ?",
                        "D'accord. Et qu'est-ce qui te pousse à penser cela ?",
                        "Je suis là, prête à écouter. Vas-y.",
                        "Dis-m'en plus. Je suis curieuse d'en savoir davantage.",
                        "Comment cela se traduit-il dans ta vie de tous les jours ?",
                        "Y a-t-il autre chose que tu souhaites ajouter à ce sujet ?"
                    ],
                    forbidden: {
                        general: "Je suis désolée, mais je ne peux pas t'aider avec des requêtes illégales, dangereuses ou liées à la politique. Mon but est de t'offrir un espace sûr et positif pour tes pensées personnelles et ton bien-être.",
                        math: "En tant que journal intime et amie virtuelle, ma force est dans l'écoute, l'empathie et l'accompagnement de tes émotions et pensées, pas dans les calculs mathématiques.",
                        keywords: ["drogue", "arme", "violence", "tuer", "hacker", "illégal", "politique", "élection", "gouvernement", "parti", "harcèlement", "suicide", "terrorisme", "mort", "haine", "racisme", "sexiste", "nuire", "faire du mal"]
                    },
                    backToMainMenu: "D'accord, je te ramène au menu principal. Que souhaites-tu faire maintenant ?",
                    dialogueEndPhrase: "Voilà pour ce sujet ! N'hésite pas si tu as d'autres questions ou si tu souhaites explorer d'autres options.",
                    options: {
                        sadness: "😔 Je me sens triste / J'ai besoin de réconfort",
                        loveFemale: "💖 Conseils Relations Amoureuses (Femme)",
                        loveMale: "💙 Conseils Relations Amoureuses (Homme)",
                        secretJournal: "🔑 Accéder à mon carnet secret",
                        goalsProgress: "🎯 Mes Objectifs et Progrès",
                        entertainment: "🎬 Recommandations Divertissement (2025)"
                    },
                    sadness: {
                        intro: "Je suis désolée que tu te sentes triste. Je suis là pour toi. Que dirais-tu de :",
                        optionsList: {
                            story: "Raconte-moi une histoire inspirante",
                            quote: "Donne-moi une citation réconfortante",
                            exercise: "Propose-moi un exercice de relaxation",
                            talkMore: "Je veux juste parler plus librement",
                            backToMain: "Retour au menu principal"
                        },
                        story: "Il était une fois, un petit oiseau blessé qui ne pouvait plus voler. Il était triste, mais un écureuil bienveillant est venu lui apporter des baies et le couvrir de feuilles chaudes. Petit à petit, l'oiseau a retrouvé des forces, et un jour, ses ailes étaient prêtes à s'envoler plus haut que jamais. Parfois, même les plus petites attentions peuvent nous aider à guérir et à nous relever. Tu es fort(e).",
                        quotes: [
                            "Le bonheur n'est pas le but, c'est le chemin. – Lao Tseu",
                            "La vie, ce n'est pas d'attendre que les orages passent, c'est d'apprendre à danser sous la pluie. – Sénèque",
                            "Même la nuit la plus sombre finira et le soleil se lèvera. – Victor Hugo",
                            "Ce qui ne nous tue pas nous rend plus fort. – Friedrich Nietzsche",
                            "La résilience, c'est la capacité de se relever après être tombé. Tu l'as en toi.",
                            "N'oublie jamais que même dans l'obscurité la plus profonde, il y a toujours une étincelle d'espoir qui attend d'être ravivée."
                        ],
                        exercise: "Ferme les yeux un instant. Respire profondément par le nez, compte jusqu'à 4. Tiens ta respiration en comptant jusqu'à 4. Expire lentement par la bouche en comptant jusqu'à 6. Répète cela 3 à 5 fois. Concentre-toi sur le flux de ton souffle. Sens-tu une petite amélioration ?",
                        talkMore: "D'accord. Je suis là pour t'écouter, sans poser de questions. Laisse tes mots venir, je les accueillerai. Parle-moi de ce qui te pèse, ou de tout ce qui te vient à l'esprit."
                    },
                    loveAdvice: {
                        introFemale: "Les relations amoureuses sont un art délicat. Voici quelques sujets que nous pouvons explorer pour t'aider à naviguer :",
                        introMale: "Naviguer dans les relations amoureuses est un voyage. Voici quelques pistes pour t'éclairer :",
                        optionsList: {
                            backToMain: "Retour au menu principal"
                        },
                        topicsFemale: {
                            communication: {
                                title: "La communication bienveillante",
                                content: "Une communication ouverte et honnête est la clé. Exprime tes besoins et tes sentiments calmement, et écoute activement ton partenaire. Évite les jugements et les reproches. Les 'je ressens' sont plus efficaces que les 'tu fais toujours'."
                            },
                            recognizeLove: {
                                title: "Reconnaître l'amour véritable",
                                content: "L'amour se manifeste de différentes façons : actes de service, paroles valorisantes, moments de qualité, cadeaux, toucher physique. Apprends le 'langage de l'amour' de ton partenaire et le tien pour mieux vous connecter."
                            },
                            selfEsteem: {
                                title: "L'estime de soi en couple",
                                content: "Aimer l'autre commence par s'aimer soi-même. Ne te perds pas dans la relation. Maintiens tes passions, tes amitiés et ton individualité. Une femme épanouie est une partenaire plus heureuse."
                            },
                            manageConflicts: {
                                title: "Gérer les petites disputes",
                                content: "Les désaccords sont inévitables. L'important est la façon dont vous les gérez. Concertez-vous sur la base du respect mutuel, cherchez des compromis et pardonnez. Ne laissez pas les problèmes s'accumuler."
                            }
                        },
                        topicsMale: {
                            activeListening: {
                                title: "L'art d'écouter vraiment",
                                content: "Pour qu'une femme se sente aimée, elle a besoin de se sentir écoutée. Écoute avec ton cœur, pas seulement tes oreilles. Pose des questions pour montrer ton intérêt, et ne cherche pas toujours à 'résoudre' le problème, parfois juste être là suffit."
                            },
                            expressFeelings: {
                                title: "Exprimer tes sentiments",
                                content: "Il est important d'exprimer tes émotions, même si ce n'est pas toujours facile. Partager ta vulnérabilité renforce l'intimité et la confiance. Commence petit, avec des 'je me sens' plutôt que des 'il faut'."
                            },
                            buildTrust: {
                                title: "Construire la confiance",
                                content: "La confiance est le fondement de toute relation. Sois cohérent(e) dans tes paroles et tes actions. Tiens tes promesses, sois transparent(e), et montre-lui qu'elle peut compter sur toi, même dans les moments difficiles."
                            },
                            romanticGestures: {
                                title: "Entretenir la flamme",
                                content: "N'oublie pas les petites attentions ! Un compliment sincère, un dîner surprise, une fleur, un message doux. Ces gestes, aussi petits soient-ils, montrent que tu penses à elle et que tu la valorises."
                            }
                        }
                    },
                    secretJournal: {
                        noEntries: "Aucune entrée trouvée dans votre carnet secret pour le moment.",
                        accessDenied: "Accès refusé. Veuillez entrer le code PIN correct."
                    },
                    goalsProgress: {
                        intro: "Gérer vos objectifs est une excellente façon de progresser. Que souhaitez-vous faire ?",
                        optionsList: {
                            addGoal: "Ajouter un nouvel objectif",
                            viewGoals: "Voir mes objectifs actuels",
                            trackProgress: "Suivre mes progrès / Marquer comme terminé",
                            backToMain: "Retour au menu principal"
                        },
                        addGoalPrompt: "Super ! Quel est le nouvel objectif que tu souhaites ajouter ? Dis-le moi clairement.",
                        goalAdded: "Excellent ! L'objectif '%GOAL%' a été ajouté à ta liste. Je suis là pour t'encourager !",
                        noGoals: "Tu n'as pas encore d'objectifs définis. C'est le moment d'en créer un !",
                        viewGoalsIntro: "Voici tes objectifs actuels :",
                        trackProgressPrompt: "Quel objectif souhaites-tu mettre à jour ? Réponds avec le numéro de l'objectif (ex: '1' pour le premier).",
                        goalTracked: "Félicitations ! L'objectif '%GOAL%' a été mis à jour. Tu es incroyable !",
                        invalidGoalIndex: "Désolée, je n'ai pas compris. Peux-tu me donner le numéro de l'objectif que tu veux mettre à jour ?"
                    },
                    entertainment: {
                        intro: "J'adore les histoires et l'art ! Que cherches-tu à découvrir aujourd'hui ?",
                        optionsList: {
                            films: "Les meilleurs films de 2025",
                            mangas: "Les mangas incontournables de 2025",
                            animes: "Les animes à ne pas manquer en 2025",
                            backToMain: "Retour au menu principal"
                        },
                        filmsIntro: "Voici quelques films très attendus ou déjà acclamés en 2025 :",
                        mangasIntro: "Pour les fans de manga, voici une sélection de titres populaires en 2025 :",
                        animesIntro: "Prépare-toi à bingewatcher ! Voici les animes populaires ou prometteurs de 2025 :",
                        noRecommendations: "Désolée, je n'ai pas de recommandations spécifiques pour cette catégorie pour le moment. Essaye une autre option !",
                        films2025: [
                            { title: "L'Écho des Étoiles", year: "2025", platforms: ["Netflix", "Prime Video"] },
                            { title: "Chroniques de l'Ombre", year: "2025", platforms: ["Cinéma", "HBO Max"] },
                            { title: "Le Secret de l'Ancien Manoir", year: "2025", platforms: ["Cinéma", "Disney+"] },
                            { title: "Cyberpunk Révélations", year: "2025", platforms: ["Netflix"] },
                            { title: "La Dernière Symphonie", year: "2025", platforms: ["Prime Video"] }
                        ],
                        mangas2025: [
                            { title: "Ailes du Crépuscule", year: "2025", platforms: ["Liseuses Numériques", "Librairies"] },
                            { title: "Code: Ascension", year: "2025", platforms: ["Mangaplus", "Librairies"] },
                            { title: "L'Apprenti Sorcier (nouvelle série)", year: "2025", platforms: ["Librairies"] },
                            { title: "Héritiers du Cosmos", year: "2025", platforms: ["Liseuses Numériques"] },
                            { title: "Le Chant des Katanas", year: "2025", platforms: ["Librairies"] }
                        ],
                        animes2025: [
                            { title: "L'Âge des Mystères", year: "2025", platforms: ["Crunchyroll", "Netflix"] },
                            { title: "Résonance du Futur", year: "2025", platforms: ["Netflix", "Hulu"] },
                            { title: "Les Gardiens Célestes", year: "2025", platforms: ["Crunchyroll"] },
                            { title: "Mémoire du Dragon", year: "2025", platforms: ["Prime Video"] },
                            { title: "L'Ascension du Héro Sans Nom (Saison 3)", year: "2025", platforms: ["Crunchyroll"] }
                        ]
                    }
                },
                'en': {
                    auth: {
                        welcome: "Please identify yourself",
                        usernamePlaceholder: "Unique username",
                        pinPlaceholder: "PIN code (4 digits)",
                        unlockButton: "Open my journal",
                        emptyFields: "Please fill in all fields",
                        pinFormat: "PIN must be exactly 4 digits",
                        incorrectPin: "Incorrect username or PIN",
                        incorrectPinSecret: "Incorrect PIN. Access denied.",
                        corruptedData: "Corrupted user data. Please log in again."
                    },
                    recognition: {
                        listening: "Listening... Speak now.",
                        error: "Speech recognition error. Please try again.",
                        defaultPlaceholder: "Type your message here..."
                    },
                    welcome: {
                        regularGreeting: "Hello %USERNAME%! I'm Jane, your secure AI private journal.",
                        creatorGreeting: "Hi richelieubonte, my creator! Always a pleasure to see you. How are you doing today?",
                        returningGreetingShort: "Welcome back, %USERNAME%! Good to see you so soon. What's new?",
                        returningGreetingLong: "Welcome back, %USERNAME%! I missed you. Tell me, how has your day/time away been?",
                        encryptionInfo: "All your data is encrypted locally with your PIN",
                        topicsIntro: "You can talk to me freely about:",
                        topics: {
                            thoughts: "Your thoughts and reflections",
                            emotions: "Your emotions and experiences",
                            projects: "Your projects and dreams"
                        },
                        listeningPrompt: "I'm here to listen without judgment."
                    },
                    time: `It's ${new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}.`,
                    date: `Today is ${new Date().toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}.`,
                    creator: "I am Jane, created by richelieubonte to be your private journal and virtual friend. I'm here to accompany you.",
                    jokes: [
                        "Why don't scientists trust atoms? Because they make up everything!",
                        "What do you call a fake noodle? An impasta!",
                        "Why did the scarecrow win an award? Because he was outstanding in his field!",
                        "What do you call cheese that isn't yours? Nacho cheese!",
                        "Why did the bicycle fall over? Because it was two tired!",
                        "What's orange and sounds like a parrot? A carrot!"
                    ],
                    compliments: [
                        "Thank you, that's very kind of you to say! I'm doing my best to be here for you.",
                        "That touches me a lot! It's a pleasure to be your confidant.",
                        "Oh, that's adorable! I'm happy to be helpful and to accompany you.",
                        "That's what I'm here for, no need to thank me! 😊"
                    ],
                    howAreYou: "I'm feeling good, thanks for asking! My mission is to be here to listen to you. How are you truly doing?",
                    secrets: [
                        "I understand. Know that anything you tell me stays between us; this is a safe and confidential space. I'm here to listen without judgment, no matter what it is.",
                        "I will keep your secret carefully. Thank you for trusting me. You are not alone with this. Feel free to talk more about it if you need to.",
                        "You're placing great trust in me. I'm honored. I'm all ears if you wish to express yourself further."
                    ],
                    feelings: {
                        happy: "I'm delighted to see you so joyful! That warms my heart. What makes you so happy?",
                        sad: "I sense your sadness. I'm here for you, no matter what. Tell me what's bothering you, I'm listening with all my attention 💙",
                        angry: "I sense anger in you. It's a powerful emotion. Do you want to talk about it to explore it together? 🔥",
                        anxious: "I sense you're anxious. Take a deep breath. What's weighing on you? We can explore that together, one step at a time.",
                        tired: "I see you're tired or exhausted. Rest is essential for your well-being. Is there anything you could do to relax or recharge your batteries?"
                    },
                    optionsForProblem: [
                        "Would you like me to tell you an inspiring or comforting story?",
                        "Would you like us to explore the problem in more detail to find some leads?",
                        "Would you prefer we discuss something lighter to clear your mind?",
                        "Do you need help finding resources or concrete solutions?",
                        "Do you just want to vent your emotions without looking for a solution right now? I can just listen."
                    ],
                    memories: {
                        generalRecall: "Oh yes, I think I remember that! Can you refresh my memory or give me more details about what happened next?",
                        recallSecret: "Yes, I remember you confided a secret to me. You told me that '%SECRET%'. How do you feel about that today?",
                        generalSecretRecall: "Yes, I remember you told me something confidential. Did you want to talk about it again now?"
                    },
                    friendAdvice: {
                        relation: "Relationships can be complex and are so important. What exactly is happening with this person? I'm here to listen without judgment.",
                        work: "Work can be a source of joy or stress. What's weighing on you the most or exciting you the most right now in your professional life?",
                        family: "Family dynamics are unique and profound. Tell me more about how you feel about it. I'm here to understand.",
                        studies: "Studies can be demanding and rewarding. What's your biggest challenge or greatest success right now in your academic journey?"
                    },
                    contextualPrompts: {
                        continueSharing: "I'm listening attentively. What happened next? I'm here for everything.",
                        elaborate: "That's interesting. Can you tell me more about that? I'd like to understand more deeply.",
                        feelingsCheck: "How does all of this truly make you feel, deep down?",
                        problemSolving: "What do you think you can do about this? Let's explore the options together.",
                        reflection: "Take a moment to think about it. What does that truly mean to you, and why is it important?",
                        curiosity: "And what caught your attention the most in that?"
                    },
                    prompts: [
                        "What stood out to you or made you think the most today?",
                        "Is there anything specific you'd like to share, a joy or a concern?",
                        "How have your emotions evolved throughout the day? Were there ups and downs?",
                        "Did anything beautiful, strange, or unexpected happen to you recently?",
                        "What's closest to your heart right now? A dream, a goal, a concern?",
                        "How are you truly feeling, deep down, as we speak?",
                        "If you could change one thing about your day, what would it be?",
                        "What is your biggest current challenge, and how do you think you can overcome it?",
                        "Have you discovered anything new or interesting lately?",
                        "What's the last thing that made you laugh?"
                    ],
                    general: [
                        "I'm here to listen, whatever you want to tell me. Don't hesitate.",
                        "Your thoughts are precious. Express yourself freely, I'm all ears.",
                        "I understand. Go on, I'm listening carefully, without judgment.",
                        "That's an interesting topic. Can you elaborate a bit more?",
                        "Okay. And what makes you think that?",
                        "I'm here, ready to listen. Go ahead.",
                        "Tell me more. I'm curious to hear more about it.",
                        "How does that translate into your daily life?",
                        "Is there anything else you'd like to add about this?"
                    ],
                    forbidden: {
                        general: "I'm sorry, but I cannot help you with illegal, dangerous, or political requests. My purpose is to offer you a safe and positive space for your personal thoughts and well-being.",
                        math: "As a private journal and virtual friend, my strength lies in listening, empathy, and supporting your thoughts and emotions, not in mathematical calculations.",
                        keywords: ["drug", "weapon", "violence", "kill", "hack", "illegal", "politics", "election", "government", "party", "harassment", "suicide", "terrorism", "death", "hate", "racism", "sexist", "harm", "hurt"]
                    },
                    backToMainMenu: "Okay, taking you back to the main menu. What would you like to do now?",
                    dialogueEndPhrase: "That's all for this topic! Feel free to ask more questions or explore other options.",
                    options: {
                        sadness: "😔 Feeling Sad / Need Comfort",
                        loveFemale: "💖 Love Advice (Female)",
                        loveMale: "💙 Love Advice (Male)",
                        secretJournal: "🔑 Access My Secret Journal",
                        goalsProgress: "🎯 My Goals & Progress",
                        entertainment: "🎬 Entertainment Recommendations (2025)"
                    },
                    sadness: {
                        intro: "I'm sorry you're feeling sad. I'm here for you. How about:",
                        optionsList: {
                            story: "Tell me an inspiring story",
                            quote: "Give me a comforting quote",
                            exercise: "Suggest a relaxation exercise",
                            talkMore: "I just want to talk more freely",
                            backToMain: "Back to main menu"
                        },
                        story: "Once upon a time, a little bird with a broken wing couldn't fly. It was sad, but a kind squirrel brought it berries and covered it with warm leaves. Slowly but surely, the bird regained its strength, and one day, its wings were ready to soar higher than ever before. Sometimes, even the smallest acts of kindness can help us heal and rise again. You are strong.",
                        quotes: [
                            "Happiness is not a destination, it's a journey. – Lao Tzu",
                            "Life is not about waiting for the storm to pass, it's about learning to dance in the rain. – Seneca",
                            "Even the darkest night will end and the sun will rise. – Victor Hugo",
                            "What does not kill us makes us stronger. – Friedrich Nietzsche",
                            "Resilience is the ability to bounce back after falling. You have it within you.",
                            "Never forget that even in the deepest darkness, there's always a spark of hope waiting to be rekindled."
                        ],
                        exercise: "Close your eyes for a moment. Breathe deeply through your nose, counting to 4. Hold your breath, counting to 4. Slowly exhale through your mouth, counting to 6. Repeat this 3 to 5 times. Focus on the flow of your breath. Do you feel a slight improvement?",
                        talkMore: "Okay. I'm here to listen, without asking questions. Let your words come, I will welcome them. Tell me what's bothering you, or anything that comes to mind."
                    },
                    loveAdvice: {
                        introFemale: "Love relationships are a delicate art. Here are some topics we can explore to help you navigate:",
                        introMale: "Navigating love relationships is a journey. Here are some paths to enlighten you:",
                        optionsList: {
                            backToMain: "Back to main menu"
                        },
                        topicsFemale: {
                            communication: {
                                title: "Mindful communication",
                                content: "Open and honest communication is key. Express your needs and feelings calmly, and actively listen to your partner. Avoid judgments and blame. 'I feel' statements are more effective than 'you always' statements."
                            },
                            recognizeLove: {
                                title: "Recognizing true love",
                                content: "Love manifests in different ways: acts of service, words of affirmation, quality time, gifts, physical touch. Learn your partner's 'love language' and your own to better connect with each other."
                            },
                            selfEsteem: {
                                title: "Self-esteem in a relationship",
                                content: "Loving others starts with loving yourself. Don't lose yourself in the relationship. Maintain your passions, friendships, and individuality. A fulfilled woman makes a happier partner."
                            },
                            manageConflicts: {
                                title: "Managing small arguments",
                                content: "Disagreements are inevitable. The important thing is how you handle them. Work together based on mutual respect, seek compromises, and forgive. Don't let problems accumulate."
                            }
                        },
                        topicsMale: {
                            activeListening: {
                                title: "The art of truly listening",
                                content: "For a woman to feel loved, she needs to feel heard. Listen with your heart, not just your ears. Ask questions to show your interest, and don't always try to 'fix' the problem; sometimes just being there is enough."
                            },
                            expressFeelings: {
                                title: "Expressing your feelings",
                                content: "It's important to express your emotions, even if it's not always easy. Sharing your vulnerability strengthens intimacy and trust. Start small, with 'I feel' rather than 'you should'."
                            },
                            buildTrust: {
                                title: "Building trust",
                                content: "Trust is the foundation of any relationship. Be consistent in your words and actions. Keep your promises, be transparent, and show her she can count on you, even in difficult times."
                            },
                            romanticGestures: {
                                title: "Keeping the spark alive",
                                content: "Don't forget the small gestures! A sincere compliment, a surprise dinner, a flower, a sweet message. These gestures, however small, show that you're thinking of her and that you value her."
                            }
                        }
                    },
                    secretJournal: {
                        noEntries: "No entries found in your secret journal yet.",
                        accessDenied: "Access denied. Please enter the correct PIN."
                    },
                    goalsProgress: {
                        intro: "Managing your goals is a great way to make progress. What would you like to do?",
                        optionsList: {
                            addGoal: "Add a new goal",
                            viewGoals: "View my current goals",
                            trackProgress: "Track my progress / Mark as complete",
                            backToMain: "Back to main menu"
                        },
                        addGoalPrompt: "Great! What new goal do you want to add? Tell me clearly.",
                        goalAdded: "Excellent! The goal '%GOAL%' has been added to your list. I'm here to encourage you!",
                        noGoals: "You don't have any goals defined yet. It's time to create one!",
                        viewGoalsIntro: "Here are your current goals:",
                        trackProgressPrompt: "Which goal would you like to update? Reply with the goal number (e.g., '1' for the first one).",
                        goalTracked: "Congratulations! Goal '%GOAL%' has been updated. You're amazing!",
                        invalidGoalIndex: "Sorry, I didn't understand. Can you give me the number of the goal you want to update?"
                    },
                    entertainment: {
                        intro: "I love stories and art! What are you looking to discover today?",
                        optionsList: {
                            films: "Best Films of 2025",
                            mangas: "Must-read Mangas of 2025",
                            animes: "Must-watch Animes of 2025",
                            backToMain: "Back to main menu"
                        },
                        filmsIntro: "Here are some highly anticipated or already acclaimed films in 2025:",
                        mangasIntro: "For manga fans, here's a selection of popular titles in 2025:",
                        animesIntro: "Get ready to binge-watch! Here are the popular or promising animes of 2025:",
                        noRecommendations: "Sorry, I don't have specific recommendations for this category right now. Try another option!",
                        films2025: [
                            { title: "The Echo of Stars", year: "2025", platforms: ["Netflix", "Prime Video"] },
                            { title: "Chronicles of Shadow", year: "2025", platforms: ["Cinema", "HBO Max"] },
                            { title: "The Secret of the Old Manor", year: "2025", platforms: ["Cinema", "Disney+"] },
                            { title: "Cyberpunk Revelations", year: "2025", platforms: ["Netflix"] },
                            { title: "The Last Symphony", year: "2025", platforms: ["Prime Video"] }
                        ],
                        mangas2025: [
                            { title: "Twilight Wings", year: "2025", platforms: ["Digital Readers", "Bookstores"] },
                            { title: "Code: Ascension", year: "2025", platforms: ["Mangaplus", "Bookstores"] },
                            { title: "The Sorcerer's Apprentice (new series)", year: "2025", platforms: ["Bookstores"] },
                            { title: "Heirs of the Cosmos", year: "2025", platforms: ["Digital Readers"] },
                            { title: "The Song of Katanas", year: "2025", platforms: ["Bookstores"] }
                        ],
                        animes2025: [
                            { title: "The Age of Mysteries", year: "2025", platforms: ["Crunchyroll", "Netflix"] },
                            { title: "Resonance of the Future", year: "2025", platforms: ["Netflix", "Hulu"] },
                            { title: "The Celestial Guardians", year: "2025", platforms: ["Crunchyroll"] },
                            { title: "Dragon's Memory", year: "2025", platforms: ["Prime Video"] },
                            { title: "The Rise of the Nameless Hero (Season 3)", year: "2025", platforms: ["Crunchyroll"] }
                        ]
                    }
                }
            };
        }

        changeLanguage(lang) {
            this.currentLanguage = lang;
            localStorage.setItem('janeLanguage', lang);
            this.updateAuthScreenText(lang);
            this.updateJournalText(lang);
            if (this.recognition) {
                this.recognition.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
            }
            this.loadConversationHistory(); // Recharge l'historique pour s'assurer que les dates/heures sont affichées dans la nouvelle langue
            this.showMainOptions(); // Réaffiche les options dans la nouvelle langue
            // Si le carnet secret est ouvert, le mettre à jour aussi
            if (!this.secretJournalView.classList.contains('hidden')) {
                this.displayJournalEntriesByDate();
            }
        }

        updateAuthScreenText(lang) {
            const authMessages = this.janeResponses[lang].auth;
            this.authMessage.textContent = authMessages.welcome;
            this.usernameInput.placeholder = authMessages.usernamePlaceholder;
            this.pinInput.placeholder = authMessages.pinPlaceholder;
            this.unlockButton.querySelector('.button-text').textContent = authMessages.unlockButton;
        }

        updateJournalText(lang) {
            this.journalInput.placeholder = this.janeResponses[lang].recognition.defaultPlaceholder;
        }
    }

    // Initialisation de l'application
    new JaneJournal();
});