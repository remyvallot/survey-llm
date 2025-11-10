// Cloudflare Worker pour proxifier l'API Gemini
// Ce worker cache votre clé API et gère les requêtes vers Gemini

// Configuration - À définir dans les Environment Variables de Cloudflare
const CONFIG = {
    GEMINI_API_KEY: '',  // Sera défini dans les env vars
    ALLOWED_ORIGINS: [
        'https://remyvallot.github.io',
        'http://localhost:8000',
        'http://127.0.0.1:5500'  // Pour Live Server
    ],
    RATE_LIMIT: {
        MAX_REQUESTS_PER_MINUTE: 20,
        MAX_REQUESTS_PER_HOUR: 100
    }
};

// Headers CORS
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
    'Access-Control-Max-Age': '86400',
};

// Gestion du rate limiting
class RateLimiter {
    constructor() {
        this.requests = new Map();
    }

    isAllowed(identifier) {
        const now = Date.now();
        const minute = Math.floor(now / 60000);
        const hour = Math.floor(now / 3600000);
        
        const key = `${identifier}:${minute}`;
        const hourKey = `${identifier}:${hour}:hour`;
        
        const minuteCount = this.requests.get(key) || 0;
        const hourCount = this.requests.get(hourKey) || 0;
        
        if (minuteCount >= CONFIG.RATE_LIMIT.MAX_REQUESTS_PER_MINUTE ||
            hourCount >= CONFIG.RATE_LIMIT.MAX_REQUESTS_PER_HOUR) {
            return false;
        }
        
        this.requests.set(key, minuteCount + 1);
        this.requests.set(hourKey, hourCount + 1);
        
        // Nettoyage automatique des anciennes entrées
        setTimeout(() => {
            this.requests.delete(key);
        }, 60000);
        
        return true;
    }
}

const rateLimiter = new RateLimiter();

// Fonction principale du worker
export default {
    async fetch(request, env, ctx) {
        // Gestion CORS pour les requêtes OPTIONS
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // Vérification de l'origine
            const origin = request.headers.get('Origin');
            if (!isOriginAllowed(origin)) {
                return new Response('Origin not allowed', { 
                    status: 403,
                    headers: corsHeaders 
                });
            }

            // Rate limiting basé sur l'IP
            const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
            if (!rateLimiter.isAllowed(clientIP)) {
                return new Response(JSON.stringify({
                    error: 'Rate limit exceeded. Please try again later.'
                }), {
                    status: 429,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }

            // Seules les requêtes POST sont autorisées
            if (request.method !== 'POST') {
                return new Response('Method not allowed', { 
                    status: 405,
                    headers: corsHeaders 
                });
            }

            // Parsing de la requête
            const requestData = await request.json();
            
            // Validation des données
            if (!requestData.message || typeof requestData.message !== 'string') {
                return new Response(JSON.stringify({
                    error: 'Message is required and must be a string'
                }), {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }

            // Limitation de la taille du message
            if (requestData.message.length > 1000) {
                return new Response(JSON.stringify({
                    error: 'Message too long. Maximum 1000 characters.'
                }), {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }

            // Construction de la requête vers Gemini
            const geminiResponse = await callGeminiAPI(requestData, env);
            
            return new Response(JSON.stringify(geminiResponse), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });

        } catch (error) {
            console.error('Worker error:', error);
            
            return new Response(JSON.stringify({
                error: 'Internal server error',
                message: 'Une erreur s\'est produite lors du traitement de votre demande.'
            }), {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
    }
};

// Appel à l'API Gemini
async function callGeminiAPI(requestData, env) {
    const apiKey = env.GEMINI_API_KEY;
    
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    
    // Construction du prompt pour le contexte QCM
    const systemPrompt = `Tu es un assistant IA spécialisé dans la conduite d'enquêtes et sondages. 
    Ton rôle est de poser des questions intelligentes et pertinentes pour comprendre les besoins des utilisateurs.
    
    Règles importantes:
    - Pose UNE question à la fois
    - Adapte tes questions selon les réponses précédentes
    - Reste concis et naturel (maximum 2 phrases)
    - Si l'utilisateur donne une réponse courte, pose une question de suivi pour approfondir
    - Évite les questions trop techniques ou personnelles
    - Utilise un ton amical et professionnel
    
    Contexte: Tu conduis un sondage pour comprendre les besoins des utilisateurs potentiels d'un outil.
    Categories disponibles: démographie, besoins, usage, feedback.`;

    const payload = {
        contents: [
            {
                parts: [
                    {
                        text: `${systemPrompt}\n\nConversation précédente: ${requestData.conversationHistory || 'Début de conversation'}\n\nUtilisateur: ${requestData.message}`
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 200,
            stopSequences: []
        },
        safetySettings: [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH", 
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extraction de la réponse
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const aiResponse = data.candidates[0].content.parts[0].text;
        
        // Détection de catégorie basée sur le contenu de la réponse
        const detectedCategory = detectQuestionCategory(aiResponse);
        
        return {
            message: aiResponse.trim(),
            category: detectedCategory,
            timestamp: new Date().toISOString()
        };
    } else {
        throw new Error('Invalid response from Gemini API');
    }
}

// Détection de la catégorie de question basée sur le contenu
function detectQuestionCategory(response) {
    const categoryKeywords = {
        'demographie': ['âge', 'secteur', 'entreprise', 'fonction', 'poste', 'région', 'taille'],
        'besoins': ['besoin', 'défi', 'problème', 'solution', 'frustration', 'idéal', 'budget'],
        'usage': ['fréquence', 'utilisez', 'cloud', 'équipe', 'information', 'découvrir'],
        'feedback': ['pensé', 'expérience', 'amélioration', 'recommanderiez', 'suggestion']
    };
    
    const lowerResponse = response.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => lowerResponse.includes(keyword))) {
            return category;
        }
    }
    
    return null;
}

// Vérification de l'origine autorisée
function isOriginAllowed(origin) {
    if (!origin) return false;
    
    return CONFIG.ALLOWED_ORIGINS.some(allowedOrigin => {
        if (allowedOrigin === '*') return true;
        return origin === allowedOrigin;
    });
}

// Export pour tests locaux
export { CONFIG, detectQuestionCategory, isOriginAllowed };