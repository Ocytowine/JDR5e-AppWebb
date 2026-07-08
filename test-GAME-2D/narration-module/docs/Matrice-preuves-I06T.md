# Matrice de preuves I-06T — intégration wiki minimale pour lieux existants

Date : 2026-07-08
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06T prouve qu'un lieu existant du wiki peut produire une scène jouable minimale sans charger tout le wiki en contexte IA, sans révéler de secrets et sans demander à l'IA d'inventer le lieu.

## Périmètre livré

- adaptateur `lore-playable-scene-adapter/1`;
- transformation d'une entité lore de type lieu (`batiment`, `quartier`, `ville`) en `PlayableSceneStateV1`;
- source réelle testée : `wiki/lore/territoire/region/Ylsséa/Lysenthe/batiments/archives_de_lysenthe`;
- filtrage des fragments visibles : seuls `COMMUN` et `LOCAL` alimentent la scène;
- fragments `SPECIALISE`, `RESTREINT` et `MJ_SECRET` retenus hors scène visible;
- politique `scene_writer.mayReference` limitée aux fragments autorisés;
- test d'exclusion d'un fragment `MJ_SECRET` injecté.

## Preuves exécutables

| Preuve | Résultat attendu |
|---|---|
| `npm run narration-module:test:lore-playable-scene` | Compile le lieu wiki, dérive une scène jouable et vérifie l'exclusion des secrets. |
| `npm run narration-module:test:playable-scene` | Confirme que le contrat générique I-06S reste valide. |
| `npm run narration-module:test:vertical-quality` | Confirme que la scène de référence reste stable. |
| `npm run narration-module:build` | Valide types, exports et imports lore/application. |

## Limites assumées

- L'adaptateur ne sélectionne pas encore automatiquement une scène depuis l'UI.
- Le test couvre un lieu wiki précis, pas un batch complet de tous les lieux.
- Les secrets sont exclus du contexte visible; ils ne sont pas encore gérés comme révélations contrôlées.
- Les créations éphémères restent fermées jusqu'à I-06U.
- Les intrigues dynamiques restent fermées jusqu'à une gate dédiée.

## Décision

I-06T est clos dans son périmètre. La suite la plus logique est I-06U : autoriser uniquement de petits éléments éphémères de scène, validés strictement et jamais promus durablement automatiquement.
