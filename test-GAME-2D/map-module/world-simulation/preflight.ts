import type {
  MapCell,
  PopulationProfile,
  SimulationAnchorTargetKind,
  SimulationActorPositionKind,
  SimulationObjectiveTargetKind,
  WorldMapLayout,
  WorldMapSimulationDistrict,
  WorldMapSimulationFactionAnchor,
  WorldMapSimulationDistrictOverride,
  WorldMapSimulationFaction,
  WorldMapSimulationMobileActor,
  WorldMapSimulationObjective
} from "../data/worldMapLayout";
import { WORLD_ACTION_DEFINITIONS } from "./definitions";
import { createSimulationSeedFromMapLayout, resolveMapCellToRuntimeRef } from "./mapAdapter";

export type SimulationPreflightSeverity = "error" | "warning";

export type SimulationPreflightIssue = {
  severity: SimulationPreflightSeverity;
  code: string;
  scope: "layout" | "faction" | "objective" | "mobileActor" | "district";
  entityId?: string;
  message: string;
};

export type SimulationPreflightReport = {
  issues: SimulationPreflightIssue[];
  errorCount: number;
  warningCount: number;
};

function pushIssue(
  issues: SimulationPreflightIssue[],
  issue: SimulationPreflightIssue
) {
  issues.push(issue);
}

function collectDuplicates(values: string[]): string[] {
  const counts = new Map<string, number>();
  values
    .filter(Boolean)
    .forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

function checkDuplicateIds(layout: WorldMapLayout, issues: SimulationPreflightIssue[]) {
  const groups = [
    { label: "city", ids: layout.cities.map(entry => entry.id) },
    { label: "path", ids: layout.paths.map(entry => entry.id) },
    { label: "governanceRegion", ids: (layout.governanceRegions ?? []).map(entry => entry.id) },
    { label: "geographicZone", ids: (layout.geographicZones ?? []).map(entry => entry.id) },
    { label: "simulationFaction", ids: (layout.simulation?.factions ?? []).map(entry => entry.id) },
    { label: "simulationObjective", ids: (layout.simulation?.specialObjectives ?? []).map(entry => entry.id) },
    { label: "simulationMobileActor", ids: (layout.simulation?.mobileActors ?? []).map(entry => entry.id) },
    { label: "simulationDistrict", ids: (layout.simulation?.districts ?? []).map(entry => entry.id) },
    { label: "simulationDistrictOverride", ids: (layout.simulation?.districtOverrides ?? []).map(entry => entry.id) }
  ];

  groups.forEach(group => {
    collectDuplicates(group.ids).forEach(duplicateId => {
      pushIssue(issues, {
        severity: "error",
        code: "duplicate_id",
        scope: "layout",
        entityId: duplicateId,
        message: `Id duplique detecte dans ${group.label}: ${duplicateId}.`
      });
    });
  });
}

function validatePopulationProfile(
  profile: PopulationProfile | undefined,
  issues: SimulationPreflightIssue[],
  context: { scope: SimulationPreflightIssue["scope"]; entityId: string; label: string }
) {
  if (!profile) return;
  if (!Array.isArray(profile.groups) || profile.groups.length === 0) {
    pushIssue(issues, {
      severity: "warning",
      code: "population_profile_empty",
      scope: context.scope,
      entityId: context.entityId,
      message: `${context.label} a un profil de population vide.`
    });
    return;
  }

  const duplicateGroupIds = collectDuplicates(profile.groups.map(group => group.groupId));
  duplicateGroupIds.forEach(groupId => {
    pushIssue(issues, {
      severity: "warning",
      code: "population_profile_duplicate_group",
      scope: context.scope,
      entityId: context.entityId,
      message: `${context.label} duplique le groupe de population ${groupId}.`
    });
  });

  const totalWeight = profile.groups.reduce((sum, group) => sum + Math.max(0, Number(group.weight) || 0), 0);
  if (totalWeight <= 0) {
    pushIssue(issues, {
      severity: "warning",
      code: "population_profile_zero_weight",
      scope: context.scope,
      entityId: context.entityId,
      message: `${context.label} a un profil de population sans poids exploitable.`
    });
  }

  if (profile.dominantGroupId && !profile.groups.some(group => group.groupId === profile.dominantGroupId)) {
    pushIssue(issues, {
      severity: "warning",
      code: "population_profile_unknown_dominant_group",
      scope: context.scope,
      entityId: context.entityId,
      message: `${context.label} declare un groupe dominant absent de ses groupes: ${profile.dominantGroupId}.`
    });
  }
}

function validateNativeDistrict(
  layout: WorldMapLayout,
  district: WorldMapSimulationDistrict,
  issues: SimulationPreflightIssue[]
) {
  validatePopulationProfile(district.populationProfile, issues, {
    scope: "district",
    entityId: district.id,
    label: `Le quartier ${district.id}`
  });
  if (!district.name.trim()) {
    pushIssue(issues, {
      severity: "error",
      code: "district_missing_name",
      scope: "district",
      entityId: district.id,
      message: `Le quartier natif ${district.id} n'a pas de nom.`
    });
  }
  if (!layout.cities.some(city => city.id === district.cityId)) {
    pushIssue(issues, {
      severity: "error",
      code: "district_unknown_city",
      scope: "district",
      entityId: district.id,
      message: `Le quartier natif ${district.id} reference une ville inconnue: ${district.cityId}.`
    });
  }
  if ((district.cellKeys ?? []).length === 0) {
    pushIssue(issues, {
      severity: "warning",
      code: "district_no_cells",
      scope: "district",
      entityId: district.id,
      message: `Le quartier natif ${district.id} n'a aucune cellule attribuee.`
    });
  }
  (district.cellKeys ?? []).forEach(cellKey => {
    if (layout.cells.some(cell => `${cell.cell.x},${cell.cell.y}` === cellKey)) return;
    pushIssue(issues, {
      severity: "warning",
      code: "district_unknown_cell",
      scope: "district",
      entityId: district.id,
      message: `Le quartier natif ${district.id} reference une cellule inconnue: ${cellKey}.`
    });
  });
}

function getKnownDistrictIds(layout: WorldMapLayout): Set<string> {
  return new Set(Object.keys(createSimulationSeedFromMapLayout(layout).districts));
}

function isKnownZoneId(layout: WorldMapLayout, knownDistrictIds: Set<string>, zoneId: string): boolean {
  return (
    layout.cities.some(entry => entry.id === zoneId) ||
    layout.paths.some(entry => entry.id === zoneId) ||
    (layout.governanceRegions ?? []).some(entry => entry.id === zoneId) ||
    (layout.geographicZones ?? []).some(entry => entry.id === zoneId) ||
    (layout.simulation?.factions ?? []).some(entry => entry.id === zoneId) ||
    knownDistrictIds.has(zoneId)
  );
}

function isKnownAnchorTarget(
  layout: WorldMapLayout,
  knownDistrictIds: Set<string>,
  targetKind: SimulationAnchorTargetKind,
  targetId: string | undefined,
  cell: WorldMapSimulationFactionAnchor["cell"]
): boolean {
  if (targetKind === "cell") {
    if (!cell) return false;
    return layout.cells.some(entry => entry.cell.x === cell.x && entry.cell.y === cell.y);
  }
  if (targetKind === "place") {
    return Boolean(targetId) && layout.cells.some(entry => (entry.locationWikiIds ?? []).includes(targetId ?? ""));
  }
  return Boolean(targetId) && isKnownZoneId(layout, knownDistrictIds, targetId ?? "");
}

function getKnownObjectiveTarget(
  layout: WorldMapLayout,
  knownDistrictIds: Set<string>,
  targetKind: SimulationObjectiveTargetKind | undefined,
  targetId: string | undefined
): boolean {
  if (!targetKind || !targetId) return true;
  if (targetKind === "city") return layout.cities.some(entry => entry.id === targetId);
  if (targetKind === "route") return layout.paths.some(entry => entry.id === targetId && entry.kind === "road");
  if (targetKind === "region") return (layout.governanceRegions ?? []).some(entry => entry.id === targetId);
  if (targetKind === "faction") return (layout.simulation?.factions ?? []).some(entry => entry.id === targetId);
  if (targetKind === "district") return knownDistrictIds.has(targetId);
  if (targetKind === "place") {
    return layout.cells.some(cell => (cell.locationWikiIds ?? []).includes(targetId));
  }
  return false;
}

function validateFaction(
  layout: WorldMapLayout,
  knownDistrictIds: Set<string>,
  faction: WorldMapSimulationFaction,
  issues: SimulationPreflightIssue[]
) {
  validatePopulationProfile(faction.populationProfile, issues, {
    scope: "faction",
    entityId: faction.id,
    label: `La faction ${faction.id}`
  });
  if (!faction.label.trim()) {
    pushIssue(issues, {
      severity: "error",
      code: "faction_missing_label",
      scope: "faction",
      entityId: faction.id,
      message: `La faction ${faction.id} n'a pas de label.`
    });
  }
  if (faction.homeCityId && !layout.cities.some(city => city.id === faction.homeCityId)) {
    pushIssue(issues, {
      severity: "error",
      code: "faction_unknown_home_city",
      scope: "faction",
      entityId: faction.id,
      message: `La faction ${faction.id} reference une ville d'ancrage inconnue: ${faction.homeCityId}.`
    });
  }
  if (faction.homeRegionId && !(layout.governanceRegions ?? []).some(region => region.id === faction.homeRegionId)) {
    pushIssue(issues, {
      severity: "error",
      code: "faction_unknown_home_region",
      scope: "faction",
      entityId: faction.id,
      message: `La faction ${faction.id} reference une region d'ancrage inconnue: ${faction.homeRegionId}.`
    });
  }
  if (!faction.homeCityId && !faction.homeRegionId && faction.presenceCells.length === 0) {
    pushIssue(issues, {
      severity: "warning",
      code: "faction_no_anchor",
      scope: "faction",
      entityId: faction.id,
      message: `La faction ${faction.id} n'a ni ancrage ni presence spatiale definie.`
    });
  }
  const inheritedCityProfile = faction.homeCityId
    ? layout.cities.find(city => city.id === faction.homeCityId)?.populationProfile
    : undefined;
  if (!faction.populationProfile && !inheritedCityProfile) {
    pushIssue(issues, {
      severity: "warning",
      code: "faction_missing_population_profile",
      scope: "faction",
      entityId: faction.id,
      message: `La faction ${faction.id} n'a ni profil de population explicite ni heritage depuis sa ville d'ancrage.`
    });
  }
  (
    [
      ["controlledZoneIds", faction.controlledZoneIds ?? []],
      ["influencedZoneIds", faction.influencedZoneIds ?? []],
      ["interestZoneIds", faction.interestZoneIds ?? []],
      ["avoidedZoneIds", faction.avoidedZoneIds ?? []]
    ] as const
  ).forEach(([zoneField, zoneIds]) => {
    zoneIds.forEach(zoneId => {
      if (isKnownZoneId(layout, knownDistrictIds, zoneId)) return;
      pushIssue(issues, {
        severity: "warning",
        code: "faction_unknown_zone",
        scope: "faction",
        entityId: faction.id,
        message: `La faction ${faction.id} reference une zone non resolue dans ${zoneField}: ${zoneId}.`
      });
    });
  });
  (faction.localAnchors ?? []).forEach(anchor => {
    if (!anchor.label.trim()) {
      pushIssue(issues, {
        severity: "warning",
        code: "faction_anchor_missing_label",
        scope: "faction",
        entityId: faction.id,
        message: `La faction ${faction.id} a un ancrage local sans label: ${anchor.id}.`
      });
    }
    if (!isKnownAnchorTarget(layout, knownDistrictIds, anchor.targetKind, anchor.targetId, anchor.cell)) {
      pushIssue(issues, {
        severity: "warning",
        code: "faction_anchor_unknown_target",
        scope: "faction",
        entityId: faction.id,
        message: `La faction ${faction.id} reference un ancrage local non resolu: ${anchor.id}.`
      });
    }
  });
  faction.relations.forEach(relation => {
    if (relation.targetFactionId === faction.id) {
      pushIssue(issues, {
        severity: "error",
        code: "faction_self_relation",
        scope: "faction",
        entityId: faction.id,
        message: `La faction ${faction.id} ne peut pas avoir une relation vers elle-meme.`
      });
    }
    if (!(layout.simulation?.factions ?? []).some(entry => entry.id === relation.targetFactionId)) {
      pushIssue(issues, {
        severity: "error",
        code: "faction_unknown_relation_target",
        scope: "faction",
        entityId: faction.id,
        message: `La faction ${faction.id} reference une relation vers une faction inconnue: ${relation.targetFactionId}.`
      });
    }
  });
}

function validateObjective(
  layout: WorldMapLayout,
  knownDistrictIds: Set<string>,
  objective: WorldMapSimulationObjective,
  issues: SimulationPreflightIssue[]
) {
  const knownActionDefinitions = new Map(WORLD_ACTION_DEFINITIONS.map(action => [action.id, action]));
  const ownerFaction = (layout.simulation?.factions ?? []).find(faction => faction.id === objective.ownerFactionId);
  if (!(layout.simulation?.factions ?? []).some(faction => faction.id === objective.ownerFactionId)) {
    pushIssue(issues, {
      severity: "error",
      code: "objective_unknown_owner",
      scope: "objective",
      entityId: objective.id,
      message: `L'objectif ${objective.id} reference une faction proprietaire inconnue: ${objective.ownerFactionId}.`
    });
  }
  if (
    (objective.currentPhaseIndex ?? 0) > Math.max(0, (objective.phases ?? []).length - 1) &&
    (objective.phases ?? []).length > 0
  ) {
    pushIssue(issues, {
      severity: "warning",
      code: "objective_phase_index_out_of_bounds",
      scope: "objective",
      entityId: objective.id,
      message: `L'objectif ${objective.id} a un currentPhaseIndex hors limites pour ses phases declarees.`
    });
  }
  if (objective.requiredAnchorId && ownerFaction && !(ownerFaction.localAnchors ?? []).some(anchor => anchor.id === objective.requiredAnchorId)) {
    pushIssue(issues, {
      severity: "warning",
      code: "objective_unknown_required_anchor",
      scope: "objective",
      entityId: objective.id,
      message: `L'objectif ${objective.id} reference un ancrage requis inconnu pour sa faction: ${objective.requiredAnchorId}.`
    });
  }
  if (
    objective.requiredAnchorType &&
    ownerFaction &&
    !(ownerFaction.localAnchors ?? []).some(anchor => anchor.type === objective.requiredAnchorType)
  ) {
    pushIssue(issues, {
      severity: "warning",
      code: "objective_missing_required_anchor_type",
      scope: "objective",
      entityId: objective.id,
      message: `L'objectif ${objective.id} exige un type d'ancrage non present chez sa faction: ${objective.requiredAnchorType}.`
    });
  }
  if (!getKnownObjectiveTarget(layout, knownDistrictIds, objective.targetKind, objective.targetId)) {
    pushIssue(issues, {
      severity: "error",
      code: "objective_unknown_target",
      scope: "objective",
      entityId: objective.id,
      message: `L'objectif ${objective.id} reference une cible inconnue ou non supportee: ${objective.targetKind ?? "none"} / ${objective.targetId ?? "none"}.`
    });
  }
  if (objective.compatibleActionIds.length === 0) {
    pushIssue(issues, {
      severity: "warning",
      code: "objective_no_compatible_actions",
      scope: "objective",
      entityId: objective.id,
      message: `L'objectif ${objective.id} n'a pas d'actions compatibles explicites.`
    });
  }
  objective.compatibleActionIds.forEach(actionId => {
    const definition = knownActionDefinitions.get(actionId as never);
    if (!definition) {
      pushIssue(issues, {
        severity: "warning",
        code: "objective_unknown_action",
        scope: "objective",
        entityId: objective.id,
        message: `L'objectif ${objective.id} reference une action inconnue: ${actionId}.`
      });
      return;
    }
    if (!definition.compatibleObjectives.includes(objective.category as never)) {
      pushIssue(issues, {
        severity: "warning",
        code: "objective_incompatible_action",
        scope: "objective",
        entityId: objective.id,
        message: `L'objectif ${objective.id} reference l'action ${actionId}, non prevue pour la categorie ${objective.category}.`
      });
    }
  });
  objective.zoneIds.forEach(zoneId => {
    if (!isKnownZoneId(layout, knownDistrictIds, zoneId)) {
      pushIssue(issues, {
        severity: "warning",
        code: "objective_unknown_zone",
        scope: "objective",
        entityId: objective.id,
        message: `L'objectif ${objective.id} reference une zone non resolue: ${zoneId}.`
      });
    }
  });
}

function validateDistrictOverride(
  layout: WorldMapLayout,
  knownDistrictIds: Set<string>,
  districtOverride: WorldMapSimulationDistrictOverride,
  issues: SimulationPreflightIssue[]
) {
  validatePopulationProfile(districtOverride.populationProfile, issues, {
    scope: "district",
    entityId: districtOverride.id,
    label: `Le quartier ${districtOverride.id}`
  });

  if (!layout.cities.some(city => city.id === districtOverride.cityId)) {
    pushIssue(issues, {
      severity: "error",
      code: "district_override_unknown_city",
      scope: "district",
      entityId: districtOverride.id,
      message: `Le quartier ${districtOverride.id} reference une ville inconnue: ${districtOverride.cityId}.`
    });
  }

  if (!knownDistrictIds.has(districtOverride.id)) {
    pushIssue(issues, {
      severity: "warning",
      code: "district_override_unknown_district",
      scope: "district",
      entityId: districtOverride.id,
      message: `Le quartier ${districtOverride.id} ne correspond a aucun quartier derive de la carte actuelle.`
    });
  }
}

function validateCityDistrictModel(layout: WorldMapLayout, knownDistrictIds: Set<string>, issues: SimulationPreflightIssue[]) {
  layout.cities.forEach(city => {
    const nativeDistricts = (layout.simulation?.districts ?? []).filter(district => district.cityId === city.id);
    const districtOverrides = (layout.simulation?.districtOverrides ?? []).filter(override => override.cityId === city.id);
    const derivedDistrictIds = [...knownDistrictIds].filter(districtId => districtId.startsWith(`${city.id}:`));

    if (nativeDistricts.length > 0 && districtOverrides.length > 0) {
      pushIssue(issues, {
        severity: "warning",
        code: "city_mixed_district_modes",
        scope: "layout",
        entityId: city.id,
        message: `La ville ${city.id} combine quartiers natifs et overrides de quartiers derives. La convention du module recommande de choisir un mode principal par ville.`
      });
    }

    if (nativeDistricts.length === 0 && derivedDistrictIds.length === 0) {
      pushIssue(issues, {
        severity: "warning",
        code: "city_without_simulation_districts",
        scope: "layout",
        entityId: city.id,
        message: `La ville ${city.id} n'a ni quartier natif ni quartier derive resolu. La lecture locale de simulation sera tres pauvre.`
      });
    }

    if (nativeDistricts.length > 0 && nativeDistricts.every(district => (district.cellKeys ?? []).length === 0)) {
      pushIssue(issues, {
        severity: "warning",
        code: "city_native_districts_without_cells",
        scope: "layout",
        entityId: city.id,
        message: `La ville ${city.id} est en mode natif mais aucun de ses quartiers natifs n'a de cellules exploitables.`
      });
    }
  });
}

function getRouteById(layout: WorldMapLayout, routeId: string) {
  return layout.paths.find(path => path.id === routeId && path.kind === "road");
}

function getRouteEndpointKeys(layout: WorldMapLayout, routeId: string): { startKey: string; endKey: string } | null {
  const route = getRouteById(layout, routeId);
  if (!route || route.cells.length === 0) return null;
  return {
    startKey: `${route.cells[0].x},${route.cells[0].y}`,
    endKey: `${route.cells[route.cells.length - 1].x},${route.cells[route.cells.length - 1].y}`
  };
}

function hasKnownCell(layout: WorldMapLayout, cell: MapCell | undefined): boolean {
  return Boolean(cell) && layout.cells.some(entry => entry.cell.x === cell?.x && entry.cell.y === cell?.y);
}

function getRegionAnchorCellKey(layout: WorldMapLayout, regionId: string): string | null {
  const region = (layout.governanceRegions ?? []).find(entry => entry.id === regionId);
  if (!region) return null;
  if (region.principalCityId) {
    const city = layout.cities.find(entry => entry.id === region.principalCityId);
    if (city) return `${city.cell.x},${city.cell.y}`;
  }
  return `${region.labelCell.x},${region.labelCell.y}`;
}

function getPositionNodeId(
  layout: WorldMapLayout,
  kind: SimulationActorPositionKind,
  id: string | undefined,
  cell?: MapCell
): string | null {
  if (kind === "cell") {
    const runtimeRef = cell ? resolveMapCellToRuntimeRef(layout, cell) : undefined;
    if (!runtimeRef) return null;
    if (runtimeRef.kind === "city" || runtimeRef.kind === "route" || runtimeRef.kind === "region") {
      return getPositionNodeId(layout, runtimeRef.kind, runtimeRef.id);
    }
    return null;
  }
  if (kind === "city") {
    const city = id ? layout.cities.find(entry => entry.id === id) : null;
    return city ? `${city.cell.x},${city.cell.y}` : null;
  }
  if (kind === "region") {
    return id ? getRegionAnchorCellKey(layout, id) : null;
  }
  if (kind === "route") {
    const endpoints = id ? getRouteEndpointKeys(layout, id) : null;
    return endpoints ? endpoints.startKey : null;
  }
  return null;
}

function validateItinerary(
  layout: WorldMapLayout,
  actor: WorldMapSimulationMobileActor,
  issues: SimulationPreflightIssue[]
) {
  const itinerary = actor.itineraryRouteIds;
  if (itinerary.length === 0) return;

  const missingRoutes = itinerary.filter(routeId => !getRouteById(layout, routeId));
  missingRoutes.forEach(routeId => {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_unknown_itinerary_route",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} reference une route d'itineraire inconnue ou non routiere: ${routeId}.`
    });
  });
  if (missingRoutes.length > 0) return;

  const startNodeId = getPositionNodeId(layout, actor.positionKind, actor.positionId, actor.positionCell);
  if (!startNodeId) {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_unknown_position",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} a une position initiale invalide pour verifier son itineraire.`
    });
    return;
  }

  let expectedNodeId: string | null = startNodeId;
  itinerary.forEach((routeId, index) => {
    const endpoints = getRouteEndpointKeys(layout, routeId);
    if (!endpoints) return;
    if (index === 0 && actor.positionKind === "route" && actor.positionId === routeId) {
      expectedNodeId = endpoints.endKey;
      return;
    }
    if (expectedNodeId && endpoints.startKey !== expectedNodeId && endpoints.endKey !== expectedNodeId) {
      pushIssue(issues, {
        severity: "error",
        code: "mobile_broken_itinerary_chain",
        scope: "mobileActor",
        entityId: actor.id,
        message: `L'itineraire du mobile ${actor.id} n'est pas continu sur la route ${routeId}.`
      });
      expectedNodeId = null;
      return;
    }
    if (!expectedNodeId) return;
    expectedNodeId = endpoints.startKey === expectedNodeId ? endpoints.endKey : endpoints.startKey;
  });

  const destinationNodeId = actor.destinationKind
    ? getPositionNodeId(layout, actor.destinationKind, actor.destinationId, actor.destinationCell)
    : null;
  if (expectedNodeId && destinationNodeId) {
    if (expectedNodeId !== destinationNodeId) {
      pushIssue(issues, {
        severity: "warning",
        code: "mobile_itinerary_destination_mismatch",
        scope: "mobileActor",
        entityId: actor.id,
        message: `L'itineraire du mobile ${actor.id} ne se termine pas sur sa destination declaree (${actor.destinationId}).`
      });
    }
  }
}

function validateMobileActor(
  layout: WorldMapLayout,
  actor: WorldMapSimulationMobileActor,
  issues: SimulationPreflightIssue[]
) {
  validatePopulationProfile(actor.populationProfile, issues, {
    scope: "mobileActor",
    entityId: actor.id,
    label: `Le mobile ${actor.id}`
  });
  if (actor.ownerFactionId && !(layout.simulation?.factions ?? []).some(faction => faction.id === actor.ownerFactionId)) {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_unknown_owner",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} reference une faction inconnue: ${actor.ownerFactionId}.`
    });
  }

  actor.objectiveIds.forEach(objectiveId => {
    if (!(layout.simulation?.specialObjectives ?? []).some(objective => objective.id === objectiveId)) {
      pushIssue(issues, {
        severity: "error",
        code: "mobile_unknown_objective",
        scope: "mobileActor",
        entityId: actor.id,
        message: `Le mobile ${actor.id} reference un objectif inconnu: ${objectiveId}.`
      });
    }
  });

  if (actor.positionKind === "city" && actor.positionId && !layout.cities.some(city => city.id === actor.positionId)) {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_unknown_city_position",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} reference une ville de position inconnue: ${actor.positionId}.`
    });
  }
  if (actor.positionKind === "region" && actor.positionId && !(layout.governanceRegions ?? []).some(region => region.id === actor.positionId)) {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_unknown_region_position",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} reference une region de position inconnue: ${actor.positionId}.`
    });
  }
  if (actor.positionKind === "route" && actor.positionId && !getRouteById(layout, actor.positionId)) {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_unknown_route_position",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} reference une route de position inconnue ou non routiere: ${actor.positionId}.`
    });
  }

  if (actor.positionKind === "cell") {
    if (!actor.positionCell) {
      pushIssue(issues, {
        severity: "error",
        code: "mobile_missing_position_cell",
        scope: "mobileActor",
        entityId: actor.id,
        message: `Le mobile ${actor.id} utilise une position de type cell sans coordonnees de cellule.`
      });
    }
    if (actor.positionCell && !hasKnownCell(layout, actor.positionCell)) {
      pushIssue(issues, {
        severity: "error",
        code: "mobile_unknown_position_cell",
        scope: "mobileActor",
        entityId: actor.id,
        message: `Le mobile ${actor.id} reference une cellule de position inconnue: ${actor.positionCell.x},${actor.positionCell.y}.`
      });
    }
  } else if (!actor.positionId) {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_missing_position_id",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} n'a pas d'id de position.`
    });
  }

  if (actor.destinationKind === "city" && actor.destinationId && !layout.cities.some(city => city.id === actor.destinationId)) {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_unknown_city_destination",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} reference une ville de destination inconnue: ${actor.destinationId}.`
    });
  }
  if (actor.destinationKind === "region" && actor.destinationId && !(layout.governanceRegions ?? []).some(region => region.id === actor.destinationId)) {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_unknown_region_destination",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} reference une region de destination inconnue: ${actor.destinationId}.`
    });
  }
  if (actor.destinationKind === "route" && actor.destinationId && !getRouteById(layout, actor.destinationId)) {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_unknown_route_destination",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} reference une route de destination inconnue ou non routiere: ${actor.destinationId}.`
    });
  }

  if (actor.destinationKind === "cell") {
    if (!actor.destinationCell) {
      pushIssue(issues, {
        severity: "error",
        code: "mobile_missing_destination_cell",
        scope: "mobileActor",
        entityId: actor.id,
        message: `Le mobile ${actor.id} utilise une destination de type cell sans coordonnees de cellule.`
      });
    }
    if (actor.destinationCell && !hasKnownCell(layout, actor.destinationCell)) {
      pushIssue(issues, {
        severity: "error",
        code: "mobile_unknown_destination_cell",
        scope: "mobileActor",
        entityId: actor.id,
        message: `Le mobile ${actor.id} reference une cellule de destination inconnue: ${actor.destinationCell.x},${actor.destinationCell.y}.`
      });
    }
  } else if (actor.destinationKind && !actor.destinationId) {
    pushIssue(issues, {
      severity: "error",
      code: "mobile_missing_destination_id",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} a un type de destination sans id de destination.`
    });
  }

  const ownerFaction = actor.ownerFactionId
    ? (layout.simulation?.factions ?? []).find(faction => faction.id === actor.ownerFactionId)
    : undefined;
  const inheritedFactionProfile = ownerFaction?.populationProfile;
  const inheritedCityProfile = ownerFaction?.homeCityId
    ? layout.cities.find(city => city.id === ownerFaction.homeCityId)?.populationProfile
    : undefined;
  if (!actor.populationProfile && !inheritedFactionProfile && !inheritedCityProfile) {
    pushIssue(issues, {
      severity: "warning",
      code: "mobile_missing_population_profile",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} n'a ni profil de population explicite ni heritage exploitable depuis sa faction.`
    });
  }

  if (actor.itineraryMode === "locked" && actor.itineraryRouteIds.length === 0) {
    pushIssue(issues, {
      severity: "warning",
      code: "mobile_locked_itinerary_without_routes",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} est en itineraire verrouille sans route definie.`
    });
  }

  if (actor.itineraryMode !== "locked" && actor.itineraryRouteIds.length > 0) {
    pushIssue(issues, {
      severity: "warning",
      code: "mobile_manual_itinerary_not_locked",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} a un itineraire manuel mais reste en mode auto: le runtime peut le recalculer.`
    });
  }

  if (
    actor.simulationLevel === "abstract" &&
    (
      actor.positionKind === "cell" ||
      actor.destinationKind === "cell" ||
      actor.itineraryRouteIds.length > 0
    )
  ) {
    pushIssue(issues, {
      severity: "warning",
      code: "mobile_abstract_with_precise_spatial_config",
      scope: "mobileActor",
      entityId: actor.id,
      message: `Le mobile ${actor.id} est abstrait mais utilise une configuration spatiale tres precise (cellule ou itineraire detaille).`
    });
  }

  validateItinerary(layout, actor, issues);
}

export function runSimulationPreflight(layout: WorldMapLayout): SimulationPreflightReport {
  const issues: SimulationPreflightIssue[] = [];
  const knownDistrictIds = getKnownDistrictIds(layout);

  checkDuplicateIds(layout, issues);
  layout.cities.forEach(city =>
    validatePopulationProfile(city.populationProfile, issues, {
      scope: "layout",
      entityId: city.id,
      label: `La ville ${city.id}`
    })
  );
  validateCityDistrictModel(layout, knownDistrictIds, issues);
  (layout.simulation?.factions ?? []).forEach(faction => validateFaction(layout, knownDistrictIds, faction, issues));
  (layout.simulation?.specialObjectives ?? []).forEach(objective => validateObjective(layout, knownDistrictIds, objective, issues));
  (layout.simulation?.districts ?? []).forEach(district => validateNativeDistrict(layout, district, issues));
  (layout.simulation?.districtOverrides ?? []).forEach(districtOverride =>
    validateDistrictOverride(layout, knownDistrictIds, districtOverride, issues)
  );
  (layout.simulation?.mobileActors ?? []).forEach(actor => validateMobileActor(layout, actor, issues));

  return {
    issues,
    errorCount: issues.filter(issue => issue.severity === "error").length,
    warningCount: issues.filter(issue => issue.severity === "warning").length
  };
}
