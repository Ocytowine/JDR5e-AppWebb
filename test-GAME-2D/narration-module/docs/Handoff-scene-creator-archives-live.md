# Relève — création dynamique de scène depuis les Archives

Date: 2026-07-22

Ce document permet à une nouvelle session de reprendre le travail sans reconstruire l'historique des décisions. Il complète `TASKS.md` et `Revue-branchement-archives-dynamique.md`. Le dépôt contient des modifications locales non committées: les conserver et ne pas réécrire les fichiers générés manuellement.

## Objectif produit

Le jeu doit pouvoir partir d'un lieu défini par le wiki, puis créer au besoin un lieu jouable qui n'existe pas encore. Le wiki sert de guide créatif et de canon, pas de catalogue exhaustif de toutes les scènes possibles.

Exemple pilote actuel:

1. la campagne commence aux Archives de Lysenthe;
2. le joueur demande à sortir du bâtiment;
3. si la destination est déjà connue dans la topologie, le runtime de catalogue l'utilise;
4. si la sortie visible n'a pas encore de destination, `scene_creator` propose le contenu d'un nouveau lieu;
5. les gates locales contrôlent le lore, le parent, la persistance et les doublons;
6. le runtime construit la topologie mécanique;
7. lieu, faits, topologie, temps, position et cycle de scène sont commités atomiquement;
8. la scène d'arrivée est reconstruite depuis le commit et doit rester résoluble après réouverture d'IndexedDB;
9. le joueur doit pouvoir revenir vers le lieu source.

## Répartition des responsabilités

### `player_intent_interpreter`

Comprend l'intention libre du joueur. « Je sors du bâtiment » doit produire une intention `traverse_visible_boundary`. Il ne crée ni lieu, ni conséquence, ni commit.

### Registre de référents et runtime dynamique

Ils sélectionnent la frontière visible réellement franchie. Si l'interpréteur cible un élément descriptif comme « bâtiment », le runtime peut retenir l'unique sortie externe non cartographiée. Avec plusieurs sorties plausibles, il ne faut pas choisir arbitrairement.

### Sélection du lore

Le pilote compile actuellement tout le corpus `wiki/lore` dans le client, puis construit un paquet borné propre à la scène active. Seul un brief compact est envoyé à l'IA. Dernière mesure connue pour les Archives: 28 entités, 97 fragments, 16 influences, brief complet 17 599 caractères, vue `scene_creator` 5 678 caractères. L'architecture d'indexation scalable du wiki est volontairement différée.

### `scene_creator`

Il propose seulement la matière créative du lieu: nom, résumé, tension, traits perceptibles, rôles de population, normes et engagements narratifs. Il n'a aucune autorité de commit, ne matérialise aucun PNJ et ne révèle aucun secret.

Le contrat live est `lore-guided-place-candidate/1`. Le serveur et le pipeline TypeScript possèdent chacun un validateur dédié. Ne jamais laisser `scene_creator` tomber dans le validateur de `scene_writer`, qui attend `payload.narrationBlocks`.

### Runtime monde et topologie

La topologie mécanique n'est plus confiée à l'IA en V1. Le préparateur publie exactement:

- l'entrée depuis `sourceSceneId` et `sourceBoundaryRef` vers le lieu créé;
- le retour depuis la scène d'arrivée vers la référence autoritaire du lieu source.

Les connexions supplémentaires proposées par l'IA ne sont pas publiées, car leurs destinations ne sont pas encore matérialisées. Ne pas réintroduire de sorties orphelines sous prétexte de flexibilité.

### Gates et commit

Avant commit, le système vérifie notamment:

- profondeur persistante `LIGHT_REFERENCE` ou `FULL_ENTITY`;
- parent appartenant à `allowedParentLocationRefs`;
- identifiants canoniques;
- absence de doublon avec les lieux dynamiques et tous les lieux/scènes wiki connus;
- scène d'arrivée nouvelle;
- contenu minimal non vide;
- topologie valide et sans conflit.

Le commit atomique est préparé par `dynamicPlaceEntryRuntime.ts`. Aucun rendu d'arrivée ne doit précéder la confirmation du commit.

## Fichiers principaux

- `src/narration-ui/NarrativeAppSurface.tsx`: branchement UI, catalogue wiki/dynamique, diagnostics système.
- `src/narration-ui/archiveLorePilot.ts`: compilation du lore pilote, scènes authored, topologie et identités connues.
- `src/narration-ui/openAiNarrativeRuntimeConfig.ts`: configuration des rôles OpenAI.
- `src/narration-ui/serverOpenAiEnhancementClient.ts`: transport client vers la route serveur.
- `narration-module/server/narrativeOpenAiEnhancementRoute.js`: schémas stricts, instructions, validation serveur et appel OpenAI.
- `narration-module/src/application/campaignDynamicPlaceRuntime.ts`: contexte de campagne et préparation monde/temps.
- `narration-module/src/application/loreGuidedPlaceCandidateGeneration.ts`: requête compacte du `scene_creator`.
- `narration-module/src/application/loreGuidedDynamicPlacePreparation.ts`: enchaînement IA, gates et topologie V1 autoritaire.
- `narration-module/src/application/placeCreationValidation.ts`: gate de lieu et de doublon.
- `narration-module/src/application/dynamicPlaceEntryRuntime.ts`: commit composite et reconstruction d'arrivée.
- `narration-module/src/application/placeCreationCommit.ts`: registres persistants et reconstruction de scène dynamique.
- `narration-module/tests/scene/verify-lore-guided-scene-creation.ts`: régression principale.

## Incidents déjà rencontrés

1. La sortie était classée comme signal non verbal ou demande de clarification. Corrigé dans l'interprétation et la résolution de frontière unique.
2. La frontière ciblée était un élément descriptif au lieu du point de passage. Corrigé par la résolution de l'unique sortie externe.
3. Le `scene_creator` recevait environ 57 000 caractères. Corrigé par une vue de brief compacte; ne pas renvoyer l'objet d'autorité complet au modèle.
4. Le schéma du candidat contenait une erreur JSON Schema. Corrigé et couvert par les tests serveur.
5. La sortie `scene_creator` était validée comme `scene_writer` et se voyait réclamer `narrationBlocks`. Corrigé par deux validateurs dédiés.
6. L'IA proposait `wiki-location:quartier_des_archives` comme parent alors que le monde autorisait `location:quartier_des_archives`. Le parent autorisé est maintenant injecté et verrouillé dans le schéma.
7. L'IA omettait la connexion de retour. La topologie entrée/retour est maintenant construite par le runtime.
8. Une scène ou un lieu authored pouvait être recréé. Le catalogue authored alimente maintenant la politique de doublon.
9. L'appel était coupé à exactement 30 secondes. Le `scene_creator` dispose maintenant de 55 secondes côté fournisseur et le client garde 5 secondes de marge transport.

## État des délais OpenAI

Configuration actuelle du rôle:

- contexte maximum demandé: 2 000 tokens;
- sortie maximum: 2 000 tokens;
- délai fournisseur: 55 secondes;
- délai de transport client: 60 secondes;
- raisonnement serveur par défaut: `low` pour `scene_creator`;
- modèle: `NARRATION_OPENAI_SCENE_CREATOR_MODEL`, sinon `NARRATION_OPENAI_MODEL`.

Le contexte compact observé lors du dernier test live faisait 6 541 caractères. Le dernier échec était uniquement `SERVER_ROUTE_FETCH_FAILED: signal timed out` à 30 014 ms, avant le relèvement du délai. Une création proche d'une minute reste trop lente pour la cible produit; le relèvement sert d'abord à valider le parcours fonctionnel.

## Suite directe

1. Redémarrer complètement `npm run dev` afin de reconstruire le client et recharger la route serveur.
2. Depuis une campagne propre aux Archives, envoyer « je sors du bâtiment ».
3. Vérifier que la notification ne contient plus de timeout à 30 secondes.
4. En cas de succès, vérifier dans le fil:
   - expression joueur;
   - narration d'arrivée seulement après commit;
   - notification système avec destination, scène, temps et commit;
   - scène active différente des Archives;
   - un point de retour visible.
5. Demander le retour vers les Archives et vérifier qu'aucun nouveau lieu n'est créé.
6. Recharger la page et vérifier que la scène active et le lieu dynamique sont reconstruits depuis IndexedDB.
7. Après validation fonctionnelle, réduire le contrat V2 du `scene_creator`: supprimer les champs topologiques désormais ignorés et benchmarker un modèle plus rapide pour ce rôle uniquement.
8. Ajouter ensuite le test d'injection de panne du bootstrap entre ses phases, déjà signalé dans `TASKS.md`.

## Comment analyser le prochain rejet

Toujours partir du bloc `Système — Notification système`.

- `ai-candidate-rejected` avec `SERVER_ROUTE_FETCH_FAILED`: transport ou timeout.
- `OPENAI_INVALID_ENVELOPE`: désaccord schéma/validateur serveur.
- `place-gate-rejected`: parent, doublon, persistance ou topologie locale.
- `generic-gate-rejected`: autorité créative, ancre ou risque de contenu.
- erreur `dynamic-place-entry.*` avant commit: préparation monde, temps ou agrégats.
- erreur de reconstruction après commit: incident d'intégrité sérieux; ne jamais masquer par un fallback narratif.

Conserver dans les diagnostics visibles la télémétrie du rôle, la latence, les budgets, la taille du contexte et les issues exactes. Ne pas déplacer ces informations vers une seconde zone UI.

## Pièges à éviter

- Ne pas corriger une erreur de contrat par un texte de fallback qui donne l'impression que l'action a réussi.
- Ne pas déduire une mutation métier depuis le texte brut ou la prose IA.
- Ne pas donner à l'IA l'autorité de commit, de temps, de topologie ou de vérité durable.
- Ne pas ajouter de règles lexicales propres aux Archives ou à la formulation « sortir du bâtiment ».
- Ne pas accepter simultanément `wiki-location:*` et `location:*` sans décider quelle couche possède chaque référence.
- Ne pas fabriquer des connexions vers des destinations absentes du catalogue.
- Ne pas afficher une arrivée avant le commit atomique confirmé.
- Ne pas supprimer les gates pour faire passer un test live; corriger la donnée ou la responsabilité en amont.
- Ne pas augmenter indéfiniment tokens et délais sans mesurer `contextChars`, tokens et latence par rôle.
- Ne pas modifier ou nettoyer les changements locaux existants hors périmètre.
- Ne pas créer de commit Git sans demande explicite de l'utilisateur.

## Vérifications connues comme passantes

Depuis `test-GAME-2D/`:

```powershell
npm run narration-module:test:lore-guided-scene
npm run narration-module:test:narrative-openai-route
npm run narration-module:test:scene-transition
npm run narration-module:test:narrative-turn-controller
npm run narration-module:test:narrative-app-surface
npm run narration-module:test:ai-intent-interpretation
npm run narration-module:test:indexeddb
npm run build
git diff --check
```

Ces tests couvrent les contrats locaux, une sortie créative incomplète, l'entrée/retour autoritaires, les doublons, le commit atomique, la reconstruction, la surface UI et IndexedDB réel sous Chromium. Ils ne remplacent pas la recette fournisseur live décrite ci-dessus.
