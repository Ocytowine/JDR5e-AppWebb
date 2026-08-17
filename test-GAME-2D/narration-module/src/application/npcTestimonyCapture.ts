import {
  computeJsonFingerprint,
  type CampaignId,
  type CampaignRepository,
  type Result
} from "../core";
import type { NpcPerformerPayloadV1, SpeechActV1 } from "../ai/types";
import {
  ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1,
  KNOWLEDGE_CLAIM_CONTRACT_V1,
  TESTIMONY_RECORD_CONTRACT_V1,
  type ActorClaimPerspectiveV1,
  type KnowledgeClaimV1,
  type TestimonyRecordV1
} from "./knowledgeClaims";
import {
  RECORD_ATTRIBUTED_TESTIMONY_COMMAND_V1,
  loadKnowledgeSubjectRegistryV1,
  recordAttributedTestimonyV1,
  type RecordAttributedTestimonyCommandV1,
  type RecordAttributedTestimonyResultV1
} from "./knowledgeAuthority";
import {
  resolveKnowledgeSubjectCandidateV1,
  type KnowledgeSubjectDossierV1
} from "./knowledgeSubjects";

// `record-testimony:` and the longest downstream `:command` suffix must still fit in 128 characters.
const MAX_LEGACY_TESTIMONY_CLIENT_REQUEST_ID_LENGTH = 103;

export type NpcTestimonyPreparationV1 =
  | { status: "READY"; command: RecordAttributedTestimonyCommandV1 }
  | { status: "NOTHING_TO_RECORD"; reason: string }
  | { status: "SUBJECT_UNRESOLVED"; reason: string };

export interface NpcTestimonyCaptureResultV1 {
  status: "RECORDED" | "SKIPPED";
  testimony: RecordAttributedTestimonyResultV1 | null;
  reason: string;
}

export async function prepareNpcTestimonyCommandV1(input: {
  performance: NpcPerformerPayloadV1;
  sourceOperationId: string;
  sceneRef: string;
  playerActorRef: string;
  occurredAtGameSecond: number;
  existingSubjects: KnowledgeSubjectDossierV1[];
}): Promise<NpcTestimonyPreparationV1> {
  const utterance = input.performance.utterances[0];
  if (utterance === undefined) return { status: "NOTHING_TO_RECORD", reason: "performance has no utterance" };
  const assertions = utterance.speechActs
    .map((speechAct, speechActIndex) => ({ speechAct, speechActIndex }))
    .filter(entry => entry.speechAct.type === "assertion");
  if (assertions.length === 0) return { status: "NOTHING_TO_RECORD", reason: "utterance contains no assertion" };
  const candidates = input.performance.knowledgeClaims ?? [];
  const dossiers: KnowledgeSubjectDossierV1[] = [];
  const claims: KnowledgeClaimV1[] = [];
  const perspectives: ActorClaimPerspectiveV1[] = [];
  const links: TestimonyRecordV1["claims"] = [];
  const speakerActorRef = actorRef(input.performance.actorId);
  for (const { speechAct, speechActIndex } of assertions) {
    const candidate = candidates.find(entry =>
      entry.utteranceId === utterance.utteranceId && entry.speechActIndex === speechActIndex
    );
    if (candidate === undefined) return { status: "SUBJECT_UNRESOLVED", reason: `missing subject candidate for assertion ${speechActIndex}` };
    const subject = resolveKnowledgeSubjectCandidateV1({
      candidate,
      existingSubjects: [...input.existingSubjects, ...dossiers],
      sourceRefs: uniqueRefs([`operation:${input.sourceOperationId}`, ...speechAct.sourceRefs])
    });
    if (!subject.ok) return { status: "SUBJECT_UNRESOLVED", reason: subject.issues.join(" | ") };
    if (!dossiers.some(entry => entry.subject.subjectRef === subject.dossier.subject.subjectRef)) dossiers.push(subject.dossier);
    const fingerprint = (await computeJsonFingerprint({
      subjectRef: subject.dossier.subject.subjectRef,
      proposition: normalizeProposition(speechAct.content)
    })).replace(/^sha256:/u, "").slice(0, 32);
    const claimRef = `claim:${fingerprint}`;
    const perspectiveRef = `actor-perspective:${safeRefSegment(input.performance.actorId)}:${fingerprint}`;
    claims.push({
      schemaVersion: 1,
      contractVersion: KNOWLEDGE_CLAIM_CONTRACT_V1,
      claimRef,
      subject: subject.dossier.subject,
      proposition: speechAct.content.trim(),
      sourceRefs: uniqueRefs([`operation:${input.sourceOperationId}`, ...speechAct.sourceRefs]),
      version: 1
    });
    perspectives.push(buildPerspective({
      perspectiveRef,
      speakerActorRef,
      claimRef,
      speechAct
    }));
    links.push({
      claimRef,
      privatePerspectiveRef: perspectiveRef,
      publicDelivery: speechAct.epistemicBasis === "uncertain"
        ? "UNCERTAINTY"
        : speechAct.epistemicBasis === "believed" || speechAct.epistemicBasis === "deduced"
          ? "QUALIFIED_BELIEF"
          : "ASSERTION"
    });
  }
  const testimonyRef = `testimony:${safeRefSegment(input.sourceOperationId)}:${safeRefSegment(utterance.utteranceId)}`;
  const legacyClientRequestId = `${input.sourceOperationId}:testimony:${safeRefSegment(utterance.utteranceId)}`;
  const clientRequestId = legacyClientRequestId.length <= MAX_LEGACY_TESTIMONY_CLIENT_REQUEST_ID_LENGTH
    ? legacyClientRequestId
    : `npc-testimony-${(await computeJsonFingerprint({
        sourceOperationId: input.sourceOperationId,
        utteranceId: utterance.utteranceId
      })).replace(/^sha256:/u, "").slice(0, 32)}`;
  return {
    status: "READY",
    command: {
      schemaVersion: 1,
      contractVersion: RECORD_ATTRIBUTED_TESTIMONY_COMMAND_V1,
      clientRequestId,
      sourceOperationId: input.sourceOperationId,
      occurredAtGameSecond: input.occurredAtGameSecond,
      claims,
      subjects: dossiers,
      perspectives,
      testimony: {
        schemaVersion: 1,
        contractVersion: TESTIMONY_RECORD_CONTRACT_V1,
        testimonyRef,
        operationRef: `operation:${input.sourceOperationId}`,
        sceneRef: input.sceneRef,
        speakerActorRef,
        audienceActorRefs: [input.playerActorRef],
        utteranceRef: `utterance:${safeRefSegment(utterance.utteranceId)}`,
        claims: links,
        sourceRefs: uniqueRefs([
          `operation:${input.sourceOperationId}`,
          `npc-performance:${input.performance.performanceId}`,
          ...assertions.flatMap(entry => entry.speechAct.sourceRefs)
        ]),
        authority: "ATTRIBUTED_SPEECH_ONLY",
        assertsObjectiveTruth: false,
        version: 1
      }
    }
  };
}

export async function captureNpcTestimonyV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  performance: NpcPerformerPayloadV1;
  finalNpcSpeechText: string | null;
  sourceOperationId: string;
  sceneRef: string;
  playerActorRef: string;
  occurredAtGameSecond: number;
}): Promise<Result<NpcTestimonyCaptureResultV1>> {
  const utterance = input.performance.utterances[0];
  if (utterance === undefined || input.finalNpcSpeechText === null) {
    return { ok: true, value: { status: "SKIPPED", testimony: null, reason: "no visible NPC utterance" } };
  }
  if (normalizeVisibleText(utterance.text) !== normalizeVisibleText(input.finalNpcSpeechText)) {
    return { ok: true, value: { status: "SKIPPED", testimony: null, reason: "visible utterance differs from structured performance" } };
  }
  const registry = await loadKnowledgeSubjectRegistryV1(input.repository, input.campaignId);
  if (!registry.ok) return registry;
  const prepared = await prepareNpcTestimonyCommandV1({
    performance: input.performance,
    sourceOperationId: input.sourceOperationId,
    sceneRef: input.sceneRef,
    playerActorRef: input.playerActorRef,
    occurredAtGameSecond: input.occurredAtGameSecond,
    existingSubjects: registry.value.state.subjects
  });
  if (prepared.status !== "READY") {
    return { ok: true, value: { status: "SKIPPED", testimony: null, reason: prepared.reason } };
  }
  const recorded = await recordAttributedTestimonyV1({
    repository: input.repository,
    campaignId: input.campaignId,
    command: prepared.command
  });
  return recorded.ok
    ? { ok: true, value: { status: "RECORDED", testimony: recorded.value, reason: "structured testimony recorded" } }
    : recorded;
}

function buildPerspective(input: {
  perspectiveRef: string;
  speakerActorRef: string;
  claimRef: string;
  speechAct: SpeechActV1;
}): ActorClaimPerspectiveV1 {
  const stance = input.speechAct.epistemicBasis === "known"
    ? "KNOWN" as const
    : input.speechAct.epistemicBasis === "uncertain"
      ? "UNCERTAIN" as const
      : "BELIEVED" as const;
  return {
    schemaVersion: 1,
    contractVersion: ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1,
    perspectiveRef: input.perspectiveRef,
    actorRef: input.speakerActorRef,
    claimRef: input.claimRef,
    stance,
    confidence: stance === "KNOWN" ? "HIGH" : stance === "UNCERTAIN" ? "LOW" : "MEDIUM",
    supportRefs: uniqueRefs(input.speechAct.sourceRefs),
    mayBeFalse: stance !== "KNOWN",
    privateTruthRef: null,
    deceptionCauseRef: null,
    visibility: "PRIVATE_TO_ACTOR_DOMAIN",
    version: 1
  };
}

function actorRef(actorId: string): string {
  return `actor:${actorId.replace(/^actor:/u, "")}`;
}

function safeRefSegment(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-zA-Z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "") || "unknown";
}

function normalizeProposition(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("fr");
}

function normalizeVisibleText(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function uniqueRefs(refs: string[]): string[] {
  return [...new Set(refs)].sort();
}
