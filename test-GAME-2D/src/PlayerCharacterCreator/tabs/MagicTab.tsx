import React from "react";
import { spellCatalog } from "../../game/spellCatalog";
import type { SpellGrantEntry } from "../../types";

export type SpellEntry =
  | string
  | {
      id: string;
      instanceId: string;
      origin?: { kind: string; id?: string; sourceKey?: string };
    };

type MagicSource = {
  key: string;
  label: string;
  ability: "SAG" | "INT" | "CHA";
  preparation: "prepared" | "known";
  storage: "memory" | "innate" | "grimoire";
  focusTypes?: string[];
  spellFilterTags?: string[];
  freePreparedFromGrants?: boolean;
  casterProgression: "full" | "half" | "third" | "none";
  slotsByLevel?: Record<string, number[]>;
  classLevel: number;
  spellIds: string[];
};

export function MagicTab(props: {
  magicSources: MagicSource[];
  activeMagicTab: number;
  setActiveMagicTab: (value: number) => void;
  isSectionLocked: (id: string) => boolean;
  toggleSectionLock: (id: string) => void;
  lockButtonBaseStyle: React.CSSProperties;
  getLockButtonState: (id: string) => { background: string; label: string };
  spellcastingSelections: Record<
    string,
    {
      knownSpells?: SpellEntry[];
      preparedSpells?: SpellEntry[];
      grantedSpells?: SpellEntry[];
      focusItemId?: string | null;
      focusInstanceId?: string | null;
      storage?: "memory" | "innate" | "grimoire";
      grimoireItemId?: string | null;
    }
  >;
  spellGrantsBySource?: Record<string, SpellGrantEntry[]>;
  updateSpellcastingSelection: (
    key: string,
    patch: Partial<{
      knownSpells: SpellEntry[];
      preparedSpells: SpellEntry[];
      grantedSpells: SpellEntry[];
      focusItemId: string | null;
      focusInstanceId: string | null;
      storage: "memory" | "innate" | "grimoire";
      grimoireItemId: string | null;
    }>
  ) => void;
  computeMod: (score: number) => number;
  getScore: (key: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA") => number;
  resolveLevel: () => number;
  getCasterContribution: (progression: "full" | "half" | "third" | "none", level: number) => number;
  resolveItemTags: (itemId: string) => string[];
  inventoryItems: Array<any>;
  formatEquipmentLabel: (rawId: string) => string;
  getSpellId: (entry: SpellEntry) => string;
  makeSpellEntry: (id: string, origin?: { kind: string; id?: string; sourceKey?: string }) => SpellEntry;
}): React.JSX.Element {
  const {
    magicSources,
    activeMagicTab,
    setActiveMagicTab,
    isSectionLocked,
    toggleSectionLock,
    lockButtonBaseStyle,
    getLockButtonState,
    spellcastingSelections,
    spellGrantsBySource,
    updateSpellcastingSelection,
    computeMod,
    getScore,
    resolveLevel,
    getCasterContribution,
    resolveItemTags,
    inventoryItems,
    formatEquipmentLabel,
    getSpellId,
    makeSpellEntry
  } = props;
  const magicLocked = isSectionLocked("magic");
  const getSourceLabel = (value: string) => {
    const normalized = String(value ?? "").toLowerCase();
    if (normalized === "class") return "Classe";
    if (normalized === "subclass") return "Sous-classe";
    if (normalized === "race") return "Espece";
    if (normalized === "background") return "Historique";
    if (normalized === "feature") return "Feature";
    if (normalized === "item") return "Objet";
    if (normalized === "manual") return "Manuel";
    return value || "Source";
  };
  const getUsageLabel = (entry?: SpellGrantEntry | null) => {
    const usage = entry?.usage;
    if (!usage) return null;
    const type = String(usage.type ?? "").toLowerCase();
    if (type === "slot") return "slot";
    if (type === "at-will") return "a volonte";
    if (type === "limited") {
      if (typeof usage.remainingUses === "number" && typeof usage.maxUses === "number") {
        return `${usage.remainingUses}/${usage.maxUses}`;
      }
      if (typeof usage.maxUses === "number") return `${usage.maxUses}/repos`;
      return "usage limite";
    }
    if (type === "charge") {
      if (typeof usage.remainingUses === "number" && typeof usage.maxUses === "number") {
        return `charges ${usage.remainingUses}/${usage.maxUses}`;
      }
      if (typeof usage.maxUses === "number") return `charges ${usage.maxUses}`;
      return "charges";
    }
    return type || null;
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#b0b8c4" }}>
          Gestion de la magie selon les sources verrouillees.
        </div>
        <button
          type="button"
          onClick={() => toggleSectionLock("magic")}
          style={{
            ...lockButtonBaseStyle,
            marginLeft: "auto",
            background: getLockButtonState("magic").background
          }}
        >
          {getLockButtonState("magic").label}
        </button>
      </div>
      {magicSources.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {magicSources.map((source, idx) => (
            <button
              key={`magic-tab-${source.key}`}
              type="button"
              onClick={() => setActiveMagicTab(idx)}
              disabled={magicLocked}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: `1px solid ${
                  idx === activeMagicTab ? "#8e44ad" : "rgba(255,255,255,0.12)"
                }`,
                background:
                  idx === activeMagicTab ? "rgba(142, 68, 173, 0.2)" : "#0f0f19",
                color: "#c9cfdd",
                cursor: magicLocked ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 700,
                opacity: magicLocked ? 0.6 : 1
              }}
            >
              {source.label}
            </button>
          ))}
        </div>
      )}
      {(() => {
        const source = magicSources[activeMagicTab] ?? magicSources[0];
        if (!source) return null;
        const selection = spellcastingSelections[source.key] ?? {};
        const knownSpells = Array.isArray(selection.knownSpells) ? selection.knownSpells : [];
        const preparedSpells = Array.isArray(selection.preparedSpells)
          ? selection.preparedSpells
          : [];
        const grantedSpells = Array.isArray(selection.grantedSpells)
          ? selection.grantedSpells
          : [];
        const legacyFocusItemId = selection.focusItemId ?? "";
        const focusInstanceId =
          selection.focusInstanceId ??
          (legacyFocusItemId
            ? inventoryItems.find(item => item?.id === legacyFocusItemId)?.instanceId ?? ""
            : "");
        const storage = source.storage ?? selection.storage ?? "memory";
        const grimoireItemId = selection.grimoireItemId ?? "";
        const totalCasterLevel = magicSources.reduce(
          (sum, item) => sum + getCasterContribution(item.casterProgression, item.classLevel),
          0
        );
        const slotsTable = magicSources.find(item => item.slotsByLevel)?.slotsByLevel ?? null;
        const slots = slotsTable
          ? slotsTable[String(Math.max(0, totalCasterLevel))] ?? []
          : [];
        const maxSpellLevel = slots.reduce((max, count, idx) => (count > 0 ? idx + 1 : max), 0);
        const dc =
          8 + computeMod(getScore(source.ability)) + (2 + Math.floor((resolveLevel() - 1) / 4));
        const spellAttack =
          computeMod(getScore(source.ability)) + (2 + Math.floor((resolveLevel() - 1) / 4));
        const focusTypes = Array.isArray(source.focusTypes) ? source.focusTypes : [];
        const focusOptions = inventoryItems.filter(item => {
          if (!item?.instanceId) return false;
          if (!item?.equippedSlot) return false;
          if (focusTypes.length === 0) return true;
          const tags = resolveItemTags(item.id);
          return focusTypes.some(tag => tags.includes(tag));
        });
        const storageLabel =
          storage === "memory" ? "Memoire" : storage === "innate" ? "Inne" : "Grimoire";
        const preparedList = source.preparation === "prepared" ? preparedSpells : knownSpells;
        const preparedIds = new Set(preparedList.map(spell => getSpellId(spell)));
        const grantedIds = new Set(grantedSpells.map(spell => getSpellId(spell)));
        const spellFilterTags = Array.isArray(source.spellFilterTags)
          ? source.spellFilterTags.map(tag => String(tag).toLowerCase())
          : [];
        const availableSpells = spellCatalog.list
          .filter(spell => {
            if (spellFilterTags.length === 0) return true;
            const tags = Array.isArray(spell.tags) ? spell.tags.map(tag => String(tag).toLowerCase()) : [];
            return spellFilterTags.some(tag => tags.includes(tag));
          })
          .filter(spell => {
            if (preparedIds.has(spell.id) || grantedIds.has(spell.id)) return true;
            if (typeof spell.level !== "number") return true;
            return spell.level <= maxSpellLevel;
          })
          .sort((a, b) => {
            const levelA = typeof a.level === "number" ? a.level : 0;
            const levelB = typeof b.level === "number" ? b.level : 0;
            if (levelA !== levelB) return levelA - levelB;
            return (a.name || "").localeCompare(b.name || "");
          });
        const freePreparedFromGrants = Boolean(source.freePreparedFromGrants);
        const preparedCount = Array.from(preparedIds).filter(
          id => !(freePreparedFromGrants && grantedIds.has(id))
        ).length;
        const preparedLimit = source.preparation === "prepared" ? Math.max(0, source.classLevel) : null;
        const canPrepareMore = preparedLimit === null ? true : preparedCount < preparedLimit;
        const canEditMagic = !magicLocked;
        return (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(12,12,18,0.75)",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                Carac principale: {source.ability}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                Methode: {source.preparation === "prepared" ? "Prepare" : "Connu"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                Niveau lanceur total: {totalCasterLevel}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                DD sort: {dc} | Attaque magique: {spellAttack >= 0 ? `+${spellAttack}` : spellAttack}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              Emplacements (total)
            </div>
            {slots.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8
                }}
              >
                {slots.map((count, idx) => {
                  if (count <= 0) return null;
                  return (
                    <div
                      key={`slots-${source.key}-${idx}`}
                      style={{
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.12)",
                        padding: "6px 8px",
                        background: "rgba(15,15,25,0.6)"
                      }}
                    >
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                        Niveau {idx + 1}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {Array.from({ length: count }).map((_, slotIdx) => (
                          <span
                            key={`slot-${source.key}-${idx}-${slotIdx}`}
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 3,
                              border: "1px solid rgba(255,255,255,0.35)",
                              background: "rgba(255,255,255,0.08)",
                              display: "inline-block"
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>—</div>
            )}
            {(source.spellIds.length > 0 || grantedSpells.length > 0) && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Sorts de progression:{" "}
                {(grantedSpells.length > 0
                  ? grantedSpells.map(spell => {
                      const id = getSpellId(spell);
                      return spellCatalog.byId.get(id)?.name ?? id;
                    })
                  : source.spellIds.map(id => spellCatalog.byId.get(id)?.name ?? id)
                ).join(", ")}
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                  {storage === "memory"
                    ? "Sorts memorises"
                    : source.preparation === "prepared"
                      ? "Sorts prepares"
                      : "Sorts connus"}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6
                  }}
                >
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                    {source.preparation === "prepared"
                      ? `Preparation: ${preparedCount}${preparedLimit !== null ? ` / ${preparedLimit}` : ""}`
                      : `Connus: ${preparedIds.size}`}
                  </div>
                  {grantedSpells.length > 0 && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                      Sorts imposes: {grantedSpells.length}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 8
                  }}
                >
                  {availableSpells.map(spell => {
                    const spellId = spell.id;
                    const isGranted = grantedIds.has(spellId);
                    const isPrepared = preparedIds.has(spellId) || isGranted;
                    const canToggle = !isGranted && (isPrepared || canPrepareMore);
                    const stateSourceEntries = Array.isArray(spellGrantsBySource?.[source.key])
                      ? spellGrantsBySource?.[source.key] ?? []
                      : [];
                    const stateEntry =
                      stateSourceEntries.find(entry => entry?.spellId === spellId) ?? null;
                    const originEntries = [
                      ...preparedSpells,
                      ...knownSpells,
                      ...grantedSpells
                    ]
                      .filter((entry): entry is Exclude<SpellEntry, string> => {
                        return typeof entry !== "string" && getSpellId(entry) === spellId;
                      })
                      .map(entry => entry.origin)
                      .filter(Boolean);
                    const fallbackSourceText =
                      originEntries.length > 0
                        ? originEntries
                            .map(origin => {
                              const sourceType = getSourceLabel(String(origin?.kind ?? ""));
                              const sourceId = origin?.id ? String(origin.id) : "";
                              return sourceId ? `${sourceType}:${sourceId}` : sourceType;
                            })
                            .join(", ")
                        : getSourceLabel(source.key.split(":")[0] ?? "");
                    const sourceBadgeText = stateEntry
                      ? `${getSourceLabel(String(stateEntry.sourceType ?? ""))}${
                          stateEntry.sourceId ? `:${stateEntry.sourceId}` : ""
                        }`
                      : fallbackSourceText;
                    const usageBadgeText = getUsageLabel(stateEntry);
                    const levelLabel = spell.level === 0 ? "Cantrip" : `Niv ${spell.level}`;
                    const components = spell.components ?? {};
                    const componentLabel = [
                      components.verbal ? "V" : null,
                      components.somatic ? "S" : null,
                      components.material ? "M" : null
                    ]
                      .filter(Boolean)
                      .join("/");
                    return (
                      <div
                        key={`spell-card-${source.key}-${spellId}`}
                        style={{
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.7)",
                          padding: "8px 10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5" }}>
                            {spell.name || spell.id}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.12)",
                                color: "rgba(255,255,255,0.7)"
                              }}
                            >
                              {levelLabel}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.12)",
                                color: "rgba(255,255,255,0.7)"
                              }}
                            >
                              {spell.school}
                            </span>
                            {spell.category && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 999,
                                  background: "rgba(255,255,255,0.12)",
                                  color: "rgba(255,255,255,0.7)"
                                }}
                              >
                                {spell.category}
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: "rgba(52, 152, 219, 0.2)",
                                color: "rgba(255,255,255,0.85)",
                                border: "1px solid rgba(52,152,219,0.45)"
                              }}
                            >
                              {sourceBadgeText}
                            </span>
                            {usageBadgeText && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 999,
                                  background: "rgba(241, 196, 15, 0.16)",
                                  color: "rgba(255,255,255,0.85)",
                                  border: "1px solid rgba(241,196,15,0.45)"
                                }}
                              >
                                {usageBadgeText}
                              </span>
                            )}
                          </div>
                        </div>
                        {spell.summary && (
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                            {spell.summary}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
                            {isGranted ? "Impose" : isPrepared ? "Prepare" : "Disponible"}
                          </div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
                            {componentLabel ? `Composantes: ${componentLabel}` : "Composantes: —"}
                          </div>
                          {!isGranted && (
                            <button
                              type="button"
                              onClick={() => {
                                const list =
                                  source.preparation === "prepared" ? preparedSpells : knownSpells;
                                if (isPrepared) {
                                  const next = list.filter(item => getSpellId(item) !== spellId);
                                  if (source.preparation === "prepared") {
                                    updateSpellcastingSelection(source.key, { preparedSpells: next });
                                  } else {
                                    updateSpellcastingSelection(source.key, { knownSpells: next });
                                  }
                                  return;
                                }
                                if (!canPrepareMore) return;
                                const next = [
                                  ...list,
                                  makeSpellEntry(spellId, { kind: "manual", sourceKey: source.key })
                                ];
                                if (source.preparation === "prepared") {
                                  updateSpellcastingSelection(source.key, { preparedSpells: next });
                                } else {
                                  updateSpellcastingSelection(source.key, { knownSpells: next });
                                }
                              }}
                              disabled={!canToggle || !canEditMagic}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: "1px solid rgba(255,255,255,0.18)",
                                background: isPrepared
                                  ? "rgba(231, 76, 60, 0.2)"
                                  : "rgba(46, 204, 113, 0.18)",
                                color: "#f5f5f5",
                                cursor: canToggle && canEditMagic ? "pointer" : "not-allowed",
                                fontSize: 11,
                                fontWeight: 700,
                                opacity: canToggle && canEditMagic ? 1 : 0.5
                              }}
                            >
                              {isPrepared ? "Retirer" : "Preparer"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                  Focalisateur
                </div>
                <select
                  value={focusInstanceId}
                  onChange={e =>
                    updateSpellcastingSelection(source.key, {
                      focusInstanceId: e.target.value || null
                    })
                  }
                  disabled={magicLocked}
                  style={{
                    width: "100%",
                    background: "#0f0f19",
                    color: "#f5f5f5",
                    border: "1px solid #333",
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontSize: 12,
                    opacity: magicLocked ? 0.6 : 1
                  }}
                >
                  <option value="">Aucun</option>
                  {focusOptions.map(item => (
                    <option key={`focus-${item.instanceId}`} value={item.instanceId}>
                      {formatEquipmentLabel(item.id)}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 10 }}>
                  Stockage des sorts: {storageLabel}
                </div>
                {storage === "grimoire" && (
                  <select
                    value={grimoireItemId}
                    onChange={e =>
                      updateSpellcastingSelection(source.key, {
                        grimoireItemId: e.target.value || null
                      })
                    }
                    disabled={magicLocked}
                    style={{
                      width: "100%",
                      background: "#0f0f19",
                      color: "#f5f5f5",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: "6px 8px",
                      fontSize: 12,
                      marginTop: 6,
                      opacity: magicLocked ? 0.6 : 1
                    }}
                  >
                    <option value="">Choisir un grimoire</option>
                    {inventoryItems
                      .filter(item => item.type === "object")
                      .map(item => (
                        <option key={`grimoire-${item.id}`} value={item.id}>
                          {formatEquipmentLabel(item.id)}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
