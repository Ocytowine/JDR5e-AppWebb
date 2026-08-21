import assert from "node:assert/strict";
import {
  CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
  COMPANION_PARTY_REGISTRY_AGGREGATE_TYPE_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  SCENE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1,
  SOCIAL_ACTOR_MUTATION_COMMAND_V1,
  NarrativeTurnControllerV1,
  campaignNpcRegistryAggregateIdV1,
  changeCompanionPresenceV1,
  companionDirectiveNarrationV1,
  companionRecruitmentNarrationV1,
  companionTravelPartySnapshotV1,
  createDefaultNpcPerformerConfigV1,
  decideCompanionDirectiveV1,
  loadCompanionPartyRegistryV1,
  mutateSocialActorStateV1,
  moveCompanionPartyV1,
  projectActiveCompanionsIntoSceneV1,
  recruitCompanionV1,
  sceneActorRegistryAggregateIdV1,
  type CampaignNpcRegistryV1,
  type CompanionAutonomyPolicyV1,
  type MissionRelationRegistryV1,
  type SceneActorRegistryV1
} from "../../src/application";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type { AiCallRequestV1, AiRoleOutputEnvelopeV1, AiSemanticIntentPayloadV6 } from "../../src/ai/types";
import { MemoryCampaignBootstrapRepository, type CampaignBootstrapRepository } from "../../src/bootstrap";
import {
  computeRequestFingerprint,
  opaqueId,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
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
import { campaignBootstrapFixture } from "../contracts/verify-campaign-bootstrap";

class FixedClock implements RepositoryClock {
  now(): Date { return new Date("2026-08-21T10:00:00.000Z"); }
}

type Repository = CampaignRepository & CampaignBootstrapRepository;
function ok<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKey} ${JSON.stringify(result.error.details)}`);
  return result.value;
}

const actorId = "scene:archives:actor:clerk-companion";
const campaignNpcId = `campaign-npc:${actorId}`;
const engagementId = "engagement:j7:shared-road";
const durableRef = "relation:j7:shared-road";
const leaderActorId = "actor:player";
const archivesSceneId = "scene:archives";
const squareSceneId = "scene:archives-square";

const policy: CompanionAutonomyPolicyV1 = {
  schemaVersion: 1,
  policyId: "companion-policy:clerk-j7",
  policyRevision: 1,
  sourceRefs: ["social-actor:clerk:autonomy"],
  rules: [{
    schemaVersion: 1,
    category: "ASSIST",
    disposition: "ACCEPTED",
    adaptation: null,
    conditions: [],
    sourceRefs: ["social-concern:protect-records"]
  }, {
    schemaVersion: 1,
    category: "SCOUT",
    disposition: "ADAPTED",
    adaptation: "Il observera les accès sans s'éloigner hors de portée de voix.",
    conditions: [],
    sourceRefs: ["social-boundary:avoid-isolation"]
  }, {
    schemaVersion: 1,
    category: "PERSONAL_RISK",
    disposition: "REFUSED",
    adaptation: null,
    conditions: [],
    sourceRefs: ["social-boundary:no-reckless-danger"]
  }]
};

const freeDirectiveProvider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
    const task = call.input.task as { rawInput: string; activeCompanionRefs: string[] };
    assert.equal(task.rawInput, "Marel, pourrais-tu examiner ces deux registres avec moi ?");
    assert.deepEqual(task.activeCompanionRefs, [`npc:${actorId}`]);
    return {
      schemaVersion: 1,
      contractVersion: call.contractVersion,
      outputId: `output:${call.attemptId}`,
      callId: call.callId,
      attemptId: call.attemptId,
      packId: call.packId,
      snapshotId: call.snapshotId,
      role: call.role,
      status: "OK",
      payload: {
        rawInputEcho: task.rawInput,
        intent: {
          kind: "address_visible_actor",
          commitment: "committed",
          preconditions: [],
          playerGoal: "Demander à Marel de comparer deux registres avec le joueur.",
          actionHint: "comparer ensemble des registres",
          domainHint: "social",
          scope: "SOCIAL_EXCHANGE",
          targetMention: { surface: "Marel", candidateKind: "npc", proposedRef: `npc:${actorId}`, contextLink: "EXPLICIT" },
          perception: null,
          dialogueAct: { act: "REQUEST_ACTION", contentGoal: "Examiner ensemble deux registres." },
          uncertainties: [],
          clarificationPrompt: null,
          confidence: "high",
          composition: {
            orientation: null,
            spatialLeadIn: null,
            communication: { mode: "SPEECH", act: "REQUEST_ACTION", contentGoal: "Examiner ensemble deux registres.", order: 1 },
            spatialFollowUp: null
          },
          companionDirective: {
            schemaVersion: 1,
            category: "ASSIST",
            requestSummary: "Examiner ensemble les deux registres."
          }
        }
      },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV6>;
  }
};

async function seedOwnerRegistries(repository: Repository, campaignId: CampaignId): Promise<void> {
  const campaign = ok(await repository.getCampaign(campaignId));
  const operationId = opaqueId<OperationId>("seed:j7:owners");
  const payload = { engagementId, campaignNpcId };
  const fingerprint = await computeRequestFingerprint("test.seed-j7-owners", 1, payload);
  const operation: OperationRecord = {
    schemaVersion: 1, operationId, campaignId,
    clientRequestId: opaqueId<RequestId>("seed:j7:owners"),
    idempotencyKey: opaqueId<IdempotencyKey>("seed:j7:owners"),
    requestFingerprint: fingerprint, operationKind: "test.seed-j7-owners",
    requestPayloadSchemaVersion: 1, requestPayload: payload,
    phase: "RECEIVED", observedCampaignRevision: campaign.campaignRevision,
    commitId: null, completionMode: null, resultPayloadSchemaVersion: null,
    resultPayload: null, failure: null,
    receivedAt: "2026-08-21T10:00:00.000Z", updatedAt: "2026-08-21T10:00:00.000Z"
  };
  ok(await repository.receiveOperation(operation));
  ok(await repository.transitionOperation(operationId, "RECEIVED", "PREPARING"));
  ok(await repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT"));
  const lease = ok(await repository.acquireWriterLease(campaignId, opaqueId<WriterId>("writer:j7:owners"), 120_000));
  const commandId = opaqueId<CommandId>("command:j7:owners");
  const missionRegistry: MissionRelationRegistryV1 = {
    schemaVersion: 1,
    contractVersion: "mission-relation-registry/1",
    campaignId,
    engagements: [{
      schemaVersion: 1,
      engagementId,
      engagementKind: "RELATION",
      sceneId: archivesSceneId,
      sceneActorId: actorId,
      durableRef,
      summary: "Ils choisissent de poursuivre la route ensemble.",
      proposedBy: "PLAYER",
      proposalOperationId: "operation:j7:proposal",
      proposalSourceRefs: ["dialogue:j7:proposal"],
      status: "ACCEPTED",
      resolution: {
        schemaVersion: 1,
        disposition: "ACCEPTED",
        authority: "SOCIAL",
        evidenceKind: "SOCIAL_RESOLUTION",
        authorityOperationId: "operation:j7:social-acceptance",
        publicSourceRefs: ["social:j7:mutual-choice"],
        conditions: [],
        version: 1
      },
      resolutionOperationId: "operation:j7:social-acceptance",
      missionOutcome: null,
      version: 1
    }],
    version: 2
  };
  const npcRegistry: CampaignNpcRegistryV1 = {
    schemaVersion: 1,
    contractVersion: "campaign-npc-registry/1",
    campaignId,
    npcs: [{
      schemaVersion: 1,
      campaignNpcId,
      actorId,
      originSceneId: archivesSceneId,
      displayName: "Marel",
      publicRole: "Clerc des Archives",
      visibleAppearance: "une sacoche de registres serrée contre lui",
      cause: {
        schemaVersion: 1,
        causeKind: "RELATION_CONFIRMED",
        authority: "SOCIAL",
        durableRef,
        publicSourceRefs: ["social:j7:mutual-choice"],
        version: 1
      },
      promotedByOperationId: "operation:j7:promotion",
      sourceRefs: ["social:j7:mutual-choice"],
      version: 1
    }],
    version: 2
  };
  const sceneActorRegistry: SceneActorRegistryV1 = {
    schemaVersion: 1,
    contractVersion: "scene-actor-registry/1",
    sceneId: archivesSceneId,
    actors: [{
      schemaVersion: 1,
      sceneId: archivesSceneId,
      actorId,
      displayName: "Marel",
      publicRole: "Clerc des Archives",
      visibleActivity: "compare deux registres",
      visibleAppearance: "une sacoche de registres serrée contre lui",
      demeanor: "prudent",
      immediateGoal: "comparer les témoignages",
      currentPressure: "éviter un risque inutile",
      speechStyle: ["posé"],
      conversationalHooks: ["registres"],
      boundaries: ["refuse les risques inconsidérés"],
      knowledgeRefs: ["social:j7:mutual-choice"],
      keywords: ["Marel", "clerc"],
      promotedByOperationId: "operation:j7:scene-actor",
      version: 1
    }],
    version: 1
  };
  try {
    ok(await repository.commit({
      campaignId, operationId, commitId: opaqueId<CommitId>("commit:j7:owners"),
      idempotencyKey: operation.idempotencyKey, requestFingerprint: fingerprint,
      expectedCampaignRevision: campaign.campaignRevision, writerLease: lease,
      acceptedCommands: [{
        schemaVersion: 1, contractId: "test.seed-j7-owners", contractVersion: 1,
        commandId, campaignId, operationId, commandType: "test.seed-j7-owners",
        target: { aggregateType: "mission-relation.registry", aggregateId: opaqueId(`agg-mission-relations:${campaignId}`), expectedAggregateRevision: null },
        payloadSchemaVersion: 1, payload, acceptedAtGameSecond: 0
      }],
      aggregateWrites: [{
        aggregateType: "mission-relation.registry", aggregateId: opaqueId(`agg-mission-relations:${campaignId}`), expectedAggregateRevision: null,
        payloadSchemaVersion: 1, payload: missionRegistry
      }, {
        aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: campaignNpcRegistryAggregateIdV1(campaignId), expectedAggregateRevision: null,
        payloadSchemaVersion: 1, payload: npcRegistry
      }, {
        aggregateType: SCENE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: sceneActorRegistryAggregateIdV1(archivesSceneId), expectedAggregateRevision: null,
        payloadSchemaVersion: 1, payload: sceneActorRegistry
      }],
      events: [{
        schemaVersion: 1, eventId: opaqueId<EventId>("event:j7:owners"), campaignId, operationId,
        eventType: "test.j7-owners-seeded", origin: "SYSTEM", causation: { kind: "COMMAND", id: commandId },
        aggregateRefs: [{
          aggregateType: "mission-relation.registry",
          aggregateId: opaqueId(`agg-mission-relations:${campaignId}`),
          aggregateRevision: 0
        }, {
          aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
          aggregateId: campaignNpcRegistryAggregateIdV1(campaignId),
          aggregateRevision: 0
        }], visibility: { scope: "SYSTEM", actorIds: [] }, occurredAtGameSecond: 0,
        payloadSchemaVersion: 1, payload
      }], outboxTasks: []
    }));
  } finally {
    ok(await repository.releaseWriterLease(lease));
  }
  ok(await repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, { seeded: true }));
}

async function run(): Promise<void> {
  const repository = new MemoryCampaignBootstrapRepository({ clock: new FixedClock() });
  const request = await campaignBootstrapFixture(new FixedClock(), "companion_j7");
  const bootstrap = ok(await repository.bootstrapCampaign(request));
  ok(await repository.completePresentation(bootstrap.operation.operationId, "COMMITTED_RENDERED", 1, { ready: true }));
  const campaignId = bootstrap.campaign.campaignId;
  await seedOwnerRegistries(repository, campaignId);

  const rejected = await recruitCompanionV1({
    repository, campaignId,
    command: {
      schemaVersion: 1, clientRequestId: "j7:recruit:wrong-actor", campaignNpcId,
      actorId: "actor:someone-else", engagementId, activeSceneId: archivesSceneId,
      leaderActorId, occurredAtGameSecond: 0, autonomyPolicy: policy
    }
  });
  assert.equal(rejected.ok, false);

  const recruited = ok(await recruitCompanionV1({
    repository, campaignId,
    command: {
      schemaVersion: 1, clientRequestId: "j7:recruit:marel", campaignNpcId,
      actorId, engagementId, activeSceneId: archivesSceneId, leaderActorId,
      occurredAtGameSecond: 0, autonomyPolicy: policy
    }
  }));
  assert.equal(recruited.member?.status, "ACTIVE");
  assert.match(companionRecruitmentNarrationV1("Marel"), /choisit de poursuivre la route/u);
  const replay = ok(await recruitCompanionV1({
    repository, campaignId,
    command: {
      schemaVersion: 1, clientRequestId: "j7:recruit:marel", campaignNpcId,
      actorId, engagementId, activeSceneId: archivesSceneId, leaderActorId,
      occurredAtGameSecond: 0, autonomyPolicy: policy
    }
  }));
  assert.equal(replay.replayed, true);
  assert.equal(replay.registry.members.length, 1);

  const accepted = ok(await decideCompanionDirectiveV1({
    repository, campaignId,
    command: { schemaVersion: 1, clientRequestId: "j7:directive:assist", directiveId: "directive:j7:assist", campaignNpcId, category: "ASSIST", requestSummary: "Aide-moi à comparer ces notes.", occurredAtGameSecond: 0 }
  }));
  assert.equal(accepted.directive?.disposition, "ACCEPTED");
  assert.equal(accepted.directive?.executionStatus, "NOT_STARTED");
  assert.doesNotMatch(companionDirectiveNarrationV1({ companionName: "Marel", directive: accepted.directive! }), /ACCEPTED|NOT_STARTED|directive/iu);
  const adapted = ok(await decideCompanionDirectiveV1({
    repository, campaignId,
    command: { schemaVersion: 1, clientRequestId: "j7:directive:scout", directiveId: "directive:j7:scout", campaignNpcId, category: "SCOUT", requestSummary: "Va voir seul ce qui se passe devant.", occurredAtGameSecond: 0 }
  }));
  assert.equal(adapted.directive?.disposition, "ADAPTED");
  assert.match(adapted.directive?.adaptation ?? "", /sans s'éloigner/u);
  assert.match(companionDirectiveNarrationV1({ companionName: "Marel", directive: adapted.directive! }), /à sa manière/iu);
  const refused = ok(await decideCompanionDirectiveV1({
    repository, campaignId,
    command: { schemaVersion: 1, clientRequestId: "j7:directive:risk", directiveId: "directive:j7:risk", campaignNpcId, category: "PERSONAL_RISK", requestSummary: "Expose-toi seul au danger pour faire diversion.", occurredAtGameSecond: 0 }
  }));
  assert.equal(refused.directive?.disposition, "REFUSED");
  assert.match(companionDirectiveNarrationV1({ companionName: "Marel", directive: refused.directive! }), /refuse/iu);

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    intentInterpreterConfig: {
      provider: freeDirectiveProvider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
      route: {
        schemaVersion: 1,
        routeId: "test-j7-free-companion-directive",
        role: "player_intent_interpreter",
        providerKind: "FAKE_CONTRACT",
        providerId: "test-j7",
        modelId: "fixture-j7",
        modelConfigVersion: "companion-directive-v6",
        certified: true,
        allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6],
        inputTokenLimit: 2_000,
        outputTokenLimit: 1_000,
        timeoutMs: 1_000,
        fallbackRouteIds: []
      },
      retryPolicy: {
        schemaVersion: 1,
        role: "player_intent_interpreter",
        maxTechnicalRetries: 0,
        maxTargetedCorrections: 0,
        maxFullRegenerations: 0,
        allowFallback: false
      }
    },
    mjPlannerConfig: null,
    npcPerformerConfig: createDefaultNpcPerformerConfigV1(),
    interpreterCharacterContextResolver: null,
    activeSceneResolver: {
      async resolve() {
        return {
          ok: true as const,
          value: {
            ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
            sceneId: archivesSceneId,
            locationName: "Archives",
            presentNpc: [],
            ambientPopulation: []
          }
        };
      }
    }
  });
  const freeDirective = ok(await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j7:free-directive:assist",
    rawInput: "Marel, pourrais-tu examiner ces deux registres avec moi ?"
  }));
  assert.equal(freeDirective.output.noCommit, false);
  assert.equal(freeDirective.output.npcPerformance?.actorId, `npc:${actorId}`);
  assert.equal(freeDirective.output.interpretation.semanticIntent.companionDirective?.category, "ASSIST");
  assert.match(
    freeDirective.output.displayPacket.displayBlocks.find(block => block.kind === "NPC_SPEECH")?.text ?? "",
    /Marel acquiesce/u
  );
  assert.doesNotMatch(JSON.stringify(freeDirective.output.displayPacket), /ACCEPTED|NOT_STARTED/iu);
  const afterFreeDirective = ok(await loadCompanionPartyRegistryV1({ repository, campaignId }));
  assert.equal(afterFreeDirective.state?.directives.at(-1)?.requestSummary, "Examiner ensemble les deux registres.");
  assert.equal(afterFreeDirective.state?.directives.at(-1)?.executionStatus, "NOT_STARTED");
  ok(await mutateSocialActorStateV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: SOCIAL_ACTOR_MUTATION_COMMAND_V1,
      clientRequestId: "j7:companion-initiative:concern",
      actorId,
      reason: "Préoccupation sociale persistée du compagnon.",
      sourceEventRefs: ["social:j7:marel-shared-research"],
      occurredAtGameSecond: 0,
      changes: {
        knownFactRefsAdded: [],
        beliefsUpserted: [],
        relationshipDeltas: [],
        reputationMarkersUpserted: [],
        debtsAndPromisesUpserted: [],
        concernsUpserted: [{
          concernId: "concern:j7:marel-check-registers",
          status: "ACTIVE",
          privateObjective: "Vérifier si les deux registres se contredisent.",
          publicActionHint: "propose de reprendre calmement la comparaison des registres",
          actKind: "SPEAK",
          urgency: 70,
          availableFromGameSecond: 0,
          expiresAtGameSecond: null,
          targetRefs: ["actor:player"],
          sourceRefs: ["social:j7:marel-shared-research"],
          minimumIntervalSeconds: 60,
          lastExecutedAtGameSecond: null,
          executionCount: 0
        }],
        visibilityConstraintsAdded: []
      }
    }
  }));
  const initiative = ok(await controller.processLocalSocialBoundary({
    schemaVersion: 1,
    clientRequestId: "j7:companion-initiative:boundary",
    boundaryKind: "NARRATIVE_TURN_PROGRESSED",
    playerActorId: "player",
    occurredAtGameSecond: 0
  }));
  assert.equal(initiative.initiativeResult.status, "INITIATIVE_COMMITTED");
  assert.equal(initiative.initiativeResult.initiative?.actorId, actorId);
  assert.equal(initiative.initiativeResult.initiative?.targetsPlayer, true);
  assert.match(
    initiative.displayPacket?.displayBlocks[0]?.text ?? "",
    /comparaison des registres/u
  );

  const moved = ok(await moveCompanionPartyV1({
    repository, campaignId,
    command: { schemaVersion: 1, clientRequestId: "j7:move:square", fromSceneId: archivesSceneId, toSceneId: squareSceneId, sourceWorldEventRef: "world-transition:j7:archives-square", occurredAtGameSecond: 0 }
  }));
  assert.equal(moved.registry.members[0]?.currentSceneId, squareSceneId);
  const square = { ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, sceneId: squareSceneId, presentNpc: [], ambientPopulation: [] };
  const projected = projectActiveCompanionsIntoSceneV1({
    scene: square,
    party: moved.registry,
    campaignNpcs: (ok(await repository.getAggregate(campaignId, CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1, campaignNpcRegistryAggregateIdV1(campaignId))).payload as CampaignNpcRegistryV1)
  });
  assert.equal(projected.presentNpc.some(npc => npc.actorId === actorId), true);

  const separated = ok(await changeCompanionPresenceV1({
    repository, campaignId,
    command: { schemaVersion: 1, clientRequestId: "j7:separate:marel", campaignNpcId, action: "SEPARATE", sceneId: squareSceneId, reason: "Marel reste consulter un témoin.", sourceRefs: ["dialogue:j7:separation-agreed"], occurredAtGameSecond: 0 }
  }));
  assert.equal(separated.member?.status, "SEPARATED");
  assert.equal(projectActiveCompanionsIntoSceneV1({ scene: square, party: separated.registry, campaignNpcs: projectedRegistry(repository, campaignId) }).presentNpc.length, 0);

  const rejoined = ok(await changeCompanionPresenceV1({
    repository, campaignId,
    command: { schemaVersion: 1, clientRequestId: "j7:rejoin:marel", campaignNpcId, action: "REJOIN", sceneId: squareSceneId, reason: "Ils se retrouvent sur la place.", sourceRefs: ["world-presence:j7:marel-square"], occurredAtGameSecond: 0 }
  }));
  assert.equal(rejoined.member?.status, "ACTIVE");
  const loaded = ok(await loadCompanionPartyRegistryV1({ repository, campaignId }));
  assert.equal(loaded.state?.members[0]?.status, "ACTIVE");
  const travelParty = companionTravelPartySnapshotV1(loaded.state!);
  assert.deepEqual(travelParty.memberActorIds.sort(), [leaderActorId, actorId].sort());
  assert.equal(travelParty.partyRevision, loaded.state!.version);
  const left = ok(await changeCompanionPresenceV1({
    repository, campaignId,
    command: { schemaVersion: 1, clientRequestId: "j7:leave:marel", campaignNpcId, action: "LEAVE", sceneId: squareSceneId, reason: "Marel choisit de reprendre seul la route des Archives.", sourceRefs: ["social-decision:j7:marel-leaves"], occurredAtGameSecond: 0 }
  }));
  assert.equal(left.member?.status, "LEFT");
  const forbiddenReturn = await changeCompanionPresenceV1({
    repository, campaignId,
    command: { schemaVersion: 1, clientRequestId: "j7:rejoin-after-leave:marel", campaignNpcId, action: "REJOIN", sceneId: squareSceneId, reason: "Retour sans nouvelle cause.", sourceRefs: ["player-request:j7:return"], occurredAtGameSecond: 0 }
  });
  assert.equal(forbiddenReturn.ok, false);
  const restoredController = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null
  });
  const controllerRestored = ok(await restoredController.restoreCompanionParty());
  assert.equal(controllerRestored.state?.members[0]?.status, "LEFT");
  const events = ok(await repository.listEvents(campaignId, null, 100));
  assert.equal(events.filter(event => event.eventType === "companion.recruited").length, 1);
  assert.equal(events.some(event => JSON.stringify(event.payload).includes("NOT_STARTED")), false);
  assert.equal(events.some(event => event.eventType.includes("tactical")), false);
  console.log("PASS [companion/J7] owner-backed recruitment, free written directive, bounded initiative, autonomy, multi-scene presence, separation, reunion, departure, travel snapshot and replay");
}

function projectedRegistry(repository: Repository, campaignId: CampaignId): CampaignNpcRegistryV1 {
  const memory = repository as unknown as { __unused?: never };
  void memory;
  return {
    schemaVersion: 1,
    contractVersion: "campaign-npc-registry/1",
    campaignId,
    npcs: [{
      schemaVersion: 1, campaignNpcId, actorId, originSceneId: archivesSceneId,
      displayName: "Marel", publicRole: "Clerc des Archives",
      visibleAppearance: "une sacoche de registres serrée contre lui",
      cause: { schemaVersion: 1, causeKind: "RELATION_CONFIRMED", authority: "SOCIAL", durableRef, publicSourceRefs: ["social:j7:mutual-choice"], version: 1 },
      promotedByOperationId: "operation:j7:promotion", sourceRefs: ["social:j7:mutual-choice"], version: 1
    }],
    version: 2
  };
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
