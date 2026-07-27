import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type RepositoryClock
} from "../../src/core";
import {
  NarrativeTurnControllerV1,
  buildNarrativeRenderAuthorityV1,
  enhanceNarrativeDisplayWithAiV1,
  requiresNarrativeCoherenceCriticV1,
  type NarrativeRenderAuthorityV1
} from "../../src/application";
import {
  FakeContractAiProviderV1
} from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiModelRouteV1,
  AiRetryPolicyV1
} from "../../src/ai/types";
import type { RoleContextPackV1 } from "../../src/context";

class RecordingProvider extends FakeContractAiProviderV1 {
  readonly requests: AiCallRequestV1[] = [];

  override async generate(request: AiCallRequestV1): Promise<unknown> {
    this.requests.push(request);
    return super.generate(request);
  }
}

class FixedClock implements RepositoryClock {
  constructor(private readonly instant = new Date("2026-07-07T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.instant);
  }
}

const expressionRoute: AiModelRouteV1 = {
  schemaVersion: 1,
  routeId: "route-ai-expression-i06g",
  role: "player_expression_adapter",
  providerKind: "FAKE_CONTRACT",
  providerId: "fake",
  modelId: "fake-expression",
  modelConfigVersion: "i06g",
  certified: true,
  allowedContractVersions: ["narrative-ai-resolution/1"],
  inputTokenLimit: 2_000,
  outputTokenLimit: 1_000,
  timeoutMs: 1_000,
  fallbackRouteIds: []
};

const sceneWriterRoute: AiModelRouteV1 = {
  schemaVersion: 1,
  routeId: "route-ai-scene-writer-i06g",
  role: "scene_writer",
  providerKind: "FAKE_CONTRACT",
  providerId: "fake",
  modelId: "fake-scene-writer",
  modelConfigVersion: "i06g",
  certified: true,
  allowedContractVersions: ["narrative-ai-resolution/1"],
  inputTokenLimit: 2_000,
  outputTokenLimit: 1_500,
  timeoutMs: 1_000,
  fallbackRouteIds: []
};

const coherenceCriticRoute: AiModelRouteV1 = {
  ...sceneWriterRoute,
  routeId: "route-ai-coherence-critic-i06g",
  role: "coherence_critic",
  modelId: "fake-coherence-critic"
};

const retryPolicy: AiRetryPolicyV1 = {
  schemaVersion: 1,
  role: "scene_writer",
  maxTechnicalRetries: 0,
  maxTargetedCorrections: 0,
  maxFullRegenerations: 0,
  allowFallback: false
};

async function setup() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-ai-enhancement-test");
  const clockAggregateId = opaqueId<AggregateId>("agg-ai-enhancement-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);
  return {
    campaignId,
    controller: new NarrativeTurnControllerV1({ repository, campaignId, clock, idPrefix: "ai" })
  };
}

function envelope(input: {
  operationId: string;
  role: "player_expression_adapter" | "scene_writer" | "coherence_critic";
  attemptSuffix: "expression" | "expression-critic" | "scene-writer" | "coherence-critic";
  payload: unknown;
}) {
  return {
    schemaVersion: 1,
    contractVersion: "narrative-ai-resolution/1",
    outputId: `output:${input.operationId}:${input.attemptSuffix}`,
    callId: `${input.operationId}:ai:${input.attemptSuffix}:call`,
    attemptId: `${input.operationId}:ai:${input.attemptSuffix}:attempt:1`,
    packId: input.attemptSuffix === "coherence-critic"
      ? `${input.operationId}:pack:scene-writer:critic`
      : input.attemptSuffix === "expression-critic"
        ? `${input.operationId}:pack:expression:critic`
      : `${input.operationId}:pack:${input.attemptSuffix}`,
    snapshotId: `${input.operationId}:snapshot:display`,
    role: input.role,
    status: "OK",
    payload: input.payload,
    diagnostics: [],
    supersedesOutputId: null
  };
}

function factDiscipline(overrides: Partial<{
  addedUnsupportedFacts: string[];
  usesOnlyProvidedVisibleEntities: boolean;
  noNewEvents: boolean;
  noHiddenPresence: boolean;
  notes: string[];
}> = {}) {
  return {
    addedUnsupportedFacts: [],
    usesOnlyProvidedVisibleEntities: true,
    noNewEvents: true,
    noHiddenPresence: true,
    notes: [],
    ...overrides
  };
}

async function main(): Promise<void> {
  const { campaignId, controller } = await setup();

  const speech = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-ai-speech",
    rawInput: "Je dis au garde que je cherche les archives"
  });
  if (!speech.ok) throw new Error(speech.error.messageKey);
  assert.equal(speech.value.output.resolution.resultKind, "COMMIT_APPLIED");
  const speechOp = speech.value.operation.operationId;
  const speechProvider = new RecordingProvider([
    [`${speechOp}:ai:expression:attempt:1`, envelope({
      operationId: speechOp,
      role: "player_expression_adapter",
      attemptSuffix: "expression",
      payload: {
        intentId: speech.value.output.interpretation.intentId,
        expressionKind: "speech",
        renderedExpression: "D'une voix posée, je précise au garde que je cherche les archives.",
        meaningCovered: ["chercher les archives"],
        addedMeaning: [],
        omittedMeaning: [],
        styleChoices: ["ton calme", "registre clair"],
        safeToUse: true
      }
    })],
    [`${speechOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: speechOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "speech-texture",
          blockKind: "MJ_NARRATION",
          content: "Le murmure de la salle retombe un instant autour de cette demande, assez pour que le garde mesure le sérieux de votre démarche.",
          groundedIn: [
            `resolution:${speech.value.output.resolution.resolutionId}`,
            "reference-scene:reference-inn-rain-001"
          ],
          usesCreativeTexture: true
        }]
      }
    })]
  ]);
  const speechEnhanced = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: speechOp,
    displayPacket: speech.value.output.displayPacket,
    resolution: speech.value.output.resolution,
    sceneState: speech.value.output.sceneState,
    config: { provider: speechProvider, expressionRoute, sceneWriterRoute, retryPolicy }
  });
  assert.equal(speechEnhanced.enhanced, true);
  assert.equal(speechEnhanced.usedFallback, false);
  assert.equal(speech.value.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.match(speechEnhanced.displayPacket.displayBlocks.find(block => block.kind === "PLAYER_EXPRESSION")?.text ?? "", /voix posée/);
  assert.match(
    speechProvider.requests.find(request => request.role === "player_expression_adapter")?.contextFingerprint ?? "",
    /^sha256:[0-9a-f]{64}$/u,
    "player_expression_adapter doit envoyer une empreinte SHA-256 réelle à la route serveur"
  );
  assert.equal(speechEnhanced.displayPacket.displayBlocks.some(block => block.kind === "GM_NARRATION"), false, "une réplique PNJ ne doit pas être doublée par une narration MJ");
  assert.equal(speechEnhanced.displayPacket.displayBlocks.at(-1)?.kind, "SYSTEM_NOTICE", "la notification système reste le dernier bloc après la narration finale");
  const sceneWriterRequest = speechProvider.requests.find(request => request.role === "scene_writer");
  assert.equal(sceneWriterRequest, undefined, "la réponse PNJ constitue déjà le rendu narratif du tour");
  const speechKinds = speechEnhanced.displayPacket.displayBlocks.map(block => block.kind);
  assert.ok(speechKinds.indexOf("PLAYER_EXPRESSION") < speechKinds.indexOf("NPC_SPEECH"));
  assert.ok(speechKinds.indexOf("NPC_SPEECH") < speechKinds.indexOf("SYSTEM_NOTICE"));

  const unsafeProvider = new FakeContractAiProviderV1([
    [`${speechOp}:ai:expression:attempt:1`, envelope({
      operationId: speechOp,
      role: "player_expression_adapter",
      attemptSuffix: "expression",
      payload: {
        intentId: speech.value.output.interpretation.intentId,
        expressionKind: "speech",
        renderedExpression: "Je promets au garde de lui devoir un service si je peux entrer.",
        meaningCovered: ["chercher les archives"],
        addedMeaning: ["promesse de service"],
        omittedMeaning: [],
        styleChoices: ["négociation"],
        safeToUse: true
      }
    })],
    [`${speechOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: speechOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "invalid-success",
          blockKind: "MJ_NARRATION",
          content: "Tu réussis immédiatement à convaincre le garde.",
          groundedIn: [`resolution:${speech.value.output.resolution.resolutionId}`],
          usesCreativeTexture: true
        }]
      }
    })]
  ]);
  const unsafe = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: speechOp,
    displayPacket: speech.value.output.displayPacket,
    resolution: speech.value.output.resolution,
    config: { provider: unsafeProvider, expressionRoute, sceneWriterRoute, retryPolicy }
  });
  assert.equal(unsafe.enhanced, false);
  assert.equal(unsafe.usedFallback, true);
  assert.equal(unsafe.fallbackKind, "TECHNICAL_INCIDENT");
  assert.equal(unsafe.incidents.length, 1);
  assert.deepEqual(unsafe.displayPacket, speech.value.output.displayPacket);

  const door = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-ai-door-staging",
    rawInput: "J'ouvre la porte du fond"
  });
  if (!door.ok) throw new Error(door.error.messageKey);
  assert.equal(door.value.output.resolution.preparedEffects.some(effect => effect.effectType === "LOCAL_SCENE_ACTION_RECORDED"), true);
  const doorAuthority = buildNarrativeRenderAuthorityV1(door.value.output.resolution, door.value.output.displayPacket);
  assert.equal(doorAuthority.mode, "ACTION_STAGING_ONLY");
  assert.equal(requiresNarrativeCoherenceCriticV1(doorAuthority), true, "une manipulation d'objet conserve le critique sémantique");
  assert.equal(requiresNarrativeCoherenceCriticV1({
    ...doorAuthority,
    targetRef: "npc:archiviste-visible"
  }), false, "un simple positionnement réversible près d'un acteur visible suit le parcours court");
  assert.equal(requiresNarrativeCoherenceCriticV1({
    ...doorAuthority,
    mode: "OBSERVATION_RESULT",
    targetRef: null
  }), false, "une perception générale bornée suit le parcours court");
  assert.equal(doorAuthority.unconfirmedClaims.some(claim => /modification/u.test(claim)), true);
  assert.equal(doorAuthority.renderPlanVersion, "narrative-render-plan/1");
  assert.equal(doorAuthority.perspective, "SECOND_PERSON_PLAYER");
  assert.equal(doorAuthority.allowedClaims.every(claim => claim.sourceRefs.length > 0), true);
  assert.equal(doorAuthority.texturePolicy.lifetime, "TURN_ONLY");
  assert.equal(doorAuthority.texturePolicy.reusableAsFact, false);
  assert.equal(doorAuthority.texturePolicy.persistToMemory, false);
  assert.equal(doorAuthority.texturePolicy.forbiddenUses.some(rule => /État mécanique/u.test(rule)), true);
  assert.deepEqual(doorAuthority.allowedActorReactionRefs, []);
  const doorOp = door.value.operation.operationId;
  const unsafeDoorProvider = new RecordingProvider([
    [`${doorOp}:ai:expression:attempt:1`, envelope({
      operationId: doorOp,
      role: "player_expression_adapter",
      attemptSuffix: "expression",
      payload: {
        intentId: door.value.output.interpretation.intentId,
        expressionKind: "action_staging",
        renderedExpression: "Je saisis la poignée et tente d'ouvrir la porte du fond.",
        meaningCovered: ["ouvrir la porte du fond"],
        addedMeaning: [],
        omittedMeaning: [],
        styleChoices: ["geste précis"],
        safeToUse: true
      }
    })],
    [`${doorOp}:ai:expression-critic:attempt:1`, envelope({
      operationId: doorOp,
      role: "coherence_critic",
      attemptSuffix: "expression-critic",
      payload: {
        verdict: "PASS",
        findings: [],
        correctionConstraints: []
      }
    })],
    [`${doorOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: doorOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "door-unsupported-outcome",
          blockKind: "MJ_NARRATION",
          content: "La porte s'ouvre et révèle une pièce sombre; la serveuse recule aussitôt.",
          groundedIn: [`resolution:${door.value.output.resolution.resolutionId}`],
          usesCreativeTexture: true,
          factDiscipline: factDiscipline()
        }]
      }
    })],
    [`${doorOp}:ai:coherence-critic:attempt:1`, envelope({
      operationId: doorOp,
      role: "coherence_critic",
      attemptSuffix: "coherence-critic",
      payload: {
        verdict: "REJECT",
        findings: [{
          findingId: "door-outcome-without-authority",
          severity: "BLOCKING",
          category: "AUTHORITY",
          affectedRefs: [doorAuthority.targetRef ?? "door"],
          explanation: "Le texte transforme une tentative locale en ouverture, révélation et réaction confirmées."
        }],
        correctionConstraints: ["Ne décrire que l'engagement du geste."]
      }
    })]
  ]);
  const unsafeDoor = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: doorOp,
    displayPacket: door.value.output.displayPacket,
    resolution: door.value.output.resolution,
    sceneState: door.value.output.sceneState,
    config: { provider: unsafeDoorProvider, expressionRoute, sceneWriterRoute, coherenceCriticRoute, retryPolicy }
  });
  assert.equal(unsafeDoor.usedFallback, true);
  assert.equal(unsafeDoor.fallbackKind, "RENDER_AUTHORITY_REJECTION");
  assert.equal(unsafeDoorProvider.requests.some(request => request.role === "coherence_critic"), true);
  assert.equal(unsafeDoor.displayPacket.displayBlocks.some(block => /révèle une pièce|serveuse recule/u.test(block.text)), false);
  assert.equal(unsafeDoor.displayPacket.displayBlocks.some(block => block.kind === "GM_NARRATION" && /commences à faire jouer le mécanisme/u.test(block.text)), true);
  const criticRequest = unsafeDoorProvider.requests.find(request => request.attemptId.endsWith(":coherence-critic:attempt:1"));
  assert.equal((criticRequest?.input.task as { renderAuthority: { mode: string } }).renderAuthority.mode, "ACTION_STAGING_ONLY");

  const unsafeExpressionProvider = new RecordingProvider([
    [`${doorOp}:ai:expression:attempt:1`, envelope({
      operationId: doorOp,
      role: "player_expression_adapter",
      attemptSuffix: "expression",
      payload: {
        intentId: door.value.output.interpretation.intentId,
        expressionKind: "action_staging",
        renderedExpression: "Je déverrouille et ouvre la porte du fond.",
        meaningCovered: ["ouvrir la porte du fond"],
        addedMeaning: [],
        omittedMeaning: [],
        styleChoices: ["geste précis"],
        safeToUse: true
      }
    })],
    [`${doorOp}:ai:expression-critic:attempt:1`, envelope({
      operationId: doorOp,
      role: "coherence_critic",
      attemptSuffix: "expression-critic",
      payload: {
        verdict: "REJECT",
        findings: [{
          findingId: "expression-adds-unlock-and-outcome",
          severity: "BLOCKING",
          category: "PLAYER_AGENCY",
          affectedRefs: [doorAuthority.targetRef ?? "door"],
          explanation: "La reformulation ajoute le déverrouillage et présente l'ouverture comme accomplie."
        }],
        correctionConstraints: ["Conserver la formulation déterministe du joueur."]
      }
    })],
    [`${doorOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: doorOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: { narrationBlocks: [] }
    })]
  ]);
  const unsafeExpression = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: doorOp,
    displayPacket: door.value.output.displayPacket,
    resolution: door.value.output.resolution,
    sceneState: door.value.output.sceneState,
    config: { provider: unsafeExpressionProvider, expressionRoute, sceneWriterRoute, coherenceCriticRoute, retryPolicy }
  });
  assert.equal(unsafeExpression.fallbackKind, "RENDER_AUTHORITY_REJECTION");
  assert.equal(unsafeExpression.incidents.length, 0);
  assert.equal(unsafeExpression.displayPacket.displayBlocks.some(block => /déverrouille/u.test(block.text)), false);
  assert.equal(
    unsafeExpression.displayPacket.displayBlocks.find(block => block.kind === "PLAYER_EXPRESSION")?.text,
    door.value.output.displayPacket.displayBlocks.find(block => block.kind === "PLAYER_EXPRESSION")?.text
  );
  const expressionCriticRequest = unsafeExpressionProvider.requests.find(request => request.attemptId.endsWith(":expression-critic:attempt:1"));
  assert.equal((expressionCriticRequest?.input.task as { renderAuthority: { mode: string } }).renderAuthority.mode, "PLAYER_EXPRESSION_FIDELITY");

  const focusedDoor = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-ai-door-focused-adversarial",
    rawInput: "J'observe plus attentivement la porte du fond"
  });
  if (!focusedDoor.ok) throw new Error(focusedDoor.error.messageKey);
  assert.deepEqual(focusedDoor.value.output.resolution.perception?.revealedClueRefs, ["door-immediate-signs"]);
  const focusedDoorOp = focusedDoor.value.operation.operationId;
  const focusedDoorAuthority = buildNarrativeRenderAuthorityV1(focusedDoor.value.output.resolution, focusedDoor.value.output.displayPacket);
  const mechanicalTextureProvider = new RecordingProvider([
    [`${focusedDoorOp}:ai:expression:attempt:1`, envelope({
      operationId: focusedDoorOp,
      role: "player_expression_adapter",
      attemptSuffix: "expression",
      payload: {
        intentId: focusedDoor.value.output.interpretation.intentId,
        expressionKind: "observation",
        renderedExpression: "J'observe plus attentivement la porte du fond.",
        meaningCovered: ["observer plus attentivement la porte du fond"],
        addedMeaning: [],
        omittedMeaning: [],
        styleChoices: [],
        safeToUse: true
      }
    })],
    [`${focusedDoorOp}:ai:expression-critic:attempt:1`, envelope({
      operationId: focusedDoorOp,
      role: "coherence_critic",
      attemptSuffix: "expression-critic",
      payload: { verdict: "PASS", findings: [], correctionConstraints: [] }
    })],
    [`${focusedDoorOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: focusedDoorOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "door-false-mechanical-texture",
          blockKind: "MJ_NARRATION",
          content: "Tu distingues derrière la poignée des engrenages rouillés mais toujours fonctionnels.",
          groundedIn: [`resolution:${focusedDoor.value.output.resolution.resolutionId}`],
          usesCreativeTexture: true,
          factDiscipline: factDiscipline()
        }]
      }
    })],
    [`${focusedDoorOp}:ai:coherence-critic:attempt:1`, envelope({
      operationId: focusedDoorOp,
      role: "coherence_critic",
      attemptSuffix: "coherence-critic",
      payload: {
        verdict: "REJECT",
        findings: [{
          findingId: "mechanical-state-disguised-as-texture",
          severity: "BLOCKING",
          category: "AUTHORITY",
          affectedRefs: [focusedDoorAuthority.targetRef ?? "door"],
          explanation: "La rouille, les engrenages et leur fonctionnement sont des propriétés mécaniques absentes des affirmations autorisées."
        }],
        correctionConstraints: ["Conserver uniquement l'indice perceptif focalisé sourcé."]
      }
    })]
  ]);
  const mechanicalTexture = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: focusedDoorOp,
    displayPacket: focusedDoor.value.output.displayPacket,
    resolution: focusedDoor.value.output.resolution,
    sceneState: focusedDoor.value.output.sceneState,
    config: { provider: mechanicalTextureProvider, expressionRoute, sceneWriterRoute, coherenceCriticRoute, retryPolicy }
  });
  assert.equal(mechanicalTexture.fallbackKind, "RENDER_AUTHORITY_REJECTION");
  assert.equal(mechanicalTexture.displayPacket.displayBlocks.some(block => /engrenages rouillés|toujours fonctionnels/iu.test(block.text)), false);
  assert.equal(mechanicalTexture.displayPacket.displayBlocks.some(block => /rien.*permet.*établir|mécanisme cédera/iu.test(block.text)), true);
  const mechanicalCriticRequest = mechanicalTextureProvider.requests.find(request => request.attemptId.endsWith(":coherence-critic:attempt:1"));
  const mechanicalRenderPlan = (mechanicalCriticRequest?.input.task as { renderAuthority: NarrativeRenderAuthorityV1 }).renderAuthority;
  assert.equal(mechanicalRenderPlan.texturePolicy.mayAffectRules, false);
  assert.equal(mechanicalRenderPlan.allowedClaims.some(claim => /engrenages|rouill/iu.test(claim.text)), false);

  const attack = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-ai-attack",
    rawInput: "J'attaque le garde"
  });
  if (!attack.ok) throw new Error(attack.error.messageKey);
  assert.equal(attack.value.output.resolution.resultKind, "HANDOFF_REQUIRED");
  const attackOp = attack.value.operation.operationId;
  const attackProvider = new FakeContractAiProviderV1([
    [`${attackOp}:ai:expression:attempt:1`, envelope({
      operationId: attackOp,
      role: "player_expression_adapter",
      attemptSuffix: "expression",
      payload: {
        intentId: attack.value.output.interpretation.intentId,
        expressionKind: "action_staging",
        renderedExpression: "Je me tends brusquement, prêt à engager le garde.",
        meaningCovered: ["attaque le garde"],
        addedMeaning: [],
        omittedMeaning: [],
        styleChoices: ["tension physique"],
        safeToUse: true
      }
    })],
    [`${attackOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: attackOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "handoff-tactical-texture",
          blockKind: "MJ_NARRATION",
          content: "La tension casse net. Le garde resserre sa prise sur son arme; la scène réclame maintenant une résolution tactique.",
          groundedIn: [`resolution:${attack.value.output.resolution.resolutionId}`],
          usesCreativeTexture: true
        }]
      }
    })]
  ]);
  const attackEnhanced = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: attackOp,
    displayPacket: attack.value.output.displayPacket,
    resolution: attack.value.output.resolution,
    config: { provider: attackProvider, expressionRoute, sceneWriterRoute, retryPolicy }
  });
  assert.equal(attackEnhanced.enhanced, true);
  assert.equal(attack.value.output.resolution.resultKind, "HANDOFF_REQUIRED");
  assert.equal(attack.value.output.resolution.handoff?.target, "TACTICAL");
  assert.equal(attack.value.operation.commitId, null);
  assert.equal(attackEnhanced.displayPacket.displayBlocks.some(block => /résolution tactique/u.test(block.text)), true);
  assert.equal(attackEnhanced.displayPacket.displayBlocks.some(block => /réussis|mort|combat terminé/iu.test(block.text)), false);

  const weather = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-ai-weather-meta",
    rawInput: "quelle temps fait il ?"
  });
  if (!weather.ok) throw new Error(weather.error.messageKey);
  assert.equal(weather.value.output.resolution.resultKind, "NO_COMMIT_RESPONSE");
  const weatherOp = weather.value.operation.operationId;
  const weatherProvider = new RecordingProvider([
    [`${weatherOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: weatherOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "weather-context",
          blockKind: "MJ_NARRATION",
          content: "La pluie bat toujours les volets de l'Auberge du Seuil; elle brouille les voix dehors sans changer l'attente tendue dans la salle.",
          groundedIn: [
            `resolution:${weather.value.output.resolution.resolutionId}`,
            "reference-scene:reference-inn-rain-001",
            "scene-weather-visible"
          ],
          usesCreativeTexture: true
        }]
      }
    })]
  ]);
  const weatherEnhanced = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: weatherOp,
    displayPacket: weather.value.output.displayPacket,
    resolution: weather.value.output.resolution,
    sceneState: weather.value.output.sceneState,
    config: {
      provider: weatherProvider,
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(weatherEnhanced.enhanced, true);
  assert.equal(weatherEnhanced.usedFallback, false);
  assert.equal(weatherEnhanced.incidents.length, 0);
  assert.equal(weather.value.output.resolution.noGameTime, true);
  assert.equal(weather.value.operation.commitId, null);
  assert.equal(weatherProvider.requests.some(request => request.role === "scene_writer"), true, "scene_writer doit enrichir les questions de contexte no-commit");
  const weatherAiNarrations = weatherEnhanced.displayPacket.displayBlocks.filter(block =>
    block.kind === "GM_NARRATION" &&
    block.sourceRefs.some(ref => ref.startsWith("ai-output:"))
  );
  assert.equal(weatherAiNarrations.length, 1, "la narration IA remplace le bloc MJ local au lieu de dupliquer la réponse");
  assert.match(weatherAiNarrations[0]?.text ?? "", /pluie bat toujours les volets/u);

  const invalidGroundingWeatherProvider = new RecordingProvider([
    [`${weatherOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: weatherOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "weather-context-invalid-grounding",
          blockKind: "MJ_NARRATION",
          content: "La pluie continue contre les volets.",
          groundedIn: ["scene-weather-visible"],
          usesCreativeTexture: true
        }]
      }
    })]
  ]);
  const invalidGroundingWeather = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: weatherOp,
    displayPacket: weather.value.output.displayPacket,
    resolution: weather.value.output.resolution,
    sceneState: weather.value.output.sceneState,
    config: {
      provider: invalidGroundingWeatherProvider,
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(invalidGroundingWeather.enhanced, false);
  assert.equal(invalidGroundingWeather.safetyNotes.some(note => /grounding_missing_allowed_ref/u.test(note)), true);

  const dynamicEventWeatherProvider = new RecordingProvider([
    [`${weatherOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: weatherOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "weather-unsourced-door",
          blockKind: "MJ_NARRATION",
          content: "La pluie bat les volets; chaque fois que la porte d'entrée s'ouvre, un souffle froid traverse la salle.",
          groundedIn: [
            `resolution:${weather.value.output.resolution.resolutionId}`,
            "reference-scene:reference-inn-rain-001"
          ],
          usesCreativeTexture: true,
          factDiscipline: factDiscipline({
            addedUnsupportedFacts: ["la porte d'entrée s'ouvre"],
            noNewEvents: false,
            notes: ["événement dynamique non fourni par la scène"]
          })
        }]
      }
    })]
  ]);
  const dynamicEventWeather = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: weatherOp,
    displayPacket: weather.value.output.displayPacket,
    resolution: weather.value.output.resolution,
    sceneState: weather.value.output.sceneState,
    config: {
      provider: dynamicEventWeatherProvider,
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(dynamicEventWeather.enhanced, false);
  assert.equal(dynamicEventWeather.safetyNotes.some(note => /fact_discipline_new_event/u.test(note)), true);

  const liveDynamicEventWeatherProvider = new RecordingProvider([
    [`${weatherOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: weatherOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "weather-live-unsourced-door",
          blockKind: "MJ_NARRATION",
          content: "À travers les volets, le tambourinement régulier de la pluie s'intensifie, martelant le toit et les fenêtres avec une insistance presque oppressante. L'air froid envahit légèrement la pièce chaque fois que la porte d'entrée s'ouvre dans un grincement, offrant une brève exposition humide au vent chargé d'eau.",
          groundedIn: [
            `resolution:${weather.value.output.resolution.resolutionId}`,
            "reference-scene:reference-inn-rain-001"
          ],
          usesCreativeTexture: true,
          factDiscipline: factDiscipline({
            addedUnsupportedFacts: ["la porte d'entrée s'ouvre dans un grincement"],
            noNewEvents: false,
            notes: ["formulation observée en test live, rejetée par discipline factuelle"]
          })
        }]
      }
    })]
  ]);
  const liveDynamicEventWeather = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: weatherOp,
    displayPacket: weather.value.output.displayPacket,
    resolution: weather.value.output.resolution,
    sceneState: weather.value.output.sceneState,
    config: {
      provider: liveDynamicEventWeatherProvider,
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(liveDynamicEventWeather.enhanced, false);
  assert.equal(liveDynamicEventWeather.safetyNotes.some(note => /fact_discipline_new_event/u.test(note)), true);

  const hiddenPeopleProvider = new RecordingProvider([
    [`${weatherOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: weatherOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "people-hidden",
          blockKind: "MJ_NARRATION",
          content: "Le garde blessé et la serveuse sont visibles, tandis que d'autres occupants restent discrètement dissimulés dans la pièce.",
          groundedIn: [
            `resolution:${weather.value.output.resolution.resolutionId}`,
            "reference-scene:reference-inn-rain-001"
          ],
          usesCreativeTexture: true,
          factDiscipline: factDiscipline({
            addedUnsupportedFacts: ["autres occupants dissimulés"],
            usesOnlyProvidedVisibleEntities: false,
            noHiddenPresence: false,
            notes: ["présence non fournie par la scène"]
          })
        }]
      }
    })]
  ]);
  const hiddenPeople = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: weatherOp,
    displayPacket: weather.value.output.displayPacket,
    resolution: weather.value.output.resolution,
    sceneState: weather.value.output.sceneState,
    config: {
      provider: hiddenPeopleProvider,
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(hiddenPeople.enhanced, false);
  assert.equal(hiddenPeople.safetyNotes.some(note => /fact_discipline_hidden_presence/u.test(note)), true);

  const liveHiddenPeopleProvider = new RecordingProvider([
    [`${weatherOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: weatherOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "people-live-hidden",
          blockKind: "MJ_NARRATION",
          content: "Le bruit régulier de la pluie qui martèle les volets crée une toile de fond constante, masquant presque les murmures étouffés et les soupirs contenus des autres occupants, absents de la pièce ou discrètement dissimulés.",
          groundedIn: [
            `resolution:${weather.value.output.resolution.resolutionId}`,
            "reference-scene:reference-inn-rain-001"
          ],
          usesCreativeTexture: true,
          factDiscipline: factDiscipline({
            addedUnsupportedFacts: ["autres occupants absents ou discrètement dissimulés"],
            usesOnlyProvidedVisibleEntities: false,
            noHiddenPresence: false,
            notes: ["formulation observée en test live, rejetée par discipline factuelle"]
          })
        }]
      }
    })]
  ]);
  const liveHiddenPeople = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: weatherOp,
    displayPacket: weather.value.output.displayPacket,
    resolution: weather.value.output.resolution,
    sceneState: weather.value.output.sceneState,
    config: {
      provider: liveHiddenPeopleProvider,
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(liveHiddenPeople.enhanced, false);
  assert.equal(liveHiddenPeople.safetyNotes.some(note => /fact_discipline_hidden_presence/u.test(note)), true);

  const unsupportedCrowdProvider = new RecordingProvider([
    [`${weatherOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: weatherOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "weather-unsupported-crowd",
          blockKind: "MJ_NARRATION",
          content: "La pluie assombrit les vitres tandis que le murmure discret des convives accompagne l'attente.",
          groundedIn: [
            `resolution:${weather.value.output.resolution.resolutionId}`,
            "reference-scene:reference-inn-rain-001"
          ],
          usesCreativeTexture: true,
          factDiscipline: factDiscipline({
            addedUnsupportedFacts: ["convives non fournis dans la scène"],
            usesOnlyProvidedVisibleEntities: false,
            notes: ["groupe visible non fourni"]
          })
        }]
      }
    })]
  ]);
  const unsupportedCrowd = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: weatherOp,
    displayPacket: weather.value.output.displayPacket,
    resolution: weather.value.output.resolution,
    sceneState: weather.value.output.sceneState,
    config: {
      provider: unsupportedCrowdProvider,
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(unsupportedCrowd.enhanced, false);
  assert.equal(unsupportedCrowd.safetyNotes.some(note => /fact_discipline_added_unsupported_facts/u.test(note)), true);

  const unusableWeatherProvider = new RecordingProvider([
    [`${weatherOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: weatherOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "weather-system-notice",
          blockKind: "SYSTEM_NOTICE",
          content: "Cette réponse ne fait pas avancer le temps.",
          groundedIn: [
            `resolution:${weather.value.output.resolution.resolutionId}`,
            "reference-scene:reference-inn-rain-001"
          ],
          usesCreativeTexture: false
        }]
      }
    })]
  ]);
  const unusableWeather = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: weatherOp,
    displayPacket: weather.value.output.displayPacket,
    resolution: weather.value.output.resolution,
    sceneState: weather.value.output.sceneState,
    config: {
      provider: unusableWeatherProvider,
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(unusableWeatherProvider.requests.some(request => request.role === "scene_writer"), true);
  assert.equal(unusableWeather.enhanced, false);
  assert.equal(unusableWeather.usedFallback, false);
  assert.equal(unusableWeather.safetyNotes.some(note => /aucun bloc MJ utilisable/u.test(note)), true);
  assert.deepEqual(unusableWeather.displayPacket, weather.value.output.displayPacket);

  const location = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-ai-location-meta",
    rawInput: "ok, peut tu me dire ou je me situe ?"
  });
  if (!location.ok) throw new Error(location.error.messageKey);
  assert.equal(location.value.output.resolution.resultKind, "NO_COMMIT_RESPONSE");
  const locationOp = location.value.operation.operationId;
  const locationProvider = new RecordingProvider([
    [`${locationOp}:ai:scene-writer:attempt:1`, envelope({
      operationId: locationOp,
      role: "scene_writer",
      attemptSuffix: "scene-writer",
      payload: {
        narrationBlocks: [{
          slotId: "location-context",
          blockKind: "MJ_NARRATION",
          content: "Tu te trouves dans la salle commune de l'Auberge du Seuil, près du garde blessé et de la porte du fond qui attire les silences.",
          groundedIn: [
            `resolution:${location.value.output.resolution.resolutionId}`,
            "reference-scene:reference-inn-rain-001"
          ],
          usesCreativeTexture: true
        }]
      }
    })]
  ]);
  const locationEnhanced = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: locationOp,
    displayPacket: location.value.output.displayPacket,
    priorDisplayPackets: [weatherEnhanced.displayPacket],
    resolution: location.value.output.resolution,
    sceneState: location.value.output.sceneState,
    config: {
      provider: locationProvider,
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(locationEnhanced.enhanced, true);
  assert.equal(locationEnhanced.usedFallback, false);
  assert.equal(locationEnhanced.incidents.length, 0);
  const locationRequest = locationProvider.requests.find(request => request.role === "scene_writer");
  assert.ok(locationRequest, "scene_writer doit recevoir la question de localisation no-commit");
  assert.equal((locationRequest.input.roleContextPack as RoleContextPackV1).blocks.some(block =>
    block.blockKind === "MEMORY_CAPSULE" &&
    /Historique visible court/u.test(block.text) &&
    /pluie bat toujours les volets/u.test(block.text)
  ), true, "le paquet scene_writer doit contenir un historique visible court borné");
  assert.equal(location.value.operation.commitId, null);
  assert.equal(location.value.output.resolution.noGameTime, true);
  assert.equal(locationEnhanced.displayPacket.displayBlocks.filter(block =>
    block.kind === "GM_NARRATION" &&
    block.sourceRefs.some(ref => ref.startsWith("ai-output:"))
  ).length, 1);

  const possibility = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-ai-possibility-no-commit",
    rawInput: "est-ce que je peux voler la bourse du garde ?"
  });
  if (!possibility.ok) throw new Error(possibility.error.messageKey);
  assert.equal(possibility.value.output.resolution.resultKind, "NO_COMMIT_RESPONSE");
  const possibilityProvider = new RecordingProvider();
  const possibilityEnhanced = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: possibility.value.operation.operationId,
    displayPacket: possibility.value.output.displayPacket,
    resolution: possibility.value.output.resolution,
    sceneState: possibility.value.output.sceneState,
    config: {
      provider: possibilityProvider,
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(possibilityEnhanced.enhanced, false);
  assert.equal(possibilityProvider.requests.some(request => request.role === "scene_writer"), false, "une possibilité risquée no-commit ne doit pas appeler scene_writer");

  console.log("narrative-ai-resolution/1: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
