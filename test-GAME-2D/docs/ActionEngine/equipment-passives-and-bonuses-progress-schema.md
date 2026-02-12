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
      "status": "todo",
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
- [ ] Tester bonus conditionnel (bouclier, slot, type item)
- [ ] Documenter decisions finales
