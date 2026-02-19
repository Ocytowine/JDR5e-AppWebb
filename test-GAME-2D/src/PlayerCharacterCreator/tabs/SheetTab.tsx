import React, { useMemo, useState } from "react";
import { spellCatalog } from "../../game/spellCatalog";
import { loadActionTypesFromIndex } from "../../game/actionCatalog";
import { loadFeatureTypesFromIndex } from "../../game/featureCatalog";
import { loadReactionTypesFromIndex } from "../../game/reactionCatalog";
import type { Personnage, SpellGrantEntry } from "../../types";
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
  liveDerivedGrants?: Record<string, any>;
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
  unlockedWeaponMasteries: Array<{ id: string; label: string }>;
  unlockedFightingStyles: Array<{ id: string; label: string }>;
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
    liveDerivedGrants,
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
    unlockedWeaponMasteries,
    unlockedFightingStyles,
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
  const [derivedDetailModal, setDerivedDetailModal] = useState<{
    title: string;
    payload: unknown;
  } | null>(null);
  const featureById = useMemo(() => {
    const map = new Map<string, any>();
    loadFeatureTypesFromIndex().forEach(feature => {
      if (!feature?.id) return;
      map.set(String(feature.id), feature);
    });
    return map;
  }, []);
  const featureLabelById = useMemo(() => {
    const map = new Map<string, string>();
    featureById.forEach(feature => {
      if (!feature?.id) return;
      map.set(String(feature.id), String(feature.label ?? feature.id));
    });
    return map;
  }, [featureById]);
  const actionById = useMemo(() => {
    const map = new Map<string, any>();
    loadActionTypesFromIndex().forEach(action => {
      if (!action?.id) return;
      map.set(String(action.id), action);
    });
    return map;
  }, []);
  const actionLabelById = useMemo(() => {
    const map = new Map<string, string>();
    actionById.forEach((action, id) => {
      map.set(String(id), String(action?.name ?? id));
    });
    return map;
  }, [actionById]);
  const reactionById = useMemo(() => {
    const map = new Map<string, any>();
    loadReactionTypesFromIndex().forEach(reaction => {
      if (!reaction?.id) return;
      map.set(String(reaction.id), reaction);
    });
    return map;
  }, []);
  const reactionLabelById = useMemo(() => {
    const map = new Map<string, string>();
    reactionById.forEach((reaction, id) => {
      map.set(String(id), String(reaction?.name ?? id));
    });
    return map;
  }, [reactionById]);
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
                  const backgroundSkillLabels = getBackgroundSkillProficiencies(activeBackground)
                    .map(id => competenceOptions.find(c => c.id === id)?.label ?? id);
                  const backgroundToolLabels = getBackgroundToolProficiencies(activeBackground)
                    .map(id => toolMasteryOptions.find(t => t.id === id)?.label ?? id);
                  const backgroundChoiceToolLabels = backgroundTools
                    .map(id => toolMasteryOptions.find(t => t.id === id)?.label ?? id)
                    .filter(Boolean);
                  const backgroundChoiceLanguageLabels = backgroundLanguages.filter(Boolean);
                  const derivedGrants = ((liveDerivedGrants ?? (character as any)?.derived?.grants ?? {}) as Record<string, any>);
                  const derivedFeatures = Array.isArray(derivedGrants.features) ? derivedGrants.features : [];
                  const derivedActions = Array.isArray(derivedGrants.actions) ? derivedGrants.actions : [];
                  const derivedReactions = Array.isArray(derivedGrants.reactions) ? derivedGrants.reactions : [];
                  const derivedResources = Array.isArray(derivedGrants.resources) ? derivedGrants.resources : [];
                  const derivedPassifs = Array.isArray(derivedGrants.passifs) ? derivedGrants.passifs : [];
                  const derivedSpells = Array.isArray(derivedGrants.spells) ? derivedGrants.spells : [];
                  const derivedWeaponMasteries = Array.isArray(derivedGrants.weaponMasteries)
                    ? derivedGrants.weaponMasteries
                    : [];
                  const resolveFeatureBucket = (featureId: string) => {
                    const feature = featureById.get(featureId);
                    const tags = Array.isArray((feature as any)?.tags)
                      ? ((feature as any).tags as string[]).map(tag => String(tag).toLowerCase())
                      : [];
                    const tagToBucket: Record<string, "styles" | "resources" | "passifs" | "actions" | "reactions" | "spells" | "weaponMasteries"> = {
                      "fighting-style": "styles",
                      "resource": "resources",
                      "resources": "resources",
                      "ressource": "resources",
                      "ressources": "resources",
                      "passif": "passifs",
                      "passifs": "passifs",
                      "passive": "passifs",
                      "passives": "passifs",
                      "action": "actions",
                      "actions": "actions",
                      "reaction": "reactions",
                      "reactions": "reactions",
                      "spell": "spells",
                      "spells": "spells",
                      "spellcasting": "spells",
                      "weapon-mastery": "weaponMasteries",
                      "weaponmastery": "weaponMasteries",
                      "wm": "weaponMasteries"
                    };
                    for (const tag of tags) {
                      const bucket = tagToBucket[tag];
                      if (bucket) return bucket;
                    }
                    if (featureId.startsWith("fighting-style-")) return "styles";
                    return "features";
                  };
                  const featureBuckets = derivedFeatures
                    .map(id => String(id))
                    .filter(Boolean)
                    .reduce(
                      (acc, featureId) => {
                        const bucket = resolveFeatureBucket(featureId);
                        if (!acc[bucket].includes(featureId)) acc[bucket].push(featureId);
                        return acc;
                      },
                      {
                        features: [] as string[],
                        styles: [] as string[],
                        resources: [] as string[],
                        passifs: [] as string[],
                        actions: [] as string[],
                        reactions: [] as string[],
                        spells: [] as string[],
                        weaponMasteries: [] as string[]
                      }
                    );
                  const uncategorizedFeatureIds = featureBuckets.features;
                  const derivedStyleFeatureIds = featureBuckets.styles;
                  const derivedStyleEntries = Array.from(
                    new Set(
                      derivedStyleFeatureIds.map(
                        id => String(id)
                      )
                    )
                  )
                    .filter(id => id !== "fighting-style")
                    .map(id => ({
                      id,
                      label:
                        featureLabelById.get(id) ??
                        unlockedFightingStyles.find(entry => entry.id === id)?.label ??
                        id,
                      payload: featureById.get(id) ?? { id, error: "feature introuvable dans le catalogue" }
                    }));
                  const weaponMasteryLabelById = new Map(
                    unlockedWeaponMasteries.map(entry => [String(entry.id), String(entry.label)] as const)
                  );
                  const derivedWeaponMasteryEntries = Array.from(
                    new Set(
                      derivedWeaponMasteries
                        .map(id => String(id))
                        .filter(Boolean)
                    )
                  ).map(id => {
                    const linkedActionId = `wm-${id}`;
                    const linkedAction = actionById.get(linkedActionId) ?? null;
                    const masteryFeature = featureById.get("weapon-mastery") ?? null;
                    const masteryChoices = Array.isArray((masteryFeature as any)?.rules?.choices)
                      ? ((masteryFeature as any).rules.choices as Array<any>)
                      : [];
                    const masteryOption = masteryChoices
                      .flatMap(choice => (Array.isArray(choice?.options) ? choice.options : []))
                      .find(option => String(option?.id ?? "") === id) ?? null;
                    return {
                      id,
                      label: weaponMasteryLabelById.get(id) ?? id,
                      payload: {
                        id,
                        label: weaponMasteryLabelById.get(id) ?? id,
                        sourceFeature: masteryFeature,
                        masteryOption,
                        linkedActionId,
                        linkedAction
                      }
                    };
                  });
                  const progressionSpellSourceKinds = ["class:", "subclass:", "race:", "background:", "feature:", "feat:"];
                  const selectedProgressionSpellIds = Array.from(
                    new Set(
                      Object.entries(spellcastingSelections)
                        .filter(([sourceKey]) =>
                          progressionSpellSourceKinds.some(prefix =>
                            String(sourceKey).toLowerCase().startsWith(prefix)
                          )
                        )
                        .flatMap(([, selection]) => {
                          const known = Array.isArray(selection?.knownSpells) ? selection.knownSpells : [];
                          const prepared = Array.isArray(selection?.preparedSpells) ? selection.preparedSpells : [];
                          const granted = Array.isArray(selection?.grantedSpells) ? selection.grantedSpells : [];
                          return [...known, ...prepared, ...granted]
                            .map(entry => getSpellId(entry))
                            .map(id => String(id))
                            .filter(Boolean);
                        })
                    )
                  );
                  const imposedProgressionSpellIds = Array.from(
                    new Set(
                      Object.entries(spellcastingSelections)
                        .filter(([sourceKey]) =>
                          progressionSpellSourceKinds.some(prefix =>
                            String(sourceKey).toLowerCase().startsWith(prefix)
                          )
                        )
                        .flatMap(([, selection]) => {
                          const granted = Array.isArray(selection?.grantedSpells) ? selection.grantedSpells : [];
                          return granted
                            .map(entry => getSpellId(entry))
                            .map(id => String(id))
                            .filter(Boolean);
                        })
                    )
                  );
                  const imposedSpellIds = Array.from(
                    new Set([
                      ...derivedSpells.map(id => String(id)).filter(Boolean),
                      ...imposedProgressionSpellIds
                    ])
                  );
                  const imposedSpellSet = new Set(imposedSpellIds);
                  const chosenSpellIds = selectedProgressionSpellIds.filter(id => !imposedSpellSet.has(id));
                  const effectiveSpellIds = Array.from(new Set([...imposedSpellIds, ...chosenSpellIds]));
                  const imposedSpellEntries = imposedSpellIds.map(id => ({
                    id,
                    label: getSpellName(id),
                    payload: spellCatalog.byId.get(id) ?? { id, error: "sort introuvable dans le catalogue" }
                  }));
                  const chosenSpellEntries = chosenSpellIds.map(id => ({
                    id,
                    label: getSpellName(id),
                    payload: spellCatalog.byId.get(id) ?? { id, error: "sort introuvable dans le catalogue" }
                  }));
                  const allDerivedSpellEntries = effectiveSpellIds.map(id => ({
                    id,
                    label: getSpellName(id),
                    payload: spellCatalog.byId.get(id) ?? { id, error: "sort introuvable dans le catalogue" }
                  }));
                  const resourceEntries = Array.from(
                    new Set([
                      ...derivedResources.map(id => String(id)).filter(Boolean),
                      ...featureBuckets.resources.map(id => String(id)).filter(Boolean)
                    ])
                  ).map(id => {
                    const feature = featureById.get(id) ?? null;
                    const action = actionById.get(id) ?? null;
                    const label = featureLabelById.get(id) ?? actionLabelById.get(id) ?? id;
                    return {
                      id,
                      label,
                      payload: feature ?? action ?? { id, label, error: "ressource introuvable dans les catalogues" }
                    };
                  });
                  const passifLabels = Array.from(
                    new Set([
                      ...derivedPassifs.map(id => String(id)).filter(Boolean),
                      ...featureBuckets.passifs.map(id => featureLabelById.get(id) ?? id)
                    ])
                  );
                  const shouldShowEffectiveSpells =
                    allDerivedSpellEntries.length > 0 &&
                    imposedSpellEntries.length > 0 &&
                    chosenSpellEntries.length > 0;
                  const listFeatureActionIds = (featureId: string) => {
                    const grants = (featureById.get(featureId)?.grants ?? []) as Array<any>;
                    return grants
                      .filter(grant => String(grant?.kind ?? "").toLowerCase() === "action")
                      .flatMap(grant => (Array.isArray(grant?.ids) ? grant.ids : []))
                      .map(id => String(id))
                      .filter(Boolean);
                  };
                  const listFeatureReactionIds = (featureId: string) => {
                    const grants = (featureById.get(featureId)?.grants ?? []) as Array<any>;
                    return grants
                      .filter(grant => String(grant?.kind ?? "").toLowerCase() === "reaction")
                      .flatMap(grant => (Array.isArray(grant?.ids) ? grant.ids : []))
                      .map(id => String(id))
                      .filter(Boolean);
                  };
                  const resolveGrantLabel = (kind: string, id: string) => {
                    if (!id) return id;
                    const normalized = String(kind ?? "").toLowerCase();
                    if (normalized === "action" || normalized === "actions") return actionLabelById.get(id) ?? id;
                    if (normalized === "reaction" || normalized === "reactions") return reactionLabelById.get(id) ?? id;
                    if (normalized === "feature" || normalized === "features") return featureLabelById.get(id) ?? id;
                    if (normalized === "spell" || normalized === "spells") return spellCatalog.byId.get(id)?.name ?? id;
                    return id;
                  };
                  const getSourceLabel = (value: string) => {
                    const normalized = String(value ?? "").toLowerCase();
                    if (normalized === "class") return "Classe";
                    if (normalized === "subclass") return "Sous-classe";
                    if (normalized === "race") return "Espece";
                    if (normalized === "background") return "Historique";
                    if (normalized === "feature") return "Feature";
                    if (normalized === "item") return "Objet";
                    if (normalized === "manual") return "Manuel";
                    return value || "Source";
                  };
                  const getUsageLabel = (entry?: SpellGrantEntry | null) => {
                    const usage = entry?.usage;
                    if (!usage) return null;
                    const type = String(usage.type ?? "").toLowerCase();
                    if (type === "slot") return "slot";
                    if (type === "at-will") return "a volonte";
                    if (type === "limited" || type === "charge") {
                      if (typeof usage.remainingUses === "number" && typeof usage.maxUses === "number") {
                        return `${usage.remainingUses}/${usage.maxUses}`;
                      }
                      if (typeof usage.maxUses === "number") return `${usage.maxUses}`;
                      return type === "charge" ? "charges" : "limite";
                    }
                    return type || null;
                  };
                  const expandedDerivedActions = Array.from(
                    new Set([
                      ...derivedActions.map(id => String(id)).filter(Boolean),
                      ...derivedFeatures.flatMap(featureId => listFeatureActionIds(String(featureId)))
                    ])
                  );
                  const expandedDerivedReactions = Array.from(
                    new Set([
                      ...derivedReactions.map(id => String(id)).filter(Boolean),
                      ...derivedFeatures.flatMap(featureId => listFeatureReactionIds(String(featureId)))
                    ])
                  );
                  const toActionEntry = (id: string) => {
                    const action = actionById.get(id) ?? null;
                    return {
                      id,
                      label: actionLabelById.get(id) ?? id,
                      payload: action ?? { id, error: "action introuvable dans le catalogue" }
                    };
                  };
                  const toReactionEntry = (id: string) => {
                    const reaction = reactionById.get(id) ?? null;
                    return {
                      id,
                      label: reactionLabelById.get(id) ?? id,
                      payload: reaction ?? { id, error: "reaction introuvable dans le catalogue" }
                    };
                  };
                  const directActionEntries = derivedActions
                    .map(id => String(id))
                    .filter(Boolean)
                    .map(toActionEntry);
                  const effectiveActionEntries = expandedDerivedActions.map(toActionEntry);
                  const directReactionEntries = derivedReactions
                    .map(id => String(id))
                    .filter(Boolean)
                    .map(toReactionEntry);
                  const effectiveReactionEntries = expandedDerivedReactions.map(toReactionEntry);
                  const passifEntries = Array.from(
                    new Set([
                      ...derivedPassifs.map(id => String(id)).filter(Boolean),
                      ...featureBuckets.passifs.map(id => String(id)).filter(Boolean)
                    ])
                  ).map(id => {
                    const feature = featureById.get(id) ?? null;
                    const label = featureLabelById.get(id) ?? id;
                    return {
                      id,
                      label,
                      payload: feature ?? { id, label, error: "passif introuvable dans le catalogue" }
                    };
                  });
                  const renderDerivedChipSection = (
                    title: string,
                    entries: Array<{ id: string; label: string; payload: unknown }>,
                    style: { border: string; background: string; color: string }
                  ) => {
                    if (entries.length === 0) return null;
                    return (
                      <>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{title}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {entries.map(entry => (
                            <button
                              key={`${title}-${entry.id}`}
                              type="button"
                              onClick={() => setDerivedDetailModal({ title: entry.label, payload: entry.payload })}
                              style={{
                                borderRadius: 999,
                                border: style.border,
                                background: style.background,
                                color: style.color,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "4px 10px",
                                cursor: "pointer"
                              }}
                            >
                              {entry.label}
                            </button>
                          ))}
                        </div>
                      </>
                    );
                  };
                  const hasAnyDerivedSection =
                    uncategorizedFeatureIds.length > 0 ||
                    directActionEntries.length > 0 ||
                    effectiveActionEntries.length > 0 ||
                    directReactionEntries.length > 0 ||
                    effectiveReactionEntries.length > 0 ||
                    derivedStyleEntries.length > 0 ||
                    derivedWeaponMasteryEntries.length > 0 ||
                    resourceEntries.length > 0 ||
                    passifEntries.length > 0 ||
                    imposedSpellEntries.length > 0 ||
                    chosenSpellEntries.length > 0 ||
                    (shouldShowEffectiveSpells && allDerivedSpellEntries.length > 0);
                  const mergedSkills = Array.from(
                    new Set([...(competences ?? []), ...(expertises ?? [])])
                  );
                  const masteryWeaponLabels = weaponMasteries.filter(Boolean);
                  const masteryWeaponMasteryLabels = unlockedWeaponMasteries
                    .map(entry => entry.label)
                    .filter(Boolean);
                  const masteryFightingStyleLabels = unlockedFightingStyles
                    .map(entry => entry.label)
                    .filter(Boolean);
                  const masteryArmorLabels = armorMasteries.filter(Boolean);
                  const masteryToolLabels = toolMasteries.filter(Boolean);
                  const equippedSlotEntries = EQUIPMENT_SLOTS.filter(slot => Boolean(materielSlots[slot.id]));
                  const adaptableSkill = (choiceSelections as any)?.race?.adaptableSkill ?? "";
                  const formatAsiSuffix = (classId: string, level: number) => {
                    const key = `${classId}:${level}`;
                    const asiEntry =
                      asiSelections[key] ??
                      (classId === classPrimary?.id ? asiSelections[String(level)] : null);
                    if (asiEntry?.type === "feat") {
                      return "Don";
                    }
                    if (asiEntry?.type === "asi") {
                      const stats = asiEntry.stats ?? {};
                      const parts = Object.entries(stats)
                        .map(([stat, value]) => `+${value} ${statLabels[stat] ?? stat}`)
                        .join(", ");
                      return parts || "non choisi";
                    }
                    return "non choisi";
                  };
                  const buildProgressionLines = (
                    progression: Record<string, any> | undefined,
                    maxLevel: number,
                    sourceLabel: string,
                    classIdForAsi: string | null
                  ) => {
                    if (!progression) return [];
                    const levels = Object.keys(progression)
                      .map(key => Number(key))
                      .filter(level => Number.isFinite(level) && level > 0 && level <= maxLevel)
                      .sort((a, b) => a - b);
                    return levels.map(level => {
                      const entry = progression[String(level)] ?? {};
                      const grants = Array.isArray(entry.grants) ? entry.grants : [];
                      const desc = entry.description ? entry.description : "";
                      const grantLabels = grants
                        .map((grant: any) => {
                          const kind = String(grant?.kind ?? "").toLowerCase();
                          const ids = Array.isArray(grant?.ids)
                            ? grant.ids.map((id: unknown) => String(id)).filter(Boolean)
                            : [];
                          if (!kind || ids.length === 0) return "";
                          if (kind === "bonus" && ids.includes("asi-or-feat") && classIdForAsi) {
                            return `ASI/Don (${formatAsiSuffix(classIdForAsi, level)})`;
                          }
                          const labelByKind: Record<string, string> = {
                            feature: "Features",
                            features: "Features",
                            action: "Actions",
                            actions: "Actions",
                            reaction: "Reactions",
                            reactions: "Reactions",
                            resource: "Ressources",
                            resources: "Ressources",
                            passif: "Passifs",
                            passifs: "Passifs",
                            passive: "Passifs",
                            passives: "Passifs",
                            spell: "Sorts",
                            spells: "Sorts",
                            trait: "Traits",
                            traits: "Traits",
                            skill: "Competences",
                            skills: "Competences",
                            tool: "Outils",
                            tools: "Outils",
                            language: "Langues",
                            languages: "Langues",
                            bonus: "Bonus"
                          };
                          const resolved = ids.map(id => resolveGrantLabel(kind, id));
                          const kindLabel = labelByKind[kind] ?? kind;
                          return `${kindLabel}: ${resolved.join(", ")}`;
                        })
                        .filter(Boolean);
                      const parts = [desc, ...grantLabels].filter(Boolean);
                      const summary = parts.length > 0 ? parts.join(" | ") : "Aucun gain explicite";
                      return `Niveau ${level} — ${sourceLabel}: ${summary}`;
                    });
                  };
                  const buildClassProgressionDisplay = (
                    cls: ClassDefinition | null,
                    subclass: SubclassDefinition | null,
                    level: number
                  ) => {
                    if (!cls || level <= 0) return [];
                    const classLines = buildProgressionLines(
                      cls.progression,
                      level,
                      `Classe ${cls.label}`,
                      cls.id
                    );
                    const subclassLines = subclass
                      ? buildProgressionLines(
                          subclass.progression,
                          level,
                          `Sous-classe ${subclass.label}`,
                          cls.id
                        )
                      : [];
                    return [...classLines, ...subclassLines];
                  };
                  const primarySubclass = selectedSubclassId
                    ? subclassOptions.find(sub => sub.id === selectedSubclassId) ?? null
                    : null;
                  const secondarySubclass = selectedSecondarySubclassId
                    ? subclassOptions.find(sub => sub.id === selectedSecondarySubclassId) ?? null
                    : null;
                  const primaryLevel = Number(classEntry?.niveau) || 0;
                  const secondaryLevel = Number(secondaryClassEntry?.niveau) || 0;
                  const globalLevel = resolveLevel();
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
                  const raceProgressionLines = activeRace
                    ? buildProgressionLines(
                        (activeRace as any)?.progression,
                        globalLevel,
                        `Espece ${activeRace.label}`,
                        null
                      )
                    : [];
                  const backgroundProgressionLines = activeBackground
                    ? buildProgressionLines(
                        (activeBackground as any)?.progression,
                        globalLevel,
                        `Historique ${activeBackground.label}`,
                        null
                      )
                    : [];
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
                              const spellGrantEntries = Array.isArray(
                                (character as any)?.spellcastingState?.spellGrants?.[source.key]
                              )
                                ? (((character as any)?.spellcastingState?.spellGrants?.[
                                    source.key
                                  ] as SpellGrantEntry[]) ?? [])
                                : [];
                              const sourceUsageSummary = Array.from(
                                new Set(
                                  spellGrantEntries
                                    .map(entry => {
                                      const sourcePart = `${getSourceLabel(
                                        String(entry?.sourceType ?? "")
                                      )}${entry?.sourceId ? `:${entry.sourceId}` : ""}`;
                                      const usagePart = getUsageLabel(entry);
                                      return usagePart ? `${sourcePart} (${usagePart})` : sourcePart;
                                    })
                                    .filter(Boolean)
                                )
                              );
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
                                  {sourceUsageSummary.length > 0 && (
                                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                                      Provenance/usage: {sourceUsageSummary.join(" | ")}
                                    </div>
                                  )}
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
                        {raceProgressionLines.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            Progression (niveau global {globalLevel}):
                            {raceProgressionLines.map(line => (
                              <div key={`prog-race-${line}`} style={{ marginTop: 4 }}>
                                {line}
                              </div>
                            ))}
                          </div>
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
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Historique
                          {renderValidatedBadge(getSectionValidated("backgrounds"))}
                        </div>
                        {activeBackground && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                            {`${activeBackground.label} (${activeBackground.id})`}
                          </div>
                        )}
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
                        {backgroundSkillLabels.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            Competences: {backgroundSkillLabels.join(", ")}
                          </div>
                        )}
                        {backgroundToolLabels.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            Outils: {backgroundToolLabels.join(", ")}
                          </div>
                        )}
                        {backgroundChoiceToolLabels.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            Choix outils: {backgroundChoiceToolLabels.join(", ")}
                          </div>
                        )}
                        {backgroundChoiceLanguageLabels.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            Choix langues: {backgroundChoiceLanguageLabels.join(", ")}
                          </div>
                        )}
                        {backgroundProgressionLines.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            Progression (niveau global {globalLevel}):
                            {backgroundProgressionLines.map(line => (
                              <div key={`prog-bg-${line}`} style={{ marginTop: 4 }}>
                                {line}
                              </div>
                            ))}
                          </div>
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
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", fontWeight: 700 }}>
                          Features derivees
                        </div>
                        {uncategorizedFeatureIds.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8
                            }}
                          >
                            {uncategorizedFeatureIds.map(id => {
                              const featureId = String(id);
                              const label = featureLabelById.get(featureId) ?? featureId;
                              const payload = featureById.get(featureId) ?? {
                                id: featureId,
                                error: "feature introuvable dans le catalogue"
                              };
                              return (
                                <button
                                  key={`derived-feature-${featureId}`}
                                  type="button"
                                  onClick={() =>
                                    setDerivedDetailModal({
                                      title: label,
                                      payload
                                    })
                                  }
                                  style={{
                                    borderRadius: 999,
                                    border: "1px solid rgba(79,125,242,0.6)",
                                    background: "rgba(79,125,242,0.2)",
                                    color: "#d9e7ff",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "4px 10px",
                                    cursor: "pointer"
                                  }}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {renderDerivedChipSection(
                          "Actions derivees (directes):",
                          directActionEntries,
                          {
                            border: "1px solid rgba(80,170,255,0.6)",
                            background: "rgba(80,170,255,0.2)",
                            color: "#d9eeff"
                          }
                        )}
                        {renderDerivedChipSection(
                          "Actions effectives (avec features):",
                          effectiveActionEntries,
                          {
                            border: "1px solid rgba(67,140,224,0.6)",
                            background: "rgba(67,140,224,0.22)",
                            color: "#d7e8ff"
                          }
                        )}
                        {renderDerivedChipSection(
                          "Reactions derivees (directes):",
                          directReactionEntries,
                          {
                            border: "1px solid rgba(236,112,99,0.6)",
                            background: "rgba(236,112,99,0.2)",
                            color: "#ffe1dc"
                          }
                        )}
                        {renderDerivedChipSection(
                          "Reactions effectives (avec features):",
                          effectiveReactionEntries,
                          {
                            border: "1px solid rgba(205,97,85,0.6)",
                            background: "rgba(205,97,85,0.22)",
                            color: "#ffe1dc"
                          }
                        )}
                        {renderDerivedChipSection(
                          "Styles de combat derives:",
                          derivedStyleEntries,
                          {
                            border: "1px solid rgba(46,204,113,0.6)",
                            background: "rgba(46,204,113,0.18)",
                            color: "#ddffe9"
                          }
                        )}
                        {renderDerivedChipSection(
                          "Bottes d'armes derivees:",
                          derivedWeaponMasteryEntries,
                          {
                            border: "1px solid rgba(241,196,15,0.65)",
                            background: "rgba(241,196,15,0.2)",
                            color: "#fff2c2"
                          }
                        )}
                        {renderDerivedChipSection(
                          "Ressources derivees:",
                          resourceEntries,
                          {
                            border: "1px solid rgba(52,152,219,0.6)",
                            background: "rgba(52,152,219,0.2)",
                            color: "#d8efff"
                          }
                        )}
                        {renderDerivedChipSection(
                          "Passifs derives:",
                          passifEntries,
                          {
                            border: "1px solid rgba(149,165,166,0.65)",
                            background: "rgba(149,165,166,0.2)",
                            color: "#eef4f4"
                          }
                        )}
                        {allDerivedSpellEntries.length > 0 && (
                          <>
                            {renderDerivedChipSection(
                              "Sorts derives (imposes):",
                              imposedSpellEntries,
                              {
                                border: "1px solid rgba(155,89,182,0.6)",
                                background: "rgba(155,89,182,0.22)",
                                color: "#f1dcff"
                              }
                            )}
                            {renderDerivedChipSection(
                              "Sorts derives (choisis):",
                              chosenSpellEntries,
                              {
                                border: "1px solid rgba(142,68,173,0.6)",
                                background: "rgba(142,68,173,0.22)",
                                color: "#f1dcff"
                              }
                            )}
                            {shouldShowEffectiveSpells &&
                              renderDerivedChipSection(
                                "Sorts derives (effectifs):",
                                allDerivedSpellEntries,
                                {
                                  border: "1px solid rgba(108,52,131,0.6)",
                                  background: "rgba(108,52,131,0.24)",
                                  color: "#f1dcff"
                                }
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
                        {mergedSkills.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                            {mergedSkills.map(id => {
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
                            }).join(", ")}
                          </div>
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
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Maitrises
                          {renderValidatedBadge(getSectionValidated("masteries"))}
                        </div>
                        {masteryWeaponLabels.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                            Armes: {masteryWeaponLabels.join(", ")}
                          </div>
                        )}
                        {masteryWeaponMasteryLabels.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                            Bottes d'armes: {masteryWeaponMasteryLabels.join(", ")}
                          </div>
                        )}
                        {masteryFightingStyleLabels.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                            Styles de combat: {masteryFightingStyleLabels.join(", ")}
                          </div>
                        )}
                        {masteryArmorLabels.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                            Armures: {masteryArmorLabels.join(", ")}
                          </div>
                        )}
                        {masteryToolLabels.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            Outils: {masteryToolLabels.join(", ")}
                          </div>
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
                        <div style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                          Materiel
                          {renderValidatedBadge(getSectionValidated("equip"))}
                        </div>
                        {equippedSlotEntries.length > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            {equippedSlotEntries.map(slot => (
                              <div key={`slot-${slot.id}`} style={{ marginTop: 4 }}>
                                {slot.label}: {formatEquipmentLabel(String(materielSlots[slot.id]))}
                              </div>
                            ))}
                          </div>
                        )}
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
              {derivedDetailModal && (
                <div
                  onClick={() => setDerivedDetailModal(null)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(3, 6, 12, 0.65)",
                    display: "grid",
                    placeItems: "center",
                    zIndex: 60,
                    padding: 16
                  }}
                >
                  <div
                    onClick={event => event.stopPropagation()}
                    style={{
                      width: "min(680px, 96vw)",
                      maxHeight: "82vh",
                      overflow: "auto",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "#0d1220",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
                      padding: 12
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        gap: 8
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#d9e7ff" }}>
                        {derivedDetailModal.title}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDerivedDetailModal(null)}
                        style={{
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.24)",
                          background: "rgba(255,255,255,0.08)",
                          color: "#f5f7ff",
                          fontSize: 12,
                          padding: "4px 8px",
                          cursor: "pointer"
                        }}
                      >
                        Fermer
                      </button>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 11,
                        lineHeight: 1.45,
                        color: "#e7ecff",
                        background: "rgba(6,10,18,0.9)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        padding: 10,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere"
                      }}
                    >
                      {JSON.stringify(
                        derivedDetailModal.payload,
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              )}
</>
  );
}
