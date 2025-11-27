# Test Lore - Narrateur

Petit prototype pour tester une boucle IA avec du contexte de lore stocké dans SQLite.

## Installation

```bash
cd test-LORE
npm install
npm start
```

Le serveur démarre sur `http://localhost:3000`.

## Fonctionnement

- La base SQLite se trouve dans `data/lore.db` (créée automatiquement).  
- Deux seeds sont ajoutés au premier lancement.
- Endpoints :
  - `GET /api/lore` : liste des entrées.
  - `POST /api/lore` : ajoute une entrée `{ title, tags?, summary, body }`.
  - `POST /api/message` : enregistre le message du joueur et renvoie une réponse du narrateur en s'appuyant sur les entrées de lore qui matchent le texte.
- Frontend statique dans `public/`.

## Idées d'évolution rapide

- Brancher un vrai modèle IA (OpenAI, LM local) en lui passant `loreUsed` + historique.
- Ajouter une pondération TF-IDF ou un encodage vectoriel pour récupérer le meilleur contexte.
- Stocker plusieurs parties avec des titres et des états persistants.
- Export/import du lore depuis un CSV ou un Google Sheet.
