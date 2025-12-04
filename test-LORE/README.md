# Test Lore - Narrateur + ChatGPT

Prototype de narrateur web pour tester une boucle IA avec du contexte de lore stocke dans SQLite.

## Installation

```bash
cd test-LORE
npm install
npm start
```

Le serveur repond sur `http://localhost:3000` et sert l UI statique depuis `public/`.

## Configuration OpenAI

- Option rapide (session courante) : `$env:OPENAI_API_KEY="votre_cle"` puis `npm start`.
- Option persistante : `setx OPENAI_API_KEY "votre_cle"` puis rouvrir PowerShell.
- Option fichier `.env` (recommandé) :
  1. Créer `test-LORE/.env`
  2. Y placer :  
     `OPENAI_API_KEY=votre_cle`  
     `OPENAI_MODEL=gpt-4o-mini` (optionnel, défaut déjà à gpt-4o-mini)
- Sans clé valide, le serveur garde un mode narratif de secours (rule-based).

## Fonctionnement

- La base SQLite est `data/lore.db` (cree automatiquement) et contient deux seeds.
- Endpoints principaux :
  - `GET /api/lore` : liste des entrees (max 50).
- `POST /api/lore` : ajoute `{ title, tags?, summary, body }`.
- `POST /api/message` : enregistre le message joueur, recupere jusqu a 5 entrees de lore pertinentes, envoie tout cela au modele (historique recent inclus), stocke et renvoie la reponse du narrateur.
- L historique embarque jusqu a 20 messages par conversation, les reponses sont inserees en base (`messages`).
- Recherche contexte : moteur `wikiTag` (tokenisation + pondération titre/tags/resume/corps) au lieu du simple `LIKE`.

## Importer le wiki local dans la base

- Source attendue : `../wiki/lore` (frontmatter YAML + texte).
- Script : `node scripts/import-wiki.js` (depuis `test-LORE/`).
- Comportement : parse les fichiers, construit tags (type, id, liens territoire/region/ville/factions/mots_cles...), resume auto (frontmatter ou 1er paragraphe), insere dans `lore_entries` en supprimant les doublons de titre.
- Les fichiers prefixes `_` sont ignores (templates).

## Flux rapide

1) `npm start` puis ouvrir `http://localhost:3000`.
2) Ajouter du lore via le formulaire ou garder les seeds.
3) Chatter : chaque message appelle `/api/message`, qui joint les blocs de lore tries par LIKE, les passe au modele et renvoie le texte roleplay.
4) Bouton "Reset conv" vide l historique local (mais la base conserve la conversation courante).

## Pistes d evolution

- Pondrer la selection avec TF-IDF ou embeddings vectoriels.
- Stocker plusieurs parties nommees + reprise d etat.
- Import/export CSV ou Google Sheet.
- Ajouter des tests auto sur les endpoints.
