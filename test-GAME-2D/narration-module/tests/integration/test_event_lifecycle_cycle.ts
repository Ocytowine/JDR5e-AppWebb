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

function expectThrow(fn: () => void, message: string): void {
  let caught = false;
  try {
    fn();
  } catch {
    caught = true;
  }
  assertTrue(caught, message);
}

function main(): number {
  const filePath = path.join(
    MODULE_ROOT,
    "tests",
    "integration",
    "artifacts",
    "memory-store.event-lifecycle.test.json",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const service = new MemoryService(new JsonMemoryStore(filePath));
  const campaignId = "camp-event-lifecycle-01";
  const eventId = "evt-lifecycle-01";

  service.createNarrationEvent(campaignId, {
    event_id: eventId,
    origin_trigger_id: "trigger-evt-01",
    created_at_turn: "turn-01",
    final: {
      culprit_id: "npc-01",
      target_doc: "archives-doc-7",
    },
  });

  service.transitionNarrationEventState(
    campaignId,
    eventId,
    "pertinent",
    "turn-02",
    "player_moved_away",
  );
  service.transitionNarrationEventState(
    campaignId,
    eventId,
    "dormant",
    "turn-03",
    "no_recent_interaction",
  );

  const campaign = service.getCampaign(campaignId);
  const event = campaign.events.find(
    (e) => (e as Record<string, unknown>).event_id === eventId,
  ) as Record<string, unknown>;
  assertTrue(event.status === "dormant", "event should be dormant after transitions");

  // Invalid transition dormant -> actif (must pass by pertinent)
  expectThrow(
    () =>
      service.transitionNarrationEventState(
        campaignId,
        eventId,
        "actif",
        "turn-04",
        "invalid_direct_reactivation",
      ),
    "expected invalid transition to throw",
  );

  console.log("[PASS] integration test_event_lifecycle_cycle");
  return 0;
}

process.exit(main());

