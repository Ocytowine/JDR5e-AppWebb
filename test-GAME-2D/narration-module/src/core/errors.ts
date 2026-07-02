import type {
  CoreError,
  CoreErrorCategory,
  CoreErrorCode,
  IncidentId,
  JsonObject,
  Result,
  RetryPolicy
} from "./contracts/types";

const ERROR_DEFAULTS: Record<CoreErrorCode, { category: CoreErrorCategory; retry: RetryPolicy }> = {
  NOT_FOUND: { category: "VALIDATION", retry: "AFTER_REFRESH" },
  ALREADY_EXISTS: { category: "VALIDATION", retry: "NEVER" },
  VALIDATION_FAILED: { category: "VALIDATION", retry: "NEVER" },
  INVALID_TRANSITION: { category: "VALIDATION", retry: "AFTER_REFRESH" },
  CAMPAIGN_BUSY: { category: "CONCURRENCY", retry: "SAME_REQUEST" },
  CAMPAIGN_READ_ONLY: { category: "INTEGRITY", retry: "NEVER" },
  STALE_VERSION: { category: "CONCURRENCY", retry: "AFTER_REFRESH" },
  STALE_FENCING_TOKEN: { category: "CONCURRENCY", retry: "AFTER_REFRESH" },
  IDEMPOTENCY_CONFLICT: { category: "INTEGRITY", retry: "NEVER" },
  PERSISTENCE_FAILURE: { category: "PERSISTENCE", retry: "SAME_REQUEST" },
  CAMPAIGN_INTEGRITY_FAILURE: { category: "INTEGRITY", retry: "NEVER" }
};

export function coreError(
  code: CoreErrorCode,
  messageKey: string,
  details: JsonObject = {},
  incidentId: IncidentId | null = null,
  override?: Partial<Pick<CoreError, "category" | "retry">>
): CoreError {
  const defaults = ERROR_DEFAULTS[code];
  return {
    code,
    category: override?.category ?? defaults.category,
    retry: override?.retry ?? defaults.retry,
    messageKey,
    details,
    incidentId
  };
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(error: CoreError): Result<T> {
  return { ok: false, error };
}
