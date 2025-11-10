# 🚀 Guide de Déploiement Complet - QCM Intelligent

## Étape 1 : Configuration Supabase

### 1.1 Créer un projet Supabase
1. Allez sur [https://supabase.com](https://supabase.com)
2. Cliquez sur "Start your project"
3. Créez un nouveau projet :
   - **Nom**: `qcm-intelligent`
   - **Mot de passe**: Générez un mot de passe fort
   - **Région**: Choisissez la plus proche de vos utilisateurs

### 1.2 Configuration de la base de données
1. Dans votre projet Supabase, allez dans **SQL Editor**
2. Créez une nouvelle requête
3. Copiez-collez le contenu entier du fichier `supabase/schema.sql`
4. Cliquez sur **RUN** pour exécuter le script
5. Vérifiez que les tables `qcm_sessions` et `qcm_responses` sont créées

### 1.3 Récupérer les clés
1. Allez dans **Settings** > **API**
2. Notez ces informations :
   - **URL**: `https://your-project.supabase.co`
   - **anon key**: `eyJ...` (clé publique)

---

## Étape 2 : Configuration Cloudflare Worker

### 2.1 Prérequis
```bash
# Installer Wrangler CLI
npm install -g wrangler

# Ou avec pnpm
pnpm add -g wrangler
```

### 2.2 Authentification
```bash
# Se connecter à Cloudflare
wrangler login
```
Suivez les instructions pour vous authentifier dans votre navigateur.

### 2.3 Configuration du Worker
1. Ouvrez le fichier `cloudflare-worker/wrangler.toml`
2. Vérifiez que la configuration est correcte :
   ```toml
   name = "qcm-gemini-proxy"  # Changez si vous voulez
   main = "worker.js"
   compatibility_date = "2023-11-01"
   
   [limits]
   cpu_ms = 10000
   ```
3. Si `cpu_ms` est commenté, décommentez-le (retirez le #)

### 2.4 Déploiement
```bash
# Aller dans le dossier du worker
cd cloudflare-worker

# Déployer le worker
wrangler deploy
```

### 2.5 Configuration des secrets
```bash
# Ajouter votre clé API Gemini
wrangler secret put GEMINI_API_KEY
# Entrez votre clé quand demandé
```

### 2.6 Récupérer l'URL
Après le déploiement, notez l'URL affichée :
```
https://qcm-gemini-proxy.your-subdomain.workers.dev
```

---

## Étape 3 : Configuration GitHub Pages

### 3.1 Préparer le repository
1. Créez un nouveau repository sur GitHub ou forkez celui-ci
2. Nom suggéré : `qcm-intelligent`
3. Assurez-vous que le repository est **public**

### 3.2 Upload des fichiers
Si vous créez un nouveau repository :
```bash
git clone https://github.com/your-username/qcm-intelligent.git
cd qcm-intelligent
# Copiez tous les fichiers du projet ici
git add .
git commit -m "Initial commit - QCM Intelligent"
git push origin main
```

### 3.3 Activer GitHub Pages
1. Dans votre repository, allez dans **Settings**
2. Scrollez jusqu'à **Pages** (dans le menu de gauche)
3. Dans **Source**, choisissez **Deploy from a branch**
4. Sélectionnez **main** et **/ (root)**
5. Cliquez sur **Save**

Votre site sera disponible à : `https://your-username.github.io/qcm-intelligent`

---

## Étape 4 : Configuration de l'Application

### 4.1 Modifier config.js
Ouvrez `assets/js/config.js` et remplacez :

```javascript
const CONFIG = {
    // ✏️ REMPLACEZ CES URLS PAR VOS VRAIES URLS
    CLOUDFLARE_WORKER_URL: 'https://qcm-gemini-proxy.your-subdomain.workers.dev',
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    
    // Gardez le reste identique
    MAX_QUESTIONS_PER_SESSION: 10,
    // ...
};
```

### 4.2 Modifier worker.js (Optionnel)
Dans `cloudflare-worker/worker.js`, ajoutez votre domaine GitHub Pages :

```javascript
const CONFIG = {
    ALLOWED_ORIGINS: [
        'https://your-username.github.io',  // ✏️ VOTRE DOMAINE ICI
        'http://localhost:3000',
        'http://127.0.0.1:5500'
    ],
    // ...
};
```

Puis redéployez :
```bash
cd cloudflare-worker
wrangler deploy
```

### 4.3 Commit des changements
```bash
git add assets/js/config.js
git commit -m "Configure API URLs"
git push origin main
```

---

## Étape 5 : Test et Validation

### 5.1 Test manuel
1. Allez sur votre site GitHub Pages
2. Entrez un email de test
3. Vérifiez que le chatbot répond
4. Complétez quelques questions

### 5.2 Vérification Supabase
1. Dans Supabase, allez dans **Table Editor**
2. Vérifiez que des données apparaissent dans :
   - `qcm_sessions`
   - `qcm_responses`

### 5.3 Vérification Cloudflare
1. Dans Cloudflare, allez dans **Workers & Pages**
2. Cliquez sur votre worker
3. Vérifiez les métriques dans l'onglet **Metrics**

---

## Étape 6 : Surveillance (Optionnel)

### 6.1 Requêtes utiles Supabase
```sql
-- Nombre de sessions aujourd'hui
SELECT COUNT(*) FROM qcm_sessions 
WHERE DATE(created_at) = CURRENT_DATE;

-- Taux de complétion
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_completed) as completed,
  ROUND(COUNT(*) FILTER (WHERE is_completed) * 100.0 / COUNT(*), 1) as completion_rate
FROM qcm_sessions;

-- Réponses par catégorie
SELECT category, COUNT(*) 
FROM qcm_responses 
GROUP BY category;
```

### 6.2 Alertes Cloudflare
Configurez des alertes pour surveiller :
- Nombre de requêtes
- Taux d'erreur
- Latence

---

## 🆘 Dépannage

### Erreur "limits.cpu_ms is a required field"
- ✅ Dans `cloudflare-worker/wrangler.toml`, décommentez la ligne `cpu_ms = 10000`
- ✅ Assurez-vous que la section `[limits]` contient : `cpu_ms = 10000`

### Erreur "Configuration incomplète"
- ✅ Vérifiez les URLs dans `config.js`
- ✅ Assurez-vous qu'aucune URL ne contient "your-"

### Erreur CORS
- ✅ Ajoutez votre domaine GitHub Pages dans `worker.js`
- ✅ Redéployez le worker avec `wrangler deploy`

### Pas de réponse du chatbot
- ✅ Vérifiez que la clé Gemini est configurée : `wrangler secret list`
- ✅ Regardez les logs du worker : `wrangler tail`

### Erreur base de données
- ✅ Vérifiez que le schéma SQL est exécuté
- ✅ Contrôlez les politiques RLS dans Supabase

### Site GitHub Pages non accessible
- ✅ Assurez-vous que le repository est public
- ✅ Vérifiez que GitHub Pages est activé
- ✅ Attendez 5-10 minutes après activation

---

## 📞 Commandes utiles

```bash
# Logs du worker en temps réel
wrangler tail

# Lister les secrets configurés
wrangler secret list

# Supprimer un secret
wrangler secret delete SECRET_NAME

# Redéployer après modification
wrangler deploy

# Test local du worker
wrangler dev
```

---

## ✅ Checklist de déploiement

- [ ] Supabase : Projet créé et schéma SQL exécuté
- [ ] Cloudflare : Worker déployé et clé Gemini configurée
- [ ] GitHub : Repository créé et Pages activé
- [ ] Configuration : URLs mises à jour dans `config.js`
- [ ] Test : Site accessible et fonctionnel
- [ ] Données : Réponses sauvegardées en base

🎉 **Félicitations !** Votre QCM intelligent est maintenant en ligne !