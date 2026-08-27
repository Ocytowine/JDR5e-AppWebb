import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AiCallRequestV1, ContractAiProviderV1 } from "../../src/ai";
import {
  LocalNpcPerformerProviderV1,
  createDefaultNpcPerformerConfigV1,
  createPrototypeNarrativeTurnControllerV1,
  validateInformationNeedV1,
  validateNpcInformationResolutionV1,
  type InformationNeedV1,
  type NpcInformationResolutionV1
} from "../../src/application";
import { buildArchiveLorePilotV1 } from "../../../src/narration-ui/archiveLorePilot";
import {
  createConversationSemanticConfigH0,
  dialogueFixtureH0
} from "../fixtures/conversation-semantic-fixtures-h0";
import { NPC_INFORMATION_CORPUS_J10I0 } from "../fixtures/npc-information-corpus-j10i0";

interface CapturedKnowledgeEnvelope {
  allowedSourceRefs?: string[];
  allowedSubjectRefs?: string[];
  publicFactRefs?: string[];
  authorizedActorKnowledge?: {
    actorRef?: string;
    knownFactRefs?: string[];
    resolvedClaims?: unknown[];
    claimPerspectives?: unknown[];
    legacyBeliefs?: unknown[];
  };
  visibleSituation?: {
    visibleActor?: {
      actorId?: string;
      publicRole?: string;
      knowledgeRefs?: string[];
    } | null;
  };
}

interface CapturedPerformerTask {
  actorId?: string;
  dialogueAct?: { act?: string; contentGoal?: string } | null;
  knowledgeEnvelope?: CapturedKnowledgeEnvelope;
}

async function main(): Promise<void> {
  verifyPassiveContracts();
  verifyEvaluationCorpus();

  const archivePilot = await buildArchiveLorePilotV1();
  const archiveScene = archivePilot.scene;
  const guard = archiveScene.ambientPopulation.find(actor => /garde/iu.test(actor.publicRole));
  assert.ok(guard, "la scène lore réelle doit contenir un garde ambiant");
  assert.ok(guard.knowledgeRefs.length > 0, "le garde doit porter les références locales produites par la scène");
  assert.ok(archivePilot.influencePacket.geographicChain.includes("lysenthe"));
  assert.ok(
    archivePilot.facts.some(fragment =>
      fragment.entityId === "chateau_tharqual"
      && fragment.fieldPath === "/proprietaire_principal"
      && /Tharque regent de Lysenthe/iu.test(fragment.text)
    ),
    "le catalogue lore connaît déjà l'autorité locale même si le paquet descriptif borné peut l'évincer"
  );

  const targetRef = `npc:${guard.actorId}`;
  const rawInput = "je lui demande qui dirige Lysenthe";
  const semanticConfig = createConversationSemanticConfigH0([dialogueFixtureH0({
    fixtureId: "j10i0-who-rules-lysenthe",
    rawInput,
    meaning: "Le personnage demande au garde qui dirige actuellement Lysenthe.",
    targetRef,
    targetSurface: "lui",
    dialogueAct: "ASK_QUESTION"
  })]);
  const capturedTasks: CapturedPerformerTask[] = [];
  const localPerformer = new LocalNpcPerformerProviderV1();
  const capturingProvider: ContractAiProviderV1 = {
    async generate(request: AiCallRequestV1): Promise<unknown> {
      capturedTasks.push(structuredClone(request.input.task as CapturedPerformerTask));
      return localPerformer.generate(request);
    }
  };
  const performerConfig = createDefaultNpcPerformerConfigV1();
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: semanticConfig,
    mjPlannerConfig: null,
    npcPerformerConfig: { ...performerConfig, provider: capturingProvider },
    sceneTransitionRuntime: null,
    initialScene: { scene: archiveScene, locationRef: archivePilot.locationRef },
    activeSceneResolver: {
      async resolve() {
        return { ok: true as const, value: archiveScene };
      }
    }
  });
  const submitted = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j10i0-who-rules-lysenthe",
    rawInput
  });
  if (!submitted.ok) throw new Error(submitted.error.messageKey);
  const output = submitted.value.output;
  assert.equal(output.interpretation.openSemanticFrame?.components[0]?.dialogueAct?.act, "ASK_QUESTION");
  assert.equal(output.resolution.interpretation.semanticIntent.dialogueAct?.act, "ASK_QUESTION");
  assert.deepEqual(output.domainCommand?.targetRefs, [targetRef]);
  assert.equal(output.resolution.resultKind, "COMMIT_APPLIED", "le dialogue est déjà compris, routé et committé");
  assert.ok(output.npcPerformance, "le blocage se situe dans la connaissance, pas dans l'appel du performer");

  const captured = capturedTasks[0];
  assert.ok(captured, "le knowledgeEnvelope exact du garde doit être capturé");
  assert.equal(captured.actorId, targetRef);
  assert.equal(captured.dialogueAct?.act, "ASK_QUESTION");
  const envelope = captured.knowledgeEnvelope;
  assert.ok(envelope, "le performer doit recevoir une enveloppe de connaissance");
  assert.deepEqual(
    envelope.visibleSituation?.visibleActor?.knowledgeRefs,
    guard.knowledgeRefs,
    "les knowledgeRefs existent encore sur l'acteur visible"
  );
  assert.deepEqual(
    guard.knowledgeRefs.filter(ref => envelope.allowedSourceRefs?.includes(ref)),
    [],
    "baseline J10-I0 : aucune knowledgeRef locale du garde n'est autorisée comme source de parole"
  );
  assert.deepEqual(
    envelope.publicFactRefs,
    [`playable-scene:${archiveScene.sceneId}`],
    "la projection factuelle publique se réduit actuellement à la référence générique de scène"
  );
  assert.deepEqual(envelope.authorizedActorKnowledge?.knownFactRefs, []);
  assert.deepEqual(envelope.authorizedActorKnowledge?.resolvedClaims, []);

  const reply = output.npcPerformance.utterances.map(utterance => utterance.text).join(" ");
  assert.doesNotMatch(reply, /Tharque|Ch[aâ]teau Tharqual/iu);
  assert.match(reply, /ne (?:peux|peut)|rien confirmer|vérifi/iu, "la baseline reproduit l'esquive factuelle actuelle");

  verifyExecutableInventory();
  console.log("npc-factual-knowledge-baseline/J10-I0: OK (dialogue routé, savoir local perdu avant performer, esquive reproduite, contrats passifs valides)");
}

function verifyEvaluationCorpus(): void {
  assert.ok(NPC_INFORMATION_CORPUS_J10I0.length >= 12);
  assert.equal(new Set(NPC_INFORMATION_CORPUS_J10I0.map(entry => entry.caseId)).size, NPC_INFORMATION_CORPUS_J10I0.length);
  assert.equal(new Set(NPC_INFORMATION_CORPUS_J10I0.map(entry => entry.rawInput)).size, NPC_INFORMATION_CORPUS_J10I0.length);
  const factual = NPC_INFORMATION_CORPUS_J10I0.filter(entry => entry.expectsInformationNeed);
  const nonFactual = NPC_INFORMATION_CORPUS_J10I0.filter(entry => !entry.expectsInformationNeed);
  assert.ok(factual.length >= 8);
  assert.ok(nonFactual.length >= 4);
  for (const entry of factual) {
    assert.ok(entry.subjectMention?.trim());
    assert.ok(entry.requestedDimension?.trim());
    assert.ok(entry.temporalScope);
    assert.notEqual(entry.expectedPath, "NON_FACTUAL");
  }
  for (const expectedPath of ["EXISTING_PUBLIC", "MISSING_CREATABLE", "ROLE_EXPECTED", "TESTIMONY_QUALIFIED", "PROTECTED", "ACTOR_MAY_NOT_KNOW", "NON_FACTUAL"] as const) {
    assert.ok(NPC_INFORMATION_CORPUS_J10I0.some(entry => entry.expectedPath === expectedPath), `couverture manquante: ${expectedPath}`);
  }
}

function verifyPassiveContracts(): void {
  const need: InformationNeedV1 = {
    schemaVersion: 1,
    contractVersion: "information-need/1",
    subjectMention: "Lysenthe",
    proposedSubjectRef: "place:lysenthe",
    requestedDimension: "dirigeant actuel",
    temporalScope: "CURRENT",
    requestedAnswerShape: "IDENTITY",
    sourceComponentId: "h0:j10i0-who-rules-lysenthe"
  };
  assert.equal(validateInformationNeedV1(need).ok, true);
  assert.equal(validateInformationNeedV1({ ...need, requestedDimension: "" }).ok, false);

  const receipt: NpcInformationResolutionV1 = {
    schemaVersion: 1,
    contractVersion: "npc-information-resolution/1",
    resolutionId: "information-resolution:j10i0-lysenthe-ruler",
    actorRef: "actor:archive-guard",
    need,
    candidates: [{
      schemaVersion: 1,
      candidateId: "information-candidate:lysenthe-ruler-title",
      subjectRef: "place:lysenthe",
      property: "dirigeant actuel",
      value: "Tharque régent de Lysenthe",
      authority: "LORE_INITIAL",
      visibility: "PLAYER_VISIBLE",
      sourceRefs: ["lore-fragment:lysenthe-government"]
    }],
    selectedCandidateIds: ["information-candidate:lysenthe-ruler-title"],
    missingDimensions: ["nom personnel du titulaire"],
    actorKnowledge: {
      status: "KNOWS",
      bases: ["LOCAL_FAMILIARITY", "ROLE_EXPECTED"],
      sourceRefs: ["lore-fragment:lysenthe-government"]
    },
    disclosure: {
      decision: "ANSWER_DIRECTLY",
      reason: "Le titre du dirigeant est public et normalement connu d'un garde local.",
      sourceRefs: ["lore-fragment:lysenthe-government"]
    },
    creation: {
      status: "REQUIRED_NOT_EXECUTED",
      proposalRefs: []
    },
    authority: "FACT_LOOKUP_AND_DISCLOSURE_RECEIPT_ONLY",
    performerMayCreateFacts: false,
    version: 1
  };
  assert.equal(validateNpcInformationResolutionV1(receipt).ok, true);
  assert.equal(validateNpcInformationResolutionV1({
    ...receipt,
    performerMayCreateFacts: true
  } as unknown as NpcInformationResolutionV1).ok, false);
  assert.equal(validateNpcInformationResolutionV1({
    ...receipt,
    selectedCandidateIds: ["information-candidate:unknown"]
  }).ok, false);
}

function verifyExecutableInventory(): void {
  const producer = readFileSync(resolve("narration-module/src/application/lorePlayableScene.ts"), "utf8");
  const actorProjection = readFileSync(resolve("narration-module/src/application/ambientScenePresence.ts"), "utf8");
  const performer = readFileSync(resolve("narration-module/src/application/npcPerforming.ts"), "utf8");
  assert.match(producer, /const knowledgeRefs = visibleFragments\.map/u);
  assert.match(actorProjection, /knowledgeRefs: \[\.\.\.input\.knowledgeRefs\]/u);
  assert.match(performer, /allowedSourceRefs/u);
  assert.match(performer, /publicFactRefs/u);
  assert.match(performer, /authorizedActorKnowledge/u);
  assert.doesNotMatch(
    performer,
    /\.\.\.\(?visibleActor\.knowledgeRefs|\.\.\.\(?task\.knowledgeEnvelope\.visibleSituation\.visibleActor\.knowledgeRefs/u,
    "J10-I0 fige l'absence de consommation directe des knowledgeRefs visibles"
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
