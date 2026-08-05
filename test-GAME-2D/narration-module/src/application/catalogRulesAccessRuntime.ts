import { loadActiveCampaignCharacterProfileV1, type CharacterAggregatePayloadV1 } from "../bootstrap";
import { coreError, opaqueId, type CampaignClockPayload, type CommitId, type Result } from "../core";
import type { NarrativeRulesAccessRuntimeV1 } from "./NarrativeTurnController";
import { routeAccessApproachV1, type AccessControlRecordV1 } from "./accessControl";
import { loadAccessControlRegistryV1 } from "./accessControlAuthority";
import {
  beginRulesAccessCheckV1,
  RULES_ACCESS_CHECK_CONTRACT_V1,
  type RulesAccessAuthorityPortV1,
  type RulesAccessMethodV1
} from "./rulesAccessAuthority";

export interface RulesAccessMethodResolverV1 {
  resolve(input: {
    rawInput: string;
    character: CharacterAggregatePayloadV1;
    control: AccessControlRecordV1;
  }): Promise<
    | { ok: true; method: RulesAccessMethodV1; toolItemInstanceId: string | null }
    | { ok: false; issues: string[] }
  >;
}

export function createCatalogRulesAccessRuntimeV1(input: {
  methodResolver: RulesAccessMethodResolverV1;
  authorityPort: RulesAccessAuthorityPortV1;
}): NarrativeRulesAccessRuntimeV1 {
  return {
    async canHandle(request) {
      const registry = await loadAccessControlRegistryV1(request.repository, request.campaignId);
      if (!registry.ok) return false;
      const control = selectThreshold(registry.value.state.controls, request.activeScene.sceneId, targetRefOf(request.interpretation));
      return control !== null && routeAccessApproachV1({
        control,
        requestedDomain: request.interpretation.runtimeDecision.requiredDomain,
        actionHint: request.rawInput
      }).domain === "rules";
    },
    async execute(request) {
      const [profile, registry, campaign] = await Promise.all([
        loadActiveCampaignCharacterProfileV1({ repository: request.repository, campaignId: request.campaignId }),
        loadAccessControlRegistryV1(request.repository, request.campaignId),
        request.repository.getCampaign(request.campaignId)
      ]);
      if (!profile.ok) return profile;
      if (!registry.ok) return registry;
      if (!campaign.ok) return campaign;
      const control = selectThreshold(registry.value.state.controls, request.activeScene.sceneId, targetRefOf(request.interpretation));
      if (control === null) return failure("rules-access.threshold-ambiguous", {});
      const [character, clock] = await Promise.all([
        request.repository.getAggregate(request.campaignId, "character.state", profile.value.characterStateAggregateId),
        request.repository.getAggregate(request.campaignId, "world.clock", campaign.value.clockAggregateId)
      ]);
      if (!character.ok) return character;
      if (!clock.ok) return clock;
      const occurredAtGameSecond = Number((clock.value.payload as CampaignClockPayload).elapsedGameSeconds);
      if (!Number.isInteger(occurredAtGameSecond) || occurredAtGameSecond < 0) return failure("rules-access.campaign-clock-invalid", {});
      const method = await input.methodResolver.resolve({
        rawInput: request.rawInput,
        character: character.value.payload as unknown as CharacterAggregatePayloadV1,
        control
      });
      if (!method.ok) return failure("rules-access.method-unavailable", { issues: method.issues });
      const resolution = await beginRulesAccessCheckV1({
        repository: request.repository,
        campaignId: request.campaignId,
        operation: request.operation,
        command: {
          schemaVersion: 1,
          contractVersion: RULES_ACCESS_CHECK_CONTRACT_V1,
          clientRequestId: `${request.operation.operationId}:rules-access`,
          sourceOperationId: request.operation.operationId,
          accessControlRef: control.accessControlRef,
          characterAggregateId: profile.value.characterStateAggregateId,
          actorRef: `actor:${profile.value.actorId}`,
          deviceRef: control.boundaryRef,
          method: method.method,
          toolItemInstanceId: method.toolItemInstanceId,
          occurredAtGameSecond
        },
        authorityPort: input.authorityPort
      });
      if (!resolution.ok) return resolution;
      const commit = await request.repository.getCommit(opaqueId<CommitId>(resolution.value.commitId));
      if (!commit.ok) return commit;
      return { ok: true, value: {
        commit: commit.value,
        resolution: resolution.value,
        characterExpression: request.rawInput.trim(),
        playerFacingText: resolution.value.playerFacingText,
        sourceRefs: [`access-control:${control.accessControlRef}`, `rules-resolution:${resolution.value.resolutionRef}`]
      } };
    }
  };
}

function targetRefOf(interpretation: Parameters<NonNullable<NarrativeRulesAccessRuntimeV1["canHandle"]>>[0]["interpretation"]): string | null {
  return interpretation.referentResolution?.resolvedTarget?.ref ?? interpretation.semanticIntent.target?.ref ?? null;
}

function selectThreshold(controls: AccessControlRecordV1[], sceneId: string, targetRef: string | null): AccessControlRecordV1 | null {
  const candidates = controls.filter(control => control.sourceSceneId === sceneId && control.state === "CONTROLLED" && control.approachDomains.includes("rules"));
  const exact = targetRef === null ? [] : candidates.filter(control => control.accessControlRef === targetRef || control.boundaryRef === targetRef || control.destinationRef === targetRef);
  return exact.length === 1 ? exact[0] : exact.length === 0 && candidates.length === 1 ? candidates[0] : null;
}

function failure<T>(messageKey: string, details: Record<string, unknown>): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, details as never) };
}
