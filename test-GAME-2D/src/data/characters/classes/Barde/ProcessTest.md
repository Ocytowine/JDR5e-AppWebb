# Directive d’Intégration — Barde DnD 2024

Objectif : intégrer **toutes les mécaniques du Barde** dans l’engine **sans casser le pipeline d’action**, en privilégiant une extension **data-driven**.
Ce document sert d’instructions pour Codex dans le workflow.

---

# 0 — Règles d’intégration

1. **Ne jamais bypass le pipeline d’action**

   * Toujours passer par `plan → validate → commit`
2. **Priorité aux systèmes existants**

   * Chercher hooks / helpers avant d’ajouter
3. **Extensions data-driven**

   * Ajouter config, tags, tables, effets
   * Éviter le hardcode
4. **Compatibilité snapshot / rollback obligatoire**
5. **Respect système réactions / concentration**

---

# 1 — Inspiration Bardique

## Mécanique

* Bonus action
* Donne un dé bonus à allié
* Recharge repos court
* Dé évolutif (d6→d12)
* Consommable
* Certains collèges modifient l’usage

## Rechercher dans l’engine

* `applyBuff()`
* `spendResource()`
* `restoreResource()`
* `onShortRest()`
* `dice_helper`
* `effect_bonus_die`
* `collectReactionCandidates` (cas Cutting Words)

## Si trouvé

Créer :

```json
effect: "bardic_inspiration"
resource: "bardic_inspiration"
scaling_die_by_level: true
duration: "until_used_or_timeout"
trigger: "ally_roll"
```

## Si NON trouvé → Extension data-driven

### Nouvelle ressource

```json
resources: {
  bardic_inspiration: {
    max: "CHA_mod",
    recharge: "short_rest"
  }
}
```

### Nouveau type d’effet

```json
effects: {
  bonus_die_on_trigger: {
    trigger: ["attack","save","check"],
    consume_on_use: true
  }
}
```

---

# 2 — Spellcasting (Lanceur complet)

## Mécanique

* Sorts connus
* Charisme
* Concentration
* Emplacements
* Scaling

## Rechercher

* `spellcasting_core`
* `concentration_manager`
* `spell_slots`
* `applySpellEffect`
* `onDamageConcentrationCheck`

## Si trouvé

Créer config classe :

```json
spellcasting: {
  ability: "CHA",
  progression: "full",
  known_spells: true
}
```

## Si NON trouvé

Créer système data :

```json
spell_system: {
  slot_table_ref: "full_caster",
  concentration: true,
  scaling_spells: true
}
```

---

# 3 — Expertise

## Mécanique

Double maîtrise sur compétences choisies

## Rechercher

* `modifySkillBonus`
* `proficiency_multiplier`
* `character_skills`

## Si trouvé

```json
expertise: {
  multiply_proficiency: 2,
  skills_selected: true
}
```

## Si NON trouvé

Ajouter champ :

```json
skills: {
  stealth: { prof: true, prof_mult: 2 }
}
```

---

# 4 — Jack of All Trades

## Mécanique

+½ maîtrise sur tout non maîtrisé

## Rechercher

* `global_skill_modifier`
* `untrained_bonus`

## Si NON trouvé

Ajouter hook passif :

```json
passives: {
  half_prof_untrained: true
}
```

---

# 5 — Song of Rest

## Mécanique

Bonus heal sur repos court

## Rechercher

* `onShortRest()`
* `heal()`
* `rest_bonus`

## Extension

```json
on_short_rest: {
  extra_heal_die: "bard_scale"
}
```

---

# 6 — Magical Secrets

## Mécanique

Apprendre sorts d’autres classes

## Rechercher

* `learnSpell()`
* `spell_list_override`
* `class_spell_filter`

## Extension

```json
spell_access_override: {
  allow_any_class: true,
  limit: 2
}
```

---

# 7 — Sous-classes

---

## College of Lore

### Cutting Words

**Réduit jet ennemi via réaction**

Rechercher :

* `reaction_window`
* `modify_roll_after_roll`
* `spendResource`

Extension :

```json
reaction_effect: {
  trigger: "enemy_roll",
  effect: "subtract_inspiration_die"
}
```

---

### Bonus Proficiencies

→ Ajouter compétences

---

### Peerless Skill

→ Inspiration sur soi → utiliser `self_target_allowed: true`

---

## College of Valor

### Combat Inspiration

Modifier buff inspiration :

```json
inspiration_bonus: {
  add_damage: true,
  add_ac_reaction: true
}
```

---

### Extra Attack

Rechercher :

* `extra_attack`
* `attack_repeat`

---

### Battle Magic

Hook :

```json
on_spell_cast: {
  allow_bonus_attack: true
}
```

---

## College of Glamour

### Mantle of Inspiration

Effet AOE + déplacement gratuit

Rechercher :

* `aoe_buff`
* `free_move_no_opportunity`

---

### Mantle of Majesty

Cast Command gratuit chaque tour

Extension :

```json
free_spell_each_turn: "command"
```

---

## College of Swords

### Blade Flourish

Consomme inspiration → effet combat

Rechercher :

* `on_hit_trigger`
* `spendResource`

Extension :

```json
on_attack_hit: {
  optional_resource_spend: "bardic_inspiration",
  apply_flourish_effect: true
}
```

---

## College of Whispers

### Psychic Blades

Ajout dégâts conditionnels

```json
on_hit: {
  bonus_damage: "psychic",
  consume_resource: true
}
```

---

### Shadow Identity

RP / social → hors combat → flag narratif

---

# 8 — Scaling

Créer table unique :

```json
bard_progression: {
  inspiration_die: {
    1: "d6",
    5: "d8",
    10: "d10",
    15: "d12"
  }
}
```

---

# 9 — Vérifications pipeline

Toujours vérifier :

* ressource disponible
* concentration libre
* réaction dispo
* cible valide
* snapshot safe
* rollback possible

---

# 10 — Si mécanique introuvable dans engine

Procédure Codex :

1. Chercher hook générique (trigger / effect / modifier)
2. Si absent → créer **nouveau type d’effet data**
3. Brancher dans pipeline existant :

   * `plan` → déclarer intention
   * `validate` → vérifier ressource / cible
   * `commit` → appliquer effet
4. Ajouter logs combat
5. Compatible preview

---

# 11 — Structure finale recommandée

```
/data/classes/bard.json
/data/subclasses/bard_lore.json
/data/subclasses/bard_valor.json
/data/subclasses/bard_glamour.json
/data/subclasses/bard_swords.json
/data/subclasses/bard_whispers.json
/data/progression/bard_scaling.json
```

---

# 12 — Résultat attendu

Après intégration :

* Inspiration fonctionne dans pipeline
* Réactions compatibles
* Scaling automatique
* Sous-classes modulent sans hardcode
* Magical Secrets compatible multi-classes
* Aucun bypass moteur

---

# FIN DIRECTIVE
