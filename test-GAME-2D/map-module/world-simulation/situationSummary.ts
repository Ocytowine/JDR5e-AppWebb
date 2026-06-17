import type { EntityId, EntityRef, MobileActor, PressureMap, WorldHistoryEntry, WorldState, WorldTension } from "./types";

export type LocalSituationTrend = "stable" | "improving" | "worsening" | "contested" | "active";

export type LocalSituationSummary = {
  headline: string;
  trend: LocalSituationTrend;
  dominantPressures: Array<{ type: string; value: number }>;
  activeTensions: WorldTension[];
  involvedFactionLabels: string[];
  involvedMobileLabels: string[];
  recentFact?: WorldHistoryEntry;
  riskLabel: string;
  nextLikelyDevelopments: string[];
};

function getEntityKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function getPressureEntries(pressures: PressureMap | undefined): Array<{ type: string; value: number }> {
  return Object.entries(pressures ?? {})
    .filter(([, value]) => typeof value === "number" && value >= 1)
    .map(([type, value]) => ({ type, value: Math.round(value ?? 0) }))
    .sort((left, right) => right.value - left.value);
}

function getEntityPressures(state: WorldState, ref: EntityRef): Array<{ type: string; value: number }> {
  if (ref.kind !== "city" && ref.kind !== "district" && ref.kind !== "route" && ref.kind !== "region") return [];
  return getPressureEntries(state.pressures[ref.kind]?.[ref.id]);
}

function getEntityTensionIds(state: WorldState, ref: EntityRef): EntityId[] {
  switch (ref.kind) {
    case "city":
      return state.cities[ref.id]?.activeTensionIds ?? [];
    case "district":
      return state.districts[ref.id]?.activeTensionIds ?? [];
    case "route":
      return state.routes[ref.id]?.activeTensionIds ?? [];
    case "region":
      return state.regions[ref.id]?.activeTensionIds ?? [];
    default:
      return [];
  }
}

function getEntityHistory(state: WorldState, ref: EntityRef): WorldHistoryEntry[] {
  switch (ref.kind) {
    case "city":
      return state.cities[ref.id]?.recentHistory ?? [];
    case "district":
      return state.districts[ref.id]?.recentHistory ?? [];
    case "route":
      return state.routes[ref.id]?.recentHistory ?? [];
    case "region":
      return state.regions[ref.id]?.recentHistory ?? [];
    case "faction":
      return state.factions[ref.id]?.recentHistory ?? [];
    case "mobileActor":
      return state.mobileActors[ref.id]?.recentHistory ?? [];
    default:
      return [];
  }
}

function isRefRelatedToEntity(ref: EntityRef, entityKeys: Set<string>): boolean {
  return entityKeys.has(getEntityKey(ref));
}

function getRelatedTensions(state: WorldState, refs: EntityRef[]): WorldTension[] {
  const tensionIds = unique(refs.flatMap(ref => getEntityTensionIds(state, ref)));
  const entityKeys = new Set(refs.map(getEntityKey));
  const directTensions = tensionIds
    .map(tensionId => state.tensions[tensionId])
    .filter((tension): tension is WorldTension => Boolean(tension));
  const referencedTensions = Object.values(state.tensions).filter(tension =>
    [...tension.sourceRefs, ...tension.targetRefs].some(ref => isRefRelatedToEntity(ref, entityKeys))
  );
  return unique([...directTensions, ...referencedTensions])
    .sort((left, right) => right.severity - left.severity)
    .slice(0, 5);
}

function getRelatedFactionLabels(state: WorldState, refs: EntityRef[]): string[] {
  const zoneIds = new Set(refs.map(ref => ref.id));
  const labels = Object.values(state.factions)
    .filter(faction => {
      if (refs.some(ref => ref.kind === "faction" && ref.id === faction.id)) return true;
      const zones = [
        ...(faction.controlledZoneIds ?? []),
        ...(faction.influencedZoneIds ?? []),
        ...(faction.interestZoneIds ?? []),
        ...faction.influenceZoneIds
      ];
      if (zones.some(zoneId => zoneIds.has(zoneId))) return true;
      return faction.localAnchors?.some(anchor => anchor.target && zoneIds.has(anchor.target.id));
    })
    .map(faction => faction.name)
    .slice(0, 5);
  return unique(labels);
}

function isMobileRelatedToRefs(actor: MobileActor, refs: EntityRef[]): boolean {
  const entityKeys = new Set(refs.map(getEntityKey));
  if (entityKeys.has(getEntityKey(actor.position))) return true;
  if (actor.destination && entityKeys.has(getEntityKey(actor.destination))) return true;
  return actor.itinerary.some(routeId => entityKeys.has(`route:${routeId}`));
}

function getRelatedMobileLabels(state: WorldState, refs: EntityRef[]): string[] {
  return Object.values(state.mobileActors)
    .filter(actor => isMobileRelatedToRefs(actor, refs))
    .map(actor => actor.id)
    .slice(0, 5);
}

function getRelatedRecentFact(state: WorldState, refs: EntityRef[]): WorldHistoryEntry | undefined {
  return refs
    .flatMap(ref => getEntityHistory(state, ref))
    .sort((left, right) => right.tick - left.tick)[0];
}

function deriveTrend(tensions: WorldTension[], recentFact: WorldHistoryEntry | undefined, pressures: Array<{ type: string; value: number }>): LocalSituationTrend {
  if (recentFact?.type.includes("relieved") || recentFact?.summary.includes("relieved")) return "improving";
  if (recentFact?.type.includes("reinforced") || recentFact?.type.includes("created")) return "worsening";
  if (tensions.some(tension => tension.type === "control_conflict" || tension.tags.includes("war") || tension.tags.includes("rival"))) return "contested";
  if (tensions.length > 0 || pressures.some(pressure => pressure.value >= 35)) return "active";
  return "stable";
}

function getRiskLabel(tensions: WorldTension[], pressures: Array<{ type: string; value: number }>): string {
  const maxTension = Math.max(0, ...tensions.map(tension => tension.severity));
  const maxPressure = Math.max(0, ...pressures.map(pressure => pressure.value));
  const max = Math.max(maxTension, maxPressure);
  if (max >= 75) return "critique";
  if (max >= 50) return "eleve";
  if (max >= 25) return "modere";
  return "faible";
}

function buildDevelopments(tensions: WorldTension[], pressures: Array<{ type: string; value: number }>, mobileLabels: string[]): string[] {
  const developments: string[] = [];
  const pressureTypes = new Set(pressures.filter(pressure => pressure.value >= 25).map(pressure => pressure.type));
  const tensionTypes = new Set(tensions.map(tension => tension.type));
  if (tensionTypes.has("scarcity") || pressureTypes.has("commercial")) developments.push("crise de marche ou besoin logistique");
  if (tensionTypes.has("mobility_risk") || pressureTypes.has("military")) developments.push("corridor a securiser ou convoi retarde");
  if (tensionTypes.has("criminal") || pressureTypes.has("criminal")) developments.push("opportunite criminelle ou reprise d'ordre");
  if (tensionTypes.has("social") || pressureTypes.has("social")) developments.push("agitation locale ou action civique");
  if (tensionTypes.has("political") || pressureTypes.has("political")) developments.push("tension politique ou controle territorial");
  if (mobileLabels.length > 0) developments.push("effet de mobilite a surveiller");
  return developments.slice(0, 4);
}

function buildHeadline(trend: LocalSituationTrend, riskLabel: string, pressures: Array<{ type: string; value: number }>, tensions: WorldTension[]): string {
  const mainPressure = pressures[0];
  const mainTension = tensions[0];
  if (mainTension) return `${trend} - tension ${mainTension.type} ${Math.round(mainTension.severity)} (${riskLabel})`;
  if (mainPressure) return `${trend} - pression ${mainPressure.type} ${mainPressure.value} (${riskLabel})`;
  return `${trend} - aucune pression dominante (${riskLabel})`;
}

export function summarizeLocalSituation(state: WorldState, refs: EntityRef[]): LocalSituationSummary {
  const uniqueRefs = unique(refs.map(ref => getEntityKey(ref))).map(key => {
    const [kind, id] = key.split(":");
    return { kind, id } as EntityRef;
  });
  const pressures = uniqueRefs.flatMap(ref => getEntityPressures(state, ref)).sort((left, right) => right.value - left.value).slice(0, 5);
  const tensions = getRelatedTensions(state, uniqueRefs);
  const recentFact = getRelatedRecentFact(state, uniqueRefs);
  const trend = deriveTrend(tensions, recentFact, pressures);
  const riskLabel = getRiskLabel(tensions, pressures);
  const involvedMobileLabels = getRelatedMobileLabels(state, uniqueRefs);

  return {
    headline: buildHeadline(trend, riskLabel, pressures, tensions),
    trend,
    dominantPressures: pressures,
    activeTensions: tensions,
    involvedFactionLabels: getRelatedFactionLabels(state, uniqueRefs),
    involvedMobileLabels,
    recentFact,
    riskLabel,
    nextLikelyDevelopments: buildDevelopments(tensions, pressures, involvedMobileLabels)
  };
}
