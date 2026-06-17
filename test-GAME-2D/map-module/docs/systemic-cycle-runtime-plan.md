# Systemic Cycle Runtime Plan

## Statut

Document de reference actif.

Ce document fige la cible du chantier suivant pour `map-module` : ajouter un cycle territorial vivant autour des factions publiques, des besoins de maintenance et des objectifs systemiques.

Regle de gouvernance :

- ce document est la source de verite pour le cycle systemique ;
- les lots doivent rester compatibles avec les objectifs editoriaux existants ;
- les objectifs poses a la main ne doivent pas etre casses par les objectifs systeme ;
- la roadmap doit etre mise a jour a chaque lot significatif.

## Probleme

Le runtime sait deja :

- lire des factions, objectifs et mobiles ;
- faire monter des pressions ;
- resoudre des actions et faire progresser des objectifs.

Mais il manque encore :

- des acteurs de stabilisation territoriale ;
- des objectifs de maintenance generes par l'etat du monde ;
- une boucle de degradation / reponse / deplacement des tensions ;
- une couverture minimale des villes et regions par des roles publics.

Effet produit :

- les pressions montent ;
- le monde reagit peu ;
- certaines cartes se figent apres quelques ticks ;
- les zones tendent a accumuler surtout de la pression sociale sans metabolisme de correction.

## But

Ajouter un vrai cycle territorial.

Concretement :

- chaque territoire important doit avoir au moins un acteur d'ordre, un acteur civique et un acteur logistique quand c'est pertinent ;
- le monde doit pouvoir generer ses propres objectifs de maintien ;
- les reussites ne doivent pas stopper la simulation mais deplacer les tensions ;
- une legere usure territoriale doit recreer des besoins de maintenance.

## Positionnement

Le systeme cible repose sur deux familles d'objectifs.

- objectifs editoriaux : poses a la main, forts, narratifs, prioritaires ;
- objectifs systemiques : generes par le runtime, plus courts, destines a maintenir l'activite du monde.

Les deux coexistent.

## Invariants

1. `layout.simulation` reste la source de donnees editoriale.
2. `world-simulation` reste l'unique runtime.
3. Les factions systeme peuvent etre generees au runtime sans exiger une definition manuelle dans la carte.
4. Les objectifs editoriaux existants restent prioritaires et lisibles.
5. Les objectifs systeme ne doivent pas dupliquer indefiniment le meme besoin sur la meme zone.
6. Le cycle systemique doit rester comprehensible dans l'UI et la trace.

## Modele Cible

### Factions systeme

Types cibles :

- `public_guard`
- `civic_authority`
- `logistics_office`
- `regional_patrol`

Roles :

- `public_guard` : ordre, controle, reduction de la pression criminelle ;
- `civic_authority` : peur, agitation, cohesion locale, reprise de stabilite ;
- `logistics_office` : supply, commerce, traffic, corridors ;
- `regional_patrol` : routes de secours, frontieres, maillage regional.

### Objectifs systeme

Categories cibles minimales :

- `restore_order`
- `reduce_fear`
- `stabilize_supply`
- `secure_corridor`
- `reopen_market`
- `contain_unrest`

Ces objectifs doivent etre generes a partir des seuils de pression et de degradation.

## Boucle Cible

Cycle minimal attendu :

1. le territoire s'use legerement ;
2. les pressions montent ;
3. le runtime genere des objectifs systeme ;
4. les factions systeme reagissent ;
5. leurs actions corrigent une partie du monde ;
6. ces corrections deplacent certaines tensions au lieu de les eteindre definitivement.

Exemples :

- plus de repression : moins de criminalite, mais plus de peur ;
- plus d'escortes : moins de rupture logistique, mais plus de convoitise criminelle ;
- plus de fiscalite : plus de controle, mais plus d'agitation sociale.

## Roadmap

### Lot 1 - Factions publiques systeme

Statut : `completed`

But :

- generer au runtime des factions publiques et institutionnelles minimales.

Travail :

- `garde_locale:<city>`
- `autorite_civique:<city>`
- `office_logistique:<city>` pour les hubs logistiques
- `patrouille_regionale:<region>` pour les zones pertinentes

Definition of done :

- une carte charge un squelette public minimal sans edition manuelle supplementaire ;
- ces factions apparaissent dans l'etat runtime avec zones, stats et ancrages coherents.

### Lot 2 - Objectifs systeme generes

Statut : `completed`

But :

- faire naitre des objectifs de maintien a partir du monde.

Travail :

- detection des seuils de pression ;
- generation d'objectifs systeme non dupliques ;
- affectation aux factions systeme adaptees.

Definition of done :

- le monde emet de nouveaux besoins sans intervention editoriale.

### Lot 3 - Actions de stabilisation

Statut : `completed`

But :

- donner aux factions systeme des moyens reels de correction.

Travail :

- ajouter des actions de type `restore_order`, `public_reassurance`, `repair_route`, `reopen_market`, `relief_distribution`.

Definition of done :

- les objectifs systeme peuvent reellement modifier les etats qui les ont fait naitre.

### Lot 4 - Usure territoriale

Statut : `completed`

But :

- eviter le gel du monde apres quelques succes.

Travail :

- baisse legere de certains stats au fil du temps ;
- cout d'entretien des routes, de l'ordre et des flux.

Definition of done :

- le monde recree des besoins meme sans nouveau contenu editorial.

### Lot 5 - Conversion des tensions

Statut : `completed`

But :

- transformer les succes en deplacement de problemes, pas en fin de cycle.

Travail :

- enrichir les effets secondaires des actions publiques, logistiques et fiscales ;
- mieux faire circuler la tension entre `criminal`, `social`, `commercial`, `political`.

Definition of done :

- la simulation continue a bouger apres resolution locale d'un probleme.

### Lot 6 - Cycle de vie des tensions actives

Statut : `completed`

But :

- faire des tensions des phenomenes persistants, pas seulement des sorties ponctuelles.

Travail :

- indexer les tensions sur les entites via `activeTensionIds` ;
- faire monter ou baisser la severite au macro tick ;
- supprimer proprement les tensions resolues ;
- ecrire creation, escalation, apaisement et resolution dans `recentHistory` ;
- appliquer des effets systemiques quand une tension reste forte.

Definition of done :

- une tension active evolue sans intervention externe ;
- les entites concernees gardent une memoire locale lisible.

### Lot 7 - Reponse systeme aux tensions

Statut : `completed`

But :

- permettre aux factions systeme de reagir aux tensions actives avant que les stats soient totalement degradees.

Travail :

- prendre en compte les `activeTensionIds` dans la generation des objectifs systeme ;
- augmenter le scoring des objectifs publics, civiques, logistiques et regionaux selon le type de tension ;
- verifier le cycle `scarcity -> reopen_market`.

Definition of done :

- une tension persistante peut declencher ou prioriser un objectif systeme adapte.

### Lot 8 - Observabilite runtime

Statut : `completed`

But :

- rendre le cycle vivant visible et debuggable dans le mode simulation.

Travail :

- ajouter une commande `npm run verify:world-simulation` ;
- afficher les tensions actives dans la sidebar ;
- dessiner les tensions actives sur la carte en modes `Pressions` et `Tout` ;
- afficher les tensions locales dans l'analyse par case ;
- afficher `recentHistory` dans l'inspection d'entite.

Definition of done :

- on peut verifier en CLI et inspecter dans l'UI pourquoi une ville, une route ou une region evolue.

### Lot 9 - Soulagement progressif des tensions

Statut : `completed`

But :

- eviter que les actions systeme creent seulement de nouvelles consequences sans traiter le phenomene actif initial.

Travail :

- soulager explicitement les tensions actives correspondant a une action reussie ;
- historiser le soulagement via `tension_relieved` ;
- conserver des pas de soulagement progressifs pour que plusieurs actions comptent sans eteindre tout le cycle en un seul passage ;
- garder les contre-tensions deja produites par certaines actions reussies.

Definition of done :

- une action systeme peut reduire une tension active ;
- si la tension reste forte, elle continue a produire des deltas systemiques ;
- le scenario CLI verifie le cycle `scarcity -> reopen_market -> tension_relieved`.

### Lot 10 - Discipline des factions systeme

Statut : `completed`

But :

- eviter que les factions systeme depensent leurs ressources sur des actions opportunistes sans rapport avec leurs objectifs.

Travail :

- rendre les factions systeme inactives quand elles n'ont pas d'objectif actif ;
- corriger la selection civique pour choisir le meilleur quartier eligible, pas seulement le meilleur score brut ;
- brancher les tensions politiques locales sur les objectifs `reduce_fear` et le soulagement `public_reassurance` ;
- rendre le script `analyze-sandbox-simulation.ts` executable hors Vite et utile pour les runs longs.

Definition of done :

- une tension politique locale forte peut declencher une reponse civique ;
- les ressources des factions systeme sont reservees aux objectifs systeme ;
- la sonde sandbox longue ne garde plus la tension politique de quartier bloquee comme tension dominante finale.

### Lot 11 - Factions opportunistes

Statut : `completed`

But :

- faire reagir les factions non-systeme aux crises au lieu de limiter le monde aux reponses institutionnelles.

Travail :

- generer des objectifs `faction_generated` pour les factions compatibles avec une tension active ;
- permettre aux factions criminelles d'exploiter `scarcity`, `commercial` et `criminal` via `extort` ;
- permettre aux factions marchandes de reagir aux crises de marche et aux routes commerciales exposees ;
- permettre aux factions militaires de reagir aux tensions de corridor ;
- permettre aux factions religieuses de viser l'influence lors de tensions sociales, religieuses ou politiques ;
- donner a `extort` une progression d'objectif ;
- ajouter les objectifs et actions opportunistes aux verifications courte et long-run.

Definition of done :

- une penurie peut creer un objectif opportuniste criminel ;
- une penurie peut creer un objectif opportuniste marchand ;
- une route menacee peut creer un objectif opportuniste militaire ;
- une faction non-systeme peut executer cet objectif et produire des consequences visibles ;
- le long-run observe des objectifs `faction_generated` criminels, marchands et militaires sans explosion de tensions.

### Lot 12 - Relations inter-factions

Statut : `completed`

But :

- transformer les actions de faction en consequences politiques lisibles entre acteurs.

Travail :

- creer ou mettre a jour les relations bilaterales quand une action importante reussit ;
- degrader la confiance et augmenter l'hostilite apres une extorsion locale ;
- ameliorer la confiance quand une faction securise ou repare un corridor utile ;
- historiser les changements via `relation_shift` ;
- ajouter les relations aux verifications courte et long-run.

Definition of done :

- une extorsion reussie rend les factions concernees plus hostiles a l'acteur criminel ;
- une securisation de route augmente la confiance des acteurs qui dependent du corridor ;
- le long-run observe des traces `relation_shift` sans bloquer le renouvellement des tensions et objectifs.

### Lot 13 - Objectifs emergents de rivalite

Statut : `completed`

But :

- faire des relations hostiles une cause d'action autonome, pas seulement une consequence historisee.

Travail :

- detecter les relations non-systeme dont l'hostilite atteint un seuil de rivalite ou de guerre ;
- generer des objectifs `faction_generated` marques `relation_generated` ;
- choisir une cible locale pertinente selon les zones d'influence et les pressions du quartier ;
- utiliser les actions existantes selon le profil de faction : `extort`, `patrol`, `sanctify_site`, `inspect_customs`, `reopen_market` ;
- appliquer une consequence relationnelle ciblee `anti_rival_success` quand l'action d'un objectif anti-rival reussit ;
- eviter les doublons par acteur, rival, statut et cible ;
- historiser la creation via `faction_objective_created` ;
- ajouter les verifications courte et long-run.

Definition of done :

- une relation hostile peut creer un objectif anti-rival ;
- cet objectif entre dans la file de la faction qui le porte ;
- une reussite anti-rival degrade directement la relation acteur/rival ;
- le long-run observe des objectifs `relation_generated` sans explosion de tensions.

### Lot 14 - Objectifs emergents de cooperation

Statut : `completed`

But :

- faire des relations de confiance une cause d'action autonome, pour que les alliances produisent autre chose qu'un etat passif.

Travail :

- detecter les relations non-systeme avec confiance elevee et hostilite faible ;
- chercher un corridor partage pertinent entre les deux factions ;
- generer un objectif `faction_generated` marque `relation_generated` et `cooperation_generated` ;
- utiliser les actions de corridor existantes : `repair_route` et `secure_route` ;
- appliquer une consequence relationnelle ciblee `alliance_support_success` quand l'action reussit ;
- afficher l'objectif relationnel comme cooperation dans l'UI, avec cible alliee et effet attendu ;
- ajouter une verification courte de creation d'objectif cooperatif.

Definition of done :

- une relation de confiance peut creer un objectif de soutien de corridor ;
- cet objectif entre dans la file de la faction qui le porte ;
- la calibration distingue les effets anti-rival et cooperation ;
- une reussite cooperative renforce directement la relation acteur/allie.

### Lot 15 - Consequences systemiques des mobiles

Statut : `completed`

But :

- faire des mobiles autre chose que des marqueurs de deplacement : ils doivent transporter une consequence d'un point du monde vers un autre.

Travail :

- appliquer des effets bornes quand un mobile arrive a destination ;
- appliquer des effets bornes quand un mobile est retarde, deroute ou pris dans une embuscade ;
- faire varier ces effets selon le profil du mobile : convoi, patrouille, contrebande, religieux ;
- faire progresser l'objectif principal porte par le mobile a l'arrivee ;
- augmenter l'echec de l'objectif principal quand le mobile subit un revers ;
- historiser les effets via `mobile_arrival_effect`, `mobile_delay_effect` et `mobile_ambush_effect` ;
- afficher les arrivees et revers mobiles utiles dans la calibration.

Definition of done partielle :

- un mobile arrive peut modifier la ville, la region ou la route ciblee ;
- un convoi charge peut ameliorer l'approvisionnement ;
- l'arrivee d'un mobile peut faire progresser son objectif ;
- un retard ou une embuscade peut degrader la route, la destination et l'objectif ;
- la verification courte couvre une arrivee controlee et une embuscade controlee.

### Lot 16 - Generation autonome de mobiles

Statut : `done`

But :

- permettre au monde de creer une capacite mobile minimale quand un objectif systeme ou logistique en a besoin.

Travail :

- detecter les factions avec objectif actif mais sans mobile utilisable ;
- generer un mobile runtime borne, rattache a la faction et a l'objectif ;
- choisir un profil selon l'objectif : convoi, patrouille, colonne civique ou groupe d'agents ;
- calculer un premier itineraire si possible ;
- historiser la creation via `mobile_generated` ;
- retirer les mobiles runtime sans objectif actif et sans trajet pour liberer le plafond de generation ;
- afficher les mobiles generes dans la calibration.

Definition of done partielle :

- une faction systeme sans mobile peut creer un acteur mobile autonome ;
- la generation ne s'applique pas a toutes les opportunites criminelles ou narratives ;
- la verification courte couvre la generation d'un mobile pour un objectif systeme ;
- la sonde longue `verify:world-simulation:mobility-long` couvre le cas ou les mobiles cessaient de bouger ou d'etre crees apres environ 100 ticks.

Reste a traiter :

- generation autonome de mobiles non-systeme depuis les besoins du monde ;
- interactions mobile/mobile ou mobile/faction sur une meme route ;
- meilleure visualisation des mobiles en transit et de leurs risques.

## Etat Initial Au Moment Du Gel

- cycle systemique : Lots 1, 2, 3, 4 et 5 lances ;
- factions systeme : generation runtime implemente ;
- objectifs systeme : generation macro runtime implemente ;
- actions de stabilisation : premier socle implemente ;
- usure territoriale : derive macro implemente ;
- conversion des tensions : premier cycle reactif implemente ;
- tensions actives : cycle de vie macro implemente ;
- soulagement des tensions : actions systeme reliees aux tensions actives ;
- discipline systeme : factions systeme limitees aux objectifs actifs ;
- factions opportunistes : premiers objectifs `faction_generated` implementes ;
- relations inter-factions : consequences relationnelles des actions reussies implementees ;
- objectifs de rivalite : relations hostiles capables de generer des objectifs anti-rival ;
- objectifs de cooperation : relations de confiance capables de generer des objectifs de corridor ;
- mobiles : premiere consequence systemique d'arrivee implementee ;
- generation mobile autonome : premier generateur borne pour objectifs systeme/logistiques ;
- observabilite : verification CLI, overlay carte, panneaux tensions et historique implementes.
