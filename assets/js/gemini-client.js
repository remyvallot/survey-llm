// Client pour communiquer avec l'API Gemini via le Cloudflare Worker
class GeminiClient {
    constructor() {
        this.workerUrl = CONFIG.CLOUDFLARE_WORKER_URL;
        this.conversationHistory = [];
        this.isInitialized = false;
    }

    // Initialisation du client
    async init() {
        try {
            if (!this.workerUrl || this.workerUrl.includes('your-worker')) {
                throw new Error('URL du Cloudflare Worker non configurée');
            }

            // Test de connexion
            await this.testConnection();
            this.isInitialized = true;
            
            // Chargement de l'historique local si disponible
            this.loadConversationHistory();
            
            console.log('✅ Client Gemini initialisé');
        } catch (error) {
            console.error('❌ Erreur initialisation Gemini Client:', error);
            throw error;
        }
    }

    // Test de connexion au worker
    async testConnection() {
        try {
            const response = await fetch(this.workerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.getSessionId()
                },
                body: JSON.stringify({
                    message: 'test connection',
                    conversationHistory: ''
                })
            });

            if (!response.ok) {
                throw new Error(`Worker unreachable: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('Test de connexion échoué:', error);
            throw new Error('Impossible de contacter le service IA');
        }
    }

    // Envoi d'un message à l'IA
    async sendMessage(userMessage, category = null) {
        try {
            if (!this.isInitialized) {
                await this.init();
            }

            // Validation du message
            if (!userMessage || userMessage.trim().length === 0) {
                throw new Error('Message vide');
            }

            if (userMessage.length > CONFIG.MAX_MESSAGE_LENGTH) {
                throw new Error(`Message trop long (max ${CONFIG.MAX_MESSAGE_LENGTH} caractères)`);
            }

            // Ajout du message utilisateur à l'historique
            this.addToHistory('user', userMessage, category);

            // Construction de l'historique pour le contexte
            const historyContext = this.buildHistoryContext();

            // Requête vers le worker
            const response = await this.makeRequest({
                message: userMessage,
                conversationHistory: historyContext,
                category: category,
                sessionId: this.getSessionId()
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Erreur réseau: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.message || data.error);
            }

            // Ajout de la réponse IA à l'historique
            this.addToHistory('assistant', data.message, data.category);

            // Sauvegarde de l'historique
            this.saveConversationHistory();

            return {
                message: data.message,
                category: data.category,
                timestamp: data.timestamp || new Date().toISOString(),
                suggestedQuestions: this.generateSuggestedQuestions(data.category)
            };

        } catch (error) {
            console.error('❌ Erreur envoi message:', error);
            throw error;
        }
    }

    // Requête HTTP vers le worker
    async makeRequest(payload) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        try {
            const response = await fetch(this.workerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.getSessionId()
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Timeout: La requête a pris trop de temps');
            }
            throw error;
        }
    }

    // Construction du contexte de conversation
    buildHistoryContext() {
        return this.conversationHistory
            .slice(-6) // Garde seulement les 6 derniers échanges
            .map(item => `${item.role}: ${item.message}`)
            .join('\n');
    }

    // Ajout d'un élément à l'historique
    addToHistory(role, message, category = null) {
        const historyItem = {
            role: role,
            message: message,
            category: category,
            timestamp: new Date().toISOString()
        };

        this.conversationHistory.push(historyItem);

        // Limitation de la taille de l'historique
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
    }

    // Génération de questions suggérées basées sur la catégorie
    generateSuggestedQuestions(category) {
        if (!category || !CONFIG.QUESTION_CATEGORIES[category]) {
            return [];
        }

        const categoryQuestions = CONFIG.QUESTION_CATEGORIES[category].questions;
        const usedQuestions = new Set(
            this.conversationHistory
                .filter(item => item.role === 'assistant')
                .map(item => item.message.toLowerCase())
        );

        // Retourne 2-3 questions non utilisées de la catégorie
        return categoryQuestions
            .filter(q => !usedQuestions.has(q.toLowerCase()))
            .slice(0, 3);
    }

    // Sauvegarde de l'historique en local
    saveConversationHistory() {
        try {
            const historyJson = JSON.stringify(this.conversationHistory);
            localStorage.setItem(CONFIG.STORAGE_KEYS.conversationHistory, historyJson);
        } catch (error) {
            console.warn('Erreur sauvegarde historique:', error);
        }
    }

    // Chargement de l'historique depuis le local
    loadConversationHistory() {
        try {
            const historyJson = localStorage.getItem(CONFIG.STORAGE_KEYS.conversationHistory);
            if (historyJson) {
                this.conversationHistory = JSON.parse(historyJson);
                console.log('📚 Historique chargé:', this.conversationHistory.length, 'éléments');
            }
        } catch (error) {
            console.warn('Erreur chargement historique:', error);
            this.conversationHistory = [];
        }
    }

    // Nettoyage de l'historique
    clearConversationHistory() {
        this.conversationHistory = [];
        localStorage.removeItem(CONFIG.STORAGE_KEYS.conversationHistory);
        console.log('🧹 Historique de conversation nettoyé');
    }

    // Récupération de l'ID de session
    getSessionId() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.sessionId) || 'unknown';
    }

    // Récupération de statistiques sur la conversation
    getConversationStats() {
        const userMessages = this.conversationHistory.filter(item => item.role === 'user');
        const assistantMessages = this.conversationHistory.filter(item => item.role === 'assistant');
        
        const categoryCounts = {};
        assistantMessages.forEach(item => {
            if (item.category) {
                categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
            }
        });

        return {
            totalExchanges: Math.min(userMessages.length, assistantMessages.length),
            userMessages: userMessages.length,
            assistantMessages: assistantMessages.length,
            categoriesCovered: Object.keys(categoryCounts),
            categoryDistribution: categoryCounts,
            averageMessageLength: userMessages.reduce((acc, msg) => acc + msg.message.length, 0) / userMessages.length || 0
        };
    }

    // Vérification si la session a atteint la limite
    hasReachedQuestionLimit() {
        const questionCount = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.questionCount) || '0');
        return questionCount >= CONFIG.MAX_QUESTIONS_PER_SESSION;
    }

    // Génération d'une question de suivi intelligente
    async generateFollowUpQuestion(userResponse, context = null) {
        try {
            const followUpPrompt = `Basé sur cette réponse: "${userResponse}", pose une question de suivi courte et pertinente pour approfondir le sujet. ${context ? `Contexte: ${context}` : ''}`;
            
            const response = await this.sendMessage(followUpPrompt, 'follow-up');
            return response.message;
        } catch (error) {
            console.error('Erreur génération question de suivi:', error);
            return null;
        }
    }

    // Détection si une réponse nécessite un suivi
    needsFollowUp(userMessage) {
        const shortResponseThreshold = 10;
        const ambiguousWords = ['oui', 'non', 'peut-être', 'ok', 'bien', 'normal'];
        
        const isShort = userMessage.trim().length < shortResponseThreshold;
        const isAmbiguous = ambiguousWords.some(word => 
            userMessage.toLowerCase().includes(word)
        );
        
        return isShort || isAmbiguous;
    }
}

// Instance globale
window.geminiClient = new GeminiClient();