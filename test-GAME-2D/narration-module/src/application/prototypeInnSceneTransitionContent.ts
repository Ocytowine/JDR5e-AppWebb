import type { PlayableSceneStateV1 } from "./playableScene";
import type { SceneTransitionTopologyV1 } from "./sceneTransition";

export const PROTOTYPE_INN_COMMON_ROOM_REF_V1 = "location:inn-common-room";
export const PROTOTYPE_INN_BACK_ROOM_REF_V1 = "location:inn-back-room";
export const PROTOTYPE_INN_BACK_ROOM_TRANSITION_SECONDS_V1 = 8;

export const PROTOTYPE_INN_SCENE_TRANSITION_TOPOLOGY_V1: SceneTransitionTopologyV1 = {
  schemaVersion: 1,
  contractVersion: "scene-transition/1",
  topologyId: "prototype-content:inn/1",
  topologyVersion: 1,
  connections: [{
    schemaVersion: 1,
    connectionId: "prototype-inn:common-room-to-back-room",
    sourceSceneId: "reference-inn-rain-001",
    boundaryRef: "poi:back-room-door",
    destinationRef: PROTOTYPE_INN_BACK_ROOM_REF_V1,
    scale: "LOCAL",
    state: "OPEN",
    sourceRefs: ["prototype-content:inn/1", "prototype-content:inn-back-room/1"],
    version: 1
  }, {
    schemaVersion: 1,
    connectionId: "prototype-inn:back-room-to-common-room",
    sourceSceneId: "reference-inn-back-room-001",
    boundaryRef: "poi:common-room-door",
    destinationRef: PROTOTYPE_INN_COMMON_ROOM_REF_V1,
    scale: "LOCAL",
    state: "OPEN",
    sourceRefs: ["prototype-content:inn/1", "prototype-content:inn-back-room/1"],
    version: 1
  }]
};

export const PROTOTYPE_INN_BACK_ROOM_SCENE_V1: PlayableSceneStateV1 = {
  schemaVersion: 1,
  contractVersion: "playable-scene-state/1",
  sceneId: "reference-inn-back-room-001",
  locationName: "Arrière-salle de l'Auberge du Seuil",
  perceptibleSituation: [
    "La porte se referme sur le bruit de la salle commune.",
    "L'arrière-salle est étroite, éclairée par une lampe basse posée près de caisses fermées.",
    "Une odeur de métal humide se mêle à celle du bois et des réserves."
  ],
  visibleElements: [{ schemaVersion: 1, elementId: "low-lamp", label: "Lampe basse", description: "Une lampe à huile éclaire faiblement les caisses et le sol marqué de traces humides.", keywords: ["lampe", "lumière", "caisses"], playerVisible: true, version: 1 }, { schemaVersion: 1, elementId: "wet-traces", label: "Traces humides", description: "Des traces humides marquent le sol entre les caisses, sans origine immédiatement visible.", keywords: ["traces", "traces humides", "sol", "marques"], playerVisible: true, version: 1 }],
  presentNpc: [],
  pointsOfInterest: [{ schemaVersion: 1, pointId: "common-room-door", label: "Porte vers la salle commune", visibleDescription: "La porte étroite permet de revenir vers la salle commune.", keywords: ["porte", "salle commune", "retour"], destinationAliases: ["salle commune"], version: 1 }],
  perceptionClues: [{ schemaVersion: 1, clueId: "wet-traces-immediate", targetRef: "element:wet-traces", visibility: "IMMEDIATE", factKind: "VISIBLE_SIGN", playerText: "Les traces humides sont récentes en apparence et traversent le sol entre les caisses, sans que leur origine soit visible.", sourceRefs: ["prototype-content:inn-back-room/1", "element:wet-traces"], version: 1 }, { schemaVersion: 1, clueId: "wet-traces-focused", targetRef: "element:wet-traces", visibility: "FOCUSED", factKind: "VISIBLE_SIGN", playerText: "En les examinant, tu distingues plusieurs marques irrégulières et de petites gouttes, mais rien ne permet encore d'identifier avec certitude qui ou quoi les a laissées.", sourceRefs: ["prototype-content:inn-back-room/1", "element:wet-traces"], version: 1 }, { schemaVersion: 1, clueId: "wet-traces-origin", targetRef: "element:wet-traces", visibility: "CHECKED", factKind: "HIDDEN_FACT", playerText: "L'origine exacte des traces n'est pas directement perceptible.", sourceRefs: ["prototype-content:inn-back-room/1", "element:wet-traces"], version: 1 }],
  currentTension: "Les traces humides au sol sont visibles, mais leur origine n'est pas encore établie.",
  playerKnownFacts: ["Le personnage vient de quitter la salle commune.", "L'arrière-salle est actuellement vide de présence visible."],
  localMemoryPolicy: { schemaVersion: 1, maxShortTermNpcMemory: 5, version: 1 },
  aiSceneWriterPolicy: { schemaVersion: 1, mayCreate: [], mayReference: ["prototype-content:inn-back-room/1"], mustNotCreate: ["PNJ durable", "objet utile", "passage secret", "issue mécanique"], noveltyConstraints: ["texture sensorielle locale uniquement", "aucune origine inventée pour les traces"], version: 1 },
  version: 1
};
