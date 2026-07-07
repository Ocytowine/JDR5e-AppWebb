import { computeJsonFingerprint, cloneJson } from "../core";
import type {
  MemoryCapsuleV1,
  MemoryIndexEntryV1,
  MemoryIndexRebuildReportV1,
  MemoryQueryResultV1,
  MemoryRecallQueryV1,
  MemoryRepositoryV1,
  MemoryTriggerV1,
  MemoryUnitV1
} from "./types";
import {
  canExposeMemoryToPerspective,
  sameSourceRef,
  validateMemoryRecallQueryV1,
  validateMemoryUnitV1
} from "./validation";

function normalizeText(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(token => token.length >= 3);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function tokenEstimate(value: string): number {
  return Math.max(1, Math.ceil(normalizeText(value).join(" ").length / 4));
}

function triggerScore(unit: MemoryUnitV1, trigger: MemoryTriggerV1): number {
  let score = 0;
  if (trigger.id) {
    const anchorMatch = unit.anchors.some(anchor => anchor.kind === trigger.kind && anchor.id === trigger.id);
    if (anchorMatch) score += trigger.strength === "STRONG" ? 80 : 35;
  }
  if (trigger.text) {
    const triggerTokens = normalizeText(trigger.text);
    const unitTokens = new Set(normalizeText(`${unit.text} ${unit.summary ?? ""}`));
    const matches = triggerTokens.filter(token => unitTokens.has(token)).length;
    if (matches > 0) score += (trigger.strength === "STRONG" ? 12 : 6) * matches;
  }
  return score;
}

function sourceRequired(unit: MemoryUnitV1, query: MemoryRecallQueryV1): boolean {
  if (query.requiredSourceRefs.length === 0) return true;
  return query.requiredSourceRefs.every(required => unit.sourceRefs.some(source => sameSourceRef(source, required)));
}

function inclusionLevel(score: number): MemoryCapsuleV1["inclusionLevel"] {
  if (score >= 80) return "STRUCTURED_DIRECT";
  if (score >= 40) return "CAUSAL_STRONG";
  if (score >= 12) return "TEXTUAL_ALIAS";
  return "WEAK_SUGGESTION";
}

function validityPriority(unit: MemoryUnitV1): number {
  if (unit.validity === "CURRENT_TRUE") return 3;
  if (unit.validity === "PAST_TRUE") return 2;
  if (unit.validity === "SUBJECTIVE_BELIEF" || unit.validity === "HYPOTHESIS") return 1;
  return 0;
}

export class InMemoryMemoryRepositoryV1 implements MemoryRepositoryV1 {
  private readonly units = new Map<string, MemoryUnitV1>();
  private indexes = new Map<string, MemoryIndexEntryV1>();

  async upsertMemoryUnits(units: MemoryUnitV1[]): Promise<void> {
    for (const unit of units) {
      const validation = validateMemoryUnitV1(unit);
      if (!validation.ok) {
        throw new Error(`Invalid MemoryUnitV1 ${unit.memoryId ?? "<unknown>"}: ${validation.issues.join("; ")}`);
      }
      this.units.set(unit.memoryId, cloneJson(unit));
    }
  }

  async queryMemory(query: MemoryRecallQueryV1): Promise<MemoryQueryResultV1> {
    const validation = validateMemoryRecallQueryV1(query);
    if (!validation.ok) {
      return {
        ok: false,
        diagnostics: [{
          code: "MEMORY_VALIDATION_FAILED",
          message: "Invalid memory recall query.",
          details: { issues: validation.issues }
        }]
      };
    }

    const scored = [...this.units.values()]
      .filter(unit => unit.campaignId === query.campaignId)
      .filter(unit => unit.validity !== "INVALIDATED" && unit.validity !== "SUPERSEDED")
      .filter(unit => sourceRequired(unit, query))
      .map(unit => ({
        unit,
        score: [
          ...query.strongTriggers,
          ...query.secondaryTriggers
        ].reduce((total, trigger) => total + triggerScore(unit, trigger), 0)
      }))
      .filter(entry => entry.score > 0 || query.requiredSourceRefs.length > 0)
      .filter(entry => canExposeMemoryToPerspective(entry.unit.visibility, entry.unit.actorScope, query.perspective));

    if (scored.length === 0) {
      return { ok: true, capsules: [] };
    }

    scored.sort((left, right) =>
      validityPriority(right.unit) - validityPriority(left.unit) ||
      right.score - left.score ||
      right.unit.importance.systemic - left.unit.importance.systemic ||
      right.unit.importance.narrative - left.unit.importance.narrative ||
      left.unit.memoryId.localeCompare(right.unit.memoryId)
    );

    const capsules: MemoryCapsuleV1[] = [];
    let consumed = 0;
    for (const { unit, score } of scored) {
      const text = unit.summary ?? unit.text;
      const estimate = tokenEstimate(text);
      if (capsules.length > 0 && consumed + estimate > query.outputBudgetUnits) continue;
      if (capsules.length === 0 && estimate > query.outputBudgetUnits) continue;
      capsules.push({
        schemaVersion: 1,
        capsuleId: `capsule:${query.queryId}:${unit.memoryId}`,
        memoryIds: [unit.memoryId],
        sourceRefs: cloneJson(unit.sourceRefs),
        perspective: cloneJson(query.perspective),
        inclusionLevel: inclusionLevel(score),
        reason: score >= 80 ? "direct trigger match" : "textual or secondary trigger match",
        validity: unit.validity,
        certainty: unit.validity === "CURRENT_TRUE" || unit.validity === "PAST_TRUE" ? "CONFIRMED" : "UNCERTAIN",
        text,
        tokenEstimate: estimate
      });
      consumed += estimate;
      if (capsules.length >= Math.max(1, query.candidateBudget.structured + query.candidateBudget.text + query.candidateBudget.graph + query.candidateBudget.semantic)) break;
    }
    return { ok: true, capsules };
  }

  async rebuildIndexes(campaignId: string, policyVersion: string): Promise<MemoryIndexRebuildReportV1> {
    const entries: MemoryIndexEntryV1[] = [];
    for (const unit of [...this.units.values()].filter(entry => entry.campaignId === campaignId)) {
      const keys = unique([
        unit.memoryId,
        unit.unitType,
        unit.validity,
        unit.recallCycle,
        ...unit.anchors.map(anchor => `${anchor.kind}:${anchor.id}`),
        ...normalizeText(`${unit.text} ${unit.summary ?? ""}`)
      ]);
      for (const channel of ["STRUCTURED", "GRAPH", "TEXT"] as const) {
        const draft = {
          schemaVersion: 1 as const,
          indexId: `memory-index:${policyVersion}:${channel}:${unit.memoryId}`,
          campaignId,
          memoryId: unit.memoryId,
          sourceRefs: cloneJson(unit.sourceRefs),
          channel,
          keys,
          visibility: unit.visibility,
          actorScope: [...unit.actorScope],
          recallCycle: unit.recallCycle,
          rootFingerprint: "sha256:" as `sha256:${string}`,
          policyVersion
        };
        entries.push({
          ...draft,
          rootFingerprint: await computeJsonFingerprint({ ...draft, rootFingerprint: null }) as `sha256:${string}`
        });
      }
    }
    this.indexes = new Map(entries.map(entry => [entry.indexId, entry]));
    return {
      schemaVersion: 1,
      campaignId,
      policyVersion,
      rebuiltMemoryCount: new Set(entries.map(entry => entry.memoryId)).size,
      rebuiltIndexCount: entries.length,
      channels: ["STRUCTURED", "GRAPH", "TEXT"]
    };
  }

  async listIndexEntries(campaignId: string): Promise<MemoryIndexEntryV1[]> {
    return [...this.indexes.values()]
      .filter(entry => entry.campaignId === campaignId)
      .map(entry => cloneJson(entry));
  }
}
