import {
  coreError,
  type CampaignId,
  type CampaignRepository,
  type EventRecord,
  type JsonObject,
  type Result
} from "../core";
import {
  SCENE_EVENT_BUNDLE_CONTRACT_V1,
  type SceneEventBundleV1,
  type SceneEventPerceptionV1
} from "./plotAuthority";

export interface WorldSignalNarrativePolicyV1 {
  describe(input: {
    kind: string;
    intensity: number;
    locationRef: string;
  }): string;
  interruptsPlayer(input: {
    kind: string;
    intensity: number;
    locationRef: string;
  }): boolean;
}

export const DEFAULT_WORLD_SIGNAL_NARRATIVE_POLICY_V1: WorldSignalNarrativePolicyV1 = {
  describe(input) {
    const strength = input.intensity >= 75 ? "nettement" : input.intensity >= 40 ? "distinctement" : "à peine";
    switch (input.kind) {
      case "auditory": return `Un bruit inhabituel se fait ${strength} entendre dans les environs.`;
      case "institutional": return `L'activité des autorités locales change ${strength} de rythme.`;
      case "market": return `L'activité des échanges se modifie ${strength} autour de toi.`;
      case "religious": return `Des signes d'activité religieuse deviennent ${strength} perceptibles dans les environs.`;
      case "military": return `Des signes d'activité armée deviennent ${strength} perceptibles à proximité.`;
      default: return `Un changement devient ${strength} visible dans les environs.`;
    }
  },
  interruptsPlayer(input) {
    return input.intensity >= 75;
  }
};

export async function loadCommittedWorldSimulationSceneBundleV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  sceneId: string;
  sceneLocationRefs: string[];
  throughGameSecond: number;
  policy?: WorldSignalNarrativePolicyV1;
  eventLimit?: number;
}): Promise<Result<SceneEventBundleV1>> {
  const events = await input.repository.listEvents(
    input.campaignId,
    null,
    input.eventLimit ?? 500
  );
  if (!events.ok) return events;
  return adaptCommittedWorldSimulationEventsV1({
    events: events.value,
    sceneId: input.sceneId,
    sceneLocationRefs: input.sceneLocationRefs,
    throughGameSecond: input.throughGameSecond,
    policy: input.policy
  });
}

export function adaptCommittedWorldSimulationEventsV1(input: {
  events: EventRecord[];
  sceneId: string;
  sceneLocationRefs: string[];
  throughGameSecond: number;
  policy?: WorldSignalNarrativePolicyV1;
}): Result<SceneEventBundleV1> {
  if (
    !input.sceneId.trim()
    || input.sceneLocationRefs.length === 0
    || input.sceneLocationRefs.some(ref => !ref.trim())
    || !Number.isInteger(input.throughGameSecond)
    || input.throughGameSecond < 0
  ) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "world-scene-events.invalid-input")
    };
  }
  const policy = input.policy ?? DEFAULT_WORLD_SIGNAL_NARRATIVE_POLICY_V1;
  const localLocations = new Set(input.sceneLocationRefs);
  const perceptions: SceneEventPerceptionV1[] = [];
  const seenSignalIds = new Set<string>();
  let excludedEffectCount = 0;
  for (const event of [...input.events].sort(eventOrder)) {
    if (event.origin !== "WORLD_SIMULATION" || event.occurredAtGameSecond > input.throughGameSecond) continue;
    const tickOutput = asObject(event.payload.tickOutput);
    if (tickOutput === null || !Array.isArray(tickOutput.signals)) continue;
    for (const rawSignal of tickOutput.signals) {
      const signal = parseSignal(rawSignal);
      if (signal === null || seenSignalIds.has(signal.id)) continue;
      seenSignalIds.add(signal.id);
      const locationRef = `${signal.locationKind}:${signal.locationId}`;
      if (!localLocations.has(locationRef)) {
        excludedEffectCount += 1;
        continue;
      }
      const descriptor = {
        kind: signal.kind,
        intensity: signal.intensity,
        locationRef
      };
      perceptions.push({
        effectRef: `world-signal:${signal.id}`,
        eventRef: `event:${event.eventId}`,
        sourceOperationId: event.operationId,
        sourceKind: "WORLD_SIMULATION",
        effectiveAtGameSecond: event.occurredAtGameSecond,
        causalOrder: [
          String(event.commitSequence).padStart(12, "0"),
          String(event.eventSequence).padStart(6, "0"),
          signal.id
        ].join(":"),
        presentation: "OBSERVATION",
        text: policy.describe(descriptor),
        sourceRefs: [`event:${event.eventId}`, `world-signal:${signal.id}`],
        interruptsPlayer: policy.interruptsPlayer(descriptor)
      });
    }
  }
  perceptions.sort(perceptionOrder);
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: SCENE_EVENT_BUNDLE_CONTRACT_V1,
      sceneId: input.sceneId,
      throughGameSecond: input.throughGameSecond,
      perceptions,
      excludedEffectCount,
      controlDecision: perceptions.some(value => value.interruptsPlayer)
        ? "INTERRUPT_FOR_PLAYER_DECISION"
        : "RETURN_CONTROL",
      version: 1
    }
  };
}

export function composeCausalSceneEventBundlesV1(
  bundles: SceneEventBundleV1[]
): Result<SceneEventBundleV1> {
  if (bundles.length === 0) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "scene-event-bundle.empty-composition")
    };
  }
  const sceneId = bundles[0]!.sceneId;
  if (bundles.some(bundle =>
    bundle.contractVersion !== SCENE_EVENT_BUNDLE_CONTRACT_V1
    || bundle.sceneId !== sceneId
  )) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "scene-event-bundle.incompatible-composition")
    };
  }
  const unique = new Map<string, SceneEventPerceptionV1>();
  for (const perception of bundles.flatMap(bundle => bundle.perceptions)) {
    if (!unique.has(perception.effectRef)) unique.set(perception.effectRef, perception);
  }
  const perceptions = [...unique.values()].sort(perceptionOrder);
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: SCENE_EVENT_BUNDLE_CONTRACT_V1,
      sceneId,
      throughGameSecond: Math.max(...bundles.map(bundle => bundle.throughGameSecond)),
      perceptions,
      excludedEffectCount: bundles.reduce((sum, bundle) => sum + bundle.excludedEffectCount, 0),
      controlDecision: perceptions.some(value => value.interruptsPlayer)
        ? "INTERRUPT_FOR_PLAYER_DECISION"
        : "RETURN_CONTROL",
      version: 1
    }
  };
}

function parseSignal(value: unknown): {
  id: string;
  kind: string;
  intensity: number;
  locationKind: string;
  locationId: string;
} | null {
  const signal = asObject(value);
  const location = asObject(signal?.location);
  return signal !== null
    && typeof signal.id === "string"
    && signal.id.trim().length > 0
    && typeof signal.kind === "string"
    && Number.isFinite(signal.intensity)
    && Number(signal.intensity) >= 0
    && Number(signal.intensity) <= 100
    && location !== null
    && typeof location.kind === "string"
    && typeof location.id === "string"
    ? {
        id: signal.id,
        kind: signal.kind,
        intensity: Number(signal.intensity),
        locationKind: location.kind,
        locationId: location.id
      }
    : null;
}

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function eventOrder(left: EventRecord, right: EventRecord): number {
  return left.commitSequence - right.commitSequence
    || left.eventSequence - right.eventSequence
    || left.eventId.localeCompare(right.eventId);
}

function perceptionOrder(left: SceneEventPerceptionV1, right: SceneEventPerceptionV1): number {
  return left.effectiveAtGameSecond - right.effectiveAtGameSecond
    || left.causalOrder.localeCompare(right.causalOrder)
    || left.effectRef.localeCompare(right.effectRef);
}
