import React from "react";
import type { ActionAvailability, ActionDefinition } from "../game/actionTypes";

export function ActionsPanel(props: {
  actions: ActionDefinition[];
  selectedAction: ActionDefinition | null;
  selectedAvailability: ActionAvailability | null;
  computeActionAvailability: (action: ActionDefinition) => ActionAvailability;
  onSelectActionId: (actionId: string) => void;
  describeRange: (targeting: ActionDefinition["targeting"]) => string;
  describeUsage: (usage: ActionDefinition["usage"]) => string;
  conditionLabel: (cond: ActionDefinition["conditions"][number]) => string;
  getEffectLabels: (action: ActionDefinition) => string[];
  onPreviewActionArea: (action: ActionDefinition) => void;
  onValidateAction: (action: ActionDefinition) => void;
}): React.JSX.Element {
  const selectedAction = props.selectedAction;
  const selectedAvailability = props.selectedAvailability;

  return (
    <section
      style={{
        padding: "8px 12px",
        background: "#141421",
        borderRadius: 8,
        border: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      <h2 style={{ margin: "0 0 4px" }}>Actions détaillées</h2>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
        Source: <code>src/data/actions/index.json</code>. Liste chargée et vérifiée
        localement (phase, distance).
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: "180px",
            overflowY: "auto",
            paddingRight: 4
          }}
        >
          {props.actions.map(action => {
            const availability = props.computeActionAvailability(action);
            const isSelected = selectedAction?.id === action.id;
            const badgeColor =
              action.actionCost.actionType === "action"
                ? "#8e44ad"
                : action.actionCost.actionType === "bonus"
                  ? "#27ae60"
                  : action.actionCost.actionType === "reaction"
                    ? "#e67e22"
                    : "#2980b9";
            const borderColor = isSelected ? "#6c5ce7" : "#2a2a3a";
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => props.onSelectActionId(action.id)}
                style={{
                  textAlign: "left",
                  background: isSelected ? "#1e1e2f" : "#0f0f19",
                  color: "#f5f5f5",
                  border: `1px solid ${borderColor}`,
                  borderRadius: 6,
                  padding: "8px 10px",
                  cursor: "pointer"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 4,
                    alignItems: "center"
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{action.name}</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: badgeColor,
                      color: "#fff"
                    }}
                  >
                    {action.actionCost.actionType}
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  {action.summary || action.category}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 4,
                    fontSize: 11,
                    alignItems: "center"
                  }}
                >
                  <span
                    style={{
                      color: availability.enabled ? "#2ecc71" : "#e74c3c"
                    }}
                  >
                    {availability.enabled ? "Disponible" : availability.reasons[0] || "Bloquée"}
                  </span>
                  <span style={{ color: "#9aa0b5" }}>
                    {props.describeRange(action.targeting)}
                  </span>
                  <span style={{ color: "#9aa0b5" }}>{props.describeUsage(action.usage)}</span>
                </div>
              </button>
            );
          })}
          {props.actions.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.8 }}>Aucune action chargée pour le moment.</div>
          )}
        </div>

        {selectedAction && (
          <div
            style={{
              borderTop: "1px solid #2a2a3a",
              paddingTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                fontSize: 11
              }}
            >
              <span
                style={{
                  background: "#2d2d40",
                  color: "#d0d4f7",
                  padding: "2px 6px",
                  borderRadius: 4
                }}
              >
                {selectedAction.category}
              </span>
              {selectedAction.tags?.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  style={{
                    background: "#1f2a38",
                    color: "#9bb0d6",
                    padding: "2px 6px",
                    borderRadius: 4
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12 }}>{selectedAction.summary || "Pas de résumé."}</div>
            <div style={{ fontSize: 12 }}>
              <strong>Coût:</strong> {selectedAction.actionCost.actionType} | Mouvement{" "}
              {selectedAction.actionCost.movementCost}
            </div>
            <div style={{ fontSize: 12 }}>
              <strong>Portée:</strong> {props.describeRange(selectedAction.targeting)}
            </div>
            <div style={{ fontSize: 12 }}>
              <strong>Usage:</strong> {props.describeUsage(selectedAction.usage)}
            </div>
            <div style={{ fontSize: 12 }}>
              <strong>Conditions:</strong>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  marginTop: 4
                }}
              >
                {selectedAction.conditions.length === 0 && (
                  <span style={{ color: "#9aa0b5" }}>Aucune condition.</span>
                )}
                {selectedAction.conditions.map((cond, idx) => (
                  <div key={`${cond.type}-${idx}`} style={{ color: "#cfd3ec" }}>
                    {props.conditionLabel(cond)}
                    {cond.reason ? ` - ${cond.reason}` : ""}
                  </div>
                ))}
                {selectedAvailability && (
                  <div
                    style={{
                      color: selectedAvailability.enabled ? "#2ecc71" : "#e74c3c"
                    }}
                  >
                    État:{" "}
                    {selectedAvailability.enabled
                      ? "OK pour ce tour"
                      : selectedAvailability.reasons.join(" | ") || "Bloqué"}
                    {selectedAvailability.details.length > 0 && (
                      <div style={{ color: "#9aa0b5", marginTop: 2 }}>
                        {selectedAvailability.details.join(" / ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ fontSize: 12 }}>
              <strong>Effets:</strong>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  marginTop: 4
                }}
              >
                {props.getEffectLabels(selectedAction).map((label, idx) => (
                  <div key={`${selectedAction.id}-effect-${idx}`} style={{ color: "#cfd3ec" }}>
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12 }}>
              <strong>Hints IA:</strong> {selectedAction.aiHints?.priority || "n/a"}
              <div style={{ color: "#9aa0b5" }}>
                Success: {selectedAction.aiHints?.successLog || "n/a"}
              </div>
              <div style={{ color: "#9aa0b5" }}>
                Failure: {selectedAction.aiHints?.failureLog || "n/a"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => props.onPreviewActionArea(selectedAction)}
                style={{
                  padding: "4px 8px",
                  background: "#2980b9",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                Prévisualiser
              </button>
              <button
                type="button"
                onClick={() => props.onValidateAction(selectedAction)}
                disabled={!selectedAvailability?.enabled}
                style={{
                  padding: "4px 8px",
                  background: selectedAvailability?.enabled ? "#2ecc71" : "#555",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: selectedAvailability?.enabled ? "pointer" : "default",
                  fontSize: 12
                }}
              >
                Valider l&apos;action
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

