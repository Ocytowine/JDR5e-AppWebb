const fs = require("fs");
const path = require("path");

const sandboxPath = path.resolve(__dirname, "..", "map-module", "data", "layouts", "simulation_sandbox.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function population(groups, dominantGroupId, notes = []) {
  return { dominantGroupId, groups, notes };
}

function successOpportunity(kind, score, tags) {
  return { type: "open_opportunity", kind, score, tags };
}

function failureTension(tensionType, severity, tags) {
  return { type: "create_tension", tensionType, severity, tags };
}

function signal(signalKind, intensity, tags) {
  return { type: "spawn_signal", signalKind, intensity, tags };
}

const layout = readJson(sandboxPath);

layout.title = "Bac a sable de simulation - Quatre Vents evolue";
layout.editorPresets = {
  customGeographies: [
    { id: "marches_ombrees", label: "Marches ombrees", geography: "marches_ombrees", color: "#7a6a58", surface: "land", difficulty: 6 },
    { id: "sanctuaire_ouvert", label: "Sanctuaire ouvert", geography: "sanctuaire_ouvert", color: "#b79c61", surface: "land", difficulty: 4 }
  ],
  customTags: [
    { id: "bastion", label: "Bastion", color: "#7293d7" },
    { id: "relais", label: "Relais", color: "#8cb97b" },
    { id: "rite", label: "Rite", color: "#d4b16a" },
    { id: "contrebande", label: "Contrebande", color: "#c96f4a" }
  ]
};

const cityById = new Map(layout.cities.map(city => [city.id, city]));
cityById.get("stoneharbor").populationProfile = population([
  { groupId: "humains_occident", weight: 58, role: "dominant" },
  { groupId: "halfelins_cotiers", weight: 17, role: "minority" },
  { groupId: "nains_artisans", weight: 15, role: "elite" },
  { groupId: "etrangers_de_route", weight: 10, role: "outsider" }
], "humains_occident", ["Ville-port melangee par les flux commerciaux."]);
cityById.get("ironvale").populationProfile = population([
  { groupId: "humains_des_collines", weight: 46, role: "dominant" },
  { groupId: "nains_mineurs", weight: 38, role: "elite" },
  { groupId: "pelerins_du_feu", weight: 16, role: "minority" }
], "humains_des_collines", ["La ville miniere vit autant de la fonte que des sanctuaires."]);
cityById.get("dawnwatch").populationProfile = population([
  { groupId: "humains_des_marches", weight: 61, role: "dominant" },
  { groupId: "demi_elfes_frontaliers", weight: 14, role: "minority" },
  { groupId: "soldats_de_metier", weight: 25, role: "elite" }
], "humains_des_marches", ["La capitale orientale est d'abord une ville de garnison et de passage."]);
cityById.get("briarford").populationProfile = population([
  { groupId: "humains_des_plaines", weight: 52, role: "dominant" },
  { groupId: "halfelins_riverains", weight: 28, role: "minority" },
  { groupId: "charretiers_libres", weight: 20, role: "outsider" }
], "humains_des_plaines", ["Le grenier des Quatre Vents attire main d'oeuvre et transit."]);

layout.simulation = layout.simulation ?? {};
layout.simulation.districts = [
  { id: "stoneharbor:harbor", cityId: "stoneharbor", name: "Quais du Sel", tags: ["port", "commerce", "contrebande"], cellKeys: [cellKey(4, 7), cellKey(4, 8), cellKey(5, 7)], dominantActivities: ["transbordement", "peche", "contrebande"], importantPlaces: ["Bassin des Marees", "Entrepot du Levant", "Ponton des Pilotes"], populationProfile: population([{ groupId: "humains_occident", weight: 49, role: "dominant" }, { groupId: "halfelins_cotiers", weight: 24, role: "minority" }, { groupId: "etrangers_de_route", weight: 27, role: "outsider" }], "humains_occident") },
  { id: "stoneharbor:custom_house", cityId: "stoneharbor", name: "Maison des Douanes", tags: ["administration", "taxes", "relais"], cellKeys: [cellKey(5, 6), cellKey(5, 8)], dominantActivities: ["controle", "comptabilite", "negociation"], importantPlaces: ["Maison des Douanes", "Cour des Sceaux"], populationProfile: population([{ groupId: "humains_occident", weight: 63, role: "dominant" }, { groupId: "nains_artisans", weight: 21, role: "elite" }, { groupId: "etrangers_de_route", weight: 16, role: "outsider" }], "humains_occident") },
  { id: "stoneharbor:upper_town", cityId: "stoneharbor", name: "Haute Ville du Phare", tags: ["urbain", "residence", "bastion"], cellKeys: [cellKey(4, 6), cellKey(6, 6), cellKey(6, 7), cellKey(6, 8)], dominantActivities: ["artisanat", "surveillance", "residence"], importantPlaces: ["Tour du Phare", "Escalier des Cordiers"], populationProfile: population([{ groupId: "humains_occident", weight: 57, role: "dominant" }, { groupId: "nains_artisans", weight: 26, role: "elite" }, { groupId: "halfelins_cotiers", weight: 17, role: "minority" }], "humains_occident") },
  { id: "ironvale:forge_ring", cityId: "ironvale", name: "Anneau des Forges", tags: ["minier", "artisanat", "feu"], cellKeys: [cellKey(8, 5), cellKey(9, 5), cellKey(10, 5)], dominantActivities: ["forge", "fonte", "negoce de metal"], importantPlaces: ["Marche du Fer", "Porte des Mineurs"], populationProfile: population([{ groupId: "nains_mineurs", weight: 42, role: "dominant" }, { groupId: "humains_des_collines", weight: 40, role: "minority" }, { groupId: "pelerins_du_feu", weight: 18, role: "outsider" }], "nains_mineurs") },
  { id: "ironvale:pilgrim_steps", cityId: "ironvale", name: "Marches des Cendres", tags: ["sacre", "rite", "pelerinage"], cellKeys: [cellKey(9, 4), cellKey(10, 4), cellKey(11, 4)], dominantActivities: ["rituel", "hebergement", "enquete religieuse"], importantPlaces: ["Monastere des Cendres", "Cour des Lampes"], populationProfile: population([{ groupId: "pelerins_du_feu", weight: 39, role: "dominant" }, { groupId: "humains_des_collines", weight: 36, role: "minority" }, { groupId: "nains_mineurs", weight: 25, role: "elite" }], "pelerins_du_feu") },
  { id: "ironvale:miners_gate", cityId: "ironvale", name: "Porte des Mineurs", tags: ["minier", "relais", "passage"], cellKeys: [cellKey(7, 5), cellKey(7, 6), cellKey(8, 6), cellKey(9, 6)], dominantActivities: ["chargement", "escorte", "debit de minerai"], importantPlaces: ["Cour du Treuil", "Puits des Messagers"], populationProfile: population([{ groupId: "humains_des_collines", weight: 47, role: "dominant" }, { groupId: "nains_mineurs", weight: 33, role: "elite" }, { groupId: "etrangers_de_route", weight: 20, role: "outsider" }], "humains_des_collines") },
  { id: "dawnwatch:gate_district", cityId: "dawnwatch", name: "Quartier de la Porte Est", tags: ["frontalier", "controle", "bastion"], cellKeys: [cellKey(13, 4), cellKey(14, 4), cellKey(15, 4), cellKey(14, 5)], dominantActivities: ["inspection", "patrouille", "perception"], importantPlaces: ["Porte de l'Aube", "Cour des Gardes"], populationProfile: population([{ groupId: "soldats_de_metier", weight: 36, role: "elite" }, { groupId: "humains_des_marches", weight: 49, role: "dominant" }, { groupId: "demi_elfes_frontaliers", weight: 15, role: "minority" }], "humains_des_marches") },
  { id: "dawnwatch:sanctuary", cityId: "dawnwatch", name: "Sanctuaire du Soleil Neuf", tags: ["sacre", "rite", "pilgrim_way"], cellKeys: [cellKey(14, 3), cellKey(12, 4), cellKey(13, 3)], dominantActivities: ["pelerinage", "veille", "conservation"], importantPlaces: ["Sanctuaire du Soleil Neuf", "Jardin des Cierges"], populationProfile: population([{ groupId: "pelerins_du_feu", weight: 34, role: "dominant" }, { groupId: "humains_des_marches", weight: 44, role: "minority" }, { groupId: "demi_elfes_frontaliers", weight: 22, role: "outsider" }], "humains_des_marches") },
  { id: "dawnwatch:citadel", cityId: "dawnwatch", name: "Citadelle des Veilleurs", tags: ["militaire", "administration", "bastion"], cellKeys: [cellKey(13, 5), cellKey(13, 6), cellKey(14, 6), cellKey(15, 5)], dominantActivities: ["commandement", "logistique", "detention"], importantPlaces: ["Citadelle des Veilleurs", "Depot des Marches"], populationProfile: population([{ groupId: "soldats_de_metier", weight: 48, role: "dominant" }, { groupId: "humains_des_marches", weight: 37, role: "minority" }, { groupId: "demi_elfes_frontaliers", weight: 15, role: "outsider" }], "soldats_de_metier") },
  { id: "briarford:grain_ward", cityId: "briarford", name: "Quartier des Greniers", tags: ["grain", "approvisionnement", "entrepot"], cellKeys: [cellKey(10, 8), cellKey(11, 8), cellKey(11, 9)], dominantActivities: ["stockage", "pesage", "convois"], importantPlaces: ["Halle au Grain", "Greniers du Pont"], populationProfile: population([{ groupId: "humains_des_plaines", weight: 54, role: "dominant" }, { groupId: "halfelins_riverains", weight: 24, role: "minority" }, { groupId: "charretiers_libres", weight: 22, role: "outsider" }], "humains_des_plaines") },
  { id: "briarford:river_market", cityId: "briarford", name: "Marche du Bac", tags: ["commerce", "river", "relais"], cellKeys: [cellKey(9, 9), cellKey(10, 9), cellKey(10, 7)], dominantActivities: ["negoce", "transit", "courtage"], importantPlaces: ["Marche du Bac", "Auberge des Essieux"], populationProfile: population([{ groupId: "halfelins_riverains", weight: 36, role: "dominant" }, { groupId: "humains_des_plaines", weight: 42, role: "minority" }, { groupId: "charretiers_libres", weight: 22, role: "outsider" }], "humains_des_plaines") },
  { id: "briarford:south_granaries", cityId: "briarford", name: "Granges du Sud", tags: ["agricole", "grain", "peripherie"], cellKeys: [cellKey(12, 8), cellKey(12, 9), cellKey(10, 10), cellKey(11, 10)], dominantActivities: ["sechage", "tri", "chargement"], importantPlaces: ["Granges du Sud", "Cour des Mules"], populationProfile: population([{ groupId: "humains_des_plaines", weight: 57, role: "dominant" }, { groupId: "charretiers_libres", weight: 25, role: "outsider" }, { groupId: "halfelins_riverains", weight: 18, role: "minority" }], "humains_des_plaines") }
];
layout.simulation.districtOverrides = [];
layout.simulation.factions = [
  {
    id: "harbor_league", label: "Ligue des Havres", type: "merchant_league", color: "#5a78b7",
    description: "Coalition marchande dominante a Stoneharbor, branchee sur les greniers de Briarford et les relais fiscaux de l'ouest.",
    agenda: "Stabiliser les routes taxables, verrouiller les douanes et garder la dependance logistique entre les deux moities du pays.",
    methods: ["negociation", "escorte", "pression economique"], objectiveHints: ["open_route", "take_control_place", "acquire_resource"], tags: ["commerce", "civique", "western_reach"],
    homeCityId: "stoneharbor", homeRegionId: "coastmarch", baseCell: { x: 5, y: 6 }, presenceCells: [{ x: 4, y: 7 }, { x: 5, y: 6 }, { x: 10, y: 9 }, { x: 11, y: 8 }],
    controlledZoneIds: ["stoneharbor:custom_house", "briarford:grain_ward"], influencedZoneIds: ["south_grain_route", "coast_trade_way", "stoneharbor:harbor", "briarford:river_market"], interestZoneIds: ["amber_road", "frontier_supply_track", "coastmarch", "green_plains", "frontier_marches"], avoidedZoneIds: ["march_of_thorns"],
    localAnchors: [
      { id: "harbor_league:customs_house", label: "Comptoir des Douanes", type: "warehouse", targetKind: "district", targetId: "stoneharbor:custom_house", level: 4, tags: ["relais", "logistique", "taxes"], notes: "Centre de controle fiscal et de dispatch des convois." },
      { id: "harbor_league:briarford_yard", label: "Cour du Bac", type: "warehouse", targetKind: "district", targetId: "briarford:river_market", level: 3, tags: ["commerce", "grain", "relais"], notes: "Point de regroupement avant la redistribution vers l'ouest." }
    ],
    populationProfile: population([{ groupId: "humains_occident", weight: 55, role: "dominant" }, { groupId: "nains_artisans", weight: 22, role: "elite" }, { groupId: "etrangers_de_route", weight: 23, role: "outsider" }], "humains_occident"),
    influence: 69, power: 48, cohesion: 61, aggression: 28, secrecy: 31, resources: 82,
    relations: [
      { targetFactionId: "red_knives", status: "rival", trust: 9, hostility: 72, notes: "Les rackets perturbent les marges et la reputation des relais." },
      { targetFactionId: "dawn_guard", status: "ally", trust: 58, hostility: 14, notes: "Alliance pragmatique autour des routes et taxes." },
      { targetFactionId: "ember_cult", status: "neutral", trust: 37, hostility: 18, notes: "Relations tolerantes autour des pelerinages." }
    ]
  },
  {
    id: "red_knives", label: "Couteaux Rouges", type: "reseau_criminel", color: "#c96f4a",
    description: "Reseau criminel implante sur les quais de Stoneharbor, dans les relais de Briarford et jusque dans les villages de marche.",
    agenda: "Faire monter la peur sur les routes et convertir les goulets logistiques en rentes criminelles.",
    methods: ["extorsion", "contrebande", "recrutement"], objectiveHints: ["acquire_resource", "recruit_agents", "weaken_rival"], tags: ["criminel", "frontalier", "western_reach"],
    homeCityId: "stoneharbor", homeRegionId: "coastmarch", baseCell: { x: 5, y: 8 }, presenceCells: [{ x: 5, y: 8 }, { x: 10, y: 9 }, { x: 12, y: 5 }, { x: 13, y: 8 }], influencedZoneIds: ["stoneharbor:harbor", "briarford:river_market", "coast_trade_way"], interestZoneIds: ["frontier_marches", "dawnwatch:gate_district", "amber_road"],
    localAnchors: [
      { id: "red_knives:salt_cellar", label: "Cave du Sel", type: "safehouse", targetKind: "district", targetId: "stoneharbor:harbor", level: 3, tags: ["secret", "contrebande", "relais"], notes: "Entrepot cache pour stockage et redistribution de la contrebande." },
      { id: "red_knives:thorn_contact", label: "Contact des Epines", type: "contact", targetKind: "district", targetId: "dawnwatch:gate_district", level: 2, tags: ["infiltration", "frontalier"], notes: "Relais humain pour recruter et prevenir des descentes de garde." }
    ],
    populationProfile: population([{ groupId: "etrangers_de_route", weight: 38, role: "dominant" }, { groupId: "humains_occident", weight: 34, role: "minority" }, { groupId: "halfelins_cotiers", weight: 28, role: "outsider" }], "etrangers_de_route"),
    influence: 61, power: 49, cohesion: 46, aggression: 63, secrecy: 74, resources: 72,
    relations: [
      { targetFactionId: "harbor_league", status: "rival", trust: 8, hostility: 73, notes: "Les convois bien gardes sont une cible prioritaire." },
      { targetFactionId: "dawn_guard", status: "war", trust: 2, hostility: 88, notes: "La garde multiplie les descentes et les confiscations." },
      { targetFactionId: "ember_cult", status: "neutral", trust: 19, hostility: 24, notes: "Le culte peut servir d'ecran ou de source." }
    ]
  },
  {
    id: "dawn_guard", label: "Garde de l'Aube", type: "militia", color: "#5f86d8",
    description: "Force armee du Compact des Marches, chargee de garder Dawnwatch et la ligne de ravitaillement frontaliere.",
    agenda: "Tenir la capitale orientale, maintenir les voies de secours et casser les cellules bandites avant qu'elles ne ferment les routes.",
    methods: ["patrouille", "escorte", "pression militaire"], objectiveHints: ["open_route", "eliminate_threat", "take_control_place"], tags: ["militaire", "civique", "eastern_marches"],
    homeCityId: "dawnwatch", homeRegionId: "frontier_marches", baseCell: { x: 14, y: 4 }, presenceCells: [{ x: 14, y: 4 }, { x: 13, y: 4 }, { x: 12, y: 4 }, { x: 14, y: 6 }], controlledZoneIds: ["dawnwatch:gate_district", "dawnwatch:citadel"], influencedZoneIds: ["amber_road", "frontier_supply_track", "frontier_marches"], interestZoneIds: ["green_plains", "stoneharbor", "coastmarch"],
    localAnchors: [
      { id: "dawn_guard:east_gate_post", label: "Poste de la Porte Est", type: "outpost", targetKind: "district", targetId: "dawnwatch:gate_district", level: 4, tags: ["bastion", "inspection", "relais"], notes: "Point de tri des patrouilles et controles des convois." },
      { id: "dawn_guard:frontier_depot", label: "Depot de la Ligne Frontaliere", type: "outpost", targetKind: "route", targetId: "frontier_supply_track", level: 3, tags: ["logistique", "militaire", "relais"], notes: "Relais de secours qui empile fourrage, vivres et munitions." }
    ],
    populationProfile: population([{ groupId: "soldats_de_metier", weight: 44, role: "dominant" }, { groupId: "humains_des_marches", weight: 41, role: "minority" }, { groupId: "demi_elfes_frontaliers", weight: 15, role: "outsider" }], "soldats_de_metier"),
    influence: 63, power: 66, cohesion: 72, aggression: 48, secrecy: 28, resources: 74,
    relations: [
      { targetFactionId: "harbor_league", status: "ally", trust: 58, hostility: 14, notes: "Les taxes de route financent une partie des patrouilles." },
      { targetFactionId: "red_knives", status: "war", trust: 1, hostility: 92, notes: "Objectif assume d'arracher le reseau criminel aux Marches." },
      { targetFactionId: "ember_cult", status: "neutral", trust: 33, hostility: 20, notes: "Le culte est tolere tant qu'il ne trouble pas les routes." }
    ]
  },
  {
    id: "ember_cult", label: "Culte de la Braise", type: "cult", color: "#d4b16a",
    description: "Ordre religieux implante dans les collines d'Ironvale, partage entre rituels publics et recherche clandestine du Fragment Solaire.",
    agenda: "Renforcer la voie des pelerins, sanctifier les lieux de passage et retrouver le fragment avant les fouilles de la garde.",
    methods: ["enquete", "pelerinage", "secret"], objectiveHints: ["search_object", "protect_secret", "extend_influence"], tags: ["religieux", "ashen_hills", "frontalier"],
    homeCityId: "ironvale", homeRegionId: "ashen_hills", baseCell: { x: 10, y: 4 }, presenceCells: [{ x: 10, y: 4 }, { x: 11, y: 4 }, { x: 14, y: 3 }], influencedZoneIds: ["ironvale:pilgrim_steps", "dawnwatch:sanctuary", "pilgrims_path", "pilgrim_way"], interestZoneIds: ["march_of_thorns", "frontier_marches"],
    localAnchors: [
      { id: "ember_cult:ash_monastery", label: "Monastere des Cendres", type: "temple", targetKind: "district", targetId: "ironvale:pilgrim_steps", level: 4, tags: ["rite", "sanctuaire", "religieux"], notes: "Maison-mere du culte et lieu de conservation des archives rituelles." },
      { id: "ember_cult:sun_shrine", label: "Sanctuaire du Levant", type: "temple", targetKind: "place", targetId: "sun_shrine", level: 3, tags: ["rite", "frontalier", "secret"], notes: "Petit sanctuaire frontalier ou transitent les pelerins les plus discrets." }
    ],
    populationProfile: population([{ groupId: "pelerins_du_feu", weight: 41, role: "dominant" }, { groupId: "humains_des_collines", weight: 37, role: "minority" }, { groupId: "demi_elfes_frontaliers", weight: 22, role: "outsider" }], "pelerins_du_feu"),
    influence: 58, power: 36, cohesion: 62, aggression: 26, secrecy: 68, resources: 62,
    relations: [
      { targetFactionId: "harbor_league", status: "neutral", trust: 36, hostility: 14, notes: "Les caravanes de pelerins utilisent parfois les relais marchands." },
      { targetFactionId: "red_knives", status: "rival", trust: 10, hostility: 47, notes: "Le culte craint l'infiltration de ses sanctuaires." },
      { targetFactionId: "dawn_guard", status: "neutral", trust: 33, hostility: 20, notes: "La garde surveille, mais n'a pas encore frappe." }
    ]
  }
];
layout.simulation.specialObjectives = [
  { id: "secure_amber_road", label: "Securiser la Route de l'Ambre", category: "open_route", ownerFactionId: "dawn_guard", description: "Rouvrir l'axe politique et logistique principal entre Stoneharbor et Dawnwatch malgre les bandits et les goulets frontaliers.", whyItMatters: "Sans cette route, les deux territoires perdent leur coordination strategique et la pression criminelle devient structurelle.", targetKind: "route", targetId: "amber_road", priority: 82, progress: 72, state: "active", phases: ["Consolider les avant-postes", "Escorter les convois tests", "Fixer des patrouilles permanentes"], currentPhaseIndex: 1, obstacleHints: ["bandit_cells", "weak_outposts", "dual_tax_pressure"], compatibleActionIds: ["secure_route", "escort_convoy"], requiredAnchorType: "outpost", onSuccess: [successOpportunity("scarcity_trade", 72, ["route_ambre", "securise"]), signal("military", 52, ["route", "patrouille"])], onFailure: [failureTension("mobility_risk", 61, ["route_ambre", "dangereux"])], tags: ["route", "securite", "frontalier"], zoneIds: ["amber_road", "stoneharbor", "dawnwatch", "coastmarch", "frontier_marches"], anchorCell: { x: 10, y: 5 } },
  { id: "recover_sun_shard", label: "Retrouver le Fragment Solaire", category: "search_object", ownerFactionId: "ember_cult", description: "Retrouver un fragment sacre en croisant les archives d'Ironvale et les indices venus du sanctuaire frontalier.", whyItMatters: "Le fragment conditionne un rituel de legitimite du culte et sa capacite a unifier ses fideles sur la voie des pelerins.", targetKind: "district", targetId: "ironvale:pilgrim_steps", priority: 82, progress: 62, state: "active", phases: ["Nettoyer les fausses pistes", "Croiser les reliques", "Exfiltrer le fragment"], currentPhaseIndex: 1, obstacleHints: ["guard_patrols", "false_relics", "competing_seekers"], compatibleActionIds: ["investigate", "sanctify_site"], requiredAnchorType: "temple", onSuccess: [successOpportunity("investigation_lead", 78, ["artefact", "rite"]), signal("religious", 66, ["fragment", "eclat_solaire"])], onFailure: [failureTension("religious", 57, ["artefact", "panique"])], tags: ["artefact", "religion", "secret"], zoneIds: ["ironvale:pilgrim_steps", "dawnwatch:sanctuary", "ashen_hills", "pilgrim_way"], anchorCell: { x: 10, y: 4 } },
  { id: "expand_blackmail_racket", label: "Etendre le Racket de Chantage", category: "acquire_resource", ownerFactionId: "red_knives", description: "Installer un racket stable sur les quais et les cours de transbordement pour financer les relais criminels.", whyItMatters: "Le reseau a besoin de liquidites, de caches et d'informateurs pour survivre face a la garde.", targetKind: "district", targetId: "stoneharbor:harbor", priority: 62, progress: 44, state: "active", phases: ["Tester les extorsions", "Corrompre les chargeurs", "Institutionnaliser le prelevement"], currentPhaseIndex: 1, obstacleHints: ["watch_presence", "merchant_resistance", "dock_rumors"], compatibleActionIds: ["extort"], requiredAnchorType: "safehouse", onSuccess: [successOpportunity("weak_control", 64, ["criminel", "quais"]), signal("market", 58, ["racket", "peur"])], onFailure: [failureTension("criminal", 55, ["stoneharbor", "repression"])], tags: ["criminel", "peur", "quais"], zoneIds: ["stoneharbor:harbor", "coastmarch"], anchorCell: { x: 5, y: 7 } },
  { id: "stabilize_grain_flow", label: "Stabiliser le Flux de Grain", category: "open_route", ownerFactionId: "harbor_league", description: "Maintenir le flux de grain entre Briarford, Ironvale et Stoneharbor malgre la boue, les taxes et la contrebande.", whyItMatters: "Le western_reach garde son poids politique tant que Stoneharbor reste approvisionnee par les plaines orientales.", targetKind: "route", targetId: "south_grain_route", priority: 70, progress: 68, state: "active", phases: ["Assurer les stocks", "Escalader les escortes", "Normaliser les passages"], currentPhaseIndex: 1, obstacleHints: ["seasonal_mud", "smuggler_tithes", "wagon_delays"], compatibleActionIds: ["secure_route", "escort_convoy"], requiredAnchorType: "warehouse", onSuccess: [successOpportunity("scarcity_trade", 68, ["grain", "approvisionnement"]), signal("market", 44, ["grain", "convoi"])], onFailure: [failureTension("commercial", 52, ["grain", "penurie"])], tags: ["commerce", "approvisionnement", "grain"], zoneIds: ["south_grain_route", "briarford", "stoneharbor", "green_plains", "coastmarch", "ashen_hills"], anchorCell: { x: 10, y: 8 } },
  { id: "recruit_frontier_informants", label: "Recruter des Informateurs Frontaliers", category: "recruit_agents", ownerFactionId: "red_knives", description: "Retourner des guetteurs aux portes de Dawnwatch pour fissurer le controle oriental sans guerre ouverte.", whyItMatters: "Le reseau veut survivre a la repression en achetant de l'alerte prealable et des couloirs de fuite.", targetKind: "district", targetId: "dawnwatch:gate_district", priority: 84, progress: 38, state: "active", phases: ["Identifier les familles poreuses", "Fixer les paiements", "Rendre les signaux fiables"], currentPhaseIndex: 1, obstacleHints: ["loyalist_families", "guard_raids", "thin_cover"], compatibleActionIds: ["recruit"], requiredAnchorType: "contact", onSuccess: [successOpportunity("investigation_lead", 59, ["frontalier", "informateurs"]), signal("institutional", 31, ["nouveaux_visages", "porte"])], onFailure: [failureTension("control_conflict", 49, ["frontalier", "purge"])], tags: ["criminel", "reseau", "frontalier"], zoneIds: ["dawnwatch:gate_district", "frontier_marches"], anchorCell: { x: 15, y: 5 } },
  { id: "hold_frontier_supply_line", label: "Tenir la Ligne de Ravitaillement Frontaliere", category: "open_route", ownerFactionId: "dawn_guard", description: "Maintenir une piste secondaire praticable entre Green Plains et Dawnwatch pour eviter l'isolement des Marches.", whyItMatters: "Cette ligne de secours protege le front lorsque la grande route devient trop couteuse a tenir.", targetKind: "route", targetId: "frontier_supply_track", priority: 74, progress: 34, state: "active", phases: ["Baliser la piste", "Creer des haltes sures", "Regulariser les rotations"], currentPhaseIndex: 1, obstacleHints: ["mud", "ambush_cells", "thin_escorts"], compatibleActionIds: ["secure_route", "escort_convoy"], requiredAnchorType: "outpost", onSuccess: [successOpportunity("escort_needed", 62, ["frontalier", "approvisionnement"]), signal("military", 36, ["train_mules", "route"])], onFailure: [failureTension("mobility_risk", 54, ["piste_ravitaillement_frontaliere", "retard"])], tags: ["route", "approvisionnement", "frontalier"], zoneIds: ["frontier_supply_track", "briarford", "dawnwatch", "green_plains", "frontier_marches"], anchorCell: { x: 13, y: 7 } },
  { id: "assert_western_customs", label: "Affirmer la Douane Occidentale", category: "open_route", ownerFactionId: "harbor_league", description: "Transformer la douane de Stoneharbor en verrou logistique sur la voie cotiere, pour filtrer les flux venant de Briarford et casser la contrebande.", whyItMatters: "Le controle des taxes donne a la Ligue un levier direct sur les convois, les relais et les marges politiques.", targetKind: "route", targetId: "coast_trade_way", priority: 72, progress: 41, state: "active", phases: ["Refaire les registres", "Serrer les inspections", "Imposer une doctrine fiscale"], currentPhaseIndex: 1, obstacleHints: ["smuggler_pressure", "weak_clerks", "shared_route_dependence"], compatibleActionIds: ["secure_route", "escort_convoy"], requiredAnchorType: "warehouse", onSuccess: [successOpportunity("weak_control", 57, ["douane", "taxe"]), signal("institutional", 38, ["taxe", "inspection"])], onFailure: [failureTension("political", 46, ["douane", "litige"])], tags: ["commerce", "politique", "capitale"], zoneIds: ["coast_trade_way", "stoneharbor:custom_house", "coastmarch"], anchorCell: { x: 5, y: 6 } },
  { id: "secure_dawnwatch_gate", label: "Securiser la Porte de Dawnwatch", category: "take_control_place", ownerFactionId: "dawn_guard", description: "Durcir les controles autour de Dawnwatch pour empecher infiltrations, rumeurs hostiles et contrebande de frontiere.", whyItMatters: "La capitale orientale doit rester le point d'ancrage politique du Compact des Marches sur ses deux regions.", targetKind: "district", targetId: "dawnwatch:gate_district", priority: 71, progress: 34, state: "active", phases: ["Cartographier les passages", "Renforcer la porte", "Transformer le quartier en filtre permanent"], currentPhaseIndex: 1, obstacleHints: ["overstretched_patrols", "hidden_informants", "route_dependency"], compatibleActionIds: ["patrol"], requiredAnchorType: "outpost", onSuccess: [successOpportunity("weak_control", 61, ["porte", "securite"]), signal("military", 47, ["porte", "repression"])], onFailure: [failureTension("political", 51, ["dawnwatch", "panique"])], tags: ["militaire", "capitale", "politique"], zoneIds: ["dawnwatch:gate_district", "frontier_marches"], anchorCell: { x: 14, y: 4 } }
];

layout.simulation.mobileActors = [
  { id: "grain_convoy", label: "Convoi de Grain du Delta", type: "caravan", color: "#7cb86a", ownerFactionId: "harbor_league", positionKind: "cell", positionCell: { x: 11, y: 9 }, destinationKind: "city", destinationId: "stoneharbor", populationProfile: population([{ groupId: "humains_des_plaines", weight: 58, role: "dominant" }, { groupId: "halfelins_riverains", weight: 24, role: "minority" }, { groupId: "charretiers_libres", weight: 18, role: "outsider" }], "humains_des_plaines"), itineraryMode: "locked", itineraryRouteIds: ["coast_trade_way"], travelMode: "road", speed: 4, security: 42, fatigue: 16, cargo: 70, headcount: 24, resources: 22, objectiveIds: ["stabilize_grain_flow", "assert_western_customs"], interactionTags: ["commerce", "escorte", "approvisionnement"], simulationLevel: "active" },
  { id: "frontier_patrol", label: "Patrouille de la Porte Est", type: "patrol_column", color: "#6d98e2", ownerFactionId: "dawn_guard", positionKind: "cell", positionCell: { x: 14, y: 4 }, destinationKind: "city", destinationId: "stoneharbor", populationProfile: population([{ groupId: "soldats_de_metier", weight: 72, role: "dominant" }, { groupId: "humains_des_marches", weight: 28, role: "minority" }], "soldats_de_metier"), itineraryMode: "locked", itineraryRouteIds: ["amber_road"], travelMode: "road", speed: 5, security: 63, fatigue: 18, cargo: 20, headcount: 32, resources: 18, objectiveIds: ["secure_amber_road", "secure_dawnwatch_gate"], interactionTags: ["militaire", "escorte", "inspection", "securite_capitale"], simulationLevel: "active" },
  { id: "pilgrim_column", label: "Colonne des Cendres Errantes", type: "pilgrims", color: "#d1b36e", ownerFactionId: "ember_cult", positionKind: "cell", positionCell: { x: 14, y: 4 }, destinationKind: "city", destinationId: "stoneharbor", populationProfile: population([{ groupId: "pelerins_du_feu", weight: 67, role: "dominant" }, { groupId: "humains_des_collines", weight: 33, role: "minority" }], "pelerins_du_feu"), itineraryMode: "locked", itineraryRouteIds: ["pilgrims_path"], travelMode: "road", speed: 3, security: 28, fatigue: 12, cargo: 16, headcount: 22, resources: 14, objectiveIds: ["recover_sun_shard"], interactionTags: ["religion", "rituel", "rumeur"], simulationLevel: "summary" },
  { id: "smuggler_train", label: "Convoi de Contrebandiers de l'Ecume", type: "smugglers", color: "#cb7c62", ownerFactionId: "red_knives", positionKind: "cell", positionCell: { x: 4, y: 7 }, destinationKind: "city", destinationId: "briarford", populationProfile: population([{ groupId: "etrangers_de_route", weight: 46, role: "dominant" }, { groupId: "halfelins_cotiers", weight: 29, role: "minority" }, { groupId: "humains_occident", weight: 25, role: "outsider" }], "etrangers_de_route"), itineraryMode: "locked", itineraryRouteIds: ["coast_trade_way"], travelMode: "road", speed: 4, security: 24, fatigue: 20, cargo: 44, headcount: 14, resources: 19, objectiveIds: ["expand_blackmail_racket", "recruit_frontier_informants"], interactionTags: ["criminel", "contrebande", "embuscade", "frontalier"], simulationLevel: "active" },
  { id: "supply_mule_train", label: "Train de Mules de la Frontiere", type: "supply_column", color: "#8fb58d", ownerFactionId: "dawn_guard", positionKind: "cell", positionCell: { x: 11, y: 9 }, destinationKind: "city", destinationId: "dawnwatch", populationProfile: population([{ groupId: "humains_des_marches", weight: 51, role: "dominant" }, { groupId: "soldats_de_metier", weight: 32, role: "elite" }, { groupId: "charretiers_libres", weight: 17, role: "outsider" }], "humains_des_marches"), itineraryMode: "locked", itineraryRouteIds: ["frontier_supply_track"], travelMode: "road", speed: 3, security: 34, fatigue: 22, cargo: 58, headcount: 18, resources: 16, objectiveIds: ["hold_frontier_supply_line", "secure_dawnwatch_gate"], interactionTags: ["approvisionnement", "militaire", "escorte", "embuscade"], simulationLevel: "active" },
  { id: "customs_riders", label: "Cavaliers des Douanes", type: "inspection_riders", color: "#8aa7dc", ownerFactionId: "harbor_league", positionKind: "cell", positionCell: { x: 4, y: 7 }, destinationKind: "city", destinationId: "briarford", populationProfile: population([{ groupId: "humains_occident", weight: 62, role: "dominant" }, { groupId: "nains_artisans", weight: 18, role: "elite" }, { groupId: "etrangers_de_route", weight: 20, role: "outsider" }], "humains_occident"), itineraryMode: "locked", itineraryRouteIds: ["coast_trade_way"], travelMode: "road", speed: 5, security: 46, fatigue: 14, cargo: 12, headcount: 12, resources: 21, objectiveIds: ["assert_western_customs", "stabilize_grain_flow"], interactionTags: ["taxe", "inspection", "escorte"], simulationLevel: "active" }
];

writeJson(sandboxPath, layout);
console.log(`Updated ${sandboxPath}`);

