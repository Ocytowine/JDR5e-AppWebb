import fs from "node:fs";
import path from "node:path";

import { JsonMemoryStore } from "../../src/adapters/db/memory_store";
import { MemoryService } from "../../src/application/use_cases/memory_service";
import { RuntimeEntityRecord } from "../../src/domain/memory/memory_types";

const MODULE_ROOT = path.resolve(__dirname, "../../..");

function assertTrue(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function buildActor(
  entityId: string,
  locationId: string,
  turnIndex: number,
): RuntimeEntityRecord {
  return {
    entity_id: entityId,
    entity_type: "actor",
    subtype: "pnj",
    display_name: entityId,
    memory_state: "active",
    status: "active",
    scope: "situational",
    created_at_turn: "turn-1",
    updated_at_turn: "turn-1",
    last_seen_turn: "turn-1",
    first_seen_turn_index: turnIndex,
    last_seen_turn_index: turnIndex,
    location_id: locationId,
    source: { created_by: "test" },
    visibility: { player_known: true, truth_known: true },
    links: {
      event_ids: [],
      related_entity_ids: [],
      faction_ids: [],
    },
    payload: {
      identity: {
        role: "pnj",
      },
    },
    lifecycle_policy: {},
    lifecycle_history: [],
  };
}

function main(): number {
  const filePath = path.join(
    MODULE_ROOT,
    "tests",
    "integration",
    "artifacts",
    "memory-store.projection-budgets.test.json",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const store = new JsonMemoryStore(filePath);
  const service = new MemoryService(store);
  const campaignId = "camp-projection-budget-01";

  for (let index = 0; index < 7; index += 1) {
    service.upsertEntity(
      campaignId,
      buildActor(`archives_actor_${index}`, "quartier_des_archives", 30 - index),
      "turn-1",
    );
  }
  for (let index = 0; index < 3; index += 1) {
    service.upsertEntity(
      campaignId,
      buildActor(`port_actor_${index}`, "port_des_xantars", 10 - index),
      "turn-1",
    );
  }

  for (let index = 0; index < 8; index += 1) {
    service.appendKnowledgePlayerView(
      campaignId,
      {
        text: `Observation archives ${index}`,
        knowledge_kind: "summary",
        certainty: "partial",
        source: "auto_narration",
        location_id: "quartier_des_archives",
      },
      "turn-1",
    );
  }

  const projectedObserve = service.project(campaignId, {
    location_id: "quartier_des_archives",
    intent_type: "observe",
  });
  const projectedTalk = service.project(campaignId, {
    location_id: "quartier_des_archives",
    intent_type: "talk",
    target_actor_id: "archives_actor_6",
  });

  const observeActors = projectedObserve.projected_units.entity_registry.actors;
  const observeKnowledge = projectedObserve.projected_units.knowledge_player_view;
  const talkActors = projectedTalk.projected_units.entity_registry.actors;

  assertTrue(observeActors.length === 6, "observe budget should cap actors at 6");
  assertTrue(observeKnowledge.length <= 6, "observe budget should cap player knowledge at 6");
  assertTrue(talkActors.length === 5, "talk budget should cap actors at 5");
  assertTrue(
    talkActors.some((actor) => actor.entity_id === "archives_actor_6"),
    "talk projection should keep the explicit target actor",
  );
  assertTrue(
    talkActors.every((actor) => String(actor.location_id) === "quartier_des_archives"),
    "projection should prioritize location-scoped actors when available",
  );

  console.log("[PASS] integration test_memory_projection_budgets");
  return 0;
}

process.exit(main());
