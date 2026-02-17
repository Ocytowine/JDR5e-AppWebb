import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

type EquipmentContextItem = {
  id: string;
  label: string;
  subtitle?: string;
  costLabel?: string;
  costTone?: "free" | "interaction" | "action" | "bonus";
  disabled?: boolean;
  disabledReason?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function EquipmentContextWindow(props: {
  open: boolean;
  anchorX: number;
  anchorY: number;
  title: string;
  subtitle?: string;
  items: EquipmentContextItem[];
  selectedId: string | null;
  detailsById: Record<string, string[]>;
  emptyLabel?: string;
  onHoverItem: (id: string | null) => void;
  onSelectItem: (id: string) => void;
  onClose: () => void;
}): React.ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 16, top: 16 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const hasUserMovedRef = useRef<boolean>(false);

  useLayoutEffect(() => {
    if (!props.open) return;
    if (hasUserMovedRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const desiredLeft = props.anchorX + 18;
    const desiredTop = props.anchorY + 18;
    const left = clamp(desiredLeft, 8, Math.max(8, parentRect.width - rect.width - 8));
    const top = clamp(desiredTop, 8, Math.max(8, parentRect.height - rect.height - 8));
    setPos({ left, top });
  }, [props.anchorX, props.anchorY, props.open, props.title]);

  useEffect(() => {
    if (!props.open) return;
    hasUserMovedRef.current = false;
  }, [props.open, props.title]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (event: PointerEvent) => {
      const el = containerRef.current;
      const drag = dragRef.current;
      if (!el || !drag) return;
      const parent = el.parentElement;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;
      const nextLeft = drag.startLeft + dx;
      const nextTop = drag.startTop + dy;
      const left = clamp(nextLeft, 8, Math.max(8, parentRect.width - rect.width - 8));
      const top = clamp(nextTop, 8, Math.max(8, parentRect.height - rect.height - 8));
      hasUserMovedRef.current = true;
      setPos({ left, top });
    };
    const onUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
    };
  }, [isDragging]);

  if (!props.open) return null;

  const selectedDetails = props.selectedId ? props.detailsById[props.selectedId] ?? [] : [];

  return (
    <div
      ref={containerRef}
      onMouseDown={event => event.stopPropagation()}
      style={{
        position: "absolute",
        left: pos.left,
        top: pos.top,
        zIndex: 66,
        width: 540,
        maxWidth: "min(94vw, 640px)",
        background: "rgba(8, 10, 14, 0.95)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 22px 70px rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div
          onPointerDown={event => {
            if (event.button !== 0) return;
            const el = containerRef.current;
            if (!el) return;
            event.preventDefault();
            event.stopPropagation();
            dragRef.current = {
              startClientX: event.clientX,
              startClientY: event.clientY,
              startLeft: pos.left,
              startTop: pos.top
            };
            setIsDragging(true);
          }}
          style={{ minWidth: 0, flex: "1 1 auto", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{props.title}</div>
          {props.subtitle ? (
            <div style={{ marginTop: 3, fontSize: 12, color: "rgba(255,255,255,0.68)" }}>{props.subtitle}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={props.onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            cursor: "pointer",
            fontWeight: 900
          }}
          title="Fermer"
        >
          X
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 10, minHeight: 220 }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            maxHeight: 320,
            overflow: "auto",
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}
        >
          {props.items.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
              {props.emptyLabel ?? "Aucune option."}
            </div>
          ) : null}
          {props.items.map(item => {
            const isSelected = props.selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={Boolean(item.disabled)}
                onMouseEnter={() => props.onHoverItem(item.id)}
                onFocus={() => props.onHoverItem(item.id)}
                onClick={() => {
                  if (item.disabled) return;
                  props.onSelectItem(item.id);
                }}
                title={item.disabled ? item.disabledReason ?? "Indisponible" : undefined}
                style={{
                  textAlign: "left",
                  borderRadius: 9,
                  border: isSelected
                    ? "1px solid rgba(120,210,255,0.65)"
                    : "1px solid rgba(255,255,255,0.12)",
                  background: item.disabled
                    ? "rgba(90,90,100,0.35)"
                    : isSelected
                      ? "rgba(90,180,220,0.22)"
                      : "rgba(255,255,255,0.06)",
                  color: item.disabled ? "rgba(255,255,255,0.55)" : "#fff",
                  padding: "8px 10px",
                  cursor: item.disabled ? "not-allowed" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800 }}>{item.label}</span>
                {item.costLabel ? (
                  <span
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 2,
                      padding: "1px 6px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 0.2,
                      background:
                        item.costTone === "action"
                          ? "rgba(231,76,60,0.22)"
                          : item.costTone === "bonus"
                            ? "rgba(142,68,173,0.28)"
                          : item.costTone === "interaction"
                            ? "rgba(241,196,15,0.24)"
                            : "rgba(46,204,113,0.20)",
                      color:
                        item.costTone === "action"
                          ? "#ffc2bc"
                          : item.costTone === "bonus"
                            ? "#f0d7ff"
                          : item.costTone === "interaction"
                            ? "#ffe7a1"
                            : "#c8f7de",
                      border:
                        item.costTone === "action"
                          ? "1px solid rgba(231,76,60,0.48)"
                          : item.costTone === "bonus"
                            ? "1px solid rgba(142,68,173,0.54)"
                          : item.costTone === "interaction"
                            ? "1px solid rgba(241,196,15,0.5)"
                            : "1px solid rgba(46,204,113,0.42)"
                    }}
                  >
                    {item.costLabel}
                  </span>
                ) : null}
                {item.subtitle ? (
                  <span style={{ fontSize: 11, color: item.disabled ? "rgba(255,255,255,0.48)" : "rgba(255,255,255,0.68)" }}>
                    {item.subtitle}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            padding: 10,
            maxHeight: 320,
            overflow: "auto"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 8 }}>Details</div>
          {selectedDetails.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
              Survolez une option pour afficher ses details.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selectedDetails.map((line, idx) => (
                <div key={`${props.selectedId ?? "none"}-${idx}`} style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
