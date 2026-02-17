# Attack Context Helper - Spec courte

Objectif:
- normaliser le contexte d une attaque (armee / non armee / improvisee) au point unique du pipeline, sans dupliquer des actions.

Point d integration:
- runtime `GameBoard`, dans la meme zone que:
1. `pickWeaponForAction`
2. `applyWeaponOverrideForActor`
3. `buildWeaponOverrideAction`
4. helper implemente dans `src/game/engine/rules/weaponRules.ts`

## Contrat helper

Nom:
- `resolveAttackContextForActor`

Entree minimale:
```ts
{
  action: ActionDefinition;
  weapon?: WeaponTypeDefinition | null;
}
```

Sortie:
```ts
{
  attackKind: "weapon" | "unarmed";
  weaponKind: "simple" | "martial" | "improvised" | "none";
  isImprovised: boolean;
  isUnarmed: boolean;
  tags: string[];
}
```

Regles:
1. Si `action.category !== "attack"`: pas de changement de comportement metier.
2. Si une arme est resolue:
- `attackKind = "weapon"`
- `weaponKind` derive du type d arme (`simple/martial`) ou `improvised` si taggee comme telle.
3. Si aucune arme n est resolue:
- `attackKind = "unarmed"`
- `weaponKind = "none"`

Tags poses par le helper:
1. Toujours un tag d attaque:
- `attack:weapon` ou `attack:unarmed`
2. Toujours un tag de famille arme:
- `weapon:kind:simple|martial|improvised|none`
3. Si improvisee:
- `weapon:improvised`

## Application des tags

Nom:
- `applyAttackContextTags`

But:
- injecter les tags de contexte sans casser les tags existants,
- eviter les doublons et les valeurs contradictoires (ex: `attack:weapon` + `attack:unarmed`).

Regle:
1. nettoyer uniquement les tags geres par ce helper,
2. conserver tous les autres tags,
3. re-ajouter les tags derives du contexte.

## Safeguards

1. Pas de branchement par feat.
2. Pas de court-circuit de `getEquipmentConstraintIssuesForActor`.
3. Pas de court-circuit de `resolveWeaponHandlingCost`.
