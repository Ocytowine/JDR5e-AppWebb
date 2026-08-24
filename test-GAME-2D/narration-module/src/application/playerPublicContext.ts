import type {
  CampaignId,
  CampaignRepository,
  JsonObject,
  Result
} from "../core";
import {
  loadActorKnowledgeRegistryV1,
  loadTestimonyRegistryV1,
  projectActorKnowledgeV1,
  type ActorKnowledgeProjectionItemV1
} from "./knowledgeAuthority";
import type { InterpreterCharacterContextV1 } from "./interpreterCharacterContext";
import type { PlayableSceneStateV1 } from "./playableScene";

export const PLAYER_PUBLIC_CONTEXT_CONTRACT_V1 =
  "player-public-context/1" as const;

export type PlayerPublicKnowledgeStatusV1 =
  | "SCENE_PUBLIC"
  | ActorKnowledgeProjectionItemV1["status"];

export interface PlayerPublicVisibleActorV1 extends JsonObject {
  schemaVersion: 1;
  actorRef: string;
  label: string;
  publicRole: string;
  visibleState: string;
  sourceRef: string;
}

export interface PlayerPublicKnownFactV1 extends JsonObject {
  schemaVersion: 1;
  factRef: string;
  subjectRef: string | null;
  subjectLabel: string | null;
  statement: string;
  status: PlayerPublicKnowledgeStatusV1;
  attributedSpeakerRefs: string[];
  sourceRefs: string[];
  assertsObjectiveTruth: false;
}

export interface PlayerPublicContextV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLAYER_PUBLIC_CONTEXT_CONTRACT_V1;
  character: JsonObject & {
    ref: string;
    actorRef: string;
    label: string;
  };
  location: JsonObject & {
    sceneId: string;
    label: string;
    sourceRef: string;
  };
  presentActors: PlayerPublicVisibleActorV1[];
  visibleEquipmentRefs: string[];
  knownFacts: PlayerPublicKnownFactV1[];
  sourceVersions: JsonObject & {
    scene: number;
    testimonyRegistry: number | null;
    actorKnowledgeRegistry: number | null;
  };
  authority: "PLAYER_VISIBLE_READ_ONLY";
  noCommit: true;
  noGameTime: true;
  deliberatelyExcluded: string[];
}

export type PlayerPublicContextQueryV1 =
  | "LOCATION"
  | "PRESENT_ACTORS"
  | "KNOWN_FACTS";

const MAX_PRESENT_ACTORS = 24;
const MAX_KNOWN_FACTS = 32;
const DELIBERATELY_EXCLUDED = [
  "gm_secrets_and_hidden_plot_truth",
  "npc_private_goals_pressures_and_intentions",
  "private_perspectives_and_deception_causes",
  "private_character_mechanics_resources_and_inventory",
  "player_private_notebook",
  "knowledge_owned_only_by_other_actors",
  "success_failure_commit_and_time_authority"
];

export async function loadPlayerPublicContextV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  activeScene: PlayableSceneStateV1;
  characterContext: InterpreterCharacterContextV1;
}): Promise<Result<PlayerPublicContextV1>> {
  const actorRef = playerActorRef(input.characterContext.character.ref);
  const [testimonies, knowledge] = await Promise.all([
    loadTestimonyRegistryV1(input.repository, input.campaignId),
    loadActorKnowledgeRegistryV1(input.repository, input.campaignId, actorRef)
  ]);
  if (!testimonies.ok) return testimonies;
  if (!knowledge.ok) return knowledge;
  return {
    ok: true,
    value: buildPlayerPublicContextV1({
      activeScene: input.activeScene,
      characterContext: input.characterContext,
      actorRef,
      acquiredKnowledge: projectActorKnowledgeV1({
        testimonyRegistry: testimonies.value.state,
        actorKnowledge: knowledge.value.state
      }).items,
      testimonyRegistryRevision:
        testimonies.value.aggregate?.aggregateRevision ?? null,
      actorKnowledgeRegistryRevision:
        knowledge.value.aggregate?.aggregateRevision ?? null
    })
  };
}

export function buildPlayerPublicContextV1(input: {
  activeScene: PlayableSceneStateV1;
  characterContext: InterpreterCharacterContextV1;
  actorRef?: string;
  acquiredKnowledge?: readonly ActorKnowledgeProjectionItemV1[];
  testimonyRegistryRevision?: number | null;
  actorKnowledgeRegistryRevision?: number | null;
}): PlayerPublicContextV1 {
  const actorRef = input.actorRef ?? playerActorRef(input.characterContext.character.ref);
  const presentActors = [
    ...input.activeScene.presentNpc.map(npc => ({
      schemaVersion: 1 as const,
      actorRef: canonicalActorRef(npc.actorId),
      label: npc.displayName,
      publicRole: npc.publicRole,
      visibleState: npc.visibleState,
      sourceRef: `scene:${input.activeScene.sceneId}:npc:${npc.actorId}`
    })),
    ...input.activeScene.ambientPopulation.map(presence => ({
      schemaVersion: 1 as const,
      actorRef: canonicalActorRef(presence.actorId),
      label: presence.displayName,
      publicRole: presence.publicRole,
      visibleState: [presence.visibleAppearance, presence.visibleActivity]
        .filter(nonEmpty)
        .join(" — "),
      sourceRef: `scene:${input.activeScene.sceneId}:ambient:${presence.actorId}`
    }))
  ]
    .sort((left, right) => left.label.localeCompare(right.label)
      || left.actorRef.localeCompare(right.actorRef))
    .slice(0, MAX_PRESENT_ACTORS);
  const sceneFacts = unique(input.activeScene.playerKnownFacts)
    .map((statement, index): PlayerPublicKnownFactV1 => ({
      schemaVersion: 1,
      factRef: `scene-known-fact:${input.activeScene.sceneId}:${index + 1}`,
      subjectRef: `scene:${input.activeScene.sceneId}`,
      subjectLabel: input.activeScene.locationName,
      statement,
      status: "SCENE_PUBLIC",
      attributedSpeakerRefs: [],
      sourceRefs: [`playable-scene:${input.activeScene.sceneId}`],
      assertsObjectiveTruth: false
    }));
  const acquiredFacts = [...(input.acquiredKnowledge ?? [])]
    .sort((left, right) => left.claimRef.localeCompare(right.claimRef))
    .map((item): PlayerPublicKnownFactV1 => ({
      schemaVersion: 1,
      factRef: item.claimRef,
      subjectRef: item.subjectRef,
      subjectLabel: item.subjectLabel,
      statement: item.proposition,
      status: item.status,
      attributedSpeakerRefs: unique(item.attributedSpeakerRefs),
      sourceRefs: unique(item.channelRefs),
      assertsObjectiveTruth: false
    }));
  return {
    schemaVersion: 1,
    contractVersion: PLAYER_PUBLIC_CONTEXT_CONTRACT_V1,
    character: {
      ref: input.characterContext.character.ref,
      actorRef,
      label: input.characterContext.character.label
    },
    location: {
      sceneId: input.activeScene.sceneId,
      label: input.activeScene.locationName,
      sourceRef: `playable-scene:${input.activeScene.sceneId}`
    },
    presentActors,
    visibleEquipmentRefs: input.characterContext.references
      .filter(reference => reference.kind === "EQUIPPED_ITEM")
      .map(reference => reference.ref)
      .sort(),
    knownFacts: [...sceneFacts, ...acquiredFacts].slice(0, MAX_KNOWN_FACTS),
    sourceVersions: {
      scene: input.activeScene.version,
      testimonyRegistry: input.testimonyRegistryRevision ?? null,
      actorKnowledgeRegistry: input.actorKnowledgeRegistryRevision ?? null
    },
    authority: "PLAYER_VISIBLE_READ_ONLY",
    noCommit: true,
    noGameTime: true,
    deliberatelyExcluded: [...DELIBERATELY_EXCLUDED]
  };
}

export function answerPlayerPublicContextQueryV1(input: {
  context: PlayerPublicContextV1;
  query: PlayerPublicContextQueryV1;
}): string {
  if (input.query === "LOCATION") {
    return `Tu es à ${input.context.location.label}. Cette réponse ne fait pas avancer le temps.`;
  }
  if (input.query === "PRESENT_ACTORS") {
    if (input.context.presentActors.length === 0) {
      return "Tu ne vois actuellement personne dans ce lieu. Cette réponse ne fait pas avancer le temps.";
    }
    const actors = input.context.presentActors.map(actor =>
      `${actor.label} (${actor.publicRole}) : ${actor.visibleState}`
    );
    return `Tu vois actuellement : ${actors.join(" ; ")}. Cette réponse ne fait pas avancer le temps.`;
  }
  if (input.context.knownFacts.length === 0) {
    return "Tu ne disposes encore d'aucune information enregistrée sur la situation. Cette réponse ne fait pas avancer le temps.";
  }
  const facts = input.context.knownFacts.map(fact => {
    const prefix = fact.status === "HEARD"
      ? "Entendu"
      : fact.status === "OBSERVED"
        ? "Observé"
        : fact.status === "CONFIRMED"
          ? "Confirmé"
          : fact.status === "REFUTED"
            ? "Réfuté"
            : "Connu";
    return `${prefix} : ${fact.statement}`;
  });
  return `Voici ce que tu sais : ${facts.join(" ; ")}. Cette réponse ne fait pas avancer le temps.`;
}

export function classifyInterpretedPublicContextQuestionV1(input: {
  rawInput: string;
  interpretedMeaning?: string;
}): PlayerPublicContextQueryV1 | null {
  const normalized = normalizeText(
    `${input.rawInput} ${input.interpretedMeaning ?? ""}`
  );
  if (/\b(ou suis je|ou sommes nous|ou je suis|ou je me trouve|quel lieu|localisation)\b/u.test(normalized)) {
    return "LOCATION";
  }
  if (/\b(qui est present|qui sont presents|qui vois je|qui est la|personnes presentes|avec qui suis je|y a t il quelqu un)\b/u.test(normalized)) {
    return "PRESENT_ACTORS";
  }
  if (/\b(que sais je|qu est ce que je sais|ce que je sais|qu ai je appris|ce que j ai appris|informations connues|mes informations)\b/u.test(normalized)) {
    return "KNOWN_FACTS";
  }
  return null;
}

function playerActorRef(characterRef: string): string {
  return canonicalActorRef(characterRef.replace(/^player-character:/u, ""));
}

function canonicalActorRef(actorId: string): string {
  return `actor:${actorId.replace(/^(actor:|npc:)/u, "")}`;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(nonEmpty))].sort();
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}
