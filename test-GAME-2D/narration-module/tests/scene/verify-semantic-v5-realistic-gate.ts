import assert from "node:assert/strict";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV5,
  ContractAiProviderV1
} from "../../src/ai";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5,
  createDefaultAiIntentInterpreterConfigV1,
  createPrototypeNarrativeTurnControllerV1,
  type AiNarrativeEnhancementResultV1,
  type NarrativeTurnControllerOutputV1
} from "../../src/application";

const inputs = {
  observe: "Je prends un instant pour voir qui se trouve dans la salle.",
  approachAndAsk: "Je rejoins la serveuse et lui demande si elle a un moment.",
  followUp: "Je lui demande ce qui attire sans cesse son regard vers la porte.",
  thankAndLeave: "Je la remercie, puis je m'éloigne pour la laisser travailler.",
  stalePronoun: "Je lui demande si je peux passer.",
  switchActor: "Je vais plutôt vers le garde, le salue et lui demande si tout va bien.",
  transition: "Je franchis la porte étroite pour entrer dans l'arrière-salle.",
  observeDestination: "Une fois à l'intérieur, j'observe attentivement les lieux."
} as const;

const fixtures = new Map<string, AiSemanticIntentPayloadV5>([
  [inputs.observe, payload(inputs.observe, {
    kind: "observe_environment",
    playerGoal: "Observer les personnes présentes dans la salle.",
    domainHint: "perception",
    scope: "PERCEPTION",
    targetMention: null,
    perception: perception("GLANCE", "personnes présentes", "PRESENCE"),
    dialogueAct: null,
    composition: composition()
  })],
  [inputs.approachAndAsk, payload(inputs.approachAndAsk, {
    kind: "address_visible_actor",
    playerGoal: "Rejoindre la serveuse et lui demander si elle est disponible.",
    domainHint: "social",
    scope: "SOCIAL_EXCHANGE",
    targetMention: target("la serveuse", "npc:npc-serveuse-nerveuse", "EXPLICIT"),
    perception: null,
    dialogueAct: dialogue("ASK_QUESTION", "Demander si la serveuse a un moment."),
    composition: composition({
      leadIn: ["Rejoindre la serveuse.", 1],
      speech: ["ASK_QUESTION", "Demander si la serveuse a un moment.", 2]
    })
  })],
  [inputs.followUp, payload(inputs.followUp, {
    kind: "address_visible_actor",
    playerGoal: "Demander à la même interlocutrice ce qui attire son regard vers la porte.",
    domainHint: "social",
    scope: "SOCIAL_EXCHANGE",
    targetMention: target("lui", "npc:npc-serveuse-nerveuse", "RECENT_FOCUS"),
    perception: null,
    dialogueAct: dialogue("ASK_QUESTION", "Demander ce qui attire son regard vers la porte."),
    composition: composition({
      speech: ["ASK_QUESTION", "Demander ce qui attire son regard vers la porte.", 1]
    })
  })],
  [inputs.thankAndLeave, payload(inputs.thankAndLeave, {
    kind: "address_visible_actor",
    playerGoal: "Remercier la serveuse puis s'en éloigner.",
    domainHint: "social",
    scope: "SOCIAL_EXCHANGE",
    targetMention: target("la", null, "RECENT_FOCUS"),
    perception: null,
    dialogueAct: dialogue("MAKE_STATEMENT", "Remercier la serveuse."),
    composition: composition({
      speech: ["MAKE_STATEMENT", "Remercier la serveuse.", 1],
      followUp: ["S'éloigner pour la laisser travailler.", 2]
    })
  })],
  [inputs.stalePronoun, payload(inputs.stalePronoun, {
    kind: "address_visible_actor",
    playerGoal: "Demander à cette personne l'autorisation de passer.",
    domainHint: "social",
    scope: "SOCIAL_EXCHANGE",
    targetMention: target("lui", "npc:npc-serveuse-nerveuse", "RECENT_FOCUS"),
    perception: null,
    dialogueAct: dialogue("REQUEST_ACTION", "Demander l'autorisation de passer."),
    composition: composition({
      speech: ["REQUEST_ACTION", "Demander l'autorisation de passer.", 1]
    }),
    uncertainties: ["L'interlocuteur visé n'est plus établi."],
    clarificationPrompt: "À qui demandes-tu l'autorisation de passer ?",
    confidence: "low"
  })],
  [inputs.switchActor, payload(inputs.switchActor, {
    kind: "address_visible_actor",
    playerGoal: "Approcher le garde, le saluer et lui demander s'il va bien.",
    domainHint: "social",
    scope: "SOCIAL_EXCHANGE",
    targetMention: target("le garde", "npc:npc-garde-blesse", "EXPLICIT"),
    perception: null,
    dialogueAct: dialogue("ASK_QUESTION", "Saluer le garde et lui demander s'il va bien."),
    composition: composition({
      leadIn: ["Approcher le garde.", 1],
      speech: ["ASK_QUESTION", "Saluer le garde et lui demander s'il va bien.", 2]
    })
  })],
  [inputs.transition, payload(inputs.transition, {
    kind: "traverse_visible_boundary",
    playerGoal: "Franchir la porte étroite et entrer dans l'arrière-salle.",
    domainHint: "world",
    scope: "SCENE_TRANSITION",
    targetMention: {
      surface: "la porte étroite",
      candidateKind: "object",
      proposedRef: "poi:back-room-door",
      contextLink: "EXPLICIT"
    },
    perception: null,
    dialogueAct: null,
    composition: composition()
  })],
  [inputs.observeDestination, payload(inputs.observeDestination, {
    kind: "observe_environment",
    playerGoal: "Observer attentivement les éléments visibles dans l'arrière-salle.",
    domainHint: "perception",
    scope: "PERCEPTION",
    targetMention: null,
    perception: perception("FOCUSED", "arrière-salle", "VISIBLE_TRAIT"),
    dialogueAct: null,
    composition: composition()
  })]
]);

const provider: ContractAiProviderV1 = {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    const rawInput = (request.input.task as { rawInput: string }).rawInput;
    const fixture = fixtures.get(rawInput);
    if (!fixture) throw new Error(`Fixture V5 réaliste absente: ${rawInput}`);
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
      payload: fixture,
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV5>;
  }
};

async function main(): Promise<void> {
  const base = createDefaultAiIntentInterpreterConfigV1();
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: {
      ...base,
      provider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5,
      route: {
        ...base.route,
        allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5],
        outputTokenLimit: 900
      }
    }
  });

  const observe = await turn(controller, "gate-v5-01", inputs.observe);
  assert.equal(observe.interpretation.requiresClarification, false);
  assert.equal(npcBlocks(observe).length, 0);
  assert.equal(observe.noCommit, true);
  assert.equal(observe.noGameTime, true);
  assertNarrativeOnly(observe);

  const approach = await turn(controller, "gate-v5-02", inputs.approachAndAsk);
  assert.equal(resolvedRef(approach), "npc:npc-serveuse-nerveuse");
  assert.deepEqual(componentKinds(approach), ["APPROACH_TARGET", "SPEECH"]);
  assertBefore(approach, "GM_NARRATION", "NPC_SPEECH");
  assert.equal(npcBlocks(approach)[0]?.speaker.displayName, "Serveuse nerveuse");

  const followUp = await turn(controller, "gate-v5-03", inputs.followUp);
  assert.equal(resolvedRef(followUp), "npc:npc-serveuse-nerveuse");
  assert.equal(followUp.interpretation.referentResolution?.usedPreviousContext, true);
  assert.equal(npcBlocks(followUp)[0]?.speaker.displayName, "Serveuse nerveuse");

  const departure = await turn(controller, "gate-v5-04", inputs.thankAndLeave);
  assert.deepEqual(componentKinds(departure), ["SPEECH", "REPOSITION_AWAY"]);
  assertBefore(departure, "NPC_SPEECH", "GM_NARRATION");
  assert.match(gmBlocks(departure).at(-1)?.text ?? "", /écartes|éloignes/iu);

  const stalePronoun = await turn(controller, "gate-v5-05", inputs.stalePronoun);
  assert.equal(stalePronoun.interpretation.requiresClarification, true);
  assert.notEqual(
    stalePronoun.interpretation.runtimeDecision.status,
    "AI_INTERPRETATION_FAILED",
    "une intention exploitable mais peu sûre devient une clarification, pas une panne IA"
  );
  assert.equal(stalePronoun.resolution.resultKind, "CLARIFICATION_REQUIRED");
  assert.equal(resolvedRef(stalePronoun), null);
  assert.equal(npcBlocks(stalePronoun).length, 0);
  assert.equal(stalePronoun.noCommit, true);
  assert.equal(stalePronoun.noGameTime, true);

  const switched = await turn(controller, "gate-v5-06", inputs.switchActor);
  assert.equal(resolvedRef(switched), "npc:npc-garde-blesse");
  assert.equal(npcBlocks(switched)[0]?.speaker.displayName, "Garde blessé");
  assertBefore(switched, "GM_NARRATION", "NPC_SPEECH");

  const transition = await turn(controller, "gate-v5-07", inputs.transition);
  assert.equal(transition.sceneArrival?.scene.sceneId, "reference-inn-back-room-001");
  assert.equal(transition.sceneArrival?.enteredAtGameSecond, 8);
  assert.equal(transition.noGameTime, false);
  assert.equal(transition.resolution.resultKind, "COMMIT_APPLIED");

  const destination = await turn(controller, "gate-v5-08", inputs.observeDestination);
  assert.equal(destination.activeScene.sceneId, "reference-inn-back-room-001");
  assert.equal(destination.displayPacket.sceneId, "reference-inn-back-room-001");
  assert.equal(gmBlocks(destination).some(block => /lampe|traces|arrière-salle/iu.test(block.text)), true);
  assertNarrativeOnly(destination);

  console.log("semantic-v5/realistic-gate: OK (8 tours, focus libéré, interlocuteur changé, transition cohérente)");
}

async function turn(
  controller: Awaited<ReturnType<typeof createPrototypeNarrativeTurnControllerV1>>,
  clientRequestId: string,
  rawInput: string
): Promise<NarrativeTurnControllerOutputV1> {
  const submitted = await controller.submit({ schemaVersion: 1, clientRequestId, rawInput });
  if (!submitted.ok) throw new Error(`${clientRequestId}: ${submitted.error.messageKey} ${JSON.stringify(submitted.error.details)}`);
  const output = submitted.value.output;
  assert.ok(output.stageTimings, `${clientRequestId}: métriques contrôleur absentes`);
  const timings = {
    interpretationMs: output.stageTimings.interpretationMs,
    planningMs: output.stageTimings.planningMs,
    resolutionMs: output.stageTimings.resolutionMs,
    npcPerformanceMs: output.stageTimings.npcPerformanceMs,
    resolvedOutputMs: output.stageTimings.resolvedOutputMs
  };
  for (const [name, value] of Object.entries(timings)) {
    assert.equal(typeof value, "number", `${clientRequestId}: métrique ${name} non numérique`);
    assert.ok(value >= 0, `${clientRequestId}: métrique négative`);
  }
  await recordProjection(controller, output);
  return output;
}

async function recordProjection(
  controller: Awaited<ReturnType<typeof createPrototypeNarrativeTurnControllerV1>>,
  output: NarrativeTurnControllerOutputV1
): Promise<void> {
  const finalEnhancement: AiNarrativeEnhancementResultV1 = {
    schemaVersion: 1,
    contractVersion: "narrative-ai-resolution/1",
    enhanced: false,
    usedFallback: false,
    fallbackKind: "NONE",
    displayPacket: output.displayPacket,
    incidents: [],
    safetyNotes: ["Projection déterministe de gate V5."]
  };
  const recorded = await controller.recordRenderedProjection({
    schemaVersion: 1,
    clientRequestId: output.clientRequestId,
    sourceOutput: output,
    mode: "local",
    finalEnhancement,
    attemptedEnhancement: null,
    statusMessage: "Projection déterministe enregistrée."
  });
  if (!recorded.ok) throw new Error(`${output.clientRequestId}: ${recorded.error.messageKey}`);
}

function payload(
  rawInput: string,
  overrides: Omit<AiSemanticIntentPayloadV5["intent"], "commitment" | "preconditions" | "actionHint" | "uncertainties" | "clarificationPrompt" | "confidence"> & {
    uncertainties?: string[];
    clarificationPrompt?: string | null;
    confidence?: "low" | "medium" | "high";
  }
): AiSemanticIntentPayloadV5 {
  return {
    rawInputEcho: rawInput,
    intent: {
      ...overrides,
      commitment: "committed",
      preconditions: [],
      actionHint: null,
      uncertainties: overrides.uncertainties ?? [],
      clarificationPrompt: overrides.clarificationPrompt ?? null,
      confidence: overrides.confidence ?? "high"
    }
  };
}

function target(
  surface: string,
  proposedRef: string | null,
  contextLink: "EXPLICIT" | "RECENT_FOCUS"
): NonNullable<AiSemanticIntentPayloadV5["intent"]["targetMention"]> {
  return { surface, candidateKind: "npc", proposedRef, contextLink };
}

function dialogue(
  act: NonNullable<AiSemanticIntentPayloadV5["intent"]["dialogueAct"]>["act"],
  contentGoal: string
): NonNullable<AiSemanticIntentPayloadV5["intent"]["dialogueAct"]> {
  return { act, contentGoal };
}

function perception(
  depth: "GLANCE" | "FOCUSED",
  focus: string,
  informationKind: "PRESENCE" | "VISIBLE_TRAIT"
): NonNullable<AiSemanticIntentPayloadV5["intent"]["perception"]> {
  return { schemaVersion: 1, depth, focus, soughtInformation: focus, informationKind };
}

function composition(input: {
  leadIn?: [goal: string, order: number];
  speech?: [
    act: "INITIATE_CONVERSATION" | "ASK_QUESTION" | "MAKE_STATEMENT" | "REQUEST_ACTION" | "OTHER",
    goal: string,
    order: number
  ];
  followUp?: [goal: string, order: number];
} = {}): AiSemanticIntentPayloadV5["intent"]["composition"] {
  return {
    orientation: null,
    spatialLeadIn: input.leadIn === undefined ? null : {
      kind: "APPROACH_TARGET",
      playerGoal: input.leadIn[0],
      order: input.leadIn[1]
    },
    communication: input.speech === undefined ? null : {
      mode: "SPEECH",
      act: input.speech[0],
      contentGoal: input.speech[1],
      order: input.speech[2]
    },
    spatialFollowUp: input.followUp === undefined ? null : {
      kind: "REPOSITION_AWAY",
      playerGoal: input.followUp[0],
      order: input.followUp[1]
    }
  };
}

function componentKinds(output: NarrativeTurnControllerOutputV1): string[] {
  return output.interpretation.semanticIntent.composition?.orderedComponents.map(component => component.kind) ?? [];
}

function resolvedRef(output: NarrativeTurnControllerOutputV1): string | null {
  return output.interpretation.referentResolution?.resolvedTarget?.ref
    ?? output.interpretation.semanticIntent.target?.ref
    ?? null;
}

function npcBlocks(output: NarrativeTurnControllerOutputV1) {
  return output.displayPacket.displayBlocks.filter(block => block.kind === "NPC_SPEECH");
}

function gmBlocks(output: NarrativeTurnControllerOutputV1) {
  return output.displayPacket.displayBlocks.filter(block => block.kind === "GM_NARRATION");
}

function assertBefore(
  output: NarrativeTurnControllerOutputV1,
  first: "GM_NARRATION" | "NPC_SPEECH",
  second: "GM_NARRATION" | "NPC_SPEECH"
): void {
  const kinds = output.displayPacket.displayBlocks.map(block => block.kind);
  assert.ok(kinds.indexOf(first) >= 0, `${output.clientRequestId}: bloc ${first} absent`);
  assert.ok(kinds.indexOf(second) >= 0, `${output.clientRequestId}: bloc ${second} absent`);
  assert.ok(kinds.indexOf(first) < kinds.lastIndexOf(second), `${output.clientRequestId}: ordre ${first} → ${second} perdu`);
}

function assertNarrativeOnly(output: NarrativeTurnControllerOutputV1): void {
  const text = gmBlocks(output).map(block => block.text).join(" ");
  assert.doesNotMatch(text, /function_principale|rumeurs|APPROACH_TARGET|REPOSITION_AWAY|playerGoal/iu);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
