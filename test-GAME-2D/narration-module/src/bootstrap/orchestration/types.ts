import type {
  AggregateId,
  CampaignId,
  CommitId,
  EventId,
  IdempotencyKey,
  OperationId,
  RequestId
} from "../../core/contracts/types";
import type { CharacterImportCatalogV1, CharacterImportEnvelopeV1, CharacterImportResultV1 } from "../character/types";
import type {
  ContentEntryDescriptorV1,
  ContentPackageManifestV1,
  LoreEntityV1,
  Sha256Fingerprint
} from "../lore/types";
import type { CampaignBootstrapPersistenceResultV1 } from "../persistence/types";
import type { RuleDefinitionV1, RuleExecutorV1, RulesetManifestV1 } from "../rules/types";

export interface ResolvedContentEntryV1 {
  entryKind: ContentEntryDescriptorV1["entryKind"];
  entryId: string;
  /**
   * Development packages may retain their source text. Installed browser
   * packages retain only the build-time source fingerprint so private author
   * material is not shipped to the client.
   */
  sourceText: string | null;
  installedSourceFingerprint?: Sha256Fingerprint;
  payload: unknown;
}

export interface ResolvedContentPackageV1 {
  manifest: ContentPackageManifestV1;
  entries: ResolvedContentEntryV1[];
  loreEntities: LoreEntityV1[];
  characterCatalog: CharacterImportCatalogV1;
}

export interface ContentPackageResolverV1 {
  resolve(packageId: string, packageVersion: number): Promise<ResolvedContentPackageV1 | null>;
}

export interface ResolvedRulesetV1 {
  manifest: RulesetManifestV1;
  definitions: RuleDefinitionV1[];
  executors: RuleExecutorV1[];
}

export interface RulesetResolverV1 {
  resolve(rulesetId: string, rulesetVersion: number): Promise<ResolvedRulesetV1 | null>;
}

export interface CampaignBootstrapIdsV1 {
  campaignId: CampaignId;
  operationId: OperationId;
  clientRequestId: RequestId;
  idempotencyKey: IdempotencyKey;
  commitId: CommitId;
  eventId: EventId;
  clockAggregateId: AggregateId;
  characterAggregateId: AggregateId;
  tacticalProjectionAggregateId: AggregateId;
  narrativeProjectionAggregateId: AggregateId;
  positionAggregateId: AggregateId;
  bootstrapContextAggregateId: AggregateId;
}

export interface CampaignBootstrapInputV1 {
  schemaVersion: 1;
  ids: CampaignBootstrapIdsV1;
  contentPackageId: string;
  contentPackageVersion: number;
  rulesetId: string;
  rulesetVersion: number;
  calendarId: string;
  calendarVersion: number;
  initialLocationId: string;
  character: CharacterImportEnvelopeV1;
  requestedAt: string;
}

export type CampaignBootstrapDiagnosticCodeV1 =
  | "BOOTSTRAP_INPUT_INVALID"
  | "BOOTSTRAP_CONTENT_NOT_FOUND"
  | "BOOTSTRAP_CONTENT_MANIFEST_INVALID"
  | "BOOTSTRAP_CONTENT_ENTRY_MISSING"
  | "BOOTSTRAP_CONTENT_FINGERPRINT_MISMATCH"
  | "BOOTSTRAP_RULESET_NOT_FOUND"
  | "BOOTSTRAP_RULESET_INVALID"
  | "BOOTSTRAP_LOCATION_MISSING"
  | "BOOTSTRAP_LOCATION_TYPE_INVALID"
  | "BOOTSTRAP_LOCATION_CHAIN_INVALID"
  | "BOOTSTRAP_CHARACTER_INVALID"
  | "BOOTSTRAP_PROJECTION_RULE_MISMATCH"
  | "BOOTSTRAP_PERSISTENCE_FAILED";

export interface CampaignBootstrapDiagnosticV1 {
  code: CampaignBootstrapDiagnosticCodeV1;
  path: string;
  details: Record<string, unknown>;
}

export interface CampaignBootstrapResultV1 {
  persistence: CampaignBootstrapPersistenceResultV1;
  character: CharacterImportResultV1;
  geographicChain: string[];
  diagnostics: CampaignBootstrapDiagnosticV1[];
}

export type CampaignBootstrapOutcomeV1 =
  | { ok: true; value: CampaignBootstrapResultV1 }
  | { ok: false; diagnostics: CampaignBootstrapDiagnosticV1[] };
