import assert from "node:assert/strict";
import type { AiCallRequestV1, ContractAiProviderV1 } from "../../src/ai";
import {
  LocalNpcPerformerProviderV1,
  createDefaultNpcPerformerConfigV1,
  createPrototypeNarrativeTurnControllerV1,
  type NarrativeTurnControllerOutputV1
} from "../../src/application";
import type { AiNarrativeEnhancementResultV1 } from "../../src/application/aiNarrativeEnhancement";

interface CapturedPerformerTask {
  actorId?: string;
  dialogueAct?: { act?: string };
  mjPlan?: unknown;
  resolution?: unknown;
  sceneState?: unknown;
  knowledgeEnvelope?: {
    priorPlayerSpeech?: Array<{ operationId: string; playerIntentSummary: string }>;
    priorNpcUtterances?: Array<{ text: string; sourceOperationId: string }>;
    dialogueHistory?: Array<{ operationId: string; playerIntentSummary: string; npcUtterances: string[] }>;
  };
}

const capturedTasks: CapturedPerformerTask[] = [];
const localPerformer = new LocalNpcPerformerProviderV1();
const capturingProvider: ContractAiProviderV1 = {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    capturedTasks.push(request.input.task as CapturedPerformerTask);
    return localPerformer.generate(request);
  }
};

async function main(): Promise<void> {
  const baseConfig = createDefaultNpcPerformerConfigV1();
  const controller = await createPrototypeNarrativeTurnControllerV1({
    npcPerformerConfig: { ...baseConfig, provider: capturingProvider }
  });
  const outputs: NarrativeTurnControllerOutputV1[] = [];

  await turn("long-01", "Je dis bonjour à la serveuse.", "Serveuse nerveuse");
  await turn("long-02", "Je lui demande pourquoi elle regarde la porte.", "Serveuse nerveuse");
  await turn("long-03", "Je demande à la serveuse si tout va bien.", "Serveuse nerveuse");
  await turn("long-04", "Je demande à la serveuse ce qu'elle attend.", "Serveuse nerveuse");
  await turn("long-05", "Je lui demande si elle travaille souvent ici.", "Serveuse nerveuse");
  await turn("long-06", "Je lui demande si la pluie l'inquiète.", "Serveuse nerveuse");
  await turn("long-07", "Je m'approche du garde.", null);
  await turn("long-08", "Je dis bonjour au garde.", "Garde blessé");
  await turn("long-09", "Je lui demande s'il a mal.", "Garde blessé");
  await turn("long-10", "Je lui demande encore s'il a mal.", "Garde blessé");
  await turn("long-11", "Je demande à la serveuse si elle a besoin d'aide.", "Serveuse nerveuse");
  const transition = await turn("long-12", "J'essaie d'entrer dans l'arrière-salle discrètement.", null);
  const resumed = await turn("long-13", "Je demande au garde s'il peut m'aider.", "Garde blessé");

  assert.equal(outputs.every(output => output.noGameTime), true, "aucun tour de recette ne fait avancer le temps");
  assert.equal(outputs.every(output =>
    output.npcPerformance === null ||
    (
      output.npcPerformance.durableCommitments.length === 0 &&
      output.npcPerformance.utterances.every(utterance =>
        utterance.speechActs.every(act => act.sourceRefs.some(ref => ref.startsWith("intent:")))
      )
    )
  ), true, "une parole PNJ reste attribuée à l'intention et ne crée aucun engagement durable");
  assert.equal(capturedTasks[0]?.dialogueAct?.act, "INITIATE_CONVERSATION", "la salutation ouvre le contact sans devenir une question");
  assert.equal(capturedTasks.every(task => task.mjPlan === undefined && task.resolution === undefined && task.sceneState === undefined), true, "le paquet performer ne duplique plus les agrégats et plans complets");
  assert.equal(transition.resolution.resultKind, "HANDOFF_REQUIRED", "la transition de scène fermée produit un handoff");
  assert.equal(transition.noCommit, true, "la transition fermée ne committe rien");
  assert.equal(transition.domainCommand?.payload.runtimeRouteDisposition, "HANDOFF");
  assert.equal(transition.displayPacket.displayBlocks.some(block => /tu entres|tu pénètres|te voilà dans/iu.test(block.text)), false, "aucune entrée fictive dans l'arrière-salle");
  assert.equal(resumed.resolution.resultKind, "COMMIT_APPLIED", "la conversation reprend après le handoff sans campagne occupée");

  const waitressReturnTask = capturedTasks.findLast(task => task.actorId === "npc:npc-serveuse-nerveuse");
  assert.ok(waitressReturnTask, "paquet performer du retour à la serveuse attendu");
  assert.equal(waitressReturnTask.knowledgeEnvelope?.priorNpcUtterances?.length, 5, "seules les cinq dernières répliques réellement affichées de la serveuse sont rappelées");
  assert.equal(waitressReturnTask.knowledgeEnvelope?.dialogueHistory?.length, 5, `les cinq derniers couples intention-réponse de la serveuse restent couplés; paquet=${JSON.stringify(waitressReturnTask.knowledgeEnvelope)}`);
  assert.equal(waitressReturnTask.knowledgeEnvelope?.dialogueHistory?.some(entry => entry.operationId.includes("long-01")), false, "le plus ancien échange est évincé à la limite de mémoire");
  assert.equal(waitressReturnTask.knowledgeEnvelope?.priorNpcUtterances?.some(entry => /garde/iu.test(entry.text)), false, "aucune réplique du garde dans la mémoire de la serveuse");

  const guardTasks = capturedTasks.filter(task => task.actorId === "npc:npc-garde-blesse");
  const repeatedGuardTask = guardTasks[2];
  assert.ok(repeatedGuardTask, "troisième prise de parole au garde attendue");
  assert.equal(repeatedGuardTask.knowledgeEnvelope?.priorNpcUtterances?.length, 2, "la répétition reçoit les deux réponses antérieures du garde");
  assert.equal(repeatedGuardTask.knowledgeEnvelope?.dialogueHistory?.length, 2, "la répétition reçoit deux couples intention-réponse");

  const finalMemory = resumed.sceneState.shortTermNpcMemory;
  assert.equal(finalMemory.filter(entry => entry.actorId === "npc-serveuse-nerveuse").length, 5, "mémoire courte de la serveuse bornée à cinq échanges");
  assert.equal(finalMemory.filter(entry => entry.actorId === "npc-garde-blesse").length, 4, "mémoire courte conservée par PNJ pour le garde");
  assert.equal(finalMemory.length, 9, "la limite est appliquée par acteur, sans effacer prématurément l'autre conversation");

  console.log("complete-npc-conversations/nar132: OK (13 tours, 2 PNJ, mémoire 5/acteur, 1 handoff, reprise validée)");

  async function turn(clientRequestId: string, rawInput: string, expectedNpc: string | null): Promise<NarrativeTurnControllerOutputV1> {
    const submitted = await controller.submit({ schemaVersion: 1, clientRequestId, rawInput });
    if (!submitted.ok) throw new Error(`${clientRequestId}: ${submitted.error.messageKey}`);
    const output = submitted.value.output;
    outputs.push(output);
    const npcBlocks = output.displayPacket.displayBlocks.filter(block => block.kind === "NPC_SPEECH");
    if (expectedNpc === null) assert.equal(npcBlocks.length, 0, `${clientRequestId}: aucune parole PNJ inattendue`);
    else assert.equal(npcBlocks[0]?.speaker.displayName, expectedNpc, `${clientRequestId}: locuteur PNJ cohérent; cible=${JSON.stringify(output.interpretation.referentResolution?.resolvedTarget ?? output.interpretation.semanticIntent.target)}`);
    const enhancement: AiNarrativeEnhancementResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-ai-resolution/1",
      enhanced: false,
      usedFallback: false,
      fallbackKind: "NONE",
      displayPacket: output.displayPacket,
      incidents: [],
      safetyNotes: ["Projection locale de recette."]
    };
    const recorded = await controller.recordRenderedProjection({
      schemaVersion: 1,
      clientRequestId: output.clientRequestId,
      sourceOutput: output,
      mode: "local",
      finalEnhancement: enhancement,
      attemptedEnhancement: null,
      statusMessage: "Projection locale de recette enregistrée."
    });
    if (!recorded.ok) throw new Error(`${clientRequestId}: ${recorded.error.messageKey}`);
    return output;
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
