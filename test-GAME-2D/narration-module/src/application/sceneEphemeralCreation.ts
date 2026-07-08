import type { JsonObject } from "../core";
import type { PlayableSceneStateV1 } from "./playableScene";

export const SCENE_EPHEMERAL_CREATION_CONTRACT_VERSION_V1 = "scene-ephemeral-creation/1" as const;

export type SceneEphemeralCreationKindV1 =
  | "ambient_sound"
  | "sensory_detail"
  | "background_extra"
  | "minor_obstacle";

export interface SceneEphemeralCreationPolicyV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_EPHEMERAL_CREATION_CONTRACT_VERSION_V1;
  sceneId: string;
  allowedKinds: SceneEphemeralCreationKindV1[];
  allowedGroundingRefs: string[];
  mustStayPlayerVisible: true;
  mustExpireAtTurnEnd: true;
  maxTextLength: number;
  forbiddenDurableCategories: string[];
  forbiddenPatterns: string[];
  version: 1;
}

export interface SceneEphemeralCreationProposalV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_EPHEMERAL_CREATION_CONTRACT_VERSION_V1;
  proposalId: string;
  kind: SceneEphemeralCreationKindV1;
  text: string;
  groundedIn: string[];
  playerVisible: true;
  expiresAt: "TURN_END";
  persistence: "EPHEMERAL_ONLY";
  createsDurableFact: false;
  promotesToLore: false;
  version: 1;
}

export type SceneEphemeralCreationValidationResultV1 =
  | {
    ok: true;
    decision: "ACCEPT_EPHEMERAL";
    proposal: SceneEphemeralCreationProposalV1;
  }
  | {
    ok: false;
    code:
      | "EPHEMERAL_SCHEMA_INVALID"
      | "EPHEMERAL_KIND_FORBIDDEN"
      | "EPHEMERAL_GROUNDING_INVALID"
      | "EPHEMERAL_DURABLE_RISK"
      | "EPHEMERAL_SECRET_RISK";
    issues: string[];
  };

const DEFAULT_ALLOWED_KINDS: SceneEphemeralCreationKindV1[] = [
  "ambient_sound",
  "sensory_detail",
  "background_extra",
  "minor_obstacle"
];

const DEFAULT_FORBIDDEN_DURABLE_CATEGORIES = [
  "PNJ durable",
  "nom propre nouveau",
  "objet utile",
  "indice d'intrigue",
  "secret",
  "faction",
  "lieu durable",
  "conséquence politique",
  "résolution tactique"
];

const DEFAULT_SECRET_RISK_PATTERNS = [
  "\\b(secret|indice caché|verite cachee|vérité cachée|complot|faction)\\b",
  "\\b(api[_-]?key|system:|prompt|__proto__|constructor|prototype)\\b"
];

const DEFAULT_DURABLE_RISK_PATTERNS = [
  "\\b(cle|clef|clé|arme|potion|artefact|lettre signee|lettre signée|carte au tresor|carte au trésor)\\b",
  "\\b(nouveau pnj|personnage important|capitaine|chef|noble|mage|assassin)\\b",
  "\\b(tu reussis|tu réussis|tu echoues|tu échoues|combat|initiative|degat|dégât)\\b"
];

const DEFAULT_FORBIDDEN_PATTERNS = [
  ...DEFAULT_SECRET_RISK_PATTERNS,
  ...DEFAULT_DURABLE_RISK_PATTERNS
];

export function buildSceneEphemeralCreationPolicyV1(scene: PlayableSceneStateV1): SceneEphemeralCreationPolicyV1 {
  return {
    schemaVersion: 1,
    contractVersion: SCENE_EPHEMERAL_CREATION_CONTRACT_VERSION_V1,
    sceneId: scene.sceneId,
    allowedKinds: [...DEFAULT_ALLOWED_KINDS],
    allowedGroundingRefs: [
      `playable-scene:${scene.sceneId}`,
      ...scene.aiSceneWriterPolicy.mayReference
    ],
    mustStayPlayerVisible: true,
    mustExpireAtTurnEnd: true,
    maxTextLength: 220,
    forbiddenDurableCategories: [...DEFAULT_FORBIDDEN_DURABLE_CATEGORIES],
    forbiddenPatterns: [...DEFAULT_FORBIDDEN_PATTERNS],
    version: 1
  };
}

export function validateSceneEphemeralCreationProposalV1(
  proposal: SceneEphemeralCreationProposalV1,
  policy: SceneEphemeralCreationPolicyV1
): SceneEphemeralCreationValidationResultV1 {
  const issues: string[] = [];
  if (proposal.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (proposal.contractVersion !== SCENE_EPHEMERAL_CREATION_CONTRACT_VERSION_V1) {
    issues.push("contractVersion must be scene-ephemeral-creation/1.");
  }
  if (!proposal.proposalId.trim()) issues.push("proposalId is required.");
  if (!proposal.text.trim()) issues.push("text is required.");
  if (proposal.text.length > policy.maxTextLength) issues.push(`text must stay below ${policy.maxTextLength} characters.`);
  if (proposal.playerVisible !== true) issues.push("playerVisible must be true.");
  if (proposal.expiresAt !== "TURN_END") issues.push("expiresAt must be TURN_END.");
  if (proposal.persistence !== "EPHEMERAL_ONLY") issues.push("persistence must be EPHEMERAL_ONLY.");
  if (proposal.createsDurableFact !== false) issues.push("createsDurableFact must be false.");
  if (proposal.promotesToLore !== false) issues.push("promotesToLore must be false.");
  if (!Array.isArray(proposal.groundedIn) || proposal.groundedIn.length === 0) issues.push("groundedIn must not be empty.");

  if (!policy.allowedKinds.includes(proposal.kind)) {
    return { ok: false, code: "EPHEMERAL_KIND_FORBIDDEN", issues: [`Kind ${proposal.kind} is not allowed.`] };
  }

  const unknownGrounding = proposal.groundedIn.filter(ref => !policy.allowedGroundingRefs.includes(ref));
  if (unknownGrounding.length > 0) {
    return { ok: false, code: "EPHEMERAL_GROUNDING_INVALID", issues: [`Unknown grounding refs: ${unknownGrounding.join(", ")}`] };
  }

  const normalized = normalize(proposal.text);
  const secretRiskPattern = DEFAULT_SECRET_RISK_PATTERNS.find(pattern => matchesPattern(proposal.text, normalized, pattern));
  if (secretRiskPattern) {
    return { ok: false, code: "EPHEMERAL_SECRET_RISK", issues: [`Proposal text matches forbidden pattern: ${secretRiskPattern}`] };
  }

  const durableRiskPattern = DEFAULT_DURABLE_RISK_PATTERNS.find(pattern => matchesPattern(proposal.text, normalized, pattern));
  if (durableRiskPattern) {
    return { ok: false, code: "EPHEMERAL_DURABLE_RISK", issues: [`Proposal text matches forbidden pattern: ${durableRiskPattern}`] };
  }

  const defaultPatterns = new Set([...DEFAULT_SECRET_RISK_PATTERNS, ...DEFAULT_DURABLE_RISK_PATTERNS]);
  const policyRiskPattern = policy.forbiddenPatterns
    .filter(pattern => !defaultPatterns.has(pattern))
    .find(pattern => matchesPattern(proposal.text, normalized, pattern));
  if (policyRiskPattern) {
    return { ok: false, code: "EPHEMERAL_DURABLE_RISK", issues: [`Proposal text matches policy forbidden pattern: ${policyRiskPattern}`] };
  }

  if (issues.some(issue => issue.includes("Durable") || issue.includes("promotesToLore") || issue.includes("persistence"))) {
    return { ok: false, code: "EPHEMERAL_DURABLE_RISK", issues };
  }
  if (issues.length > 0) return { ok: false, code: "EPHEMERAL_SCHEMA_INVALID", issues };

  return {
    ok: true,
    decision: "ACCEPT_EPHEMERAL",
    proposal: {
      ...proposal,
      groundedIn: [...proposal.groundedIn]
    }
  };
}

export function describeAcceptedSceneEphemeralCreationV1(proposal: SceneEphemeralCreationProposalV1): string {
  return `${proposal.text} Ce détail reste éphémère et disparaît à la fin du tour.`;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function matchesPattern(rawText: string, normalizedText: string, pattern: string): boolean {
  const expression = new RegExp(pattern, "iu");
  return expression.test(rawText) || expression.test(normalizedText);
}
