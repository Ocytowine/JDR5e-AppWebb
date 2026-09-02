import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type { AiCallRequestV1, AiOpenSemanticFrameV8 } from "../../src/ai/types";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
  buildInterpreterRuntimeContextV1,
  buildLoreInformationSemanticCatalogV1,
  buildPlayerPublicContextV1,
  buildSceneReferentRegistryV1,
  interpretNarrativeInputWithAiV1,
  toSceneReferentRoleViewV1,
  type AiIntentInterpreterConfigV1,
  type InterpreterCharacterContextV1,
  type LocalInteractionFocusV1
} from "../../src/application";
import { buildArchiveLorePilotV1 } from "../../../src/narration-ui/archiveLorePilot";
import { CONTEXT_CORPUS_J10K0 } from "../fixtures/context-corpus-j10k0";

const require = createRequire(import.meta.url);
const serverRoute = require("../../server/narrativeOpenAiEnhancementRoute.js") as {
  buildRoleInstructions(request: AiCallRequestV1): string;
  buildStrictAiOutputSchema(request: AiCallRequestV1): unknown;
  buildOpenAiResponsesBody(
    request: AiCallRequestV1,
    route: { modelId: string; reasoningEffort: string | null }
  ): unknown;
};

interface SectionMeasure {
  characters: number;
  approximateTokens: number;
}

async function main(): Promise<void> {
  const pilot = await buildArchiveLorePilotV1();
  const scene = pilot.scene;
  const guard = scene.ambientPopulation.find(actor => /garde/iu.test(actor.publicRole));
  assert.ok(guard, "la scène réelle des Archives doit exposer son garde");
  const guardRef = `npc:${guard.actorId}`;
  const characterContext = buildCharacterContext();
  const playerPublicContext = buildPlayerPublicContextV1({
    activeScene: scene,
    characterContext
  });
  const informationCatalog = buildLoreInformationSemanticCatalogV1({
    catalog: pilot.catalog,
    anchorEntityId: "archives_de_lysenthe"
  });
  assert.ok(informationCatalog, "le catalogue sémantique des Archives doit être construit");
  const corpusById = new Map(CONTEXT_CORPUS_J10K0.map(entry => [entry.caseId, entry] as const));
  for (const caseId of ["current-country", "current-city", "current-region"] as const) {
    const expectedRef = corpusById.get(caseId)?.expectedSubjectRef;
    assert.ok(
      informationCatalog.subjects.some(subject => subject.ref === expectedRef),
      `${caseId}: la référence attendue doit déjà être disponible dans le contexte public`
    );
  }
  assert.equal(corpusById.get("genuine-ambiguity")?.expectedUnderstanding, "NEEDS_CLARIFICATION");

  const focus: LocalInteractionFocusV1 = {
    schemaVersion: 1,
    contractVersion: "local-interaction-focus/1",
    sceneId: scene.sceneId,
    sceneVersion: scene.version,
    targetRef: guardRef,
    targetDisplayName: guard.displayName,
    mode: "DIALOGUE",
    publicSummary: `Le personnage échange avec ${guard.displayName}.`,
    openedByOperationId: "operation:j10k0:greeting",
    lastConfirmedOperationId: "operation:j10k0:permission",
    status: "ACTIVE",
    closureReason: null
  };
  const recentTurns = [
    {
      schemaVersion: 1 as const,
      operationId: "operation:j10k0:permission",
      semanticKind: "address_visible_actor" as const,
      playerGoal: `Demander à ${guard.displayName} la permission de poser une question.`,
      primaryTarget: { kind: "npc" as const, ref: guardRef, label: guard.displayName },
      topic: null,
      commitment: "committed" as const
    },
    {
      schemaVersion: 1 as const,
      operationId: "operation:j10k0:greeting",
      semanticKind: "address_visible_actor" as const,
      playerGoal: `S'approcher de ${guard.displayName} et le saluer.`,
      primaryTarget: { kind: "npc" as const, ref: guardRef, label: guard.displayName },
      topic: null,
      commitment: "committed" as const
    }
  ];
  const rawInput = corpusById.get("current-country")?.rawInput ?? "";
  let capturedRequest: AiCallRequestV1 | null = null;
  const provider: ContractAiProviderV1 = {
    async generate(request: AiCallRequestV1): Promise<unknown> {
      capturedRequest = structuredClone(request);
      return clarificationEnvelope(request, rawInput, guardRef);
    }
  };
  const config: AiIntentInterpreterConfigV1 = {
    provider,
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
    route: {
      schemaVersion: 1,
      routeId: "route:j10k0-baseline",
      role: "player_intent_interpreter",
      providerKind: "FAKE_CONTRACT",
      providerId: "fixture:j10k0",
      modelId: "gpt-5.6-luna",
      modelConfigVersion: "j10k0",
      certified: true,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8],
      inputTokenLimit: 2_000,
      outputTokenLimit: 900,
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
    informationCatalogForScene: () => informationCatalog
  };
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
    campaignId: "campaign:j10k0",
    operationId: "operation:j10k0:country",
    intentId: "intent:j10k0:country",
    rawInput,
    config,
    playableScene: scene,
    characterContext,
    playerPublicContext,
    recentSemanticTurns: recentTurns,
    localReferentHints: [{
      schemaVersion: 1,
      sceneId: scene.sceneId,
      sceneVersion: scene.version,
      target: { kind: "npc", ref: guardRef, label: guard.displayName },
      sourceOperationId: "operation:j10k0:permission",
      sourceText: "",
      confidence: "high"
    }],
    localInteractionFocus: focus,
    runtimeContext,
    activeCompanionRefs: []
  });
  assert.equal(result.interpretation.openSemanticFrame?.understandingStatus, "NEEDS_CLARIFICATION");
  assert.ok(capturedRequest, "la requête V8 doit être capturée avant toute mesure");
  if (capturedRequest === null) throw new Error("missing captured request");

  const currentRequest = capturedRequest as AiCallRequestV1;
  const currentTask = currentRequest.input.task as Record<string, unknown>;
  const currentEmbodied = currentTask.embodiedContext as Record<string, unknown>;
  const legacyReferentView = toSceneReferentRoleViewV1(
    buildSceneReferentRegistryV1(scene),
    "player_intent_interpreter"
  );
  const legacyRoleContextPack = {
    schemaVersion: 1,
    sceneId: scene.sceneId,
    visibleReferents: legacyReferentView.referents.map(referent => ({
      ref: referent.canonicalRef,
      kind: referent.kind,
      name: referent.displayName,
      aliases: referent.publicAliases,
      publicProperties: referent.publicProperties,
      destinations: referent.publicDestinationAliases
    })),
    authority: "SEMANTIC_INTERPRETATION_ONLY"
  };
  const legacyEmbodied = {
    ...currentEmbodied,
    informationCatalog: structuredClone(informationCatalog)
  };
  const legacyTask = {
    ...currentTask,
    embodiedContext: legacyEmbodied
  };
  const request = {
    ...currentRequest,
    input: {
      ...currentRequest.input,
      roleContextPack: legacyRoleContextPack,
      task: legacyTask
    }
  } satisfies AiCallRequestV1;
  const task = request.input.task as Record<string, unknown>;
  const roleContextPack = request.input.roleContextPack as {
    sceneId?: string;
    visibleReferents?: Array<{ ref?: string }>;
  };
  const embodied = task.embodiedContext as {
    currentScene?: { sceneId?: string; presentActors?: Array<{ actorRef?: string }> };
    informationCatalog?: {
      subjects?: unknown[];
      properties?: unknown[];
      relations?: unknown[];
    };
    [key: string]: unknown;
  };
  assert.equal(roleContextPack.sceneId, embodied.currentScene?.sceneId, "K0 fige la duplication résiduelle de l'identité de scène");
  const roleActorRefs = new Set((roleContextPack.visibleReferents ?? []).flatMap(entry =>
    typeof entry.ref === "string" ? [canonicalActorRef(entry.ref)] : []
  ));
  const embodiedActorRefs = new Set((embodied.currentScene?.presentActors ?? []).flatMap(entry =>
    typeof entry.actorRef === "string" ? [canonicalActorRef(entry.actorRef)] : []
  ));
  const duplicateActorRefs = [...roleActorRefs].filter(ref => embodiedActorRefs.has(ref)).sort();
  assert.ok(duplicateActorRefs.length >= 3, "K0 doit détecter les acteurs de scène présents dans les deux projections V8");
  assert.ok(duplicateActorRefs.includes(canonicalActorRef(guardRef)), "le garde actif doit faire partie des doublons mesurés");
  assert.equal(request.limits.inputTokenBudget, 2_000, "la baseline reproduit le budget déclaré de l'UI");

  // K0 reste un témoin historique : K2 fait volontairement évoluer les
  // instructions, sans que leur nouveau texte ne réécrive la mesure initiale.
  serverRoute.buildRoleInstructions(request);
  const schema = serverRoute.buildStrictAiOutputSchema(request);
  serverRoute.buildOpenAiResponsesBody(request, {
    modelId: "gpt-5.6-luna",
    reasoningEffort: "none"
  });
  const sections = {
    requestInput: measure(request.input),
    roleContextPack: measure(roleContextPack),
    task: measure(task),
    embodiedContext: measure(embodied),
    informationCatalog: measure(embodied.informationCatalog),
    currentScene: measure(embodied.currentScene),
    instructions: historicalMeasure(7_384),
    outputSchema: measure(schema),
    providerBody: historicalMeasure(33_704)
  };
  const sectionCharacters = Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.characters]));
  assert.deepEqual(
    sectionCharacters,
    {
      requestInput: 18_050,
      roleContextPack: 2_904,
      task: 15_047,
      embodiedContext: 14_817,
      informationCatalog: 7_726,
      currentScene: 916,
      instructions: 7_384,
      outputSchema: 5_944,
      providerBody: 33_704
    },
    `la baseline anonymisée doit signaler toute dérive de volume section par section: ${JSON.stringify(sectionCharacters)}`
  );
  assert.equal(sections.informationCatalog.characters, 7_726, "la taille du catalogue public K0 ne doit pas dériver silencieusement");
  assert.ok(sections.requestInput.characters > 15_000, "la baseline doit reproduire un contexte applicatif volumineux");
  assert.ok(sections.providerBody.approximateTokens > request.limits.inputTokenBudget, "le paquet estimé dépasse déjà le budget déclaré avant l'appel");
  assert.deepEqual(
    {
      subjects: embodied.informationCatalog?.subjects?.length,
      properties: embodied.informationCatalog?.properties?.length,
      relations: embodied.informationCatalog?.relations?.length
    },
    { subjects: 7, properties: 18, relations: 12 }
  );

  console.log(JSON.stringify({
    contractVersion: "narrative-context-baseline/1",
    caseId: "current-country",
    declaredInputTokenBudget: request.limits.inputTokenBudget,
    sections,
    duplication: {
      duplicatedSceneIdentity: true,
      duplicateActorCount: duplicateActorRefs.length,
      duplicateActorRefs
    },
    catalog: { subjects: 7, properties: 18, relations: 12 },
    observedInterpretation: "NEEDS_CLARIFICATION",
    expectedInterpretation: "UNDERSTOOD",
    expectedSubjectRef: "lore-entity:astryade"
  }, null, 2));
}

function buildCharacterContext(): InterpreterCharacterContextV1 {
  return {
    schemaVersion: 1,
    contractVersion: "interpreter-character-context/2",
    character: { ref: "player-character:j10k0", label: "Personnage de référence" },
    references: [],
    ambiguities: [],
    embodiedProfile: {
      schemaVersion: 1,
      identity: {
        characterRef: "player-character:j10k0",
        label: "Personnage de référence",
        raceRef: "race:reference",
        backgroundRef: "background:reference"
      },
      selfNarrative: {
        biography: null,
        personality: null,
        objectives: null,
        flaws: null,
        physicalDescription: null
      },
      classification: "PLAYER_AUTHORED_PUBLIC_SELF_CONTEXT"
    },
    authority: "INTERPRETATION_ONLY",
    ownerValidationRequired: true,
    deliberatelyExcluded: []
  };
}

function clarificationEnvelope(request: AiCallRequestV1, rawInput: string, guardRef: string): unknown {
  const frame: AiOpenSemanticFrameV8 = {
    schemaVersion: 1,
    understandingStatus: "NEEDS_CLARIFICATION",
    overallMeaning: "Le personnage demande au garde de lui dire qui gouverne le pays.",
    overallCommitment: "committed",
    globalConditions: [],
    components: [{
      componentId: "c1",
      order: 1,
      meaning: "Demander au garde l'identité de la personne qui gouverne le pays.",
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
        { surface: "le pays", proposedRef: null }
      ],
      suggestedDomain: "social",
      suggestedAction: "Demander au garde qui gouverne le pays.",
      suggestedCapabilityId: "scene.visible-dialogue",
      dialogueAct: {
        act: "ASK_QUESTION",
        contentGoal: "Obtenir du garde l'identité de la personne qui gouverne le pays."
      },
      informationNeed: null
    }],
    ambiguities: [{
      ambiguityId: "a1",
      summary: "Le pays visé n'est pas identifié de manière suffisamment précise dans le contexte public.",
      affectedComponentIds: ["c1"]
    }],
    clarificationQuestion: "De quel pays voulez-vous parler ?",
    confidence: "medium"
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

function measure(value: unknown): SectionMeasure {
  const characters = JSON.stringify(value).length;
  return { characters, approximateTokens: Math.ceil(characters / 4) };
}

function historicalMeasure(characters: number): SectionMeasure {
  return { characters, approximateTokens: Math.ceil(characters / 4) };
}

function canonicalActorRef(value: string): string {
  return `actor:${value.replace(/^(actor:|npc:)/u, "")}`;
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
