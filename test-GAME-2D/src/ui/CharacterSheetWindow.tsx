import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Personnage, TokenState } from "../types";
import type { WeaponTypeDefinition } from "../game/weaponTypes";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function statRow(label: string, value: React.ReactNode) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "rgba(255,255,255,0.7)" }}>{label}</span>
      <span style={{ color: "#fff", fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function formatMovementModes(modes?: Record<string, number> | string[]): string | null {
  if (!modes) return null;
  if (Array.isArray(modes)) {
    if (modes.length === 0) return null;
    return modes.map(id => `${id.charAt(0).toUpperCase()}${id.slice(1)}`).join(", ");
  }
  const entries = Object.entries(modes);
  if (entries.length === 0) return null;
  return entries
    .map(([key, value]) => {
      const label = key ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : "Mode";
      return `${label} ${value}`;
    })
    .join(", ");
}

export function CharacterSheetWindow(props: {
  open: boolean;
  anchorX: number;
  anchorY: number;
  character: Personnage;
  player: TokenState;
  equippedWeapons: WeaponTypeDefinition[];
  actionsRemaining: number;
  bonusRemaining: number;
  resources: Record<string, number>;
  onClose: () => void;
}): React.ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 8, top: 8 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showCharacterJson, setShowCharacterJson] = useState<boolean>(false);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!props.open) return;
    const el = containerRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const left = clamp(8, 8, Math.max(8, parentRect.width - rect.width - 8));
    const top = clamp(8, 8, Math.max(8, parentRect.height - rect.height - 8));
    setPos({ left, top });
  }, [props.open]);

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

  const stats = props.player.combatStats;
  const charName = props.character?.nom?.nomcomplet ?? "Personnage";
  const movementSummary =
    formatMovementModes(props.character.movementModes) ??
    (typeof stats?.moveRange === "number" || typeof props.player.moveRange === "number"
      ? `Standard ${stats?.moveRange ?? props.player.moveRange ?? 0}`
      : "Inconnu");
  const equippedWeapons = props.equippedWeapons ?? [];

  return (
    <div
      ref={containerRef}
      onMouseDown={event => event.stopPropagation()}
      style={{
        position: "absolute",
        left: pos.left,
        top: pos.top,
        zIndex: 65,
        width: 360,
        maxWidth: "min(92vw, 420px)",
        background: "rgba(10, 10, 16, 0.92)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
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
          style={{
            minWidth: 0,
            flex: "1 1 auto",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none"
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>Fiche personnage</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
            {charName}
          </div>
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
        >
          ×
        </button>
      </div>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setShowCharacterJson(prev => !prev)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "#f5f5f5",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700
          }}
        >
          {showCharacterJson ? "Masquer le JSON" : "Afficher le JSON"}
        </button>
      </div>
      {showCharacterJson && (
        <pre
          style={{
            marginTop: 8,
            maxHeight: 260,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 11,
            color: "rgba(255,255,255,0.8)",
            background: "#0f0f19",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: 8
          }}
        >
          {JSON.stringify(props.character, null, 2)}
        </pre>
      )}

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Etat</div>
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          {statRow("PV", `${props.player.hp} / ${props.player.maxHp}`)}
          {statRow("Actions restantes", props.actionsRemaining)}
          {statRow("Bonus restantes", props.bonusRemaining)}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Stats</div>
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          {statRow("Niveau", stats?.level ?? 1)}
          {statRow("CA", stats?.armorClass ?? 10)}
          {statRow("Deplacements", movementSummary)}
          {statRow("Portee", stats?.attackRange ?? props.player.attackRange ?? 1)}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Caracs</div>
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          {statRow("FOR", props.character.caracs?.force?.FOR ?? "-")}
          {statRow("DEX", props.character.caracs?.dexterite?.DEX ?? "-")}
          {statRow("CON", props.character.caracs?.constitution?.CON ?? "-")}
          {statRow("INT", props.character.caracs?.intelligence?.INT ?? "-")}
          {statRow("SAG", props.character.caracs?.sagesse?.SAG ?? "-")}
          {statRow("CHA", props.character.caracs?.charisme?.CHA ?? "-")}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Ressources</div>
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.keys(props.resources).length === 0 && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Aucune ressource.</div>
          )}
          {Object.entries(props.resources).map(([key, value]) =>
            statRow(key, value)
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Armes equipees</div>
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          {equippedWeapons.length === 0 && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
              Aucune arme equipee.
            </div>
          )}
          {equippedWeapons.map(weapon => {
            const damage = weapon.damage?.dice ?? "?";
            const damageType = weapon.damage?.damageType ?? "";
            const subtitle = damageType ? `${damage} ${damageType}` : damage;
            return (
              <div
                key={weapon.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 12
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.75)" }}>{weapon.name}</span>
                <span style={{ color: "#fff", fontWeight: 800 }}>{subtitle}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
