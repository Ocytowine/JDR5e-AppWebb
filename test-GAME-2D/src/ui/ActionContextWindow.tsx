import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ActionAvailability, ActionDefinition } from "../game/engine/rules/actionTypes";
import type { ActionPlan, ActionStep } from "../game/engine/core/actionPlan";
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
  plan: ActionPlan | null;
  isComplete: boolean;
  pendingHazard?: {
    label: string;
    formula: string;
    cells: number;
    statusRoll?: { die: number; trigger: number; statusId?: string };
  } | null;
  hazardResolution?: {
    damageTotal: number;
    diceText: string;
    statusId: string | null;
    statusTriggered: boolean;
  } | null;
  player: TokenState;
  enemies: TokenState[];
  validatedAction: ActionDefinition | null;
  ammoInfo?: {
    label: string;
    available: number;
    required: number;
    insufficient: boolean;
    unknown?: boolean;
  } | null;
  spellSourceOptions?: Array<{
    entryId: string;
    label: string;
    detail?: string;
    disabled?: boolean;
  }> | null;
  selectedSpellSourceEntryId?: string | null;
  onSelectSpellSourceEntryId?: (entryId: string) => void;
  targetMode: "none" | "selecting";
  selectedTargetIds: string[];
  selectedTargetLabels: string[];
  maxTargets?: number | null;
  onToggleTargetId?: (enemyId: string) => void;
  targetStatuses?: Array<{
    id: string;
    label: string;
    remainingTurns: number;
    sourceId: string | null;
    isPersistent?: boolean;
  }>;
  effectiveAdvantageMode?: AdvantageMode;
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
  movement?: {
    costUsed: number;
    costMax: number;
    hasPath: boolean;
    isMoving: boolean;
    canInteract: boolean;
    onSelectPath: () => void;
    onValidateMove: () => void;
    onCancelMove: () => void;
  } | null;
  onFinishHazard?: () => void;
  onValidateAction: (action: ActionDefinition) => void;
  onFinishAction: () => void;
  onCancelAction: () => void;
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
  const [finishReady, setFinishReady] = useState<boolean>(false);
  const [hazardFinishReady, setHazardFinishReady] = useState<boolean>(false);

  const action = props.action;
  const availability = props.availability;
  const isBlocked = availability ? !availability.enabled : false;
  const hasHazard = Boolean(props.pendingHazard);
  const isMovementAction = Boolean(action?.tags?.includes("move-type"));
  const movement = props.movement ?? null;
  const canValidateMove = Boolean(
    movement &&
      movement.canInteract &&
      movement.hasPath &&
      props.stage === "active" &&
      movement.costMax > 0
  );
  const showCancelAction = Boolean(action && props.stage === "active");

  useLayoutEffect(() => {
    if (!props.open) return;
    if (hasUserMovedRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    const parent = el.parentElement;
    if (!parent) return;

    setPos({ left: 8, top: 8 });
  }, [props.anchorX, props.anchorY, props.open, action?.id]);

  useEffect(() => {
    if (!props.open) return;
    hasUserMovedRef.current = false;
  }, [props.open, action?.id]);

  useEffect(() => {
    if (!props.isComplete) {
      setFinishReady(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setFinishReady(true);
    }, 2000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [props.isComplete, action?.id]);

  useEffect(() => {
    if (!props.hazardResolution) {
      setHazardFinishReady(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setHazardFinishReady(true);
    }, 2000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [props.hazardResolution?.damageTotal, props.hazardResolution?.statusTriggered]);

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

  const steps = props.plan?.steps ?? [];
  const stepByType = useMemo(() => {
    const map = new Map<string, ActionStep>();
    for (const step of steps) {
      map.set(step.type, step);
    }
    return map;
  }, [steps]);
  const getStep = (type: ActionStep["type"]) => stepByType.get(type) ?? null;
  const validateStep = getStep("validate");
  const resourceStep = getStep("resource");
  const ammoInfo = props.ammoInfo ?? null;
  const spellSourceOptions = Array.isArray(props.spellSourceOptions) ? props.spellSourceOptions : [];
  const targetStep = getStep("target");
  const attackStep = getStep("attack-roll");
  const damageStep = getStep("damage-roll");
  const isImpossible = steps.some(step => step.status === "blocked");
  const statusLabel = isImpossible
    ? "Action impossible"
    : props.stage === "active"
      ? "Action en cours"
      : "Action possible";
  const statusColor = isImpossible ? "#c0392b" : props.stage === "active" ? "#f39c12" : "#2ecc71";
  const totalSteps = Math.max(1, steps.length);
  const completedSteps = props.isComplete
    ? totalSteps
    : steps.filter(step => step.status === "done").length;
  const progress = completedSteps / totalSteps;

  if (!props.open) return null;
  if (!action && !hasHazard) return null;

  return (
    <div
      ref={containerRef}
      onMouseDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
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
      {showCancelAction && (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={props.onCancelAction}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(231,76,60,0.18)",
              color: "#ffb2aa",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 900
            }}
          >
            Annuler action
          </button>
        </div>
      )}

      {action && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              height: 18,
              borderRadius: 9,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              overflow: "hidden",
              position: "relative"
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
                background: statusColor,
                opacity: 0.85
              }}
            />
            <div
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: 11,
                fontWeight: 900,
                color: "#0b0b12",
                textAlign: "center",
                lineHeight: "18px"
              }}
            >
              {statusLabel}
            </div>
          </div>
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

      {action && isMovementAction && movement && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Deplacement</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
            Trajet: {movement.costUsed}/{movement.costMax}
          </div>
          {props.stage === "active" ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Cliquez sur la grille pour tracer le trajet, puis validez.
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Validez l&apos;action pour commencer le trajet.
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={movement.onSelectPath}
              disabled={!movement.canInteract || props.stage !== "active"}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  movement.canInteract && props.stage === "active"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(90, 90, 100, 0.55)",
                color:
                  movement.canInteract && props.stage === "active"
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.75)",
                cursor:
                  movement.canInteract && props.stage === "active" ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 900
              }}
            >
              Selectionner trajet
            </button>
            <button
              type="button"
              onClick={movement.onValidateMove}
              disabled={!canValidateMove}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  canValidateMove
                    ? "#f1c40f"
                    : "rgba(90, 90, 100, 0.55)",
                color:
                  canValidateMove
                    ? "#0b0b12"
                    : "rgba(255,255,255,0.75)",
                cursor:
                  canValidateMove
                    ? "pointer"
                    : "not-allowed",
                fontSize: 12,
                fontWeight: 900
              }}
            >
              Valider deplacement
            </button>
            <button
              type="button"
              onClick={movement.onCancelMove}
              disabled={!movement.isMoving && !movement.hasPath}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  movement.isMoving || movement.hasPath ? "rgba(255,255,255,0.08)" : "rgba(90, 90, 100, 0.35)",
                color: "rgba(255,255,255,0.85)",
                cursor: movement.isMoving || movement.hasPath ? "pointer" : "not-allowed",
                fontSize: 12,
                fontWeight: 900
              }}
            >
              Annuler trajet
            </button>
          </div>
        </div>
      )}

      {action && validateStep && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {props.stage === "draft" && (
          <button
            type="button"
            onClick={() => {
              props.onValidateAction(action);
            }}
            disabled={validateStep.status !== "available"}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: validateStep.status === "available" ? "#2ecc71" : "rgba(90, 90, 100, 0.55)",
              color: validateStep.status === "available" ? "#0b0b12" : "rgba(255,255,255,0.75)",
              cursor: validateStep.status === "available" ? "pointer" : "not-allowed",
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

      {action && targetStep && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Cible</div>
            <button
              type="button"
              onClick={() => {
                if (props.stage !== "active") return;
                props.onSetTargetMode("selecting");
              }}
              disabled={targetStep.status === "locked" || targetStep.status === "blocked"}
              style={{
                padding: "4px 8px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  targetStep.status === "locked" || targetStep.status === "blocked"
                    ? "rgba(90, 90, 100, 0.35)"
                    : "rgba(255,255,255,0.06)",
                color: "#fff",
                cursor:
                  targetStep.status === "locked" || targetStep.status === "blocked"
                    ? "not-allowed"
                    : "pointer",
                fontSize: 12,
                fontWeight: 800
              }}
            >
              Selectionner cible
            </button>
          </div>

          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.80)" }}>
            Cibles selectionnees:{" "}
            <strong>{props.selectedTargetLabels.length > 0 ? "" : "aucune"}</strong>
            {typeof props.maxTargets === "number" && props.maxTargets > 0 && (
              <span style={{ marginLeft: 6, color: "rgba(255,255,255,0.6)" }}>
                ({props.selectedTargetIds.length}/{props.maxTargets})
              </span>
            )}
            {props.targetMode === "selecting" && props.stage === "active" && (
              <span style={{ marginLeft: 8, color: "#cfd3ff" }}>(clique pour ajouter/retirer)</span>
            )}
          </div>
          {props.selectedTargetLabels.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {props.selectedTargetLabels.map((label, idx) => {
                const hasId = idx < props.selectedTargetIds.length;
                const id = hasId ? props.selectedTargetIds[idx] : label;
                return (
                  <div
                    key={`${id}-${idx}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "rgba(255,255,255,0.85)"
                    }}
                  >
                    <span>{label}</span>
                    {props.onToggleTargetId && hasId && (
                      <button
                        type="button"
                        onClick={() => props.onToggleTargetId?.(id)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: "rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.9)",
                          cursor: "pointer",
                          fontSize: 10,
                          lineHeight: "16px",
                          padding: 0
                        }}
                        title="Retirer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {props.stage !== "active" && (
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.70)" }}>
              Validez l&apos;action pour pouvoir selectionner une cible sur la grille.
            </div>
          )}
          {props.stage === "active" && props.targetMode === "selecting" && (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => props.onSetTargetMode("none")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 800
                }}
              >
                Terminer selection
              </button>
            </div>
          )}
          {props.targetStatuses && props.targetStatuses.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)"
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: "#fff" }}>
                Etats actifs sur la cible
              </div>
              <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                {props.targetStatuses.map(status => (
                  <div
                    key={status.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.82)"
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{status.label}</span>
                    <span style={{ color: "rgba(255,255,255,0.65)" }}>
                      {status.sourceId ? `posee par ${status.sourceId}` : "source inconnue"} |{" "}
                      {status.isPersistent ? "jusqua la mort" : `${status.remainingTurns} tour(s)`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {resourceStep && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Ressource</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
            {resourceStep.title}
          </div>
          {resourceStep.detail && (
            <div style={{ marginTop: 4, fontSize: 11, color: "#ffb2aa" }}>{resourceStep.detail}</div>
          )}
        </div>
      )}

      {ammoInfo && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Munitions</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
            {ammoInfo.label} : {ammoInfo.available} / {ammoInfo.required}
          </div>
          {ammoInfo.unknown && (
            <div style={{ marginTop: 4, fontSize: 11, color: "#ffb2aa" }}>
              Type de munition non reference dans le catalogue.
            </div>
          )}
          {ammoInfo.insufficient && !ammoInfo.unknown && (
            <div style={{ marginTop: 4, fontSize: 11, color: "#ffb2aa" }}>
              Munitions insuffisantes pour cette action.
            </div>
          )}
        </div>
      )}

      {action && spellSourceOptions.length > 1 && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>Source du sort</div>
          <select
            value={props.selectedSpellSourceEntryId ?? ""}
            onChange={event => {
              const value = event.target.value;
              if (!value) return;
              props.onSelectSpellSourceEntryId?.(value);
            }}
            style={{
              width: "100%",
              marginTop: 6,
              background: "#0f0f19",
              color: "#f5f5f5",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 12
            }}
          >
            {spellSourceOptions.map(option => (
              <option key={option.entryId} value={option.entryId} disabled={Boolean(option.disabled)}>
                {option.label}
              </option>
            ))}
          </select>
          {(() => {
            const selected =
              spellSourceOptions.find(option => option.entryId === (props.selectedSpellSourceEntryId ?? "")) ??
              spellSourceOptions[0];
            if (!selected?.detail) return null;
            return (
              <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
                {selected.detail}
              </div>
            );
          })()}
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
          {props.hazardResolution && (
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
              Resultat: {props.hazardResolution.damageTotal} degats
              {props.hazardResolution.diceText ? ` (${props.hazardResolution.diceText})` : ""}
            </div>
          )}
          {props.hazardResolution?.statusId && (
            <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
              Etat {props.hazardResolution.statusId}: {props.hazardResolution.statusTriggered ? "declenche" : "non declenche"}
            </div>
          )}
          {props.onRollHazardDamage && !props.hazardResolution && (
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
          {hazardFinishReady && props.onFinishHazard && (
            <button
              type="button"
              onClick={props.onFinishHazard}
              style={{
                marginTop: 10,
                padding: "6px 10px",
                background: "#2ecc71",
                color: "#0b0b12",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 900
              }}
            >
              Terminer
            </button>
          )}
        </div>
      )}

      {action && props.stage === "active" && (attackStep || damageStep) && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Jets</div>

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {attackStep && (
              <button
                type="button"
                onClick={props.onRollAttack}
                disabled={attackStep.status !== "available"}
                style={{
                  padding: "6px 10px",
                  background: attackStep.status === "available" ? "#2980b9" : "rgba(90, 90, 100, 0.55)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  cursor: attackStep.status === "available" ? "pointer" : "not-allowed",
                  fontSize: 12,
                  fontWeight: 900
                }}
              >
                Jet de touche
              </button>
            )}
            {damageStep && (
              <button
                type="button"
                onClick={props.onRollDamage}
                disabled={damageStep.status !== "available"}
                style={{
                  padding: "6px 10px",
                  background: damageStep.status === "available" ? "#27ae60" : "rgba(90, 90, 100, 0.55)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  cursor: damageStep.status === "available" ? "pointer" : "not-allowed",
                  fontSize: 12,
                  fontWeight: 900
                }}
              >
                Degats
              </button>
            )}
          </div>
          {attackStep && props.effectiveAdvantageMode && props.effectiveAdvantageMode !== "normal" && (
            <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
              {props.effectiveAdvantageMode === "advantage"
                ? "Avantage: lancer 2d20, garder le meilleur."
                : "Desavantage: lancer 2d20, garder le pire."}
            </div>
          )}

          {attackStep && props.attackRoll && (
            <div
              style={{
                marginTop: 10,
                padding: 8,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)"
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>
                Jet de touche
              </div>
              {props.effectiveAdvantageMode && props.effectiveAdvantageMode !== "normal" && (
                <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                  {props.effectiveAdvantageMode === "advantage"
                    ? "Avantage: 2d20, garder le meilleur."
                    : "Desavantage: 2d20, garder le pire."}
                </div>
              )}
              <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                {props.attackRoll.total}
                {props.attackRoll.isCrit ? " (crit)" : ""}
              </div>
              {damageStep && damageStep.status === "blocked" && (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#ffb2aa" }}>
                  RATE
                </div>
              )}
              {damageStep && damageStep.status !== "blocked" && (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#bdf6d2" }}>
                  REUSSI
                </div>
              )}
            </div>
          )}

          {damageStep && props.damageRoll && (
            <div
              style={{
                marginTop: 10,
                padding: 8,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)"
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.85)" }}>
                Degats
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                {props.damageRoll.total}
                {props.damageRoll.isCrit ? " (crit)" : ""}
              </div>
            </div>
          )}

          {finishReady && (
            <button
              type="button"
              onClick={props.onFinishAction}
              style={{
                marginTop: 12,
                padding: "6px 10px",
                background: "#2ecc71",
                color: "#0b0b12",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 900
              }}
            >
              Terminer
            </button>
          )}
        </div>
      )}
    </div>
  );
}


