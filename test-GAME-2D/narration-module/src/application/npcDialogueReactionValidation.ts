import type { AiStructuredSemanticIntentV1, NpcPerformerPayloadV1 } from "../ai/types";

export type NpcDialogueActV1 = NonNullable<AiStructuredSemanticIntentV1["dialogueAct"]>;

const RESPONSE_MODE_BY_ACT = {
  INITIATE_CONVERSATION: "ACKNOWLEDGE_CONTACT",
  ASK_QUESTION: "ANSWER_QUESTION",
  MAKE_STATEMENT: "ACKNOWLEDGE_STATEMENT",
  REQUEST_ACTION: "RESPOND_TO_REQUEST",
  OTHER: "CAUTIOUS_RESPONSE"
} as const;

export function responseModeForDialogueActV1(act: NpcDialogueActV1["act"]): NpcPerformerPayloadV1["reactionFrame"]["responseMode"] {
  return RESPONSE_MODE_BY_ACT[act];
}

export function validateNpcDialogueReactionV1(input: {
  expectedActorId: string;
  dialogueAct: NpcDialogueActV1;
  performance: NpcPerformerPayloadV1;
}): string[] {
  const issues: string[] = [];
  const frame = input.performance.reactionFrame;
  if (input.performance.actorId !== input.expectedActorId) {
    issues.push(`actorId mismatch: expected ${input.expectedActorId}, received ${input.performance.actorId}.`);
  }
  if (frame.sourceDialogueAct !== input.dialogueAct.act) {
    issues.push(`reactionFrame.sourceDialogueAct mismatch: expected ${input.dialogueAct.act}, received ${frame.sourceDialogueAct}.`);
  }
  const expectedMode = responseModeForDialogueActV1(input.dialogueAct.act);
  if (frame.responseMode !== expectedMode) {
    issues.push(`reactionFrame.responseMode mismatch: expected ${expectedMode}, received ${frame.responseMode}.`);
  }
  if (frame.addressedContentGoal.trim() !== input.dialogueAct.contentGoal.trim()) {
    issues.push("reactionFrame.addressedContentGoal must reproduce the interpreted dialogue contentGoal exactly.");
  }
  if (
    (input.dialogueAct.act === "INITIATE_CONVERSATION" || input.dialogueAct.act === "MAKE_STATEMENT") &&
    input.performance.utterances.some(utterance => utterance.speechActs.some(speechAct => speechAct.type === "question"))
  ) {
    issues.push(`reactionFrame ${input.dialogueAct.act} cannot introduce a question speech act.`);
  }
  return issues;
}
