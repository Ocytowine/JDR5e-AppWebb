"use strict";

function createRpActionValidator(params) {
  const callOpenAiJson = params?.callOpenAiJson;
  const aiEnabled = Boolean(params?.aiEnabled);
  const normalizeForIntent =
    typeof params?.normalizeForIntent === "function"
      ? params.normalizeForIntent
      : (v) =>
          String(v ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
  const resolveModel =
    typeof params?.resolveModel === "function"
      ? params.resolveModel
      : () => "gpt-4.1-mini";
  const warn = typeof params?.warn === "function" ? params.warn : () => {};

  function safeLower(value) {
    return String(value ?? "").toLowerCase().trim();
  }

  function oneLine(value, max = 240) {
    const clean = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    return clean.length <= max ? clean : `${clean.slice(0, max - 3)}...`;
  }

  function isActionQuestion(message) {
    const text = normalizeForIntent(message);
    if (!text) return false;
    return (
      /\bpuis[- ]?je\b/.test(text) ||
      /\best[- ]?ce\s+que\s+je\s+peux\b/.test(text) ||
      /\bje\s+peux\b/.test(text) ||
      /\bai[- ]?je\b/.test(text)
    );
  }

  function isRuleCriticalAction(message) {
    const text = normalizeForIntent(message);
    if (!text) return false;
    return (
      /\blancer\b|\bsort\b|\bincant/.test(text) ||
      /\barme\b|\battaqu/.test(text) ||
      /\btest\b|\bjet\b|\bcompetence\b|\bbonus\b/.test(text)
    );
  }

  function isLowRiskNarrativeAction(message) {
    const text = normalizeForIntent(message);
    if (!text) return false;
    return (
      /\bvisiter\b|\bentrer\b|\baller\b|\bme rendre\b|\bse rendre\b/.test(text) ||
      /\bexplorer\b|\bme balader\b|\bse balader\b|\bdeambuler\b/.test(text) ||
      /\b(voir|regarder|observer)\b.*\b(autour|alentours|environs)\b/.test(text) ||
      /\bque\s+puis[- ]?je\s+voir\b/.test(text) ||
      /\bque\s+vois[- ]?je\b/.test(text)
    );
  }

  function isObservationPrompt(message) {
    const text = normalizeForIntent(message);
    if (!text) return false;
    return (
      /\bque\s+puis[- ]?je\s+voir\b/.test(text) ||
      /\bque\s+vois[- ]?je\b/.test(text) ||
      /\b(voir|regarder|observer)\b.*\b(autour|alentours|environs)\b/.test(text)
    );
  }

  function inferActionType(message) {
    const text = normalizeForIntent(message);
    if (/\blancer\b|\bsort\b|\bincant/.test(text)) return "cast_spell";
    if (/\barme\b|\battaqu/.test(text)) return "use_weapon";
    if (/\btest\b|\bjet\b|\bcompetence\b|\bbonus\b/.test(text)) return "skill_check";
    return "generic_action";
  }

  function extractSpellId(message, contextPack) {
    const text = normalizeForIntent(message);
    const sources = Array.isArray(contextPack?.magic?.sources) ? contextPack.magic.sources : [];
    const spellIds = new Set();
    sources.forEach((src) => {
      (Array.isArray(src?.knownSpellIds) ? src.knownSpellIds : []).forEach((id) =>
        spellIds.add(String(id))
      );
      (Array.isArray(src?.preparedSpellIds) ? src.preparedSpellIds : []).forEach((id) =>
        spellIds.add(String(id))
      );
    });
    const list = Array.from(spellIds);
    const direct = list.find((id) => text.includes(normalizeForIntent(id)));
    if (direct) return direct;
    const quoted = text.match(/["'`](.+?)["'`]/);
    if (quoted && quoted[1]) return String(quoted[1]).trim();
    return "";
  }

  function extractWeaponTarget(message, contextPack) {
    const text = normalizeForIntent(message);
    const grouped = Array.isArray(contextPack?.inventory?.grouped) ? contextPack.inventory.grouped : [];
    const weapons = grouped.filter((row) => safeLower(row?.type) === "weapon");
    const direct = weapons.find((row) => {
      const id = String(row?.id ?? "");
      const label = String(row?.displayName ?? "");
      return (
        (id && text.includes(normalizeForIntent(id))) ||
        (label && text.includes(normalizeForIntent(label)))
      );
    });
    if (direct) {
      return {
        id: String(direct?.id ?? ""),
        label: String(direct?.displayName ?? direct?.id ?? "")
      };
    }
    if (/\bcouteau\b/.test(text)) {
      const knife = weapons.find((row) => {
        const id = normalizeForIntent(row?.id);
        const label = normalizeForIntent(row?.displayName);
        return id.includes("couteau") || label.includes("couteau");
      });
      if (knife) {
        return {
          id: String(knife?.id ?? ""),
          label: String(knife?.displayName ?? knife?.id ?? "")
        };
      }
    }
    return { id: "", label: "" };
  }

  function extractSkillId(message) {
    const text = normalizeForIntent(message);
    if (/\bforcer?\s+la?\s+porte\b|\bcasser?\s+la?\s+porte\b/.test(text)) {
      return "athletisme";
    }
    const candidates = [
      "athletisme",
      "acrobaties",
      "escamotage",
      "discretion",
      "arcanes",
      "histoire",
      "investigation",
      "nature",
      "religion",
      "intuition",
      "medecine",
      "perception",
      "survie",
      "dressage",
      "intimidation",
      "persuasion",
      "tromperie",
      "representation"
    ];
    return candidates.find((skill) => text.includes(skill)) || "";
  }

  function computeSkillBonus(contextPack, skillId) {
    const abilityMap = {
      athletisme: "FOR",
      acrobaties: "DEX",
      escamotage: "DEX",
      discretion: "DEX",
      arcanes: "INT",
      histoire: "INT",
      investigation: "INT",
      nature: "INT",
      religion: "INT",
      intuition: "SAG",
      medecine: "SAG",
      perception: "SAG",
      survie: "SAG",
      dressage: "SAG",
      intimidation: "CHA",
      persuasion: "CHA",
      tromperie: "CHA",
      representation: "CHA"
    };
    const ability = abilityMap[safeLower(skillId)];
    if (!ability) return null;
    const abilityMod = Number(contextPack?.rules?.abilityMods?.[ability] ?? 0) || 0;
    const profBonus = Number(contextPack?.progression?.proficiencyBonus ?? 0) || 0;
    const profs = new Set(
      (Array.isArray(contextPack?.rules?.skills) ? contextPack.rules.skills : []).map((x) => safeLower(x))
    );
    const exps = new Set(
      (Array.isArray(contextPack?.rules?.expertises) ? contextPack.rules.expertises : []).map((x) => safeLower(x))
    );
    const proficient = profs.has(safeLower(skillId)) || exps.has(safeLower(skillId));
    const expertise = exps.has(safeLower(skillId));
    const profPart = expertise ? profBonus * 2 : proficient ? profBonus : 0;
    return {
      ability,
      abilityMod,
      proficient,
      expertise,
      totalBonus: abilityMod + profPart
    };
  }

  async function proposeActionWithAI(message, contextPack) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu aides un MJ a analyser une question RP de faisabilite d'action. " +
        "Retourne UNIQUEMENT un JSON valide: { actionType, targetId, justification }. " +
        "actionType dans { cast_spell, use_weapon, skill_check, generic_action }. " +
        "N'invente pas de cible si elle est absente.";
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload: {
          message: String(message ?? ""),
          contextOverview: {
            classes: contextPack?.progression?.resolvedClasses ?? [],
            weapons: (contextPack?.inventory?.grouped ?? []).filter((x) => safeLower(x?.type) === "weapon"),
            spells: contextPack?.magic?.sources ?? [],
            skills: contextPack?.rules?.skills ?? []
          }
        }
      });
      if (!parsed || typeof parsed !== "object") return null;
      const actionType = safeLower(parsed.actionType);
      if (!["cast_spell", "use_weapon", "skill_check", "generic_action"].includes(actionType)) {
        return null;
      }
      return {
        actionType,
        targetId: oneLine(parsed.targetId, 120),
        justification: oneLine(parsed.justification, 220)
      };
    } catch (err) {
      warn("[rp-action-validator] fallback heuristique:", err?.message ?? err);
      return null;
    }
  }

  function validateProposal(message, contextPack, proposal) {
    const actionType = safeLower(proposal?.actionType) || inferActionType(message);
    if (actionType === "cast_spell") {
      const spellId = proposal?.targetId || extractSpellId(message, contextPack);
      const sources = Array.isArray(contextPack?.magic?.sources) ? contextPack.magic.sources : [];
      const known = new Set();
      sources.forEach((src) => {
        (Array.isArray(src?.knownSpellIds) ? src.knownSpellIds : []).forEach((id) => known.add(String(id)));
        (Array.isArray(src?.preparedSpellIds) ? src.preparedSpellIds : []).forEach((id) => known.add(String(id)));
      });
      const knownSpell = spellId ? known.has(spellId) : false;
      const slots = Array.isArray(contextPack?.magic?.slots) ? contextPack.magic.slots : [];
      const hasSlot = slots.some((row) => Number(row?.remaining ?? 0) > 0);
      const allowed = Boolean(knownSpell && hasSlot);
      return {
        isActionQuery: true,
        actionType,
        targetId: spellId || "",
        allowed,
        reason: allowed
          ? "Sort connu avec emplacements disponibles."
          : knownSpell
          ? "Sort connu mais aucun emplacement restant."
          : "Sort non trouve dans la fiche active.",
        serverEvidence: {
          knownSpell,
          hasSlot
        },
        proposal
      };
    }

    if (actionType === "use_weapon") {
      const extracted = extractWeaponTarget(message, contextPack);
      const weaponId = proposal?.targetId || extracted.id;
      const grouped = Array.isArray(contextPack?.inventory?.grouped) ? contextPack.inventory.grouped : [];
      const weapons = grouped.filter((row) => safeLower(row?.type) === "weapon");
      const weaponRow = weaponId
        ? weapons.find((row) => String(row?.id ?? "") === weaponId) ?? null
        : null;
      const weaponLabel = String(
        proposal?.targetLabel ??
          extracted.label ??
          weaponRow?.displayName ??
          weaponId ??
          ""
      );
      const hasAnyWeapon = weapons.length > 0;
      const hasWeapon = weaponId
        ? weapons.some((row) => String(row?.id ?? "") === weaponId)
        : hasAnyWeapon;
      return {
        isActionQuery: true,
        actionType,
        targetId: weaponId || "",
        targetLabel: weaponLabel,
        allowed: hasWeapon,
        reason: hasWeapon ? "Arme disponible dans l'equipement/inventaire." : "Aucune arme correspondante.",
        serverEvidence: {
          hasAnyWeapon,
          hasWeapon,
          availableWeapons: weapons.slice(0, 8)
        },
        proposal
      };
    }

    if (actionType === "skill_check") {
      const skillId = proposal?.targetId || extractSkillId(message);
      const bonus = skillId ? computeSkillBonus(contextPack, skillId) : null;
      const allowed = Boolean(skillId ? bonus : true);
      return {
        isActionQuery: true,
        actionType,
        targetId: skillId || "",
        allowed,
        reason: allowed
          ? bonus
            ? `Test possible, bonus estime ${bonus.totalBonus >= 0 ? "+" : ""}${bonus.totalBonus}.`
            : "Test possible; precise la competence visee pour calculer le bonus."
          : "Competence non identifiee dans la demande.",
        serverEvidence: {
          bonus: bonus || null
        },
        proposal
      };
    }

    return {
      isActionQuery: isActionQuestion(message),
      actionType: "generic_action",
      targetId: proposal?.targetId || "",
      allowed: true,
      reason: "Action possible en RP; il faut une cible et un angle precis pour la resoudre.",
      serverEvidence: {},
      proposal
    };
  }

  async function assess(message, contextPack) {
    if (!contextPack) return null;
    if (!isActionQuestion(message)) return null;
    // Keep free observation in narrative flow (MJ exploration), unless user asks explicit rule mechanics.
    if (!isRuleCriticalAction(message) && isObservationPrompt(message)) {
      return null;
    }
    // Let narrative flow handle simple movement/exploration intents.
    if (!isRuleCriticalAction(message) && isLowRiskNarrativeAction(message)) {
      return null;
    }
    const aiProposal = await proposeActionWithAI(message, contextPack);
    const fallbackProposal = {
      actionType: aiProposal?.actionType || inferActionType(message),
      targetId:
        aiProposal?.targetId ||
        (inferActionType(message) === "cast_spell"
          ? extractSpellId(message, contextPack)
          : inferActionType(message) === "use_weapon"
          ? extractWeaponTarget(message, contextPack).id
          : inferActionType(message) === "skill_check"
          ? extractSkillId(message)
          : ""),
      targetLabel:
        aiProposal?.targetLabel ||
        (inferActionType(message) === "use_weapon"
          ? extractWeaponTarget(message, contextPack).label
          : ""),
      justification: aiProposal?.justification || "Analyse contextuelle de la demande RP."
    };
    return validateProposal(message, contextPack, fallbackProposal);
  }

  return {
    assess
  };
}

module.exports = {
  createRpActionValidator
};
