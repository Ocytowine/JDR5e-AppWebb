import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type Result
} from "../../src/core";
import {
  KNOWLEDGE_CLAIM_CONTRACT_V1,
  KNOWLEDGE_SUBJECT_DOSSIER_CONTRACT_V1,
  RECORD_ATTRIBUTED_TESTIMONY_COMMAND_V1,
  TESTIMONY_RECORD_CONTRACT_V1,
  ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1,
  OBJECTIVE_CLAIM_RESOLUTION_CONTRACT_V1,
  RECORD_OBJECTIVE_CLAIM_RESOLUTION_COMMAND_V1,
  loadClaimResolutionRegistryV1,
  recordObjectiveClaimResolutionV1,
  loadActorKnowledgeRegistryV1,
  loadActorPerspectiveRegistryV1,
  loadKnowledgeSubjectRegistryV1,
  loadTestimonyRegistryV1,
  projectActorKnowledgeV1,
  captureNpcTestimonyV1,
  recordAttributedTestimonyV1,
  type KnowledgeClaimV1,
  type ObjectiveClaimResolutionOwnerPortV1,
  type RecordObjectiveClaimResolutionCommandV1,
  type RecordAttributedTestimonyCommandV1,
  type TestimonyRecordV1
} from "../../src/application";
import type { NpcPerformerPayloadV1 } from "../../src/ai";
import { assert } from "../contracts/assertions";

class FixedClock implements RepositoryClock {
  now(): Date {
    return new Date("2026-08-03T14:00:00.000Z");
  }
}

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`Expected success, got ${result.error.code}: ${result.error.messageKey}`);
  return result.value;
}

async function setup() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = id<CampaignId>("cmp-knowledge-authority");
  const instant = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: id<AggregateId>("agg-knowledge-clock"),
    dependencies: {
      contentPackageId: "content.knowledge",
      contentPackageVersion: 1,
      rulesetId: "rules.knowledge",
      rulesetVersion: 1,
      calendarId: "calendar.knowledge",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: instant,
    updatedAt: instant
  };
  expectOk(await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.knowledge",
    calendarVersion: 1
  }));
  return { repository, campaignId, clock };
}

async function seedCompletedSourceOperation(input: {
  repository: MemoryCampaignRepository;
  campaignId: CampaignId;
  clock: FixedClock;
  operationId: string;
}): Promise<void> {
  const campaign = expectOk(await input.repository.getCampaign(input.campaignId));
  const requestPayload: JsonObject = { schemaVersion: 1, purpose: "accepted NPC utterance" };
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: id<OperationId>(input.operationId),
    campaignId: input.campaignId,
    clientRequestId: id<RequestId>(`${input.operationId}:request`),
    idempotencyKey: id<IdempotencyKey>(`${input.operationId}:idempotency`),
    requestFingerprint: await computeRequestFingerprint("narrative.render.projection", 1, requestPayload),
    operationKind: "narrative.render.projection",
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: input.clock.now().toISOString(),
    updatedAt: input.clock.now().toISOString()
  };
  expectOk(await input.repository.receiveOperation(operation));
  expectOk(await input.repository.completeWithoutCommit(operation.operationId, 1, {
    schemaVersion: 1,
    acceptedNpcUtterance: true
  }));
}

function claim(): KnowledgeClaimV1 {
  return {
    schemaVersion: 1,
    contractVersion: KNOWLEDGE_CLAIM_CONTRACT_V1,
    claimRef: "claim:archives:center-sewer-noise",
    subject: {
      schemaVersion: 1,
      subjectRef: "place-hypothesis:center-sewer",
      subjectKind: "PLACE",
      publicLabel: "Égout du Centre"
    },
    proposition: "Du bruit a été entendu sous les rues du centre.",
    sourceRefs: ["subject-dossier:center-sewer"],
    version: 1
  };
}

function testimony(sourceOperationId: string): TestimonyRecordV1 {
  return {
    schemaVersion: 1,
    contractVersion: TESTIMONY_RECORD_CONTRACT_V1,
    testimonyRef: "testimony:archivist:center-sewer-noise",
    operationRef: `operation:${sourceOperationId}`,
    sceneRef: "scene:archives-main-hall",
    speakerActorRef: "actor:npc-archivist",
    audienceActorRefs: ["actor:aryn"],
    utteranceRef: "utterance:archivist:center-sewer-noise",
    claims: [{
      claimRef: "claim:archives:center-sewer-noise",
      privatePerspectiveRef: "actor-perspective:npc-archivist:center-sewer-noise",
      publicDelivery: "QUALIFIED_BELIEF"
    }],
    sourceRefs: [
      `operation:${sourceOperationId}`,
      "render-projection:source-dialogue-1"
    ],
    authority: "ATTRIBUTED_SPEECH_ONLY",
    assertsObjectiveTruth: false,
    version: 1
  };
}

function command(
  sourceOperationId: string,
  input: {
    clientRequestId?: string;
    speakerSlug?: string;
    speakerActorRef?: string;
    delivery?: "ASSERTION" | "QUALIFIED_BELIEF" | "UNCERTAINTY";
    stance?: "KNOWN" | "BELIEVED" | "UNCERTAIN";
    confidence?: "LOW" | "MEDIUM" | "HIGH";
    mayBeFalse?: boolean;
  } = {}
): RecordAttributedTestimonyCommandV1 {
  const speakerSlug = input.speakerSlug ?? "archivist";
  const speakerActorRef = input.speakerActorRef ?? "actor:npc-archivist";
  return {
    schemaVersion: 1,
    contractVersion: RECORD_ATTRIBUTED_TESTIMONY_COMMAND_V1,
    clientRequestId: input.clientRequestId ?? "request-record-archivist-testimony",
    sourceOperationId,
    occurredAtGameSecond: 0,
    claims: [claim()],
    subjects: [{
      schemaVersion: 1,
      contractVersion: KNOWLEDGE_SUBJECT_DOSSIER_CONTRACT_V1,
      subject: claim().subject,
      identityStatus: "HYPOTHETICAL",
      aliases: ["Égout du Centre"],
      sourceRefs: ["subject-dossier:center-sewer"],
      assertsExistence: false,
      version: 1
    }],
    perspectives: [{
      schemaVersion: 1,
      contractVersion: ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1,
      perspectiveRef: `actor-perspective:${speakerSlug}:center-sewer-noise`,
      actorRef: speakerActorRef,
      claimRef: "claim:archives:center-sewer-noise",
      stance: input.stance ?? "BELIEVED",
      confidence: input.confidence ?? "MEDIUM",
      supportRefs: [`render-projection:${sourceOperationId}`],
      mayBeFalse: input.mayBeFalse ?? true,
      privateTruthRef: null,
      deceptionCauseRef: null,
      visibility: "PRIVATE_TO_ACTOR_DOMAIN",
      version: 1
    }],
    testimony: {
      ...testimony(sourceOperationId),
      testimonyRef: `testimony:${speakerSlug}:center-sewer-noise`,
      speakerActorRef,
      utteranceRef: `utterance:${speakerSlug}:center-sewer-noise`,
      claims: [{
        claimRef: "claim:archives:center-sewer-noise",
        privatePerspectiveRef: `actor-perspective:${speakerSlug}:center-sewer-noise`,
        publicDelivery: input.delivery ?? "QUALIFIED_BELIEF"
      }],
      sourceRefs: [`operation:${sourceOperationId}`, `render-projection:${sourceOperationId}`]
    }
  };
}

function resolutionCommand(
  sourceOperationId: string,
  resolution: "CONFIRMED" | "REFUTED" = "CONFIRMED",
  clientRequestId = `request-${resolution.toLowerCase()}-sewer-noise`
): RecordObjectiveClaimResolutionCommandV1 {
  return {
    schemaVersion: 1,
    contractVersion: RECORD_OBJECTIVE_CLAIM_RESOLUTION_COMMAND_V1,
    clientRequestId,
    sourceOperationId,
    occurredAtGameSecond: 0,
    resolution: {
      schemaVersion: 1,
      contractVersion: OBJECTIVE_CLAIM_RESOLUTION_CONTRACT_V1,
      resolutionRef: `claim-resolution:center-sewer-noise:${resolution.toLowerCase()}`,
      claimRef: claim().claimRef,
      resolution,
      ownerDomain: "WorldDomain",
      factRefs: ["world-fact:center-sewer-noise"],
      visibility: "PLAYER_VISIBLE",
      version: 1
    },
    recipientActorRefs: ["actor:aryn"]
  };
}

function ownerPort(command: RecordObjectiveClaimResolutionCommandV1): ObjectiveClaimResolutionOwnerPortV1 {
  return {
    async authorize() {
      return {
        ok: true,
        authorization: {
          schemaVersion: 1,
          authority: "CLAIM_OWNER_DOMAIN",
          sourceOperationId: command.sourceOperationId,
          ownerDomain: command.resolution.ownerDomain,
          resolutionRef: command.resolution.resolutionRef,
          claimRef: command.resolution.claimRef,
          resolution: command.resolution.resolution,
          factRefs: [...command.resolution.factRefs],
          visibility: command.resolution.visibility,
          permittedActorRefs: ["actor:aryn"]
        }
      };
    }
  };
}

async function main(): Promise<void> {
  const fixture = await setup();
  await seedCompletedSourceOperation({ ...fixture, operationId: "source-dialogue-1" });
  await seedCompletedSourceOperation({ ...fixture, operationId: "source-dialogue-2" });
  await seedCompletedSourceOperation({ ...fixture, operationId: "source-dialogue-3" });

  const first = expectOk(await recordAttributedTestimonyV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command("source-dialogue-1")
  }));
  assert.equal(first.replayed, false);
  assert.deepEqual(first.acquiredClaimRefs, ["claim:archives:center-sewer-noise"]);

  const replay = expectOk(await recordAttributedTestimonyV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command("source-dialogue-1")
  }));
  assert.equal(replay.replayed, true);
  assert.equal(replay.commitId, first.commitId);

  expectOk(await recordAttributedTestimonyV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command("source-dialogue-2", {
      clientRequestId: "request-record-clerk-testimony",
      speakerSlug: "clerk",
      speakerActorRef: "actor:npc-clerk",
      delivery: "UNCERTAINTY",
      stance: "UNCERTAIN",
      confidence: "LOW",
      mayBeFalse: true
    })
  }));
  expectOk(await recordAttributedTestimonyV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command("source-dialogue-3", {
      clientRequestId: "request-record-guard-testimony",
      speakerSlug: "guard",
      speakerActorRef: "actor:npc-guard",
      delivery: "ASSERTION",
      stance: "KNOWN",
      confidence: "HIGH",
      mayBeFalse: false
    })
  }));

  const testimonies = expectOk(await loadTestimonyRegistryV1(
    fixture.repository,
    fixture.campaignId
  ));
  assert.equal(testimonies.state.claims.length, 1);
  assert.equal(testimonies.state.testimonies.length, 3);
  assert.equal(testimonies.state.testimonies[0]?.assertsObjectiveTruth, false);
  const subjects = expectOk(await loadKnowledgeSubjectRegistryV1(fixture.repository, fixture.campaignId));
  assert.equal(subjects.state.subjects.length, 1);
  assert.equal(subjects.state.subjects[0]?.identityStatus, "HYPOTHETICAL");
  assert.equal(subjects.state.subjects[0]?.assertsExistence, false);

  const privatePerspectives = expectOk(await loadActorPerspectiveRegistryV1(
    fixture.repository,
    fixture.campaignId,
    "actor:npc-archivist"
  ));
  assert.equal(privatePerspectives.state.perspectives.length, 1);
  assert.equal(privatePerspectives.state.perspectives[0]?.stance, "BELIEVED");

  const arynKnowledge = expectOk(await loadActorKnowledgeRegistryV1(
    fixture.repository,
    fixture.campaignId,
    "actor:aryn"
  ));
  assert.equal(arynKnowledge.state.acquisitions.length, 3);
  assert.equal(arynKnowledge.state.acquisitions[0]?.status, "HEARD");
  assert.equal(arynKnowledge.state.acquisitions[0]?.assertsObjectiveTruth, false);

  const projection = projectActorKnowledgeV1({
    testimonyRegistry: testimonies.state,
    actorKnowledge: arynKnowledge.state
  });
  assert.equal(projection.items.length, 1);
  assert.equal(projection.items[0]?.status, "HEARD");
  assert.deepEqual(projection.items[0]?.attributedSpeakerRefs, [
    "actor:npc-archivist",
    "actor:npc-clerk",
    "actor:npc-guard"
  ]);
  assert.equal(JSON.stringify(projection).includes("privatePerspectiveRef"), false);
  assert.equal(JSON.stringify(projection).includes("CONFIRMED"), false);

  const uninvolved = expectOk(await loadActorKnowledgeRegistryV1(
    fixture.repository,
    fixture.campaignId,
    "actor:mira"
  ));
  assert.equal(uninvolved.state.acquisitions.length, 0, "A non-audience actor must learn nothing.");

  const event = expectOk(await fixture.repository.listEvents(fixture.campaignId, null, 20))
    .find(candidate => candidate.eventType === "knowledge.testimony.recorded");
  assert.equal(event?.visibility.scope, "ACTOR_SCOPED");
  assert.deepEqual(event?.visibility.actorIds, ["aryn"]);
  assert.equal(JSON.stringify(event?.payload).includes("Du bruit"), false);
  assert.equal((event?.payload as { assertsObjectiveTruth?: unknown }).assertsObjectiveTruth, false);

  await seedCompletedSourceOperation({ ...fixture, operationId: "source-world-resolution-1" });
  const confirmationCommand = resolutionCommand("source-world-resolution-1");
  const confirmed = expectOk(await recordObjectiveClaimResolutionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: confirmationCommand,
    ownerPort: ownerPort(confirmationCommand)
  }));
  assert.equal(confirmed.resolution, "CONFIRMED");
  assert.equal(confirmed.replayed, false);
  const confirmedReplay = expectOk(await recordObjectiveClaimResolutionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: confirmationCommand,
    ownerPort: ownerPort(confirmationCommand)
  }));
  assert.equal(confirmedReplay.replayed, true);
  const resolutions = expectOk(await loadClaimResolutionRegistryV1(fixture.repository, fixture.campaignId));
  assert.equal(resolutions.state.resolutions.length, 1);
  assert.equal(resolutions.state.resolutions[0]?.ownerDomain, "WorldDomain");
  const confirmedKnowledge = expectOk(await loadActorKnowledgeRegistryV1(fixture.repository, fixture.campaignId, "actor:aryn"));
  assert.equal(confirmedKnowledge.state.acquisitions.some(acquisition => acquisition.status === "CONFIRMED"), true);
  assert.equal(projectActorKnowledgeV1({ testimonyRegistry: testimonies.state, actorKnowledge: confirmedKnowledge.state }).items[0]?.status, "CONFIRMED");
  const stillUninvolved = expectOk(await loadActorKnowledgeRegistryV1(fixture.repository, fixture.campaignId, "actor:mira"));
  assert.equal(stillUninvolved.state.acquisitions.length, 0);

  await seedCompletedSourceOperation({ ...fixture, operationId: "source-forged-resolution" });
  const forgedCommand = resolutionCommand("source-forged-resolution", "CONFIRMED", "request-forged-resolution");
  const forged = await recordObjectiveClaimResolutionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: forgedCommand,
    ownerPort: {
      async authorize() {
        const valid = await ownerPort(forgedCommand).authorize({ campaignId: fixture.campaignId, command: forgedCommand });
        if (!valid.ok) return valid;
        return { ok: true as const, authorization: { ...valid.authorization, ownerDomain: "ForgedDomain" } };
      }
    }
  });
  assert.equal(forged.ok, false);
  if (!forged.ok) assert.equal(forged.error.messageKey, "knowledge.claim-resolution-owner-authorization-invalid");

  await seedCompletedSourceOperation({ ...fixture, operationId: "source-world-resolution-conflict" });
  const contradictoryCommand = resolutionCommand("source-world-resolution-conflict", "REFUTED", "request-conflicting-refutation");
  const contradictory = await recordObjectiveClaimResolutionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: contradictoryCommand,
    ownerPort: ownerPort(contradictoryCommand)
  });
  assert.equal(contradictory.ok, false);
  if (!contradictory.ok) assert.equal(contradictory.error.messageKey, "knowledge.claim-resolution-truth-conflict");

  await seedCompletedSourceOperation({ ...fixture, operationId: "source-dialogue-4" });
  const capturedPerformance: NpcPerformerPayloadV1 = {
    schemaVersion: 1,
    performanceId: "performance:npc-researcher:center-sewer",
    actorId: "npc-researcher",
    reactionFrame: {
      schemaVersion: 1,
      sourceDialogueAct: "ASK_QUESTION",
      responseMode: "ANSWER_QUESTION",
      addressedContentGoal: "Répondre au sujet de l'ancien égout."
    },
    conversationProfile: {
      schemaVersion: 1,
      profileId: "npc-researcher:conversation",
      actorId: "npc-researcher",
      lifecycle: "EPHEMERAL_DIALOGUE",
      continuityRevision: 1,
      continuitySource: "INITIALIZED",
      perspectiveSummary: "Le chercheur rapporte une rumeur locale.",
      currentConcerns: [],
      subjectiveOpinions: [],
      conversationHooks: [],
      boundaries: [],
      speechStyle: ["prudent"],
      relationshipTone: "NEUTRAL",
      durable: false
    },
    utterances: [{
      utteranceId: "utterance-researcher-center-sewer",
      text: "J'ai entendu parler de l'Égout du Centre, mais je ne l'ai jamais vu.",
      audience: ["player-character"],
      speechActs: [{
        type: "assertion",
        content: "L'Égout du Centre est mentionné dans une rumeur locale.",
        epistemicBasis: "believed",
        sourceRefs: ["subject-dossier:center-sewer"]
      }]
    }],
    knowledgeClaims: [{
      utteranceId: "utterance-researcher-center-sewer",
      speechActIndex: 0,
      subject: {
        mode: "HYPOTHETICAL_MENTION",
        ref: null,
        kind: "PLACE",
        label: "Egout du centre"
      }
    }],
    nonVerbalReactions: [],
    durableCommitments: [],
    revealedRefs: [],
    knowledgeUsed: ["subject-dossier:center-sewer"],
    safetyConstraints: {
      noMechanicalSuccess: true,
      noSecretReveal: true,
      noDurableCommitment: true,
      noStateMutation: true
    }
  };
  const captured = expectOk(await captureNpcTestimonyV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    performance: capturedPerformance,
    finalNpcSpeechText: capturedPerformance.utterances[0]!.text,
    sourceOperationId: "source-dialogue-4",
    sceneRef: "scene:archives-main-hall",
    playerActorRef: "actor:aryn",
    occurredAtGameSecond: 0
  }));
  assert.equal(captured.status, "RECORDED");
  assert.equal(
    expectOk(await loadKnowledgeSubjectRegistryV1(fixture.repository, fixture.campaignId)).state.subjects.length,
    1,
    "Accent and case variants must reuse the same hypothetical subject dossier."
  );
  assert.equal(
    expectOk(await loadActorKnowledgeRegistryV1(fixture.repository, fixture.campaignId, "actor:aryn")).state.acquisitions.length,
    5
  );
  const longRenderOperationId = `campaign-main-9f-render-op-${"a".repeat(32)}`;
  const longIdentityFixture = await setup();
  await seedCompletedSourceOperation({ ...longIdentityFixture, operationId: longRenderOperationId });
  const longIdentityPerformance: NpcPerformerPayloadV1 = {
    ...capturedPerformance,
    performanceId: "performance-clerc-registres-naissances",
    utterances: [{
      ...capturedPerformance.utterances[0]!,
      utteranceId: "utterance-clerc-restrictions-acces-registres"
    }],
    knowledgeClaims: capturedPerformance.knowledgeClaims?.map(candidate => ({
      ...candidate,
      utteranceId: "utterance-clerc-restrictions-acces-registres"
    }))
  };
  const longIdentityCapture = expectOk(await captureNpcTestimonyV1({
    repository: longIdentityFixture.repository,
    campaignId: longIdentityFixture.campaignId,
    performance: longIdentityPerformance,
    finalNpcSpeechText: longIdentityPerformance.utterances[0]!.text,
    sourceOperationId: longRenderOperationId,
    sceneRef: "scene:archives-main-hall",
    playerActorRef: "actor:aryn",
    occurredAtGameSecond: 0
  }));
  assert.equal(longIdentityCapture.status, "RECORDED");
  const longIdentityReplay = expectOk(await captureNpcTestimonyV1({
    repository: longIdentityFixture.repository,
    campaignId: longIdentityFixture.campaignId,
    performance: longIdentityPerformance,
    finalNpcSpeechText: longIdentityPerformance.utterances[0]!.text,
    sourceOperationId: longRenderOperationId,
    sceneRef: "scene:archives-main-hall",
    playerActorRef: "actor:aryn",
    occurredAtGameSecond: 0
  }));
  assert.equal(longIdentityReplay.status, "RECORDED");
  assert.equal(longIdentityReplay.testimony?.replayed, true);
  const mismatchedVisibleSpeech = expectOk(await captureNpcTestimonyV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    performance: capturedPerformance,
    finalNpcSpeechText: "Une autre phrase a été affichée.",
    sourceOperationId: "source-dialogue-5",
    sceneRef: "scene:archives-main-hall",
    playerActorRef: "actor:aryn",
    occurredAtGameSecond: 0
  }));
  assert.equal(mismatchedVisibleSpeech.status, "SKIPPED");

  const conflict = await recordAttributedTestimonyV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      ...command("source-dialogue-1"),
      claims: [{ ...claim(), proposition: "La rumeur est remplacée par une autre vérité." }]
    }
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const refutedFixture = await setup();
  await seedCompletedSourceOperation({ ...refutedFixture, operationId: "source-refuted-testimony" });
  await seedCompletedSourceOperation({ ...refutedFixture, operationId: "source-world-refutation" });
  expectOk(await recordAttributedTestimonyV1({
    repository: refutedFixture.repository,
    campaignId: refutedFixture.campaignId,
    command: command("source-refuted-testimony")
  }));
  const refutationCommand = resolutionCommand("source-world-refutation", "REFUTED", "request-clean-refutation");
  expectOk(await recordObjectiveClaimResolutionV1({
    repository: refutedFixture.repository,
    campaignId: refutedFixture.campaignId,
    command: refutationCommand,
    ownerPort: ownerPort(refutationCommand)
  }));
  const refutedKnowledge = expectOk(await loadActorKnowledgeRegistryV1(refutedFixture.repository, refutedFixture.campaignId, "actor:aryn"));
  assert.equal(refutedKnowledge.state.acquisitions.some(acquisition => acquisition.status === "REFUTED"), true);

  console.log("knowledge authority: testimony, owner-authorized CONFIRMED/REFUTED acquisitions and replay isolation verified.");
}

void main();
