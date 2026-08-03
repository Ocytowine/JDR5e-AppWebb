import { loadActiveCampaignCharacterProfileV1 } from "../bootstrap";
import { coreError, opaqueId, type CampaignClockPayload, type CommitId, type Result } from "../core";
import type { NarrativeInventoryAccessRuntimeV1 } from "./NarrativeTurnController";
import type { AccessControlRecordV1 } from "./accessControl";
import { routeAccessApproachV1 } from "./accessControl";
import { loadAccessControlRegistryV1 } from "./accessControlAuthority";
import {
  INVENTORY_ACCESS_RESOLUTION_CONTRACT_V1,
  resolveInventoryAccessV1,
  type InventoryAccessPolicyPortV1,
  type InventoryCredentialPortV1
} from "./inventoryAccessAuthority";
import type { CharacterAggregatePayloadV1 } from "../bootstrap";

export interface PresentedInventoryItemResolverV1 {
  resolve(input: {
    rawInput: string;
    actorRef: string;
    character: CharacterAggregatePayloadV1;
    control: AccessControlRecordV1;
  }): Promise<{ ok: true; itemInstanceId: string; playerFacingLabel: string } | { ok: false; issues: string[] }>;
}

/** Runtime adapter for committed inventory approaches at an active access threshold. */
export function createCatalogInventoryAccessRuntimeV1(input: {
  itemResolver: PresentedInventoryItemResolverV1;
  policyPort: InventoryAccessPolicyPortV1;
  credentialPort?: InventoryCredentialPortV1 | null;
}): NarrativeInventoryAccessRuntimeV1 {
  return {
    async canHandle(request) {
      const accessRegistry = await loadAccessControlRegistryV1(request.repository, request.campaignId);
      if (!accessRegistry.ok) return false;
      const control = selectControlledInventoryThreshold(
        accessRegistry.value.state.controls,
        request.activeScene.sceneId,
        targetRefOf(request.interpretation)
      );
      if (control === null) return false;
      return routeAccessApproachV1({
        control,
        requestedDomain: request.interpretation.runtimeDecision.requiredDomain,
        actionHint: request.rawInput
      }).domain === "inventory";
    },
    async execute(request) {
      const [profile, accessRegistry, campaign] = await Promise.all([
        loadActiveCampaignCharacterProfileV1({ repository: request.repository, campaignId: request.campaignId }),
        loadAccessControlRegistryV1(request.repository, request.campaignId),
        request.repository.getCampaign(request.campaignId)
      ]);
      if (!profile.ok) return profile;
      if (!accessRegistry.ok) return accessRegistry;
      if (!campaign.ok) return campaign;
      const clock = await request.repository.getAggregate(request.campaignId, "world.clock", campaign.value.clockAggregateId);
      if (!clock.ok) return clock;
      const occurredAtGameSecond = Number((clock.value.payload as CampaignClockPayload).elapsedGameSeconds);
      if (!Number.isInteger(occurredAtGameSecond) || occurredAtGameSecond < 0) {
        return failure("inventory.campaign-clock-invalid", { elapsedGameSeconds: occurredAtGameSecond });
      }
      const targetRef = targetRefOf(request.interpretation);
      const control = selectControlledInventoryThreshold(accessRegistry.value.state.controls, request.activeScene.sceneId, targetRef);
      if (control === null) return failure("inventory.access-threshold-ambiguous", { targetRef });
      const character = await request.repository.getAggregate(request.campaignId, "character.state", profile.value.characterStateAggregateId);
      if (!character.ok) return character;
      const characterState = character.value.payload as unknown as CharacterAggregatePayloadV1;
      const item = await input.itemResolver.resolve({ rawInput: request.rawInput, actorRef: `actor:${profile.value.actorId}`, character: characterState, control });
      if (!item.ok) return failure("inventory.presented-item-unresolved", { issues: item.issues });
      const resolution = await resolveInventoryAccessV1({
        repository: request.repository,
        campaignId: request.campaignId,
        operation: request.operation,
        command: {
          schemaVersion: 1,
          contractVersion: INVENTORY_ACCESS_RESOLUTION_CONTRACT_V1,
          clientRequestId: `${request.operation.operationId}:inventory-access`,
          sourceOperationId: request.operation.operationId,
          characterAggregateId: profile.value.characterStateAggregateId,
          actorRef: `actor:${profile.value.actorId}`,
          accessControlRef: control.accessControlRef,
          presentedItemInstanceId: item.itemInstanceId,
          occurredAtGameSecond
        },
        policyPort: input.policyPort,
        credentialPort: input.credentialPort
      });
      if (!resolution.ok) return resolution;
      const commit = await request.repository.getCommit(opaqueId<CommitId>(resolution.value.commitId));
      if (!commit.ok) return commit;
      return { ok: true, value: {
        commit: commit.value,
        resolution: resolution.value,
        characterExpression: request.rawInput.trim(),
        playerFacingText: resolution.value.usePolicy === "RETAIN"
          ? `${item.playerFacingLabel} est vérifié et reste dans ton inventaire. Le contrôle d'accès est maintenant ${resolution.value.resultingAccessState === "OPEN" ? "levé" : "mis à jour"}.`
          : `${item.playerFacingLabel} est utilisé. Le contrôle d'accès est maintenant ${resolution.value.resultingAccessState === "OPEN" ? "levé" : "mis à jour"}.`,
        sourceRefs: [`access-control:${control.accessControlRef}`, `inventory-item:${item.itemInstanceId}`]
      } };
    }
  };
}

function targetRefOf(interpretation: Parameters<NonNullable<NarrativeInventoryAccessRuntimeV1["canHandle"]>>[0]["interpretation"]): string | null {
  return interpretation.referentResolution?.resolvedTarget?.ref
    ?? interpretation.semanticIntent.target?.ref
    ?? null;
}

function selectControlledInventoryThreshold(
  controls: AccessControlRecordV1[],
  activeSceneId: string,
  targetRef: string | null
): AccessControlRecordV1 | null {
  const candidates = controls.filter(control =>
    control.sourceSceneId === activeSceneId &&
    control.state === "CONTROLLED" &&
    control.approachDomains.includes("inventory")
  );
  const exact = targetRef === null ? [] : candidates.filter(control =>
    control.accessControlRef === targetRef || control.boundaryRef === targetRef || control.destinationRef === targetRef
  );
  return exact.length === 1 ? exact[0] : exact.length === 0 && candidates.length === 1 ? candidates[0] : null;
}

function failure<T>(messageKey: string, details: Record<string, unknown>): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, details as never) };
}
