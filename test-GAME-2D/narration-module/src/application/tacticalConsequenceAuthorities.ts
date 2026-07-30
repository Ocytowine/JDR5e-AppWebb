import {
  cloneJson,
  coreError,
  opaqueId,
  type AggregateId,
  type JsonObject,
  type Result
} from "../core";
import type {
  CharacterAggregatePayloadV1,
  TacticalCharacterProjectionV1
} from "../bootstrap/character/types";
import {
  BASTION_REGISTRY_AGGREGATE_TYPE_V1,
  bastionRegistryAggregateIdV1,
  loadBastionRegistryV1,
  type BastionRegistryV1
} from "./bastionAuthority";
import type {
  TacticalConsequenceAuthorityV1,
  TacticalConsequenceValidationV1
} from "./tacticalOutcomeIntegrationRuntime";

export interface BastionTacticalResolutionDecisionV1 extends JsonObject {
  schemaVersion: 1;
  resolutionCode: string;
  bastionStatus: "ACTIVE" | "SUSPENDED" | "LOST";
  publicNarrative: string;
}

export interface BastionTacticalResolutionPolicyV1 {
  readonly policyRef: string;
  resolve(input: {
    bastionId: string;
    incidentId: string;
    incidentDefinitionRef: string;
    processId: string;
    endCondition: string;
    outcomeId: string;
  }): Result<BastionTacticalResolutionDecisionV1>
    | Promise<Result<BastionTacticalResolutionDecisionV1>>;
}

/**
 * Le propriétaire personnage n'accepte que les références d'agrégats
 * explicitement committées dans le candidat. Il confronte le PV initial au
 * registre et met à jour ensemble l'état canonique et sa projection tactique.
 */
export function createCharacterTacticalConsequenceAuthorityV1():
  TacticalConsequenceAuthorityV1 {
  return {
    ownerDomain: "character",
    authorityRef: "character-tactical-consequence-authority/1",
    async validate(input) {
      const candidate = input.candidate;
      const candidateId = field(candidate, "candidateId");
      const actorId = field(candidate, "actorId");
      const characterId = field(candidate, "characterId");
      const characterAggregateId = field(candidate, "characterAggregateId");
      const tacticalProjectionAggregateId = field(
        candidate,
        "tacticalProjectionAggregateId"
      );
      const hpBefore = integerField(candidate, "hpBefore");
      const hpAfter = integerField(candidate, "hpAfter");
      if (
        candidateId === null
        || actorId === null
        || characterId === null
        || characterAggregateId === null
        || tacticalProjectionAggregateId === null
        || hpBefore === null
        || hpAfter === null
      ) {
        return invalid("tactical.character-candidate.invalid", [
          "character candidate requires actor, character, aggregate references and hit points"
        ]);
      }
      const resourcesAfter = candidate.resourcesAfter;
      if (
        resourcesAfter === null
        || typeof resourcesAfter !== "object"
        || Array.isArray(resourcesAfter)
        || Object.keys(resourcesAfter).length > 0
      ) {
        return invalid("tactical.character-resources.unsupported", [
          "combat resources require a dedicated ruleset authority before integration"
        ]);
      }
      const [characterAggregate, tacticalAggregate] = await Promise.all([
        input.repository.getAggregate(
          input.campaignId,
          "character.state",
          opaqueId<AggregateId>(characterAggregateId)
        ),
        input.repository.getAggregate(
          input.campaignId,
          "character.tactical-projection",
          opaqueId<AggregateId>(tacticalProjectionAggregateId)
        )
      ]);
      if (!characterAggregate.ok) return characterAggregate;
      if (!tacticalAggregate.ok) return tacticalAggregate;
      const character =
        characterAggregate.value.payload as unknown as CharacterAggregatePayloadV1;
      const tactical =
        tacticalAggregate.value.payload as unknown as TacticalCharacterProjectionV1;
      if (
        character.schemaVersion !== 1
        || tactical.schemaVersion !== 1
        || character.characterId !== characterId
        || tactical.characterId !== characterId
        || character.currentHitPoints !== hpBefore
        || tactical.currentHitPoints !== hpBefore
        || hpAfter < 0
        || hpAfter > tactical.maximumHitPoints
      ) {
        return invalid("tactical.character-candidate.state-mismatch", [
          "character owner state no longer matches the tactical candidate"
        ]);
      }
      const validation: TacticalConsequenceValidationV1 = {
        schemaVersion: 1,
        authorityRef: "character-tactical-consequence-authority/1",
        candidateId,
        ownerDomain: "character",
        resolutionCode: hpAfter === 0
          ? "CHARACTER_NEUTRALIZED"
          : hpAfter < hpBefore
            ? "CHARACTER_WOUNDED"
            : "CHARACTER_UNCHANGED",
        publicNarrative: null,
        deltas: [{
          deltaId: `${candidateId}:state`,
          aggregateType: "character.state",
          aggregateId: characterAggregate.value.aggregateId,
          expectedAggregateRevision:
            characterAggregate.value.aggregateRevision,
          payloadSchemaVersion: characterAggregate.value.payloadSchemaVersion,
          payload: {
            ...cloneJson(characterAggregate.value.payload),
            currentHitPoints: hpAfter
          },
          summary: `PV validés pour ${actorId}: ${hpBefore} -> ${hpAfter}`
        }, {
          deltaId: `${candidateId}:tactical-projection`,
          aggregateType: "character.tactical-projection",
          aggregateId: tacticalAggregate.value.aggregateId,
          expectedAggregateRevision: tacticalAggregate.value.aggregateRevision,
          payloadSchemaVersion: tacticalAggregate.value.payloadSchemaVersion,
          payload: {
            ...cloneJson(tacticalAggregate.value.payload),
            currentHitPoints: hpAfter
          },
          summary: `Projection tactique synchronisée pour ${actorId}`
        }]
      };
      return { ok: true, value: validation };
    }
  };
}

/**
 * Le registre de bastion reste propriétaire de l'incident. La politique
 * injectée interprète la condition terminale committée ; cette autorité ne
 * déduit jamais sa signification depuis son libellé.
 */
export function createBastionTacticalConsequenceAuthorityV1(
  policy: BastionTacticalResolutionPolicyV1
): TacticalConsequenceAuthorityV1 {
  return {
    ownerDomain: "bastion",
    authorityRef: `bastion-tactical-consequence-authority/1:${policy.policyRef}`,
    async validate(input) {
      const candidateId = field(input.candidate, "candidateId");
      const bastionId = field(input.candidate, "bastionId");
      const incidentId = field(input.candidate, "incidentId");
      const processId = field(input.candidate, "processId");
      const incidentDefinitionRef = field(
        input.candidate,
        "incidentDefinitionRef"
      );
      const endCondition = field(input.candidate, "endCondition");
      if (
        candidateId === null
        || bastionId === null
        || incidentId === null
        || incidentDefinitionRef === null
        || processId !== input.process.processId
        || endCondition !== input.outcome.endCondition
      ) {
        return invalid("tactical.bastion-candidate.invalid", [
          "bastion candidate does not match the persisted process and outcome"
        ]);
      }
      const registry = await loadBastionRegistryV1(
        input.repository,
        input.campaignId
      );
      if (!registry.ok) return registry;
      if (registry.value.aggregate === null) {
        return invalid("tactical.bastion-registry.missing", [
          "bastion registry must exist before resolving its defense"
        ]);
      }
      const bastionIndex = registry.value.state.bastions.findIndex(
        value => value.bastionId === bastionId
      );
      const bastion = registry.value.state.bastions[bastionIndex];
      const incidentIndex = bastion?.incidents.findIndex(
        value => value.incidentId === incidentId
      ) ?? -1;
      const incident = incidentIndex < 0
        ? undefined
        : bastion.incidents[incidentIndex];
      if (
        bastion === undefined
        || incident === undefined
        || incident.kind !== "TACTICAL_DEFENSE"
        || incident.status !== "HANDOFF_ACTIVE"
        || incident.tacticalProcessId !== processId
      ) {
        return invalid("tactical.bastion-candidate.state-mismatch", [
          "the bastion incident is not the active owner of this tactical process"
        ]);
      }
      const resolvedDecision = await policy.resolve({
        bastionId,
        incidentId,
        incidentDefinitionRef,
        processId,
        endCondition,
        outcomeId: input.outcome.outcomeId
      });
      if (!resolvedDecision.ok) return resolvedDecision;
      const decision = resolvedDecision.value;
      const decisionIssues = validateDecision(decision);
      if (decisionIssues.length > 0) {
        return invalid(
          "tactical.bastion-resolution.invalid",
          decisionIssues
        );
      }
      const nextIncident = {
        ...incident,
        status: "APPLIED" as const,
        publicNarrative: decision.publicNarrative,
        version: incident.version + 1
      };
      const nextBastion = {
        ...bastion,
        status: decision.bastionStatus,
        incidents: bastion.incidents.map((value, index) =>
          index === incidentIndex ? nextIncident : value
        ),
        version: bastion.version + 1
      };
      const nextRegistry: BastionRegistryV1 = {
        ...registry.value.state,
        bastions: registry.value.state.bastions.map((value, index) =>
          index === bastionIndex ? nextBastion : value
        ),
        version: registry.value.state.version + 1
      };
      return {
        ok: true,
        value: {
          schemaVersion: 1,
          authorityRef:
            `bastion-tactical-consequence-authority/1:${policy.policyRef}`,
          candidateId,
          ownerDomain: "bastion",
          resolutionCode: decision.resolutionCode,
          publicNarrative: decision.publicNarrative,
          deltas: [{
            deltaId: `${candidateId}:registry`,
            aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
            aggregateId: bastionRegistryAggregateIdV1(input.campaignId),
            expectedAggregateRevision:
              registry.value.aggregate.aggregateRevision,
            payloadSchemaVersion:
              registry.value.aggregate.payloadSchemaVersion,
            payload: cloneJson(nextRegistry),
            summary: `Défense ${incidentId}: ${decision.resolutionCode}`
          }]
        }
      };
    }
  };
}

function validateDecision(
  value: BastionTacticalResolutionDecisionV1
): string[] {
  const issues: string[] = [];
  if (value.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (!field(value, "resolutionCode")) {
    issues.push("resolutionCode is required");
  }
  if (!["ACTIVE", "SUSPENDED", "LOST"].includes(value.bastionStatus)) {
    issues.push("bastionStatus is invalid");
  }
  if (
    !field(value, "publicNarrative")
    || value.publicNarrative.length > 500
  ) issues.push("publicNarrative must be a bounded public sentence");
  return issues;
}

function field(value: JsonObject, key: string): string | null {
  const fieldValue = value[key];
  return typeof fieldValue === "string"
    && fieldValue.trim() === fieldValue
    && fieldValue.length > 0
    ? fieldValue
    : null;
}

function integerField(value: JsonObject, key: string): number | null {
  const fieldValue = value[key];
  return Number.isInteger(fieldValue) && Number(fieldValue) >= 0
    ? Number(fieldValue)
    : null;
}

function invalid(messageKey: string, issues: string[]): Result<never> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}
