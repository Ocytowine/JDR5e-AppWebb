import React from "react";

export type NarrationSetupPanelProps = {
  narrationContext: string;
  narrationPlayerInput: string;
  narrationProcessing: boolean;
  narrationRuntimeError: string | null;
  narrationRuntimeOutputText: string;
  onChangeNarrationContext: (value: string) => void;
  onChangeNarrationPlayerInput: (value: string) => void;
  onRunNarrationTurn: () => void;
};

export function NarrationSetupPanel(props: NarrationSetupPanelProps): React.JSX.Element {
  const canSubmit = !props.narrationProcessing && props.narrationPlayerInput.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: "#c9cfdd", lineHeight: 1.4 }}>
        Interface narration minimale. On garde seulement un contexte de depart optionnel et
        l'intention du joueur.
      </p>

      <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
        Contexte de depart :
        <textarea
          value={props.narrationContext}
          onChange={e => props.onChangeNarrationContext(e.target.value)}
          placeholder="Optionnel. Exemple: [location_id: archives_de_lysenthe]"
          rows={4}
          style={{
            resize: "vertical",
            minHeight: 96,
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
        Intention du joueur :
        <textarea
          value={props.narrationPlayerInput}
          onChange={e => props.onChangeNarrationPlayerInput(e.target.value)}
          placeholder="Exemple: Je vais vers les archives et je demande qui garde l'entree."
          rows={4}
          style={{
            resize: "vertical",
            minHeight: 96,
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
          disabled={!canSubmit}
          style={{
            padding: "7px 12px",
            background: canSubmit ? "#4f7df2" : "#5e6b85",
            color: "#f5f7ff",
            border: "none",
            borderRadius: 6,
            cursor: canSubmit ? "pointer" : "default",
            fontWeight: 700,
            fontSize: 12
          }}
        >
          {props.narrationProcessing ? "Traitement..." : "Lancer"}
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
            fontSize: 12,
            color: "#dce7ff",
            padding: "10px 12px",
            borderRadius: 6,
            border: "1px solid rgba(79,125,242,0.4)",
            background: "rgba(79,125,242,0.1)",
            lineHeight: 1.45
          }}
        >
          {props.narrationRuntimeOutputText}
        </div>
      )}
    </div>
  );
}
