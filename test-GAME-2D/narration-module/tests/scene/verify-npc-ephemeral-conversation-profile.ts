import assert from "node:assert/strict";
import type { AiCallRequestV1, ContractAiProviderV1 } from "../../src/ai";
import {
  LocalNpcPerformerProviderV1,
  createDefaultNpcPerformerConfigV1,
  createPrototypeNarrativeTurnControllerV1
} from "../../src/application";

interface CapturedProfileContract {
  expectedProfileId: string;
  expectedRevision: number;
  expectedContinuitySource: "INITIALIZED" | "CONTINUED";
  outputProfileRef: string;
  priorProfile: {
    actorId: string;
    continuityRevision: number;
    perspectiveSummary: string;
    subjectiveOpinions: Array<{ topic: string; stance: string }>;
    durable: false;
  } | null;
  durablePromotionAllowed: false;
}

async function main(): Promise<void> {
  const local = new LocalNpcPerformerProviderV1();
  const requests: AiCallRequestV1[] = [];
  let performerCall = 0;
  const provider: ContractAiProviderV1 = {
    async generate(request) {
      requests.push(request);
      performerCall += 1;
      const generated = await local.generate(request) as {
        payload: {
          conversationProfile: Record<string, unknown>;
        };
      } & Record<string, unknown>;
      if (performerCall === 1) {
        return {
          ...generated,
          payload: {
            ...generated.payload,
            conversationProfile: {
              ...generated.payload.conversationProfile,
              perspectiveSummary: "Elle voit les conversations comme une pause fragile dans un service qui ne ralentit jamais.",
              currentConcerns: ["Garder un œil sur la porte tout en servant la salle."],
              subjectiveOpinions: [{
                topic: "la pluie",
                stance: "Elle préfère son bruit aux silences trop attentifs de la salle."
              }],
              conversationHooks: ["La pluie.", "Le rythme du service.", "La porte du fond."],
              speechStyle: ["vive", "elliptique"],
              relationshipTone: "CURIOUS"
            }
          }
        };
      }
      if (performerCall === 2) {
        return {
          ...generated,
          payload: {
            ...generated.payload,
            conversationProfile: {
              ...generated.payload.conversationProfile,
              durable: true
            }
          }
        };
      }
      return generated;
    }
  };
  const base = createDefaultNpcPerformerConfigV1();
  const controller = await createPrototypeNarrativeTurnControllerV1({
    npcPerformerConfig: { ...base, provider }
  });

  const first = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "ephemeral-profile-01",
    rawInput: "Je dis bonjour à la serveuse."
  });
  if (!first.ok) throw new Error(first.error.messageKey);
  assert.equal(first.value.output.npcPerformance?.conversationProfile.continuityRevision, 1);
  assert.equal(first.value.output.npcPerformance?.conversationProfile.continuitySource, "INITIALIZED");
  assert.equal(first.value.output.npcPerformance?.conversationProfile.subjectiveOpinions[0]?.topic, "la pluie");
  assert.equal(first.value.output.npcPerformance?.conversationProfile.durable, false);

  const rejected = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "ephemeral-profile-02",
    rawInput: "Je demande à la serveuse si elle aime la pluie."
  });
  if (!rejected.ok) throw new Error(rejected.error.messageKey);
  assert.equal(rejected.value.output.npcPerformance, null, "un profil durable proposé par le modèle doit invalider toute la performance");
  assert.equal(
    rejected.value.output.npcPerformanceFailure?.issues.some(issue => /conversationProfile\.durable/u.test(issue)),
    true
  );

  const continued = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "ephemeral-profile-03",
    rawInput: "Je demande à la serveuse ce qu'elle pense du calme de la salle."
  });
  if (!continued.ok) throw new Error(continued.error.messageKey);
  const continuedTask = requests[2]?.input.task as { conversationProfileContract?: unknown } | undefined;
  const continuedContract = continuedTask?.conversationProfileContract as CapturedProfileContract;
  assert.equal(continuedContract.expectedRevision, 2, "la performance rejetée ne doit pas consommer une révision");
  assert.equal(continuedContract.expectedContinuitySource, "CONTINUED");
  assert.equal(continuedContract.priorProfile?.continuityRevision, 1);
  assert.equal(continuedContract.priorProfile?.subjectiveOpinions[0]?.topic, "la pluie");
  assert.match(continuedContract.priorProfile?.perspectiveSummary ?? "", /pause fragile/u);
  assert.equal(continued.value.output.npcPerformance?.conversationProfile.continuityRevision, 2);
  assert.equal(continued.value.output.npcPerformance?.conversationProfile.durable, false);

  const otherActor = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "ephemeral-profile-04",
    rawInput: "Je demande au garde s'il préfère le silence."
  });
  if (!otherActor.ok) throw new Error(otherActor.error.messageKey);
  const guardTask = requests[3]?.input.task as { conversationProfileContract?: unknown } | undefined;
  const guardContract = guardTask?.conversationProfileContract as CapturedProfileContract;
  assert.equal(guardContract.expectedRevision, 1);
  assert.equal(guardContract.expectedContinuitySource, "INITIALIZED");
  assert.equal(guardContract.priorProfile, null, "un autre acteur ne doit jamais recevoir la personnalité de la serveuse");
  assert.equal(guardContract.durablePromotionAllowed, false);
  assert.equal(requests.every(request => request.role === "npc_performer"), true, "aucun rôle IA supplémentaire ne doit être ajouté");

  console.log("npc-ephemeral-conversation-profile/1: OK (amorçage, rejet, continuité et isolation par acteur)");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
