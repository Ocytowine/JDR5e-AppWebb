import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRecord,
  type RepositoryClock
} from "../../src/core";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type { AiCallRequestV1, AiModelRouteV1, AiRetryPolicyV1 } from "../../src/ai/types";
import {
  enhanceNarrativeDisplayWithAiV1,
  NarrativeTurnControllerV1,
  type NarrativeTurnControllerOutputV1
} from "../../src/application";
import type { DisplayPacketV1 } from "../../src/scene";

class FixedClock implements RepositoryClock {
  constructor(private readonly instant = new Date("2026-07-07T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.instant);
  }
}

type QualityMode = "local" | "openai-compatible";

interface ScenarioInput {
  id: string;
  rawInput: string;
  expectation: {
    requiresAnchor: boolean;
    noFiction: boolean;
    noCommit: boolean;
    noGameTime: boolean;
    expectedIntent?: string;
  };
}

interface ScenarioTrace {
  id: string;
  rawInput: string;
  intentType: string;
  resultKind: string;
  noCommit: boolean;
  noGameTime: boolean;
  localEnhanced: boolean;
  openAiCompatibleEnhanced: boolean;
  localText: string;
  openAiCompatibleText: string;
}

const scenario: ScenarioInput[] = [{
  id: "i06q-01-location",
  rawInput: "Où sommes-nous exactement ?",
  expectation: {
    requiresAnchor: true,
    noFiction: false,
    noCommit: true,
    noGameTime: true,
    expectedIntent: "meta_question"
  }
}, {
  id: "i06q-02-meta-rules",
  rawInput: "Pause : comment fonctionne cette scène côté règles ?",
  expectation: {
    requiresAnchor: false,
    noFiction: true,
    noCommit: true,
    noGameTime: true,
    expectedIntent: "meta_question"
  }
}, {
  id: "i06q-03-observe-room",
  rawInput: "Je regarde autour de moi.",
  expectation: {
    requiresAnchor: true,
    noFiction: false,
    noCommit: true,
    noGameTime: true,
    expectedIntent: "action"
  }
}, {
  id: "i06q-04-possibility-guard",
  rawInput: "Est-ce que je peux parler au garde ?",
  expectation: {
    requiresAnchor: true,
    noFiction: false,
    noCommit: true,
    noGameTime: true,
    expectedIntent: "possibility_query"
  }
}, {
  id: "i06q-05-speech-guard",
  rawInput: "Je demande au garde ce qui s'est passé.",
  expectation: {
    requiresAnchor: true,
    noFiction: false,
    noCommit: false,
    noGameTime: true,
    expectedIntent: "speech"
  }
}, {
  id: "i06q-06-repeat-guard",
  rawInput: "Je demande au garde de répéter plus clairement.",
  expectation: {
    requiresAnchor: true,
    noFiction: false,
    noCommit: false,
    noGameTime: true,
    expectedIntent: "speech"
  }
}, {
  id: "i06q-07-observe-door",
  rawInput: "J'observe la porte du fond.",
  expectation: {
    requiresAnchor: true,
    noFiction: false,
    noCommit: true,
    noGameTime: true,
    expectedIntent: "action"
  }
}, {
  id: "i06q-08-possibility-door",
  rawInput: "Puis-je ouvrir la porte sans attirer l'attention ?",
  expectation: {
    requiresAnchor: true,
    noFiction: false,
    noCommit: true,
    noGameTime: true,
    expectedIntent: "possibility_query"
  }
}, {
  id: "i06q-09-observe-weather",
  rawInput: "J'observe la pluie et les conversations.",
  expectation: {
    requiresAnchor: true,
    noFiction: false,
    noCommit: true,
    noGameTime: true,
    expectedIntent: "action"
  }
}, {
  id: "i06q-10-speech-waitress",
  rawInput: "Je demande à la serveuse pourquoi elle est nerveuse.",
  expectation: {
    requiresAnchor: true,
    noFiction: false,
    noCommit: false,
    noGameTime: true,
    expectedIntent: "speech"
  }
}, {
  id: "i06q-11-attempt-backroom",
  rawInput: "J'essaie d'entrer dans l'arrière-salle discrètement.",
  expectation: {
    requiresAnchor: true,
    noFiction: false,
    noCommit: true,
    noGameTime: true,
    expectedIntent: "action"
  }
}, {
  id: "i06q-12-ambiguous-theft",
  rawInput: "Lui voler quelque chose ?",
  expectation: {
    requiresAnchor: false,
    noFiction: false,
    noCommit: true,
    noGameTime: true,
    expectedIntent: "unclear_commitment"
  }
}];

async function main(): Promise<void> {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-i06q-vertical-quality");
  const clockAggregateId = opaqueId<AggregateId>("agg-i06q-clock");
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

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "i06q"
  });

  const traces: ScenarioTrace[] = [];
  const guardReplies: string[] = [];

  for (const entry of scenario) {
    const submitted = await controller.submit({
      schemaVersion: 1,
      clientRequestId: entry.id,
      rawInput: entry.rawInput
    });
    if (!submitted.ok) throw new Error(`${entry.id}: ${submitted.error.messageKey}`);

    const output = submitted.value.output;
    const localEnhancement = await enhance(output, campaignId, "local");
    const openAiCompatibleEnhancement = await enhance(output, campaignId, "openai-compatible");
    const localText = packetText(localEnhancement.displayPacket);
    const openAiCompatibleText = packetText(openAiCompatibleEnhancement.displayPacket);

    traces.push({
      id: entry.id,
      rawInput: entry.rawInput,
      intentType: output.interpretation.intentType,
      resultKind: output.resolution.resultKind,
      noCommit: output.noCommit,
      noGameTime: output.noGameTime,
      localEnhanced: localEnhancement.enhanced,
      openAiCompatibleEnhanced: openAiCompatibleEnhancement.enhanced,
      localText,
      openAiCompatibleText
    });

    assert.equal(output.displayPacket.sceneId, "reference-inn-rain-001", `${entry.id}: scène de référence attendue`);
    if (entry.expectation.expectedIntent) {
      assert.equal(output.interpretation.intentType, entry.expectation.expectedIntent, `${entry.id}: intention attendue`);
    }
    assert.equal(output.noCommit, entry.expectation.noCommit, `${entry.id}: statut noCommit`);
    assert.equal(output.noGameTime, entry.expectation.noGameTime, `${entry.id}: statut noGameTime`);
    assertNoForbiddenDurableClaim(localText, `${entry.id}: local`);
    assertNoForbiddenDurableClaim(openAiCompatibleText, `${entry.id}: openai-compatible`);

    if (entry.expectation.requiresAnchor) {
      assertAnchoredInReferenceScene(localText, `${entry.id}: local`);
      assertAnchoredInReferenceScene(openAiCompatibleText, `${entry.id}: openai-compatible`);
    }
    if (entry.expectation.noFiction) {
      assert.equal(hasFictionBlock(output.displayPacket), false, `${entry.id}: pas de fiction sur réponse méta/possibilité`);
      assert.equal(localEnhancement.enhanced, false, `${entry.id}: local ne doit pas enrichir sans matière fictionnelle`);
      assert.equal(openAiCompatibleEnhancement.enhanced, false, `${entry.id}: OpenAI-compatible ne doit pas enrichir sans matière fictionnelle`);
    }
    if (entry.id === "i06q-10-speech-waitress") {
      assert.equal(
        output.displayPacket.displayBlocks.some(block =>
          block.kind === "NPC_SPEECH" &&
          block.speaker.displayName === "Serveuse nerveuse" &&
          /Nerveuse|porte du fond/u.test(block.text)
        ),
        true,
        "la parole ciblant la serveuse doit produire une réponse de la serveuse"
      );
      assert.equal(
        output.sceneState.shortTermNpcMemory.some(memory => memory.actorId === "npc-serveuse-nerveuse"),
        true,
        "la mémoire courte doit enregistrer la serveuse comme PNJ ciblé"
      );
    }

    const npcReply = output.displayPacket.displayBlocks.find(block => block.kind === "NPC_SPEECH")?.text;
    if (npcReply) guardReplies.push(npcReply);
  }

  assert.ok(
    traces.some(trace => trace.localEnhanced && trace.openAiCompatibleEnhanced),
    "au moins une entrée fictionnelle doit être enrichie dans les deux modes"
  );
  assert.ok(guardReplies.length >= 2, "le scénario doit contenir plusieurs réponses PNJ");
  assert.notEqual(guardReplies[0], guardReplies[1], "le garde ne doit pas répéter mécaniquement la même réponse");
  assert.match(guardReplies[1] ?? "", /Je vous l'ai dit|porte du fond/u, "la deuxième réponse doit exploiter la mémoire courte");

  const clockAggregate = await repository.getAggregate(campaignId, "world.clock", clockAggregateId);
  if (!clockAggregate.ok) throw new Error(clockAggregate.error.messageKey);
  assert.equal(
    (clockAggregate.value.payload as CampaignClockPayload).elapsedGameSeconds,
    0,
    "le scénario vertical I-06Q ne doit pas faire avancer l'horloge"
  );

  assert.equal(traces.length, 12);
  console.log("vertical-quality/i06q: OK");
}

async function enhance(
  output: NarrativeTurnControllerOutputV1,
  campaignId: CampaignId,
  mode: QualityMode
): Promise<Awaited<ReturnType<typeof enhanceNarrativeDisplayWithAiV1>>> {
  return enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId: output.operationId,
    displayPacket: output.displayPacket,
    resolution: output.resolution,
    sceneState: output.sceneState,
    config: {
      provider: new QualityProvider(mode),
      expressionRoute: route("player_expression_adapter", mode),
      sceneWriterRoute: route("scene_writer", mode),
      retryPolicy
    }
  });
}

class QualityProvider implements ContractAiProviderV1 {
  constructor(private readonly mode: QualityMode) {}

  async generate(request: AiCallRequestV1): Promise<unknown> {
    if (request.role === "player_expression_adapter") {
      const task = request.input.task as {
        rawPlayerText?: string;
        deterministicExpression?: string;
        coreMeaning?: string;
      };
      return {
        schemaVersion: 1,
        contractVersion: request.contractVersion,
        outputId: `output:${this.mode}:${request.attemptId}`,
        callId: request.callId,
        attemptId: request.attemptId,
        packId: request.packId,
        snapshotId: request.snapshotId,
        role: request.role,
        status: "OK",
        payload: {
          intentId: `intent:${request.operationId}`,
          expressionKind: "action_staging",
          renderedExpression: this.mode === "openai-compatible"
            ? `Je garde le même sens : ${task.deterministicExpression ?? task.coreMeaning ?? task.rawPlayerText ?? ""}`
            : task.deterministicExpression ?? task.coreMeaning ?? task.rawPlayerText ?? "",
          meaningCovered: [task.coreMeaning ?? task.rawPlayerText ?? ""],
          addedMeaning: [],
          omittedMeaning: [],
          styleChoices: [this.mode],
          safeToUse: true
        },
        diagnostics: [],
        supersedesOutputId: null
      };
    }

    const task = request.input.task as {
      allowedGrounding?: string[];
    };
    const groundedIn = task.allowedGrounding?.slice(0, 2) ?? [`resolution:${request.operationId}:resolution:1`];
    const content = this.mode === "openai-compatible"
      ? `À l'Auberge du Seuil, la pluie et les regards vers la porte du fond renforcent la tension déjà visible, sans ajouter de conséquence durable.`
      : `L'Auberge du Seuil reste sous la pluie; le garde blessé, la serveuse nerveuse et la porte du fond cadrent la réponse sans nouveau fait durable.`;
    return {
      schemaVersion: 1,
      contractVersion: request.contractVersion,
      outputId: `output:${this.mode}:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "OK",
      payload: {
        narrationBlocks: [{
          slotId: `${this.mode}:anchored-texture`,
          blockKind: "MJ_NARRATION",
          content,
          groundedIn,
          usesCreativeTexture: true
        }]
      },
      diagnostics: [],
      supersedesOutputId: null
    };
  }
}

function route(role: "player_expression_adapter" | "scene_writer", mode: QualityMode): AiModelRouteV1 {
  return {
    schemaVersion: 1,
    routeId: `i06q-${mode}-${role}`,
    role,
    providerKind: "FAKE_CONTRACT",
    providerId: mode === "local" ? "fake" : "openai-compatible-simulated",
    modelId: mode === "local" ? "fake-i06q-quality" : "openai-compatible-i06q-quality",
    modelConfigVersion: "i06q",
    certified: true,
    allowedContractVersions: ["narrative-ai-resolution/1"],
    inputTokenLimit: 2_000,
    outputTokenLimit: 1_000,
    timeoutMs: 1_000,
    fallbackRouteIds: []
  };
}

const retryPolicy: AiRetryPolicyV1 = {
  schemaVersion: 1,
  role: "scene_writer",
  maxTechnicalRetries: 0,
  maxTargetedCorrections: 0,
  maxFullRegenerations: 0,
  allowFallback: false
};

function packetText(packet: DisplayPacketV1): string {
  return packet.displayBlocks.map(block => block.text).join("\n");
}

function hasFictionBlock(packet: DisplayPacketV1): boolean {
  return packet.displayBlocks.some(block => block.kind === "GM_NARRATION" || block.kind === "NPC_SPEECH");
}

function assertAnchoredInReferenceScene(text: string, label: string): void {
  const normalized = normalize(text);
  assert.equal(
    /auberge du seuil|pluie|garde blesse|serveuse nerveuse|porte du fond|arriere-salle/u.test(normalized),
    true,
    `${label}: texte ancré dans la scène de référence`
  );
}

function assertNoForbiddenDurableClaim(text: string, label: string): void {
  const normalized = normalize(text);
  assert.equal(
    /\b(tu reussis|tu echoues|il est mort|combat termine|dans ton inventaire|nouveau pnj|nouvel objet|secret revele|indice cache)\b/u.test(normalized),
    false,
    `${label}: pas de succès, secret, objet, PNJ ou conséquence durable inventé`
  );
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
