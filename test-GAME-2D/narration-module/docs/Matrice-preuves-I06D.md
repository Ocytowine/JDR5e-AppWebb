# Matrice de preuves I-06D — contrôleur de tour narratif

Date : 2026-07-07.

Contrat : [`Contrat-controleur-tour-narratif.md`](Contrat-controleur-tour-narratif.md), version `narrative-turn-controller/1`.

Statut : `LIVRE` dans le périmètre I-06D.

## Périmètre vérifié

| Exigence | Preuve | Résultat |
|---|---|---|
| saisie libre vers opération durable | `NarrativeTurnControllerV1.submit` + repository mémoire | OK |
| complétion sans commit métier | opération finale `COMPLETED` + `NO_COMMIT_RESPONSE` | OK |
| projection `DisplayPacketV1` | résultat `displayPacket` contenant `RAW_INPUT` et `SYSTEM_NOTICE` | OK |
| aucune avance temporelle | agrégat `world.clock.elapsedGameSeconds` reste `0` | OK |
| idempotence même requête | même `clientRequestId` + même texte retourne la même opération | OK |
| conflit même idempotence texte différent | erreur `IDEMPOTENCY_CONFLICT` | OK |
| surface narration branchée au contrôleur | `NarrativeAppSurface` utilise `createPrototypeNarrativeTurnControllerV1` | OK |
| absence de route tactique | tests I-06C + source sans route IA historique dans la surface | OK |

## Fichiers livrés

- `narration-module/src/application/NarrativeTurnController.ts`;
- `narration-module/src/application/index.ts`;
- `narration-module/tests/scene/verify-narrative-turn-controller.ts`;
- `src/narration-ui/NarrativeAppSurface.tsx` mis à jour pour utiliser le contrôleur;
- script npm `narration-module:test:narrative-turn-controller`.

## Commandes exécutées

```powershell
npm run narration-module:build
npm run narration-module:test:narrative-turn-controller
```

Les deux commandes passent le 2026-07-07.

## Limites assumées

I-06D n'interprète pas encore l'intention du joueur. Il ne demande pas de clarification, ne résout pas d'action, ne crée pas de scène réelle et ne commite aucun domaine métier.

La campagne utilisée par la surface est un prototype mémoire, distinct d'une campagne joueur bootstrappée par I-02.

## Décision de fermeture

I-06D est fermé dans son périmètre : contrôleur applicatif prototype, opération durable, réponse sans commit, projection affichable et idempotence.

La prochaine étape logique est I-06E : auditer l'interprétation d'intention et la clarification réelle avant tout branchement IA ou mutation métier.
