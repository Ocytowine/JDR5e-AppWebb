import { useEffect, useState } from "react";
import type { ActiveCharacterSheetV1 } from "./activeCharacterSheetAdapter";
import type {
  PlayableCampaignInspectionV1
} from "./playableCampaignBootstrap";

export function CampaignGateway(props: {
  onOpenPlayerCampaign: (sheet: ActiveCharacterSheetV1) => void;
  onOpenArchivesPilot: () => void;
}) {
  const [inspection, setInspection] =
    useState<PlayableCampaignInspectionV1 | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    void import("./playableCampaignBootstrap")
      .then(module => module.inspectPlayableCampaignV1())
      .then(setInspection)
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const errors =
    inspection?.diagnostics.filter(value => value.severity === "ERROR") ?? [];
  const warnings =
    inspection?.diagnostics.filter(value => value.severity === "WARNING") ?? [];
  const canOpen = inspection?.sheet !== null && errors.length === 0;

  return (
    <main style={styles.page}>
      <section style={styles.card} aria-labelledby="campaign-gateway-title">
        <p style={styles.eyebrow}>Campagne narrative</p>
        <h1 id="campaign-gateway-title" style={styles.title}>
          Où souhaites-tu reprendre l’aventure ?
        </h1>
        <p style={styles.intro}>
          Une campagne joueur importe un instantané de la fiche active. Une
          modification ultérieure du créateur ne réécrit pas la partie déjà
          commencée.
        </p>

        <div style={styles.option}>
          <div>
            <strong style={styles.optionTitle}>
              {inspection?.campaignExists
                ? "Reprendre la campagne du personnage actif"
                : "Créer une campagne avec le personnage actif"}
            </strong>
            <p style={styles.optionText}>
              {loading
                ? "Lecture de la fiche active…"
                : inspection?.sheet
                  ? `${inspection.sheet.sheetName} · sauvegardée le ${formatDate(
                      inspection.sheet.updatedAt
                    )}`
                  : "Aucune fiche exploitable n’est actuellement sélectionnée."}
            </p>
          </div>
          <button
            type="button"
            disabled={!canOpen || loading}
            onClick={() => {
              if (inspection?.sheet) {
                props.onOpenPlayerCampaign(inspection.sheet);
              }
            }}
            style={{
              ...styles.primaryButton,
              opacity: canOpen && !loading ? 1 : 0.45
            }}
          >
            {inspection?.campaignExists ? "Reprendre" : "Créer"}
          </button>
        </div>

        {errors.length > 0 && (
          <aside style={styles.errorBox} aria-label="Erreurs de fiche">
            <strong>La campagne joueur ne peut pas encore être ouverte.</strong>
            {errors.map((diagnostic, index) => (
              <p key={`${diagnostic.code}:${index}`} style={styles.message}>
                {diagnostic.message}
              </p>
            ))}
          </aside>
        )}

        {warnings.length > 0 && (
          <aside style={styles.warningBox} aria-label="Avertissements de fiche">
            <strong>Points conservés à l’import :</strong>
            {warnings.map((diagnostic, index) => (
              <p key={`${diagnostic.code}:${index}`} style={styles.message}>
                {diagnostic.message}
              </p>
            ))}
          </aside>
        )}

        <button type="button" onClick={refresh} style={styles.secondaryButton}>
          Relire la fiche active
        </button>

        <hr style={styles.separator} />

        <div style={styles.option}>
          <div>
            <strong style={styles.optionTitle}>Pilote des Archives</strong>
            <p style={styles.optionText}>
              Ouvre l’ancien environnement de démonstration. Il reste isolé de
              ta campagne joueur et ne reçoit aucun avantage artificiel.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onOpenArchivesPilot}
            style={styles.secondaryButton}
          >
            Ouvrir le pilote
          </button>
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString("fr-FR")
    : value;
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background:
      "radial-gradient(circle at 50% 10%, #172033 0, #090c13 48%, #05070b 100%)",
    color: "#f6f3ea"
  },
  card: {
    width: "min(760px, 100%)",
    padding: "32px",
    border: "1px solid rgba(218,190,126,0.28)",
    borderRadius: 20,
    background: "rgba(12,16,25,0.94)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.48)"
  },
  eyebrow: {
    margin: 0,
    color: "#d5b979",
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: 800
  },
  title: { margin: "8px 0 12px", fontSize: 32, lineHeight: 1.15 },
  intro: { margin: "0 0 28px", color: "#b9bec9", lineHeight: 1.6 },
  option: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
    padding: "18px 0"
  },
  optionTitle: { display: "block", fontSize: 18 },
  optionText: { margin: "7px 0 0", color: "#aeb5c2", lineHeight: 1.45 },
  primaryButton: {
    border: "1px solid #e0c283",
    borderRadius: 10,
    padding: "11px 18px",
    background: "#d5b979",
    color: "#17130b",
    fontWeight: 900,
    cursor: "pointer"
  },
  secondaryButton: {
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 10,
    padding: "10px 15px",
    background: "rgba(255,255,255,0.06)",
    color: "#f4f4f4",
    fontWeight: 750,
    cursor: "pointer"
  },
  errorBox: {
    margin: "12px 0",
    padding: 14,
    borderRadius: 10,
    border: "1px solid rgba(255,109,109,0.5)",
    background: "rgba(120,20,30,0.2)",
    color: "#ffd4d4"
  },
  warningBox: {
    margin: "12px 0",
    padding: 14,
    borderRadius: 10,
    border: "1px solid rgba(229,188,91,0.45)",
    background: "rgba(120,82,10,0.18)",
    color: "#ffe7ad"
  },
  message: { margin: "6px 0 0", fontSize: 13 },
  separator: {
    margin: "25px 0 4px",
    border: 0,
    borderTop: "1px solid rgba(255,255,255,0.12)"
  }
} satisfies Record<string, React.CSSProperties>;
