# QCM Intelligent - Guide de Déploiement

Ce projet est un QCM intelligent avec chatbot utilisant Gemini AI, hébergé sur GitHub Pages avec Cloudflare Workers et Supabase.

## 🏗️ Architecture

- **Frontend**: HTML/CSS/JS (GitHub Pages)
- **API Proxy**: Cloudflare Worker (cache la clé Gemini)
- **Base de données**: Supabase (stockage des réponses)
- **IA**: Google Gemini API

## 📋 Prérequis

1. Compte GitHub
2. Compte Cloudflare 
3. Compte Supabase
4. Clé API Google Gemini

## 🚀 Déploiement

### 1. Configuration Supabase

1. Créez un nouveau projet sur [Supabase](https://supabase.com)
2. Allez dans l'éditeur SQL et exécutez le contenu de `supabase/schema.sql`
3. Notez votre URL de projet et votre clé anonyme :
   - URL: `https://your-project.supabase.co`
   - Clé: Trouvable dans Settings > API

### 2. Configuration Cloudflare Worker

1. Installez Wrangler CLI :
   ```bash
   npm install -g wrangler
   ```

2. Authentifiez-vous :
   ```bash
   wrangler login
   ```

3. Naviguez vers le dossier cloudflare-worker :
   ```bash
   cd cloudflare-worker
   ```

4. Déployez le worker :
   ```bash
   wrangler deploy
   ```

5. Configurez les variables d'environnement :
   ```bash
   wrangler secret put GEMINI_API_KEY
   # Entrez votre clé API Gemini
   ```

6. Notez l'URL de votre worker : `https://qcm-gemini-proxy.your-subdomain.workers.dev`

### 3. Configuration GitHub Pages

1. Forkez ou uploadez ce repository sur GitHub
2. Allez dans Settings > Pages
3. Choisissez "Deploy from a branch" > "main" > "/ (root)"
4. Votre site sera disponible sur : `https://your-username.github.io/repository-name`

### 4. Configuration de l'application

Modifiez le fichier `assets/js/config.js` avec vos URLs :

```javascript
const CONFIG = {
    // Remplacez par votre URL de worker Cloudflare
    CLOUDFLARE_WORKER_URL: 'https://qcm-gemini-proxy.your-subdomain.workers.dev',
    
    // Remplacez par vos informations Supabase
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-supabase-anon-key',
    
    // ... reste de la configuration
};
```

## 🔧 Configuration avancée

### Cloudflare Worker - Origines autorisées

Modifiez le fichier `cloudflare-worker/worker.js` pour ajouter votre domaine GitHub Pages :

```javascript
const CONFIG = {
    ALLOWED_ORIGINS: [
        'https://your-username.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:5500'
    ],
    // ...
};
```

### Supabase - Politiques RLS

Les politiques de sécurité au niveau des lignes sont déjà configurées pour permettre l'insertion anonyme. Pour plus de sécurité, vous pouvez modifier les politiques dans le dashboard Supabase.

## 📊 Surveillance et analytics

### 1. Cloudflare Analytics
- Consultez les métriques dans votre dashboard Cloudflare
- Surveillez les erreurs et la latence

### 2. Supabase Dashboard
- Surveillez l'utilisation de la base de données
- Analysez les réponses avec les vues créées :
  - `qcm_stats` : Statistiques globales
  - `qcm_category_analysis` : Analyse par catégorie

### 3. Consultation des données

Requêtes SQL utiles dans Supabase :

```sql
-- Sessions du jour
SELECT COUNT(*) as sessions_today 
FROM qcm_sessions 
WHERE DATE(created_at) = CURRENT_DATE;

-- Réponses par catégorie
SELECT category, COUNT(*) as count 
FROM qcm_responses 
GROUP BY category;

-- Taux de complétion
SELECT 
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE is_completed) as completed_sessions,
    ROUND(COUNT(*) FILTER (WHERE is_completed) * 100.0 / COUNT(*), 2) as completion_rate
FROM qcm_sessions;
```

## 🛠️ Développement local

1. Clonez le repository
2. Servez les fichiers avec un serveur local (ex: Live Server dans VS Code)
3. Configurez les URLs en mode développement dans `config.js`

## 🔒 Sécurité

- ✅ Clé API Gemini cachée dans Cloudflare Worker
- ✅ Rate limiting implémenté
- ✅ Validation des origines
- ✅ Politique RLS Supabase
- ✅ Validation des entrées utilisateur

## 🎨 Personnalisation

### Design
- Modifiez les variables CSS dans `assets/css/style.css`
- Les couleurs et espacements sont centralisés dans `:root`

### Questions
- Personnalisez les catégories et questions dans `assets/js/config.js`
- Ajustez la logique de sélection dans `qcm-manager.js`

### IA
- Modifiez le prompt système dans `cloudflare-worker/worker.js`
- Ajustez les paramètres de génération (température, tokens, etc.)

## 📱 Support mobile

L'interface est entièrement responsive et optimisée pour mobile.

## 🐛 Dépannage

### Erreur "CORS"
- Vérifiez que votre domaine GitHub Pages est dans `ALLOWED_ORIGINS` du worker

### Erreur "Configuration incomplète"
- Vérifiez que toutes les URLs dans `config.js` sont correctes
- Assurez-vous que la clé Gemini est configurée dans Cloudflare

### Erreur Supabase
- Vérifiez que les politiques RLS permettent l'insertion
- Contrôlez que le schéma SQL a été exécuté correctement

### Problèmes de déploiement
- Vérifiez que GitHub Pages est activé
- Assurez-vous que `index.html` est à la racine du repository

## 📞 Support

Pour obtenir de l'aide :
1. Consultez les logs dans la console développeur
2. Vérifiez les erreurs dans Cloudflare Worker
3. Consultez les métriques Supabase

## 🚀 Améliorations futures

- [ ] Analytics avancés
- [ ] Export des données en CSV
- [ ] Interface d'administration
- [ ] Notifications par email
- [ ] Support multilingue
- [ ] Tests automatisés