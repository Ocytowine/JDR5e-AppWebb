# Obstacle types (JSON)

Ce dossier contient les definitions JSON des obstacles. Chaque fichier decrit un type d'obstacle, ses variantes, son apparence et ses regles de spawn.

## Structure generale

- `id`: identifiant unique (utilise par le moteur).
- `label`: nom lisible.
- `category`: categorie logique (ex: `prop`, `vegetation`, `wall`).
- `tags`: liste de tags (ex: `tree`, `wood`, `pillar`).
- `blocking`: blocage du mouvement/vision/attaques.
- `durability`: stats de destruction.
- `variants`: variantes de footprint/rotation.
- `appearance`: rendu visuel (sprites, palettes).
- `spawnRules`: generation procedurale.
- `light`: emission lumineuse.
- `connects`: plage de connexion pour elements raccordables.
- `interactions`: actions disponibles (portes, bris, etc).

## Variants

- `variants[].footprint`: liste de cellules relatives (ex: `[{"x":0,"y":0}]`).
- `variants[].rotatable`: si l'orientation est prise en compte.

## Appearance

### Champs principaux

- `spriteKey`: sprite par defaut (si pas de `layers`).
- `spriteGrid`: taille en cases de la sprite (`tilesX`, `tilesY`, option `tileSize`).
- `preserveAspect`: conserve les proportions de l'image quand `spriteGrid` est actif.
- `paletteId`: palette par defaut pour cet obstacle (ex: `default`).
- `palettes`: dictionnaire de palettes (par id).
- `randomRotation`: rotation aleatoire a la generation (true/false).
- `shadowMode`: `default` (defaut) ou `tall` pour ancrer l'ombre au bas du sprite et l'etirer le long de son axe.
- `shadowSpriteLeafy` / `shadowSpriteLeafless`: sprites d'ombre alternatifs (ex: arbre avec/sans feuilles).
- `heightClass`: `low`, `medium`, `tall` (visuel/LOS).
- `shadowStretch`: multiplicateur d'etirement des ombres (1 = par defaut).
- `layers`: liste de calques (sprite + options).
- `tokenScale`: variation de taille (en %) appliquee a la pose.
- `scale`: multiplicateur global applique au rendu.
- `animationSpeed` / `animationLoop`: valeurs par defaut pour les calques animes.
- `shadowStretch`: longueur d'ombre de base (en cases).

### Layers

- `id`: identifiant logique du calque (ex: `trunk`, `canopy`).
- `spriteKey`: cle de sprite (fichier PNG).
- `tint`: couleur fixe (ex: 16777215 = blanc).
- `alpha`: transparence.
- `scale`: multiplicateur local.
- `z`: ordre de rendu.
- `visible`: `always` ou `hideWhenTokenBelow`.
- `renderLayer`: `overhead` pour dessiner au-dessus des tokens (sinon base).
- `spriteGrid`: taille en cases specifique au calque.
- `preserveAspect`: conserve les proportions (override local).
- `animationSpeed` / `animationLoop`: override local pour sprites animes.

### Palettes

Les palettes permettent de recolorer les calques a la generation de la map (ex: foret d'automne).

Structure:

- `appearance.palettes[paletteId].layers[layerId]`
  - `tint`: couleur fixe (remplace la couleur du calque).
  - `tintRange`: variation entre `dark` et `light`.
  - `alpha`: override de transparence.
  - `visible`: `false` pour masquer le calque.

La cle `layerId` correspond a `layers[].id`. Si `id` est absent, utilisez `layers[].spriteKey` comme cle.

Exemple:

```
"appearance": {
  "paletteId": "default",
  "palettes": {
    "default": {
      "layers": {
        "canopy": { "tintRange": { "dark": 3107631, "light": 7323487 } },
        "trunk": { "tintRange": { "dark": 5978654, "light": 9132587 } }
      }
    },
    "autumn": {
      "layers": {
        "canopy": { "tintRange": { "dark": 10709547, "light": 15778138 } }
      }
    },
    "leafless": {
      "layers": {
        "canopy": { "visible": false }
      }
    }
  }
}
```

## Spawn rules

- `weight`: poids de selection.
- `cluster`: taille de grappe (`min`/`max`).
- `shapeHint`: `line`, `scatter`, `room`.
- `avoidNearTokens`: evite les zones proches du joueur/ennemis.

## Notes

- Les palettes sont appliquees au rendu, sans modifier les PNG sur disque.
- Le prompt peut choisir une palette globale (ex: "automne" -> `autumn`).
- `randomRotation` applique une rotation aleatoire (pas de 45°) si la variante est `rotatable`.
- Si `layers` est absent mais `spriteKey` present, un calque implicite est cree.
- `tokenScale` est en %, applique lors du placement (min/max aleatoire, fallback `default`). Omettre = 100%.
- Valeurs par defaut: `heightClass=medium`, `shadowStretch=1`, `tint=0xffffff`, `visible=always`.
