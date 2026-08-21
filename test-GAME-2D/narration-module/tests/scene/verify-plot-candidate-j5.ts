import assert from "node:assert/strict";
import { FakeContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import {
  computeRequestFingerprint,
  MemoryCampaignRepository,
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
  type RequestId,
  type WriterId
} from "../../src/core";
import {
  buildPlotFromCandidateV1,
  buildPlotGenerationContextFromSceneV1,
  buildNpcPlotActorViewV1,
  createCatalogPlotCreationRuntimeV1,
  evolveDuePlotsV1,
  interpretNarrativeInputV1,
  loadPlotRegistryV1,
  PLOT_EVOLUTION_CONTRACT_V1,
  PLOT_SCENE_REVEAL_CONTRACT_V1,
  revealPlotEffectsInSceneV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
} from "../../src/application";
import {
  createPlotCandidateJ5Fixture as candidate,
  PLOT_ADVENTURE_J5_EXCHANGES,
  PLOT_CANDIDATE_J5_CONTEXT as context,
  PLOT_CANDIDATE_J5_FIXTURE_VERSION
} from "../fixtures/plot-candidate-j5.fixture";

async function main(): Promise<void> {
  assert.equal(PLOT_CANDIDATE_J5_FIXTURE_VERSION, 1);
  const sceneContext = buildPlotGenerationContextFromSceneV1({
    scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
    createdAtGameSecond: 12,
    worldSignals: [{ signalRef: "signal:rain", summary: "La pluie se renforce.", sourceRefs: ["world:rain"] }]
  });
  assert.equal(sceneContext.allowedActorRefs.includes("npc-garde-blesse"), true);
  assert.equal(sceneContext.allowedSourceRefs.includes("world:rain"), true);
  assert.equal(sceneContext.publicLoreFacts.some(fact => fact.text.includes("pluie")), true);

  const repository = new MemoryCampaignRepository();
  const campaignId = opaqueId<CampaignId>("campaign:plot-candidate-j5");
  const now = "2026-08-20T14:00:00.000Z";
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("clock:plot-candidate-j5"),
    dependencies: {
      contentPackageId: "content.jdr5e",
      contentPackageVersion: 1,
      rulesetId: "rules.jdr5e",
      rulesetVersion: 2,
      calendarId: "calendar.test",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  assert.equal((await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.test",
    calendarVersion: 1
  })).ok, true);

  const attemptId = "operation:j5:plot-search:ai:plot-candidate:attempt:1";
  const provider = new FakeContractAiProviderV1([[attemptId, {
    schemaVersion: 1,
    contractVersion: "plot-candidate/1",
    outputId: "output:j5",
    callId: "operation:j5:plot-search:ai:plot-candidate:call",
    attemptId,
    packId: "operation:j5:plot-search:pack:plot-candidate",
    snapshotId: "operation:j5:plot-search:snapshot:plot-candidate",
    role: "scene_creator",
    status: "OK",
    payload: candidate(),
    diagnostics: [],
    supersedesOutputId: null
  }], ["operation:j5:plot-search:ai:plot-motivation-critic:attempt:1", {
    schemaVersion: 1,
    contractVersion: "narrative-ai-resolution/1",
    outputId: "output:j5:motivation-critic",
    callId: "operation:j5:plot-search:ai:plot-motivation-critic:call",
    attemptId: "operation:j5:plot-search:ai:plot-motivation-critic:attempt:1",
    packId: "operation:j5:plot-search:pack:plot-motivation-critic",
    snapshotId: "operation:j5:plot-search:snapshot:plot-motivation-critic",
    role: "coherence_critic",
    status: "OK",
    payload: { verdict: "PASS", findings: [], correctionConstraints: [] },
    diagnostics: [],
    supersedesOutputId: null
  }], ["operation:j5:conclusion:ai:plot-resolution-critic:attempt:1", {
    schemaVersion: 1,
    contractVersion: "narrative-ai-resolution/1",
    outputId: "output:j5:resolution-critic",
    callId: "operation:j5:conclusion:ai:plot-resolution-critic:call",
    attemptId: "operation:j5:conclusion:ai:plot-resolution-critic:attempt:1",
    packId: "operation:j5:conclusion:pack:plot-resolution-critic",
    snapshotId: "operation:j5:conclusion:snapshot:plot-resolution-critic",
    role: "coherence_critic",
    status: "OK",
    payload: { verdict: "PASS", findings: [], correctionConstraints: [] },
    diagnostics: [],
    supersedesOutputId: null
  }]]);
  const config = {
    provider,
    route: {
      schemaVersion: 1 as const,
      routeId: "route:plot-candidate",
      role: "scene_creator" as const,
      providerKind: "FAKE_CONTRACT" as const,
      providerId: "fake",
      modelId: "fake-plot-candidate",
      modelConfigVersion: "1",
      certified: true,
      allowedContractVersions: ["plot-candidate/1"],
      inputTokenLimit: 5_000,
      outputTokenLimit: 5_000,
      timeoutMs: 5_000,
      fallbackRouteIds: []
    },
    coherenceCriticRoute: {
      schemaVersion: 1 as const,
      routeId: "route:plot-motivation-critic",
      role: "coherence_critic" as const,
      providerKind: "FAKE_CONTRACT" as const,
      providerId: "fake",
      modelId: "fake-plot-motivation-critic",
      modelConfigVersion: "1",
      certified: true,
      allowedContractVersions: ["narrative-ai-resolution/1"],
      inputTokenLimit: 1_600,
      outputTokenLimit: 1_600,
      timeoutMs: 5_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1 as const,
      role: "scene_creator" as const,
      maxTechnicalRetries: 0,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: false
    }
  };
  const baseSearch = interpretNarrativeInputV1({
    intentId: "intent:j5:search",
    rawInput: "Je fouille attentivement les archives pour trouver quelque chose d'inhabituel."
  });
  const searchInterpretation = {
    ...baseSearch,
    intentType: "action" as const,
    requiresClarification: false,
    semanticIntent: {
      ...baseSearch.semanticIntent,
      kind: "observe_environment" as const,
      commitment: "committed" as const,
      perception: {
        schemaVersion: 1 as const,
        depth: "SEARCH" as const,
        focus: "les archives",
        soughtInformation: "quelque chose d'inhabituel",
        informationKind: "UNCERTAIN_CLUE" as const
      }
    }
  };
  const runtime = createCatalogPlotCreationRuntimeV1({
    generatorConfig: config,
    resolveContext: () => context
  });
  const created = await runtime.maybeCreateFromSearch({
    repository,
    campaignId,
    operation: {
      operationId: "operation:j5",
      clientRequestId: "request:j5:create"
    } as unknown as OperationRecord,
    interpretation: searchInterpretation,
    activeScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.equal(created.ok, true);
  const registry = await loadPlotRegistryV1(repository, campaignId);
  assert.equal(registry.ok, true);
  if (!registry.ok) throw new Error("plot registry missing");
  assert.equal(registry.value.state.plots.length, 1);
  const plot = registry.value.state.plots[0]!;
  assert.equal((plot.actorPerspectives as unknown[]).length, 2);
  assert.equal((plot.actorMotivations as unknown[]).length, 2);
  assert.equal((plot.causalTimeline as unknown[]).length, 2);
  assert.equal(plot.cluePaths.length, 2);
  assert.equal(plot.scheduledEvents.length, 3);

  const evolved = await evolveDuePlotsV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_EVOLUTION_CONTRACT_V1,
      clientRequestId: "request:j5:evolve:0"
    }
  });
  assert.equal(evolved.ok, true);
  const firstReveal = await revealPlotEffectsInSceneV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_SCENE_REVEAL_CONTRACT_V1,
      clientRequestId: "request:j5:reveal:observation",
      sceneId: context.sceneId,
      playerKnowledgeRefs: []
    }
  });
  assert.equal(firstReveal.ok, true);
  if (firstReveal.ok) assert.deepEqual(firstReveal.value.bundle.perceptions.map(value => value.presentation), ["INFERENCE"]);
  const afterObservation = await loadPlotRegistryV1(repository, campaignId);
  assert.equal(afterObservation.ok, true);
  if (afterObservation.ok) assert.equal((afterObservation.value.state.plots[0]!.discoveries as unknown[]).length, 1);
  const testimonyReveal = await revealPlotEffectsInSceneV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_SCENE_REVEAL_CONTRACT_V1,
      clientRequestId: "request:j5:reveal:testimony",
      sceneId: context.sceneId,
      playerKnowledgeRefs: ["knowledge:clerc-testimony"]
    }
  });
  assert.equal(testimonyReveal.ok, true);
  if (testimonyReveal.ok) assert.deepEqual(testimonyReveal.value.bundle.perceptions.map(value => value.presentation), ["KNOWLEDGE"]);
  const afterTestimony = await loadPlotRegistryV1(repository, campaignId);
  assert.equal(afterTestimony.ok, true);
  if (afterTestimony.ok) {
    const persisted = afterTestimony.value.state.plots[0]!;
    assert.equal((persisted.discoveries as unknown[]).length, 2);
    assert.equal(persisted.hiddenTruth.statement, candidate().hiddenTruth.statement);
  }

  const hypothesisRaw = "Je pense que le registre a simplement été mal rangé.";
  const baseHypothesis = interpretNarrativeInputV1({ intentId: "intent:j5:hypothesis", rawInput: hypothesisRaw });
  const hypothesis = await runtime.recordHypothesisFromTurn({
    repository,
    campaignId,
    operation: {
      operationId: "operation:j5:hypothesis",
      clientRequestId: "request:j5:hypothesis"
    } as unknown as OperationRecord,
    rawInput: hypothesisRaw,
    playerActorRef: "player:j5",
    interpretation: {
      ...baseHypothesis,
      requiresClarification: false,
      semanticIntent: {
        ...baseHypothesis.semanticIntent,
        kind: "address_visible_actor",
        commitment: "committed",
        dialogueAct: {
          schemaVersion: 1,
          act: "MAKE_STATEMENT",
          contentGoal: "Le registre a simplement été mal rangé.",
          addresseeRef: "actor:clerc"
        }
      }
    }
  });
  if (!hypothesis.ok) throw new Error(`player hypothesis failed: ${hypothesis.error.messageKey} ${JSON.stringify(hypothesis.error.details)}`);
  if (hypothesis.value === null) throw new Error("player hypothesis was not recorded");
  assert.equal(hypothesis.value.hypothesis.status, "UNCONFIRMED");
  const hypothesisReplay = await runtime.recordHypothesisFromTurn({
    repository,
    campaignId,
    operation: {
      operationId: "operation:j5:hypothesis",
      clientRequestId: "request:j5:hypothesis"
    } as unknown as OperationRecord,
    rawInput: hypothesisRaw,
    playerActorRef: "player:j5",
    interpretation: {
      ...baseHypothesis,
      requiresClarification: false,
      semanticIntent: {
        ...baseHypothesis.semanticIntent,
        kind: "address_visible_actor",
        commitment: "committed",
        dialogueAct: { schemaVersion: 1, act: "MAKE_STATEMENT", contentGoal: "Le registre a simplement été mal rangé.", addresseeRef: "actor:clerc" }
      }
    }
  });
  assert.equal(hypothesisReplay.ok, true);
  if (hypothesisReplay.ok && hypothesisReplay.value !== null) assert.equal(hypothesisReplay.value.replayed, true);

  await advanceClock(repository, campaignId, 120);
  const offscreen = await evolveDuePlotsV1({
    repository,
    campaignId,
    command: { schemaVersion: 1, contractVersion: PLOT_EVOLUTION_CONTRACT_V1, clientRequestId: "request:j5:evolve:120" }
  });
  assert.equal(offscreen.ok, true);
  if (offscreen.ok) assert.equal(offscreen.value.resolvedEventRefs.includes("plot-event:plot:missing-register:event:archive-search"), true);
  const afterEllipseReveal = await revealPlotEffectsInSceneV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_SCENE_REVEAL_CONTRACT_V1,
      clientRequestId: "request:j5:reveal:after-ellipse",
      sceneId: context.sceneId,
      playerKnowledgeRefs: ["knowledge:clerc-testimony"]
    }
  });
  assert.equal(afterEllipseReveal.ok, true);
  if (afterEllipseReveal.ok) assert.match(afterEllipseReveal.value.bundle.perceptions.map(value => value.text).join(" "), /échelles/iu);
  const finalRegistry = await loadPlotRegistryV1(repository, campaignId);
  assert.equal(finalRegistry.ok, true);
  if (finalRegistry.ok) {
    const persisted = finalRegistry.value.state.plots[0]!;
    assert.equal(persisted.hiddenTruth.statement, candidate().hiddenTruth.statement);
    assert.equal((persisted.playerHypotheses as Array<{ status: string }>)[0]?.status, "UNCONFIRMED");
    assert.equal((persisted.actorPerspectives as Array<{ epistemicStatus: string }>)[1]?.epistemicStatus, "BELIEVES_FALSE");
    assert.deepEqual(persisted.falseLeads[0]?.refutationCluePathIds, ["clue:dust-mark"]);
    const clerkView = buildNpcPlotActorViewV1(finalRegistry.value.state, "npc:clerc");
    assert.deepEqual(clerkView.perspectives, [{
      plotRef: "plot:plot:missing-register",
      perspectiveRef: "plot-perspective:perspective:clerc",
      claim: "Le registre a probablement été mal rangé.",
      epistemicBasis: "believed"
    }]);
    const serializedClerkView = JSON.stringify(clerkView);
    assert.equal(serializedClerkView.includes(persisted.hiddenTruth.statement), false);
    assert.equal(serializedClerkView.includes("perspective:archiviste"), false);
    assert.equal(serializedClerkView.includes("BELIEVES_FALSE"), false);
    assert.equal(serializedClerkView.includes("CONTRADICTS"), false);
  }

  assert.equal(PLOT_ADVENTURE_J5_EXCHANGES.length, 10);
  assert.equal(PLOT_ADVENTURE_J5_EXCHANGES.every(exchange => exchange.player.length > 0 && exchange.gm.length > 0), true);
  assert.equal(PLOT_ADVENTURE_J5_EXCHANGES.some(exchange => /\b(?:plot|commit|UNCONFIRMED|cluePathId)\b/u.test(exchange.gm)), false);
  const conclusionRaw = PLOT_ADVENTURE_J5_EXCHANGES[9].player;
  const baseConclusion = interpretNarrativeInputV1({ intentId: "intent:j5:conclusion", rawInput: conclusionRaw });
  const conclusionInterpretation = {
    ...baseConclusion,
    requiresClarification: false,
    semanticIntent: {
      ...baseConclusion.semanticIntent,
      kind: "address_visible_actor" as const,
      commitment: "committed" as const,
      dialogueAct: {
        schemaVersion: 1 as const,
        act: "MAKE_STATEMENT" as const,
        contentGoal: "L'archiviste a déplacé le registre pour le protéger d'une saisie.",
        addresseeRef: "actor:clerc"
      }
    }
  };
  const recordedConclusion = await runtime.recordHypothesisFromTurn({
    repository,
    campaignId,
    operation: { operationId: "operation:j5:conclusion", clientRequestId: "request:j5:conclusion" } as unknown as OperationRecord,
    rawInput: conclusionRaw,
    playerActorRef: "player:j5",
    interpretation: conclusionInterpretation
  });
  assert.equal(recordedConclusion.ok, true);
  const resolvedConclusion = await runtime.resolveConclusionFromTurn({
    repository,
    campaignId,
    operation: { operationId: "operation:j5:conclusion", clientRequestId: "request:j5:conclusion" } as unknown as OperationRecord,
    rawInput: conclusionRaw,
    playerActorRef: "player:j5",
    interpretation: conclusionInterpretation
  });
  assert.equal(resolvedConclusion.ok, true);
  if (!resolvedConclusion.ok || resolvedConclusion.value.resolution === null) throw new Error("supported conclusion did not resolve plot");
  const resolvedRegistry = await loadPlotRegistryV1(repository, campaignId);
  assert.equal(resolvedRegistry.ok, true);
  if (resolvedRegistry.ok) {
    const resolvedPlot = resolvedRegistry.value.state.plots[0]!;
    assert.equal(resolvedPlot.status, "RESOLVED");
    const hypotheses = resolvedPlot.playerHypotheses as Array<{ hypothesisId: string; status: string }>;
    assert.equal(hypotheses.find(value => value.hypothesisId === "hypothesis:operation:j5:hypothesis")?.status, "REFUTED");
    assert.equal(hypotheses.find(value => value.hypothesisId === "hypothesis:operation:j5:conclusion")?.status, "SUPPORTED");
    assert.deepEqual((resolvedPlot.resolution as { evidenceCluePathIds: string[] }).evidenceCluePathIds.sort(), ["clue:clerk-testimony", "clue:dust-mark"]);
  }

  const insoluble = candidate();
  insoluble.clues = insoluble.clues.slice(0, 1);
  const rejectedSolvability = buildPlotFromCandidateV1({ candidate: insoluble, context });
  assert.equal(rejectedSolvability.ok, false);
  if (!rejectedSolvability.ok) assert.match(rejectedSolvability.issues.join(" "), /two independent paths/iu);
  const unknownActor = candidate();
  unknownActor.actorPerspectives[0]!.actorRef = "actor:invented";
  const rejectedActor = buildPlotFromCandidateV1({ candidate: unknownActor, context });
  assert.equal(rejectedActor.ok, false);
  if (!rejectedActor.ok) assert.match(rejectedActor.issues.join(" "), /unknown actor/iu);
  const incoherentMotivation = candidate();
  incoherentMotivation.actorMotivations[0]!.supportsStepRefs = ["step:empty-shelf"];
  const rejectedMotivation = buildPlotFromCandidateV1({ candidate: incoherentMotivation, context });
  assert.equal(rejectedMotivation.ok, false);
  if (!rejectedMotivation.ok) assert.match(rejectedMotivation.issues.join(" "), /does not support an action by its actor/iu);
  const leaking = candidate();
  leaking.clues[0]!.publicSign = leaking.hiddenTruth.statement;
  const rejectedLeak = buildPlotFromCandidateV1({ candidate: leaking, context });
  assert.equal(rejectedLeak.ok, false);
  if (!rejectedLeak.ok) assert.match(rejectedLeak.issues.join(" "), /reveals the hidden truth/iu);

  console.log("plot-candidate/1: motivations audited and 10 narrative exchanges resolve a stable, refutable plot OK");
}

async function advanceClock(repository: MemoryCampaignRepository, campaignId: CampaignId, elapsedGameSeconds: number): Promise<void> {
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) throw new Error("campaign missing");
  const clock = await repository.getAggregate(campaignId, "world.clock", campaign.value.clockAggregateId);
  if (!clock.ok) throw new Error("clock missing");
  const operationId = opaqueId<OperationId>(`test:j5:clock:${elapsedGameSeconds}`);
  const payload = { elapsedGameSeconds };
  const now = new Date().toISOString();
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>(`request:j5:clock:${elapsedGameSeconds}`),
    idempotencyKey: opaqueId<IdempotencyKey>(operationId),
    requestFingerprint: await computeRequestFingerprint("test.clock.advance", 1, payload),
    operationKind: "test.clock.advance",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };
  assert.equal((await repository.receiveOperation(operation)).ok, true);
  assert.equal((await repository.transitionOperation(operationId, "RECEIVED", "PREPARING")).ok, true);
  assert.equal((await repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT")).ok, true);
  const lease = await repository.acquireWriterLease(campaignId, opaqueId<WriterId>(`${operationId}:writer`), 120_000);
  if (!lease.ok) throw new Error("writer lease unavailable");
  const committed = await repository.commit({
    campaignId,
    operationId,
    commitId: opaqueId<CommitId>(`${operationId}:commit`),
    idempotencyKey: operation.idempotencyKey,
    requestFingerprint: operation.requestFingerprint,
    expectedCampaignRevision: campaign.value.campaignRevision,
    writerLease: lease.value,
    acceptedCommands: [{
      schemaVersion: 1,
      contractId: "test-clock-authority",
      contractVersion: 1,
      commandId: opaqueId<CommandId>(`${operationId}:command`),
      campaignId,
      operationId,
      commandType: "test.clock.advance",
      target: { aggregateType: "world.clock", aggregateId: campaign.value.clockAggregateId, expectedAggregateRevision: clock.value.aggregateRevision },
      payloadSchemaVersion: 1,
      payload,
      acceptedAtGameSecond: elapsedGameSeconds
    }],
    aggregateWrites: [{
      aggregateType: "world.clock",
      aggregateId: campaign.value.clockAggregateId,
      expectedAggregateRevision: clock.value.aggregateRevision,
      payloadSchemaVersion: 1,
      payload: { ...clock.value.payload, elapsedGameSeconds }
    }],
    events: [{
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${operationId}:event`),
      campaignId,
      operationId,
      eventType: "test.clock.advanced",
      origin: "SYSTEM",
      causation: { kind: "COMMAND", id: `${operationId}:command` },
      aggregateRefs: [{ aggregateType: "world.clock", aggregateId: campaign.value.clockAggregateId, aggregateRevision: clock.value.aggregateRevision + 1 }],
      visibility: { scope: "SYSTEM", actorIds: [] },
      occurredAtGameSecond: elapsedGameSeconds,
      payloadSchemaVersion: 1,
      payload
    }],
    outboxTasks: []
  });
  assert.equal(committed.ok, true);
  assert.equal((await repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, payload)).ok, true);
  assert.equal((await repository.releaseWriterLease(lease.value)).ok, true);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
