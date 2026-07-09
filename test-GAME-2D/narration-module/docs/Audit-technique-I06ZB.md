# Audit technique narration après I-06ZB

Date : 2026-07-09

Statut : `A_TRAITER_PAR_LOTS`

## Objectif

Reprendre du recul après les lots I-06X à I-06ZB pour vérifier que le module narration reste aligné avec le cahier des charges :

- utiliser l'IA pour comprendre et mettre en scène, pas recréer un jeu à quêtes scriptées;
- garder le code propriétaire maître des commits, du temps, de l'inventaire, du tactique, des secrets et du lore durable;
- éviter l'accumulation de règles lexicales fragiles;
- garder une trace claire des limites prototype avant de construire au-dessus.

## Synthèse

Le module a maintenant une base exploitable : intention IA structurée, rendu local de scène, persistance des projections, distinction UI entre contexte/possibilité/parole, et variation contrôlée. Le point faible principal n'est plus l'absence de sécurité; c'est la répartition encore instable entre :

- logique produit durable;
- rendu local de démonstration;
- enrichissement IA;
- UI prototype.

La suite doit donc consolider les contrats avant d'ajouter des capacités narratives plus larges.

## Points à corriger en priorité

### A-01 — Statuts IA non `OK` potentiellement acceptés

Priorité : `HAUTE`
Statut : `TRAITE` le 2026-07-09.

Constat : la validation d'enveloppe IA vérifie la forme du payload, mais ne rejette pas explicitement un statut `CANNOT_COMPLY`, `REFUSED` ou `PARTIAL_UNUSABLE` si le payload respecte le schéma.

Zones concernées :

- `narration-module/src/ai/validation.ts`
- `narration-module/server/narrativeOpenAiEnhancementRoute.js`
- `src/narration-ui/serverOpenAiEnhancementClient.ts`

Risque : une sortie fournisseur déclarée inutilisable pourrait être traitée comme acceptée par le pipeline si elle contient un payload valide.

Correction recommandée :

- considérer `status !== "OK"` comme sortie rejetée, même si le schéma est correct;
- conserver les diagnostics dans l'incident;
- ajouter un test pipeline et un test route serveur.

Correction appliquée :

- `validateAiRoleOutputEnvelopeV1` rejette tout statut différent de `OK`;
- `validateEnvelope` côté route serveur rejette tout statut différent de `OK`;
- tests ajoutés dans `narration-module:test:ai-pipeline` et `narration-module:test:narrative-openai-route`.

### A-02 — Validation serveur OpenAI moins stricte que le contrat TypeScript

Priorité : `HAUTE`
Statut : `TRAITE` le 2026-07-09.

Constat : `normalizeAiCallRequest` côté route serveur ne vérifie pas tous les champs validés côté TypeScript, notamment `contextFingerprint`.

Risque : divergence entre le contrat interne et le proxy serveur. Ce type d'écart rend les tests live moins fiables.

Correction recommandée :

- aligner `normalizeAiCallRequest` sur `validateAiCallRequestV1`;
- refuser les requêtes sans `contextFingerprint`;
- tester le rejet.

Correction appliquée :

- `normalizeAiCallRequest` exige maintenant `contextFingerprint`;
- le fingerprint doit respecter le format `sha256:<64 hex>`;
- `input.instructionsRef` est vérifié comme champ obligatoire;
- tests de rejet ajoutés à `narration-module:test:narrative-openai-route`.

### A-03 — Variation de présentation trop proche de l'UI

Priorité : `MOYENNE`
Statut : `TRAITE` le 2026-07-09.

Constat : I-06ZB applique maintenant une variation basée sur l'historique visible dans `NarrativeAppSurface`. Le comportement produit est correct pour l'UI prototype, mais la logique devrait appartenir à une couche application/rendu.

Risque :

- comportement différent entre UI React et futurs consommateurs;
- tests actuels partiellement fondés sur présence de chaînes dans le fichier source;
- difficulté à transmettre ensuite un historique court au `scene_writer`.

Correction recommandée :

- extraire un service `presentationVariation` ou `narrativeRenderContext`;
- lui fournir `priorDisplayPackets`, `rawInput`, `interpretation`, `resolution`;
- remplacer les tests par des assertions comportementales plutôt que `source.includes(...)`.

Correction appliquée :

- service applicatif `presentationVariation` ajouté avec contrat `narrative-presentation-variation/1`;
- `NarrativeAppSurface` délègue maintenant la variation à `applyNarrativePresentationVariationV1`;
- la variation s'appuie sur les `priorPackets` visibles, trace `presentation-variant:<index>` et ne modifie pas les commits métier;
- test comportemental ajouté dans `narration-module:test:scene-controlled-variation`;
- test de surface ajusté pour empêcher le retour de helpers locaux React.

### A-04 — Le `scene_writer` ne participe pas encore aux questions de contexte no-commit

Priorité : `MOYENNE`
Statut : `TRAITE` le 2026-07-09.

Constat : `aiNarrativeEnhancement.shouldCallSceneWriter` retourne `false` pour `NO_COMMIT_RESPONSE`. Les réponses de contexte sont donc locales, même en mode OpenAI.

Décision actuelle : acceptable pour sécuriser I-06ZA/I-06ZB.

Risque produit : le joueur active OpenAI mais les questions de contexte restent limitées par le rendu local, ce qui peut donner l'impression que l'IA ne raconte pas vraiment.

Correction recommandée :

- ouvrir un lot dédié après stabilisation UI : `scene_writer` autorisé pour certaines réponses no-commit de contexte;
- lui transmettre un historique visible court;
- conserver la validation : aucun commit, aucun temps, aucune nouvelle vérité durable.

Correction appliquée :

- `scene_writer` est autorisé pour les réponses `NO_COMMIT_RESPONSE` uniquement si l'intention est `meta_question`, sans temps de jeu, et si le paquet contient déjà un bloc MJ local `:meta-answer`;
- les questions de possibilité restent exclues du `scene_writer`;
- pour ces réponses de contexte, la narration IA remplace le bloc MJ local au lieu d'ajouter un doublon;
- un historique visible court est transmis au pack `scene_writer` : 3 derniers paquets, 6 blocs visibles maximum, texte tronqué;
- les instructions serveur OpenAI précisent que les questions de contexte no-commit doivent rester ancrées dans les perceptions/faits visibles sans action ni temps;
- test `narration-module:test:ai-narrative-enhancement` renforcé sur météo, localisation, historique court et possibilité risquée.

Correctif post-test manuel :

- les réponses locales/fallback de contexte tiennent compte du `coreMeaning` en plus du texte brut pour respecter le sujet identifié par l'interpréteur d'intention;
- la priorité de rendu locale passe maintenant par les cibles précises de scène avant les descriptions générales;
- cas ajoutés : `peut tu me dire ou je suis ?`, `peut tu décrire le garde ?`, `je te demande de décrire le garde`;
- objectif : éviter qu'une demande ciblée sur un PNJ soit absorbée par une description générique de l'auberge.

Correctif diagnostic post-test OpenAI :

- le pipeline distingue maintenant `scene_writer` non appelé et `scene_writer` appelé sans bloc MJ exploitable;
- l'UI affiche `OpenAI appelé, mais aucune narration utilisable...` au lieu du faux diagnostic `OpenAI non appelé`;
- les instructions serveur demandent explicitement un bloc `MJ_NARRATION` pour les questions de contexte no-commit;
- test ajouté pour une sortie OpenAI structurellement valide mais inutilisable (`SYSTEM_NOTICE` sans narration MJ).

Correctif garde-fou de grounding :

- un bloc `scene_writer` est accepté s'il cite au moins une référence exacte autorisée par `task.allowedGrounding`;
- les références supplémentaires non reconnues ne rejettent plus le bloc si une référence autorisée est présente;
- un bloc sans aucune référence autorisée reste rejeté avec le motif `grounding_missing_allowed_ref`;
- objectif : éviter les rejets live trop stricts lorsque le modèle ajoute une référence descriptive en plus des sources contractuelles.

Correctif schéma serveur `scene_writer` :

- le schéma strict OpenAI du rôle `scene_writer` n'autorise plus `SYSTEM_NOTICE`;
- `blockKind` est maintenant limité à `MJ_NARRATION`, car le pipeline de rendu n'exploite que les blocs MJ pour l'enrichissement narratif;
- quand `task.allowedGrounding` est disponible, le schéma strict contraint aussi `groundedIn.items.enum` à ces références exactes;
- l'UI affiche désormais le détail du rejet si aucun bloc MJ utilisable ne passe les garde-fous.

Correctif parsing OpenAI :

- la route serveur accepte désormais un objet JSON strict éventuellement entouré d'un bloc Markdown `json`, puis le valide normalement;
- si aucune extraction JSON n'est possible, le diagnostic `OPENAI_INVALID_JSON` inclut un court aperçu expurgé de la sortie fournisseur;
- le pipeline conserve les messages diagnostics fournisseur expurgés dans `safeDetails.outputDiagnosticMessages`;
- l'UI affiche ces messages dans le résumé de fallback OpenAI pour éviter les diagnostics opaques;
- objectif : distinguer une vraie sortie non JSON d'une sortie JSON valide mal encapsulée.

Correctif budget de sortie `scene_writer` :

- le budget de sortie demandé au `scene_writer` passe de 500 à 1200 tokens;
- la limite de route `scene_writer` passe à 1500 tokens côté UI/tests;
- la limite serveur OpenAI accepte maintenant 1500 tokens pour `scene_writer` tout en gardant 1000 pour les autres rôles;
- le client navigateur relaie désormais l'enveloppe JSON d'erreur serveur même si la route répond en HTTP non-OK;
- raison : l'enveloppe JSON stricte consomme déjà une part significative du budget et les sorties live étaient tronquées avant fermeture du JSON;
- l'autorité métier ne change pas : l'augmentation concerne uniquement la capacité à retourner un objet JSON complet.

Correctif cohérence de texture `scene_writer` :

- les instructions serveur interdisent maintenant explicitement les événements non fournis : porte d'entrée qui s'ouvre, arrivées/sorties, nouveaux clients, silhouettes cachées ou occupants dissimulés;
- les descriptions de personnes doivent se limiter aux PNJ visibles fournis dans le contexte;
- le schéma OpenAI `scene_writer` impose maintenant un audit structuré `factDiscipline` par bloc : faits ajoutés non supportés, usage exclusif des entités visibles fournies, absence de nouvel événement et absence de présence cachée;
- le pipeline rejette les blocs dont `factDiscipline` signale un ajout factuel, un événement nouveau, une entité visible non fournie ou une présence cachée;
- les garde-fous textuels locaux restent limités à une ceinture de sécurité legacy; ils ne doivent pas devenir le moteur principal de compréhension;
- les régressions couvrent les formulations live exactes observées, dont "chaque fois que la porte d'entrée s'ouvre", "autres occupants, absents de la pièce ou discrètement dissimulés" et "convives" non fournis, mais le rejet attendu vient de la discipline factuelle déclarée;
- objectif : conserver la richesse sensorielle sans créer de micro-faits ou présences non sourcées.

### A-05 — Fallback local d'intention encore trop lexical

Priorité : `MOYENNE`

Constat : le fallback local contient encore des motifs lexicaux pour distinguer contexte, possibilité, parole, action. Il est utile pour la sécurité, mais ne doit pas redevenir le moteur principal de compréhension.

Risque : retomber dans l'ancien échec : coder des formulations au lieu de laisser l'IA comprendre l'intention.

Correction recommandée :

- garder le fallback local conservateur;
- éviter d'y ajouter de nouvelles familles de formulations sauf pour empêcher une action dangereuse;
- enrichir plutôt le contrat IA avec des champs sémantiques : `questionScope`, `sceneTopic`, `requestedInformationKind`, `playerCommitmentEvidence`.

### A-06 — Code legacy encore exposé dans `NarrativeTurnController`

Priorité : `BASSE`

Constat : `buildNoCommitOutput` et `buildResponseBlock` restent exposés comme compatibilité historique. Le flux actif utilise maintenant `buildResolvedOutput` et `resolveNarrativeTurnV1`.

Risque : confusion pour les prochaines conversations Codex ou réutilisation accidentelle du vieux chemin.

Correction recommandée :

- identifier les tests/consommateurs restants;
- déprécier explicitement dans le nom ou le commentaire;
- supprimer quand plus aucun test actif ne dépend de ce chemin.

### A-07 — Texte/regex UI avec trace d'encodage corrompu

Priorité : `BASSE`
Statut : `TRAITE` le 2026-07-09.

Constat : `NarrativeConversationPanel.tsx` contient au moins un motif `rÃ©sultat`, probablement issu d'un problème d'encodage.

Risque : faible, car d'autres motifs couvrent les cas courants, mais cela indique une dette qualité dans l'UI.

Correction recommandée :

- remplacer par un motif Unicode correct;
- ajouter une assertion UI sur `aucun résultat` si ce texte doit rester supporté.

Correction appliquée :

- motif remplacé par `aucun résultat`;
- garde de source ajoutée dans `narration-module:test:narrative-react-ui` contre les séquences UTF-8 corrompues.

## Code probablement non mort mais à surveiller

- `mj_planner` dans les types et validateurs IA : présence volontaire pour architecture future, mais le rôle n'est pas ouvert dans la route serveur actuelle.
- `intent_interpreter` legacy : utilisé par les tests I-05/OpenAI provider historiques, à ne pas confondre avec `player_intent_interpreter`.
- `tacticalPlaceholder` : volontairement conservé comme frontière contractuelle, ne pas raccorder au plateau tactique dans le flux narration actuel.

## Recommandation d'ordre

1. Tester manuellement le flux OpenAI sur questions de contexte répétées : météo, localisation, description d'auberge.
2. Reporter le nettoyage legacy A-06 après stabilisation des tests.
3. Ne pas ouvrir `mj_planner` avant d'avoir mesuré la qualité de ce flux.

## Garde-fous pour les prochains lots

- Ne pas ouvrir `mj_planner` tant que la qualité des réponses courtes n'est pas stable.
- Ne pas enrichir le fallback local comme moteur principal de compréhension.
- Toute amélioration OpenAI doit conserver un fallback local sûr.
- Toute variation narrative doit préserver les faits stables et être testée contre les mutations interdites.
