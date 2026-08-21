import {
  coreError,
  type AggregateId,
  type CampaignId,
  type CampaignRepository,
  type JsonObject,
  type Result
} from "../core";
import {
  ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
  activeCampaignCharacterProfileAggregateIdV1
} from "../bootstrap";

export const INTERPRETER_CHARACTER_CONTEXT_CONTRACT_V1 =
  "interpreter-character-context/1" as const;

export type InterpreterCharacterReferenceKindV1 =
  | "LANGUAGE"
  | "ACTION"
  | "SPELL"
  | "INVENTORY_ITEM"
  | "EQUIPPED_ITEM";

export interface InterpreterCharacterReferenceV1 extends JsonObject {
  schemaVersion: 1;
  ref: string;
  kind: InterpreterCharacterReferenceKindV1;
  label: string;
  aliases: string[];
  availability: "REFERENCE_ONLY";
  inventoryState: "EQUIPPED" | "DIRECT" | "STORED" | null;
  quantity: number | null;
  containerRef: string | null;
}

export interface InterpreterCharacterAmbiguityV1 extends JsonObject {
  schemaVersion: 1;
  alias: string;
  candidateRefs: string[];
  candidateLabels: string[];
}

export interface InterpreterCharacterContextV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof INTERPRETER_CHARACTER_CONTEXT_CONTRACT_V1;
  character: JsonObject & {
    ref: string;
    label: string;
  };
  references: InterpreterCharacterReferenceV1[];
  ambiguities: InterpreterCharacterAmbiguityV1[];
  authority: "INTERPRETATION_ONLY";
  ownerValidationRequired: true;
  deliberatelyExcluded: string[];
}

export interface InterpreterCharacterReferenceCatalogEntryV1 {
  id: string;
  label: string;
  aliases?: readonly string[];
}

export interface InterpreterCharacterReferenceCatalogV1 {
  languages?: readonly InterpreterCharacterReferenceCatalogEntryV1[];
  actions?: readonly InterpreterCharacterReferenceCatalogEntryV1[];
  spells?: readonly InterpreterCharacterReferenceCatalogEntryV1[];
  items?: readonly InterpreterCharacterReferenceCatalogEntryV1[];
}

export interface InterpreterCharacterContextResolverV1 {
  resolve(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
  }): Promise<Result<InterpreterCharacterContextV1 | null>>;
}

interface MinimalNarrativeProjectionV1 {
  characterId: string;
  name: string;
  languages: string[];
  visibleEquipment: Array<{ instanceId: string; itemId: string }>;
}

interface MinimalTacticalProjectionV1 {
  characterId: string;
  actionIds: string[];
  spellIds: string[];
}

interface MinimalInventoryStateV1 {
  characterId: string;
  items: Array<{
    instanceId: string;
    itemId: string;
    quantity: number;
    equippedSlot: string | null;
    storedInInstanceId: string | null;
  }>;
}

const REFERENCE_LIMITS: Record<InterpreterCharacterReferenceKindV1, number> = {
  LANGUAGE: 12,
  ACTION: 24,
  SPELL: 24,
  INVENTORY_ITEM: 32,
  EQUIPPED_ITEM: 12
};

const DELIBERATELY_EXCLUDED_V1 = [
  "ability_scores_and_modifiers",
  "hit_points_armor_class_and_difficulty",
  "resource_amounts_and_cooldowns",
  "merchant_prices_counterparties_and_private_external_inventories",
  "biography_personality_objectives_and_flaws",
  "campaign_secrets_and_private_knowledge",
  "success_failure_and_execution_authority"
];

export function createInterpreterCharacterContextResolverV1(
  catalog: InterpreterCharacterReferenceCatalogV1 = {}
): InterpreterCharacterContextResolverV1 {
  return {
    resolve: input => loadActiveInterpreterCharacterContextV1({
      ...input,
      catalog
    })
  };
}

export async function loadActiveInterpreterCharacterContextV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  catalog?: InterpreterCharacterReferenceCatalogV1;
}): Promise<Result<InterpreterCharacterContextV1 | null>> {
  const activeRefs = await resolveActiveProjectionRefsV1(input);
  if (!activeRefs.ok) return { ok: false, error: activeRefs.error };
  if (activeRefs.value === null) return { ok: true, value: null };
  const [narrativeRecord, tacticalRecord, characterRecord] = await Promise.all([
    input.repository.getAggregate(
      input.campaignId,
      "character.narrative-projection",
      activeRefs.value.narrativeProjectionAggregateId
    ),
    input.repository.getAggregate(
      input.campaignId,
      "character.tactical-projection",
      activeRefs.value.tacticalProjectionAggregateId
    ),
    input.repository.getAggregate(
      input.campaignId,
      "character.state",
      activeRefs.value.characterAggregateId
    )
  ]);
  if (!narrativeRecord.ok) return narrativeRecord;
  if (!tacticalRecord.ok) return tacticalRecord;
  if (!characterRecord.ok) return characterRecord;
  const narrative = parseNarrativeProjection(narrativeRecord.value.payload);
  const tactical = parseTacticalProjection(tacticalRecord.value.payload);
  const inventory = parseInventoryState(characterRecord.value.payload);
  if (
    narrative === null
    || tactical === null
    || inventory === null
    || narrative.characterId !== tactical.characterId
    || narrative.characterId !== inventory.characterId
  ) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "narrative.interpreter-character-context.invalid-projections",
        {}
      )
    };
  }
  return {
    ok: true,
    value: buildInterpreterCharacterContextV1({
      narrative,
      tactical,
      inventory,
      catalog: input.catalog ?? {}
    })
  };
}

async function resolveActiveProjectionRefsV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): Promise<Result<{
  narrativeProjectionAggregateId: AggregateId;
  tacticalProjectionAggregateId: AggregateId;
  characterAggregateId: AggregateId;
} | null>> {
  const activeProfile = await input.repository.getAggregate(
    input.campaignId,
    ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
    activeCampaignCharacterProfileAggregateIdV1(input.campaignId)
  );
  if (activeProfile.ok) {
    const profile = activeProfile.value.payload as Record<string, unknown>;
    if (
      typeof profile.narrativeProjectionAggregateId !== "string"
      || typeof profile.tacticalProjectionAggregateId !== "string"
      || typeof profile.characterStateAggregateId !== "string"
    ) {
      return {
        ok: false,
        error: coreError(
          "VALIDATION_FAILED",
          "narrative.interpreter-character-context.invalid-active-profile",
          {}
        )
      };
    }
    return {
      ok: true,
      value: {
        narrativeProjectionAggregateId:
          profile.narrativeProjectionAggregateId as AggregateId,
        tacticalProjectionAggregateId:
          profile.tacticalProjectionAggregateId as AggregateId,
        characterAggregateId: profile.characterStateAggregateId as AggregateId
      }
    };
  }
  if (activeProfile.error.code !== "NOT_FOUND") return activeProfile;

  const events = await input.repository.listEvents(input.campaignId, null, 100);
  if (!events.ok) return events;
  const bootstrap = events.value.find(
    event => event.eventType === "campaign.bootstrapped"
  );
  if (bootstrap === undefined) return { ok: true, value: null };
  const narrativeRef = bootstrap.aggregateRefs.find(
    ref => ref.aggregateType === "character.narrative-projection"
  );
  const tacticalRef = bootstrap.aggregateRefs.find(
    ref => ref.aggregateType === "character.tactical-projection"
  );
  const characterRef = bootstrap.aggregateRefs.find(
    ref => ref.aggregateType === "character.state"
  );
  if (narrativeRef === undefined || tacticalRef === undefined || characterRef === undefined) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "narrative.interpreter-character-context.missing-bootstrap-refs",
        {}
      )
    };
  }
  return {
    ok: true,
    value: {
      narrativeProjectionAggregateId: narrativeRef.aggregateId,
      tacticalProjectionAggregateId: tacticalRef.aggregateId,
      characterAggregateId: characterRef.aggregateId
    }
  };
}

export function findUnresolvedCharacterReferenceAmbiguityV1(input: {
  rawInput: string;
  context: InterpreterCharacterContextV1 | null | undefined;
}): InterpreterCharacterAmbiguityV1 | null {
  if (input.context === null || input.context === undefined) return null;
  const normalizedInput = normalizeForMatch(input.rawInput);
  const referencesByRef = new Map(
    input.context.references.map(reference => [reference.ref, reference])
  );
  for (const ambiguity of input.context.ambiguities) {
    if (!containsTerm(normalizedInput, ambiguity.alias)) continue;
    const specificallyMatched = ambiguity.candidateRefs.filter(ref => {
      const reference = referencesByRef.get(ref);
      return reference?.aliases.some(alias => {
        const normalizedAlias = normalizeForMatch(alias);
        return normalizedAlias !== ambiguity.alias
          && containsTerm(normalizedInput, normalizedAlias);
      }) === true;
    });
    if (new Set(specificallyMatched).size !== 1) return ambiguity;
  }
  return null;
}

function buildInterpreterCharacterContextV1(input: {
  narrative: MinimalNarrativeProjectionV1;
  tactical: MinimalTacticalProjectionV1;
  inventory: MinimalInventoryStateV1;
  catalog: InterpreterCharacterReferenceCatalogV1;
}): InterpreterCharacterContextV1 {
  const indexes = {
    LANGUAGE: catalogIndex(input.catalog.languages),
    ACTION: catalogIndex(input.catalog.actions),
    SPELL: catalogIndex(input.catalog.spells),
    INVENTORY_ITEM: catalogIndex(input.catalog.items),
    EQUIPPED_ITEM: catalogIndex(input.catalog.items)
  } satisfies Record<
    InterpreterCharacterReferenceKindV1,
    Map<string, InterpreterCharacterReferenceCatalogEntryV1>
  >;
  const references: InterpreterCharacterReferenceV1[] = [];
  const spellIds = new Set(input.tactical.spellIds);
  addReferences(
    references,
    "LANGUAGE",
    input.narrative.languages,
    indexes.LANGUAGE
  );
  addReferences(
    references,
    "ACTION",
    input.tactical.actionIds.filter(id => !spellIds.has(id)),
    indexes.ACTION
  );
  addReferences(
    references,
    "SPELL",
    input.tactical.spellIds,
    indexes.SPELL
  );
  for (
    const item of input.narrative.visibleEquipment
      .slice(0, REFERENCE_LIMITS.EQUIPPED_ITEM)
  ) {
    const entry = indexes.EQUIPPED_ITEM.get(item.itemId);
    const label = safeLabel(entry?.label, item.itemId);
    const inventoryItem = input.inventory.items.find(candidate =>
      candidate.instanceId === item.instanceId
    );
    references.push({
      schemaVersion: 1,
      ref: `character-equipped-item:${item.instanceId}`,
      kind: "EQUIPPED_ITEM",
      label,
      aliases: referenceAliases(item.itemId, label, entry?.aliases),
      availability: "REFERENCE_ONLY",
      inventoryState: "EQUIPPED",
      quantity: inventoryItem?.quantity ?? 1,
      containerRef: null
    });
  }
  const equippedIds = new Set(input.narrative.visibleEquipment.map(item => item.instanceId));
  for (const item of input.inventory.items
    .filter(entry => !equippedIds.has(entry.instanceId))
    .slice(0, REFERENCE_LIMITS.INVENTORY_ITEM)) {
    const entry = indexes.INVENTORY_ITEM.get(item.itemId);
    const label = safeLabel(entry?.label, item.itemId);
    references.push({
      schemaVersion: 1,
      ref: `character-inventory-item:${item.instanceId}`,
      kind: "INVENTORY_ITEM",
      label,
      aliases: referenceAliases(item.itemId, label, entry?.aliases),
      availability: "REFERENCE_ONLY",
      inventoryState: item.storedInInstanceId === null ? "DIRECT" : "STORED",
      quantity: item.quantity,
      containerRef: item.storedInInstanceId === null
        ? null
        : `character-inventory-item:${item.storedInInstanceId}`
    });
  }
  references.sort((left, right) =>
    left.kind.localeCompare(right.kind)
    || left.label.localeCompare(right.label)
    || left.ref.localeCompare(right.ref)
  );
  return {
    schemaVersion: 1,
    contractVersion: INTERPRETER_CHARACTER_CONTEXT_CONTRACT_V1,
    character: {
      ref: `player-character:${input.narrative.characterId}`,
      label: safeLabel(input.narrative.name, "personnage joueur")
    },
    references,
    ambiguities: buildAmbiguities(references),
    authority: "INTERPRETATION_ONLY",
    ownerValidationRequired: true,
    deliberatelyExcluded: [...DELIBERATELY_EXCLUDED_V1]
  };
}

function addReferences(
  output: InterpreterCharacterReferenceV1[],
  kind: Exclude<InterpreterCharacterReferenceKindV1, "EQUIPPED_ITEM" | "INVENTORY_ITEM">,
  ids: string[],
  index: Map<string, InterpreterCharacterReferenceCatalogEntryV1>
): void {
  for (const id of sortedUnique(ids).slice(0, REFERENCE_LIMITS[kind])) {
    const entry = index.get(id);
    const label = safeLabel(entry?.label, id);
    output.push({
      schemaVersion: 1,
      ref: `character-reference:${kind.toLowerCase()}:${id}`,
      kind,
      label,
      aliases: referenceAliases(id, label, entry?.aliases),
      availability: "REFERENCE_ONLY",
      inventoryState: null,
      quantity: null,
      containerRef: null
    });
  }
}

function buildAmbiguities(
  references: InterpreterCharacterReferenceV1[]
): InterpreterCharacterAmbiguityV1[] {
  const byAlias = new Map<string, InterpreterCharacterReferenceV1[]>();
  for (const reference of references) {
    for (const alias of reference.aliases) {
      const normalized = normalizeForMatch(alias);
      if (normalized.length < 2) continue;
      const entries = byAlias.get(normalized) ?? [];
      if (!entries.some(entry => entry.ref === reference.ref)) {
        entries.push(reference);
      }
      byAlias.set(normalized, entries);
    }
  }
  return [...byAlias.entries()]
    .filter(([, candidates]) => candidates.length > 1)
    .map(([alias, candidates]) => ({
      schemaVersion: 1 as const,
      alias,
      candidateRefs: candidates.map(candidate => candidate.ref).sort(),
      candidateLabels: candidates.map(candidate => candidate.label).sort()
    }))
    .sort((left, right) => left.alias.localeCompare(right.alias));
}

function parseNarrativeProjection(
  payload: JsonObject
): MinimalNarrativeProjectionV1 | null {
  const candidate = payload as Record<string, unknown>;
  const observable = object(candidate.observable);
  if (
    candidate.schemaVersion !== 1
    || typeof candidate.characterId !== "string"
    || typeof candidate.name !== "string"
    || !stringArray(candidate.languages)
    || observable === null
  ) return null;
  const visibleEquipmentValue = observable.visibleEquipment;
  if (!Array.isArray(visibleEquipmentValue)) return null;
  const visibleEquipment = visibleEquipmentValue.flatMap(value => {
    const item = object(value);
    return item !== null
      && typeof item.instanceId === "string"
      && typeof item.itemId === "string"
      ? [{ instanceId: item.instanceId, itemId: item.itemId }]
      : [];
  });
  return {
    characterId: candidate.characterId,
    name: candidate.name,
    languages: candidate.languages,
    visibleEquipment
  };
}

function parseInventoryState(payload: JsonObject): MinimalInventoryStateV1 | null {
  const candidate = payload as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || typeof candidate.characterId !== "string" || !Array.isArray(candidate.inventory)) return null;
  const items = candidate.inventory.flatMap(value => {
    const item = object(value);
    return item !== null
      && typeof item.instanceId === "string"
      && typeof item.itemId === "string"
      && typeof item.quantity === "number"
      && Number.isInteger(item.quantity)
      && item.quantity > 0
      && (item.equippedSlot === null || typeof item.equippedSlot === "string")
      && (item.storedInInstanceId === null || typeof item.storedInInstanceId === "string")
      ? [{
          instanceId: item.instanceId,
          itemId: item.itemId,
          quantity: item.quantity,
          equippedSlot: item.equippedSlot,
          storedInInstanceId: item.storedInInstanceId
        }]
      : [];
  });
  return items.length === candidate.inventory.length
    ? { characterId: candidate.characterId, items }
    : null;
}

function parseTacticalProjection(
  payload: JsonObject
): MinimalTacticalProjectionV1 | null {
  const candidate = payload as Record<string, unknown>;
  if (
    candidate.schemaVersion !== 1
    || typeof candidate.characterId !== "string"
    || !stringArray(candidate.actionIds)
    || !stringArray(candidate.spellIds)
  ) return null;
  return {
    characterId: candidate.characterId,
    actionIds: candidate.actionIds,
    spellIds: candidate.spellIds
  };
}

function catalogIndex(
  entries: readonly InterpreterCharacterReferenceCatalogEntryV1[] | undefined
): Map<string, InterpreterCharacterReferenceCatalogEntryV1> {
  return new Map((entries ?? [])
    .filter(entry => entry.id.trim().length > 0)
    .map(entry => [entry.id, entry]));
}

function referenceAliases(
  id: string,
  label: string,
  aliases: readonly string[] | undefined
): string[] {
  const labelTokens = normalizeForMatch(label)
    .split(" ")
    .filter(value => value.length >= 3);
  return sortedUnique([
    id,
    id.replaceAll(/[-_]+/gu, " "),
    label,
    ...labelTokens,
    ...(aliases ?? [])
  ].map(value => value.trim()).filter(value => value.length > 0))
    .slice(0, 12);
}

function safeLabel(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return (trimmed || fallback.replaceAll(/[-_]+/gu, " ")).slice(0, 120);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === "string");
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function containsTerm(normalizedInput: string, normalizedTerm: string): boolean {
  return normalizedTerm.length > 0
    && ` ${normalizedInput} `.includes(` ${normalizedTerm} `);
}
