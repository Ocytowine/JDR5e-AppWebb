# Cas 005 — Aventure narrative (chef d’orchestre du jeu)

## 1) Contexte fonctionnel
- Nom de l’idée: aventure narrative orchestratrice
- Catégorie: `NARRATION` + `IA_MJ` + `MEMOIRE` + `TACTIQUE`
- Valeur joueur: une aventure vivante où les échanges, choix et états du monde déclenchent des conséquences mécaniques cohérentes.

## 2) Vision
Le système d’aventure narrative devient le **pilier central** de l’app:
- il pilote la narration,
- il cadence les quêtes,
- il coordonne les autres systèmes (combat, repos, relations, bastion, progression),
- il déclenche des commandes et événements selon le contexte.

## 3) Règles structurantes
- R1: toute mécanique majeure doit pouvoir être déclenchée par un événement narratif.
- R2: toute conséquence mécanique significative doit être réinjectée en narration.
- R3: les systèmes périphériques (repos, bastion, progression) restent subordonnés au contexte d’aventure.
- R4: les notifications HRP existent, mais restent discrètes et non intrusives.

## 4) Modèle conceptuel
```txt
AventureNarrativeSystem
 ├─ observe(GameState, MemoryState, SocialState)
 ├─ evaluateNarrativeContext()
 ├─ dispatchNarrativeEvents()
 ├─ triggerMechanicHooks()
 └─ updateNarrativeConsequences()
```

## 5) Hooks attendus
- `on_dialogue_choice`
- `on_social_threshold_crossed`
- `on_rest_phase`
- `on_bastion_update`
- `on_progression_unlock`
- `on_combat_resolution`

## 6) Critères de réussite
- Une même action produit à la fois un effet narratif et un effet système traçable.
- Les transitions entre narration et tactique sont fluides et justifiées.
- Le MJ IA dispose de signaux structurés pour arbitrer sans casser la cohérence.

## 7) Décision
- Priorité: `P0`
- Décision: `GO`
- Dépendances: Cas 001, Cas 002, Cas 003, Cas 004.
