import type { AiRoleV1 } from "../ai/types";
import type { JsonObject } from "../core";
import type { InterpreterEmbodiedPublicContextV1 } from "./interpreterEmbodiedContext";

export const NARRATIVE_CONTEXT_MANIFEST_CONTRACT_V1 =
  "narrative-context-manifest/1" as const;

export type NarrativeContextClassificationV1 =
  | "PUBLIC"
  | "ROLE_PRIVATE"
  | "FORBIDDEN_FOR_AI";

export type NarrativeContextConsistencyV1 =
  | "STATIC_VERSIONED"
  | "CAMPAIGN_REVISION"
  | "SCENE_REVISION";

export type NarrativeContextTransportV1 =
  | "INLINE_ELIGIBLE"
  | "REFERENCE_ONLY"
  | "FORBIDDEN";

export type NarrativeContextProjectionKindV1 =
  | "PLAYER_RAW_INPUT"
  | "CHARACTER_PUBLIC"
  | "CHARACTER_NAMED_REFERENCES"
  | "SCENE_VISIBLE"
  | "INTERACTION_FOCUS"
  | "RECENT_SEMANTICS"
  | "ACQUIRED_PUBLIC_KNOWLEDGE"
  | "INFORMATION_SELECTORS"
  | "RUNTIME_CAPABILITIES"
  | "ACTIVE_PUBLIC_PROCESS"
  | "RESOLVED_TURN"
  | "NPC_PUBLIC_PROFILE"
  | "NPC_ROLE_PRIVATE_CONTEXT"
  | "NPC_DISCLOSURE"
  | "LORE_INFLUENCES"
  | "CREATION_BRIEF"
  | "CREATION_POLICY"
  | "MISSING_FACT_TARGET"
  | "PUBLIC_SOURCE_REFS"
  | "CANDIDATE_OUTPUT"
  | "RESOLUTION_EVIDENCE"
  | "COHERENCE_INVARIANTS"
  | "PLAYER_PRIVATE_NOTEBOOK"
  | "GM_SECRETS";

export interface NarrativeContextSnapshotV1 extends JsonObject {
  snapshotId: string;
  campaignRevision: number | null;
  sceneId: string | null;
  sceneVersion: number | null;
}

export interface NarrativeContextProjectionDescriptorV1 extends JsonObject {
  projectionId: string;
  kind: NarrativeContextProjectionKindV1;
  contractVersion: string;
  ownerId: string;
  sourceRefs: string[];
  classification: NarrativeContextClassificationV1;
  allowedRoles: AiRoleV1[];
  consistency: NarrativeContextConsistencyV1;
  sourceVersion: string;
  dependencyProjectionIds: string[];
  transport: NarrativeContextTransportV1;
  serializedCharacters: number;
}

export interface NarrativeContextRolePolicyV1 extends JsonObject {
  profileId: string;
  role: AiRoleV1;
  purpose: string;
  requiredProjectionIds: string[];
  optionalProjectionIds: string[];
  forbiddenProjectionIds: string[];
}

export interface NarrativeContextRoleRequirementV1 extends JsonObject {
  profileId: string;
  role: AiRoleV1;
  purpose: string;
  requiredKinds: NarrativeContextProjectionKindV1[];
  optionalKinds: NarrativeContextProjectionKindV1[];
  forbiddenKinds: NarrativeContextProjectionKindV1[];
}

export const NARRATIVE_CONTEXT_ROLE_REQUIREMENTS_V1: readonly NarrativeContextRoleRequirementV1[] = [
  requirement("player-intent-v8", "player_intent_interpreter", "Comprendre la saisie et proposer des références et capacités sans conséquence.",
    ["PLAYER_RAW_INPUT", "SCENE_VISIBLE", "INFORMATION_SELECTORS", "RUNTIME_CAPABILITIES"],
    ["CHARACTER_PUBLIC", "CHARACTER_NAMED_REFERENCES", "INTERACTION_FOCUS", "RECENT_SEMANTICS", "ACQUIRED_PUBLIC_KNOWLEDGE", "ACTIVE_PUBLIC_PROCESS"],
    ["NPC_ROLE_PRIVATE_CONTEXT", "NPC_DISCLOSURE", "PLAYER_PRIVATE_NOTEBOOK", "GM_SECRETS"]),
  requirement("npc-dialogue-performance", "npc_performer", "Produire la réplique d'un acteur depuis un acte résolu et les seuls faits divulgables.",
    ["RESOLVED_TURN", "SCENE_VISIBLE", "NPC_PUBLIC_PROFILE", "NPC_DISCLOSURE"],
    ["NPC_ROLE_PRIVATE_CONTEXT", "PUBLIC_SOURCE_REFS", "INTERACTION_FOCUS"],
    ["PLAYER_RAW_INPUT", "INFORMATION_SELECTORS", "PLAYER_PRIVATE_NOTEBOOK", "GM_SECRETS"]),
  requirement("resolved-scene-render", "scene_writer", "Rendre les conséquences visibles déjà arbitrées sans réinterpréter le joueur.",
    ["RESOLVED_TURN", "SCENE_VISIBLE"],
    ["LORE_INFLUENCES", "PUBLIC_SOURCE_REFS", "ACTIVE_PUBLIC_PROCESS"],
    ["PLAYER_RAW_INPUT", "NPC_ROLE_PRIVATE_CONTEXT", "PLAYER_PRIVATE_NOTEBOOK", "GM_SECRETS"]),
  requirement("lore-guided-place-creation", "scene_creator", "Proposer un lieu dans les frontières et influences autorisées.",
    ["CREATION_BRIEF", "LORE_INFLUENCES", "CREATION_POLICY"],
    ["SCENE_VISIBLE", "PUBLIC_SOURCE_REFS"],
    ["PLAYER_RAW_INPUT", "NPC_ROLE_PRIVATE_CONTEXT", "PLAYER_PRIVATE_NOTEBOOK", "GM_SECRETS"]),
  requirement("missing-public-fact-creation", "scene_creator", "Proposer uniquement la valeur publique déclarée manquante.",
    ["MISSING_FACT_TARGET", "CREATION_POLICY", "PUBLIC_SOURCE_REFS"],
    ["LORE_INFLUENCES"],
    ["PLAYER_RAW_INPUT", "SCENE_VISIBLE", "NPC_ROLE_PRIVATE_CONTEXT", "PLAYER_PRIVATE_NOTEBOOK", "GM_SECRETS"]),
  requirement("narrative-coherence-review", "coherence_critic", "Comparer une sortie candidate aux faits et invariants nécessaires.",
    ["CANDIDATE_OUTPUT", "RESOLUTION_EVIDENCE", "COHERENCE_INVARIANTS"],
    ["SCENE_VISIBLE", "PUBLIC_SOURCE_REFS"],
    ["PLAYER_RAW_INPUT", "NPC_ROLE_PRIVATE_CONTEXT", "PLAYER_PRIVATE_NOTEBOOK", "GM_SECRETS"]),
  requirement("destination-plausibility", "destination_arbiter", "Arbitrer une destination comprise dans les frontières publiques disponibles.",
    ["CREATION_BRIEF", "SCENE_VISIBLE", "LORE_INFLUENCES"],
    ["PUBLIC_SOURCE_REFS", "ACTIVE_PUBLIC_PROCESS"],
    ["PLAYER_RAW_INPUT", "NPC_ROLE_PRIVATE_CONTEXT", "PLAYER_PRIVATE_NOTEBOOK", "GM_SECRETS"])
] as const;

export interface NarrativeContextManifestV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_CONTEXT_MANIFEST_CONTRACT_V1;
  manifestId: string;
  operationId: string;
  campaignId: string;
  snapshot: NarrativeContextSnapshotV1;
  projections: NarrativeContextProjectionDescriptorV1[];
  rolePolicies: NarrativeContextRolePolicyV1[];
  authority: "READ_ONLY_CONTEXT_MANIFEST";
  noCommit: true;
  noGameTime: true;
  version: 1;
}

export interface NarrativeContextManifestValidationV1 {
  ok: boolean;
  issues: string[];
}

export interface NarrativeRoleProjectionInputV1 {
  projectionKey: string;
  kind: NarrativeContextProjectionKindV1;
  payload: unknown;
  ownerId: string;
  sourceRefs: string[];
  classification?: Exclude<NarrativeContextClassificationV1, "FORBIDDEN_FOR_AI">;
  consistency?: NarrativeContextConsistencyV1;
  sourceVersion: string;
  dependencyProjectionKeys?: string[];
  required: boolean;
}

export interface PreparedNarrativeRoleContextV1 {
  manifest: NarrativeContextManifestV1;
  roleContextPack: JsonObject;
}

export function createNarrativeContextManifestV1(input: {
  manifestId: string;
  operationId: string;
  campaignId: string;
  snapshot: NarrativeContextSnapshotV1;
  projections: readonly NarrativeContextProjectionDescriptorV1[];
  rolePolicies: readonly NarrativeContextRolePolicyV1[];
}): NarrativeContextManifestV1 {
  return {
    schemaVersion: 1,
    contractVersion: NARRATIVE_CONTEXT_MANIFEST_CONTRACT_V1,
    manifestId: input.manifestId,
    operationId: input.operationId,
    campaignId: input.campaignId,
    snapshot: structuredClone(input.snapshot),
    projections: input.projections
      .map(projection => ({
        ...structuredClone(projection),
        sourceRefs: sorted(projection.sourceRefs),
        allowedRoles: sorted(projection.allowedRoles),
        dependencyProjectionIds: sorted(projection.dependencyProjectionIds)
      }))
      .sort((left, right) => left.projectionId.localeCompare(right.projectionId)),
    rolePolicies: input.rolePolicies
      .map(policy => ({
        ...structuredClone(policy),
        requiredProjectionIds: sorted(policy.requiredProjectionIds),
        optionalProjectionIds: sorted(policy.optionalProjectionIds),
        forbiddenProjectionIds: sorted(policy.forbiddenProjectionIds)
      }))
      .sort((left, right) => left.profileId.localeCompare(right.profileId)),
    authority: "READ_ONLY_CONTEXT_MANIFEST",
    noCommit: true,
    noGameTime: true,
    version: 1
  };
}

/** Prépare un manifeste local et un pointeur réseau sans recopier les payloads. */
export function prepareNarrativeRoleContextV1(input: {
  manifestId: string;
  operationId: string;
  campaignId: string;
  snapshot: NarrativeContextSnapshotV1;
  role: AiRoleV1;
  profileId: string;
  purpose: string;
  taskContextRef: string;
  authority: string;
  projections: readonly NarrativeRoleProjectionInputV1[];
  forbiddenKinds?: readonly ("PLAYER_PRIVATE_NOTEBOOK" | "GM_SECRETS")[];
}): PreparedNarrativeRoleContextV1 {
  const projectionIdByKey = new Map(input.projections.map(projection => [
    projection.projectionKey,
    `${input.manifestId}:${projection.projectionKey}`
  ]));
  const projections: NarrativeContextProjectionDescriptorV1[] = input.projections.map(projection => ({
    projectionId: projectionIdByKey.get(projection.projectionKey)!,
    kind: projection.kind,
    contractVersion: "narrative-context-projection-descriptor/1",
    ownerId: projection.ownerId,
    sourceRefs: [...new Set(projection.sourceRefs.length > 0
      ? projection.sourceRefs
      : [`projection:${projection.projectionKey}:empty`])],
    classification: projection.classification ?? "PUBLIC",
    allowedRoles: [input.role],
    consistency: projection.consistency ?? "STATIC_VERSIONED",
    sourceVersion: projection.sourceVersion,
    dependencyProjectionIds: (projection.dependencyProjectionKeys ?? []).map(key => {
      const id = projectionIdByKey.get(key);
      if (id === undefined) throw new Error(`Unknown narrative context projection dependency: ${key}`);
      return id;
    }),
    transport: "INLINE_ELIGIBLE" as const,
    serializedCharacters: JSON.stringify(projection.payload).length
  } satisfies NarrativeContextProjectionDescriptorV1));
  const forbiddenKinds = input.forbiddenKinds ?? ["PLAYER_PRIVATE_NOTEBOOK", "GM_SECRETS"];
  const forbiddenProjectionIds = forbiddenKinds.map(kind => `${input.manifestId}:forbidden:${kind.toLowerCase()}`);
  for (const [index, kind] of forbiddenKinds.entries()) {
    projections.push({
      projectionId: forbiddenProjectionIds[index]!,
      kind,
      contractVersion: "narrative-context-projection-descriptor/1",
      ownerId: "application/context-privacy-boundary",
      sourceRefs: [`excluded:${kind.toLowerCase()}`],
      classification: "FORBIDDEN_FOR_AI",
      allowedRoles: [],
      consistency: "STATIC_VERSIONED",
      sourceVersion: "excluded/1",
      dependencyProjectionIds: [],
      transport: "FORBIDDEN",
      serializedCharacters: 0
    });
  }
  const manifest = createNarrativeContextManifestV1({
    manifestId: input.manifestId,
    operationId: input.operationId,
    campaignId: input.campaignId,
    snapshot: input.snapshot,
    projections,
    rolePolicies: [{
      profileId: input.profileId,
      role: input.role,
      purpose: input.purpose,
      requiredProjectionIds: input.projections.filter(projection => projection.required)
        .map(projection => projectionIdByKey.get(projection.projectionKey)!),
      optionalProjectionIds: input.projections.filter(projection => !projection.required)
        .map(projection => projectionIdByKey.get(projection.projectionKey)!),
      forbiddenProjectionIds
    }]
  });
  const validation = validateNarrativeContextManifestV1(manifest);
  if (!validation.ok) throw new Error(`Invalid ${input.role} context manifest: ${validation.issues.join("; ")}`);
  return {
    manifest,
    roleContextPack: {
      schemaVersion: 1,
      contextManifestRef: manifest.manifestId,
      taskContextRef: input.taskContextRef,
      authority: input.authority
    }
  };
}

/**
 * Inventorie les projections effectivement préparées pour l'interpréteur V8.
 * Le manifeste reste local au runtime : il décrit les propriétaires, versions,
 * dépendances et tailles, mais ne transporte jamais une seconde copie des données.
 */
export function buildPlayerIntentContextManifestV1(input: {
  manifestId: string;
  operationId: string;
  campaignId: string;
  snapshotId: string;
  sceneVersion: number;
  rawInput: string;
  embodiedContext: InterpreterEmbodiedPublicContextV1;
}): NarrativeContextManifestV1 {
  const role: AiRoleV1 = "player_intent_interpreter";
  const context = input.embodiedContext;
  const ids = {
    raw: `${input.manifestId}:player-raw-input`,
    character: `${input.manifestId}:character-public`,
    named: `${input.manifestId}:character-named-references`,
    scene: `${input.manifestId}:scene-visible`,
    focus: `${input.manifestId}:interaction-focus`,
    recent: `${input.manifestId}:recent-semantics`,
    knowledge: `${input.manifestId}:acquired-public-knowledge`,
    selectors: `${input.manifestId}:information-selectors`,
    capabilities: `${input.manifestId}:runtime-capabilities`,
    process: `${input.manifestId}:active-public-process`,
    notebook: `${input.manifestId}:player-private-notebook`,
    secrets: `${input.manifestId}:gm-secrets`
  } as const;
  const descriptor = (
    projectionId: string,
    kind: NarrativeContextProjectionKindV1,
    payload: unknown,
    sourceRefs: string[],
    consistency: NarrativeContextConsistencyV1,
    sourceVersion: string,
    dependencyProjectionIds: string[] = []
  ): NarrativeContextProjectionDescriptorV1 => ({
    projectionId,
    kind,
    contractVersion: "narrative-context-projection-descriptor/1",
    ownerId: "application/player-intent-context-projection",
    sourceRefs: [...new Set(sourceRefs)],
    classification: "PUBLIC",
    allowedRoles: [role],
    consistency,
    sourceVersion,
    dependencyProjectionIds,
    transport: "INLINE_ELIGIBLE",
    serializedCharacters: JSON.stringify(payload).length
  });
  const forbidden = (
    projectionId: string,
    kind: "PLAYER_PRIVATE_NOTEBOOK" | "GM_SECRETS",
    sourceRef: string
  ): NarrativeContextProjectionDescriptorV1 => ({
    projectionId,
    kind,
    contractVersion: "narrative-context-projection-descriptor/1",
    ownerId: "application/context-privacy-boundary",
    sourceRefs: [sourceRef],
    classification: "FORBIDDEN_FOR_AI",
    allowedRoles: [],
    consistency: "STATIC_VERSIONED",
    sourceVersion: "excluded/1",
    dependencyProjectionIds: [],
    transport: "FORBIDDEN",
    serializedCharacters: 0
  });
  const sceneActorRefs = context.currentScene.presentActors.map(actor => actor.actorRef);
  const focusPayload = {
    activeInterlocutor: context.activeInterlocutor,
    activeInteraction: context.activeInteraction,
    recentFocus: context.recentFocus
  };
  const projections = [
    descriptor(ids.raw, "PLAYER_RAW_INPUT", input.rawInput, [`operation:${input.operationId}:raw-input`],
      "STATIC_VERSIONED", "player-input/1"),
    descriptor(ids.character, "CHARACTER_PUBLIC", context.character, [context.character.ref],
      "STATIC_VERSIONED", "interpreter-character-public/1"),
    descriptor(ids.named, "CHARACTER_NAMED_REFERENCES", context.namedReferences,
      context.namedReferences.map(reference => reference.ref).length > 0
        ? context.namedReferences.map(reference => reference.ref)
        : [`character:${context.character.ref}:named-references:none`],
      "STATIC_VERSIONED", "interpreter-character-references/1", [ids.character]),
    descriptor(ids.scene, "SCENE_VISIBLE", context.currentScene,
      [context.currentScene.sceneId, ...sceneActorRefs], "SCENE_REVISION", "player-public-scene/1"),
    descriptor(ids.focus, "INTERACTION_FOCUS", focusPayload,
      [context.currentScene.sceneId, ...context.recentFocus.map(focus => focus.targetRef)],
      "SCENE_REVISION", "local-interaction-focus/1", [ids.scene]),
    descriptor(ids.recent, "RECENT_SEMANTICS", context.recentIntentions,
      context.recentIntentions.length > 0
        ? context.recentIntentions.map(turn => `operation:${turn.operationId}`)
        : [`scene:${context.currentScene.sceneId}:recent-semantics:none`],
      "SCENE_REVISION", "recent-semantic-turns/1", [ids.scene]),
    descriptor(ids.knowledge, "ACQUIRED_PUBLIC_KNOWLEDGE", context.acquiredKnowledge,
      context.acquiredKnowledge.length > 0
        ? context.acquiredKnowledge.map(fact => fact.factRef)
        : [`character:${context.character.ref}:known-facts:none`],
      "STATIC_VERSIONED", "player-public-knowledge/1", [ids.character]),
    descriptor(ids.selectors, "INFORMATION_SELECTORS", context.informationCatalog,
      context.informationCatalog === null
        ? [`scene:${context.currentScene.sceneId}:information-catalog:none`]
        : [context.informationCatalog.anchorSubjectRef],
      "SCENE_REVISION", context.informationCatalog?.contractVersion ?? "information-catalog/none", [ids.scene]),
    descriptor(ids.capabilities, "RUNTIME_CAPABILITIES", context.runtimeCapabilities,
      context.runtimeCapabilities.length > 0
        ? context.runtimeCapabilities.map(capability => capability.capabilityId)
        : ["runtime:capabilities:none"],
      "STATIC_VERSIONED", "interpreter-runtime-context/1"),
    descriptor(ids.process, "ACTIVE_PUBLIC_PROCESS", context.activeProcess,
      context.activeProcess === null ? ["runtime:active-process:none"] : [context.activeProcess.destinationRef],
      "SCENE_REVISION", "active-public-process/1", [ids.scene]),
    forbidden(ids.notebook, "PLAYER_PRIVATE_NOTEBOOK", "campaign:player-private-notebook"),
    forbidden(ids.secrets, "GM_SECRETS", "campaign:gm-secrets")
  ];
  return createNarrativeContextManifestV1({
    manifestId: input.manifestId,
    operationId: input.operationId,
    campaignId: input.campaignId,
    snapshot: {
      snapshotId: input.snapshotId,
      campaignRevision: null,
      sceneId: context.currentScene.sceneId,
      sceneVersion: input.sceneVersion
    },
    projections,
    rolePolicies: [{
      profileId: `${input.manifestId}:player-intent-v8`,
      role,
      purpose: "Comprendre la saisie depuis une projection publique unique sans autorité métier.",
      requiredProjectionIds: [ids.raw, ids.scene, ids.selectors, ids.capabilities],
      optionalProjectionIds: [ids.character, ids.named, ids.focus, ids.recent, ids.knowledge, ids.process],
      forbiddenProjectionIds: [ids.notebook, ids.secrets]
    }]
  });
}

export function validateNarrativeContextManifestV1(
  value: unknown
): NarrativeContextManifestValidationV1 {
  if (!isRecord(value)) return invalid("manifest must be an object");
  const manifest = value as Partial<NarrativeContextManifestV1>;
  const issues: string[] = [];
  if (manifest.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (manifest.contractVersion !== NARRATIVE_CONTEXT_MANIFEST_CONTRACT_V1) issues.push("contractVersion mismatch");
  for (const key of ["manifestId", "operationId", "campaignId"] as const) {
    if (!isNonEmptyString(manifest[key])) issues.push(`${key} is required`);
  }
  if (manifest.authority !== "READ_ONLY_CONTEXT_MANIFEST") issues.push("authority is invalid");
  if (manifest.noCommit !== true) issues.push("manifest must be noCommit");
  if (manifest.noGameTime !== true) issues.push("manifest must be noGameTime");
  if (manifest.version !== 1) issues.push("version must be 1");
  validateSnapshot(manifest.snapshot, issues);
  if (!Array.isArray(manifest.projections)) issues.push("projections must be an array");
  if (!Array.isArray(manifest.rolePolicies)) issues.push("rolePolicies must be an array");
  if (!Array.isArray(manifest.projections) || !Array.isArray(manifest.rolePolicies)) return result(issues);

  const projectionById = new Map<string, NarrativeContextProjectionDescriptorV1>();
  for (const [index, projection] of manifest.projections.entries()) {
    const path = `projections[${index}]`;
    if (!isRecord(projection)) {
      issues.push(`${path} must be an object`);
      continue;
    }
    validateProjection(projection as unknown as NarrativeContextProjectionDescriptorV1, path, manifest.snapshot, issues);
    if (isNonEmptyString(projection.projectionId)) {
      if (projectionById.has(projection.projectionId)) issues.push(`${path}.projectionId must be unique`);
      else projectionById.set(projection.projectionId, projection as unknown as NarrativeContextProjectionDescriptorV1);
    }
  }
  validateDependencies(projectionById, issues);

  const profileIds = new Set<string>();
  for (const [index, policy] of manifest.rolePolicies.entries()) {
    const path = `rolePolicies[${index}]`;
    if (!isRecord(policy)) {
      issues.push(`${path} must be an object`);
      continue;
    }
    validateRolePolicy(policy as unknown as NarrativeContextRolePolicyV1, path, projectionById, issues);
    if (isNonEmptyString(policy.profileId)) {
      if (profileIds.has(policy.profileId)) issues.push(`${path}.profileId must be unique`);
      profileIds.add(policy.profileId);
    }
  }
  return result(issues);
}

export function validateNarrativeContextRoleRequirementsV1(
  value: readonly NarrativeContextRoleRequirementV1[]
): NarrativeContextManifestValidationV1 {
  const issues: string[] = [];
  const profileIds = new Set<string>();
  for (const [index, profile] of value.entries()) {
    const path = `profiles[${index}]`;
    if (!isNonEmptyString(profile.profileId)) issues.push(`${path}.profileId is required`);
    else if (profileIds.has(profile.profileId)) issues.push(`${path}.profileId must be unique`);
    else profileIds.add(profile.profileId);
    if (!AI_ROLES.has(profile.role)) issues.push(`${path}.role is invalid`);
    if (!isNonEmptyString(profile.purpose)) issues.push(`${path}.purpose is required`);
    for (const key of ["requiredKinds", "optionalKinds", "forbiddenKinds"] as const) {
      const kinds = profile[key];
      if (!Array.isArray(kinds)) {
        issues.push(`${path}.${key} must be an array`);
        continue;
      }
      if (kinds.some(kind => !PROJECTION_KINDS.has(kind))) issues.push(`${path}.${key} contains an invalid kind`);
      if (new Set(kinds).size !== kinds.length) issues.push(`${path}.${key} must not contain duplicates`);
    }
    const required = new Set(profile.requiredKinds ?? []);
    const optional = new Set(profile.optionalKinds ?? []);
    const forbidden = new Set(profile.forbiddenKinds ?? []);
    for (const kind of required) {
      if (optional.has(kind) || forbidden.has(kind)) issues.push(`${path} kind ${kind} has conflicting requirements`);
    }
    for (const kind of optional) {
      if (forbidden.has(kind)) issues.push(`${path} kind ${kind} has conflicting requirements`);
    }
  }
  return result(issues);
}

function validateSnapshot(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("snapshot must be an object");
    return;
  }
  if (!isNonEmptyString(value.snapshotId)) issues.push("snapshot.snapshotId is required");
  if (!(value.campaignRevision === null || isNonNegativeInteger(value.campaignRevision))) {
    issues.push("snapshot.campaignRevision must be null or a non-negative integer");
  }
  if (!(value.sceneId === null || isNonEmptyString(value.sceneId))) issues.push("snapshot.sceneId must be null or non-empty");
  if (!(value.sceneVersion === null || isNonNegativeInteger(value.sceneVersion))) {
    issues.push("snapshot.sceneVersion must be null or a non-negative integer");
  }
  if ((value.sceneId === null) !== (value.sceneVersion === null)) {
    issues.push("snapshot sceneId and sceneVersion must be present together");
  }
}

function validateProjection(
  projection: NarrativeContextProjectionDescriptorV1,
  path: string,
  snapshot: NarrativeContextSnapshotV1 | undefined,
  issues: string[]
): void {
  for (const key of ["projectionId", "contractVersion", "ownerId", "sourceVersion"] as const) {
    if (!isNonEmptyString(projection[key])) issues.push(`${path}.${key} is required`);
  }
  if (!PROJECTION_KINDS.has(projection.kind)) issues.push(`${path}.kind is invalid`);
  if (!CLASSIFICATIONS.has(projection.classification)) issues.push(`${path}.classification is invalid`);
  if (!CONSISTENCIES.has(projection.consistency)) issues.push(`${path}.consistency is invalid`);
  if (!TRANSPORTS.has(projection.transport)) issues.push(`${path}.transport is invalid`);
  validateStringArray(projection.sourceRefs, `${path}.sourceRefs`, issues, true);
  validateRoleArray(projection.allowedRoles, `${path}.allowedRoles`, issues);
  validateStringArray(projection.dependencyProjectionIds, `${path}.dependencyProjectionIds`, issues, false);
  const allowedRoles = Array.isArray(projection.allowedRoles) ? projection.allowedRoles : [];
  if (!isNonNegativeInteger(projection.serializedCharacters)) issues.push(`${path}.serializedCharacters must be a non-negative integer`);
  if (projection.classification === "FORBIDDEN_FOR_AI") {
    if (allowedRoles.length > 0) issues.push(`${path} forbidden projection cannot allow a role`);
    if (projection.transport !== "FORBIDDEN") issues.push(`${path} forbidden projection must use FORBIDDEN transport`);
  } else {
    if (allowedRoles.length === 0) issues.push(`${path} consumable projection requires an allowed role`);
    if (projection.transport === "FORBIDDEN") issues.push(`${path} consumable projection cannot use FORBIDDEN transport`);
  }
  if (projection.consistency === "CAMPAIGN_REVISION" && !isNonNegativeInteger(snapshot?.campaignRevision)) {
    issues.push(`${path} requires a campaign revision in the manifest snapshot`);
  }
  if (projection.consistency === "SCENE_REVISION" &&
    (!isNonEmptyString(snapshot?.sceneId) || !isNonNegativeInteger(snapshot?.sceneVersion))) {
    issues.push(`${path} requires a scene revision in the manifest snapshot`);
  }
}

function validateDependencies(
  projectionById: ReadonlyMap<string, NarrativeContextProjectionDescriptorV1>,
  issues: string[]
): void {
  for (const projection of projectionById.values()) {
    for (const dependencyId of Array.isArray(projection.dependencyProjectionIds) ? projection.dependencyProjectionIds : []) {
      if (dependencyId === projection.projectionId) issues.push(`${projection.projectionId} cannot depend on itself`);
      else if (!projectionById.has(dependencyId)) issues.push(`${projection.projectionId} dependency ${dependencyId} is unknown`);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (projectionId: string): void => {
    if (visiting.has(projectionId)) {
      issues.push(`projection dependency cycle includes ${projectionId}`);
      return;
    }
    if (visited.has(projectionId)) return;
    visiting.add(projectionId);
    const dependencies = projectionById.get(projectionId)?.dependencyProjectionIds;
    for (const dependencyId of Array.isArray(dependencies) ? dependencies : []) {
      if (projectionById.has(dependencyId)) visit(dependencyId);
    }
    visiting.delete(projectionId);
    visited.add(projectionId);
  };
  for (const projectionId of projectionById.keys()) visit(projectionId);
}

function validateRolePolicy(
  policy: NarrativeContextRolePolicyV1,
  path: string,
  projectionById: ReadonlyMap<string, NarrativeContextProjectionDescriptorV1>,
  issues: string[]
): void {
  if (!isNonEmptyString(policy.profileId)) issues.push(`${path}.profileId is required`);
  if (!AI_ROLES.has(policy.role)) issues.push(`${path}.role is invalid`);
  if (!isNonEmptyString(policy.purpose)) issues.push(`${path}.purpose is required`);
  for (const key of ["requiredProjectionIds", "optionalProjectionIds", "forbiddenProjectionIds"] as const) {
    validateStringArray(policy[key], `${path}.${key}`, issues, false);
  }
  const required = new Set(Array.isArray(policy.requiredProjectionIds) ? policy.requiredProjectionIds : []);
  const optional = new Set(Array.isArray(policy.optionalProjectionIds) ? policy.optionalProjectionIds : []);
  const forbidden = new Set(Array.isArray(policy.forbiddenProjectionIds) ? policy.forbiddenProjectionIds : []);
  for (const projectionId of required) {
    if (optional.has(projectionId) || forbidden.has(projectionId)) issues.push(`${path} projection ${projectionId} has conflicting policies`);
    validatePolicyConsumption(policy.role, projectionId, path, projectionById, issues);
  }
  for (const projectionId of optional) {
    if (forbidden.has(projectionId)) issues.push(`${path} projection ${projectionId} has conflicting policies`);
    validatePolicyConsumption(policy.role, projectionId, path, projectionById, issues);
  }
  for (const projectionId of forbidden) {
    const projection = projectionById.get(projectionId);
    if (projection === undefined) issues.push(`${path} forbidden projection ${projectionId} is unknown`);
    else if (projection.classification !== "FORBIDDEN_FOR_AI" &&
      Array.isArray(projection.allowedRoles) && projection.allowedRoles.includes(policy.role)) {
      issues.push(`${path} projection ${projectionId} is both allowed and forbidden for ${policy.role}`);
    }
  }
}

function validatePolicyConsumption(
  role: AiRoleV1,
  projectionId: string,
  path: string,
  projectionById: ReadonlyMap<string, NarrativeContextProjectionDescriptorV1>,
  issues: string[]
): void {
  const projection = projectionById.get(projectionId);
  if (projection === undefined) {
    issues.push(`${path} projection ${projectionId} is unknown`);
    return;
  }
  if (projection.classification === "FORBIDDEN_FOR_AI" || projection.transport === "FORBIDDEN") {
    issues.push(`${path} projection ${projectionId} is forbidden for AI consumption`);
  }
  if (!Array.isArray(projection.allowedRoles) || !projection.allowedRoles.includes(role)) {
    issues.push(`${path} projection ${projectionId} does not allow role ${role}`);
  }
}

function validateStringArray(value: unknown, path: string, issues: string[], requireValue: boolean): void {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array`);
    return;
  }
  if (requireValue && value.length === 0) issues.push(`${path} must not be empty`);
  if (value.some(entry => !isNonEmptyString(entry))) issues.push(`${path} must contain non-empty strings`);
  if (new Set(value).size !== value.length) issues.push(`${path} must not contain duplicates`);
}

function validateRoleArray(value: unknown, path: string, issues: string[]): void {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array`);
    return;
  }
  if (value.some(role => !AI_ROLES.has(role as AiRoleV1))) issues.push(`${path} contains an invalid role`);
  if (new Set(value).size !== value.length) issues.push(`${path} must not contain duplicates`);
}

function result(issues: string[]): NarrativeContextManifestValidationV1 {
  return { ok: issues.length === 0, issues };
}

function invalid(issue: string): NarrativeContextManifestValidationV1 {
  return { ok: false, issues: [issue] };
}

function sorted<T extends string>(values: readonly T[]): T[] {
  return [...values].sort();
}

function requirement(
  profileId: string,
  role: AiRoleV1,
  purpose: string,
  requiredKinds: NarrativeContextProjectionKindV1[],
  optionalKinds: NarrativeContextProjectionKindV1[],
  forbiddenKinds: NarrativeContextProjectionKindV1[]
): NarrativeContextRoleRequirementV1 {
  return { profileId, role, purpose, requiredKinds, optionalKinds, forbiddenKinds };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

const AI_ROLES = new Set<AiRoleV1>([
  "intent_interpreter",
  "player_intent_interpreter",
  "mj_planner",
  "player_expression_adapter",
  "npc_performer",
  "rules_adjudicator",
  "coherence_critic",
  "scene_writer",
  "scene_creator",
  "destination_arbiter",
  "clarification_writer"
]);

const PROJECTION_KINDS = new Set<NarrativeContextProjectionKindV1>([
  "PLAYER_RAW_INPUT", "CHARACTER_PUBLIC", "CHARACTER_NAMED_REFERENCES", "SCENE_VISIBLE",
  "INTERACTION_FOCUS", "RECENT_SEMANTICS", "ACQUIRED_PUBLIC_KNOWLEDGE", "INFORMATION_SELECTORS",
  "RUNTIME_CAPABILITIES", "ACTIVE_PUBLIC_PROCESS", "RESOLVED_TURN", "NPC_PUBLIC_PROFILE",
  "NPC_ROLE_PRIVATE_CONTEXT", "NPC_DISCLOSURE", "LORE_INFLUENCES", "CREATION_BRIEF",
  "CREATION_POLICY", "MISSING_FACT_TARGET", "PUBLIC_SOURCE_REFS", "CANDIDATE_OUTPUT",
  "RESOLUTION_EVIDENCE", "COHERENCE_INVARIANTS", "PLAYER_PRIVATE_NOTEBOOK", "GM_SECRETS"
]);
const CLASSIFICATIONS = new Set<NarrativeContextClassificationV1>(["PUBLIC", "ROLE_PRIVATE", "FORBIDDEN_FOR_AI"]);
const CONSISTENCIES = new Set<NarrativeContextConsistencyV1>(["STATIC_VERSIONED", "CAMPAIGN_REVISION", "SCENE_REVISION"]);
const TRANSPORTS = new Set<NarrativeContextTransportV1>(["INLINE_ELIGIBLE", "REFERENCE_ONLY", "FORBIDDEN"]);
