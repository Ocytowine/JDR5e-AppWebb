import { computeJsonFingerprint, type JsonObject } from "../core";
import type { RoleContextPackV1 } from "../context";
import type { MemorySourceRefV1 } from "../memory";
import type { DisplayBlockV1, RenderBlockKindV1, SpeakerKindV1 } from "../scene";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";
import type { NarrativeResolutionResultV1 } from "./narrativeResolution";
import {
  buildPlayableSceneLocationAnswerV1,
  buildPlayableSceneSocialPossibilityAnswerV1,
  findPlayableSceneNpcTargetV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  toPlayableScenePublicContextV1
} from "./playableScene";
import type { ReferenceSceneStateV1 } from "./referenceSceneState";

export const REFERENCE_PLAYABLE_SCENE_ID_V1 = "reference-inn-rain-001" as const;
export const REFERENCE_PLAYABLE_SCENE_CONTRACT_VERSION_V1 = "reference-playable-scene/1" as const;
export const REFERENCE_SCENE_WRITER_CONTEXT_VERSION_V1 = "reference-scene-writer-context/1" as const;

export interface ReferenceSceneContextV1 {
  schemaVersion: 1;
  contractVersion: typeof REFERENCE_PLAYABLE_SCENE_CONTRACT_VERSION_V1;
  sceneId: typeof REFERENCE_PLAYABLE_SCENE_ID_V1;
  locationName: string;
  perceptibleSituation: string[];
  presentNpc: Array<{
    actorId: string;
    displayName: string;
    publicRole: string;
    visibleState: string;
  }>;
  currentTension: string;
  playerKnownFacts: string[];
  version: 1;
}

export interface ReferenceSceneWriterContextTaskV1 {
  schemaVersion: 1;
  contractVersion: typeof REFERENCE_SCENE_WRITER_CONTEXT_VERSION_V1;
  rawInput: string;
  resultKind: NarrativeResolutionResultV1["resultKind"];
  intentType: NarrativeIntentInterpretationV1["intentType"];
  coreMeaning: string;
  committed: boolean;
  handoffTarget: string | null;
  allowedGrounding: string[];
  forbidden: string[];
  version: 1;
}

export const REFERENCE_SCENE_CONTEXT_V1: ReferenceSceneContextV1 = {
  schemaVersion: 1,
  contractVersion: REFERENCE_PLAYABLE_SCENE_CONTRACT_VERSION_V1,
  sceneId: REFERENCE_PLAYABLE_SCENE_ID_V1,
  locationName: "Auberge du Seuil",
  perceptibleSituation: [
    "La pluie frappe les volets et laisse une odeur de laine humide dans la salle.",
    "Un garde blessé garde une main sur son flanc et cherche quelqu'un du regard.",
    "La serveuse essuie trois fois le même gobelet en évitant de regarder la porte du fond.",
    "Une porte étroite près du comptoir mène vers l'arrière-salle."
  ],
  presentNpc: [{
    actorId: "npc-garde-blesse",
    displayName: "Garde blessé",
    publicRole: "Garde de ville",
    visibleState: "fatigué, nerveux, blessure bandée sous la cuirasse"
  }, {
    actorId: "npc-serveuse-nerveuse",
    displayName: "Serveuse nerveuse",
    publicRole: "Employée de l'auberge",
    visibleState: "mains occupées, regard fuyant, attention fixée sur l'arrière-salle"
  }],
  currentTension: "Quelqu'un ou quelque chose est attendu dehors, mais personne ne veut le nommer à voix haute.",
  playerKnownFacts: [
    "Le personnage est dans la salle commune.",
    "La scène est sociale et observable; aucun combat n'est engagé.",
    "Les questions méta ne font pas avancer le temps."
  ],
  version: 1
};

export async function buildReferenceSceneWriterContextPackV1(input: {
  campaignId: string;
  operationId: string;
  packId: string;
  snapshotId: string;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  resolution: NarrativeResolutionResultV1;
  sceneState?: ReferenceSceneStateV1;
}): Promise<RoleContextPackV1> {
  const sceneSourceRef = `reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`;
  const resolutionSourceRef = `resolution:${input.resolution.resolutionId}`;
  const sceneMemoryRef = memorySourceRef("CONTENT_ENTRY", REFERENCE_PLAYABLE_SCENE_ID_V1, input.campaignId, "narration.reference-scene");
  const resolutionMemoryRef = memorySourceRef("OPERATION", input.resolution.resolutionId, input.campaignId, "narration.resolution");
  const sceneStateMemoryRef = memorySourceRef("AGGREGATE", REFERENCE_PLAYABLE_SCENE_ID_V1, input.campaignId, "narration.scene-state");
  const scenePayload = REFERENCE_SCENE_CONTEXT_V1 as unknown as JsonObject;
  const resolutionPayload = {
    resultKind: input.resolution.resultKind,
    committed: input.resolution.commitId !== null,
    handoffTarget: input.resolution.handoff?.target ?? null,
    intentType: input.interpretation.intentType,
    coreMeaning: input.interpretation.coreMeaning,
    noGameTime: input.interpretation.expectedTimeEffect === "NO_GAME_TIME"
  } satisfies JsonObject;
  const constraintsPayload = {
    authority: "PRESENTATION_ONLY",
    mustNot: [
      "annoncer un succès ou un échec non committé",
      "faire avancer le temps",
      "faire parler le personnage joueur contre l'intention donnée",
      "révéler un secret",
      "créer un objet, PNJ ou lieu persistant",
      "résoudre un combat ou un repos"
    ],
    allowedGrounding: [resolutionSourceRef, sceneSourceRef]
  } satisfies JsonObject;
  const task: ReferenceSceneWriterContextTaskV1 = {
    schemaVersion: 1,
    contractVersion: REFERENCE_SCENE_WRITER_CONTEXT_VERSION_V1,
    rawInput: input.rawInput,
    resultKind: input.resolution.resultKind,
    intentType: input.interpretation.intentType,
    coreMeaning: input.interpretation.coreMeaning,
    committed: input.resolution.commitId !== null,
    handoffTarget: input.resolution.handoff?.target ?? null,
    allowedGrounding: [resolutionSourceRef, sceneSourceRef],
    forbidden: [
      "success_without_commit",
      "combat_resolution",
      "inventory_mutation",
      "secret_reveal",
      "new_durable_creation",
      "player_agency_override"
    ],
    version: 1
  };
  const packDraft: RoleContextPackV1 = {
    schemaVersion: 1,
    packId: input.packId,
    snapshotId: input.snapshotId,
    campaignId: input.campaignId,
    role: "scene_writer",
    task: "Enrichir le rendu visible avec une narration ancrée dans la scène de référence, sans autorité métier.",
    perspective: { kind: "PLAYER_CHARACTER", actorId: "player-character:prototype" },
    baseCampaignRevision: 0,
    dependencyVersions: [{
      sourceRef: sceneMemoryRef,
      properties: ["locationName", "perceptibleSituation", "presentNpc", "currentTension", "playerKnownFacts"]
    }, {
      sourceRef: resolutionMemoryRef,
      properties: ["resultKind", "commitId", "handoff", "interpretation"]
    }, {
      sourceRef: sceneStateMemoryRef,
      properties: ["interactionCount", "guardAddressed", "backRoomDoorHighlighted", "visibleFocus", "shortTermNpcMemory"]
    }],
    creativeScope: {
      mayCreate: [],
      mayReference: [sceneSourceRef, resolutionSourceRef],
      mayProposeCommands: [],
      mayReveal: {
        reveal: [],
        hint: ["éléments déjà visibles de la scène"],
        withhold: ["vérités cachées", "conséquences non committées"]
      },
      mustPreserve: [
        input.interpretation.coreMeaning,
        input.resolution.resultKind,
        REFERENCE_PLAYABLE_SCENE_ID_V1
      ],
      mustNotCreate: ["PNJ durable", "lieu durable", "objet utile", "indice secret", "issue de combat"],
      mustNotModify: ["resolution.resultKind", "commitId", "handoff", "horloge", "inventaire", "agrégats"],
      noveltyConstraints: ["texture sensorielle locale uniquement", "aucune nouvelle vérité durable"]
    },
    budget: {
      unit: "MODEL_TOKENS_ESTIMATE",
      maximum: 1_200,
      reservedForInstructionsAndSchema: 250,
      reservedForOutput: 350,
      reservedForInput: 600,
      reservedForMandatory: 360,
      consumedByBlocks: 360,
      remainingMargin: 240,
      reductionStepsApplied: []
    },
    blocks: [{
      blockId: `${input.operationId}:context:scene`,
      blockKind: "SCENE",
      sourceRefs: [sceneMemoryRef],
      visibility: "PLAYER_CHARACTER",
      actorScope: [],
      text: [
        `Lieu: ${REFERENCE_SCENE_CONTEXT_V1.locationName}.`,
        ...REFERENCE_SCENE_CONTEXT_V1.perceptibleSituation,
        `Tension: ${REFERENCE_SCENE_CONTEXT_V1.currentTension}`
      ].join(" "),
      payload: scenePayload,
      tokenEstimate: 210
    }, ...(input.sceneState ? [{
      blockId: `${input.operationId}:context:scene-state`,
      blockKind: "SCENE" as const,
      sourceRefs: [sceneStateMemoryRef],
      visibility: "SYSTEM_ONLY" as const,
      actorScope: [],
      text: [
        `État scène: ${input.sceneState.interactionCount} interaction(s), garde interpellé=${input.sceneState.guardAddressed}, porte du fond signalée=${input.sceneState.backRoomDoorHighlighted}.`,
        input.sceneState.shortTermNpcMemory.length > 0
          ? `Mémoire courte PNJ: ${input.sceneState.shortTermNpcMemory.map(memory => `${memory.actorDisplayName}: ${memory.npcContinuitySummary}`).join(" | ")}`
          : "Mémoire courte PNJ: aucun échange mémorisé."
      ].join(" "),
      payload: input.sceneState as unknown as JsonObject,
      tokenEstimate: 70
    }] : []), {
      blockId: `${input.operationId}:context:resolution`,
      blockKind: "COMMITTED_RESULT",
      sourceRefs: [resolutionMemoryRef],
      visibility: "SYSTEM_ONLY",
      actorScope: [],
      text: `Résultat déterministe: ${input.resolution.resultKind}; intention: ${input.interpretation.intentType}; sens: ${input.interpretation.coreMeaning}.`,
      payload: resolutionPayload,
      tokenEstimate: 80
    }, {
      blockId: `${input.operationId}:context:constraints`,
      blockKind: "CONSTRAINT",
      sourceRefs: [sceneMemoryRef, resolutionMemoryRef],
      visibility: "SYSTEM_ONLY",
      actorScope: [],
      text: "Le scene_writer peut embellir le rendu visible, mais ne possède aucune autorité métier.",
      payload: constraintsPayload,
      tokenEstimate: 70
    }],
    outputContractId: "narrative-ai-resolution/1",
    packFingerprint: "sha256:pending"
  };
  return {
    ...packDraft,
    packFingerprint: await computeJsonFingerprint({ ...packDraft, packFingerprint: null }) as `sha256:${string}`
  };
}

function memorySourceRef(
  sourceKind: MemorySourceRefV1["sourceKind"],
  sourceId: string,
  campaignId: string,
  ownerDomain: string
): MemorySourceRefV1 {
  return {
    schemaVersion: 1,
    sourceKind,
    sourceId,
    campaignId,
    ownerDomain,
    version: 1,
    path: null,
    fingerprint: null
  };
}

export function buildReferenceSceneWriterTaskV1(input: {
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  resolution: NarrativeResolutionResultV1;
}): ReferenceSceneWriterContextTaskV1 {
  const sceneSourceRef = `reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`;
  const resolutionSourceRef = `resolution:${input.resolution.resolutionId}`;
  return {
    schemaVersion: 1,
    contractVersion: REFERENCE_SCENE_WRITER_CONTEXT_VERSION_V1,
    rawInput: input.rawInput,
    resultKind: input.resolution.resultKind,
    intentType: input.interpretation.intentType,
    coreMeaning: input.interpretation.coreMeaning,
    committed: input.resolution.commitId !== null,
    handoffTarget: input.resolution.handoff?.target ?? null,
    allowedGrounding: [resolutionSourceRef, sceneSourceRef],
    forbidden: [
      "success_without_commit",
      "combat_resolution",
      "inventory_mutation",
      "secret_reveal",
      "new_durable_creation",
      "player_agency_override"
    ],
    version: 1
  };
}

export function buildReferenceSceneLocalNarrationV1(input: {
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  resolution: NarrativeResolutionResultV1;
}): string {
  if (input.resolution.resultKind === "HANDOFF_REQUIRED") {
    return handoffNarration(input.resolution.handoff?.target ?? "UNKNOWN");
  }
  if (input.interpretation.intentType === "speech") {
    return "Dans l'auberge battue par la pluie, la demande s'inscrit dans le silence tendu autour du garde blessé et de la porte du fond.";
  }
  if (input.interpretation.intentType === "action") {
    return observationNarration(input.rawInput);
  }
  return "La scène reste stable : la pluie frappe les volets de l'Auberge du Seuil, sans faire avancer le temps de jeu.";
}

export function buildReferenceSceneBlocksV1(input: {
  operationId: string;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  resolution: NarrativeResolutionResultV1;
  sceneState?: ReferenceSceneStateV1;
}): DisplayBlockV1[] {
  if (input.resolution.resultKind === "CLARIFICATION_REQUIRED") return [];
  if (input.interpretation.intentType === "meta_question") {
    if (!isLocationQuestion(input.rawInput)) return [];
    return [referenceBlock({
      operationId: input.operationId,
      suffix: "reference-location-answer",
      kind: "GM_NARRATION",
      speakerKind: "GM",
      displayName: "MJ",
      text: locationAnswerNarration(),
      sourceRefs: [`reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`, `resolution:${input.resolution.resolutionId}:location-answer`]
    })];
  }
  if (input.interpretation.intentType === "possibility_query") {
    if (!isSocialPossibilityQuestion(input.rawInput)) return [];
    return [referenceBlock({
      operationId: input.operationId,
      suffix: "reference-social-possibility",
      kind: "GM_NARRATION",
      speakerKind: "GM",
      displayName: "MJ",
      text: socialPossibilityNarration(input.rawInput),
      sourceRefs: [`reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`, `resolution:${input.resolution.resolutionId}:social-possibility`]
    })];
  }
  if (input.resolution.handoff !== null) {
    return [referenceBlock({
      operationId: input.operationId,
      suffix: "reference-handoff",
      kind: "GM_NARRATION",
      speakerKind: "GM",
      displayName: "MJ",
      text: handoffNarration(input.resolution.handoff.target),
      sourceRefs: [`reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`, `resolution:${input.resolution.resolutionId}:handoff`]
    })];
  }
  if (input.interpretation.intentType === "speech") {
    const target = speechTarget(input.rawInput);
    return [
      referenceBlock({
        operationId: input.operationId,
        suffix: "reference-npc-reaction",
        kind: "NPC_SPEECH",
        speakerKind: "NPC",
        displayName: target.displayName,
        text: target.actorId === "npc-serveuse-nerveuse"
          ? waitressSpeechNarration(input.sceneState)
          : guardSpeechNarration(input.sceneState),
        sourceRefs: [`reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`, `resolution:${input.resolution.resolutionId}:speech-reaction`]
      })
    ];
  }
  if (input.interpretation.intentType === "action") {
    return [referenceBlock({
      operationId: input.operationId,
      suffix: "reference-observation",
      kind: "GM_NARRATION",
      speakerKind: "GM",
      displayName: "MJ",
      text: observationNarration(input.rawInput, input.sceneState),
      sourceRefs: [`reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`, `resolution:${input.resolution.resolutionId}:reference-observation`]
    })];
  }
  return [];
}

function isLocationQuestion(rawInput: string): boolean {
  const normalized = rawInput.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return /\b(ou sommes-nous|ou suis-je|quel lieu|endroit|localisation)\b/u.test(normalized);
}

function isSocialPossibilityQuestion(rawInput: string): boolean {
  const normalized = rawInput.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return /\b(peux|puis|possible|est-ce que je peux)\b/u.test(normalized) &&
    /\b(parler|discuter|questionner|interroger|demander)\b/u.test(normalized);
}

function locationAnswerNarration(): string {
  return buildPlayableSceneLocationAnswerV1(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1);
}

function socialPossibilityNarration(rawInput: string): string {
  return buildPlayableSceneSocialPossibilityAnswerV1(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, rawInput);
}

function speechTarget(rawInput: string): { actorId: "npc-garde-blesse" | "npc-serveuse-nerveuse"; displayName: string } {
  const target = findPlayableSceneNpcTargetV1(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, rawInput);
  return {
    actorId: target.actorId === "npc-serveuse-nerveuse" ? "npc-serveuse-nerveuse" : "npc-garde-blesse",
    displayName: target.displayName
  };
}

function observationNarration(rawInput: string, sceneState?: ReferenceSceneStateV1): string {
  const normalized = rawInput.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (/\b(porte|arriere|arriere-salle|fond)\b/u.test(normalized)) {
    if (sceneState?.backRoomDoorHighlighted) {
      return "La porte du fond est maintenant le point autour duquel toute la salle semble se contracter. La serveuse évite de la regarder; le garde, lui, sait que tu as compris son avertissement.";
    }
    return "La porte du fond n'est pas verrouillée, mais la serveuse se crispe dès que ton attention s'y attarde. Le garde blessé remarque aussi ton regard.";
  }
  if (/\b(garde|blesse|soldat)\b/u.test(normalized)) {
    if (sceneState?.guardAddressed) {
      return "Le garde blessé te reconnaît maintenant comme quelqu'un qui l'a directement interpellé. Sa main reste sur son flanc, mais son regard revient sans cesse vers la porte du fond.";
    }
    return "Le garde blessé serre les dents chaque fois qu'il respire trop fort. Sa cuirasse porte des traces de boue fraîche, pas seulement de la route.";
  }
  if (sceneState?.guardAddressed || sceneState?.backRoomDoorHighlighted) {
    return "Tu reprends la mesure de la salle commune. La pluie couvre les murmures; depuis l'échange avec le garde blessé, la porte du fond attire davantage les regards qu'elle ne le devrait.";
  }
  return "Tu prends le temps d'observer la salle commune. La pluie couvre les conversations basses; le garde blessé surveille l'entrée, tandis que la serveuse garde un œil inquiet sur la porte du fond.";
}

function guardSpeechNarration(sceneState?: ReferenceSceneStateV1): string {
  const remembered = sceneState?.shortTermNpcMemory.filter(memory => memory.actorId === "npc-garde-blesse").at(-1);
  if ((sceneState?.interactionCount ?? 0) > 1 && remembered) {
    return "Le garde ne répète pas toute son explication. Il incline seulement la tête vers l'arrière-salle. « Je vous l'ai dit : la porte du fond. Si vous insistez, faites-le vite, avant que ceux dehors n'entrent. »";
  }
  if ((sceneState?.interactionCount ?? 0) > 0) {
    return "Le garde baisse encore la voix, plus pressé qu'avant. « Vous avez compris l'essentiel : la porte du fond. Mais si vous forcez les choses ici, je ne pourrai plus vous couvrir. »";
  }
  return "Le garde baisse la voix. « Si vous cherchez des réponses, commencez par la porte du fond. Mais ne faites pas de geste brusque ici. »";
}

function waitressSpeechNarration(sceneState?: ReferenceSceneStateV1): string {
  const remembered = sceneState?.shortTermNpcMemory.filter(memory => memory.actorId === "npc-serveuse-nerveuse").at(-1);
  if (remembered) {
    return "La serveuse garde le gobelet entre ses mains. « Je vous ai déjà dit que je ne veux pas d'ennuis. La porte du fond ne s'ouvre pas pour les curieux. »";
  }
  return "La serveuse cesse enfin d'essuyer son gobelet. « Nerveuse ? Avec cette pluie, ce garde qui saigne et cette porte qu'on me demande d'ignorer, vous ne le seriez pas ? »";
}

function handoffNarration(target: string): string {
  if (target === "TACTICAL") {
    return "La tension devient trop précise pour être tranchée en simple description : positions, réactions et risques doivent passer par le domaine tactique.";
  }
  if (target === "REST") {
    return "Un repos réel demanderait de fixer la durée, la sécurité du lieu, les gardes et les bénéfices possibles avant de faire avancer le temps.";
  }
  return "La scène reconnaît l'intention, mais la conséquence appartient à un domaine propriétaire avant toute mutation durable.";
}

function referenceBlock(input: {
  operationId: string;
  suffix: string;
  kind: RenderBlockKindV1;
  speakerKind: SpeakerKindV1;
  displayName: string;
  text: string;
  sourceRefs: string[];
}): DisplayBlockV1 {
  const speakerId = input.speakerKind === "GM"
    ? "speaker-gm"
    : input.speakerKind === "NPC"
      ? `speaker-${input.displayName.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/gu, "-")}`
      : "speaker-system";
  const roleLabel = input.speakerKind === "GM"
    ? "Narration"
    : input.speakerKind === "NPC"
      ? "Dialogue PNJ"
      : "Notification système";
  return {
    blockId: `${input.operationId}:${input.suffix}`,
    kind: input.kind,
    speaker: {
      speakerId,
      kind: input.speakerKind,
      displayName: input.displayName,
      roleLabel,
      ariaLabel: `${roleLabel} - ${input.displayName}`,
      visualToken: speakerId
    },
    text: input.text,
    ariaLabel: `${input.displayName}: ${input.kind}`,
    roleLabel,
    visualStyleToken: speakerId,
    sourceRefs: input.sourceRefs,
    isDegradedFallback: false
  };
}
