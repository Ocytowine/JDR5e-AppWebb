export const INTENT_CLARIFICATION_CONTRACT_VERSION_V1 = "intent-clarification/1" as const;

export type NarrativeIntentTypeV1 =
  | "meta_question"
  | "possibility_query"
  | "memory_recall"
  | "speech"
  | "action"
  | "mixed"
  | "unclear_commitment";

export type NarrativeIntentCommitmentV1 = "none" | "hypothetical" | "conditional" | "committed" | "unclear";

export interface NarrativeIntentInterpretationV1 {
  schemaVersion: 1;
  contractVersion: typeof INTENT_CLARIFICATION_CONTRACT_VERSION_V1;
  intentId: string;
  intentType: NarrativeIntentTypeV1;
  commitment: NarrativeIntentCommitmentV1;
  coreMeaning: string;
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  expectedTimeEffect: "NO_GAME_TIME" | "DOMAIN_TO_DECIDE";
  safetyNotes: string[];
}

export interface SuspendedIntentRecordV1 {
  schemaVersion: 1;
  contractVersion: typeof INTENT_CLARIFICATION_CONTRACT_VERSION_V1;
  suspendedIntentId: string;
  operationId: string;
  rawInput: string;
  knownInterpretation: NarrativeIntentInterpretationV1;
  missingField: "commitment" | "target" | "meaning";
  question: string;
  noGameTime: true;
  createdAt: string;
}

export interface ClarificationResumeV1 {
  schemaVersion: 1;
  contractVersion: typeof INTENT_CLARIFICATION_CONTRACT_VERSION_V1;
  suspendedIntentId: string;
  answerRawInput: string;
  resumedCommitment: "hypothetical" | "committed" | "unclear";
  noGameTime: true;
}

export function interpretNarrativeInputV1(input: {
  intentId: string;
  rawInput: string;
}): NarrativeIntentInterpretationV1 {
  const text = normalize(input.rawInput);
  const hasQuestion = /[?？]/u.test(input.rawInput) || /^(est[- ]ce|peux|puis|peut|comment|pourquoi|combien|où|quand|quelle|quel|quels|quelles)\b/u.test(text);
  const asksPossibility = /\b(peux|puis|possible|possibilité|est[- ]ce que je peux|ai[- ]je le droit)\b/u.test(text);
  const mentionsRules = /\b(règle|regle|mécanique|mecanique|jet|bonus|action bonus|mj|interface|comment ça marche|comment ca marche)\b/u.test(text);
  const riskyAction = /\b(voler|attaque|attaquer|frapper|forcer|crocheter|menacer|mentir|fouiller|prendre|ouvrir|entrer)\b/u.test(text);
  const explicitAttempt = /\b(je tente|j'essaie|j essaie|je fais|je vole|j'attaque|j attaque|je frappe|je force|je crochete|je prends|j'ouvre|j ouvre)\b/u.test(text);
  const speechLike = /["«»]/u.test(input.rawInput) || /\b(je dis|je réponds|je reponds|je lui dis|je demande à|je demande a|je demande au|je demande aux)\b/u.test(text);
  const actionLike = explicitAttempt || /\b(je vais|je me dirige|j'avance|j avance|je regarde|j'observe|j observe)\b/u.test(text);

  if (hasQuestion && mentionsRules && !riskyAction) {
    return intent(input, "meta_question", "none", "NO_GAME_TIME", false, null, [
      "Question méta protégée: aucune action de jeu déclenchée."
    ]);
  }

  if (hasQuestion && asksPossibility && riskyAction && !explicitAttempt) {
    return intent(input, "possibility_query", "hypothetical", "NO_GAME_TIME", false, null, [
      "Question de possibilité: l'action évoquée ne doit pas être exécutée."
    ]);
  }

  if (hasQuestion && riskyAction && !explicitAttempt) {
    return intent(input, "unclear_commitment", "unclear", "NO_GAME_TIME", true, buildCommitmentQuestion(input.rawInput), [
      "Engagement ambigu: clarification obligatoire avant toute résolution."
    ]);
  }

  if (speechLike && actionLike) {
    return intent(input, "mixed", "committed", "DOMAIN_TO_DECIDE", false, null, [
      "Entrée mixte détectée mais non résolue en I-06E."
    ]);
  }

  if (speechLike) {
    return intent(input, "speech", "committed", "DOMAIN_TO_DECIDE", false, null, [
      "Parole détectée mais non reformulée en I-06E."
    ]);
  }

  if (actionLike || explicitAttempt) {
    return intent(input, "action", "committed", "DOMAIN_TO_DECIDE", false, null, [
      "Action détectée mais non résolue en I-06E."
    ]);
  }

  if (hasQuestion) {
    return intent(input, "meta_question", "none", "NO_GAME_TIME", false, null, [
      "Question sans engagement fictionnel détectée."
    ]);
  }

  return intent(input, "unclear_commitment", "unclear", "NO_GAME_TIME", true, buildCommitmentQuestion(input.rawInput), [
    "Entrée insuffisamment explicite: clarification requise."
  ]);
}

export function createSuspendedIntentRecordV1(input: {
  suspendedIntentId: string;
  operationId: string;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  createdAt: string;
}): SuspendedIntentRecordV1 {
  return {
    schemaVersion: 1,
    contractVersion: INTENT_CLARIFICATION_CONTRACT_VERSION_V1,
    suspendedIntentId: input.suspendedIntentId,
    operationId: input.operationId,
    rawInput: input.rawInput,
    knownInterpretation: input.interpretation,
    missingField: "commitment",
    question: input.interpretation.clarificationQuestion ?? buildCommitmentQuestion(input.rawInput),
    noGameTime: true,
    createdAt: input.createdAt
  };
}

export function resumeSuspendedIntentV1(input: {
  suspendedIntentId: string;
  answerRawInput: string;
}): ClarificationResumeV1 {
  const text = normalize(input.answerRawInput);
  const committed = /\b(oui|je tente|j'essaie|j essaie|je le fais|je veux le faire|vas-y|effectivement)\b/u.test(text);
  const hypothetical = /\b(non|je demande|juste savoir|seulement savoir|c'était une question|c etait une question|hypothèse|hypothese)\b/u.test(text);
  return {
    schemaVersion: 1,
    contractVersion: INTENT_CLARIFICATION_CONTRACT_VERSION_V1,
    suspendedIntentId: input.suspendedIntentId,
    answerRawInput: input.answerRawInput,
    resumedCommitment: committed ? "committed" : hypothetical ? "hypothetical" : "unclear",
    noGameTime: true
  };
}

function intent(
  input: { intentId: string; rawInput: string },
  intentType: NarrativeIntentTypeV1,
  commitment: NarrativeIntentCommitmentV1,
  expectedTimeEffect: "NO_GAME_TIME" | "DOMAIN_TO_DECIDE",
  requiresClarification: boolean,
  clarificationQuestion: string | null,
  safetyNotes: string[]
): NarrativeIntentInterpretationV1 {
  return {
    schemaVersion: 1,
    contractVersion: INTENT_CLARIFICATION_CONTRACT_VERSION_V1,
    intentId: input.intentId,
    intentType,
    commitment,
    coreMeaning: input.rawInput.trim(),
    requiresClarification,
    clarificationQuestion,
    expectedTimeEffect,
    safetyNotes
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function buildCommitmentQuestion(rawInput: string): string {
  return `Tu demandes si c'est possible, ou tu veux réellement tenter cette action : « ${rawInput.trim()} » ?`;
}
