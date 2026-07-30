import type {
  DisplayPacketV1,
  InteractionLogEntryV1,
  RenderPlanBlockV1,
  RenderPlanV1,
  SceneStateV1,
  SceneValidationResultV1,
  SocialKnowledgeStateV1,
  SpeakerRefV1,
  SpeechActRecordV1,
  SuspendedClarificationV1
} from "./types";
import { SCENE_SOCIAL_UI_CONTRACT_VERSION_V1 } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function issue(path: string, message: string): string {
  return `${path}: ${message}`;
}

function nonEmpty(value: unknown, path: string): string[] {
  return typeof value === "string" && value.length > 0 ? [] : [issue(path, "expected non-empty string")];
}

function stringArray(value: unknown, path: string): string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === "string") ? [] : [issue(path, "expected string array")];
}

function positiveOrZeroInteger(value: unknown, path: string): string[] {
  return Number.isInteger(value) && (value as number) >= 0 ? [] : [issue(path, "expected positive or zero integer")];
}

function positiveInteger(value: unknown, path: string): string[] {
  return Number.isInteger(value) && (value as number) > 0 ? [] : [issue(path, "expected positive integer")];
}

function result(issues: string[]): SceneValidationResultV1 {
  return { ok: issues.length === 0, issues };
}

export function validateSpeakerRefV1(value: unknown, path = "speaker"): SceneValidationResultV1 {
  if (!isObject(value)) return result([issue(path, "expected object")]);
  const speaker = value as Partial<SpeakerRefV1>;
  const issues: string[] = [];
  if (speaker.schemaVersion !== 1) issues.push(issue(`${path}.schemaVersion`, "expected 1"));
  issues.push(...nonEmpty(speaker.speakerId, `${path}.speakerId`));
  if (!["GM", "PLAYER_CHARACTER", "NPC", "SYSTEM"].includes(String(speaker.kind))) issues.push(issue(`${path}.kind`, "invalid kind"));
  if (speaker.actorRef !== null && typeof speaker.actorRef !== "string") issues.push(issue(`${path}.actorRef`, "expected string or null"));
  issues.push(...nonEmpty(speaker.displayName, `${path}.displayName`));
  if (!["KNOWN", "DESIGNATION", "UNKNOWN"].includes(String(speaker.knownNameStatus))) issues.push(issue(`${path}.knownNameStatus`, "invalid status"));
  issues.push(...nonEmpty(speaker.roleLabel, `${path}.roleLabel`));
  issues.push(...nonEmpty(speaker.accessibilityLabel, `${path}.accessibilityLabel`));
  issues.push(...nonEmpty(speaker.visualToken, `${path}.visualToken`));
  return result(issues);
}

export function validateSceneStateV1(value: unknown): SceneValidationResultV1 {
  if (!isObject(value)) return result(["scene: expected object"]);
  const scene = value as Partial<SceneStateV1>;
  const issues: string[] = [];
  if (scene.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  if (scene.contractVersion !== SCENE_SOCIAL_UI_CONTRACT_VERSION_V1) issues.push(issue("contractVersion", "invalid contract"));
  for (const key of ["sceneId", "campaignId", "locationRef"] as const) issues.push(...nonEmpty(scene[key], key));
  if (!["ACTIVE", "SUSPENDED", "CLOSED"].includes(String(scene.status))) issues.push(issue("status", "invalid status"));
  issues.push(...positiveOrZeroInteger(scene.startedAtGameTime, "startedAtGameTime"));
  issues.push(...positiveOrZeroInteger(scene.lastRelevantGameTime, "lastRelevantGameTime"));
  if ((scene.lastRelevantGameTime ?? -1) < (scene.startedAtGameTime ?? 0)) issues.push(issue("lastRelevantGameTime", "cannot precede startedAtGameTime"));
  for (const key of ["participantRefs", "activeThreadRefs", "perceptionAnchors", "sourceEventRefs"] as const) issues.push(...stringArray(scene[key], key));
  if (!Array.isArray(scene.establishedStaging)) issues.push(issue("establishedStaging", "expected array"));
  if (!["CAMPAIGN_START", "LOCATION_CHANGE", "TIME_ADVANCE", "ACTOR_CHANGE", "SYSTEM_HANDOFF", "CONTINUATION", "EXPLICIT_CLOSE"].includes(String(scene.transitionCause))) {
    issues.push(issue("transitionCause", "invalid cause"));
  }
  issues.push(...positiveInteger(scene.version, "version"));
  return result(issues);
}

export function validateSocialKnowledgeStateV1(value: unknown): SceneValidationResultV1 {
  if (!isObject(value)) return result(["socialKnowledge: expected object"]);
  const state = value as Partial<SocialKnowledgeStateV1>;
  const issues: string[] = [];
  if (state.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  if (state.contractVersion !== SCENE_SOCIAL_UI_CONTRACT_VERSION_V1) issues.push(issue("contractVersion", "invalid contract"));
  issues.push(...nonEmpty(state.actorId, "actorId"));
  for (const key of ["knownFactRefs", "visibilityConstraints", "sourceEventRefs"] as const) issues.push(...stringArray(state[key], key));
  for (const key of ["beliefs", "relationshipEdges", "reputationMarkers", "debtsAndPromises"] as const) {
    if (!Array.isArray(state[key])) issues.push(issue(key, "expected array"));
  }
  issues.push(...positiveInteger(state.version, "version"));
  return result(issues);
}

export function validateSpeechActRecordV1(value: unknown): SceneValidationResultV1 {
  if (!isObject(value)) return result(["speechAct: expected object"]);
  const speech = value as Partial<SpeechActRecordV1>;
  const issues: string[] = [];
  if (speech.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  for (const key of ["speechActId", "operationId", "sceneId", "language", "text", "sourceOutputId", "eventRef"] as const) {
    issues.push(...nonEmpty(speech[key], key));
  }
  issues.push(...validateSpeakerRefV1(speech.speakerRef, "speakerRef").issues);
  for (const key of ["audienceRefs", "semanticCommitments", "knowledgeUsedRefs"] as const) issues.push(...stringArray(speech[key], key));
  if (!["PLAYER_VISIBLE", "ACTOR_SCOPED", "SYSTEM_ONLY"].includes(String(speech.visibility))) issues.push(issue("visibility", "invalid visibility"));
  issues.push(...positiveInteger(speech.version, "version"));
  return result(issues);
}

function validateRenderBlock(block: Partial<RenderPlanBlockV1>, index: number, exactTextBySourceRef: ReadonlyMap<string, string>): string[] {
  const path = `blocks[${index}]`;
  const issues: string[] = [];
  for (const key of ["blockId", "text"] as const) issues.push(...nonEmpty(block[key], `${path}.${key}`));
  if (!["RAW_INPUT", "PLAYER_EXPRESSION", "GM_NARRATION", "NPC_SPEECH", "SYSTEM_NOTICE", "CLARIFICATION"].includes(String(block.kind))) issues.push(issue(`${path}.kind`, "invalid kind"));
  issues.push(...validateSpeakerRefV1(block.speakerRef, `${path}.speakerRef`).issues);
  issues.push(...stringArray(block.sourceRefs, `${path}.sourceRefs`));
  issues.push(...stringArray(block.groundedIn, `${path}.groundedIn`));
  if (!["EXACT", "AI_NARRATIVE_ALLOWED", "DETERMINISTIC_ONLY"].includes(String(block.textPolicy))) issues.push(issue(`${path}.textPolicy`, "invalid text policy"));
  if (!["PLAYER_VISIBLE", "ACTOR_SCOPED", "SYSTEM_ONLY"].includes(String(block.visibility))) issues.push(issue(`${path}.visibility`, "invalid visibility"));
  issues.push(...positiveOrZeroInteger(block.order, `${path}.order`));

  if ((block.kind === "PLAYER_EXPRESSION" || block.kind === "NPC_SPEECH") && block.textPolicy !== "EXACT") {
    issues.push(issue(`${path}.textPolicy`, "validated speech blocks must be EXACT"));
  }
  if (block.textPolicy === "EXACT") {
    const expected = block.sourceRefs?.map(ref => exactTextBySourceRef.get(ref)).find(text => text !== undefined);
    if (expected !== undefined && block.text !== expected) issues.push(issue(`${path}.text`, "EXACT block does not match authoritative source text"));
  }
  if (block.kind === "GM_NARRATION" && (!block.groundedIn || block.groundedIn.length === 0)) {
    issues.push(issue(`${path}.groundedIn`, "GM narration requires sources"));
  }
  return issues;
}

export function validateRenderPlanV1(
  value: unknown,
  options: { exactTextBySourceRef?: ReadonlyMap<string, string> } = {}
): SceneValidationResultV1 {
  if (!isObject(value)) return result(["renderPlan: expected object"]);
  const plan = value as Partial<RenderPlanV1>;
  const issues: string[] = [];
  if (plan.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  if (plan.contractVersion !== SCENE_SOCIAL_UI_CONTRACT_VERSION_V1) issues.push(issue("contractVersion", "invalid contract"));
  for (const key of ["operationId", "sceneId"] as const) issues.push(...nonEmpty(plan[key], key));
  issues.push(...positiveOrZeroInteger(plan.sourceRevision, "sourceRevision"));
  if (!Array.isArray(plan.blocks)) {
    issues.push(issue("blocks", "expected array"));
  } else {
    const exactMap = options.exactTextBySourceRef ?? new Map<string, string>();
    plan.blocks.forEach((block, index) => issues.push(...validateRenderBlock(block, index, exactMap)));
    const orders = plan.blocks.map(block => block.order);
    if (new Set(orders).size !== orders.length) issues.push(issue("blocks.order", "orders must be unique"));
  }
  if (!isObject(plan.rhythmDecision)) issues.push(issue("rhythmDecision", "expected object"));
  if (typeof plan.fallbackAllowed !== "boolean") issues.push(issue("fallbackAllowed", "expected boolean"));
  issues.push(...positiveInteger(plan.version, "version"));
  return result(issues);
}

export function validateDisplayPacketV1(value: unknown): SceneValidationResultV1 {
  if (!isObject(value)) return result(["displayPacket: expected object"]);
  const packet = value as Partial<DisplayPacketV1>;
  const issues: string[] = [];
  if (packet.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  if (packet.contractVersion !== SCENE_SOCIAL_UI_CONTRACT_VERSION_V1) issues.push(issue("contractVersion", "invalid contract"));
  for (const key of ["operationId", "sceneId"] as const) issues.push(...nonEmpty(packet[key], key));
  if (!Array.isArray(packet.displayBlocks)) {
    issues.push(issue("displayBlocks", "expected array"));
  } else {
    const actorLabels = new Map<string, string>();
    packet.displayBlocks.forEach((block, index) => {
      const path = `displayBlocks[${index}]`;
      issues.push(...nonEmpty(block.blockId, `${path}.blockId`));
      issues.push(...nonEmpty(block.text, `${path}.text`));
      issues.push(...nonEmpty(block.ariaLabel, `${path}.ariaLabel`));
      issues.push(...nonEmpty(block.roleLabel, `${path}.roleLabel`));
      issues.push(...nonEmpty(block.visualStyleToken, `${path}.visualStyleToken`));
      issues.push(...stringArray(block.sourceRefs, `${path}.sourceRefs`));
      if (!isObject(block.speaker)) {
        issues.push(issue(`${path}.speaker`, "expected object"));
      } else {
        issues.push(...nonEmpty(block.speaker.displayName, `${path}.speaker.displayName`));
        issues.push(...nonEmpty(block.speaker.roleLabel, `${path}.speaker.roleLabel`));
        issues.push(...nonEmpty(block.speaker.ariaLabel, `${path}.speaker.ariaLabel`));
        if (block.speaker.kind === "NPC" || block.speaker.kind === "PLAYER_CHARACTER") {
          const identity = `${block.speaker.displayName}|${block.speaker.roleLabel}|${block.speaker.ariaLabel}`;
          const previous = actorLabels.get(block.speaker.speakerId);
          if (previous !== undefined && previous !== identity) issues.push(issue(`${path}.speaker`, "speaker label changed inside packet"));
          actorLabels.set(block.speaker.speakerId, identity);
        }
      }
      if (typeof block.isDegradedFallback !== "boolean") issues.push(issue(`${path}.isDegradedFallback`, "expected boolean"));
    });
  }
  const hasRawInputBlock = Array.isArray(packet.displayBlocks)
    && packet.displayBlocks.some(block => block.kind === "RAW_INPUT");
  if (
    !isObject(packet.rawInputAccess)
    || typeof packet.rawInputAccess.available !== "boolean"
    || typeof packet.rawInputAccess.operationId !== "string"
    || packet.rawInputAccess.operationId.trim().length === 0
  ) {
    issues.push(issue("rawInputAccess", "expected a declared raw input availability and operation id"));
  } else if (hasRawInputBlock && packet.rawInputAccess.available !== true) {
    issues.push(issue("rawInputAccess.available", "must be true when a raw input block is displayed"));
  }
  issues.push(...stringArray(packet.reconstructionRefs, "reconstructionRefs"));
  issues.push(...positiveInteger(packet.version, "version"));
  return result(issues);
}

export function validateInteractionLogEntryV1(value: unknown): SceneValidationResultV1 {
  if (!isObject(value)) return result(["interactionLogEntry: expected object"]);
  const entry = value as Partial<InteractionLogEntryV1>;
  const issues: string[] = [];
  if (entry.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  if (entry.contractVersion !== SCENE_SOCIAL_UI_CONTRACT_VERSION_V1) issues.push(issue("contractVersion", "invalid contract"));
  for (const key of ["entryId", "campaignId", "operationId", "sceneId", "recordedAt", "text"] as const) issues.push(...nonEmpty(entry[key], key));
  issues.push(...positiveOrZeroInteger(entry.gameTime, "gameTime"));
  issues.push(...validateSpeakerRefV1(entry.speakerRef, "speakerRef").issues);
  issues.push(...stringArray(entry.sourceRefs, "sourceRefs"));
  issues.push(...stringArray(entry.eventRefs, "eventRefs"));
  if (entry.commitId !== null && typeof entry.commitId !== "string") issues.push(issue("commitId", "expected string or null"));
  if (!["PLAYER_VISIBLE", "ACTOR_SCOPED", "SYSTEM_ONLY"].includes(String(entry.visibility))) issues.push(issue("visibility", "invalid visibility"));
  issues.push(...positiveInteger(entry.version, "version"));
  return result(issues);
}

export function validateSuspendedClarificationV1(value: unknown): SceneValidationResultV1 {
  if (!isObject(value)) return result(["clarification: expected object"]);
  const clarification = value as Partial<SuspendedClarificationV1>;
  const issues: string[] = [];
  if (clarification.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  for (const key of ["suspendedIntentId", "operationId", "sceneId", "rawInput", "knownInterpretation", "missingField", "question", "initialSnapshotId"] as const) {
    issues.push(...nonEmpty(clarification[key], key));
  }
  issues.push(...stringArray(clarification.dependencyRefs, "dependencyRefs"));
  if (clarification.noGameTime !== true) issues.push(issue("noGameTime", "clarification must not advance time"));
  return result(issues);
}
