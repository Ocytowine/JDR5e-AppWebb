import { loadActiveCampaignCharacterProfileV1, type CharacterAggregatePayloadV1 } from "../bootstrap";
import { coreError, type CampaignClockPayload, type Result } from "../core";
import type { NarrativeInventoryTransactionRuntimeV1 } from "./NarrativeTurnController";
import {
  EXTERNAL_INVENTORY_AGGREGATE_ID_V1,
  EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1,
  type ExternalInventoryOwnershipV1
} from "./externalInventoryOwnership";
import {
  INVENTORY_TRANSACTION_CONTRACT_V1,
  resolveInventoryTransactionV1,
  type InventoryItemFactsPortV1,
  type InventoryItemTransactionFactsV1,
  type InventoryTransactionActionV1
} from "./inventoryTransactionAuthority";

export interface InventoryTransactionCatalogEntryV1 extends InventoryItemTransactionFactsV1 {
  aliases: string[];
}

export function createCatalogInventoryTransactionRuntimeV1(input: {
  catalog: InventoryTransactionCatalogEntryV1[];
}): NarrativeInventoryTransactionRuntimeV1 {
  const factsById = new Map(input.catalog.map(entry => [entry.itemId, entry]));
  const factsPort: InventoryItemFactsPortV1 = {
    resolve: itemId => factsById.get(itemId) ?? null
  };
  return {
    async canHandle(request) {
      return request.interpretation.runtimeDecision.requiredDomain === "inventory"
        && parseAction(request.rawInput) !== null;
    },
    async execute(request) {
      const action = parseAction(request.rawInput);
      if (action === null) return failure("inventory.transaction-action-unresolved", {});
      const [profile, campaign] = await Promise.all([
        loadActiveCampaignCharacterProfileV1({ repository: request.repository, campaignId: request.campaignId }),
        request.repository.getCampaign(request.campaignId)
      ]);
      if (!profile.ok) return profile;
      if (!campaign.ok) return campaign;
      const externalAction = ["TAKE", "DEPOSIT", "GIVE", "RECEIVE", "BUY", "SELL"].includes(action);
      const [characterAggregate, clock, externalAggregate] = await Promise.all([
        request.repository.getAggregate(request.campaignId, "character.state", profile.value.characterStateAggregateId),
        request.repository.getAggregate(request.campaignId, "world.clock", campaign.value.clockAggregateId),
        externalAction
          ? request.repository.getAggregate(request.campaignId, EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1, EXTERNAL_INVENTORY_AGGREGATE_ID_V1)
          : Promise.resolve(null)
      ]);
      if (!characterAggregate.ok) return characterAggregate;
      if (!clock.ok) return clock;
      if (externalAggregate !== null && !externalAggregate.ok) return externalAggregate;
      const character = characterAggregate.value.payload as unknown as CharacterAggregatePayloadV1;
      const external = externalAggregate === null ? null : externalAggregate.value.payload as unknown as ExternalInventoryOwnershipV1;
      const sceneOwner = external?.owners.find(owner =>
        owner.ownerKind === "SCENE" && owner.sceneId === request.activeScene.sceneId
      ) ?? null;
      const npcOwner = (["GIVE", "RECEIVE", "BUY", "SELL"].includes(action))
        ? selectNpcOwner(request.rawInput, request.activeScene, external)
        : null;
      const selectedOwner = ["GIVE", "RECEIVE", "BUY", "SELL"].includes(action) ? npcOwner : sceneOwner;
      const selection = ["TAKE", "RECEIVE", "BUY"].includes(action)
        ? selectExternalItem(request.rawInput, selectedOwner?.inventory ?? [], input.catalog)
        : selectTransaction({ rawInput: request.rawInput, action, character, catalog: input.catalog });
      if (!selection.ok) return {
        ok: true,
        value: rejected(request.rawInput, selection.issues)
      };
      const occurredAtGameSecond = Number((clock.value.payload as CampaignClockPayload).elapsedGameSeconds);
      const offer = action === "BUY" || action === "SELL"
        ? selectedOwner?.offers.find(candidate =>
          candidate.status === "ACTIVE" && candidate.itemId === selection.item.itemId
          && candidate.direction === (action === "BUY" ? "SELL_TO_PLAYER" : "BUY_FROM_PLAYER")
          && (candidate.itemInstanceId === null || candidate.itemInstanceId === selection.item.instanceId)
        ) ?? null
        : null;
      const resolved = await resolveInventoryTransactionV1({
        repository: request.repository,
        campaignId: request.campaignId,
        operation: request.operation,
        command: {
          schemaVersion: 1,
          contractVersion: INVENTORY_TRANSACTION_CONTRACT_V1,
          characterAggregateId: profile.value.characterStateAggregateId,
          tacticalProjectionAggregateId: profile.value.tacticalProjectionAggregateId,
          narrativeProjectionAggregateId: profile.value.narrativeProjectionAggregateId,
          actorRef: `actor:${profile.value.actorId}`,
          action,
          itemInstanceId: selection.item.instanceId,
          containerInstanceId: selection.container?.instanceId ?? null,
          equipmentSlot: selection.equipmentSlot,
          externalInventoryAggregateId: externalAction ? EXTERNAL_INVENTORY_AGGREGATE_ID_V1 : null,
          externalOwnerRef: externalAction ? selectedOwner?.ownerRef ?? null : null,
          activeSceneId: externalAction ? request.activeScene.sceneId : null,
          offerRef: offer?.offerRef ?? null,
          occurredAtGameSecond
        },
        itemFacts: factsPort
      });
      if (!resolved.ok) {
        return resolved.error.code === "VALIDATION_FAILED"
          ? { ok: true, value: rejected(request.rawInput, issuesOf(resolved.error.details)) }
          : resolved;
      }
      const itemFacts = factsById.get(selection.item.itemId)!;
      const containerFacts = selection.container === null ? null : factsById.get(selection.container.itemId) ?? null;
      return {
        ok: true,
        value: {
          commit: resolved.value.commit,
          resolution: resolved.value.result,
          outcome: "APPLIED",
          characterExpression: request.rawInput.trim(),
          playerFacingText: playerFacingText(
            action,
            itemFacts.label,
            ["GIVE", "RECEIVE", "BUY", "SELL"].includes(action) ? selectedOwner?.displayName ?? null : containerFacts?.label ?? null,
            selection.equipmentSlot
          ),
          sourceRefs: [...new Set([
            `inventory-item:${selection.item.instanceId}`,
            ...(selection.container === null ? [] : [`inventory-item:${selection.container.instanceId}`]),
            ...itemFacts.sourceRefs,
            ...(containerFacts?.sourceRefs ?? [])
            ,...(offer === null ? [] : [`merchant-offer:${offer.offerRef}`])
          ])]
        }
      };
    }
  };
}

function rejected(rawInput: string, issues: string[]) {
  return {
    commit: null,
    resolution: null,
    outcome: "REJECTED" as const,
    characterExpression: rawInput.trim(),
    playerFacingText: `Action non exécutée : ${issues.map(playerIssue).join("; ") || "la transaction d'inventaire n'est pas valide"}.`,
    sourceRefs: ["inventory-transaction:rejected"]
  };
}

function playerIssue(issue: string): string {
  const translations: Record<string, string> = {
    "equipped item must be unequipped before storage": "l'objet doit d'abord être déséquipé",
    "stored item must be retrieved before equipping": "l'objet doit d'abord être sorti de son contenant",
    "selected equipment slot is already occupied": "l'emplacement choisi est déjà occupé",
    "container capacity is insufficient or cannot be proven": "la capacité du contenant est insuffisante ou inconnue",
    "selected item instance is not owned": "l'objet choisi n'est pas possédé",
    "selected container is not owned": "le contenant choisi n'est pas possédé"
  };
  return translations[issue] ?? issue;
}

function issuesOf(details: unknown): string[] {
  if (typeof details !== "object" || details === null) return [];
  const issues = (details as { issues?: unknown }).issues;
  return Array.isArray(issues) ? issues.filter((value): value is string => typeof value === "string") : [];
}

function selectTransaction(input: {
  rawInput: string;
  action: InventoryTransactionActionV1;
  character: CharacterAggregatePayloadV1;
  catalog: InventoryTransactionCatalogEntryV1[];
}): { ok: true; item: CharacterAggregatePayloadV1["inventory"][number]; container: CharacterAggregatePayloadV1["inventory"][number] | null; equipmentSlot: string | null } | { ok: false; issues: string[] } {
  const normalized = normalize(input.rawInput);
  const mentioned = input.character.inventory.flatMap(instance => {
    const facts = input.catalog.find(entry => entry.itemId === instance.itemId);
    if (facts === undefined) return [];
    const aliases = [facts.label, facts.itemId, ...facts.aliases].map(normalize).filter(alias => alias && normalized.includes(alias));
    return aliases.length === 0 ? [] : [{ instance, facts, specificity: Math.max(...aliases.map(alias => alias.length)) }];
  });
  const containerCandidates = mentioned.filter(candidate => candidate.facts.containerCapacityWeight !== null);
  const container = (input.action === "STORE" || input.action === "RETRIEVE")
    ? uniqueMostSpecific(containerCandidates.map(candidate => ({ value: candidate.instance, score: candidate.specificity })))
    : null;
  const itemCandidates = mentioned.filter(candidate => container === null || candidate.instance.instanceId !== container.instanceId);
  const item = uniqueMostSpecific(itemCandidates.map(candidate => ({ value: candidate.instance, score: candidate.specificity })));
  if (item === null) return { ok: false, issues: ["nommer exactement un objet possédé"] };
  if ((input.action === "STORE" || input.action === "RETRIEVE") && container === null) {
    return { ok: false, issues: ["nommer exactement un contenant possédé"] };
  }
  const equipmentSlot = input.action === "EQUIP"
    ? resolveEquipmentSlot(normalized, input.character, input.catalog.find(entry => entry.itemId === item.itemId)!)
    : null;
  if (input.action === "EQUIP" && equipmentSlot === null) {
    return { ok: false, issues: ["aucun emplacement d'équipement libre et compatible n'est identifiable"] };
  }
  return { ok: true, item, container, equipmentSlot };
}

function selectExternalItem(
  rawInput: string,
  inventory: Array<{ instanceId: string; itemId: string; quantity: number; equippedSlot: null; storedInInstanceId: null; primaryWeapon: false; itemKind: "weapon" | "armor" | "tool" | "object" }>,
  catalog: InventoryTransactionCatalogEntryV1[]
): ReturnType<typeof selectTransaction> {
  const normalized = normalize(rawInput);
  const candidates = inventory.flatMap(instance => {
    const facts = catalog.find(entry => entry.itemId === instance.itemId);
    if (facts === undefined) return [];
    const aliases = [facts.label, facts.itemId, ...facts.aliases]
      .map(normalize).filter(alias => alias && normalized.includes(alias));
    return aliases.length === 0 ? [] : [{ value: instance, score: Math.max(...aliases.map(alias => alias.length)) }];
  });
  const item = uniqueMostSpecific(candidates);
  return item === null
    ? { ok: false, issues: ["nommer exactement un objet accessible dans ce lieu"] }
    : { ok: true, item, container: null, equipmentSlot: null };
}

function selectNpcOwner(
  rawInput: string,
  scene: Parameters<NarrativeInventoryTransactionRuntimeV1["canHandle"]>[0]["activeScene"],
  external: ExternalInventoryOwnershipV1 | null
) {
  const normalized = normalize(rawInput);
  const visible = [...scene.presentNpc, ...scene.ambientPopulation].filter(actor => {
    const aliases = [actor.displayName, actor.publicRole].map(normalize);
    return aliases.some(alias => alias && normalized.includes(alias));
  });
  if (visible.length !== 1) return null;
  return external?.owners.find(owner => owner.ownerKind === "NPC" && owner.sceneId === scene.sceneId && owner.ownerRef === `npc:${visible[0]!.actorId}`) ?? null;
}

function resolveEquipmentSlot(
  normalized: string,
  character: CharacterAggregatePayloadV1,
  facts: InventoryTransactionCatalogEntryV1
): string | null {
  const slots = character.equipmentSlots as Record<string, unknown>;
  const named = facts.allowedEquipmentSlots.filter(slot => {
    const alias = normalize(slot.replaceAll("_", " "));
    return normalized.includes(alias)
      || (slot === "main_droite" && /\b(main droite|droite)\b/u.test(normalized))
      || (slot === "main_gauche" && /\b(main gauche|gauche)\b/u.test(normalized));
  });
  if (named.length === 1) return named[0]!;
  const free = facts.allowedEquipmentSlots.filter(slot => slot in slots && (slots[slot] === null || slots[slot] === undefined));
  return free.length === 1 ? free[0]! : null;
}

function uniqueMostSpecific<T>(candidates: Array<{ value: T; score: number }>): T | null {
  if (candidates.length === 0) return null;
  const highest = Math.max(...candidates.map(candidate => candidate.score));
  const exact = candidates.filter(candidate => candidate.score === highest);
  return exact.length === 1 ? exact[0]!.value : null;
}

function parseAction(rawInput: string): InventoryTransactionActionV1 | null {
  const normalized = normalize(rawInput);
  if (/\b(desequipe|desequiper)\b/u.test(normalized)) return "UNEQUIP";
  if (/\b(equipe|equiper|brandis|prendre en main|prends en main)\b/u.test(normalized)) return "EQUIP";
  if (/\b(depose|deposer|pose|poser|laisse|laisser)\b/u.test(normalized)) return "DEPOSIT";
  if (/\b(donne|donner|offre|offrir)\b/u.test(normalized) && /\b(a|au)\b/u.test(normalized)) return "GIVE";
  if (/\b(recois|recevoir|accepte|accepter)\b/u.test(normalized) && /\b(de|du)\b/u.test(normalized)) return "RECEIVE";
  if (/\b(prends|prendre|ramasse|ramasser|recupere|recuperer)\b/u.test(normalized)) return "TAKE";
  if (/\b(achete|acheter)\b/u.test(normalized)) return "BUY";
  if (/\b(vends|vendre)\b/u.test(normalized)) return "SELL";
  if (/\b(sors|sortir|retire|retirer)\b/u.test(normalized) && /\b(de|du|des|hors)\b/u.test(normalized)) return "RETRIEVE";
  if (/\b(range|ranger|mets|mettre|place)\b/u.test(normalized) && /\b(dans|dedans)\b/u.test(normalized)) return "STORE";
  return null;
}

function playerFacingText(action: InventoryTransactionActionV1, item: string, container: string | null, slot: string | null): string {
  if (action === "STORE") return `${item} est maintenant rangé dans ${container}.`;
  if (action === "RETRIEVE") return `${item} est maintenant sorti de ${container}.`;
  if (action === "EQUIP") return `${item} est maintenant équipé à l'emplacement ${slot?.replaceAll("_", " ")}.`;
  if (action === "DEPOSIT") return `${item} est maintenant déposé dans ce lieu.`;
  if (action === "TAKE") return `${item} est maintenant dans ton inventaire.`;
  if (action === "GIVE") return `${item} est maintenant remis à ${container ?? "ce personnage"}.`;
  if (action === "RECEIVE") return `${item} est maintenant reçu de ${container ?? "ce personnage"}.`;
  if (action === "BUY") return `${item} est acheté à ${container ?? "ce marchand"}.`;
  if (action === "SELL") return `${item} est vendu à ${container ?? "ce marchand"}.`;
  return `${item} est maintenant déséquipé.`;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’']/gu, " ");
}

function failure<T>(messageKey: string, details: Record<string, unknown>): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, details as never) };
}
