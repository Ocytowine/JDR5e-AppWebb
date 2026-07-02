import type { JsonObject, JsonValue } from "../contracts/types";

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function normalize(value: unknown, seen: WeakSet<object>): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Non-finite numbers are not JSON values.");
    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("Cyclic JSON value.");
    seen.add(value);
    const result = value.map(item => normalize(item, seen));
    seen.delete(value);
    return result;
  }

  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Only plain objects are accepted as JSON objects.");
    }
    if (seen.has(object)) throw new TypeError("Cyclic JSON value.");
    seen.add(object);

    const result: JsonObject = Object.create(null) as JsonObject;
    for (const key of Object.keys(object).sort()) {
      if (FORBIDDEN_KEYS.has(key)) throw new TypeError(`Forbidden JSON key: ${key}`);
      const child = object[key];
      if (child === undefined || typeof child === "function" || typeof child === "symbol" || typeof child === "bigint") {
        throw new TypeError(`Unsupported JSON value at key: ${key}`);
      }
      result[key] = normalize(child, seen);
    }
    seen.delete(object);
    return result;
  }

  throw new TypeError(`Unsupported JSON value: ${typeof value}`);
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(normalize(value, new WeakSet<object>()));
}

export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(canonicalizeJson(value)).byteLength;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

export async function computeRequestFingerprint(
  operationKind: string,
  requestPayloadSchemaVersion: number,
  requestPayload: JsonObject
): Promise<string> {
  const canonical = canonicalizeJson({
    operationKind,
    requestPayload,
    requestPayloadSchemaVersion
  });
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical)
  );
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}
