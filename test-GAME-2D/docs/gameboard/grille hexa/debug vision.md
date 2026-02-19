# Debug Vision - axes concrets de correction (hex only)

Date: 2026-02-19

Document lie:
- `test-GAME-2D/docs/gameboard/grille hexa/plan de convertion.md` (section "Bugs a traiter")

## 1) Intentions produit verrouillees

- Plus aucune logique square a terme dans le runtime gameboard.
- Fog affiche uniquement les zones non vues par le joueur actif (le hors-fog correspond aux zones vues).
- Les ennemis utilisent leur vision pour IA/detection/reactions, sans rendu fog.
- La vision doit etre pilotee par JSON data.

## 2) Probleme actuel (resume operationnel)

- Le fog est coupe en hex par condition de garde.
- `visionProfile.range` est interprete tantot en metres, tantot en cases.
- LOS et visibility utilisent encore des briques concues pour grille carree.
- Le rendu fog consomme des donnees partiellement coherentes avec la visibilite gameplay.

## 3) Architecture cible (separation nette)

- Runtime vision (moteur):
  - calcule visibilite joueur + visibilite ennemis, en hex natif.
  - sert aux regles gameplay: ciblage, detection, reactions, IA.
- Presentation fog (UI):
  - lit uniquement la visibilite du joueur actif.
  - dessine uniquement le masque/fog joueur.
  - ne depend d'aucune vision ennemie.

## 4) Plan de correction technique

### Axe A - Unifier les unites de portee

- Decider une unite unique pour `VisionProfile.range`:
  - recommande: metres (coherent avec actions/deplacements deja data-driven).
- Ajouter un champ explicite si necessaire:
  - `rangeUnit: "meters"` (par defaut) pour eviter l'ambiguite.
- Interdire l'usage brut de `range` sans conversion centralisee.

Definition de fini:
- Un seul point de conversion metres -> cases.
- Plus aucune divergence entre calcul gameplay et calcul fog.

### Axe B - Visibility/LOS 100% hex

- Remplacer le shadowcast carre par un algo hex (ou BFS/raycast hex robuste).
- Remplacer la ligne supercover carree par un traceur de ligne hex.
- Garder un seul service LOS reutilisable par:
  - visibilite joueur
  - visibilite ennemis
  - lumiere dynamique

Definition de fini:
- Meme resultat de LOS quel que soit l'appelant (vision, lumiere, ciblage).
- Plus de dependance aux hypotheses carrees.

### Axe C - Fog joueur uniquement

- Pipeline fog:
  - source = `playerVisibility` uniquement.
  - aucun melange avec les masques ennemis.
- Pipeline IA:
  - source = `enemyVisibilityById`.
  - jamais branche sur le rendu fog.

Definition de fini:
- Le fog suit uniquement ce que voit le joueur.
- Les ennemis continuent de "voir" pour leur logique interne, sans effet visuel fog.

### Axe D - Data model JSON vision

Schema cible propose:

```json
{
  "vision": {
    "enabled": true,
    "shape": "cone",
    "range": 18,
    "rangeUnit": "meters",
    "apertureDeg": 120,
    "facingMode": "token_facing",
    "lightPolicy": {
      "mode": "normal",
      "canSeeInDark": false,
      "invertLightAndDark": false
    },
    "occlusionPolicy": {
      "ignoreOpaqueCells": false,
      "ignoreWalls": false,
      "ignoreAllObstacles": false
    },
    "renderPolicy": {
      "contributesToPlayerFog": false,
      "debugDraw": false
    }
  }
}
```

Notes:
- `invertLightAndDark` couvre le besoin d'eblouissement inverse.
- `ignoreOpaqueCells/ignoreWalls` couvre la vision "a travers obstacles".
- `contributesToPlayerFog` doit etre `true` uniquement pour le joueur actif.

Definition de fini:
- Tous les types (joueur/ennemi/entites specifiques) definissent leur vision dans les JSON.
- Plus de regles hardcodees implicites dans `GameBoard`.

### Axe E - Suppression progressive du legacy square

- Introduire un drapeau temporaire de migration interne (pas expose gameplay).
- Remplacer module par module:
  - LOS
  - visibility
  - fog
  - light LOS
- Supprimer ensuite:
  - fonctions square non utilisees
  - branches `if square` devenues mortes
  - commentaires legacy

Definition de fini:
- Runtime gameboard ne contient plus de chemin square.
- Les tests hex couvrent tous les cas critiques.

## 5) Ordre d'execution recommande

1. P0: corriger fog joueur en hex (rendu visible immediat).
2. P0: unifier `range` + conversions centralisees.
3. P1: migrer LOS/visibility en hex natif.
4. P1: separer runtime vision vs rendu fog.
5. P2: migrer JSON vision et nettoyer le legacy square.

## 6) Checklist QA fonctionnelle cible

- Fog visible en hex sur toutes les maps test.
- Fog ne suit que la vision joueur.
- Ennemis detectent/ciblent sans dessiner de fog.
- Cas "voit dans le noir" valide.
- Cas "voit a travers obstacles" valide.
- Cas "inversion sombre/lumiere" valide.
- Coherence stricte entre selection de cible et cellules visibles.
