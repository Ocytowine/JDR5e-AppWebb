# Passation de reprise Codex — 2026-08-17

Statut : `ARCHIVE_INSTANTANÉE — NE PAS UTILISER COMME ROADMAP`

Cette passation décrit l'état observé à sa date. Les actions immédiates qu'elle
contient sont terminées ou remplacées. Pour tout nouveau travail, lire
[`Consolidation-fondations-narration.md`](Consolidation-fondations-narration.md),
unique feuille de route active, puis `TASKS.md`.

## But de ce document

Ce document permettait de reprendre le développement dans une nouvelle
discussion sans dépendre de l'historique précédent. Il reste conservé comme
preuve du point de reprise, pas comme consigne actuelle.

## État Git à reprendre

- dépôt : `JDR5e-AppWebb` ;
- branche : `Narration-V4` ;
- commit observé lors de la passation :
  `532b1f2653c08f08cf796b8af5217c534e8f8eeb` (`MaJ - NarrationEvoluer`) ;
- arbre de travail observé le 2026-08-17 : propre ;
- aucun changement local non committé à transférer depuis l'ancien poste.

Sur le nouveau poste, ne pas supposer que ce commit est encore la tête distante.
Commencer par récupérer le dépôt, sélectionner `Narration-V4`, puis comparer
`git status --short --branch` et `git log -5 --oneline` à cet instantané. Ne
jamais écraser des changements locaux trouvés sur le nouveau poste.

## Lecture demandée lors de cette passation historique

Cette liste est conservée pour comprendre le contexte de reprise du 17 août.
Elle ne remplace pas l'ordre de lecture courant défini dans l'index du module.

Lire dans cet ordre :

1. `AGENTS.md` à la racine ;
2. `README.md` à la racine ;
3. `TASKS.md` ;
4. le présent document ;
5. `narration-module/docs/README.md` ;
6. le contrat du domaine effectivement modifié.

Les documents de `docs projet/` sont historiques. Ils ne doivent pas être pris
comme description fiable de l'architecture actuelle sans confrontation au code
et à `package.json`.

## Ce qui a été terminé dans la séquence précédente

### Contrôles d'accès, lots A à F

La verticale de contrôles d'accès est fermée et certifiée :

- lot A : preuve d'inventaire autoritaire, accessibilité, justificatif et
  consommation/conservation atomique ;
- lot B : négociation sociale sans transformer une parole en autorisation ;
- lot C : accès par perception, sans révélation gratuite ;
- lot D : accès par règles et test de compétence persistant ;
- lot E : handoff tactique, checkpoint, outcome validé et intégration atomique ;
- lot F : certification multi-régions sur le contrôle militaire de Tharqual et
  l'obstacle naturel d'Ardherne.

Les contrats détaillés sont `Contrat-acces-par-inventaire.md`,
`Contrat-acces-social.md`, `Contrat-acces-par-perception.md`,
`Contrat-acces-par-regles.md` et `Contrat-acces-par-tactique.md`. La preuve
transverse est `Matrice-certification-controles-acces-multi-regions.md`.

### Certification réelle du pipeline OpenAI navigateur

La gate
`npm run narration-module:test:narrative-pipeline-roles:openai-live` a été
certifiée avec de vrais appels OpenAI sur cinq types de tours : clarification,
action, dialogue, observation et transition.

Résultat final observé :

- 13 appels sur 5 tours ;
- au plus 3 appels facturables par tour ;
- aucun rôle dupliqué ;
- ordre canonique respecté ;
- tous les appels observés en HTTP 200 ;
- aucune autorité métier transférée à l'IA.

Ordre attendu :

| Type de tour | Rôles attendus |
|---|---|
| clarification | `player_intent_interpreter` |
| action | `player_intent_interpreter -> mj_planner -> scene_writer?` |
| dialogue | `player_intent_interpreter -> mj_planner -> npc_performer` |
| observation | `player_intent_interpreter -> mj_planner -> scene_writer?` |
| transition | `player_intent_interpreter -> mj_planner -> scene_writer?` |

Le writer est conditionnel. Lorsqu'il est appelé, il doit être le troisième et
dernier rôle facturable du tour.

Cette certification a conduit à trois corrections :

1. les tests Archives ouvrent explicitement le pilote depuis le nouvel accueil ;
2. une question sur les personnes visibles exige désormais un ancrage sur une
   présence visible, sinon le rendu déterministe est conservé ;
3. la route serveur du `scene_writer` est correctement comptée dans le budget,
   ce qui interdit un quatrième appel au critique.

La preuve complète se trouve dans
`Matrice-certification-pipeline-openai-navigateur.md`.

### Vérifications qui passaient à la fermeture de ce travail

Depuis `test-GAME-2D/` :

```text
npm run narration-module:test:narrative-openai-route
npm run narration-module:test:ai-pipeline
npm run narration-module:test:ai-call-budget
npm run narration-module:test:narrative-turn-controller
npm run narration-module:test:scene-transition
npm run narration-module:test:narrative-app-surface
npm run narration-module:test:ai-narrative-enhancement
npm run build
git diff --check
```

Les tests des lots B à F et la gate navigateur transverse avaient également
passé. Ces résultats décrivent la fermeture du lot ; le nouveau poste doit au
minimum réexécuter les tests ciblés par tout nouveau changement.

## Dernière observation manuelle à ne pas confondre avec un bug métier

Un essai ultérieur dans les Archives a soumis successivement :

- « je sort des archives » ;
- « je me dirige vers la place des archives » ;
- « je vais vers le garde ».

Les trois tours ont été refusés avant interprétation parce que le fournisseur a
répondu :

```text
OpenAI HTTP status 429
code: credit_balance_exhausted
message: You have no credits remaining.
```

Ce diagnostic signifie que le quota du compte OpenAI utilisé était épuisé. Il
ne prouve pas un défaut de compréhension de ces formulations. Le comportement
protecteur a été correct : intention non exploitée, aucun commit et aucun temps
de jeu. Deux tentatives bornées de l'interpréteur apparaissent dans le
diagnostic, puis le pipeline s'arrête.

Ne pas modifier le routeur sémantique pour « corriger » ce 429. Avant toute
recette live sur le nouveau poste :

1. recréer localement `test-GAME-2D/.env` sans le versionner ;
2. fournir `OPENAI_API_KEY` côté serveur et `NARRATION_OPENAI_LIVE=1` ;
3. vérifier le crédit/quota du compte ;
4. demander l'accord du propriétaire avant une nouvelle dépense live ;
5. commencer par les tests locaux sans appel facturé.

La clé ne doit jamais être placée dans Git, envoyée au navigateur ou copiée dans
un rapport de test.

## Travail qui restait ouvert à la date de la passation

Les actions ci-dessous sont depuis terminées ou remplacées par la feuille de
route canonique. Elles sont conservées uniquement pour expliquer les décisions
et validations qui ont suivi.

### Priorité historique : validation manuelle du build

La dernière validation manuelle est interrompue par le quota externe. Une fois
l'accès OpenAI rétabli et autorisé :

1. rejouer depuis une campagne propre la transition vers la Place des Archives ;
2. si elle échoue encore, exploiter le nouveau diagnostic d'étape secondaire et
   corriger cette étape exacte, sans rejouer l'action principale déjà committée ;
3. reproduire puis corriger
   `social.local-initiative-request-conflict`, observé après promotion d'un
   acteur de scène puis rechargement de la campagne ;
4. poursuivre la recette 9F depuis une fiche créée manuellement : contact avec
   le clerc, demande de registres, puis questions personnelles ou opinions.

Si la transition passe une fois le quota rétabli, fermer explicitement la tâche
correspondante dans `TASKS.md` sans inventer de correction de code.

### Chantier historique de conception sémantique

Définir avec les domaines propriétaires les commandes joueur encore absentes de
l'ontologie :

- inventaire ;
- progression ;
- bastion ;
- tactique générique.

Chaque commande ne doit être annoncée comme déclenchable en texte libre que si
un propriétaire déterministe existe, que son manifeste public peut l'exposer et
que son handoff est testable. L'interpréteur propose une intention ; il ne
possède ni l'inventaire, ni la progression, ni le bastion, ni le combat.

À cette date, les autres tâches recensées concernaient la projection typée des
connaissances et états observables du personnage, l'audit des frontières
automatiques, la qualité multi-tours hors Archives et la simulation du monde.
Leur état et leur ordre actuels ne sont définis que dans la feuille de route
canonique.

## Carte minimale du code utile

- `src/narration-ui/NarrativeAppSurface.tsx` : composition réelle de la surface
  React, routes OpenAI et intégrations de campagne ;
- `narration-module/src/application/NarrativeTurnController.ts` : orchestration
  d'un tour, sans autorité métier propre ;
- `narration-module/src/application/aiIntentInterpretation.ts` : construction et
  validation de l'interprétation sémantique ;
- `narration-module/src/application/runtimeCapabilityRouting.ts` : capacités
  publiques et routage vers les propriétaires ;
- `narration-module/src/application/activeSceneNarrative.ts` : enrichissement et
  couverture du rendu de scène ;
- `narration-module/server/narrativeOpenAiEnhancementRoute.js` : route serveur
  OpenAI et sélection des modèles ;
- `src/narration-ui/playableCampaignAccessCatalog.ts` : contrôles d'accès
  installés dans la campagne jouable ;
- `narration-module/tests/browser/` : recettes navigateur et gates live ;
- `narration-module/tests/scene/` et `tests/ai/` : régressions déterministes.

Chercher les adaptateurs et autorités existants avant d'ajouter une nouvelle
abstraction. Une réponse narrative convaincante ne doit jamais masquer un
handoff ou une autorité manquante.

## Procédure de travail attendue

Pour chaque changement :

1. vérifier l'état Git et préserver tout travail local ;
2. reproduire le problème avec un cas négatif et un cas nominal ;
3. nommer le domaine propriétaire de la décision ;
4. modifier le contrat proche si le comportement change ;
5. préparer les effets hors transaction, puis committer atomiquement avec une
   identité stable et un rejeu idempotent ;
6. tester l'autorité seule, l'adaptateur, le contrôleur, le rechargement et la
   recette transverse pertinente ;
7. lancer les vérifications ciblées puis `npm run build` ;
8. relire `git diff`, exécuter `git diff --check` et mettre `TASKS.md` à jour ;
9. ne créer un commit que sur demande explicite du propriétaire.

Ne jamais modifier manuellement un catalogue généré lorsqu'un script de
génération existe. Ne jamais utiliser un reset destructeur pour nettoyer le
dépôt.

## Message de reprise historique — ne plus réutiliser

Ce bloc est l'instruction transmise au moment de la passation. Il est obsolète
et ne constitue ni une procédure actuelle ni une liste de tâches.

```text
Reprends le développement de JDR5e-AppWebb sur la branche Narration-V4.
Lis intégralement AGENTS.md, README.md, TASKS.md, puis
test-GAME-2D/narration-module/docs/Passation-reprise-Codex-2026-08-17.md et
l'index documentaire du module. Vérifie d'abord git status et les derniers
commits : l'instantané de passation était propre au commit 532b1f2.

Ne refais pas les lots d'accès A à F ni la certification du pipeline OpenAI :
ils sont terminés. Le dernier essai manuel a échoué uniquement sur un HTTP 429
credit_balance_exhausted ; ne traite pas ce quota comme un bug sémantique et ne
lance aucun appel payant sans mon accord.

Commence par auditer les tâches encore ouvertes de la validation manuelle dans
TASKS.md. Une fois le quota disponible et avec mon accord, la reprise prioritaire
est la transition vers la Place des Archives, puis le conflit
social.local-initiative-request-conflict. Sinon, avance sur le prochain chantier
local déterministe : cadrer avec les propriétaires les commandes texte libre
manquantes pour inventaire, progression, bastion et tactique générique.

Préserve les autorités métier locales, le plafond de trois appels OpenAI par
tour, l'idempotence et l'absence de commit/temps en cas de rejet. Mets à jour les
tests, la documentation proche et TASKS.md, lance les régressions pertinentes et
npm run build, mais ne crée aucun commit sans demande explicite.
```
