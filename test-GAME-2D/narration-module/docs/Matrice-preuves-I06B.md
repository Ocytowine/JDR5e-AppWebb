# Matrice de preuves I-06B — interface narrative React

Date : 2026-07-07.

Contrat : [`Contrat-interface-narrative-react.md`](Contrat-interface-narrative-react.md), version `narrative-react-ui/1`.

Statut : `LIVRE` dans le périmètre I-06B.

## Périmètre vérifié

| Exigence | Preuve | Résultat |
|---|---|---|
| composant React pur pour `DisplayPacketV1` | `src/ui/NarrativeConversationPanel.tsx` | OK |
| rendu multi-locuteurs accessible | test statique avec PJ, PNJ et MJ | OK |
| couleur non unique | labels visibles, `aria-label`, `data-narrative-block-kind`, `data-narrative-speaker-kind` | OK |
| saisie libre sans typage imposé au joueur | `textarea` unique et callback `onSubmit` | OK |
| `clientRequestId` généré côté UI pour idempotence aval | `createNarrativeClientRequestId` testé | OK |
| pas d'appel fournisseur navigateur | contrôle source contre `fetch`, routes historiques et `openaiProvider` | OK |
| pas de transcript autoritaire en stockage local | contrôle source contre `localStorage` et `sessionStorage` | OK |
| pas de réutilisation de `/api/narration` historique | contrôle source | OK |

## Fichiers livrés

- `src/ui/NarrativeConversationPanel.tsx`;
- `src/ui/NarrativeConversationPanel.test-fixture.ts`;
- `narration-module/tests/scene/verify-narrative-react-ui.ts`;
- script npm `narration-module:test:narrative-react-ui`.

## Commandes exécutées

```powershell
npm run narration-module:build
npm run narration-module:test:narrative-react-ui
```

Les deux commandes passent le 2026-07-07.

## Limites assumées

I-06B ne branche pas encore le panneau dans l'application et ne fournit pas l'orchestrateur de tour narratif complet. Il ne doit pas être branché dans `GameBoard.tsx`, qui reste la surface tactique.

Le composant rend des projections déjà validées; il ne construit pas le `DisplayPacketV1`, ne choisit pas le contexte IA, ne résout aucune règle et ne déclenche aucun fournisseur.

## Décision de fermeture

I-06B est fermé dans son périmètre : UI React pure, saisie libre callback, rendu accessible et absence d'effet réseau ou stockage local.

La prochaine étape logique est I-06C : auditer puis créer ou brancher une surface narration dédiée dans l'application, derrière un contrôleur narratif qui consomme les projections et non `GameBoard.tsx` ou les routes tactiques historiques.
