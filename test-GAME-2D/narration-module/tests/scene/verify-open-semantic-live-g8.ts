import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import { loadOpenAiApiKeyV1 } from "../../src/ai/openaiProvider";
import type { AiCallRequestV1 } from "../../src/ai/types";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
  buildPlayerPublicContextV1,
  buildInterpreterRuntimeContextV1,
  interpretNarrativeInputWithAiV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  validateCanonicalIntentAuthorityV1,
  type AiIntentInterpreterConfigV1,
  type InterpreterCharacterContextV1,
  type RecentSemanticTurnV1
} from "../../src/application";

const { buildStrictAiOutputSchema, createNarrativeOpenAiEnhancementApi } = require("../../server/narrativeOpenAiEnhancementRoute.js") as {
  buildStrictAiOutputSchema(request: AiCallRequestV1): { schema: any };
  createNarrativeOpenAiEnhancementApi(options: Record<string, unknown>): {
    tryHandle(req: Record<string, unknown>, res: Record<string, unknown>): Promise<boolean>;
  };
};

const RUN_REMAINING_CASES = process.argv.includes("--remaining");
const MAX_LIVE_CALLS = 1;
const GUARD_REF = "npc:npc-garde-blesse";

interface RouteMetrics {
  modelId: string;
  reasoningEffort: string | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

class LiveNarrativeRouteProviderG8 implements ContractAiProviderV1 {
  readonly metrics: RouteMetrics[] = [];
  readonly requests: AiCallRequestV1[] = [];
  private calls = 0;

  constructor(
    private readonly api: {
      tryHandle(req: Record<string, unknown>, res: Record<string, unknown>): Promise<boolean>;
    }
  ) {}

  async generate(request: AiCallRequestV1): Promise<unknown> {
    assert.ok(this.calls < MAX_LIVE_CALLS, `G8 live call budget exceeded (${MAX_LIVE_CALLS}).`);
    const runtimeCapabilities = (request.input.task as any).embodiedContext?.runtimeCapabilities ?? [];
    assert.ok(
      runtimeCapabilities.some((capability: any) => capability.capabilityId === "scene.visible-dialogue" && capability.availability === "AVAILABLE"),
      `G8 requires the dialogue capability in the actual embodied request: ${JSON.stringify(request.input.task)}`
    );
    const capabilitySchema = buildStrictAiOutputSchema(request).schema
      .properties.payload.properties.semanticFrame.properties.components.items.properties.suggestedCapabilityId;
    assert.ok(
      capabilitySchema.anyOf?.[0]?.enum?.includes("scene.visible-dialogue"),
      "G8 requires the dialogue capability in the actual Structured Output schema."
    );
    this.calls += 1;
    this.requests.push(structuredClone(request));
    const res: { statusCode: number | null; payload: any } = { statusCode: null, payload: null };
    const handled = await this.api.tryHandle({
      method: "POST",
      url: "/api/narration/enhance-openai",
      body: { request }
    }, res);
    assert.notEqual(handled, false);
    assert.equal(res.statusCode, 200);
    if (res.payload?.metrics) this.metrics.push(res.payload.metrics as RouteMetrics);
    assert.equal(
      res.payload?.ok,
      true,
      `OpenAI route rejected call ${this.calls}: ${res.payload?.error ?? "unknown"} ${(res.payload?.issues ?? []).join(" | ")}`
    );
    return res.payload.output;
  }
}

const characterContext: InterpreterCharacterContextV1 = {
  schemaVersion: 1,
  contractVersion: "interpreter-character-context/2",
  character: { ref: "player-character:aryn", label: "Aryn" },
  references: [],
  ambiguities: [],
  embodiedProfile: {
    schemaVersion: 1,
    identity: {
      characterRef: "player-character:aryn",
      label: "Aryn",
      raceRef: "race:humain",
      backgroundRef: "background:veilleur"
    },
    selfNarrative: {
      biography: "Aryn a grandi près des anciennes tours de guet.",
      personality: "Prudent avec les inconnus, attentif aux détails.",
      objectives: "Comprendre l'origine du sceau brisé.",
      flaws: "Hésite à faire confiance aux autorités.",
      physicalDescription: "Une cicatrice claire traverse son menton."
    },
    classification: "PLAYER_AUTHORED_PUBLIC_SELF_CONTEXT"
  },
  authority: "INTERPRETATION_ONLY",
  ownerValidationRequired: true,
  deliberatelyExcluded: ["private_mechanics", "gm_secrets", "player_private_notebook"]
};

const recentGuardTurn: RecentSemanticTurnV1 = {
  schemaVersion: 1,
  operationId: "operation:g8-prior-guard",
  semanticKind: "address_visible_actor",
  playerGoal: "Le personnage demande au garde ce qui s'est passé ici.",
  primaryTarget: { kind: "npc", ref: GUARD_REF, label: "Garde blessé" },
  topic: "ce qui s'est passé dans l'auberge",
  commitment: "committed",
  focusDisposition: "RETAIN"
};

const playerPublicContext = buildPlayerPublicContextV1({
  activeScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  characterContext
});

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const repositoryRoot = path.resolve(projectRoot, "..");
  const env = loadServerEnv(projectRoot, repositoryRoot);
  assert.equal(env.NARRATION_OPENAI_LIVE, "1", "NARRATION_OPENAI_LIVE must be 1 for G8.");
  const apiKey = loadOpenAiApiKeyV1({ env, projectRoot, repositoryRoot });
  assert.ok(apiKey, "OPENAI_API_KEY is required for the explicitly approved G8 live gate.");
  const provider = new LiveNarrativeRouteProviderG8(createNarrativeOpenAiEnhancementApi({
    env,
    apiKey,
    fetchImpl: fetch,
    parseJsonBody: async (req: { body?: unknown }) => req.body,
    sendJson: (res: { statusCode?: number; payload?: unknown }, statusCode: number, data: unknown) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  }));
  const config = liveConfig(provider);
  const runtimeContext = buildInterpreterRuntimeContextV1({
    sceneTransition: true,
    dynamicPlace: true,
    rest: true,
    inventoryAccess: true,
    inventoryMutation: true,
    tacticalAccess: false,
    travel: true,
    companionRequests: true
  });

  if (RUN_REMAINING_CASES) {
    const sequence = await interpret(
      "ellipse-conditional-sequence",
      "Et dehors ? S'il s'écarte ensuite, j'ouvre la porte du fond, puis je donne ma fiole à la serveuse.",
      config,
      runtimeContext,
      [recentGuardTurn]
    );
    assertAccepted(sequence, "ellipse-conditional-sequence");
    assert.equal(sequence.interpretation.openSemanticRuntime?.components[0]?.capabilityId, "scene.visible-dialogue", componentDiagnostic(sequence));
    assert.equal(sequence.interpretation.openSemanticFrame?.components[0]?.mentionedTargets[0]?.proposedRef, GUARD_REF);
    assert.ok((sequence.interpretation.openSemanticFrame?.components.length ?? 0) >= 3, "L'entrée composée ne doit perdre aucune composante.");
    assert.ok(sequence.interpretation.openSemanticFrame?.components.some(component => component.commitment === "conditional"));
    assert.ok(sequence.interpretation.openSemanticRuntime?.components.some(component => component.status === "AWAITING_CONDITION"));
    assert.ok(sequence.interpretation.openSemanticFrame?.components.slice(1).some(component => component.relationToPrevious === "THEN"));
    assert.equal(sequence.interpretation.openSemanticRuntime?.components.length, sequence.interpretation.openSemanticFrame?.components.length);
  } else {
    const simple = await interpret(
      "simple-embodied-dialogue",
      "Je dis au garde que cet endroit me rappelle les tours près desquelles j'ai grandi.",
      config,
      runtimeContext
    );
    assertAccepted(simple, "simple");
    assert.equal(simple.interpretation.openSemanticFrame?.components.length, 1);
    assert.equal(
      simple.interpretation.openSemanticRuntime?.components[0]?.capabilityId,
      "scene.visible-dialogue",
      componentDiagnostic(simple)
    );
    assert.equal(simple.interpretation.openSemanticFrame?.components[0]?.mentionedTargets[0]?.proposedRef, GUARD_REF);
    assert.match(JSON.stringify(provider.requests.at(-1)?.input.task ?? {}), /anciennes tours de guet/u);
  }

  assert.equal(provider.metrics.length, MAX_LIVE_CALLS);
  const totals = provider.metrics.reduce((sum, metric) => ({
    input: sum.input + (metric.inputTokens ?? 0),
    output: sum.output + (metric.outputTokens ?? 0),
    total: sum.total + (metric.totalTokens ?? 0),
    latency: sum.latency + metric.latencyMs
  }), { input: 0, output: 0, total: 0, latency: 0 });
  console.log(JSON.stringify({
    gate: RUN_REMAINING_CASES ? "G8_REMAINING_LIVE_PASS" : "G8_CRITICAL_LIVE_PASS",
    calls: provider.metrics.length,
    modelId: provider.metrics[0]?.modelId ?? null,
    reasoningEffort: provider.metrics[0]?.reasoningEffort ?? null,
    inputTokens: totals.input,
    outputTokens: totals.output,
    totalTokens: totals.total,
    latencyMs: totals.latency
  }));
}

async function interpret(
  suffix: string,
  rawInput: string,
  config: AiIntentInterpreterConfigV1,
  runtimeContext: ReturnType<typeof buildInterpreterRuntimeContextV1>,
  recentSemanticTurns: RecentSemanticTurnV1[] = []
) {
  return interpretNarrativeInputWithAiV1({
    campaignId: "campaign:g8-live",
    operationId: `operation:g8-live:${suffix}`,
    intentId: `intent:g8-live:${suffix}`,
    rawInput,
    config,
    recentSemanticTurns,
    runtimeContext,
    characterContext,
    playerPublicContext,
    playableScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
}

function assertAccepted(result: Awaited<ReturnType<typeof interpret>>, label: string): void {
  assert.equal(result.usedAiInterpretation, true, `${label}: live OpenAI output was not accepted: ${JSON.stringify({
    interpretationFailure: result.interpretationFailure,
    semanticSource: result.interpretation.semanticSource,
    frame: result.interpretation.openSemanticFrame,
    runtime: result.interpretation.openSemanticRuntime
  })}`);
  assert.equal(result.interpretationFailure, null, `${label}: unexpected interpretation failure.`);
  assert.equal(result.interpretation.semanticSource, "OPEN_SEMANTIC_FRAME_V8", label);
  assert.equal(
    result.interpretation.openSemanticFrame?.understandingStatus,
    "UNDERSTOOD",
    `${label}: ${JSON.stringify(result.interpretation.openSemanticFrame)}`
  );
  assert.equal(validateCanonicalIntentAuthorityV1(result.interpretation).ok, true, `${label}: authority validation failed.`);
}

function componentDiagnostic(result: Awaited<ReturnType<typeof interpret>>): string {
  const component = result.interpretation.openSemanticFrame?.components[0];
  return JSON.stringify({
    understandingStatus: result.interpretation.openSemanticFrame?.understandingStatus ?? null,
    suggestedAction: component?.suggestedAction ?? null,
    suggestedCapabilityId: component?.suggestedCapabilityId ?? null,
    suggestedDomain: component?.suggestedDomain ?? null,
    runtimeStatus: result.interpretation.openSemanticRuntime?.components[0]?.status ?? null
  });
}

function liveConfig(provider: ContractAiProviderV1): AiIntentInterpreterConfigV1 {
  return {
    provider,
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
    route: {
      schemaVersion: 1,
      routeId: "route:g8-openai-live-short",
      role: "player_intent_interpreter",
      providerKind: "FAKE_CONTRACT",
      providerId: "server-openai-live-g8",
      modelId: "server-selected-openai-intent-model",
      modelConfigVersion: "g8-short-live-v1",
      certified: true,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8],
      inputTokenLimit: 2_000,
      outputTokenLimit: 2_000,
      timeoutMs: 30_000,
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
  };
}

function loadServerEnv(projectRoot: string, repositoryRoot: string): Record<string, string | undefined> {
  const fromFile: Record<string, string> = {};
  for (const file of [path.join(projectRoot, ".env"), path.join(repositoryRoot, ".env")]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/u)) {
      const match = line.trim().match(/^([A-Z0-9_]+)\s*[:=]\s*(.+)\s*$/u);
      if (!match || line.trim().startsWith("#")) continue;
      fromFile[match[1]] = match[2].trim().replace(/^["']|["']$/gu, "");
    }
  }
  return { ...fromFile, ...process.env };
}

void main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
