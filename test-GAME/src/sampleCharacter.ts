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
  vitesse: 9,
  langues: "Common",
  alignement: "Neutral Good",
  raceId: "human",
  backgroundId: "adventurer",
  niveauGlobal: 1,
  classe: {
    1: { classeId: "fighter", subclasseId: "champion", niveau: 1 }
  },
  xp: 0,
  dv: 10,
  maitriseBonus: 2,
  pvActuels: 12,
  pvMax: 12,
  pvTmp: 0,
  calculPvMax: {
    classe1: { niveauGlobal_1: "10 + modCON", par_niveau_apres_1: "1d10 + modCON" },
    classe2: { par_niveau_apres_1: "" }
  },
  CA: 16,
  CalculCA: {
    base: "10 + modDEX",
    bonusArmure: "+ armor proficiency + shield"
  },
  nivFatigueActuel: 0,
  nivFatigueMax: 3,
  initiative: "modDEX",
  besoin: [],
  caracs: {
    force: { FOR: 16, modFOR: 3 },
    dexterite: { DEX: 14, modDEX: 2 },
    constitution: { CON: 14, modCON: 2 },
    intelligence: { INT: 10, modINT: 0 },
    sagesse: { SAG: 12, modSAG: 1 },
    charisme: { CHA: 10, modCHA: 0 }
  },
  // Keep competences empty in this mini-game to avoid
  // encoding issues with accented keys.
  competences: {} as any,
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

