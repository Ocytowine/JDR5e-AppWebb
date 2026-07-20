# Matrice de preuves I-06ZQ

Date : 2026-07-17

| Exigence | Preuve |
|---|---|
| Format de famille et oracle | `SemanticInvarianceFamilyV1` et `SemanticSystemFingerprintV1` dans la suite dédiée |
| Cinq formulations par famille | assertion d'unicité et tuple de cinq entrées pour les sept familles |
| Cas requis | parole, approche, manipulation implicite, observation, possibilité, clarification, inventaire fermé |
| Variations linguistiques | formulations nominales, ordre inversé, gestes implicites et pronoms |
| Référent récent | quatrième variante de chaque famille ciblée marquée `recent_visible_focus` |
| Multi-scènes | auberge, tour de guet et marché; cible compatible vérifiée dans chaque registre |
| Empreinte identique | 105 cas convergent vers 21 oracles famille/scène, puis vers l'oracle normalisé multi-scènes |
| Ambiguïté séparée | clarification exige `NEEDS_CLARIFICATION` et aucune commande |
| Live séparé | procédure, seuils et taxonomie dans [`Contrat-invariance-semantique.md`](Contrat-invariance-semantique.md) |

## Vérifications

- `npm run narration-module:test:semantic-invariance`
- `npm run narration-module:test:playable-scene`
- `npm run narration-module:test:ai-intent-interpretation`
- `npm run narration-module:test:narrative-resolution`
- `npm run narration-module:test:narrative-turn-controller`
- `npm run narration-module:test:ai-pipeline`
- `npm run narration-module:build`
- `npm run build`
