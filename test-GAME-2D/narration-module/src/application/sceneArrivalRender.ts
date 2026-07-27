import type { DisplayPacketV1, RenderPlanV1, SpeakerRefV1 } from "../scene";
import { buildDisplayPacketFromRenderPlanV1, SCENE_SOCIAL_UI_CONTRACT_VERSION_V1, validateRenderPlanV1 } from "../scene";
import type { SceneArrivalStateV1 } from "./sceneArrival";
import { buildVisiblePopulationNarrationV1 } from "./ambientScenePresence";
import { narrativeDesignationOfV1, narrativeFirstMentionV1 } from "./narrativeDesignation";

const PLAYER: SpeakerRefV1 = { schemaVersion: 1, speakerId: "speaker-player", kind: "PLAYER_CHARACTER", actorRef: null, displayName: "Personnage", knownNameStatus: "KNOWN", roleLabel: "Expression joueur", accessibilityLabel: "Expression du personnage joueur", visualToken: "speaker-player" };
const RAW_PLAYER: SpeakerRefV1 = { schemaVersion: 1, speakerId: "speaker-player-raw", kind: "PLAYER_CHARACTER", actorRef: null, displayName: "Joueur", knownNameStatus: "KNOWN", roleLabel: "Entrée originale", accessibilityLabel: "Entrée brute du joueur", visualToken: "speaker-player" };
const GM: SpeakerRefV1 = { schemaVersion: 1, speakerId: "speaker-gm", kind: "GM", actorRef: null, displayName: "MJ", knownNameStatus: "KNOWN", roleLabel: "Narration", accessibilityLabel: "Maître du jeu", visualToken: "speaker-gm" };
const SYSTEM: SpeakerRefV1 = { schemaVersion: 1, speakerId: "speaker-system", kind: "SYSTEM", actorRef: null, displayName: "Système", knownNameStatus: "KNOWN", roleLabel: "Notification système", accessibilityLabel: "Notification système", visualToken: "speaker-system" };

export function buildSceneArrivalRenderPlanV1(input: {
  operationId: string;
  rawInput: string;
  characterExpression: string;
  arrival: SceneArrivalStateV1;
  durationSeconds: number;
}): RenderPlanV1 {
  if (!input.operationId.trim() || !input.rawInput.trim() || !input.characterExpression.trim()) throw new Error("Arrival rendering requires operation and player expression");
  if (input.arrival.narrationStatus !== "READY_AFTER_COMMIT") throw new Error("Arrival narration requires confirmed post-commit state");
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 1) throw new Error("durationSeconds must be a positive integer");
  const sceneSources = [...new Set([...input.arrival.authoritySourceRefs, ...input.arrival.reconstructionRefs])];
  const narration = buildDeterministicArrivalNarration(input.arrival);
  const plan: RenderPlanV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operationId,
    sceneId: input.arrival.scene.sceneId,
    sourceRevision: input.arrival.scene.version,
    blocks: [{
      blockId: `${input.operationId}:arrival:raw`, kind: "RAW_INPUT", speakerRef: RAW_PLAYER,
      sourceRefs: [`operation:${input.operationId}:raw`], groundedIn: [`operation:${input.operationId}:raw`], textPolicy: "EXACT", visibility: "PLAYER_VISIBLE", order: 0, text: input.rawInput
    }, {
      blockId: `${input.operationId}:arrival:expression`, kind: "PLAYER_EXPRESSION", speakerRef: PLAYER,
      sourceRefs: [`operation:${input.operationId}:character-expression`], groundedIn: [`operation:${input.operationId}:raw`], textPolicy: "EXACT", visibility: "PLAYER_VISIBLE", order: 1, text: input.characterExpression
    }, {
      blockId: `${input.operationId}:arrival:narration`, kind: "GM_NARRATION", speakerRef: GM,
      sourceRefs: sceneSources, groundedIn: sceneSources, textPolicy: "AI_NARRATIVE_ALLOWED", visibility: "PLAYER_VISIBLE", order: 2, text: narration
    }, {
      blockId: `${input.operationId}:arrival:system`, kind: "SYSTEM_NOTICE", speakerRef: SYSTEM,
      sourceRefs: [`commit:${input.arrival.commitId}`, `transition-request:${input.arrival.transitionRequestId}`], groundedIn: [`commit:${input.arrival.commitId}`], textPolicy: "DETERMINISTIC_ONLY", visibility: "SYSTEM_ONLY", order: 3,
      text: `Transition locale confirmée. Destination=${input.arrival.destinationRef}; scène=${input.arrival.scene.sceneId}; temps=${input.durationSeconds} s; commit=${input.arrival.commitId}.`
    }],
    rhythmDecision: { reason: "ASK_PLAYER", diagnostic: "arrival scene established after confirmed transition; player regains control" },
    fallbackAllowed: true,
    version: 1
  };
  const validation = validateRenderPlanV1(plan);
  if (!validation.ok) throw new Error(`Invalid arrival render plan: ${validation.issues.join("; ")}`);
  return plan;
}

export function buildSceneArrivalDisplayPacketV1(input: Parameters<typeof buildSceneArrivalRenderPlanV1>[0]): DisplayPacketV1 {
  return buildDisplayPacketFromRenderPlanV1({
    renderPlan: buildSceneArrivalRenderPlanV1(input),
    rawInputAvailable: true,
    diagnosticsEnabled: true
  });
}

function buildDeterministicArrivalNarration(arrival: SceneArrivalStateV1): string {
  const situation = arrival.scene.perceptibleSituation.join(" ");
  const actors = buildVisiblePopulationNarrationV1(arrival.scene);
  const points = arrival.scene.pointsOfInterest.map(point => `${point.label} : ${point.visibleDescription}`).join(" ");
  const place = narrativeFirstMentionV1(narrativeDesignationOfV1(arrival.scene, "locationDesignation"), arrival.scene.locationName);
  return `Tu arrives à ${place}. ${situation} ${actors} ${points} Tension actuelle : ${arrival.scene.currentTension}`.replace(/\s+/gu, " ").trim();
}
