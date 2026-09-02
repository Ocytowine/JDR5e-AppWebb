import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type { AiCallRequestV1, AiOpenSemanticFrameV8 } from "../../src/ai/types";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
  buildInterpreterRuntimeContextV1,
  buildLoreInformationSemanticCatalogV1,
  buildPlayerIntentContextManifestV1,
  buildPlayerPublicContextV1,
  interpretNarrativeInputWithAiV1,
  propertyRef,
  validateNarrativeContextManifestV1,
  type AiIntentInterpreterConfigV1,
  type InterpreterCharacterContextV1,
  type InterpreterEmbodiedPublicContextV1,
  type LoreInformationSemanticCatalogV1,
  type LocalInteractionFocusV1
} from "../../src/application";
import { buildArchiveLorePilotV1 } from "../../../src/narration-ui/archiveLorePilot";

const require = createRequire(import.meta.url);
const serverRoute = require("../../server/narrativeOpenAiEnhancementRoute.js") as {
  buildRoleInstructions(request: AiCallRequestV1): string;
  buildStrictAiOutputSchema(request: AiCallRequestV1): unknown;
  buildOpenAiResponsesBody(request: AiCallRequestV1, route: { modelId: string; reasoningEffort: string | null }): unknown;
};

async function main(): Promise<void> {
  const pilot = await buildArchiveLorePilotV1();
  const scene = pilot.scene;
  const guard = scene.ambientPopulation.find(actor => /garde/iu.test(actor.publicRole));
  assert.ok(guard);
  const guardRef = `npc:${guard.actorId}`;
  const characterContext = character();
  const playerPublicContext = buildPlayerPublicContextV1({ activeScene: scene, characterContext });
  const catalog = buildLoreInformationSemanticCatalogV1({
    catalog: pilot.catalog,
    anchorEntityId: "archives_de_lysenthe"
  });
  assert.ok(catalog);
  const focus: LocalInteractionFocusV1 = {
    schemaVersion: 1,
    contractVersion: "local-interaction-focus/1",
    sceneId: scene.sceneId,
    sceneVersion: scene.version,
    targetRef: guardRef,
    targetDisplayName: guard.displayName,
    mode: "DIALOGUE",
    publicSummary: `Le personnage échange avec ${guard.displayName}.`,
    openedByOperationId: "operation:j10k2:greeting",
    lastConfirmedOperationId: "operation:j10k2:permission",
    status: "ACTIVE",
    closureReason: null
  };
  const rawInput = "pouvez vous me dire qui gouverne le pays ?";
  let captured: AiCallRequestV1 | null = null;
  const provider: ContractAiProviderV1 = {
    async generate(request): Promise<unknown> {
      captured = structuredClone(request);
      return understoodEnvelope(request, rawInput, guardRef);
    }
  };
  const config: AiIntentInterpreterConfigV1 = {
    provider,
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
    route: {
      schemaVersion: 1,
      routeId: "route:j10k2-projection",
      role: "player_intent_interpreter",
      providerKind: "FAKE_CONTRACT",
      providerId: "fixture:j10k2",
      modelId: "gpt-5.6-luna",
      modelConfigVersion: "j10k2",
      certified: true,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8],
      inputTokenLimit: 4_000,
      outputTokenLimit: 1_600,
      timeoutMs: 30_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1,
      role: "player_intent_interpreter",
      maxTechnicalRetries: 0,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: false
    },
    informationCatalogForScene: () => catalog
  };
  const recentSemanticTurns = [{
    schemaVersion: 1 as const,
    operationId: "operation:j10k2:permission",
    semanticKind: "address_visible_actor" as const,
    playerGoal: `Demander à ${guard.displayName} la permission de poser une question.`,
    primaryTarget: { kind: "npc" as const, ref: guardRef, label: guard.displayName },
    topic: null,
    commitment: "committed" as const
  }];
  const runtimeContext = buildInterpreterRuntimeContextV1({
    sceneTransition: true,
    dynamicPlace: true,
    rest: true,
    inventoryAccess: true,
    inventoryMutation: true,
    tacticalAccess: false,
    travel: true,
    activeTravel: null
  });
  const result = await interpretNarrativeInputWithAiV1({
    campaignId: "campaign:j10k2",
    operationId: "operation:j10k2:country",
    intentId: "intent:j10k2:country",
    rawInput,
    config,
    playableScene: scene,
    characterContext,
    playerPublicContext,
    recentSemanticTurns,
    localReferentHints: [{
      schemaVersion: 1,
      sceneId: scene.sceneId,
      sceneVersion: scene.version,
      target: { kind: "npc", ref: guardRef, label: guard.displayName },
      sourceOperationId: "operation:j10k2:permission",
      sourceText: "",
      confidence: "high"
    }],
    localInteractionFocus: focus,
    runtimeContext,
    activeCompanionRefs: []
  });

  assert.equal(result.usedAiInterpretation, true);
  assert.equal(result.interpretation.requiresClarification, false);
  assert.equal(result.interpretation.openSemanticFrame?.understandingStatus, "UNDERSTOOD");
  assert.equal(
    result.interpretation.openSemanticFrame?.components[0]?.informationNeed?.proposedSubjectRef,
    "lore-entity:astryade"
  );
  assert.ok(captured);
  if (captured === null) throw new Error("missing captured request");
  const request = captured as AiCallRequestV1;
  const roleContextPack = request.input.roleContextPack as Record<string, unknown>;
  const task = request.input.task as Record<string, unknown>;
  const embodied = task.embodiedContext as InterpreterEmbodiedPublicContextV1;
  assert.deepEqual(Object.keys(roleContextPack).sort(), [
    "authority", "contextManifestRef", "embodiedContextRef", "schemaVersion"
  ]);
  assert.equal(roleContextPack.embodiedContextRef, "task.embodiedContext");
  assert.equal(roleContextPack.contextManifestRef, "operation:j10k2:country:context-manifest:intent");
  assert.equal(JSON.stringify(roleContextPack).includes(scene.sceneId), false);
  assert.equal(JSON.stringify(roleContextPack).includes(guardRef), false);
  assert.equal(embodied.currentScene.sceneId, scene.sceneId);
  assert.ok(embodied.currentScene.presentActors.some(actor => actor.actorRef === guardRef));
  assert.equal(embodied.activeInterlocutor?.actorRef, guardRef);
  assert.equal(embodied.activeInteraction?.targetRef, guardRef);

  const reconstructed = reconstructCatalog(embodied.informationCatalog);
  assert.deepEqual(reconstructed, catalog, "la projection tabulaire doit être réversible sans perte sémantique");
  const compactCatalogCharacters = JSON.stringify(embodied.informationCatalog).length;
  const canonicalCatalogCharacters = JSON.stringify(catalog).length;
  assert.ok(compactCatalogCharacters < canonicalCatalogCharacters * 0.72);

  const manifest = buildPlayerIntentContextManifestV1({
    manifestId: String(roleContextPack.contextManifestRef),
    operationId: request.operationId,
    campaignId: request.campaignId,
    snapshotId: request.snapshotId,
    sceneVersion: scene.version,
    rawInput,
    embodiedContext: embodied
  });
  assert.deepEqual(validateNarrativeContextManifestV1(manifest), { ok: true, issues: [] });
  assert.equal(JSON.stringify(manifest).includes(rawInput), false, "le manifeste décrit la projection sans recopier son payload");
  assert.equal(manifest.projections.find(item => item.kind === "SCENE_VISIBLE")?.serializedCharacters,
    JSON.stringify(embodied.currentScene).length);

  const instructions = serverRoute.buildRoleInstructions(request);
  assert.match(instructions, /projection tabulaire sans valeur factuelle/u);
  assert.match(instructions, /si un seul sujet public.+sémantiquement compatible/u);
  const providerBody = serverRoute.buildOpenAiResponsesBody(request, {
    modelId: "gpt-5.6-luna",
    reasoningEffort: "none"
  });
  const measures = {
    requestInputCharacters: JSON.stringify(request.input).length,
    roleContextPackCharacters: JSON.stringify(roleContextPack).length,
    embodiedContextCharacters: JSON.stringify(embodied).length,
    compactCatalogCharacters,
    canonicalCatalogCharacters,
    instructionCharacters: instructions.length,
    outputSchemaCharacters: JSON.stringify(serverRoute.buildStrictAiOutputSchema(request)).length,
    providerBodyCharacters: JSON.stringify(providerBody).length
  };
  assert.ok(measures.requestInputCharacters < 15_000);
  assert.ok(measures.roleContextPackCharacters < 250);
  assert.ok(measures.providerBodyCharacters < 33_704);

  console.log(JSON.stringify({
    contractVersion: "interpreter-context-projection/1",
    status: "OK",
    semanticCoverage: { subjects: 7, properties: 18, relations: 12 },
    selectedSubjectRef: "lore-entity:astryade",
    before: { requestInputCharacters: 18_050, providerBodyCharacters: 33_704 },
    after: measures
  }, null, 2));
}

function reconstructCatalog(
  projection: InterpreterEmbodiedPublicContextV1["informationCatalog"]
): LoreInformationSemanticCatalogV1 | null {
  if (projection === null) return null;
  return {
    schemaVersion: 1,
    contractVersion: "lore-information-semantic-catalog/1",
    anchorSubjectRef: projection.anchorSubjectRef,
    subjects: projection.subjects.map(([ref, label, entityType]) => ({ ref, label, entityType })),
    properties: projection.properties.map(row => ({
      ref: row[0], subjectRef: row[1], fieldPath: row[2], label: row[3], availability: row[4],
      knowledgeLevel: row[5], creationMode: row[6], identityRolePropertyRef: row[7]
    })),
    relations: projection.relations.map(([ref, sourceSubjectRef, targetSubjectRef, label]) => ({
      ref, sourceSubjectRef, targetSubjectRef, label
    })),
    authority: "REFERENCE_ONLY_NO_FACT_VALUES",
    noCommit: true,
    version: 1
  };
}

function character(): InterpreterCharacterContextV1 {
  return {
    schemaVersion: 1,
    contractVersion: "interpreter-character-context/2",
    character: { ref: "player-character:j10k2", label: "Personnage de référence" },
    references: [],
    ambiguities: [],
    embodiedProfile: {
      schemaVersion: 1,
      identity: {
        characterRef: "player-character:j10k2",
        label: "Personnage de référence",
        raceRef: "race:reference",
        backgroundRef: "background:reference"
      },
      selfNarrative: {
        biography: null, personality: null, objectives: null, flaws: null, physicalDescription: null
      },
      classification: "PLAYER_AUTHORED_PUBLIC_SELF_CONTEXT"
    },
    authority: "INTERPRETATION_ONLY",
    ownerValidationRequired: true,
    deliberatelyExcluded: []
  };
}

function understoodEnvelope(request: AiCallRequestV1, rawInput: string, guardRef: string): unknown {
  const titleRef = propertyRef("astryade", "/titre_dirigeant");
  const identityRef = propertyRef("astryade", "/identite_dirigeant");
  const frame: AiOpenSemanticFrameV8 = {
    schemaVersion: 1,
    understandingStatus: "UNDERSTOOD",
    overallMeaning: "Le personnage demande au garde qui gouverne le territoire auquel appartient la scène.",
    overallCommitment: "committed",
    globalConditions: [],
    components: [{
      componentId: "c1",
      order: 1,
      meaning: "Demander au garde l'identité de la personne qui gouverne le territoire actuel.",
      commitment: "committed",
      conditions: [],
      negated: false,
      quoted: false,
      relationToPrevious: "NONE",
      alternativeGroupId: null,
      dependsOnComponentIds: [],
      simultaneousWithComponentIds: [],
      supersedesComponentIds: [],
      mentionedTargets: [
        { surface: "vous", proposedRef: guardRef },
        { surface: "le pays", proposedRef: "lore-entity:astryade" }
      ],
      suggestedDomain: "social",
      suggestedAction: "Demander au garde qui gouverne le territoire actuel.",
      suggestedCapabilityId: "scene.visible-dialogue",
      dialogueAct: {
        act: "ASK_QUESTION",
        contentGoal: "Obtenir l'identité de la personne qui gouverne le territoire actuel."
      },
      informationNeed: {
        schemaVersion: 1,
        contractVersion: "information-need/2",
        subjectMention: "le pays",
        proposedSubjectRef: "lore-entity:astryade",
        proposedScopeRefs: ["lore-entity:astryade"],
        proposedPropertyRefs: [titleRef, identityRef],
        proposedRelationRefs: [],
        completionPropertyRefs: [titleRef, identityRef],
        requestedDimension: "l'identité de la personne qui gouverne actuellement",
        temporalScope: "CURRENT",
        requestedAnswerShape: "IDENTITY",
        sourceComponentId: "c1"
      }
    }],
    ambiguities: [],
    clarificationQuestion: null,
    confidence: "high"
  };
  return {
    schemaVersion: 1,
    contractVersion: request.contractVersion,
    outputId: `output:${request.attemptId}`,
    callId: request.callId,
    attemptId: request.attemptId,
    packId: request.packId,
    snapshotId: request.snapshotId,
    role: request.role,
    status: "OK",
    payload: { rawInputEcho: rawInput, semanticFrame: frame },
    diagnostics: [],
    supersedesOutputId: null
  };
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
