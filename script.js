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

            // Éléments de l'application principale
            this.usernameDisplay = document.getElementById('username-display');
            this.messagesContainer = document.getElementById('messages-container');
            this.journalInput = document.getElementById('journal-input');
            this.sendButton = document.getElementById('send-button');
            this.microphoneButton = document.getElementById('microphone-button');
            this.clearHistoryButton = document.getElementById('clear-history-button');
            this.logoutButton = document.getElementById('logout-button');
            this.secretJournalButton = document.getElementById('secret-journal-button');
            this.janeOptionsDiv = document.getElementById('jane-options');
            this.languageSelect = document.getElementById('language-select');

            // Éléments du journal secret
            this.secretJournalView = document.getElementById('secret-journal-view');
            this.backToJournalButton = document.getElementById('back-to-journal-button');
            this.journalEntryText = document.getElementById('journal-entry-text');
            this.saveEntryButton = document.getElementById('save-entry-button');
            this.journalEntriesContainer = document.getElementById('journal-entries-container');
            this.prevDayButton = document.getElementById('prev-day-button');
            this.nextDayButton = document.getElementById('next-day-button');
            this.currentDateDisplay = document.getElementById('current-date-display');
        }

        initEvents() {
            this.unlockButton.addEventListener('click', () => this.handleAuth());
            this.usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleAuth();
            });
            this.pinInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleAuth();
            });

            this.sendButton.addEventListener('click', () => this.sendMessage());
            this.journalInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            this.journalInput.addEventListener('input', () => {
                this.journalInput.style.height = 'auto';
                this.journalInput.style.height = this.journalInput.scrollHeight + 'px';
            });


            this.microphoneButton.addEventListener('click', () => this.toggleSpeechRecognition());
            this.clearHistoryButton.addEventListener('click', () => this.clearConversationHistory());
            this.logoutButton.addEventListener('click', () => this.logout());
            this.secretJournalButton.addEventListener('click', () => this.showSecretJournal());
            this.backToJournalButton.addEventListener('click', () => this.hideSecretJournal());
            this.saveEntryButton.addEventListener('click', () => this.saveJournalEntry());
            this.prevDayButton.addEventListener('click', () => this.changeJournalDate(-1));
            this.nextDayButton.addEventListener('click', () => this.changeJournalDate(1));
            this.languageSelect.addEventListener('change', (e) => this.changeLanguage(e.target.value));

            this.journalEntriesContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' && e.target.closest('.journal-entry-item')) {
                    e.preventDefault();
                    const date = e.target.dataset.date;
                    this.loadJournalEntryForDate(date);
                }
            });
        }

        loadJaneResponses() {
            // Définition de toutes les réponses et messages de Jane, localisés
            return {
                fr: {
                    auth: {
                        welcome: "Bienvenue sur Jane. Connectez-vous ou créez un compte.",
                        usernamePlaceholder: "Nom d'utilisateur",
                        pinPlaceholder: "PIN",
                        unlockButton: "Déverrouiller",
                        invalidCredentials: "Nom d'utilisateur ou PIN incorrect."
                    },
                    journal: {
                        welcomeMessage: "Bonjour [NomUtilisateur] ! Je suis Jane, votre journal intime IA. N'hésitez pas à me confier vos pensées.",
                        clearHistoryConfirm: "Es-tu sûr(e) de vouloir effacer toute notre conversation ? Cela ne supprimera pas tes entrées de journal secret.",
                        clearedHistory: "D'accord, l'historique de notre conversation a été effacé.",
                        logoutConfirm: "Es-tu sûr(e) de vouloir te déconnecter ?",
                        loggedOut: "Déconnecté. À bientôt !",
                        typingIndicator: "Jane est en train de réfléchir...",
                        secretJournalTitle: "Journal Secret",
                        secretJournalPlaceholder: "Écrivez vos pensées secrètes ici...",
                        saveButton: "Sauvegarder",
                        entrySaved: "Entrée sauvegardée avec succès !",
                        noEntries: "Aucune entrée pour ce jour.",
                        selectDate: "Sélectionnez une date pour voir ou ajouter une entrée."
                    },
                    recognition: {
                        defaultPlaceholder: "Écrivez votre pensée ou utilisez le micro...",
                        listening: "J'écoute...",
                        speechError: "Désolé, je n'ai pas compris. Peux-tu répéter ?",
                        errorResponse: "Désolé, il y a eu un problème technique. Veuillez réessayer plus tard."
                    },
                    options: {
                        initial: {
                            prompt: "Comment puis-je t'aider aujourd'hui ?",
                            options: [
                                { text: "Parle-moi de mes émotions", action: "emotions" },
                                { text: "Donne-moi des conseils", action: "advice" },
                                { text: "Je veux juste discuter", action: "chat" }
                            ]
                        },
                        emotions: {
                            prompt: "Dis-moi ce qui te préoccupe. Je suis là pour écouter sans jugement.",
                            options: [
                                { text: "Je me sens triste", action: "sad" },
                                { text: "Je suis stressé(e)", action: "stressed" },
                                { text: "Je suis en colère", action: "angry" },
                                { text: "Autre...", action: "other_emotion" },
                                { text: "Retour", action: "back" }
                            ]
                        },
                        sad: {
                            prompt: "Je comprends que tu te sentes triste. Parfois, en parler aide. Qu'est-ce qui te rend triste ?",
                            options: [{ text: "J'ai besoin de réconfort", action: "comfort_sad" }, { text: "Que puis-je faire ?", action: "action_sad" }, { text: "Retour", action: "back" }]
                        },
                        stressed: {
                            prompt: "Le stress est lourd à porter. Quelle est la source de ton stress ?",
                            options: [{ text: "Aide à gérer le stress", action: "manage_stress" }, { text: "Relaxation", action: "relax" }, { text: "Retour", action: "back" }]
                        },
                        angry: {
                            prompt: "La colère est une émotion puissante. Qu'est-ce qui te met en colère ?",
                            options: [{ text: "Comment gérer ma colère ?", action: "manage_anger" }, { text: "Exprime-toi", action: "express_anger" }, { text: "Retour", action: "back" }]
                        },
                        other_emotion: {
                            prompt: "Toutes les émotions sont valides. Décris-moi ce que tu ressens.",
                            options: [{ text: "Retour", action: "back" }]
                        },
                        comfort_sad: {
                            prompt: "Je suis là pour toi. Souviens-toi que tes sentiments sont valides et que tu es fort(e). Concentre-toi sur de petits plaisirs aujourd'hui.",
                            options: [{ text: "Merci Jane", action: "thanks_jane" }, { text: "Autre conseil", action: "another_advice_sad" }, { text: "Retour", action: "back" }]
                        },
                        action_sad: {
                            prompt: "Parfois, une petite action peut aider. Essaye de faire une courte promenade, écouter de la musique apaisante, ou écrire ce que tu ressens.",
                            options: [{ text: "Merci Jane", action: "thanks_jane" }, { text: "Autre conseil", action: "another_advice_sad" }, { text: "Retour", action: "back" }]
                        },
                        manage_stress: {
                            prompt: "La respiration profonde est une technique simple et efficace. Inspire lentement par le nez, retiens quelques secondes, puis expire lentement par la bouche.",
                            options: [{ text: "Autre technique", action: "another_stress_tech" }, { text: "Retour", action: "back" }]
                        },
                        relax: {
                            prompt: "Imagine un endroit calme et paisible. Concentre-toi sur les détails : les sons, les odeurs, les sensations. Laisse la tension s'échapper.",
                            options: [{ text: "Autre technique", action: "another_relax_tech" }, { text: "Retour", action: "back" }]
                        },
                        manage_anger: {
                            prompt: "Quand la colère monte, prends une pause. Éloigne-toi de la situation, respire profondément, et essaie de voir la situation sous un autre angle.",
                            options: [{ text: "Autre technique", action: "another_anger_tech" }, { text: "Retour", action: "back" }]
                        },
                        express_anger: {
                            prompt: "Écrire tes pensées peut être très libérateur. Décris tout ce qui te met en colère sans filtre. Cela peut t'aider à y voir plus clair.",
                            options: [{ text: "Autre technique", action: "another_express_anger_tech" }, { text: "Retour", action: "back" }]
                        },
                        advice: {
                            prompt: "Dans quel domaine souhaites-tu des conseils ?",
                            options: [
                                { text: "Bien-être", action: "wellness_advice" },
                                { text: "Productivité", action: "productivity_advice" },
                                { text: "Relations", action: "relations_advice" },
                                { text: "Retour", action: "back" }
                            ]
                        },
                        chat: {
                            prompt: "Super ! Je suis là pour discuter de tout ce que tu veux. Pose-moi une question ou raconte-moi ta journée !",
                            options: [{ text: "Retour", action: "back" }]
                        },
                        // Réponses génériques pour les retours
                        thanks_jane: {
                            prompt: "De rien ! Je suis là pour ça.",
                            options: [{ text: "Autre chose ?", action: "initial" }]
                        },
                        another_advice_sad: {
                            prompt: "Un autre conseil pour la tristesse ? Écoute ta chanson préférée, ou regarde une vidéo qui te fait rire.",
                            options: [{ text: "Merci Jane", action: "thanks_jane" }, { text: "Retour", action: "back" }]
                        },
                        another_stress_tech: {
                            prompt: "Pour le stress, essaye de te déconnecter pendant 15 minutes. Fais quelque chose que tu aimes : lire, dessiner, écouter de la musique.",
                            options: [{ text: "Retour", action: "back" }]
                        },
                        another_relax_tech: {
                            prompt: "Une autre technique de relaxation est la méditation guidée. Il existe de nombreuses applications ou vidéos gratuites qui peuvent t'aider.",
                            options: [{ text: "Retour", action: "back" }]
                        },
                        another_anger_tech: {
                            prompt: "Pour la colère, essaie de faire de l'exercice physique. Cela peut aider à libérer l'énergie et la tension accumulées.",
                            options: [{ text: "Retour", action: "back" }]
                        },
                        another_express_anger_tech: {
                            prompt: "Si tu as du mal à exprimer ta colère, dessine-la, ou trouve une activité créative qui te permette de canaliser cette énergie.",
                            options: [{ text: "Retour", action: "back" }]
                        },
                        wellness_advice: {
                            prompt: "Le bien-être passe par le sommeil, l'alimentation et l'activité physique. Assure-toi d'avoir un bon équilibre dans ces trois domaines.",
                            options: [{ text: "Retour", action: "back" }]
                        },
                        productivity_advice: {
                            prompt: "La technique Pomodoro peut t'aider : travaille par périodes de 25 minutes, suivies de 5 minutes de pause. Cela améliore la concentration.",
                            options: [{ text: "Retour", action: "back" }]
                        },
                        relations_advice: {
                            prompt: "Pour de meilleures relations, pratique l'écoute active : écoute vraiment ce que l'autre dit, sans interrompre et sans juger.",
                            options: [{ text: "Retour", action: "back" }]
                        },
                        back: { // Nouvelle action générique pour "Retour"
                            prompt: "D'accord, que veux-tu faire d'autre ?",
                            options: [
                                { text: "Parle-moi de mes émotions", action: "emotions" },
                                { text: "Donne-moi des conseils", action: "advice" },
                                { text: "Je veux juste discuter", action: "chat" }
                            ]
                        }
                    }
                },
                en: {
                    auth: {
                        welcome: "Welcome to Jane. Log in or create an account.",
                        usernamePlaceholder: "Username",
                        pinPlaceholder: "PIN",
                        unlockButton: "Unlock",
                        invalidCredentials: "Incorrect username or PIN."
                    },
                    journal: {
                        welcomeMessage: "Hello [Username]! I'm Jane, your AI diary. Feel free to confide in me.",
                        clearHistoryConfirm: "Are you sure you want to clear our entire conversation? This will not delete your secret journal entries.",
                        clearedHistory: "Okay, our conversation history has been cleared.",
                        logoutConfirm: "Are you sure you want to log out?",
                        loggedOut: "Logged out. See you soon!",
                        typingIndicator: "Jane is thinking...",
                        secretJournalTitle: "Secret Journal",
                        secretJournalPlaceholder: "Write your secret thoughts here...",
                        saveButton: "Save",
                        entrySaved: "Entry saved successfully!",
                        noEntries: "No entries for this day.",
                        selectDate: "Select a date to view or add an entry."
                    },
                    recognition: {
                        defaultPlaceholder: "Write your thought or use the mic...",
                        listening: "Listening...",
                        speechError: "Sorry, I didn't understand. Can you repeat?",
                        errorResponse: "Sorry, there was a technical problem. Please try again later."
                    },
                    options: {
                        initial: {
                            prompt: "How can I help you today?",
                            options: [
                                { text: "Tell me about my emotions", action: "emotions" },
                                { text: "Give me some advice", action: "advice" },
                                { text: "I just want to chat", action: "chat" }
                            ]
                        },
                        emotions: {
                            prompt: "Tell me what's bothering you. I'm here to listen without judgment.",
                            options: [
                                { text: "I feel sad", action: "sad" },
                                { text: "I'm stressed", action: "stressed" },
                                { text: "I'm angry", action: "angry" },
                                { text: "Other...", action: "other_emotion" },
                                { text: "Back", action: "back" }
                            ]
                        },
                        sad: {
                            prompt: "I understand you feel sad. Sometimes, talking about it helps. What makes you sad?",
                            options: [{ text: "I need comfort", action: "comfort_sad" }, { text: "What can I do?", action: "action_sad" }, { text: "Back", action: "back" }]
                        },
                        stressed: {
                            prompt: "Stress is heavy to carry. What is the source of your stress?",
                            options: [{ text: "Help manage stress", action: "manage_stress" }, { text: "Relaxation", action: "relax" }, { text: "Back", action: "back" }]
                        },
                        angry: {
                            prompt: "Anger is a powerful emotion. What makes you angry?",
                            options: [{ text: "How to manage my anger?", action: "manage_anger" }, { text: "Express yourself", action: "express_anger" }, { text: "Back", action: "back" }]
                        },
                        other_emotion: {
                            prompt: "All emotions are valid. Describe to me what you're feeling.",
                            options: [{ text: "Back", action: "back" }]
                        },
                        comfort_sad: {
                            prompt: "I'm here for you. Remember that your feelings are valid and you are strong. Focus on small pleasures today.",
                            options: [{ text: "Thank you Jane", action: "thanks_jane" }, { text: "Another tip", action: "another_advice_sad" }, { text: "Back", action: "back" }]
                        },
                        action_sad: {
                            prompt: "Sometimes, a small action can help. Try taking a short walk, listening to soothing music, or writing down what you feel.",
                            options: [{ text: "Thank you Jane", action: "thanks_jane" }, { text: "Another tip", action: "another_advice_sad" }, { text: "Back", action: "back" }]
                        },
                        manage_stress: {
                            prompt: "Deep breathing is a simple and effective technique. Inhale slowly through your nose, hold for a few seconds, then exhale slowly through your mouth.",
                            options: [{ text: "Another technique", action: "another_stress_tech" }, { text: "Back", action: "back" }]
                        },
                        relax: {
                            prompt: "Imagine a calm and peaceful place. Focus on the details: sounds, smells, sensations. Let the tension escape.",
                            options: [{ text: "Another technique", action: "another_relax_tech" }, { text: "Back", action: "back" }]
                        },
                        manage_anger: {
                            prompt: "When anger rises, take a break. Step away from the situation, breathe deeply, and try to see the situation from another perspective.",
                            options: [{ text: "Another technique", action: "another_anger_tech" }, { text: "Back", action: "back" }]
                        },
                        express_anger: {
                            prompt: "Writing down your thoughts can be very liberating. Describe everything that makes you angry without filter. This can help you gain clarity.",
                            options: [{ text: "Another technique", action: "another_express_anger_tech" }, { text: "Back", action: "back" }]
                        },
                        advice: {
                            prompt: "In what area do you need advice?",
                            options: [
                                { text: "Well-being", action: "wellness_advice" },
                                { text: "Productivity", action: "productivity_advice" },
                                { text: "Relationships", action: "relations_advice" },
                                { text: "Back", action: "back" }
                            ]
                        },
                        chat: {
                            prompt: "Great! I'm here to chat about anything you want. Ask me a question or tell me about your day!",
                            options: [{ text: "Back", action: "back" }]
                        },
                        // Generic responses for going back
                        thanks_jane: {
                            prompt: "You're welcome! That's what I'm here for.",
                            options: [{ text: "Anything else?", action: "initial" }]
                        },
                        another_advice_sad: {
                            prompt: "Another tip for sadness? Listen to your favorite song, or watch a video that makes you laugh.",
                            options: [{ text: "Thank you Jane", action: "thanks_jane" }, { text: "Back", action: "back" }]
                        },
                        another_stress_tech: {
                            prompt: "For stress, try to disconnect for 15 minutes. Do something you enjoy: read, draw, listen to music.",
                            options: [{ text: "Back", action: "back" }]
                        },
                        another_relax_tech: {
                            prompt: "Another relaxation technique is guided meditation. There are many free apps or videos that can help you.",
                            options: [{ text: "Back", action: "back" }]
                        },
                        another_anger_tech: {
                            prompt: "For anger, try physical exercise. It can help release accumulated energy and tension.",
                            options: [{ text: "Back", action: "back" }]
                        },
                        another_express_anger_tech: {
                            prompt: "If you struggle to express your anger, draw it, or find a creative activity that allows you to channel that energy.",
                            options: [{ text: "Back", action: "back" }]
                        },
                        wellness_advice: {
                            prompt: "Well-being involves sleep, diet, and physical activity. Make sure you have a good balance in these three areas.",
                            options: [{ text: "Back", action: "back" }]
                        },
                        productivity_advice: {
                            prompt: "The Pomodoro Technique can help: work in 25-minute periods, followed by 5-minute breaks. This improves concentration.",
                            options: [{ text: "Back", action: "back" }]
                        },
                        relations_advice: {
                            prompt: "For better relationships, practice active listening: truly listen to what the other person is saying, without interrupting or judging.",
                            options: [{ text: "Back", action: "back" }]
                        },
                        back: { // New generic action for "Back"
                            prompt: "Okay, what else would you like to do?",
                            options: [
                                { text: "Tell me about my emotions", action: "emotions" },
                                { text: "Give me some advice", action: "advice" },
                                { text: "I just want to chat", action: "chat" }
                            ]
                        }
                    }
                }
            };
        }

        // --- Authentification ---
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
            this.authMessage.textContent = this.janeResponses[this.currentLanguage].auth.welcome;
        }

        async handleAuth() {
            const username = this.usernameInput.value.trim();
            const pin = this.pinInput.value.trim();

            this.errorMessage.textContent = ''; // Clear previous error messages

            if (!username || !pin) {
                this.errorMessage.textContent = this.janeResponses[this.currentLanguage].auth.invalidCredentials;
                return;
            }

            const userIdentifier = `${username}:${pin}`;
            const users = JSON.parse(localStorage.getItem('users') || '{}');

            if (users[userIdentifier]) {
                // User exists, log in
                this.currentUser = { username: username, pin: pin };
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                this.showJournalApp();
            } else {
                // New user, create account
                users[userIdentifier] = {
                    conversationHistory: [],
                    secretJournalEntries: {}
                };
                localStorage.setItem('users', JSON.stringify(users));
                this.currentUser = { username: username, pin: pin };
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                this.showJournalApp();
                this.addJaneMessage(this.janeResponses[this.currentLanguage].journal.welcomeMessage.replace('[NomUtilisateur]', username));
            }
        }

        logout() {
            if (confirm(this.janeResponses[this.currentLanguage].journal.logoutConfirm)) {
                localStorage.removeItem('currentUser');
                this.currentUser = null;
                this.conversationHistory = []; // Efface l'historique de la session actuelle
                this.showAuthScreen();
                this.journalInput.value = ''; // Clear input field
                this.addJaneMessage(this.janeResponses[this.currentLanguage].journal.loggedOut);
            }
        }

        // --- Affichage et Messages ---
        showJournalApp() {
            this.authScreen.classList.add('hidden');
            this.journalApp.classList.remove('hidden');
            this.secretJournalView.classList.add('hidden');
            this.usernameDisplay.textContent = this.currentUser ? this.currentUser.username : 'Utilisateur';
            this.languageSelect.value = this.currentLanguage; // Set correct language in select
            this.loadConversationHistory();
            this.showMainOptions(); // Affiche les options initiales après connexion
        }

        addMessage(text, sender) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', `${sender}-message`);
            messageDiv.textContent = text;
            this.messagesContainer.appendChild(messageDiv);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight; // Scroll to bottom
        }

        addJaneMessage(text) {
            this.addMessage(text, 'jane');
            this.lastJaneResponse = text; // Mémorise la dernière réponse de Jane
        }

        addUserMessage(text) {
            this.addMessage(text, 'user');
        }

        // --- Envoi de Messages (IA) ---
        async sendMessage() {
            const userMessage = this.journalInput.value.trim();
            if (!userMessage) return;

            this.addUserMessage(userMessage);
            this.journalInput.value = ''; // Clear input immediately
            this.journalInput.style.height = 'auto'; // Reset height

            // Ajoute le message de l'utilisateur à l'historique de conversation
            this.conversationHistory.push({ sender: 'user', message: userMessage, timestamp: new Date().toISOString() });

            // Ajoute l'indicateur de réflexion
            const thinkingMsg = document.createElement('div');
            thinkingMsg.classList.add('message', 'jane-message', 'thinking-message');
            thinkingMsg.textContent = this.janeResponses[this.currentLanguage].journal.typingIndicator;
            this.messagesContainer.appendChild(thinkingMsg);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

            try {
                // Construire l'historique pour l'API OpenAI
                const messagesForApi = this.conversationHistory.map(entry => ({
                    role: entry.sender === 'user' ? 'user' : 'assistant',
                    content: entry.message
                }));

                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ messages: messagesForApi }),
                });

                const data = await response.json();

                if (response.ok) {
                    thinkingMsg.remove(); // Supprime les points de suspension
                    const janeReply = data.reply;
                    this.addJaneMessage(janeReply);
                    this.conversationHistory.push({ sender: 'jane', message: janeReply, timestamp: new Date().toISOString() });
                    this.saveAllUserData(); // Sauvegarde toutes les données (conversation et journal secret)
                    this.showMainOptions(); // Réaffiche les options après la réponse de l'IA
                } else {
                    throw new Error(data.message || 'Unknown error from API');
                }
            } catch (error) {
                console.error('Erreur lors de la communication avec le chatbot :', error);
                thinkingMsg.remove(); // Supprime les points de suspension même en cas d'erreur
                // Message d'erreur utilisateur
                const errorMessage = this.janeResponses[this.currentLanguage].recognition.errorResponse || "Désolé, il y a eu un problème technique. Veuillez réessayer plus tard.";
                this.addMessage(errorMessage, 'jane');
                this.conversationHistory.push({ sender: 'jane', message: errorMessage, timestamp: new Date().toISOString() });
                this.saveAllUserData();
            }
        }

        // --- Reconnaissance Vocale ---
        toggleSpeechRecognition() {
            if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
                if (!this.recognition) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    this.recognition = new SpeechRecognition();
                    this.recognition.continuous = false; // Arrête après chaque phrase
                    this.recognition.lang = this.currentLanguage === 'fr' ? 'fr-FR' : 'en-US';
                    this.recognition.interimResults = false;

                    this.recognition.onstart = () => {
                        this.journalInput.placeholder = this.janeResponses[this.currentLanguage].recognition.listening;
                        this.microphoneButton.classList.add('active');
                    };

                    this.recognition.onresult = (event) => {
                        const transcript = event.results[0][0].transcript;
                        this.journalInput.value = transcript;
                        this.sendMessage(); // Envoie le message dès que la reconnaissance est terminée
                    };

                    this.recognition.onerror = (event) => {
                        console.error('Speech recognition error:', event.error);
                        this.journalInput.placeholder = this.janeResponses[this.currentLanguage].recognition.defaultPlaceholder;
                        this.microphoneButton.classList.remove('active');
                        if (event.error !== 'no-speech') {
                            // N'affiche pas d'erreur si l'utilisateur n'a simplement rien dit
                            this.addJaneMessage(this.janeResponses[this.currentLanguage].recognition.speechError);
                        }
                    };

                    this.recognition.onend = () => {
                        this.journalInput.placeholder = this.janeResponses[this.currentLanguage].recognition.defaultPlaceholder;
                        this.microphoneButton.classList.remove('active');
                    };
                }

                if (this.microphoneButton.classList.contains('active')) {
                    this.recognition.stop();
                } else {
                    this.recognition.start();
                }
            } else {
                alert("Désolé, la reconnaissance vocale n'est pas prise en charge par votre navigateur.");
            }
        }

        // --- Gestion de l'historique et des données utilisateur ---
        saveAllUserData() {
            if (this.currentUser) {
                const users = JSON.parse(localStorage.getItem('users') || '{}');
                const userIdentifier = `${this.currentUser.username}:${this.currentUser.pin}`;
                if (users[userIdentifier]) {
                    users[userIdentifier].conversationHistory = this.conversationHistory;
                    // Assurez-vous que secretJournalEntries est également sauvegardé
                    // Si des modifications sont faites directement dans secretJournalView, elles doivent être sauvegardées avant d'appeler saveAllUserData
                    // Pour l'instant, on suppose que saveJournalEntry gère cela
                    localStorage.setItem('users', JSON.stringify(users));
                }
            }
        }


        loadConversationHistory() {
            this.messagesContainer.innerHTML = ''; // Clear current display
            if (this.currentUser) {
                const users = JSON.parse(localStorage.getItem('users') || '{}');
                const userIdentifier = `${this.currentUser.username}:${this.currentUser.pin}`;
                if (users[userIdentifier] && users[userIdentifier].conversationHistory) {
                    this.conversationHistory = users[userIdentifier].conversationHistory;
                    this.conversationHistory.forEach(msg => {
                        this.addMessage(msg.message, msg.sender);
                    });
                } else {
                    this.conversationHistory = [];
                    this.addJaneMessage(this.janeResponses[this.currentLanguage].journal.welcomeMessage.replace('[NomUtilisateur]', this.currentUser.username));
                }
            } else {
                this.conversationHistory = [];
            }
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight; // Scroll to bottom
        }

        clearConversationHistory() {
            if (confirm(this.janeResponses[this.currentLanguage].journal.clearHistoryConfirm)) {
                this.conversationHistory = [];
                this.messagesContainer.innerHTML = ''; // Clear display
                this.saveAllUserData(); // Save empty history
                this.addJaneMessage(this.janeResponses[this.currentLanguage].journal.clearedHistory);
                this.showMainOptions(); // Réaffiche les options
            }
        }

        // --- Journal Secret ---
        showSecretJournal() {
            this.journalApp.classList.add('hidden');
            this.secretJournalView.classList.remove('hidden');
            this.secretJournalView.querySelector('h2').textContent = this.janeResponses[this.currentLanguage].journal.secretJournalTitle;
            this.journalEntryText.placeholder = this.janeResponses[this.currentLanguage].journal.secretJournalPlaceholder;
            this.saveEntryButton.textContent = this.janeResponses[this.currentLanguage].journal.saveButton;
            this.journalEntryText.value = ''; // Clear text area for new entry
            this.currentDate = new Date(); // Set to current date initially
            this.displayJournalEntriesByDate();
            this.loadJournalEntryForDate(this.formatDate(this.currentDate)); // Load entry for current date
        }

        hideSecretJournal() {
            this.secretJournalView.classList.add('hidden');
            this.journalApp.classList.remove('hidden');
            this.showMainOptions(); // Réaffiche les options
        }

        formatDate(date) {
            return date.toLocaleDateString(this.currentLanguage === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        getJournalData() {
            const users = JSON.parse(localStorage.getItem('users') || '{}');
            const userIdentifier = `${this.currentUser.username}:${this.currentUser.pin}`;
            return users[userIdentifier]?.secretJournalEntries || {};
        }

        setJournalData(data) {
            const users = JSON.parse(localStorage.getItem('users') || '{}');
            const userIdentifier = `${this.currentUser.username}:${this.currentUser.pin}`;
            if (!users[userIdentifier]) {
                users[userIdentifier] = {};
            }
            users[userIdentifier].secretJournalEntries = data;
            localStorage.setItem('users', JSON.stringify(users));
        }


        loadJournalEntryForDate(dateString) {
            this.currentDateDisplay.textContent = dateString; // Update date display
            const journalData = this.getJournalData();
            this.journalEntryText.value = journalData[dateString] || '';
        }

        saveJournalEntry() {
            const dateString = this.formatDate(this.currentDate);
            const entryContent = this.journalEntryText.value.trim();
            const journalData = this.getJournalData();

            if (entryContent) {
                journalData[dateString] = entryContent;
            } else {
                delete journalData[dateString]; // Remove if empty
            }

            this.setJournalData(journalData);
            alert(this.janeResponses[this.currentLanguage].journal.entrySaved);
            this.displayJournalEntriesByDate(); // Refresh list of entries
        }

        changeJournalDate(offset) {
            this.currentDate.setDate(this.currentDate.getDate() + offset);
            const newDateString = this.formatDate(this.currentDate);
            this.loadJournalEntryForDate(newDateString);
        }

        displayJournalEntriesByDate() {
            this.journalEntriesContainer.innerHTML = '';
            const journalData = this.getJournalData();
            const sortedDates = Object.keys(journalData).sort((a, b) => new Date(b) - new Date(a)); // Sort descending

            if (sortedDates.length === 0) {
                const noEntriesItem = document.createElement('li');
                noEntriesItem.textContent = this.janeResponses[this.currentLanguage].journal.noEntries;
                this.journalEntriesContainer.appendChild(noEntriesItem);
                return;
            }

            sortedDates.forEach(dateString => {
                const listItem = document.createElement('li');
                listItem.classList.add('journal-entry-item');
                const link = document.createElement('a');
                link.href = '#';
                link.dataset.date = dateString;
                link.textContent = dateString;
                listItem.appendChild(link);
                this.journalEntriesContainer.appendChild(listItem);
            });
        }

        // --- Options Interactives de Jane ---
        showMainOptions() {
            this.janeOptionsDiv.innerHTML = ''; // Clear previous options
            this.janeOptionsDiv.classList.remove('hidden');
            this.optionStep = 0; // Reset pour revenir au début des options
            this.displayOptions('initial');
        }

        displayOptions(optionKey) {
            this.janeOptionsDiv.innerHTML = '';
            const currentOptions = this.janeResponses[this.currentLanguage].options[optionKey];
            if (!currentOptions) {
                console.error('Invalid option key:', optionKey);
                return;
            }

            // Ajoute la question de Jane pour les options
            this.addJaneMessage(currentOptions.prompt);

            currentOptions.options.forEach(option => {
                const button = document.createElement('button');
                button.classList.add('jane-option-button');
                button.textContent = option.text;
                button.dataset.action = option.action;
                button.addEventListener('click', () => this.handleOptionClick(option.action));
                this.janeOptionsDiv.appendChild(button);
            });
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }

        handleOptionClick(action) {
            // Pour les actions de "retour", on affiche l'étape précédente sans ajouter au chat
            if (action === "back") {
                this.displayOptions(this.getLastOptionKey()); // Remonte d'une étape logique
            } else {
                // Pour les autres actions, on ajoute la sélection de l'utilisateur au chat
                const selectedOptionText = event.target.textContent;
                this.addUserMessage(selectedOptionText);
                // Stocke l'action actuelle pour un éventuel suivi
                this.currentOptionActive = action;
                this.displayOptions(action); // Affiche les options liées à l'action
            }
        }

        // Simple fonction pour remonter d'une étape dans les options (peut être améliorée)
        getLastOptionKey() {
            const currentLanguageOptions = this.janeResponses[this.currentLanguage].options;
            // Logique simplifiée : toujours revenir à "initial" pour l'instant
            // Une implémentation plus robuste nécessiterait un suivi de l'historique des chemins d'options
            return 'initial';
        }

    }

    // Initialisation de l'application
    new JaneJournal();
});
