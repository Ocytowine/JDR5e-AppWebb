import React, { useMemo, useState } from "react";
import type { Personnage } from "../types";
import type { WeaponTypeDefinition } from "../game/weaponTypes";

export function CombatSetupScreen(props: {
  configEnemyCount: number;
  enemyTypeCount: number;
  gridCols: number;
  gridRows: number;
  mapPrompt: string;
  character: Personnage;
  weaponTypes: WeaponTypeDefinition[];
  onChangeCharacter: (next: Personnage) => void;
  onChangeMapPrompt: (value: string) => void;
  onChangeEnemyCount: (value: number) => void;
  onStartCombat: () => void;
  onNoEnemyTypes: () => void;
}): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<"map" | "equip" | "skills" | "masteries">(
    "map"
  );
  const equipped = (props.character?.armesDefaut ?? {
    main_droite: null,
    main_gauche: null,
    mains: null
  }) as {
    main_droite?: string | null;
    main_gauche?: string | null;
    mains?: string | null;
  };
  const weaponOptions = useMemo(() => {
    const list = Array.isArray(props.weaponTypes) ? [...props.weaponTypes] : [];
    list.sort((a, b) => {
      const sa = `${a.subtype}:${a.name}`.toLowerCase();
      const sb = `${b.subtype}:${b.name}`.toLowerCase();
      return sa.localeCompare(sb);
    });
    return list;
  }, [props.weaponTypes]);
  const competences = Array.isArray(props.character?.competences)
    ? (props.character.competences as string[])
    : [];
  const profs = (props.character?.proficiencies ?? {}) as {
    weapons?: string[];
    armors?: string[];
    tools?: string[];
  };
  const weaponMasteries = Array.isArray(profs.weapons) ? profs.weapons : [];
  const armorMasteries = Array.isArray(profs.armors) ? profs.armors : [];
  const toolMasteries = Array.isArray(profs.tools) ? profs.tools : [];

  const setWeaponSlot = (slot: "main_droite" | "main_gauche" | "mains", value: string | null) => {
    const nextSlots = {
      main_droite: equipped.main_droite ?? null,
      main_gauche: equipped.main_gauche ?? null,
      mains: equipped.mains ?? null
    };
    if (slot === "mains") {
      nextSlots.mains = value;
      if (value) {
        nextSlots.main_droite = null;
        nextSlots.main_gauche = null;
      }
    } else {
      (nextSlots as any)[slot] = value;
      if (value) nextSlots.mains = null;
    }
    props.onChangeCharacter({ ...props.character, armesDefaut: nextSlots });
  };

  const toggleListValue = (list: string[], value: string): string[] => {
    if (list.includes(value)) return list.filter(item => item !== value);
    return [...list, value];
  };

  const toggleCompetence = (value: string) => {
    const next = toggleListValue(competences, value);
    props.onChangeCharacter({ ...props.character, competences: next });
  };

  const toggleMastery = (kind: "weapons" | "armors" | "tools", value: string) => {
    const next = {
      weapons: kind === "weapons" ? toggleListValue(weaponMasteries, value) : weaponMasteries,
      armors: kind === "armors" ? toggleListValue(armorMasteries, value) : armorMasteries,
      tools: kind === "tools" ? toggleListValue(toolMasteries, value) : toolMasteries
    };
    props.onChangeCharacter({ ...props.character, proficiencies: next });
  };

  const competenceOptions = [
    "Acrobaties",
    "Arcanes",
    "Athletisme",
    "Discretion",
    "Dressage",
    "Escamotage",
    "Histoire",
    "Intimidation",
    "Investigation",
    "Medecine",
    "Nature",
    "Perception",
    "Persuasion",
    "Religion",
    "Representation",
    "Survie",
    "Tromperie"
  ];

  const weaponMasteryOptions = ["simple", "martiale", "speciale", "monastique"];
  const armorMasteryOptions = ["legere", "intermediaire", "lourde", "bouclier"];
  const toolMasteryOptions = [
    "artisanat",
    "voleur",
    "herboriste",
    "soins",
    "musique",
    "deguisement",
    "faussaire",
    "brasseur_cuisinier",
    "navigation",
    "cartographe"
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#0b0b12",
        color: "#f5f5f5",
        fontFamily: "system-ui, sans-serif",
        padding: 16,
        boxSizing: "border-box"
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Preparation du combat</h1>
      <p style={{ marginBottom: 16, fontSize: 13, maxWidth: 480, textAlign: "center" }}>
        Configurez le combat avant de lancer la grille : nombre d&apos;ennemis,
        puis demarrez pour effectuer les jets d&apos;initiative et entrer en mode
        tour par tour.
      </p>
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          background: "#141421",
          border: "1px solid #333",
          minWidth: 260,
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { id: "map", label: "Carte" },
            { id: "equip", label: "Equipement" },
            { id: "skills", label: "Competences" },
            { id: "masteries", label: "Maitrises" }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: `1px solid ${isActive ? "#4f7df2" : "#333"}`,
                  background: isActive ? "rgba(79,125,242,0.2)" : "#0f0f19",
                  color: isActive ? "#dfe8ff" : "#c9cfdd",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "map" && (
          <>
            <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
              Contexte de la battle map :
              <textarea
                value={props.mapPrompt}
                onChange={e => props.onChangeMapPrompt(e.target.value)}
                placeholder="Ex: Un donjon humide: une salle, un couloir, une porte verrouillee, des piliers. Ennemis en embuscade au fond."
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
            <label style={{ fontSize: 13 }}>
              Nombre d&apos;ennemis :
              <input
                type="number"
                min={1}
                max={8}
                value={props.configEnemyCount}
                onChange={e =>
                  props.onChangeEnemyCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))
                }
                style={{
                  marginLeft: 8,
                  width: 60,
                  background: "#0f0f19",
                  color: "#f5f5f5",
                  border: "1px solid #333",
                  borderRadius: 4,
                  padding: "2px 4px"
                }}
              />
            </label>
            <p style={{ fontSize: 11, color: "#b0b8c4", margin: 0 }}>
              Taille de la carte : mode texte utilise ({props.gridCols} x {props.gridRows}).
            </p>
            <button
              type="button"
              onClick={() => {
                if (props.enemyTypeCount === 0) {
                  props.onNoEnemyTypes();
                  return;
                }
                props.onStartCombat();
              }}
              style={{
                marginTop: 8,
                padding: "6px 12px",
                background: "#2ecc71",
                color: "#0b0b12",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13
              }}
            >
              Lancer le combat
            </button>
          </>
        )}

        {activeTab === "equip" && (
          <>
            <div style={{ fontSize: 12, color: "#b0b8c4" }}>
              Choisissez les armes equipees. Les actions disponibles s&apos;adapteront a ces choix.
            </div>
            {[
              { id: "main_droite", label: "Main droite" },
              { id: "main_gauche", label: "Main gauche" },
              { id: "mains", label: "Deux mains" }
            ].map(slot => (
              <label
                key={slot.id}
                style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}
              >
                {slot.label} :
                <select
                  value={(equipped as any)[slot.id] ?? ""}
                  onChange={e =>
                    setWeaponSlot(
                      slot.id as "main_droite" | "main_gauche" | "mains",
                      e.target.value ? e.target.value : null
                    )
                  }
                  style={{
                    background: "#0f0f19",
                    color: "#f5f5f5",
                    border: "1px solid #333",
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontSize: 12
                  }}
                >
                  <option value="">Aucune</option>
                  {weaponOptions.map(weapon => (
                    <option key={weapon.id} value={weapon.id}>
                      {weapon.name} ({weapon.subtype})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </>
        )}

        {activeTab === "skills" && (
          <>
            <div style={{ fontSize: 12, color: "#b0b8c4" }}>
              Cochez les competences pour simuler les impacts de jeu.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 8
              }}
            >
              {competenceOptions.map(skill => (
                <label
                  key={skill}
                  style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={competences.includes(skill)}
                    onChange={() => toggleCompetence(skill)}
                  />
                  {skill}
                </label>
              ))}
            </div>
          </>
        )}

        {activeTab === "masteries" && (
          <>
            <div style={{ fontSize: 12, color: "#b0b8c4" }}>
              Selectionnez les maitrises. Elles influenceront les bonus et malus.
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Armes</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {weaponMasteryOptions.map(value => (
                <label key={value} style={{ fontSize: 12, display: "flex", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={weaponMasteries.includes(value)}
                    onChange={() => toggleMastery("weapons", value)}
                  />
                  {value}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 10 }}>Armures</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {armorMasteryOptions.map(value => (
                <label key={value} style={{ fontSize: 12, display: "flex", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={armorMasteries.includes(value)}
                    onChange={() => toggleMastery("armors", value)}
                  />
                  {value}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 10 }}>Outils</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {toolMasteryOptions.map(value => (
                <label key={value} style={{ fontSize: 12, display: "flex", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={toolMasteries.includes(value)}
                    onChange={() => toggleMastery("tools", value)}
                  />
                  {value}
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
