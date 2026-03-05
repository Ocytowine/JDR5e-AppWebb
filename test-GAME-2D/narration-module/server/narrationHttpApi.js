const fs = require("fs");
const path = require("path");

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

  function safeString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }

  function normalizeIntentType(value) {
    const raw = safeString(value)
      .trim()
      .toLowerCase();
    const allowed = new Set([
      "observe",
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

    const rawProfile =
      payload && typeof payload.player_profile === "object" && payload.player_profile !== null
        ? payload.player_profile
        : null;
    const playerProfile = rawProfile ? JSON.parse(JSON.stringify(rawProfile)) : null;

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
          profile: playerProfile
        }
      },
      response_contract: {
        require_structured_output: true,
        must_preserve_continuity: true
      }
    };
  }

  function buildPlanAndOutputContracts(payload, _projected, turnId) {
    const intentType = normalizeIntentType(payload.intent_type);
    const locationId = safeString(payload.location_id, "setup_zone");
    const common = {
      schema_version: "1.0.0",
      targets: [],
      actor_updates: [],
      narrative_constraints: {
        tone: "neutral_immersive",
        must_reflect_runtime_result: true
      }
    };

    if (intentType === "observe") {
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
            approach: "Observation locale sans action irreversible",
            assumptions: [],
            checks_needed: [],
            resources_to_spend: [],
            risks: [],
            fallbacks: [],
            need_clarification: []
          },
          targets: [locationId],
          runtime_actions: [{ action: "queryLore", params: { topic_ids: ["scene_local", "actors_nearby"] } }],
          narrative_output: {
            player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
            mj_notes: ["Narration finale generee par l'IA amont a partir du paquet runtime."],
            hidden_truth_updates: []
          }
        }
      };
    }

    if (intentType === "move_local") {
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
            approach: "Deplacement local puis entree si possible",
            assumptions: ["Le chemin immediate est praticable"],
            checks_needed: [],
            resources_to_spend: [{ type: "time", amount: "1-2min" }],
            risks: [{ risk: "Acces bloque", severity: "medium" }],
            fallbacks: ["Observer avant d'insister"],
            need_clarification: []
          },
          targets: ["archives_main_door"],
          runtime_actions: [
            { action: "moveLocal", params: { destination_id: "archives_main_door", time_cost_min: 1 } },
            { action: "enterLocation", params: { location_id: "archives_interior" } }
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
      return {
        decisionReason: "action_selected.ask_info",
        outputContract: {
          ...common,
          intent_type: "ask_info",
          intent_confidence: 0.88,
          requires_clarification: false,
          clarification_question: null,
          plan: {
            objective: "Obtenir des informations fiables",
            approach: "Interroger ou observer les sources proches",
            assumptions: ["Au moins une source d'information est disponible a proximite"],
            checks_needed: [],
            resources_to_spend: [],
            risks: [{ risk: "Source peu fiable", severity: "medium" }],
            fallbacks: ["Observer davantage avant d'interroger"],
            need_clarification: []
          },
          targets: [locationId],
          runtime_actions: [
            { action: "queryLore", params: { topic_ids: ["witnesses_nearby", "recent_rumors", "scene_local"] } }
          ],
          narrative_output: {
            player_facing_text: RUNTIME_NARRATION_PLACEHOLDER,
            mj_notes: ["Narration finale generee par l'IA amont a partir du paquet runtime."],
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
          ? "Intent structure manquant: fournis intent_type (observe|move_local|ask_info|attempt_forbidden)."
          : "Tu veux observer, te deplacer, ou interagir avec un acteur ?",
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

        const currentWiki = narrationRuntime.memoryStore.getWikiWorldState() || {};
        narrationRuntime.memoryService.setWikiWorldState({
          location_id: locationId,
          map_prompt: safeString(body.map_prompt),
          ...currentWiki
        });

        const projected = narrationRuntime.memoryService.project(campaignId, { location_id: locationId });
        const inputContract = buildInputContract(body, projected);
        const { outputContract, decisionReason } = buildPlanAndOutputContracts(body, projected, turnId);

        const campaignBefore = narrationRuntime.memoryService.getCampaign(campaignId);
        const stateBefore = {
          ...projected.effective_world_state,
          location_id: locationId,
          world_flags: Array.isArray(campaignBefore.world_overrides?.world_flags)
            ? campaignBefore.world_overrides.world_flags
            : [],
          journal: Array.isArray(campaignBefore.knowledge?.player_view)
            ? campaignBefore.knowledge.player_view
            : [],
          events: Array.isArray(campaignBefore.events) ? campaignBefore.events : []
        };

        const trace = narrationRuntime.processor.processTurn(turnId, inputContract, outputContract, stateBefore);
        const campaignAfter = narrationRuntime.memoryService.getCampaign(campaignId);
        campaignAfter.events = Array.isArray(trace.state_after?.events)
          ? trace.state_after.events
          : campaignAfter.events;
        campaignAfter.world_overrides = {
          ...campaignAfter.world_overrides,
          location_id: trace.state_after?.location_id ?? locationId
        };
        campaignAfter.updated_at_turn = turnId;
        narrationRuntime.memoryStore.saveCampaign(campaignAfter);

        for (const fact of outputContract.narrative_output.hidden_truth_updates ?? []) {
          narrationRuntime.memoryService.appendKnowledgeTruthView(
            campaignId,
            { turn_id: turnId, fact: String(fact) },
            turnId
          );
        }

        const projectedAfter = narrationRuntime.memoryService.project(campaignId, {
          location_id: trace.state_after?.location_id ?? locationId
        });
        const aiHandoff = {
          turn_id: turnId,
          campaign_id: campaignId,
          decision_reason: decisionReason,
          narrative_generation_required: true,
          input_contract: inputContract,
          output_contract: outputContract,
          runtime_result: {
            runtime_actions: trace.runtime_actions,
            state_diff: trace.state_diff,
            projected_memory: projectedAfter
          }
        };

        return sendJson(res, 200, {
          turn_id: turnId,
          campaign_id: campaignId,
          decision_reason: decisionReason,
          narrative_generation_required: true,
          input_contract: inputContract,
          output_contract: outputContract,
          trace: {
            runtime_actions: trace.runtime_actions,
            state_diff: trace.state_diff
          },
          projected_memory: projectedAfter,
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
          "Repond STRICTEMENT en JSON: { \"player_text\": \"...\", \"mj_notes\": [\"...\"], \"next_turn_hints\": [\"...\"] }.";
        const parsed = await callOpenAiJson({
          model,
          systemPrompt,
          userPayload: { ai_handoff: aiHandoff }
        });
        const playerText =
          safeString(parsed?.player_text ?? parsed?.player_facing_text, fallbackText).trim() || fallbackText;
        const mjNotes = toStringArray(parsed?.mj_notes);
        const nextTurnHints = toStringArray(parsed?.next_turn_hints);

        if (narrationRuntime && campaignId && turnId) {
          narrationRuntime.memoryService.appendKnowledgePlayerView(
            campaignId,
            { turn_id: turnId, text: playerText },
            turnId
          );
        }

        return sendJson(res, 200, {
          campaign_id: campaignId,
          turn_id: turnId,
          source: "llm",
          player_text: playerText,
          mj_notes: mjNotes,
          next_turn_hints: nextTurnHints
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
