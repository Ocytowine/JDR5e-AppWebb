import React, { useMemo } from "react";
import type { WorldMapLayout, WorldMapSimulationFaction, WorldMapSimulationMobileActor, WorldMapSimulationObjective } from "../../data/worldMapLayout";
import type { LogisticsPlanTrace, WorldFaction } from "../../world-simulation";
import type { WikiEntry } from "../mapShared";
import { createEditorButtonStyle, editorSurfaceStyles, editorTextStyles } from "../editor/editorTheme";
import { SimulationLogisticsPanel } from "./SimulationLogisticsPanel";

type FactionPanelFocus = "summary" | "goals" | "mobility";

const RELATION_TONE: Record<string, { label: string; color: string; border: string; background: string }> = {
  ally: {
    label: "Allie",
    color: "#72c58f",
    border: "rgba(114,197,143,0.34)",
    background: "rgba(114,197,143,0.12)"
  },
  neutral: {
    label: "Neutre",
    color: "#c8d0de",
    border: "rgba(200,208,222,0.24)",
    background: "rgba(200,208,222,0.08)"
  },
  rival: {
    label: "Rival",
    color: "#d49a52",
    border: "rgba(212,154,82,0.34)",
    background: "rgba(212,154,82,0.12)"
  },
  war: {
    label: "Ennemi",
    color: "#c85c5c",
    border: "rgba(200,92,92,0.34)",
    background: "rgba(200,92,92,0.12)"
  }
};

function formatList(values: string[]): string {
  return values.length ? values.join(", ") : "aucun";
}

function prettifyTarget(targetId: string | undefined): string {
  if (!targetId) return "cible non definie";
  const leaf = targetId.split(":").pop() ?? targetId;
  return leaf.replace(/_/g, " ");
}

export function SimulationFactionAnalysisPanel(props: {
  layout: WorldMapLayout;
  faction: WorldMapSimulationFaction | null;
  runtimeFaction: WorldFaction | null;
  logisticsPlan: LogisticsPlanTrace | null;
  objectives: WorldMapSimulationObjective[];
  mobileActors: WorldMapSimulationMobileActor[];
  wikiEntriesById: Record<string, WikiEntry>;
  panelFocus: FactionPanelFocus;
  onFocusPanel: (panel: FactionPanelFocus) => void;
  onSelectObjective: (objectiveId: string) => void;
  onSelectMobileActor: (actorId: string) => void;
}): React.JSX.Element {
  const relationDetails = useMemo(() => {
    if (!props.faction) return [];
    const factionMap = new Map((props.layout.simulation?.factions ?? []).map(faction => [faction.id, faction.label]));
    return props.faction.relations.map(relation => ({
      ...relation,
      label: factionMap.get(relation.targetFactionId) ?? relation.targetFactionId
    }));
  }, [props.faction, props.layout.simulation?.factions]);

  const ownedObjectives = useMemo(
    () =>
      props.faction
        ? props.objectives
            .filter(objective => objective.ownerFactionId === props.faction!.id)
            .sort((left, right) => right.priority - left.priority)
        : [],
    [props.faction, props.objectives]
  );
  const primaryObjective = ownedObjectives.find(objective => objective.state === "active") ?? ownedObjectives[0] ?? null;

  const ownedMobiles = useMemo(
    () => (props.faction ? props.mobileActors.filter(actor => actor.ownerFactionId === props.faction!.id) : []),
    [props.faction, props.mobileActors]
  );

  if (!props.faction) {
    return (
      <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>
        Choisis une faction pour afficher une fiche simple: qui elle est, avec qui elle compose, ce qu'elle cherche a faire et ou elle agit.
      </div>
    );
  }

  const faction = props.faction;
  const homeCity = faction.homeCityId ? props.layout.cities.find(city => city.id === faction.homeCityId) ?? null : null;
  const homeRegion = faction.homeRegionId ? props.layout.governanceRegions?.find(region => region.id === faction.homeRegionId) ?? null : null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Qui c'est</div>
        <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
          <div>Nom: {faction.label}</div>
          <div>Type: {faction.type}</div>
          <div>Ancrage: {homeCity ? props.wikiEntriesById[homeCity.wikiEntityId]?.name ?? homeCity.wikiEntityId : faction.homeCityId ?? "aucun"}</div>
          <div>Region de base: {homeRegion ? props.wikiEntriesById[homeRegion.wikiEntityId]?.name ?? homeRegion.wikiEntityId : faction.homeRegionId ?? "aucune"}</div>
          <div>Tags: {formatList(faction.tags ?? [])}</div>
          <div>Cases de presence: {faction.presenceCells.length}</div>
        </div>
      </div>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={editorTextStyles.sectionTitle}>Ce qu'elle veut</div>
          <button type="button" onClick={() => props.onFocusPanel("goals")} style={createEditorButtonStyle({ compact: true, active: props.panelFocus === "goals" })}>
            Voir sur la carte
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
          <div>Agenda: {faction.agenda || "aucun"}</div>
          <div>Methodes: {formatList(faction.methods ?? [])}</div>
          <div>Pistes d'objectifs: {formatList(faction.objectiveHints ?? [])}</div>
          <div>Objectif directeur: {primaryObjective ? `${primaryObjective.label} (priorite ${primaryObjective.priority})` : "aucun"}</div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {ownedObjectives.length > 0 ? (
            ownedObjectives.map(objective => {
              const active = primaryObjective?.id === objective.id;
              return (
                <button
                  key={objective.id}
                  type="button"
                  onClick={() => {
                    props.onFocusPanel("goals");
                    props.onSelectObjective(objective.id);
                  }}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    textAlign: "left",
                    border: active ? "1px solid rgba(244,201,103,0.46)" : "1px solid rgba(255,255,255,0.08)",
                    background: active ? "rgba(244,201,103,0.12)" : "rgba(255,255,255,0.04)",
                    color: "#dce5f2",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? "#f4c967" : "#eef3ff" }}>
                    {objective.label}
                  </div>
                  <div style={{ display: "grid", gap: 3, fontSize: 12, marginTop: 4 }}>
                    <div>Priorite {objective.priority} · Etat {objective.state} · Progression {objective.progress}</div>
                    <div>Cible lue sur la carte: {prettifyTarget(objective.targetId)}</div>
                    <div>Compatibilites: {formatList(objective.compatibleActionIds)}</div>
                  </div>
                </button>
              );
            })
          ) : (
            <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun objectif porte par cette faction.</div>
          )}
        </div>
      </div>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={editorTextStyles.sectionTitle}>Ou elle agit</div>
          <button type="button" onClick={() => props.onFocusPanel("mobility")} style={createEditorButtonStyle({ compact: true, active: props.panelFocus === "mobility" })}>
            Voir sur la carte
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
          <div>Lecture carte: couleur de faction sur les cases + point d'ancrage + liens diplomatiques.</div>
          <div>Acteurs mobiles lies: {ownedMobiles.length}</div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {ownedMobiles.length > 0 ? (
            ownedMobiles.map(actor => (
              <button
                key={actor.id}
                type="button"
                onClick={() => {
                  props.onFocusPanel("mobility");
                  props.onSelectMobileActor(actor.id);
                }}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  textAlign: "left",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#dce5f2",
                  cursor: "pointer"
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{actor.label}</div>
                <div style={{ display: "grid", gap: 3, fontSize: 12, marginTop: 4 }}>
                  <div>Position {actor.positionKind}:{actor.positionId ?? "n/a"}</div>
                  <div>Destination {actor.destinationKind ?? "n/a"}:{actor.destinationId ?? "n/a"}</div>
                  <div>Objectifs lies: {formatList(actor.objectiveIds)}</div>
                </div>
              </button>
            ))
          ) : (
            <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun acteur mobile porte par cette faction.</div>
          )}
        </div>
      </div>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 8 }}>
        <div style={editorTextStyles.sectionTitle}>Avec qui</div>
        <div style={{ display: "grid", gap: 8 }}>
          {relationDetails.length > 0 ? (
            relationDetails.map(relation => {
              const tone = RELATION_TONE[relation.status] ?? RELATION_TONE.neutral;
              return (
                <div
                  key={`${relation.targetFactionId}:${relation.status}`}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: `1px solid ${tone.border}`,
                    background: tone.background,
                    color: "#dce5f2"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{relation.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: tone.color }}>{tone.label}</div>
                  </div>
                  <div style={{ display: "grid", gap: 3, fontSize: 12, marginTop: 4 }}>
                    <div>Confiance {relation.trust} · Hostilite {relation.hostility}</div>
                    <div>{relation.notes || "Pas de note."}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune relation definie.</div>
          )}
        </div>
      </div>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Etat runtime</div>
        <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
          <div>Influence: {Math.round(props.runtimeFaction?.state.influence ?? 0)}</div>
          <div>Puissance: {Math.round(props.runtimeFaction?.state.power ?? 0)}</div>
          <div>Ressources: {Math.round(props.runtimeFaction?.state.resources ?? 0)}</div>
          <div>Cohesion: {Math.round(props.runtimeFaction?.state.cohesion ?? 0)}</div>
          <div>Cooldowns actifs: {props.runtimeFaction ? Object.keys(props.runtimeFaction.cooldowns).length : 0}</div>
        </div>
      </div>

      <SimulationLogisticsPanel runtimeFaction={props.runtimeFaction} logisticsPlan={props.logisticsPlan} />
    </div>
  );
}
