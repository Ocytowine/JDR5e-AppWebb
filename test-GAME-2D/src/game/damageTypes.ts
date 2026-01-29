export type DamageTypeId =
  | "slashing"
  | "piercing"
  | "bludgeoning"
  | "fire"
  | "cold"
  | "acid"
  | "lightning"
  | "poison"
  | "thunder"
  | "force"
  | "radiant"
  | "necrotic"
  | "psychic";

const DAMAGE_TYPE_ALIASES: Record<string, DamageTypeId> = {
  slashing: "slashing",
  tranchant: "slashing",
  piercing: "piercing",
  perforant: "piercing",
  bludgeoning: "bludgeoning",
  contondant: "bludgeoning",
  fire: "fire",
  feu: "fire",
  cold: "cold",
  froid: "cold",
  acid: "acid",
  acide: "acid",
  lightning: "lightning",
  foudre: "lightning",
  poison: "poison",
  thunder: "thunder",
  tonnerre: "thunder",
  force: "force",
  radiant: "radiant",
  necrotic: "necrotic",
  necrotique: "necrotic",
  psychic: "psychic",
  psychique: "psychic"
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeDamageType(value?: string | null): DamageTypeId | null {
  if (!value) return null;
  const key = normalizeKey(String(value));
  return DAMAGE_TYPE_ALIASES[key] ?? null;
}
