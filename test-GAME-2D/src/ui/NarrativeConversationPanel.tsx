import { FormEvent, useMemo, useState } from "react";
import type {
  DisplayBlockV1,
  DisplayPacketV1,
  RenderBlockKindV1
} from "../../narration-module/src/scene";

export interface NarrativeSubmitPayloadV1 {
  schemaVersion: 1;
  clientRequestId: string;
  rawInput: string;
}

export interface NarrativeConversationPanelProps {
  packets: DisplayPacketV1[];
  pending?: boolean;
  title?: string;
  onSubmit?: (payload: NarrativeSubmitPayloadV1) => void;
}

const KIND_LABELS: Record<RenderBlockKindV1, string> = {
  RAW_INPUT: "Entrée originale",
  PLAYER_EXPRESSION: "Expression du personnage",
  GM_NARRATION: "Narration",
  NPC_SPEECH: "Réplique PNJ",
  SYSTEM_NOTICE: "Notification",
  CLARIFICATION: "Clarification"
};

export function createNarrativeClientRequestId(prefix = "nar-ui"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function flattenBlocks(packets: DisplayPacketV1[]): DisplayBlockV1[] {
  return packets.flatMap(packet => packet.displayBlocks);
}

function blockTone(kind: RenderBlockKindV1): string {
  if (kind === "PLAYER_EXPRESSION") return "player";
  if (kind === "NPC_SPEECH") return "npc";
  if (kind === "SYSTEM_NOTICE") return "system";
  if (kind === "CLARIFICATION") return "clarification";
  if (kind === "RAW_INPUT") return "raw";
  return "gm";
}

export function NarrativeConversationPanel(props: NarrativeConversationPanelProps) {
  const { packets, pending = false, title = "Narration", onSubmit } = props;
  const [draft, setDraft] = useState("");
  const blocks = useMemo(() => flattenBlocks(packets), [packets]);
  const canSubmit = draft.trim().length > 0 && !pending && typeof onSubmit === "function";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rawInput = draft.trim();
    if (!rawInput || pending || !onSubmit) return;
    onSubmit({
      schemaVersion: 1,
      clientRequestId: createNarrativeClientRequestId(),
      rawInput
    });
    setDraft("");
  }

  return (
    <section
      aria-label={title}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        minHeight: 280,
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(8,10,18,0.94)",
        color: "rgba(255,255,255,0.92)",
        boxShadow: "0 18px 60px rgba(0,0,0,0.45)"
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, letterSpacing: 0.4 }}>{title}</h2>
        {pending && (
          <span aria-live="polite" style={{ fontSize: 11, color: "rgba(255,255,255,0.72)" }}>
            Traitement en cours
          </span>
        )}
      </header>

      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingRight: 2
        }}
      >
        {blocks.length === 0 ? (
          <p style={{ margin: 0, color: "rgba(255,255,255,0.62)", fontSize: 13 }}>
            Aucun échange narratif affichable.
          </p>
        ) : (
          blocks.map(block => <NarrativeDisplayBlock key={block.blockId} block={block} />)
        )}
      </div>

      <form onSubmit={handleSubmit} aria-label="Saisie narrative libre" style={{ display: "flex", gap: 8 }}>
        <label htmlFor="narrative-free-input" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
          Entrée libre du joueur
        </label>
        <textarea
          id="narrative-free-input"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          disabled={pending}
          rows={2}
          placeholder="Décris librement ce que tu fais, dis ou demandes au MJ..."
          style={{
            flex: 1,
            minHeight: 48,
            resize: "vertical",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
            padding: "8px 10px",
            fontSize: 13
          }}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            minWidth: 78,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: canSubmit ? "rgba(88,166,255,0.28)" : "rgba(255,255,255,0.07)",
            color: canSubmit ? "#fff" : "rgba(255,255,255,0.48)",
            fontWeight: 800,
            cursor: canSubmit ? "pointer" : "not-allowed"
          }}
        >
          Envoyer
        </button>
      </form>
    </section>
  );
}

function NarrativeDisplayBlock({ block }: { block: DisplayBlockV1 }) {
  const tone = blockTone(block.kind);
  const kindLabel = KIND_LABELS[block.kind];

  return (
    <article
      aria-label={block.ariaLabel}
      data-narrative-block-kind={block.kind}
      data-narrative-speaker-kind={block.speaker.kind}
      data-narrative-tone={tone}
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background:
          tone === "player"
            ? "rgba(88,166,255,0.12)"
            : tone === "npc"
              ? "rgba(255,197,92,0.10)"
              : tone === "system"
                ? "rgba(255,255,255,0.08)"
                : tone === "clarification"
                  ? "rgba(187,128,255,0.12)"
                  : "rgba(255,255,255,0.05)",
        padding: "8px 10px"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 800 }}>
          {block.speaker.displayName}
          <span style={{ color: "rgba(255,255,255,0.62)", fontWeight: 600 }}> — {block.roleLabel}</span>
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.62)" }}>{kindLabel}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{block.text}</p>
      {block.isDegradedFallback && (
        <div style={{ marginTop: 5, fontSize: 11, color: "rgba(255,255,255,0.58)" }}>
          Rendu de secours
        </div>
      )}
    </article>
  );
}
