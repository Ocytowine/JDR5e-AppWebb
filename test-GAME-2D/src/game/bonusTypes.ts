export type BonusMode = "add" | "set" | "max";

export type BonusStat =
  | "modFOR"
  | "modDEX"
  | "modCON"
  | "modINT"
  | "modSAG"
  | "modCHA"
  | "armorClass"
  | "maxHp"
  | "moveRange"
  | "attackBonus"
  | "maxAttacksPerTurn"
  | "actionsPerTurn"
  | "bonusActionsPerTurn";

export interface BonusDefinition {
  id: string;
  label: string;
  summary?: string;
  stat: BonusStat | string;
  value: number;
  mode: BonusMode;
  tags?: string[];
  requirements?: Array<Record<string, unknown>>;
  source?: {
    book?: string;
    page?: number;
  };
}

