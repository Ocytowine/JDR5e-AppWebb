export type FeatureKind = "passive" | "action" | "reaction" | "resource" | "feature";

export type FeatureGrantKind =
  | "action"
  | "reaction"
  | "passif"
  | "feature"
  | "spell"
  | "resource"
  | "bonus";

export interface FeatureGrant {
  kind: FeatureGrantKind;
  ids: string[];
  source?: string;
  meta?: Record<string, unknown>;
}

export interface FeatureDefinition {
  id: string;
  label: string;
  summary?: string;
  kind?: FeatureKind;
  tags?: string[];
  grants?: FeatureGrant[];
  rules?: {
    text?: string;
    modifiers?: Array<Record<string, unknown>>;
    reactionModifiers?: Array<Record<string, unknown>>;
    secondaryAttackPolicy?: Record<string, unknown>;
    runtimeMarkers?: Array<Record<string, unknown>>;
    runtimeEffects?: Array<Record<string, unknown>>;
    triggers?: Array<{
      event: string;
      notes?: string;
    }>;
  };
  [key: string]: unknown;
}
