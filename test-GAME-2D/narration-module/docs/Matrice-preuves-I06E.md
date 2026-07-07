# Matrice de preuves I-06E — interprétation et clarification

Date : 2026-07-07.

Contrat : [`Contrat-interpretation-clarification.md`](Contrat-interpretation-clarification.md), version `intent-clarification/1`.

Statut : `LIVRE` dans le périmètre I-06E.

## Périmètre vérifié

| Exigence | Preuve | Résultat |
|---|---|---|
| question méta sans temps | `comment fonctionne la règle d'inspiration ?` => `meta_question` + `NO_GAME_TIME` | OK |
| question de possibilité sans action | `je peux lui voler quelque chose ?` => `possibility_query` + action non exécutée | OK |
| ambiguïté d'engagement clarifiée | `lui voler quelque chose ?` => `unclear_commitment` + bloc `CLARIFICATION` | OK |
| suspension d'intention | `suspendedIntent` produit avec `noGameTime: true` | OK |
| reprise de clarification | réponse `je voulais juste savoir` => engagement `hypothetical` | OK |
| action explicite détectée mais non résolue | `je regarde autour de moi` => `action`, notification hors périmètre | OK |
| aucun commit métier | opérations complétées en `NO_COMMIT_RESPONSE` | OK |
| horloge inchangée | `world.clock.elapsedGameSeconds` reste `0` | OK |

## Fichiers livrés

- `narration-module/src/application/intentClarification.ts`;
- `narration-module/src/application/NarrativeTurnController.ts` mis à jour;
- `narration-module/tests/scene/verify-narrative-turn-controller.ts` enrichi.

## Commandes exécutées

```powershell
npm run narration-module:build
npm run narration-module:test:narrative-turn-controller
```

Les deux commandes passent le 2026-07-07.

## Limites assumées

L'interprétation I-06E est déterministe et conservatrice. Elle ne remplace pas le futur rôle IA `intent_interpreter`, mais pose les garde-fous applicatifs minimaux.

Les intentions `speech`, `action` et `mixed` sont détectées mais non résolues.

## Décision de fermeture

I-06E est fermé dans son périmètre : interprétation conservatrice, méta, possibilité, clarification, suspension et reprise sans mutation.

La prochaine étape logique est I-06F : auditer la résolution narrative réelle et le branchement contrôlé du rôle IA d'interprétation.
