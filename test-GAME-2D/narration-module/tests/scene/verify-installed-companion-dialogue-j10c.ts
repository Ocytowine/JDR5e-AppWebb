import assert from "node:assert/strict";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7,
  createPrototypeNarrativeTurnControllerV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type AiIntentInterpreterConfigV1
} from "../../src/application";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV7,
  AiSemanticPlayerIntentV7
} from "../../src/ai/types";
import { createInstalledCompanionRecruitmentRuntimeV1 } from
  "../../../src/narration-ui/playableCampaignCompanionCatalog";
import { createInstalledMissionRelationRuntimeV1 } from
  "../../../src/narration-ui/playableCampaignMissionCatalog";

const sceneId = "wiki-location:archives_de_lysenthe";
const archivistId = `${sceneId}:ambient:1`;
const clerkId = `${sceneId}:ambient:2`;
const scene = {
  ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  sceneId,
  locationName: "Archives de Lysenthe",
  presentNpc: [],
  ambientPopulation: [
    ambient(archivistId, "Archiviste aux gestes soigneux", "Archiviste"),
    ambient(clerkId, "Clerc aux registres", "Clerc")
  ]
};

function ambient(actorId: string, displayName: string, publicRole: string) {
  return {
    schemaVersion: 1 as const,
    actorId,
    displayName,
    publicRole,
    visibleActivity: "classe des feuillets",
    visibleAppearance: "une tenue de travail sobre",
    demeanor: "attentif",
    immediateGoal: "préserver l'ordre des archives",
    currentPressure: "le temps manque",
    speechStyle: ["phrases mesurées"],
    conversationalHooks: ["archives", "voyage"],
    boundaries: ["conserve sa propre volonté"],
    knowledgeRefs: [`scene:${sceneId}`],
    keywords: [displayName, publicRole],
    version: 1 as const
  };
}

function intentFor(rawInput: string): AiSemanticPlayerIntentV7 {
  const normalized = rawInput.toLowerCase();
  const targetsAbsent = normalized.includes("absent");
  const targetsClerk = normalized.includes("clerc");
  const targetId = targetsAbsent ? `${sceneId}:ambient:absent`
    : targetsClerk ? clerkId : archivistId;
  const presenceIntent = normalized.includes("reste ici") ? "SEPARATE" as const
    : normalized.includes("reviens") ? "REJOIN" as const
      : "UNCHANGED" as const;
  const category = normalized.includes("danger") ? "PERSONAL_RISK" as const : "FOLLOW" as const;
  const contentGoal = rawInput.trim();
  return {
    kind: "address_visible_actor",
    commitment: "committed",
    preconditions: [],
    playerGoal: contentGoal,
    actionHint: contentGoal,
    domainHint: "social",
    scope: "SOCIAL_EXCHANGE",
    targetMention: {
      surface: targetsAbsent ? "le compagnon absent" : targetsClerk ? "le clerc" : "l'archiviste",
      candidateKind: "npc",
      proposedRef: `npc:${targetId}`,
      contextLink: "EXPLICIT"
    },
    perception: null,
    dialogueAct: { act: "REQUEST_ACTION", contentGoal },
    uncertainties: [],
    clarificationPrompt: null,
    confidence: "high",
    composition: {
      orientation: null,
      spatialLeadIn: null,
      communication: { mode: "SPEECH", act: "REQUEST_ACTION", contentGoal, order: 1 },
      spatialFollowUp: null
    },
    companionDirective: {
      schemaVersion: 1,
      category,
      requestSummary: contentGoal,
      presenceIntent
    }
  };
}

const provider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
    const rawInput = String((call.input.task as { rawInput?: unknown }).rawInput ?? "");
    return {
      schemaVersion: 1,
      contractVersion: call.contractVersion,
      outputId: `output:${call.attemptId}`,
      callId: call.callId,
      attemptId: call.attemptId,
      packId: call.packId,
      snapshotId: call.snapshotId,
      role: call.role,
      status: "OK",
      payload: { rawInputEcho: rawInput, intent: intentFor(rawInput) },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV7>;
  }
};

const interpreterConfig: AiIntentInterpreterConfigV1 = {
  provider,
  contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7,
  route: {
    schemaVersion: 1,
    routeId: "j10c-installed-companion-dialogue",
    role: "player_intent_interpreter",
    providerKind: "FAKE_CONTRACT",
    providerId: "j10c-local",
    modelId: "deterministic-j10c",
    modelConfigVersion: "companion-presence-v7",
    certified: true,
    allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7],
    inputTokenLimit: 2_000,
    outputTokenLimit: 1_000,
    timeoutMs: 1_000,
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

async function main(): Promise<void> {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    initialScene: { scene, locationRef: "location:archives_de_lysenthe" },
    activeSceneResolver: { async resolve() { return { ok: true as const, value: scene }; } },
    intentInterpreterConfig: interpreterConfig,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    interpreterCharacterContextResolver: null,
    missionRelationRuntime: createInstalledMissionRelationRuntimeV1(),
    companionRecruitmentRuntime: createInstalledCompanionRecruitmentRuntimeV1()
  });

  const refusedClerk = await submit(controller, "j10c:clerk", "Clerc, veux-tu rejoindre mon groupe ?");
  assert.match(visibleText(refusedClerk), /refus|décline|ne (?:peux|peut|souhaite)/iu);
  assert.equal((await memberStatuses(controller)).length, 0);

  const recruited = await submit(controller, "j10c:recruit", "Archiviste, veux-tu rejoindre mon groupe ?");
  assert.doesNotMatch(visibleText(recruited), /engagement|disposition|runtime|policy/iu);
  assert.equal((await party(controller)).members[0]?.status, "ACTIVE");
  assert.equal((await party(controller)).members[0]?.currentSceneId, sceneId);
  assert.equal((await party(controller)).members[0]?.actorId, archivistId);

  const absent = await submit(controller, "j10c:absent", "Je demande au compagnon absent de revenir.");
  assert.equal(absent.interpretation.requiresClarification, true);
  assert.equal((await party(controller)).members[0]?.status, "ACTIVE");

  const refusedRisk = await submit(controller, "j10c:risk", "Archiviste, va seul affronter ce danger.");
  assert.equal(refusedRisk.interpretation.semanticIntent.companionDirective?.category, "PERSONAL_RISK");
  assert.equal(refusedRisk.interpretation.semanticIntent.target?.ref, `npc:${archivistId}`);
  assert.equal(refusedRisk.interpretation.semanticIntent.dialogueAct?.act, "REQUEST_ACTION");
  assert.equal(refusedRisk.interpretation.semanticIntent.commitment, "committed");
  assert.match(visibleText(refusedRisk), /refuse/iu);
  assert.equal((await party(controller)).members[0]?.status, "ACTIVE");
  assert.equal((await party(controller)).directives.at(-1)?.executionStatus, "NOT_STARTED");

  const separated = await submit(controller, "j10c:separate", "Archiviste, reste ici pendant que je poursuis.");
  assert.match(visibleText(separated), /reste ici/iu);
  assert.equal((await party(controller)).members[0]?.status, "SEPARATED");

  const rejoined = await submit(controller, "j10c:rejoin", "Archiviste, reviens avec moi.");
  assert.match(visibleText(rejoined), /revient/iu);
  assert.equal((await party(controller)).members[0]?.status, "ACTIVE");

  const replay = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j10c:rejoin",
    rawInput: "Archiviste, reviens avec moi."
  });
  assert.equal(replay.ok, true);
  assert.equal((await party(controller)).members[0]?.status, "ACTIVE");
  console.log("companion-dialogue/J10-C: installed refusal, recruitment, autonomy, separation, reunion and replay verified");
}

async function submit(controller: Awaited<ReturnType<typeof createPrototypeNarrativeTurnControllerV1>>, clientRequestId: string, rawInput: string) {
  const result = await controller.submit({ schemaVersion: 1, clientRequestId, rawInput });
  if (!result.ok) throw new Error(`${result.error.messageKey} ${JSON.stringify(result.error.details)}`);
  return result.value.output;
}

async function party(controller: Awaited<ReturnType<typeof createPrototypeNarrativeTurnControllerV1>>) {
  const result = await controller.restoreCompanionParty();
  if (!result.ok || result.value.state === null) throw new Error("companion party unavailable");
  return result.value.state;
}

async function memberStatuses(controller: Awaited<ReturnType<typeof createPrototypeNarrativeTurnControllerV1>>) {
  const result = await controller.restoreCompanionParty();
  if (!result.ok) throw new Error(result.error.messageKey);
  return result.value.state?.members.map(member => member.status) ?? [];
}

function visibleText(output: { displayPacket: { displayBlocks: Array<{ kind: string; text: string }> } }): string {
  return output.displayPacket.displayBlocks
    .filter(block => ["RAW_INPUT", "NPC_SPEECH", "GM_NARRATION"].includes(block.kind))
    .map(block => block.text)
    .join("\n");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
