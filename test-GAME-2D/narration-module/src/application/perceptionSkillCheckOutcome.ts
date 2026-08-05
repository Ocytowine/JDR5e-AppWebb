import type { AggregateRecord, JsonObject } from "../core";
import type { PlayableSceneStateV1 } from "./playableScene";
import type { SkillCheckOwnerResultV1 } from "./skillCheckOutcomeCommit";
import type {
  PreparedSkillCheckOutcomeV1,
  SkillCheckOutcomePolicyV1
} from "./skillCheckOutcomePreparation";
import type { SkillCheckProposalV1 } from "./skillCheckProposal";

export const PERCEPTION_SKILL_CHECK_OUTCOME_CONTRACT_VERSION_V1 =
  "perception-skill-check-outcome/1" as const;
export const PERCEPTION_CHECK_OUTCOME_AGGREGATE_TYPE_V1 =
  "perception.check-outcome" as const;

export interface PerceptionCheckOutcomePayloadV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PERCEPTION_SKILL_CHECK_OUTCOME_CONTRACT_VERSION_V1;
  checkId: string;
  rollId: string;
  sceneId: string;
  targetRef: string | null;
  outcome: "SUCCESS" | "FAILURE";
  revealedClueRefs: string[];
  revealedTexts: string[];
  publicSummary: string;
  retryDisposition: PreparedSkillCheckOutcomeV1["consequence"]["retryDisposition"];
  committedAtGameSecond: number;
  version: number;
}

export function buildPerceptionSkillCheckOutcomePolicyV1(input: {
  proposal: SkillCheckProposalV1;
  scene: PlayableSceneStateV1;
  durationSeconds?: number;
}): { ok: true; value: SkillCheckOutcomePolicyV1 } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const durationSeconds = input.durationSeconds ?? 12;
  if (input.proposal.domain !== "perception") issues.push("proposal domain must be perception");
  if (input.proposal.targetRef === null) issues.push("perception targetRef is required");
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) issues.push("durationSeconds must be a positive integer");
  const checkedVisible = input.scene.perceptionClues.filter(clue =>
    clue.targetRef === input.proposal.targetRef &&
    clue.visibility === "CHECKED" &&
    clue.factKind === "VISIBLE_SIGN"
  );
  if (checkedVisible.length === 0) issues.push("scene has no checked player-visible clue for target");
  if (issues.length > 0) return { ok: false, issues };

  const publicSourceRefs = unique([
    `scene:${input.scene.sceneId}`,
    ...checkedVisible.flatMap(clue => clue.sourceRefs)
  ]);
  const privateSourceRefs = unique(input.scene.perceptionClues
    .filter(clue => clue.targetRef === input.proposal.targetRef && clue.factKind === "HIDDEN_FACT")
    .flatMap(clue => clue.sourceRefs));
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      policyId: `${input.proposal.checkId}:perception-policy:1`,
      checkId: input.proposal.checkId,
      success: {
        ownerDomain: "perception",
        effectType: "perception.reveal-checked-clues",
        effectPayload: {
          sceneId: input.scene.sceneId,
          targetRef: input.proposal.targetRef,
          revealedClueRefs: checkedVisible.map(clue => clue.clueId),
          revealedTexts: checkedVisible.map(clue => clue.playerText)
        },
        publicSummary: checkedVisible.map(clue => clue.playerText).join(" "),
        durationSeconds,
        retryDisposition: "RETRY_FORBIDDEN",
        publicSourceRefs,
        privateSourceRefs,
        ruleRefs: ["rule.perception.active-search-duration@1"]
      },
      failure: {
        ownerDomain: "perception",
        effectType: "perception.no-clue-revealed",
        effectPayload: {
          sceneId: input.scene.sceneId,
          targetRef: input.proposal.targetRef,
          revealedClueRefs: [],
          revealedTexts: []
        },
        publicSummary: "Votre recherche ne révèle aucun indice supplémentaire vérifiable.",
        durationSeconds,
        retryDisposition: "RETRY_REQUIRES_CONTEXT_CHANGE",
        publicSourceRefs: [`scene:${input.scene.sceneId}`],
        privateSourceRefs,
        ruleRefs: ["rule.perception.active-search-duration@1"]
      },
      commitAuthority: false
    }
  };
}

export function buildPerceptionSkillCheckOwnerResultV1(input: {
  prepared: PreparedSkillCheckOutcomeV1;
  scene: PlayableSceneStateV1;
  currentAggregate: AggregateRecord | null;
}): { ok: true; value: SkillCheckOwnerResultV1 } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (input.prepared.consequence.ownerDomain !== "perception") issues.push("prepared owner domain must be perception");
  const expectedEffect = input.prepared.outcome === "SUCCESS"
    ? "perception.reveal-checked-clues"
    : "perception.no-clue-revealed";
  if (input.prepared.consequence.effectType !== expectedEffect) issues.push("prepared effect does not match outcome");
  const effect = input.prepared.consequence.effectPayload;
  if (effect.sceneId !== input.scene.sceneId) issues.push("effect sceneId mismatch");
  const revealedRefs = stringArray(effect.revealedClueRefs);
  const revealedTexts = stringArray(effect.revealedTexts);
  const allowedClues = new Map(input.scene.perceptionClues
    .filter(clue => clue.visibility === "CHECKED" && clue.factKind === "VISIBLE_SIGN")
    .map(clue => [clue.clueId, clue]));
  if (input.prepared.outcome === "FAILURE" && (revealedRefs.length > 0 || revealedTexts.length > 0)) {
    issues.push("failure cannot reveal clues");
  }
  for (const ref of revealedRefs) {
    const clue = allowedClues.get(ref);
    if (clue === undefined || !revealedTexts.includes(clue.playerText)) {
      issues.push(`revealed clue is not an allowed checked visible sign: ${ref}`);
    }
  }
  const aggregateId = `perception-outcome:${input.prepared.checkId}`;
  if (input.currentAggregate !== null && (
    input.currentAggregate.aggregateType !== PERCEPTION_CHECK_OUTCOME_AGGREGATE_TYPE_V1 ||
    input.currentAggregate.aggregateId !== aggregateId
  )) issues.push("current perception outcome aggregate mismatch");
  if (issues.length > 0) return { ok: false, issues };

  const payload: PerceptionCheckOutcomePayloadV1 = {
    schemaVersion: 1,
    contractVersion: PERCEPTION_SKILL_CHECK_OUTCOME_CONTRACT_VERSION_V1,
    checkId: input.prepared.checkId,
    rollId: input.prepared.rollId,
    sceneId: input.scene.sceneId,
    targetRef: typeof effect.targetRef === "string" ? effect.targetRef : null,
    outcome: input.prepared.outcome,
    revealedClueRefs: revealedRefs,
    revealedTexts,
    publicSummary: input.prepared.narrativeResume.publicSummary,
    retryDisposition: input.prepared.consequence.retryDisposition,
    committedAtGameSecond:
      input.prepared.timeAdvanceProposal.observedAtGameSecond +
      input.prepared.narrativeResume.durationSeconds,
    version: input.currentAggregate === null
      ? 1
      : Number((input.currentAggregate.payload as Partial<PerceptionCheckOutcomePayloadV1>).version ?? 0) + 1
  };
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: "skill-check-outcome-commit/1",
      commandId: `${input.prepared.rollId}:perception-owner-command`,
      checkId: input.prepared.checkId,
      rollId: input.prepared.rollId,
      ownerDomain: "perception",
      effectType: input.prepared.consequence.effectType,
      target: {
        aggregateType: PERCEPTION_CHECK_OUTCOME_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null
      },
      nextPayload: payload,
      additionalTargets: [],
      publicSourceRefs: [...input.prepared.narrativeResume.allowedSourceRefs],
      ownerAuthority: true
    }
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
