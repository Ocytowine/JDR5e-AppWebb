import {
  createPrototypeNarrativeTurnControllerV1,
  type AiNarrativeEnhancementResultV1,
  type NarrativeTurnControllerOutputV1
} from "../../src/application";
import {
  buildOpenAiIntentInterpreterConfigV1,
  buildOpenAiNpcPerformerConfigV1
} from "../../../src/narration-ui/openAiNarrativeRuntimeConfig";
import type { AiCallRequestV1, ContractAiProviderV1 } from "../../src/ai";

const endpoint = process.env.NARRATIVE_OPENAI_ENDPOINT ?? "http://127.0.0.1:5175/api/narration/enhance-openai";
const turns = [
  ["live-01", "Je dis bonjour à la serveuse."],
  ["live-02", "Je lui demande pourquoi elle regarde la porte."],
  ["live-03", "Je demande à la serveuse si tout va bien."],
  ["live-04", "Je m'approche du garde."],
  ["live-05", "Je dis bonjour au garde."],
  ["live-06", "Je lui demande s'il a mal."],
  ["live-07", "Je lui demande encore s'il a mal."],
  ["live-08", "Je demande à la serveuse ce qu'elle attend."],
  ["live-09", "J'essaie d'entrer dans l'arrière-salle discrètement."],
  ["live-10", "Je demande au garde s'il peut m'aider."]
] as const;
const turnLimit = Math.max(1, Math.min(turns.length, Number(process.env.NARRATIVE_LIVE_TURN_LIMIT ?? turns.length)));
const turnStart = Math.max(0, Math.min(turns.length - 1, Number(process.env.NARRATIVE_LIVE_TURN_START ?? 0)));
const gateMode = process.argv.includes("--gate");
const repetitions = gateMode ? 3 : 1;

async function main(): Promise<void> {
  const results: unknown[] = [];
  const gateIssues: string[] = [];
  const interpretationLatencies: number[] = [];

  const selectedTurns = turns.slice(turnStart, turnStart + turnLimit);
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    const intentConfig = buildOpenAiIntentInterpreterConfigV1(endpoint);
    const performerConfig = buildOpenAiNpcPerformerConfigV1(endpoint);
    intentConfig.provider = traceProvider(intentConfig.provider);
    performerConfig.provider = traceProvider(performerConfig.provider);
    const controller = await createPrototypeNarrativeTurnControllerV1({ intentInterpreterConfig: intentConfig, npcPerformerConfig: performerConfig });
    for (const [clientRequestId, rawInput] of selectedTurns) {
    const startedAt = Date.now();
    const submitted = await controller.submit({ schemaVersion: 1, clientRequestId, rawInput });
    if (!submitted.ok) throw new Error(`${clientRequestId}: ${submitted.error.messageKey}`);
    const output = submitted.value.output;
    const npcBlocks = output.displayPacket.displayBlocks.filter(block => block.kind === "NPC_SPEECH");
    if (output.interpretation.runtimeDecision.status === "AI_INTERPRETATION_FAILED") gateIssues.push(`${clientRequestId}: interprétation IA refusée`);
    if (output.interpretation.semanticIntent.kind === "address_visible_actor" && output.npcPerformance === null) gateIssues.push(`${clientRequestId}: performer PNJ non accepté`);
    if (clientRequestId === "live-04" && npcBlocks.length > 0) gateIssues.push(`${clientRequestId}: parole PNJ inattendue pendant une approche`);
    if (clientRequestId === "live-09" && output.resolution.resultKind !== "HANDOFF_REQUIRED") gateIssues.push(`${clientRequestId}: handoff attendu, reçu ${output.resolution.resultKind}`);
    if (output.stageTimings !== null) interpretationLatencies.push(output.stageTimings.interpretationMs);
    results.push({
      repetition,
      turn: clientRequestId,
      input: rawInput,
      semanticKind: output.interpretation.semanticIntent.kind,
      target: output.interpretation.referentResolution?.resolvedTarget?.ref ?? output.interpretation.semanticIntent.target?.ref ?? null,
      dialogueAct: output.interpretation.semanticIntent.dialogueAct?.act ?? null,
      runtimeStatus: output.interpretation.runtimeDecision.status,
      interpretationNotes: output.interpretation.safetyNotes,
      resultKind: output.resolution.resultKind,
      performerAccepted: output.npcPerformance !== null,
      performerFailure: output.npcPerformanceFailure?.issues ?? [],
      npc: npcBlocks.map(block => ({ speaker: block.speaker.displayName, text: block.text })),
      timings: output.stageTimings,
      aiTelemetry: output.aiTelemetry,
      wallMs: Date.now() - startedAt,
      memoryByActor: countMemory(output)
    });
    await recordProjection(controller, output);
    process.stdout.write(`LIVE_PROGRESS run=${repetition}/${repetitions} ${clientRequestId}/${selectedTurns.length} ${Date.now() - startedAt}ms\n`);
    }
  }

  if (gateMode && interpretationLatencies.length > 0) {
    const sorted = [...interpretationLatencies].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
    const maximum = sorted.at(-1) ?? 0;
    if (p95 > 15_000) gateIssues.push(`latence interprétation p95=${p95}ms > 15000ms`);
    if (maximum > 25_000) gateIssues.push(`latence interprétation max=${maximum}ms > 25000ms`);
  }
  process.stdout.write(`LIVE_RESULTS ${JSON.stringify(results, null, 2)}\n`);
  if (gateIssues.length > 0) throw new Error(`LIVE_GATE_FAILED: ${gateIssues.join(" | ")}`);
}

function traceProvider(provider: ContractAiProviderV1): ContractAiProviderV1 {
  return {
    async generate(request: AiCallRequestV1): Promise<unknown> {
      const startedAt = Date.now();
      process.stdout.write(`LIVE_CALL_START ${request.role} ${request.limits.timeoutMs}ms\n`);
      const output = await provider.generate(request);
      process.stdout.write(`LIVE_CALL_END ${request.role} ${Date.now() - startedAt}ms\n`);
      return output;
    },
    takeTelemetry(attemptId) { return provider.takeTelemetry?.(attemptId) ?? null; }
  };
}

function countMemory(output: NarrativeTurnControllerOutputV1): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of output.sceneState.shortTermNpcMemory) counts[entry.actorId] = (counts[entry.actorId] ?? 0) + 1;
  return counts;
}

async function recordProjection(
  controller: Awaited<ReturnType<typeof createPrototypeNarrativeTurnControllerV1>>,
  output: NarrativeTurnControllerOutputV1
): Promise<void> {
  const finalEnhancement: AiNarrativeEnhancementResultV1 = {
    schemaVersion: 1,
    contractVersion: "narrative-ai-resolution/1",
    enhanced: false,
    usedFallback: false,
    fallbackKind: "NONE",
    displayPacket: output.displayPacket,
    incidents: [],
    safetyNotes: ["Projection live expurgée de certification."]
  };
  const recorded = await controller.recordRenderedProjection({
    schemaVersion: 1,
    clientRequestId: output.clientRequestId,
    sourceOutput: output,
    mode: "openai",
    finalEnhancement,
    attemptedEnhancement: null,
    statusMessage: "Projection live enregistrée."
  });
  if (!recorded.ok) throw new Error(`${output.clientRequestId}: ${recorded.error.messageKey}`);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
