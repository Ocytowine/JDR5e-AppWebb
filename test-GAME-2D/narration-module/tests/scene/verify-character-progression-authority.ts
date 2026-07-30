import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  cloneJson,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type Result,
  type WriterId
} from "../../src/core";
import {
  CHARACTER_PROGRESSION_APPLICATION_CONTRACT_V1,
  CHARACTER_PROGRESSION_AWARD_CONTRACT_V1,
  CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
  NarrativeTurnControllerV1,
  applyCharacterProgressionV1,
  characterProgressionRegistryAggregateIdV1,
  createCharacterProgressionCatalogValidatorV1,
  evaluateAndGrantCharacterProgressionAwardV1,
  loadCharacterProgressionRegistryV1,
  prepareCharacterProgressionCandidateV1,
  type CharacterProgressionEligibilityPolicyV1,
  type CharacterProgressionCandidateValidatorV1,
  type ApplyCharacterProgressionCommandV1,
  type EvaluateCharacterProgressionAwardCommandV1
} from "../../src/application";
import {
  createMvpRulesetManifestV1,
  loadRuleRegistryV1,
  MVP_RULE_DEFINITIONS_V1,
  MVP_RULE_EXECUTORS_V1,
  type CharacterAggregatePayloadV1,
  type NarrativeCharacterProjectionV1,
  type TacticalCharacterProjectionV1
} from "../../src/bootstrap";
import { currentCharacterProgressionCatalogV1 } from "../../../src/narration-ui/characterProgressionCatalogAdapter";

class FixedClock implements RepositoryClock {
  now(): Date {
    return new Date("2026-07-29T12:00:00.000Z");
  }
}

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function ok<T>(result: Result<T>): T {
  if (!result.ok) {
    assert.fail(`${result.error.code}: ${result.error.messageKey} ${JSON.stringify(result.error.details)}`);
  }
  return result.value;
}

interface FailureControl {
  enabled: boolean;
  point: string;
}

async function setup(failureControl?: FailureControl) {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({
    clock,
    failureInjector: point => {
      if (failureControl?.enabled && failureControl.point === point) {
        throw new Error(`injected failure at ${point}`);
      }
    }
  });
  const campaignId = id<CampaignId>("cmp-progression-6e");
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: id<AggregateId>("agg-progression-clock"),
    dependencies: {
      contentPackageId: "content.jdr5e",
      contentPackageVersion: 1,
      rulesetId: "rules.jdr5e",
      rulesetVersion: 2,
      calendarId: "calendar.progression.6e",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: clock.now().toISOString(),
    updatedAt: clock.now().toISOString()
  };
  ok(await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.progression.6e",
    calendarVersion: 1
  }));
  const characterAggregateId = id<AggregateId>("agg-progression-character");
  const tacticalProjectionAggregateId = id<AggregateId>("agg-progression-tactical");
  const narrativeProjectionAggregateId = id<AggregateId>("agg-progression-narrative");
  const sourceOperationId = id<OperationId>("mission-resolution:milestone-6e");
  const sourceEventId = id<EventId>("event:mission-completed:milestone-6e");
  const payload = {
    missionId: "mission-private-ledger",
    outcome: "SUCCESS",
    privateSponsor: "secret-patron"
  };
  const fingerprint = await computeRequestFingerprint("mission.resolve", 1, payload);
  const now = clock.now().toISOString();
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: sourceOperationId,
    campaignId,
    clientRequestId: id<RequestId>("req-mission-milestone-6e"),
    idempotencyKey: id<IdempotencyKey>("idem-mission-milestone-6e"),
    requestFingerprint: fingerprint,
    operationKind: "mission.resolve",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: 0,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };
  ok(await repository.receiveOperation(operation));
  ok(await repository.transitionOperation(sourceOperationId, "RECEIVED", "PREPARING"));
  ok(await repository.transitionOperation(sourceOperationId, "PREPARING", "READY_TO_COMMIT"));
  const lease = ok(await repository.acquireWriterLease(
    campaignId,
    id<WriterId>("writer-mission-milestone-6e"),
    120_000
  ));
  const character = {
    schemaVersion: 1,
    characterId: "pc-aryn",
    sourceFingerprint: "sha256:fixture",
    rulesetId: "rules.jdr5e",
    rulesetVersion: 2,
    name: "Aryn",
    raceId: "human",
    backgroundId: "veteran",
    classes: [{ classId: "fighter", subclassId: null, level: 1 }],
    globalLevel: 1,
    abilityScores: { FOR: 16, DEX: 14, CON: 14, INT: 10, SAG: 12, CHA: 10 },
    currentHitPoints: 12,
    temporaryHitPoints: 0,
    exhaustion: 0,
    languages: ["commun"],
    skills: [],
    expertise: [],
    proficiencies: {},
    inventory: [],
    equipmentSlots: {},
    actionIds: [],
    reactionIds: [],
    spellIds: [],
    featureIds: [],
    choices: {},
    progressionHistory: [],
    description: {},
    profile: {},
    appearance: {},
    movementModes: {},
    vision: {},
    resources: {}
  };
  const tacticalProjection = {
    schemaVersion: 1,
    characterId: "pc-aryn",
    level: 1,
    abilityModifiers: { FOR: 3, DEX: 2, CON: 2, INT: 0, SAG: 1, CHA: 0 },
    proficiencyBonus: 2,
    currentHitPoints: 12,
    maximumHitPoints: 12,
    temporaryHitPoints: 0,
    armorClass: 16,
    passivePerception: 11,
    movementModes: {},
    vision: {},
    actionIds: [],
    reactionIds: [],
    spellIds: [],
    resources: {},
    equippedItemInstanceIds: [],
    appearance: {}
  };
  const narrativeProjection = {
    schemaVersion: 1,
    characterId: "pc-aryn",
    name: "Aryn",
    raceId: "human",
    backgroundId: "veteran",
    languages: ["commun"],
    observable: {},
    knownToPlayer: {},
    privateMechanical: { globalLevel: 1 }
  };
  try {
    ok(await repository.commit({
      campaignId,
      operationId: sourceOperationId,
      commitId: id<CommitId>("commit-mission-milestone-6e"),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: fingerprint,
      expectedCampaignRevision: 0,
      writerLease: lease,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "mission-authority-fixture",
        contractVersion: 1,
        commandId: opaqueId(`${sourceOperationId}:command`),
        campaignId,
        operationId: sourceOperationId,
        commandType: "mission.resolve",
        target: {
          aggregateType: "character.state",
          aggregateId: characterAggregateId,
          expectedAggregateRevision: null
        },
        payloadSchemaVersion: 1,
        payload,
        acceptedAtGameSecond: 0
      }],
      aggregateWrites: [{
        aggregateType: "character.state",
        aggregateId: characterAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: character
      }, {
        aggregateType: "character.tactical-projection",
        aggregateId: tacticalProjectionAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: tacticalProjection
      }, {
        aggregateType: "character.narrative-projection",
        aggregateId: narrativeProjectionAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: narrativeProjection
      }],
      events: [{
        schemaVersion: 1,
        eventId: sourceEventId,
        campaignId,
        operationId: sourceOperationId,
        eventType: "mission.completed",
        origin: "SYSTEM",
        causation: { kind: "COMMAND", id: `${sourceOperationId}:command` },
        aggregateRefs: [{
          aggregateType: "character.state",
          aggregateId: characterAggregateId,
          aggregateRevision: 0
        }, {
          aggregateType: "character.tactical-projection",
          aggregateId: tacticalProjectionAggregateId,
          aggregateRevision: 0
        }, {
          aggregateType: "character.narrative-projection",
          aggregateId: narrativeProjectionAggregateId,
          aggregateRevision: 0
        }],
        visibility: { scope: "SYSTEM", actorIds: [] },
        occurredAtGameSecond: 0,
        payloadSchemaVersion: 1,
        payload
      }],
      outboxTasks: []
    }));
    ok(await repository.completePresentation(
      sourceOperationId,
      "COMMITTED_RENDERED",
      1,
      { missionId: payload.missionId, outcome: payload.outcome }
    ));
  } finally {
    ok(await repository.releaseWriterLease(lease));
  }
  return {
    repository,
    campaignId,
    characterAggregateId,
    tacticalProjectionAggregateId,
    narrativeProjectionAggregateId,
    sourceOperationId,
    sourceEventId,
    restWindow: {
      schemaVersion: 1 as const,
      restSegmentOperationId: "pending-rest-segment-operation",
      restSegmentEventId: "pending-rest-segment-event",
      restProcessId: "pending-rest-process"
    }
  };
}

async function commitProgressionRestWindow(
  fixture: Awaited<ReturnType<typeof setup>>,
  awardId: string,
  suffix: string
) {
  const campaign = ok(await fixture.repository.getCampaign(fixture.campaignId));
  const clockAggregate = ok(await fixture.repository.getAggregate(
    fixture.campaignId,
    "world.clock",
    campaign.clockAggregateId
  ));
  const restProcessId = `rest-process:${suffix}`;
  const restAggregateId = id<AggregateId>(`aggregate:${restProcessId}`);
  const operationId = id<OperationId>(`rest-segment-operation:${suffix}`);
  const eventId = id<EventId>(`rest-segment-event:${suffix}`);
  const payload = {
    processId: restProcessId,
    segmentIndex: 0,
    restKind: "SHORT_REST",
    durationSeconds: 3_600,
    activity: {
      schemaVersion: 1,
      activityKind: "CHARACTER_PROGRESSION",
      characterId: "pc-aryn",
      progressionAwardId: awardId
    }
  };
  const fingerprint = await computeRequestFingerprint("time.segment", 1, payload);
  const now = new FixedClock().now().toISOString();
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId: fixture.campaignId,
    clientRequestId: id<RequestId>(`request:${operationId}`),
    idempotencyKey: id<IdempotencyKey>(`idempotency:${operationId}`),
    requestFingerprint: fingerprint,
    operationKind: "time.segment",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };
  ok(await fixture.repository.receiveOperation(operation));
  ok(await fixture.repository.transitionOperation(operationId, "RECEIVED", "PREPARING"));
  ok(await fixture.repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT"));
  const lease = ok(await fixture.repository.acquireWriterLease(
    fixture.campaignId,
    id<WriterId>(`writer:${operationId}`),
    120_000
  ));
  try {
    ok(await fixture.repository.commit({
      campaignId: fixture.campaignId,
      operationId,
      commitId: id<CommitId>(`commit:${operationId}`),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: fingerprint,
      expectedCampaignRevision: campaign.campaignRevision,
      writerLease: lease,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "tactical-rest-handoff",
        contractVersion: 1,
        commandId: opaqueId(`${operationId}:command`),
        campaignId: fixture.campaignId,
        operationId,
        commandType: "rest.segment.complete",
        target: {
          aggregateType: "rest.process",
          aggregateId: restAggregateId,
          expectedAggregateRevision: null
        },
        payloadSchemaVersion: 1,
        payload,
        acceptedAtGameSecond: 3_600
      }],
      aggregateWrites: [{
        aggregateType: "rest.process",
        aggregateId: restAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: {
          schemaVersion: 1,
          processId: restProcessId,
          restKind: "SHORT_REST",
          completedActivities: [payload.activity]
        }
      }, {
        aggregateType: "world.clock",
        aggregateId: campaign.clockAggregateId,
        expectedAggregateRevision: clockAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: {
          elapsedGameSeconds: 3_600,
          calendarId: campaign.dependencies.calendarId,
          calendarVersion: campaign.dependencies.calendarVersion
        }
      }],
      events: [{
        schemaVersion: 1,
        eventId,
        campaignId: fixture.campaignId,
        operationId,
        eventType: "rest_segment_completed",
        origin: "PROCESS",
        causation: { kind: "COMMAND", id: `${operationId}:command` },
        aggregateRefs: [{
          aggregateType: "rest.process",
          aggregateId: restAggregateId,
          aggregateRevision: 0
        }, {
          aggregateType: "world.clock",
          aggregateId: campaign.clockAggregateId,
          aggregateRevision: clockAggregate.aggregateRevision + 1
        }],
        visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
        occurredAtGameSecond: 3_600,
        payloadSchemaVersion: 1,
        payload: {
          taskId: `${operationId}:boundary`,
          outcome: "RESOLVED",
          result: {
            ...payload,
            status: "ACTIVE",
            interruption: {
              interrupted: false,
              reason: null,
              segmentIndex: null
            }
          }
        }
      }],
      outboxTasks: []
    }));
    ok(await fixture.repository.completePresentation(
      operationId,
      "COMMITTED_RENDERED",
      1,
      { schemaVersion: 1, status: "COMPLETED" }
    ));
  } finally {
    ok(await fixture.repository.releaseWriterLease(lease));
  }
  return {
    schemaVersion: 1 as const,
    restSegmentOperationId: operationId,
    restSegmentEventId: eventId,
    restProcessId
  };
}

function command(
  fixture: Awaited<ReturnType<typeof setup>>,
  clientRequestId: string
): EvaluateCharacterProgressionAwardCommandV1 {
  return {
    schemaVersion: 1,
    contractVersion: CHARACTER_PROGRESSION_AWARD_CONTRACT_V1,
    clientRequestId,
    sourceOperationId: fixture.sourceOperationId,
    sourceEventId: fixture.sourceEventId,
    characterAggregateId: fixture.characterAggregateId
  };
}

function applicationCommand(
  fixture: Awaited<ReturnType<typeof setup>>,
  awardId: string,
  clientRequestId: string,
  choices: ApplyCharacterProgressionCommandV1["choices"] = [{
    kind: "CLASS",
    selectionRefs: ["class:fighter"]
  }]
): ApplyCharacterProgressionCommandV1 {
  return {
    schemaVersion: 1,
    contractVersion: CHARACTER_PROGRESSION_APPLICATION_CONTRACT_V1,
    clientRequestId,
    awardId,
    characterAggregateId: fixture.characterAggregateId,
    tacticalProjectionAggregateId: fixture.tacticalProjectionAggregateId,
    narrativeProjectionAggregateId: fixture.narrativeProjectionAggregateId,
    expectedCharacterRevision: 0,
    expectedTacticalProjectionRevision: 0,
    expectedNarrativeProjectionRevision: 0,
    restWindow: fixture.restWindow,
    choices,
    candidate: {
      characterState: {
        schemaVersion: 1,
        characterId: "pc-aryn",
        sourceFingerprint: "sha256:fixture",
        rulesetId: "rules.jdr5e",
        rulesetVersion: 2,
        name: "Aryn",
        raceId: "human",
        backgroundId: "veteran",
        classes: [{ classId: "fighter", subclassId: null, level: 2 }],
        globalLevel: 2,
        abilityScores: { FOR: 16, DEX: 14, CON: 14, INT: 10, SAG: 12, CHA: 10 },
        currentHitPoints: 12,
        temporaryHitPoints: 0,
        exhaustion: 0,
        languages: ["commun"],
        skills: [],
        expertise: [],
        proficiencies: {},
        inventory: [],
        equipmentSlots: {},
        actionIds: [],
        reactionIds: [],
        spellIds: [],
        featureIds: ["action-surge", "tactical-mind"],
        choices: {},
        progressionHistory: [{
          source: "class:fighter",
          level: 2,
          grants: ["feature:action-surge", "feature:tactical-mind"]
        }],
        description: {},
        profile: {},
        appearance: {},
        movementModes: {},
        vision: {},
        resources: {}
      },
      tacticalProjection: {
        schemaVersion: 1,
        characterId: "pc-aryn",
        level: 2,
        abilityModifiers: { FOR: 3, DEX: 2, CON: 2, INT: 0, SAG: 1, CHA: 0 },
        proficiencyBonus: 2,
        currentHitPoints: 12,
        maximumHitPoints: 20,
        temporaryHitPoints: 0,
        armorClass: 16,
        passivePerception: 11,
        movementModes: {},
        vision: {},
        actionIds: [],
        reactionIds: [],
        spellIds: [],
        resources: {},
        equippedItemInstanceIds: [],
        appearance: {}
      },
      narrativeProjection: {
        schemaVersion: 1,
        characterId: "pc-aryn",
        name: "Aryn",
        raceId: "human",
        backgroundId: "veteran",
        languages: ["commun"],
        observable: {},
        knownToPlayer: { progression: ["Fougue et Sens tactique."] },
        privateMechanical: {
          globalLevel: 2,
          featureIds: ["action-surge", "tactical-mind"]
        }
      }
    }
  };
}

async function main(): Promise<void> {
  const fixture = await setup();
  const campaignBefore = ok(await fixture.repository.getCampaign(fixture.campaignId));

  const noPolicy = await evaluateAndGrantCharacterProgressionAwardV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command(fixture, "req-progression-no-policy"),
    policy: null
  });
  assert.equal(noPolicy.ok, false);

  let ineligibleCalls = 0;
  const ineligiblePolicy: CharacterProgressionEligibilityPolicyV1 = {
    policyRef: "progression-policy:milestone-v1",
    evaluate: () => {
      ineligibleCalls += 1;
      return {
        schemaVersion: 1,
        eligible: false,
        reasonCode: "EVENT_NOT_A_MILESTONE",
        awardKind: null,
        requiredChoices: []
      };
    }
  };
  const ineligible = ok(await evaluateAndGrantCharacterProgressionAwardV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command(fixture, "req-progression-ineligible"),
    policy: ineligiblePolicy
  }));
  assert.equal(ineligible.status, "INELIGIBLE");
  assert.equal(ineligible.commitId, null);
  assert.equal(ineligibleCalls, 1);
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    campaignBefore.campaignRevision
  );

  let eligibleCalls = 0;
  const eligiblePolicy: CharacterProgressionEligibilityPolicyV1 = {
    policyRef: "progression-policy:milestone-v1",
    evaluate: ({ sourceEvent, character }) => {
      eligibleCalls += 1;
      assert.equal(sourceEvent.eventType, "mission.completed");
      assert.equal(character.globalLevel, 1);
      return {
        schemaVersion: 1,
        eligible: true,
        reasonCode: "MILESTONE_COMPLETED",
        awardKind: "CLASS_LEVEL",
        requiredChoices: ["CLASS"]
      };
    }
  };
  const granted = ok(await evaluateAndGrantCharacterProgressionAwardV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command(fixture, "req-progression-granted"),
    policy: eligiblePolicy
  }));
  assert.equal(granted.status, "GRANTED");
  assert.equal(granted.award?.status, "CHOICE_REQUIRED");
  assert.deepEqual(granted.publicNotice?.requiredChoices, ["CLASS"]);
  assert.equal(granted.publicNotice?.availableAtGameSecond, 0);
  assert.equal(eligibleCalls, 1);

  const replay = ok(await evaluateAndGrantCharacterProgressionAwardV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command(fixture, "req-progression-granted"),
    policy: eligiblePolicy
  }));
  assert.equal(replay.replayed, true);
  assert.equal(replay.commitId, granted.commitId);
  assert.equal(eligibleCalls, 1, "replay must not call the policy again");

  const duplicateSource = ok(await evaluateAndGrantCharacterProgressionAwardV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command(fixture, "req-progression-duplicate-source"),
    policy: eligiblePolicy
  }));
  assert.equal(duplicateSource.status, "ALREADY_GRANTED");
  assert.equal(duplicateSource.commitId, null);
  assert.equal(duplicateSource.replayed, false);
  assert.equal(eligibleCalls, 1, "duplicate source must be detected before policy evaluation");

  const registry = ok(await loadCharacterProgressionRegistryV1(
    fixture.repository,
    fixture.campaignId
  ));
  assert.equal(registry.state.awards.length, 1);
  assert.equal(registry.aggregate?.aggregateType, CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1);
  assert.equal(
    registry.aggregate?.aggregateId,
    characterProgressionRegistryAggregateIdV1(fixture.campaignId)
  );

  const events = ok(await fixture.repository.listEvents(fixture.campaignId, null, 50));
  const publicEvents = events.filter(event =>
    event.eventType === "progression_award_granted"
    || event.eventType === "progression_choice_required"
  );
  assert.equal(publicEvents.length, 2);
  const serializedPublic = JSON.stringify(publicEvents);
  assert.equal(serializedPublic.includes("secret-patron"), false);
  assert.equal(serializedPublic.includes("mission-private-ledger"), false);
  assert.equal(
    ok(await fixture.repository.getAggregate(
      fixture.campaignId,
      "character.state",
      fixture.characterAggregateId
    )).aggregateRevision,
    0,
    "6E-A must not mutate the character before choices and ruleset validation"
  );

  const applicationOutsideRest = await applyCharacterProgressionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: applicationCommand(
      fixture,
      granted.award!.awardId,
      "req-progression-application-outside-rest"
    ),
    validator: {
      validatorRef: "character-ruleset-validator:1",
      validate: () => {
        assert.fail("application without a committed rest window must not reach rules validation");
      }
    }
  });
  assert.equal(applicationOutsideRest.ok, false);
  if (!applicationOutsideRest.ok) {
    assert.equal(
      applicationOutsideRest.error.messageKey,
      "progression.application-rest-window-invalid"
    );
  }
  Object.assign(
    fixture.restWindow,
    await commitProgressionRestWindow(
      fixture,
      granted.award!.awardId,
      "main-progression"
    )
  );

  const applicationWithoutValidator = await applyCharacterProgressionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: applicationCommand(
      fixture,
      granted.award!.awardId,
      "req-progression-application-no-validator"
    ),
    validator: null
  });
  assert.equal(applicationWithoutValidator.ok, false);

  const staleApplication = await applyCharacterProgressionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      ...applicationCommand(
        fixture,
        granted.award!.awardId,
        "req-progression-application-stale"
      ),
      expectedCharacterRevision: 1
    },
    validator: {
      validatorRef: "character-ruleset-validator:1",
      validate: () => {
        assert.fail("stale revisions must be rejected before calling the validator");
      }
    }
  });
  assert.equal(staleApplication.ok, false);
  if (!staleApplication.ok) {
    assert.equal(staleApplication.error.messageKey, "progression.application-stale-projection");
  }

  const missingChoice = await applyCharacterProgressionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: applicationCommand(
      fixture,
      granted.award!.awardId,
      "req-progression-application-missing-choice",
      []
    ),
    validator: {
      validatorRef: "character-ruleset-validator:1",
      validate: () => {
        assert.fail("boundary validation must reject before calling the validator");
      }
    }
  });
  assert.equal(missingChoice.ok, false);

  let rejectedValidationCalls = 0;
  const rejectingValidator: CharacterProgressionCandidateValidatorV1 = {
    validatorRef: "character-ruleset-validator:1",
    validate: () => {
      rejectedValidationCalls += 1;
      return {
        schemaVersion: 1,
        valid: false,
        reasonCodes: ["CLASS_PROGRESSION_GRANT_MISMATCH"],
        ruleDecisionRefs: ["rule:class-progression@1"],
        publicSummary: null
      };
    }
  };
  const campaignBeforeRejection = ok(
    await fixture.repository.getCampaign(fixture.campaignId)
  );
  const rejectedApplication = ok(await applyCharacterProgressionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: applicationCommand(
      fixture,
      granted.award!.awardId,
      "req-progression-application-rejected"
    ),
    validator: rejectingValidator
  }));
  assert.equal(rejectedApplication.status, "REJECTED");
  assert.equal(rejectedApplication.commitId, null);
  assert.equal(rejectedValidationCalls, 1);
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    campaignBeforeRejection.campaignRevision
  );

  const manifest = await createMvpRulesetManifestV1("content.jdr5e", 1, 1, 2);
  const loadedRules = await loadRuleRegistryV1({
    contentPackageId: "content.jdr5e",
    contentPackageVersion: 1,
    manifest,
    definitions: MVP_RULE_DEFINITIONS_V1,
    executors: MVP_RULE_EXECUTORS_V1
  });
  if (!loadedRules.ok) assert.fail("MVP rule registry should load");
  let validValidationCalls = 0;
  const catalogValidator = createCharacterProgressionCatalogValidatorV1({
    catalog: currentCharacterProgressionCatalogV1(),
    rules: loadedRules.value
  });
  const validator: CharacterProgressionCandidateValidatorV1 = {
    validatorRef: catalogValidator.validatorRef,
    validate: async input => {
      validValidationCalls += 1;
      return catalogValidator.validate(input);
    }
  };
  const [currentCharacterAggregate, currentTacticalAggregate, currentNarrativeAggregate] =
    await Promise.all([
      fixture.repository.getAggregate(
        fixture.campaignId,
        "character.state",
        fixture.characterAggregateId
      ),
      fixture.repository.getAggregate(
        fixture.campaignId,
        "character.tactical-projection",
        fixture.tacticalProjectionAggregateId
      ),
      fixture.repository.getAggregate(
        fixture.campaignId,
        "character.narrative-projection",
        fixture.narrativeProjectionAggregateId
      )
    ]);
  const preparedCandidate = await prepareCharacterProgressionCandidateV1({
    catalog: currentCharacterProgressionCatalogV1(),
    rules: loadedRules.value,
    currentCharacter:
      ok(currentCharacterAggregate).payload as unknown as CharacterAggregatePayloadV1,
    currentTacticalProjection:
      ok(currentTacticalAggregate).payload as unknown as TacticalCharacterProjectionV1,
    currentNarrativeProjection:
      ok(currentNarrativeAggregate).payload as unknown as NarrativeCharacterProjectionV1,
    choices: [{ kind: "CLASS", selectionRefs: ["class:fighter"] }]
  });
  if (preparedCandidate.status !== "READY") {
    assert.fail("catalog candidate should be ready");
  }
  assert.deepEqual(
    preparedCandidate.candidate.characterState.featureIds,
    ["action-surge", "tactical-mind"]
  );
  const levelThreeCharacter = cloneJson(
    ok(currentCharacterAggregate).payload
  ) as unknown as CharacterAggregatePayloadV1;
  levelThreeCharacter.classes = [{
    classId: "fighter",
    subclassId: "eldritch-knight",
    level: 3
  }];
  levelThreeCharacter.globalLevel = 3;
  const levelThreeTactical = cloneJson(
    ok(currentTacticalAggregate).payload
  ) as unknown as TacticalCharacterProjectionV1;
  levelThreeTactical.level = 3;
  const unresolvedLevelFour = await prepareCharacterProgressionCandidateV1({
    catalog: currentCharacterProgressionCatalogV1(),
    rules: loadedRules.value,
    currentCharacter: levelThreeCharacter,
    currentTacticalProjection: levelThreeTactical,
    currentNarrativeProjection:
      ok(currentNarrativeAggregate).payload as unknown as NarrativeCharacterProjectionV1,
    choices: [{ kind: "CLASS", selectionRefs: ["class:fighter"] }]
  });
  assert.equal(unresolvedLevelFour.status, "CONTENT_INCOMPLETE");
  assert.equal(
    unresolvedLevelFour.reasonCodes.includes("ABILITY_SCORE_OR_FEAT_CHOICE_REQUIRED"),
    true,
    "an unresolved ASI or feat must suspend candidate preparation"
  );
  const incompleteCatalogProjection = applicationCommand(
    fixture,
    granted.award!.awardId,
    "req-progression-application-incomplete-catalog-projection"
  );
  incompleteCatalogProjection.candidate = cloneJson(
    preparedCandidate.candidate
  ) as unknown as ApplyCharacterProgressionCommandV1["candidate"];
  incompleteCatalogProjection.candidate.characterState.featureIds = ["action-surge"];
  incompleteCatalogProjection.candidate.characterState.progressionHistory = [{
    source: "class:fighter",
    level: 2,
    grants: ["feature:action-surge"]
  }];
  incompleteCatalogProjection.candidate.narrativeProjection.knownToPlayer = {
    progression: ["Fougue"]
  };
  incompleteCatalogProjection.candidate.narrativeProjection.privateMechanical = {
    globalLevel: 2,
    featureIds: ["action-surge"]
  };
  const incompleteResult = ok(await applyCharacterProgressionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: incompleteCatalogProjection,
    validator
  }));
  assert.equal(incompleteResult.status, "REJECTED");
  assert.equal(incompleteResult.commitId, null);
  assert.equal(incompleteResult.reasonCodes.includes("FEATURE_GRANT_MISMATCH"), true);
  assert.equal(
    ok(await loadCharacterProgressionRegistryV1(fixture.repository, fixture.campaignId))
      .state.awards[0]?.status,
    "CHOICE_REQUIRED",
    "an incomplete catalog projection must leave the award pending"
  );
  const applicationInput = applicationCommand(
    fixture,
    granted.award!.awardId,
    "req-progression-application-applied"
  );
  applicationInput.candidate = preparedCandidate.candidate as unknown as ApplyCharacterProgressionCommandV1["candidate"];
  const applied = ok(await applyCharacterProgressionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: applicationInput,
    validator
  }));
  assert.equal(applied.status, "APPLIED", JSON.stringify(applied.reasonCodes));
  assert.equal(applied.award.status, "APPLIED");
  assert.equal(applied.award.appliedAtGameSecond, 3_600);
  assert.equal(applied.award.version, 2);
  assert.equal(applied.publicSummary?.newGlobalLevel, 2);
  assert.equal(applied.publicSummary?.progressionLabel, "guerrier de niveau 2");
  assert.deepEqual(applied.publicSummary?.grantedLabels, ["Fougue et Sens tactique"]);
  assert.equal(validValidationCalls, 2);
  const appliedOperation = ok(await fixture.repository.getOperation(
    id<OperationId>("character-progression-application:req-progression-application-applied")
  ));
  assert.deepEqual(
    (appliedOperation.requestPayload as {
      choices?: ApplyCharacterProgressionCommandV1["choices"];
    }).choices,
    [{ kind: "CLASS", selectionRefs: ["class:fighter"] }]
  );

  const appliedReplay = ok(await applyCharacterProgressionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: applicationInput,
    validator
  }));
  assert.equal(appliedReplay.replayed, true);
  assert.equal(appliedReplay.commitId, applied.commitId);
  assert.equal(validValidationCalls, 2, "application replay must not call the validator again");

  const [nextCharacter, nextTactical, nextNarrative, appliedRegistry] = await Promise.all([
    fixture.repository.getAggregate(
      fixture.campaignId,
      "character.state",
      fixture.characterAggregateId
    ),
    fixture.repository.getAggregate(
      fixture.campaignId,
      "character.tactical-projection",
      fixture.tacticalProjectionAggregateId
    ),
    fixture.repository.getAggregate(
      fixture.campaignId,
      "character.narrative-projection",
      fixture.narrativeProjectionAggregateId
    ),
    loadCharacterProgressionRegistryV1(fixture.repository, fixture.campaignId)
  ]);
  assert.equal(ok(nextCharacter).aggregateRevision, 1);
  assert.equal(ok(nextTactical).aggregateRevision, 1);
  assert.equal(ok(nextNarrative).aggregateRevision, 1);
  assert.equal((ok(nextCharacter).payload as { globalLevel?: number }).globalLevel, 2);
  assert.equal((ok(nextTactical).payload as { level?: number }).level, 2);
  assert.equal(
    ok(appliedRegistry).state.awards[0]?.status,
    "APPLIED"
  );
  const applicationEvents = ok(
    await fixture.repository.listEvents(fixture.campaignId, null, 100)
  ).filter(event =>
    event.eventType === "progression_award_applied"
    || event.eventType === "player_level_changed"
  );
  assert.equal(applicationEvents.length, 2);
  assert.equal(JSON.stringify(applicationEvents).includes("secret-patron"), false);

  const campaignBeforeProjection = ok(
    await fixture.repository.getCampaign(fixture.campaignId)
  );
  const projectionController = new NarrativeTurnControllerV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    clock: new FixedClock(),
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null
  });
  const rejectedProjection = await projectionController.projectCharacterProgression({
    schemaVersion: 1,
    applicationOperationId:
      "character-progression-application:req-progression-application-rejected",
    sceneId: "scene:progression-6e"
  });
  assert.equal(rejectedProjection.ok, false);
  if (!rejectedProjection.ok) {
    assert.equal(
      rejectedProjection.error.messageKey,
      "progression.presentation.source-not-committed"
    );
  }
  const projected = ok(await projectionController.projectCharacterProgression({
    schemaVersion: 1,
    applicationOperationId:
      "character-progression-application:req-progression-application-applied",
    sceneId: "scene:progression-6e"
  }));
  assert.equal(projected.displayPacket.displayBlocks.length, 1);
  assert.equal(projected.displayPacket.displayBlocks[0]?.kind, "GM_NARRATION");
  assert.equal(
    projected.displayPacket.displayBlocks[0]?.text,
    "L'expérience d'Aryn porte ses fruits : Aryn est désormais guerrier de niveau 2. "
      + "Aryn maîtrise désormais Fougue et Sens tactique."
  );
  assert.equal(projected.projection.projection.authority, "PRESENTATION_ONLY");
  assert.equal(projected.projection.projection.noGameTime, true);

  const projectedReplay = ok(await projectionController.projectCharacterProgression({
    schemaVersion: 1,
    applicationOperationId:
      "character-progression-application:req-progression-application-applied",
    sceneId: "scene:progression-6e"
  }));
  assert.equal(
    projectedReplay.projection.operation.operationId,
    projected.projection.operation.operationId
  );
  const restoredProgressionThread = ok(
    await projectionController.restoreRenderedThread()
  );
  assert.equal(restoredProgressionThread.displayPackets.length, 1);
  assert.deepEqual(
    restoredProgressionThread.displayPackets[0],
    projected.displayPacket
  );
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    campaignBeforeProjection.campaignRevision,
    "presentation and restoration must not mutate the campaign"
  );
  assert.equal(
    ok(await fixture.repository.getAggregate(
      fixture.campaignId,
      "character.state",
      fixture.characterAggregateId
    )).aggregateRevision,
    1,
    "presentation replay must not reapply character progression"
  );

  const applicationConflict = await applyCharacterProgressionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      ...applicationInput,
      choices: [{ kind: "CLASS", selectionRefs: ["class:cleric"] }]
    },
    validator
  });
  assert.equal(applicationConflict.ok, false);
  if (!applicationConflict.ok) {
    assert.equal(applicationConflict.error.code, "IDEMPOTENCY_CONFLICT");
  }

  const failureControl: FailureControl = {
    enabled: false,
    point: "AFTER_AGGREGATES"
  };
  const rollbackFixture = await setup(failureControl);
  const rollbackGrant = ok(await evaluateAndGrantCharacterProgressionAwardV1({
    repository: rollbackFixture.repository,
    campaignId: rollbackFixture.campaignId,
    command: command(rollbackFixture, "req-progression-rollback-grant"),
    policy: eligiblePolicy
  }));
  assert.equal(rollbackGrant.status, "GRANTED");
  Object.assign(
    rollbackFixture.restWindow,
    await commitProgressionRestWindow(
      rollbackFixture,
      rollbackGrant.award!.awardId,
      "rollback-progression"
    )
  );
  const campaignBeforeInjectedFailure = ok(
    await rollbackFixture.repository.getCampaign(rollbackFixture.campaignId)
  );
  failureControl.enabled = true;
  const failedApplication = await applyCharacterProgressionV1({
    repository: rollbackFixture.repository,
    campaignId: rollbackFixture.campaignId,
    command: applicationCommand(
      rollbackFixture,
      rollbackGrant.award!.awardId,
      "req-progression-application-rollback"
    ),
    validator
  });
  failureControl.enabled = false;
  assert.equal(failedApplication.ok, false);
  if (!failedApplication.ok) {
    assert.equal(failedApplication.error.code, "PERSISTENCE_FAILURE");
  }
  const [
    campaignAfterInjectedFailure,
    characterAfterInjectedFailure,
    tacticalAfterInjectedFailure,
    narrativeAfterInjectedFailure,
    registryAfterInjectedFailure,
    eventsAfterInjectedFailure
  ] = await Promise.all([
    rollbackFixture.repository.getCampaign(rollbackFixture.campaignId),
    rollbackFixture.repository.getAggregate(
      rollbackFixture.campaignId,
      "character.state",
      rollbackFixture.characterAggregateId
    ),
    rollbackFixture.repository.getAggregate(
      rollbackFixture.campaignId,
      "character.tactical-projection",
      rollbackFixture.tacticalProjectionAggregateId
    ),
    rollbackFixture.repository.getAggregate(
      rollbackFixture.campaignId,
      "character.narrative-projection",
      rollbackFixture.narrativeProjectionAggregateId
    ),
    loadCharacterProgressionRegistryV1(
      rollbackFixture.repository,
      rollbackFixture.campaignId
    ),
    rollbackFixture.repository.listEvents(rollbackFixture.campaignId, null, 100)
  ]);
  assert.equal(
    ok(campaignAfterInjectedFailure).campaignRevision,
    campaignBeforeInjectedFailure.campaignRevision
  );
  assert.equal(ok(characterAfterInjectedFailure).aggregateRevision, 0);
  assert.equal(ok(tacticalAfterInjectedFailure).aggregateRevision, 0);
  assert.equal(ok(narrativeAfterInjectedFailure).aggregateRevision, 0);
  assert.equal(ok(registryAfterInjectedFailure).state.awards[0]?.status, "CHOICE_REQUIRED");
  assert.equal(
    ok(eventsAfterInjectedFailure).some(event =>
      event.eventType === "progression_award_applied"
      || event.eventType === "player_level_changed"
    ),
    false
  );

  const conflict = await evaluateAndGrantCharacterProgressionAwardV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      ...command(fixture, "req-progression-granted"),
      sourceEventId: "event:other"
    },
    policy: eligiblePolicy
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  console.log(
    "character-progression-registry/1 + character-progression-award/1 + character-progression-application/1: OK"
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
