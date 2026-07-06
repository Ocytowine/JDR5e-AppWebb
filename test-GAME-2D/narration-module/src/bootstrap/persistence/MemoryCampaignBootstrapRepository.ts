import { cloneJson } from "../../core/canonical-json/canonicalJson";
import type { Result } from "../../core/contracts/types";
import { coreError, err, ok } from "../../core/errors";
import {
  MemoryCampaignRepository,
  copyMemoryState,
  memoryAggregateKey,
  memoryIdempotencyKey
} from "../../core/repository/MemoryCampaignRepository";
import type { CampaignBootstrapRepository } from "./CampaignBootstrapRepository";
import type {
  CampaignBootstrapPersistenceRequestV1,
  CampaignBootstrapPersistenceResultV1
} from "./types";
import { validateCampaignBootstrapPersistenceRequestV1 } from "./validateBootstrapPersistence";

export class MemoryCampaignBootstrapRepository
  extends MemoryCampaignRepository
  implements CampaignBootstrapRepository {
  async bootstrapCampaign(
    request: CampaignBootstrapPersistenceRequestV1
  ): Promise<Result<CampaignBootstrapPersistenceResultV1>> {
    const validation = validateCampaignBootstrapPersistenceRequestV1(request);
    if (!validation.valid) {
      return err(coreError("VALIDATION_FAILED", "bootstrap.persistence.validation-failed", {
        issues: validation.issues
      }));
    }

    const { campaign, operation, commit } = request;
    const lookupKey = memoryIdempotencyKey(campaign.campaignId, operation.idempotencyKey);
    const existingCommitId = this.state.commitByIdempotency.get(lookupKey);
    if (existingCommitId) {
      const existingCommit = this.state.commits.get(existingCommitId)!;
      const existingCampaign = this.state.campaigns.get(campaign.campaignId);
      const existingOperation = this.state.operations.get(existingCommit.operationId);
      if (
        existingCampaign && existingOperation &&
        existingCommit.commitId === commit.commitId &&
        existingCommit.operationId === operation.operationId &&
        existingCommit.requestFingerprint === operation.requestFingerprint
      ) {
        return ok(cloneJson({
          campaign: existingCampaign,
          operation: existingOperation,
          commit: existingCommit
        }));
      }
      return err(coreError("IDEMPOTENCY_CONFLICT", "bootstrap.persistence.idempotency-conflict"));
    }
    if (this.state.campaigns.has(campaign.campaignId)) {
      return err(coreError("IDEMPOTENCY_CONFLICT", "bootstrap.persistence.campaign-conflict", {
        campaignId: campaign.campaignId
      }));
    }
    if (this.state.operations.has(operation.operationId) || this.state.commits.has(commit.commitId)) {
      return err(coreError("ALREADY_EXISTS", "bootstrap.persistence.identity-already-exists"));
    }

    const aggregateCollision = request.initialAggregates.some(entry =>
      this.state.aggregates.has(memoryAggregateKey(campaign.campaignId, entry.aggregateType, entry.aggregateId)));
    const commandCollision = request.acceptedCommands.some(entry => this.state.commands.has(entry.commandId));
    const eventCollision = request.events.some(entry => this.state.events.has(entry.eventId));
    const taskCollision = request.outboxTasks.some(entry => this.state.outbox.has(entry.taskId));
    if (aggregateCollision || commandCollision || eventCollision || taskCollision) {
      return err(coreError("ALREADY_EXISTS", "bootstrap.persistence.record-id-already-exists"));
    }

    try {
      const next = copyMemoryState(this.state);
      next.campaigns.set(campaign.campaignId, cloneJson(campaign));
      this.inject("BOOTSTRAP_AFTER_CAMPAIGN");

      next.operations.set(operation.operationId, cloneJson(operation));
      next.operationByIdempotency.set(lookupKey, operation.operationId);
      next.activeOperationByCampaign.set(campaign.campaignId, operation.operationId);
      this.inject("BOOTSTRAP_AFTER_OPERATION");

      for (const aggregate of request.initialAggregates) {
        next.aggregates.set(
          memoryAggregateKey(campaign.campaignId, aggregate.aggregateType, aggregate.aggregateId),
          cloneJson(aggregate)
        );
      }
      this.inject("BOOTSTRAP_AFTER_AGGREGATES");

      for (const command of request.acceptedCommands) {
        next.commands.set(command.commandId, cloneJson(command));
      }
      this.inject("BOOTSTRAP_AFTER_COMMANDS");

      const eventIds = request.events.map(event => event.eventId);
      for (const event of request.events) next.events.set(event.eventId, cloneJson(event));
      next.eventOrderByCampaign.set(campaign.campaignId, eventIds.slice());
      this.inject("BOOTSTRAP_AFTER_EVENTS");

      for (const task of request.outboxTasks) {
        next.outbox.set(task.taskId, cloneJson(task));
        const claimable = next.claimableOutboxByCampaign.get(campaign.campaignId) ?? new Set<string>();
        claimable.add(task.taskId);
        next.claimableOutboxByCampaign.set(campaign.campaignId, claimable);
      }
      this.inject("BOOTSTRAP_AFTER_OUTBOX");

      next.commits.set(commit.commitId, cloneJson(commit));
      next.commitByIdempotency.set(lookupKey, commit.commitId);
      this.inject("BOOTSTRAP_AFTER_COMMIT");
      this.inject("BOOTSTRAP_BEFORE_PUBLISH");

      this.state = next;
      const result: CampaignBootstrapPersistenceResultV1 = {
        campaign: cloneJson(campaign),
        operation: cloneJson(operation),
        commit: cloneJson(commit)
      };
      return ok(result);
    } catch {
      return err(coreError("PERSISTENCE_FAILURE", "bootstrap.persistence.failure"));
    }
  }
}
