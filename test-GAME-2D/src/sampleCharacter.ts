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
  backgroundId: "adventurer",
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
  // Keep competences empty in this mini-game to avoid
  // encoding issues with accented keys.
  competences: {} as any,
  initiative: "modDEX",
  besoin: [],
  percPassive: 11,
  proficiencies: {},
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
    Ceinture_gauche: null,
    Ceinture_droite: null,
    Dos_gauche: null,
    Dos_droit: null,
    Armure: null,
    Vetement: null,
    paquetage: null,
    accessoire: null
  },
  armesDefaut: {
    main_droite: null,
    main_gauche: null,
    mains: null
  },
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
    physique: "Athletic human in light armor.",
    personnalite: "Calm and determined.",
    objectifs: "Explore the test dungeon.",
    relations: "",
    defauts: "Too reckless."
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
