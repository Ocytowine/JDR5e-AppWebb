# Contrat surface narration applicative

Statut : `FIGE` pour le sous-lot I-06C.

Version : `narrative-app-surface/1`.

Date : 2026-07-07.

## Objectif

Ce contrat fixe la première séparation applicative entre narration et tactique.

`GameBoard.tsx` reste la surface tactique. La narration dispose d'une surface dédiée qui peut afficher les projections `DisplayPacketV1` sans importer le plateau, sans appeler un fournisseur IA et sans persister le transcript dans un cache UI.

## Périmètre autorisé I-06C

I-06C peut produire :

- un shell React applicatif distinguant explicitement `Narration` et `Tactique`;
- une surface `NarrativeAppSurface` dédiée;
- un contrôleur UI local de prototype pour démontrer la saisie libre et l'affichage de `DisplayPacketV1`;
- tests statiques prouvant que `GameBoard.tsx` n'est pas importé par la surface narration;
- documentation de la frontière.

I-06C n'autorise pas :

- import de `GameBoard.tsx` dans la surface narration;
- appel OpenAI ou route IA depuis la surface narration;
- usage de `/api/narration`, `/api/enemy-ai` ou `/api/enemy-speech`;
- `localStorage` ou `sessionStorage` pour le transcript;
- orchestration complète d'un tour de campagne;
- handoff tactique réel.

## Structure attendue

```text
src/App.tsx
  ├─ surface Narration -> NarrativeAppSurface
  └─ surface Tactique  -> GameBoard

src/narration-ui/NarrativeAppSurface.tsx
  └─ NarrativeConversationPanel
```

`App.tsx` peut importer `GameBoard.tsx` pour la surface tactique. `NarrativeAppSurface.tsx` ne le peut pas.

## Contrôleur de prototype

Le contrôleur local I-06C peut :

- conserver un état React de paquets de démonstration;
- transformer une saisie libre en bloc `RAW_INPUT` local clairement marqué prototype;
- conserver `clientRequestId`;
- afficher le paquet via `NarrativeConversationPanel`.

Il ne peut pas :

- interpréter l'intention;
- produire un commit;
- avancer le temps;
- simuler une réponse IA comme vérité;
- écrire dans un repository.

Cette limite permet de brancher la surface sans inventer le futur orchestrateur.

## Preuves minimales de sortie I-06C

La fermeture d'I-06C exige :

- `src/App.tsx` rend une surface narration distincte de la surface tactique;
- `src/main.tsx` monte `App` plutôt que `GameBoard` directement;
- `NarrativeAppSurface` compile sans importer `GameBoard`;
- test statique contre appels réseau, stockage local et routes historiques;
- build global réussi.

## Décision

`narrative-app-surface/1` autorise uniquement la séparation applicative et un prototype UI local non autoritaire. L'orchestrateur narratif réel reste un futur sous-lot.

## Addendum — erreurs visibles dans le fil

La surface active est désormais raccordée au contrôleur narratif. Toute erreur
qui empêche une action, une restauration, un lancer ou une projection doit
produire une bulle `SYSTEM_NOTICE` dans le fil, en plus du résumé accessible
`role="alert"`.

La bulle contient :

- le contexte de l'étape interrompue ;
- une explication en français orientée joueur/testeur ;
- une action de reprise recommandée ;
- `messageKey`, code, catégorie, politique de reprise et identifiant d'incident.

Elle ne contient jamais l'entrée brute, `CoreError.details`, une référence
privée, une clé fournisseur ou une trace de pile.

Exemple : `campaign-npc.scene-actor-not-found` devient « Un élément nécessaire
à cette action n'a pas été retrouvé » avec le conseil de vérifier la cible et la
conversation précédente. La référence interne éventuellement cachée reste hors
du paquet visible.

Les familles distinguées sont : conflit d'idempotence, état périmé, élément
absent, persistance, fournisseur externe, validation et incident inattendu.
