import { useEffect, useMemo, useState } from "react";
import {
  buildReferenceSceneLocalNarrationV1,
  applyNarrativePresentationVariationV1,
  createBrowserPersistentNarrativeTurnControllerV1,
  createPrototypeNarrativeTurnControllerV1,
  enhanceNarrativeDisplayWithAiV1,
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
  type AiNarrativeEnhancementResultV1,
  type AiIntentInterpreterConfigV1,
  type NarrativeTurnControllerV1
} from "../../narration-module/src/application";
import { FakeContractAiProviderV1 } from "../../narration-module/src/ai/FakeContractAiProvider";
import type { AiModelRouteV1, AiRetryPolicyV1 } from "../../narration-module/src/ai/types";
import type { NarrativeTurnControllerOutputV1 } from "../../narration-module/src/application";
import type { DisplayPacketV1 } from "../../narration-module/src/scene";
import { SCENE_SOCIAL_UI_CONTRACT_VERSION_V1 } from "../../narration-module/src/scene";
import {
  NarrativeConversationPanel,
  type NarrativeSubmitPayloadV1
} from "../ui/NarrativeConversationPanel";
import { ServerOpenAiEnhancementProviderV1 } from "./serverOpenAiEnhancementClient";

type NarrativeEnhancementMode = "local" | "openai";

export function NarrativeAppSurface() {
  const [controller, setController] = useState<NarrativeTurnControllerV1 | null>(null);
  const [packetsFromController, setPacketsFromController] = useState<DisplayPacketV1[]>([]);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [enhancementMode, setEnhancementMode] = useState<NarrativeEnhancementMode>("local");
  const [enhancementStatus, setEnhancementStatus] = useState<string>("Mode local actif pour l'interprétation et l'enrichissement.");
  const packets = useMemo(
    () => [createWelcomePacket(), ...packetsFromController],
    [packetsFromController]
  );

  useEffect(() => {
    let cancelled = false;
    setController(null);
    const intentInterpreterConfig = buildIntentInterpreterConfig(enhancementMode);
    void createBrowserPersistentNarrativeTurnControllerV1({ intentInterpreterConfig }).then(async nextController => {
      const restored = await nextController.restoreRenderedThread();
      if (!cancelled) {
        if (restored.ok) {
          setPacketsFromController(restored.value.displayPackets);
        } else {
          setErrorMessage(restored.error.messageKey);
        }
        setController(nextController);
      }
    }).catch(error => {
      void createPrototypeNarrativeTurnControllerV1({ intentInterpreterConfig }).then(nextController => {
        if (!cancelled) setController(nextController);
      }).catch(fallbackError => {
        if (!cancelled) {
          const primary = error instanceof Error ? error.message : String(error);
          const fallback = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          setErrorMessage(`${primary}; fallback mémoire indisponible: ${fallback}`);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [enhancementMode]);

  function handleSubmit(payload: NarrativeSubmitPayloadV1) {
    if (!controller) {
      setErrorMessage("Contrôleur narratif indisponible.");
      return;
    }
    setPending(true);
    setErrorMessage(null);
    void controller.submit(payload).then(async result => {
      if (!result.ok) {
        setErrorMessage(result.error.messageKey);
        return;
      }
      const enhancement = await enhancePrototypePacket(result.value.output, enhancementMode, packetsFromController);
      const recorded = await controller.recordRenderedProjection({
        schemaVersion: 1,
        clientRequestId: result.value.output.clientRequestId,
        sourceOutput: result.value.output,
        mode: enhancementMode,
        finalEnhancement: enhancement.finalEnhancement,
        attemptedEnhancement: enhancement.attemptedEnhancement,
        statusMessage: enhancement.status
      });
      if (!recorded.ok) {
        setErrorMessage(recorded.error.messageKey);
        return;
      }
      setEnhancementStatus(enhancement.status);
      const enhanced = enhancement.displayPacket;
      setPacketsFromController(prev => [...prev, enhanced]);
    }).catch(error => {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      setPending(false);
    });
  }

  return (
    <main
      aria-label="Surface narration"
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "82px 18px 18px",
        background:
          "radial-gradient(circle at 20% 0%, rgba(88,166,255,0.20), transparent 32%), linear-gradient(145deg, #070911, #111522 62%, #070911)"
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 14
        }}
      >
        <section
          aria-label="Statut du module narration"
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(8,10,18,0.72)",
            padding: 14,
            boxShadow: "0 18px 60px rgba(0,0,0,0.30)"
          }}
        >
          <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Narration</h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.5 }}>
            Surface dédiée au module narration. Ce prototype affiche des projections typées et remonte la saisie
            libre via le contrôleur applicatif prototype. L'enrichissement IA peut rester local ou passer par la route
            serveur OpenAI opt-in, sans clé navigateur, sans écrire de transcript local et sans dépendre du plateau
            tactique.
          </p>
          <fieldset
            aria-label="Mode IA narrative"
            style={{
              margin: "12px 0 0",
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)"
            }}
          >
            <legend style={{ padding: "0 6px", color: "rgba(255,255,255,0.76)", fontSize: 12 }}>
              IA narrative
            </legend>
            <label style={{ marginRight: 12, fontSize: 13 }}>
              <input
                type="radio"
                name="narrative-ai-mode"
                value="local"
                checked={enhancementMode === "local"}
                onChange={() => {
                  setEnhancementMode("local");
                  setEnhancementStatus("Mode local actif pour l'interprétation et l'enrichissement.");
                }}
              />{" "}
              Locale
            </label>
            <label style={{ fontSize: 13 }}>
              <input
                type="radio"
                name="narrative-ai-mode"
                value="openai"
                checked={enhancementMode === "openai"}
                onChange={() => {
                  setEnhancementMode("openai");
                  setEnhancementStatus("Mode OpenAI demandé pour l'interprétation et l'enrichissement. Fallback local si la route serveur est désactivée.");
                }}
              />{" "}
              OpenAI
            </label>
            <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.62)", fontSize: 12 }}>
              {enhancementStatus}
            </p>
          </fieldset>
          {errorMessage && (
            <p role="alert" style={{ margin: "8px 0 0", color: "#ffb4b4", fontSize: 12 }}>
              {errorMessage}
            </p>
          )}
        </section>

        <div style={{ height: "calc(100vh - 190px)", minHeight: 420 }}>
          <NarrativeConversationPanel
            packets={packets}
            pending={pending || controller === null}
            title="Fil narratif"
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </main>
  );
}

function createWelcomePacket(): DisplayPacketV1 {
  return {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: "prototype-welcome",
    sceneId: "prototype-narration-surface",
    displayBlocks: [
      {
        blockId: "prototype-welcome-gm",
        kind: "GM_NARRATION",
        speaker: {
          speakerId: "speaker-gm",
          kind: "GM",
          displayName: "MJ",
          roleLabel: "Maître du jeu",
          ariaLabel: "Maître du jeu",
          visualToken: "speaker-gm"
        },
        text: "La surface narration est prête. Le prochain lot branchera cette UI à un contrôleur de campagne réel.",
        ariaLabel: "Maître du jeu: GM_NARRATION",
        roleLabel: "Maître du jeu",
        visualStyleToken: "speaker-gm",
        sourceRefs: ["prototype:surface"],
        isDegradedFallback: false
      },
      {
        blockId: "prototype-welcome-system",
        kind: "SYSTEM_NOTICE",
        speaker: {
          speakerId: "speaker-system",
          kind: "SYSTEM",
          displayName: "Système",
          roleLabel: "Notification système",
          ariaLabel: "Notification système",
          visualToken: "speaker-system"
        },
        text: "Mode prototype : la saisie passe par le contrôleur narratif, la résolution bornée et un enrichissement IA fictif sans autorité métier.",
        ariaLabel: "Notification système: SYSTEM_NOTICE",
        roleLabel: "Notification système",
        visualStyleToken: "speaker-system",
        sourceRefs: ["prototype:surface"],
        isDegradedFallback: false
      }
    ],
    rawInputAccess: {
      available: true,
      operationId: "prototype-welcome"
    },
    rhythmDiagnostics: "prototype",
    reconstructionRefs: ["prototype:surface"],
    version: 1
  };
}

async function enhancePrototypePacket(
  output: NarrativeTurnControllerOutputV1,
  mode: NarrativeEnhancementMode,
  priorPackets: DisplayPacketV1[] = []
): Promise<{
  displayPacket: DisplayPacketV1;
  status: string;
  finalEnhancement: AiNarrativeEnhancementResultV1;
  attemptedEnhancement: AiNarrativeEnhancementResultV1 | null;
}> {
  const operationId = output.operationId;
  const localProvider = new FakeContractAiProviderV1([
    [`${operationId}:ai:expression:attempt:1`, {
      schemaVersion: 1,
      contractVersion: "narrative-ai-resolution/1",
      outputId: `output:${operationId}:expression`,
      callId: `${operationId}:ai:expression:call`,
      attemptId: `${operationId}:ai:expression:attempt:1`,
      packId: `${operationId}:pack:expression`,
      snapshotId: `${operationId}:snapshot:display`,
      role: "player_expression_adapter",
      status: "OK",
      payload: {
        intentId: output.interpretation.intentId,
        expressionKind: output.interpretation.intentType === "speech" ? "speech" : "action_staging",
        renderedExpression: buildPrototypeExpression(output),
        meaningCovered: [output.interpretation.coreMeaning],
        addedMeaning: [],
        omittedMeaning: [],
        styleChoices: ["prototype", "registre narratif sobre"],
        safeToUse: true
      },
      diagnostics: [],
      supersedesOutputId: null
    }],
    [`${operationId}:ai:scene-writer:attempt:1`, {
      schemaVersion: 1,
      contractVersion: "narrative-ai-resolution/1",
      outputId: `output:${operationId}:scene-writer`,
      callId: `${operationId}:ai:scene-writer:call`,
      attemptId: `${operationId}:ai:scene-writer:attempt:1`,
      packId: `${operationId}:pack:scene-writer`,
      snapshotId: `${operationId}:snapshot:display`,
      role: "scene_writer",
      status: "OK",
      payload: {
        narrationBlocks: [{
          slotId: "prototype-atmosphere",
          blockKind: "MJ_NARRATION",
          content: buildPrototypeNarration(output),
          groundedIn: [`resolution:${output.resolution.resolutionId}`],
          usesCreativeTexture: true
        }]
      },
      diagnostics: [],
      supersedesOutputId: null
    }]
  ]);
  const provider = mode === "openai"
    ? new ServerOpenAiEnhancementProviderV1()
    : localProvider;
  const enhanced = await enhanceNarrativeDisplayWithAiV1({
    campaignId: "cmp-narrative-prototype",
    operationId,
    displayPacket: output.displayPacket,
    priorDisplayPackets: priorPackets,
    resolution: output.resolution,
    sceneState: output.sceneState,
    config: {
      provider,
      expressionRoute: prototypeExpressionRoute,
      sceneWriterRoute: prototypeSceneWriterRoute,
      retryPolicy: prototypeRetryPolicy
    }
  });
  if (mode === "openai" && enhanced.usedFallback) {
    const fallback = await enhanceNarrativeDisplayWithAiV1({
      campaignId: "cmp-narrative-prototype",
      operationId,
      displayPacket: output.displayPacket,
      priorDisplayPackets: priorPackets,
      resolution: output.resolution,
      sceneState: output.sceneState,
      config: {
        provider: localProvider,
        expressionRoute: prototypeExpressionRoute,
        sceneWriterRoute: prototypeSceneWriterRoute,
        retryPolicy: prototypeRetryPolicy
      }
    });
    const variedFallback = applyNarrativePresentationVariationV1({
      schemaVersion: 1,
      displayPacket: fallback.displayPacket,
      output,
      priorPackets
    }).displayPacket;
    return {
      displayPacket: variedFallback,
      status: `OpenAI indisponible ou sortie refusée (${summarizeOpenAiFallback(enhanced)}) : fallback local utilisé.`,
      finalEnhancement: { ...fallback, displayPacket: variedFallback },
      attemptedEnhancement: enhanced
    };
  }
  if (!enhanced.enhanced && !enhanced.usedFallback) {
    const varied = applyNarrativePresentationVariationV1({
      schemaVersion: 1,
      displayPacket: enhanced.displayPacket,
      output,
      priorPackets
    }).displayPacket;
    const sceneWriterRejectedNote = enhanced.safetyNotes.find(note =>
      /Scene writer appelé, mais aucun bloc MJ utilisable/u.test(note)
    );
    const hasLocalNarration = varied.displayBlocks.some(block =>
      block.kind === "GM_NARRATION" || block.kind === "NPC_SPEECH"
    );
    return {
      displayPacket: varied,
      status: sceneWriterRejectedNote
        ? `OpenAI appelé, mais aucune narration utilisable n'a passé les garde-fous (${summarizeSceneWriterRejectedNote(sceneWriterRejectedNote)}) : narration locale conservée.`
        : hasLocalNarration
        ? mode === "openai"
          ? "Narration de scène locale utilisée; OpenAI non appelé car aucun enrichissement supplémentaire n'était nécessaire."
          : "Narration de scène locale utilisée."
        : mode === "openai"
          ? "OpenAI non appelé : aucune matière narrative autorisée pour cette réponse."
          : "Mode local : aucune matière narrative autorisée pour cette réponse.",
      finalEnhancement: { ...enhanced, displayPacket: varied },
      attemptedEnhancement: null
    };
  }
  const varied = applyNarrativePresentationVariationV1({
    schemaVersion: 1,
    displayPacket: enhanced.displayPacket,
    output,
    priorPackets
  }).displayPacket;
  return {
    displayPacket: varied,
    status: mode === "openai" ? "OpenAI serveur utilisé pour l'enrichissement." : "Mode local utilisé pour l'enrichissement.",
    finalEnhancement: { ...enhanced, displayPacket: varied },
    attemptedEnhancement: null
  };
}

function summarizeSceneWriterRejectedNote(note: string): string {
  const match = note.match(/garde-fous de rendu: (?<reasons>.+)\.$/u);
  return match?.groups?.reasons ?? "motif non détaillé";
}

function summarizeOpenAiFallback(enhancement: Awaited<ReturnType<typeof enhanceNarrativeDisplayWithAiV1>>): string {
  const incident = enhancement.incidents[0];
  if (!incident) return "aucun diagnostic serveur";
  const role = incident.role ?? "role inconnu";
  const outputDiagnostics = Array.isArray(incident.safeDetails.outputDiagnostics)
    ? incident.safeDetails.outputDiagnostics.filter((entry): entry is string => typeof entry === "string")
    : [];
  const outputDiagnosticMessages = Array.isArray(incident.safeDetails.outputDiagnosticMessages)
    ? incident.safeDetails.outputDiagnosticMessages.filter((entry): entry is string => typeof entry === "string")
    : [];
  const suffix = outputDiagnostics.length > 0 ? `/${outputDiagnostics.join("+")}` : "";
  const message = outputDiagnosticMessages.length > 0 ? ` - ${outputDiagnosticMessages.join(" | ")}` : "";
  return `${role}/${incident.category}/${incident.stage}${suffix}${message}`;
}

function buildPrototypeExpression(output: NarrativeTurnControllerOutputV1): string {
  const expression = output.resolution.characterExpression?.expressionText;
  if (expression) return expression;
  return output.interpretation.coreMeaning;
}

function buildPrototypeNarration(output: NarrativeTurnControllerOutputV1): string {
  return buildReferenceSceneLocalNarrationV1({
    rawInput: output.displayPacket.displayBlocks.find(block => block.kind === "RAW_INPUT")?.text ?? "",
    interpretation: output.interpretation,
    resolution: output.resolution
  });
}

const prototypeExpressionRoute: AiModelRouteV1 = {
  schemaVersion: 1,
  routeId: "prototype-ui-expression",
  role: "player_expression_adapter",
  providerKind: "FAKE_CONTRACT",
  providerId: "fake",
  modelId: "fake-ui-expression",
  modelConfigVersion: "i06h",
  certified: true,
  allowedContractVersions: ["narrative-ai-resolution/1"],
  inputTokenLimit: 2_000,
  outputTokenLimit: 1_000,
  timeoutMs: 1_000,
  fallbackRouteIds: []
};

const prototypeSceneWriterRoute: AiModelRouteV1 = {
  schemaVersion: 1,
  routeId: "prototype-ui-scene-writer",
  role: "scene_writer",
  providerKind: "FAKE_CONTRACT",
  providerId: "fake",
  modelId: "fake-ui-scene-writer",
  modelConfigVersion: "i06h",
  certified: true,
  allowedContractVersions: ["narrative-ai-resolution/1"],
  inputTokenLimit: 2_000,
  outputTokenLimit: 1_000,
  timeoutMs: 1_000,
  fallbackRouteIds: []
};

const prototypeRetryPolicy: AiRetryPolicyV1 = {
  schemaVersion: 1,
  role: "scene_writer",
  maxTechnicalRetries: 0,
  maxTargetedCorrections: 0,
  maxFullRegenerations: 0,
  allowFallback: false
};

function buildIntentInterpreterConfig(mode: NarrativeEnhancementMode): AiIntentInterpreterConfigV1 | undefined {
  if (mode !== "openai") return undefined;
  return {
    provider: new ServerOpenAiEnhancementProviderV1(),
    route: {
      schemaVersion: 1,
      routeId: "prototype-ui-openai-player-intent-interpreter",
      role: "player_intent_interpreter",
      // Proxy contractuel: le navigateur appelle uniquement la route serveur OpenAI.
      // Le pipeline local garde FAKE_CONTRACT tant que REMOTE_PROVIDER reste réservé
      // aux appels OpenAI directs validés côté narration-module.
      providerKind: "FAKE_CONTRACT",
      providerId: "server-openai-route",
      modelId: "server-selected-openai-intent-model",
      modelConfigVersion: "i06z",
      certified: true,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1],
      inputTokenLimit: 2_000,
      outputTokenLimit: 1_000,
      timeoutMs: 10_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1,
      role: "player_intent_interpreter",
      maxTechnicalRetries: 0,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: true
    }
  };
}
