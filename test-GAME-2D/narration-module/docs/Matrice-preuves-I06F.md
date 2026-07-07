# Matrice de preuves I-06F — resolution narrative bornee

Date : 2026-07-07

Contrat : [`Contrat-resolution-narrative.md`](Contrat-resolution-narrative.md), version `narrative-resolution/1`

Statut : `TERMINE`

## Synthese

I-06F introduit un resolver deterministe conservateur branche au `NarrativeTurnControllerV1`.

Le lot prouve une premiere chaine de resolution reelle sans ouvrir le MJ complet :

- question meta ou de possibilite : aucune action, aucun commit;
- ambiguite : clarification suspendue;
- action risquee ou domaine non ouvert : handoff sans resultat invente;
- parole explicite : reformulation fidele, commit borne, rendu apres commit;
- rejeu idempotent : meme resultat;
- conflit d'idempotence : rejet;
- horloge de campagne inchangee.

## Preuves executables

| Exigence | Preuve | Fichiers | Verification |
|---|---|---|---|
| Sortie structuree, jamais texte seul | `NarrativeResolutionResultV1` et types de resultats | `src/application/narrativeResolution.ts` | `npm run narration-module:build` |
| Question de possibilite non executee | "Est-ce que je peux voler..." retourne `NO_COMMIT_RESPONSE` sans commit | `tests/scene/verify-narrative-resolution.ts` | `npm run narration-module:test:narrative-resolution` |
| Action inventaire bloquee | "Je vole la bourse..." retourne `HANDOFF_REQUIRED` vers `INVENTORY` | `tests/scene/verify-narrative-resolution.ts` | `npm run narration-module:test:narrative-resolution` |
| Conflit violent non simule par narration | "J'attaque le garde" retourne `HANDOFF_REQUIRED` vers `TACTICAL` | `tests/scene/verify-narrative-resolution.ts` | `npm run narration-module:test:narrative-resolution` |
| Parole explicite committable | "Je dis au garde..." produit `COMMIT_APPLIED` et `COMMITTED_RENDERED` | `tests/scene/verify-narrative-resolution.ts` | `npm run narration-module:test:narrative-resolution` |
| Reformulation fidele | `preservedMeaning=true`, aucun `addedCommitments` | `src/application/narrativeResolution.ts`, test I-06F | `npm run narration-module:test:narrative-resolution` |
| Commit avant rendu | Le commit speech est applique avant `completePresentation` | `src/application/NarrativeTurnController.ts` | `npm run narration-module:test:narrative-resolution` |
| Idempotence | Rejeu meme `clientRequestId` retourne la meme sortie | `tests/scene/verify-narrative-resolution.ts` | `npm run narration-module:test:narrative-resolution` |
| Conflit d'idempotence | Meme `clientRequestId`, texte different, rejet `IDEMPOTENCY_CONFLICT` | `tests/scene/verify-narrative-resolution.ts` | `npm run narration-module:test:narrative-resolution` |
| Temps nul pour les cas non temporels | `world.clock.elapsedGameSeconds` reste a 0 | `tests/scene/verify-narrative-resolution.ts` | `npm run narration-module:test:narrative-resolution` |
| Compatibilite controleur existant | I-06D/I-06E restent valides avec champ `resolution` | `tests/scene/verify-narrative-turn-controller.ts` | `npm run narration-module:test:narrative-turn-controller` |

## Limites volontaires

I-06F ne livre pas :

- MJ IA complet;
- appel fournisseur de resolution;
- streaming;
- tactique jouable;
- repos jouable;
- progression;
- economie;
- creation persistante automatique;
- intrigue dynamique committable.

Ces cas restent des handoffs ou des propositions jusqu'a ouverture de leurs domaines.

## Commandes executees

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:build
npm run narration-module:test:narrative-turn-controller
npm run narration-module:test:narrative-resolution
```
