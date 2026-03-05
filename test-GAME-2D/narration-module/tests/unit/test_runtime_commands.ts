import { executeRuntimeActions } from "../../src/adapters/runtime/runtime_stub";
import { RuntimeExecutionError } from "../../src/adapters/runtime/runtime_types";

function assertTrue(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function expectError(
  fn: () => void,
  expectedCode: string,
  message: string,
): void {
  let caught = false;
  try {
    fn();
  } catch (error) {
    caught = true;
    assertTrue(error instanceof RuntimeExecutionError, `${message}: expected RuntimeExecutionError`);
    assertTrue(
      (error as RuntimeExecutionError).code === expectedCode,
      `${message}: expected code ${expectedCode}`,
    );
  }
  assertTrue(caught, `${message}: expected error`);
}

function testMoveLocalAndTime(): void {
  const after = executeRuntimeActions(
    { location_id: "a", clock_min: 10 },
    [{ action: "moveLocal", params: { destination_id: "b", time_cost_min: 2 } }],
    { turnId: "unit-0001" },
  );
  assertTrue(after.location_id === "b", "moveLocal should update location_id");
  assertTrue(after.clock_min === 12, "moveLocal should increase clock_min");
}

function testSetFlagAndJournal(): void {
  const after = executeRuntimeActions(
    { world_flags: [], journal: [] },
    [
      { action: "setFlag", params: { flag_id: "x", value: true } },
      { action: "addJournalEntry", params: { entry_type: "lead", payload: { a: 1 } } },
    ],
    { turnId: "unit-0002" },
  );
  const flags = Array.isArray(after.world_flags) ? (after.world_flags as string[]) : [];
  assertTrue(flags.includes("x"), "setFlag should add world flag");
  const journal = Array.isArray(after.journal) ? after.journal : [];
  assertTrue(journal.length === 1, "addJournalEntry should append one entry");
}

function testRequestCheck(): void {
  const after = executeRuntimeActions(
    {},
    [
      {
        action: "requestCheck",
        params: { skill_id: "stealth", difficulty: 15, reason: "test" },
      },
    ],
    { turnId: "unit-0003" },
  );
  const checks = Array.isArray(after.pending_checks) ? after.pending_checks : [];
  assertTrue(checks.length === 1, "requestCheck should append one pending check");
}

function testCreateEvent(): void {
  const after = executeRuntimeActions(
    { events: [] },
    [
      {
        action: "createEvent",
        params: {
          event_id: "evt-01",
          origin_trigger_id: "trigger-01",
          created_at_turn: "unit-0004",
          final: { truth: "ok" },
        },
      },
    ],
    { turnId: "unit-0004" },
  );
  const events = Array.isArray(after.events) ? (after.events as Array<Record<string, unknown>>) : [];
  assertTrue(events.length === 1, "createEvent should append one event");
  assertTrue(events[0].event_id === "evt-01", "createEvent should set event_id");
  assertTrue(
    Array.isArray(events[0].lifecycle_history),
    "createEvent should initialize lifecycle_history",
  );
}

function testEventFragmentsLifecycleCommands(): void {
  const after = executeRuntimeActions(
    { events: [] },
    [
      {
        action: "createEvent",
        params: {
          event_id: "evt-02",
          origin_trigger_id: "trigger-02",
          created_at_turn: "unit-0010",
          final: { culprit_id: "npc-1", route: "east" },
        },
      },
      {
        action: "addEventFragment",
        params: {
          event_id: "evt-02",
          fragment_id: "frag-02",
          kind: "evolutif",
          payload: { seen: "shadow" },
          final_refs: ["route"],
          turn_id: "unit-0011",
        },
      },
      {
        action: "patchEvolutiveFragment",
        params: {
          event_id: "evt-02",
          fragment_id: "frag-02",
          patch: { seen: "shadow_blue_cloak" },
          turn_id: "unit-0012",
        },
      },
      {
        action: "transitionEventLifecycle",
        params: {
          event_id: "evt-02",
          next_state: "pertinent",
          turn_id: "unit-0013",
          reason: "out_of_scene",
        },
      },
      {
        action: "transitionFragmentLifecycle",
        params: {
          event_id: "evt-02",
          fragment_id: "frag-02",
          next_state: "pertinent",
          turn_id: "unit-0013",
          reason: "still_relevant",
        },
      },
    ],
    { turnId: "unit-0010" },
  );

  const events = Array.isArray(after.events)
    ? (after.events as Array<Record<string, unknown>>)
    : [];
  assertTrue(events.length === 1, "expected one event");
  assertTrue(events[0].status === "pertinent", "event status should be pertinent");
  const fragments = Array.isArray(events[0].fragments)
    ? (events[0].fragments as Array<Record<string, unknown>>)
    : [];
  assertTrue(fragments.length === 1, "expected one fragment");
  assertTrue(fragments[0].status === "pertinent", "fragment status should be pertinent");
  assertTrue(
    (fragments[0].payload as Record<string, unknown>).seen === "shadow_blue_cloak",
    "fragment patch should be applied",
  );
}

function testUnknownCommandFails(): void {
  expectError(
    () =>
      executeRuntimeActions(
        {},
        [{ action: "doesNotExist", params: {} }],
        { turnId: "unit-0005" },
      ),
    "unknown_command",
    "unknown command",
  );
}

function testInvalidParamsFail(): void {
  expectError(
    () =>
      executeRuntimeActions(
        {},
        [{ action: "enterLocation", params: { bad: "x" } }],
        { turnId: "unit-0006" },
      ),
    "invalid_params",
    "invalid params",
  );
}

function main(): number {
  testMoveLocalAndTime();
  testSetFlagAndJournal();
  testRequestCheck();
  testCreateEvent();
  testEventFragmentsLifecycleCommands();
  testUnknownCommandFails();
  testInvalidParamsFail();
  console.log("[PASS] unit test_runtime_commands");
  return 0;
}

process.exit(main());
