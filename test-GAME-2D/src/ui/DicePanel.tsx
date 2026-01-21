import React from "react";
import type { AdvantageMode, AttackRollResult, DamageRollResult } from "../dice/roller";
import type { ActionDefinition } from "../game/actionTypes";

export function DicePanel(props: {
  validatedAction: ActionDefinition | null;
  pendingHazard?: {
    label: string;
    formula: string;
    cells: number;
    statusRoll?: { die: number; trigger: number; statusId?: string };
  } | null;
  advantageMode: AdvantageMode;
  onSetAdvantageMode: (mode: AdvantageMode) => void;
  onRollAttack: () => void;
  onRollDamage: () => void;
  onRollHazardDamage: () => void;
  onAutoResolve: () => void;
  attackRoll: AttackRollResult | null;
  damageRoll: DamageRollResult | null;
  diceLogs: string[];
}): React.JSX.Element {
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
      <h2 style={{ margin: "0 0 4px" }}>Jets de dés</h2>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
        Choisir une action, la valider, puis lancer le jet de touche et/ou de dégâts. Mode
        auto: enchaîne touche + dégâts.
      </p>
      {props.pendingHazard && (
        <div
          style={{
            background: "#1a1424",
            border: "1px solid #3b2d4a",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 12
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Danger: {props.pendingHazard.label}
          </div>
          <div>
            Cases traversees: {props.pendingHazard.cells} | Jet requis:{" "}
            {props.pendingHazard.formula}
          </div>
          {props.pendingHazard.statusRoll && (
            <div style={{ marginTop: 2, opacity: 0.85 }}>
              Etat: d{props.pendingHazard.statusRoll.die} =={" "}
              {props.pendingHazard.statusRoll.trigger}
            </div>
          )}
          <button
            type="button"
            onClick={props.onRollHazardDamage}
            style={{
              marginTop: 6,
              padding: "4px 8px",
              background: "#c0392b",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            Lancer degats environnement
          </button>
        </div>
      )}
      <div style={{ fontSize: 12 }}>
        Action validée :{" "}
        {props.validatedAction
          ? `${props.validatedAction.name} (${props.validatedAction.id})`
          : "aucune (valider une action d'abord)"}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["normal", "advantage", "disadvantage"] as AdvantageMode[]).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => props.onSetAdvantageMode(mode)}
            style={{
              padding: "4px 8px",
              background: props.advantageMode === mode ? "#8e44ad" : "#2c2c3a",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            {mode}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={props.onRollAttack}
          disabled={!props.validatedAction?.attack}
          style={{
            padding: "4px 8px",
            background: props.validatedAction?.attack ? "#2980b9" : "#555",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: props.validatedAction?.attack ? "pointer" : "default",
            fontSize: 12
          }}
        >
          Lancer jet de touche
        </button>
        <button
          type="button"
          onClick={props.onRollDamage}
          disabled={!props.validatedAction?.damage}
          style={{
            padding: "4px 8px",
            background: props.validatedAction?.damage ? "#27ae60" : "#555",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: props.validatedAction?.damage ? "pointer" : "default",
            fontSize: 12
          }}
        >
          Lancer dégâts
        </button>
        <button
          type="button"
          onClick={props.onAutoResolve}
          style={{
            padding: "4px 8px",
            background: "#9b59b6",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          Mode auto (touche + dégâts)
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8
        }}
      >
        <div
          style={{
            background: "#101020",
            borderRadius: 6,
            padding: 8,
            border: "1px solid #26263a"
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>Jet de touche</div>
          {props.attackRoll ? (
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>
              d20: {props.attackRoll.d20.rolls.join(" / ")} → {props.attackRoll.d20.total} | bonus{" "}
              {props.attackRoll.bonus} | total {props.attackRoll.total}{" "}
              {props.attackRoll.isCrit ? "(critique)" : ""}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Pas encore lancé.</div>
          )}
        </div>
        <div
          style={{
            background: "#101020",
            borderRadius: 6,
            padding: 8,
            border: "1px solid #26263a"
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>Jet de dégâts</div>
          {props.damageRoll ? (
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>
              Dés:{" "}
              {props.damageRoll.dice.length
                ? props.damageRoll.dice.map(d => d.rolls.join("+")).join(" | ")
                : "-"}{" "}
              | mod {props.damageRoll.flatModifier} | total {props.damageRoll.total}{" "}
              {props.damageRoll.isCrit ? "(critique)" : ""}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Pas encore lancé.</div>
          )}
        </div>
      </div>
      <div style={{ fontSize: 12 }}>
        <strong>Logs des jets:</strong>
        <div
          style={{
            marginTop: 4,
            display: "flex",
            flexDirection: "column",
            gap: 2
          }}
        >
          {props.diceLogs.map((entry, idx) => (
            <div key={idx} style={{ color: "#dfe6ff" }}>
              - {entry}
            </div>
          ))}
          {props.diceLogs.length === 0 && (
            <div style={{ color: "#9aa0b5" }}>Aucun jet enregistré.</div>
          )}
        </div>
      </div>
    </section>
  );
}

