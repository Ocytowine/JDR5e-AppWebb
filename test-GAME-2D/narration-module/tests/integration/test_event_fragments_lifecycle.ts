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
    "memory-store.event-fragments.test.json",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const service = new MemoryService(new JsonMemoryStore(filePath));
  const campaignId = "camp-event-frag-01";
  const eventId = "evt-frag-01";

  service.createNarrationEvent(campaignId, {
    event_id: eventId,
    origin_trigger_id: "trigger-frag-01",
    created_at_turn: "turn-01",
    final: {
      culprit_id: "npc-culprit",
      escape_route: "east_dock",
    },
  });

  // Valid fragment
  service.addNarrationEventFragment(
    campaignId,
    eventId,
    {
      fragment_id: "frag-01",
      kind: "evolutif",
      payload: { seen: "silhouette" },
      final_refs: ["escape_route"],
    },
    "turn-02",
  );

  service.patchEvolutiveFragment(
    campaignId,
    eventId,
    "frag-01",
    { seen: "silhouette_with_blue_cloak" },
    "turn-03",
  );

  service.transitionNarrationFragmentState(
    campaignId,
    eventId,
    "frag-01",
    "pertinent",
    "turn-04",
    "left_scene_but_relevant",
  );

  // Invalid fragment: ref absent from final
  expectThrow(
    () =>
      service.addNarrationEventFragment(
        campaignId,
        eventId,
        {
          fragment_id: "frag-invalid",
          kind: "ponctuel",
          payload: { noise: "cri" },
          final_refs: ["unknown_final_key"],
        },
        "turn-05",
      ),
    "expected invalid final ref to throw",
  );

  const campaign = service.getCampaign(campaignId);
  const event = campaign.events.find(
    (e) => (e as Record<string, unknown>).event_id === eventId,
  ) as Record<string, unknown>;
  const fragments = Array.isArray(event.fragments)
    ? (event.fragments as Array<Record<string, unknown>>)
    : [];
  assertTrue(fragments.length === 1, "only valid fragment should be persisted");
  assertTrue(fragments[0].status === "pertinent", "fragment lifecycle should be updated");
  assertTrue(
    (fragments[0].payload as Record<string, unknown>).seen === "silhouette_with_blue_cloak",
    "evolutive payload patch should be persisted",
  );

  console.log("[PASS] integration test_event_fragments_lifecycle");
  return 0;
}

process.exit(main());

