import type { JsonObject } from "../core";
import type { NpcKnowledgeClaimCandidateV1 } from "../ai/types";
import type { KnowledgeSubjectRefV1 } from "./knowledgeClaims";

export const KNOWLEDGE_SUBJECT_DOSSIER_CONTRACT_V1 = "knowledge-subject-dossier/1" as const;
export const KNOWLEDGE_SUBJECT_REGISTRY_CONTRACT_V1 = "knowledge-subject-registry/1" as const;

export interface KnowledgeSubjectDossierV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof KNOWLEDGE_SUBJECT_DOSSIER_CONTRACT_V1;
  subject: KnowledgeSubjectRefV1;
  identityStatus: "KNOWN_REFERENCE" | "HYPOTHETICAL";
  aliases: string[];
  sourceRefs: string[];
  assertsExistence: false;
  version: 1;
}

export interface KnowledgeSubjectRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof KNOWLEDGE_SUBJECT_REGISTRY_CONTRACT_V1;
  campaignId: string;
  subjects: KnowledgeSubjectDossierV1[];
  version: number;
}

export function resolveKnowledgeSubjectCandidateV1(input: {
  candidate: NpcKnowledgeClaimCandidateV1;
  existingSubjects: KnowledgeSubjectDossierV1[];
  sourceRefs: string[];
}): { ok: true; dossier: KnowledgeSubjectDossierV1 } | { ok: false; issues: string[] } {
  const subject = input.candidate.subject;
  if (subject.mode === "UNRESOLVED") {
    return { ok: false, issues: ["an unresolved subject cannot create a testimony"] };
  }
  if (subject.mode === "KNOWN_REF") {
    if (subject.ref === null) return { ok: false, issues: ["KNOWN_REF requires a subject ref"] };
    const existing = input.existingSubjects.find(entry => entry.subject.subjectRef === subject.ref);
    if (existing !== undefined) return { ok: true, dossier: existing };
    return {
      ok: true,
      dossier: {
        schemaVersion: 1,
        contractVersion: KNOWLEDGE_SUBJECT_DOSSIER_CONTRACT_V1,
        subject: {
          schemaVersion: 1,
          subjectRef: subject.ref,
          subjectKind: subject.kind,
          publicLabel: cleanLabel(subject.label)
        },
        identityStatus: "KNOWN_REFERENCE",
        aliases: cleanLabel(subject.label) === null ? [] : [cleanLabel(subject.label)!],
        sourceRefs: uniqueRefs(input.sourceRefs),
        assertsExistence: false,
        version: 1
      }
    };
  }
  const label = cleanLabel(subject.label);
  if (label === null) return { ok: false, issues: ["a hypothetical subject requires a label"] };
  const normalized = normalizeLabel(label);
  const existing = input.existingSubjects.find(entry =>
    entry.subject.subjectKind === subject.kind &&
    [entry.subject.publicLabel, ...entry.aliases].some(alias => alias !== null && normalizeLabel(alias) === normalized)
  );
  if (existing !== undefined) return { ok: true, dossier: existing };
  return {
    ok: true,
    dossier: {
      schemaVersion: 1,
      contractVersion: KNOWLEDGE_SUBJECT_DOSSIER_CONTRACT_V1,
      subject: {
        schemaVersion: 1,
        subjectRef: `${subjectPrefix(subject.kind)}:${slug(normalized)}`,
        subjectKind: subject.kind,
        publicLabel: label
      },
      identityStatus: "HYPOTHETICAL",
      aliases: [label],
      sourceRefs: uniqueRefs(input.sourceRefs),
      assertsExistence: false,
      version: 1
    }
  };
}

export function validateKnowledgeSubjectDossierV1(value: KnowledgeSubjectDossierV1): string[] {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || value.contractVersion !== KNOWLEDGE_SUBJECT_DOSSIER_CONTRACT_V1 || value.version !== 1) issues.push("subject dossier contract is invalid");
  if (!/^[a-z][a-z0-9_-]*:.+/u.test(value.subject.subjectRef)) issues.push("subjectRef must be canonical");
  if (!["PLACE", "ACTOR", "EVENT", "HISTORY", "PLOT", "OBJECT", "OTHER"].includes(value.subject.subjectKind)) issues.push("subjectKind is invalid");
  if (value.subject.publicLabel !== null && !value.subject.publicLabel.trim()) issues.push("publicLabel must be null or non-empty");
  if (!["KNOWN_REFERENCE", "HYPOTHETICAL"].includes(value.identityStatus)) issues.push("identityStatus is invalid");
  if (!Array.isArray(value.aliases) || value.aliases.some(alias => !alias.trim()) || new Set(value.aliases).size !== value.aliases.length) issues.push("aliases are invalid");
  if (value.sourceRefs.length === 0 || value.sourceRefs.some(ref => !/^[a-z][a-z0-9_-]*:.+/u.test(ref))) issues.push("sourceRefs are invalid");
  if (value.assertsExistence !== false) issues.push("a subject dossier cannot assert existence");
  return issues;
}

function cleanLabel(value: string | null): string | null {
  const cleaned = value?.trim().replace(/\s+/gu, " ") ?? "";
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeLabel(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/gu, " ").trim();
}

function slug(value: string): string {
  return value.replace(/\s+/gu, "-") || "sujet-sans-nom";
}

function subjectPrefix(kind: NpcKnowledgeClaimCandidateV1["subject"]["kind"]): string {
  return kind === "PLACE" ? "place-hypothesis" : `${kind.toLocaleLowerCase("en")}-hypothesis`;
}

function uniqueRefs(refs: string[]): string[] {
  return [...new Set(refs)].sort();
}
