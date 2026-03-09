import React, { useMemo, useState } from "react";

async function copyTextToClipboard(text: string): Promise<boolean> {
  const normalized = String(text ?? "");
  if (!normalized.trim()) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(normalized);
      return true;
    } catch {
      // Fallback handled below.
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = normalized;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export type NarrationSetupPanelProps = {
  narrationContext: string;
  narrationGoal: string;
  narrationConstraints: string;
  narrationIntentType: string;
  narrationPlayerInput: string;
  narrationProcessing: boolean;
  narrationCanRun: boolean;
  narrationRuntimeError: string | null;
  narrationRuntimeOutputText: string;
  narrationRuntimeDebug: string;
  narrationLoopEnabled: boolean;
  narrationLoopHistoryJson: string;
  narrationLoopClipboardStatus: string | null;
  onChangeNarrationContext: (value: string) => void;
  onChangeNarrationGoal: (value: string) => void;
  onChangeNarrationConstraints: (value: string) => void;
  onChangeNarrationIntentType: (value: string) => void;
  onChangeNarrationPlayerInput: (value: string) => void;
  onRunNarrationTurn: () => void;
  onToggleNarrationLoopEnabled: (enabled: boolean) => void;
  onApplyNarrationLoopStep: () => void;
  onCopyNarrationLoopHistory: () => void;
  onResetNarrationLoopHistory: () => void;
};

const CONTEXT_PRESETS: Array<{ id: string; label: string; value: string }> = [
  {
    id: "archives_de_lysenthe",
    label: "Archives [DB: archives_de_lysenthe]",
    value:
      "[location_id: archives_de_lysenthe] Archives de Lysenthe, acces prive et controle. Les clercs trient des chartes pendant que des gardes surveillent les salles sensibles."
  },
  {
    id: "quartier_des_archives",
    label: "Quartier archives [DB: quartier_des_archives]",
    value:
      "[location_id: quartier_des_archives] Quartier des Archives a Lysenthe. Place active, flux de clercs, negociants et messagers entre temples, registres et administrations."
  },
  {
    id: "port_des_xantars",
    label: "Port [DB: port_des_xantars]",
    value:
      "[location_id: port_des_xantars] Port des Xantars, facade maritime de Lysenthe. Docks bruyants, controle des cargaisons et circulation dense de marins et courtiers."
  },
  {
    id: "halles_des_commerces",
    label: "Halles [DB: halles_des_commerces]",
    value:
      "[location_id: halles_des_commerces] Halles des Commerces de Lysenthe. Galeries, entrepots, comptoirs et negociations continues, ideal pour trouver infos et contacts."
  },
  {
    id: "caserne_centrale",
    label: "Caserne [DB: caserne_centrale]",
    value:
      "[location_id: caserne_centrale] Caserne centrale de Lysenthe. Discipline stricte, patrouilles frequentes et officiers attentifs aux incidents urbains."
  }
];

const GOAL_PRESETS: Array<{ id: string; label: string; value: string }> = [
  {
    id: "find_witness",
    label: "Trouver un temoin",
    value: "Identifier un temoin fiable qui a vu un element cle du vol."
  },
  {
    id: "open_investigation",
    label: "Ouvrir l'enquete",
    value: "Lancer une piste d'enquete exploitable sans forcer une solution unique."
  },
  {
    id: "confirm_lead",
    label: "Confirmer une piste",
    value: "Verifier une rumeur precise pour confirmer ou invalider une piste."
  }
];

const CONSTRAINT_PRESETS: Array<{ id: string; label: string; value: string }> = [
  {
    id: "sober_realist",
    label: "Sobre / realiste",
    value: "Ton sobre, coherent, pas de revelation majeure sans preuve."
  },
  {
    id: "slow_reveal",
    label: "Revelation progressive",
    value: "Informations fragmentees, indices progressifs, pas de raccourci narratif."
  },
  {
    id: "no_combat_escalation",
    label: "Sans escalation combat",
    value: "Eviter l'escalade violente immediate, favoriser enquete et social."
  }
];

export function NarrationSetupPanel(props: NarrationSetupPanelProps): React.JSX.Element {
  const [selectedPacketKey, setSelectedPacketKey] = useState<
    "step_1_app_to_runtime_request" | "step_2_runtime_received_packet" | "step_3_runtime_to_llm_request" | "step_4_app_final_response"
  >("step_1_app_to_runtime_request");
  const [debugClipboardStatus, setDebugClipboardStatus] = useState<string | null>(null);

  const parsedDebug = useMemo(() => {
    if (!props.narrationRuntimeDebug.trim()) return null;
    try {
      return JSON.parse(props.narrationRuntimeDebug) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [props.narrationRuntimeDebug]);

  const packet = parsedDebug
    ? (parsedDebug[selectedPacketKey] as Record<string, unknown> | null | undefined)
    : null;
  const packetJson = packet ? JSON.stringify(packet, null, 2) : "Aucun paquet disponible pour cette etape.";
  const allStepsJson = parsedDebug
    ? JSON.stringify(
        {
          step_1_app_to_runtime_request:
            parsedDebug.step_1_app_to_runtime_request ?? null,
          step_2_runtime_received_packet:
            parsedDebug.step_2_runtime_received_packet ?? null,
          step_3_runtime_to_llm_request:
            parsedDebug.step_3_runtime_to_llm_request ?? null,
          step_4_app_final_response:
            parsedDebug.step_4_app_final_response ?? null
        },
        null,
        2
      )
    : "";
  const step4Response = parsedDebug?.step_4_app_final_response as Record<string, unknown> | null | undefined;
  const step3Request = parsedDebug?.step_3_runtime_to_llm_request as Record<string, unknown> | null | undefined;
  const aiHandoff = step3Request?.ai_handoff as Record<string, unknown> | null | undefined;
  const runtimeResult = aiHandoff?.runtime_result as Record<string, unknown> | null | undefined;
  const proposalDecisions =
    (step4Response?.proposal_update_decisions as unknown[] | undefined) ??
    (step4Response?.profile_update_decisions as unknown[] | undefined) ??
    [];
  const runtimeAppliedUpdates =
    (runtimeResult?.entity_profile_updates as unknown[] | undefined) ?? [];
  const proposalDecisionsJson = proposalDecisions.length
    ? JSON.stringify(proposalDecisions, null, 2)
    : "Aucune decision de proposition disponible pour l'etape 4.";
  const runtimeAppliedUpdatesJson = runtimeAppliedUpdates.length
    ? JSON.stringify(runtimeAppliedUpdates, null, 2)
    : "Aucune mise a jour runtime appliquee sur le tour courant.";

  const handleDebugCopy = (text: string, successLabel: string) => {
    void (async () => {
      const copied = await copyTextToClipboard(text);
      setDebugClipboardStatus(copied ? successLabel : "Echec de copie du debug.");
      window.setTimeout(() => {
        setDebugClipboardStatus(current =>
          current === successLabel || current === "Echec de copie du debug."
            ? null
            : current
        );
      }, 2500);
    })();
  };

  return (
    <>
      <p style={{ margin: 0, fontSize: 12, color: "#c9cfdd", lineHeight: 1.4 }}>
        Module narration au meme niveau que la creation personnage et la generation de carte.
        Cette configuration sera utilisee ensuite comme base du moteur narratif.
      </p>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          fontSize: 12,
          color: "#d8e4ff"
        }}
      >
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={props.narrationLoopEnabled}
            onChange={e => props.onToggleNarrationLoopEnabled(e.target.checked)}
          />
          Boucle narrative (auto)
        </label>
        <button
          type="button"
          onClick={props.onApplyNarrationLoopStep}
          disabled={!parsedDebug}
          style={{
            padding: "5px 8px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(79,125,242,0.2)",
            color: "#e7ecff",
            fontSize: 11,
            cursor: parsedDebug ? "pointer" : "default"
          }}
        >
          Appliquer etape 4 - etape 1
        </button>
        <button
          type="button"
          onClick={props.onCopyNarrationLoopHistory}
          disabled={!props.narrationLoopHistoryJson.trim()}
          style={{
            padding: "5px 8px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(120,180,120,0.2)",
            color: "#e7ecff",
            fontSize: 11,
            cursor: props.narrationLoopHistoryJson.trim() ? "pointer" : "default"
          }}
        >
          Copier memoire boucle
        </button>
        <button
          type="button"
          onClick={props.onResetNarrationLoopHistory}
          disabled={!props.narrationLoopHistoryJson.trim()}
          style={{
            padding: "5px 8px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(180,120,120,0.2)",
            color: "#e7ecff",
            fontSize: 11,
            cursor: props.narrationLoopHistoryJson.trim() ? "pointer" : "default"
          }}
        >
          Reset memoire boucle
        </button>
      </div>
      {props.narrationLoopHistoryJson.trim() && (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "#9fb0c9",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)"
          }}
        >
          Memoire boucle disponible. Le JSON contient chaque tour avec `player_input` et le pipeline complet des 4 etapes.
        </div>
      )}
      {props.narrationLoopClipboardStatus && (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: props.narrationLoopClipboardStatus.includes("Echec") ? "#ffb0b0" : "#b9efc0",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)"
          }}
        >
          {props.narrationLoopClipboardStatus}
        </div>
      )}
      {debugClipboardStatus && (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: debugClipboardStatus.includes("Echec") ? "#ffb0b0" : "#b9efc0",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)"
          }}
        >
          {debugClipboardStatus}
        </div>
      )}

      <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
        Contexte narratif initial :
        <select
          value=""
          onChange={e => props.onChangeNarrationContext(e.target.value)}
          disabled={props.narrationLoopEnabled}
          style={{
            background: "#0f0f19",
            color: "#f5f5f5",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 12
          }}
        >
          <option value="">-- presets contexte (optionnel) --</option>
          {CONTEXT_PRESETS.map(preset => (
            <option key={preset.id} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        <textarea
          value={props.narrationContext}
          onChange={e => props.onChangeNarrationContext(e.target.value)}
          disabled={props.narrationLoopEnabled}
          placeholder="Ex: Port de Lysenthe, fin d'apres-midi. Les archives sont fermees et des gardes filtrent l'entree."
          rows={4}
          style={{
            resize: "vertical",
            minHeight: 84,
            background: "#0f0f19",
            color: "#f5f5f5",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.35
          }}
        />
      </label>

      <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
        Objectif narratif (court terme) :
        <select
          value=""
          onChange={e => props.onChangeNarrationGoal(e.target.value)}
          disabled={props.narrationLoopEnabled}
          style={{
            background: "#0f0f19",
            color: "#f5f5f5",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 12
          }}
        >
          <option value="">-- presets objectif (optionnel) --</option>
          {GOAL_PRESETS.map(preset => (
            <option key={preset.id} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        <textarea
          value={props.narrationGoal}
          onChange={e => props.onChangeNarrationGoal(e.target.value)}
          disabled={props.narrationLoopEnabled}
          placeholder="Ex: Ouvrir une enquete autour du vol de document sans forcer un chemin unique."
          rows={3}
          style={{
            resize: "vertical",
            minHeight: 66,
            background: "#0f0f19",
            color: "#f5f5f5",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.35
          }}
        />
      </label>

      <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
        Contraintes (ton, style, revelation) :
        <select
          value=""
          onChange={e => props.onChangeNarrationConstraints(e.target.value)}
          disabled={props.narrationLoopEnabled}
          style={{
            background: "#0f0f19",
            color: "#f5f5f5",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 12
          }}
        >
          <option value="">-- presets contraintes (optionnel) --</option>
          {CONSTRAINT_PRESETS.map(preset => (
            <option key={preset.id} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
        <textarea
          value={props.narrationConstraints}
          onChange={e => props.onChangeNarrationConstraints(e.target.value)}
          disabled={props.narrationLoopEnabled}
          placeholder="Ex: Ton sobre, revelations progressives, coherence stricte avec la verite systeme."
          rows={3}
          style={{
            resize: "vertical",
            minHeight: 66,
            background: "#0f0f19",
            color: "#f5f5f5",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.35
          }}
        />
      </label>

      <div
        style={{
          marginTop: 4,
          fontSize: 11,
          color: "#9fb0c9",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)"
        }}
      >
        Etat actuel: module configure dans l'UI. Le moteur narration pilotera ensuite les
        modules personnage et carte.
      </div>

      <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
        Intent override (debug optionnel, l'etape 2 vient normalement de l'IA) :
        <select
          value={props.narrationIntentType}
          onChange={e => props.onChangeNarrationIntentType(e.target.value)}
          style={{
            background: "#0f0f19",
            color: "#f5f5f5",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 12
          }}
        >
          <option value="">-- aucun override, laisser l'IA classifier --</option>
          <option value="observe">observe</option>
          <option value="talk">talk</option>
          <option value="move_local">move_local</option>
          <option value="ask_info">ask_info</option>
          <option value="attempt_forbidden">attempt_forbidden</option>
          <option value="meta_unclear">meta_unclear</option>
        </select>
      </label>

      <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
        Input joueur (test d'un tour) :
        <textarea
          value={props.narrationPlayerInput}
          onChange={e => props.onChangeNarrationPlayerInput(e.target.value)}
          placeholder="Ex: Je monte vers les archives et j'observe les gardes."
          rows={3}
          style={{
            resize: "vertical",
            minHeight: 64,
            background: "#0f0f19",
            color: "#f5f5f5",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.35
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={props.onRunNarrationTurn}
          disabled={props.narrationProcessing || !props.narrationCanRun}
          style={{
            marginTop: 2,
            padding: "7px 12px",
            background: props.narrationProcessing || !props.narrationCanRun ? "#5e6b85" : "#4f7df2",
            color: "#f5f7ff",
            border: "none",
            borderRadius: 6,
            cursor: props.narrationProcessing || !props.narrationCanRun ? "default" : "pointer",
            fontWeight: 700,
            fontSize: 12
          }}
        >
          {props.narrationProcessing
            ? "Traitement..."
            : props.narrationCanRun
            ? "Traiter 1 tour"
            : "Cle OpenAI requise"}
        </button>
        {props.narrationRuntimeError && (
          <span style={{ fontSize: 12, color: "#ff9f9f" }}>
            Erreur: {props.narrationRuntimeError}
          </span>
        )}
      </div>

      {props.narrationRuntimeOutputText && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "#dce7ff",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid rgba(79,125,242,0.4)",
            background: "rgba(79,125,242,0.1)"
          }}
        >
          <strong>Sortie narration finale (IA aval):</strong> {props.narrationRuntimeOutputText}
        </div>
      )}

      {props.narrationRuntimeDebug && (
        <div
          style={{
            marginTop: 6,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            background: "rgba(255,255,255,0.03)",
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#d8e4ff" }}>
            Inspection pipeline (4 etapes)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setSelectedPacketKey("step_1_app_to_runtime_request")}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border:
                  selectedPacketKey === "step_1_app_to_runtime_request"
                    ? "1px solid #4f7df2"
                    : "1px solid rgba(255,255,255,0.15)",
                background:
                  selectedPacketKey === "step_1_app_to_runtime_request"
                    ? "rgba(79,125,242,0.2)"
                    : "rgba(12,12,18,0.6)",
                color: "#e7ecff",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              Etape 1: Envoi app
            </button>
            <button
              type="button"
              onClick={() => setSelectedPacketKey("step_2_runtime_received_packet")}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border:
                  selectedPacketKey === "step_2_runtime_received_packet"
                    ? "1px solid #4f7df2"
                    : "1px solid rgba(255,255,255,0.15)",
                background:
                  selectedPacketKey === "step_2_runtime_received_packet"
                    ? "rgba(79,125,242,0.2)"
                    : "rgba(12,12,18,0.6)",
                color: "#e7ecff",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              Etape 2: Paquet recu
            </button>
            <button
              type="button"
              onClick={() => setSelectedPacketKey("step_3_runtime_to_llm_request")}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border:
                  selectedPacketKey === "step_3_runtime_to_llm_request"
                    ? "1px solid #4f7df2"
                    : "1px solid rgba(255,255,255,0.15)",
                background:
                  selectedPacketKey === "step_3_runtime_to_llm_request"
                    ? "rgba(79,125,242,0.2)"
                    : "rgba(12,12,18,0.6)",
                color: "#e7ecff",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              Etape 3: Runtime - IA
            </button>
            <button
              type="button"
              onClick={() => setSelectedPacketKey("step_4_app_final_response")}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border:
                  selectedPacketKey === "step_4_app_final_response"
                    ? "1px solid #4f7df2"
                    : "1px solid rgba(255,255,255,0.15)",
                background:
                  selectedPacketKey === "step_4_app_final_response"
                    ? "rgba(79,125,242,0.2)"
                    : "rgba(12,12,18,0.6)",
                color: "#e7ecff",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              Etape 4: Recu app
            </button>
            <button
              type="button"
              onClick={() => {
                if (!allStepsJson) return;
                handleDebugCopy(allStepsJson, "Les 4 etapes ont ete copiees.");
              }}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(120,180,120,0.2)",
                color: "#e7ecff",
                fontSize: 11,
                cursor: allStepsJson ? "pointer" : "default"
              }}
              disabled={!allStepsJson}
            >
              Copier les 4 etapes
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 8
            }}
          >
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                background: "rgba(6,8,14,0.75)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 11,
                  color: "#d8e4ff",
                  fontWeight: 700
                }}
              >
                Decision proposition etape 4
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: "8px 10px",
                  whiteSpace: "pre-wrap",
                  maxHeight: 180,
                  overflow: "auto",
                  fontSize: 11,
                  lineHeight: 1.35,
                  color: "#cdd8f3"
                }}
              >
                {proposalDecisionsJson}
              </pre>
            </div>
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                background: "rgba(6,8,14,0.75)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 11,
                  color: "#d8e4ff",
                  fontWeight: 700
                }}
              >
                Mise a jour runtime appliquee tour suivant
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: "8px 10px",
                  whiteSpace: "pre-wrap",
                  maxHeight: 180,
                  overflow: "auto",
                  fontSize: 11,
                  lineHeight: 1.35,
                  color: "#cdd8f3"
                }}
              >
                {runtimeAppliedUpdatesJson}
              </pre>
            </div>
          </div>
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              background: "rgba(6,8,14,0.75)",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 8px",
                borderBottom: "1px solid rgba(255,255,255,0.1)"
              }}
            >
              <span style={{ fontSize: 11, color: "#d8e4ff" }}>{selectedPacketKey}</span>
              <button
                type="button"
                onClick={() => {
                  handleDebugCopy(packetJson, "Le paquet courant a ete copie.");
                }}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(79,125,242,0.2)",
                  color: "#e7ecff",
                  fontSize: 11,
                  cursor: "pointer"
                }}
              >
                Copier
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: "8px 10px",
                whiteSpace: "pre-wrap",
                maxHeight: 300,
                overflow: "auto",
                fontSize: 11,
                lineHeight: 1.35,
                color: "#cdd8f3"
              }}
            >
              {packetJson}
            </pre>
          </div>
          {!parsedDebug && (
            <div style={{ fontSize: 11, color: "#ffb3b3" }}>
              Debug JSON non lisible. Ouvre d'abord un tour narration reussi.
            </div>
          )}
        </div>
      )}
    </>
  );
}
