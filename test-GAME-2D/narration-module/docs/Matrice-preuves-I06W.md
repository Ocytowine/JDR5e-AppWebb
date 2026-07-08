# Matrice de preuves I-06W — revue UX narration

Date : 2026-07-08
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06W vérifie que la surface narration permet de distinguer clairement les rôles et statuts essentiels sans dépendre uniquement de la couleur.

Le lot reste une revue UX ciblée. Il ne livre pas un lecteur d'historique complet, une refonte visuelle complète, ni une nouvelle orchestration narrative.

## Périmètre livré

- badges UX accessibles par bloc dans `NarrativeConversationPanel`;
- indicateurs rendus hors couleur via `data-narrative-ux-badge`;
- attribution existante conservée par :
  - `data-narrative-block-kind`;
  - `data-narrative-speaker-kind`;
  - `aria-label`;
  - rôle et nom affichés;
- visibilité explicite des statuts :
  - entrée joueur brute;
  - expression joueur validée;
  - MJ;
  - PNJ;
  - système;
  - clarification;
  - réponse sans commit;
  - aucun temps;
  - IA;
  - fallback.

## Preuves exécutables

| Preuve | Résultat attendu |
|---|---|
| `npm run narration-module:test:narrative-react-ui` | Vérifie le rendu accessible des rôles et badges UX. |
| `npm run narration-module:test:narrative-app-surface` | Vérifie que la surface narration reste dédiée, sans appel OpenAI navigateur ni dépendance plateau. |
| `npm run narration-module:build` | Valide types et imports React/TypeScript. |

## Limites assumées

- Les badges sont déduits des blocs existants; aucun nouveau contrat de persistance n'est introduit.
- Le mode local/OpenAI reste affiché au niveau de la surface, pas recopié sur chaque bloc.
- Les projections restaurées ne transportent pas encore une métadonnée UX dédiée par bloc.
- Le lecteur UX complet d'historique reste hors périmètre.

## Décision

I-06W est clos dans son périmètre si les preuves ci-dessus passent. La suite recommandée est une revue/commit du bloc I-06W avant d'ouvrir un nouveau lot narratif.
