import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  Personnage,
  SpellGrantEntry,
  SpellGrantSourceType,
  SpellGrantUsage
} from "../types";
import type { WeaponTypeDefinition } from "../game/weaponTypes";
import type { ActionDefinition } from "../game/engine/rules/actionTypes";
import type { RaceDefinition } from "../game/raceTypes";
import type { ClassDefinition, SubclassDefinition } from "../game/classTypes";
import type { BackgroundDefinition } from "../game/backgroundTypes";
import type { LanguageDefinition } from "../game/languageTypes";
import type { ToolItemDefinition } from "../game/toolTypes";
import type { ObjectItemDefinition } from "../game/objectTypes";
import type { ArmorItemDefinition } from "../game/armorTypes";
import {
  isCoinId,
  moneyToCoinStacks,
  moneyToCopper,
  scaleMoney
} from "../game/currency";
import { EquipmentTab } from "./tabs/EquipmentTab";
import { ChoiceModal } from "./modals/ChoiceModal";
import { ConfirmModal } from "./modals/ConfirmModal";
import { AsiModal } from "./modals/AsiModal";
import {
  appendInventoryEntries,
  buildInventoryEntries,
  formatMoneyValue,
  isCurrencySpec,
  updateEquipmentListQty
} from "./characterEquipment";
import { StatsTab } from "./tabs/StatsTab";
import { SkillsTab } from "./tabs/SkillsTab";
import { MasteriesTab } from "./tabs/MasteriesTab";
import { BackgroundsTab } from "./tabs/BackgroundsTab";
import { ClassesTab } from "./tabs/ClassesTab";
import { SpeciesTab } from "./tabs/SpeciesTab";
import { ProfileTab } from "./tabs/ProfileTab";
import { SheetTab } from "./tabs/SheetTab";
import { MagicPanel } from "./tabs/MagicPanel";
import { spellCatalog } from "../game/spellCatalog";
import { loadFeatureTypesFromIndex } from "../game/featureCatalog";
import type { FeatureDefinition } from "../game/featureTypes";
import { getEquipmentConstraintIssues } from "../game/engine/rules/equipmentHands";

const WEAPON_PROFICIENCY_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "simple", label: "Simple" },
  { id: "martiale", label: "Martiale" },
  { id: "speciale", label: "Speciale" },
  { id: "monastique", label: "Monastique" }
];

const WEAPON_MASTERY_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "coup-double", label: "Coup double" },
  { id: "ecorchure", label: "Ecorchure" },
  { id: "enchainement", label: "Enchainement" },
  { id: "ouverture", label: "Ouverture" },
  { id: "poussee", label: "Poussee" },
  { id: "ralentissement", label: "Ralentissement" },
  { id: "renversement", label: "Renversement" },
  { id: "sape", label: "Sape" }
];

function normalizeWeaponMasteryId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

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
    | "magic"
    | "equip"
    | "skills"
    | "masteries"
    | "sheet"
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
  const getRaceTraitIds = (race: RaceDefinition | null) => {
    if (!race) return [];
    const grants = Array.isArray((race as any)?.grants) ? (race as any).grants : [];
    const ids: string[] = [];
    grants.forEach((grant: any) => {
      if (grant?.kind !== "trait") return;
      const list = Array.isArray(grant?.ids) ? grant.ids : [];
      list.forEach((id: string) => ids.push(id));
    });
    return Array.from(new Set(ids));
  };
  const getRaceTraits = (race: RaceDefinition | null) => {
    if (!race) return [];
    const traits = Array.isArray(race.traits) ? race.traits : [];
    const grantedIds = getRaceTraitIds(race);
    if (grantedIds.length === 0) return traits;
    const byId = new Map(traits.map(trait => [trait.id, trait]));
    return grantedIds.map(id => byId.get(id) ?? { id, label: id, description: "" });
  };
  const hasRaceTrait = (traitId: string) => {
    const traits = getRaceTraits(activeRace);
    return traits.some(trait => trait.id === traitId);
  };
  const backgroundOptions = useMemo(() => {
    const list = Array.isArray(props.backgroundTypes) ? [...props.backgroundTypes] : [];
    list.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    return list;
  }, [props.backgroundTypes]);
  const selectedBackgroundId = (props.character as any)?.backgroundId ?? "";
  const getBackgroundGrants = (bg: BackgroundDefinition | null) => {
    if (!bg) return [];
    const list = Array.isArray((bg as any)?.grants) ? (bg as any).grants : [];
    return list
      .filter((grant: any) => grant && grant.kind)
      .map((grant: any) => ({
        kind: String(grant.kind),
        ids: Array.isArray(grant.ids) ? grant.ids : [],
        meta: grant.meta
      }));
  };
  const getBackgroundSkillProficiencies = (bg: BackgroundDefinition | null) => {
    if (!bg) return [];
    const grantIds = getBackgroundGrants(bg)
      .filter(grant => grant.kind === "skill")
      .flatMap(grant => grant.ids);
    if (grantIds.length > 0) return Array.from(new Set(grantIds));
    return [];
  };
  const getBackgroundToolProficiencies = (bg: BackgroundDefinition | null) => {
    if (!bg) return [];
    const grantIds = getBackgroundGrants(bg)
      .filter(grant => grant.kind === "tool")
      .flatMap(grant => grant.ids);
    if (grantIds.length > 0) return Array.from(new Set(grantIds));
    return [];
  };
  const getBackgroundToolChoice = (bg: BackgroundDefinition | null) => {
    if (!bg) return null;
    const grant = getBackgroundGrants(bg).find(item => item.kind === "tool-choice") ?? null;
    if (grant) {
      const count = Number((grant.meta as any)?.count ?? 0);
      const options = Array.isArray((grant.meta as any)?.options) ? (grant.meta as any).options : [];
      return { count, options };
    }
    return null;
  };
  const getBackgroundLanguageChoice = (bg: BackgroundDefinition | null) => {
    if (!bg) return null;
    const grant = getBackgroundGrants(bg).find(item => item.kind === "language-choice") ?? null;
    if (grant) {
      const count = Number((grant.meta as any)?.count ?? 0);
      return { count };
    }
    return null;
  };
  const getBackgroundFeatureInfo = (bg: BackgroundDefinition | null) => {
    if (!bg) return null;
    const grant = getBackgroundGrants(bg).find(item => item.kind === "feature") ?? null;
    if (!grant) return null;
    const meta = (grant.meta ?? {}) as { label?: string; description?: string };
    const label = meta.label ?? grant.ids?.[0] ?? "";
    const description = meta.description ?? "";
    return { label, description };
  };
  const toolItems = Array.isArray(props.toolItems) ? props.toolItems : [];
  const objectItems = Array.isArray(props.objectItems) ? props.objectItems : [];
  const armorItems = Array.isArray(props.armorItems) ? props.armorItems : [];
  const languageOptions = useMemo(() => {
    const list = Array.isArray(props.languageTypes) ? [...props.languageTypes] : [];
    list.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    return list;
  }, [props.languageTypes]);
  const creationLocks = ((props.character as any)?.creationLocks ?? {}) as Record<string, boolean>;
  const classLocks = ((props.character as any)?.classLocks ?? {}) as {
    primary?: boolean;
    secondary?: boolean;
  };
  const legacyClassLock = Boolean((props.character as any)?.classLock);
  const isPrimaryClassLocked =
    typeof classLocks.primary === "boolean" ? classLocks.primary : legacyClassLock;
  const isSecondaryClassLocked = Boolean(classLocks.secondary);
  const isSectionLocked = (id: string) => {
    if (id === "classes") {
      const secondaryEnabled = Boolean((props.character as any)?.classe?.[2]);
      if (secondaryEnabled) {
        return resolvedClassTab === "secondary"
          ? isSecondaryClassLocked
          : isPrimaryClassLocked;
      }
      return isPrimaryClassLocked;
    }
    return Boolean(creationLocks?.[id]);
  };
  const setSectionLock = (id: string, value: boolean) => {
    const nextLocks = { ...creationLocks, [id]: value };
    let nextCharacter: Personnage = { ...props.character, creationLocks: nextLocks };
    if (value && id === "equip") {
      nextCharacter = applySkillsAndMasteriesReset(nextCharacter);
    }
    props.onChangeCharacter(nextCharacter);
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
  const isSecondaryEnabled = Boolean(secondaryClassEntry);
  const selectedClassId = classEntry?.classeId ?? "";
  const selectedSubclassId = classEntry?.subclasseId ?? "";
  const selectedSecondaryClassId = secondaryClassEntry?.classeId ?? "";
  const selectedSecondarySubclassId = secondaryClassEntry?.subclasseId ?? "";
  const activeRace = raceOptions.find(race => race.id === selectedRaceId) ?? null;
  const activeBackground =
    backgroundOptions.find(bg => bg.id === selectedBackgroundId) ?? null;
  const profileDetails = ((props.character as any)?.profileDetails ?? {}) as Record<string, string>;
  const classPrimary = classOptions.find(cls => cls.id === selectedClassId) ?? null;
  const classSecondary = classOptions.find(cls => cls.id === selectedSecondaryClassId) ?? null;
  const featureTypes = useMemo(() => loadFeatureTypesFromIndex(), []);
  const featureById = useMemo(() => {
    const map = new Map<string, FeatureDefinition>();
    featureTypes.forEach(feature => {
      if (feature?.id) map.set(String(feature.id), feature);
    });
    return map;
  }, [featureTypes]);
  const activeFeatureDefs = useMemo(() => {
    const featureIds = Array.isArray((props.character as any)?.derived?.grants?.features)
      ? (((props.character as any).derived.grants.features as string[]).map(id => String(id)).filter(Boolean))
      : [];
    return featureIds
      .map(id => featureById.get(id) ?? null)
      .filter((feature): feature is FeatureDefinition => Boolean(feature));
  }, [featureById, props.character]);
  const choiceSelections = ((props.character as any)?.choiceSelections ?? {}) as Record<string, any>;
  const classFeatureSelections = ((choiceSelections as any)?.classFeatures ?? {}) as Record<
    string,
    { selected?: string[] }
  >;
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
  const instanceSeedRef = useRef(
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
  const instanceCounterRef = useRef(0);
  const pendingLocks = ((choiceSelections as any)?.pendingLocks ?? {}) as Record<string, any>;
  const competences = Array.isArray(props.character?.competences)
    ? (props.character.competences as string[])
    : [];
  const expertises = Array.isArray((props.character as any)?.expertises)
    ? ((props.character as any).expertises as string[])
    : [];

  useEffect(() => {
    if (skillsMode !== "normal") return;
    const adaptableSkill = (choiceSelections as any)?.race?.adaptableSkill;
    if (!adaptableSkill) return;
    if (competences.includes(adaptableSkill)) return;
    const nextSkills = Array.from(new Set([...(competences ?? []), adaptableSkill]));
    props.onChangeCharacter({ ...props.character, competences: nextSkills });
  }, [skillsMode, choiceSelections, competences, props.character, props.onChangeCharacter]);
  const profs = (props.character?.proficiencies ?? {}) as {
    weapons?: string[];
    armors?: string[];
    tools?: string[];
  };
  const rawWeaponEntries = Array.isArray(profs.weapons) ? profs.weapons : [];
  const weaponProficiencyIdSet = new Set(WEAPON_PROFICIENCY_OPTIONS.map(option => option.id));
  const weaponMasteryOptionMap = new Map(
    WEAPON_MASTERY_OPTIONS.map(option => [option.id, option.label] as const)
  );
  const weaponMasteryIdSet = new Set(WEAPON_MASTERY_OPTIONS.map(option => option.id));
  const weaponProficiencies = rawWeaponEntries.filter(id => weaponProficiencyIdSet.has(id));
  const explicitWeaponMasteries = Array.isArray((props.character as any)?.weaponMasteries)
    ? (((props.character as any)?.weaponMasteries as string[])
        .map(id => normalizeWeaponMasteryId(id))
        .filter(Boolean))
    : [];
  const legacyWeaponMasteries = rawWeaponEntries
    .map(id => normalizeWeaponMasteryId(id))
    .filter(id => weaponMasteryIdSet.has(id));
  const activeWeaponMasteryIds =
    explicitWeaponMasteries.length > 0
      ? Array.from(new Set(explicitWeaponMasteries))
      : Array.from(new Set(legacyWeaponMasteries));
  const unlockedWeaponMasteries = activeWeaponMasteryIds
    .map(id => ({ id, label: weaponMasteryOptionMap.get(id) ?? id }));
  const armorMasteries = Array.isArray(profs.armors) ? profs.armors : [];
  const toolMasteries = Array.isArray(profs.tools) ? profs.tools : [];
  const getClassEquipment = (cls: ClassDefinition | null) => {
    const list = Array.isArray(cls?.equipment) ? (cls?.equipment as string[]) : [];
    return list.filter(Boolean);
  };
  const dedupeList = (items: string[]) => {
    const seen = new Set<string>();
    return items.filter(item => {
      if (!item) return false;
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  };
  const arraysEqual = (left: string[], right: string[]) => {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  };
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
    paquetage: null,
    ceinture_bourse_1: null,
    ceinture_bourse_2: null
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
    { id: "paquetage", label: "Paquetage (sac)", accepts: ["pack"] },
    { id: "ceinture_bourse_1", label: "Ceinture - bourse 1", accepts: ["pack"] },
    { id: "ceinture_bourse_2", label: "Ceinture - bourse 2", accepts: ["pack"] }
  ];
  const weaponCarrySlots = useMemo(
    () => new Set(["ceinture_gauche", "ceinture_droite", "dos_gauche", "dos_droit"]),
    []
  );
  const clothingSubSlots = useMemo(() => new Set(["tete", "gants", "bottes"]), []);
  const packSlots = useMemo(
    () => new Set(["paquetage", "ceinture_bourse_1", "ceinture_bourse_2"]),
    []
  );
  const packSlotMaxWeight: Record<string, number | null> = {
    paquetage: null,
    ceinture_bourse_1: 5.2,
    ceinture_bourse_2: 5.2
  };
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
    if (props.twoHanded || props.heavy) {
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
  const isItemHarmonisable = (item: any): boolean => {
    if (!item) return false;
    if (item.type === "weapon") return Boolean(weaponItemMap.get(item.id)?.harmonisable);
    if (item.type === "armor") return Boolean(armorItemMap.get(item.id)?.harmonisable);
    if (item.type === "object") return Boolean(objectItemMap.get(item.id)?.harmonisable);
    return false;
  };
  const isInventoryItemHarmonized = (item: any): boolean => {
    if (!item) return false;
    if (item.harmonized === true || item.isHarmonized === true || item.attuned === true) return true;
    if (item?.attunement?.state === "harmonized") return true;
    if (
      typeof item?.attunement?.harmonizedAt === "string" &&
      item.attunement.harmonizedAt.length > 0
    ) {
      return true;
    }
    return false;
  };
  const createInstanceId = (prefix: string) => {
    const next = instanceCounterRef.current + 1;
    instanceCounterRef.current = next;
    return `${prefix}-${instanceSeedRef.current}-${next}`;
  };
  const getPackSlotItemId = (slotId: string) =>
    (materielSlots?.[slotId] as string | null) ?? null;
  const getPackCapacity = (slotId: string) => {
    const bagId = getPackSlotItemId(slotId);
    if (!bagId) return 0;
    const bag = objectItemMap.get(bagId);
    return bag?.capacityWeight ?? 0;
  };
  const getStoredWeightForSlot = (slotId: string) => {
    const bagId = getPackSlotItemId(slotId);
    return inventoryItems.reduce((sum, item) => {
      const isStoredInSlot =
        item?.storedIn === slotId ||
        (slotId === "paquetage" && bagId && item?.storedIn === bagId);
      if (!isStoredInSlot) return sum;
      return sum + getItemWeight(item) * (Number(item?.qty ?? 1) || 1);
    }, 0);
  };
  const getPackTotalWeightForItem = (item: any) => {
    if (!item) return 0;
    const base = getItemWeight(item);
    const slotId =
      item?.equippedSlot && packSlots.has(item.equippedSlot) ? item.equippedSlot : null;
    const contents = slotId ? getStoredWeightForSlot(slotId) : 0;
    return base + contents;
  };
  const getPackTotalWeightForSlot = (slotId: string) => {
    const bagId = getPackSlotItemId(slotId);
    if (!bagId) return 0;
    const bagItem = inventoryItems.find(
      item => item?.equippedSlot === slotId && item?.id === bagId
    );
    if (!bagItem) return 0;
    return getItemWeight(bagItem) + getStoredWeightForSlot(slotId);
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
      bag: ["paquetage"],
      beltPacks: ["ceinture_bourse_1", "ceinture_bourse_2"]
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
        if (!categories.some(cat => slotDef.accepts.includes(cat))) return false;
        if (packSlots.has(slotId)) {
          const limit = packSlotMaxWeight[slotId];
          if (typeof limit === "number") {
            const totalWeight = getPackTotalWeightForItem(item);
            if (totalWeight > limit) return false;
          }
        }
        return true;
      });
  };
  const packSlotStatus = (slotId: string) => {
    const bagId = getPackSlotItemId(slotId);
    const capacity = getPackCapacity(slotId);
    const storedWeight = getStoredWeightForSlot(slotId);
    const totalWeight = getPackTotalWeightForSlot(slotId);
    const maxTotal = packSlotMaxWeight[slotId];
    return { bagId, capacity, storedWeight, totalWeight, maxTotal };
  };
  const getSlotLabel = (slotId: string) =>
    EQUIPMENT_SLOTS.find(slot => slot.id === slotId)?.label ?? slotId;
  const resolveStoredSlotId = (item: any) => {
    if (!item?.storedIn) return null;
    if (packSlots.has(item.storedIn)) return item.storedIn;
    const mainBagId = getPackSlotItemId("paquetage");
    if (mainBagId && item.storedIn === mainBagId) return "paquetage";
    return null;
  };
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
      weapons: kind === "weapons" ? toggleListValue(weaponProficiencies, value) : weaponProficiencies,
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
  const activeClassSlot = resolvedClassTab === "secondary" ? 2 : 1;
  const isActiveClassLocked =
    activeClassSlot === 2 ? isSecondaryClassLocked : isPrimaryClassLocked;

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
    const prevPrimaryLevel = Number(currentClasse?.[1]?.niveau) || 0;
    const prevSecondaryLevel = Number(currentClasse?.[2]?.niveau) || 0;
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
    let nextChoiceSelections = choiceSelections;
    let nextClassLocks = classLocks;
    if (nextClasse?.[1]?.classeId && nextClasse?.[1]?.niveau < prevPrimaryLevel) {
      const classId = nextClasse?.[1]?.classeId;
      const allowed = new Set(getAsiKeysForClassLevel(classId, nextClasse?.[1]?.niveau || 0));
      const nextAsi = { ...asiSelections };
      Object.keys(nextAsi).forEach(key => {
        if (!key.startsWith(`${classId}:`)) return;
        if (!allowed.has(key)) {
          delete nextAsi[key];
        }
      });
      nextChoiceSelections = {
        ...nextChoiceSelections,
        asi: nextAsi,
        pendingLocks: (() => {
          const nextPending = { ...pendingLocks };
          delete nextPending.classes;
          delete nextPending.classesSlot;
          return nextPending;
        })()
      };
      nextClassLocks = { ...nextClassLocks, primary: false };
      const threshold = getSubclassThresholdForClassId(classId);
      if (threshold !== null && (nextClasse?.[1]?.niveau ?? 0) < threshold) {
        nextClasse = {
          ...nextClasse,
          1: { ...(nextClasse?.[1] ?? {}), subclasseId: null }
        };
      }
    }
    if (!nextClasse?.[2] && prevSecondaryLevel > 0) {
      nextClassLocks = { ...nextClassLocks, secondary: false };
      const nextPending = { ...pendingLocks };
      delete nextPending.classes;
      delete nextPending.classesSlot;
      nextChoiceSelections = { ...nextChoiceSelections, pendingLocks: nextPending };
    }
    props.onChangeCharacter({
      ...props.character,
      niveauGlobal: nextLevel,
      classe: nextClasse,
      combatStats: nextCombatStats,
      classLocks:
        nextLevel <= 2 ? { ...nextClassLocks, secondary: false } : { ...nextClassLocks },
      choiceSelections: nextChoiceSelections
    });
    if (nextLevel <= 2) {
      setActiveClassTab("primary");
    }
  };

  const setClassSelection = (cls: ClassDefinition, slot: 1 | 2) => {
    const current = (props.character as any)?.classe ?? {};
    const previousId = current?.[slot]?.classeId ?? null;
    let nextAsi = asiSelections;
    let nextPendingLocks = pendingLocks;
    if (previousId && previousId !== cls.id) {
      nextAsi = { ...asiSelections };
      Object.keys(nextAsi).forEach(key => {
        if (key.startsWith(`${previousId}:`)) {
          delete nextAsi[key];
        }
      });
      nextPendingLocks = { ...pendingLocks };
      delete nextPendingLocks.classes;
      delete nextPendingLocks.classesSlot;
    }
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
    const nextChoiceSelections = {
      ...choiceSelections,
      asi: nextAsi,
      pendingLocks: nextPendingLocks
    };
    props.onChangeCharacter({
      ...props.character,
      classe: nextClasse,
      proficiencies: nextProfs,
      choiceSelections: nextChoiceSelections
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
    const prevLevel = Number(current?.[slot]?.niveau) || 0;
    const nextLevel = Math.max(1, Math.min(globalLevel - 1, Math.floor(nextLevelRaw || 1)));
    const otherLevel = Math.max(1, globalLevel - nextLevel);
    const classId = current?.[slot]?.classeId ?? null;
    const nextClasse = {
      ...current,
      [slot]: { ...(current?.[slot] ?? {}), niveau: nextLevel },
      [otherSlot]: { ...(current?.[otherSlot] ?? {}), niveau: otherLevel }
    };
    let nextChoiceSelections = choiceSelections;
    let nextClassLocks = classLocks;
    if (classId && nextLevel < prevLevel) {
      const allowed = new Set(getAsiKeysForClassLevel(classId, nextLevel));
      const nextAsi = { ...asiSelections };
      Object.keys(nextAsi).forEach(key => {
        if (!key.startsWith(`${classId}:`)) return;
        if (!allowed.has(key)) {
          delete nextAsi[key];
        }
      });
      const sourcesToDrop = slot === 1 ? ["classPrimary", "subclassPrimary"] : ["classSecondary", "subclassSecondary"];
      const nextStatBonuses = pruneStatBonusesBySource(sourcesToDrop);
      nextChoiceSelections = {
        ...choiceSelections,
        asi: nextAsi,
        ...(nextStatBonuses ? { statBonuses: nextStatBonuses } : null),
        pendingLocks: (() => {
          const nextPending = { ...pendingLocks };
          delete nextPending.classes;
          delete nextPending.classesSlot;
          return nextPending;
        })()
      };
      nextClassLocks = {
        ...classLocks,
        primary: slot === 1 ? false : classLocks.primary,
        secondary: slot === 2 ? false : classLocks.secondary
      };
      const threshold = getSubclassThresholdForClassId(classId);
      if (threshold !== null && nextLevel < threshold) {
        nextClasse[slot] = { ...(nextClasse[slot] ?? {}), subclasseId: null };
      }
    }
    props.onChangeCharacter({
      ...props.character,
      classe: nextClasse,
      choiceSelections: nextChoiceSelections,
      classLocks: nextClassLocks
    });
  };

  const enableSecondaryClass = () => {
    const current = (props.character as any)?.classe ?? {};
    const globalLevel = resolveLevel();
    if (globalLevel <= 2) return;
    const prevPrimaryLevel = Number(current?.[1]?.niveau ?? 0);
    const primaryLevel = Math.max(1, globalLevel - 1);
    const secondaryLevel = Math.max(1, globalLevel - primaryLevel);
    const nextClasse = {
      ...current,
      1: { ...(current?.[1] ?? {}), niveau: primaryLevel },
      2: { classeId: "", subclasseId: null, niveau: secondaryLevel }
    };
    let nextChoiceSelections = choiceSelections;
    let nextClassLocks = { ...classLocks, secondary: false };
    if (prevPrimaryLevel > 0 && primaryLevel < prevPrimaryLevel) {
      const classId = current?.[1]?.classeId ?? null;
      if (classId) {
        const allowed = new Set(getAsiKeysForClassLevel(classId, primaryLevel));
        const nextAsi = { ...asiSelections };
        Object.keys(nextAsi).forEach(key => {
          if (!key.startsWith(`${classId}:`)) return;
          if (!allowed.has(key)) {
            delete nextAsi[key];
          }
        });
        const sourcesToDrop = ["classPrimary", "subclassPrimary"];
        const nextStatBonuses = pruneStatBonusesBySource(sourcesToDrop);
        nextChoiceSelections = {
          ...choiceSelections,
          asi: nextAsi,
          ...(nextStatBonuses ? { statBonuses: nextStatBonuses } : null),
          pendingLocks: (() => {
            const nextPending = { ...pendingLocks };
            delete nextPending.classes;
            delete nextPending.classesSlot;
            return nextPending;
          })()
        };
        const threshold = getSubclassThresholdForClassId(classId);
        if (threshold !== null && primaryLevel < threshold) {
          nextClasse[1] = { ...(nextClasse[1] ?? {}), subclasseId: null };
        }
        nextClassLocks = { ...nextClassLocks, primary: false };
      }
    }
    props.onChangeCharacter({
      ...props.character,
      classe: nextClasse,
      classLocks: nextClassLocks,
      choiceSelections: nextChoiceSelections
    });
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
    props.onChangeCharacter({
      ...props.character,
      classe: nextClasse,
      classLocks: { ...classLocks, secondary: false }
    });
    setActiveClassTab("primary");
  };

  const buildClassLockCharacter = (
    slot: 1 | 2,
    baseChoiceSelections: Record<string, any>,
    pendingOverride?: Record<string, any>
  ) => {
    const wasLocked = slot === 1 ? Boolean(classLocks.primary) : Boolean(classLocks.secondary);
    const nextLocks = {
      ...classLocks,
      primary: slot === 1 ? true : classLocks.primary,
      secondary: slot === 2 ? true : classLocks.secondary
    };
    const nextChoiceSelections = pendingOverride
      ? { ...baseChoiceSelections, pendingLocks: pendingOverride }
      : baseChoiceSelections;
    const nextCharacter: Personnage & { classLocks?: typeof nextLocks; classLock?: boolean } = {
      ...props.character,
      classLocks: nextLocks,
      choiceSelections: nextChoiceSelections
    };
    if (slot === 1) {
      nextCharacter.classLock = true;
    }
    if (!wasLocked) {
      const cls = slot === 1 ? classPrimary : classSecondary;
      const classEquip = getClassEquipment(cls);
      const autoResult = addAutoItemsToState(
        equipmentAuto,
        inventoryItems,
        classEquip,
        { kind: "class", id: cls?.id ?? "" }
      );
      const baseSpellcasting = ((nextChoiceSelections as any)?.spellcasting ?? {}) as Record<
        string,
        any
      >;
      const nextSpellcasting = { ...baseSpellcasting };
      const grantedBySource = buildSpellGrantsForClassSlot(slot);
      Object.entries(grantedBySource).forEach(([key, grants]) => {
        nextSpellcasting[key] = {
          ...(nextSpellcasting[key] ?? {}),
          grantedSpells: grants
        };
      });
      nextCharacter.equipmentAuto = autoResult.nextAuto;
      nextCharacter.inventoryItems = autoResult.nextInventory;
      nextCharacter.choiceSelections = {
        ...nextChoiceSelections,
        spellcasting: nextSpellcasting
      };
    }
    return nextCharacter;
  };

  const setClassLockForSlot = (slot: 1 | 2, value: boolean) => {
    const wasLocked = slot === 1 ? Boolean(classLocks.primary) : Boolean(classLocks.secondary);
    const nextLocks = {
      ...classLocks,
      primary: slot === 1 ? value : classLocks.primary,
      secondary: slot === 2 ? value : classLocks.secondary
    };
    if (value && !wasLocked) {
      const nextCharacter = applySkillsAndMasteriesReset(
        buildClassLockCharacter(slot, choiceSelections)
      );
      props.onChangeCharacter(nextCharacter);
      return;
    }
    const nextCharacter: Personnage & { classLocks?: typeof nextLocks; classLock?: boolean } = {
      ...props.character,
      classLocks: nextLocks
    };
    if (slot === 1) nextCharacter.classLock = value;
    props.onChangeCharacter(nextCharacter);
  };
  const clearPendingLocks = (keys: string[]) => {
    const nextPending = { ...pendingLocks };
    let changed = false;
    for (const key of keys) {
      if (key in nextPending) {
        delete nextPending[key];
        changed = true;
      }
    }
    if (!changed) return;
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: { ...choiceSelections, pendingLocks: nextPending }
    });
  };
  const removeAsiForClassId = (classId?: string | null) => {
    if (!classId) return;
    const nextAsi = { ...asiSelections };
    Object.keys(nextAsi).forEach(key => {
      if (key.startsWith(`${classId}:`)) {
        delete nextAsi[key];
      }
    });
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: { ...choiceSelections, asi: nextAsi }
    });
  };
  const resetClassImpactsForSlot = (slot: 1 | 2) => {
    const current = (props.character as any)?.classe ?? {};
    const nextClasse = { ...current };
    const affectedClassIds: string[] = [];
    const affectedSubclassIds: string[] = [];
    const affectedSources: string[] = [];
    const globalLevel = resolveLevel();
    if (slot === 1) {
      if (nextClasse?.[1]) {
        const entry = nextClasse[1];
        affectedClassIds.push(entry?.classeId ?? "");
        affectedSubclassIds.push(entry?.subclasseId ?? "");
        affectedSources.push("classPrimary", "subclassPrimary");
        nextClasse[1] = { ...entry, subclasseId: null };
      }
      if (nextClasse?.[2]) {
        const entry = nextClasse[2];
        affectedClassIds.push(entry?.classeId ?? "");
        affectedSubclassIds.push(entry?.subclasseId ?? "");
        affectedSources.push("classSecondary", "subclassSecondary");
        delete nextClasse[2];
        nextClasse[1] = { ...(nextClasse?.[1] ?? {}), niveau: globalLevel };
      }
    } else {
      if (nextClasse?.[2]) {
        const entry = nextClasse[2];
        affectedClassIds.push(entry?.classeId ?? "");
        affectedSubclassIds.push(entry?.subclasseId ?? "");
        affectedSources.push("classSecondary", "subclassSecondary");
        delete nextClasse[2];
        nextClasse[1] = { ...(nextClasse?.[1] ?? {}), niveau: globalLevel };
      }
    }
    const nextAsi = { ...asiSelections };
    affectedClassIds.filter(Boolean).forEach(classId => {
      Object.keys(nextAsi).forEach(key => {
        if (key.startsWith(`${classId}:`)) {
          delete nextAsi[key];
        }
      });
    });
    const nextPending = { ...pendingLocks };
    delete nextPending.classes;
    delete nextPending.classesSlot;
    const nextStatBonuses = pruneStatBonusesBySource(affectedSources);
    const classFeatureSelectionsCurrent = (((choiceSelections as any)?.classFeatures ?? {}) as Record<
      string,
      { selected?: string[] }
    >);
    const blockedPrefixes = [
      ...affectedClassIds.filter(Boolean).map(id => `class:${id}:`),
      ...affectedSubclassIds.filter(Boolean).map(id => `subclass:${id}:`)
    ];
    const nextClassFeatures = Object.fromEntries(
      Object.entries(classFeatureSelectionsCurrent).filter(
        ([choiceId]) => !blockedPrefixes.some(prefix => choiceId.startsWith(prefix))
      )
    ) as Record<string, { selected?: string[] }>;
    const nextChoiceSelections = {
      ...choiceSelections,
      asi: nextAsi,
      classFeatures: nextClassFeatures,
      ...(nextStatBonuses ? { statBonuses: nextStatBonuses } : null),
      pendingLocks: nextPending
    };
    const primaryId = nextClasse?.[1]?.classeId ?? "";
    const secondaryId = nextClasse?.[2]?.classeId ?? "";
    const primaryCls = classOptions.find(cls => cls.id === primaryId) ?? null;
    const secondaryCls = classOptions.find(cls => cls.id === secondaryId) ?? null;
    const backgroundTools = [
      ...getBackgroundToolProficiencies(activeBackground),
      ...(((choiceSelections as any)?.background?.tools ?? []) as string[])
    ];
    const nextProfs = {
      weapons: Array.from(
        new Set([...(primaryCls?.proficiencies?.weapons ?? []), ...(secondaryCls?.proficiencies?.weapons ?? [])])
      ),
      armors: Array.from(
        new Set([...(primaryCls?.proficiencies?.armors ?? []), ...(secondaryCls?.proficiencies?.armors ?? [])])
      ),
      tools: Array.from(
        new Set([
          ...(primaryCls?.proficiencies?.tools ?? []),
          ...(secondaryCls?.proficiencies?.tools ?? []),
          ...backgroundTools
        ])
      )
    };
    const baseSkills = getBackgroundSkillProficiencies(activeBackground);
    const nextCompetences = [...baseSkills];
    const nextExpertises: string[] = [];
    const nextClassLocks = {
      ...classLocks,
      primary: slot === 1 ? false : classLocks.primary,
      secondary: false
    };
    const nextCharacter: Personnage & { classLocks?: typeof nextClassLocks; classLock?: boolean } = {
      ...props.character,
      classe: nextClasse,
      classLocks: nextClassLocks,
      choiceSelections: nextChoiceSelections,
      weaponMasteries: [],
      proficiencies: nextProfs,
      competences: nextCompetences,
      expertises: nextExpertises,
      materielSlots: { ...DEFAULT_MATERIEL_SLOTS },
      armesDefaut: { main_droite: null, main_gauche: null, mains: null },
      equipmentAuto: [],
      equipmentManual: [],
      inventoryItems: []
    };
    if (slot === 1) {
      nextCharacter.classLock = false;
    }
    props.onChangeCharacter(nextCharacter);
  };
  const resetSpeciesImpacts = () => {
    const adaptableSkill = (choiceSelections as any)?.race?.adaptableSkill;
    const nextCompetences = adaptableSkill
      ? competences.filter(skill => skill !== adaptableSkill)
      : competences;
    const nextChoiceSelections = {
      ...choiceSelections,
      race: { ...(choiceSelections as any).race }
    };
    if (adaptableSkill) {
      delete nextChoiceSelections.race.adaptableSkill;
    }
    props.onChangeCharacter({
      ...props.character,
      creationLocks: { ...creationLocks, species: false },
      choiceSelections: nextChoiceSelections,
      competences: nextCompetences
    });
    clearPendingLocks(["species"]);
  };
  const resetBackgroundImpacts = () => {
    const backgroundChoices = (choiceSelections as any)?.background ?? {};
    const bonusApplied = Boolean(backgroundChoices.statBonusApplied);
    const toolChoices = Array.isArray(backgroundChoices.tools) ? backgroundChoices.tools : [];
    const languageChoices = Array.isArray(backgroundChoices.languages)
      ? backgroundChoices.languages
      : [];
    const currentLangues = props.character?.langues;
    const currentList = Array.isArray(currentLangues)
      ? currentLangues
      : typeof currentLangues === "string"
        ? currentLangues.split(",").map(item => item.trim()).filter(Boolean)
        : [];
    const nextLangues = currentList.filter(lang => !languageChoices.includes(lang));
    const currentProfs = (props.character?.proficiencies ?? {}) as {
      weapons?: string[];
      armors?: string[];
      tools?: string[];
    };
    const nextTools = Array.isArray(currentProfs.tools)
      ? currentProfs.tools.filter(tool => !toolChoices.includes(tool))
      : [];
    let nextCaracs = props.character.caracs;
    const nextChoiceSelections = {
      ...choiceSelections,
      background: {}
    };
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
      creationLocks: { ...creationLocks, backgrounds: false },
      choiceSelections: nextChoiceSelections,
      langues: nextLangues,
      proficiencies: { ...currentProfs, tools: nextTools },
      caracs: nextCaracs,
      materielSlots: { ...DEFAULT_MATERIEL_SLOTS },
      armesDefaut: { main_droite: null, main_gauche: null, mains: null },
      equipmentAuto: [],
      equipmentManual: [],
      inventoryItems: []
    });
    clearPendingLocks(["backgrounds"]);
  };

  const STAT_KEYS = ["FOR", "DEX", "CON", "INT", "SAG", "CHA"] as const;
  const parseStatBonusId = (id: string) => {
    const trimmed = String(id ?? "").trim();
    const match = trimmed.match(/^(?:stat|carac)[:.](FOR|DEX|CON|INT|SAG|CHA)[:.]([+-]?\d+)$/i);
    if (!match) return null;
    const stat = match[1].toUpperCase() as typeof STAT_KEYS[number];
    const value = Number.parseInt(match[2], 10);
    if (!Number.isFinite(value) || value === 0) return null;
    return { stat, value };
  };
  const collectProgressionBonuses = (
    definition: { progression?: Record<string, any> } | null,
    level: number,
    source: string
  ) => {
    const bonuses: Array<{ stat: typeof STAT_KEYS[number]; value: number; source: string }> = [];
    if (!definition || !definition.progression) return bonuses;
    Object.keys(definition.progression)
      .map(key => Number(key))
      .filter(lvl => Number.isFinite(lvl) && lvl > 0 && lvl <= level)
      .forEach(lvl => {
        const grants = definition.progression?.[String(lvl)]?.grants ?? [];
        for (const grant of grants) {
          if (grant?.kind !== "bonus") continue;
          const ids = Array.isArray(grant.ids) ? grant.ids : [];
          for (const id of ids) {
            if (id === "asi-or-feat") continue;
            const parsed = parseStatBonusId(id);
            if (!parsed) continue;
            bonuses.push({ ...parsed, source });
          }
        }
      });
    return bonuses;
  };
  const getStatBonuses = () => {
    const bonuses: Array<{ stat: typeof STAT_KEYS[number]; value: number; source: string }> =
      [];
    if ((choiceSelections as any)?.background?.statBonusApplied) {
      bonuses.push({ stat: "FOR", value: 1, source: "background" });
    }
    if (activeRace && (activeRace as any)?.statBonuses) {
      const statBonuses = (activeRace as any).statBonuses as Record<string, number>;
      Object.entries(statBonuses).forEach(([stat, value]) => {
        const key = String(stat).toUpperCase();
        if (!STAT_KEYS.includes(key as typeof STAT_KEYS[number])) return;
        const amount = Number(value) || 0;
        if (amount === 0) return;
        bonuses.push({ stat: key as typeof STAT_KEYS[number], value: amount, source: "race" });
      });
    }
    const primaryLevel = Number(classEntry?.niveau ?? 0);
    if (primaryLevel > 0 && classPrimary) {
      bonuses.push(...collectProgressionBonuses(classPrimary, primaryLevel, "classPrimary"));
    }
    if (primaryLevel > 0 && selectedSubclassId) {
      const sub = subclassOptions.find(item => item.id === selectedSubclassId) ?? null;
      bonuses.push(...collectProgressionBonuses(sub, primaryLevel, "subclassPrimary"));
    }
    const secondaryLevel = Number(secondaryClassEntry?.niveau ?? 0);
    if (secondaryLevel > 0 && classSecondary) {
      bonuses.push(...collectProgressionBonuses(classSecondary, secondaryLevel, "classSecondary"));
    }
    if (secondaryLevel > 0 && selectedSecondarySubclassId) {
      const sub = subclassOptions.find(item => item.id === selectedSecondarySubclassId) ?? null;
      bonuses.push(...collectProgressionBonuses(sub, secondaryLevel, "subclassSecondary"));
    }
    const globalLevel = resolveLevel();
    if (globalLevel > 0 && activeRace) {
      bonuses.push(...collectProgressionBonuses(activeRace as any, globalLevel, "race"));
    }
    if (globalLevel > 0 && activeBackground) {
      bonuses.push(...collectProgressionBonuses(activeBackground as any, globalLevel, "background"));
    }
    const extraBonuses = ((choiceSelections as any)?.statBonuses ?? []) as Array<{
      stat: string;
      value: number;
      source?: string;
    }>;
    if (Array.isArray(extraBonuses)) {
      extraBonuses.forEach(entry => {
        const key = String(entry.stat ?? "").toUpperCase();
        if (!STAT_KEYS.includes(key as typeof STAT_KEYS[number])) return;
        const amount = Number(entry.value) || 0;
        if (amount === 0) return;
        bonuses.push({
          stat: key as typeof STAT_KEYS[number],
          value: amount,
          source: entry.source ?? "bonus"
        });
      });
    }
    return bonuses;
  };
  const statBonuses = useMemo(() => getStatBonuses(), [
    choiceSelections,
    activeRace,
    activeBackground,
    classPrimary,
    classSecondary,
    selectedSubclassId,
    selectedSecondarySubclassId,
    classEntry?.niveau,
    secondaryClassEntry?.niveau,
    props.character?.niveauGlobal,
    subclassOptions
  ]);
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
  const carryWeight = useMemo(
    () =>
      inventoryItems.reduce(
        (sum, item) => sum + getItemWeight(item) * (Number(item?.qty ?? 1) || 1),
        0
      ),
    [inventoryItems, objectItemMap, armorItemMap, weaponItemMap, toolItemMap]
  );
  const carryCapacityMax = getScore("FOR") * 7.5;
  const getRequestedAsiBonus = (key: typeof STAT_KEYS[number]) => {
    let total = 0;
    Object.values(asiSelections).forEach(entry => {
      if (!entry || entry.type !== "asi" || !entry.stats) return;
      const raw = entry.stats[key];
      const value = Number(raw) || 0;
      if (value > 0) total += value;
    });
    return total;
  };
  const getBaseScore = (key: typeof STAT_KEYS[number]) => {
    const stored = statsBase[key];
    if (Number.isFinite(stored)) return Number(stored);
    const current = getScore(key);
    const nonAsi = getNonAsiBonusSumForStat(key);
    const requestedAsi = getRequestedAsiBonus(key);
    return Math.max(1, current - nonAsi - requestedAsi);
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
  const asiBonusMap = useMemo(() => getAsiBonusMap(), [
    asiSelections,
    statBonuses,
    statsBase,
    props.character?.caracs
  ]);
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
  const getStatSources = (key: typeof STAT_KEYS[number]) => {
    const sources = [
      ...statBonuses.filter(bonus => bonus.stat === key).map(bonus => bonus.source),
      ...(asiBonusMap[key] ? ["asi"] : [])
    ];
    return Array.from(new Set(sources.filter(Boolean)));
  };

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
    const nextMods: Record<string, number> = {
      modFOR: 0,
      modDEX: 0,
      modCON: 0,
      modINT: 0,
      modSAG: 0,
      modCHA: 0
    };
    (Object.keys(mapping) as Array<keyof typeof mapping>).forEach(key => {
      const nextScore = Math.max(1, Math.min(30, Math.floor(scores[key] || 1)));
      const caracKey = mapping[key];
      const modValue = computeMod(nextScore);
      nextCaracs[caracKey] = {
        ...(props.character.caracs?.[caracKey] ?? {}),
        [key]: nextScore,
        [`mod${key}`]: modValue
      };
      nextMods[`mod${key}`] = modValue;
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

  useEffect(() => {
    const baseScores = getBaseScoresSnapshot();
    const totals: Record<string, number> = {};
    let changed = false;
    STAT_KEYS.forEach(key => {
      const bonus = getBonusSumForStat(key);
      const base = Math.max(1, Math.min(30, Math.floor(baseScores[key] || 1)));
      const total = Math.max(1, Math.min(30, Math.floor(base + bonus)));
      totals[key] = total;
      if (getScore(key) !== total) changed = true;
    });
    if (!changed) return;
    const { nextCaracs, nextCombatStats } = buildCaracsFromTotals(totals);
    props.onChangeCharacter({
      ...props.character,
      caracs: nextCaracs,
      combatStats: nextCombatStats
    });
  }, [statBonuses, asiBonusMap, statsBase, props.character?.caracs, props.character?.id]);

  const resetStats = () => {
    if (!initialStatsRef.current) return;
    setBaseScores(initialStatsRef.current);
  };
  const resetStatsFromBase = () => {
    const snapshot = getBaseScoresSnapshot();
    setBaseScores(snapshot);
  };

  const resetSkills = () => {
    const baseSkills = getBackgroundSkillProficiencies(activeBackground);
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
      ...getBackgroundToolProficiencies(activeBackground),
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

  const applySkillsAndMasteriesReset = (base: Personnage): Personnage => {
    const baseSkills = getBackgroundSkillProficiencies(activeBackground);
    const primaryProfs = classPrimary?.proficiencies ?? {};
    const secondaryProfs = classSecondary?.proficiencies ?? {};
    const backgroundTools = [
      ...getBackgroundToolProficiencies(activeBackground),
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
    return {
      ...base,
      competences: [...baseSkills],
      expertises: [],
      proficiencies: nextProfs
    };
  };

  const pruneStatBonusesBySource = (sources: string[]) => {
    const existing = ((choiceSelections as any)?.statBonuses ?? []) as Array<{
      stat: string;
      value: number;
      source?: string;
    }>;
    if (!Array.isArray(existing) || existing.length === 0) return null;
    const next = existing.filter(entry => !sources.includes(String(entry.source ?? "")));
    if (next.length === existing.length) return null;
    return next;
  };

  const getAutoEquipmentIds = (bgOverride?: BackgroundDefinition | null) => {
    const bgRef = typeof bgOverride === "undefined" ? activeBackground : bgOverride;
    const bgEquip = Array.isArray(bgRef?.equipment)
      ? (bgRef?.equipment as string[])
      : [];
    const classEquip = [
      ...getClassEquipment(classPrimary),
      ...getClassEquipment(classSecondary)
    ];
    return dedupeList([...bgEquip, ...classEquip]);
  };

  const applyBackgroundSelection = (bg: BackgroundDefinition) => {
    const nextSkills = Array.from(
      new Set([...(competences ?? []), ...getBackgroundSkillProficiencies(bg)])
    );
    const currentProfs = (props.character?.proficiencies ?? {}) as {
      weapons?: string[];
      armors?: string[];
      tools?: string[];
    };
    const nextProfs = {
      ...currentProfs,
      tools: Array.from(
        new Set([...(currentProfs.tools ?? []), ...getBackgroundToolProficiencies(bg)])
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
      const needsImmediateBonus =
        !getBackgroundToolChoice(bg) && !getBackgroundLanguageChoice(bg);
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
    props.onChangeCharacter({
      ...props.character,
      backgroundId: bg.id,
      competences: nextSkills,
      proficiencies: nextProfs,
      choiceSelections: nextChoiceSelections,
      caracs: nextCaracs
    });
  };
  const lockBackgroundAndCreateEquipment = () => {
    if (!activeBackground) return;
    const bonusApplied = Boolean((choiceSelections as any)?.background?.statBonusApplied);
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
    const backgroundEquip = Array.isArray(activeBackground.equipment)
      ? (activeBackground.equipment as string[])
      : [];
    const { nextAuto, nextInventory } = addAutoItemsToState(
      equipmentAuto,
      inventoryItems,
      backgroundEquip,
      { kind: "background", id: activeBackground.id }
    );
    const nextCharacter = applySkillsAndMasteriesReset({
      ...props.character,
      creationLocks: { ...creationLocks, backgrounds: true },
      choiceSelections: nextChoiceSelections,
      caracs: nextCaracs,
      equipmentAuto: nextAuto,
      inventoryItems: nextInventory
    });
    props.onChangeCharacter(nextCharacter);
  };

  const sourceColors: Record<string, string> = {
    race: "#2ecc71",
    background: "#f1c40f",
    classPrimary: "#4f7df2",
    subclassPrimary: "#6e8cff",
    classSecondary: "#7dc7ff",
    subclassSecondary: "#9ad4ff",
    asi: "#9b59b6",
    feat: "#e67e22",
    equipment: "#16a085"
  };
  const tabAccentColors: Record<string, string> = {
    species: sourceColors.race,
    backgrounds: sourceColors.background,
    classes: sourceColors.classPrimary,
    profile: "#e67e22",
    stats: "#f39c12",
    magic: "#8e44ad",
    equip: sourceColors.equipment,
    skills: "#3498db",
    masteries: "#1abc9c"
  };
  const toRgba = (hex: string, alpha: number) => {
    if (!hex || typeof hex !== "string") return `rgba(255,255,255,${alpha})`;
    const normalized = hex.replace("#", "");
    if (normalized.length !== 6) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
      return `rgba(255,255,255,${alpha})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const renderSourceDotsWithLabels = (sources: Array<{ key: string; label: string }>) => {
    if (sources.length === 0) return null;
    return (
      <div style={{ display: "flex", gap: 4 }}>
        {sources.map(source => (
          <span
            key={source.key}
            title={source.label}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: sourceColors[source.key] ?? "#999",
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
    if (getBackgroundSkillProficiencies(activeBackground).includes(skillId)) sources.push("background");
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
      (getBackgroundToolProficiencies(activeBackground).includes(id) ||
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
  const getSectionValidated = (id: string) => {
    if (id === "classes") {
      const hasSecondary = Boolean(secondaryClassEntry?.classeId);
      return Boolean(classLocks.primary) && (!hasSecondary || Boolean(classLocks.secondary));
    }
    return isSectionLocked(id);
  };
  const renderValidatedBadge = (validated: boolean) => {
    if (!validated) return null;
    return (
      <span
        style={{
          marginLeft: "auto",
          padding: "2px 6px",
          borderRadius: 999,
          border: "1px solid rgba(46, 204, 113, 0.6)",
          background: "rgba(46, 204, 113, 0.16)",
          color: "#e8fff2",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.2
        }}
      >
        Valide
      </span>
    );
  };

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
  const handleChoiceToggle = (id: string) => {
    setChoiceModal(prev => {
      const already = prev.selected.includes(id);
      let next = prev.selected;
      if (prev.multi) {
        next = already ? next.filter(item => item !== id) : [...next, id];
      } else {
        next = already ? [] : [id];
      }
      return { ...prev, selected: next };
    });
  };
  const handleChoiceConfirm = () => {
    if (choiceModal.selected.length < choiceModal.count) return;
    choiceModal.onConfirm(choiceModal.selected.slice(0, choiceModal.count));
    closeChoiceModal();
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
    let nextCaracs = props.character.caracs;
    let nextLocks = creationLocks;
    const remainingChoicesAfter = getPendingBackgroundChoiceCount(
      (nextChoiceSelections as any).background ?? {}
    );
    if (pendingLocks.backgrounds && remainingChoicesAfter <= 0) {
      delete nextPending.backgrounds;
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
    if (pendingLocks.backgrounds) {
      requireBackgroundChoices();
    }
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
    let nextCaracs = props.character.caracs;
    let nextLocks = creationLocks;
    const remainingChoicesAfter = getPendingBackgroundChoiceCount(
      (nextChoiceSelections as any).background ?? {}
    );
    if (pendingLocks.backgrounds && remainingChoicesAfter <= 0) {
      delete nextPending.backgrounds;
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
    if (pendingLocks.backgrounds) {
      requireBackgroundChoices();
    }
  };

  const requireRaceChoices = () => {
    if (!hasRaceTrait("adaptable")) return false;
    const adaptableSkill = (choiceSelections as any)?.race?.adaptableSkill;
    if (!adaptableSkill) {
      openChoiceModal({
        title: `${activeRace?.label ?? "Espece"} - Choisir une competence`,
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
    const toolChoices = getBackgroundToolChoice(activeBackground);
    if (toolChoices && toolChoices.count > 0) {
      const existing = Array.isArray(backgroundChoices.tools) ? backgroundChoices.tools : [];
      if (existing.length < toolChoices.count) {
        openChoiceModal({
          title: "Historique - Choisir un outil",
          options: (toolChoices.options ?? []).map(id => ({
            id,
            label: toolMasteryOptions.find(opt => opt.id === id)?.label ?? id
          })),
          selected: existing,
          count: toolChoices.count,
          multi: toolChoices.count > 1,
          onConfirm: selected => applyBackgroundToolChoices(selected)
        });
        return true;
      }
    }
    const languageChoices = getBackgroundLanguageChoice(activeBackground);
    if (languageChoices && languageChoices.count > 0) {
      const existing = Array.isArray(backgroundChoices.languages) ? backgroundChoices.languages : [];
      if (existing.length < languageChoices.count) {
        openChoiceModal({
          title: "Historique - Choisir des langues",
          options: languageOptions.map(lang => ({ id: lang.id, label: lang.label })),
          selected: existing,
          count: languageChoices.count,
          multi: languageChoices.count > 1,
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
            isPrimaryWeapon: false,
            isSecondaryHand: false
          }))
        : []
    });
  };

  const parseItemSpec = (rawId: string) => {
    const parts = rawId.split(":");
    if (parts.length >= 2) {
      const [prefix, id, qtyRaw] = parts;
      if (prefix === "weapon" || prefix === "armor" || prefix === "tool" || prefix === "object") {
        const qty = Math.max(1, Math.floor(Number(qtyRaw || 1)));
        return { type: prefix, id, qty };
      }
    }
    return { type: null as null | "weapon" | "armor" | "tool" | "object", id: rawId, qty: 1 };
  };

  const buildItemSpec = (
    type: "weapon" | "armor" | "tool" | "object",
    id: string,
    qty: number
  ) => {
    const safeQty = Math.max(1, Math.floor(Number(qty || 1)));
    if (type === "object" && (safeQty > 1 || isCoinId(id))) {
      return `object:${id}:${safeQty}`;
    }
    return safeQty > 1 ? `${type}:${id}:${safeQty}` : id;
  };

  const resolveItemType = (rawId: string) => {
    const parsed = parseItemSpec(rawId);
    if (parsed.type === "weapon") return { type: "weapon", id: parsed.id, qty: parsed.qty };
    if (parsed.type === "armor") return { type: "armor", id: parsed.id, qty: parsed.qty };
    if (parsed.type === "tool") return { type: "tool", id: parsed.id, qty: parsed.qty };
    if (parsed.type === "object") return { type: "object", id: parsed.id, qty: parsed.qty };
    if (objectItemMap.has(parsed.id)) return { type: "object", id: parsed.id, qty: parsed.qty };
    if (armorItemMap.has(parsed.id)) return { type: "armor", id: parsed.id, qty: parsed.qty };
    if (toolItemMap.has(parsed.id)) return { type: "tool", id: parsed.id, qty: parsed.qty };
    if (weaponItemMap.has(parsed.id)) return { type: "weapon", id: parsed.id, qty: parsed.qty };
    return { type: "object", id: parsed.id, qty: parsed.qty };
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
    const autoSpecs = autoIds.map(id => resolveItemType(id));
    const manualSpecs = manualIds.map(id => resolveItemType(id));
    const autoItems = buildInventoryEntries(
      autoSpecs,
      "auto",
      { kind: "auto" },
      createInstanceId
    );
    const manualItems = buildInventoryEntries(
      manualSpecs,
      "manual",
      { kind: "manual" },
      createInstanceId
    );
    return [...autoItems, ...manualItems];
  };
  const syncInventoryFromAutoManual = (
    autoIds: string[],
    manualIds: string[],
    current: Array<any>
  ) => {
    const desired = [
      ...autoIds.map(id => ({ ...resolveItemType(id), source: "auto" as const })),
      ...manualIds.map(id => ({ ...resolveItemType(id), source: "manual" as const }))
    ];
    const buckets = new Map<string, Array<any>>();
    current.forEach(item => {
      const key = `${item?.source ?? "auto"}:${item?.type ?? "object"}:${item?.id ?? ""}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)?.push(item);
    });
    const desiredExpanded = desired.flatMap(entry => {
      const qty = Math.max(1, Math.floor(Number(entry.qty || 1)));
      if (isCurrencySpec(entry.type, entry.id)) {
        return [{ ...entry, qty }];
      }
      return Array.from({ length: qty }).map(() => ({ ...entry, qty: 1 }));
    });
    return desiredExpanded.map(entry => {
      const key = `${entry.source}:${entry.type}:${entry.id}`;
      const bucket = buckets.get(key);
      if (bucket && bucket.length > 0) {
        const existing = bucket.shift();
        return {
          ...existing,
          source: entry.source,
          type: entry.type,
          id: entry.id,
          qty: entry.qty ?? existing?.qty ?? 1
        };
      }
      return {
        ...entry,
        qty: entry.qty ?? 1,
        ...(isCurrencySpec(entry.type, entry.id)
          ? null
          : { origin: { kind: entry.source }, instanceId: createInstanceId("item") }),
        equippedSlot: null,
        storedIn: null,
        isPrimaryWeapon: false,
        isSecondaryHand: false
      };
    });
  };

  const addAutoItemsToState = (
    baseAuto: string[],
    baseInventory: Array<any>,
    specIds: string[],
    origin?: { kind: string; id?: string }
  ) => {
    if (!specIds || specIds.length === 0) {
      return { nextAuto: baseAuto, nextInventory: baseInventory };
    }
    const resolvedSpecs = specIds.map(raw => resolveItemType(raw));
    const entries = buildInventoryEntries(
      resolvedSpecs.map(spec => ({ type: spec.type, id: spec.id, qty: spec.qty ?? 1 })),
      "auto",
      origin,
      createInstanceId
    );
    return {
      nextAuto: [...baseAuto, ...specIds],
      nextInventory: appendInventoryEntries(baseInventory, entries)
    };
  };

  const addManualItem = (id: string) => {
    const nextManual = [...equipmentManual, id];
    const resolved = resolveItemType(id);
    const entries = buildInventoryEntries(
      [{ type: resolved.type, id: resolved.id, qty: resolved.qty ?? 1 }],
      "manual",
      { kind: "manual" },
      createInstanceId
    );
    const nextInventory = appendInventoryEntries(inventoryItems, entries);
    props.onChangeCharacter({
      ...props.character,
      equipmentManual: nextManual,
      inventoryItems: nextInventory
    });
  };

  const removeManualItem = (inventoryIndex: number) => {
    const target = inventoryItems[inventoryIndex];
    if (!target) return;
    if ((target.qty ?? 1) > 1) {
      const nextManual = updateEquipmentListQty(
        equipmentManual,
        resolveItemType,
        buildItemSpec,
        target.type,
        target.id,
        -1
      );
      const nextInventory = inventoryItems.map((item, idx) =>
        idx === inventoryIndex ? { ...item, qty: (item.qty ?? 1) - 1 } : item
      );
      props.onChangeCharacter({
        ...props.character,
        equipmentManual: nextManual,
        inventoryItems: nextInventory
      });
      return;
    }
    const nextManual = updateEquipmentListQty(
      equipmentManual,
      resolveItemType,
      buildItemSpec,
      target.type,
      target.id,
      -1
    );
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

  const isCurrencyItem = (item: any) => item?.type === "object" && isCoinId(item?.id ?? "");

  const getItemUnitValue = (item: any) => {
    if (!item) return null;
    if (item.type === "weapon") {
      const def = weaponItemMap.get(item.id);
      const value = def?.value;
      if (!value) return null;
      return {
        po: Number(value.gold ?? 0) || 0,
        pa: Number(value.silver ?? 0) || 0,
        pc: Number(value.copper ?? 0) || 0
      };
    }
    if (item.type === "armor") {
      const def = armorItemMap.get(item.id);
      if (def?.value) return def.value;
      if (Number.isFinite(def?.priceGp)) {
        return { po: Number(def?.priceGp ?? 0) || 0 };
      }
      return null;
    }
    if (item.type === "object") {
      const def = objectItemMap.get(item.id);
      if (def?.value) return def.value;
      if (Number.isFinite(def?.priceGp)) {
        return { po: Number(def?.priceGp ?? 0) || 0 };
      }
      return null;
    }
    return null;
  };

  const addMoneyToInventory = (
    money: { pp?: number; po?: number; pa?: number; pc?: number },
    baseManual: string[],
    baseInventory: Array<any>
  ) => {
    const stacks = moneyToCoinStacks(money);
    if (stacks.length === 0) return { nextManual: baseManual, nextInventory: baseInventory };
    const entries = buildInventoryEntries(
      stacks.map(stack => ({ type: "object", id: stack.id, qty: stack.qty })),
      "loot",
      undefined,
      createInstanceId
    );
    const nextInventory = appendInventoryEntries(baseInventory, entries);
    return { nextManual: baseManual, nextInventory };
  };

  const sellInventoryItem = (inventoryIndex: number) => {
    const target = inventoryItems[inventoryIndex];
    if (!target || isSectionLocked("equip")) return;
    if (isCurrencyItem(target)) return;
    const unitValue = getItemUnitValue(target);
    if (!unitValue || moneyToCopper(unitValue) <= 0) return;
    const soldValue = scaleMoney(unitValue, 1);
    const nextAuto =
      target.source === "auto"
        ? updateEquipmentListQty(
            equipmentAuto,
            resolveItemType,
            buildItemSpec,
            target.type,
            target.id,
            -1
          )
        : equipmentAuto;
    const nextManual =
      target.source === "manual"
        ? updateEquipmentListQty(
            equipmentManual,
            resolveItemType,
            buildItemSpec,
            target.type,
            target.id,
            -1
          )
        : equipmentManual;
    const slots = { ...materielSlots };
    let nextInventory = [...inventoryItems];
    if ((target.qty ?? 1) > 1) {
      nextInventory = nextInventory.map((item, idx) =>
        idx === inventoryIndex ? { ...item, qty: (item.qty ?? 1) - 1 } : item
      );
    } else {
      if (target.equippedSlot && slots[target.equippedSlot]) {
        slots[target.equippedSlot] = null;
      }
      nextInventory = nextInventory.filter((_, idx) => idx !== inventoryIndex);
    }
    const moneyResult = addMoneyToInventory(soldValue, nextManual, nextInventory);
    props.onChangeCharacter({
      ...props.character,
      equipmentAuto: nextAuto,
      equipmentManual: moneyResult.nextManual,
      materielSlots: slots,
      inventoryItems: moneyResult.nextInventory
    });
  };
  const handleSellRequest = (index: number, item: any, itemValue: any) => {
    const label = getItemLabel(item);
    const valueLabel = itemValue ? formatMoneyValue(itemValue) : "0";
    setConfirmModal({
      open: true,
      title: "Avertissement",
      message: `Vendre ${label} ? Gains: ${valueLabel}. L'objet sera supprime de l'inventaire.`,
      onConfirm: () => {
        sellInventoryItem(index);
        closeConfirmModal();
      }
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
      if (packSlots.has(slot)) {
        const limit = packSlotMaxWeight[slot];
        if (typeof limit === "number") {
          const totalWeight = getPackTotalWeightForItem(targetItem);
          if (totalWeight > limit) {
            setEquipMessage("Ce sac depasse la limite de 5.2kg pour la ceinture.");
            return;
          }
        }
      }
    }
    const previousSlots = { ...materielSlots };
    const slots = { ...materielSlots };
    let nextInventory = inventoryItems.map((item, idx) => {
      if (idx === index) return item;
      if (slot && item.equippedSlot === slot) {
        return { ...item, equippedSlot: null, isPrimaryWeapon: false, isSecondaryHand: false };
      }
      return item;
    });
    const keepPrimary =
      targetItem.type === "weapon" && slot && weaponCarrySlots.has(slot)
        ? Boolean(targetItem.isPrimaryWeapon)
        : false;
    const keepSecondary =
      slot && !targetItem.storedIn
        ? Boolean(targetItem.isSecondaryHand)
        : false;
    const nextForTarget = {
      ...targetItem,
      equippedSlot: slot,
      storedIn: null,
      isPrimaryWeapon: keepPrimary,
      isSecondaryHand: keepSecondary
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
    const wasPackSlot =
      targetItem.equippedSlot && packSlots.has(targetItem.equippedSlot);
    const isPackSlot = slot && packSlots.has(slot);
    if (isPackSlot) {
      const destPrevBagId = previousSlots[slot] ?? null;
      if (destPrevBagId && slot !== targetItem.equippedSlot) {
        nextInventory = nextInventory.map(item => {
          const inDest =
            item?.storedIn === slot ||
            (slot === "paquetage" && item?.storedIn === destPrevBagId);
          if (!inDest) return item;
          return { ...item, storedIn: null };
        });
      }
      if (wasPackSlot && targetItem.equippedSlot && targetItem.equippedSlot !== slot) {
        const fromSlot = targetItem.equippedSlot;
        const fromBagId = previousSlots[fromSlot] ?? null;
        nextInventory = nextInventory.map(item => {
          const inFrom =
            item?.storedIn === fromSlot ||
            (fromSlot === "paquetage" && fromBagId && item?.storedIn === fromBagId);
          if (!inFrom) return item;
          return { ...item, storedIn: slot };
        });
      }
    }
    if (!slot && wasPackSlot && targetItem.equippedSlot) {
      const fromSlot = targetItem.equippedSlot;
      const fromBagId = previousSlots[fromSlot] ?? null;
      nextInventory = nextInventory.map(item => {
        const inFrom =
          item?.storedIn === fromSlot ||
          (fromSlot === "paquetage" && fromBagId && item?.storedIn === fromBagId);
        if (!inFrom) return item;
        return { ...item, storedIn: null };
      });
    }
    props.onChangeCharacter({
      ...props.character,
      materielSlots: slots,
      inventoryItems: nextInventory
    });
  };
  const storeItemInPack = (index: number, slotId: string) => {
    if (!packSlots.has(slotId)) return;
    const previousSlots = { ...materielSlots };
    const bagId = getPackSlotItemId(slotId);
    const bagCapacity = getPackCapacity(slotId);
    if (!bagId || bagCapacity <= 0) return;
    const item = inventoryItems[index];
    if (!item) return;
    const containerItem = inventoryItems.find(
      entry => entry?.equippedSlot === slotId && entry?.id === bagId
    );
    if (containerItem && containerItem === item) {
      setEquipMessage("Impossible de ranger un sac dans lui-meme.");
      return;
    }
    const itemWeight = getItemWeight(item) * (Number(item?.qty ?? 1) || 1);
    const storedWeight = getStoredWeightForSlot(slotId);
    const slotLimit = packSlotMaxWeight[slotId];
    const bagWeight = containerItem ? getItemWeight(containerItem) : 0;
    if (item.storedIn !== slotId && storedWeight + itemWeight > bagCapacity) {
      setEquipMessage("Capacite du sac depassee.");
      return;
    }
    if (
      typeof slotLimit === "number" &&
      item.storedIn !== slotId &&
      bagWeight + storedWeight + itemWeight > slotLimit
    ) {
      setEquipMessage("Ce sac depasse la limite de 5.2kg pour la ceinture.");
      return;
    }
    const slots = { ...materielSlots };
    let nextInventory = inventoryItems.map((entry, idx) => {
      if (idx !== index) return entry;
      return {
        ...entry,
        equippedSlot: null,
        storedIn: slotId,
        isPrimaryWeapon: false,
        isSecondaryHand: false
      };
    });
    if (item.equippedSlot && slots[item.equippedSlot]) {
      const fromSlot = item.equippedSlot;
      slots[fromSlot] = null;
      if (packSlots.has(fromSlot)) {
        const fromBagId = previousSlots[fromSlot] ?? null;
        nextInventory = nextInventory.map(entry => {
          const inFrom =
            entry?.storedIn === fromSlot ||
            (fromSlot === "paquetage" && fromBagId && entry?.storedIn === fromBagId);
          if (!inFrom) return entry;
          return { ...entry, storedIn: null };
        });
      }
    }
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
    const creatorConstraintAction: ActionDefinition = {
      id: "creator:set-primary-weapon",
      name: "Set Primary Weapon",
      category: "attack",
      actionCost: { actionType: "free", movementCost: 0 },
      targeting: {
        target: "enemy",
        range: { min: 0, max: 1.5, shape: "single" },
        maxTargets: 1,
        requiresLos: false
      },
      usage: { perTurn: null, perEncounter: null },
      conditions: [],
      components: { verbal: false, somatic: false, material: false }
    };
    const issues = getEquipmentConstraintIssues({
      action: creatorConstraintAction,
      inventoryItems: inventoryItems as Array<any>,
      weaponById: weaponItemMap,
      armorById: armorItemMap,
      selectedWeapon: weapon ?? null,
      features: activeFeatureDefs
    });
    if (issues.length > 0) {
      setEquipMessage(issues[0]);
      return;
    }
    const selectedTwoHanded = Boolean(weapon?.properties?.twoHanded);
    const nextInventory = inventoryItems.map((entry, idx) => ({
      ...entry,
      isPrimaryWeapon: idx === index,
      isSecondaryHand:
        selectedTwoHanded
          ? false
          : Boolean(entry?.isSecondaryHand) && idx !== index
    }));
    props.onChangeCharacter({ ...props.character, inventoryItems: nextInventory });
  };
  const setSecondaryHand = (index: number) => {
    const item = inventoryItems[index];
    if (!item || !["weapon", "armor", "object"].includes(String(item.type ?? ""))) return;
    if (!item.equippedSlot || item.storedIn) {
      setEquipMessage("La main secondaire doit referencer un item equipe (pas dans un sac).");
      return;
    }
    const primaryItem = inventoryItems.find(entry => entry?.isPrimaryWeapon) ?? null;
    const primaryWeapon = primaryItem?.type === "weapon" ? weaponItemMap.get(primaryItem.id) ?? null : null;
    if (primaryWeapon?.properties?.twoHanded) {
      setEquipMessage("Main secondaire indisponible: arme principale a deux mains.");
      return;
    }
    if (item.type === "weapon") {
      const w = weaponItemMap.get(item.id) ?? null;
      if (w?.properties?.twoHanded) {
        setEquipMessage("Une arme a deux mains ne peut pas etre assignee en main secondaire.");
        return;
      }
    }
    const nextInventory = inventoryItems.map((entry, idx) => ({
      ...entry,
      isSecondaryHand: idx === index
    }));
    props.onChangeCharacter({ ...props.character, inventoryItems: nextInventory });
  };
  const toggleItemHarmonization = (index: number) => {
    const item = inventoryItems[index];
    if (!item) return;
    if (!isItemHarmonisable(item)) return;
    const nextState = !isInventoryItemHarmonized(item);
    const nextInventory = inventoryItems.map((entry, idx) => {
      if (idx !== index) return entry;
      const nextAttunement =
        nextState
          ? {
              ...(entry?.attunement ?? {}),
              state: "harmonized",
              harmonizedAt:
                typeof entry?.attunement?.harmonizedAt === "string" &&
                entry.attunement.harmonizedAt.length > 0
                  ? entry.attunement.harmonizedAt
                  : new Date().toISOString()
            }
          : null;
      return {
        ...entry,
        harmonized: nextState,
        isHarmonized: nextState,
        attuned: nextState,
        attunement: nextAttunement
      };
    });
    const prevAttunements = (((props.character as any)?.attunements ?? {}) as Record<string, boolean>);
    const nextAttunements: Record<string, boolean> = { ...prevAttunements };
    const keys: string[] = [];
    if (typeof item?.instanceId === "string" && item.instanceId.length > 0) {
      keys.push(item.instanceId, `instance:${item.instanceId}`);
    }
    if (typeof item?.id === "string" && item.id.length > 0) {
      keys.push(item.id, `item:${item.id}`);
    }
    keys.forEach(key => {
      if (!key) return;
      if (nextState) nextAttunements[key] = true;
      else delete nextAttunements[key];
    });
    props.onChangeCharacter({
      ...props.character,
      inventoryItems: nextInventory,
      attunements: nextAttunements
    });
  };

  useEffect(() => {
    if (inventoryInitRef.current) return;
    inventoryInitRef.current = true;
  }, []);

  const handleSpeciesSelect = (raceId: string) => {
    const race = raceOptions.find(entry => entry.id === raceId) ?? null;
    const baseActionIds = Array.isArray(race?.actionIds)
      ? race?.actionIds.filter(Boolean)
      : ["melee-strike", "dash"];
    const nextActionIds = Array.from(new Set(baseActionIds));
    const currentVision = ((props.character as any)?.visionProfile ?? {}) as Record<string, any>;
    const raceVisionMode = String(race?.vision?.mode ?? "").toLowerCase();
    const raceVisionLight: "normal" | "lowlight" | "darkvision" =
      raceVisionMode === "darkvision"
        ? "darkvision"
        : raceVisionMode === "lowlight"
          ? "lowlight"
          : "normal";
    const nextVisionProfile = {
      shape: currentVision.shape ?? "cone",
      range:
        typeof currentVision.range === "number"
          ? currentVision.range
          : Number(race?.vision?.range ?? 100) || 100,
      apertureDeg: currentVision.apertureDeg ?? 180,
      lightVision: raceVisionLight
    };
    const currentMovementModes = ((props.character as any)?.movementModes ?? {}) as Record<string, any>;
    const nextMovementModes = {
      ...currentMovementModes,
      walk:
        typeof race?.speed === "number"
          ? race.speed
          : Number(currentMovementModes.walk ?? 6) || 6
    };
    if (!isSectionLocked("species")) {
      props.onChangeCharacter({
        ...props.character,
        raceId,
        actionIds: nextActionIds,
        reactionIds: [],
        movementModes: nextMovementModes,
        visionProfile: nextVisionProfile
      });
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
          actionIds: nextActionIds,
          reactionIds: [],
          movementModes: nextMovementModes,
          visionProfile: nextVisionProfile,
          creationLocks: nextLocks,
          classLock: false,
          classLocks: { primary: false, secondary: false },
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
        const prevSkills = getBackgroundSkillProficiencies(prevBackground);
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
          classLocks: { primary: false, secondary: false },
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
          classLocks: { primary: false, secondary: false },
          choiceSelections: nextChoiceSelections
        });
        setClassSelection(cls, slot);
        resetMasteries();
        resetMateriel();
        closeConfirmModal();
      }
    });
  };

  const hasSubclassChoicePending = (slot: 1 | 2) => {
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
    return options.length > 0;
  };

  const promptSubclassChoiceForSlot = (slot: 1 | 2, onDone?: () => void) => {
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
        if (onDone) onDone();
      }
    });
    return true;
  };

  const getOtherAsiSumForStat = (
    stat: typeof STAT_KEYS[number],
    entryKey: string,
    overrides?: Record<string, { type: "asi" | "feat"; stats?: Record<string, number> }>
  ) => {
    let total = 0;
    Object.entries(asiSelections).forEach(([key, entry]) => {
      if (key === entryKey) return;
      const override = overrides?.[key] ?? null;
      const effective = override ?? entry;
      if (!effective || effective.type !== "asi" || !effective.stats) return;
      total += Number(effective.stats[stat] ?? 0) || 0;
    });
    return total;
  };
  const canAllocateMoreAsi = (
    entryKey: string,
    stats: Record<string, number>,
    overrides?: Record<string, { type: "asi" | "feat"; stats?: Record<string, number> }>
  ) => {
    const spent = Object.values(stats).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const remaining = Math.max(0, 2 - spent);
    if (remaining <= 0) return false;
    return STAT_KEYS.some(stat => {
      const current = Number(stats[stat] ?? 0) || 0;
      if (current >= 2) return false;
      const base = getBaseScore(stat);
      const nonAsi = getNonAsiBonusSumForStat(stat);
      const otherAsi = getOtherAsiSumForStat(stat, entryKey, overrides);
      const total = base + nonAsi + otherAsi + current;
      return total < 20;
    });
  };
  const isAsiEntryComplete = (
    entry: { type: "asi" | "feat"; stats?: Record<string, number> } | null,
    entryKey?: string,
    overrides?: Record<string, { type: "asi" | "feat"; stats?: Record<string, number> }>
  ) => {
    if (!entry) return false;
    if (entry.type === "feat") return true;
    const stats = entry.stats ?? {};
    const total = Object.values(stats).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );
    if (total >= 2) return true;
    if (!entryKey) return false;
    return !canAllocateMoreAsi(entryKey, stats, overrides);
  };
  const getMissingAsiEntries = (
    overrides?: Record<string, { type: "asi" | "feat"; stats?: Record<string, number> }>
  ) => {
    const entries = getClassAsiLevels();
    return entries.filter(entryInfo => {
      const override = overrides?.[entryInfo.key] ?? null;
      const entry = override ?? getAsiEntryForLevel(entryInfo);
      return !isAsiEntryComplete(entry, entryInfo.key, overrides);
    });
  };
  const pruneAsiSelectionsForLevels = (slot: 1 | 2) => {
    const clsId = slot === 1 ? classEntry?.classeId : secondaryClassEntry?.classeId;
    if (!clsId) return;
    const level = Number((slot === 1 ? classEntry?.niveau : secondaryClassEntry?.niveau) ?? 0);
    const allowed = new Set(
      getClassAsiLevels()
        .filter(entry => entry.classId === clsId)
        .map(entry => entry.key)
    );
    const nextAsi = { ...asiSelections };
    let changed = false;
    Object.keys(nextAsi).forEach(key => {
      if (!key.startsWith(`${clsId}:`)) return;
      if (!allowed.has(key)) {
        delete nextAsi[key];
        changed = true;
      }
    });
    if (changed) {
      props.onChangeCharacter({
        ...props.character,
        choiceSelections: { ...choiceSelections, asi: nextAsi }
      });
    }
  };
  const hasMissingAsiForSlot = (slot: 1 | 2) => {
    const classId = slot === 1 ? classPrimary?.id : classSecondary?.id;
    if (!classId) return false;
    return getMissingAsiEntries().some(entry => entry.classId === classId);
  };
  const getMissingAsiEntryForSlot = (slot: 1 | 2) => {
    const classId = slot === 1 ? classPrimary?.id : classSecondary?.id;
    if (!classId) return null;
    return getMissingAsiEntries().find(entry => entry.classId === classId) ?? null;
  };
  const getClassFeatureChoicesFromFeature = (featureId: string) => {
    const feature = featureById.get(String(featureId));
    const rules = (feature?.rules ?? {}) as Record<string, any>;
    const rawChoices = Array.isArray(rules?.choices) ? (rules.choices as Array<any>) : [];
    return rawChoices
      .map((rawChoice, index) => {
        const keyRaw = String(rawChoice?.key ?? rawChoice?.id ?? "").trim();
        const key = keyRaw || `choice-${index + 1}`;
        const count = Math.max(1, Math.floor(Number(rawChoice?.count ?? 1)));
        const titleRaw = String(rawChoice?.title ?? rawChoice?.label ?? "").trim();
        const title = titleRaw || feature?.label || humanizeId(featureId);
        const optionsRaw = Array.isArray(rawChoice?.options) ? rawChoice.options : [];
        const options = optionsRaw
          .map((rawOption: any) => {
            if (typeof rawOption === "string") {
              const id = rawOption.trim();
              if (!id) return null;
              return {
                id,
                label: humanizeId(id),
                summary: "",
                grants: [] as Array<{ kind: string; ids: string[] }>
              };
            }
            const id = String(rawOption?.id ?? "").trim();
            if (!id) return null;
            const grantsRaw = Array.isArray(rawOption?.grants) ? rawOption.grants : [];
            const grants = grantsRaw
              .map((grant: any) => {
                const kind = String(grant?.kind ?? "").trim();
                const ids = Array.isArray(grant?.ids)
                  ? grant.ids.map((entry: any) => String(entry)).filter(Boolean)
                  : [];
                if (!kind || ids.length === 0) return null;
                return { kind, ids };
              })
              .filter(Boolean) as Array<{ kind: string; ids: string[] }>;
            return {
              id,
              label: String(rawOption?.label ?? "").trim() || humanizeId(id),
              summary: String(rawOption?.summary ?? "").trim(),
              grants
            };
          })
          .filter(Boolean) as Array<{
          id: string;
          label: string;
          summary: string;
          grants: Array<{ kind: string; ids: string[] }>;
        }>;
        if (options.length === 0) return null;
        return { key, title, count, options, featureId };
      })
      .filter(Boolean) as Array<{
      key: string;
      title: string;
      count: number;
      options: Array<{
        id: string;
        label: string;
        summary: string;
        grants: Array<{ kind: string; ids: string[] }>;
      }>;
      featureId: string;
    }>;
  };
  const getClassFeatureChoicesForSlot = (slot: 1 | 2) => {
    const cls = slot === 1 ? classPrimary : classSecondary;
    const entry = slot === 1 ? classEntry : secondaryClassEntry;
    if (!cls) return [];
    const classLevel = Number(entry?.niveau ?? 0);
    if (!Number.isFinite(classLevel) || classLevel <= 0) return [];
    const sources: Array<{ source: string; progression?: Record<string, any> }> = [
      { source: `class:${cls.id}`, progression: cls.progression }
    ];
    const subclassId = slot === 1 ? selectedSubclassId : selectedSecondarySubclassId;
    if (subclassId) {
      const sub = subclassOptions.find(item => item.id === subclassId) ?? null;
      if (sub) {
        sources.push({ source: `subclass:${sub.id}`, progression: sub.progression });
      }
    }
    const byId = new Map<
      string,
      {
        id: string;
        key: string;
        title: string;
        count: number;
        options: Array<{
          id: string;
          label: string;
          summary: string;
          grants: Array<{ kind: string; ids: string[] }>;
        }>;
      }
    >();
    sources.forEach(source => {
      if (!source.progression) return;
      Object.keys(source.progression)
        .map(key => Number(key))
        .filter(lvl => Number.isFinite(lvl) && lvl > 0 && lvl <= classLevel)
        .sort((a, b) => a - b)
        .forEach(lvl => {
          const grants = Array.isArray(source.progression?.[String(lvl)]?.grants)
            ? source.progression[String(lvl)].grants
            : [];
          grants.forEach((grant: any) => {
            if (String(grant?.kind ?? "").toLowerCase() !== "feature") return;
            const ids = Array.isArray(grant?.ids) ? grant.ids : [];
            ids.forEach((featureId: any) => {
              getClassFeatureChoicesFromFeature(String(featureId)).forEach(choice => {
                const id = `${source.source}:${choice.featureId}:${choice.key}`;
                if (!byId.has(id)) {
                  byId.set(id, {
                    id,
                    key: choice.key,
                    title: choice.title,
                    count: choice.count,
                    options: choice.options
                  });
                }
              });
            });
          });
        });
    });
    return Array.from(byId.values());
  };
  const getSelectedClassFeatureOptions = (
    choiceId: string,
    overrides?: Record<string, { selected?: string[] }>
  ) => {
    const source = overrides ?? classFeatureSelections;
    const selected = source?.[choiceId]?.selected;
    return Array.isArray(selected)
      ? selected.map(value => String(value)).filter(Boolean)
      : [];
  };
  const getMissingClassFeatureChoicesForSlot = (
    slot: 1 | 2,
    overrides?: Record<string, { selected?: string[] }>
  ) =>
    getClassFeatureChoicesForSlot(slot).filter(choice => {
      const selected = getSelectedClassFeatureOptions(choice.id, overrides);
      return selected.length < choice.count;
    });
  const getMissingClassFeatureChoiceForSlot = (
    slot: 1 | 2,
    overrides?: Record<string, { selected?: string[] }>
  ) => getMissingClassFeatureChoicesForSlot(slot, overrides)[0] ?? null;
  const hasMissingClassFeatureChoiceForSlot = (slot: 1 | 2) =>
    getMissingClassFeatureChoiceForSlot(slot) !== null;
  const extractWeaponMasteryIdsFromGrant = (grant: { kind: string; ids: string[] }) => {
    const kind = String(grant.kind ?? "").trim().toLowerCase();
    const ids = Array.isArray(grant.ids)
      ? grant.ids.map(id => normalizeWeaponMasteryId(id)).filter(Boolean)
      : [];
    if (ids.length === 0) return [] as string[];
    if (
      kind === "weaponmastery" ||
      kind === "weapon-mastery" ||
      kind === "weapon_mastery" ||
      kind === "wm"
    ) {
      return ids;
    }
    if (kind === "feature") {
      return ids
        .map(id => normalizeWeaponMasteryId(id.startsWith("wm-") ? id.slice(3) : id))
        .filter(id => weaponMasteryIdSet.has(id));
    }
    return [] as string[];
  };
  const selectedWeaponMasteries = useMemo(() => {
    const byId = new Set<string>();
    let hasChoicePool = false;
    ([1, 2] as const).forEach(slot => {
      const choices = getClassFeatureChoicesForSlot(slot);
      choices.forEach(choice => {
        const selectedOptionIds = new Set(getSelectedClassFeatureOptions(choice.id));
        choice.options.forEach(option => {
          const grantedMasteries = option.grants.flatMap(extractWeaponMasteryIdsFromGrant);
          if (grantedMasteries.length > 0) hasChoicePool = true;
          if (!selectedOptionIds.has(option.id)) return;
          grantedMasteries.forEach(id => byId.add(id));
        });
      });
    });
    return { ids: Array.from(byId), hasChoicePool };
  }, [
    classFeatureSelections,
    classPrimary?.id,
    classSecondary?.id,
    classEntry?.niveau,
    secondaryClassEntry?.niveau,
    selectedSubclassId,
    selectedSecondarySubclassId,
    subclassOptions
  ]);
  const selectedCombatStyles = useMemo(() => {
    const byId = new Map<string, string>();
    ([1, 2] as const).forEach(slot => {
      const choices = getClassFeatureChoicesForSlot(slot);
      choices.forEach(choice => {
        const selectedOptionIds = new Set(getSelectedClassFeatureOptions(choice.id));
        choice.options.forEach(option => {
          if (!selectedOptionIds.has(option.id)) return;
          option.grants.forEach(grant => {
            if (String(grant.kind).toLowerCase() !== "feature") return;
            grant.ids
              .map(id => String(id))
              .filter(id => id.startsWith("fighting-style-"))
              .forEach(featureId => {
                const label = featureById.get(featureId)?.label ?? option.label ?? featureId;
                byId.set(featureId, label);
              });
          });
        });
      });
    });
    return Array.from(byId.entries()).map(([id, label]) => ({ id, label }));
  }, [
    classFeatureSelections,
    classPrimary?.id,
    classSecondary?.id,
    classEntry?.niveau,
    secondaryClassEntry?.niveau,
    selectedSubclassId,
    selectedSecondarySubclassId,
    featureById,
    subclassOptions
  ]);
  useEffect(() => {
    if (!selectedWeaponMasteries.hasChoicePool) return;
    const current = Array.isArray((props.character as any)?.weaponMasteries)
      ? (((props.character as any)?.weaponMasteries as string[])
          .map(id => normalizeWeaponMasteryId(id))
          .filter(Boolean))
      : [];
    const next = selectedWeaponMasteries.ids;
    if (arraysEqual(current, next)) return;
    props.onChangeCharacter({ ...props.character, weaponMasteries: next });
  }, [
    selectedWeaponMasteries,
    props.character,
    props.onChangeCharacter
  ]);
  const hasPendingClassChoicesForSlot = (slot: 1 | 2) =>
    hasSubclassChoicePending(slot) ||
    hasMissingClassFeatureChoiceForSlot(slot) ||
    hasMissingAsiForSlot(slot);

  const hasPendingRaceChoices = () => {
    if (!hasRaceTrait("adaptable")) return false;
    const adaptableSkill = (choiceSelections as any)?.race?.adaptableSkill;
    return !adaptableSkill;
  };
  const getPendingBackgroundChoiceCount = (overrides?: Record<string, any>) => {
    if (!activeBackground) return 0;
    const backgroundChoices = overrides ?? (choiceSelections as any)?.background ?? {};
    let count = 0;
    const toolChoices = getBackgroundToolChoice(activeBackground);
    if (toolChoices && toolChoices.count > 0) {
      const existing = Array.isArray(backgroundChoices.tools) ? backgroundChoices.tools : [];
      if (existing.length < toolChoices.count) {
        count += toolChoices.count - existing.length;
      }
    }
    const languageChoices = getBackgroundLanguageChoice(activeBackground);
    if (languageChoices && languageChoices.count > 0) {
      const existing = Array.isArray(backgroundChoices.languages)
        ? backgroundChoices.languages
        : [];
      if (existing.length < languageChoices.count) {
        count += languageChoices.count - existing.length;
      }
    }
    return count;
  };
  const hasPendingBackgroundChoices = () => getPendingBackgroundChoiceCount() > 0;
  const getPendingRaceChoiceCount = () => (hasPendingRaceChoices() ? 1 : 0);
  const getPendingClassChoiceCount = (slot: 1 | 2) => {
    let count = 0;
    if (hasSubclassChoicePending(slot)) count += 1;
    getMissingClassFeatureChoicesForSlot(slot).forEach(choice => {
      const selected = getSelectedClassFeatureOptions(choice.id);
      count += Math.max(0, choice.count - selected.length);
    });
    const classId = slot === 1 ? classPrimary?.id : classSecondary?.id;
    if (classId) {
      count += getMissingAsiEntries().filter(entry => entry.classId === classId).length;
    }
    return count;
  };
  const getLockButtonState = (id: string) => {
    const locked = isSectionLocked(id);
    let needsDefine = false;
    if (!locked) {
      if (id === "species") needsDefine = hasPendingRaceChoices();
      if (id === "backgrounds") needsDefine = hasPendingBackgroundChoices();
      if (id === "stats") needsDefine = !canLockStats();
    }
    return {
      locked,
      needsDefine,
      label: locked ? "Deverouiller" : needsDefine ? "Definir" : "Verouiller",
      background: locked
        ? "rgba(46, 204, 113, 0.22)"
        : needsDefine
          ? "rgba(243, 156, 18, 0.24)"
          : "rgba(231, 76, 60, 0.22)"
    };
  };
  const getClassLockButtonState = () => {
    const locked = isActiveClassLocked;
    const needsDefine = !locked && hasPendingClassChoicesForSlot(activeClassSlot);
    return {
      locked,
      needsDefine,
      label: locked ? "Deverouiller" : needsDefine ? "Definir" : "Verouiller",
      background: locked
        ? "rgba(46, 204, 113, 0.22)"
        : needsDefine
          ? "rgba(243, 156, 18, 0.24)"
          : "rgba(231, 76, 60, 0.22)"
    };
  };
  const getPendingCountForSection = (id: string) => {
    if (id === "species") return getPendingRaceChoiceCount();
    if (id === "backgrounds") return getPendingBackgroundChoiceCount();
    if (id === "classes") return getPendingClassChoiceCount(activeClassSlot);
    return 0;
  };
  const lockButtonBaseStyle: React.CSSProperties = {
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#f5f5f5",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    width: 120,
    minWidth: 120,
    maxWidth: 120,
    height: 26,
    minHeight: 26,
    textAlign: "center",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    whiteSpace: "nowrap"
  };
  const renderPendingBadge = (count: number) => {
    if (count <= 0) return null;
    return (
      <span
        style={{
          marginLeft: 6,
          flex: "0 0 auto",
          minWidth: 16,
          height: 16,
          padding: "0 4px",
          borderRadius: 999,
          background: "#f39c12",
          color: "#0b0b12",
          fontSize: 10,
          fontWeight: 800,
          lineHeight: "16px",
          textAlign: "center",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          verticalAlign: "middle"
        }}
      >
        {count > 9 ? "9+" : count}
      </span>
    );
  };
  const startBackgroundDefine = () => {
    if (!activeBackground) return;
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: {
        ...choiceSelections,
        pendingLocks: { ...pendingLocks, backgrounds: true }
      }
    });
    requireBackgroundChoices();
  };
  const startClassDefine = (slot: 1 | 2) => {
    const pendingForClass = {
      ...pendingLocks,
      classes: true,
      classesSlot: slot
    };
    const withPendingSelections = {
      ...choiceSelections,
      pendingLocks: pendingForClass
    };
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: withPendingSelections
    });
    const finalizeClassDefine = (baseChoiceSelections: Record<string, any>) => {
      const nextPending = { ...(((baseChoiceSelections as any)?.pendingLocks ?? pendingForClass) as Record<string, any>) };
      delete nextPending.classes;
      delete nextPending.classesSlot;
      const nextCharacter = buildClassLockCharacter(slot, baseChoiceSelections, nextPending);
      props.onChangeCharacter(nextCharacter);
    };
    const openNextAsi = () => {
      const nextEntry = getMissingAsiEntryForSlot(slot);
      if (nextEntry) {
        openAsiModal(nextEntry);
        return true;
      }
      return false;
    };
    const openNextClassFeatureChoice = (
      overrides?: Record<string, { selected?: string[] }>
    ) => {
      const nextChoice = getMissingClassFeatureChoiceForSlot(slot, overrides);
      if (!nextChoice) return false;
      const selected = getSelectedClassFeatureOptions(nextChoice.id, overrides);
      openChoiceModal({
        title: nextChoice.title,
        options: nextChoice.options.map(option => ({
          id: option.id,
          label: option.summary ? `${option.label} - ${option.summary}` : option.label
        })),
        selected,
        count: nextChoice.count,
        multi: nextChoice.count > 1,
        onConfirm: picked => {
          const nextClassFeatures = {
            ...(overrides ?? classFeatureSelections),
            [nextChoice.id]: {
              selected: picked.slice(0, nextChoice.count)
            }
          };
          const nextChoiceSelections = {
            ...withPendingSelections,
            classFeatures: nextClassFeatures
          };
          props.onChangeCharacter({
            ...props.character,
            choiceSelections: nextChoiceSelections
          });
          if (openNextClassFeatureChoice(nextClassFeatures)) return;
          if (!openNextAsi()) {
            finalizeClassDefine(nextChoiceSelections);
          }
        }
      });
      return true;
    };
    if (hasSubclassChoicePending(slot)) {
      promptSubclassChoiceForSlot(slot, () => {
        if (openNextClassFeatureChoice()) return;
        if (openNextAsi()) return;
        finalizeClassDefine(withPendingSelections);
      });
      return;
    }
    if (openNextClassFeatureChoice()) return;
    if (openNextAsi()) return;
    finalizeClassDefine(withPendingSelections);
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

  const prevClassStateRef = useRef<{
    primaryLevel: number;
    secondaryLevel: number;
    primarySubclassId: string;
    secondarySubclassId: string;
  } | null>(null);
  useEffect(() => {
    const current = {
      primaryLevel: Number(classEntry?.niveau ?? 0),
      secondaryLevel: Number(secondaryClassEntry?.niveau ?? 0),
      primarySubclassId: selectedSubclassId ?? "",
      secondarySubclassId: selectedSecondarySubclassId ?? ""
    };
    const prev = prevClassStateRef.current;
    if (prev) {
      const primaryDropped = current.primaryLevel < prev.primaryLevel;
      const secondaryDropped = current.secondaryLevel < prev.secondaryLevel;
      const primarySubclassLost = Boolean(prev.primarySubclassId) && !current.primarySubclassId;
      const secondarySubclassLost = Boolean(prev.secondarySubclassId) && !current.secondarySubclassId;
      if (primaryDropped || secondaryDropped || primarySubclassLost || secondarySubclassLost) {
        resetStatsFromBase();
      }
    }
    prevClassStateRef.current = current;
  }, [
    classEntry?.niveau,
    secondaryClassEntry?.niveau,
    selectedSubclassId,
    selectedSecondarySubclassId
  ]);

  const computeMod = (score: number): number => Math.floor((score - 10) / 2);
  const computeProficiencyBonusForLevel = (level: number): number => {
    if (level <= 4) return 2;
    if (level <= 8) return 3;
    if (level <= 12) return 4;
    if (level <= 16) return 5;
    return 6;
  };
  const averageHitDie = (die: number | null | undefined) => {
    switch (die) {
      case 6:
        return 4;
      case 8:
        return 5;
      case 10:
        return 6;
      case 12:
        return 7;
      default:
        return 0;
    }
  };
  const computeArmorClassFromEquipment = () => {
    const dexMod = computeMod(getScore("DEX"));
    const base = 10 + dexMod;
    let armorBase = base;
    let shieldBonus = 0;
    const equippedArmor = inventoryItems.filter(
      item => item?.type === "armor" && item?.equippedSlot
    );
    for (const item of equippedArmor) {
      const def = armorItemMap.get(item.id);
      if (!def) continue;
      if ((def as any).armorCategory === "shield") {
        shieldBonus = Math.max(shieldBonus, Number((def as any).baseAC ?? 2) || 2);
        continue;
      }
      const baseAC = typeof (def as any).baseAC === "number" ? (def as any).baseAC : 10;
      const dexCap =
        (def as any).dexCap === null || typeof (def as any).dexCap === "undefined"
          ? dexMod
          : Math.max(0, Math.min(dexMod, Number((def as any).dexCap) || 0));
      armorBase = Math.max(armorBase, baseAC + dexCap);
    }
    return Math.max(1, armorBase + shieldBonus);
  };
  const computeMaxHp = () => {
    const conMod = computeMod(getScore("CON"));
    const primaryLevel = Number(classEntry?.niveau) || 0;
    const secondaryLevel = Number(secondaryClassEntry?.niveau) || 0;
    const primaryDie = classPrimary?.hitDie ?? null;
    const secondaryDie = classSecondary?.hitDie ?? null;
    if (!primaryLevel || !primaryDie) return Math.max(1, conMod + 1);
    let total = Math.max(1, primaryDie + conMod);
    if (primaryLevel > 1) {
      const avg = averageHitDie(primaryDie);
      const perLevel = Math.max(1, avg + conMod);
      total += perLevel * (primaryLevel - 1);
    }
    if (secondaryLevel > 0 && secondaryDie) {
      const avg = averageHitDie(secondaryDie);
      const perLevel = Math.max(1, avg + conMod);
      total += perLevel * secondaryLevel;
    }
    return Math.max(1, Math.floor(total));
  };
  const computePassivePerception = (proficiencyBonus: number) => {
    const wisMod = computeMod(getScore("SAG"));
    const skills = Array.isArray((props.character as any)?.competences)
      ? (((props.character as any).competences as string[]).map(id => String(id).toLowerCase()))
      : [];
    const expertises = Array.isArray((props.character as any)?.expertises)
      ? (((props.character as any).expertises as string[]).map(id => String(id).toLowerCase()))
      : [];
    const isProficient = skills.includes("perception");
    const isExpert = expertises.includes("perception");
    const profContribution = isExpert ? proficiencyBonus * 2 : isProficient ? proficiencyBonus : 0;
    return 10 + wisMod + profContribution;
  };
  const resolvePrimaryHitDie = () => {
    if (classPrimary?.hitDie) return Number(classPrimary.hitDie);
    const rawDv = Number((props.character as any)?.dv);
    if (Number.isFinite(rawDv) && rawDv > 0) return rawDv;
    return 6;
  };
  type SpellEntry =
    | string
    | {
        id: string;
        instanceId: string;
        origin?: { kind: string; id?: string; sourceKey?: string };
      };
  const spellcastingSelections = ((choiceSelections as any)?.spellcasting ?? {}) as Record<
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
  const updateSpellcastingSelection = (
    key: string,
    patch: Partial<{
      knownSpells: SpellEntry[];
      preparedSpells: SpellEntry[];
      grantedSpells: SpellEntry[];
      focusItemId: string | null;
      focusInstanceId: string | null;
      storage: "memory" | "innate" | "grimoire";
      grimoireItemId: string | null;
    }>
  ) => {
    const next = { ...spellcastingSelections, [key]: { ...(spellcastingSelections[key] ?? {}), ...patch } };
    props.onChangeCharacter({
      ...props.character,
      choiceSelections: { ...choiceSelections, spellcasting: next }
    });
  };
  const getCasterContribution = (progression: "full" | "half" | "third" | "none", level: number) => {
    if (progression === "full") return level;
    if (progression === "half") return Math.floor(level / 2);
    if (progression === "third") return Math.floor(level / 3);
    return 0;
  };
  const collectSpellGrants = (progression?: Record<string, any>, level?: number) => {
    if (!progression) return [];
    const max = Number(level) || 0;
    const ids: string[] = [];
    Object.keys(progression)
      .map(key => Number(key))
      .filter(lvl => Number.isFinite(lvl) && lvl > 0 && lvl <= max)
      .forEach(lvl => {
        const grants = progression[String(lvl)]?.grants ?? [];
        grants.forEach((grant: any) => {
          if (grant?.kind !== "spell") return;
          const list = Array.isArray(grant?.ids) ? grant.ids : [];
          list.forEach((id: string) => ids.push(id));
        });
      });
    return Array.from(new Set(ids));
  };
  const getSpellId = (entry: SpellEntry) => (typeof entry === "string" ? entry : entry.id);
  const makeSpellEntry = (id: string, origin?: { kind: string; id?: string; sourceKey?: string }) => ({
    id,
    instanceId: createInstanceId("spell"),
    origin
  });
  const buildSpellGrantsForClassSlot = (slot: 1 | 2) => {
    const grants: Record<string, SpellEntry[]> = {};
    const cls = slot === 1 ? classPrimary : classSecondary;
    const entry = slot === 1 ? classEntry : secondaryClassEntry;
    const subclassId = slot === 1 ? selectedSubclassId : selectedSecondarySubclassId;
    const subclass = subclassId
      ? subclassOptions.find(sub => sub.id === subclassId) ?? null
      : null;
    const classLevel = Number(entry?.niveau) || 0;
    if (cls?.spellcasting && cls.id) {
      const classSpells = collectSpellGrants(cls.progression, classLevel);
      const subclassSpells =
        subclass && !subclass.spellcasting
          ? collectSpellGrants(subclass.progression, classLevel)
          : [];
      const spellIds = Array.from(new Set([...classSpells, ...subclassSpells]));
      if (spellIds.length > 0) {
        const sourceKey = `class:${cls.id}`;
        grants[sourceKey] = spellIds.map(id =>
          makeSpellEntry(id, { kind: "class", id: cls.id, sourceKey })
        );
      }
    }
    if (subclass?.spellcasting && subclass.id) {
      const spellIds = collectSpellGrants(subclass.progression, classLevel);
      if (spellIds.length > 0) {
        const sourceKey = `subclass:${subclass.id}`;
        grants[sourceKey] = spellIds.map(id =>
          makeSpellEntry(id, { kind: "subclass", id: subclass.id, sourceKey })
        );
      }
    }
    return grants;
  };
  const getItemSources = (item: any) => {
    if (!item || isCurrencyItem(item)) return [];
    const origin = item.origin;
    if (!origin || !origin.kind) return [];
    if (origin.kind === "background") {
      const label = `Historique${origin.id ? `: ${origin.id}` : ""}`;
      return [{ key: "background", label }];
    }
    if (origin.kind === "class") {
      const label = `Classe${origin.id ? `: ${origin.id}` : ""}`;
      return [{ key: "classPrimary", label }];
    }
    if (origin.kind === "manual") {
      return [{ key: "equipment", label: "Ajoute manuellement" }];
    }
    return [];
  };
  const getItemTags = (item: any): string[] => {
    if (!item) return [];
    const tags = (item as any).tags;
    return Array.isArray(tags) ? tags.map(tag => String(tag)) : [];
  };
  const resolveItemTags = (itemId: string): string[] => {
    const resolved = resolveItemType(itemId);
    if (resolved.type === "weapon") {
      return getItemTags(weaponItemMap.get(resolved.id));
    }
    if (resolved.type === "armor") {
      return getItemTags(armorItemMap.get(resolved.id));
    }
    if (resolved.type === "tool") {
      return getItemTags(toolItemMap.get(resolved.id));
    }
    return getItemTags(objectItemMap.get(resolved.id));
  };
  const magicSources = (() => {
    const sources: Array<{
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
    }> = [];
    const primarySub = selectedSubclassId
      ? subclassOptions.find(sub => sub.id === selectedSubclassId) ?? null
      : null;
    const secondarySub = selectedSecondarySubclassId
      ? subclassOptions.find(sub => sub.id === selectedSecondarySubclassId) ?? null
      : null;
    if (classLocks.primary && classPrimary?.spellcasting) {
      const classLevel = Number(classEntry?.niveau) || 0;
      const classSpells = collectSpellGrants(classPrimary.progression, classLevel);
      const subclassSpells =
        primarySub && !primarySub.spellcasting
          ? collectSpellGrants(primarySub.progression, classLevel)
          : [];
      sources.push({
        key: `class:${classPrimary.id}`,
        label: classPrimary.label,
        ability: classPrimary.spellcasting.ability,
        preparation: classPrimary.spellcasting.preparation,
        storage: classPrimary.spellcasting.storage,
        focusTypes: classPrimary.spellcasting.focusTypes,
        spellFilterTags: classPrimary.spellcasting.spellFilterTags,
        freePreparedFromGrants: classPrimary.spellcasting.freePreparedFromGrants,
        casterProgression: classPrimary.spellcasting.casterProgression,
        slotsByLevel: classPrimary.spellcasting.slotsByLevel,
        classLevel,
        spellIds: Array.from(new Set([...classSpells, ...subclassSpells]))
      });
    }
    if (classLocks.primary && primarySub?.spellcasting) {
      sources.push({
        key: `subclass:${primarySub.id}`,
        label: `${classPrimary?.label ?? "Classe"} — ${primarySub.label}`,
        ability: primarySub.spellcasting.ability,
        preparation: primarySub.spellcasting.preparation,
        storage: primarySub.spellcasting.storage,
        focusTypes: primarySub.spellcasting.focusTypes,
        spellFilterTags: primarySub.spellcasting.spellFilterTags,
        freePreparedFromGrants: primarySub.spellcasting.freePreparedFromGrants,
        casterProgression: primarySub.spellcasting.casterProgression,
        slotsByLevel: primarySub.spellcasting.slotsByLevel,
        classLevel: Number(classEntry?.niveau) || 0,
        spellIds: collectSpellGrants(primarySub.progression, Number(classEntry?.niveau) || 0)
      });
    }
    if (classLocks.secondary && classSecondary?.spellcasting) {
      const classLevel = Number(secondaryClassEntry?.niveau) || 0;
      const classSpells = collectSpellGrants(classSecondary.progression, classLevel);
      const subclassSpells =
        secondarySub && !secondarySub.spellcasting
          ? collectSpellGrants(secondarySub.progression, classLevel)
          : [];
      sources.push({
        key: `class:${classSecondary.id}`,
        label: classSecondary.label,
        ability: classSecondary.spellcasting.ability,
        preparation: classSecondary.spellcasting.preparation,
        storage: classSecondary.spellcasting.storage,
        focusTypes: classSecondary.spellcasting.focusTypes,
        spellFilterTags: classSecondary.spellcasting.spellFilterTags,
        freePreparedFromGrants: classSecondary.spellcasting.freePreparedFromGrants,
        casterProgression: classSecondary.spellcasting.casterProgression,
        slotsByLevel: classSecondary.spellcasting.slotsByLevel,
        classLevel,
        spellIds: Array.from(new Set([...classSpells, ...subclassSpells]))
      });
    }
    if (classLocks.secondary && secondarySub?.spellcasting) {
      sources.push({
        key: `subclass:${secondarySub.id}`,
        label: `${classSecondary?.label ?? "Classe"} — ${secondarySub.label}`,
        ability: secondarySub.spellcasting.ability,
        preparation: secondarySub.spellcasting.preparation,
        storage: secondarySub.spellcasting.storage,
        focusTypes: secondarySub.spellcasting.focusTypes,
        spellFilterTags: secondarySub.spellcasting.spellFilterTags,
        freePreparedFromGrants: secondarySub.spellcasting.freePreparedFromGrants,
        casterProgression: secondarySub.spellcasting.casterProgression,
        slotsByLevel: secondarySub.spellcasting.slotsByLevel,
        classLevel: Number(secondaryClassEntry?.niveau) || 0,
        spellIds: collectSpellGrants(secondarySub.progression, Number(secondaryClassEntry?.niveau) || 0)
      });
    }
    return sources;
  })();
  const [activeMagicTab, setActiveMagicTab] = useState(0);
  useEffect(() => {
    if (activeMagicTab >= magicSources.length) {
      setActiveMagicTab(0);
    }
  }, [magicSources.length, activeMagicTab]);
  const canEditSkills = !isSectionLocked("skills") && skillsMode !== "normal";
  const canEditMasteries = !isSectionLocked("masteries") && masteriesMode !== "normal";

  const normalizeLanguages = (value: unknown) => {
    const rawList = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",").map(item => item.trim()).filter(Boolean)
        : [];
    const byId = new Map<string, string>();
    const byLabel = new Map<string, string>();
    languageOptions.forEach(lang => {
      if (!lang?.id) return;
      byId.set(String(lang.id).toLowerCase(), String(lang.id));
      byLabel.set(String(lang.label ?? "").toLowerCase(), String(lang.id));
    });
    const normalized: string[] = [];
    rawList.forEach(entry => {
      const key = String(entry ?? "").trim();
      if (!key) return;
      const lower = key.toLowerCase();
      const resolved = byId.get(lower) ?? byLabel.get(lower) ?? key;
      normalized.push(resolved);
    });
    return Array.from(new Set(normalized));
  };

  const collectProgressionGrantEntries = (
    progression: Record<string, any> | undefined,
    level: number,
    source: string
  ) => {
    if (!progression || level <= 0) return [];
    const entries: Array<{ source: string; level: number; kind: string; ids: string[] }> = [];
    Object.keys(progression)
      .map(key => Number(key))
      .filter(lvl => Number.isFinite(lvl) && lvl > 0 && lvl <= level)
      .sort((a, b) => a - b)
      .forEach(lvl => {
        const grants = Array.isArray(progression[String(lvl)]?.grants)
          ? progression[String(lvl)].grants
          : [];
        grants.forEach((grant: any) => {
          if (!grant?.kind) return;
          const ids = Array.isArray(grant.ids) ? grant.ids.filter(Boolean) : [];
          if (ids.length === 0) return;
          entries.push({ source, level: lvl, kind: String(grant.kind), ids });
        });
      });
    return entries;
  };

  const collectProgressionSources = () => {
    const globalLevel = resolveLevel();
    const primaryLevel = Number(classEntry?.niveau) || 0;
    const secondaryLevel = Number(secondaryClassEntry?.niveau) || 0;
    const sources: Array<{
      source: string;
      level: number;
      progression: Record<string, any> | undefined;
    }> = [];
    if (activeRace?.id) {
      sources.push({
        source: `race:${activeRace.id}`,
        level: globalLevel,
        progression: (activeRace as any)?.progression
      });
    }
    if (activeBackground?.id) {
      sources.push({
        source: `background:${activeBackground.id}`,
        level: globalLevel,
        progression: (activeBackground as any)?.progression
      });
    }
    if (classPrimary?.id) {
      sources.push({
        source: `class:${classPrimary.id}`,
        level: primaryLevel,
        progression: classPrimary.progression
      });
    }
    if (selectedSubclassId) {
      const sub = subclassOptions.find(item => item.id === selectedSubclassId) ?? null;
      if (sub?.id) {
        sources.push({
          source: `subclass:${sub.id}`,
          level: primaryLevel,
          progression: sub.progression
        });
      }
    }
    if (classSecondary?.id) {
      sources.push({
        source: `class:${classSecondary.id}`,
        level: secondaryLevel,
        progression: classSecondary.progression
      });
    }
    if (selectedSecondarySubclassId) {
      const sub = subclassOptions.find(item => item.id === selectedSecondarySubclassId) ?? null;
      if (sub?.id) {
        sources.push({
          source: `subclass:${sub.id}`,
          level: secondaryLevel,
          progression: sub.progression
        });
      }
    }
    return sources.filter(item => item.level > 0 && Boolean(item.progression));
  };

  const buildProgressionHistory = () => {
    const history: Array<{ source: string; level: number; type: string; payload: any }> = [];
    const raceId = (props.character as any)?.raceId ?? "";
    const backgroundId = (props.character as any)?.backgroundId ?? "";
    const adaptableSkill = (choiceSelections as any)?.race?.adaptableSkill;
    if (adaptableSkill) {
      history.push({
        source: `race:${raceId || "unknown"}`,
        level: 1,
        type: "choice",
        payload: { kind: "skill", id: adaptableSkill }
      });
    }
    const backgroundChoices = (choiceSelections as any)?.background ?? {};
    const backgroundTools = Array.isArray(backgroundChoices.tools) ? backgroundChoices.tools : [];
    const backgroundLanguages = Array.isArray(backgroundChoices.languages)
      ? backgroundChoices.languages
      : [];
    backgroundTools.forEach((toolId: string) => {
      history.push({
        source: `background:${backgroundId || "unknown"}`,
        level: 1,
        type: "choice",
        payload: { kind: "tool", id: toolId }
      });
    });
    backgroundLanguages.forEach((langId: string) => {
      history.push({
        source: `background:${backgroundId || "unknown"}`,
        level: 1,
        type: "choice",
        payload: { kind: "language", id: langId }
      });
    });
    const sourceLevels = new Map<string, number>();
    if (classPrimary?.id) {
      sourceLevels.set(`class:${classPrimary.id}`, Number(classEntry?.niveau ?? 0) || 0);
    }
    if (classSecondary?.id) {
      sourceLevels.set(`class:${classSecondary.id}`, Number(secondaryClassEntry?.niveau ?? 0) || 0);
    }
    if (selectedSubclassId) {
      sourceLevels.set(`subclass:${selectedSubclassId}`, Number(classEntry?.niveau ?? 0) || 0);
    }
    if (selectedSecondarySubclassId) {
      sourceLevels.set(
        `subclass:${selectedSecondarySubclassId}`,
        Number(secondaryClassEntry?.niveau ?? 0) || 0
      );
    }
    if (activeRace?.id) sourceLevels.set(`race:${activeRace.id}`, 1);
    if (activeBackground?.id) sourceLevels.set(`background:${activeBackground.id}`, 1);
    const featureUnlockBySourceAndId = new Map<string, number>();
    collectProgressionSources().forEach(item => {
      const grants = collectProgressionGrantEntries(item.progression, item.level, item.source);
      grants.forEach(grant => {
        if (String(grant.kind).toLowerCase() !== "feature") return;
        grant.ids.forEach(featureId => {
          const key = `${grant.source}|${String(featureId)}`;
          const previous = featureUnlockBySourceAndId.get(key);
          if (typeof previous === "number") {
            featureUnlockBySourceAndId.set(key, Math.min(previous, grant.level));
          } else {
            featureUnlockBySourceAndId.set(key, grant.level);
          }
        });
      });
    });
    const classFeatureChoiceSelections = ((choiceSelections as any)?.classFeatures ?? {}) as Record<
      string,
      { selected?: string[] }
    >;
    Object.entries(classFeatureChoiceSelections).forEach(([choiceId, entry]) => {
      const match = choiceId.match(/^(class|subclass):([^:]+):([^:]+):(.+)$/);
      if (!match) return;
      const source = `${match[1]}:${match[2]}`;
      const featureId = match[3];
      const choiceKey = match[4];
      const selected = Array.isArray(entry?.selected) ? entry.selected : [];
      const unlockLevel =
        featureUnlockBySourceAndId.get(`${source}|${featureId}`) ?? sourceLevels.get(source) ?? 0;
      selected.forEach(optionId => {
        history.push({
          source,
          level: unlockLevel,
          type: "choice",
          payload: {
            kind: "class-feature-option",
            featureId,
            choiceKey,
            optionId: String(optionId)
          }
        });
      });
    });
    Object.entries(asiSelections).forEach(([key, entry]) => {
      const match = key.match(/^(.+):(\d+)$/);
      const level = match ? Number(match[2]) : null;
      const classId = match ? match[1] : null;
      if (!level || !classId) return;
      history.push({
        source: `class:${classId}`,
        level,
        type: entry?.type === "feat" ? "feat" : "asi",
        payload: entry?.type === "asi" ? { stats: entry.stats ?? {} } : {}
      });
    });
    collectProgressionSources().forEach(item => {
      collectProgressionGrantEntries(item.progression, item.level, item.source).forEach(entry => {
        history.push({ source: entry.source, level: entry.level, type: "grant", payload: entry });
      });
    });
    return history;
  };

  const buildDerivedGrants = () => {
    const grants: Record<string, string[]> = {
      traits: [],
      features: [],
      feats: [],
      skills: [],
      weaponMasteries: [],
      tools: [],
      languages: [],
      spells: [],
      actions: [],
      reactions: [],
      resources: [],
      passifs: []
    };
    const resolveGrantKey = (rawKind: string) => {
      const kind = String(rawKind ?? "").trim().toLowerCase();
      if (!kind) return "";
      if (kind === "trait" || kind === "traits") return "traits";
      if (kind === "feature" || kind === "features") return "features";
      if (kind === "feat" || kind === "feats") return "feats";
      if (kind === "skill" || kind === "skills" || kind === "competence" || kind === "competences") return "skills";
      if (kind === "weaponmastery" || kind === "weapon-mastery" || kind === "weapon_mastery" || kind === "wm") return "weaponMasteries";
      if (kind === "tool" || kind === "tools") return "tools";
      if (kind === "language" || kind === "languages" || kind === "langue" || kind === "langues") return "languages";
      if (kind === "spell" || kind === "spells") return "spells";
      if (kind === "action" || kind === "actions") return "actions";
      if (kind === "reaction" || kind === "reactions") return "reactions";
      if (kind === "resource" || kind === "resources") return "resources";
      if (
        kind === "passif" ||
        kind === "passifs" ||
        kind === "passive" ||
        kind === "passives" ||
        kind === "status" ||
        kind === "statuses"
      ) return "passifs";
      return "";
    };
    const add = (kind: string, ids: string[]) => {
      if (!Array.isArray(ids) || ids.length === 0) return;
      const key = resolveGrantKey(kind);
      if (!key) return;
      const normalizedIds = ids.map(id => String(id)).filter(Boolean);
      if (normalizedIds.length === 0) return;
      grants[key] = Array.from(new Set([...(grants[key] ?? []), ...normalizedIds]));
    };
    const raceGrants = Array.isArray(activeRace?.grants) ? activeRace?.grants : [];
    raceGrants.forEach((grant: any) => add(String(grant?.kind ?? ""), grant?.ids ?? []));
    const backgroundGrants = Array.isArray(activeBackground?.grants) ? activeBackground?.grants : [];
    backgroundGrants.forEach((grant: any) => add(String(grant?.kind ?? ""), grant?.ids ?? []));
    const adaptableSkill = (choiceSelections as any)?.race?.adaptableSkill;
    if (adaptableSkill) add("skill", [String(adaptableSkill)]);
    const backgroundChoices = (choiceSelections as any)?.background ?? {};
    const backgroundTools = Array.isArray(backgroundChoices.tools) ? backgroundChoices.tools : [];
    const backgroundLanguages = Array.isArray(backgroundChoices.languages)
      ? backgroundChoices.languages
      : [];
    if (backgroundTools.length > 0) add("tool", backgroundTools.map(id => String(id)));
    if (backgroundLanguages.length > 0) add("language", backgroundLanguages.map(id => String(id)));
    const classFeatureChoicesById = new Map<string, ReturnType<typeof getClassFeatureChoicesForSlot>[number]>();
    getClassFeatureChoicesForSlot(1).forEach(choice => classFeatureChoicesById.set(choice.id, choice));
    getClassFeatureChoicesForSlot(2).forEach(choice => classFeatureChoicesById.set(choice.id, choice));
    Object.entries(classFeatureSelections).forEach(([choiceId, entry]) => {
      const choice = classFeatureChoicesById.get(choiceId);
      if (!choice) return;
      const selectedIds = Array.isArray(entry?.selected)
        ? entry.selected.map(id => String(id)).filter(Boolean)
        : [];
      selectedIds.forEach(optionId => {
        const option = choice.options.find(item => item.id === optionId);
        if (!option) return;
        option.grants.forEach(grant => add(grant.kind, grant.ids));
      });
    });
    collectProgressionSources().forEach(item => {
      collectProgressionGrantEntries(item.progression, item.level, item.source).forEach(entry =>
        add(entry.kind, entry.ids)
      );
    });
    return { grants };
  };

  const buildSpellcastingState = (
    derivedGrants?: { features?: string[] } | null
  ) => {
    const parseSourceFromKey = (sourceKey: string) => {
      const [kindRaw, ...rest] = String(sourceKey ?? "").split(":");
      const kind = String(kindRaw ?? "").trim().toLowerCase();
      const sourceId = rest.join(":") || undefined;
      const allowed = new Set([
        "class",
        "subclass",
        "race",
        "background",
        "feat",
        "feature",
        "item",
        "manual",
        "system"
      ]);
      const sourceType = (allowed.has(kind) ? kind : "manual") as SpellGrantSourceType;
      return { sourceType, sourceId };
    };
    const getDefaultSpellUsage = (spellId: string, preferSlot: boolean): SpellGrantUsage => {
      const level = Number((spellCatalog.byId.get(spellId) as any)?.level ?? 0);
      if (level <= 0) {
        return { type: "at-will", consumesSlot: false };
      }
      if (preferSlot) {
        return { type: "slot", consumesSlot: true };
      }
      return { type: "at-will", consumesSlot: false };
    };
    const resolveUsage = (spellId: string, rawMeta: unknown, preferSlot: boolean): SpellGrantUsage => {
      const meta = rawMeta as Record<string, unknown> | undefined;
      const usageMeta =
        meta && typeof meta === "object" && meta.usage && typeof meta.usage === "object"
          ? (meta.usage as Record<string, unknown>)
          : meta && typeof meta === "object"
            ? meta
            : null;
      if (!usageMeta) {
        return getDefaultSpellUsage(spellId, preferSlot);
      }
      const typeRaw = usageMeta.type;
      const type =
        typeof typeRaw === "string" && typeRaw.trim()
          ? typeRaw.trim()
          : getDefaultSpellUsage(spellId, preferSlot).type;
      const consumesSlot =
        typeof usageMeta.consumesSlot === "boolean"
          ? usageMeta.consumesSlot
          : type === "slot";
      const maxUses =
        typeof usageMeta.maxUses === "number" && Number.isFinite(usageMeta.maxUses)
          ? usageMeta.maxUses
          : undefined;
      const remainingUses =
        typeof usageMeta.remainingUses === "number" && Number.isFinite(usageMeta.remainingUses)
          ? usageMeta.remainingUses
          : maxUses;
      const resetOn = typeof usageMeta.resetOn === "string" ? usageMeta.resetOn : undefined;
      const fixedSlotLevel =
        typeof usageMeta.fixedSlotLevel === "number" && Number.isFinite(usageMeta.fixedSlotLevel)
          ? usageMeta.fixedSlotLevel
          : undefined;
      const poolId = typeof usageMeta.poolId === "string" ? usageMeta.poolId : undefined;
      return {
        type,
        consumesSlot,
        maxUses,
        remainingUses,
        resetOn,
        fixedSlotLevel,
        poolId
      };
    };

    const totalCasterLevel = magicSources.reduce(
      (sum, item) => sum + getCasterContribution(item.casterProgression, item.classLevel),
      0
    );
    const slotsTable = magicSources.find(item => item.slotsByLevel)?.slotsByLevel ?? null;
    const slotsRow = slotsTable ? slotsTable[String(Math.max(0, totalCasterLevel))] ?? [] : [];
    const maxSpellLevel = slotsRow.reduce(
      (max, count, idx) => (count > 0 ? idx + 1 : max),
      0
    );
    const slots: Record<string, { max: number; remaining: number; sources: string[] }> = {};
    slotsRow.forEach((count, idx) => {
      if (count > 0) {
        slots[String(idx + 1)] = { max: count, remaining: count, sources: ["caster-total"] };
      }
    });
    const sources: Record<string, any> = {};
    const spellGrantsBySource = new Map<string, Map<string, SpellGrantEntry>>();
    const slotJustifications: Array<any> = [];
    const upsertSpellGrant = (
      sourceKey: string,
      spellId: string,
      patch: {
        sourceType: SpellGrantSourceType;
        sourceId?: string;
        sourceInstanceId?: string;
        grantedAtLevel?: number;
        usage?: SpellGrantUsage;
        prepared?: boolean;
        alwaysPrepared?: boolean;
        countsAgainstPreparation?: boolean;
        tags?: string[];
      }
    ) => {
      if (!sourceKey || !spellId) return;
      const bySpell = spellGrantsBySource.get(sourceKey) ?? new Map<string, SpellGrantEntry>();
      const existing = bySpell.get(spellId);
      if (!existing) {
        bySpell.set(spellId, {
          entryId: `${sourceKey}:${spellId}`,
          spellId,
          sourceType: patch.sourceType,
          sourceId: patch.sourceId,
          sourceKey,
          sourceInstanceId: patch.sourceInstanceId,
          grantedAtLevel: patch.grantedAtLevel,
          usage: patch.usage,
          prepared: patch.prepared,
          alwaysPrepared: patch.alwaysPrepared,
          countsAgainstPreparation: patch.countsAgainstPreparation,
          tags: Array.from(new Set((patch.tags ?? []).map(value => String(value)).filter(Boolean)))
        });
        spellGrantsBySource.set(sourceKey, bySpell);
        return;
      }
      if (patch.sourceInstanceId && !existing.sourceInstanceId) existing.sourceInstanceId = patch.sourceInstanceId;
      if (typeof patch.grantedAtLevel === "number" && typeof existing.grantedAtLevel !== "number") {
        existing.grantedAtLevel = patch.grantedAtLevel;
      }
      if (patch.usage && !existing.usage) existing.usage = patch.usage;
      if (patch.prepared === true) existing.prepared = true;
      if (patch.alwaysPrepared === true) existing.alwaysPrepared = true;
      if (patch.countsAgainstPreparation === false) {
        existing.countsAgainstPreparation = false;
      } else if (
        patch.countsAgainstPreparation === true &&
        typeof existing.countsAgainstPreparation !== "boolean"
      ) {
        existing.countsAgainstPreparation = true;
      }
      if (Array.isArray(patch.tags) && patch.tags.length > 0) {
        existing.tags = Array.from(
          new Set([...(existing.tags ?? []), ...patch.tags.map(value => String(value))].filter(Boolean))
        );
      }
    };

    const addSpellEntriesFromSelection = (
      sourceKey: string,
      list: SpellEntry[],
      listType: "known" | "prepared" | "granted",
      fallback: {
        sourceType: SpellGrantSourceType;
        sourceId?: string;
        classLevel?: number;
        freePreparedFromGrants?: boolean;
        preferSlot?: boolean;
        sourceInstanceId?: string | null;
      }
    ) => {
      list.forEach(rawEntry => {
        const entryObject = typeof rawEntry === "string" ? null : rawEntry;
        const spellId = getSpellId(rawEntry);
        if (!spellId) return;
        const origin = (entryObject as any)?.origin as Record<string, unknown> | undefined;
        const originKind = typeof origin?.kind === "string" ? origin.kind : null;
        const originSourceKey = typeof origin?.sourceKey === "string" ? origin.sourceKey : null;
        const targetSourceKey = originSourceKey ?? sourceKey;
        const parsed = parseSourceFromKey(targetSourceKey);
        const sourceType = (originKind as SpellGrantSourceType) ?? parsed.sourceType ?? fallback.sourceType;
        const sourceId =
          (typeof origin?.id === "string" ? origin.id : undefined) ??
          parsed.sourceId ??
          fallback.sourceId;
        const sourceInstanceId =
          (typeof (origin as any)?.sourceInstanceId === "string"
            ? ((origin as any).sourceInstanceId as string)
            : undefined) ??
          (typeof fallback.sourceInstanceId === "string" ? fallback.sourceInstanceId : undefined);
        const preferSlot = fallback.preferSlot ?? true;
        const usage = resolveUsage(
          spellId,
          (entryObject as any)?.usage ?? origin?.usage,
          preferSlot
        );
        const alwaysPrepared = listType === "granted" && Boolean(fallback.freePreparedFromGrants);
        const prepared = listType === "prepared" || alwaysPrepared;
        const countsAgainstPreparation =
          listType === "prepared" ? true : alwaysPrepared ? false : undefined;
        upsertSpellGrant(targetSourceKey, spellId, {
          sourceType,
          sourceId,
          sourceInstanceId,
          grantedAtLevel: fallback.classLevel,
          usage,
          prepared,
          alwaysPrepared,
          countsAgainstPreparation,
          tags: [listType]
        });
      });
    };

    magicSources.forEach(source => {
      const selection = spellcastingSelections[source.key] ?? {};
      const knownSpellsRaw = Array.isArray(selection.knownSpells) ? selection.knownSpells : [];
      const preparedSpellsRaw = Array.isArray(selection.preparedSpells)
        ? selection.preparedSpells
        : [];
      const grantedSpells = Array.isArray(selection.grantedSpells) ? selection.grantedSpells : [];
      const filterByMaxLevel = (entry: SpellEntry) => {
        const id = getSpellId(entry);
        const def = spellCatalog.byId.get(id);
        if (!def || typeof def.level !== "number") return true;
        if (def.level === 0) return true;
        return def.level <= maxSpellLevel;
      };
      const knownSpells = knownSpellsRaw.filter(filterByMaxLevel);
      const preparedSpells = preparedSpellsRaw.filter(filterByMaxLevel);
      const resolvedFocusInstanceId =
        selection.focusInstanceId ??
        (selection.focusItemId
          ? inventoryItems.find(item => item?.id === selection.focusItemId)?.instanceId ?? null
          : null);
      sources[source.key] = {
        ability: source.ability,
        preparation: source.preparation,
        storage: source.storage,
        casterProgression: source.casterProgression,
        classLevel: source.classLevel,
        focusInstanceId: resolvedFocusInstanceId ?? null,
        preparedSpellIds: preparedSpells.map(entry => getSpellId(entry)),
        knownSpellIds: knownSpells.map(entry => getSpellId(entry)),
        grantedSpellIds: grantedSpells.map(entry => getSpellId(entry))
      };
      const parsedSource = parseSourceFromKey(source.key);
      addSpellEntriesFromSelection(source.key, knownSpells, "known", {
        sourceType: parsedSource.sourceType,
        sourceId: parsedSource.sourceId,
        classLevel: source.classLevel,
        freePreparedFromGrants: source.freePreparedFromGrants,
        preferSlot: true,
        sourceInstanceId: resolvedFocusInstanceId
      });
      addSpellEntriesFromSelection(source.key, preparedSpells, "prepared", {
        sourceType: parsedSource.sourceType,
        sourceId: parsedSource.sourceId,
        classLevel: source.classLevel,
        freePreparedFromGrants: source.freePreparedFromGrants,
        preferSlot: true,
        sourceInstanceId: resolvedFocusInstanceId
      });
      addSpellEntriesFromSelection(source.key, grantedSpells, "granted", {
        sourceType: parsedSource.sourceType,
        sourceId: parsedSource.sourceId,
        classLevel: source.classLevel,
        freePreparedFromGrants: source.freePreparedFromGrants,
        preferSlot: true,
        sourceInstanceId: resolvedFocusInstanceId
      });
      if (source.slotsByLevel) {
        const row = source.slotsByLevel[String(Math.max(0, totalCasterLevel))] ?? [];
        slotJustifications.push({
          source: source.key,
          classLevel: source.classLevel,
          casterProgression: source.casterProgression,
          slotsByLevel: row
        });
      }
    });

    Object.entries(spellcastingSelections).forEach(([sourceKey, selection]) => {
      if (sources[sourceKey]) return;
      const knownSpells = Array.isArray(selection?.knownSpells) ? selection.knownSpells : [];
      const preparedSpells = Array.isArray(selection?.preparedSpells)
        ? selection.preparedSpells
        : [];
      const grantedSpells = Array.isArray(selection?.grantedSpells) ? selection.grantedSpells : [];
      if (knownSpells.length + preparedSpells.length + grantedSpells.length === 0) return;
      const parsedSource = parseSourceFromKey(sourceKey);
      addSpellEntriesFromSelection(sourceKey, knownSpells, "known", {
        sourceType: parsedSource.sourceType,
        sourceId: parsedSource.sourceId,
        preferSlot: parsedSource.sourceType !== "item"
      });
      addSpellEntriesFromSelection(sourceKey, preparedSpells, "prepared", {
        sourceType: parsedSource.sourceType,
        sourceId: parsedSource.sourceId,
        preferSlot: parsedSource.sourceType !== "item"
      });
      addSpellEntriesFromSelection(sourceKey, grantedSpells, "granted", {
        sourceType: parsedSource.sourceType,
        sourceId: parsedSource.sourceId,
        preferSlot: parsedSource.sourceType !== "item"
      });
    });

    const getInventoryDefinitionGrants = (item: any) => {
      if (!item) return [];
      const type = String(item.type ?? "").toLowerCase();
      const id = String(item.id ?? "");
      if (!id) return [];
      if (type === "object") {
        return Array.isArray(objectItemMap.get(id)?.grants) ? objectItemMap.get(id)?.grants ?? [] : [];
      }
      if (type === "armor") {
        return Array.isArray(armorItemMap.get(id)?.grants) ? armorItemMap.get(id)?.grants ?? [] : [];
      }
      if (type === "tool") {
        return Array.isArray(toolItemMap.get(id)?.grants) ? toolItemMap.get(id)?.grants ?? [] : [];
      }
      if (type === "weapon") {
        return Array.isArray(weaponItemMap.get(id)?.grants) ? weaponItemMap.get(id)?.grants ?? [] : [];
      }
      return [];
    };
    inventoryItems.forEach(item => {
      if (!item?.id) return;
      if (!item?.equippedSlot) return;
      const grants = getInventoryDefinitionGrants(item);
      if (grants.length === 0) return;
      const sourceKey = `item:${item.instanceId ?? item.id}`;
      grants.forEach((grant: any) => {
        if (String(grant?.kind ?? "") !== "spell") return;
        const ids = Array.isArray(grant?.ids) ? grant.ids.map((id: unknown) => String(id)).filter(Boolean) : [];
        ids.forEach(spellId => {
          upsertSpellGrant(sourceKey, spellId, {
            sourceType: "item",
            sourceId: String(item.id),
            sourceInstanceId: typeof item.instanceId === "string" ? item.instanceId : undefined,
            usage: resolveUsage(spellId, (grant as any)?.meta, false),
            tags: ["granted", "item"]
          });
        });
      });
    });

    const activeFeatureIds = Array.isArray(derivedGrants?.features)
      ? derivedGrants?.features?.map(id => String(id)).filter(Boolean)
      : [];
    activeFeatureIds.forEach(featureId => {
      const feature = featureById.get(featureId);
      const grants = Array.isArray((feature as any)?.grants) ? (feature as any).grants : [];
      grants.forEach((grant: any) => {
        if (String(grant?.kind ?? "") !== "spell") return;
        const ids = Array.isArray(grant?.ids) ? grant.ids.map((id: unknown) => String(id)).filter(Boolean) : [];
        ids.forEach(spellId => {
          upsertSpellGrant(`feature:${featureId}`, spellId, {
            sourceType: "feature",
            sourceId: featureId,
            usage: resolveUsage(spellId, (grant as any)?.meta, true),
            tags: ["granted", "feature"]
          });
        });
      });
    });

    const spellGrants: Record<string, SpellGrantEntry[]> = {};
    spellGrantsBySource.forEach((entryMap, sourceKey) => {
      const list = Array.from(entryMap.values());
      if (list.length > 0) spellGrants[sourceKey] = list;
    });

    return {
      totalCasterLevel,
      slots,
      sources,
      spellGrants,
      slotJustifications
    };
  };

  const buildInventorySnapshot = () => {
    const items = inventoryItems.map(item => ({
      ...item,
      instanceId:
        typeof item?.instanceId === "string" && item.instanceId.length > 0
          ? item.instanceId
          : createInstanceId("item")
    }));
    const containerIds = new Set<string>();
    items.forEach(item => {
      const def = objectItemMap.get(item?.id);
      const tags = Array.isArray(def?.tags) ? def?.tags.map(tag => String(tag)) : [];
      if (item?.instanceId && tags.includes("sac")) {
        item.contenu = [];
        containerIds.add(item.instanceId);
      }
    });
    const getContainerInstanceIdForSlot = (slotId: string) => {
      const bag = items.find(entry => entry?.equippedSlot === slotId && entry?.instanceId);
      if (bag?.instanceId && containerIds.has(bag.instanceId)) return bag.instanceId;
      return null;
    };
    items.forEach(item => {
      const storedIn = item?.storedIn;
      if (!storedIn || !item?.instanceId) return;
      let containerId: string | null = null;
      if (containerIds.has(storedIn)) {
        containerId = storedIn;
      } else if (packSlots.has(storedIn)) {
        containerId = getContainerInstanceIdForSlot(storedIn);
      }
      if (!containerId) return;
      const container = items.find(entry => entry?.instanceId === containerId);
      if (!container) return;
      if (!Array.isArray(container.contenu)) container.contenu = [];
      container.contenu = Array.from(new Set([...container.contenu, item.instanceId]));
    });
    return items;
  };

  const buildCharacterSave = (): Personnage => {
    const normalizedLanguages = normalizeLanguages((props.character as any)?.langues);
    const derived = buildDerivedGrants();
    const spellcastingState = buildSpellcastingState((derived as any)?.grants);
    const resolvedLevel = Math.max(1, Math.min(20, Math.floor(resolveLevel() || 1)));
    const proficiencyBonus = computeProficiencyBonusForLevel(resolvedLevel);
    const computedMaxHp = computeMaxHp();
    const computedArmorClass = computeArmorClassFromEquipment();
    const mods = {
      modFOR: computeMod(getScore("FOR")),
      modDEX: computeMod(getScore("DEX")),
      modCON: computeMod(getScore("CON")),
      modINT: computeMod(getScore("INT")),
      modSAG: computeMod(getScore("SAG")),
      modCHA: computeMod(getScore("CHA"))
    };
    const computedAttackBonus = mods.modFOR + proficiencyBonus;
    const computedPassivePerception = computePassivePerception(proficiencyBonus);
    const progressionHistory = buildProgressionHistory();
    if (spellcastingState.slotJustifications?.length) {
      progressionHistory.push({
        source: "spellcasting",
        level: resolveLevel(),
        type: "spell-slots",
        payload: {
          totalCasterLevel: spellcastingState.totalCasterLevel,
          slots: spellcastingState.slots,
          slotJustifications: spellcastingState.slotJustifications
        }
      });
    }
    const inventorySnapshot = buildInventorySnapshot();
    const rawCombatStats = (props.character as any)?.combatStats ?? null;
    const normalizedCombatStats = {
      ...(rawCombatStats ?? {}),
      level: resolvedLevel,
      mods,
      maxHp: Math.max(1, Math.floor(computedMaxHp)),
      armorClass: Math.max(1, Math.floor(computedArmorClass)),
      attackBonus: computedAttackBonus,
      maxAttacksPerTurn: Math.max(1, Number(rawCombatStats?.maxAttacksPerTurn ?? 1) || 1),
      actionsPerTurn: Math.max(1, Number(rawCombatStats?.actionsPerTurn ?? 1) || 1),
      bonusActionsPerTurn: Math.max(1, Number(rawCombatStats?.bonusActionsPerTurn ?? 1) || 1),
      actionRules: rawCombatStats?.actionRules ?? { forbidSecondAttack: true },
      resources:
        rawCombatStats?.resources && typeof rawCombatStats.resources === "object"
          ? rawCombatStats.resources
          : {}
    };
    const raceVisionMode = String(activeRace?.vision?.mode ?? "").toLowerCase();
    const raceLightVision: "normal" | "lowlight" | "darkvision" =
      raceVisionMode === "darkvision"
        ? "darkvision"
        : raceVisionMode === "lowlight"
          ? "lowlight"
          : "normal";
    const currentVision = ((props.character as any)?.visionProfile ?? {}) as Record<string, any>;
    const normalizedVisionProfile = {
      shape: currentVision.shape ?? "cone",
      range:
        typeof currentVision.range === "number"
          ? currentVision.range
          : Number(activeRace?.vision?.range ?? 100) || 100,
      apertureDeg: currentVision.apertureDeg ?? 180,
      lightVision:
        raceLightVision === "darkvision"
          ? "darkvision"
          : (currentVision.lightVision ?? raceLightVision ?? "normal")
    };
    const currentMovementModes = ((props.character as any)?.movementModes ?? {}) as Record<string, any>;
    const normalizedMovementModes = {
      ...currentMovementModes,
      walk:
        typeof activeRace?.speed === "number"
          ? activeRace.speed
          : Number(currentMovementModes.walk ?? 6) || 6
    };
    const rawCurrentHp = Number((props.character as any)?.pvActuels);
    const normalizedCurrentHp = Number.isFinite(rawCurrentHp)
      ? Math.max(0, Math.min(rawCurrentHp, normalizedCombatStats.maxHp))
      : normalizedCombatStats.maxHp;
    return {
      id: props.character.id,
      nom: props.character.nom,
      age: (props.character as any)?.age,
      sexe: (props.character as any)?.sexe,
      taille: (props.character as any)?.taille,
      poids: (props.character as any)?.poids,
      langues: normalizedLanguages,
      alignement: (props.character as any)?.alignement,
      raceId: (props.character as any)?.raceId,
      backgroundId: (props.character as any)?.backgroundId,
      classe: (props.character as any)?.classe ?? {},
      niveauGlobal: resolvedLevel,
      xp: (props.character as any)?.xp ?? 0,
      dv: resolvePrimaryHitDie(),
      maitriseBonus: proficiencyBonus,
      pvActuels: normalizedCurrentHp,
      pvTmp: (props.character as any)?.pvTmp,
      nivFatigueActuel: (props.character as any)?.nivFatigueActuel,
      nivFatigueMax: (props.character as any)?.nivFatigueMax,
      actionIds: (props.character as any)?.actionIds ?? [],
      reactionIds: (props.character as any)?.reactionIds ?? [],
      combatStats: normalizedCombatStats,
      caracs: props.character.caracs,
      movementModes: normalizedMovementModes,
      visionProfile: normalizedVisionProfile,
      appearance: (props.character as any)?.appearance,
      competences: (props.character as any)?.competences ?? [],
      expertises: (props.character as any)?.expertises ?? [],
      initiative: (props.character as any)?.initiative,
      besoin: (props.character as any)?.besoin ?? [],
      percPassive: computedPassivePerception,
      proficiencies: (props.character as any)?.proficiencies ?? {},
      weaponMasteries:
        (props.character as any)?.weaponMasteries ??
        ((derived as any)?.grants?.weaponMasteries ?? []),
      savingThrows: (props.character as any)?.savingThrows ?? [],
      inspiration: (props.character as any)?.inspiration ?? false,
      notes: (props.character as any)?.notes ?? "",
      argent: (props.character as any)?.argent ?? {},
      materielSlots: (props.character as any)?.materielSlots ?? {},
      inventoryItems: inventorySnapshot,
      descriptionPersonnage: (props.character as any)?.descriptionPersonnage,
      profileDetails: (props.character as any)?.profileDetails,
      choiceSelections: (props.character as any)?.choiceSelections ?? {},
      creationLocks: (props.character as any)?.creationLocks ?? {},
      classLocks: (props.character as any)?.classLocks ?? {},
      progressionHistory,
      spellcastingState,
      derived
    } as Personnage;
  };

  const SAVED_SHEETS_KEY = "jdr5e_saved_sheets";
  const ACTIVE_SHEET_KEY = "jdr5e_active_sheet";
  type SavedSheet = {
    id: string;
    name: string;
    updatedAt: string;
    character: Personnage;
  };
  const [savedSheets, setSavedSheets] = useState<SavedSheet[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(SAVED_SHEETS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SavedSheet[]) : [];
    } catch {
      return [];
    }
  });
  const [activeSheetId, setActiveSheetId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(ACTIVE_SHEET_KEY) ?? "";
  });
  const [sheetNameInput, setSheetNameInput] = useState("");

  const persistSheets = (next: SavedSheet[]) => {
    setSavedSheets(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SAVED_SHEETS_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };
  const persistActiveSheetId = (id: string) => {
    setActiveSheetId(id);
    if (typeof window === "undefined") return;
    try {
      if (!id) {
        window.localStorage.removeItem(ACTIVE_SHEET_KEY);
      } else {
        window.localStorage.setItem(ACTIVE_SHEET_KEY, id);
      }
    } catch {
      // ignore storage errors
    }
  };
  const saveCurrentSheet = () => {
    const nameRaw = sheetNameInput.trim();
    const name =
      nameRaw ||
      `Fiche ${new Date().toLocaleString("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })}`;
    const entry: SavedSheet = {
      id: createInstanceId("sheet"),
      name,
      updatedAt: new Date().toISOString(),
      character: JSON.parse(JSON.stringify(buildCharacterSave()))
    };
    const next = [entry, ...savedSheets];
    persistSheets(next);
    setSheetNameInput("");
    persistActiveSheetId(entry.id);
  };
  const deleteSheet = (id: string) => {
    const next = savedSheets.filter(sheet => sheet.id !== id);
    persistSheets(next);
    if (activeSheetId === id) {
      persistActiveSheetId("");
    }
  };
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
  const getAsiKeysForClassLevel = (classId: string, level: number) => {
    const cls = classOptions.find(item => item.id === classId);
    if (!cls || !cls.progression) return [];
    return Object.keys(cls.progression)
      .map(key => Number(key))
      .filter(lvl => Number.isFinite(lvl) && lvl > 0 && lvl <= level)
      .filter(lvl => {
        const grants = cls.progression?.[String(lvl)]?.grants ?? [];
        return grants.some(
          (grant: any) => grant?.kind === "bonus" && (grant?.ids ?? []).includes("asi-or-feat")
        );
      })
      .map(lvl => `${classId}:${lvl}`);
  };
  const getSubclassThresholdForClassId = (classId?: string | null) => {
    if (!classId) return null;
    const cls = classOptions.find(item => item.id === classId);
    if (!cls) return null;
    return typeof cls.subclassLevel === "number" ? cls.subclassLevel : 1;
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
  const setAsiModalStep = (step: "type" | "feat" | "asi") => {
    setAsiModal(prev => ({ ...prev, step }));
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
    const slot = asiModal.entry.classId === classPrimary?.id ? 1 : 2;
    if (asiModal.type === "feat") {
      const nextEntry = { type: "feat" as const };
      const overrides = { [asiModal.entry.key]: nextEntry };
      let otherMissing: ReturnType<typeof getMissingAsiEntries> = [];
      const nextAsi = { ...asiSelections, [asiModal.entry.key]: nextEntry };
      const nextChoiceSelections = { ...choiceSelections, asi: nextAsi };
      if (pendingLocks.classes) {
        otherMissing = getMissingAsiEntries(overrides).filter(
          entry => entry.classId === asiModal.entry?.classId && entry.key !== asiModal.entry?.key
        );
        if (
          !hasSubclassChoicePending(slot) &&
          !hasMissingClassFeatureChoiceForSlot(slot) &&
          otherMissing.length === 0
        ) {
          const nextPending = { ...pendingLocks };
          delete nextPending.classes;
          delete nextPending.classesSlot;
          const nextCharacter = buildClassLockCharacter(
            slot,
            nextChoiceSelections,
            nextPending
          );
          props.onChangeCharacter(nextCharacter);
        } else {
          props.onChangeCharacter({
            ...props.character,
            choiceSelections: nextChoiceSelections
          });
        }
      } else {
        props.onChangeCharacter({
          ...props.character,
          choiceSelections: nextChoiceSelections
        });
      }
      setAsiModal(prev => ({ ...prev, step: "feat" }));
      if (pendingLocks.classes) {
        if (otherMissing.length > 0) {
          setTimeout(() => openAsiModal(otherMissing[0]), 0);
        } else if (hasMissingClassFeatureChoiceForSlot(slot)) {
          setTimeout(() => startClassDefine(slot), 0);
        }
      }
      return;
    }
    setAsiModal(prev => ({ ...prev, step: "asi" }));
  };
  const confirmAsiModalStats = () => {
    if (!asiModal.entry) return;
    const slot = asiModal.entry.classId === classPrimary?.id ? 1 : 2;
    const nextEntry = { type: "asi" as const, stats: { ...asiModal.stats } };
    const overrides = { [asiModal.entry.key]: nextEntry };
    const nextAsi = { ...asiSelections, [asiModal.entry.key]: nextEntry };
    const nextChoiceSelections = { ...choiceSelections, asi: nextAsi };
    if (pendingLocks.classes) {
      const otherMissing = getMissingAsiEntries(overrides).filter(
        entry => entry.classId === asiModal.entry?.classId && entry.key !== asiModal.entry?.key
      );
      if (
        isAsiEntryComplete(nextEntry, asiModal.entry.key, overrides) &&
        !hasSubclassChoicePending(slot) &&
        !hasMissingClassFeatureChoiceForSlot(slot) &&
        otherMissing.length === 0
      ) {
        const nextPending = { ...pendingLocks };
        delete nextPending.classes;
        delete nextPending.classesSlot;
        const nextCharacter = buildClassLockCharacter(
          slot,
          nextChoiceSelections,
          nextPending
        );
        props.onChangeCharacter(nextCharacter);
      } else {
        props.onChangeCharacter({
          ...props.character,
          choiceSelections: nextChoiceSelections
        });
      }
    } else {
      props.onChangeCharacter({
        ...props.character,
        choiceSelections: nextChoiceSelections
      });
    }
    closeAsiModal();
    if (pendingLocks.classes) {
      const remaining = getMissingAsiEntries(overrides).filter(
        entry => entry.classId === asiModal.entry?.classId && entry.key !== asiModal.entry?.key
      );
      if (remaining.length > 0) {
        setTimeout(() => openAsiModal(remaining[0]), 0);
      } else if (hasMissingClassFeatureChoiceForSlot(slot)) {
        setTimeout(() => startClassDefine(slot), 0);
      }
    }
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
  const canLockStats = () => {
    if (statsMode !== "normal") return true;
    const summary = getPointBuySummary();
    return !summary.invalid && summary.remaining === 0;
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
        <div
          style={{
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(10,10,16,0.7)",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800 }}>Fiches sauvegardees</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Nom de la fiche"
              value={sheetNameInput}
              onChange={e => setSheetNameInput(e.target.value)}
              style={{
                flex: "1 1 220px",
                background: "#0f0f19",
                color: "#f5f5f5",
                border: "1px solid #333",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12
              }}
            />
            <button
              type="button"
              onClick={saveCurrentSheet}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(46, 204, 113, 0.16)",
                color: "#f5f5f5",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700
              }}
            >
              Sauvegarder
            </button>
            {activeSheetId && (
              <button
                type="button"
                onClick={() => persistActiveSheetId("")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(231, 76, 60, 0.18)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Desactiver
              </button>
            )}
          </div>
          {savedSheets.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              Aucune fiche sauvegardee.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {savedSheets.map(sheet => (
                <div
                  key={sheet.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background:
                      sheet.id === activeSheetId ? "rgba(79,125,242,0.18)" : "rgba(12,12,18,0.6)"
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {sheet.name}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
                      {new Date(sheet.updatedAt).toLocaleString("fr-FR")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => persistActiveSheetId(sheet.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background:
                          sheet.id === activeSheetId
                            ? "rgba(46, 204, 113, 0.18)"
                            : "rgba(255,255,255,0.08)",
                        color: "#f5f5f5",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 700
                      }}
                    >
                      {sheet.id === activeSheetId ? "Active" : "Activer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSheet(sheet.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.08)",
                        color: "#f5f5f5",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 700
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
              ...(magicSources.length > 0 ? [{ id: "magic", label: "Magie" }] : []),
              { id: "equip", label: "Equipement" },
              { id: "skills", label: "Competences" },
              { id: "masteries", label: "Maitrises" },
              { id: "sheet", label: "Fiche complete" }
            ].map(tab => {
              const isActive = activePlayerTab === tab.id;
              const tabAccent = tabAccentColors[tab.id] ?? "#6fd3a8";
              const borderColor = toRgba(tabAccent, isActive ? 0.9 : 0.55);
              const lockedBackground = isSectionLocked(tab.id)
                ? toRgba(tabAccent, isActive ? 0.22 : 0.12)
                : null;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePlayerTab(tab.id as typeof activePlayerTab)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${borderColor}`,
                    background: lockedBackground ?? (isActive ? toRgba(tabAccent, 0.18) : "#0f0f19"),
                    color: isActive ? "#f0f7ff" : "#c9cfdd",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    minWidth: 120,
                    justifyContent: "center",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  {tab.label}
                  {isSectionLocked(tab.id) && (
                    <span style={{ display: "inline-flex" }}>
                      <LockIcon color={tabAccent} />
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
            <EquipmentTab
              toggleSectionLock={toggleSectionLock}
              getLockButtonState={getLockButtonState}
              renderPendingBadge={renderPendingBadge}
              getPendingCountForSection={getPendingCountForSection}
              lockButtonBaseStyle={lockButtonBaseStyle}
              equipSubTab={equipSubTab}
              setEquipSubTab={setEquipSubTab}
              equipMessage={equipMessage}
              setEquipMessage={setEquipMessage}
              slotGroups={slotGroups}
              renderSlotGroup={renderSlotGroup}
              packSlotStatus={packSlotStatus}
              inventoryItems={inventoryItems}
              getItemLabel={getItemLabel}
              getItemCategories={getItemCategories}
              canUseClothingPieces={canUseClothingPieces}
              equipmentSlots={EQUIPMENT_SLOTS}
              resolveStoredSlotId={resolveStoredSlotId}
              packSlots={packSlots}
              getSlotLabel={getSlotLabel}
              getItemWeight={getItemWeight}
              storeItemInPack={storeItemInPack}
              updateItemSlot={updateItemSlot}
              isSectionLocked={isSectionLocked}
              getItemUnitValue={getItemUnitValue}
              isCurrencyItem={isCurrencyItem}
              moneyToCopper={moneyToCopper}
              formatMoneyValue={formatMoneyValue}
              onSellRequest={handleSellRequest}
              setPrimaryWeapon={setPrimaryWeapon}
              setSecondaryHand={setSecondaryHand}
              isItemHarmonisable={isItemHarmonisable}
              isItemHarmonized={isInventoryItemHarmonized}
              toggleItemHarmonization={toggleItemHarmonization}
              removeManualItem={removeManualItem}
              renderSourceDotsWithLabels={renderSourceDotsWithLabels}
              getItemSources={getItemSources}
              carryWeight={carryWeight}
              carryCapacityMax={carryCapacityMax}
              weaponOptions={weaponOptions}
              toolItems={toolItems}
              armorItems={armorItems}
              objectItems={objectItems}
              addManualItem={addManualItem}
            />
          )}

          {activeMainTab === "player" && activePlayerTab === "stats" && (
            <StatsTab
              statsMode={statsMode}
              setStatsMode={setStatsMode}
              canLockStats={canLockStats}
              toggleSectionLock={toggleSectionLock}
              resetStats={resetStats}
              isSectionLocked={isSectionLocked}
              lockButtonBaseStyle={lockButtonBaseStyle}
              getLockButtonState={getLockButtonState}
              renderPendingBadge={renderPendingBadge}
              getPendingCountForSection={getPendingCountForSection}
              getPointBuySummary={getPointBuySummary}
              statKeys={STAT_KEYS}
              getBaseScore={getBaseScore}
              getBonusSumForStat={getBonusSumForStat}
              computeMod={computeMod}
              getStatSources={getStatSources}
              renderSourceDots={renderSourceDots}
              setScore={setScore}
              canAdjustPointBuy={canAdjustPointBuy}
            />
          )}

          {activeMainTab === "player" && activePlayerTab === "skills" && (
            <SkillsTab
              skillsMode={skillsMode}
              setSkillsMode={setSkillsMode}
              resetSkills={resetSkills}
              isSectionLocked={isSectionLocked}
              toggleSectionLock={toggleSectionLock}
              lockButtonBaseStyle={lockButtonBaseStyle}
              getLockButtonState={getLockButtonState}
              renderPendingBadge={renderPendingBadge}
              getPendingCountForSection={getPendingCountForSection}
              competenceOptions={competenceOptions}
              expertises={expertises}
              competences={competences}
              resolveLevel={resolveLevel}
              computeMod={computeMod}
              getScore={getScore}
              skillAbilityMap={skillAbilityMap}
              renderSourceDots={renderSourceDots}
              getSkillSources={getSkillSources}
              canEditSkills={canEditSkills}
              toggleCompetence={toggleCompetence}
              toggleExpertise={toggleExpertise}
            />
          )}

          {activeMainTab === "player" && activePlayerTab === "masteries" && (
            <MasteriesTab
              masteriesMode={masteriesMode}
              setMasteriesMode={setMasteriesMode}
              resetMasteries={resetMasteries}
              isSectionLocked={isSectionLocked}
              toggleSectionLock={toggleSectionLock}
              lockButtonBaseStyle={lockButtonBaseStyle}
              getLockButtonState={getLockButtonState}
              renderPendingBadge={renderPendingBadge}
              getPendingCountForSection={getPendingCountForSection}
              weaponProficiencyOptions={WEAPON_PROFICIENCY_OPTIONS}
              unlockedWeaponMasteries={unlockedWeaponMasteries}
              unlockedFightingStyles={selectedCombatStyles}
              armorMasteryOptions={armorMasteryOptions}
              toolMasteryOptions={toolMasteryOptions}
              weaponMasteries={weaponProficiencies}
              armorMasteries={armorMasteries}
              toolMasteries={toolMasteries}
              toggleWeaponMastery={value => canEditMasteries && toggleMastery("weapons", value)}
              toggleArmorMastery={value => canEditMasteries && toggleMastery("armors", value)}
              toggleToolMastery={value => canEditMasteries && toggleMastery("tools", value)}
              canEditMasteries={canEditMasteries}
              renderSourceDots={renderSourceDots}
              getMasterySources={getMasterySources}
            />
          )}

          {activeMainTab === "player" && activePlayerTab === "species" && (
            <SpeciesTab
              isSectionLocked={isSectionLocked}
              lockButtonBaseStyle={lockButtonBaseStyle}
              getLockButtonState={getLockButtonState}
              renderPendingBadge={renderPendingBadge}
              getPendingCountForSection={getPendingCountForSection}
              onLockClick={() => {
                if (isSectionLocked("species")) {
                  resetSpeciesImpacts();
                  return;
                }
                if (hasPendingRaceChoices()) {
                  props.onChangeCharacter({
                    ...props.character,
                    choiceSelections: {
                      ...choiceSelections,
                      pendingLocks: { ...pendingLocks, species: true }
                    }
                  });
                  requireRaceChoices();
                  return;
                }
                setSectionLock("species", true);
              }}
              raceOptions={raceOptions}
              selectedRaceId={selectedRaceId}
              handleSpeciesSelect={handleSpeciesSelect}
              activeRace={activeRace}
              getRaceTraits={getRaceTraits}
            />
          )}

          {activeMainTab === "player" && activePlayerTab === "classes" && (
            <ClassesTab
              activeClassTab={activeClassTab}
              resolvedClassTab={resolvedClassTab}
              setActiveClassTab={setActiveClassTab}
              isSectionLocked={isSectionLocked}
              lockButtonBaseStyle={lockButtonBaseStyle}
              getClassLockButtonState={getClassLockButtonState}
              renderPendingBadge={renderPendingBadge}
              getPendingCountForSection={getPendingCountForSection}
              resetClassImpactsForSlot={resetClassImpactsForSlot}
              hasPendingClassChoicesForSlot={hasPendingClassChoicesForSlot}
              startClassDefine={startClassDefine}
              setClassLockForSlot={setClassLockForSlot}
              resolveLevel={resolveLevel}
              setLevel={setLevel}
              classOptions={classOptions}
              subclassOptions={subclassOptions}
              isActiveClassLocked={isActiveClassLocked}
              activeClassSlot={activeClassSlot}
              activeClassId={activeClassId}
              activeSubclassId={activeSubclassId}
              activeClassEntry={activeClassEntry}
              handleClassSelect={handleClassSelect}
              setSubclassSelection={setSubclassSelection}
              setClassLevel={setClassLevel}
              isSecondaryEnabled={isSecondaryEnabled}
              enableSecondaryClass={enableSecondaryClass}
              removeSecondaryClass={removeSecondaryClass}
            />
          )}

          {activeMainTab === "player" && activePlayerTab === "backgrounds" && (
            <BackgroundsTab
              isSectionLocked={isSectionLocked}
              lockButtonBaseStyle={lockButtonBaseStyle}
              getLockButtonState={getLockButtonState}
              renderPendingBadge={renderPendingBadge}
              getPendingCountForSection={getPendingCountForSection}
              backgroundOptions={backgroundOptions}
              selectedBackgroundId={selectedBackgroundId}
              handleBackgroundSelect={handleBackgroundSelect}
              onLockClick={() => {
                if (isSectionLocked("backgrounds")) {
                  resetBackgroundImpacts();
                  return;
                }
                if (hasPendingBackgroundChoices()) {
                  startBackgroundDefine();
                  return;
                }
                lockBackgroundAndCreateEquipment();
              }}
              activeBackground={activeBackground}
              getBackgroundFeatureInfo={getBackgroundFeatureInfo}
              getBackgroundToolChoice={getBackgroundToolChoice}
              getBackgroundLanguageChoice={getBackgroundLanguageChoice}
              getBackgroundSkillProficiencies={getBackgroundSkillProficiencies}
              getBackgroundToolProficiencies={getBackgroundToolProficiencies}
              formatEquipmentLabel={formatEquipmentLabel}
              toolMasteryOptions={toolMasteryOptions}
              competenceOptions={competenceOptions}
            />
          )}

          {activeMainTab === "player" && activePlayerTab === "profile" && (
            <ProfileTab
              character={props.character}
              profileDetails={profileDetails}
              setNameField={setNameField}
              setPhysiqueDetail={setPhysiqueDetail}
              setProfileDetail={setProfileDetail}
              isSectionLocked={isSectionLocked}
              toggleSectionLock={toggleSectionLock}
              lockButtonBaseStyle={lockButtonBaseStyle}
              getLockButtonState={getLockButtonState}
              renderPendingBadge={renderPendingBadge}
              getPendingCountForSection={getPendingCountForSection}
            />
          )}

          {activeMainTab === "player" && activePlayerTab === "magic" && magicSources.length > 0 && (
            <MagicPanel
              magicSources={magicSources}
              activeMagicTab={activeMagicTab}
              setActiveMagicTab={setActiveMagicTab}
              isSectionLocked={isSectionLocked}
              toggleSectionLock={toggleSectionLock}
              lockButtonBaseStyle={lockButtonBaseStyle}
              getLockButtonState={getLockButtonState}
              spellcastingSelections={spellcastingSelections}
              spellGrantsBySource={
                ((props.character as any)?.spellcastingState?.spellGrants as Record<string, any[]>) ?? {}
              }
              updateSpellcastingSelection={updateSpellcastingSelection}
              computeMod={computeMod}
              getScore={getScore}
              resolveLevel={resolveLevel}
              getCasterContribution={getCasterContribution}
              resolveItemTags={resolveItemTags}
              inventoryItems={inventoryItems}
              formatEquipmentLabel={formatEquipmentLabel}
              getSpellId={getSpellId}
              makeSpellEntry={makeSpellEntry}
            />
          )}

          {activeMainTab === "player" && activePlayerTab === "sheet" && (
            <SheetTab
              character={props.character}
              onChangeCharacter={props.onChangeCharacter}
              liveDerivedGrants={((buildDerivedGrants() as any)?.grants ?? {}) as Record<string, any>}
              choiceSelections={choiceSelections}
              magicSources={magicSources}
              spellcastingSelections={spellcastingSelections}
              renderValidatedBadge={renderValidatedBadge}
              getSectionValidated={getSectionValidated}
              activeRace={activeRace}
              getRaceTraits={getRaceTraits}
              activeBackground={activeBackground}
              getBackgroundFeatureInfo={getBackgroundFeatureInfo}
              getBackgroundSkillProficiencies={getBackgroundSkillProficiencies}
              getBackgroundToolProficiencies={getBackgroundToolProficiencies}
              competenceOptions={competenceOptions}
              toolMasteryOptions={toolMasteryOptions}
              classPrimary={classPrimary}
              classSecondary={classSecondary}
              classEntry={classEntry}
              secondaryClassEntry={secondaryClassEntry}
              selectedSubclassId={selectedSubclassId}
              selectedSecondarySubclassId={selectedSecondarySubclassId}
              subclassOptions={subclassOptions}
              asiSelections={asiSelections}
              getScore={getScore}
              computeMod={computeMod}
              resolveLevel={resolveLevel}
              computeArmorClassFromEquipment={computeArmorClassFromEquipment}
              computeMaxHp={computeMaxHp}
              competences={competences}
              expertises={expertises}
              skillAbilityMap={skillAbilityMap}
              weaponMasteries={weaponProficiencies}
              unlockedWeaponMasteries={unlockedWeaponMasteries}
              unlockedFightingStyles={selectedCombatStyles}
              armorMasteries={armorMasteries}
              toolMasteries={toolMasteries}
              EQUIPMENT_SLOTS={EQUIPMENT_SLOTS}
              materielSlots={materielSlots}
              packSlots={packSlots}
              packSlotStatus={packSlotStatus}
              inventoryItems={inventoryItems}
              getSlotLabel={getSlotLabel}
              formatEquipmentLabel={formatEquipmentLabel}
            />
          )}
        </div>
      </div>

      <AsiModal
        open={asiModal.open}
        entry={asiModal.entry}
        step={asiModal.step}
        type={asiModal.type}
        stats={asiModal.stats}
        originalStats={asiModal.originalStats}
        statKeys={STAT_KEYS}
        asiBonusMap={asiBonusMap}
        getBaseScore={getBaseScore}
        getNonAsiBonusSumForStat={getNonAsiBonusSumForStat}
        setType={setAsiModalType}
        setStep={setAsiModalStep}
        onClose={closeAsiModal}
        onConfirmType={confirmAsiModalType}
        onConfirmStats={confirmAsiModalStats}
        updateStat={updateAsiModalStat}
        canAllocateMoreAsi={canAllocateMoreAsi}
      />
      <ChoiceModal
        open={choiceModal.open}
        title={choiceModal.title}
        options={choiceModal.options}
        selected={choiceModal.selected}
        count={choiceModal.count}
        multi={choiceModal.multi}
        onToggle={handleChoiceToggle}
        onClose={closeChoiceModal}
        onConfirm={handleChoiceConfirm}
      />
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onCancel={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
}


