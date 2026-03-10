import path from "node:path";

const MODULE_ROOT = path.resolve(__dirname, "../../..");
const PROJECT_ROOT = path.resolve(MODULE_ROOT, "..");
const { createNarrationModuleApi } = require(path.join(MODULE_ROOT, "server", "narrationHttpApi.js"));
const { JsonMemoryStore } = require(path.join(MODULE_ROOT, "dist", "src", "adapters", "db", "memory_store.js"));
const { MemoryService } = require(path.join(MODULE_ROOT, "dist", "src", "application", "use_cases", "memory_service.js"));

function assertTrue(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

type FakeRequest = {
  method: string;
  url: string;
  body?: Record<string, unknown>;
};

type FakeResponse = {
  statusCode?: number;
  body?: unknown;
};

function createApiHarness() {
  return createNarrationModuleApi({
    projectRoot: PROJECT_ROOT,
    openAiApiKey: "test-key",
    cryptoImpl: {
      randomUUID: () => "00000000-0000-4000-8000-000000000000",
    },
    parseJsonBody: async (req: FakeRequest) => req.body ?? {},
    sendJson: (_res: FakeResponse, status: number, body: unknown) => ({ status, body }),
    callOpenAiJson: async ({ userPayload }: { userPayload?: Record<string, unknown> }) => {
      const payload = (userPayload ?? {}) as any;
      const playerInput = String(
        payload.player_input ??
          payload.input_contract?.player_input ??
          payload.ai_handoff?.input_contract?.player_input ??
          "",
      );

      if (payload.ai_handoff) {
        if (payload.ai_handoff?.output_contract?.intent_type === "talk") {
          if (playerInput === "je parle au marin en resume") {
            return {
              player_text:
                "Vous engagez une breve conversation avec le marin qui vous repond avec reserve.",
              mj_notes: ["test"],
              next_turn_hints: [],
              entity_enrichment_proposals: [],
            };
          }
          return {
            player_text:
              "Vous vous approchez du marin et vous le saluez. \"Bonjour soldat. Tout va bien aujourd'hui ?\" Il vous repond sans se departir de son calme: \"Affirmatif. Rien a signaler pour l'instant.\"",
            mj_notes: ["test"],
            next_turn_hints: [],
            entity_enrichment_proposals: [],
          };
        }
        if (playerInput === "Peut tu decrire ce que je vois ?") {
          return {
            player_text:
              "Tu distingues surtout l'agitation diffuse des halles, sans personne clairement a portee immediate.",
            mj_notes: ["test"],
            next_turn_hints: [
              "Interagir avec des commercants ou surveiller une activite suspecte.",
              "Te rapprocher du marche de gros et de detail pour reperer quelqu'un de plus pres.",
            ],
            entity_enrichment_proposals: [],
          };
        }
        return {
          player_text: `Narration test: ${playerInput}`,
          mj_notes: ["test"],
          next_turn_hints: [],
          entity_enrichment_proposals: [],
        };
      }

      if (playerInput === "que vois je autour de moi ?") {
        return {
          intent_type: "observe",
          intent_confidence: 0.95,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: null,
          target_actor_id: null,
          notes: ["Observation locale."],
        };
      }

      if (playerInput === "decris moi la scene") {
        return {
          intent_type: "observe",
          intent_confidence: 0.95,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: null,
          target_actor_id: null,
          notes: ["Description libre de scene."],
        };
      }

      if (playerInput === "Peut tu decrire ce que je vois ?") {
        return {
          intent_type: "observe",
          intent_confidence: 0.95,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: null,
          target_actor_id: null,
          notes: ["Observation locale dans les halles."],
        };
      }

      if (playerInput === "est ce que je peux voir un marchand d'ici ?") {
        return {
          intent_type: "ask_info",
          intent_confidence: 0.9,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: "marchand",
          target_actor_id: null,
          notes: ["Question de perception locale sur un marchand."],
        };
      }

      if (playerInput === "peut tu décrire le marin") {
        return {
          intent_type: "ask_info",
          intent_confidence: 0.95,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: "marin",
          target_actor_id: null,
          notes: ["Description du marin."],
        };
      }

      if (playerInput === "je parle au marin") {
        return {
          intent_type: "talk",
          intent_confidence: 0.95,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: "marin",
          target_actor_id: null,
          notes: ["Dialogue avec le marin."],
        };
      }

      if (playerInput === "je parle au marin en resume") {
        return {
          intent_type: "talk",
          intent_confidence: 0.95,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: "marin",
          target_actor_id: null,
          notes: ["Dialogue avec le marin, faux rendu resumatif a corriger."],
        };
      }

      if (playerInput === "je parle au garde") {
        return {
          intent_type: "talk",
          intent_confidence: 0.95,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: "garde",
          target_actor_id: null,
          notes: ["Dialogue avec un garde non precise."],
        };
      }

      if (playerInput === "que sais je du marin") {
        return {
          intent_type: "ask_info",
          intent_confidence: 0.95,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: "marin",
          target_actor_id: null,
          notes: ["Question de connaissance sur le marin."],
        };
      }

      if (playerInput === "je me rapproches des marchands") {
        return {
          intent_type: "move_local",
          intent_confidence: 0.9,
          requires_clarification: false,
          clarification_question: null,
          destination_id: "halles_des_commerces",
          target_actor_hint: "marchands",
          target_actor_id: null,
          notes: ["Rapprochement local vers les marchands."],
        };
      }

      if (playerInput === "je voudrais parler a un marchand") {
        return {
          intent_type: "talk",
          intent_confidence: 0.9,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: "marchand",
          target_actor_id: null,
          notes: ["Le joueur veut parler a un marchand."],
        };
      }

      if (playerInput === "j'aimerai aller au archives") {
        return {
          intent_type: "move_local",
          intent_confidence: 0.9,
          requires_clarification: false,
          clarification_question: null,
          destination_id: null,
          target_actor_hint: null,
          target_actor_id: null,
          notes: ["Deplacement vers les archives."],
        };
      }

      throw new Error(`Unexpected prompt in fake LLM: ${playerInput}`);
    },
  });
}

async function callRoute(api: { tryHandle: (req: FakeRequest, res: FakeResponse) => Promise<unknown> }, req: FakeRequest) {
  const res: FakeResponse = {};
  const result = await api.tryHandle(req, res);
  const payload = result && typeof result === "object" ? result : res;
  return payload as { status: number; body: any };
}

async function seedAmbiguousGuardScene(campaignId: string): Promise<void> {
  const memoryPath = path.join(PROJECT_ROOT, "narration-module", "runtime-data", "memory-store.json");
  const memoryService = new MemoryService(new JsonMemoryStore(memoryPath));
  const turnId = "seed-ambiguous-guards";

  await memoryService.advanceCampaignTurn(campaignId, turnId);
  await memoryService.ensureLocationRuntimeState(
    campaignId,
    "archives_forecourt",
    {
      display_name: "Avant-poste des Archives",
      subtype: "forecourt",
      connected_locations: [],
      active_points_of_interest: [],
    },
    turnId,
  );

  const guardRecords = [
    {
      entity_id: "archives_forecourt_garde_01",
      display_name: "garde a la hallebarde",
      notable_detail: "garde a la moustache raide qui serre sa hallebarde",
      current_activity: "scrute la rue devant le portail des archives",
      marker: "tapote le bois de sa hallebarde du bout des doigts",
    },
    {
      entity_id: "archives_forecourt_garde_02",
      display_name: "garde au registre",
      notable_detail: "garde aux traits tires qui garde un registre sous le bras",
      current_activity: "surveille les visiteurs en consultant un registre de service",
      marker: "humecte son pouce avant de tourner une page du registre",
    },
  ];

  for (const guard of guardRecords) {
    await memoryService.upsertEntity(campaignId, {
      entity_id: guard.entity_id,
      entity_type: "actor",
      subtype: "pnj",
      display_name: guard.display_name,
      memory_state: "active",
      status: "active",
      scope: "situational",
      created_at_turn: turnId,
      updated_at_turn: turnId,
      last_seen_turn: turnId,
      location_id: "archives_forecourt",
      source: {
        created_by: "test",
        reason: "ambiguous_guard_scene",
      },
      visibility: {
        player_known: true,
        truth_known: true,
      },
      links: {
        event_ids: [],
        related_entity_ids: [],
        faction_ids: [],
      },
      payload: {
        profile_state: "stub",
        pending_enrichment: null,
        identity: {
          known_name: null,
          role: "garde",
          species: "humain",
          gender_presentation: "unknown",
        },
        appearance: {
          physical_traits: [guard.marker],
          clothing: ["uniforme de garde des archives"],
          visible_equipment: [],
          notable_details: [guard.notable_detail],
        },
        stats: {
          FOR: 10,
          DEX: 10,
          CON: 10,
          INT: 10,
          SAG: 10,
          CHA: 10,
        },
        social: {
          temperament: "neutral",
          social_traits: [],
          authority_level: "low",
          social_rank: "guard",
          disposition_to_player: "neutral",
          interaction_state: "available",
          hospitality_style: "guarded",
        },
        world: {
          faction_id: "maison_tharqual",
          duty_state: "on_watch",
          location_precision: "archives_forecourt",
        },
        interaction: {
          last_interaction_summary: null,
          player_language_compatibility: "full",
          known_to_player_as: "garde",
          contact_count: 1,
          familiarity_level: "seen_once",
          last_interaction_outcome: "brief_contact",
          active_topic_ids: [],
          taboo_topic_ids: [],
          unresolved_hooks: [],
          aliases: [guard.display_name, "garde"],
        },
        language_profile: {
          native_languages: ["commun"],
          known_languages: ["commun"],
          preferred_language: "commun",
          source: "test",
        },
        scene_presence: {
          current_activity: guard.current_activity,
          activity_descriptor: "surveille l'entree des archives",
          scene_anchor: "Avant-poste des Archives",
        },
      },
      lifecycle_policy: {
        ttl_turns: 8,
        promote_if_linked_to_event: true,
        archive_when_inactive: true,
      },
      lifecycle_history: [],
    }, turnId);
    await memoryService.ensureVisibleActorAtLocation(campaignId, "archives_forecourt", guard.entity_id, turnId);
  }
}

async function main(): Promise<number> {
  const api = createApiHarness();
  const campaignId = `it-server-fixes-${Date.now()}`;

  await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/reset-memory",
    body: { campaign_id: campaignId },
  });

  const baseBody = {
    campaign_id: campaignId,
    character_id: "pj-1",
    location_id: "port_des_xantars",
    map_prompt: "",
    narration_goal: "",
    narration_constraints: "",
    narration_context:
      "[location_id: port_des_xantars] Port des Xantars, facade maritime de Lysenthe. Docks bruyants, controle des cargaisons et circulation dense de marins et courtiers.",
    player_narrative_snapshot: {
      character_id: "pj-1",
      display_name: "Test Hero",
      spoken_languages: ["commun"],
      read_languages: ["commun"],
    },
  };

  const observeResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...baseBody,
      player_input: "que vois je autour de moi ?",
    },
  });
  assertTrue(observeResponse.status === 200, "observe turn failed");
  const observeMarineProfileState =
    observeResponse.body?.memory_debug?.after?.campaign?.entity_registry?.actors?.port_des_xantars_marin_01?.payload
      ?.profile_state;
  assertTrue(
    observeMarineProfileState === "scene_stub",
    "ambient observed actors should start as scene_stub",
  );
  const observeSnapshots =
    observeResponse.body?.memory_debug?.after?.campaign?.entity_registry?.locations?.port_des_xantars?.payload
      ?.scene_payload?.actor_activity_snapshots ?? [];
  assertTrue(
    observeSnapshots.length >= 1 && observeSnapshots.length <= 3,
    "busy observe scene should reveal a flexible number of visible actors",
  );
  if (observeSnapshots.length >= 2) {
    assertTrue(
      observeSnapshots[0]?.distinctive_marker !== observeSnapshots[1]?.distinctive_marker,
      "visible actors should be contrasted by distinct perceptive markers",
    );
  }

  const describeResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...baseBody,
      player_input: "peut tu décrire le marin",
    },
  });
  assertTrue(describeResponse.status === 200, "describe turn failed");
  assertTrue(
    describeResponse.body?.ai_handoff?.output_contract?.intent_type === "observe",
    "descriptive request should be reclassified to observe",
  );
  assertTrue(
    describeResponse.body?.ai_handoff?.runtime_result?.truth_snapshot?.local_truth?.target_actor_id ===
      "port_des_xantars_marin_01",
    "observe description should focus the visible sailor",
  );
  const visibleActorsAfterDescribe =
    describeResponse.body?.memory_debug?.after?.campaign?.entity_registry?.locations?.port_des_xantars?.payload
      ?.visible_actors ?? [];
  assertTrue(
    !visibleActorsAfterDescribe.includes("port_des_xantars_courtier_01"),
    "ask_info/observe description should not seed a new ambient courtier",
  );

  const talkResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...baseBody,
      player_input: "je parle au marin",
      target_actor_id: "port_des_xantars_marin_01",
    },
  });
  assertTrue(talkResponse.status === 200, "talk turn failed");
  assertTrue(
    talkResponse.body?.memory_debug?.after?.campaign?.world_overrides?.active_talk_actor_id ===
      "port_des_xantars_marin_01",
    "talk turn should set active_talk_actor_id",
  );
  assertTrue(
    Array.isArray(talkResponse.body?.ai_handoff?.runtime_result?.talk_context?.nearby_actors),
    "talk handoff should expose nearby visible actors",
  );
  assertTrue(
    typeof talkResponse.body?.ai_handoff?.runtime_result?.talk_context?.scene_mode === "string",
    "talk handoff should expose a talk scene_mode",
  );
  assertTrue(
    talkResponse.body?.ai_handoff?.runtime_result?.talk_context?.speaker_cues?.primary?.scene_role === "primary",
    "talk handoff should expose primary speaker cues",
  );
  assertTrue(
    talkResponse.body?.ai_handoff?.runtime_result?.talk_context?.dialogue_guidance?.direct_speech_required === true,
    "talk handoff should require direct speech guidance",
  );
  assertTrue(
    talkResponse.body?.ai_handoff?.runtime_result?.talk_context?.dialogue_blueprint?.opening_beat != null,
    "talk handoff should expose a dialogue blueprint",
  );
  assertTrue(
    talkResponse.body?.memory_debug?.after?.campaign?.entity_registry?.actors?.port_des_xantars_marin_01?.payload
      ?.profile_state === "stub",
    "talked actor should be promoted from scene_stub to stub",
  );
  const generatedTalkNarration = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/generate-narration",
    body: {
      campaign_id: campaignId,
      turn_id: talkResponse.body?.turn_id,
      ai_handoff: talkResponse.body?.ai_handoff,
    },
  });
  assertTrue(generatedTalkNarration.status === 200, "talk narration generation failed");
  assertTrue(
    String(generatedTalkNarration.body?.player_text || "").includes("Bonjour soldat") &&
      String(generatedTalkNarration.body?.player_text || "").includes("Affirmatif"),
    "talk narration should accept direct speech rendering",
  );

  const summaryTalkResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...baseBody,
      player_input: "je parle au marin en resume",
      target_actor_id: "port_des_xantars_marin_01",
    },
  });
  assertTrue(summaryTalkResponse.status === 200, "summary talk turn failed");
  const summaryGeneratedTalkNarration = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/generate-narration",
    body: {
      campaign_id: campaignId,
      turn_id: summaryTalkResponse.body?.turn_id,
      ai_handoff: summaryTalkResponse.body?.ai_handoff,
    },
  });
  assertTrue(summaryGeneratedTalkNarration.status === 200, "summary talk narration generation failed");
  assertTrue(
    String(summaryGeneratedTalkNarration.body?.player_text || "").includes("\"") &&
      !String(summaryGeneratedTalkNarration.body?.player_text || "").includes("breve conversation"),
    "talk narration fallback should replace a flat summary with direct speech",
  );
  assertTrue(
    /reste en retrait|jette un regard bref|Plus loin/.test(
      String(summaryGeneratedTalkNarration.body?.player_text || ""),
    ),
    "talk narration fallback should leave room for nearby actors or background beats",
  );

  const askInfoKnowledgeResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...baseBody,
      player_input: "que sais je du marin",
    },
  });
  assertTrue(askInfoKnowledgeResponse.status === 200, "ask_info knowledge turn failed");
  assertTrue(
    askInfoKnowledgeResponse.body?.ai_handoff?.output_contract?.intent_type === "ask_info",
    "knowledge question should remain ask_info",
  );
  assertTrue(
    askInfoKnowledgeResponse.body?.ai_handoff?.runtime_result?.truth_snapshot?.local_truth?.target_actor_id ===
      "port_des_xantars_marin_01",
    "knowledge question should still focus the targeted sailor",
  );
  const askInfoAnswerText =
    askInfoKnowledgeResponse.body?.ai_handoff?.output_contract?.ask_info_resolution?.answer_text ?? "";
  assertTrue(
    typeof askInfoAnswerText === "string" && askInfoAnswerText.includes("marin"),
    "knowledge question should answer from actor-centric memory, not only from scene summary",
  );
  assertTrue(
    !String(askInfoAnswerText).includes("Vous êtes au Port des Xantars"),
    "knowledge question should not fall back to the whole scene summary",
  );

  const moveResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...baseBody,
      player_input: "j'aimerai aller au archives",
    },
  });
  assertTrue(moveResponse.status === 200, "move turn failed");
  assertTrue(
    moveResponse.body?.ai_handoff?.output_contract?.intent_type === "move_local",
    "archives request should remain move_local",
  );
  assertTrue(
    moveResponse.body?.ai_handoff?.output_contract?.requires_clarification === false,
    "archives request should resolve without clarification",
  );
  assertTrue(
    moveResponse.body?.ai_handoff?.output_contract?.targets?.[0] === "quartier_des_archives",
    "archives request should resolve to quartier_des_archives",
  );
  assertTrue(
    moveResponse.body?.memory_debug?.after?.campaign?.world_overrides?.active_talk_actor_id == null,
    "non-talk turn should clear active_talk_actor_id",
  );

  await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/reset-memory",
    body: { campaign_id: campaignId },
  });

  const sparseCampaignId = `it-server-sparse-${Date.now()}`;
  await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/reset-memory",
    body: { campaign_id: sparseCampaignId },
  });
  const sparseResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...baseBody,
      campaign_id: sparseCampaignId,
      narration_context:
        "[location_id: port_des_xantars] Quai vide, brume legere, presque personne en vue. L'endroit est calme.",
      player_input: "decris moi la scene",
    },
  });
  assertTrue(sparseResponse.status === 200, "sparse observe turn failed");
  const sparseVisibleActors =
    sparseResponse.body?.memory_debug?.after?.campaign?.entity_registry?.locations?.port_des_xantars?.payload
      ?.visible_actors ?? [];
  assertTrue(
    sparseVisibleActors.length <= 1,
    "sparse observe scene should not force multiple visible actors",
  );

  await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/reset-memory",
    body: { campaign_id: sparseCampaignId },
  });

  const hallesCampaignId = `it-server-halles-${Date.now()}`;
  await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/reset-memory",
    body: { campaign_id: hallesCampaignId },
  });
  const hallesBody = {
    ...baseBody,
    campaign_id: hallesCampaignId,
    location_id: "halles_des_commerces",
    narration_context:
      "[location_id: halles_des_commerces] Halles des Commerces. Activite diffuse, silhouettes lointaines, aucune personne a portee immediate, personne discernable pres de toi. Marche de gros et plateforme logistique plus loin.",
  };
  const hallesObserveResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...hallesBody,
      player_input: "Peut tu decrire ce que je vois ?",
    },
  });
  assertTrue(hallesObserveResponse.status === 200, "halles observe turn failed");
  assertTrue(
    (hallesObserveResponse.body?.memory_debug?.after?.campaign?.entity_registry?.locations?.halles_des_commerces
      ?.payload?.scene_payload?.visible_actors ?? []).length === 0,
    "halles observe should expose zero contactable actors when nobody is at immediate range",
  );
  const hallesObserveNarration = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/generate-narration",
    body: {
      campaign_id: hallesCampaignId,
      turn_id: hallesObserveResponse.body?.turn_id,
      ai_handoff: hallesObserveResponse.body?.ai_handoff,
    },
  });
  assertTrue(hallesObserveNarration.status === 200, "halles observe narration failed");
  assertTrue(
    !String((hallesObserveNarration.body?.next_turn_hints ?? []).join(" ")).includes("Interagir"),
    "observe narration should filter interaction hints when nobody is contactable",
  );

  const presenceScanResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...hallesBody,
      player_input: "est ce que je peux voir un marchand d'ici ?",
    },
  });
  assertTrue(presenceScanResponse.status === 200, "presence scan turn failed");
  assertTrue(
    presenceScanResponse.body?.ai_handoff?.output_contract?.intent_type === "observe",
    "presence scan should be reclassified from ask_info to observe",
  );
  assertTrue(
    (presenceScanResponse.body?.memory_debug?.after?.campaign?.entity_registry?.locations?.halles_des_commerces
      ?.payload?.scene_payload?.visible_actors ?? []).length === 0,
    "presence scan should still report zero contactable actors",
  );

  const hallesMoveResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...hallesBody,
      player_input: "je me rapproches des marchands",
    },
  });
  assertTrue(hallesMoveResponse.status === 200, "halles move turn failed");
  assertTrue(
    hallesMoveResponse.body?.ai_handoff?.output_contract?.requires_clarification === true,
    "same-location approach should clarify when no merchant is contactable yet",
  );
  assertTrue(
    /marche de gros et de detail|plateforme logistique/.test(
      String(hallesMoveResponse.body?.ai_handoff?.output_contract?.clarification_question || ""),
    ),
    "same-location approach should redirect toward a concrete sub-zone",
  );

  const hallesTalkResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...hallesBody,
      player_input: "je voudrais parler a un marchand",
    },
  });
  assertTrue(hallesTalkResponse.status === 200, "halles talk turn failed");
  assertTrue(
    hallesTalkResponse.body?.ai_handoff?.output_contract?.requires_clarification === true,
    "talk should clarify instead of creating a merchant ex nihilo",
  );
  assertTrue(
    Object.keys(hallesTalkResponse.body?.memory_debug?.after?.campaign?.entity_registry?.actors ?? {}).length === 0,
    "talk should not create a merchant when nobody is visible or contactable",
  );
  await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/reset-memory",
    body: { campaign_id: hallesCampaignId },
  });

  const ambiguousCampaignId = `it-server-ambiguous-${Date.now()}`;
  await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/reset-memory",
    body: { campaign_id: ambiguousCampaignId },
  });
  await seedAmbiguousGuardScene(ambiguousCampaignId);
  const ambiguousTalkResponse = await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/process-turn",
    body: {
      ...baseBody,
      campaign_id: ambiguousCampaignId,
      location_id: "archives_forecourt",
      narration_context:
        "[location_id: archives_forecourt] Deux gardes surveillent l'entree des archives dans un calme tendu.",
      player_input: "je parle au garde",
    },
  });
  assertTrue(ambiguousTalkResponse.status === 200, "ambiguous talk turn failed");
  assertTrue(
    ambiguousTalkResponse.body?.ai_handoff?.output_contract?.requires_clarification === true,
    "ambiguous guard talk should require clarification",
  );
  assertTrue(
    (ambiguousTalkResponse.body?.memory_debug?.after?.campaign?.world_overrides?.pending_clarification?.options ?? [])
      .length >= 2,
    "ambiguous guard talk should persist multiple clarification options",
  );
  await callRoute(api, {
    method: "POST",
    url: "/api/narration-module/reset-memory",
    body: { campaign_id: ambiguousCampaignId },
  });

  console.log("[PASS] integration test_server_turn_intent_fixes");
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
