# Plan d'arbitrage des actions et des tests de compétence

Statut : `EN COURS — SOCLE A/B OUVERT`  
Date : 2026-07-23  
Périmètre : préparation de conception uniquement; aucun comportement runtime n'est ouvert par ce document.

## 1. Objectif

Après compréhension de l'intention du joueur, le runtime doit pouvoir distinguer :

- une action plausible sans incertitude significative, résolue automatiquement;
- une action impossible selon les faits ou les règles, refusée avant tout jet;
- une action possible mais incertaine, qui exige un test fondé sur la méthode employée, la difficulté, les aptitudes du personnage et les conséquences;
- une intention réellement ambiguë, qui seule justifie une clarification;
- une action relevant d'un autre domaine ou d'un processus plus long.

Ainsi, « je cherche une rue calme non loin » dans une grande ville ne doit normalement demander ni clarification ni jet. Chercher une personne dissimulée, reconnaître un lieu secret ou suivre une piste peut en revanche déclencher une résolution incertaine.

## 2. Ce qui existe déjà dans la conception active

Les idées ne sont pas nouvelles dans le dépôt :

- `Contrat-resolution-narrative.md` autorise déjà une résolution à produire un résultat léger, une demande de jet, un arbitrage, un commit préparé ou un handoff.
- `Integration-domaines.md` sépare l'interprétation narrative de l'autorité du domaine et prévoit `NEEDS_ADJUDICATION`. Une situation libre peut demander au `rules_adjudicator` de relier l'action aux capacités pertinentes; le domaine conserve calcul, jet, coûts et résultat.
- `Regles-et-arbitrages.md` impose que les règles applicables viennent du `RuleRegistry` épinglé. L'IA ne peut ni inventer une règle ni transformer seule un arbitrage ponctuel en règle officielle.
- `Contrat-bootstrap-campagne.md` et le code actif exposent caractéristiques, compétences, maîtrises, expertise, langues, capacités, background et perception passive dans les projections appropriées.
- Le `RuleRegistryV1` calcule déjà les modificateurs, le bonus de maîtrise et la perception passive. Il contient aussi la règle `house.action.impossible-before-roll`.
- `perception-resolution/1` distingue déjà `AUTOMATIC_RESULT`, `CHECK_REQUIRED`, `NOT_PERCEPTIBLE` et `NEEDS_CLARIFICATION`, mais sa proposition de test ne contient encore ni compétence, ni difficulté, ni jet.
- `AdjudicationRecordV1` existe pour conserver un arbitrage ponctuel sourcé sans modifier le registre de règles.

Les scénarios NAR-ACC-008 et NAR-ACC-021 couvrent partiellement l'impossibilité avant jet et l'arbitrage ouvert. La matrice de couverture classe encore leur résolution mécanique réelle dans un futur lot règles/action.

## 3. Héritage documentaire à reprendre avec prudence

Les documents historiques décrivent presque exactement le besoin :

- `docs projet/Docs Outils/iaRuntime.md` envisage une difficulté contextuelle, un test d'Athlétisme et l'emploi de la perception passive pour proposer une autre voie;
- `docs projet/Gestion et Création de données/Maitrise et compétence.md` décrit `1d20 + modificateur + maîtrise`, expertise, scores passifs, difficultés de 5 à 30 et changement de caractéristique selon l'approche;
- `docs projet/Phases/Phase Aventure.md` prévoit une demande de jet, une interface de lancer et un retour du résultat vers la narration;
- `docs projet/Scénarios d'aventure/scénarisation et processus/Scénario exploration.md` cite Perception, Investigation, Survie, orientation, risque de se perdre et coût en temps.

Ces principes sont utiles, mais les anciennes commandes `REQ_THROW`, `iaRuntime` et `diceRoller` ne correspondent plus aux frontières d'autorité actuelles. Elles ne doivent pas être réintroduites telles quelles.

## 4. Chaîne d'autorité visée

```text
entrée libre du joueur
  -> interprétation sémantique
  -> validation de faisabilité par les faits du monde
  -> classification automatique / impossible / incertaine / ambiguë / handoff
  -> sélection des règles et paramètres applicables
  -> projection mécanique minimale du personnage
  -> proposition de test validée
  -> jet déterministe et traçable si nécessaire
  -> résolution des conséquences par le domaine propriétaire
  -> commit atomique du résultat, du temps et des effets
  -> narration du résultat confirmé
```

L'IA peut comprendre la méthode, identifier des facteurs contextuels et proposer une qualification. Elle ne fixe pas seule un résultat, ne lance pas le dé, ne révèle pas de fait caché et ne committe rien.

## 5. Contrat d'arbitrage contextuel à créer

Un futur contrat `contextual-action-adjudication/1` recevrait au minimum :

- l'intention sémantique et la méthode déclarée;
- la cible résolue ou la destination recherchée;
- les faits pertinents et sourcés de la scène, du monde et du temps;
- les enjeux connus, le coût temporel et les conséquences possibles;
- une projection minimale du personnage;
- les règles actives applicables.

Il retournerait une disposition fermée :

- `AUTOMATIC_SUCCESS` : possible, sans incertitude ou enjeu justifiant un jet;
- `CHECK_REQUIRED` : possible, incertaine et porteuse d'une conséquence significative;
- `IMPOSSIBLE` : bloquée par un fait ou une règle cités;
- `NEEDS_CLARIFICATION` : méthode, cible ou choix du joueur réellement manquant;
- `DOMAIN_HANDOFF` : résolution appartenant à un autre domaine ou à un processus long.

Une difficulté faible n'implique pas automatiquement un jet. La première question est toujours : « l'échec est-il plausible et intéressant dans ce contexte ? »

## 6. Proposition de test

Une sortie `CHECK_REQUIRED` préparerait un `SkillCheckProposalV1` non committable :

- caractéristique principale;
- compétence ou outil éventuel;
- variantes autorisées selon l'approche;
- difficulté ou règle permettant de la calculer;
- sources d'avantage, de désavantage ou d'éligibilité;
- score passif éventuellement applicable;
- résultat attendu en cas de succès;
- conséquence explicite d'un échec;
- coût en temps et politique de nouvelle tentative;
- règles et faits cités;
- domaine propriétaire du calcul et du commit.

Le background, la culture, les langues, l'équipement et les capacités ne doivent pas devenir des bonus improvisés. Une règle peut leur faire :

- rendre une connaissance automatique;
- autoriser une tentative normalement inaccessible;
- fournir un avantage ou une variante de compétence;
- modifier la difficulté;
- offrir une autre méthode.

Ils ne doivent pas doubler un bonus de maîtrise déjà compté.

## 7. Difficulté et scores passifs

La table historique « très facile 5, facile 10, moyenne 15, difficile 20, très difficile 25, presque impossible 30 » n'est pas encore une règle exécutable du `RuleRegistryV1`. Elle devra être ajoutée et versionnée si elle est retenue; l'IA ne doit pas la supposer depuis sa connaissance générale.

Les scores passifs servent notamment à révéler automatiquement un signe accessible ou à éviter la répétition artificielle de jets. Une recherche active représente un investissement volontaire de temps ou une méthode plus poussée. Le passage de l'un à l'autre doit rester contrôlé par les règles et les faits cachés, jamais par la prose.

## 8. Lots de développement proposés

### Lot A — Geler le vocabulaire et le corpus d'acceptation

- figer les cinq dispositions;
- définir la différence entre difficulté faible et absence de jet;
- écrire les scénarios représentatifs avant le runtime;
- décider quelles règles D&D et règles maison entrent réellement dans le ruleset.

### Lot B — Faisabilité contextuelle sans dés

- créer `contextual-action-adjudication/1`;
- relier intention, cible, faits du monde et capacité runtime;
- produire automatiquement `AUTOMATIC_SUCCESS`, `IMPOSSIBLE`, `NEEDS_CLARIFICATION` ou `DOMAIN_HANDOFF`;
- conserver `CHECK_REQUIRED` comme proposition non exécutable.

Ce lot corrige directement le cas de la rue calme sans ouvrir prématurément le moteur de dés.

### Lot C — Projection mécanique du personnage

- fournir uniquement les caractéristiques, maîtrises, expertise, passifs, capacités, langues, background et équipement pertinents;
- tracer leur provenance et leur version;
- définir les effets autorisés du background et éviter les doubles comptes.

### Lot D — Règles de test et validation de la difficulté

- ajouter au `RuleRegistry` la formule de test retenue et la table de difficulté versionnée;
- valider compétence, caractéristique alternative, outils, avantage/désavantage et passif;
- produire `SkillCheckProposalV1` avec enjeux et conséquences obligatoires.

### Lot E — Moteur de jet déterministe et persistant

- générer ou enregistrer le jet de façon rejouable;
- calculer le résultat exclusivement par les règles locales;
- persister formule, dé, modificateurs, difficulté, verdict et références;
- garantir idempotence, reprise et absence de double jet.

### Lot F — Conséquences et commit

- confier succès, échec, temps et effets au domaine propriétaire;
- committer atomiquement le résultat;
- ne transmettre au narrateur que l'issue confirmée et perceptible.

### Lot G — Intégrations progressives

- migrer d'abord `perception-resolution/1`;
- étendre ensuite exploration urbaine, recherche, pistage et interaction sociale;
- traiter enfin les actions multidomaines et les processus longs.

### Lot H — Surface joueur et recette live

- afficher clairement pourquoi un jet est demandé et ce qui est en jeu;
- décider si le joueur déclenche le lancer ou si certains tests sont secrets/automatiques;
- intégrer résultat et diagnostic pertinent dans le fil système;
- benchmarker l'aide IA sans lui céder l'autorité mécanique.

## 9. Corpus minimal d'acceptation

1. Sur un parvis urbain, « je cherche une rue calme non loin » produit une réussite automatique et une transition ou création contextuelle, sans jet.
2. « Je cherche l'hôtel de ville » peut être automatique si le lieu est public et connu, ou demander un test seulement si un obstacle contextuel le justifie.
3. « Je retrouve un fugitif qui se cache » demande une méthode; Investigation, Perception, Survie ou réseau social peuvent devenir pertinents selon cette méthode.
4. Une embuscade compare un signal caché à la perception passive sans révéler le fait source.
5. Escalader un mur détrempé prépare un test d'Athlétisme avec difficulté, temps et conséquence d'échec sourcés.
6. Une action établie comme impossible est refusée avant jet et sans coût.
7. Un background pertinent ouvre une connaissance ou une approche sans ajouter arbitrairement deux fois la maîtrise.
8. Deux exécutions avec la même clé d'opération ne produisent pas deux dés ou deux conséquences.
9. Une sortie IA qui annonce directement succès ou échec est rejetée par la frontière d'autorité.
10. Une nouvelle tentative applique une politique explicite : contexte changé, temps supplémentaire, risque accru ou refus de répétition.

## 10. Décisions produit encore ouvertes

- jet visible déclenché par le joueur, jet serveur immédiat, ou combinaison des deux;
- existence de tests secrets;
- degrés de réussite et d'échec;
- effet éventuel des 1 et 20 naturels sur les tests;
- aide, tests de groupe et outils;
- politique de répétition d'une tentative;
- place exacte des passifs hors Perception;
- autorité chargée de fixer une difficulté non couverte par une règle déterministe.

## 11. Première étape recommandée

Commencer par les lots A et B : contrat de faisabilité et corpus d'acceptation, sans moteur de dés. Cela permet de rendre l'arbitrage plus intelligent immédiatement, de réserver les clarifications aux vraies ambiguïtés et de stabiliser l'autorité avant d'introduire compétences, difficulté, hasard et conséquences.

## 12. Avancement au 2026-07-23

Le premier incrément des lots A/B est implémenté :

- contrat pur `contextual-action-adjudication/1`;
- cinq dispositions fermées et portée distincte `ACTION_ALLOWED`/`OBSERVATION_RESULT`;
- destination locale décrite classée `AUTOMATIC_SUCCESS` sans prétendre garantir une conséquence ultérieure;
- recherche profonde classée `CHECK_REQUIRED` avec proposition perceptive non committable;
- cible visible explicitement absente classée `IMPOSSIBLE` avec `house.action.impossible-before-roll@1`;
- cible réellement manquante classée `NEEDS_CLARIFICATION`;
- arbitrage propagé dans le résultat de résolution et les changements de scène;
- diagnostic système enrichi par la disposition, la portée et les règles citées;
- quatre scénarios purs, régressions résolution/contrôleur et compilation TypeScript validés.

À l'issue du premier incrément restaient fermés : difficulté chiffrée, sélection de compétence, projection mécanique du personnage, moteur de dés, conséquences d'échec et modification de l'interprétation sémantique elle-même.

Deuxième incrément livré le 2026-07-23 :

- contrat `skill-check-proposal/1` avec caractéristique, compétence, difficulté, passif, facteurs, enjeux, répétition, temps et sources;
- difficulté obligatoirement laissée à `REQUIRES_ADJUDICATION` tant qu'aucune règle ne fournit DD, bande et référence;
- recherche perceptive reliée à une proposition Sagesse/Perception sans jet ni révélation;
- contrat `mechanical-character-context/1` projetant seulement les données pertinentes;
- calcul du rang de maîtrise ou d'expertise et du modificateur total depuis les projections existantes;
- background transporté comme contexte sans bonus numérique implicite;
- adaptateur d'attachement entre proposition et contexte mécanique, avec validation de cohérence.

La sélection automatique générique de compétence reste fermée : seule la recherche perceptive possède pour le moment une association de domaine explicite. Le chargement des projections depuis la campagne et la fixation du DD restent les prochaines jonctions.

Troisième incrément livré le 2026-07-23 :

- chargement des projections du personnage actif depuis les références de `campaign.bootstrapped`;
- validation des deux payloads, de leur identité commune et des données mécaniques requises;
- enrichissement automatique de la proposition perceptive pendant le tour narratif;
- compatibilité explicite des scènes prototypes sans bootstrap;
- règle déterministe `core.check.difficulty-class@1`;
- six bandes versionnées de `VERY_EASY` 5 à `NEARLY_IMPOSSIBLE` 30;
- résolution d'une difficulté uniquement après fourniture explicite de la bande;
- passage du paquet à `rulesetVersion: 2` afin de ne pas modifier silencieusement les campagnes V1.

Restent fermés : choix contextuel de la bande, résolution finale `1d20 + modificateur`, avantage/désavantage, coût temporel, conséquences et interface de lancer.

Quatrième incrément livré le 2026-07-23 :

- trace d'arbitrage intégrée à la notification système du tour;
- justification et références visibles pour toute disposition;
- détail du test, du personnage, du passif, des enjeux et de la difficulté pour `CHECK_REQUIRED`;
- message explicite « jet non lancé » avant ouverture du moteur;
- diagnostics courts pour `AUTOMATIC_SUCCESS` et `IMPOSSIBLE`;
- scénarios couvrant les trois chemins.

Cinquième incrément livré le 2026-07-23 :

- contrat `difficulty-assessment/1`;
- difficulté de base et facteurs bornés de `-2` à `+2`;
- réduction déterministe et plafonnée sur les six bandes;
- première politique de domaine pour les recherches perceptives;
- séparation stricte des facteurs publics et privés;
- bande `BAND_SELECTED` propagée dans `skill-check-proposal/1`;
- bulle système enrichie par les seules raisons publiques et le nombre de facteurs privés;
- preuves de facilitation, difficulté privée, bornes et absence de fuite.

Restent fermés : conversion automatique par le ruleset épinglé pendant le tour, résolution du d20, avantage/désavantage, temps, conséquences et nouvelle tentative.

Sixième incrément livré le 2026-07-23 :

- chargeur du `RuleRegistry` conditionné par les dépendances épinglées de la campagne;
- conversion automatique `BAND_SELECTED` → `RULE_RESOLVED` pour `rules.jdr5e` V2;
- conservation honnête de la bande sans DD pour V1 et les prototypes;
- DD et règle visibles dans la notification système;
- contrat pur `skill-check-resolution/1`;
- calcul d'un d20 fourni, du modificateur, du total, de la marge et du verdict;
- 1 et 20 naturels tracés sans effet automatique non déclaré;
- refus d'un d20 hors plage et d'une politique d'avantage encore fermée.

Restent fermés : production idempotente du d20, persistance du lancer, avantage/désavantage, temps, conséquences, répétition et UI.

Septième incrément livré le 2026-07-23 :

- contrat `dice-roll-record/1`;
- source Web Crypto avec échantillonnage sans biais;
- source de d20 injectée pour les preuves;
- agrégat unique `rules.dice-roll` par `checkId`;
- empreinte canonique de la proposition;
- commit atomique du lancer et événement `rules.skill-check.rolled`;
- rejeu sans second tirage;
- conflit si la proposition change sous le même `checkId`;
- récupération d'un commit concurrent par relecture de l'agrégat.

Restent fermés : avantage/désavantage, tests secrets, temps, conséquences, répétition métier et UI.
