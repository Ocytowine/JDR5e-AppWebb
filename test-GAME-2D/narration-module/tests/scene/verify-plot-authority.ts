import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
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
import {
  PLOT_CREATE_COMMAND_V1,
  PLOT_EVOLUTION_CONTRACT_V1,
  PLOT_SCENE_REVEAL_CONTRACT_V1,
  composeSceneEventBundleV1,
  createPlotV1,
  evolveDuePlotsV1,
  loadPlotRegistryV1,
  revealPlotEffectsInSceneV1,
  type CreatePlotCommandV1,
  type PlotStateV1
} from "../../src/application";

class FixedClock implements RepositoryClock {
  now(): Date {
    return new Date("2026-07-28T20:00:00.000Z");
  }
}

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function ok<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.messageKey} ${JSON.stringify(result.error.details)}`);
  return result.value;
}

async function setup() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = id<CampaignId>("cmp-plot-6d");
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: id<AggregateId>("agg-plot-6d-clock"),
    dependencies: {
      contentPackageId: "content.plot.6d",
      contentPackageVersion: 1,
      rulesetId: "rules.plot.6d",
      rulesetVersion: 1,
      calendarId: "calendar.plot.6d",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: clock.now().toISOString(),
    updatedAt: clock.now().toISOString()
  };
  ok(await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.plot.6d",
    calendarVersion: 1
  }));
  return { repository, campaignId };
}

function plot(): PlotStateV1 {
  return {
    schemaVersion: 1,
    plotId: "plot-registre-deplace",
    status: "ACTIVE",
    hiddenTruth: {
      truthId: "truth-registre-cellier",
      statement: "L'intendant a déplacé le registre scellé dans le cellier nord.",
      sourceRefs: ["private:fixture:truth-registre"]
    },
    commitments: [
      "Le registre quitte l'étagère après la fermeture.",
      "Le déplacement précède le retour du personnage."
    ],
    requiredRevelations: [{
      revelationId: "revelation-registre-deplace",
      label: "Comprendre que le registre a été déplacé.",
      requiredForResolution: true
    }],
    cluePaths: [{
      cluePathId: "clue-poussiere",
      revelationId: "revelation-registre-deplace",
      independenceKey: "location:archives:shelf",
      status: "AVAILABLE",
      sourceRefs: ["private:fixture:shelf-trace"]
    }, {
      cluePathId: "clue-temoin",
      revelationId: "revelation-registre-deplace",
      independenceKey: "actor:night-copyist",
      status: "AVAILABLE",
      sourceRefs: ["private:fixture:witness"]
    }],
    falseLeads: [{
      falseLeadId: "false-lead-inventory-error",
      claim: "Le registre n'a peut-être jamais été rangé ici.",
      refutationCluePathIds: ["clue-poussiere"]
    }],
    scheduledEvents: [{
      plotEventId: "event-move-register",
      status: "SCHEDULED",
      dueAtGameSecond: 3_600,
      resolvedAtGameSecond: null,
      causedByRefs: ["event:archive-closing-bell"],
      locationRef: "location:archives_de_lysenthe",
      privateOutcome: "L'intendant emporte le registre vers le cellier nord.",
      effects: [{
        effectId: "effect-broken-dust",
        visibility: "INFERABLE",
        sceneId: "wiki-location:archives_de_lysenthe",
        publicSign: "Sur une étagère, la poussière dessine une interruption rectangulaire récente.",
        knowledgeChannelRef: null,
        sourceRefs: ["private:fixture:shelf-trace"],
        presentedAtGameSecond: null
      }, {
        effectId: "effect-hidden-destination",
        visibility: "HIDDEN",
        sceneId: "wiki-location:archives_de_lysenthe",
        publicSign: null,
        knowledgeChannelRef: null,
        sourceRefs: ["private:fixture:hidden-destination"],
        presentedAtGameSecond: null
      }, {
        effectId: "effect-copyist-message",
        visibility: "KNOWN_THROUGH_CHANNEL",
        sceneId: null,
        publicSign: "Le copiste de nuit affirme avoir vu sortir un registre après la fermeture.",
        knowledgeChannelRef: "knowledge:night-copyist-testimony",
        sourceRefs: ["private:fixture:witness"],
        presentedAtGameSecond: null
      }]
    }, {
      plotEventId: "event-distant-carriage",
      status: "SCHEDULED",
      dueAtGameSecond: 3_600,
      resolvedAtGameSecond: null,
      causedByRefs: ["event:carriage-order"],
      locationRef: "location:north-road",
      privateOutcome: "Une voiture attend loin des archives.",
      effects: [{
        effectId: "effect-distant-wheel-tracks",
        visibility: "IMMEDIATELY_VISIBLE",
        sceneId: "wiki-location:north-road",
        publicSign: "Des traces de roues fraîches coupent la boue de la route nord.",
        knowledgeChannelRef: null,
        sourceRefs: ["event:carriage-order"],
        presentedAtGameSecond: null
      }]
    }],
    sourceRefs: ["fixture:plot-6d"],
    createdAtGameSecond: 0,
    version: 1
  };
}

function createCommand(value = plot()): CreatePlotCommandV1 {
  return {
    schemaVersion: 1,
    contractVersion: PLOT_CREATE_COMMAND_V1,
    clientRequestId: "create-plot-registre-6d",
    plot: value
  };
}

async function advanceClock(
  repository: MemoryCampaignRepository,
  campaignId: CampaignId,
  elapsedGameSeconds: number
): Promise<void> {
  const campaign = ok(await repository.getCampaign(campaignId));
  const clock = ok(await repository.getAggregate(campaignId, "world.clock", campaign.clockAggregateId));
  const operationId = id<OperationId>(`test-clock-advance:${elapsedGameSeconds}`);
  const payload = { elapsedGameSeconds };
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: id<RequestId>(`test-clock-advance:${elapsedGameSeconds}`),
    idempotencyKey: id<IdempotencyKey>(operationId),
    requestFingerprint: await computeRequestFingerprint("test.clock.advance", 1, payload),
    operationKind: "test.clock.advance",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: new FixedClock().now().toISOString(),
    updatedAt: new FixedClock().now().toISOString()
  };
  ok(await repository.receiveOperation(operation));
  ok(await repository.transitionOperation(operationId, "RECEIVED", "PREPARING"));
  ok(await repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT"));
  const lease = ok(await repository.acquireWriterLease(campaignId, id<WriterId>(`${operationId}:writer`), 120_000));
  ok(await repository.commit({
    campaignId,
    operationId,
    commitId: id<CommitId>(`${operationId}:commit`),
    idempotencyKey: operation.idempotencyKey,
    requestFingerprint: operation.requestFingerprint,
    expectedCampaignRevision: campaign.campaignRevision,
    writerLease: lease,
    acceptedCommands: [{
      schemaVersion: 1,
      contractId: "test-clock-authority",
      contractVersion: 1,
      commandId: id<CommandId>(`${operationId}:command`),
      campaignId,
      operationId,
      commandType: "test.clock.advance",
      target: {
        aggregateType: "world.clock",
        aggregateId: campaign.clockAggregateId,
        expectedAggregateRevision: clock.aggregateRevision
      },
      payloadSchemaVersion: 1,
      payload,
      acceptedAtGameSecond: elapsedGameSeconds
    }],
    aggregateWrites: [{
      aggregateType: "world.clock",
      aggregateId: campaign.clockAggregateId,
      expectedAggregateRevision: clock.aggregateRevision,
      payloadSchemaVersion: 1,
      payload: { ...clock.payload, elapsedGameSeconds }
    }],
    events: [{
      schemaVersion: 1,
      eventId: id<EventId>(`${operationId}:event`),
      campaignId,
      operationId,
      eventType: "test.clock.advanced",
      origin: "SYSTEM",
      causation: { kind: "COMMAND", id: `${operationId}:command` },
      aggregateRefs: [{
        aggregateType: "world.clock",
        aggregateId: campaign.clockAggregateId,
        aggregateRevision: clock.aggregateRevision + 1
      }],
      visibility: { scope: "SYSTEM", actorIds: [] },
      occurredAtGameSecond: elapsedGameSeconds,
      payloadSchemaVersion: 1,
      payload
    }],
    outboxTasks: []
  }));
  ok(await repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, payload));
  ok(await repository.releaseWriterLease(lease));
}

async function main(): Promise<void> {
  const { repository, campaignId } = await setup();

  const insoluble = plot();
  insoluble.cluePaths = insoluble.cluePaths.slice(0, 1);
  const rejected = await createPlotV1({
    repository,
    campaignId,
    command: { ...createCommand(insoluble), clientRequestId: "reject-insoluble-plot" }
  });
  assert.equal(rejected.ok, false, "une révélation indispensable exige deux voies indépendantes");

  const leaking = plot();
  leaking.scheduledEvents[0]!.effects[0]!.publicSign = leaking.hiddenTruth.statement;
  const leakRejected = await createPlotV1({
    repository,
    campaignId,
    command: { ...createCommand(leaking), clientRequestId: "reject-secret-leak" }
  });
  assert.equal(leakRejected.ok, false, "la vérité privée ne peut pas devenir un signe public");

  const created = ok(await createPlotV1({ repository, campaignId, command: createCommand() }));
  assert.equal(created.replayed, false);
  const replayedCreate = ok(await createPlotV1({ repository, campaignId, command: createCommand() }));
  assert.equal(replayedCreate.replayed, true);
  assert.equal(replayedCreate.commitId, created.commitId);

  const nothingDue = ok(await evolveDuePlotsV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_EVOLUTION_CONTRACT_V1,
      clientRequestId: "plot-boundary-clock-0"
    }
  }));
  assert.equal(nothingDue.status, "NOTHING_DUE", "le temps réel ne rend aucune étape exigible");
  assert.equal(nothingDue.commitId, null);

  await advanceClock(repository, campaignId, 7_200);
  const evolved = ok(await evolveDuePlotsV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_EVOLUTION_CONTRACT_V1,
      clientRequestId: "plot-boundary-clock-7200"
    }
  }));
  assert.equal(evolved.status, "EVOLVED");
  assert.equal(evolved.resolvedEventRefs.length, 2, "les étapes locales et distantes évoluent hors écran");
  const replayedEvolution = ok(await evolveDuePlotsV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_EVOLUTION_CONTRACT_V1,
      clientRequestId: "plot-boundary-clock-7200"
    }
  }));
  assert.equal(replayedEvolution.replayed, true);
  assert.equal(replayedEvolution.commitId, evolved.commitId);

  const loaded = ok(await loadPlotRegistryV1(repository, campaignId));
  const persisted = loaded.state.plots[0]!;
  assert.equal(persisted.hiddenTruth.statement, plot().hiddenTruth.statement, "la vérité privée reste stable");
  assert.equal(persisted.scheduledEvents.every(event => event.status === "RESOLVED"), true);

  const archiveBundle = composeSceneEventBundleV1({
    registry: loaded.state,
    sceneId: "wiki-location:archives_de_lysenthe",
    throughGameSecond: 7_200,
    playerKnowledgeRefs: []
  });
  assert.deepEqual(
    archiveBundle.perceptions.map(value => value.text),
    ["Sur une étagère, la poussière dessine une interruption rectangulaire récente."]
  );
  assert.equal(archiveBundle.perceptions[0]?.presentation, "INFERENCE");
  const publicBundleText = JSON.stringify(archiveBundle);
  assert.equal(publicBundleText.includes("intendant"), false);
  assert.equal(publicBundleText.includes("cellier nord"), false);
  assert.equal(publicBundleText.includes("voiture attend"), false, "l'événement distant n'est pas narré localement");

  const informedBundle = composeSceneEventBundleV1({
    registry: loaded.state,
    sceneId: "wiki-location:archives_de_lysenthe",
    throughGameSecond: 7_200,
    playerKnowledgeRefs: ["knowledge:night-copyist-testimony"]
  });
  assert.equal(informedBundle.perceptions.length, 2, "un canal acquis ouvre seulement son information autorisée");

  const revealed = ok(await revealPlotEffectsInSceneV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_SCENE_REVEAL_CONTRACT_V1,
      clientRequestId: "reveal-archives-without-testimony",
      sceneId: "wiki-location:archives_de_lysenthe",
      playerKnowledgeRefs: []
    }
  }));
  assert.equal(revealed.status, "REVEALED");
  assert.deepEqual(revealed.bundle.perceptions.map(value => value.text), [
    "Sur une étagère, la poussière dessine une interruption rectangulaire récente."
  ]);
  const replayedReveal = ok(await revealPlotEffectsInSceneV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_SCENE_REVEAL_CONTRACT_V1,
      clientRequestId: "reveal-archives-without-testimony",
      sceneId: "wiki-location:archives_de_lysenthe",
      playerKnowledgeRefs: []
    }
  }));
  assert.equal(replayedReveal.replayed, true);
  assert.equal(replayedReveal.commitId, revealed.commitId);
  const noDuplicateReveal = ok(await revealPlotEffectsInSceneV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_SCENE_REVEAL_CONTRACT_V1,
      clientRequestId: "reveal-archives-again",
      sceneId: "wiki-location:archives_de_lysenthe",
      playerKnowledgeRefs: []
    }
  }));
  assert.equal(noDuplicateReveal.status, "CLEAR", "un signe déjà présenté n'est pas raconté une seconde fois");

  const events = ok(await repository.listEvents(campaignId, null, 100));
  const plotEvents = events.filter(event => event.eventType.startsWith("plot."));
  assert.equal(
    plotEvents.filter(event => event.eventType !== "plot.scene-effects.revealed")
      .every(event => event.visibility.scope === "MJ_PRIVATE"),
    true
  );
  assert.equal(
    plotEvents.find(event => event.eventType === "plot.scene-effects.revealed")?.visibility.scope,
    "PLAYER_VISIBLE"
  );
  assert.equal(JSON.stringify(plotEvents).includes("cellier nord"), false, "les événements ne recopient pas le résultat privé");
  assert.equal(plotEvents.filter(event => event.eventType === "plot.scheduled-event.resolved").length, 2);

  console.log("plot-registry/1 + plot-evolution/1 + scene-event-bundle/1: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
