import React from "react";
import { createRoot } from "react-dom/client";
import { PlayerPrivateNotebookPanel } from "../../../src/narration-ui/PlayerPrivateNotebookPanel";

createRoot(document.getElementById("root")!).render(
  <div style={{ width: "min(900px, 100%)", margin: "40px auto", padding: 20 }}>
    <PlayerPrivateNotebookPanel scope={{
      campaignId: "campaign:j10d-browser",
      characterRef: "character:j10d-browser"
    }} />
  </div>
);
