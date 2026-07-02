const id = { type: "string", pattern: "^[a-z][a-z0-9._:-]{2,127}$" } as const;
const namespaced = {
  type: "string",
  pattern: "^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)+$"
} as const;
const revision = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER } as const;
const positiveInteger = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER } as const;
const utc = {
  type: "string",
  pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$"
} as const;
const jsonObject = { type: "object", additionalProperties: true } as const;
const nullableId = { anyOf: [id, { type: "null" }] } as const;
const nullableUtc = { anyOf: [utc, { type: "null" }] } as const;

const coreError = {
  type: "object",
  additionalProperties: false,
  required: ["code", "category", "retry", "messageKey", "details", "incidentId"],
  properties: {
    code: {
      type: "string",
      enum: [
        "NOT_FOUND",
        "ALREADY_EXISTS",
        "VALIDATION_FAILED",
        "INVALID_TRANSITION",
        "CAMPAIGN_BUSY",
        "CAMPAIGN_READ_ONLY",
        "STALE_VERSION",
        "STALE_FENCING_TOKEN",
        "IDEMPOTENCY_CONFLICT",
        "PERSISTENCE_FAILURE",
        "CAMPAIGN_INTEGRITY_FAILURE"
      ]
    },
    category: { type: "string", enum: ["VALIDATION", "CONCURRENCY", "PERSISTENCE", "INTEGRITY"] },
    retry: { type: "string", enum: ["NEVER", "SAME_REQUEST", "AFTER_REFRESH"] },
    messageKey: namespaced,
    details: jsonObject,
    incidentId: nullableId
  }
} as const;

export const campaignWriteBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "incidentId"],
  properties: {
    code: { type: "string", enum: ["CAMPAIGN_INTEGRITY_FAILURE", "MANUAL_LOCK"] },
    incidentId: nullableId
  }
} as const;

export const campaignDependenciesSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "contentPackageId",
    "contentPackageVersion",
    "rulesetId",
    "rulesetVersion",
    "calendarId",
    "calendarVersion"
  ],
  properties: {
    contentPackageId: namespaced,
    contentPackageVersion: positiveInteger,
    rulesetId: namespaced,
    rulesetVersion: positiveInteger,
    calendarId: namespaced,
    calendarVersion: positiveInteger
  }
} as const;

export const campaignRecordSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "campaignId",
    "campaignRevision",
    "status",
    "clockAggregateId",
    "dependencies",
    "writeBlock",
    "lastCommitId",
    "createdAt",
    "updatedAt"
  ],
  properties: {
    schemaVersion: { type: "integer", const: 1 },
    campaignId: id,
    campaignRevision: revision,
    status: { type: "string", enum: ["ACTIVE", "READ_ONLY"] },
    clockAggregateId: id,
    dependencies: campaignDependenciesSchema,
    writeBlock: { anyOf: [campaignWriteBlockSchema, { type: "null" }] },
    lastCommitId: nullableId,
    createdAt: utc,
    updatedAt: utc
  }
} as const;

export const clockPayloadSchema = {
  type: "object",
  additionalProperties: false,
  required: ["elapsedGameSeconds", "calendarId", "calendarVersion"],
  properties: {
    elapsedGameSeconds: revision,
    calendarId: namespaced,
    calendarVersion: positiveInteger
  }
} as const;

export const aggregateRecordSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "campaignId",
    "aggregateType",
    "aggregateId",
    "aggregateRevision",
    "payloadSchemaVersion",
    "payload",
    "updatedByCommitId"
  ],
  properties: {
    schemaVersion: { type: "integer", const: 1 },
    campaignId: id,
    aggregateType: namespaced,
    aggregateId: id,
    aggregateRevision: revision,
    payloadSchemaVersion: positiveInteger,
    payload: jsonObject,
    updatedByCommitId: nullableId
  }
} as const;

export const operationRecordSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "operationId",
    "campaignId",
    "clientRequestId",
    "idempotencyKey",
    "requestFingerprint",
    "operationKind",
    "requestPayloadSchemaVersion",
    "requestPayload",
    "phase",
    "observedCampaignRevision",
    "commitId",
    "completionMode",
    "resultPayloadSchemaVersion",
    "resultPayload",
    "failure",
    "receivedAt",
    "updatedAt"
  ],
  properties: {
    schemaVersion: { type: "integer", const: 1 },
    operationId: id,
    campaignId: id,
    clientRequestId: id,
    idempotencyKey: id,
    requestFingerprint: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    operationKind: namespaced,
    requestPayloadSchemaVersion: positiveInteger,
    requestPayload: jsonObject,
    phase: {
      type: "string",
      enum: [
        "RECEIVED",
        "PREPARING",
        "READY_TO_COMMIT",
        "COMMITTED_PENDING_RENDER",
        "COMPLETED",
        "SUSPENDED",
        "FAILED",
        "STALE",
        "CANCELLED"
      ]
    },
    observedCampaignRevision: revision,
    commitId: nullableId,
    completionMode: {
      anyOf: [
        {
          type: "string",
          enum: ["COMMITTED_RENDERED", "COMMITTED_DEGRADED", "NO_COMMIT_RESPONSE"]
        },
        { type: "null" }
      ]
    },
    resultPayloadSchemaVersion: { anyOf: [positiveInteger, { type: "null" }] },
    resultPayload: { anyOf: [jsonObject, { type: "null" }] },
    failure: { anyOf: [coreError, { type: "null" }] },
    receivedAt: utc,
    updatedAt: utc
  }
} as const;

export const commandTargetSchema = {
  type: "object",
  additionalProperties: false,
  required: ["aggregateType", "aggregateId", "expectedAggregateRevision"],
  properties: {
    aggregateType: namespaced,
    aggregateId: id,
    expectedAggregateRevision: { anyOf: [revision, { type: "null" }] }
  }
} as const;

const commandBaseProperties = {
  schemaVersion: { type: "integer", const: 1 },
  contractId: namespaced,
  contractVersion: positiveInteger,
  commandId: id,
  campaignId: id,
  operationId: id,
  commandType: namespaced,
  target: commandTargetSchema,
  payloadSchemaVersion: positiveInteger,
  payload: jsonObject,
  acceptedAtGameSecond: revision
} as const;

const commandDraftRequired = [
  "schemaVersion",
  "contractId",
  "contractVersion",
  "commandId",
  "campaignId",
  "operationId",
  "commandType",
  "target",
  "payloadSchemaVersion",
  "payload",
  "acceptedAtGameSecond"
] as const;

export const acceptedCommandDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: commandDraftRequired,
  properties: commandBaseProperties
} as const;

export const acceptedCommandRecordSchema = {
  type: "object",
  additionalProperties: false,
  required: [...commandDraftRequired, "commitId"],
  properties: { ...commandBaseProperties, commitId: id }
} as const;

export const eventAggregateRefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["aggregateType", "aggregateId", "aggregateRevision"],
  properties: {
    aggregateType: namespaced,
    aggregateId: id,
    aggregateRevision: revision
  }
} as const;

export const eventCausationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "id"],
  properties: {
    kind: { type: "string", enum: ["COMMAND", "EVENT", "OPERATION"] },
    id
  }
} as const;

export const eventVisibilitySchema = {
  type: "object",
  additionalProperties: false,
  required: ["scope", "actorIds"],
  properties: {
    scope: {
      type: "string",
      enum: ["SYSTEM", "MJ_PRIVATE", "PLAYER_VISIBLE", "ACTOR_SCOPED"]
    },
    actorIds: { type: "array", items: id }
  }
} as const;

const eventBaseProperties = {
  schemaVersion: { type: "integer", const: 1 },
  eventId: id,
  campaignId: id,
  operationId: id,
  eventType: namespaced,
  origin: {
    type: "string",
    enum: [
      "PLAYER_INTENT",
      "RULE",
      "WORLD_SIMULATION",
      "AI_PROPOSAL",
      "PROCESS",
      "SCHEDULED_EFFECT",
      "SYSTEM"
    ]
  },
  causation: eventCausationSchema,
  aggregateRefs: { type: "array", minItems: 1, items: eventAggregateRefSchema },
  visibility: eventVisibilitySchema,
  occurredAtGameSecond: revision,
  payloadSchemaVersion: positiveInteger,
  payload: jsonObject
} as const;

const eventDraftRequired = [
  "schemaVersion",
  "eventId",
  "campaignId",
  "operationId",
  "eventType",
  "origin",
  "causation",
  "aggregateRefs",
  "visibility",
  "occurredAtGameSecond",
  "payloadSchemaVersion",
  "payload"
] as const;

export const eventDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: eventDraftRequired,
  properties: eventBaseProperties
} as const;

export const eventRecordSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...eventDraftRequired,
    "commitId",
    "recordedAt",
    "commitSequence",
    "eventSequence"
  ],
  properties: {
    ...eventBaseProperties,
    commitId: id,
    recordedAt: utc,
    commitSequence: positiveInteger,
    eventSequence: revision
  }
} as const;

const outboxDraftProperties = {
  schemaVersion: { type: "integer", const: 1 },
  taskId: id,
  taskType: namespaced,
  sourceEventIds: { type: "array", minItems: 1, items: id },
  payloadSchemaVersion: positiveInteger,
  payload: jsonObject
} as const;

const outboxDraftRequired = [
  "schemaVersion",
  "taskId",
  "taskType",
  "sourceEventIds",
  "payloadSchemaVersion",
  "payload"
] as const;

export const outboxTaskDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: outboxDraftRequired,
  properties: outboxDraftProperties
} as const;

export const outboxTaskRecordSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...outboxDraftRequired,
    "campaignId",
    "commitId",
    "status",
    "attemptCount",
    "lockedBy",
    "leaseExpiresAt",
    "nextAttemptAt",
    "lastError",
    "createdAt",
    "updatedAt"
  ],
  properties: {
    ...outboxDraftProperties,
    campaignId: id,
    commitId: id,
    status: {
      type: "string",
      enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED_RETRYABLE", "FAILED_FINAL"]
    },
    attemptCount: revision,
    lockedBy: nullableId,
    leaseExpiresAt: nullableUtc,
    nextAttemptAt: nullableUtc,
    lastError: { anyOf: [coreError, { type: "null" }] },
    createdAt: utc,
    updatedAt: utc
  }
} as const;

const writerLease = {
  type: "object",
  additionalProperties: false,
  required: ["campaignId", "writerId", "fencingToken", "acquiredAt", "expiresAt"],
  properties: {
    campaignId: id,
    writerId: id,
    fencingToken: positiveInteger,
    acquiredAt: utc,
    expiresAt: utc
  }
} as const;

export const aggregateWriteSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "aggregateType",
    "aggregateId",
    "expectedAggregateRevision",
    "payloadSchemaVersion",
    "payload"
  ],
  properties: {
    aggregateType: namespaced,
    aggregateId: id,
    expectedAggregateRevision: { anyOf: [revision, { type: "null" }] },
    payloadSchemaVersion: positiveInteger,
    payload: jsonObject
  }
} as const;

export const commitAggregateWriteSchema = {
  type: "object",
  additionalProperties: false,
  required: ["aggregateType", "aggregateId", "previousRevision", "aggregateRevision"],
  properties: {
    aggregateType: namespaced,
    aggregateId: id,
    previousRevision: { anyOf: [revision, { type: "null" }] },
    aggregateRevision: revision
  }
} as const;

export const commitRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "campaignId",
    "operationId",
    "commitId",
    "idempotencyKey",
    "requestFingerprint",
    "expectedCampaignRevision",
    "writerLease",
    "acceptedCommands",
    "aggregateWrites",
    "events",
    "outboxTasks"
  ],
  properties: {
    campaignId: id,
    operationId: id,
    commitId: id,
    idempotencyKey: id,
    requestFingerprint: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    expectedCampaignRevision: revision,
    writerLease,
    acceptedCommands: { type: "array", maxItems: 1024, items: acceptedCommandDraftSchema },
    aggregateWrites: {
      type: "array",
      minItems: 1,
      maxItems: 1024,
      items: aggregateWriteSchema
    },
    events: { type: "array", minItems: 1, maxItems: 1024, items: eventDraftSchema },
    outboxTasks: { type: "array", maxItems: 1024, items: outboxTaskDraftSchema }
  }
} as const;

export const commitRecordSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "commitId",
    "campaignId",
    "operationId",
    "idempotencyKey",
    "requestFingerprint",
    "previousCampaignRevision",
    "campaignRevision",
    "commitSequence",
    "commandIds",
    "eventIds",
    "aggregateWrites",
    "outboxTaskIds",
    "committedAt"
  ],
  properties: {
    schemaVersion: { type: "integer", const: 1 },
    commitId: id,
    campaignId: id,
    operationId: id,
    idempotencyKey: id,
    requestFingerprint: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    previousCampaignRevision: revision,
    campaignRevision: revision,
    commitSequence: positiveInteger,
    commandIds: { type: "array", items: id },
    eventIds: { type: "array", minItems: 1, items: id },
    aggregateWrites: {
      type: "array",
      minItems: 1,
      items: commitAggregateWriteSchema
    },
    outboxTaskIds: { type: "array", items: id },
    committedAt: utc
  }
} as const;

export const writerLeaseSchema = writerLease;
export const coreErrorSchema = coreError;
