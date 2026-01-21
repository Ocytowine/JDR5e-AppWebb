import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ActionAvailability, ActionDefinition } from "../game/actionTypes";
import type { TokenState } from "../types";
import type { AdvantageMode, AttackRollResult, DamageRollResult } from "../dice/roller";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function badgeColorForActionType(actionType: string): string {
  if (actionType === "action") return "#8e44ad";
  if (actionType === "bonus") return "#27ae60";
  if (actionType === "reaction") return "#e67e22";
  return "#2980b9";
}

export function ActionContextWindow(props: {
  open: boolean;
  anchorX: number;
  anchorY: number;
  stage: "draft" | "active";
  action: ActionDefinition | null;
  availability: ActionAvailability | null;
  pendingHazard?: {
    label: string;
    formula: string;
    cells: number;
    statusRoll?: { die: number; trigger: number; statusId?: string };
  } | null;
  player: TokenState;
  enemies: TokenState[];
  validatedAction: ActionDefinition | null;
  targetMode: "none" | "selecting";
  selectedTargetId: string | null;
  selectedTargetLabel: string | null;
  onSelectTargetId: (enemyId: string) => void;
  onSetTargetMode: (mode: "none" | "selecting") => void;
  advantageMode: AdvantageMode;
  onSetAdvantageMode: (mode: AdvantageMode) => void;
  onRollAttack: () => void;
  onRollDamage: () => void;
  onRollHazardDamage?: () => void;
  onAutoResolve: () => void;
  attackRoll: AttackRollResult | null;
  damageRoll: DamageRollResult | null;
  diceLogs: string[];
  onValidateAction: (action: ActionDefinition) => void;
  onClose: () => void;
}): React.ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 16, top: 16 });
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const hasUserMovedRef = useRef<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const action = props.action;
  const availability = props.availability;
  const isBlocked = availability ? !availability.enabled : false;
  const hasHazard = Boolean(props.pendingHazard);

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
  }, [props.anchorX, props.anchorY, props.open, action?.id]);

  useEffect(() => {
    if (!props.open) return;
    hasUserMovedRef.current = false;
  }, [props.open, action?.id]);

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

  const actionNeedsTarget = action?.targeting?.target === "enemy";
  const showTargeting = Boolean(actionNeedsTarget);

  if (!props.open) return null;
  if (!action && !hasHazard) return null;

  return (
    <div
      ref={containerRef}
      onMouseDown={event => event.stopPropagation()}
      style={{
        position: "absolute",
        left: pos.left,
        top: pos.top,
        zIndex: 60,
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start"
        }}
      >
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
          title="Glisser pour deplacer"
        >
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>
            {action ? action.name : "Danger environnement"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {action && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 6,
                background: badgeColorForActionType(action.actionCost.actionType),
                color: "#fff",
                fontWeight: 800
              }}
            >
              {action.actionCost.actionType}
            </span>
            )}
            {action && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.85)",
                fontWeight: 700
              }}
            >
              {action.category}
            </span>
            )}
            <span
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 6,
                background: action
                  ? isBlocked
                    ? "rgba(231,76,60,0.25)"
                    : "rgba(46,204,113,0.18)"
                  : "rgba(255,255,255,0.08)",
                border: action
                  ? `1px solid ${isBlocked ? "rgba(231,76,60,0.55)" : "rgba(46,204,113,0.45)"}`
                  : "1px solid rgba(255,255,255,0.12)",
                color: action ? (isBlocked ? "#ffb2aa" : "#bdf6d2") : "rgba(255,255,255,0.85)",
                fontWeight: 800
              }}
            >
              {action ? (availability ? (availability.enabled ? "Disponible" : "Bloquee") : "Etat inconnu") : "Hazard"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            props.onClose();
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            cursor: "pointer",
            fontWeight: 900,
            flex: "0 0 auto"
          }}
          title="Fermer"
        >
          ×
        </button>
      </div>

      {action && (
        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.82)" }}>
          {action.summary || "Aucun resume."}
        </div>
      )}

      {action && availability && !availability.enabled && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#ffb2aa" }}>Pourquoi c&apos;est bloque</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
            {availability.reasons.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {action && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {props.stage === "draft" && (
          <button
            type="button"
            onClick={() => {
              props.onValidateAction(action);
            }}
            disabled={Boolean(availability && !availability.enabled)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: availability?.enabled ? "#2ecc71" : "rgba(90, 90, 100, 0.55)",
              color: availability?.enabled ? "#0b0b12" : "rgba(255,255,255,0.75)",
              cursor: availability?.enabled ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 900
            }}
            title={!availability?.enabled ? "Action indisponible" : "Valider l'action"}
          >
            Valider
          </button>
        )}
        {props.stage === "active" && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.70)" }}>
            Action validee: suivez les etapes ci-dessous.
          </span>
        )}
        </div>
      )}

      {action && showTargeting && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Cible</div>
            <button
              type="button"
              onClick={() => {
                if (props.stage !== "active") return;
                props.onSetTargetMode("selecting");
              }}
              disabled={props.stage !== "active"}
              style={{
                padding: "4px 8px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: props.stage === "active" ? "rgba(255,255,255,0.06)" : "rgba(90, 90, 100, 0.35)",
                color: "#fff",
                cursor: props.stage === "active" ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 800
              }}
            >
              Selectionner cible
            </button>
          </div>

          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.80)" }}>
            Cible selectionnee:{" "}
            <strong>{props.selectedTargetLabel ? props.selectedTargetLabel : "aucune"}</strong>
            {props.targetMode === "selecting" && props.stage === "active" && (
              <span style={{ marginLeft: 8, color: "#cfd3ff" }}>(clique un ennemi ou un obstacle)</span>
            )}
          </div>
          {props.stage !== "active" && (
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.70)" }}>
              Validez l&apos;action pour pouvoir selectionner une cible sur la grille.
            </div>
          )}
        </div>
      )}

      {hasHazard && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>
            Danger: {props.pendingHazard?.label}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
            Cases traversees: {props.pendingHazard?.cells} | Jet requis: {props.pendingHazard?.formula}
          </div>
          {props.pendingHazard?.statusRoll && (
            <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              Etat: d{props.pendingHazard.statusRoll.die} == {props.pendingHazard.statusRoll.trigger}
            </div>
          )}
          {props.onRollHazardDamage && (
            <button
              type="button"
              onClick={props.onRollHazardDamage}
              style={{
                marginTop: 8,
                padding: "6px 10px",
                background: "#c0392b",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 900
              }}
            >
              Lancer degats environnement
            </button>
          )}
        </div>
      )}

      {action && props.stage === "active" && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Jets</div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["normal", "advantage", "disadvantage"] as AdvantageMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => props.onSetAdvantageMode(mode)}
                style={{
                  padding: "4px 8px",
                  background: props.advantageMode === mode ? "#8e44ad" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 800
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={props.onRollAttack}
              disabled={!props.validatedAction?.attack}
              style={{
                padding: "6px 10px",
                background: props.validatedAction?.attack ? "#2980b9" : "rgba(90, 90, 100, 0.55)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                cursor: props.validatedAction?.attack ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 900
              }}
            >
              Jet de touche
            </button>
            <button
              type="button"
              onClick={props.onRollDamage}
              disabled={!props.validatedAction?.damage}
              style={{
                padding: "6px 10px",
                background: props.validatedAction?.damage ? "#27ae60" : "rgba(90, 90, 100, 0.55)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                cursor: props.validatedAction?.damage ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 900
              }}
            >
              Degats
            </button>
            <button
              type="button"
              onClick={props.onAutoResolve}
              style={{
                padding: "6px 10px",
                background: "#9b59b6",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 900
              }}
            >
              Auto
            </button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div
              style={{
                padding: 8,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)"
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>Touche</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                {props.attackRoll ? `${props.attackRoll.total}${props.attackRoll.isCrit ? " (crit)" : ""}` : "-"}
              </div>
            </div>
            <div
              style={{
                padding: 8,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)"
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>Degats</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                {props.damageRoll ? `${props.damageRoll.total}${props.damageRoll.isCrit ? " (crit)" : ""}` : "-"}
              </div>
            </div>
          </div>

          {props.diceLogs.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.75)" }}>Derniers jets</div>
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                {props.diceLogs.slice(-4).map((entry, idx) => (
                  <div key={idx} style={{ fontSize: 11, color: "rgba(255,255,255,0.78)" }}>
                    - {entry}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
