import type { Personnage } from "./types";

// Sample character for the mini game.
// Text fields are kept ASCII-only to avoid encoding issues.
export const sampleCharacter: Personnage = {
  id: "pj-1",
  nom: { nomcomplet: "Test Hero", prenom: "Aryn", surnom: "the Blue" },
  age: 25,
  sexe: "H",
  taille: 175,
  poids: 70,
  langues: "Common",
  alignement: "Neutral Good",
  raceId: "human",
  backgroundId: "veteran-de-guerre",
  classe: {
    1: { classeId: "fighter", subclasseId: "champion", niveau: 1 }
  },
  xp: 0,
  dv: 10,
  maitriseBonus: 2,
  pvActuels: 12,
  pvTmp: 0,
  nivFatigueActuel: 0,
  nivFatigueMax: 3,
  actionIds: ["melee-strike", "dash", "second-wind", "throw-dagger", "torch-toggle"],
  reactionIds: ["opportunity-attack", "guard-strike", "killer-instinct"],
  combatStats: {
    level: 1,
    mods: { str: 3, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
    maxHp: 12,
    armorClass: 16,
    attackBonus: 5,
    attackDamage: 6,
    attackRange: 1,
    maxAttacksPerTurn: 1,
    actionsPerTurn: 1,
    bonusActionsPerTurn: 1,
    actionRules: { forbidSecondAttack: true },
    resources: {}
  },
  caracs: {
    force: { FOR: 16 },
    dexterite: { DEX: 14 },
    constitution: { CON: 14 },
    intelligence: { INT: 10 },
    sagesse: { SAG: 12 },
    charisme: { CHA: 10 }
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
    weapons: [],
    armors: [],
    tools: []
  },
  savingThrows: ["force", "constitution"],
  inspiration: false,
  traits: ["Veteran soldier", "Brave"],
  features: [],
  compteur: {},
  ressources: {},
  etats: [],
  historique: [],
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
  equipmentAuto: [],
  equipmentManual: [],
  inventoryItems: [],
  Inventaire: {
    id: "",
    idUnique: "",
    quantite: 0,
    mod: null,
    conteneur: null
  },
  capaMax: 120,
  capaAvantMalus: 60,
  capaActuel: 0,
  StatEncombrement: "Not encumbered",
  calculPvMax: {
    classe1: { niveauGlobal_1: "10 + modCON", par_niveau_apres_1: "1d10 + modCON" },
    classe2: { par_niveau_apres_1: "" }
  },
  CalculCA: {
    base: "10 + modDEX",
    bonusArmure: "+ armor proficiency + shield"
  },
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
  uiClasse: {
    ui_template1: "fighter_base",
    ui_template2: null
  },
  SpellcastingSpec: {
    ability: null,
    spellSaveDc: null,
    spellAttackMod: null,
    slots: {},
    focusId: null,
    description: null,
    spellIds: []
  }
} as Personnage;
