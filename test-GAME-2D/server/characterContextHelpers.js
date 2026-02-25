"use strict";

function createCharacterContextHelpers(params) {
  const sanitizeCharacterProfile = params?.sanitizeCharacterProfile;
  const resolveCharacterDataByIds = params?.resolveCharacterDataByIds;
  const resolveProficiencyBonus = params?.resolveProficiencyBonus;
  const getAbilityModFromProfile = params?.getAbilityModFromProfile;
  const resolveItemDataById =
    typeof params?.resolveItemDataById === "function" ? params.resolveItemDataById : () => null;

  function firstNonEmpty(values) {
    for (const value of values) {
      const text = String(value ?? "").trim();
      if (text) return text;
    }
    return "";
  }

  function resolveItemDisplayMeta(item) {
    const safe = item && typeof item === "object" ? item : {};
    const data = resolveItemDataById(safe?.id) ?? null;
    const displayName = firstNonEmpty([
      safe?.displayName,
      safe?.customName,
      safe?.name,
      safe?.label,
      data?.label,
      safe?.id
    ]);
    const description = firstNonEmpty([
      safe?.description,
      safe?.descriptionCourte,
      safe?.descriptionLongue,
      data?.description
    ]);
    return {
      displayName: displayName || String(safe?.id ?? ""),
      description
    };
  }

  function summarizeInventoryForContext(profile) {
    const items = Array.isArray(profile?.inventoryItems) ? profile.inventoryItems : [];
    const grouped = new Map();
    const equipped = [];
    const entries = [];
    for (const item of items) {
      const meta = resolveItemDisplayMeta(item);
      const key = `${String(item?.type ?? "")}:${String(item?.id ?? "")}:${meta.displayName}:${meta.description}`;
      const qty = Number(item?.qty ?? 0) || 0;
      if (!grouped.has(key)) {
        grouped.set(key, {
          type: String(item?.type ?? ""),
          id: String(item?.id ?? ""),
          displayName: meta.displayName,
          description: meta.description,
          qty: 0
        });
      }
      grouped.get(key).qty += qty > 0 ? qty : 1;
      entries.push({
        type: String(item?.type ?? ""),
        id: String(item?.id ?? ""),
        displayName: meta.displayName,
        description: meta.description,
        qty: qty > 0 ? qty : 1,
        instanceId: String(item?.instanceId ?? ""),
        equippedSlot: String(item?.equippedSlot ?? ""),
        storedIn: String(item?.storedIn ?? ""),
        isPrimaryWeapon: Boolean(item?.isPrimaryWeapon),
        isSecondaryHand: Boolean(item?.isSecondaryHand)
      });
      if (item?.equippedSlot) {
        equipped.push({
          id: String(item.id ?? ""),
          displayName: meta.displayName,
          description: meta.description,
          slot: String(item.equippedSlot),
          instanceId: String(item?.instanceId ?? ""),
          primary: Boolean(item?.isPrimaryWeapon),
          secondary: Boolean(item?.isSecondaryHand)
        });
      }
    }
    return {
      totalEntries: items.length,
      grouped: Array.from(grouped.values()).slice(0, 120),
      equipped: equipped.slice(0, 80),
      entries: entries.slice(0, 240),
      slots:
        profile?.materielSlots && typeof profile.materielSlots === "object"
          ? profile.materielSlots
          : {}
    };
  }

  function summarizeSpellcastingForContext(profile) {
    const state =
      profile?.spellcastingState && typeof profile.spellcastingState === "object"
        ? profile.spellcastingState
        : {};
    const slots = state?.slots && typeof state.slots === "object" ? state.slots : {};
    const slotSummary = Object.entries(slots)
      .map(([level, entry]) => {
        const max = Number(entry?.max ?? 0) || 0;
        const remaining = Number(entry?.remaining ?? 0) || 0;
        return { level, max, remaining };
      })
      .filter((row) => row.max > 0 || row.remaining > 0)
      .slice(0, 9);
    const sources = state?.sources && typeof state.sources === "object" ? state.sources : {};
    const sourceSummary = Object.entries(sources)
      .slice(0, 10)
      .map(([key, src]) => ({
        key: String(key),
        ability: String(src?.ability ?? ""),
        classLevel: Number(src?.classLevel ?? 0) || 0,
        knownSpellIds: Array.isArray(src?.knownSpellIds) ? src.knownSpellIds.slice(0, 20) : [],
        preparedSpellIds: Array.isArray(src?.preparedSpellIds)
          ? src.preparedSpellIds.slice(0, 20)
          : []
      }));
    return {
      totalCasterLevel: Number(state?.totalCasterLevel ?? 0) || 0,
      slots: slotSummary,
      sources: sourceSummary
    };
  }

  function buildCharacterContextPack(characterProfile, worldState) {
    const safe =
      sanitizeCharacterProfile(characterProfile) ??
      sanitizeCharacterProfile(worldState?.startContext?.characterSnapshot ?? null);
    if (!safe) return null;
    const resolved = resolveCharacterDataByIds(safe);
    const classRows = Array.isArray(safe.classEntries) ? safe.classEntries : [];
    const abilityRows = safe?.caracs && typeof safe.caracs === "object" ? safe.caracs : {};
    const moneyRows = safe?.money && typeof safe.money === "object" ? safe.money : {};
    return {
      version: "context-pack.v1",
      generatedAt: new Date().toISOString(),
      source: {
        tag: safe.sourceTag || "unknown",
        sheetId: safe.sourceSheetId || ""
      },
      identity: {
        id: safe.id,
        name: safe.name,
        raceId: safe.raceId,
        raceLabel: safe.race,
        resolvedRaceLabel: resolved?.race?.label || "",
        backgroundId: safe.backgroundId,
        resolvedBackgroundLabel: resolved?.background?.label || ""
      },
      progression: {
        classEntries: classRows,
        resolvedClasses: resolved?.classes ?? [],
        proficiencyBonus: resolveProficiencyBonus(safe)
      },
      rules: {
        abilityMods: {
          FOR: getAbilityModFromProfile(safe, "FOR"),
          DEX: getAbilityModFromProfile(safe, "DEX"),
          CON: getAbilityModFromProfile(safe, "CON"),
          INT: getAbilityModFromProfile(safe, "INT"),
          SAG: getAbilityModFromProfile(safe, "SAG"),
          CHA: getAbilityModFromProfile(safe, "CHA")
        },
        abilities: abilityRows,
        skills: Array.isArray(safe.skills) ? safe.skills : [],
        expertises: Array.isArray(safe.expertises) ? safe.expertises : []
      },
      combat: {
        actionIds: Array.isArray(safe.actionIds) ? safe.actionIds : [],
        reactionIds: Array.isArray(safe.reactionIds) ? safe.reactionIds : [],
        weaponMasteries: Array.isArray(safe.weaponMasteries) ? safe.weaponMasteries : [],
        proficiencies:
          safe.proficiencies && typeof safe.proficiencies === "object" ? safe.proficiencies : {}
      },
      inventory: summarizeInventoryForContext(safe),
      magic: summarizeSpellcastingForContext(safe),
      resources: {
        money: moneyRows
      }
    };
  }

  function buildCharacterContextDiagnostics(characterProfile, worldState) {
    const pack = buildCharacterContextPack(characterProfile, worldState);
    if (!pack) {
      return ["CharacterContextPack", "- Aucun contexte personnage disponible."].join("\n");
    }
    const preview = {
      version: pack.version,
      source: pack.source,
      identity: pack.identity,
      progression: {
        classEntries: pack.progression.classEntries,
        proficiencyBonus: pack.progression.proficiencyBonus
      },
      counts: {
        actionIds: pack.combat.actionIds.length,
        reactionIds: pack.combat.reactionIds.length,
        inventoryEntries: Number(pack.inventory.totalEntries ?? 0),
        inventoryGrouped: Array.isArray(pack.inventory.grouped) ? pack.inventory.grouped.length : 0,
        equippedEntries: Array.isArray(pack.inventory.equipped) ? pack.inventory.equipped.length : 0,
        spellSources: Array.isArray(pack.magic.sources) ? pack.magic.sources.length : 0
      }
    };
    return ["CharacterContextPack", JSON.stringify(preview, null, 2)].join("\n");
  }

  return {
    buildCharacterContextPack,
    buildCharacterContextDiagnostics
  };
}

module.exports = {
  createCharacterContextHelpers
};
