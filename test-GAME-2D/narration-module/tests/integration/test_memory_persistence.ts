import fs from "node:fs";
import path from "node:path";

import { JsonMemoryStore } from "../../src/adapters/db/memory_store";
import { MemoryService } from "../../src/application/use_cases/memory_service";

const MODULE_ROOT = path.resolve(__dirname, "../../..");

function assertTrue(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): number {
  const filePath = path.join(
    MODULE_ROOT,
    "tests",
    "integration",
    "artifacts",
    "memory-store.persistence.test.json",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const store = new JsonMemoryStore(filePath);
  const service = new MemoryService(store);
  const campaignId = "camp-persist-01";

  service.setWikiWorldState({
    location_id: "lysenthe_port",
    governance: "ducat",
  });
  service.setWorldOverride(campaignId, "governance", "player_sovereign", "turn-10");
  service.appendEvent(
    campaignId,
    {
      event_id: "evt-01",
      origin_trigger_id: "trigger-01",
      created_at_turn: "turn-10",
    },
    "turn-10",
  );
  service.appendKnowledgePlayerView(
    campaignId,
    { fact: "Deux gardes filtrent l'entree." },
    "turn-10",
  );

  // Reopen store from disk to validate persistence
  const reloadedStore = new JsonMemoryStore(filePath);
  const reloadedService = new MemoryService(reloadedStore);
  const campaign = reloadedService.getCampaign(campaignId);

  assertTrue(campaign.world_overrides.governance === "player_sovereign", "world override not persisted");
  assertTrue(campaign.events.length === 1, "events not persisted");
  assertTrue(campaign.knowledge.player_view.length === 1, "player_view not persisted");
  assertTrue(campaign.updated_at_turn === "turn-10", "updated_at_turn not persisted");

  console.log("[PASS] integration test_memory_persistence");
  return 0;
}

process.exit(main());

