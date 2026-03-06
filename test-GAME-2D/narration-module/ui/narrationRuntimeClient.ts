export type NarrationRuntimeStatus = {
  narration_generation_enabled: boolean;
};

export type NarrationTurnPayload = {
  campaign_id: string;
  character_id: string;
  player_input: string;
  location_id: string;
  destination_id?: string;
  target_actor_id?: string;
  intent_hint?: string;
  map_prompt: string;
  narration_context: string;
  narration_goal: string;
  narration_constraints: string;
};

export type NarrationPipelineResult = {
  decisionReason: string;
  actionCount: number;
  needsNarration: boolean;
  narrationSource: string;
  finalPlayerText: string;
  debug: {
    step_1_app_to_runtime_request: Record<string, unknown>;
    step_2_runtime_received_packet: Record<string, unknown>;
    step_3_runtime_to_llm_request: Record<string, unknown> | null;
    step_4_app_final_response: Record<string, unknown> | null;
    ai_handoff: Record<string, unknown> | null;
    narration_result: Record<string, unknown> | null;
    trace: Record<string, unknown> | null;
    projected_memory: Record<string, unknown> | null;
  };
};

export async function fetchNarrationRuntimeStatus(): Promise<NarrationRuntimeStatus> {
  const response = await fetch("/api/narration-module/status");
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    narration_generation_enabled?: boolean;
  };
  return {
    narration_generation_enabled: Boolean(data?.narration_generation_enabled)
  };
}

export async function runNarrationPipeline(
  payload: NarrationTurnPayload
): Promise<NarrationPipelineResult> {
  const step1Request = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  const processResponse = await fetch("/api/narration-module/process-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const processData = (await processResponse.json()) as {
    error?: string;
    details?: string[];
    decision_reason?: string;
    narrative_generation_required?: boolean;
    intent_packet?: Record<string, unknown>;
    trace?: Record<string, unknown>;
    projected_memory?: Record<string, unknown>;
    ai_handoff?: Record<string, unknown>;
  };
  if (!processResponse.ok || processData?.error) {
    const details = Array.isArray(processData?.details) ? processData.details.join(" | ") : "";
    throw new Error([processData?.error ?? `HTTP ${processResponse.status}`, details].filter(Boolean).join(" - "));
  }

  const actionCount = Array.isArray((processData?.trace as any)?.runtime_actions)
    ? ((processData?.trace as any).runtime_actions as unknown[]).length
    : 0;
  const decisionReason = String(processData?.decision_reason ?? "unknown");
  const needsNarration = Boolean(processData?.narrative_generation_required);

  let narrationResult: Record<string, unknown> | null = null;
  let narrationRequest: Record<string, unknown> | null = null;
  let narrationSource = "runtime_only";
  let finalPlayerText = "";

  if (needsNarration && processData?.ai_handoff) {
    narrationRequest = { ai_handoff: processData.ai_handoff as Record<string, unknown> };
    const narrResponse = await fetch("/api/narration-module/generate-narration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(narrationRequest)
    });
    const narrData = (await narrResponse.json()) as {
      error?: string;
      details?: string[];
      source?: string;
      player_text?: string;
    };
    if (!narrResponse.ok || narrData?.error) {
      const details = Array.isArray(narrData?.details) ? narrData.details.join(" | ") : "";
      throw new Error([narrData?.error ?? `HTTP ${narrResponse.status}`, details].filter(Boolean).join(" - "));
    }
    narrationResult = narrData as unknown as Record<string, unknown>;
    narrationSource = String(narrData?.source ?? "llm");
    finalPlayerText = String(narrData?.player_text ?? "").trim();
  }

  return {
    decisionReason,
    actionCount,
    needsNarration,
    narrationSource,
    finalPlayerText,
    debug: {
      step_1_app_to_runtime_request: step1Request,
      step_2_runtime_received_packet: processData?.intent_packet ?? null,
      step_3_runtime_to_llm_request: narrationRequest,
      step_4_app_final_response: narrationResult,
      ai_handoff: processData?.ai_handoff ?? null,
      narration_result: narrationResult,
      trace: processData?.trace ?? null,
      projected_memory: processData?.projected_memory ?? null
    }
  };
}
