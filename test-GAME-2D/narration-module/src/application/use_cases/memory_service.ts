import { JsonMemoryStore } from "../../adapters/db/memory_store";
import {
  addFragment,
  createNarrationEvent,
  transitionEventState,
  transitionFragmentState,
  updateEvolutiveFragmentPayload,
} from "../../domain/events/event_engine";
import { LifecycleState, NarrationEvent } from "../../domain/events/event_types";
import { projectMemory, ProjectedMemory } from "../../domain/memory/memory_projection";
import { CampaignMemory } from "../../domain/memory/memory_types";

export class MemoryService {
  private store: JsonMemoryStore;

  constructor(store: JsonMemoryStore) {
    this.store = store;
  }

  setWikiWorldState(worldState: Record<string, unknown>): void {
    this.store.setWikiWorldState(worldState);
  }

  getCampaign(campaignId: string): CampaignMemory {
    return this.store.loadCampaign(campaignId);
  }

  setWorldOverride(
    campaignId: string,
    key: string,
    value: unknown,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    campaign.world_overrides[key] = value;
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  appendEvent(
    campaignId: string,
    eventPayload: Record<string, unknown>,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    campaign.events.push(eventPayload);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  createNarrationEvent(
    campaignId: string,
    payload: {
      event_id: string;
      origin_trigger_id: string;
      created_at_turn: string;
      final: Record<string, unknown>;
    },
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const event = createNarrationEvent(payload);
    campaign.events.push(event as unknown as Record<string, unknown>);
    campaign.updated_at_turn = payload.created_at_turn;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  transitionNarrationEventState(
    campaignId: string,
    eventId: string,
    nextState: LifecycleState,
    turnId: string,
    reason: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const event = this.findEvent(campaign, eventId);
    transitionEventState(event, nextState, turnId, reason);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  addNarrationEventFragment(
    campaignId: string,
    eventId: string,
    fragment: {
      fragment_id: string;
      kind: "ponctuel" | "persistant" | "evolutif";
      payload: Record<string, unknown>;
      final_refs: string[];
    },
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const event = this.findEvent(campaign, eventId);
    addFragment(event, fragment, turnId);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  transitionNarrationFragmentState(
    campaignId: string,
    eventId: string,
    fragmentId: string,
    nextState: LifecycleState,
    turnId: string,
    reason: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const event = this.findEvent(campaign, eventId);
    transitionFragmentState(event, fragmentId, nextState, turnId, reason);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  patchEvolutiveFragment(
    campaignId: string,
    eventId: string,
    fragmentId: string,
    patch: Record<string, unknown>,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const event = this.findEvent(campaign, eventId);
    updateEvolutiveFragmentPayload(event, fragmentId, patch, turnId);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  appendKnowledgePlayerView(
    campaignId: string,
    item: Record<string, unknown>,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    campaign.knowledge.player_view.push(item);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  appendKnowledgeTruthView(
    campaignId: string,
    item: Record<string, unknown>,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    campaign.knowledge.truth_view.push(item);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  project(campaignId: string, localContext: Record<string, unknown>): ProjectedMemory {
    const wikiWorldState = this.store.getWikiWorldState();
    const campaignMemory = this.store.loadCampaign(campaignId);
    return projectMemory({
      wikiWorldState,
      campaignMemory,
      localContext,
    });
  }

  private findEvent(campaign: CampaignMemory, eventId: string): NarrationEvent {
    const event = campaign.events.find((e) => (e as Record<string, unknown>).event_id === eventId);
    if (!event) {
      throw new Error(`event not found: ${eventId}`);
    }
    return event as unknown as NarrationEvent;
  }
}
