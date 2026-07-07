"use strict";

const ALLOWED_ROLES = new Set(["player_expression_adapter", "scene_writer"]);
const CONTRACT_VERSION = "narrative-ai-resolution/1";
const DEFAULT_MODEL = "gpt-4.1-mini";

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
        status: { enum: ["OK", "NEEDS_CLARIFICATION", "CANNOT_COMPLY", "REFUSED", "PARTIAL_UNUSABLE"] },
        payload: buildRolePayloadSchema(request.role),
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

function buildRolePayloadSchema(role) {
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
          required: ["slotId", "blockKind", "content", "groundedIn", "usesCreativeTexture"],
          properties: {
            slotId: { type: "string" },
            blockKind: { enum: ["MJ_NARRATION", "SYSTEM_NOTICE"] },
            content: { type: "string" },
            groundedIn: { type: "array", items: { type: "string" } },
            usesCreativeTexture: { type: "boolean" }
          }
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
        body: JSON.stringify(openAiBody)
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
        parsed = JSON.parse(outputText);
      } catch {
        return sendJson(res, 200, {
          ok: false,
          error: "OPENAI_INVALID_JSON",
          output: errorEnvelope(request.value, "OPENAI_INVALID_JSON", "OpenAI output was not parseable JSON.")
        });
      }

      const validation = validateEnvelope(parsed, request.value);
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
        output: parsed,
        metrics: {
          providerId: "openai",
          modelId: route.modelId,
          role: request.value.role,
          usage: data && typeof data === "object" ? data.usage || null : null
        }
      });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        error: "NARRATIVE_OPENAI_ROUTE_FAILURE",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { tryHandle };
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
    "idempotencyKey"
  ]) {
    if (typeof request[key] !== "string" || request[key].trim().length === 0) issues.push(`${key} must be a non-empty string.`);
  }
  if (request.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (!ALLOWED_ROLES.has(request.role)) issues.push("role is not allowed for narrative enhancement.");
  if (request.contractVersion !== CONTRACT_VERSION) issues.push("contractVersion must be narrative-ai-resolution/1.");
  if (!request.input || typeof request.input !== "object") issues.push("input must be an object.");
  if (!request.limits || typeof request.limits !== "object") {
    issues.push("limits must be an object.");
  } else {
    if (!Number.isInteger(request.limits.inputTokenBudget) || request.limits.inputTokenBudget <= 0 || request.limits.inputTokenBudget > 2_000) {
      issues.push("limits.inputTokenBudget must be between 1 and 2000.");
    }
    if (!Number.isInteger(request.limits.outputTokenBudget) || request.limits.outputTokenBudget <= 0 || request.limits.outputTokenBudget > 1_000) {
      issues.push("limits.outputTokenBudget must be between 1 and 1000.");
    }
    if (!Number.isInteger(request.limits.timeoutMs) || request.limits.timeoutMs <= 0 || request.limits.timeoutMs > 10_000) {
      issues.push("limits.timeoutMs must be between 1 and 10000.");
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: request };
}

function buildServerRoute(request, env) {
  return {
    modelId: env.NARRATION_OPENAI_MODEL || DEFAULT_MODEL,
    routeId: request.role === "scene_writer"
      ? "server-openai-narrative-scene-writer"
      : "server-openai-narrative-expression"
  };
}

function buildOpenAiResponsesBody(request, route) {
  const strictSchema = buildStrictAiOutputSchema(request);
  return {
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

  if (request.role === "player_expression_adapter") {
    return [
      ...shared,
      "Role player_expression_adapter: reformule uniquement l'expression visible du personnage joueur.",
      "Preserve l'intention du joueur. N'ajoute aucune promesse, menace, information, action, emotion forte ou risque non exprime.",
      "addedMeaning doit rester [] pour une sortie safeToUse=true.",
      "Si la demande du joueur est trop pauvre, ameliore le style selon le personnage sans changer le sens."
    ].join("\n");
  }

  return [
    ...shared,
    "Role scene_writer: ajoute seulement une narration MJ atmospherique ancree dans les resolutions deja confirmees.",
    "Chaque bloc doit citer au moins une source dans groundedIn, par exemple resolution:<id> si fourni dans la tache.",
    "N'annonce pas de nouveau resultat de test, de degat, de reaction PNJ decisive, de combat, de recompense ou de secret.",
    "La texture creative est autorisee seulement pour decrire le ton, le rythme, les sensations et la mise en scene."
  ].join("\n");
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
  if (!Array.isArray(output.diagnostics)) issues.push("diagnostics must be an array.");
  if (!output.payload || typeof output.payload !== "object" || Array.isArray(output.payload)) {
    issues.push("payload must be an object.");
  } else {
    issues.push(...validateRolePayload(output.payload, request.role));
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true };
}

function validateRolePayload(payload, role) {
  const issues = [];
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
    if (!["MJ_NARRATION", "SYSTEM_NOTICE"].includes(block.blockKind)) issues.push(`payload.narrationBlocks[${index}].blockKind is invalid.`);
    if (typeof block.content !== "string" || block.content.trim().length === 0) issues.push(`payload.narrationBlocks[${index}].content must be a non-empty string.`);
    if (!Array.isArray(block.groundedIn) || block.groundedIn.length === 0 || block.groundedIn.some(item => typeof item !== "string")) {
      issues.push(`payload.narrationBlocks[${index}].groundedIn must be a non-empty string array.`);
    }
    if (typeof block.usesCreativeTexture !== "boolean") issues.push(`payload.narrationBlocks[${index}].usesCreativeTexture must be a boolean.`);
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
    contractVersion: request.contractVersion || CONTRACT_VERSION,
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
  buildStrictAiOutputSchema,
  buildOpenAiResponsesBody,
  createNarrativeOpenAiEnhancementApi,
  errorEnvelope,
  normalizeAiCallRequest,
  sanitizeProviderErrorText,
  validateEnvelope,
  validateRolePayload
};
