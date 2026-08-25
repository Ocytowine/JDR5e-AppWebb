import {
  coreError,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRepository,
  type JsonObject,
  type Result
} from "../core";
import { loadActiveCampaignCharacterProfileV1, type CharacterAggregatePayloadV1 } from "../bootstrap";
import type { DisplayPacketV1 } from "../scene";
import { loadCompanionPartyRegistryV1, type CompanionPartyRegistryV1 } from "./companionPartyAuthority";
import { loadMissionRelationRegistryV1, type MissionRelationRegistryV1 } from "./missionRelationAuthority";
import { loadPlotRegistryV1, type PlotDiscoveryV1, type PlotPlayerHypothesisV1, type PlotRegistryV1 } from "./plotAuthority";
import type { PlayerPublicContextV1, PlayerPublicKnowledgeStatusV1 } from "./playerPublicContext";
import type { TravelProcessStateV1 } from "../time";

export const PLAYER_CAMPAIGN_RECAP_CONTRACT_V1 = "player-campaign-recap/1" as const;

export interface PlayerTravelSummaryProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "player-travel-summary/1";
  status: "STATIONARY" | "TRAVELLING" | "INTERRUPTED";
  currentLocationLabel: string;
  destinationLabel: string | null;
  perceptibleInterruption: string | null;
}

export interface PlayerCompanionSummaryProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "player-companion-summary/1";
  companions: Array<{
    displayName: string;
    membershipStatus: "WITH_PLAYER" | "SEPARATED";
    lastKnownLocation: string;
  }>;
}

export interface PlayerEngagementSummaryProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "player-engagement-summary/1";
  engagements: Array<{
    kind: "MISSION" | "RELATION";
    summary: string;
    status: "PROPOSED" | "ACCEPTED" | "REFUSED" | "CONDITIONAL" | "UNCERTAIN" | "COMPLETED";
    publicConditions: string[];
    publicOutcome: string | null;
  }>;
}

export interface PlayerPlotSummaryProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "player-plot-summary/1";
  threads: Array<{
    discoveries: Array<{ statement: string; status: PlayerPublicKnowledgeStatusV1 }>;
    expressedHypotheses: Array<{ statement: string; status: "UNCONFIRMED" | "SUPPORTED" | "REFUTED" }>;
    publicConclusion: string | null;
    openQuestion: string | null;
  }>;
}

export interface PlayerInventorySummaryProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "player-inventory-summary/1";
  items: Array<{
    label: string;
    quantity: number;
    equipped: boolean;
  }>;
  readOnly: true;
}

export interface PlayerChronicleSummaryProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "player-chronicle-summary/1";
  moments: Array<{ speaker: string; text: string }>;
}

export interface PlayerCampaignRecapV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLAYER_CAMPAIGN_RECAP_CONTRACT_V1;
  situation: {
    characterLabel: string;
    locationLabel: string;
    elapsedGameSeconds: number;
    travel: PlayerTravelSummaryProjectionV1;
  };
  peopleHere: Array<{ label: string; publicRole: string; visibleState: string }>;
  knownFacts: Array<{ statement: string; status: PlayerPublicKnowledgeStatusV1 }>;
  companions: PlayerCompanionSummaryProjectionV1["companions"];
  engagements: PlayerEngagementSummaryProjectionV1["engagements"];
  investigation: PlayerPlotSummaryProjectionV1["threads"];
  inventory: PlayerInventorySummaryProjectionV1;
  chronicle: PlayerChronicleSummaryProjectionV1["moments"];
  authority: "PLAYER_VISIBLE_READ_ONLY";
  deterministic: true;
  noCommit: true;
  noGameTime: true;
}

export function projectPlayerTravelSummaryV1(input: {
  context: PlayerPublicContextV1;
  activeTravel: TravelProcessStateV1 | null;
}): PlayerTravelSummaryProjectionV1 {
  if (input.activeTravel === null) return {
    schemaVersion: 1,
    contractVersion: "player-travel-summary/1",
    status: "STATIONARY",
    currentLocationLabel: input.context.location.label,
    destinationLabel: null,
    perceptibleInterruption: null
  };
  const process = input.activeTravel;
  return {
    schemaVersion: 1,
    contractVersion: "player-travel-summary/1",
    status: process.status === "INTERRUPTED" ? "INTERRUPTED" : "TRAVELLING",
    currentLocationLabel: humanize(process.checkpoint.currentLocationId),
    destinationLabel: humanize(process.plan.destinationLocationId),
    perceptibleInterruption: null
  };
}

export async function loadPlayerCompanionSummaryProjectionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  actorLabels?: ReadonlyMap<string, string>;
  sceneLabels?: ReadonlyMap<string, string>;
}): Promise<Result<PlayerCompanionSummaryProjectionV1>> {
  const loaded = await loadCompanionPartyRegistryV1(input);
  if (!loaded.ok) return loaded;
  return { ok: true, value: projectPlayerCompanionSummaryV1({
    registry: loaded.value.state,
    actorLabels: input.actorLabels,
    sceneLabels: input.sceneLabels
  }) };
}

export function projectPlayerCompanionSummaryV1(input: {
  registry: CompanionPartyRegistryV1 | null;
  actorLabels?: ReadonlyMap<string, string>;
  sceneLabels?: ReadonlyMap<string, string>;
}): PlayerCompanionSummaryProjectionV1 {
  const members = input.registry?.members ?? [];
  return {
    schemaVersion: 1,
    contractVersion: "player-companion-summary/1",
    companions: members
      .filter(member => member.status !== "LEFT")
      .map(member => ({
        displayName: input.actorLabels?.get(member.actorId) ?? humanize(member.actorId),
        membershipStatus: member.status === "ACTIVE" ? "WITH_PLAYER" as const : "SEPARATED" as const,
        lastKnownLocation: input.sceneLabels?.get(member.currentSceneId) ?? humanize(member.currentSceneId)
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
  };
}

export async function loadPlayerEngagementSummaryProjectionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): Promise<Result<PlayerEngagementSummaryProjectionV1>> {
  const loaded = await loadMissionRelationRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  return { ok: true, value: projectPlayerEngagementSummaryV1(loaded.value.state) };
}

export function projectPlayerEngagementSummaryV1(registry: MissionRelationRegistryV1): PlayerEngagementSummaryProjectionV1 {
  return {
    schemaVersion: 1,
    contractVersion: "player-engagement-summary/1",
    engagements: registry.engagements.map(engagement => ({
      kind: engagement.engagementKind,
      summary: engagement.summary,
      status: engagement.missionOutcome === null ? engagement.status : "COMPLETED" as const,
      publicConditions: engagement.resolution?.conditions.map(value => value.trim()).filter(Boolean) ?? [],
      publicOutcome: engagement.missionOutcome?.publicSummary ?? null
    }))
  };
}

export async function loadPlayerPlotSummaryProjectionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): Promise<Result<PlayerPlotSummaryProjectionV1>> {
  const loaded = await loadPlotRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  return { ok: true, value: projectPlayerPlotSummaryV1(loaded.value.state) };
}

export function projectPlayerPlotSummaryV1(registry: PlotRegistryV1): PlayerPlotSummaryProjectionV1 {
  const threads = registry.plots.map(plot => {
    const discoveries = readArray<PlotDiscoveryV1>(plot.discoveries);
    const hypotheses = readArray<PlotPlayerHypothesisV1>(plot.playerHypotheses);
    const resolution = asObject(plot.resolution) as { conclusion?: unknown } | null;
    return {
      discoveries: discoveries.map(discovery => ({
        statement: discovery.statement,
        status: discovery.presentation === "TESTIMONY" ? "HEARD" as const : "OBSERVED" as const
      })),
      expressedHypotheses: hypotheses.map(hypothesis => ({
        statement: hypothesis.statement,
        status: hypothesis.status
      })),
      publicConclusion: typeof resolution?.conclusion === "string" ? resolution.conclusion : null,
      openQuestion: plot.status === "ACTIVE" ? "Que reste-t-il à comprendre à partir de ces indices ?" : null
    };
  }).filter(thread => thread.discoveries.length > 0 || thread.expressedHypotheses.length > 0 || thread.publicConclusion !== null);
  return { schemaVersion: 1, contractVersion: "player-plot-summary/1", threads };
}

export async function loadPlayerInventorySummaryProjectionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  itemLabels?: ReadonlyMap<string, string>;
}): Promise<Result<PlayerInventorySummaryProjectionV1>> {
  const profile = await loadActiveCampaignCharacterProfileV1(input);
  if (!profile.ok) return profile;
  const aggregate = await input.repository.getAggregate(input.campaignId, "character.state", profile.value.characterStateAggregateId);
  if (!aggregate.ok) return aggregate;
  const character = aggregate.value.payload as unknown as CharacterAggregatePayloadV1;
  if (!Array.isArray(character.inventory)) return {
    ok: false,
    error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "player-recap.character-inventory-invalid")
  };
  return { ok: true, value: projectPlayerInventorySummaryV1({ character, itemLabels: input.itemLabels }) };
}

export function projectPlayerInventorySummaryV1(input: {
  character: CharacterAggregatePayloadV1;
  itemLabels?: ReadonlyMap<string, string>;
}): PlayerInventorySummaryProjectionV1 {
  return {
    schemaVersion: 1,
    contractVersion: "player-inventory-summary/1",
    items: input.character.inventory.map(item => ({
      label: input.itemLabels?.get(item.itemId) ?? humanize(item.itemId),
      quantity: item.quantity,
      equipped: item.equippedSlot !== null
    })).sort((left, right) => Number(right.equipped) - Number(left.equipped) || left.label.localeCompare(right.label)),
    readOnly: true
  };
}

export function projectPlayerChronicleSummaryV1(packets: readonly DisplayPacketV1[]): PlayerChronicleSummaryProjectionV1 {
  const publicKinds = new Set(["PLAYER_EXPRESSION", "GM_NARRATION", "NPC_SPEECH", "CLARIFICATION"]);
  const moments = packets.flatMap(packet => packet.displayBlocks)
    .filter(block => publicKinds.has(block.kind) && block.text.trim().length > 0)
    .map(block => ({ speaker: block.speaker.displayName, text: block.text.trim() }))
    .slice(-8);
  return { schemaVersion: 1, contractVersion: "player-chronicle-summary/1", moments };
}

export async function loadPlayerCampaignClockSecondV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): Promise<Result<number>> {
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const clock = await input.repository.getAggregate(input.campaignId, "world.clock", campaign.value.clockAggregateId);
  if (!clock.ok) return clock;
  const elapsed = (clock.value.payload as CampaignClockPayload).elapsedGameSeconds;
  return Number.isInteger(elapsed) && elapsed >= 0
    ? { ok: true, value: elapsed }
    : { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "player-recap.clock-invalid") };
}

export function composePlayerCampaignRecapV1(input: {
  context: PlayerPublicContextV1;
  elapsedGameSeconds: number;
  travel: PlayerTravelSummaryProjectionV1;
  companions: PlayerCompanionSummaryProjectionV1;
  engagements: PlayerEngagementSummaryProjectionV1;
  plots: PlayerPlotSummaryProjectionV1;
  inventory: PlayerInventorySummaryProjectionV1;
  chronicle: PlayerChronicleSummaryProjectionV1;
}): PlayerCampaignRecapV1 {
  return {
    schemaVersion: 1,
    contractVersion: PLAYER_CAMPAIGN_RECAP_CONTRACT_V1,
    situation: {
      characterLabel: input.context.character.label,
      locationLabel: input.context.location.label,
      elapsedGameSeconds: input.elapsedGameSeconds,
      travel: input.travel
    },
    peopleHere: input.context.presentActors.map(actor => ({ label: actor.label, publicRole: actor.publicRole, visibleState: actor.visibleState })),
    knownFacts: input.context.knownFacts.map(fact => ({ statement: fact.statement, status: fact.status })),
    companions: input.companions.companions,
    engagements: input.engagements.engagements,
    investigation: input.plots.threads,
    inventory: input.inventory,
    chronicle: input.chronicle.moments,
    authority: "PLAYER_VISIBLE_READ_ONLY",
    deterministic: true,
    noCommit: true,
    noGameTime: true
  };
}

function humanize(value: string): string {
  const tail = value.split(":").at(-1) ?? value;
  return tail.replace(/[_-]+/gu, " ").replace(/^./u, letter => letter.toUpperCase());
}

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter(entry => entry !== null && typeof entry === "object") as T[] : [];
}

function asObject(value: unknown): object | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
