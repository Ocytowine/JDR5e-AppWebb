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
    "memory-store.player-compaction.test.json",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const store = new JsonMemoryStore(filePath);
  const service = new MemoryService(store);
  const campaignId = "camp-player-memory-01";

  service.appendAutoPlayerSummary(
    campaignId,
    {
      text: "Observer la place des archives.",
      location_id: "quartier_des_archives",
      tags: ["observe"],
    },
    "turn-1",
  );
  service.appendAutoPlayerSummary(
    campaignId,
    {
      text: "Observer la place des archives",
      location_id: "quartier_des_archives",
      tags: ["observe"],
    },
    "turn-2",
  );

  service.appendAutoPlayerLead(
    campaignId,
    { text: "Parler au clerc.", location_id: "quartier_des_archives" },
    "turn-3",
  );
  service.appendAutoPlayerLead(
    campaignId,
    { text: "Parler a l'archiviste.", location_id: "quartier_des_archives" },
    "turn-4",
  );
  service.appendAutoPlayerLead(
    campaignId,
    { text: "Examiner le batiment voisin.", location_id: "quartier_des_archives" },
    "turn-5",
  );
  service.appendAutoPlayerLead(
    campaignId,
    { text: "Chercher un acces secondaire.", location_id: "quartier_des_archives" },
    "turn-6",
  );

  service.appendKnowledgePlayerView(
    campaignId,
    {
      text: "Note joueur: verifier les sceaux.",
      knowledge_kind: "player_note",
      certainty: "partial",
      source: "player_manual",
      location_id: "quartier_des_archives",
    },
    "turn-7",
  );

  const campaign = service.getCampaign(campaignId);
  const playerView = campaign.knowledge.player_view;
  const summaries = playerView.filter((entry) => entry.knowledge_kind === "summary");
  const leads = playerView.filter((entry) => entry.knowledge_kind === "lead");
  const manualNotes = playerView.filter((entry) => entry.source === "player_manual");

  assertTrue(summaries.length === 1, "duplicate auto summaries should be deduplicated");
  assertTrue(leads.length === 3, "auto leads should be capped at 3 per location");
  assertTrue(manualNotes.length === 1, "manual notes should be preserved");
  assertTrue(
    leads.every((entry) => entry.location_id === "quartier_des_archives"),
    "kept leads should remain scoped to the original location",
  );

  console.log("[PASS] integration test_player_memory_compaction");
  return 0;
}

process.exit(main());
