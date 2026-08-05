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
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../../src/core";
import {
  ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
  activeCampaignCharacterProfileAggregateIdV1,
  createActiveCampaignCharacterProfileV1
} from "../../src/bootstrap";
import {
  ACCESS_CONTROL_CONTRACT_V1,
  SOCIAL_ACCESS_RESOLUTION_CONTRACT_V1,
  UPSERT_ACCESS_CONTROL_COMMAND_V1,
  createCatalogSocialAccessRuntimeV1,
  loadAccessControlRegistryV1,
  loadSocialAccessAttemptRegistryV1,
  resolveSocialAccessV1,
  upsertAccessControlV1,
  type AccessControlOwnerPortV1,
  type AccessControlRecordV1,
  type ResolveSocialAccessCommandV1,
  type SocialAccessAuthorizationV1,
  type SocialAccessAuthorityPortV1,
  type SocialAccessOutcomeV1,
  NarrativeTurnControllerV1,
  type D20SourceV1,
  type PendingNarrativeSkillCheckV1,
  type UpsertAccessControlCommandV1
} from "../../src/application";

class CountingD20 implements D20SourceV1 {
  readonly sourceId = "social-access-test-d20";
  calls = 0;
  constructor(private readonly value: number) {}
  nextD20(): number { this.calls += 1; return this.value; }
}

async function main(): Promise<void> {
  const deniedFixture = await setup("denied");
  const denied = expectOk(await resolveSocialAccessV1({ ...deniedFixture, command: command(deniedFixture, "ask-denied"), authorityPort: authority(authorization(deniedFixture, "DENIED")) }));
  assert.equal(denied.outcome, "DENIED");
  assert.equal(denied.resultingAccessState, "CONTROLLED");
  assert.equal(expectOk(await loadAccessControlRegistryV1(deniedFixture.repository, deniedFixture.campaignId)).state.controls[0]?.state, "CONTROLLED", "une parole refusée ne doit pas ouvrir le passage");
  const deniedAttempts = expectOk(await loadSocialAccessAttemptRegistryV1(deniedFixture.repository, deniedFixture.campaignId)).state.attempts;
  assert.equal(deniedAttempts[0]?.speechText, "Je demande au garde de me laisser passer.");
  assert.equal(deniedAttempts[0]?.outcome, "DENIED");

  const conditionFixture = await setup("condition");
  const condition = expectOk(await resolveSocialAccessV1({ ...conditionFixture, command: command(conditionFixture, "ask-condition"), authorityPort: authority(authorization(conditionFixture, "CONDITION_OFFERED")) }));
  assert.equal(condition.conditionRef, "condition:obtain-supervisor-approval");
  assert.equal(condition.resultingAccessState, "CONTROLLED");

  const checkFixture = await setup("check");
  const check = expectOk(await resolveSocialAccessV1({ ...checkFixture, command: command(checkFixture, "ask-check"), authorityPort: authority(authorization(checkFixture, "CHECK_REQUIRED")) }));
  assert.equal(check.checkProposalRef, "skill-check-proposal:social-access");
  assert.equal(check.resultingAccessState, "CONTROLLED");

  const forgedFixture = await setup("forged");
  const forgedAuthorization = { ...authorization(forgedFixture, "GRANTED"), respondingActorRef: "actor:other-guard" };
  const forged = await resolveSocialAccessV1({ ...forgedFixture, command: command(forgedFixture, "ask-forged"), authorityPort: authority(forgedAuthorization) });
  assert.equal(forged.ok, false);
  if (!forged.ok) assert.equal(forged.error.messageKey, "social-access.authorization-invalid");
  assert.equal(expectOk(await loadSocialAccessAttemptRegistryV1(forgedFixture.repository, forgedFixture.campaignId)).state.attempts.length, 0);

  const grantedFixture = await setup("granted");
  const grantCommand = command(grantedFixture, "ask-granted");
  const granted = expectOk(await resolveSocialAccessV1({ ...grantedFixture, command: grantCommand, authorityPort: authority(authorization(grantedFixture, "GRANTED")) }));
  assert.equal(granted.outcome, "GRANTED");
  assert.equal(granted.resultingAccessState, "OPEN");
  const opened = expectOk(await loadAccessControlRegistryV1(grantedFixture.repository, grantedFixture.campaignId)).state.controls[0]!;
  assert.equal(opened.state, "OPEN");
  assert.equal(opened.requirements[0]?.status, "SATISFIED");
  const replay = expectOk(await resolveSocialAccessV1({ ...grantedFixture, command: grantCommand, authorityPort: authority(authorization(grantedFixture, "GRANTED")) }));
  assert.equal(replay.replayed, true);
  assert.equal(expectOk(await loadSocialAccessAttemptRegistryV1(grantedFixture.repository, grantedFixture.campaignId)).state.attempts.length, 1, "un rejeu ne doit pas enregistrer deux négociations");

  const runtimeFixture = await setup("runtime");
  await seedActiveProfile(runtimeFixture.repository, runtimeFixture.campaignId, runtimeFixture.slug);
  const runtimeOperation = await beginReceivedOperation(runtimeFixture.repository, runtimeFixture.campaignId, "runtime-social-access", "narrative.turn.input", { rawInput: "Je demande au garde de me laisser passer." });
  const runtime = createCatalogSocialAccessRuntimeV1({
    targetResolver: { async resolve() { return { ok: true, actorRef: "actor:gate-guard", displayName: "Garde de la grille" }; } },
    authorityPort: authority(authorization(runtimeFixture, "GRANTED"))
  });
  const runtimeRequest = {
    repository: runtimeFixture.repository,
    campaignId: runtimeFixture.campaignId,
    operation: runtimeOperation,
    rawInput: "Je demande au garde de me laisser passer.",
    interpretation: { runtimeDecision: { requiredDomain: "social" }, referentResolution: { resolvedTarget: { ref: "actor:gate-guard" } }, semanticIntent: { target: { ref: "actor:gate-guard" } } } as never,
    domainCommand: null,
    activeScene: { sceneId: runtimeFixture.control.sourceSceneId } as never
  };
  assert.equal(await runtime.canHandle?.(runtimeRequest), true);
  const runtimeResult = expectOk(await runtime.execute(runtimeRequest));
  assert.equal(runtimeResult.commit.operationId, runtimeOperation.operationId);
  assert.equal(runtimeResult.respondingActorName, "Garde de la grille");
  assert.equal(runtimeResult.resolution.resultingAccessState, "OPEN");

  await verifyAutomaticCheckResume("resume-success", 12, "OPEN", "GRANTED");
  await verifyAutomaticCheckResume("resume-failure", 1, "CONTROLLED", "DENIED");

  console.log("social access authority: decisions, automatic checked resume, atomic opening, reload and replay verified.");
}

type Fixture = Awaited<ReturnType<typeof setup>>;

async function setup(slug: string) {
  const repository = new MemoryCampaignRepository();
  const campaignId = opaqueId<CampaignId>(`cmp-social-access:${slug}`);
  const now = new Date("2026-08-03T18:00:00.000Z").toISOString();
  const campaign: CampaignRecord = { schemaVersion: 1, campaignId, campaignRevision: 0, status: "ACTIVE", clockAggregateId: opaqueId<AggregateId>(`agg-clock:social-access:${slug}`), dependencies: { contentPackageId: "content.social-access", contentPackageVersion: 1, rulesetId: "rules.social-access", rulesetVersion: 1, calendarId: "calendar.social-access", calendarVersion: 1 }, writeBlock: null, lastCommitId: null, createdAt: now, updatedAt: now };
  expectOk(await repository.createCampaign(campaign, { elapsedGameSeconds: 0, calendarId: "calendar.social-access", calendarVersion: 1 }));
  await seedCompletedOperation(repository, campaignId, `source-control:${slug}`, "access.owner-resolution");
  const control = accessControl(slug);
  const accessCommand: UpsertAccessControlCommandV1 = { schemaVersion: 1, contractVersion: UPSERT_ACCESS_CONTROL_COMMAND_V1, clientRequestId: `seed-control:${slug}`, sourceOperationId: `source-control:${slug}`, occurredAtGameSecond: 0, control };
  expectOk(await upsertAccessControlV1({ repository, campaignId, command: accessCommand, ownerPort: accessOwnerPort(accessCommand) }));
  await seedCompletedOperation(repository, campaignId, `source-social-intent:${slug}`, "social.speech-act.record");
  return { repository, campaignId, slug, control };
}

function command(fixture: Fixture, clientRequestId: string): ResolveSocialAccessCommandV1 {
  return { schemaVersion: 1, contractVersion: SOCIAL_ACCESS_RESOLUTION_CONTRACT_V1, clientRequestId: `${clientRequestId}:${fixture.slug}`, sourceOperationId: `source-social-intent:${fixture.slug}`, accessControlRef: fixture.control.accessControlRef, playerActorRef: "actor:hero", targetActorRef: "actor:gate-guard", speechText: "Je demande au garde de me laisser passer.", occurredAtGameSecond: 0 };
}

function authorization(fixture: Fixture, outcome: SocialAccessOutcomeV1): SocialAccessAuthorizationV1 {
  const granted = outcome === "GRANTED";
  return {
    schemaVersion: 1,
    authority: "SOCIAL_ACCESS_DOMAIN",
    resolutionRef: `social-resolution:${fixture.slug}`,
    accessControlRef: fixture.control.accessControlRef,
    respondingActorRef: "actor:gate-guard",
    outcome,
    requirementRef: granted ? fixture.control.requirements[0]!.requirementRef : null,
    satisfyRequirementRefs: granted ? [fixture.control.requirements[0]!.requirementRef] : [],
    waiveRequirementRefs: [],
    resultingAccessState: granted ? "OPEN" : "CONTROLLED",
    playerFacingResponse: outcome === "GRANTED" ? "Très bien. Vous pouvez passer." : outcome === "DENIED" ? "Non. Je ne peux pas vous laisser passer." : outcome === "CONDITION_OFFERED" ? "Revenez avec l'accord de ma supérieure." : "Convainquez-moi que votre demande est urgente.",
    conditionRef: outcome === "CONDITION_OFFERED" ? "condition:obtain-supervisor-approval" : null,
    checkProposalRef: outcome === "CHECK_REQUIRED" ? "skill-check-proposal:social-access" : null,
    checkPolicy: outcome === "CHECK_REQUIRED" ? {
      schemaVersion: 1,
      proposal: {
        schemaVersion: 1,
        contractVersion: "skill-check-proposal/1",
        checkId: "skill-check-proposal:social-access",
        domain: "social",
        goal: "Convaincre le garde de laisser passer le personnage.",
        targetRef: "actor:gate-guard",
        ability: "CHA",
        skillId: "persuasion",
        characterContext: {
          schemaVersion: 1, contractVersion: "mechanical-character-context/1", characterId: "character:hero",
          ability: "CHA", abilityModifier: 2, proficiencyBonus: 2, skillId: "persuasion", proficiencyRank: 1,
          totalModifier: 4, passiveScore: null, backgroundId: "emissaire", sourceRefs: ["character:hero"]
        },
        difficulty: {
          status: "RULE_RESOLVED", dc: 12, band: "EASY", ruleRef: "core.check.difficulty-class@1",
          assessment: { schemaVersion: 1, contractVersion: "difficulty-assessment/1", assessmentId: "difficulty:social-access", domain: "social", baseBand: "EASY", selectedBand: "EASY", netShift: 0, totalShift: 0, publicReasons: [], privateFactorCount: 0, publicSourceRefs: ["social-policy:gate-guard"], privateSourceRefs: [], ruleRefs: ["core.check.difficulty-assessment@1"], commitAuthority: false }
        },
        passive: { eligible: false, score: null, reason: "La négociation engagée demande un jet explicite." },
        advantageSources: [], disadvantageSources: [],
        stakes: { success: "Le garde accorde le passage.", failure: "Le garde maintient son refus." },
        retryPolicy: "DOMAIN_TO_DECIDE", timeCost: "DOMAIN_TO_DECIDE",
        sourceRefs: ["social-policy:gate-guard", "character:hero"], ruleRefs: ["core.check.difficulty-class@1"], commitAuthority: false
      },
      durationSeconds: 6,
      success: {
        playerFacingResponse: "Votre argument porte. Vous pouvez passer.",
        requirementRef: fixture.control.requirements[0]!.requirementRef,
        satisfyRequirementRefs: [fixture.control.requirements[0]!.requirementRef],
        waiveRequirementRefs: [], resultingAccessState: "OPEN",
        sourceRefs: ["social-policy:gate-guard"]
      },
      failure: { playerFacingResponse: "Votre argument ne suffit pas. Le passage reste fermé.", sourceRefs: ["social-policy:gate-guard"] },
      ruleRefs: ["rule.social-access.persuasion@1"]
    } : null,
    sourceRefs: ["social-policy:gate-guard"]
  };
}

function authority(value: SocialAccessAuthorizationV1): SocialAccessAuthorityPortV1 {
  return { async resolve() { return { ok: true, authorization: value }; } };
}

async function verifyAutomaticCheckResume(
  slug: string,
  die: number,
  expectedAccessState: "OPEN" | "CONTROLLED",
  expectedDecision: "GRANTED" | "DENIED"
): Promise<void> {
  const fixture = await setup(slug);
  const sourceOperation = await beginReceivedOperation(
    fixture.repository,
    fixture.campaignId,
    `narrative-social-check:${slug}`,
    "narrative.turn.input",
    { rawInput: "Je tente de convaincre le garde." }
  );
  const auth = authorization(fixture, "CHECK_REQUIRED");
  const resolution = expectOk(await resolveSocialAccessV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    operation: sourceOperation,
    command: {
      ...command(fixture, `social-check:${slug}`),
      sourceOperationId: sourceOperation.operationId,
      clientRequestId: `social-check:${slug}`,
      speechText: "Je tente de convaincre le garde."
    },
    authorityPort: authority(auth)
  }));
  assert.equal(resolution.checkPolicy !== null, true);
  if (resolution.checkPolicy === null) throw new Error("missing social check policy");
  const scene = { sceneId: fixture.control.sourceSceneId } as never;
  const pending: PendingNarrativeSkillCheckV1 = {
    schemaVersion: 1,
    contractVersion: "pending-narrative-skill-check/1",
    pendingCheckId: `${resolution.checkPolicy.proposal.checkId}:pending`,
    sourceOperationId: sourceOperation.operationId,
    sceneId: fixture.control.sourceSceneId,
    status: "AWAITING_SKILL_ROLL",
    proposal: resolution.checkPolicy.proposal,
    ownerContext: {
      owner: "SOCIAL_ACCESS",
      resolutionRef: resolution.resolutionRef,
      accessControlRef: resolution.accessControlRef,
      playerActorRef: resolution.playerActorRef,
      respondingActorRef: resolution.respondingActorRef,
      checkPolicy: resolution.checkPolicy
    },
    createdAt: "2026-08-03T18:00:00.000Z",
    commitAuthority: false
  };
  expectOk(await fixture.repository.completePresentation(sourceOperation.operationId, "COMMITTED_RENDERED", 1, { pendingSkillCheck: pending }));
  const d20 = new CountingD20(die);
  const controller = new NarrativeTurnControllerV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    activeSceneResolver: { resolve: async () => ({ ok: true, value: scene }) },
    d20Source: d20
  });
  const resumeCommand = {
    schemaVersion: 1 as const,
    clientRequestId: `roll-social-check:${slug}`,
    sourceOperationId: sourceOperation.operationId,
    pendingCheckId: pending.pendingCheckId
  };
  const restoredBeforeRoll = expectOk(await controller.restorePendingSkillCheck());
  assert.equal(restoredBeforeRoll?.pendingCheckId, pending.pendingCheckId);
  const first = expectOk(await controller.rollPendingSkillCheck(resumeCommand));
  assert.equal(first.prepared.outcome, expectedDecision === "GRANTED" ? "SUCCESS" : "FAILURE");
  assert.equal(first.displayPacket.displayBlocks.some(block => block.text.includes(expectedDecision === "GRANTED" ? "Vous pouvez passer" : "reste fermé")), true);
  assert.equal(d20.calls, 1);
  const access = expectOk(await loadAccessControlRegistryV1(fixture.repository, fixture.campaignId)).state.controls[0]!;
  assert.equal(access.state, expectedAccessState);
  const attempt = expectOk(await loadSocialAccessAttemptRegistryV1(fixture.repository, fixture.campaignId)).state.attempts[0]!;
  assert.equal(attempt.checkResolution?.outcome, expectedDecision);
  const reloadedController = new NarrativeTurnControllerV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    activeSceneResolver: { resolve: async () => ({ ok: true, value: scene }) },
    d20Source: d20
  });
  const replay = expectOk(await reloadedController.rollPendingSkillCheck(resumeCommand));
  assert.equal(replay.commit.commitId, first.commit.commitId);
  assert.equal(replay.replayed, true);
  assert.equal(d20.calls, 1);
  const restored = expectOk(await reloadedController.restorePendingSkillCheck());
  assert.equal(restored, null);
}

function accessControl(slug: string): AccessControlRecordV1 {
  const ref = `access-control:${slug}`;
  return { schemaVersion: 1, contractVersion: ACCESS_CONTROL_CONTRACT_V1, accessControlRef: ref, connectionId: `connection:${slug}`, sourceSceneId: `scene:${slug}:source`, boundaryRef: `poi:${slug}:door`, destinationRef: `location:${slug}:restricted`, state: "CONTROLLED", ownerDomain: "AccessDomain", thresholdDescription: "Un garde contrôle le passage.", requirements: [{ schemaVersion: 1, requirementRef: `${ref}:requirement:social`, kind: "SOCIAL_PERMISSION", description: "Obtenir la permission du garde.", status: "ACTIVE", visibility: "PUBLIC", ownerDomain: "social", sourceRefs: ["social-policy:gate-guard"], version: 1 }], approachDomains: ["social", "inventory", "perception", "rules", "tactical", "world"], approachesAreNonExhaustive: true, sourceRefs: ["world-fact:guarded-door"], version: 1 };
}

function accessOwnerPort(command: UpsertAccessControlCommandV1): AccessControlOwnerPortV1 {
  return { async authorize() { return { ok: true, authorization: { schemaVersion: 1, authority: "ACCESS_OWNER_DOMAIN", sourceOperationId: command.sourceOperationId, accessControlRef: command.control.accessControlRef, connectionId: command.control.connectionId, ownerDomain: command.control.ownerDomain, permittedState: command.control.state, sourceRefs: [...command.control.sourceRefs] } }; } };
}

async function seedCompletedOperation(repository: MemoryCampaignRepository, campaignId: CampaignId, operationId: string, kind: string): Promise<void> {
  const campaign = expectOk(await repository.getCampaign(campaignId));
  const payload = { schemaVersion: 1, accepted: true };
  const now = new Date("2026-08-03T18:00:00.000Z").toISOString();
  const operation: OperationRecord = { schemaVersion: 1, operationId: opaqueId<OperationId>(operationId), campaignId, clientRequestId: opaqueId<RequestId>(`${operationId}:request`), idempotencyKey: opaqueId<IdempotencyKey>(`${operationId}:key`), requestFingerprint: await computeRequestFingerprint(kind, 1, payload), operationKind: kind, requestPayloadSchemaVersion: 1, requestPayload: payload, phase: "RECEIVED", observedCampaignRevision: campaign.campaignRevision, commitId: null, completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null, receivedAt: now, updatedAt: now };
  expectOk(await repository.receiveOperation(operation));
  expectOk(await repository.completeWithoutCommit(operation.operationId, 1, { accepted: true }));
}

async function beginReceivedOperation(repository: MemoryCampaignRepository, campaignId: CampaignId, operationId: string, kind: string, payload: JsonObject): Promise<OperationRecord> {
  const campaign = expectOk(await repository.getCampaign(campaignId));
  const now = new Date("2026-08-03T18:00:00.000Z").toISOString();
  return expectOk(await repository.receiveOperation({ schemaVersion: 1, operationId: opaqueId<OperationId>(operationId), campaignId, clientRequestId: opaqueId<RequestId>(`${operationId}:request`), idempotencyKey: opaqueId<IdempotencyKey>(`${operationId}:key`), requestFingerprint: await computeRequestFingerprint(kind, 1, payload), operationKind: kind, requestPayloadSchemaVersion: 1, requestPayload: payload, phase: "RECEIVED", observedCampaignRevision: campaign.campaignRevision, commitId: null, completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null, receivedAt: now, updatedAt: now }));
}

async function seedActiveProfile(repository: MemoryCampaignRepository, campaignId: CampaignId, slug: string): Promise<void> {
  const operation = await beginReceivedOperation(repository, campaignId, `profile:${slug}`, "campaign.active-character-profile.bootstrap", { actorId: "hero" });
  expectOk(await repository.transitionOperation(operation.operationId, "RECEIVED", "PREPARING"));
  const ready = expectOk(await repository.transitionOperation(operation.operationId, "PREPARING", "READY_TO_COMMIT"));
  const campaign = expectOk(await repository.getCampaign(campaignId));
  const lease = expectOk(await repository.acquireWriterLease(campaignId, opaqueId<WriterId>(`${operation.operationId}:writer`), 120_000));
  const aggregateId = activeCampaignCharacterProfileAggregateIdV1(campaignId);
  const commandId = opaqueId<CommandId>(`${operation.operationId}:command`);
  try {
    expectOk(await repository.commit({
      campaignId, operationId: ready.operationId, commitId: opaqueId<CommitId>(`${operation.operationId}:commit`), idempotencyKey: ready.idempotencyKey, requestFingerprint: ready.requestFingerprint, expectedCampaignRevision: campaign.campaignRevision, writerLease: lease,
      acceptedCommands: [{ schemaVersion: 1, contractId: "active-character-profile-bootstrap", contractVersion: 1, commandId, campaignId, operationId: ready.operationId, commandType: "campaign.active-character-profile.bootstrap", target: { aggregateType: ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1, aggregateId, expectedAggregateRevision: null }, payloadSchemaVersion: 1, payload: { actorId: "hero" }, acceptedAtGameSecond: 0 }],
      aggregateWrites: [{ aggregateType: ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1, aggregateId, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: createActiveCampaignCharacterProfileV1({ campaignId, characterId: "hero", characterStateAggregateId: opaqueId<AggregateId>(`agg-character:${slug}`), tacticalProjectionAggregateId: opaqueId<AggregateId>(`agg-tactical:${slug}`), narrativeProjectionAggregateId: opaqueId<AggregateId>(`agg-narrative:${slug}`), positionAggregateId: opaqueId<AggregateId>(`agg-position:${slug}`), contentPackageId: "content.social-access", contentPackageVersion: 1, rulesetId: "rules.social-access", rulesetVersion: 1, sourceFingerprint: `sha256:${"2".repeat(64)}` }) }],
      events: [{ schemaVersion: 1, eventId: opaqueId<EventId>(`${operation.operationId}:event`), campaignId, operationId: ready.operationId, eventType: "campaign.active-character-profile.bootstrapped", origin: "SYSTEM", causation: { kind: "COMMAND", id: commandId }, aggregateRefs: [{ aggregateType: ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1, aggregateId, aggregateRevision: 0 }], visibility: { scope: "SYSTEM", actorIds: [] }, occurredAtGameSecond: 0, payloadSchemaVersion: 1, payload: { actorId: "hero" } }], outboxTasks: []
    }));
    expectOk(await repository.completePresentation(ready.operationId, "COMMITTED_RENDERED", 1, { bootstrapped: true }));
  } finally {
    expectOk(await repository.releaseWriterLease(lease));
  }
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKey} ${JSON.stringify(result.error.details)}`);
  return result.value;
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
