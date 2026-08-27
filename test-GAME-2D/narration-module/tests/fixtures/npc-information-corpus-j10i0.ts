export type NpcInformationResolutionPathJ10I0 =
  | "EXISTING_PUBLIC"
  | "MISSING_CREATABLE"
  | "ROLE_EXPECTED"
  | "TESTIMONY_QUALIFIED"
  | "PROTECTED"
  | "ACTOR_MAY_NOT_KNOW"
  | "NON_FACTUAL";

export interface NpcInformationCorpusCaseJ10I0 {
  caseId: string;
  rawInput: string;
  expectsInformationNeed: boolean;
  subjectMention: string | null;
  requestedDimension: string | null;
  temporalScope: "CURRENT" | "PAST" | "FUTURE" | "UNSPECIFIED" | null;
  expectedPath: NpcInformationResolutionPathJ10I0;
}

/**
 * Evaluation corpus only. It records semantic expectations but performs no
 * lexical classification and must never be imported by production code.
 */
export const NPC_INFORMATION_CORPUS_J10I0: readonly NpcInformationCorpusCaseJ10I0[] = [
  {
    caseId: "lysenthe-current-ruler",
    rawInput: "Qui dirige Lysenthe ?",
    expectsInformationNeed: true,
    subjectMention: "Lysenthe",
    requestedDimension: "dirigeant actuel",
    temporalScope: "CURRENT",
    expectedPath: "EXISTING_PUBLIC"
  },
  {
    caseId: "lysenthe-ruler-paraphrase",
    rawInput: "Je ne suis pas d'ici : qui gouverne cette ville en ce moment ?",
    expectsInformationNeed: true,
    subjectMention: "cette ville",
    requestedDimension: "autorité locale actuelle",
    temporalScope: "CURRENT",
    expectedPath: "EXISTING_PUBLIC"
  },
  {
    caseId: "lysenthe-ruler-name",
    rawInput: "Comment s'appelle le Tharque régent ?",
    expectsInformationNeed: true,
    subjectMention: "le Tharque régent",
    requestedDimension: "nom personnel",
    temporalScope: "CURRENT",
    expectedPath: "MISSING_CREATABLE"
  },
  {
    caseId: "lysenthe-ruler-seat",
    rawInput: "Où siège la personne qui gouverne Lysenthe ?",
    expectsInformationNeed: true,
    subjectMention: "la personne qui gouverne Lysenthe",
    requestedDimension: "siège du pouvoir",
    temporalScope: "CURRENT",
    expectedPath: "EXISTING_PUBLIC"
  },
  {
    caseId: "guard-report-procedure",
    rawInput: "À qui dois-je signaler une menace contre la ville ?",
    expectsInformationNeed: true,
    subjectMention: "une menace contre la ville",
    requestedDimension: "procédure de signalement",
    temporalScope: "CURRENT",
    expectedPath: "ROLE_EXPECTED"
  },
  {
    caseId: "archivist-public-consultation",
    rawInput: "Comment puis-je consulter un acte public ?",
    expectsInformationNeed: true,
    subjectMention: "un acte public",
    requestedDimension: "procédure de consultation",
    temporalScope: "CURRENT",
    expectedPath: "ROLE_EXPECTED"
  },
  {
    caseId: "local-directions",
    rawInput: "Quel chemin faut-il prendre pour rejoindre le Château Tharqual ?",
    expectsInformationNeed: true,
    subjectMention: "le Château Tharqual",
    requestedDimension: "itinéraire local",
    temporalScope: "CURRENT",
    expectedPath: "ACTOR_MAY_NOT_KNOW"
  },
  {
    caseId: "archive-rumor",
    rawInput: "Que raconte-t-on sur les salles fermées des Archives ?",
    expectsInformationNeed: true,
    subjectMention: "les salles fermées des Archives",
    requestedDimension: "rumeurs locales",
    temporalScope: "CURRENT",
    expectedPath: "TESTIMONY_QUALIFIED"
  },
  {
    caseId: "protected-secret",
    rawInput: "Quel secret votre chef protège-t-il ?",
    expectsInformationNeed: true,
    subjectMention: "votre chef",
    requestedDimension: "secret protégé",
    temporalScope: "CURRENT",
    expectedPath: "PROTECTED"
  },
  {
    caseId: "past-ruler",
    rawInput: "Qui gouvernait Lysenthe avant le Tharque actuel ?",
    expectsInformationNeed: true,
    subjectMention: "Lysenthe",
    requestedDimension: "ancien dirigeant",
    temporalScope: "PAST",
    expectedPath: "ACTOR_MAY_NOT_KNOW"
  },
  {
    caseId: "personal-wellbeing",
    rawInput: "Je lui demande s'il va bien.",
    expectsInformationNeed: false,
    subjectMention: null,
    requestedDimension: null,
    temporalScope: null,
    expectedPath: "NON_FACTUAL"
  },
  {
    caseId: "rhetorical-challenge",
    rawInput: "Pourtant, tout le monde connaît cette information.",
    expectsInformationNeed: false,
    subjectMention: null,
    requestedDimension: null,
    temporalScope: null,
    expectedPath: "NON_FACTUAL"
  },
  {
    caseId: "action-request",
    rawInput: "Prévenez votre chef immédiatement.",
    expectsInformationNeed: false,
    subjectMention: null,
    requestedDimension: null,
    temporalScope: null,
    expectedPath: "NON_FACTUAL"
  },
  {
    caseId: "conditional-future-speech",
    rawInput: "Si le garde accepte de m'aider, je lui révélerai le nom.",
    expectsInformationNeed: false,
    subjectMention: null,
    requestedDimension: null,
    temporalScope: null,
    expectedPath: "NON_FACTUAL"
  }
] as const;
