# Checkpoint diagnostics exacts J10-H5

Date : 2026-08-26

Statut : `FERMÉ — SANS APPEL OPENAI LIVE`

## Résultat

Le diagnostic du dernier échange suit désormais le contrat versionné
`narrative-technical-diagnostic/1`. Il expose quatre objets distincts :

1. `interpretation` : décision de compréhension et cadre V8 original ;
2. `routing` : stratégie de rôles, plan effectif et reçu de fidélité ;
3. `resolution` : résultat du propriétaire, plan MJ et performance PNJ ;
4. `presentation` : rendu final, fallback éventuel et incidents de présentation.

Une projection historique ne peut donc plus être présentée comme la décision
effective du propriétaire.

## Attribution et télémétrie

`failuresByRole` attribue séparément les échecs à l'interpréteur, au planner,
au performer PNJ ou au rôle de présentation. Lorsqu'un performer échoue,
`actorRef` conserve l'acteur concerné. Un incident présent à la fois dans la
tentative et dans le résultat final est dédupliqué par son identifiant.

La télémétrie du `mj_planner` traverse maintenant toutes les sorties du
contrôleur, y compris les décisions de destination et changements de scène.
Chaque reçu distingue :

- `configuredInputBudget`, la limite d'entrée déclarée ;
- `actualInputTokens`, l'usage fournisseur réellement rapporté ;
- `configuredOutputLimit`, le plafond de génération ;
- `actualOutputTokens`, la sortie réellement rapportée ;
- `outputLimitStatus`, qui différencie plafond atteint, non atteint, possible
  ou impossible à déterminer.

Les valeurs absentes restent `null` ; elles ne sont jamais inventées depuis la
taille en caractères.

## Isolation du fil joueur

L'ancien assemblage `appendNarrativeSystemTrace` a été supprimé. Aucun détail
de moteur, métrique, budget ou incident technique n'est ajouté au paquet
affiché ou persisté. Les anciennes traces déjà sauvegardées restent filtrées
par compatibilité.

Le JSON complet est consultable et copiable uniquement derrière « Options
techniques », dans une zone marquée
`SEPARATE_DEVELOPER_PANEL_ONLY`. Le fil narratif conserve exclusivement la
présentation fictionnelle ou les clarifications sûres prévues par le produit.

## Preuves

```text
npm run narration-module:test:j10h5-diagnostics
npm run build
git diff --check
```

La gate H5 couvre le contrat en quatre étapes, l'attribution des trois familles
d'échec simulées, la déduplication des incidents, la télémétrie planner, la
sémantique des budgets et l'absence du mécanisme d'injection historique. Elle
rejoue également H0 à H4, G5 et G7. Aucun appel OpenAI live n'est effectué.

## Suite

J10-H6 doit maintenant rejouer et compléter la certification transverse des
propriétaires : dialogue, intrigue, mission, compagnon, inventaire, voyage,
repos, monde et tactique, ainsi que les migrations IndexedDB et le build final.
