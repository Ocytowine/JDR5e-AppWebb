const fs = require("fs");
const path = require("path");
const { createWikiLoreHelper } = require("./wikiLoreHelper");
const { createLocalLoreHelper } = require("./localLoreHelper");

function createNarrationModuleApi({
  projectRoot,
  openAiApiKey,
  callOpenAiJson,
  parseJsonBody,
  sendJson,
  cryptoImpl
}) {
  let narrationRuntime = null;
  let narrationRuntimeInitError = null;
  const wikiLoreHelper = createWikiLoreHelper(projectRoot);
  const localLoreHelper = createLocalLoreHelper();

  function safeString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }

  function normalizeLooseText(value) {
    return safeString(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function slugifyLoose(value, fallback = "entity") {
    const normalized = normalizeLooseText(value).replace(/\s+/g, "_");
    return normalized || fallback;
  }

  function normalizeIntentType(value) {
    const raw = safeString(value)
      .trim()
      .toLowerCase();
    const allowed = new Set([
      "observe",
      "talk",
      "move_local",
      "ask_info",
      "attempt_forbidden",
      "meta_unclear"
    ]);
    return allowed.has(raw) ? raw : "";
  }

  const RUNTIME_NARRATION_PLACEHOLDER = "[runtime] narration delegated to llm";

  function toStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map(item => String(item ?? "").trim())
      .filter(Boolean);
  }

  function buildFallbackNarrationFromHandoff(aiHandoff) {
    const intentType = safeString(aiHandoff?.output_contract?.intent_type, "action");
    const actionCount = Array.isArray(aiHandoff?.runtime_result?.runtime_actions)
      ? aiHandoff.runtime_result.runtime_actions.length
      : 0;
    return `Tu poursuis ton action (${intentType}) et le monde reagit (${actionCount} action(s) runtime).`;
  }

  function scoreActorCandidate(actor, locationId, actorHint, explicitTargetActorId = "") {
    if (!actor || typeof actor !== "object") return -1;
    const status = safeString(actor.status).toLowerCase();
    const memoryState = safeString(actor.memory_state).toLowerCase();
    if (status === "archived" || status === "expired" || memoryState === "archived") return -1;

    const actorId = safeString(actor.entity_id);
    if (explicitTargetActorId && actorId === explicitTargetActorId) {
      return 100;
    }

    const actorLocation = safeString(actor.location_id);
    let score = 0;
    if (actorLocation && actorLocation === locationId) score += 4;

    const identity = actor.payload && typeof actor.payload === "object" ? actor.payload.identity : null;
    const normalizedHint = normalizeLooseText(actorHint);
    const hintTokens = normalizedHint.split(/\s+/).filter(Boolean);
    const haystack = normalizeLooseText(
      [
        actor.entity_id,
        actor.display_name,
        identity?.known_name,
        identity?.role
      ].join(" ")
    );
    if (!normalizedHint) return score;
    if (haystack === normalizedHint) score += 8;
    for (const token of hintTokens) {
      if (haystack.includes(token)) score += 2;
    }
    return score;
  }

  function collectActorCandidates(campaign, locationId, actorHint, explicitTargetActorId = "") {
    const registry = campaign?.entity_registry;
    const actors = registry && registry.actors && typeof registry.actors === "object"
      ? Object.values(registry.actors)
      : [];
    return actors
      .map(actor => ({
        actor,
        score: scoreActorCandidate(actor, locationId, actorHint, explicitTargetActorId)
      }))
      .filter(item => item.score >= 4)
      .sort((left, right) => right.score - left.score);
  }

  function collectVisibleActorCandidates(campaign, locationId, actorHint, explicitTargetActorId = "") {
    const locationEntity = campaign?.entity_registry?.locations?.[locationId];
    const visibleActorIds = Array.isArray(locationEntity?.payload?.visible_actors)
      ? locationEntity.payload.visible_actors
      : [];
    if (visibleActorIds.length === 0) return [];
    const actors = visibleActorIds
      .map(actorId => campaign?.entity_registry?.actors?.[String(actorId ?? "").trim()] ?? null)
      .filter(Boolean);
    return actors
      .map(actor => ({
        actor,
        score: scoreActorCandidate(actor, locationId, actorHint, explicitTargetActorId)
      }))
      .filter(item => item.score >= 4)
      .sort((left, right) => right.score - left.score);
  }

  function findMatchingActorEntity(campaign, locationId, actorHint, explicitTargetActorId = "") {
    const candidates = collectActorCandidates(campaign, locationId, actorHint, explicitTargetActorId);
    return candidates.length > 0 ? candidates[0].actor : null;
  }

  function resolveTalkActorEntity({ campaign, locationId, actorHint, targetActorId }) {
    const explicitTarget = safeString(targetActorId);
    const visibleCandidates = collectVisibleActorCandidates(campaign, locationId, actorHint, explicitTarget);
    if (visibleCandidates.length === 1) {
      return { kind: "resolved", actor: visibleCandidates[0].actor };
    }
    if (visibleCandidates.length > 1) {
      const [bestVisible, secondVisible] = visibleCandidates;
      if (bestVisible.score >= 10 && (!secondVisible || bestVisible.score - secondVisible.score >= 3)) {
        return { kind: "resolved", actor: bestVisible.actor };
      }
      const candidateLabels = visibleCandidates
        .slice(0, 3)
        .map(item => safeString(item.actor?.display_name) || safeString(item.actor?.entity_id))
        .filter(Boolean);
      return {
        kind: "ambiguous",
        clarification_question:
          candidateLabels.length > 0
            ? `Plusieurs interlocuteurs visibles correspondent a "${actorHint}". Precise lequel: ${candidateLabels.join(", ")}.`
            : `Plusieurs interlocuteurs visibles correspondent a "${actorHint}". Precise lequel.`
      };
    }

    if (explicitTarget) {
      const exact = findMatchingActorEntity(campaign, locationId, actorHint, explicitTarget);
      if (exact?.entity_id === explicitTarget) {
        return { kind: "resolved", actor: exact };
      }
    }

    const candidates = collectActorCandidates(campaign, locationId, actorHint, "");
    if (candidates.length === 0) {
      return { kind: "create_new" };
    }
    if (candidates.length === 1) {
      return { kind: "resolved", actor: candidates[0].actor };
    }

    const [best, second] = candidates;
    if (best.score >= 10 && (!second || best.score - second.score >= 3)) {
      return { kind: "resolved", actor: best.actor };
    }

    const candidateLabels = candidates
      .slice(0, 3)
      .map(item => safeString(item.actor?.display_name) || safeString(item.actor?.entity_id))
      .filter(Boolean);
    return {
      kind: "ambiguous",
      clarification_question:
        candidateLabels.length > 0
          ? `Plusieurs interlocuteurs correspondent a "${actorHint}". Precise lequel: ${candidateLabels.join(", ")}.`
          : `Plusieurs interlocuteurs correspondent a "${actorHint}". Precise lequel.`
    };
  }

  function buildActorProfileRecord({ entityId, actorHint, locationId, turnId }) {
    return {
      entity_id: entityId,
      entity_type: "actor",
      subtype: "pnj",
      display_name: actorHint,
      memory_state: "active",
      status: "active",
      scope: "situational",
      created_at_turn: turnId,
      updated_at_turn: turnId,
      last_seen_turn: turnId,
      location_id: locationId,
      source: {
        created_by: "runtime",
        reason: "talk_target_resolution"
      },
      visibility: {
        player_known: true,
        truth_known: true
      },
      links: {
        event_ids: [],
        related_entity_ids: [],
        faction_ids: []
      },
      payload: {
        profile_state: "stub",
        pending_enrichment: null,
        identity: {
          known_name: null,
          role: actorHint,
          species: "unknown",
          gender_presentation: "unknown"
        },
        appearance: {
          physical_traits: [],
          clothing: [],
          visible_equipment: [],
          notable_details: []
        },
        stats: {
          FOR: 10,
          DEX: 10,
          CON: 10,
          INT: 10,
          SAG: 10,
          CHA: 10
        },
        social: {
          temperament: "neutral",
          social_traits: [],
          authority_level: "unknown",
          disposition_to_player: "neutral",
          interaction_state: "available"
        },
        world: {
          faction_id: null,
          duty_state: "unknown",
          location_precision: locationId
        },
        language_profile: {
          native_languages: [],
          known_languages: [],
          preferred_language: "unknown",
          source: "runtime_default"
        }
      },
      lifecycle_policy: {
        ttl_turns: 8,
        promote_if_linked_to_event: true,
        archive_when_inactive: true
      },
      lifecycle_history: []
    };
  }

  function extractLocationLanguageSeed(selectedLoreEntries, locationId) {
    const entries = Array.isArray(selectedLoreEntries) ? selectedLoreEntries : [];
    const matchingEntry = entries.find((entry) => safeString(entry?.entity_id) === safeString(locationId));
    const keyFacts = matchingEntry?.key_facts && typeof matchingEntry.key_facts === "object"
      ? matchingEntry.key_facts
      : {};
    const commonLanguages = readStringArrayField(keyFacts.common_languages);
    const tradeLanguages = readStringArrayField(keyFacts.trade_languages);
    const fallbackLanguages =
      commonLanguages.length > 0
        ? commonLanguages
        : tradeLanguages.length > 0
          ? tradeLanguages
          : ["commun"];
    return {
      native_languages: commonLanguages,
      known_languages: [...new Set([...fallbackLanguages, ...tradeLanguages])],
      preferred_language: fallbackLanguages[0] || "commun",
      source: commonLanguages.length > 0 || tradeLanguages.length > 0 ? "location_lore" : "fallback_common",
    };
  }

  function applyActorLanguageSeed(actorRecord, languageSeed) {
    if (!actorRecord || typeof actorRecord !== "object") return actorRecord;
    const payload = actorRecord.payload && typeof actorRecord.payload === "object"
      ? actorRecord.payload
      : {};
    const currentLanguageProfile = payload.language_profile && typeof payload.language_profile === "object"
      ? payload.language_profile
      : {};
    const knownLanguages = readStringArrayField(currentLanguageProfile.known_languages);
    if (knownLanguages.length > 0) {
      return actorRecord;
    }
    actorRecord.payload = {
      ...payload,
      language_profile: {
        ...currentLanguageProfile,
        native_languages: readStringArrayField(languageSeed?.native_languages),
        known_languages: readStringArrayField(languageSeed?.known_languages),
        preferred_language: safeString(languageSeed?.preferred_language, "commun") || "commun",
        source: safeString(languageSeed?.source, "runtime_default") || "runtime_default",
      }
    };
    return actorRecord;
  }

  function buildInteractionLanguageState(playerSnapshot, actorRecord) {
    const playerLanguages = readStringArrayField(playerSnapshot?.spoken_languages);
    const actorPayload = actorRecord?.payload && typeof actorRecord.payload === "object"
      ? actorRecord.payload
      : {};
    const actorLanguageProfile = actorPayload.language_profile && typeof actorPayload.language_profile === "object"
      ? actorPayload.language_profile
      : {};
    const actorKnownLanguages = readStringArrayField(actorLanguageProfile.known_languages);
    const actorNativeLanguages = readStringArrayField(actorLanguageProfile.native_languages);
    const preferredLanguage = safeString(actorLanguageProfile.preferred_language, actorKnownLanguages[0] || actorNativeLanguages[0] || "unknown");
    const sharedLanguages = actorKnownLanguages.filter((language) => playerLanguages.includes(language));
    let comprehensionState = "none";
    let fallbackLanguage = null;
    if (preferredLanguage && sharedLanguages.includes(preferredLanguage)) {
      comprehensionState = "full";
      fallbackLanguage = preferredLanguage;
    } else if (sharedLanguages.length > 0) {
      comprehensionState = "limited";
      fallbackLanguage = sharedLanguages[0];
    } else if (playerLanguages.length > 0 && actorKnownLanguages.length === 0 && preferredLanguage === "unknown") {
      comprehensionState = "unknown";
      fallbackLanguage = null;
    }
    return {
      speaker_language: preferredLanguage || "unknown",
      player_languages: playerLanguages,
      actor_known_languages: actorKnownLanguages,
      shared_languages: sharedLanguages,
      fallback_language: fallbackLanguage,
      comprehension_state: comprehensionState,
      needs_interpreter: comprehensionState === "none",
    };
  }

  function scoreRoleMatch(actorHint, roleEntry) {
    const normalizedHint = normalizeLooseText(actorHint);
    const normalizedRole = normalizeLooseText(roleEntry?.role);
    if (!normalizedHint || !normalizedRole) return 0;
    if (normalizedHint === normalizedRole) {
      return Number(roleEntry?.weight) || 1;
    }
    const hintTokens = normalizedHint.split(/\s+/).filter(Boolean);
    const roleTokens = normalizedRole.split(/\s+/).filter(Boolean);
    let tokenScore = 0;
    for (const roleToken of roleTokens) {
      if (hintTokens.includes(roleToken) || normalizedHint.includes(roleToken)) {
        tokenScore += 1;
      }
    }
    if (normalizedRole === "pnj_lambda" && tokenScore === 0) {
      return Number(roleEntry?.weight) || 1;
    }
    return tokenScore > 0 ? tokenScore + (Number(roleEntry?.weight) || 1) : 0;
  }

  function computeRolePlausibility(locationProfile, actorHint) {
    const likelyRoles = readWeightedRoleList(locationProfile?.presence_profile?.likely_roles);
    const rareRoles = readWeightedRoleList(locationProfile?.presence_profile?.rare_roles);
    const likelyMatches = likelyRoles
      .map((entry) => ({ entry, score: scoreRoleMatch(actorHint, entry) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);
    if (likelyMatches.length > 0) {
      const best = likelyMatches[0];
      return {
        role: actorHint,
        category: "likely",
        score: best.score,
        matched_role: best.entry.role,
        source_chain: Array.isArray(locationProfile?.source_chain) ? locationProfile.source_chain : [],
        suggested_roles: likelyRoles.slice(0, 4).map((entry) => entry.role)
      };
    }

    const rareMatches = rareRoles
      .map((entry) => ({ entry, score: scoreRoleMatch(actorHint, entry) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);
    if (rareMatches.length > 0) {
      const best = rareMatches[0];
      return {
        role: actorHint,
        category: "rare",
        score: best.score,
        matched_role: best.entry.role,
        source_chain: Array.isArray(locationProfile?.source_chain) ? locationProfile.source_chain : [],
        suggested_roles: [...likelyRoles.slice(0, 3).map((entry) => entry.role), ...rareRoles.slice(0, 2).map((entry) => entry.role)]
      };
    }

    return {
      role: actorHint,
      category: "out_of_profile",
      score: 0,
      matched_role: null,
      source_chain: Array.isArray(locationProfile?.source_chain) ? locationProfile.source_chain : [],
      suggested_roles: [...likelyRoles.slice(0, 4).map((entry) => entry.role), ...rareRoles.slice(0, 2).map((entry) => entry.role)]
    };
  }

  function readWeightedRoleList(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const role = safeString(entry.role);
        const weight = Number(entry.weight);
        if (!role) return null;
        return {
          role,
          weight: Number.isFinite(weight) ? weight : 1
        };
      })
      .filter(Boolean);
  }

  function mergeProfileLayer(base, overlay) {
    const left = base && typeof base === "object" ? base : {};
    const right = overlay && typeof overlay === "object" ? overlay : {};
    return {
      ...left,
      ...right,
      likely_roles:
        readWeightedRoleList(right.likely_roles).length > 0
          ? readWeightedRoleList(right.likely_roles)
          : readWeightedRoleList(left.likely_roles),
      rare_roles:
        readWeightedRoleList(right.rare_roles).length > 0
          ? readWeightedRoleList(right.rare_roles)
          : readWeightedRoleList(left.rare_roles),
      species_weights:
        Array.isArray(right.species_weights) && right.species_weights.length > 0
          ? right.species_weights
          : Array.isArray(left.species_weights)
            ? left.species_weights
            : [],
      common_languages: readStringArrayField(right.common_languages).length > 0
        ? readStringArrayField(right.common_languages)
        : readStringArrayField(left.common_languages),
      trade_languages: readStringArrayField(right.trade_languages).length > 0
        ? readStringArrayField(right.trade_languages)
        : readStringArrayField(left.trade_languages),
      tolerated_languages: readStringArrayField(right.tolerated_languages).length > 0
        ? readStringArrayField(right.tolerated_languages)
        : readStringArrayField(left.tolerated_languages)
    };
  }

  function resolveLocationGenerationProfile(locationId) {
    const index = wikiLoreHelper.getIndex && typeof wikiLoreHelper.getIndex === "function"
      ? wikiLoreHelper.getIndex()
      : null;
    if (!index || !index.byEntityId) {
      return {
        source_chain: [],
        presence_profile: {},
        language_profile: {},
        social_profile: {},
        authority_profile: {}
      };
    }
    const exactDoc = index.byEntityId[normalizeText(locationId)] || null;
    const quartierId = safeString(exactDoc?.front_matter?.quartier);
    const villeId = safeString(exactDoc?.front_matter?.ville || (exactDoc?.type === "ville" ? exactDoc?.entity_id : ""));
    const quartierDoc = quartierId ? index.byEntityId[normalizeText(quartierId)] || null : null;
    const villeDoc = villeId ? index.byEntityId[normalizeText(villeId)] || null : null;
    const docs = [villeDoc, quartierDoc, exactDoc].filter(Boolean);
    const sourceChain = docs.map((doc) => safeString(doc.entity_id)).filter(Boolean);

    let presenceProfile = {};
    let languageProfile = {};
    let socialProfile = {};
    let authorityProfile = {};
    for (const doc of docs) {
      const fm = doc.front_matter && typeof doc.front_matter === "object" ? doc.front_matter : {};
      presenceProfile = mergeProfileLayer(presenceProfile, fm.presence_profile);
      languageProfile = mergeProfileLayer(languageProfile, fm.language_profile);
      socialProfile = mergeProfileLayer(socialProfile, fm.social_profile);
      authorityProfile = mergeProfileLayer(authorityProfile, fm.authority_profile);
    }

    return {
      source_chain: sourceChain,
      presence_profile: presenceProfile,
      language_profile: languageProfile,
      social_profile: socialProfile,
      authority_profile: authorityProfile
    };
  }

  function buildLanguageSeedFromGenerationProfile(locationProfile) {
    const languageProfile = locationProfile?.language_profile && typeof locationProfile.language_profile === "object"
      ? locationProfile.language_profile
      : {};
    const commonLanguages = readStringArrayField(languageProfile.common_languages);
    const tradeLanguages = readStringArrayField(languageProfile.trade_languages);
    const fallbackLanguages =
      commonLanguages.length > 0
        ? commonLanguages
        : tradeLanguages.length > 0
          ? tradeLanguages
          : ["commun"];
    return {
      native_languages: commonLanguages,
      known_languages: [...new Set([...fallbackLanguages, ...tradeLanguages])],
      preferred_language: fallbackLanguages[0] || "commun",
      source:
        locationProfile?.source_chain && locationProfile.source_chain.length > 0
          ? `generation_profile:${locationProfile.source_chain.join(">")}`
          : "fallback_common"
    };
  }

  function applyActorContextFromGenerationProfile(actorRecord, locationProfile, actorHint) {
    if (!actorRecord || typeof actorRecord !== "object") return actorRecord;
    const role = normalizeLooseText(actorHint);
    const likelyRoles = readWeightedRoleList(locationProfile?.presence_profile?.likely_roles);
    const authorityProfile =
      locationProfile?.authority_profile && typeof locationProfile.authority_profile === "object"
        ? locationProfile.authority_profile
        : {};
    const payload = actorRecord.payload && typeof actorRecord.payload === "object" ? actorRecord.payload : {};
    const social = payload.social && typeof payload.social === "object" ? payload.social : {};
    const world = payload.world && typeof payload.world === "object" ? payload.world : {};
    const roleIsLikely = likelyRoles.some((entry) => normalizeLooseText(entry.role) === role);
    const roleLooksAuthority = /garde|officier|sergent|capitaine/.test(role);
    const factionId =
      safeString(authorityProfile.operational_faction) ||
      safeString(authorityProfile.authority_owner) ||
      null;
    actorRecord.payload = {
      ...payload,
      social: {
        ...social,
        authority_level:
          roleLooksAuthority || roleIsLikely
            ? safeString(social.authority_level, "low") || "low"
            : social.authority_level
      },
      world: {
        ...world,
        faction_id: world.faction_id || factionId
      }
    };
    return actorRecord;
  }

  function buildLocationRuntimeSeed(locationId, selectedLoreEntries) {
    const entries = Array.isArray(selectedLoreEntries) ? selectedLoreEntries : [];
    const matchingEntry = entries.find(entry => safeString(entry?.entity_id) === safeString(locationId));
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
      ? keyFacts.lieux_connectes.map(item => String(item ?? "").trim()).filter(Boolean)
      : [];
    const activePointsOfInterest = Array.isArray(keyFacts.fonction_principale)
      ? keyFacts.fonction_principale.map(item => String(item ?? "").trim()).filter(Boolean).slice(0, 4)
      : [];
    const visibleExits = connectedLocations.map((destinationId) => ({
      exit_id: `exit_${slugifyLoose(locationId)}_${slugifyLoose(destinationId)}`,
      label_visible: `un passage vers ${destinationId.replace(/_/g, " ")}`,
      destination_id: destinationId,
      access_state: "open",
      guarded: false,
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
      visible_exits: visibleExits.slice(0, 4),
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
      display_name: role,
    }));
  }

  function ensureObservedSceneActors({
    memoryService,
    campaignId,
    locationId,
    turnId,
    narrationContext,
  }) {
    const inferredActors = inferVisibleSceneRoles(narrationContext, locationId);
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
  }

  function buildObserveSelectedLoreForNarration(selectedLoreEntries, locationId) {
    const entries = Array.isArray(selectedLoreEntries) ? selectedLoreEntries : [];
    return entries
      .filter((entry) => safeString(entry?.entity_id) === safeString(locationId))
      .map((entry) => {
        const keyFacts = entry?.key_facts && typeof entry.key_facts === "object"
          ? entry.key_facts
          : {};
        return {
          topic_id: safeString(entry?.topic_id),
          entity_id: safeString(entry?.entity_id),
          type: safeString(entry?.type),
          name: safeString(entry?.name),
          snippet: safeString(entry?.snippet),
          observable_facts: {
            acces: safeString(keyFacts.acces),
            type_batiment: safeString(keyFacts.type_batiment),
            fonction_principale: Array.isArray(keyFacts.fonction_principale)
              ? keyFacts.fonction_principale.map((item) => safeString(item)).filter(Boolean).slice(0, 2)
              : [],
            lieux_connectes: Array.isArray(keyFacts.lieux_connectes)
              ? keyFacts.lieux_connectes.map((item) => safeString(item)).filter(Boolean).slice(0, 2)
              : [],
          }
        };
      });
  }

  function getProjectedLocationRuntimeState(projected, locationId) {
    const locations = Array.isArray(projected?.projected_units?.entity_registry?.locations)
      ? projected.projected_units.entity_registry.locations
      : [];
    return locations.find(entry => safeString(entry?.entity_id) === safeString(locationId)) || null;
  }

  function readStringArrayField(value) {
    if (!Array.isArray(value)) return [];
    return value.map(item => safeString(item)).filter(Boolean);
  }

  function readVisibleExitsField(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter(item => item && typeof item === "object")
      .map(item => ({
        exit_id: safeString(item.exit_id),
        label_visible: safeString(item.label_visible),
        destination_id: safeString(item.destination_id),
        access_state: safeString(item.access_state, "open"),
        guarded: Boolean(item.guarded),
      }))
      .filter(item => item.exit_id && item.destination_id);
  }

  function extractKnowledgeEntries(projected) {
    const entries = Array.isArray(projected?.projected_units?.knowledge_player_view)
      ? projected.projected_units.knowledge_player_view
      : [];
    return entries
      .map(entry => ({
        raw: entry,
        text: safeString(entry?.text || entry?.summary || entry?.fact),
        knowledge_kind: safeString(entry?.knowledge_kind || entry?.kind || "summary"),
        certainty: safeString(entry?.certainty || "partial"),
        source: safeString(entry?.source || "auto_narration"),
        location_id: safeString(entry?.location_id),
        linked_entity_ids: Array.isArray(entry?.linked_entity_ids)
          ? entry.linked_entity_ids.map(item => safeString(item)).filter(Boolean)
          : [],
      }))
      .filter(entry => entry.text);
  }

  function isPlayerSelfQuestion(playerInput) {
    const normalized = normalizeLooseText(playerInput);
    if (!normalized) return false;
    return (
      normalized.includes(" je ") ||
      normalized.startsWith("je ") ||
      normalized.includes(" moi ") ||
      normalized.includes(" mon ") ||
      normalized.includes(" ma ") ||
      normalized.includes(" mes ")
    );
  }

  function buildAskInfoFromPlayerSnapshot(playerInput, playerSnapshot) {
    if (!playerSnapshot || typeof playerSnapshot !== "object" || !isPlayerSelfQuestion(playerInput)) {
      return null;
    }
    const normalized = normalizeLooseText(playerInput);
    const species = safeString(playerSnapshot.species);
    const spokenLanguages = readStringArrayField(playerSnapshot.spoken_languages);
    const readLanguages = readStringArrayField(playerSnapshot.read_languages);
    const wornClothing = readStringArrayField(playerSnapshot.worn_clothing);
    const visibleEquipment = readStringArrayField(playerSnapshot.visible_equipment);
    const physicalMarkers = readStringArrayField(playerSnapshot.physical_markers);
    const displayName = safeString(playerSnapshot.display_name);

    if (/(porte|vetement|vetements|habille|habillee|tenue|sur moi)/.test(normalized)) {
      const parts = [...wornClothing, ...visibleEquipment].filter(Boolean);
      return parts.length > 0
        ? {
            answer_state: "known",
            answer_text: `Tu portes ${parts.join(", ")}.`,
            lead_text: null,
          }
        : {
            answer_state: "unknown",
            answer_text: null,
            lead_text: null,
          };
    }

    if (/(langue|langues|parle|parler|lire|lecture|comprendre)/.test(normalized)) {
      if (spokenLanguages.length === 0 && readLanguages.length === 0) {
        return {
          answer_state: "unknown",
          answer_text: null,
          lead_text: null,
        };
      }
      const spokenText = spokenLanguages.length > 0 ? `Tu parles ${spokenLanguages.join(", ")}` : "";
      const readText = readLanguages.length > 0 ? `tu sais lire ${readLanguages.join(", ")}` : "";
      return {
        answer_state: "known",
        answer_text: [spokenText, readText].filter(Boolean).join(" et ") + ".",
        lead_text: null,
      };
    }

    if (/(race|espece|espece|qui suis je|qui je suis|nom)/.test(normalized)) {
      const parts = [];
      if (displayName) parts.push(`Tu es ${displayName}`);
      if (species) parts.push(`de l'espece ${species}`);
      return parts.length > 0
        ? {
            answer_state: "known",
            answer_text: `${parts.join(", ")}.`,
            lead_text: null,
          }
        : null;
    }

    if (/(air|ressemble|apparence|physique|visage|cheveux|yeux|silhouette)/.test(normalized)) {
      return physicalMarkers.length > 0
        ? {
            answer_state: "known",
            answer_text: `Tu presents ${physicalMarkers.join(", ")}.`,
            lead_text: null,
          }
        : null;
    }

    return null;
  }

  function buildAskInfoResolution(projected, playerInput, locationRuntimeState, playerSnapshot) {
    const playerSnapshotAnswer = buildAskInfoFromPlayerSnapshot(playerInput, playerSnapshot);
    if (playerSnapshotAnswer) {
      return playerSnapshotAnswer;
    }
    const normalizedInput = normalizeLooseText(playerInput);
    const inputTokens = normalizedInput
      .split(/\s+/)
      .filter(Boolean)
      .filter(token => !new Set([
        "je", "tu", "il", "elle", "nous", "vous", "ils", "elles",
        "le", "la", "les", "de", "des", "du", "un", "une",
        "a", "au", "aux", "ou", "et", "en", "dans", "sur",
        "que", "qui", "quoi", "ou", "comment", "quand",
        "sais", "sait", "savoir", "demande", "demander", "cherche", "chercher",
        "info", "information", "informations"
      ]).has(token));

    const knowledgeEntries = extractKnowledgeEntries(projected);
    let bestEntry = null;
    let bestScore = 0;
    for (const entry of knowledgeEntries) {
      const normalizedEntry = normalizeLooseText(entry.text);
      let score = 0;
      for (const token of inputTokens) {
        if (normalizedEntry.includes(token)) score += 1;
      }
      if (normalizedEntry.includes(normalizedInput) && normalizedInput) score += 3;
      if (entry.location_id && entry.location_id === safeString(locationRuntimeState?.entity_id)) score += 2;
      if (entry.knowledge_kind === "lead") score -= 1;
      if (entry.knowledge_kind === "player_hypothesis") score -= 4;
      if (entry.certainty === "solid") score += 3;
      if (entry.certainty === "partial") score += 1;
      if (entry.certainty === "tentative") score -= 1;
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }

    if (
      bestEntry &&
      bestScore >= 2 &&
      bestEntry.knowledge_kind !== "lead" &&
      bestEntry.knowledge_kind !== "player_hypothesis"
    ) {
      return {
        answer_state: bestEntry.certainty === "solid" ? "known" : "partial",
        answer_text: bestEntry.text,
        lead_text: null
      };
    }

    if (
      bestEntry &&
      bestScore >= 1 &&
      bestEntry.knowledge_kind !== "lead" &&
      bestEntry.knowledge_kind !== "player_hypothesis"
    ) {
      return {
        answer_state: "partial",
        answer_text: bestEntry.text,
        lead_text: null
      };
    }

    const bestLeadEntry = knowledgeEntries
      .filter(entry => entry.knowledge_kind === "lead" || entry.knowledge_kind === "player_note")
      .sort((left, right) => {
        const leftScore = inputTokens.reduce((acc, token) => acc + (normalizeLooseText(left.text).includes(token) ? 1 : 0), 0);
        const rightScore = inputTokens.reduce((acc, token) => acc + (normalizeLooseText(right.text).includes(token) ? 1 : 0), 0);
        return rightScore - leftScore;
      })[0] || null;

    if (bestLeadEntry) {
      return {
        answer_state: "unknown_but_lead",
        answer_text: null,
        lead_text: bestLeadEntry.text
      };
    }

    const locationPayload = locationRuntimeState?.payload && typeof locationRuntimeState.payload === "object"
      ? locationRuntimeState.payload
      : {};
    const scenePayload = locationPayload.scene_payload && typeof locationPayload.scene_payload === "object"
      ? locationPayload.scene_payload
      : {};
    const activePointsOfInterest = readStringArrayField(
      Array.isArray(scenePayload.active_points_of_interest)
        ? scenePayload.active_points_of_interest
        : locationPayload.active_points_of_interest
    );
    const visibleActors = readStringArrayField(
      Array.isArray(scenePayload.visible_actors)
        ? scenePayload.visible_actors
        : locationPayload.visible_actors
    );
    const connectedLocations = readStringArrayField(locationPayload.connected_locations);
    const visibleExits = readVisibleExitsField(scenePayload.visible_exits);

    const leadParts = [];
    if (visibleActors.length > 0) {
      leadParts.push(`tu peux interroger ${visibleActors.slice(0, 2).join(", ")}`);
    }
    if (activePointsOfInterest.length > 0) {
      leadParts.push(`tu peux examiner ${activePointsOfInterest.slice(0, 2).join(", ")}`);
    }
    if (visibleExits.length > 0) {
      leadParts.push(`tu peux te diriger vers ${visibleExits.slice(0, 2).map((exit) => exit.label_visible || exit.destination_id).join(", ")}`);
    }
    if (connectedLocations.length > 0) {
      leadParts.push(`tu peux chercher du cote de ${connectedLocations.slice(0, 2).join(", ")}`);
    }

    if (leadParts.length > 0) {
      return {
        answer_state: "unknown_but_lead",
        answer_text: null,
        lead_text: leadParts.join("; ")
      };
    }

    return {
      answer_state: "unknown",
      answer_text: null,
      lead_text: null
    };
  }

  function shouldDeferEntityEnrichment(entity, proposal) {
    const profileState = safeString(entity?.payload?.profile_state, "stub");
    const species = safeString(entity?.payload?.identity?.species, "unknown");
    const confidence = typeof proposal?.confidence === "number" ? proposal.confidence : 0;
    if (profileState === "stub") return true;
    if (!species || species === "unknown") return true;
    if (confidence < 0.8) return true;
    return false;
  }

  function looksAmbiguousText(value) {
    const normalized = ` ${normalizeLooseText(value)} `;
    return (
      normalized.includes(" ou ") ||
      normalized.includes(" et ou ") ||
      normalized.includes(" maybe ") ||
      normalized.includes(" possible ")
    );
  }

  function sanitizeLooseField(value) {
    const trimmed = safeString(value).trim();
    if (!trimmed || looksAmbiguousText(trimmed)) return null;
    return trimmed;
  }

  function sanitizeEnumField(value, allowed, aliases = {}) {
    const normalized = normalizeLooseText(value);
    if (!normalized) return null;
    const aliased = aliases[normalized] || normalized;
    return allowed.has(aliased) ? aliased : null;
  }

  function sanitizeStatsPatch(value) {
    if (!value || typeof value !== "object") return {};
    const next = {};
    for (const key of ["FOR", "DEX", "CON", "INT", "SAG", "CHA"]) {
      const raw = value[key];
      if (typeof raw === "number" && raw >= 1 && raw <= 30) {
        next[key] = Math.round(raw);
      }
    }
    return next;
  }

  function sanitizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => sanitizeLooseField(item))
      .filter(Boolean)
      .slice(0, 6);
  }

  function normalizeLocalizedLabel(value, aliases = {}) {
    const normalized = normalizeLooseText(value);
    if (!normalized) return null;
    return aliases[normalized] || safeString(value).trim();
  }

  function sanitizeEntityPatchProposal(proposedPatch) {
    const payload = proposedPatch?.payload && typeof proposedPatch.payload === "object"
      ? proposedPatch.payload
      : {};
    const sanitizedPayload = {};
    const identity = payload.identity && typeof payload.identity === "object" ? payload.identity : {};
    const appearance = payload.appearance && typeof payload.appearance === "object" ? payload.appearance : {};
    const social = payload.social && typeof payload.social === "object" ? payload.social : {};
    const world = payload.world && typeof payload.world === "object" ? payload.world : {};
    const stats = sanitizeStatsPatch(payload.stats);

    const sanitizedIdentity = {};
    const role = sanitizeLooseField(identity.role);
    const speciesRaw = sanitizeLooseField(identity.species);
    const species = speciesRaw
      ? normalizeLocalizedLabel(speciesRaw, {
          human: "humain",
          humain: "humain",
          elf: "elfe",
          elfe: "elfe",
          dwarf: "nain",
          nain: "nain",
          halfling: "halfelin",
          halfelin: "halfelin",
          gnome: "gnome",
          orc: "orc",
          tiefling: "tieffelin",
          tieffelin: "tieffelin",
          dragonborn: "draconnien",
          draconnien: "draconnien"
        })
      : null;
    const knownName = sanitizeLooseField(identity.known_name);
    const genderPresentation = sanitizeEnumField(
      identity.gender_presentation,
      new Set(["unknown", "masculine", "feminine", "androgynous", "non_binary"]),
      {
        masculin: "masculine",
        masculine: "masculine",
        feminin: "feminine",
        feminine: "feminine",
        androgyne: "androgynous",
        "non binaire": "non_binary",
        "non binary": "non_binary",
        inconnu: "unknown",
        unknown: "unknown"
      }
    );
    if (role) sanitizedIdentity.role = role;
    if (species) sanitizedIdentity.species = species.toLowerCase();
    if (knownName) sanitizedIdentity.known_name = knownName;
    if (genderPresentation) sanitizedIdentity.gender_presentation = genderPresentation;
    if (Object.keys(sanitizedIdentity).length > 0) {
      sanitizedPayload.identity = sanitizedIdentity;
    }

    const sanitizedAppearance = {};
    const physicalTraits = sanitizeStringArray(appearance.physical_traits).map((item) =>
      normalizeLocalizedLabel(item, {
        scarred: "balafre",
        tall: "grand",
        short: "petit",
        bearded: "barbu"
      })
    );
    const clothing = sanitizeStringArray(appearance.clothing).map((item) =>
      normalizeLocalizedLabel(item, {
        "simple merchant attire": "tenue simple de marchand",
        "merchant attire": "tenue de marchand",
        uniform: "uniforme",
        armor: "armure"
      })
    );
    const visibleEquipment = sanitizeStringArray(appearance.visible_equipment).map((item) =>
      normalizeLocalizedLabel(item, {
        sword: "epee",
        spear: "lance",
        ledger: "registre",
        scales: "balance"
      })
    );
    const notableDetails = sanitizeStringArray(appearance.notable_details).map((item) =>
      normalizeLocalizedLabel(item, {
        "keeps a ledger and scales at hand": "garde un registre et une balance a portee de main"
      })
    );
    if (physicalTraits.length > 0) sanitizedAppearance.physical_traits = physicalTraits;
    if (clothing.length > 0) sanitizedAppearance.clothing = clothing;
    if (visibleEquipment.length > 0) sanitizedAppearance.visible_equipment = visibleEquipment;
    if (notableDetails.length > 0) sanitizedAppearance.notable_details = notableDetails;
    if (Object.keys(sanitizedAppearance).length > 0) {
      sanitizedPayload.appearance = sanitizedAppearance;
    }

    if (Object.keys(stats).length > 0) {
      sanitizedPayload.stats = stats;
    }

    const sanitizedSocial = {};
    const temperament = sanitizeLooseField(social.temperament);
    const authorityLevel = sanitizeEnumField(
      social.authority_level,
      new Set(["unknown", "none", "low", "medium", "high", "elite"]),
      {
        inconnu: "unknown",
        unknown: "unknown",
        bas: "low",
        basse: "low",
        low: "low",
        moyen: "medium",
        moyenne: "medium",
        medium: "medium",
        haut: "high",
        haute: "high",
        high: "high",
        elite: "elite",
        aucune: "none",
        none: "none"
      }
    );
    const dispositionToPlayer = sanitizeEnumField(
      social.disposition_to_player,
      new Set(["friendly", "neutral", "wary", "hostile"]),
      {
        amical: "friendly",
        friendly: "friendly",
        neutre: "neutral",
        neutral: "neutral",
        mefiant: "wary",
        wary: "wary",
        hostile: "hostile"
      }
    );
    const interactionState = sanitizeEnumField(
      social.interaction_state,
      new Set(["available", "busy", "blocked", "fleeing", "absent"]),
      {
        disponible: "available",
        available: "available",
        occupe: "busy",
        busy: "busy",
        bloque: "blocked",
        blocked: "blocked",
        fuite: "fleeing",
        fleeing: "fleeing",
        absent: "absent"
      }
    );
    const socialTraits = sanitizeStringArray(social.social_traits);
    if (temperament) sanitizedSocial.temperament = temperament;
    if (authorityLevel) sanitizedSocial.authority_level = authorityLevel;
    if (dispositionToPlayer) sanitizedSocial.disposition_to_player = dispositionToPlayer;
    if (interactionState) sanitizedSocial.interaction_state = interactionState;
    if (socialTraits.length > 0) sanitizedSocial.social_traits = socialTraits;
    if (Object.keys(sanitizedSocial).length > 0) {
      sanitizedPayload.social = sanitizedSocial;
    }

    const sanitizedWorld = {};
    const dutyState = sanitizeEnumField(
      world.duty_state,
      new Set(["unknown", "on_post", "on_patrol", "off_duty", "active_service"]),
      {
        inconnu: "unknown",
        unknown: "unknown",
        en_service: "active_service",
        "en service": "active_service",
        active_service: "active_service",
        de_garde: "on_post",
        garde: "on_post",
        on_post: "on_post",
        patrouille: "on_patrol",
        on_patrol: "on_patrol",
        repos: "off_duty",
        off_duty: "off_duty"
      }
    );
    const factionId = sanitizeLooseField(world.faction_id);
    const locationPrecision = sanitizeLooseField(world.location_precision);
    if (dutyState) sanitizedWorld.duty_state = dutyState;
    if (factionId) sanitizedWorld.faction_id = slugifyLoose(factionId, factionId);
    if (locationPrecision) sanitizedWorld.location_precision = locationPrecision;
    if (Object.keys(sanitizedWorld).length > 0) {
      sanitizedPayload.world = sanitizedWorld;
    }

    return Object.keys(sanitizedPayload).length > 0 ? { payload: sanitizedPayload } : null;
  }

  function sanitizeEntityEnrichmentProposal(raw) {
    if (!raw || typeof raw !== "object") return null;
    const entityId = safeString(raw.entity_id);
    const proposalType = safeString(raw.proposal_type);
    const proposedPatch =
      raw.proposed_patch && typeof raw.proposed_patch === "object" ? raw.proposed_patch : null;
    if (!entityId || !proposalType || !proposedPatch) return null;
    const rawConfidence =
      typeof raw.confidence === "number"
        ? raw.confidence
        : Number.parseFloat(String(raw.confidence ?? ""));
    const normalizedConfidence = Number.isFinite(rawConfidence)
      ? Math.max(0.1, Math.min(1, rawConfidence))
      : 0.6;
    return {
      entity_id: entityId,
      proposal_type: proposalType,
      confidence: normalizedConfidence,
      based_on: toStringArray(raw.based_on),
      proposed_patch: proposedPatch
    };
  }

  function mergeEntityPatch(entity, patch) {
    const next = JSON.parse(JSON.stringify(entity));
    const patchPayload = patch?.payload && typeof patch.payload === "object" ? patch.payload : {};
    next.payload = {
      ...(next.payload && typeof next.payload === "object" ? next.payload : {}),
      ...patchPayload,
      identity: {
        ...((next.payload && next.payload.identity) || {}),
        ...((patchPayload && patchPayload.identity) || {})
      },
      appearance: {
        ...((next.payload && next.payload.appearance) || {}),
        ...((patchPayload && patchPayload.appearance) || {})
      },
      stats: {
        ...((next.payload && next.payload.stats) || {}),
        ...((patchPayload && patchPayload.stats) || {})
      },
      social: {
        ...((next.payload && next.payload.social) || {}),
        ...((patchPayload && patchPayload.social) || {})
      },
      world: {
        ...((next.payload && next.payload.world) || {}),
        ...((patchPayload && patchPayload.world) || {})
      }
    };
    return next;
  }

  function localizeResolvedEntityPayload(entity) {
    const next = JSON.parse(JSON.stringify(entity));
    const payload = next?.payload && typeof next.payload === "object" ? next.payload : {};
    const identity = payload.identity && typeof payload.identity === "object" ? payload.identity : {};
    const appearance = payload.appearance && typeof payload.appearance === "object" ? payload.appearance : {};

    if (identity.species) {
      identity.species = normalizeLocalizedLabel(identity.species, {
        human: "humain",
        humain: "humain",
        elf: "elfe",
        elfe: "elfe",
        dwarf: "nain",
        nain: "nain",
        halfling: "halfelin",
        halfelin: "halfelin",
        tiefling: "tieffelin",
        tieffelin: "tieffelin",
        dragonborn: "draconnien",
        draconnien: "draconnien"
      });
    }

    if (Array.isArray(appearance.clothing)) {
      appearance.clothing = appearance.clothing.map((item) =>
        normalizeLocalizedLabel(item, {
          "simple merchant attire": "tenue simple de marchand",
          "merchant attire": "tenue de marchand"
        })
      );
    }

    if (Array.isArray(appearance.notable_details)) {
      appearance.notable_details = appearance.notable_details.map((item) =>
        normalizeLocalizedLabel(item, {
          "keeps a ledger and scales at hand": "garde un registre et une balance a portee de main"
        })
      );
    }

    next.payload = {
      ...payload,
      identity,
      appearance
    };
    return next;
  }

  function collectEntityEnrichmentRequests(memoryService, campaignId, intentPacket) {
    const targetActorId = safeString(intentPacket?.target_actor_id);
    if (!targetActorId) return [];
    const entity = memoryService.getEntity(campaignId, targetActorId);
    if (!entity) return [];
    const profileState = safeString(entity?.payload?.profile_state, "stub");
    if (profileState === "resolved") return [];
    return [
      {
        entity_id: entity.entity_id,
        entity_type: entity.entity_type,
        subtype: entity.subtype,
        display_name: entity.display_name,
        profile_state: profileState,
        location_id: entity.location_id ?? null,
        payload: entity.payload
      }
    ];
  }

  function reevaluatePendingEntityEnrichments(memoryService, campaignId, locationId, turnId) {
    const entities = memoryService.findEntitiesByLocation(campaignId, locationId);
    const updates = [];
    for (const entity of entities) {
      const profileState = safeString(entity?.payload?.profile_state);
      const pending = entity?.payload?.pending_enrichment;
      if (profileState !== "pending_enrichment" || !pending || typeof pending !== "object") continue;
      const sanitizedPatch = sanitizeEntityPatchProposal(pending.proposed_patch);
      if (!sanitizedPatch) {
        const reverted = JSON.parse(JSON.stringify(entity));
        reverted.payload = {
          ...(reverted.payload && typeof reverted.payload === "object" ? reverted.payload : {}),
          profile_state: "stub",
          pending_enrichment: null
        };
        memoryService.upsertEntity(campaignId, reverted, turnId);
        updates.push({
          entity_id: entity.entity_id,
          profile_update_decision: "rejected",
          reserve_reason: "proposal_invalid_after_runtime_review"
        });
        continue;
      }

      const mergedEntity = localizeResolvedEntityPayload(mergeEntityPatch(entity, sanitizedPatch));
      mergedEntity.payload = {
        ...(mergedEntity.payload && typeof mergedEntity.payload === "object"
          ? mergedEntity.payload
          : {}),
        profile_state: "resolved",
        pending_enrichment: null
      };
      memoryService.upsertEntity(campaignId, mergedEntity, turnId);
      updates.push({
        entity_id: entity.entity_id,
        profile_update_decision: "accepted_next_turn",
        reserve_reason: null
      });
    }
    return updates;
  }

  function ensureTalkActorEntity({
    memoryService,
    campaignId,
    campaignBefore,
    locationId,
    actorHint,
    targetActorId,
    turnId,
    selectedLoreEntries
  }) {
    if (!actorHint) {
      return null;
    }
    const locationProfile = resolveLocationGenerationProfile(locationId);
    const languageSeed = buildLanguageSeedFromGenerationProfile(locationProfile);
    const rolePlausibility = computeRolePlausibility(locationProfile, actorHint);
    if (rolePlausibility.category === "out_of_profile") {
      const suggestions = rolePlausibility.suggested_roles.slice(0, 4);
      return {
        kind: "out_of_profile",
        rolePlausibility,
        clarificationQuestion:
          suggestions.length > 0
            ? `Le role "${actorHint}" est peu plausible ici. Vise plutot: ${suggestions.join(", ")}.`
            : `Le role "${actorHint}" ne correspond pas bien au lieu actuel. Precise un interlocuteur plus plausible.`
      };
    }
    const resolution = resolveTalkActorEntity({
      campaign: campaignBefore,
      locationId,
      actorHint,
      targetActorId
    });
    if (resolution.kind === "resolved" && resolution.actor?.entity_id) {
      const seededActor = applyActorContextFromGenerationProfile(
        applyActorLanguageSeed(JSON.parse(JSON.stringify(resolution.actor)), languageSeed),
        locationProfile,
        actorHint
      );
      memoryService.upsertEntity(campaignId, seededActor, turnId);
      memoryService.markEntitySeen(campaignId, seededActor.entity_id, turnId);
      memoryService.ensureVisibleActorAtLocation(campaignId, locationId, seededActor.entity_id, turnId);
      return {
        kind: "resolved",
        entityId: seededActor.entity_id,
        rolePlausibility
      };
    }
    if (resolution.kind === "ambiguous") {
      return {
        kind: "ambiguous",
        clarificationQuestion: resolution.clarification_question,
        rolePlausibility
      };
    }

    const baseSlug = slugifyLoose(actorHint, "npc");
    const nextIndex = Object.keys(campaignBefore?.entity_registry?.actors ?? {}).length + 1;
    const entityId = `npc_${baseSlug}_${String(nextIndex).padStart(2, "0")}`;
    const actorRecord = applyActorContextFromGenerationProfile(
      applyActorLanguageSeed(
        buildActorProfileRecord({
          entityId,
          actorHint,
          locationId,
          turnId
        }),
        languageSeed
      ),
      locationProfile,
      actorHint
    );
    memoryService.upsertEntity(campaignId, actorRecord, turnId);
    memoryService.ensureVisibleActorAtLocation(campaignId, locationId, entityId, turnId);
    return {
      kind: "created",
      entityId,
      rolePlausibility
    };
  }

  function initNarrationRuntime() {
    if (narrationRuntime || narrationRuntimeInitError) return;
    try {
      const moduleRoot = path.join(projectRoot, "narration-module", "dist", "src");
      const { TurnProcessor, TurnRuleError } = require(path.join(
        moduleRoot,
        "application",
        "orchestrators",
        "turn_processor.js"
      ));
      const { TurnTraceLogger } = require(path.join(
        moduleRoot,
        "infrastructure",
        "logging",
        "turn_trace_logger.js"
      ));
      const { JsonMemoryStore } = require(path.join(
        moduleRoot,
        "adapters",
        "db",
        "memory_store.js"
      ));
      const { MemoryService } = require(path.join(
        moduleRoot,
        "application",
        "use_cases",
        "memory_service.js"
      ));
      const { SchemaValidationError } = require(path.join(
        moduleRoot,
        "application",
        "use_cases",
        "schema_validation.js"
      ));

      const runtimeDataDir = path.join(projectRoot, "narration-module", "runtime-data");
      if (!fs.existsSync(runtimeDataDir)) {
        fs.mkdirSync(runtimeDataDir, { recursive: true });
      }

      const logger = new TurnTraceLogger(
        path.join(projectRoot, "narration-module", "logs", "turn-trace.server.jsonl")
      );
      const processor = new TurnProcessor(logger);
      const memoryStore = new JsonMemoryStore(path.join(runtimeDataDir, "memory-store.json"));
      const memoryService = new MemoryService(memoryStore);

      const existingWiki = memoryStore.getWikiWorldState();
      if (!existingWiki || Object.keys(existingWiki).length === 0) {
        memoryService.setWikiWorldState({
          location_id: "setup_zone",
          weather: "clear",
          time_of_day: "late_afternoon"
        });
      }

      narrationRuntime = {
        processor,
        memoryStore,
        memoryService,
        TurnRuleError,
        SchemaValidationError
      };
    } catch (err) {
      narrationRuntimeInitError = err;
      console.error("[narration-module] Runtime init failed:", err.message);
    }
  }

  function buildInputContract(payload, projected) {
    const playerInput = safeString(payload.player_input);
    const locationId = safeString(payload.location_id, "setup_zone");
    const context = safeString(payload.narration_context);
    const goal = safeString(payload.narration_goal);
    const constraints = safeString(payload.narration_constraints);

    return {
      schema_version: "1.0.0",
      player_input: playerInput,
      narrative_context: {
        recent_scene_log: [context].filter(Boolean),
        current_scene_summary: goal || "Scene en cours",
        tone_markers: [constraints || "neutral_immersive"],
        continuity_hooks: ["setup_phase"]
      },
      world_state: {
        location_id: locationId,
        weather: projected?.effective_world_state?.weather ?? "clear",
        time_of_day: projected?.effective_world_state?.time_of_day ?? "late_afternoon"
      },
      actors: {
        player: {
          character_id: safeString(payload.character_id, "setup-player"),
          ...(payload.player_narrative_snapshot && typeof payload.player_narrative_snapshot === "object"
            ? { narrative_snapshot: payload.player_narrative_snapshot }
            : {})
        }
      },
      response_contract: {
        require_structured_output: true,
        must_preserve_continuity: true
      }
    };
  }

  async function analyzeIntentPacket(payload, inputContract) {
    const manualIntentHint = normalizeIntentType(payload.intent_hint);
    const manualDestinationId = safeString(payload.destination_id);
    const manualTargetActorId = safeString(payload.target_actor_id);
    const playerInput = safeString(payload.player_input);
    const locationId = safeString(payload.location_id, "setup_zone");

    if (!openAiApiKey) {
      return {
        source: manualIntentHint ? "manual_hint" : "missing_llm",
        intent_type: manualIntentHint || "",
        intent_confidence: manualIntentHint ? 0.51 : 0,
        requires_clarification: !manualIntentHint,
        clarification_question: manualIntentHint
          ? null
          : "Impossible d'analyser l'intention sans IA amont active.",
        destination_id:
          manualIntentHint === "move_local" && manualDestinationId ? manualDestinationId : null,
        target_actor_hint: null,
        target_actor_id: manualTargetActorId || null,
        notes: manualIntentHint
          ? ["Intent derive du hint UI faute d'IA amont."]
          : ["OPENAI_API_KEY absente: aucune analyse d'intention disponible."],
        raw_player_input: playerInput,
        world_anchor: {
          location_id: locationId
        }
      };
    }

    const model = process.env.NARRATION_INTENT_MODEL || process.env.NARRATION_MODULE_MODEL || "gpt-4.1-mini";
    const systemPrompt =
      "Tu es l'IA amont d'un runtime de JDR. " +
      "Ta seule tache est d'analyser l'intention du joueur avant execution. " +
      "Tu ne racontes rien et tu n'executes rien. " +
      "Reponds STRICTEMENT en JSON avec les champs: " +
      "{ \"intent_type\": \"observe|talk|move_local|ask_info|attempt_forbidden|meta_unclear\", " +
      "\"intent_confidence\": 0.0, " +
      "\"requires_clarification\": true, " +
      "\"clarification_question\": null, " +
      "\"destination_id\": null, " +
      "\"target_actor_hint\": null, " +
      "\"notes\": [\"...\"] }. " +
      "Regles: " +
      "1) Si l'intention n'est pas suffisamment claire, renvoie meta_unclear avec requires_clarification=true. " +
      "2) N'invente jamais de destination_id si elle n'est pas soutenue par le contexte. " +
      "3) move_local demande une destination explicite ou fortement inferable depuis le contexte. " +
      "4) talk = entrer en contact avec une personne ou un groupe proche, meme sans demander encore une information precise. " +
      "5) ask_info = obtenir une information; observe = regarder/ecouter/sonder sans engager fortement; attempt_forbidden = action illicite ou manifestement interdite.";
    const parsed = await callOpenAiJson({
      model,
      systemPrompt,
      userPayload: {
        player_input: playerInput,
        input_contract: inputContract,
        runtime_hint: {
          location_id: locationId,
          destination_id: manualDestinationId || null,
          target_actor_id: manualTargetActorId || null,
          intent_hint: manualIntentHint || null
        }
      }
    });

    const intentType = normalizeIntentType(parsed?.intent_type);
    const requiresClarification =
      Boolean(parsed?.requires_clarification) || !intentType || intentType === "meta_unclear";

    return {
      source: "llm",
      intent_type: intentType || "meta_unclear",
      intent_confidence:
        typeof parsed?.intent_confidence === "number"
          ? Math.max(0, Math.min(1, parsed.intent_confidence))
          : intentType
          ? 0.75
          : 0.3,
      requires_clarification: requiresClarification,
      clarification_question: requiresClarification
        ? safeString(parsed?.clarification_question) ||
          "Je n'ai pas assez d'elements pour comprendre l'action precise."
        : null,
      destination_id:
        intentType === "move_local"
          ? safeString(parsed?.destination_id || manualDestinationId) || null
          : null,
      target_actor_hint: safeString(parsed?.target_actor_hint) || null,
      target_actor_id: safeString(parsed?.target_actor_id || manualTargetActorId) || null,
      notes: toStringArray(parsed?.notes),
      raw_player_input: playerInput,
      world_anchor: {
        location_id: locationId
      }
    };
  }

  function buildPlanAndOutputContracts(payload, intentPacket, projected, turnId, selectedLore, talkActorEntity = null, talkRolePlausibility = null) {
    const intentType = normalizeIntentType(intentPacket?.intent_type);
    const locationId = safeString(payload.location_id, "setup_zone");
    const destinationId = safeString(intentPacket?.destination_id || payload.destination_id);
    const locationRuntimeState = getProjectedLocationRuntimeState(projected, locationId);
    const locationPayload = locationRuntimeState?.payload && typeof locationRuntimeState.payload === "object"
      ? locationRuntimeState.payload
      : {};
    const scenePayload = locationPayload.scene_payload && typeof locationPayload.scene_payload === "object"
      ? locationPayload.scene_payload
      : {};
    const connectedLocations = readStringArrayField(locationPayload.connected_locations);
    const activePointsOfInterest = readStringArrayField(
      Array.isArray(scenePayload.active_points_of_interest)
        ? scenePayload.active_points_of_interest
        : locationPayload.active_points_of_interest
    );
    const visibleActors = readStringArrayField(
      Array.isArray(scenePayload.visible_actors)
        ? scenePayload.visible_actors
        : locationPayload.visible_actors
    );
    const ambientMarkers = readStringArrayField(scenePayload.ambient_markers);
    const visibleExits = readVisibleExitsField(scenePayload.visible_exits);
    const playerSnapshot =
      projected?.truth_snapshot?.local_truth?.player_narrative_snapshot &&
      typeof projected.truth_snapshot.local_truth.player_narrative_snapshot === "object"
        ? projected.truth_snapshot.local_truth.player_narrative_snapshot
        : payload?.player_narrative_snapshot && typeof payload.player_narrative_snapshot === "object"
          ? payload.player_narrative_snapshot
          : null;
    const common = {
      schema_version: "1.0.0",
      targets: [],
      actor_updates: [],
      narrative_constraints: {
        tone: "neutral_immersive",
        must_reflect_runtime_result: true
      }
    };

    if (intentPacket?.requires_clarification) {
      return {
        decisionReason: "clarification_required.upstream_intent_analysis",
        outputContract: {
          ...common,
          intent_type: intentType || "meta_unclear",
          intent_confidence:
            typeof intentPacket?.intent_confidence === "number"
              ? intentPacket.intent_confidence
              : 0.4,
          requires_clarification: true,
          clarification_question:
            safeString(intentPacket?.clarification_question) ||
            "L'intention n'est pas assez claire pour que le runtime execute une action.",
          plan: {
            objective: "Lever l'ambiguite d'intention",
            approach: "Demande de clarification",
            assumptions: [],
            checks_needed: [],
            resources_to_spend: [],
            risks: [{ risk: "Executer une action non souhaitee", severity: "high" }],
            fallbacks: [],
            need_clarification: toStringArray(intentPacket?.notes)
          },
          runtime_actions: [],
          narrative_output: {
            player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
            mj_notes: ["Clarification demandee apres analyse IA amont."],
            hidden_truth_updates: []
          }
        }
      };
    }

    if (intentType === "observe") {
      const loreTopicIds =
        selectedLore && Array.isArray(selectedLore.topic_ids) && selectedLore.topic_ids.length > 0
          ? selectedLore.topic_ids
          : [locationId];
      const observationTargets = [
        locationId,
        ...visibleActors.slice(0, 3),
        ...activePointsOfInterest.slice(0, 2),
        ...visibleExits.slice(0, 2).map((exit) => exit.destination_id)
      ].filter(Boolean);
      return {
        decisionReason: "action_selected.observe",
        outputContract: {
          ...common,
          intent_type: "observe",
          intent_confidence: 0.92,
          requires_clarification: false,
          clarification_question: null,
          plan: {
            objective: "Observer la scene immediate",
            approach: "Observation locale limitee aux elements immediatement perceptibles",
            assumptions: [
              "Decrire seulement le visible, l'audible, l'ambiance et l'acces apparent",
              ...ambientMarkers.slice(0, 2).map((marker) => `Marqueur d'ambiance: ${marker}`),
              ...visibleActors.slice(0, 2).map(actorId => `Acteur visible en scene: ${actorId}`),
              ...activePointsOfInterest.slice(0, 2).map(pointId => `Point d'interet local observable: ${pointId}`),
              ...visibleExits.slice(0, 2).map((exit) => `Sortie visible: ${exit.label_visible || exit.destination_id}`)
            ],
            checks_needed: [],
            resources_to_spend: [],
            risks: [],
            fallbacks: [],
            need_clarification: []
          },
          targets: observationTargets.length > 0 ? observationTargets : [locationId],
          runtime_actions: [{ action: "queryLore", params: { topic_ids: loreTopicIds } }],
          narrative_output: {
            player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
            mj_notes: ["Narration finale generee par l'IA amont a partir du paquet runtime."],
            hidden_truth_updates: []
          }
        }
      };
    }

    if (intentType === "talk") {
      const targetActorHint = safeString(intentPacket?.target_actor_hint);
      const targetActorId = safeString(intentPacket?.target_actor_id);
      const interactionLanguageState = targetActorId
        ? buildInteractionLanguageState(playerSnapshot, talkActorEntity)
        : null;
      const loreTopicIds =
        selectedLore && Array.isArray(selectedLore.topic_ids) && selectedLore.topic_ids.length > 0
          ? selectedLore.topic_ids
          : [locationId];
      if (!targetActorId) {
        return {
          decisionReason: "clarification_required.talk_target_missing",
          outputContract: {
            ...common,
            intent_type: "talk",
            intent_confidence:
              typeof intentPacket?.intent_confidence === "number"
                ? intentPacket.intent_confidence
                : 0.55,
            requires_clarification: true,
            clarification_question:
              "A qui veux-tu parler exactement ou quel type d'interlocuteur cherches-tu ?",
            plan: {
              objective: "Identifier un interlocuteur local",
              approach: "Clarifier la cible du dialogue",
              assumptions: [],
              checks_needed: [],
              resources_to_spend: [],
              risks: [{ risk: "Ouvrir un dialogue avec la mauvaise cible", severity: "medium" }],
              fallbacks: ["Observer la zone pour reperer un interlocuteur pertinent"],
              need_clarification: ["target_actor_hint manquant pour intent_type=talk"]
            },
            targets: [locationId],
            runtime_actions: [],
            narrative_output: {
              player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
              mj_notes: ["Clarification demandee: le runtime a besoin d'une cible de dialogue."],
              hidden_truth_updates: []
            }
          }
        };
      }

      return {
        decisionReason: "action_selected.talk",
        outputContract: {
          ...common,
          intent_type: "talk",
          intent_confidence:
            typeof intentPacket?.intent_confidence === "number"
              ? intentPacket.intent_confidence
              : 0.87,
          requires_clarification: false,
          clarification_question: null,
          plan: {
            objective: "Entrer en contact avec un interlocuteur proche",
            approach: "Ouverture de dialogue en respectant le contexte local",
            assumptions: [
              "La cible est accessible a courte portee sociale",
              ...(talkRolePlausibility
                ? [
                    talkRolePlausibility.category === "likely"
                      ? `Le role ${talkRolePlausibility.matched_role || targetActorHint || targetActorId} est naturel dans ce lieu.`
                      : talkRolePlausibility.category === "rare"
                      ? `Le role ${talkRolePlausibility.matched_role || targetActorHint || targetActorId} reste plausible mais inhabituel dans ce lieu.`
                      : "Le role choisi n'est pas fortement soutenu par le lieu."
                  ]
                : []),
              ...(interactionLanguageState
                ? [
                    interactionLanguageState.comprehension_state === "full"
                      ? `Le PJ et l'interlocuteur partagent la langue ${interactionLanguageState.fallback_language || interactionLanguageState.speaker_language}.`
                      : interactionLanguageState.comprehension_state === "limited"
                      ? `L'echange passera probablement par une langue de secours: ${interactionLanguageState.fallback_language || "langue partielle"}.`
                      : interactionLanguageState.comprehension_state === "none"
                      ? `Aucune langue partagee detectee entre le PJ et l'interlocuteur.`
                      : "La compatibilite linguistique reste incertaine."
                  ]
                : [])
            ],
            checks_needed: [],
            resources_to_spend: [{ type: "time", amount: "1-2min" }],
            risks: [
              { risk: "Interlocuteur hostile ou indisponible", severity: "medium" },
              ...(talkRolePlausibility?.category === "rare"
                ? [{ risk: "Interlocuteur plus inhabituel que la moyenne locale", severity: "low" }]
                : []),
              ...(interactionLanguageState?.comprehension_state === "limited"
                ? [{ risk: "Echange partiel a cause d'une langue commune imparfaite", severity: "medium" }]
                : interactionLanguageState?.comprehension_state === "none"
                ? [{ risk: "Echec de comprehension faute de langue partagee", severity: "high" }]
                : [])
            ],
            fallbacks: [
              "Basculer vers observation locale si le dialogue echoue",
              ...(interactionLanguageState?.comprehension_state === "none"
                ? ["Passer par des gestes, un interprete ou une autre cible"]
                : interactionLanguageState?.comprehension_state === "limited"
                ? ["Reformuler simplement ou changer de langue"]
                : [])
            ],
            need_clarification: []
          },
          targets: [targetActorId],
          ...(talkRolePlausibility ? { role_plausibility: talkRolePlausibility } : {}),
          ...(interactionLanguageState ? { interaction_language_state: interactionLanguageState } : {}),
          runtime_actions: [
            { action: "advanceTime", params: { minutes: 1 } },
            { action: "queryLore", params: { topic_ids: loreTopicIds } },
            { action: "startDialogue", params: { target_id: targetActorId } }
          ],
          narrative_output: {
            player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
            mj_notes: ["Narration finale generee par l'IA aval a partir d'une ouverture de dialogue."],
            hidden_truth_updates: []
          }
        }
      };
    }

    if (intentType === "move_local") {
      if (!destinationId) {
        const visibleExitsHint =
          visibleExits.length > 0
            ? ` Sorties visibles: ${visibleExits.slice(0, 4).map((exit) => exit.label_visible || exit.destination_id).join(", ")}.`
            : "";
        const connectedHint =
          connectedLocations.length > 0
            ? ` Destinations locales connues: ${connectedLocations.slice(0, 4).join(", ")}.`
            : "";
        return {
          decisionReason: "clarification_required.move_local_destination_missing",
          outputContract: {
            ...common,
            intent_type: "meta_unclear",
            intent_confidence: 0.45,
            requires_clarification: true,
            clarification_question:
              `Tu veux aller ou exactement ? Donne un destination_id explicite.${visibleExitsHint}${connectedHint}`,
            plan: {
              objective: "Identifier une destination de deplacement explicite",
              approach: "Demande de clarification",
              assumptions: [
                ...visibleExits.slice(0, 4).map((exit) => `Sortie visible: ${exit.label_visible || exit.destination_id}`),
                ...connectedLocations.slice(0, 4).map(destination => `Connexion locale connue: ${destination}`)
              ],
              checks_needed: [],
              resources_to_spend: [],
              risks: [{ risk: "Deplacer le PJ vers un mauvais lieu", severity: "high" }],
              fallbacks: [],
              need_clarification: [
                "destination_id manquant pour intent_type=move_local"
              ]
            },
            runtime_actions: [],
            narrative_output: {
              player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
              mj_notes: ["Clarification demandee: move_local sans destination explicite."],
              hidden_truth_updates: []
            }
          }
        };
      }

      return {
        decisionReason: "action_selected.move_local",
        outputContract: {
          ...common,
          intent_type: "move_local",
          intent_confidence: 0.9,
          requires_clarification: false,
          clarification_question: null,
          plan: {
            objective: "Se deplacer vers une zone immediate",
            approach: "Deplacement local vers destination explicite",
            assumptions: [
              "Le chemin immediate est praticable vers la destination fournie",
              ...visibleExits
                .filter((exit) => exit.destination_id === destinationId)
                .map((exit) => `Destination visible depuis la scene: ${exit.label_visible || exit.destination_id}`),
              ...connectedLocations
                .filter(connectedLocationId => connectedLocationId === destinationId)
                .map(connectedLocationId => `Destination repertoriee depuis le lieu courant: ${connectedLocationId}`)
            ],
            checks_needed: [],
            resources_to_spend: [{ type: "time", amount: "1-2min" }],
            risks: [{ risk: "Acces bloque", severity: "medium" }],
            fallbacks: ["Observer avant d'insister"],
            need_clarification: []
          },
          targets: [destinationId],
          runtime_actions: [
            { action: "moveLocal", params: { destination_id: destinationId, time_cost_min: 1 } }
          ],
          narrative_output: {
            player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
            mj_notes: ["Narration finale generee par l'IA amont a partir du paquet runtime."],
            hidden_truth_updates: []
          }
        }
      };
    }

    if (intentType === "attempt_forbidden") {
      return {
        decisionReason: "action_selected.attempt_forbidden",
        outputContract: {
          ...common,
          intent_type: "attempt_forbidden",
          intent_confidence: 0.91,
          requires_clarification: false,
          clarification_question: null,
          plan: {
            objective: "Tenter une action interdite",
            approach: "Action risquee sous surveillance",
            assumptions: [],
            checks_needed: [{ type: "skill_check", skill: "stealth", reason: "eviter detection" }],
            resources_to_spend: [],
            risks: [{ risk: "Detection immediate", severity: "high" }],
            fallbacks: ["Interrompre l'action"],
            need_clarification: []
          },
          targets: ["archives_document_room"],
          runtime_actions: [
            {
              action: "requestCheck",
              params: { skill_id: "stealth", difficulty: 15, reason: "tentative interdite" }
            },
            {
              action: "createEvent",
              params: {
                event_id: `evt-${turnId}`,
                origin_trigger_id: "trigger-player-attempt-forbidden",
                created_at_turn: turnId,
                final: { culprit_id: "unknown", event_kind: "forbidden_attempt" }
              }
            }
          ],
          narrative_output: {
            player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
            mj_notes: ["Narration finale generee par l'IA amont a partir du paquet runtime."],
            hidden_truth_updates: ["Une tentative interdite est maintenant tracee dans le monde."]
          }
        }
      };
    }

    if (intentType === "ask_info") {
      const askInfoResolution = buildAskInfoResolution(
        projected,
        safeString(payload.player_input),
        locationRuntimeState,
        playerSnapshot
      );
      const askInfoTargets = [
        locationId,
        ...(askInfoResolution.answer_state === "unknown_but_lead" ? [...visibleActors.slice(0, 2), ...activePointsOfInterest.slice(0, 2)] : [])
      ].filter(Boolean);
      return {
        decisionReason: "action_selected.ask_info",
        outputContract: {
          ...common,
          intent_type: "ask_info",
          intent_confidence: 0.88,
          requires_clarification: false,
          clarification_question: null,
          plan: {
            objective: "Evaluer ce que le PJ sait deja ou peut relier",
            approach: "Reponse MJ basee sur la memoire du PJ et les pistes locales disponibles",
            assumptions: [
              askInfoResolution.answer_state === "known"
                ? "Le PJ possede deja l'information en memoire."
                : askInfoResolution.answer_state === "partial"
                ? "Le PJ se souvient d'un element partiel."
                : askInfoResolution.answer_state === "unknown_but_lead"
                ? "Le PJ ne sait pas encore, mais des pistes RP locales existent."
                : "Le PJ ne dispose pas actuellement de cette information."
            ],
            checks_needed: [],
            resources_to_spend: [],
            risks: [{ risk: "Confondre memoire PJ et verite systeme", severity: "medium" }],
            fallbacks: ["Basculer vers talk ou observe pour chercher la reponse en jeu"],
            need_clarification: []
          },
          targets: askInfoTargets.length > 0 ? askInfoTargets : [locationId],
          ask_info_resolution: askInfoResolution,
          runtime_actions: [],
          narrative_output: {
            player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
            mj_notes: [
              "Narration finale generee par l'IA aval a partir de la memoire joueur et du contexte local."
            ],
            hidden_truth_updates: []
          }
        }
      };
    }

    const missingStructuredIntent = !intentType;
    return {
      decisionReason: missingStructuredIntent
        ? "clarification_required.upstream_intent_missing"
        : "clarification_required.meta_unclear",
      outputContract: {
        ...common,
        intent_type: "meta_unclear",
        intent_confidence: 0.4,
        requires_clarification: true,
        clarification_question: missingStructuredIntent
          ? "Intent structure manquant: fournis intent_type (observe|talk|move_local|ask_info|attempt_forbidden)."
          : "Tu veux observer, parler, te deplacer, ou demander une information ?",
        plan: {
          objective: "Lever l'ambiguite d'intention",
          approach: "Demande de clarification",
          assumptions: [],
          checks_needed: [],
          resources_to_spend: [],
          risks: [{ risk: "Executer une action non souhaitee", severity: "high" }],
          fallbacks: [],
          need_clarification: ["Intention insuffisamment specifique"]
        },
        runtime_actions: [],
        narrative_output: {
          player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
          mj_notes: ["Clarification demandee avant generation de narration finale."],
          hidden_truth_updates: []
        }
      }
    };
  }

  async function tryHandle(req, res) {
    if (req.method === "GET" && req.url === "/api/narration-module/status") {
      return sendJson(res, 200, {
        openai_key_available: Boolean(openAiApiKey),
        narration_generation_enabled: Boolean(openAiApiKey)
      });
    }

    if (req.method === "POST" && req.url === "/api/narration-module/process-turn") {
      try {
        initNarrationRuntime();
        if (!narrationRuntime) {
          const details = narrationRuntimeInitError
            ? String(narrationRuntimeInitError.message || narrationRuntimeInitError)
            : "runtime unavailable";
          return sendJson(res, 503, { error: "Narration module runtime unavailable", details });
        }

        const body = await parseJsonBody(req);
        const campaignId = safeString(body.campaign_id, "setup-campaign-default");
        const turnId = safeString(body.turn_id, `turn-${cryptoImpl.randomUUID()}`);
        const locationId = safeString(body.location_id, "setup_zone");
        const campaignAtTurnStart = narrationRuntime.memoryService.advanceCampaignTurn(campaignId, turnId);
        const reevaluatedEntityUpdates = narrationRuntime.memoryService
          ? reevaluatePendingEntityEnrichments(
              narrationRuntime.memoryService,
              campaignId,
              locationId,
              turnId
            )
          : [];

        const currentWiki = narrationRuntime.memoryStore.getWikiWorldState() || {};
        narrationRuntime.memoryService.setWikiWorldState({
          ...currentWiki,
          location_id: locationId,
          map_prompt: safeString(body.map_prompt)
        });
        narrationRuntime.memoryService.cleanupExpiredEntities(
          campaignId,
          Number(campaignAtTurnStart?.clock?.turn_index ?? 0),
          turnId
        );

        const projectedBeforeIntent = narrationRuntime.memoryService.project(campaignId, {
          location_id: locationId,
          intent_hint: safeString(body.intent_hint),
          target_actor_id: safeString(body.target_actor_id)
        });
        let inputContract = buildInputContract(body, projectedBeforeIntent);
        const campaignBefore = narrationRuntime.memoryService.getCampaign(campaignId);
        const intentPacket = await analyzeIntentPacket(body, inputContract);
        const selectedLore = wikiLoreHelper.selectLore({
          intentType: intentPacket.intent_type,
          playerInput: body.player_input,
          locationId,
          destinationId: intentPacket.destination_id
        });
        let talkRolePlausibility = null;
        if (intentPacket.intent_type === "talk" && safeString(intentPacket.target_actor_hint)) {
          const actorResolution = ensureTalkActorEntity({
            memoryService: narrationRuntime.memoryService,
            campaignId,
            campaignBefore,
            locationId,
            actorHint: intentPacket.target_actor_hint,
            targetActorId: safeString(intentPacket.target_actor_id),
            turnId,
            selectedLoreEntries: selectedLore.selected_entries
          });
          talkRolePlausibility = actorResolution?.rolePlausibility || null;
          if (actorResolution?.kind === "ambiguous") {
            intentPacket.requires_clarification = true;
            intentPacket.clarification_question =
              safeString(actorResolution.clarificationQuestion) ||
              safeString(intentPacket.clarification_question) ||
              "Precise quel interlocuteur tu vises.";
            intentPacket.target_actor_id = null;
          } else if (actorResolution?.kind === "out_of_profile") {
            intentPacket.requires_clarification = true;
            intentPacket.clarification_question =
              safeString(actorResolution.clarificationQuestion) ||
              "Le role demande ne semble pas correspondre au lieu actuel.";
            intentPacket.target_actor_id = null;
          } else if (actorResolution?.entityId) {
            intentPacket.target_actor_id = actorResolution.entityId;
          }
        }
        const selectedLocalLore = localLoreHelper.selectLocalLore({
          campaignMemory: campaignBefore,
          intentType: intentPacket.intent_type,
          playerInput: body.player_input,
          locationId
        });
        const mergedTopicIds = [];
        const seenTopicIds = new Set();
        for (const topicId of [...selectedLore.topic_ids, ...selectedLocalLore.topic_ids]) {
          const normalized = String(topicId ?? "").trim();
          if (!normalized || seenTopicIds.has(normalized)) continue;
          seenTopicIds.add(normalized);
          mergedTopicIds.push(normalized);
        }
        const mergedLoreDb = {
          ...selectedLore.lore_db,
          ...selectedLocalLore.lore_db
        };
        const mergedSelectedLore = {
          topic_ids: mergedTopicIds,
          lore_db: mergedLoreDb,
          selected_entries: [...selectedLore.selected_entries, ...selectedLocalLore.selected_entries]
        };
        narrationRuntime.memoryService.ensureLocationRuntimeState(
          campaignId,
          locationId,
          buildLocationRuntimeSeed(locationId, selectedLore.selected_entries),
          turnId
        );
        if (intentPacket.intent_type === "observe") {
          ensureObservedSceneActors({
            memoryService: narrationRuntime.memoryService,
            campaignId,
            locationId,
            turnId,
            narrationContext: safeString(body.narration_context),
          });
        }
        const projected = narrationRuntime.memoryService.project(campaignId, {
          location_id: locationId,
          intent_type: intentPacket.intent_type,
          target_actor_id: safeString(intentPacket.target_actor_id),
          intent_hint: safeString(body.intent_hint)
        });
        const talkActorEntity =
          intentPacket.intent_type === "talk" && safeString(intentPacket.target_actor_id)
            ? narrationRuntime.memoryService.getEntity(campaignId, safeString(intentPacket.target_actor_id))
            : null;
        inputContract = buildInputContract(body, projected);
        const { outputContract, decisionReason } = buildPlanAndOutputContracts(
          body,
          intentPacket,
          projected,
          turnId,
          mergedSelectedLore,
          talkActorEntity,
          talkRolePlausibility
        );
        const stateBefore = narrationRuntime.memoryService.buildRuntimeStateBefore(campaignId, {
          location_id: locationId,
          intent_type: intentPacket.intent_type,
          target_actor_id: safeString(intentPacket.target_actor_id)
        });

        const trace = narrationRuntime.processor.processTurn(
          turnId,
          inputContract,
          outputContract,
          stateBefore,
          { loreDb: mergedLoreDb }
        );
        narrationRuntime.memoryService.syncCampaignFromRuntimeState(
          campaignId,
          trace.state_after,
          turnId
        );

        for (const fact of outputContract.narrative_output.hidden_truth_updates ?? []) {
          narrationRuntime.memoryService.appendKnowledgeTruthView(
            campaignId,
            { turn_id: turnId, fact: String(fact) },
            turnId
          );
        }

        const projectedAfter = narrationRuntime.memoryService.project(campaignId, {
          location_id: trace.state_after?.location_id ?? locationId,
          intent_type: intentPacket.intent_type,
          target_actor_id: safeString(intentPacket.target_actor_id)
        });
        const truthAfter = narrationRuntime.memoryService.resolveEffectiveTruth(campaignId, {
          location_id: trace.state_after?.location_id ?? locationId,
          intent_type: intentPacket.intent_type,
          target_actor_id: safeString(intentPacket.target_actor_id)
        });
        const entityEnrichmentRequests = collectEntityEnrichmentRequests(
          narrationRuntime.memoryService,
          campaignId,
          intentPacket
        );
        const narrationSelectedLore =
          intentPacket.intent_type === "observe"
            ? buildObserveSelectedLoreForNarration(selectedLore.selected_entries, locationId)
            : selectedLore.selected_entries;
        const aiHandoff = {
          turn_id: turnId,
          campaign_id: campaignId,
          decision_reason: decisionReason,
          narrative_generation_required: true,
          intent_packet: intentPacket,
          input_contract: inputContract,
          output_contract: outputContract,
          runtime_result: {
            runtime_actions: trace.runtime_actions,
            state_diff: trace.state_diff,
            truth_snapshot: truthAfter,
            projected_memory: projectedAfter,
            selected_lore: narrationSelectedLore,
            selected_local_lore: selectedLocalLore.selected_entries,
            entity_enrichment_requests: entityEnrichmentRequests,
            entity_profile_updates: reevaluatedEntityUpdates
          }
        };

        return sendJson(res, 200, {
          turn_id: turnId,
          campaign_id: campaignId,
          decision_reason: decisionReason,
          narrative_generation_required: true,
          intent_packet: intentPacket,
          input_contract: inputContract,
          output_contract: outputContract,
          trace: {
            runtime_actions: trace.runtime_actions,
            state_diff: trace.state_diff
          },
          projected_memory: projectedAfter,
          entity_profile_updates: reevaluatedEntityUpdates,
          ai_handoff: aiHandoff
        });
      } catch (err) {
        const code = err?.code || "process_turn_failed";
        const details = Array.isArray(err?.details) ? err.details : [String(err?.message || err)];
        return sendJson(res, 400, { error: code, details });
      }
    }

    if (req.method === "POST" && req.url === "/api/narration-module/generate-narration") {
      try {
        if (!openAiApiKey) {
          return sendJson(res, 503, {
            error: "openai_key_missing",
            details: ["OPENAI_API_KEY missing: narration generation is disabled."]
          });
        }
        initNarrationRuntime();
        const body = await parseJsonBody(req);
        const aiHandoff = body?.ai_handoff;
        if (!aiHandoff || typeof aiHandoff !== "object") {
          return sendJson(res, 400, {
            error: "ai_handoff_missing",
            details: ["ai_handoff object is required"]
          });
        }

        const campaignId = safeString(aiHandoff.campaign_id, safeString(body?.campaign_id, "setup-campaign-default"));
        const turnId = safeString(
          aiHandoff.turn_id,
          safeString(body?.turn_id, `turn-${cryptoImpl.randomUUID()}`)
        );
        const fallbackText = buildFallbackNarrationFromHandoff(aiHandoff);

        const model = process.env.NARRATION_MODULE_MODEL || "gpt-4.1-mini";
        const systemPrompt =
          "Tu es l'IA narratrice aval d'un JDR. " +
          "Tu recois un paquet runtime fiable (actions executees, diff d'etat, memoire projetee). " +
          "Produis une narration joueur concise et coherente avec ce paquet, sans inventer d'actions non executees. " +
          "Ne revele pas la verite cachee au joueur. " +
          "Si intent_type=observe, decris uniquement ce qui est immediatement perceptible depuis la scene: visible, audible, ambiance, acces apparent, posture des personnes presentes. " +
          "Si intent_type=observe, interdiction de citer des scores, niveaux numeriques, proprietaires, factions, gouvernance ou metadonnees non perceptibles. " +
          "Si output_contract contient interaction_language_state et que comprehension_state=limited ou none, la narration de talk doit refleter cette friction linguistique sans inventer une comprehension parfaite. " +
          "Si comprehension_state=none, ne raconte pas un dialogue fluide: fais sentir l'incomprehension, les gestes, la reformulation ou le blocage. " +
          "Si le paquet contient entity_enrichment_requests, tu peux proposer un enrichissement prudent des profils sous forme de patch structure, sans imposer une verite finale. " +
          "Utilise des valeurs propres et non ambigues. Interdiction de renvoyer des formulations avec 'ou', des fourchettes vagues, ou des categories floues pour les champs structures. " +
          "Pour les enums, utilise de preference: gender_presentation=unknown|masculine|feminine|androgynous|non_binary ; authority_level=unknown|none|low|medium|high|elite ; disposition_to_player=friendly|neutral|wary|hostile ; interaction_state=available|busy|blocked|fleeing|absent ; duty_state=unknown|on_post|on_patrol|off_duty|active_service. " +
          "Ne propose pas plus de 2 enrichissements. " +
          "Repond STRICTEMENT en JSON: { \"player_text\": \"...\", \"mj_notes\": [\"...\"], \"next_turn_hints\": [\"...\"], \"entity_enrichment_proposals\": [{ \"entity_id\": \"...\", \"proposal_type\": \"actor_profile_enrichment\", \"confidence\": 0.0, \"based_on\": [\"...\"], \"proposed_patch\": { \"payload\": {} } }] }.";
        const parsed = await callOpenAiJson({
          model,
          systemPrompt,
          userPayload: { ai_handoff: aiHandoff }
        });
        const playerText =
          safeString(parsed?.player_text ?? parsed?.player_facing_text, fallbackText).trim() || fallbackText;
        const mjNotes = toStringArray(parsed?.mj_notes);
        const nextTurnHints = toStringArray(parsed?.next_turn_hints);
        const rawProposals = Array.isArray(parsed?.entity_enrichment_proposals)
          ? parsed.entity_enrichment_proposals
          : [];
        const entityEnrichmentProposals = rawProposals
          .map((proposal) => sanitizeEntityEnrichmentProposal(proposal))
          .filter(Boolean);
        const profileUpdateDecisions = [];

        if (narrationRuntime && campaignId && turnId) {
          const runtimeLocationId =
            safeString(aiHandoff?.runtime_result?.truth_snapshot?.effective_world_state?.location_id) ||
            safeString(aiHandoff?.input_contract?.world_state?.location_id) ||
            null;
          const linkedEntityIds = Array.isArray(aiHandoff?.output_contract?.targets)
            ? aiHandoff.output_contract.targets.map((item) => safeString(item)).filter(Boolean)
            : [];
          narrationRuntime.memoryService.appendAutoPlayerSummary(
            campaignId,
            {
              turn_id: turnId,
              text: playerText,
              location_id: runtimeLocationId,
              linked_entity_ids: linkedEntityIds,
              tags: [
                safeString(aiHandoff?.output_contract?.intent_type),
                "auto_summary"
              ].filter(Boolean)
            },
            turnId
          );
          for (const hint of nextTurnHints.slice(0, 3)) {
            narrationRuntime.memoryService.appendAutoPlayerLead(
              campaignId,
              {
                turn_id: turnId,
                text: hint,
                location_id: runtimeLocationId,
                linked_entity_ids: linkedEntityIds,
                tags: [
                  safeString(aiHandoff?.output_contract?.intent_type),
                  "next_turn_hint"
                ].filter(Boolean)
              },
              turnId
            );
          }
          for (const proposal of entityEnrichmentProposals) {
            const entity = narrationRuntime.memoryService.getEntity(campaignId, proposal.entity_id);
            if (!entity) {
              profileUpdateDecisions.push({
                entity_id: proposal.entity_id,
                profile_update_decision: "rejected",
                reserve_reason: "entity_not_found"
              });
              continue;
            }
            if (shouldDeferEntityEnrichment(entity, proposal)) {
              const deferredEntity = JSON.parse(JSON.stringify(entity));
              const sanitizedPatch = sanitizeEntityPatchProposal(proposal.proposed_patch);
              deferredEntity.payload = {
                ...(deferredEntity.payload && typeof deferredEntity.payload === "object"
                  ? deferredEntity.payload
                  : {}),
                profile_state: "pending_enrichment",
                pending_enrichment: {
                  ...proposal,
                  proposed_patch: sanitizedPatch || proposal.proposed_patch
                }
              };
              narrationRuntime.memoryService.upsertEntity(campaignId, deferredEntity, turnId);
              profileUpdateDecisions.push({
                entity_id: proposal.entity_id,
                profile_update_decision: "deferred",
                reserve_reason: "wiki_or_runtime_validation_needed"
              });
              continue;
            }

            const sanitizedPatch = sanitizeEntityPatchProposal(proposal.proposed_patch);
            if (!sanitizedPatch) {
              profileUpdateDecisions.push({
                entity_id: proposal.entity_id,
                profile_update_decision: "rejected",
                reserve_reason: "proposal_invalid_after_runtime_review"
              });
              continue;
            }
            const mergedEntity = localizeResolvedEntityPayload(
              mergeEntityPatch(entity, sanitizedPatch)
            );
            mergedEntity.payload = {
              ...(mergedEntity.payload && typeof mergedEntity.payload === "object"
                ? mergedEntity.payload
                : {}),
              profile_state: "resolved",
              pending_enrichment: null
            };
            narrationRuntime.memoryService.upsertEntity(campaignId, mergedEntity, turnId);
            profileUpdateDecisions.push({
              entity_id: proposal.entity_id,
              profile_update_decision: "accepted_now",
              reserve_reason: null
            });
          }
        }

        return sendJson(res, 200, {
          campaign_id: campaignId,
          turn_id: turnId,
          source: "llm",
          player_text: playerText,
          mj_notes: mjNotes,
          next_turn_hints: nextTurnHints,
          entity_enrichment_proposals: entityEnrichmentProposals,
          proposal_update_decisions: profileUpdateDecisions,
          profile_update_decisions: profileUpdateDecisions
        });
      } catch (err) {
        return sendJson(res, 400, {
          error: "generate_narration_failed",
          details: [String(err?.message || err)]
        });
      }
    }

    return false;
  }

  return { tryHandle };
}

module.exports = { createNarrationModuleApi };
