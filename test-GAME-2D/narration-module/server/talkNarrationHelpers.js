function createTalkNarrationHelpers(deps) {
  const {
    safeString,
    readStringArrayField,
    normalizeLooseText,
    sanitizeFragmentText,
    getActorDistinctiveMarker
  } = deps;

  function buildTalkSceneContext(projectedAfter, targetActorId) {
    const actors = Array.isArray(projectedAfter?.projected_units?.entity_registry?.actors)
      ? projectedAfter.projected_units.entity_registry.actors
      : [];
    const visibleActors = actors
      .filter((actor) => safeString(actor?.entity_id))
      .slice(0, 4);
    const targetActor =
      visibleActors.find((actor) => safeString(actor?.entity_id) === safeString(targetActorId)) || null;
    const nearbyActors = visibleActors
      .filter((actor) => safeString(actor?.entity_id) !== safeString(targetActorId))
      .slice(0, 3);
    const sceneMode =
      visibleActors.length <= 1
        ? "one_to_one"
        : visibleActors.length === 2
          ? "with_bystanders"
          : "small_group";
    return {
      targetActor,
      visibleActors,
      nearbyActors,
      sceneMode,
      sceneRoles: {
        primary: targetActor
          ? {
              entity_id: safeString(targetActor?.entity_id),
              display_name: safeString(targetActor?.display_name),
              role: safeString(targetActor?.payload?.identity?.role)
            }
          : null,
        secondary: nearbyActors[0]
          ? {
              entity_id: safeString(nearbyActors[0]?.entity_id),
              display_name: safeString(nearbyActors[0]?.display_name),
              role: safeString(nearbyActors[0]?.payload?.identity?.role)
            }
          : null,
        background: nearbyActors.slice(1, 3).map((actor) => ({
          entity_id: safeString(actor?.entity_id),
          display_name: safeString(actor?.display_name),
          role: safeString(actor?.payload?.identity?.role)
        }))
      }
    };
  }

  function buildTalkSpeakerCue(actor, sceneRole = "background") {
    if (!actor || typeof actor !== "object") return null;
    const payload = actor.payload && typeof actor.payload === "object" ? actor.payload : {};
    const social = payload.social && typeof payload.social === "object" ? payload.social : {};
    const interaction = payload.interaction && typeof payload.interaction === "object" ? payload.interaction : {};
    const scenePresence = payload.scene_presence && typeof payload.scene_presence === "object" ? payload.scene_presence : {};
    const appearance = payload.appearance && typeof payload.appearance === "object" ? payload.appearance : {};
    const role = safeString(payload?.identity?.role);
    return {
      entity_id: safeString(actor?.entity_id),
      display_name: safeString(actor?.display_name),
      role,
      scene_role: sceneRole,
      authority_level: safeString(social.authority_level),
      social_rank: safeString(social.social_rank),
      hospitality_style: safeString(social.hospitality_style),
      disposition_to_player: safeString(social.disposition_to_player),
      interaction_state: safeString(social.interaction_state),
      familiarity_level: safeString(interaction.familiarity_level),
      current_activity: safeString(scenePresence.current_activity),
      distinctive_marker:
        getActorDistinctiveMarker(actor) ||
        readStringArrayField(appearance.notable_details)[0] ||
        "",
      delivery_hint: buildTalkDeliveryHint(actor, sceneRole)
    };
  }

  function buildTalkDeliveryHint(actor, sceneRole = "background") {
    if (!actor || typeof actor !== "object") return "";
    const payload = actor.payload && typeof actor.payload === "object" ? actor.payload : {};
    const social = payload.social && typeof payload.social === "object" ? payload.social : {};
    const role = safeString(payload?.identity?.role);
    const authorityLevel = safeString(social.authority_level);
    const hospitalityStyle = safeString(social.hospitality_style);
    const disposition = safeString(social.disposition_to_player);
    const fragments = [];
    if (sceneRole === "primary") fragments.push("porte l'echange principal");
    else if (sceneRole === "secondary") fragments.push("peut reagir ou couper brievement");
    else fragments.push("reste surtout perceptible en arriere-plan");
    if (authorityLevel === "high" || authorityLevel === "elite") fragments.push("parle avec autorite");
    else if (authorityLevel === "low" && role) fragments.push(`parle comme un ${role} de service`);
    if (hospitalityStyle === "guarded") fragments.push("reste retenu et prudent");
    else if (hospitalityStyle === "warm") fragments.push("repond avec plus d'ouverture");
    if (disposition === "wary") fragments.push("laisse filtrer de la mefiance");
    else if (disposition === "friendly") fragments.push("laisse filtrer une certaine cordialite");
    return fragments.filter(Boolean).join(", ");
  }

  function buildTalkDialogueGuidance(talkSceneContext, conversationMode, hasEmbeddedRequest) {
    const nearbyActors = Array.isArray(talkSceneContext?.nearbyActors) ? talkSceneContext.nearbyActors : [];
    return {
      direct_speech_required: true,
      include_player_line: true,
      include_primary_reply: true,
      include_secondary_reaction: nearbyActors.length > 0,
      include_background_motion: nearbyActors.length > 1,
      max_secondary_lines: nearbyActors.length > 0 ? 1 : 0,
      max_background_beats: nearbyActors.length > 1 ? 2 : nearbyActors.length > 0 ? 1 : 0,
      preferred_structure: hasEmbeddedRequest ? "approach_line_reply" : "approach_reply",
      conversation_mode: safeString(conversationMode),
      scene_mode: safeString(talkSceneContext?.sceneMode),
      keep_primary_actor_central: true,
      avoid_summary_without_quotes: true
    };
  }

  function buildTalkDialogueBlueprint(talkSceneContext, conversationMode, embeddedPlayerRequest) {
    const primary = buildTalkSpeakerCue(talkSceneContext?.targetActor, "primary");
    const secondary = buildTalkSpeakerCue(talkSceneContext?.nearbyActors?.[0], "secondary");
    const hasEmbeddedRequest = Boolean(safeString(embeddedPlayerRequest));
    return {
      opening_beat: hasEmbeddedRequest ? "approach_then_player_line" : "approach_then_brief_exchange",
      conversation_mode: safeString(conversationMode),
      primary_focus: primary
        ? {
            entity_id: primary.entity_id,
            display_name: primary.display_name,
            role: primary.role,
            delivery_hint: primary.delivery_hint
          }
        : null,
      secondary_option: secondary
        ? {
            entity_id: secondary.entity_id,
            display_name: secondary.display_name,
            role: secondary.role,
            delivery_hint: secondary.delivery_hint
          }
        : null,
      background_presence: Array.isArray(talkSceneContext?.nearbyActors)
        ? talkSceneContext.nearbyActors.slice(1, 3).map((actor) => ({
            entity_id: safeString(actor?.entity_id),
            display_name: safeString(actor?.display_name),
            role: safeString(actor?.payload?.identity?.role),
            current_activity: safeString(actor?.payload?.scene_presence?.current_activity)
          }))
        : [],
      end_beat: "leave_clear_opening_for_next_turn"
    };
  }

  function looksLikeDirectSpeechNarration(text) {
    const raw = safeString(text);
    if (!raw) return false;
    return raw.includes("\"") || raw.includes("«") || raw.includes("»") || /(^|\n)\s*[-–]\s*[A-Za-zÀ-ÿ]/.test(raw);
  }

  function buildTalkReplyLineFromCue(primaryCue, embeddedPlayerRequest) {
    const role = safeString(primaryCue?.role, "interlocuteur");
    const hospitalityStyle = safeString(primaryCue?.hospitality_style);
    const authorityLevel = safeString(primaryCue?.authority_level);
    const disposition = safeString(primaryCue?.disposition_to_player);
    const familiarityLevel = safeString(primaryCue?.familiarity_level);
    const normalizedRequest = normalizeLooseText(embeddedPlayerRequest);
    if (/tout va bien|ca va|rien a signaler|rien a signaler/.test(normalizedRequest)) {
      if (authorityLevel === "high" || role === "officier") return "\"Rien a signaler. On tient la position.\"";
      return "\"Affirmatif. Rien a signaler pour l'instant.\"";
    }
    if (familiarityLevel === "recurrent" || familiarityLevel === "known") return "\"Vous revoila. Allez droit au fait.\"";
    if (disposition === "friendly") return "\"Bonjour. Je peux peut-etre vous aider.\"";
    if (hospitalityStyle === "guarded" || disposition === "wary") return "\"Ca depend de ce que vous cherchez. Faites vite.\"";
    if (authorityLevel === "low" && role) return `"Oui. Que voulez-vous au juste, ${role === "garde" ? "voyageur" : "l'ami"} ?"`;
    return "\"Oui ? Je vous ecoute.\"";
  }

  function buildTalkPlayerLine(embeddedPlayerRequest) {
    const request = sanitizeFragmentText(embeddedPlayerRequest);
    if (!request) return "\"Bonjour. J'aurais une question.\"";
    const normalized = normalizeLooseText(request);
    if (normalized.startsWith("bonjour") || normalized.startsWith("bonsoir") || normalized.startsWith("salut")) {
      return `"${request}"`;
    }
    return `"${request.charAt(0).toUpperCase()}${request.slice(1)}"`;
  }

  function buildTalkDirectSpeechFallback(aiHandoff) {
    const talkContext = aiHandoff?.runtime_result?.talk_context ?? {};
    const targetActor = talkContext?.target_actor ?? {};
    const primaryCue = talkContext?.speaker_cues?.primary ?? null;
    const secondaryCue = talkContext?.speaker_cues?.secondary ?? null;
    const backgroundCues = Array.isArray(talkContext?.speaker_cues?.background)
      ? talkContext.speaker_cues.background
      : [];
    const targetLabel =
      safeString(targetActor?.display_name) ||
      safeString(targetActor?.role) ||
      safeString(primaryCue?.display_name) ||
      "ton interlocuteur";
    const marker =
      safeString(primaryCue?.distinctive_marker) ||
      safeString(targetActor?.payload?.appearance?.notable_details?.[0]);
    const activity =
      safeString(primaryCue?.current_activity) ||
      safeString(targetActor?.payload?.scene_presence?.current_activity);
    const embeddedRequest = safeString(talkContext?.embedded_player_request);
    const approachBeat = marker
      ? `Vous vous approchez de ${targetLabel}, ${marker}.`
      : `Vous vous approchez de ${targetLabel}.`;
    const activityBeat = activity ? ` Il ${activity}.` : "";
    const playerLine = buildTalkPlayerLine(embeddedRequest);
    const replyLine = buildTalkReplyLineFromCue(primaryCue, embeddedRequest);
    let secondaryBeat = "";
    if (secondaryCue && safeString(talkContext?.scene_mode) !== "one_to_one") {
      const secondaryLabel = safeString(secondaryCue?.display_name) || safeString(secondaryCue?.role) || "Un autre temoin";
      const secondaryActivity = safeString(secondaryCue?.current_activity);
      const secondaryDisposition = safeString(secondaryCue?.disposition_to_player);
      if (secondaryDisposition === "friendly") {
        secondaryBeat = ` ${secondaryLabel} lache avec un demi-sourire: "Il n'est pas bavard, mais il ecoute."`;
      } else if (secondaryDisposition === "wary" || safeString(secondaryCue?.hospitality_style) === "guarded") {
        secondaryBeat = ` ${secondaryLabel} jette un regard bref vers vous, sans quitter completement son poste.`;
      } else {
        secondaryBeat = secondaryActivity
          ? ` ${secondaryLabel} reste en retrait et ${secondaryActivity}.`
          : ` ${secondaryLabel} reste en retrait et surveille l'echange du coin de l'oeil.`;
      }
    }
    let backgroundBeat = "";
    if (backgroundCues.length > 0) {
      const background = backgroundCues[0];
      const backgroundLabel = safeString(background?.display_name) || safeString(background?.role) || "Plus loin, quelqu'un";
      const backgroundActivity = safeString(background?.current_activity);
      backgroundBeat = backgroundActivity
        ? ` Plus loin, ${backgroundLabel} continue ${backgroundActivity}.`
        : ` En arriere-plan, ${backgroundLabel} laisse la scene respirer sans intervenir.`;
    }
    return `${approachBeat}${activityBeat} Vous lancez: ${playerLine} ${targetLabel} vous repond: ${replyLine}${secondaryBeat}${backgroundBeat}`.trim();
  }

  return {
    buildTalkSceneContext,
    buildTalkSpeakerCue,
    buildTalkDialogueGuidance,
    buildTalkDialogueBlueprint,
    looksLikeDirectSpeechNarration,
    buildTalkDirectSpeechFallback
  };
}

module.exports = {
  createTalkNarrationHelpers
};
