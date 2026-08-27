import type { JsonObject } from "../core";
import type { NarrativeTurnControllerOutputV1 } from "./NarrativeTurnController";
import type { PlayableSceneStateV1 } from "./playableScene";

export const LOCAL_INTERACTION_FOCUS_CONTRACT_V1 =
  "local-interaction-focus/1" as const;

export type LocalInteractionFocusClosureReasonV1 =
  | "PLAYER_LEFT"
  | "TARGET_CHANGED"
  | "TARGET_LEFT"
  | "SCENE_CHANGED"
  | "PROCESS_INTERRUPTION"
  | "TACTICAL_HANDOFF";

export interface LocalInteractionFocusV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof LOCAL_INTERACTION_FOCUS_CONTRACT_V1;
  sceneId: string;
  sceneVersion: number;
  targetRef: string;
  targetDisplayName: string;
  mode: "DIALOGUE" | "LOCAL_ATTENTION";
  publicSummary: string;
  openedByOperationId: string;
  lastConfirmedOperationId: string;
  status: "ACTIVE" | "CLOSED";
  closureReason: LocalInteractionFocusClosureReasonV1 | null;
}

export interface LocalInteractionFocusProjectionV1 {
  current: LocalInteractionFocusV1 | null;
  closed: LocalInteractionFocusV1 | null;
}

export function projectLocalInteractionFocusV1(input: {
  previous: LocalInteractionFocusV1 | null;
  output: NarrativeTurnControllerOutputV1;
  activeScene: PlayableSceneStateV1;
}): LocalInteractionFocusProjectionV1 {
  const previous = reconcileLocalInteractionFocusV1(input.previous, input.activeScene);
  const closedByBoundary = closureReasonForOutput(input.output);
  if (closedByBoundary !== null) {
    const closed = previous?.status === "ACTIVE"
      ? closeFocus(previous, closedByBoundary)
      : null;
    return { current: closed, closed };
  }
  const candidate = confirmedInteractionCandidate(input.output, input.activeScene);
  if (candidate === null) return { current: previous, closed: null };
  if (previous?.status === "ACTIVE" && previous.targetRef !== candidate.targetRef) {
    return {
      current: candidate,
      closed: closeFocus(previous, "TARGET_CHANGED")
    };
  }
  if (previous?.status === "ACTIVE") {
    return {
      current: {
        ...previous,
        sceneVersion: input.activeScene.version,
        targetDisplayName: candidate.targetDisplayName,
        mode: previous.mode === "DIALOGUE" || candidate.mode === "DIALOGUE"
          ? "DIALOGUE"
          : "LOCAL_ATTENTION",
        publicSummary: candidate.publicSummary,
        lastConfirmedOperationId: input.output.operationId,
        status: "ACTIVE",
        closureReason: null
      },
      closed: null
    };
  }
  return { current: candidate, closed: null };
}

export function reconcileLocalInteractionFocusV1(
  focus: LocalInteractionFocusV1 | null,
  scene: PlayableSceneStateV1
): LocalInteractionFocusV1 | null {
  if (focus === null || focus.status === "CLOSED") return focus;
  if (focus.sceneId !== scene.sceneId) return closeFocus(focus, "SCENE_CHANGED");
  const actor = visibleActor(scene, focus.targetRef);
  if (actor === null) return closeFocus(focus, "TARGET_LEFT");
  return {
    ...focus,
    sceneVersion: scene.version,
    targetDisplayName: actor.displayName
  };
}

export function validateLocalInteractionFocusV1(value: unknown): string[] {
  if (typeof value !== "object" || value === null) return ["focus must be an object"];
  const focus = value as Partial<LocalInteractionFocusV1>;
  const issues: string[] = [];
  if (focus.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (focus.contractVersion !== LOCAL_INTERACTION_FOCUS_CONTRACT_V1) issues.push("contractVersion mismatch");
  for (const key of ["sceneId", "targetRef", "targetDisplayName", "publicSummary", "openedByOperationId", "lastConfirmedOperationId"] as const) {
    if (typeof focus[key] !== "string" || focus[key]?.trim().length === 0) issues.push(`${key} is required`);
  }
  if (!Number.isInteger(focus.sceneVersion) || (focus.sceneVersion ?? -1) < 0) issues.push("sceneVersion must be a non-negative integer");
  if (focus.mode !== "DIALOGUE" && focus.mode !== "LOCAL_ATTENTION") issues.push("mode is invalid");
  if (focus.status !== "ACTIVE" && focus.status !== "CLOSED") issues.push("status is invalid");
  if (focus.status === "ACTIVE" && focus.closureReason !== null) issues.push("active focus cannot have a closure reason");
  if (focus.status === "CLOSED" && focus.closureReason === null) issues.push("closed focus requires a closure reason");
  return issues;
}

function confirmedInteractionCandidate(
  output: NarrativeTurnControllerOutputV1,
  scene: PlayableSceneStateV1
): LocalInteractionFocusV1 | null {
  if (output.noCommit || output.suspendedIntent !== null || output.resolution.resultKind !== "COMMIT_APPLIED") return null;
  const plan = output.interpretation.openSemanticRuntime?.executionPlan;
  const frame = output.interpretation.openSemanticFrame;
  const steps = plan?.steps.filter(step => step.disposition === "ROUTABLE") ?? [];
  const dialogue = steps.find(step => step.capabilityId === "scene.visible-dialogue");
  const approach = steps.find(step => step.capabilityId === "scene.visible-actor-approach");
  const selected = dialogue ?? approach;
  const legacyKind = output.resolution.interpretation.semanticIntent.kind;
  const target = selected?.targetRefs.length === 1
    ? selected.targetRefs[0] ?? null
    : output.resolution.interpretation.referentResolution?.resolvedTarget?.ref
      ?? output.resolution.interpretation.semanticIntent.target?.ref
      ?? null;
  const mode = dialogue !== undefined || legacyKind === "address_visible_actor"
    ? "DIALOGUE"
    : approach !== undefined || legacyKind === "move_near_visible_actor"
      ? "LOCAL_ATTENTION"
      : null;
  if (target === null || mode === null) return null;
  const actor = visibleActor(scene, target);
  if (actor === null) return null;
  const componentMeaning = selected === undefined
    ? output.resolution.interpretation.semanticIntent.playerGoal
    : frame?.components.find(component => component.componentId === selected.componentId)?.meaning
      ?? selected.meaning;
  return {
    schemaVersion: 1,
    contractVersion: LOCAL_INTERACTION_FOCUS_CONTRACT_V1,
    sceneId: scene.sceneId,
    sceneVersion: scene.version,
    targetRef: target,
    targetDisplayName: actor.displayName,
    mode,
    publicSummary: componentMeaning.trim().slice(0, 400),
    openedByOperationId: output.operationId,
    lastConfirmedOperationId: output.operationId,
    status: "ACTIVE",
    closureReason: null
  };
}

function closureReasonForOutput(
  output: NarrativeTurnControllerOutputV1
): LocalInteractionFocusClosureReasonV1 | null {
  if (output.resolution.handoff?.target === "TACTICAL") return "TACTICAL_HANDOFF";
  if (output.sceneArrival !== null) return "SCENE_CHANGED";
  const executedCapabilities = output.interpretation.openSemanticRuntime?.executionPlan.steps
    .filter(step => step.disposition === "ROUTABLE")
    .map(step => step.capabilityId) ?? [];
  if (!output.noCommit && executedCapabilities.some(capabilityId => capabilityId === "world.scene-transition")) {
    return "PLAYER_LEFT";
  }
  if (!output.noCommit && executedCapabilities.some(capabilityId => capabilityId === "rest.process")) {
    return "PROCESS_INTERRUPTION";
  }
  if (output.interpretation.semanticIntent.composition?.orderedComponents
    .some(component => component.kind === "REPOSITION_AWAY")) return "PLAYER_LEFT";
  return null;
}

function closeFocus(
  focus: LocalInteractionFocusV1,
  closureReason: LocalInteractionFocusClosureReasonV1
): LocalInteractionFocusV1 {
  return { ...focus, status: "CLOSED", closureReason };
}

function visibleActor(
  scene: PlayableSceneStateV1,
  targetRef: string
): { displayName: string } | null {
  const canonicalTarget = canonicalActorRef(targetRef);
  const actor = [...scene.presentNpc, ...scene.ambientPopulation]
    .find(candidate => canonicalActorRef(candidate.actorId) === canonicalTarget);
  return actor === undefined ? null : { displayName: actor.displayName };
}

function canonicalActorRef(value: string): string {
  return value.replace(/^(?:npc:|actor:)/u, "");
}
