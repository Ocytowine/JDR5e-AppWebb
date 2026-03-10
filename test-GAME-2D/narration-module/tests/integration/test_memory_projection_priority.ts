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
    "memory-store.projection.test.json",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const store = new JsonMemoryStore(filePath);
  const service = new MemoryService(store);
  const campaignId = "camp-projection-01";

  service.setWikiWorldState({
    governance: "ducat",
    weather: "clear",
    district: "archives",
  });
  service.setWorldOverride(campaignId, "governance", "player_sovereign", "turn-20");
  service.setWorldOverride(campaignId, "weather", "storm", "turn-20");
  service.setWorldOverride(campaignId, "location_id", "camp_location", "turn-20");

  const projected = service.project(campaignId, {
    location_id: "local_location",
    weather: "fog",
    district: "parvis_archives",
  });
  const world = projected.effective_world_state;

  // Hierarchy: local > campaign > wiki
  assertTrue(world.governance === "player_sovereign", "campaign override should beat wiki");
  assertTrue(world.weather === "fog", "local context should beat campaign override");
  assertTrue(world.district === "parvis_archives", "local context should beat wiki");
  assertTrue(world.location_id === "local_location", "local location should beat campaign location");
  assertTrue(!("location_id" in service.resolveEffectiveTruth(campaignId, {}).wiki_base), "wiki should not carry local location state by default");
  assertTrue(!("map_prompt" in service.resolveEffectiveTruth(campaignId, {}).wiki_base), "wiki should not carry transient map prompt state");

  console.log("[PASS] integration test_memory_projection_priority");
  return 0;
}

process.exit(main());

