import type { JsonObject } from "../core";

export const NARRATIVE_DESIGNATION_CONTRACT_VERSION_V1 = "narrative-designation/1" as const;

export type NarrativeDesignationSubjectKindV1 = "ACTOR" | "PLACE";
export type NarrativeKnowledgeStatusV1 = "UNKNOWN" | "DESIGNATION" | "KNOWN";

/**
 * Player-facing identity only.
 *
 * An unknown canonical name must stay outside this projection. This lets every
 * consumer use a stable designation without accidentally revealing private
 * campaign data to a prompt, an alias registry or the UI.
 */
export interface NarrativeDesignationV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_DESIGNATION_CONTRACT_VERSION_V1;
  subjectRef: string;
  subjectKind: NarrativeDesignationSubjectKindV1;
  knowledgeStatus: NarrativeKnowledgeStatusV1;
  canonicalName: string | null;
  publicRole: string | null;
  playerFacingLabel: string;
  firstMention: string;
  subsequentMention: string;
  sourceRefs: string[];
  version: 1;
}

export function buildNarrativeDesignationV1(input: {
  subjectRef: string;
  subjectKind: NarrativeDesignationSubjectKindV1;
  knowledgeStatus: NarrativeKnowledgeStatusV1;
  canonicalName?: string | null;
  publicRole?: string | null;
  playerFacingLabel: string;
  firstMention?: string;
  subsequentMention?: string;
  sourceRefs: string[];
}): NarrativeDesignationV1 {
  const label = input.playerFacingLabel.trim();
  const canonicalName = input.knowledgeStatus === "KNOWN"
    ? input.canonicalName?.trim() || label
    : null;
  return {
    schemaVersion: 1,
    contractVersion: NARRATIVE_DESIGNATION_CONTRACT_VERSION_V1,
    subjectRef: input.subjectRef.trim(),
    subjectKind: input.subjectKind,
    knowledgeStatus: input.knowledgeStatus,
    canonicalName,
    publicRole: input.publicRole?.trim() || null,
    playerFacingLabel: label,
    firstMention: input.firstMention?.trim() || label,
    subsequentMention: input.subsequentMention?.trim() || label,
    sourceRefs: unique(input.sourceRefs),
    version: 1
  };
}

export function buildKnownNarrativeDesignationV1(input: {
  subjectRef: string;
  subjectKind: NarrativeDesignationSubjectKindV1;
  canonicalName: string;
  publicRole?: string | null;
  sourceRefs: string[];
}): NarrativeDesignationV1 {
  return buildNarrativeDesignationV1({
    ...input,
    knowledgeStatus: "KNOWN",
    playerFacingLabel: input.canonicalName,
    firstMention: input.canonicalName,
    subsequentMention: input.canonicalName
  });
}

export function revealNarrativeNameV1(input: {
  current: NarrativeDesignationV1;
  canonicalName: string;
  sourceRef: string;
}): NarrativeDesignationV1 {
  return buildKnownNarrativeDesignationV1({
    subjectRef: input.current.subjectRef,
    subjectKind: input.current.subjectKind,
    canonicalName: input.canonicalName,
    publicRole: input.current.publicRole,
    sourceRefs: [...input.current.sourceRefs, input.sourceRef]
  });
}

export function validateNarrativeDesignationV1(
  designation: NarrativeDesignationV1
): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (designation.contractVersion !== NARRATIVE_DESIGNATION_CONTRACT_VERSION_V1) {
    issues.push("contractVersion must be narrative-designation/1.");
  }
  if (!designation.subjectRef.trim()) issues.push("subjectRef is required.");
  if (!designation.playerFacingLabel.trim()) issues.push("playerFacingLabel is required.");
  if (!designation.firstMention.trim()) issues.push("firstMention is required.");
  if (!designation.subsequentMention.trim()) issues.push("subsequentMention is required.");
  if (designation.sourceRefs.some(sourceRef => !sourceRef.trim())) issues.push("sourceRefs must not contain empty values.");
  if (designation.knowledgeStatus === "KNOWN" && !designation.canonicalName?.trim()) {
    issues.push("KNOWN designation requires canonicalName.");
  }
  if (designation.knowledgeStatus !== "KNOWN" && designation.canonicalName !== null) {
    issues.push("An unrevealed canonicalName must not enter the player-facing designation.");
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function narrativeDesignationLabelV1(
  designation: NarrativeDesignationV1 | undefined,
  legacyLabel: string
): string {
  return designation?.playerFacingLabel.trim() || legacyLabel;
}

export function narrativeDesignationOfV1(
  subject: JsonObject,
  property: "designation" | "locationDesignation" = "designation"
): NarrativeDesignationV1 | undefined {
  const candidate = subject[property];
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
  const designation = candidate as unknown as NarrativeDesignationV1;
  return validateNarrativeDesignationV1(designation).ok ? designation : undefined;
}

export function narrativeFirstMentionV1(
  designation: NarrativeDesignationV1 | undefined,
  legacyLabel: string
): string {
  return designation?.firstMention.trim() || legacyLabel;
}

export function narrativeSubsequentMentionV1(
  designation: NarrativeDesignationV1 | undefined,
  legacyLabel: string
): string {
  return designation?.subsequentMention.trim() || legacyLabel;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}
