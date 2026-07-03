function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)])
    );
  }
  return value;
}

function display(value: unknown): string {
  try {
    return JSON.stringify(normalize(value));
  } catch {
    return String(value);
  }
}

function fail(message: string): never {
  throw new Error(message);
}

interface Assertions {
  fail(message: string): never;
  equal(actual: unknown, expected: unknown, message?: string): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
  ok(value: unknown, message?: string): asserts value;
}

export const assert: Assertions = {
  fail,
  equal(actual: unknown, expected: unknown, message?: string): void {
    if (!Object.is(actual, expected)) {
      fail(message ?? `Expected ${display(expected)}, received ${display(actual)}.`);
    }
  },
  deepEqual(actual: unknown, expected: unknown, message?: string): void {
    const actualJson = display(actual);
    const expectedJson = display(expected);
    if (actualJson !== expectedJson) {
      fail(message ?? `Expected ${expectedJson}, received ${actualJson}.`);
    }
  },
  ok(value: unknown, message?: string): asserts value {
    if (!value) fail(message ?? `Expected a truthy value, received ${display(value)}.`);
  }
};
