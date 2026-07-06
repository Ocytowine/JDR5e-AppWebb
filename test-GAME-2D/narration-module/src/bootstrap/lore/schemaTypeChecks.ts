import type {
  BuildingLoreAuthorV1,
  CityLoreAuthorV1,
  CultureLoreAuthorV1,
  DistrictLoreAuthorV1,
  FactionLoreAuthorV1,
  HistoricalEventLoreAuthorV1,
  HistoricalPeriodLoreAuthorV1,
  LoreInformationBlockV1,
  KingdomLoreAuthorV1,
  MetaLoreAuthorV1,
  NpcLoreAuthorV1,
  RegionLoreAuthorV1,
  SpeciesLoreAuthorV1,
  TerritoryLoreAuthorV1
} from "./types";
import {
  buildingLoreAuthorSchema,
  cityLoreAuthorSchema,
  cultureLoreAuthorSchema,
  districtLoreAuthorSchema,
  factionLoreAuthorSchema,
  historicalEventLoreAuthorSchema,
  historicalPeriodLoreAuthorSchema,
  loreInformationBlockSchema,
  kingdomLoreAuthorSchema,
  metaLoreAuthorSchema,
  npcLoreAuthorSchema,
  regionLoreAuthorSchema,
  speciesLoreAuthorSchema,
  territoryLoreAuthorSchema
} from "./schemas";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Condition extends true> = Condition;
type StringKeys<Value> = Extract<keyof Value, string>;
type RequiredKeys<Value> = {
  [Key in keyof Value]-?: object extends Pick<Value, Key> ? never : Key;
}[keyof Value];
type SchemaPropertyKeys<Schema> = Schema extends { properties: infer Properties }
  ? Extract<keyof Properties, string>
  : never;
type SchemaRequiredKeys<Schema> = Schema extends { required: readonly (infer Key)[] }
  ? Extract<Key, string>
  : never;
type ObjectContractMatches<Value, Schema> = Equal<
  StringKeys<Value>,
  SchemaPropertyKeys<Schema>
> extends true
  ? Equal<Extract<RequiredKeys<Value>, string>, SchemaRequiredKeys<Schema>>
  : false;

type _Information = Assert<
  ObjectContractMatches<LoreInformationBlockV1, typeof loreInformationBlockSchema>
>;
type _Kingdom = Assert<ObjectContractMatches<KingdomLoreAuthorV1, typeof kingdomLoreAuthorSchema>>;
type _Territory = Assert<ObjectContractMatches<TerritoryLoreAuthorV1, typeof territoryLoreAuthorSchema>>;
type _Region = Assert<ObjectContractMatches<RegionLoreAuthorV1, typeof regionLoreAuthorSchema>>;
type _City = Assert<ObjectContractMatches<CityLoreAuthorV1, typeof cityLoreAuthorSchema>>;
type _District = Assert<ObjectContractMatches<DistrictLoreAuthorV1, typeof districtLoreAuthorSchema>>;
type _Building = Assert<ObjectContractMatches<BuildingLoreAuthorV1, typeof buildingLoreAuthorSchema>>;
type _Faction = Assert<ObjectContractMatches<FactionLoreAuthorV1, typeof factionLoreAuthorSchema>>;
type _Meta = Assert<ObjectContractMatches<MetaLoreAuthorV1, typeof metaLoreAuthorSchema>>;
type _Species = Assert<ObjectContractMatches<SpeciesLoreAuthorV1, typeof speciesLoreAuthorSchema>>;
type _Culture = Assert<ObjectContractMatches<CultureLoreAuthorV1, typeof cultureLoreAuthorSchema>>;
type _Npc = Assert<ObjectContractMatches<NpcLoreAuthorV1, typeof npcLoreAuthorSchema>>;
type _Period = Assert<
  ObjectContractMatches<HistoricalPeriodLoreAuthorV1, typeof historicalPeriodLoreAuthorSchema>
>;
type _Event = Assert<
  ObjectContractMatches<HistoricalEventLoreAuthorV1, typeof historicalEventLoreAuthorSchema>
>;

export const LORE_SCHEMA_TYPE_CHECK_COUNT = 14 as const;
