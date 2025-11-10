// Client Supabase pour la gestion des données
class SupabaseClient {
    constructor() {
        this.supabase = null;
        this.initialized = false;
    }

    // Initialisation du client Supabase
    async init() {
        try {
            if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
                throw new Error('Configuration Supabase manquante');
            }

            // Import dynamique de Supabase depuis CDN
            if (!window.supabase) {
                await this.loadSupabaseSDK();
            }

            this.supabase = window.supabase.createClient(
                CONFIG.SUPABASE_URL,
                CONFIG.SUPABASE_ANON_KEY
            );

            this.initialized = true;
            console.log('✅ Supabase initialisé');
        } catch (error) {
            console.error('❌ Erreur initialisation Supabase:', error);
            throw error;
        }
    }

    // Chargement dynamique du SDK Supabase
    async loadSupabaseSDK() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/dist/umd/supabase.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Création d'une nouvelle session utilisateur
    async createSession(email, consentGiven = false) {
        try {
            if (!this.initialized) await this.init();

            const sessionId = this.generateSessionId();
            const sessionData = {
                session_id: sessionId,
                email: email,
                consent_recontact: consentGiven,
                created_at: new Date().toISOString(),
                questions_count: 0,
                is_completed: false
            };

            const { data, error } = await this.supabase
                .from('qcm_sessions')
                .insert([sessionData])
                .select()
                .single();

            if (error) throw error;

            // Stockage local de la session
            localStorage.setItem(CONFIG.STORAGE_KEYS.sessionId, sessionId);
            localStorage.setItem(CONFIG.STORAGE_KEYS.userEmail, email);
            localStorage.setItem(CONFIG.STORAGE_KEYS.consentGiven, consentGiven.toString());
            localStorage.setItem(CONFIG.STORAGE_KEYS.sessionStartTime, Date.now().toString());

            console.log('✅ Session créée:', sessionId);
            return sessionId;
        } catch (error) {
            console.error('❌ Erreur création session:', error);
            throw error;
        }
    }

    // Vérification si un email existe déjà
    async checkEmailExists(email) {
        try {
            if (!this.initialized) await this.init();

            const { data, error } = await this.supabase
                .from('qcm_sessions')
                .select('session_id, questions_count, is_completed')
                .eq('email', email)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            return data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('❌ Erreur vérification email:', error);
            return null;
        }
    }

    // Sauvegarde d'une question et réponse
    async saveQuestionAnswer(question, answer, category = null) {
        try {
            if (!this.initialized) await this.init();

            const sessionId = localStorage.getItem(CONFIG.STORAGE_KEYS.sessionId);
            if (!sessionId) throw new Error('Session non trouvée');

            const qaData = {
                session_id: sessionId,
                question: question,
                answer: answer,
                category: category,
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('qcm_responses')
                .insert([qaData]);

            if (error) throw error;

            // Mise à jour du compteur de questions
            await this.updateQuestionCount();

            console.log('✅ Q&A sauvegardée');
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde Q&A:', error);
            throw error;
        }
    }

    // Mise à jour du compteur de questions
    async updateQuestionCount() {
        try {
            const sessionId = localStorage.getItem(CONFIG.STORAGE_KEYS.sessionId);
            if (!sessionId) return;

            const currentCount = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.questionCount) || '0') + 1;
            localStorage.setItem(CONFIG.STORAGE_KEYS.questionCount, currentCount.toString());

            const isCompleted = currentCount >= CONFIG.MAX_QUESTIONS_PER_SESSION;

            const { error } = await this.supabase
                .from('qcm_sessions')
                .update({
                    questions_count: currentCount,
                    is_completed: isCompleted,
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', sessionId);

            if (error) throw error;

            return currentCount;
        } catch (error) {
            console.error('❌ Erreur mise à jour compteur:', error);
            throw error;
        }
    }

    // Récupération de l'historique de conversation
    async getConversationHistory() {
        try {
            if (!this.initialized) await this.init();

            const sessionId = localStorage.getItem(CONFIG.STORAGE_KEYS.sessionId);
            if (!sessionId) return [];

            const { data, error } = await this.supabase
                .from('qcm_responses')
                .select('question, answer, category, created_at')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('❌ Erreur récupération historique:', error);
            return [];
        }
    }

    // Finalisation de la session
    async completeSession(feedback = null) {
        try {
            const sessionId = localStorage.getItem(CONFIG.STORAGE_KEYS.sessionId);
            if (!sessionId) return;

            const updateData = {
                is_completed: true,
                completed_at: new Date().toISOString()
            };

            if (feedback) {
                updateData.final_feedback = feedback;
            }

            const { error } = await this.supabase
                .from('qcm_sessions')
                .update(updateData)
                .eq('session_id', sessionId);

            if (error) throw error;

            console.log('✅ Session finalisée');
            return true;
        } catch (error) {
            console.error('❌ Erreur finalisation session:', error);
            throw error;
        }
    }

    // Génération d'un ID de session unique
    generateSessionId() {
        return 'qcm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Nettoyage de la session locale
    clearLocalSession() {
        Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('🧹 Session locale nettoyée');
    }

    // Vérification de l'état de la session
    isSessionValid() {
        const sessionId = localStorage.getItem(CONFIG.STORAGE_KEYS.sessionId);
        const startTime = localStorage.getItem(CONFIG.STORAGE_KEYS.sessionStartTime);
        
        if (!sessionId || !startTime) return false;
        
        const elapsed = Date.now() - parseInt(startTime);
        return elapsed < CONFIG.SESSION_TIMEOUT;
    }

    // Récupération des statistiques (pour debug/admin)
    async getSessionStats() {
        try {
            if (!this.initialized) await this.init();

            const sessionId = localStorage.getItem(CONFIG.STORAGE_KEYS.sessionId);
            if (!sessionId) return null;

            const { data: sessionData, error: sessionError } = await this.supabase
                .from('qcm_sessions')
                .select('*')
                .eq('session_id', sessionId)
                .single();

            if (sessionError) throw sessionError;

            const { data: responsesData, error: responsesError } = await this.supabase
                .from('qcm_responses')
                .select('*')
                .eq('session_id', sessionId);

            if (responsesError) throw responsesError;

            return {
                session: sessionData,
                responses: responsesData
            };
        } catch (error) {
            console.error('❌ Erreur récupération stats:', error);
            return null;
        }
    }
}

// Instance globale
window.supabaseClient = new SupabaseClient();