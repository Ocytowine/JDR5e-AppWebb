"use strict";

function createNarrationStyleHelper(deps = {}) {
  const normalizeForIntent =
    typeof deps.normalizeForIntent === "function"
      ? deps.normalizeForIntent
      : (value) => String(value ?? "").toLowerCase();

  function titleCaseLabel(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function seedFromText(value) {
    const text = String(value ?? "");
    let seed = 0;
    for (let i = 0; i < text.length; i += 1) {
      seed = (seed + text.charCodeAt(i) * (i + 7)) % 32749;
    }
    return seed;
  }

  function pickBySeed(list, seed) {
    const rows = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!rows.length) return "";
    return rows[Math.abs(Number(seed) || 0) % rows.length];
  }

  function polishSingleLine(line) {
    let text = String(line ?? "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    text = text.replace(/^Sur\s+Parvis des Archives\b/i, "Sur le parvis des Archives");
    text = text.replace(/^Autour de\s+Parvis des Archives\b/i, "Autour du parvis des Archives");
    text = text.replace(/\bsans forcer la scene\b/gi, "sans te presser");
    text = text.replace(
      /\bindices ordinaires mais exploitables\b/gi,
      "des details ordinaires du quartier"
    );
    text = text.replace(/\bTu prends des reperes utiles\b/gi, "Tu notes quelques points de repere");
    text = text.replace(
      /\bRien n'impose encore une quete ou une revelation majeure sans nouvel indice solide\b/gi,
      "Pour l'instant, rien ne rompt le calme du lieu."
    );
    text = text.replace(/\bdes\s+des\b/gi, "des");
    text = text.replace(/([.!?]){2,}/g, "$1");
    return text.trim();
  }

  function polishMjBlocks(blocks = {}) {
    return {
      scene: polishSingleLine(blocks.scene),
      actionResult: polishSingleLine(blocks.actionResult),
      consequences: polishSingleLine(blocks.consequences)
    };
  }

  function buildNpcPresenceLine({ activeInterlocutor, worldState, message }) {
    const label = String(activeInterlocutor ?? "").trim();
    if (!label) return "";
    const normalizedMessage = normalizeForIntent(message);
    if (
      /\b(?:marchand|marchande|vendeur|vendeuse|boutique|echoppe|prix|combien|acheter|tenue|vetement|tissu|robe|tunique|choisis|prends?)\b/.test(
        normalizedMessage
      )
    ) {
      return "";
    }
    const locationLabel = String(
      worldState?.location?.label ?? worldState?.startContext?.locationLabel ?? ""
    ).trim();
    const seed = seedFromText(
      `${normalizeForIntent(label)}|${normalizeForIntent(locationLabel)}|${normalizedMessage}`
    );
    const gestures = [
      "releve legerement la tete quand tu t'adresses a lui",
      "marque un court silence avant de te repondre",
      "garde un ton pose, sans hausser la voix",
      "laisse passer un bref temps avant de parler",
      "t'accorde son attention sans brusquer l'echange"
    ];
    const gesture = pickBySeed(gestures, seed);
    const speaker = titleCaseLabel(label);
    return `${speaker} ${gesture}.`;
  }

  return {
    polishMjBlocks,
    buildNpcPresenceLine
  };
}

module.exports = {
  createNarrationStyleHelper
};
