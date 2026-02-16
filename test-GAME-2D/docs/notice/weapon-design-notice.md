# Notice de conception - Armes (ActionEngine)

Ce document definit un format d'arme **directement compatible** avec le moteur actuel.

## Objectif

1. Garantir qu'une IA peut generer des armes jouables sans logique manuelle supplementaire.
2. Aligner strictement data, taxonomie et comportement runtime.
3. Couvrir les bonus d'equipement, proprietes d'armes et degats additionnels.

## Modele recommande

```json
{
  "id": "dague",
  "name": "Dague",
  "label": "Dague",
  "type": "arme",
  "subtype": "simple",
  "category": "melee",
  "descriptionCourte": "Lame courte et legere.",
  "descriptionLongue": "",
  "allowStack": false,
  "harmonisable": false,
  "focalisateur": false,
  "weight": 0.5,
  "size": 0.4,
  "value": { "gold": 2, "silver": 0, "copper": 0, "platinum": 0 },
  "rarity": "commune",
  "tags": ["arme", "melee", "piercing", "metal"],
  "grants": [
    {
      "kind": "bonus",
      "inline": [
        {
          "id": "bonus-local-dague-precision",
          "label": "+1 attaque",
          "summary": "Bonus tant que l'arme est equipee.",
          "stat": "attackBonus",
          "value": 1,
          "mode": "add",
          "tags": ["equip", "weapon"],
          "requirements": [],
          "source": { "book": "PHB2024", "page": 0 }
        }
      ]
    }
  ],
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
  "damage": { "dice": "1d4", "damageType": "piercing" },
  "extraDamage": [
    { "dice": "1d4", "damageType": "fire", "when": "onHit" }
  ],
  "effectOnHit": { "mod": "mod.DEX", "damage": "1d4", "damageType": "piercing" }
}
```

## Champs importants

1. `type` doit etre `arme`.
2. `subtype` doit etre `simple|martiale|speciale|monastique` (proficiences).
3. `category` doit etre `melee|distance|polyvalent`.
4. `damage.damageType` et `extraDamage[*].damageType` en **minuscules** (ex: `slashing`, `piercing`, `fire`).
5. `grants` supporte le mode hybride bonus:
   - `ids` (catalogue bonus),
   - `inline` (bonus local a l'arme).

## Proprietes d'armes: support reel moteur

Proprietes supportees:
1. `finesse`: choix auto du meilleur mod FOR/DEX.
2. `thrown`: mode distance avec portee `thrown.normal/long`.
3. `range.normal/long`: desavantage au-dela de `normal`; hors `long` = invalide.
4. `heavy`: desavantage si stat < 13 (FOR en melee, DEX en distance).
5. `loading`: limite 1 tir par type d'action (`action|bonus|reaction`) par tour.
6. `twoHanded`: bloque avec bouclier equipe.
7. `versatile`: degats 2 mains auto en melee si pas de bouclier.
8. `reach`: prise en compte sur portee melee et opportunite.
9. `light`: tag runtime disponible pour mastery.
10. `ammunition|ammoType|ammoPerShot`: consommation/verifications de munitions.
11. `harmonisable`:
   - `false`: bonus actifs immediatement a l'equipement.
   - `true`: bonus actifs seulement si l'item est harmonise.

Proprietes non finalisees:
1. `reload`: non appliquee.
2. `special`: non interpretee automatiquement.

Note schema:
1. `damage.alt` est obsolete pour les armes.
2. La source de verite des degats polyvalents est `properties.versatile`.

## Harmonisation (etat mecanique cible)

Pour un item `harmonisable: true`, les bonus doivent etre actifs uniquement si:
1. l'instance equipee est consideree harmonisee par le runtime.

Marqueurs reconnus (ordre logique):
1. `inventoryItem.harmonized === true`
2. `inventoryItem.isHarmonized === true`
3. `inventoryItem.attuned === true`
4. `inventoryItem.attunement.state === "harmonized"`
5. `inventoryItem.attunement.harmonizedAt` non vide
6. `character.attunements[instanceId] === true`
7. `character.attunements["instance:"+instanceId] === true`
8. `character.attunements[itemId] === true`
9. `character.attunements["item:"+itemId] === true`

Convention:
1. `instanceId` est l'identifiant de l'instance d'inventaire equipee.
2. Le CharacterCreator peut ecrire plusieurs marqueurs pour faciliter le debug et la compatibilite runtime.

## Degats additionnels (`extraDamage`)

Le moteur injecte `extraDamage` dans les ops runtime (`DealDamage`) en merge additif.

Mapping `when`:
1. `onHit`
2. `onCrit`
3. `onResolve`
4. `onMiss`

Si `when` absent: fallback `onHit`.

Critiques:
1. En critique `double-dice`, les des de `extraDamage` sont aussi doubles.
2. Les bonus plats (ex: `+2`, modificateur de caracteristique) ne sont pas doubles.

Note pipeline:
1. Les formules de degats runtime doivent rester au format simple (`1d10+3+2`).
2. Eviter d'encapsuler avec des parentheses dans la concatenation de formule, car le parseur de des est volontairement minimal.

## Grants bonus (hybride)

Exemple catalogue:

```json
{
  "grants": [
    { "kind": "bonus", "ids": ["bonus-attack-1"] }
  ]
}
```

Exemple inline conditionnel:

```json
{
  "grants": [
    {
      "kind": "bonus",
      "inline": [
        {
          "id": "bonus-avec-bouclier",
          "label": "+1 CA",
          "summary": "Actif si bouclier equipe.",
          "stat": "armorClass",
          "value": 1,
          "mode": "add",
          "tags": ["equip", "armor"],
          "requirements": [
            { "type": "ACTOR_HAS_TAG", "tag": "equip:armorCategory:shield" }
          ],
          "source": { "book": "PHB2024", "page": 0 }
        }
      ]
    }
  ]
}
```

Note: `requirements` utilise `ConditionExpr[]` (meme langage que l'ActionEngine).

## Weapon Mastery

1. L'arme declare ses masteries dans `weaponMastery: ["id1", "id2"]`.
2. Le moteur ajoute `wm-active:<id>` au runtime.
3. La mastery s'applique si l'acteur possede aussi `wm:<id>`.
4. Les effets mastery sont data-driven via `src/data/actions/weapon-mastery/`.

## Checklist de validation (pour IA/data)

1. Le JSON contient `type: "arme"`, `subtype`, `category`, `properties`, `attack`, `damage`.
2. `damageType` est en minuscules.
3. Portee coherente:
   - melee: `range.normal=1.5` (ou `reach` > 1.5),
   - distance: `range.normal/long` valides,
   - thrown: `thrown.normal/long` renseigne.
4. Si `ammunition=true`, definir `ammoType` et `ammoPerShot`.
5. Si bonus d'equipement, utiliser `grants.kind="bonus"` (`ids` ou `inline`).
6. Si `extraDamage`, verifier `when` parmi `onHit|onCrit|onResolve|onMiss`.

## Reference

1. Bonus: `test-GAME-2D/docs/notice/bonus-design-notice.md`
2. Plan engine: `test-GAME-2D/docs/ActionEngine/equipment-passives-and-multidamage-plan.md`
