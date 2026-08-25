import type {
  AiOpenSemanticComponentV8,
  AiOpenSemanticFrameV8
} from "../ai/types";
import type { JsonObject } from "../core";
import type {
  InterpreterRuntimeContextV1,
  NarrativeRuntimeDomainV1
} from "./runtimeCapabilityRouting";

export const OPEN_SEMANTIC_EXECUTION_PLAN_CONTRACT_V1 =
  "open-semantic-execution-plan/1" as const;

export type OpenSemanticStepDispositionV1 =
  | "ROUTABLE"
  | "SKIPPED_NON_EXECUTABLE"
  | "SKIPPED_SUPERSEDED"
  | "AWAITING_CONDITION"
  | "AWAITING_PLAYER_CHOICE"
  | "AWAITING_ATOMIC_GROUP_OWNER"
  | "HANDOFF_ONLY"
  | "EXTERNAL_TRIGGER_REJECTED"
  | "UNDERSTOOD_UNSUPPORTED"
  | "NEEDS_CLARIFICATION";

export interface OpenSemanticExecutionStepV1 extends JsonObject {
  schemaVersion: 1;
  componentId: string;
  order: number;
  meaning: string;
  commitment: AiOpenSemanticComponentV8["commitment"];
  conditions: string[];
  relationToPrevious: AiOpenSemanticComponentV8["relationToPrevious"];
  dependsOnComponentIds: string[];
  targetRefs: string[];
  capabilityId: string | null;
  requiredDomain: NarrativeRuntimeDomainV1 | null;
  disposition: OpenSemanticStepDispositionV1;
  noCommitBeforeOwnerValidation: true;
  noGameTimeBeforeOwnerValidation: true;
  reason: string;
}

export interface OpenSemanticExecutionPlanV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof OPEN_SEMANTIC_EXECUTION_PLAN_CONTRACT_V1;
  understandingStatus: AiOpenSemanticFrameV8["understandingStatus"];
  overallMeaning: string;
  steps: OpenSemanticExecutionStepV1[];
  authority: "OWNER_PREFLIGHT_THEN_EXECUTE";
  rawInputAccess: "FORBIDDEN";
}

export interface OpenSemanticOwnerRequestV1 {
  schemaVersion: 1;
  operationId: string;
  idempotencyKey: string;
  component: AiOpenSemanticComponentV8;
  step: OpenSemanticExecutionStepV1;
}

export interface OpenSemanticOwnerPortV1 {
  ownerId: string;
  domain: NarrativeRuntimeDomainV1;
  capabilityIds: readonly string[];
  preflight(input: OpenSemanticOwnerRequestV1): Promise<
    | { status: "READY"; ownerStateFingerprint: string }
    | { status: "NEEDS_PLAYER_INPUT"; question: string }
    | { status: "REJECTED"; playerFacingReason: string }
  >;
  execute(input: OpenSemanticOwnerRequestV1 & {
    ownerStateFingerprint: string;
  }): Promise<
    | { status: "COMMITTED"; commitRef: string; playerFacingText: string }
    | { status: "NO_COMMIT"; resultRef: string; playerFacingText: string }
    | { status: "NEEDS_PLAYER_INPUT"; question: string }
    | { status: "REJECTED"; playerFacingReason: string }
  >;
}

export interface OpenSemanticExecutionReceiptV1 extends JsonObject {
  schemaVersion: 1;
  componentId: string;
  capabilityId: string;
  ownerId: string;
  status: "COMMITTED" | "NO_COMMIT";
  resultRef: string;
  playerFacingText: string;
}

export interface OpenSemanticExecutionRunV1 extends JsonObject {
  schemaVersion: 1;
  receipts: OpenSemanticExecutionReceiptV1[];
  stop: null | (JsonObject & {
    componentId: string;
    reason:
      | "PLAN_REQUIRES_PLAYER_INPUT"
      | "OWNER_MISSING"
      | "OWNER_NEEDS_PLAYER_INPUT"
      | "OWNER_REJECTED"
      | "DEPENDENCY_NOT_COMPLETED"
      | "PLAN_INVALID";
    playerFacingText: string;
  });
}

export function buildOpenSemanticExecutionPlanV1(input: {
  frame: AiOpenSemanticFrameV8;
  runtimeContext: InterpreterRuntimeContextV1;
}): OpenSemanticExecutionPlanV1 {
  const capabilities = new Map(
    input.runtimeContext.capabilities.map(capability => [
      capability.capabilityId,
      capability
    ])
  );
  const superseded = new Set(input.frame.components.flatMap(component =>
    component.supersedesComponentIds
  ));
  const simultaneous = new Set(input.frame.components.flatMap(component =>
    component.simultaneousWithComponentIds.length === 0
      ? []
      : [component.componentId, ...component.simultaneousWithComponentIds]
  ));

  return {
    schemaVersion: 1,
    contractVersion: OPEN_SEMANTIC_EXECUTION_PLAN_CONTRACT_V1,
    understandingStatus: input.frame.understandingStatus,
    overallMeaning: input.frame.overallMeaning,
    steps: [...input.frame.components]
      .sort((left, right) => left.order - right.order)
      .map(component => {
        const capability = component.suggestedCapabilityId === null
          ? null
          : capabilities.get(component.suggestedCapabilityId) ?? null;
        const domainMatches = capability !== null
          && component.suggestedDomain === capability.domain;
        const base = {
          schemaVersion: 1 as const,
          componentId: component.componentId,
          order: component.order,
          meaning: component.meaning,
          commitment: component.commitment,
          conditions: [...component.conditions],
          relationToPrevious: component.relationToPrevious,
          dependsOnComponentIds: [...component.dependsOnComponentIds],
          targetRefs: component.mentionedTargets
            .map(target => target.proposedRef)
            .filter((ref): ref is string => ref !== null),
          capabilityId: domainMatches ? capability.capabilityId : null,
          requiredDomain: domainMatches ? capability.domain : null,
          noCommitBeforeOwnerValidation: true as const,
          noGameTimeBeforeOwnerValidation: true as const
        };
        const decision = decideDisposition({
          frame: input.frame,
          component,
          superseded,
          simultaneous,
          capability: domainMatches ? capability : null
        });
        return { ...base, ...decision };
      }),
    authority: "OWNER_PREFLIGHT_THEN_EXECUTE",
    rawInputAccess: "FORBIDDEN"
  };
}

export async function executeOpenSemanticPlanV1(input: {
  operationId: string;
  frame: AiOpenSemanticFrameV8;
  plan: OpenSemanticExecutionPlanV1;
  owners: readonly OpenSemanticOwnerPortV1[];
  previousReceipts?: readonly OpenSemanticExecutionReceiptV1[];
}): Promise<OpenSemanticExecutionRunV1> {
  const receipts = [...(input.previousReceipts ?? [])];
  const planValidation = validateOpenSemanticExecutionPlanV1({
    frame: input.frame,
    plan: input.plan
  });
  if (!planValidation.ok) {
    return stopped(
      receipts,
      input.plan.steps[0]?.componentId ?? "open-semantic-plan",
      "PLAN_INVALID",
      "Le plan d'exécution ne correspond plus au sens compris; aucune étape n'est exécutée."
    );
  }
  if (!validPreviousReceipts(input.plan, input.owners, receipts)) {
    return stopped(
      [],
      input.plan.steps[0]?.componentId ?? "open-semantic-plan",
      "PLAN_INVALID",
      "Les reçus d'exécution ne correspondent pas au plan; aucune étape n'est exécutée."
    );
  }
  const completed = new Set(receipts.map(receipt => receipt.componentId));
  const componentById = new Map(input.frame.components.map(component => [
    component.componentId,
    component
  ]));

  for (const step of input.plan.steps) {
    if (completed.has(step.componentId)) continue;
    if (step.disposition === "SKIPPED_NON_EXECUTABLE" ||
      step.disposition === "SKIPPED_SUPERSEDED") continue;
    if (step.disposition !== "ROUTABLE") {
      return stopped(receipts, step.componentId, "PLAN_REQUIRES_PLAYER_INPUT", step.reason);
    }
    if (step.dependsOnComponentIds.some(componentId => !completed.has(componentId))) {
      return stopped(
        receipts,
        step.componentId,
        "DEPENDENCY_NOT_COMPLETED",
        "Une étape précédente doit être résolue avant de poursuivre."
      );
    }
    const component = componentById.get(step.componentId);
    if (component === undefined || step.capabilityId === null || step.requiredDomain === null) {
      return stopped(receipts, step.componentId, "OWNER_MISSING", "Cette action n'a pas encore de propriétaire exécutable.");
    }
    const owner = input.owners.find(candidate =>
      candidate.domain === step.requiredDomain
      && candidate.capabilityIds.includes(step.capabilityId!)
    );
    if (owner === undefined) {
      return stopped(receipts, step.componentId, "OWNER_MISSING", "Cette action n'a pas encore de propriétaire exécutable.");
    }
    const request: OpenSemanticOwnerRequestV1 = {
      schemaVersion: 1,
      operationId: input.operationId,
      idempotencyKey: `${input.operationId}:component:${step.componentId}`,
      component,
      step
    };
    const preflight = await owner.preflight(request);
    if (preflight.status === "NEEDS_PLAYER_INPUT") {
      return stopped(receipts, step.componentId, "OWNER_NEEDS_PLAYER_INPUT", preflight.question);
    }
    if (preflight.status === "REJECTED") {
      return stopped(receipts, step.componentId, "OWNER_REJECTED", preflight.playerFacingReason);
    }
    const outcome = await owner.execute({
      ...request,
      ownerStateFingerprint: preflight.ownerStateFingerprint
    });
    if (outcome.status === "NEEDS_PLAYER_INPUT") {
      return stopped(receipts, step.componentId, "OWNER_NEEDS_PLAYER_INPUT", outcome.question);
    }
    if (outcome.status === "REJECTED") {
      return stopped(receipts, step.componentId, "OWNER_REJECTED", outcome.playerFacingReason);
    }
    const receipt: OpenSemanticExecutionReceiptV1 = {
      schemaVersion: 1,
      componentId: step.componentId,
      capabilityId: step.capabilityId,
      ownerId: owner.ownerId,
      status: outcome.status,
      resultRef: outcome.status === "COMMITTED" ? outcome.commitRef : outcome.resultRef,
      playerFacingText: outcome.playerFacingText
    };
    receipts.push(receipt);
    completed.add(step.componentId);
  }
  return { schemaVersion: 1, receipts, stop: null };
}

export function validateOpenSemanticExecutionPlanV1(input: {
  frame: AiOpenSemanticFrameV8;
  plan: OpenSemanticExecutionPlanV1;
}): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (input.plan.contractVersion !== OPEN_SEMANTIC_EXECUTION_PLAN_CONTRACT_V1) issues.push("contractVersion mismatch");
  if (input.plan.understandingStatus !== input.frame.understandingStatus) issues.push("understandingStatus mismatch");
  if (input.plan.overallMeaning !== input.frame.overallMeaning) issues.push("overallMeaning mismatch");
  if (input.plan.rawInputAccess !== "FORBIDDEN") issues.push("raw input access must be forbidden");
  if (input.plan.steps.length !== input.frame.components.length) issues.push("component count mismatch");
  const ordered = [...input.frame.components].sort((left, right) => left.order - right.order);
  ordered.forEach((component, index) => {
    const step = input.plan.steps[index];
    if (step === undefined) return;
    if (step.componentId !== component.componentId) issues.push(`component ${index} identity mismatch`);
    if (step.order !== component.order) issues.push(`component ${component.componentId} order mismatch`);
    if (step.meaning !== component.meaning) issues.push(`component ${component.componentId} meaning mismatch`);
    if (step.commitment !== component.commitment) issues.push(`component ${component.componentId} commitment mismatch`);
    if (JSON.stringify(step.conditions) !== JSON.stringify(component.conditions)) issues.push(`component ${component.componentId} conditions mismatch`);
    if (step.relationToPrevious !== component.relationToPrevious) issues.push(`component ${component.componentId} relation mismatch`);
    if (JSON.stringify(step.dependsOnComponentIds) !== JSON.stringify(component.dependsOnComponentIds)) issues.push(`component ${component.componentId} dependencies mismatch`);
    const expectedTargetRefs = component.mentionedTargets
      .map(target => target.proposedRef)
      .filter((ref): ref is string => ref !== null);
    if (JSON.stringify(step.targetRefs) !== JSON.stringify(expectedTargetRefs)) issues.push(`component ${component.componentId} targets mismatch`);
    if (step.disposition === "ROUTABLE") {
      if (step.capabilityId === null || step.capabilityId !== component.suggestedCapabilityId) issues.push(`component ${component.componentId} capability mismatch`);
      if (step.requiredDomain === null || step.requiredDomain !== component.suggestedDomain) issues.push(`component ${component.componentId} domain mismatch`);
    }
    if (!step.noCommitBeforeOwnerValidation || !step.noGameTimeBeforeOwnerValidation) issues.push(`component ${component.componentId} exceeds preflight authority`);
  });
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function decideDisposition(input: {
  frame: AiOpenSemanticFrameV8;
  component: AiOpenSemanticComponentV8;
  superseded: ReadonlySet<string>;
  simultaneous: ReadonlySet<string>;
  capability: InterpreterRuntimeContextV1["capabilities"][number] | null;
}): Pick<OpenSemanticExecutionStepV1, "disposition" | "reason"> {
  const component = input.component;
  if (input.frame.understandingStatus === "NEEDS_CLARIFICATION") {
    return { disposition: "NEEDS_CLARIFICATION", reason: input.frame.clarificationQuestion ?? "Le sens doit être clarifié avant toute exécution." };
  }
  if (input.superseded.has(component.componentId)) {
    return { disposition: "SKIPPED_SUPERSEDED", reason: "La composante a été explicitement remplacée par une correction ultérieure." };
  }
  if (component.negated || component.quoted || component.commitment === "none" || component.commitment === "hypothetical") {
    return { disposition: "SKIPPED_NON_EXECUTABLE", reason: "La composante est comprise mais ne constitue pas une action engagée." };
  }
  if (component.alternativeGroupId !== null || component.relationToPrevious === "ALTERNATIVE") {
    return { disposition: "AWAITING_PLAYER_CHOICE", reason: "Le joueur doit choisir entre les alternatives avant toute exécution." };
  }
  if (component.commitment === "conditional" || component.commitment === "unclear" || component.conditions.length > 0 || input.frame.globalConditions.length > 0) {
    return { disposition: "AWAITING_CONDITION", reason: "La condition reste sémantique et doit être établie par une décision explicite avant exécution." };
  }
  if (input.simultaneous.has(component.componentId) || component.relationToPrevious === "SIMULTANEOUS") {
    return { disposition: "AWAITING_ATOMIC_GROUP_OWNER", reason: "Une simultanéité exige un propriétaire capable de valider le groupe atomiquement." };
  }
  if (input.capability === null) {
    return { disposition: "UNDERSTOOD_UNSUPPORTED", reason: "Aucun identifiant exact de capacité publique ne correspond à la suggestion OpenAI." };
  }
  if (input.capability.availability === "HANDOFF_ONLY") {
    return { disposition: "HANDOFF_ONLY", reason: "La capacité conserve le sens mais ne peut pas être exécutée depuis ce runtime." };
  }
  if (input.capability.availability === "EXTERNAL_TRIGGER_ONLY") {
    return { disposition: "EXTERNAL_TRIGGER_REJECTED", reason: "Cette capacité exige une cause propriétaire et ne peut pas partir de la saisie joueur." };
  }
  return { disposition: "ROUTABLE", reason: "La capacité publique exacte est disponible; son propriétaire doit maintenant vérifier ses préconditions." };
}

function stopped(
  receipts: OpenSemanticExecutionReceiptV1[],
  componentId: string,
  reason: NonNullable<OpenSemanticExecutionRunV1["stop"]>["reason"],
  playerFacingText: string
): OpenSemanticExecutionRunV1 {
  return {
    schemaVersion: 1,
    receipts,
    stop: { componentId, reason, playerFacingText }
  };
}

function validPreviousReceipts(
  plan: OpenSemanticExecutionPlanV1,
  owners: readonly OpenSemanticOwnerPortV1[],
  receipts: readonly OpenSemanticExecutionReceiptV1[]
): boolean {
  const byComponent = new Map(receipts.map(receipt => [receipt.componentId, receipt]));
  if (byComponent.size !== receipts.length) return false;
  let missingRoutableSeen = false;
  for (const step of plan.steps) {
    if (step.disposition !== "ROUTABLE") continue;
    const receipt = byComponent.get(step.componentId);
    if (receipt === undefined) {
      missingRoutableSeen = true;
      continue;
    }
    if (missingRoutableSeen || step.capabilityId === null) return false;
    if (receipt.capabilityId !== step.capabilityId || receipt.resultRef.trim().length === 0) return false;
    const owner = owners.find(candidate =>
      candidate.ownerId === receipt.ownerId
      && candidate.domain === step.requiredDomain
      && candidate.capabilityIds.includes(step.capabilityId!)
    );
    if (owner === undefined) return false;
  }
  return receipts.every(receipt => plan.steps.some(step =>
    step.componentId === receipt.componentId && step.disposition === "ROUTABLE"
  ));
}
