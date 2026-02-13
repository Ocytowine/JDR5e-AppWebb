# Equipment Passives / Bonus Hybride - Progress Schema

## Statuts

1. `todo`
2. `in_progress`
3. `blocked`
4. `done`

## Phases

```json
{
  "feature": "equipment-passives-bonuses",
  "version": 1,
  "phases": [
    {
      "id": "taxonomy",
      "status": "done",
      "deliverables": [
        "grant.inline ajoute dans taxonomy",
        "notices bonus/item/weapon alignees"
      ]
    },
    {
      "id": "catalog",
      "status": "done",
      "deliverables": [
        "data/bonuses/index.json",
        "bonusCatalog runtime"
      ]
    },
    {
      "id": "resolver",
      "status": "done",
      "deliverables": [
        "equipmentBonusResolver.ts",
        "application des bonus a CombatStats"
      ]
    },
    {
      "id": "conditions",
      "status": "done",
      "deliverables": [
        "requirements bonus evalues via ConditionExpr",
        "tags equip:* injectes"
      ]
    },
    {
      "id": "multidamage",
      "status": "done",
      "deliverables": [
        "extraDamage merge dans les ops runtime",
        "validation onHit/onCrit/onResolve/onMiss"
      ]
    },
    {
      "id": "qa_docs",
      "status": "done",
      "deliverables": [
        "scenarios equip/deequip",
        "engine-progress mis a jour"
      ]
    }
  ]
}
```

## Checklist

### Phase taxonomy
- [x] Etendre `taxonomy.grant` avec `inline`
- [x] Documenter la regle `ids|inline` pour `kind=bonus`

### Phase catalog
- [x] Creer `src/data/bonuses/`
- [x] Ajouter loader/catalog

### Phase resolver
- [x] Collecter equips actifs
- [x] Resoudre grants bonus (ids + inline)
- [x] Appliquer modes `add/set/max`

### Phase conditions
- [x] Evaluer `requirements` bonus
- [x] Ajouter tags runtime `equip:*`

### Phase multidamage
- [x] Brancher `weapon.extraDamage` dans les ops runtime
- [x] Assurer merge additive avec ops existantes

### Phase qa_docs
- [x] Tester bonus conditionnel (bouclier, slot, type item)
- [x] Documenter decisions finales

## Matrice QA (reference)

1. Equip item avec `grant.bonus.inline` (`mode=add`) :
- Attendu: stat augmentee.
- Desequip: retour a la valeur initiale.

2. Equip item avec `grant.bonus.ids` (`mode=max`) :
- Attendu: la stat prend la plus haute valeur applicable.
- Stacking avec add: ordre stable et resultat deterministic.

3. Bonus conditionnel `requirements` avec `equip:armorCategory:shield` :
- Sans bouclier: bonus inactif.
- Avec bouclier: bonus actif.
- Retrait bouclier: bonus retire.

4. `weapon.extraDamage` :
- `onHit`: applique sur touche.
- `onCrit`: applique sur critique.
- `onResolve`: applique a la resolution.
- `onMiss`: applique sur echec.

5. Rebuild combat stats :
- Changement d'equipement => recomputation sans persistance parasite.

## Decisions finales

1. Bonus d'equipement en mode hybride (`ids` + `inline`).
2. `requirements` bonus evalues via `ConditionExpr[]`.
3. Tags runtime `equip:*` utilises comme socle des conditions de bonus.
4. `extraDamage` merge additif dans les branches d'ops runtime.

## Rappel important (prochaine etape)

1. Integrer la regle `harmonisable` (attunement):
- limite de slots harmonisables,
- validation d'activation/desactivation,
- impact sur l'application des grants/bonus.
