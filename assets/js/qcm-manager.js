// Gestionnaire principal du QCM
class QCMManager {
    constructor() {
        this.currentSession = null;
        this.isActive = false;
        this.questionCount = 0;
        this.maxQuestions = CONFIG.MAX_QUESTIONS_PER_SESSION;
        this.currentCategory = null;
        this.sessionStartTime = null;
    }

    // Initialisation du gestionnaire
    async init() {
        try {
            console.log('🎯 Initialisation QCM Manager...');
            
            // Vérification de la session existante
            await this.checkExistingSession();
            
            // Initialisation des clients
            await Promise.all([
                window.supabaseClient.init(),
                window.geminiClient.init()
            ]);

            console.log('✅ QCM Manager initialisé');
        } catch (error) {
            console.error('❌ Erreur initialisation QCM Manager:', error);
            throw error;
        }
    }

    // Vérification d'une session existante
    async checkExistingSession() {
        const sessionId = localStorage.getItem(CONFIG.STORAGE_KEYS.sessionId);
        const email = localStorage.getItem(CONFIG.STORAGE_KEYS.userEmail);
        
        if (sessionId && email) {
            // Vérification de la validité de la session
            if (window.supabaseClient.isSessionValid()) {
                this.currentSession = sessionId;
                this.questionCount = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.questionCount) || '0');
                this.sessionStartTime = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.sessionStartTime));
                
                console.log('📋 Session existante trouvée:', sessionId);
                return true;
            } else {
                // Session expirée
                await this.clearSession();
            }
        }
        
        return false;
    }

    // Démarrage d'une nouvelle session
    async startSession(email, consentGiven) {
        try {
            console.log('🚀 Démarrage nouvelle session pour:', email);

            // Vérification si l'email existe déjà
            const existingSession = await window.supabaseClient.checkEmailExists(email);
            
            if (existingSession && existingSession.is_completed) {
                throw new Error('Vous avez déjà complété ce questionnaire avec cet email.');
            }
            
            if (existingSession && !existingSession.is_completed) {
                // Reprise de session existante
                this.currentSession = existingSession.session_id;
                this.questionCount = existingSession.questions_count;
                
                localStorage.setItem(CONFIG.STORAGE_KEYS.sessionId, existingSession.session_id);
                localStorage.setItem(CONFIG.STORAGE_KEYS.userEmail, email);
                localStorage.setItem(CONFIG.STORAGE_KEYS.questionCount, existingSession.questions_count.toString());
                
                console.log('📋 Reprise session existante:', existingSession.session_id);
            } else {
                // Création nouvelle session
                const sessionId = await window.supabaseClient.createSession(email, consentGiven);
                this.currentSession = sessionId;
                this.questionCount = 0;
                this.sessionStartTime = Date.now();
            }

            this.isActive = true;
            
            // Démarrage de la conversation
            await this.startConversation();
            
            return this.currentSession;
            
        } catch (error) {
            console.error('❌ Erreur démarrage session:', error);
            throw error;
        }
    }

    // Début de la conversation
    async startConversation() {
        try {
            const welcomeMessage = this.getPersonalizedWelcomeMessage();
            
            // Ajout du message de bienvenue
            window.uiManager.addBotMessage(welcomeMessage);
            
            // Première question intelligente
            await this.askNextIntelligentQuestion();
            
        } catch (error) {
            console.error('❌ Erreur démarrage conversation:', error);
            window.uiManager.addBotMessage(CONFIG.SYSTEM_MESSAGES.error);
        }
    }

    // Message de bienvenue personnalisé
    getPersonalizedWelcomeMessage() {
        const email = localStorage.getItem(CONFIG.STORAGE_KEYS.userEmail);
        const firstName = email ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : 'cher utilisateur';
        
        return `Parfait ${firstName} ! Je vais vous poser quelques questions pour mieux comprendre vos besoins. N'hésitez pas à détailler vos réponses, c'est très précieux pour nous. Commençons !`;
    }

    // Poser la prochaine question intelligente
    async askNextIntelligentQuestion() {
        try {
            if (this.questionCount >= this.maxQuestions) {
                await this.completeSession();
                return;
            }

            // Sélection intelligente de la catégorie
            const nextCategory = this.selectNextCategory();
            this.currentCategory = nextCategory;
            
            // Génération d'une question contextuelle
            const contextPrompt = this.buildContextPrompt(nextCategory);
            
            const response = await window.geminiClient.sendMessage(
                `Pose une question de la catégorie "${nextCategory}" en tenant compte du contexte précédent. ${contextPrompt}`,
                nextCategory
            );

            window.uiManager.addBotMessage(response.message, response.suggestedQuestions);
            
        } catch (error) {
            console.error('❌ Erreur génération question:', error);
            window.uiManager.addBotMessage(CONFIG.SYSTEM_MESSAGES.error);
        }
    }

    // Sélection intelligente de la prochaine catégorie
    selectNextCategory() {
        const stats = window.geminiClient.getConversationStats();
        const categoriesCovered = stats.categoriesCovered;
        const allCategories = Object.keys(CONFIG.QUESTION_CATEGORIES);
        
        // Si moins de 3 questions, prioriser démographie
        if (this.questionCount < 3 && !categoriesCovered.includes('demographie')) {
            return 'demographie';
        }
        
        // Si moins de 6 questions, prioriser besoins
        if (this.questionCount < 6 && !categoriesCovered.includes('besoins')) {
            return 'besoins';
        }
        
        // Après 6 questions, diversifier avec usage et feedback
        const remainingCategories = allCategories.filter(cat => !categoriesCovered.includes(cat));
        
        if (remainingCategories.length > 0) {
            return remainingCategories[Math.floor(Math.random() * remainingCategories.length)];
        }
        
        // Si toutes les catégories sont couvertes, revenir aux besoins (le plus important)
        return 'besoins';
    }

    // Construction du prompt contextuel
    buildContextPrompt(category) {
        const categoryInfo = CONFIG.QUESTION_CATEGORIES[category];
        const questionNumber = this.questionCount + 1;
        
        return `Catégorie: ${categoryInfo.name}. Question ${questionNumber}/${this.maxQuestions}. Reste naturel et conversationnel.`;
    }

    // Traitement d'une réponse utilisateur
    async processUserResponse(userMessage) {
        try {
            if (!this.isActive) {
                throw new Error('Session non active');
            }

            if (this.questionCount >= this.maxQuestions) {
                window.uiManager.addBotMessage(CONFIG.SYSTEM_MESSAGES.maxQuestionsReached);
                await this.completeSession();
                return;
            }

            // Sauvegarde de la réponse
            await this.saveCurrentResponse(userMessage);

            // Incrémentation du compteur
            this.questionCount++;
            localStorage.setItem(CONFIG.STORAGE_KEYS.questionCount, this.questionCount.toString());

            // Mise à jour de la barre de progression
            window.uiManager.updateProgress(this.questionCount, this.maxQuestions);

            // Analyse de la réponse pour déterminer le suivi
            const needsFollowUp = this.analyzeResponseForFollowUp(userMessage);

            if (needsFollowUp && this.questionCount < this.maxQuestions) {
                // Question de suivi dans la même catégorie
                await this.askFollowUpQuestion(userMessage);
            } else {
                // Prochaine question
                await this.askNextIntelligentQuestion();
            }

        } catch (error) {
            console.error('❌ Erreur traitement réponse:', error);
            window.uiManager.addBotMessage(CONFIG.SYSTEM_MESSAGES.error);
        }
    }

    // Sauvegarde de la réponse actuelle
    async saveCurrentResponse(userMessage) {
        try {
            const lastBotMessage = window.uiManager.getLastBotMessage();
            
            await window.supabaseClient.saveQuestionAnswer(
                lastBotMessage,
                userMessage,
                this.currentCategory
            );
            
            console.log('💾 Réponse sauvegardée:', this.currentCategory);
        } catch (error) {
            console.error('❌ Erreur sauvegarde réponse:', error);
            // Ne pas interrompre le flux pour une erreur de sauvegarde
        }
    }

    // Analyse si une réponse nécessite un suivi
    analyzeResponseForFollowUp(response) {
        // Réponses trop courtes
        if (response.trim().length < 15) return true;
        
        // Réponses vagues
        const vagueResponses = ['oui', 'non', 'peut-être', 'je ne sais pas', 'normal', 'bien', 'ok'];
        const isVague = vagueResponses.some(vague => 
            response.toLowerCase().trim() === vague
        );
        
        if (isVague) return true;
        
        // Réponses qui mentionnent "autre" ou "différent"
        const needsElaborationKeywords = ['autre', 'différent', 'dépend', 'compliqué'];
        const needsElaboration = needsElaborationKeywords.some(keyword =>
            response.toLowerCase().includes(keyword)
        );
        
        return needsElaboration && this.questionCount < this.maxQuestions - 2; // Garde de la place pour autres catégories
    }

    // Question de suivi
    async askFollowUpQuestion(previousResponse) {
        try {
            const followUpPrompt = `L'utilisateur a répondu: "${previousResponse}". Pose une question de suivi courte pour approfondir cette réponse dans la catégorie ${this.currentCategory}.`;
            
            const response = await window.geminiClient.sendMessage(followUpPrompt, this.currentCategory);
            window.uiManager.addBotMessage(response.message);
            
        } catch (error) {
            console.error('❌ Erreur question de suivi:', error);
            // Continuer avec la prochaine question normale
            await this.askNextIntelligentQuestion();
        }
    }

    // Finalisation de la session
    async completeSession() {
        try {
            this.isActive = false;
            
            // Message de remerciement personnalisé
            const thanksMessage = this.generateThanksMessage();
            window.uiManager.addBotMessage(thanksMessage);
            
            // Marquer la session comme complétée
            await window.supabaseClient.completeSession();
            
            // Désactiver l'interface de saisie
            window.uiManager.disableInput('Session terminée - Merci pour vos réponses !');
            
            // Afficher les statistiques finales
            setTimeout(() => {
                this.showSessionSummary();
            }, 2000);
            
            console.log('✅ Session complétée');
            
        } catch (error) {
            console.error('❌ Erreur finalisation session:', error);
        }
    }

    // Message de remerciement personnalisé
    generateThanksMessage() {
        const stats = window.geminiClient.getConversationStats();
        const categoriesCount = stats.categoriesCovered.length;
        
        return `Merci beaucoup pour vos ${this.questionCount} réponses détaillées ! Nous avons couvert ${categoriesCount} aspects importants. Vos retours sont précieux pour améliorer nos services. 🙏`;
    }

    // Affichage du résumé de session
    showSessionSummary() {
        const stats = window.geminiClient.getConversationStats();
        const sessionDuration = Math.round((Date.now() - this.sessionStartTime) / 1000 / 60); // en minutes
        
        const summaryMessage = `📊 Résumé de votre session :
• ${stats.totalExchanges} questions répondues
• ${stats.categoriesCovered.length} catégories couvertes
• Durée : ${sessionDuration} minutes
• Moyenne : ${Math.round(stats.averageMessageLength)} caractères par réponse

Nous analyserons vos retours pour améliorer notre offre. À bientôt ! 👋`;

        window.uiManager.addBotMessage(summaryMessage);
    }

    // Nettoyage de la session
    async clearSession() {
        this.currentSession = null;
        this.isActive = false;
        this.questionCount = 0;
        this.currentCategory = null;
        this.sessionStartTime = null;
        
        window.supabaseClient.clearLocalSession();
        window.geminiClient.clearConversationHistory();
        
        console.log('🧹 Session nettoyée');
    }

    // Gestion d'urgence en cas d'erreur
    async handleEmergencyStop(errorMessage) {
        try {
            console.error('🚨 Arrêt d\'urgence du QCM:', errorMessage);
            
            // Sauvegarde d'urgence si possible
            if (this.currentSession) {
                await window.supabaseClient.completeSession(errorMessage);
            }
            
            this.isActive = false;
            window.uiManager.addBotMessage(
                'Je suis désolé, une erreur technique s\'est produite. Vos réponses ont été sauvegardées. Veuillez recharger la page pour recommencer.'
            );
            window.uiManager.disableInput('Erreur technique');
            
        } catch (error) {
            console.error('❌ Erreur pendant l\'arrêt d\'urgence:', error);
        }
    }

    // Getters pour l'état actuel
    getSessionInfo() {
        return {
            sessionId: this.currentSession,
            isActive: this.isActive,
            questionCount: this.questionCount,
            maxQuestions: this.maxQuestions,
            currentCategory: this.currentCategory,
            sessionStartTime: this.sessionStartTime,
            email: localStorage.getItem(CONFIG.STORAGE_KEYS.userEmail)
        };
    }
}

// Instance globale
window.qcmManager = new QCMManager();