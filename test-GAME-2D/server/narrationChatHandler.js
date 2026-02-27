"use strict";
const { readAiBudgetConfig, readAiFeatureFlags } = require("./narrationAiConfig");
const { createAiCallBudgetController } = require("./narrationAiBudget");
const { createNarrationAiRoutingController } = require("./narrationAiRoutingController");
const { createNarrationDebugCommands } = require("./narrationDebugCommands");
const { createNarrationSystemCommands } = require("./narrationSystemCommands");
const {
  normalizeCommitment,
  shouldHandleHypotheticalCommitment,
  shouldHandleInformativeCommitment,
  shouldForceRuntimeByCommitment,
  shouldClarifyTargetFromCommitment
} = require("./narrationCommitmentPolicy");

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
    buildPhase3CriticalMutationStatsPayload,
    buildPhase4SessionStatsPayload,
    buildPhase4AiBudgetStatsPayload,
    buildPhase4AiRoutingStatsPayload,
    buildPhase5MutationStatsPayload,
    buildPhase6BackgroundStatsPayload,
    buildPhase7RenderStatsPayload,
    buildPhase7PerformanceStatsPayload,
    buildPhase8DebugChannelStatsPayload,
    resetNarrativeSessionDb,
    sanitizeInterlocutorLabel,
    loadNarrativeWorldState,
    sanitizePendingAction,
    sanitizePendingTravel,
    sanitizePendingAccess,
    sanitizeConversationMemory,
    sanitizeSceneFrame,
    extractInterlocutorFromMessage,
    buildCanonicalNarrativeContext,
    rpActionResolver,
    applyWorldDelta,
    applyCriticalMutation,
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
    arbitrateSceneIntentWithAI,
    validateNarrativeStateConsistency,
    extractLocalMemoryCandidatesWithAI,
    generateEntityMicroProfilesWithAI,
    summarizeConversationWindowWithAI,
    resolveSpatialTargetWithAI,
    arbitratePendingTravelWithAI,
    assessRuntimeEligibilityWithAI,
    resolveSceneFramePatchWithAI,
    validateSceneFrameContinuityWithAI,
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
    writeSessionNarrativeMemory,
    applyBackgroundNarrativeTick,
    temperNarrativeHype
  } = deps;
  const narrationDebugCommands = createNarrationDebugCommands({
    makeMjResponse,
    buildSpeakerPayload,
    loadNarrativeWorldState,
    buildCharacterProfileDiagnostics,
    buildCharacterContextDiagnostics,
    buildCharacterContextPack,
    buildCanonicalContextDiagnostics,
    buildCharacterRulesDiagnostics,
    buildMjContractStatsPayload,
    buildPhase3GuardStatsPayload,
    buildPhase3CriticalMutationStatsPayload,
    buildPhase4SessionStatsPayload,
    buildPhase4AiBudgetStatsPayload,
    buildPhase4AiRoutingStatsPayload,
    buildPhase5MutationStatsPayload,
    buildPhase6BackgroundStatsPayload,
    buildPhase7RenderStatsPayload,
    buildPhase7PerformanceStatsPayload,
    buildPhase8DebugChannelStatsPayload
  });
  const narrationSystemCommands = createNarrationSystemCommands({
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
  });

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
          const aiBudget = createAiCallBudgetController(readAiBudgetConfig());
          const aiRoutingController = createNarrationAiRoutingController({
            conversationMode,
            aiBudget
          });
          const recordAiRouting = aiRoutingController.record;
          const callAiWithBudget = aiRoutingController.callWithBudget;
          const hasAiBudgetFor = aiRoutingController.hasBudgetFor;
          const aiFeatureFlags = readAiFeatureFlags();
          const {
            useAiClassifier,
            useAiSceneFramePatch,
            useAiWorldArbitration,
            useAiRefine,
            useAiStructuredMain,
            useAiStructuredBranch,
            useAiStructuredLore,
            useAiBranchPriorityBudgetRouting,
            useAiLocalMemory,
            useAiPendingTravelArbitration,
            useAiRuntimeEligibility,
            useAiValidators
          } = aiFeatureFlags;

          const systemPayload = narrationSystemCommands.tryHandle({
            message,
            characterProfile,
            intent,
            directorPlan,
            conversationMode
          });
          if (systemPayload) {
            return sendJson(res, 200, systemPayload);
          }
    
          const debugPayload = narrationDebugCommands.tryHandle({
            message,
            characterProfile,
            conversationMode,
            intent,
            directorPlan
          });
          if (debugPayload) {
            return sendJson(res, 200, debugPayload);
          }
    
          const runtime = getNarrationRuntime();
          const api = runtime.GameNarrationAPI.createDefault(narrationStatePath);
          const state = api.getState();
          const records = buildLoreRecordsForQuery(message);
          let phase13MemoryTrace = null;
          const normalizeToken = (value) =>
            String(value ?? "")
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, " ")
              .replace(/\s+/g, " ")
              .trim();
          function buildPlayerIdentitySet(worldState) {
            const set = new Set();
            const push = (v) => {
              const token = normalizeToken(v);
              if (token) set.add(token);
            };
            push(characterProfile?.name);
            push(worldState?.startContext?.characterSnapshot?.name);
            push(worldState?.startContext?.characterSnapshot?.race);
            push(worldState?.startContext?.characterSnapshot?.classLabel);
            return set;
          }
          function cleanSceneAnchors(frameCandidate, worldState) {
            const safeFrame = sanitizeSceneFrame(frameCandidate, worldState);
            const locationLabel = String(
              worldState?.location?.label ??
                worldState?.startContext?.locationLabel ??
                safeFrame.locationLabel ??
                ""
            ).trim();
            const locationToken = normalizeToken(locationLabel);
            const playerTokens = buildPlayerIdentitySet(worldState);
            const genericSpeakerTokens = new Set(["toi", "tu", "vous", "joueur", "personnage", "pj", "mj"]);
            const rawInterlocutor = String(safeFrame.activeInterlocutorLabel ?? "").trim();
            const rawInterlocutorToken = normalizeToken(rawInterlocutor);
            const rawPoi = String(safeFrame.activePoiLabel ?? "").trim();
            const rawPoiToken = normalizeToken(rawPoi);
            const cleanedInterlocutor =
              rawInterlocutor &&
              !playerTokens.has(rawInterlocutorToken) &&
              !genericSpeakerTokens.has(rawInterlocutorToken) &&
              rawInterlocutorToken !== locationToken
                ? rawInterlocutor
                : "";
            const cleanedPoi =
              rawPoi && rawPoiToken !== locationToken && !playerTokens.has(rawPoiToken) ? rawPoi : "";
            const facts = Array.isArray(safeFrame.recentFacts)
              ? Array.from(
                  new Set(
                    safeFrame.recentFacts
                      .map((x) => String(x ?? "").trim())
                      .filter((x) => x && normalizeToken(x) !== locationToken)
                  )
                ).slice(0, 6)
              : [];
            return sanitizeSceneFrame(
              {
                ...safeFrame,
                activeInterlocutorLabel: cleanedInterlocutor,
                activePoiLabel: cleanedPoi,
                recentFacts: facts
              },
              worldState
            );
          }
          async function persistLocalSceneMemory({
            replyText,
            worldState,
            memoryRecords
          }) {
            if (conversationMode !== "rp") return;
            if (!useAiLocalMemory) return;
            if (Number(aiBudget.getSnapshot(1).used ?? 0) >= 1) {
              recordAiRouting("extract-local-memory", "skipped", "phase4-budget-gate");
              return;
            }
            if (typeof writeSessionNarrativeMemory !== "function") return;
            if (typeof extractLocalMemoryCandidatesWithAI !== "function") return;
            const safeReply = String(replyText ?? "").trim();
            const safeWorld = worldState && typeof worldState === "object" ? worldState : null;
            if (!safeReply || !safeWorld) return;

            const extracted = await callAiWithBudget(
              "extract-local-memory",
              () =>
                extractLocalMemoryCandidatesWithAI({
                  reply: safeReply,
                  worldState: safeWorld,
                  records: Array.isArray(memoryRecords) ? memoryRecords : records,
                  conversationMode
                }),
              null
            );
            if (!extracted || typeof extracted !== "object") return;
            const sceneFrame = cleanSceneAnchors(safeWorld?.conversation?.sceneFrame, safeWorld);
            const playerTokens = buildPlayerIdentitySet(safeWorld);
            const locationToken = normalizeToken(safeWorld?.location?.label);
            const topNpc = Array.isArray(extracted.npcs)
              ? extracted.npcs.find((row) => {
                  const token = normalizeToken(row?.name);
                  return token && !playerTokens.has(token) && token !== locationToken;
                }) ?? null
              : null;
            const topPlaceCandidate = Array.isArray(extracted.places)
              ? extracted.places.find((row) => normalizeToken(row?.label) !== locationToken) ?? null
              : null;
            const topFactTexts = Array.isArray(extracted.facts)
              ? extracted.facts.map((x) => String(x?.statement ?? "").trim()).filter(Boolean).slice(0, 3)
              : [];
            const nextInterlocutor = String(sceneFrame.activeInterlocutorLabel ?? "").trim()
              ? String(sceneFrame.activeInterlocutorLabel ?? "").trim()
              : String(topNpc?.name ?? "").trim();
            const nextPoi = String(sceneFrame.activePoiLabel ?? "").trim()
              ? String(sceneFrame.activePoiLabel ?? "").trim()
              : String(topPlaceCandidate?.label ?? "").trim();
            const nextTopic =
              String(sceneFrame.activeTopic ?? "").trim() ||
              (Array.isArray(extracted.facts)
                ? String(
                    extracted.facts.find((row) => String(row?.subject ?? "").trim())?.subject ?? ""
                  ).trim()
                : "") ||
              (intent?.type === "story_action" || intent?.type === "social_action" ? oneLine(message, 80) : "");
            safeWorld.conversation = {
              ...(safeWorld.conversation ?? {}),
              sceneFrame: cleanSceneAnchors(
                {
                  ...sceneFrame,
                  activePoiLabel: nextPoi,
                  activeInterlocutorLabel: nextInterlocutor,
                  activeTopic: nextTopic,
                  recentFacts: topFactTexts.length ? topFactTexts : sceneFrame.recentFacts
                },
                safeWorld
              )
            };
            const microProfiles =
              typeof generateEntityMicroProfilesWithAI === "function"
                ? await callAiWithBudget(
                    "generate-entity-micro-profiles",
                    () =>
                      generateEntityMicroProfilesWithAI({
                        reply: safeReply,
                        worldState: safeWorld,
                        sceneFrame: safeWorld?.conversation?.sceneFrame ?? null,
                        conversationMode
                      }),
                    null
                  )
                : null;
            const npcProfiles = Array.isArray(microProfiles?.npcs) ? microProfiles.npcs : [];
            const poiProfiles = Array.isArray(microProfiles?.pois) ? microProfiles.pois : [];
            const interactionWeight =
              intent?.type === "story_action" || intent?.type === "social_action"
                ? 0.28
                : intent?.type === "free_exploration"
                ? 0.12
                : 0.09;

            const now = Date.now();
            const locationId = String(safeWorld?.location?.id ?? "").trim();
            const locationLabel = String(safeWorld?.location?.label ?? "").trim();
            const ops = [];
            const pushUpsert = (entity, item) => {
              if (!entity || !item || typeof item !== "object") return;
              ops.push({ action: "upsert", entity, item });
            };

            (Array.isArray(extracted.places) ? extracted.places : []).slice(0, 4).forEach((row) => {
              const label = String(row?.label ?? "").trim();
              if (!label) return;
              const ttlDays = Math.max(1, Math.min(30, Number(row?.ttlDays ?? 7) || 7));
              const expiresAt = new Date(now + ttlDays * 24 * 60 * 60 * 1000).toISOString();
              pushUpsert("placesDiscovered", {
                label,
                text: String(row?.summary ?? "").trim(),
                tags: Array.isArray(row?.tags) ? row.tags : [],
                source: "local-memory-ai",
                status: String(row?.visibility ?? "visible").trim() || "visible",
                data: {
                  locationId,
                  locationLabel,
                  confidence: Number(row?.confidence ?? 0.64),
                  ttlDays,
                  ttlGameHours: Math.max(24, ttlDays * 24),
                  expiresAt,
                  memoryType: "local-place",
                  interestScore: interactionWeight,
                  interactionWeight,
                  profile:
                    poiProfiles.find((p) => normalizeToken(p?.label) === normalizeToken(label)) ?? null
                }
              });
            });

            (Array.isArray(extracted.npcs) ? extracted.npcs : []).slice(0, 4).forEach((row) => {
              const name = String(row?.name ?? "").trim();
              if (!name) return;
              const nameToken = normalizeToken(name);
              if (!nameToken || playerTokens.has(nameToken) || nameToken === locationToken) return;
              const ttlDays = Math.max(1, Math.min(30, Number(row?.ttlDays ?? 5) || 5));
              const expiresAt = new Date(now + ttlDays * 24 * 60 * 60 * 1000).toISOString();
              pushUpsert("sessionNpcs", {
                label: name,
                text: String(row?.role ?? "").trim(),
                tags: Array.isArray(row?.traits) ? row.traits : [],
                source: "local-memory-ai",
                status: "seen",
                data: {
                  locationId,
                  locationLabel,
                  voiceHints: Array.isArray(row?.voiceHints) ? row.voiceHints : [],
                  confidence: Number(row?.confidence ?? 0.6),
                  ttlDays,
                  ttlGameHours: Math.max(24, ttlDays * 24),
                  expiresAt,
                  memoryType: "local-npc",
                  interestScore: interactionWeight,
                  interactionWeight,
                  profile:
                    npcProfiles.find((p) => normalizeToken(p?.name) === normalizeToken(name)) ?? null
                }
              });
            });

            (Array.isArray(extracted.facts) ? extracted.facts : []).slice(0, 6).forEach((row) => {
              const statement = String(row?.statement ?? "").trim();
              if (!statement) return;
              const ttlDays = Math.max(1, Math.min(30, Number(row?.ttlDays ?? 3) || 3));
              const expiresAt = new Date(now + ttlDays * 24 * 60 * 60 * 1000).toISOString();
              pushUpsert("establishedFacts", {
                label: String(row?.subject ?? locationLabel ?? "fait-local"),
                text: statement,
                tags: Array.isArray(row?.evidence) ? row.evidence : [],
                source: "local-memory-ai",
                status: "observed",
                data: {
                  locationId,
                  locationLabel,
                  confidence: Number(row?.confidence ?? 0.58),
                  ttlDays,
                  expiresAt,
                  memoryType: "local-fact"
                }
              });
            });

            if (!ops.length) return;
            writeSessionNarrativeMemory({ operations: ops, worldState: safeWorld });
          }
          function readSceneMemoryRows(worldState, queryText = "") {
            const calls = [{ name: "session_db_read", args: { scope: "scene-memory", query: queryText, limit: 16 } }];
            const trace = mjToolBus.executeToolCalls(calls, {
              message: message,
              records,
              worldState,
              canonicalContext,
              contextPack: rpContextPack,
              runtimeState: state,
              intent,
              directorPlan,
              pending: {
                action: worldState?.conversation?.pendingAction ?? null,
                travel: worldState?.travel?.pending ?? worldState?.conversation?.pendingTravel ?? null,
                access: worldState?.conversation?.pendingAccess ?? null
              }
            });
            const row = Array.isArray(trace)
              ? trace.find((entry) => String(entry?.tool ?? "").toLowerCase() === "session_db_read")
              : null;
            return Array.isArray(row?.data?.rows) ? row.data.rows : [];
          }
          async function resolveSpatialTargetRelation(worldState, targetLabel) {
            if (conversationMode !== "rp") return null;
            if (typeof resolveSpatialTargetWithAI !== "function") return null;
            const label = String(targetLabel ?? "").trim();
            if (!label) return null;
            const memoryRows = readSceneMemoryRows(worldState, label);
            return callAiWithBudget(
              "resolve-spatial-target",
              () =>
                resolveSpatialTargetWithAI({
                  message,
                  targetLabel: label,
                  worldState,
                  sceneMemoryRows: memoryRows,
                  records,
                  conversationMode
                }),
              null
            );
          }
          async function summarizeConversationTurns(windowKey, turns, worldState) {
            const safeTurns = Array.isArray(turns) ? turns : [];
            if (!safeTurns.length) return "";
            if (
              useAiLocalMemory &&
              typeof summarizeConversationWindowWithAI === "function" &&
              Number(aiBudget.getSnapshot(1).used ?? 0) < 1
            ) {
              const aiSummary = await callAiWithBudget(
                "summarize-conversation-window",
                () =>
                  summarizeConversationWindowWithAI({
                    windowKey,
                    turns: safeTurns,
                    worldState,
                    conversationMode
                  }),
                null
              );
              if (aiSummary && typeof aiSummary.summary === "string" && aiSummary.summary.trim()) {
                const facts =
                  Array.isArray(aiSummary.keyFacts) && aiSummary.keyFacts.length
                    ? ` Faits: ${aiSummary.keyFacts.slice(0, 4).join(" | ")}.`
                    : "";
                const threads =
                  Array.isArray(aiSummary.openThreads) && aiSummary.openThreads.length
                    ? ` Fils ouverts: ${aiSummary.openThreads.slice(0, 3).join(" | ")}.`
                    : "";
                return `${aiSummary.summary.trim()}${facts}${threads}`.trim();
              }
            }
            if (useAiLocalMemory && typeof summarizeConversationWindowWithAI === "function") {
              recordAiRouting("summarize-conversation-window", "skipped", "phase4-budget-gate");
            }
            const userTopics = safeTurns
              .map((row) => String(row?.user ?? "").trim())
              .filter(Boolean)
              .slice(-8);
            const location = String(worldState?.location?.label ?? "lieu actuel").trim();
            return oneLine(
              `Résumé ${windowKey}: échanges récents autour de ${location}. Intentions: ${userTopics.join(" | ")}.`,
              520
            );
          }
          async function updateConversationMemory(worldState, replyText) {
            const safeWorld = worldState && typeof worldState === "object" ? worldState : null;
            if (!safeWorld) return null;
            const safeReply = String(replyText ?? "").trim();
            if (!safeReply) return null;
            const conv = safeWorld.conversation && typeof safeWorld.conversation === "object" ? safeWorld.conversation : {};
            const memory = sanitizeConversationMemory(conv.memory, safeWorld);
            const day = Math.max(1, Math.floor(Number(safeWorld?.time?.day ?? 1) || 1));
            const windowMode = String(memory.windowMode ?? "day");
            const windowKey = windowMode === "long_rest" ? `long-rest:${day}` : `day:${day}`;
            const nextTurns = Array.isArray(memory.turns) ? memory.turns.slice(-199) : [];
            nextTurns.push({
              at: new Date().toISOString(),
              windowKey,
              user: oneLine(message, 280),
              mj: oneLine(safeReply, 420),
              intentType: String(intent?.type ?? ""),
              directorMode: String(directorPlan?.mode ?? ""),
              locationLabel: String(safeWorld?.location?.label ?? ""),
              day
            });

            const keepTurns = Math.max(2, Math.min(20, Number(memory.keepTurns ?? 6) || 6));
            const maxTurns = Math.max(8, Math.min(80, Number(memory.maxTurns ?? 24) || 24));
            const olderWindowTurns = nextTurns.filter((row) => String(row?.windowKey ?? "") !== windowKey);
            const currentWindowTurns = nextTurns.filter((row) => String(row?.windowKey ?? "") === windowKey);
            let compacted = false;
            let compactReason = "";
            let compactedCount = 0;
            let compactSummary = "";
            let retainedTurns = nextTurns;
            if (olderWindowTurns.length > 0) {
              compactReason = "window-closed";
              compacted = true;
              compactedCount += olderWindowTurns.length;
              const byWindow = {};
              olderWindowTurns.forEach((row) => {
                const key = String(row?.windowKey ?? "unknown");
                byWindow[key] = byWindow[key] || [];
                byWindow[key].push(row);
              });
              const summaries = Array.isArray(memory.summaries) ? memory.summaries.slice(-79) : [];
              for (const [key, rows] of Object.entries(byWindow)) {
                const summaryText = await summarizeConversationTurns(key, rows, safeWorld);
                if (!summaryText) continue;
                summaries.push({
                  at: new Date().toISOString(),
                  windowKey: key,
                  fromAt: String(rows[0]?.at ?? ""),
                  toAt: String(rows[rows.length - 1]?.at ?? ""),
                  turnCount: rows.length,
                  reason: "window-closed",
                  summary: summaryText
                });
                compactSummary = oneLine(summaryText, 260);
              }
              memory.summaries = summaries.slice(-80);
              retainedTurns = currentWindowTurns.slice(-Math.max(keepTurns, 8));
            }
            if (currentWindowTurns.length > maxTurns) {
              compactReason = compactReason || "capacity";
              compacted = true;
              const overflow = currentWindowTurns.slice(0, currentWindowTurns.length - keepTurns);
              compactedCount += overflow.length;
              const summaryText = await summarizeConversationTurns(windowKey, overflow, safeWorld);
              if (summaryText) {
                const summaries = Array.isArray(memory.summaries) ? memory.summaries.slice(-79) : [];
                summaries.push({
                  at: new Date().toISOString(),
                  windowKey,
                  fromAt: String(overflow[0]?.at ?? ""),
                  toAt: String(overflow[overflow.length - 1]?.at ?? ""),
                  turnCount: overflow.length,
                  reason: "capacity",
                  summary: summaryText
                });
                memory.summaries = summaries.slice(-80);
                compactSummary = oneLine(summaryText, 260);
              }
              retainedTurns = currentWindowTurns.slice(-keepTurns);
            }
            const finalMemory = sanitizeConversationMemory(
              {
                ...memory,
                activeWindowKey: windowKey,
                turns: retainedTurns.slice(-200),
                lastCompactedAt: compacted ? new Date().toISOString() : memory.lastCompactedAt
              },
              safeWorld
            );
            safeWorld.conversation = {
              ...(safeWorld.conversation ?? {}),
              memory: finalMemory
            };
            return {
              updated: true,
              compacted,
              compactReason: compactReason || "none",
              compactedCount,
              activeWindowKey: windowKey,
              activeTurns: finalMemory.turns.length,
              summaryCount: finalMemory.summaries.length,
              compactSummary
            };
          }
          async function persistNarrativeWorldStateWithPhase6(worldState, options = {}) {
            const safeWorldState = worldState && typeof worldState === "object" ? worldState : null;
            const runtimeAlreadyApplied = Boolean(options.runtimeAlreadyApplied);
            const source = String(options.source ?? "narration");
            const replyText = String(options.replyText ?? "").trim();
            const memoryRecords = Array.isArray(options.memoryRecords) ? options.memoryRecords : records;
            let memoryTrace = null;
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
            if (safeWorldState && replyText) {
              await persistLocalSceneMemory({
                replyText,
                worldState: safeWorldState,
                memoryRecords
              });
              memoryTrace = await updateConversationMemory(safeWorldState, replyText);
            }
            if (memoryTrace) phase13MemoryTrace = memoryTrace;
            saveNarrativeWorldState(safeWorldState ?? worldState);
            return memoryTrace;
          }
          function buildSceneFrameAnchoredFallbackReply(fallbackReply, sceneFrame, worldState) {
            const raw = String(fallbackReply ?? "").trim();
            if (!raw) return raw;
            const safeFrame =
              sceneFrame && typeof sceneFrame === "object"
                ? cleanSceneAnchors(sceneFrame, worldState)
                : null;
            if (!safeFrame) return raw;
            const parts = parseReplyToMjBlocks(raw);
            const locationLabel = String(
              worldState?.location?.label ??
                worldState?.startContext?.locationLabel ??
                safeFrame.currentLocationLabel ??
                "le lieu"
            ).trim();
            const poiLabel = String(safeFrame.activePoiLabel ?? "").trim();
            const interlocutorLabel = String(safeFrame.activeInterlocutorLabel ?? "").trim();
            const topicLabel = String(safeFrame.activeTopic ?? "").trim();
            const recentFacts = Array.isArray(safeFrame.recentFacts)
              ? safeFrame.recentFacts.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 2)
              : [];
            const sceneBase = String(parts?.scene ?? "").trim();
            const actionBase = String(parts?.actionResult ?? "").trim();
            const consequenceBase = String(parts?.consequences ?? "").trim();
            const sceneAnchors = [];
            if (poiLabel) sceneAnchors.push(`Ton attention reste sur ${poiLabel}.`);
            if (interlocutorLabel) sceneAnchors.push(`Ton interlocuteur reste ${interlocutorLabel}.`);
            if (topicLabel) sceneAnchors.push(`Le fil de la discussion reste centré sur ${topicLabel}.`);
            if (recentFacts.length) sceneAnchors.push(`Repères récents: ${recentFacts.join(" | ")}.`);
            const scene = [sceneBase || `Tu restes sur ${locationLabel}.`, sceneAnchors.join(" ")]
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            const actionResult =
              actionBase ||
              `La scène reste cohérente dans ${locationLabel} sans changement de repère non annoncé.`;
            const consequences =
              consequenceBase ||
              "Aucune rupture de continuité n'est appliquée; tu peux poursuivre depuis ce même contexte.";
            return buildMjReplyBlocks({
              scene,
              actionResult,
              consequences,
              options: normalizeMjOptions(parts?.options, 6)
            });
          }
          function deterministicNarrativeStateConsistencyCheck({
            narrativeStage,
            text,
            stateUpdatedExpected
          }) {
            const stage = String(narrativeStage ?? "scene").trim().toLowerCase();
            const reply = String(text ?? "").toLowerCase();
            const looksLikeArrival =
              reply.includes("tu arrives") ||
              reply.includes("te voila") ||
              reply.includes("vous arrivez") ||
              reply.includes("vous voila") ||
              reply.includes("tu franchis") ||
              reply.includes("vous franchissez");
            if (stage === "travel_proposal" && looksLikeArrival) {
              return { valid: false, reason: "deterministic:travel-proposal-arrival-drift", severity: "high" };
            }
            if (!stateUpdatedExpected && reply.includes("est maintenant")) {
              return { valid: false, reason: "deterministic:state-claim-without-update", severity: "medium" };
            }
            return { valid: true, reason: "deterministic:ok", severity: "low" };
          }
          function deterministicSceneFrameContinuityCheck({ reply, sceneFrame }) {
            const text = String(reply ?? "").toLowerCase();
            const safeFrame = sceneFrame && typeof sceneFrame === "object" ? sceneFrame : null;
            if (!safeFrame) return { valid: true, reason: "deterministic:no-frame", severity: "low" };
            const currentPoi = String(safeFrame.activePoiLabel ?? "").trim().toLowerCase();
            const currentNpc = String(safeFrame.activeInterlocutorLabel ?? "").trim().toLowerCase();
            const mentionsHardSwitch =
              text.includes("tu changes de lieu") || text.includes("vous changez de lieu");
            if ((currentPoi || currentNpc) && mentionsHardSwitch) {
              return { valid: false, reason: "deterministic:hard-switch-detected", severity: "medium" };
            }
            return { valid: true, reason: "deterministic:ok", severity: "low" };
          }
          function shouldBypassBranchAiForBudget(narrativeStage) {
            if (!useAiBranchPriorityBudgetRouting) return false;
            const stage = String(narrativeStage ?? "scene").trim().toLowerCase();
            const isPriorityStage = stage === "travel_confirmed" || stage === "travel_proposal";
            if (isPriorityStage) return false;
            const snapshot = aiBudget.getSnapshot(1);
            return Number(snapshot.used ?? 0) >= 1;
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
            const sceneFrame =
              params.sceneFrame && typeof params.sceneFrame === "object"
                ? params.sceneFrame
                : worldSnapshot?.conversation?.sceneFrame ?? null;
            if (conversationMode !== "rp" || !safeWorldState) {
              return {
                reply: fallbackReply,
                mjStructured: null,
                mjToolTrace: [],
                phase12: {
                  continuityGuard: null,
                  anchorDriftDetected: false,
                  stageContractViolation: false,
                  regenerationCount: 0
                }
              };
            }
            if (shouldBypassBranchAiForBudget(narrativeStage)) {
              const anchoredFallback = buildSceneFrameAnchoredFallbackReply(
                fallbackReply,
                sceneFrame,
                safeWorldState
              );
              return {
                reply: anchoredFallback || fallbackReply,
                mjStructured: null,
                mjToolTrace: [],
                phase12: {
                  continuityGuard: null,
                  anchorDriftDetected: false,
                  stageContractViolation: false,
                  regenerationCount: 0,
                  branchAiBypassReason: "phase4-budget-priority-routing"
                }
              };
            }
            if (!useAiStructuredBranch) {
              const anchoredFallback = buildSceneFrameAnchoredFallbackReply(
                fallbackReply,
                sceneFrame,
                safeWorldState
              );
              return {
                reply: anchoredFallback || fallbackReply,
                mjStructured: null,
                mjToolTrace: [],
                phase12: {
                  continuityGuard: null,
                  anchorDriftDetected: false,
                  stageContractViolation: false,
                  regenerationCount: 0
                }
              };
            }
            const canonicalForBranch = buildCanonicalNarrativeContext({
              worldState: safeWorldState,
              contextPack: rpContextPack,
              characterProfile
            });
            const maxRegenerations = 1;
            let regenerationCount = 0;
            let lastToolTrace = [];
            let lastContinuity = null;
            let lastStageViolation = false;
            for (let attempt = 0; attempt <= maxRegenerations; attempt += 1) {
              const draft = await callAiWithBudget(
                "generate-mj-structured-branch",
                () =>
                  generateMjStructuredReply({
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
                  }),
                null
              );
              const planned = mergeToolCalls(
                Array.isArray(draft?.toolCalls) ? draft.toolCalls : [],
                Array.isArray(params.priorityToolCalls) ? params.priorityToolCalls : [],
                6,
                {
                  intentType: String(intent?.type ?? "story_action"),
                  semanticIntent: String(intent?.semanticIntent ?? ""),
                  directorMode: String(directorPlan?.mode ?? "scene_only"),
                  conversationMode,
                  worldState: safeWorldState,
                  message: branchMessage
                }
              );
              const mjToolTrace = mjToolBus.executeToolCalls(planned, {
                message: branchMessage,
                records: branchRecords,
                worldState: safeWorldState,
                canonicalContext: canonicalForBranch,
                contextPack: rpContextPack,
                runtimeState: state,
                intent,
                directorPlan,
                pending: {
                  action: safeWorldState?.conversation?.pendingAction ?? null,
                  travel: safeWorldState?.travel?.pending ?? safeWorldState?.conversation?.pendingTravel ?? null,
                  access: safeWorldState?.conversation?.pendingAccess ?? null
                }
              });
              lastToolTrace = mjToolTrace;
              const refined = useAiRefine
                ? await callAiWithBudget(
                    "refine-mj-structured-branch",
                    () =>
                      refineMjStructuredReplyWithTools({
                        message: branchMessage,
                        initialStructured: draft,
                        toolResults: mjToolTrace,
                        worldState: safeWorldState,
                        canonicalContext: canonicalForBranch,
                        contextPack: rpContextPack,
                        activeInterlocutor,
                        conversationMode,
                        narrativeStage
                      }),
                    draft
                  )
                : draft;
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
                if (attempt < maxRegenerations) {
                  regenerationCount += 1;
                  continue;
                }
                const anchoredFallback = buildSceneFrameAnchoredFallbackReply(
                  fallbackReply,
                  sceneFrame,
                  safeWorldState
                );
                return {
                  reply: anchoredFallback || fallbackReply,
                  mjStructured: null,
                  mjToolTrace,
                  phase12: {
                    continuityGuard: lastContinuity,
                    anchorDriftDetected: Boolean(lastContinuity && lastContinuity.valid === false),
                    stageContractViolation: Boolean(lastStageViolation),
                    regenerationCount
                  }
                };
              }
              const direct = String(tempered?.directAnswer ?? "").replace(/\s+/g, " ").trim();
              const fallbackParts = parseReplyToMjBlocks(fallbackReply);
              const sceneText =
                String(tempered?.scene ?? "").replace(/\s+/g, " ").trim() ||
                String(fallbackParts?.scene ?? "").replace(/\s+/g, " ").trim();
              const actionText =
                String(tempered?.actionResult ?? "").replace(/\s+/g, " ").trim() ||
                String(fallbackParts?.actionResult ?? "").replace(/\s+/g, " ").trim();
              const consequenceText =
                String(tempered?.consequences ?? "").replace(/\s+/g, " ").trim() ||
                String(fallbackParts?.consequences ?? "").replace(/\s+/g, " ").trim();
              const mergedOptions = normalizeMjOptions(
                Array.isArray(tempered?.options) && tempered.options.length
                  ? tempered.options
                  : fallbackParts?.options,
                6
              );
              const blocks = buildMjReplyBlocks({
                scene: sceneText,
                actionResult: actionText,
                consequences: consequenceText,
                options: mergedOptions
              });
              const composedReply = direct ? `${direct}\n${blocks}` : blocks;
              let stageContractViolation = false;
              let stageCheck = deterministicNarrativeStateConsistencyCheck({
                narrativeStage,
                text: composedReply,
                stateUpdatedExpected
              });
              if (
                useAiValidators &&
                stageCheck.valid &&
                typeof validateNarrativeStateConsistency === "function"
              ) {
                stageCheck = await callAiWithBudget(
                  "validate-narrative-state-consistency",
                  () =>
                    validateNarrativeStateConsistency({
                      narrativeStage,
                      text: composedReply,
                      stateUpdatedExpected,
                      worldBefore,
                      worldAfter: safeWorldState,
                      conversationMode
                    }),
                  stageCheck
                );
              }
              if (stageCheck && stageCheck.valid === false) {
                stageContractViolation = true;
              }
              let continuity = null;
              let anchorDriftDetected = false;
              continuity = deterministicSceneFrameContinuityCheck({
                reply: composedReply,
                sceneFrame
              });
              if (
                useAiValidators &&
                continuity.valid &&
                typeof validateSceneFrameContinuityWithAI === "function" &&
                sceneFrame
              ) {
                continuity = await callAiWithBudget(
                  "validate-scene-frame-continuity",
                  () =>
                    validateSceneFrameContinuityWithAI({
                      reply: composedReply,
                      sceneFrame,
                      worldState: safeWorldState,
                      conversationMode
                    }),
                  continuity
                );
              }
              anchorDriftDetected = Boolean(continuity && continuity.valid === false);
              if (!stageContractViolation && !anchorDriftDetected) {
                return {
                  reply: composedReply,
                  mjStructured: tempered,
                  mjToolTrace,
                  phase12: {
                    continuityGuard: continuity,
                    anchorDriftDetected: false,
                    stageContractViolation: false,
                    regenerationCount
                  }
                };
              }
              lastContinuity = continuity;
              lastStageViolation = stageContractViolation;
              if (attempt < maxRegenerations) {
                regenerationCount += 1;
                continue;
              }
              const anchoredFallback = buildSceneFrameAnchoredFallbackReply(
                fallbackReply,
                sceneFrame,
                safeWorldState
              );
              return {
                reply: anchoredFallback || fallbackReply,
                mjStructured: null,
                mjToolTrace,
                phase12: {
                  continuityGuard: continuity,
                  anchorDriftDetected,
                  stageContractViolation,
                  regenerationCount
                }
              };
            }
            const anchoredFallback = buildSceneFrameAnchoredFallbackReply(
              fallbackReply,
              sceneFrame,
              safeWorldState
            );
            return {
              reply: anchoredFallback || fallbackReply,
              mjStructured: null,
              mjToolTrace: lastToolTrace,
              phase12: {
                continuityGuard: lastContinuity,
                anchorDriftDetected: Boolean(lastContinuity && lastContinuity.valid === false),
                stageContractViolation: Boolean(lastStageViolation),
                regenerationCount
              }
            };
          }
          const loadedWorldSnapshot = loadNarrativeWorldState();
          let worldSnapshot = applyCriticalMutation(loadedWorldSnapshot, {
            activeInterlocutor:
              loadedWorldSnapshot?.conversation?.activeInterlocutor == null
                ? null
                : String(loadedWorldSnapshot.conversation.activeInterlocutor),
            pendingAction: sanitizePendingAction(loadedWorldSnapshot?.conversation?.pendingAction),
            pendingTravel: sanitizePendingTravel(loadedWorldSnapshot?.conversation?.pendingTravel),
            pendingAccess: sanitizePendingAccess(loadedWorldSnapshot?.conversation?.pendingAccess),
            sceneFrame: sanitizeSceneFrame(
              loadedWorldSnapshot?.conversation?.sceneFrame,
              loadedWorldSnapshot
            )
          });
          let detectedInterlocutor = null;
          if (conversationMode === "rp") {
            detectedInterlocutor = extractInterlocutorFromMessage(message);
            if (detectedInterlocutor) {
              worldSnapshot = applyCriticalMutation(worldSnapshot, {
                activeInterlocutor: detectedInterlocutor
              });
            }
          }
          let activeInterlocutor =
            worldSnapshot?.conversation?.activeInterlocutor == null
              ? null
              : String(worldSnapshot.conversation.activeInterlocutor);
          const frameBefore = sanitizeSceneFrame(worldSnapshot?.conversation?.sceneFrame, worldSnapshot);
          let framePatch = null;
          const allowSceneFramePatch =
            conversationMode === "rp" &&
            useAiSceneFramePatch &&
            hasAiBudgetFor("fallback") &&
            (
              String(intent?.type ?? "") === "story_action" ||
              String(intent?.type ?? "") === "social_action" ||
              Boolean(detectedInterlocutor)
            ) &&
            typeof resolveSceneFramePatchWithAI === "function";
          if (allowSceneFramePatch) {
            framePatch = await callAiWithBudget(
              "resolve-scene-frame-patch",
              () =>
                resolveSceneFramePatchWithAI({
                  message,
                  worldState: worldSnapshot,
                  sceneFrame: frameBefore,
                  records,
                  conversationMode
                }),
              null
            );
          } else if (conversationMode === "rp" && useAiSceneFramePatch) {
            recordAiRouting("resolve-scene-frame-patch", "skipped", "gate-condition");
          }
          const frameConfidenceMin = Math.max(
            0,
            Math.min(1, Number(process.env.NARRATION_SCENE_FRAME_MIN_CONFIDENCE ?? 0.64))
          );
          const framePatchAccepted =
            framePatch && Number(framePatch.confidence ?? 0) >= frameConfidenceMin;
          const isSocialTurn = String(intent?.type ?? "") === "social_action";
          const keepCurrentInterlocutorAnchor =
            isSocialTurn && String(frameBefore.activeInterlocutorLabel ?? "").trim() && !detectedInterlocutor;
          const frameAfter = cleanSceneAnchors(
            framePatchAccepted
              ? {
                  ...frameBefore,
                  activePoiLabel: String(framePatch.activePoiLabel ?? frameBefore.activePoiLabel ?? ""),
                  activeInterlocutorLabel: String(
                    keepCurrentInterlocutorAnchor
                      ? frameBefore.activeInterlocutorLabel
                      : detectedInterlocutor ||
                          framePatch.activeInterlocutorLabel ||
                          frameBefore.activeInterlocutorLabel ||
                          ""
                  ),
                  activeTopic: String(framePatch.activeTopic ?? frameBefore.activeTopic ?? ""),
                  recentFacts:
                    Array.isArray(framePatch.recentFacts) && framePatch.recentFacts.length
                      ? framePatch.recentFacts
                      : frameBefore.recentFacts
                }
              : detectedInterlocutor
                ? {
                    ...frameBefore,
                    activeInterlocutorLabel: String(detectedInterlocutor)
                  }
                : frameBefore,
            worldSnapshot
          );
          worldSnapshot = applyCriticalMutation(worldSnapshot, {
            sceneFrame: frameAfter
          });
          if (framePatchAccepted && frameAfter.activeInterlocutorLabel && !activeInterlocutor) {
            worldSnapshot = applyCriticalMutation(worldSnapshot, {
              activeInterlocutor: frameAfter.activeInterlocutorLabel
            });
            activeInterlocutor = frameAfter.activeInterlocutorLabel;
          }
          if (characterProfile) {
            worldSnapshot = applyCriticalMutation(worldSnapshot, {
              characterSnapshot: characterProfile
            });
          }
    
          const rpContextPack =
            conversationMode === "rp" ? buildCharacterContextPack(characterProfile, worldSnapshot) : null;
          const canonicalContext = buildCanonicalNarrativeContext({
            worldState: worldSnapshot,
            contextPack: rpContextPack,
            characterProfile
          });
          let semanticWorldIntent = null;
          let semanticArbitrationDecision = null;
          let phase12WorldIntentConfidence = null;
          let pendingTravelGate = null;
          const buildPhase12Payload = (extra = {}) => ({
            frameBefore,
            framePatch,
            framePatchAccepted,
            frameAfter,
            intentArbitrationDecision: semanticArbitrationDecision,
            worldIntentConfidence: phase12WorldIntentConfidence,
            aiCallBudget: aiBudget.getSnapshot(8),
            aiRouting: aiRoutingController.getRoutingPayload(16),
            aiFeatureFlags: {
              ...aiFeatureFlags
            },
            memoryWindow: phase13MemoryTrace,
            ...extra
          });
          const allowPendingTravelArbitration =
            conversationMode === "rp" &&
            useAiPendingTravelArbitration &&
            hasAiBudgetFor("fallback") &&
            (worldSnapshot?.conversation?.pendingTravel || worldSnapshot?.travel?.pending) &&
            !isTravelConfirmation(message) &&
            typeof arbitratePendingTravelWithAI === "function";
          if (allowPendingTravelArbitration) {
            pendingTravelGate = await callAiWithBudget(
              "arbitrate-pending-travel",
              () =>
                arbitratePendingTravelWithAI({
                  message,
                  worldState: worldSnapshot,
                  conversationMode
                }),
              null
            );
          } else if (conversationMode === "rp" && useAiPendingTravelArbitration) {
            recordAiRouting("arbitrate-pending-travel", "skipped", "gate-condition");
          }
    
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
              let worldState = applyWorldDelta(worldSnapshot, worldDelta, {
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
              worldState = applyCriticalMutation(worldState, {
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: null,
                characterSnapshot: characterProfile
              });
              const resolvedReply = buildMjReplyBlocks({
                scene: resolution.scene,
                actionResult: resolution.actionResult,
                consequences: resolution.consequences,
                options: resolution.options
              });
              await persistNarrativeWorldStateWithPhase6(worldState, {
                runtimeAlreadyApplied: false,
                source: "rp-action-resolved",
                replyText: resolvedReply
              });
              return sendJson(res, 200, {
                reply: resolvedReply,
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
                phase12: buildPhase12Payload({
                  continuityGuard: null,
                  anchorDriftDetected: false,
                  stageContractViolation: false,
                  regenerationCount: 0
                }),
                stateUpdated: true
              });
            }
          }
    
          if (
            conversationMode === "rp" &&
            (worldSnapshot?.conversation?.pendingTravel || worldSnapshot?.travel?.pending) &&
            (
              String(pendingTravelGate?.action ?? "") === "confirm_pending" ||
              (pendingTravelGate == null && isTravelConfirmation(message))
            )
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
              worldState = applyCriticalMutation(worldState, {
                activeInterlocutor: null,
                pendingAction: null,
                pendingTravel: null,
                pendingAccess: null,
                characterSnapshot: characterProfile
              });
              const arrivalFrame = cleanSceneAnchors(
                {
                  locationId: String(worldState?.location?.id ?? ""),
                  locationLabel: String(worldState?.location?.label ?? ""),
                  activePoiLabel: "",
                  activeInterlocutorLabel: "",
                  activeTopic: "",
                  recentFacts: [`Arrivee: ${place.label}`]
                },
                worldState
              );
              worldState = applyCriticalMutation(worldState, {
                sceneFrame: arrivalFrame
              });
              const fallbackArrivalReply = buildArrivalPlaceReply(
                resolvedArrivalPlace,
                arrivalRecords,
                worldState
              );
              const aiArrival = await buildAiNarrativeReplyForBranch({
                worldState,
                fallbackReply: fallbackArrivalReply,
                sceneFrame: arrivalFrame,
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
                source: "travel-confirmed-ai",
                replyText: injected.reply,
                memoryRecords: arrivalRecords
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
                intent: {
                  type: "story_action",
                  semanticIntent: "move_place",
                  commitment: "declaratif",
                  confidence: 0.9,
                  reason: "travel-confirmed"
                },
                director: { mode: "scene_only", applyRuntime: false, source: "travel-flow" },
                worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "travel-confirmed" },
                worldState: injected.worldState,
                mjStructured: aiArrival.mjStructured,
                mjToolTrace: aiArrival.mjToolTrace,
                phase12: buildPhase12Payload(aiArrival.phase12 || {}),
                pendingGateDecision: pendingTravelGate,
                stateUpdated: true
              });
            }
          }

          if (
            conversationMode === "rp" &&
            (worldSnapshot?.conversation?.pendingTravel || worldSnapshot?.travel?.pending) &&
            String(pendingTravelGate?.action ?? "") === "cancel_pending"
          ) {
            const currentWorld = loadNarrativeWorldState();
            let worldState = applyWorldDelta(
              currentWorld,
              { reputationDelta: 0, localTensionDelta: 0, reason: "travel-cancelled" },
              { intentType: "system_command", transitionId: "travel.cancelled" }
            );
            worldState = applyCriticalMutation(worldState, {
              activeInterlocutor:
                worldSnapshot?.conversation?.activeInterlocutor == null
                  ? null
                  : String(worldSnapshot.conversation.activeInterlocutor),
              pendingAction: sanitizePendingAction(worldSnapshot?.conversation?.pendingAction),
              pendingTravel: null,
              pendingAccess: sanitizePendingAccess(worldSnapshot?.conversation?.pendingAccess),
              travelPending: null
            });
            const cancelReply = buildMjReplyBlocks({
              scene: "Tu choisis de ne pas partir tout de suite.",
              actionResult: "Le deplacement en attente est annule, et tu restes dans la scene actuelle.",
              consequences: "Tu peux reprendre une action locale quand tu veux.",
              options: ["Observer autour de toi", "Parler a quelqu'un", "Relancer un deplacement ensuite"]
            });
            await persistNarrativeWorldStateWithPhase6(worldState, {
              runtimeAlreadyApplied: false,
              source: "travel-cancelled",
              replyText: cancelReply
            });
            return sendJson(res, 200, {
              reply: cancelReply,
              mjResponse: makeMjResponse({
                responseType: "clarification",
                scene: "Le trajet est annule.",
                actionResult: "Aucun changement de lieu n'est applique.",
                consequences: "Tu restes sur place.",
                options: []
              }),
              speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
              intent: {
                type: "story_action",
                semanticIntent: "move_place",
                commitment: "declaratif",
                confidence: 0.86,
                reason: "travel-cancelled"
              },
              director: { mode: "scene_only", applyRuntime: false, source: "pending-gate" },
              worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "travel-cancelled" },
              worldState,
              pendingGateDecision: pendingTravelGate,
              phase12: buildPhase12Payload({
                continuityGuard: null,
                anchorDriftDetected: false,
                stageContractViolation: false,
                regenerationCount: 0
              }),
              stateUpdated: true
            });
          }
    
          const allowWorldArbitration =
            conversationMode === "rp" &&
            useAiWorldArbitration &&
            hasAiBudgetFor("primary") &&
            (
              String(directorPlan?.mode ?? "") !== "scene_only" ||
              Number(intent?.confidence ?? 0) <
                Number(process.env.NARRATION_WORLD_ARBITRATION_INTENT_CONFIDENCE_MAX ?? 0.74)
            );
          if (conversationMode === "rp") {
            if (allowWorldArbitration) {
            if (semanticWorldIntent === null && typeof detectWorldIntentWithAI === "function") {
              semanticWorldIntent = await callAiWithBudget(
                "detect-world-intent",
                () =>
                  detectWorldIntentWithAI({
                    message,
                    worldState: worldSnapshot,
                    records,
                    conversationMode
                  }),
                null,
                "primary"
              );
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
              phase12WorldIntentConfidence = Number(semanticWorldIntent?.confidence ?? 0);
            }
            const semanticArbitration =
              typeof arbitrateSceneIntentWithAI === "function"
                ? await callAiWithBudget(
                    "arbitrate-scene-intent",
                    () =>
                      arbitrateSceneIntentWithAI({
                        message,
                        worldState: worldSnapshot,
                        records,
                        conversationMode,
                        worldIntentHint: semanticWorldIntent
                      }),
                    null,
                    "primary"
                  )
                : null;
            semanticArbitrationDecision = semanticArbitration || null;
            const arbitrationMinConfidence = Math.max(
              0,
              Math.min(1, Number(process.env.NARRATION_SCENE_ARBITRATION_MIN_CONFIDENCE ?? 0.68))
            );
            if (
              semanticArbitration &&
              Number(semanticArbitration.confidence ?? 0) >= arbitrationMinConfidence
            ) {
              if (semanticArbitration.mode === "stay_and_scan" || semanticArbitration.mode === "social_focus") {
                semanticWorldIntent = {
                  type: "none",
                  targetLabel: "",
                  reason: `scene-arbitration:${semanticArbitration.mode}`,
                  confidence: Number(semanticArbitration.confidence ?? 0)
                };
                phase12WorldIntentConfidence = Number(semanticWorldIntent.confidence ?? 0);
              } else if (
                semanticArbitration.mode === "move_to_place" &&
                String(semanticWorldIntent?.type ?? "none") === "none"
              ) {
                semanticWorldIntent = {
                  type: "propose_travel",
                  targetLabel: String(semanticArbitration.targetLabel ?? "").trim(),
                  reason: "scene-arbitration:move-to-place",
                  confidence: Number(semanticArbitration.confidence ?? 0)
                };
                phase12WorldIntentConfidence = Number(semanticWorldIntent.confidence ?? 0);
              }
            }
            }
            if (
              semanticWorldIntent == null &&
              (String(intent?.semanticIntent ?? "") === "move_place" ||
                String(intent?.semanticIntent ?? "") === "enter_place")
            ) {
              const inferredTarget = inferPlaceFromMessage(message, records);
              if (String(inferredTarget ?? "").trim()) {
                semanticWorldIntent = {
                  type: "propose_travel",
                  targetLabel: String(inferredTarget).trim(),
                  reason: "semantic-fallback:move-enter",
                  confidence: 0.66
                };
                phase12WorldIntentConfidence = Number(semanticWorldIntent.confidence ?? 0);
              }
            }
            const spatialGuardTarget =
              String(semanticWorldIntent?.targetLabel ?? "").trim() || inferPlaceFromMessage(message, records);
            const spatialResolution = await resolveSpatialTargetRelation(worldSnapshot, spatialGuardTarget);
            const spatialMinConfidence = Math.max(
              0,
              Math.min(1, Number(process.env.NARRATION_SPATIAL_RESOLUTION_MIN_CONFIDENCE ?? 0.64))
            );
            if (
              spatialResolution &&
              Number(spatialResolution.confidence ?? 0) >= spatialMinConfidence &&
              (spatialResolution.relation === "local_poi" || spatialResolution.relation === "current_location")
            ) {
              semanticWorldIntent = {
                type: "none",
                targetLabel: "",
                reason: `spatial-resolution:${spatialResolution.relation}`,
                confidence: Number(spatialResolution.confidence ?? 0)
              };
              phase12WorldIntentConfidence = Number(semanticWorldIntent.confidence ?? 0);
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
            const visitIntentFromSemanticFallback =
              (semanticWorldIntent == null || String(semanticWorldIntent?.type ?? "none") === "none") &&
              (String(intent?.semanticIntent ?? "") === "move_place" ||
                String(intent?.semanticIntent ?? "") === "enter_place")
                ? (() => {
                    const label = inferPlaceFromMessage(message, records);
                    return String(label ?? "").trim()
                      ? {
                          type: "visit_semantic",
                          placeLabel: String(label).trim()
                        }
                      : null;
                  })()
                : null;
            const visitIntent =
              visitIntentFromAi ||
              visitIntentFromSemanticFallback ||
              ((semanticWorldIntent == null || String(semanticWorldIntent?.type ?? "none") === "none")
                ? extractVisitIntent(message, records)
                : null);
            if (visitIntent) {
              const currentWorld = loadNarrativeWorldState();
              let worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed" },
                { intentType: "system_command", transitionId: "travel.proposed" }
              );
              const place = resolveOrCreateSessionPlace(visitIntent.placeLabel, records, worldState);
              const fromLocation = sanitizeWorldLocation(worldState?.location);
              const toLocation = { id: place.id, label: place.label };
              const durationMin = estimateTravelMinutes(fromLocation, toLocation, "free_exploration");
              worldState = applyCriticalMutation(worldState, {
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
                pendingAccess: null,
                travelPending: {
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
              worldState = applyCriticalMutation(worldState, {
                characterSnapshot: characterProfile
              });
              const fallbackVisitReply = buildVisitAdvisoryReply(place, records, worldState);
              const aiVisit = await buildAiNarrativeReplyForBranch({
                worldState,
                fallbackReply: fallbackVisitReply,
                sceneFrame: frameAfter,
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
                source: "travel-proposed-ai",
                replyText: injected.reply
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
                intent: {
                  type: "story_action",
                  semanticIntent: "move_place",
                  commitment: "declaratif",
                  confidence: 0.86,
                  reason: "travel-proposed"
                },
                director: { mode: "scene_only", applyRuntime: false, source: "travel-flow" },
                worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed" },
                worldState: injected.worldState,
                mjStructured: aiVisit.mjStructured,
                mjToolTrace: aiVisit.mjToolTrace,
                phase12: buildPhase12Payload(aiVisit.phase12 || {}),
                stateUpdated: false
              });
            }
          } else if (conversationMode === "rp" && useAiWorldArbitration) {
            recordAiRouting("world-arbitration", "skipped", "gate-condition");
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
              let worldState = applyWorldDelta(
                currentWorld,
                accessOutcome.worldDelta,
                { intentType: "story_action", transitionId: accessOutcome.success ? "access.resolved" : "access.blocked" }
              );
              worldState = applyCriticalMutation(worldState, {
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
                    }),
                characterSnapshot: characterProfile
              });
              const injected = injectLockedStartContextReply(accessOutcome.reply, worldState, characterProfile);
              const accessParts = parseReplyToMjBlocks(injected.reply);
              await persistNarrativeWorldStateWithPhase6(injected.worldState, {
                runtimeAlreadyApplied: false,
                source: "access-resolution",
                replyText: injected.reply
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
                phase12: buildPhase12Payload({
                  continuityGuard: null,
                  anchorDriftDetected: false,
                  stageContractViolation: false,
                  regenerationCount: 0
                }),
                stateUpdated: true
              });
            }
          }
    
          if (conversationMode === "rp") {
            const currentPlace = getCurrentSessionPlace(worldSnapshot);
            const requiresGate = currentPlace?.access === "restricted" || currentPlace?.access === "sealed";
            if (requiresGate && isAccessProgressionIntent(message)) {
              const currentWorld = loadNarrativeWorldState();
              let worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "access-gate-proposed" },
                { intentType: "story_action", transitionId: "access.proposed" }
              );
              worldState = applyCriticalMutation(worldState, {
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
                }),
                characterSnapshot: characterProfile
              });
              const injected = injectLockedStartContextReply(
                buildAccessChallengeReply(currentPlace, message, rpContextPack, worldState),
                worldState,
                characterProfile
              );
              const accessChallengeParts = parseReplyToMjBlocks(injected.reply);
              await persistNarrativeWorldStateWithPhase6(injected.worldState, {
                runtimeAlreadyApplied: false,
                source: "access-gate-proposed",
                replyText: injected.reply
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
                phase12: buildPhase12Payload({
                  continuityGuard: null,
                  anchorDriftDetected: false,
                  stageContractViolation: false,
                  regenerationCount: 0
                }),
                stateUpdated: false
              });
            }
          }
    
          if (conversationMode === "rp" && useAiStructuredMain) {
            const mjStructuredDraft = await callAiWithBudget(
              "generate-mj-structured-main",
              () =>
                generateMjStructuredReply({
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
                }),
              null,
              "primary"
            );
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
              6,
              {
                intentType: String(intent?.type ?? "story_action"),
                semanticIntent: String(intent?.semanticIntent ?? ""),
                directorMode: String(directorPlan?.mode ?? "scene_only"),
                conversationMode,
                worldState: worldSnapshot,
                message
              }
            );
            const mjToolTrace = mjToolBus.executeToolCalls(plannedToolCalls, {
              message,
              records,
              worldState: worldSnapshot,
              canonicalContext,
              contextPack: rpContextPack,
              runtimeState: state,
              intent,
              directorPlan,
              pending: {
                action: worldSnapshot?.conversation?.pendingAction ?? null,
                travel: worldSnapshot?.travel?.pending ?? worldSnapshot?.conversation?.pendingTravel ?? null,
                access: worldSnapshot?.conversation?.pendingAccess ?? null
              }
            });
            const mjStructured = useAiRefine
              ? await callAiWithBudget(
                  "refine-mj-structured-main",
                  () =>
                    refineMjStructuredReplyWithTools({
                      message,
                      initialStructured: mjStructuredDraft,
                      toolResults: mjToolTrace,
                      worldState: worldSnapshot,
                      canonicalContext,
                      contextPack: rpContextPack,
                      activeInterlocutor: worldSnapshot?.conversation?.activeInterlocutor ?? null,
                      conversationMode
                    }),
                  mjStructuredDraft,
                  "primary"
                )
              : mjStructuredDraft;
            const worldIntentType = String(mjStructured?.worldIntent?.type ?? "none");
            if (worldIntentType === "propose_travel") {
              const targetFromAi = String(mjStructured?.worldIntent?.targetLabel ?? "").trim();
              const aiTargetLabel = targetFromAi || inferPlaceFromMessage(message, records) || "ce lieu";
              const currentWorld = loadNarrativeWorldState();
              const spatialResolution = await resolveSpatialTargetRelation(currentWorld, aiTargetLabel);
              const spatialMinConfidence = Math.max(
                0,
                Math.min(1, Number(process.env.NARRATION_SPATIAL_RESOLUTION_MIN_CONFIDENCE ?? 0.64))
              );
              const localTargetBySpatial =
                spatialResolution &&
                Number(spatialResolution.confidence ?? 0) >= spatialMinConfidence &&
                (spatialResolution.relation === "local_poi" ||
                  spatialResolution.relation === "current_location");
              if (localTargetBySpatial) {
                mjStructured.worldIntent = {
                  ...(mjStructured.worldIntent ?? {}),
                  type: "none",
                  reason: `spatial-resolution:${spatialResolution.relation}`,
                  targetLabel: ""
                };
              } else {
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
                  phase12: buildPhase12Payload({
                    continuityGuard: null,
                    anchorDriftDetected: false,
                    stageContractViolation: false,
                    regenerationCount: 0
                  }),
                  phase3LoreGuard: {
                    blocked: true,
                    violations: travelGuard.violations
                  },
                  stateUpdated: false
                });
              }
              let worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed-ai" },
                { intentType: "system_command", transitionId: "travel.proposed.ai" }
              );
              const place = resolveOrCreateSessionPlace(aiTargetLabel, records, worldState);
              const fromLocation = sanitizeWorldLocation(worldState?.location);
              const toLocation = { id: place.id, label: place.label };
              const durationMin = estimateTravelMinutes(fromLocation, toLocation, "free_exploration");
              worldState = applyCriticalMutation(worldState, {
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
                pendingAccess: sanitizePendingAccess(worldSnapshot?.conversation?.pendingAccess),
                travelPending: {
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
              worldState = applyCriticalMutation(worldState, {
                characterSnapshot: characterProfile
              });
              const advisoryDirect = String(mjStructured?.directAnswer ?? "").replace(/\s+/g, " ").trim();
              const fallbackAdvisory = advisoryDirect
                ? `${advisoryDirect}\n${buildVisitAdvisoryReply(place, records, worldState)}`
                : buildVisitAdvisoryReply(place, records, worldState);
              const aiTravelAdvisory = await buildAiNarrativeReplyForBranch({
                worldState,
                fallbackReply: fallbackAdvisory,
                sceneFrame: frameAfter,
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
                source: "ai-travel-proposed",
                replyText: injected.reply
              });
              return sendJson(res, 200, {
                reply: injected.reply,
                mjResponse: makeMjResponse({
                  responseType: "clarification",
                  directAnswer: String(mjStructured?.directAnswer ?? "").replace(/\s+/g, " ").trim(),
                  scene: aiTravelParts.scene,
                  actionResult: aiTravelParts.actionResult,
                  consequences: aiTravelParts.consequences,
                  options: aiTravelParts.options
                }),
                speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
                intent: {
                  type: "story_action",
                  semanticIntent: "move_place",
                  commitment: "declaratif",
                  confidence: Number(mjStructured?.confidence ?? 0.82),
                  reason: "ai-worldintent-propose-travel"
                },
                director: { mode: "scene_only", applyRuntime: false, source: "ai-mj-structured" },
                worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed-ai" },
                worldState: injected.worldState,
                mjStructured: aiTravelAdvisory.mjStructured ?? mjStructured,
                mjToolTrace: aiTravelAdvisory.mjToolTrace ?? mjToolTrace,
                phase12: buildPhase12Payload(aiTravelAdvisory.phase12 || {}),
                stateUpdated: false
              });
              }
            }
            const shouldShortCircuit =
              Boolean(mjStructured) &&
              Boolean(mjStructured.bypassExistingMechanics) &&
              String(mjStructured?.worldIntent?.type ?? "none") === "none";
            if (shouldShortCircuit) {
              const currentWorld = loadNarrativeWorldState();
              let worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "mj-structured-scene" },
                { intentType: "lore_question", transitionId: "none" }
              );
              worldState = applyCriticalMutation(worldState, {
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: sanitizePendingAction(worldSnapshot?.conversation?.pendingAction),
                pendingTravel: sanitizePendingTravel(worldSnapshot?.conversation?.pendingTravel),
                pendingAccess: sanitizePendingAccess(worldSnapshot?.conversation?.pendingAccess),
                characterSnapshot: characterProfile
              });
              const injected = injectLockedStartContextReply(
                buildMjReplyFromStructured(mjStructured),
                worldState,
                characterProfile
              );
              await persistNarrativeWorldStateWithPhase6(injected.worldState, {
                runtimeAlreadyApplied: false,
                source: "mj-structured-shortcircuit",
                replyText: injected.reply
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
                phase12: buildPhase12Payload({
                  continuityGuard: null,
                  anchorDriftDetected: false,
                  stageContractViolation: false,
                  regenerationCount: 0
                }),
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
            let worldState = applyWorldDelta(
              loadNarrativeWorldState(),
              { reputationDelta: 0, localTensionDelta: 0, reason: "rp-sheet-query" },
              { intentType: "lore_question", transitionId: "none" }
            );
            worldState = applyCriticalMutation(worldState, {
              characterSnapshot: characterProfile,
              activeInterlocutor:
                worldSnapshot?.conversation?.activeInterlocutor == null
                  ? null
                  : String(worldSnapshot.conversation.activeInterlocutor)
            });
            const rpSheetReply = buildRpSheetAwareReply(message, characterProfile, worldState);
            await persistNarrativeWorldStateWithPhase6(worldState, {
              runtimeAlreadyApplied: false,
              source: "rp-sheet-query",
              replyText: rpSheetReply
            });
            return sendJson(res, 200, {
              reply: rpSheetReply,
              mjResponse: makeMjResponse({
                responseType: "status",
                directAnswer: rpSheetReply
              }),
              speaker: buildSpeakerPayload({ conversationMode, intentType: "lore_question" }),
              intent: { type: "lore_question", confidence: 0.85, reason: "rp-sheet-query" },
              director: { mode: "scene_only", applyRuntime: false, source: "policy" },
              worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "rp-sheet-query" },
              worldState,
              phase12: buildPhase12Payload({
                continuityGuard: null,
                anchorDriftDetected: false,
                stageContractViolation: false,
                regenerationCount: 0
              }),
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
              let worldState = applyWorldDelta(
                currentWorld,
                { reputationDelta: 0, localTensionDelta: 0, reason: "rp-action-validation" },
                { intentType: "story_action", transitionId: "none" }
              );
              worldState = applyCriticalMutation(worldState, {
                characterSnapshot: characterProfile,
                activeInterlocutor:
                  worldSnapshot?.conversation?.activeInterlocutor == null
                    ? null
                    : String(worldSnapshot.conversation.activeInterlocutor),
                pendingAction: sanitizePendingAction({
                  ...rpActionAssessment,
                  createdAt: new Date().toISOString()
                })
              });
              const actionValidationReply = buildRpActionValidationReply(rpActionAssessment);
              await persistNarrativeWorldStateWithPhase6(worldState, {
                runtimeAlreadyApplied: false,
                source: "rp-action-validation",
                replyText: actionValidationReply
              });
              return sendJson(res, 200, {
                reply: actionValidationReply,
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
                phase12: buildPhase12Payload({
                  continuityGuard: null,
                  anchorDriftDetected: false,
                  stageContractViolation: false,
                  regenerationCount: 0
                }),
                stateUpdated: false
              });
            }
          }
    
          const shouldRunClassifier =
            useAiClassifier &&
            hasAiBudgetFor("primary") &&
            String(directorPlan?.source ?? "heuristic") === "heuristic" &&
            Number(intent?.confidence ?? 0) <
              Number(process.env.NARRATION_CLASSIFIER_INTENT_CONFIDENCE_MAX ?? 0.72);
          const aiDecision = shouldRunClassifier
            ? await callAiWithBudget(
                "classify-narration",
                () => classifyNarrationWithAI(message, records, worldSnapshot),
                null,
                "primary"
              )
            : null;
          if (!shouldRunClassifier && conversationMode === "rp" && useAiClassifier) {
            recordAiRouting("classify-narration", "skipped", "gate-condition");
          }
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
          const arbitrationConfidence = Number(semanticArbitrationDecision?.confidence ?? 0);
          const arbitrationMode = String(semanticArbitrationDecision?.mode ?? "");
          const hasLiveSceneFocus = Boolean(
            String(frameAfter?.activeInterlocutorLabel ?? "").trim() ||
              String(frameAfter?.activePoiLabel ?? "").trim() ||
              String(activeInterlocutor ?? "").trim()
          );
          if (
            conversationMode === "rp" &&
            hasLiveSceneFocus &&
            arbitrationMode === "social_focus" &&
            arbitrationConfidence >= 0.68 &&
            (directorPlan.mode === "lore" || directorPlan.mode === "exploration")
          ) {
            intent = {
              ...intent,
              type: "story_action",
              confidence: Math.max(Number(intent?.confidence ?? 0.6), arbitrationConfidence),
              reason: "phase12-social-focus-continuity"
            };
            directorPlan = {
              mode: "scene_only",
              applyRuntime: false,
              source: "phase12-social-focus-continuity"
            };
          }
          const loreQuestion = directorPlan.mode === "lore";
          const freeExploration = directorPlan.mode === "exploration";
    
          if (loreQuestion) {
            const currentWorld = loadNarrativeWorldState();
            let worldState = applyWorldDelta(
              currentWorld,
              { reputationDelta: 0, localTensionDelta: 0, reason: "no-impact-intent" },
              { intentType: intent.type, transitionId: "none" }
            );
            worldState = applyCriticalMutation(worldState, {
              characterSnapshot: characterProfile,
              activeInterlocutor: activeInterlocutor
            });
            const worldDelta = {
              reputationDelta: 0,
              localTensionDelta: 0,
              reason: "no-impact-intent"
            };
            let mjToolTrace = [];
            let mjStructuredLore = null;
            let loreReply = buildLoreOnlyReply(message, records, characterProfile, worldState);
            if (conversationMode === "rp" && useAiStructuredLore) {
              const structuredDraft = await callAiWithBudget(
                "generate-mj-structured-lore",
                () =>
                  generateMjStructuredReply({
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
                  }),
                null
              );
              const lorePriorityCalls = mergeToolCalls(
                Array.isArray(structuredDraft?.toolCalls) ? structuredDraft.toolCalls : [],
                [
                  { name: "get_world_state", args: {} },
                  { name: "session_db_read", args: { scope: "scene-memory" } },
                  { name: "query_lore", args: { query: message, limit: 4 } }
                ],
                6,
                {
                  intentType: String(intent?.type ?? "lore_question"),
                  semanticIntent: String(intent?.semanticIntent ?? ""),
                  directorMode: String(directorPlan?.mode ?? "lore"),
                  conversationMode,
                  worldState,
                  message
                }
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
                intent,
                directorPlan,
                pending: {
                  action: worldState?.conversation?.pendingAction ?? null,
                  travel: worldState?.travel?.pending ?? worldState?.conversation?.pendingTravel ?? null,
                  access: worldState?.conversation?.pendingAccess ?? null
                }
              });
              mjStructuredLore = useAiRefine
                ? await callAiWithBudget(
                    "refine-mj-structured-lore",
                    () =>
                      refineMjStructuredReplyWithTools({
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
                      }),
                    structuredDraft
                  )
                : structuredDraft;
              if (mjStructuredLore) {
                const direct = String(mjStructuredLore?.directAnswer ?? "").replace(/\s+/g, " ").trim();
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
              source: "lore-only",
              replyText: injected.reply
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
              phase12: buildPhase12Payload({
                continuityGuard: null,
                anchorDriftDetected: false,
                stageContractViolation: false,
                regenerationCount: 0
              }),
              loreOnly: true,
              stateUpdated: false
            });
          }
    
          if (freeExploration) {
            const currentWorld = loadNarrativeWorldState();
            let worldState = applyWorldDelta(
              currentWorld,
              { reputationDelta: 0, localTensionDelta: 0, reason: "no-impact-intent" },
              { intentType: intent.type, transitionId: "none" }
            );
            worldState = applyCriticalMutation(worldState, {
              characterSnapshot: characterProfile,
              activeInterlocutor: activeInterlocutor
            });
            const worldDelta = {
              reputationDelta: 0,
              localTensionDelta: 0,
              reason: "no-impact-intent"
            };
            const fallbackExplorationReply = buildExplorationReply(message, records, worldState);
            const aiExploration = await buildAiNarrativeReplyForBranch({
              worldState,
              fallbackReply: fallbackExplorationReply,
              sceneFrame: frameAfter,
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
              source: "exploration-only",
              replyText: injected.reply
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
              phase12: buildPhase12Payload(aiExploration.phase12 || {}),
              explorationOnly: true,
              stateUpdated: false
            });
          }

          const intentCommitment = normalizeCommitment(intent);
          if (shouldHandleHypotheticalCommitment({ conversationMode, intent })) {
            const currentWorld = loadNarrativeWorldState();
            const worldDelta = { reputationDelta: 0, localTensionDelta: 0, reason: "commitment-hypothetique" };
            let worldState = applyWorldDelta(currentWorld, worldDelta, {
              intentType: intent.type,
              transitionId: "none"
            });
            worldState = applyCriticalMutation(worldState, {
              characterSnapshot: characterProfile,
              activeInterlocutor: activeInterlocutor
            });

            const guidance = [
              "Ton intention est comprise, mais elle reste hypothetique.",
              "Formule une action directe pour que je l'execute maintenant."
            ].join("\n");
            const fallbackClarification = addInterlocutorNote(
              `${guidance}\n${buildDirectorNoRuntimeReply(message, intent.type, records)}`,
              activeInterlocutor,
              intent.type,
              worldState,
              message
            );
            const aiClarification = await buildAiNarrativeReplyForBranch({
              worldState,
              fallbackReply: fallbackClarification,
              sceneFrame: frameAfter,
              narrativeStage: "scene",
              stateUpdatedExpected: false,
              worldBefore: worldSnapshot,
              priorityToolCalls: [
                { name: "get_world_state", args: {} },
                { name: "session_db_read", args: { scope: "scene-memory" } },
                { name: "query_lore", args: { query: message, limit: 3 } }
              ]
            });
            const injected = injectLockedStartContextReply(
              aiClarification.reply || fallbackClarification,
              worldState,
              characterProfile
            );
            const clarificationParts = parseReplyToMjBlocks(injected.reply);
            await persistNarrativeWorldStateWithPhase6(injected.worldState, {
              runtimeAlreadyApplied: false,
              source: "commitment-hypothetique",
              replyText: injected.reply
            });

            return sendJson(res, 200, {
              reply: injected.reply,
              mjResponse: makeMjResponse({
                responseType: "clarification",
                scene: clarificationParts.scene,
                actionResult: clarificationParts.actionResult,
                consequences: clarificationParts.consequences,
                options: clarificationParts.options
              }),
              speaker: buildSpeakerPayload({
                conversationMode,
                intentType: intent.type,
                activeInterlocutor
              }),
              loreRecordsUsed: records.length,
              intent: {
                ...intent,
                commitment: intentCommitment,
                reason: String(intent?.reason ?? "commitment-hypothetique")
              },
              director: { ...directorPlan, mode: "scene_only", applyRuntime: false, source: "commitment-gate" },
              worldDelta,
              worldState: injected.worldState,
              mjStructured: aiClarification.mjStructured,
              mjToolTrace: aiClarification.mjToolTrace,
              phase12: buildPhase12Payload(aiClarification.phase12 || {}),
              stateUpdated: false
            });
          }
          if (shouldHandleInformativeCommitment({ conversationMode, intent })) {
            const currentWorld = loadNarrativeWorldState();
            const worldDelta = { reputationDelta: 0, localTensionDelta: 0, reason: "commitment-informatif" };
            let worldState = applyWorldDelta(currentWorld, worldDelta, {
              intentType: intent.type,
              transitionId: "none"
            });
            worldState = applyCriticalMutation(worldState, {
              characterSnapshot: characterProfile,
              activeInterlocutor: activeInterlocutor
            });

            const guidance = [
              "Je traite ton message comme informatif (question/description).",
              "Aucune mutation runtime n'est appliquee sur ce tour."
            ].join("\n");
            const fallbackInformative = addInterlocutorNote(
              `${guidance}\n${buildDirectorNoRuntimeReply(message, intent.type, records)}`,
              activeInterlocutor,
              intent.type,
              worldState,
              message
            );
            const aiInformative = await buildAiNarrativeReplyForBranch({
              worldState,
              fallbackReply: fallbackInformative,
              sceneFrame: frameAfter,
              narrativeStage: "scene",
              stateUpdatedExpected: false,
              worldBefore: worldSnapshot,
              priorityToolCalls: [
                { name: "get_world_state", args: {} },
                { name: "session_db_read", args: { scope: "scene-memory" } },
                { name: "query_lore", args: { query: message, limit: 3 } }
              ]
            });
            const injected = injectLockedStartContextReply(
              aiInformative.reply || fallbackInformative,
              worldState,
              characterProfile
            );
            const informativeParts = parseReplyToMjBlocks(injected.reply);
            await persistNarrativeWorldStateWithPhase6(injected.worldState, {
              runtimeAlreadyApplied: false,
              source: "commitment-informatif",
              replyText: injected.reply
            });

            return sendJson(res, 200, {
              reply: injected.reply,
              mjResponse: makeMjResponse({
                responseType: "narration",
                scene: informativeParts.scene,
                actionResult: informativeParts.actionResult,
                consequences: informativeParts.consequences,
                options: informativeParts.options
              }),
              speaker: buildSpeakerPayload({
                conversationMode,
                intentType: intent.type,
                activeInterlocutor
              }),
              loreRecordsUsed: records.length,
              intent: {
                ...intent,
                commitment: intentCommitment,
                reason: String(intent?.reason ?? "commitment-informatif")
              },
              director: { ...directorPlan, mode: "scene_only", applyRuntime: false, source: "commitment-gate" },
              worldDelta,
              worldState: injected.worldState,
              mjStructured: aiInformative.mjStructured,
              mjToolTrace: aiInformative.mjToolTrace,
              phase12: buildPhase12Payload(aiInformative.phase12 || {}),
              stateUpdated: false
            });
          }

          const commitmentForAction = normalizeCommitment(intent);
          const forceRuntimeByCommitment = shouldForceRuntimeByCommitment({ conversationMode, intent });
          const runtimeAllowedByDirector = Boolean(directorPlan.applyRuntime) || forceRuntimeByCommitment;
          const heuristicRuntimeGate =
            directorPlan.source === "heuristic" ? shouldApplyRuntimeForIntent(message, intent) : true;
          const runtimeEligibility =
            conversationMode === "rp" &&
            useAiRuntimeEligibility &&
            hasAiBudgetFor("primary") &&
            typeof assessRuntimeEligibilityWithAI === "function"
              ? await callAiWithBudget(
                  "assess-runtime-eligibility",
                  () =>
                    assessRuntimeEligibilityWithAI({
                      message,
                      intent,
                      directorPlan,
                      worldState: worldSnapshot,
                      records,
                      conversationMode
                    }),
                  null,
                  "primary"
                )
              : null;
          if (
            conversationMode === "rp" &&
            useAiRuntimeEligibility &&
            (!hasAiBudgetFor("primary") || typeof assessRuntimeEligibilityWithAI !== "function")
          ) {
            recordAiRouting("assess-runtime-eligibility", "skipped", "gate-condition");
          }
          const runtimeEligibilityMin = Math.max(
            0,
            Math.min(1, Number(process.env.NARRATION_RUNTIME_ELIGIBILITY_MIN_CONFIDENCE ?? 0.62))
          );
          const semanticRuntimeGate =
            runtimeEligibility == null
              ? true
              : Number(runtimeEligibility.confidence ?? 0) >= runtimeEligibilityMin
                ? Boolean(runtimeEligibility.eligible)
                : true;
          if (shouldClarifyTargetFromCommitment({ forceRuntimeByCommitment, semanticRuntimeGate })) {
            const currentWorld = loadNarrativeWorldState();
            const worldDelta = {
              reputationDelta: 0,
              localTensionDelta: 0,
              reason: "commitment-action-needs-target-clarification"
            };
            let worldState = applyWorldDelta(currentWorld, worldDelta, {
              intentType: intent.type,
              transitionId: "none"
            });
            worldState = applyCriticalMutation(worldState, {
              characterSnapshot: characterProfile,
              activeInterlocutor: activeInterlocutor
            });
            const clarificationReply = addInterlocutorNote(
              "Ton action est comprise et je peux l'executer, mais la cible reste ambigue. Precise le lieu, la personne ou l'objet vise pour que je lance l'action.",
              activeInterlocutor,
              intent.type,
              worldState,
              message
            );
            await persistNarrativeWorldStateWithPhase6(worldState, {
              runtimeAlreadyApplied: false,
              source: "commitment-target-clarification",
              replyText: clarificationReply
            });
            return sendJson(res, 200, {
              reply: clarificationReply,
              mjResponse: makeMjResponse({
                responseType: "clarification",
                directAnswer: "",
                scene: "L'action est recevable mais la cible doit etre precisee.",
                actionResult: "Aucune mutation runtime tant que la cible n'est pas resolue.",
                consequences: "Le contexte de scene est conserve.",
                options: ["Preciser le lieu vise", "Preciser l'interlocuteur", "Reformuler l'action directement"]
              }),
              speaker: buildSpeakerPayload({
                conversationMode,
                intentType: intent.type,
                activeInterlocutor
              }),
              loreRecordsUsed: records.length,
              intent: {
                ...intent,
                commitment: commitmentForAction,
                reason: String(intent?.reason ?? "commitment-action-clarification")
              },
              director: { ...directorPlan, mode: "scene_only", applyRuntime: false, source: "commitment-gate" },
              worldDelta,
              worldState,
              runtimeEligibilityDecision: runtimeEligibility,
              phase12: buildPhase12Payload({
                continuityGuard: null,
                anchorDriftDetected: false,
                stageContractViolation: false,
                regenerationCount: 0
              }),
              stateUpdated: false
            });
          }
          if (requiresInterlocutorInRp(intent, message, activeInterlocutor)) {
            const currentWorld = applyCriticalMutation(loadNarrativeWorldState(), {
              activeInterlocutor: null
            });
            await persistNarrativeWorldStateWithPhase6(currentWorld, {
              runtimeAlreadyApplied: false,
              source: "missing-interlocutor",
              replyText: buildRpNeedInterlocutorReply(records)
            });
            return sendJson(res, 200, {
              reply: buildRpNeedInterlocutorReply(records),
              speaker: buildSpeakerPayload({ conversationMode, intentType: "social_action" }),
              loreRecordsUsed: records.length,
              intent,
              director: { ...directorPlan, mode: "scene_only", applyRuntime: false },
              worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "missing-interlocutor" },
              worldState: currentWorld,
              phase12: buildPhase12Payload({
                continuityGuard: null,
                anchorDriftDetected: false,
                stageContractViolation: false,
                regenerationCount: 0
              }),
              stateUpdated: false
            });
          }
    
          if (!runtimeAllowedByDirector || !heuristicRuntimeGate || !semanticRuntimeGate) {
            const currentWorld = loadNarrativeWorldState();
            const worldDelta =
              typeof computeSceneOnlyDelta === "function"
                ? computeSceneOnlyDelta(intent)
                : intent?.type === "story_action" && String(intent?.riskLevel ?? "") === "high"
                ? { reputationDelta: 0, localTensionDelta: 2, reason: "scene-only-combat-pressure" }
                : { reputationDelta: 0, localTensionDelta: 0, reason: "scene-only-no-runtime-trigger" };
            let worldState = applyWorldDelta(currentWorld, worldDelta, {
              intentType: intent.type,
              transitionId: "none"
            });
            worldState = applyCriticalMutation(worldState, {
              characterSnapshot: characterProfile,
              activeInterlocutor: activeInterlocutor
            });
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
              sceneFrame: frameAfter,
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
              source: "scene-only",
              replyText: injected.reply
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
              runtimeEligibilityDecision: runtimeEligibility,
              phase12: buildPhase12Payload(aiSceneOnly.phase12 || {}),
              stateUpdated: true
            });
          }
    
          const currentWorld = loadNarrativeWorldState();
          const worldDelta =
            typeof computeSceneOnlyDelta === "function"
              ? computeSceneOnlyDelta(intent)
              : { reputationDelta: 0, localTensionDelta: 0, reason: "scene-only-no-runtime-trigger" };
          let worldState = applyWorldDelta(currentWorld, worldDelta, {
            intentType: intent.type,
            transitionId: "none"
          });
          worldState = applyCriticalMutation(worldState, {
            characterSnapshot: characterProfile,
            activeInterlocutor: activeInterlocutor
          });
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
            sceneFrame: frameAfter,
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
            source: "runtime-main-disabled-scene-only",
            replyText: injected.reply
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
            director: { ...directorPlan, mode: "scene_only", applyRuntime: false, source: "runtime-fallback-disabled" },
            worldDelta,
            worldState: injected.worldState,
            mjStructured: aiSceneOnly.mjStructured,
            mjToolTrace: aiSceneOnly.mjToolTrace,
            runtimeEligibilityDecision: runtimeEligibility,
            phase12: buildPhase12Payload(aiSceneOnly.phase12 || {}),
            stateUpdated: false
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


