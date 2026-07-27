import type { JsonObject } from "../core";
import type { NarrativeIntentTargetV1 } from "./intentClarification";
import type { PlayableSceneStateV1 } from "./playableScene";
import { narrativeDesignationLabelV1, narrativeDesignationOfV1 } from "./narrativeDesignation";

export const SCENE_REFERENT_REGISTRY_CONTRACT_VERSION_V1 = "scene-referent-registry/1" as const;

export type SceneReferentKindV1 = "npc" | "object" | "place";
export type SceneInteractionCapabilityV1 = "speech" | "nonverbal_signal" | "observe" | "manipulate";
export type SceneReferentViewRoleV1 = "player_intent_interpreter" | "mj_planner" | "npc_performer" | "scene_resolution";

export interface SceneReferentV1 extends JsonObject {
  schemaVersion: 1;
  canonicalRef: string;
  kind: SceneReferentKindV1;
  displayName: string;
  publicAliases: string[];
  publicProperties: string[];
  publicDestinationAliases: string[];
  present: true;
  visible: true;
  interactionCapabilities: SceneInteractionCapabilityV1[];
  sourceRef: string;
  version: 1;
}

export interface SceneReferentRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_REFERENT_REGISTRY_CONTRACT_VERSION_V1;
  sceneId: string;
  sceneVersion: number;
  referents: SceneReferentV1[];
}

export interface SceneReferentRoleViewV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_REFERENT_REGISTRY_CONTRACT_VERSION_V1;
  sceneId: string;
  sceneVersion: number;
  role: SceneReferentViewRoleV1;
  referents: Array<Pick<SceneReferentV1, "canonicalRef" | "kind" | "displayName" | "publicAliases" | "publicProperties" | "publicDestinationAliases" | "interactionCapabilities">>;
}

export type SceneReferentResolutionV1 =
  | { status: "RESOLVED"; referent: SceneReferentV1 }
  | { status: "AMBIGUOUS"; candidates: SceneReferentV1[] }
  | { status: "NOT_FOUND" };

export function buildSceneReferentRegistryV1(scene: PlayableSceneStateV1): SceneReferentRegistryV1 {
  const referents: SceneReferentV1[] = [
    ...scene.presentNpc.map(npc => {
      const designation = narrativeDesignationOfV1(npc);
      return {
      schemaVersion: 1 as const,
      canonicalRef: `npc:${npc.actorId}`,
      kind: "npc" as const,
      displayName: narrativeDesignationLabelV1(designation, npc.displayName),
      publicAliases: unique([
        narrativeDesignationLabelV1(designation, npc.displayName),
        designation?.subsequentMention ?? "",
        npc.publicRole,
        ...npc.keywords
      ]),
      publicProperties: [npc.publicRole, npc.visibleState],
      publicDestinationAliases: [],
      present: true as const,
      visible: true as const,
      interactionCapabilities: ["speech", "nonverbal_signal", "observe"] as SceneInteractionCapabilityV1[],
      sourceRef: `scene:${scene.sceneId}:npc:${npc.actorId}`,
      version: 1 as const
    };
    }),
    ...(scene.ambientPopulation ?? []).map(presence => {
      const designation = narrativeDesignationOfV1(presence);
      return {
      schemaVersion: 1 as const,
      canonicalRef: `npc:${presence.actorId}`,
      kind: "npc" as const,
      displayName: narrativeDesignationLabelV1(designation, presence.displayName),
      publicAliases: unique([
        narrativeDesignationLabelV1(designation, presence.displayName),
        designation?.subsequentMention ?? "",
        presence.publicRole,
        ...presence.keywords
      ]),
      publicProperties: [presence.publicRole, presence.visibleActivity, "présence ambiante"],
      publicDestinationAliases: [],
      present: true as const,
      visible: true as const,
      interactionCapabilities: ["speech", "nonverbal_signal", "observe"] as SceneInteractionCapabilityV1[],
      sourceRef: `scene:${scene.sceneId}:ambient:${presence.actorId}`,
      version: 1 as const
    };
    }),
    ...scene.pointsOfInterest.map(point => ({
      schemaVersion: 1 as const,
      canonicalRef: `poi:${point.pointId}`,
      kind: "object" as const,
      displayName: point.label,
      publicAliases: unique([point.label, ...point.keywords]),
      publicProperties: [point.visibleDescription],
      publicDestinationAliases: unique(point.destinationAliases),
      present: true as const,
      visible: true as const,
      interactionCapabilities: ["observe", "manipulate"] as SceneInteractionCapabilityV1[],
      sourceRef: `scene:${scene.sceneId}:poi:${point.pointId}`,
      version: 1 as const
    })),
    ...scene.visibleElements
      .filter(element => !scene.pointsOfInterest.some(point => point.pointId === element.elementId))
      .map(element => ({
        schemaVersion: 1 as const,
        canonicalRef: `element:${element.elementId}`,
        kind: "object" as const,
        displayName: element.label,
        publicAliases: unique([element.label, ...element.keywords]),
        publicProperties: [element.description],
        publicDestinationAliases: [],
        present: true as const,
        visible: true as const,
        interactionCapabilities: ["observe"] as SceneInteractionCapabilityV1[],
        sourceRef: `scene:${scene.sceneId}:element:${element.elementId}`,
        version: 1 as const
      }))
  ];
  return {
    schemaVersion: 1,
    contractVersion: SCENE_REFERENT_REGISTRY_CONTRACT_VERSION_V1,
    sceneId: scene.sceneId,
    sceneVersion: scene.version,
    referents
  };
}

export function validateSceneReferentRegistryV1(registry: SceneReferentRegistryV1): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (registry.contractVersion !== SCENE_REFERENT_REGISTRY_CONTRACT_VERSION_V1) issues.push("contractVersion must be scene-referent-registry/1.");
  if (!registry.sceneId.trim()) issues.push("sceneId is required.");
  const refs = registry.referents.map(entry => entry.canonicalRef);
  if (new Set(refs).size !== refs.length) issues.push("canonicalRef values must be unique.");
  if (registry.referents.some(entry => !entry.canonicalRef.trim() || !entry.displayName.trim())) issues.push("referents require canonicalRef and displayName.");
  if (registry.referents.some(entry => !entry.visible || !entry.present)) issues.push("role registry may only contain present visible referents.");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function toSceneReferentRoleViewV1(registry: SceneReferentRegistryV1, role: SceneReferentViewRoleV1): SceneReferentRoleViewV1 {
  const referents = registry.referents
    .filter(entry => role !== "npc_performer" || entry.kind === "npc")
    .map(entry => ({
      canonicalRef: entry.canonicalRef,
      kind: entry.kind,
      displayName: entry.displayName,
      publicAliases: [...entry.publicAliases],
      publicProperties: [...entry.publicProperties],
      publicDestinationAliases: [...entry.publicDestinationAliases],
      interactionCapabilities: [...entry.interactionCapabilities]
    }));
  return { schemaVersion: 1, contractVersion: SCENE_REFERENT_REGISTRY_CONTRACT_VERSION_V1, sceneId: registry.sceneId, sceneVersion: registry.sceneVersion, role, referents };
}

export function findSceneReferentByRefV1(registry: SceneReferentRegistryV1, ref: string): SceneReferentV1 | null {
  const canonical = ref.includes(":") ? ref : registry.referents.find(entry => entry.canonicalRef.endsWith(`:${ref}`))?.canonicalRef ?? ref;
  return registry.referents.find(entry => entry.canonicalRef === canonical) ?? null;
}

export function resolveSceneReferentTextV1(
  registry: SceneReferentRegistryV1,
  text: string,
  capability?: SceneInteractionCapabilityV1
): SceneReferentResolutionV1 {
  const normalizedText = normalize(text);
  const candidates = registry.referents.filter(entry =>
    (capability === undefined || entry.interactionCapabilities.includes(capability)) &&
    entry.publicAliases.some(alias => containsAlias(normalizedText, normalize(alias)))
  );
  if (candidates.length === 0) return { status: "NOT_FOUND" };
  const longest = Math.max(...candidates.map(entry => Math.max(...entry.publicAliases.filter(alias => containsAlias(normalizedText, normalize(alias))).map(alias => normalize(alias).length))));
  const mostSpecific = candidates.filter(entry => entry.publicAliases.some(alias => containsAlias(normalizedText, normalize(alias)) && normalize(alias).length === longest));
  if (mostSpecific.length !== 1) return { status: "AMBIGUOUS", candidates: mostSpecific };
  return { status: "RESOLVED", referent: mostSpecific[0]! };
}

export function resolveSceneReferentDescriptionV1(
  registry: SceneReferentRegistryV1,
  text: string,
  kind?: SceneReferentKindV1
): SceneReferentResolutionV1 {
  const normalizedText = normalize(text);
  const candidates = registry.referents.filter(entry =>
    (kind === undefined || entry.kind === kind) &&
    [...entry.publicAliases, ...entry.publicDestinationAliases].some(alias => containsAlias(normalizedText, normalize(alias)))
  );
  return candidates.length === 1
    ? { status: "RESOLVED", referent: candidates[0]! }
    : candidates.length > 1
      ? { status: "AMBIGUOUS", candidates }
      : { status: "NOT_FOUND" };
}

export function toNarrativeIntentTargetV1(referent: SceneReferentV1): NarrativeIntentTargetV1 {
  return { kind: referent.kind, ref: referent.canonicalRef, label: referent.displayName };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function containsAlias(text: string, alias: string): boolean {
  if (!alias) return false;
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(alias)}(?:$|[^\\p{L}\\p{N}])`, "u").test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
