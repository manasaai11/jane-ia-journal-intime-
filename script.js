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

            // Éléments du journal
            this.journalInput = document.getElementById('journal-input');
            this.sendButton = document.getElementById('send-button');
            this.messagesContainer = document.getElementById('messages-container');
            this.usernameDisplay = document.getElementById('username-display');
            this.logoutButton = document.getElementById('logout-button');
            this.clearHistoryButton = document.getElementById('clear-history-button');
            this.microphoneButton = document.getElementById('microphone-button');
            this.languageSelect = document.getElementById('language-select');
            this.janeOptionsContainer = document.getElementById('jane-options');
            this.secretJournalButton = document.getElementById('secret-journal-button');

            // Éléments du carnet secret
            this.secretJournalView = document.getElementById('secret-journal-view');
            this.backToJournalButton = document.getElementById('back-to-journal-button');
            this.journalEntriesContainer = document.getElementById('journal-entries-container');
            this.journalEntryText = document.getElementById('journal-entry-text');
            this.saveEntryButton = document.getElementById('save-entry-button');
            this.currentDateDisplay = document.getElementById('current-date-display');
            this.prevDayButton = document.getElementById('prev-day-button');
            this.nextDayButton = document.getElementById('next-day-button');
            this.secretJournalForm = document.getElementById('secret-journal-form');
        }

        initEvents() {
            this.unlockButton.addEventListener('click', () => this.handleAuth());
            this.pinInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleAuth();
            });
            this.sendButton.addEventListener('click', () => this.handleSendMessage());
            this.journalInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSendMessage();
            });
            this.journalInput.addEventListener('input', () => this.adjustTextareaHeight());
            this.logoutButton.addEventListener('click', () => this.logout());
            this.clearHistoryButton.addEventListener('click', () => this.clearConversationHistory());
            this.microphoneButton.addEventListener('click', () => this.toggleSpeechRecognition());
            this.languageSelect.addEventListener('change', (e) => this.changeLanguage(e.target.value));
            this.secretJournalButton.addEventListener('click', () => this.showSecretJournal());
            this.backToJournalButton.addEventListener('click', () => this.hideSecretJournal());
            this.saveEntryButton.addEventListener('click', () => this.saveJournalEntry());
            this.prevDayButton.addEventListener('click', () => this.navigateJournalDay(-1));
            this.nextDayButton.addEventListener('click', () => this.navigateJournalDay(1));

            // Gestion de l'affichage des options de Jane
            this.janeOptionsContainer.addEventListener('click', (e) => {
                const target = e.target.closest('.jane-option-button');
                if (target && target.dataset.optionId) {
                    this.handleOptionSelection(target.dataset.optionId);
                }
            });
        }

        // --- AUTHENTIFICATION ---
        checkAuth() {
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                this.currentUser = JSON.parse(storedUser);
                this.showJournalApp();
            } else {
                this.showAuthScreen();
            }
        }

        showAuthScreen() {
            this.authScreen.classList.remove('hidden');
            this.journalApp.classList.add('hidden');
            this.secretJournalView.classList.add('hidden');
            this.usernameInput.value = '';
            this.pinInput.value = '';
            this.authMessage.textContent = this.janeResponses[this.currentLanguage].auth.welcome;
            this.errorMessage.textContent = '';
        }

        showJournalApp() {
            this.authScreen.classList.add('hidden');
            this.journalApp.classList.remove('hidden');
            this.usernameDisplay.textContent = this.currentUser.username;
            this.loadConversationHistory(); // Charge l'historique de conversation de l'utilisateur
            this.loadJournalEntries(); // Charge les entrées du carnet secret
            this.showMainOptions(); // Affiche les options principales
            this.adjustTextareaHeight();
            this.journalInput.focus();
        }

        handleAuth() {
            const username = this.usernameInput.value.trim();
            const pin = this.pinInput.value.trim();

            if (username === '' || pin === '') {
                this.errorMessage.textContent = this.janeResponses[this.currentLanguage].auth.emptyFields;
                return;
            }

            let users = JSON.parse(localStorage.getItem('users') || '{}');

            if (users[username]) {
                // Utilisateur existant
                if (users[username].pin === pin) {
                    this.currentUser = { username: username, pin: pin };
                    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                    this.showJournalApp();
                } else {
                    this.errorMessage.textContent = this.janeResponses[this.currentLanguage].auth.invalidPin;
                }
            } else {
                // Nouvel utilisateur
                this.currentUser = { username: username, pin: pin };
                users[username] = this.currentUser;
                localStorage.setItem('users', JSON.stringify(users));
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                this.showJournalApp();
            }
        }

        logout() {
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            localStorage.removeItem(`conversationHistory_${this.currentUser ? this.currentUser.username : 'default'}`);
            this.conversationHistory = []; // Vide l'historique en mémoire
            this.showAuthScreen();
        }

        // --- GESTION DES MESSAGES ET DE L'HISTORIQUE ---
        addMessage(text, sender) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', `${sender}-message`);
            messageElement.textContent = text;
            this.messagesContainer.appendChild(messageElement);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight; // Scroll vers le bas
        }

        adjustTextareaHeight() {
            this.journalInput.style.height = 'auto'; // Réinitialise la hauteur
            this.journalInput.style.height = this.journalInput.scrollHeight + 'px'; // Ajuste à la hauteur du contenu
        }

        showThinking() {
            const thinkingMsg = document.createElement('div');
            thinkingMsg.classList.add('message', 'jane-message', 'thinking-message');
            thinkingMsg.textContent = '...';
            this.messagesContainer.appendChild(thinkingMsg);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            return thinkingMsg;
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
                // Sinon, générer une réponse libre via l'IA
                const thinkingMsg = this.showThinking(); // Affiche les points de suspension
                
                // Désactive l'input et le bouton pendant que l'IA répond
                this.journalInput.disabled = true; 
                this.sendButton.disabled = true;
                this.microphoneButton.disabled = true;

                try {
                    const response = await this.getJaneResponse(message); // Appel ASYNCHRONE à la fonction IA
                    thinkingMsg.remove(); // Supprime les points de suspension
                    this.addMessage(response, 'jane');
                    this.conversationHistory.push({ sender: 'jane', message: response, timestamp: new Date().toISOString() });
                    this.saveAllUserData();
                    this.lastJaneResponse = response; // Met à jour la dernière réponse de Jane
                } catch (error) {
                    console.error('Erreur lors de la communication avec le chatbot :', error);
                    thinkingMsg.remove(); // Supprime les points de suspension même en cas d'erreur
                    // Message d'erreur utilisateur
                    const errorMessage = this.janeResponses[this.currentLanguage].recognition.errorResponse || "Désolé, je n'ai pas pu générer de réponse pour le moment.";
                    this.addMessage(errorMessage, 'jane');
                    this.conversationHistory.push({ sender: 'jane', message: errorMessage, timestamp: new Date().toISOString() });
                    this.saveAllUserData();
                } finally {
                    // Réactive l'input et le bouton après la réponse ou l'erreur
                    this.journalInput.disabled = false;
                    this.sendButton.disabled = false;
                    this.microphoneButton.disabled = false;
                    this.journalInput.focus(); // Remet le focus sur le champ de saisie
                }
            }
        }

        loadConversationHistory() {
            const history = JSON.parse(localStorage.getItem(`conversationHistory_${this.currentUser.username}`) || '[]');
            this.conversationHistory = history; // Charge l'historique complet
            this.messagesContainer.innerHTML = ''; // Vide l'affichage actuel
            history.forEach(entry => {
                this.addMessage(entry.message, entry.sender);
            });
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight; // Scroll vers le bas
        }

        saveAllUserData() {
            // Sauvegarde l'historique de conversation de l'utilisateur actuel
            localStorage.setItem(`conversationHistory_${this.currentUser.username}`, JSON.stringify(this.conversationHistory));
            // Sauvegarde les entrées du carnet secret
            localStorage.setItem(`journalEntries_${this.currentUser.username}`, JSON.stringify(this.currentUser.journalEntries || {}));
        }

        clearConversationHistory() {
            if (confirm(this.janeResponses[this.currentLanguage].clearHistoryConfirmation)) {
                this.conversationHistory = [];
                localStorage.removeItem(`conversationHistory_${this.currentUser.username}`);
                this.messagesContainer.innerHTML = ''; // Vide l'affichage
                this.addMessage(this.janeResponses[this.currentLanguage].clearHistorySuccess, 'jane');
            }
        }

        // --- RECONNAISSANCE VOCALE ---
        toggleSpeechRecognition() {
            if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
                if (!this.recognition) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    this.recognition = new SpeechRecognition();
                    this.recognition.lang = this.currentLanguage === 'fr' ? 'fr-FR' : 'en-US';
                    this.recognition.interimResults = false;
                    this.recognition.maxAlternatives = 1;

                    this.recognition.onresult = (event) => {
                        const transcript = event.results[0][0].transcript;
                        this.journalInput.value = transcript;
                        this.handleSendMessage(); // Envoie le message transcrit
                    };

                    this.recognition.onerror = (event) => {
                        console.error('Speech recognition error:', event.error);
                        this.addMessage(this.janeResponses[this.currentLanguage].recognition.error || 'Désolé, je n\'ai pas pu comprendre. Pouvez-vous répéter ?', 'jane');
                        this.microphoneButton.classList.remove('active');
                    };

                    this.recognition.onend = () => {
                        this.microphoneButton.classList.remove('active');
                        this.journalInput.placeholder = this.janeResponses[this.currentLanguage].recognition.defaultPlaceholder;
                    };
                }

                if (this.microphoneButton.classList.contains('active')) {
                    this.recognition.stop();
                    this.microphoneButton.classList.remove('active');
                    this.journalInput.placeholder = this.janeResponses[this.currentLanguage].recognition.defaultPlaceholder;
                } else {
                    this.recognition.start();
                    this.microphoneButton.classList.add('active');
                    this.journalInput.placeholder = this.janeResponses[this.currentLanguage].recognition.listeningPlaceholder;
                }
            } else {
                alert(this.janeResponses[this.currentLanguage].recognition.notSupported);
                this.microphoneButton.disabled = true;
            }
        }

        // --- GESTION DES OPTIONS INTERACTIVES ---
        showMainOptions() {
            this.janeOptionsContainer.innerHTML = '';
            this.currentOptionActive = null;
            this.optionStep = 0;

            const options = this.janeResponses[this.currentLanguage].options.main;
            options.forEach(option => {
                const button = document.createElement('button');
                button.classList.add('jane-option-button');
                button.textContent = option.text;
                button.dataset.optionId = option.id;
                this.janeOptionsContainer.appendChild(button);
            });
            this.janeOptionsContainer.classList.remove('hidden');
        }

        handleOptionSelection(optionId) {
            const option = this.janeResponses[this.currentLanguage].options.main.find(o => o.id === optionId);
            if (option) {
                this.addMessage(option.text, 'user'); // Affiche le choix de l'utilisateur
                this.conversationHistory.push({ sender: 'user', message: option.text, timestamp: new Date().toISOString() });
                this.saveAllUserData();

                this.currentOptionActive = optionId;
                this.optionStep = 0; // Réinitialise l'étape pour le dialogue
                this.janeOptionsContainer.classList.add('hidden'); // Cache les options principales
                this.handleOptionResponse(''); // Lance la première réponse de l'option
            }
        }

        handleOptionResponse(userMessage) {
            const optionDialogue = this.janeResponses[this.currentLanguage].options.dialogues[this.currentOptionActive];
            if (optionDialogue && this.optionStep < optionDialogue.length) {
                const step = optionDialogue[this.optionStep];

                if (step.type === 'response') {
                    this.addMessage(step.text, 'jane');
                    this.conversationHistory.push({ sender: 'jane', message: step.text, timestamp: new Date().toISOString() });
                    this.saveAllUserData();
                    this.optionStep++;
                    // Si c'est une simple réponse, avance au dialogue suivant ou termine
                    if (this.optionStep < optionDialogue.length) {
                        setTimeout(() => this.handleOptionResponse(''), 1000); // Prochaine étape du dialogue
                    } else {
                        setTimeout(() => this.showMainOptions(), 1500); // Retour aux options principales
                    }
                } else if (step.type === 'input_prompt') {
                    // Pour l'instant, on se contente de demander un input, l'IA le gérera dans le mode libre
                    this.addMessage(step.text, 'jane');
                    this.conversationHistory.push({ sender: 'jane', message: step.text, timestamp: new Date().toISOString() });
                    this.saveAllUserData();
                    this.optionStep++;
                    // Le dialogue s'interrompt ici en attendant l'entrée de l'utilisateur
                    // Après l'entrée de l'utilisateur, handleSendMessage sera appelé, qui gérera l'IA
                    // La logique de reprise du dialogue d'option doit être gérée par l'IA si elle est contextuelle
                    // Ou simplement retourner aux options principales si c'est la fin du flow d'option
                    setTimeout(() => {
                        this.journalInput.focus();
                        this.currentOptionActive = null; // Désactive l'option pour la conversation libre
                        this.showMainOptions(); // Retourne aux options principales
                    }, 1000);
                } else if (step.type === 'options') {
                    this.janeOptionsContainer.innerHTML = '';
                    step.options.forEach(opt => {
                        const button = document.createElement('button');
                        button.classList.add('jane-option-button');
                        button.textContent = opt.text;
                        button.dataset.optionId = opt.id;
                        this.janeOptionsContainer.appendChild(button);
                    });
                    this.janeOptionsContainer.classList.remove('hidden');
                    // Gérer la sélection de ces sous-options
                    this.optionStep++; // Avance l'étape pour le prochain appel
                }
            } else {
                // Fin du dialogue d'option, revenir aux options principales
                this.currentOptionActive = null;
                this.optionStep = 0;
                this.showMainOptions();
            }
        }


        // --- Fonctions d'Intelligence et de Mémoire ---

        formatConversationHistoryForAI() {
            // Convertit l'historique de conversation du format local au format attendu par l'API OpenAI
            return this.conversationHistory.map(entry => {
                return {
                    role: entry.sender === 'user' ? 'user' : 'assistant',
                    content: entry.message
                };
            });
        }

        // --- CORE INTELLIGENCE DE JANE (via API OpenAI) ---
        async getJaneResponse(userMessage) {
            try {
                // Utilise la fonction utilitaire pour formater l'historique
                const formattedHistory = this.formatConversationHistoryForAI();

                // Ajoute le message actuel de l'utilisateur à l'historique formaté pour l'envoi
                // Note : le message de l'utilisateur est déjà dans this.conversationHistory à ce point
                // mais on le met à jour pour l'envoi à l'IA avec le bon format.
                const messagesToSend = [...formattedHistory, { role: 'user', content: userMessage }];

                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userMessage: userMessage, // Le message actuel de l'utilisateur
                        conversationHistory: messagesToSend // L'historique complet formaté
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Erreur du serveur IA: ${response.status} - ${errorData.error || response.statusText}`);
                }

                const data = await response.json();
                return data.reply; // La réponse de l'IA est dans `data.reply`

            } catch (error) {
                console.error('Erreur lors de la communication avec le chatbot :', error);
                // Retourne une réponse d'erreur par défaut ou spécifique si l'API échoue
                return this.janeResponses[this.currentLanguage].recognition.errorResponse || "Désolé, je n'ai pas pu générer de réponse pour le moment.";
            }
        }


        // --- GESTION DU CARNET SECRET ---
        loadJournalEntries() {
            this.currentUser.journalEntries = JSON.parse(localStorage.getItem(`journalEntries_${this.currentUser.username}`) || '{}');
        }

        saveJournalEntry() {
            const currentDate = this.currentDateDisplay.dataset.date; // Récupère la date affichée
            const entryText = this.journalEntryText.value.trim();

            if (!this.currentUser.journalEntries) {
                this.currentUser.journalEntries = {};
            }

            if (entryText) {
                this.currentUser.journalEntries[currentDate] = entryText;
                localStorage.setItem(`journalEntries_${this.currentUser.username}`, JSON.stringify(this.currentUser.journalEntries));
                alert(this.janeResponses[this.currentLanguage].secretJournal.entrySaved);
            } else {
                delete this.currentUser.journalEntries[currentDate]; // Supprime l'entrée si le texte est vide
                localStorage.setItem(`journalEntries_${this.currentUser.username}`, JSON.stringify(this.currentUser.journalEntries));
                alert(this.janeResponses[this.currentLanguage].secretJournal.entryCleared);
            }
            this.displayJournalEntriesByDate(); // Met à jour la liste des dates avec entrées
        }

        showSecretJournal() {
            this.journalApp.classList.add('hidden');
            this.secretJournalView.classList.remove('hidden');
            this.setCurrentJournalDate(new Date()); // Affiche la date du jour par défaut
            this.displayJournalEntriesByDate();
        }

        hideSecretJournal() {
            this.secretJournalView.classList.add('hidden');
            this.journalApp.classList.remove('hidden');
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight; // Scroll vers le bas
            this.journalInput.focus();
        }

        setCurrentJournalDate(date) {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0'); // Mois commence à 0
            const dd = String(date.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}-${mm}-${dd}`;

            this.currentDateDisplay.textContent = this.formatDateForDisplay(date, this.currentLanguage);
            this.currentDateDisplay.dataset.date = formattedDate; // Stocke la date formatée pour la sauvegarde
            this.journalEntryText.value = this.currentUser.journalEntries[formattedDate] || '';
            this.journalEntryText.focus();
        }

        navigateJournalDay(offset) {
            const currentDate = new Date(this.currentDateDisplay.dataset.date);
            currentDate.setDate(currentDate.getDate() + offset);
            this.setCurrentJournalDate(currentDate);
        }

        formatDateForDisplay(date, lang) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            if (lang === 'fr') {
                return date.toLocaleDateString('fr-FR', options);
            } else {
                return date.toLocaleDateString('en-US', options);
            }
        }

        displayJournalEntriesByDate() {
            this.journalEntriesContainer.innerHTML = '';
            const entries = this.currentUser.journalEntries || {};
            const dates = Object.keys(entries).sort((a, b) => new Date(b) - new Date(a)); // Tri descendant

            if (dates.length === 0) {
                this.journalEntriesContainer.innerHTML = `<p>${this.janeResponses[this.currentLanguage].secretJournal.noEntries}</p>`;
                return;
            }

            dates.forEach(dateStr => {
                const date = new Date(dateStr);
                const listItem = document.createElement('li');
                listItem.classList.add('journal-entry-item');

                const dateLink = document.createElement('a');
                dateLink.href = "#";
                dateLink.textContent = this.formatDateForDisplay(date, this.currentLanguage);
                dateLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.setCurrentJournalDate(date);
                });

                listItem.appendChild(dateLink);
                this.journalEntriesContainer.appendChild(listItem);
            });
        }

        // --- LOCALISATION ---
        loadJaneResponses() {
            // Vos réponses et textes localisés
            return {
                fr: {
                    auth: {
                        welcome: "Bienvenue sur Jane. Connectez-vous ou créez un compte.",
                        usernamePlaceholder: "Nom d'utilisateur",
                        pinPlaceholder: "PIN",
                        unlockButton: "Déverrouiller",
                        emptyFields: "Veuillez remplir tous les champs.",
                        invalidPin: "PIN incorrect. Veuillez réessayer."
                    },
                    recognition: {
                        defaultPlaceholder: "Écrivez votre pensée ou utilisez le micro...",
                        listeningPlaceholder: "J'écoute...",
                        error: "Désolé, je n'ai pas pu comprendre. Pouvez-vous répéter ?",
                        notSupported: "La reconnaissance vocale n'est pas supportée par votre navigateur.",
                        errorResponse: "Désolé, il y a eu un problème technique. Veuillez réessayer plus tard."
                    },
                    clearHistoryConfirmation: "Êtes-vous sûr de vouloir effacer tout l'historique de conversation avec Jane ?",
                    clearHistorySuccess: "Historique de conversation effacé.",
                    options: {
                        main: [
                            { id: 'gratitude', text: "Exprimer ma gratitude" },
                            { id: 'reflection', text: "Réfléchir à ma journée" },
                            { id: 'feeling', text: "Parler de mes émotions" },
                            { id: 'memory', text: "Me souvenir de quelque chose" }
                        ],
                        dialogues: {
                            gratitude: [
                                { type: 'response', text: "Merveilleux ! Exprimer sa gratitude est une excellente façon de cultiver le bonheur. Qu'est-ce qui vous a apporté de la joie aujourd'hui ?" },
                                { type: 'input_prompt', text: "Racontez-moi en quelques mots." }
                            ],
                            reflection: [
                                { type: 'response', text: "La réflexion est la clé de la croissance. Racontez-moi ce qui vous a marqué aujourd'hui. Y a-t-il eu un événement particulier ?" },
                                { type: 'input_prompt', text: "Partagez vos pensées." }
                            ],
                            feeling: [
                                { type: 'response', text: "Je suis là pour vous écouter. Comment vous sentez-vous en ce moment ? N'hésitez pas à exprimer ce qui est sur votre cœur." },
                                { type: 'input_prompt', text: "Décrivez vos émotions." }
                            ],
                            memory: [
                                { type: 'response', text: "Les souvenirs sont précieux. Y a-t-il un moment récent ou ancien que vous aimeriez vous remémorer ou partager ?" },
                                { type: 'input_prompt', text: "Racontez-moi ce souvenir." }
                            ]
                        }
                    },
                    secretJournal: {
                        entrySaved: "Entrée sauvegardée avec succès !",
                        entryCleared: "Entrée effacée.",
                        noEntries: "Aucune entrée pour le moment."
                    }
                },
                en: {
                    auth: {
                        welcome: "Welcome to Jane. Log in or create an account.",
                        usernamePlaceholder: "Username",
                        pinPlaceholder: "PIN",
                        unlockButton: "Unlock",
                        emptyFields: "Please fill in all fields.",
                        invalidPin: "Incorrect PIN. Please try again."
                    },
                    recognition: {
                        defaultPlaceholder: "Write your thoughts or use the mic...",
                        listeningPlaceholder: "Listening...",
                        error: "Sorry, I couldn't understand. Can you repeat?",
                        notSupported: "Speech recognition is not supported by your browser.",
                        errorResponse: "Sorry, there was a technical issue. Please try again later."
                    },
                    clearHistoryConfirmation: "Are you sure you want to clear all conversation history with Jane?",
                    clearHistorySuccess: "Conversation history cleared.",
                    options: {
                        main: [
                            { id: 'gratitude', text: "Express gratitude" },
                            { id: 'reflection', text: "Reflect on my day" },
                            { id: 'feeling', text: "Talk about my emotions" },
                            { id: 'memory', text: "Recall something" }
                        ],
                        dialogues: {
                            gratitude: [
                                { type: 'response', text: "Wonderful! Expressing gratitude is a great way to cultivate happiness. What brought you joy today?" },
                                { type: 'input_prompt', text: "Tell me in a few words." }
                            ],
                            reflection: [
                                { type: 'response', text: "Reflection is key to growth. Tell me what stood out to you today. Was there a particular event?" },
                                { type: 'input_prompt', text: "Share your thoughts." }
                            ],
                            feeling: [
                                { type: 'response', text: "I'm here to listen. How are you feeling right now? Feel free to express what's on your heart." },
                                { type: 'input_prompt', text: "Describe your emotions." }
                            ],
                            memory: [
                                { type: 'response', text: "Memories are precious. Is there a recent or old moment you'd like to recall or share?" },
                                { type: 'input_prompt', text: "Tell me about this memory." }
                            ]
                        }
                    },
                    secretJournal: {
                        entrySaved: "Entry saved successfully!",
                        entryCleared: "Entry cleared.",
                        noEntries: "No entries yet."
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
            this.journalInput.placeholder = this.janeResponses[this.currentLanguage].recognition.defaultPlaceholder;
        }
    }

    // Initialisation de l'application
    new JaneJournal();
});
