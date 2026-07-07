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
  enhanceNarrativeDisplayWithAiV1
} from "../../src/application";
import {
  FakeContractAiProviderV1
} from "../../src/ai/FakeContractAiProvider";
import type {
  AiModelRouteV1,
  AiRetryPolicyV1
} from "../../src/ai/types";

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
  outputTokenLimit: 1_000,
  timeoutMs: 1_000,
  fallbackRouteIds: []
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
  role: "player_expression_adapter" | "scene_writer";
  attemptSuffix: "expression" | "scene-writer";
  payload: unknown;
}) {
  return {
    schemaVersion: 1,
    contractVersion: "narrative-ai-resolution/1",
    outputId: `output:${input.operationId}:${input.attemptSuffix}`,
    callId: `${input.operationId}:ai:${input.attemptSuffix}:call`,
    attemptId: `${input.operationId}:ai:${input.attemptSuffix}:attempt:1`,
    packId: `${input.operationId}:pack:${input.attemptSuffix}`,
    snapshotId: `${input.operationId}:snapshot:display`,
    role: input.role,
    status: "OK",
    payload: input.payload,
    diagnostics: [],
    supersedesOutputId: null
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
  const speechProvider = new FakeContractAiProviderV1([
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
          groundedIn: [`resolution:${speech.value.output.resolution.resolutionId}`],
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
    config: { provider: speechProvider, expressionRoute, sceneWriterRoute, retryPolicy }
  });
  assert.equal(speechEnhanced.enhanced, true);
  assert.equal(speechEnhanced.usedFallback, false);
  assert.equal(speech.value.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.match(speechEnhanced.displayPacket.displayBlocks.find(block => block.kind === "PLAYER_EXPRESSION")?.text ?? "", /voix posée/);
  assert.equal(speechEnhanced.displayPacket.displayBlocks.some(block => block.kind === "GM_NARRATION"), true);

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
  assert.equal(unsafe.incidents.length, 1);
  assert.deepEqual(unsafe.displayPacket, speech.value.output.displayPacket);

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
  const weatherEnhanced = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: weather.value.operation.operationId,
    displayPacket: weather.value.output.displayPacket,
    resolution: weather.value.output.resolution,
    config: {
      provider: new FakeContractAiProviderV1(),
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(weatherEnhanced.enhanced, false);
  assert.equal(weatherEnhanced.usedFallback, false);
  assert.equal(weatherEnhanced.incidents.length, 0);
  assert.deepEqual(weatherEnhanced.displayPacket, weather.value.output.displayPacket);
  assert.equal(weatherEnhanced.displayPacket.displayBlocks.some(block => block.kind === "GM_NARRATION"), false);
  assert.equal(weatherEnhanced.safetyNotes.some(note => /Scene writer non appelé/u.test(note)), true);

  const location = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-ai-location-meta",
    rawInput: "ok, peut tu me dire ou je me situe ?"
  });
  if (!location.ok) throw new Error(location.error.messageKey);
  assert.equal(location.value.output.resolution.resultKind, "NO_COMMIT_RESPONSE");
  const locationEnhanced = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: location.value.operation.operationId,
    displayPacket: location.value.output.displayPacket,
    resolution: location.value.output.resolution,
    config: {
      provider: new FakeContractAiProviderV1(),
      expressionRoute,
      sceneWriterRoute,
      retryPolicy
    }
  });
  assert.equal(locationEnhanced.enhanced, false);
  assert.equal(locationEnhanced.usedFallback, false);
  assert.equal(locationEnhanced.incidents.length, 0);
  assert.deepEqual(locationEnhanced.displayPacket, location.value.output.displayPacket);
  assert.equal(locationEnhanced.displayPacket.displayBlocks.some(block => block.kind === "GM_NARRATION"), false);

  console.log("narrative-ai-resolution/1: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
