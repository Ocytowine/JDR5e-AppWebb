import React from "react";
import type { EnemyActionType } from "../game/turnTypes";
import type { TokenState } from "../types";
import type { ActionDefinition } from "../game/actionTypes";

export function EnemiesPanel(props: {
  enemies: TokenState[];
  player: TokenState;
  revealedEnemyIds: Set<string>;
  capabilities: { action: EnemyActionType; label: string; color: string }[];
  validatedAction: ActionDefinition | null;
  selectedTargetIds: string[];
  describeEnemyLastDecision: (enemyId: string) => string;
  validateEnemyTargetForAction: (
    action: ActionDefinition,
    enemy: TokenState,
    actor: TokenState,
    allTokens: TokenState[]
  ) => { ok: boolean; reason?: string };
  onToggleTargetId: (enemyId: string) => void;
  onSetTargetMode: (mode: "none" | "selecting") => void;
  onLog: (message: string) => void;
}): React.JSX.Element {
  const { enemies, player, validatedAction } = props;

  return (
    <section
      style={{
        padding: "8px 12px",
        background: "#151524",
        borderRadius: 8,
        border: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      <h2 style={{ margin: "0 0 4px" }}>Ennemis</h2>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
        Chaque ennemi est une entité propre. Capacités IA : déplacement, attaque au
        contact, attente si aucune option.
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: "180px",
          overflowY: "auto",
          paddingRight: 4
        }}
      >
        {enemies.map(enemy => {
          const isRevealed = props.revealedEnemyIds.has(enemy.id);
          const enemyNature = enemy.enemyTypeLabel ?? enemy.enemyTypeId ?? "inconnu";

          return (
          <div
            key={enemy.id}
            style={{
              background: "#0f0f19",
              border: "1px solid #2a2a3a",
              borderRadius: 8,
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 6
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8
              }}
            >
              <strong style={{ color: "#f5f5f5" }}>{enemy.id}</strong>
              <span style={{ fontSize: 12, color: "#b0b8c4" }}>
                ({enemy.x},{enemy.y}) |{" "}
                {isRevealed ? (
                  <>
                    PV {enemy.hp} / {enemy.maxHp}{" "}
                    {enemy.aiRole ? `(role: ${enemy.aiRole})` : ""}
                  </>
                ) : (
                  "etat inconnu"
                )}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.78)" }}>
              Nature : {isRevealed ? enemyNature : "inconnu"}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6
              }}
            >
              {props.capabilities.map(cap => (
                <span
                  key={`${enemy.id}-${cap.action}`}
                  style={{
                    background: cap.color,
                    color: "#0b0b12",
                    borderRadius: 4,
                    padding: "2px 6px",
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {cap.action.toUpperCase()}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#d0d6e0" }}>
              Ce qu&apos;il peut faire : {props.capabilities.map(cap => cap.label).join(" | ")}
            </div>

            {validatedAction &&
              (validatedAction.targeting?.target === "enemy" ||
                validatedAction.targeting?.target === "hostile") && (
              (() => {
                const validation = props.validateEnemyTargetForAction(
                  validatedAction,
                  enemy,
                  player,
                  [player, ...enemies]
                );
                const canTarget = validation.ok;
                const isCurrent = props.selectedTargetIds.includes(enemy.id);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (!canTarget) {
                        props.onLog(
                          validation.reason ||
                            `Cible ${enemy.id} invalide pour ${validatedAction.name}.`
                        );
                        return;
                      }
                      props.onToggleTargetId(enemy.id);
                      props.onLog(`Cible basculee: ${enemy.id}.`);
                    }}
                    disabled={!canTarget}
                    style={{
                      marginTop: 6,
                      alignSelf: "flex-start",
                      padding: "4px 8px",
                      fontSize: 11,
                      borderRadius: 4,
                      border: "none",
                      cursor: canTarget ? "pointer" : "default",
                      background: canTarget ? "#3498db" : "#555",
                      color: "#fff",
                      opacity: isCurrent ? 1 : 0.9
                    }}
                  >
                    {isCurrent ? "Cible actuelle" : "Cibler avec l'action validée"}
                  </button>
                );
              })()
            )}

            <div style={{ fontSize: 12, color: "#9cb2ff" }}>
              Dernière décision IA : {props.describeEnemyLastDecision(enemy.id)}
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}
