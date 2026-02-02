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

  const setScores = (scores: Record<string, number>) => {
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
    props.onChangeCharacter({
      ...props.character,
      caracs: nextCaracs,
      combatStats: nextCombatStats
    });
  };

  const resetStats = () => {
    if (!initialStatsRef.current) return;
    setScores(initialStatsRef.current);
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
    const nextChoiceSelections = { ...choiceSelections, background: { ...(choiceSelections as any).background } };
    const nextAuto = Array.isArray(bg.equipment) ? bg.equipment : [];
    const manualIds = equipmentManual;
    const nextInventory = buildInventoryFromAutoManual(nextAuto, manualIds);
    props.onChangeCharacter({
      ...props.character,
      backgroundId: bg.id,
      competences: nextSkills,
      proficiencies: nextProfs,
      choiceSelections: nextChoiceSelections,
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
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: { ...nextChoiceSelections, pendingLocks: nextPending },
      proficiencies: nextProfs,
      creationLocks: pendingLocks.backgrounds
        ? { ...creationLocks, backgrounds: true }
        : creationLocks
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
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: { ...nextChoiceSelections, pendingLocks: nextPending },
      langues: nextLangues,
      creationLocks: pendingLocks.backgrounds
        ? { ...creationLocks, backgrounds: true }
        : creationLocks
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
    const nextMaterielSlots =
      props.character?.materielSlots && typeof props.character.materielSlots === "object"
        ? Object.keys(props.character.materielSlots).reduce((acc, key) => {
            (acc as any)[key] = null;
            return acc;
          }, {} as Record<string, any>)
        : props.character.materielSlots;
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
            equippedSlot: null
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

  const buildInventoryFromAutoManual = (autoIds: string[], manualIds: string[]) => {
    const autoItems = autoIds.map(id => ({
      ...resolveItemType(id),
      qty: 1,
      source: "auto",
      equippedSlot: null
    }));
    const manualItems = manualIds.map(id => ({
      ...resolveItemType(id),
      qty: 1,
      source: "manual",
      equippedSlot: null
    }));
    return [...autoItems, ...manualItems];
  };

  const addManualItem = (id: string) => {
    const nextManual = [...equipmentManual, id];
    const nextInventory = [
      ...inventoryItems,
      { ...resolveItemType(id), qty: 1, source: "manual", equippedSlot: null }
    ];
    props.onChangeCharacter({
      ...props.character,
      equipmentManual: nextManual,
      inventoryItems: nextInventory
    });
  };

  const removeManualItem = (index: number) => {
    const nextManual = equipmentManual.filter((_, idx) => idx !== index);
    let manualIndex = -1;
    const nextInventory = inventoryItems.filter(item => {
      if (item.source !== "manual") return true;
      manualIndex += 1;
      return manualIndex !== index;
    });
    props.onChangeCharacter({
      ...props.character,
      equipmentManual: nextManual,
      inventoryItems: nextInventory
    });
  };

  const updateItemSlot = (index: number, slot: string | null) => {
    const slots = { ...(props.character.materielSlots ?? {}) } as Record<string, any>;
    const nextInventory = inventoryItems.map((item, idx) => {
      if (idx !== index) {
        if (slot && item.equippedSlot === slot) {
          return { ...item, equippedSlot: null };
        }
        return item;
      }
      return { ...item, equippedSlot: slot };
    });
    if (slot) {
      slots[slot] = inventoryItems[index]?.id ?? null;
    }
    props.onChangeCharacter({
      ...props.character,
      materielSlots: slots,
      inventoryItems: nextInventory
    });
  };

  useEffect(() => {
    if (inventoryInitRef.current) return;
    if (inventoryItems.length === 0 && (equipmentAuto.length > 0 || equipmentManual.length > 0)) {
      const nextInventory = buildInventoryFromAutoManual(equipmentAuto, equipmentManual);
      inventoryInitRef.current = true;
      props.onChangeCharacter({ ...props.character, inventoryItems: nextInventory });
    }
  }, [inventoryItems.length, equipmentAuto, equipmentManual, props.character, props.onChangeCharacter]);
  };

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
        props.onChangeCharacter({
          ...props.character,
          creationLocks: nextLocks,
          choiceSelections: nextChoiceSelections,
          competences: nextCompetences,
          classLock: false
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

  const initialStatsRef = useRef<Record<string, number> | null>(null);
  if (!initialStatsRef.current) {
    initialStatsRef.current = {
      FOR: getScore("FOR"),
      DEX: getScore("DEX"),
      CON: getScore("CON"),
      INT: getScore("INT"),
      SAG: getScore("SAG"),
      CHA: getScore("CHA")
    };
  }

  const computeMod = (score: number): number => Math.floor((score - 10) / 2);

  const setScore = (key: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA", value: number) => {
    const nextScore = Math.max(1, Math.min(30, Math.floor(value || 1)));
    const mapping: Record<string, keyof Personnage["caracs"]> = {
      FOR: "force",
      DEX: "dexterite",
      CON: "constitution",
      INT: "intelligence",
      SAG: "sagesse",
      CHA: "charisme"
    };
    const caracKey = mapping[key];
    const nextCaracs = {
      ...props.character.caracs,
      [caracKey]: {
        ...(props.character.caracs?.[caracKey] ?? {}),
        [key]: nextScore
      }
    };
    const nextMods = {
      ...(props.character.combatStats?.mods ?? {}),
      [key === "FOR"
        ? "str"
        : key === "DEX"
          ? "dex"
          : key === "CON"
            ? "con"
            : key === "INT"
              ? "int"
              : key === "SAG"
                ? "wis"
                : "cha"]: computeMod(nextScore)
    } as any;
    const nextCombatStats = {
      ...(props.character.combatStats ?? {}),
      mods: nextMods
    };
    props.onChangeCharacter({
      ...props.character,
      caracs: nextCaracs,
      combatStats: nextCombatStats
    });
  };

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
                Choisissez les armes equipees. Les actions disponibles s&apos;adapteront a ces choix.
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
                  disabled={isSectionLocked("equip")}
                  style={{
                    background: "#0f0f19",
                    color: "#f5f5f5",
                    border: "1px solid #333",
                    borderRadius: 6,
                    padding: "6px 8px",
                    fontSize: 12,
                    opacity: isSectionLocked("equip") ? 0.6 : 1
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12
              }}
            >
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
                <div style={{ fontSize: 12, fontWeight: 700 }}>Equipement auto</div>
                {equipmentAuto.length === 0 && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    Aucun equipement automatique.
                  </div>
                )}
                {inventoryItems
                  .map((item, idx) => ({ item, idx }))
                  .filter(entry => entry.item.source === "auto")
                  .map(({ item, idx }) => {
                    const label =
                      item.type === "object"
                        ? objectItemMap.get(item.id)?.label ?? item.id
                        : item.type === "armor"
                          ? armorItemMap.get(item.id)?.label ?? item.id
                          : item.type === "tool"
                            ? toolItemMap.get(item.id)?.label ?? item.id
                            : item.type === "weapon"
                              ? weaponItemMap.get(item.id)?.name ?? item.id
                              : item.id;
                    return (
                      <div
                        key={`auto-${idx}`}
                        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                      >
                        <span>• {label}</span>
                        <select
                          value={item.equippedSlot ?? ""}
                          onChange={e =>
                            updateItemSlot(idx, e.target.value ? e.target.value : null)
                          }
                          style={{
                            background: "#0f0f19",
                            color: "#f5f5f5",
                            border: "1px solid #333",
                            borderRadius: 6,
                            padding: "2px 6px",
                            fontSize: 11,
                            marginLeft: "auto"
                          }}
                        >
                          <option value="">Ranger</option>
                          {props.character?.materielSlots &&
                            Object.keys(props.character.materielSlots).map(slot => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })}
              </div>
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
                <div style={{ fontSize: 12, fontWeight: 700 }}>Inventaire manuel</div>
                {equipmentManual.length === 0 && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    Aucun item ajoute.
                  </div>
                )}
                {inventoryItems
                  .map((item, idx) => ({ item, idx }))
                  .filter(entry => entry.item.source === "manual")
                  .map(({ item, idx }, manualIndex) => {
                    let label = item.id;
                    if (item.type === "object") {
                      label = objectItemMap.get(item.id)?.label ?? item.id;
                    } else if (item.type === "tool") {
                      label = toolItemMap.get(item.id)?.label ?? item.id;
                    } else if (item.type === "armor") {
                      label = armorItemMap.get(item.id)?.label ?? item.id;
                    } else if (item.type === "weapon") {
                      label = weaponItemMap.get(item.id)?.name ?? item.id;
                    }
                    return (
                      <div
                        key={`manual-${idx}`}
                        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                      >
                        <span>{label}</span>
                        <select
                          value={item.equippedSlot ?? ""}
                          onChange={e =>
                            updateItemSlot(idx, e.target.value ? e.target.value : null)
                          }
                          style={{
                            background: "#0f0f19",
                            color: "#f5f5f5",
                            border: "1px solid #333",
                            borderRadius: 6,
                            padding: "2px 6px",
                            fontSize: 11
                          }}
                        >
                          <option value="">Ranger</option>
                          {props.character?.materielSlots &&
                            Object.keys(props.character.materielSlots).map(slot => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeManualItem(manualIndex)}
                          style={{
                            marginLeft: "auto",
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
                      </div>
                    );
                  })}
              </div>
            </div>
            <div
              style={{
                marginTop: 6,
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
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
            </>
          )}

          {activeMainTab === "player" && activePlayerTab === "stats" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                  Ajustez les caracteristiques. Le modificateur se met a jour.
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 10
                }}
              >
                {(["FOR", "DEX", "CON", "INT", "SAG", "CHA"] as const).map(stat => {
                  const score = getScore(stat);
                  const mod = computeMod(score);
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
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{stat}</div>
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
                          onClick={() => !isSectionLocked("stats") && setScore(stat, score - 1)}
                          disabled={isSectionLocked("stats")}
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
                          aria-label={`Diminuer ${stat}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                          </svg>
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={score}
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
                          onClick={() => !isSectionLocked("stats") && setScore(stat, score + 1)}
                          disabled={isSectionLocked("stats")}
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
                          aria-label={`Augmenter ${stat}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                            <rect x="5.25" y="2" width="1.5" height="8" fill="currentColor" />
                          </svg>
                        </button>
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
                        onChange={() => !isSectionLocked("skills") && toggleCompetence(skill.id)}
                        disabled={isSectionLocked("skills")}
                        style={{ accentColor: "#4f7df2" }}
                      />
                      <span style={{ fontSize: 12 }}>Maitrise</span>
                    </label>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={expertises.includes(skill.id)}
                        onChange={() => !isSectionLocked("skills") && toggleExpertise(skill.id)}
                        disabled={isSectionLocked("skills") || !competences.includes(skill.id)}
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
                      !isSectionLocked("masteries") && toggleMastery("weapons", value.id)
                    }
                    disabled={isSectionLocked("masteries")}
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
                      !isSectionLocked("masteries") && toggleMastery("armors", value.id)
                    }
                    disabled={isSectionLocked("masteries")}
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
                      !isSectionLocked("masteries") && toggleMastery("tools", value.id)
                    }
                    disabled={isSectionLocked("masteries")}
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
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                          ID: {cls.id}
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
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                                ID: {sub.id}
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
                    setSectionLock("backgrounds", false);
                    return;
                  }
                  if (!requireBackgroundChoices()) {
                    setSectionLock("backgrounds", true);
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
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                          ID: {bg.id}
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
                      Materiel: {activeBackground.equipment.join(", ")}
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
