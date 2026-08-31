import type { NpcPerformerPayloadV1 } from "../ai/types";
import type { JsonObject } from "../core";
import type {
  NpcAuthorizedDisclosureFactV1,
  NpcInformationDisclosureProjectionV1
} from "./npcInformationDisclosure";

export const NPC_INFORMATION_PERFORMER_PROJECTION_V1 =
  "npc-information-performer-projection/1" as const;

export interface NpcInformationAlternativePresentationV1 extends JsonObject {
  schemaVersion: 1;
  actorRef: string;
  displayName: string;
}

export interface NpcInformationMissingPropertyPresentationV1 extends JsonObject {
  propertyRef: string;
  publicLabel: string;
}

/**
 * Player-facing performer boundary. It deliberately carries neither lookup
 * candidates rejected by disclosure nor private owner evidence.
 */
export interface NpcInformationPerformerProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NPC_INFORMATION_PERFORMER_PROJECTION_V1;
  projectionId: string;
  actorRef: string;
  decision: NpcInformationDisclosureProjectionV1["decision"];
  causeCode: NpcInformationDisclosureProjectionV1["cause"]["code"];
  authorizedFacts: NpcAuthorizedDisclosureFactV1[];
  answerCoverage: {
    status: "COMPLETE" | "PARTIAL" | "NONE";
    missingProperties: NpcInformationMissingPropertyPresentationV1[];
  };
  alternatives: NpcInformationAlternativePresentationV1[];
  allowedSourceRefs: string[];
  formulationInstruction: string;
  authority: "FORMULATION_FROM_AUTHORIZED_DISCLOSURE_ONLY";
  performerMayCreateFacts: false;
  noCommit: true;
  version: 1;
}

export interface NpcInformationPerformanceDiagnosticV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "npc-information-performance-diagnostic/1";
  status: "RESOLVED" | "FAILED";
  failureStage: "LOOKUP_KNOWLEDGE_DISCLOSURE" | null;
  failureReason: string | null;
  lookup: { candidateCount: number; missingDimensions: string[]; authorities: string[] };
  knowledge: { knownCandidateCount: number; unknownCandidateCount: number; bases: string[] };
  disclosure: {
    decision: NpcInformationDisclosureProjectionV1["decision"];
    causeCode: NpcInformationDisclosureProjectionV1["cause"]["code"];
    authorizedFactCount: number;
    withheldCandidateCount: number;
    alternativeActorRefs: string[];
  };
  privateValuesIncluded: false;
}

export function buildNpcInformationPerformerProjectionV1(input: {
  disclosure: NpcInformationDisclosureProjectionV1;
  alternativePresentations?: NpcInformationAlternativePresentationV1[];
  missingProperties?: NpcInformationMissingPropertyPresentationV1[];
}): NpcInformationPerformerProjectionV1 {
  const alternativesByRef = new Map((input.alternativePresentations ?? []).map(entry => [entry.actorRef, entry] as const));
  const alternatives = input.disclosure.cause.alternativeActorRefs.flatMap(actorRef => {
    const presentation = alternativesByRef.get(actorRef);
    return presentation === undefined ? [] : [structuredClone(presentation)];
  });
  const allowedSourceRefs = unique([
    ...input.disclosure.cause.publicPolicyRefs,
    ...input.disclosure.authorizedFacts.flatMap(fact => fact.sourceRefs),
    ...(input.missingProperties ?? []).map(property => property.propertyRef)
  ]);
  const missingProperties = uniqueMissingProperties(input.missingProperties ?? []);
  const answerCoverage = input.disclosure.authorizedFacts.length === 0
    ? "NONE" as const
    : missingProperties.length > 0
      ? "PARTIAL" as const
      : "COMPLETE" as const;
  return {
    schemaVersion: 1,
    contractVersion: NPC_INFORMATION_PERFORMER_PROJECTION_V1,
    projectionId: input.disclosure.projectionId,
    actorRef: input.disclosure.actorRef,
    decision: input.disclosure.decision,
    causeCode: input.disclosure.cause.code,
    authorizedFacts: structuredClone(input.disclosure.authorizedFacts),
    answerCoverage: { status: answerCoverage, missingProperties },
    alternatives,
    allowedSourceRefs,
    formulationInstruction: formulationInstruction(input.disclosure.decision),
    authority: "FORMULATION_FROM_AUTHORIZED_DISCLOSURE_ONLY",
    performerMayCreateFacts: false,
    noCommit: true,
    version: 1
  };
}

export function buildNpcInformationFallbackPayloadV1(input: {
  projection: NpcInformationPerformerProjectionV1;
  basePerformance: NpcPerformerPayloadV1;
}): NpcPerformerPayloadV1 {
  if (input.basePerformance.actorId.replace(/^npc:/u, "") !== input.projection.actorRef.replace(/^actor:/u, "").replace(/^npc:/u, "")) {
    throw new Error("Information projection belongs to another performer actor.");
  }
  const baseUtterance = input.basePerformance.utterances[0];
  if (baseUtterance === undefined) throw new Error("NPC fallback base performance has no utterance.");
  const rendered = renderDisclosureFallback(input.projection);
  const subjectRef = input.projection.authorizedFacts[0]?.subjectRef ?? input.projection.actorRef;
  const sourceRefs = unique(rendered.sourceRefs.length > 0
    ? rendered.sourceRefs
    : input.projection.allowedSourceRefs);
  return {
    ...structuredClone(input.basePerformance),
    utterances: [{
      ...baseUtterance,
      text: rendered.text,
      speechActs: [{
        type: "assertion",
        content: rendered.text,
        epistemicBasis: rendered.epistemicBasis,
        sourceRefs
      }]
    }],
    knowledgeClaims: [{
      utteranceId: baseUtterance.utteranceId,
      speechActIndex: 0,
      subject: {
        mode: "KNOWN_REF",
        ref: subjectRef,
        kind: "OTHER",
        label: null
      }
    }],
    revealedRefs: unique(input.projection.authorizedFacts.flatMap(fact => fact.sourceRefs)),
    knowledgeUsed: sourceRefs,
    safetyConstraints: {
      noMechanicalSuccess: true,
      noSecretReveal: true,
      noDurableCommitment: true,
      noStateMutation: true
    }
  };
}

export function validateNpcPerformanceAgainstInformationProjectionV1(input: {
  projection: NpcInformationPerformerProjectionV1;
  performance: NpcPerformerPayloadV1;
}): string[] {
  const issues: string[] = [];
  const authorizedFactRefs = new Set(input.projection.authorizedFacts.flatMap(fact => fact.sourceRefs));
  const allowedAssertionRefs = new Set(input.projection.allowedSourceRefs);
  const assertions = input.performance.utterances.flatMap(utterance => utterance.speechActs.filter(act => act.type === "assertion"));
  const used = unique([
    ...input.performance.knowledgeUsed,
    ...input.performance.revealedRefs,
    ...assertions.flatMap(assertion => assertion.sourceRefs)
  ]);
  if (input.projection.actorRef.replace(/^actor:/u, "") !== input.performance.actorId.replace(/^npc:/u, "")) {
    issues.push("information projection actor does not match performer actor");
  }
  if (used.some(ref => /^(?:secret|private|hidden):/iu.test(ref))) {
    issues.push("performance exposes a private source reference");
  }
  if (input.performance.revealedRefs.some(ref => !authorizedFactRefs.has(ref))) {
    issues.push("performance reveals a reference outside authorized facts");
  }
  if (assertions.some(assertion => assertion.sourceRefs.some(ref =>
    !allowedAssertionRefs.has(ref)
    && !ref.startsWith("intent:")
  ))) {
    issues.push("performance assertion uses a source outside the authorized disclosure projection");
  }
  if (["ANSWER_DIRECTLY", "ANSWER_QUALIFIED"].includes(input.projection.decision)) {
    if (input.projection.authorizedFacts.length === 0 || !assertions.some(assertion => assertion.sourceRefs.some(ref => authorizedFactRefs.has(ref)))) {
      issues.push("factual answer is not grounded in an authorized fact");
    }
  }
  if (input.projection.answerCoverage.status === "PARTIAL" && input.projection.authorizedFacts.length === 0) {
    issues.push("partial answer coverage requires an authorized fact");
  }
  if (input.projection.answerCoverage.status === "NONE" && input.projection.authorizedFacts.length > 0) {
    issues.push("empty answer coverage contradicts authorized facts");
  }
  if (["WITHHOLD_PROTECTED", "ACTOR_DOES_NOT_KNOW", "REDIRECT_CREDIBLY"].includes(input.projection.decision)
    && input.performance.revealedRefs.length > 0) {
    issues.push("non-answer disclosure must not reveal a fact reference");
  }
  return issues;
}

function renderDisclosureFallback(projection: NpcInformationPerformerProjectionV1): {
  text: string;
  epistemicBasis: "known" | "believed" | "uncertain";
  sourceRefs: string[];
} {
  const values = projection.authorizedFacts.map(fact => fact.value.trim()).filter(Boolean);
  const factRefs = unique(projection.authorizedFacts.flatMap(fact => fact.sourceRefs));
  const policyRefs = projection.allowedSourceRefs.filter(ref => ref.startsWith("policy:"));
  if (projection.decision === "ANSWER_DIRECTLY") {
    return {
      text: `« ${appendMissingQualification(joinFacts(values), projection)} »`,
      epistemicBasis: "known",
      sourceRefs: unique([...factRefs, ...projection.answerCoverage.missingProperties.map(property => property.propertyRef)])
    };
  }
  if (projection.decision === "ANSWER_QUALIFIED") {
    const uncertain = projection.authorizedFacts.some(fact => fact.delivery === "QUALIFIED_UNCERTAINTY");
    return {
      text: uncertain
        ? `« ${appendMissingQualification(`Je n'en suis pas certain, mais ${joinFacts(values, false)}`, projection)} »`
        : `« ${appendMissingQualification(`À ma connaissance, ${joinFacts(values, false)}`, projection)} »`,
      epistemicBasis: uncertain ? "uncertain" : "believed",
      sourceRefs: unique([...factRefs, ...projection.answerCoverage.missingProperties.map(property => property.propertyRef)])
    };
  }
  if (projection.decision === "WITHHOLD_PROTECTED") {
    return {
      text: "« Je connais cette information, mais je ne peux pas vous la communiquer. »",
      epistemicBasis: "known",
      sourceRefs: policyRefs
    };
  }
  if (projection.decision === "REDIRECT_CREDIBLY") {
    const names = projection.alternatives.map(entry => entry.displayName.trim()).filter(Boolean);
    return {
      text: names.length > 0
        ? `« Je ne peux pas vous répondre avec certitude. Adressez-vous à ${names.join(" ou ")}. »`
        : "« Je ne peux pas vous répondre avec certitude, mais je peux vous orienter vers la personne compétente. »",
      epistemicBasis: "known",
      sourceRefs: policyRefs
    };
  }
  return {
    text: "« Je ne sais pas. »",
    epistemicBasis: "known",
    sourceRefs: policyRefs
  };
}

function joinFacts(values: string[], capitalize = true): string {
  const joined = values.length === 0 ? "je ne dispose d'aucune réponse établie." : `${values.join(" ; ")}.`;
  return capitalize ? joined.charAt(0).toLocaleUpperCase("fr") + joined.slice(1) : joined;
}

function formulationInstruction(decision: NpcInformationPerformerProjectionV1["decision"]): string {
  const common = "Formuler une réplique naturelle uniquement depuis authorizedFacts, answerCoverage et allowedSourceRefs; ne créer, compléter ni déduire aucun fait. Le profil conversationnel règle le style mais ne prouve aucun comportement actuel du joueur : ne lui reprocher ni ton, posture, agressivité ou imprécision sans source publique explicite. Si answerCoverage est PARTIAL, donner d'abord les faits autorisés, puis limiter explicitement l'incertitude aux missingProperties; ne jamais convertir une réponse partielle en ignorance globale.";
  if (decision === "ANSWER_DIRECTLY") return `${common} Affirmer les faits objectifs sans refus générique lié au rôle du PNJ.`;
  if (decision === "ANSWER_QUALIFIED") return `${common} Conserver exactement la qualification de croyance ou d'incertitude de chaque fait.`;
  if (decision === "WITHHOLD_PROTECTED") return `${common} Refuser sans nommer, paraphraser ou laisser deviner l'information retenue.`;
  if (decision === "REDIRECT_CREDIBLY") return `${common} Orienter uniquement vers les alternatives fournies, sans inventer leur réponse.`;
  return `${common} Reconnaître simplement l'ignorance réelle du PNJ, sans demander une reformulation ni admonester le joueur.`;
}

function appendMissingQualification(
  establishedText: string,
  projection: NpcInformationPerformerProjectionV1
): string {
  if (projection.answerCoverage.status !== "PARTIAL") return establishedText;
  const labels = projection.answerCoverage.missingProperties.map(property => property.publicLabel.trim()).filter(Boolean);
  if (labels.length === 0) return establishedText;
  return `${establishedText} Je ne peux toutefois pas préciser ${labels.join(" ni ")} avec certitude.`;
}

function uniqueMissingProperties(values: NpcInformationMissingPropertyPresentationV1[]): NpcInformationMissingPropertyPresentationV1[] {
  const byRef = new Map<string, NpcInformationMissingPropertyPresentationV1>();
  for (const property of values) {
    if (!/^[a-z][a-z0-9_-]*:.+/u.test(property.propertyRef) || /^(?:secret|private|hidden):/iu.test(property.propertyRef)) continue;
    if (!property.publicLabel.trim()) continue;
    byRef.set(property.propertyRef, { propertyRef: property.propertyRef, publicLabel: property.publicLabel.trim() });
  }
  return [...byRef.values()].sort((left, right) => left.propertyRef.localeCompare(right.propertyRef, "fr"));
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "fr"));
}
