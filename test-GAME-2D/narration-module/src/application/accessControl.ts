import type { JsonObject } from "../core";

export const ACCESS_CONTROL_CONTRACT_V1 = "access-control/1" as const;

export type AccessControlStateV1 = "OPEN" | "CONTROLLED" | "BLOCKED" | "UNKNOWN";
export type AccessApproachDomainV1 = "social" | "inventory" | "perception" | "rules" | "tactical" | "world";

export interface AccessRequirementV1 extends JsonObject {
  schemaVersion: 1;
  requirementRef: string;
  kind: "AUTHORIZATION" | "ITEM" | "SOCIAL_PERMISSION" | "PHYSICAL_STATE" | "OTHER";
  description: string;
  status: "ACTIVE" | "SATISFIED" | "WAIVED";
  visibility: "PUBLIC" | "ACTOR_KNOWN" | "SYSTEM_PRIVATE";
  ownerDomain: string;
  sourceRefs: string[];
  version: 1;
}

export interface AccessControlRecordV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof ACCESS_CONTROL_CONTRACT_V1;
  accessControlRef: string;
  connectionId: string;
  sourceSceneId: string;
  boundaryRef: string;
  destinationRef: string;
  state: AccessControlStateV1;
  ownerDomain: string;
  thresholdDescription: string;
  requirements: AccessRequirementV1[];
  approachDomains: AccessApproachDomainV1[];
  approachesAreNonExhaustive: true;
  sourceRefs: string[];
  version: number;
}

export interface AccessTraversalDecisionV1 extends JsonObject {
  schemaVersion: 1;
  accessControlRef: string | null;
  disposition: "ALLOW" | "HANDOFF";
  code: "ACCESS_OPEN" | "ACCESS_CONTROLLED" | "ACCESS_BLOCKED" | "ACCESS_UNKNOWN" | "NO_ACCESS_CONTROL";
  state: AccessControlStateV1 | null;
  ownerDomain: string | null;
  playerKnownRequirements: Array<{
    requirementRef: string;
    description: string;
    status: "ACTIVE" | "SATISFIED" | "WAIVED";
    ownerDomain: string;
  }>;
  approachDomains: AccessApproachDomainV1[];
  approachesAreNonExhaustive: true;
  reason: string;
  commitAuthority: false;
}

export interface AccessApproachRouteV1 extends JsonObject {
  schemaVersion: 1;
  disposition: "ROUTE" | "CLARIFY";
  domain: AccessApproachDomainV1 | null;
  accessControlRef: string;
  reason: string;
  noSuccessDecision: true;
  noStateMutation: true;
}

export function validateAccessControlRecordV1(record: AccessControlRecordV1): string[] {
  const issues: string[] = [];
  if (record.schemaVersion !== 1 || record.contractVersion !== ACCESS_CONTROL_CONTRACT_V1) issues.push("access control contract mismatch");
  for (const [field, value] of [
    ["accessControlRef", record.accessControlRef],
    ["boundaryRef", record.boundaryRef],
    ["destinationRef", record.destinationRef]
  ] as const) if (!canonicalRef(value)) issues.push(`${field} must be canonical`);
  if (!record.connectionId.trim() || !record.sourceSceneId.trim() || !record.ownerDomain.trim() || !record.thresholdDescription.trim()) issues.push("connectionId, sourceSceneId, ownerDomain and thresholdDescription are required");
  if (!["OPEN", "CONTROLLED", "BLOCKED", "UNKNOWN"].includes(record.state)) issues.push("state is invalid");
  if (record.approachesAreNonExhaustive !== true) issues.push("approachesAreNonExhaustive must be true");
  if (!Number.isInteger(record.version) || record.version < 1) issues.push("version must be positive");
  if (record.sourceRefs.length === 0 || record.sourceRefs.some(ref => !canonicalRef(ref))) issues.push("sourceRefs must contain canonical refs");
  if (new Set(record.approachDomains).size !== record.approachDomains.length || record.approachDomains.some(domain => !allowedDomains.has(domain))) issues.push("approachDomains are invalid or duplicated");
  const requirementRefs = new Set<string>();
  for (const [index, requirement] of record.requirements.entries()) {
    if (requirement.schemaVersion !== 1 || requirement.version !== 1) issues.push(`requirements[${index}] contract is invalid`);
    if (!canonicalRef(requirement.requirementRef) || requirementRefs.has(requirement.requirementRef)) issues.push(`requirements[${index}].requirementRef is invalid or duplicated`);
    requirementRefs.add(requirement.requirementRef);
    if (!requirement.description.trim() || !requirement.ownerDomain.trim()) issues.push(`requirements[${index}] description and ownerDomain are required`);
    if (requirement.sourceRefs.length === 0 || requirement.sourceRefs.some(ref => !canonicalRef(ref))) issues.push(`requirements[${index}].sourceRefs are invalid`);
  }
  if (record.state === "OPEN" && record.requirements.some(requirement => requirement.status === "ACTIVE")) issues.push("OPEN access cannot retain an active requirement");
  return issues;
}

export function decideAccessTraversalV1(input: {
  connectionId: string;
  control: AccessControlRecordV1 | null;
}): AccessTraversalDecisionV1 {
  if (input.control === null) return accessDecision(null, "ALLOW", "NO_ACCESS_CONTROL", "Aucun contrôle d'accès distinct n'est attaché à cette connexion.");
  const control = input.control;
  const issues = validateAccessControlRecordV1(control);
  if (issues.length > 0 || control.connectionId !== input.connectionId) {
    return accessDecision(control, "HANDOFF", "ACCESS_UNKNOWN", `Le contrôle d'accès doit être réévalué : ${issues.join(" | ") || "connexion incohérente"}.`);
  }
  if (control.state === "OPEN") return accessDecision(control, "ALLOW", "ACCESS_OPEN", "Le domaine propriétaire déclare le passage ouvert.");
  if (control.state === "CONTROLLED") return accessDecision(control, "HANDOFF", "ACCESS_CONTROLLED", "Le personnage atteint le seuil, mais le franchissement dépend encore d'une résolution propriétaire.");
  if (control.state === "BLOCKED") return accessDecision(control, "HANDOFF", "ACCESS_BLOCKED", "Le personnage atteint le seuil, mais le passage est actuellement bloqué.");
  return accessDecision(control, "HANDOFF", "ACCESS_UNKNOWN", "Le personnage atteint le seuil, mais l'état du passage n'est pas encore établi.");
}

export function routeAccessApproachV1(input: {
  control: AccessControlRecordV1;
  requestedDomain: string | null;
  actionHint: string | null;
}): AccessApproachRouteV1 {
  const inferred = normalizeDomain(input.requestedDomain) ?? inferDomain(input.actionHint);
  if (inferred === null) {
    return { schemaVersion: 1, disposition: "CLARIFY", domain: null, accessControlRef: input.control.accessControlRef, reason: "L'approche du joueur doit être précisée sans lui imposer de solution.", noSuccessDecision: true, noStateMutation: true };
  }
  return {
    schemaVersion: 1,
    disposition: "ROUTE",
    domain: inferred,
    accessControlRef: input.control.accessControlRef,
    reason: input.control.approachDomains.includes(inferred)
      ? "L'approche correspond à un domaine déjà déclaré par le contrôle d'accès."
      : "L'approche reste recevable car la liste des solutions n'est jamais exhaustive; son domaine doit décider.",
    noSuccessDecision: true,
    noStateMutation: true
  };
}

function accessDecision(
  control: AccessControlRecordV1 | null,
  disposition: AccessTraversalDecisionV1["disposition"],
  code: AccessTraversalDecisionV1["code"],
  reason: string
): AccessTraversalDecisionV1 {
  return {
    schemaVersion: 1,
    accessControlRef: control?.accessControlRef ?? null,
    disposition,
    code,
    state: control?.state ?? null,
    ownerDomain: control?.ownerDomain ?? null,
    playerKnownRequirements: (control?.requirements ?? [])
      .filter(requirement => requirement.visibility !== "SYSTEM_PRIVATE")
      .map(requirement => ({ requirementRef: requirement.requirementRef, description: requirement.description, status: requirement.status, ownerDomain: requirement.ownerDomain })),
    approachDomains: [...(control?.approachDomains ?? [])],
    approachesAreNonExhaustive: true,
    reason,
    commitAuthority: false
  };
}

function normalizeDomain(value: string | null): AccessApproachDomainV1 | null {
  return value !== null && allowedDomains.has(value as AccessApproachDomainV1) ? value as AccessApproachDomainV1 : null;
}

function inferDomain(value: string | null): AccessApproachDomainV1 | null {
  if (value === null) return null;
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  if (/parl|demand|negoci|convain|ment/u.test(normalized)) return "social";
  if (/mandat|cle|objet|present/u.test(normalized)) return "inventory";
  if (/observ|cherche|inspect|autre passage/u.test(normalized)) return "perception";
  if (/force|crochet|enfon/u.test(normalized)) return "rules";
  if (/attaque|combat/u.test(normalized)) return "tactical";
  if (/repart|attend|contourn/u.test(normalized)) return "world";
  return null;
}

const allowedDomains = new Set<AccessApproachDomainV1>(["social", "inventory", "perception", "rules", "tactical", "world"]);

function canonicalRef(value: string): boolean {
  return /^[a-z][a-z0-9_-]*:.+/u.test(value);
}
