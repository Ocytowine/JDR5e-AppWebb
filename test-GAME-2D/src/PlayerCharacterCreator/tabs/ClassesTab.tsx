import React from "react";

export function ClassesTab(props: {
  activeClassTab: "primary" | "secondary";
  resolvedClassTab: "primary" | "secondary";
  setActiveClassTab: (value: "primary" | "secondary") => void;
  isSectionLocked: (id: string) => boolean;
  lockButtonBaseStyle: React.CSSProperties;
  getClassLockButtonState: () => { background: string; label: string };
  renderPendingBadge: (count: number) => React.ReactNode;
  getPendingCountForSection: (id: string) => number;
  resetClassImpactsForSlot: (slot: 1 | 2) => void;
  hasPendingClassChoicesForSlot: (slot: 1 | 2) => boolean;
  startClassDefine: (slot: 1 | 2) => void;
  setClassLockForSlot: (slot: 1 | 2, value: boolean) => void;
  resolveLevel: () => number;
  setLevel: (value: number) => void;
  classOptions: Array<any>;
  subclassOptions: Array<any>;
  isActiveClassLocked: boolean;
  activeClassSlot: 1 | 2;
  activeClassId: string;
  activeSubclassId: string;
  activeClassEntry: any;
  handleClassSelect: (cls: any, slot: 1 | 2) => void;
  setSubclassSelection: (id: string, slot: 1 | 2) => void;
  setClassLevel: (slot: 1 | 2, value: number) => void;
  isSecondaryEnabled: boolean;
  enableSecondaryClass: () => void;
  removeSecondaryClass: () => void;
}): React.JSX.Element {
  const {
    activeClassTab,
    resolvedClassTab,
    setActiveClassTab,
    isSectionLocked,
    lockButtonBaseStyle,
    getClassLockButtonState,
    renderPendingBadge,
    getPendingCountForSection,
    resetClassImpactsForSlot,
    hasPendingClassChoicesForSlot,
    startClassDefine,
    setClassLockForSlot,
    resolveLevel,
    setLevel,
    classOptions,
    subclassOptions,
    isActiveClassLocked,
    activeClassSlot,
    activeClassId,
    activeSubclassId,
    activeClassEntry,
    handleClassSelect,
    setSubclassSelection,
    setClassLevel,
    isSecondaryEnabled,
    enableSecondaryClass,
    removeSecondaryClass
  } = props;

  return (
    <>
      <div style={{ fontSize: 12, color: "#b0b8c4" }}>
        Definissez le niveau global, puis choisissez vos classes.
      </div>
      <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
        <span>Niveau global :</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 6px",
            borderRadius: 8,
            border: "1px solid #2a2a3a",
            background: "#0f0f19"
          }}
        >
          <button
            type="button"
            onClick={() => !isSectionLocked("classes") && setLevel(resolveLevel() - 1)}
            disabled={isSectionLocked("classes")}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: "1px solid #333",
              background: "#141421",
              color: "#f5f5f5",
              cursor: isSectionLocked("classes") ? "not-allowed" : "pointer",
              display: "grid",
              placeItems: "center",
              opacity: isSectionLocked("classes") ? 0.6 : 1
            }}
            aria-label="Diminuer le niveau"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
            </svg>
          </button>
          <input
            type="number"
            min={1}
            max={20}
            value={resolveLevel()}
            onChange={e => !isSectionLocked("classes") && setLevel(Number(e.target.value))}
            disabled={isSectionLocked("classes")}
            style={{
              width: 60,
              background: "#0f0f19",
              color: "#f5f5f5",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "4px 6px",
              textAlign: "center",
              appearance: "textfield",
              WebkitAppearance: "textfield",
              MozAppearance: "textfield",
              opacity: isSectionLocked("classes") ? 0.6 : 1
            }}
          />
          <button
            type="button"
            onClick={() => !isSectionLocked("classes") && setLevel(resolveLevel() + 1)}
            disabled={isSectionLocked("classes")}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: "1px solid #333",
              background: "#141421",
              color: "#f5f5f5",
              cursor: isSectionLocked("classes") ? "not-allowed" : "pointer",
              display: "grid",
              placeItems: "center",
              opacity: isSectionLocked("classes") ? 0.6 : 1
            }}
            aria-label="Augmenter le niveau"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
              <rect x="5.25" y="2" width="1.5" height="8" fill="currentColor" />
            </svg>
          </button>
        </div>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          Bonus de maitrise: +{2 + Math.floor((resolveLevel() - 1) / 4)}
        </span>
        <button
          type="button"
          onClick={() => {
            if (isActiveClassLocked) {
              resetClassImpactsForSlot(activeClassSlot);
              return;
            }
            if (hasPendingClassChoicesForSlot(activeClassSlot)) {
              startClassDefine(activeClassSlot);
              return;
            }
            setClassLockForSlot(activeClassSlot, true);
          }}
          style={{
            ...lockButtonBaseStyle,
            marginLeft: "auto",
            padding: "6px 10px",
            background: getClassLockButtonState().background,
            fontSize: 12
          }}
        >
          {getClassLockButtonState().label}
          {renderPendingBadge(getPendingCountForSection("classes"))}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setActiveClassTab("primary")}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: `1px solid ${resolvedClassTab === "primary" ? "#6fd3a8" : "#333"}`,
            background:
              resolvedClassTab === "primary" ? "rgba(46, 204, 113, 0.16)" : "#0f0f19",
            color: "#c9cfdd",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700
          }}
        >
          Classe principale
        </button>
        {resolveLevel() > 2 && (
          <button
            type="button"
            onClick={() => setActiveClassTab("secondary")}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${resolvedClassTab === "secondary" ? "#6fd3a8" : "#333"}`,
              background:
                resolvedClassTab === "secondary" ? "rgba(46, 204, 113, 0.16)" : "#0f0f19",
              color: "#c9cfdd",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            2eme classe
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1.1fr) minmax(240px, 1fr)",
          gap: 12,
          alignItems: "start"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            alignContent: "start"
          }}
        >
          {resolvedClassTab === "secondary" && !isSecondaryEnabled && (
            <button
              type="button"
              onClick={() => !isActiveClassLocked && enableSecondaryClass()}
              disabled={isActiveClassLocked}
              style={{
                textAlign: "center",
                borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.25)",
                background: "rgba(12,12,18,0.6)",
                color: "#f5f5f5",
                padding: 14,
                cursor: isActiveClassLocked ? "not-allowed" : "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 180
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.25)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 28,
                  fontWeight: 700
                }}
              >
                +
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                Activer une 2eme classe
              </div>
            </button>
          )}
          {classOptions.map(cls => {
            const isSelected = activeClassId === cls.id;
            const isDisabled =
              isActiveClassLocked || (resolvedClassTab === "secondary" && !isSecondaryEnabled);
            return (
              <button
                key={`${resolvedClassTab}-${cls.id}`}
                type="button"
                onClick={() => {
                  if (isDisabled) return;
                  handleClassSelect(cls, activeClassSlot);
                }}
                disabled={isDisabled}
                style={{
                  textAlign: "left",
                  borderRadius: 10,
                  border: `1px solid ${isSelected ? "#6fd3a8" : "rgba(255,255,255,0.12)"}`,
                  background: isSelected ? "rgba(46, 204, 113, 0.14)" : "rgba(12,12,18,0.75)",
                  color: "#f5f5f5",
                  padding: 12,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minHeight: 120,
                  opacity: isDisabled ? 0.55 : 1
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800 }}>{cls.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  {cls.description}
                </div>
              </button>
            );
          })}
        </div>
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(12,12,18,0.75)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minHeight: 260
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {resolvedClassTab === "secondary" ? "2eme classe" : "Classe principale"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            Niveau dans cette classe :
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 6px",
              borderRadius: 8,
              border: "1px solid #2a2a3a",
              background: "#0f0f19",
              width: "fit-content"
            }}
          >
            <button
              type="button"
              onClick={() =>
                !isActiveClassLocked &&
                setClassLevel(activeClassSlot, (Number(activeClassEntry?.niveau) || 1) - 1)
              }
              disabled={isActiveClassLocked || (resolvedClassTab === "secondary" && !isSecondaryEnabled)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "1px solid #333",
                background: "#141421",
                color: "#f5f5f5",
                cursor: isActiveClassLocked ? "not-allowed" : "pointer",
                display: "grid",
                placeItems: "center",
                opacity: isActiveClassLocked ? 0.6 : 1
              }}
              aria-label="Diminuer le niveau de classe"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
              </svg>
            </button>
            <input
              type="number"
              min={1}
              max={isSecondaryEnabled ? Math.max(1, resolveLevel() - 1) : resolveLevel()}
              value={activeClassEntry?.niveau ?? (activeClassSlot === 1 ? resolveLevel() : 0)}
              onChange={e =>
                !isActiveClassLocked && setClassLevel(activeClassSlot, Number(e.target.value))
              }
              disabled={isActiveClassLocked || (resolvedClassTab === "secondary" && !isSecondaryEnabled)}
              style={{
                width: 60,
                background: "#0f0f19",
                color: "#f5f5f5",
                border: "1px solid #333",
                borderRadius: 6,
                padding: "4px 6px",
                textAlign: "center",
                appearance: "textfield",
                WebkitAppearance: "textfield",
                MozAppearance: "textfield",
                opacity: isActiveClassLocked ? 0.6 : 1
              }}
            />
            <button
              type="button"
              onClick={() =>
                !isActiveClassLocked &&
                setClassLevel(activeClassSlot, (Number(activeClassEntry?.niveau) || 1) + 1)
              }
              disabled={isActiveClassLocked || (resolvedClassTab === "secondary" && !isSecondaryEnabled)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "1px solid #333",
                background: "#141421",
                color: "#f5f5f5",
                cursor: isActiveClassLocked ? "not-allowed" : "pointer",
                display: "grid",
                placeItems: "center",
                opacity: isActiveClassLocked ? 0.6 : 1
              }}
              aria-label="Augmenter le niveau de classe"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                <rect x="5.25" y="2" width="1.5" height="8" fill="currentColor" />
              </svg>
            </button>
          </div>

          {resolvedClassTab === "secondary" && isSecondaryEnabled && (
            <button
              type="button"
              onClick={() => !isActiveClassLocked && removeSecondaryClass()}
              disabled={isActiveClassLocked}
              style={{
                marginTop: 8,
                alignSelf: "flex-start",
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(231,76,60,0.14)",
                color: "#f5f5f5",
                cursor: isActiveClassLocked ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 700,
                opacity: isActiveClassLocked ? 0.6 : 1
              }}
            >
              Supprimer la 2eme classe
            </button>
          )}

          {(() => {
            const cls = classOptions.find(c => c.id === activeClassId);
            if (!cls) {
              return (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  Choisissez d'abord une classe.
                </div>
              );
            }
            const threshold = cls.subclassLevel ?? 1;
            const level =
              Number(activeClassEntry?.niveau) || (activeClassSlot === 1 ? resolveLevel() : 0);
            if (level < threshold) {
              return (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px dashed rgba(255,255,255,0.2)",
                    background: "rgba(8,8,12,0.6)",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12
                  }}
                >
                  Sous-classe verrouillee jusqu'au niveau {threshold}.
                </div>
              );
            }
            const allowedIds = Array.isArray(cls.subclassIds) ? cls.subclassIds : [];
            const subclasses = subclassOptions.filter(sub => sub.classId === cls.id);
            return (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 10
                }}
              >
                {subclasses.map(sub => {
                  const isAllowed = allowedIds.length === 0 || allowedIds.includes(sub.id);
                  const isSelected = activeSubclassId === sub.id;
                  return (
                    <button
                      key={`${activeClassSlot}-${sub.id}`}
                      type="button"
                      onClick={() => {
                        if (!isAllowed || isActiveClassLocked) return;
                        setSubclassSelection(sub.id, activeClassSlot);
                      }}
                      disabled={!isAllowed || isActiveClassLocked}
                      style={{
                        textAlign: "left",
                        borderRadius: 10,
                        border: `1px solid ${
                          isSelected ? "#f1c40f" : "rgba(255,255,255,0.12)"
                        }`,
                        background: isSelected
                          ? "rgba(241, 196, 15, 0.14)"
                          : "rgba(12,12,18,0.75)",
                        color: "#f5f5f5",
                        padding: 12,
                        cursor: isAllowed && !isActiveClassLocked ? "pointer" : "not-allowed",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        minHeight: 110,
                        opacity: isAllowed && !isActiveClassLocked ? 1 : 0.5
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{sub.label}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                        {sub.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}
