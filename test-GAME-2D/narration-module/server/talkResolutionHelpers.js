function createTalkResolutionHelpers(deps) {
  const {
    safeString,
    normalizeLooseText,
    getActorDistinctiveMarker,
    extractRoleHintsFromText,
    roleHintMatchesActorRole,
    collectVisibleActorCandidates,
    findMatchingActorEntity,
    collectActorCandidates,
    resolveLocationGenerationProfile,
    resolveLocationLoreContext,
    buildLanguageSeedFromGenerationProfile,
    buildActorDistinctiveSeed,
    promoteSceneActorToInteractive,
    applyActorLanguageSeed,
    applyActorContextFromGenerationProfile,
    buildActorAliases,
    computeRolePlausibility,
    readScenePerceptionState,
    buildApproachClarificationQuestion,
    syncSceneActorSnapshots
  } = deps;

  function buildTalkClarificationOptions(candidates) {
    return (Array.isArray(candidates) ? candidates : [])
      .map((item) => {
        const actor = item?.actor;
        const actorId = safeString(actor?.entity_id);
        const displayLabel =
          safeString(actor?.display_name) ||
          safeString(actor?.payload?.identity?.role) ||
          actorId;
        if (!actorId || !displayLabel) return null;
        return {
          actor_id: actorId,
          label: displayLabel,
          role: safeString(actor?.payload?.identity?.role) || displayLabel
        };
      })
      .filter(Boolean);
  }

  function buildAmbiguousTalkResolution(candidates, actorHint) {
    const options = buildTalkClarificationOptions(candidates).slice(0, 3);
    if (options.length < 2) return null;
    const labels = options.map((option) => option.label);
    return {
      kind: "ambiguous",
      clarification_question:
        `Tu vises qui exactement pour ${safeString(actorHint, "ce dialogue")} ? ${labels.join(", ")}.`,
      candidate_options: options
    };
  }

  function buildPendingTalkClarification({
    locationId,
    actorHint,
    clarificationQuestion,
    candidateOptions,
    turnId
  }) {
    return {
      kind: "talk_target",
      location_id: safeString(locationId),
      actor_hint: safeString(actorHint),
      question: safeString(clarificationQuestion),
      created_at_turn: safeString(turnId),
      options: Array.isArray(candidateOptions) ? candidateOptions : []
    };
  }

  function resolvePendingTalkClarificationAnswer({ campaign, locationId, playerInput, pendingClarification }) {
    const pending = deps.sanitizePendingClarification(pendingClarification);
    if (!pending || pending.kind !== "talk_target") return null;
    if (safeString(pending.location_id) && safeString(pending.location_id) !== safeString(locationId)) return null;
    const normalizedInput = normalizeLooseText(playerInput);
    if (!normalizedInput) return null;
    const options = Array.isArray(pending.options) ? pending.options : [];
    const scoredOptions = options
      .map((option) => {
        const actor = campaign?.entity_registry?.actors?.[safeString(option.actor_id)] ?? null;
        const actorAliases = Array.isArray(actor?.payload?.interaction?.aliases)
          ? actor.payload.interaction.aliases
          : [];
        const actorMarkers = [
          getActorDistinctiveMarker(actor),
          safeString(actor?.payload?.scene_presence?.current_activity),
          safeString(actor?.payload?.scene_presence?.activity_descriptor)
        ];
        const aliases = [
          safeString(option.label),
          safeString(option.role),
          safeString(option.actor_id),
          ...actorAliases,
          ...actorMarkers
        ]
          .map((value) => normalizeLooseText(value))
          .filter(Boolean);
        let score = 0;
        for (const alias of aliases) {
          if (!alias) continue;
          if (normalizedInput === alias) score += 10;
          else if (normalizedInput.includes(alias)) score += 8;
          const aliasTokens = alias.split(/\s+/).filter((token) => token && token.length >= 3);
          for (const token of aliasTokens) {
            if (normalizedInput.includes(token)) score += 2;
          }
        }
        const roleHints = extractRoleHintsFromText(playerInput);
        if (roleHints.length > 0) {
          if (roleHintMatchesActorRole(roleHints, safeString(actor?.payload?.identity?.role) || safeString(option.role))) {
            score += 4;
          } else {
            score -= 4;
          }
        }
        return { option, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);
    if (scoredOptions.length === 0) return null;
    const [best, second] = scoredOptions;
    if (second && best.score <= second.score) return null;
    const actor = campaign?.entity_registry?.actors?.[safeString(best.option.actor_id)] ?? null;
    return {
      actor_id: safeString(best.option.actor_id),
      actor_hint:
        safeString(actor?.payload?.identity?.role) ||
        safeString(best.option.role) ||
        safeString(best.option.label)
    };
  }

  function resolveTalkActorEntity({ campaign, locationId, actorHint, targetActorId }) {
    const explicitTarget = safeString(targetActorId);
    const visibleCandidates = collectVisibleActorCandidates(campaign, locationId, actorHint, explicitTarget);
    if (visibleCandidates.length === 1) {
      return { kind: "resolved", actor: visibleCandidates[0].actor };
    }
    if (visibleCandidates.length > 1) {
      const normalizedHint = normalizeLooseText(actorHint);
      const roleHints = extractRoleHintsFromText(actorHint);
      const sameRoleVisibleCandidates = visibleCandidates.filter(({ actor }) => {
        const actorRole = normalizeLooseText(actor?.payload?.identity?.role);
        const knownToPlayerAs = normalizeLooseText(actor?.payload?.interaction?.known_to_player_as);
        if (normalizedHint && (actorRole === normalizedHint || knownToPlayerAs === normalizedHint)) return true;
        return roleHintMatchesActorRole(roleHints, safeString(actor?.payload?.identity?.role));
      });
      if (!explicitTarget && normalizedHint && sameRoleVisibleCandidates.length >= 2) {
        const ambiguousResolution = buildAmbiguousTalkResolution(sameRoleVisibleCandidates, actorHint);
        if (ambiguousResolution) return ambiguousResolution;
      }
      const [bestVisible, secondVisible] = visibleCandidates;
      const bestRole = normalizeLooseText(bestVisible?.actor?.payload?.identity?.role);
      const secondRole = normalizeLooseText(secondVisible?.actor?.payload?.identity?.role);
      if (
        bestVisible &&
        secondVisible &&
        bestRole &&
        bestRole === secondRole &&
        Math.abs((bestVisible.score || 0) - (secondVisible.score || 0)) <= 2
      ) {
        const ambiguousResolution = buildAmbiguousTalkResolution(visibleCandidates, actorHint);
        if (ambiguousResolution) return ambiguousResolution;
      }
      return { kind: "resolved", actor: bestVisible.actor, auto_selected: true };
    }

    if (explicitTarget) {
      const exact = findMatchingActorEntity(campaign, locationId, actorHint, explicitTarget);
      if (exact?.entity_id === explicitTarget) {
        return { kind: "not_contactable", actor: exact };
      }
    }

    const candidates = collectActorCandidates(campaign, locationId, actorHint, "");
    if (candidates.length === 0) return { kind: "not_contactable" };
    return { kind: "not_contactable", actor: candidates[0].actor };
  }

  function ensureTalkActorEntity({
    memoryService,
    campaignId,
    campaignBefore,
    locationId,
    actorHint,
    targetActorId,
    turnId
  }) {
    if (!actorHint) return null;
    const resolution = resolveTalkActorEntity({
      campaign: campaignBefore,
      locationId,
      actorHint,
      targetActorId
    });
    if (resolution.kind === "resolved" && resolution.actor?.entity_id) {
      const locationProfile = resolveLocationGenerationProfile(locationId);
      const locationLoreContext = resolveLocationLoreContext(locationId);
      const languageSeed = buildLanguageSeedFromGenerationProfile(locationProfile);
      const seededDistinctives = buildActorDistinctiveSeed({
        entityId: safeString(resolution.actor.entity_id),
        actorHint,
        locationId,
        locationProfile,
        locationLoreContext
      });
      const existingActor = promoteSceneActorToInteractive(
        JSON.parse(JSON.stringify(resolution.actor)),
        actorHint
      );
      if (
        safeString(seededDistinctives.display_name) &&
        (!safeString(existingActor.display_name) ||
          normalizeLooseText(existingActor.display_name) === normalizeLooseText(actorHint))
      ) {
        existingActor.display_name = seededDistinctives.display_name;
      }
      if (seededDistinctives.payload && typeof seededDistinctives.payload === "object") {
        const payload = existingActor.payload && typeof existingActor.payload === "object" ? existingActor.payload : {};
        existingActor.payload = {
          ...payload,
          identity: {
            ...((payload.identity && typeof payload.identity === "object") ? payload.identity : {}),
            ...((seededDistinctives.payload.identity && typeof seededDistinctives.payload.identity === "object")
              ? seededDistinctives.payload.identity
              : {})
          },
          appearance: {
            ...((payload.appearance && typeof payload.appearance === "object") ? payload.appearance : {}),
            ...((seededDistinctives.payload.appearance && typeof seededDistinctives.payload.appearance === "object")
              ? seededDistinctives.payload.appearance
              : {})
          },
          scene_presence: {
            ...((payload.scene_presence && typeof payload.scene_presence === "object") ? payload.scene_presence : {}),
            ...((seededDistinctives.payload.scene_presence && typeof seededDistinctives.payload.scene_presence === "object")
              ? seededDistinctives.payload.scene_presence
              : {})
          }
        };
      }
      const preparedActor = applyActorContextFromGenerationProfile(
        applyActorLanguageSeed(existingActor, languageSeed),
        locationProfile,
        actorHint
      );
      preparedActor.payload = preparedActor.payload && typeof preparedActor.payload === "object"
        ? preparedActor.payload
        : {};
      preparedActor.payload.interaction = preparedActor.payload.interaction && typeof preparedActor.payload.interaction === "object"
        ? preparedActor.payload.interaction
        : {};
      preparedActor.payload.interaction.aliases = buildActorAliases(preparedActor);
      memoryService.upsertEntity(campaignId, preparedActor, turnId);
      memoryService.markEntitySeen(campaignId, preparedActor.entity_id, turnId);
      memoryService.ensureVisibleActorAtLocation(campaignId, locationId, preparedActor.entity_id, turnId);
      syncSceneActorSnapshots({ memoryService, campaignId, locationId, turnId });
      return {
        kind: "resolved",
        entityId: preparedActor.entity_id
      };
    }
    if (resolution.kind === "ambiguous") {
      return {
        kind: "ambiguous",
        clarificationQuestion: resolution.clarification_question,
        candidateOptions: Array.isArray(resolution.candidate_options) ? resolution.candidate_options : [],
        rolePlausibility: null
      };
    }

    const locationProfile = resolveLocationGenerationProfile(locationId);
    const rolePlausibility = computeRolePlausibility(locationProfile, actorHint);
    const locationEntity = memoryService.getEntity(campaignId, locationId);
    const scenePerception = readScenePerceptionState(locationEntity);
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
    if (resolution.kind === "not_contactable") {
      return {
        kind: "not_contactable",
        rolePlausibility,
        clarificationQuestion: buildApproachClarificationQuestion(actorHint, scenePerception, locationId)
      };
    }
    return {
      kind: "not_contactable",
      rolePlausibility,
      clarificationQuestion: buildApproachClarificationQuestion(actorHint, scenePerception, locationId)
    };
  }

  return {
    buildPendingTalkClarification,
    resolvePendingTalkClarificationAnswer,
    resolveTalkActorEntity,
    ensureTalkActorEntity
  };
}

module.exports = {
  createTalkResolutionHelpers
};
