"use strict";

function createNarrationChatHandler(deps = {}) {
  const {
    parseJsonBody,
    sendJson,
    sanitizeCharacterProfile,
    sanitizeConversationMode,
    classifyNarrationIntent,
    buildNarrativeDirectorPlan,
    getNarrationRuntime,
    narrationStatePath,
    createInitialNarrativeWorldState,
    saveNarrativeWorldState,
    makeMjResponse,
    buildSpeakerPayload,
    loadNarrationRuntimeStateFromDisk,
    buildCharacterProfileDiagnostics,
    buildCharacterContextDiagnostics,
    buildCharacterContextPack,
    buildCanonicalContextDiagnostics,
    buildCharacterRulesDiagnostics,
    buildMjContractStatsPayload,
    buildPhase3GuardStatsPayload,
    buildPhase4SessionStatsPayload,
    buildPhase5MutationStatsPayload,
    buildPhase6BackgroundStatsPayload,
    buildPhase7RenderStatsPayload,
    buildPhase8DebugChannelStatsPayload,
    resetNarrativeSessionDb,
    sanitizeInterlocutorLabel,
    loadNarrativeWorldState,
    sanitizePendingAction,
    sanitizePendingTravel,
    sanitizePendingAccess,
    extractInterlocutorFromMessage,
    buildCanonicalNarrativeContext,
    rpActionResolver,
    applyWorldDelta,
    oneLine,
    buildMjReplyBlocks,
    isTravelConfirmation,
    sanitizeTravelState,
    sanitizeWorldLocation,
    applyTravel,
    buildLoreRecordsForQuery,
    derivePlaceMetadataFromRecords,
    upsertSessionPlace,
    sanitizeSessionPlaces,
    buildArrivalPlaceReply,
    extractVisitIntent,
    resolveOrCreateSessionPlace,
    buildVisitAdvisoryReply,
    buildAccessChallengeReply,
    isAccessProgressionIntent,
    resolveAccessAttempt,
    generateMjStructuredReply,
    buildPriorityMjToolCalls,
    mergeToolCalls,
    mjToolBus,
    refineMjStructuredReplyWithTools,
    inferPlaceFromMessage,
    estimateTravelMinutes,
    isRpSheetQuestion,
    buildRpSheetAwareReply,
    rpActionValidator,
    hasRemainingSpellSlotsForRp,
    buildRpActionValidationReply,
    classifyNarrationWithAI,
    detectWorldIntentWithAI,
    validateNarrativeStateConsistency,
    shouldForceSceneLocalRouting,
    addInterlocutorNote,
    buildLoreOnlyReply,
    buildExplorationReply,
    requiresInterlocutorInRp,
    buildRpNeedInterlocutorReply,
    shouldApplyRuntimeForIntent,
    buildDirectorNoRuntimeReply,
    openAiApiKey,
    buildPlayerProfileInput,
    computeWorldDelta,
    computeSceneOnlyDelta,
    injectLockedStartContextReply,
    parseReplyToMjBlocks,
    normalizeMjOptions,
    buildMjReplyFromStructured,
    hrpAiInterpreter,
    buildHrpReply,
    buildNarrationChatReply,
    evaluateTravelProposalLoreGuard,
    getCurrentSessionPlace,
    applyBackgroundNarrativeTick,
    temperNarrativeHype
  } = deps;

  async function handle(req, res) {
    if (req.method === "POST" && req.url === "/api/narration/chat") {
        try {
          const body = await parseJsonBody(req);
          const message = String(body?.message ?? "").trim();
          const characterProfile = sanitizeCharacterProfile(body?.characterProfile ?? null);
          const conversationMode = sanitizeConversationMode(body?.conversationMode);
          if (!message) {
            return sendJson(res, 400, { error: "message manquant" });
          }
          const worldSnapshotForIntent = loadNarrativeWorldState();
          const heuristicIntent = classifyNarrationIntent(message, {
            conversationMode,
            worldState: worldSnapshotForIntent
          });
          let intent = heuristicIntent;
          let directorPlan = buildNarrativeDirectorPlan(intent);
    
          if (message.toLowerCase() === "/reset") {
            const runtime = getNarrationRuntime();
            const initial = runtime.NarrativeRuntime.createInitialState();
            runtime.StateRepository.save(initial, narrationStatePath);
            saveNarrativeWorldState(createInitialNarrativeWorldState());
            if (typeof resetNarrativeSessionDb === "function") {
              resetNarrativeSessionDb();
            }
            return sendJson(res, 200, {
              reply: "État narratif réinitialisé.",
              mjResponse: makeMjResponse({
                responseType: "system",
                directAnswer: "État narratif réinitialisé."
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent,
              director: directorPlan,
              stateUpdated: true
            });
          }
    
          if (message.toLowerCase() === "/state") {
            const state = loadNarrationRuntimeStateFromDisk();
            if (!state) {
              return sendJson(res, 200, {
                reply: "Aucun état narratif trouvé.",
                mjResponse: makeMjResponse({
                  responseType: "status",
                  directAnswer: "Aucun état narratif trouvé."
                }),
                speaker: buildSpeakerPayload({ conversationMode, forceSystem: true })
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
            return sendJson(res, 200, {
              reply: `${summary}\n${worldSummary}`,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: `${summary}\n${worldSummary}`
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent,
              director: directorPlan,
              worldState
            });
          }
    
          if (message.toLowerCase() === "/profile-debug") {
            const worldState = loadNarrativeWorldState();
            const profileDiag = buildCharacterProfileDiagnostics(characterProfile, worldState);
            return sendJson(res, 200, {
              reply: profileDiag,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: profileDiag
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "profile-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              stateUpdated: false
            });
          }
    
          if (message.toLowerCase() === "/context-debug") {
            const worldState = loadNarrativeWorldState();
            const contextDiag = buildCharacterContextDiagnostics(characterProfile, worldState);
            const contextPack = buildCharacterContextPack(characterProfile, worldState);
            const canonicalDiag = buildCanonicalContextDiagnostics(characterProfile, worldState, contextPack);
            return sendJson(res, 200, {
              reply: `${contextDiag}\n\n${canonicalDiag}`,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: `${contextDiag}\n\n${canonicalDiag}`
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "context-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              stateUpdated: false
            });
          }
    
          if (message.toLowerCase() === "/rules-debug") {
            const worldState = loadNarrativeWorldState();
            const rulesDiag = buildCharacterRulesDiagnostics(characterProfile, worldState);
            return sendJson(res, 200, {
              reply: rulesDiag,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: rulesDiag
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "rules-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              stateUpdated: false
            });
          }
    
          if (message.toLowerCase() === "/contract-debug") {
            const worldState = loadNarrativeWorldState();
            const stats = buildMjContractStatsPayload();
            const sourceParts = Object.entries(stats.bySource)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .map(([source, count]) => `${source}: ${count}`)
              .join(" | ");
            const summary = `Contrats MJ observes: ${stats.total} | Sources: ${sourceParts || "aucune"}`;
            return sendJson(res, 200, {
              reply: summary,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: summary
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "contract-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              contractStats: stats,
              stateUpdated: false
            });
          }
    
          if (message.toLowerCase() === "/phase1-debug") {
            const worldState = loadNarrativeWorldState();
            const stats = buildMjContractStatsPayload();
            const sourceParts = Object.entries(stats.bySource)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .map(([source, count]) => `${source}: ${count}`)
              .join(" | ");
            const grounding = stats.grounding ?? {};
            const summary = [
              `Phase1 DoD (tool-grounding)`,
              `NarrativeTurns: ${grounding.narrativeTurns ?? 0}`,
              `GroundedTurns: ${grounding.groundedTurns ?? 0}`,
              `UngroundedTurns: ${grounding.ungroundedTurns ?? 0}`,
              `GroundingRate: ${grounding.groundingRatePct ?? 0}%`,
              `ContractSources: ${sourceParts || "aucune"}`
            ].join(" | ");
            return sendJson(res, 200, {
              reply: summary,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: summary
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "phase1-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              phase1: {
                dod: {
                  toolGroundingVisible: true,
                  narrativeTurns: grounding.narrativeTurns ?? 0,
                  groundedTurns: grounding.groundedTurns ?? 0,
                  ungroundedTurns: grounding.ungroundedTurns ?? 0,
                  groundingRatePct: grounding.groundingRatePct ?? 0
                },
                byIntent: grounding.byIntent ?? {},
                recentGrounding: Array.isArray(grounding.recent) ? grounding.recent : []
              },
              stateUpdated: false
            });
          }
    
          if (message.toLowerCase() === "/phase2-debug") {
            const worldState = loadNarrativeWorldState();
            const stats = buildMjContractStatsPayload();
            const sourceParts = Object.entries(stats.bySource)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .map(([source, count]) => `${source}: ${count}`)
              .join(" | ");
            const phase2 = stats.phase2 ?? {};
            const summary = [
              `Phase2 DoD (canonical context)`,
              `NarrativeTurns: ${phase2.narrativeTurns ?? 0}`,
              `CanonicalReads(get_world_state): ${phase2.canonicalReads ?? 0}`,
              `NoCanonicalReads: ${phase2.noCanonicalReads ?? 0}`,
              `CanonicalReadRate: ${phase2.canonicalReadRatePct ?? 0}%`,
              `ContractSources: ${sourceParts || "aucune"}`
            ].join(" | ");
            return sendJson(res, 200, {
              reply: summary,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: summary
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "phase2-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              phase2: {
                dod: {
                  canonicalContextReadVisible: true,
                  narrativeTurns: phase2.narrativeTurns ?? 0,
                  canonicalReads: phase2.canonicalReads ?? 0,
                  noCanonicalReads: phase2.noCanonicalReads ?? 0,
                  canonicalReadRatePct: phase2.canonicalReadRatePct ?? 0
                },
                byIntentCanonicalReads: phase2.byIntentCanonicalReads ?? {},
                recentCanonical: Array.isArray(phase2.recentCanonical) ? phase2.recentCanonical : []
              },
              stateUpdated: false
            });
          }
    
          if (message.toLowerCase() === "/phase3-debug") {
            const worldState = loadNarrativeWorldState();
            const phase3 = buildPhase3GuardStatsPayload();
            const summary = [
              `Phase3 DoD (lore guards)`,
              `CheckedTurns: ${phase3.checkedTurns ?? 0}`,
              `BlockedTurns: ${phase3.blockedTurns ?? 0}`,
              `PassTurns: ${phase3.passTurns ?? 0}`,
              `BlockRate: ${phase3.blockRatePct ?? 0}%`
            ].join(" | ");
            return sendJson(res, 200, {
              reply: summary,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: summary
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "phase3-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              phase3: {
                dod: {
                  loreGuardsEnabled: true,
                  checkedTurns: phase3.checkedTurns ?? 0,
                  blockedTurns: phase3.blockedTurns ?? 0,
                  passTurns: phase3.passTurns ?? 0,
                  blockRatePct: phase3.blockRatePct ?? 0
                },
                byGate: phase3.byGate ?? {},
                byCode: phase3.byCode ?? {},
                recent: Array.isArray(phase3.recent) ? phase3.recent : []
              },
              stateUpdated: false
            });
          }

          if (message.toLowerCase() === "/phase4-debug") {
            const worldState = loadNarrativeWorldState();
            const phase4 =
              typeof buildPhase4SessionStatsPayload === "function"
                ? buildPhase4SessionStatsPayload()
                : { counts: {}, recent: [] };
            const counts = phase4?.counts ?? {};
            const summary = [
              "Phase4 DoD (session DB narrative)",
              `placesDiscovered: ${Number(counts.placesDiscovered ?? 0)}`,
              `sessionNpcs: ${Number(counts.sessionNpcs ?? 0)}`,
              `establishedFacts: ${Number(counts.establishedFacts ?? 0)}`,
              `rumors: ${Number(counts.rumors ?? 0)}`,
              `debtsPromises: ${Number(counts.debtsPromises ?? 0)}`
            ].join(" | ");
            return sendJson(res, 200, {
              reply: summary,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: summary
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "phase4-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              phase4: {
                dod: {
                  sessionDbEnabled: true,
                  placesDiscovered: Number(counts.placesDiscovered ?? 0),
                  sessionNpcs: Number(counts.sessionNpcs ?? 0),
                  establishedFacts: Number(counts.establishedFacts ?? 0),
                  rumors: Number(counts.rumors ?? 0),
                  debtsPromises: Number(counts.debtsPromises ?? 0)
                },
                updatedAt: String(phase4?.updatedAt ?? ""),
                recent: Array.isArray(phase4?.recent) ? phase4.recent : []
              },
              stateUpdated: false
            });
          }

          if (message.toLowerCase() === "/phase5-debug") {
            const worldState = loadNarrativeWorldState();
            const phase5 =
              typeof buildPhase5MutationStatsPayload === "function"
                ? buildPhase5MutationStatsPayload()
                : { turns: 0, mutatedTurns: 0, noMutationTurns: 0, mutationRatePct: 0, byIntent: {}, byMutationKind: {}, recent: [] };
            const summary = [
              "Phase5 DoD (intentions -> mutations)",
              `Turns: ${Number(phase5.turns ?? 0)}`,
              `MutatedTurns: ${Number(phase5.mutatedTurns ?? 0)}`,
              `NoMutationTurns: ${Number(phase5.noMutationTurns ?? 0)}`,
              `MutationRate: ${Number(phase5.mutationRatePct ?? 0)}%`
            ].join(" | ");
            return sendJson(res, 200, {
              reply: summary,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: summary
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "phase5-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              phase5: {
                dod: {
                  mutationEngineEnabled: true,
                  turns: Number(phase5.turns ?? 0),
                  mutatedTurns: Number(phase5.mutatedTurns ?? 0),
                  noMutationTurns: Number(phase5.noMutationTurns ?? 0),
                  mutationRatePct: Number(phase5.mutationRatePct ?? 0)
                },
                byIntent: phase5.byIntent ?? {},
                byMutationKind: phase5.byMutationKind ?? {},
                recent: Array.isArray(phase5.recent) ? phase5.recent : []
              },
              stateUpdated: false
            });
          }

          if (message.toLowerCase() === "/phase6-debug") {
            const worldState = loadNarrativeWorldState();
            const phase6 =
              typeof buildPhase6BackgroundStatsPayload === "function"
                ? buildPhase6BackgroundStatsPayload()
                : {
                    turns: 0,
                    eligibleTurns: 0,
                    appliedTicks: 0,
                    skippedTicks: 0,
                    eligibleRatePct: 0,
                    applyRatePct: 0,
                    skippedByReason: {},
                    byTransition: {},
                    recent: []
                  };
            const summary = [
              "Phase6 DoD (background tick)",
              `Turns: ${Number(phase6.turns ?? 0)}`,
              `EligibleTurns: ${Number(phase6.eligibleTurns ?? 0)}`,
              `AppliedTicks: ${Number(phase6.appliedTicks ?? 0)}`,
              `ApplyRate: ${Number(phase6.applyRatePct ?? 0)}%`
            ].join(" | ");
            return sendJson(res, 200, {
              reply: summary,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: summary
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "phase6-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              phase6: {
                dod: {
                  backgroundTickEnabled: true,
                  turns: Number(phase6.turns ?? 0),
                  eligibleTurns: Number(phase6.eligibleTurns ?? 0),
                  appliedTicks: Number(phase6.appliedTicks ?? 0),
                  skippedTicks: Number(phase6.skippedTicks ?? 0),
                  eligibleRatePct: Number(phase6.eligibleRatePct ?? 0),
                  applyRatePct: Number(phase6.applyRatePct ?? 0)
                },
                skippedByReason: phase6.skippedByReason ?? {},
                byTransition: phase6.byTransition ?? {},
                recent: Array.isArray(phase6.recent) ? phase6.recent : []
              },
              stateUpdated: false
            });
          }

          if (message.toLowerCase() === "/phase7-debug") {
            const worldState = loadNarrativeWorldState();
            const phase7 =
              typeof buildPhase7RenderStatsPayload === "function"
                ? buildPhase7RenderStatsPayload()
                : { totalReplies: 0, repliesWithOptions: 0, repliesWithoutOptions: 0, optionsSuppressed: 0, optionsRatePct: 0, recent: [] };
            const summary = [
              "Phase7 DoD (rendu MJ naturel)",
              `Replies: ${Number(phase7.totalReplies ?? 0)}`,
              `WithOptions: ${Number(phase7.repliesWithOptions ?? 0)}`,
              `WithoutOptions: ${Number(phase7.repliesWithoutOptions ?? 0)}`,
              `OptionsRate: ${Number(phase7.optionsRatePct ?? 0)}%`
            ].join(" | ");
            return sendJson(res, 200, {
              reply: summary,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: summary
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "phase7-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              phase7: {
                dod: {
                  naturalRenderEnabled: true,
                  totalReplies: Number(phase7.totalReplies ?? 0),
                  repliesWithOptions: Number(phase7.repliesWithOptions ?? 0),
                  repliesWithoutOptions: Number(phase7.repliesWithoutOptions ?? 0),
                  optionsSuppressed: Number(phase7.optionsSuppressed ?? 0),
                  optionsRatePct: Number(phase7.optionsRatePct ?? 0)
                },
                recent: Array.isArray(phase7.recent) ? phase7.recent : []
              },
              stateUpdated: false
            });
          }

          if (message.toLowerCase() === "/phase8-debug") {
            const worldState = loadNarrativeWorldState();
            const phase8 =
              typeof buildPhase8DebugChannelStatsPayload === "function"
                ? buildPhase8DebugChannelStatsPayload()
                : {
                    totalPayloads: 0,
                    withDebugChannel: 0,
                    withoutDebugChannel: 0,
                    debugCoveragePct: 0,
                    byReason: {},
                    recent: []
                  };
            const summary = [
              "Phase8 DoD (debug separe)",
              `Payloads: ${Number(phase8.totalPayloads ?? 0)}`,
              `WithDebugChannel: ${Number(phase8.withDebugChannel ?? 0)}`,
              `WithoutDebugChannel: ${Number(phase8.withoutDebugChannel ?? 0)}`,
              `DebugCoverage: ${Number(phase8.debugCoveragePct ?? 0)}%`
            ].join(" | ");
            return sendJson(res, 200, {
              reply: summary,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: summary
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "phase8-debug" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
              worldState,
              phase8: {
                dod: {
                  debugChannelSeparated: true,
                  totalPayloads: Number(phase8.totalPayloads ?? 0),
                  withDebugChannel: Number(phase8.withDebugChannel ?? 0),
                  withoutDebugChannel: Number(phase8.withoutDebugChannel ?? 0),
                  debugCoveragePct: Number(phase8.debugCoveragePct ?? 0)
                },
                byReason: phase8.byReason ?? {},
                recent: Array.isArray(phase8.recent) ? phase8.recent : []
              },
              stateUpdated: false
            });
          }
    
          if (message.toLowerCase().startsWith("/interlocutor")) {
            const raw = message.replace(/^\/interlocutor/i, "").trim();
            const nextInterlocutor = sanitizeInterlocutorLabel(raw);
            if (!nextInterlocutor) {
              return sendJson(res, 200, {
                reply:
                  "Commande invalide. Utilise: /interlocutor <nom> (ex: /interlocutor garde).",
                mjResponse: makeMjResponse({
                  responseType: "system",
                  directAnswer: "Commande invalide. Utilise: /interlocutor <nom> (ex: /interlocutor garde)."
                }),
                speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
                intent,
                director: directorPlan,
                stateUpdated: false
              });
            }
            const worldState = loadNarrativeWorldState();
            worldState.conversation = {
              ...(worldState.conversation ?? {}),
              activeInterlocutor: nextInterlocutor
            };
            saveNarrativeWorldState(worldState);
            return sendJson(res, 200, {
              reply: `Interlocuteur actif défini sur: ${nextInterlocutor}.`,
              mjResponse: makeMjResponse({
                responseType: "system",
                directAnswer: `Interlocuteur actif défini sur: ${nextInterlocutor}.`
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "set-interlocutor" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "policy" },
              worldState,
              stateUpdated: false
            });
          }
    
          if (message.toLowerCase() === "/clear-interlocutor") {
            const worldState = loadNarrativeWorldState();
            worldState.conversation = {
              ...(worldState.conversation ?? {}),
              activeInterlocutor: null
            };
            saveNarrativeWorldState(worldState);
            return sendJson(res, 200, {
              reply: "Interlocuteur actif effacé.",
              mjResponse: makeMjResponse({
                responseType: "system",
                directAnswer: "Interlocuteur actif effacé."
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: { ...intent, type: "system_command", reason: "clear-interlocutor" },
              director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "policy" },
              worldState,
              stateUpdated: false
            });
          }
    
          const runtime = getNarrationRuntime();
          const api = runtime.GameNarrationAPI.createDefault(narrationStatePath);
          const state = api.getState();
          const records = buildLoreRecordsForQuery(message);
          async function persistNarrativeWorldStateWithPhase6(worldState, options = {}) {
            const safeWorldState = worldState && typeof worldState === "object" ? worldState : null;
            const runtimeAlreadyApplied = Boolean(options.runtimeAlreadyApplied);
            const source = String(options.source ?? "narration");
            if (safeWorldState && typeof applyBackgroundNarrativeTick === "function") {
              await applyBackgroundNarrativeTick({
                runtime,
                api,
                state,
                message,
                records,
                conversationMode,
                intentType: String(intent?.type ?? "story_action"),
                directorMode: String(directorPlan?.mode ?? "scene_only"),
                runtimeAlreadyApplied,
                source
              });
            }
            saveNarrativeWorldState(safeWorldState ?? worldState);
          }
          async function buildAiNarrativeReplyForBranch(params = {}) {
            const safeWorldState =
              params.worldState && typeof params.worldState === "object" ? params.worldState : null;
            const fallbackReply = String(params.fallbackReply ?? "").trim();
            const branchMessage = String(params.branchMessage ?? message);
            const branchRecords = Array.isArray(params.recordsOverride) ? params.recordsOverride : records;
            const narrativeStage = String(params.narrativeStage ?? "scene");
            const stateUpdatedExpected = Boolean(params.stateUpdatedExpected);
            const worldBefore =
              params.worldBefore && typeof params.worldBefore === "object" ? params.worldBefore : null;
            if (conversationMode !== "rp" || !safeWorldState) {
              return { reply: fallbackReply, mjStructured: null, mjToolTrace: [] };
            }
            const canonicalForBranch = buildCanonicalNarrativeContext({
              worldState: safeWorldState,
              contextPack: rpContextPack,
              characterProfile
            });
            const draft = await generateMjStructuredReply({
              message: branchMessage,
              records: branchRecords,
              worldState: safeWorldState,
              canonicalContext: canonicalForBranch,
              contextPack: rpContextPack,
              activeInterlocutor,
              conversationMode,
              narrativeStage,
              pending: {
                action: safeWorldState?.conversation?.pendingAction ?? null,
                travel: safeWorldState?.travel?.pending ?? safeWorldState?.conversation?.pendingTravel ?? null,
                access: safeWorldState?.conversation?.pendingAccess ?? null
              }
            });
            const planned = mergeToolCalls(
              Array.isArray(draft?.toolCalls) ? draft.toolCalls : [],
              Array.isArray(params.priorityToolCalls) ? params.priorityToolCalls : [],
              6
            );
            const mjToolTrace = mjToolBus.executeToolCalls(planned, {
              message: branchMessage,
              records: branchRecords,
              worldState: safeWorldState,
              canonicalContext: canonicalForBranch,
              contextPack: rpContextPack,
              runtimeState: state,
              pending: {
                action: safeWorldState?.conversation?.pendingAction ?? null,
                travel: safeWorldState?.travel?.pending ?? safeWorldState?.conversation?.pendingTravel ?? null,
                access: safeWorldState?.conversation?.pendingAccess ?? null
              }
            });
            const refined = await refineMjStructuredReplyWithTools({
              message: branchMessage,
              initialStructured: draft,
              toolResults: mjToolTrace,
              worldState: safeWorldState,
              canonicalContext: canonicalForBranch,
              contextPack: rpContextPack,
              activeInterlocutor,
              conversationMode,
              narrativeStage
            });
            const tempered =
              typeof temperNarrativeHype === "function"
                ? temperNarrativeHype({
                    structured: refined,
                    intent,
                    directorMode: String(directorPlan?.mode ?? ""),
                    toolTrace: mjToolTrace,
                    worldState: safeWorldState,
                    message: branchMessage
                  })
                : refined;
            if (!tempered) {
              return { reply: fallbackReply, mjStructured: null, mjToolTrace };
            }
            const direct = oneLine(String(tempered?.directAnswer ?? ""), 220);
            const blocks = buildMjReplyBlocks({
              scene: String(tempered?.scene ?? ""),
              actionResult: String(tempered?.actionResult ?? ""),
              consequences: String(tempered?.consequences ?? ""),
              options: normalizeMjOptions(tempered?.options, 6)
            });
            const composedReply = direct ? `${direct}\n${blocks}` : blocks;
            if (typeof validateNarrativeStateConsistency === "function") {
              const check = await validateNarrativeStateConsistency({
                narrativeStage,
                text: composedReply,
                stateUpdatedExpected,
                worldBefore,
                worldAfter: safeWorldState,
                conversationMode
              });
              if (check && check.valid === false) {
                return {
                  reply: fallbackReply,
                  mjStructured: null,
                  mjToolTrace
                };
              }
            }
            return {
              reply: composedReply,
              mjStructured: tempered,
              mjToolTrace
            };
          }
          const worldSnapshot = loadNarrativeWorldState();
          worldSnapshot.conversation = {
            ...(worldSnapshot.conversation ?? {}),
            activeInterlocutor:
              worldSnapshot?.conversation?.activeInterlocutor == null
                ? null
                : String(worldSnapshot.conversation.activeInterlocutor),
            pendingAction: sanitizePendingAction(worldSnapshot?.conversation?.pendingAction),
            pendingTravel: sanitizePendingTravel(worldSnapshot?.conversation?.pendingTravel),
            pendingAccess: sanitizePendingAccess(worldSnapshot?.conversation?.pendingAccess)
          };
          if (conversationMode === "rp") {
            const detectedInterlocutor = extractInterlocutorFromMessage(message);
            if (detectedInterlocutor) {
              worldSnapshot.conversation.activeInterlocutor = detectedInterlocutor;
            }
          }
          const activeInterlocutor =
            worldSnapshot?.conversation?.activeInterlocutor == null
              ? null
              : String(worldSnapshot.conversation.activeInterlocutor);
          if (characterProfile) {
            worldSnapshot.startContext = {
              ...(worldSnapshot.startContext ?? {}),
              characterSnapshot: characterProfile,
              delivered: Boolean(worldSnapshot?.startContext?.delivered)
            };
          }
    
          const rpContextPack =
            conversationMode === "rp" ? buildCharacterContextPack(characterProfile, worldSnapshot) : null;
          const canonicalContext = buildCanonicalNarrativeContext({
            worldState: worldSnapshot,
            contextPack: rpContextPack,
            characterProfile
          });
          let semanticWorldIntent = null;
    
          if (
            conversationMode === "rp" &&
            rpContextPack &&
            worldSnapshot?.conversation?.pendingAction &&
            rpActionResolver.isConfirmationMessage(message)
          ) {
            const resolution = rpActionResolver.resolvePendingAction(
              message,
              worldSnapshot.conversation.pendingAction,
              rpContextPack,
              worldSnapshot
            );
            if (resolution) {
              const worldDelta = resolution.success
                ? { reputationDelta: 0, localTensionDelta: 1, reason: "rp-action-resolved" }
                : { reputationDelta: 0, localTensionDelta: 0, reason: "rp-action-failed" };
              const worldState = applyWorldDelta(worldSnapshot, worldDelta, {
                intentType: "story_action",
                transitionId: `rp:${resolution.actionType}`
              });
              worldState.rpRuntime = {
                ...(worldState.rpRuntime ?? {}),
                ...(resolution.nextRuntime ?? {}),
                lastResolution: {
                  at: new Date().toISOString(),
                  actionType: String(resolution.actionType ?? "generic_action"),
                  targetId: String(resolution.targetId ?? ""),
                  success: Boolean(resolution.success),
                  summary: oneLine(String(resolution.actionResult ?? ""), 160)
                }
              };
              worldState.conversation = {
                ...(worldState.conversation ?? {}),
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: null
              };
              if (characterProfile) {
                worldState.startContext = {
                  ...(worldState.startContext ?? {}),
                  characterSnapshot: characterProfile
                };
              }
              await persistNarrativeWorldStateWithPhase6(worldState, {
                runtimeAlreadyApplied: false,
                source: "rp-action-resolved"
              });
              return sendJson(res, 200, {
                reply: buildMjReplyBlocks({
                  scene: resolution.scene,
                  actionResult: resolution.actionResult,
                  consequences: resolution.consequences,
                  options: resolution.options
                }),
                mjResponse: makeMjResponse({
                  responseType: "resolution",
                  scene: resolution.scene,
                  actionResult: resolution.actionResult,
                  consequences: resolution.consequences,
                  options: resolution.options
                }),
                speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
                intent: {
                  type: "story_action",
                  confidence: 0.9,
                  reason: `rp-action-resolve:${resolution.actionType}`
                },
                director: { mode: "scene_only", applyRuntime: false, source: "resolver" },
                rpActionResolution: resolution,
                worldDelta,
                worldState,
                stateUpdated: true
              });
            }
          }
    
          if (
            conversationMode === "rp" &&
            (worldSnapshot?.conversation?.pendingTravel || worldSnapshot?.travel?.pending) &&
            isTravelConfirmation(message)
          ) {
            const pendingTravelLegacy = sanitizePendingTravel(worldSnapshot?.conversation?.pendingTravel);
            const pendingTravelCanonical = sanitizeTravelState(worldSnapshot?.travel).pending;
            const pendingTravel = pendingTravelCanonical
              ? {
                  placeId: pendingTravelCanonical.to.id,
                  placeLabel: pendingTravelCanonical.to.label,
                  durationMin: pendingTravelCanonical.durationMin
                }
              : pendingTravelLegacy
                ? { placeId: pendingTravelLegacy.placeId, placeLabel: pendingTravelLegacy.placeLabel, durationMin: 3 }
                : null;
            if (pendingTravel && pendingTravel.placeLabel) {
              const currentWorld = loadNarrativeWorldState();
              let worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "travel-confirmed" },
                { intentType: "system_command", transitionId: "travel.confirmed" }
              );
              const place = {
                id: pendingTravel.placeId,
                label: pendingTravel.placeLabel
              };
              const fromLocation = sanitizeWorldLocation(worldState?.location);
              const durationMin = Math.max(1, Math.floor(Number(pendingTravel.durationMin) || 3));
              worldState = applyTravel(worldState, {
                from: fromLocation,
                to: { id: place.id, label: place.label },
                durationMin,
                reason: "travel-confirmed"
              });
              const arrivalRecords = buildLoreRecordsForQuery(place.label);
              const arrivalMetadata = derivePlaceMetadataFromRecords(place.label, arrivalRecords);
              worldState.sessionPlaces = upsertSessionPlace(worldState?.sessionPlaces, {
                id: place.id,
                label: place.label,
                city: "",
                access: arrivalMetadata.access,
                tags: arrivalMetadata.tags,
                riskFlags: arrivalMetadata.riskFlags,
                sources: arrivalMetadata.sources,
                summary: arrivalMetadata.summary
              });
              const resolvedArrivalPlace =
                sanitizeSessionPlaces(worldState?.sessionPlaces).find((entry) => entry.id === place.id) ?? {
                  ...place,
                  access: arrivalMetadata.access,
                  riskFlags: arrivalMetadata.riskFlags,
                  tags: arrivalMetadata.tags,
                  summary: arrivalMetadata.summary
                };
              worldState.conversation = {
                ...(worldState.conversation ?? {}),
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: null,
                pendingTravel: null,
                pendingAccess: null
              };
              if (characterProfile) {
                worldState.startContext = {
                  ...(worldState.startContext ?? {}),
                  characterSnapshot: characterProfile
                };
              }
              const fallbackArrivalReply = buildArrivalPlaceReply(
                resolvedArrivalPlace,
                arrivalRecords,
                worldState
              );
              const aiArrival = await buildAiNarrativeReplyForBranch({
                worldState,
                fallbackReply: fallbackArrivalReply,
                branchMessage: `arrivee a ${place.label}`,
                narrativeStage: "travel_confirmed",
                stateUpdatedExpected: true,
                worldBefore: worldSnapshot,
                recordsOverride: arrivalRecords,
                priorityToolCalls: [
                  { name: "get_world_state", args: {} },
                  { name: "session_db_read", args: { scope: "scene-memory" } },
                  { name: "query_lore", args: { query: place.label, limit: 5 } }
                ]
              });
              const injected = injectLockedStartContextReply(
                aiArrival.reply || fallbackArrivalReply,
                worldState,
                characterProfile
              );
              const arrivalReplyParts = parseReplyToMjBlocks(injected.reply);
              await persistNarrativeWorldStateWithPhase6(injected.worldState, {
                runtimeAlreadyApplied: false,
                source: "travel-confirmed-ai"
              });
              return sendJson(res, 200, {
                reply: injected.reply,
                mjResponse: makeMjResponse({
                  responseType: "narration",
                  scene: arrivalReplyParts.scene,
                  actionResult: arrivalReplyParts.actionResult,
                  consequences: arrivalReplyParts.consequences,
                  options: arrivalReplyParts.options
                }),
                speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
                intent: { type: "story_action", confidence: 0.9, reason: "travel-confirmed" },
                director: { mode: "scene_only", applyRuntime: false, source: "travel-flow" },
                worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "travel-confirmed" },
                worldState: injected.worldState,
                mjStructured: aiArrival.mjStructured,
                mjToolTrace: aiArrival.mjToolTrace,
                stateUpdated: true
              });
            }
          }
    
          if (conversationMode === "rp") {
            if (semanticWorldIntent === null && typeof detectWorldIntentWithAI === "function") {
              semanticWorldIntent = await detectWorldIntentWithAI({
                message,
                worldState: worldSnapshot,
                records,
                conversationMode
              });
              const minConfidence = Math.max(
                0,
                Math.min(1, Number(process.env.NARRATION_WORLD_INTENT_MIN_CONFIDENCE ?? 0.72))
              );
              if (
                semanticWorldIntent &&
                String(semanticWorldIntent.type ?? "none") !== "none" &&
                Number(semanticWorldIntent.confidence ?? 0) < minConfidence
              ) {
                semanticWorldIntent = {
                  type: "none",
                  targetLabel: "",
                  reason: "world-intent-low-confidence",
                  confidence: Number(semanticWorldIntent.confidence ?? 0)
                };
              }
            }
            const visitIntentFromAi =
              semanticWorldIntent?.type === "propose_travel"
                ? {
                    type: "visit_semantic",
                    placeLabel:
                      String(semanticWorldIntent?.targetLabel ?? "").trim() ||
                      inferPlaceFromMessage(message, records) ||
                      "ce lieu"
                  }
                : null;
            const visitIntent =
              visitIntentFromAi ||
              (semanticWorldIntent == null ? extractVisitIntent(message, records) : null);
            if (visitIntent) {
              const currentWorld = loadNarrativeWorldState();
              const worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed" },
                { intentType: "system_command", transitionId: "travel.proposed" }
              );
              const place = resolveOrCreateSessionPlace(visitIntent.placeLabel, records, worldState);
              const fromLocation = sanitizeWorldLocation(worldState?.location);
              const toLocation = { id: place.id, label: place.label };
              const durationMin = estimateTravelMinutes(fromLocation, toLocation, "free_exploration");
              worldState.conversation = {
                ...(worldState.conversation ?? {}),
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: null,
                pendingTravel: sanitizePendingTravel({
                  placeId: place.id,
                  placeLabel: place.label,
                  question: oneLine(message, 140),
                  sourceLoreIds: records.slice(0, 3).map((entry) => String(entry?.id ?? "")).filter(Boolean),
                  createdAt: new Date().toISOString()
                }),
                pendingAccess: null
              };
              worldState.travel = sanitizeTravelState({
                ...(worldState.travel ?? {}),
                pending: {
                  from: fromLocation,
                  to: toLocation,
                  durationMin,
                  reason: "travel-proposed",
                  startedAt: new Date().toISOString()
                }
              });
              worldState.sessionPlaces = upsertSessionPlace(worldState?.sessionPlaces, {
                id: place.id,
                label: place.label,
                city: place.city ?? "",
                access: place.access ?? "public",
                tags: Array.isArray(place.tags) ? place.tags : [],
                riskFlags: Array.isArray(place.riskFlags) ? place.riskFlags : [],
                sources: Array.isArray(place.sources) ? place.sources : [],
                summary: place.summary ?? ""
              });
              if (characterProfile) {
                worldState.startContext = {
                  ...(worldState.startContext ?? {}),
                  characterSnapshot: characterProfile
                };
              }
              const fallbackVisitReply = buildVisitAdvisoryReply(place, records, worldState);
              const aiVisit = await buildAiNarrativeReplyForBranch({
                worldState,
                fallbackReply: fallbackVisitReply,
                branchMessage: `deplacement vers ${place.label}`,
                narrativeStage: "travel_proposal",
                stateUpdatedExpected: false,
                worldBefore: worldSnapshot,
                recordsOverride: buildLoreRecordsForQuery(place.label),
                priorityToolCalls: [
                  { name: "get_world_state", args: {} },
                  { name: "session_db_read", args: { scope: "scene-memory" } },
                  { name: "query_lore", args: { query: place.label, limit: 5 } }
                ]
              });
              const injected = injectLockedStartContextReply(
                aiVisit.reply || fallbackVisitReply,
                worldState,
                characterProfile
              );
              const advisoryParts = parseReplyToMjBlocks(injected.reply);
              await persistNarrativeWorldStateWithPhase6(injected.worldState, {
                runtimeAlreadyApplied: false,
                source: "travel-proposed-ai"
              });
              return sendJson(res, 200, {
                reply: injected.reply,
                mjResponse: makeMjResponse({
                  responseType: "clarification",
                  scene: advisoryParts.scene,
                  actionResult: advisoryParts.actionResult,
                  consequences: advisoryParts.consequences,
                  options: advisoryParts.options
                }),
                speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
                intent: { type: "story_action", confidence: 0.86, reason: "travel-proposed" },
                director: { mode: "scene_only", applyRuntime: false, source: "travel-flow" },
                worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed" },
                worldState: injected.worldState,
                mjStructured: aiVisit.mjStructured,
                mjToolTrace: aiVisit.mjToolTrace,
                stateUpdated: false
              });
            }
          }
    
          if (
            conversationMode === "rp" &&
            worldSnapshot?.conversation?.pendingAccess &&
            (rpActionResolver.isConfirmationMessage(message) || isAccessProgressionIntent(message))
          ) {
            const pendingAccess = sanitizePendingAccess(worldSnapshot.conversation.pendingAccess);
            if (pendingAccess) {
              const currentWorld = loadNarrativeWorldState();
              const accessOutcome = resolveAccessAttempt(message, pendingAccess, rpContextPack, currentWorld);
              const worldState = applyWorldDelta(
                currentWorld,
                accessOutcome.worldDelta,
                { intentType: "story_action", transitionId: accessOutcome.success ? "access.resolved" : "access.blocked" }
              );
              worldState.conversation = {
                ...(worldState.conversation ?? {}),
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: null,
                pendingTravel: null,
                pendingAccess: accessOutcome.success
                  ? null
                  : sanitizePendingAccess({
                      ...pendingAccess,
                      prompt: oneLine(message, 140),
                      createdAt: new Date().toISOString()
                    })
              };
              if (characterProfile) {
                worldState.startContext = {
                  ...(worldState.startContext ?? {}),
                  characterSnapshot: characterProfile
                };
              }
              const injected = injectLockedStartContextReply(accessOutcome.reply, worldState, characterProfile);
              const accessParts = parseReplyToMjBlocks(injected.reply);
              await persistNarrativeWorldStateWithPhase6(injected.worldState, {
                runtimeAlreadyApplied: false,
                source: "access-resolution"
              });
              return sendJson(res, 200, {
                reply: injected.reply,
                mjResponse: makeMjResponse({
                  responseType: "resolution",
                  scene: accessParts.scene,
                  actionResult: accessParts.actionResult,
                  consequences: accessParts.consequences,
                  options: accessParts.options
                }),
                speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
                intent: { type: "story_action", confidence: 0.87, reason: "access-resolution" },
                director: { mode: "scene_only", applyRuntime: false, source: "access-loop" },
                worldDelta: accessOutcome.worldDelta,
                worldState: injected.worldState,
                stateUpdated: true
              });
            }
          }
    
          if (conversationMode === "rp") {
            const currentPlace = getCurrentSessionPlace(worldSnapshot);
            const requiresGate = currentPlace?.access === "restricted" || currentPlace?.access === "sealed";
            if (requiresGate && isAccessProgressionIntent(message)) {
              const currentWorld = loadNarrativeWorldState();
              const worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "access-gate-proposed" },
                { intentType: "story_action", transitionId: "access.proposed" }
              );
              worldState.conversation = {
                ...(worldState.conversation ?? {}),
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: null,
                pendingTravel: null,
                pendingAccess: sanitizePendingAccess({
                  placeId: currentPlace.id,
                  placeLabel: currentPlace.label,
                  access: currentPlace.access,
                  riskFlags: currentPlace.riskFlags,
                  prompt: oneLine(message, 140),
                  reason: "access-gate",
                  createdAt: new Date().toISOString()
                })
              };
              if (characterProfile) {
                worldState.startContext = {
                  ...(worldState.startContext ?? {}),
                  characterSnapshot: characterProfile
                };
              }
              const injected = injectLockedStartContextReply(
                buildAccessChallengeReply(currentPlace, message, rpContextPack, worldState),
                worldState,
                characterProfile
              );
              const accessChallengeParts = parseReplyToMjBlocks(injected.reply);
              await persistNarrativeWorldStateWithPhase6(injected.worldState, {
                runtimeAlreadyApplied: false,
                source: "access-gate-proposed"
              });
              return sendJson(res, 200, {
                reply: injected.reply,
                mjResponse: makeMjResponse({
                  responseType: "clarification",
                  scene: accessChallengeParts.scene,
                  actionResult: accessChallengeParts.actionResult,
                  consequences: accessChallengeParts.consequences,
                  options: accessChallengeParts.options
                }),
                speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
                intent: { type: "story_action", confidence: 0.83, reason: "access-gate-proposed" },
                director: { mode: "scene_only", applyRuntime: false, source: "access-loop" },
                worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "access-gate-proposed" },
                worldState: injected.worldState,
                stateUpdated: false
              });
            }
          }
    
          if (conversationMode === "rp") {
            const mjStructuredDraft = await generateMjStructuredReply({
              message,
              records,
              worldState: worldSnapshot,
              canonicalContext,
              contextPack: rpContextPack,
              activeInterlocutor: worldSnapshot?.conversation?.activeInterlocutor ?? null,
              conversationMode,
              pending: {
                action: worldSnapshot?.conversation?.pendingAction ?? null,
                travel: worldSnapshot?.travel?.pending ?? worldSnapshot?.conversation?.pendingTravel ?? null,
                access: worldSnapshot?.conversation?.pendingAccess ?? null
              }
            });
            const priorityToolCalls = buildPriorityMjToolCalls({
              message,
              intent,
              directorPlan,
              conversationMode,
              worldState: worldSnapshot,
              hasCharacterProfile: Boolean(rpContextPack)
            });
            const plannedToolCalls = mergeToolCalls(
              Array.isArray(mjStructuredDraft?.toolCalls) ? mjStructuredDraft.toolCalls : [],
              priorityToolCalls,
              6
            );
            const mjToolTrace = mjToolBus.executeToolCalls(plannedToolCalls, {
              message,
              records,
              worldState: worldSnapshot,
              canonicalContext,
              contextPack: rpContextPack,
              runtimeState: state,
              pending: {
                action: worldSnapshot?.conversation?.pendingAction ?? null,
                travel: worldSnapshot?.travel?.pending ?? worldSnapshot?.conversation?.pendingTravel ?? null,
                access: worldSnapshot?.conversation?.pendingAccess ?? null
              }
            });
            const mjStructured = await refineMjStructuredReplyWithTools({
              message,
              initialStructured: mjStructuredDraft,
              toolResults: mjToolTrace,
              worldState: worldSnapshot,
              canonicalContext,
              contextPack: rpContextPack,
              activeInterlocutor: worldSnapshot?.conversation?.activeInterlocutor ?? null,
              conversationMode
            });
            const worldIntentType = String(mjStructured?.worldIntent?.type ?? "none");
            if (worldIntentType === "propose_travel") {
              const targetFromAi = String(mjStructured?.worldIntent?.targetLabel ?? "").trim();
              const aiTargetLabel = targetFromAi || inferPlaceFromMessage(message, records) || "ce lieu";
              const currentWorld = loadNarrativeWorldState();
              const travelGuard = evaluateTravelProposalLoreGuard({
                targetLabel: aiTargetLabel,
                records,
                worldState: currentWorld
              });
              if (travelGuard.blocked) {
                const suggestions = travelGuard.suggestions.length
                  ? `Repères possibles: ${travelGuard.suggestions.join(" | ")}.`
                  : "Demande d'abord les lieux disponibles avant de te déplacer.";
                const guardReply = [
                  "Je bloque ce déplacement pour conserver la cohérence géographique/temps.",
                  suggestions
                ].join("\n");
                return sendJson(res, 200, {
                  reply: guardReply,
                  mjResponse: makeMjResponse({
                    responseType: "clarification",
                    directAnswer: "",
                    scene: "Le déplacement proposé n'est pas suffisamment ancré dans le contexte canonique.",
                    actionResult: suggestions,
                    consequences: "Aucune mutation du monde n'est appliquée tant que la destination reste ambiguë.",
                    options: travelGuard.suggestions.length
                      ? travelGuard.suggestions
                      : ["Demander les lieux connus", "Confirmer le lieu actuel", "Reformuler la destination"]
                  }),
                  speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
                  intent: {
                    type: "story_action",
                    confidence: Number(mjStructured?.confidence ?? 0.72),
                    reason: "phase3-travel-guard-block"
                  },
                  director: { mode: "scene_only", applyRuntime: false, source: "phase3-guard" },
                  worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "phase3-guard-block" },
                  worldState: currentWorld,
                  mjStructured,
                  mjToolTrace,
                  phase3LoreGuard: {
                    blocked: true,
                    violations: travelGuard.violations
                  },
                  stateUpdated: false
                });
              }
              const worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed-ai" },
                { intentType: "system_command", transitionId: "travel.proposed.ai" }
              );
              const place = resolveOrCreateSessionPlace(aiTargetLabel, records, worldState);
              const fromLocation = sanitizeWorldLocation(worldState?.location);
              const toLocation = { id: place.id, label: place.label };
              const durationMin = estimateTravelMinutes(fromLocation, toLocation, "free_exploration");
              worldState.conversation = {
                ...(worldState.conversation ?? {}),
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: null,
                pendingTravel: sanitizePendingTravel({
                  placeId: place.id,
                  placeLabel: place.label,
                  question: oneLine(message, 140),
                  sourceLoreIds: records.slice(0, 3).map((entry) => String(entry?.id ?? "")).filter(Boolean),
                  createdAt: new Date().toISOString()
                }),
                pendingAccess: sanitizePendingAccess(worldSnapshot?.conversation?.pendingAccess)
              };
              worldState.travel = sanitizeTravelState({
                ...(worldState.travel ?? {}),
                pending: {
                  from: fromLocation,
                  to: toLocation,
                  durationMin,
                  reason: "travel-proposed-ai",
                  startedAt: new Date().toISOString()
                }
              });
              worldState.sessionPlaces = upsertSessionPlace(worldState?.sessionPlaces, {
                id: place.id,
                label: place.label,
                city: place.city ?? "",
                access: place.access ?? "public",
                tags: Array.isArray(place.tags) ? place.tags : [],
                riskFlags: Array.isArray(place.riskFlags) ? place.riskFlags : [],
                sources: Array.isArray(place.sources) ? place.sources : [],
                summary: place.summary ?? ""
              });
              if (characterProfile) {
                worldState.startContext = {
                  ...(worldState.startContext ?? {}),
                  characterSnapshot: characterProfile
                };
              }
              const fallbackAdvisory = mjStructured?.directAnswer
                ? `${oneLine(mjStructured.directAnswer, 220)}\n${buildVisitAdvisoryReply(place, records, worldState)}`
                : buildVisitAdvisoryReply(place, records, worldState);
              const aiTravelAdvisory = await buildAiNarrativeReplyForBranch({
                worldState,
                fallbackReply: fallbackAdvisory,
                branchMessage: `deplacement vers ${place.label}`,
                narrativeStage: "travel_proposal",
                stateUpdatedExpected: false,
                worldBefore: worldSnapshot,
                recordsOverride: buildLoreRecordsForQuery(place.label),
                priorityToolCalls: [
                  { name: "get_world_state", args: {} },
                  { name: "session_db_read", args: { scope: "scene-memory" } },
                  { name: "query_lore", args: { query: place.label, limit: 5 } }
                ]
              });
              const injected = injectLockedStartContextReply(
                aiTravelAdvisory.reply || fallbackAdvisory,
                worldState,
                characterProfile
              );
              const aiTravelParts = parseReplyToMjBlocks(injected.reply);
              await persistNarrativeWorldStateWithPhase6(injected.worldState, {
                runtimeAlreadyApplied: false,
                source: "ai-travel-proposed"
              });
              return sendJson(res, 200, {
                reply: injected.reply,
                mjResponse: makeMjResponse({
                  responseType: "clarification",
                  directAnswer: oneLine(String(mjStructured?.directAnswer ?? ""), 220),
                  scene: aiTravelParts.scene,
                  actionResult: aiTravelParts.actionResult,
                  consequences: aiTravelParts.consequences,
                  options: aiTravelParts.options
                }),
                speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
                intent: {
                  type: "story_action",
                  confidence: Number(mjStructured?.confidence ?? 0.82),
                  reason: "ai-worldintent-propose-travel"
                },
                director: { mode: "scene_only", applyRuntime: false, source: "ai-mj-structured" },
                worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed-ai" },
                worldState: injected.worldState,
                mjStructured: aiTravelAdvisory.mjStructured ?? mjStructured,
                mjToolTrace: aiTravelAdvisory.mjToolTrace ?? mjToolTrace,
                stateUpdated: false
              });
            }
            const shouldShortCircuit =
              Boolean(mjStructured) &&
              Boolean(mjStructured.bypassExistingMechanics) &&
              String(mjStructured?.worldIntent?.type ?? "none") === "none";
            if (shouldShortCircuit) {
              const currentWorld = loadNarrativeWorldState();
              const worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "mj-structured-scene" },
                { intentType: "lore_question", transitionId: "none" }
              );
              worldState.conversation = {
                ...(worldState.conversation ?? {}),
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: sanitizePendingAction(worldSnapshot?.conversation?.pendingAction),
                pendingTravel: sanitizePendingTravel(worldSnapshot?.conversation?.pendingTravel),
                pendingAccess: sanitizePendingAccess(worldSnapshot?.conversation?.pendingAccess)
              };
              if (characterProfile) {
                worldState.startContext = {
                  ...(worldState.startContext ?? {}),
                  characterSnapshot: characterProfile
                };
              }
              const injected = injectLockedStartContextReply(
                buildMjReplyFromStructured(mjStructured),
                worldState,
                characterProfile
              );
              await persistNarrativeWorldStateWithPhase6(injected.worldState, {
                runtimeAlreadyApplied: false,
                source: "mj-structured-shortcircuit"
              });
              return sendJson(res, 200, {
                reply: injected.reply,
                mjResponse: makeMjResponse({
                  responseType: String(mjStructured?.responseType ?? "narration"),
                  directAnswer: String(mjStructured?.directAnswer ?? ""),
                  scene: String(mjStructured?.scene ?? ""),
                  actionResult: String(mjStructured?.actionResult ?? ""),
                  consequences: String(mjStructured?.consequences ?? ""),
                  options: normalizeMjOptions(mjStructured?.options, 6)
                }),
                speaker: buildSpeakerPayload({
                  conversationMode,
                  intentType: "story_action",
                  activeInterlocutor: worldSnapshot?.conversation?.activeInterlocutor ?? null
                }),
                intent: {
                  type: "story_action",
                  confidence: Number(mjStructured?.confidence ?? 0.72),
                  reason: "mj-structured-shortcircuit"
                },
                director: { mode: "scene_only", applyRuntime: false, source: "ai-mj-structured" },
                worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "mj-structured-scene" },
                worldState: injected.worldState,
                mjStructured,
                mjToolTrace,
                stateUpdated: false
              });
            }
          }
    
          if (conversationMode === "hrp") {
            const contextPack = buildCharacterContextPack(characterProfile, worldSnapshot);
            const hrpAiResult = await hrpAiInterpreter.analyzeHrpQuery(message, contextPack);
            const hrpConfidenceThreshold = Number(process.env.HRP_AI_MIN_CONFIDENCE ?? 0.32);
            const hasAnswer = Boolean(String(hrpAiResult?.answer ?? "").trim());
            const toolTraceCount = Array.isArray(hrpAiResult?.toolTrace) ? hrpAiResult.toolTrace.length : 0;
            const evidenceCoverage = Number(hrpAiResult?.evidenceCoverage ?? 0);
            const aiConfidence = Number(hrpAiResult?.confidence ?? 0);
            const aiUsable =
              Boolean(hrpAiResult) &&
              hasAnswer &&
              (aiConfidence >= hrpConfidenceThreshold ||
                Boolean(hrpAiResult?.evidenceValid) ||
                evidenceCoverage >= 0.34 ||
                toolTraceCount > 0);
            const shouldClarify =
              Boolean(hrpAiResult) &&
              !aiUsable &&
              !hasAnswer &&
              aiConfidence < 0.45 &&
              evidenceCoverage < 0.2 &&
              toolTraceCount === 0 &&
              Boolean(hrpAiResult?.needsClarification);
            const clarification = hrpAiResult?.clarificationQuestion
              ? String(hrpAiResult.clarificationQuestion)
              : "Peux-tu préciser le champ visé (équipement, sorts, ressources, progression) ?";
            const hrpReply = aiUsable
              ? hrpAiResult.needsClarification && hrpAiResult.clarificationQuestion
                ? `${hrpAiResult.answer}\n${hrpAiResult.clarificationQuestion}`
                : hrpAiResult.answer
              : shouldClarify
              ? [
                  "Je préfère clarifier pour éviter une réponse inexacte.",
                  clarification
                ].join("\n")
              : hasAnswer
              ? String(hrpAiResult.answer)
              : buildHrpReply(message, characterProfile, worldSnapshot);
            const worldDelta = {
              reputationDelta: 0,
              localTensionDelta: 0,
              reason: "hrp-no-impact"
            };
            await persistNarrativeWorldStateWithPhase6(worldSnapshot, {
              runtimeAlreadyApplied: false,
              source: "hrp-no-impact"
            });
            return sendJson(res, 200, {
              reply: hrpReply,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: hrpReply
              }),
              speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
              intent: {
                type: "system_command",
                confidence: Number(hrpAiResult?.confidence ?? 1),
                reason: hrpAiResult
                  ? aiUsable
                    ? `hrp-ai:${hrpAiResult.intent}`
                    : `hrp-ai-fallback:${hrpAiResult.reason ?? "untrusted"}`
                  : "hrp-mode"
              },
              director: {
                mode: "hrp",
                applyRuntime: false,
                source: hrpAiResult ? (aiUsable ? "ai" : "policy") : "policy"
              },
              hrpAnalysis: hrpAiResult
                ? {
                    intent: hrpAiResult.intent,
                    confidence: hrpAiResult.confidence,
                    needsClarification: hrpAiResult.needsClarification,
                    evidence: hrpAiResult.evidence,
                    evidenceValid: hrpAiResult.evidenceValid,
                    evidenceCoverage: hrpAiResult.evidenceCoverage,
                    validEvidence: hrpAiResult.validEvidence,
                    invalidEvidence: hrpAiResult.invalidEvidence,
                    reason: hrpAiResult.reason,
                    planner: hrpAiResult.planner ?? null,
                    toolTrace: hrpAiResult.toolTrace ?? []
                  }
                : null,
              worldDelta,
              worldState: worldSnapshot,
              stateUpdated: false
            });
          }
    
          if (conversationMode === "rp" && isRpSheetQuestion(message)) {
            const worldState = applyWorldDelta(
              loadNarrativeWorldState(),
              { reputationDelta: 0, localTensionDelta: 0, reason: "rp-sheet-query" },
              { intentType: "lore_question", transitionId: "none" }
            );
            if (characterProfile) {
              worldState.startContext = {
                ...(worldState.startContext ?? {}),
                characterSnapshot: characterProfile
              };
            }
            worldState.conversation = {
              ...(worldState.conversation ?? {}),
              activeInterlocutor:
                worldSnapshot?.conversation?.activeInterlocutor == null
                  ? null
                  : String(worldSnapshot.conversation.activeInterlocutor)
            };
            await persistNarrativeWorldStateWithPhase6(worldState, {
              runtimeAlreadyApplied: false,
              source: "rp-sheet-query"
            });
            return sendJson(res, 200, {
              reply: buildRpSheetAwareReply(message, characterProfile, worldState),
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: buildRpSheetAwareReply(message, characterProfile, worldState)
              }),
              speaker: buildSpeakerPayload({ conversationMode, intentType: "lore_question" }),
              intent: { type: "lore_question", confidence: 0.85, reason: "rp-sheet-query" },
              director: { mode: "scene_only", applyRuntime: false, source: "policy" },
              worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "rp-sheet-query" },
              worldState,
              stateUpdated: false
            });
          }
    
          if (conversationMode === "rp") {
            let rpActionAssessment = await rpActionValidator.assess(message, rpContextPack);
            if (rpActionAssessment?.isActionQuery && rpActionAssessment.actionType === "cast_spell") {
              const slotAvailable = hasRemainingSpellSlotsForRp(worldSnapshot, rpContextPack);
              if (!slotAvailable) {
                rpActionAssessment = {
                  ...rpActionAssessment,
                  allowed: false,
                  reason: "Plus aucun emplacement de sort disponible pour le moment.",
                  serverEvidence: {
                    ...(rpActionAssessment.serverEvidence ?? {}),
                    hasSlot: false
                  }
                };
              }
            }
            if (rpActionAssessment?.isActionQuery) {
              const currentWorld = loadNarrativeWorldState();
              const worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "rp-action-validation" },
                { intentType: "story_action", transitionId: "none" }
              );
              if (characterProfile) {
                worldState.startContext = {
                  ...(worldState.startContext ?? {}),
                  characterSnapshot: characterProfile
                };
              }
              worldState.conversation = {
                ...(worldState.conversation ?? {}),
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: sanitizePendingAction({
                  ...rpActionAssessment,
                  createdAt: new Date().toISOString()
                })
              };
              await persistNarrativeWorldStateWithPhase6(worldState, {
                runtimeAlreadyApplied: false,
                source: "rp-action-validation"
              });
              return sendJson(res, 200, {
                reply: buildRpActionValidationReply(rpActionAssessment),
                mjResponse: makeMjResponse({
                  responseType: "clarification",
                  scene: `Validation serveur: ${rpActionAssessment.allowed ? "possible" : "bloquee"}.`,
                  actionResult: String(rpActionAssessment.reason ?? ""),
                  consequences: "",
                  options: []
                }),
                speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
                intent: {
                  type: "story_action",
                  confidence: 0.84,
                  reason: `rp-action-validation:${rpActionAssessment.actionType}`
                },
                director: { mode: "scene_only", applyRuntime: false, source: "validator" },
                rpActionValidation: rpActionAssessment,
                worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "rp-action-validation" },
                worldState,
                stateUpdated: false
              });
            }
          }
    
          const aiDecision = await classifyNarrationWithAI(message, records, worldSnapshot);
          if (aiDecision) {
            intent = aiDecision.intent;
            directorPlan = aiDecision.director;
          }
          if (
            directorPlan?.source === "heuristic" &&
            Number(intent?.confidence ?? 0) < 0.75 &&
            shouldForceSceneLocalRouting({ message, conversationMode, worldState: worldSnapshot })
          ) {
            intent = {
              type: "social_action",
              confidence: Math.max(Number(intent?.confidence ?? 0.6), 0.82),
              requiresCheck: true,
              riskLevel: "medium",
              reason: "policy-local-scene-routing"
            };
            directorPlan = {
              mode: "scene_only",
              applyRuntime: false,
              source: "policy-local-scene-routing"
            };
          }
          const loreQuestion = directorPlan.mode === "lore";
          const freeExploration = directorPlan.mode === "exploration";
    
          if (loreQuestion) {
            const currentWorld = loadNarrativeWorldState();
            const worldState = applyWorldDelta(
              currentWorld,
              { reputationDelta: 0, localTensionDelta: 0, reason: "no-impact-intent" },
              { intentType: intent.type, transitionId: "none" }
            );
            if (characterProfile) {
              worldState.startContext = {
                ...(worldState.startContext ?? {}),
                characterSnapshot: characterProfile
              };
            }
            worldState.conversation = {
              ...(worldState.conversation ?? {}),
              activeInterlocutor: activeInterlocutor
            };
            const worldDelta = {
              reputationDelta: 0,
              localTensionDelta: 0,
              reason: "no-impact-intent"
            };
            let mjToolTrace = [];
            let mjStructuredLore = null;
            let loreReply = buildLoreOnlyReply(message, records, characterProfile, worldState);
            if (conversationMode === "rp") {
              const structuredDraft = await generateMjStructuredReply({
                message,
                records,
                worldState,
                canonicalContext: buildCanonicalNarrativeContext({
                  worldState,
                  contextPack: rpContextPack,
                  characterProfile
                }),
                contextPack: rpContextPack,
                activeInterlocutor,
                conversationMode,
                pending: {
                  action: worldState?.conversation?.pendingAction ?? null,
                  travel: worldState?.travel?.pending ?? worldState?.conversation?.pendingTravel ?? null,
                  access: worldState?.conversation?.pendingAccess ?? null
                }
              });
              const lorePriorityCalls = mergeToolCalls(
                Array.isArray(structuredDraft?.toolCalls) ? structuredDraft.toolCalls : [],
                [
                  { name: "get_world_state", args: {} },
                  { name: "session_db_read", args: { scope: "scene-memory" } },
                  { name: "query_lore", args: { query: message, limit: 4 } }
                ],
                6
              );
              mjToolTrace = mjToolBus.executeToolCalls(lorePriorityCalls, {
                message,
                records,
                worldState,
                canonicalContext: buildCanonicalNarrativeContext({
                  worldState,
                  contextPack: rpContextPack,
                  characterProfile
                }),
                contextPack: rpContextPack,
                runtimeState: state,
                pending: {
                  action: worldState?.conversation?.pendingAction ?? null,
                  travel: worldState?.travel?.pending ?? worldState?.conversation?.pendingTravel ?? null,
                  access: worldState?.conversation?.pendingAccess ?? null
                }
              });
              mjStructuredLore = await refineMjStructuredReplyWithTools({
                message,
                initialStructured: structuredDraft,
                toolResults: mjToolTrace,
                worldState,
                canonicalContext: buildCanonicalNarrativeContext({
                  worldState,
                  contextPack: rpContextPack,
                  characterProfile
                }),
                contextPack: rpContextPack,
                activeInterlocutor,
                conversationMode
              });
              if (mjStructuredLore) {
                const direct = oneLine(String(mjStructuredLore?.directAnswer ?? ""), 220);
                const blocks = buildMjReplyBlocks({
                  scene: String(mjStructuredLore?.scene ?? ""),
                  actionResult: String(mjStructuredLore?.actionResult ?? ""),
                  consequences: String(mjStructuredLore?.consequences ?? ""),
                  options: normalizeMjOptions(mjStructuredLore?.options, 6)
                });
                loreReply = direct ? `${direct}\n${blocks}` : blocks;
              }
            }
            const injected = injectLockedStartContextReply(
              addInterlocutorNote(loreReply, activeInterlocutor, intent.type, worldState, message),
              worldState,
              characterProfile
            );
            const loreParts = parseReplyToMjBlocks(injected.reply);
            await persistNarrativeWorldStateWithPhase6(injected.worldState, {
              runtimeAlreadyApplied: false,
              source: "lore-only"
            });
            return sendJson(res, 200, {
              reply: injected.reply,
              mjResponse: makeMjResponse({
                responseType: "status",
                scene: loreParts.scene,
                actionResult: loreParts.actionResult,
                consequences: loreParts.consequences,
                options: loreParts.options
              }),
              speaker: buildSpeakerPayload({
                conversationMode,
                intentType: intent.type,
                activeInterlocutor
              }),
              loreRecordsUsed: records.length,
              intent,
              director: directorPlan,
              worldDelta,
              worldState: injected.worldState,
              mjStructured: mjStructuredLore,
              mjToolTrace,
              loreOnly: true,
              stateUpdated: false
            });
          }
    
          if (freeExploration) {
            const currentWorld = loadNarrativeWorldState();
            const worldState = applyWorldDelta(
              currentWorld,
              { reputationDelta: 0, localTensionDelta: 0, reason: "no-impact-intent" },
              { intentType: intent.type, transitionId: "none" }
            );
            if (characterProfile) {
              worldState.startContext = {
                ...(worldState.startContext ?? {}),
                characterSnapshot: characterProfile
              };
            }
            worldState.conversation = {
              ...(worldState.conversation ?? {}),
              activeInterlocutor: activeInterlocutor
            };
            const worldDelta = {
              reputationDelta: 0,
              localTensionDelta: 0,
              reason: "no-impact-intent"
            };
            const fallbackExplorationReply = buildExplorationReply(message, records, worldState);
            const aiExploration = await buildAiNarrativeReplyForBranch({
              worldState,
              fallbackReply: fallbackExplorationReply,
              narrativeStage: "scene",
              stateUpdatedExpected: false,
              worldBefore: worldSnapshot,
              priorityToolCalls: [
                { name: "get_world_state", args: {} },
                { name: "session_db_read", args: { scope: "scene-memory" } },
                { name: "query_lore", args: { query: message, limit: 4 } }
              ]
            });
            const injected = injectLockedStartContextReply(
              aiExploration.reply || fallbackExplorationReply,
              worldState,
              characterProfile
            );
            const explorationParts = parseReplyToMjBlocks(injected.reply);
            await persistNarrativeWorldStateWithPhase6(injected.worldState, {
              runtimeAlreadyApplied: false,
              source: "exploration-only"
            });
            return sendJson(res, 200, {
              reply: injected.reply,
              mjResponse: makeMjResponse({
                responseType: "narration",
                scene: explorationParts.scene,
                actionResult: explorationParts.actionResult,
                consequences: explorationParts.consequences,
                options: explorationParts.options
              }),
              speaker: buildSpeakerPayload({
                conversationMode,
                intentType: intent.type,
                activeInterlocutor
              }),
              loreRecordsUsed: records.length,
              intent,
              director: directorPlan,
              worldDelta,
              worldState: injected.worldState,
              mjStructured: aiExploration.mjStructured,
              mjToolTrace: aiExploration.mjToolTrace,
              explorationOnly: true,
              stateUpdated: false
            });
          }
    
          const runtimeAllowedByDirector = Boolean(directorPlan.applyRuntime);
          const heuristicRuntimeGate =
            directorPlan.source === "heuristic" ? shouldApplyRuntimeForIntent(message, intent) : true;
          if (requiresInterlocutorInRp(intent, message, activeInterlocutor)) {
            const currentWorld = loadNarrativeWorldState();
            currentWorld.conversation = {
              ...(currentWorld.conversation ?? {}),
              activeInterlocutor: null
            };
            await persistNarrativeWorldStateWithPhase6(currentWorld, {
              runtimeAlreadyApplied: false,
              source: "missing-interlocutor"
            });
            return sendJson(res, 200, {
              reply: buildRpNeedInterlocutorReply(records),
              speaker: buildSpeakerPayload({ conversationMode, intentType: "social_action" }),
              loreRecordsUsed: records.length,
              intent,
              director: { ...directorPlan, mode: "scene_only", applyRuntime: false },
              worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "missing-interlocutor" },
              worldState: currentWorld,
              stateUpdated: false
            });
          }
    
          if (!runtimeAllowedByDirector || !heuristicRuntimeGate) {
            const currentWorld = loadNarrativeWorldState();
            const worldDelta =
              typeof computeSceneOnlyDelta === "function"
                ? computeSceneOnlyDelta(intent)
                : intent?.type === "story_action" && String(intent?.riskLevel ?? "") === "high"
                ? { reputationDelta: 0, localTensionDelta: 2, reason: "scene-only-combat-pressure" }
                : { reputationDelta: 0, localTensionDelta: 0, reason: "scene-only-no-runtime-trigger" };
            const worldState = applyWorldDelta(currentWorld, worldDelta, {
              intentType: intent.type,
              transitionId: "none"
            });
            if (characterProfile) {
              worldState.startContext = {
                ...(worldState.startContext ?? {}),
                characterSnapshot: characterProfile
              };
            }
            worldState.conversation = {
              ...(worldState.conversation ?? {}),
              activeInterlocutor: activeInterlocutor
            };
            const fallbackSceneOnly = addInterlocutorNote(
              buildDirectorNoRuntimeReply(message, intent.type, records),
              activeInterlocutor,
              intent.type,
              worldState,
              message
            );
            const aiSceneOnly = await buildAiNarrativeReplyForBranch({
              worldState,
              fallbackReply: fallbackSceneOnly,
              narrativeStage: "scene",
              stateUpdatedExpected: false,
              worldBefore: worldSnapshot,
              priorityToolCalls: [
                { name: "get_world_state", args: {} },
                { name: "session_db_read", args: { scope: "scene-memory" } },
                { name: "query_lore", args: { query: message, limit: 3 } },
                { name: "query_rules", args: { query: message } }
              ]
            });
            const injected = injectLockedStartContextReply(
              aiSceneOnly.reply || fallbackSceneOnly,
              worldState,
              characterProfile
            );
            const sceneOnlyParts = parseReplyToMjBlocks(injected.reply);
            await persistNarrativeWorldStateWithPhase6(injected.worldState, {
              runtimeAlreadyApplied: false,
              source: "scene-only"
            });
    
            return sendJson(res, 200, {
              reply: injected.reply,
              mjResponse: makeMjResponse({
                responseType: "narration",
                scene: sceneOnlyParts.scene,
                actionResult: sceneOnlyParts.actionResult,
                consequences: sceneOnlyParts.consequences,
                options: sceneOnlyParts.options
              }),
              speaker: buildSpeakerPayload({
                conversationMode,
                intentType: intent.type,
                activeInterlocutor
              }),
              loreRecordsUsed: records.length,
              intent,
              director: { ...directorPlan, mode: "scene_only", applyRuntime: false },
              worldDelta,
              worldState: injected.worldState,
              mjStructured: aiSceneOnly.mjStructured,
              mjToolTrace: aiSceneOnly.mjToolTrace,
              stateUpdated: true
            });
          }
    
          const generator = openAiApiKey
            ? new runtime.OpenAIMjNarrationGenerator({
                apiKey: openAiApiKey,
                model: process.env.NARRATION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini"
              })
            : new runtime.HeuristicMjNarrationGenerator();
    
          const outcome = await api.tickNarrationWithAI(
            {
              query: message,
              records,
              playerProfile: buildPlayerProfileInput(characterProfile),
              entityHints: {
                quest: Object.keys(state.quests),
                trama: Object.keys(state.tramas),
                companion: Object.keys(state.companions),
                trade: Object.keys(state.trades)
              },
              minHoursBetweenMajorEvents: 1,
              blockOnGuardFailure: true
            },
            generator
          );
          const worldDelta = computeWorldDelta({ intent, outcome });
          const currentWorld = loadNarrativeWorldState();
          const transitionId = outcome?.appliedOutcome?.result?.transitionId ?? "none";
          const worldState = applyWorldDelta(currentWorld, worldDelta, {
            intentType: intent.type,
            transitionId
          });
          if (characterProfile) {
            worldState.startContext = {
              ...(worldState.startContext ?? {}),
              characterSnapshot: characterProfile
            };
          }
          worldState.conversation = {
            ...(worldState.conversation ?? {}),
            activeInterlocutor: activeInterlocutor
          };
          const injected = injectLockedStartContextReply(
            addInterlocutorNote(
              buildNarrationChatReply(outcome, intent.type),
              activeInterlocutor,
              intent.type,
              worldState,
              message
            ),
            worldState,
            characterProfile
          );
          const runtimeParts = parseReplyToMjBlocks(injected.reply);
          await persistNarrativeWorldStateWithPhase6(injected.worldState, {
            runtimeAlreadyApplied: true,
            source: "runtime-main"
          });
    
          return sendJson(res, 200, {
            reply: injected.reply,
            mjResponse: makeMjResponse({
              responseType: "resolution",
              scene: runtimeParts.scene,
              actionResult: runtimeParts.actionResult,
              consequences: runtimeParts.consequences,
              options: runtimeParts.options
            }),
            speaker: buildSpeakerPayload({
              conversationMode,
              intentType: intent.type,
              activeInterlocutor
            }),
            loreRecordsUsed: records.length,
            intent,
            director: directorPlan,
            worldDelta,
            worldState: injected.worldState,
            outcome,
            stateUpdated: true
          });
        } catch (err) {
          console.error("[narration-chat] Erreur:", err?.message ?? err);
          return sendJson(res, 500, { error: "Chat narration impossible" });
        }
      }
    
    return false;
  }

  return { handle };
}

module.exports = {
  createNarrationChatHandler
};


