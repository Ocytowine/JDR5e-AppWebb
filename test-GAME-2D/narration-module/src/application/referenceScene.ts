import { computeJsonFingerprint, type JsonObject } from "../core";
import type { RoleContextPackV1 } from "../context";
import type { MemorySourceRefV1 } from "../memory";
import type { DisplayBlockV1, DisplayPacketV1, RenderBlockKindV1, SpeakerKindV1 } from "../scene";
import { isAiInterpretationFailureDiagnosticV1, type NarrativeIntentInterpretationV1 } from "./intentClarification";
import type { NarrativeResolutionResultV1 } from "./narrativeResolution";
import {
  buildPlayableSceneLocationAnswerV1,
  buildPlayableSceneSocialPossibilityAnswerV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  toPlayableScenePublicContextV1,
  type PlayableSceneStateV1
} from "./playableScene";
import type { ReferenceSceneStateV1 } from "./referenceSceneState";
import { buildNpcDialogueFallbackV1 } from "./npcDialogueFallback";

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
  priorDisplayPackets?: DisplayPacketV1[];
}): Promise<RoleContextPackV1> {
  const sceneSourceRef = `reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`;
  const resolutionSourceRef = `resolution:${input.resolution.resolutionId}`;
  const sceneMemoryRef = memorySourceRef("CONTENT_ENTRY", REFERENCE_PLAYABLE_SCENE_ID_V1, input.campaignId, "narration.reference-scene");
  const resolutionMemoryRef = memorySourceRef("OPERATION", input.resolution.resolutionId, input.campaignId, "narration.resolution");
  const sceneStateMemoryRef = memorySourceRef("AGGREGATE", REFERENCE_PLAYABLE_SCENE_ID_V1, input.campaignId, "narration.scene-state");
  const visibleHistoryMemoryRef = memorySourceRef("OPERATION", `${input.operationId}:visible-history`, input.campaignId, "narration.visible-history");
  const visibleHistory = buildShortVisibleHistoryV1(input.priorDisplayPackets ?? []);
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
    }] : []), ...(visibleHistory.entries.length > 0 ? [{
      blockId: `${input.operationId}:context:visible-history`,
      blockKind: "MEMORY_CAPSULE" as const,
      sourceRefs: [visibleHistoryMemoryRef],
      visibility: "PLAYER_CHARACTER" as const,
      actorScope: [],
      text: visibleHistory.text,
      payload: visibleHistory as unknown as JsonObject,
      tokenEstimate: visibleHistory.tokenEstimate
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

export function buildShortVisibleHistoryV1(packets: DisplayPacketV1[]): {
  schemaVersion: 1;
  entries: Array<{
    packetOperationId: string;
    kind: DisplayBlockV1["kind"];
    speaker: string;
    text: string;
  }>;
  text: string;
  tokenEstimate: number;
} {
  const visibleKinds = new Set<DisplayBlockV1["kind"]>([
    "RAW_INPUT",
    "PLAYER_EXPRESSION",
    "GM_NARRATION",
    "NPC_SPEECH"
  ]);
  const entries = packets
    .slice(-3)
    .flatMap(packet => packet.displayBlocks
      .filter(block => visibleKinds.has(block.kind))
      .map(block => ({
        packetOperationId: packet.operationId,
        kind: block.kind,
        speaker: block.speaker.displayName,
        text: block.text.replace(/\s+/gu, " ").trim().slice(0, 220)
      }))
    )
    .filter(entry => entry.text.length > 0)
    .slice(-6);
  return {
    schemaVersion: 1,
    entries,
    text: entries.length > 0
      ? `Historique visible court: ${entries.map(entry => `${entry.speaker} (${entry.kind}): ${entry.text}`).join(" | ")}`
      : "Historique visible court: aucun échange visible récent.",
    tokenEstimate: Math.max(40, entries.reduce((sum, entry) => sum + Math.ceil(entry.text.length / 4), 0))
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
  presentationSeed?: string;
  presentationVariantIndex?: number;
}): string {
  const variantSeed = input.presentationSeed ?? input.resolution.operationId ?? input.rawInput;
  const variant = typeof input.presentationVariantIndex === "number"
    ? input.presentationVariantIndex
    : presentationVariant(variantSeed, 3);
  if (isAiInterpretationFailureDiagnosticV1(input.interpretation)) {
    return "L'entrée du joueur n'a pas pu être interprétée de manière fiable. La scène reste inchangée et aucune action n'est exécutée.";
  }
  if (input.resolution.resultKind === "CLARIFICATION_REQUIRED") {
    return "La scène marque une pause nette : l'intention doit être précisée avant que le personnage n'agisse ou que le monde ne réponde.";
  }
  if (input.resolution.resultKind === "HANDOFF_REQUIRED") {
    return handoffNarration(input.resolution.handoff?.target ?? "UNKNOWN");
  }
  if (input.interpretation.intentType === "meta_question") {
    if (isOutOfFictionMetaQuestion(input.rawInput)) {
      return "Réponse hors fiction : le temps de jeu ne bouge pas et la scène de l'Auberge du Seuil reste exactement au même point.";
    }
    if (isLocationQuestion(input.rawInput, input.interpretation.coreMeaning)) return locationAnswerNarration();
    if (isWeatherQuestion(input.rawInput, input.interpretation.coreMeaning)) return weatherAnswerNarration(variant);
    return sceneContextNarration(input.rawInput, input.interpretation.coreMeaning, variant);
  }
  if (input.interpretation.intentType === "possibility_query") {
    if (isSocialPossibilityQuestion(input.rawInput)) return socialPossibilityNarration(input.rawInput);
    return possibilityNarration(input.rawInput);
  }
  if (input.interpretation.intentType === "speech") {
    return "La parole prend place dans la salle commune : le bruit de la pluie couvre les voix basses, et l'attention revient vers le garde blessé avant toute réponse décisive.";
  }
  if (input.interpretation.intentType === "mixed") {
    return "Le déplacement et la parole s'enchaînent dans la même impulsion. La scène les traite comme une intention engagée, sans résoudre à elle seule l'issue sociale.";
  }
  if (input.interpretation.intentType === "action") {
    return actionNarration(input.rawInput, input.interpretation, input.resolution);
  }
  return "La scène reste stable : la pluie frappe les volets de l'Auberge du Seuil, sans faire avancer le temps de jeu.";
}

export function buildReferenceSceneBlocksV1(input: {
  operationId: string;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  resolution: NarrativeResolutionResultV1;
  sceneState?: ReferenceSceneStateV1;
  playableScene?: PlayableSceneStateV1;
}): DisplayBlockV1[] {
  const playableScene = input.playableScene ?? REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1;
  if (isAiInterpretationFailureDiagnosticV1(input.interpretation)) return [];
  if (input.resolution.resultKind === "CLARIFICATION_REQUIRED") return [];
  if (input.interpretation.intentType === "meta_question") {
    if (isOutOfFictionMetaQuestion(input.rawInput)) return [];
    const answerKind = isWeatherQuestion(input.rawInput, input.interpretation.coreMeaning)
      ? "weather"
      : isLocationQuestion(input.rawInput, input.interpretation.coreMeaning)
        ? "location"
        : "context";
    const variant = presentationVariant(input.operationId, 3);
    return [referenceBlock({
      operationId: input.operationId,
      suffix: `reference-${answerKind}-answer`,
      kind: "GM_NARRATION",
      speakerKind: "GM",
      displayName: "MJ",
      text: answerKind === "weather"
        ? weatherAnswerNarration(variant)
        : answerKind === "location"
          ? locationAnswerNarration(playableScene)
          : playableScene.sceneId === REFERENCE_PLAYABLE_SCENE_ID_V1
            ? sceneContextNarration(input.rawInput, input.interpretation.coreMeaning, variant)
            : playableScene.perceptibleSituation.join(" "),
      sourceRefs: [`playable-scene:${playableScene.sceneId}`, `resolution:${input.resolution.resolutionId}:meta-answer`]
    })];
  }
  if (input.interpretation.intentType === "possibility_query") {
    return [referenceBlock({
      operationId: input.operationId,
      suffix: isSocialPossibilityQuestion(input.rawInput) ? "reference-social-possibility" : "reference-possibility",
      kind: "GM_NARRATION",
      speakerKind: "GM",
      displayName: "MJ",
      text: isSocialPossibilityQuestion(input.rawInput)
        ? socialPossibilityNarration(input.rawInput)
        : possibilityNarration(input.rawInput),
      sourceRefs: [`reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`, `resolution:${input.resolution.resolutionId}:possibility`]
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
  if (input.interpretation.intentType === "speech" || input.interpretation.intentType === "mixed") {
    const target = speechTarget(input.rawInput, input.interpretation);
    return [
      referenceBlock({
        operationId: input.operationId,
        suffix: "reference-npc-reaction",
        kind: "NPC_SPEECH",
        speakerKind: "NPC",
        displayName: target.displayName,
        text: buildNpcDialogueFallbackV1(
          target.actorId,
          input.interpretation.semanticIntent.dialogueAct?.act ?? "OTHER"
        ).text,
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
      text: actionNarration(input.rawInput, input.interpretation, input.resolution, input.sceneState, playableScene),
      sourceRefs: [`playable-scene:${playableScene.sceneId}`, `resolution:${input.resolution.resolutionId}:reference-observation`]
    })];
  }
  return [];
}

function isLocationQuestion(rawInput: string, coreMeaning = ""): boolean {
  const normalized = normalizeTopicInput(rawInput, coreMeaning);
  return /\b(ou sommes-nous|ou suis-je|ou je suis|ou je me trouve|ou me situe|me situe|quel lieu|endroit|localisation)\b/u.test(normalized);
}

function isWeatherQuestion(rawInput: string, coreMeaning = ""): boolean {
  const normalized = normalizeTopicInput(rawInput, coreMeaning);
  return /\b(temps|meteo|pluie|pleut|dehors|ciel|beau|mauvais temps|fait[- ]il beau|il fait beau)\b/u.test(normalized);
}

function normalizeTopicInput(rawInput: string, coreMeaning = ""): string {
  return `${rawInput} ${coreMeaning}`.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function isOutOfFictionMetaQuestion(rawInput: string): boolean {
  const normalized = rawInput.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return /\b(regle|mecanique|jet|bonus|action bonus|interface|sauvegarde|parametre|option|mj|comment ca marche|comment fonctionne)\b/u.test(normalized);
}

function isSocialPossibilityQuestion(rawInput: string): boolean {
  const normalized = rawInput.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return /\b(peux|puis|possible|est-ce que je peux)\b/u.test(normalized) &&
    /\b(parler|discuter|questionner|interroger|demander)\b/u.test(normalized);
}

function locationAnswerNarration(playableScene: PlayableSceneStateV1 = REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1): string {
  return buildPlayableSceneLocationAnswerV1(playableScene);
}

function weatherAnswerNarration(variant = 0): string {
  return selectPresentationVariant(variant, [
    "Dehors, la pluie tombe assez fort pour brouiller les voix près des volets. Dans l'Auberge du Seuil, l'air sent le bois humide, la laine mouillée et la tension retenue autour du garde blessé.",
    "Il pleut franchement dehors : les gouttes martèlent les volets et étouffent une partie des conversations. À l'intérieur de l'Auberge du Seuil, la chaleur reste lourde, mêlée d'humidité, pendant que le garde blessé surveille la salle.",
    "Le temps n'a rien d'accueillant. La pluie plaque le monde contre les fenêtres, laisse entrer une odeur de bois mouillé, et renforce le silence tendu autour du garde blessé dans l'Auberge du Seuil."
  ]);
}

function sceneContextNarration(rawInput: string, coreMeaning = "", variant = 0): string {
  const normalized = normalizeTopicInput(rawInput, coreMeaning);
  if (/\b(type|batiment|bâtiment|edifice|etablissement|endroit)\b/u.test(normalized)) {
    return selectPresentationVariant(variant, [
      "Tu te trouves dans une auberge de passage : un bâtiment public fait pour boire, manger, attendre une chambre ou des nouvelles. L'Auberge du Seuil n'a rien d'un palais ni d'une caserne; c'est un lieu de halte, bas de plafond, usé par la pluie et traversé ce soir par une tension inhabituelle.",
      "C'est une auberge, donc un lieu ouvert aux voyageurs, aux habitués et aux gens qui cherchent un abri plus qu'un refuge sûr. L'Auberge du Seuil sert à boire, à manger et probablement à louer des chambres, mais ce soir elle ressemble surtout à un point d'attente sous pression.",
      "Le bâtiment est une auberge de passage : salle commune, comptoir, passage vers l'arrière et clientèle de halte. Rien n'indique une demeure privée; tout dit plutôt un établissement public fatigué par la pluie, où la présence du garde blessé change l'ambiance."
    ]);
  }
  if (/\b(garde|blesse|soldat)\b/u.test(normalized)) {
    return selectPresentationVariant(variant, [
      "Le garde blessé reste debout par volonté plus que par confort. Sa cuirasse est tachée de boue fraîche, sa main protège son flanc bandé, et son regard revient toujours vers la porte du fond avant de revenir à la salle.",
      "Le garde tient encore sa posture, mais mal. Il protège son flanc, respire court et regarde la porte du fond avec une insistance qu'il essaie de rendre discrète.",
      "C'est un garde de ville en mauvais état : boue fraîche, blessure bandée, attention nerveuse. Il ne semble pas seulement souffrir; il attend quelque chose, ou quelqu'un, lié à l'arrière-salle."
    ]);
  }
  if (/\b(serveuse|aubergiste|femme)\b/u.test(normalized)) {
    return selectPresentationVariant(variant, [
      "La serveuse garde les mains occupées pour ne pas rester immobile. Elle essuie un gobelet déjà propre, évite le regard du garde blessé et surveille la porte du fond comme si elle craignait qu'on la remarque.",
      "La serveuse bouge trop pour quelqu'un qui maîtrise la situation. Ses gestes restent utiles en apparence, mais son attention revient à l'arrière-salle dès qu'elle croit ne pas être observée.",
      "Elle tient son rôle d'auberge, mais sa nervosité le fissure : sourire bref, mains occupées, regard qui glisse vers la porte du fond puis revient aussitôt au comptoir."
    ]);
  }
  if (/\b(porte|fond|arriere|arriere-salle)\b/u.test(normalized)) {
    return selectPresentationVariant(variant, [
      "La porte du fond est étroite, presque banale, mais la salle entière semble se tendre autour d'elle. La serveuse la surveille sans vouloir le montrer, et le garde blessé paraît attendre que quelqu'un ose s'en approcher.",
      "La porte menant vers l'arrière-salle n'a rien de spectaculaire. Pourtant, les regards qui l'évitent ou y reviennent la rendent plus importante que son apparence ne le justifie.",
      "C'est une porte de service, proche du comptoir, assez discrète pour passer inaperçue si personne ne la craignait. Ici, le garde blessé et la serveuse lui donnent malgré eux trop de poids."
    ]);
  }
  if (/\b(auberge|salle|piece|lieu|decor|decrire|decris|description)\b/u.test(normalized)) {
    return selectPresentationVariant(variant, [
      "L'Auberge du Seuil est basse de plafond, chaude seulement près de l'âtre, et saturée d'odeurs de bois humide. Les clients parlent peu. Le garde blessé occupe l'attention sans la réclamer, tandis que la serveuse nerveuse garde un œil trop fréquent sur la porte du fond.",
      "La salle commune est resserrée, plus pratique que belle : tables marquées, comptoir usé, manteaux humides près de l'entrée. Le garde blessé attire les regards malgré lui, et la serveuse travaille en surveillant trop souvent la porte du fond.",
      "Tu vois une auberge de passage tendue par l'orage et par ce qui n'est pas dit. La pluie colle aux volets, les clients restent prudents, la serveuse évite certains regards, et la porte du fond pèse dans la pièce plus qu'une simple porte ne devrait."
    ]);
  }
  return selectPresentationVariant(variant, [
    "Ce que ton personnage perçoit reste concret : la pluie aux volets, la salle commune tendue, le garde blessé près du passage et la serveuse nerveuse qui évite de fixer trop longtemps la porte du fond.",
    "Le tableau visible ne change pas : la pluie maintient l'auberge humide, les conversations restent retenues, le garde blessé se montre trop attentif et la serveuse trahit sa nervosité autour de la porte du fond.",
    "À première vue, tout tient dans quelques repères : pluie dehors, salle commune sous tension, garde blessé présent, serveuse nerveuse, et cette porte du fond qui attire les silences plus que les regards."
  ]);
}

function presentationVariant(seed: string, count: number): number {
  if (count <= 1) return 0;
  let hash = 0;
  for (const char of seed) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % count;
}

function selectPresentationVariant(variant: number, options: string[]): string {
  return options[Math.abs(variant) % options.length] ?? options[0] ?? "";
}

function socialPossibilityNarration(rawInput: string): string {
  return buildPlayableSceneSocialPossibilityAnswerV1(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, rawInput);
}

function possibilityNarration(rawInput: string): string {
  const normalized = rawInput.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (/\b(voler|bourse|prendre|fouiller)\b/u.test(normalized)) {
    return "C'est une possibilité risquée, pas une action encore lancée. Le garde est blessé mais attentif; sa bourse reste visible, et la salle commune offre assez de regards pour rendre le geste dangereux.";
  }
  if (/\b(porte|fond|arriere|arriere-salle|ouvrir)\b/u.test(normalized)) {
    return "La porte du fond existe bien comme piste possible, mais cette question ne l'ouvre pas. La serveuse la surveille du coin de l'œil, et le garde semble attendre de voir si tu vas insister.";
  }
  return "La possibilité est notée sans être exécutée. La scène reste dans l'Auberge du Seuil, sous la pluie, avec le garde blessé, la serveuse nerveuse et la porte du fond comme points d'attention.";
}

function speechTarget(_rawInput: string, interpretation?: NarrativeIntentInterpretationV1): { actorId: "npc-garde-blesse" | "npc-serveuse-nerveuse"; displayName: string } {
  const structuredRef = interpretation?.referentResolution?.resolvedTarget?.ref ?? interpretation?.target?.ref ?? null;
  if (structuredRef === "npc:npc-serveuse-nerveuse" || structuredRef === "npc-serveuse-nerveuse") {
    return { actorId: "npc-serveuse-nerveuse", displayName: "Serveuse nerveuse" };
  }
  if (structuredRef === "npc:npc-garde-blesse" || structuredRef === "npc-garde-blesse") {
    return { actorId: "npc-garde-blesse", displayName: "Garde blessé" };
  }
  return { actorId: "npc-garde-blesse", displayName: "Garde blessé" };
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

function actionNarration(
  rawInput: string,
  interpretation: NarrativeIntentInterpretationV1,
  resolution: NarrativeResolutionResultV1,
  sceneState?: ReferenceSceneStateV1,
  playableScene: PlayableSceneStateV1 = REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
): string {
  const target = interpretation.referentResolution?.resolvedTarget ?? interpretation.semanticIntent.target ?? null;
  if (interpretation.semanticIntent.kind === "observe_environment" && resolution.perception !== null) {
    if (target === null || target.kind === "self" || target.kind === "unknown") {
      return playableScene.perceptibleSituation.join(" ");
    }
    const narrativeTarget = referenceNarrativeTargetLabel(target?.ref, target?.label);
    if (resolution.perception?.status === "AUTOMATIC_RESULT" && resolution.perception.revealedTexts.length > 0) {
      return resolution.perception.revealedTexts.join(" ");
    }
    if (resolution.perception?.status === "CHECK_REQUIRED") {
      return `Tu prolonges ton observation de ${narrativeTarget}, mais ce que tu cherches ne peut pas être établi par les seuls signes visibles. Une vérification perceptive est nécessaire.`;
    }
    if (resolution.perception?.status === "NOT_PERCEPTIBLE") {
      return `Tu maintiens ton attention sur ${narrativeTarget}, sans découvrir de nouvel élément directement perceptible.`;
    }
    const actorId = target?.ref?.replace(/^npc:/u, "") ?? "";
    const actor = playableScene.presentNpc.find(entry => entry.actorId === actorId);
    if (actor) {
      const continuity = actorId === "npc-garde-blesse" && sceneState?.guardAddressed
        ? " Depuis votre échange, il te reconnaît et son regard revient vers la porte du fond."
        : actorId === "npc-serveuse-nerveuse" && sceneState?.backRoomDoorHighlighted
          ? " Son attention visible revient encore vers la porte du fond."
          : "";
      return `Tu concentres ton attention sur ${actor.narrativeLabel ?? actor.displayName.toLowerCase()}. Les signes directement visibles restent les mêmes : ${actor.visibleState}.${continuity}`;
    }
    return `Tu concentres ton attention sur ${narrativeTarget}, sans obtenir de nouvel élément perceptible autorisé.`;
  }
  if (
    resolution.preparedEffects.some(effect => effect.effectType === "LOCAL_SCENE_ACTION_RECORDED") &&
    target?.ref === "poi:back-room-door"
  ) {
    if (interpretation.semanticIntent.kind === "move_near_visible_actor") {
      return "Tu te places près de la porte du fond, sans encore toucher à sa poignée ni engager son mécanisme.";
    }
    return "Ta main se referme sur la poignée de la porte étroite près du comptoir. Tu commences à faire jouer le mécanisme.";
  }
  if (
    resolution.preparedEffects.some(effect => effect.effectType === "LOCAL_SCENE_ACTION_RECORDED") &&
    target?.kind === "npc"
  ) {
    return target.ref === "npc:npc-serveuse-nerveuse" || target.ref === "npc-serveuse-nerveuse"
      ? "Tu te places près de la serveuse nerveuse, à portée de voix. Aucune parole n'est encore échangée et aucune réaction de sa part n'est résolue."
      : "Tu te places près du garde blessé, à portée de voix. Aucune parole n'est encore échangée et aucune réaction de sa part n'est résolue.";
  }
  if (
    resolution.preparedEffects.some(effect => effect.effectType === "LOCAL_SCENE_ACTION_RECORDED") &&
    interpretation.semanticIntent.kind === "move_near_visible_actor" &&
    target !== null
  ) {
    return `Tu te places près de ${target.label?.toLowerCase() ?? "la cible visible"}, sans engager d'autre action.`;
  }
  if (playableScene.sceneId !== REFERENCE_PLAYABLE_SCENE_ID_V1) {
    return playableScene.perceptibleSituation.join(" ");
  }
  return observationNarration(rawInput, sceneState);
}

function referenceNarrativeTargetLabel(ref: string | null | undefined, fallback: string | null | undefined): string {
  const actorId = ref?.replace(/^npc:/u, "") ?? "";
  const actor = REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.presentNpc.find(entry => entry.actorId === actorId);
  return actor?.narrativeLabel ?? fallback?.toLowerCase() ?? "la cible";
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
