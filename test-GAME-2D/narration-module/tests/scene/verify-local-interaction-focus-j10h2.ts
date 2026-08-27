import assert from "node:assert/strict";
import {
  LOCAL_INTERACTION_FOCUS_CONTRACT_V1,
  projectLocalInteractionFocusV1,
  reconcileLocalInteractionFocusV1,
  resolveActiveDialogueTargetV1,
  validateLocalInteractionFocusV1,
  type NarrativeTurnControllerOutputV1,
  type PlayableSceneStateV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
} from "../../src/application";

const scene = REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1;

const approached = projectLocalInteractionFocusV1({
  previous: null,
  output: output("approach", "scene.visible-actor-approach", "npc:npc-garde-blesse", "move_near_visible_actor"),
  activeScene: scene
});
assert.equal(approached.current?.mode, "LOCAL_ATTENTION");
assert.equal(approached.current?.targetDisplayName, "Garde blessé");
assert.deepEqual(validateLocalInteractionFocusV1(approached.current), []);

const clarification = projectLocalInteractionFocusV1({
  previous: approached.current,
  output: output("clarification", null, null, "unclear_intent", { noCommit: true, resultKind: "CLARIFICATION_REQUIRED" }),
  activeScene: scene
});
assert.deepEqual(clarification.current, approached.current, "une clarification ne doit pas modifier le focus");

const dialogue = projectLocalInteractionFocusV1({
  previous: approached.current,
  output: output("dialogue", "scene.visible-dialogue", "npc:npc-garde-blesse", "address_visible_actor"),
  activeScene: scene
});
assert.equal(dialogue.current?.mode, "DIALOGUE");
assert.equal(dialogue.current?.openedByOperationId, "operation:approach");
assert.equal(dialogue.current?.lastConfirmedOperationId, "operation:dialogue");

const switched = projectLocalInteractionFocusV1({
  previous: dialogue.current,
  output: output("switch", "scene.visible-dialogue", "npc:npc-serveuse-nerveuse", "address_visible_actor"),
  activeScene: scene
});
assert.equal(switched.current?.targetRef, "npc:npc-serveuse-nerveuse");
assert.equal(switched.closed?.targetRef, "npc:npc-garde-blesse");
assert.equal(switched.closed?.closureReason, "TARGET_CHANGED");

const refreshedScene = { ...scene, version: 2 } as unknown as PlayableSceneStateV1;
const refreshed = reconcileLocalInteractionFocusV1(switched.current, refreshedScene);
assert.equal(refreshed?.status, "ACTIVE");
assert.equal(refreshed?.sceneVersion, 2, "une nouvelle version conserve le focus si l'acteur reste visible");

const actorGone = reconcileLocalInteractionFocusV1(switched.current, {
  ...scene,
  presentNpc: scene.presentNpc.filter(actor => actor.actorId !== "npc-serveuse-nerveuse")
});
assert.equal(actorGone?.status, "CLOSED");
assert.equal(actorGone?.closureReason, "TARGET_LEFT");

const changedScene = reconcileLocalInteractionFocusV1(dialogue.current, {
  ...scene,
  sceneId: "scene:elsewhere"
});
assert.equal(changedScene?.closureReason, "SCENE_CHANGED");

const playerLeft = projectLocalInteractionFocusV1({
  previous: dialogue.current,
  output: output("leave", null, null, "nonverbal_signal", { repositionAway: true }),
  activeScene: scene
});
assert.equal(playerLeft.current?.status, "CLOSED");
assert.equal(playerLeft.current?.closureReason, "PLAYER_LEFT");
assert.equal(resolveActiveDialogueTargetV1(playerLeft.current, [{
  schemaVersion: 1,
  operationId: "operation:dialogue",
  semanticKind: "address_visible_actor",
  playerGoal: "Parler au garde",
  primaryTarget: { kind: "npc", ref: "npc:npc-garde-blesse", label: "Garde blessé" },
  topic: null,
  commitment: "committed",
  focusDisposition: "RETAIN"
}]), null, "un focus explicitement fermé ne doit pas être ressuscité depuis l'historique");

const tactical = projectLocalInteractionFocusV1({
  previous: dialogue.current,
  output: output("tactical", null, null, "unclear_intent", { tacticalHandoff: true }),
  activeScene: scene
});
assert.equal(tactical.current?.closureReason, "TACTICAL_HANDOFF");

const interruptedByRest = projectLocalInteractionFocusV1({
  previous: dialogue.current,
  output: output("rest", "rest.process", null, "unclear_intent"),
  activeScene: scene
});
assert.equal(interruptedByRest.current?.closureReason, "PROCESS_INTERRUPTION");

assert.notEqual(LOCAL_INTERACTION_FOCUS_CONTRACT_V1, "", "le contrat doit rester versionné");
console.log("local-interaction-focus/J10-H2: OK (ouverture, promotion, reprise et fermetures)");

function output(
  id: string,
  capabilityId: string | null,
  targetRef: string | null,
  semanticKind: string,
  options: {
    noCommit?: boolean;
    resultKind?: string;
    repositionAway?: boolean;
    tacticalHandoff?: boolean;
  } = {}
): NarrativeTurnControllerOutputV1 {
  const target = targetRef === null ? null : { kind: "npc", ref: targetRef, label: targetRef };
  const semanticIntent = {
    schemaVersion: 1,
    kind: semanticKind,
    playerGoal: `Sens public ${id}`,
    target,
    commitment: "committed",
    preconditions: [],
    evidenceFromInput: [],
    uncertainties: [],
    forbiddenInterpretations: [],
    confidence: "high",
    perception: null,
    dialogueAct: null,
    ...(options.repositionAway ? {
      composition: {
        schemaVersion: 1,
        orderedComponents: [{ order: 1, kind: "REPOSITION_AWAY", playerGoal: "Quitter l'échange" }]
      }
    } : {})
  };
  const interpretation = {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: `intent:${id}`,
    intentType: semanticKind === "address_visible_actor" ? "speech" : "action",
    commitment: "committed",
    target,
    action: "act",
    semanticIntent,
    runtimeDecision: { schemaVersion: 1, source: "LOCAL_CAPABILITY_REGISTRY", status: "SUPPORTED_BY_CURRENT_RUNTIME", requiredDomain: "scene_resolution", reason: "fixture", noCommit: false, noGameTime: true, aiSuggestionMatched: true },
    referentResolution: target === null ? null : { schemaVersion: 1, usedPreviousContext: false, source: "current_input", resolvedTarget: target, evidence: [], ambiguity: "none", confidence: "high" },
    coreMeaning: `Sens public ${id}`,
    requiresClarification: false,
    clarificationQuestion: null,
    expectedTimeEffect: "NO_GAME_TIME",
    safetyNotes: [],
    semanticSource: "OPEN_SEMANTIC_FRAME_V8",
    openSemanticFrame: {
      schemaVersion: 1,
      understandingStatus: "UNDERSTOOD",
      overallMeaning: `Sens public ${id}`,
      overallCommitment: "committed",
      globalConditions: [],
      components: capabilityId === null ? [] : [{ componentId: `component:${id}`, order: 1, meaning: `Sens public ${id}`, commitment: "committed", conditions: [], negated: false, quoted: false, relationToPrevious: "NONE", alternativeGroupId: null, dependsOnComponentIds: [], simultaneousWithComponentIds: [], supersedesComponentIds: [], mentionedTargets: [{ surface: targetRef, proposedRef: targetRef }], suggestedDomain: "scene_resolution", suggestedAction: `Sens public ${id}`, suggestedCapabilityId: capabilityId }],
      ambiguities: [],
      clarificationQuestion: null,
      confidence: "high"
    },
    openSemanticRuntime: {
      schemaVersion: 1,
      understandingStatus: "UNDERSTOOD",
      executionPlan: {
        schemaVersion: 1,
        contractVersion: "open-semantic-execution-plan/1",
        understandingStatus: "UNDERSTOOD",
        overallMeaning: `Sens public ${id}`,
        steps: capabilityId === null ? [] : [{ schemaVersion: 1, componentId: `component:${id}`, order: 1, meaning: `Sens public ${id}`, commitment: "committed", conditions: [], relationToPrevious: "NONE", dependsOnComponentIds: [], targetRefs: targetRef === null ? [] : [targetRef], capabilityId, suggestedDomain: "scene_resolution", requiredDomain: "scene_resolution", disposition: "ROUTABLE", noCommitBeforeOwnerValidation: true, noGameTimeBeforeOwnerValidation: true, reason: "fixture" }],
        authority: "OWNER_PREFLIGHT_THEN_EXECUTE",
        rawInputAccess: "FORBIDDEN"
      },
      components: []
    }
  };
  return {
    schemaVersion: 1,
    contractVersion: "narrative-turn-controller/1",
    operationId: `operation:${id}`,
    clientRequestId: `request:${id}`,
    noCommit: options.noCommit ?? false,
    noGameTime: true,
    interpretation,
    domainCommand: null,
    mjPlan: null,
    mjPlannerFailure: null,
    npcPerformance: null,
    npcPerformanceFailure: null,
    suspendedIntent: options.noCommit ? {} : null,
    pendingSkillCheck: null,
    resolution: {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `resolution:${id}`,
      operationId: `operation:${id}`,
      resultKind: options.resultKind ?? "COMMIT_APPLIED",
      interpretation,
      domainCommand: null,
      characterExpression: null,
      preparedEffects: [],
      handoff: options.tacticalHandoff ? { target: "TACTICAL", reason: "fixture", blockedCommit: true } : null,
      commitId: options.noCommit ? null : `commit:${id}`,
      noGameTime: true,
      safetyNotes: [],
      actionAdjudication: null,
      perception: null
    },
    sceneState: {} as never,
    sceneArrival: null,
    activeScene: scene,
    displayPacket: {} as never,
    stageTimings: null,
    aiTelemetry: []
  } as unknown as NarrativeTurnControllerOutputV1;
}
