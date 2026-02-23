# Cas 006 — Progression narrative (multiclassage + passage de niveau)

## 1) Contexte fonctionnel
- Nom de l’idée: progression encadrée narrativement
- Catégorie: `NARRATION` + `PROGRESSION`
- Valeur joueur: progression crédible, non brutale, ancrée dans l’histoire.

## 2) Multiclassage (règles)
- Le multiclassage est un choix libre.
- Il n’accorde jamais de pouvoir immédiatement.
- Toute acquisition doit être justifiée narrativement.

## 3) Conditions d’éveil de classe
- Ensorceleur: mutation / révélation du pouvoir latent
- Magicien: étude, mentor, grimoire
- Clerc: appel divin, vision, foi
- Paladin: serment, conviction
- Occultiste: pacte, entité, échange
- Druide: communion nature
- Barde: révélation artistique
- Moine: discipline, initiation

## 4) Passage de niveau
- Déclenchement autorisé pendant repos court/long.
- Notification HRP minimale.
- Progression diluée en narration (apprentissage, entraînement, intuition, transformation).

## 5) Logique runtime (concept)
```txt
ProgressionSystem
 ├─ multiclass_choice = pending
 ├─ trigger narrative_event
 ├─ validate condition + sequence RP
 ├─ unlock powers post-event
 ├─ on_rest_open -> check_level_up_available
 ├─ HRP_notify("Progression disponible")
 ├─ apply_levelup_after_rest_menu
 └─ trigger_narrative_growth
```

## 6) Critères de réussite
- Aucun gain “instantané” sans séquence narrative.
- Le joueur ressent une montée en puissance progressive et contextualisée.
- La progression reste lisible côté système et crédible côté rôleplay.

## 7) Décision
- Priorité: `P0`
- Décision: `GO`
