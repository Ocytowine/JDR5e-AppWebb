import type { JsonValue } from "../../core/contracts/types";

export type LoreEntityTypeV1 =
  | "royaume"
  | "territoire"
  | "region"
  | "ville"
  | "quartier"
  | "batiment"
  | "faction"
  | "meta"
  | "espece"
  | "culture"
  | "pnj"
  | "periode_historique"
  | "evenement_historique";

export type LoreKnowledgeLevelV1 =
  | "COMMUN"
  | "LOCAL"
  | "SPECIALISE"
  | "RESTREINT"
  | "MJ_SECRET";

export interface LoreInformationBlockV1 {
  id: string;
  niveau: LoreKnowledgeLevelV1;
  texte: string;
  sujets: string[];
  entites_liees: string[];
}

export interface LoreAuthorEntityBaseV1<Type extends LoreEntityTypeV1> {
  schema_version: 1;
  type: Type;
  id: string;
  nom: string;
  aliases: string[];
  resume: string;
  mots_cles: string[];
  informations: LoreInformationBlockV1[];
}

export interface MechanicalCatalogReferenceV1 {
  entry_kind: "race" | "creature";
  entry_id: string;
}

export interface SpeciesBiologyV1 {
  maturite: number | null;
  esperance_vie: number | null;
  particularites: string[];
}

export interface SpeciesRegionalPresenceV1 {
  region: string;
  importance: "RARE" | "MINORITAIRE" | "NOTABLE" | "MAJEURE";
}

export interface SpeciesLoreAuthorV1 extends LoreAuthorEntityBaseV1<"espece"> {
  jouable: boolean;
  rencontrable: boolean;
  classification: string;
  catalogue_mecanique: MechanicalCatalogReferenceV1 | null;
  apparence_observable: string[];
  biologie: SpeciesBiologyV1;
  langues: string[];
  cultures_associees: string[];
  regions_presence: SpeciesRegionalPresenceV1[];
}

export interface CultureLoreAuthorV1 extends LoreAuthorEntityBaseV1<"culture"> {
  especes_associees: string[];
  zones_associees: string[];
  langues: string[];
  valeurs: string[];
  coutumes: string[];
  organisation_sociale: string[];
  esthetique: string[];
  relations_factions: string[];
}

export interface NpcExpressionV1 {
  registre: string;
  rythme: string;
  habitudes: string[];
}

export interface NpcInitialRelationV1 {
  pnj: string;
  relation: string;
  details: string;
}

export interface NpcInitialKnowledgeV1 {
  entity: string;
  information_id: string;
}

export interface NpcInitialBeliefV1 {
  sujet: string;
  texte: string;
  confiance: number;
}

export interface NpcLoreAuthorV1 extends LoreAuthorEntityBaseV1<"pnj"> {
  espece: string;
  culture: string | null;
  role_public: string;
  lieu_initial: string;
  factions: string[];
  apparence: string[];
  expression: NpcExpressionV1;
  motivations_initiales: string[];
  objectifs_initiaux: string[];
  relations_initiales: NpcInitialRelationV1[];
  connaissances_initiales: NpcInitialKnowledgeV1[];
  croyances_initiales: NpcInitialBeliefV1[];
  importance: "FIGURANT" | "SECONDAIRE" | "MAJEUR";
}

export interface HistoricalDateV1 {
  calendar_id: string;
  annee: number | null;
  mois: number | null;
  jour: number | null;
  precision: "JOUR" | "MOIS" | "ANNEE" | "PERIODE" | "INCONNUE";
}

export interface HistoricalPeriodLoreAuthorV1 extends LoreAuthorEntityBaseV1<"periode_historique"> {
  debut: HistoricalDateV1;
  fin: HistoricalDateV1 | null;
  periode_parente: string | null;
  territoires: string[];
  cultures: string[];
  caracteristiques: string[];
  evenements_majeurs: string[];
}

export interface HistoricalCauseV1 {
  evenement: string;
  certitude: "ETABLIE" | "CONTESTEE" | "LEGENDAIRE";
}

export interface HistoricalEventLoreAuthorV1 extends LoreAuthorEntityBaseV1<"evenement_historique"> {
  periode: string | null;
  date: HistoricalDateV1;
  lieux: string[];
  participants: string[];
  causes: HistoricalCauseV1[];
  consequences: string[];
}

export interface WeightedRoleV1 {
  role: string;
  poids: number;
}

export interface WeightedSpeciesV1 {
  espece: string;
  poids: number;
}

export interface PresenceProfileV1 {
  roles_probables: WeightedRoleV1[];
  roles_rares: WeightedRoleV1[];
  ponderation_especes: WeightedSpeciesV1[];
}

export interface LanguageProfileV1 {
  langues_communes: string[];
  langues_commerciales?: string[];
  langues_rares?: string[];
  langues_scripturales?: string[];
}

export interface PopulationProfileV1 {
  especes_dominantes: string[];
  especes_minoritaires: string[];
  especes_rares?: string[];
  presence_etrangere: string;
  roles_communs: string[];
}

export interface SocialProfileV1 {
  culture_autorite: string;
  hospitalite_envers_etrangers: string;
  visibilite_violence: string;
  presence_forces_de_l_ordre?: string;
  chaine_autorite?: string[];
}

export interface AuthorityProfileV1 {
  autorite_responsable: string;
  style_controle: string;
  force_privee_toleree: string;
  points_de_controle?: string[];
  attentes_de_langage?: string[];
  chaine_de_commandement?: string[];
  faction_operationnelle?: string;
}

export interface KingdomLoreAuthorV1 extends LoreAuthorEntityBaseV1<"royaume"> {}
export interface TerritoryLoreAuthorV1 extends LoreAuthorEntityBaseV1<"territoire"> {}

export interface RegionLoreAuthorV1 extends LoreAuthorEntityBaseV1<"region"> {
  territoire: string;
  type_region: string;
  climat: string;
  relief: string[];
  risques_naturels: string[];
  population_estimee: string;
  habitats_principaux: string[];
  peuples_present: string[];
  ressources: string[];
  activites: string[];
  autorite_locale: string | null;
  niveau_controle: string;
  zones_de_loi_faible: string[];
  villes_principales: string[];
  lieux_remarquables: string[];
  factions_actives: string[];
}

export interface CityLoreAuthorV1 extends LoreAuthorEntityBaseV1<"ville"> {
  territoire: string;
  region: string;
  type_ville: string;
  origine: string;
  type_gouvernance: string;
  siege_pouvoir: string;
  population_totale: number;
  composition_population: string[];
  niveau_vie: string;
  niveau_criminalite: number;
  stabilite_sociale: string;
  corruption: number;
  tension_ethnique: number;
  climat: string;
  particularites_env: string[];
  quartiers: string[];
  batiments_importants: string[];
  factions_presentes: string[];
  religions_principales: string[];
  liaisons: string[];
  profil_presence: PresenceProfileV1;
  profil_langues: LanguageProfileV1;
  profil_population: PopulationProfileV1;
  profil_social: SocialProfileV1;
}

export interface DistrictLoreAuthorV1 extends LoreAuthorEntityBaseV1<"quartier"> {
  territoire: string;
  region: string;
  ville: string;
  profil_presence: PresenceProfileV1;
  profil_langues?: LanguageProfileV1;
  profil_population?: PopulationProfileV1;
  profil_social?: SocialProfileV1;
  profil_autorite?: AuthorityProfileV1;
}

export interface BuildingLoreAuthorV1 extends LoreAuthorEntityBaseV1<"batiment"> {
  territoire: string;
  region: string;
  ville: string;
  quartier: string;
  type_batiment: string;
  fonction_principale: string[];
  importance_strategique: number;
  proprietaire_faction: string;
  proprietaire_principal: string;
  acces: string;
  etat_general: string;
  niveau_securite: number;
  rumeurs: string[];
  lieux_connectes: string[];
  factions_residentes?: string[];
  profil_presence: PresenceProfileV1;
  profil_langues?: LanguageProfileV1;
  profil_population?: PopulationProfileV1;
  profil_social?: SocialProfileV1;
  profil_autorite?: AuthorityProfileV1;
}

export interface FactionOperationsV1 {
  command_style: string;
  discipline_level: string;
  reporting_chain: string;
  patrol_pattern?: string;
  workflow_rhythm?: string;
}

export interface FactionLanguageProfileV1 {
  common_languages: string[];
  command_languages?: string[];
  tolerated_languages?: string[];
  scholarly_languages?: string[];
  script_languages?: string[];
  trade_languages?: string[];
}

export interface OfficialAttireV1 {
  base_layers: string[];
  outer_markers: string[];
  service_variants: string[];
}

export interface FactionLoreAuthorV1 extends LoreAuthorEntityBaseV1<"faction"> {
  faction_category: string;
  territoire: string;
  region: string;
  ville: string;
  autorite_tutelle: string;
  siege_pouvoir: string;
  role_dans_la_ville: string[];
  ideologie: string[];
  traits_identifiants: string[];
  signe_distinctif: string[];
  grade_system: string[];
  equipement_de_base: string[];
  fonctionnement: FactionOperationsV1;
  language_profile: FactionLanguageProfileV1;
  tenue_officielle?: OfficialAttireV1;
  uniforme_officiel?: OfficialAttireV1;
}

export interface MetaAxisV1 {
  theme: string;
  points: string[];
}

export interface MetaPantheonEntryV1 {
  nom: string;
  domaine: string;
  posture: string;
  relations: string;
}

export interface MetaPeopleOriginV1 {
  nom: string;
  traits: string;
  zones: string;
}

export interface MetaStructuresV1 {
  pantheon: MetaPantheonEntryV1[];
  cercles_ou_piliers: [];
  factions_globales: [];
  peuples_et_origines: MetaPeopleOriginV1[];
}

export interface MetaNarrativeRulesV1 {
  ton: string;
  violence: string;
  niveau_magie: string;
  consequences: string;
  tabous_narratifs: string[];
  signaux_esthetiques: string[];
}

export interface MetaHistoricalPeriodV1 {
  nom: string;
  evenements_majeurs: string[];
  legats: string;
}

export interface MetaHistoricalAnchorsV1 {
  periodes: MetaHistoricalPeriodV1[];
  chronologie_simplifiee: string[];
}

export interface MetaLexiconEntryV1 {
  terme: string;
  definition: string;
  variations: string[];
}

export interface MetaLoreAuthorV1 extends LoreAuthorEntityBaseV1<"meta"> {
  portee: string;
  axes_fondamentaux: MetaAxisV1[];
  structures_clefs: MetaStructuresV1;
  regles_narratives: MetaNarrativeRulesV1;
  ancrages_historiques: MetaHistoricalAnchorsV1;
  lexique_termes: MetaLexiconEntryV1[];
}

export type LoreAuthorEntityV1 =
  | KingdomLoreAuthorV1
  | TerritoryLoreAuthorV1
  | RegionLoreAuthorV1
  | CityLoreAuthorV1
  | DistrictLoreAuthorV1
  | BuildingLoreAuthorV1
  | FactionLoreAuthorV1
  | MetaLoreAuthorV1
  | SpeciesLoreAuthorV1
  | CultureLoreAuthorV1
  | NpcLoreAuthorV1
  | HistoricalPeriodLoreAuthorV1
  | HistoricalEventLoreAuthorV1;

export type Sha256Fingerprint = `sha256:${string}`;

export interface LoreProvenanceV1 {
  packageId: string;
  packageVersion: number;
  sourcePath: string;
  sourceFingerprint: Sha256Fingerprint;
}

export interface LoreRelationV1 {
  relation: string;
  targetId: string;
  targetType: string | null;
  strength: "REQUIRED" | "OPTIONAL";
}

export interface LoreEntityV1 {
  schemaVersion: 1;
  entityId: string;
  entityType: LoreEntityTypeV1;
  displayName: string;
  attributes: Record<string, JsonValue>;
  relations: LoreRelationV1[];
  searchTerms: string[];
  body: string;
  provenance: LoreProvenanceV1;
}

export interface LoreFragmentV1 {
  schemaVersion: 1;
  fragmentId: string;
  entityId: string;
  fieldPath: string;
  text: string;
  tags: string[];
  knowledgeLevel: LoreKnowledgeLevelV1;
  relatedEntityIds: string[];
  topics: string[];
  provenance: LoreProvenanceV1;
}

export interface ContentReferenceV1 {
  targetId: string;
  relation: string;
  strength: "REQUIRED" | "OPTIONAL";
}

export interface ContentEntryDescriptorV1 {
  entryId: string;
  entryKind: "LORE_ENTITY" | "GAME_CATALOG_ENTRY";
  entityType: string;
  payloadSchemaVersion: number;
  sourcePath: string;
  sourceFingerprint: Sha256Fingerprint;
  payloadFingerprint: Sha256Fingerprint;
  references: ContentReferenceV1[];
}

export interface ContentPackageManifestV1 {
  schemaVersion: 1;
  packageId: string;
  packageVersion: number;
  minimumRuntimeContract: "campaign-bootstrap/2";
  entries: ContentEntryDescriptorV1[];
  rootFingerprint: Sha256Fingerprint;
}

export type LoreCompilationDiagnosticCodeV1 =
  | "WIKI_FRONT_MATTER_MISSING"
  | "WIKI_YAML_INVALID"
  | "WIKI_SCHEMA_VERSION_UNSUPPORTED"
  | "WIKI_INVALID_VALUE"
  | "WIKI_DUPLICATE_ID"
  | "WIKI_REFERENCE_MISSING"
  | "WIKI_REFERENCE_TYPE_MISMATCH"
  | "WIKI_KNOWLEDGE_TARGET_MISSING"
  | "WIKI_SOURCE_PATH_INVALID"
  | "WIKI_BODY_UNCLASSIFIED";

export interface LoreCompilationDiagnosticV1 {
  code: LoreCompilationDiagnosticCodeV1;
  severity: "ERROR" | "WARNING";
  sourcePath: string;
  jsonPath: string;
  messageKey: string;
  details: Record<string, unknown>;
}

export interface LoreSourceInputV1 {
  sourcePath: string;
  sourceText: string;
}

export interface CompileLoreSourceOptionsV1 {
  packageId: string;
  packageVersion: number;
}

export interface CompiledLoreSourceV1 {
  author: LoreAuthorEntityV1;
  entity: LoreEntityV1;
  fragments: LoreFragmentV1[];
  descriptor: ContentEntryDescriptorV1;
  diagnostics: LoreCompilationDiagnosticV1[];
}

export type CompileLoreSourceResultV1 =
  | { ok: true; value: CompiledLoreSourceV1 }
  | { ok: false; diagnostics: LoreCompilationDiagnosticV1[] };

export interface CompileLoreCorpusOptionsV1 extends CompileLoreSourceOptionsV1 {
  catalogEntries?: ReadonlySet<string>;
}

export interface CompiledLoreCorpusV1 {
  manifest: ContentPackageManifestV1;
  entities: LoreEntityV1[];
  fragments: LoreFragmentV1[];
  diagnostics: LoreCompilationDiagnosticV1[];
}

export type CompileLoreCorpusResultV1 =
  | { ok: true; value: CompiledLoreCorpusV1 }
  | { ok: false; diagnostics: LoreCompilationDiagnosticV1[] };
