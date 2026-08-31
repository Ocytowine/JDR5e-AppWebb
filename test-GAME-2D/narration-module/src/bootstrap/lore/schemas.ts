const loreId = {
  type: "string",
  pattern: "^[a-z][a-z0-9_]{2,127}$"
} as const;

const referenceId = {
  type: "string",
  pattern: "^[a-z][a-z0-9._:-]{2,127}$"
} as const;

const nonEmptyText = { type: "string", minLength: 1, maxLength: 8_192 } as const;
const shortText = { type: "string", minLength: 1, maxLength: 512 } as const;
const nullableNonNegativeInteger = {
  anyOf: [
    { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    { type: "null" }
  ]
} as const;

function uniqueStringArray(items: object, maximum = 256) {
  return {
    type: "array",
    items,
    uniqueItems: true,
    maxItems: maximum
  } as const;
}

const shortTextArray = uniqueStringArray(shortText);
const referenceArray = uniqueStringArray(referenceId);

export const loreInformationBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "niveau", "texte", "sujets", "entites_liees"],
  properties: {
    id: loreId,
    niveau: {
      type: "string",
      enum: ["COMMUN", "LOCAL", "SPECIALISE", "RESTREINT", "MJ_SECRET"]
    },
    texte: nonEmptyText,
    sujets: shortTextArray,
    entites_liees: referenceArray
  }
} as const;

const informationArray = {
  type: "array",
  items: loreInformationBlockSchema,
  maxItems: 1_024
} as const;

const declaredRelationsArray = {
  type: "array",
  maxItems: 256,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["relation", "cible", "type_cible", "force"],
    properties: {
      relation: loreId,
      cible: referenceId,
      type_cible: { anyOf: [shortText, { type: "null" }] },
      force: { type: "string", enum: ["REQUIRED", "OPTIONAL"] }
    }
  }
} as const;

const declaredPropertiesArray = {
  type: "array",
  maxItems: 256,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["propriete", "libelle", "valeur", "niveau"],
    properties: {
      propriete: loreId,
      libelle: shortText,
      valeur: { anyOf: [nonEmptyText, { type: "null" }] },
      niveau: { type: "string", enum: ["COMMUN", "LOCAL", "SPECIALISE", "RESTREINT", "MJ_SECRET"] },
      creation: { type: "string", enum: ["INTERDITE", "TEXTE", "IDENTITE"] },
      propriete_role_identite: { anyOf: [loreId, { type: "null" }] }
    },
    allOf: [
      {
        if: { required: ["creation"], properties: { creation: { enum: ["TEXTE", "IDENTITE"] } } },
        then: { properties: { valeur: { type: "null" } } }
      },
      {
        if: { required: ["creation"], properties: { creation: { const: "IDENTITE" } } },
        then: { required: ["propriete_role_identite"], properties: { propriete_role_identite: loreId } }
      }
    ]
  }
} as const;

const percentage = { type: "integer", minimum: 0, maximum: 100 } as const;

const commonRequired = [
  "schema_version",
  "type",
  "id",
  "nom",
  "aliases",
  "resume",
  "mots_cles",
  "informations"
] as const;

const commonProperties = {
  schema_version: { type: "integer", const: 1 },
  id: loreId,
  nom: shortText,
  aliases: shortTextArray,
  resume: { type: "string", minLength: 1, maxLength: 4_096 },
  mots_cles: shortTextArray,
  informations: informationArray,
  relations_declarees: declaredRelationsArray,
  proprietes_factuelles: declaredPropertiesArray
} as const;

export const weightedRoleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["role", "poids"],
  properties: {
    role: shortText,
    poids: { type: "integer", minimum: 0, maximum: 1_000 }
  }
} as const;

export const weightedSpeciesSchema = {
  type: "object",
  additionalProperties: false,
  required: ["espece", "poids"],
  properties: {
    espece: referenceId,
    poids: { type: "integer", minimum: 0, maximum: 1_000 }
  }
} as const;

export const presenceProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["roles_probables", "roles_rares", "ponderation_especes"],
  properties: {
    roles_probables: { type: "array", items: weightedRoleSchema, maxItems: 256 },
    roles_rares: { type: "array", items: weightedRoleSchema, maxItems: 256 },
    ponderation_especes: { type: "array", items: weightedSpeciesSchema, maxItems: 256 }
  }
} as const;

export const languageProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["langues_communes"],
  properties: {
    langues_communes: referenceArray,
    langues_commerciales: referenceArray,
    langues_rares: referenceArray,
    langues_scripturales: referenceArray
  }
} as const;

export const populationProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["especes_dominantes", "especes_minoritaires", "presence_etrangere", "roles_communs"],
  properties: {
    especes_dominantes: referenceArray,
    especes_minoritaires: referenceArray,
    especes_rares: referenceArray,
    presence_etrangere: shortText,
    roles_communs: shortTextArray
  }
} as const;

export const socialProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["culture_autorite", "hospitalite_envers_etrangers", "visibilite_violence"],
  properties: {
    culture_autorite: shortText,
    hospitalite_envers_etrangers: shortText,
    visibilite_violence: shortText,
    presence_forces_de_l_ordre: shortText,
    chaine_autorite: shortTextArray
  }
} as const;

export const authorityProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["autorite_responsable", "style_controle", "force_privee_toleree"],
  properties: {
    autorite_responsable: shortText,
    style_controle: shortText,
    force_privee_toleree: shortText,
    points_de_controle: shortTextArray,
    attentes_de_langage: shortTextArray,
    chaine_de_commandement: shortTextArray,
    faction_operationnelle: shortText
  }
} as const;

export const kingdomLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: commonRequired,
  properties: { ...commonProperties, type: { type: "string", const: "royaume" } }
} as const;

export const territoryLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: commonRequired,
  properties: { ...commonProperties, type: { type: "string", const: "territoire" } }
} as const;

export const regionLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...commonRequired, "territoire", "type_region", "climat", "relief", "risques_naturels",
    "population_estimee", "habitats_principaux", "peuples_present", "ressources", "activites",
    "autorite_locale", "niveau_controle", "zones_de_loi_faible", "villes_principales",
    "lieux_remarquables", "factions_actives"
  ],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "region" },
    territoire: referenceId,
    type_region: shortText,
    climat: shortText,
    relief: shortTextArray,
    risques_naturels: shortTextArray,
    population_estimee: shortText,
    habitats_principaux: shortTextArray,
    peuples_present: shortTextArray,
    ressources: shortTextArray,
    activites: shortTextArray,
    autorite_locale: { anyOf: [referenceId, { type: "null" }] },
    niveau_controle: shortText,
    zones_de_loi_faible: shortTextArray,
    villes_principales: referenceArray,
    lieux_remarquables: referenceArray,
    factions_actives: referenceArray
  }
} as const;

export const cityLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...commonRequired, "territoire", "region", "type_ville", "origine", "type_gouvernance",
    "siege_pouvoir", "population_totale", "composition_population", "niveau_vie",
    "niveau_criminalite", "stabilite_sociale", "corruption", "tension_ethnique", "climat",
    "particularites_env", "quartiers", "batiments_importants", "factions_presentes",
    "religions_principales", "liaisons", "profil_presence", "profil_langues",
    "profil_population", "profil_social"
  ],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "ville" },
    territoire: referenceId,
    region: referenceId,
    type_ville: shortText,
    origine: shortText,
    type_gouvernance: shortText,
    siege_pouvoir: referenceId,
    population_totale: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    composition_population: shortTextArray,
    niveau_vie: shortText,
    niveau_criminalite: percentage,
    stabilite_sociale: shortText,
    corruption: percentage,
    tension_ethnique: percentage,
    climat: shortText,
    particularites_env: shortTextArray,
    quartiers: referenceArray,
    batiments_importants: referenceArray,
    factions_presentes: referenceArray,
    religions_principales: referenceArray,
    liaisons: referenceArray,
    profil_presence: presenceProfileSchema,
    profil_langues: languageProfileSchema,
    profil_population: populationProfileSchema,
    profil_social: socialProfileSchema
  }
} as const;

export const districtLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [...commonRequired, "territoire", "region", "ville", "profil_presence"],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "quartier" },
    territoire: referenceId,
    region: referenceId,
    ville: referenceId,
    profil_presence: presenceProfileSchema,
    profil_langues: languageProfileSchema,
    profil_population: populationProfileSchema,
    profil_social: socialProfileSchema,
    profil_autorite: authorityProfileSchema
  }
} as const;

export const buildingLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...commonRequired, "territoire", "region", "ville", "quartier", "type_batiment",
    "fonction_principale", "importance_strategique", "proprietaire_faction",
    "proprietaire_principal", "acces", "etat_general", "niveau_securite", "rumeurs",
    "lieux_connectes", "profil_presence"
  ],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "batiment" },
    territoire: referenceId,
    region: referenceId,
    ville: referenceId,
    quartier: referenceId,
    type_batiment: shortText,
    fonction_principale: shortTextArray,
    importance_strategique: percentage,
    proprietaire_faction: referenceId,
    proprietaire_principal: shortText,
    acces: shortText,
    etat_general: shortText,
    niveau_securite: percentage,
    rumeurs: shortTextArray,
    lieux_connectes: referenceArray,
    factions_residentes: referenceArray,
    profil_presence: presenceProfileSchema,
    profil_langues: languageProfileSchema,
    profil_population: populationProfileSchema,
    profil_social: socialProfileSchema,
    profil_autorite: authorityProfileSchema
  }
} as const;

export const factionOperationsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["command_style", "discipline_level", "reporting_chain"],
  properties: {
    command_style: shortText,
    discipline_level: shortText,
    reporting_chain: shortText,
    patrol_pattern: shortText,
    workflow_rhythm: shortText
  }
} as const;

export const factionLanguageProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["common_languages"],
  properties: {
    common_languages: referenceArray,
    command_languages: referenceArray,
    tolerated_languages: referenceArray,
    scholarly_languages: referenceArray,
    script_languages: referenceArray,
    trade_languages: referenceArray
  }
} as const;

export const officialAttireSchema = {
  type: "object",
  additionalProperties: false,
  required: ["base_layers", "outer_markers", "service_variants"],
  properties: {
    base_layers: shortTextArray,
    outer_markers: shortTextArray,
    service_variants: shortTextArray
  }
} as const;

export const factionLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...commonRequired, "faction_category", "territoire", "region", "ville", "autorite_tutelle",
    "siege_pouvoir", "role_dans_la_ville", "ideologie", "traits_identifiants",
    "signe_distinctif", "grade_system", "equipement_de_base", "fonctionnement", "language_profile"
  ],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "faction" },
    faction_category: shortText,
    territoire: referenceId,
    region: referenceId,
    ville: referenceId,
    autorite_tutelle: referenceId,
    siege_pouvoir: referenceId,
    role_dans_la_ville: shortTextArray,
    ideologie: shortTextArray,
    traits_identifiants: shortTextArray,
    signe_distinctif: shortTextArray,
    grade_system: shortTextArray,
    equipement_de_base: shortTextArray,
    fonctionnement: factionOperationsSchema,
    language_profile: factionLanguageProfileSchema,
    tenue_officielle: officialAttireSchema,
    uniforme_officiel: officialAttireSchema
  }
} as const;

export const metaAxisSchema = {
  type: "object", additionalProperties: false, required: ["theme", "points"],
  properties: { theme: shortText, points: shortTextArray }
} as const;
export const metaPantheonEntrySchema = {
  type: "object", additionalProperties: false, required: ["nom", "domaine", "posture", "relations"],
  properties: { nom: shortText, domaine: shortText, posture: shortText, relations: shortText }
} as const;
export const metaPeopleOriginSchema = {
  type: "object", additionalProperties: false, required: ["nom", "traits", "zones"],
  properties: { nom: shortText, traits: shortText, zones: shortText }
} as const;
export const metaStructuresSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pantheon", "cercles_ou_piliers", "factions_globales", "peuples_et_origines"],
  properties: {
    pantheon: { type: "array", items: metaPantheonEntrySchema, maxItems: 256 },
    cercles_ou_piliers: { type: "array", maxItems: 0 },
    factions_globales: { type: "array", maxItems: 0 },
    peuples_et_origines: { type: "array", items: metaPeopleOriginSchema, maxItems: 256 }
  }
} as const;
export const metaNarrativeRulesSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ton", "violence", "niveau_magie", "consequences", "tabous_narratifs", "signaux_esthetiques"],
  properties: {
    ton: shortText, violence: shortText, niveau_magie: shortText, consequences: shortText,
    tabous_narratifs: shortTextArray, signaux_esthetiques: shortTextArray
  }
} as const;
export const metaHistoricalPeriodSchema = {
  type: "object", additionalProperties: false, required: ["nom", "evenements_majeurs", "legats"],
  properties: { nom: shortText, evenements_majeurs: shortTextArray, legats: nonEmptyText }
} as const;
export const metaHistoricalAnchorsSchema = {
  type: "object", additionalProperties: false, required: ["periodes", "chronologie_simplifiee"],
  properties: {
    periodes: { type: "array", items: metaHistoricalPeriodSchema, maxItems: 256 },
    chronologie_simplifiee: shortTextArray
  }
} as const;
export const metaLexiconEntrySchema = {
  type: "object", additionalProperties: false, required: ["terme", "definition", "variations"],
  properties: { terme: shortText, definition: nonEmptyText, variations: shortTextArray }
} as const;
export const metaLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...commonRequired, "portee", "axes_fondamentaux", "structures_clefs",
    "regles_narratives", "ancrages_historiques", "lexique_termes"
  ],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "meta" },
    portee: shortText,
    axes_fondamentaux: { type: "array", items: metaAxisSchema, maxItems: 256 },
    structures_clefs: metaStructuresSchema,
    regles_narratives: metaNarrativeRulesSchema,
    ancrages_historiques: metaHistoricalAnchorsSchema,
    lexique_termes: { type: "array", items: metaLexiconEntrySchema, maxItems: 1_024 }
  }
} as const;

export const mechanicalCatalogReferenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["entry_kind", "entry_id"],
  properties: {
    entry_kind: { type: "string", enum: ["race", "creature"] },
    entry_id: referenceId
  }
} as const;

export const speciesBiologySchema = {
  type: "object",
  additionalProperties: false,
  required: ["maturite", "esperance_vie", "particularites"],
  properties: {
    maturite: nullableNonNegativeInteger,
    esperance_vie: nullableNonNegativeInteger,
    particularites: shortTextArray
  }
} as const;

export const speciesRegionalPresenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["region", "importance"],
  properties: {
    region: referenceId,
    importance: { type: "string", enum: ["RARE", "MINORITAIRE", "NOTABLE", "MAJEURE"] }
  }
} as const;

export const speciesLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...commonRequired,
    "jouable",
    "rencontrable",
    "classification",
    "catalogue_mecanique",
    "apparence_observable",
    "biologie",
    "langues",
    "cultures_associees",
    "regions_presence"
  ],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "espece" },
    jouable: { type: "boolean" },
    rencontrable: { type: "boolean" },
    classification: shortText,
    catalogue_mecanique: {
      anyOf: [mechanicalCatalogReferenceSchema, { type: "null" }]
    },
    apparence_observable: shortTextArray,
    biologie: speciesBiologySchema,
    langues: referenceArray,
    cultures_associees: referenceArray,
    regions_presence: {
      type: "array",
      items: speciesRegionalPresenceSchema,
      maxItems: 256
    }
  }
} as const;

export const cultureLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...commonRequired,
    "especes_associees",
    "zones_associees",
    "langues",
    "valeurs",
    "coutumes",
    "organisation_sociale",
    "esthetique",
    "relations_factions"
  ],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "culture" },
    especes_associees: referenceArray,
    zones_associees: referenceArray,
    langues: referenceArray,
    valeurs: shortTextArray,
    coutumes: shortTextArray,
    organisation_sociale: shortTextArray,
    esthetique: shortTextArray,
    relations_factions: referenceArray
  }
} as const;

export const npcExpressionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["registre", "rythme", "habitudes"],
  properties: {
    registre: shortText,
    rythme: shortText,
    habitudes: shortTextArray
  }
} as const;

export const npcInitialRelationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pnj", "relation", "details"],
  properties: {
    pnj: referenceId,
    relation: shortText,
    details: nonEmptyText
  }
} as const;

export const npcInitialKnowledgeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["entity", "information_id"],
  properties: {
    entity: referenceId,
    information_id: loreId
  }
} as const;

export const npcInitialBeliefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sujet", "texte", "confiance"],
  properties: {
    sujet: shortText,
    texte: nonEmptyText,
    confiance: { type: "integer", minimum: 0, maximum: 100 }
  }
} as const;

export const npcLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...commonRequired,
    "espece",
    "culture",
    "role_public",
    "lieu_initial",
    "factions",
    "apparence",
    "expression",
    "motivations_initiales",
    "objectifs_initiaux",
    "relations_initiales",
    "connaissances_initiales",
    "croyances_initiales",
    "importance"
  ],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "pnj" },
    espece: referenceId,
    culture: { anyOf: [referenceId, { type: "null" }] },
    role_public: shortText,
    lieu_initial: referenceId,
    factions: referenceArray,
    apparence: shortTextArray,
    expression: npcExpressionSchema,
    motivations_initiales: shortTextArray,
    objectifs_initiaux: shortTextArray,
    relations_initiales: {
      type: "array",
      items: npcInitialRelationSchema,
      maxItems: 256
    },
    connaissances_initiales: {
      type: "array",
      items: npcInitialKnowledgeSchema,
      maxItems: 1_024
    },
    croyances_initiales: {
      type: "array",
      items: npcInitialBeliefSchema,
      maxItems: 1_024
    },
    importance: { type: "string", enum: ["FIGURANT", "SECONDAIRE", "MAJEUR"] }
  }
} as const;

export const historicalDateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["calendar_id", "annee", "mois", "jour", "precision"],
  properties: {
    calendar_id: referenceId,
    annee: {
      anyOf: [
        { type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER },
        { type: "null" }
      ]
    },
    mois: { anyOf: [{ type: "integer", minimum: 1, maximum: 12 }, { type: "null" }] },
    jour: { anyOf: [{ type: "integer", minimum: 1, maximum: 31 }, { type: "null" }] },
    precision: { type: "string", enum: ["JOUR", "MOIS", "ANNEE", "PERIODE", "INCONNUE"] }
  }
} as const;

export const historicalPeriodLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...commonRequired,
    "debut",
    "fin",
    "periode_parente",
    "territoires",
    "cultures",
    "caracteristiques",
    "evenements_majeurs"
  ],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "periode_historique" },
    debut: historicalDateSchema,
    fin: { anyOf: [historicalDateSchema, { type: "null" }] },
    periode_parente: { anyOf: [referenceId, { type: "null" }] },
    territoires: referenceArray,
    cultures: referenceArray,
    caracteristiques: shortTextArray,
    evenements_majeurs: referenceArray
  }
} as const;

export const historicalCauseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["evenement", "certitude"],
  properties: {
    evenement: referenceId,
    certitude: { type: "string", enum: ["ETABLIE", "CONTESTEE", "LEGENDAIRE"] }
  }
} as const;

export const historicalEventLoreAuthorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...commonRequired,
    "periode",
    "date",
    "lieux",
    "participants",
    "causes",
    "consequences"
  ],
  properties: {
    ...commonProperties,
    type: { type: "string", const: "evenement_historique" },
    periode: { anyOf: [referenceId, { type: "null" }] },
    date: historicalDateSchema,
    lieux: referenceArray,
    participants: referenceArray,
    causes: {
      type: "array",
      items: historicalCauseSchema,
      maxItems: 256
    },
    consequences: shortTextArray
  }
} as const;

export const loreAuthorEntitySchema = {
  oneOf: [
    kingdomLoreAuthorSchema,
    territoryLoreAuthorSchema,
    regionLoreAuthorSchema,
    cityLoreAuthorSchema,
    districtLoreAuthorSchema,
    buildingLoreAuthorSchema,
    factionLoreAuthorSchema,
    metaLoreAuthorSchema,
    speciesLoreAuthorSchema,
    cultureLoreAuthorSchema,
    npcLoreAuthorSchema,
    historicalPeriodLoreAuthorSchema,
    historicalEventLoreAuthorSchema
  ]
} as const;
