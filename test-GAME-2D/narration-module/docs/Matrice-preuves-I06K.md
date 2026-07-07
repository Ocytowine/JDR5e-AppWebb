# Matrice de preuves I-06K — persistance des projections et incidents IA

Date : 2026-07-07

Contrats reliés :

- [`Contrat-noyau-campagne.md`](Contrat-noyau-campagne.md), version `campaign-core/1`
- [`Contrat-controleur-tour-narratif.md`](Contrat-controleur-tour-narratif.md), version `narrative-turn-controller/1`
- [`Contrat-resolution-ia-bornee.md`](Contrat-resolution-ia-bornee.md), version `narrative-ai-resolution/1`
- [`Contrat-scene-social-ui.md`](Contrat-scene-social-ui.md), version `scene-social-ui/1`

Statut : `TERMINE`

## Synthèse

I-06K ferme le trou constaté après I-06J : le paquet affiché final pouvait être enrichi par IA puis conservé uniquement dans l'état React.

Le lot ajoute un enregistrement durable de rendu sous contrat `narrative-render-projection/1`.

Choix d'architecture :

- l'opération métier source `narrative.turn.input` reste inchangée après complétion;
- le rendu final est persisté dans une opération secondaire `narrative.render.projection`;
- cette opération secondaire est `NO_COMMIT_RESPONSE`, sans commit métier, sans temps de jeu et avec autorité `PRESENTATION_ONLY`;
- les incidents IA sont persistés uniquement sous forme expurgée;
- le rendu peut être retrouvé sans rejouer le tour métier ni rappeler OpenAI.

## Invariant principal

```text
Le rendu final devient durable.
Il ne devient pas une vérité de monde.
```

## Preuves exécutables

| Exigence | Preuve | Fichiers | Vérification |
|---|---|---|---|
| Projection de rendu persistée | création d'une opération `narrative.render.projection` complétée en `NO_COMMIT_RESPONSE` | `src/application/narrativeRenderProjection.ts` | `npm run narration-module:test:narrative-render-projection` |
| Autorité non métier | projection avec `authority=PRESENTATION_ONLY`, `noGameTime=true` et `commitId=null` | `src/application/narrativeRenderProjection.ts` | `npm run narration-module:test:narrative-render-projection` |
| Source intacte | l'opération `narrative.turn.input` conserve son payload `narrative-turn-controller/1` | `tests/scene/verify-narrative-render-projection.ts` | `npm run narration-module:test:narrative-render-projection` |
| Incidents expurgés | stockage des champs `safeDetails`, sans secret ni sortie brute non expurgée | `src/application/narrativeRenderProjection.ts` | `npm run narration-module:test:narrative-render-projection` |
| Idempotence | rejouer l'enregistrement retourne la même opération de rendu | `tests/scene/verify-narrative-render-projection.ts` | `npm run narration-module:test:narrative-render-projection` |
| Ancrage au tour source | rejet d'un `DisplayPacket` dont `operationId` ne correspond pas au tour source | `src/application/narrativeRenderProjection.ts` | `npm run narration-module:test:narrative-render-projection` |
| Branchement UI prototype | après enrichissement, la surface narration demande l'enregistrement durable du rendu | `src/narration-ui/NarrativeAppSurface.tsx` | `npm run narration-module:test:narrative-app-surface` |

## Limites volontaires

I-06K ne livre pas encore :

- reconstruction complète du fil UI après reload;
- choix utilisateur OpenAI persistant;
- consultation UX détaillée des incidents;
- migration IndexedDB spécifique de transcript;
- snapshot réel de scène;
- streaming ou reprise partielle d'un rendu interrompu.

Ces limites sont normales : le lot rend le rendu final enregistrable et idempotent, mais ne transforme pas encore l'UI en lecteur d'historique complet.

## Commandes à exécuter

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:narrative-render-projection
npm run narration-module:test:narrative-app-surface
npm run narration-module:test:ai-narrative-enhancement
npm run narration-module:build
npm run build
```
