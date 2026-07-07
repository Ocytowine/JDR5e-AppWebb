import type {
  ConversationRhythmPolicyV1,
  DisplayBlockV1,
  DisplayPacketV1,
  InteractionLogEntryV1,
  InteractionLogSourceV1,
  RenderPlanBlockV1,
  RenderPlanV1,
  RhythmDecisionV1,
  SpeakerRefV1
} from "./types";
import { SCENE_SOCIAL_UI_CONTRACT_VERSION_V1 } from "./types";
import { validateDisplayPacketV1, validateInteractionLogEntryV1, validateRenderPlanV1 } from "./validation";

function speakerToDisplay(speaker: SpeakerRefV1) {
  return {
    speakerId: speaker.speakerId,
    kind: speaker.kind,
    displayName: speaker.displayName,
    roleLabel: speaker.roleLabel,
    ariaLabel: speaker.accessibilityLabel,
    visualToken: speaker.visualToken
  };
}

function blockToDisplay(block: RenderPlanBlockV1, isDegradedFallback: boolean): DisplayBlockV1 {
  const speaker = speakerToDisplay(block.speakerRef);
  return {
    blockId: block.blockId,
    kind: block.kind,
    speaker,
    text: block.text,
    ariaLabel: `${speaker.roleLabel} ${speaker.displayName}: ${block.kind}`,
    roleLabel: speaker.roleLabel,
    visualStyleToken: speaker.visualToken,
    sourceRefs: [...block.sourceRefs],
    isDegradedFallback
  };
}

export function buildDisplayPacketFromRenderPlanV1(input: {
  renderPlan: RenderPlanV1;
  rawInputAvailable: boolean;
  diagnosticsEnabled: boolean;
  isDegradedFallback?: boolean;
}): DisplayPacketV1 {
  const planValidation = validateRenderPlanV1(input.renderPlan);
  if (!planValidation.ok) throw new Error(`Invalid render plan: ${planValidation.issues.join("; ")}`);

  const orderedBlocks = [...input.renderPlan.blocks].sort((a, b) => a.order - b.order);
  const packet: DisplayPacketV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.renderPlan.operationId,
    sceneId: input.renderPlan.sceneId,
    displayBlocks: orderedBlocks.map(block => blockToDisplay(block, input.isDegradedFallback === true)),
    rawInputAccess: {
      available: input.rawInputAvailable,
      operationId: input.renderPlan.operationId
    },
    rhythmDiagnostics: input.diagnosticsEnabled ? input.renderPlan.rhythmDecision.diagnostic : null,
    reconstructionRefs: Array.from(new Set(orderedBlocks.flatMap(block => block.sourceRefs))),
    version: 1
  };

  const packetValidation = validateDisplayPacketV1(packet);
  if (!packetValidation.ok) throw new Error(`Invalid display packet: ${packetValidation.issues.join("; ")}`);
  return packet;
}

export function reconstructInteractionLogEntriesV1(source: InteractionLogSourceV1): InteractionLogEntryV1[] {
  const planValidation = validateRenderPlanV1(source.renderPlan);
  if (!planValidation.ok) throw new Error(`Invalid render plan: ${planValidation.issues.join("; ")}`);

  return [...source.renderPlan.blocks]
    .sort((a, b) => a.order - b.order)
    .map((block, index) => {
      const entry: InteractionLogEntryV1 = {
        schemaVersion: 1,
        contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
        entryId: `${source.operationId}:log:${index + 1}`,
        campaignId: source.campaignId,
        operationId: source.operationId,
        sceneId: source.sceneId,
        gameTime: source.gameTime,
        recordedAt: source.recordedAt,
        kind: block.kind,
        speakerRef: block.speakerRef,
        text: block.text,
        sourceRefs: [...block.sourceRefs],
        commitId: source.commitId,
        eventRefs: [...source.eventRefs],
        visibility: block.visibility,
        version: 1
      };
      const validation = validateInteractionLogEntryV1(entry);
      if (!validation.ok) throw new Error(`Invalid interaction log entry: ${validation.issues.join("; ")}`);
      return entry;
    });
}

export function decideConversationRhythmV1(input: {
  policy: ConversationRhythmPolicyV1;
  automaticNpcTurns: number;
  narrativeBlocksSincePlayer: number;
  directQuestionToPlayer: boolean;
  needsClarification: boolean;
  systemHandoff: boolean;
}): RhythmDecisionV1 {
  if (input.needsClarification) return { reason: "CLARIFY", diagnostic: "clarification required before safe execution" };
  if (input.systemHandoff) return { reason: "SYSTEM_HANDOFF", diagnostic: "system handoff requires player-facing transition" };
  if (input.directQuestionToPlayer && input.policy.handoffOnDirectQuestionToPlayer) return { reason: "ASK_PLAYER", diagnostic: "NPC directly addressed the player character" };
  if (input.automaticNpcTurns >= input.policy.maxAutomaticNpcTurns) return { reason: "RHYTHM_LIMIT", diagnostic: "maximum automatic NPC turns reached" };
  if (input.narrativeBlocksSincePlayer >= input.policy.maxNarrativeBlocksBeforePlayer) return { reason: "RHYTHM_LIMIT", diagnostic: "maximum narrative blocks before player reached" };
  return { reason: "CONTINUE_AUTOMATICALLY", diagnostic: "rhythm policy allows continuation" };
}
