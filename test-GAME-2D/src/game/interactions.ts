export type InteractionCost = "action" | "bonus" | "free";

export type InteractionKind = "open" | "break" | "toggle";

export interface InteractionSpec {
  id: string;
  label: string;
  kind: InteractionKind;
  cost?: InteractionCost;
  forceDc?: number;
  damageFraction?: number;
  setLit?: boolean;
}
