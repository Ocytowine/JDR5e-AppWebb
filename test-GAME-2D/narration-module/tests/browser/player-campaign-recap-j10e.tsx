import React from "react";
import { createRoot } from "react-dom/client";
import { PlayerCampaignRecapPanel } from "../../../src/narration-ui/PlayerCampaignRecapPanel";
import type { PlayerCampaignRecapV1 } from "../../src/application";

const recap: PlayerCampaignRecapV1 = {
  schemaVersion: 1,
  contractVersion: "player-campaign-recap/1",
  situation: { characterLabel: "Elwen", locationLabel: "Archives de Lysenthe", elapsedGameSeconds: 7200, travel: { schemaVersion: 1, contractVersion: "player-travel-summary/1", status: "STATIONARY", currentLocationLabel: "Archives de Lysenthe", destinationLabel: null, perceptibleInterruption: null } },
  peopleHere: [],
  knownFacts: [{ statement: "Une porte a été forcée.", status: "OBSERVED" }],
  companions: [{ displayName: "Lyra", membershipStatus: "WITH_PLAYER", lastKnownLocation: "Archives de Lysenthe" }],
  engagements: [{ kind: "MISSION", summary: "Retrouver le registre disparu", status: "ACCEPTED", publicConditions: [], publicOutcome: null }],
  investigation: [{ discoveries: [], expressedHypotheses: [{ statement: "Le sceau vient peut-être du port.", status: "UNCONFIRMED" }], publicConclusion: null, openQuestion: "Que reste-t-il à comprendre ?" }],
  inventory: { schemaVersion: 1, contractVersion: "player-inventory-summary/1", items: [{ label: "Épée", quantity: 1, equipped: true }, { label: "Corde", quantity: 2, equipped: false }], readOnly: true },
  chronicle: [],
  authority: "PLAYER_VISIBLE_READ_ONLY",
  deterministic: true,
  noCommit: true,
  noGameTime: true
};

createRoot(document.getElementById("root")!).render(<div style={{ width: "min(900px, 100%)", margin: "40px auto", padding: 20 }}>
  <PlayerCampaignRecapPanel refreshKey="stable" readRecap={async () => ({ ok: true, value: recap })} />
</div>);
