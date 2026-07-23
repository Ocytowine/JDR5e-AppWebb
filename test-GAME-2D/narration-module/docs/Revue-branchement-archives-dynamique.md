# Revue du branchement Archives de Lysenthe → scènes dynamiques

Date: 2026-07-23

## Parcours retenu

1. Le corpus wiki compilable complet est embarqué et compilé dans le client; les références de lore et de catalogues restent ainsi fermées.
2. Les scènes jouables connues et leurs connexions ouvertes sont dérivées du lore.
3. Une transition connue passe par le runtime de topologie et le catalogue de scènes.
4. Une sortie visible déclarée `external:` mais sans destination connue est confiée à `scene_creator`.
5. Le candidat reçoit la scène source et la référence canonique exacte de la sortie.
6. Les gates lore, doublon, persistance et topologie précèdent le port monde.
7. Le lieu, ses faits, la topologie, le temps, la position et le cycle de scène sont publiés dans un commit atomique.
8. La scène d'arrivée est reconstruite depuis le commit et reste résoluble après réouverture d'IndexedDB.

## Défauts trouvés et traités

- Les fonctions d'un bâtiment pouvaient être confondues avec des sorties: seules les sorties portant des alias de destination peuvent déclencher une création.
- Le créateur ne connaissait pas la frontière canonique franchie: `sourceBoundaryRef` fait désormais partie de son contexte obligatoire.
- Une destination déjà décrite par le wiki pouvait être recréée: les scènes jouables du corpus et leurs connexions connues alimentent d'abord la topologie.
- Le retour depuis une scène dynamique dépendait encore du prototype de l'auberge: un runtime générique lit maintenant la topologie et le catalogue de campagne.
- Un échec après `PREPARING` pouvait laisser la campagne occupée: le contrôleur annule toute opération pré-commit encore annulable.
- Un paquet de lore unique aurait contaminé les créations depuis une autre scène wiki: le paquet est sélectionné selon la scène source.
- Le lease du bootstrap pouvait survivre à une exception de commit: sa libération est protégée par `finally`.
- La réponse structurée de `scene_creator` était validée comme une sortie de `scene_writer` après l'appel OpenAI et se voyait réclamer `narrationBlocks`: le serveur et le pipeline TypeScript disposent maintenant d'une validation dédiée et symétrique du candidat de lieu.
- La chaîne géographique du lore pouvait conduire l'IA à proposer un parent en `wiki-location:*` alors que la gate monde autorisait `location:*`: les parents permis sont désormais transmis par la politique de création et imposés dans le schéma OpenAI ainsi que dans les deux validateurs de sortie.
- Une proposition créative pouvait omettre la connexion de retour, proposer des sorties non matérialisables ou dépasser la limite topologique. En V1, le préparateur publie désormais uniquement l'entrée exacte et le retour vers la référence autoritaire du lieu source; la topologie mécanique ne dépend plus du `scene_creator`.
- Le schéma pouvait encore laisser choisir une profondeur éphémère ou des listes essentielles vides avant un rejet local tardif: les profondeurs autorisées et les minima structurels sont maintenant imposés dès la sortie OpenAI.
- Les doublons ne couvraient que les créations dynamiques et la scène active: le catalogue des scènes et lieux wiki est maintenant injecté dans la politique, et une collision d'identifiant d'arrivée est rejetée avant commit.
- Le délai générique de 30 secondes coupait régulièrement le `scene_creator` alors que son contexte était déjà compact. Ce rôle dispose maintenant de 55 secondes côté fournisseur et le transport client garde 5 secondes de marge pour recevoir le résultat ou le diagnostic serveur; les rôles interactifs courts conservent leurs délais actuels.
- Le bootstrap des registres dynamiques ne savait pas reprendre une opération restée `READY_TO_COMMIT` après rollback et pouvait laisser une présentation post-commit inachevée. Il reprend désormais selon la phase persistée, réconcilie un résultat de commit inconnu par idempotence et finalise une opération déjà committée. Les cinq points de panne atomiques du repository sont couverts.
- `lore-guided-place-candidate/2` retire les intentions de connexion du candidat IA. V1 reste accepté pour compatibilité, tandis que le pilote et son schéma strict utilisent V2; l'entrée et le retour restent exclusivement construits par le runtime.
- La télémétrie de succès de `scene_creator` suit désormais le changement de scène jusqu'à `NarrativeTurnControllerOutputV1` et à la notification système. Une métrique locale explicite signale l'absence éventuelle de métriques fournisseur.

## Limites encore ouvertes

- La recette OpenAI live est certifiée sur le parcours création, rechargement pendant la scène dynamique et retour. La création reste lente, entre 21,8 et 26,0 secondes sur les essais du 2026-07-23.
- Le choix UI OpenAI revient à `Locale` après rechargement; la recette doit actuellement le réactiver avant le tour suivant.
- Le corpus complet est encore embarqué par `import.meta.glob`; un catalogue généré réduira le bundle et évitera de compiler le wiki au démarrage.
- Les projections de campagne qui corrigent le lore initial ne sont pas encore injectées dans le brief UI.
- La scène dynamique V1 expose volontairement seulement son retour. La génération récursive de nouvelles sorties demandera un contrat ultérieur capable de matérialiser leurs destinations, plutôt que des connexions IA orphelines.
