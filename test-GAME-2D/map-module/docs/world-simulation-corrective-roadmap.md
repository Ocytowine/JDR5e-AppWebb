# World Simulation Corrective Roadmap

## Statut

Document de suivi actif.

Cette feuille suit les corrections et ameliorations decidees apres la stabilisation du cycle systemique, des tensions, des relations et des premiers mobiles autonomes.

Objectif principal : rendre le monde plus lisible, plus reactif et moins dependants de comportements implicites difficiles a diagnostiquer.

## Invariants

- Le module ne depend pas d'une IA pour faire vivre le monde.
- Le joueur n'a pas besoin d'etre situe quelque part pour que villes, factions, routes et mobiles evoluent.
- Le runtime reste autonome et data-driven.
- Chaque nouvelle reaction doit etre observable dans l'UI ou dans une sonde CLI.
- Les corrections doivent renforcer les interactions entre entites : faction, ville, route, region, tension, objectif et mobile.

## Raccord narration — verticale 6V

La simulation mondiale fournit les causes macroscopiques du monde vivant. Elle
ne produit ni prose ni initiative sociale à la place du module narration.

Lorsque l'horloge diégétique avance, elle doit pouvoir produire des événements
où :

- une faction ou un mobile agit sans que le personnage soit présent ;
- l'action vise une ville, une route, une faction ou un autre mobile ;
- une conséquence distante reste inconnue du personnage ;
- un effet local pertinent peut ensuite être projeté vers une scène narrative.

Le raccord cible est défini dans
[`Contrat-cible-monde-vivant-et-initiative-pnj.md`](../../narration-module/docs/Contrat-cible-monde-vivant-et-initiative-pnj.md).
La gate 6V est fermée avant le lot narration 6E. Elle vérifie que les événements
autoritaires du monde sont filtrés par perception et connaissance avant leur
mise en scène, sans dupliquer `world-simulation` dans le module narration.

Raccord livré le 2026-07-28 : le module narration lit les résultats temporels
`WORLD_SIMULATION` déjà committés et n'adapte que leurs signaux perceptibles.
Les événements internes, deltas, tags et payloads restent hors de la projection.
Un résolveur injecté relie la scène aux références du monde ; le noyau ne devine
aucune correspondance. La gate 6V reste la prochaine certification transverse.

## Axe 1 - Diagnostic Mobile

Statut : `in_progress`

But :

- supprimer l'ambiguite entre un mobile immobile, un mobile bloque, un mobile hors-route et un mobile en progression abstraite.

Travail :

- [x] afficher un statut runtime normalise pour chaque mobile ;
- [x] distinguer `en_route`, `hors_route`, `navigation_abstraite`, `bloque_eau`, `arrive`, `sans_mission` ;
- [x] exposer la cause du dernier etat : pas d'itineraire, mode incompatible, objectif termine, destination atteinte ;
- [x] rendre visible la progression hors-route sans la confondre avec une progression sur corridor ;
- [x] garder un garde-fou CLI autour des mobiles assignes mais inactifs ;
- [ ] ajouter un statut explicite `retire` si les mobiles retires deviennent visibles dans une archive UI.

Definition of done :

- [x] la fiche `Mobile suivi` explique clairement pourquoi un mobile bouge ou ne bouge pas ;
- [x] une sonde longue permet de verifier qu'une fenetre tardive ne masque pas un blocage de mobilite ;
- [x] un mobile hors-route ou en navigation abstraite n'apparait plus comme simplement `idle`.

## Axe 2 - Causes D'Action

Statut : `in_progress`

But :

- rendre lisible la raison qui pousse une faction ou un mobile a agir.

Travail :

- [x] normaliser une cause d'action sur les sorties selectionnees ;
- [x] couvrir au minimum :
  - objectif actif ;
  - tension locale ;
  - besoin logistique ;
  - rivalite ;
  - cooperation ;
  - opportunite de crise ;
  - reaction a un mobile ;
  - maintenance systeme ;
- [x] afficher cette cause dans la calibration et les panneaux d'analyse ;
- [ ] historiser les cas importants sans surcharger `recentHistory`.

Definition of done :

- [x] une action selectionnee peut etre reliee a une cause concrete ;
- [x] le diagnostic `Trop institutionnel` ou `Actif` peut etre interprete sans lire le code ;
- [x] les actions opportunistes et relationnelles sont distinguables des actions de maintenance publique.

## Axe 3 - Objectifs Multi-Phases

Statut : `completed`

But :

- faire evoluer les objectifs comme des processus, pas seulement comme des compteurs de progression.

Travail :

- [x] s'appuyer sur `objective-phases-runtime-plan.md` ;
- [x] introduire des phases simples : preparation, projection, confrontation, resolution ;
- [x] connecter les actions selectionnees a une phase concrete d'objectif ;
- [x] permettre l'echec partiel d'une phase sans forcement echouer l'objectif entier ;
- [x] afficher la phase active et les transitions observees ;
- [x] renforcer ensuite le role des mobiles comme executants explicites d'une phase.

Definition of done :

- [x] un objectif de corridor ou de crise peut passer par plusieurs etapes lisibles ;
- [x] un mobile sert une phase identifiable ;
- [x] les echecs ou succes peuvent modifier la phase active ;
- [x] les tests couvrent au moins un objectif qui progresse et change de phase.

## Axe 4 - Mobiles Non-Systeme

Statut : `todo`

But :

- etendre la vie mobile au-dela des factions publiques et logistiques.

Travail :

- generer des mobiles non-systeme depuis les besoins du monde ;
- couvrir progressivement :
  - marchands ;
  - criminels ;
  - religieux ;
  - militaires opportunistes ;
  - messagers ;
  - refugies ;
  - contrebandiers ;
- limiter la generation par contexte, ressources et risque ;
- faire porter a ces mobiles une intention lisible ;
- creer des reactions avec les villes, routes, factions et autres mobiles.

Definition of done :

- le monde peut produire de la mobilite marchande, criminelle ou religieuse sans edition manuelle ;
- ces mobiles peuvent modifier une route, une ville, une relation ou une tension ;
- la sonde longue observe de la mobilite non-systeme sans saturation ni bruit aleatoire.

## Axe 5 - Calibration Apres Preuve

Statut : `todo`

But :

- ajuster les seuils seulement apres avoir assez de signaux observables.

Travail :

- comparer les fenetres 10/30 ticks avant et apres les axes precedents ;
- surveiller :
  - nombre d'actions selectionnees ;
  - evenements et deltas ;
  - tensions fortes ;
  - objectifs dormants ;
  - mobiles generes ;
  - mobiles bloques ;
  - fatigue haute ;
  - relations qui evoluent ;
- documenter les seuils qui semblent trop hauts ou trop bas.

Definition of done :

- les seuils de generation mobile et opportuniste sont justifies par des sondes ;
- le monde reste actif sans devenir bruyant ;
- les corrections de calibration sont petites et tracables.

## Ordre Recommande

1. Axe 1 - Diagnostic Mobile.
2. Axe 2 - Causes D'Action.
3. Axe 3 - Objectifs Multi-Phases.
4. Axe 4 - Mobiles Non-Systeme.
5. Axe 5 - Calibration Apres Preuve.

Raison :

- les axes 1 et 2 rendent le systeme lisible ;
- l'axe 3 ajoute la profondeur comportementale ;
- l'axe 4 ajoute de la diversite vivante ;
- l'axe 5 ajuste les seuils une fois que le moteur produit des preuves exploitables.

## Notes De Suivi

- Le probleme observe autour du tick 80-100 venait surtout de mobiles runtime obsoletes ou assignes sans trajet actif. Une sonde dediee existe maintenant pour eviter la regression.
- Les trajets hors-route, fluviaux et maritimes sont possibles, mais leur lisibilite UI reste a renforcer.
- Les mobiles sont maintenant capables de produire des consequences et des rencontres ; il reste a mieux exposer leur intention et leur cause.
