import { cloneJson, computeJsonFingerprint } from "../core/canonical-json/canonicalJson";
import type { JsonObject } from "../core/contracts/types";
import { createProcessStatePayloadV1 } from "./persistenceValidation";
import type { ProcessStatePayloadV1 } from "./persistenceTypes";
import type { TemporalDiagnosticV1, TemporalResultV1, TimeAdvanceProposalV1 } from "./types";
import type {
  PreparedTravelSegmentV1,
  PrepareTravelSegmentInputV1,
  TravelCheckpointV1,
  TravelEncounterCandidateV1,
  TravelEncounterCategoryV1,
  TravelEncounterDecisionV1,
  TravelEncounterPressureV1,
  TravelEncounterSeedV1,
  TravelPlanV1,
  TravelPartySnapshotV1,
  TravelProcessStateV1,
  TravelRouteStepV1,
  TravelSegmentV1,
  WorldTravelRouteCatalogV1
} from "./travelTypes";

function fail(path: string, issue: string, details: JsonObject = {}): TemporalResultV1<never> {
  return {
    ok: false,
    diagnostics: [{ code: "TEMPORAL_SEGMENT_INVALID", path, details: { issue, ...details } }]
  };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function validateRouteStep(step: TravelRouteStepV1): boolean {
  return nonEmpty(step.stepId) &&
    nonEmpty(step.fromLocationId) &&
    nonEmpty(step.toLocationId) &&
    positiveInteger(step.distanceUnits) &&
    positiveInteger(step.estimatedSeconds) &&
    Number.isInteger(step.dangerLevel) &&
    step.dangerLevel >= 0 &&
    step.dangerLevel <= 100 &&
    Array.isArray(step.environmentTags) &&
    new Set(step.environmentTags).size === step.environmentTags.length &&
    step.environmentTags.every(nonEmpty) &&
    validateResourceRates(step.resourceRates ?? []);
}

function validateParty(party: TravelPartySnapshotV1): boolean {
  const members = [...party.memberActorIds];
  return party.schemaVersion === 1 && nonEmpty(party.partyId)
    && nonNegativeInteger(party.partyRevision) && nonEmpty(party.leaderActorId)
    && members.length > 0 && members.includes(party.leaderActorId)
    && new Set(members).size === members.length && members.every(nonEmpty)
    && party.sourceRefs.length > 0 && party.sourceRefs.every(nonEmpty);
}

function validateResourceRates(rates: NonNullable<TravelRouteStepV1["resourceRates"]>): boolean {
  return Array.isArray(rates) && new Set(rates.map(rate => rate.itemId)).size === rates.length
    && rates.every(rate => rate.schemaVersion === 1 && nonEmpty(rate.itemId)
      && positiveInteger(rate.unitsPerPersonPerDay)
      && Array.isArray(rate.sourceRefs) && rate.sourceRefs.length > 0 && rate.sourceRefs.every(nonEmpty));
}

export function validateTravelPlanV1(plan: TravelPlanV1): TemporalResultV1<TravelPlanV1> {
  if (
    plan.schemaVersion !== 1 ||
    !nonEmpty(plan.planId) ||
    !nonEmpty(plan.campaignId) ||
    !nonEmpty(plan.characterId) ||
    !nonEmpty(plan.originLocationId) ||
    !nonEmpty(plan.destinationLocationId) ||
    !["WALK", "RIDE", "CART", "BOAT", "SPECIAL"].includes(plan.mode) ||
    !Array.isArray(plan.route) ||
    plan.route.length === 0 ||
    !nonNegativeInteger(plan.createdAtGameSecond) ||
    !positiveInteger(plan.totalEstimatedSeconds) ||
    plan.route.some(step => !validateRouteStep(step)) ||
    plan.route.reduce((sum, step) => sum + step.estimatedSeconds, 0) !== plan.totalEstimatedSeconds ||
    plan.route[0].fromLocationId !== plan.originLocationId ||
    plan.route.at(-1)?.toLocationId !== plan.destinationLocationId ||
    plan.route.some((step, index) => index > 0 && plan.route[index - 1].toLocationId !== step.fromLocationId) ||
    !nonEmpty(plan.source?.id) ||
    !positiveInteger(plan.source?.version) || (plan.party !== undefined && !validateParty(plan.party))
  ) return fail("/plan", "invalid travel plan");
  return { ok: true, value: cloneJson(plan) };
}

export function buildTravelProcessFromRouteCatalogV1(input: {
  campaignId: TravelPlanV1["campaignId"];
  characterId: string;
  originLocationId: string;
  destinationLocationId: string;
  mode: TravelPlanV1["mode"];
  createdAtGameSecond: number;
  source: TravelPlanV1["source"];
  catalog: WorldTravelRouteCatalogV1;
  party: TravelPartySnapshotV1;
}): TemporalResultV1<TravelProcessStateV1> {
  if (
    input.catalog.schemaVersion !== 1
    || !nonEmpty(input.catalog.catalogId)
    || !positiveInteger(input.catalog.catalogVersion)
    || input.originLocationId === input.destinationLocationId
    || !nonEmpty(input.characterId)
    || !nonNegativeInteger(input.createdAtGameSecond)
    || !validateParty(input.party)
  ) return fail("/travel-plan", "invalid travel plan request");
  if (
    !Array.isArray(input.catalog.anchors)
    || !Array.isArray(input.catalog.routes)
    || new Set(input.catalog.anchors.map(anchor => anchor.locationId)).size !== input.catalog.anchors.length
    || new Set(input.catalog.routes.map(route => route.routeId)).size !== input.catalog.routes.length
    || input.catalog.anchors.some(anchor => anchor.schemaVersion !== 1 || !nonEmpty(anchor.locationId)
      || !["AVAILABLE", "CLOSED"].includes(anchor.status) || !Array.isArray(anchor.sourceRefs)
      || anchor.sourceRefs.length === 0 || !anchor.sourceRefs.every(nonEmpty))
    || input.catalog.routes.some(route => route.schemaVersion !== 1 || !nonEmpty(route.routeId)
      || !nonEmpty(route.fromLocationId) || !nonEmpty(route.toLocationId) || route.fromLocationId === route.toLocationId
      || !["FORWARD", "BIDIRECTIONAL"].includes(route.direction) || !["OPEN", "CLOSED"].includes(route.status)
      || !positiveInteger(route.distanceUnits) || !Number.isInteger(route.dangerLevel) || route.dangerLevel < 0 || route.dangerLevel > 100
      || !Array.isArray(route.environmentTags) || new Set(route.environmentTags).size !== route.environmentTags.length || !route.environmentTags.every(nonEmpty)
      || !Array.isArray(route.sourceRefs) || route.sourceRefs.length === 0 || !route.sourceRefs.every(nonEmpty)
      || Object.values(route.estimatedSecondsByMode).some(value => !positiveInteger(value))
      || !validateResourceRates(route.resourceRates ?? []))
  ) return fail("/travel-plan/catalog", "invalid world travel route catalog");
  const availableAnchors = new Set(input.catalog.anchors
    .filter(anchor => anchor.schemaVersion === 1 && anchor.status === "AVAILABLE" && nonEmpty(anchor.locationId))
    .map(anchor => anchor.locationId));
  if (!availableAnchors.has(input.originLocationId) || !availableAnchors.has(input.destinationLocationId)) {
    return fail("/travel-plan/anchors", "origin or destination is not an available world anchor");
  }
  const edges = input.catalog.routes.flatMap(route => {
    const seconds = route.estimatedSecondsByMode[input.mode];
    if (
      route.schemaVersion !== 1
      || route.status !== "OPEN"
      || !nonEmpty(route.routeId)
      || !availableAnchors.has(route.fromLocationId)
      || !availableAnchors.has(route.toLocationId)
      || !positiveInteger(seconds)
      || !positiveInteger(route.distanceUnits)
      || !Number.isInteger(route.dangerLevel)
      || route.dangerLevel < 0
      || route.dangerLevel > 100
      || !Array.isArray(route.sourceRefs)
      || route.sourceRefs.length === 0
      || !route.sourceRefs.every(nonEmpty)
    ) return [];
    const forward = { route, from: route.fromLocationId, to: route.toLocationId, seconds };
    return route.direction === "BIDIRECTIONAL"
      ? [forward, { route, from: route.toLocationId, to: route.fromLocationId, seconds }]
      : [forward];
  });
  const distances = new Map<string, number>([[input.originLocationId, 0]]);
  const pathKeys = new Map<string, string>([[input.originLocationId, ""]]);
  const previous = new Map<string, (typeof edges)[number]>();
  const unvisited = new Set(availableAnchors);
  while (unvisited.size > 0) {
    const current = [...unvisited]
      .filter(locationId => distances.has(locationId))
      .sort((left, right) => (distances.get(left)! - distances.get(right)!)
        || (pathKeys.get(left) ?? "").localeCompare(pathKeys.get(right) ?? "")
        || left.localeCompare(right))[0];
    if (current === undefined) break;
    unvisited.delete(current);
    if (current === input.destinationLocationId) break;
    for (const edge of edges.filter(value => value.from === current).sort((left, right) => left.route.routeId.localeCompare(right.route.routeId))) {
      if (!unvisited.has(edge.to)) continue;
      const distance = distances.get(current)! + edge.seconds;
      const pathKey = `${pathKeys.get(current) ?? ""}|${edge.route.routeId}:${edge.to}`;
      const knownDistance = distances.get(edge.to);
      if (knownDistance === undefined || distance < knownDistance || distance === knownDistance && pathKey < (pathKeys.get(edge.to) ?? "")) {
        distances.set(edge.to, distance);
        pathKeys.set(edge.to, pathKey);
        previous.set(edge.to, edge);
      }
    }
  }
  if (!distances.has(input.destinationLocationId)) return fail("/travel-plan/route", "no validated route supports this travel mode");
  const selected: Array<(typeof edges)[number]> = [];
  let cursor = input.destinationLocationId;
  while (cursor !== input.originLocationId) {
    const edge = previous.get(cursor);
    if (edge === undefined) return fail("/travel-plan/route", "validated route reconstruction failed");
    selected.unshift(edge);
    cursor = edge.from;
  }
  const planId = `travel-plan:${input.source.id}:${input.catalog.catalogId}:${input.catalog.catalogVersion}`;
  const processId = `travel-process:${planId}`;
  const plan: TravelPlanV1 = {
    schemaVersion: 1,
    planId,
    campaignId: input.campaignId,
    characterId: input.characterId,
    originLocationId: input.originLocationId,
    destinationLocationId: input.destinationLocationId,
    mode: input.mode,
    route: selected.map((edge, index) => ({
      stepId: `travel-step:${index + 1}:${edge.route.routeId}:${edge.from}:${edge.to}`,
      fromLocationId: edge.from,
      toLocationId: edge.to,
      distanceUnits: edge.route.distanceUnits,
      estimatedSeconds: edge.seconds,
      dangerLevel: edge.route.dangerLevel,
      environmentTags: [...new Set(edge.route.environmentTags)].sort(),
      resourceRates: cloneJson(edge.route.resourceRates ?? [])
    })),
    totalEstimatedSeconds: distances.get(input.destinationLocationId)!,
    createdAtGameSecond: input.createdAtGameSecond,
    source: cloneJson(input.source),
    party: cloneJson(input.party)
  };
  const validated = validateTravelPlanV1(plan);
  if (!validated.ok) return validated;
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      processId,
      campaignId: input.campaignId,
      status: "PLANNED",
      plan: validated.value,
      checkpoint: {
        schemaVersion: 1,
        checkpointId: `travel-checkpoint:${planId}:0`,
        processId,
        checkpointRevision: 0,
        status: "PLANNED",
        currentLocationId: input.originLocationId,
        nextLocationId: validated.value.route[0]!.toLocationId,
        elapsedTravelSeconds: 0,
        remainingTravelSeconds: validated.value.totalEstimatedSeconds,
        completedStepIds: [],
        activeSegment: null,
        lastEncounterDecision: null
      }
    }
  };
}

function remainingRoute(plan: TravelPlanV1, checkpoint: TravelCheckpointV1): TravelRouteStepV1[] {
  const completed = new Set(checkpoint.completedStepIds);
  return plan.route.filter(step => !completed.has(step.stepId));
}

function sameParty(expected: TravelPartySnapshotV1, actual: TravelPartySnapshotV1): boolean {
  return expected.partyId === actual.partyId && expected.partyRevision === actual.partyRevision
    && expected.leaderActorId === actual.leaderActorId
    && [...expected.memberActorIds].sort().join("|") === [...actual.memberActorIds].sort().join("|");
}

function resourceConsumptionForSegment(input: {
  step: TravelRouteStepV1;
  partySize: number;
  elapsedBeforeInStep: number;
  elapsedAfterInStep: number;
}) {
  return (input.step.resourceRates ?? []).map(rate => {
    const before = Math.floor(rate.unitsPerPersonPerDay * input.partySize * input.elapsedBeforeInStep / 86_400);
    const after = Math.floor(rate.unitsPerPersonPerDay * input.partySize * input.elapsedAfterInStep / 86_400);
    return { itemId: rate.itemId, quantity: after - before };
  }).filter(value => value.quantity > 0).sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function nextWorldBoundary(currentGameSecond: number, worldSimulatedThrough: number, secondsPerBoundary: number): number | null {
  const next = worldSimulatedThrough + secondsPerBoundary;
  return next > currentGameSecond ? next : currentGameSecond + secondsPerBoundary;
}

export function computeTravelEncounterPressureV1(input: {
  dangerLevel: number;
  worldPressure?: number;
  environmentTags: string[];
}): TravelEncounterPressureV1 {
  const worldPressure = clamp(Math.trunc(input.worldPressure ?? 0), 0, 100);
  const dangerLevel = clamp(Math.trunc(input.dangerLevel), 0, 100);
  const environmentTags = [...new Set(input.environmentTags)].sort();
  const tagPressure = environmentTags.reduce((sum, tag) => {
    if (["route_sauvage", "ruines", "frontiere", "nuit", "foret_dense"].includes(tag)) return sum + 8;
    if (["route_surveillee", "ville", "patrouille"].includes(tag)) return sum - 6;
    return sum;
  }, 0);
  const pressure = clamp(Math.round(dangerLevel * 0.55 + worldPressure * 0.35 + tagPressure), 0, 100);
  const reasons = [
    `danger:${dangerLevel}`,
    `world:${worldPressure}`,
    ...environmentTags.map(tag => `tag:${tag}`)
  ];
  return { schemaVersion: 1, pressure, dangerLevel, worldPressure, environmentTags, reasons };
}

function rollFromFingerprint(fingerprint: `sha256:${string}`): number {
  const slice = fingerprint.slice("sha256:".length, "sha256:".length + 8);
  return Number.parseInt(slice, 16) % 100;
}

function categoryForRoll(roll: number, tags: string[]): Exclude<TravelEncounterCategoryV1, "NONE"> {
  if (tags.includes("ruines") || tags.includes("etrange")) return "STRANGE";
  if (tags.includes("route_surveillee") || tags.includes("ville")) return "SOCIAL";
  if (tags.includes("commerce") || tags.includes("caravane")) return "OPPORTUNITY";
  if (roll % 5 === 0) return "STRANGE";
  if (roll % 3 === 0) return "SOCIAL";
  return "HOSTILE";
}

function validateCandidate(candidate: TravelEncounterCandidateV1): boolean {
  return candidate.schemaVersion === 1 &&
    nonEmpty(candidate.candidateId) &&
    ["HOSTILE", "SOCIAL", "STRANGE", "OPPORTUNITY"].includes(candidate.category) &&
    nonEmpty(candidate.ref?.id) &&
    ["WORLD_SIGNAL", "LORE_ENTITY", "ENCOUNTER_ARCHETYPE"].includes(candidate.ref.kind) &&
    positiveInteger(candidate.weight) &&
    candidate.weight <= 100 &&
    (candidate.locationId === null || nonEmpty(candidate.locationId)) &&
    Array.isArray(candidate.environmentTags) &&
    new Set(candidate.environmentTags).size === candidate.environmentTags.length &&
    candidate.environmentTags.every(nonEmpty);
}

function selectEncounterCandidate(input: {
  candidates: TravelEncounterCandidateV1[];
  category: Exclude<TravelEncounterCategoryV1, "NONE">;
  locationId: string;
  environmentTags: string[];
  roll: number;
}): TravelEncounterCandidateV1 | null {
  const environment = new Set(input.environmentTags);
  const eligible = input.candidates
    .filter(validateCandidate)
    .filter(candidate => candidate.category === input.category)
    .filter(candidate => candidate.locationId === null || candidate.locationId === input.locationId)
    .filter(candidate => candidate.environmentTags.length === 0 || candidate.environmentTags.some(tag => environment.has(tag)))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  if (eligible.length === 0) return null;
  const total = eligible.reduce((sum, candidate) => sum + candidate.weight, 0);
  let cursor = input.roll % total;
  for (const candidate of eligible) {
    if (cursor < candidate.weight) return candidate;
    cursor -= candidate.weight;
  }
  return eligible[0];
}

export async function decideTravelEncounterV1(input: {
  seed: TravelEncounterSeedV1;
  pressure: TravelEncounterPressureV1;
  candidates?: TravelEncounterCandidateV1[];
}): Promise<TemporalResultV1<TravelEncounterDecisionV1>> {
  if (
    input.seed.schemaVersion !== 1 ||
    !nonEmpty(input.seed.processId) ||
    !nonEmpty(input.seed.segmentId) ||
    !nonEmpty(input.seed.campaignId) ||
    !nonEmpty(input.seed.locationId) ||
    !nonNegativeInteger(input.seed.startsAtGameSecond) ||
    !positiveInteger(input.seed.contentPackageVersion) ||
    !positiveInteger(input.seed.rulesetVersion)
  ) return fail("/seed", "invalid encounter seed");
  const seedFingerprint = await computeJsonFingerprint(input.seed) as `sha256:${string}`;
  const roll = rollFromFingerprint(seedFingerprint);
  const threshold = clamp(input.pressure.pressure, 0, 95);
  const triggered = threshold > 0 && roll < threshold;
  const triggeredCategory = categoryForRoll(roll, input.pressure.environmentTags);
  const category: TravelEncounterCategoryV1 = triggered ? triggeredCategory : "NONE";
  const candidate = triggered ? selectEncounterCandidate({
    candidates: input.candidates ?? [],
    category: triggeredCategory,
    locationId: input.seed.locationId,
    environmentTags: input.pressure.environmentTags,
    roll
  }) : null;
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      decisionId: `travel.encounter.${seedFingerprint.slice("sha256:".length, "sha256:".length + 24)}`,
      seedFingerprint,
      roll,
      threshold,
      triggered,
      category,
      candidateRef: candidate?.ref ?? (triggered ? {
        kind: "ENCOUNTER_ARCHETYPE",
        id: `travel.${category.toLowerCase()}`
      } : null),
      requiresPlayerDecision: triggered
    }
  };
}

function buildNoTimeProposal(process: TravelProcessStateV1, currentGameSecond: number): TimeAdvanceProposalV1 {
  return {
    schemaVersion: 1,
    proposalId: `travel.no-time.${process.processId}.${process.checkpoint.checkpointRevision}`,
    campaignId: process.campaignId,
    requesterDomain: "travel",
    category: "NO_GAME_TIME",
    observedAtGameSecond: currentGameSecond,
    duration: { recommendedSeconds: 0, minimumSeconds: 0, maximumSeconds: 0 },
    source: { kind: "NONE", id: null, version: null },
    cause: { kind: "PROCESS", id: process.processId },
    processId: null,
    interruptible: false,
    dependencies: []
  };
}

async function checkpointFingerprint(checkpoint: Omit<TravelCheckpointV1, "checkpointId">): Promise<string> {
  return computeJsonFingerprint(checkpoint);
}

export async function prepareTravelSegmentV1(
  input: PrepareTravelSegmentInputV1
): Promise<TemporalResultV1<PreparedTravelSegmentV1>> {
  const plan = validateTravelPlanV1(input.process.plan);
  if (!plan.ok) return plan;
  if (
    input.process.schemaVersion !== 1 ||
    input.process.campaignId !== input.process.plan.campaignId ||
    input.process.checkpoint.processId !== input.process.processId ||
    !nonNegativeInteger(input.currentGameSecond) ||
    !nonNegativeInteger(input.worldSimulatedThrough) ||
    !positiveInteger(input.secondsPerWorldBoundary) ||
    !positiveInteger(input.maxSegmentSeconds)
  ) return fail("/", "invalid travel process input");
  if (input.process.plan.party !== undefined) {
    if (input.partySnapshot === undefined || !validateParty(input.partySnapshot)
      || !sameParty(input.process.plan.party, input.partySnapshot)) {
      return fail("/party", "authoritative party changed since travel planning");
    }
    if (!Array.isArray(input.availableResources)
      || new Set(input.availableResources.map(resource => resource.itemId)).size !== input.availableResources.length
      || input.availableResources.some(resource => !nonEmpty(resource.itemId) || !nonNegativeInteger(resource.quantity))) {
      return fail("/resources", "authoritative travel resources are missing or invalid");
    }
  }

  const pressure = computeTravelEncounterPressureV1({ dangerLevel: 0, worldPressure: 0, environmentTags: [] });
  const emptySeed: TravelEncounterSeedV1 = {
    schemaVersion: 1,
    processId: input.process.processId,
    segmentId: "none",
    campaignId: input.process.campaignId,
    locationId: input.process.checkpoint.currentLocationId,
    startsAtGameSecond: input.currentGameSecond,
    contentPackageId: input.contentPackageId,
    contentPackageVersion: input.contentPackageVersion,
    rulesetId: input.rulesetId,
    rulesetVersion: input.rulesetVersion
  };
  if (input.forceNoGameTime) {
    const decision = await decideTravelEncounterV1({ seed: emptySeed, pressure, candidates: input.encounterCandidates });
    if (!decision.ok) return decision;
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        timeProposal: buildNoTimeProposal(input.process, input.currentGameSecond),
        nextProcess: cloneJson(input.process),
        encounterPressure: pressure,
        encounterDecision: { ...decision.value, triggered: false, category: "NONE", candidateRef: null, requiresPlayerDecision: false },
        stopReason: "NO_GAME_TIME",
        pendingDecision: null,
        resourceConsumption: []
      }
    };
  }

  if (!["PLANNED", "ACTIVE"].includes(input.process.status)) return fail("/process/status", "travel process cannot advance from this status");
  const remaining = remainingRoute(input.process.plan, input.process.checkpoint);
  if (remaining.length === 0) return fail("/plan/route", "travel route is already complete");
  const step = remaining[0];
  const remainingInStep = Math.max(1, step.estimatedSeconds - Math.max(0, input.process.checkpoint.elapsedTravelSeconds -
    input.process.plan.route
      .slice(0, input.process.plan.route.findIndex(value => value.stepId === step.stepId))
      .reduce((sum, value) => sum + value.estimatedSeconds, 0)));
  const boundary = nextWorldBoundary(input.currentGameSecond, input.worldSimulatedThrough, input.secondsPerWorldBoundary);
  const segmentSeconds = Math.min(input.maxSegmentSeconds, remainingInStep);
  let plannedEnd = input.currentGameSecond + segmentSeconds;
  let stopReason: PreparedTravelSegmentV1["stopReason"] = segmentSeconds === remainingInStep ? "ARRIVAL" : "SEGMENT_LIMIT";
  if (boundary !== null && boundary < plannedEnd) {
    plannedEnd = boundary;
    stopReason = "WORLD_BOUNDARY";
  }
  if (input.interruption && input.interruption.interruptAtGameSecond >= input.currentGameSecond && input.interruption.interruptAtGameSecond < plannedEnd) {
    plannedEnd = input.interruption.interruptAtGameSecond;
    stopReason = "INTERRUPTION";
  }
  const durationSeconds = plannedEnd - input.currentGameSecond;
  if (!positiveInteger(durationSeconds)) return fail("/segment", "travel segment must consume positive game time");
  const elapsedBeforeInStep = step.estimatedSeconds - remainingInStep;
  const resourceConsumption = resourceConsumptionForSegment({
    step,
    partySize: input.process.plan.party?.memberActorIds.length ?? 1,
    elapsedBeforeInStep,
    elapsedAfterInStep: elapsedBeforeInStep + durationSeconds
  });
  const available = new Map((input.availableResources ?? []).map(resource => [resource.itemId, resource.quantity]));
  const missing = resourceConsumption.filter(resource => (available.get(resource.itemId) ?? 0) < resource.quantity);
  if (missing.length > 0) return fail("/resources", "travel segment lacks authoritative resources", {
    missing: missing.map(resource => ({ itemId: resource.itemId, required: resource.quantity, available: available.get(resource.itemId) ?? 0 }))
  });
  const segment: TravelSegmentV1 = {
    schemaVersion: 1,
    segmentId: `travel.segment.${input.process.processId}.${input.process.checkpoint.checkpointRevision + 1}`,
    stepId: step.stepId,
    fromLocationId: step.fromLocationId,
    toLocationId: step.toLocationId,
    startsAtGameSecond: input.currentGameSecond,
    plannedEndGameSecond: plannedEnd,
    durationSeconds,
    distanceUnits: step.distanceUnits,
    dangerLevel: step.dangerLevel,
    environmentTags: [...step.environmentTags].sort(),
    worldBoundaryGameSecond: stopReason === "WORLD_BOUNDARY" ? plannedEnd : null
  };
  const encounterPressure = computeTravelEncounterPressureV1({
    dangerLevel: step.dangerLevel,
    worldPressure: input.worldPressure,
    environmentTags: step.environmentTags
  });
  const encounter = await decideTravelEncounterV1({
    seed: {
      schemaVersion: 1,
      processId: input.process.processId,
      segmentId: segment.segmentId,
      campaignId: input.process.campaignId,
      locationId: step.fromLocationId,
      startsAtGameSecond: input.currentGameSecond,
      contentPackageId: input.contentPackageId,
      contentPackageVersion: input.contentPackageVersion,
      rulesetId: input.rulesetId,
      rulesetVersion: input.rulesetVersion
    },
    pressure: encounterPressure,
    candidates: input.encounterCandidates
  });
  if (!encounter.ok) return encounter;
  if (encounter.value.triggered && stopReason === "SEGMENT_LIMIT") stopReason = "ENCOUNTER";

  const completedStepIds = [...input.process.checkpoint.completedStepIds];
  const elapsedTravelSeconds = input.process.checkpoint.elapsedTravelSeconds + durationSeconds;
  const arrivedAtStepEnd = elapsedTravelSeconds >= input.process.plan.route
    .slice(0, input.process.plan.route.findIndex(value => value.stepId === step.stepId) + 1)
    .reduce((sum, value) => sum + value.estimatedSeconds, 0);
  if (arrivedAtStepEnd && !completedStepIds.includes(step.stepId)) completedStepIds.push(step.stepId);
  const remainingTravelSeconds = Math.max(0, input.process.plan.totalEstimatedSeconds - elapsedTravelSeconds);
  const status = stopReason === "ENCOUNTER" || stopReason === "INTERRUPTION"
    ? "INTERRUPTED"
    : remainingTravelSeconds === 0
      ? "ARRIVED"
      : "ACTIVE";
  const nextIncompleteStep = input.process.plan.route.find(value => !completedStepIds.includes(value.stepId)) ?? null;
  const checkpointBase: Omit<TravelCheckpointV1, "checkpointId"> = {
    schemaVersion: 1,
    processId: input.process.processId,
    checkpointRevision: input.process.checkpoint.checkpointRevision + 1,
    status,
    currentLocationId: arrivedAtStepEnd ? step.toLocationId : step.fromLocationId,
    nextLocationId: remainingTravelSeconds === 0 ? null : nextIncompleteStep?.toLocationId ?? step.toLocationId,
    elapsedTravelSeconds,
    remainingTravelSeconds,
    completedStepIds: completedStepIds.sort(),
    activeSegment: segment,
    lastEncounterDecision: encounter.value
  };
  const fingerprint = await checkpointFingerprint(checkpointBase);
  const checkpoint: TravelCheckpointV1 = {
    ...checkpointBase,
    checkpointId: `travel.checkpoint.${fingerprint.slice("sha256:".length, "sha256:".length + 24)}`
  };
  const pendingDecision = encounter.value.requiresPlayerDecision ? {
    schemaVersion: 1,
    kind: "TRAVEL_ENCOUNTER_DECISION",
    encounterDecisionId: encounter.value.decisionId,
    category: encounter.value.category,
    canObserve: true,
    canAvoid: true,
    canApproach: true
  } satisfies JsonObject : null;
  const nextProcess: TravelProcessStateV1 = {
    schemaVersion: 1,
    processId: input.process.processId,
    campaignId: input.process.campaignId,
    status,
    plan: cloneJson(input.process.plan),
    checkpoint
  };
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      timeProposal: {
        schemaVersion: 1,
        proposalId: `travel.segment.${input.process.processId}.${checkpoint.checkpointRevision}`,
        campaignId: input.process.campaignId,
        requesterDomain: "travel",
        category: "PROCESS_SEGMENT",
        observedAtGameSecond: input.currentGameSecond,
        duration: { recommendedSeconds: durationSeconds, minimumSeconds: durationSeconds, maximumSeconds: durationSeconds },
        source: { kind: "PROCESS", id: input.process.processId, version: 1 },
        cause: { kind: "PROCESS", id: input.process.processId },
        processId: input.process.processId,
        interruptible: true,
        dependencies: []
      },
      nextProcess,
      encounterPressure,
      encounterDecision: encounter.value,
      stopReason,
      pendingDecision,
      resourceConsumption
    }
  };
}

export async function createTravelProcessStatePayloadV1(input: {
  process: TravelProcessStateV1;
  pendingDecision: JsonObject | null;
  lastAppliedEventId: string | null;
  expectedCampaignRevision: number;
}): Promise<TemporalResultV1<ProcessStatePayloadV1>> {
  if (input.process.schemaVersion !== 1 || input.process.plan.schemaVersion !== 1 || input.process.checkpoint.schemaVersion !== 1) {
    return fail("/process", "invalid travel process state");
  }
  return createProcessStatePayloadV1({
    processId: input.process.processId,
    processType: "travel.process",
    ownerDomain: "travel",
    status: input.process.status === "INTERRUPTED"
      ? "SUSPENDED"
      : input.process.status === "ARRIVED"
        ? "COMPLETED_PENDING_INTEGRATION"
        : input.process.status === "CANCELLED"
          ? "CANCELLED"
          : input.process.status === "FAILED_WITHOUT_COMMIT"
            ? "FAILED_WITHOUT_COMMIT"
            : "ACTIVE",
    checkpointRevision: input.process.checkpoint.checkpointRevision,
    lastAppliedEventId: input.lastAppliedEventId,
    expectedCampaignRevision: input.expectedCampaignRevision,
    stateSchemaVersion: 1,
    state: cloneJson(input.process) as unknown as JsonObject,
    pendingDecision: input.pendingDecision
  });
}
