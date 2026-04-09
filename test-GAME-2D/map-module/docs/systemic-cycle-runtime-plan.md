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

## Etat Initial Au Moment Du Gel

- cycle systemique : Lots 1, 2, 3, 4 et 5 lances ;
- factions systeme : generation runtime implemente ;
- objectifs systeme : generation macro runtime implemente ;
- actions de stabilisation : premier socle implemente ;
- usure territoriale : derive macro implemente ;
- conversion des tensions : premier cycle reactif implemente.
