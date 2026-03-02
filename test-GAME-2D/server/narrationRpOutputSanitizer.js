"use strict";

function createNarrationRpOutputSanitizer() {
  const RECENT_REPLY_MEMORY = [];
  const RECENT_REPLY_LIMIT = 6;
  const META_SEGMENTS = [
    /ancre lore utilisee par\s+[a-z0-9_.:-]+/gi,
    /\b(?:quest|trade|dialogue|combat)\.[a-z0-9_.:-]+\b/gi,
    /lecture mj\s*:/gi,
    /validation serveur\s*:/gi
  ];

  const META_LINES = [
    /ancre lore/i,
    /\b(?:quest|trade|dialogue|combat)\.[a-z0-9_.:-]+\b/i
  ];

  const PHRASE_REPLACEMENTS = [
    {
      pattern: /sans provoquer de bascule immediate/gi,
      replace: "sans changement brusque"
    },
    {
      pattern: /la scene reste ouverte, sans bascule immediate\./gi,
      replace: "La scene reste ouverte, sans evenement decisif pour l'instant."
    },
    {
      pattern: /aucune rupture de continuit[eé] n['’]est appliqu[eé]e; tu peux poursuivre depuis ce m[eê]me contexte\./gi,
      replace: ""
    },
    {
      pattern: /un detail du lieu reste present dans ton attention\./gi,
      replace: ""
    },
    {
      pattern: /le lieu se confirme autour de toi, sans changement notable\./gi,
      replace: "Le lieu prend forme autour de toi."
    },
    {
      pattern: /le monde narratif avance d'un cran sur cet axe\./gi,
      replace: "La situation evolue d'un pas."
    },
    {
      pattern: /le monde reste stable, mais le contexte est conserve pour la suite\./gi,
      replace: "Rien ne se denoue encore, mais la situation reste ouverte."
    },
    {
      pattern: /je traite ton message comme informatif \(question\/description\)\./gi,
      replace: ""
    },
    {
      pattern: /aucune mutation runtime n'est appliquee sur ce tour\./gi,
      replace: ""
    }
  ];

  function normalizeWhitespace(text) {
    return String(text ?? "")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+([,.;!?])/g, "$1")
      .replace(/([,.;!?])([^\s])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeForComparison(text) {
    return String(text ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasConcreteReplySignals(payload) {
    if (!payload || typeof payload !== "object") return false;
    const toolTrace = Array.isArray(payload?.mjToolTrace) ? payload.mjToolTrace : [];
    if (toolTrace.length > 0) return true;
    const text = String(payload?.reply ?? "");
    if (/\b\d+\s*(?:po|pa|pc)\b/i.test(text)) return true;
    if (/\s\|\s/.test(text)) return true;
    return false;
  }

  function sanitizeText(text, fallbackText = "") {
    const raw = String(text ?? "").trim();
    if (!raw) return "";

    const lines = raw
      .split(/\r?\n/)
      .map((line) => String(line ?? "").trim())
      .filter(Boolean)
      .map((line) => {
        let next = line;
        META_SEGMENTS.forEach((pattern) => {
          next = next.replace(pattern, " ");
        });
        PHRASE_REPLACEMENTS.forEach(({ pattern, replace }) => {
          next = next.replace(pattern, replace);
        });
        next = normalizeWhitespace(next);
        return next;
      })
      .filter((line) => line && !META_LINES.some((pattern) => pattern.test(line)));

    const merged = normalizeWhitespace(lines.join("\n").replace(/\n/g, " "));
    if (merged) return merged;
    return normalizeWhitespace(fallbackText);
  }

  function isNarrativePayload(payload) {
    const intentType = String(payload?.intent?.type ?? payload?.mjContract?.intent?.type ?? "").trim();
    if (!intentType || intentType === "system_command") return false;
    return true;
  }

  function buildVariationReply(payload) {
    const worldState = payload?.worldState && typeof payload.worldState === "object" ? payload.worldState : {};
    const sceneFrame =
      worldState?.conversation?.sceneFrame && typeof worldState.conversation.sceneFrame === "object"
        ? worldState.conversation.sceneFrame
        : {};
    const locationLabel = String(worldState?.location?.label ?? worldState?.startContext?.locationLabel ?? "").trim();
    const activeInterlocutor = String(
      worldState?.conversation?.activeInterlocutor ?? sceneFrame?.activeInterlocutorLabel ?? ""
    ).trim();
    const poiLabel = String(sceneFrame?.activePoiLabel ?? "").trim();
    const placeLabel = poiLabel || locationLabel || "les environs";
    const intentType = String(payload?.intent?.type ?? payload?.mjContract?.intent?.type ?? "").trim();
    const social = intentType === "social_action";
    const hints = Array.isArray(payload?.mjResponse?.options)
      ? payload.mjResponse.options.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 3)
      : [];

    if (social && activeInterlocutor) {
      return {
        reply: `${activeInterlocutor} reste disponible devant toi, sans presser l'echange. Il suffit d'une question nette pour lui donner une direction.`,
        mjResponse: {
          responseType: String(payload?.mjResponse?.responseType ?? "narration"),
          directAnswer: "",
          scene: `${activeInterlocutor} reste disponible devant toi, sans presser l'echange.`,
          actionResult: "Le contact est etabli sans tension particuliere.",
          consequences: "Une question nette ou un geste simple suffit a faire avancer la scene.",
          options: hints
        }
      };
    }

    return {
      reply: `Autour de ${placeLabel}, le lieu garde son rythme ordinaire. Un detail choisi, une direction ou une presence suffisent a donner un cap plus net a la scene.`,
      mjResponse: {
        responseType: String(payload?.mjResponse?.responseType ?? "narration"),
        directAnswer: "",
        scene: `Autour de ${placeLabel}, rien ne rompt le cours ordinaire des choses.`,
        actionResult: "Le lieu garde un rythme simple et lisible.",
        consequences: "Un detail choisi, une direction ou une presence suffisent a donner un cap plus net a la scene.",
        options: hints
      }
    };
  }

  function applyAntiRepeat(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
    if (!isNarrativePayload(payload)) return payload;
    if (hasConcreteReplySignals(payload)) return payload;
    const normalizedReply = normalizeForComparison(payload.reply);
    if (!normalizedReply) return payload;

    const sameRecentCount = RECENT_REPLY_MEMORY.filter((entry) => entry.reply === normalizedReply).length;
    const contextKey = [
      String(payload?.worldState?.location?.label ?? "").trim().toLowerCase(),
      String(payload?.intent?.type ?? payload?.mjContract?.intent?.type ?? "").trim().toLowerCase()
    ].join("|");
    const sameContextRecentCount = RECENT_REPLY_MEMORY.filter(
      (entry) => entry.contextKey === contextKey && entry.reply === normalizedReply
    ).length;

    let nextPayload = payload;
    if (sameRecentCount >= 1 || sameContextRecentCount >= 1) {
      const variation = buildVariationReply(payload);
      nextPayload = {
        ...payload,
        reply: variation.reply,
        ...(payload?.mjResponse && typeof payload.mjResponse === "object"
          ? {
              mjResponse: {
                ...payload.mjResponse,
                ...variation.mjResponse
              }
            }
          : {})
      };
    }

    const finalNormalized = normalizeForComparison(nextPayload.reply);
    if (finalNormalized) {
      RECENT_REPLY_MEMORY.push({
        reply: finalNormalized,
        contextKey
      });
      if (RECENT_REPLY_MEMORY.length > RECENT_REPLY_LIMIT) {
        RECENT_REPLY_MEMORY.shift();
      }
    }
    return nextPayload;
  }

  function sanitizePayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
    if (!isNarrativePayload(payload)) return payload;

    const replyFallback = "La situation reste lisible et tu peux poursuivre.";
    const safeReply = sanitizeText(payload.reply, replyFallback);
    const mjResponseRaw =
      payload.mjResponse && typeof payload.mjResponse === "object" ? payload.mjResponse : null;
    const safeMjResponse = mjResponseRaw
      ? {
          ...mjResponseRaw,
          directAnswer: sanitizeText(mjResponseRaw.directAnswer, ""),
          scene: sanitizeText(mjResponseRaw.scene, "La scene reste claire autour de toi."),
          actionResult: sanitizeText(mjResponseRaw.actionResult, "Ton action est prise en compte."),
          consequences: sanitizeText(mjResponseRaw.consequences, ""),
          options: Array.isArray(mjResponseRaw.options)
            ? mjResponseRaw.options
                .map((item) => sanitizeText(item, ""))
                .filter(Boolean)
                .slice(0, 6)
            : []
        }
      : null;

    const sanitized = {
      ...payload,
      reply: safeReply || replyFallback,
      ...(safeMjResponse ? { mjResponse: safeMjResponse } : {})
    };
    return applyAntiRepeat(sanitized);
  }

  return {
    sanitizeText,
    sanitizePayload
  };
}

module.exports = {
  createNarrationRpOutputSanitizer
};
