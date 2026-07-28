# Matrice de preuves I-06V — préparation intrigue sans création d'intrigue

Date : 2026-07-08
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06V prépare les contraintes nécessaires à de futures intrigues cohérentes sans créer d'intrigue jouable, sans écrire de vérité cachée et sans produire d'indice concret.

Le lot matérialise une gate de préparation issue de [`Coherence-intrigues.md`](Coherence-intrigues.md). Cette gate sert à bloquer toute création prématurée tant que les protections de cohérence, solvabilité, perspective et révélation ne sont pas explicitement satisfaites.

## Périmètre livré

- contrat `plot-preparation-gate/1`;
- checklist structurée des critères obligatoires avant un futur contrat de proposition d'intrigue;
- références documentaires vers :
  - `Coherence-intrigues.md`;
  - `Creations-dynamiques.md`;
  - `Pipeline-et-contrats-IA.md`;
  - feuille de route narration alors active, désormais conservée dans
    l'historique Git;
- liste des validations futures requises :
  - `coherence_critic`;
  - `secret_projection_filter`;
  - `two_independent_clue_paths`;
  - `causal_timeline_checker`;
  - `actor_perspective_checker`;
  - `scene_reveal_gate`;
- blocage explicite de la création runtime d'intrigue en I-06V.

## Critères de gate

| Critère | Intention |
|---|---|
| `hidden_truth_placeholder` | Prévoir une vérité cachée opaque sans transporter son texte. |
| `narrative_commitments` | Identifier ce qui deviendrait persistant dès qu'un détail prépare une preuve ou une causalité. |
| `two_independent_clue_paths` | Exiger deux voies indépendantes pour chaque révélation indispensable. |
| `false_lead_refutation` | Toute fausse piste doit être réfutable par des faits accessibles. |
| `actor_perspective_boundaries` | Séparer vérité, connaissance, croyance, mensonge et secret par acteur. |
| `causal_timeline` | Préparer les contrôles de temps, accès, capacités, déplacements et objets. |
| `contradiction_policy` | Interdire le retcon silencieux. |
| `scene_reveal_gate` | Contrôler les révélations visibles avant affichage. |
| `no_runtime_plot_creation` | Maintenir la création d'intrigue fermée pendant I-06V. |

## Rejets couverts

| Cas | Décision attendue |
|---|---|
| Critère obligatoire absent | `PLOT_PREPARATION_INCOMPLETE` |
| Texte de vérité cachée fourni | `PLOT_SECRET_TEXT_FORBIDDEN` |
| Résumé d'intrigue jouable fourni | `PLOT_CONTENT_FORBIDDEN` |
| Indice concret fourni | `PLOT_CONTENT_FORBIDDEN` |
| Création runtime demandée | `PLOT_RUNTIME_CREATION_FORBIDDEN` |

## Preuves exécutables

| Preuve | Résultat attendu |
|---|---|
| `npm run narration-module:test:plot-preparation` | Valide la gate I-06V et les rejets de création prématurée. |
| `npm run narration-module:test:scene-ephemeral-creation` | Confirme que I-06U refuse encore indices, secrets et promotions durables. |
| `npm run narration-module:test:vertical-quality` | Confirme que la scène de référence reste stable. |
| `npm run narration-module:build` | Valide types et exports. |

## Limites assumées

- I-06V ne crée pas de graphe d'intrigue.
- I-06V ne choisit pas de vérité cachée.
- I-06V ne produit pas d'indice, de fausse piste, de coupable, de faction ou de PNJ d'intrigue.
- I-06V ne branche pas encore `coherence_critic` à un fournisseur IA.
- Le futur lot de création d'intrigue devra passer par un contrat dédié.

## Décision

I-06V est clos dans son périmètre si les preuves ci-dessus passent. La suite logique est I-06W : revue UX narration, sauf si une revue/commit des lots I-06U/I-06V est préférée avant de continuer.
