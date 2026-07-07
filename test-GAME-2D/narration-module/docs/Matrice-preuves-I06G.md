# Matrice de preuves I-06G — resolution IA bornee

Date : 2026-07-07

Contrat : [`Contrat-resolution-ia-bornee.md`](Contrat-resolution-ia-bornee.md), version `narrative-ai-resolution/1`

Statut : `TERMINE`

## Synthese

I-06G ajoute une couche d'enrichissement IA post-resolution.

Elle ameliore le rendu visible sans modifier le resultat I-06F :

- expression PJ plus naturelle;
- bloc de narration MJ ancre;
- handoff tactique rendu plus vivant;
- fallback deterministe si sortie IA invalide;
- aucun changement de commit, horloge, handoff ou `resultKind`.

## Preuves executables

| Exigence | Preuve | Fichiers | Verification |
|---|---|---|---|
| IA sans autorite metier | `enhanceNarrativeDisplayWithAiV1` retourne un `DisplayPacket` enrichi et conserve la resolution | `src/application/aiNarrativeEnhancement.ts` | `npm run narration-module:build` |
| Expression PJ enrichie sans ajout de sens | `player_expression_adapter` accepte `addedMeaning=[]` et remplace seulement le bloc `PLAYER_EXPRESSION` | `tests/scene/verify-ai-narrative-enhancement.ts` | `npm run narration-module:test:ai-narrative-enhancement` |
| Reformulation dangereuse rejetee | `addedMeaning=["promesse de service"]` produit incident et fallback | `tests/scene/verify-ai-narrative-enhancement.ts` | `npm run narration-module:test:ai-narrative-enhancement` |
| Narration MJ ancree | `scene_writer` ajoute un bloc `GM_NARRATION` avec `groundedIn` vers la resolution | `tests/scene/verify-ai-narrative-enhancement.ts` | `npm run narration-module:test:ai-narrative-enhancement` |
| Handoff tactique vivant sans combat simule | attaque du garde reste `HANDOFF_REQUIRED` vers `TACTICAL`, avec texture narrative sans succes/echec | `tests/scene/verify-ai-narrative-enhancement.ts` | `npm run narration-module:test:ai-narrative-enhancement` |
| Fallback deterministe | sortie scene writer revendiquant un succes non commite rejetee | `src/application/aiNarrativeEnhancement.ts`, test I-06G | `npm run narration-module:test:ai-narrative-enhancement` |

## Limites volontaires

I-06G ne livre pas :

- branchement OpenAI dans l'UI;
- streaming;
- MJ planner;
- NPC performer;
- rules adjudicator;
- coherence critic automatique;
- creation persistante;
- tactique ou repos jouable.

Le faux fournisseur contractuel reste la preuve principale. Le fournisseur reel demandera un branchement explicite et des seuils qualite/cout.

## Commandes executees

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:build
npm run narration-module:test:ai-narrative-enhancement
```
