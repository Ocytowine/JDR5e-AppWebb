import type { JsonObject } from "../core";

export const KNOWLEDGE_CLAIM_CONTRACT_V1 = "knowledge-claim/1" as const;
export const ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1 = "actor-claim-perspective/1" as const;
export const TESTIMONY_RECORD_CONTRACT_V1 = "testimony-record/1" as const;
export const ACTOR_KNOWLEDGE_ACQUISITION_CONTRACT_V1 = "actor-knowledge-acquisition/1" as const;
export const OBJECTIVE_CLAIM_RESOLUTION_CONTRACT_V1 = "objective-claim-resolution/1" as const;

export type KnowledgeSubjectKindV1 = "PLACE" | "ACTOR" | "EVENT" | "HISTORY" | "PLOT" | "OBJECT" | "OTHER";
export type ActorClaimStanceV1 = "KNOWN" | "BELIEVED" | "UNCERTAIN" | "INTENDS_TO_DECEIVE";
export type PublicClaimDeliveryV1 = "ASSERTION" | "QUALIFIED_BELIEF" | "UNCERTAINTY";
export type KnowledgeAcquisitionStatusV1 = "HEARD" | "OBSERVED" | "CONFIRMED" | "REFUTED";

export interface KnowledgeSubjectRefV1 extends JsonObject {
  schemaVersion: 1;
  subjectRef: string;
  subjectKind: KnowledgeSubjectKindV1;
  publicLabel: string | null;
}

/** A proposition is truth-neutral. Its presence never proves that it is true. */
export interface KnowledgeClaimV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof KNOWLEDGE_CLAIM_CONTRACT_V1;
  claimRef: string;
  subject: KnowledgeSubjectRefV1;
  proposition: string;
  sourceRefs: string[];
  version: 1;
}

/** Private perspective owned by the actor knowledge domain. */
export interface ActorClaimPerspectiveV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1;
  perspectiveRef: string;
  actorRef: string;
  claimRef: string;
  stance: ActorClaimStanceV1;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  supportRefs: string[];
  mayBeFalse: boolean;
  privateTruthRef: string | null;
  deceptionCauseRef: string | null;
  visibility: "PRIVATE_TO_ACTOR_DOMAIN";
  version: 1;
}

/** Records what was said. The private stance is referenced, never exposed as player truth. */
export interface TestimonyClaimLinkV1 extends JsonObject {
  claimRef: string;
  privatePerspectiveRef: string;
  publicDelivery: PublicClaimDeliveryV1;
}

export interface TestimonyRecordV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof TESTIMONY_RECORD_CONTRACT_V1;
  testimonyRef: string;
  operationRef: string;
  sceneRef: string;
  speakerActorRef: string;
  audienceActorRefs: string[];
  utteranceRef: string;
  claims: TestimonyClaimLinkV1[];
  sourceRefs: string[];
  authority: "ATTRIBUTED_SPEECH_ONLY";
  assertsObjectiveTruth: false;
  version: 1;
}

/** What one actor learned through a channel; this is not the objective resolution. */
export interface ActorKnowledgeAcquisitionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof ACTOR_KNOWLEDGE_ACQUISITION_CONTRACT_V1;
  acquisitionRef: string;
  actorRef: string;
  claimRef: string;
  status: KnowledgeAcquisitionStatusV1;
  channelRef: string;
  sourceRefs: string[];
  assertsObjectiveTruth: false;
  version: 1;
}

/** Only a domain owning the fact may confirm or refute a proposition. */
export interface ObjectiveClaimResolutionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof OBJECTIVE_CLAIM_RESOLUTION_CONTRACT_V1;
  resolutionRef: string;
  claimRef: string;
  resolution: "CONFIRMED" | "REFUTED";
  ownerDomain: string;
  factRefs: string[];
  visibility: "PLAYER_VISIBLE" | "ACTOR_SCOPED" | "SYSTEM_PRIVATE";
  version: 1;
}

export type KnowledgeContractValidationV1 = { ok: true } | { ok: false; issues: string[] };

export function validateKnowledgeClaimV1(value: KnowledgeClaimV1): KnowledgeContractValidationV1 {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || value.contractVersion !== KNOWLEDGE_CLAIM_CONTRACT_V1 || value.version !== 1) issues.push("knowledge claim contract version is invalid");
  requireRef(value.claimRef, "claimRef", issues);
  requireRef(value.subject.subjectRef, "subject.subjectRef", issues);
  if (!allowedSubjectKinds.has(value.subject.subjectKind)) issues.push("subject.subjectKind is invalid");
  if (value.subject.publicLabel !== null && !value.subject.publicLabel.trim()) issues.push("subject.publicLabel must be null or non-empty");
  requireText(value.proposition, "proposition", issues);
  requireRefs(value.sourceRefs, "sourceRefs", issues);
  return result(issues);
}

export function validateActorClaimPerspectiveV1(value: ActorClaimPerspectiveV1): KnowledgeContractValidationV1 {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || value.contractVersion !== ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1 || value.version !== 1) issues.push("actor perspective contract version is invalid");
  requireRef(value.perspectiveRef, "perspectiveRef", issues);
  requireRef(value.actorRef, "actorRef", issues);
  requireRef(value.claimRef, "claimRef", issues);
  if (!allowedStances.has(value.stance)) issues.push("stance is invalid");
  if (!["LOW", "MEDIUM", "HIGH"].includes(value.confidence)) issues.push("confidence is invalid");
  requireRefs(value.supportRefs, "supportRefs", issues);
  if (value.stance === "KNOWN" && value.mayBeFalse) issues.push("KNOWN perspective cannot declare mayBeFalse");
  if (value.stance === "INTENDS_TO_DECEIVE") {
    if (value.privateTruthRef === null) issues.push("intentional deception requires privateTruthRef");
    if (value.deceptionCauseRef === null) issues.push("intentional deception requires deceptionCauseRef");
  } else if (value.deceptionCauseRef !== null) {
    issues.push("deceptionCauseRef is reserved for intentional deception");
  }
  if (value.privateTruthRef !== null) requireRef(value.privateTruthRef, "privateTruthRef", issues);
  if (value.deceptionCauseRef !== null) requireRef(value.deceptionCauseRef, "deceptionCauseRef", issues);
  if (value.visibility !== "PRIVATE_TO_ACTOR_DOMAIN") issues.push("actor perspective must remain private");
  return result(issues);
}

export function validateTestimonyRecordV1(value: TestimonyRecordV1): KnowledgeContractValidationV1 {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || value.contractVersion !== TESTIMONY_RECORD_CONTRACT_V1 || value.version !== 1) issues.push("testimony contract version is invalid");
  for (const [field, ref] of [["testimonyRef", value.testimonyRef], ["operationRef", value.operationRef], ["sceneRef", value.sceneRef], ["speakerActorRef", value.speakerActorRef], ["utteranceRef", value.utteranceRef]] as const) requireRef(ref, field, issues);
  requireRefs(value.audienceActorRefs, "audienceActorRefs", issues);
  requireRefs(value.sourceRefs, "sourceRefs", issues);
  if (value.claims.length === 0) issues.push("testimony requires at least one claim");
  const claimRefs = new Set<string>();
  for (const [index, claim] of value.claims.entries()) {
    requireRef(claim.claimRef, `claims[${index}].claimRef`, issues);
    requireRef(claim.privatePerspectiveRef, `claims[${index}].privatePerspectiveRef`, issues);
    if (!allowedDeliveries.has(claim.publicDelivery)) issues.push(`claims[${index}].publicDelivery is invalid`);
    if (claimRefs.has(claim.claimRef)) issues.push(`claims[${index}].claimRef is duplicated`);
    claimRefs.add(claim.claimRef);
  }
  if (value.authority !== "ATTRIBUTED_SPEECH_ONLY" || value.assertsObjectiveTruth !== false) issues.push("testimony must remain attributed speech without objective truth authority");
  return result(issues);
}

export function validateActorKnowledgeAcquisitionV1(value: ActorKnowledgeAcquisitionV1): KnowledgeContractValidationV1 {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || value.contractVersion !== ACTOR_KNOWLEDGE_ACQUISITION_CONTRACT_V1 || value.version !== 1) issues.push("knowledge acquisition contract version is invalid");
  for (const [field, ref] of [["acquisitionRef", value.acquisitionRef], ["actorRef", value.actorRef], ["claimRef", value.claimRef], ["channelRef", value.channelRef]] as const) requireRef(ref, field, issues);
  requireRefs(value.sourceRefs, "sourceRefs", issues);
  if (!["HEARD", "OBSERVED", "CONFIRMED", "REFUTED"].includes(value.status)) issues.push("knowledge acquisition status is invalid");
  if (value.status === "HEARD" && !value.channelRef.startsWith("testimony:")) issues.push("HEARD acquisition requires a testimony channel");
  if (["CONFIRMED", "REFUTED"].includes(value.status) && !value.channelRef.startsWith("claim-resolution:")) issues.push("confirmed or refuted acquisition requires an objective claim resolution channel");
  if (value.assertsObjectiveTruth !== false) issues.push("actor knowledge acquisition cannot assert objective truth");
  return result(issues);
}

export function validateObjectiveClaimResolutionV1(value: ObjectiveClaimResolutionV1): KnowledgeContractValidationV1 {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || value.contractVersion !== OBJECTIVE_CLAIM_RESOLUTION_CONTRACT_V1 || value.version !== 1) issues.push("objective claim resolution contract version is invalid");
  requireRef(value.resolutionRef, "resolutionRef", issues);
  requireRef(value.claimRef, "claimRef", issues);
  requireText(value.ownerDomain, "ownerDomain", issues);
  requireRefs(value.factRefs, "factRefs", issues);
  if (!["CONFIRMED", "REFUTED"].includes(value.resolution)) issues.push("objective resolution is invalid");
  if (!["PLAYER_VISIBLE", "ACTOR_SCOPED", "SYSTEM_PRIVATE"].includes(value.visibility)) issues.push("objective resolution visibility is invalid");
  return result(issues);
}

export function buildHeardKnowledgeAcquisitionsV1(input: {
  actorRef: string;
  testimony: TestimonyRecordV1;
}): { ok: true; acquisitions: ActorKnowledgeAcquisitionV1[] } | { ok: false; issues: string[] } {
  const testimonyValidation = validateTestimonyRecordV1(input.testimony);
  const actorIssues: string[] = [];
  requireRef(input.actorRef, "actorRef", actorIssues);
  if (!input.testimony.audienceActorRefs.includes(input.actorRef)) actorIssues.push("actorRef must be an audience of the testimony");
  const issues = [...(testimonyValidation.ok ? [] : testimonyValidation.issues), ...actorIssues];
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    acquisitions: input.testimony.claims.map((claim, index) => ({
      schemaVersion: 1,
      contractVersion: ACTOR_KNOWLEDGE_ACQUISITION_CONTRACT_V1,
      acquisitionRef: `knowledge-acquisition:${input.testimony.testimonyRef.replace(/^[^:]+:/u, "")}:${index + 1}`,
      actorRef: input.actorRef,
      claimRef: claim.claimRef,
      status: "HEARD",
      channelRef: input.testimony.testimonyRef,
      sourceRefs: [...new Set([...input.testimony.sourceRefs, input.testimony.utteranceRef, claim.claimRef])],
      assertsObjectiveTruth: false,
      version: 1
    }))
  };
}

const allowedSubjectKinds = new Set<KnowledgeSubjectKindV1>(["PLACE", "ACTOR", "EVENT", "HISTORY", "PLOT", "OBJECT", "OTHER"]);
const allowedStances = new Set<ActorClaimStanceV1>(["KNOWN", "BELIEVED", "UNCERTAIN", "INTENDS_TO_DECEIVE"]);
const allowedDeliveries = new Set<PublicClaimDeliveryV1>(["ASSERTION", "QUALIFIED_BELIEF", "UNCERTAINTY"]);

function requireRef(value: string, field: string, issues: string[]): void {
  if (!/^[a-z][a-z0-9_-]*:.+/u.test(value)) issues.push(`${field} must be a canonical ref`);
}

function requireRefs(values: string[], field: string, issues: string[]): void {
  if (values.length === 0) issues.push(`${field} must not be empty`);
  values.forEach((value, index) => requireRef(value, `${field}[${index}]`, issues));
  if (new Set(values).size !== values.length) issues.push(`${field} must not contain duplicates`);
}

function requireText(value: string, field: string, issues: string[]): void {
  if (!value.trim()) issues.push(`${field} must be non-empty`);
}

function result(issues: string[]): KnowledgeContractValidationV1 {
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
