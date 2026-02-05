import React from "react";

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
  casterProgression: "full" | "half" | "third" | "none";
  slotsByLevel?: Record<string, number[]>;
  classLevel: number;
  spellIds: string[];
};

export function MagicTab(props: {
  magicSources: MagicSource[];
  activeMagicTab: number;
  setActiveMagicTab: (value: number) => void;
  spellcastingSelections: Record<
    string,
    {
      knownSpells?: SpellEntry[];
      preparedSpells?: SpellEntry[];
      grantedSpells?: SpellEntry[];
      focusItemId?: string | null;
      storage?: "memory" | "innate" | "grimoire";
      grimoireItemId?: string | null;
    }
  >;
  spellInputByKey: Record<string, string>;
  setSpellInputByKey: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateSpellcastingSelection: (
    key: string,
    patch: Partial<{
      knownSpells: SpellEntry[];
      preparedSpells: SpellEntry[];
      grantedSpells: SpellEntry[];
      focusItemId: string | null;
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
  getSpellKey: (entry: SpellEntry) => string;
  makeSpellEntry: (id: string, origin?: { kind: string; id?: string; sourceKey?: string }) => SpellEntry;
}): React.JSX.Element {
  const {
    magicSources,
    activeMagicTab,
    setActiveMagicTab,
    spellcastingSelections,
    spellInputByKey,
    setSpellInputByKey,
    updateSpellcastingSelection,
    computeMod,
    getScore,
    resolveLevel,
    getCasterContribution,
    resolveItemTags,
    inventoryItems,
    formatEquipmentLabel,
    getSpellId,
    getSpellKey,
    makeSpellEntry
  } = props;

  return (
    <>
      <div style={{ fontSize: 12, color: "#b0b8c4" }}>
        Gestion de la magie selon les sources verrouillees.
      </div>
      {magicSources.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {magicSources.map((source, idx) => (
            <button
              key={`magic-tab-${source.key}`}
              type="button"
              onClick={() => setActiveMagicTab(idx)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: `1px solid ${
                  idx === activeMagicTab ? "#8e44ad" : "rgba(255,255,255,0.12)"
                }`,
                background:
                  idx === activeMagicTab ? "rgba(142, 68, 173, 0.2)" : "#0f0f19",
                color: "#c9cfdd",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700
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
        const focusItemId = selection.focusItemId ?? "";
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
        const dc =
          8 + computeMod(getScore(source.ability)) + (2 + Math.floor((resolveLevel() - 1) / 4));
        const spellAttack =
          computeMod(getScore(source.ability)) + (2 + Math.floor((resolveLevel() - 1) / 4));
        const focusTypes = Array.isArray(source.focusTypes) ? source.focusTypes : [];
        const focusOptions = inventoryItems.filter(item => {
          if (focusTypes.length === 0) return true;
          const tags = resolveItemTags(item.id);
          return focusTypes.some(tag => tags.includes(tag));
        });
        const storageLabel =
          storage === "memory" ? "Memoire" : storage === "innate" ? "Inne" : "Grimoire";
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
              Emplacements (total):{" "}
              {slots.length > 0
                ? slots
                    .map((count, idx) => (count > 0 ? `${idx + 1}: ${count}` : null))
                    .filter(Boolean)
                    .join(" | ")
                : "—"}
            </div>
            {(source.spellIds.length > 0 || grantedSpells.length > 0) && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Sorts de progression:{" "}
                {(grantedSpells.length > 0
                  ? grantedSpells.map(spell => getSpellId(spell))
                  : source.spellIds
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
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input
                    type="text"
                    placeholder="Ajouter un sort (id)"
                    value={spellInputByKey[source.key] ?? ""}
                    onChange={e =>
                      setSpellInputByKey(prev => ({ ...prev, [source.key]: e.target.value }))
                    }
                    style={{
                      flex: 1,
                      background: "#0f0f19",
                      color: "#f5f5f5",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: "6px 8px",
                      fontSize: 12
                    }}
                    onKeyDown={e => {
                      if (e.key !== "Enter") return;
                      const value = (e.currentTarget.value || "").trim();
                      if (!value) return;
                      const list = source.preparation === "prepared" ? preparedSpells : knownSpells;
                      if (list.some(spell => getSpellId(spell) === value)) return;
                      const next = [
                        ...list,
                        makeSpellEntry(value, { kind: "manual", sourceKey: source.key })
                      ];
                      if (source.preparation === "prepared") {
                        updateSpellcastingSelection(source.key, { preparedSpells: next });
                      } else {
                        updateSpellcastingSelection(source.key, { knownSpells: next });
                      }
                      setSpellInputByKey(prev => ({ ...prev, [source.key]: "" }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const value = (spellInputByKey[source.key] ?? "").trim();
                      if (!value) return;
                      const list = source.preparation === "prepared" ? preparedSpells : knownSpells;
                      if (list.some(spell => getSpellId(spell) === value)) return;
                      const next = [
                        ...list,
                        makeSpellEntry(value, { kind: "manual", sourceKey: source.key })
                      ];
                      if (source.preparation === "prepared") {
                        updateSpellcastingSelection(source.key, { preparedSpells: next });
                      } else {
                        updateSpellcastingSelection(source.key, { knownSpells: next });
                      }
                      setSpellInputByKey(prev => ({ ...prev, [source.key]: "" }));
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.08)",
                      color: "#f5f5f5",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    Ajouter
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(source.preparation === "prepared" ? preparedSpells : knownSpells).map(spell => (
                    <span
                      key={`spell-${source.key}-${getSpellKey(spell)}`}
                      style={{
                        padding: "2px 6px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: "rgba(142, 68, 173, 0.12)",
                        fontSize: 11,
                        color: "rgba(255,255,255,0.75)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      {getSpellId(spell)}
                      <button
                        type="button"
                        onClick={() => {
                          const list = source.preparation === "prepared" ? preparedSpells : knownSpells;
                          const next = list.filter(item => {
                            if (typeof spell === "string") {
                              return getSpellId(item) !== spell;
                            }
                            return typeof item === "string"
                              ? true
                              : item.instanceId !== spell.instanceId;
                          });
                          if (source.preparation === "prepared") {
                            updateSpellcastingSelection(source.key, { preparedSpells: next });
                          } else {
                            updateSpellcastingSelection(source.key, { knownSpells: next });
                          }
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "rgba(255,255,255,0.7)",
                          cursor: "pointer",
                          fontSize: 12
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                  Focalisateur
                </div>
                <select
                  value={focusItemId}
                  onChange={e =>
                    updateSpellcastingSelection(source.key, {
                      focusItemId: e.target.value || null
                    })
                  }
                  style={{
                    width: "100%",
                    background: "#0f0f19",
                    color: "#f5f5f5",
                    border: "1px solid #333",
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontSize: 12
                  }}
                >
                  <option value="">Aucun</option>
                  {focusOptions.map(item => (
                    <option key={`focus-${item.id}`} value={item.id}>
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
                    style={{
                      width: "100%",
                      background: "#0f0f19",
                      color: "#f5f5f5",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: "6px 8px",
                      fontSize: 12,
                      marginTop: 6
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
