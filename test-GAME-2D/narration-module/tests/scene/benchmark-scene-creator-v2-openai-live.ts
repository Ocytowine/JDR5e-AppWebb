import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildLoreGuidedSceneCreationBriefV1,
  generateLoreGuidedPlaceCandidateV2
} from "../../src/application";
import { compileLoreSourceV1, type LoreEntityV1, type LoreFragmentV1 } from "../../src/bootstrap/lore";
import { selectLoreInfluencesV1 } from "../../src/context";
import { buildOpenAiSceneCreatorConfigV2 } from "../../../src/narration-ui/openAiNarrativeRuntimeConfig";

const endpoint = process.env.NARRATIVE_OPENAI_ENDPOINT ?? "http://127.0.0.1:5175/api/narration/enhance-openai";
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const sourcePaths = [
  "wiki/lore/territoire/astryade",
  "wiki/lore/territoire/region/Ylsséa/index",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/index",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/quartiers/quartier_des_archives",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/batiments/archives_de_lysenthe",
  "wiki/lore/factions/archivistes_de_lysenthe",
  "wiki/lore/populations/cultures/culture_cotiere_ylssea.md"
] as const;

const cases = [
  "un perron extérieur où les visiteurs attendent avant d'entrer aux Archives",
  "une venelle administrative utilisée pour transporter des copies et des actes scellés",
  "un petit parvis reliant les Archives à l'activité publique du quartier"
] as const;

async function main(): Promise<void> {
  const pilot = await compilePilot();
  const selected = selectLoreInfluencesV1({
    creationType: "PLACE",
    anchorEntityId: "archives_de_lysenthe",
    ...pilot,
    allowedKnowledgeLevels: ["COMMUN", "LOCAL"],
    maximumInfluences: 100
  });
  if (!selected.ok) throw new Error(selected.issues.join(" | "));
  const briefResult = buildLoreGuidedSceneCreationBriefV1({
    briefId: "benchmark-scene-creator-v2-archives",
    packet: selected.packet,
    campaignProjections: []
  });
  if (!briefResult.ok) throw new Error(briefResult.issues.join(" | "));

  const reports = [];
  const runId = Date.now();
  for (const [index, requestedDestinationDescription] of cases.entries()) {
    const startedAt = Date.now();
    const result = await generateLoreGuidedPlaceCandidateV2({
      campaignId: "benchmark-scene-creator-v2",
      operationId: `benchmark-scene-creator-${runId}-${index + 1}`,
      brief: briefResult.brief,
      sourceSceneId: "wiki-location:archives_de_lysenthe",
      sourceBoundaryRef: "poi:archives_de_lysenthe:external-exit",
      allowedParentLocationRefs: ["location:quartier_des_archives"],
      allowedPersistenceDepths: ["LIGHT_REFERENCE"],
      requestedDestinationDescription,
      config: buildOpenAiSceneCreatorConfigV2(endpoint)
    });
    const candidate = result.ok ? result.candidate : null;
    const checks = {
      accepted: result.ok,
      contractV2: candidate !== null && !Object.hasOwn(candidate, "connectionIntents"),
      depth: candidate?.requestedDepth === "LIGHT_REFERENCE",
      parent: candidate?.parentLocationRef === "location:quartier_des_archives",
      canonicalRefs: candidate !== null &&
        candidate.proposedPlaceRef.includes(":") &&
        candidate.arrivalSceneId.includes(":"),
      groundedContent: candidate !== null &&
        candidate.perceptibleFeatures.length > 0 &&
        candidate.localNorms.length > 0 &&
        candidate.narrativeCommitments.length > 0,
      conciseRoles: candidate !== null &&
        candidate.populationRoles.length > 0 &&
        candidate.populationRoles.every(role => isConciseRole(role))
    };
    const telemetry = result.telemetry;
    reports.push({
      id: `case-${index + 1}`,
      requestedDestinationDescription,
      passed: Object.values(checks).every(Boolean),
      checks,
      candidate: candidate === null ? null : {
        displayName: candidate.displayName,
        proposedPlaceRef: candidate.proposedPlaceRef,
        arrivalSceneId: candidate.arrivalSceneId,
        summary: candidate.summary,
        populationRoles: candidate.populationRoles,
        perceptibleFeatures: candidate.perceptibleFeatures
      },
      wallMs: Date.now() - startedAt,
      telemetry,
      issues: result.ok ? [] : result.issues
    });
    const report = reports.at(-1)!;
    process.stdout.write(`SCENE_BENCH_PROGRESS ${report.id} ${report.wallMs}ms ${report.passed ? "PASS" : "FAIL"}\n`);
  }

  const latencies = reports.flatMap(report => report.telemetry.map(metric => metric.latencyMs)).sort((a, b) => a - b);
  const summary = {
    endpoint,
    cases: reports.length,
    passed: reports.filter(report => report.passed).length,
    providerAccepted: reports.filter(report => report.checks.accepted).length,
    conciseRoles: reports.filter(report => report.checks.conciseRoles).length,
    retries: reports.reduce((sum, report) => sum + Math.max(0, report.telemetry.length - 1), 0),
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    maxMs: latencies.at(-1) ?? null,
    inputTokens: tokenTotal(reports, "inputTokens"),
    outputTokens: tokenTotal(reports, "outputTokens"),
    model: reports.flatMap(report => report.telemetry.map(metric => `${metric.modelId}/${metric.reasoningEffort ?? "standard"}`))[0] ?? "unknown"
  };
  process.stdout.write(`SCENE_BENCH_RESULTS ${JSON.stringify({ summary, reports }, null, 2)}\n`);
  if (summary.passed !== summary.cases) process.exitCode = 1;
}

async function compilePilot(): Promise<{ entities: LoreEntityV1[]; fragments: LoreFragmentV1[] }> {
  const entities: LoreEntityV1[] = [];
  const fragments: LoreFragmentV1[] = [];
  for (const sourcePath of sourcePaths) {
    const result = await compileLoreSourceV1({
      sourcePath,
      sourceText: await readFile(`${repositoryRoot}${sourcePath}`, "utf8")
    }, { packageId: "jdr5e.scene-creator-benchmark", packageVersion: 1 });
    if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => diagnostic.messageKey).join(" | "));
    entities.push(result.value.entity);
    fragments.push(...result.value.fragments);
  }
  return { entities, fragments };
}

function isConciseRole(role: string): boolean {
  const words = role.trim().split(/\s+/u);
  return role.length <= 48 &&
    words.length <= 4 &&
    !/[.!?;:]/u.test(role) &&
    !/\b(?:attendant|transportant|cherchant|traversant|chargé|chargée|chargés|chargées|venu|venue|venus|venues)\b/iu.test(role);
}

function percentile(values: number[], fraction: number): number | null {
  return values.length === 0 ? null : values[Math.max(0, Math.ceil(values.length * fraction) - 1)] ?? null;
}

function tokenTotal(
  reports: Array<{ telemetry: Array<{ inputTokens: number | null; outputTokens: number | null }> }>,
  key: "inputTokens" | "outputTokens"
): number {
  return reports.reduce((sum, report) =>
    sum + report.telemetry.reduce((subtotal, metric) => subtotal + (metric[key] ?? 0), 0), 0);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
