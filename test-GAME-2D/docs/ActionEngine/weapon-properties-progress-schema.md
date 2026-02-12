# Weapon Properties - Progress Schema

Ce schema sert de feuille de route executable pour integrer les proprietes d'armes dans l'engine.

## Statuts

Valeurs autorisees:
1. `todo`
2. `in_progress`
3. `blocked`
4. `done`

## Sequence imposee

1. `foundation`
2. `core_rules`
3. `constraints`
4. `advanced_rules`
5. `qa`
6. `docs`

## Schema de suivi

```json
{
  "feature": "weapon-properties",
  "version": 1,
  "phases": [
    {
      "id": "foundation",
      "status": "done",
      "deliverables": [
        "weaponRules.ts cree",
        "API helper stabilisee",
        "tests unitaires de base"
      ],
      "exitCriteria": [
        "aucune regression compile",
        "mapping de proprietes centralise"
      ]
    },
    {
      "id": "core_rules",
      "status": "done",
      "deliverables": [
        "finesse",
        "thrown",
        "range normal/long",
        "heavy disadvantage"
      ],
      "exitCriteria": [
        "jets corrects en melee/distance",
        "desavantage longue portee applique"
      ]
    },
    {
      "id": "constraints",
      "status": "done",
      "deliverables": [
        "loading",
        "twoHanded validation",
        "ammunition coherence"
      ],
      "exitCriteria": [
        "attaques invalides bloquees",
        "usage par type d'action respecte"
      ]
    },
    {
      "id": "advanced_rules",
      "status": "done",
      "deliverables": [
        "versatile",
        "reach/opportunity alignment"
      ],
      "exitCriteria": [
        "degats 1 main/2 mains corrects",
        "portee opportunite coherente"
      ]
    },
    {
      "id": "qa",
      "status": "todo",
      "deliverables": [
        "tests manuels scenario",
        "tests automatises cibles"
      ],
      "exitCriteria": [
        "scenario matrix validee",
        "aucune regression majeure"
      ]
    },
    {
      "id": "docs",
      "status": "todo",
      "deliverables": [
        "notice weapon mise a jour",
        "engine-progress mis a jour",
        "exemples JSON aligns"
      ],
      "exitCriteria": [
        "docs/taxo/coeur alignes"
      ]
    }
  ]
}
```

## Checklist operationnelle

### Phase 1 - Foundation
- [x] Creer `weaponRules.ts`
- [x] Deplacer les calculs de `applyWeaponOverrideForActor`
- [ ] Ajouter tests unitaires helper

### Phase 2 - Core Rules
- [x] Implementer `finesse`
- [x] Implementer `thrown` + portee derivee
- [x] Implementer desavantage longue portee
- [x] Implementer desavantage `heavy` selon stat

### Phase 3 - Constraints
- [x] Implementer `loading` (1 tir par actionType)
- [x] Implementer validation `twoHanded`
- [x] Verifier coherence avec `ammunition`

### Phase 4 - Advanced Rules
- [x] Implementer `versatile`
- [x] Verifier allonge/opportunity

### Phase 5 - QA
- [ ] Matrice de scenarios complete
- [ ] Verification IA (choix melee/distance)
- [ ] Verification weapon mastery

### Phase 6 - Docs
- [ ] Mettre a jour `weapon-design-notice.md`
- [ ] Mettre a jour docs ActionEngine
- [ ] Noter conventions finales (reach, loading, etc.)

## Definition of Done (globale)

1. Les proprietes d'armes du scope sont traitees en combat.
2. Les decisions fonctionnelles sont documentees.
3. Les exemples JSON sont alignes avec le comportement reel.
4. Les regressions critiques (attaques/munitions/portee) sont absentes.
