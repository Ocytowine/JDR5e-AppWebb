# Plan de Correctif - Fighting Styles / Dual Wield / Weapon Mastery

Date: 2026-02-18
Owner: Codex + Ebaluteau
Statut global: in_progress

## Contexte

Problemes observes en combat:
1. Messages de preconditions ambigus (ex: `two-handed attendu=oui`) difficiles a expliquer en jeu.
2. Detection main principale / main secondaire fragile (flags incoherents ou absents).
3. Divergence entre logique data (`wm-coup-double`) et logique runtime hardcodee.
4. Besoin de logs runtime plus riches dans l'UI pour diagnostiquer vite.

Contraintes produit confirmees:
1. Les fighting styles doivent pouvoir se cumuler.
2. Les correctifs doivent rester data-driven et coherents avec le pipeline ActionEngine.

## References d'architecture

1. `test-GAME-2D/docs/ActionEngine/engine-progress.md`
2. `test-GAME-2D/docs/ActionEngine/weapon-properties-progress-schema.md`
3. `test-GAME-2D/docs/ActionEngine/weapon-properties-integration-plan.md`
4. `test-GAME-2D/docs/ActionEngine/action-creation-notice.md`
5. `test-GAME-2D/docs/ActionEngine/action-pipeline-helper.md`

## Plan par phases

### Phase 0 - Observabilite (Logs UI + tracing runtime)

Objectif:
- Rendre visible la chaine de decision feature/economie d'action/dual-wield.

Travaux:
1. Ajouter des logs structures (`[feature]`, `[economy]`, `[dual-wield]`, `[wm]`).
2. Exposer dans le log: styles actifs, armes resolues (main/offhand), tags action finaux, cout brut/effectif, raison de refus.
3. Conserver des messages courts cote UI et details complets cote debug.

Sortie attendue:
- Un refus d'action est explicable en une lecture sans inspection code.

### Phase 1 - Source de verite unique pour les mains (priorite haute)

Objectif:
- Unifier la detection des armes mains et offhand sur un resolver unique.

Travaux:
1. Centraliser la resolution des mains dans `equipmentHands.ts` (primary/offhand/shield + fallback robuste).
2. Reutiliser cette resolution dans `weaponPairingRules.ts`.
3. Aligner les helpers de `GameBoard.tsx` (primary/offhand ids) sur le meme fallback.

Sortie attendue:
- Meme verdict partout (constraints, dual wield policy, availability, debug).

### Phase 2 - Harmonisation attaque secondaire / economy

Objectif:
- Assurer une lecture uniforme de l'attaque secondaire (bonus/free selon regles) sans casser le cumul des styles.

Travaux:
1. Verifier la conversion dual-wield dans `resolveActionCostContext`.
2. Verifier coherence des tags dual-wield (`secondary-attack`, `offhand-attack`, `dual-wield`).
3. Normaliser les messages de limite (`usageKey`, `maxPerTurn`).

Sortie attendue:
- Les regles de style 2 armes s'activent uniquement quand les preconditions reelles sont remplies.

### Phase 3 - `wm-coup-double` 100% pilote par la data

Objectif:
- Supprimer la divergence entre JSON WM et traitement runtime.

Travaux:
1. Retirer la branche hardcodee WM `coup-double` dans `actionExecute.ts`.
2. Deplacer les limites et conditions dans la couche data/rules (`usageKey/maxPerTurn`).
3. Verifier coherence `wm-trigger:on_intent` + event/ops.

Sortie attendue:
- Une seule source de verite pour `coup-double` et ses limites.

### Phase 4 - Verification `extra-attack` et `action-surge`

Objectif:
- Clarifier et stabiliser l'economie d'action percee par l'utilisateur.

Travaux:
1. Tracer explicitement `hasTurnAttackActionUsed` pour extra-attack.
2. Tracer `bonusMainActionsThisTurn` pour action-surge (budget gagne vs cout consomme).
3. Verifier affichage `actionsRemaining` dans la fiche combat.

Sortie attendue:
- Comportement percu conforme aux regles et explicable par logs.

### Phase 5 - QA + Documentation

Objectif:
- Verrouiller les regressions et aligner la doc runtime.

Travaux:
1. Matrice de test manuelle + cas smoke.
2. Tests cibles sur dual-wield, extra-attack, action-surge, wm coup-double.
3. Mise a jour docs ActionEngine (etat reel du runtime).

Sortie attendue:
- Correctif verifie et trace dans la doc projet.

## Critere d'acceptation global

1. Avec 2 armes light equipees, la detection offhand est stable et identique partout.
2. Les fighting styles restent cumulables sans faux conflits.
3. `wm-coup-double` respecte strictement sa limite par tour via la data.
4. Les logs UI expliquent chaque refus/action de facon deterministic.

## Avancement

- [x] Plan ecrit
- [x] Phase 0
- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [x] Phase 4
- [x] Phase 5
