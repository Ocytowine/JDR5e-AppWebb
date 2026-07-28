# Relève — création dynamique de scène depuis les Archives

Date: 2026-07-23

Statut : `PREUVE_HISTORIQUE`

Cette relève conserve les mesures et décisions du 2026-07-23. Elle ne constitue
plus un point de reprise actif ; voir
[`Consolidation-fondations-narration.md`](Consolidation-fondations-narration.md).

## Certification live du 2026-07-23

Le parcours Archives → destination absente → rechargement sur la scène dynamique → retour vers les Archives a d'abord été certifié avec `gpt-5.6-luna/none` pour `player_intent_interpreter` et `gpt-5.5` pour `scene_creator`. Le benchmark V2 suivant a certifié `gpt-5.6-luna/none` pour `scene_creator`, désormais configuration serveur par défaut.

- création observée entre 21,8 et 26,0 secondes selon les essais ;
- interprétation observée entre 3,0 et 3,8 secondes ;
- commit dynamique confirmé avec 8 secondes de jeu ;
- projection et commit dynamique relus après rechargement d'IndexedDB ;
- retour vers la scène wiki en 2,6 à 2,8 secondes, avec 8 secondes supplémentaires ;
- aucun timeout à 30 secondes, rejet de gate ou incident console.

La sélection UI OpenAI revient encore à `Locale` après rechargement. La télémétrie de succès de `scene_creator` est désormais propagée jusqu'à la notification; si le fournisseur omet ses métriques, une ligne locale explicite utilise `finishReason=provider_metrics_missing` au lieu de masquer l'appel.

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

Le build compile désormais `wiki/lore` et produit `narrative-lore-build-catalog/1`; le client ne reçoit plus les sources brutes ni le compilateur YAML. Le catalogue courant retient 23 sources utiles et 15 paquets de scène. Seul un brief compact propre à la scène active est envoyé à l'IA. L'architecture d'indexation incrémentale d'un corpus beaucoup plus vaste reste différée.

### `scene_creator`

Il propose seulement la matière créative du lieu: nom, résumé, tension, traits perceptibles, rôles de population, normes et engagements narratifs. Il n'a aucune autorité de commit, ne crée aucun personnage durable et ne révèle aucun secret. Après commit, le runtime projette chaque rôle de population en présence anonyme locale ciblable; cette présence reste bornée à la scène reconstruite.

Le contrat live actif est `lore-guided-place-candidate/2`. Il contient uniquement la matière créative et aucun champ topologique. Le serveur continue d'accepter V1 pour compatibilité, mais le pilote émet V2. Le serveur et le pipeline TypeScript possèdent chacun un validateur dédié. Ne jamais laisser `scene_creator` tomber dans le validateur de `scene_writer`, qui attend `payload.narrationBlocks`.

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
10. La narration annonçait des copistes alors que `presentNpc` restait vide; le rôle était donc impossible à cibler au tour suivant. Les rôles committés deviennent désormais des présences locales `ambient`, sans création de PNJ durable. Les clarifications n'appellent plus `scene_writer`, le retour est libellé en français et l'ouverture utilise une formulation générique correcte. L'adaptateur wiki n'y concatène plus le corps et plusieurs fragments publics: il emploie le résumé auteur comme amorce courte, les détails restant accessibles par les éléments visibles et l'observation.
11. Le `npc_performer` et la projection de sa réplique conservaient des valeurs de la scène de test (`reference-inn-rain-001`, salle commune, garde blessé). Le contrôleur transmet désormais la scène active au performer; son contexte spatial, ses sources publiques, l'acteur visible et le nom du locuteur proviennent tous de cette scène. Les identités inconnues ne retombent plus sur le garde. Les libellés de rôles ambiants sont aussi réduits à un rôle ciblable au lieu d'afficher toute leur phrase descriptive.
12. La recette étendue Perron → salutation → question sur le rôle → retour confirme la continuité d'acteur, le couplage mémoire intention-réplique et la réutilisation topologique. Le nettoyage suivant retire les formulations techniques des points wiki, restaure les accents de l'ouverture, réserve le mot « acteur » de la trace aux seules cibles PNJ et impose au `scene_creator` des intitulés de population courts au singulier.

## État des délais OpenAI

Configuration actuelle du rôle:

- contexte maximum demandé: 2 000 tokens;
- sortie maximum: 2 000 tokens;
- délai fournisseur: 55 secondes;
- délai de transport client: 60 secondes;
- modèle serveur par défaut : `gpt-5.6-luna` pour `scene_creator` ;
- raisonnement serveur par défaut : `none` pour `scene_creator`;
- modèle: `NARRATION_OPENAI_SCENE_CREATOR_MODEL`, sinon `NARRATION_OPENAI_MODEL`.

Le contexte compact observé lors du dernier test live faisait 6 541 caractères. Le dernier échec était uniquement `SERVER_ROUTE_FETCH_FAILED: signal timed out` à 30 014 ms, avant le relèvement du délai. Une création proche d'une minute reste trop lente pour la cible produit; le relèvement sert d'abord à valider le parcours fonctionnel.

## Suite directe

1. Étendre les conversations PNJ longues et leur mémoire courte.
2. Garder le catalogue lore de build aligné avec toute évolution du contrat auteur.
3. Décider si le mode IA choisi doit être restauré après rechargement ou rester volontairement local par défaut.

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
