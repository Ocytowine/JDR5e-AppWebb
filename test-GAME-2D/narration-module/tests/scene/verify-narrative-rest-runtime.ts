import assert from "node:assert/strict";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
  createDefaultAiIntentInterpreterConfigV1,
  createNarrativeRestRuntimeV1,
  createPrototypeNarrativeTurnControllerV1,
  type AiIntentInterpreterConfigV1
} from "../../src/application";
import type { RestProcessStateV1 } from "../../src/handoff";

function restConfig(restKind: "SHORT_REST" | "LONG_REST" | null): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: `output:${request.attemptId}`,
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: (request.input.task as { rawInput: string }).rawInput,
            intents: [{
              intentId: "intent:rest",
              order: 1,
              intentType: "action",
              commitment: "committed",
              target: { kind: "self", ref: "player-character:test", label: "personnage" },
              action: "act",
              referentResolution: null,
              topic: "repos",
              coreMeaning: "Le personnage commence un repos.",
              playerImposedDetails: [],
              openDetails: restKind === null ? ["type de repos"] : [],
              forbiddenInterpretations: ["accorder immédiatement les bénéfices"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: {
                schemaVersion: 1,
                kind: "manipulate_visible_object",
                playerGoal: "commencer un repos",
                target: { kind: "self", ref: "player-character:test", label: "personnage" },
                commitment: "committed",
                evidenceFromInput: ["intention explicite de repos"],
                uncertainties: restKind === null ? ["type de repos"] : [],
                forbiddenInterpretations: ["accorder immédiatement les bénéfices"],
                confidence: "high",
                perception: null,
                dialogueAct: null,
                restPlan: { schemaVersion: 1, restKind }
              },
              runtimeHandling: {
                schemaVersion: 1,
                status: "UNSUPPORTED_DOMAIN",
                reason: "Le domaine repos requiert son propriétaire.",
                requiredDomain: "rest",
                canonicalActionHint: "act",
                noCommit: true,
                noGameTime: true
              }
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

const runtime = createNarrativeRestRuntimeV1({
  rules: {
    shortRestDurationSeconds: 3_600,
    longRestDurationSeconds: 28_800,
    segmentSeconds: 3_600
  },
  authorize: ({ scene }) => ({
    allowed: true,
    reason: "La situation permet de s'installer.",
    locationRef: { kind: "scene", id: scene.sceneId },
    safetyProfile: { interruptionPercent: 0 }
  })
});

async function main(): Promise<void> {
const missingController = await createPrototypeNarrativeTurnControllerV1({
  intentInterpreterConfig: restConfig(null),
  mjPlannerConfig: null,
  npcPerformerConfig: null,
  restRuntime: runtime
});
const missing = await missingController.submit({
  schemaVersion: 1,
  clientRequestId: "rest-missing-kind",
  rawInput: "Je souhaite me reposer."
});
if (!missing.ok) throw new Error(missing.error.messageKey);
assert.equal(missing.ok, true);
assert.equal(missing.value.output.noCommit, true);
assert.equal(missing.value.output.resolution.resultKind, "CLARIFICATION_REQUIRED");
assert.match(
  missing.value.output.displayPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text ?? "",
  /repos court ou un repos long/
);

const readyController = await createPrototypeNarrativeTurnControllerV1({
  intentInterpreterConfig: restConfig("LONG_REST"),
  mjPlannerConfig: null,
  npcPerformerConfig: null,
  restRuntime: runtime
});
const readyInput = {
  schemaVersion: 1 as const,
  clientRequestId: "rest-long-start",
  rawInput: "Je commence un repos long."
};
const started = await readyController.submit(readyInput);
if (!started.ok) throw new Error(started.error.messageKey);
assert.equal(started.ok, true);
assert.equal(started.value.output.noCommit, false);
assert.equal(started.value.output.noGameTime, true);
assert.equal(started.value.output.resolution.resultKind, "COMMIT_APPLIED");
assert.match(
  started.value.output.displayPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text ?? "",
  /repos long/
);
const replay = await readyController.submit(readyInput);
if (!replay.ok) throw new Error(replay.error.messageKey);
assert.equal(replay.ok, true);
assert.equal(replay.value.operation.commitId, started.value.operation.commitId);
assert.deepEqual(replay.value.output, started.value.output);

const startedProcess = (started.value.output as typeof started.value.output & {
  activeRestProcess: RestProcessStateV1;
}).activeRestProcess;
assert.equal(startedProcess.status, "ACTIVE");
assert.equal(startedProcess.elapsedRestSeconds, 0);

const restoredStart = await readyController.restoreActiveRest();
if (!restoredStart.ok) throw new Error(restoredStart.error.messageKey);
assert.equal(restoredStart.value?.processId, startedProcess.processId);

const firstAdvanceCommand = {
  schemaVersion: 1 as const,
  clientRequestId: "rest-long-segment-1",
  processId: startedProcess.processId,
  activity: {
    schemaVersion: 1 as const,
    activityKind: "CHARACTER_PROGRESSION" as const,
    characterId: "pc-aryn",
    progressionAwardId: "award-rest-runtime-6e-d"
  }
};
const firstAdvance = await readyController.advanceRest(firstAdvanceCommand);
if (!firstAdvance.ok) throw new Error(firstAdvance.error.messageKey);
assert.equal(firstAdvance.value.output.noGameTime, false);
const firstAdvancedProcess = (firstAdvance.value.output as typeof firstAdvance.value.output & {
  activeRestProcess: RestProcessStateV1;
}).activeRestProcess;
assert.equal(firstAdvancedProcess.elapsedRestSeconds, 3_600);
assert.equal(firstAdvancedProcess.acquiredBenefits.length, 0);
assert.equal(firstAdvancedProcess.completedActivities.length, 1);
assert.equal(
  firstAdvancedProcess.completedActivities[0]?.activityKind,
  "CHARACTER_PROGRESSION"
);
assert.match(
  firstAdvance.value.output.displayPacket.displayBlocks.find(
    block => block.kind === "GM_NARRATION"
  )?.text ?? "",
  /chemin parcouru.*évolution/iu
);
const firstAdvanceReplay = await readyController.advanceRest(firstAdvanceCommand);
if (!firstAdvanceReplay.ok) throw new Error(firstAdvanceReplay.error.messageKey);
assert.deepEqual(firstAdvanceReplay.value.output, firstAdvance.value.output);

let finalOutput = firstAdvance.value.output;
for (let segmentIndex = 2; segmentIndex <= 8; segmentIndex += 1) {
  const advanced = await readyController.advanceRest({
    schemaVersion: 1,
    clientRequestId: `rest-long-segment-${segmentIndex}`,
    processId: startedProcess.processId
  });
  if (!advanced.ok) throw new Error(advanced.error.messageKey);
  finalOutput = advanced.value.output;
}
assert.equal((finalOutput as typeof finalOutput & {
  activeRestProcess: RestProcessStateV1 | null;
}).activeRestProcess, null);
assert.match(
  finalOutput.displayPacket.displayBlocks.find(block => block.kind === "SYSTEM_NOTICE")?.text ?? "",
  /bénéfices restent en attente/
);
const restoredCompleted = await readyController.restoreActiveRest();
if (!restoredCompleted.ok) throw new Error(restoredCompleted.error.messageKey);
assert.equal(restoredCompleted.value, null);

console.log("narrative-rest-runtime/6A: OK (start, segment, replay, completion pending benefits, restore)");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
