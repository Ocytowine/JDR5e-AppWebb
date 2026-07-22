import { computeJsonFingerprint, type JsonObject } from "../core";
import type { RoleContextPackV1 } from "../context";
import type { MemorySourceRefV1 } from "../memory";
import type { DisplayPacketV1 } from "../scene";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";
import type { NarrativeResolutionResultV1 } from "./narrativeResolution";
import type { PlayableSceneStateV1 } from "./playableScene";
import { buildShortVisibleHistoryV1, type ReferenceSceneWriterContextTaskV1 } from "./referenceScene";

export const ACTIVE_SCENE_NARRATIVE_CONTEXT_VERSION_V1 = "active-scene-narrative-context/1" as const;

export interface ActiveSceneNarrativeBriefV1 extends ReferenceSceneWriterContextTaskV1 {
  activeSceneId: string;
  activeSceneVersion: number;
  visibleReferentRefs: string[];
  priorSceneIdsForbidden: string[];
}

export function buildActiveSceneNarrativeBriefV1(input: {
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  resolution: NarrativeResolutionResultV1;
  activeScene: PlayableSceneStateV1;
  priorDisplayPackets?: DisplayPacketV1[];
}): ActiveSceneNarrativeBriefV1 {
  const sceneRef = `playable-scene:${input.activeScene.sceneId}:${input.activeScene.version}`;
  const resolutionRef = `resolution:${input.resolution.resolutionId}`;
  return {
    schemaVersion: 1,
    contractVersion: "reference-scene-writer-context/1",
    rawInput: input.rawInput,
    resultKind: input.resolution.resultKind,
    intentType: input.interpretation.intentType,
    coreMeaning: input.interpretation.coreMeaning,
    committed: input.resolution.commitId !== null,
    handoffTarget: input.resolution.handoff?.target ?? null,
    allowedGrounding: [resolutionRef, sceneRef],
    forbidden: ["success_without_commit", "combat_resolution", "inventory_mutation", "secret_reveal", "new_durable_creation", "player_agency_override", "entity_from_inactive_scene"],
    activeSceneId: input.activeScene.sceneId,
    activeSceneVersion: input.activeScene.version,
    visibleReferentRefs: [
      ...input.activeScene.visibleElements.map(element => `element:${element.elementId}`),
      ...input.activeScene.presentNpc.map(npc => `npc:${npc.actorId}`),
      ...input.activeScene.pointsOfInterest.map(point => `poi:${point.pointId}`)
    ],
    priorSceneIdsForbidden: [...new Set((input.priorDisplayPackets ?? []).map(packet => packet.sceneId).filter(sceneId => sceneId !== input.activeScene.sceneId))],
    version: 1
  };
}

export async function buildActiveSceneContextPackV1(input: {
  campaignId: string;
  operationId: string;
  packId: string;
  snapshotId: string;
  activeScene: PlayableSceneStateV1;
  brief: ActiveSceneNarrativeBriefV1;
  priorDisplayPackets?: DisplayPacketV1[];
}): Promise<RoleContextPackV1> {
  const sceneRef = `playable-scene:${input.activeScene.sceneId}:${input.activeScene.version}`;
  const resolutionRef = `resolution:${input.brief.resultKind}:${input.operationId}`;
  const sceneMemoryRef = sourceRef("CONTENT_ENTRY", input.activeScene.sceneId, input.campaignId, "narration.playable-scene");
  const resolutionMemoryRef = sourceRef("OPERATION", input.operationId, input.campaignId, "narration.resolution");
  const visibleHistory = buildShortVisibleHistoryV1((input.priorDisplayPackets ?? []).filter(packet => packet.sceneId === input.activeScene.sceneId));
  const pack: RoleContextPackV1 = {
    schemaVersion: 1,
    packId: input.packId,
    snapshotId: input.snapshotId,
    campaignId: input.campaignId,
    role: "scene_writer",
    task: "Raconter uniquement le résultat confirmé dans la scène active, sans autorité métier ni import d'une autre scène.",
    perspective: { kind: "PLAYER_CHARACTER", actorId: "player-character:prototype" },
    baseCampaignRevision: 0,
    dependencyVersions: [{ sourceRef: sceneMemoryRef, properties: ["locationName", "perceptibleSituation", "visibleElements", "presentNpc", "pointsOfInterest", "currentTension", "playerKnownFacts", "aiSceneWriterPolicy"] }],
    creativeScope: {
      mayCreate: [...input.activeScene.aiSceneWriterPolicy.mayCreate],
      mayReference: [sceneRef, ...input.activeScene.aiSceneWriterPolicy.mayReference],
      mayProposeCommands: [],
      mayReveal: { reveal: [], hint: ["faits déjà visibles dans la scène active"], withhold: ["faits cachés", "conséquences non confirmées"] },
      mustPreserve: [input.activeScene.sceneId, input.brief.coreMeaning, input.brief.resultKind],
      mustNotCreate: [...input.activeScene.aiSceneWriterPolicy.mustNotCreate],
      mustNotModify: ["resolution.resultKind", "commitId", "horloge", "inventaire", "scene.lifecycle"],
      noveltyConstraints: [...input.activeScene.aiSceneWriterPolicy.noveltyConstraints]
    },
    budget: { unit: "MODEL_TOKENS_ESTIMATE", maximum: 1_200, reservedForInstructionsAndSchema: 250, reservedForOutput: 350, reservedForInput: 600, reservedForMandatory: 360, consumedByBlocks: 360, remainingMargin: 240, reductionStepsApplied: [] },
    blocks: [{
      blockId: `${input.operationId}:active-scene`, blockKind: "SCENE", sourceRefs: [sceneMemoryRef], visibility: "PLAYER_CHARACTER", actorScope: [],
      text: [`Lieu: ${input.activeScene.locationName}.`, ...input.activeScene.perceptibleSituation, `Éléments visibles: ${input.activeScene.visibleElements.map(element => `${element.label}: ${element.description}`).join(" | ") || "aucun"}.`, `Présences visibles: ${input.activeScene.presentNpc.map(npc => `${npc.displayName}: ${npc.visibleState}`).join(" | ") || "aucune"}.`, `Passages et points d'intérêt: ${input.activeScene.pointsOfInterest.map(point => `${point.label}: ${point.visibleDescription}`).join(" | ") || "aucun"}.`, `Tension: ${input.activeScene.currentTension}`].join(" "),
      payload: input.activeScene as unknown as JsonObject, tokenEstimate: 260
    }, ...(visibleHistory.entries.length === 0 ? [] : [{
      blockId: `${input.operationId}:active-scene-history`, blockKind: "MEMORY_CAPSULE" as const, sourceRefs: [sceneMemoryRef], visibility: "PLAYER_CHARACTER" as const, actorScope: [], text: visibleHistory.text, payload: visibleHistory as unknown as JsonObject, tokenEstimate: visibleHistory.tokenEstimate
    }]), {
      blockId: `${input.operationId}:active-scene-brief`, blockKind: "CONSTRAINT", sourceRefs: [sceneMemoryRef, resolutionMemoryRef], visibility: "SYSTEM_ONLY", actorScope: [],
      text: "Employer seulement les entités visibles de la scène active et les faits confirmés du résultat. Toute ancienne scène est hors contexte.", payload: input.brief as unknown as JsonObject, tokenEstimate: 100
    }],
    outputContractId: "narrative-ai-resolution/1",
    packFingerprint: "sha256:pending"
  };
  return { ...pack, packFingerprint: await computeJsonFingerprint({ ...pack, packFingerprint: null }) as `sha256:${string}` };
}

function sourceRef(sourceKind: MemorySourceRefV1["sourceKind"], sourceId: string, campaignId: string, ownerDomain: string): MemorySourceRefV1 {
  return { schemaVersion: 1, sourceKind, sourceId, campaignId, ownerDomain, version: 1, path: null, fingerprint: null };
}

export function validateActiveSceneNarrativeCandidateV1(input: {
  brief: ActiveSceneNarrativeBriefV1;
  groundedIn: string[];
  factDiscipline?: { addedUnsupportedFacts: string[]; usesOnlyProvidedVisibleEntities: boolean; noNewEvents: boolean; noHiddenPresence: boolean };
}): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (input.groundedIn.length === 0 || input.groundedIn.some(ref => !input.brief.allowedGrounding.includes(ref))) issues.push("grounding outside active scene");
  if (!input.factDiscipline) issues.push("fact discipline declaration required");
  else {
    if (input.factDiscipline.addedUnsupportedFacts.length > 0) issues.push("unsupported facts declared");
    if (!input.factDiscipline.usesOnlyProvidedVisibleEntities) issues.push("inactive or unknown entity used");
    if (!input.factDiscipline.noNewEvents) issues.push("new event introduced");
    if (!input.factDiscipline.noHiddenPresence) issues.push("hidden presence introduced");
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
