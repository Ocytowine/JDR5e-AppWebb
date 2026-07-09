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

interface BlockUxNoticeV1 {
  kind: "clarification-no-commit" | "possibility-no-commit" | "context-no-commit" | "bounded-speech-commit" | "generic-no-commit";
  title: string;
  text: string;
}

function blockTextMatches(block: DisplayBlockV1, pattern: RegExp): boolean {
  return pattern.test(block.text);
}

function blockSourceMatches(block: DisplayBlockV1, pattern: RegExp): boolean {
  return block.sourceRefs.some(ref => pattern.test(ref));
}

function isNoCommitBlock(block: DisplayBlockV1): boolean {
  return (
    block.kind === "CLARIFICATION" ||
    blockTextMatches(block, /sans commit|aucune action|aucun résultat|no commit/iu) ||
    blockSourceMatches(block, /no-commit/iu)
  );
}

function isNoTimeBlock(block: DisplayBlockV1): boolean {
  return block.kind === "CLARIFICATION" || blockTextMatches(block, /ne fait pas avancer le temps|aucun temps|no game time/iu);
}

function isPossibilityBlock(block: DisplayBlockV1): boolean {
  return (
    block.kind === "SYSTEM_NOTICE" &&
    (blockSourceMatches(block, /intent:possibility_query|:possibility\b|:social-possibility\b/iu) ||
      blockTextMatches(block, /question de possibilit|possibilit[ée] trait[ée]e/iu))
  );
}

function isContextNoCommitBlock(block: DisplayBlockV1): boolean {
  return (
    block.kind === "SYSTEM_NOTICE" &&
    (blockSourceMatches(block, /intent:meta_question/iu) ||
      blockTextMatches(block, /r[eé]ponse de contexte|question m[eé]ta/iu))
  );
}

function isBoundedSpeechCommitBlock(block: DisplayBlockV1): boolean {
  return (
    block.kind === "SYSTEM_NOTICE" &&
    (blockTextMatches(block, /parole enregistr|commit metier born|commit métier born|aucun effet social/iu) ||
      blockSourceMatches(block, /speech/iu))
  );
}

function blockUxBadges(block: DisplayBlockV1): string[] {
  const badges: string[] = [];
  if (block.kind === "RAW_INPUT") badges.push("Joueur brut");
  if (block.kind === "PLAYER_EXPRESSION") badges.push("Expression validée");
  if (block.kind === "GM_NARRATION") badges.push("MJ");
  if (block.kind === "NPC_SPEECH") badges.push("PNJ");
  if (block.kind === "CLARIFICATION") badges.push("Clarification");
  if (isPossibilityBlock(block)) badges.push("Possibilité");
  if (isContextNoCommitBlock(block)) badges.push("Contexte");
  if (isBoundedSpeechCommitBlock(block)) badges.push("Parole enregistrée");
  if (isNoCommitBlock(block) && !isContextNoCommitBlock(block)) badges.push("Action non exécutée");
  if (block.kind === "SYSTEM_NOTICE") badges.push("Système");
  if (block.kind === "CLARIFICATION" || /sans commit|aucune action|aucun résultat|no commit/iu.test(block.text)) {
    badges.push("Sans commit");
  }
  if (block.kind === "CLARIFICATION" || /ne fait pas avancer le temps|aucun temps|no game time/iu.test(block.text)) {
    badges.push("Aucun temps");
  }
  if (block.sourceRefs.some(ref => ref.startsWith("ai-output:"))) badges.push("IA");
  if (block.isDegradedFallback) badges.push("Fallback");
  return [...new Set(badges)];
}

function blockUxNotice(block: DisplayBlockV1): BlockUxNoticeV1 | null {
  if (block.kind === "CLARIFICATION") {
    return {
      kind: "clarification-no-commit",
      title: "Clarification - aucune action exécutée",
      text: "Réponds à la question pour confirmer ton intention. La scène et le temps restent suspendus."
    };
  }

  if (isBoundedSpeechCommitBlock(block)) {
    return {
      kind: "bounded-speech-commit",
      title: "Parole enregistrée - effet borné",
      text: "La parole est journalisée, sans succès social automatique ni effet mécanique supplémentaire."
    };
  }

  if (isPossibilityBlock(block)) {
    return {
      kind: "possibility-no-commit",
      title: "Possibilité - aucune action exécutée",
      text: "Le système répond à une question ou à une possibilité sans modifier la scène."
    };
  }

  if (isContextNoCommitBlock(block)) {
    return {
      kind: "context-no-commit",
      title: "Contexte - aucun temps déclenché",
      text: "Le système répond à une question de contexte sans action du personnage ni commit métier."
    };
  }

  if (block.kind === "SYSTEM_NOTICE" && isNoCommitBlock(block)) {
    return {
      kind: "generic-no-commit",
      title: "Sans commit - aucune action exécutée",
      text: "La notification ne déclenche ni commit métier, ni avance du temps de jeu."
    };
  }

  return null;
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
  const uxBadges = blockUxBadges(block);
  const uxNotice = blockUxNotice(block);

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
      <div
        aria-label={`Indicateurs UX: ${uxBadges.join(", ")}`}
        style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}
      >
        {uxBadges.map(badge => (
          <span
            key={badge}
            data-narrative-ux-badge={badge}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              padding: "1px 6px",
              fontSize: 10,
              color: "rgba(255,255,255,0.70)",
              background: "rgba(255,255,255,0.06)"
            }}
          >
            {badge}
          </span>
        ))}
      </div>
      {uxNotice && (
        <div
          aria-label={`${uxNotice.title}. ${uxNotice.text}`}
          data-narrative-ux-notice={uxNotice.kind}
          style={{
            borderRadius: 9,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.16)",
            padding: "6px 8px",
            marginBottom: 6
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.82)" }}>{uxNotice.title}</div>
          <div style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.66)", lineHeight: 1.35 }}>
            {uxNotice.text}
          </div>
        </div>
      )}
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{block.text}</p>
      {block.isDegradedFallback && (
        <div style={{ marginTop: 5, fontSize: 11, color: "rgba(255,255,255,0.58)" }}>
          Rendu de secours
        </div>
      )}
    </article>
  );
}
