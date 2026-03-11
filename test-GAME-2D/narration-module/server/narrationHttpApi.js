const { createWikiLoreHelper } = require("./wikiLoreHelper");
const { createLocalLoreHelper } = require("./localLoreHelper");

const ALLOWED_INTENTS = new Set([
  "observe",
  "talk",
  "move_local",
  "ask_info",
  "attempt_forbidden",
  "meta_unclear"
]);

function createNarrationModuleApi({
  projectRoot,
  parseJsonBody,
  sendJson
}) {
  const wikiLoreHelper = createWikiLoreHelper(projectRoot);
  const localLoreHelper = createLocalLoreHelper();

  function safeString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }

  function normalizeText(value) {
    return safeString(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function toShortText(value, maxChars = 220) {
    const raw = safeString(value).replace(/\s+/g, " ").trim();
    if (!raw) return "";
    if (raw.length <= maxChars) return raw;
    return `${raw.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
  }

  function inferIntentType(playerInput, intentHint) {
    const normalizedHint = normalizeText(intentHint);
    if (ALLOWED_INTENTS.has(normalizedHint)) {
      return normalizedHint;
    }

    const normalizedInput = normalizeText(playerInput);
    if (!normalizedInput) return "meta_unclear";
    if (/\b(parle|parler|discute|dialogue|negocie|demande a|adresse a)\b/.test(normalizedInput)) {
      return "talk";
    }
    if (/\b(qui|quoi|ou|quand|pourquoi|comment|renseigne|information|info|indice)\b/.test(normalizedInput)) {
      return "ask_info";
    }
    if (/\b(vais|va|aller|entre|monte|descend|rejoi|deplace|cours|marche|vers)\b/.test(normalizedInput)) {
      return "move_local";
    }
    if (/\b(force|vole|attaque|brise|menace|interdit|crochete|passe en force)\b/.test(normalizedInput)) {
      return "attempt_forbidden";
    }
    if (/\b(regarde|observe|scrute|inspecte|examine|cherche)\b/.test(normalizedInput)) {
      return "observe";
    }
    return "meta_unclear";
  }

  function buildEphemeralCampaignMemory(payload) {
    const truthView = [];
    const playerSnapshot =
      payload?.player_narrative_snapshot &&
      typeof payload.player_narrative_snapshot === "object"
        ? payload.player_narrative_snapshot
        : null;

    if (playerSnapshot) {
      truthView.push({
        type: "player_snapshot",
        location_id: safeString(payload.location_id),
        payload: playerSnapshot
      });
    }

    if (safeString(payload.narration_context)) {
      truthView.push({
        type: "narration_context",
        location_id: safeString(payload.location_id),
        text: safeString(payload.narration_context)
      });
    }

    if (safeString(payload.narration_goal)) {
      truthView.push({
        type: "narration_goal",
        location_id: safeString(payload.location_id),
        text: safeString(payload.narration_goal)
      });
    }

    if (safeString(payload.narration_constraints)) {
      truthView.push({
        type: "narration_constraints",
        location_id: safeString(payload.location_id),
        text: safeString(payload.narration_constraints)
      });
    }

    return {
      knowledge: { truth_view: truthView },
      events: [],
      relations: [],
      world_overrides: {
        campaign_id: safeString(payload.campaign_id),
        character_id: safeString(payload.character_id),
        location_id: safeString(payload.location_id),
        destination_id: safeString(payload.destination_id),
        target_actor_id: safeString(payload.target_actor_id),
        map_prompt: safeString(payload.map_prompt)
      }
    };
  }

  function buildClarificationQuestion(intentType, payload) {
    if (!safeString(payload.player_input).trim()) {
      return "Decris l'action du joueur avant de lancer la narration.";
    }
    if (intentType === "meta_unclear") {
      return "Veux-tu observer, parler, te deplacer, demander une information, ou tenter une action interdite ?";
    }
    return "Precise davantage l'action pour que je puisse exploiter le lore.";
  }

  function buildIntentPacket(payload, intentType) {
    const locationId = safeString(payload.location_id, "setup_zone").trim() || "setup_zone";
    const destinationId = safeString(payload.destination_id).trim();
    const targetActorId = safeString(payload.target_actor_id).trim();
    const requiresClarification = intentType === "meta_unclear";

    return {
      campaign_id: safeString(payload.campaign_id),
      character_id: safeString(payload.character_id),
      player_input: safeString(payload.player_input),
      intent_type: intentType,
      requires_clarification: requiresClarification,
      clarification_question: requiresClarification
        ? buildClarificationQuestion(intentType, payload)
        : "",
      world_anchor: {
        location_id: locationId,
        destination_id: destinationId || null
      },
      target_actor_id: targetActorId || null
    };
  }

  function selectLoreContext(payload, intentPacket) {
    if (intentPacket.requires_clarification) {
      return {
        wiki: { topic_ids: [], lore_db: {}, selected_entries: [] },
        local: { topic_ids: [], lore_db: {}, selected_entries: [] }
      };
    }

    const selectionParams = {
      intentType: intentPacket.intent_type,
      locationId: intentPacket.world_anchor.location_id,
      destinationId: intentPacket.world_anchor.destination_id || "",
      playerInput: safeString(payload.player_input)
    };

    return {
      wiki: wikiLoreHelper.selectLore(selectionParams),
      local: localLoreHelper.selectLocalLore({
        campaignMemory: buildEphemeralCampaignMemory(payload),
        intentType: intentPacket.intent_type,
        locationId: intentPacket.world_anchor.location_id,
        playerInput: safeString(payload.player_input)
      })
    };
  }

  function buildInputContract(payload, intentPacket, loreContext) {
    return {
      player_action: {
        raw_input: safeString(payload.player_input),
        intent_type: intentPacket.intent_type,
        intent_hint: safeString(payload.intent_hint)
      },
      world_state: {
        campaign_id: safeString(payload.campaign_id),
        character_id: safeString(payload.character_id),
        location_id: intentPacket.world_anchor.location_id,
        destination_id: intentPacket.world_anchor.destination_id || null,
        target_actor_id: intentPacket.target_actor_id,
        map_prompt: safeString(payload.map_prompt)
      },
      authoring_context: {
        narration_context: safeString(payload.narration_context),
        narration_goal: safeString(payload.narration_goal),
        narration_constraints: safeString(payload.narration_constraints)
      },
      lore_context: {
        wiki_topic_ids: Array.isArray(loreContext.wiki?.topic_ids) ? loreContext.wiki.topic_ids : [],
        local_topic_ids: Array.isArray(loreContext.local?.topic_ids) ? loreContext.local.topic_ids : []
      }
    };
  }

  function buildOutputContract(intentPacket, loreContext) {
    const wikiCount = Array.isArray(loreContext.wiki?.selected_entries)
      ? loreContext.wiki.selected_entries.length
      : 0;
    const localCount = Array.isArray(loreContext.local?.selected_entries)
      ? loreContext.local.selected_entries.length
      : 0;

    return {
      mode: "lore_only",
      requires_clarification: intentPacket.requires_clarification,
      clarification_question: intentPacket.requires_clarification
        ? intentPacket.clarification_question
        : "",
      selected_wiki_topics: wikiCount,
      selected_local_topics: localCount
    };
  }

  function buildProcessTurnResponse(payload) {
    const intentType = inferIntentType(payload?.player_input, payload?.intent_hint);
    const intentPacket = buildIntentPacket(payload, intentType);
    const loreContext = selectLoreContext(payload, intentPacket);
    const inputContract = buildInputContract(payload, intentPacket, loreContext);
    const outputContract = buildOutputContract(intentPacket, loreContext);

    return {
      decision_reason: "lore_only_pipeline",
      narrative_generation_required: true,
      intent_packet: intentPacket,
      trace: {
        mode: "lore_only",
        runtime_actions: [],
        selected_wiki_topics: inputContract.lore_context.wiki_topic_ids,
        selected_local_topics: inputContract.lore_context.local_topic_ids
      },
      projected_memory: {
        mode: "stateless",
        selected_wiki_topics: inputContract.lore_context.wiki_topic_ids,
        selected_local_topics: inputContract.lore_context.local_topic_ids
      },
      memory_debug: {
        mode: "stateless",
        ephemeral_campaign_memory: buildEphemeralCampaignMemory(payload),
        selected_local_lore: loreContext.local?.selected_entries ?? []
      },
      ai_handoff: {
        mode: "lore_only",
        input_contract: inputContract,
        output_contract: outputContract,
        intent_packet: intentPacket,
        lore_context: {
          wiki: loreContext.wiki,
          local: loreContext.local
        },
        runtime_result: {
          entity_profile_updates: [],
          world_state_updates: []
        }
      }
    };
  }

  function formatLoreBullet(entry) {
    if (!entry || typeof entry !== "object") return "";
    const name = safeString(entry.name);
    const snippet = toShortText(entry.snippet, 140);
    if (name && snippet) return `${name}: ${snippet}`;
    return name || snippet;
  }

  function buildNarrationText(aiHandoff) {
    const intentPacket =
      aiHandoff?.intent_packet && typeof aiHandoff.intent_packet === "object"
        ? aiHandoff.intent_packet
        : {};
    const outputContract =
      aiHandoff?.output_contract && typeof aiHandoff.output_contract === "object"
        ? aiHandoff.output_contract
        : {};
    const inputContract =
      aiHandoff?.input_contract && typeof aiHandoff.input_contract === "object"
        ? aiHandoff.input_contract
        : {};
    const loreContext =
      aiHandoff?.lore_context && typeof aiHandoff.lore_context === "object"
        ? aiHandoff.lore_context
        : {};
    const wikiEntries = Array.isArray(loreContext?.wiki?.selected_entries)
      ? loreContext.wiki.selected_entries
      : [];
    const localEntries = Array.isArray(loreContext?.local?.selected_entries)
      ? loreContext.local.selected_entries
      : [];
    const locationId = safeString(inputContract?.world_state?.location_id, "zone inconnue");
    const goal = toShortText(inputContract?.authoring_context?.narration_goal, 120);
    const constraints = toShortText(inputContract?.authoring_context?.narration_constraints, 120);

    if (outputContract.requires_clarification) {
      return {
        source: "lore_only",
        player_text: safeString(outputContract.clarification_question),
        mj_notes: ["Aucune execution runtime: clarification requise avant d'exploiter le lore."],
        next_turn_hints: ["Preciser l'intention du joueur."],
        proposal_update_decisions: []
      };
    }

    const introByIntent = {
      observe: `Observation de ${locationId}.`,
      talk: `Interaction sociale a ${locationId}.`,
      move_local: `Deplacement local vers ${locationId}.`,
      ask_info: `Recherche d'information a ${locationId}.`,
      attempt_forbidden: `Tentative sensible a ${locationId}.`
    };
    const intro = introByIntent[safeString(intentPacket.intent_type)] || `Scene a ${locationId}.`;

    const loreLines = [
      ...wikiEntries.slice(0, 2).map(formatLoreBullet),
      ...localEntries.slice(0, 2).map(formatLoreBullet)
    ].filter(Boolean);

    const segments = [intro];
    if (goal) {
      segments.push(`Objectif: ${goal}.`);
    }
    if (loreLines[0]) {
      segments.push(`Appui lore: ${loreLines[0]}.`);
    }
    if (loreLines[1]) {
      segments.push(`Detail utile: ${loreLines[1]}.`);
    }
    if (!loreLines.length) {
      segments.push("Aucun fragment lore fortement pertinent n'a ete trouve, il faut rester descriptif et prudent.");
    }

    return {
      source: "lore_only",
      player_text: segments.join(" ").replace(/\s+/g, " ").trim(),
      mj_notes: [
        constraints ? `Contrainte active: ${constraints}` : "Aucune contrainte active fournie.",
        `Selection lore: wiki=${wikiEntries.length}, local=${localEntries.length}.`
      ],
      next_turn_hints: [
        wikiEntries[0]?.entity_id
          ? `Creuser ${safeString(wikiEntries[0].entity_id)} au prochain tour.`
          : "Preciser un interlocuteur ou une destination pour resserrer la recherche."
      ],
      proposal_update_decisions: []
    };
  }

  async function handleProcessTurn(req, res) {
    try {
      const body = await parseJsonBody(req);
      return sendJson(res, 200, buildProcessTurnResponse(body));
    } catch (err) {
      return sendJson(res, 400, {
        error: "process_turn_failed",
        details: [String(err?.message || err)]
      });
    }
  }

  async function handleGenerateNarration(req, res) {
    try {
      const body = await parseJsonBody(req);
      const aiHandoff =
        body?.ai_handoff && typeof body.ai_handoff === "object"
          ? body.ai_handoff
          : null;
      if (!aiHandoff) {
        return sendJson(res, 400, {
          error: "ai_handoff_missing",
          details: ["ai_handoff is required"]
        });
      }
      return sendJson(res, 200, buildNarrationText(aiHandoff));
    } catch (err) {
      return sendJson(res, 400, {
        error: "generate_narration_failed",
        details: [String(err?.message || err)]
      });
    }
  }

  async function handleResetMemory(req, res) {
    try {
      const body = await parseJsonBody(req);
      const campaignId = safeString(body?.campaign_id);
      if (!campaignId) {
        return sendJson(res, 400, {
          error: "campaign_id_missing",
          details: ["campaign_id is required"]
        });
      }
      return sendJson(res, 200, {
        campaign_id: campaignId,
        reset: "not_found"
      });
    } catch (err) {
      return sendJson(res, 400, {
        error: "reset_memory_failed",
        details: [String(err?.message || err)]
      });
    }
  }

  async function tryHandle(req, res) {
    if (req.method === "GET" && req.url === "/api/narration-module/status") {
      return sendJson(res, 200, {
        narration_generation_enabled: true,
        mode: "lore_only"
      });
    }

    if (req.method === "POST" && req.url === "/api/narration-module/process-turn") {
      return handleProcessTurn(req, res);
    }

    if (req.method === "POST" && req.url === "/api/narration-module/generate-narration") {
      return handleGenerateNarration(req, res);
    }

    if (req.method === "POST" && req.url === "/api/narration-module/reset-memory") {
      return handleResetMemory(req, res);
    }

    return false;
  }

  return { tryHandle };
}

module.exports = { createNarrationModuleApi };
