import React from "react";
import type { LogisticsPlanTrace, WorldFaction } from "../../world-simulation";
import { editorSurfaceStyles, editorTextStyles, EDITOR_THEME } from "../editor/editorTheme";

function formatNumber(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function renderReserveRow(label: string, available: number | undefined, total: number | undefined, tone: string) {
  const safeAvailable = Math.max(0, available ?? 0);
  const safeTotal = Math.max(0, total ?? 0);
  const ratio = safeTotal > 0 ? Math.max(0, Math.min(1, safeAvailable / safeTotal)) : 0;
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#dce5f2" }}>
        <span>{label}</span>
        <span>{safeAvailable} / {safeTotal}</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.round(ratio * 100)}%`,
            height: "100%",
            background: tone,
            borderRadius: 999
          }}
        />
      </div>
    </div>
  );
}

export function SimulationLogisticsPanel(props: {
  runtimeFaction: WorldFaction | null;
  logisticsPlan: LogisticsPlanTrace | null;
}): React.JSX.Element {
  const ressources = props.runtimeFaction?.ressourcesTransport;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ ...editorSurfaceStyles.subsection, gap: 8 }}>
        <div style={editorTextStyles.sectionTitle}>Moyens logistiques</div>
        {ressources ? (
          <div style={{ display: "grid", gap: 8 }}>
            {renderReserveRow("Budget", ressources.budgetDisponible, ressources.budgetTotal, "#9bc2ff")}
            {renderReserveRow("Effectifs", ressources.effectifsDisponibles, ressources.effectifsTotal, "#caa5ff")}
            {renderReserveRow("Chevaux", ressources.chevauxDisponibles, ressources.chevauxTotal, "#72c58f")}
            {renderReserveRow("Bateaux", ressources.bateauxDisponibles, ressources.bateauxTotal, "#60b7d9")}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun stock logistique runtime pour cette faction.</div>
        )}
      </div>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 8 }}>
        <div style={editorTextStyles.sectionTitle}>Plan retenu</div>
        {props.logisticsPlan ? (
          <div style={{ display: "grid", gap: 8, fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                width: "fit-content",
                border: `1px solid ${props.logisticsPlan.faisable ? "rgba(114,197,143,0.34)" : "rgba(200,92,92,0.34)"}`,
                background: props.logisticsPlan.faisable ? "rgba(114,197,143,0.12)" : "rgba(200,92,92,0.12)",
                color: props.logisticsPlan.faisable ? "#72c58f" : "#ffb0b0",
                fontWeight: 800
              }}
            >
              {props.logisticsPlan.faisable ? "Plan faisable" : "Plan bloque"}
            </div>
            <div>Mode retenu: {props.logisticsPlan.modeRetenu ?? "aucun"}</div>
            <div>Cible d'execution: {props.logisticsPlan.cibleExecutionRef ? `${props.logisticsPlan.cibleExecutionRef.kind}:${props.logisticsPlan.cibleExecutionRef.id}` : "aucune"}</div>
            <div>Groupe planifie: {formatNumber(props.logisticsPlan.effectifPlanifie)} personnes</div>
            <div>Charge planifiee: {formatNumber(props.logisticsPlan.chargePlanifiee)}</div>
            <div>Itineraire: {props.logisticsPlan.routeIds.length > 0 ? props.logisticsPlan.routeIds.join(" -> ") : "aucun"}</div>
            <div>Temps estime: {formatNumber(props.logisticsPlan.ticksEstimes)} tick(s)</div>
            <div>Cout estime: {formatNumber(props.logisticsPlan.coutEstime)}</div>
            <div>Score risque: {formatNumber(props.logisticsPlan.scoreRisque)}</div>
            {props.logisticsPlan.acteurAssigneId ? <div>Acteur assigne: {props.logisticsPlan.acteurAssigneId}</div> : null}
            {props.logisticsPlan.raisonsBlocage.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gap: 4,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(200,92,92,0.28)",
                  background: "rgba(200,92,92,0.12)",
                  color: "#ffd7d7"
                }}
              >
                <div style={{ fontWeight: 700 }}>Blocages</div>
                {props.logisticsPlan.raisonsBlocage.map(reason => (
                  <div key={reason}>- {reason}</div>
                ))}
              </div>
            ) : null}
            {props.logisticsPlan.notes.length > 0 ? (
              <div style={{ display: "grid", gap: 4, color: EDITOR_THEME.colors.textMuted }}>
                <div style={{ fontWeight: 700, color: "#dce5f2" }}>Notes</div>
                {props.logisticsPlan.notes.map(note => (
                  <div key={note}>- {note}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#c8d0de" }}>
            Lance au moins un tick pour voir quel mode de transport, quel groupe et quel cout la faction retient pour son objectif principal.
          </div>
        )}
      </div>
    </div>
  );
}
