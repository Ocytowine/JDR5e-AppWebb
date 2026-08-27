import type { AiOpenSemanticFrameV8, AiStructuredSemanticIntentV1 } from "../ai/types";
import type { JsonObject } from "../core";
import type { NarrativeTurnControllerOutputV1 } from "./NarrativeTurnController";
import { buildOpenSemanticLegacyOwnerAdapterProjectionV1 } from "./openSemanticLegacyOwnerAdapter";

export const OPEN_SEMANTIC_FIDELITY_RECEIPT_V1 =
  "open-semantic-fidelity-receipt/1" as const;

export interface OpenSemanticComponentFidelityReceiptV1 extends JsonObject {
  schemaVersion: 1;
  source: "OPENAI_SEMANTIC_FRAME_V8";
  componentId: string;
  order: number;
  meaning: string;
  informationNeed: NonNullable<AiOpenSemanticFrameV8["components"][number]["informationNeed"]> | null;
  commitment: AiOpenSemanticFrameV8["components"][number]["commitment"];
  conditions: string[];
  relationToPrevious: AiOpenSemanticFrameV8["components"][number]["relationToPrevious"];
  dependsOnComponentIds: string[];
  targetRefs: string[];
  capabilityId: string | null;
  requiredDomain: string | null;
  disposition: string;
  selectedByOwnerAdapter: boolean;
}

export interface OpenSemanticFidelityReceiptV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof OPEN_SEMANTIC_FIDELITY_RECEIPT_V1;
  intentId: string;
  originalFrame: AiOpenSemanticFrameV8 & JsonObject;
  effectiveOwnerProjection: JsonObject | null;
  orderedComponents: OpenSemanticComponentFidelityReceiptV1[];
  validatedTargetRefs: string[];
  dialogueAct: NonNullable<AiStructuredSemanticIntentV1["dialogueAct"]> | null;
  informationNeeds: NonNullable<AiOpenSemanticFrameV8["components"][number]["informationNeed"]>[];
  characterExpressionSource: "RAW_PLAYER_INPUT";
  rawInputAccessByOwner: "FORBIDDEN";
}

export type NarrativeTurnControllerOutputWithSemanticFidelityV1 =
  NarrativeTurnControllerOutputV1 & {
    openSemanticFidelity: OpenSemanticFidelityReceiptV1 | null;
  };

/**
 * Frontière de fidélité du contrôleur. Les propriétaires continuent de ne voir
 * que le sens structuré. Après leur décision, le contrôleur rattache la saisie
 * originale à l'expression joueur et publie un reçu qui distingue le cadre
 * OpenAI de la projection V1 effectivement présentée au propriétaire.
 */
export function applyOpenSemanticFidelityV1(input: {
  output: NarrativeTurnControllerOutputV1;
  rawInput: string;
}): NarrativeTurnControllerOutputWithSemanticFidelityV1 {
  const frame = input.output.interpretation.openSemanticFrame;
  if (input.output.interpretation.semanticSource !== "OPEN_SEMANTIC_FRAME_V8"
    || frame === null
    || frame === undefined) {
    return { ...input.output, openSemanticFidelity: null };
  }

  const projection = buildOpenSemanticLegacyOwnerAdapterProjectionV1(
    input.output.interpretation
  );
  const plan = input.output.interpretation.openSemanticRuntime?.executionPlan;
  const selectedComponentIds = new Set(
    projection?.domainCommand.payload.componentIds as string[] | undefined
      ?? (projection === null ? [] : [projection.componentId])
  );
  const validatedTargetRefs = [...new Set(
    projection?.domainCommand.targetRefs.filter(ref => ref.trim().length > 0) ?? []
  )];
  const resolvedTargetRef = validatedTargetRefs.length === 1
    ? validatedTargetRefs[0]!
    : null;
  const expressionText = input.rawInput.trim().length > 0
    ? input.rawInput.trim()
    : input.rawInput;
  const resolution = {
    ...input.output.resolution,
    interpretation: projection?.interpretation ?? input.output.resolution.interpretation,
    characterExpression: input.output.resolution.characterExpression === null
      ? null
      : {
          ...input.output.resolution.characterExpression,
          rawPlayerText: input.rawInput,
          expressionText,
          fidelity: "RAW_EQUIVALENT" as const,
          addedCommitments: []
        },
    preparedEffects: input.output.resolution.preparedEffects.map(effect =>
      resolvedTargetRef !== null
      && effect.targetRef === "scene:prototype-narration-surface"
      && (effect.effectType === "SPEECH_ACT_RECORDED"
        || effect.effectType === "LOCAL_SCENE_ACTION_RECORDED")
        ? { ...effect, targetRef: resolvedTargetRef }
        : effect
    )
  };
  const effectiveDialogueAct = projection?.interpretation.semanticIntent.dialogueAct ?? null;
  const receipt: OpenSemanticFidelityReceiptV1 = {
    schemaVersion: 1,
    contractVersion: OPEN_SEMANTIC_FIDELITY_RECEIPT_V1,
    intentId: input.output.interpretation.intentId,
    originalFrame: frame as AiOpenSemanticFrameV8 & JsonObject,
    effectiveOwnerProjection: projection === null
      ? null
      : {
          schemaVersion: projection.schemaVersion,
          contractVersion: projection.contractVersion,
          componentId: projection.componentId,
          capabilityId: projection.capabilityId,
          semanticInputText: projection.semanticInputText,
          interpretation: projection.interpretation,
          domainCommand: projection.domainCommand,
          rawInputAccess: projection.rawInputAccess
        },
    orderedComponents: [...frame.components]
      .sort((left, right) => left.order - right.order)
      .map(component => {
        const step = plan?.steps.find(candidate => candidate.componentId === component.componentId);
        return {
          schemaVersion: 1,
          source: "OPENAI_SEMANTIC_FRAME_V8",
          componentId: component.componentId,
          order: component.order,
          meaning: component.meaning,
          informationNeed: component.informationNeed === undefined || component.informationNeed === null
            ? null
            : structuredClone(component.informationNeed),
          commitment: component.commitment,
          conditions: [...component.conditions],
          relationToPrevious: component.relationToPrevious,
          dependsOnComponentIds: [...component.dependsOnComponentIds],
          targetRefs: step?.targetRefs ?? component.mentionedTargets
            .flatMap(target => target.proposedRef === null ? [] : [target.proposedRef]),
          capabilityId: step?.capabilityId ?? component.suggestedCapabilityId,
          requiredDomain: step?.requiredDomain ?? null,
          disposition: step?.disposition ?? "NOT_PLANNED",
          selectedByOwnerAdapter: selectedComponentIds.has(component.componentId)
        };
      }),
    validatedTargetRefs,
    dialogueAct: effectiveDialogueAct,
    informationNeeds: frame.components.flatMap(component =>
      component.informationNeed === undefined || component.informationNeed === null
        ? []
        : [structuredClone(component.informationNeed)]
    ),
    characterExpressionSource: "RAW_PLAYER_INPUT",
    rawInputAccessByOwner: "FORBIDDEN"
  };
  return {
    ...input.output,
    resolution,
    openSemanticFidelity: receipt
  };
}
