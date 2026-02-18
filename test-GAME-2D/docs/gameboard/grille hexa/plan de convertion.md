# Plan de convertion vers une grille hexagonale

Objectif: migrer le gameboard de la grille carree vers une grille hexagonale, sans gestion des murs dans un premier temps, avec une trajectoire claire et incrementale.

Note: ce plan est volontairement detaille point par point. Nous allons ensuite le raffiner ensemble avant implementation.

## 1. Cadrage technique (etape 0)

- Definir un mode de grille explicite: `square` et `hex`.
- Fixer une convention hex unique:
  - logique interne: axial (`q`, `r`)
  - stockage tableau/indices: offset (`col`, `row`) type `odd-r` (a valider)
- Definir les invariants de distance:
  - distance de deplacement en hex = distance cube
  - cout par case = 1 (hors terrain)
- Lister les comportements hors scope v1:
  - murs
  - blocage par aretes
  - regles fines de LOS par arete

Livrables:
- helpers de base de conversion et distance
- note de decisions (convention, arrondis, orientation)

## 2. Introduire une couche d'abstraction de grille

- Ajouter un adaptateur de grille pour eviter les appels directs aux calculs square.
- Centraliser dans des helpers:
  - `toScreen`
  - `toGrid`
  - `neighbors`
  - `distance`
  - `line` (pour LOS simplifiee)
  - `isInside`
- Garder le comportement courant `square` comme reference (pas de regression).

Livrables:
- API stable de helpers de grille
- remplacement progressif des appels critiques cote UI et runtime

## 3. Rendu du plateau en hex

- Remplacer le dessin des cases carrees par des polygones hex.
- Conserver zoom/pan existants.
- Adapter le placement des overlays base sur centre de case.
- Adapter les labels de case si necessaire.

Livrables:
- grille hex visible
- performances equivalentes ou proches du mode actuel

## 4. Interaction souris et selection de case

- Adapter `screen -> grid` pour hit-test hex.
- Verifier la stabilite des clics sur les bords.
- Uniformiser le snapping sur une case hex valide.

Livrables:
- clic/hover fiables
- conversion reversible `grid -> screen -> grid`

## 5. Pathfinding et deplacement en 6 directions

- Remplacer les directions square (4/8) par 6 voisins hex.
- Supprimer les regles diagonales specifiques square.
- Utiliser une heuristique A* compatible hex.
- Conserver les contraintes existantes:
  - cases bloquees (hors murs)
  - cout terrain
  - occupation token

Livrables:
- chemin preview coherent
- deplacement token coherent

## 6. Distances gameplay et portees

- Remplacer les calculs `Manhattan/Chebyshev` relies a la portee par distance hex.
- Homogeneiser les calculs utilises par:
  - melee
  - distance
  - IA (choix de cible et approche)
- Verifier les impacts sur les sorts bases sur la distance.

Livrables:
- portees coherentes en hex
- comportements IA stables

## 7. Zones d'effet (AOE) en hex

- Adapter `cercle/sphere` -> radius hex.
- Adapter `cone` -> 6 orientations principales.
- Verifier rectangle/ligne selon choix design (a confirmer):
  - emulation hex
  - ou conservation d'une interpretation simple v1

Livrables:
- AOE lisibles et previsibles
- regles explicites documentees

## 8. Stabilisation et QA

- Ajouter tests unitaires sur helpers hex:
  - conversion
  - voisins
  - distance
  - line
- Ajouter une checklist de tests manuels:
  - clic
  - deplacement
  - portee
  - AOE
  - tours IA
- Mesurer regressions perf sur cartes denses.

Livrables:
- baseline de qualite
- criteres de validation go/no-go

## 9. Strategie de migration recommandee

- Phase A: brancher l'adapter sans changer le comportement (square).
- Phase B: activer hex uniquement pour rendu + input.
- Phase C: activer hex pour pathfinding + distances.
- Phase D: activer hex pour AOE + IA.
- Phase E: nettoyage legacy square direct calls.

Benefices:
- risque reduit
- rollback facile entre phases
- diagnostics plus simples

## 10. Decoupage des helpers pour alleger GameBoard

Dossier cible:
- `test-GAME-2D/src/ui/grid`

Structure proposee:
- `types.ts`: types de grille partages (`GridKind`, coords, params)
- `hex.ts`: maths hex (neighbors, distance, conversions)
- `square.ts`: comportement square courant (reference)
- `adapter.ts`: facade unique utilisee par UI et runtime
- `screenMapping.ts`: utilitaires `toScreen`/`toGrid` pour Pixi
- `index.ts`: exports publics
- `README.md`: conventions et exemples d'usage

Principe maintenance:
- `GameBoard.tsx` ne fait plus de calcul geometrique brut.
- `GameBoard.tsx` consomme uniquement des helpers de haut niveau.
- Toute regle de grille vit dans `src/ui/grid`.

## 11. Points a trancher avant implementation

- Convention offset definitive (`odd-r` vs `even-r`).
- Orientation visuelle (pointy-top vs flat-top).
- Regle AOE rectangle/ligne en mode hex.
- Compatibilite sauvegardes/maps existantes.
- Feature flag `gridKind` (global ou par map).

## 12. Estimation de charge (version sans murs)

- MVP jouable (rendu, clic, deplacement, distance): 4 a 6 jours.
- Version robuste (AOE + IA + QA): 6 a 9 jours.

## 13. Prochaine iteration (detail a faire ensemble)

- traduire ce plan en checklist technique fichier par fichier
- definir l'ordre exact des PR/commits
- ajouter criteres d'acceptation par etape
