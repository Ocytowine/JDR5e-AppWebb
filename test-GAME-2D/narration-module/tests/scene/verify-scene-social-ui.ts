import assert from "node:assert/strict";
import {
  buildDisplayPacketFromRenderPlanV1,
  decideConversationRhythmV1,
  reconstructInteractionLogEntriesV1,
  SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
  validateDisplayPacketV1,
  validateRenderPlanV1,
  validateSceneStateV1,
  validateSocialKnowledgeStateV1,
  validateSuspendedClarificationV1,
  type ConversationRhythmPolicyV1,
  type RenderPlanV1,
  type SceneStateV1,
  type SocialKnowledgeStateV1,
  type SpeakerRefV1,
  type SuspendedClarificationV1
} from "../../src/scene";

function speaker(input: Omit<SpeakerRefV1, "schemaVersion">): SpeakerRefV1 {
  return { schemaVersion: 1, ...input };
}

const gm = speaker({
  speakerId: "speaker-gm",
  kind: "GM",
  actorRef: null,
  displayName: "MJ",
  knownNameStatus: "KNOWN",
  roleLabel: "Maître du jeu",
  accessibilityLabel: "Maître du jeu",
  visualToken: "speaker-gm"
});

const pc = speaker({
  speakerId: "speaker-pc-aryn",
  kind: "PLAYER_CHARACTER",
  actorRef: "pc-aryn",
  displayName: "Aryn",
  knownNameStatus: "KNOWN",
  roleLabel: "Personnage joueur",
  accessibilityLabel: "Personnage joueur Aryn",
  visualToken: "speaker-player"
});

const guard = speaker({
  speakerId: "speaker-npc-guard",
  kind: "NPC",
  actorRef: "npc-gate-guard-01",
  displayName: "garde de la porte",
  knownNameStatus: "DESIGNATION",
  roleLabel: "PNJ",
  accessibilityLabel: "PNJ garde de la porte",
  visualToken: "speaker-npc-guard"
});

const archivist = speaker({
  speakerId: "speaker-npc-archivist",
  kind: "NPC",
  actorRef: "npc-archivist-01",
  displayName: "archiviste nerveuse",
  knownNameStatus: "DESIGNATION",
  roleLabel: "PNJ",
  accessibilityLabel: "PNJ archiviste nerveuse",
  visualToken: "speaker-npc-archivist"
});

const system = speaker({
  speakerId: "speaker-system",
  kind: "SYSTEM",
  actorRef: null,
  displayName: "Système",
  knownNameStatus: "KNOWN",
  roleLabel: "Notification système",
  accessibilityLabel: "Notification système",
  visualToken: "speaker-system"
});

const scene: SceneStateV1 = {
  schemaVersion: 1,
  contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
  sceneId: "scene-archives-entrance",
  campaignId: "campaign-1",
  status: "ACTIVE",
  locationRef: "archives_de_lysenthe",
  startedAtGameTime: 3600,
  lastRelevantGameTime: 3660,
  participantRefs: ["pc-aryn", "npc-gate-guard-01", "npc-archivist-01"],
  establishedStaging: [
    {
      stagingId: "staging-door",
      text: "Une porte latérale est parfois observée par les gardes.",
      sourceRefs: ["event-scene-entered"],
      persistence: "PERCEPTIBLE_FACT"
    }
  ],
  activeThreadRefs: ["thread-private-archives-access"],
  perceptionAnchors: ["archives-private-access", "visible-door"],
  sourceEventRefs: ["event-scene-entered"],
  transitionCause: "LOCATION_CHANGE",
  version: 1
};

assert.equal(validateSceneStateV1(scene).ok, true, "SceneStateV1 valide");

const social: SocialKnowledgeStateV1 = {
  schemaVersion: 1,
  contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
  actorId: "npc-gate-guard-01",
  knownFactRefs: ["fact_archives_private"],
  beliefs: [
    {
      beliefId: "belief-aryn-low-status",
      claim: "Aryn n'a probablement pas d'autorisation officielle.",
      confidence: "MEDIUM",
      sourceRefs: ["event-aryn-arrived-without-warrant"],
      mayBeFalse: true
    }
  ],
  relationshipEdges: [
    {
      targetActorId: "pc-aryn",
      dimensions: { trust: -1, respect: 0 },
      sourceRefs: ["event-first-contact"]
    }
  ],
  reputationMarkers: [],
  debtsAndPromises: [],
  visibilityConstraints: ["guard-does-not-know-hidden-plot"],
  sourceEventRefs: ["event-first-contact"],
  version: 1
};

assert.equal(validateSocialKnowledgeStateV1(social).ok, true, "SocialKnowledgeStateV1 valide");

const renderPlan: RenderPlanV1 = {
  schemaVersion: 1,
  contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
  operationId: "op-017",
  sceneId: scene.sceneId,
  sourceRevision: 12,
  blocks: [
    {
      blockId: "block-raw",
      kind: "RAW_INPUT",
      speakerRef: pc,
      sourceRefs: ["operation:op-017:raw"],
      groundedIn: ["operation:op-017:raw"],
      textPolicy: "EXACT",
      visibility: "PLAYER_VISIBLE",
      order: 0,
      text: "je sais pas"
    },
    {
      blockId: "block-pc-expression",
      kind: "PLAYER_EXPRESSION",
      speakerRef: pc,
      sourceRefs: ["speech:pc-expression-017"],
      groundedIn: ["intent:ignorance"],
      textPolicy: "EXACT",
      visibility: "PLAYER_VISIBLE",
      order: 1,
      text: "Aryn soutient le regard du garde, puis admet avec prudence qu'il ignore ce détail."
    },
    {
      blockId: "block-guard",
      kind: "NPC_SPEECH",
      speakerRef: guard,
      sourceRefs: ["speech:guard-017"],
      groundedIn: ["fact_archives_private", "knowledge:guard-access-policy"],
      textPolicy: "EXACT",
      visibility: "PLAYER_VISIBLE",
      order: 2,
      text: "Alors vous comprenez pourquoi je ne peux pas vous laisser entrer."
    },
    {
      blockId: "block-archivist",
      kind: "NPC_SPEECH",
      speakerRef: archivist,
      sourceRefs: ["speech:archivist-017"],
      groundedIn: ["belief:archivist-heard-hesitation"],
      textPolicy: "EXACT",
      visibility: "PLAYER_VISIBLE",
      order: 3,
      text: "Il y a peut-être une autre manière de vérifier son motif."
    },
    {
      blockId: "block-narration",
      kind: "GM_NARRATION",
      speakerRef: gm,
      sourceRefs: ["event-social-pressure"],
      groundedIn: ["visible-door", "event-social-pressure"],
      textPolicy: "AI_NARRATIVE_ALLOWED",
      visibility: "PLAYER_VISIBLE",
      order: 4,
      text: "La porte latérale reste dans votre champ de vision tandis que les deux employés échangent un regard bref."
    }
  ],
  rhythmDecision: {
    reason: "ASK_PLAYER",
    diagnostic: "second NPC introduced and direct opportunity returned to player"
  },
  fallbackAllowed: true,
  version: 1
};

const exactTextBySourceRef = new Map<string, string>([
  ["operation:op-017:raw", "je sais pas"],
  ["speech:pc-expression-017", "Aryn soutient le regard du garde, puis admet avec prudence qu'il ignore ce détail."],
  ["speech:guard-017", "Alors vous comprenez pourquoi je ne peux pas vous laisser entrer."],
  ["speech:archivist-017", "Il y a peut-être une autre manière de vérifier son motif."]
]);

assert.equal(validateRenderPlanV1(renderPlan, { exactTextBySourceRef }).ok, true, "RenderPlanV1 valide avec blocs exacts");

const rewrittenPlan: RenderPlanV1 = {
  ...renderPlan,
  blocks: renderPlan.blocks.map(block => block.blockId === "block-guard" ? { ...block, text: "Je vous laisse entrer." } : block)
};
assert.equal(validateRenderPlanV1(rewrittenPlan, { exactTextBySourceRef }).ok, false, "réécriture PNJ exacte rejetée");

const packet = buildDisplayPacketFromRenderPlanV1({
  renderPlan,
  rawInputAvailable: true,
  diagnosticsEnabled: true
});

assert.equal(validateDisplayPacketV1(packet).ok, true, "DisplayPacketV1 valide");
assert.equal(packet.displayBlocks.length, 5);
assert.equal(packet.displayBlocks[1]?.speaker.roleLabel, "Personnage joueur");
assert.equal(packet.displayBlocks[2]?.speaker.displayName, "garde de la porte");
assert.equal(packet.displayBlocks[3]?.speaker.displayName, "archiviste nerveuse");
assert.ok(packet.displayBlocks.every(block => block.ariaLabel.length > 0 && block.roleLabel.length > 0), "l'attribution ne dépend pas de la couleur seule");
assert.equal(packet.rawInputAccess.available, true, "entrée brute consultable");

const autonomousPacket = {
  ...packet,
  operationId: "op-autonomous-018",
  displayBlocks: packet.displayBlocks.filter(block => block.kind !== "RAW_INPUT"),
  rawInputAccess: {
    available: false,
    operationId: "op-autonomous-018"
  }
};
assert.equal(
  validateDisplayPacketV1(autonomousPacket).ok,
  true,
  "un rendu autonome sans entrée joueur déclare explicitement l'absence d'entrée brute"
);
assert.equal(
  validateDisplayPacketV1({
    ...autonomousPacket,
    displayBlocks: packet.displayBlocks
  }).ok,
  false,
  "un bloc d'entrée brute ne peut jamais être affiché comme indisponible"
);

const logEntries = reconstructInteractionLogEntriesV1({
  campaignId: "campaign-1",
  operationId: renderPlan.operationId,
  sceneId: renderPlan.sceneId,
  gameTime: 3660,
  recordedAt: "2026-07-07T12:00:00.000Z",
  commitId: "commit-12",
  eventRefs: ["event-social-pressure"],
  renderPlan
});

assert.equal(logEntries.length, renderPlan.blocks.length, "InteractionLog reconstruit depuis les sources");
assert.deepEqual(
  logEntries.map(entry => entry.text),
  renderPlan.blocks.sort((a, b) => a.order - b.order).map(block => block.text),
  "perte du cache transcript sans perte de texte source"
);

const clarification: SuspendedClarificationV1 = {
  schemaVersion: 1,
  suspendedIntentId: "suspended-steal-question",
  operationId: "op-clarify-1",
  sceneId: scene.sceneId,
  rawInput: "je peux lui voler quelque chose ?",
  knownInterpretation: "question de possibilité ou intention de vol ambiguë",
  missingField: "commitment",
  question: "Tu demandes si c'est possible, ou tu veux réellement tenter de voler le garde ?",
  initialSnapshotId: "snapshot-12",
  dependencyRefs: ["scene-archives-entrance", "npc-gate-guard-01"],
  noGameTime: true
};

assert.equal(validateSuspendedClarificationV1(clarification).ok, true, "clarification sans temps ni mutation");

const inventoryRenderPlan: RenderPlanV1 = {
  schemaVersion: 1,
  contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
  operationId: "op-009",
  sceneId: scene.sceneId,
  sourceRevision: 13,
  blocks: [
    {
      blockId: "block-visible-clothes",
      kind: "GM_NARRATION",
      speakerRef: gm,
      sourceRefs: ["projection:visible-equipment"],
      groundedIn: ["slot:corps:obj_vetements_voyage", "cleanliness:travel-worn"],
      textPolicy: "DETERMINISTIC_ONLY",
      visibility: "PLAYER_VISIBLE",
      order: 0,
      text: "Vos vêtements de voyage usés et l'insigne visible attirent l'attention avant votre bourse."
    },
    {
      blockId: "block-system-wallet",
      kind: "SYSTEM_NOTICE",
      speakerRef: system,
      sourceRefs: ["inventory:obj_bourse", "currency:or:10"],
      groundedIn: ["container:ceinture_bourse_1"],
      textPolicy: "DETERMINISTIC_ONLY",
      visibility: "PLAYER_VISIBLE",
      order: 1,
      text: "Monnaie accessible : 10 pièces d'or dans la bourse portée."
    }
  ],
  rhythmDecision: { reason: "ASK_PLAYER", diagnostic: "commerce requires player decision" },
  fallbackAllowed: true,
  version: 1
};

assert.equal(validateRenderPlanV1(inventoryRenderPlan).ok, true, "apparence visible et monnaie accessible projetées");
assert.ok(!inventoryRenderPlan.blocks.some(block => block.groundedIn.includes("storedIn:paquetage:unknown")), "contenu de sac non exposé comme visible");

const policy: ConversationRhythmPolicyV1 = {
  schemaVersion: 1,
  maxAutomaticNpcTurns: 2,
  maxNarrativeBlocksBeforePlayer: 4,
  handoffOnDirectQuestionToPlayer: true,
  allowNpcInterruption: true,
  allowPlayerAsObserver: true,
  descriptionDensity: "MEDIUM",
  diagnosticsEnabled: true
};

assert.equal(decideConversationRhythmV1({
  policy,
  automaticNpcTurns: 2,
  narrativeBlocksSincePlayer: 2,
  directQuestionToPlayer: false,
  needsClarification: false,
  systemHandoff: false
}).reason, "RHYTHM_LIMIT", "seuil de rythme réglable appliqué");

const degraded = buildDisplayPacketFromRenderPlanV1({
  renderPlan: inventoryRenderPlan,
  rawInputAvailable: true,
  diagnosticsEnabled: false,
  isDegradedFallback: true
});
assert.ok(degraded.displayBlocks.every(block => block.isDegradedFallback), "rendu dégradé marqué sans nouvelle vérité");

console.log("scene-social-ui/1: OK");
