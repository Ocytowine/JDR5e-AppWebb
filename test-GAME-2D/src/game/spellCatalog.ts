import aid from "../../action-game/actions/catalog/combat/spells/aid.json";
import arcaneBolt from "../../action-game/actions/catalog/combat/spells/arcane-bolt.json";
import auraOfPurity from "../../action-game/actions/catalog/combat/spells/aura-of-purity.json";
import beaconOfHope from "../../action-game/actions/catalog/combat/spells/beacon-of-hope.json";
import greaterRestoration from "../../action-game/actions/catalog/combat/spells/greater-restoration.json";
import heroism from "../../action-game/actions/catalog/combat/spells/heroism.json";
import minorWard from "../../action-game/actions/catalog/combat/spells/minor-ward.json";
import rarysTelepathicBond from "../../action-game/actions/catalog/combat/spells/rarys-telepathic-bond.json";
import resilientSphere from "../../action-game/actions/catalog/combat/spells/resilient-sphere.json";
import sanctuary from "../../action-game/actions/catalog/combat/spells/sanctuary.json";
import sending from "../../action-game/actions/catalog/combat/spells/sending.json";
import wardingBond from "../../action-game/actions/catalog/combat/spells/warding-bond.json";

export type SpellDefinition = {
  id: string;
  name: string;
  level: number;
  school: string;
  components?: {
    verbal?: boolean;
    somatic?: boolean;
    material?: boolean;
  };
  summary?: string;
  category?: string;
  tags?: string[];
};

const spellCatalogList: SpellDefinition[] = [
  aid as SpellDefinition,
  arcaneBolt as SpellDefinition,
  auraOfPurity as SpellDefinition,
  beaconOfHope as SpellDefinition,
  greaterRestoration as SpellDefinition,
  heroism as SpellDefinition,
  minorWard as SpellDefinition,
  rarysTelepathicBond as SpellDefinition,
  resilientSphere as SpellDefinition,
  sanctuary as SpellDefinition,
  sending as SpellDefinition,
  wardingBond as SpellDefinition
];

const spellCatalogById = new Map(spellCatalogList.map(spell => [spell.id, spell]));

export const spellCatalog = {
  list: spellCatalogList,
  byId: spellCatalogById
};
