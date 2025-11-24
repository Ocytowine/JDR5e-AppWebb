# JDR5e-AppWebb

Projet de jeu web - jeu de rôle solo sur navigateur avec mécaniques complexes basées sur D&D 5e

## 🎲 Architecture

### 1. Frontend : Nuxt + Pinia + Tailwind
- **Nuxt 3** : Framework Vue.js pour applications web modernes
- **Pinia** : Gestion d'état global (stores pour utilisateur et jeu)
- **Tailwind CSS** : Framework CSS utilitaire pour l'interface
- **TypeScript** : Typage statique pour plus de robustesse

### 2. API Backend : `/server/api/`
Routes REST disponibles :
- `POST /api/auth/login` - Connexion utilisateur
- `POST /api/auth/register` - Inscription utilisateur
- `GET /api/saves?userId={id}` - Récupérer les sauvegardes
- `POST /api/saves` - Créer une sauvegarde
- `PUT /api/saves/{id}` - Mettre à jour une sauvegarde

### 3. Base de données
- **SQLite** : Développement local (fichier dans `/data/database.sqlite`)
- **PostgreSQL** : Production (Supabase/Neon)
- **Drizzle ORM** : Gestion des requêtes SQL avec typage TypeScript

### 4. Hébergement
- **Application** : Vercel / Render
- **Base de données** : Supabase / Neon
- Configuration dans `vercel.json` pour déploiement automatique

### 5. Données statiques
- Fichiers JSON dans `/public/data/` :
  - `classes.json` - Définition des classes de personnages
  - `races.json` - Définition des races de personnages

## 🚀 Installation

```bash
# Cloner le repository
git clone https://github.com/Ocytowine/JDR5e-AppWebb.git
cd JDR5e-AppWebb

# Installer les dépendances
npm install

# Créer le fichier de configuration
cp .env.example .env

# Lancer en mode développement
npm run dev
```

L'application sera disponible sur `http://localhost:3000`

## 🛠️ Scripts disponibles

```bash
# Développement
npm run dev

# Build pour production
npm run build

# Prévisualiser le build de production
npm run preview

# Générer un site statique
npm run generate
```

## 🔧 Configuration

### Développement (SQLite)
```env
DATABASE_TYPE=sqlite
```

### Production (PostgreSQL)
```env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:password@host:5432/database
```

## 📚 Structure du projet

```
JDR5e-AppWebb/
├── app/                    # Application principale
│   └── app.vue            # Composant racine
├── components/            # Composants Vue réutilisables
├── layouts/              # Layouts de pages
│   └── default.vue       # Layout par défaut avec navigation
├── pages/                # Pages de l'application (routing auto)
│   ├── index.vue        # Page d'accueil
│   ├── login.vue        # Page de connexion
│   ├── register.vue     # Page d'inscription
│   └── game.vue         # Page du jeu
├── stores/              # Stores Pinia
│   ├── user.ts         # Gestion de l'authentification
│   └── game.ts         # Gestion des sauvegardes
├── server/             # Backend API
│   ├── api/           # Routes API
│   │   ├── auth/     # Routes d'authentification
│   │   └── saves/    # Routes de sauvegarde
│   ├── database/     # Configuration base de données
│   │   ├── schema.ts    # Schémas Drizzle
│   │   └── connection.ts # Connexion DB
│   ├── plugins/      # Plugins Nitro
│   └── utils/        # Utilitaires serveur
├── public/           # Fichiers statiques
│   └── data/        # Données JSON statiques
└── data/            # Base de données SQLite (dev)
```

## 🎮 Fonctionnalités

- ✅ Système d'authentification complet
- ✅ Gestion de personnages
- ✅ Système de sauvegarde persistant
- ✅ Interface moderne et responsive
- ✅ API REST complète
- ✅ Support SQLite et PostgreSQL
- ✅ Configuration multi-environnement

## 🚢 Déploiement

### Vercel

1. Connectez votre repository GitHub à Vercel
2. Configurez les variables d'environnement :
   - `DATABASE_TYPE=postgres`
   - `DATABASE_URL=<votre_url_postgresql>`
3. Déployez automatiquement

### Render

1. Créez un nouveau service Web
2. Connectez votre repository
3. Configurez les variables d'environnement
4. Build command : `npm run build`
5. Start command : `node .output/server/index.mjs`

## 📝 Licence

MIT
