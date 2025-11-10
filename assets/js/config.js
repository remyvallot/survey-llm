// Configuration générale de l'application
const CONFIG = {
    // URLs des services
    CLOUDFLARE_WORKER_URL: 'https://your-worker.your-subdomain.workers.dev',
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-supabase-anon-key',
    
    // Limites et contraintes
    MAX_QUESTIONS_PER_SESSION: 10,
    MAX_MESSAGE_LENGTH: 500,
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes en millisecondes
    
    // Questions par catégorie
    QUESTION_CATEGORIES: {
        'demographie': {
            name: 'Informations démographiques',
            questions: [
                "Quel est votre âge ?",
                "Dans quel secteur d'activité travaillez-vous ?",
                "Quelle est votre fonction/poste actuel ?",
                "Dans quelle région vous situez-vous ?",
                "Quelle est la taille de votre entreprise ?"
            ]
        },
        'besoins': {
            name: 'Besoins et attentes',
            questions: [
                "Quels sont vos principaux défis actuels ?",
                "Quelles solutions utilisez-vous actuellement ?",
                "Qu'est-ce qui vous frustre le plus dans vos outils actuels ?",
                "Quel serait votre outil idéal ?",
                "Quel budget seriez-vous prêt à consacrer à une solution ?"
            ]
        },
        'usage': {
            name: 'Habitudes d\'usage',
            questions: [
                "À quelle fréquence utilisez-vous des outils similaires ?",
                "Préférez-vous les solutions cloud ou on-premise ?",
                "Travaillez-vous plutôt seul ou en équipe ?",
                "Quelles sont vos sources d'information privilégiées ?",
                "Comment découvrez-vous de nouveaux outils ?"
            ]
        },
        'feedback': {
            name: 'Retours et suggestions',
            questions: [
                "Qu'avez-vous pensé de cette expérience ?",
                "Quelles fonctionnalités aimeriez-vous voir ajoutées ?",
                "Recommanderiez-vous cet outil à un collègue ?",
                "Avez-vous des suggestions d'amélioration ?",
                "Souhaiteriez-vous être tenu informé de nos évolutions ?"
            ]
        }
    },
    
    // Messages système
    SYSTEM_MESSAGES: {
        welcome: "Bonjour ! Je vais vous poser quelques questions pour mieux comprendre vos besoins. Ces informations nous aideront à améliorer nos services.",
        emailRequest: "Pour commencer, j'aimerais avoir votre email. Cela nous permettra de créer une session unique et d'éviter les doublons. Rassurez-vous, nous ne partagerons jamais vos données.",
        startQuestionnaire: "Parfait ! Commençons le questionnaire. Je vais adapter les questions selon vos réponses pour rendre l'échange plus naturel.",
        maxQuestionsReached: "Merci pour vos réponses ! Nous avons atteint la limite de questions pour cette session. Vos retours sont précieux pour nous.",
        sessionExpired: "Votre session a expiré. Veuillez recharger la page pour recommencer.",
        error: "Je suis désolé, une erreur s'est produite. Pouvez-vous reformuler votre réponse ?"
    },
    
    // Configuration de l'IA
    AI_CONFIG: {
        model: "gemini-1.5-flash-latest",
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: `Tu es un assistant IA spécialisé dans la conduite d'enquêtes et sondages. 
        Ton rôle est de poser des questions intelligentes et pertinentes pour comprendre les besoins des utilisateurs.
        
        Règles importantes:
        - Pose UNE question à la fois
        - Adapte tes questions selon les réponses précédentes
        - Reste concis et naturel
        - Si l'utilisateur donne une réponse courte, pose une question de suivi pour approfondir
        - Évite les questions trop techniques ou personnelles
        - Termine par des remerciements quand la limite de questions est atteinte
        
        Tu as accès à ces catégories de questions: démographie, besoins, usage, feedback.
        Choisis intelligemment les questions selon le contexte de la conversation.`
    },
    
    // Configuration du stockage local
    STORAGE_KEYS: {
        sessionId: 'qcm_session_id',
        userEmail: 'qcm_user_email',
        questionCount: 'qcm_question_count',
        conversationHistory: 'qcm_conversation',
        consentGiven: 'qcm_consent',
        sessionStartTime: 'qcm_session_start'
    }
};

// Validation de la configuration
function validateConfig() {
    const requiredFields = [
        'CLOUDFLARE_WORKER_URL',
        'SUPABASE_URL', 
        'SUPABASE_ANON_KEY'
    ];
    
    const missingFields = requiredFields.filter(field => 
        !CONFIG[field] || CONFIG[field].includes('your-')
    );
    
    if (missingFields.length > 0) {
        console.warn('Configuration incomplète. Champs manquants:', missingFields);
        return false;
    }
    
    return true;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, validateConfig };
}