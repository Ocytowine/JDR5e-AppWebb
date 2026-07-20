# Matrice de preuves I-06ZP

Date : 2026-07-17

| Exigence | Preuve |
|---|---|
| Registre construit depuis la scène | `buildSceneReferentRegistryV1(PlayableSceneStateV1)` |
| Références canoniques sans table spéciale | recherche générique préfixée/non préfixée par `findSceneReferentByRefV1` |
| Secrets exclus | registre construit uniquement depuis PNJ présents, éléments visibles et points d'intérêt publics |
| Vues par rôle | `npc_performer` ne reçoit que les référents PNJ |
| Ambiguïté explicite | deux guides partageant l'alias `guide` produisent `AMBIGUOUS` |
| Aucun PNJ par défaut | `Je lui demande...` sans contexte produit une clarification |
| Mémoire courte revalidée | hints liés à `sceneId`, `sceneVersion`, présence au registre et compatibilité |
| Multi-scènes | auberge, tour de guet et marché nocturne utilisent le même constructeur et le même resolver de références |
| Resolver générique | la visibilité est validée par le registre et non par une liste garde/serveuse/porte |

## Vérifications

- `npm run narration-module:test:playable-scene`
- `npm run narration-module:test:ai-intent-interpretation`
- `npm run narration-module:test:narrative-resolution`
- `npm run narration-module:test:narrative-turn-controller`
- `npm run narration-module:test:vertical-quality`
- `npm run narration-module:test:ai-pipeline`
- `npm run narration-module:build`
- `npm run build`
