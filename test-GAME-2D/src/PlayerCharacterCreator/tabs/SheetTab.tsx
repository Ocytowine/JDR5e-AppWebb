import React, { useState } from "react";
import { spellCatalog } from "../../game/spellCatalog";
import type { Personnage } from "../../types";
import type { ClassDefinition, SubclassDefinition } from "../../game/classTypes";

type SpellEntry =
  | string
  | {
      id: string;
      instanceId: string;
      origin?: { kind: string; id?: string; sourceKey?: string };
    };

type MagicSource = {
  key: string;
  label: string;
  ability: "SAG" | "INT" | "CHA";
  preparation: "prepared" | "known";
  storage: "memory" | "innate" | "grimoire";
  focusTypes?: string[];
  spellFilterTags?: string[];
  freePreparedFromGrants?: boolean;
  casterProgression: "full" | "half" | "third" | "none";
  slotsByLevel?: Record<string, number[]>;
  classLevel: number;
  spellIds: string[];
};

export function SheetTab(props: {
  character: Personnage;
  onChangeCharacter: (next: Personnage) => void;
  choiceSelections: Record<string, any>;
  magicSources: MagicSource[];
  spellcastingSelections: Record<
    string,
    {
      knownSpells?: SpellEntry[];
      preparedSpells?: SpellEntry[];
      grantedSpells?: SpellEntry[];
      focusItemId?: string | null;
      focusInstanceId?: string | null;
      storage?: "memory" | "innate" | "grimoire";
      grimoireItemId?: string | null;
    }
  >;
  renderValidatedBadge: (value: boolean) => React.ReactNode;
  getSectionValidated: (id: string) => boolean;
  activeRace: any;
  getRaceTraits: (race: any) => Array<{ id: string; label: string }>;
  activeBackground: any;
  getBackgroundFeatureInfo: (bg: any) => { label: string; description: string } | null;
  getBackgroundSkillProficiencies: (bg: any) => string[];
  getBackgroundToolProficiencies: (bg: any) => string[];
  competenceOptions: Array<{ id: string; label: string }>;
  toolMasteryOptions: Array<{ id: string; label: string }>;
  classPrimary: ClassDefinition | null;
  classSecondary: ClassDefinition | null;
  classEntry: any;
  secondaryClassEntry: any;
  selectedSubclassId: string;
  selectedSecondarySubclassId: string;
  subclassOptions: SubclassDefinition[];
  asiSelections: Record<string, any>;
  getScore: (key: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA") => number;
  computeMod: (value: number) => number;
  resolveLevel: () => number;
  computeArmorClassFromEquipment: () => number;
  computeMaxHp: () => number;
  competences: string[];
  expertises: string[];
  skillAbilityMap: Record<string, string>;
  weaponMasteries: string[];
  armorMasteries: string[];
  toolMasteries: string[];
  EQUIPMENT_SLOTS: Array<{ id: string; label: string }>;
  materielSlots: Record<string, string | null | undefined>;
  packSlots: Array<string>;
  packSlotStatus: (slotId: string) => {
    bagId?: string | null;
    capacity: number;
    storedWeight: number;
  };
  inventoryItems: Array<any>;
  getSlotLabel: (slotId: string) => string;
  formatEquipmentLabel: (value: string) => string;
}): React.JSX.Element {
  const {
    character,
    onChangeCharacter,
    choiceSelections,
    magicSources,
    spellcastingSelections,
    renderValidatedBadge,
    getSectionValidated,
    activeRace,
    getRaceTraits,
    activeBackground,
    getBackgroundFeatureInfo,
    getBackgroundSkillProficiencies,
    getBackgroundToolProficiencies,
    competenceOptions,
    toolMasteryOptions,
    classPrimary,
    classSecondary,
    classEntry,
    secondaryClassEntry,
    selectedSubclassId,
    selectedSecondarySubclassId,
    subclassOptions,
    asiSelections,
    getScore,
    computeMod,
    resolveLevel,
    computeArmorClassFromEquipment,
    computeMaxHp,
    competences,
    expertises,
    skillAbilityMap,
    weaponMasteries,
    armorMasteries,
    toolMasteries,
    EQUIPMENT_SLOTS,
    materielSlots,
    packSlots,
    packSlotStatus,
    inventoryItems,
    getSlotLabel,
    formatEquipmentLabel
  } = props;
  const [showCharacterJson, setShowCharacterJson] = useState(false);

  return (
<>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {(() => {
                  const statLabels: Record<string, string> = {
                    FOR: "Force",
                    DEX: "Dexterite",
                    CON: "Constitution",
                    INT: "Intelligence",
                    SAG: "Sagesse",
                    CHA: "Charisme"
                  };
                  const getSpellId = (entry: SpellEntry) =>
                    typeof entry === "string" ? entry : entry.id;
                  const getSpellName = (id: string) => spellCatalog.byId.get(id)?.name ?? id;
                  const getCasterContribution = (
                    progression: "full" | "half" | "third" | "none",
                    level: number
                  ) => {
                    if (progression === "full") return level;
                    if (progression === "half") return Math.floor(level / 2);
                    if (progression === "third") return Math.floor(level / 3);
                    return 0;
                  };
                  const totalCasterLevel = magicSources.reduce(
                    (sum, item) => sum + getCasterContribution(item.casterProgression, item.classLevel),
                    0
                  );
                  const slotsTable = magicSources.find(item => item.slotsByLevel)?.slotsByLevel ?? null;
                  const slots = slotsTable
                    ? slotsTable[String(Math.max(0, totalCasterLevel))] ?? []
                    : [];
                  const slotsSummary =
                    slots.length > 0
                      ? slots
                          .map((count, idx) => (count > 0 ? `${idx + 1}: ${count}` : null))
                          .filter(Boolean)
                          .join(" | ")
                      : "—";
                  const backgroundChoices = (choiceSelections as any)?.background ?? {};
                  const backgroundTools = Array.isArray(backgroundChoices.tools)
                    ? backgroundChoices.tools
                    : [];
                  const backgroundLanguages = Array.isArray(backgroundChoices.languages)
                    ? backgroundChoices.languages
                    : [];
                  const derivedGrants = (((character as any)?.derived?.grants ?? {}) as Record<string, any>);
                  const derivedFeatures = Array.isArray(derivedGrants.features) ? derivedGrants.features : [];
                  const derivedActions = Array.isArray(derivedGrants.actions) ? derivedGrants.actions : [];
                  const derivedReactions = Array.isArray(derivedGrants.reactions) ? derivedGrants.reactions : [];
                  const derivedResources = Array.isArray(derivedGrants.resources) ? derivedGrants.resources : [];
                  const derivedPassifs = Array.isArray(derivedGrants.passifs) ? derivedGrants.passifs : [];
                  const derivedSpells = Array.isArray(derivedGrants.spells) ? derivedGrants.spells : [];
                  const adaptableSkill = (choiceSelections as any)?.race?.adaptableSkill ?? "";
                  const buildProgressionLines = (progression?: Record<string, any>, maxLevel?: number) => {
                    if (!progression) return [];
                    const levels = Object.keys(progression)
                      .map(key => Number(key))
                      .filter(level => Number.isFinite(level))
                      .sort((a, b) => a - b);
                    return levels
                      .filter(level => (typeof maxLevel === "number" ? level <= maxLevel : true))
                      .map(level => {
                      const entry = progression[String(level)] ?? {};
                      const grants = Array.isArray(entry.grants) ? entry.grants : [];
                      const desc = entry.description ? entry.description : "";
                      const hasAsi = grants.some(
                        (grant: any) => grant?.kind === "bonus" && (grant?.ids ?? []).includes("asi-or-feat")
                      );
                      const baseLabel = desc || (hasAsi ? "Amelioration de caracteristiques (ASI) ou choix de don" : "Progression");
                      return { level, hasAsi, baseLabel };
                    });
                  };
                  const buildClassProgressionDisplay = (
                    cls: ClassDefinition | null,
                    subclass: SubclassDefinition | null,
                    level: number
                  ) => {
                    if (!cls || level <= 0) return [];
                    const lines: string[] = [];
                    const clsLines = buildProgressionLines(cls.progression, level);
                    const subLines = subclass ? buildProgressionLines(subclass.progression, level) : [];
                    const formatLine = (entry: { level: number; hasAsi: boolean; baseLabel: string }) => {
                      let suffix = "";
                      if (entry.hasAsi) {
                        const key = `${cls.id}:${entry.level}`;
                        const asiEntry = asiSelections[key] ?? (cls.id === classPrimary?.id ? asiSelections[String(entry.level)] : null);
                        if (asiEntry?.type === "feat") {
                          suffix = " : Don";
                        } else if (asiEntry?.type === "asi") {
                          const stats = asiEntry.stats ?? {};
                          const parts = Object.entries(stats)
                            .map(([stat, value]) => `+${value} ${statLabels[stat] ?? stat}`)
                            .join(", ");
                          suffix = parts ? ` : ${parts}` : " : non choisi";
                        } else {
                          suffix = " : non choisi";
                        }
                      }
                      return `Niveau ${entry.level} — ${entry.baseLabel}${suffix}`;
                    };
                    clsLines.forEach(entry => lines.push(formatLine(entry)));
                    subLines.forEach(entry => lines.push(formatLine(entry)));
                    return lines;
                  };
                  const primarySubclass = selectedSubclassId
                    ? subclassOptions.find(sub => sub.id === selectedSubclassId) ?? null
                    : null;
                  const secondarySubclass = selectedSecondarySubclassId
                    ? subclassOptions.find(sub => sub.id === selectedSecondarySubclassId) ?? null
                    : null;
                  const primaryLevel = Number(classEntry?.niveau) || 0;
                  const secondaryLevel = Number(secondaryClassEntry?.niveau) || 0;
                  const primaryProgressionLines = buildClassProgressionDisplay(
                    classPrimary,
                    primarySubclass,
                    primaryLevel
                  );
                  const secondaryProgressionLines = buildClassProgressionDisplay(
                    classSecondary,
                    secondarySubclass,
                    secondaryLevel
                  );
                  return (
                    <>
                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Identite
                          {renderValidatedBadge(getSectionValidated("profile"))}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          Nom: {character?.nom?.nomcomplet ?? "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          Prenom: {character?.nom?.prenom ?? "—"} | Surnom:{" "}
                          {character?.nom?.surnom ?? "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          Age: {character?.age ?? "—"} | Sexe: {character?.sexe ?? "—"}
                        </div>
                      </div>

                      {magicSources.length > 0 && (
                        <div
                          style={{
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(12,12,18,0.75)",
                            padding: 12,
                            display: "flex",
                            flexDirection: "column",
                            gap: 8
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                            Magie
                            {renderValidatedBadge(getSectionValidated("magic"))}
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            Emplacements (total): {slotsSummary}
                          </div>
                          <div style={{ display: "grid", gap: 10 }}>
                            {magicSources.map(source => {
                              const selection = spellcastingSelections[source.key] ?? {};
                              const knownSpells = Array.isArray(selection.knownSpells)
                                ? selection.knownSpells
                                : [];
                              const preparedSpells = Array.isArray(selection.preparedSpells)
                                ? selection.preparedSpells
                                : [];
                              const grantedSpells = Array.isArray(selection.grantedSpells)
                                ? selection.grantedSpells
                                : [];
                              const preparedList =
                                source.preparation === "prepared" ? preparedSpells : knownSpells;
                              const preparedIds = new Set(preparedList.map(spell => getSpellId(spell)));
                              const grantedIds = new Set(grantedSpells.map(spell => getSpellId(spell)));
                              const freePreparedFromGrants = Boolean(source.freePreparedFromGrants);
                              const preparedCount = Array.from(preparedIds).filter(
                                id => !(freePreparedFromGrants && grantedIds.has(id))
                              ).length;
                              const preparedLimit =
                                source.preparation === "prepared" ? Math.max(0, source.classLevel) : null;
                              const storageLabel =
                                source.storage === "memory"
                                  ? "Memoire"
                                  : source.storage === "innate"
                                    ? "Inne"
                                    : "Grimoire";
                              const grantedNames =
                                grantedSpells.length > 0
                                  ? grantedSpells.map(spell => getSpellName(getSpellId(spell)))
                                  : source.spellIds.map(id => getSpellName(id));
                              const preparedNames = preparedList.map(spell => getSpellName(getSpellId(spell)));
                              return (
                                <div
                                  key={`sheet-magic-${source.key}`}
                                  style={{
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    background: "rgba(10,10,16,0.8)",
                                    padding: "8px 10px",
                                    display: "grid",
                                    gap: 6
                                  }}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5" }}>
                                    {source.label} (niv {source.classLevel})
                                  </div>
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                                    Methode: {source.preparation === "prepared" ? "Prepare" : "Connu"} | Stockage:{" "}
                                    {storageLabel}
                                  </div>
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                                    {source.preparation === "prepared"
                                      ? `Sorts prepares: ${preparedCount}${preparedLimit !== null ? ` / ${preparedLimit}` : ""}`
                                      : `Sorts connus: ${preparedIds.size}`}
                                  </div>
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                                    Sorts {source.preparation === "prepared" ? "prepares" : "connus"}:{" "}
                                    {preparedNames.join(", ") || "—"}
                                  </div>
                                  {grantedNames.length > 0 && (
                                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                                      Sorts imposes: {grantedNames.join(", ")}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Espece
                          {renderValidatedBadge(getSectionValidated("species"))}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          {activeRace ? `${activeRace.label} (${activeRace.id})` : "—"}
                        </div>
                        {getRaceTraits(activeRace).length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {getRaceTraits(activeRace).map(trait => (
                              <span
                                key={`trait-${trait.id}`}
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 999,
                                  border: "1px solid rgba(255,255,255,0.18)",
                                  background: "rgba(46, 204, 113, 0.12)",
                                  fontSize: 11,
                                  color: "rgba(255,255,255,0.75)"
                                }}
                              >
                                {trait.label}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          Traits: {getRaceTraits(activeRace).map(trait => trait.label).join(", ") || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          Choix adapte: {adaptableSkill ? (competenceOptions.find(c => c.id === adaptableSkill)?.label ?? adaptableSkill) : "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          Vitesse: {activeRace?.speed ?? "—"} | Taille: {activeRace?.size ?? "—"}
                        </div>
                      </div>

                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Historique
                          {renderValidatedBadge(getSectionValidated("backgrounds"))}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          {activeBackground ? `${activeBackground.label} (${activeBackground.id})` : "—"}
                        </div>
                        {getBackgroundFeatureInfo(activeBackground) && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: 999,
                                border: "1px solid rgba(255,255,255,0.18)",
                                background: "rgba(241, 196, 15, 0.16)",
                                fontSize: 11,
                                color: "rgba(255,255,255,0.75)"
                              }}
                            >
                              {getBackgroundFeatureInfo(activeBackground)?.label ?? "Aptitude"}
                            </span>
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          Competences:{" "}
                          {getBackgroundSkillProficiencies(activeBackground)
                            .map(id => competenceOptions.find(c => c.id === id)?.label ?? id)
                            .join(", ") || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          Outils:{" "}
                          {getBackgroundToolProficiencies(activeBackground)
                            .map(id => toolMasteryOptions.find(t => t.id === id)?.label ?? id)
                            .join(", ") || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          Choix outils:{" "}
                          {backgroundTools.length
                            ? backgroundTools
                                .map(id => toolMasteryOptions.find(t => t.id === id)?.label ?? id)
                                .join(", ")
                            : "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          Choix langues: {backgroundLanguages.join(", ") || "—"}
                        </div>
                      </div>

                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Classes
                          {renderValidatedBadge(getSectionValidated("classes"))}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          Classe principale:{" "}
                          {classPrimary
                            ? `${classPrimary.label}${primarySubclass ? ` — ${primarySubclass.label}` : ""} (niv ${primaryLevel})`
                            : "—"}
                        </div>
                        {primaryProgressionLines.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            Progression:
                            {primaryProgressionLines.map(line => (
                              <div key={`prog-primary-${line}`} style={{ marginTop: 4 }}>
                                {line}
                              </div>
                            ))}
                          </div>
                        )}
                        {classSecondary && secondaryLevel > 0 && (
                          <>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                              Classe secondaire:{" "}
                              {classSecondary
                                ? `${classSecondary.label}${secondarySubclass ? ` — ${secondarySubclass.label}` : ""} (niv ${secondaryLevel})`
                                : "—"}
                            </div>
                            {secondaryProgressionLines.length > 0 && (
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                                Progression:
                                {secondaryProgressionLines.map(line => (
                                  <div key={`prog-secondary-${line}`} style={{ marginTop: 4 }}>
                                    {line}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800 }}>
                          Projection derivee
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                          Features: {derivedFeatures.join(", ") || "-"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                          Actions derivees: {derivedActions.join(", ") || "-"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                          Reactions derivees: {derivedReactions.join(", ") || "-"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                          Ressources derivees: {derivedResources.join(", ") || "-"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                          Passifs derives: {derivedPassifs.join(", ") || "-"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                          Sorts derives: {derivedSpells.join(", ") || "-"}
                        </div>
                      </div>

                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Caracteristiques
                          {renderValidatedBadge(getSectionValidated("stats"))}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(140px, 1fr))",
                            gap: 8
                          }}
                        >
                          {([
                            { id: "FOR", label: "Force" },
                            { id: "DEX", label: "Dexterite" },
                            { id: "CON", label: "Constitution" },
                            { id: "INT", label: "Intelligence" },
                            { id: "SAG", label: "Sagesse" },
                            { id: "CHA", label: "Charisme" }
                          ] as const).map(stat => {
                            const value = getScore(stat.id);
                            const mod = computeMod(value);
                            const modLabel = mod >= 0 ? `+${mod}` : `${mod}`;
                            return (
                              <div
                                key={`stat-sheet-${stat.id}`}
                                style={{
                                  borderRadius: 8,
                                  border: "1px solid rgba(255,255,255,0.12)",
                                  background: "rgba(10,10,16,0.8)",
                                  padding: "6px 8px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 8
                                }}
                              >
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                                  {stat.label}
                                </span>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>
                                  {value} {modLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                            gap: 8
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: "#cfe4ff",
                              background: "rgba(79,125,242,0.18)",
                              border: "1px solid rgba(79,125,242,0.5)",
                              borderRadius: 8,
                              padding: "6px 8px"
                            }}
                          >
                            CA (dynamique): {computeArmorClassFromEquipment()}
                          </div>
                          {Boolean((choiceSelections as any)?.sheetValidated) && (
                            <>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: "#ffe9a6",
                                  background: "rgba(241,196,15,0.16)",
                                  border: "1px solid rgba(241,196,15,0.5)",
                                  borderRadius: 8,
                                  padding: "6px 8px"
                                }}
                              >
                                PV max: {character?.combatStats?.maxHp ?? "—"}
                              </div>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                                Des de vie: {classPrimary?.hitDie ? `d${classPrimary.hitDie} x${Number(classEntry?.niveau) || 0}` : "—"}
                                {classSecondary?.hitDie && Number(secondaryClassEntry?.niveau)
                                  ? ` + d${classSecondary.hitDie} x${Number(secondaryClassEntry?.niveau) || 0}`
                                  : ""}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Competences
                          {renderValidatedBadge(getSectionValidated("skills"))}
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: "#4f7df2",
                            textAlign: "center"
                          }}
                        >
                          Bonus de maitrise: {(() => {
                            const level = resolveLevel();
                            const prof = 2 + Math.floor((level - 1) / 4);
                            return prof >= 0 ? `+${prof}` : prof;
                          })()}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          {(() => {
                            const merged = Array.from(
                              new Set([...(competences ?? []), ...(expertises ?? [])])
                            );
                            if (merged.length === 0) return "—";
                            return merged.map(id => {
                              const label = competenceOptions.find(c => c.id === id)?.label ?? id;
                              const abilityKey = skillAbilityMap[id];
                              const scoreKey =
                                abilityKey === "STR"
                                  ? "FOR"
                                  : abilityKey === "DEX"
                                    ? "DEX"
                                    : abilityKey === "CON"
                                      ? "CON"
                                      : abilityKey === "INT"
                                        ? "INT"
                                        : abilityKey === "WIS"
                                          ? "SAG"
                                          : "CHA";
                              const mod = computeMod(getScore(scoreKey));
                              const level = resolveLevel();
                              const prof = 2 + Math.floor((level - 1) / 4);
                              const isExpert = expertises.includes(id);
                              const isProf = competences.includes(id);
                              const bonus = mod + (isExpert ? prof * 2 : isProf ? prof : 0);
                              const bonusLabel = bonus >= 0 ? `+${bonus}` : bonus;
                              const suffix = isExpert ? " (Expertise)" : "";
                              return `${label}${suffix}: ${bonusLabel}`;
                            }).join(", ");
                          })()}
                        </div>
                      </div>

                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Maitrises
                          {renderValidatedBadge(getSectionValidated("masteries"))}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          Armes: {weaponMasteries.join(", ") || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          Armures: {armorMasteries.join(", ") || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          Outils: {toolMasteries.join(", ") || "—"}
                        </div>
                      </div>

                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Materiel
                          {renderValidatedBadge(getSectionValidated("equip"))}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          {EQUIPMENT_SLOTS.filter(slot => Boolean(materielSlots[slot.id])).length > 0
                            ? EQUIPMENT_SLOTS.filter(slot => Boolean(materielSlots[slot.id])).map(slot => (
                                <div key={`slot-${slot.id}`} style={{ marginTop: 4 }}>
                                  {slot.label}: {formatEquipmentLabel(String(materielSlots[slot.id]))}
                                </div>
                              ))
                            : "—"}
                        </div>
                        {(() => {
                          const packEntries = Array.from(packSlots)
                            .map(slotId => {
                              const status = packSlotStatus(slotId);
                              if (!status.bagId) return null;
                              const bagContents = inventoryItems.filter(item => {
                                const inSlot =
                                  item?.storedIn === slotId ||
                                  (slotId === "paquetage" &&
                                    status.bagId &&
                                    item?.storedIn === status.bagId);
                                return inSlot;
                              });
                              return {
                                slotId,
                                status,
                                contents: bagContents,
                                label: getSlotLabel(slotId)
                              };
                            })
                            .filter(Boolean) as Array<{
                            slotId: string;
                            status: ReturnType<typeof packSlotStatus>;
                            contents: Array<any>;
                            label: string;
                          }>;
                          if (packEntries.length === 0) return null;
                          return (
                            <div
                              style={{
                                marginTop: 6,
                                padding: 8,
                                borderRadius: 8,
                                border: "1px solid rgba(255,255,255,0.12)",
                                background: "rgba(10,10,16,0.7)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8
                              }}
                            >
                              <div style={{ fontSize: 12, fontWeight: 800 }}>Sacs</div>
                              {packEntries.map(entry => {
                                const capacityLabel =
                                  entry.status.capacity > 0
                                    ? entry.status.capacity.toFixed(1)
                                    : "?";
                                return (
                                  <div key={`bag-${entry.slotId}`} style={{ display: "grid", gap: 4 }}>
                                    <div
                                      style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}
                                    >
                                      {entry.label}: {formatEquipmentLabel(entry.status.bagId ?? "")}
                                    </div>
                                    <div
                                      style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
                                    >
                                      Capacite: {entry.status.storedWeight.toFixed(1)} /{" "}
                                      {capacityLabel}
                                    </div>
                                    <div
                                      style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
                                    >
                                      Contenu:
                                      {entry.contents.length > 0
                                        ? entry.contents.map(item => (
                                            <div
                                              key={`bag-${entry.slotId}-${item.id}`}
                                              style={{ marginTop: 4 }}
                                            >
                                              {formatEquipmentLabel(item.id)} x{item.qty ?? 1}
                                            </div>
                                          ))
                                        : " —"}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <div
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800 }}>Validation fiche</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          PV calcules avec les des de vie et le mod CON.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const maxHp = computeMaxHp();
                            const nextCombatStats = {
                              ...(character.combatStats ?? {}),
                              maxHp,
                              level: resolveLevel()
                            };
                            const nextChoiceSelections = {
                              ...choiceSelections,
                              sheetValidated: true
                            };
                            onChangeCharacter({
                              ...character,
                              pvActuels: maxHp,
                              combatStats: nextCombatStats,
                              choiceSelections: nextChoiceSelections
                            });
                          }}
                          disabled={
                            ![
                              "species",
                              "backgrounds",
                              "classes",
                              "stats",
                              "skills",
                              "masteries",
                              "equip",
                              "profile",
                              ...(magicSources.length > 0 ? ["magic"] : [])
                            ].every(section => getSectionValidated(section))
                          }
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(46, 204, 113, 0.16)",
                            color: "#f5f5f5",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 800,
                            opacity: [
                              "species",
                              "backgrounds",
                              "classes",
                              "stats",
                              "skills",
                              "masteries",
                              "equip",
                              "profile",
                              ...(magicSources.length > 0 ? ["magic"] : [])
                            ].every(section => getSectionValidated(section))
                              ? 1
                              : 0.5
                          }}
                        >
                          Valider la fiche complete
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCharacterJson(prev => !prev)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.08)",
                            color: "#f5f5f5",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700
                          }}
                        >
                          {showCharacterJson ? "Masquer le JSON" : "Afficher le JSON"}
                        </button>
                        {showCharacterJson && (
                          <pre
                            style={{
                              margin: 0,
                              maxHeight: 280,
                              overflow: "auto",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              fontSize: 11,
                              color: "rgba(255,255,255,0.8)",
                              background: "#0f0f19",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 8,
                              padding: 8
                            }}
                          >
                            {JSON.stringify({ ...character, choiceSelections }, null, 2)}
                          </pre>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
  );
}
