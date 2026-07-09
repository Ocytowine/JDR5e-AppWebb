# Suivi des prochains lots narration

Date : 2026-07-08
Statut : `SUIVI_ACTIF`

## Intention

Ce document garde le cap des prochains lots après I-06R. Il sert à éviter deux dérives :

- empiler des couches techniques sans tester la qualité réelle de narration;
- repartir trop vite vers le tactique, les intrigues ou la mémoire long terme alors que la scène de référence doit d'abord prouver qu'elle fonctionne en jeu.

Les lots ci-dessous restent des intentions de travail. Chaque lot devra être confirmé dans `TASKS.md`, livré avec preuves, puis consigné dans une matrice dédiée.

## État de départ

Déjà livré dans le périmètre prototype narration :

- scène de référence `reference-inn-rain-001`;
- contexte IA `scene_writer` ancré;
- état minimal `scene.state`;
- mémoire courte PNJ bornée;
- fallback local ancré;
- OpenAI opt-in côté serveur;
- séparation maintenue avec le module tactique réel.

Ce qui reste fermé :

- MJ complet de campagne;
- moteur PNJ générique;
- mémoire sociale long terme;
- intrigues dynamiques;
- créations persistantes automatiques;
- branchement tactique réel;
- lecteur UX complet d'historique.

## I-06Q — Scénario vertical qualité Locale/OpenAI

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-08.
Preuves : [`Matrice-preuves-I06Q.md`](Matrice-preuves-I06Q.md), `npm run narration-module:test:vertical-quality`.

Objectif : tester réellement la scène sur 10 à 15 entrées joueur, en mode local puis OpenAI, avant d'ajouter une nouvelle couche.

Ce lot doit produire :

- une liste fixe d'entrées joueur;
- des critères observables de réussite;
- une trace de sortie locale;
- une trace de sortie OpenAI si la route est disponible;
- une matrice d'écarts;
- des décisions de correction priorisées.

Critères à vérifier :

- la réponse est ancrée dans l'Auberge du Seuil;
- les questions méta restent hors fiction;
- les questions de possibilité ne déclenchent pas l'action;
- le garde ne répète pas mécaniquement la même réponse;
- l'IA ne crée pas d'objet, PNJ, secret ou conséquence durable non autorisée;
- l'OpenAI enrichit sans prendre l'autorité métier;
- le fallback local reste acceptable.

Sortie attendue :

- `Matrice-preuves-I06Q.md`;
- un script de test ou une fixture de scénario vertical;
- une liste claire des défauts à corriger ensuite.

Défauts mesurés à reprendre en I-06R :

- classification trop générale de certaines questions sociales simples;
- réponses informatives de localisation sûres mais trop pauvres;
- logique PNJ encore centrée sur le garde même quand la serveuse est ciblée;
- trace OpenAI live réelle encore manuelle/opt-in, non intégrée à la suite déterministe.

## I-06R — Corrections qualité issues du scénario vertical

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-08.
Preuves : [`Matrice-preuves-I06R.md`](Matrice-preuves-I06R.md), `npm run narration-module:test:vertical-quality`.

Objectif : corriger uniquement les défauts observés en I-06Q.

Ce lot ne doit pas inventer une architecture nouvelle. Il doit partir des écarts mesurés.

Corrections probables :

- meilleure classification des demandes du joueur;
- meilleure réponse aux demandes de localisation/météo en scène;
- amélioration du fallback local;
- durcissement des refus IA si elle invente trop;
- ajustement du style de narration pour éviter le texte vague.

Sortie attendue :

- matrice des défauts corrigés;
- tests de non-régression sur les entrées problématiques;
- décision sur le niveau de qualité acceptable avant généralisation.

Corrections livrées :

- question sociale simple classée `possibility_query`;
- localisation contextualisée dans l'Auberge du Seuil sans commit ni temps;
- réponse et mémoire courte distinctes pour la serveuse nerveuse.

## I-06S — Généralisation légère de scène

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-08.
Preuves : [`Matrice-preuves-I06S.md`](Matrice-preuves-I06S.md), `npm run narration-module:test:playable-scene`.

Objectif : sortir progressivement du cas unique `reference-inn-rain-001` sans créer encore un moteur complet.

Ce lot doit transformer la scène de référence en modèle minimal réutilisable :

- définition d'un contrat `playable-scene-state/1`;
- description des éléments visibles;
- PNJ présents;
- tensions courantes;
- portes/objets/points d'intérêt;
- mémoire courte locale;
- règles de rendu/fallback.

Ce lot ne doit pas encore charger tout le wiki ni générer des lieux dynamiques.

Sortie attendue :

- contrat de scène jouable minimal;
- migration de la scène actuelle vers ce contrat;
- test prouvant qu'une deuxième scène fixture peut fonctionner.

Livré :

- contrat `playable-scene-state/1`;
- fixture `reference-inn-rain-001`;
- fixture `watchtower-dawn-001`;
- helpers de rendu déterministe pour localisation, observation, possibilité sociale et ciblage PNJ.

## I-06T — Intégration wiki minimale pour lieux existants

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-08.
Preuves : [`Matrice-preuves-I06T.md`](Matrice-preuves-I06T.md), `npm run narration-module:test:lore-playable-scene`.

Objectif : utiliser une base de lieu issue du wiki sans demander à l'IA de tout inventer.

Ce lot doit déterminer comment prendre un lieu existant et en faire une scène jouable :

- sélection d'un lieu wiki;
- extraction des faits visibles;
- distinction faits publics / secrets / inconnus;
- création d'une scène runtime dérivée;
- budget de contexte envoyé à l'IA.

Sortie attendue :

- fixture de lieu wiki transformée en scène jouable;
- preuve que l'IA reçoit uniquement les faits autorisés;
- aucune révélation de secret.

Livré :

- adaptateur `lore-playable-scene-adapter/1`;
- transformation des `Archives de Lysenthe` en `PlayableSceneStateV1`;
- filtrage `COMMUN`/`LOCAL` pour la scène visible;
- exclusion vérifiée des fragments `MJ_SECRET`.

## I-06U — Création locale contrôlée d'éléments de scène

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-08.
Preuves : [`Matrice-preuves-I06U.md`](Matrice-preuves-I06U.md), `npm run narration-module:test:scene-ephemeral-creation`.

Objectif : autoriser l'IA à proposer de petits éléments de scène, sans les rendre durables automatiquement.

Exemples autorisés :

- bruit ponctuel;
- client anonyme en arrière-plan;
- détail sensoriel;
- obstacle mineur non persistant.

Exemples interdits :

- PNJ durable;
- indice d'intrigue;
- objet utile;
- secret;
- faction;
- conséquence politique.

Sortie attendue :

- politique de création éphémère;
- validation stricte;
- rejet des créations trop importantes;
- promotion durable explicitement fermée.

Livré :

- contrat `scene-ephemeral-creation/1`;
- politique transitoire par scène avec grounding borné;
- acceptation de bruits, détails sensoriels, figurants anonymes et obstacles mineurs;
- rejet des objets utiles, PNJ durables, secrets, indices, références inconnues et promotions lore.

## I-06V — Préparation intrigue, sans création d'intrigue

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-08.
Preuves : [`Matrice-preuves-I06V.md`](Matrice-preuves-I06V.md), `npm run narration-module:test:plot-preparation`.

Objectif : préparer les contraintes qui permettront plus tard de créer des intrigues cohérentes.

Ce lot ne doit pas encore générer d'intrigue. Il doit définir les protections :

- vérité cachée;
- indices;
- contradictions interdites;
- engagement narratif;
- scènes où un détail devient critique;
- contrôle de cohérence avant affichage.

Sortie attendue :

- checklist intrigue;
- pont documentaire vers `Coherence-intrigues.md`;
- critères nécessaires avant d'autoriser une IA à proposer une intrigue.

Livré :

- contrat `plot-preparation-gate/1`;
- checklist structurée des critères obligatoires avant future proposition d'intrigue;
- blocage des vérités cachées textuelles, résumés d'intrigue, indices concrets et créations runtime;
- références aux validateurs futurs `coherence_critic`, filtres de secrets, voies d'indices, chronologie, perspectives et gate de révélation.

## I-06W — Revue UX narration

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-08.
Preuves : [`Matrice-preuves-I06W.md`](Matrice-preuves-I06W.md), `npm run narration-module:test:narrative-react-ui`.

Objectif : vérifier que l'interface permet de comprendre clairement :

- qui parle;
- ce qui vient du joueur;
- ce qui vient du MJ;
- ce qui est système;
- ce qui est une clarification;
- ce qui est une réponse sans commit;
- quand l'OpenAI est utilisé ou non.

Sortie attendue :

- audit UX court;
- corrections UI si nécessaire;
- décision sur les indicateurs visibles à garder ou masquer.

Livré :

- badges UX accessibles par bloc pour rôle et statut critique;
- indicateurs hors couleur pour clarification, sans commit, aucun temps, IA et fallback;
- test React renforcé sur `NarrativeConversationPanel`;
- maintien de la séparation OpenAI côté serveur et surface narration dédiée.

## Ordre recommandé

Ordre strict recommandé :

1. I-06Q — scénario vertical qualité;
2. I-06R — corrections observées;
3. I-06S — généralisation légère de scène;
4. I-06T — intégration wiki minimale;
5. I-06U — créations éphémères contrôlées;
6. I-06V — préparation intrigue;
7. I-06W — revue UX narration;
8. I-06X — interprétation IA structurée de l'intention joueur;
9. I-06Y — UX no-commit / clarification;
10. I-06Z — OpenAI live serveur pour `player_intent_interpreter`.

Le tactique réel, le repos jouable complet et les intrigues dynamiques restent fermés hors autorisation explicite. La sortie I-06 ne les rouvre pas.

## Sortie I-06 et suite I-06X

Statut : `CADRE` le 2026-07-08.
Référence : [`Sortie-phase-I06.md`](Sortie-phase-I06.md).

Décision :

- I-06 est clos dans son périmètre de prototype narratif sûr;
- l'interprétation déterministe actuelle reste une limite structurante;
- les variations de formulation joueur ne doivent pas être corrigées par accumulation de regex;
- la prochaine étape narrative autorisée est I-06X : interprétation IA structurée de l'intention joueur;
- l'IA peut proposer une interprétation, mais le code garde seul l'autorité de validation, résolution, commit, temps, lore durable, tactique et inventaire.

## I-06X — Interprétation IA structurée de l'intention joueur

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-08.
Références : [`Contrat-interpretation-ia-intention.md`](Contrat-interpretation-ia-intention.md), [`Matrice-preuves-I06X.md`](Matrice-preuves-I06X.md).

Objectif : introduire un rôle `player_intent_interpreter` qui produit une intention structurée validée localement, afin d'éviter que des variations de formulation changent arbitrairement l'interprétation.

Sortie attendue :

- contrat `ai-intent-interpretation/1`;
- matrice de robustesse linguistique;
- test `narration-module:test:ai-intent-interpretation`;
- fallback conservateur vers `intent-clarification/1`;
- absence d'autorité IA sur commit, temps, inventaire, tactique, lore durable et résultat social.

Cas minimal à couvrir :

```text
Je m’approche du garde et je lui demande s’il a vu quelque chose d’étrange.
```

Résultat attendu futur : `speech`, cible garde, engagement `committed`, sans clarification.

Livré :

- rôle `player_intent_interpreter`;
- fournisseur local déterministe certifié pour le prototype;
- validation stricte de payload IA;
- intégration contrôleur avec fallback conservateur;
- cas `je lui demande` corrigé en `speech` sans clarification;
- familles de robustesse linguistique couvertes.

## I-06Y — UX no-commit / clarification

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-08.
Référence : [`Matrice-preuves-I06Y.md`](Matrice-preuves-I06Y.md).

Objectif : clarifier dans l'interface les cas où le système répond sans exécuter d'action, afin d'éviter qu'une question, une possibilité ou une clarification soit perçue comme un commit métier.

Livré :

- encarts UX dédiés pour possibilité sans commit, clarification suspendue, parole enregistrée bornée et no-commit générique;
- badges supplémentaires `Possibilité`, `Action non exécutée` et `Parole enregistrée`;
- test `narration-module:test:narrative-react-ui` renforcé sur les badges et encarts;
- aucune modification de l'interprétation IA, du contrôleur, du temps, du tactique, de l'inventaire ou du lore durable.

Suite directe recommandée :

- revue produit courte sur traces réelles I-06X/I-06Y : effectuée dans [`Revue-produit-I06X-I06Y.md`](Revue-produit-I06X-I06Y.md);
- suite retenue : OpenAI live serveur pour `player_intent_interpreter`.

## Revue produit I-06X/I-06Y

Statut : `TERMINE` le 2026-07-08.
Référence : [`Revue-produit-I06X-I06Y.md`](Revue-produit-I06X-I06Y.md).

Résultat :

- les traces de parole adressée au garde sont validées sans clarification inutile;
- les questions de possibilité restent sans action exécutée;
- les formulations ambiguës restent en clarification suspendue;
- l'UX I-06Y rend explicitement visibles no-commit, temps suspendu et parole enregistrée bornée.

Décision :

- ouvrir ensuite le branchement OpenAI live serveur pour `player_intent_interpreter`;
- ne pas ouvrir `mj_planner` à ce stade.

## I-06Z — OpenAI live serveur pour `player_intent_interpreter`

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-08.
Référence : [`Matrice-preuves-I06Z.md`](Matrice-preuves-I06Z.md).

Objectif : brancher le rôle `player_intent_interpreter` sur la route OpenAI serveur opt-in existante, sans exposer de clé au navigateur et sans donner d'autorité métier à l'IA.

Livré :

- route `POST /api/narration/enhance-openai` étendue au rôle `player_intent_interpreter`;
- contrat `ai-intent-interpretation/1` validé par schéma strict;
- instructions serveur spécialisées pour comprendre l'intention sans répondre au joueur;
- validation locale renforcée des engagements impossibles ou dangereux;
- support optionnel de `NARRATION_OPENAI_INTENT_MODEL`;
- mode OpenAI UI appliqué à l'interprétation d'intention et à l'enrichissement narratif.

Suite directe recommandée :

- smoke live manuel court avec `.env` local;
- si stable, créer une matrice de certification live courte avant tout élargissement produit;
- sinon, corriger le contrat ou le fallback avant d'ouvrir le prochain lot produit narration.

Smoke live court du 2026-07-09 :

- OK : questions méta (`quelle temps fait il ?`, localisation joueur) classées `meta_question`, sans temps de jeu;
- OK : possibilité risquée (`est-ce que je peux voler la bourse du garde ?`) classée `possibility_query`, `hypothetical`, sans temps de jeu;
- OK : action explicite (`je vole la bourse du garde`) classée `action`, `committed`;
- OK : parole simple (`je lui demande...`, `je parle au garde`, `j'aimerais parler à un garde`) classée `speech`, `committed`;
- Écart : formulation sociale composée (`je m'approche du garde et je lui demande...`) acceptée en `action`; à corriger avant certification live ou élargissement produit.

Correctif live du 2026-07-09 :

- instructions serveur renforcées : une phrase composée avec micro-déplacement social doit rester `speech` ou `mixed`;
- validation serveur renforcée : une entrée source sociale ne peut pas être acceptée comme `action`, même si `rawInputEcho` est altéré par la sortie IA;
- mini smoke live de correction OK : `je m'approche... et je lui demande...`, `je m'avance... et je lui demande...`, `je vais vers... et je parle...` sortent en `mixed`, `committed`, `DOMAIN_TO_DECIDE`.

Suite immédiate :

- certification live courte [`Matrice-certification-live-intent-interpreter.md`](Matrice-certification-live-intent-interpreter.md) validée le 2026-07-09 après correction ciblée : 18 cas couverts, 18 OK, 0 `A_CORRIGER`, 0 `BLOQUANT`;
- ouvrir le prochain lot produit narration orienté qualité de scène jouable;
- ne pas ouvrir automatiquement `mj_planner`.

## I-06ZA — Qualité de scène jouable

Statut : `IMPLEMENTE_DANS_PERIMETRE` le 2026-07-09.
Référence : [`Matrice-preuves-I06ZA-qualite-scene.md`](Matrice-preuves-I06ZA-qualite-scene.md).

Objectif : améliorer le rendu visible immédiat de la scène après la certification live de l'intention joueur, sans donner de pouvoir stratégique à l'IA.

Livré :

- réponse météo concrète et localisée;
- réponse de possibilité risquée sans action exécutée;
- narration de parole plus ancrée dans la scène;
- intention `mixed` sociale rendue comme interaction PNJ bornée;
- consignes `scene_writer` renforcées contre le remplissage générique.

Hors périmètre :

- pas de `mj_planner`;
- pas d'intrigue dynamique;
- pas de changement d'horloge.

## Critères retenus pour la sortie I-06

La sortie I-06 est cadrée par [`Sortie-phase-I06.md`](Sortie-phase-I06.md). Les critères retenus sont :

- le scénario vertical fonctionne localement;
- le scénario vertical fonctionne avec OpenAI ou dégrade proprement;
- les entrées méta ne polluent pas la fiction;
- les actions hypothétiques ne deviennent pas des actions;
- les PNJ gardent une continuité minimale;
- le contexte envoyé à l'IA reste borné;
- aucune mutation durable n'est faite par texte IA;
- la documentation permet à une autre conversation Codex de reprendre sans deviner.
