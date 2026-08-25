import assert from "node:assert/strict";
import type {
  AiCallRequestV1,
  AiOpenSemanticComponentV8,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV8
} from "../../src/ai/types";
import { validateAiRoleOutputEnvelopeV1 } from "../../src/ai/validation";

const contractVersion = "ai-intent-semantic/8";

function request(rawInput: string): AiCallRequestV1 {
  return {
    schemaVersion: 1,
    callId: "call:g2-v8",
    operationId: "operation:g2-v8",
    attemptId: "attempt:g2-v8",
    campaignId: "campaign:g2-v8",
    snapshotId: "snapshot:g2-v8",
    packId: "pack:g2-v8",
    role: "player_intent_interpreter",
    contractVersion,
    modelRouteId: "route:g2-v8",
    contextFingerprint: `sha256:${"1".repeat(64)}`,
    idempotencyKey: "idem:g2-v8",
    input: {
      instructionsRef: "ai-intent-semantic/player-intent-interpreter/v8",
      roleContextPack: {},
      task: { rawInput }
    },
    limits: { inputTokenBudget: 1_200, outputTokenBudget: 1_200, timeoutMs: 10_000 }
  };
}

function component(
  componentId: string,
  order: number,
  meaning: string,
  overrides: Partial<AiOpenSemanticComponentV8> = {}
): AiOpenSemanticComponentV8 {
  return {
    componentId,
    order,
    meaning,
    commitment: "committed",
    conditions: [],
    negated: false,
    quoted: false,
    relationToPrevious: order === 1 ? "NONE" : "THEN",
    alternativeGroupId: null,
    dependsOnComponentIds: [],
    simultaneousWithComponentIds: [],
    supersedesComponentIds: [],
    mentionedTargets: [],
    suggestedDomain: null,
    suggestedAction: null,
    suggestedCapabilityId: null,
    ...overrides
  };
}

function envelope(
  req: AiCallRequestV1,
  payload: AiSemanticIntentPayloadV8
): AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV8> {
  return {
    schemaVersion: 1,
    contractVersion,
    outputId: "output:g2-v8",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload,
    diagnostics: [],
    supersedesOutputId: null
  };
}

function understood(rawInput: string, components: AiOpenSemanticComponentV8[], overallMeaning = rawInput): AiSemanticIntentPayloadV8 {
  return {
    rawInputEcho: rawInput,
    semanticFrame: {
      schemaVersion: 1,
      understandingStatus: "UNDERSTOOD",
      overallMeaning,
      overallCommitment: components.some(value => value.commitment !== "committed") ? "mixed" : "committed",
      globalConditions: [],
      components,
      ambiguities: [],
      clarificationQuestion: null,
      confidence: "high"
    }
  };
}

function assertAccepted(payload: AiSemanticIntentPayloadV8): void {
  const req = request(payload.rawInputEcho);
  const result = validateAiRoleOutputEnvelopeV1(envelope(req, payload), req);
  assert.equal(result.accepted, true, result.issues.join("\n"));
}

assertAccepted(understood(
  "J'ouvre doucement le coffret.",
  [component("open-box", 1, "Le personnage tente d'ouvrir doucement le coffret.", {
    mentionedTargets: [{ surface: "le coffret", proposedRef: "poi:coffret" }],
    suggestedDomain: "interaction avec un objet visible",
    suggestedAction: "ouvrir doucement"
  })]
));

assertAccepted({
  ...understood(
    "Si la garde part, je traverse la cour.",
    [component("cross-yard", 1, "Le personnage traversera la cour si la garde part.", {
      commitment: "conditional",
      conditions: ["la garde est partie"],
      relationToPrevious: "CONDITION_RESULT"
    })]
  ),
  semanticFrame: {
    ...understood("", []).semanticFrame,
    understandingStatus: "UNDERSTOOD",
    overallMeaning: "Le personnage prévoit de traverser uniquement après le départ de la garde.",
    overallCommitment: "conditional",
    globalConditions: ["la garde est partie"],
    components: [component("cross-yard", 1, "Le personnage traversera la cour si la garde part.", {
      commitment: "conditional",
      conditions: ["la garde est partie"],
      relationToPrevious: "CONDITION_RESULT"
    })],
    clarificationQuestion: null
  }
});

assertAccepted(understood(
  "Je ne touche pas au levier.",
  [component("leave-lever", 1, "Le personnage exclut de toucher au levier.", {
    commitment: "none",
    negated: true,
    mentionedTargets: [{ surface: "au levier", proposedRef: "poi:levier" }]
  })]
));

assertAccepted(understood(
  "Soit je parle à l'intendante, soit j'attends dehors.",
  [
    component("speak", 1, "Première possibilité : parler à l'intendante.", {
      commitment: "hypothetical",
      alternativeGroupId: "choice-1"
    }),
    component("wait", 2, "Seconde possibilité : attendre dehors.", {
      commitment: "hypothetical",
      relationToPrevious: "ALTERNATIVE",
      alternativeGroupId: "choice-1"
    })
  ]
));

const longSequence = [
  component("look", 1, "Observer la salle."),
  component("wave", 2, "Faire signe à l'éclaireuse."),
  component("quote", 3, "Rapporter les mots « reste ici » sans en faire un ordre actuel.", { quoted: true }),
  component("listen", 4, "Écouter la réponse en même temps que la porte.", {
    relationToPrevious: "SIMULTANEOUS",
    simultaneousWithComponentIds: ["door"]
  }),
  component("door", 5, "Surveiller la porte pendant l'écoute.", {
    relationToPrevious: "SIMULTANEOUS",
    simultaneousWithComponentIds: ["listen"]
  }),
  component("correct", 6, "Corriger le projet initial et rester près de la sortie.", {
    relationToPrevious: "CORRECTION",
    supersedesComponentIds: ["wave"]
  })
];
assertAccepted(understood("J'observe, je fais signe, puis je change d'avis et je reste près de la sortie.", longSequence));
assert.equal(longSequence.length > 4, true, "La gate doit réellement dépasser la limite V7 de quatre composantes.");

const clarificationInput = "Je lui donne ça.";
assertAccepted({
  rawInputEcho: clarificationInput,
  semanticFrame: {
    schemaVersion: 1,
    understandingStatus: "NEEDS_CLARIFICATION",
    overallMeaning: "Le personnage veut donner un élément non identifié à un référent ambigu.",
    overallCommitment: "unclear",
    globalConditions: [],
    components: [],
    ambiguities: [{
      ambiguityId: "recipient-and-object",
      summary: "Le destinataire et l'objet ne sont pas identifiables dans le contexte public.",
      affectedComponentIds: []
    }],
    clarificationQuestion: "À qui veux-tu donner quoi ?",
    confidence: "low"
  }
});

console.log("Open semantic frame V8 G2: local contract validation passed.");
