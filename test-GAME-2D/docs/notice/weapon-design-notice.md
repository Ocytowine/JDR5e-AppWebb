# Notice de conception - Armes (items)

Ce document sert de reference pour creer des armes au format data item, avec variantes de proprietes typiques (melee, distance, jet, munitions, polyvalente, etc.).

## Objectif

- Standardiser la structure des armes.
- Formaliser les variantes de proprietes selon le type d'arme.
- Garantir la compatibilite avec ActionEngine (liens vers action/effect).

## Structure recommandee (arme)

```json
{
  "id": "dague",
  "name": "Dague",
  "label": "Dague",
  "type": "arme",
  "subtype": "simple",
  "category": "melee",
  "descriptionCourte": "Lame courte et legere, facile a dissimuler.",
  "descriptionLongue": "",
  "allowStack": false,
  "harmonisable": false,
  "focalisateur": false,
  "weight": 0.5,
  "size": 0.4,
  "value": { "gold": 2, "silver": 0, "copper": 0, "platinum": 0 },
  "rarity": "commune",
  "tags": ["arme", "melee", "piercing", "material:metal"],
  "properties": {
    "finesse": true,
    "light": true,
    "heavy": false,
    "twoHanded": false,
    "reach": 1.5,
    "versatile": null,
    "thrown": { "normal": 6, "long": 18 },
    "ammunition": false,
    "loading": false,
    "reload": null,
    "range": { "normal": 1.5, "long": 1.5 },
    "special": null,
    "ammoType": null,
    "ammoPerShot": null
  },
  "weaponMastery": ["coup_double"],
  "attack": { "mod": "mod.DEX", "bonus": "bonus_maitrise" },
  "damage": { "dice": "1d4", "damageType": "PIERCING", "alt": null },
  "effectOnHit": { "mod": "mod.DEX", "damage": "1d4", "damageType": "PIERCING" },
  "links": { "actionId": null, "effectId": "melee-slash" }
}
```

## Champs par champ (base)

- `id`: identifiant unique (slug).
- `name` / `label`: nom affiche.
- `type`: `arme`.
- `subtype`: maitrise requise (`simple` | `martiale` | `speciale` | `monastique`).
- `category`: `melee` | `distance` | `polyvalent`.
- `descriptionCourte` / `descriptionLongue`.
- `weight`, `size`, `value`, `rarity`.
- `tags`: tags gameplay + `material:<id>`.
- `properties`: proprietes DnD (voir variantes).
- `weaponMastery`: liste de bottes d'arme actives pour cette arme (voir liste).
- `attack`: modificateur et bonus de maitrise.
- `damage`: des et type.
- `effectOnHit`: format court d'impact (compat UI).
- `links.actionId`: action propre a l'arme (optionnelle). Peut rester `null`.
- `links.effectId`: effet visuel (optionnel).

## Variantes de proprietes (patterns)

### 1) Melee standard

```json
{
  "properties": {
    "finesse": false,
    "light": false,
    "heavy": false,
    "twoHanded": false,
    "reach": 1.5,
    "versatile": null,
    "thrown": null,
    "ammunition": false,
    "loading": false,
    "reload": null,
    "range": { "normal": 1.5, "long": 1.5 },
    "special": null,
    "ammoType": null,
    "ammoPerShot": null
  }
}
```

### 2) Arme a distance (munition)

```json
{
  "properties": {
    "ammunition": true,
    "loading": false,
    "reload": null,
    "range": { "normal": 24, "long": 72 },
    "ammoType": "arrow",
    "ammoPerShot": 1
  }
}
```

### 3) Arme de jet (thrown)

```json
{
  "properties": {
    "thrown": { "normal": 6, "long": 18 },
    "range": { "normal": 1.5, "long": 1.5 }
  }
}
```

### 4) Polyvalente (versatile)

```json
{
  "properties": { "versatile": "1d10", "twoHanded": false },
  "damage": { "dice": "1d8", "damageType": "SLASHING", "alt": "1d10" }
}
```

### 5) Lourde / a deux mains / allonge

```json
{
  "properties": { "heavy": true, "twoHanded": true, "reach": 3 }
}
```

## Regles pratiques

- `ammoType` + `ammoPerShot` pilotent la consommation auto (munitions).
- `range` = portee melee ou tir (m) selon categorie.
- Les tags de degats doivent rester en enum EN (ex: `SLASHING`, `PIERCING`).
- `material:<id>` est obligatoire si le materiau est pertinent.

## Bottes d'arme (weaponMastery)

`weaponMastery` est une liste de **bottes** associees a l'arme. Une botte est utilisable **uniquement** par un personnage ayant une capacite qui debloque cette propriete (ex: *Bottes d'arme*).

### Integration recommandee (mastery)

- Stocker les bottes sur l'arme: `weaponMastery: ["coup_double", "sape"]`.
- Au runtime, l'engine **expose** ces bottes comme tags d'acteur **temporaires** pendant l'action.
  - Exemple: `wm-active:coup_double`, `wm-active:sape`.
- Le personnage possede les tags permanents de maitrise (ex: `wm:coup_double`).
- Les bottes sont appliquees via **hooks** (ActionEngine) et `ops`, pas via `links.actionId`.
- Tags runtime utilises par l'engine:
  - `wm-ouverture:adv:<sourceId>` (devient `:expiring` au debut du tour suivant de la source, purge a la fin de ce tour).
  - `wm-sape:next:<sourceId>` + `wm-ralentissement:<sourceId>` (purges au debut du tour suivant de la source).

### Option B (data-driven) — JSON par mastery + hook generique (choix retenu)

Vous stockez **un JSON par mastery** dans `test-GAME-2D/src/data/actions/weapon-mastery/`, puis un hook generique **charge** les ops de la mastery au runtime.

Exemple de JSON mastery (ActionSpec minimal) :

```json
{
  "id": "wm-poussee",
  "name": "Poussee",
  "category": "item",
  "tags": ["weaponMastery", "poussee", "wm-trigger:on_hit"],
  "resolution": { "kind": "NO_ROLL" },
  "ops": {
    "onResolve": [
      {
        "op": "EmitEvent",
        "kind": "weaponMastery:poussee",
        "data": { "masteryId": "poussee", "distance": 3, "maxSize": "LARGE" }
      }
    ]
  }
}
```

Runtime (engine):
- Les tags `wm-trigger:on_*` sont convertis en tags runtime `wm-trigger:<id>:on_*`.
- L'engine applique la logique de la botte si:
  - l'action porte `wm-active:<id>`,
  - l'acteur a `wm:<id>`,
  - et le trigger `wm-trigger:<id>:on_hit/on_miss/on_intent` correspond.

### Liste standard (id -> regle)

- `coup_double`  
  Lorsque vous effectuez l’attaque supplémentaire de la propriété Légère de l’arme, vous pouvez l’effectuer dans le cadre de l’action Attaque au lieu de devoir y consacrer votre action Bonus. Vous ne pouvez effectuer cette attaque supplémentaire qu’une seule fois par tour.

- `ecorchure`  
  Si votre jet d’attaque avec cette arme rate une créature, vous pouvez lui infliger des dégâts égaux au modificateur de la caractéristique utilisée pour effectuer le jet d’attaque. Ces dégâts sont du même type que ceux infligés par l’arme, et ne peuvent être augmentés qu’en augmentant le modificateur de caractéristique.

- `enchainement`  
  Si vous touchez une créature avec un jet d’attaque de corps à corps avec cette arme, vous pouvez effectuer un jet d’attaque de corps à corps avec cette arme contre une deuxième créature située dans un rayon de 1,50 m de la première, et qui est elle aussi à votre portée. Si l’attaque touche, la deuxième créature subit les dégâts de l’arme, mais sans ajouter votre modificateur de caractéristique à ces dégâts, sauf si ce modificateur est négatif. Vous ne pouvez effectuer cette attaque supplémentaire qu’une seule fois par tour.

- `ouverture`  
  Si vous touchez une créature avec cette arme et lui infligez des dégâts, vous avez un Avantage à votre prochain jet d’attaque contre cette créature avant la fin de votre tour suivant.

- `poussee`  
  Si vous touchez une créature avec cette arme, vous pouvez la repousser d’un maximum de 3 m en ligne droite pour peu qu’elle soit de taille G ou inférieure.

- `ralentissement`  
  Si vous touchez une créature avec cette arme et lui infligez des dégâts, vous pouvez réduire sa Vitesse de 3 m jusqu’au début de votre tour suivant. Si la créature est touchée plus d’une fois par des armes dotées de cette propriété, la réduction de sa Vitesse n’excède pas 3 m.

- `renversement`  
  Si vous touchez une créature avec cette arme, vous pouvez la contraindre à effectuer un jet de sauvegarde de Constitution (DD égal à 8 + le modificateur de caractéristique utilisé pour le jet d’attaque + votre bonus de maîtrise). En cas d’échec, la créature subit l’état À terre.

- `sape`  
  Si vous touchez une créature avec cette arme, cette créature subit un Désavantage à son prochain jet d’attaque avant le début de votre tour suivant.
