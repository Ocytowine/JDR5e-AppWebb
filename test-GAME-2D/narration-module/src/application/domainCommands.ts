import type { JsonObject } from "../core";
import type { AiIntentRuntimeHandlingV1 } from "../ai/types";
import { validateCanonicalIntentAuthorityV1, type NarrativeIntentInterpretationV1 } from "./intentClarification";

export const NARRATIVE_DOMAIN_COMMAND_CONTRACT_VERSION_V1 = "narrative-domain-command/1" as const;

export type NarrativeDomainCommandTypeV1 =
  | "SCENE_SPEECH_REQUEST"
  | "SCENE_INTERACTION_REQUEST"
  | "PERCEPTION_REQUEST"
  | "DOMAIN_HANDOFF_REQUEST";

export interface NarrativeDomainCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_DOMAIN_COMMAND_CONTRACT_VERSION_V1;
  commandId: string;
  intentId: string;
  domain: NonNullable<AiIntentRuntimeHandlingV1["requiredDomain"]>;
  commandType: NarrativeDomainCommandTypeV1;
  semanticKind: string;
  semanticGoal: string;
  targetRefs: string[];
  payload: JsonObject;
  commitPolicy: "FORBIDDEN" | "DOMAIN_VALIDATED";
  commitAuthority: false;
  noGameTime: true;
  source: "LOCAL_COMMAND_BUILDER";
}

export function buildNarrativeDomainCommandV1(
  interpretation: NarrativeIntentInterpretationV1
): NarrativeDomainCommandV1 | null {
  if (!validateCanonicalIntentAuthorityV1(interpretation).ok) return null;
  const semantic = interpretation.semanticIntent;
  const runtime = interpretation.runtimeDecision;
  if (runtime.status === "AI_INTERPRETATION_FAILED" || runtime.status === "NEEDS_CLARIFICATION") return null;
  if (semantic.commitment === "none" || semantic.commitment === "hypothetical" || semantic.commitment === "unclear") return null;
  const domain = runtime.requiredDomain;
  if (domain === null) return null;
  const target = interpretation.referentResolution?.resolvedTarget ?? semantic.target ?? null;
  const targetRefs = target?.ref == null ? [] : [target.ref];
  const commandType = commandTypeFor(semantic.kind, runtime.status);
  const command: NarrativeDomainCommandV1 = {
    schemaVersion: 1,
    contractVersion: NARRATIVE_DOMAIN_COMMAND_CONTRACT_VERSION_V1,
    commandId: `${interpretation.intentId}:domain-command:1`,
    intentId: interpretation.intentId,
    domain,
    commandType,
    semanticKind: semantic.kind,
    semanticGoal: semantic.playerGoal,
    targetRefs,
    payload: {
      commitment: semantic.commitment,
      uncertainties: [...semantic.uncertainties],
      forbiddenInterpretations: [...semantic.forbiddenInterpretations]
    },
    commitPolicy: runtime.status === "SUPPORTED_BY_CURRENT_RUNTIME" && runtime.noCommit === false
      ? "DOMAIN_VALIDATED"
      : "FORBIDDEN",
    commitAuthority: false,
    noGameTime: true,
    source: "LOCAL_COMMAND_BUILDER"
  };
  const validation = validateNarrativeDomainCommandV1(command, interpretation);
  return validation.ok ? command : null;
}

export function validateNarrativeDomainCommandV1(
  command: NarrativeDomainCommandV1,
  interpretation: NarrativeIntentInterpretationV1
): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const authority = validateCanonicalIntentAuthorityV1(interpretation);
  if (!authority.ok) issues.push(...authority.issues);
  if (command.contractVersion !== NARRATIVE_DOMAIN_COMMAND_CONTRACT_VERSION_V1) issues.push("contractVersion mismatch");
  if (command.intentId !== interpretation.intentId) issues.push("intentId mismatch");
  if (command.semanticKind !== interpretation.semanticIntent.kind) issues.push("semanticKind mismatch");
  if (command.semanticGoal !== interpretation.semanticIntent.playerGoal) issues.push("semanticGoal mismatch");
  if (command.domain !== interpretation.runtimeDecision.requiredDomain) issues.push("runtime domain mismatch");
  if (command.commitAuthority !== false) issues.push("commitAuthority must be false");
  if (command.noGameTime !== true) issues.push("noGameTime must be true");
  if (interpretation.runtimeDecision.status === "UNSUPPORTED_DOMAIN" && command.commandType !== "DOMAIN_HANDOFF_REQUEST") {
    issues.push("unsupported domain requires handoff command");
  }
  if (interpretation.runtimeDecision.noCommit && command.commitPolicy !== "FORBIDDEN") issues.push("runtime noCommit requires forbidden commit policy");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function commandTypeFor(
  semanticKind: NarrativeIntentInterpretationV1["semanticIntent"]["kind"],
  runtimeStatus: NarrativeIntentInterpretationV1["runtimeDecision"]["status"]
): NarrativeDomainCommandTypeV1 {
  if (runtimeStatus === "UNSUPPORTED_DOMAIN") return "DOMAIN_HANDOFF_REQUEST";
  if (semanticKind === "address_visible_actor") return "SCENE_SPEECH_REQUEST";
  if (semanticKind === "observe_environment" || semanticKind === "context_question" || semanticKind === "meta_request") {
    return "PERCEPTION_REQUEST";
  }
  return "SCENE_INTERACTION_REQUEST";
}
