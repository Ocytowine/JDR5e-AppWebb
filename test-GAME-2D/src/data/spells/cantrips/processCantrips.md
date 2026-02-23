# Directive d’Intégration — Cantrips SRD 2024

Objectif : intégrer **tous les cantrips SRD 2024** dans l’engine via une approche **100% data-driven**, sans casser le pipeline `plan → validate → commit`.

Ce document décrit :

* La procédure générale
* Les types mécaniques de cantrips
* La recherche de fonctions engine
* Les extensions nécessaires
* Le modèle data unifié
* La compatibilité scaling / concentration / réactions

---

# Feuille de route opérationnelle (suivi intégration)

Objectif de suivi : garder un cap clair sur ce qui est fait, ce qui reste à faire, et les validations à passer.

## Statut global

* [x] Audit pipeline engine (`plan → validate → commit`)
* [x] Inventaire des hooks/ops réutilisables
* [x] Lot pilote cantrips data (3 sorts)
* [x] Intégration catalogue actions (index + génération)
* [x] Intégration catalogue sorts (`spellCatalog`)
* [x] Application résistances/immunités/vulnérabilités dans `DealDamage`
* [x] Validation build + revue logs pipeline

## Lot pilote en cours

* [x] Fire Bolt (attack roll + scaling)
* [x] Frostbite (save + dégâts + altération)
* [x] Acid Splash (save + multi-cibles)

## Prochaines étapes après pilote

1. Étendre aux autres cantrips SRD 2024 par familles mécaniques
2. Ajouter/ajuster les effets génériques manquants (si nécessaire)
3. Vérifier compat concentration/réactions/preview/rollback
4. Finaliser la couverture DATA de tous les cantrips listés

## Critères de sortie

* Tous les cantrips passent par le pipeline action engine
* Aucune logique hardcodée par sort
* Scaling niveau actif (5/11/17)
* Résistances/immunités appliquées au calcul dégâts
* Build OK

---

# 0 — Règles d’intégration

1. Ne jamais bypass le pipeline d’action
2. Toujours chercher fonctions existantes avant extension
3. Aucune logique hardcodée par sort
4. Tous les cantrips doivent être définis en DATA
5. Support preview / rollback obligatoire
6. Compatible concentration / réactions / résistances

---

# 1 — Liste des Cantrips SRD 2024 (catégories mécaniques)

## Dégâts directs

* Fire Bolt
* Ray of Frost
* Chill Touch
* Poison Spray
* Shocking Grasp
* Acid Splash
* Produce Flame

## Contrôle / altération

* Frostbite
* Thunderclap
* Sword Burst

## Utilitaires

* Mage Hand
* Minor Illusion
* Prestidigitation
* Light
* Mending

## Défensifs / buff

* Blade Ward
* Resistance
* Guidance

## Attaque arme magique

* True Strike (2024 version scaling)
* Booming Blade (si inclus SRD)
* Green-Flame Blade (si inclus SRD)

---

# 2 — Structure mécanique commune des Cantrips

Tous les cantrips doivent supporter :

* Scaling par niveau (5/11/17)
* Attack roll OU Saving Throw
* Dégâts typés
* Effets secondaires optionnels
* Ciblage
* Ligne de vue
* Résistances / immunités
* Critiques (si attaque)
* Concentration (rare)
* Durée (instant / temporaire)
* Tags mécaniques

---

# 3 — Procédure Codex (POUR CHAQUE CANTRIP)

## Étape 1 — Identifier le type mécanique

| Type            | Exemple     |
| --------------- | ----------- |
| Spell Attack    | Fire Bolt   |
| Save Damage     | Frostbite   |
| AOE             | Thunderclap |
| Utility         | Mage Hand   |
| Buff            | Guidance    |
| Weapon Modifier | True Strike |

---

## Étape 2 — Chercher fonctions existantes

Rechercher dans l’engine :

* `planCastSpell()`
* `validateSpellCast()`
* `commitSpellEffect()`
* `applyDamage()`
* `applyBuff()`
* `applyDebuff()`
* `savingThrow()`
* `spellAttackRoll()`
* `scaleDamageByLevel()`
* `checkConcentration()`
* `spawnEntity()` (Mage Hand)
* `applyCondition()`
* `modifyRoll()`

---

## Étape 3 — Si fonctions EXISTENT

Créer définition DATA du sort :

```json
{
  "id": "fire_bolt",
  "type": "cantrip",
  "action": "action",
  "range": 120,
  "attack_type": "spell_attack",
  "damage": {
    "type": "fire",
    "dice_by_level": {
      "1": "1d10",
      "5": "2d10",
      "11": "3d10",
      "17": "4d10"
    }
  }
}
```

---

## Étape 4 — Si fonction ABSENTE → Extension data-driven

Créer type générique :

```json
effects: {
  damage_on_hit: {},
  damage_on_save: {},
  apply_condition: {},
  spawn_object: {},
  modify_roll: {},
  weapon_attack_modifier: {}
}
```

Brancher dans pipeline :

* `plan` → intention lancer sort
* `validate` → portée / LOS / ressource
* `commit` → effet DATA

---

# 4 — Gestion du Scaling Cantrip

Créer table globale :

```json
cantrip_scaling: {
  1: 1,
  5: 2,
  11: 3,
  17: 4
}
```

Hook :

```json
damage = base_dice * cantrip_scaling[caster_level]
```

---

# 5 — Gestion Attack Roll

## Rechercher

* `spellAttackRoll()`
* `resolveHit()`

## Sinon

Créer :

```json
attack_resolution: {
  roll: "1d20 + spell_mod + prof",
  crit_on: 20,
  on_hit: "apply_effect"
}
```

---

# 6 — Gestion Saving Throw

## Rechercher

* `savingThrow()`

## Sinon

```json
save_resolution: {
  stat: "CON",
  dc: "spell_dc",
  on_fail: "full_effect",
  on_success: "half_or_none"
}
```

---

# 7 — Gestion AOE (Thunderclap, Sword Burst)

Rechercher :

* `getTargetsInRadius()`

Sinon :

```json
targeting: {
  type: "aoe_self_centered",
  radius: 5
}
```

---

# 8 — Gestion Conditions (Frostbite, Ray of Frost)

Rechercher :

* `applyCondition()`

Sinon :

```json
condition: {
  type: "disadvantage_next_attack",
  duration: 1
}
```

---

# 9 — Gestion Buff (Guidance, Resistance, Blade Ward)

Rechercher :

* `applyBuff()`
* `modifyRoll()`

Sinon :

```json
buff: {
  effect: "add_1d4",
  trigger: "ability_check"
}
```

---

# 10 — Gestion Utility (Mage Hand, Light, Mending)

## Mage Hand

Rechercher :

* `spawnEntity()`
* `controlledObject`

Sinon :

```json
spawn: {
  entity: "mage_hand",
  duration: 60,
  controllable: true
}
```

---

## Minor Illusion

Créer :

```json
illusion: {
  size_limit: "5ft",
  interaction_check: true
}
```

---

## Light

```json
aura: {
  radius_light: 20,
  duration: 3600
}
```

---

# 11 — Weapon Modifier Cantrips (True Strike / Blade Cantrips)

Rechercher :

* `modifyWeaponAttack()`

Sinon :

```json
weapon_attack_modifier: {
  replace_damage_with: "spell_damage",
  scaling: "cantrip"
}
```

---

# 12 — Résistances / Immunités

Rechercher :

* `applyResistance()`

Sinon :

```json
damage_pipeline: {
  apply_resistance: true,
  apply_immunity: true
}
```

---

# 13 — Concentration (si présent)

Rechercher :

* `concentration_manager`

Sinon :

```json
concentration: {
  required: true,
  break_on_damage: true
}
```

---

# 14 — Vérifications Pipeline

Toujours vérifier :

* Cible valide
* Portée
* Ligne de vue
* Silence / incapacité
* Concentration libre
* Résistances
* Snapshot safe
* Rollback possible

---

# 15 — Structure DATA recommandée

```
/data/spells/cantrips/fire_bolt.json
/data/spells/cantrips/ray_of_frost.json
/data/spells/cantrips/chill_touch.json
/data/spells/cantrips/frostbite.json
/data/spells/cantrips/shocking_grasp.json
/data/spells/cantrips/acid_splash.json
/data/spells/cantrips/thunderclap.json
/data/spells/cantrips/sword_burst.json
/data/spells/cantrips/poison_spray.json
/data/spells/cantrips/produce_flame.json
/data/spells/cantrips/guidance.json
/data/spells/cantrips/resistance.json
/data/spells/cantrips/blade_ward.json
/data/spells/cantrips/mage_hand.json
/data/spells/cantrips/minor_illusion.json
/data/spells/cantrips/prestidigitation.json
/data/spells/cantrips/light.json
/data/spells/cantrips/mending.json
/data/spells/cantrips/true_strike.json
```

---

# 16 — Si mécanique absente dans engine

Procédure Codex :

1. Chercher hook générique
2. Sinon → créer type d’effet DATA
3. Connecter au pipeline existant
4. Ajouter logs combat
5. Support preview / rollback
6. Pas de hardcode sort-spécifique

---

# 17 — Résultat attendu

Après intégration :

* Tous les cantrips fonctionnent via DATA
* Scaling automatique
* Compatible réactions / concentration
* Aucune logique spécifique codée en dur
* Pipeline respecté
* Engine extensible futurs sorts
* Support simulation / preview / rollback

---

# FIN DIRECTIVE
