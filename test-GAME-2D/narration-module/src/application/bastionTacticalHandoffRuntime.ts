import {
  coreError,
  type CampaignId,
  type CampaignRepository,
  type EventRecord,
  type Result
} from "../core";
import {
  validateProcessHandoffV1,
  validateTacticalEncounterSeedV1,
  type ProcessHandoffV1,
  type ProcessCheckpointV1,
  type TacticalEncounterSeedV1,
  type TacticalOutcomeV1
} from "../handoff";
import {
  bastionTacticalHandoffAggregateIdV1,
  bastionTacticalSeedAggregateIdV1,
  type BastionIncidentPublicSummaryV1
} from "./bastionIncidentAuthority";
import { loadBastionRegistryV1 } from "./bastionAuthority";
import { loadAccessControlRegistryV1 } from "./accessControlAuthority";
import type { AccessTacticalSessionSummaryV1 } from "./tacticalAccessAuthority";
import { restoreTacticalCheckpointV1 } from "./tacticalCheckpointRuntime";
import { restorePendingTacticalOutcomeV1 } from "./tacticalOutcomeRuntime";

export const BASTION_TACTICAL_SESSION_CONTRACT_V1 =
  "bastion-tactical-session/1" as const;

export interface BastionTacticalSessionV1 {
  schemaVersion: 1;
  contractVersion: typeof BASTION_TACTICAL_SESSION_CONTRACT_V1;
  status: "READY_FOR_TACTICAL" | "COMPLETED_PENDING_INTEGRATION";
  sourceEventId: string;
  summary: BastionIncidentPublicSummaryV1 | AccessTacticalSessionSummaryV1;
  process: ProcessHandoffV1;
  seed: TacticalEncounterSeedV1;
  checkpoint: ProcessCheckpointV1 | null;
  outcome: TacticalOutcomeV1 | null;
}

/**
 * Relit uniquement une défense déjà committée. Cette fonction ne crée ni
 * incident, ni combat et ne transforme pas une fixture en contenu de campagne.
 */
export async function restoreActiveBastionTacticalSessionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): Promise<Result<BastionTacticalSessionV1 | null>> {
  const events = await listAllEvents(input.repository, input.campaignId);
  if (!events.ok) return events;
  const candidates = events.value
    .filter(event =>
      (event.eventType === "bastion_defense_handoff_started"
        || event.eventType === "access_tactical_handoff_started")
      && event.visibility.scope === "PLAYER_VISIBLE"
      && (isIncidentSummary(event.payload) || isAccessSummary(event.payload))
      && event.payload.status === "HANDOFF_ACTIVE"
      && event.payload.tacticalProcessId !== null
    )
    .reverse();
  if (candidates.length === 0) return { ok: true, value: null };

  for (const event of candidates) {
    const summary = event.payload as
      | BastionIncidentPublicSummaryV1
      | AccessTacticalSessionSummaryV1;
    const processId = summary.tacticalProcessId!;
    const incidentStillActive = isAccessSummary(summary)
      ? await accessHandoffStillOwned(input.repository, input.campaignId, summary)
      : await bastionHandoffStillOwned(input.repository, input.campaignId, summary);
    if (!incidentStillActive.ok) return incidentStillActive;
    if (!incidentStillActive.value) continue;

    const [processAggregate, seedAggregate] = await Promise.all([
      input.repository.getAggregate(
        input.campaignId,
        "process.handoff",
        bastionTacticalHandoffAggregateIdV1(processId)
      ),
      input.repository.getAggregate(
        input.campaignId,
        "tactical.encounter-seed",
        bastionTacticalSeedAggregateIdV1(processId)
      )
    ]);
    if (!processAggregate.ok || !seedAggregate.ok) {
      return integrity("bastion.tactical-session.aggregate-missing");
    }
    const process = processAggregate.value.payload as ProcessHandoffV1;
    const seed = seedAggregate.value.payload as TacticalEncounterSeedV1;
    const processValidation = validateProcessHandoffV1(process);
    const seedValidation = validateTacticalEncounterSeedV1(seed);
    if (!processValidation.valid || !seedValidation.valid) {
      return integrity("bastion.tactical-session.payload-invalid");
    }
    if (
      process.processKind !== "TACTICAL_ENCOUNTER"
      || process.processId !== processId
      || process.campaignId !== input.campaignId
      || seed.processId !== processId
      || seed.campaignId !== input.campaignId
      || seed.locationRef.id !== summary.placeRef
    ) return integrity("bastion.tactical-session.identity-mismatch");
    if (process.status === "INTEGRATED" || process.status === "FAILED") continue;
    if (
      process.status !== "ACTIVE"
      && process.status !== "COMPLETED_PENDING_INTEGRATION"
    ) return integrity("bastion.tactical-session.status-invalid");
    const [checkpoint, outcome] = await Promise.all([
      restoreTacticalCheckpointV1({
        repository: input.repository,
        campaignId: input.campaignId,
        processId
      }),
      restorePendingTacticalOutcomeV1({
        repository: input.repository,
        campaignId: input.campaignId,
        processId
      })
    ]);
    if (!checkpoint.ok) return checkpoint;
    if (!outcome.ok) return outcome;
    if (
      (process.status === "ACTIVE" && outcome.value !== null)
      || (
        process.status === "COMPLETED_PENDING_INTEGRATION"
        && outcome.value === null
      )
    ) return integrity("bastion.tactical-session.outcome-status-mismatch");
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        contractVersion: BASTION_TACTICAL_SESSION_CONTRACT_V1,
        status: process.status === "ACTIVE"
          ? "READY_FOR_TACTICAL"
          : "COMPLETED_PENDING_INTEGRATION",
        sourceEventId: event.eventId,
        summary,
        process,
        seed,
        checkpoint: checkpoint.value,
        outcome: outcome.value
      }
    };
  }
  return { ok: true, value: null };
}

async function bastionHandoffStillOwned(
  repository: CampaignRepository,
  campaignId: CampaignId,
  summary: BastionIncidentPublicSummaryV1
): Promise<Result<boolean>> {
  const registry = await loadBastionRegistryV1(repository, campaignId);
  if (!registry.ok) return registry;
  return {
    ok: true,
    value: registry.value.state.bastions.some(bastion =>
      bastion.bastionId === summary.bastionId
      && bastion.incidents.some(incident =>
        incident.incidentId === summary.incidentId
        && incident.tacticalProcessId === summary.tacticalProcessId
        && incident.status === "HANDOFF_ACTIVE"
      )
    )
  };
}

async function accessHandoffStillOwned(
  repository: CampaignRepository,
  campaignId: CampaignId,
  summary: AccessTacticalSessionSummaryV1
): Promise<Result<boolean>> {
  const registry = await loadAccessControlRegistryV1(repository, campaignId);
  if (!registry.ok) return registry;
  return {
    ok: true,
    value: registry.value.state.controls.some(control =>
      control.accessControlRef === summary.accessControlRef
      && control.boundaryRef === summary.boundaryRef
      && control.state === "CONTROLLED"
    )
  };
}

async function listAllEvents(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<EventRecord[]>> {
  const events: EventRecord[] = [];
  let cursor: { commitSequence: number; eventSequence: number } | null = null;
  while (true) {
    const page = await repository.listEvents(campaignId, cursor, 1_024);
    if (!page.ok) return page;
    events.push(...page.value);
    const last = page.value.at(-1);
    if (last === undefined || page.value.length < 1_024) {
      return { ok: true, value: events };
    }
    cursor = {
      commitSequence: last.commitSequence,
      eventSequence: last.eventSequence
    };
  }
}

function isIncidentSummary(value: unknown): value is BastionIncidentPublicSummaryV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const summary = value as Partial<BastionIncidentPublicSummaryV1>;
  return summary.schemaVersion === 1
    && nonEmpty(summary.bastionId)
    && nonEmpty(summary.placeRef)
    && nonEmpty(summary.placeDisplayName)
    && nonEmpty(summary.incidentId)
    && nonEmpty(summary.incidentDefinitionRef)
    && nonEmpty(summary.incidentDisplayName)
    && summary.kind === "TACTICAL_DEFENSE"
    && summary.status === "HANDOFF_ACTIVE"
    && nonEmpty(summary.tacticalProcessId)
    && Number.isInteger(summary.occurredAtGameSecond)
    && Number(summary.occurredAtGameSecond) >= 0
    && nonEmpty(summary.narrative);
}

export function isAccessTacticalSessionSummaryV1(
  value: unknown
): value is AccessTacticalSessionSummaryV1 {
  return isAccessSummary(value);
}

function isAccessSummary(value: unknown): value is AccessTacticalSessionSummaryV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const summary = value as Partial<AccessTacticalSessionSummaryV1>;
  return summary.schemaVersion === 1
    && summary.ownerDomain === "access"
    && nonEmpty(summary.accessControlRef)
    && nonEmpty(summary.boundaryRef)
    && nonEmpty(summary.destinationRef)
    && nonEmpty(summary.placeRef)
    && nonEmpty(summary.placeDisplayName)
    && nonEmpty(summary.incidentId)
    && nonEmpty(summary.incidentDefinitionRef)
    && nonEmpty(summary.incidentDisplayName)
    && summary.kind === "TACTICAL_ACCESS"
    && summary.status === "HANDOFF_ACTIVE"
    && nonEmpty(summary.tacticalProcessId)
    && Number.isInteger(summary.occurredAtGameSecond)
    && Number(summary.occurredAtGameSecond) >= 0
    && nonEmpty(summary.narrative)
    && nonEmpty(summary.resolutionPolicyRef);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function integrity(messageKey: string): Result<never> {
  return {
    ok: false,
    error: coreError("CAMPAIGN_INTEGRITY_FAILURE", messageKey)
  };
}
