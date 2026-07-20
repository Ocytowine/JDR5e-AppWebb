import type { JsonObject } from "../core";

export const PLAYABLE_SCENE_CONTRACT_VERSION_V1 = "playable-scene-state/1" as const;

export interface PlayableSceneVisibleElementV1 extends JsonObject {
  schemaVersion: 1;
  elementId: string;
  label: string;
  description: string;
  keywords: string[];
  playerVisible: true;
  version: 1;
}

export interface PlayableSceneNpcV1 extends JsonObject {
  schemaVersion: 1;
  actorId: string;
  displayName: string;
  publicRole: string;
  visibleState: string;
  keywords: string[];
  defaultReply: string;
  repeatedReply: string;
  version: 1;
}

export interface PlayableScenePointOfInterestV1 extends JsonObject {
  schemaVersion: 1;
  pointId: string;
  label: string;
  visibleDescription: string;
  keywords: string[];
  version: 1;
}

export interface PlayableSceneStateV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLAYABLE_SCENE_CONTRACT_VERSION_V1;
  sceneId: string;
  locationName: string;
  perceptibleSituation: string[];
  visibleElements: PlayableSceneVisibleElementV1[];
  presentNpc: PlayableSceneNpcV1[];
  pointsOfInterest: PlayableScenePointOfInterestV1[];
  currentTension: string;
  playerKnownFacts: string[];
  localMemoryPolicy: {
    schemaVersion: 1;
    maxShortTermNpcMemory: number;
    version: 1;
  };
  aiSceneWriterPolicy: {
    schemaVersion: 1;
    mayCreate: string[];
    mayReference: string[];
    mustNotCreate: string[];
    noveltyConstraints: string[];
    version: 1;
  };
  version: 1;
}

export interface PlayableScenePublicContextV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLAYABLE_SCENE_CONTRACT_VERSION_V1;
  sceneId: string;
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

export const REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1: PlayableSceneStateV1 = {
  schemaVersion: 1,
  contractVersion: PLAYABLE_SCENE_CONTRACT_VERSION_V1,
  sceneId: "reference-inn-rain-001",
  locationName: "Auberge du Seuil",
  perceptibleSituation: [
    "La pluie frappe les volets et laisse une odeur de laine humide dans la salle.",
    "Un garde blessé garde une main sur son flanc et cherche quelqu'un du regard.",
    "La serveuse essuie trois fois le même gobelet en évitant de regarder la porte du fond.",
    "Une porte étroite près du comptoir mène vers l'arrière-salle."
  ],
  visibleElements: [{
    schemaVersion: 1,
    elementId: "rain-shutters",
    label: "Pluie aux volets",
    description: "La pluie couvre une partie des murmures et isole la salle commune.",
    keywords: ["pluie", "volets", "meteo"],
    playerVisible: true,
    version: 1
  }, {
    schemaVersion: 1,
    elementId: "back-room-door",
    label: "Porte du fond",
    description: "La porte du fond attire trop de regards pour être anodine.",
    keywords: ["porte", "fond", "arriere", "arriere-salle", "poignée", "mécanisme", "loquet", "battant"],
    playerVisible: true,
    version: 1
  }],
  presentNpc: [{
    schemaVersion: 1,
    actorId: "npc-garde-blesse",
    displayName: "Garde blessé",
    publicRole: "Garde de ville",
    visibleState: "fatigué, nerveux, blessure bandée sous la cuirasse",
    keywords: ["garde", "blesse", "soldat", "homme", "homme blessé"],
    defaultReply: "Le garde baisse la voix. « Si vous cherchez des réponses, commencez par la porte du fond. Mais ne faites pas de geste brusque ici. »",
    repeatedReply: "Le garde ne répète pas toute son explication. Il incline seulement la tête vers l'arrière-salle. « Je vous l'ai dit : la porte du fond. Si vous insistez, faites-le vite, avant que ceux dehors n'entrent. »",
    version: 1
  }, {
    schemaVersion: 1,
    actorId: "npc-serveuse-nerveuse",
    displayName: "Serveuse nerveuse",
    publicRole: "Employée de l'auberge",
    visibleState: "mains occupées, regard fuyant, attention fixée sur l'arrière-salle",
    keywords: ["serveuse", "aubergiste", "comptoir", "femme", "dame"],
    defaultReply: "La serveuse cesse enfin d'essuyer son gobelet. « Nerveuse ? Avec cette pluie, ce garde qui saigne et cette porte qu'on me demande d'ignorer, vous ne le seriez pas ? »",
    repeatedReply: "La serveuse garde le gobelet entre ses mains. « Je vous ai déjà dit que je ne veux pas d'ennuis. La porte du fond ne s'ouvre pas pour les curieux. »",
    version: 1
  }],
  pointsOfInterest: [{
    schemaVersion: 1,
    pointId: "back-room-door",
    label: "Porte du fond",
    visibleDescription: "Une porte étroite près du comptoir mène vers l'arrière-salle.",
    keywords: ["porte", "fond", "arriere", "arriere-salle", "poignée", "mécanisme", "loquet", "battant"],
    version: 1
  }],
  currentTension: "Quelqu'un ou quelque chose est attendu dehors, mais personne ne veut le nommer à voix haute.",
  playerKnownFacts: [
    "Le personnage est dans la salle commune.",
    "La scène est sociale et observable; aucun combat n'est engagé.",
    "Les questions méta ne font pas avancer le temps."
  ],
  localMemoryPolicy: {
    schemaVersion: 1,
    maxShortTermNpcMemory: 5,
    version: 1
  },
  aiSceneWriterPolicy: {
    schemaVersion: 1,
    mayCreate: [],
    mayReference: ["reference-scene:reference-inn-rain-001"],
    mustNotCreate: ["PNJ durable", "lieu durable", "objet utile", "indice secret", "issue de combat"],
    noveltyConstraints: ["texture sensorielle locale uniquement", "aucune nouvelle vérité durable"],
    version: 1
  },
  version: 1
};

export const WATCHTOWER_DAWN_PLAYABLE_SCENE_V1: PlayableSceneStateV1 = {
  schemaVersion: 1,
  contractVersion: PLAYABLE_SCENE_CONTRACT_VERSION_V1,
  sceneId: "watchtower-dawn-001",
  locationName: "Tour de guet de Brumeval",
  perceptibleSituation: [
    "L'aube grise éclaire une tour de pierre ouverte aux vents.",
    "Une vigie fatiguée surveille la route basse avec une longue-vue fissurée.",
    "Un brasero presque éteint fume au centre de la plateforme.",
    "Un escalier raide redescend vers la cour intérieure."
  ],
  visibleElements: [{
    schemaVersion: 1,
    elementId: "cracked-spyglass",
    label: "Longue-vue fissurée",
    description: "La longue-vue permet encore d'observer la route, mais son verre déforme les détails.",
    keywords: ["longue-vue", "route", "observer"],
    playerVisible: true,
    version: 1
  }],
  presentNpc: [{
    schemaVersion: 1,
    actorId: "npc-vigie-fatiguee",
    displayName: "Vigie fatiguée",
    publicRole: "Guetteur de Brumeval",
    visibleState: "yeux rouges, manteau serré, attention tournée vers la route basse",
    keywords: ["vigie", "guetteur", "garde"],
    defaultReply: "La vigie garde l'œil sur la route. « Si vous avez vu de la poussière au sud, dites-le maintenant. Je n'ai plus confiance dans cette longue-vue. »",
    repeatedReply: "La vigie ne quitte pas la route des yeux. « Je vous ai entendu. La poussière au sud, la longue-vue fissurée, et personne pour relayer mon tour. »",
    version: 1
  }],
  pointsOfInterest: [{
    schemaVersion: 1,
    pointId: "south-road",
    label: "Route basse",
    visibleDescription: "La route basse disparaît par moments dans des bancs de brume.",
    keywords: ["route", "sud", "brume"],
    version: 1
  }],
  currentTension: "Quelque chose bouge peut-être sur la route basse, mais la distance rend toute certitude fragile.",
  playerKnownFacts: [
    "Le personnage est en hauteur, sur une tour de guet.",
    "La scène est observable et sociale; aucun combat n'est engagé.",
    "La longue-vue est utile mais imparfaite."
  ],
  localMemoryPolicy: {
    schemaVersion: 1,
    maxShortTermNpcMemory: 5,
    version: 1
  },
  aiSceneWriterPolicy: {
    schemaVersion: 1,
    mayCreate: [],
    mayReference: ["reference-scene:watchtower-dawn-001"],
    mustNotCreate: ["PNJ durable", "lieu durable", "objet utile", "indice secret", "issue de combat"],
    noveltyConstraints: ["texture sensorielle locale uniquement", "aucune nouvelle vérité durable"],
    version: 1
  },
  version: 1
};

export function validatePlayableSceneV1(scene: PlayableSceneStateV1): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (scene.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (scene.contractVersion !== PLAYABLE_SCENE_CONTRACT_VERSION_V1) issues.push("contractVersion must be playable-scene-state/1.");
  if (!scene.sceneId.trim()) issues.push("sceneId is required.");
  if (!scene.locationName.trim()) issues.push("locationName is required.");
  if (scene.perceptibleSituation.length === 0) issues.push("perceptibleSituation must not be empty.");
  if (scene.presentNpc.length === 0) issues.push("presentNpc must not be empty.");
  if (scene.visibleElements.some(element => !element.playerVisible)) issues.push("visibleElements must be player-visible only.");
  if (scene.localMemoryPolicy.maxShortTermNpcMemory < 1 || scene.localMemoryPolicy.maxShortTermNpcMemory > 10) {
    issues.push("maxShortTermNpcMemory must stay bounded between 1 and 10.");
  }
  if (scene.aiSceneWriterPolicy.mayCreate.length > 0) issues.push("I-06S does not allow durable or ephemeral AI creation yet.");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function toPlayableScenePublicContextV1(scene: PlayableSceneStateV1): PlayableScenePublicContextV1 {
  return {
    schemaVersion: 1,
    contractVersion: PLAYABLE_SCENE_CONTRACT_VERSION_V1,
    sceneId: scene.sceneId,
    locationName: scene.locationName,
    perceptibleSituation: [...scene.perceptibleSituation],
    presentNpc: scene.presentNpc.map(npc => ({
      actorId: npc.actorId,
      displayName: npc.displayName,
      publicRole: npc.publicRole,
      visibleState: npc.visibleState
    })),
    currentTension: scene.currentTension,
    playerKnownFacts: [...scene.playerKnownFacts],
    version: 1
  };
}

export function findPlayableSceneNpcTargetV1(scene: PlayableSceneStateV1, rawInput: string): PlayableSceneNpcV1 | null {
  const normalized = normalize(rawInput);
  const candidates = scene.presentNpc.filter(npc => npc.keywords.some(keyword => normalized.includes(normalize(keyword))));
  return candidates.length === 1 ? candidates[0] ?? null : null;
}

export function buildPlayableSceneLocationAnswerV1(scene: PlayableSceneStateV1): string {
  const firstNpc = scene.presentNpc[0];
  const firstPoint = scene.pointsOfInterest[0];
  const npcText = firstNpc ? `${firstNpc.displayName} est visible: ${firstNpc.visibleState}.` : "Aucun PNJ n'est mis en avant.";
  const pointText = firstPoint ? `${firstPoint.label}: ${firstPoint.visibleDescription}` : scene.currentTension;
  return `Tu es à ${scene.locationName}. ${scene.perceptibleSituation[0]} ${npcText} ${pointText} Cette réponse ne fait pas avancer le temps.`;
}

export function buildPlayableSceneObservationV1(scene: PlayableSceneStateV1, rawInput: string): string {
  const normalized = normalize(rawInput);
  const point = scene.pointsOfInterest.find(candidate => candidate.keywords.some(keyword => normalized.includes(normalize(keyword))));
  if (point) return `${point.label}: ${point.visibleDescription} ${scene.currentTension}`;
  return `${scene.perceptibleSituation.join(" ")} Tension: ${scene.currentTension}`;
}

export function buildPlayableSceneSocialPossibilityAnswerV1(scene: PlayableSceneStateV1, rawInput: string): string {
  const npc = findPlayableSceneNpcTargetV1(scene, rawInput);
  if (npc === null) return "Tu peux tenter de parler à un interlocuteur visible, mais il faut préciser lequel avant de lui adresser la parole.";
  return `Tu peux tenter de parler à ${npc.displayName}, mais cette réponse ne lui adresse pas encore la parole. ${npc.visibleState}`;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
