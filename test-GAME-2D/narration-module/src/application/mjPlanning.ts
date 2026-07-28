import { computeJsonFingerprint, type JsonObject } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type {
  AiCallRequestV1,
  AiIncidentRecordV1,
  AiModelRouteV1,
  AiRetryPolicyV1,
  AiRoleOutputEnvelopeV1,
  DomainCommandProposalV1,
  MjPlannerPayloadV1,
  SceneBeatProposalV1
} from "../ai/types";
import { isNarrativeRuntimeDecisionV1, isNarrativeSemanticIntentV1, type NarrativeIntentInterpretationV1 } from "./intentClarification";
import type { NarrativeDomainCommandV1 } from "./domainCommands";

export const MJ_PLANNER_CONTRACT_VERSION_V1 = "mj-planner/1" as const;

export interface MjPlannerConfigV1 {
  provider: ContractAiProviderV1;
  route: AiModelRouteV1;
  retryPolicy: AiRetryPolicyV1;
}

export interface MjPlanningFailureV1 extends JsonObject {
  schemaVersion: 1;
  stage: "MJ_PLANNING";
  role: "mj_planner";
  status: "FAILED";
  rawInput: string;
  issues: string[];
  noCommit: true;
  noGameTime: true;
}

export interface MjPlanningResultV1 {
  schemaVersion: 1;
  contractVersion: typeof MJ_PLANNER_CONTRACT_VERSION_V1;
  calledPlanner: boolean;
  plan: (MjPlannerPayloadV1 & JsonObject) | null;
  acceptedOutput: AiRoleOutputEnvelopeV1<MjPlannerPayloadV1> | null;
  planningFailure: MjPlanningFailureV1 | null;
  incidents: AiIncidentRecordV1[];
  safetyNotes: string[];
}

export class LocalMjPlannerProviderV1 implements ContractAiProviderV1 {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    const task = request.input.task as { rawInput?: unknown; interpretation?: unknown };
    const rawInput = typeof task.rawInput === "string" ? task.rawInput : "";
    const interpretation = isNarrativeIntentInterpretation(task.interpretation)
      ? task.interpretation
      : null;
    return {
      schemaVersion: 1,
      contractVersion: request.contractVersion,
      outputId: `output:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "OK",
      payload: buildLocalMjPlanPayload(rawInput, interpretation),
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<MjPlannerPayloadV1>;
  }
}

export function createDefaultMjPlannerConfigV1(): MjPlannerConfigV1 {
  return {
    provider: new LocalMjPlannerProviderV1(),
    route: {
      schemaVersion: 1,
      routeId: "i06zh-local-mj-planner",
      role: "mj_planner",
      providerKind: "FAKE_CONTRACT",
      providerId: "local-i06zh",
      modelId: "local-i06zh-mj-planner-fixture",
      modelConfigVersion: "i06zh",
      certified: true,
      allowedContractVersions: [MJ_PLANNER_CONTRACT_VERSION_V1],
      inputTokenLimit: 2_000,
      outputTokenLimit: 1_000,
      timeoutMs: 1_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1,
      role: "mj_planner",
      maxTechnicalRetries: 0,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: false
    }
  };
}

export function shouldCallMjPlannerV1(interpretation: NarrativeIntentInterpretationV1): boolean {
  if (interpretation.semanticIntent.commitment === "none" || interpretation.semanticIntent.commitment === "hypothetical") return false;
  if (interpretation.requiresClarification) return false;
  return interpretation.semanticIntent.commitment === "committed" ||
    interpretation.semanticIntent.commitment === "conditional" ||
    interpretation.runtimeDecision.status === "UNSUPPORTED_DOMAIN";
}

export async function planNarrativeTurnWithMjV1(input: {
  campaignId: string;
  operationId: string;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  domainCommand?: NarrativeDomainCommandV1 | null;
  config: MjPlannerConfigV1;
}): Promise<MjPlanningResultV1> {
  if (!shouldCallMjPlannerV1(input.interpretation)) {
    return {
      schemaVersion: 1,
      contractVersion: MJ_PLANNER_CONTRACT_VERSION_V1,
      calledPlanner: false,
      plan: null,
      acceptedOutput: null,
      planningFailure: null,
      incidents: [],
      safetyNotes: ["mj_planner non appelé: intention sans progression narrative."]
    };
  }

  const request = await buildMjPlannerRequestV1(input);
  const run = await runAiPipelineCallV1({
    provider: input.config.provider,
    route: input.config.route,
    retryPolicy: input.config.retryPolicy,
    request
  });
  const acceptedOutput = run.acceptedOutput as AiRoleOutputEnvelopeV1<MjPlannerPayloadV1> | null;
  if (acceptedOutput !== null) {
    return {
      schemaVersion: 1,
      contractVersion: MJ_PLANNER_CONTRACT_VERSION_V1,
      calledPlanner: true,
      plan: acceptedOutput.payload as MjPlannerPayloadV1 & JsonObject,
      acceptedOutput,
      planningFailure: null,
      incidents: run.incidents,
      safetyNotes: ["Plan MJ structuré accepté sans autorité de commit."]
    };
  }

  const failure: MjPlanningFailureV1 = {
    schemaVersion: 1,
    stage: "MJ_PLANNING",
    role: "mj_planner",
    status: "FAILED",
    rawInput: input.rawInput,
    issues: run.validation.issues,
    noCommit: true,
    noGameTime: true
  };
  return {
    schemaVersion: 1,
    contractVersion: MJ_PLANNER_CONTRACT_VERSION_V1,
    calledPlanner: true,
    plan: buildLocalMjPlanPayload(input.rawInput, input.interpretation) as MjPlannerPayloadV1 & JsonObject,
    acceptedOutput: null,
    planningFailure: failure,
    incidents: run.incidents,
    safetyNotes: ["Échec mj_planner distant diagnostiqué; plan local déterministe sans autorité utilisé pour préserver l'orchestration."]
  };
}

export function buildLocalMjPlanPayload(
  rawInput: string,
  interpretation: NarrativeIntentInterpretationV1 | null
): MjPlannerPayloadV1 {
  const runtimeDecision = interpretation?.runtimeDecision ?? null;
  const requiredDomain = runtimeDecision?.requiredDomain ?? "scene_resolution";
  const runtimeStatus = runtimeDecision?.status ?? "SUPPORTED_BY_CURRENT_RUNTIME";
  const targetRef = interpretation?.referentResolution?.resolvedTarget?.ref ?? interpretation?.semanticIntent.target?.ref ?? null;
  const targetRefs = targetRef === null ? [] : [targetRef];
  const beats = buildSceneBeats(interpretation, runtimeStatus, requiredDomain);
  const commandProposal = buildCommandProposal(interpretation, requiredDomain, targetRefs);
  return {
    schemaVersion: 1,
    planId: `${interpretation?.intentId ?? "intent:unknown"}:mj-plan:1`,
    planningBasis: {
      intentId: interpretation?.intentId ?? "intent:unknown",
      semanticGoal: interpretation?.semanticIntent.playerGoal ?? rawInput.trim(),
      runtimeStatus,
      requiredDomain
    },
    sceneBeats: beats,
    commandProposals: commandProposal === null ? [] : [commandProposal],
    creationProposals: [],
    actorAssignments: buildActorAssignments(interpretation, beats),
    revealPlan: {
      reveal: [],
      hint: [],
      withhold: [
        "secrets non révélés",
        "résultats de domaine non validés",
        "faits durables non committés"
      ]
    },
    timeAdvanceProposal: null,
    playerHandoff: buildPlayerHandoff(interpretation, runtimeStatus),
    riskFlags: [
      ...(interpretation?.safetyNotes ?? []),
      ...(runtimeStatus === "UNSUPPORTED_DOMAIN" ? ["domain_unopened"] : [])
    ],
    respectedCommitmentRefs: [
      `intent:${interpretation?.intentId ?? "unknown"}`,
      `commitment:${interpretation?.commitment ?? "unknown"}`
    ],
    forbiddenOutcomes: [
      "commit_direct",
      "narrate_unvalidated_success",
      "advance_time_without_domain",
      "reveal_secret",
      "create_persistent_fact"
    ]
  };
}

function buildSceneBeats(
  interpretation: NarrativeIntentInterpretationV1 | null,
  runtimeStatus: string,
  requiredDomain: string | null
): SceneBeatProposalV1[] {
  if (
    runtimeStatus !== "SUPPORTED_BY_CURRENT_RUNTIME" ||
    interpretation?.requiresClarification ||
    interpretation?.semanticIntent.kind !== "address_visible_actor"
  ) {
    return [buildSceneBeat(interpretation, runtimeStatus, requiredDomain)];
  }
  const components = interpretation.semanticIntent.composition?.orderedComponents ?? [];
  if (components.length === 0) return [buildSceneBeat(interpretation, runtimeStatus, requiredDomain)];
  const targetRef = interpretation.referentResolution?.resolvedTarget?.ref ?? interpretation.semanticIntent.target?.ref ?? null;
  const actorIds = targetRef === null ? [] : [targetRef];
  return components.map((component): SceneBeatProposalV1 => {
    if (component.kind === "LOCATE_VISIBLE_TARGET") {
      return {
        beatId: `beat:component:${component.order}:locate-visible-target`,
        kind: "LOCAL_ACTION_ATTEMPT",
        actorIds,
        stopCondition: "Confirmer seulement la présence déjà visible de la cible."
      };
    }
    if (component.kind === "APPROACH_TARGET") {
      return {
        beatId: `beat:component:${component.order}:approach-target`,
        kind: "LOCAL_ACTION_ATTEMPT",
        actorIds,
        stopCondition: "Mettre en scène l'approche sans créer de conséquence spatiale durable."
      };
    }
    if (component.kind === "SPEECH" || component.kind === "NONVERBAL_SIGNAL") {
      return {
        beatId: `beat:component:${component.order}:actor-reaction`,
        kind: "ACTOR_REACTION_EXPECTED",
        actorIds,
        stopCondition: "Rendre la main après une réaction bornée, sans résultat social mécanique."
      };
    }
    return {
      beatId: `beat:component:${component.order}:reposition-away`,
      kind: "LOCAL_ACTION_ATTEMPT",
      actorIds,
      stopCondition: "Mettre en scène l'éloignement et libérer le focus conversationnel."
    };
  });
}

async function buildMjPlannerRequestV1(input: {
  campaignId: string;
  operationId: string;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  domainCommand?: NarrativeDomainCommandV1 | null;
  config: MjPlannerConfigV1;
}): Promise<AiCallRequestV1> {
  const snapshotId = `${input.operationId}:snapshot:mj-plan`;
  const packId = `${input.operationId}:pack:mj-plan`;
  const roleContextPack = {
    schemaVersion: 1,
    role: "mj_planner",
    authority: "PLAN_ONLY",
    visibleScene: "reference-inn-rain-001",
    forbiddenAuthority: ["commit", "time", "inventory", "tactical", "rest", "durable_lore", "secret_reveal"]
  };
  const task = {
    rawInput: input.rawInput,
    interpretation: input.interpretation,
    domainCommand: input.domainCommand ?? null,
    requiredOutput: "structured_mj_plan_without_commit"
  };
  return {
    schemaVersion: 1,
    callId: `${input.operationId}:ai:mj-planner:call`,
    operationId: input.operationId,
    attemptId: `${input.operationId}:ai:mj-planner:attempt:1`,
    campaignId: input.campaignId,
    snapshotId,
    packId,
    role: input.config.route.role,
    contractVersion: MJ_PLANNER_CONTRACT_VERSION_V1,
    modelRouteId: input.config.route.routeId,
    contextFingerprint: await computeJsonFingerprint({ roleContextPack, task }) as `sha256:${string}`,
    idempotencyKey: `${input.operationId}:mj-planner`,
    input: {
      instructionsRef: "mj-planner/minimal/v1",
      roleContextPack,
      task
    },
    limits: {
      inputTokenBudget: 2_000,
      outputTokenBudget: 1_000,
      timeoutMs: 1_000
    }
  };
}

function buildSceneBeat(
  interpretation: NarrativeIntentInterpretationV1 | null,
  runtimeStatus: string,
  requiredDomain: string | null
): SceneBeatProposalV1 {
  if (runtimeStatus === "UNSUPPORTED_DOMAIN") {
    return {
      beatId: "beat:domain-blocked",
      kind: "DOMAIN_BLOCKED",
      actorIds: [],
      stopCondition: `Rendre la main: domaine ${requiredDomain ?? "inconnu"} requis avant tout résultat.`
    };
  }
  if (runtimeStatus === "NEEDS_CLARIFICATION" || interpretation?.requiresClarification) {
    return {
      beatId: "beat:clarification",
      kind: "CLARIFICATION",
      actorIds: [],
      stopCondition: "Rendre la main: clarification joueur requise."
    };
  }
  if (interpretation?.semanticIntent.kind === "address_visible_actor") {
    const targetRef = interpretation.referentResolution?.resolvedTarget?.ref ?? interpretation.semanticIntent.target?.ref ?? null;
    return {
      beatId: "beat:actor-reaction",
      kind: "ACTOR_REACTION_EXPECTED",
      actorIds: targetRef === null || targetRef === undefined ? [] : [targetRef],
      stopCondition: "Rendre la main après réaction bornée, sans résultat social mécanique."
    };
  }
  return {
    beatId: "beat:local-action",
    kind: "LOCAL_ACTION_ATTEMPT",
    actorIds: [],
    stopCondition: "Rendre la main après enregistrement borné ou handoff de domaine."
  };
}

function buildCommandProposal(
  interpretation: NarrativeIntentInterpretationV1 | null,
  requiredDomain: MjPlannerPayloadV1["planningBasis"]["requiredDomain"],
  targetRefs: string[]
): DomainCommandProposalV1 | null {
  if (interpretation === null || requiredDomain === null) return null;
  return {
    proposalId: `${interpretation.intentId}:proposal:1`,
    domain: requiredDomain,
    commandType: interpretation.semanticIntent.kind === "address_visible_actor"
      ? "speech.intent.record_or_request_actor_reaction"
      : interpretation.runtimeDecision.status === "UNSUPPORTED_DOMAIN"
        ? "domain.required_before_resolution"
        : "scene.local_intent.consider",
    targetRefs,
    payload: {
      intentType: interpretation.intentType,
      action: interpretation.action ?? null,
      semanticKind: interpretation.semanticIntent.kind,
      semanticGoal: interpretation.semanticIntent.playerGoal
    },
    commitAuthority: false
  };
}

function buildActorAssignments(
  interpretation: NarrativeIntentInterpretationV1 | null,
  beats: SceneBeatProposalV1[]
): MjPlannerPayloadV1["actorAssignments"] {
  const assignments: MjPlannerPayloadV1["actorAssignments"] = [{
    role: "scene_writer",
    actorId: null,
    reason: "Rédiger uniquement après validation de résolution ou arrêt runtime."
  }];
  const target = interpretation?.referentResolution?.resolvedTarget ?? interpretation?.semanticIntent.target ?? null;
  if (beats.some(beat => beat.kind === "ACTOR_REACTION_EXPECTED") && target?.kind === "npc") {
    assignments.unshift({
      role: "npc_performer",
      actorId: target.ref,
      reason: "Réaction PNJ potentielle, à valider séparément avant affichage."
    });
  }
  return assignments;
}

function buildPlayerHandoff(
  interpretation: NarrativeIntentInterpretationV1 | null,
  runtimeStatus: string
): MjPlannerPayloadV1["playerHandoff"] {
  if (runtimeStatus === "UNSUPPORTED_DOMAIN") {
    return {
      handoffKind: "END_TURN",
      reason: "Domaine propriétaire fermé: rendre la main sans résultat inventé."
    };
  }
  if (runtimeStatus === "NEEDS_CLARIFICATION" || interpretation?.requiresClarification) {
    return {
      handoffKind: "CLARIFY",
      reason: "Clarification nécessaire avant progression."
    };
  }
  return {
    handoffKind: "END_TURN",
    reason: "Plan minimal borné: une seule réponse/résolution puis restitution au joueur."
  };
}

function isNarrativeIntentInterpretation(value: unknown): value is NarrativeIntentInterpretationV1 {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Partial<NarrativeIntentInterpretationV1>).schemaVersion === 1 &&
    typeof (value as Partial<NarrativeIntentInterpretationV1>).intentId === "string" &&
    typeof (value as Partial<NarrativeIntentInterpretationV1>).intentType === "string" &&
    isNarrativeSemanticIntentV1((value as Partial<NarrativeIntentInterpretationV1>).semanticIntent) &&
    isNarrativeRuntimeDecisionV1((value as Partial<NarrativeIntentInterpretationV1>).runtimeDecision);
}
