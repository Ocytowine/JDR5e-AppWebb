# Plan d'integration - Equipements passifs, bonus hybrides, multi-damage

Objectif: integrer proprement les bonus passifs d'equipement et les degats additionnels d'arme, en restant strictement alignes sur la taxonomie.

## Decision cle (validee)

Le systeme de bonus passe en mode **hybride**:
1. `grant.kind = "bonus"` peut cibler un bonus par `ids` (catalogue dedie).
2. `grant.kind = "bonus"` peut aussi embarquer des bonus `inline` directement dans l'item.

Ce mode evite la prolif de fichiers pour les bonus uniques, tout en gardant la reutilisabilite pour les bonus partages.

## Scope

1. Bonus d'equipement actifs tant que l'item est equipe.
2. Conditions d'activation de bonus via `requirements`.
3. Degats additionnels d'arme (`extraDamage`) deja modeles, a finaliser dans le pipeline d'attaque.

Hors scope:
1. Refonte UI complete de l'inventaire/equipement.
2. Refonte globale des stats derivees hors combat.

## Etat actuel

1. `grants` est present dans les modeles d'items.
2. `bonus` est present dans la taxonomie et `bonus-model.json`.
3. Pas de resolver runtime pour appliquer `grant.kind = "bonus"` sur `CombatStats`.
4. `requirements` des bonus ne sont pas evalues dans le pipeline d'equipement.
5. `extraDamage` existe en data, mais doit etre harmonise avec l'override d'attaque.

## Cible architecture

1. Un resolver unique dans `src/game`:
   - collecte des items equipes,
   - resolution des grants,
   - evaluation des requirements,
   - application des bonus aux stats.
2. Aucune logique ad-hoc de bonus dans l'UI.
3. Bonus appliques dans la construction de `playerCombatStats` (GameBoard), avant l'usage en combat.

## Taxonomie cible

## 1) grant hybride

Extension de `taxonomy.grant`:

```json
{
  "grant": {
    "kind": ["action", "reaction", "passif", "feature", "spell", "resource", "bonus"],
    "ids": "string[]",
    "inline": "bonus[]",
    "source": "string?",
    "meta": {
      "maxByLevel": "object",
      "recharge": "short_rest | long_rest | none"
    }
  }
}
```

Regle:
1. Pour `kind = "bonus"`, au moins un de `ids` ou `inline` est requis.

## 2) bonus requirements

`bonus.requirements` est interprete comme `ConditionExpr[]` (meme langage que l'ActionEngine).

## 3) weapon extraDamage

Conserver:
1. `weapon.extraDamage[]` avec `when: onHit|onCrit|onResolve|onMiss`.

## Design runtime

## A) Resolver d'equipement

Nouveau helper propose:
1. `src/game/equipmentBonusResolver.ts`

API proposee:
1. `collectEquippedItems(character): EquippedItemRef[]`
2. `buildEquipmentContextTags(items): string[]`
3. `resolveEquipmentBonusEntries(params): ResolvedBonusEntry[]`
4. `applyBonusesToCombatStats(base, entries): { stats, trace }`

## B) Tags runtime d'equipement (pour requirements)

Tags minimum proposes:
1. `equip:item:<itemId>`
2. `equip:type:weapon|armor|object`
3. `equip:slot:<slotId>`
4. `equip:armorCategory:<light|medium|heavy|shield>` (si armure)
5. `equip:weaponCategory:<melee|distance|polyvalent>` (si arme)

Ces tags permettent d'utiliser `ACTOR_HAS_TAG` sans nouveau DSL.

## C) Regles d'application bonus

Modes:
1. `add`: somme.
2. `set`: derniere valeur la plus prioritaire (ordre stable documente).
3. `max`: garde la plus grande valeur.

Ordre d'application (deterministe):
1. Catalogue (`ids`) dans l'ordre des ids.
2. Inline dans l'ordre du tableau.
3. Items dans l'ordre de l'inventaire equipe.

## D) Integration GameBoard

Point d'injection:
1. apres `buildCombatStatsFromCharacter`, avant `playerCombatStats` final.

Effets attendus:
1. `mods`, `armorClass`, `moveRange`, `attackBonus`, `actionsPerTurn`, `bonusActionsPerTurn`, `maxHp`, `maxAttacksPerTurn`.
2. tags de debug optionnels dans `combatStats.tags` (ex: `bonus:<id>`).

## E) extraDamage arme

Dans l'override d'arme:
1. convertir `extraDamage[]` en `ops` additionnelles sur la branche `when`.
2. merger sans ecraser les ops existantes de l'action.

## Plan d'avancement

1. **Taxonomy/model**
   - etendre `grant` avec `inline`.
   - aligner notices bonus/weapon/item avec la regle hybride.
2. **Data layer**
   - creer dossier `src/data/bonuses/` (`index.json` + premiers bonus reutilisables).
   - creer `bonusCatalog`.
3. **Resolver runtime**
   - implementer `equipmentBonusResolver.ts`.
   - brancher dans la construction des stats joueur.
4. **Conditions**
   - evaluer `bonus.requirements` via `evaluateAllConditions`.
   - injecter les tags d'equipement dans le contexte d'evaluation.
5. **Weapon multi-damage**
   - finaliser injection `extraDamage` dans les ops runtime.
6. **QA**
   - scenarios: bonus inline, bonus catalogue, bonus conditionnel au slot, desequip.
7. **Docs**
   - mise a jour notices et engine progress.

## Risques

1. Double-application des bonus si branchement a deux endroits.
2. Incoherence `set/max` sans ordre deterministe.
3. Conditions mal evaluees sans tags d'equipement stables.

## Criteres d'acceptation

1. Un item equipe applique son bonus; desequipe, il disparait.
2. Un bonus conditionnel (ex: besoin bouclier) s'active/desactive correctement.
3. Bonus inline et bonus catalogue produisent le meme resultat runtime.
4. `extraDamage` est applique sur les bonnes branches (`onHit/onCrit/...`).
