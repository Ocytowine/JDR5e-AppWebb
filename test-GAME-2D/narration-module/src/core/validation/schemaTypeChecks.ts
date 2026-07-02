import type {
  AcceptedCommandDraft,
  AcceptedCommandRecord,
  AggregateRecord,
  AggregateWrite,
  CampaignDependencies,
  CampaignRecord,
  CampaignWriteBlock,
  CausationKind,
  CommandTarget,
  CommitAggregateWrite,
  CommitRecord,
  CommitRequest,
  CompletionMode,
  CoreError,
  CoreErrorCategory,
  CoreErrorCode,
  EventAggregateRef,
  EventCausation,
  EventDraft,
  EventOrigin,
  EventRecord,
  EventVisibility,
  OperationPhase,
  OperationRecord,
  OutboxStatus,
  OutboxTaskDraft,
  OutboxTaskRecord,
  RetryPolicy,
  WriterLease
} from "../contracts/types";
import {
  acceptedCommandDraftSchema,
  acceptedCommandRecordSchema,
  aggregateRecordSchema,
  aggregateWriteSchema,
  campaignDependenciesSchema,
  campaignRecordSchema,
  campaignWriteBlockSchema,
  clockPayloadSchema,
  commandTargetSchema,
  commitAggregateWriteSchema,
  commitRecordSchema,
  commitRequestSchema,
  coreErrorSchema,
  eventAggregateRefSchema,
  eventCausationSchema,
  eventDraftSchema,
  eventRecordSchema,
  eventVisibilitySchema,
  operationRecordSchema,
  outboxTaskDraftSchema,
  outboxTaskRecordSchema,
  writerLeaseSchema
} from "./schemas";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;

type Assert<Condition extends true> = Condition;
type StringKeys<Value> = Extract<keyof Value, string>;
type RequiredKeys<Value> = {
  [Key in keyof Value]-?: object extends Pick<Value, Key> ? never : Key;
}[keyof Value];
type SchemaPropertyKeys<Schema> = Schema extends { properties: infer Properties }
  ? Extract<keyof Properties, string>
  : never;
type SchemaRequiredKeys<Schema> = Schema extends { required: readonly (infer Key)[] }
  ? Extract<Key, string>
  : never;
type ObjectContractMatches<Value, Schema> = Equal<
  StringKeys<Value>,
  SchemaPropertyKeys<Schema>
> extends true
  ? Equal<Extract<RequiredKeys<Value>, string>, SchemaRequiredKeys<Schema>>
  : false;
type EnumValues<Schema> = Schema extends { enum: readonly (infer Value)[] } ? Value : never;

type _Campaign = Assert<ObjectContractMatches<CampaignRecord, typeof campaignRecordSchema>>;
type _CampaignDependencies = Assert<
  ObjectContractMatches<CampaignDependencies, typeof campaignDependenciesSchema>
>;
type _CampaignWriteBlock = Assert<
  ObjectContractMatches<CampaignWriteBlock, typeof campaignWriteBlockSchema>
>;
type _Aggregate = Assert<ObjectContractMatches<AggregateRecord, typeof aggregateRecordSchema>>;
type _Operation = Assert<ObjectContractMatches<OperationRecord, typeof operationRecordSchema>>;
type _CommandTarget = Assert<ObjectContractMatches<CommandTarget, typeof commandTargetSchema>>;
type _CommandDraft = Assert<
  ObjectContractMatches<AcceptedCommandDraft, typeof acceptedCommandDraftSchema>
>;
type _CommandRecord = Assert<
  ObjectContractMatches<AcceptedCommandRecord, typeof acceptedCommandRecordSchema>
>;
type _EventCausation = Assert<
  ObjectContractMatches<EventCausation, typeof eventCausationSchema>
>;
type _EventAggregateRef = Assert<
  ObjectContractMatches<EventAggregateRef, typeof eventAggregateRefSchema>
>;
type _EventVisibility = Assert<
  ObjectContractMatches<EventVisibility, typeof eventVisibilitySchema>
>;
type _EventDraft = Assert<ObjectContractMatches<EventDraft, typeof eventDraftSchema>>;
type _EventRecord = Assert<ObjectContractMatches<EventRecord, typeof eventRecordSchema>>;
type _OutboxDraft = Assert<
  ObjectContractMatches<OutboxTaskDraft, typeof outboxTaskDraftSchema>
>;
type _OutboxRecord = Assert<
  ObjectContractMatches<OutboxTaskRecord, typeof outboxTaskRecordSchema>
>;
type _AggregateWrite = Assert<ObjectContractMatches<AggregateWrite, typeof aggregateWriteSchema>>;
type _CommitAggregateWrite = Assert<
  ObjectContractMatches<CommitAggregateWrite, typeof commitAggregateWriteSchema>
>;
type _CommitRequest = Assert<ObjectContractMatches<CommitRequest, typeof commitRequestSchema>>;
type _CommitRecord = Assert<ObjectContractMatches<CommitRecord, typeof commitRecordSchema>>;
type _WriterLease = Assert<ObjectContractMatches<WriterLease, typeof writerLeaseSchema>>;
type _CoreError = Assert<ObjectContractMatches<CoreError, typeof coreErrorSchema>>;

type _ClockFields = Assert<
  Equal<
    SchemaPropertyKeys<typeof clockPayloadSchema>,
    "elapsedGameSeconds" | "calendarId" | "calendarVersion"
  >
>;
type _CampaignStatus = Assert<
  Equal<EnumValues<typeof campaignRecordSchema.properties.status>, CampaignRecord["status"]>
>;
type _OperationPhases = Assert<
  Equal<EnumValues<typeof operationRecordSchema.properties.phase>, OperationPhase>
>;
type _CompletionModes = Assert<
  Equal<
    EnumValues<(typeof operationRecordSchema.properties.completionMode.anyOf)[0]>,
    CompletionMode
  >
>;
type _EventOrigins = Assert<
  Equal<EnumValues<typeof eventDraftSchema.properties.origin>, EventOrigin>
>;
type _CausationKinds = Assert<
  Equal<EnumValues<typeof eventCausationSchema.properties.kind>, CausationKind>
>;
type _VisibilityScopes = Assert<
  Equal<
    EnumValues<typeof eventVisibilitySchema.properties.scope>,
    EventVisibility["scope"]
  >
>;
type _OutboxStatuses = Assert<
  Equal<EnumValues<typeof outboxTaskRecordSchema.properties.status>, OutboxStatus>
>;
type _ErrorCodes = Assert<
  Equal<EnumValues<typeof coreErrorSchema.properties.code>, CoreErrorCode>
>;
type _ErrorCategories = Assert<
  Equal<EnumValues<typeof coreErrorSchema.properties.category>, CoreErrorCategory>
>;
type _RetryPolicies = Assert<
  Equal<EnumValues<typeof coreErrorSchema.properties.retry>, RetryPolicy>
>;

export const SCHEMA_TYPE_CHECK_COUNT = 31 as const;
