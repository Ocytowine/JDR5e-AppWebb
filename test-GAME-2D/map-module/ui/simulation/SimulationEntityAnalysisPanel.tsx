import React, { useMemo } from "react";
import { summarizeLocalSituation, type ActionCandidateTrace, type EntityRef, type PressureEvaluationTrace, type TickOutput, type WorldEvent, type WorldHistoryEntry, type WorldState } from "../../world-simulation";
import { createEditorButtonStyle, editorSurfaceStyles, editorTextStyles } from "../editor/editorTheme";
import { formatRejectionReason, formatScaleStep } from "./timeFormatting";

const PRESSURE_LABELS: Record<string, string> = {
  criminal: "Criminelle",
  social: "Sociale",
  commercial: "Commerciale",
  military: "Militaire",
  religious: "Religieuse",
  political: "Politique"
};

function formatEntityRef(ref: EntityRef | undefined): string {
  if (!ref) return "n/a";
  return `${ref.kind}:${ref.id}`;
}

function formatNumber(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatActionCause(candidate: ActionCandidateTrace): string {
  if (!candidate.actionCause) return "cause non detaillee";
  return candidate.actionCause.detail ? `${candidate.actionCause.label} - ${candidate.actionCause.detail}` : candidate.actionCause.label;
}

export function SimulationEntityAnalysisPanel(props: {
  selectedEntity: { key: string; label: string; ref: EntityRef } | null;
  pressureEvaluations: PressureEvaluationTrace[];
  actionCandidates: ActionCandidateTrace[];
  events: WorldEvent[];
  history: WorldHistoryEntry[];
  latestOutput: TickOutput | null;
  state: WorldState;
}): React.JSX.Element {
  const dominantPressures = useMemo(
    () =>
      [...props.pressureEvaluations]
        .sort((left, right) => right.clampedValue - left.clampedValue)
        .slice(0, 3),
    [props.pressureEvaluations]
  );

  const topActions = useMemo(
    () =>
      props.actionCandidates
        .filter(candidate => candidate.passed)
        .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
        .slice(0, 5),
    [props.actionCandidates]
  );

  const blockedActions = useMemo(
    () => props.actionCandidates.filter(candidate => !candidate.passed).slice(0, 5),
    [props.actionCandidates]
  );

  const situation = useMemo(
    () => (props.selectedEntity ? summarizeLocalSituation(props.state, [props.selectedEntity.ref]) : null),
    [props.selectedEntity, props.state]
  );

  if (!props.selectedEntity) {
    return (
      <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>
        Selectionne une case, une faction ou un objectif pour lire son importance locale, ses pressions et les actions qui le concernent.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Ce que c'est</div>
        <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
          <div>Entite: {props.selectedEntity.label}</div>
          <div>Reference technique: {formatEntityRef(props.selectedEntity.ref)}</div>
          <div>Evenements lies au dernier cycle horaire: {props.events.length}</div>
          <div>Historique recent: {props.history.length} entree(s)</div>
          <div>Actions envisagees: {props.actionCandidates.length}</div>
        </div>
      </div>

      {situation ? (
        <div style={{ ...editorSurfaceStyles.subsection, gap: 6, border: "1px solid rgba(143,179,255,0.28)", background: "rgba(143,179,255,0.08)" }}>
          <div style={editorTextStyles.sectionTitle}>Situation</div>
          <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
            <div style={{ fontWeight: 700, color: "#eef3ff" }}>{situation.headline}</div>
            <div>Risque: {situation.riskLabel} · tendance {situation.trend}</div>
            <div>Factions impliquees: {situation.involvedFactionLabels.length ? situation.involvedFactionLabels.join(", ") : "aucune"}</div>
            <div>Mobiles concernes: {situation.involvedMobileLabels.length ? situation.involvedMobileLabels.join(", ") : "aucun"}</div>
            <div>Suite probable: {situation.nextLikelyDevelopments.length ? situation.nextLikelyDevelopments.join(" | ") : "stabilite locale"}</div>
            {situation.recentFact ? <div>Dernier fait: tick {situation.recentFact.tick} - {situation.recentFact.summary}</div> : null}
          </div>
        </div>
      ) : null}

      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Ce qui pese dessus</div>
        {dominantPressures.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {dominantPressures.map(pressure => (
              <div key={`${pressure.definitionId}:${pressure.entityId}`} style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                <div style={{ fontWeight: 700, color: "#eef3ff" }}>
                  {PRESSURE_LABELS[pressure.pressureType] ?? pressure.pressureType} · score {formatNumber(pressure.clampedValue)}
                </div>
                <div style={{ marginTop: 3, color: "#c8d0de" }}>
                  Cause principale: {pressure.terms[0]?.source ?? "non detaillee"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune pression forte calculee sur cette entite sur le dernier cycle horaire.</div>
        )}
      </div>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Ce que les acteurs veulent en faire</div>
        {topActions.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {topActions.map(candidate => (
              <div key={`${candidate.actorRef.id}:${candidate.actionId}:${candidate.targetRef.id}`} style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                <div style={{ fontWeight: 700, color: "#eef3ff" }}>
                  {formatEntityRef(candidate.actorRef)} {"->"} {candidate.actionId}
                </div>
                <div style={{ marginTop: 3, color: "#c8d0de" }}>
                  Cause: {formatActionCause(candidate)}
                </div>
                <div style={{ marginTop: 3 }}>
                  Score {formatNumber(candidate.score)} · objectif {candidate.objectiveId ?? "aucun"} · pression cible {formatNumber(candidate.scoreBreakdown?.targetPressure)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune action prioritaire n'a ete retenue autour de cette entite.</div>
        )}
      </div>

      <details style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <summary style={{ cursor: "pointer", userSelect: "none", ...editorTextStyles.sectionTitle }}>
          Pourquoi certaines actions ont ete bloquees
        </summary>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {blockedActions.length > 0 ? (
            blockedActions.map(candidate => (
              <div key={`${candidate.actorRef.id}:${candidate.actionId}:${candidate.targetRef.id}`} style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                <div style={{ fontWeight: 700, color: "#eef3ff" }}>
                  {formatEntityRef(candidate.actorRef)} {"->"} {candidate.actionId}
                </div>
                <div style={{ marginTop: 3, color: "#c8d0de" }}>
                  {candidate.rejectionReasons.map(formatRejectionReason).join(" | ") || "Preconditions non satisfaites"}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun blocage notable sur les candidats du dernier cycle horaire.</div>
          )}
        </div>
      </details>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Ce qui s'est passe</div>
        {props.events.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {props.events.map(event => (
              <div key={event.id} style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                <div style={{ fontWeight: 700, color: "#eef3ff" }}>{event.type}</div>
                <div style={{ marginTop: 3 }}>
                  {formatEntityRef(event.actor)} {event.target ? <>{ "->" } {formatEntityRef(event.target)}</> : null} · {event.success ? "succes" : "echec"} · deltas {event.deltas.length}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun evenement n'a implique cette entite sur le dernier cycle horaire.</div>
        )}
      </div>

      <details style={{ ...editorSurfaceStyles.subsection, gap: 6 }} open={props.history.length > 0}>
        <summary style={{ cursor: "pointer", userSelect: "none", ...editorTextStyles.sectionTitle }}>
          Memoire recente de l'entite
        </summary>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {props.history.length > 0 ? (
            props.history.slice(0, 8).map((entry, index) => (
              <div key={`${entry.tick}:${entry.type}:${index}`} style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                <div style={{ fontWeight: 700, color: "#eef3ff" }}>
                  tick {entry.tick} - {entry.type}
                </div>
                <div style={{ marginTop: 3, color: "#c8d0de" }}>{entry.summary}</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune memoire persistante n'est encore attachee a cette entite.</div>
          )}
        </div>
      </details>

      {props.latestOutput ? (
        <button type="button" style={createEditorButtonStyle({ compact: true, active: false })}>
          Derniere avancee: {formatScaleStep(props.latestOutput.scale)}
        </button>
      ) : null}
    </div>
  );
}
