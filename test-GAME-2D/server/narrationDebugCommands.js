"use strict";

function createNarrationDebugCommands(deps = {}) {
  const {
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
  } = deps;

  function buildSystemPayload({ reply, reason, worldState, conversationMode, intent, directorPlan, extra = {} }) {
    return {
      reply,
      mjResponse: makeMjResponse({
        responseType: "status",
        directAnswer: reply
      }),
      speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
      intent: { ...intent, type: "system_command", reason },
      director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
      worldState,
      stateUpdated: false,
      ...extra
    };
  }

  function tryHandle({ message, characterProfile, conversationMode, intent, directorPlan }) {
    const command = String(message ?? "").trim().toLowerCase();
    if (!command.endsWith("-debug") && command !== "/contract-debug" && command !== "/profile-debug" && command !== "/context-debug" && command !== "/rules-debug") {
      return null;
    }

    if (command === "/profile-debug") {
      const worldState = loadNarrativeWorldState();
      const profileDiag = buildCharacterProfileDiagnostics(characterProfile, worldState);
      return buildSystemPayload({
        reply: profileDiag,
        reason: "profile-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan
      });
    }

    if (command === "/context-debug") {
      const worldState = loadNarrativeWorldState();
      const contextDiag = buildCharacterContextDiagnostics(characterProfile, worldState);
      const contextPack = buildCharacterContextPack(characterProfile, worldState);
      const canonicalDiag = buildCanonicalContextDiagnostics(characterProfile, worldState, contextPack);
      return buildSystemPayload({
        reply: `${contextDiag}\n\n${canonicalDiag}`,
        reason: "context-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan
      });
    }

    if (command === "/rules-debug") {
      const worldState = loadNarrativeWorldState();
      const rulesDiag = buildCharacterRulesDiagnostics(characterProfile, worldState);
      return buildSystemPayload({
        reply: rulesDiag,
        reason: "rules-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan
      });
    }

    if (command === "/contract-debug") {
      const worldState = loadNarrativeWorldState();
      const stats = buildMjContractStatsPayload();
      const sourceParts = Object.entries(stats.bySource)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .map(([source, count]) => `${source}: ${count}`)
        .join(" | ");
      const summary = `Contrats MJ observes: ${stats.total} | Sources: ${sourceParts || "aucune"}`;
      return buildSystemPayload({
        reply: summary,
        reason: "contract-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan,
        extra: { contractStats: stats }
      });
    }

    if (command === "/phase1-debug") {
      const worldState = loadNarrativeWorldState();
      const stats = buildMjContractStatsPayload();
      const sourceParts = Object.entries(stats.bySource)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .map(([source, count]) => `${source}: ${count}`)
        .join(" | ");
      const grounding = stats.grounding ?? {};
      const summary = [
        "Phase1 DoD (tool-grounding)",
        `NarrativeTurns: ${grounding.narrativeTurns ?? 0}`,
        `GroundedTurns: ${grounding.groundedTurns ?? 0}`,
        `UngroundedTurns: ${grounding.ungroundedTurns ?? 0}`,
        `GroundingRate: ${grounding.groundingRatePct ?? 0}%`,
        `ContractSources: ${sourceParts || "aucune"}`
      ].join(" | ");
      return buildSystemPayload({
        reply: summary,
        reason: "phase1-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan,
        extra: {
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
          }
        }
      });
    }

    if (command === "/phase2-debug") {
      const worldState = loadNarrativeWorldState();
      const stats = buildMjContractStatsPayload();
      const sourceParts = Object.entries(stats.bySource)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .map(([source, count]) => `${source}: ${count}`)
        .join(" | ");
      const phase2 = stats.phase2 ?? {};
      const summary = [
        "Phase2 DoD (canonical context)",
        `NarrativeTurns: ${phase2.narrativeTurns ?? 0}`,
        `CanonicalReads(get_world_state): ${phase2.canonicalReads ?? 0}`,
        `NoCanonicalReads: ${phase2.noCanonicalReads ?? 0}`,
        `CanonicalReadRate: ${phase2.canonicalReadRatePct ?? 0}%`,
        `ContractSources: ${sourceParts || "aucune"}`
      ].join(" | ");
      return buildSystemPayload({
        reply: summary,
        reason: "phase2-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan,
        extra: {
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
          }
        }
      });
    }

    if (command === "/phase3-debug") {
      const worldState = loadNarrativeWorldState();
      const phase3 = buildPhase3GuardStatsPayload();
      const phase3Critical =
        typeof buildPhase3CriticalMutationStatsPayload === "function"
          ? buildPhase3CriticalMutationStatsPayload()
          : { totalCalls: 0, byField: {}, bySource: {}, recent: [] };
      const summary = [
        "Phase3 DoD (lore guards)",
        `CheckedTurns: ${phase3.checkedTurns ?? 0}`,
        `BlockedTurns: ${phase3.blockedTurns ?? 0}`,
        `PassTurns: ${phase3.passTurns ?? 0}`,
        `BlockRate: ${phase3.blockRatePct ?? 0}%`,
        `CriticalMutations: ${Number(phase3Critical.totalCalls ?? 0)}`
      ].join(" | ");
      return buildSystemPayload({
        reply: summary,
        reason: "phase3-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan,
        extra: {
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
            recent: Array.isArray(phase3.recent) ? phase3.recent : [],
            criticalMutations: {
              totalCalls: Number(phase3Critical.totalCalls ?? 0),
              byField: phase3Critical.byField ?? {},
              bySource: phase3Critical.bySource ?? {},
              recent: Array.isArray(phase3Critical.recent) ? phase3Critical.recent : []
            }
          }
        }
      });
    }

    if (command === "/phase4-debug") {
      const worldState = loadNarrativeWorldState();
      const phase4 =
        typeof buildPhase4SessionStatsPayload === "function"
          ? buildPhase4SessionStatsPayload()
          : { counts: {}, recent: [] };
      const phase4AiBudget =
        typeof buildPhase4AiBudgetStatsPayload === "function"
          ? buildPhase4AiBudgetStatsPayload()
          : {
              turnsWithBudget: 0,
              blockedTurns: 0,
              overBudgetTurns: 0,
              blockedRatePct: 0,
              overBudgetRatePct: 0,
              totalUsed: 0,
              totalMax: 0,
              primaryUsed: 0,
              primaryMax: 0,
              fallbackUsed: 0,
              fallbackMax: 0,
              totalBlocked: 0,
              primaryBlocked: 0,
              fallbackBlocked: 0,
              recent: []
            };
      const phase4AiRouting =
        typeof buildPhase4AiRoutingStatsPayload === "function"
          ? buildPhase4AiRoutingStatsPayload()
          : {
              turnsWithRouting: 0,
              attempted: 0,
              executed: 0,
              skipped: 0,
              executionRatePct: 0,
              byLabel: {},
              recent: []
            };
      const counts = phase4?.counts ?? {};
      const summary = [
        "Phase4 DoD (session DB narrative)",
        `placesDiscovered: ${Number(counts.placesDiscovered ?? 0)}`,
        `sessionNpcs: ${Number(counts.sessionNpcs ?? 0)}`,
        `establishedFacts: ${Number(counts.establishedFacts ?? 0)}`,
        `rumors: ${Number(counts.rumors ?? 0)}`,
        `debtsPromises: ${Number(counts.debtsPromises ?? 0)}`,
        `AI budget blockedRate: ${Number(phase4AiBudget?.blockedRatePct ?? 0)}%`,
        `AI routing executionRate: ${Number(phase4AiRouting?.executionRatePct ?? 0)}%`
      ].join(" | ");
      return buildSystemPayload({
        reply: summary,
        reason: "phase4-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan,
        extra: {
          phase4: {
            dod: {
              sessionDbEnabled: true,
              placesDiscovered: Number(counts.placesDiscovered ?? 0),
              sessionNpcs: Number(counts.sessionNpcs ?? 0),
              establishedFacts: Number(counts.establishedFacts ?? 0),
              rumors: Number(counts.rumors ?? 0),
              debtsPromises: Number(counts.debtsPromises ?? 0)
            },
            aiBudget: {
              turnsWithBudget: Number(phase4AiBudget?.turnsWithBudget ?? 0),
              blockedTurns: Number(phase4AiBudget?.blockedTurns ?? 0),
              overBudgetTurns: Number(phase4AiBudget?.overBudgetTurns ?? 0),
              blockedRatePct: Number(phase4AiBudget?.blockedRatePct ?? 0),
              overBudgetRatePct: Number(phase4AiBudget?.overBudgetRatePct ?? 0),
              totalUsed: Number(phase4AiBudget?.totalUsed ?? 0),
              totalMax: Number(phase4AiBudget?.totalMax ?? 0),
              primaryUsed: Number(phase4AiBudget?.primaryUsed ?? 0),
              primaryMax: Number(phase4AiBudget?.primaryMax ?? 0),
              fallbackUsed: Number(phase4AiBudget?.fallbackUsed ?? 0),
              fallbackMax: Number(phase4AiBudget?.fallbackMax ?? 0),
              totalBlocked: Number(phase4AiBudget?.totalBlocked ?? 0),
              primaryBlocked: Number(phase4AiBudget?.primaryBlocked ?? 0),
              fallbackBlocked: Number(phase4AiBudget?.fallbackBlocked ?? 0),
              recent: Array.isArray(phase4AiBudget?.recent) ? phase4AiBudget.recent : []
            },
            aiRouting: {
              turnsWithRouting: Number(phase4AiRouting?.turnsWithRouting ?? 0),
              attempted: Number(phase4AiRouting?.attempted ?? 0),
              executed: Number(phase4AiRouting?.executed ?? 0),
              skipped: Number(phase4AiRouting?.skipped ?? 0),
              executionRatePct: Number(phase4AiRouting?.executionRatePct ?? 0),
              byLabel: phase4AiRouting?.byLabel ?? {},
              recent: Array.isArray(phase4AiRouting?.recent) ? phase4AiRouting.recent : []
            },
            updatedAt: String(phase4?.updatedAt ?? ""),
            recent: Array.isArray(phase4?.recent) ? phase4.recent : []
          }
        }
      });
    }

    if (command === "/phase5-debug") {
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
      return buildSystemPayload({
        reply: summary,
        reason: "phase5-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan,
        extra: {
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
          }
        }
      });
    }

    if (command === "/phase6-debug") {
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
      return buildSystemPayload({
        reply: summary,
        reason: "phase6-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan,
        extra: {
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
          }
        }
      });
    }

    if (command === "/phase7-debug") {
      const worldState = loadNarrativeWorldState();
      const phase7 =
        typeof buildPhase7RenderStatsPayload === "function"
          ? buildPhase7RenderStatsPayload()
          : {
              totalReplies: 0,
              repliesWithOptions: 0,
              repliesWithoutOptions: 0,
              optionsSuppressed: 0,
              optionsRatePct: 0,
              recent: []
            };
      const phase7Perf =
        typeof buildPhase7PerformanceStatsPayload === "function"
          ? buildPhase7PerformanceStatsPayload()
          : {
              turns: 0,
              turnsWithBudget: 0,
              turnsWithLatency: 0,
              avgAiCallsPerTurn: 0,
              avgFallbackCallsPerTurn: 0,
              blockedTurns: 0,
              blockedRatePct: 0,
              latency: { samples: 0, p50LatencyMs: 0, p95LatencyMs: 0, maxLatencyMs: 0 },
              targets: { avgAiCallsPerTurn: 1.4, p95LatencyMs: 2200, blockedRatePct: 20 },
              alerts: {
                avgAiCallsExceeded: false,
                p95LatencyExceeded: false,
                blockedRateExceeded: false
              },
              recent: []
            };
      const summary = [
        "Phase7 DoD (rendu MJ naturel)",
        `Replies: ${Number(phase7.totalReplies ?? 0)}`,
        `WithOptions: ${Number(phase7.repliesWithOptions ?? 0)}`,
        `WithoutOptions: ${Number(phase7.repliesWithoutOptions ?? 0)}`,
        `OptionsRate: ${Number(phase7.optionsRatePct ?? 0)}%`,
        `AvgAiCalls: ${Number(phase7Perf.avgAiCallsPerTurn ?? 0)}`,
        `P95LatencyMs: ${Number(phase7Perf?.latency?.p95LatencyMs ?? 0)}`,
        `BlockedRate: ${Number(phase7Perf.blockedRatePct ?? 0)}%`
      ].join(" | ");
      return buildSystemPayload({
        reply: summary,
        reason: "phase7-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan,
        extra: {
          phase7: {
            dod: {
              naturalRenderEnabled: true,
              totalReplies: Number(phase7.totalReplies ?? 0),
              repliesWithOptions: Number(phase7.repliesWithOptions ?? 0),
              repliesWithoutOptions: Number(phase7.repliesWithoutOptions ?? 0),
              optionsSuppressed: Number(phase7.optionsSuppressed ?? 0),
              optionsRatePct: Number(phase7.optionsRatePct ?? 0)
            },
            recent: Array.isArray(phase7.recent) ? phase7.recent : [],
            performance: {
              turns: Number(phase7Perf.turns ?? 0),
              turnsWithBudget: Number(phase7Perf.turnsWithBudget ?? 0),
              turnsWithLatency: Number(phase7Perf.turnsWithLatency ?? 0),
              avgAiCallsPerTurn: Number(phase7Perf.avgAiCallsPerTurn ?? 0),
              avgFallbackCallsPerTurn: Number(phase7Perf.avgFallbackCallsPerTurn ?? 0),
              blockedTurns: Number(phase7Perf.blockedTurns ?? 0),
              blockedRatePct: Number(phase7Perf.blockedRatePct ?? 0),
              latency: phase7Perf.latency ?? {},
              targets: phase7Perf.targets ?? {},
              alerts: phase7Perf.alerts ?? {},
              recent: Array.isArray(phase7Perf.recent) ? phase7Perf.recent : []
            }
          }
        }
      });
    }

    if (command === "/phase8-debug") {
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
      return buildSystemPayload({
        reply: summary,
        reason: "phase8-debug",
        worldState,
        conversationMode,
        intent,
        directorPlan,
        extra: {
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
          }
        }
      });
    }

    return null;
  }

  return {
    tryHandle
  };
}

module.exports = {
  createNarrationDebugCommands
};
