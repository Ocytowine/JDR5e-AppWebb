"use strict";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return safeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrice(gold = 0, silver = 0, copper = 0) {
  return {
    platinum: 0,
    gold,
    silver,
    copper
  };
}

function createNarrationShopOfferTool() {
  const BASE_ITEMS = [
    {
      id: "shop:tenue-etude-sobre",
      label: "Tunique d'etude sobre",
      type: "object",
      category: "misc",
      tags: ["vetement", "academique", "utilitaire"],
      description: "Une tunique propre et pratique, taillee pour de longues heures d'etude.",
      value: buildPrice(4, 5, 0),
      offerMeta: { shopRole: "clothier", tone: "sobre", availability: "common", quality: "standard" }
    },
    {
      id: "shop:cape-laine-sombre",
      label: "Cape de laine sombre",
      type: "object",
      category: "misc",
      tags: ["vetement", "voyage", "utilitaire"],
      description: "Une cape simple, chaude et robuste, utile contre le vent et la pluie.",
      value: buildPrice(5, 0, 0),
      offerMeta: { shopRole: "clothier", tone: "discret", availability: "common", quality: "solid" }
    },
    {
      id: "shop:robe-apprenti",
      label: "Robe d'apprenti",
      type: "object",
      category: "misc",
      tags: ["vetement", "academique", "presentation"],
      description: "Une robe legere aux finitions modestes, convenable pour une ecole ou un atelier.",
      value: buildPrice(6, 0, 0),
      offerMeta: { shopRole: "clothier", tone: "studieux", availability: "common", quality: "refined" }
    },
    {
      id: "shop:ceinture-tissee",
      label: "Ceinture tissee",
      type: "object",
      category: "misc",
      tags: ["vetement", "accessoire", "utilitaire"],
      description: "Une ceinture souple, solide, facile a ajuster pour le quotidien.",
      value: buildPrice(1, 8, 0),
      offerMeta: { shopRole: "clothier", tone: "simple", availability: "common", quality: "standard" }
    },
    {
      id: "shop:sacoche-cours",
      label: "Sacoche de cours",
      type: "object",
      category: "misc",
      tags: ["vetement", "accessoire", "academique", "utilitaire"],
      description: "Une petite sacoche de toile renforcee, pratique pour des notes et petits effets.",
      value: buildPrice(3, 0, 0),
      offerMeta: { shopRole: "general_goods", tone: "pratique", availability: "common", quality: "standard" }
    }
  ];

  function inferDemandTags(query) {
    const text = normalizeText(query);
    const tags = new Set();
    if (!text) return tags;
    if (/\b(ecole|magie|magique|etude|apprenti|academie)\b/.test(text)) tags.add("academique");
    if (/\b(voyage|route|pluie|vent|marche)\b/.test(text)) tags.add("voyage");
    if (/\b(vetement|tenue|robe|tunique|cape|tissu)\b/.test(text)) tags.add("vetement");
    if (/\b(accessoire|sac|sacoche|ceinture)\b/.test(text)) tags.add("accessoire");
    return tags;
  }

  function inferShopType(query, context) {
    const text = normalizeText(query);
    const locationLabel = normalizeText(context?.worldState?.location?.label);
    if (/\b(vetement|tenue|tissu|robe|tunique|cape)\b/.test(text)) return "clothier";
    if (/\b(marche|etal)\b/.test(text) || /\bmarche\b/.test(locationLabel)) return "market_stall";
    return "general_goods";
  }

  function scoreItem(item, demandTags, shopType) {
    let score = 0;
    const tags = Array.isArray(item?.tags) ? item.tags : [];
    demandTags.forEach((tag) => {
      if (tags.includes(tag)) score += 3;
    });
    if (shopType === "clothier" && tags.includes("vetement")) score += 3;
    if (shopType === "market_stall" && item?.offerMeta?.shopRole === "clothier") score += 1;
    if (demandTags.size === 0) score += 1;
    return score;
  }

  function buildShopLabel(shopType, context) {
    const base =
      shopType === "clothier"
        ? "une boutique de vetements"
        : shopType === "market_stall"
        ? "un etal de marchand"
        : "une echoppe de quartier";
    const locationLabel = safeText(context?.worldState?.location?.label);
    return locationLabel ? `${base} sur ${locationLabel}` : base;
  }

  function getOffer(args = {}, context = {}) {
    const query = safeText(args.query || context?.message || "");
    const limit = Math.max(1, Math.min(5, Number(args.limit ?? 3) || 3));
    const demandTags = inferDemandTags(query);
    const shopType = safeText(args.shopType) || inferShopType(query, context);
    const items = [...BASE_ITEMS]
      .map((item) => ({ item, score: scoreItem(item, demandTags, shopType) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .slice(0, limit)
      .map((row) => ({ ...row.item }));

    return {
      ok: items.length > 0,
      shopType,
      shopLabel: buildShopLabel(shopType, context),
      items
    };
  }

  return {
    getOffer
  };
}

module.exports = {
  createNarrationShopOfferTool
};

