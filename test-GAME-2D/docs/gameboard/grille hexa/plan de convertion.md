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

## 14. Avancement actuel (2026-02-19)

Fait:
- Structure `src/ui/grid` creee et documentee.
- Facade `createGridAdapter` implementee.
- Helpers `square` implementes (toScreen, toGrid, neighbors, distance, line, isInside).
- Helpers `hex` implementes en base technique (axial + offset `odd-r`/`even-r`, orientation pointy/flat).
- Integration initiale `GameBoard.tsx` realisee en mode `square` uniquement:
  - mapping `screen -> grid`
  - mapping `grid -> screen`
- Phase B activee:
  - `gridKind = hex` dans `GameBoard.tsx`
  - rendu board/overlays en cellules hex (polygones)
  - hit-test souris route via adapter hex
- Phase C activee (partie pathfinding + distances gameplay):
  - pathfinding: voisins derives de la projection active (6 voisins en hex)
  - pathfinding: heuristique A* via distance de grille active
  - distances gameplay centrales (`gridDistance`, `distanceBetweenCells`, `distanceToCells`) branchees sur la metrique de projection active
- Phase D activee (partie AOE + impacts IA):
  - `boardEffects` adapte au mode `hex` pour `circle`, `cone`, `rectangle`, `line`
  - logique d'aura runtime (`SPHERE/CUBE/LINE/CONE`) branchee sur les generateurs AOE communs
  - impacts IA indirects: evaluation de portee/zone alignee sur les nouvelles formes (via distances + auras)

Non fait:
- IA/portees utilisent deja les distances centrales migrees, mais restent a valider en campagne QA complete.
- Certaines couches visuelles reposent encore sur des hypotheses square (notamment calculs avances de fog/light), neutralisees en hex pour eviter des artefacts.
- Pas de batterie de tests automatisee dediee a `ui/grid` a ce stade.

## 15. Etat detaille par etape (audit)

### Etape 1 - Cadrage technique

Statut: `partiel`.

Fait:
- Modes `square` et `hex` presents dans le code.
- Conventions hex implementees: axial interne + offset (`odd-r`/`even-r`) dans les helpers.
- Distance hex utilisee pour pathfinding/distances centrales.

Reste a faire:
- Verrouiller officiellement les choix produit (offset final, orientation finale) au lieu d'avoir encore des options techniques ouvertes.
- Completer la note de decisions avec les justifications fonctionnelles.

### Etape 2 - Couche d'abstraction de grille

Statut: `fait` (phase A atteinte), `partiel` (adoption complete runtime).

Fait:
- Dossier `src/ui/grid` structure et implemente (`types`, `square`, `hex`, `adapter`, `screenMapping`, `index`).
- API `toScreen`, `toGrid`, `neighbors`, `distance`, `line`, `isInside` en place.
- `GameBoard` branche sur l'adapter pour mapping ecran/grille.

Reste a faire:
- Finir de retirer les appels geometriques legacy hors adapter dans les couches annexes.

### Etape 3 - Rendu du plateau en hex

Statut: `partiel` a `avance`.

Fait:
- Grille hex visible (board + overlays principaux en polygones hex).
- Zoom/pan conserves.

Reste a faire:
- Finaliser les couches visuelles encore fortement square (fog/light avance).
- Revalider perf sur scenes denses avec rendu hex actif.

### Etape 4 - Interaction souris / selection

Statut: `partiel` a `avance`.

Fait:
- Hit-test `screen -> grid` branche sur adapter hex.
- Snapping sur cellule valide via adapter.

Reste a faire:
- Campagne de verification manuelle sur bords/coins de cellules.
- Valider systematiquement la reversibilite `grid -> screen -> grid` avec tolerances.

### Etape 5 - Pathfinding / deplacement 6 directions

Statut: `fait` (coeur), `partiel` (validation complete).

Fait:
- Voisins derives de la projection active (6 en hex).
- Heuristique A* branchee sur distance de grille active.
- Regles diagonales square non appliquees en hex.
- Contraintes terrain/occupation/blocage conservees.

Reste a faire:
- QA de non-regression sur tous les profils de deplacement et cas limites.

### Etape 6 - Distances gameplay / portees

Statut: `partiel` a `avance`.

Fait:
- Distances centrales runtime branchees sur metrique active.
- Impact positif sur melee/ranged et selection de cibles IA via utilitaires communs.

Reste a faire:
- Relecture exhaustive des calculs residuels locaux pour supprimer les derniers biais square.
- Verification fonctionnelle des sorts/actions sensibles aux distances.

### Etape 7 - AOE en hex

Statut: `avance` (definitions v2 posees, QA a completer).

Fait:
- `circle/sphere` adapte en radius hex.
- `cone` adapte en hex.
- `rectangle` hex defini en fenetre axiale centree (parallelogramme en coordonnees hex).
- `line` hex defini en rayon axial oriente (une direction hex principale, epaisseur 1).
- Auras runtime (`SPHERE/CUBE/LINE/CONE`) branchees sur generateurs communs.

Reste a faire:
- QA fonctionnelle des nouvelles regles sur cas limites (bord, orientation, cibles multiples).
- Documenter des exemples gameplay de reference (attendu vs observe).

### Etape 8 - Stabilisation / QA

Statut: `non commence`.

Reste a faire:
- Ajouter tests unitaires `ui/grid`.
- Ecrire checklist manuelle complete.
- Mesurer regressions perf et fixer un go/no-go formel.

### Etape 9 - Strategie de migration

Statut: `A/B/C/D realises`, `E en attente`.

Fait:
- Phase A: facade adapteur branchee.
- Phase B: rendu + input en hex.
- Phase C: pathfinding + distances en hex.
- Phase D: AOE + impacts IA initiaux.

Reste a faire:
- Phase E: nettoyage legacy square direct calls.

### Etape 10 - Decoupage helpers / alleger GameBoard

Statut: `partiel` a `avance`.

Fait:
- Structure du dossier cible implementee.
- Conventions documentees.

Reste a faire:
- Poursuivre l'extraction de logique geometrique encore dans `GameBoard.tsx`.

### Etape 11 - Points a trancher

Statut: `partiel`.

Etat courant:
- Offset: `odd-r` utilise en runtime hex actuel.
- Orientation: `pointy-top` utilisee en runtime hex actuel.
- Rectangle/line hex: regles v2 implementees (rectangle axial, line axiale orientee).
- Compatibilite sauvegardes/maps: a valider.
- Feature flag: present en pratique (activation hex), politique long terme a formaliser (global/par map).

### Etape 12 - Estimation de charge

Statut: `a recalibrer`.

Commentaire:
- Les phases majeures sont lancees.
- Le reste du travail est concentre sur finition regles, QA, et nettoyage technique.

### Etape 13 - Prochaine iteration

Statut: `partiel`.

Fait:
- Le plan a ete transforme en suivi d'avancement concret.

Reste a faire:
- Produire checklist technique fichier par fichier pour la phase E + QA.
- Definir ordre de commits/PR final.
- Poser criteres d'acceptation mesurables pour cloture.

## 16. Focus restant prioritaire (point 1 demande)

Objectif immediat:
- Verifier et stabiliser les regles AOE hex `rectangle` et `line` nouvellement implementees.

Definition de fini proposee:
- Meme resultat entre preview visuelle et application gameplay.
- Regles explicites documentees avec exemples.
- Cas limites couverts (bord de carte, cibles multiples, orientation).

Regles implantees (v2):
- `rectangle` hex: fenetre axiale centree sur l'ancre (`q`/`r`), interpretee comme un parallelogramme.
- `line` hex: rayon axial suivant la direction hex la plus proche du facing (6 orientations principales).

## 17. Bugs a traiter (vision/fog) - audit du 2026-02-19

Reference detaillee:
- `test-GAME-2D/docs/gameboard/grille hexa/debug vision.md`

Constats critiques:
- Fog non rendu en hex:
  - Le bloc de rendu fog est conditionne par `!isHexGrid`, donc jamais execute en mode hex.
  - Impact: "pas de fog visible en jeu" meme si la visibilite est calculee.
- Incoherence d'unites sur `visionProfile.range`:
  - Une partie du pipeline traite `range` en metres (`metersToCells`), une autre en cases (valeur brute).
  - Impact: ecart entre visibilite gameplay, debug, et rendu.
- Algorithmes LOS/visibility encore structures "square":
  - Shadowcast 8 octants + supercover DDA carre utilises en runtime visibilite.
  - Impact: resultats non fiables pour une grille hex.
- Couche fog/fog-cap partiellement inactive:
  - certaines fonctions de capage visibilite sont no-op ou non connectees.
  - Impact: comportement difficile a predire et maintenance fragile.

Contraintes produit a appliquer (decision):
- Objectif final: suppression totale du code de grille carree dans le runtime gameboard.
- Le trace de fog est uniquement un feedback de vision du joueur.
- Les ennemis gardent leur propre vision runtime (IA, detection, reactions), mais ne dessinent pas de fog.
- La vision doit devenir data-driven JSON, comme les deplacements:
  - distance/portee
  - angle/forme de vision
  - vision dans le noir
  - vision a travers obstacles
  - inversion sombre/lumiere (eblouissement)

Priorite de traitement:
- P0: retablir fog joueur en hex (rendu fonctionnel, sans dependance square).
- P0: unifier les unites de portee vision (source de verite unique).
- P1: basculer LOS/visibility en logique hex native.
- P1: separer clairement "vision runtime" et "fog de presentation joueur".
- P2: finaliser le schema JSON de vision et migrer les profils existants.
