import type { AiModelRouteV1 } from "./types";

export const MAX_BILLABLE_AI_CALLS_PER_NARRATIVE_TURN_V1 = 3 as const;

export interface AiCallBudgetSnapshotV1 {
  schemaVersion: 1;
  operationId: string;
  maxBillableCalls: number;
  consumedAttemptIds: string[];
  deniedAttemptIds: string[];
  remainingBillableCalls: number;
  status: "ACTIVE" | "CLOSED";
}

interface MutableAiCallBudgetV1 {
  operationId: string;
  maxBillableCalls: number;
  consumedAttemptIds: string[];
  deniedAttemptIds: string[];
  status: "ACTIVE" | "CLOSED";
}

const activeBudgets = new Map<string, MutableAiCallBudgetV1>();

export function activateAiCallBudgetV1(
  operationId: string,
  maxBillableCalls = MAX_BILLABLE_AI_CALLS_PER_NARRATIVE_TURN_V1
): AiCallBudgetSnapshotV1 {
  const existing = activeBudgets.get(operationId);
  if (existing !== undefined) return snapshot(existing);
  const budget: MutableAiCallBudgetV1 = {
    operationId,
    maxBillableCalls,
    consumedAttemptIds: [],
    deniedAttemptIds: [],
    status: "ACTIVE"
  };
  activeBudgets.set(operationId, budget);
  return snapshot(budget);
}

export function consumeAiCallBudgetV1(input: {
  operationId: string;
  attemptId: string;
  route: AiModelRouteV1;
}): { allowed: true; snapshot: AiCallBudgetSnapshotV1 } | { allowed: false; snapshot: AiCallBudgetSnapshotV1 } {
  const budget = activeBudgets.get(input.operationId);
  if (budget === undefined || !isBillableRouteV1(input.route)) {
    return {
      allowed: true,
      snapshot: budget === undefined
        ? unrestrictedSnapshot(input.operationId)
        : snapshot(budget)
    };
  }
  if (budget.consumedAttemptIds.includes(input.attemptId)) {
    return { allowed: true, snapshot: snapshot(budget) };
  }
  if (
    budget.status !== "ACTIVE" ||
    budget.consumedAttemptIds.length >= budget.maxBillableCalls
  ) {
    if (!budget.deniedAttemptIds.includes(input.attemptId)) budget.deniedAttemptIds.push(input.attemptId);
    return { allowed: false, snapshot: snapshot(budget) };
  }
  budget.consumedAttemptIds.push(input.attemptId);
  return { allowed: true, snapshot: snapshot(budget) };
}

export function inspectAiCallBudgetV1(operationId: string): AiCallBudgetSnapshotV1 | null {
  const budget = activeBudgets.get(operationId);
  return budget === undefined ? null : snapshot(budget);
}

export function closeAiCallBudgetV1(operationId: string): AiCallBudgetSnapshotV1 | null {
  const budget = activeBudgets.get(operationId);
  if (budget === undefined) return null;
  budget.status = "CLOSED";
  return snapshot(budget);
}

/** Test-only cleanup. Runtime operation identifiers are unique and are never reset. */
export function clearAiCallBudgetForTestV1(operationId: string): void {
  activeBudgets.delete(operationId);
}

export function isBillableRouteV1(route: AiModelRouteV1): boolean {
  return route.providerKind === "REMOTE_PROVIDER" || route.providerId === "server-openai-route";
}

function snapshot(budget: MutableAiCallBudgetV1): AiCallBudgetSnapshotV1 {
  return {
    schemaVersion: 1,
    operationId: budget.operationId,
    maxBillableCalls: budget.maxBillableCalls,
    consumedAttemptIds: [...budget.consumedAttemptIds],
    deniedAttemptIds: [...budget.deniedAttemptIds],
    remainingBillableCalls: Math.max(0, budget.maxBillableCalls - budget.consumedAttemptIds.length),
    status: budget.status
  };
}

function unrestrictedSnapshot(operationId: string): AiCallBudgetSnapshotV1 {
  return {
    schemaVersion: 1,
    operationId,
    maxBillableCalls: Number.MAX_SAFE_INTEGER,
    consumedAttemptIds: [],
    deniedAttemptIds: [],
    remainingBillableCalls: Number.MAX_SAFE_INTEGER,
    status: "ACTIVE"
  };
}
