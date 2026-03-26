# Editor First Roadmap For World Simulation

## But

Ce document sert de mini-roadmap pour avancer dans le bon ordre :

1. completer l'edition de carte ;
2. permettre la personnalisation des donnees de simulation avant execution ;
3. seulement ensuite, renforcer le runtime et son exploitation.

L'objectif est d'eviter un moteur riche mais impossible a nourrir proprement depuis l'editeur.

## Principe

Regle directrice :

- tout ce que la simulation consomme de facon importante doit etre soit editable dans l'UI, soit derive de facon explicite et comprehensible ;
- tout ce qui reste seulement implicite ou infere doit etre documente comme tel ;
- avant d'ajouter des comportements au runtime, verifier que les donnees necessaires peuvent etre saisies, relues et corrigees dans l'editeur.

## Base D'Analyse

Cette analyse compare :

- les types de layout dans `data/worldMapLayout.ts` ;
- les capacites runtime de `world-simulation/*` ;
- les champs effectivement exposes dans `ui/WorldMapEditorScreen.tsx` ;
- les mutations supportees par `ui/editor/mapEditorReducer.ts` et `ui/editor/mapEditorLayoutUtils.ts`.

## Lecture Rapide

Etat general actuel :

- la base carte est deja bien editable ;
- la base simulation couvre maintenant une bonne partie des entrees critiques du runtime ;
- le preflight, les trajets, la logistique preview, les profils de population, les zones fines de faction et les objectifs enrichis existent deja ;
- les objectifs peuvent maintenant porter des phases, des ancrages requis et des consequences, avec lecture de dependances locales ;
- le prochain trou structurel principal n'est plus le socle de saisie, mais l'inspection des pressions source et l'amelioration de la lecture systemique avant simulation.

## Etat D'Avancement Reel

### Deja Fait

- panneau de preflight simulation dans l'editeur ;
- validation des references critiques ;
- validation d'itineraire ;
- ouverture cliquable des warnings du preflight vers l'entite concernee ;
- selecteurs guides pour `targetId`, `positionId`, `destinationId` ;
- support visible de `positionCell` et `destinationCell` ;
- auto-itineraire ;
- affichage du trajet mobile sur la carte ;
- edition manuelle d'itineraire sans JSON brut ;
- vue logistique par faction ;
- `PopulationProfile` pour villes, factions et mobiles ;
- heritage faction -> mobile ;
- affichage du profil effectif dans l'editeur ;
- overrides de quartiers derives pour nom, tags, activites, lieux importants et population ;
- zones fines de faction ;
- ancrages locaux de faction ;
- phases d'objectif ;
- ancrages requis sur objectifs ;
- consequences `onSuccess / onFailure` editables ;
- lecture des dependances objectif -> ancrage -> logistique ;
- blocage runtime des objectifs sans prerequis locaux satisfaits.

### Partiellement Fait

- quartiers pilotables : via overrides, mais pas encore comme entites manuelles completes ;
- inspection simulation dans l'editeur : bonne base avec preflight, logistique et dependances d'objectif, mais pas encore de vue complete des pressions source ;
- ergonomie d'edition : beaucoup mieux qu'au depart, mais il reste encore des listes texte libres.

### Pas Encore Fait

- inspection des pressions source ;
- bibliotheque d'actions editable ;
- edition avancee des consequences avec UI plus guidee ;
- modelisation plus native des quartiers si le besoin local l'exige.

## Analyse Point Par Point

### 1. Terrain Et Cellules

Etat actuel :

- editable ;
- geographie, surface, difficulte, risque, relief et tags existent ;
- la selection multi-case permet d'appliquer des changements de masse.

Impact simulation :

- tres bon socle pour deriver danger, commerce, production, route risk et profils de quartier.

Manques :

- pas de vue synthese "simulation inputs par cellule" ;
- pas de validation metier des tags utilises pour la simulation ;
- pas de champs de population ou de composition locale ;
- pas de saisie explicite de points d'ancrage utilisables hors modeles de faction et d'objectif.

Priorite :

- `P2`.

Decision :

- garder l'edition terrain telle quelle ;
- enrichir la lecture, pas surcharger la cellule brute.

### 2. Villes

Etat actuel :

- une ville peut etre placee et liee a une entree wiki ;
- `wikiEntityId`, `kind`, `markerColor`, `governanceId`, `governanceRole` sont relies a l'edition globale ;
- `populationProfile` est deja editable ;
- le runtime derive ensuite ses stats depuis les cellules proches.

Impact simulation :

- suffisant pour un seed automatique ;
- deja utile pour la coherence avant simulation.

Manques :

- aucun champ de specialisation economique explicite ;
- aucun override pour les stats seed runtime de ville ;
- aucun controle fin sur la maniere dont les quartiers sont derives ;
- aucun lien explicite avec des lieux structurants pour la simulation.

Priorite :

- `P2`.

Decision :

- la ville est deja une vraie source de coherence ;
- le prochain gain viendra plutot des quartiers et des dependances locales.

### 3. Quartiers

Etat actuel :

- pas d'entite quartier editable directement ;
- les quartiers sont infers dans `mapAdapter.ts` depuis les cellules autour d'une ville ;
- des overrides de quartiers derives existent deja dans l'editeur.

Impact simulation :

- bon compromis pour avancer sans refonte lourde ;
- deja pilotable localement dans une premiere version.

Manques :

- pas de creation manuelle de quartier ;
- pas de vrai quartier natif dans le layout ;
- pas de modelisation plus riche des liens quartier <-> objectif <-> ancrage.

Priorite :

- `P1` pour consolider les overrides ;
- `P2` si un jour on veut de vrais quartiers manuels.

Decision :

- continuer avec quartiers derives + overrides tant que cela couvre le besoin ;
- ne pas partir sur une refonte complete tant que l'inspection et la lecture systemique ne sont pas meilleures.

### 4. Gouvernance, Territoires, Regions, Zones

Etat actuel :

- bien couverts par l'editeur ;
- affectation multi-cellule, definitions, liens politiques et zones geographiques fonctionnent deja ;
- les factions peuvent maintenant declarer des zones fines.

Impact simulation :

- bon socle spatial et politique ;
- directement exploitable pour regions, pressions et coherence de zones.

Manques :

- pas encore de lecture transversale forte entre zones de faction, pressions et objectifs ;
- pas encore de couche d'analyse qui explique comment une zone devient importante dans la simulation.

Priorite :

- `P1`.

Decision :

- les structures sont deja la ;
- le besoin principal est maintenant la lecture et non plus la creation brute.

### 5. Routes Et Traces

Etat actuel :

- creation et edition de routes solides ;
- tracage case par case ;
- type de route, sens, validations de trace et falaises deja presentes ;
- les trajets mobiles sont deja lisibles sur la carte ;
- un auto-itineraire existe deja.

Impact simulation :

- excellent socle pour les trajets ;
- deja exploite par `travel.ts` et `logisticsPlanner.ts`.

Manques :

- pas de panneau de lecture des capacites simulation d'une route ;
- pas de validation orientee transport au niveau route ;
- pas de visualisation ciblee des chemins critiques a l'echelle objectif.

Priorite :

- `P1`.

Decision :

- les routes ne sont plus un blocage de socle ;
- elles deviennent un sujet de lecture avancee.

### 6. Factions

Etat actuel :

- creation et edition de base disponibles ;
- identite, type, description, agenda, methodes, objectifs suggeres, tags, ancrage ville/region, presence sur cellules, stats et relations sont edites ;
- `populationProfile` est editable ;
- une vue logistique existe deja pour la faction selectionnee ;
- des zones fines et des ancrages locaux sont maintenant editables.

Impact simulation :

- deja utile ;
- permet de nourrir une grosse partie du seed runtime.

Manques :

- pas de `baseCell` editable apres creation ;
- pas de modelisation fine des ressources de transport ;
- pas d'indication claire de "faction purement locale" vs "faction mobile/projection".

Priorite :

- `P1` pour les lectures logistiques ;
- `P2` pour `baseCell` et ressources plus fines.

Decision :

- la faction est deja une unite editable solide ;
- le prochain gain viendra surtout de la lisibilite systemique.

### 7. Relations Entre Factions

Etat actuel :

- editable ;
- statut, confiance, hostilite et notes supportes.

Impact simulation :

- bon socle pour futures tensions et choix d'actions.

Manques :

- pas de validation symetrique ou semi-symetrique ;
- pas de lecture transversale de toutes les relations ;
- pas d'effet direct visible dans l'editeur sur zones, objectifs ou pressions.

Priorite :

- `P2`.

Decision :

- laisser ce bloc tel quel dans un premier temps ;
- ajouter surtout de la validation et de la lisibilite.

### 8. Objectifs Speciaux

Etat actuel :

- creation et edition de base disponibles ;
- categorie, owner, description, importance, cible, priorite, progression, etat, obstacles, actions compatibles, tags et zones sont edites ;
- les references critiques sont deja guidees ;
- les objectifs peuvent porter des phases, des ancrages requis et des consequences ;
- leurs dependances locales sont deja lues dans l'editeur ;
- les objectifs non prets sont bloques au runtime.

Impact simulation :

- on est deja au-dela du MVP ;
- le bloc objectif est maintenant structurant pour la coherence locale.

Manques :

- pas de cible d'execution explicitement editable ;
- pas de besoin logistique editable ;
- pas d'UI tres guidee pour les consequences ;
- pas de vue encore plus riche liant pressions, prerequis et projection.

Priorite :

- `P1`.

Decision :

- les objectifs ne sont plus un blocage de modele ;
- ils demandent maintenant surtout de la lecture systemique et du raffinement UX.

### 9. Acteurs Mobiles

Etat actuel :

- creation et edition de base disponibles ;
- owner, position, destination, itineraire, travelMode, objectifs, tags d'interaction, niveau de simulation et stats sont edites ;
- `positionCell` et `destinationCell` sont exposes ;
- l'itineraire est visible sur la carte ;
- un auto-itineraire est disponible ;
- le profil de population peut etre defini ou herite.

Impact simulation :

- bonne base ;
- bien plus fiable qu'au depart pour preparer la simulation avant execution.

Manques :

- pas de distinction claire entre mode desire, mode retenu et capacite reelle ;
- pas de notion d'affectation prioritaire a un objectif ;
- encore quelques champs listes saisis comme texte.

Priorite :

- `P1`.

Decision :

- le bloc mobile est deja viable ;
- les prochains raffinements doivent surtout ameliorer la lisibilite logistique.

### 10. Trajets, Logistique Et Modes De Transport

Etat actuel :

- le runtime sait deja comparer `pied`, `cheval`, `bateau` ;
- calculer des itineraires ;
- estimer risque, cout et ticks ;
- allouer des ressources de transport ;
- l'editeur expose deja une grande partie utile de ce socle ;
- une vue logistique de faction existe deja.

Manques :

- pas de donnees explicites de ressources transport pour les factions ;
- pas de route planner plus riche dans l'editeur ;
- pas de visuel des chemins critiques a l'echelle objectif assez pousse ;
- pas de diagnostic complet objectif inaccessible / objectif bloque / objectif logistiquement projetable.

Priorite :

- `P1`.

Decision :

- ce chantier n'est plus un blocage de socle ;
- il devient un chantier d'amelioration de lecture et de diagnostic.

### 11. Pressions

Etat actuel :

- aucune edition directe des definitions de pressions dans l'UI ;
- mais les entrees sources existent en partie via terrain, tags, routes, factions, villes ;
- le runtime sait deja calculer des traces de pression detaillees.

Impact simulation :

- tres bon potentiel ;
- mais encore peu visible depuis l'editeur.

Manques :

- pas de panneau d'inspection "quelles donnees de carte alimentent quelle pression" ;
- pas d'edition de bibliotheque de pressions ;
- pas de visualisation pre-simulation des hotspots attendus.

Priorite :

- `P1` pour l'inspection ;
- `P2` pour l'edition des definitions.

Decision :

- commencer par exposer les traces detaillees deja calculees ;
- ne pas partir trop vite sur un editeur de formules.

### 12. Bibliotheque D'Actions

Etat actuel :

- non editable dans l'UI ;
- entierement codee dans `world-simulation/definitions.ts`.

Impact simulation :

- fonctionne pour un MVP ;
- limite le cote data-driven si l'utilisateur veut vraiment composer le monde sans toucher au code.

Manques :

- pas de catalogue d'actions dans l'editeur ;
- pas de lecture des preconditions, couts, risques et effets depuis l'UI ;
- pas de lien guide entre objectifs et actions compatibles.

Priorite :

- `P2`.

Decision :

- a ne pas traiter avant les besoins de lecture des pressions et dependances.

### 13. Consequences, Signaux, Rumeurs, Opportunites

Etat actuel :

- les objectifs peuvent maintenant definir des consequences editables ;
- le runtime sait deja produire tensions, opportunites et signaux ;
- l'edition reste encore assez brute.

Impact simulation :

- deja utile pour preconfigurer un monde plus vivant ;
- encore peu confortable a utiliser a grande echelle.

Manques :

- pas de presets ergonomiques de consequences ;
- pas de schema de sortie configure par scenario ;
- pas de lecture transversale de l'impact attendu avant simulation.

Priorite :

- `P2`.

Decision :

- garder le support data-driven ;
- raffiner l'ergonomie plus tard.

### 14. Validation Et Preflight

Etat actuel :

- validations route presentes ;
- preflight simulation deja present dans l'editeur ;
- validations structurelles deja en place pour factions, objectifs, mobiles, itineraires et profils de population ;
- les warnings principaux sont cliquables et ouvrent l'entite concernee ;
- les prerequis locaux d'objectif sont deja detectes.

Impact simulation :

- gros gain de fiabilite avant lancement ;
- le socle de validation existe deja.

Manques :

- validations encore plus metier ;
- explication plus profonde des blocages logistiques ;
- lecture plus fine des hotspots de pression avant simulation.

Priorite :

- `P1`.

Decision :

- le preflight n'est plus a creer ;
- il faut maintenant l'enrichir progressivement.

### 15. Ergonomie D'Edition

Etat actuel :

- moins de champs libres sur les references critiques ;
- encore beaucoup de listes en texte comma-separated ;
- edition possible, mais encore perfectible.

Impact simulation :

- la dette UX diminue ;
- mais elle existe encore sur les listes et les structures riches.

Manques :

- composants de liste plus riches pour remplacer les champs comma-separated restants ;
- vues de synthese plus riches par faction / objectif / mobile ;
- meilleure lecture des pressions et dependances.

Priorite :

- `P1`.

Decision :

- l'ergonomie reste un sujet central ;
- maintenant il faut surtout reduire la saisie libre sur les modeles enrichis deja en place.

## Gaps Les Plus Importants A Ne Pas Oublier

Si on veut "edition d'abord", voici les oublis les plus dangereux aujourd'hui :

1. inspection des pressions encore faible ;
2. trop de saisie libre sur certaines listes structurelles ;
3. quartiers encore dependants d'une logique derivee plutot que d'entites natives ;
4. logistique encore trop peu lisible a l'echelle objectif ;
5. bibliotheque d'actions toujours non editable.

## Roadmap Mini

### Phase 1. Preparer Les Donnees Critiques

Statut :

- fait.

### Phase 2. Rendre Les Trajets Editables Serieusement

Statut :

- largement fait pour le MVP actuel ;
- reste a raffiner surtout la lecture logistique et les contraintes de transport.

### Phase 3. Ajouter La Coherence Des Races / Populations

Statut :

- fait en premiere version exploitable.

### Phase 4. Sortir Les Quartiers Du Tout-Derive

Statut :

- commence ;
- les overrides de quartiers derives sont deja en place ;
- les quartiers manuels complets n'existent pas encore.

### Phase 5. Factions Et Objectifs Plus Riches

Statut :

- bien commence.

Contenu deja pose :

- zones fines de faction ;
- ancrages locaux ;
- objectifs a phases ;
- prerequis locaux ;
- consequences d'objectif ;
- lecture de dependances.

Reste :

- meilleure lecture systemique ;
- raffinement UX ;
- besoins logistiques plus explicites.

## Priorites Recommandees

### `P0` A Faire En Premier

- plus de `P0` critique bloqueur sur le socle deja traite ;
- stabiliser ce qui existe et basculer sur le prochain palier de lecture.

### `P1` A Faire Juste Apres

- vue d'inspection des pressions source ;
- lecture plus fine de la logistique a l'echelle objectif ;
- quartiers pilotables ou overrides plus riches ;
- reduction de la saisie libre sur les structures deja enrichies.

### `P2` A Garder Pour Ensuite

- edition des formules de pression ;
- edition de la bibliotheque d'actions ;
- parametrage avance des consequences et sorties ;
- overrides manuels complets des seeds runtime.

## Ordre De Travail Concret Recommande

Pour ne pas se disperser, l'ordre le plus rationnel me semble etre :

1. renforcer l'inspection des pressions ;
2. consolider la lecture locale objectif -> ancrage -> logistique ;
3. consolider les quartiers pilotables via overrides ;
4. seulement ensuite envisager une edition avancee des actions.

## Ce Qu'Il Ne Faut Pas Faire

- enrichir encore le runtime sans combler les trous d'edition critiques ;
- ajouter des champs runtime complexes sans UI ou sans validation ;
- multiplier les derivations automatiques opaques sans affichage dans l'editeur ;
- partir trop vite sur une edition avancee des actions tant que les lectures pre-simulation restent insuffisantes.

## Conclusion

Le `map-module` a deja depasse le simple stade de preparation du socle :

- le preflight, les trajets, la logistique preview, les profils de population, les zones fines et les objectifs enrichis sont deja poses ;
- l'editeur couvre maintenant une bonne partie des entrees critiques de la simulation ;
- le prochain palier n'est plus de "rendre le socle editable", mais de rendre la simulation lisible, diagnosable et pilotable avant lancement.

Les prochains chantiers prioritaires sont maintenant :

- meilleure inspection des pressions et dependances ;
- lecture plus fine de la logistique a l'echelle objectif ;
- eventuel approfondissement des quartiers si le besoin local le justifie.
