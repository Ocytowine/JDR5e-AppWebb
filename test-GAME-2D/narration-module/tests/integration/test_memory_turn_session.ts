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
    "memory-store.turn-session.test.json",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const store = new JsonMemoryStore(filePath);
  const service = new MemoryService(store);
  const campaignId = "camp-turn-session-01";

  service.beginTurnSession(campaignId, "turn-1");
  service.advanceCampaignTurn(campaignId, "turn-1");
  service.setWorldOverride(campaignId, "location_id", "quartier_des_archives", "turn-1");
  service.appendKnowledgePlayerView(campaignId, { fact: "Une piste apparait." }, "turn-1");

  const rawDuringSession = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
    campaigns?: Record<string, {
      clock?: { turn_index?: number };
      world_overrides?: Record<string, unknown>;
      knowledge?: { player_view?: unknown[] };
    }>;
  };
  const persistedDuringSession = rawDuringSession.campaigns?.[campaignId];
  assertTrue(
    persistedDuringSession?.clock?.turn_index === 0,
    "turn mutations should not persist before flush",
  );
  assertTrue(
    (persistedDuringSession?.world_overrides?.location_id ?? null) === null,
    "world override mutations should not persist before flush",
  );
  assertTrue(
    Array.isArray(persistedDuringSession?.knowledge?.player_view) &&
      persistedDuringSession.knowledge.player_view.length === 0,
    "knowledge mutations should not persist before flush",
  );

  service.flushTurnSession(campaignId);

  const reloadedStore = new JsonMemoryStore(filePath);
  const reloadedService = new MemoryService(reloadedStore);
  const campaign = reloadedService.getCampaign(campaignId);
  assertTrue(campaign.clock.turn_index === 1, "turn_index should persist after flush");
  assertTrue(
    campaign.world_overrides.location_id === "quartier_des_archives",
    "world override should persist after flush",
  );
  assertTrue(
    campaign.knowledge.player_view.length === 1,
    "knowledge should persist after flush",
  );

  service.beginTurnSession(campaignId, "turn-2");
  service.setWorldOverride(campaignId, "location_id", "port_des_xantars", "turn-2");
  service.discardTurnSession(campaignId);

  const discardedStore = new JsonMemoryStore(filePath);
  const discardedService = new MemoryService(discardedStore);
  const discardedCampaign = discardedService.getCampaign(campaignId);
  assertTrue(
    discardedCampaign.world_overrides.location_id === "quartier_des_archives",
    "discard should drop unflushed session changes",
  );

  console.log("[PASS] integration test_memory_turn_session");
  return 0;
}

process.exit(main());
