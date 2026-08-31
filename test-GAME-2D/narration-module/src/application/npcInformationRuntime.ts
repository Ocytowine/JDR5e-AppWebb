import type { AiInformationNeedV8 } from "../ai/types";
import type { NarrativeLoreBuildCatalogV1 } from "../context";
import type { CampaignId, CampaignRepository } from "../core";
import { createCampaignBackedTargetedInformationReaderV1 } from "./campaignInformationLookupRuntime";
import {
  buildNpcInformationActorContextV1,
  composeNpcInformationResolutionV1,
  projectNpcContextualKnowledgeV1
} from "./npcContextualKnowledgeProjection";
import {
  applyNpcInformationDisclosureV1,
  loadNpcDisclosureOwnerContextV1,
  projectNpcInformationDisclosureV1,
  type NpcCredibleInformationAlternativeV1
} from "./npcInformationDisclosure";
import {
  buildNpcInformationPerformerProjectionV1,
  type NpcInformationPerformanceDiagnosticV1,
  type NpcInformationPerformerProjectionV1
} from "./npcInformationPerformance";
import type { NpcInformationResolutionV1 } from "./npcInformationResolution";
import type {
  MissingInformationFactCreationResultV1,
  MissingInformationFactCreationRuntimeV1
} from "./missingInformationFactCreation";
import { loadNpcAuthorizedKnowledgeContextV1 } from "./npcKnowledgeContext";
import type { PlayableSceneAmbientPresenceV1, PlayableSceneStateV1 } from "./playableScene";

export interface NpcInformationTurnResultV1 {
  resolution: NpcInformationResolutionV1;
  performerProjection: NpcInformationPerformerProjectionV1;
  diagnostic: NpcInformationPerformanceDiagnosticV1;
  creation: MissingInformationFactCreationResultV1 | null;
}

export interface NarrativeNpcInformationRuntimeV1 {
  resolve(input: {
    operationId: string;
    actorId: string;
    need: AiInformationNeedV8;
    activeScene: PlayableSceneStateV1;
  }): Promise<NpcInformationTurnResultV1>;
}

export function createCampaignNpcInformationRuntimeV1(input: {
  catalog: NarrativeLoreBuildCatalogV1;
  repository: CampaignRepository;
  campaignId: CampaignId;
  anchorEntityIdForScene(scene: PlayableSceneStateV1): string | null;
  localityRefsForScene(scene: PlayableSceneStateV1): string[];
  credibleAlternatives?: NpcCredibleInformationAlternativeV1[];
  missingInformationFactCreationRuntime?: MissingInformationFactCreationRuntimeV1 | null;
}): NarrativeNpcInformationRuntimeV1 {
  const reader = createCampaignBackedTargetedInformationReaderV1({
    catalog: input.catalog,
    repository: input.repository,
    campaignId: input.campaignId
  });
  return {
    async resolve(request) {
      const campaign = await input.repository.getCampaign(input.campaignId);
      if (!campaign.ok) throw new Error(campaign.error.messageKey);
      const anchorEntityId = input.anchorEntityIdForScene(request.activeScene);
      if (anchorEntityId === null) throw new Error("npc-information.anchor-not-resolved");
      const actor = visibleActor(request.activeScene, request.actorId);
      if (actor === null) throw new Error("npc-information.actor-not-visible");
      const rawActorId = request.actorId.replace(/^actor:/u, "").replace(/^npc:/u, "");
      const actorRef = `actor:${rawActorId}`;
      const lookupRequest: Parameters<typeof reader.lookup>[0] = {
        schemaVersion: 1,
        lookupId: `${request.operationId}:information-lookup`,
        campaignId: input.campaignId,
        campaignRevision: campaign.value.campaignRevision,
        anchorEntityId,
        need: structuredClone(request.need),
        knowledgeRefs: [...actor.knowledgeRefs],
        allowedKnowledgeLevels: ["COMMUN", "LOCAL"]
      };
      let lookup = await reader.lookup(lookupRequest);
      let creation: MissingInformationFactCreationResultV1 | null = null;
      if (lookup.missingProperties.some(property => property.creationMode !== "FORBIDDEN")) {
        creation = input.missingInformationFactCreationRuntime === null || input.missingInformationFactCreationRuntime === undefined
          ? null
          : await input.missingInformationFactCreationRuntime.maybeCreate({
              operationId: request.operationId,
              missingProperties: lookup.missingProperties,
              candidates: lookup.candidates
            });
        if (creation?.status === "CREATED" || creation?.status === "REUSED") {
          const refreshedCampaign = await input.repository.getCampaign(input.campaignId);
          if (!refreshedCampaign.ok) throw new Error(refreshedCampaign.error.messageKey);
          lookup = await reader.lookup({ ...lookupRequest, campaignRevision: refreshedCampaign.value.campaignRevision });
        } else if (creation?.status === "PREPARED" && creation.commitPreparation !== null && creation.commitPreparation.prepared.fact !== null) {
          const fact = creation.commitPreparation.prepared.fact;
          const createdPropertyRef = creation.propertyRef;
          lookup = {
            ...lookup,
            candidates: [...lookup.candidates, {
              schemaVersion: 1,
              candidateId: `information-candidate:${lookup.lookupId}:prepared:${fact.factId}`,
              subjectRef: fact.subjectRef,
              property: fact.predicate,
              value: fact.objectText,
              authority: "CAMPAIGN_FACT",
              visibility: "PLAYER_VISIBLE",
              sourceKnowledgeLevel: fact.knowledgeLevel,
              scopeRefs: [fact.subjectRef],
              sourceRefs: unique([`campaign-fact:${fact.factId}`, ...fact.sourceRefs])
            }],
            missingDimensions: lookup.missingDimensions.filter(dimension => dimension !== createdPropertyRef),
            missingProperties: lookup.missingProperties.filter(property => property.propertyRef !== createdPropertyRef),
            diagnostics: [...lookup.diagnostics, `prepared-parent-commit:${fact.factId}`]
          };
        }
      }
      const authorizedKnowledge = await loadNpcAuthorizedKnowledgeContextV1({
        repository: input.repository,
        campaignId: input.campaignId,
        actorId: rawActorId
      });
      const actorContext = buildNpcInformationActorContextV1({
        actorRef,
        publicRole: actor.publicRole,
        localityRefs: input.localityRefsForScene(request.activeScene),
        visibleKnowledgeRefs: actor.knowledgeRefs,
        authorizedKnowledge
      });
      const knowledge = projectNpcContextualKnowledgeV1({
        projectionId: `${request.operationId}:information-knowledge`,
        actor: actorContext,
        need: request.need,
        candidates: lookup.candidates
      });
      const unresolvedDisclosure = composeNpcInformationResolutionV1({
        resolutionId: `${request.operationId}:information-resolution`,
        actorRef,
        lookup,
        knowledge
      });
      const alternatives = input.credibleAlternatives ?? inferVisibleAlternatives(request.activeScene, request.actorId, request.need);
      const ownerContext = await loadNpcDisclosureOwnerContextV1({
        repository: input.repository,
        campaignId: input.campaignId,
        actorId: rawActorId,
        credibleAlternatives: alternatives
      });
      const disclosure = projectNpcInformationDisclosureV1({
        projectionId: `${request.operationId}:information-disclosure`,
        resolution: unresolvedDisclosure,
        ownerContext
      });
      const disclosedResolution = applyNpcInformationDisclosureV1({ resolution: unresolvedDisclosure, disclosure });
      const resolution: NpcInformationResolutionV1 = creation?.status === "CREATED" || creation?.status === "PREPARED" || creation?.status === "REUSED"
        ? {
            ...disclosedResolution,
            creation: {
              status: "EXECUTED",
              proposalRefs: unique([creation.propertyRef, creation.factId].filter((ref): ref is string => ref !== null))
            }
          }
        : disclosedResolution;
      const performerProjection = buildNpcInformationPerformerProjectionV1({
        disclosure,
        missingProperties: lookup.missingProperties,
        alternativePresentations: disclosure.cause.alternativeActorRefs.flatMap(alternativeRef => {
          const alternative = visibleActor(request.activeScene, alternativeRef);
          return alternative === null ? [] : [{ schemaVersion: 1 as const, actorRef: alternativeRef, displayName: alternative.displayName }];
        })
      });
      return {
        resolution,
        performerProjection,
        creation,
        diagnostic: {
          schemaVersion: 1,
          contractVersion: "npc-information-performance-diagnostic/1",
          status: "RESOLVED",
          failureStage: null,
          failureReason: null,
          lookup: {
            candidateCount: lookup.candidates.length,
            missingDimensions: [...lookup.missingDimensions],
            authorities: unique(lookup.candidates.map(candidate => candidate.authority))
          },
          knowledge: {
            knownCandidateCount: knowledge.knownCandidateIds.length,
            unknownCandidateCount: knowledge.unknownCandidateIds.length,
            bases: [...knowledge.aggregateBases]
          },
          disclosure: {
            decision: disclosure.decision,
            causeCode: disclosure.cause.code,
            authorizedFactCount: disclosure.authorizedFacts.length,
            withheldCandidateCount: disclosure.withheldCandidateCount,
            alternativeActorRefs: [...disclosure.cause.alternativeActorRefs]
          },
          privateValuesIncluded: false
        }
      };
    }
  };
}

function visibleActor(scene: PlayableSceneStateV1, actorIdOrRef: string): {
  actorId: string;
  displayName: string;
  publicRole: string;
  knowledgeRefs: string[];
} | null {
  const id = actorIdOrRef.replace(/^actor:/u, "").replace(/^npc:/u, "");
  const npc = scene.presentNpc.find(candidate => candidate.actorId.replace(/^npc:/u, "") === id);
  if (npc !== undefined) return { actorId: npc.actorId, displayName: npc.displayName, publicRole: npc.publicRole, knowledgeRefs: [] };
  const ambient = scene.ambientPopulation.find(candidate => candidate.actorId.replace(/^npc:/u, "") === id);
  return ambient === undefined ? null : ambientActor(ambient);
}

function ambientActor(actor: PlayableSceneAmbientPresenceV1): {
  actorId: string;
  displayName: string;
  publicRole: string;
  knowledgeRefs: string[];
} {
  return { actorId: actor.actorId, displayName: actor.displayName, publicRole: actor.publicRole, knowledgeRefs: [...actor.knowledgeRefs] };
}

function inferVisibleAlternatives(
  scene: PlayableSceneStateV1,
  excludedActorId: string,
  need: AiInformationNeedV8
): NpcCredibleInformationAlternativeV1[] {
  if (need.requestedAnswerShape !== "PROCEDURE") return [];
  return [...scene.presentNpc, ...scene.ambientPopulation]
    .filter(actor => actor.actorId.replace(/^npc:/u, "") !== excludedActorId.replace(/^npc:/u, ""))
    .filter(actor => /\b(?:archiviste|clerc)\b/iu.test(actor.publicRole))
    .map(actor => ({
      schemaVersion: 1,
      actorRef: `actor:${actor.actorId.replace(/^npc:/u, "")}`,
      coveredProperties: [],
      coveredAnswerShapes: ["PROCEDURE"],
      publicReasonRef: "policy:visible-role:public-procedure-owner"
    }));
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "fr"));
}
