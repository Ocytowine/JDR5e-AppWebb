export type DamageTypeId =
  | "SLASHING"
  | "PIERCING"
  | "BLUDGEONING"
  | "FIRE"
  | "COLD"
  | "ACID"
  | "LIGHTNING"
  | "POISON"
  | "THUNDER"
  | "FORCE"
  | "RADIANT"
  | "NECROTIC"
  | "PSYCHIC";

const DAMAGE_TYPE_ALIASES: Record<string, DamageTypeId> = {
  slashing: "SLASHING",
  tranchant: "SLASHING",
  piercing: "PIERCING",
  perforant: "PIERCING",
  bludgeoning: "BLUDGEONING",
  contondant: "BLUDGEONING",
  fire: "FIRE",
  feu: "FIRE",
  cold: "COLD",
  froid: "COLD",
  acid: "ACID",
  acide: "ACID",
  lightning: "LIGHTNING",
  foudre: "LIGHTNING",
  poison: "POISON",
  thunder: "THUNDER",
  tonnerre: "THUNDER",
  force: "FORCE",
  radiant: "RADIANT",
  necrotic: "NECROTIC",
  necrotique: "NECROTIC",
  psychic: "PSYCHIC",
  psychique: "PSYCHIC"
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
