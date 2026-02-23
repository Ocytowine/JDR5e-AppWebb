import aid from "../data/spells/aid.json";
import arcaneBolt from "../data/spells/arcane-bolt.json";
import rayonDeFeu from "../data/spells/rayon-de-feu.json";
import vagueArdente from "../data/spells/vague-ardente.json";
import auraOfPurity from "../data/spells/aura-of-purity.json";
import beaconOfHope from "../data/spells/beacon-of-hope.json";
import greaterRestoration from "../data/spells/greater-restoration.json";
import heroism from "../data/spells/heroism.json";
import minorWard from "../data/spells/minor-ward.json";
import rarysTelepathicBond from "../data/spells/rarys-telepathic-bond.json";
import resilientSphere from "../data/spells/resilient-sphere.json";
import sanctuary from "../data/spells/sanctuary.json";
import sending from "../data/spells/sending.json";
import wardingBond from "../data/spells/warding-bond.json";
import cantripAcidSplash from "../data/spells/cantrips/acid-splash.json";
import cantripFireBolt from "../data/spells/cantrips/fire-bolt.json";
import cantripFrostbite from "../data/spells/cantrips/frostbite.json";

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
  rayonDeFeu as SpellDefinition,
  vagueArdente as SpellDefinition,
  auraOfPurity as SpellDefinition,
  beaconOfHope as SpellDefinition,
  greaterRestoration as SpellDefinition,
  heroism as SpellDefinition,
  minorWard as SpellDefinition,
  rarysTelepathicBond as SpellDefinition,
  resilientSphere as SpellDefinition,
  sanctuary as SpellDefinition,
  sending as SpellDefinition,
  wardingBond as SpellDefinition,
  cantripAcidSplash as SpellDefinition,
  cantripFireBolt as SpellDefinition,
  cantripFrostbite as SpellDefinition
];

const spellCatalogById = new Map(spellCatalogList.map(spell => [spell.id, spell]));

export const spellCatalog = {
  list: spellCatalogList,
  byId: spellCatalogById
};

