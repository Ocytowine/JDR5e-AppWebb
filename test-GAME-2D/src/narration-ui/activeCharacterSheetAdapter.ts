import {
  computeJsonFingerprint,
  type JsonObject
} from "../../narration-module/src/core";
import type {
  CharacterImportEnvelopeV1,
  Sha256Fingerprint
} from "../../narration-module/src/bootstrap";

export const LEGACY_SAVED_SHEETS_KEY_V1 = "jdr5e_saved_sheets";
export const LEGACY_ACTIVE_SHEET_KEY_V1 = "jdr5e_active_sheet";

export interface CharacterSheetStorageV1 {
  getItem(key: string): string | null;
}

export interface ActiveCharacterSheetV1 {
  schemaVersion: 1;
  sheetId: string;
  sheetName: string;
  updatedAt: string;
  sourceFingerprint: Sha256Fingerprint;
  envelope: CharacterImportEnvelopeV1;
}

export interface ActiveCharacterSheetDiagnosticV1 {
  code:
    | "ACTIVE_SHEET_STORAGE_UNAVAILABLE"
    | "ACTIVE_SHEET_NOT_SELECTED"
    | "ACTIVE_SHEET_COLLECTION_INVALID"
    | "ACTIVE_SHEET_NOT_FOUND"
    | "ACTIVE_SHEET_RECORD_INVALID"
    | "ACTIVE_SHEET_CHARACTER_INVALID";
  message: string;
}

export type ActiveCharacterSheetReadResultV1 =
  | { ok: true; value: ActiveCharacterSheetV1; diagnostics: [] }
  | { ok: false; value: null; diagnostics: ActiveCharacterSheetDiagnosticV1[] };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function readActiveCharacterSheetV1(
  storage: CharacterSheetStorageV1 | null =
    typeof window === "undefined" ? null : window.localStorage
): Promise<ActiveCharacterSheetReadResultV1> {
  if (storage === null) return failure(
    "ACTIVE_SHEET_STORAGE_UNAVAILABLE",
    "Le stockage local des fiches n’est pas disponible."
  );
  let activeSheetId: string | null;
  let parsedSheets: unknown;
  try {
    activeSheetId = storage.getItem(LEGACY_ACTIVE_SHEET_KEY_V1);
    const rawSheets = storage.getItem(LEGACY_SAVED_SHEETS_KEY_V1);
    parsedSheets = rawSheets === null ? [] : JSON.parse(rawSheets);
  } catch {
    return failure(
      "ACTIVE_SHEET_COLLECTION_INVALID",
      "La liste des fiches sauvegardées est illisible."
    );
  }
  if (!activeSheetId?.trim()) return failure(
    "ACTIVE_SHEET_NOT_SELECTED",
    "Aucune fiche active n’est sélectionnée dans le créateur."
  );
  if (!Array.isArray(parsedSheets)) return failure(
    "ACTIVE_SHEET_COLLECTION_INVALID",
    "La liste des fiches sauvegardées n’a pas le format attendu."
  );
  const selected = parsedSheets.find(value => object(value)?.id === activeSheetId);
  if (selected === undefined) return failure(
    "ACTIVE_SHEET_NOT_FOUND",
    "La fiche active n’existe plus dans les sauvegardes."
  );
  const record = object(selected);
  if (
    record === null
    || typeof record.id !== "string"
    || typeof record.name !== "string"
    || typeof record.updatedAt !== "string"
  ) return failure(
    "ACTIVE_SHEET_RECORD_INVALID",
    "La sauvegarde active est incomplète."
  );
  const character = object(record.character);
  if (character === null) return failure(
    "ACTIVE_SHEET_CHARACTER_INVALID",
    "La fiche active ne contient pas de personnage exploitable."
  );
  const sourceFingerprint =
    await computeJsonFingerprint(character as JsonObject) as Sha256Fingerprint;
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      sheetId: record.id,
      sheetName: record.name,
      updatedAt: record.updatedAt,
      sourceFingerprint,
      envelope: {
        schemaVersion: 1,
        sourceKind: "CHARACTER_CREATOR_LEGACY",
        sourceSchemaVersion: 1,
        sourceFingerprint,
        character
      }
    },
    diagnostics: []
  };
}

function failure(
  code: ActiveCharacterSheetDiagnosticV1["code"],
  message: string
): ActiveCharacterSheetReadResultV1 {
  return { ok: false, value: null, diagnostics: [{ code, message }] };
}
