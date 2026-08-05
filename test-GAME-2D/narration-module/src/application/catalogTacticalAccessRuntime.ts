import type { TacticalEncounterSeedV1 } from "../handoff";
import { coreError, type CampaignClockPayload, type Result } from "../core";
import type { NarrativeTacticalAccessRuntimeV1 } from "./NarrativeTurnController";
import { routeAccessApproachV1, type AccessControlRecordV1 } from "./accessControl";
import { loadAccessControlRegistryV1 } from "./accessControlAuthority";
import {
  createTacticalAccessConsequenceAuthorityV1,
  startTacticalAccessHandoffV1,
  type TacticalAccessResolutionPolicyV1
} from "./tacticalAccessAuthority";

export interface TacticalAccessSeedPreparationV1 {
  seed: TacticalEncounterSeedV1;
  placeDisplayName: string;
  incidentDisplayName: string;
  narrative: string;
  resolutionPolicyRef: string;
}

export interface TacticalAccessSeedFactoryV1 {
  prepare(input: {
    repository: Parameters<NarrativeTacticalAccessRuntimeV1["execute"]>[0]["repository"];
    campaignId: Parameters<NarrativeTacticalAccessRuntimeV1["execute"]>[0]["campaignId"];
    control: AccessControlRecordV1;
    activeScene: Parameters<NarrativeTacticalAccessRuntimeV1["execute"]>[0]["activeScene"];
    occurredAtGameSecond: number;
  }): Promise<Result<TacticalAccessSeedPreparationV1>>;
}

export function createCatalogTacticalAccessRuntimeV1(input: {
  seedFactory: TacticalAccessSeedFactoryV1;
  resolutionPolicy: TacticalAccessResolutionPolicyV1;
}): NarrativeTacticalAccessRuntimeV1 {
  return {
    consequenceAuthorities: [
      createTacticalAccessConsequenceAuthorityV1(input.resolutionPolicy)
    ],
    async canHandle(request) {
      const registry = await loadAccessControlRegistryV1(
        request.repository,
        request.campaignId
      );
      if (!registry.ok) return false;
      const control = selectThreshold(
        registry.value.state.controls,
        request.activeScene.sceneId,
        targetRefOf(request.interpretation)
      );
      return control !== null && routeAccessApproachV1({
        control,
        requestedDomain: request.interpretation.runtimeDecision.requiredDomain,
        actionHint: request.rawInput
      }).domain === "tactical";
    },
    async execute(request) {
      const [registry, campaign] = await Promise.all([
        loadAccessControlRegistryV1(request.repository, request.campaignId),
        request.repository.getCampaign(request.campaignId)
      ]);
      if (!registry.ok) return registry;
      if (!campaign.ok) return campaign;
      const control = selectThreshold(
        registry.value.state.controls,
        request.activeScene.sceneId,
        targetRefOf(request.interpretation)
      );
      if (control === null) {
        return failure("tactical-access.threshold-ambiguous", {});
      }
      const clock = await request.repository.getAggregate(
        request.campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      );
      if (!clock.ok) return clock;
      const occurredAtGameSecond = Number(
        (clock.value.payload as CampaignClockPayload).elapsedGameSeconds
      );
      if (!Number.isInteger(occurredAtGameSecond) || occurredAtGameSecond < 0) {
        return failure("tactical-access.campaign-clock-invalid", {});
      }
      const prepared = await input.seedFactory.prepare({
        repository: request.repository,
        campaignId: request.campaignId,
        control,
        activeScene: request.activeScene,
        occurredAtGameSecond
      });
      if (!prepared.ok) return prepared;
      const started = await startTacticalAccessHandoffV1({
        repository: request.repository,
        campaignId: request.campaignId,
        operation: request.operation,
        control,
        ...prepared.value
      });
      if (!started.ok) return started;
      return {
        ok: true,
        value: {
          ...started.value,
          characterExpression: request.rawInput.trim(),
          playerFacingText: started.value.summary.narrative,
          sourceRefs: [
            `access-control:${control.accessControlRef}`,
            `tactical-process:${started.value.process.processId}`,
            prepared.value.resolutionPolicyRef
          ]
        }
      };
    }
  };
}

function targetRefOf(
  interpretation: Parameters<
    NonNullable<NarrativeTacticalAccessRuntimeV1["canHandle"]>
  >[0]["interpretation"]
): string | null {
  return interpretation.referentResolution?.resolvedTarget?.ref
    ?? interpretation.semanticIntent.target?.ref
    ?? null;
}

function selectThreshold(
  controls: AccessControlRecordV1[],
  sceneId: string,
  targetRef: string | null
): AccessControlRecordV1 | null {
  const candidates = controls.filter(control =>
    control.sourceSceneId === sceneId
    && control.state === "CONTROLLED"
    && control.approachDomains.includes("tactical")
  );
  const exact = targetRef === null
    ? []
    : candidates.filter(control =>
        control.accessControlRef === targetRef
        || control.boundaryRef === targetRef
        || control.destinationRef === targetRef
      );
  return exact.length === 1
    ? exact[0]
    : exact.length === 0 && candidates.length === 1
      ? candidates[0]
      : null;
}

function failure<T>(
  messageKey: string,
  details: Record<string, unknown>
): Result<T> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, details as never)
  };
}
