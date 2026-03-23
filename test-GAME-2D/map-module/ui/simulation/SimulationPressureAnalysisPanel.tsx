import React from "react";
import type { PressureEvaluationTrace } from "../../world-simulation";
import { editorSurfaceStyles, editorTextStyles } from "../editor/editorTheme";

const PRESSURE_LABELS: Record<string, string> = {
  criminal: "pression criminelle",
  social: "pression sociale",
  commercial: "pression commerciale",
  military: "pression militaire",
  religious: "pression religieuse",
  political: "pression politique"
};

function formatNumber(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function summarizeEntityLabel(kind: string, id: string): string {
  return `${kind} ${id}`;
}

function buildConsequenceHint(pressureType: string): string {
  switch (pressureType) {
    case "criminal":
      return "Risque de racket, infiltration, contrebande ou violence opportuniste.";
    case "social":
      return "Risque d'agitation locale, mecontentement ou troubles visibles.";
    case "commercial":
      return "Risque de blocage de flux, de penurie ou d'escalade autour des ressources.";
    case "military":
      return "Risque de patrouilles renforcees, affrontements ou verrouillage de routes.";
    case "religious":
      return "Risque de tensions symboliques, rituelles ou d'actions autour des sanctuaires.";
    case "political":
      return "Risque de lutte d'influence, de reprise en main ou de rupture institutionnelle.";
    default:
      return "Cette pression peut faire basculer les decisions d'acteurs sur les prochains ticks.";
  }
}

export function SimulationPressureAnalysisPanel(props: {
  hotspots: Array<{ kind: string; id: string; pressureType: string; value: number }>;
  evaluationsByEntity: Record<string, PressureEvaluationTrace | null>;
}): React.JSX.Element {
  if (props.hotspots.length === 0) {
    return <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune pression notable pour l'instant.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {props.hotspots.map(entry => {
        const evaluation = props.evaluationsByEntity[`${entry.kind}:${entry.id}:${entry.pressureType}`] ?? null;
        const topTerms = evaluation?.terms
          ?.slice()
          .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
          .slice(0, 3) ?? [];
        return (
          <div key={`${entry.kind}:${entry.id}:${entry.pressureType}`} style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
            <div style={editorTextStyles.sectionTitle}>{summarizeEntityLabel(entry.kind, entry.id)}</div>
            <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
              <div>
                Dominante: {PRESSURE_LABELS[entry.pressureType] ?? entry.pressureType} · score {entry.value}
              </div>
              <div>
                Lecture: cette zone commence a attirer des decisions liees a {PRESSURE_LABELS[entry.pressureType] ?? entry.pressureType}.
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>
              {topTerms.length > 0 ? (
                topTerms.map(term => (
                  <div key={`${evaluation?.definitionId}:${term.source}`}>
                    Cause: {term.source} · contribution {formatNumber(term.contribution)}
                  </div>
                ))
              ) : (
                <div>Causes detaillees indisponibles sur ce tick.</div>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#9fb0c6", lineHeight: 1.45 }}>
              Effet probable: {buildConsequenceHint(entry.pressureType)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
