import type { JsonObject } from "../core";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";

export const NARRATIVE_REST_PREPARATION_CONTRACT_VERSION_V1 = "narrative-rest-preparation/1" as const;
export type NarrativeRestKindV1 = "SHORT_REST" | "LONG_REST";

export interface NarrativeRestRulesPolicyV1 {
  shortRestDurationSeconds: number;
  longRestDurationSeconds: number;
  segmentSeconds: number;
}

export interface NarrativeRestMissingChoiceV1 extends JsonObject {
  choiceId: "REST_KIND";
  prompt: string;
  options: Array<{
    value: NarrativeRestKindV1;
    label: string;
  }>;
}

export interface NarrativeRestPreparationV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_REST_PREPARATION_CONTRACT_VERSION_V1;
  status: "NEEDS_PLAYER_CHOICES" | "READY";
  restKind: NarrativeRestKindV1 | null;
  targetDurationSeconds: number | null;
  segmentSeconds: number;
  missingChoices: NarrativeRestMissingChoiceV1[];
}

export function prepareNarrativeRestV1(input: {
  interpretation: NarrativeIntentInterpretationV1;
  rules: NarrativeRestRulesPolicyV1;
}): NarrativeRestPreparationV1 {
  assertRules(input.rules);
  const restKind = input.interpretation.semanticIntent.restPlan?.restKind ?? null;
  if (restKind === null) {
    return {
      schemaVersion: 1,
      contractVersion: NARRATIVE_REST_PREPARATION_CONTRACT_VERSION_V1,
      status: "NEEDS_PLAYER_CHOICES",
      restKind: null,
      targetDurationSeconds: null,
      segmentSeconds: input.rules.segmentSeconds,
      missingChoices: [{
        choiceId: "REST_KIND",
        prompt: "Souhaites-tu prendre un repos court ou un repos long ?",
        options: [
          { value: "SHORT_REST", label: "Repos court" },
          { value: "LONG_REST", label: "Repos long" }
        ]
      }]
    };
  }
  return {
    schemaVersion: 1,
    contractVersion: NARRATIVE_REST_PREPARATION_CONTRACT_VERSION_V1,
    status: "READY",
    restKind,
    targetDurationSeconds: restKind === "SHORT_REST"
      ? input.rules.shortRestDurationSeconds
      : input.rules.longRestDurationSeconds,
    segmentSeconds: input.rules.segmentSeconds,
    missingChoices: []
  };
}

function assertRules(rules: NarrativeRestRulesPolicyV1): void {
  for (const [name, value] of Object.entries(rules)) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  }
}
