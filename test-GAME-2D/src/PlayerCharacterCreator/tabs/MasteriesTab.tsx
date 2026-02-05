import React from "react";

export function MasteriesTab(props: {
  masteriesMode: "normal" | "manual";
  setMasteriesMode: (value: "normal" | "manual") => void;
  resetMasteries: () => void;
  isSectionLocked: (id: string) => boolean;
  toggleSectionLock: (id: string) => void;
  lockButtonBaseStyle: React.CSSProperties;
  getLockButtonState: (id: string) => { background: string; label: string };
  renderPendingBadge: (count: number) => React.ReactNode;
  getPendingCountForSection: (id: string) => number;
  weaponMasteryOptions: Array<{ id: string; label: string }>;
  armorMasteryOptions: Array<{ id: string; label: string }>;
  toolMasteryOptions: Array<{ id: string; label: string }>;
  weaponMasteries: string[];
  armorMasteries: string[];
  toolMasteries: string[];
  toggleWeaponMastery: (id: string) => void;
  toggleArmorMastery: (id: string) => void;
  toggleToolMastery: (id: string) => void;
  canEditMasteries: boolean;
  renderSourceDots: (sources: string[]) => React.ReactNode;
  getMasterySources: (kind: "weapons" | "armors" | "tools", id: string) => string[];
}): React.JSX.Element {
  const {
    masteriesMode,
    setMasteriesMode,
    resetMasteries,
    isSectionLocked,
    toggleSectionLock,
    lockButtonBaseStyle,
    getLockButtonState,
    renderPendingBadge,
    getPendingCountForSection,
    weaponMasteryOptions,
    armorMasteryOptions,
    toolMasteryOptions,
    weaponMasteries,
    armorMasteries,
    toolMasteries,
    toggleWeaponMastery,
    toggleArmorMastery,
    toggleToolMastery,
    canEditMasteries,
    renderSourceDots,
    getMasterySources
  } = props;

  const renderMasteryGrid = (
    title: string,
    items: Array<{ id: string; label: string }>,
    selected: string[],
    onToggle: (id: string) => void,
    kind: "weapons" | "armors" | "tools"
  ) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{title}</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 8,
          marginTop: 6
        }}
      >
        {items.map(item => {
          const isActive = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => canEditMasteries && onToggle(item.id)}
              disabled={!canEditMasteries}
              style={{
                textAlign: "left",
                borderRadius: 8,
                border: `1px solid ${
                  isActive ? "rgba(79,125,242,0.6)" : "rgba(255,255,255,0.12)"
                }`,
                background: isActive ? "rgba(79,125,242,0.18)" : "rgba(12,12,18,0.75)",
                color: "#f5f5f5",
                padding: "8px 10px",
                cursor: canEditMasteries ? "pointer" : "not-allowed",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6
              }}
            >
              <span>{item.label}</span>
              {renderSourceDots(getMasterySources(kind, item.id))}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#b0b8c4" }}>
          Selectionnez les maitrises. Elles influenceront les bonus et malus.
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {([
            { id: "normal", label: "Normal" },
            { id: "manual", label: "Manuel" }
          ] as const).map(mode => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setMasteriesMode(mode.id)}
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background:
                  masteriesMode === mode.id
                    ? "rgba(79,125,242,0.2)"
                    : "rgba(255,255,255,0.06)",
                color: "#f5f5f5",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => !isSectionLocked("masteries") && resetMasteries()}
          disabled={isSectionLocked("masteries")}
          style={{
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "#f5f5f5",
            cursor: isSectionLocked("masteries") ? "not-allowed" : "pointer",
            fontSize: 11,
            fontWeight: 700,
            opacity: isSectionLocked("masteries") ? 0.6 : 1
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => toggleSectionLock("masteries")}
          style={{
            ...lockButtonBaseStyle,
            marginLeft: "auto",
            background: getLockButtonState("masteries").background
          }}
        >
          {getLockButtonState("masteries").label}
          {renderPendingBadge(getPendingCountForSection("masteries"))}
        </button>
      </div>
      {renderMasteryGrid(
        "Armes",
        weaponMasteryOptions,
        weaponMasteries,
        toggleWeaponMastery,
        "weapons"
      )}
      {renderMasteryGrid(
        "Armures",
        armorMasteryOptions,
        armorMasteries,
        toggleArmorMastery,
        "armors"
      )}
      {renderMasteryGrid("Outils", toolMasteryOptions, toolMasteries, toggleToolMastery, "tools")}
    </>
  );
}
