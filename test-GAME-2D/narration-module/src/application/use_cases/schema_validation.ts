import fs from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020";
import type { ValidateFunction } from "ajv";

export class SchemaValidationError extends Error {
  public readonly code: string;
  public readonly details: string[];

  constructor(code: string, message: string, details: string[] = []) {
    super(message);
    this.name = "SchemaValidationError";
    this.code = code;
    this.details = details;
  }
}

type SchemaPair = {
  inputValidate: ValidateFunction;
  outputValidate: ValidateFunction;
};

let cached: SchemaPair | null = null;

function buildValidators(): SchemaPair {
  const moduleRoot = path.resolve(__dirname, "../../../..");
  const inputSchemaPath = path.join(
    moduleRoot,
    "schemas",
    "input",
    "input-contract.v1.schema.json",
  );
  const outputSchemaPath = path.join(
    moduleRoot,
    "schemas",
    "output",
    "output-contract.v1.schema.json",
  );

  const inputSchema = JSON.parse(fs.readFileSync(inputSchemaPath, "utf-8"));
  const outputSchema = JSON.parse(fs.readFileSync(outputSchemaPath, "utf-8"));

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  const inputValidate = ajv.compile(inputSchema);
  const outputValidate = ajv.compile(outputSchema);
  return { inputValidate, outputValidate };
}

function validators(): SchemaPair {
  if (!cached) {
    cached = buildValidators();
  }
  return cached;
}

function formatErrors(errors: unknown): string[] {
  if (!Array.isArray(errors)) return [];
  return errors.map((err) => {
    const rec = err as Record<string, unknown>;
    const path = String(rec.instancePath ?? "");
    const message = String(rec.message ?? "schema validation error");
    return `${path || "/"}: ${message}`;
  });
}

export function validateInputSchema(payload: Record<string, unknown>): void {
  const ok = validators().inputValidate(payload);
  if (!ok) {
    const details = formatErrors(validators().inputValidate.errors);
    throw new SchemaValidationError(
      "schema_validation_failed_input",
      "input contract schema validation failed",
      details,
    );
  }
}

export function validateOutputSchema(payload: Record<string, unknown>): void {
  const ok = validators().outputValidate(payload);
  if (!ok) {
    const details = formatErrors(validators().outputValidate.errors);
    throw new SchemaValidationError(
      "schema_validation_failed_output",
      "output contract schema validation failed",
      details,
    );
  }
}
