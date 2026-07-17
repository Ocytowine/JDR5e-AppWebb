# Matrice de preuves I-06ZL — Propagation sémantique canonique

Date : 2026-07-17

Statut : `TERMINE_DANS_PERIMETRE`

## Objectif

Garantir que `semanticIntent`, produit par `player_intent_interpreter`, traverse sans perte le mapping applicatif, le contrôleur, la résolution, les intentions suspendues et la persistance du résultat de tour.

I-06ZL ne modifie pas encore la décision du planner ou du routeur. Leur consommation sémantique appartient à I-06ZM.

## Décision de version

`intent-clarification/1` reste la seule version active du contrat applicatif afin d'éviter deux représentations concurrentes du tour.

La structure `semanticIntent` devient obligatoire dans `NarrativeIntentInterpretationV1`. Les anciennes opérations persistées restent lisibles par un adaptateur de frontière explicite qui construit une projection sémantique compatible depuis les champs legacy. Après cette frontière, toutes les données en mémoire utilisent la forme canonique.

## Preuves

| Exigence | Preuve |
|---|---|
| `semanticIntent` obligatoire | Type TypeScript requis dans `NarrativeIntentInterpretationV1` |
| sortie IA conservée sans perte | égalité profonde entre le payload accepté et l'interprétation applicative |
| contrôleur et résolution alignés | égalité profonde des intentions sémantiques dans la sortie de tour |
| interpréteur local compatible | construction systématique d'une intention sémantique bornée |
| diagnostic technique compatible | intention `unclear_intent`, confiance basse et interdiction de fallback inventé |
| anciennes opérations lisibles | `upgradeLegacyNarrativeIntentInterpretationV1` testé sans `semanticIntent` source |
| consumers IA refusent une forme partielle | guards du `mj_planner` et du `npc_performer` exigent la structure sémantique |

## Vérifications exécutées

Depuis `test-GAME-2D/` :

```text
npm run narration-module:test:ai-intent-interpretation  OK
npm run narration-module:test:narrative-resolution       OK
npm run narration-module:test:narrative-turn-controller  OK
npm run narration-module:test:ai-pipeline                 OK
npm run narration-module:build                            OK
```

## Limites conservées

- le `mj_planner` alimente encore `semanticGoal` depuis `coreMeaning`;
- le routeur lit encore `runtimeHandling` proposé par l'IA;
- `action` reste utilisée par la résolution existante;
- les heuristiques lexicales et références de fixture ne sont pas retirées;
- aucune commande de domaine typée nouvelle n'est introduite.

Ces limites sont respectivement traitées par I-06ZM à I-06ZP. Elles ne doivent pas être corrigées opportunément dans I-06ZL.

## Gate de sortie

I-06ZL est terminé dans son périmètre. La prochaine étape autorisée est I-06ZM : faire consommer la structure sémantique par le planner et séparer la suggestion `runtimeHandling` de la décision runtime locale.
