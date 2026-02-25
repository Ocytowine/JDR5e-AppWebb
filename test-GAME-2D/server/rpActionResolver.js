"use strict";

function createRpActionResolver(params) {
  const normalizeForIntent =
    typeof params?.normalizeForIntent === "function"
      ? params.normalizeForIntent
      : (v) =>
          String(v ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
  }

  function toSigned(value) {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return "+0";
    return n >= 0 ? `+${n}` : String(n);
  }

  function isConfirmationMessage(message) {
    const text = normalizeForIntent(message);
    if (!text) return false;
    return (
      /\b(oui|ok|okay|confirme|je confirme|vas[- ]?y|go|on y va)\b/.test(text) ||
      /\bje le fais\b/.test(text) ||
      /\bexecute\b/.test(text) ||
      /\blance\b/.test(text)
    );
  }

  function cloneSlots(slots) {
    const out = {};
    Object.entries(slots || {}).forEach(([level, row]) => {
      const max = Number(row?.max ?? 0);
      const remaining = Number(row?.remaining ?? 0);
      out[String(level)] = {
        max: Number.isFinite(max) ? max : 0,
        remaining: Number.isFinite(remaining) ? remaining : 0
      };
    });
    return out;
  }

  function initSpellSlots(contextPack, worldState) {
    const existing = worldState?.rpRuntime?.spellSlots;
    const hasExisting = existing && typeof existing === "object" && Object.keys(existing).length > 0;
    if (hasExisting) return cloneSlots(existing);
    const slots = {};
    const rows = Array.isArray(contextPack?.magic?.slots) ? contextPack.magic.slots : [];
    rows.forEach((row) => {
      const level = String(row?.level ?? "");
      if (!level) return;
      slots[level] = {
        max: Number(row?.max ?? 0) || 0,
        remaining: Number(row?.remaining ?? 0) || 0
      };
    });
    return slots;
  }

  function firstUsableSlot(spellSlots) {
    const levels = Object.keys(spellSlots || {})
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x))
      .sort((a, b) => a - b);
    for (const numericLevel of levels) {
      const level = String(numericLevel);
      const row = spellSlots[level];
      if ((Number(row?.remaining ?? 0) || 0) > 0) return level;
    }
    return "";
  }

  function knownSpellSet(contextPack) {
    const out = new Set();
    const sources = Array.isArray(contextPack?.magic?.sources) ? contextPack.magic.sources : [];
    sources.forEach((src) => {
      (Array.isArray(src?.knownSpellIds) ? src.knownSpellIds : []).forEach((id) => out.add(String(id)));
      (Array.isArray(src?.preparedSpellIds) ? src.preparedSpellIds : []).forEach((id) => out.add(String(id)));
    });
    return out;
  }

  function resolveCastSpell(pendingAction, contextPack, worldState) {
    const spellId = String(pendingAction?.targetId ?? "").trim();
    const spellLabel = String(pendingAction?.targetLabel ?? spellId).trim() || spellId;
    const known = knownSpellSet(contextPack);
    const isKnown = spellId ? known.has(spellId) : false;
    const spellSlots = initSpellSlots(contextPack, worldState);
    const slotLevel = firstUsableSlot(spellSlots);
    const hasSlot = Boolean(slotLevel);
    if (!isKnown || !hasSlot) {
      return {
        success: false,
        actionType: "cast_spell",
        targetId: spellId,
        scene: "Tu canalises l'energie, mais le flux magique hesite.",
        actionResult: !isKnown
          ? `Le sort ${spellLabel || "vise"} n'est pas disponible dans ta fiche active.`
          : "Aucun emplacement de sort restant pour cette action.",
        consequences: "L'action n'est pas executee. Aucun cout n'est applique.",
        options: [
          "Verifier tes sorts connus en Hors RP",
          "Tenter une action non magique",
          "Changer de cible"
        ],
        nextRuntime: {
          spellSlots,
          lastResolution: {
            at: new Date().toISOString(),
            actionType: "cast_spell",
            targetId: spellId,
            success: false,
            summary: "sort-non-resolu"
          }
        }
      };
    }

    const row = spellSlots[slotLevel];
    row.remaining = clampNumber((Number(row?.remaining ?? 0) || 0) - 1, 0, Number(row?.max ?? 0) || 0);
    return {
      success: true,
      actionType: "cast_spell",
      targetId: spellId,
      scene: "Tu traces le geste rituel et la magie prend.",
      actionResult: `Sort ${spellLabel} lance. 1 emplacement de niveau ${slotLevel} consomme.`,
      consequences: "La scene reagit a ton effet magique; le temps avance et le monde en garde la trace.",
      options: [
        "Decrire l'effet visuel du sort",
        "Enchainer avec une action tactique",
        "Observer la reaction des PNJ"
      ],
      nextRuntime: {
        spellSlots,
        lastResolution: {
          at: new Date().toISOString(),
          actionType: "cast_spell",
          targetId: spellId,
          success: true,
          summary: `slot-${slotLevel}-consume`
        }
      }
    };
  }

  function resolveSkillCheck(pendingAction, contextPack) {
    const skillId = String(pendingAction?.targetId ?? "").trim();
    const bonus = pendingAction?.serverEvidence?.bonus ?? null;
    if (!bonus) {
      return {
        success: false,
        actionType: "skill_check",
        targetId: skillId,
        scene: "Tu prends ton elan, mais le test n'est pas encore bien cadre.",
        actionResult: "Impossible de calculer le jet sans competence cible.",
        consequences: "Aucune resolution appliquee. Il faut preciser le test.",
        options: [
          "Nommer la competence precise",
          "Demander au MJ la competence la plus adaptee",
          "Changer d'approche"
        ]
      };
    }
    const die = rollD20();
    const total = die + Number(bonus.totalBonus ?? 0);
    const crit = die === 20 ? " (20 naturel)" : die === 1 ? " (1 naturel)" : "";
    const quality =
      die === 20 ? "reussite eclatante" : die === 1 ? "echec critique" : total >= 15 ? "reussite" : total >= 10 ? "resultat mitige" : "echec";
    return {
      success: quality !== "echec critique" && quality !== "echec",
      actionType: "skill_check",
      targetId: skillId,
      scene: "Tu engages le test en situation, sous pression.",
      actionResult: `Jet ${skillId}: d20=${die}${crit} + ${toSigned(bonus.totalBonus)} => ${total} (${quality}).`,
      consequences: "Le MJ peut maintenant faire avancer la scene selon ce resultat.",
      options: [
        "Demander l'impact immediat du resultat",
        "Prendre une decision consequente",
        "Lancer une action complementaire"
      ]
    };
  }

  function resolveWeaponAction(pendingAction, contextPack) {
    const targetId = String(pendingAction?.targetId ?? "").trim();
    const targetLabel = String(pendingAction?.targetLabel ?? targetId).trim() || targetId;
    const hasWeapon = Boolean(pendingAction?.serverEvidence?.hasWeapon);
    const hasAnyWeapon = Boolean(pendingAction?.serverEvidence?.hasAnyWeapon);
    if (!hasWeapon && !hasAnyWeapon) {
      return {
        success: false,
        actionType: "use_weapon",
        targetId,
        scene: "Tu cherches une ouverture, mais rien de solide en main.",
      actionResult: `Aucune arme valide detectee pour l'action${targetLabel ? ` (${targetLabel})` : ""}.`,
        consequences: "L'attaque n'est pas lancee.",
        options: [
          "Equiper une arme",
          "Passer a une action sociale ou deplacement",
          "Verifier l'equipement en Hors RP"
        ]
      };
    }
    const forMod = Number(contextPack?.rules?.abilityMods?.FOR ?? 0) || 0;
    const dexMod = Number(contextPack?.rules?.abilityMods?.DEX ?? 0) || 0;
    const prof = Number(contextPack?.progression?.proficiencyBonus ?? 0) || 0;
    const attackBonus = Math.max(forMod, dexMod) + prof;
    const die = rollD20();
    const total = die + attackBonus;
    return {
      success: die !== 1,
      actionType: "use_weapon",
      targetId,
      scene: "Tu engages ton arme dans le rythme de la scene.",
      actionResult: `Jet d'attaque${targetLabel ? ` (${targetLabel})` : ""}: d20=${die} + ${toSigned(attackBonus)} => ${total}.`,
      consequences: "Le MJ peut statuer sur l'impact et la reaction adverse.",
      options: [
        "Decrire la maniere de frapper",
        "Viser un effet (repousser, intimider, blesser)",
        "Enchainer avec un deplacement"
      ]
    };
  }

  function resolveGenericAction() {
    return {
      success: true,
      actionType: "generic_action",
      targetId: "",
      scene: "Tu confirms ton intention et le monde se met en mouvement.",
      actionResult: "Action validee, execution narrative engagee.",
      consequences: "Le MJ peut resoudre la suite selon le contexte local.",
      options: [
        "Preciser ton objectif exact",
        "Nommer la cible de ton action",
        "Lancer une consequence immediate"
      ]
    };
  }

  function resolvePendingAction(message, pendingAction, contextPack, worldState) {
    const safe = pendingAction && typeof pendingAction === "object" ? pendingAction : null;
    if (!safe) return null;
    const actionType = String(safe.actionType ?? "generic_action");
    if (actionType === "cast_spell") {
      return resolveCastSpell(safe, contextPack, worldState);
    }
    if (actionType === "use_weapon") {
      return resolveWeaponAction(safe, contextPack);
    }
    if (actionType === "skill_check") {
      return resolveSkillCheck(safe, contextPack);
    }
    return resolveGenericAction(message, safe, contextPack);
  }

  return {
    isConfirmationMessage,
    resolvePendingAction
  };
}

module.exports = {
  createRpActionResolver
};
