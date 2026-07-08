# Plan d'implémentation du module narration

Statut : `EN_EXECUTION` — I-00 à I-06W livrés dans leur périmètre; audit I-07 tactique/repos terminé et I-07A à I-07D livrés; I-02 conserve une réserve tactique différée; I-08 reste fermé jusqu'à sa gate.

## Principes d'exécution

- Un seul lot est ouvert à la fois.
- Chaque lot commence par résoudre ses lignes `AF-R` dans [`Audit-final.md`](Audit-final.md).
- Une capacité n'entre pas au lot précédent sous forme de stub devenu implicitement contractuel.
- Chaque mutation reste derrière le domaine propriétaire et `CampaignRepository`.
- Les tests déterministes précèdent le branchement d'un fournisseur IA.
- Un lot ne passe au suivant qu'après ses commandes de vérification, scénarios associés, revue du diff et mise à jour de `TASKS.md`.

## I-00 — Noyau `campaign-core/1`

Statut : `TERMINE` le 2026-07-02.

### Objectif

Implémenter exactement [`Contrat-noyau-campagne.md`](Contrat-noyau-campagne.md) sans comportement narratif.

### Périmètre prévu

```text
narration-module/
  src/core/
    contracts/
    validation/
    repository/
    canonical-json/
  tests/contracts/
  tsconfig.json
```

Le détail final des fichiers peut suivre les conventions TypeScript, mais les responsabilités ne doivent pas rejoindre `GameBoard.tsx`, `server.js` ou l'UI.

### Choix techniques autorisés

- TypeScript strict;
- AJV déjà présent pour les schémas JSON stricts;
- schémas associés à des types via `JSONSchemaType<T>` ou contrôle équivalent compilé;
- `node:assert/strict` dans un script TypeScript lancé avec la convention `tsx` existante;
- horloge technique, générateur d'identifiants et injection de panne remplaçables dans les tests.

Aucune nouvelle dépendance n'est nécessaire sans preuve d'un manque d'AJV ou des outils présents.

### Scripts à rendre réels

- `narration-module:build` : vérification TypeScript du module;
- `narration-module:test:contracts` : suite commune contre `MemoryCampaignRepository`;
- `narration-module:test:unit` : seulement si des tests unitaires distincts deviennent utiles;
- le `build` global doit inclure le contrôle du nouveau noyau avant de considérer le lot terminé.

### Gate de sortie

- 19 tests contractuels du contrat figé;
- schémas stricts refusant champs inconnus et dépassements de taille;
- aucune dépendance à React, OpenAI, IndexedDB ou aux moteurs;
- aucune modification de l'ancienne route tactique;
- `npm run narration-module:build`, `npm run narration-module:test:contracts` et `npm run build` passent.

### Preuves de livraison

- types stricts, schémas AJV et 31 contrôles compilés de parité structurelle;
- `CampaignRepository` et `MemoryCampaignRepository` sans dépendance applicative;
- 19/19 scénarios contractuels réussis;
- build TypeScript du module et build global réussis;
- revue de périmètre sans React, OpenAI, IndexedDB, carte, tactique ou ancienne route narrative.

## I-01 — Persistance navigateur et migrations

Statut : `TERMINE` le 2026-07-03.

### Objectif

Implémenter `IndexedDbCampaignRepository` derrière la même suite contractuelle, sans changer le contrat métier.

### Prérequis

AF-R03 résolu par [`Contrat-persistance-indexeddb.md`](Contrat-persistance-indexeddb.md) : schéma physique des stores, transactions, générations, migrations, quota et tests navigateur figés.

### Scénarios

NAR-ACC-013, NAR-ACC-018 et parties persistance de NFR-ACC-001.

### Gate

La suite contractuelle passe sans variante spécifique permissive; fermeture, issue inconnue, migration et lecture seule sont vérifiées dans un navigateur cible.

### Preuves de livraison

- `IndexedDbCampaignRepository` derrière le port I-00 et IndexedDB natif;
- 12 stores, index de lecture et de copie bornée, transactions courtes et contrôle multi-connexion;
- migration par générations avec lease renouvelable, empreinte, vérification post-activation, rollback et sauvegarde confirmable;
- 19/19 contrats communs dans Chrome et 15/15 scénarios IndexedDB spécifiques;
- fermeture, issue inconnue, version future, `versionchange`, quota, ancienne connexion et lecture seule vérifiés;
- `npm run narration-module:build`, `npm run narration-module:test:contracts`, `npm run narration-module:test:indexeddb` et `npm run build` réussis.

## I-02 — Bootstrap de campagne, contenu, personnage et règles

Statut : `TERMINE DANS SON PERIMETRE NARRATIF` le 2026-07-06; contrats lore, import, règles, persistance atomique et orchestration implémentés. La matrice de preuves couvre 13 exigences sur 14; la parité directe avec le plateau reste explicitement différée avec sa jonction et ne transfère aucune autorité tactique au module narration.

### Objectif

Créer une campagne réelle depuis le wiki épinglé, une fiche importée et un ruleset maison versionné.

### Prérequis

Résolus par [`Contrat-bootstrap-campagne.md`](Contrat-bootstrap-campagne.md) et [`Contrat-contenu-lore.md`](Contrat-contenu-lore.md) : AF-R04 à AF-R07, soit écriture atomique spécialisée, paquets de contenu, schéma wiki, import personnage et `RuleRegistry` MVP.

### Scénarios

Checkpoint A de NAR-ACC-002, NAR-ACC-008, NAR-ACC-009 et NAR-ACC-021.

### Gate

Les Archives de Lysenthe et la fiche prête à jouer sont importées sans lecture directe des caches UI; toute donnée dérivée est recalculée et toute règle cite sa version.

## I-03 — Temps, monde et processus

Statut : `TERMINE` le 2026-07-07; I-03A, I-03B, I-03C et I-03D implémentés et vérifiés. La revue de gate est consignée dans [`Matrice-preuves-I03.md`](Matrice-preuves-I03.md).

### Objectif

Connecter horloge précise, échéancier causal, voyage et processus sauvegardables au `map-module` sans seconde horloge.

### Prérequis

AF-R12 et contrats de processus communs nécessaires à AF-R14.

### Scénarios

NAR-ACC-007, NAR-ACC-010, NAR-ACC-020 et exemple de chronologie causale.

### Gate

Ordre simultané, interruption, rattrapage et rejeu d'un batch produisent les mêmes événements sans double effet.

## I-04 — Mémoire, snapshot et contextes

### Objectif

Construire rappel hybride, `TurnSnapshot` et `RoleContextPack` sans fournisseur IA réel.

### Prérequis

AF-R08 et AF-R09 sont résolus par [`Contrat-memoire-snapshot.md`](Contrat-memoire-snapshot.md), version `memory-context/1`. AF-M03 reste une mesure de capacité avant certification, pas un blocage du port déterministe.

### Scénarios

NAR-ACC-004, NAR-ACC-005, NAR-ACC-015 et partie perspective de NAR-ACC-006.

### Gate

Rappel paraphrasé, secret, provenance, budget et obsolescence passent sur fixtures; index supprimé puis reconstruit sans perte de vérité.

## I-05 — Pipeline IA et créations dynamiques

### Objectif

Implémenter les rôles avec un faux fournisseur contractuel, puis brancher un adaptateur réel certifiable.

### Prérequis

AF-R10, AF-R11, AF-R15 et AF-C02 sont résolus pour le sous-lot I-05A par [`Contrat-pipeline-ia-creations.md`](Contrat-pipeline-ia-creations.md), version `ai-pipeline/1`. Aucune clé dans le navigateur et aucun fournisseur réel ne sont autorisés avant certification.

### Scénarios

NAR-ACC-001, NAR-ACC-003, NAR-ACC-006, NAR-ACC-014, NAR-ACC-016 et NAR-ACC-019.

### Gate

Les tests déterministes passent avec faux fournisseur; sorties invalides, retries, secrets, circuit et fallback passent avant toute certification qualitative réelle.

### Autorisation I-05A

I-05A couvre uniquement types, validateurs, ports, faux fournisseur contractuel, orchestration de sorties de rôle et fixtures NAR-ACC-001/003/006/014/016/019. Le branchement d'un fournisseur distant devient un futur sous-lot I-05B après preuves I-05A et certification fournisseur.

### Preuves de livraison I-05A

- `AiModelRouteV1`, `AiCallRequestV1`, `AiRoleOutputEnvelopeV1`, payloads de rôles, propositions de création, retry, incident et circuit breaker;
- `FakeContractAiProviderV1` déterministe sans réseau;
- validation stricte des enveloppes, corrélation et sorties;
- rejet de `REMOTE_PROVIDER` et fallback non certifié dans le périmètre I-05A;
- tests `narration-module:test:ai-pipeline` et `narration-module:test:dynamic-creation`;
- régressions I-00 à I-04 et build global réussis.

### Autorisation I-05B

I-05B couvre uniquement [`Contrat-fournisseur-ia-openai.md`](Contrat-fournisseur-ia-openai.md), version `ai-provider-openai/1` : adaptateur serveur OpenAI, clé côté serveur, schémas de sortie stricts, transport simulable, retries, métriques, incidents expurgés et smoke test live optionnel. Les routes historiques tactiques peuvent rester en place, mais le module narration ne doit pas les utiliser comme contrat fournisseur.

### Preuves de livraison I-05B

- `OpenAiResponsesProviderV1` derrière transport injecté, sans SDK obligatoire;
- résolution de clé depuis `process.env`, `test-GAME-2D/.env` ou `.env` racine ignoré;
- construction d'appel Responses API avec sortie structurée stricte;
- tests réseau simulés pour clé absente, 401/403, 429, sortie invalide et sortie valide;
- smoke live optionnel désactivé sans `NARRATION_OPENAI_LIVE=1`;
- régressions I-00 à I-05A et build global réussis.

## I-06 — Scène, social et interface conversationnelle

### Objectif

Assembler opérations, actes de parole, prose finale et `InteractionLog` dans une UI accessible à plusieurs locuteurs.

### Prérequis

AF-R16 est résolu pour I-06A par [`Contrat-scene-social-ui.md`](Contrat-scene-social-ui.md), version `scene-social-ui/1`.

### Scénarios

Checkpoint B de NAR-ACC-002, NAR-ACC-009 et NAR-ACC-017.

### Gate

Entrée brute, expression du PJ, PNJ et narration restent distincts; aucune couleur n'est l'unique repère; la perte du cache de transcript est reconstructible.

### Autorisation I-06A

I-06A couvre uniquement types, validateurs, projections déterministes, politiques de rythme, fixtures et tests de `SceneDomain`, `SocialKnowledgeDomain`, `InteractionLog`, `RenderPlan` et `DisplayPacket`.

L'intégration React complète, le streaming fournisseur, le routage UI vers OpenAI, tactique, repos et certification UX finale restent hors périmètre.

### Preuves de livraison I-06A

- `SceneStateV1`, `SocialKnowledgeStateV1`, `SpeakerRefV1`, `SpeechActRecordV1`, `RenderPlanV1`, `DisplayPacketV1`, `InteractionLogEntryV1` et clarification suspendue;
- validateurs stricts pour scène, social, blocs exacts, affichage accessible et transcript;
- projection `RenderPlan` vers `DisplayPacket`;
- reconstruction d'`InteractionLog` depuis sources durables;
- politique de rythme configurable;
- test `narration-module:test:scene-social-ui`;
- matrice [`Matrice-preuves-I06A.md`](Matrice-preuves-I06A.md).

### Autorisation I-06B

I-06B est autorisé par [`Contrat-interface-narrative-react.md`](Contrat-interface-narrative-react.md), version `narrative-react-ui/1`.

Il couvre uniquement composants React purs, affichage de `DisplayPacketV1`, saisie libre par callback, `clientRequestId`, rendu accessible et tests anti-appel réseau. Le branchement dans `GameBoard.tsx`, l'orchestrateur serveur narratif et le fournisseur réel depuis l'UI restent hors périmètre.

### Preuves de livraison I-06B

- composant `NarrativeConversationPanel` dans `src/ui/`;
- rendu statique PJ, PNJ et MJ;
- saisie libre par callback avec `clientRequestId`;
- contrôle source contre `fetch`, routes IA historiques et stockage local;
- test `narration-module:test:narrative-react-ui`;
- matrice [`Matrice-preuves-I06B.md`](Matrice-preuves-I06B.md).

### Autorisation I-06C

I-06C est autorisé par [`Contrat-surface-narration-app.md`](Contrat-surface-narration-app.md), version `narrative-app-surface/1`.

Il couvre uniquement la séparation applicative entre surface narration dédiée et surface tactique, sans orchestrateur narratif réel. `GameBoard.tsx` reste tactique et ne doit pas importer le runtime narration.

### Preuves de livraison I-06C

- `App.tsx` distingue surface narration et surface tactique;
- `main.tsx` monte `App` au lieu de `GameBoard` directement;
- `NarrativeAppSurface` n'importe pas `GameBoard`;
- prototype local non autoritaire pour les entrées brutes;
- test `narration-module:test:narrative-app-surface`;
- matrice [`Matrice-preuves-I06C.md`](Matrice-preuves-I06C.md).

### Autorisation I-06D

I-06D est autorisé par [`Contrat-controleur-tour-narratif.md`](Contrat-controleur-tour-narratif.md), version `narrative-turn-controller/1`.

Il couvre uniquement un contrôleur applicatif prototype : saisie libre vers `OperationRecord`, complétion `NO_COMMIT_RESPONSE`, `DisplayPacketV1`, idempotence et horloge inchangée.

### Preuves de livraison I-06D

- `NarrativeTurnControllerV1`;
- bootstrap campagne prototype mémoire;
- intégration de la surface narration au contrôleur;
- test `narration-module:test:narrative-turn-controller`;
- matrice [`Matrice-preuves-I06D.md`](Matrice-preuves-I06D.md).

### Autorisation I-06E

I-06E est autorisé par [`Contrat-interpretation-clarification.md`](Contrat-interpretation-clarification.md), version `intent-clarification/1`.

Il couvre uniquement l'interprétation conservatrice, les questions méta, les questions de possibilité, la clarification et la reprise contrôlée sans commit métier.

### Preuves de livraison I-06E

- `intentClarification.ts`;
- intégration au `NarrativeTurnControllerV1`;
- tests méta, possibilité, ambiguïté, suspension, reprise et action non résolue;
- matrice [`Matrice-preuves-I06E.md`](Matrice-preuves-I06E.md).

### Autorisation I-06F

I-06F est autorisé par [`Contrat-resolution-narrative.md`](Contrat-resolution-narrative.md), version `narrative-resolution/1`.

Il couvre uniquement la résolution narrative bornée : ordre du pipeline, reformulation fidèle du personnage joueur, séparation proposition/validation/commit/rendu, protection des questions de possibilité, limites de création IA et handoffs obligatoires vers les domaines non ouverts.

Il n'autorise pas encore MJ complet, streaming fournisseur, tactique jouable, repos jouable, progression de personnage, création persistante automatique ou intrigue dynamique committable.

### Preuves de livraison I-06F

- `narrativeResolution.ts`;
- intégration au `NarrativeTurnControllerV1`;
- commit borné d'une parole joueur explicite avant rendu;
- handoffs inventaire et tactique sans résolution inventée;
- tests possibilité, reformulation fidèle, idempotence, conflit d'idempotence et horloge inchangée;
- matrice [`Matrice-preuves-I06F.md`](Matrice-preuves-I06F.md).

### Autorisation I-06G

I-06G est autorisé par [`Contrat-resolution-ia-bornee.md`](Contrat-resolution-ia-bornee.md), version `narrative-ai-resolution/1`.

Il couvre uniquement l'enrichissement IA du rendu visible après résolution : expression PJ, narration MJ ancrée, fallback et incidents expurgés. Il ne modifie pas les résultats métier I-06F.

### Preuves de livraison I-06G

- `aiNarrativeEnhancement.ts`;
- utilisation des rôles `player_expression_adapter` et `scene_writer`;
- rejet d'une reformulation ajoutant un engagement;
- ajout d'une narration MJ ancrée;
- handoff tactique rendu plus vivant sans résolution de combat;
- test `narration-module:test:ai-narrative-enhancement`;
- matrice [`Matrice-preuves-I06G.md`](Matrice-preuves-I06G.md).

### Preuves de livraison I-06H

- `NarrativeAppSurface` branche l'enrichissement IA prototype via `FakeContractAiProviderV1`;
- `OpenAiContractAiProviderV1` rend OpenAI compatible avec `ContractAiProviderV1`;
- l'UI navigateur n'importe pas `openaiProvider`;
- tests `narration-module:test:narrative-app-surface`, `narration-module:test:openai-provider` et build global;
- matrice [`Matrice-preuves-I06H.md`](Matrice-preuves-I06H.md).

### Preuves de livraison I-06I

- route serveur `POST /api/narration/enhance-openai`;
- opt-in `NARRATION_OPENAI_LIVE=1`;
- refus sans clé avant appel réseau;
- roles bornés `player_expression_adapter` et `scene_writer`;
- sortie Responses API structurée stricte via `text.format`;
- test `narration-module:test:narrative-openai-route`;
- matrice [`Matrice-preuves-I06I.md`](Matrice-preuves-I06I.md).

### Preuves de livraison I-06J

- sélecteur UI `IA narrative : Locale / OpenAI`;
- client navigateur dédié vers `/api/narration/enhance-openai`;
- fallback automatique vers faux fournisseur local;
- interdiction d'appel OpenAI direct, clé ou `openaiProvider` dans le navigateur;
- calibration post-live : pas d'appel `scene_writer` sur `NO_COMMIT_RESPONSE` méta/informatif sans matière fictionnelle;
- tests `narration-module:test:narrative-app-surface` et `narration-module:test:narrative-openai-route`;
- matrice [`Matrice-preuves-I06J.md`](Matrice-preuves-I06J.md).

### Preuves de livraison I-06K

- contrat applicatif `narrative-render-projection/1`;
- opération secondaire `narrative.render.projection` idempotente;
- persistance du `DisplayPacketV1` final après enrichissement IA;
- stockage des incidents IA expurgés avec autorité `PRESENTATION_ONLY`;
- absence de commit métier, temps de jeu ou remplacement de l'opération source;
- branchement de la surface narration prototype à l'enregistrement durable du rendu;
- test `narration-module:test:narrative-render-projection`;
- matrice [`Matrice-preuves-I06K.md`](Matrice-preuves-I06K.md).

### Preuves de livraison I-06L

- lecture bornée `CampaignRepository.listOperations`;
- reconstruction `narrative-rendered-thread/1` depuis les opérations `narrative.render.projection`;
- méthode `NarrativeTurnControllerV1.restoreRenderedThread`;
- surface narration qui restaure le fil visible au montage;
- contrôleur prototype navigateur sur IndexedDB avec fallback mémoire;
- tests `narration-module:test:contracts:core`, `narration-module:test:narrative-render-projection` et `narration-module:test:narrative-app-surface`;
- matrice [`Matrice-preuves-I06L.md`](Matrice-preuves-I06L.md).

### Preuves de livraison I-06M

- scène narrative de référence `reference-inn-rain-001`;
- contexte concret : auberge, pluie, garde blessé, serveuse nerveuse et porte du fond;
- blocs visibles typés `GM_NARRATION` et `NPC_SPEECH` injectés dans le paquet de rendu;
- parole `je demande au garde...` reconnue comme intention `speech`;
- questions méta, questions de possibilité et clarifications maintenues hors fiction;
- aucune dépendance à `GameBoard.tsx`, `localStorage`, `/api/narration` ou au module tactique réel;
- test `narration-module:test:narrative-turn-controller`;
- matrice [`Matrice-preuves-I06M.md`](Matrice-preuves-I06M.md).

Limite assumée : I-06M ne livre pas encore l'état persistant de scène, la mémoire sociale PNJ, le paquet IA riche `scene_writer`, ni une progression dynamique de la scène. Il sert de base stable pour corriger la narration générique avant de reprendre les intégrations de domaine.

### Preuves de livraison I-06N

- contrat interne `reference-scene-writer-context/1`;
- paquet `RoleContextPackV1` construit pour `scene_writer`;
- contexte concret transmis : Auberge du Seuil, pluie, garde blessé, serveuse nerveuse et porte du fond;
- `contextFingerprint` stable dérivé du paquet;
- `task.allowedGrounding` limité aux références `resolution:*` et `reference-scene:*`;
- validation stricte des `groundedIn` des blocs IA;
- fallback local UI ancré dans la scène de référence;
- test `narration-module:test:ai-narrative-enhancement`;
- matrice [`Matrice-preuves-I06N.md`](Matrice-preuves-I06N.md).

Limite assumée : I-06N ne livre pas encore l'état persistant de scène ni la mémoire courte PNJ. Ces deux sujets deviennent les suites I-06O et I-06P.

### Preuves de livraison I-06O

- contrat interne `reference-scene-state/1`;
- agrégat stable `scene.state` pour `reference-inn-rain-001`;
- mutation atomique de l'état scène lors d'une parole committée;
- observations sans commit maintenues non mutantes;
- rendu post-commit capable d'utiliser l'état persisté;
- sortie contrôleur enrichie avec `sceneState`;
- paquet `scene_writer` enrichi avec un bloc `scene-state`;
- tests `narration-module:test:narrative-turn-controller` et `narration-module:test:ai-narrative-enhancement`;
- matrice [`Matrice-preuves-I06O.md`](Matrice-preuves-I06O.md).

Limite assumée : I-06O ne livre pas encore la mémoire courte PNJ ni la continuité détaillée acteur par acteur. Ce sujet devient I-06P.

### Preuves de livraison I-06P

- mémoire courte PNJ `shortTermNpcMemory` dans `reference-scene-state/1`;
- borne de conservation à 5 entrées;
- résumé de continuité ajouté lors d'une parole committée au garde;
- réponse PNJ non répétitive sur deuxième échange;
- paquet `scene_writer` enrichi avec `Mémoire courte PNJ`;
- libération du writer lease après commit pour autoriser plusieurs paroles successives;
- tests `narration-module:test:narrative-turn-controller` et `narration-module:test:ai-narrative-enhancement`;
- matrice [`Matrice-preuves-I06P.md`](Matrice-preuves-I06P.md).

Limite assumée : I-06P ne livre pas encore une mémoire sociale générique, multi-PNJ et résumée automatiquement. Cette couche devra être généralisée après validation du scénario vertical.

### Preuves de livraison I-06Q

- scénario vertical fixe de 12 entrées joueur sur `reference-inn-rain-001`;
- vérification du contrôleur narratif, du mode local et d'un mode OpenAI-compatible simulé sans réseau;
- oracles qualité sur ancrage, méta hors fiction, possibilité sans action, continuité PNJ et absence de mutation durable inventée;
- script `narration-module:test:vertical-quality`;
- écarts priorisés pour I-06R dans [`Matrice-preuves-I06Q.md`](Matrice-preuves-I06Q.md).

Limite assumée : I-06Q mesure et documente les défauts; il ne les corrige pas. Le live OpenAI réel reste opt-in et peut compléter la matrice par trace manuelle.

### Preuves de livraison I-06R

- correction des questions de possibilité sociale simples en `possibility_query`;
- réponse de localisation contextualisée dans l'Auberge du Seuil, sans commit et sans temps;
- réponse ciblée de la `Serveuse nerveuse` et mémoire courte associée;
- test vertical renforcé sur les trois défauts mesurés en I-06Q;
- matrice [`Matrice-preuves-I06R.md`](Matrice-preuves-I06R.md).

Limite assumée : les corrections restent propres à la scène de référence. La généralisation légère devient I-06S.

### Preuves de livraison I-06S

- contrat `playable-scene-state/1` avec éléments visibles, PNJ, points d'intérêt, tension, faits connus, mémoire courte et politique `scene_writer`;
- migration légère de `reference-inn-rain-001` vers une fixture `PlayableSceneStateV1`;
- deuxième fixture `watchtower-dawn-001`;
- helpers déterministes réutilisables pour localisation, observation, possibilité sociale et ciblage PNJ;
- test `narration-module:test:playable-scene`;
- matrice [`Matrice-preuves-I06S.md`](Matrice-preuves-I06S.md).

Limite assumée : la sélection dynamique de scènes, l'intégration wiki, les créations éphémères et le moteur MJ complet restent fermés.

### Preuves de livraison I-06T

- adaptateur `lore-playable-scene-adapter/1`;
- compilation du lieu wiki réel `archives_de_lysenthe`;
- transformation en `PlayableSceneStateV1`;
- autorisation limitée aux fragments `COMMUN` et `LOCAL`;
- exclusion vérifiée des fragments `MJ_SECRET` du texte visible et de `scene_writer.mayReference`;
- test `narration-module:test:lore-playable-scene`;
- matrice [`Matrice-preuves-I06T.md`](Matrice-preuves-I06T.md).

Limite assumée : I-06T ne livre pas encore de sélection UI, de batch sur tout le wiki, de révélation contrôlée de secrets ni de création éphémère.

### Preuves de livraison I-06U

- contrat `scene-ephemeral-creation/1`;
- politique transitoire dérivée d'une `PlayableSceneStateV1`;
- acceptation stricte de détails sensoriels, bruits ponctuels, figurants anonymes et obstacles mineurs;
- expiration obligatoire en fin de tour;
- interdiction de promotion durable, lore, objet utile, PNJ durable, secret, indice et conséquence tactique;
- test `narration-module:test:scene-ephemeral-creation`;
- matrice [`Matrice-preuves-I06U.md`](Matrice-preuves-I06U.md).

Limite assumée : I-06U ne branche pas encore ces propositions au fournisseur OpenAI réel et ne définit pas de mécanique de révélation contrôlée de secret.

### Preuves de livraison I-06V

- contrat `plot-preparation-gate/1`;
- gate de préparation issue de `Coherence-intrigues.md`;
- critères obligatoires pour vérité cachée opaque, engagements narratifs, deux voies d'indice, fausse piste réfutable, perspectives d'acteurs, chronologie causale, contradiction et révélation par scène;
- blocage explicite de texte secret, résumé d'intrigue, indice concret et création runtime d'intrigue;
- test `narration-module:test:plot-preparation`;
- matrice [`Matrice-preuves-I06V.md`](Matrice-preuves-I06V.md).

Limite assumée : I-06V ne crée pas encore de graphe d'intrigue, ne choisit aucune vérité cachée et ne branche pas `coherence_critic` à un fournisseur IA.

### Preuves de livraison I-06W

- revue UX ciblée de `NarrativeConversationPanel` et `NarrativeAppSurface`;
- badges accessibles par bloc pour joueur brut, expression validée, MJ, PNJ, système, clarification, sans commit, aucun temps, IA et fallback;
- rendu des indicateurs via `data-narrative-ux-badge` et `aria-label`, sans dépendre uniquement de la couleur;
- test `narration-module:test:narrative-react-ui` renforcé;
- matrice [`Matrice-preuves-I06W.md`](Matrice-preuves-I06W.md).

Limite assumée : I-06W ne livre pas le lecteur UX complet d'historique, ni une refonte visuelle complète, ni une nouvelle orchestration narrative.

## I-07 — Tactique et repos

### Objectif

Réaliser les handoffs sauvegardables et intégrer leurs résultats une seule fois.

### Prérequis

AF-R13 et AF-R14 sont résolus par [`Contrat-handoffs-tactique-repos.md`](Contrat-handoffs-tactique-repos.md), version `tactical-rest-handoff/1`. La route historique `/api/narration` ne devient pas le contrat I-07.

### Scénarios

NAR-ACC-011, NAR-ACC-012 et checkpoints C/D de NAR-ACC-002.

### Gate

Combat terminé non rejouable, conséquences atomiques, repos segmenté et signaux UI issus uniquement des événements committés.

### Autorisation I-07A

I-07A couvre uniquement types, validateurs, fixtures déterministes, persistance d'un processus actif et intégration idempotente d'outcomes simulés pour tactique et repos.

Il n'autorise pas encore combat complet dans `GameBoard.tsx`, IA tactique complète, génération automatique de carte tactique, repos complet avec toutes les règles de classe, progression de personnage ou remplacement global des routes historiques.

### Preuves de livraison I-07A

- `ProcessHandoffV1`, `ProcessCheckpointV1`, `TacticalEncounterSeedV1`, `TacticalOutcomeV1`, `RestSeedV1`, `RestOutcomeV1`;
- intégration unique d'un outcome tactique simulé;
- état `COMPLETED_PENDING_INTEGRATION` si l'intégration échoue après fin de processus;
- repos déclenché uniquement par intention explicite;
- signaux `rest_started`, `rest_completed`, `rest_interrupted` ou `rest_failed` dérivés d'événements committés;
- test dédié `narration-module:test:tactical-rest-handoff`;
- matrice [`Matrice-preuves-I07A.md`](Matrice-preuves-I07A.md).

Limite assumée : I-07A porte les durées dans les outcomes mais ne committe pas encore l'avance de l'agrégat `world.clock`; ce raccord doit être ouvert en I-07B avec le kernel temporel.

### Preuves de livraison I-07B

- batch temporel `PROCESS_BOUNDARY` construit depuis un outcome de handoff;
- intégration temporelle via `prepareTemporalSegmentCommitV1`;
- écriture atomique de `world.clock`, `process.handoff`, deltas métier et événement principal;
- retry idempotent sans double horloge, dégâts, ressources ou événement;
- repos interrompu avec durée réelle committée et bénéfice long non accordé;
- test dédié `narration-module:test:tactical-rest-handoff`;
- matrice [`Matrice-preuves-I07B.md`](Matrice-preuves-I07B.md).

Limite assumée : I-07B ne livre pas encore la segmentation jouable du repos, les checkpoints intermédiaires, la simulation mondiale pendant les frontières horaires de repos long, ni le branchement réel au plateau tactique.

### Preuves de livraison I-07C

- état propriétaire `RestProcessStateV1` persistable en agrégat `rest.process`;
- création d'un repos segmenté depuis `RestSeedV1`;
- progression segment par segment avec checkpoint/fingerprint;
- commit temporel atomique de chaque segment via `prepareTemporalSegmentCommitV1`;
- retry sans double temps, double consommation ou double événement;
- bénéfice de repos accordé uniquement à la durée cible;
- interruption déterministe à graine stable sans bénéfice long indu;
- test dédié `narration-module:test:tactical-rest-handoff`;
- matrice [`Matrice-preuves-I07C.md`](Matrice-preuves-I07C.md).

Limite assumée : I-07C ne livre pas encore l'UI de repos jouable, les choix interactifs complets, les règles exhaustives de classe/sorts/fatigue, ni la simulation mondiale aux frontières horaires longues.

### Preuves de livraison I-07D

- placeholder tactique `resolveTacticalPlaceholderV1`;
- production déterministe d'un `TacticalOutcomeV1` depuis `TacticalEncounterSeedV1`;
- scénarios contrôlés `VICTORY`, `FLEE`, `CAPTURE`, `SURRENDER`, `TECHNICAL_FAILURE`;
- checkpoints simulés et empreintes stables;
- intégration temporelle idempotente d'un outcome placeholder;
- absence de dépendance à `GameBoard.tsx`, `localStorage` ou `/api/narration`;
- test dédié `narration-module:test:tactical-rest-handoff`;
- matrice [`Matrice-preuves-I07D.md`](Matrice-preuves-I07D.md).

Limite assumée : I-07D ne livre pas le combat réel, l'IA tactique, la grille, la portée, la vision, la couverture, la génération de carte ou l'adaptation du prototype `GameBoard.tsx`.

## I-08 — Certification verticale et non fonctionnelle

### Objectif

Exécuter le corpus intégré, le benchmark long et les évaluations fournisseur/UX.

### Prérequis

AF-M01 à AF-M06 résolus ou écart explicitement refusé. NFR-ACC-001 exécutable.

### Scénarios

NAR-ACC-001 à 021, NFR-ACC-001 et parcours complet NAR-ACC-002.

### Gate

Seuils de latence, qualité, coût, mémoire, stockage et sécurité mesurés; aucune tolérance zéro violée; rapport de certification conservé.

## Ordre de dépendance

```text
I-00 -> I-01 -> I-02
                  |-> I-03 -|
                  |-> I-04 -|-> I-05 -> I-06 -> I-07 -> I-08
```

I-03 et I-04 peuvent être préparés indépendamment après I-02, mais aucune intégration concurrente dans la même branche n'est requise. Le passage au lot suivant reste séquentiel dans `TASKS.md`.

## Autorisation actuelle

I-00 à I-06W sont terminés dans leur périmètre déclaré, et I-07A à I-07D restent disponibles comme socle tactique/repos différé. Le cadrage de sortie I-06 est consigné dans [`Sortie-phase-I06.md`](Sortie-phase-I06.md). La prochaine étape narrative autorisée est le cadrage limité d'I-06X : interprétation IA structurée de l'intention joueur, sans autorité de commit. I-07E, I-08, le MJ complet, les intrigues dynamiques et les handoffs jouables restent fermés tant qu'ils ne sont pas explicitement rouverts.
