# Matrice de preuves I-06ZO

Date : 2026-07-17  
Lot : retrait progressif de la réinterprétation lexicale

| Exigence | Preuve |
|---|---|
| Aucun domaine n'est choisi depuis un verbe joueur | `narrativeResolution.ts` consomme `runtimeDecision` et une `domainCommand` validée; l'ancien classifieur regex de handoff est supprimé |
| Aucun commit local n'est choisi depuis `action` ou `coreMeaning` | la branche locale exige `SCENE_INTERACTION_REQUEST`; la nature du positionnement vient de `semanticIntent.kind` |
| Le mapper ne corrige plus une approche depuis le texte | `normalizeMappedIntentTarget` consomme uniquement intention et cible structurées |
| Une possibilité structurée n'est pas validée par ponctuation/synonymes | la cohérence porte sur `intentType`, `commitment` et les contrats, sans regex sur `rawInput` |
| Les mutations de scène suivent le sens structuré | observation et résumé de parole consomment `semanticIntent` |
| Les lectures restantes sont bornées | [`Inventaire-lectures-lexicales-I06ZO.md`](Inventaire-lectures-lexicales-I06ZO.md) |
| Formulation reformulée stable | le test d'approche dirigée committe avec un `coreMeaning` distinct du but sémantique et cite la commande source |

## Vérifications exécutées

- `npm run narration-module:test:ai-intent-interpretation`
- `npm run narration-module:test:narrative-resolution`
- `npm run narration-module:test:narrative-turn-controller`
- `npm run narration-module:build`
- `npm run build`
