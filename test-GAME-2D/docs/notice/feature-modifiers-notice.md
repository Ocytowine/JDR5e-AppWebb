# Notice de conception - Feature Modifiers

Reference unique du schema runtime pour les effets declaratifs portes par `feature.rules`.

Objectif:
- eviter le code special classe/sous-classe,
- centraliser les schemas supportes,
- permettre l extension par JSON avant tout.

## 1) Bloc `rules.modifiers`

Usage: bonus directs sur stats/actions.

Schema:

```json
{
  "rules": {
    "modifiers": [
      {
        "applyTo": "combatStat|attack|damage|damageReroll|equipmentPolicy",
        "stat": "armorClass|attackBonus|maxHp|allowSomaticWithOccupiedHands|ignoreTwoHandedShieldRestriction|extraWeaponInteractionsPerTurn|allowWeaponSwapWithoutInteraction|drawWeaponFromPackAsInteraction",
        "value": 1,
        "when": {}
      }
    ]
  }
}
```

`applyTo` supporte:
- `combatStat`: ajoute `value` sur `stat`.
- `attack`: ajoute `value` au bonus d attaque de l action.
- `damage`: ajoute `value` a la formule de degats.
- `damageReroll`: relance 1 fois les des de degats <= `value`.
- `equipmentPolicy`: active une regle d equipement runtime partagee Creator + ActionEngine.

`equipmentPolicy.stat` supporte:
- `allowSomaticWithOccupiedHands`
- `ignoreTwoHandedShieldRestriction`
- `extraWeaponInteractionsPerTurn`
- `allowWeaponSwapWithoutInteraction`
- `drawWeaponFromPackAsInteraction`

Filtres `when` supportes:
- `actorType`
- `actionCategory`
- `actionCostType`
- `actionTagsAny` / `actionTagsAll`
- `weaponCategory` / `weaponCategories`
- `weaponTwoHanded`
- `weaponLight`
- `requiresArmor`
- `requiresShield`
- `requiresOffhandWeapon`
- `requiresNoOffhandWeapon`

## 2) Bloc `rules.reactionModifiers`

Usage: reactions passives data-driven, sans ajouter une reaction dediee dans `src/data/reactions`.

Schema:

```json
{
  "rules": {
    "reactionModifiers": [
      {
        "event": "incomingAttack|incomingAttackHit",
        "mode": "imposeDisadvantage|reduceDamage",
        "formula": "1d10 + proficiencyBonus",
        "uiMessage": "Message optionnel",
        "when": {}
      }
    ]
  }
}
```

`event` supporte:
- `incomingAttack`: juste avant la resolution de l attaque.
- `incomingAttackHit`: apres resolution d une attaque qui a inflige des degats.

`mode` supporte:
- `imposeDisadvantage`: applique desavantage au jet d attaque entrant (consomme la reaction).
- `reduceDamage`: reduit les degats entrants selon `formula` (consomme la reaction).

Filtres `when` supportes:
- `actionCategory`
- `targetMustBeAlly`
- `targetMustNotBeSelf`
- `requiresShield`
- `targetVisible`
- `maxDistanceToTarget`

## 3) Bloc `rules.secondaryAttackPolicy`

Usage: regler l attaque secondaire sans hardcode de classe.

Schema:

```json
{
  "rules": {
    "secondaryAttackPolicy": {
      "mode": "addAbilityModToDamage",
      "ability": "auto|FOR|DEX|CON|INT|SAG|CHA",
      "when": {}
    }
  }
}
```

`mode` supporte:
- `addAbilityModToDamage`: ajoute le modificateur de caracteristique a la formule de degats de l attaque secondaire.

Comportement actuel:
- cible les actions d attaque `actionCost.actionType = bonus` (ou tags `secondary-attack` / `offhand-attack`),
- respecte les filtres `when` (`weaponLight`, `requiresOffhandWeapon`, etc.),
- `ability: auto` reprend l attribut de degats de l arme resolue.

## 3bis) Economie d'action - patterns recommandes

Objectif:
- declarer proprement "action bonus eligible" vs "action supplementaire" sans branche metier.

### A) Convertir une action en bonus action

Schema:

```json
{
  "rules": {
    "modifiers": [
      {
        "applyTo": "actionCost",
        "stat": "actionCostOverride",
        "fromCostType": "action",
        "toCostType": "bonus",
        "usageKey": "feature:my-bonus-cast",
        "maxPerTurn": 1,
        "when": {
          "actorType": "player",
          "actionCategory": "attack",
          "actionCostType": "action"
        }
      }
    ]
  }
}
```

Notes:
1. `when` est requis en pratique pour eviter les activations globales.
2. `usageKey` + `maxPerTurn` sont recommandes pour toute conversion non permanente.

### B) Donner une action principale supplementaire

Schema:

```json
{
  "rules": {
    "runtimeEffects": [
      {
        "applyOn": "after_action_resolve",
        "when": { "actionIdsAny": ["action-surge"] },
        "effects": [{ "kind": "grantMainAction", "amount": 1 }]
      }
    ]
  }
}
```

Notes:
1. Ce pattern ajoute du budget `action` pour le tour en cours.
2. Ne pas l'utiliser pour simuler une conversion de cout (utiliser A pour cela).

### C) Bypass d'une bonus action (bonus -> free)

Schema:

```json
{
  "rules": {
    "modifiers": [
      {
        "applyTo": "actionCost",
        "stat": "dualWieldBonusAttackWithoutBonusAction",
        "usageKey": "feature:dual-wield:bypass",
        "maxPerTurn": 1,
        "when": {
          "actionCostType": "bonus",
          "actionTagsAny": ["secondary-attack", "offhand-attack", "dual-wield"]
        }
      }
    ]
  }
}
```

Notes:
1. Toujours borner par `usageKey`/`maxPerTurn`.
2. Les tags et prerequis d'arme doivent rester dans `when`.

## 4) Exemples du repo

- `src/data/characters/features/shared/fighting-style-archery.json`
- `src/data/characters/features/shared/fighting-style-defense.json`
- `src/data/characters/features/shared/fighting-style-dueling.json`
- `src/data/characters/features/shared/fighting-style-great-weapon-fighting.json`
- `src/data/characters/features/shared/fighting-style-protection.json`
- `src/data/characters/features/shared/fighting-style-interception.json`
- `src/data/characters/features/shared/fighting-style-two-weapon-fighting.json`

## 5) Regles d evolution

1. Ajouter d abord le besoin en JSON.
2. Si schema manquant, etendre ce schema de maniere generique.
3. Mettre a jour cette notice a chaque nouveau champ supporte.
4. Ne jamais introduire de branche `if (classId === ...)` pour un effet metier.

## 6) Notes pipeline degats

1. Les modificateurs `applyTo: "damage"` produisent une formule finale concatenee en texte.
2. Le parseur de des runtime etant minimal, preferer des formules lineaires (ex: `1d10+3+2`).
3. Eviter d'introduire des parentheses inutiles lors de la composition (`(1d10+3)+2`), cela peut casser le parsing des termes de des.
4. En critique `double-dice`, toutes les operations `DealDamage` d'une meme resolution (degat principal et degats additionnels) utilisent maintenant le meme contexte de critique.

## 7) Axe melee armed/unarmed (notice d integration)

Constat:
- la base runtime possede deja un pipeline unique de selection/override d arme.
- pour eviter les doublons de contenu, les feats doivent cibler un contexte d attaque normalise, pas des ids d action.

Convention recommandee pour les prochaines extensions:
1. Utiliser des tags de contexte poses au meme point central que l override arme:
- `attack:weapon`
- `attack:unarmed`
- `weapon:improvised`
2. Garder la logique de contraintes dans les modules existants:
- `equipmentHands.ts`
- `weaponPairingRules.ts`
3. Etendre les filtres `when` de facon generique plutot que par feat:
- `attackKind` (`weapon|unarmed`)
- `weaponKind` (`simple|martial|improvised|none`)
- `isImprovised` (booleen)

Note:
- ces 3 filtres `when` sont un objectif de schema (pas encore declares comme support runtime complet tant que le moteur ne les evalue pas partout).

## Liens utiles

1. Vue d'ensemble navigation: `docs/notice/notice-navigation.md`
2. Classes: `docs/notice/class-design-notice.md`
3. Sous-classes: `docs/notice/subclass-design-notice.md`
4. Pipeline creator/runtime: `docs/notice/player-character-creator-design-notice.md`
5. Actions pipeline: `docs/ActionEngine/action-pipeline-taxonomy.md`
