"use strict";

function createNarrationSystemCommands(deps = {}) {
  const {
    getNarrationRuntime,
    narrationStatePath,
    createInitialNarrativeWorldState,
    saveNarrativeWorldState,
    resetNarrativeSessionDb,
    loadNarrativeWorldState,
    loadNarrationRuntimeStateFromDisk,
    sanitizeCharacterProfile,
    sanitizeInterlocutorLabel,
    applyCriticalMutation,
    makeMjResponse,
    buildSpeakerPayload
  } = deps;

  function buildReplyPayload({
    reply,
    responseType = "status",
    intent,
    directorPlan,
    conversationMode,
    worldState,
    stateUpdated = false,
    reason = null
  }) {
    return {
      reply,
      mjResponse: makeMjResponse({
        responseType,
        directAnswer: reply
      }),
      speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
      intent: reason ? { ...intent, type: "system_command", reason } : intent,
      director: directorPlan,
      worldState,
      stateUpdated
    };
  }

  function tryHandle({ message, characterProfile, intent, directorPlan, conversationMode }) {
    const rawMessage = String(message ?? "").trim();
    const lower = rawMessage.toLowerCase();

    if (lower === "/reset") {
      const runtime = getNarrationRuntime();
      const initial = runtime.NarrativeRuntime.createInitialState();
      runtime.StateRepository.save(initial, narrationStatePath);
      const previousWorld = loadNarrativeWorldState();
      const preservedProfile =
        sanitizeCharacterProfile(characterProfile) ??
        sanitizeCharacterProfile(previousWorld?.startContext?.characterSnapshot ?? null);
      const resetWorld = createInitialNarrativeWorldState();
      if (preservedProfile) {
        resetWorld.startContext = {
          ...(resetWorld.startContext ?? {}),
          characterSnapshot: preservedProfile
        };
      }
      saveNarrativeWorldState(resetWorld);
      if (typeof resetNarrativeSessionDb === "function") {
        resetNarrativeSessionDb();
      }
      return buildReplyPayload({
        reply: "État narratif réinitialisé.",
        responseType: "system",
        intent,
        directorPlan,
        conversationMode,
        stateUpdated: true
      });
    }

    if (lower === "/state") {
      const state = loadNarrationRuntimeStateFromDisk();
      if (!state) {
        return buildReplyPayload({
          reply: "Aucun état narratif trouvé.",
          intent,
          directorPlan,
          conversationMode
        });
      }
      const summary = [
        `Quêtes: ${Object.keys(state.quests ?? {}).length}`,
        `Trames: ${Object.keys(state.tramas ?? {}).length}`,
        `Compagnons: ${Object.keys(state.companions ?? {}).length}`,
        `Marchandages: ${Object.keys(state.trades ?? {}).length}`,
        `Historique: ${Array.isArray(state.history) ? state.history.length : 0}`
      ].join(" | ");
      const worldState = loadNarrativeWorldState();
      const worldSummary = [
        `Reputation: ${worldState.metrics?.reputation ?? 0}`,
        `TensionLocale: ${worldState.metrics?.localTension ?? 0}`,
        `Temps: J${worldState?.time?.day ?? 1} ${String(worldState?.time?.hour ?? 15).padStart(2, "0")}:${String(worldState?.time?.minute ?? 0).padStart(2, "0")} (${worldState?.time?.label ?? "inconnu"})`,
        `Lieu: ${worldState?.location?.label ?? worldState?.startContext?.locationLabel ?? "inconnu"}`,
        `ContexteDepart: ${worldState?.startContext?.delivered ? "actif" : "en attente"}`,
        `PJ: ${worldState?.startContext?.characterSnapshot?.name ?? "inconnu"}`,
        `Interlocuteur: ${worldState?.conversation?.activeInterlocutor ?? "aucun"}`,
        `DeplacementEnAttente: ${worldState?.travel?.pending?.to?.label ?? worldState?.conversation?.pendingTravel?.placeLabel ?? "non"}`,
        `AccesEnAttente: ${worldState?.conversation?.pendingAccess?.placeLabel ?? "non"}`,
        `LieuxSession: ${Array.isArray(worldState?.sessionPlaces) ? worldState.sessionPlaces.length : 0}`,
        `DernierDeplacement: ${
          worldState?.travel?.last
            ? `${worldState.travel.last.from?.label ?? "?"} -> ${worldState.travel.last.to?.label ?? "?"} (${worldState.travel.last.durationMin ?? 0} min)`
            : "aucun"
        }`
      ].join(" | ");
      return buildReplyPayload({
        reply: `${summary}\n${worldSummary}`,
        intent,
        directorPlan,
        conversationMode,
        worldState
      });
    }

    if (lower.startsWith("/interlocutor")) {
      const raw = rawMessage.replace(/^\/interlocutor/i, "").trim();
      const nextInterlocutor = sanitizeInterlocutorLabel(raw);
      if (!nextInterlocutor) {
        return buildReplyPayload({
          reply: "Commande invalide. Utilise: /interlocutor <nom> (ex: /interlocutor garde).",
          responseType: "system",
          intent,
          directorPlan,
          conversationMode
        });
      }
      const worldState = applyCriticalMutation(loadNarrativeWorldState(), {
        activeInterlocutor: nextInterlocutor
      });
      saveNarrativeWorldState(worldState);
      return {
        ...buildReplyPayload({
          reply: `Interlocuteur actif défini sur: ${nextInterlocutor}.`,
          responseType: "system",
          intent,
          directorPlan: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "policy" },
          conversationMode,
          worldState,
          reason: "set-interlocutor"
        }),
        stateUpdated: false
      };
    }

    if (lower === "/clear-interlocutor") {
      const worldState = applyCriticalMutation(loadNarrativeWorldState(), {
        activeInterlocutor: null
      });
      saveNarrativeWorldState(worldState);
      return {
        ...buildReplyPayload({
          reply: "Interlocuteur actif effacé.",
          responseType: "system",
          intent,
          directorPlan: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "policy" },
          conversationMode,
          worldState,
          reason: "clear-interlocutor"
        }),
        stateUpdated: false
      };
    }

    return null;
  }

  return {
    tryHandle
  };
}

module.exports = {
  createNarrationSystemCommands
};
