# Matrice de preuves I-06A — scène, social et interface conversationnelle

Date : 2026-07-07.

Contrat : [`Contrat-scene-social-ui.md`](Contrat-scene-social-ui.md), version `scene-social-ui/1`.

Statut : `LIVRE` dans le périmètre I-06A.

## Périmètre vérifié

| Exigence | Preuve | Résultat |
|---|---|---|
| `SceneDomain` possède la continuité locale sans copier les autorités | `validateSceneStateV1` sur fixture Archives | OK |
| `SocialKnowledgeDomain` sépare connaissance, croyance et relation | `validateSocialKnowledgeStateV1` sur garde des Archives | OK |
| entrée brute, expression PJ, PNJ et narration restent distincts | fixture NAR-ACC-017 dans `verify-scene-social-ui.ts` | OK |
| blocs de parole validés non réécrits | `validateRenderPlanV1` avec `exactTextBySourceRef`, variante PNJ modifiée rejetée | OK |
| attribution multi-locuteurs accessible | `DisplayPacketV1` exige nom, rôle, aria label et token visuel | OK |
| couleur non unique | assertions sur `ariaLabel`, `roleLabel` et `displayName` | OK |
| transcript reconstructible après perte de cache | `reconstructInteractionLogEntriesV1` depuis `RenderPlan` et sources | OK |
| clarification sans temps ni mutation | `validateSuspendedClarificationV1` impose `noGameTime: true` | OK |
| rythme multi-PNJ réglable | `decideConversationRhythmV1` applique seuils configurables | OK |
| NAR-ACC-009 apparence/inventaire | fixture visible clothing + bourse accessible, sac non exposé | OK |
| rendu dégradé post-commit | `buildDisplayPacketFromRenderPlanV1(... isDegradedFallback)` marque les blocs | OK |

## Fichiers livrés

- `src/scene/types.ts`;
- `src/scene/validation.ts`;
- `src/scene/projection.ts`;
- `src/scene/index.ts`;
- `tests/scene/verify-scene-social-ui.ts`;
- script npm `narration-module:test:scene-social-ui`.

## Commandes exécutées

```powershell
npm run narration-module:build
npm run narration-module:test:scene-social-ui
```

Les deux commandes passent le 2026-07-07.

## Limites assumées

I-06A ne branche pas encore l'interface React. Il prouve le contrat et les projections qui devront alimenter cette interface.

Les tests utilisent des fixtures déterministes. Ils ne certifient pas encore l'expérience UX réelle, le streaming, ni le routage complet d'un tour depuis la saisie joueur.

## Décision de fermeture

I-06A est fermé dans son périmètre : types, validateurs, projections, rythme et fixtures.

La prochaine étape logique est I-06B : brancher progressivement ces projections dans une UI narrative sans appel fournisseur direct depuis React et sans confondre cache d'affichage avec vérité métier.
