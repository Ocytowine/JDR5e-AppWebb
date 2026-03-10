function normalizeIntentBoundaries({ intentPacket, body, deps }) {
  if (!intentPacket || typeof intentPacket !== "object") return;
  const playerInput = deps.safeString(body?.player_input);

  if (
    intentPacket.intent_type === "ask_info" &&
    deps.isPresenceScanRequest(playerInput)
  ) {
    intentPacket.intent_type = "observe";
    intentPacket.notes = [
      ...deps.toStringArray(intentPacket.notes),
      "Requalifie en observe: demande de perception immediate."
    ];
  }

  if (
    intentPacket.intent_type === "ask_info" &&
    deps.isObservableDescriptionRequest(playerInput, deps.safeString(intentPacket.target_actor_hint))
  ) {
    intentPacket.intent_type = "observe";
    intentPacket.notes = [
      ...deps.toStringArray(intentPacket.notes),
      "Requalifie en observe: demande descriptive sur du visible."
    ];
  }

  if (
    intentPacket.intent_type === "move_local" &&
    deps.isApproachActorIntent(playerInput) &&
    deps.safeString(intentPacket.target_actor_hint)
  ) {
    intentPacket.intent_type = "talk";
    intentPacket.notes = [
      ...deps.toStringArray(intentPacket.notes),
      "Requalifie en talk: approche d'un acteur visible."
    ];
  }
}

function resolveTalkIntentContext({
  intentPacket,
  body,
  campaignBefore,
  locationId,
  activePendingClarification,
  activeTalkActorId,
  deps
}) {
  deps.resolveTalkIntentPrelude({
    intentPacket,
    body,
    campaignBefore,
    locationId,
    activePendingClarification,
    activeTalkActorId
  });
  deps.resolveTalkTargetHintContext({
    intentPacket,
    body,
    campaignBefore,
    locationId
  });
}

function resolveObserveIntentContext({
  intentPacket,
  campaign,
  locationId,
  deps
}) {
  if (intentPacket?.intent_type !== "observe") return;
  deps.resolvePerceptiveIntentFocus({
    intentPacket,
    campaign,
    locationId
  });
}

function resolveAskInfoIntentContext({
  intentPacket,
  campaign,
  locationId,
  deps
}) {
  if (intentPacket?.intent_type !== "ask_info") return;
  deps.resolvePerceptiveIntentFocus({
    intentPacket,
    campaign,
    locationId
  });
}

function resolveMoveLocalIntentContext({
  intentPacket,
  body,
  selectedLore,
  locationRuntimeState,
  locationId,
  deps
}) {
  if (intentPacket?.intent_type !== "move_local") {
    return selectedLore;
  }
  return deps.resolveMoveIntentContext({
    intentPacket,
    body,
    selectedLore,
    locationRuntimeState,
    locationId
  });
}

module.exports = {
  normalizeIntentBoundaries,
  resolveTalkIntentContext,
  resolveObserveIntentContext,
  resolveAskInfoIntentContext,
  resolveMoveLocalIntentContext
};
