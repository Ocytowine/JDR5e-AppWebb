import { COMMAND_REGISTRY } from "./command_registry";
import {
  RuntimeAction,
  RuntimeContext,
  RuntimeExecutionError,
} from "./runtime_types";

export function executeRuntimeActions(
  state: Record<string, unknown>,
  runtimeActions: Array<Record<string, unknown>>,
  context: RuntimeContext = { turnId: "unknown-turn" },
): Record<string, unknown> {
  const nextState: Record<string, unknown> = JSON.parse(JSON.stringify(state));
  const commandLog = Array.isArray(nextState.runtime_command_log)
    ? [...(nextState.runtime_command_log as Array<Record<string, unknown>>)]
    : [];

  for (const rawItem of runtimeActions) {
    const item = rawItem as RuntimeAction;
    const actionName = typeof item.action === "string" ? item.action : "";
    const params =
      item.params && typeof item.params === "object"
        ? (item.params as Record<string, unknown>)
        : {};

    if (!actionName) {
      throw new RuntimeExecutionError(
        "invalid_action",
        "unknown",
        "runtime action name is missing",
      );
    }

    const handler = COMMAND_REGISTRY[actionName];
    if (!handler) {
      throw new RuntimeExecutionError(
        "unknown_command",
        actionName,
        `unknown runtime command: ${actionName}`,
      );
    }

    handler(nextState, params, context);
    commandLog.push({
      action: actionName,
      params,
      turn_id: context.turnId,
    });
  }

  nextState.runtime_command_log = commandLog;
  return nextState;
}
