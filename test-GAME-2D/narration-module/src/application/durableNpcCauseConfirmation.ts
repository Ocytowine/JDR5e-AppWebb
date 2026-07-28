import type { JsonObject } from "../core";
import type { CampaignNpcPromotionCauseV1 } from "./campaignNpcPromotion";

export const DURABLE_NPC_CAUSE_CONFIRMATION_VERSION_V1 = "durable-npc-cause-confirmation/1" as const;

export interface DurableNpcCauseConfirmationV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof DURABLE_NPC_CAUSE_CONFIRMATION_VERSION_V1;
  engagementId: string;
  ownerCommandId: string;
  ownerAuthority: true;
  cause: CampaignNpcPromotionCauseV1;
}
