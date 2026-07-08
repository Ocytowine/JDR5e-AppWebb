import type { JsonObject } from "../core";

export const PLOT_PREPARATION_CONTRACT_VERSION_V1 = "plot-preparation-gate/1" as const;

export type PlotPreparationCriterionIdV1 =
  | "hidden_truth_placeholder"
  | "narrative_commitments"
  | "two_independent_clue_paths"
  | "false_lead_refutation"
  | "actor_perspective_boundaries"
  | "causal_timeline"
  | "contradiction_policy"
  | "scene_reveal_gate"
  | "no_runtime_plot_creation";

export interface PlotPreparationCriterionV1 extends JsonObject {
  schemaVersion: 1;
  criterionId: PlotPreparationCriterionIdV1;
  label: string;
  requirement: string;
  requiredBeforePlotCreation: true;
  version: 1;
}

export interface PlotPreparationGateV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLOT_PREPARATION_CONTRACT_VERSION_V1;
  gateId: string;
  sourceDocRefs: string[];
  criteria: PlotPreparationCriterionV1[];
  forbiddenAtThisStage: string[];
  requiredValidatorRefs: string[];
  version: 1;
}

export interface PlotPreparationReadinessInputV1 extends JsonObject {
  schemaVersion: 1;
  gate: PlotPreparationGateV1;
  satisfiedCriteria: PlotPreparationCriterionIdV1[];
  proposedSecretText: string | null;
  proposedPlotSummary: string | null;
  proposedClueTexts: string[];
  requestedRuntimeCreation: boolean;
  version: 1;
}

export type PlotPreparationReadinessResultV1 =
  | {
    ok: true;
    decision: "READY_FOR_FUTURE_PLOT_PROPOSAL_CONTRACT";
    missingCriteria: [];
    version: 1;
  }
  | {
    ok: false;
    decision: "BLOCK_PLOT_CREATION";
    code:
      | "PLOT_PREPARATION_INCOMPLETE"
      | "PLOT_SECRET_TEXT_FORBIDDEN"
      | "PLOT_CONTENT_FORBIDDEN"
      | "PLOT_RUNTIME_CREATION_FORBIDDEN";
    missingCriteria: PlotPreparationCriterionIdV1[];
    issues: string[];
    version: 1;
  };

export function buildPlotPreparationGateV1(): PlotPreparationGateV1 {
  return {
    schemaVersion: 1,
    contractVersion: PLOT_PREPARATION_CONTRACT_VERSION_V1,
    gateId: "i06v-plot-preparation",
    sourceDocRefs: [
      "docs/Coherence-intrigues.md",
      "docs/Creations-dynamiques.md",
      "docs/Pipeline-et-contrats-IA.md",
      "docs/Suivi-prochains-lots-narration.md#I-06V"
    ],
    criteria: [{
      schemaVersion: 1,
      criterionId: "hidden_truth_placeholder",
      label: "Vérité cachée opaque",
      requirement: "Prévoir un identifiant de vérité cachée sans transporter le texte du secret vers les paquets visibles.",
      requiredBeforePlotCreation: true,
      version: 1
    }, {
      schemaVersion: 1,
      criterionId: "narrative_commitments",
      label: "Engagements narratifs",
      requirement: "Lister les détails qui deviendraient persistants dès qu'ils préparent une preuve, une révélation ou une causalité.",
      requiredBeforePlotCreation: true,
      version: 1
    }, {
      schemaVersion: 1,
      criterionId: "two_independent_clue_paths",
      label: "Deux voies d'indice indépendantes",
      requirement: "Exiger au moins deux voies d'accès indépendantes pour chaque révélation indispensable.",
      requiredBeforePlotCreation: true,
      version: 1
    }, {
      schemaVersion: 1,
      criterionId: "false_lead_refutation",
      label: "Fausse piste réfutable",
      requirement: "Toute fausse piste doit posséder des conditions de réfutation accessibles dans le graphe.",
      requiredBeforePlotCreation: true,
      version: 1
    }, {
      schemaVersion: 1,
      criterionId: "actor_perspective_boundaries",
      label: "Perspectives d'acteurs",
      requirement: "Séparer vérité, connaissance, croyance, mensonge et secret par acteur.",
      requiredBeforePlotCreation: true,
      version: 1
    }, {
      schemaVersion: 1,
      criterionId: "causal_timeline",
      label: "Chronologie causale",
      requirement: "Préparer les contrôles d'ordre des causes, accès, déplacements, capacités et objets.",
      requiredBeforePlotCreation: true,
      version: 1
    }, {
      schemaVersion: 1,
      criterionId: "contradiction_policy",
      label: "Politique de contradiction",
      requirement: "Interdire le retcon silencieux et distinguer erreur, mensonge, croyance et information incomplète.",
      requiredBeforePlotCreation: true,
      version: 1
    }, {
      schemaVersion: 1,
      criterionId: "scene_reveal_gate",
      label: "Gate de révélation par scène",
      requirement: "Avant affichage, contrôler que seuls les indices ou révélations autorisés pour la scène sont visibles.",
      requiredBeforePlotCreation: true,
      version: 1
    }, {
      schemaVersion: 1,
      criterionId: "no_runtime_plot_creation",
      label: "Pas de création d'intrigue en I-06V",
      requirement: "Maintenir la création runtime d'intrigue fermée jusqu'à un contrat dédié.",
      requiredBeforePlotCreation: true,
      version: 1
    }],
    forbiddenAtThisStage: [
      "texte de vérité cachée",
      "résumé d'intrigue jouable",
      "indice concret",
      "fausse piste concrète",
      "PNJ ou faction d'intrigue",
      "commit d'engagement d'intrigue",
      "création runtime d'intrigue"
    ],
    requiredValidatorRefs: [
      "coherence_critic",
      "secret_projection_filter",
      "two_independent_clue_paths",
      "causal_timeline_checker",
      "actor_perspective_checker",
      "scene_reveal_gate"
    ],
    version: 1
  };
}

export function evaluatePlotPreparationReadinessV1(input: PlotPreparationReadinessInputV1): PlotPreparationReadinessResultV1 {
  const requiredCriteria = input.gate.criteria.map(criterion => criterion.criterionId);
  const satisfied = new Set(input.satisfiedCriteria);
  const missingCriteria = requiredCriteria.filter(criterionId => !satisfied.has(criterionId));

  if (input.requestedRuntimeCreation) {
    return {
      ok: false,
      decision: "BLOCK_PLOT_CREATION",
      code: "PLOT_RUNTIME_CREATION_FORBIDDEN",
      missingCriteria,
      issues: ["I-06V prepares plot constraints only; runtime plot creation is forbidden."],
      version: 1
    };
  }

  if (input.proposedSecretText !== null && input.proposedSecretText.trim().length > 0) {
    return {
      ok: false,
      decision: "BLOCK_PLOT_CREATION",
      code: "PLOT_SECRET_TEXT_FORBIDDEN",
      missingCriteria,
      issues: ["I-06V must not carry hidden truth text or secret content."],
      version: 1
    };
  }

  if (
    (input.proposedPlotSummary !== null && input.proposedPlotSummary.trim().length > 0) ||
    input.proposedClueTexts.some(clue => clue.trim().length > 0)
  ) {
    return {
      ok: false,
      decision: "BLOCK_PLOT_CREATION",
      code: "PLOT_CONTENT_FORBIDDEN",
      missingCriteria,
      issues: ["I-06V must not create playable plot summaries, concrete clues or false leads."],
      version: 1
    };
  }

  if (missingCriteria.length > 0) {
    return {
      ok: false,
      decision: "BLOCK_PLOT_CREATION",
      code: "PLOT_PREPARATION_INCOMPLETE",
      missingCriteria,
      issues: [`Missing criteria: ${missingCriteria.join(", ")}`],
      version: 1
    };
  }

  return {
    ok: true,
    decision: "READY_FOR_FUTURE_PLOT_PROPOSAL_CONTRACT",
    missingCriteria: [],
    version: 1
  };
}
