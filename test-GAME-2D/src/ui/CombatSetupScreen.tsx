import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Personnage } from "../types";
import type { WeaponTypeDefinition } from "../game/weaponTypes";
import type { RaceDefinition } from "../game/raceTypes";
import type { ClassDefinition, SubclassDefinition } from "../game/classTypes";
import type { BackgroundDefinition } from "../game/backgroundTypes";
import type { LanguageDefinition } from "../game/languageTypes";
import type { ToolItemDefinition } from "../game/toolTypes";
import type { ObjectItemDefinition } from "../game/objectTypes";
import type { ArmorItemDefinition } from "../game/armorTypes";

export function CombatSetupScreen(props: {
  configEnemyCount: number;
  enemyTypeCount: number;
  gridCols: number;
  gridRows: number;
  mapPrompt: string;
  character: Personnage;
  weaponTypes: WeaponTypeDefinition[];
  raceTypes: RaceDefinition[];
  classTypes: ClassDefinition[];
  subclassTypes: SubclassDefinition[];
  backgroundTypes: BackgroundDefinition[];
  languageTypes: LanguageDefinition[];
  toolItems: ToolItemDefinition[];
  objectItems: ObjectItemDefinition[];
  armorItems: ArmorItemDefinition[];
  onChangeCharacter: (next: Personnage) => void;
  onChangeMapPrompt: (value: string) => void;
  onChangeEnemyCount: (value: number) => void;
  onStartCombat: () => void;
  onNoEnemyTypes: () => void;
}): React.JSX.Element {
  const [activeMainTab, setActiveMainTab] = useState<"map" | "player">("map");
  const [activePlayerTab, setActivePlayerTab] = useState<
    | "species"
    | "backgrounds"
    | "profile"
    | "stats"
    | "classes"
    | "equip"
    | "skills"
    | "masteries"
  >("species");
  const [activeClassTab, setActiveClassTab] = useState<"primary" | "secondary">("primary");
  const [equipSubTab, setEquipSubTab] = useState<"slots" | "loot">("slots");
  const [equipMessage, setEquipMessage] = useState<string | null>(null);
  const [statsMode, setStatsMode] = useState<"normal" | "manual">("normal");
  const [skillsMode, setSkillsMode] = useState<"normal" | "manual">("normal");
  const [masteriesMode, setMasteriesMode] = useState<"normal" | "manual">("normal");
  const weaponOptions = useMemo(() => {
    const list = Array.isArray(props.weaponTypes) ? [...props.weaponTypes] : [];
    list.sort((a, b) => {
      const sa = `${a.subtype}:${a.name}`.toLowerCase();
      const sb = `${b.subtype}:${b.name}`.toLowerCase();
      return sa.localeCompare(sb);
    });
    return list;
  }, [props.weaponTypes]);
  const raceOptions = useMemo(() => {
    const list = Array.isArray(props.raceTypes) ? [...props.raceTypes] : [];
    list.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    return list;
  }, [props.raceTypes]);
  const selectedRaceId = (props.character as any)?.raceId ?? "";
  const backgroundOptions = useMemo(() => {
    const list = Array.isArray(props.backgroundTypes) ? [...props.backgroundTypes] : [];
    list.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    return list;
  }, [props.backgroundTypes]);
  const selectedBackgroundId = (props.character as any)?.backgroundId ?? "";
  const toolItems = Array.isArray(props.toolItems) ? props.toolItems : [];
  const objectItems = Array.isArray(props.objectItems) ? props.objectItems : [];
  const armorItems = Array.isArray(props.armorItems) ? props.armorItems : [];
  const languageOptions = useMemo(() => {
    const list = Array.isArray(props.languageTypes) ? [...props.languageTypes] : [];
    list.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    return list;
  }, [props.languageTypes]);
  const creationLocks = ((props.character as any)?.creationLocks ?? {}) as Record<string, boolean>;
  const isSectionLocked = (id: string) => {
    if (id === "classes") return Boolean((props.character as any)?.classLock);
    return Boolean(creationLocks?.[id]);
  };
  const setSectionLock = (id: string, value: boolean) => {
    const nextLocks = { ...creationLocks, [id]: value };
    props.onChangeCharacter({ ...props.character, creationLocks: nextLocks });
  };
  const toggleSectionLock = (id: string) => {
    setSectionLock(id, !creationLocks?.[id]);
  };
  const classOptions = useMemo(() => {
    const list = Array.isArray(props.classTypes) ? [...props.classTypes] : [];
    list.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    return list;
  }, [props.classTypes]);
  const subclassOptions = useMemo(() => {
    return Array.isArray(props.subclassTypes) ? [...props.subclassTypes] : [];
  }, [props.subclassTypes]);
  const classEntry = (props.character as any)?.classe?.[1] ?? null;
  const secondaryClassEntry = (props.character as any)?.classe?.[2] ?? null;
  const selectedClassId = classEntry?.classeId ?? "";
  const selectedSubclassId = classEntry?.subclasseId ?? "";
  const selectedSecondaryClassId = secondaryClassEntry?.classeId ?? "";
  const selectedSecondarySubclassId = secondaryClassEntry?.subclasseId ?? "";
  const isClassLocked = Boolean((props.character as any)?.classLock);
  const activeRace = raceOptions.find(race => race.id === selectedRaceId) ?? null;
  const activeBackground =
    backgroundOptions.find(bg => bg.id === selectedBackgroundId) ?? null;
  const profileDetails = ((props.character as any)?.profileDetails ?? {}) as Record<string, string>;
  const classPrimary = classOptions.find(cls => cls.id === selectedClassId) ?? null;
  const classSecondary = classOptions.find(cls => cls.id === selectedSecondaryClassId) ?? null;
  const choiceSelections = ((props.character as any)?.choiceSelections ?? {}) as Record<string, any>;
  const equipmentAuto = Array.isArray((props.character as any)?.equipmentAuto)
    ? ((props.character as any).equipmentAuto as string[])
    : [];
  const equipmentManual = Array.isArray((props.character as any)?.equipmentManual)
    ? ((props.character as any).equipmentManual as string[])
    : [];
  const inventoryItems = Array.isArray((props.character as any)?.inventoryItems)
    ? ((props.character as any).inventoryItems as Array<any>)
    : [];
  const objectItemMap = useMemo(() => {
    const map = new Map<string, ObjectItemDefinition>();
    for (const item of objectItems) map.set(item.id, item);
    return map;
  }, [objectItems]);
  const toolItemMap = useMemo(() => {
    const map = new Map<string, ToolItemDefinition>();
    for (const item of toolItems) map.set(item.id, item);
    return map;
  }, [toolItems]);
  const armorItemMap = useMemo(() => {
    const map = new Map<string, ArmorItemDefinition>();
    for (const item of armorItems) map.set(item.id, item);
    return map;
  }, [armorItems]);
  const weaponItemMap = useMemo(() => {
    const map = new Map<string, WeaponTypeDefinition>();
    for (const item of weaponOptions) map.set(item.id, item);
    return map;
  }, [weaponOptions]);
  const inventoryInitRef = useRef(false);
  const pendingLocks = ((choiceSelections as any)?.pendingLocks ?? {}) as Record<string, boolean>;
  const competences = Array.isArray(props.character?.competences)
    ? (props.character.competences as string[])
    : [];
  const expertises = Array.isArray((props.character as any)?.expertises)
    ? ((props.character as any).expertises as string[])
    : [];
  const profs = (props.character?.proficiencies ?? {}) as {
    weapons?: string[];
    armors?: string[];
    tools?: string[];
  };
  const weaponMasteries = Array.isArray(profs.weapons) ? profs.weapons : [];
  const armorMasteries = Array.isArray(profs.armors) ? profs.armors : [];
  const toolMasteries = Array.isArray(profs.tools) ? profs.tools : [];
  const DEFAULT_MATERIEL_SLOTS: Record<string, string | null> = {
    corps: null,
    tete: null,
    gants: null,
    bottes: null,
    ceinture_gauche: null,
    ceinture_droite: null,
    dos_gauche: null,
    dos_droit: null,
    anneau_1: null,
    anneau_2: null,
    collier: null,
    bijou_1: null,
    bijou_2: null,
    paquetage: null
  };
  const materielSlots = useMemo(() => {
    const current = props.character?.materielSlots ?? {};
    return { ...DEFAULT_MATERIEL_SLOTS, ...(current as Record<string, any>) };
  }, [props.character?.materielSlots]);
  const EQUIPMENT_SLOTS: Array<{
    id: string;
    label: string;
    accepts: string[];
    requiresClothingBody?: boolean;
  }> = [
    { id: "corps", label: "Corps (armure ou vetement)", accepts: ["armor_body", "clothing_body"] },
    {
      id: "tete",
      label: "Tete (vetement)",
      accepts: ["clothing_head"],
      requiresClothingBody: true
    },
    {
      id: "gants",
      label: "Gants (vetement)",
      accepts: ["clothing_gloves"],
      requiresClothingBody: true
    },
    {
      id: "bottes",
      label: "Bottes (vetement)",
      accepts: ["clothing_boots"],
      requiresClothingBody: true
    },
    {
      id: "ceinture_gauche",
      label: "Ceinture gauche",
      accepts: ["weapon_short", "weapon_long", "weapon_ranged", "shield"]
    },
    {
      id: "ceinture_droite",
      label: "Ceinture droite",
      accepts: ["weapon_short", "weapon_long", "weapon_ranged", "shield"]
    },
    {
      id: "dos_gauche",
      label: "Dos gauche",
      accepts: ["weapon_long", "weapon_ranged", "shield"]
    },
    {
      id: "dos_droit",
      label: "Dos droit",
      accepts: ["weapon_long", "weapon_ranged", "shield"]
    },
    { id: "anneau_1", label: "Anneau 1", accepts: ["ring"] },
    { id: "anneau_2", label: "Anneau 2", accepts: ["ring"] },
    { id: "collier", label: "Collier", accepts: ["necklace"] },
    { id: "bijou_1", label: "Bijou 1", accepts: ["jewel"] },
    { id: "bijou_2", label: "Bijou 2", accepts: ["jewel"] },
    { id: "paquetage", label: "Paquetage (sac)", accepts: ["pack"] }
  ];
  const weaponCarrySlots = useMemo(
    () => new Set(["ceinture_gauche", "ceinture_droite", "dos_gauche", "dos_droit"]),
    []
  );
  const clothingSubSlots = useMemo(() => new Set(["tete", "gants", "bottes"]), []);
  const humanizeId = (value: string) => {
    const cleaned = value
      .replace(/^obj_/, "")
      .replace(/^weapon_/, "")
      .replace(/^armor_/, "")
      .replace(/^tool_/, "")
      .replace(/[_-]+/g, " ")
      .trim();
    return cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : value;
  };
  const getItemLabel = (item: any) => {
    const fallback = humanizeId(item?.id ?? "item");
    if (item?.type === "object") return objectItemMap.get(item.id)?.label ?? fallback;
    if (item?.type === "armor") return armorItemMap.get(item.id)?.label ?? fallback;
    if (item?.type === "tool") return toolItemMap.get(item.id)?.label ?? fallback;
    if (item?.type === "weapon") return weaponItemMap.get(item.id)?.name ?? fallback;
    return fallback;
  };
  const getWeaponCategories = (weapon?: WeaponTypeDefinition | null) => {
    if (!weapon) return [];
    const categories = new Set<string>();
    const props = weapon.properties ?? {};
    if (props.two_handed || props.heavy) {
      categories.add("weapon_long");
    } else if (props.light) {
      categories.add("weapon_short");
    } else {
      categories.add("weapon_long");
    }
    if (weapon.category === "distance" || props.ammunition) {
      categories.add("weapon_ranged");
    }
    return Array.from(categories);
  };
  const getItemCategories = (item: any) => {
    if (!item) return [];
    if (item.type === "object") {
      const def = objectItemMap.get(item.id);
      return def?.category ? [def.category] : [];
    }
    if (item.type === "armor") {
      const def = armorItemMap.get(item.id);
      return def?.category ? [def.category] : [];
    }
    if (item.type === "weapon") {
      const def = weaponItemMap.get(item.id);
      return getWeaponCategories(def);
    }
    if (item.type === "tool") {
      return ["tool"];
    }
    return [];
  };
  const getItemWeight = (item: any) => {
    if (!item) return 0;
    if (item.type === "object") return objectItemMap.get(item.id)?.weight ?? 0;
    if (item.type === "armor") return armorItemMap.get(item.id)?.weight ?? 0;
    if (item.type === "weapon") return weaponItemMap.get(item.id)?.weight ?? 0;
    if (item.type === "tool") return toolItemMap.get(item.id)?.weight ?? 0;
    return 0;
  };
  const getBagId = () => (materielSlots?.paquetage as string | null) ?? null;
  const getBagCapacity = (bagId: string | null) => {
    if (!bagId) return 0;
    const bag = objectItemMap.get(bagId);
    return bag?.capacityWeight ?? 0;
  };
  const getStoredWeight = (bagId: string | null) => {
    if (!bagId) return 0;
    return inventoryItems.reduce((sum, item) => {
      if (item?.storedIn !== bagId) return sum;
      return sum + getItemWeight(item) * (Number(item?.qty ?? 1) || 1);
    }, 0);
  };
  const getBodyCategory = () => {
    const bodyId = materielSlots?.corps;
    if (!bodyId) return null;
    const item = inventoryItems.find(entry => entry.id === bodyId && entry.equippedSlot === "corps");
    const categories = getItemCategories(item);
    return categories.length > 0 ? categories[0] : null;
  };
  const canUseClothingPieces = getBodyCategory() === "clothing_body";
  const slotGroups = useMemo(
    () => ({
      body: ["corps", "tete", "gants", "bottes"],
      weapons: ["ceinture_gauche", "ceinture_droite", "dos_gauche", "dos_droit"],
      jewelry: ["anneau_1", "anneau_2", "collier", "bijou_1", "bijou_2"],
      bag: ["paquetage"]
    }),
    []
  );
  const getEligibleItemsForSlot = (slotId: string) => {
    const slotDef = EQUIPMENT_SLOTS.find(s => s.id === slotId);
    if (!slotDef) return [];
    if (slotDef.requiresClothingBody && !canUseClothingPieces) return [];
    return inventoryItems
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        const categories = getItemCategories(item);
        return categories.some(cat => slotDef.accepts.includes(cat));
      });
  };
  const bagId = getBagId();
  const bagCapacity = getBagCapacity(bagId);
  const storedWeight = getStoredWeight(bagId);
  const slotItemIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    inventoryItems.forEach((item, idx) => {
      if (item?.equippedSlot) map.set(item.equippedSlot, idx);
    });
    return map;
  }, [inventoryItems]);
  const renderSlotGroup = (slotIds: string[], title: string, note?: string) => (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(12,12,18,0.75)",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700 }}>{title}</div>
      {note && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{note}</div>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 8
        }}
      >
        {slotIds.map(slotId => {
          const slot = EQUIPMENT_SLOTS.find(entry => entry.id === slotId);
          if (!slot) return null;
          const currentIndex = slotItemIndexMap.get(slot.id);
          const eligible = getEligibleItemsForSlot(slot.id);
          const disabled =
            isSectionLocked("equip") ||
            (slot.requiresClothingBody && !canUseClothingPieces);
          return (
            <label
              key={slot.id}
              style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span style={{ color: disabled ? "rgba(255,255,255,0.4)" : "#f5f5f5" }}>
                {slot.label}
              </span>
              <select
                value={typeof currentIndex === "number" ? String(currentIndex) : ""}
                onChange={event => {
                  const value = event.target.value;
                  if (!value) {
                    if (typeof currentIndex === "number") {
                      updateItemSlot(currentIndex, null);
                    }
                    return;
                  }
                  updateItemSlot(Number(value), slot.id);
                }}
                disabled={disabled}
                style={{
                  background: "#0f0f19",
                  color: "#f5f5f5",
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 12,
                  opacity: disabled ? 0.6 : 1
                }}
              >
                <option value="">Vide</option>
                {eligible.map(({ item, idx }) => (
                  <option key={`slot-${slot.id}-${idx}`} value={String(idx)}>
                    {getItemLabel(item)}
                  </option>
                ))}
              </select>
              {slot.requiresClothingBody && !canUseClothingPieces && (
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                  Requiert un vetement au corps
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );

  const setNameField = (key: "prenom" | "nomcomplet" | "surnom", value: string) => {
    const nextNom = {
      ...(props.character.nom ?? {}),
      [key]: value
    };
    props.onChangeCharacter({ ...props.character, nom: nextNom });
  };

  const setProfileDetail = (key: string, value: string) => {
    const nextProfileDetails = { ...profileDetails, [key]: value };
    props.onChangeCharacter({ ...props.character, profileDetails: nextProfileDetails });
  };

  const setPhysiqueDetail = (value: string) => {
    const nextDesc = {
      ...(props.character.descriptionPersonnage ?? {}),
      physique: value
    };
    props.onChangeCharacter({ ...props.character, descriptionPersonnage: nextDesc });
  };

  const toggleListValue = (list: string[], value: string): string[] => {
    if (list.includes(value)) return list.filter(item => item !== value);
    return [...list, value];
  };

  const toggleCompetence = (value: string) => {
    const next = toggleListValue(competences, value);
    const nextExpertises = next.includes(value)
      ? expertises
      : expertises.filter(item => item !== value);
    props.onChangeCharacter({
      ...props.character,
      competences: next,
      expertises: nextExpertises
    });
  };

  const toggleExpertise = (value: string) => {
    if (!competences.includes(value)) return;
    const next = toggleListValue(expertises, value);
    props.onChangeCharacter({ ...props.character, expertises: next });
  };

  const toggleMastery = (kind: "weapons" | "armors" | "tools", value: string) => {
    const next = {
      weapons: kind === "weapons" ? toggleListValue(weaponMasteries, value) : weaponMasteries,
      armors: kind === "armors" ? toggleListValue(armorMasteries, value) : armorMasteries,
      tools: kind === "tools" ? toggleListValue(toolMasteries, value) : toolMasteries
    };
    props.onChangeCharacter({ ...props.character, proficiencies: next });
  };

  const resolveLevel = (): number => {
    const combatLevel = Number(props.character?.combatStats?.level);
    if (Number.isFinite(combatLevel) && combatLevel > 0) return combatLevel;
    const globalLevel = Number((props.character as any)?.niveauGlobal);
    if (Number.isFinite(globalLevel) && globalLevel > 0) return globalLevel;
    const classLevel = Number((props.character as any)?.classe?.[1]?.niveau);
    if (Number.isFinite(classLevel) && classLevel > 0) return classLevel;
    return 1;
  };
  const resolvedClassTab = resolveLevel() > 2 ? activeClassTab : "primary";

  const setLevel = (nextLevelRaw: number) => {
    const nextLevel = Math.max(1, Math.min(20, Math.floor(nextLevelRaw || 1)));
    const nextCombatStats = {
      ...(props.character.combatStats ?? {}),
      level: nextLevel
    };
    const currentClasse =
      props.character?.classe && typeof props.character.classe === "object"
        ? (props.character.classe as any)
        : {};
    const hasSecondary = Boolean(currentClasse?.[2]);
    let nextClasse = { ...currentClasse };
    if (hasSecondary && nextLevel > 2) {
      const primaryLevel = Number(currentClasse?.[1]?.niveau) || 1;
      const clampedPrimary = Math.max(1, Math.min(nextLevel - 1, primaryLevel));
      const secondaryLevel = Math.max(1, nextLevel - clampedPrimary);
      nextClasse = {
        ...nextClasse,
        1: { ...(nextClasse?.[1] ?? {}), niveau: clampedPrimary },
        2: { ...(nextClasse?.[2] ?? {}), niveau: secondaryLevel }
      };
    } else {
      nextClasse = {
        ...nextClasse,
        1: { ...(nextClasse?.[1] ?? {}), niveau: nextLevel }
      };
      if (nextClasse?.[2]) {
        delete nextClasse[2];
      }
    }
    props.onChangeCharacter({
      ...props.character,
      niveauGlobal: nextLevel,
      classe: nextClasse,
      combatStats: nextCombatStats
    });
    if (nextLevel <= 2) {
      setActiveClassTab("primary");
    }
  };

  const setClassSelection = (cls: ClassDefinition, slot: 1 | 2) => {
    const current = (props.character as any)?.classe ?? {};
    const existingLevel = Number(current?.[slot]?.niveau);
    const fallbackLevel = slot === 1 ? resolveLevel() : 1;
    const nextLevel =
      Number.isFinite(existingLevel) && existingLevel > 0 ? existingLevel : fallbackLevel;
    const currentProfs = (props.character?.proficiencies ?? {}) as {
      weapons?: string[];
      armors?: string[];
      tools?: string[];
    };
    const nextProfs = {
      weapons: Array.from(
        new Set([...(currentProfs.weapons ?? []), ...(cls.proficiencies?.weapons ?? [])])
      ),
      armors: Array.from(
        new Set([...(currentProfs.armors ?? []), ...(cls.proficiencies?.armors ?? [])])
      ),
      tools: Array.from(
        new Set([...(currentProfs.tools ?? []), ...(cls.proficiencies?.tools ?? [])])
      )
    };
    const nextEntry = {
      ...(current?.[slot] ?? {}),
      classeId: cls.id,
      subclasseId: null,
      niveau: nextLevel
    };
    const nextClasse = { ...current, [slot]: nextEntry };
    props.onChangeCharacter({
      ...props.character,
      classe: nextClasse,
      proficiencies: nextProfs
    });
  };

  const setSubclassSelection = (subclassId: string, slot: 1 | 2) => {
    const current = (props.character as any)?.classe ?? {};
    const nextEntry = {
      ...(current?.[slot] ?? {}),
      subclasseId: subclassId,
      niveau: slot === 1 ? resolveLevel() : Math.max(1, Number(current?.[slot]?.niveau) || 1)
    };
    const nextClasse = { ...current, [slot]: nextEntry };
    props.onChangeCharacter({ ...props.character, classe: nextClasse });
  };

  const setClassLevel = (slot: 1 | 2, nextLevelRaw: number) => {
    const globalLevel = resolveLevel();
    const current = (props.character as any)?.classe ?? {};
    if (slot === 1 && !current?.[1]) return;
    if (slot === 2 && !current?.[2]) return;
    if (slot === 2 && globalLevel <= 2) return;
    const otherSlot = slot === 1 ? 2 : 1;
    const hasSecondary = Boolean(current?.[2]);
    if (!hasSecondary) {
      const nextClasse = {
        ...current,
        1: { ...(current?.[1] ?? {}), niveau: globalLevel }
      };
      props.onChangeCharacter({ ...props.character, classe: nextClasse });
      return;
    }
    const nextLevel = Math.max(1, Math.min(globalLevel - 1, Math.floor(nextLevelRaw || 1)));
    const otherLevel = Math.max(1, globalLevel - nextLevel);
    const nextClasse = {
      ...current,
      [slot]: { ...(current?.[slot] ?? {}), niveau: nextLevel },
      [otherSlot]: { ...(current?.[otherSlot] ?? {}), niveau: otherLevel }
    };
    props.onChangeCharacter({ ...props.character, classe: nextClasse });
  };

  const enableSecondaryClass = () => {
    const current = (props.character as any)?.classe ?? {};
    const globalLevel = resolveLevel();
    if (globalLevel <= 2) return;
    const primaryLevel = Math.max(1, globalLevel - 1);
    const secondaryLevel = Math.max(1, globalLevel - primaryLevel);
    const nextClasse = {
      ...current,
      1: { ...(current?.[1] ?? {}), niveau: primaryLevel },
      2: { classeId: "", subclasseId: null, niveau: secondaryLevel }
    };
    props.onChangeCharacter({ ...props.character, classe: nextClasse });
    setActiveClassTab("secondary");
  };

  const removeSecondaryClass = () => {
    const current = (props.character as any)?.classe ?? {};
    const globalLevel = resolveLevel();
    const nextClasse = {
      ...current,
      1: { ...(current?.[1] ?? {}), niveau: globalLevel }
    };
    if (nextClasse?.[2]) delete nextClasse[2];
    props.onChangeCharacter({ ...props.character, classe: nextClasse });
    setActiveClassTab("primary");
  };

  const toggleClassLock = () => {
    props.onChangeCharacter({
      ...props.character,
      classLock: !isClassLocked
    });
  };

  const setClassLock = (value: boolean) => {
    props.onChangeCharacter({
      ...props.character,
      classLock: value
    });
  };

  const STAT_KEYS = ["FOR", "DEX", "CON", "INT", "SAG", "CHA"] as const;
  const getStatBonuses = () => {
    const bonuses: Array<{ stat: typeof STAT_KEYS[number]; value: number; source: string }> =
      [];
    if ((choiceSelections as any)?.background?.statBonusApplied) {
      bonuses.push({ stat: "FOR", value: 1, source: "background" });
    }
    return bonuses;
  };
  const statBonuses = getStatBonuses();
  const asiSelections = ((choiceSelections as any)?.asi ?? {}) as Record<
    string,
    { type: "asi" | "feat"; stats?: Record<string, number> }
  >;
  const statsBase = ((choiceSelections as any)?.statsBase ?? {}) as Record<string, number>;
  const getNonAsiBonusSumForStat = (key: typeof STAT_KEYS[number]) =>
    statBonuses.reduce((sum, bonus) => (bonus.stat === key ? sum + bonus.value : sum), 0);
  const getScore = (key: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA"): number => {
    const mapping: Record<string, keyof Personnage["caracs"]> = {
      FOR: "force",
      DEX: "dexterite",
      CON: "constitution",
      INT: "intelligence",
      SAG: "sagesse",
      CHA: "charisme"
    };
    const caracKey = mapping[key];
    const score = (props.character.caracs?.[caracKey] as any)?.[key];
    return Number.isFinite(score) ? Number(score) : 10;
  };
  const getBaseScore = (key: typeof STAT_KEYS[number]) => {
    const stored = statsBase[key];
    if (Number.isFinite(stored)) return Number(stored);
    const current = getScore(key);
    return Math.max(1, current - getNonAsiBonusSumForStat(key));
  };
  const getAsiBonusMap = () => {
    const requested: Record<string, number> = {};
    Object.values(asiSelections).forEach(entry => {
      if (!entry || entry.type !== "asi" || !entry.stats) return;
      Object.entries(entry.stats).forEach(([stat, value]) => {
        const amount = Number(value) || 0;
        if (amount <= 0) return;
        requested[stat] = (requested[stat] ?? 0) + amount;
      });
    });
    const capped: Record<string, number> = {};
    STAT_KEYS.forEach(stat => {
      const base = getBaseScore(stat);
      const other = getNonAsiBonusSumForStat(stat);
      const cap = 20 - (base + other);
      const available = cap > 0 ? cap : 0;
      const want = requested[stat] ?? 0;
      capped[stat] = Math.max(0, Math.min(want, available));
    });
    return capped;
  };
  const asiBonusMap = getAsiBonusMap();
  const getBonusSumForStat = (key: typeof STAT_KEYS[number]) =>
    getNonAsiBonusSumForStat(key) + (asiBonusMap[key] ?? 0);

  useEffect(() => {
    if (!classPrimary?.id) return;
    const legacyKeys = Object.keys(asiSelections).filter(key => /^\d+$/.test(key));
    if (legacyKeys.length === 0) return;
    const nextAsi = { ...asiSelections };
    let changed = false;
    for (const levelKey of legacyKeys) {
      const newKey = `${classPrimary.id}:${levelKey}`;
      if (!nextAsi[newKey]) {
        nextAsi[newKey] = nextAsi[levelKey];
        changed = true;
      }
      delete nextAsi[levelKey];
      changed = true;
    }
    if (!changed) return;
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: { ...choiceSelections, asi: nextAsi }
    });
  }, [asiSelections, classPrimary?.id, props.character, props.onChangeCharacter, choiceSelections]);
  const getStatSources = (key: typeof STAT_KEYS[number]) =>
    [
      ...statBonuses.filter(bonus => bonus.stat === key).map(bonus => bonus.source),
      ...(asiBonusMap[key] ? ["asi"] : [])
    ];

  const buildCaracsFromTotals = (scores: Record<string, number>) => {
    const mapping: Record<string, keyof Personnage["caracs"]> = {
      FOR: "force",
      DEX: "dexterite",
      CON: "constitution",
      INT: "intelligence",
      SAG: "sagesse",
      CHA: "charisme"
    };
    const nextCaracs: Personnage["caracs"] = { ...(props.character.caracs ?? {}) };
    const nextMods: Record<string, number> = { ...(props.character.combatStats?.mods ?? {}) };
    (Object.keys(mapping) as Array<keyof typeof mapping>).forEach(key => {
      const nextScore = Math.max(1, Math.min(30, Math.floor(scores[key] || 1)));
      const caracKey = mapping[key];
      nextCaracs[caracKey] = {
        ...(props.character.caracs?.[caracKey] ?? {}),
        [key]: nextScore
      };
      nextMods[
        key === "FOR"
          ? "str"
          : key === "DEX"
            ? "dex"
            : key === "CON"
              ? "con"
              : key === "INT"
                ? "int"
                : key === "SAG"
                  ? "wis"
                  : "cha"
      ] = computeMod(nextScore);
    });
    const nextCombatStats = {
      ...(props.character.combatStats ?? {}),
      mods: nextMods
    };
    return { nextCaracs, nextCombatStats };
  };

  const setBaseScores = (scores: Record<string, number>) => {
    const totals: Record<string, number> = {};
    STAT_KEYS.forEach(key => {
      const bonus = getBonusSumForStat(key);
      const base = Math.max(1, Math.min(30, Math.floor(scores[key] || 1)));
      let total = base + bonus;
      if (total > 30) total = 30;
      totals[key] = total;
    });
    const { nextCaracs, nextCombatStats } = buildCaracsFromTotals(totals);
    const nextChoiceSelections = {
      ...choiceSelections,
      statsBase: { ...statsBase, ...scores }
    };
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: nextChoiceSelections,
      caracs: nextCaracs,
      combatStats: nextCombatStats
    });
  };

  const resetStats = () => {
    if (!initialStatsRef.current) return;
    setBaseScores(initialStatsRef.current);
  };

  const resetSkills = () => {
    const baseSkills = activeBackground?.skillProficiencies ?? [];
    props.onChangeCharacter({
      ...props.character,
      competences: [...baseSkills],
      expertises: []
    });
  };

  const resetMasteries = () => {
    const primaryProfs = classPrimary?.proficiencies ?? {};
    const secondaryProfs = classSecondary?.proficiencies ?? {};
    const backgroundTools = [
      ...(activeBackground?.toolProficiencies ?? []),
      ...(((choiceSelections as any)?.background?.tools ?? []) as string[])
    ];
    const nextProfs = {
      weapons: Array.from(
        new Set([...(primaryProfs.weapons ?? []), ...(secondaryProfs.weapons ?? [])])
      ),
      armors: Array.from(
        new Set([...(primaryProfs.armors ?? []), ...(secondaryProfs.armors ?? [])])
      ),
      tools: Array.from(
        new Set([
          ...(primaryProfs.tools ?? []),
          ...(secondaryProfs.tools ?? []),
          ...backgroundTools
        ])
      )
    };
    props.onChangeCharacter({ ...props.character, proficiencies: nextProfs });
  };

  const applyBackgroundSelection = (bg: BackgroundDefinition) => {
    const nextSkills = Array.from(
      new Set([...(competences ?? []), ...(bg.skillProficiencies ?? [])])
    );
    const currentProfs = (props.character?.proficiencies ?? {}) as {
      weapons?: string[];
      armors?: string[];
      tools?: string[];
    };
    const nextProfs = {
      ...currentProfs,
      tools: Array.from(
        new Set([...(currentProfs.tools ?? []), ...(bg.toolProficiencies ?? [])])
      )
    };
    const nextChoiceSelections = {
      ...choiceSelections,
      background: { ...(choiceSelections as any).background }
    };
    let nextCaracs = props.character.caracs;
    const bonusApplied = Boolean((choiceSelections as any)?.background?.statBonusApplied);
    if (bonusApplied && bg.id !== "veteran-de-guerre") {
      const current = (props.character.caracs?.force as any)?.FOR ?? 10;
      nextCaracs = {
        ...props.character.caracs,
        force: { ...(props.character.caracs?.force ?? {}), FOR: current - 1 }
      };
      (nextChoiceSelections as any).background.statBonusApplied = false;
      (nextChoiceSelections as any).statsBase = {
        ...statsBase,
        FOR: Number.isFinite(statsBase.FOR) ? statsBase.FOR : current - 1
      };
    }
    if (!bonusApplied && bg.id === "veteran-de-guerre") {
      const needsImmediateBonus = !bg.toolChoices && !bg.languageChoices;
      if (needsImmediateBonus) {
        const current = (props.character.caracs?.force as any)?.FOR ?? 10;
        nextCaracs = {
          ...props.character.caracs,
          force: { ...(props.character.caracs?.force ?? {}), FOR: current + 1 }
        };
        (nextChoiceSelections as any).background.statBonusApplied = true;
        (nextChoiceSelections as any).statsBase = {
          ...statsBase,
          FOR: Number.isFinite(statsBase.FOR) ? statsBase.FOR : current
        };
      }
    }
    const nextAuto = Array.isArray(bg.equipment) ? bg.equipment : [];
    const manualIds = equipmentManual;
    const nextInventory = buildInventoryFromAutoManual(nextAuto, manualIds);
    props.onChangeCharacter({
      ...props.character,
      backgroundId: bg.id,
      competences: nextSkills,
      proficiencies: nextProfs,
      choiceSelections: nextChoiceSelections,
      caracs: nextCaracs,
      equipmentAuto: nextAuto,
      inventoryItems: nextInventory
    });
  };

  const sourceColors: Record<string, string> = {
    race: "#2ecc71",
    background: "#f1c40f",
    classPrimary: "#4f7df2",
    classSecondary: "#7dc7ff"
  };

  const renderSourceDots = (sources: string[]) => {
    if (sources.length === 0) return null;
    return (
      <div style={{ display: "flex", gap: 4 }}>
        {sources.map(source => (
          <span
            key={source}
            title={source}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: sourceColors[source] ?? "#999",
              display: "inline-block"
            }}
          />
        ))}
      </div>
    );
  };

  const getSkillSources = (skillId: string) => {
    const sources: string[] = [];
    if ((choiceSelections as any)?.race?.adaptableSkill === skillId) sources.push("race");
    if (activeBackground?.skillProficiencies?.includes(skillId)) sources.push("background");
    if (classPrimary?.proficiencies?.skills?.includes(skillId)) sources.push("classPrimary");
    if (classSecondary?.proficiencies?.skills?.includes(skillId)) sources.push("classSecondary");
    return sources;
  };

  const getMasterySources = (kind: "weapons" | "armors" | "tools", id: string) => {
    const sources: string[] = [];
    if (classPrimary?.proficiencies?.[kind]?.includes(id)) sources.push("classPrimary");
    if (classSecondary?.proficiencies?.[kind]?.includes(id)) sources.push("classSecondary");
    if (
      kind === "tools" &&
      (activeBackground?.toolProficiencies?.includes(id) ||
        ((choiceSelections as any)?.background?.tools ?? []).includes(id))
    ) {
      sources.push("background");
    }
    return sources;
  };

  const [choiceModal, setChoiceModal] = useState<{
    open: boolean;
    title: string;
    options: Array<{ id: string; label: string }>;
    selected: string[];
    count: number;
    multi: boolean;
    onConfirm: (selected: string[]) => void;
  }>({
    open: false,
    title: "",
    options: [],
    selected: [],
    count: 1,
    multi: false,
    onConfirm: () => undefined
  });
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => undefined
  });
  const [asiModal, setAsiModal] = useState<{
    open: boolean;
    entry: { key: string; level: number; classId: string; classLabel: string } | null;
    step: "type" | "asi" | "feat";
    type: "asi" | "feat";
    stats: Record<string, number>;
    originalStats: Record<string, number>;
  }>({
    open: false,
    entry: null,
    step: "type",
    type: "asi",
    stats: {},
    originalStats: {}
  });

  const openChoiceModal = (config: {
    title: string;
    options: Array<{ id: string; label: string }>;
    selected: string[];
    count: number;
    multi: boolean;
    onConfirm: (selected: string[]) => void;
  }) => {
    setChoiceModal({ open: true, ...config });
  };

  const closeChoiceModal = () => {
    setChoiceModal(prev => ({ ...prev, open: false }));
  };
  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, open: false }));
  };

  const applyHumanAdaptableSkill = (skillId: string) => {
    const nextChoiceSelections = {
      ...choiceSelections,
      race: { ...(choiceSelections as any).race, adaptableSkill: skillId }
    };
    const nextSkills = Array.from(new Set([...(competences ?? []), skillId]));
    const nextPending = { ...pendingLocks };
    if (pendingLocks.species) delete nextPending.species;
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: { ...nextChoiceSelections, pendingLocks: nextPending },
      competences: nextSkills,
      creationLocks: pendingLocks.species
        ? { ...creationLocks, species: true }
        : creationLocks
    });
  };

  const applyBackgroundToolChoices = (selected: string[]) => {
    const nextChoiceSelections = {
      ...choiceSelections,
      background: { ...(choiceSelections as any).background, tools: selected }
    };
    const currentProfs = (props.character?.proficiencies ?? {}) as {
      weapons?: string[];
      armors?: string[];
      tools?: string[];
    };
    const nextProfs = {
      ...currentProfs,
      tools: Array.from(new Set([...(currentProfs.tools ?? []), ...selected]))
    };
    const nextPending = { ...pendingLocks };
    if (pendingLocks.backgrounds) delete nextPending.backgrounds;
    let nextCaracs = props.character.caracs;
    let nextLocks = creationLocks;
    if (pendingLocks.backgrounds) {
      nextLocks = { ...creationLocks, backgrounds: true };
      const bonusApplied = Boolean((choiceSelections as any)?.background?.statBonusApplied);
      if (!bonusApplied && selectedBackgroundId === "veteran-de-guerre") {
        const current = (props.character.caracs?.force as any)?.FOR ?? 10;
        nextCaracs = {
          ...props.character.caracs,
          force: { ...(props.character.caracs?.force ?? {}), FOR: current + 1 }
        };
        (nextChoiceSelections as any).background.statBonusApplied = true;
        (nextChoiceSelections as any).statsBase = {
          ...statsBase,
          FOR: Number.isFinite(statsBase.FOR) ? statsBase.FOR : current
        };
      }
    }
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: { ...nextChoiceSelections, pendingLocks: nextPending },
      proficiencies: nextProfs,
      creationLocks: nextLocks,
      caracs: nextCaracs
    });
  };

  const applyBackgroundLanguageChoices = (selected: string[]) => {
    const nextChoiceSelections = {
      ...choiceSelections,
      background: { ...(choiceSelections as any).background, languages: selected }
    };
    const currentLangues = props.character?.langues;
    const currentList = Array.isArray(currentLangues)
      ? currentLangues
      : typeof currentLangues === "string"
        ? currentLangues.split(",").map(item => item.trim()).filter(Boolean)
        : [];
    const nextLangues = Array.from(new Set([...currentList, ...selected]));
    const nextPending = { ...pendingLocks };
    if (pendingLocks.backgrounds) delete nextPending.backgrounds;
    let nextCaracs = props.character.caracs;
    let nextLocks = creationLocks;
    if (pendingLocks.backgrounds) {
      nextLocks = { ...creationLocks, backgrounds: true };
      const bonusApplied = Boolean((choiceSelections as any)?.background?.statBonusApplied);
      if (!bonusApplied && selectedBackgroundId === "veteran-de-guerre") {
        const current = (props.character.caracs?.force as any)?.FOR ?? 10;
        nextCaracs = {
          ...props.character.caracs,
          force: { ...(props.character.caracs?.force ?? {}), FOR: current + 1 }
        };
        (nextChoiceSelections as any).background.statBonusApplied = true;
        (nextChoiceSelections as any).statsBase = {
          ...statsBase,
          FOR: Number.isFinite(statsBase.FOR) ? statsBase.FOR : current
        };
      }
    }
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: { ...nextChoiceSelections, pendingLocks: nextPending },
      langues: nextLangues,
      creationLocks: nextLocks,
      caracs: nextCaracs
    });
  };

  const requireRaceChoices = () => {
    if (selectedRaceId !== "human") return false;
    const adaptableSkill = (choiceSelections as any)?.race?.adaptableSkill;
    if (!adaptableSkill) {
      openChoiceModal({
        title: "Humain - Choisir une competence",
        options: competenceOptions.map(skill => ({ id: skill.id, label: skill.label })),
        selected: [],
        count: 1,
        multi: false,
        onConfirm: selected => applyHumanAdaptableSkill(selected[0])
      });
      return true;
    }
    return false;
  };

  const requireBackgroundChoices = () => {
    if (!activeBackground) return false;
    const backgroundChoices = (choiceSelections as any)?.background ?? {};
    if (activeBackground.toolChoices) {
      const existing = Array.isArray(backgroundChoices.tools) ? backgroundChoices.tools : [];
      if (existing.length < activeBackground.toolChoices.count) {
        openChoiceModal({
          title: "Historique - Choisir un outil",
          options: (activeBackground.toolChoices.options ?? []).map(id => ({
            id,
            label: toolMasteryOptions.find(opt => opt.id === id)?.label ?? id
          })),
          selected: existing,
          count: activeBackground.toolChoices.count,
          multi: activeBackground.toolChoices.count > 1,
          onConfirm: selected => applyBackgroundToolChoices(selected)
        });
        return true;
      }
    }
    if (activeBackground.languageChoices) {
      const existing = Array.isArray(backgroundChoices.languages) ? backgroundChoices.languages : [];
      if (existing.length < activeBackground.languageChoices.count) {
        openChoiceModal({
          title: "Historique - Choisir des langues",
          options: languageOptions.map(lang => ({ id: lang.id, label: lang.label })),
          selected: existing,
          count: activeBackground.languageChoices.count,
          multi: activeBackground.languageChoices.count > 1,
          onConfirm: selected => applyBackgroundLanguageChoices(selected)
        });
        return true;
      }
    }
    return false;
  };

  const resetMateriel = () => {
    const nextMaterielSlots = { ...DEFAULT_MATERIEL_SLOTS };
    const nextArmesDefaut = {
      main_droite: null,
      main_gauche: null,
      mains: null
    };
    props.onChangeCharacter({
      ...props.character,
      materielSlots: nextMaterielSlots,
      armesDefaut: nextArmesDefaut,
      equipmentManual: [],
      inventoryItems: Array.isArray((props.character as any)?.inventoryItems)
        ? ((props.character as any).inventoryItems as Array<any>).map(item => ({
            ...item,
            equippedSlot: null,
            storedIn: null,
            isPrimaryWeapon: false
          }))
        : []
    });
  };

  const resolveItemType = (rawId: string) => {
    if (rawId.startsWith("weapon:")) return { type: "weapon", id: rawId.replace("weapon:", "") };
    if (rawId.startsWith("armor:")) return { type: "armor", id: rawId.replace("armor:", "") };
    if (rawId.startsWith("tool:")) return { type: "tool", id: rawId.replace("tool:", "") };
    if (rawId.startsWith("object:")) return { type: "object", id: rawId.replace("object:", "") };
    if (objectItemMap.has(rawId)) return { type: "object", id: rawId };
    if (armorItemMap.has(rawId)) return { type: "armor", id: rawId };
    if (toolItemMap.has(rawId)) return { type: "tool", id: rawId };
    if (weaponItemMap.has(rawId)) return { type: "weapon", id: rawId };
    return { type: "object", id: rawId };
  };
  const formatEquipmentLabel = (rawId: string) => {
    const resolved = resolveItemType(rawId);
    const fallback = humanizeId(resolved.id);
    if (resolved.type === "object") return objectItemMap.get(resolved.id)?.label ?? fallback;
    if (resolved.type === "armor") return armorItemMap.get(resolved.id)?.label ?? fallback;
    if (resolved.type === "tool") return toolItemMap.get(resolved.id)?.label ?? fallback;
    if (resolved.type === "weapon") return weaponItemMap.get(resolved.id)?.name ?? fallback;
    return fallback;
  };

  const buildInventoryFromAutoManual = (autoIds: string[], manualIds: string[]) => {
    const autoItems = autoIds.map(id => ({
      ...resolveItemType(id),
      qty: 1,
      source: "auto",
      equippedSlot: null,
      storedIn: null,
      isPrimaryWeapon: false
    }));
    const manualItems = manualIds.map(id => ({
      ...resolveItemType(id),
      qty: 1,
      source: "manual",
      equippedSlot: null,
      storedIn: null,
      isPrimaryWeapon: false
    }));
    return [...autoItems, ...manualItems];
  };

  const addManualItem = (id: string) => {
    const nextManual = [...equipmentManual, id];
    const nextInventory = [
      ...inventoryItems,
      {
        ...resolveItemType(id),
        qty: 1,
        source: "manual",
        equippedSlot: null,
        storedIn: null,
        isPrimaryWeapon: false
      }
    ];
    props.onChangeCharacter({
      ...props.character,
      equipmentManual: nextManual,
      inventoryItems: nextInventory
    });
  };

  const removeManualItem = (inventoryIndex: number) => {
    const target = inventoryItems[inventoryIndex];
    if (!target) return;
    const entryId = `${target.type}:${target.id}`;
    let removed = false;
    const nextManual = equipmentManual.filter(entry => {
      if (removed) return true;
      if (entry === entryId || entry === target.id) {
        removed = true;
        return false;
      }
      return true;
    });
    const slots = { ...materielSlots };
    if (target.equippedSlot && slots[target.equippedSlot]) {
      slots[target.equippedSlot] = null;
    }
    const nextInventory = inventoryItems.filter((_, idx) => idx !== inventoryIndex);
    props.onChangeCharacter({
      ...props.character,
      equipmentManual: nextManual,
      materielSlots: slots,
      inventoryItems: nextInventory
    });
  };

  const updateItemSlot = (index: number, slot: string | null) => {
    const targetItem = inventoryItems[index];
    if (!targetItem) return;
    if (slot && !EQUIPMENT_SLOTS.find(s => s.id === slot)) return;
    const categories = getItemCategories(targetItem);
    if (slot) {
      const slotDef = EQUIPMENT_SLOTS.find(s => s.id === slot);
      if (!slotDef) return;
      if (slotDef.requiresClothingBody && !canUseClothingPieces) return;
      if (!categories.some(cat => slotDef.accepts.includes(cat))) return;
    }
    const slots = { ...materielSlots };
    const nextInventory = inventoryItems.map((item, idx) => {
      if (idx === index) return item;
      if (slot && item.equippedSlot === slot) {
        return { ...item, equippedSlot: null };
      }
      return item;
    });
    const keepPrimary =
      targetItem.type === "weapon" && slot && weaponCarrySlots.has(slot)
        ? Boolean(targetItem.isPrimaryWeapon)
        : false;
    const nextForTarget = {
      ...targetItem,
      equippedSlot: slot,
      storedIn: null,
      isPrimaryWeapon: keepPrimary
    };
    nextInventory[index] = nextForTarget;
    if (targetItem.equippedSlot && slots[targetItem.equippedSlot]) {
      slots[targetItem.equippedSlot] = null;
    }
    if (slot) {
      slots[slot] = targetItem.id ?? null;
    }
    if (slot === "corps") {
      const isArmor = categories.includes("armor_body");
      if (isArmor) {
        for (const subSlot of clothingSubSlots) {
          const subId = slots[subSlot];
          if (subId) {
            slots[subSlot] = null;
            for (let i = 0; i < nextInventory.length; i += 1) {
              if (nextInventory[i]?.equippedSlot === subSlot) {
                nextInventory[i] = { ...nextInventory[i], equippedSlot: null };
              }
            }
          }
        }
      }
    }
    if (slot === "paquetage") {
      const bagId = targetItem.id ?? null;
      for (let i = 0; i < nextInventory.length; i += 1) {
        if (nextInventory[i]?.storedIn && nextInventory[i].storedIn !== bagId) {
          nextInventory[i] = { ...nextInventory[i], storedIn: null };
        }
      }
    }
    if (!slot && targetItem.equippedSlot === "paquetage") {
      for (let i = 0; i < nextInventory.length; i += 1) {
        if (nextInventory[i]?.storedIn) {
          nextInventory[i] = { ...nextInventory[i], storedIn: null };
        }
      }
    }
    props.onChangeCharacter({
      ...props.character,
      materielSlots: slots,
      inventoryItems: nextInventory
    });
  };
  const storeItemInBag = (index: number) => {
    const bagId = getBagId();
    const bagCapacity = getBagCapacity(bagId);
    if (!bagId || bagCapacity <= 0) return;
    const item = inventoryItems[index];
    if (!item) return;
    const itemWeight = getItemWeight(item) * (Number(item?.qty ?? 1) || 1);
    const storedWeight = getStoredWeight(bagId);
    if (item.storedIn !== bagId && storedWeight + itemWeight > bagCapacity) {
      setEquipMessage("Capacite du sac depassee.");
      return;
    }
    const slots = { ...materielSlots };
    if (item.equippedSlot && slots[item.equippedSlot]) {
      slots[item.equippedSlot] = null;
    }
    const nextInventory = inventoryItems.map((entry, idx) => {
      if (idx !== index) return entry;
      return { ...entry, equippedSlot: null, storedIn: bagId, isPrimaryWeapon: false };
    });
    props.onChangeCharacter({
      ...props.character,
      materielSlots: slots,
      inventoryItems: nextInventory
    });
  };
  const setPrimaryWeapon = (index: number) => {
    const item = inventoryItems[index];
    if (!item || item.type !== "weapon") return;
    if (!item.equippedSlot || !weaponCarrySlots.has(item.equippedSlot)) {
      setEquipMessage("L'arme principale doit etre equipee a la ceinture ou au dos.");
      return;
    }
    const weapon = weaponItemMap.get(item.id);
    const isTwoHanded = Boolean(weapon?.properties?.two_handed || weapon?.properties?.heavy);
    if (isTwoHanded) {
      const hasShield = inventoryItems.some(entry => {
        if (entry?.type !== "armor") return false;
        if (!entry.equippedSlot || !weaponCarrySlots.has(entry.equippedSlot)) return false;
        return getItemCategories(entry).includes("shield");
      });
      if (hasShield) {
        setEquipMessage("Une arme a deux mains ne peut pas etre principale avec un bouclier equipe.");
        return;
      }
    }
    const nextInventory = inventoryItems.map((entry, idx) => ({
      ...entry,
      isPrimaryWeapon: idx === index
    }));
    props.onChangeCharacter({ ...props.character, inventoryItems: nextInventory });
  };

  useEffect(() => {
    if (inventoryInitRef.current) return;
    if (inventoryItems.length === 0 && (equipmentAuto.length > 0 || equipmentManual.length > 0)) {
      const nextInventory = buildInventoryFromAutoManual(equipmentAuto, equipmentManual);
      inventoryInitRef.current = true;
      props.onChangeCharacter({ ...props.character, inventoryItems: nextInventory });
    }
  }, [inventoryItems.length, equipmentAuto, equipmentManual, props.character, props.onChangeCharacter]);

  const handleSpeciesSelect = (raceId: string) => {
    if (!isSectionLocked("species")) {
      props.onChangeCharacter({ ...props.character, raceId });
      return;
    }
    setConfirmModal({
      open: true,
      title: "Changer l'espece",
      message:
        "Changer l'espece va deverouiller les onglets dependants et reinitialiser le materiel. Continuer ?",
      onConfirm: () => {
        const nextLocks: Record<string, boolean> = { ...creationLocks };
        [
          "species",
          "backgrounds",
          "classes",
          "stats",
          "skills",
          "masteries",
          "equip",
          "profile"
        ].forEach(key => {
          delete nextLocks[key];
        });
        const nextChoiceSelections = {
          ...choiceSelections,
          race: { ...(choiceSelections as any).race }
        };
        const adaptableSkill = (choiceSelections as any)?.race?.adaptableSkill;
        if (adaptableSkill) {
          delete nextChoiceSelections.race.adaptableSkill;
        }
        const nextCompetences = adaptableSkill
          ? competences.filter(skill => skill !== adaptableSkill)
          : competences;
        props.onChangeCharacter({
          ...props.character,
          raceId,
          creationLocks: nextLocks,
          classLock: false,
          choiceSelections: nextChoiceSelections,
          competences: nextCompetences
        });
        resetMateriel();
        closeConfirmModal();
      }
    });
  };

  const handleBackgroundSelect = (bg: BackgroundDefinition) => {
    if (!isSectionLocked("backgrounds")) {
      applyBackgroundSelection(bg);
      return;
    }
    setConfirmModal({
      open: true,
      title: "Changer l'historique",
      message:
        "Changer l'historique va deverouiller les onglets dependants et reinitialiser le materiel. Continuer ?",
      onConfirm: () => {
        const nextLocks: Record<string, boolean> = { ...creationLocks };
        ["backgrounds", "skills", "masteries", "equip"].forEach(key => {
          delete nextLocks[key];
        });
        const prevBackground = activeBackground;
        const prevSkills = prevBackground?.skillProficiencies ?? [];
        const nextCompetences = prevSkills.length
          ? competences.filter(skill => !prevSkills.includes(skill))
          : competences;
        const nextChoiceSelections = {
          ...choiceSelections,
          background: {}
        };
        let nextCaracs = props.character.caracs;
        const bonusApplied = Boolean((choiceSelections as any)?.background?.statBonusApplied);
        if (bonusApplied) {
          const current = (props.character.caracs?.force as any)?.FOR ?? 10;
          nextCaracs = {
            ...props.character.caracs,
            force: { ...(props.character.caracs?.force ?? {}), FOR: current - 1 }
          };
          (nextChoiceSelections as any).statsBase = {
            ...statsBase,
            FOR: Number.isFinite(statsBase.FOR) ? statsBase.FOR : current - 1
          };
        }
        props.onChangeCharacter({
          ...props.character,
          creationLocks: nextLocks,
          choiceSelections: nextChoiceSelections,
          competences: nextCompetences,
          classLock: false,
          caracs: nextCaracs
        });
        applyBackgroundSelection(bg);
        resetMateriel();
        closeConfirmModal();
      }
    });
  };

  const handleClassSelect = (cls: ClassDefinition, slot: 1 | 2) => {
    if (!isSectionLocked("classes")) {
      setClassSelection(cls, slot);
      return;
    }
    setConfirmModal({
      open: true,
      title: "Changer la classe",
      message:
        "Changer la classe va deverouiller les onglets dependants et reinitialiser le materiel. Continuer ?",
      onConfirm: () => {
        const nextLocks: Record<string, boolean> = { ...creationLocks };
        ["classes", "masteries", "skills", "equip"].forEach(key => {
          delete nextLocks[key];
        });
        const nextChoiceSelections = {
          ...choiceSelections,
          classes: {}
        };
        props.onChangeCharacter({
          ...props.character,
          creationLocks: nextLocks,
          classLock: false,
          choiceSelections: nextChoiceSelections
        });
        setClassSelection(cls, slot);
        resetMasteries();
        resetMateriel();
        closeConfirmModal();
      }
    });
  };

  const requireSubclassChoiceForSlot = (slot: 1 | 2) => {
    const clsId = slot === 1 ? selectedClassId : selectedSecondaryClassId;
    const entry = slot === 1 ? classEntry : secondaryClassEntry;
    const cls = classOptions.find(c => c.id === clsId);
    if (!cls || !entry) return false;
    const threshold = cls.subclassLevel ?? 1;
    const level = Number(entry?.niveau) || 0;
    if (level < threshold) return false;
    const selectedSub = slot === 1 ? selectedSubclassId : selectedSecondarySubclassId;
    if (selectedSub) return false;
    const allowedIds = Array.isArray(cls.subclassIds) ? cls.subclassIds : [];
    const options = subclassOptions
      .filter(sub => sub.classId === cls.id)
      .filter(sub => allowedIds.length === 0 || allowedIds.includes(sub.id))
      .map(sub => ({ id: sub.id, label: sub.label }));
    if (options.length === 0) return false;
    openChoiceModal({
      title: "Choisir une sous-classe",
      options,
      selected: [],
      count: 1,
      multi: false,
      onConfirm: selected => {
        setSubclassSelection(selected[0], slot);
        if (pendingLocks.classes) {
          setClassLock(true);
          const nextPending = { ...pendingLocks };
          delete nextPending.classes;
          props.onChangeCharacter({
            ...props.character,
            choiceSelections: { ...choiceSelections, pendingLocks: nextPending }
          });
        }
      }
    });
    return true;
  };

  const requireClassChoices = () => {
    const needsPrimary = requireSubclassChoiceForSlot(1);
    const needsSecondary =
      isSecondaryEnabled && resolvedClassTab === "secondary"
        ? requireSubclassChoiceForSlot(2)
        : isSecondaryEnabled
          ? requireSubclassChoiceForSlot(2)
          : false;
    return needsPrimary || needsSecondary;
  };

  const getTabLockColor = (id: string) => {
    if (!isSectionLocked(id)) return null;
    if (id === "species") return sourceColors.race;
    if (id === "backgrounds") return sourceColors.background;
    if (id === "classes") return sourceColors.classPrimary;
    return "#6fd3a8";
  };

  const LockIcon = ({ color }: { color: string }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="M6 10V8a6 6 0 0 1 12 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1zm2 0h8V8a4 4 0 1 0-8 0v2z"
      />
    </svg>
  );

  const initialStatsRef = useRef<Record<string, number> | null>(null);
  if (!initialStatsRef.current) {
    initialStatsRef.current = {
      FOR: getBaseScore("FOR"),
      DEX: getBaseScore("DEX"),
      CON: getBaseScore("CON"),
      INT: getBaseScore("INT"),
      SAG: getBaseScore("SAG"),
      CHA: getBaseScore("CHA")
    };
  }
  useEffect(() => {
    initialStatsRef.current = {
      FOR: getBaseScore("FOR"),
      DEX: getBaseScore("DEX"),
      CON: getBaseScore("CON"),
      INT: getBaseScore("INT"),
      SAG: getBaseScore("SAG"),
      CHA: getBaseScore("CHA")
    };
  }, [props.character?.id]);

  const computeMod = (score: number): number => Math.floor((score - 10) / 2);
  const canEditSkills = !isSectionLocked("skills") && skillsMode !== "normal";
  const canEditMasteries = !isSectionLocked("masteries") && masteriesMode !== "normal";
  const setAsiSelection = (
    key: string,
    next: { type: "asi" | "feat"; stats?: Record<string, number> }
  ) => {
    const nextAsi = { ...asiSelections, [key]: next };
    const nextChoiceSelections = { ...choiceSelections, asi: nextAsi };
    props.onChangeCharacter({ ...props.character, choiceSelections: nextChoiceSelections });
  };
  const clearAsiSelection = (key: string) => {
    const nextAsi = { ...asiSelections };
    delete nextAsi[key];
    const nextChoiceSelections = { ...choiceSelections, asi: nextAsi };
    props.onChangeCharacter({ ...props.character, choiceSelections: nextChoiceSelections });
  };
  const formatAsiStats = (stats?: Record<string, number>) => {
    if (!stats) return "";
    const entries = Object.entries(stats)
      .filter(([, value]) => Number(value) > 0)
      .map(([stat, value]) => `${stat}+${Number(value)}`);
    return entries.join(" / ");
  };
  const getClassAsiLevels = () => {
    const entries: Array<{
      key: string;
      level: number;
      classId: string;
      classLabel: string;
    }> = [];
    const collect = (cls: ClassDefinition | null, level: number) => {
      if (!cls || !cls.id) return;
      const progression = (cls as any)?.progression ?? {};
      Object.keys(progression)
        .map(key => Number(key))
        .filter(lvl => Number.isFinite(lvl) && lvl > 0 && lvl <= level)
        .filter(lvl => {
          const grants = progression[String(lvl)]?.grants ?? [];
          return grants.some(
            (grant: any) => grant?.kind === "bonus" && (grant?.ids ?? []).includes("asi-or-feat")
          );
        })
        .forEach(lvl => {
          const key = `${cls.id}:${lvl}`;
          entries.push({
            key,
            level: lvl,
            classId: cls.id,
            classLabel: cls.label ?? cls.id
          });
        });
    };
    const primaryLevel = Number(classEntry?.niveau ?? 0);
    if (primaryLevel > 0) collect(classPrimary, primaryLevel);
    const secondaryLevel = Number(secondaryClassEntry?.niveau ?? 0);
    if (secondaryLevel > 0) collect(classSecondary, secondaryLevel);
    return entries.sort((a, b) =>
      a.level === b.level ? a.classLabel.localeCompare(b.classLabel) : a.level - b.level
    );
  };
  const getAsiEntryForLevel = (entryInfo: {
    key: string;
    level: number;
    classId: string;
    classLabel: string;
  }) => {
    return (
      asiSelections[entryInfo.key] ??
      (entryInfo.classId === classPrimary?.id ? asiSelections[String(entryInfo.level)] : null) ??
      null
    );
  };
  const openAsiModal = (entryInfo: {
    key: string;
    level: number;
    classId: string;
    classLabel: string;
  }) => {
    const entry = getAsiEntryForLevel(entryInfo);
    const type = entry?.type === "feat" ? "feat" : "asi";
    const stats = type === "asi" && entry?.stats ? { ...entry.stats } : {};
    setAsiModal({
      open: true,
      entry: entryInfo,
      step: "type",
      type,
      stats,
      originalStats: { ...stats }
    });
  };
  const closeAsiModal = () => {
    setAsiModal(prev => ({ ...prev, open: false }));
  };
  const setAsiModalType = (type: "asi" | "feat") => {
    setAsiModal(prev => ({ ...prev, type }));
  };
  const updateAsiModalStat = (stat: string, delta: number) => {
    setAsiModal(prev => {
      if (!prev.entry) return prev;
      const current = Number(prev.stats[stat] ?? 0);
      const nextValue = Math.max(0, Math.min(2, current + delta));
      const nextStats = { ...prev.stats };
      if (nextValue <= 0) {
        delete nextStats[stat];
      } else {
        nextStats[stat] = nextValue;
      }
      return { ...prev, stats: nextStats };
    });
  };
  const confirmAsiModalType = () => {
    if (!asiModal.entry) return;
    if (asiModal.type === "feat") {
      setAsiSelection(asiModal.entry.key, { type: "feat" });
      setAsiModal(prev => ({ ...prev, step: "feat" }));
      return;
    }
    setAsiModal(prev => ({ ...prev, step: "asi" }));
  };
  const confirmAsiModalStats = () => {
    if (!asiModal.entry) return;
    setAsiSelection(asiModal.entry.key, { type: "asi", stats: { ...asiModal.stats } });
    closeAsiModal();
  };

  const POINT_BUY_COSTS: Record<number, number> = {
    8: 0,
    9: 1,
    10: 2,
    11: 3,
    12: 4,
    13: 5,
    14: 7,
    15: 9
  };
  const getPointBuyCost = (score: number) => {
    const cost = POINT_BUY_COSTS[score];
    return Number.isFinite(cost) ? cost : null;
  };
  const getBaseScoresSnapshot = () => {
    const snapshot: Record<string, number> = {};
    STAT_KEYS.forEach(key => {
      snapshot[key] = getBaseScore(key);
    });
    return snapshot;
  };
  const DEFAULT_POINT_BUY_BASE: Record<string, number> = {
    FOR: 15,
    DEX: 14,
    CON: 13,
    INT: 12,
    SAG: 10,
    CHA: 8
  };
  const isPointBuyStateValid = (bases: Record<string, number>) => {
    const summary = getPointBuySummary(bases);
    if (summary.invalid) return false;
    return summary.remaining !== null && summary.remaining >= 0;
  };
  const getPointBuySummary = (overrides?: Record<string, number>) => {
    let total = 0;
    let invalid = false;
    STAT_KEYS.forEach(key => {
      const base = overrides?.[key] ?? getBaseScore(key);
      const cost = getPointBuyCost(base);
      if (cost === null) {
        invalid = true;
        return;
      }
      total += cost;
    });
    const remaining = invalid ? null : 27 - total;
    return { total, remaining, invalid };
  };
  const canAdjustPointBuy = (key: typeof STAT_KEYS[number], delta: number) => {
    const currentBases = getBaseScoresSnapshot();
    const current = currentBases[key];
    const next = current + delta;
    if (next < 8 || next > 15) return false;
    const nextBases = { ...currentBases, [key]: next };
    const summary = getPointBuySummary(nextBases);
    if (summary.invalid) return false;
    return summary.remaining !== null && summary.remaining >= 0;
  };

  const setScore = (key: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA", value: number) => {
    const desiredTotal = Math.max(1, Math.min(30, Math.floor(value || 1)));
    const bonus = getBonusSumForStat(key);
    if (statsMode === "normal") {
      let base = desiredTotal - bonus;
      if (base < 8) base = 8;
      if (base > 15) base = 15;
      const currentBases = getBaseScoresSnapshot();
      const nextBase = { ...currentBases, [key]: base };
      const summary = getPointBuySummary(nextBase);
      if (summary.invalid || (summary.remaining !== null && summary.remaining < 0)) {
        return;
      }
      setBaseScores(nextBase);
      return;
    }
    let base = desiredTotal - bonus;
    if (base < 1) base = 1;
    if (base > 30) base = 30;
    const nextBase = { ...statsBase, [key]: base };
    setBaseScores(nextBase);
  };

  useEffect(() => {
    if (statsMode !== "normal") return;
    const snapshot = getBaseScoresSnapshot();
    const hasAll = STAT_KEYS.every(key => Number.isFinite(snapshot[key]));
    if (!hasAll || !isPointBuyStateValid(snapshot)) {
      setBaseScores(DEFAULT_POINT_BUY_BASE);
    }
  }, [statsMode, props.character?.id]);

  const competenceOptions = [
    { id: "athletisme", label: "Athletisme" },
    { id: "acrobaties", label: "Acrobaties" },
    { id: "escamotage", label: "Escamotage" },
    { id: "discretion", label: "Discretion" },
    { id: "arcanes", label: "Arcanes" },
    { id: "histoire", label: "Histoire" },
    { id: "investigation", label: "Investigation" },
    { id: "nature", label: "Nature" },
    { id: "religion", label: "Religion" },
    { id: "intuition", label: "Intuition" },
    { id: "medecine", label: "Medecine" },
    { id: "perception", label: "Perception" },
    { id: "survie", label: "Survie" },
    { id: "dressage", label: "Dressage" },
    { id: "intimidation", label: "Intimidation" },
    { id: "persuasion", label: "Persuasion" },
    { id: "tromperie", label: "Tromperie" },
    { id: "representation", label: "Representation" }
  ];

  const skillAbilityMap: Record<string, "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA"> = {
    athletisme: "STR",
    acrobaties: "DEX",
    escamotage: "DEX",
    discretion: "DEX",
    arcanes: "INT",
    histoire: "INT",
    investigation: "INT",
    nature: "INT",
    religion: "INT",
    intuition: "WIS",
    medecine: "WIS",
    perception: "WIS",
    survie: "WIS",
    dressage: "WIS",
    intimidation: "CHA",
    persuasion: "CHA",
    tromperie: "CHA",
    representation: "CHA"
  };

  const weaponMasteryOptions = [
    { id: "simple", label: "Simple" },
    { id: "martiale", label: "Martiale" },
    { id: "speciale", label: "Speciale" },
    { id: "monastique", label: "Monastique" }
  ];
  const armorMasteryOptions = [
    { id: "legere", label: "Legere" },
    { id: "intermediaire", label: "Intermediaire" },
    { id: "lourde", label: "Lourde" },
    { id: "bouclier", label: "Bouclier" }
  ];
  const toolMasteryOptions = [
    { id: "outils_artisan", label: "Outils d'artisan" },
    { id: "outils_jeux", label: "Boite de jeux" },
    { id: "outils_instruments", label: "Instruments de musique" },
    { id: "outils_autres", label: "Autres outils" },
    { id: "outils_vehicules", label: "Vehicules" }
  ];
  const isSecondaryEnabled = Boolean(secondaryClassEntry);
  const activeClassSlot = resolvedClassTab === "secondary" ? 2 : 1;
  const activeClassEntry = activeClassSlot === 1 ? classEntry : secondaryClassEntry;
  const activeClassId =
    activeClassSlot === 1 ? selectedClassId : selectedSecondaryClassId;
  const activeSubclassId =
    activeClassSlot === 1 ? selectedSubclassId : selectedSecondarySubclassId;

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
          minWidth: 320,
          width: "min(680px, 92vw)",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{ id: "map", label: "Carte" }, { id: "player", label: "Joueur" }].map(
            tab => {
              const isActive = activeMainTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveMainTab(tab.id as typeof activeMainTab)}
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
            }
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            minHeight: 36,
            alignItems: "center"
          }}
        >
          {activeMainTab === "player" &&
            [
              { id: "species", label: "Espece" },
              { id: "backgrounds", label: "Historique" },
              { id: "profile", label: "Profil" },
              { id: "stats", label: "Stats" },
              { id: "classes", label: "Classes" },
              { id: "equip", label: "Equipement" },
              { id: "skills", label: "Competences" },
              { id: "masteries", label: "Maitrises" }
            ].map(tab => {
              const isActive = activePlayerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePlayerTab(tab.id as typeof activePlayerTab)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${
                      isSectionLocked(tab.id) ? getTabLockColor(tab.id) ?? "#6fd3a8" : isActive ? "#6fd3a8" : "#333"
                    }`,
                    background: isActive ? "rgba(46, 204, 113, 0.16)" : "#0f0f19",
                    color: isActive ? "#dff6e8" : "#c9cfdd",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  {tab.label}
                  {isSectionLocked(tab.id) && (
                    <span style={{ marginLeft: 6, display: "inline-flex" }}>
                      <LockIcon color={getTabLockColor(tab.id) ?? "#6fd3a8"} />
                    </span>
                  )}
                </button>
              );
            })}
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: 12,
            background: "rgba(10,10,18,0.6)",
            height: "52vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}
        >
          {activeMainTab === "map" && (
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
            <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
              <span>Nombre d&apos;ennemis :</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 6px",
                  borderRadius: 8,
                  border: "1px solid #2a2a3a",
                  background: "#0f0f19"
                }}
              >
                <button
                  type="button"
                  onClick={() => props.onChangeEnemyCount(Math.max(1, props.configEnemyCount - 1))}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    border: "1px solid #333",
                    background: "#141421",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center"
                  }}
                  aria-label="Diminuer le nombre d'ennemis"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                  </svg>
                </button>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={props.configEnemyCount}
                  onChange={e =>
                    props.onChangeEnemyCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))
                  }
                  style={{
                    width: 60,
                    background: "#0f0f19",
                    color: "#f5f5f5",
                    border: "1px solid #333",
                    borderRadius: 6,
                    padding: "4px 6px",
                    textAlign: "center",
                    appearance: "textfield",
                    WebkitAppearance: "textfield",
                    MozAppearance: "textfield"
                  }}
                />
                <button
                  type="button"
                  onClick={() => props.onChangeEnemyCount(Math.min(8, props.configEnemyCount + 1))}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    border: "1px solid #333",
                    background: "#141421",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center"
                  }}
                  aria-label="Augmenter le nombre d'ennemis"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                    <rect x="5.25" y="2" width="1.5" height="8" fill="currentColor" />
                  </svg>
                </button>
              </div>
            </div>
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

          {activeMainTab === "player" && activePlayerTab === "equip" && (
            <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                Equipez les objets compatibles dans chaque slot. Les selections respectent les categories.
              </div>
              <button
                type="button"
                onClick={() => toggleSectionLock("equip")}
                style={{
                  marginLeft: "auto",
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: isSectionLocked("equip")
                    ? "rgba(231,76,60,0.18)"
                    : "rgba(46, 204, 113, 0.16)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700
                }}
              >
                {isSectionLocked("equip") ? "Deverouiller" : "Verouiller"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {([
                { id: "slots", label: "Equipement" },
                { id: "loot", label: "Boite a loot" }
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEquipSubTab(tab.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background:
                      equipSubTab === tab.id
                        ? "rgba(46, 204, 113, 0.18)"
                        : "rgba(255,255,255,0.06)",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {equipMessage && (
              <div
                style={{
                  marginTop: 6,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(231, 76, 60, 0.18)",
                  fontSize: 11,
                  color: "#f5f5f5",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <span>{equipMessage}</span>
                <button
                  type="button"
                  onClick={() => setEquipMessage(null)}
                  style={{
                    marginLeft: "auto",
                    border: "none",
                    background: "transparent",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  OK
                </button>
              </div>
            )}
            {equipSubTab === "slots" && (
              <>
                <div
                  style={{
                    marginTop: 8,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 10
                  }}
                >
                  {renderSlotGroup(
                    slotGroups.body,
                    "Vetements / Armures",
                    "Corps: armure ou vetement. Vetements secondaires actifs si vetement au corps."
                  )}
                  {renderSlotGroup(slotGroups.weapons, "Armes et protections")}
                  {renderSlotGroup(slotGroups.jewelry, "Bijoux")}
                  {renderSlotGroup(slotGroups.bag, "Paquetage")}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>
                  Paquetage:{" "}
                  {bagId
                    ? `${storedWeight.toFixed(1)} / ${bagCapacity.toFixed(1)} poids`
                    : "aucun sac equipe"}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(12,12,18,0.75)",
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Inventaire</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                    Equiper un slot ou ranger dans le sac (si disponible).
                  </div>
                  {inventoryItems.length === 0 && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Aucun item pour l'instant.
                    </div>
                  )}
                  {inventoryItems.map((item, idx) => {
                    const sourceLabel = item.source === "auto" ? "Auto" : "Manuel";
                    const eligibleSlots = EQUIPMENT_SLOTS.filter(slot => {
                      if (slot.requiresClothingBody && !canUseClothingPieces) return false;
                      const categories = getItemCategories(item);
                      return categories.some(cat => slot.accepts.includes(cat));
                    });
                    const canStore =
                      bagId && bagCapacity > 0
                        ? (() => {
                            const itemWeight =
                              getItemWeight(item) * (Number(item?.qty ?? 1) || 1);
                            if (item.storedIn === bagId) return true;
                            return storedWeight + itemWeight <= bagCapacity;
                          })()
                        : false;
                    return (
                      <div
                        key={`inv-${idx}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto auto",
                          gap: 8,
                          alignItems: "center",
                          fontSize: 12
                        }}
                      >
                        <span>
                          {getItemLabel(item)}{" "}
                          <span style={{ color: "rgba(255,255,255,0.5)" }}>
                            ({sourceLabel})
                          </span>
                        </span>
                        <select
                          value={
                            item.storedIn
                              ? "__bag__"
                              : item.equippedSlot
                                ? item.equippedSlot
                                : ""
                          }
                          onChange={e => {
                            const value = e.target.value;
                            if (value === "__bag__") {
                              storeItemInBag(idx);
                              return;
                            }
                            if (!value) {
                              updateItemSlot(idx, null);
                              return;
                            }
                            updateItemSlot(idx, value);
                          }}
                          style={{
                            background: "#0f0f19",
                            color: "#f5f5f5",
                            border: "1px solid #333",
                            borderRadius: 6,
                            padding: "2px 6px",
                            fontSize: 11
                          }}
                          disabled={isSectionLocked("equip")}
                        >
                          <option value="">Non equipe</option>
                          {eligibleSlots.map(slot => (
                            <option key={`item-slot-${idx}-${slot.id}`} value={slot.id}>
                              {slot.label}
                            </option>
                          ))}
                          {bagId && (
                            <option value="__bag__" disabled={!canStore}>
                              Ranger dans le sac
                            </option>
                          )}
                        </select>
                        {item.type === "weapon" && (
                          <button
                            type="button"
                            onClick={() => setPrimaryWeapon(idx)}
                            style={{
                              borderRadius: 6,
                              border: "1px solid rgba(255,255,255,0.2)",
                              background: item.isPrimaryWeapon
                                ? "rgba(241, 196, 15, 0.25)"
                                : "rgba(255,255,255,0.08)",
                              color: item.isPrimaryWeapon ? "#f8e58c" : "#f5f5f5",
                              cursor: "pointer",
                              fontSize: 12,
                              padding: "2px 6px",
                              fontWeight: 700
                            }}
                            title="Definir comme arme principale"
                          >
                            ★
                          </button>
                        )}
                        {item.source === "manual" && (
                          <button
                            type="button"
                            onClick={() => removeManualItem(idx)}
                            style={{
                              padding: "2px 6px",
                              borderRadius: 6,
                              border: "1px solid rgba(255,255,255,0.2)",
                              background: "rgba(231,76,60,0.18)",
                              color: "#f5f5f5",
                              cursor: "pointer",
                              fontSize: 11
                            }}
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {equipSubTab === "loot" && (
              <div
                style={{
                  marginTop: 10,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(12,12,18,0.75)",
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>Boite a loot infinie</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                  Ajoutez des items pour tester.
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Armes</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 6
                  }}
                >
                  {weaponOptions.map(weapon => (
                    <button
                      key={`loot-weapon-${weapon.id}`}
                      type="button"
                      onClick={() => addManualItem(`weapon:${weapon.id}`)}
                      style={{
                        textAlign: "left",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(10,10,16,0.8)",
                        color: "#f5f5f5",
                        padding: "6px 8px",
                        cursor: "pointer",
                        fontSize: 12
                      }}
                    >
                      + {weapon.name} ({weapon.subtype})
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Outils</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 6
                  }}
                >
                  {toolItems.map(tool => (
                    <button
                      key={`loot-tool-${tool.id}`}
                      type="button"
                      onClick={() => addManualItem(`tool:${tool.id}`)}
                      style={{
                        textAlign: "left",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(10,10,16,0.8)",
                        color: "#f5f5f5",
                        padding: "6px 8px",
                        cursor: "pointer",
                        fontSize: 12
                      }}
                    >
                      + {tool.label}
                    </button>
                  ))}
                  {toolItems.length === 0 && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Aucun outil disponible.
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Armures</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 6
                  }}
                >
                  {armorItems.map(armor => (
                    <button
                      key={`loot-armor-${armor.id}`}
                      type="button"
                      onClick={() => addManualItem(`armor:${armor.id}`)}
                      style={{
                        textAlign: "left",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(10,10,16,0.8)",
                        color: "#f5f5f5",
                        padding: "6px 8px",
                        cursor: "pointer",
                        fontSize: 12
                      }}
                    >
                      + {armor.label}
                    </button>
                  ))}
                  {armorItems.length === 0 && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Aucune armure chargee pour l'instant.
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Autres</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 6
                  }}
                >
                  {objectItems.map(obj => (
                    <button
                      key={`loot-object-${obj.id}`}
                      type="button"
                      onClick={() => addManualItem(`object:${obj.id}`)}
                      style={{
                        textAlign: "left",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(10,10,16,0.8)",
                        color: "#f5f5f5",
                        padding: "6px 8px",
                        cursor: "pointer",
                        fontSize: 12
                      }}
                    >
                      + {obj.label}
                    </button>
                  ))}
                  {objectItems.length === 0 && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Aucun autre item charge pour l'instant.
                    </div>
                  )}
                </div>
              </div>
            )}
            </>
          )}

          {activeMainTab === "player" && activePlayerTab === "stats" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                  Ajustez les caracteristiques. Le modificateur se met a jour.
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {([
                    { id: "normal", label: "Normal" },
                    { id: "manual", label: "Manuel" }
                  ] as const).map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setStatsMode(mode.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background:
                          statsMode === mode.id
                            ? "rgba(79,125,242,0.2)"
                            : "rgba(255,255,255,0.06)",
                        color: "#f5f5f5",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 700
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => !isSectionLocked("stats") && resetStats()}
                  disabled={isSectionLocked("stats")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.08)",
                    color: "#f5f5f5",
                    cursor: isSectionLocked("stats") ? "not-allowed" : "pointer",
                    fontSize: 11,
                    fontWeight: 700,
                    opacity: isSectionLocked("stats") ? 0.6 : 1
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => toggleSectionLock("stats")}
                  style={{
                    marginLeft: "auto",
                    padding: "4px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: isSectionLocked("stats")
                      ? "rgba(231,76,60,0.18)"
                      : "rgba(46, 204, 113, 0.16)",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {isSectionLocked("stats") ? "Deverouiller" : "Verouiller"}
                </button>
              </div>
              {(() => {
                const summary = getPointBuySummary();
                if (statsMode !== "normal") {
                  return (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: "rgba(255,255,255,0.7)",
                        display: "flex",
                        gap: 10,
                        alignItems: "center"
                      }}
                    >
                      <span>Capital: illimite (mode manuel)</span>
                    </div>
                  );
                }
                return (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.7)",
                      display: "flex",
                      gap: 10,
                      alignItems: "center"
                    }}
                  >
                    <span>Points: 27</span>
                    {summary.invalid ? (
                      <span style={{ color: "#f1c40f" }}>Hors barème (8-15)</span>
                    ) : (
                      <>
                        <span>Utilises: {summary.total}</span>
                        <span
                          style={{
                            color:
                              summary.remaining !== null && summary.remaining < 0
                                ? "#e74c3c"
                                : "#6fd3a8"
                          }}
                        >
                          Restants: {summary.remaining ?? "-"}
                        </span>
                      </>
                    )}
                    <span>
                      Regle: acquisition par points (8-15). Bonus via classe/historique/espece.
                    </span>
                  </div>
                );
              })()}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 10
                }}
              >
                {STAT_KEYS.map(stat => {
                  const baseScore = getBaseScore(stat);
                  const bonus = getBonusSumForStat(stat);
                  const totalScore = Math.max(1, Math.min(30, baseScore + bonus));
                  const mod = computeMod(totalScore);
                  const sources = getStatSources(stat);
                  const canDecrease =
                    !isSectionLocked("stats") &&
                    (statsMode !== "normal" || canAdjustPointBuy(stat, -1));
                  const canIncrease =
                    !isSectionLocked("stats") &&
                    (statsMode !== "normal" || canAdjustPointBuy(stat, 1));
                  return (
                    <div
                      key={stat}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(12,12,18,0.75)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {stat}
                        {sources.length > 0 && renderSourceDots(sources)}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "30px 1fr 30px",
                          gap: 6,
                          alignItems: "center"
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => canDecrease && setScore(stat, totalScore - 1)}
                          disabled={!canDecrease}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 6,
                            border: "1px solid #333",
                            background: "#141421",
                            color: "#f5f5f5",
                            cursor: canDecrease ? "pointer" : "not-allowed",
                            opacity: canDecrease ? 1 : 0.5,
                            display: "grid",
                            placeItems: "center"
                          }}
                          aria-label={`Diminuer ${stat}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                          </svg>
                        </button>
                        <input
                          type="number"
                          min={statsMode === "normal" ? 8 : 1}
                          max={statsMode === "normal" ? 15 : 30}
                          value={totalScore}
                          onChange={e =>
                            !isSectionLocked("stats") && setScore(stat, Number(e.target.value))
                          }
                          disabled={isSectionLocked("stats")}
                          style={{
                            width: "100%",
                            background: "#0f0f19",
                            color: "#f5f5f5",
                            border: "1px solid #333",
                            borderRadius: 6,
                            padding: "4px 6px",
                            textAlign: "center",
                            appearance: "textfield",
                            WebkitAppearance: "textfield",
                            MozAppearance: "textfield"
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => canIncrease && setScore(stat, totalScore + 1)}
                          disabled={!canIncrease}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 6,
                            border: "1px solid #333",
                            background: "#141421",
                            color: "#f5f5f5",
                            cursor: canIncrease ? "pointer" : "not-allowed",
                            opacity: canIncrease ? 1 : 0.5,
                            display: "grid",
                            placeItems: "center"
                          }}
                          aria-label={`Augmenter ${stat}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                            <rect x="5.25" y="2" width="1.5" height="8" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                        Base: {baseScore}
                        {bonus !== 0 && (
                          <span style={{ marginLeft: 6 }}>
                            Bonus: {bonus > 0 ? `+${bonus}` : bonus}
                          </span>
                        )}
                        <span style={{ marginLeft: 6 }}>Total: {totalScore}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                        Modificateur: {mod >= 0 ? `+${mod}` : mod}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeMainTab === "player" && activePlayerTab === "skills" && (
            <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                Cochez les competences pour simuler les impacts de jeu.
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {([
                  { id: "normal", label: "Normal" },
                  { id: "manual", label: "Manuel" }
                ] as const).map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSkillsMode(mode.id)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background:
                        skillsMode === mode.id
                          ? "rgba(79,125,242,0.2)"
                          : "rgba(255,255,255,0.06)",
                      color: "#f5f5f5",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => !isSectionLocked("skills") && resetSkills()}
                disabled={isSectionLocked("skills")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#f5f5f5",
                  cursor: isSectionLocked("skills") ? "not-allowed" : "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: isSectionLocked("skills") ? 0.6 : 1
                }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => toggleSectionLock("skills")}
                style={{
                  marginLeft: "auto",
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: isSectionLocked("skills")
                    ? "rgba(231,76,60,0.18)"
                    : "rgba(46, 204, 113, 0.16)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700
                }}
              >
                {isSectionLocked("skills") ? "Deverouiller" : "Verouiller"}
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 10
              }}
            >
              {competenceOptions.map(skill => (
                <div
                  key={skill.id}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(12,12,18,0.75)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{skill.label}</div>
                    {renderSourceDots(getSkillSources(skill.id))}
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                      {skillAbilityMap[skill.id]}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={competences.includes(skill.id)}
                        onChange={() => canEditSkills && toggleCompetence(skill.id)}
                        disabled={!canEditSkills}
                        style={{ accentColor: "#4f7df2" }}
                      />
                      <span style={{ fontSize: 12 }}>Maitrise</span>
                    </label>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={expertises.includes(skill.id)}
                        onChange={() => canEditSkills && toggleExpertise(skill.id)}
                        disabled={!canEditSkills || !competences.includes(skill.id)}
                        style={{ accentColor: "#f1c40f" }}
                      />
                      <span style={{ fontSize: 12 }}>Expertise</span>
                    </label>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                    Bonus: {(() => {
                      const level = resolveLevel();
                      const prof = 2 + Math.floor((level - 1) / 4);
                      const abilityKey = skillAbilityMap[skill.id];
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
                      const isExpert = expertises.includes(skill.id);
                      const isProf = competences.includes(skill.id);
                      const bonus = mod + (isExpert ? prof * 2 : isProf ? prof : 0);
                      return bonus >= 0 ? `+${bonus}` : bonus;
                    })()}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}

          {activeMainTab === "player" && activePlayerTab === "masteries" && (
            <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                Selectionnez les maitrises. Elles influenceront les bonus et malus.
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {([
                  { id: "normal", label: "Normal" },
                  { id: "manual", label: "Manuel" }
                ] as const).map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setMasteriesMode(mode.id)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background:
                        masteriesMode === mode.id
                          ? "rgba(79,125,242,0.2)"
                          : "rgba(255,255,255,0.06)",
                      color: "#f5f5f5",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => !isSectionLocked("masteries") && resetMasteries()}
                disabled={isSectionLocked("masteries")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#f5f5f5",
                  cursor: isSectionLocked("masteries") ? "not-allowed" : "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: isSectionLocked("masteries") ? 0.6 : 1
                }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => toggleSectionLock("masteries")}
                style={{
                  marginLeft: "auto",
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: isSectionLocked("masteries")
                    ? "rgba(231,76,60,0.18)"
                    : "rgba(46, 204, 113, 0.16)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700
                }}
              >
                {isSectionLocked("masteries") ? "Deverouiller" : "Verouiller"}
              </button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Armes</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {weaponMasteryOptions.map(value => (
                <label key={value.id} style={{ fontSize: 12, display: "flex", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={weaponMasteries.includes(value.id)}
                    onChange={() =>
                      canEditMasteries && toggleMastery("weapons", value.id)
                    }
                    disabled={!canEditMasteries}
                  />
                  {value.label}
                  {renderSourceDots(getMasterySources("weapons", value.id))}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 10 }}>Armures</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {armorMasteryOptions.map(value => (
                <label key={value.id} style={{ fontSize: 12, display: "flex", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={armorMasteries.includes(value.id)}
                    onChange={() =>
                      canEditMasteries && toggleMastery("armors", value.id)
                    }
                    disabled={!canEditMasteries}
                  />
                  {value.label}
                  {renderSourceDots(getMasterySources("armors", value.id))}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 10 }}>Outils</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {toolMasteryOptions.map(value => (
                <label key={value.id} style={{ fontSize: 12, display: "flex", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={toolMasteries.includes(value.id)}
                    onChange={() =>
                      canEditMasteries && toggleMastery("tools", value.id)
                    }
                    disabled={!canEditMasteries}
                  />
                  {value.label}
                  {renderSourceDots(getMasterySources("tools", value.id))}
                </label>
              ))}
            </div>
            </>
          )}

          {activeMainTab === "player" && activePlayerTab === "species" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                  Choisissez une espece. Ce choix met a jour raceId dans le personnage.
                </div>
              <button
                type="button"
                onClick={() => {
                  if (isSectionLocked("species")) {
                    setSectionLock("species", false);
                    return;
                  }
                  if (!requireRaceChoices()) {
                    setSectionLock("species", true);
                  } else {
                    props.onChangeCharacter({
                      ...props.character,
                      choiceSelections: {
                        ...choiceSelections,
                        pendingLocks: { ...pendingLocks, species: true }
                      }
                    });
                  }
                }}
                style={{
                    marginLeft: "auto",
                    padding: "4px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: isSectionLocked("species")
                      ? "rgba(231,76,60,0.18)"
                      : "rgba(46, 204, 113, 0.16)",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {isSectionLocked("species") ? "Deverouiller" : "Verouiller"}
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1.1fr) minmax(240px, 1fr)",
                  gap: 12,
                  alignItems: "start"
                }}
              >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                  alignContent: "start"
                }}
              >
                {raceOptions.map(race => {
                  const isSelected = selectedRaceId === race.id;
                  return (
                    <button
                      key={race.id}
                      type="button"
                      onClick={() => handleSpeciesSelect(race.id)}
                      disabled={isSectionLocked("species")}
                      style={{
                        textAlign: "left",
                        borderRadius: 10,
                        border: `1px solid ${isSelected ? "#6fd3a8" : "rgba(255,255,255,0.12)"}`,
                        background: isSelected ? "rgba(46, 204, 113, 0.14)" : "rgba(12,12,18,0.75)",
                        color: "#f5f5f5",
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        minHeight: 120,
                        opacity: isSectionLocked("species") ? 0.6 : 1,
                        cursor: isSectionLocked("species") ? "not-allowed" : "pointer"
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{race.label}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                        {race.description}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                        ID: {race.id}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(12,12,18,0.75)",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  minHeight: 260
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    borderRadius: 10,
                    border: "1px dashed rgba(255,255,255,0.18)",
                    background: "rgba(8,8,12,0.65)",
                    display: "grid",
                    placeItems: "center",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 12
                  }}
                >
                  Image 16:9
                </div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>
                  {activeRace ? activeRace.label : "Selectionnez une espece"}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
                  {activeRace
                    ? activeRace.description
                    : "Selectionnez une espece pour voir les details."}
                </div>
                {activeRace && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    Vitesse: {activeRace.speed ?? "?"} | Taille: {activeRace.size ?? "?"}
                  </div>
                )}
                {activeRace && activeRace.traits && activeRace.traits.length > 0 && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    Traits: {activeRace.traits.map(trait => trait.label).join(", ")}
                  </div>
                )}
                {activeRace && activeRace.vision?.mode && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    Vision: {activeRace.vision.mode}
                    {activeRace.vision.range ? ` ${activeRace.vision.range}ft` : ""}
                  </div>
                )}
              </div>
              </div>
            </>
          )}

          {activeMainTab === "player" && activePlayerTab === "classes" && (
            <>
              <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                Definissez le niveau global, puis choisissez vos classes.
              </div>
              <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                <span>Niveau global :</span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 6px",
                    borderRadius: 8,
                    border: "1px solid #2a2a3a",
                    background: "#0f0f19"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => !isClassLocked && setLevel(resolveLevel() - 1)}
                    disabled={isClassLocked}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 6,
                      border: "1px solid #333",
                      background: "#141421",
                      color: "#f5f5f5",
                      cursor: isClassLocked ? "not-allowed" : "pointer",
                      display: "grid",
                      placeItems: "center",
                      opacity: isClassLocked ? 0.6 : 1
                    }}
                    aria-label="Diminuer le niveau"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                    </svg>
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={resolveLevel()}
                    onChange={e => !isClassLocked && setLevel(Number(e.target.value))}
                    disabled={isClassLocked}
                    style={{
                      width: 60,
                      background: "#0f0f19",
                      color: "#f5f5f5",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: "4px 6px",
                      textAlign: "center",
                      appearance: "textfield",
                      WebkitAppearance: "textfield",
                      MozAppearance: "textfield",
                      opacity: isClassLocked ? 0.6 : 1
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => !isClassLocked && setLevel(resolveLevel() + 1)}
                    disabled={isClassLocked}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 6,
                      border: "1px solid #333",
                      background: "#141421",
                      color: "#f5f5f5",
                      cursor: isClassLocked ? "not-allowed" : "pointer",
                      display: "grid",
                      placeItems: "center",
                      opacity: isClassLocked ? 0.6 : 1
                    }}
                    aria-label="Augmenter le niveau"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                      <rect x="5.25" y="2" width="1.5" height="8" fill="currentColor" />
                    </svg>
                  </button>
                </div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Bonus de maitrise: +{2 + Math.floor((resolveLevel() - 1) / 4)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (isClassLocked) {
                      setClassLock(false);
                      return;
                    }
                    if (!requireClassChoices()) {
                      setClassLock(true);
                    } else {
                      props.onChangeCharacter({
                        ...props.character,
                        choiceSelections: {
                          ...choiceSelections,
                          pendingLocks: { ...pendingLocks, classes: true }
                        }
                      });
                    }
                  }}
                  style={{
                    marginLeft: "auto",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: isClassLocked ? "rgba(231,76,60,0.18)" : "rgba(46, 204, 113, 0.16)",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  {isClassLocked ? "Deverouiller" : "Verouiller"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setActiveClassTab("primary")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${
                      resolvedClassTab === "primary" ? "#6fd3a8" : "#333"
                    }`,
                    background:
                      resolvedClassTab === "primary" ? "rgba(46, 204, 113, 0.16)" : "#0f0f19",
                    color: "#c9cfdd",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  Classe principale
                </button>
                {resolveLevel() > 2 && (
                  <button
                    type="button"
                    onClick={() => setActiveClassTab("secondary")}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: `1px solid ${
                        resolvedClassTab === "secondary" ? "#6fd3a8" : "#333"
                      }`,
                      background:
                        resolvedClassTab === "secondary" ? "rgba(46, 204, 113, 0.16)" : "#0f0f19",
                      color: "#c9cfdd",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    2eme classe
                  </button>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1.1fr) minmax(240px, 1fr)",
                  gap: 12,
                  alignItems: "start"
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    alignContent: "start"
                  }}
                >
                  {resolvedClassTab === "secondary" && !isSecondaryEnabled && (
                    <button
                      type="button"
                      onClick={() => !isClassLocked && enableSecondaryClass()}
                      disabled={isClassLocked}
                      style={{
                        textAlign: "center",
                        borderRadius: 12,
                        border: "1px dashed rgba(255,255,255,0.25)",
                        background: "rgba(12,12,18,0.6)",
                        color: "#f5f5f5",
                        padding: 14,
                        cursor: isClassLocked ? "not-allowed" : "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 180
                      }}
                    >
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.25)",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 28,
                          fontWeight: 700
                        }}
                      >
                        +
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                        Activer une 2eme classe
                      </div>
                    </button>
                  )}
                  {classOptions.map(cls => {
                    const isSelected = activeClassId === cls.id;
                    const isDisabled = isClassLocked || (resolvedClassTab === "secondary" && !isSecondaryEnabled);
                    return (
                      <button
                        key={`${resolvedClassTab}-${cls.id}`}
                        type="button"
                        onClick={() => {
                          if (isDisabled) return;
                          handleClassSelect(cls, activeClassSlot);
                        }}
                        disabled={isDisabled}
                        style={{
                          textAlign: "left",
                          borderRadius: 10,
                          border: `1px solid ${isSelected ? "#6fd3a8" : "rgba(255,255,255,0.12)"}`,
                          background: isSelected
                            ? "rgba(46, 204, 113, 0.14)"
                            : "rgba(12,12,18,0.75)",
                          color: "#f5f5f5",
                          padding: 12,
                          cursor: isDisabled ? "not-allowed" : "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          minHeight: 120,
                          opacity: isDisabled ? 0.55 : 1
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{cls.label}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          {cls.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(12,12,18,0.75)",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    minHeight: 260
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800 }}>
                    {resolvedClassTab === "secondary" ? "2eme classe" : "Classe principale"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    Niveau dans cette classe :
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 6px",
                      borderRadius: 8,
                      border: "1px solid #2a2a3a",
                      background: "#0f0f19",
                      width: "fit-content"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        !isClassLocked &&
                        setClassLevel(activeClassSlot, (Number(activeClassEntry?.niveau) || 1) - 1)
                      }
                      disabled={isClassLocked || (resolvedClassTab === "secondary" && !isSecondaryEnabled)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 6,
                        border: "1px solid #333",
                        background: "#141421",
                        color: "#f5f5f5",
                        cursor: isClassLocked ? "not-allowed" : "pointer",
                        display: "grid",
                        placeItems: "center",
                        opacity: isClassLocked ? 0.6 : 1
                      }}
                      aria-label="Diminuer le niveau de classe"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                        <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                      </svg>
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={isSecondaryEnabled ? Math.max(1, resolveLevel() - 1) : resolveLevel()}
                      value={
                        activeClassEntry?.niveau ??
                        (activeClassSlot === 1 ? resolveLevel() : 0)
                      }
                      onChange={e =>
                        !isClassLocked && setClassLevel(activeClassSlot, Number(e.target.value))
                      }
                      disabled={isClassLocked || (resolvedClassTab === "secondary" && !isSecondaryEnabled)}
                      style={{
                        width: 60,
                        background: "#0f0f19",
                        color: "#f5f5f5",
                        border: "1px solid #333",
                        borderRadius: 6,
                        padding: "4px 6px",
                        textAlign: "center",
                        appearance: "textfield",
                        WebkitAppearance: "textfield",
                        MozAppearance: "textfield",
                        opacity: isClassLocked ? 0.6 : 1
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        !isClassLocked &&
                        setClassLevel(activeClassSlot, (Number(activeClassEntry?.niveau) || 1) + 1)
                      }
                      disabled={isClassLocked || (resolvedClassTab === "secondary" && !isSecondaryEnabled)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 6,
                        border: "1px solid #333",
                        background: "#141421",
                        color: "#f5f5f5",
                        cursor: isClassLocked ? "not-allowed" : "pointer",
                        display: "grid",
                        placeItems: "center",
                        opacity: isClassLocked ? 0.6 : 1
                      }}
                      aria-label="Augmenter le niveau de classe"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                        <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                        <rect x="5.25" y="2" width="1.5" height="8" fill="currentColor" />
                      </svg>
                    </button>
                  </div>

                  {(() => {
                    const asiLevels = getClassAsiLevels();
                    if (asiLevels.length === 0) return null;
                    return (
                      <div
                        style={{
                          marginTop: 10,
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(12,12,18,0.75)",
                          padding: 10,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700 }}>
                          Amelioration / Don
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                          Choisissez une amelioration de caracteristiques (+2 ou +1/+1),
                          ou un don (non disponible pour l'instant).
                        </div>
                        {asiLevels.map(entryInfo => {
                          const entry = getAsiEntryForLevel(entryInfo);
                          const type = entry?.type ?? "asi";
                          const label =
                            type === "feat"
                              ? "Don"
                              : entry?.stats && Object.keys(entry.stats).length > 0
                                ? formatAsiStats(entry.stats)
                                : "Non choisi";
                          return (
                            <div
                              key={`asi-entry-${entryInfo.key}`}
                              style={{
                                borderRadius: 6,
                                border: "1px solid rgba(255,255,255,0.12)",
                                background: "rgba(10,10,16,0.8)",
                                padding: 8,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6
                              }}
                            >
                              <div style={{ fontSize: 12, fontWeight: 700 }}>
                                Niveau {entryInfo.level} — {entryInfo.classLabel}
                              </div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                                Choix actuel: {label}
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => openAsiModal(entryInfo)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    background: "rgba(255,255,255,0.06)",
                                    color: "#f5f5f5",
                                    cursor: "pointer",
                                    fontSize: 11,
                                    fontWeight: 700
                                  }}
                                >
                                  Choisir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => clearAsiSelection(entryInfo.key)}
                                  style={{
                                    marginLeft: "auto",
                                    padding: "4px 8px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    background: "rgba(255,255,255,0.06)",
                                    color: "#f5f5f5",
                                    cursor: "pointer",
                                    fontSize: 11,
                                    fontWeight: 700
                                  }}
                                >
                                  Reset
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {resolvedClassTab === "secondary" && isSecondaryEnabled && (
                    <button
                      type="button"
                      onClick={() => !isClassLocked && removeSecondaryClass()}
                      disabled={isClassLocked}
                      style={{
                        marginTop: 8,
                        alignSelf: "flex-start",
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(231,76,60,0.14)",
                        color: "#f5f5f5",
                        cursor: isClassLocked ? "not-allowed" : "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        opacity: isClassLocked ? 0.6 : 1
                      }}
                    >
                      Supprimer la 2eme classe
                    </button>
                  )}

                  {(() => {
                    const cls = classOptions.find(c => c.id === activeClassId);
                    if (!cls) {
                      return (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                          Choisissez d'abord une classe.
                        </div>
                      );
                    }
                    const threshold = cls.subclassLevel ?? 1;
                    const level = Number(activeClassEntry?.niveau) || (activeClassSlot === 1 ? resolveLevel() : 0);
                    if (level < threshold) {
                      return (
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 10,
                            border: "1px dashed rgba(255,255,255,0.2)",
                            background: "rgba(8,8,12,0.6)",
                            color: "rgba(255,255,255,0.6)",
                            fontSize: 12
                          }}
                        >
                          Sous-classe verrouillee jusqu'au niveau {threshold}.
                        </div>
                      );
                    }
                    const allowedIds = Array.isArray(cls.subclassIds) ? cls.subclassIds : [];
                    const subclasses = subclassOptions.filter(sub => sub.classId === cls.id);
                    return (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: 10
                        }}
                      >
                        {subclasses.map(sub => {
                          const isAllowed = allowedIds.length === 0 || allowedIds.includes(sub.id);
                          const isSelected = activeSubclassId === sub.id;
                          return (
                            <button
                              key={`${activeClassSlot}-${sub.id}`}
                              type="button"
                              onClick={() => {
                                if (!isAllowed || isClassLocked) return;
                                setSubclassSelection(sub.id, activeClassSlot);
                              }}
                              disabled={!isAllowed || isClassLocked}
                              style={{
                                textAlign: "left",
                                borderRadius: 10,
                                border: `1px solid ${
                                  isSelected ? "#f1c40f" : "rgba(255,255,255,0.12)"
                                }`,
                                background: isSelected
                                  ? "rgba(241, 196, 15, 0.14)"
                                  : "rgba(12,12,18,0.75)",
                                color: "#f5f5f5",
                                padding: 12,
                                cursor: isAllowed && !isClassLocked ? "pointer" : "not-allowed",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                minHeight: 110,
                                opacity: isAllowed && !isClassLocked ? 1 : 0.5
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 800 }}>{sub.label}</div>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                                {sub.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

          {activeMainTab === "player" && activePlayerTab === "backgrounds" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                  Choisissez un historique. Un seul background peut etre actif.
                </div>
              <button
                type="button"
                onClick={() => {
                  if (isSectionLocked("backgrounds")) {
                    const bonusApplied = Boolean(
                      (choiceSelections as any)?.background?.statBonusApplied
                    );
                    if (!bonusApplied) {
                      setSectionLock("backgrounds", false);
                      return;
                    }
                    const current = (props.character.caracs?.force as any)?.FOR ?? 10;
                    const nextCaracs = {
                      ...props.character.caracs,
                      force: { ...(props.character.caracs?.force ?? {}), FOR: current - 1 }
                    };
                    const nextChoiceSelections = {
                      ...choiceSelections,
                      background: {
                        ...(choiceSelections as any).background,
                        statBonusApplied: false
                      },
                      statsBase: {
                        ...statsBase,
                        FOR: Number.isFinite(statsBase.FOR) ? statsBase.FOR : current - 1
                      }
                    };
                    props.onChangeCharacter({
                      ...props.character,
                      creationLocks: { ...creationLocks, backgrounds: false },
                      choiceSelections: nextChoiceSelections,
                      caracs: nextCaracs
                    });
                    return;
                  }
                  if (!requireBackgroundChoices()) {
                    const bonusApplied = Boolean(
                      (choiceSelections as any)?.background?.statBonusApplied
                    );
                    let nextCaracs = props.character.caracs;
                    const nextChoiceSelections = {
                      ...choiceSelections,
                      background: { ...(choiceSelections as any).background }
                    };
                    if (!bonusApplied && selectedBackgroundId === "veteran-de-guerre") {
                      const current = (props.character.caracs?.force as any)?.FOR ?? 10;
                      nextCaracs = {
                        ...props.character.caracs,
                        force: { ...(props.character.caracs?.force ?? {}), FOR: current + 1 }
                      };
                      (nextChoiceSelections as any).background.statBonusApplied = true;
                      (nextChoiceSelections as any).statsBase = {
                        ...statsBase,
                        FOR: Number.isFinite(statsBase.FOR) ? statsBase.FOR : current
                      };
                    }
                    props.onChangeCharacter({
                      ...props.character,
                      creationLocks: { ...creationLocks, backgrounds: true },
                      choiceSelections: nextChoiceSelections,
                      caracs: nextCaracs
                    });
                  } else {
                    props.onChangeCharacter({
                      ...props.character,
                      choiceSelections: {
                        ...choiceSelections,
                        pendingLocks: { ...pendingLocks, backgrounds: true }
                      }
                    });
                  }
                }}
                style={{
                    marginLeft: "auto",
                    padding: "4px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: isSectionLocked("backgrounds")
                      ? "rgba(231,76,60,0.18)"
                      : "rgba(46, 204, 113, 0.16)",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {isSectionLocked("backgrounds") ? "Deverouiller" : "Verouiller"}
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1.1fr) minmax(240px, 1fr)",
                  gap: 12,
                  alignItems: "start"
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    alignContent: "start"
                  }}
                >
                  {backgroundOptions.map(bg => {
                    const isSelected = selectedBackgroundId === bg.id;
                    return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => handleBackgroundSelect(bg)}
                      disabled={isSectionLocked("backgrounds")}
                      style={{
                          textAlign: "left",
                          borderRadius: 10,
                          border: `1px solid ${isSelected ? "#6fd3a8" : "rgba(255,255,255,0.12)"}`,
                          background: isSelected
                            ? "rgba(46, 204, 113, 0.14)"
                            : "rgba(12,12,18,0.75)",
                          color: "#f5f5f5",
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        minHeight: 120,
                        opacity: isSectionLocked("backgrounds") ? 0.6 : 1,
                        cursor: isSectionLocked("backgrounds") ? "not-allowed" : "pointer"
                      }}
                    >
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{bg.label}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                          {bg.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(12,12,18,0.75)",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    minHeight: 260
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      borderRadius: 10,
                      border: "1px dashed rgba(255,255,255,0.18)",
                      background: "rgba(8,8,12,0.65)",
                      display: "grid",
                      placeItems: "center",
                      color: "rgba(255,255,255,0.35)",
                      fontSize: 12
                    }}
                  >
                    Image 16:9
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>
                    {activeBackground ? activeBackground.label : "Selectionnez un historique"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
                    {activeBackground
                      ? activeBackground.description
                      : "Selectionnez un historique pour voir les details."}
                  </div>
                  {activeBackground?.skillProficiencies &&
                    activeBackground.skillProficiencies.length > 0 && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                        Competences:{" "}
                        {activeBackground.skillProficiencies
                          .map(id => competenceOptions.find(c => c.id === id)?.label ?? id)
                          .join(", ")}
                      </div>
                    )}
                  {activeBackground?.toolProficiencies &&
                    activeBackground.toolProficiencies.length > 0 && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                        Outils:{" "}
                        {activeBackground.toolProficiencies
                          .map(
                            id =>
                              toolMasteryOptions.find(t => t.id === id)?.label ?? id
                          )
                          .join(", ")}
                      </div>
                    )}
                  {activeBackground?.toolChoices && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Outils (choix {activeBackground.toolChoices.count}):{" "}
                      {(activeBackground.toolChoices.options ?? [])
                        .map(
                          id =>
                            toolMasteryOptions.find(t => t.id === id)?.label ?? id
                        )
                        .join(", ")}
                    </div>
                  )}
                  {activeBackground?.toolNotes && activeBackground.toolNotes.length > 0 && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Outils: {activeBackground.toolNotes.join(", ")}
                    </div>
                  )}
                  {activeBackground?.languageChoices && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Langues: {activeBackground.languageChoices.count} au choix
                    </div>
                  )}
                  {activeBackground?.equipment && activeBackground.equipment.length > 0 && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Materiel: {activeBackground.equipment.map(formatEquipmentLabel).join(", ")}
                    </div>
                  )}
                  {activeBackground?.feature && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                      Aptitude: {activeBackground.feature.name}
                      {activeBackground.feature.description
                        ? ` — ${activeBackground.feature.description}`
                        : ""}
                    </div>
                  )}
                  {activeBackground?.traits?.bond && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Lien: {activeBackground.traits.bond}
                    </div>
                  )}
                  {activeBackground?.traits?.flaw && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      Defaut: {activeBackground.traits.flaw}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeMainTab === "player" && activePlayerTab === "profile" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                  Renseignez le profil du personnage (pre-rempli).
                </div>
                <button
                  type="button"
                  onClick={() => toggleSectionLock("profile")}
                  style={{
                    marginLeft: "auto",
                    padding: "4px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: isSectionLocked("profile")
                      ? "rgba(231,76,60,0.18)"
                      : "rgba(46, 204, 113, 0.16)",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {isSectionLocked("profile") ? "Deverouiller" : "Verouiller"}
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
                    value={props.character.nom?.prenom ?? ""}
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
                    value={props.character.nom?.nomcomplet ?? ""}
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
                    value={props.character.nom?.surnom ?? ""}
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
                  value={props.character.descriptionPersonnage?.physique ?? ""}
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
          )}
        </div>
      </div>
          {asiModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div
            style={{
              width: "min(560px, 92vw)",
              background: "#141421",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800 }}>
              {asiModal.entry
                ? `Niveau ${asiModal.entry.level} — ${asiModal.entry.classLabel}`
                : "Choix d'amelioration"}
            </div>
            {asiModal.step === "type" && (
              <>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Souhaitez-vous augmenter les caracteristiques ou choisir un don ?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {([
                    { id: "asi", label: "Augmenter les caracteristiques" },
                    { id: "feat", label: "Choisir un don" }
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAsiModalType(opt.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background:
                          asiModal.type === opt.id
                            ? "rgba(79,125,242,0.2)"
                            : "rgba(255,255,255,0.06)",
                        color: "#f5f5f5",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={closeAsiModal}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#f5f5f5",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    onClick={confirmAsiModalType}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(46, 204, 113, 0.16)",
                      color: "#f5f5f5",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    Valider
                  </button>
                </div>
              </>
            )}
            {asiModal.step === "feat" && (
              <>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Dons indisponibles pour l'instant.
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setAsiModal(prev => ({ ...prev, step: "type" }))}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#f5f5f5",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={closeAsiModal}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#f5f5f5",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}
            {asiModal.step === "asi" && (
              <>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Capital disponible :{" "}
                  {2 -
                    Object.values(asiModal.stats).reduce(
                      (sum, value) => sum + (Number(value) || 0),
                      0
                    )}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 8
                  }}
                >
                  {STAT_KEYS.map(stat => {
                    const base = getBaseScore(stat);
                    const nonAsi = getNonAsiBonusSumForStat(stat);
                    const original = Number(asiModal.originalStats[stat] ?? 0) || 0;
                    const totalAsi = Number(asiBonusMap[stat] ?? 0) || 0;
                    const otherAsi = Math.max(0, totalAsi - original);
                    const current = Number(asiModal.stats[stat] ?? 0) || 0;
                    const total = base + nonAsi + otherAsi + current;
                    const spent = Object.values(asiModal.stats).reduce(
                      (sum, value) => sum + (Number(value) || 0),
                      0
                    );
                    const remaining = Math.max(0, 2 - spent);
                    const canIncrease = remaining > 0 && current < 2 && total < 20;
                    const canDecrease = current > 0;
                    return (
                      <div
                        key={`asi-modal-${stat}`}
                        style={{
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(10,10,16,0.8)",
                          padding: 8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{stat}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                            Total: {Math.min(20, total)}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => canDecrease && updateAsiModalStat(stat, -1)}
                            disabled={!canDecrease}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 6,
                              border: "1px solid #333",
                              background: canDecrease ? "#141421" : "rgba(80,80,90,0.55)",
                              color: "#f5f5f5",
                              cursor: canDecrease ? "pointer" : "not-allowed",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            -
                          </button>
                          <div style={{ minWidth: 24, textAlign: "center", fontSize: 12 }}>
                            +{current}
                          </div>
                          <button
                            type="button"
                            onClick={() => canIncrease && updateAsiModalStat(stat, 1)}
                            disabled={!canIncrease}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 6,
                              border: "1px solid #333",
                              background: canIncrease ? "#141421" : "rgba(80,80,90,0.55)",
                              color: "#f5f5f5",
                              cursor: canIncrease ? "pointer" : "not-allowed",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setAsiModal(prev => ({ ...prev, step: "type" }))}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#f5f5f5",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={confirmAsiModalStats}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(46, 204, 113, 0.16)",
                      color: "#f5f5f5",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    Valider
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
          {choiceModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999
          }}
        >
          <div
            style={{
              width: "min(520px, 92vw)",
              background: "#141421",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800 }}>{choiceModal.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Choix requis: {choiceModal.count} {choiceModal.count > 1 ? "elements" : "element"}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 8
              }}
            >
              {choiceModal.options.map(option => {
                const isSelected = choiceModal.selected.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      const already = choiceModal.selected.includes(option.id);
                      let next = choiceModal.selected;
                      if (choiceModal.multi) {
                        next = already
                          ? next.filter(item => item !== option.id)
                          : [...next, option.id];
                      } else {
                        next = already ? [] : [option.id];
                      }
                      setChoiceModal(prev => ({ ...prev, selected: next }));
                    }}
                    style={{
                      textAlign: "left",
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? "#6fd3a8" : "rgba(255,255,255,0.12)"}`,
                      background: isSelected
                        ? "rgba(46, 204, 113, 0.14)"
                        : "rgba(12,12,18,0.75)",
                      color: "#f5f5f5",
                      padding: "8px 10px",
                      cursor: "pointer",
                      fontSize: 12
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closeChoiceModal}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  if (choiceModal.selected.length < choiceModal.count) return;
                  choiceModal.onConfirm(choiceModal.selected.slice(0, choiceModal.count));
                  closeChoiceModal();
                }}
                disabled={choiceModal.selected.length < choiceModal.count}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background:
                    choiceModal.selected.length < choiceModal.count
                      ? "rgba(80,80,90,0.55)"
                      : "rgba(46, 204, 113, 0.16)",
                  color: "#f5f5f5",
                  cursor:
                    choiceModal.selected.length < choiceModal.count ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 998
          }}
        >
          <div
            style={{
              width: "min(480px, 92vw)",
              background: "#141421",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800 }}>{confirmModal.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              {confirmModal.message}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closeConfirmModal}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm()}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(231, 76, 60, 0.2)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
