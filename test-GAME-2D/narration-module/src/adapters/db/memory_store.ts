import fs from "node:fs";
import path from "node:path";

import { CampaignMemory, MemoryStoreData } from "../../domain/memory/memory_types";

function defaultCampaignMemory(campaignId: string): CampaignMemory {
  return {
    campaign_id: campaignId,
    events: [],
    relations: [],
    knowledge: {
      player_view: [],
      truth_view: [],
    },
    world_overrides: {},
    updated_at_turn: null,
  };
}

function defaultStore(): MemoryStoreData {
  return {
    schema_version: "1.0.0",
    wiki: {
      world_state: {},
    },
    campaigns: {},
  };
}

export class JsonMemoryStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.write(defaultStore());
    }
  }

  read(): MemoryStoreData {
    const raw = fs.readFileSync(this.filePath, "utf-8");
    const parsed = JSON.parse(raw) as MemoryStoreData;
    if (parsed.schema_version !== "1.0.0") {
      throw new Error("unsupported memory store schema_version");
    }
    return parsed;
  }

  write(data: MemoryStoreData): void {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  setWikiWorldState(worldState: Record<string, unknown>): void {
    const data = this.read();
    data.wiki.world_state = worldState;
    this.write(data);
  }

  getWikiWorldState(): Record<string, unknown> {
    return this.read().wiki.world_state;
  }

  loadCampaign(campaignId: string): CampaignMemory {
    const data = this.read();
    const existing = data.campaigns[campaignId];
    if (existing) {
      return existing;
    }
    const created = defaultCampaignMemory(campaignId);
    data.campaigns[campaignId] = created;
    this.write(data);
    return created;
  }

  saveCampaign(campaign: CampaignMemory): void {
    const data = this.read();
    data.campaigns[campaign.campaign_id] = campaign;
    this.write(data);
  }
}

