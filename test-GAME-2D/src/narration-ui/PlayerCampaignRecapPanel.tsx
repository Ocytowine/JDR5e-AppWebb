import { useEffect, useState } from "react";
import type { PlayerCampaignRecapV1 } from "../../narration-module/src/application";
import type { Result } from "../../narration-module/src/core";

export function PlayerCampaignRecapPanel(props: {
  readRecap: () => Promise<Result<PlayerCampaignRecapV1>>;
  refreshKey: string;
}) {
  const [recap, setRecap] = useState<PlayerCampaignRecapV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const result = await props.readRecap();
    if (result.ok) {
      setRecap(result.value);
      setError(null);
    } else {
      setError("Le résumé n’est pas disponible pour le moment.");
    }
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, [props.readRecap, props.refreshKey]);

  return (
    <details style={panelStyle}>
      <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 17 }}>
        Reprendre le fil
      </summary>
      {loading && <p style={mutedStyle}>Mise à jour du résumé…</p>}
      {error !== null && <p role="status" style={mutedStyle}>{error}</p>}
      {recap !== null && !loading && (
        <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
          <section>
            <h3 style={headingStyle}>Situation</h3>
            <p style={lineStyle}>{recap.situation.characterLabel} se trouve à {recap.situation.locationLabel}.</p>
            {recap.situation.travel.status === "TRAVELLING" && <p style={lineStyle}>En route vers {recap.situation.travel.destinationLabel}.</p>}
            {recap.situation.travel.status === "INTERRUPTED" && <p style={lineStyle}>Le voyage attend ta décision.</p>}
          </section>

          {recap.knownFacts.length > 0 && <section>
            <h3 style={headingStyle}>Ce que tu sais</h3>
            {recap.knownFacts.map((fact, index) => <p key={`${fact.status}:${index}`} style={lineStyle}>
              <span style={tagStyle}>{knowledgeLabel(fact.status)}</span> {fact.statement}
            </p>)}
          </section>}

          {recap.companions.length > 0 && <section>
            <h3 style={headingStyle}>Compagnons</h3>
            {recap.companions.map(companion => <p key={companion.displayName} style={lineStyle}>
              {companion.displayName} — {companion.membershipStatus === "WITH_PLAYER" ? "à tes côtés" : `séparé, vu pour la dernière fois à ${companion.lastKnownLocation}`}
            </p>)}
          </section>}

          {recap.engagements.length > 0 && <section>
            <h3 style={headingStyle}>Engagements connus</h3>
            {recap.engagements.map((engagement, index) => <p key={`${engagement.summary}:${index}`} style={lineStyle}>
              {engagement.summary} <span style={tagStyle}>{engagementStatusLabel(engagement.status)}</span>
              {engagement.publicOutcome === null ? "" : ` — ${engagement.publicOutcome}`}
            </p>)}
          </section>}

          {recap.investigation.length > 0 && <section>
            <h3 style={headingStyle}>Pistes et hypothèses exprimées</h3>
            {recap.investigation.flatMap(thread => thread.discoveries).map((discovery, index) => <p key={`discovery:${index}`} style={lineStyle}>
              <span style={tagStyle}>{knowledgeLabel(discovery.status)}</span> {discovery.statement}
            </p>)}
            {recap.investigation.flatMap(thread => thread.expressedHypotheses).map((hypothesis, index) => <p key={`hypothesis:${index}`} style={lineStyle}>
              Hypothèse — {hypothesis.statement} <span style={tagStyle}>{hypothesisStatusLabel(hypothesis.status)}</span>
            </p>)}
          </section>}

          <section>
            <h3 style={headingStyle}>Inventaire personnel</h3>
            {recap.inventory.items.length === 0
              ? <p style={mutedStyle}>Aucun objet.</p>
              : <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {recap.inventory.items.map((item, index) => <span key={`${item.label}:${index}`} style={itemStyle}>
                  {item.label}{item.quantity > 1 ? ` ×${item.quantity}` : ""}{item.equipped ? " · équipé" : ""}
                </span>)}
              </div>}
            <p style={{ ...mutedStyle, marginBottom: 0 }}>Aide-mémoire en lecture seule.</p>
          </section>

          <button type="button" onClick={() => void refresh()} style={buttonStyle}>Actualiser le résumé</button>
        </div>
      )}
    </details>
  );
}

function knowledgeLabel(status: string): string {
  if (status === "HEARD") return "Entendu";
  if (status === "OBSERVED") return "Observé";
  if (status === "CONFIRMED") return "Confirmé";
  if (status === "REFUTED") return "Réfuté";
  return "Connu dans la scène";
}

function engagementStatusLabel(status: string): string {
  return ({ PROPOSED: "proposé", ACCEPTED: "accepté", REFUSED: "refusé", CONDITIONAL: "sous condition", UNCERTAIN: "incertain", COMPLETED: "terminé" } as Record<string, string>)[status] ?? status;
}

function hypothesisStatusLabel(status: string): string {
  return ({ UNCONFIRMED: "à vérifier", SUPPORTED: "étayée", REFUTED: "écartée" } as Record<string, string>)[status] ?? status;
}

const panelStyle = { borderRadius: 16, border: "1px solid rgba(195,167,108,0.34)", background: "rgba(35,29,23,0.82)", padding: 14 };
const headingStyle = { margin: "0 0 6px", fontSize: 14, color: "#f0d9a0" };
const lineStyle = { margin: "5px 0", fontSize: 13, lineHeight: 1.45 };
const mutedStyle = { margin: "8px 0", fontSize: 12, opacity: 0.72 };
const tagStyle = { display: "inline-block", border: "1px solid rgba(240,217,160,0.3)", borderRadius: 999, padding: "1px 6px", fontSize: 11, opacity: 0.9 };
const itemStyle = { ...tagStyle, padding: "4px 8px", background: "rgba(240,217,160,0.08)" };
const buttonStyle = { justifySelf: "start", border: "1px solid rgba(240,217,160,0.35)", borderRadius: 9, background: "transparent", color: "inherit", padding: "6px 10px", cursor: "pointer" };
