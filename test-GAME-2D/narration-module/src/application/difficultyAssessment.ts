import type { JsonObject } from "../core";
import type { PlayableSceneStateV1 } from "./playableScene";

export const DIFFICULTY_ASSESSMENT_CONTRACT_VERSION_V1 = "difficulty-assessment/1" as const;

export type DifficultyBandV1 =
  | "VERY_EASY"
  | "EASY"
  | "MEDIUM"
  | "HARD"
  | "VERY_HARD"
  | "NEARLY_IMPOSSIBLE";

export interface DifficultyFactorV1 {
  factorId: string;
  shift: -2 | -1 | 0 | 1 | 2;
  publicReason: string;
  sourceRef: string;
  visibility: "PLAYER_VISIBLE" | "SYSTEM_ONLY";
}

export interface DifficultyAssessmentV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof DIFFICULTY_ASSESSMENT_CONTRACT_VERSION_V1;
  baseBand: DifficultyBandV1;
  selectedBand: DifficultyBandV1;
  totalShift: number;
  publicReasons: string[];
  publicSourceRefs: string[];
  privateFactorCount: number;
  ruleRefs: string[];
  commitAuthority: false;
}

const BANDS: DifficultyBandV1[] = [
  "VERY_EASY",
  "EASY",
  "MEDIUM",
  "HARD",
  "VERY_HARD",
  "NEARLY_IMPOSSIBLE"
];

export function assessDifficultyBandV1(input: {
  baseBand: DifficultyBandV1;
  factors: DifficultyFactorV1[];
}): DifficultyAssessmentV1 {
  const baseIndex = BANDS.indexOf(input.baseBand);
  const totalShift = input.factors.reduce((sum, factor) => sum + factor.shift, 0);
  const selectedIndex = Math.max(0, Math.min(BANDS.length - 1, baseIndex + totalShift));
  const visible = input.factors.filter(factor => factor.visibility === "PLAYER_VISIBLE");
  return {
    schemaVersion: 1,
    contractVersion: DIFFICULTY_ASSESSMENT_CONTRACT_VERSION_V1,
    baseBand: input.baseBand,
    selectedBand: BANDS[selectedIndex],
    totalShift,
    publicReasons: visible.map(factor => factor.publicReason),
    publicSourceRefs: [...new Set(visible.map(factor => factor.sourceRef))],
    privateFactorCount: input.factors.length - visible.length,
    ruleRefs: ["house.rules.local-authority@1"],
    commitAuthority: false
  };
}

export function assessPerceptionSearchDifficultyV1(input: {
  scene: PlayableSceneStateV1;
  targetRef: string | null;
}): DifficultyAssessmentV1 {
  const targetClues = input.scene.perceptionClues.filter(clue => clue.targetRef === input.targetRef);
  const hasAccessibleSigns = targetClues.some(clue =>
    clue.factKind === "VISIBLE_SIGN" && (clue.visibility === "IMMEDIATE" || clue.visibility === "FOCUSED"));
  const hasProtectedInformation = targetClues.some(clue =>
    clue.visibility === "CHECKED" || clue.factKind === "HIDDEN_FACT");
  const factors: DifficultyFactorV1[] = [];
  if (hasAccessibleSigns) {
    factors.push({
      factorId: "perception.prior-visible-signs",
      shift: -1,
      publicReason: "Des signes perceptibles fournissent déjà un point de départ à la recherche.",
      sourceRef: `scene:${input.scene.sceneId}`,
      visibility: "PLAYER_VISIBLE"
    });
  }
  if (hasProtectedInformation) {
    factors.push({
      factorId: "perception.protected-information",
      shift: 1,
      publicReason: "Facteur privé de scène.",
      sourceRef: `scene:${input.scene.sceneId}:private-perception`,
      visibility: "SYSTEM_ONLY"
    });
  }
  return assessDifficultyBandV1({ baseBand: "MEDIUM", factors });
}
