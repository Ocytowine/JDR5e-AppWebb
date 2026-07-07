# Matrice de preuves I-06L — reconstruction du fil depuis les projections persistées

Date : 2026-07-07

Contrats reliés :

- [`Contrat-noyau-campagne.md`](Contrat-noyau-campagne.md), version `campaign-core/1`
- [`Contrat-surface-narration-app.md`](Contrat-surface-narration-app.md), version `narrative-app-surface/1`
- [`Matrice-preuves-I06K.md`](Matrice-preuves-I06K.md), contrat `narrative-render-projection/1`

Statut : `TERMINE`

## Synthèse

I-06L rend exploitable la persistance I-06K : la surface narration peut reconstruire son fil depuis les opérations de rendu persistées, sans rejouer le tour métier et sans rappeler le fournisseur IA.

Le lot ajoute :

- une lecture bornée `CampaignRepository.listOperations`;
- un reconstructeur `restoreNarrativeRenderedThreadV1`;
- une méthode applicative `NarrativeTurnControllerV1.restoreRenderedThread`;
- un contrôleur prototype navigateur qui utilise IndexedDB quand disponible;
- un fallback mémoire pour les environnements sans IndexedDB.

## Invariants

```text
Restaurer le fil lit des projections.
Restaurer le fil ne rejoue pas les opérations métier.
Restaurer le fil ne rappelle pas OpenAI.
Restaurer le fil ne crée aucun commit et ne fait pas avancer le temps.
```

## Preuves exécutables

| Exigence | Preuve | Fichiers | Vérification |
|---|---|---|---|
| Lecture repository bornée | `listOperations(campaignId, kind, limit)` liste et filtre les opérations | `src/core/repository/*CampaignRepository.ts` | `npm run narration-module:test:contracts:core` |
| Reconstruction depuis projections | `restoreRenderedThread` retourne les `DisplayPacketV1` issus de `narrative.render.projection` | `src/application/narrativeRenderProjection.ts` | `npm run narration-module:test:narrative-render-projection` |
| Pas de rejeu métier | le test restaure après enregistrement et vérifie les opérations source intactes | `tests/scene/verify-narrative-render-projection.ts` | `npm run narration-module:test:narrative-render-projection` |
| Branchement UI | la surface appelle `restoreRenderedThread` au montage | `src/narration-ui/NarrativeAppSurface.tsx` | `npm run narration-module:test:narrative-app-surface` |
| Persistance navigateur prototype | contrôleur navigateur tente IndexedDB avant fallback mémoire | `src/application/NarrativeTurnController.ts` | `npm run narration-module:build` |

## Limites volontaires

I-06L ne livre pas encore :

- pagination UX du fil;
- suppression/compactage des anciens rendus;
- affichage détaillé des incidents IA;
- préférence OpenAI persistée;
- restauration d'un snapshot réel de scène;
- reprise partielle d'un rendu interrompu.

Le fil restauré est le fil visible final. Il ne remplace pas le futur système mémoire/snapshot, ni l'historique métier complet.

## Commandes à exécuter

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:contracts:core
npm run narration-module:test:narrative-render-projection
npm run narration-module:test:narrative-app-surface
npm run narration-module:test:indexeddb
npm run narration-module:build
npm run build
```
