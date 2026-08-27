export interface NarrativeSubmissionPayloadV1 {
  schemaVersion: 1;
  clientRequestId: string;
  rawInput: string;
}

export interface NarrativeSubmissionStorageV1 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredNarrativeSubmissionV1 {
  schemaVersion: 1;
  status: "ACTIVE" | "RETRYABLE";
  payload: NarrativeSubmissionPayloadV1;
}

export const NARRATIVE_PENDING_SUBMISSION_STORAGE_KEY_V1 =
  "jdr5e_narrative_pending_submission_v1";

export function createBrowserNarrativeSubmissionCoordinatorV1(
  createClientRequestId: () => string
): NarrativeSubmissionCoordinatorV1 {
  return new NarrativeSubmissionCoordinatorV1({
    storage: typeof window === "undefined" ? null : window.sessionStorage,
    createClientRequestId
  });
}

export class NarrativeSubmissionCoordinatorV1 {
  private inFlightRequestId: string | null = null;

  constructor(private readonly options: {
    storage: NarrativeSubmissionStorageV1 | null;
    createClientRequestId: () => string;
    storageKey?: string;
  }) {}

  acquire(rawInput: string): NarrativeSubmissionPayloadV1 | null {
    if (this.inFlightRequestId !== null) return null;
    const stored = this.readStored();
    if (stored?.status === "ACTIVE") return null;

    this.inFlightRequestId = "PREPARING";
    try {
      const payload = stored?.status === "RETRYABLE" && stored.payload.rawInput === rawInput
        ? stored.payload
        : {
            schemaVersion: 1 as const,
            clientRequestId: this.options.createClientRequestId(),
            rawInput
          };
      this.inFlightRequestId = payload.clientRequestId;
      this.writeStored({ schemaVersion: 1, status: "ACTIVE", payload });
      return payload;
    } catch (error) {
      this.inFlightRequestId = null;
      throw error;
    }
  }

  restoreForReplay(): NarrativeSubmissionPayloadV1 | null {
    if (this.inFlightRequestId !== null) return null;
    const stored = this.readStored();
    if (stored === null) return null;
    this.inFlightRequestId = stored.payload.clientRequestId;
    this.writeStored({ ...stored, status: "ACTIVE" });
    return stored.payload;
  }

  markRetryable(clientRequestId: string): void {
    if (this.inFlightRequestId !== clientRequestId) return;
    const stored = this.readStored();
    if (stored?.payload.clientRequestId === clientRequestId) {
      this.writeStored({ ...stored, status: "RETRYABLE" });
    }
    this.inFlightRequestId = null;
  }

  complete(clientRequestId: string): void {
    if (this.inFlightRequestId !== clientRequestId) return;
    const stored = this.readStored();
    if (stored?.payload.clientRequestId === clientRequestId) {
      this.removeStored();
    }
    this.inFlightRequestId = null;
  }

  private readStored(): StoredNarrativeSubmissionV1 | null {
    if (this.options.storage === null) return null;
    try {
      const serialized = this.options.storage.getItem(this.storageKey());
      if (serialized === null) return null;
      const candidate = JSON.parse(serialized) as Partial<StoredNarrativeSubmissionV1>;
      if (
        candidate.schemaVersion !== 1
        || (candidate.status !== "ACTIVE" && candidate.status !== "RETRYABLE")
        || candidate.payload?.schemaVersion !== 1
        || typeof candidate.payload.clientRequestId !== "string"
        || typeof candidate.payload.rawInput !== "string"
      ) {
        this.removeStored();
        return null;
      }
      return candidate as StoredNarrativeSubmissionV1;
    } catch {
      this.removeStored();
      return null;
    }
  }

  private writeStored(value: StoredNarrativeSubmissionV1): void {
    try {
      this.options.storage?.setItem(this.storageKey(), JSON.stringify(value));
    } catch {
      // The in-memory lock remains authoritative when browser storage is unavailable.
    }
  }

  private removeStored(): void {
    try {
      this.options.storage?.removeItem(this.storageKey());
    } catch {
      // Storage cleanup must never keep the UI locked.
    }
  }

  private storageKey(): string {
    return this.options.storageKey ?? NARRATIVE_PENDING_SUBMISSION_STORAGE_KEY_V1;
  }
}
