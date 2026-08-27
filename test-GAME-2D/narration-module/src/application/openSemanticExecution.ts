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
  informationNeed: NonNullable<AiOpenSemanticComponentV8["informationNeed"]> | null;
  commitment: AiOpenSemanticComponentV8["commitment"];
  conditions: string[];
  relationToPrevious: AiOpenSemanticComponentV8["relationToPrevious"];
  dependsOnComponentIds: string[];
  targetRefs: string[];
  capabilityId: string | null;
  suggestedDomain: AiOpenSemanticComponentV8["suggestedDomain"];
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

export interface OpenSemanticLegacyOwnerSelectionV1 {
  mode: "SINGLE_COMPONENT" | "LOCAL_SCENE_SEQUENCE" | "HOMOGENEOUS_DIALOGUE_SEQUENCE";
  steps: OpenSemanticExecutionStepV1[];
  ownerDomain: NarrativeRuntimeDomainV1;
  targetRefs: string[];
  executionPolicy: "SINGLE" | "ORDERED" | "ATOMIC";
}

/**
 * Limite explicite du pont V1 : une action unique reste routable comme avant.
 * Une composition peut aussi former un groupe propriétaire lorsqu'elle décrit
 * soit une approche suivie d'une communication, soit plusieurs actes de
 * dialogue homogènes vers un acteur unique. Le choix repose uniquement sur le
 * graphe sémantique, les capacités publiées et les références résolues.
 */
export function selectOpenSemanticLegacyOwnerStepsV1(input: {
  frame: AiOpenSemanticFrameV8;
  plan: OpenSemanticExecutionPlanV1;
}): OpenSemanticLegacyOwnerSelectionV1 | null {
  const blocking = input.plan.steps.filter(step => ![
    "ROUTABLE",
    "SKIPPED_NON_EXECUTABLE",
    "SKIPPED_SUPERSEDED",
    "AWAITING_ATOMIC_GROUP_OWNER"
  ].includes(step.disposition));
  if (blocking.length > 0) return null;
  const candidateSteps = input.plan.steps
    .filter(step => ["ROUTABLE", "AWAITING_ATOMIC_GROUP_OWNER"].includes(step.disposition))
    .sort((left, right) => left.order - right.order);
  const homogeneousDialogue = selectHomogeneousDialogueSequence({
    frame: input.frame,
    steps: candidateSteps
  });
  if (homogeneousDialogue !== null) return homogeneousDialogue;
  if (candidateSteps.some(step => step.disposition === "AWAITING_ATOMIC_GROUP_OWNER")) return null;

  const steps = candidateSteps;
  if (steps.length === 1) {
    const step = steps[0]!;
    if (step.requiredDomain === null) return null;
    return {
      mode: "SINGLE_COMPONENT",
      steps,
      ownerDomain: step.requiredDomain,
      targetRefs: [...step.targetRefs],
      executionPolicy: "SINGLE"
    };
  }
  if (input.frame.globalConditions.length > 0) return null;
  if (steps.length !== 2) return null;

  const [attention, communication] = steps;
  if (attention === undefined || communication === undefined) return null;
  const sameResolvedActor = attention.targetRefs.length === 1
    && communication.targetRefs.length === 1
    && attention.targetRefs[0] === communication.targetRefs[0]
    && /^(?:npc|actor):/u.test(attention.targetRefs[0] ?? "");
  const dependencyIsLocalAndOrdered = communication.relationToPrevious === "THEN"
    && communication.dependsOnComponentIds.every(componentId => componentId === attention.componentId);
  const components = steps.map(step =>
    input.frame.components.find(component => component.componentId === step.componentId)
  );
  const componentsAreCommitted = components.every(component =>
    component !== undefined
    && component.commitment === "committed"
    && component.conditions.length === 0
    && component.alternativeGroupId === null
    && component.simultaneousWithComponentIds.length === 0
    && component.supersedesComponentIds.length === 0
  );
  if (
    attention.requiredDomain !== "scene_resolution"
    || !["scene.visible-actor-approach", "scene.visible-actor-orientation"].includes(attention.capabilityId ?? "")
    || !["scene.visible-dialogue", "scene.visible-nonverbal-signal"].includes(communication.capabilityId ?? "")
    || (communication.capabilityId === "scene.visible-dialogue" && communication.requiredDomain !== "social")
    || (communication.capabilityId === "scene.visible-nonverbal-signal" && communication.requiredDomain !== "scene_resolution")
    || !sameResolvedActor
    || !dependencyIsLocalAndOrdered
    || !componentsAreCommitted
  ) return null;
  return {
    mode: "LOCAL_SCENE_SEQUENCE",
    steps,
    ownerDomain: communication.requiredDomain!,
    targetRefs: [communication.targetRefs[0]!],
    executionPolicy: "ORDERED"
  };
}

function selectHomogeneousDialogueSequence(input: {
  frame: AiOpenSemanticFrameV8;
  steps: OpenSemanticExecutionStepV1[];
}): OpenSemanticLegacyOwnerSelectionV1 | null {
  if (input.steps.length < 2 || input.frame.globalConditions.length > 0) return null;
  const componentById = new Map(
    input.frame.components.map(component => [component.componentId, component])
  );
  const selectedIds = new Set(input.steps.map(step => step.componentId));
  const actorRefs = [...new Set(input.steps.flatMap(step => step.targetRefs))];
  if (
    actorRefs.length !== 1
    || !/^(?:npc|actor):/u.test(actorRefs[0] ?? "")
  ) return null;
  const targetRef = actorRefs[0]!;
  const hasAtomicRelation = input.steps.some(step =>
    step.disposition === "AWAITING_ATOMIC_GROUP_OWNER"
  );
  const compatible = input.steps.every((step, index) => {
    const component = componentById.get(step.componentId);
    const earlierIds = new Set(input.steps.slice(0, index).map(entry => entry.componentId));
    return component !== undefined
      && step.capabilityId === "scene.visible-dialogue"
      && step.requiredDomain === "social"
      && step.targetRefs.every(ref => ref === targetRef)
      && component.dialogueAct !== null
      && component.dialogueAct !== undefined
      && component.commitment === "committed"
      && component.alternativeGroupId === null
      && component.supersedesComponentIds.length === 0
      && (index === 0
        ? component.relationToPrevious === "NONE"
        : hasAtomicRelation
          ? component.relationToPrevious === "SIMULTANEOUS"
          : ["NONE", "THEN", "CONDITION_RESULT"].includes(component.relationToPrevious))
      && component.simultaneousWithComponentIds.every(componentId =>
        hasAtomicRelation && selectedIds.has(componentId)
      )
      && component.dependsOnComponentIds.every(dependencyId =>
        selectedIds.has(dependencyId) && earlierIds.has(dependencyId)
      );
  });
  const atomicLinkIsComplete = !hasAtomicRelation || input.steps.every(step =>
    step.disposition === "AWAITING_ATOMIC_GROUP_OWNER"
  );
  return compatible && atomicLinkIsComplete
    ? {
        mode: "HOMOGENEOUS_DIALOGUE_SEQUENCE",
        steps: input.steps,
        ownerDomain: "social",
        targetRefs: [targetRef],
        executionPolicy: hasAtomicRelation ? "ATOMIC" : "ORDERED"
      }
    : null;
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
        const base = {
          schemaVersion: 1 as const,
          componentId: component.componentId,
          order: component.order,
          meaning: component.meaning,
          informationNeed: component.informationNeed === undefined || component.informationNeed === null
            ? null
            : structuredClone(component.informationNeed),
          commitment: component.commitment,
          conditions: [...component.conditions],
          relationToPrevious: component.relationToPrevious,
          dependsOnComponentIds: [...component.dependsOnComponentIds],
          targetRefs: component.mentionedTargets
            .map(target => target.proposedRef)
            .filter((ref): ref is string => ref !== null),
          capabilityId: capability?.capabilityId ?? null,
          suggestedDomain: component.suggestedDomain,
          requiredDomain: capability?.domain ?? null,
          noCommitBeforeOwnerValidation: true as const,
          noGameTimeBeforeOwnerValidation: true as const
        };
        const decision = decideDisposition({
          frame: input.frame,
          component,
          superseded,
          simultaneous,
          capability
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
    if (JSON.stringify(step.informationNeed) !== JSON.stringify(component.informationNeed ?? null)) issues.push(`component ${component.componentId} information need mismatch`);
    if (step.commitment !== component.commitment) issues.push(`component ${component.componentId} commitment mismatch`);
    if (JSON.stringify(step.conditions) !== JSON.stringify(component.conditions)) issues.push(`component ${component.componentId} conditions mismatch`);
    if (step.relationToPrevious !== component.relationToPrevious) issues.push(`component ${component.componentId} relation mismatch`);
    if (JSON.stringify(step.dependsOnComponentIds) !== JSON.stringify(component.dependsOnComponentIds)) issues.push(`component ${component.componentId} dependencies mismatch`);
    const expectedTargetRefs = component.mentionedTargets
      .map(target => target.proposedRef)
      .filter((ref): ref is string => ref !== null);
    if (JSON.stringify(step.targetRefs) !== JSON.stringify(expectedTargetRefs)) issues.push(`component ${component.componentId} targets mismatch`);
    if (step.suggestedDomain !== component.suggestedDomain) issues.push(`component ${component.componentId} suggested domain mismatch`);
    if (step.disposition === "ROUTABLE") {
      if (step.capabilityId === null || step.capabilityId !== component.suggestedCapabilityId) issues.push(`component ${component.componentId} capability mismatch`);
      if (step.requiredDomain === null) issues.push(`component ${component.componentId} owner domain missing`);
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
  const committedDialogueCarriesConditionsAsContent = component.commitment === "committed"
    && component.dialogueAct !== null
    && component.dialogueAct !== undefined
    && input.capability?.capabilityId === "scene.visible-dialogue";
  if (
    component.commitment === "conditional"
    || component.commitment === "unclear"
    || (component.conditions.length > 0 && !committedDialogueCarriesConditionsAsContent)
    || input.frame.globalConditions.length > 0
  ) {
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
