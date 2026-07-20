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

Suite immédiate recommandée :

- valider manuellement dans l'UI la séparation `Contexte` / `Possibilité` / `Parole enregistrée`;
- ouvrir ensuite I-06ZB sur la variation contrôlée et la continuité locale;
- ne pas ouvrir `mj_planner` tant que les retours visibles courts ne sont pas stables.

## I-06ZB — Variation contrôlée et continuité locale

Statut : `IMPLEMENTE_DANS_PERIMETRE` le 2026-07-09.
Référence : [`Matrice-preuves-I06ZB-variation-controlee.md`](Matrice-preuves-I06ZB-variation-controlee.md).

Objectif : éviter les répétitions mécaniques dans les réponses visibles courtes, tout en conservant exactement les mêmes faits de scène et sans donner de nouvelle autorité à l'IA.

Problème traité :

- si le joueur demande plusieurs fois le temps, le lieu ou une information déjà disponible, le MJ doit garder la vérité fictionnelle stable mais varier la formulation;
- si le joueur répète une sollicitation PNJ, le PNJ doit tenir compte de l'échange précédent sans révéler de secret nouveau ni produire un succès social automatique;
- les variations doivent être de présentation, pas des commits métier.

Règles proposées :

- la vérité de scène reste stable : météo, lieu, PNJ présents, danger, horloge et événements ne changent pas par variation stylistique;
- une question de contexte répétée peut reformuler, préciser ou rappeler, mais ne déclenche pas de temps de jeu;
- une réponse PNJ répétée peut montrer impatience, prudence, fatigue ou insistance selon la mémoire courte déjà autorisée;
- l'IA `scene_writer` peut améliorer le style, mais le code valide toujours le type d'intention, le commit, le temps et les effets;
- le fallback local doit rester borné et acceptable, même sans OpenAI.

Périmètre technique pressenti :

- enrichir le contexte de rendu avec un court historique visible ou un signal de répétition;
- ajouter une petite preuve automatique sur deux demandes météo consécutives : mêmes faits, texte non strictement identique, aucun commit;
- ajouter une preuve automatique sur deux sollicitations du garde : continuité PNJ sans nouvel effet mécanique;
- documenter clairement la différence entre variation de surface et mutation narrative.

Hors périmètre :

- pas de génération d'intrigue;
- pas de nouveau PNJ durable;
- pas de progression de temps sur les questions méta;
- pas d'intégration du module tactique.

Critère de sortie :

- le joueur peut reposer une question de contexte ou relancer un PNJ sans obtenir une copie mécanique de la réponse précédente, et sans que le système invente une nouvelle réalité pour masquer la répétition.

Livré :

- variation locale déterministe des réponses météo;
- variation locale déterministe des rappels de perception générale;
- variation locale déterministe des réponses sur le type de bâtiment;
- conservation explicite des faits stables de scène dans les variantes;
- preuve `npm run narration-module:test:scene-controlled-variation`.

Limite volontaire :

- pas de mémoire longue de style;
- pas de génération d'intrigue ou de nouveaux faits pour masquer une répétition.

Stabilisation post-test live du 2026-07-09 :

- le `scene_writer` peut maintenant enrichir certaines réponses de contexte no-commit;
- un historique visible court est transmis au `scene_writer`;
- le schéma `scene_writer` impose `factDiscipline` pour déclarer les faits non supportés, entités visibles non fournies, événements nouveaux et présences cachées;
- le pipeline rejette les blocs dont `factDiscipline` signale une dérive factuelle;
- revue de reprise : [`Revue-technique-post-I06ZB.md`](Revue-technique-post-I06ZB.md).

Suite immédiate recommandée :

- ouvrir I-06ZC : certification live courte du `scene_writer`, sans nouvelle capacité narrative;
- ne pas ouvrir `mj_planner`, intrigue dynamique, mémoire longue, tactique réel ou repos jouable complet tant que cette certification n'est pas faite.

## I-06ZC — Certification live courte `scene_writer`

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-10.
Référence : [`Revue-technique-post-I06ZB.md`](Revue-technique-post-I06ZB.md).

Objectif : mesurer le comportement OpenAI live du `scene_writer` sur une matrice courte avant d'ajouter une nouvelle capacité.

Matrice ouverte : [`Matrice-certification-live-scene-writer.md`](Matrice-certification-live-scene-writer.md).

Resultat : 12 cas live couverts, 12 OK, 0 `A_CORRIGER`, 0 `BLOQUANT`. La suite logique est I-06ZD.

Cas minimaux :

- météo;
- localisation;
- description générale de scène;
- description des personnes présentes;
- description du garde;
- description de la serveuse;
- question sur la porte du fond;
- répétition d'une question de contexte;
- possibilité risquée sans action;
- parole au garde.

Critères de sortie :

- les réponses de contexte ne déclenchent ni commit ni temps;
- les possibilités restent hypothétiques;
- les paroles restent bornées;
- aucun PNJ, groupe, événement, secret ou fait durable non fourni n'est ajouté;
- la narration est suffisamment concrète et non générique;
- le fallback local reste propre si OpenAI échoue.

Sorties attendues :

- matrice `Matrice-certification-live-scene-writer.md`;
- liste des écarts `OK`, `A_CORRIGER`, `BLOQUANT`;
- décision : corriger le contexte/contrat ou passer à l'amorce UI jouable I-06ZD.

## I-06ZD — Amorce de scène jouable dans l'UI

Statut : `IMPLEMENTE_DANS_PERIMETRE` le 2026-07-10.
Preuve : [`Matrice-preuves-I06ZD-amorce-scene-ui.md`](Matrice-preuves-I06ZD-amorce-scene-ui.md), `npm run narration-module:test:narrative-app-surface`.

Objectif : remplacer les messages visibles de prototype par une ouverture de scène issue du `PlayableSceneStateV1`.

Ce lot doit rester UI/rendu. Il ne doit pas ouvrir le MJ complet.

Livre :

- amorce initiale issue de `REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1`;
- fil visible demarrant dans l'Auberge du Seuil avec garde blesse, serveuse nerveuse, pluie, porte du fond et tension courante;
- anciens messages visibles de prototype retires du rendu initial;
- statut technique conserve hors fil fictionnel.

## I-06ZE — Referents locaux recents pour `player_intent_interpreter`

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-15.

Objectif : enrichir structurellement le contexte envoyé au `scene_writer` si la certification live montre encore des ambiguïtés factuelles.

Ce lot doit renforcer les données envoyées à l'IA, pas ajouter des listes lexicales de formulations.

### Note de remplacement I-06ZE du 2026-07-10

L'ancien libelle I-06ZE "paquet de scene explicite pour scene_writer" est remplace par le cadrage [`Cadrage-I06ZE-referents-locaux.md`](Cadrage-I06ZE-referents-locaux.md).

Le prochain I-06ZE actif concerne la resolution IA des referents locaux recents par `player_intent_interpreter`, pas `scene_writer`.

Livraison : `ai-intent-interpretation/1` transporte `referentResolution`, le controleur fournit une memoire courte de referents visibles, le resolver valide visible/compatible/non ambigu, et `LOCAL_SCENE_ACTION_RECORDED` enregistre seulement une action locale bornee sans secret, temps ou changement de scene. Preuves : `npm run narration-module:test:ai-intent-interpretation`, `npm run narration-module:test:narrative-resolution`, `npm run narration-module:test:narrative-turn-controller`, `npm run narration-module:test:narrative-openai-route`, `npm run narration-module:build`.

Durcissement post-livraison : les cas sans contexte, referent incompatible et referent ambigu sur `open`/`force` clarifient ou sont rejetes avant resolution; la route OpenAI refuse aussi une action de manipulation engagee avec `referentResolution` ambigu. Le retour UI a aussi montre qu'une action non canonique pouvait rester inexploitable : la correction doit rester contractuelle, sans traduction lexicale cote code.

Regle de conception :

- l'IA propose le referent ;
- le code valide que le referent est visible, unique et compatible ;
- le code clarifie si le referent est ambigu ou incompatible ;
- aucun secret, changement de scene complet, tactique, intrigue ou `mj_planner` n'est ouvert ;
- aucune condition speciale du type `porte du fond -> ouvrir` ne doit etre ajoutee.

## I-06ZF — Interpretation semantique unique

Statut : `IMPLEMENTE_DANS_PERIMETRE` le 2026-07-16.
References : [`Cadrage-interpretation-semantique-ouverte.md`](Cadrage-interpretation-semantique-ouverte.md), [`Matrice-cas-I06ZF-interpretation-semantique.md`](Matrice-cas-I06ZF-interpretation-semantique.md).

Contrat en revision : [`Contrat-interpretation-ia-intention.md`](Contrat-interpretation-ia-intention.md) conserve `ai-intent-interpretation/1` comme seule version active et ajoute `semanticIntent`, `runtimeHandling` et le diagnostic d'echec d'interpretation.

Objectif : corriger la tension post-I-06ZE entre l'ambition de comprehension ouverte et les categories systeme trop etroites.

Decision de cap :

- l'IA doit produire la seule interpretation active du tour;
- l'intention semantique libre devient le coeur du contrat, pas une action canonique;
- une action canonique (`open`, `force`, `observe`, etc.) peut rester comme detail d'exploitation, mais ne porte pas le sens principal;
- le code doit valider les autorites, references, secrets, consequences et domaines ouverts, sans comprendre le langage par regex;
- une panne IA ou une sortie rejetee doit produire un diagnostic explicite, pas un fallback narratif qui donne l'impression que le tour fonctionne.

Cas temoin :

```text
Le personnage est devant la porte du fond.
Je mets la main sur la poignee et pivote le mecanisme.
```

Attendu cible : l'intention peut etre comprise comme une manipulation ou tentative d'ouverture du passage sans que le joueur emploie le mot `ouvrir`; le code ne valide que cible visible, absence de resultat invente et perimetre de resolution.

Prochaine sortie attendue :

- relire la revision contractuelle de `ai-intent-interpretation/1`;
- valider ou ajuster les champs semantiques minimaux;
- valider ou ajuster le format de diagnostic d'echec IA en mode test;
- selectionner les cas de test depuis la matrice I-06ZF;
- verifier que les validations restent des validations d'autorite, pas des dictionnaires metier.

Hors perimetre :

- pas de `mj_planner`;
- pas de creation durable automatique;
- pas de moteur social mecanique;
- pas de branchement tactique ou repos jouable;
- pas de liste lexicale pour compenser l'interpretation IA;
- pas de fallback produit qui transforme une panne IA en reponse fictionnelle.

Livraison :

- `ai-intent-interpretation/1` transporte `semanticIntent` et `runtimeHandling`;
- une sortie IA invalide produit un diagnostic explicite sans fallback narratif;
- le cas "poignee / mecanisme" devant la porte visible est couvert comme intention semantique exploitable;
- validations TypeScript et serveur OpenAI renforcees;
- preuves : `npm run narration-module:test:ai-intent-interpretation`, `node narration-module\tests\server\verify-narrative-openai-route.js`, `npm run build`.

## I-06ZG — Verrou runtime d'exploitation des intentions

Statut : `IMPLEMENTE_DANS_PERIMETRE` le 2026-07-16.

Objectif : transformer le statut `runtimeHandling` produit par l'interpreteur IA en decision runtime explicite avant toute resolution locale.

Probleme traite :

- l'IA peut maintenant comprendre une intention ouverte;
- le runtime doit dire clairement s'il sait l'exploiter;
- un domaine non ouvert ne doit pas etre resolu par narration, ni par une regex sur le texte brut.

Livraison :

- `NarrativeIntentInterpretationV1` transporte `runtimeHandling`;
- le resolver lit `runtimeHandling` avant les heuristiques legacy;
- `UNSUPPORTED_DOMAIN` produit `HANDOFF_REQUIRED` vers le domaine proprietaire;
- `NEEDS_CLARIFICATION` et `AI_INTERPRETATION_FAILED` restent non committables;
- preuve ajoutee sur une intention d'inventaire formulee sans mot-cle lexical evident : `Je glisse deux doigts vers la bourse accrochee a sa ceinture.`;
- test : `npm run narration-module:test:ai-intent-interpretation`.

Hors perimetre :

- pas d'ouverture du moteur inventaire;
- pas de resolution de vol;
- pas de consequence sociale ou tactique;
- pas de nouveau fallback narratif.

## I-06ZH — MJ planner minimal

Statut : `IMPLEMENTE_DANS_PERIMETRE` le 2026-07-16.
Référence : [`Cadrage-I06ZH-mj-planner-minimal.md`](Cadrage-I06ZH-mj-planner-minimal.md).

Objectif : introduire `mj_planner` comme couche de planification sémantique non committable entre intention et résolution.

Livraison :

- contrat minimal `mj-planner/1`;
- provider local déterministe `LocalMjPlannerProviderV1`;
- validation stricte du payload planner, notamment `commitAuthority=false`;
- appel contrôleur sur intentions engagées ou domaines fermés;
- pas d'appel sur questions méta, possibilités pures ou clarifications;
- sortie technique `mjPlan` / `mjPlannerFailure` conservée dans `NarrativeTurnControllerOutputV1`;
- preuves : `npm run narration-module:test:ai-intent-interpretation`, `npm run narration-module:test:narrative-resolution`, `npm run narration-module:test:ai-pipeline`, `npm run narration-module:build`.

Hors périmètre :

- pas de route OpenAI live `mj_planner`;
- pas de MJ complet;
- pas d'intrigue dynamique;
- pas de création persistante;
- pas de résolution sociale mécanique;
- pas de domaine propriétaire ouvert.

## I-06ZI — Branchement IA serveur du MJ planner

Statut : `IMPLEMENTE_DANS_PERIMETRE` le 2026-07-16.
Référence : [`Cadrage-I06ZI-branchement-ia-mj-planner.md`](Cadrage-I06ZI-branchement-ia-mj-planner.md).

Objectif : brancher `mj_planner` sur OpenAI via la route serveur existante, sans donner de pouvoir de commit au modèle.

Livraison :

- rôle `mj_planner` autorisé par `/api/narration/enhance-openai`;
- contrat serveur `mj-planner/1` avec schéma strict;
- instructions serveur orientées planification sémantique depuis `task.interpretation`;
- rejet local des plans committables, révélateurs, créateurs ou temporels;
- variable optionnelle `NARRATION_OPENAI_MJ_PLANNER_MODEL`;
- mode OpenAI UI configurant aussi `mjPlannerConfig`;
- preuves : `npm run narration-module:test:narrative-openai-route`, `npm run narration-module:test:ai-intent-interpretation`, `npm run narration-module:test:narrative-resolution`, `npm run narration-module:build`, `npm run build`.

Hors périmètre :

- pas d'exécution automatique des propositions;
- pas de `npc_performer` live;
- pas de domaine inventaire/tactique/repos/monde ouvert;
- pas de création ou intrigue persistante;
- pas de fallback narratif sur erreur planner.

## I-06ZJ — NPC performer minimal

Statut : `IMPLEMENTE_DANS_PERIMETRE` le 2026-07-16.
Référence : [`Cadrage-I06ZJ-npc-performer-minimal.md`](Cadrage-I06ZJ-npc-performer-minimal.md).

Objectif : consommer une assignation `npc_performer` du `mj_planner` pour produire une réaction PNJ visible et bornée.

Livraison :

- contrat `npc-performer/1`;
- provider local `LocalNpcPerformerProviderV1`;
- validation pipeline des répliques sans révélation ni engagement durable;
- appel contrôleur après résolution bornée de parole;
- remplacement du bloc `NPC_SPEECH` par la réaction acceptée;
- sortie technique `npcPerformance` / `npcPerformanceFailure`;
- preuves : `npm run narration-module:test:ai-pipeline`, `npm run narration-module:test:narrative-turn-controller`, `npm run narration-module:test:ai-intent-interpretation`.

Hors périmètre :

- pas de route OpenAI serveur `npc_performer`;
- pas de moteur social mécanique;
- pas de mémoire sociale longue;
- pas de conséquences ou promesses durables;
- pas d'automatisation PNJ multi-tours.

## I-06ZK — Branchement IA serveur du NPC performer

Statut : `IMPLEMENTE_DANS_PERIMETRE` le 2026-07-16.
Référence : [`Cadrage-I06ZK-branchement-ia-npc-performer.md`](Cadrage-I06ZK-branchement-ia-npc-performer.md).

Objectif : brancher `npc_performer` sur OpenAI via la route serveur existante, sans ouvrir le moteur social.

Livraison :

- rôle `npc_performer` autorisé par `/api/narration/enhance-openai`;
- contrat serveur `npc-performer/1` avec schéma strict;
- instructions serveur limitant le rôle au PNJ visible assigné;
- rejet local des révélations, engagements durables et speech acts interdits;
- variable optionnelle `NARRATION_OPENAI_NPC_PERFORMER_MODEL`;
- mode OpenAI UI configurant aussi `npcPerformerConfig`;
- preuves : `npm run narration-module:test:narrative-openai-route`, `npm run narration-module:test:narrative-app-surface`, `npm run narration-module:test:ai-pipeline`.

Hors périmètre :

- pas de moteur social mécanique;
- pas de mémoire sociale longue;
- pas de secrets ou promesses durables;
- pas de PNJ autonomes multi-tours.

## I-06ZL à I-06ZR — Fidélité intention vers système

Statut : `PLANIFIE` le 2026-07-17.

Référence normative : [`Plan-fidelite-intention-systeme.md`](Plan-fidelite-intention-systeme.md).

Constat : les lots I-06ZF à I-06ZK ont introduit une intention sémantique riche, un verrou runtime, un planner et un performer PNJ, mais la structure `semanticIntent` est encore aplatie avant les consommateurs applicatifs. Le planner et la résolution restent partiellement dépendants de `coreMeaning`, `intentType`, `action`, du texte brut et de références propres à la scène prototype.

Décision de suite : ne pas ouvrir une nouvelle capacité narrative avant d'avoir consolidé la fidélité de bout en bout. Les sept lots retenus sont :

- I-06ZL : contrat canonique et propagation de `semanticIntent` — `TERMINE_DANS_PERIMETRE` le 2026-07-17, preuves dans [`Matrice-preuves-I06ZL.md`](Matrice-preuves-I06ZL.md);
- I-06ZM : consommation sémantique par le planner et décision runtime locale — `TERMINE_DANS_PERIMETRE` le 2026-07-17, preuves dans [`Matrice-preuves-I06ZM.md`](Matrice-preuves-I06ZM.md);
- I-06ZN : commandes de domaine typées — `TERMINE_DANS_PERIMETRE` le 2026-07-17, preuves dans [`Matrice-preuves-I06ZN.md`](Matrice-preuves-I06ZN.md);
- I-06ZO : retrait progressif des interprétations lexicales — `TERMINE_DANS_PERIMETRE` le 2026-07-17, inventaire dans [`Inventaire-lectures-lexicales-I06ZO.md`](Inventaire-lectures-lexicales-I06ZO.md) et preuves dans [`Matrice-preuves-I06ZO.md`](Matrice-preuves-I06ZO.md);
- I-06ZP : registre générique des référents de scène — `TERMINE_DANS_PERIMETRE` le 2026-07-17, contrat dans [`Contrat-registre-referents-scene.md`](Contrat-registre-referents-scene.md) et preuves dans [`Matrice-preuves-I06ZP.md`](Matrice-preuves-I06ZP.md);
- I-06ZQ : matrices d'invariance sémantique multi-scènes — `TERMINE_DANS_PERIMETRE` le 2026-07-17, contrat dans [`Contrat-invariance-semantique.md`](Contrat-invariance-semantique.md) et preuves dans [`Matrice-preuves-I06ZQ.md`](Matrice-preuves-I06ZQ.md);
- I-06ZR : tests d'autorité et nettoyage legacy — `TERMINE_DANS_PERIMETRE` le 2026-07-17, autorité dans [`Matrice-autorite-intention-I06ZR.md`](Matrice-autorite-intention-I06ZR.md) et preuves dans [`Matrice-preuves-I06ZR.md`](Matrice-preuves-I06ZR.md).

I-06ZL conserve `intent-clarification/1` comme seule version active et rend `semanticIntent` obligatoire. I-06ZM ajoute `runtimeDecision`, calculé par le registre local. I-06ZN introduit `narrative-domain-command/1`. I-06ZO retire les décisions lexicales du flux actif. I-06ZP apporte `scene-referent-registry/1`. I-06ZQ prouve 105 convergences déterministes. I-06ZR ferme le chantier : contradictions rejetées avant commande, consommateurs actifs alignés sur la source canonique et legacy restant borné à la migration, au diagnostic et au rendu de référence.

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
