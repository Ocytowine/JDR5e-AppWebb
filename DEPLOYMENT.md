# Guide de Déploiement - JDR5e-AppWebb

## 📋 Pré-requis

### Pour le développement local
- Node.js 18+ installé
- npm ou yarn
- SQLite (inclus)

### Pour la production
- Compte Vercel ou Render
- Base de données PostgreSQL (Supabase ou Neon)

## 🚀 Déploiement sur Vercel

### 1. Préparation de la base de données

#### Option A : Supabase
1. Créez un compte sur [Supabase](https://supabase.com)
2. Créez un nouveau projet
3. Récupérez l'URL de connexion PostgreSQL :
   - Allez dans Settings > Database
   - Copiez le "Connection string"
   - Format : `postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres`

#### Option B : Neon
1. Créez un compte sur [Neon](https://neon.tech)
2. Créez un nouveau projet
3. Récupérez l'URL de connexion PostgreSQL

### 2. Initialisation de la base de données

Exécutez ces commandes SQL sur votre base PostgreSQL :

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE saves (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3. Configuration Vercel

1. Connectez votre repository GitHub à Vercel
2. Configurez les variables d'environnement :
   ```
   DATABASE_TYPE=postgres
   DATABASE_URL=postgresql://user:password@host:5432/database
   ```
3. Build settings (automatiques avec vercel.json) :
   - Build Command: `npm run build`
   - Output Directory: `.output/public`
   - Install Command: `npm install`

4. Déployez !

## 🔧 Déploiement sur Render

### 1. Création du service Web

1. Créez un compte sur [Render](https://render.com)
2. Créez un nouveau "Web Service"
3. Connectez votre repository GitHub
4. Configuration :
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node .output/server/index.mjs`

### 2. Configuration de la base de données

#### Utiliser Render PostgreSQL (recommandé)
1. Créez une nouvelle base PostgreSQL sur Render
2. Render fournira automatiquement une variable `DATABASE_URL`

#### Ou utiliser Supabase/Neon
1. Créez votre base de données comme décrit ci-dessus
2. Ajoutez manuellement la variable `DATABASE_URL`

### 3. Variables d'environnement

Dans Render, ajoutez :
```
DATABASE_TYPE=postgres
DATABASE_URL=<votre_url_postgresql>
```

### 4. Initialisation de la base de données

Connectez-vous à votre base PostgreSQL et exécutez les commandes SQL mentionnées ci-dessus.

## 🏗️ Build local pour tester

```bash
# Construire l'application
npm run build

# Tester le build
npm run preview
```

## 📝 Variables d'environnement

### Développement (.env)
```env
DATABASE_TYPE=sqlite
```

### Production
```env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:password@host:5432/database
```

## ⚠️ Notes importantes

### Sécurité
- ⚠️ Le système actuel stocke les mots de passe en clair
- 🔒 Pour la production, implémentez le hashing des mots de passe (bcrypt, argon2)
- 🔐 Ajoutez des tokens JWT pour l'authentification
- 🛡️ Implémentez des validations côté serveur

### Performance
- Activez la mise en cache des données statiques
- Optimisez les requêtes de base de données
- Configurez un CDN pour les assets statiques

### Monitoring
- Configurez des logs d'erreurs (Sentry, etc.)
- Surveillez les performances de la base de données
- Mettez en place des alertes

## 🔍 Vérification du déploiement

Testez ces endpoints après le déploiement :

1. **Page d'accueil** : `https://votre-app.vercel.app/`
2. **Données statiques** : `https://votre-app.vercel.app/data/classes.json`
3. **API Health** : Testez l'inscription et la connexion

## 🐛 Dépannage

### Erreur de connexion à la base de données
- Vérifiez que `DATABASE_URL` est correctement configurée
- Assurez-vous que la base de données accepte les connexions externes
- Vérifiez les certificats SSL si nécessaire

### Erreur 500 au démarrage
- Vérifiez les logs Vercel/Render
- Assurez-vous que les tables de base de données sont créées
- Vérifiez que toutes les dépendances sont installées

### Problèmes de build
- Effacez le cache : `npm run postinstall`
- Supprimez `node_modules` et `package-lock.json`, puis réinstallez

## 📞 Support

Pour toute question ou problème :
- Consultez les logs de déploiement
- Vérifiez la documentation Nuxt : https://nuxt.com
- Ouvrez une issue sur GitHub
