import type { DisplayPacketV1 } from "../../narration-module/src/scene";
import { SCENE_SOCIAL_UI_CONTRACT_VERSION_V1 } from "../../narration-module/src/scene";

export const narrativePanelFixture: DisplayPacketV1 = {
  schemaVersion: 1,
  contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
  operationId: "op-ui-1",
  sceneId: "scene-archives",
  displayBlocks: [
    {
      blockId: "block-player",
      kind: "PLAYER_EXPRESSION",
      speaker: {
        speakerId: "speaker-pc",
        kind: "PLAYER_CHARACTER",
        displayName: "Aryn",
        roleLabel: "Personnage joueur",
        ariaLabel: "Personnage joueur Aryn",
        visualToken: "speaker-player"
      },
      text: "Aryn admet avec prudence qu'il ignore ce détail.",
      ariaLabel: "Personnage joueur Aryn: PLAYER_EXPRESSION",
      roleLabel: "Personnage joueur",
      visualStyleToken: "speaker-player",
      sourceRefs: ["speech:pc-1"],
      isDegradedFallback: false
    },
    {
      blockId: "block-npc",
      kind: "NPC_SPEECH",
      speaker: {
        speakerId: "speaker-guard",
        kind: "NPC",
        displayName: "garde de la porte",
        roleLabel: "PNJ",
        ariaLabel: "PNJ garde de la porte",
        visualToken: "speaker-npc"
      },
      text: "Alors vous comprenez pourquoi je ne peux pas vous laisser entrer.",
      ariaLabel: "PNJ garde de la porte: NPC_SPEECH",
      roleLabel: "PNJ",
      visualStyleToken: "speaker-npc",
      sourceRefs: ["speech:npc-1"],
      isDegradedFallback: false
    },
    {
      blockId: "block-gm",
      kind: "GM_NARRATION",
      speaker: {
        speakerId: "speaker-gm",
        kind: "GM",
        displayName: "MJ",
        roleLabel: "Maître du jeu",
        ariaLabel: "Maître du jeu",
        visualToken: "speaker-gm"
      },
      text: "La porte latérale reste dans votre champ de vision.",
      ariaLabel: "Maître du jeu: GM_NARRATION",
      roleLabel: "Maître du jeu",
      visualStyleToken: "speaker-gm",
      sourceRefs: ["event:door-visible"],
      isDegradedFallback: false
    }
  ],
  rawInputAccess: {
    available: true,
    operationId: "op-ui-1"
  },
  rhythmDiagnostics: "test fixture",
  reconstructionRefs: ["speech:pc-1", "speech:npc-1", "event:door-visible"],
  version: 1
};
