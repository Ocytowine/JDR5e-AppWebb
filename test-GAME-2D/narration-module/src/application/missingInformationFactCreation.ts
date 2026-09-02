import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import {
  MAX_BILLABLE_AI_CALLS_WITH_FACT_CREATION_V1,
  raiseActiveAiCallBudgetLimitV1
} from "../ai/callBudget";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type {
  AiCallRequestV1,
  AiCallTelemetryV1,
  AiModelRouteV1,
  AiRetryPolicyV1,
  AiRoleOutputEnvelopeV1
} from "../ai/types";
import type { NarrativeLoreBuildCatalogV1 } from "../context";
import { computeJsonFingerprint, opaqueId, type AggregateRecord, type CampaignId, type CampaignRepository, type JsonObject, type OperationId } from "../core";
import {
  CAMPAIGN_FACT_MUTATION_CONTRACT_VERSION_V1,
  activeCampaignFactV1,
  createCampaignFactLoreAnchorValidatorV1,
  prepareCampaignFactMutationV1,
  type CampaignFactMutationCommandV1,
  type PrepareCampaignFactMutationResultV1
} from "./campaignFactAuthority";
import { loadCampaignFactRegistryV1, loadNarrativeActorRegistryV1, mutateCampaignFactV1 } from "./campaignFactRuntime";
import type { ResolvedInformationCandidateV1 } from "./npcInformationResolution";
import type { TargetedLoreMissingPropertyV1 } from "./targetedLoreInformationLookup";
import { prepareNarrativeRoleContextV1 } from "./narrativeContextManifest";

export const MISSING_INFORMATION_FACT_PROPOSAL_CONTRACT_V1 =
  "missing-information-fact-proposal/1" as const;

export interface MissingInformationFactProposalV1 extends JsonObject {
  proposalId: string;
  propertyRef: string;
  valueKind: "TEXT" | "IDENTITY";
  generatedValue: string;
  authority: "PROPOSE_ONLY_NO_COMMIT";
}

export interface MissingInformationFactGeneratorConfigV1 {
  provider: ContractAiProviderV1;
  route: AiModelRouteV1 & { role: "scene_creator" };
  retryPolicy: AiRetryPolicyV1 & { role: "scene_creator" };
}

export interface MissingInformationFactCreationResultV1 {
  schemaVersion: 1;
  status: "CREATED" | "PREPARED" | "REUSED" | "SKIPPED" | "FAILED";
  propertyRef: string | null;
  factId: string | null;
  identityRef: string | null;
  commitId: string | null;
  reason: string;
  telemetry: AiCallTelemetryV1[];
  performerMayCreateFacts: false;
  commitPreparation: CampaignFactCommitPreparationV1 | null;
}

export interface CampaignFactCommitPreparationV1 {
  factAggregate: AggregateRecord | null;
  actorAggregate: AggregateRecord | null;
  prepared: Extract<PrepareCampaignFactMutationResultV1, { ok: true; status: "READY" }>;
  command: CampaignFactMutationCommandV1;
  occurredAtGameSecond: number;
}

export interface MissingInformationFactCreationRuntimeV1 {
  maybeCreate(input: {
    operationId: string;
    missingProperties: TargetedLoreMissingPropertyV1[];
    candidates: ResolvedInformationCandidateV1[];
  }): Promise<MissingInformationFactCreationResultV1>;
}

export function createCampaignMissingInformationFactCreationRuntimeV1(input: {
  catalog: NarrativeLoreBuildCatalogV1;
  repository: CampaignRepository;
  campaignId: CampaignId;
  generatorConfig: MissingInformationFactGeneratorConfigV1;
}): MissingInformationFactCreationRuntimeV1 {
  const anchorValidator = createCampaignFactLoreAnchorValidatorV1(input.catalog);
  return {
    async maybeCreate(request) {
      const property = request.missingProperties.find(candidate => candidate.creationMode !== "FORBIDDEN");
      if (property === undefined) return skipped("no owner-authorized missing property");
      const current = await loadCampaignFactRegistryV1(input.repository, input.campaignId);
      if (!current.ok) return failed(property.propertyRef, current.error.messageKey, []);
      const existing = activeCampaignFactV1(current.value.state, property.subjectRef, property.fieldPath);
      if (existing !== null) return reused(property.propertyRef, existing.factId, existing.objectRef);

      const supportingCandidates = request.candidates.filter(candidate =>
        candidate.visibility === "PLAYER_VISIBLE"
        && candidate.value !== null
        && candidate.sourceRefs.every(isPublicRef)
      );
      const sourceRefs = unique(supportingCandidates.flatMap(candidate => candidate.sourceRefs));
      if (!sourceRefs.some(ref => ref.startsWith("lore-fact:") || ref.startsWith("lore-fragment:"))) {
        return skipped("creation requires a public authored lore source", property.propertyRef);
      }
      const identityRole = property.creationMode === "IDENTITY"
        ? resolveIdentityRole(property, supportingCandidates)
        : null;
      if (property.creationMode === "IDENTITY" && identityRole === null) {
        return skipped("identity creation requires an authored public role property", property.propertyRef);
      }
      raiseActiveAiCallBudgetLimitV1(
        request.operationId,
        MAX_BILLABLE_AI_CALLS_WITH_FACT_CREATION_V1
      );
      const generated = await generateMissingInformationFactProposalV1({
        campaignId: input.campaignId,
        operationId: request.operationId,
        property,
        identityRole,
        supportingCandidates,
        config: input.generatorConfig
      });
      if (!generated.ok) return failed(property.propertyRef, generated.issues.join("; "), generated.telemetry);
      const identityRef = property.creationMode === "IDENTITY"
        ? await stableIdentityRef(property, generated.proposal.generatedValue)
        : null;
      const command: CampaignFactMutationCommandV1 = {
        schemaVersion: 1,
        contractVersion: CAMPAIGN_FACT_MUTATION_CONTRACT_VERSION_V1,
        clientRequestId: `${request.operationId}:${property.propertyRef}`,
        mutationKind: "ASSERT",
        subjectRef: property.subjectRef,
        predicate: property.fieldPath,
        objectText: property.creationMode === "TEXT" ? generated.proposal.generatedValue : null,
        proposedIdentity: property.creationMode === "IDENTITY" ? {
          identityRef: identityRef!,
          displayName: generated.proposal.generatedValue,
          publicRole: identityRole!
        } : null,
        expectedCurrentFactId: null,
        knowledgeLevel: property.knowledgeLevel,
        sourceRefs,
        validatorDomains: ["CAMPAIGN_FACT", "LORE"]
      };
      const activeParent = await input.repository.getOperation(opaqueId<OperationId>(request.operationId));
      if (activeParent.ok && ["RECEIVED", "PREPARING", "READY_TO_COMMIT"].includes(activeParent.value.phase)) {
        const campaign = await input.repository.getCampaign(input.campaignId);
        const actors = await loadNarrativeActorRegistryV1(input.repository, input.campaignId);
        if (!campaign.ok) return failed(property.propertyRef, campaign.error.messageKey, generated.telemetry);
        if (!actors.ok) return failed(property.propertyRef, actors.error.messageKey, generated.telemetry);
        const anchorIssues = anchorValidator.validate(command);
        if (anchorIssues.length > 0) return failed(property.propertyRef, anchorIssues.join("; "), generated.telemetry);
        const prepared = prepareCampaignFactMutationV1({
          campaignId: input.campaignId,
          operationId: request.operationId,
          occurredAtGameSecond: 0,
          resultingCampaignRevision: campaign.value.campaignRevision + 1,
          command,
          facts: current.value.state,
          actors: actors.value.state
        });
        if (!prepared.ok || prepared.status !== "READY") {
          return failed(property.propertyRef, prepared.ok ? "campaign fact is already current" : prepared.issues.join("; "), generated.telemetry);
        }
        return {
          schemaVersion: 1,
          status: "PREPARED",
          propertyRef: property.propertyRef,
          factId: prepared.fact?.factId ?? null,
          identityRef: prepared.identity?.identityRef ?? null,
          commitId: null,
          reason: "PARENT_OPERATION_ATOMIC_COMMIT",
          telemetry: generated.telemetry,
          performerMayCreateFacts: false,
          commitPreparation: {
            factAggregate: current.value.aggregate,
            actorAggregate: actors.value.aggregate,
            prepared,
            command,
            occurredAtGameSecond: 0
          }
        };
      }
      const mutation = await mutateCampaignFactV1({
        repository: input.repository,
        campaignId: input.campaignId,
        anchorValidator,
        command
      });
      if (mutation.ok) return {
        schemaVersion: 1,
        status: mutation.value.outcome === "ALREADY_CURRENT" ? "REUSED" : "CREATED",
        propertyRef: property.propertyRef,
        factId: mutation.value.fact?.factId ?? null,
        identityRef: mutation.value.identity?.identityRef ?? null,
        commitId: mutation.value.commitId,
        reason: mutation.value.outcome,
        telemetry: generated.telemetry,
        performerMayCreateFacts: false,
        commitPreparation: null
      };
      const afterConflict = await loadCampaignFactRegistryV1(input.repository, input.campaignId);
      const wonByAnotherRequest = afterConflict.ok
        ? activeCampaignFactV1(afterConflict.value.state, property.subjectRef, property.fieldPath)
        : null;
      return wonByAnotherRequest === null
        ? failed(property.propertyRef, mutation.error.messageKey, generated.telemetry)
        : { ...reused(property.propertyRef, wonByAnotherRequest.factId, wonByAnotherRequest.objectRef), telemetry: generated.telemetry };
    }
  };
}

export async function generateMissingInformationFactProposalV1(input: {
  campaignId: string;
  operationId: string;
  property: TargetedLoreMissingPropertyV1;
  identityRole: string | null;
  supportingCandidates: ResolvedInformationCandidateV1[];
  config: MissingInformationFactGeneratorConfigV1;
}): Promise<
  | { ok: true; proposal: MissingInformationFactProposalV1; telemetry: AiCallTelemetryV1[] }
  | { ok: false; issues: string[]; telemetry: AiCallTelemetryV1[] }
> {
  const request = await buildProposalRequest(input);
  const run = await runAiPipelineCallV1({
    provider: input.config.provider,
    route: input.config.route,
    retryPolicy: input.config.retryPolicy,
    request
  });
  if (run.acceptedOutput === null) return { ok: false, issues: run.validation.issues, telemetry: run.telemetry };
  const proposal = (run.acceptedOutput as AiRoleOutputEnvelopeV1<MissingInformationFactProposalV1>).payload;
  const issues = validateProposal(proposal, input.property);
  return issues.length > 0
    ? { ok: false, issues, telemetry: run.telemetry }
    : { ok: true, proposal, telemetry: run.telemetry };
}

async function buildProposalRequest(input: {
  campaignId: string;
  operationId: string;
  property: TargetedLoreMissingPropertyV1;
  identityRole: string | null;
  supportingCandidates: ResolvedInformationCandidateV1[];
  config: MissingInformationFactGeneratorConfigV1;
}): Promise<AiCallRequestV1> {
  const context = {
    schemaVersion: 1,
    authority: "PROPOSE_ONLY_NO_COMMIT",
    target: {
      propertyRef: input.property.propertyRef,
      subjectRef: input.property.subjectRef,
      publicLabel: input.property.publicLabel,
      valueKind: input.property.creationMode,
      identityRole: input.identityRole
    },
    publicContextFacts: input.supportingCandidates.map(candidate => ({
      subjectRef: candidate.subjectRef,
      property: candidate.property,
      value: candidate.value,
      sourceRefs: candidate.sourceRefs
    })),
    constraints: [
      "propose one concise public value compatible with the supplied facts",
      "do not create secrets, mechanics, commitments or additional entities",
      "do not commit or choose persistence"
    ]
  };
  const task = { context, requiredOutput: MISSING_INFORMATION_FACT_PROPOSAL_CONTRACT_V1 };
  const snapshotId = `${input.operationId}:snapshot:missing-information-fact`;
  const preparedContext = prepareNarrativeRoleContextV1({
    manifestId: `${input.operationId}:context-manifest:missing-information-fact`,
    operationId: input.operationId,
    campaignId: input.campaignId,
    snapshot: { snapshotId, campaignRevision: null, sceneId: null, sceneVersion: null },
    role: "scene_creator",
    profileId: `${input.operationId}:missing-public-fact-creation`,
    purpose: "Proposer uniquement la valeur publique explicitement manquante.",
    taskContextRef: "task.context",
    authority: "PROPOSE_ONLY_NO_COMMIT",
    projections: [{
      projectionKey: "missing-fact-target",
      kind: "MISSING_FACT_TARGET",
      payload: context.target,
      ownerId: "application/targeted-lore-information-lookup",
      sourceRefs: [input.property.propertyRef, input.property.subjectRef],
      sourceVersion: "targeted-lore-missing-property/1",
      required: true
    }, {
      projectionKey: "creation-policy",
      kind: "CREATION_POLICY",
      payload: context.constraints,
      ownerId: "application/missing-information-fact-creation",
      sourceRefs: [input.property.propertyRef],
      sourceVersion: "missing-information-fact-policy/1",
      required: true
    }, {
      projectionKey: "public-sources",
      kind: "PUBLIC_SOURCE_REFS",
      payload: context.publicContextFacts,
      ownerId: "application/campaign-information-lookup",
      sourceRefs: context.publicContextFacts.flatMap(fact => fact.sourceRefs),
      sourceVersion: "resolved-information-candidates/1",
      required: false
    }]
  });
  const roleContextPack = preparedContext.roleContextPack;
  return {
    schemaVersion: 1,
    callId: `${input.operationId}:ai:missing-information-fact:call`,
    operationId: input.operationId,
    attemptId: `${input.operationId}:ai:missing-information-fact:attempt:1`,
    campaignId: input.campaignId,
    snapshotId,
    packId: `${input.operationId}:pack:missing-information-fact`,
    role: "scene_creator",
    contractVersion: MISSING_INFORMATION_FACT_PROPOSAL_CONTRACT_V1,
    modelRouteId: input.config.route.routeId,
    contextFingerprint: await computeJsonFingerprint({ contextManifest: preparedContext.manifest, task }) as `sha256:${string}`,
    idempotencyKey: `${input.operationId}:missing-information-fact:${input.property.propertyRef}`,
    input: { instructionsRef: "scene-creator/missing-information-fact/v1", roleContextPack, task },
    limits: {
      inputTokenBudget: input.config.route.inputTokenLimit,
      outputTokenBudget: Math.min(600, input.config.route.outputTokenLimit),
      timeoutMs: input.config.route.timeoutMs
    }
  };
}

function validateProposal(value: MissingInformationFactProposalV1, property: TargetedLoreMissingPropertyV1): string[] {
  const issues: string[] = [];
  if (!value || typeof value !== "object") return ["proposal must be an object"];
  if (!value.proposalId?.trim()) issues.push("proposalId is required");
  if (value.propertyRef !== property.propertyRef) issues.push("proposal property escaped the authorized target");
  if (value.valueKind !== property.creationMode || !["TEXT", "IDENTITY"].includes(value.valueKind)) issues.push("proposal value kind is invalid");
  if (!value.generatedValue?.trim() || value.generatedValue.length > 160) issues.push("generated value is invalid");
  if (value.authority !== "PROPOSE_ONLY_NO_COMMIT") issues.push("proposal authority is invalid");
  return issues;
}

function resolveIdentityRole(
  property: TargetedLoreMissingPropertyV1,
  candidates: ResolvedInformationCandidateV1[]
): string | null {
  if (property.identityRolePropertyRef === null) return null;
  const expectedPath = `/${property.identityRolePropertyRef.split(":").at(-1)}`;
  return candidates.find(candidate => candidate.subjectRef === property.subjectRef && candidate.property === expectedPath)?.value ?? null;
}

async function stableIdentityRef(property: TargetedLoreMissingPropertyV1, value: string): Promise<string> {
  const fingerprint = await computeJsonFingerprint({ propertyRef: property.propertyRef, value: value.trim() });
  return `narrative-actor:generated-${fingerprint.slice("sha256:".length, "sha256:".length + 16)}`;
}

function skipped(reason: string, propertyRef: string | null = null): MissingInformationFactCreationResultV1 {
  return { schemaVersion: 1, status: "SKIPPED", propertyRef, factId: null, identityRef: null, commitId: null, reason, telemetry: [], performerMayCreateFacts: false, commitPreparation: null };
}

function failed(propertyRef: string, reason: string, telemetry: AiCallTelemetryV1[]): MissingInformationFactCreationResultV1 {
  return { schemaVersion: 1, status: "FAILED", propertyRef, factId: null, identityRef: null, commitId: null, reason, telemetry, performerMayCreateFacts: false, commitPreparation: null };
}

function reused(propertyRef: string, factId: string, identityRef: string | null): MissingInformationFactCreationResultV1 {
  return { schemaVersion: 1, status: "REUSED", propertyRef, factId, identityRef, commitId: null, reason: "active campaign fact reused", telemetry: [], performerMayCreateFacts: false, commitPreparation: null };
}

function isPublicRef(ref: string): boolean {
  return /^[a-z][a-z0-9_-]*:.+/u.test(ref) && !/^(?:secret|private|hidden):/iu.test(ref);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "fr"));
}
