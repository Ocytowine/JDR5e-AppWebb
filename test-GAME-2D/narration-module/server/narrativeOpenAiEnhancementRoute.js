"use strict";

const ALLOWED_ROLES = new Set(["player_expression_adapter", "scene_writer", "scene_creator", "coherence_critic", "player_intent_interpreter", "mj_planner", "npc_performer"]);
const CONTRACT_VERSION = "narrative-ai-resolution/1";
const INTENT_CONTRACT_VERSION = "ai-intent-interpretation/1";
const SEMANTIC_INTENT_CONTRACT_VERSION_V2 = "ai-intent-semantic/2";
const SEMANTIC_INTENT_CONTRACT_VERSION_V3 = "ai-intent-semantic/3";
const SEMANTIC_INTENT_CONTRACT_VERSION_V4 = "ai-intent-semantic/4";
const SEMANTIC_INTENT_CONTRACT_VERSION_V5 = "ai-intent-semantic/5";
const MJ_PLANNER_CONTRACT_VERSION = "mj-planner/1";
const NPC_PERFORMER_CONTRACT_VERSION = "npc-performer/1";
const SCENE_CREATOR_CONTRACT_VERSION_V1 = "lore-guided-place-candidate/1";
const SCENE_CREATOR_CONTRACT_VERSION_V2 = "lore-guided-place-candidate/2";
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_SCENE_CREATOR_MODEL = "gpt-5.6-luna";

// Source active pour la route serveur: le schéma est construit par requête afin
// de verrouiller le rôle, le contrat et le payload attendus, notamment pour
// `player_intent_interpreter`.
function buildStrictAiOutputSchema(request) {
  return {
    name: "narrative_ai_role_output_envelope_v1",
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion",
        "contractVersion",
        "outputId",
        "callId",
        "attemptId",
        "packId",
        "snapshotId",
        "role",
        "status",
        "payload",
        "diagnostics",
        "supersedesOutputId"
      ],
      properties: {
        schemaVersion: { enum: [1] },
        contractVersion: { enum: [request.contractVersion] },
        outputId: { type: "string" },
        callId: { enum: [request.callId] },
        attemptId: { enum: [request.attemptId] },
        packId: { enum: [request.packId] },
        snapshotId: { enum: [request.snapshotId] },
        role: { enum: [request.role] },
        status: { enum: ["OK"] },
        payload: buildRolePayloadSchema(request),
        diagnostics: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["code", "severity", "message", "sourceRefs"],
            properties: {
              code: { type: "string" },
              severity: { enum: ["INFO", "WARNING", "BLOCKING"] },
              message: { type: "string" },
              sourceRefs: { type: "array", items: { type: "string" } }
            }
          }
        },
        supersedesOutputId: { type: ["string", "null"] }
      }
    }
  };
}

// Compatibilité legacy pour les tests/consommateurs I-06I. Les nouveaux rôles
// doivent utiliser `buildStrictAiOutputSchema(request)`.
const STRICT_AI_OUTPUT_SCHEMA = {
  name: "narrative_ai_role_output_envelope_v1",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "schemaVersion",
      "contractVersion",
      "outputId",
      "callId",
      "attemptId",
      "packId",
      "snapshotId",
      "role",
      "status",
      "payload",
      "diagnostics",
      "supersedesOutputId"
    ],
    properties: {
      schemaVersion: { enum: [1] },
      contractVersion: { enum: [CONTRACT_VERSION] },
      outputId: { type: "string" },
      callId: { type: "string" },
      attemptId: { type: "string" },
      packId: { type: "string" },
      snapshotId: { type: "string" },
      role: { enum: ["player_expression_adapter", "scene_writer"] },
      status: { enum: ["OK", "NEEDS_CLARIFICATION", "CANNOT_COMPLY", "REFUSED", "PARTIAL_UNUSABLE"] },
      payload: { type: "object", additionalProperties: true },
      diagnostics: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["code", "severity", "message", "sourceRefs"],
          properties: {
            code: { type: "string" },
            severity: { enum: ["INFO", "WARNING", "BLOCKING"] },
            message: { type: "string" },
            sourceRefs: { type: "array", items: { type: "string" } }
          }
        }
      },
      supersedesOutputId: { type: ["string", "null"] }
    }
  }
};

function buildRolePayloadSchema(requestOrRole) {
  const role = typeof requestOrRole === "string" ? requestOrRole : requestOrRole.role;
  if (role === "scene_creator") {
    const stringArray = { type: "array", items: { type: "string" } };
    const allowedParentLocationRefs = Array.isArray(requestOrRole?.input?.roleContextPack?.allowedParentLocationRefs)
      ? requestOrRole.input.roleContextPack.allowedParentLocationRefs.filter(ref => typeof ref === "string" && ref.trim().length > 0)
      : [];
    const parentLocationRefSchema = allowedParentLocationRefs.length > 0
      ? { type: "string", enum: allowedParentLocationRefs }
      : { type: "string" };
    const allowedPersistenceDepths = Array.isArray(requestOrRole?.input?.roleContextPack?.allowedPersistenceDepths)
      ? requestOrRole.input.roleContextPack.allowedPersistenceDepths.filter(depth => ["LIGHT_REFERENCE", "FULL_ENTITY"].includes(depth))
      : [];
    const v2 = typeof requestOrRole === "object" && requestOrRole.contractVersion === SCENE_CREATOR_CONTRACT_VERSION_V2;
    const required = ["proposalId", "requestedDepth", "displayName", "summary", "initialTension", "perceptibleFeatures", "populationRoles", "localNorms", "proposedPlaceRef", "arrivalSceneId", "parentLocationRef", "reason", "expectedEffects", "narrativeCommitments", "duplicatePolicy"];
    if (!v2) required.push("connectionIntents");
    const properties = {
      proposalId: { type: "string" },
      requestedDepth: { enum: allowedPersistenceDepths.length > 0 ? allowedPersistenceDepths : ["LIGHT_REFERENCE", "FULL_ENTITY"] },
      displayName: { type: "string" }, summary: { type: "string" }, initialTension: { type: "string" },
      perceptibleFeatures: { ...stringArray, minItems: 1 }, populationRoles: { ...stringArray, minItems: 1 }, localNorms: { ...stringArray, minItems: 1 },
      proposedPlaceRef: { type: "string", pattern: "^[a-z][a-z0-9_-]*:.+" }, arrivalSceneId: { type: "string", pattern: "^[a-z][a-z0-9_-]*:.+" }, parentLocationRef: parentLocationRefSchema,
      reason: { type: "string" }, expectedEffects: stringArray, narrativeCommitments: { ...stringArray, minItems: 1 },
      duplicatePolicy: { enum: ["REUSE", "ENRICH", "CREATE_DISTINCT", "POSSIBLE_SAME_AS", "REJECT_IF_SIMILAR"] }
    };
    if (!v2) properties.connectionIntents = { type: "array", minItems: 1, maxItems: 4, items: { type: "object", additionalProperties: false,
      required: ["sourceSceneId", "boundaryRef", "destinationRef", "scale", "sourceRefs"],
      properties: { sourceSceneId: { type: "string" }, boundaryRef: { type: "string" }, destinationRef: { type: "string" }, scale: { enum: ["LOCAL", "TRAVEL"] }, sourceRefs: stringArray } } };
    return {
      type: "object",
      additionalProperties: false,
      required,
      properties
    };
  }
  if (role === "player_intent_interpreter") {
    if (typeof requestOrRole === "object" && requestOrRole.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V5) {
      return buildSemanticIntentPayloadSchemaV5();
    }
    if (typeof requestOrRole === "object" && requestOrRole.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V4) {
      return buildSemanticIntentPayloadSchemaV4();
    }
    if (typeof requestOrRole === "object" && requestOrRole.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V3) {
      return buildSemanticIntentPayloadSchemaV3();
    }
    if (typeof requestOrRole === "object" && requestOrRole.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V2) {
      return buildSemanticIntentPayloadSchemaV2();
    }
    return {
      type: "object",
      additionalProperties: false,
      required: ["rawInputEcho", "intents"],
      properties: {
        rawInputEcho: { type: "string" },
        intents: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "intentId",
              "order",
              "intentType",
              "commitment",
              "target",
              "action",
              "semanticIntent",
              "runtimeHandling",
              "referentResolution",
              "topic",
              "coreMeaning",
              "playerImposedDetails",
              "openDetails",
              "forbiddenInterpretations",
              "requiresClarification",
              "clarificationQuestion",
              "riskFlags",
              "expectedTimeEffect",
              "confidence"
            ],
            properties: {
              intentId: { type: "string" },
              order: { type: "integer", minimum: 1 },
              intentType: {
                enum: [
                  "meta_question",
                  "possibility_query",
                  "memory_recall",
                  "speech",
                  "action",
                  "mixed",
                  "unclear_commitment"
                ]
              },
              commitment: { enum: ["none", "hypothetical", "conditional", "committed", "unclear"] },
              target: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "ref", "label"],
                    properties: {
                      kind: { enum: ["npc", "place", "object", "self", "unknown"] },
                      ref: { type: ["string", "null"] },
                      label: { type: ["string", "null"] }
                    }
                  },
                  { type: "null" }
                ]
              },
              action: { enum: ["ask_possibility", "ask", "open", "force", "observe", "act", null] },
              semanticIntent: {
                type: "object",
                additionalProperties: false,
                required: ["schemaVersion", "kind", "playerGoal", "target", "commitment", "evidenceFromInput", "uncertainties", "forbiddenInterpretations", "confidence", "perception", "dialogueAct"],
                properties: {
                  schemaVersion: { enum: [1] },
                  kind: { enum: ["address_visible_actor", "move_near_visible_actor", "manipulate_visible_object", "traverse_visible_boundary", "observe_environment", "nonverbal_signal", "hypothetical_action", "context_question", "meta_request", "unclear_intent"] },
                  playerGoal: { type: "string" },
                  target: {
                    anyOf: [
                      {
                        type: "object",
                        additionalProperties: false,
                        required: ["kind", "ref", "label"],
                        properties: {
                          kind: { enum: ["npc", "place", "object", "self", "unknown"] },
                          ref: { type: ["string", "null"] },
                          label: { type: ["string", "null"] }
                        }
                      },
                      { type: "null" }
                    ]
                  },
                  commitment: { enum: ["none", "hypothetical", "conditional", "committed", "unclear"] },
                  evidenceFromInput: { type: "array", minItems: 1, items: { type: "string" } },
                  uncertainties: { type: "array", items: { type: "string" } },
                  forbiddenInterpretations: { type: "array", items: { type: "string" } },
                  confidence: { enum: ["low", "medium", "high"] },
                  perception: {
                    anyOf: [{
                      type: "object",
                      additionalProperties: false,
                      required: ["schemaVersion", "depth", "focus", "soughtInformation"],
                      properties: {
                        schemaVersion: { enum: [1] },
                        depth: { enum: ["GLANCE", "FOCUSED", "SEARCH"] },
                        focus: { type: "string" },
                        soughtInformation: { type: ["string", "null"] }
                      }
                    }, { type: "null" }]
                  },
                  dialogueAct: {
                    anyOf: [{
                      type: "object",
                      additionalProperties: false,
                      required: ["schemaVersion", "act", "contentGoal", "addresseeRef"],
                      properties: {
                        schemaVersion: { enum: [1] },
                        act: { enum: ["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER"] },
                        contentGoal: { type: "string" },
                        addresseeRef: { type: ["string", "null"] }
                      }
                    }, { type: "null" }]
                  }
                }
              },
              runtimeHandling: {
                type: "object",
                additionalProperties: false,
                required: ["schemaVersion", "status", "reason", "requiredDomain", "canonicalActionHint", "noCommit", "noGameTime"],
                properties: {
                  schemaVersion: { enum: [1] },
                  status: { enum: ["SUPPORTED_BY_CURRENT_RUNTIME", "UNSUPPORTED_DOMAIN", "NEEDS_CLARIFICATION", "AI_INTERPRETATION_FAILED"] },
                  reason: { type: "string" },
                  requiredDomain: { enum: ["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world", null] },
                  canonicalActionHint: { enum: ["ask_possibility", "ask", "open", "force", "observe", "act", null] },
                  noCommit: { type: "boolean" },
                  noGameTime: { type: "boolean" }
                }
              },
              referentResolution: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["schemaVersion", "usedPreviousContext", "source", "resolvedTarget", "evidence", "ambiguity", "confidence"],
                    properties: {
                      schemaVersion: { enum: [1] },
                      usedPreviousContext: { type: "boolean" },
                      source: { enum: ["current_input", "recent_visible_focus", "visible_scene", "none"] },
                      resolvedTarget: {
                        anyOf: [
                          {
                            type: "object",
                            additionalProperties: false,
                            required: ["kind", "ref", "label"],
                            properties: {
                              kind: { enum: ["npc", "place", "object", "self", "unknown"] },
                              ref: { type: ["string", "null"] },
                              label: { type: ["string", "null"] }
                            }
                          },
                          { type: "null" }
                        ]
                      },
                      evidence: { type: "array", items: { type: "string" } },
                      ambiguity: { enum: ["none", "multiple_candidates", "incompatible_action", "insufficient_context", "unknown"] },
                      confidence: { enum: ["low", "medium", "high"] }
                    }
                  },
                  { type: "null" }
                ]
              },
              topic: { type: ["string", "null"] },
              coreMeaning: { type: "string" },
              playerImposedDetails: { type: "array", items: { type: "string" } },
              openDetails: { type: "array", items: { type: "string" } },
              forbiddenInterpretations: { type: "array", items: { type: "string" } },
              requiresClarification: { type: "boolean" },
              clarificationQuestion: { type: ["string", "null"] },
              riskFlags: { type: "array", items: { type: "string" } },
              expectedTimeEffect: { enum: ["NO_GAME_TIME", "DOMAIN_TO_DECIDE"] },
              confidence: { enum: ["low", "medium", "high"] }
            }
          }
        }
      }
    };
  }

  if (role === "player_expression_adapter") {
    return {
      type: "object",
      additionalProperties: false,
      required: [
        "intentId",
        "expressionKind",
        "renderedExpression",
        "meaningCovered",
        "addedMeaning",
        "omittedMeaning",
        "styleChoices",
        "safeToUse"
      ],
      properties: {
        intentId: { type: "string" },
        expressionKind: { enum: ["speech", "gesture", "action_staging"] },
        renderedExpression: { type: "string" },
        meaningCovered: { type: "array", items: { type: "string" } },
        addedMeaning: { type: "array", items: { type: "string" } },
        omittedMeaning: { type: "array", items: { type: "string" } },
        styleChoices: { type: "array", items: { type: "string" } },
        safeToUse: { type: "boolean" }
      }
    };
  }

  if (role === "coherence_critic") {
    return {
      type: "object",
      additionalProperties: false,
      required: ["verdict", "findings", "correctionConstraints"],
      properties: {
        verdict: { enum: ["PASS", "REVISE", "REJECT"] },
        findings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["findingId", "severity", "category", "affectedRefs", "explanation"],
            properties: {
              findingId: { type: "string" },
              severity: { enum: ["INFO", "WARNING", "BLOCKING"] },
              category: { enum: ["AUTHORITY", "PLAYER_AGENCY", "SECRET_LEAK", "PERSPECTIVE", "PLOT_COHERENCE", "RULE_CONFLICT", "DUPLICATE", "UNSUPPORTED_CREATION"] },
              affectedRefs: { type: "array", items: { type: "string" } },
              explanation: { type: "string" }
            }
          }
        },
        correctionConstraints: { type: "array", items: { type: "string" } }
      }
    };
  }

  if (role === "mj_planner") {
    return {
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion",
        "planId",
        "planningBasis",
        "sceneBeats",
        "commandProposals",
        "creationProposals",
        "actorAssignments",
        "revealPlan",
        "timeAdvanceProposal",
        "playerHandoff",
        "riskFlags",
        "respectedCommitmentRefs",
        "forbiddenOutcomes"
      ],
      properties: {
        schemaVersion: { enum: [1] },
        planId: { type: "string" },
        planningBasis: {
          type: "object",
          additionalProperties: false,
          required: ["intentId", "semanticGoal", "runtimeStatus", "requiredDomain"],
          properties: {
            intentId: { type: "string" },
            semanticGoal: { type: "string" },
            runtimeStatus: { enum: ["SUPPORTED_BY_CURRENT_RUNTIME", "UNSUPPORTED_DOMAIN", "NEEDS_CLARIFICATION", "AI_INTERPRETATION_FAILED"] },
            requiredDomain: { enum: ["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world", null] }
          }
        },
        sceneBeats: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["beatId", "kind", "actorIds", "stopCondition"],
            properties: {
              beatId: { type: "string" },
              kind: { enum: ["CONTEXT_RESPONSE", "LOCAL_ACTION_ATTEMPT", "ACTOR_REACTION_EXPECTED", "DOMAIN_BLOCKED", "CLARIFICATION"] },
              actorIds: { type: "array", items: { type: "string" } },
              stopCondition: { type: "string" }
            }
          }
        },
        commandProposals: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["proposalId", "domain", "commandType", "targetRefs", "payload", "commitAuthority"],
            properties: {
              proposalId: { type: "string" },
              domain: { enum: ["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world"] },
              commandType: { type: "string" },
              targetRefs: { type: "array", items: { type: "string" } },
              payload: {
                type: "object",
                additionalProperties: false,
                required: ["intentType", "action", "semanticKind", "semanticGoal"],
                properties: {
                  intentType: { type: "string" },
                  action: { type: ["string", "null"] },
                  semanticKind: { type: "string" },
                  semanticGoal: { type: "string" }
                }
              },
              commitAuthority: { enum: [false] }
            }
          }
        },
        creationProposals: {
          type: "array",
          maxItems: 0,
          items: { type: "string" }
        },
        actorAssignments: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["role", "actorId", "reason"],
            properties: {
              role: { enum: ["intent_interpreter", "player_intent_interpreter", "mj_planner", "player_expression_adapter", "npc_performer", "rules_adjudicator", "coherence_critic", "scene_writer", "scene_creator", "clarification_writer"] },
              actorId: { type: ["string", "null"] },
              reason: { type: "string" }
            }
          }
        },
        revealPlan: {
          type: "object",
          additionalProperties: false,
          required: ["reveal", "hint", "withhold"],
          properties: {
            reveal: { type: "array", maxItems: 0, items: { type: "string" } },
            hint: { type: "array", items: { type: "string" } },
            withhold: { type: "array", items: { type: "string" } }
          }
        },
        timeAdvanceProposal: { type: "null" },
        playerHandoff: {
          type: "object",
          additionalProperties: false,
          required: ["handoffKind", "reason"],
          properties: {
            handoffKind: { enum: ["ASK_PLAYER", "CONTINUE_AUTOMATICALLY", "CLARIFY", "END_TURN"] },
            reason: { type: "string" }
          }
        },
        riskFlags: { type: "array", items: { type: "string" } },
        respectedCommitmentRefs: { type: "array", items: { type: "string" } },
        forbiddenOutcomes: {
          type: "array",
          items: { type: "string" }
        }
      }
    };
  }

  if (role === "npc_performer") {
    const allowedSourceRefs = Array.isArray(requestOrRole?.input?.task?.knowledgeEnvelope?.allowedSourceRefs)
      ? requestOrRole.input.task.knowledgeEnvelope.allowedSourceRefs.filter(ref => typeof ref === "string" && ref.trim().length > 0)
      : [];
    const sourceRefItems = allowedSourceRefs.length > 0
      ? { type: "string", enum: allowedSourceRefs }
      : { type: "string" };
    return {
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion",
        "performanceId",
        "actorId",
        "reactionFrame",
        "utterances",
        "nonVerbalReactions",
        "durableCommitments",
        "revealedRefs",
        "knowledgeUsed",
        "safetyConstraints"
      ],
      properties: {
        schemaVersion: { enum: [1] },
        performanceId: { type: "string" },
        actorId: { type: "string" },
        reactionFrame: {
          type: "object",
          additionalProperties: false,
          required: ["schemaVersion", "sourceDialogueAct", "responseMode", "addressedContentGoal"],
          properties: {
            schemaVersion: { enum: [1] },
            sourceDialogueAct: { enum: ["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER"] },
            responseMode: { enum: ["ACKNOWLEDGE_CONTACT", "ANSWER_QUESTION", "ACKNOWLEDGE_STATEMENT", "RESPOND_TO_REQUEST", "CAUTIOUS_RESPONSE"] },
            addressedContentGoal: { type: "string" }
          }
        },
        utterances: {
          type: "array",
          minItems: 1,
          maxItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["utteranceId", "text", "audience", "speechActs"],
            properties: {
              utteranceId: { type: "string" },
              text: { type: "string" },
              audience: { type: "array", items: { type: "string" } },
              speechActs: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["type", "content", "epistemicBasis", "sourceRefs"],
                  properties: {
                    type: { enum: ["assertion", "question", "refusal"] },
                    content: { type: "string" },
                    epistemicBasis: { enum: ["known", "believed", "uncertain"] },
                    sourceRefs: { type: "array", items: sourceRefItems }
                  }
                }
              }
            }
          }
        },
        nonVerbalReactions: { type: "array", items: { type: "string" } },
        durableCommitments: { type: "array", maxItems: 0, items: { type: "string" } },
        revealedRefs: { type: "array", maxItems: 0, items: { type: "string" } },
        knowledgeUsed: { type: "array", items: sourceRefItems },
        safetyConstraints: {
          type: "object",
          additionalProperties: false,
          required: ["noMechanicalSuccess", "noSecretReveal", "noDurableCommitment", "noStateMutation"],
          properties: {
            noMechanicalSuccess: { enum: [true] },
            noSecretReveal: { enum: [true] },
            noDurableCommitment: { enum: [true] },
            noStateMutation: { enum: [true] }
          }
        }
      }
    };
  }

  const allowedGrounding = Array.isArray(requestOrRole?.input?.task?.allowedGrounding)
    ? requestOrRole.input.task.allowedGrounding.filter(ref => typeof ref === "string" && ref.trim().length > 0)
    : [];
  const groundedInItems = allowedGrounding.length > 0
    ? { type: "string", enum: allowedGrounding }
    : { type: "string" };
  return {
    type: "object",
    additionalProperties: false,
    required: ["narrationBlocks"],
    properties: {
      narrationBlocks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slotId", "blockKind", "content", "groundedIn", "usesCreativeTexture", "factDiscipline"],
          properties: {
            slotId: { type: "string" },
            blockKind: { enum: ["MJ_NARRATION"] },
            content: { type: "string" },
            groundedIn: { type: "array", minItems: 1, items: groundedInItems },
            usesCreativeTexture: { type: "boolean" },
            factDiscipline: {
              type: "object",
              additionalProperties: false,
              required: [
                "addedUnsupportedFacts",
                "usesOnlyProvidedVisibleEntities",
                "noNewEvents",
                "noHiddenPresence",
                "notes"
              ],
              properties: {
                addedUnsupportedFacts: { type: "array", items: { type: "string" } },
                usesOnlyProvidedVisibleEntities: { type: "boolean" },
                noNewEvents: { type: "boolean" },
                noHiddenPresence: { type: "boolean" },
                notes: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    }
  };
}

function buildSemanticIntentPayloadSchemaV2() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["rawInputEcho", "intent"],
    properties: {
      rawInputEcho: { type: "string" },
      intent: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "commitment", "preconditions", "playerGoal", "actionHint", "domainHint", "scope", "targetMention", "perception", "dialogueAct", "uncertainties", "clarificationPrompt", "confidence"],
        properties: {
          kind: { enum: ["address_visible_actor", "move_near_visible_actor", "manipulate_visible_object", "traverse_visible_boundary", "observe_environment", "nonverbal_signal", "hypothetical_action", "context_question", "meta_request", "unclear_intent"] },
          commitment: { enum: ["none", "hypothetical", "conditional", "committed", "unclear"] },
          preconditions: { type: "array", maxItems: 4, items: { type: "string" } },
          playerGoal: { type: "string" },
          actionHint: { type: ["string", "null"] },
          domainHint: { enum: ["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world", null] },
          scope: { enum: ["LOCAL_INTERACTION", "SCENE_TRANSITION", "SOCIAL_EXCHANGE", "PERCEPTION", "META", "UNKNOWN"] },
          targetMention: {
            anyOf: [{
              type: "object",
              additionalProperties: false,
              required: ["surface", "candidateKind", "proposedRef", "contextLink"],
              properties: {
                surface: { type: "string" },
                candidateKind: { enum: ["npc", "place", "object", "self", "unknown"] },
                proposedRef: { type: ["string", "null"] },
                contextLink: { enum: ["EXPLICIT", "RECENT_FOCUS", "SCENE_DESCRIPTION", "NONE"] }
              }
            }, { type: "null" }]
          },
          perception: {
            anyOf: [{
              type: "object",
              additionalProperties: false,
              required: ["schemaVersion", "depth", "focus", "soughtInformation"],
              properties: {
                schemaVersion: { enum: [1] },
                depth: { enum: ["GLANCE", "FOCUSED", "SEARCH"] },
                focus: { type: "string" },
                soughtInformation: { type: ["string", "null"] }
              }
            }, { type: "null" }]
          },
          dialogueAct: {
            anyOf: [{
              type: "object",
              additionalProperties: false,
              required: ["act", "contentGoal"],
              properties: {
                act: { enum: ["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER"] },
                contentGoal: { type: "string" }
              }
            }, { type: "null" }]
          },
          uncertainties: { type: "array", maxItems: 4, items: { type: "string" } },
          clarificationPrompt: { type: ["string", "null"] },
          confidence: { enum: ["low", "medium", "high"] }
        }
      }
    }
  };
}

function createNarrativeOpenAiEnhancementApi(options) {
  const sendJson = options.sendJson;
  const parseJsonBody = options.parseJsonBody;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const env = options.env || process.env;
  const apiKey = options.apiKey || null;

  async function tryHandle(req, res) {
    if (req.method !== "POST" || req.url !== "/api/narration/enhance-openai") return false;
    const startedAtMs = Date.now();
    let normalizedRequest = null;
    try {
      const body = await parseJsonBody(req);
      const request = normalizeAiCallRequest(body && body.request);
      if (!request.ok) {
        return sendJson(res, 400, {
          ok: false,
          error: "INVALID_REQUEST",
          issues: request.issues
        });
      }
      normalizedRequest = request.value;

      if (env.NARRATION_OPENAI_LIVE !== "1") {
        return sendJson(res, 200, {
          ok: false,
          error: "OPENAI_NOT_ENABLED",
          output: errorEnvelope(request.value, "OPENAI_NOT_ENABLED", "NARRATION_OPENAI_LIVE must be 1.")
        });
      }

      if (!apiKey) {
        return sendJson(res, 200, {
          ok: false,
          error: "OPENAI_API_KEY_MISSING",
          output: errorEnvelope(request.value, "OPENAI_API_KEY_MISSING", "Server-side OPENAI_API_KEY is missing.")
        });
      }

      const route = buildServerRoute(request.value, env);
      const openAiBody = buildOpenAiResponsesBody(request.value, route);
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(openAiBody),
        signal: AbortSignal.timeout(request.value.limits.timeoutMs)
      });

      if (!response || response.status < 200 || response.status >= 300) {
        const errorText = response && typeof response.text === "function"
          ? sanitizeProviderErrorText(await response.text())
          : "";
        return sendJson(res, 200, {
          ok: false,
          error: "OPENAI_HTTP_ERROR",
          output: errorEnvelope(
            request.value,
            "OPENAI_HTTP_ERROR",
            `OpenAI HTTP status ${response ? response.status : "unknown"}.${errorText ? ` ${errorText}` : ""}`
          )
        });
      }

      const data = await response.json();
      if (data && data.status === "incomplete") {
        const reason = data.incomplete_details && typeof data.incomplete_details.reason === "string"
          ? data.incomplete_details.reason
          : "unknown";
        return sendJson(res, 200, {
          ok: false,
          error: "OPENAI_OUTPUT_INCOMPLETE",
          output: errorEnvelope(
            request.value,
            "OPENAI_OUTPUT_INCOMPLETE",
            `OpenAI response was incomplete (${reason}); output token budget=${request.value.limits.outputTokenBudget}.`
          )
        });
      }
      const outputText = extractOutputText(data);
      if (!outputText) {
        return sendJson(res, 200, {
          ok: false,
          error: "OPENAI_EMPTY_OUTPUT",
          output: errorEnvelope(request.value, "OPENAI_EMPTY_OUTPUT", "OpenAI response did not contain output_text.")
        });
      }

      let parsed;
      try {
        parsed = parseOpenAiOutputJson(outputText);
      } catch {
        return sendJson(res, 200, {
          ok: false,
          error: "OPENAI_INVALID_JSON",
          output: errorEnvelope(
            request.value,
            "OPENAI_INVALID_JSON",
            `OpenAI output was not parseable JSON. Preview: ${previewProviderText(outputText)}`
          )
        });
      }

      const normalizedOutput = normalizeProviderEnvelope(parsed, request.value);
      const validation = validateEnvelope(normalizedOutput, request.value);
      if (!validation.ok) {
        return sendJson(res, 200, {
          ok: false,
          error: "OPENAI_INVALID_ENVELOPE",
          issues: validation.issues,
          output: errorEnvelope(request.value, "OPENAI_INVALID_ENVELOPE", "OpenAI output failed local envelope validation.")
        });
      }

      return sendJson(res, 200, {
        ok: true,
        output: normalizedOutput,
        metrics: {
          providerId: "openai",
          modelId: route.modelId,
          reasoningEffort: route.reasoningEffort,
          role: request.value.role,
          latencyMs: Date.now() - startedAtMs,
          inputTokens: Number.isInteger(data?.usage?.input_tokens) ? data.usage.input_tokens : null,
          outputTokens: Number.isInteger(data?.usage?.output_tokens) ? data.usage.output_tokens : null,
          totalTokens: Number.isInteger(data?.usage?.total_tokens) ? data.usage.total_tokens : null,
          finishReason: typeof data?.status === "string" ? data.status : null,
          inputTokenBudget: request.value.limits.inputTokenBudget,
          outputTokenBudget: request.value.limits.outputTokenBudget,
          contextChars: JSON.stringify(request.value.input).length,
          schemaChars: JSON.stringify(buildStrictAiOutputSchema(request.value)).length
        }
      });
    } catch (error) {
      if (normalizedRequest !== null) {
        const message = error instanceof Error ? error.message : String(error);
        const route = buildServerRoute(normalizedRequest, env);
        return sendJson(res, 200, {
          ok: false,
          error: "NARRATIVE_OPENAI_ROUTE_FAILURE",
          output: errorEnvelope(
            normalizedRequest,
            "OPENAI_ROUTE_EXCEPTION",
            `Server-side OpenAI call failed: ${sanitizeProviderErrorText(message) || "unknown error"}.`
          ),
          metrics: {
            providerId: "openai",
            modelId: route.modelId,
            reasoningEffort: route.reasoningEffort,
            role: normalizedRequest.role,
            latencyMs: Date.now() - startedAtMs,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            finishReason: error instanceof Error ? error.name : "route_exception",
            inputTokenBudget: normalizedRequest.limits.inputTokenBudget,
            outputTokenBudget: normalizedRequest.limits.outputTokenBudget,
            contextChars: JSON.stringify(normalizedRequest.input).length,
            schemaChars: JSON.stringify(buildStrictAiOutputSchema(normalizedRequest)).length
          }
        });
      }
      return sendJson(res, 500, {
        ok: false,
        error: "NARRATIVE_OPENAI_ROUTE_FAILURE",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { tryHandle };
}

function buildSemanticIntentPayloadSchemaV3() {
  const schema = buildSemanticIntentPayloadSchemaV2();
  schema.properties.intent.required.push("composition");
  schema.properties.intent.properties.composition = {
    type: "object",
    additionalProperties: false,
    required: ["spatialLeadIn", "communication"],
    properties: {
      spatialLeadIn: {
        anyOf: [{
          type: "object",
          additionalProperties: false,
          required: ["kind", "playerGoal", "order"],
          properties: {
            kind: { enum: ["APPROACH_TARGET"] },
            playerGoal: { type: "string" },
            order: { type: "integer", minimum: 1, maximum: 2 }
          }
        }, { type: "null" }]
      },
      communication: {
        anyOf: [{
          type: "object",
          additionalProperties: false,
          required: ["mode", "act", "contentGoal", "order"],
          properties: {
            mode: { enum: ["SPEECH", "NONVERBAL"] },
            act: { enum: ["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER", null] },
            contentGoal: { type: "string" },
            order: { type: "integer", minimum: 1, maximum: 2 }
          }
        }, { type: "null" }]
      }
    }
  };
  return schema;
}

function buildSemanticIntentPayloadSchemaV4() {
  const schema = buildSemanticIntentPayloadSchemaV3();
  const intent = schema.properties.intent;
  const composition = intent.properties.composition;
  composition.required.push("orientation");
  composition.properties.spatialLeadIn.anyOf[0].properties.order.maximum = 3;
  composition.properties.communication.anyOf[0].properties.order.maximum = 3;
  composition.properties.orientation = {
    anyOf: [{
      type: "object",
      additionalProperties: false,
      required: ["kind", "playerGoal", "order"],
      properties: {
        kind: { enum: ["LOCATE_VISIBLE_TARGET"] },
        playerGoal: { type: "string" },
        order: { type: "integer", minimum: 1, maximum: 3 }
      }
    }, { type: "null" }]
  };
  const perception = intent.properties.perception.anyOf[0];
  perception.required.push("informationKind");
  perception.properties.informationKind = { enum: ["PRESENCE", "VISIBLE_TRAIT", "UNCERTAIN_CLUE"] };
  return schema;
}

function buildSemanticIntentPayloadSchemaV5() {
  const schema = buildSemanticIntentPayloadSchemaV4();
  const composition = schema.properties.intent.properties.composition;
  for (const key of ["orientation", "spatialLeadIn", "communication"]) {
    composition.properties[key].anyOf[0].properties.order.maximum = 4;
  }
  composition.required.push("spatialFollowUp");
  composition.properties.spatialFollowUp = {
    anyOf: [{
      type: "object",
      additionalProperties: false,
      required: ["kind", "playerGoal", "order"],
      properties: {
        kind: { enum: ["REPOSITION_AWAY"] },
        playerGoal: { type: "string" },
        order: { type: "integer", minimum: 1, maximum: 4 }
      }
    }, { type: "null" }]
  };
  return schema;
}

function normalizeProviderEnvelope(output, request) {
  if (
    request?.role !== "player_intent_interpreter" ||
    request?.contractVersion !== SEMANTIC_INTENT_CONTRACT_VERSION_V2 ||
    !output || typeof output !== "object" || Array.isArray(output) ||
    !output.payload || typeof output.payload !== "object" || Array.isArray(output.payload) ||
    !output.payload.intent || typeof output.payload.intent !== "object" || Array.isArray(output.payload.intent)
  ) return output;
  const intent = output.payload.intent;
  const dialogueAct = intent.dialogueAct;
  const isContactAct = dialogueAct &&
    typeof dialogueAct === "object" &&
    !Array.isArray(dialogueAct) &&
    dialogueAct.act === "INITIATE_CONVERSATION";
  if (!isContactAct || !["move_near_visible_actor", "nonverbal_signal"].includes(intent.kind)) return output;
  return {
    ...output,
    payload: {
      ...output.payload,
      intent: {
        ...intent,
        kind: "address_visible_actor",
        domainHint: "social",
        scope: "SOCIAL_EXCHANGE",
        perception: null
      }
    }
  };
}

function normalizeAiCallRequest(value) {
  const issues = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, issues: ["request must be an object."] };
  }
  const request = value;
  for (const key of [
    "callId",
    "operationId",
    "attemptId",
    "campaignId",
    "snapshotId",
    "packId",
    "role",
    "contractVersion",
    "modelRouteId",
    "contextFingerprint",
    "idempotencyKey"
  ]) {
    if (typeof request[key] !== "string" || request[key].trim().length === 0) issues.push(`${key} must be a non-empty string.`);
  }
  if (request.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (!ALLOWED_ROLES.has(request.role)) issues.push("role is not allowed for narrative enhancement.");
  const expectedContractVersion = contractVersionForRole(request.role);
  const acceptedContractVersions = request.role === "player_intent_interpreter"
    ? [INTENT_CONTRACT_VERSION, SEMANTIC_INTENT_CONTRACT_VERSION_V2, SEMANTIC_INTENT_CONTRACT_VERSION_V3, SEMANTIC_INTENT_CONTRACT_VERSION_V4, SEMANTIC_INTENT_CONTRACT_VERSION_V5]
    : request.role === "scene_creator"
      ? [SCENE_CREATOR_CONTRACT_VERSION_V1, SCENE_CREATOR_CONTRACT_VERSION_V2]
      : [expectedContractVersion];
  if (!acceptedContractVersions.includes(request.contractVersion)) issues.push(`contractVersion must be one of: ${acceptedContractVersions.join(", ")}.`);
  if (typeof request.contextFingerprint === "string" && !/^sha256:[a-f0-9]{64}$/u.test(request.contextFingerprint)) {
    issues.push("contextFingerprint must be a sha256 fingerprint.");
  }
  if (!request.input || typeof request.input !== "object") {
    issues.push("input must be an object.");
  } else if (typeof request.input.instructionsRef !== "string" || request.input.instructionsRef.trim().length === 0) {
    issues.push("input.instructionsRef must be a non-empty string.");
  }
  if (!request.limits || typeof request.limits !== "object") {
    issues.push("limits must be an object.");
  } else {
    if (!Number.isInteger(request.limits.inputTokenBudget) || request.limits.inputTokenBudget <= 0 || request.limits.inputTokenBudget > 2_000) {
      issues.push("limits.inputTokenBudget must be between 1 and 2000.");
    }
    const maxOutputTokenBudget = request.role === "player_intent_interpreter"
      ? 2_000
      : request.role === "npc_performer"
        ? 2_000
        : request.role === "coherence_critic"
          ? 1_600
      : request.role === "scene_creator"
        ? 2_000
      : request.role === "scene_writer"
        ? 1_500
        : 1_000;
    if (!Number.isInteger(request.limits.outputTokenBudget) || request.limits.outputTokenBudget <= 0 || request.limits.outputTokenBudget > maxOutputTokenBudget) {
      issues.push(`limits.outputTokenBudget must be between 1 and ${maxOutputTokenBudget}.`);
    }
    const maxTimeoutMs = request.role === "scene_creator" ? 60_000 : 30_000;
    if (!Number.isInteger(request.limits.timeoutMs) || request.limits.timeoutMs <= 0 || request.limits.timeoutMs > maxTimeoutMs) {
      issues.push(`limits.timeoutMs must be between 1 and ${maxTimeoutMs}.`);
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: request };
}

function buildServerRoute(request, env) {
  const reasoningEffort = request.role === "player_intent_interpreter"
    ? normalizeReasoningEffort(env.NARRATION_OPENAI_INTENT_REASONING_EFFORT)
    : request.role === "scene_creator"
      ? normalizeReasoningEffort(env.NARRATION_OPENAI_SCENE_CREATOR_REASONING_EFFORT) || "none"
      : null;
  return {
    modelId: request.role === "player_intent_interpreter"
      ? env.NARRATION_OPENAI_INTENT_MODEL || env.NARRATION_OPENAI_MODEL || DEFAULT_MODEL
      : request.role === "mj_planner"
        ? env.NARRATION_OPENAI_MJ_PLANNER_MODEL || env.NARRATION_OPENAI_MODEL || DEFAULT_MODEL
        : request.role === "npc_performer"
          ? env.NARRATION_OPENAI_NPC_PERFORMER_MODEL || env.NARRATION_OPENAI_MODEL || DEFAULT_MODEL
          : request.role === "scene_creator"
            ? env.NARRATION_OPENAI_SCENE_CREATOR_MODEL || env.NARRATION_OPENAI_MODEL || DEFAULT_SCENE_CREATOR_MODEL
            : env.NARRATION_OPENAI_MODEL || DEFAULT_MODEL,
    routeId: request.role === "scene_creator"
      ? "server-openai-narrative-scene-creator"
      : request.role === "scene_writer"
      ? "server-openai-narrative-scene-writer"
      : request.role === "coherence_critic"
        ? "server-openai-narrative-coherence-critic"
      : request.role === "player_intent_interpreter"
        ? "server-openai-player-intent-interpreter"
        : request.role === "mj_planner"
          ? "server-openai-mj-planner"
          : request.role === "npc_performer"
            ? "server-openai-npc-performer"
            : "server-openai-narrative-expression",
    reasoningEffort
  };
}

function normalizeReasoningEffort(value) {
  return ["none", "low", "medium", "high", "xhigh", "max"].includes(value) ? value : null;
}

function contractVersionForRole(role) {
  if (role === "player_intent_interpreter") return INTENT_CONTRACT_VERSION;
  if (role === "mj_planner") return MJ_PLANNER_CONTRACT_VERSION;
  if (role === "npc_performer") return NPC_PERFORMER_CONTRACT_VERSION;
  if (role === "scene_creator") return SCENE_CREATOR_CONTRACT_VERSION_V2;
  return CONTRACT_VERSION;
}

function buildOpenAiResponsesBody(request, route) {
  const strictSchema = buildStrictAiOutputSchema(request);
  const body = {
    model: route.modelId,
    input: [
      {
        role: "system",
        content: [{
          type: "input_text",
          text: buildRoleInstructions(request)
        }]
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: JSON.stringify({
            schemaVersion: request.schemaVersion,
            callId: request.callId,
            outputIdHint: `${request.role}:${request.attemptId}`,
            attemptId: request.attemptId,
            packId: request.packId,
            snapshotId: request.snapshotId,
            role: request.role,
            contractVersion: request.contractVersion,
            task: request.input.task || {},
            roleContextPack: request.input.roleContextPack || {}
          })
        }]
      }
    ],
    max_output_tokens: request.limits.outputTokenBudget,
    text: {
      format: {
        type: "json_schema",
        name: strictSchema.name,
        schema: strictSchema.schema,
        strict: true
      }
    },
    store: false
  };
  if (route.reasoningEffort) body.reasoning = { effort: route.reasoningEffort };
  return body;
}

function buildRoleInstructions(request) {
  const shared = [
    "Tu es une couche de rendu narratif post-resolution pour un jeu de role solo.",
    "Tu ne modifies jamais les faits, les consequences, les reussites, les echecs, l'inventaire, le combat, les secrets ou le temps.",
    "Tu retournes uniquement l'objet JSON strict demande par le schema. Aucun Markdown. Aucun commentaire hors JSON.",
    "Recopie exactement schemaVersion, contractVersion, callId, attemptId, packId, snapshotId et role depuis l'entree utilisateur.",
    "Utilise diagnostics=[] si tout va bien, supersedesOutputId=null et status=OK pour une sortie utilisable.",
    "Si tu ne peux pas respecter le contrat, status=PARTIAL_UNUSABLE ou CANNOT_COMPLY avec un diagnostic, sans inventer de contenu."
  ];

  if (request.role === "scene_creator") {
    const v2 = request.contractVersion === SCENE_CREATOR_CONTRACT_VERSION_V2;
    return [
      "Tu proposes un lieu de jeu nouveau à partir du brief de lore fourni.",
      "Tu n'as aucune autorité de commit, de vérité durable, de création de PNJ présent ni de révélation de secret.",
      "Respecte strictConstraints comme canon, localGuidance comme guide local et regionalGuidance comme inspiration souple.",
      v2
        ? "Produis des identifiants canoniques stables. Ne propose aucune connexion ni topologie : le runtime les construit après validation."
        : "Produis des identifiants canoniques stables et des connexions explicites; chaque connexion déclare au moins une sourceRef fournie par le brief.",
      "parentLocationRef doit recopier exactement une valeur de allowedParentLocationRefs; n'utilise pas une référence wiki à sa place.",
      "requestedDepth doit recopier une valeur de allowedPersistenceDepths; ce parcours crée toujours un lieu persistant revisitable.",
      "populationRoles contient uniquement des intitulés de rôles courts et ciblables, au singulier, sans action ni description (par exemple: archiviste, copiste, garde). Le runtime peut les projeter en présences locales, jamais en PNJ durables.",
      ...shared
    ].join("\n");
  }

  if (request.role === "player_expression_adapter") {
    return [
      ...shared,
      "Role player_expression_adapter: reformule uniquement l'expression visible du personnage joueur.",
      "Preserve l'intention du joueur. N'ajoute aucune promesse, menace, information, action, emotion forte ou risque non exprime.",
      "addedMeaning doit rester [] pour une sortie safeToUse=true.",
      "Si la demande du joueur est trop pauvre, ameliore le style selon le personnage sans changer le sens."
    ].join("\n");
  }

  if (request.role === "player_intent_interpreter") {
    if (
      request.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V2 ||
      request.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V3 ||
      request.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V4 ||
      request.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V5
    ) {
      return [
        "Tu interprètes librement le sens de l'intention du joueur sans produire de conséquence ni de narration.",
        "Retourne uniquement le JSON strict demandé. N'ajoute ni projection legacy, ni décision de commit, ni décision temporelle, ni statut runtime.",
        "playerGoal conserve toute la nuance exprimée. actionHint est un bref concept d'action en langage stable, sans être limité à une liste fermée.",
        "domainHint suggère seulement le domaine propriétaire; le logiciel garde l'autorité de routage.",
        "scope=SCENE_TRANSITION si le but est de franchir une limite, entrer, sortir ou changer de lieu; LOCAL_INTERACTION si le but reste une manipulation dans la scène courante.",
        "kind=move_near_visible_actor pour se placer, s'approcher ou se déplacer vers un acteur visible sans lui parler ni lui adresser de signal. Ce n'est ni address_visible_actor, ni nonverbal_signal, ni manipulate_visible_object.",
        "Si la même entrée combine une approche et une parole ou salutation immédiate, la communication est l'intention principale: utilise address_visible_actor et conserve l'approche dans playerGoal/evidenceFromInput. N'utilise move_near_visible_actor que lorsque aucune parole ni salutation n'est engagée.",
        "Une salutation formulée sans geste explicite ouvre une conversation: utilise address_visible_actor avec dialogueAct=INITIATE_CONVERSATION. Réserve nonverbal_signal aux gestes effectivement décrits, par exemple signe de tête, geste de la main ou regard, sans parole ni salutation verbale.",
        ...([SEMANTIC_INTENT_CONTRACT_VERSION_V3, SEMANTIC_INTENT_CONTRACT_VERSION_V4, SEMANTIC_INTENT_CONTRACT_VERSION_V5].includes(request.contractVersion) ? [
          "composition analyse séparément une éventuelle amorce spatiale et une éventuelle communication; ce champ ne décrit jamais une conséquence.",
          "spatialLeadIn=APPROACH_TARGET seulement si le joueur veut réellement se rapprocher de la cible; sinon null.",
          "communication.mode=SPEECH pour toute parole, question, déclaration, demande ou salutation verbale. Son act décrit l'acte de dialogue. communication.mode=NONVERBAL seulement pour un signal explicitement non verbal et act doit alors être null.",
          "Une approche suivie d'une salutation utilise spatialLeadIn puis communication avec les ordres 1 et 2. Une approche sans communication utilise communication=null. Une salutation sans approche utilise spatialLeadIn=null.",
          "Les champs kind, dialogueAct, scope et domainHint décrivent l'intention principale, mais le logiciel les recalcule depuis composition: ne supprime donc aucune composante exprimée pour forcer une catégorie unique."
        ] : []),
        ...([SEMANTIC_INTENT_CONTRACT_VERSION_V4, SEMANTIC_INTENT_CONTRACT_VERSION_V5].includes(request.contractVersion) ? [
          "composition.orientation=LOCATE_VISIBLE_TARGET lorsque le joueur veut repérer, sélectionner ou rejoindre ensuite un référent publiquement visible, sans chercher un indice caché. Sinon orientation=null.",
          "Une proposition d'orientation conserve son but ultérieur dans playerGoal, mais ne transforme pas ce but en méthode perceptive: vouloir poursuivre des recherches après avoir trouvé un archiviste ne signifie pas rechercher perceptivement un indice.",
          "Pour observe_environment, informationKind=PRESENCE si la question porte sur l'existence ou la localisation immédiate d'une présence; VISIBLE_TRAIT pour un signe public perceptible; UNCERTAIN_CLUE seulement pour une information non déjà visible qui peut justifier une vérification.",
          "Une orientation vers un référent visible utilise perception.informationKind=PRESENCE et ne doit pas demander SEARCH. Une investigation de dissimulation, de trace cachée ou d'information incertaine utilise UNCERTAIN_CLUE.",
          "Le logiciel recalcule l'observation immédiate depuis orientation et le registre visible; ne force jamais SEARCH à cause du seul objectif futur exprimé par le joueur."
        ] : []),
        ...(request.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V5 ? [
          "composition.spatialFollowUp=REPOSITION_AWAY lorsque le joueur s'écarte de la cible après sa communication; sinon null.",
          "REPOSITION_AWAY est une étape locale réversible demandée par le joueur, jamais une réaction ni une conséquence inventée.",
          "spatialFollowUp exige une communication dans ce contrat borné. Place les ordres selon la séquence réellement exprimée, par exemple communication=1 puis spatialFollowUp=2.",
          "Une approche avant une parole reste spatialLeadIn puis communication. N'utilise pas spatialFollowUp pour une approche.",
          "Si le tour sémantique le plus récent porte focusDisposition=RELEASE, sa cible n'est plus un RECENT_FOCUS actif. Un nouveau pronom ne peut la reprendre qu'avec un autre ancrage explicite."
        ] : []),
        "kind=nonverbal_signal seulement si le joueur cherche à communiquer par un geste, un regard, une posture ou un autre signal sans parole.",
        "kind=traverse_visible_boundary lorsque le but est de franchir une porte, une ouverture ou une limite vers un autre espace. targetMention désigne alors la limite visible franchie, même si le joueur nomme surtout la destination.",
        "kind=manipulate_visible_object lorsque le but porte sur l'objet dans la scène courante sans franchissement: ouvrir, fermer, déplacer, examiner par manipulation ou actionner.",
        "hypothetical_action est réservé à une possibilité non engagée et exige commitment=hypothetical. Une tentative, même prudente, discrète ou conditionnelle, n'est pas hypothétique dès que le joueur veut réellement l'accomplir.",
        "preconditions recopie les conditions qui doivent être vraies ou vérifiées avant l'action; [] s'il n'y en a aucune. Toute action dépendant d'une précondition explicite utilise commitment=conditional, jamais committed, même si le joueur veut réellement agir une fois la condition satisfaite.",
        "targetMention décrit les mots ou l'ellipse employés. proposedRef peut utiliser uniquement une référence du referentRegistry fourni; sinon null.",
        "Avec contextLink=SCENE_DESCRIPTION, compare les noms, alias et propriétés publiques. Si un seul référent est le meilleur correspondant à la description ou à une comparaison exprimée, renseigne son proposedRef; garde null seulement si plusieurs candidats restent réellement plausibles.",
        "RECENT_FOCUS est permis lorsqu'un pronom ou une ellipse se rattache réellement au contexte récent. Ne choisis jamais arbitrairement un référent.",
        "Pour une observation, perception est obligatoire; sinon null. Pour une parole, dialogueAct est obligatoire; sinon null.",
        "uncertainties contient uniquement les ambiguïtés réelles. clarificationPrompt est requis pour unclear_intent ou commitment=unclear, sinon null.",
        "Tu peux comprendre des formulations indirectes, composées, fautives ou inédites; ne réduis jamais l'analyse à des mots-clés.",
        "Interdit: succès, échec, réaction PNJ, secret, mutation, temps, inventaire modifié ou handoff exécuté.",
        ...shared
      ].join("\n");
    }
    return [
      "Tu es une couche d'interpretation structuree de l'intention joueur pour un jeu de role solo.",
      "Tu ne modifies jamais les faits, les consequences, les reussites, les echecs, l'inventaire, le combat, les secrets, le lore durable ou le temps.",
      "Tu ne joues pas le MJ, tu ne reponds pas au joueur et tu n'ecris aucun texte visible.",
      "Tu retournes uniquement l'objet JSON strict demande par le schema. Aucun Markdown. Aucun commentaire hors JSON.",
      "Recopie exactement schemaVersion, contractVersion, callId, attemptId, packId, snapshotId et role depuis l'entree utilisateur.",
      "Utilise diagnostics=[] si tout va bien, supersedesOutputId=null et status=OK pour une sortie utilisable.",
      "Role player_intent_interpreter: produire une intention structuree, pas un resultat.",
      "Chaque intention doit remplir semanticIntent: kind, playerGoal, target, commitment, evidenceFromInput, uncertainties, forbiddenInterpretations, confidence, perception et dialogueAct.",
      "Pour observe_environment, perception est obligatoire: GLANCE pour une perception immédiate, FOCUSED pour une attention renforcée, SEARCH pour rechercher activement une information qui peut exiger une vérification. Déduis ce niveau du sens complet de la demande, jamais d'un mot isolé.",
      "Choisis GLANCE par défaut pour une observation ordinaire sans intensification ni objectif de recherche, par exemple 'Je regarde la serveuse'. Ne surclasse jamais une demande ordinaire en FOCUSED par prudence ou pour enrichir la narration.",
      "Choisis FOCUSED seulement si le joueur exprime réellement une attention renforcée, prolongée, précise ou comparative, par exemple 'Je l'observe plus attentivement'. Choisis SEARCH seulement si le joueur cherche à découvrir ou établir une information déterminée au-delà des signes immédiatement visibles.",
      "Pour toute autre intention, perception doit être null.",
      "Pour address_visible_actor, dialogueAct est obligatoire: INITIATE_CONVERSATION si le joueur ouvre seulement le contact, ASK_QUESTION pour une question, MAKE_STATEMENT pour une information exprimée, REQUEST_ACTION pour une demande d'agir, OTHER sinon. Pour toute autre intention, dialogueAct doit être null.",
      "Ne transforme pas 'je parle à la serveuse' en question: c'est INITIATE_CONVERSATION tant qu'aucun contenu de parole n'est donné.",
      "semanticIntent.playerGoal porte le sens principal de la saisie joueur; ne le reduis pas a une action canonique.",
      "Chaque intention doit remplir runtimeHandling: status, reason, requiredDomain, canonicalActionHint, noCommit et noGameTime.",
      "runtimeHandling indique si le runtime courant peut traiter l'intention; il ne donne aucune autorite de commit, succes, temps ou secret.",
      "Le champ action et runtimeHandling.canonicalActionHint sont seulement des aides d'exploitation: ask_possibility, ask, open, force, observe, act ou null.",
      "Une question de possibilite comme 'Est-ce que je peux...' ou 'Puis-je...' doit rester intentType=possibility_query, commitment=hypothetical, expectedTimeEffect=NO_GAME_TIME.",
      "Une demande polie d'interaction comme 'j'aimerais parler a un garde' est une intention de parole engagee: intentType=speech, commitment=committed, expectedTimeEffect=DOMAIN_TO_DECIDE.",
      "Une parole claire adressee a un PNJ doit etre intentType=speech, commitment=committed, expectedTimeEffect=DOMAIN_TO_DECIDE, sans inventer la reponse du PNJ.",
      "Une phrase composee avec micro-deplacement social, par exemple 'je m'approche du garde et je lui demande...', doit rester speech ou mixed avec expectedTimeEffect=DOMAIN_TO_DECIDE; ne la reduis pas a action.",
      "Une approche seule comme 'je m'approche du garde' ou 'je me dirige vers le garde' n'est pas une parole: intentType=action, semanticIntent.kind=nonverbal_signal, action=act, sans reaction PNJ automatique.",
      "Une action explicite doit etre intentType=action, commitment=committed, expectedTimeEffect=DOMAIN_TO_DECIDE.",
      "Une action implicite contextuelle comme 'je mets la main sur la poignee et pivote le mecanisme' devant une porte visible peut etre comprise comme semanticIntent.kind=manipulate_visible_object et canonicalActionHint=open sans exiger le mot ouvrir.",
      "Un déplacement engagé vers un type de lieu ou une destination proche explicitement décrite, par exemple 'je me dirige vers une rue calme non loin', est traverse_visible_boundary avec scope=SCENE_TRANSITION, domainHint=world et targetMention.candidateKind=place. La destination peut ne pas encore avoir de proposedRef: conserve alors sa description dans targetMention.surface sans transformer l'intention en move_near_visible_actor ni demander une clarification artificielle.",
      "Pour une manipulation locale bornée qui ne doit ni franchir un passage ni changer de scène, ajoute exactement scene_transition dans semanticIntent.forbiddenInterpretations. Ne l'ajoute pas si le but réel du joueur est précisément d'entrer, sortir, voyager ou changer de scène.",
      "Si le joueur designe un PNJ visible par description publique unique, par exemple 'la femme' pour la serveuse ou 'l'homme blesse' pour le garde, resous vers ce PNJ visible au lieu du PNJ par defaut.",
      "Si task.localReferentHints contient un referent recent unique compatible avec une ellipse ou un pronom local ('le', 'la', 'lui', \"l'\"), renseigne target et referentResolution avec source=recent_visible_focus; sinon laisse le referent ambigu et demande clarification.",
      "task.recentSemanticTurns contient au plus cinq intentions recemment acceptees. Utilise leur objectif, sujet et cible avec la scene publique pour comprendre la continuite du discours, sans leur donner autorite sur le tour courant.",
      "Un referent secondaire evoque dans un tour recent peut devenir la cible probable du tour courant si le sens conversationnel le justifie et si sa reference existe dans roleContextPack.referentRegistry. Propose alors cette reference structuree; le logiciel verifiera sa visibilite et sa compatibilite.",
      "referentResolution decrit uniquement ton choix de referent: il ne valide pas la reussite, ne deplace pas le personnage et ne revele aucun contenu cache.",
      "Une question meta ou interface doit etre intentType=meta_question, commitment=none, expectedTimeEffect=NO_GAME_TIME.",
      "Une question sur l'etat percu de la scene, l'environnement, la meteo, le lieu ou ce que le personnage peut savoir sans agir est une question de contexte: intentType=meta_question, commitment=none, expectedTimeEffect=NO_GAME_TIME.",
      "Une demande polie adressee au MJ comme 'peux-tu me decrire l'auberge ?' est une question de contexte, pas une possibilite d'action.",
      "Une demande de description visuelle d'un acteur à la troisième personne, par exemple 'peux-tu décrire ses habits ou ses traits distinctifs ?', vise l'observation de cet acteur: utilise observe_environment avec une perception adaptée. Ne la transforme pas en question que le personnage poserait au PNJ, sauf si le joueur formule explicitement une adresse directe comme 'je lui demande de décrire...'.",
      "Une ellipse objet sans verbe clair, par exemple 'la bourse du garde ?' ou 'et la porte du fond ?', doit etre unclear_commitment avec requiresClarification=true, pas possibility_query.",
      "Une formulation elliptique ou ambigue doit etre intentType=unclear_commitment, commitment=unclear, requiresClarification=true.",
      "Interdit: transformer une possibilite en action executee, accorder un succes social, reveler un secret, creer un objet ou PNJ durable, ou declencher un handoff definitif."
    ].join("\n");
  }

  if (request.role === "coherence_critic") {
    if (request.input?.task?.dialogueAct) {
      return [
        "Tu es un contrôleur sémantique non autoritaire de réplique PNJ.",
        "Compare candidateNarration à dialogueAct, actorId, rawInput, priorNpcUtterances et dialogueHistory. Tu ne réécris pas la réplique et tu ne produis aucun fait de fiction.",
        "INITIATE_CONVERSATION autorise une salutation, une prise de contact ou une invitation prudente à parler; rejette toute prétendue question préalable ou réponse informative non demandée.",
        "ASK_QUESTION doit répondre au contentGoal, avouer une ignorance ou esquiver explicitement ce sujet; rejette une réponse provenant d'un autre sujet.",
        "MAKE_STATEMENT doit accuser réception du contentGoal sans le transformer en question posée par le joueur.",
        "REQUEST_ACTION peut accepter, refuser ou hésiter sur l'action demandée sans annoncer son succès.",
        "OTHER doit rester prudent et ne pas inventer un acte de dialogue plus précis.",
        "dialogueHistory associe chaque ancienne intention joueur aux répliques PNJ qu'elle a produites. Si l'intention courante est sémantiquement équivalente à une intention antérieure, une réponse cohérente et similaire est légitime même sans mot explicite comme répéter; rejette seulement les contradictions ou les répétitions mécaniques sans rapport avec la demande courante.",
        "Rejette les rappels spatiaux ou nominaux mécaniques déjà évidents, par exemple répéter 'près du garde' à chaque phrase alors que l'interlocuteur et l'action sont établis.",
        "REJECT avec un finding BLOCKING de catégorie PLOT_COHERENCE si la réplique répond à un autre acte, invente une question, ou contredit le contentGoal.",
        "PASS exige findings=[] et correctionConstraints=[].",
        ...shared
      ].join("\n");
    }
    return [
      "Tu es un contrôleur sémantique non autoritaire de rendu narratif.",
      "Compare uniquement candidateNarration à renderAuthority. Tu ne réécris pas la narration et tu ne produis aucun fait de fiction.",
      "renderAuthority.allowedClaims est la liste positive des affirmations disponibles. Une affirmation concrète absente de cette liste n'est permise que si texturePolicy l'autorise réellement comme texture éphémère.",
      "Une texture TURN_ONLY peut reformuler une sensation déjà sourcée ou accentuer une tension confirmée; elle ne peut jamais ajouter propriété matérielle, état mécanique, causalité passée, source sensorielle, éclairage pertinent pour les règles, présence, action ou réaction.",
      "Vérifie la perspective imposée. SECOND_PERSON_PLAYER interdit de remplacer le point de vue joueur par 'le personnage' à la troisième personne.",
      "REJECT avec au moins un finding BLOCKING si la prose affirme un résultat, une mutation, une révélation, une pensée privée ou une réaction absente des confirmedClaims.",
      "Pour PLAYER_EXPRESSION_FIDELITY, préserve exactement le but, la cible, l'intensité et le degré d'engagement du joueur. Rejette toute étape d'action, méthode, condition préalable, connaissance, émotion, promesse, réussite ou conséquence ajoutée par la reformulation.",
      "Pour ACTION_STAGING_ONLY, le geste engagé est autorisé mais son succès, l'état résultant de la cible, ce qui devient visible et les réactions de PNJ sont interdits.",
      "Pour OBSERVATION_RESULT, les signes visibles publics sont autorisés; les motivations, pensées et certitudes mentales non confirmées sont interdites.",
      "PASS exige findings=[] et correctionConstraints=[].",
      ...shared
    ].join("\n");
  }

  if (request.role === "mj_planner") {
    return [
      "Tu es le mini planificateur MJ structurel d'un jeu de role solo.",
      "Tu ne joues pas la scene, tu n'ecris aucun texte visible au joueur et tu ne décides jamais le succes, l'echec, le temps, l'inventaire, le combat, les secrets ou les faits durables.",
      "Tu retournes uniquement l'objet JSON strict demande par le schema. Aucun Markdown. Aucun commentaire hors JSON.",
      "Recopie exactement schemaVersion, contractVersion, callId, attemptId, packId, snapshotId et role depuis l'entree utilisateur.",
      "Utilise diagnostics=[] si tout va bien, supersedesOutputId=null et status=OK pour une sortie utilisable.",
      "Role mj_planner: produire un plan narratif non committable a partir de task.interpretation, de son semanticIntent et de son runtimeHandling.",
      "Ne pars pas de mots-cles bruts pour decider l'intention: respecte semanticIntent.playerGoal, coreMeaning, target, referentResolution, commitment et runtimeHandling.",
      "planningBasis doit recopier intentId, le but semantique, runtimeStatus et requiredDomain de l'interpretation fournie.",
      "sceneBeats propose seulement l'etape suivante: LOCAL_ACTION_ATTEMPT, ACTOR_REACTION_EXPECTED, DOMAIN_BLOCKED ou CLARIFICATION selon le runtime et l'intention.",
      "commandProposals peut proposer un domaine ou une commande technique, mais commitAuthority doit toujours etre false.",
      "creationProposals doit rester []. revealPlan.reveal doit rester []. timeAdvanceProposal doit rester null.",
      "forbiddenOutcomes doit inclure commit_direct, narrate_unvalidated_success, advance_time_without_domain, reveal_secret et create_persistent_fact.",
      "Si runtimeHandling.status=UNSUPPORTED_DOMAIN, propose DOMAIN_BLOCKED et un handoff END_TURN sans inventer de resultat.",
      "Si une reaction PNJ est attendue, assigne au plus npc_performer comme proposition, sans produire sa replique.",
      "Si tu ne peux pas respecter ces limites, status=PARTIAL_UNUSABLE ou CANNOT_COMPLY avec diagnostic, sans plan de remplacement."
    ].join("\n");
  }

  if (request.role === "npc_performer") {
    return [
      "Tu es un interprete PNJ borne pour un jeu de role solo.",
      "Tu joues uniquement le PNJ visible assigne par task.actorId. Tu ne joues pas le MJ, le joueur, un autre PNJ ou un narrateur.",
      "Tu retournes uniquement l'objet JSON strict demande par le schema. Aucun Markdown. Aucun commentaire hors JSON.",
      "Recopie exactement schemaVersion, contractVersion, callId, attemptId, packId, snapshotId et role depuis l'entree utilisateur.",
      "Utilise diagnostics=[] si tout va bien, supersedesOutputId=null et status=OK pour une sortie utilisable.",
      "Role npc_performer: produire une reaction courte du PNJ assigne, a partir de task.interpretation, task.mjPlan, task.resolution et task.sceneState.",
      "Lis task.dialogueAct comme contrat du tour: INITIATE_CONVERSATION ouvre seulement le contact et ne doit inventer aucune question; ASK_QUESTION répond à contentGoal; MAKE_STATEMENT accuse réception sans la transformer en question; REQUEST_ACTION accepte, refuse ou hésite sans décider un succès; OTHER reste prudent.",
      "Avant d'écrire la prose, remplis reactionFrame: sourceDialogueAct recopie exactement task.dialogueAct.act, addressedContentGoal recopie exactement task.dialogueAct.contentGoal, et responseMode vaut respectivement ACKNOWLEDGE_CONTACT, ANSWER_QUESTION, ACKNOWLEDGE_STATEMENT, RESPOND_TO_REQUEST ou CAUTIOUS_RESPONSE.",
      "La réaction doit répondre au but sémantique du tour courant, ou exprimer clairement un refus, une ignorance ou une esquive portant sur ce but.",
      "Respecte task.knowledgeEnvelope.visibleSituation et roleContextPack.spatialContext comme contraintes spatiales strictes. N'utilise jamais une autre scène, un autre lieu ou une autre entrée que ceux fournis.",
      "Si visibleActor fournit demeanor, immediateGoal, currentPressure, speechStyle, conversationalHooks ou boundaries, incarne-les sans les réciter ni les présenter comme une fiche. Ils guident le ton, le rythme, les priorités et les limites du PNJ.",
      "Évite de répéter mot pour mot une formulation de priorNpcUtterances. Ne répète pas mécaniquement le nom ou la position d'un acteur déjà établi, par exemple 'près du garde', sauf si cette précision change réellement le sens.",
      "N'affirme jamais que le PNJ a déjà dit, promis, interdit, couvert ou expliqué quelque chose sauf si la réplique exacte apparaît dans task.knowledgeEnvelope.priorNpcUtterances.",
      "knowledgeUsed et chaque speechActs[].sourceRefs doivent contenir uniquement des valeurs recopiées exactement depuis task.knowledgeEnvelope.allowedSourceRefs. N'invente aucun préfixe task.*, aucun suffixe et aucune nouvelle référence.",
      "Si priorNpcUtterances est vide, n'écris jamais 'je vous l'ai déjà dit', 'ma réponse ne change pas', 'encore une fois' ni aucun faux rappel équivalent.",
      "N'utilise que les faits publics et la mémoire fournis; une réponse générique provenant d'un autre sujet de conversation est inutilisable.",
      "Ne decide jamais un succes social, un echec social, une consequence durable, un changement d'etat, un combat, un gain, une perte, une avance de temps ou une revelation de secret.",
      "durableCommitments doit rester []. revealedRefs doit rester [].",
      "safetyConstraints doit etre integralement true: noMechanicalSuccess, noSecretReveal, noDurableCommitment, noStateMutation.",
      "speechActs.type est limite a assertion, question ou refusal. N'utilise jamais promise, threat, order, reveal ou intentional_lie.",
      "epistemicBasis est limite a known, believed ou uncertain. N'utilise pas fabricated_for_lie.",
      "La replique doit etre concise, ancree dans les faits visibles et la memoire courte fournie, sans exposer de fait cache.",
      "Si task.interpretation n'est pas une parole engagee ou si l'acteur assigne n'est pas clair, status=PARTIAL_UNUSABLE ou CANNOT_COMPLY avec diagnostic."
    ].join("\n");
  }

  return [
    ...shared,
    "Role scene_writer: ajoute seulement une narration MJ atmospherique ancree dans les resolutions deja confirmees.",
    "Pour une arrivée après transition, raconte la scène destination fournie dans le bloc SCENE. N'importe jamais une présence, un décor ou une tension de la scène précédente.",
    "ambientPopulation décrit une foule visible, pas une liste de PNJ individualisés. Mets-la en mouvement en une ou deux phrases, regroupe les rôles et ne récite jamais 'Présences visibles' suivi d'un inventaire.",
    "Quand une présence fournit designation, emploie firstMention à sa première apparition puis subsequentMention. N'utilise jamais son publicRole ou son ancien displayName comme s'il s'agissait d'un nom propre.",
    "Pour une observation générale de la population, réponds par un paragraphe narratif continu: choisis deux ou trois figures représentatives, relie leurs activités visibles et termine par l'impression d'ensemble. Ne produis ni trois phrases clonées, ni une fiche par personne, ni une liste séparée par répétition de 'À proximité'.",
    "La narration doit apporter une mise en scène sensible et lisible, pas seulement recopier les champs du contexte. Fusionne activité, apparence et tension dans des phrases naturelles sans afficher leurs clés.",
    "presentNpc contient seulement les figures déjà individualisées; tu peux les distinguer de la foule sans leur inventer de biographie, d'action nouvelle ou de connaissance.",
    "task.renderAuthority.allowedClaims est la liste positive des affirmations que tu peux formuler. Ne complète pas un objet ou un acteur par des propriétés plausibles mais absentes.",
    "Si texturePolicy.allowed=true, la texture reste TURN_ONLY: elle peut seulement reformuler une sensation déjà sourcée, accentuer une tension confirmée ou relier stylistiquement des faits autorisés.",
    "Interdit même comme texture: matériau ou usure non fournis, état interne ou mécanique, fonctionnement, causalité passée, nouvelle source sonore ou lumineuse, présence, action ou réaction non autorisée, détail utilisable comme indice ou règle.",
    "Respecte renderAuthority.perspective; SECOND_PERSON_PLAYER s'adresse au joueur avec 'tu' et ne raconte pas 'le personnage' à la troisième personne.",
    "Le rendu doit etre concret: lieu, perception, tension locale, PNJ visibles. Evite les phrases generiques comme 'tout reste possible' si un detail de scene est disponible.",
    "Pour une parole ou une action engagee, montre la mise en scene immediate sans decider le succes, l'echec, la reaction decisive ou une consequence durable.",
    "Pour une question de contexte no-commit, reponds directement avec les perceptions et faits visibles deja fournis dans un bloc blockKind=MJ_NARRATION; n'ajoute aucune action du personnage et ne fais pas avancer le temps.",
    "Pour une clarification ou une possibilite, rends la limite claire: aucune action n'est executee et le temps de jeu ne progresse pas.",
    "Ne decris aucun evenement nouveau non fourni: pas de porte d'entree qui s'ouvre, pas d'arrivee, pas de sortie, pas de nouveau client, pas de silhouette cachee ou d'occupant dissimule.",
    "Pour decrire les gens presents, limite-toi aux PNJ visibles fournis dans le contexte. Si aucun autre occupant visible n'est fourni, ne les invente pas.",
    "Chaque bloc doit citer dans groundedIn au moins une reference exacte fournie dans task.allowedGrounding. Tu peux citer plusieurs references, mais au moins une doit etre recopiee exactement.",
    "groundedIn certifie ce que le texte couvre effectivement; ne cite jamais une reference uniquement parce qu'elle figurait dans le contexte.",
    "Si task.requiredNarrativeGroundingAnyOf n'est pas vide, le rendu doit couvrir et citer au moins une de ces references. Une description du lieu seule ne repond pas a une demande portant sur les presences visibles.",
    "Si task.requiredNarrativeMentionAnyOf n'est pas vide, emploie dans le texte au moins une de ces désignations fournies; cette mention prouve que la présence demandée est effectivement décrite.",
    "Pour chaque bloc, remplis factDiscipline comme un audit factuel: addedUnsupportedFacts liste les faits/personnes/evenements qui ne sont pas explicitement fournis; noNewEvents=false si un evenement nouveau est decrit; noHiddenPresence=false si une presence cachee/dissimulee/non fournie est suggeree; usesOnlyProvidedVisibleEntities=false si une personne ou un groupe visible non fourni est mentionne.",
    "Si tu as besoin d'ajouter un fait non fourni pour rendre la phrase naturelle, signale-le dans factDiscipline.addedUnsupportedFacts au lieu de le masquer.",
    `References groundedIn autorisees pour cette requete: ${allowedGroundingInstruction(request)}.`,
    "N'annonce pas de nouveau resultat de test, de degat, de reaction PNJ decisive, de combat, de recompense ou de secret.",
    "La texture creative est autorisee seulement pour decrire le ton, le rythme, les sensations et la mise en scene."
  ].join("\n");
}

function allowedGroundingInstruction(request) {
  const refs = Array.isArray(request?.input?.task?.allowedGrounding)
    ? request.input.task.allowedGrounding.filter(ref => typeof ref === "string" && ref.trim().length > 0)
    : [];
  return refs.length > 0 ? refs.join(" | ") : "aucune reference specifique; utilise les refs fournies dans la tache";
}

function extractOutputText(data) {
  if (data && typeof data === "object" && typeof data.output_text === "string") return data.output_text;
  const output = data && typeof data === "object" ? data.output : null;
  if (!Array.isArray(output)) return null;
  for (const entry of output) {
    const content = entry && typeof entry === "object" ? entry.content : null;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (item && typeof item === "object" && typeof item.text === "string") return item.text;
    }
  }
  return null;
}

function parseOpenAiOutputJson(outputText) {
  try {
    return JSON.parse(outputText);
  } catch {
    const extracted = extractJsonObjectText(outputText);
    if (!extracted) throw new Error("No JSON object found.");
    return JSON.parse(extracted);
  }
}

function extractJsonObjectText(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*(?<body>[\s\S]*?)\s*```$/iu);
  if (fenced?.groups?.body) return fenced.groups.body.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function previewProviderText(text) {
  return String(text ?? "")
    .replace(/\s+/gu, " ")
    .slice(0, 240);
}

function validateEnvelope(output, request) {
  const issues = [];
  if (!output || typeof output !== "object" || Array.isArray(output)) return { ok: false, issues: ["output must be an object."] };
  for (const key of [
    "schemaVersion",
    "contractVersion",
    "outputId",
    "callId",
    "attemptId",
    "packId",
    "snapshotId",
    "role",
    "status",
    "payload",
    "diagnostics",
    "supersedesOutputId"
  ]) {
    if (!(key in output)) issues.push(`${key} is required.`);
  }
  if (output.schemaVersion !== 1) issues.push("schemaVersion mismatch.");
  if (output.contractVersion !== request.contractVersion) issues.push("contractVersion mismatch.");
  if (output.callId !== request.callId) issues.push("callId mismatch.");
  if (output.attemptId !== request.attemptId) issues.push("attemptId mismatch.");
  if (output.packId !== request.packId) issues.push("packId mismatch.");
  if (output.snapshotId !== request.snapshotId) issues.push("snapshotId mismatch.");
  if (output.role !== request.role) issues.push("role mismatch.");
  if (output.status !== "OK") issues.push("status must be OK for a usable output.");
  if (!Array.isArray(output.diagnostics)) issues.push("diagnostics must be an array.");
  if (!output.payload || typeof output.payload !== "object" || Array.isArray(output.payload)) {
    issues.push("payload must be an object.");
  } else {
    issues.push(...validateRolePayload(output.payload, request.role, request));
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true };
}

function validateRolePayload(payload, role, request = null) {
  const issues = [];
  if (role === "scene_creator") {
    return validateSceneCreatorPayload(payload, request);
  }
  if (role === "player_intent_interpreter") {
    if (request?.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V5) return validateSemanticIntentPayloadV5(payload);
    if (request?.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V4) return validateSemanticIntentPayloadV4(payload);
    if (request?.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V3) return validateSemanticIntentPayloadV3(payload);
    if (request?.contractVersion === SEMANTIC_INTENT_CONTRACT_VERSION_V2) return validateSemanticIntentPayloadV2(payload);
    if (typeof payload.rawInputEcho !== "string") issues.push("payload.rawInputEcho must be a string.");
    const allowedIntentActions = new Set(["ask_possibility", "ask", "open", "force", "observe", "act"]);
    const allowedSemanticKinds = new Set(["address_visible_actor", "move_near_visible_actor", "manipulate_visible_object", "traverse_visible_boundary", "observe_environment", "nonverbal_signal", "hypothetical_action", "context_question", "meta_request", "unclear_intent"]);
    const allowedRuntimeStatuses = new Set(["SUPPORTED_BY_CURRENT_RUNTIME", "UNSUPPORTED_DOMAIN", "NEEDS_CLARIFICATION", "AI_INTERPRETATION_FAILED"]);
    const allowedRuntimeDomains = new Set(["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world"]);
    if (!Array.isArray(payload.intents) || payload.intents.length === 0 || payload.intents.length > 3) {
      issues.push("payload.intents must contain 1 to 3 intents.");
      return issues;
    }
    for (let index = 0; index < payload.intents.length; index += 1) {
      const intent = payload.intents[index];
      if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
        issues.push(`payload.intents[${index}] must be an object.`);
        continue;
      }
      if (typeof intent.intentId !== "string" || intent.intentId.trim().length === 0) issues.push(`payload.intents[${index}].intentId must be a non-empty string.`);
      if (!Number.isInteger(intent.order) || intent.order < 1) issues.push(`payload.intents[${index}].order must be a positive integer.`);
      if (!["meta_question", "possibility_query", "memory_recall", "speech", "action", "mixed", "unclear_commitment"].includes(intent.intentType)) issues.push(`payload.intents[${index}].intentType is invalid.`);
      if (!["none", "hypothetical", "conditional", "committed", "unclear"].includes(intent.commitment)) issues.push(`payload.intents[${index}].commitment is invalid.`);
      if (intent.target !== null) {
        if (!intent.target || typeof intent.target !== "object" || Array.isArray(intent.target)) {
          issues.push(`payload.intents[${index}].target must be an object or null.`);
        } else {
          if (!["npc", "place", "object", "self", "unknown"].includes(intent.target.kind)) issues.push(`payload.intents[${index}].target.kind is invalid.`);
          if (!(typeof intent.target.ref === "string" || intent.target.ref === null)) issues.push(`payload.intents[${index}].target.ref must be a string or null.`);
          if (!(typeof intent.target.label === "string" || intent.target.label === null)) issues.push(`payload.intents[${index}].target.label must be a string or null.`);
        }
      }
      for (const key of ["topic", "clarificationQuestion"]) {
        if (!(typeof intent[key] === "string" || intent[key] === null)) issues.push(`payload.intents[${index}].${key} must be a string or null.`);
      }
      if (!(intent.action === null || allowedIntentActions.has(intent.action))) {
        issues.push(`payload.intents[${index}].action must be a canonical action or null.`);
      }
      issues.push(...validateIntentSemanticIntent(intent.semanticIntent, intent, index, allowedSemanticKinds));
      issues.push(...validateIntentRuntimeHandling(intent.runtimeHandling, intent, index, allowedIntentActions, allowedRuntimeStatuses, allowedRuntimeDomains));
      issues.push(...validateIntentReferentResolution(intent.referentResolution, index));
      if (typeof intent.coreMeaning !== "string" || intent.coreMeaning.trim().length === 0) issues.push(`payload.intents[${index}].coreMeaning must be a non-empty string.`);
      for (const key of ["playerImposedDetails", "openDetails", "forbiddenInterpretations", "riskFlags"]) {
        if (!Array.isArray(intent[key]) || intent[key].some(item => typeof item !== "string")) issues.push(`payload.intents[${index}].${key} must be a string array.`);
      }
      if (typeof intent.requiresClarification !== "boolean") issues.push(`payload.intents[${index}].requiresClarification must be a boolean.`);
      if (!["NO_GAME_TIME", "DOMAIN_TO_DECIDE"].includes(intent.expectedTimeEffect)) issues.push(`payload.intents[${index}].expectedTimeEffect is invalid.`);
      if (!["low", "medium", "high"].includes(intent.confidence)) issues.push(`payload.intents[${index}].confidence is invalid.`);
      if (intent.intentType === "possibility_query" && intent.commitment !== "hypothetical") issues.push(`payload.intents[${index}] possibility_query must stay hypothetical.`);
      if (intent.intentType === "meta_question" && intent.commitment !== "none") issues.push(`payload.intents[${index}] meta_question must have no commitment.`);
      if (intent.intentType === "speech" && intent.commitment !== "committed") issues.push(`payload.intents[${index}] speech must be committed.`);
      if (intent.intentType === "action" && intent.commitment !== "committed") issues.push(`payload.intents[${index}] action must be committed.`);
      if (intent.intentType === "speech") {
        if (!(intent.action === null || intent.action === "ask" || intent.action === "act")) issues.push(`payload.intents[${index}] speech action must be ask, act or null.`);
        if (intent.runtimeHandling?.noCommit !== false) issues.push(`payload.intents[${index}] speech must allow bounded speech commit.`);
      }
      if (intent.intentType === "action" && ["open", "force"].includes(intent.action)) {
        issues.push(...validateCommittedActionReferent(intent, index));
      }
      if (["speech", "mixed", "action"].includes(intent.intentType) && intent.commitment === "committed" && intent.expectedTimeEffect !== "DOMAIN_TO_DECIDE") {
        issues.push(`payload.intents[${index}] committed in-fiction intent must use DOMAIN_TO_DECIDE.`);
      }
      if (intent.requiresClarification === true && typeof intent.clarificationQuestion !== "string") issues.push(`payload.intents[${index}] clarification requires a question.`);
      if (Array.isArray(intent.riskFlags) && intent.riskFlags.some(flag => ["secret_reveal", "social_success_granted"].includes(flag))) {
        issues.push(`payload.intents[${index}] contains forbidden risk flag.`);
      }
    }
    return issues;
  }

  if (role === "mj_planner") {
    return validateMjPlannerPayload(payload, request);
  }

  if (role === "npc_performer") {
    return validateNpcPerformerPayload(payload, request);
  }

  if (role === "coherence_critic") {
    return validateCoherenceCriticPayload(payload);
  }

  if (role === "player_expression_adapter") {
    for (const key of ["intentId", "expressionKind", "renderedExpression"]) {
      if (typeof payload[key] !== "string" || payload[key].trim().length === 0) issues.push(`payload.${key} must be a non-empty string.`);
    }
    if (!["speech", "gesture", "action_staging"].includes(payload.expressionKind)) issues.push("payload.expressionKind is invalid.");
    for (const key of ["meaningCovered", "addedMeaning", "omittedMeaning", "styleChoices"]) {
      if (!Array.isArray(payload[key]) || payload[key].some(item => typeof item !== "string")) issues.push(`payload.${key} must be a string array.`);
    }
    if (payload.safeToUse !== true) issues.push("payload.safeToUse must be true.");
    if (Array.isArray(payload.addedMeaning) && payload.addedMeaning.length > 0) issues.push("payload.addedMeaning must be empty.");
    return issues;
  }

  if (!Array.isArray(payload.narrationBlocks)) {
    issues.push("payload.narrationBlocks must be an array.");
    return issues;
  }
  for (let index = 0; index < payload.narrationBlocks.length; index += 1) {
    const block = payload.narrationBlocks[index];
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      issues.push(`payload.narrationBlocks[${index}] must be an object.`);
      continue;
    }
    if (typeof block.slotId !== "string" || block.slotId.trim().length === 0) issues.push(`payload.narrationBlocks[${index}].slotId must be a non-empty string.`);
    if (block.blockKind !== "MJ_NARRATION") issues.push(`payload.narrationBlocks[${index}].blockKind must be MJ_NARRATION.`);
    if (typeof block.content !== "string" || block.content.trim().length === 0) issues.push(`payload.narrationBlocks[${index}].content must be a non-empty string.`);
    if (!Array.isArray(block.groundedIn) || block.groundedIn.length === 0 || block.groundedIn.some(item => typeof item !== "string")) {
      issues.push(`payload.narrationBlocks[${index}].groundedIn must be a non-empty string array.`);
    }
    if (typeof block.usesCreativeTexture !== "boolean") issues.push(`payload.narrationBlocks[${index}].usesCreativeTexture must be a boolean.`);
    if (!block.factDiscipline || typeof block.factDiscipline !== "object" || Array.isArray(block.factDiscipline)) {
      issues.push(`payload.narrationBlocks[${index}].factDiscipline must be an object.`);
    } else {
      if (!Array.isArray(block.factDiscipline.addedUnsupportedFacts) || block.factDiscipline.addedUnsupportedFacts.some(item => typeof item !== "string")) {
        issues.push(`payload.narrationBlocks[${index}].factDiscipline.addedUnsupportedFacts must be a string array.`);
      }
      if (typeof block.factDiscipline.usesOnlyProvidedVisibleEntities !== "boolean") {
        issues.push(`payload.narrationBlocks[${index}].factDiscipline.usesOnlyProvidedVisibleEntities must be a boolean.`);
      }
      if (typeof block.factDiscipline.noNewEvents !== "boolean") {
        issues.push(`payload.narrationBlocks[${index}].factDiscipline.noNewEvents must be a boolean.`);
      }
      if (typeof block.factDiscipline.noHiddenPresence !== "boolean") {
        issues.push(`payload.narrationBlocks[${index}].factDiscipline.noHiddenPresence must be a boolean.`);
      }
      if (!Array.isArray(block.factDiscipline.notes) || block.factDiscipline.notes.some(item => typeof item !== "string")) {
        issues.push(`payload.narrationBlocks[${index}].factDiscipline.notes must be a string array.`);
      }
    }
  }
  return issues;
}

function validateSemanticIntentPayloadV2(payload) {
  const issues = [];
  if (typeof payload.rawInputEcho !== "string") issues.push("payload.rawInputEcho must be a string.");
  const intent = payload.intent;
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return [...issues, "payload.intent must be an object."];
  const kinds = ["address_visible_actor", "move_near_visible_actor", "manipulate_visible_object", "traverse_visible_boundary", "observe_environment", "nonverbal_signal", "hypothetical_action", "context_question", "meta_request", "unclear_intent"];
  const commitments = ["none", "hypothetical", "conditional", "committed", "unclear"];
  const domains = ["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world"];
  if (!kinds.includes(intent.kind)) issues.push("payload.intent.kind is invalid.");
  if (!commitments.includes(intent.commitment)) issues.push("payload.intent.commitment is invalid.");
  if (!Array.isArray(intent.preconditions) || intent.preconditions.length > 4 || intent.preconditions.some(item => typeof item !== "string" || item.trim().length === 0)) issues.push("payload.intent.preconditions must contain at most four non-empty strings.");
  if (typeof intent.playerGoal !== "string" || intent.playerGoal.trim().length === 0) issues.push("payload.intent.playerGoal must be a non-empty string.");
  if (!(intent.actionHint === null || typeof intent.actionHint === "string")) issues.push("payload.intent.actionHint must be a string or null.");
  if (!(intent.domainHint === null || domains.includes(intent.domainHint))) issues.push("payload.intent.domainHint is invalid.");
  if (!["LOCAL_INTERACTION", "SCENE_TRANSITION", "SOCIAL_EXCHANGE", "PERCEPTION", "META", "UNKNOWN"].includes(intent.scope)) issues.push("payload.intent.scope is invalid.");
  if (!Array.isArray(intent.uncertainties) || intent.uncertainties.length > 4 || intent.uncertainties.some(item => typeof item !== "string")) issues.push("payload.intent.uncertainties must contain at most four strings.");
  if (!(intent.clarificationPrompt === null || typeof intent.clarificationPrompt === "string")) issues.push("payload.intent.clarificationPrompt must be a string or null.");
  if (!["low", "medium", "high"].includes(intent.confidence)) issues.push("payload.intent.confidence is invalid.");
  if (intent.kind === "hypothetical_action" && intent.commitment !== "hypothetical") issues.push("payload.intent hypothetical_action must use hypothetical commitment.");
  if (intent.commitment === "hypothetical" && intent.kind !== "hypothetical_action") issues.push("payload.intent hypothetical commitment must use hypothetical_action.");
  if (intent.targetMention !== null) {
    const mention = intent.targetMention;
    if (!mention || typeof mention !== "object" || Array.isArray(mention)) issues.push("payload.intent.targetMention must be an object or null.");
    else {
      if (typeof mention.surface !== "string" || mention.surface.trim().length === 0) issues.push("payload.intent.targetMention.surface must be non-empty.");
      if (!["npc", "place", "object", "self", "unknown"].includes(mention.candidateKind)) issues.push("payload.intent.targetMention.candidateKind is invalid.");
      if (!(mention.proposedRef === null || typeof mention.proposedRef === "string")) issues.push("payload.intent.targetMention.proposedRef must be a string or null.");
      if (!["EXPLICIT", "RECENT_FOCUS", "SCENE_DESCRIPTION", "NONE"].includes(mention.contextLink)) issues.push("payload.intent.targetMention.contextLink is invalid.");
    }
  }
  if (intent.kind === "observe_environment" && (!intent.perception || typeof intent.perception !== "object")) issues.push("payload.intent.perception is required for observation.");
  if (intent.kind !== "observe_environment" && intent.perception !== null) issues.push("payload.intent.perception must be null outside observation.");
  if (intent.kind === "address_visible_actor" && (!intent.dialogueAct || typeof intent.dialogueAct !== "object")) issues.push("payload.intent.dialogueAct is required for speech.");
  if (intent.kind !== "address_visible_actor" && intent.dialogueAct !== null) issues.push("payload.intent.dialogueAct must be null outside speech.");
  if ((intent.kind === "unclear_intent" || intent.commitment === "unclear") && (typeof intent.clarificationPrompt !== "string" || intent.clarificationPrompt.trim().length === 0)) issues.push("payload.intent.clarificationPrompt is required for an unclear intention.");
  return issues;
}

function validateSemanticIntentPayloadV3(
  payload,
  oriented = false,
  maxComponentOrder = oriented ? 3 : 2,
  withSpatialFollowUp = false
) {
  const issues = validateSemanticIntentPayloadV2(payload);
  const composition = payload?.intent?.composition;
  if (!composition || typeof composition !== "object" || Array.isArray(composition)) {
    return [...issues, "payload.intent.composition must be an object."];
  }
  const spatial = composition.spatialLeadIn;
  const communication = composition.communication;
  if (spatial !== null) {
    if (!spatial || typeof spatial !== "object" || Array.isArray(spatial)) issues.push("payload.intent.composition.spatialLeadIn must be an object or null.");
    else {
      if (spatial.kind !== "APPROACH_TARGET") issues.push("payload.intent.composition.spatialLeadIn.kind is invalid.");
      if (typeof spatial.playerGoal !== "string" || spatial.playerGoal.trim().length === 0) issues.push("payload.intent.composition.spatialLeadIn.playerGoal must be non-empty.");
      if (!Number.isInteger(spatial.order) || spatial.order < 1 || spatial.order > maxComponentOrder) issues.push("payload.intent.composition.spatialLeadIn.order is invalid.");
    }
  }
  if (communication !== null) {
    if (!communication || typeof communication !== "object" || Array.isArray(communication)) issues.push("payload.intent.composition.communication must be an object or null.");
    else {
      if (!["SPEECH", "NONVERBAL"].includes(communication.mode)) issues.push("payload.intent.composition.communication.mode is invalid.");
      if (typeof communication.contentGoal !== "string" || communication.contentGoal.trim().length === 0) issues.push("payload.intent.composition.communication.contentGoal must be non-empty.");
      if (!Number.isInteger(communication.order) || communication.order < 1 || communication.order > maxComponentOrder) issues.push("payload.intent.composition.communication.order is invalid.");
      if (communication.mode === "SPEECH" && !["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER"].includes(communication.act)) issues.push("payload.intent.composition.communication.act is required for speech.");
      if (communication.mode === "NONVERBAL" && communication.act !== null) issues.push("payload.intent.composition.communication.act must be null for nonverbal communication.");
    }
  }
  if (spatial !== null && communication !== null && spatial.order === communication.order) {
    issues.push("payload.intent.composition component orders must be distinct.");
  }
  return issues;
}

function validateSemanticIntentPayloadV4(payload, extended = false) {
  const issues = validateSemanticIntentPayloadV3(payload, true, extended ? 4 : 3, extended);
  const intent = payload?.intent;
  const orientation = intent?.composition?.orientation;
  if (orientation !== null) {
    if (!orientation || typeof orientation !== "object" || Array.isArray(orientation)) issues.push("payload.intent.composition.orientation must be an object or null.");
    else {
      if (orientation.kind !== "LOCATE_VISIBLE_TARGET") issues.push("payload.intent.composition.orientation.kind is invalid.");
      if (typeof orientation.playerGoal !== "string" || orientation.playerGoal.trim().length === 0) issues.push("payload.intent.composition.orientation.playerGoal must be non-empty.");
      if (!Number.isInteger(orientation.order) || orientation.order < 1 || orientation.order > (extended ? 4 : 3)) issues.push("payload.intent.composition.orientation.order is invalid.");
    }
  }
  if (intent?.kind === "observe_environment") {
    if (!["PRESENCE", "VISIBLE_TRAIT", "UNCERTAIN_CLUE"].includes(intent.perception?.informationKind)) {
      issues.push("payload.intent.perception.informationKind is required for V4 observation.");
    }
  } else if (intent?.perception !== null) {
    issues.push("payload.intent.perception must be null outside observation.");
  }
  const orders = [
    orientation?.order,
    intent?.composition?.spatialLeadIn?.order,
    intent?.composition?.communication?.order
  ].filter(Number.isInteger);
  if (new Set(orders).size !== orders.length) issues.push("payload.intent.composition component orders must be distinct.");
  return issues;
}

function validateSemanticIntentPayloadV5(payload) {
  const issues = validateSemanticIntentPayloadV4(payload, true);
  const composition = payload?.intent?.composition;
  const followUp = composition?.spatialFollowUp;
  if (followUp !== null) {
    if (!followUp || typeof followUp !== "object" || Array.isArray(followUp)) issues.push("payload.intent.composition.spatialFollowUp must be an object or null.");
    else {
      if (followUp.kind !== "REPOSITION_AWAY") issues.push("payload.intent.composition.spatialFollowUp.kind is invalid.");
      if (typeof followUp.playerGoal !== "string" || followUp.playerGoal.trim().length === 0) issues.push("payload.intent.composition.spatialFollowUp.playerGoal must be non-empty.");
      if (![1, 2, 3, 4].includes(followUp.order)) issues.push("payload.intent.composition.spatialFollowUp.order is invalid.");
    }
  }
  if (followUp !== null && composition?.communication === null) {
    issues.push("payload.intent.composition.spatialFollowUp requires communication in V5.");
  }
  const orders = [
    composition?.orientation?.order,
    composition?.spatialLeadIn?.order,
    composition?.communication?.order,
    followUp?.order
  ].filter(Number.isInteger);
  if (new Set(orders).size !== orders.length) issues.push("payload.intent.composition component orders must be distinct.");
  return issues;
}

function validateSceneCreatorPayload(payload, request) {
  const issues = [];
  const v2 = request?.contractVersion === SCENE_CREATOR_CONTRACT_VERSION_V2;
  const requiredStrings = [
    "proposalId", "displayName", "summary", "initialTension", "proposedPlaceRef",
    "arrivalSceneId", "parentLocationRef", "reason"
  ];
  for (const key of requiredStrings) {
    if (typeof payload[key] !== "string" || payload[key].trim().length === 0) {
      issues.push(`payload.${key} must be a non-empty string.`);
    }
  }
  if (!["SCENE_EPHEMERAL", "LIGHT_REFERENCE", "FULL_ENTITY"].includes(payload.requestedDepth)) {
    issues.push("payload.requestedDepth is invalid.");
  }
  for (const key of ["perceptibleFeatures", "populationRoles", "localNorms", "expectedEffects", "narrativeCommitments"]) {
    if (!Array.isArray(payload[key]) || payload[key].some(item => typeof item !== "string")) {
      issues.push(`payload.${key} must be a string array.`);
    }
  }
  if (!["REUSE", "ENRICH", "CREATE_DISTINCT", "POSSIBLE_SAME_AS", "REJECT_IF_SIMILAR"].includes(payload.duplicatePolicy)) {
    issues.push("payload.duplicatePolicy is invalid.");
  }
  const allowedParentLocationRefs = Array.isArray(request?.input?.roleContextPack?.allowedParentLocationRefs)
    ? request.input.roleContextPack.allowedParentLocationRefs
    : [];
  if (allowedParentLocationRefs.length > 0 && !allowedParentLocationRefs.includes(payload.parentLocationRef)) {
    issues.push("payload.parentLocationRef is not allowed by the scene creator context.");
  }
  if (v2 && Object.prototype.hasOwnProperty.call(payload, "connectionIntents")) {
    issues.push("payload.connectionIntents is forbidden by lore-guided-place-candidate/2.");
  } else if (!v2 && (!Array.isArray(payload.connectionIntents) || payload.connectionIntents.length === 0 || payload.connectionIntents.length > 4)) {
    issues.push("payload.connectionIntents must contain 1 to 4 connections.");
  } else if (!v2) {
    payload.connectionIntents.forEach((connection, index) => {
      const path = `payload.connectionIntents[${index}]`;
      if (!connection || typeof connection !== "object" || Array.isArray(connection)) {
        issues.push(`${path} must be an object.`);
        return;
      }
      for (const key of ["sourceSceneId", "boundaryRef", "destinationRef"]) {
        if (typeof connection[key] !== "string" || connection[key].trim().length === 0) {
          issues.push(`${path}.${key} must be a non-empty string.`);
        }
      }
      if (!["LOCAL", "TRAVEL"].includes(connection.scale)) issues.push(`${path}.scale is invalid.`);
      if (!Array.isArray(connection.sourceRefs) || connection.sourceRefs.length === 0 || connection.sourceRefs.some(item => typeof item !== "string" || item.trim().length === 0)) {
        issues.push(`${path}.sourceRefs must be a non-empty string array.`);
      }
    });
  }
  return issues;
}

function validateCommittedActionReferent(intent, index) {
  const issues = [];
  const referent = intent.referentResolution || null;
  const target = referent && referent.resolvedTarget !== null ? referent.resolvedTarget : intent.target;
  if (!referent || referent.ambiguity !== "none") {
    issues.push(`payload.intents[${index}] committed open/force action requires unambiguous referentResolution.`);
  }
  if (!target || typeof target !== "object" || target.ref === null) {
    issues.push(`payload.intents[${index}] committed open/force action requires a resolved visible target.`);
    return issues;
  }
  if (!["object", "place"].includes(target.kind)) {
    issues.push(`payload.intents[${index}] committed open/force action target must be object or place.`);
  }
  if (!["poi:back-room-door", "npc:npc-garde-blesse", "npc:npc-serveuse-nerveuse"].includes(target.ref)) {
    issues.push(`payload.intents[${index}] committed open/force action target is not visible in the current scene.`);
  }
  return issues;
}

function validateMjPlannerPayload(payload, request) {
  const issues = [];
  const allowedBeatKinds = new Set(["CONTEXT_RESPONSE", "LOCAL_ACTION_ATTEMPT", "ACTOR_REACTION_EXPECTED", "DOMAIN_BLOCKED", "CLARIFICATION"]);
  const allowedDomains = new Set(["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world"]);
  const allowedRuntimeStatuses = new Set(["SUPPORTED_BY_CURRENT_RUNTIME", "UNSUPPORTED_DOMAIN", "NEEDS_CLARIFICATION", "AI_INTERPRETATION_FAILED"]);
  const allowedActorRoles = new Set(["intent_interpreter", "player_intent_interpreter", "mj_planner", "player_expression_adapter", "npc_performer", "rules_adjudicator", "coherence_critic", "scene_writer", "scene_creator", "clarification_writer"]);
  const allowedHandoffs = new Set(["ASK_PLAYER", "CONTINUE_AUTOMATICALLY", "CLARIFY", "END_TURN"]);
  const sourceIntent = request?.input?.task?.interpretation || null;
  if (payload.schemaVersion !== 1) issues.push("payload.schemaVersion must be 1.");
  if (typeof payload.planId !== "string" || payload.planId.trim().length === 0) issues.push("payload.planId must be a non-empty string.");
  if (!payload.planningBasis || typeof payload.planningBasis !== "object" || Array.isArray(payload.planningBasis)) {
    issues.push("payload.planningBasis must be an object.");
  } else {
    if (typeof payload.planningBasis.intentId !== "string" || payload.planningBasis.intentId.trim().length === 0) issues.push("payload.planningBasis.intentId must be a non-empty string.");
    if (sourceIntent && typeof sourceIntent.intentId === "string" && payload.planningBasis.intentId !== sourceIntent.intentId) {
      issues.push("payload.planningBasis.intentId must match task.interpretation.intentId.");
    }
    if (typeof payload.planningBasis.semanticGoal !== "string" || payload.planningBasis.semanticGoal.trim().length === 0) issues.push("payload.planningBasis.semanticGoal must be a non-empty string.");
    if (!allowedRuntimeStatuses.has(payload.planningBasis.runtimeStatus)) issues.push("payload.planningBasis.runtimeStatus is invalid.");
    if (!(payload.planningBasis.requiredDomain === null || allowedDomains.has(payload.planningBasis.requiredDomain))) issues.push("payload.planningBasis.requiredDomain is invalid.");
    const runtimeHandling = sourceIntent?.runtimeHandling || null;
    if (runtimeHandling && payload.planningBasis.runtimeStatus !== runtimeHandling.status) {
      issues.push("payload.planningBasis.runtimeStatus must match task.interpretation.runtimeHandling.status.");
    }
    if (runtimeHandling && payload.planningBasis.requiredDomain !== runtimeHandling.requiredDomain) {
      issues.push("payload.planningBasis.requiredDomain must match task.interpretation.runtimeHandling.requiredDomain.");
    }
  }
  if (!Array.isArray(payload.sceneBeats) || payload.sceneBeats.length === 0) {
    issues.push("payload.sceneBeats must contain at least one beat.");
  } else {
    for (let index = 0; index < payload.sceneBeats.length; index += 1) {
      const beat = payload.sceneBeats[index];
      if (!beat || typeof beat !== "object" || Array.isArray(beat)) {
        issues.push(`payload.sceneBeats[${index}] must be an object.`);
        continue;
      }
      if (typeof beat.beatId !== "string" || beat.beatId.trim().length === 0) issues.push(`payload.sceneBeats[${index}].beatId must be a non-empty string.`);
      if (!allowedBeatKinds.has(beat.kind)) issues.push(`payload.sceneBeats[${index}].kind is invalid.`);
      if (!Array.isArray(beat.actorIds) || beat.actorIds.some(item => typeof item !== "string")) issues.push(`payload.sceneBeats[${index}].actorIds must be a string array.`);
      if (typeof beat.stopCondition !== "string" || beat.stopCondition.trim().length === 0) issues.push(`payload.sceneBeats[${index}].stopCondition must be a non-empty string.`);
    }
  }
  if (!Array.isArray(payload.commandProposals)) {
    issues.push("payload.commandProposals must be an array.");
  } else {
    for (let index = 0; index < payload.commandProposals.length; index += 1) {
      const proposal = payload.commandProposals[index];
      if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
        issues.push(`payload.commandProposals[${index}] must be an object.`);
        continue;
      }
      if (typeof proposal.proposalId !== "string" || proposal.proposalId.trim().length === 0) issues.push(`payload.commandProposals[${index}].proposalId must be a non-empty string.`);
      if (!allowedDomains.has(proposal.domain)) issues.push(`payload.commandProposals[${index}].domain is invalid.`);
      if (typeof proposal.commandType !== "string" || proposal.commandType.trim().length === 0) issues.push(`payload.commandProposals[${index}].commandType must be a non-empty string.`);
      if (!Array.isArray(proposal.targetRefs) || proposal.targetRefs.some(item => typeof item !== "string")) issues.push(`payload.commandProposals[${index}].targetRefs must be a string array.`);
      if (!proposal.payload || typeof proposal.payload !== "object" || Array.isArray(proposal.payload)) issues.push(`payload.commandProposals[${index}].payload must be an object.`);
      if (proposal.commitAuthority !== false) issues.push(`payload.commandProposals[${index}].commitAuthority must be false.`);
    }
  }
  if (!Array.isArray(payload.creationProposals)) {
    issues.push("payload.creationProposals must be an array.");
  } else if (payload.creationProposals.length > 0) {
    issues.push("payload.creationProposals must be empty for mj_planner mini.");
  }
  if (!Array.isArray(payload.actorAssignments)) {
    issues.push("payload.actorAssignments must be an array.");
  } else {
    for (let index = 0; index < payload.actorAssignments.length; index += 1) {
      const assignment = payload.actorAssignments[index];
      if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) {
        issues.push(`payload.actorAssignments[${index}] must be an object.`);
        continue;
      }
      if (!allowedActorRoles.has(assignment.role)) issues.push(`payload.actorAssignments[${index}].role is invalid.`);
      if (!(typeof assignment.actorId === "string" || assignment.actorId === null)) issues.push(`payload.actorAssignments[${index}].actorId must be a string or null.`);
      if (typeof assignment.reason !== "string" || assignment.reason.trim().length === 0) issues.push(`payload.actorAssignments[${index}].reason must be a non-empty string.`);
    }
  }
  if (!payload.revealPlan || typeof payload.revealPlan !== "object" || Array.isArray(payload.revealPlan)) {
    issues.push("payload.revealPlan must be an object.");
  } else {
    for (const key of ["reveal", "hint", "withhold"]) {
      if (!Array.isArray(payload.revealPlan[key]) || payload.revealPlan[key].some(item => typeof item !== "string")) issues.push(`payload.revealPlan.${key} must be a string array.`);
    }
    if (Array.isArray(payload.revealPlan.reveal) && payload.revealPlan.reveal.length > 0) issues.push("payload.revealPlan.reveal must be empty for mj_planner mini.");
  }
  if (payload.timeAdvanceProposal !== null) issues.push("payload.timeAdvanceProposal must be null for mj_planner mini.");
  if (!payload.playerHandoff || typeof payload.playerHandoff !== "object" || Array.isArray(payload.playerHandoff)) {
    issues.push("payload.playerHandoff must be an object.");
  } else {
    if (!allowedHandoffs.has(payload.playerHandoff.handoffKind)) issues.push("payload.playerHandoff.handoffKind is invalid.");
    if (typeof payload.playerHandoff.reason !== "string" || payload.playerHandoff.reason.trim().length === 0) issues.push("payload.playerHandoff.reason must be a non-empty string.");
  }
  for (const key of ["riskFlags", "respectedCommitmentRefs", "forbiddenOutcomes"]) {
    if (!Array.isArray(payload[key]) || payload[key].some(item => typeof item !== "string")) issues.push(`payload.${key} must be a string array.`);
  }
  if (Array.isArray(payload.forbiddenOutcomes)) {
    for (const required of ["commit_direct", "narrate_unvalidated_success", "advance_time_without_domain", "reveal_secret", "create_persistent_fact"]) {
      if (!payload.forbiddenOutcomes.includes(required)) issues.push(`payload.forbiddenOutcomes must include ${required}.`);
    }
  }
  return issues;
}

function validateNpcPerformerPayload(payload, request) {
  const issues = [];
  const sourceActorId = request?.input?.task?.actorId;
  const sourceDialogueAct = request?.input?.task?.dialogueAct;
  if (payload.schemaVersion !== 1) issues.push("payload.schemaVersion must be 1.");
  if (typeof payload.performanceId !== "string" || payload.performanceId.trim().length === 0) issues.push("payload.performanceId must be a non-empty string.");
  if (typeof payload.actorId !== "string" || payload.actorId.trim().length === 0) {
    issues.push("payload.actorId must be a non-empty string.");
  } else if (typeof sourceActorId === "string" && sourceActorId.trim().length > 0 && payload.actorId !== sourceActorId) {
    issues.push("payload.actorId must match task.actorId.");
  }
  const reactionFrame = payload.reactionFrame;
  if (!reactionFrame || typeof reactionFrame !== "object" || Array.isArray(reactionFrame)) {
    issues.push("payload.reactionFrame must be an object.");
  } else {
    const responseModes = {
      INITIATE_CONVERSATION: "ACKNOWLEDGE_CONTACT",
      ASK_QUESTION: "ANSWER_QUESTION",
      MAKE_STATEMENT: "ACKNOWLEDGE_STATEMENT",
      REQUEST_ACTION: "RESPOND_TO_REQUEST",
      OTHER: "CAUTIOUS_RESPONSE"
    };
    if (reactionFrame.schemaVersion !== 1) issues.push("payload.reactionFrame.schemaVersion must be 1.");
    if (!Object.hasOwn(responseModes, reactionFrame.sourceDialogueAct)) issues.push("payload.reactionFrame.sourceDialogueAct is invalid.");
    if (!Object.values(responseModes).includes(reactionFrame.responseMode)) issues.push("payload.reactionFrame.responseMode is invalid.");
    if (typeof reactionFrame.addressedContentGoal !== "string" || reactionFrame.addressedContentGoal.trim().length === 0) issues.push("payload.reactionFrame.addressedContentGoal must be non-empty.");
    if (sourceDialogueAct && reactionFrame.sourceDialogueAct !== sourceDialogueAct.act) issues.push("payload.reactionFrame.sourceDialogueAct must match task.dialogueAct.act.");
    if (sourceDialogueAct && reactionFrame.responseMode !== responseModes[sourceDialogueAct.act]) issues.push("payload.reactionFrame.responseMode must match task.dialogueAct.act.");
    if (sourceDialogueAct && reactionFrame.addressedContentGoal !== sourceDialogueAct.contentGoal) issues.push("payload.reactionFrame.addressedContentGoal must match task.dialogueAct.contentGoal.");
  }
  if (!Array.isArray(payload.utterances) || payload.utterances.length === 0 || payload.utterances.length > 2) {
    issues.push("payload.utterances must contain 1 to 2 utterances.");
  } else {
    for (let index = 0; index < payload.utterances.length; index += 1) {
      const utterance = payload.utterances[index];
      if (!utterance || typeof utterance !== "object" || Array.isArray(utterance)) {
        issues.push(`payload.utterances[${index}] must be an object.`);
        continue;
      }
      if (typeof utterance.utteranceId !== "string" || utterance.utteranceId.trim().length === 0) issues.push(`payload.utterances[${index}].utteranceId must be a non-empty string.`);
      if (typeof utterance.text !== "string" || utterance.text.trim().length === 0) issues.push(`payload.utterances[${index}].text must be a non-empty string.`);
      if (!Array.isArray(utterance.audience) || utterance.audience.some(item => typeof item !== "string")) issues.push(`payload.utterances[${index}].audience must be a string array.`);
      if (!Array.isArray(utterance.speechActs) || utterance.speechActs.length === 0) {
        issues.push(`payload.utterances[${index}].speechActs must be a non-empty array.`);
      } else {
        for (let actIndex = 0; actIndex < utterance.speechActs.length; actIndex += 1) {
          const act = utterance.speechActs[actIndex];
          const path = `payload.utterances[${index}].speechActs[${actIndex}]`;
          if (!act || typeof act !== "object" || Array.isArray(act)) {
            issues.push(`${path} must be an object.`);
            continue;
          }
          if (!["assertion", "question", "refusal"].includes(act.type)) issues.push(`${path}.type is not allowed for npc_performer mini.`);
          if (typeof act.content !== "string" || act.content.trim().length === 0) issues.push(`${path}.content must be a non-empty string.`);
          if (!["known", "believed", "uncertain"].includes(act.epistemicBasis)) issues.push(`${path}.epistemicBasis is invalid for npc_performer mini.`);
          if (!Array.isArray(act.sourceRefs) || act.sourceRefs.some(item => typeof item !== "string")) issues.push(`${path}.sourceRefs must be a string array.`);
        }
      }
    }
  }
  if (!Array.isArray(payload.nonVerbalReactions) || payload.nonVerbalReactions.some(item => typeof item !== "string")) issues.push("payload.nonVerbalReactions must be a string array.");
  if (!Array.isArray(payload.durableCommitments) || payload.durableCommitments.some(item => typeof item !== "string")) {
    issues.push("payload.durableCommitments must be a string array.");
  } else if (payload.durableCommitments.length > 0) {
    issues.push("payload.durableCommitments must be empty for npc_performer mini.");
  }
  if (!Array.isArray(payload.revealedRefs) || payload.revealedRefs.some(item => typeof item !== "string")) {
    issues.push("payload.revealedRefs must be a string array.");
  } else if (payload.revealedRefs.length > 0) {
    issues.push("payload.revealedRefs must be empty for npc_performer mini.");
  }
  if (!Array.isArray(payload.knowledgeUsed) || payload.knowledgeUsed.some(item => typeof item !== "string")) issues.push("payload.knowledgeUsed must be a string array.");
  if (!payload.safetyConstraints || typeof payload.safetyConstraints !== "object" || Array.isArray(payload.safetyConstraints)) {
    issues.push("payload.safetyConstraints must be an object.");
  } else {
    if (payload.safetyConstraints.noMechanicalSuccess !== true) issues.push("payload.safetyConstraints.noMechanicalSuccess must be true.");
    if (payload.safetyConstraints.noSecretReveal !== true) issues.push("payload.safetyConstraints.noSecretReveal must be true.");
    if (payload.safetyConstraints.noDurableCommitment !== true) issues.push("payload.safetyConstraints.noDurableCommitment must be true.");
    if (payload.safetyConstraints.noStateMutation !== true) issues.push("payload.safetyConstraints.noStateMutation must be true.");
  }
  return issues;
}

function validateCoherenceCriticPayload(payload) {
  const issues = [];
  if (!["PASS", "REVISE", "REJECT"].includes(payload.verdict)) issues.push("payload.verdict is invalid.");
  if (!Array.isArray(payload.findings)) {
    issues.push("payload.findings must be an array.");
  } else {
    payload.findings.forEach((finding, index) => {
      const path = `payload.findings[${index}]`;
      if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
        issues.push(`${path} must be an object.`);
        return;
      }
      if (typeof finding.findingId !== "string" || finding.findingId.trim().length === 0) issues.push(`${path}.findingId must be a non-empty string.`);
      if (!["INFO", "WARNING", "BLOCKING"].includes(finding.severity)) issues.push(`${path}.severity is invalid.`);
      if (!["AUTHORITY", "PLAYER_AGENCY", "SECRET_LEAK", "PERSPECTIVE", "PLOT_COHERENCE", "RULE_CONFLICT", "DUPLICATE", "UNSUPPORTED_CREATION"].includes(finding.category)) issues.push(`${path}.category is invalid.`);
      if (!Array.isArray(finding.affectedRefs) || finding.affectedRefs.some(ref => typeof ref !== "string")) issues.push(`${path}.affectedRefs must be a string array.`);
      if (typeof finding.explanation !== "string" || finding.explanation.trim().length === 0) issues.push(`${path}.explanation must be a non-empty string.`);
    });
  }
  if (!Array.isArray(payload.correctionConstraints) || payload.correctionConstraints.some(entry => typeof entry !== "string")) {
    issues.push("payload.correctionConstraints must be a string array.");
  }
  if (payload.verdict === "PASS" && (payload.findings?.length > 0 || payload.correctionConstraints?.length > 0)) {
    issues.push("payload PASS must not contain findings or correction constraints.");
  }
  if (payload.verdict === "REJECT" && !payload.findings?.some(finding => finding?.severity === "BLOCKING")) {
    issues.push("payload REJECT requires a BLOCKING finding.");
  }
  return issues;
}

function validateIntentSemanticIntent(value, intent, index, allowedSemanticKinds) {
  const issues = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`payload.intents[${index}].semanticIntent must be an object.`];
  }
  if (value.schemaVersion !== 1) issues.push(`payload.intents[${index}].semanticIntent.schemaVersion must be 1.`);
  if (!allowedSemanticKinds.has(value.kind)) issues.push(`payload.intents[${index}].semanticIntent.kind is invalid.`);
  if (typeof value.playerGoal !== "string" || value.playerGoal.trim().length === 0) issues.push(`payload.intents[${index}].semanticIntent.playerGoal must be a non-empty string.`);
  if (value.commitment !== intent.commitment) issues.push(`payload.intents[${index}].semanticIntent.commitment must match commitment.`);
  if (!["low", "medium", "high"].includes(value.confidence)) issues.push(`payload.intents[${index}].semanticIntent.confidence is invalid.`);
  if (!Array.isArray(value.evidenceFromInput) || value.evidenceFromInput.length === 0 || value.evidenceFromInput.some(item => typeof item !== "string")) {
    issues.push(`payload.intents[${index}].semanticIntent.evidenceFromInput must be a non-empty string array.`);
  }
  for (const key of ["uncertainties", "forbiddenInterpretations"]) {
    if (!Array.isArray(value[key]) || value[key].some(item => typeof item !== "string")) {
      issues.push(`payload.intents[${index}].semanticIntent.${key} must be a string array.`);
    }
  }
  if (value.kind === "observe_environment" && (!value.perception || typeof value.perception !== "object" || Array.isArray(value.perception))) {
    issues.push(`payload.intents[${index}].semanticIntent.perception is required for observe_environment.`);
  } else if (value.kind !== "observe_environment" && value.perception !== null) {
    issues.push(`payload.intents[${index}].semanticIntent.perception must be null outside observe_environment.`);
  }
  if (value.perception && typeof value.perception === "object" && !Array.isArray(value.perception)) {
    if (value.perception.schemaVersion !== 1) issues.push(`payload.intents[${index}].semanticIntent.perception.schemaVersion must be 1.`);
    if (!["GLANCE", "FOCUSED", "SEARCH"].includes(value.perception.depth)) issues.push(`payload.intents[${index}].semanticIntent.perception.depth is invalid.`);
    if (typeof value.perception.focus !== "string" || value.perception.focus.trim().length === 0) issues.push(`payload.intents[${index}].semanticIntent.perception.focus must be a non-empty string.`);
    if (!(value.perception.soughtInformation === null || typeof value.perception.soughtInformation === "string")) issues.push(`payload.intents[${index}].semanticIntent.perception.soughtInformation must be a string or null.`);
  }
  if (value.kind === "address_visible_actor" && (!value.dialogueAct || typeof value.dialogueAct !== "object" || Array.isArray(value.dialogueAct))) {
    issues.push(`payload.intents[${index}].semanticIntent.dialogueAct is required for address_visible_actor.`);
  } else if (value.kind !== "address_visible_actor" && value.dialogueAct !== null) {
    issues.push(`payload.intents[${index}].semanticIntent.dialogueAct must be null outside address_visible_actor.`);
  }
  if (value.dialogueAct && typeof value.dialogueAct === "object" && !Array.isArray(value.dialogueAct)) {
    if (value.dialogueAct.schemaVersion !== 1) issues.push(`payload.intents[${index}].semanticIntent.dialogueAct.schemaVersion must be 1.`);
    if (!["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER"].includes(value.dialogueAct.act)) issues.push(`payload.intents[${index}].semanticIntent.dialogueAct.act is invalid.`);
    if (typeof value.dialogueAct.contentGoal !== "string" || value.dialogueAct.contentGoal.trim().length === 0) issues.push(`payload.intents[${index}].semanticIntent.dialogueAct.contentGoal must be a non-empty string.`);
    if (!(value.dialogueAct.addresseeRef === null || typeof value.dialogueAct.addresseeRef === "string")) issues.push(`payload.intents[${index}].semanticIntent.dialogueAct.addresseeRef must be a string or null.`);
  }
  if (value.target !== null) {
    if (!value.target || typeof value.target !== "object" || Array.isArray(value.target)) {
      issues.push(`payload.intents[${index}].semanticIntent.target must be an object or null.`);
    } else {
      if (!["npc", "place", "object", "self", "unknown"].includes(value.target.kind)) issues.push(`payload.intents[${index}].semanticIntent.target.kind is invalid.`);
      if (!(typeof value.target.ref === "string" || value.target.ref === null)) issues.push(`payload.intents[${index}].semanticIntent.target.ref must be a string or null.`);
      if (!(typeof value.target.label === "string" || value.target.label === null)) issues.push(`payload.intents[${index}].semanticIntent.target.label must be a string or null.`);
    }
  }
  return issues;
}

function validateIntentRuntimeHandling(value, intent, index, allowedIntentActions, allowedRuntimeStatuses, allowedRuntimeDomains) {
  const issues = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`payload.intents[${index}].runtimeHandling must be an object.`];
  }
  if (value.schemaVersion !== 1) issues.push(`payload.intents[${index}].runtimeHandling.schemaVersion must be 1.`);
  if (!allowedRuntimeStatuses.has(value.status)) issues.push(`payload.intents[${index}].runtimeHandling.status is invalid.`);
  if (value.status === "AI_INTERPRETATION_FAILED") issues.push(`payload.intents[${index}].runtimeHandling.status failed output must not be accepted.`);
  if (value.status === "NEEDS_CLARIFICATION" && intent.requiresClarification !== true) issues.push(`payload.intents[${index}].runtimeHandling NEEDS_CLARIFICATION requires clarification.`);
  if (typeof value.reason !== "string" || value.reason.trim().length === 0) issues.push(`payload.intents[${index}].runtimeHandling.reason must be a non-empty string.`);
  if (!(value.requiredDomain === null || allowedRuntimeDomains.has(value.requiredDomain))) issues.push(`payload.intents[${index}].runtimeHandling.requiredDomain is invalid.`);
  if (!(value.canonicalActionHint === null || allowedIntentActions.has(value.canonicalActionHint))) issues.push(`payload.intents[${index}].runtimeHandling.canonicalActionHint must be canonical or null.`);
  if (typeof value.noCommit !== "boolean") issues.push(`payload.intents[${index}].runtimeHandling.noCommit must be a boolean.`);
  if (typeof value.noGameTime !== "boolean") issues.push(`payload.intents[${index}].runtimeHandling.noGameTime must be a boolean.`);
  return issues;
}

function validateIntentReferentResolution(value, index) {
  const issues = [];
  if (value === null) return issues;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`payload.intents[${index}].referentResolution must be an object or null.`];
  }
  if (value.schemaVersion !== 1) issues.push(`payload.intents[${index}].referentResolution.schemaVersion must be 1.`);
  if (typeof value.usedPreviousContext !== "boolean") issues.push(`payload.intents[${index}].referentResolution.usedPreviousContext must be a boolean.`);
  if (!["current_input", "recent_visible_focus", "visible_scene", "none"].includes(value.source)) issues.push(`payload.intents[${index}].referentResolution.source is invalid.`);
  if (!Array.isArray(value.evidence) || value.evidence.some(item => typeof item !== "string")) issues.push(`payload.intents[${index}].referentResolution.evidence must be a string array.`);
  if (!["none", "multiple_candidates", "incompatible_action", "insufficient_context", "unknown"].includes(value.ambiguity)) issues.push(`payload.intents[${index}].referentResolution.ambiguity is invalid.`);
  if (!["low", "medium", "high"].includes(value.confidence)) issues.push(`payload.intents[${index}].referentResolution.confidence is invalid.`);
  if (value.resolvedTarget !== null) {
    if (!value.resolvedTarget || typeof value.resolvedTarget !== "object" || Array.isArray(value.resolvedTarget)) {
      issues.push(`payload.intents[${index}].referentResolution.resolvedTarget must be an object or null.`);
    } else {
      if (!["npc", "place", "object", "self", "unknown"].includes(value.resolvedTarget.kind)) issues.push(`payload.intents[${index}].referentResolution.resolvedTarget.kind is invalid.`);
      if (!(typeof value.resolvedTarget.ref === "string" || value.resolvedTarget.ref === null)) issues.push(`payload.intents[${index}].referentResolution.resolvedTarget.ref must be a string or null.`);
      if (!(typeof value.resolvedTarget.label === "string" || value.resolvedTarget.label === null)) issues.push(`payload.intents[${index}].referentResolution.resolvedTarget.label must be a string or null.`);
    }
  }
  return issues;
}

function sanitizeProviderErrorText(text) {
  if (typeof text !== "string" || text.trim().length === 0) return "";
  return text
    .replace(/sk-[A-Za-z0-9_-]+/gu, "[REDACTED_KEY]")
    .replace(/\s+/gu, " ")
    .slice(0, 500);
}

function errorEnvelope(request, code, message) {
  return {
    schemaVersion: 1,
    contractVersion: request.contractVersion || contractVersionForRole(request.role),
    outputId: `server-openai-error:${request.attemptId || "unknown"}`,
    callId: request.callId || "unknown",
    attemptId: request.attemptId || "unknown",
    packId: request.packId || "unknown",
    snapshotId: request.snapshotId || "unknown",
    role: ALLOWED_ROLES.has(request.role) ? request.role : "scene_writer",
    status: "PARTIAL_UNUSABLE",
    payload: {},
    diagnostics: [{
      code,
      severity: "BLOCKING",
      message,
      sourceRefs: [`operation:${request.operationId || "unknown"}`]
    }],
    supersedesOutputId: null
  };
}

module.exports = {
  CONTRACT_VERSION,
  STRICT_AI_OUTPUT_SCHEMA,
  buildRoleInstructions,
  buildServerRoute,
  buildStrictAiOutputSchema,
  buildOpenAiResponsesBody,
  createNarrativeOpenAiEnhancementApi,
  errorEnvelope,
  normalizeAiCallRequest,
  normalizeProviderEnvelope,
  sanitizeProviderErrorText,
  validateEnvelope,
  validateRolePayload
};
