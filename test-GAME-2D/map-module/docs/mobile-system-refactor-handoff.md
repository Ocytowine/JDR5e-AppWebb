# Refonte Conceptuelle Des Mobiles

## Objectif

Cette doc prepare un chantier de refonte des mobiles dans le `map-module`.

Le but n'est pas de refaire le moteur de simulation. Le but est de rendre :

- la creation des mobiles beaucoup plus simple ;
- leur suivi beaucoup plus lisible ;
- leur conception beaucoup plus proche d'une "unite en mission" que d'un paquet de champs techniques ;
- l'edition avancee toujours possible, mais hors du chemin principal.

Cette doc sert de handoff pour une autre IA. Elle doit lire ce document avant de commencer toute implementation.

## Contexte Actuel

Le systeme mobile existe deja et fonctionne techniquement.

Etat reel :

- les mobiles sont declares dans `layout.simulation.mobileActors` ;
- ils sont edites dans `ui/WorldMapEditorScreen.tsx` ;
- ils sont normalises par `ui/editor/mapEditorLayoutUtils.ts` ;
- ils sont valides par `world-simulation/preflight.ts` ;
- ils sont convertis en runtime par `world-simulation/mapAdapter.ts` ;
- ils sont deplaces par `world-simulation/engine.ts` et `world-simulation/travel.ts`.

Le runtime supporte deja :

- positions `city`, `route`, `region`, `cell` ;
- destinations `city`, `route`, `region`, `cell` ;
- depart et arret precis au milieu d'un troncon ;
- lecture runtime de progression sur route ;
- itineraire derive ou manuel ;
- rattachement a des objectifs ;
- niveau de simulation (`active`, `summary`, `abstract`).

Le probleme principal n'est donc pas un manque de mecanique.

Le probleme principal est un probleme de conception produit et d'UX :

- la creation est encore trop technique ;
- les champs demandent trop d'informations trop tot ;
- le suivi d'un mobile n'est pas assez synthétique ;
- l'utilisateur doit encore penser "itineraire et stats" avant de penser "mission et role".

## Probleme Produit A Resoudre

Aujourd'hui, un mobile melange trop de roles a la fois.

Un mobile est en meme temps :

- une entite fictionnelle ;
- un pion logistique ;
- un acteur de simulation ;
- un transport sur carte ;
- un conteneur de stats.

Cela rend la fiche lourde et l'intention difficile a comprendre.

Le bon modele mental cible doit etre :

1. qui est cette unite ;
2. pour qui agit-elle ;
3. quelle est sa mission ;
4. ou va-t-elle ;
5. dans quel etat est-elle.

Et non :

1. quel est son `positionKind` ;
2. quel est son `destinationKind` ;
3. quel est son `itineraryRouteIds` ;
4. quelle est sa `speed` ;
5. quel est son `simulationLevel`.

## Decision De Conception

La refonte doit etre orientee "unite en mission".

Le systeme mobile cible doit separer clairement :

- identite ;
- mission ;
- deplacement ;
- capacites ;
- lecture runtime.

## Ce Qu'il Faut Garder Absolument

La refonte ne doit pas casser inutilement le socle runtime deja en place.

Il faut conserver :

- le runtime unique dans `world-simulation/*` ;
- le format de derive `layout -> runtime` ;
- les positions `cell` et les arrets au milieu d'une route ;
- `routeProgress`, `currentRouteTargetId`, `destinationRouteProgress` ;
- le preflight existant ;
- le rattachement aux objectifs ;
- les tags d'interaction ;
- le support `simulationLevel`.

En clair :

- refondre l'entree utilisateur et la couche de lecture ;
- ne pas jeter le moteur de deplacement.

## Ce Qui Est Juge Bancal Aujourd'hui

### 1. `type` est trop libre

Le champ `type` est un texte libre. Il n'aide ni l'utilisateur ni le systeme.

Il faut introduire des archetypes metier.

### 2. Le flux de creation demande trop de details trop tot

Aujourd'hui, on demande tres vite :

- position ;
- destination ;
- itineraire ;
- vitesse ;
- securite ;
- fatigue ;
- charge ;
- effectif ;
- ressources.

Or, la plupart des utilisateurs veulent d'abord dire :

- "je cree une patrouille" ;
- "elle appartient a cette faction" ;
- "elle doit securiser cette zone" ;
- "elle part d'ici".

### 3. L'itineraire est trop central

L'itineraire detaille doit etre un mode avance.

Par defaut, le systeme doit proposer :

- depart ;
- cible ;
- trajet automatique ;
- verrouillage manuel seulement si l'utilisateur le demande.

### 4. La mission n'est pas assez explicite

Les `objectiveIds` existent, mais ce n'est pas une couche de mission lisible.

Il manque un vrai resume metier du type :

- mission principale ;
- cible de mission ;
- etat de mission ;
- raison du deplacement.

### 5. Le suivi runtime n'est pas assez synthetique

Le suivi devrait d'abord montrer :

- nom ;
- faction ;
- mission ;
- statut ;
- position actuelle ;
- progression ;
- risque.

Et seulement ensuite les details techniques.

## Vision Cible

## Bloc 1 : Identite

Un mobile doit avoir :

- nom ;
- archetype ;
- faction ;
- couleur ;
- profil de population optionnel.

## Bloc 2 : Mission

Un mobile doit avoir une mission principale lisible.

Concepts cibles :

- mission principale ;
- cible de mission ;
- priorite ;
- comportement ;
- statut de mission.

Exemples de statut :

- `en preparation`
- `en route`
- `sur zone`
- `en action`
- `bloque`
- `en repli`
- `termine`

## Bloc 3 : Deplacement

Le deplacement doit devenir un bloc distinct.

Il doit contenir :

- point de depart ;
- destination courante ;
- mode de trajet ;
- itineraire auto ou manuel.

L'utilisateur ne doit pas etre force de manipuler l'itineraire detaille des le debut.

## Bloc 4 : Capacites

Conserver des stats, mais comme bloc secondaire :

- mobilite ;
- securite ;
- endurance ;
- charge ;
- effectif ;
- ressources.

Important :

- `speed` brute n'est pas un bon concept UX ;
- il faut privilegier une lecture metier comme `lente`, `standard`, `rapide`, `tres rapide` ;
- la valeur numerique interne peut rester si besoin moteur.

## Archetypes A Introduire

Il faut introduire une bibliotheque d'archetypes de mobiles.

Version minimale recommandee :

- `Patrouille`
- `Convoi marchand`
- `Train de ravitaillement`
- `Pelerins`
- `Contrebandiers`
- `Courriers`
- `Escorte`
- `Eclaireurs`

Chaque archetype doit pre-remplir :

- type interne ;
- stats conseillees ;
- tags d'interaction ;
- niveau de simulation recommande ;
- mission typique ;
- mode de transport probable.

Exemple de logique produit :

- `Patrouille` : securite haute, charge basse, role de controle ;
- `Convoi marchand` : charge haute, securite moyenne, mission logistique ;
- `Contrebandiers` : discret, mobile, charge moyenne, mission clandestine ;
- `Pelerins` : securite faible a moyenne, forte composante de rumeur et de pression religieuse.

## Creation Cible

Le parcours de creation ideal doit etre court.

### Etape 1

Choisir l'archetype.

### Etape 2

Choisir la faction.

### Etape 3

Choisir la mission principale.

### Etape 4

Choisir le depart et la cible.

### Etape 5

Valider ou ouvrir les options avancees.

## Champs Minimums Recommandes

Pour creer un mobile, il devrait suffire de renseigner :

- nom ;
- archetype ;
- faction ;
- mission principale ;
- depart ;
- cible.

Tout le reste doit etre derive ou pre-rempli.

## Champs Avances A Conserver

Ces champs doivent rester editables, mais hors du chemin principal :

- itineraire manuel ;
- vitesse brute interne ;
- effectif exact ;
- charge exacte ;
- ressources exactes ;
- tags d'interaction custom ;
- profil de population specifique ;
- niveau de simulation.

## Suivi Cible

La fiche d'un mobile doit commencer par un resume metier.

Resume cible :

- nom ;
- faction ;
- archetype ;
- mission principale ;
- statut ;
- position runtime ;
- progression ;
- risque ;
- destination ;
- mode auto / manuel.

Exemple de resume attendu :

- `Patrouille de la Porte Est`
- `Faction : Garde de l'Aube`
- `Mission : securiser la route de l'Ambre`
- `Statut : en route`
- `Position : route de l'Ambre, 42 %`
- `Risque : eleve`

## Alertes Produit A Ajouter

Le systeme devrait exposer des alertes metier claires :

- mobile sans mission ;
- mobile sans destination ;
- mobile sans owner ;
- mobile avec objectif incompatible ;
- mobile surcharge ;
- mobile fatigue ;
- mobile avec itineraire manuel incoherent ;
- mobile `abstract` mais configure comme un pion de precision ;
- mobile actif sans route praticable.

## Points Etranges Actuels A Connaitre Avant De Coder

L'autre IA doit connaitre ces bizarreries avant tout changement.

### 1. Vitesse par defaut incoherente

Le wizard cree un mobile avec une vitesse tres elevee par defaut.

Produit :

- c'est peu lisible ;
- cela suggere une echelle mal exposee.

Refonte attendue :

- ne pas exposer d'emblee `speed` brute ;
- preferer un preset de mobilite.

### 2. L'itineraire manuel peut etre ecrase

Le moteur recalcule un plus court chemin dans certains cas.

Produit :

- un utilisateur peut croire qu'il controle le trajet ;
- alors que le runtime peut reprendre la main.

Refonte attendue :

- introduire une notion explicite `itineraire auto` / `itineraire verrouille`.

### 3. `simulationLevel` est trop technique

Le terme est utile pour le moteur, mais pas tres clair pour l'utilisateur.

Refonte attendue :

- conserver la valeur technique ;
- exposer des libelles produit plus clairs comme :
  - `pion suivi`
  - `unite resumee`
  - `presence abstraite`

### 4. Le bouton d'auto-itineraire UI est en retard sur le runtime

Le runtime sait mieux gerer les cas `cell` que l'UI ne l'assume encore.

Refonte attendue :

- aligner l'UX avec les capacites reelles du moteur.

### 5. Les mobiles `abstract` doivent etre verifies

Le niveau `abstract` ne doit pas donner l'illusion d'un suivi spatial fin.

Refonte attendue :

- clarifier ce qu'on autorise ou non pour un mobile abstrait ;
- ne pas laisser une fiche tres detaillee suggérer une precision runtime qui n'a pas de sens produit.

## Strategie D'Implementation Recommandee

L'autre IA ne doit pas essayer de tout refaire en un seul passage.

Ordre recommande :

### Lot 1 : Couche conceptuelle sans casser le runtime

- introduire la notion d'archetype mobile ;
- introduire la notion de mission principale lisible ;
- ajouter les libelles produit du `simulationLevel` ;
- ajouter un resume synthese par mobile.

Objectif :

- ameliorer la comprehension sans casser les donnees existantes.

### Lot 2 : Refonte du flux de creation

- remplacer la creation actuelle par un wizard `archetype -> faction -> mission -> trajet -> validation` ;
- pre-remplir les stats et tags depuis l'archetype ;
- passer l'itineraire detaille en options avancees.

Objectif :

- creation rapide sans comprehension technique prealable.

### Lot 3 : Refonte de la fiche mobile

- bloc `Resume`
- bloc `Mission`
- bloc `Deplacement`
- bloc `Capacites`
- bloc `Avance`

Objectif :

- lecture plus naturelle ;
- edition plus lisible ;
- moins d'empilement brut de champs.

### Lot 4 : Clarification runtime / UX

- expliciter `itineraire auto` vs `itineraire verrouille` ;
- verifier le comportement des mobiles `abstract` ;
- harmoniser l'UI avec les capacites route/cell du moteur.

Objectif :

- eviter les comportements perçus comme "surprenants".

## Contraintes De Compatibilite

Le chantier doit respecter ces contraintes :

- ne pas casser les maps existantes ;
- conserver la compatibilite de lecture des anciens `mobileActors` ;
- ne pas supprimer les champs runtime utiles ;
- ne pas exiger une migration JSON brutale des layouts existants ;
- preferer des ajouts progressifs et des derivees par defaut.

## Definition Du Succes

Le chantier sera considere reussi si :

- un utilisateur peut creer un mobile sans comprendre le runtime ;
- un mobile peut etre lu comme une unite en mission ;
- les parametres avances existent encore mais ne polluent plus la creation ;
- le suivi runtime est synthetique avant d'etre technique ;
- les maps existantes restent fonctionnelles ;
- le preflight conserve sa valeur de garde-fou.

## Ce Que L'autre IA Doit Faire Avant Toute Modification

Avant de coder, l'autre IA doit :

1. relire le schema de `WorldMapSimulationMobileActor` ;
2. relire la creation UI actuelle ;
3. relire `mapAdapter.ts`, `preflight.ts`, `travel.ts` et `engine.ts` sur la partie mobile ;
4. identifier ce qui releve de l'UX, du modele de donnee et du runtime ;
5. ne pas toucher au runtime tant qu'une solution UX plus simple n'a pas ete essayee ;
6. verifier a chaque etape que les maps existantes restent chargeables ;
7. relancer build et preflight apres chaque lot.

## Fichiers A Connaitre

- `test-GAME-2D/map-module/data/worldMapLayout.ts`
- `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`
- `test-GAME-2D/map-module/ui/editor/mapEditorReducer.ts`
- `test-GAME-2D/map-module/ui/editor/mapEditorLayoutUtils.ts`
- `test-GAME-2D/map-module/world-simulation/mapAdapter.ts`
- `test-GAME-2D/map-module/world-simulation/preflight.ts`
- `test-GAME-2D/map-module/world-simulation/travel.ts`
- `test-GAME-2D/map-module/world-simulation/engine.ts`

## Recommendation Finale

La bonne refonte n'est pas une "refonte technique des mobiles".

La bonne refonte est :

- une refonte de modele mental ;
- une refonte de creation ;
- une refonte de lecture ;
- en conservant autant que possible le runtime actuel.
