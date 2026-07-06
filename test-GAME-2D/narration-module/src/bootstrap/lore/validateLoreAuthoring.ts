import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import { canonicalizeJson } from "../../core/canonical-json/canonicalJson";
import { loreAuthorEntitySchema } from "./schemas";
import type {
  HistoricalDateV1,
  HistoricalPeriodLoreAuthorV1,
  LoreAuthorEntityV1,
  NpcLoreAuthorV1,
  SpeciesLoreAuthorV1
} from "./types";

export type LoreAuthoringValidationResult =
  | { valid: true; value: LoreAuthorEntityV1 }
  | { valid: false; issues: string[] };

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: true });
const validateEntitySchema: ValidateFunction<LoreAuthorEntityV1> = ajv.compile(loreAuthorEntitySchema);

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(error => `${error.instancePath || "/"} ${error.message ?? "invalid"}`);
}

function collectBlankStrings(value: unknown, path = "", issues: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.trim().length === 0) issues.push(`${path || "/"} must not be blank.`);
    return issues;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectBlankStrings(entry, `${path}/${index}`, issues));
    return issues;
  }
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>)
      .forEach(([key, entry]) => collectBlankStrings(entry, `${path}/${key}`, issues));
  }
  return issues;
}

function validateInformationIds(entity: LoreAuthorEntityV1): string[] {
  const seen = new Set<string>();
  const issues: string[] = [];
  entity.informations.forEach((information, index) => {
    if (seen.has(information.id)) {
      issues.push(`/informations/${index}/id duplicates information id ${information.id}.`);
    }
    seen.add(information.id);
  });
  return issues;
}

function validateDate(date: HistoricalDateV1, path: string): string[] {
  const issues: string[] = [];
  const hasYear = date.annee !== null;
  const hasMonth = date.mois !== null;
  const hasDay = date.jour !== null;

  if (hasDay && !hasMonth) issues.push(`${path}/jour requires a month.`);
  if (hasMonth && !hasYear) issues.push(`${path}/mois requires a year.`);
  if (date.precision === "JOUR" && !(hasYear && hasMonth && hasDay)) {
    issues.push(`${path} with JOUR precision requires year, month and day.`);
  }
  if (date.precision === "MOIS" && (!(hasYear && hasMonth) || hasDay)) {
    issues.push(`${path} with MOIS precision requires year and month, without day.`);
  }
  if (date.precision === "ANNEE" && (!hasYear || hasMonth || hasDay)) {
    issues.push(`${path} with ANNEE precision requires only a year.`);
  }
  if (date.precision === "INCONNUE" && (hasYear || hasMonth || hasDay)) {
    issues.push(`${path} with INCONNUE precision cannot carry a numeric date.`);
  }
  return issues;
}

function validateSpecies(entity: SpeciesLoreAuthorV1): string[] {
  const issues: string[] = [];
  if (entity.jouable && entity.catalogue_mecanique?.entry_kind !== "race") {
    issues.push("/catalogue_mecanique must reference a race when the species is playable.");
  }
  if (
    entity.biologie.maturite !== null &&
    entity.biologie.esperance_vie !== null &&
    entity.biologie.maturite > entity.biologie.esperance_vie
  ) {
    issues.push("/biologie/maturite cannot exceed esperance_vie.");
  }
  return issues;
}

function validateNpc(entity: NpcLoreAuthorV1): string[] {
  const issues: string[] = [];
  entity.relations_initiales.forEach((relation, index) => {
    if (relation.pnj === entity.id) issues.push(`/relations_initiales/${index}/pnj cannot reference the same NPC.`);
  });
  return issues;
}

function validatePeriod(entity: HistoricalPeriodLoreAuthorV1): string[] {
  const issues = validateDate(entity.debut, "/debut");
  if (entity.fin) {
    issues.push(...validateDate(entity.fin, "/fin"));
    if (
      entity.debut.calendar_id === entity.fin.calendar_id &&
      entity.debut.annee !== null &&
      entity.fin.annee !== null &&
      entity.fin.annee < entity.debut.annee
    ) issues.push("/fin cannot be earlier than /debut.");
  }
  if (entity.periode_parente === entity.id) issues.push("/periode_parente cannot reference the same period.");
  return issues;
}

function validateSemantics(entity: LoreAuthorEntityV1): string[] {
  const issues = [
    ...collectBlankStrings(entity),
    ...validateInformationIds(entity)
  ];
  if (entity.type === "espece") issues.push(...validateSpecies(entity));
  if (entity.type === "pnj") issues.push(...validateNpc(entity));
  if (entity.type === "periode_historique") issues.push(...validatePeriod(entity));
  if (entity.type === "evenement_historique") {
    issues.push(...validateDate(entity.date, "/date"));
    entity.causes.forEach((cause, index) => {
      if (cause.evenement === entity.id) issues.push(`/causes/${index}/evenement cannot reference the same event.`);
    });
  }
  return issues;
}

export function validateLoreAuthorEntityV1(value: unknown): LoreAuthoringValidationResult {
  try {
    canonicalizeJson(value);
  } catch (error) {
    return {
      valid: false,
      issues: [error instanceof Error ? error.message : "Invalid JSON value."]
    };
  }

  if (!validateEntitySchema(value)) {
    return { valid: false, issues: formatErrors(validateEntitySchema.errors) };
  }

  const issues = validateSemantics(value);
  return issues.length === 0
    ? { valid: true, value }
    : { valid: false, issues };
}
