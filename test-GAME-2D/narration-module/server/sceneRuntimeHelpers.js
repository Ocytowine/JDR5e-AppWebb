function createSceneRuntimeHelpers(deps) {
  const {
    safeString,
    normalizeLooseText,
    slugifyLoose,
    readWeightedRoleList,
    resolveLocationGenerationProfile,
    readStringArrayField,
    hashString,
    readVisibleExitsField,
    buildLanguageSeedFromGenerationProfile,
    resolveLocationLoreContext,
    buildActorDistinctiveSeed,
    buildActorProfileRecord,
    applyActorLanguageSeed,
    applyActorContextFromGenerationProfile,
    syncSceneActorSnapshots
  } = deps;

  function buildLocationRuntimeSeed(locationId, selectedLoreEntries) {
    const entries = Array.isArray(selectedLoreEntries) ? selectedLoreEntries : [];
    const matchingEntry = entries.find((entry) => safeString(entry?.entity_id) === safeString(locationId));
    if (!matchingEntry || typeof matchingEntry !== "object") {
      return {
        display_name: locationId,
        subtype: "scene_anchor",
        connected_locations: [],
        active_points_of_interest: []
      };
    }
    const keyFacts = matchingEntry.key_facts && typeof matchingEntry.key_facts === "object"
      ? matchingEntry.key_facts
      : {};
    const connectedLocations = Array.isArray(keyFacts.lieux_connectes)
      ? keyFacts.lieux_connectes.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
    const activePointsOfInterest = Array.isArray(keyFacts.fonction_principale)
      ? keyFacts.fonction_principale.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 4)
      : [];
    const visibleExits = connectedLocations.map((destinationId) => ({
      exit_id: `exit_${slugifyLoose(locationId)}_${slugifyLoose(destinationId)}`,
      label_visible: `un passage vers ${destinationId.replace(/_/g, " ")}`,
      destination_id: destinationId,
      access_state: "open",
      guarded: false
    }));
    const ambientMarkers = [];
    const normalizedType = normalizeLooseText(safeString(keyFacts.type_batiment, safeString(matchingEntry.type)));
    if (normalizedType.includes("halle")) {
      ambientMarkers.push("murmures de negociations", "va et vient de marchandises");
    } else if (normalizedType.includes("archive")) {
      ambientMarkers.push("bruissement de papier", "allers retours de clercs");
    } else if (normalizedType.includes("caserne")) {
      ambientMarkers.push("bruit de pas reguliers", "discipline tendue des lieux");
    }
    return {
      display_name: safeString(matchingEntry.name, locationId),
      subtype: safeString(keyFacts.type_batiment, safeString(matchingEntry.type, "scene_anchor")) || "scene_anchor",
      connected_locations: connectedLocations,
      active_points_of_interest: activePointsOfInterest,
      ambient_markers: ambientMarkers.slice(0, 4),
      visible_exits: visibleExits.slice(0, 4)
    };
  }

  function buildSceneActorEntityId(locationId, role, index = 1) {
    return `${slugifyLoose(locationId, "scene")}_${slugifyLoose(role, "acteur")}_${String(index).padStart(2, "0")}`;
  }

  function inferVisibleSceneRoles(narrationContext, locationId) {
    const text = normalizeLooseText(narrationContext);
    const roles = [];
    const pushRole = (role) => {
      if (!roles.includes(role)) roles.push(role);
    };
    if (/\bgarde\b|\bgardes\b/.test(text)) pushRole("garde");
    if (/\bclerc\b|\bclercs\b/.test(text)) pushRole("clerc");
    if (/\barchiviste\b|\barchivistes\b/.test(text)) pushRole("archiviste");
    if (/\bmarchand\b|\bmarchands\b/.test(text)) pushRole("marchand");
    if (/\bofficier\b|\bofficiers\b/.test(text)) pushRole("officier");
    return roles.map((role, index) => ({
      entity_id: buildSceneActorEntityId(locationId, role, index + 1),
      role,
      display_name: role
    }));
  }

  function inferAmbientSceneRoles(locationId, narrationContext, maxActors = 3) {
    const explicitRoles = inferVisibleSceneRoles(narrationContext, locationId)
      .map((item) => safeString(item?.role))
      .filter(Boolean);
    const locationProfile = resolveLocationGenerationProfile(locationId);
    const likelyRoles = readWeightedRoleList(locationProfile?.presence_profile?.likely_roles)
      .sort((left, right) => (Number(right.weight) || 0) - (Number(left.weight) || 0))
      .map((entry) => safeString(entry.role))
      .filter((role) => role && role !== "pnj_lambda");
    const mergedRoles = [];
    for (const role of [...explicitRoles, ...likelyRoles]) {
      if (!role || mergedRoles.includes(role)) continue;
      mergedRoles.push(role);
      if (mergedRoles.length >= maxActors) break;
    }
    return mergedRoles.map((role, index) => ({
      entity_id: buildSceneActorEntityId(locationId, role, index + 1),
      role,
      display_name: role
    }));
  }

  function computeObserveVisibleActorBudget(locationId, narrationContext) {
    const normalized = normalizeLooseText(narrationContext);
    if (!normalized) return 0;
    const explicitRoles = inferVisibleSceneRoles(narrationContext, locationId);
    if (explicitRoles.length > 0) {
      return Math.min(3, explicitRoles.length);
    }
    const crowdedSignals = [
      "foule",
      "bond",
      "bruyant",
      "circulation dense",
      "va et vient",
      "anime",
      "agite",
      "quai charge"
    ];
    const sparseSignals = [
      "vide",
      "desert",
      "silencieux",
      "calme",
      "presque personne",
      "personne en vue",
      "solitaire",
      "aucune personne",
      "personne a portee",
      "personne discernable"
    ];
    if (
      normalized.includes("aucune personne") ||
      normalized.includes("personne a portee") ||
      normalized.includes("personne discernable")
    ) {
      return 0;
    }
    if (crowdedSignals.some((signal) => normalized.includes(signal))) {
      return 2 + (hashString(`${locationId}|${normalized}|crowded`) % 2);
    }
    if (sparseSignals.some((signal) => normalized.includes(signal))) {
      return hashString(`${locationId}|${normalized}|sparse`) % 2;
    }
    return hashString(`${locationId}|${normalized}|neutral`) % 3;
  }

  function readScenePerceptionState(locationRuntimeState) {
    const locationPayload =
      locationRuntimeState?.payload && typeof locationRuntimeState.payload === "object"
        ? locationRuntimeState.payload
        : {};
    const scenePayload =
      locationPayload.scene_payload && typeof locationPayload.scene_payload === "object"
        ? locationPayload.scene_payload
        : {};
    const visibleActorIds = readStringArrayField(
      Array.isArray(scenePayload.visible_actors)
        ? scenePayload.visible_actors
        : locationPayload.visible_actors
    );
    const ambientMarkers = readStringArrayField(scenePayload.ambient_markers);
    const activePointsOfInterest = readStringArrayField(
      Array.isArray(scenePayload.active_points_of_interest)
        ? scenePayload.active_points_of_interest
        : locationPayload.active_points_of_interest
    );
    const visibleExits = readVisibleExitsField(scenePayload.visible_exits);
    const identifiableActorCount = visibleActorIds.length;
    const contactableActorCount = visibleActorIds.length;
    const crowdMode =
      contactableActorCount > 0
        ? "contactable"
        : ambientMarkers.length > 0 || activePointsOfInterest.length > 0 || visibleExits.length > 0
          ? "diffuse"
          : "empty";
    return {
      visible_actor_ids: visibleActorIds,
      visible_actor_count: visibleActorIds.length,
      identifiable_actor_count: identifiableActorCount,
      contactable_actor_count: contactableActorCount,
      active_points_of_interest: activePointsOfInterest,
      visible_exits: visibleExits.map((entry) => ({
        destination_id: safeString(entry?.destination_id),
        label_visible: safeString(entry?.label_visible)
      })),
      ambient_markers: ambientMarkers,
      crowd_mode: crowdMode,
      immediate_social_presence:
        contactableActorCount > 0 ? "contactable" : crowdMode === "diffuse" ? "diffuse" : "none",
      can_address_someone_now: contactableActorCount > 0,
      ambient_only: contactableActorCount === 0 && crowdMode === "diffuse"
    };
  }

  function buildScenePerceptionGuidance(scenePerception) {
    const perception = scenePerception && typeof scenePerception === "object" ? scenePerception : {};
    if (Number(perception.contactable_actor_count || 0) > 0) {
      return "Des acteurs sont a portee sociale immediate.";
    }
    if (safeString(perception.immediate_social_presence) === "diffuse") {
      return "Presence humaine diffuse seulement: personne n'est clairement identifiable ou abordable a courte portee.";
    }
    return "Aucune presence sociale immediate n'est materialisee dans la scene.";
  }

  function buildApproachClarificationQuestion(actorHint, scenePerception, locationId) {
    const hint = safeString(actorHint, "cet interlocuteur");
    const points = readStringArrayField(scenePerception?.active_points_of_interest).slice(0, 3);
    if (points.length > 0) {
      return `Tu veux te rapprocher de quelle zone pour trouver ${hint} ? ${points.join(", ")}.`;
    }
    const exits = Array.isArray(scenePerception?.visible_exits)
      ? scenePerception.visible_exits
          .map((entry) => safeString(entry?.label_visible || entry?.destination_id))
          .filter(Boolean)
          .slice(0, 2)
      : [];
    if (exits.length > 0) {
      return `Aucune personne clairement abordable n'est a portee immediate ici. Tu veux te rapprocher de quelle direction ? ${exits.join(", ")}.`;
    }
    return `Aucune personne clairement abordable n'est a portee immediate dans ${locationId.replace(/_/g, " ")}. Observe mieux la scene ou vise une zone plus precise.`;
  }

  function getVisibleActorRecords(memoryService, campaignId, locationId) {
    const locationEntity = memoryService.getEntity(campaignId, locationId);
    const visibleActorIds = Array.isArray(locationEntity?.payload?.visible_actors)
      ? locationEntity.payload.visible_actors.map((item) => safeString(item)).filter(Boolean)
      : [];
    return visibleActorIds
      .map((actorId) => memoryService.getEntity(campaignId, actorId))
      .filter(Boolean);
  }

  function getNextSceneRoleIndex(actorRecords, locationId, role) {
    const normalizedRole = normalizeLooseText(role);
    let highestIndex = 0;
    for (const actor of Array.isArray(actorRecords) ? actorRecords : []) {
      if (normalizeLooseText(actor?.payload?.identity?.role) !== normalizedRole) continue;
      const entityId = safeString(actor?.entity_id);
      const match = entityId.match(/_(\d{2})$/);
      if (!match) continue;
      highestIndex = Math.max(highestIndex, Number(match[1]));
    }
    return highestIndex + 1;
  }

  function ensureObservedSceneActors({
    memoryService,
    campaignId,
    locationId,
    turnId,
    narrationContext
  }) {
    const inferredActors = inferVisibleSceneRoles(narrationContext, locationId);
    const locationProfile = resolveLocationGenerationProfile(locationId);
    const locationLoreContext = resolveLocationLoreContext(locationId);
    for (const inferredActor of inferredActors) {
      const existing = memoryService.getEntity(campaignId, inferredActor.entity_id);
      if (!existing) {
        memoryService.upsertEntity(
          campaignId,
          buildActorProfileRecord({
            entityId: inferredActor.entity_id,
            actorHint: inferredActor.role,
            locationId,
            turnId,
            profileState: "scene_stub",
            sourceReason: "scene_presence_observed",
            seededProfile: buildActorDistinctiveSeed({
              entityId: inferredActor.entity_id,
              actorHint: inferredActor.role,
              locationId,
              locationProfile,
              locationLoreContext
            })
          }),
          turnId
        );
      }
      memoryService.ensureVisibleActorAtLocation(
        campaignId,
        locationId,
        inferredActor.entity_id,
        turnId
      );
    }
    syncSceneActorSnapshots({ memoryService, campaignId, locationId, turnId });
  }

  function ensureAmbientSceneActors({
    memoryService,
    campaignId,
    locationId,
    turnId,
    narrationContext,
    maxActors = 3
  }) {
    const targetVisibleActors = Math.max(0, Math.min(maxActors, computeObserveVisibleActorBudget(locationId, narrationContext)));
    const currentVisibleActorRecords = getVisibleActorRecords(memoryService, campaignId, locationId);
    if (currentVisibleActorRecords.length >= targetVisibleActors) {
      syncSceneActorSnapshots({ memoryService, campaignId, locationId, turnId, maxActors: Math.max(1, targetVisibleActors) });
      return;
    }
    const locationProfile = resolveLocationGenerationProfile(locationId);
    const locationLoreContext = resolveLocationLoreContext(locationId);
    const languageSeed = buildLanguageSeedFromGenerationProfile(locationProfile);
    const inferredActors = inferAmbientSceneRoles(locationId, narrationContext, maxActors);
    const visibleRoles = new Set(
      currentVisibleActorRecords
        .map((actor) => normalizeLooseText(actor?.payload?.identity?.role))
        .filter(Boolean)
    );
    const actorsToCreate = inferredActors
      .filter((inferredActor) => !visibleRoles.has(normalizeLooseText(inferredActor.role)))
      .slice(0, Math.max(0, targetVisibleActors - currentVisibleActorRecords.length))
      .map((inferredActor) => ({
        ...inferredActor,
        entity_id: buildSceneActorEntityId(
          locationId,
          inferredActor.role,
          getNextSceneRoleIndex(currentVisibleActorRecords, locationId, inferredActor.role)
        )
      }));
    for (const inferredActor of actorsToCreate) {
      const existing = memoryService.getEntity(campaignId, inferredActor.entity_id);
      if (!existing) {
        const actorRecord = applyActorContextFromGenerationProfile(
          applyActorLanguageSeed(
            buildActorProfileRecord({
              entityId: inferredActor.entity_id,
              actorHint: inferredActor.role,
              locationId,
              turnId,
              profileState: "scene_stub",
              sourceReason: "scene_presence_ambient",
              seededProfile: buildActorDistinctiveSeed({
                entityId: inferredActor.entity_id,
                actorHint: inferredActor.role,
                locationId,
                locationProfile,
                locationLoreContext
              })
            }),
            languageSeed
          ),
          locationProfile,
          inferredActor.role
        );
        memoryService.upsertEntity(campaignId, actorRecord, turnId);
      }
      memoryService.ensureVisibleActorAtLocation(campaignId, locationId, inferredActor.entity_id, turnId);
    }
    syncSceneActorSnapshots({ memoryService, campaignId, locationId, turnId, maxActors });
  }

  return {
    buildLocationRuntimeSeed,
    readScenePerceptionState,
    buildScenePerceptionGuidance,
    buildApproachClarificationQuestion,
    ensureObservedSceneActors,
    ensureAmbientSceneActors
  };
}

module.exports = {
  createSceneRuntimeHelpers
};
