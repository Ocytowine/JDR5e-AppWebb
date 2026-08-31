import assert from "node:assert/strict";
import generatedNarrativeLoreCatalog from "../../../src/narration-ui/generated/narrativeLoreCatalog.generated.json";
import type { AiCallRequestV1 } from "../../src/ai";
import type { NarrativeLoreBuildCatalogV1 } from "../../src/context";
import {
  buildPlayableSceneFromLoreLocationV1,
  buildLoreInformationSemanticCatalogV1,
  createCampaignMissingInformationFactCreationRuntimeV1,
  createCampaignNpcInformationRuntimeV1,
  createPrototypeNarrativeTurnControllerV1,
  type NarrativeTurnControllerOutputV1
} from "../../src/application";
import {
  createConversationSemanticConfigH0,
  dialogueFixtureH0
} from "../fixtures/conversation-semantic-fixtures-h0";

async function main(): Promise<void> {
  const catalog = generatedNarrativeLoreCatalog as unknown as NarrativeLoreBuildCatalogV1;
  const archive = catalog.entities.find(entity => entity.entityId === "archives_de_lysenthe");
  assert.ok(archive);
  const scene = buildPlayableSceneFromLoreLocationV1({ entity: archive, fragments: catalog.fragments }).scene;
  const guard = scene.ambientPopulation.find(actor => /garde/iu.test(actor.publicRole));
  assert.ok(guard);
  const targetRef = `npc:${guard.actorId}`;
  const rawInput = "Savez-vous qui dirige la ville ?";
  const rulerInput = "Qui est le roi ?";
  let observedCreation: { status: string; reason: string } | null = null;
  let generatedIdentityCalls = 0;
  const informationNeed = {
    schemaVersion: 1 as const,
    contractVersion: "information-need/2" as const,
    subjectMention: "la ville",
    proposedSubjectRef: "lore-entity:lysenthe",
    proposedScopeRefs: ["lore-entity:lysenthe"],
    proposedPropertyRefs: [
      "lore-property:lysenthe:type_gouvernance",
      "lore-property:lysenthe:siege_pouvoir",
      "lore-property:chateau_tharqual:proprietaire_principal"
    ],
    proposedRelationRefs: ["lore-edge:lysenthe:siege_pouvoir:chateau_tharqual"],
    completionPropertyRefs: [
      "lore-property:lysenthe:type_gouvernance",
      "lore-property:lysenthe:siege_pouvoir",
      "lore-property:chateau_tharqual:proprietaire_principal"
    ],
    requestedDimension: "personne ou autorité qui dirige actuellement la ville",
    temporalScope: "CURRENT" as const,
    requestedAnswerShape: "IDENTITY" as const,
    sourceComponentId: "h0:j10i7-controller"
  };
  const intentInterpreterConfig = createConversationSemanticConfigH0([dialogueFixtureH0({
      fixtureId: "j10i7-controller",
      rawInput,
      meaning: "Le personnage demande au garde quelle autorité dirige actuellement Lysenthe.",
      targetRef,
      targetSurface: "le garde",
      dialogueAct: "ASK_QUESTION",
      informationNeed
    }), dialogueFixtureH0({
      fixtureId: "j10j3-controller-ruler",
      rawInput: rulerInput,
      meaning: "Le personnage demande au garde l'identité de la personne qui dirige actuellement Astryade.",
      targetRef,
      targetSurface: "le garde",
      dialogueAct: "ASK_QUESTION",
      informationNeed: {
        schemaVersion: 1,
        contractVersion: "information-need/2",
        subjectMention: "le roi",
        proposedSubjectRef: "lore-entity:astryade",
        proposedScopeRefs: ["lore-entity:astryade"],
        proposedPropertyRefs: [
          "lore-property:astryade:titre_dirigeant",
          "lore-property:astryade:identite_dirigeant"
        ],
        proposedRelationRefs: [],
        completionPropertyRefs: [
          "lore-property:astryade:titre_dirigeant",
          "lore-property:astryade:identite_dirigeant"
        ],
        requestedDimension: "identité publique de la personne qui dirige actuellement le territoire",
        temporalScope: "CURRENT",
        requestedAnswerShape: "IDENTITY",
        sourceComponentId: "h0:j10j3-controller-ruler"
      }
    })]);
  intentInterpreterConfig.informationCatalogForScene = () => buildLoreInformationSemanticCatalogV1({
    catalog,
    anchorEntityId: "archives_de_lysenthe"
  });
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig,
    mjPlannerConfig: null,
    sceneTransitionRuntime: null,
    initialScene: { scene, locationRef: "location:archives_de_lysenthe" },
    activeSceneResolver: { async resolve() { return { ok: true as const, value: scene }; } },
    npcInformationRuntimeFactory: ({ repository, campaignId }) => {
      const runtime = createCampaignNpcInformationRuntimeV1({
      catalog,
      repository,
      campaignId,
      missingInformationFactCreationRuntime: createCampaignMissingInformationFactCreationRuntimeV1({
        catalog,
        repository,
        campaignId,
        generatorConfig: {
          provider: {
            async generate(request: AiCallRequestV1) {
              generatedIdentityCalls += 1;
              const target = request.input.roleContextPack as { target: { propertyRef: string; valueKind: "TEXT" | "IDENTITY" } };
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
                payload: {
                  proposalId: `proposal:${request.operationId}`,
                  propertyRef: target.target.propertyRef,
                  valueKind: target.target.valueKind,
                  generatedValue: "Maëlys Varne",
                  authority: "PROPOSE_ONLY_NO_COMMIT"
                },
                diagnostics: [],
                supersedesOutputId: null
              };
            }
          },
          route: {
            schemaVersion: 1, routeId: "test:j10j3-controller", role: "scene_creator", providerKind: "FAKE_CONTRACT", providerId: "fake",
            modelId: "fake", modelConfigVersion: "j10j3-controller", certified: true,
            allowedContractVersions: ["missing-information-fact-proposal/1"], inputTokenLimit: 2_000, outputTokenLimit: 600, timeoutMs: 5_000, fallbackRouteIds: []
          },
          retryPolicy: { schemaVersion: 1, role: "scene_creator", maxTechnicalRetries: 0, maxTargetedCorrections: 0, maxFullRegenerations: 0, allowFallback: false }
        }
      }),
      anchorEntityIdForScene: () => "archives_de_lysenthe",
      localityRefsForScene: () => ["lore-entity:archives_de_lysenthe", "lore-entity:lysenthe", "lore-entity:astryade"]
      });
      return {
        async resolve(input) {
          const result = await runtime.resolve(input);
          if (input.need.sourceComponentId === "h0:j10j3-controller-ruler") {
            observedCreation = result.creation === null
              ? null
              : { status: result.creation.status, reason: result.creation.reason };
          }
          return result;
        }
      };
    }
  });
  const first = await controller.submit({ schemaVersion: 1, clientRequestId: "j10i7-controller", rawInput });
  if (!first.ok) throw new Error(first.error.messageKey);
  const output = first.value.output as NarrativeTurnControllerOutputV1 & {
    npcInformationDiagnostic?: { status?: string; disclosure?: { decision?: string } } | null;
    npcEffectivePerformance?: NarrativeTurnControllerOutputV1["npcPerformance"];
  };
  assert.equal(output.resolution.resultKind, "COMMIT_APPLIED");
  assert.equal(output.npcInformationDiagnostic?.status, "RESOLVED");
  assert.equal(output.npcInformationDiagnostic?.disclosure?.decision, "ANSWER_DIRECTLY");
  assert.match(output.npcEffectivePerformance?.utterances[0]?.text ?? "", /Tharque regent de Lysenthe/iu);
  assert.match(output.displayPacket.displayBlocks.find(block => block.kind === "NPC_SPEECH")?.text ?? "", /Tharque regent de Lysenthe/iu);
  assert.doesNotMatch(JSON.stringify(output.npcInformationDiagnostic), /(?:secret|private|hidden):/iu);

  const replay = await controller.submit({ schemaVersion: 1, clientRequestId: "j10i7-controller", rawInput });
  if (!replay.ok) throw new Error(replay.error.messageKey);
  assert.equal(replay.value.operation.operationId, first.value.operation.operationId);
  assert.equal(replay.value.output.displayPacket.displayBlocks.find(block => block.kind === "NPC_SPEECH")?.text,
    output.displayPacket.displayBlocks.find(block => block.kind === "NPC_SPEECH")?.text);

  const ruler = await controller.submit({ schemaVersion: 1, clientRequestId: "j10j3-controller-ruler", rawInput: rulerInput });
  if (!ruler.ok) throw new Error(ruler.error.messageKey);
  const rulerOutput = ruler.value.output as NarrativeTurnControllerOutputV1 & {
    npcInformationDiagnostic?: { status?: string; disclosure?: { decision?: string } } | null;
    npcEffectivePerformance?: NarrativeTurnControllerOutputV1["npcPerformance"];
  };
  assert.deepEqual(observedCreation, { status: "PREPARED", reason: "PARENT_OPERATION_ATOMIC_COMMIT" });
  assert.equal(rulerOutput.npcInformationDiagnostic?.status, "RESOLVED");
  assert.equal(rulerOutput.npcInformationDiagnostic?.disclosure?.decision, "ANSWER_DIRECTLY");
  assert.match(rulerOutput.npcEffectivePerformance?.utterances[0]?.text ?? "", /Maëlys Varne/u);
  assert.match(rulerOutput.npcEffectivePerformance?.utterances[0]?.text ?? "", /Primarque d'Astryade/u);
  assert.doesNotMatch(rulerOutput.npcEffectivePerformance?.utterances[0]?.text ?? "", /hausser le ton|formulez votre demande/iu);
  const rulerFollowUp = await controller.submit({ schemaVersion: 1, clientRequestId: "j10j3-controller-ruler-follow-up", rawInput: rulerInput });
  if (!rulerFollowUp.ok) throw new Error(rulerFollowUp.error.messageKey);
  assert.match(rulerFollowUp.value.output.displayPacket.displayBlocks.find(block => block.kind === "NPC_SPEECH")?.text ?? "", /Maëlys Varne/u);
  assert.equal(generatedIdentityCalls, 1, "the next operation must read the atomically persisted identity instead of generating it again");

  console.log("npc-information-controller/J10-I7+J10-J3: OK (real controller, institutional selector path, controlled identity creation, grounded answer, stable replay)");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
