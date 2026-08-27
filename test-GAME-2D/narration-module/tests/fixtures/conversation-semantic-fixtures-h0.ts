import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiInformationNeedV8,
  AiOpenSemanticFrameV8,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV8
} from "../../src/ai/types";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
  type AiIntentInterpreterConfigV1
} from "../../src/application/aiIntentInterpretation";

export interface ConversationSemanticFixtureH0 {
  rawInput: string;
  frame: AiOpenSemanticFrameV8;
}

/**
 * Fournisseur OpenAI simulé à correspondance exacte réservé aux tests H0.
 * Les cadres sont écrits par le test : cette fixture ne comprend, ne classe et
 * ne relit jamais les mots de la saisie.
 */
export class ConversationSemanticProviderH0 implements ContractAiProviderV1 {
  private readonly framesByInput: ReadonlyMap<string, AiOpenSemanticFrameV8>;
  readonly requests: AiCallRequestV1[] = [];

  constructor(fixtures: readonly ConversationSemanticFixtureH0[]) {
    this.framesByInput = new Map(fixtures.map(fixture => [fixture.rawInput, fixture.frame]));
  }

  async generate(request: AiCallRequestV1): Promise<unknown> {
    this.requests.push(structuredClone(request));
    const rawInputValue = (request.input.task as { rawInput?: unknown }).rawInput;
    const rawInput = typeof rawInputValue === "string" ? rawInputValue : null;
    const frame = rawInput === null ? undefined : this.framesByInput.get(rawInput);
    if (rawInput === null || frame === undefined) {
      throw new Error("H0 conversation fixture has no exact semantic frame for this input.");
    }
    return {
      schemaVersion: 1,
      contractVersion: request.contractVersion,
      outputId: `output:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "OK",
      payload: {
        rawInputEcho: rawInput,
        semanticFrame: structuredClone(frame)
      },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV8>;
  }
}

export function createConversationSemanticConfigH0(
  fixtures: readonly ConversationSemanticFixtureH0[]
): AiIntentInterpreterConfigV1 {
  return {
    provider: new ConversationSemanticProviderH0(fixtures),
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
    route: {
      schemaVersion: 1,
      routeId: "route:h0-conversation-openai-simulated",
      role: "player_intent_interpreter",
      providerKind: "FAKE_CONTRACT",
      providerId: "fixture:h0-conversation-openai-simulated",
      modelId: "fixture:h0-open-semantic-v8",
      modelConfigVersion: "j10-h0-baseline-1",
      certified: true,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8],
      inputTokenLimit: 8_000,
      outputTokenLimit: 8_000,
      timeoutMs: 1_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1,
      role: "player_intent_interpreter",
      maxTechnicalRetries: 0,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: false
    }
  };
}

export function dialogueFixtureH0(input: {
  fixtureId: string;
  rawInput: string;
  meaning: string;
  targetRef: string;
  targetSurface: string;
  dialogueAct?: "INITIATE_CONVERSATION" | "ASK_QUESTION" | "MAKE_STATEMENT" | "REQUEST_ACTION" | "OTHER";
  informationNeed?: AiInformationNeedV8 | null;
}): ConversationSemanticFixtureH0 {
  return singleComponentFixture({
    fixtureId: input.fixtureId,
    rawInput: input.rawInput,
    overallMeaning: input.meaning,
    componentMeaning: input.meaning,
    suggestedDomain: "social",
    suggestedCapabilityId: "scene.visible-dialogue",
    targetRef: input.targetRef,
    targetSurface: input.targetSurface,
    dialogueAct: input.dialogueAct ?? "OTHER",
    informationNeed: input.informationNeed ?? null
  });
}

export function approachFixtureH0(input: {
  fixtureId: string;
  rawInput: string;
  meaning: string;
  targetRef: string;
  targetSurface: string;
}): ConversationSemanticFixtureH0 {
  return singleComponentFixture({
    fixtureId: input.fixtureId,
    rawInput: input.rawInput,
    overallMeaning: input.meaning,
    componentMeaning: input.meaning,
    suggestedDomain: "scene_resolution",
    suggestedCapabilityId: "scene.visible-actor-approach",
    targetRef: input.targetRef,
    targetSurface: input.targetSurface
  });
}

export function sceneTransitionFixtureH0(input: {
  fixtureId: string;
  rawInput: string;
  meaning: string;
  targetRef: string;
  targetSurface: string;
}): ConversationSemanticFixtureH0 {
  return singleComponentFixture({
    fixtureId: input.fixtureId,
    rawInput: input.rawInput,
    overallMeaning: input.meaning,
    componentMeaning: input.meaning,
    suggestedDomain: "world",
    suggestedCapabilityId: "world.scene-transition",
    targetRef: input.targetRef,
    targetSurface: input.targetSurface
  });
}

function singleComponentFixture(input: {
  fixtureId: string;
  rawInput: string;
  overallMeaning: string;
  componentMeaning: string;
  suggestedDomain: string;
  suggestedCapabilityId: string;
  targetRef: string;
  targetSurface: string;
  dialogueAct?: "INITIATE_CONVERSATION" | "ASK_QUESTION" | "MAKE_STATEMENT" | "REQUEST_ACTION" | "OTHER";
  informationNeed?: AiInformationNeedV8 | null;
}): ConversationSemanticFixtureH0 {
  return {
    rawInput: input.rawInput,
    frame: {
      schemaVersion: 1,
      understandingStatus: "UNDERSTOOD",
      overallMeaning: input.overallMeaning,
      overallCommitment: "committed",
      globalConditions: [],
      components: [{
        componentId: `h0:${input.fixtureId}`,
        order: 1,
        meaning: input.componentMeaning,
        commitment: "committed",
        conditions: [],
        negated: false,
        quoted: false,
        relationToPrevious: "NONE",
        alternativeGroupId: null,
        dependsOnComponentIds: [],
        simultaneousWithComponentIds: [],
        supersedesComponentIds: [],
        mentionedTargets: [{
          surface: input.targetSurface,
          proposedRef: input.targetRef
        }],
        suggestedDomain: input.suggestedDomain,
        suggestedAction: input.componentMeaning,
        suggestedCapabilityId: input.suggestedCapabilityId,
        dialogueAct: input.suggestedCapabilityId === "scene.visible-dialogue"
          ? {
              act: input.dialogueAct ?? "OTHER",
              contentGoal: input.componentMeaning
            }
          : null,
        informationNeed: input.informationNeed ?? null
      }],
      ambiguities: [],
      clarificationQuestion: null,
      confidence: "high"
    }
  };
}
