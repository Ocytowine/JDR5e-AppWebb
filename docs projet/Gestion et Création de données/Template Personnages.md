export type Personnage = {// Modèle de données pour un personnage //hydrater depuis la création du personnage et les évolutions en jeu.(les features s'appliquent sont stockées dans un autre objet)
  id: string // Valeur_Base:Aléatoire //identifiant unique du personnage
  nom: {nomcomplet: string; prenom?: string; surnom?: string} // nom du personnage, prénom et surnom optionnel
  age: number // Valeur_Base:Race // âge du personnage en années dans une fourchette imposée par la race (ageMini: number, ageMax: number)
  sexe: string //Valeur_base:Choisie dans Race // homme, femme, autre
  taille: number //Valeur_base:Race // Choisie dans une fourchette imposée par la race (TailleMini: number, TailleMax: number)
  poids: number // Valeur_Base: Race // Choisie par le joueur dans l'onglet race et grace à une réglette poids=taille x  (Corpulence : 
  vitesse: number // Valeur_Base:Race // Vitesse de déplacement en mètres
  langues: string // Valeur_Base:Race/Background // Liste des langues connues par le personnage
  alignement: string // Valeur_Base:Choisie dans Background //ex: Loyal Bon, Neutre Mauvais, etc.
  raceId: string // Valeur_Base:Choisie // identifiant de la race
  backgroundId: string // Valeur_Base:Choisie // identifiant du background
  niveauGlobal: number // Valeur_Base:Choisie (choisir jusqu'à niveau3) // Niveau global du personnage, évolue avec l'expérience (palier et logique xp définie ailleurs)
  classe: {
    1: { classeId: string; subclasseId: string; niveau: number } // classe principale
    2?: { classeId: string; subclasseId: string; niveau: number } // classe secondaire
  }
  xp: number // Valeur_Base:NiveauChoisie // expérience totale, palier et logique xp définie ailleurs
  dv: number // Valeur_Base:Classe // dés de vie, se cumulent selon les classes
  maitriseBonus: number // Valeur_Base:NiveauChoisie // bonus de maîtrise, dépend du niveau global
  pvActuels: number // points de vie actuels
  pvMax: number // points de vie maximum
  pvTmp: number // points de vie temporaires
  calculPvMax: {
    classe1: { niveauGlobal_1: string; par_niveau_apres_1: string };
    classe2: { par_niveau_apres_1: string }
  }
  CA: number // classe d'armure, peut être une valeur fixe ou une formule
  CalculCA: {
    base: string; // // Valeur_Base:Race //ex: 10 + modDEX
    bonusArmure: string; // ex: armure portée
  }

  nivFatigueActuel: number // Valeur_Base:Race // Niveau de fatigue actuel, chaque niveau a des effets spécifiques
  nivFatigueMax: number // Valeur_Base:Race // Niveau de fatigue maximum avant la mort
  initiative: string // modDEX + autres bonus/malus

  besoin: Array<Record<string, any>>
  [key: string]: any

  caracs: {
    force: { FOR: number; modFOR: number },// modFOR = Math.floor((FOR - 10) / 2)
    dexterite: { DEX: number; modDEX: number },// modDEX = Math.floor((DEX - 10) / 2)
    constitution: { CON: number; modCON: number }// modCON = Math.floor((CON - 10) / 2)
    intelligence: { INT: number; modINT: number },// modINT = Math.floor((INT - 10) / 2)
    sagesse: { SAG: number; modSAG: number },// modSAG = Math.floor((SAG - 10) / 2)
    charisme: { CHA: number; modCHA: number }// modCHA = Math.floor((CHA - 10) / 2)
  }
  competences: { // 1 si le personnage a la compétence, 0 sinon, si plusieurs fois la valeur est true alors on la compétence est expertisée (double le maitriseBonus)
    Athlétisme: number,
    Acrobaties: number,
    Escamotage: number,
    Discrétion: number,
    Arcanes: number,
    Histoire: number,
    Investigation: number,
    Nature: number,
    Religion: number,
    Dressage: number,
    Intuition: number,
    Médecine: number,
    Perception: number,
    Survie: number,
    Tromperie: number,
    Intimidation: number,
    Performance: number,
    Persuasion: number
  }//Valeur_Base:Classe / Background

  proficiencies: Record<string, ProficiencyRank> //Valeur_Base:Classe/Background/race // Liste des maitrises (armes, armures, outils, etc. voir documents de référence)
  savingThrows: string[] //Valeur_Base:Classe // Liste des caracs pour lesquelles le personnage est compétent aux jets de sauvegarde
  inspiration: boolean //Valeur_Base:false // Indique si le personnage a de l'inspiration (avantage sur un jet)
  traits: string[]//Valeur_Base:Background/race // Liste des traits raciaux et de background


// Gestion des features appliquées au personnage :
// issue du parcours de création et de l'évolution du personnage
// Permet de savoir quelles features sont appliquées au personnage pour gérer les effets en jeu (ex: bonus de compétence, résistance, etc.)
// Les features sont identifiées par leur ID, et renvoient aux listes d'ID des features associées sauvegardées (json brut) dans JDRDB_partieID
// Une feature peut en activer plusieurs autres (ex: un don qui donne accès à plusieurs compétences) donc on utilise un tableau d'ID (parent -> enfants)
// Lors de l'application des effets en jeu, on parcourt cette structure pour appliquer les effets de chaque feature et de ses enfants
// Une feature peut être ajoutée ou retirée dynamiquement (ex: gain/perte de don, changement de classe, etc.) en mettant à jour cette structure.
  featureIdsApply: Record<string, string[]>
  featureAddModifiers: Record<string, Record<string, any>> // Permet de stocker des modificateurs spécifiques appliqués par des features (ex: bonus de caractéristique, résistance, etc.) issu des features appliquées (featureIdsApply)


  // Gestion de l'équipement, Inventaire, poids, or, contenant etc.
  //Logique de jeu : le joueur intéragit avec son équipement via l'UI inventaire. Dans l'ui nous retrouvons des données : capacité avant malus, capacité maximal, poids transporté actuel,
  // or total, inventaire complet simplifié (chaque items de l'invenventaire et répartit par contenant (liste déroulable) et à une ligne constitué de : son nom, desrciption, poids unitaire, quantité, poids total de la ligne)
  // L'UI propose les slots d'équipement (voir materielSlots) sous forme de cases, au clic sur une case, on ouvre l'inventaire pour choisir un item à équiper dans le slot.
  // Le personnage possède des slots d'équipement (voir materielSlots) qui permettent d'équiper des items pour un accès rapide (aucun malus d'action pour les utiliser)
  // Les items équipés dans les slots sont aussi présent dans l'inventaire, mais marqués comme équipés.
  // Le poids total transporté est calculé en fonction de l'inventaire complet (items équipés et non équipés)
  // Le poids maximum transportable est géré via statBases (ex: force * 15 kg)
  // L'or total est géré via l'inventaire (items de type or, pièces d'or, etc.)
  // Les changement fait dans l'inventaire sont soumiss à validation par le MJ (IA via un système de demande de validation) avant d'être appliqués au personnage.

  materielSlots: {// Slots pour mettres des équipements (items) à disposition direct (aucun malus d'action pour les utiliser)
    Ceinture_gauche: string | null // limité au items étant d'une longueur inferieure à la moitié de la taille du personnage
// création d'un module de filtrage des items en fonction des slots disponibles et des caractéristiques du personnage (taille, force, etc.) pour n'afficher que les items compatibles lors de l'équipement. (liste déroulante filtrée)
    Ceinture_droite: string | null // limité au items étant d'une longueur inferieure à la moitié de la taille du personnage

    Dos_gauche: string | null // limité au items étant d'une longueur inferieure à la taille du personnage

    Dos_droit: string | null // limité au items étant d'une longueur inferieure à la taille du personnage

    Armure: string | null // armure légère, armure lourde, etc. peut être recouverte par un vêtement

    Vetement: string | null // Vêtement, Veste, etc.

    paquetage: string | null // sac à dos, besace, etc.

    accessoire: string | null // Montre, amulette, bague, etc. limite de 5
  }
  armesDefaut:
  {// Systeme permettant de définir les armes par défaut du personnage (ex: arme de mêlée principale, arme de mêlée secondaire, arme à distance), à la condition d'être présent dans les slots d'équipement (materielSlots)
    main_droite: string | null // idUnique de l'arme équipée en main droite //Filtre les armes compatibles via leur propriété (ex: arme légère, arme de jet, etc.)
    main_gauche: string | null // idUnique de l'arme équipée en main gauche //Filtre les armes compatibles via leur propriété (ex: arme légère, arme de jet, etc.)
    mains: string | null // idUnique de l'arme équipée à deux mains //Filtre les armes compatibles via leur propriété (ex: arme à deux mains, etc.)
  } //Ont applique les features des items de armesDefaut (calcul du CA avec bouclier, bonus de dégâts, etc.)
    Inventaire: 
    {
      id: string, //identifiant de l'item issu de la base de données des items
      idUnique:string, // identifiant unique pour chaque instance de l'item (permet de gérer les items consommables, usables, etc.)
      quantite: number,  // quantité de cet item dans l'inventaire
      mod:{String:string} | null, //modificateurs appliqués à cet item, peut-s'agir de la description visuelle, de bonus de caractéristique, d'une libertée du MJ (en somme appelle la propriété de l'arme, la remplace par une autre valeur).
      conteneur:string | null // spécifie dans quel contenant se trouve l'item (sac, coffre, etc.), null si l'item est porté sur soi
    } // liste des items dans l'inventaire avec leur quantité et un id unique pour chaque instance (permet de gérer les items consommables, usables, etc.)

    
  
  descriptionPersonnage: {
    bio: string
    physique: string
    personnalite: string
    objectifs: string
    relations: string
    defauts: string
  }
 uiClasse:
 {
  ui_template1: string // template d'affichage personnalisé (lié à la classe1 choisie) permet de charger le template de /public/templates/template_classe1.vue
  ui_template2: string | null // template d'affichage personnalisé (lié à la classe2 choisie ou rien)
}

SpellcastingSpec : {
  ability: string | null // carac associée aux jets de sort
  spellSaveDc: number | null
  spellAttackMod: number | null
  slots: Record<string, number | string>
  focusId: string | null
  type SpellMemory =
  | {
      type: "grimoire";
      grimoires: Array<{
        nom: string;
        sorts: string[];
      }>;
    }
  | {
      type: "memoire";
      capacite: number;      // nb de sorts mémorisables
      sortsMemorises: string[];
    }
  | {
      type: "preparation";
      capaciteParJour: number;
      sortsPrepares: string[];
    };// Fonctionnement de la mémoire des sorts (ex: nombre de sorts préparés par niveau)

  description?: string | null
    spellIds?: string[]
}}