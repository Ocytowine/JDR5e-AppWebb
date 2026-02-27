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

function shouldHandleInformativeCommitment({ conversationMode, intent }) {
  return (
    String(conversationMode ?? "rp") === "rp" &&
    isActionIntent(intent) &&
    normalizeCommitment(intent) === "informatif"
  );
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
  shouldHandleInformativeCommitment,
  shouldForceRuntimeByCommitment,
  shouldClarifyTargetFromCommitment
};
