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
        "applyTo": "combatStat|attack|damage|damageReroll",
        "stat": "armorClass|attackBonus|maxHp",
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

## 4) Exemples du repo

- `src/data/features/shared/fighting-style-archery.json`
- `src/data/features/shared/fighting-style-defense.json`
- `src/data/features/shared/fighting-style-dueling.json`
- `src/data/features/shared/fighting-style-great-weapon-fighting.json`
- `src/data/features/shared/fighting-style-protection.json`
- `src/data/features/shared/fighting-style-interception.json`
- `src/data/features/shared/fighting-style-two-weapon-fighting.json`

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
