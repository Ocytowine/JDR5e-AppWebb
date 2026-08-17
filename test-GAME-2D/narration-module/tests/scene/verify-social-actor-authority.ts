import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type RepositoryClock,
  type Result
} from "../../src/core";
import {
  SOCIAL_ACTOR_MUTATION_COMMAND_V1,
  SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1,
  NarrativeTurnControllerV1,
  loadSocialActorRegistryV1,
  mutateSocialActorStateV1,
  projectSocialKnowledgeStateV1,
  resolveLocalSocialInitiativeBoundaryV1,
  selectLocalSocialInitiativeV1,
  type MutateSocialActorCommandV1,
  type SocialActorConcernV1,
  type SocialActorMutationSetV1
} from "../../src/application";
import { validateSocialKnowledgeStateV1 } from "../../src/scene";
import { assert } from "../contracts/assertions";

class FixedClock implements RepositoryClock {
  now(): Date {
    return new Date("2026-07-28T18:00:00.000Z");
  }
}

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`Expected success, got ${result.error.code}: ${result.error.messageKey}`);
  return result.value;
}

function emptyChanges(): SocialActorMutationSetV1 {
  return {
    knownFactRefsAdded: [],
    beliefsUpserted: [],
    relationshipDeltas: [],
    reputationMarkersUpserted: [],
    debtsAndPromisesUpserted: [],
    concernsUpserted: [],
    visibilityConstraintsAdded: []
  };
}

function concern(input: {
  concernId: string;
  targetRef: string;
  urgency: number;
  availableFromGameSecond?: number;
  privateObjective?: string;
  publicActionHint?: string;
}): SocialActorConcernV1 {
  return {
    concernId: input.concernId,
    status: "ACTIVE",
    privateObjective: input.privateObjective ?? "Vérifier discrètement la cohérence des registres scellés.",
    publicActionHint: input.publicActionHint ?? "fait signe à son collègue de vérifier un registre",
    actKind: "SIGNAL",
    urgency: input.urgency,
    availableFromGameSecond: input.availableFromGameSecond ?? 0,
    expiresAtGameSecond: null,
    targetRefs: [input.targetRef],
    sourceRefs: [`private:social-concern:${input.concernId}`],
    minimumIntervalSeconds: 60,
    lastExecutedAtGameSecond: null,
    executionCount: 0
  };
}

async function setup() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = id<CampaignId>("cmp-social-6c");
  const instant = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: id<AggregateId>("agg-social-6c-clock"),
    dependencies: {
      contentPackageId: "content.social.6c",
      contentPackageVersion: 1,
      rulesetId: "rules.social.6c",
      rulesetVersion: 1,
      calendarId: "calendar.social.6c",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: instant,
    updatedAt: instant
  };
  expectOk(await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.social.6c",
    calendarVersion: 1
  }));
  return { repository, campaignId };
}

function mutation(
  clientRequestId: string,
  actorId: string,
  changes: SocialActorMutationSetV1
): MutateSocialActorCommandV1 {
  return {
    schemaVersion: 1,
    contractVersion: SOCIAL_ACTOR_MUTATION_COMMAND_V1,
    clientRequestId,
    actorId,
    reason: "Fixture sociale 6C validée.",
    sourceEventRefs: [`event:fixture:${clientRequestId}`],
    occurredAtGameSecond: 0,
    changes
  };
}

async function main(): Promise<void> {
  const { repository, campaignId } = await setup();

  const archivistChanges = emptyChanges();
  archivistChanges.knownFactRefsAdded = ["fact:archives:register-transfer"];
  archivistChanges.beliefsUpserted = [{
    beliefId: "belief-sealed-register",
    claim: "Le registre scellé a été déplacé par un collègue.",
    confidence: "MEDIUM",
    sourceRefs: ["private:testimony:assistant"],
    mayBeFalse: true
  }];
  archivistChanges.relationshipDeltas = [{
    targetActorId: "npc-assistant-archives",
    trust: 15,
    affinity: 4,
    fear: 0,
    debt: 2,
    sourceRefs: ["event:shared-shift"]
  }];
  archivistChanges.concernsUpserted = [concern({
    concernId: "concern-check-sealed-register",
    targetRef: "actor:npc-assistant-archives",
    urgency: 80
  })];
  archivistChanges.visibilityConstraintsAdded = ["private-to:npc-archivist"];

  const firstMutation = expectOk(await mutateSocialActorStateV1({
    repository,
    campaignId,
    command: mutation("req-social-archivist", "npc-archivist", archivistChanges)
  }));
  assert.equal(firstMutation.replayed, false);
  const replayedMutation = expectOk(await mutateSocialActorStateV1({
    repository,
    campaignId,
    command: mutation("req-social-archivist", "npc-archivist", archivistChanges)
  }));
  assert.equal(replayedMutation.replayed, true);
  assert.equal(replayedMutation.commitId, firstMutation.commitId);
  const mutationConflict = await mutateSocialActorStateV1({
    repository,
    campaignId,
    command: mutation("req-social-archivist", "npc-other-actor", archivistChanges)
  });
  assert.equal(mutationConflict.ok, false);
  if (!mutationConflict.ok) assert.equal(mutationConflict.error.code, "IDEMPOTENCY_CONFLICT");

  const assistantChanges = emptyChanges();
  assistantChanges.knownFactRefsAdded = ["fact:archives:reading-room-open"];
  expectOk(await mutateSocialActorStateV1({
    repository,
    campaignId,
    command: mutation("req-social-assistant", "npc-assistant-archives", assistantChanges)
  }));

  const loaded = expectOk(await loadSocialActorRegistryV1(repository, campaignId));
  assert.equal(loaded.state.actors.length, 2);
  const archivist = loaded.state.actors.find(actor => actor.actorId === "npc-archivist");
  const assistant = loaded.state.actors.find(actor => actor.actorId === "npc-assistant-archives");
  assert.equal(archivist === undefined, false);
  assert.equal(assistant === undefined, false);
  assert.equal(archivist?.relationships[0]?.trust, 15);
  assert.equal(
    assistant?.relationships.some(relationship => relationship.targetActorId === "npc-archivist"),
    false,
    "A -> B must not create B -> A."
  );
  assert.equal(validateSocialKnowledgeStateV1(projectSocialKnowledgeStateV1(archivist!)).ok, true);

  const mutationEvents = expectOk(await repository.listEvents(campaignId, null, 20))
    .filter(event => event.eventType === "social.actor-state.updated");
  assert.equal(mutationEvents.length, 2);
  assert.equal(mutationEvents[0]?.visibility.scope, "ACTOR_SCOPED");
  const serializedMutationEvent = JSON.stringify(mutationEvents[0]?.payload);
  assert.equal(serializedMutationEvent.includes("registre scellé"), false);
  assert.equal(serializedMutationEvent.includes("privateObjective"), false);
  assert.equal(serializedMutationEvent.includes("private:testimony"), false);

  const selected = selectLocalSocialInitiativeV1({
    registry: loaded.state,
    presentActorIds: ["npc-archivist", "npc-assistant-archives", "pc-aryn"],
    occurredAtGameSecond: 0
  });
  assert.equal(selected?.actorId, "npc-archivist");
  assert.equal(selected?.targetRef, "actor:npc-assistant-archives");

  const initiativeCommand = {
    schemaVersion: 1 as const,
    contractVersion: SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1,
    clientRequestId: "req-social-boundary-entry",
    sceneId: "archives-main-hall",
    boundaryKind: "SCENE_ENTRY" as const,
    presentActorIds: ["npc-archivist", "npc-assistant-archives", "pc-aryn"],
    playerActorId: "pc-aryn",
    occurredAtGameSecond: 0
  };
  const initiative = expectOk(await resolveLocalSocialInitiativeBoundaryV1({
    repository,
    campaignId,
    command: initiativeCommand
  }));
  assert.equal(initiative.status, "INITIATIVE_COMMITTED");
  assert.equal(initiative.initiative?.actorId, "npc-archivist");
  assert.equal(initiative.initiative?.targetRef, "actor:npc-assistant-archives");
  assert.equal(initiative.initiative?.targetsPlayer, false);
  const replayedInitiative = expectOk(await resolveLocalSocialInitiativeBoundaryV1({
    repository,
    campaignId,
    command: initiativeCommand
  }));
  assert.equal(replayedInitiative.replayed, true);
  assert.equal(replayedInitiative.commitId, initiative.commitId);
  const replayedAfterActorPromotion = expectOk(await resolveLocalSocialInitiativeBoundaryV1({
    repository,
    campaignId,
    command: {
      ...initiativeCommand,
      presentActorIds: [...initiativeCommand.presentActorIds, "npc-promoted-after-entry"]
    }
  }));
  assert.equal(replayedAfterActorPromotion.replayed, true);
  assert.equal(replayedAfterActorPromotion.commitId, initiative.commitId);
  const initiativeConflict = await resolveLocalSocialInitiativeBoundaryV1({
    repository,
    campaignId,
    command: { ...initiativeCommand, boundaryKind: "LOCAL_EVENT_COMPLETED" }
  });
  assert.equal(initiativeConflict.ok, false);
  if (!initiativeConflict.ok) assert.equal(initiativeConflict.error.code, "IDEMPOTENCY_CONFLICT");

  const afterInitiative = expectOk(await loadSocialActorRegistryV1(repository, campaignId));
  assert.equal(
    afterInitiative.state.actors
      .find(actor => actor.actorId === "npc-archivist")
      ?.concerns[0]?.executionCount,
    1,
    "Replay must not execute the concern twice."
  );
  const initiativeEvents = expectOk(await repository.listEvents(campaignId, null, 30))
    .filter(event => event.eventType === "social.local-initiative.executed");
  assert.equal(initiativeEvents.length, 1);
  assert.equal(initiativeEvents[0]?.visibility.scope, "PLAYER_VISIBLE");
  const serializedInitiative = JSON.stringify(initiativeEvents[0]?.payload);
  assert.equal(serializedInitiative.includes("privateObjective"), false);
  assert.equal(serializedInitiative.includes("private:social-concern"), false);

  const absentTargetChanges = emptyChanges();
  absentTargetChanges.concernsUpserted = [concern({
    concernId: "concern-find-messenger",
    targetRef: "actor:npc-absent-messenger",
    urgency: 100
  })];
  expectOk(await mutateSocialActorStateV1({
    repository,
    campaignId,
    command: mutation("req-social-clerk", "npc-clerk", absentTargetChanges)
  }));
  const revisionBeforeCalm = expectOk(await repository.getCampaign(campaignId)).campaignRevision;
  const calmCommand = {
    schemaVersion: 1 as const,
    contractVersion: SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1,
    clientRequestId: "req-social-boundary-calm",
    sceneId: "archives-side-room",
    boundaryKind: "LOCAL_EVENT_COMPLETED" as const,
    presentActorIds: ["npc-clerk", "pc-aryn"],
    playerActorId: "pc-aryn",
    occurredAtGameSecond: 0
  };
  const calm = expectOk(await resolveLocalSocialInitiativeBoundaryV1({
    repository,
    campaignId,
    command: calmCommand
  }));
  assert.equal(calm.status, "CALM");
  assert.equal(calm.commitId, null);
  assert.equal(expectOk(await repository.getCampaign(campaignId)).campaignRevision, revisionBeforeCalm);
  const calmReplay = expectOk(await resolveLocalSocialInitiativeBoundaryV1({
    repository,
    campaignId,
    command: {
      ...calmCommand,
      presentActorIds: [...calmCommand.presentActorIds, "npc-promoted-after-calm-entry"]
    }
  }));
  assert.equal(calmReplay.replayed, true);
  assert.equal(calmReplay.status, "CALM");

  const rankingChanges = emptyChanges();
  rankingChanges.concernsUpserted = [
    concern({
      concernId: "concern-low",
      targetRef: "location:archives-main-hall",
      urgency: 20,
      publicActionHint: "range une pile de copies"
    }),
    concern({
      concernId: "concern-high",
      targetRef: "location:archives-main-hall",
      urgency: 90,
      publicActionHint: "ferme le guichet devant une urgence locale"
    })
  ];
  expectOk(await mutateSocialActorStateV1({
    repository,
    campaignId,
    command: mutation("req-social-ranking", "npc-ranking", rankingChanges)
  }));
  const rankedRegistry = expectOk(await loadSocialActorRegistryV1(repository, campaignId));
  assert.equal(selectLocalSocialInitiativeV1({
    registry: rankedRegistry.state,
    presentActorIds: ["npc-ranking"],
    occurredAtGameSecond: 0
  })?.concernId, "concern-high");

  const invalidChanges = emptyChanges();
  invalidChanges.relationshipDeltas = [{
    targetActorId: "npc-assistant-archives",
    trust: 100,
    affinity: 0,
    fear: 0,
    debt: 0,
    sourceRefs: ["event:invalid-overflow"]
  }];
  const invalid = await mutateSocialActorStateV1({
    repository,
    campaignId,
    command: mutation("req-social-overflow", "npc-archivist", invalidChanges)
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.messageKey, "social.relationship-out-of-range");

  const controllerFixture = await setup();
  const controllerChanges = emptyChanges();
  controllerChanges.concernsUpserted = [concern({
    concernId: "concern-warn-waitress",
    targetRef: "actor:npc-serveuse-nerveuse",
    urgency: 70,
    publicActionHint: "adresse un signe d'avertissement à la serveuse"
  })];
  expectOk(await mutateSocialActorStateV1({
    repository: controllerFixture.repository,
    campaignId: controllerFixture.campaignId,
    command: mutation("req-social-controller-seed", "npc-garde-blesse", controllerChanges)
  }));
  const controller = new NarrativeTurnControllerV1({
    repository: controllerFixture.repository,
    campaignId: controllerFixture.campaignId,
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null
  });
  const autonomousBoundary = expectOk(await controller.processLocalSocialBoundary({
    schemaVersion: 1,
    clientRequestId: "req-social-controller-boundary",
    boundaryKind: "SCENE_ENTRY",
    playerActorId: "pc-aryn"
  }));
  assert.equal(autonomousBoundary.initiativeResult.status, "INITIATIVE_COMMITTED");
  assert.equal(autonomousBoundary.initiativeResult.initiative?.actorId, "npc-garde-blesse");
  assert.equal(autonomousBoundary.initiativeResult.initiative?.targetRef, "actor:npc-serveuse-nerveuse");
  assert.equal(autonomousBoundary.initiativeResult.initiative?.targetsPlayer, false);
  assert.equal(autonomousBoundary.performance?.actorId, "npc-garde-blesse");
  assert.equal(autonomousBoundary.displayPacket?.displayBlocks[0]?.kind, "GM_NARRATION");
  assert.ok(
    /garde blessé.*avertissement.*serveuse/iu.test(
      autonomousBoundary.displayPacket?.displayBlocks[0]?.text ?? ""
    ),
    "l'initiative projetée attribue l'action publique au bon acteur et à sa cible"
  );
  assert.equal(autonomousBoundary.projection?.projection.authority, "PRESENTATION_ONLY");
  const restoredThread = expectOk(await controller.restoreRenderedThread());
  assert.equal(restoredThread.displayPackets.length, 1);
  assert.deepEqual(restoredThread.displayPackets[0], autonomousBoundary.displayPacket);

  const playerTargetFixture = await setup();
  const playerTargetChanges = emptyChanges();
  playerTargetChanges.concernsUpserted = [concern({
    concernId: "concern-warn-player",
    targetRef: "actor:pc-aryn",
    urgency: 75,
    privateObjective: "Empêcher le voyageur de marcher sur les débris instables.",
    publicActionHint: "interpelle le voyageur pour lui signaler les débris"
  })];
  expectOk(await mutateSocialActorStateV1({
    repository: playerTargetFixture.repository,
    campaignId: playerTargetFixture.campaignId,
    command: mutation("req-social-player-target-seed", "npc-garde-blesse", playerTargetChanges)
  }));
  const playerTargetController = new NarrativeTurnControllerV1({
    repository: playerTargetFixture.repository,
    campaignId: playerTargetFixture.campaignId,
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null
  });
  const playerTargetBoundary = expectOk(await playerTargetController.processLocalSocialBoundary({
    schemaVersion: 1,
    clientRequestId: "req-social-player-target-entry",
    boundaryKind: "SCENE_ENTRY",
    playerActorId: "pc-aryn"
  }));
  assert.equal(playerTargetBoundary.initiativeResult.status, "INITIATIVE_COMMITTED");
  assert.equal(playerTargetBoundary.initiativeResult.initiative?.targetRef, "actor:pc-aryn");
  assert.equal(playerTargetBoundary.initiativeResult.initiative?.targetsPlayer, true);
  assert.ok(
    /interpelle le voyageur.*débris/iu.test(
      playerTargetBoundary.displayPacket?.displayBlocks[0]?.text ?? ""
    )
  );
  assert.equal(
    JSON.stringify(playerTargetBoundary.displayPacket).includes("débris instables"),
    false,
    "la justification privée de l'interpellation ne doit pas atteindre le rendu"
  );

  console.log("social-actor-registry/1 + social-local-initiative/1: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
