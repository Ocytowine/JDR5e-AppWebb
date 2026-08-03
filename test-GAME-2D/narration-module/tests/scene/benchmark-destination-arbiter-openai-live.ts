import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  arbitrateDestinationPlausibilityV1,
  buildLoreGuidedSceneCreationBriefV1,
  type DestinationKnownPlaceV1,
  type DestinationMentionV1
} from "../../src/application";
import { compileLoreSourceV1, type LoreEntityV1, type LoreFragmentV1 } from "../../src/bootstrap/lore";
import { selectLoreInfluencesV1 } from "../../src/context";
import { buildOpenAiDestinationPlausibilityArbiterConfigV1 } from "../../../src/narration-ui/openAiNarrativeRuntimeConfig";

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

type ExpectedOutcome = "CREATE_LOCAL" | "CLARIFY" | "TRAVEL_REQUIRED" | "REJECT_CONTRADICTION";

const cases: Array<{
  id: string;
  mention: DestinationMentionV1;
  knownPlaces?: DestinationKnownPlaceV1[];
  expected: ExpectedOutcome;
}> = [
  {
    id: "local-descriptive",
    mention: mention("DESCRIPTIVE_REQUEST", "une petite cour calme près des Archives", "LOCAL"),
    expected: "CREATE_LOCAL"
  },
  {
    id: "local-proper-name",
    mention: mention("PROPER_NAME", "Cour des Copistes, juste à côté", "LOCAL", "Cour des Copistes"),
    expected: "CREATE_LOCAL"
  },
  {
    id: "known-place-ambiguity",
    mention: mention("PROPER_NAME", "la Place des Archives", "UNKNOWN", "Place des Archives"),
    knownPlaces: [{
      schemaVersion: 1,
      placeRef: "location:place_des_archives",
      displayName: "Place des Archives",
      aliases: ["place centrale des Archives"],
      parentLocationRef: "location:quartier_des_archives",
      arrivalSceneId: "scene:place_des_archives",
      sourceRefs: ["wiki:lore/territoire/region/Ylsséa/Lysenthe/index"]
    }],
    expected: "CLARIFY"
  },
  {
    id: "distant-destination",
    mention: mention("DESCRIPTIVE_REQUEST", "un embarcadère dans une autre ville de la côte", "TRAVEL"),
    expected: "TRAVEL_REQUIRED"
  },
  {
    id: "lore-contradiction",
    mention: mention(
      "DESCRIPTIVE_REQUEST",
      "une salle à l'intérieur des Archives où tous les fonds privés sont en libre-service public, sans contrôle",
      "LOCAL"
    ),
    expected: "REJECT_CONTRADICTION"
  }
];

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
    briefId: "benchmark-destination-arbiter-archives",
    packet: selected.packet,
    campaignProjections: []
  });
  if (!briefResult.ok) throw new Error(briefResult.issues.join(" | "));

  const reports = [];
  const runId = Date.now();
  for (const [index, fixture] of cases.entries()) {
    const startedAt = Date.now();
    const result = await arbitrateDestinationPlausibilityV1({
      campaignId: "benchmark-destination-arbiter",
      operationId: `benchmark-destination-arbiter-${runId}-${index + 1}`,
      mention: fixture.mention,
      sourceSceneId: "wiki-location:archives_de_lysenthe",
      sourceLocationRef: "location:archives_de_lysenthe",
      allowedParentLocationRefs: ["location:quartier_des_archives"],
      knownPlaces: fixture.knownPlaces ?? [],
      brief: briefResult.brief,
      config: buildOpenAiDestinationPlausibilityArbiterConfigV1(endpoint)
    });
    const decision = result.ok ? result.decision : null;
    const checks = {
      accepted: result.ok,
      outcome: decision?.outcome === fixture.expected,
      noCommitAuthority: decision?.commitAuthority === false,
      parentDiscipline: decision?.outcome !== "CREATE_LOCAL"
        ? decision?.allowedParentLocationRef === null
        : decision.allowedParentLocationRef === "location:quartier_des_archives",
      sourcedRefusal: decision?.outcome !== "REJECT_CONTRADICTION" || decision.sourceRefs.length > 0
    };
    reports.push({
      id: fixture.id,
      requestedDestination: fixture.mention.rawMention,
      expected: fixture.expected,
      actual: decision?.outcome ?? null,
      passed: Object.values(checks).every(Boolean),
      checks,
      reason: decision?.reason ?? null,
      sourceRefs: decision?.sourceRefs ?? [],
      wallMs: Date.now() - startedAt,
      telemetry: result.telemetry,
      issues: result.ok ? [] : result.issues
    });
    const report = reports.at(-1)!;
    process.stdout.write(`DESTINATION_ARBITER_PROGRESS ${report.id} ${report.wallMs}ms ${report.passed ? "PASS" : "FAIL"}\n`);
  }

  const latencies = reports.flatMap(report => report.telemetry.map(metric => metric.latencyMs)).sort((a, b) => a - b);
  const summary = {
    endpoint,
    cases: reports.length,
    passed: reports.filter(report => report.passed).length,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    maxMs: latencies.at(-1) ?? null,
    inputTokens: reports.reduce((sum, report) => sum + report.telemetry.reduce((subtotal, metric) => subtotal + (metric.inputTokens ?? 0), 0), 0),
    outputTokens: reports.reduce((sum, report) => sum + report.telemetry.reduce((subtotal, metric) => subtotal + (metric.outputTokens ?? 0), 0), 0),
    model: reports.flatMap(report => report.telemetry.map(metric => `${metric.modelId}/${metric.reasoningEffort ?? "standard"}`))[0] ?? "unknown"
  };
  process.stdout.write(`DESTINATION_ARBITER_RESULTS ${JSON.stringify({ summary, reports }, null, 2)}\n`);
  if (summary.passed !== summary.cases) process.exitCode = 1;
}

function mention(
  mentionKind: "PROPER_NAME" | "DESCRIPTIVE_REQUEST",
  rawMention: string,
  declaredScale: "LOCAL" | "TRAVEL" | "UNKNOWN",
  requestedDisplayName: string | null = null
): DestinationMentionV1 {
  return {
    schemaVersion: 1,
    mentionKind,
    rawMention,
    requestedDisplayName,
    destinationDescription: mentionKind === "DESCRIPTIVE_REQUEST" ? rawMention : null,
    proposedPlaceRef: null,
    visibleBoundaryRef: null,
    declaredScale
  };
}

async function compilePilot(): Promise<{ entities: LoreEntityV1[]; fragments: LoreFragmentV1[] }> {
  const entities: LoreEntityV1[] = [];
  const fragments: LoreFragmentV1[] = [];
  for (const sourcePath of sourcePaths) {
    const result = await compileLoreSourceV1({
      sourcePath,
      sourceText: await readFile(`${repositoryRoot}${sourcePath}`, "utf8")
    }, { packageId: "jdr5e.destination-arbiter-benchmark", packageVersion: 1 });
    if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => diagnostic.messageKey).join(" | "));
    entities.push(result.value.entity);
    fragments.push(...result.value.fragments);
  }
  return { entities, fragments };
}

function percentile(values: number[], fraction: number): number | null {
  return values.length === 0 ? null : values[Math.max(0, Math.ceil(values.length * fraction) - 1)] ?? null;
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
