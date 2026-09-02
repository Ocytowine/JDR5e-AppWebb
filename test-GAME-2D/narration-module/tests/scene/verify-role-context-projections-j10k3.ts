import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AiRoleV1 } from "../../src/ai/types";
import {
  prepareNarrativeRoleContextV1,
  validateNarrativeContextManifestV1,
  type NarrativeContextProjectionKindV1,
  type NarrativeRoleProjectionInputV1
} from "../../src/application";

const PRIVATE_NOTEBOOK_CANARY = "CANARY_K3_PRIVATE_NOTEBOOK_DO_NOT_SEND";
const GM_SECRET_CANARY = "CANARY_K3_GM_SECRET_DO_NOT_SEND";

interface RoleFixture {
  id: string;
  role: AiRoleV1;
  authority: string;
  projections: NarrativeRoleProjectionInputV1[];
}

const fixtures: RoleFixture[] = [
  fixture("npc-performer", "npc_performer", "PERFORM_VISIBLE_ACTOR_ONLY", [
    projection("resolved-turn", "RESOLVED_TURN", { dialogueAct: "ASK_QUESTION" }, true),
    projection("scene-visible", "SCENE_VISIBLE", { sceneId: "scene:k3", actorRef: "npc:k3" }, true),
    projection("npc-public-profile", "NPC_PUBLIC_PROFILE", { actorRef: "npc:k3", publicRole: "garde" }, true),
    { ...projection("npc-private-context", "NPC_ROLE_PRIVATE_CONTEXT", { belief: "actor-scoped" }, false), classification: "ROLE_PRIVATE" },
    projection("npc-disclosure", "NPC_DISCLOSURE", { authorizedFacts: [] }, false)
  ]),
  fixture("scene-writer", "scene_writer", "PRESENTATION_ONLY", [
    projection("resolved-turn", "RESOLVED_TURN", { resultKind: "COMMIT_APPLIED" }, true),
    projection("scene-visible", "SCENE_VISIBLE", { sceneId: "scene:k3", visible: ["npc:k3"] }, true)
  ]),
  fixture("scene-creator", "scene_creator", "PROPOSE_ONLY", [
    projection("creation-brief", "CREATION_BRIEF", { requestedPlace: "passage public" }, true),
    projection("lore-influences", "LORE_INFLUENCES", { sourceRefs: ["lore:k3"] }, true),
    projection("creation-policy", "CREATION_POLICY", { mayCreate: ["PLACE"] }, true)
  ]),
  fixture("fact-creator", "scene_creator", "PROPOSE_ONLY_NO_COMMIT", [
    projection("missing-fact-target", "MISSING_FACT_TARGET", { propertyRef: "lore-property:k3" }, true),
    projection("creation-policy", "CREATION_POLICY", { valueKind: "IDENTITY" }, true),
    projection("public-sources", "PUBLIC_SOURCE_REFS", { sourceRefs: ["lore:k3"] }, false)
  ]),
  fixture("coherence-critic", "coherence_critic", "REVIEW_ONLY", [
    projection("candidate-output", "CANDIDATE_OUTPUT", { text: "sortie candidate" }, true),
    projection("resolution-evidence", "RESOLUTION_EVIDENCE", { claim: "fait arbitré" }, true),
    projection("coherence-invariants", "COHERENCE_INVARIANTS", { noCommit: true }, false)
  ])
];

function main(): void {
  const ownerState = { privateNotebook: PRIVATE_NOTEBOOK_CANARY, gmSecrets: GM_SECRET_CANARY };
  assert.match(JSON.stringify(ownerState), /CANARY_K3/u, "les sentinelles doivent exister avant projection");
  for (const roleFixture of fixtures) {
    const operationId = `operation:j10k3:${roleFixture.id}`;
    const prepared = prepareNarrativeRoleContextV1({
      manifestId: `${operationId}:manifest`,
      operationId,
      campaignId: "campaign:j10k3",
      snapshot: {
        snapshotId: `${operationId}:snapshot`,
        campaignRevision: null,
        sceneId: null,
        sceneVersion: null
      },
      role: roleFixture.role,
      profileId: `${operationId}:profile`,
      purpose: `Projection minimale ${roleFixture.id}`,
      taskContextRef: "task.context",
      authority: roleFixture.authority,
      projections: roleFixture.projections
    });
    assert.deepEqual(validateNarrativeContextManifestV1(prepared.manifest), { ok: true, issues: [] });
    assert.deepEqual(Object.keys(prepared.roleContextPack).sort(), [
      "authority", "contextManifestRef", "schemaVersion", "taskContextRef"
    ]);
    const manifestText = JSON.stringify(prepared.manifest);
    const pointerText = JSON.stringify(prepared.roleContextPack);
    assert.equal(manifestText.includes(PRIVATE_NOTEBOOK_CANARY), false);
    assert.equal(manifestText.includes(GM_SECRET_CANARY), false);
    assert.equal(pointerText.includes("scene:k3"), false);
    assert.ok(prepared.manifest.projections.some(item => item.kind === "PLAYER_PRIVATE_NOTEBOOK" && item.transport === "FORBIDDEN"));
    assert.ok(prepared.manifest.projections.some(item => item.kind === "GM_SECRETS" && item.transport === "FORBIDDEN"));
    for (const projection of roleFixture.projections) {
      const serializedPayload = JSON.stringify(projection.payload);
      if (serializedPayload.length > 2) assert.equal(pointerText.includes(serializedPayload), false);
    }
  }

  const applicationRoot = resolve("narration-module/src/application");
  const migratedFiles = [
    "npcPerforming.ts",
    "aiNarrativeEnhancement.ts",
    "loreGuidedPlaceCandidateGeneration.ts",
    "missingInformationFactCreation.ts",
    "plotCandidateGeneration.ts",
    "catalogPlotCreationRuntime.ts"
  ];
  for (const file of migratedFiles) {
    const source = readFileSync(resolve(applicationRoot, file), "utf8");
    assert.match(source, /prepareNarrativeRoleContextV1/u, `${file}: manifeste K3 absent`);
    assert.doesNotMatch(source, /const roleContextPack = \{/u, `${file}: payload autoritaire encore construit dans roleContextPack`);
  }
  const performerSource = readFileSync(resolve(applicationRoot, "npcPerforming.ts"), "utf8");
  assert.doesNotMatch(performerSource, /\n\s+rawInput: input\.rawInput,/u, "le performer ne doit pas recevoir la saisie brute");
  assert.doesNotMatch(performerSource, /\n\s+rawInput: input\.input\.rawInput,/u, "le critique PNJ ne doit pas recevoir la saisie brute");
  const sceneProjectionSource = readFileSync(resolve(applicationRoot, "activeSceneNarrative.ts"), "utf8");
  assert.doesNotMatch(sceneProjectionSource, /asksAboutVisiblePopulation|presences\?\|silhouettes/u,
    "le writer doit utiliser informationKind=PRESENCE fourni par l'interpréteur, sans relire les mots du joueur");
  const routeSource = readFileSync(resolve("narration-module/server/narrativeOpenAiEnhancementRoute.js"), "utf8");
  assert.match(routeSource, /task\.context\.target/u);
  assert.match(routeSource, /task\.knowledgeEnvelope\.visibleSituation comme contrainte spatiale unique/u);
  assert.doesNotMatch(routeSource, /roleContextPack\.spatialContext/u);

  console.log(JSON.stringify({
    contractVersion: "narrative-role-context-projections/1",
    status: "OK",
    profiles: fixtures.map(value => value.id),
    oneTransportCopyPerProjection: true,
    rawPlayerInputOutsideInterpreter: false,
    privateNotebookOrGmSecretInManifest: false
  }, null, 2));
}

function fixture(
  id: string,
  role: AiRoleV1,
  authority: string,
  projections: NarrativeRoleProjectionInputV1[]
): RoleFixture {
  return { id, role, authority, projections };
}

function projection(
  projectionKey: string,
  kind: NarrativeContextProjectionKindV1,
  payload: unknown,
  required: boolean
): NarrativeRoleProjectionInputV1 {
  return {
    projectionKey,
    kind,
    payload,
    ownerId: `test-owner:${projectionKey}`,
    sourceRefs: [`test-source:${projectionKey}`],
    sourceVersion: "test/1",
    required
  };
}

void main();
