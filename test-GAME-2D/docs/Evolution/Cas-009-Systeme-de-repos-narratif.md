# Cas 009 — Système de repos narratif (danger, activités, interruptions)

## 1) Contexte fonctionnel
- Nom de l’idée: repos narratif interactif
- Catégorie: `NARRATION` + `TACTIQUE` + `PROGRESSION`
- Valeur joueur: le repos devient un vrai moment de jeu, risqué et stratégique.

## 2) Flux en 6 étapes
1. Évaluation du danger par le MJ (`danger_level -> rest_DC` caché).
2. Choix d’activités par tranche horaire.
3. Jet caché (Perception/Survie/Nature/Discrétion/selon contexte).
4. Résolution événementielle (réussite/échec/échec critique).
5. Interruption potentielle du repos et annulation partielle d’activités.
6. Choix d’affichage: time-lapse ou RP détaillé.

## 3) Activités possibles
- Dormir
- Monter la garde
- Méditer
- Étudier
- Fabriquer
- Explorer
- Soigner
- S’entraîner
- RP libre

## 4) Effets possibles
- Réussite: anomalie perçue, option d’action.
- Échec: événement inévitable.
- Échec critique: repos interrompu + pertes possibles.

## 5) Logique runtime (concept)
```txt
RestSystem
 ├─ evaluateDanger()
 ├─ openRestPanel()
 ├─ hourlyActivityLoop()
 ├─ hiddenCheck()
 ├─ triggerEvent()
 ├─ interruptRestIfNeeded()
 └─ resumePendingActivities()
```

## 6) Règles de présentation
- Les résultats de jet caché ne sont jamais donnés bruts.
- Le feedback est narratif et contextualisé.
- Le joueur choisit son niveau de granularité (résumé vs RP).

## 7) Critères de réussite
- Le repos n’est plus “gratuit” ni purement administratif.
- Les choix d’activités ont des conséquences tangibles.
- Le système se connecte proprement à progression, narration et état du monde.

## 8) Décision
- Priorité: `P0`
- Décision: `GO`
