# Script Test E2E Narration

Date: 2026-03-02

## 1) Check technique automatique (terminal)

Depuis `test-GAME-2D`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-e2e-checklist.ps1
```

Sans build final:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-e2e-checklist.ps1 -NoBuild
```

Resultat attendu:
- toutes les commandes `validate:phase*` passent.
- `npm run build` passe.

## 2) Scenario manuel RP (UI, Details ON)

Pre-requis:
- `npm run dev`
- Ouvrir l UI narration
- Activer `Details: ON`

### Etapes

1. `/reset`
- Attendu: reset sans erreur, contexte de depart verrouille recharge.

2. `je me dirige vers une rue marchande`
- Attendu: proposition ou deplacement coherent.
- Debug: `intent=story_action`, `semanticIntent=move_place`, `worldDelta reason=travel-proposed` (ou equivalent cohérent), pas de contradiction de lieu.

3. `ok j'y vais`
- Attendu: arrivee effective au lieu.
- Debug: `reason=travel-confirmed`, plus de pending travel.

4. `je cherche une boutique de vetement`
- Attendu: scene locale credibe, sans teleporter vers un autre lieu.
- Debug: scene_only possible, coherence lieu maintenue.

5. `je rentre dans la boutique et je salue la vendeuse`
- Attendu: action executee ou blocage RP justifie (pas "tu envisages" incoherent).
- Debug: interlocuteur actif mis a jour si interaction sociale.

6. `je demande les prix pour une tenue d'ecole de magie`
- Attendu: reponse marchande coherente avec le tour precedent.
- Debug: continuite lieu/interlocuteur stable.

7. `j'aimerais peut-etre negocier si c'est possible`
- Attendu: ton hypothetique/clarification, pas execution brute.
- Debug: `commitment=hypothetique`.

8. `ok, je negocie maintenant`
- Attendu: progression narrative claire.
- Debug: engagement plus fort (`declaratif`/`volitif`) et suivi de scene.

9. `/phase1-debug`
10. `/phase2-debug`
11. `/phase3-debug`
12. `/phase4-debug`
13. `/phase5-debug`
14. `/phase6-debug`
15. `/phase7-debug`
16. `/phase8-debug`
- Attendu: chaque commande renvoie un statut coherent (DoD + metriques).

## 3) Checklist rapide de verdict

- Coherence lieu/interlocuteur maintenue sur plusieurs tours.
- Pas de narration meta/debug dans le texte RP.
- Fallbacks visibles uniquement en debug.
- Budget IA respecte (pas de depassement explicite).
- Reponses non tronquees et lisibles.
- Aucun glissement absurde (PNJ/lieu change sans cause).

## 4) Si echec: quoi capturer

Capturer et partager:
- le prompt joueur exact.
- la reponse MJ exacte.
- le bloc `[debug]` complet du tour.
- la commande debug de phase la plus proche (`/phaseX-debug`).
