import fs from "node:fs";
import path from "node:path";
import { cloneJson } from "../core";
import type { ContractAiProviderV1 } from "./FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiFailureCategoryV1,
  AiIncidentRecordV1,
  AiModelRouteV1,
  AiOutputValidationResultV1,
  AiProviderMetricsV1,
  AiRoleOutputEnvelopeV1
} from "./types";
import { createAiIncidentRecordV1, validateAiCallRequestV1, validateAiModelRouteV1, validateAiRoleOutputEnvelopeV1 } from "./validation";

export interface OpenAiModelRouteV1 extends AiModelRouteV1 {
  providerKind: "REMOTE_PROVIDER";
  providerId: "openai";
  certified: true;
  maxRetries: number;
  structuredOutputSchemaId: string;
  liveEnabled: boolean;
}

export type OpenAiProviderResultV1 =
  | {
      ok: true;
      output: AiRoleOutputEnvelopeV1;
      validation: AiOutputValidationResultV1;
      metrics: AiProviderMetricsV1;
    }
  | {
      ok: false;
      category: AiFailureCategoryV1;
      retryable: boolean;
      validation: AiOutputValidationResultV1 | null;
      incident: AiIncidentRecordV1;
      metrics: AiProviderMetricsV1;
    };

export interface OpenAiTransportResponseV1 {
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type OpenAiFetchV1 = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  }
) => Promise<OpenAiTransportResponseV1>;

export interface OpenAiProviderOptionsV1 {
  apiKey: string | null;
  fetchImpl: OpenAiFetchV1;
  now?: () => Date;
}

export interface EnvLookupInputV1 {
  env: Record<string, string | undefined>;
  projectRoot: string;
  repositoryRoot: string;
}

export interface OpenAiJsonSchemaV1 {
  name: string;
  schema: Record<string, unknown>;
}

export const MINIMAL_AI_OUTPUT_JSON_SCHEMA_V1: OpenAiJsonSchemaV1 = {
  name: "ai_role_output_envelope_v1",
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
      schemaVersion: { const: 1 },
      contractVersion: { type: "string" },
      outputId: { type: "string" },
      callId: { type: "string" },
      attemptId: { type: "string" },
      packId: { type: "string" },
      snapshotId: { type: "string" },
      role: { type: "string" },
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
      supersedesOutputId: { anyOf: [{ type: "string" }, { type: "null" }] }
    }
  }
};

function parseOpenAiApiKeyFromEnvContent(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^OPENAI_API_KEY\s*[:=]\s*(.+)\s*$/u);
    if (!match) continue;
    return match[1].trim().replace(/^["']|["']$/gu, "");
  }
  return null;
}

export function loadOpenAiApiKeyV1(input: EnvLookupInputV1): string | null {
  const direct = input.env.OPENAI_API_KEY?.trim();
  if (direct) return direct;

  const candidates = [
    path.join(input.projectRoot, ".env"),
    path.join(input.repositoryRoot, ".env")
  ];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const key = parseOpenAiApiKeyFromEnvContent(fs.readFileSync(candidate, "utf8"));
      if (key) return key;
    } catch {
      return null;
    }
  }
  return null;
}

export function liveOpenAiEnabledV1(env: Record<string, string | undefined>): boolean {
  return env.NARRATION_OPENAI_LIVE === "1";
}

function classifyHttpStatus(status: number): { category: AiFailureCategoryV1; retryable: boolean } {
  if (status === 401 || status === 403) return { category: "AUTHORITY_VIOLATION", retryable: false };
  if (status === 408 || status === 409 || status === 429) return { category: "TRANSPORT_FAILURE", retryable: true };
  if (status >= 500) return { category: "TRANSPORT_FAILURE", retryable: true };
  return { category: "PROVIDER_REFUSAL", retryable: false };
}

function extractOutputText(data: unknown): string | null {
  if (data && typeof data === "object" && "output_text" in data && typeof (data as { output_text?: unknown }).output_text === "string") {
    return (data as { output_text: string }).output_text;
  }
  const output = (data as { output?: unknown })?.output;
  if (!Array.isArray(output)) return null;
  for (const entry of output) {
    const content = (entry as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      const text = (item as { text?: unknown })?.text;
      if (typeof text === "string") return text;
    }
  }
  return null;
}

function extractUsage(data: unknown): Pick<AiProviderMetricsV1, "inputTokens" | "outputTokens" | "totalTokens"> {
  const usage = (data as { usage?: Record<string, unknown> })?.usage;
  const inputTokens = usage?.input_tokens;
  const outputTokens = usage?.output_tokens;
  const totalTokens = usage?.total_tokens;
  return {
    inputTokens: typeof inputTokens === "number" ? inputTokens : null,
    outputTokens: typeof outputTokens === "number" ? outputTokens : null,
    totalTokens: typeof totalTokens === "number" ? totalTokens : null
  };
}

function makeMetrics(input: {
  route: OpenAiModelRouteV1;
  request: AiCallRequestV1;
  startedAt: Date;
  endedAt: Date;
  usage?: Pick<AiProviderMetricsV1, "inputTokens" | "outputTokens" | "totalTokens">;
  finishReason?: string | null;
}): AiProviderMetricsV1 {
  return {
    schemaVersion: 1,
    providerId: "openai",
    modelId: input.route.modelId,
    role: input.request.role,
    operationId: input.request.operationId,
    callId: input.request.callId,
    attemptId: input.request.attemptId,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt.toISOString(),
    latencyMs: Math.max(0, input.endedAt.getTime() - input.startedAt.getTime()),
    inputTokens: input.usage?.inputTokens ?? null,
    outputTokens: input.usage?.outputTokens ?? null,
    totalTokens: input.usage?.totalTokens ?? null,
    estimatedCostMinorUnits: null,
    finishReason: input.finishReason ?? null
  };
}

function incident(input: {
  request: AiCallRequestV1;
  category: AiFailureCategoryV1;
  stage: AiIncidentRecordV1["stage"];
  outcome: AiIncidentRecordV1["outcome"];
  unsafeDetails: Record<string, unknown>;
}): AiIncidentRecordV1 {
  return createAiIncidentRecordV1({
    incidentId: `incident:${input.request.operationId}:${input.request.attemptId}:openai`,
    campaignId: input.request.campaignId,
    operationId: input.request.operationId,
    callId: input.request.callId,
    attemptIds: [input.request.attemptId],
    role: input.request.role,
    category: input.category,
    severity: "BLOCKING",
    stage: input.stage,
    commitState: "NO_COMMIT",
    outcome: input.outcome,
    unsafeDetails: input.unsafeDetails
  });
}

export function buildOpenAiResponsesBodyV1(request: AiCallRequestV1, route: OpenAiModelRouteV1, schema: OpenAiJsonSchemaV1): Record<string, unknown> {
  return {
    model: route.modelId,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: String(request.input.instructionsRef) }]
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: JSON.stringify({
            callId: request.callId,
            attemptId: request.attemptId,
            packId: request.packId,
            snapshotId: request.snapshotId,
            role: request.role,
            contractVersion: request.contractVersion,
            task: request.input.task,
            roleContextPack: request.input.roleContextPack
          })
        }]
      }
    ],
    max_output_tokens: request.limits.outputTokenBudget,
    text: {
      format: {
        type: "json_schema",
        name: schema.name,
        schema: schema.schema,
        strict: true
      }
    }
  };
}

export interface OpenAiInputBudgetReportV1 {
  contractVersion: "narrative-provider-input-budget/1";
  serializedBodyChars: number;
  baseEstimatedTokens: number;
  estimationMarginTokens: number;
  estimatedInputTokens: number;
  inputTokenBudget: number;
  withinBudget: boolean;
  appliedReductions: string[];
}

export function measureOpenAiInputBudgetV1(
  request: AiCallRequestV1,
  route: OpenAiModelRouteV1,
  schema: OpenAiJsonSchemaV1,
  appliedReductions: string[] = []
): OpenAiInputBudgetReportV1 {
  const serializedBodyChars = JSON.stringify(buildOpenAiResponsesBodyV1(request, route, schema)).length;
  const baseEstimatedTokens = Math.ceil(serializedBodyChars / 4);
  const estimationMarginTokens = Math.max(64, Math.ceil(baseEstimatedTokens * 0.15));
  const estimatedInputTokens = baseEstimatedTokens + estimationMarginTokens;
  return {
    contractVersion: "narrative-provider-input-budget/1",
    serializedBodyChars,
    baseEstimatedTokens,
    estimationMarginTokens,
    estimatedInputTokens,
    inputTokenBudget: request.limits.inputTokenBudget,
    withinBudget: estimatedInputTokens <= request.limits.inputTokenBudget,
    appliedReductions
  };
}

function prepareOpenAiInputWithinBudgetV1(
  request: AiCallRequestV1,
  route: OpenAiModelRouteV1,
  schema: OpenAiJsonSchemaV1
): { ok: true; request: AiCallRequestV1; body: Record<string, unknown>; report: OpenAiInputBudgetReportV1 } | { ok: false; report: OpenAiInputBudgetReportV1 } {
  let effectiveRequest = request;
  let report = measureOpenAiInputBudgetV1(effectiveRequest, route, schema);
  const task = request.input.task;
  if (!report.withinBudget && task !== null && typeof task === "object" && !Array.isArray(task) && Object.hasOwn(task, "packetReceipt")) {
    const reducedTask = { ...(task as Record<string, unknown>) };
    delete reducedTask.packetReceipt;
    effectiveRequest = { ...request, input: { ...request.input, task: reducedTask } };
    report = measureOpenAiInputBudgetV1(effectiveRequest, route, schema, ["input.task.packetReceipt"]);
  }
  return report.withinBudget
    ? { ok: true, request: effectiveRequest, body: buildOpenAiResponsesBodyV1(effectiveRequest, route, schema), report }
    : { ok: false, report };
}

export class OpenAiResponsesProviderV1 {
  constructor(private readonly options: OpenAiProviderOptionsV1) {}

  async call(request: AiCallRequestV1, route: OpenAiModelRouteV1, schema: OpenAiJsonSchemaV1 = MINIMAL_AI_OUTPUT_JSON_SCHEMA_V1): Promise<OpenAiProviderResultV1> {
    const startedAt = (this.options.now ?? (() => new Date()))();
    const routeValidation = validateAiModelRouteV1(route, { allowRemoteProvider: true });
    const requestValidation = validateAiCallRequestV1(request, route);
    const preflightIssues = [
      ...(routeValidation.ok ? [] : routeValidation.issues),
      ...(requestValidation.ok ? [] : requestValidation.issues)
    ];
    if (route.providerKind !== "REMOTE_PROVIDER" || route.providerId !== "openai") preflightIssues.push("route must target OpenAI REMOTE_PROVIDER.");
    if (!route.liveEnabled) preflightIssues.push("route is not live-enabled.");
    if (!this.options.apiKey) preflightIssues.push("OPENAI_API_KEY is missing.");
    if (preflightIssues.length > 0) {
      const endedAt = (this.options.now ?? (() => new Date()))();
      const metrics = makeMetrics({ route, request, startedAt, endedAt });
      return {
        ok: false,
        category: "AUTHORITY_VIOLATION",
        retryable: false,
        validation: null,
        metrics,
        incident: incident({
          request,
          category: "AUTHORITY_VIOLATION",
          stage: "CONTEXT_BUILD",
          outcome: "SUSPENDED",
          unsafeDetails: { issues: preflightIssues, apiKey: this.options.apiKey ? "[PRESENT]" : null }
        })
      };
    }

    const preparedInput = prepareOpenAiInputWithinBudgetV1(request, route, schema);
    if (!preparedInput.ok) {
      const endedAt = (this.options.now ?? (() => new Date()))();
      const metrics = makeMetrics({ route, request, startedAt, endedAt });
      return {
        ok: false,
        category: "BUDGET_EXCEEDED",
        retryable: false,
        validation: null,
        metrics,
        incident: incident({
          request,
          category: "BUDGET_EXCEEDED",
          stage: "CONTEXT_BUILD",
          outcome: "SUSPENDED",
          unsafeDetails: {
            inputBudget: preparedInput.report,
            reductionPolicyId: `input-budget:${request.role}:preserve-authority/v1`,
            terminalAction: "REFUSE_IRREDUCIBLE"
          }
        })
      };
    }
    const body = preparedInput.body;
    let response: OpenAiTransportResponseV1;
    try {
      response = await this.options.fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      const endedAt = (this.options.now ?? (() => new Date()))();
      const metrics = makeMetrics({ route, request, startedAt, endedAt });
      return {
        ok: false,
        category: "TRANSPORT_FAILURE",
        retryable: true,
        validation: null,
        metrics,
        incident: incident({
          request,
          category: "TRANSPORT_FAILURE",
          stage: "PROVIDER_CALL",
          outcome: "SUSPENDED",
          unsafeDetails: { error: error instanceof Error ? error.message : String(error) }
        })
      };
    }

    if (response.status < 200 || response.status >= 300) {
      const text = await response.text();
      const failure = classifyHttpStatus(response.status);
      const endedAt = (this.options.now ?? (() => new Date()))();
      const metrics = makeMetrics({ route, request, startedAt, endedAt });
      return {
        ok: false,
        category: failure.category,
        retryable: failure.retryable,
        validation: null,
        metrics,
        incident: incident({
          request,
          category: failure.category,
          stage: "PROVIDER_CALL",
          outcome: "SUSPENDED",
          unsafeDetails: { httpStatus: response.status, statusText: response.statusText, providerRawText: text }
        })
      };
    }

    const data = await response.json();
    const endedAt = (this.options.now ?? (() => new Date()))();
    const metrics = makeMetrics({ route, request, startedAt, endedAt, usage: extractUsage(data) });
    const outputText = extractOutputText(data);
    if (!outputText) {
      return {
        ok: false,
        category: "INVALID_ENVELOPE",
        retryable: false,
        validation: null,
        metrics,
        incident: incident({
          request,
          category: "INVALID_ENVELOPE",
          stage: "OUTPUT_PARSE",
          outcome: "SUSPENDED",
          unsafeDetails: { providerResponse: data }
        })
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return {
        ok: false,
        category: "INVALID_ENVELOPE",
        retryable: false,
        validation: null,
        metrics,
        incident: incident({
          request,
          category: "INVALID_ENVELOPE",
          stage: "OUTPUT_PARSE",
          outcome: "SUSPENDED",
          unsafeDetails: { providerRawText: outputText }
        })
      };
    }

    const validation = validateAiRoleOutputEnvelopeV1(parsed, request);
    if (!validation.accepted) {
      return {
        ok: false,
        category: validation.failureCategory ?? "SCHEMA_VIOLATION",
        retryable: false,
        validation,
        metrics,
        incident: incident({
          request,
          category: validation.failureCategory ?? "SCHEMA_VIOLATION",
          stage: "OUTPUT_VALIDATE",
          outcome: "SUSPENDED",
          unsafeDetails: { issues: validation.issues, providerParsedOutput: parsed }
        })
      };
    }

    return {
      ok: true,
      output: cloneJson(parsed) as AiRoleOutputEnvelopeV1,
      validation,
      metrics
    };
  }
}

export class OpenAiContractAiProviderV1 implements ContractAiProviderV1 {
  constructor(
    private readonly provider: OpenAiResponsesProviderV1,
    private readonly route: OpenAiModelRouteV1,
    private readonly schema: OpenAiJsonSchemaV1 = MINIMAL_AI_OUTPUT_JSON_SCHEMA_V1
  ) {}

  async generate(request: AiCallRequestV1): Promise<unknown> {
    const result = await this.provider.call(request, this.route, this.schema);
    if (result.ok) return result.output;
    return {
      schemaVersion: 1,
      contractVersion: request.contractVersion,
      outputId: `openai-error:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "PARTIAL_UNUSABLE",
      payload: {},
      diagnostics: [{
        code: result.category,
        severity: "BLOCKING",
        message: "OpenAI provider call failed before accepted output.",
        sourceRefs: [`incident:${result.incident.incidentId}`]
      }],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1;
  }
}
