function createNarrationOutputHelpers(deps) {
  const {
    safeString,
    toStringArray,
    getProjectedLocationRuntimeState,
    readScenePerceptionState,
    readStringArrayField
  } = deps;

  function buildFallbackNarrationFromHandoff(aiHandoff) {
    const intentType = safeString(aiHandoff?.output_contract?.intent_type, "action");
    if (intentType === "talk") {
      const targetLabel =
        safeString(aiHandoff?.runtime_result?.talk_context?.target_actor?.display_name) ||
        safeString(aiHandoff?.runtime_result?.talk_context?.target_actor?.role) ||
        "ton interlocuteur";
      const embeddedRequest = safeString(aiHandoff?.runtime_result?.talk_context?.embedded_player_request);
      if (embeddedRequest) {
        return `Tu t'adresses a ${targetLabel}. Quelques mots sont echanges autour de ${embeddedRequest}.`;
      }
      return `Tu t'adresses a ${targetLabel} et l'echange se noue brievement dans la scene.`;
    }
    const actionCount = Array.isArray(aiHandoff?.runtime_result?.runtime_actions)
      ? aiHandoff.runtime_result.runtime_actions.length
      : 0;
    return `Tu poursuis ton action (${intentType}) et le monde reagit (${actionCount} action(s) runtime).`;
  }

  function deriveScenePerceptionFromHandoff(aiHandoff) {
    const locationId =
      safeString(aiHandoff?.runtime_result?.projected_memory?.effective_world_state?.location_id) ||
      safeString(aiHandoff?.runtime_result?.truth_snapshot?.effective_world_state?.location_id) ||
      safeString(aiHandoff?.input_contract?.world_state?.location_id);
    const projected = aiHandoff?.runtime_result?.projected_memory;
    const locationRuntimeState = projected ? getProjectedLocationRuntimeState(projected, locationId) : null;
    return readScenePerceptionState(locationRuntimeState);
  }

  function sanitizeNextTurnHintsFromPerception(aiHandoff, rawHints) {
    const hints = toStringArray(rawHints);
    const intentType = safeString(aiHandoff?.output_contract?.intent_type);
    const scenePerception = deriveScenePerceptionFromHandoff(aiHandoff);
    if (
      intentType !== "observe" ||
      Number(scenePerception.contactable_actor_count || 0) > 0
    ) {
      return hints;
    }
    const interactionPattern = /\b(interagir|parler|aborder|dialoguer|demander a|marchand|commercant|clerc|garde|marin)\b/i;
    const filtered = hints.filter((hint) => !interactionPattern.test(safeString(hint)));
    if (filtered.length > 0) {
      return filtered.slice(0, 3);
    }
    const points = readStringArrayField(scenePerception.active_points_of_interest);
    if (points.length > 0) {
      return points.slice(0, 2).map((point) => `Te rapprocher de ${point} pour reperer quelqu'un de plus pres.`);
    }
    return ["Observer davantage la scene ou te rapprocher d'une zone plus precise."];
  }

  return {
    buildFallbackNarrationFromHandoff,
    sanitizeNextTurnHintsFromPerception
  };
}

module.exports = {
  createNarrationOutputHelpers
};
