import type { JsonObject } from "../core";
import type { DisplayPacketV1 } from "../scene";
import type { NarrativeTurnControllerOutputV1 } from "./NarrativeTurnController";
import { buildReferenceSceneLocalNarrationV1 } from "./referenceScene";

export const NARRATIVE_PRESENTATION_VARIATION_CONTRACT_VERSION_V1 = "narrative-presentation-variation/1" as const;

export interface NarrativePresentationVariationInputV1 {
  schemaVersion: 1;
  displayPacket: DisplayPacketV1;
  output: NarrativeTurnControllerOutputV1;
  priorPackets: DisplayPacketV1[];
  variantCount?: number;
}

export interface NarrativePresentationVariationResultV1 {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_PRESENTATION_VARIATION_CONTRACT_VERSION_V1;
  displayPacket: DisplayPacketV1 & JsonObject;
  applied: boolean;
  variantIndex: number | null;
}

export function applyNarrativePresentationVariationV1(
  input: NarrativePresentationVariationInputV1
): NarrativePresentationVariationResultV1 {
  const packet = input.displayPacket as DisplayPacketV1 & JsonObject;
  if (input.output.interpretation.semanticIntent.kind !== "meta_request" && input.output.interpretation.semanticIntent.kind !== "context_question") {
    return result(packet, false, null);
  }

  const localMetaBlocks = packet.displayBlocks.filter(block =>
    block.kind === "GM_NARRATION" &&
    block.sourceRefs.some(ref => ref.includes(":meta-answer")) &&
    block.sourceRefs.every(ref => !ref.startsWith("ai-output:"))
  );
  if (localMetaBlocks.length === 0) return result(packet, false, null);

  const rawInput = packet.displayBlocks.find(block => block.kind === "RAW_INPUT")?.text ?? "";
  const variantCount = Math.max(1, input.variantCount ?? 3);
  const variantIndex = countPriorMetaAnswerBlocksV1(input.priorPackets) % variantCount;
  const text = buildReferenceSceneLocalNarrationV1({
    rawInput,
    interpretation: input.output.interpretation,
    resolution: input.output.resolution,
    presentationVariantIndex: variantIndex
  });
  const varied = {
    ...packet,
    displayBlocks: packet.displayBlocks.map(block =>
      localMetaBlocks.some(local => local.blockId === block.blockId)
        ? {
          ...block,
          text,
          sourceRefs: [...new Set([...block.sourceRefs, `presentation-variant:${variantIndex}`])]
        }
        : block
    ),
    rhythmDiagnostics: `${packet.rhythmDiagnostics ?? "none"}|presentation-variant:${variantIndex}`,
    reconstructionRefs: [...new Set([...packet.reconstructionRefs, `presentation-variant:${variantIndex}`])]
  } as DisplayPacketV1 & JsonObject;

  return result(varied, true, variantIndex);
}

export function countPriorMetaAnswerBlocksV1(packets: DisplayPacketV1[]): number {
  return packets.reduce((count, packet) => {
    return count + packet.displayBlocks.filter(block =>
      block.kind === "GM_NARRATION" &&
      block.sourceRefs.some(ref => ref.includes(":meta-answer")) &&
      block.sourceRefs.every(ref => !ref.startsWith("ai-output:"))
    ).length;
  }, 0);
}

function result(
  displayPacket: DisplayPacketV1 & JsonObject,
  applied: boolean,
  variantIndex: number | null
): NarrativePresentationVariationResultV1 {
  return {
    schemaVersion: 1,
    contractVersion: NARRATIVE_PRESENTATION_VARIATION_CONTRACT_VERSION_V1,
    displayPacket,
    applied,
    variantIndex
  };
}
