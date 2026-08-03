import { loadActiveCampaignCharacterProfileV1 } from "../bootstrap";
import { coreError, opaqueId, type CampaignClockPayload, type CommitId, type Result } from "../core";
import type { NarrativeSocialAccessRuntimeV1 } from "./NarrativeTurnController";
import { routeAccessApproachV1, type AccessControlRecordV1 } from "./accessControl";
import { loadAccessControlRegistryV1 } from "./accessControlAuthority";
import {
  SOCIAL_ACCESS_RESOLUTION_CONTRACT_V1,
  resolveSocialAccessV1,
  type SocialAccessAuthorityPortV1
} from "./socialAccessAuthority";

export interface SocialAccessTargetResolverV1 {
  resolve(input: {
    rawInput: string;
    interpretation: Parameters<NonNullable<NarrativeSocialAccessRuntimeV1["canHandle"]>>[0]["interpretation"];
    activeScene: Parameters<NonNullable<NarrativeSocialAccessRuntimeV1["canHandle"]>>[0]["activeScene"];
    control: AccessControlRecordV1;
  }): Promise<{ ok: true; actorRef: string; displayName: string } | { ok: false; issues: string[] }>;
}

export function createCatalogSocialAccessRuntimeV1(input: {
  targetResolver: SocialAccessTargetResolverV1;
  authorityPort: SocialAccessAuthorityPortV1;
}): NarrativeSocialAccessRuntimeV1 {
  return {
    async canHandle(request) {
      const registry = await loadAccessControlRegistryV1(request.repository, request.campaignId);
      if (!registry.ok) return false;
      const control = selectControlledSocialThreshold(registry.value.state.controls, request.activeScene.sceneId, targetRefOf(request.interpretation));
      if (control === null || routeAccessApproachV1({ control, requestedDomain: request.interpretation.runtimeDecision.requiredDomain, actionHint: request.rawInput }).domain !== "social") return false;
      return (await input.targetResolver.resolve({ rawInput: request.rawInput, interpretation: request.interpretation, activeScene: request.activeScene, control })).ok;
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
      const clock = await request.repository.getAggregate(request.campaignId, "world.clock", campaign.value.clockAggregateId);
      if (!clock.ok) return clock;
      const occurredAtGameSecond = Number((clock.value.payload as CampaignClockPayload).elapsedGameSeconds);
      if (!Number.isInteger(occurredAtGameSecond) || occurredAtGameSecond < 0) return failure("social-access.campaign-clock-invalid", { occurredAtGameSecond });
      const control = selectControlledSocialThreshold(registry.value.state.controls, request.activeScene.sceneId, targetRefOf(request.interpretation));
      if (control === null) return failure("social-access.threshold-ambiguous", {});
      const target = await input.targetResolver.resolve({ rawInput: request.rawInput, interpretation: request.interpretation, activeScene: request.activeScene, control });
      if (!target.ok) return failure("social-access.target-unresolved", { issues: target.issues });
      const resolution = await resolveSocialAccessV1({
        repository: request.repository,
        campaignId: request.campaignId,
        operation: request.operation,
        command: {
          schemaVersion: 1,
          contractVersion: SOCIAL_ACCESS_RESOLUTION_CONTRACT_V1,
          clientRequestId: `${request.operation.operationId}:social-access`,
          sourceOperationId: request.operation.operationId,
          accessControlRef: control.accessControlRef,
          playerActorRef: `actor:${profile.value.actorId}`,
          targetActorRef: target.actorRef,
          speechText: request.rawInput.trim(),
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
        respondingActorRef: target.actorRef,
        respondingActorName: target.displayName,
        playerFacingText: resolution.value.playerFacingResponse,
        sourceRefs: [`access-control:${control.accessControlRef}`, `social-resolution:${resolution.value.resolutionRef}`]
      } };
    }
  };
}

function targetRefOf(interpretation: Parameters<NonNullable<NarrativeSocialAccessRuntimeV1["canHandle"]>>[0]["interpretation"]): string | null {
  return interpretation.referentResolution?.resolvedTarget?.ref ?? interpretation.semanticIntent.target?.ref ?? null;
}

function selectControlledSocialThreshold(controls: AccessControlRecordV1[], sceneId: string, targetRef: string | null): AccessControlRecordV1 | null {
  const candidates = controls.filter(control => control.sourceSceneId === sceneId && control.state === "CONTROLLED" && control.approachDomains.includes("social"));
  const exact = targetRef === null ? [] : candidates.filter(control => control.accessControlRef === targetRef || control.boundaryRef === targetRef || control.destinationRef === targetRef);
  return exact.length === 1 ? exact[0] : exact.length === 0 && candidates.length === 1 ? candidates[0] : null;
}

function failure<T>(messageKey: string, details: Record<string, unknown>): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, details as never) };
}
