import type { Personnage } from "../../types";

// Sample character for the mini game.
// Text fields are kept ASCII-only to avoid encoding issues.
export const sampleCharacter: Personnage = {
  id: "pj-1",
  nom: { nomcomplet: "Test Hero", prenom: "Aryn", surnom: "the Blue" },
  age: 25,
  sexe: "H",
  taille: 175,
  poids: 70,
  langues: ["commun"],
  alignement: "Neutral Good",
  raceId: "human",
  backgroundId: "veteran-de-guerre",
  classe: {
    1: { classeId: "fighter", subclasseId: "champion", niveau: 1 }
  },
  niveauGlobal: 1,
  xp: 0,
  dv: 10,
  maitriseBonus: 2,
  pvActuels: 12,
  pvTmp: 0,
  nivFatigueActuel: 0,
  nivFatigueMax: 3,
  actionIds: ["melee-strike", "dash"],
  reactionIds: [],
  combatStats: {
    level: 1,
    mods: { modFOR: 3, modDEX: 2, modCON: 2, modINT: 0, modSAG: 1, modCHA: 0 },
    maxHp: 12,
    armorClass: 16,
    attackBonus: 5,
    maxAttacksPerTurn: 1,
    actionsPerTurn: 1,
    bonusActionsPerTurn: 1,
    actionRules: { forbidSecondAttack: true },
    resources: {}
  },
  caracs: {
    force: { FOR: 16, modFOR: 3 },
    dexterite: { DEX: 14, modDEX: 2 },
    constitution: { CON: 14, modCON: 2 },
    intelligence: { INT: 10, modINT: 0 },
    sagesse: { SAG: 12, modSAG: 1 },
    charisme: { CHA: 10, modCHA: 0 }
  },
  movementModes: { walk: 6 },
  visionProfile: {
    shape: "cone",
    range: 100,
    apertureDeg: 180,
    lightVision: "normal"
  },
  appearance: {
    spriteKey: "character",
    tokenScale: 100
  },
  // Competences / expertises use technical ids (no accents).
  competences: [],
  expertises: [],
  initiative: "modDEX",
  besoin: [],
  percPassive: 11,
  proficiencies: {
    weapons: ["simple", "martiale"],
    armors: [],
    tools: []
  },
  savingThrows: ["force", "constitution"],
  inspiration: false,
  notes: "",
  argent: {
    cuivre: 0,
    argent: 0,
    or: 10,
    platine: 0
  },
  materielSlots: {
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
  },
  armesDefaut: {
    main_droite: "epee-longue",
    main_gauche: "dague",
    mains: null
  },
  inventoryItems: [],
  descriptionPersonnage: {
    bio: "Test hero for the mini-game.",
    physique: "Athletic human in light armor, posture calme et vigilante.",
    personnalite: "Calm and determined.",
    objectifs: "Explore the test dungeon.",
    relations: "",
    defauts: "Too reckless."
  },
  profileDetails: {
    visage: "Traits marques, regard concentre",
    cheveux: "Cheveux bruns courts",
    yeux: "Yeux verts",
    silhouette: "Silhouette athletique"
  },
  choiceSelections: {
    statsBase: {
      FOR: 16,
      DEX: 14,
      CON: 14,
      INT: 10,
      SAG: 12,
      CHA: 10
    }
  },
  creationLocks: {},
  classLocks: { primary: false, secondary: false },
  progressionHistory: [],
  spellcastingState: {
    totalCasterLevel: 0,
    slots: {},
    sources: {},
    slotJustifications: []
  },
  derived: {
    grants: {
      traits: [],
      features: [],
      feats: [],
      skills: [],
      tools: [],
      languages: [],
      spells: []
    }
  }
} as Personnage;
