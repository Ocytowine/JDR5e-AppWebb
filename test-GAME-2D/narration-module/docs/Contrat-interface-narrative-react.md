# Contrat interface narrative React

Statut : `FIGE` pour le sous-lot I-06B.

Version : `narrative-react-ui/1`.

Date : 2026-07-07.

## Objectif

Ce contrat fixe le premier branchement UI du module narration dans l'application React.

L'interface doit afficher les projections `DisplayPacketV1` produites par `scene-social-ui/1` et collecter une saisie libre du joueur, sans devenir propriétaire de la vérité narrative et sans appeler directement un fournisseur IA.

## Périmètre autorisé I-06B

I-06B peut produire :

- composants React purs pour afficher des blocs typés;
- barre de saisie libre;
- callback de soumission avec `clientRequestId`;
- rendu accessible des locuteurs, rôles et blocs;
- états UI locaux strictement visuels : champ courant, ouverture du panneau, pending;
- tests de rendu statique.

I-06B n'autorise pas :

- appel direct à OpenAI ou à un fournisseur depuis React;
- appel à `/api/narration` historique comme runtime narratif;
- persistance du transcript dans `localStorage`;
- lecture ou mutation directe de `CampaignRepository`;
- résolution de règles, temps, social, tactique ou repos dans le composant;
- branchement dans `GameBoard.tsx`, qui reste la surface tactique;
- branchement applicatif définitif sans gate suivante.

## Entrée

Le composant reçoit des `DisplayPacketV1[]` déjà validés.

Il ne reçoit pas :

- prompt;
- clé;
- sortie brute fournisseur;
- vérité MJ privée;
- transcript complet non paginé;
- agrégats métier bruts.

## Sortie

La saisie du joueur est remontée au parent sous forme :

```ts
interface NarrativeSubmitPayloadV1 {
  schemaVersion: 1;
  clientRequestId: string;
  rawInput: string;
}
```

Le composant ne décide pas si l'entrée est action, parole, question méta ou clarification. Il ne déclenche aucun temps de jeu.

## Rendu

Chaque bloc visible doit exposer :

- texte;
- type de bloc;
- nom ou désignation stable du locuteur;
- rôle;
- `aria-label`;
- accès à l'entrée brute si `rawInputAccess.available` est vrai;
- marque visuelle non autoritaire.

La couleur ne peut pas être le seul repère. Le DOM doit contenir des labels textuels ou attributs accessibles suffisants.

## Gestion du pending

L'état `pending` indique seulement qu'une soumission est en traitement. Il peut désactiver la saisie ou afficher une indication d'attente.

Il ne permet pas de supposer une action en jeu, d'ajouter une narration provisoire ou de faire avancer la scène.

## Interdictions techniques

Les composants I-06B ne doivent pas contenir :

- `fetch`;
- `XMLHttpRequest`;
- `localStorage`;
- `sessionStorage`;
- accès direct à `process.env`;
- import de `openaiProvider`;
- import de `server.js`;
- appel à `/api/narration`, `/api/enemy-ai` ou `/api/enemy-speech`.

Ces opérations appartiennent à l'orchestrateur serveur ou aux modules historiques tactiques, pas à l'UI narrative.

## Preuves minimales de sortie I-06B

La fermeture d'I-06B exige :

- composant React compilé par le build global;
- test de rendu statique avec plusieurs locuteurs;
- test de soumission libre avec `clientRequestId`;
- test ou contrôle source prouvant l'absence d'appel réseau et de stockage local dans le composant;
- documentation et `TASKS.md` mis à jour.

## Décision

`narrative-react-ui/1` autorise I-06B uniquement pour des composants UI purs et testables. Le branchement applicatif complet dans une surface narration dédiée reste un futur sous-lot. `GameBoard.tsx` n'est pas cette surface; il reste propriétaire de l'expérience tactique.
