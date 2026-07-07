import type {
  AiCircuitBreakerPolicyV1,
  AiCircuitBreakerSnapshotV1,
  AiCircuitStateV1,
  AiRoleV1
} from "./types";

function key(role: AiRoleV1, routeId: string): string {
  return `${role}::${routeId}`;
}

export class AiCircuitBreakerV1 {
  private readonly snapshots = new Map<string, AiCircuitBreakerSnapshotV1>();

  constructor(private readonly policy: AiCircuitBreakerPolicyV1) {
    if (policy.schemaVersion !== 1 || policy.failureThreshold < 1 || policy.halfOpenProbeLimit < 1) {
      throw new Error("Invalid AiCircuitBreakerPolicyV1.");
    }
  }

  getSnapshot(role: AiRoleV1, routeId: string): AiCircuitBreakerSnapshotV1 {
    const id = key(role, routeId);
    const existing = this.snapshots.get(id);
    if (existing) return { ...existing };
    return {
      schemaVersion: 1,
      role,
      routeId,
      state: "CLOSED",
      consecutiveFailures: 0,
      halfOpenProbesUsed: 0
    };
  }

  canAttempt(role: AiRoleV1, routeId: string): boolean {
    const snapshot = this.getSnapshot(role, routeId);
    if (snapshot.state === "CLOSED") return true;
    if (snapshot.state === "OPEN") return false;
    return snapshot.halfOpenProbesUsed < this.policy.halfOpenProbeLimit;
  }

  recordSuccess(role: AiRoleV1, routeId: string): AiCircuitBreakerSnapshotV1 {
    const snapshot: AiCircuitBreakerSnapshotV1 = {
      schemaVersion: 1,
      role,
      routeId,
      state: "CLOSED",
      consecutiveFailures: 0,
      halfOpenProbesUsed: 0
    };
    this.snapshots.set(key(role, routeId), snapshot);
    return { ...snapshot };
  }

  recordFailure(role: AiRoleV1, routeId: string): AiCircuitBreakerSnapshotV1 {
    const current = this.getSnapshot(role, routeId);
    const consecutiveFailures = current.consecutiveFailures + 1;
    const state: AiCircuitStateV1 = consecutiveFailures >= this.policy.failureThreshold ? "OPEN" : current.state;
    const snapshot: AiCircuitBreakerSnapshotV1 = {
      ...current,
      state,
      consecutiveFailures
    };
    this.snapshots.set(key(role, routeId), snapshot);
    return { ...snapshot };
  }

  moveToHalfOpen(role: AiRoleV1, routeId: string): AiCircuitBreakerSnapshotV1 {
    const current = this.getSnapshot(role, routeId);
    const snapshot: AiCircuitBreakerSnapshotV1 = {
      ...current,
      state: "HALF_OPEN",
      halfOpenProbesUsed: 0
    };
    this.snapshots.set(key(role, routeId), snapshot);
    return { ...snapshot };
  }

  recordHalfOpenProbe(role: AiRoleV1, routeId: string): AiCircuitBreakerSnapshotV1 {
    const current = this.getSnapshot(role, routeId);
    if (current.state !== "HALF_OPEN") return { ...current };
    const snapshot: AiCircuitBreakerSnapshotV1 = {
      ...current,
      halfOpenProbesUsed: current.halfOpenProbesUsed + 1
    };
    this.snapshots.set(key(role, routeId), snapshot);
    return { ...snapshot };
  }
}
