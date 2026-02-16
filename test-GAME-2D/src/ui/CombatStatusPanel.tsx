import React from "react";
import type { TurnPhase } from "../game/engine/runtime/turnTypes";
import type { EnemyAiStateSummary, EnemyActionIntent } from "../game/engine/runtime/turnTypes";
import type { TokenState } from "../types";
import type { Personnage } from "../types";

export function CombatStatusPanel(props: {
  round: number;
  phase: TurnPhase;
  playerInitiative: number | null;
  player: TokenState;
  selectedPath: { x: number; y: number }[];
  sampleCharacter: Personnage;
  aiLastState: EnemyAiStateSummary | null;
  aiLastIntents: EnemyActionIntent[] | null;
  aiUsedFallback: boolean;
  aiLastError: string | null;
}): React.JSX.Element {
  return (
    <section
      style={{
        padding: "8px 12px",
        background: "#141421",
        borderRadius: 8,
        border: "1px solid #333"
      }}
    >
      <h2 style={{ margin: "0 0 8px" }}>État du combat</h2>
      <div>
        <strong>Round :</strong> {props.round} | <strong>Phase :</strong>{" "}
        {props.phase === "player" ? "Joueur" : "Ennemis"}
      </div>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        <strong>Initiative PJ :</strong> {props.playerInitiative ?? "en cours..."}
      </div>
      <div>
        <strong>Nom :</strong> {props.sampleCharacter.nom.nomcomplet}
      </div>
      <div>
        <strong>Niveau :</strong> {props.player.combatStats?.level ?? 1} |{" "}
        <strong>Classe :</strong> {props.sampleCharacter.classe[1].classeId}
      </div>
      <div>
        <strong>PV :</strong> {props.player.hp} / {props.player.maxHp}
      </div>
      <div>
        <strong>CA :</strong> {props.player.combatStats?.armorClass ?? 10}
      </div>
      <div style={{ marginTop: 8 }}>
        <strong>Caracs :</strong> FOR {props.sampleCharacter.caracs.force.FOR} | DEX{" "}
        {props.sampleCharacter.caracs.dexterite.DEX} | CON{" "}
        {props.sampleCharacter.caracs.constitution.CON}
      </div>
      <div style={{ marginTop: 8, fontSize: 12 }}>
        <strong>Trajectoire :</strong>{" "}
        {props.selectedPath.length === 0
          ? "aucune"
          : `(${props.player.x}, ${props.player.y}) -> ` +
            props.selectedPath.map(node => `(${node.x}, ${node.y})`).join(" -> ")}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.85 }}>
        <strong>IA ennemis (debug) :</strong>
        <div>
          Dernier appel :{" "}
          {props.aiLastState
            ? `round ${props.aiLastState.round}, phase ${props.aiLastState.phase}`
            : "aucun"}
        </div>
        <div>
          Décisions reçues :{" "}
          {props.aiLastIntents === null
            ? "n/a"
            : `${props.aiLastIntents.length} (fallback: ${
                props.aiUsedFallback ? "oui" : "non"
              })`}
        </div>
        {props.aiLastError && <div>Erreur : {props.aiLastError}</div>}
      </div>
    </section>
  );
}


