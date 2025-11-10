// Application principale - Point d'entrée
class QCMApp {
    constructor() {
        this.isInitialized = false;
        this.initializationAttempts = 0;
        this.maxInitAttempts = 3;
    }

    // Initialisation de l'application
    async init() {
        try {
            console.log('🚀 Démarrage QCM Intelligent...');
            
            // Vérification de la configuration
            if (!validateConfig()) {
                throw new Error('Configuration incomplète - Vérifiez les URLs et clés API');
            }

            // Initialisation des managers
            await this.initializeManagers();
            
            // Vérification de session existante
            await this.checkExistingSession();
            
            this.isInitialized = true;
            console.log('✅ Application initialisée avec succès');
            
            // Affichage de l'état prêt
            window.uiManager.setConnectionStatus(true);
            
        } catch (error) {
            console.error('❌ Erreur initialisation application:', error);
            await this.handleInitializationError(error);
        }
    }

    // Initialisation des managers
    async initializeManagers() {
        console.log('⚙️ Initialisation des managers...');
        
        // UI Manager (synchrone)
        window.uiManager.init();
        
        // QCM Manager (asynchrone)
        await window.qcmManager.init();
        
        console.log('✅ Managers initialisés');
    }

    // Vérification de session existante
    async checkExistingSession() {
        try {
            const hasExistingSession = await window.qcmManager.checkExistingSession();
            
            if (hasExistingSession) {
                console.log('📋 Session existante détectée');
                
                // Afficher l'interface de chat directement
                window.uiManager.showChatInterface();
                window.uiManager.showProgressBar();
                
                // Mettre à jour la progression
                const sessionInfo = window.qcmManager.getSessionInfo();
                window.uiManager.updateProgress(
                    sessionInfo.questionCount, 
                    sessionInfo.maxQuestions
                );
                
                // Message de reprise
                window.uiManager.addBotMessage(
                    'Bienvenue ! Nous reprenons où nous nous étions arrêtés. Prêt à continuer le questionnaire ?'
                );
            }
        } catch (error) {
            console.warn('⚠️ Erreur vérification session existante:', error);
            // Continuer avec une nouvelle session
        }
    }

    // Gestion des erreurs d'initialisation
    async handleInitializationError(error) {
        this.initializationAttempts++;
        
        if (this.initializationAttempts < this.maxInitAttempts) {
            console.log(`🔄 Tentative ${this.initializationAttempts + 1}/${this.maxInitAttempts}...`);
            
            // Attendre avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 2000));
            return this.init();
        }
        
        // Échec définitif
        console.error('💥 Échec d\'initialisation après', this.maxInitAttempts, 'tentatives');
        this.showFatalError(error);
    }

    // Affichage d'erreur fatale
    showFatalError(error) {
        const container = document.querySelector('.container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="error-container glass-morphism" style="
                text-align: center;
                padding: var(--spacing-xl);
                margin: var(--spacing-xl) auto;
                max-width: 500px;
            ">
                <h2 style="color: var(--error-color); margin-bottom: var(--spacing-md);">
                    ⚠️ Erreur de chargement
                </h2>
                <p style="margin-bottom: var(--spacing-lg); color: var(--text-secondary);">
                    Une erreur s'est produite lors du chargement de l'application.
                </p>
                <details style="text-align: left; margin-bottom: var(--spacing-lg);">
                    <summary style="cursor: pointer; color: var(--primary-color);">
                        Détails techniques
                    </summary>
                    <pre style="
                        background: var(--glass-bg);
                        padding: var(--spacing-md);
                        border-radius: var(--border-radius-small);
                        margin-top: var(--spacing-sm);
                        font-size: 0.8rem;
                        overflow: auto;
                        white-space: pre-wrap;
                    ">${error.message}</pre>
                </details>
                <button onclick="location.reload()" class="primary-button">
                    Recharger la page
                </button>
            </div>
        `;
    }

    // Gestion des erreurs globales
    setupGlobalErrorHandling() {
        // Erreurs JavaScript non capturées
        window.addEventListener('error', (event) => {
            console.error('💥 Erreur globale:', event.error);
            this.handleGlobalError(event.error);
        });

        // Promesses rejetées non gérées
        window.addEventListener('unhandledrejection', (event) => {
            console.error('💥 Promesse rejetée:', event.reason);
            this.handleGlobalError(event.reason);
            event.preventDefault();
        });
    }

    // Gestion des erreurs globales pendant l'exécution
    handleGlobalError(error) {
        if (!this.isInitialized) return;
        
        console.error('🚨 Erreur pendant l\'exécution:', error);
        
        // Si on a une session active, l'arrêter proprement
        if (window.qcmManager && window.qcmManager.getSessionInfo().isActive) {
            window.qcmManager.handleEmergencyStop(error.message);
        }
    }

    // Nettoyage avant fermeture
    setupCleanupHandlers() {
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Gestion de la visibilité de la page
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveState();
            }
        });
    }

    // Sauvegarde d'état
    saveState() {
        try {
            if (window.qcmManager && window.qcmManager.getSessionInfo().isActive) {
                // Sauvegarder l'état actuel
                const state = {
                    timestamp: Date.now(),
                    sessionInfo: window.qcmManager.getSessionInfo(),
                    conversationStats: window.geminiClient.getConversationStats()
                };
                
                localStorage.setItem('qcm_app_state', JSON.stringify(state));
                console.log('💾 État sauvegardé');
            }
        } catch (error) {
            console.warn('⚠️ Erreur sauvegarde état:', error);
        }
    }

    // Nettoyage
    cleanup() {
        try {
            this.saveState();
            console.log('🧹 Nettoyage effectué');
        } catch (error) {
            console.warn('⚠️ Erreur pendant le nettoyage:', error);
        }
    }

    // Informations sur l'application
    getAppInfo() {
        return {
            version: '1.0.0',
            initialized: this.isInitialized,
            initAttempts: this.initializationAttempts,
            config: {
                maxQuestions: CONFIG.MAX_QUESTIONS_PER_SESSION,
                sessionTimeout: CONFIG.SESSION_TIMEOUT,
                maxMessageLength: CONFIG.MAX_MESSAGE_LENGTH
            },
            sessionInfo: window.qcmManager ? window.qcmManager.getSessionInfo() : null
        };
    }
}

// Initialisation de l'application
const app = new QCMApp();

// Démarrage quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.setupGlobalErrorHandling();
        app.setupCleanupHandlers();
        app.init();
    });
} else {
    // DOM déjà prêt
    app.setupGlobalErrorHandling();
    app.setupCleanupHandlers();
    app.init();
}

// Export global pour debug
window.qcmApp = app;

// Fonctions utilitaires globales
window.debugInfo = () => {
    console.log('🔍 Informations de debug:');
    console.log('App Info:', app.getAppInfo());
    console.log('QCM Manager:', window.qcmManager ? window.qcmManager.getSessionInfo() : 'Non initialisé');
    console.log('Conversation Stats:', window.geminiClient ? window.geminiClient.getConversationStats() : 'Non initialisé');
};

window.resetApp = () => {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser l\'application ? Toutes les données locales seront perdues.')) {
        localStorage.clear();
        location.reload();
    }
};