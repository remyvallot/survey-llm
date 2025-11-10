# QCM Intelligent

Un système de questionnaire intelligent avec chatbot IA, utilisant Gemini pour adapter les questions selon les réponses des utilisateurs.

## Fonctionnalités

- 🤖 **Chatbot intelligent** avec Gemini AI
- 📊 **Questions adaptatives** selon les réponses
- 🎨 **Design glassmorphism** moderne
- 💾 **Stockage sécurisé** avec Supabase  
- 🔒 **API proxy** via Cloudflare Worker
- 📱 **Interface responsive**
- ✉️ **Validation par email** (pas de compte requis)
- 📈 **Limitation intelligente** des questions (max 10)
- 📋 **Catégories prédéfinies** : démographie, besoins, usage, feedback
- 🔄 **Reprise de session** automatique

## Technologies

- Frontend: HTML5, CSS3, JavaScript ES6+
- Backend: Cloudflare Workers
- Base de données: Supabase (PostgreSQL)
- IA: Google Gemini API
- Hébergement: GitHub Pages

## Structure du projet

```
├── index.html              # Page principale
├── assets/
│   ├── css/
│   │   └── style.css       # Styles avec glassmorphism
│   └── js/
│       ├── config.js       # Configuration générale
│       ├── supabase-client.js  # Client base de données
│       ├── gemini-client.js    # Client API Gemini
│       ├── qcm-manager.js      # Logique QCM
│       ├── ui-manager.js       # Interface utilisateur
│       └── app.js              # Application principale
├── cloudflare-worker/
│   ├── worker.js           # Proxy API Gemini
│   └── wrangler.toml       # Configuration Cloudflare
└── supabase/
    └── schema.sql          # Schéma base de données
```

## Installation rapide

1. **Cloner le repository**
   ```bash
   git clone [repository-url]
   cd qcm-intelligent
   ```

2. **Configurer Supabase**
   - Créer un projet sur supabase.com
   - Exécuter le SQL dans `supabase/schema.sql`
   - Noter l'URL et la clé anonyme

3. **Déployer le Cloudflare Worker**
   ```bash
   cd cloudflare-worker
   wrangler deploy
   wrangler secret put GEMINI_API_KEY
   ```

4. **Configurer l'application**
   - Modifier `assets/js/config.js` avec vos URLs
   - Pousser sur GitHub
   - Activer GitHub Pages

## Configuration

Modifiez `assets/js/config.js` :

```javascript
const CONFIG = {
    CLOUDFLARE_WORKER_URL: 'https://your-worker.workers.dev',
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key',
    MAX_QUESTIONS_PER_SESSION: 10,
    // ...
};
```

## Utilisation

1. L'utilisateur entre son email
2. Le chatbot pose des questions intelligentes
3. L'IA s'adapte selon les réponses
4. Limitation à 10 questions maximum
5. Sauvegarde automatique en base

## Sécurité

- ✅ Clé API cachée dans Cloudflare Worker
- ✅ Rate limiting implémenté
- ✅ Validation des origines
- ✅ RLS (Row Level Security) Supabase
- ✅ Session unique par email

## Développement

```bash
# Servir localement (VS Code Live Server recommandé)
# Configurer les URLs de développement dans config.js
```

## Contribution

1. Fork le project
2. Créer une branche (`git checkout -b feature/amélioration`)
3. Commit (`git commit -m 'Ajouter fonctionnalité'`)
4. Push (`git push origin feature/amélioration`)
5. Ouvrir une Pull Request

## License

MIT License - voir [LICENSE](LICENSE)