import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  NarrativeSubmissionCoordinatorV1,
  type NarrativeSubmissionStorageV1
} from "../../../src/narration-ui/narrativeSubmissionCoordinator";

class MemoryStorage implements NarrativeSubmissionStorageV1 {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function coordinator(storage: MemoryStorage, issued: string[]) {
  return new NarrativeSubmissionCoordinatorV1({
    storage,
    createClientRequestId: () => {
      const id = `request-h1-${issued.length + 1}`;
      issued.push(id);
      return id;
    }
  });
}

function verifySynchronousGestures(): void {
  for (const gesture of ["double-clic", "entree-repetee", "entree-plus-clic", "double-evenement-formulaire"]) {
    const storage = new MemoryStorage();
    const issued: string[] = [];
    const gate = coordinator(storage, issued);
    const first = gate.acquire(`Intention ${gesture}`);
    const duplicate = gate.acquire(`Intention ${gesture}`);
    assert.notEqual(first, null, `${gesture}: la première soumission doit être admise`);
    assert.equal(duplicate, null, `${gesture}: la seconde soumission synchrone doit être rejetée`);
    assert.deepEqual(issued, ["request-h1-1"], `${gesture}: un seul identifiant doit être fabriqué`);
  }
}

function verifyCompletionAndRetry(): void {
  const storage = new MemoryStorage();
  const issued: string[] = [];
  const gate = coordinator(storage, issued);
  const first = gate.acquire("Je salue le garde.");
  assert.notEqual(first, null);
  gate.markRetryable(first!.clientRequestId);
  const retry = gate.acquire("Je salue le garde.");
  assert.equal(retry?.clientRequestId, first?.clientRequestId, "une reprise conserve l'identité de la soumission");
  assert.equal(issued.length, 1, "une erreur ne doit pas créer un second identifiant pour la même saisie");
  gate.complete(first!.clientRequestId);
  const next = gate.acquire("Je demande autre chose.");
  assert.equal(next?.clientRequestId, "request-h1-2", "le verrou doit être libéré après terminaison");
}

function verifyReloadReplay(): void {
  const storage = new MemoryStorage();
  const issued: string[] = [];
  const beforeReload = coordinator(storage, issued);
  const submitted = beforeReload.acquire("Je m'approche du clerc.");
  assert.notEqual(submitted, null);
  const afterReload = coordinator(storage, issued);
  const restored = afterReload.restoreForReplay();
  assert.deepEqual(restored, submitted, "un rechargement doit reprendre le payload et son identifiant exacts");
  assert.equal(afterReload.restoreForReplay(), null, "la reprise elle-même doit être verrouillée synchroniquement");
  assert.equal(issued.length, 1);
}

function verifyUiWiring(): void {
  const panel = readFileSync(resolve("src/ui/NarrativeConversationPanel.tsx"), "utf8");
  const surface = readFileSync(resolve("src/narration-ui/NarrativeAppSurface.tsx"), "utf8");
  assert.doesNotMatch(
    panel,
    /clientRequestId:\s*createNarrativeClientRequestId\(\)/u,
    "le formulaire ne doit plus fabriquer l'identifiant avant le verrou"
  );
  assert.match(surface, /submissionCoordinatorRef\.current\?\.acquire\(rawInput\)/u);
  assert.match(surface, /restoreForReplay\(\)/u);
  assert.match(surface, /submissionCompleted[\s\S]*?markRetryable/u);
}

verifySynchronousGestures();
verifyCompletionAndRetry();
verifyReloadReplay();
verifyUiWiring();
console.log("j10-h1-submission-idempotence/1: OK (4 gestes, retry et reload stables)");
