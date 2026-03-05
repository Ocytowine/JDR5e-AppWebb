import { executeRuntimeActions } from "../../adapters/runtime/runtime_stub";
import { RuntimeContext } from "../../adapters/runtime/runtime_types";
import { shallowStateDiff } from "../../domain/memory/state_diff";
import { TurnTraceLogger } from "../../infrastructure/logging/turn_trace_logger";
import {
  validateInputContract,
  validateOutputContract,
} from "../use_cases/contract_validation";
import {
  validateInputSchema,
  validateOutputSchema,
} from "../use_cases/schema_validation";

const IRREVERSIBLE_ACTIONS = new Set([
  "enterLocation",
  "startCombat",
  "setFlag",
  "addJournalEntry",
  "createEvent",
]);

export class TurnRuleError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TurnRuleError";
    this.code = code;
  }
}

export type TurnTrace = {
  turn_id: string;
  input_contract: Record<string, unknown>;
  plan: Record<string, unknown>;
  runtime_actions: Array<Record<string, unknown>>;
  state_before: Record<string, unknown>;
  state_after: Record<string, unknown>;
  state_diff: ReturnType<typeof shallowStateDiff>;
  output_contract: Record<string, unknown>;
};

export class TurnProcessor {
  private logger: TurnTraceLogger;

  constructor(logger: TurnTraceLogger) {
    this.logger = logger;
  }

  processTurn(
    turnId: string,
    inputContract: Record<string, unknown>,
    outputContract: Record<string, unknown>,
    stateBefore: Record<string, unknown>,
    runtimeContext?: Omit<RuntimeContext, "turnId">,
  ): TurnTrace {
    validateInputSchema(inputContract);
    validateOutputSchema(outputContract);
    validateInputContract(inputContract);
    validateOutputContract(outputContract);

    const stateBeforeCopy = JSON.parse(JSON.stringify(stateBefore)) as Record<string, unknown>;
    const runtimeActions = Array.isArray(outputContract.runtime_actions)
      ? (outputContract.runtime_actions as Array<Record<string, unknown>>)
      : [];
    this.enforceRules(outputContract, runtimeActions, turnId);
    const stateAfter = executeRuntimeActions(stateBeforeCopy, runtimeActions, {
      turnId,
      ...(runtimeContext ?? {}),
    });

    const trace: TurnTrace = {
      turn_id: turnId,
      input_contract: inputContract,
      plan: outputContract.plan as Record<string, unknown>,
      runtime_actions: runtimeActions,
      state_before: stateBeforeCopy,
      state_after: stateAfter,
      state_diff: shallowStateDiff(stateBeforeCopy, stateAfter),
      output_contract: outputContract,
    };
    this.logger.append(trace as unknown as Record<string, unknown>);
    return trace;
  }

  private enforceRules(
    outputContract: Record<string, unknown>,
    runtimeActions: Array<Record<string, unknown>>,
    turnId: string,
  ): void {
    const plan = outputContract.plan as Record<string, unknown>;
    const requiresClarification = Boolean(outputContract.requires_clarification);
    const needClarification = Array.isArray(plan.need_clarification)
      ? plan.need_clarification
      : [];

    const hasIrreversible = runtimeActions.some((item) =>
      IRREVERSIBLE_ACTIONS.has(String(item.action ?? "")),
    );
    if ((requiresClarification || needClarification.length > 0) && hasIrreversible) {
      throw new TurnRuleError(
        "clarification_irreversible_blocked",
        "irreversible runtime action forbidden while clarification is required",
      );
    }

    this.enforcePlanMismatch(plan, runtimeActions);
    this.enforceEventTrigger(runtimeActions, turnId);
  }

  private enforcePlanMismatch(
    plan: Record<string, unknown>,
    runtimeActions: Array<Record<string, unknown>>,
  ): void {
    const checksNeeded = Array.isArray(plan.checks_needed) ? plan.checks_needed : [];
    const hasRequestCheck = runtimeActions.some((item) => item.action === "requestCheck");
    if (checksNeeded.length > 0 && !hasRequestCheck) {
      throw new TurnRuleError(
        "plan_mismatch",
        "plan.checks_needed requires at least one requestCheck action",
      );
    }

    const resources = Array.isArray(plan.resources_to_spend) ? plan.resources_to_spend : [];
    const hasTimeCostInPlan = resources.some((r) => {
      const obj = r as Record<string, unknown>;
      return String(obj.type ?? "").toLowerCase() === "time";
    });
    const hasAdvanceTime = runtimeActions.some((item) => item.action === "advanceTime");
    const hasInlineTimeCost = runtimeActions.some((item) => {
      const params = (item.params ?? {}) as Record<string, unknown>;
      return typeof params.time_cost_min === "number";
    });
    if (hasTimeCostInPlan && !hasAdvanceTime && !hasInlineTimeCost) {
      throw new TurnRuleError(
        "plan_mismatch",
        "plan.resources_to_spend includes time but runtime has no time-cost action",
      );
    }
  }

  private enforceEventTrigger(
    runtimeActions: Array<Record<string, unknown>>,
    turnId: string,
  ): void {
    for (const item of runtimeActions) {
      if (item.action !== "createEvent") {
        continue;
      }
      const params = (item.params ?? {}) as Record<string, unknown>;
      if (typeof params.origin_trigger_id !== "string" || params.origin_trigger_id.length === 0) {
        throw new TurnRuleError(
          "event_trigger_missing",
          "createEvent requires origin_trigger_id",
        );
      }
      if (
        typeof params.created_at_turn !== "string" ||
        String(params.created_at_turn).length === 0
      ) {
        throw new TurnRuleError(
          "event_created_turn_missing",
          "createEvent requires created_at_turn",
        );
      }
      if (params.created_at_turn !== turnId) {
        throw new TurnRuleError(
          "event_created_turn_mismatch",
          "createEvent.created_at_turn must match current turn_id",
        );
      }
    }
  }
}
