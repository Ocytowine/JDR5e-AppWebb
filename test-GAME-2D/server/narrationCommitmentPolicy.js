"use strict";

function normalizeCommitment(intent) {
  return String(intent?.commitment ?? "informatif").toLowerCase();
}

function isActionIntent(intent) {
  const type = String(intent?.type ?? "");
  return type === "story_action" || type === "social_action";
}

function shouldHandleHypotheticalCommitment({ conversationMode, intent }) {
  return (
    String(conversationMode ?? "rp") === "rp" &&
    isActionIntent(intent) &&
    normalizeCommitment(intent) === "hypothetique"
  );
}

function shouldRouteHypotheticalToLocalObservation({
  conversationMode,
  intent,
  message,
  activeInterlocutor
}) {
  if (!shouldHandleHypotheticalCommitment({ conversationMode, intent })) return false;
  if (String(activeInterlocutor ?? "").trim()) return false;
  const lower = String(message ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ");
  if (!lower) return false;
  const perceptionCue =
    /\b(?:voir|vois|observe|observer|regarde|regarder|apercois|apercevoir|decris|decrire)\b/.test(lower) ||
    /\bque\s+(?:vois|puis je voir)\b/.test(lower) ||
    /\bqu est ce que je vois\b/.test(lower);
  if (!perceptionCue) return false;
  const distantProjection =
    /\b(?:j aimerais|je voudrais|j envisag|peut etre|si je devais)\b/.test(lower);
  return !distantProjection;
}

function shouldHandleInformativeCommitment({ conversationMode, intent }) {
  return (
    String(conversationMode ?? "rp") === "rp" &&
    isActionIntent(intent) &&
    normalizeCommitment(intent) === "informatif"
  );
}

function shouldBypassInformativeCommitmentForLocalResolution({
  conversationMode,
  intent,
  activeInterlocutor,
  message
}) {
  if (!shouldHandleInformativeCommitment({ conversationMode, intent })) return false;
  if (String(intent?.type ?? "") !== "social_action") return false;
  if (!String(activeInterlocutor ?? "").trim()) return false;
  const lower = String(message ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ");
  if (!lower) return false;
  const commerceCue =
    /\b(?:cherche|prix|combien|acheter|tenue|vetement|tissu|robe|tunique|cape|vendre|vend|catalogue|voir)\b/.test(
      lower
    );
  const localDescribeCue =
    /\b(?:a quoi ressemble|ressemble t il|ressemble t elle|qui est ce|decris|decrire|comment est il|comment est elle|quel air)\b/.test(
      lower
    );
  const localQuestionCue =
    /\b(?:que fait il|que fait elle|que vend il|que vend elle|qu a t il|qu a t elle)\b/.test(lower);
  return commerceCue || localDescribeCue || localQuestionCue;
}

function shouldForceRuntimeByCommitment({ conversationMode, intent }) {
  const commitment = normalizeCommitment(intent);
  return (
    String(conversationMode ?? "rp") === "rp" &&
    isActionIntent(intent) &&
    (commitment === "declaratif" || commitment === "volitif")
  );
}

function shouldClarifyTargetFromCommitment({ forceRuntimeByCommitment, semanticRuntimeGate }) {
  return Boolean(forceRuntimeByCommitment) && !Boolean(semanticRuntimeGate);
}

module.exports = {
  normalizeCommitment,
  isActionIntent,
  shouldHandleHypotheticalCommitment,
  shouldRouteHypotheticalToLocalObservation,
  shouldHandleInformativeCommitment,
  shouldBypassInformativeCommitmentForLocalResolution,
  shouldForceRuntimeByCommitment,
  shouldClarifyTargetFromCommitment
};
