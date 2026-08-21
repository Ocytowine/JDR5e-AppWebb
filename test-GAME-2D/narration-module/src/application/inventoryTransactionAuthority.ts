import {
  cloneJson,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type CommitRecord,
  type CommitRequest,
  type EventDraft,
  type EventId,
  type JsonObject,
  type OperationRecord,
  type Result,
  type WriterId
} from "../core";
import type {
  CharacterAggregatePayloadV1,
  CharacterInventoryInstanceV1,
  NarrativeCharacterProjectionV1,
  TacticalCharacterProjectionV1
} from "../bootstrap";
import {
  EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1,
  type ExternalInventoryOwnershipV1
} from "./externalInventoryOwnership";

export const INVENTORY_TRANSACTION_CONTRACT_V1 =
  "inventory-transaction/1" as const;

export type InventoryTransactionActionV1 =
  "STORE" | "RETRIEVE" | "EQUIP" | "UNEQUIP" | "TAKE" | "DEPOSIT" | "GIVE" | "RECEIVE" | "BUY" | "SELL";

export interface InventoryItemTransactionFactsV1 extends JsonObject {
  schemaVersion: 1;
  itemId: string;
  label: string;
  weight: number;
  containerCapacityWeight: number | null;
  allowedEquipmentSlots: string[];
  sourceRefs: string[];
  valueInCopper: number;
}

export interface InventoryTransactionCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof INVENTORY_TRANSACTION_CONTRACT_V1;
  characterAggregateId: string;
  tacticalProjectionAggregateId: string;
  narrativeProjectionAggregateId: string;
  actorRef: string;
  action: InventoryTransactionActionV1;
  itemInstanceId: string;
  containerInstanceId: string | null;
  equipmentSlot: string | null;
  externalInventoryAggregateId: string | null;
  externalOwnerRef: string | null;
  activeSceneId: string | null;
  offerRef: string | null;
  occurredAtGameSecond: number;
}

export interface InventoryTransactionResultV1 extends JsonObject {
  schemaVersion: 1;
  action: InventoryTransactionActionV1;
  itemInstanceId: string;
  itemId: string;
  containerInstanceId: string | null;
  equipmentSlot: string | null;
  commitId: string;
  replayed: boolean;
}

export interface InventoryItemFactsPortV1 {
  resolve(itemId: string): InventoryItemTransactionFactsV1 | null;
}

/**
 * Applique un déplacement interne à l'inventaire du personnage. La sélection
 * linguistique reste en amont ; cette autorité ne travaille qu'avec des
 * identifiants d'exemplaires déjà présents dans character.state.
 */
export async function resolveInventoryTransactionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  command: InventoryTransactionCommandV1;
  itemFacts: InventoryItemFactsPortV1;
}): Promise<Result<{ result: InventoryTransactionResultV1; commit: CommitRecord }>> {
  const commandIssues = validateCommand(input.command, input.operation, input.campaignId);
  if (commandIssues.length > 0) return invalid("inventory.transaction-command-invalid", commandIssues);
  const [campaign, character, tactical, narrative] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    input.repository.getAggregate(
      input.campaignId,
      "character.state",
      opaqueId<AggregateId>(input.command.characterAggregateId)
    ),
    input.repository.getAggregate(
      input.campaignId,
      "character.tactical-projection",
      opaqueId<AggregateId>(input.command.tacticalProjectionAggregateId)
    ),
    input.repository.getAggregate(
      input.campaignId,
      "character.narrative-projection",
      opaqueId<AggregateId>(input.command.narrativeProjectionAggregateId)
    )
  ]);
  if (!campaign.ok) return campaign;
  if (!character.ok) return character;
  if (!tactical.ok) return tactical;
  if (!narrative.ok) return narrative;
  const clock = await input.repository.getAggregate(
    input.campaignId,
    "world.clock",
    campaign.value.clockAggregateId
  );
  if (!clock.ok) return clock;
  if (Number(clock.value.payload.elapsedGameSeconds) !== input.command.occurredAtGameSecond) {
    return invalid("inventory.transaction-clock-stale", ["campaign clock changed before inventory transaction"]);
  }

  const external = input.command.externalInventoryAggregateId === null
    ? null
    : await input.repository.getAggregate(input.campaignId, EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1, opaqueId<AggregateId>(input.command.externalInventoryAggregateId));
  if (external !== null && !external.ok) return external;
  const currentCharacter = character.value.payload as unknown as CharacterAggregatePayloadV1;
  const currentTactical = tactical.value.payload as unknown as TacticalCharacterProjectionV1;
  const currentNarrative = narrative.value.payload as unknown as NarrativeCharacterProjectionV1;
  const stateIssues = validateState(currentCharacter, currentTactical, input.itemFacts);
  if (stateIssues.length > 0) return invalid("inventory.transaction-state-invalid", stateIssues);
  const applied = applyInventoryTransactionStateV1(
    currentCharacter,
    external === null ? null : external.value.payload as unknown as ExternalInventoryOwnershipV1,
    input.command,
    input.itemFacts
  );
  if (!applied.ok) return invalid("inventory.transaction-rejected", applied.issues);
  const nextTactical: TacticalCharacterProjectionV1 = {
    ...cloneJson(currentTactical as unknown as JsonObject) as unknown as TacticalCharacterProjectionV1,
    equippedItemInstanceIds: applied.character.inventory
      .filter(entry => entry.equippedSlot !== null)
      .map(entry => entry.instanceId)
      .sort()
  };
  const observable = cloneJson(currentNarrative.observable);
  observable.visibleEquipment = applied.character.inventory
    .filter(entry => entry.equippedSlot !== null)
    .map(entry => ({ instanceId: entry.instanceId, itemId: entry.itemId }));
  const nextNarrative: NarrativeCharacterProjectionV1 = {
    ...cloneJson(currentNarrative as unknown as JsonObject) as unknown as NarrativeCharacterProjectionV1,
    observable
  };
  const preparing = await input.repository.transitionOperation(
    input.operation.operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(
    input.operation.operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) return ready;
  const committed = await commitTransaction({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: ready.value,
    command: input.command,
    characterAggregate: character.value,
    tacticalAggregate: tactical.value,
    narrativeAggregate: narrative.value,
    externalAggregate: external === null ? null : external.value,
    nextCharacter: applied.character,
    nextTactical,
    nextNarrative,
    nextExternal: applied.external
  });
  if (!committed.ok) return committed;
  const item = applied.character.inventory.find(entry => entry.instanceId === input.command.itemInstanceId)
    ?? applied.external?.owners.flatMap(owner => owner.inventory)
      .find(entry => entry.instanceId === input.command.itemInstanceId);
  if (item === undefined) return invalid("inventory.transaction-result-invalid", ["transferred item is missing after commit"]);
  return {
    ok: true,
    value: {
      commit: committed.value,
      result: {
        schemaVersion: 1,
        action: input.command.action,
        itemInstanceId: item.instanceId,
        itemId: item.itemId,
        containerInstanceId: item.storedInInstanceId,
        equipmentSlot: item.equippedSlot,
        commitId: committed.value.commitId,
        replayed: false
      }
    }
  };
}

export function applyInventoryTransactionStateV1(
  current: CharacterAggregatePayloadV1,
  currentExternal: ExternalInventoryOwnershipV1 | null,
  command: InventoryTransactionCommandV1,
  factsPort: InventoryItemFactsPortV1
): { ok: true; character: CharacterAggregatePayloadV1; external: ExternalInventoryOwnershipV1 | null } | { ok: false; issues: string[] } {
  const character = cloneJson(current as unknown as JsonObject) as unknown as CharacterAggregatePayloadV1;
  const external = currentExternal === null ? null : cloneJson(currentExternal);
  const owner = external?.owners.find(candidate => candidate.ownerRef === command.externalOwnerRef);
  const externalAction = ["TAKE", "DEPOSIT", "GIVE", "RECEIVE", "BUY", "SELL"].includes(command.action);
  const expectedOwnerKind = ["GIVE", "RECEIVE", "BUY", "SELL"].includes(command.action) ? "NPC" : "SCENE";
  if (externalAction && (owner === undefined || owner.sceneId !== command.activeSceneId || owner.ownerKind !== expectedOwnerKind)) {
    return { ok: false, issues: [`active ${expectedOwnerKind.toLowerCase()} inventory owner is required`] };
  }
  const takesFromExternal = command.action === "TAKE" || command.action === "RECEIVE" || command.action === "BUY";
  const item = takesFromExternal
    ? owner?.inventory.find(entry => entry.instanceId === command.itemInstanceId)
    : character.inventory.find(entry => entry.instanceId === command.itemInstanceId);
  if (item === undefined) return { ok: false, issues: ["selected item instance is not owned"] };
  const itemFacts = factsPort.resolve(item.itemId);
  if (itemFacts === null) return { ok: false, issues: ["selected item has no catalog facts"] };
  const slots = character.equipmentSlots as Record<string, unknown>;

  if (command.action === "BUY" || command.action === "SELL") {
    const direction = command.action === "BUY" ? "SELL_TO_PLAYER" : "BUY_FROM_PLAYER";
    const offer = owner!.offers.find(candidate =>
      candidate.offerRef === command.offerRef && candidate.direction === direction
      && candidate.itemId === item.itemId && candidate.status === "ACTIVE"
      && (candidate.itemInstanceId === null || candidate.itemInstanceId === item.instanceId)
    );
    if (offer === undefined) return { ok: false, issues: ["an active matching merchant offer is required"] };
    const currencyFacts = factsPort.resolve(offer.currencyItemId);
    if (itemFacts.valueInCopper === undefined || currencyFacts?.valueInCopper === undefined
      || itemFacts.valueInCopper !== currencyFacts.valueInCopper * offer.priceQuantity) {
      return { ok: false, issues: ["merchant offer price must match the shared item catalog"] };
    }
    if (command.action === "BUY") {
      const coin = character.inventory.find(entry => entry.itemId === offer.currencyItemId && entry.quantity >= offer.priceQuantity);
      if (coin === undefined) return { ok: false, issues: ["physical currency is insufficient"] };
      coin.quantity -= offer.priceQuantity;
      if (coin.quantity === 0) character.inventory = character.inventory.filter(entry => entry.instanceId !== coin.instanceId);
      const merchantCoin = owner!.inventory.find(entry => entry.itemId === offer.currencyItemId);
      if (merchantCoin) merchantCoin.quantity += offer.priceQuantity;
      else owner!.inventory.push({ instanceId: `${owner!.ownerRef}:currency:${offer.currencyItemId}`, itemId: offer.currencyItemId, itemKind: "object", quantity: offer.priceQuantity, equippedSlot: null, storedInInstanceId: null, primaryWeapon: false, accessible: false });
      owner!.inventory = owner!.inventory.filter(entry => entry.instanceId !== item.instanceId);
      const { accessible: _accessible, ...ownedItem } = item as import("./externalInventoryOwnership").ExternalInventoryItemV1;
      character.inventory.push(ownedItem);
    } else {
      if (item.equippedSlot !== null || item.storedInInstanceId !== null) return { ok: false, issues: ["only a directly accessible unequipped item can be sold"] };
      const merchantCoin = owner!.inventory.find(entry => entry.itemId === offer.currencyItemId && entry.quantity >= offer.priceQuantity);
      if (merchantCoin === undefined) return { ok: false, issues: ["merchant physical currency is insufficient"] };
      merchantCoin.quantity -= offer.priceQuantity;
      if (merchantCoin.quantity === 0) owner!.inventory = owner!.inventory.filter(entry => entry.instanceId !== merchantCoin.instanceId);
      const playerCoin = character.inventory.find(entry => entry.itemId === offer.currencyItemId);
      if (playerCoin) playerCoin.quantity += offer.priceQuantity;
      else character.inventory.push({ instanceId: `${item.instanceId}:sale-currency`, itemId: offer.currencyItemId, itemKind: "object", quantity: offer.priceQuantity, equippedSlot: null, storedInInstanceId: null, primaryWeapon: false });
      character.inventory = character.inventory.filter(entry => entry.instanceId !== item.instanceId);
      owner!.inventory.push({ instanceId: item.instanceId, itemId: item.itemId, itemKind: item.itemKind, quantity: item.quantity, equippedSlot: null, storedInInstanceId: null, primaryWeapon: false, accessible: true });
    }
    offer.status = "CLOSED";
  } else if (command.action === "DEPOSIT" || command.action === "GIVE") {
    if (command.action === "GIVE" && owner!.acceptsDirectTransfers !== true) return { ok: false, issues: ["npc has not authorized a direct transfer"] };
    if (item.equippedSlot !== null || item.storedInInstanceId !== null) return { ok: false, issues: ["only a directly accessible unequipped item can be deposited"] };
    if (character.inventory.some(entry => entry.storedInInstanceId === item.instanceId)) return { ok: false, issues: ["a non-empty container cannot be deposited"] };
    character.inventory = character.inventory.filter(entry => entry.instanceId !== item.instanceId);
    owner!.inventory.push({
      instanceId: item.instanceId,
      itemId: item.itemId,
      itemKind: item.itemKind,
      quantity: item.quantity,
      equippedSlot: null,
      storedInInstanceId: null,
      primaryWeapon: false,
      accessible: true
    });
  } else if (command.action === "TAKE" || command.action === "RECEIVE") {
    if (!("accessible" in item) || item.accessible !== true) return { ok: false, issues: ["selected scene item is not accessible"] };
    if (character.inventory.some(entry => entry.instanceId === item.instanceId)) return { ok: false, issues: ["item instance is already owned"] };
    owner!.inventory = owner!.inventory.filter(entry => entry.instanceId !== item.instanceId);
    const { accessible: _accessible, ...ownedItem } = item;
    character.inventory.push(ownedItem);
  } else if (command.action === "STORE") {
    if (command.containerInstanceId === null) return { ok: false, issues: ["container instance is required"] };
    const container = character.inventory.find(entry => entry.instanceId === command.containerInstanceId);
    if (container === undefined) return { ok: false, issues: ["selected container is not owned"] };
    const containerFacts = factsPort.resolve(container.itemId);
    if (containerFacts?.containerCapacityWeight === null || containerFacts === null) {
      return { ok: false, issues: ["selected target is not a catalogued container"] };
    }
    if (item.instanceId === container.instanceId || isDescendant(character.inventory, container.instanceId, item.instanceId)) {
      return { ok: false, issues: ["inventory containment cycle is forbidden"] };
    }
    if (item.equippedSlot !== null) return { ok: false, issues: ["equipped item must be unequipped before storage"] };
    const occupiedWeight = character.inventory
      .filter(entry => entry.storedInInstanceId === container.instanceId && entry.instanceId !== item.instanceId)
      .reduce((sum, entry) => {
        const facts = factsPort.resolve(entry.itemId);
        return facts === null ? Number.NaN : sum + facts.weight * entry.quantity;
      }, 0);
    const nextWeight = occupiedWeight + itemFacts.weight * item.quantity;
    if (!Number.isFinite(nextWeight) || nextWeight > containerFacts.containerCapacityWeight) {
      return { ok: false, issues: ["container capacity is insufficient or cannot be proven"] };
    }
    item.storedInInstanceId = container.instanceId;
  } else if (command.action === "RETRIEVE") {
    if (item.storedInInstanceId === null) return { ok: false, issues: ["selected item is not stored in a container"] };
    if (command.containerInstanceId !== null && item.storedInInstanceId !== command.containerInstanceId) {
      return { ok: false, issues: ["selected item is not stored in the named container"] };
    }
    item.storedInInstanceId = null;
  } else if (command.action === "UNEQUIP") {
    if (item.equippedSlot === null) return { ok: false, issues: ["selected item is not equipped"] };
    const previousSlot = item.equippedSlot;
    item.equippedSlot = null;
    if (slots[previousSlot] === item.instanceId) slots[previousSlot] = null;
  } else {
    if (item.storedInInstanceId !== null) return { ok: false, issues: ["stored item must be retrieved before equipping"] };
    if (item.equippedSlot !== null) return { ok: false, issues: ["selected item is already equipped"] };
    if (command.equipmentSlot === null || !(command.equipmentSlot in slots)) {
      return { ok: false, issues: ["known equipment slot is required"] };
    }
    if (!itemFacts.allowedEquipmentSlots.includes(command.equipmentSlot)) {
      return { ok: false, issues: ["item is not compatible with the selected equipment slot"] };
    }
    if (slots[command.equipmentSlot] !== null && slots[command.equipmentSlot] !== undefined) {
      return { ok: false, issues: ["selected equipment slot is already occupied"] };
    }
    item.equippedSlot = command.equipmentSlot;
    slots[command.equipmentSlot] = item.instanceId;
  }
  if (external !== null && externalAction) external.version += 1;
  return { ok: true, character, external };
}

async function commitTransaction(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  command: InventoryTransactionCommandV1;
  characterAggregate: Awaited<ReturnType<CampaignRepository["getAggregate"]>> extends Result<infer T> ? T : never;
  tacticalAggregate: Awaited<ReturnType<CampaignRepository["getAggregate"]>> extends Result<infer T> ? T : never;
  narrativeAggregate: Awaited<ReturnType<CampaignRepository["getAggregate"]>> extends Result<infer T> ? T : never;
  externalAggregate: (Awaited<ReturnType<CampaignRepository["getAggregate"]>> extends Result<infer T> ? T : never) | null;
  nextCharacter: CharacterAggregatePayloadV1;
  nextTactical: TacticalCharacterProjectionV1;
  nextNarrative: NarrativeCharacterProjectionV1;
  nextExternal: ExternalInventoryOwnershipV1 | null;
}): Promise<Result<CommitRecord>> {
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const commandId = opaqueId<CommandId>(`${input.operation.operationId}:inventory-command`);
    const acceptedCommand: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "inventory-transaction",
      contractVersion: 1,
      commandId,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: `inventory.transaction.${input.command.action.toLowerCase()}`,
      target: {
        aggregateType: "character.state",
        aggregateId: input.characterAggregate.aggregateId,
        expectedAggregateRevision: input.characterAggregate.aggregateRevision
      },
      payloadSchemaVersion: 1,
      payload: cloneJson(input.command),
      acceptedAtGameSecond: input.command.occurredAtGameSecond
    };
    const aggregateRefs = [{
      aggregateType: "character.state",
      aggregateId: input.characterAggregate.aggregateId,
      aggregateRevision: input.characterAggregate.aggregateRevision + 1
    }, {
      aggregateType: "character.tactical-projection",
      aggregateId: input.tacticalAggregate.aggregateId,
      aggregateRevision: input.tacticalAggregate.aggregateRevision + 1
    }, {
      aggregateType: "character.narrative-projection",
      aggregateId: input.narrativeAggregate.aggregateId,
      aggregateRevision: input.narrativeAggregate.aggregateRevision + 1
    }, ...(input.externalAggregate === null ? [] : [{
      aggregateType: EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1,
      aggregateId: input.externalAggregate.aggregateId,
      aggregateRevision: input.externalAggregate.aggregateRevision + 1
    }])];
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:inventory-event`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "inventory.transaction-applied",
      origin: "PLAYER_INTENT",
      causation: { kind: "COMMAND", id: commandId },
      aggregateRefs,
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.command.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: {
        action: input.command.action,
        itemInstanceId: input.command.itemInstanceId,
        containerInstanceId: input.command.containerInstanceId,
        equipmentSlot: input.command.equipmentSlot
      }
    };
    const request: CommitRequest = {
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [acceptedCommand],
      aggregateWrites: [{
        aggregateType: "character.state",
        aggregateId: input.characterAggregate.aggregateId,
        expectedAggregateRevision: input.characterAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextCharacter as unknown as JsonObject)
      }, {
        aggregateType: "character.tactical-projection",
        aggregateId: input.tacticalAggregate.aggregateId,
        expectedAggregateRevision: input.tacticalAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextTactical as unknown as JsonObject)
      }, {
        aggregateType: "character.narrative-projection",
        aggregateId: input.narrativeAggregate.aggregateId,
        expectedAggregateRevision: input.narrativeAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextNarrative as unknown as JsonObject)
      }, ...(input.externalAggregate === null || input.nextExternal === null ? [] : [{
        aggregateType: EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1,
        aggregateId: input.externalAggregate.aggregateId,
        expectedAggregateRevision: input.externalAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextExternal)
      }])],
      events: [event],
      outboxTasks: []
    };
    return input.repository.commit(request);
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function validateState(
  character: CharacterAggregatePayloadV1,
  tactical: TacticalCharacterProjectionV1,
  facts: InventoryItemFactsPortV1
): string[] {
  const issues: string[] = [];
  const ids = character.inventory.map(item => item.instanceId);
  if (new Set(ids).size !== ids.length) issues.push("inventory instance ids are duplicated");
  for (const item of character.inventory) {
    if (!item.instanceId || !item.itemId || !Number.isInteger(item.quantity) || item.quantity < 1) issues.push("inventory item is invalid");
    if (facts.resolve(item.itemId) === null) issues.push(`catalog facts missing for ${item.itemId}`);
    if (item.storedInInstanceId !== null && !ids.includes(item.storedInInstanceId)) issues.push(`container missing for ${item.instanceId}`);
    if (item.storedInInstanceId !== null && item.equippedSlot !== null) issues.push(`stored item ${item.instanceId} cannot be equipped`);
  }
  const equipped = character.inventory.filter(item => item.equippedSlot !== null).map(item => item.instanceId).sort();
  if (JSON.stringify(equipped) !== JSON.stringify([...tactical.equippedItemInstanceIds].sort())) issues.push("tactical equipped projection is stale");
  return issues;
}

function validateCommand(
  command: InventoryTransactionCommandV1,
  operation: OperationRecord,
  campaignId: CampaignId
): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1 || command.contractVersion !== INVENTORY_TRANSACTION_CONTRACT_V1) issues.push("contract mismatch");
  if (operation.campaignId !== campaignId || operation.phase !== "RECEIVED") issues.push("received operation from same campaign required");
  for (const value of [command.characterAggregateId, command.tacticalProjectionAggregateId, command.narrativeProjectionAggregateId, command.actorRef, command.itemInstanceId]) if (!value.trim()) issues.push("command identity is required");
  if (!Number.isInteger(command.occurredAtGameSecond) || command.occurredAtGameSecond < 0) issues.push("game second is invalid");
  if (command.action === "STORE" && command.containerInstanceId === null) issues.push("STORE requires container");
  if (command.action === "EQUIP" && command.equipmentSlot === null) issues.push("EQUIP requires slot");
  if (["TAKE", "DEPOSIT", "GIVE", "RECEIVE", "BUY", "SELL"].includes(command.action) && (!command.externalInventoryAggregateId || !command.externalOwnerRef || !command.activeSceneId)) issues.push("external transaction references are required");
  if (["BUY", "SELL"].includes(command.action) && !command.offerRef) issues.push("merchant offer reference is required");
  return issues;
}

function isDescendant(inventory: CharacterInventoryInstanceV1[], candidateId: string, ancestorId: string): boolean {
  const byId = new Map(inventory.map(entry => [entry.instanceId, entry]));
  let current: string | null = candidateId;
  const visited = new Set<string>();
  while (current !== null && !visited.has(current)) {
    if (current === ancestorId) return true;
    visited.add(current);
    current = byId.get(current)?.storedInInstanceId ?? null;
  }
  return false;
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
