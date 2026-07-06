import type { Result } from "../../core/contracts/types";
import type {
  CampaignBootstrapPersistenceRequestV1,
  CampaignBootstrapPersistenceResultV1
} from "./types";

export interface CampaignBootstrapRepository {
  bootstrapCampaign(
    request: CampaignBootstrapPersistenceRequestV1
  ): Promise<Result<CampaignBootstrapPersistenceResultV1>>;
}
