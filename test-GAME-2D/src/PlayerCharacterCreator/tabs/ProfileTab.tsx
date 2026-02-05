import React from "react";
import type { Personnage } from "../../types";

export function ProfileTab(props: {
  character: Personnage;
  profileDetails: Record<string, string>;
  setNameField: (field: "prenom" | "nomcomplet" | "surnom", value: string) => void;
  setPhysiqueDetail: (value: string) => void;
  setProfileDetail: (field: string, value: string) => void;
  isSectionLocked: (id: string) => boolean;
  toggleSectionLock: (id: string) => void;
  lockButtonBaseStyle: React.CSSProperties;
  getLockButtonState: (id: string) => { background: string; label: string };
  renderPendingBadge: (count: number) => React.ReactNode;
  getPendingCountForSection: (id: string) => number;
}): React.JSX.Element {
  const {
    character,
    profileDetails,
    setNameField,
    setPhysiqueDetail,
    setProfileDetail,
    isSectionLocked,
    toggleSectionLock,
    lockButtonBaseStyle,
    getLockButtonState,
    renderPendingBadge,
    getPendingCountForSection
  } = props;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#b0b8c4" }}>
          Renseignez le profil du personnage (pre-rempli).
        </div>
        <button
          type="button"
          onClick={() => toggleSectionLock("profile")}
          style={{
            ...lockButtonBaseStyle,
            marginLeft: "auto",
            background: getLockButtonState("profile").background
          }}
        >
          {getLockButtonState("profile").label}
          {renderPendingBadge(getPendingCountForSection("profile"))}
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10
        }}
      >
        <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          Prenom
          <input
            type="text"
            value={character.nom?.prenom ?? ""}
            onChange={e => setNameField("prenom", e.target.value)}
            disabled={isSectionLocked("profile")}
            style={{
              background: "#0f0f19",
              color: "#f5f5f5",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 12,
              opacity: isSectionLocked("profile") ? 0.6 : 1
            }}
          />
        </label>
        <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          Nom complet
          <input
            type="text"
            value={character.nom?.nomcomplet ?? ""}
            onChange={e => setNameField("nomcomplet", e.target.value)}
            disabled={isSectionLocked("profile")}
            style={{
              background: "#0f0f19",
              color: "#f5f5f5",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 12,
              opacity: isSectionLocked("profile") ? 0.6 : 1
            }}
          />
        </label>
        <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          Surnom
          <input
            type="text"
            value={character.nom?.surnom ?? ""}
            onChange={e => setNameField("surnom", e.target.value)}
            disabled={isSectionLocked("profile")}
            style={{
              background: "#0f0f19",
              color: "#f5f5f5",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 12,
              opacity: isSectionLocked("profile") ? 0.6 : 1
            }}
          />
        </label>
      </div>
      <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        Traits physiques (general)
        <textarea
          value={character.descriptionPersonnage?.physique ?? ""}
          onChange={e => setPhysiqueDetail(e.target.value)}
          disabled={isSectionLocked("profile")}
          rows={3}
          style={{
            resize: "vertical",
            minHeight: 70,
            background: "#0f0f19",
            color: "#f5f5f5",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 12,
            opacity: isSectionLocked("profile") ? 0.6 : 1
          }}
        />
      </label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10
        }}
      >
        {[
          { id: "visage", label: "Visage" },
          { id: "cheveux", label: "Cheveux" },
          { id: "yeux", label: "Yeux" },
          { id: "silhouette", label: "Silhouette" }
        ].map(field => (
          <label
            key={field.id}
            style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}
          >
            {field.label}
            <input
              type="text"
              value={profileDetails[field.id] ?? ""}
              onChange={e => setProfileDetail(field.id, e.target.value)}
              disabled={isSectionLocked("profile")}
              style={{
                background: "#0f0f19",
                color: "#f5f5f5",
                border: "1px solid #333",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                opacity: isSectionLocked("profile") ? 0.6 : 1
              }}
            />
          </label>
        ))}
      </div>
    </>
  );
}
