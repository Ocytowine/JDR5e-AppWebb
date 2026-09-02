"use strict";

const assert = require("node:assert/strict");
const {
  buildOpenAiResponsesBody,
  buildRoleInstructions,
  buildServerRoute,
  buildStrictAiOutputSchema,
  createNarrativeOpenAiEnhancementApi,
  normalizeAiCallRequest,
  normalizeProviderEnvelope,
  validateEnvelope
} = require("../../server/narrativeOpenAiEnhancementRoute");

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    callId: "call-route-expression-001",
    operationId: "operation-route-expression-001",
    attemptId: "attempt-route-expression-001",
    campaignId: "campaign-route-001",
    snapshotId: "snapshot-route-001",
    packId: "pack-route-001",
    role: "player_expression_adapter",
    contractVersion: "narrative-ai-resolution/1",
    modelRouteId: "client-route-placeholder",
    contextFingerprint: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    idempotencyKey: "idem-route-expression-001",
    input: {
      instructionsRef: "narrative-ai-resolution/player-expression-adapter/v1",
      roleContextPack: {},
      task: { rawPlayerText: "Je dis au garde que je cherche les archives" }
    },
    limits: {
      inputTokenBudget: 3_000,
      outputTokenBudget: 400,
      timeoutMs: 1_000
    },
    ...overrides
  };
}

function outputFor(req) {
  return {
    schemaVersion: 1,
    contractVersion: req.contractVersion,
    outputId: "output-route-expression-001",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload: {
      intentId: "intent-route-expression-001",
      expressionKind: "speech",
      renderedExpression: "Je formule calmement ma demande au garde: je cherche les archives.",
      meaningCovered: ["chercher les archives"],
      addedMeaning: [],
      omittedMeaning: [],
      styleChoices: ["calme"],
      safeToUse: true
    },
    diagnostics: [],
    supersedesOutputId: null
  };
}

function sceneOutputFor(req, overrides = {}) {
  return {
    schemaVersion: 1,
    contractVersion: req.contractVersion,
    outputId: "output-route-scene-001",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload: {
      narrationBlocks: [{
        slotId: "scene-weather",
        blockKind: "MJ_NARRATION",
        content: "La pluie frappe les volets de l'auberge.",
        groundedIn: ["resolution:route-scene-001"],
        usesCreativeTexture: true,
        factDiscipline: safeFactDiscipline()
      }],
      ...(overrides.payload || {})
    },
    diagnostics: [],
    supersedesOutputId: null,
    ...overrides
  };
}

function safeFactDiscipline(overrides = {}) {
  return {
    addedUnsupportedFacts: [],
    usesOnlyProvidedVisibleEntities: true,
    noNewEvents: true,
    noHiddenPresence: true,
    notes: [],
    ...overrides
  };
}

function intentRequest(overrides = {}) {
  return request({
    callId: "call-route-intent-001",
    operationId: "operation-route-intent-001",
    attemptId: "attempt-route-intent-001",
    snapshotId: "snapshot-route-intent-001",
    packId: "pack-route-intent-001",
    role: "player_intent_interpreter",
    contractVersion: "ai-intent-interpretation/1",
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 900, timeoutMs: 30_000 },
    input: {
      instructionsRef: "ai-intent-interpretation/player-intent-interpreter/v1",
      roleContextPack: {
        sceneId: "reference-inn-rain-001",
        presentNpc: [{ actorId: "npc-garde-blesse", displayName: "Garde blessé", keywords: ["garde", "lui"] }]
      },
      task: {
        rawInput: "Je m'approche du garde et je lui demande s'il a vu quelque chose d'étrange.",
        allowedIntentTypes: ["meta_question", "possibility_query", "memory_recall", "speech", "action", "mixed", "unclear_commitment"],
        forbiddenAuthority: ["commit", "time", "inventory", "tactical", "durable_lore", "social_success"]
      }
    },
    ...overrides
  });
}

function intentOutputFor(req, overrides = {}) {
  const intent = {
    intentId: "intent:1",
    order: 1,
    intentType: "speech",
    commitment: "committed",
    target: { kind: "npc", ref: "npc:npc-garde-blesse", label: "garde" },
    action: "ask",
    referentResolution: {
      schemaVersion: 1,
      usedPreviousContext: false,
      source: "current_input",
      resolvedTarget: { kind: "npc", ref: "npc:npc-garde-blesse", label: "garde" },
      evidence: [req.input.task.rawInput, "garde"],
      ambiguity: "none",
      confidence: "high"
    },
    topic: "s'il a vu quelque chose d'étrange",
    coreMeaning: "Le personnage demande au garde s'il a vu quelque chose d'étrange.",
    playerImposedDetails: ["s'approcher du garde", "poser une question"],
    openDetails: [],
    forbiddenInterpretations: ["le garde répond", "un succès social est acquis"],
    requiresClarification: false,
    clarificationQuestion: null,
    riskFlags: [],
    expectedTimeEffect: "DOMAIN_TO_DECIDE",
    confidence: "high",
    ...overrides.intent
  };
  if (!intent.semanticIntent) intent.semanticIntent = semanticIntentFor(req, intent);
  if (!intent.runtimeHandling) intent.runtimeHandling = runtimeHandlingFor(intent);
  return {
    schemaVersion: 1,
    contractVersion: req.contractVersion,
    outputId: "output-route-intent-001",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload: {
      rawInputEcho: req.input.task.rawInput,
      intents: [intent]
    },
    diagnostics: [],
    supersedesOutputId: null
  };
}

function mjPlannerRequest(overrides = {}) {
  const baseIntentReq = intentRequest();
  const interpretation = intentOutputFor(baseIntentReq).payload.intents[0];
  return request({
    callId: "call-route-mj-planner-001",
    operationId: "operation-route-mj-planner-001",
    attemptId: "attempt-route-mj-planner-001",
    snapshotId: "snapshot-route-mj-planner-001",
    packId: "pack-route-mj-planner-001",
    role: "mj_planner",
    contractVersion: "mj-planner/1",
    limits: { inputTokenBudget: 4_000, outputTokenBudget: 1_000, timeoutMs: 30_000 },
    input: {
      instructionsRef: "mj-planner/minimal/v1",
      roleContextPack: {
        schemaVersion: 1,
        role: "mj_planner",
        authority: "PLAN_ONLY"
      },
      task: {
        rawInput: baseIntentReq.input.task.rawInput,
        interpretation,
        requiredOutput: "structured_mj_plan_without_commit"
      }
    },
    ...overrides
  });
}

function mjPlannerOutputFor(req, overrides = {}) {
  const interpretation = req.input.task.interpretation;
  const runtimeHandling = interpretation.runtimeHandling;
  return {
    schemaVersion: 1,
    contractVersion: req.contractVersion,
    outputId: "output-route-mj-planner-001",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload: {
      schemaVersion: 1,
      planId: `${interpretation.intentId}:mj-plan:route`,
      planningBasis: {
        intentId: interpretation.intentId,
        semanticGoal: interpretation.coreMeaning,
        runtimeStatus: runtimeHandling.status,
        requiredDomain: runtimeHandling.requiredDomain
      },
      sceneBeats: [{
        beatId: "beat:actor-reaction",
        kind: "ACTOR_REACTION_EXPECTED",
        actorIds: ["npc:npc-garde-blesse"],
        stopCondition: "Rendre la main après proposition de réaction PNJ, sans résultat social."
      }],
      commandProposals: [{
        proposalId: `${interpretation.intentId}:proposal:route`,
        domain: runtimeHandling.requiredDomain,
        commandType: "social.intent.request_actor_reaction",
        targetRefs: ["npc:npc-garde-blesse"],
        payload: {
          intentType: interpretation.intentType,
          coreMeaning: interpretation.coreMeaning
        },
        commitAuthority: false
      }],
      creationProposals: [],
      actorAssignments: [{
        role: "npc_performer",
        actorId: "npc:npc-garde-blesse",
        reason: "Réaction PNJ potentielle à traiter séparément."
      }],
      revealPlan: {
        reveal: [],
        hint: [],
        withhold: ["résultat social", "secret", "fait durable"]
      },
      timeAdvanceProposal: null,
      playerHandoff: {
        handoffKind: "END_TURN",
        reason: "Plan minimal non committable."
      },
      riskFlags: [],
      respectedCommitmentRefs: [`intent:${interpretation.intentId}`],
      forbiddenOutcomes: [
        "commit_direct",
        "narrate_unvalidated_success",
        "advance_time_without_domain",
        "reveal_secret",
        "create_persistent_fact"
      ],
      ...(overrides.payload || {})
    },
    diagnostics: [],
    supersedesOutputId: null,
    ...overrides
  };
}

function npcPerformerRequest(overrides = {}) {
  const plannerReq = mjPlannerRequest();
  return request({
    callId: "call-route-npc-performer-001",
    operationId: "operation-route-npc-performer-001",
    attemptId: "attempt-route-npc-performer-001",
    snapshotId: "snapshot-route-npc-performer-001",
    packId: "pack-route-npc-performer-001",
    role: "npc_performer",
    contractVersion: "npc-performer/1",
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 2_000, timeoutMs: 30_000 },
    input: {
      instructionsRef: "npc-performer/minimal/v1",
      roleContextPack: {
        schemaVersion: 1,
        role: "npc_performer",
        authority: "PERFORM_VISIBLE_ACTOR_ONLY",
        actorId: "npc:npc-garde-blesse"
      },
      task: {
        rawInput: plannerReq.input.task.rawInput,
        actorId: "npc:npc-garde-blesse",
        interpretation: plannerReq.input.task.interpretation,
        dialogueAct: plannerReq.input.task.interpretation.semanticIntent.dialogueAct,
        mjPlan: mjPlannerOutputFor(plannerReq).payload,
        resolution: {
          schemaVersion: 1,
          resultKind: "COMMIT_APPLIED",
          noGameTime: true,
          safetyNotes: ["Parole bornée."]
        },
        sceneState: {
          schemaVersion: 1,
          shortTermNpcMemory: []
        },
        conversationProfileContract: {
          schemaVersion: 1,
          expectedProfileId: "npc:npc-garde-blesse:conversation",
          expectedRevision: 1,
          expectedContinuitySource: "INITIALIZED",
          outputProfileRef: "npc-conversation-profile:npc:npc-garde-blesse:conversation:revision:1",
          priorProfile: null,
          authority: "EPHEMERAL_PRESENTATION_ONLY",
          durablePromotionAllowed: false
        },
        knowledgeEnvelope: {
          allowedSourceRefs: [
            "reference-scene:reference-inn-rain-001",
            `intent:${plannerReq.input.task.interpretation.intentId}`,
            "npc-conversation-profile:npc:npc-garde-blesse:conversation:revision:1"
          ],
          allowedSubjectRefs: ["reference-scene:reference-inn-rain-001"],
          publicFactRefs: ["reference-scene:reference-inn-rain-001"],
          priorPlayerSpeech: [],
          priorNpcUtterances: [],
          memoryLimit: "Aucune réplique antérieure disponible."
        },
        requiredOutput: "bounded_visible_npc_reaction_without_commit"
      }
    },
    ...overrides
  });
}

function npcPerformerOutputFor(req, overrides = {}) {
  return {
    schemaVersion: 1,
    contractVersion: req.contractVersion,
    outputId: "output-route-npc-performer-001",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload: {
      schemaVersion: 1,
      performanceId: "performance-route-npc-001",
      actorId: req.input.task.actorId,
      reactionFrame: {
        schemaVersion: 1,
        sourceDialogueAct: req.input.task.dialogueAct.act,
        responseMode: "ANSWER_QUESTION",
        addressedContentGoal: req.input.task.dialogueAct.contentGoal
      },
      conversationProfile: {
        schemaVersion: 1,
        profileId: req.input.task.conversationProfileContract.expectedProfileId,
        actorId: req.input.task.actorId,
        lifecycle: "EPHEMERAL_DIALOGUE",
        continuityRevision: req.input.task.conversationProfileContract.expectedRevision,
        continuitySource: req.input.task.conversationProfileContract.expectedContinuitySource,
        perspectiveSummary: "Le garde aborde l'échange avec la vigilance d'un homme blessé qui protège le calme de la salle.",
        currentConcerns: ["Éviter qu'un nouvel esclandre éclate dans la salle."],
        subjectiveOpinions: [{
          topic: "la porte du fond",
          stance: "Elle attire déjà trop l'attention à son goût."
        }],
        conversationHooks: ["La porte du fond.", "Le calme de la salle."],
        boundaries: ["Ne pas présenter une supposition comme un fait."],
        speechStyle: ["bref", "méfiant"],
        relationshipTone: "GUARDED",
        durable: false
      },
      utterances: [{
        utteranceId: "utterance-route-npc-001",
        text: "Le garde serre les dents. « La porte du fond. Mais pas d'esclandre ici. »",
        audience: ["player-character"],
        speechActs: [{
          type: "assertion",
          content: "La porte du fond. Mais pas d'esclandre ici.",
          epistemicBasis: "known",
          sourceRefs: ["reference-scene:reference-inn-rain-001"]
        }]
      }],
      nonVerbalReactions: ["mâchoire crispée"],
      durableCommitments: [],
      revealedRefs: [],
      knowledgeUsed: ["reference-scene:reference-inn-rain-001"],
      knowledgeClaims: [{
        utteranceId: "utterance-route-npc-001",
        speechActIndex: 0,
        subject: {
          mode: "KNOWN_REF",
          ref: "reference-scene:reference-inn-rain-001",
          kind: "PLACE",
          label: "Auberge du Seuil"
        }
      }],
      safetyConstraints: {
        noMechanicalSuccess: true,
        noSecretReveal: true,
        noDurableCommitment: true,
        noStateMutation: true
      },
      ...(overrides.payload || {})
    },
    diagnostics: [],
    supersedesOutputId: null,
    ...overrides
  };
}

function semanticIntentFor(req, intent) {
  const kind = semanticKindFor(intent);
  return {
    schemaVersion: 1,
    kind,
    playerGoal: intent.coreMeaning,
    target: intent.target,
    commitment: intent.commitment,
    evidenceFromInput: [req.input.task.rawInput],
    uncertainties: intent.requiresClarification ? ["intention à clarifier"] : [],
    forbiddenInterpretations: [...intent.forbiddenInterpretations],
    confidence: intent.confidence,
    perception: kind === "observe_environment"
      ? { schemaVersion: 1, depth: "FOCUSED", focus: intent.coreMeaning, soughtInformation: null }
      : null,
    dialogueAct: kind === "address_visible_actor"
      ? {
        schemaVersion: 1,
        act: intent.action === "ask" ? "ASK_QUESTION" : "INITIATE_CONVERSATION",
        contentGoal: intent.coreMeaning,
        addresseeRef: intent.target?.ref ?? null
      }
      : null,
    restPlan: null
  };
}

function semanticKindFor(intent) {
  if (intent.intentType === "speech") return "address_visible_actor";
  if (intent.intentType === "possibility_query") return "hypothetical_action";
  if (intent.intentType === "meta_question") return "context_question";
  if (intent.intentType === "action" && intent.action === "observe") return "observe_environment";
  if (intent.intentType === "action") return "manipulate_visible_object";
  if (intent.intentType === "unclear_commitment") return "unclear_intent";
  return "unclear_intent";
}

function runtimeHandlingFor(intent) {
  const noCommit = intent.commitment !== "committed";
  return {
    schemaVersion: 1,
    status: intent.requiresClarification ? "NEEDS_CLARIFICATION" : "SUPPORTED_BY_CURRENT_RUNTIME",
    reason: intent.requiresClarification ? "Clarification joueur requise." : "Intention exploitable par le runtime courant.",
    requiredDomain: intent.commitment === "committed" ? "scene_resolution" : null,
    canonicalActionHint: intent.action,
    noCommit,
    noGameTime: intent.expectedTimeEffect === "NO_GAME_TIME"
  };
}

function mockReq(body) {
  return {
    method: "POST",
    url: "/api/narration/enhance-openai",
    body
  };
}

function mockRes() {
  return {
    statusCode: null,
    payload: null
  };
}

async function runRoute(api, body) {
  const res = mockRes();
  await api.tryHandle(mockReq(body), res);
  return res;
}

function sceneCreatorOutputFor(req, overrides = {}) {
  const output = {
    schemaVersion: 1,
    contractVersion: req.contractVersion,
    outputId: "output-route-scene-creator-001",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload: {
      proposalId: "proposal-place-001",
      requestedDepth: "LIGHT_REFERENCE",
      displayName: "Passage des Copistes",
      summary: "Un passage public proche des Archives.",
      initialTension: "La circulation est ralentie par la pluie.",
      perceptibleFeatures: ["pierre claire"],
      populationRoles: ["copiste"],
      localNorms: ["circulation ordonnée"],
      proposedPlaceRef: "location:passage_des_copistes",
      arrivalSceneId: "dynamic-place:passage_des_copistes",
      parentLocationRef: "location:quartier_des_archives",
      connectionIntents: [{
        sourceSceneId: "wiki-location:archives_de_lysenthe",
        boundaryRef: "poi:archives_de_lysenthe:poi:1",
        destinationRef: "location:passage_des_copistes",
        scale: "LOCAL",
        sourceRefs: ["lore:archives_de_lysenthe"]
      }],
      reason: "Créer la destination extérieure demandée.",
      expectedEffects: ["destination jouable"],
      narrativeCommitments: ["identité stable du lieu"],
      duplicatePolicy: "REJECT_IF_SIMILAR",
      ...(overrides.payload || {})
    },
    diagnostics: [],
    supersedesOutputId: null,
    ...overrides
  };
  if (req.contractVersion === "lore-guided-place-candidate/2" && !overrides.payload?.connectionIntents) {
    delete output.payload.connectionIntents;
  }
  return output;
}

function sceneCreatorRequest(overrides = {}) {
  return request({
    role: "scene_creator",
    contractVersion: "lore-guided-place-candidate/1",
    input: { instructionsRef: "scene-creator/lore-guided-place/v1", roleContextPack: { brief: {}, allowedParentLocationRefs: ["location:quartier_des_archives"], allowedPersistenceDepths: ["LIGHT_REFERENCE", "FULL_ENTITY"] }, task: { requiredOutput: "lore-guided-place-candidate/1" } },
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 1_500, timeoutMs: 30_000 },
    ...overrides
  });
}

function sceneCreatorRequestV2(overrides = {}) {
  return sceneCreatorRequest({
    contractVersion: "lore-guided-place-candidate/2",
    input: { instructionsRef: "scene-creator/lore-guided-place/v2", roleContextPack: { brief: {}, allowedParentLocationRefs: ["location:quartier_des_archives"], allowedPersistenceDepths: ["LIGHT_REFERENCE", "FULL_ENTITY"] }, task: { requiredOutput: "lore-guided-place-candidate/2" } },
    ...overrides
  });
}

function destinationArbiterRequest(overrides = {}) {
  return request({
    role: "destination_arbiter",
    contractVersion: "destination-plausibility-arbitration/1",
    input: {
      instructionsRef: "destination-arbiter/plausibility/v1",
      roleContextPack: {
        allowedParentLocationRefs: ["location:quartier_des_archives"],
        allowedSourceRefs: ["wiki:quartier_des_archives"],
        knownPlaces: []
      },
      task: { requiredOutput: "destination-plausibility-arbitration/1" }
    },
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 800, timeoutMs: 30_000 },
    ...overrides
  });
}

function destinationArbiterOutput(overrides = {}) {
  const req = destinationArbiterRequest();
  return {
    schemaVersion: 1,
    contractVersion: req.contractVersion,
    outputId: "output-destination-arbiter",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload: {
      outcome: "CREATE_LOCAL",
      allowedParentLocationRef: "location:quartier_des_archives",
      reason: "La destination est compatible avec le quartier.",
      accessHint: null,
      sourceRefs: ["wiki:quartier_des_archives"]
    },
    diagnostics: [],
    supersedesOutputId: null,
    ...overrides
  };
}

function semanticIntentRequest(overrides = {}) {
  return intentRequest({
    contractVersion: "ai-intent-semantic/2",
    input: {
      instructionsRef: "ai-intent-interpretation/player-intent-semantic/v2",
      roleContextPack: {},
      task: { rawInput: "Si la porte paraît sûre, j'essaie de l'entrouvrir.", outputContract: "ai-intent-semantic/2" }
    },
    limits: { inputTokenBudget: 1_000, outputTokenBudget: 900, timeoutMs: 30_000 },
    ...overrides
  });
}

function semanticIntentRequestV3(overrides = {}) {
  return intentRequest({
    contractVersion: "ai-intent-semantic/3",
    input: {
      instructionsRef: "ai-intent-interpretation/player-intent-semantic/v3",
      roleContextPack: {},
      task: { rawInput: "Je m'avance vers l'archiviste, puis je le salue.", outputContract: "ai-intent-semantic/3" }
    },
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 900, timeoutMs: 30_000 },
    ...overrides
  });
}

function semanticIntentRequestV4(overrides = {}) {
  return intentRequest({
    contractVersion: "ai-intent-semantic/4",
    input: {
      instructionsRef: "ai-intent-interpretation/player-intent-semantic/v4",
      roleContextPack: {},
      task: { rawInput: "Je cherche un archiviste pour poursuivre mes recherches.", outputContract: "ai-intent-semantic/4" }
    },
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 900, timeoutMs: 30_000 },
    ...overrides
  });
}

function semanticIntentRequestV5(overrides = {}) {
  return intentRequest({
    contractVersion: "ai-intent-semantic/5",
    input: {
      instructionsRef: "ai-intent-interpretation/player-intent-semantic/v5",
      roleContextPack: {},
      task: { rawInput: "Je remercie l'archiviste puis je m'écarte.", outputContract: "ai-intent-semantic/5" }
    },
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 900, timeoutMs: 30_000 },
    ...overrides
  });
}

function semanticIntentRequestV6(overrides = {}) {
  return intentRequest({
    contractVersion: "ai-intent-semantic/6",
    input: {
      instructionsRef: "ai-intent-interpretation/player-intent-semantic/v6",
      roleContextPack: {},
      task: {
        rawInput: "Marel, examine ces registres avec moi.",
        activeCompanionRefs: ["npc:marel"],
        outputContract: "ai-intent-semantic/6"
      }
    },
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 900, timeoutMs: 30_000 },
    ...overrides
  });
}

function semanticIntentRequestV7(overrides = {}) {
  return intentRequest({
    contractVersion: "ai-intent-semantic/7",
    input: {
      instructionsRef: "ai-intent-interpretation/player-intent-semantic/v7",
      roleContextPack: {},
      task: {
        rawInput: "Archiviste, reste ici pendant que je poursuis.",
        activeCompanionRefs: ["npc:archiviste"],
        outputContract: "ai-intent-semantic/7"
      }
    },
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 900, timeoutMs: 30_000 },
    ...overrides
  });
}

function assertEveryArraySchemaHasItems(schema, path = "schema") {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
  if (schema.type === "array") {
    assert.equal(Object.hasOwn(schema, "items"), true, `${path}: array schema must declare items for OpenAI strict mode`);
  }
  for (const [key, value] of Object.entries(schema)) {
    assertEveryArraySchemaHasItems(value, `${path}.${key}`);
  }
}

function assertOpenAiStrictObjectShape(schema, path = "schema") {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
  if (schema.type === "object") {
    assert.equal(schema.additionalProperties, false, `${path}: strict object must set additionalProperties=false`);
    const propertyNames = Object.keys(schema.properties ?? {}).sort();
    const requiredNames = [...(schema.required ?? [])].sort();
    assert.deepEqual(requiredNames, propertyNames, `${path}: strict object must require every declared property`);
  }
  for (const [key, value] of Object.entries(schema)) {
    assertOpenAiStrictObjectShape(value, `${path}.${key}`);
  }
}

async function main() {
  const semanticRequest = semanticIntentRequest();
  const normalizedContact = normalizeProviderEnvelope({
    ...outputFor(semanticRequest),
    payload: {
      rawInputEcho: "je m'avance vers l'archiviste, je le salue",
      intent: {
        kind: "nonverbal_signal",
        commitment: "committed",
        preconditions: [],
        playerGoal: "S'approcher de l'archiviste et le saluer.",
        actionHint: "saluer",
        domainHint: "social",
        scope: "LOCAL_INTERACTION",
        targetMention: { surface: "l'archiviste", candidateKind: "npc", proposedRef: "npc:archiviste", contextLink: "EXPLICIT" },
        perception: null,
        dialogueAct: { schemaVersion: 1, act: "INITIATE_CONVERSATION", contentGoal: "Saluer l'archiviste.", explicitQuestion: null },
        uncertainties: [],
        clarificationPrompt: null,
        confidence: "high"
      }
    }
  }, semanticRequest);
  assert.equal(normalizedContact.payload.intent.kind, "address_visible_actor");
  assert.equal(normalizedContact.payload.intent.scope, "SOCIAL_EXCHANGE");
  assert.equal(normalizedContact.payload.intent.dialogueAct.act, "INITIATE_CONVERSATION");
  assert.equal(validateEnvelope(normalizedContact, semanticRequest).ok, true);

  [request(), intentRequest(), semanticIntentRequestV3(), semanticIntentRequestV4(), semanticIntentRequestV5(), semanticIntentRequestV6(), semanticIntentRequestV7(), mjPlannerRequest(), npcPerformerRequest(), sceneCreatorRequest(), sceneCreatorRequestV2(), destinationArbiterRequest()].forEach(roleRequest => {
    const schema = buildStrictAiOutputSchema(roleRequest).schema;
    assertEveryArraySchemaHasItems(schema);
    assertOpenAiStrictObjectShape(schema);
  });
  const normalized = normalizeAiCallRequest(request());
  assert.equal(normalized.ok, true);
  const normalizedMjPlanner = normalizeAiCallRequest(mjPlannerRequest());
  assert.equal(normalizedMjPlanner.ok, true);
  const normalizedNpcPerformer = normalizeAiCallRequest(npcPerformerRequest());
  assert.equal(normalizedNpcPerformer.ok, true);
  assert.equal(normalizeAiCallRequest(npcPerformerRequest({
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 2_000, timeoutMs: 30_000 }
  })).ok, true);
  const rejectedNpcPerformerBudget = normalizeAiCallRequest(npcPerformerRequest({
    limits: { inputTokenBudget: 8_001, outputTokenBudget: 2_000, timeoutMs: 30_000 }
  }));
  assert.equal(rejectedNpcPerformerBudget.ok, false);
  assert.equal(rejectedNpcPerformerBudget.issues.includes("limits.inputTokenBudget must be between 1 and 8000."), true);
  const npcPerformerInstructions = buildRoleInstructions(npcPerformerRequest());
  assert.equal(npcPerformerInstructions.includes("resolvedClaims"), true);
  assert.equal(npcPerformerInstructions.includes("REFUTED"), true);
  assert.equal(normalizeAiCallRequest(destinationArbiterRequest()).ok, true);
  assert.equal(normalizeAiCallRequest(destinationArbiterRequest({
    limits: { inputTokenBudget: 8_000, outputTokenBudget: 800, timeoutMs: 30_000 }
  })).ok, true);
  const rejectedDestinationArbiterBudget = normalizeAiCallRequest(destinationArbiterRequest({
    limits: { inputTokenBudget: 8_001, outputTokenBudget: 800, timeoutMs: 30_000 }
  }));
  assert.equal(rejectedDestinationArbiterBudget.ok, false);
  assert.equal(rejectedDestinationArbiterBudget.issues.includes("limits.inputTokenBudget must be between 1 and 8000."), true);
  assert.equal(buildRoleInstructions(destinationArbiterRequest()).includes("aucune autorité de commit"), true);
  assert.equal(validateEnvelope(destinationArbiterOutput(), destinationArbiterRequest()).ok, true);
  assert.equal(validateEnvelope(destinationArbiterOutput({ payload: {
    outcome: "REJECT_CONTRADICTION", allowedParentLocationRef: null, reason: "Contradiction.", accessHint: null,
    sourceRefs: ["wiki:source-interdite"]
  } }), destinationArbiterRequest()).ok, false, "l'arbitre ne doit pas citer une source absente du brief");
  const normalizedIntent = normalizeAiCallRequest(intentRequest());
  assert.equal(normalizedIntent.ok, true);
  const normalizedComposedIntent = normalizeAiCallRequest(semanticIntentRequestV3());
  assert.equal(normalizedComposedIntent.ok, true);
  const composedIntentSchema = buildStrictAiOutputSchema(semanticIntentRequestV3()).schema;
  assert.equal(composedIntentSchema.properties.payload.properties.intent.required.includes("composition"), true);
  assert.deepEqual(
    composedIntentSchema.properties.payload.properties.intent.properties.composition.properties.communication.anyOf[0].properties.mode.enum,
    ["SPEECH", "NONVERBAL"]
  );
  const normalizedVisibleOrientation = normalizeAiCallRequest(semanticIntentRequestV4());
  assert.equal(normalizedVisibleOrientation.ok, true);
  const visibleOrientationSchema = buildStrictAiOutputSchema(semanticIntentRequestV4()).schema;
  const visibleOrientationIntent = visibleOrientationSchema.properties.payload.properties.intent;
  assert.equal(visibleOrientationIntent.properties.composition.required.includes("orientation"), true);
  assert.deepEqual(
    visibleOrientationIntent.properties.perception.anyOf[0].properties.informationKind.enum,
    ["PRESENCE", "VISIBLE_TRAIT", "UNCERTAIN_CLUE"]
  );
  const normalizedOrderedComponents = normalizeAiCallRequest(semanticIntentRequestV5());
  assert.equal(normalizedOrderedComponents.ok, true);
  const orderedComponentsSchema = buildStrictAiOutputSchema(semanticIntentRequestV5()).schema;
  const orderedComposition = orderedComponentsSchema.properties.payload.properties.intent.properties.composition;
  assert.equal(orderedComposition.required.includes("spatialFollowUp"), true);
  assert.deepEqual(
    orderedComposition.properties.spatialFollowUp.anyOf[0].properties.kind.enum,
    ["REPOSITION_AWAY"]
  );
  const normalizedCompanionDirective = normalizeAiCallRequest(semanticIntentRequestV6());
  assert.equal(normalizedCompanionDirective.ok, true);
  const companionIntentSchema = buildStrictAiOutputSchema(semanticIntentRequestV6()).schema.properties.payload.properties.intent;
  assert.equal(companionIntentSchema.required.includes("companionDirective"), true);
  assert.deepEqual(
    companionIntentSchema.properties.companionDirective.anyOf[0].properties.category.enum,
    ["FOLLOW", "SCOUT", "ASSIST", "GUARD", "SOCIAL", "PERSONAL_RISK"]
  );
  const companionInstructions = buildRoleInstructions(semanticIntentRequestV6());
  assert.equal(companionInstructions.includes("task.activeCompanionRefs"), true);
  assert.equal(companionInstructions.includes("sans mots-clés"), true);
  const normalizedCompanionPresence = normalizeAiCallRequest(semanticIntentRequestV7());
  assert.equal(normalizedCompanionPresence.ok, true);
  const companionPresenceSchema = buildStrictAiOutputSchema(semanticIntentRequestV7()).schema.properties.payload.properties.intent.properties.companionDirective.anyOf[0];
  assert.equal(companionPresenceSchema.required.includes("presenceIntent"), true);
  assert.deepEqual(companionPresenceSchema.properties.presenceIntent.enum, ["UNCHANGED", "SEPARATE", "REJOIN", "LEAVE"]);
  const companionPresenceInstructions = buildRoleInstructions(semanticIntentRequestV7());
  assert.equal(companionPresenceInstructions.includes("PNJ visible"), true);
  assert.equal(companionPresenceInstructions.includes("presenceIntent=UNCHANGED"), true);
  const focusedRequest = semanticIntentRequestV5({
    input: {
      instructionsRef: "ai-intent-interpretation/player-intent-semantic/v5",
      roleContextPack: {},
      task: {
        rawInput: "je souhaiterai acceder à des documents relatif aux naissance, je voudrais retrouver mes parents",
        outputContract: "ai-intent-semantic/5"
      }
    }
  });
  const normalizedFocusedRequest = normalizeProviderEnvelope({
    ...outputFor(focusedRequest),
    payload: {
      rawInputEcho: focusedRequest.input.task.rawInput,
      intent: {
        kind: "context_question",
        commitment: "committed",
        preconditions: [],
        playerGoal: "Demander l'accès aux registres de naissance afin de retrouver ses parents.",
        actionHint: null,
        domainHint: null,
        scope: "META",
        targetMention: {
          surface: "au clerc",
          candidateKind: "npc",
          proposedRef: "npc:clerc",
          contextLink: "RECENT_FOCUS"
        },
        perception: null,
        dialogueAct: {
          act: "REQUEST_ACTION",
          contentGoal: "Demander l'accès aux registres de naissance."
        },
        composition: {
          orientation: null,
          spatialLeadIn: null,
          communication: {
            mode: "SPEECH",
            act: "REQUEST_ACTION",
            contentGoal: "Demander l'accès aux registres de naissance.",
            order: 1
          },
          spatialFollowUp: null
        },
        uncertainties: [],
        clarificationPrompt: null,
        confidence: "high"
      }
    }
  }, focusedRequest);
  assert.equal(normalizedFocusedRequest.payload.intent.kind, "address_visible_actor");
  assert.equal(normalizedFocusedRequest.payload.intent.domainHint, "social");
  assert.equal(normalizedFocusedRequest.payload.intent.scope, "SOCIAL_EXCHANGE");
  assert.equal(normalizedFocusedRequest.payload.intent.dialogueAct.act, "REQUEST_ACTION");
  assert.equal(validateEnvelope(normalizedFocusedRequest, focusedRequest).ok, true);
  const normalizedSceneCreator = normalizeAiCallRequest(sceneCreatorRequest());
  assert.equal(normalizedSceneCreator.ok, true);
  const sceneCreatorSchema = buildStrictAiOutputSchema(sceneCreatorRequest()).schema;
  assert.equal(sceneCreatorSchema.properties.payload.properties.connectionIntents.items.properties.sourceRefs.items.type, "string");
  assert.deepEqual(sceneCreatorSchema.properties.payload.properties.parentLocationRef.enum, ["location:quartier_des_archives"]);
  assert.deepEqual(sceneCreatorSchema.properties.payload.properties.requestedDepth.enum, ["LIGHT_REFERENCE", "FULL_ENTITY"]);
  assert.equal(sceneCreatorSchema.properties.payload.properties.perceptibleFeatures.minItems, 1);
  assert.equal(sceneCreatorSchema.properties.payload.properties.narrativeCommitments.minItems, undefined);
  assert.equal(sceneCreatorSchema.properties.payload.properties.populationRoles.minItems, undefined);
  assert.equal(sceneCreatorSchema.properties.payload.properties.localNorms.minItems, undefined);
  const normalizedSceneCreatorV2 = normalizeAiCallRequest(sceneCreatorRequestV2());
  assert.equal(normalizedSceneCreatorV2.ok, true);
  const sceneCreatorInstructions = buildRoleInstructions(sceneCreatorRequestV2());
  assert.equal(sceneCreatorInstructions.includes("authoritativeTruths"), true);
  assert.equal(sceneCreatorInstructions.includes("campaignCommitments"), true);
  assert.equal(sceneCreatorInstructions.includes("attributedTestimonies"), true);
  assert.equal(sceneCreatorInstructions.includes("ne prouve jamais la proposition"), true);
  const sceneCreatorSchemaV2 = buildStrictAiOutputSchema(sceneCreatorRequestV2()).schema;
  assert.equal(Object.hasOwn(sceneCreatorSchemaV2.properties.payload.properties, "connectionIntents"), false);
  assert.equal(sceneCreatorSchemaV2.properties.payload.required.includes("connectionIntents"), false);
  const rejectedIntentContract = normalizeAiCallRequest(intentRequest({ contractVersion: "narrative-ai-resolution/1" }));
  assert.equal(rejectedIntentContract.ok, false);
  const rejectedMissingFingerprint = normalizeAiCallRequest(request({ contextFingerprint: undefined }));
  assert.equal(rejectedMissingFingerprint.ok, false);
  assert.equal(rejectedMissingFingerprint.issues.includes("contextFingerprint must be a non-empty string."), true);
  const rejectedBadFingerprint = normalizeAiCallRequest(request({ contextFingerprint: "sha256:not-a-real-fingerprint" }));
  assert.equal(rejectedBadFingerprint.ok, false);
  assert.equal(rejectedBadFingerprint.issues.includes("contextFingerprint must be a sha256 fingerprint."), true);
  const rejectedMissingInstructions = normalizeAiCallRequest(request({
    input: {
      roleContextPack: {},
      task: {}
    }
  }));
  assert.equal(rejectedMissingInstructions.ok, false);
  assert.equal(rejectedMissingInstructions.issues.includes("input.instructionsRef must be a non-empty string."), true);

  const body = buildOpenAiResponsesBody(request(), { modelId: "gpt-4.1-mini" });
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.equal(body.store, false);
  assert.equal(body.reasoning, undefined, "aucun effort de raisonnement n'est injecté par défaut");
  const reasoningBody = buildOpenAiResponsesBody(request(), { modelId: "gpt-5.6-luna", reasoningEffort: "low" });
  assert.deepEqual(reasoningBody.reasoning, { effort: "low" });
  const intentRoute = buildServerRoute(intentRequest(), {
    NARRATION_OPENAI_INTENT_MODEL: "gpt-5.6-luna",
    NARRATION_OPENAI_INTENT_REASONING_EFFORT: "none"
  });
  assert.equal(intentRoute.modelId, "gpt-5.6-luna");
  assert.equal(intentRoute.reasoningEffort, "none");
  assert.equal(buildServerRoute(intentRequest(), { NARRATION_OPENAI_INTENT_REASONING_EFFORT: "invalid" }).reasoningEffort, null);
  assert.equal(buildServerRoute(request(), { NARRATION_OPENAI_INTENT_REASONING_EFFORT: "low" }).reasoningEffort, null, "le réglage reste propre au rôle intention");
  assert.equal(buildServerRoute(npcPerformerRequest(), {}).reasoningEffort, "none");
  assert.equal(
    buildServerRoute(npcPerformerRequest(), { NARRATION_OPENAI_NPC_PERFORMER_REASONING_EFFORT: "low" }).reasoningEffort,
    "low"
  );
  const defaultSceneCreatorRoute = buildServerRoute(sceneCreatorRequestV2(), {});
  assert.equal(defaultSceneCreatorRoute.modelId, "gpt-5.6-luna");
  assert.equal(defaultSceneCreatorRoute.reasoningEffort, "none");
  const overriddenSceneCreatorRoute = buildServerRoute(sceneCreatorRequestV2(), {
    NARRATION_OPENAI_SCENE_CREATOR_MODEL: "gpt-5.5",
    NARRATION_OPENAI_SCENE_CREATOR_REASONING_EFFORT: "low"
  });
  assert.equal(overriddenSceneCreatorRoute.modelId, "gpt-5.5");
  assert.equal(overriddenSceneCreatorRoute.reasoningEffort, "low");
  assert.deepEqual(body.text.format.schema.properties.callId.enum, [request().callId]);
  assert.deepEqual(body.text.format.schema.properties.role.enum, ["player_expression_adapter"]);
  assert.deepEqual(body.text.format.schema.properties.supersedesOutputId.type, ["string", "null"]);
  assert.equal(body.text.format.schema.properties.payload.required.includes("addedMeaning"), true);
  assert.equal(body.input[0].content[0].text.includes("addedMeaning doit rester []"), true);

  const sceneReq = request({
    callId: "call-route-scene-001",
    attemptId: "attempt-route-scene-001",
    role: "scene_writer",
    limits: {
      inputTokenBudget: 4_000,
      outputTokenBudget: 1_200,
      timeoutMs: 1_000
    },
    input: {
      instructionsRef: "narrative-ai-resolution/scene-writer/v1",
      roleContextPack: {},
      task: {
        resolutionIds: ["resolution-route-001"],
        allowedGrounding: ["resolution:route-scene-001", "reference-scene:reference-inn-rain-001"]
      }
    }
  });
  const sceneWriterInstructions = buildRoleInstructions(sceneReq);
  assert.equal(
    sceneWriterInstructions.includes("départ, le franchissement puis l'arrivée"),
    true,
    "le writer doit préserver le cheminement post-commit"
  );
  assert.equal(
    sceneWriterInstructions.includes("ne réduis jamais ce tour à une description statique"),
    true
  );
  assert.equal(
    sceneWriterInstructions.includes("changement de milieu"),
    true,
    "le writer doit rendre perceptible un seuil intérieur/extérieur seulement quand les faits le permettent"
  );
  assert.equal(
    buildRoleInstructions(sceneCreatorRequestV2()).includes(
      "sans la remplacer par son passage, son entrée, son seuil"
    ),
    true,
    "le créateur doit conserver l'identité de la destination demandée"
  );
  const normalizedSceneWriterBudget = normalizeAiCallRequest(sceneReq);
  assert.equal(normalizedSceneWriterBudget.ok, true);
  const rejectedSceneWriterBudget = normalizeAiCallRequest({
    ...sceneReq,
    limits: { ...sceneReq.limits, outputTokenBudget: 2_501 }
  });
  assert.equal(rejectedSceneWriterBudget.ok, false);
  assert.equal(rejectedSceneWriterBudget.issues.includes("limits.outputTokenBudget must be between 1 and 2500."), true);
  const normalizedSceneCreatorBudget = normalizeAiCallRequest({
    ...sceneCreatorRequest(),
    limits: { ...sceneCreatorRequest().limits, outputTokenBudget: 2_000, timeoutMs: 55_000 }
  });
  assert.equal(normalizedSceneCreatorBudget.ok, true);
  const rejectedSceneCreatorTimeout = normalizeAiCallRequest({
    ...sceneCreatorRequest(),
    limits: { ...sceneCreatorRequest().limits, timeoutMs: 60_001 }
  });
  assert.equal(rejectedSceneCreatorTimeout.ok, false);
  assert.equal(rejectedSceneCreatorTimeout.issues.includes("limits.timeoutMs must be between 1 and 60000."), true);
  const normalizedCriticBudget = normalizeAiCallRequest(request({
    role: "coherence_critic",
    limits: { inputTokenBudget: 900, outputTokenBudget: 1_600, timeoutMs: 1_000 }
  }));
  assert.equal(normalizedCriticBudget.ok, true);
  const rejectedCriticBudget = normalizeAiCallRequest(request({
    role: "coherence_critic",
    limits: { inputTokenBudget: 900, outputTokenBudget: 1_601, timeoutMs: 1_000 }
  }));
  assert.equal(rejectedCriticBudget.ok, false);
  assert.equal(rejectedCriticBudget.issues.includes("limits.outputTokenBudget must be between 1 and 1600."), true);
  const normalizedPerformerBudget = normalizeAiCallRequest(npcPerformerRequest({
    limits: { inputTokenBudget: 2_000, outputTokenBudget: 2_000, timeoutMs: 1_000 }
  }));
  assert.equal(normalizedPerformerBudget.ok, true);
  const sceneSchema = buildStrictAiOutputSchema(sceneReq);
  assert.deepEqual(sceneSchema.schema.properties.role.enum, ["scene_writer"]);
  assert.equal(sceneSchema.schema.properties.payload.required.includes("narrationBlocks"), true);
  assert.equal(sceneSchema.schema.properties.payload.properties.narrationBlocks.items.required.includes("groundedIn"), true);
  assert.equal(sceneSchema.schema.properties.payload.properties.narrationBlocks.items.required.includes("factDiscipline"), true);
  assert.deepEqual(sceneSchema.schema.properties.payload.properties.narrationBlocks.items.properties.blockKind.enum, ["MJ_NARRATION"]);
  assert.deepEqual(sceneSchema.schema.properties.payload.properties.narrationBlocks.items.properties.groundedIn.items.enum, [
    "resolution:route-scene-001",
    "reference-scene:reference-inn-rain-001"
  ]);
  assert.deepEqual(
    sceneSchema.schema.properties.payload.properties.narrationBlocks.items.properties.factDiscipline.required,
    ["addedUnsupportedFacts", "usesOnlyProvidedVisibleEntities", "noNewEvents", "noHiddenPresence", "notes"]
  );

  const criticReq = request({
    callId: "call-route-critic-001",
    operationId: "operation-route-critic-001",
    attemptId: "attempt-route-critic-001",
    snapshotId: "snapshot-route-critic-001",
    packId: "pack-route-critic-001",
    role: "coherence_critic",
    input: {
      instructionsRef: "narrative-ai-resolution/coherence-critic/render-authority/v1",
      roleContextPack: { renderAuthority: { mode: "ACTION_STAGING_ONLY" } },
      task: {
        candidateNarration: ["La porte s'ouvre et révèle une pièce sombre."],
        renderAuthority: { mode: "ACTION_STAGING_ONLY", confirmedClaims: ["Le geste est engagé."], unconfirmedClaims: ["Le succès."], forbiddenClaims: ["Annoncer une ouverture."] }
      }
    }
  });
  const criticBody = buildOpenAiResponsesBody(criticReq, { modelId: "gpt-4.1-mini" });
  assert.deepEqual(criticBody.text.format.schema.properties.role.enum, ["coherence_critic"]);
  assert.deepEqual(criticBody.text.format.schema.properties.status.enum, ["OK"], "un verdict critique REJECT reste une enveloppe fournisseur OK");
  assert.equal(criticBody.input[0].content[0].text.includes("Compare uniquement candidateNarration à renderAuthority"), true);
  const rejectedNarration = validateEnvelope({
    ...outputFor(criticReq),
    role: "coherence_critic",
    payload: {
      verdict: "REJECT",
      findings: [{ findingId: "unsupported-door-opening", severity: "BLOCKING", category: "AUTHORITY", affectedRefs: ["object:back-room-door"], explanation: "L'ouverture n'est pas confirmée." }],
      correctionConstraints: ["Rester au geste engagé."]
    }
  }, criticReq);
  assert.equal(rejectedNarration.ok, true, "un verdict REJECT structuré doit rester une sortie critique utilisable");
  const invalidCriticPass = validateEnvelope({
    ...outputFor(criticReq),
    role: "coherence_critic",
    payload: {
      verdict: "PASS",
      findings: [{ findingId: "contradictory-pass", severity: "BLOCKING", category: "AUTHORITY", affectedRefs: [], explanation: "Contradiction." }],
      correctionConstraints: []
    }
  }, criticReq);
  assert.equal(invalidCriticPass.ok, false);
  assert.equal(invalidCriticPass.issues.includes("payload PASS must not contain findings or correction constraints."), true);

  const intentBody = buildOpenAiResponsesBody(intentRequest(), { modelId: "gpt-4.1-mini" });
  assert.equal(intentBody.text.format.schema.properties.contractVersion.enum[0], "ai-intent-interpretation/1");
  assert.equal(intentBody.text.format.schema.properties.role.enum[0], "player_intent_interpreter");
  assert.equal(intentBody.text.format.schema.properties.payload.properties.intents.items.required.includes("expectedTimeEffect"), true);
  assert.equal(intentBody.text.format.schema.properties.payload.properties.intents.items.properties.semanticIntent.required.includes("perception"), true);
  assert.deepEqual(
    intentBody.text.format.schema.properties.payload.properties.intents.items.properties.semanticIntent.properties.perception.anyOf[0].properties.depth.enum,
    ["GLANCE", "FOCUSED", "SEARCH"]
  );
  assert.equal(intentBody.input[0].content[0].text.includes("transformer une possibilite en action executee"), true);
  assert.equal(intentBody.input[0].content[0].text.includes("Déduis ce niveau du sens complet de la demande"), true);
  assert.equal(intentBody.input[0].content[0].text.includes("Ne surclasse jamais une demande ordinaire en FOCUSED"), true);
  const semanticIntentReq = semanticIntentRequest();
  assert.equal(normalizeAiCallRequest(semanticIntentReq).ok, true, "la route accepte le contrat sémantique V2 en parallèle du V1");
  const semanticIntentBody = buildOpenAiResponsesBody(semanticIntentReq, { modelId: "gpt-4.1-mini" });
  assert.equal(semanticIntentBody.text.format.schema.properties.contractVersion.enum[0], "ai-intent-semantic/2");
  assert.deepEqual(semanticIntentBody.text.format.schema.properties.payload.required, ["rawInputEcho", "intent"]);
  assert.equal(semanticIntentBody.text.format.schema.properties.payload.properties.intent.properties.actionHint.type.includes("string"), true);
  assert.equal(semanticIntentBody.text.format.schema.properties.payload.properties.intent.required.includes("preconditions"), true);
  assert.equal(semanticIntentBody.text.format.schema.properties.payload.properties.intent.properties.preconditions.maxItems, 4);
  assert.equal(semanticIntentBody.text.format.schema.properties.payload.properties.intent.properties.kind.enum.includes("move_near_visible_actor"), true);
  assert.equal(semanticIntentBody.text.format.schema.properties.payload.properties.intent.properties.kind.enum.includes("traverse_visible_boundary"), true);
  assert.equal(semanticIntentBody.input[0].content[0].text.includes("ni projection legacy"), true);
  assert.equal(semanticIntentBody.input[0].content[0].text.includes("Ce n'est ni address_visible_actor, ni nonverbal_signal"), true);
  assert.equal(semanticIntentBody.input[0].content[0].text.includes("la limite visible franchie"), true);
  assert.equal(semanticIntentBody.input[0].content[0].text.includes("Sa cible doit donc être candidateKind=npc"), true);
  assert.equal(semanticIntentBody.input[0].content[0].text.includes("expose la destination nommée dans destinations"), true);
  assert.equal(semanticIntentBody.input[0].content[0].text.includes("plusieurs candidats restent réellement plausibles"), true);
  assert.equal(semanticIntentBody.input[0].content[0].text.includes("Toute action dépendant d'une précondition explicite utilise commitment=conditional"), true);
  assert.equal(
    semanticIntentBody.input[0].content[0].text.includes("task.characterContext"),
    true,
    "le prompt sémantique doit borner le contexte personnage"
  );
  assert.equal(
    semanticIntentBody.input[0].content[0].text.includes("ne sont pas des référents de scène"),
    true,
    "le prompt ne doit pas confondre une référence personnage avec une cible visible"
  );
  assert.equal(
    semanticIntentBody.input[0].content[0].text.includes("Ne choisis jamais un sort, une action ou un objet arbitrairement"),
    true,
    "le prompt doit imposer la clarification des alias personnage ambigus"
  );
  assert.equal(
    semanticIntentBody.input[0].content[0].text.includes("task.activeDialogueTarget"),
    true,
    "le prompt sémantique doit expliquer la continuité d'un échange avec l'interlocuteur actif"
  );
  const mjPlannerBody = buildOpenAiResponsesBody(mjPlannerRequest(), { modelId: "gpt-4.1-mini" });
  assert.equal(mjPlannerBody.text.format.schema.properties.contractVersion.enum[0], "mj-planner/1");
  assert.equal(mjPlannerBody.text.format.schema.properties.role.enum[0], "mj_planner");
  assert.equal(mjPlannerBody.text.format.schema.properties.payload.required.includes("planningBasis"), true);
  assert.deepEqual(
    mjPlannerBody.text.format.schema.properties.payload.properties.commandProposals.items.properties.commitAuthority.enum,
    [false]
  );
  assert.equal(mjPlannerBody.input[0].content[0].text.includes("commitAuthority doit toujours etre false"), true);
  const npcPerformerBody = buildOpenAiResponsesBody(npcPerformerRequest(), { modelId: "gpt-4.1-mini" });
  assert.equal(npcPerformerBody.text.format.schema.properties.contractVersion.enum[0], "npc-performer/1");
  assert.equal(npcPerformerBody.text.format.schema.properties.role.enum[0], "npc_performer");
  assert.equal(npcPerformerBody.text.format.schema.properties.payload.required.includes("safetyConstraints"), true);
  assert.deepEqual(
    npcPerformerBody.text.format.schema.properties.payload.properties.durableCommitments.maxItems,
    0
  );
  assert.deepEqual(
    npcPerformerBody.text.format.schema.properties.payload.properties.utterances.items.properties.speechActs.items.properties.type.enum,
    ["assertion", "question", "refusal"]
  );
  assert.equal(npcPerformerBody.text.format.schema.properties.payload.required.includes("conversationProfile"), true);
  assert.deepEqual(
    npcPerformerBody.text.format.schema.properties.payload.properties.conversationProfile.properties.continuityRevision.enum,
    [1]
  );
  assert.deepEqual(
    npcPerformerBody.text.format.schema.properties.payload.properties.conversationProfile.properties.durable.enum,
    [false]
  );
  assert.equal(npcPerformerBody.input[0].content[0].text.includes("Lis task.dialogueAct comme contrat du tour"), true);
  assert.equal(npcPerformerBody.input[0].content[0].text.includes("profil conversationnel éphémère"), true);
  const npcDialogueCriticRequest = request({
    role: "coherence_critic",
    contractVersion: "narrative-ai-resolution/1",
    input: {
      instructionsRef: "narrative-ai-resolution/coherence-critic/npc-dialogue-act/v1",
      roleContextPack: {},
      task: {
        actorId: "npc:npc-serveuse-nerveuse",
        dialogueAct: {
          schemaVersion: 1,
          act: "INITIATE_CONVERSATION",
          contentGoal: "saluer la serveuse",
          addresseeRef: "npc:npc-serveuse-nerveuse"
        },
        candidateNarration: ["Je comprends votre question."]
      }
    }
  });
  const npcDialogueCriticBody = buildOpenAiResponsesBody(npcDialogueCriticRequest, { modelId: "gpt-4.1-mini" });
  assert.equal(npcDialogueCriticBody.input[0].content[0].text.includes("rejette toute prétendue question préalable"), true);
  assert.equal(npcPerformerBody.input[0].content[0].text.includes("durableCommitments doit rester []"), true);

  const dangerousExpression = validateEnvelope({ ...outputFor(request()), payload: { ...outputFor(request()).payload, addedMeaning: ["promesse de payer"] } }, request());
  assert.equal(dangerousExpression.ok, false);
  assert.equal(dangerousExpression.issues.includes("payload.addedMeaning must be empty."), true);
  const unusableExpression = validateEnvelope({
    ...outputFor(request()),
    status: "PARTIAL_UNUSABLE",
    diagnostics: [{
      code: "PROVIDER_REFUSED",
      severity: "BLOCKING",
      message: "Provider refused usable output.",
      sourceRefs: ["operation:operation-route-expression-001"]
    }]
  }, request());
  assert.equal(unusableExpression.ok, false);
  assert.equal(unusableExpression.issues.includes("status must be OK for a usable output."), true);
  const validSceneCreator = validateEnvelope(sceneCreatorOutputFor(sceneCreatorRequest()), sceneCreatorRequest());
  assert.equal(validSceneCreator.ok, true, validSceneCreator.issues?.join(" | "));
  const validSceneCreatorV2 = validateEnvelope(sceneCreatorOutputFor(sceneCreatorRequestV2()), sceneCreatorRequestV2());
  assert.equal(validSceneCreatorV2.ok, true, validSceneCreatorV2.issues?.join(" | "));
  const topologicalSceneCreatorV2 = validateEnvelope(sceneCreatorOutputFor(sceneCreatorRequestV2(), {
    payload: { connectionIntents: sceneCreatorOutputFor(sceneCreatorRequest()).payload.connectionIntents }
  }), sceneCreatorRequestV2());
  assert.equal(topologicalSceneCreatorV2.ok, false);
  const invalidSceneCreator = validateEnvelope(sceneCreatorOutputFor(sceneCreatorRequest(), {
    payload: { connectionIntents: [] }
  }), sceneCreatorRequest());
  assert.equal(invalidSceneCreator.ok, false);
  assert.equal(invalidSceneCreator.issues.includes("payload.connectionIntents must contain 1 to 4 connections."), true);
  const systemNoticeScene = validateEnvelope(
    sceneOutputFor(sceneReq, {
      payload: {
        narrationBlocks: [{
          slotId: "scene-notice",
          blockKind: "SYSTEM_NOTICE",
          content: "Cette réponse ne fait pas avancer le temps.",
          groundedIn: ["resolution:route-scene-001"],
          usesCreativeTexture: false,
          factDiscipline: safeFactDiscipline()
        }]
      }
    }),
    sceneReq
  );
  assert.equal(systemNoticeScene.ok, false);
  assert.equal(systemNoticeScene.issues.includes("payload.narrationBlocks[0].blockKind must be MJ_NARRATION."), true);
  const dangerousIntent = validateEnvelope(
    intentOutputFor(intentRequest(), { intent: { intentType: "possibility_query", commitment: "committed" } }),
    intentRequest()
  );
  assert.equal(dangerousIntent.ok, false);
  assert.equal(dangerousIntent.issues.includes("payload.intents[0] possibility_query must stay hypothetical."), true);
  const observationReq = intentRequest({
    input: {
      ...intentRequest().input,
      task: { ...intentRequest().input.task, rawInput: "Je l'observe plus attentivement." }
    }
  });
  const observationOutput = intentOutputFor(observationReq, {
    intent: {
      intentType: "action",
      action: "observe",
      coreMeaning: "Le personnage examine plus attentivement la cible visible."
    }
  });
  assert.equal(validateEnvelope(observationOutput, observationReq).ok, true);
  const observationWithoutDepth = validateEnvelope({
    ...observationOutput,
    payload: {
      ...observationOutput.payload,
      intents: [{
        ...observationOutput.payload.intents[0],
        semanticIntent: { ...observationOutput.payload.intents[0].semanticIntent, perception: null }
      }]
    }
  }, observationReq);
  assert.equal(observationWithoutDepth.ok, false);
  assert.equal(observationWithoutDepth.issues.includes("payload.intents[0].semanticIntent.perception is required for observe_environment."), true);
  const socialSpeechReq = intentRequest({
    input: {
      ...intentRequest().input,
      task: {
        ...intentRequest().input.task,
        rawInput: "j'aimerais parler a un garde"
      }
    }
  });
  const dangerousSocialSpeechIntent = validateEnvelope(
    intentOutputFor(socialSpeechReq, { intent: { intentType: "action", action: "act", coreMeaning: "Le personnage agit vers le garde." } }),
    socialSpeechReq
  );
  assert.equal(dangerousSocialSpeechIntent.ok, true, "le serveur ne doit pas réinterpréter lexicalement la saisie; la certification live mesure la fidélité sémantique");
  const socialSpeechAsMetaIntent = validateEnvelope(
    intentOutputFor(socialSpeechReq, {
      intent: {
        intentType: "meta_question",
        commitment: "none",
        action: null,
        expectedTimeEffect: "NO_GAME_TIME",
        coreMeaning: "Question de contexte."
      }
    }),
    socialSpeechReq
  );
  assert.equal(socialSpeechAsMetaIntent.ok, true);
  const composedSocialSpeechReq = intentRequest({
    input: {
      ...intentRequest().input,
      task: {
        ...intentRequest().input.task,
        rawInput: "je m'approche du garde et je lui demande s'il a vu quelque chose d'etrange"
      }
    }
  });
  const dangerousComposedSocialSpeechIntent = validateEnvelope(
    intentOutputFor(composedSocialSpeechReq, { intent: { intentType: "action", action: "act", coreMeaning: "Le personnage agit vers le garde." } }),
    composedSocialSpeechReq
  );
  assert.equal(dangerousComposedSocialSpeechIntent.ok, true);
  const approachOnlyReq = intentRequest({
    input: {
      ...intentRequest().input,
      task: {
        ...intentRequest().input.task,
        rawInput: "Je m'approche du garde"
      }
    }
  });
  const dangerousApproachAsSpeechIntent = validateEnvelope(
    intentOutputFor(approachOnlyReq, { intent: { intentType: "speech", action: "ask", coreMeaning: "Le personnage s'approche du garde." } }),
    approachOnlyReq
  );
  assert.equal(dangerousApproachAsSpeechIntent.ok, true);
  const dangerousApproachRestDomainIntent = validateEnvelope(
    intentOutputFor(approachOnlyReq, {
      intent: {
        intentType: "action",
        action: "act",
        coreMeaning: "Le personnage se place près du garde.",
        runtimeHandling: {
          schemaVersion: 1,
          status: "SUPPORTED_BY_CURRENT_RUNTIME",
          reason: "Domaine proposé par le modèle; le runtime garde l'autorité finale.",
          requiredDomain: "rest",
          canonicalActionHint: "act",
          noCommit: false,
          noGameTime: false
        }
      }
    }),
    approachOnlyReq
  );
  assert.equal(dangerousApproachRestDomainIntent.ok, true, "la disponibilité du domaine sera recalculée localement depuis l'intention structurée");
  const dangerousSpeechForceIntent = validateEnvelope(
    intentOutputFor(socialSpeechReq, {
      intent: {
        intentType: "speech",
        action: "force",
        coreMeaning: "Le personnage s'adresse au garde."
      }
    }),
    socialSpeechReq
  );
  assert.equal(dangerousSpeechForceIntent.ok, false);
  assert.equal(dangerousSpeechForceIntent.issues.includes("payload.intents[0] speech action must be ask, act or null."), true);
  const dangerousAlteredEchoSocialSpeechIntent = validateEnvelope(
    {
      ...intentOutputFor(composedSocialSpeechReq, { intent: { intentType: "action", action: "act", coreMeaning: "Le personnage agit vers le garde." } }),
      payload: {
        ...intentOutputFor(composedSocialSpeechReq).payload,
        rawInputEcho: "je m'approche du garde",
        intents: [
          {
            ...intentOutputFor(composedSocialSpeechReq).payload.intents[0],
            intentType: "action",
            action: "act",
            coreMeaning: "Le personnage agit vers le garde."
          }
        ]
      }
    },
    composedSocialSpeechReq
  );
  assert.equal(dangerousAlteredEchoSocialSpeechIntent.ok, true, "les aides legacy divergentes ne doivent pas remplacer la validation sémantique canonique du pipeline");
  const speechNoGameTimeIntent = validateEnvelope(
    intentOutputFor(intentRequest(), { intent: { intentType: "speech", commitment: "committed", expectedTimeEffect: "NO_GAME_TIME" } }),
    intentRequest()
  );
  assert.equal(speechNoGameTimeIntent.ok, false);
  assert.equal(speechNoGameTimeIntent.issues.includes("payload.intents[0] committed in-fiction intent must use DOMAIN_TO_DECIDE."), true);
  const ambiguousOpenIntent = validateEnvelope(
    intentOutputFor(intentRequest(), {
      intent: {
        intentType: "action",
        commitment: "committed",
        target: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
        action: "open",
        referentResolution: {
          schemaVersion: 1,
          usedPreviousContext: true,
          source: "recent_visible_focus",
          resolvedTarget: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
          evidence: ["porte du fond", "autre referent possible"],
          ambiguity: "multiple_candidates",
          confidence: "medium"
        },
        coreMeaning: "Le personnage tente d'ouvrir un referent ambigu.",
        expectedTimeEffect: "DOMAIN_TO_DECIDE"
      }
    }),
    intentRequest()
  );
  assert.equal(ambiguousOpenIntent.ok, false);
  assert.equal(ambiguousOpenIntent.issues.includes("payload.intents[0] committed open/force action requires unambiguous referentResolution."), true);
  const nonCanonicalOpenIntent = validateEnvelope(
    intentOutputFor(intentRequest(), {
      intent: {
        intentType: "action",
        commitment: "committed",
        target: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
        action: "ouvrir",
        coreMeaning: "Le personnage tente d'ouvrir la porte du fond.",
        expectedTimeEffect: "DOMAIN_TO_DECIDE"
      }
    }),
    intentRequest()
  );
  assert.equal(nonCanonicalOpenIntent.ok, false);
  assert.equal(nonCanonicalOpenIntent.issues.includes("payload.intents[0].action must be a canonical action or null."), true);
  const politeSpeechAsPossibilityIntent = validateEnvelope(
    intentOutputFor(socialSpeechReq, { intent: { intentType: "possibility_query", commitment: "hypothetical", expectedTimeEffect: "NO_GAME_TIME" } }),
    socialSpeechReq
  );
  assert.equal(politeSpeechAsPossibilityIntent.ok, true);
  const ellipticalObjectReq = intentRequest({
    input: {
      ...intentRequest().input,
      task: {
        ...intentRequest().input.task,
        rawInput: "la bourse du garde ?"
      }
    }
  });
  const ellipticalObjectAsPossibilityIntent = validateEnvelope(
    intentOutputFor(ellipticalObjectReq, { intent: { intentType: "possibility_query", commitment: "hypothetical", expectedTimeEffect: "NO_GAME_TIME" } }),
    ellipticalObjectReq
  );
  assert.equal(ellipticalObjectAsPossibilityIntent.ok, true);
  const ellipticalDoorReq = intentRequest({
    input: {
      ...intentRequest().input,
      task: {
        ...intentRequest().input.task,
        rawInput: "et la porte du fond ?"
      }
    }
  });
  const ellipticalDoorAsPossibilityIntent = validateEnvelope(
    intentOutputFor(ellipticalDoorReq, { intent: { intentType: "possibility_query", commitment: "hypothetical", expectedTimeEffect: "NO_GAME_TIME" } }),
    ellipticalDoorReq
  );
  assert.equal(ellipticalDoorAsPossibilityIntent.ok, true);
  const contextQuestionReq = intentRequest({
    input: {
      ...intentRequest().input,
      task: {
        ...intentRequest().input.task,
        rawInput: "quel temps fait il ?"
      }
    }
  });
  const contextQuestionAsPossibilityIntent = validateEnvelope(
    intentOutputFor(contextQuestionReq, { intent: { intentType: "possibility_query", commitment: "hypothetical", expectedTimeEffect: "NO_GAME_TIME" } }),
    contextQuestionReq
  );
  assert.equal(contextQuestionAsPossibilityIntent.ok, true);
  const politeContextReq = intentRequest({
    input: {
      ...intentRequest().input,
      task: {
        ...intentRequest().input.task,
        rawInput: "peux-tu me décrire l'auberge ?"
      }
    }
  });
  const politeContextAsPossibilityIntent = validateEnvelope(
    intentOutputFor(politeContextReq, { intent: { intentType: "possibility_query", commitment: "hypothetical", expectedTimeEffect: "NO_GAME_TIME" } }),
    politeContextReq
  );
  assert.equal(politeContextAsPossibilityIntent.ok, true);
  const politeContextAsMetaIntent = validateEnvelope(
    intentOutputFor(politeContextReq, { intent: { intentType: "meta_question", commitment: "none", expectedTimeEffect: "NO_GAME_TIME" } }),
    politeContextReq
  );
  assert.equal(politeContextAsMetaIntent.ok, true);
  const validMjPlan = validateEnvelope(mjPlannerOutputFor(mjPlannerRequest()), mjPlannerRequest());
  assert.equal(validMjPlan.ok, true);
  const committableMjPlan = validateEnvelope(
    mjPlannerOutputFor(mjPlannerRequest(), {
      payload: {
        commandProposals: [{
          ...mjPlannerOutputFor(mjPlannerRequest()).payload.commandProposals[0],
          commitAuthority: true
        }]
      }
    }),
    mjPlannerRequest()
  );
  assert.equal(committableMjPlan.ok, false);
  assert.equal(committableMjPlan.issues.includes("payload.commandProposals[0].commitAuthority must be false."), true);
  const revealingMjPlan = validateEnvelope(
    mjPlannerOutputFor(mjPlannerRequest(), {
      payload: {
        revealPlan: {
          ...mjPlannerOutputFor(mjPlannerRequest()).payload.revealPlan,
          reveal: ["secret:cache"]
        }
      }
    }),
    mjPlannerRequest()
  );
  assert.equal(revealingMjPlan.ok, false);
  assert.equal(revealingMjPlan.issues.includes("payload.revealPlan.reveal must be empty for mj_planner mini."), true);
  const validNpcPerformance = validateEnvelope(npcPerformerOutputFor(npcPerformerRequest()), npcPerformerRequest());
  assert.equal(validNpcPerformance.ok, true);
  const epistemicNpcRequest = npcPerformerRequest();
  epistemicNpcRequest.input.task.knowledgeEnvelope.allowedSourceRefs.push("claim:mandat-officiel");
  epistemicNpcRequest.input.task.knowledgeEnvelope.authorizedActorKnowledge = {
    schemaVersion: 1,
    actorRef: "actor:npc:npc-garde-blesse",
    knownFactRefs: [],
    claimPerspectives: [{
      claimRef: "claim:mandat-officiel",
      proposition: "Un mandat officiel serait requis pour franchir cette porte.",
      epistemicBasis: "believed",
      confidence: "MEDIUM",
      mayBeFalse: true
    }],
    legacyBeliefs: [],
    intentionalDeceptionAllowed: false,
    authority: "PRIVATE_ACTOR_KNOWLEDGE_FOR_PERFORMANCE_ONLY"
  };
  const epistemicNpcOutput = npcPerformerOutputFor(epistemicNpcRequest);
  epistemicNpcOutput.payload.utterances[0].speechActs[0].sourceRefs = ["claim:mandat-officiel"];
  epistemicNpcOutput.payload.utterances[0].speechActs[0].epistemicBasis = "believed";
  epistemicNpcOutput.payload.knowledgeUsed = ["claim:mandat-officiel"];
  assert.equal(validateEnvelope(epistemicNpcOutput, epistemicNpcRequest).ok, true);
  const overstatedNpcOutput = structuredClone(epistemicNpcOutput);
  overstatedNpcOutput.payload.utterances[0].speechActs[0].epistemicBasis = "known";
  const overstatedNpcPerformance = validateEnvelope(overstatedNpcOutput, epistemicNpcRequest);
  assert.equal(overstatedNpcPerformance.ok, false);
  assert.equal(
    overstatedNpcPerformance.issues.includes("payload.utterances[0].speechActs[0].epistemicBasis must be believed for claim:mandat-officiel."),
    true
  );
  const revealingNpcPerformance = validateEnvelope(
    npcPerformerOutputFor(npcPerformerRequest(), { payload: { revealedRefs: ["secret:back-room"] } }),
    npcPerformerRequest()
  );
  assert.equal(revealingNpcPerformance.ok, false);
  assert.equal(revealingNpcPerformance.issues.includes("payload.revealedRefs must be empty for npc_performer mini."), true);
  const committingNpcPerformance = validateEnvelope(
    npcPerformerOutputFor(npcPerformerRequest(), { payload: { durableCommitments: ["Le garde promet de couvrir le personnage."] } }),
    npcPerformerRequest()
  );
  assert.equal(committingNpcPerformance.ok, false);
  assert.equal(committingNpcPerformance.issues.includes("payload.durableCommitments must be empty for npc_performer mini."), true);
  const durableProfileNpcPerformance = validateEnvelope(
    npcPerformerOutputFor(npcPerformerRequest(), {
      payload: {
        conversationProfile: {
          ...npcPerformerOutputFor(npcPerformerRequest()).payload.conversationProfile,
          durable: true
        }
      }
    }),
    npcPerformerRequest()
  );
  assert.equal(durableProfileNpcPerformance.ok, false);
  assert.equal(durableProfileNpcPerformance.issues.includes("payload.conversationProfile.durable must be false."), true);
  const skippedProfileRevision = validateEnvelope(
    npcPerformerOutputFor(npcPerformerRequest(), {
      payload: {
        conversationProfile: {
          ...npcPerformerOutputFor(npcPerformerRequest()).payload.conversationProfile,
          continuityRevision: 2,
          continuitySource: "CONTINUED"
        }
      }
    }),
    npcPerformerRequest()
  );
  assert.equal(skippedProfileRevision.ok, false);
  assert.equal(skippedProfileRevision.issues.includes("payload.conversationProfile.continuityRevision must match task contract."), true);
  const forbiddenSpeechActNpcPerformance = validateEnvelope(
    npcPerformerOutputFor(npcPerformerRequest(), {
      payload: {
        utterances: [{
          ...npcPerformerOutputFor(npcPerformerRequest()).payload.utterances[0],
          speechActs: [{
            ...npcPerformerOutputFor(npcPerformerRequest()).payload.utterances[0].speechActs[0],
            type: "reveal"
          }]
        }]
      }
    }),
    npcPerformerRequest()
  );
  assert.equal(forbiddenSpeechActNpcPerformance.ok, false);
  assert.equal(forbiddenSpeechActNpcPerformance.issues.includes("payload.utterances[0].speechActs[0].type is not allowed for npc_performer mini."), true);

  let sendCount = 0;
  const disabledApi = createNarrativeOpenAiEnhancementApi({
    env: {},
    apiKey: "sk-test-secret",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      sendCount += 1;
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const disabled = await runRoute(disabledApi, { request: request() });
  assert.equal(sendCount, 1);
  assert.equal(disabled.statusCode, 200);
  assert.equal(disabled.payload.ok, false);
  assert.equal(disabled.payload.error, "OPENAI_NOT_ENABLED");

  let called = false;
  const missingKeyApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1" },
    apiKey: null,
    fetchImpl: async () => {
      called = true;
      throw new Error("fetch should not be called");
    },
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const missingKey = await runRoute(missingKeyApi, { request: request() });
  assert.equal(called, false);
  assert.equal(missingKey.payload.error, "OPENAI_API_KEY_MISSING");

  let capturedAuth = "";
  let capturedBody = null;
  const liveApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1", NARRATION_OPENAI_MODEL: "gpt-4.1-mini", NARRATION_OPENAI_INTENT_MODEL: "gpt-4.1-intent-test" },
    apiKey: "sk-test-secret",
    fetchImpl: async (_url, init) => {
      capturedAuth = init.headers.Authorization;
      capturedBody = JSON.parse(init.body);
      return {
        status: 200,
        statusText: "OK",
        async json() {
          return { output_text: JSON.stringify(outputFor(request())), usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } };
        },
        async text() {
          return "";
        }
      };
    },
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const live = await runRoute(liveApi, { request: request() });
  assert.equal(live.statusCode, 200);
  assert.equal(live.payload.ok, true);
  assert.equal(live.payload.output.role, "player_expression_adapter");
  assert.equal(capturedAuth, "Bearer sk-test-secret");
  assert.equal(capturedBody.model, "gpt-4.1-mini");

  const liveIntentApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1", NARRATION_OPENAI_MODEL: "gpt-4.1-mini", NARRATION_OPENAI_INTENT_MODEL: "gpt-4.1-intent-test" },
    apiKey: "sk-test-secret",
    fetchImpl: async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return {
        status: 200,
        statusText: "OK",
        async json() {
          return { output_text: JSON.stringify(intentOutputFor(intentRequest())), usage: { input_tokens: 11, output_tokens: 21, total_tokens: 32 } };
        },
        async text() {
          return "";
        }
      };
    },
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const liveIntent = await runRoute(liveIntentApi, { request: intentRequest() });
  assert.equal(liveIntent.statusCode, 200);
  assert.equal(liveIntent.payload.ok, true);
  assert.equal(liveIntent.payload.output.role, "player_intent_interpreter");
  assert.equal(liveIntent.payload.output.contractVersion, "ai-intent-interpretation/1");
  assert.equal(capturedBody.model, "gpt-4.1-intent-test");

  const liveMjPlannerApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1", NARRATION_OPENAI_MODEL: "gpt-4.1-mini", NARRATION_OPENAI_MJ_PLANNER_MODEL: "gpt-4.1-mj-planner-test" },
    apiKey: "sk-test-secret",
    fetchImpl: async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return {
        status: 200,
        statusText: "OK",
        async json() {
          return { output_text: JSON.stringify(mjPlannerOutputFor(mjPlannerRequest())), usage: { input_tokens: 13, output_tokens: 23, total_tokens: 36 } };
        },
        async text() {
          return "";
        }
      };
    },
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const liveMjPlanner = await runRoute(liveMjPlannerApi, { request: mjPlannerRequest() });
  assert.equal(liveMjPlanner.statusCode, 200);
  assert.equal(liveMjPlanner.payload.ok, true);
  assert.equal(liveMjPlanner.payload.output.role, "mj_planner");
  assert.equal(liveMjPlanner.payload.output.contractVersion, "mj-planner/1");
  assert.equal(capturedBody.model, "gpt-4.1-mj-planner-test");

  const liveNpcPerformerApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1", NARRATION_OPENAI_MODEL: "gpt-4.1-mini", NARRATION_OPENAI_NPC_PERFORMER_MODEL: "gpt-4.1-npc-performer-test" },
    apiKey: "sk-test-secret",
    fetchImpl: async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return {
        status: 200,
        statusText: "OK",
        async json() {
          return { output_text: JSON.stringify(npcPerformerOutputFor(npcPerformerRequest())), usage: { input_tokens: 14, output_tokens: 24, total_tokens: 38 } };
        },
        async text() {
          return "";
        }
      };
    },
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const liveNpcPerformer = await runRoute(liveNpcPerformerApi, { request: npcPerformerRequest() });
  assert.equal(liveNpcPerformer.statusCode, 200);
  assert.equal(liveNpcPerformer.payload.ok, true);
  assert.equal(liveNpcPerformer.payload.output.role, "npc_performer");
  assert.equal(liveNpcPerformer.payload.output.contractVersion, "npc-performer/1");
  assert.equal(capturedBody.model, "gpt-4.1-npc-performer-test");

  const fencedSceneApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1", NARRATION_OPENAI_MODEL: "gpt-4.1-mini" },
    apiKey: "sk-test-secret",
    fetchImpl: async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return {
        status: 200,
        statusText: "OK",
        async json() {
          return {
            output_text: `\`\`\`json\n${JSON.stringify(sceneOutputFor(sceneReq))}\n\`\`\``,
            usage: { input_tokens: 12, output_tokens: 22, total_tokens: 34 }
          };
        },
        async text() {
          return "";
        }
      };
    },
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const fencedScene = await runRoute(fencedSceneApi, { request: sceneReq });
  assert.equal(fencedScene.payload.ok, true);
  assert.equal(fencedScene.payload.output.role, "scene_writer");
  assert.deepEqual(capturedBody.text.format.schema.properties.payload.properties.narrationBlocks.items.properties.groundedIn.items.enum, [
    "resolution:route-scene-001",
    "reference-scene:reference-inn-rain-001"
  ]);

  const invalidJsonApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1" },
    apiKey: "sk-test-secret",
    fetchImpl: async () => ({
      status: 200,
      statusText: "OK",
      async json() {
        return { output_text: "Je ne respecte pas le format JSON." };
      },
      async text() {
        return "";
      }
    }),
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const invalidJson = await runRoute(invalidJsonApi, { request: sceneReq });
  assert.equal(invalidJson.payload.ok, false);
  assert.equal(invalidJson.payload.error, "OPENAI_INVALID_JSON");
  assert.equal(/Preview: Je ne respecte pas le format JSON/u.test(invalidJson.payload.output.diagnostics[0].message), true);

  const invalidOutputApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1" },
    apiKey: "sk-test-secret",
    fetchImpl: async () => ({
      status: 200,
      statusText: "OK",
      async json() {
        return { output_text: JSON.stringify({ ...outputFor(request()), role: "scene_writer" }) };
      },
      async text() {
        return "";
      }
    }),
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const invalidOutput = await runRoute(invalidOutputApi, { request: request() });
  assert.equal(invalidOutput.payload.ok, false);
  assert.equal(invalidOutput.payload.error, "OPENAI_INVALID_ENVELOPE");

  const httpErrorApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1" },
    apiKey: "sk-test-secret",
    fetchImpl: async () => ({
      status: 400,
      statusText: "Bad Request",
      async json() {
        throw new Error("json should not be called");
      },
      async text() {
        return "{\"error\":{\"message\":\"Invalid schema sk-test-redacted\"}}";
      }
    }),
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const httpError = await runRoute(httpErrorApi, { request: request() });
  assert.equal(httpError.payload.ok, false);
  assert.equal(httpError.payload.error, "OPENAI_HTTP_ERROR");
  assert.equal(httpError.payload.output.diagnostics[0].message.includes("[REDACTED_KEY]"), true);

  console.log("narrative-openai-route/1: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
