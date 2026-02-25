"use strict";

function createHrpAiInterpreter(params) {
  const callOpenAiJson = params?.callOpenAiJson;
  const aiEnabled = Boolean(params?.aiEnabled);
  const resolveModel =
    typeof params?.resolveModel === "function"
      ? params.resolveModel
      : () => "gpt-4.1-mini";
  const warn = typeof params?.warn === "function" ? params.warn : () => {};

  const MAX_TOOL_CALLS = 5;
  const TOOL_RESULT_LIMIT = 12;

  function oneLine(value, maxLen = 220) {
    const clean = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    return clean.length <= maxLen ? clean : `${clean.slice(0, maxLen - 3)}...`;
  }

  function safeLower(value) {
    return String(value ?? "").toLowerCase().trim();
  }

  function normalizeForMatch(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function sanitizeEvidence(evidence) {
    if (!Array.isArray(evidence)) return [];
    return evidence
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const path = oneLine(entry.path, 120);
        const reason = oneLine(entry.reason, 140);
        if (!path) return null;
        return { path, reason: reason || "used" };
      })
      .filter(Boolean)
      .slice(0, 12);
  }

  function getByPath(root, rawPath) {
    const path = String(rawPath ?? "").trim();
    if (!path) return undefined;
    const normalized = path.startsWith("contextPack.") ? path.slice("contextPack.".length) : path;
    const parts = normalized
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .map((p) => p.trim())
      .filter(Boolean);
    let current = root;
    for (const part of parts) {
      if (current == null) return undefined;
      if (Array.isArray(current) && /^\d+$/.test(part)) {
        current = current[Number(part)];
        continue;
      }
      if (typeof current !== "object") return undefined;
      current = current[part];
    }
    return current;
  }

  function collectKnownPaths(root) {
    const seen = new Set();
    const out = new Set();
    const stack = [{ value: root, path: "contextPack" }];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      const { value, path } = current;
      if (!path) continue;
      out.add(path);

      if (!value || typeof value !== "object") continue;
      if (seen.has(value)) continue;
      seen.add(value);

      if (Array.isArray(value)) {
        out.add(`${path}[]`);
        value.forEach((entry, index) => {
          stack.push({ value: entry, path: `${path}[${index}]` });
        });
        continue;
      }

      Object.entries(value).forEach(([key, child]) => {
        stack.push({ value: child, path: `${path}.${String(key)}` });
      });
    }

    return out;
  }

  function normalizeEvidencePath(path) {
    const raw = String(path ?? "").trim();
    if (!raw) return "";
    const prefixed = raw.startsWith("contextPack") ? raw : `contextPack.${raw}`;
    return prefixed
      .replace(/\[(\d+)\]/g, "[]")
      .replace(/\.\./g, ".")
      .replace(/\.$/g, "");
  }

  function validateEvidence(evidence, contextPack) {
    if (!Array.isArray(evidence) || evidence.length === 0) {
      return {
        evidenceValid: false,
        validEvidence: [],
        invalidEvidence: [],
        reason: "missing-evidence"
      };
    }
    const known = collectKnownPaths(contextPack);
    const normalizedKnown = new Set(Array.from(known).map((entry) => normalizeEvidencePath(entry)));

    const validEvidence = [];
    const invalidEvidence = [];
    evidence.forEach((entry) => {
      const normalized = normalizeEvidencePath(entry?.path);
      if (!normalized || !normalizedKnown.has(normalized)) {
        invalidEvidence.push({
          path: String(entry?.path ?? ""),
          reason: String(entry?.reason ?? "unknown")
        });
        return;
      }
      validEvidence.push({
        path: normalized,
        reason: String(entry?.reason ?? "used")
      });
    });

    const validCount = validEvidence.length;
    const invalidCount = invalidEvidence.length;
    const totalCount = validCount + invalidCount;
    const coverage = totalCount > 0 ? validCount / totalCount : 0;
    return {
      evidenceValid: validCount > 0 && (invalidCount === 0 || coverage >= 0.34),
      validEvidence,
      invalidEvidence,
      evidenceCoverage: coverage,
      reason:
        invalidCount > 0
          ? "invalid-evidence-path"
          : validCount === 0
          ? "missing-evidence"
          : "ok"
    };
  }

  function buildContextOverview(contextPack) {
    const inv = contextPack?.inventory;
    const magic = contextPack?.magic;
    const combat = contextPack?.combat;
    return {
      identity: contextPack?.identity ?? {},
      progression: {
        proficiencyBonus: contextPack?.progression?.proficiencyBonus ?? 0,
        classes: Array.isArray(contextPack?.progression?.resolvedClasses)
          ? contextPack.progression.resolvedClasses.slice(0, 2)
          : []
      },
      counts: {
        inventoryEntries: Number(inv?.totalEntries ?? 0),
        inventoryGrouped: Array.isArray(inv?.grouped) ? inv.grouped.length : 0,
        equippedEntries: Array.isArray(inv?.equipped) ? inv.equipped.length : 0,
        knownActions: Array.isArray(combat?.actionIds) ? combat.actionIds.length : 0,
        knownReactions: Array.isArray(combat?.reactionIds) ? combat.reactionIds.length : 0,
        spellSources: Array.isArray(magic?.sources) ? magic.sources.length : 0
      }
    };
  }

  function tool_getField(contextPack, args) {
    const path = String(args?.path ?? "").trim();
    const value = getByPath(contextPack, path);
    return {
      path: path || "",
      found: typeof value !== "undefined",
      value: typeof value === "undefined" ? null : value
    };
  }

  function tool_searchInventory(contextPack, args) {
    const grouped = Array.isArray(contextPack?.inventory?.grouped) ? contextPack.inventory.grouped : [];
    const equipped = Array.isArray(contextPack?.inventory?.equipped) ? contextPack.inventory.equipped : [];
    const query = safeLower(args?.query);
    const typeFilter = safeLower(args?.type);
    const equippedOnly = Boolean(args?.equippedOnly);
    const rows = equippedOnly
      ? (() => {
          const equippedMap = new Map();
          equipped.forEach((row) => {
            const id = String(row?.id ?? "");
            if (!id) return;
            const key = `${id}`;
            if (!equippedMap.has(key)) {
              equippedMap.set(key, {
                type: "weapon",
                id,
                displayName: String(row?.displayName ?? id),
                qty: 0,
                equippedQty: 0,
                slots: [],
                hasPrimary: false,
                hasSecondary: false
              });
            }
            const entry = equippedMap.get(key);
            entry.qty += 1;
            entry.equippedQty += 1;
            if (row?.slot) entry.slots.push(String(row.slot));
            if (row?.primary) entry.hasPrimary = true;
            if (row?.secondary) entry.hasSecondary = true;
          });
          return Array.from(equippedMap.values()).filter((row) => {
            const id = safeLower(row?.id);
            const displayName = safeLower(row?.displayName);
            const type = safeLower(row?.type);
            if (typeFilter && type !== typeFilter) return false;
            if (!query) return true;
            return id.includes(query) || displayName.includes(query) || type.includes(query);
          });
        })()
      : grouped.filter((row) => {
          const id = safeLower(row?.id);
          const displayName = safeLower(row?.displayName);
          const type = safeLower(row?.type);
          if (typeFilter && type !== typeFilter) return false;
          if (!query) return true;
          return id.includes(query) || displayName.includes(query) || type.includes(query);
        });
    return {
      query,
      type: typeFilter || "",
      equippedOnly,
      total: rows.length,
      items: rows.slice(0, TOOL_RESULT_LIMIT)
    };
  }

  function tool_listActions(contextPack, args) {
    const mode = safeLower(args?.mode) || "all";
    const includes = safeLower(args?.includes);
    const actionIds = Array.isArray(contextPack?.combat?.actionIds) ? contextPack.combat.actionIds : [];
    const reactionIds = Array.isArray(contextPack?.combat?.reactionIds) ? contextPack.combat.reactionIds : [];
    const source =
      mode === "actions" ? actionIds : mode === "reactions" ? reactionIds : [...actionIds, ...reactionIds];
    const dedup = Array.from(new Set(source.map((x) => String(x))));
    const filtered = includes ? dedup.filter((id) => safeLower(id).includes(includes)) : dedup;
    return {
      mode,
      total: filtered.length,
      ids: filtered.slice(0, 120)
    };
  }

  function tool_listSpells(contextPack, args) {
    const sources = Array.isArray(contextPack?.magic?.sources) ? contextPack.magic.sources : [];
    const sourceKey = safeLower(args?.sourceKey);
    const includes = safeLower(args?.includes);
    const mode = safeLower(args?.mode) || "all";
    const selected = sourceKey
      ? sources.filter((src) => safeLower(src?.key) === sourceKey)
      : sources;
    const list = [];
    selected.forEach((src) => {
      const known = Array.isArray(src?.knownSpellIds) ? src.knownSpellIds : [];
      const prepared = Array.isArray(src?.preparedSpellIds) ? src.preparedSpellIds : [];
      const chosen =
        mode === "known" ? known : mode === "prepared" ? prepared : [...known, ...prepared];
      chosen.forEach((spellId) => {
        const id = String(spellId ?? "");
        if (!id) return;
        if (includes && !safeLower(id).includes(includes)) return;
        list.push({ sourceKey: String(src?.key ?? ""), spellId: id });
      });
    });
    return {
      mode,
      sourceKey: sourceKey || "",
      total: list.length,
      spells: list.slice(0, 140)
    };
  }

  function tool_computeSkillBonus(contextPack, args) {
    const skillId = safeLower(args?.skillId);
    if (!skillId) {
      return {
        skillId: "",
        found: false,
        reason: "missing-skill-id"
      };
    }
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
    const ability = abilityMap[skillId];
    if (!ability) {
      return {
        skillId,
        found: false,
        reason: "unknown-skill"
      };
    }
    const profBonus = Number(contextPack?.progression?.proficiencyBonus ?? 0) || 0;
    const abilityMods = contextPack?.rules?.abilityMods ?? {};
    const abilityMod = Number(abilityMods?.[ability] ?? 0) || 0;
    const profs = new Set(
      (Array.isArray(contextPack?.rules?.skills) ? contextPack.rules.skills : []).map((x) => safeLower(x))
    );
    const exps = new Set(
      (Array.isArray(contextPack?.rules?.expertises) ? contextPack.rules.expertises : []).map((x) => safeLower(x))
    );
    const proficient = profs.has(skillId) || exps.has(skillId);
    const expertise = exps.has(skillId);
    const profPart = expertise ? profBonus * 2 : proficient ? profBonus : 0;
    return {
      skillId,
      found: true,
      ability,
      abilityMod,
      proficiencyBonus: profBonus,
      proficient,
      expertise,
      totalBonus: abilityMod + profPart
    };
  }

  function executeToolCall(contextPack, call) {
    const tool = safeLower(call?.tool);
    const args = call?.args && typeof call.args === "object" ? call.args : {};
    if (tool === "get_field") return { tool, result: tool_getField(contextPack, args) };
    if (tool === "search_inventory") return { tool, result: tool_searchInventory(contextPack, args) };
    if (tool === "list_actions") return { tool, result: tool_listActions(contextPack, args) };
    if (tool === "list_spells") return { tool, result: tool_listSpells(contextPack, args) };
    if (tool === "compute_skill_bonus") return { tool, result: tool_computeSkillBonus(contextPack, args) };
    return {
      tool,
      error: "unknown-tool"
    };
  }

  function sanitizeToolCalls(rawCalls) {
    if (!Array.isArray(rawCalls)) return [];
    return rawCalls
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const tool = safeLower(entry.tool);
        if (!tool) return null;
        const args = entry.args && typeof entry.args === "object" ? entry.args : {};
        return { tool, args };
      })
      .filter(Boolean)
      .slice(0, MAX_TOOL_CALLS);
  }

  function sanitizePlannerResult(raw) {
    if (!raw || typeof raw !== "object") return null;
    const intent = oneLine(raw.intent, 60) || "general_query";
    const needsClarification = Boolean(raw.needsClarification);
    const clarificationQuestion = needsClarification
      ? oneLine(raw.clarificationQuestion, 260)
      : "";
    const toolCalls = sanitizeToolCalls(raw.toolCalls);
    return {
      intent,
      needsClarification,
      clarificationQuestion,
      toolCalls
    };
  }

  function extractSkillId(message) {
    const text = normalizeForMatch(message);
    if (!text) return "";
    const aliases = [
      { key: "athletisme", terms: ["athletisme", "athletisme"] },
      { key: "acrobaties", terms: ["acrobaties", "acrobat"] },
      { key: "escamotage", terms: ["escamotage"] },
      { key: "discretion", terms: ["discretion", "furtivite"] },
      { key: "arcanes", terms: ["arcanes", "arcane"] },
      { key: "histoire", terms: ["histoire"] },
      { key: "investigation", terms: ["investigation", "enquete"] },
      { key: "nature", terms: ["nature"] },
      { key: "religion", terms: ["religion"] },
      { key: "intuition", terms: ["intuition", "perspicacite"] },
      { key: "medecine", terms: ["medecine"] },
      { key: "perception", terms: ["perception"] },
      { key: "survie", terms: ["survie"] },
      { key: "dressage", terms: ["dressage"] },
      { key: "intimidation", terms: ["intimidation", "intimider"] },
      { key: "persuasion", terms: ["persuasion", "persuader"] },
      { key: "tromperie", terms: ["tromperie", "mensonge"] },
      { key: "representation", terms: ["representation", "performance"] }
    ];
    const match = aliases.find((entry) =>
      entry.terms.some((term) => text.includes(normalizeForMatch(term)))
    );
    return match ? match.key : "";
  }

  function buildFallbackToolCalls(message, plannerIntent) {
    const text = normalizeForMatch(message);
    const intent = normalizeForMatch(plannerIntent);
    const calls = [];
    const pushCall = (tool, args) => {
      if (calls.length >= MAX_TOOL_CALLS) return;
      const payload = { tool: safeLower(tool), args: args && typeof args === "object" ? args : {} };
      const key = JSON.stringify(payload);
      if (calls.some((entry) => JSON.stringify(entry) === key)) return;
      calls.push(payload);
    };

    const isClassQuery =
      intent.includes("class") || /\bclasse\b|\bsubclasse\b|\bniveau\b/.test(text);
    const isMoneyQuery =
      intent.includes("money") ||
      /\bor\b|\bargent\b|\bcuivre\b|\bplatine\b|\bpieces?\b|\bgold\b/.test(text);
    const isWeaponQuery =
      intent.includes("weapon") ||
      /\barme\b|\barmes\b|\bcouteau\b|\bepee\b|\barc\b|\bequipement\b/.test(text);
    const isSpellQuery =
      intent.includes("spell") ||
      /\bsort\b|\bsorts\b|\blancer\b|\bincant\b|\bminor-ward\b/.test(text);
    const isSkillQuery =
      intent.includes("skill") || /\bbonus\b|\bcompetence\b|\bcompetences\b|\bathlet/.test(text);
    const isIdentityQuery =
      intent.includes("identity") || /\bqui je suis\b|\bqui suis-je\b|\brace\b|\bprofil\b/.test(text);

    if (isClassQuery || isIdentityQuery) {
      pushCall("get_field", { path: "progression.classEntries" });
      pushCall("get_field", { path: "progression.resolvedClasses" });
      pushCall("get_field", { path: "identity.raceLabel" });
      pushCall("get_field", { path: "identity.resolvedRaceLabel" });
    }
    if (isMoneyQuery) {
      pushCall("get_field", { path: "resources.money" });
      pushCall("search_inventory", { query: "piece", type: "object", equippedOnly: false });
    }
    if (isWeaponQuery) {
      pushCall("search_inventory", { type: "weapon", equippedOnly: false });
      pushCall("search_inventory", { type: "weapon", equippedOnly: true });
    }
    if (isSpellQuery) {
      const spellHint = text.includes("minor-ward") ? "minor-ward" : "";
      pushCall("list_spells", { mode: "all", includes: spellHint });
      pushCall("get_field", { path: "magic.slots" });
    }
    if (isSkillQuery) {
      const skillId = extractSkillId(text);
      if (skillId) {
        pushCall("compute_skill_bonus", { skillId });
      }
      pushCall("get_field", { path: "rules.skills" });
      pushCall("get_field", { path: "rules.expertises" });
      pushCall("get_field", { path: "rules.abilityMods" });
      pushCall("get_field", { path: "progression.proficiencyBonus" });
    }

    if (calls.length === 0) {
      pushCall("get_field", { path: "identity" });
      pushCall("get_field", { path: "progression" });
      pushCall("get_field", { path: "resources.money" });
    }
    return calls.slice(0, MAX_TOOL_CALLS);
  }

  function inferSkillBonusFromContext(contextPack, skillId) {
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
    const skills = new Set(
      (Array.isArray(contextPack?.rules?.skills) ? contextPack.rules.skills : []).map((x) => safeLower(x))
    );
    const expertises = new Set(
      (Array.isArray(contextPack?.rules?.expertises) ? contextPack.rules.expertises : []).map((x) => safeLower(x))
    );
    const proficient = skills.has(safeLower(skillId)) || expertises.has(safeLower(skillId));
    const expertise = expertises.has(safeLower(skillId));
    const profPart = expertise ? profBonus * 2 : proficient ? profBonus : 0;
    return {
      ability,
      abilityMod,
      proficient,
      expertise,
      proficiencyBonus: profBonus,
      totalBonus: abilityMod + profPart
    };
  }

  function buildGroundedFactualAnswer(message, contextPack) {
    const text = normalizeForMatch(message);
    const isClassQuery = /\bclasse\b|\bsubclasse\b|\bniveau\b/.test(text);
    const isMoneyQuery = /\bor\b|\bargent\b|\bcuivre\b|\bplatine\b|\bpieces?\b|\bgold\b/.test(text);
    const isWeaponQuery = /\barme\b|\barmes\b|\bcouteau\b|\bepee\b|\barc\b|\bequipement\b/.test(text);
    const asksEquippedWeapons =
      /\bequipe\b|\bequipees\b|\bequip[eé]e?s?\b|\bsur moi\b|\ben main\b|\bceinture\b|\bslot\b/.test(text);
    const asksWeaponDetails =
      /\bdescription\b|\bpropriete\b|\bproprietes\b|\bdetail\b|\bdetails\b/.test(text);
    const isSpellQuery = /\bsort\b|\bsorts\b|\blancer\b|\bincant\b|\bminor-ward\b/.test(text);
    const isSkillBonusQuery =
      /\bbonus\b|\bcompetence\b|\bcompetences\b|\bathlet|\bacrobat|\bperception|\bintimidation/.test(text);

    if (isClassQuery) {
      const resolved = Array.isArray(contextPack?.progression?.resolvedClasses)
        ? contextPack.progression.resolvedClasses
        : [];
      const entries = Array.isArray(contextPack?.progression?.classEntries)
        ? contextPack.progression.classEntries
        : [];
      const primaryResolved = resolved[0] ?? null;
      const primaryEntry = entries[0] ?? null;
      const classLabel =
        String(primaryResolved?.classLabel ?? "").trim() ||
        String(primaryEntry?.classeId ?? primaryEntry?.classId ?? "").trim();
      const subclassLabel =
        String(primaryResolved?.subclassLabel ?? "").trim() ||
        String(primaryEntry?.subclasseId ?? primaryEntry?.subclassId ?? "").trim();
      const level = Number(primaryEntry?.niveau ?? 0) || 0;
      if (classLabel) {
        return `Ta classe est ${classLabel}${subclassLabel ? ` (${subclassLabel})` : ""}${level > 0 ? `, niveau ${level}` : ""}.`;
      }
    }

    if (isMoneyQuery) {
      const money = contextPack?.resources?.money ?? {};
      const or = Number(money?.or ?? money?.gold ?? 0) || 0;
      const argent = Number(money?.argent ?? money?.silver ?? 0) || 0;
      const cuivre = Number(money?.cuivre ?? money?.copper ?? 0) || 0;
      const platine = Number(money?.platine ?? money?.platinum ?? 0) || 0;
      return `Tu as ${or} pièces d'or, ${argent} d'argent, ${cuivre} de cuivre et ${platine} de platine.`;
    }

    if (isWeaponQuery) {
      const grouped = Array.isArray(contextPack?.inventory?.grouped) ? contextPack.inventory.grouped : [];
      const entries = Array.isArray(contextPack?.inventory?.entries) ? contextPack.inventory.entries : [];
      const weapons = grouped.filter((row) => safeLower(row?.type) === "weapon");
      const equipped = Array.isArray(contextPack?.inventory?.equipped) ? contextPack.inventory.equipped : [];
      if (asksWeaponDetails) {
        const weaponEntries = entries.filter((row) => safeLower(row?.type) === "weapon");
        const target = weaponEntries.find((row) => {
          const id = safeLower(row?.id);
          const label = safeLower(row?.displayName);
          return id && text.includes(id) || (label && text.includes(label));
        });
        if (target) {
          const label = String(target?.displayName ?? target?.id ?? "arme");
          const desc = String(target?.description ?? "").trim();
          return desc ? `${label}: ${desc}` : `${label}: aucune description detaillee dans la fiche.`;
        }
      }
      if (asksEquippedWeapons) {
        if (equipped.length === 0) return "Tu n'as aucune arme équipée actuellement.";
        const lines = equipped.slice(0, 8).map((row) => {
          const name = String(row?.displayName ?? row?.id ?? "arme inconnue");
          const role = row?.primary ? " (arme principale)" : row?.secondary ? " (main secondaire)" : "";
          const slot = row?.slot ? `, slot ${String(row.slot)}` : "";
          return `- ${name}${role}${slot}`;
        });
        return `Armes équipées:\n${lines.join("\n")}`;
      }
      if (weapons.length === 0) return "Tu n'as aucune arme dans l'inventaire.";
      const label = weapons
        .map((row) => `${Number(row?.qty ?? 1) || 1} x ${String(row?.displayName ?? row?.id ?? "arme inconnue")}`)
        .slice(0, 8)
        .join(", ");
      return `Armes possédées (équipées + rangées): ${label}.`;
    }

    if (isSkillBonusQuery) {
      const skillId = extractSkillId(text);
      if (skillId) {
        const bonus = inferSkillBonusFromContext(contextPack, skillId);
        if (bonus) {
          const sign = bonus.totalBonus >= 0 ? `+${bonus.totalBonus}` : String(bonus.totalBonus);
          return `Ton bonus de ${skillId} est ${sign}.`;
        }
      }
    }

    if (isSpellQuery) {
      const spellMatch = text.match(/\bminor-ward\b|rayon-de-feu|minor ward/);
      const target = spellMatch ? spellMatch[0].replace(/\s+/g, "-") : "";
      const sources = Array.isArray(contextPack?.magic?.sources) ? contextPack.magic.sources : [];
      const known = new Set();
      sources.forEach((src) => {
        (Array.isArray(src?.knownSpellIds) ? src.knownSpellIds : []).forEach((id) => known.add(String(id)));
        (Array.isArray(src?.preparedSpellIds) ? src.preparedSpellIds : []).forEach((id) => known.add(String(id)));
      });
      const slots = Array.isArray(contextPack?.magic?.slots) ? contextPack.magic.slots : [];
      const hasSlot = slots.some((row) => Number(row?.remaining ?? 0) > 0);
      if (target) {
        const hasSpell = known.has(target);
        if (hasSpell && hasSlot) return `Oui, tu peux lancer ${target} (emplacements de sort disponibles).`;
        if (hasSpell && !hasSlot) return `Tu connais ${target}, mais il n'y a plus d'emplacement de sort disponible.`;
        return `Tu ne connais pas ${target} dans ta fiche actuelle.`;
      }
    }

    return "";
  }

  function sanitizeHrpResult(raw) {
    if (!raw || typeof raw !== "object") return null;
    const answer = oneLine(raw.answer, 900);
    if (!answer) return null;
    const intent = oneLine(raw.intent, 60) || "general_query";
    const confidenceRaw = Number(raw.confidence ?? 0.65);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, confidenceRaw))
      : 0.65;
    const needsClarification = Boolean(raw.needsClarification);
    const clarificationQuestion = needsClarification
      ? oneLine(raw.clarificationQuestion, 260)
      : "";
    const evidence = sanitizeEvidence(raw.evidence);
    return {
      answer,
      intent,
      confidence,
      needsClarification,
      clarificationQuestion,
      evidence
    };
  }

  function evidenceFromToolTrace(toolTrace) {
    if (!Array.isArray(toolTrace)) return [];
    const out = [];
    toolTrace.forEach((entry) => {
      const tool = safeLower(entry?.tool);
      if (!tool) return;
      if (tool === "get_field") {
        const rawPath = String(entry?.result?.path ?? entry?.args?.path ?? "").trim();
        if (rawPath) {
          out.push({ path: rawPath, reason: "tool:get_field" });
        }
        return;
      }
      if (tool === "search_inventory") {
        out.push({ path: "contextPack.inventory.grouped", reason: "tool:search_inventory" });
        out.push({ path: "contextPack.inventory.equipped", reason: "tool:search_inventory" });
        return;
      }
      if (tool === "list_actions") {
        out.push({ path: "contextPack.combat.actionIds", reason: "tool:list_actions" });
        out.push({ path: "contextPack.combat.reactionIds", reason: "tool:list_actions" });
        return;
      }
      if (tool === "list_spells") {
        out.push({ path: "contextPack.magic.sources", reason: "tool:list_spells" });
        out.push({ path: "contextPack.magic.slots", reason: "tool:list_spells" });
        return;
      }
      if (tool === "compute_skill_bonus") {
        out.push({ path: "contextPack.rules.skills", reason: "tool:compute_skill_bonus" });
        out.push({ path: "contextPack.rules.abilityMods", reason: "tool:compute_skill_bonus" });
        out.push({ path: "contextPack.progression.proficiencyBonus", reason: "tool:compute_skill_bonus" });
      }
    });
    return sanitizeEvidence(out);
  }

  async function analyzeHrpQuery(message, contextPack) {
    if (!aiEnabled || !contextPack) return null;
    try {
      const model = resolveModel();

      const plannerPrompt =
        "Tu es un planificateur d'analyse HRP de fiche JDR. " +
        "Tu dois d'abord choisir des appels d'outils pour repondre precisement. " +
        "Retourne UNIQUEMENT un JSON valide avec: intent, needsClarification, clarificationQuestion, toolCalls. " +
        "toolCalls est un tableau de {tool, args}. Outils autorises: " +
        "get_field(path), search_inventory(query,type,equippedOnly), list_actions(mode,includes), list_spells(mode,sourceKey,includes), compute_skill_bonus(skillId). " +
        "N'invente aucun outil.";

      const plannerPayload = {
        message: String(message ?? ""),
        contextOverview: buildContextOverview(contextPack)
      };

      const plannerRaw = await callOpenAiJson({
        model,
        systemPrompt: plannerPrompt,
        userPayload: plannerPayload
      });
      const planner = sanitizePlannerResult(plannerRaw);
      if (!planner) return null;

      const selectedToolCalls =
        Array.isArray(planner.toolCalls) && planner.toolCalls.length > 0
          ? planner.toolCalls
          : buildFallbackToolCalls(message, planner.intent);

      const executedTools = selectedToolCalls.map((call) => ({
        ...call,
        ...executeToolCall(contextPack, call)
      }));

      const answerPrompt =
        "Tu es un analyste HRP pour un JDR. " +
        "Reponds factuellement depuis contextPack et toolResults sans inventer. " +
        "Si l'information est absente, dis-le clairement. " +
        "Retourne UNIQUEMENT un JSON valide avec: intent, answer, confidence, needsClarification, clarificationQuestion, evidence. " +
        "evidence doit referencer des chemins de contextPack. " +
        "Quand la question vise l'identite/progression (classe, race, niveau), donne une reponse directe et courte.";

      const answerPayload = {
        message: String(message ?? ""),
        contextPack,
        toolResults: executedTools,
        planner
      };

      const parsed = await callOpenAiJson({
        model,
        systemPrompt: answerPrompt,
        userPayload: answerPayload
      });

      const sanitized = sanitizeHrpResult(parsed);
      if (!sanitized) return null;
      const groundedAnswer = buildGroundedFactualAnswer(message, contextPack);
      const enrichedAnswer =
        String(groundedAnswer).trim().length > 0 ? String(groundedAnswer).trim() : sanitized.answer;
      const toolEvidence = evidenceFromToolTrace(executedTools);
      const mergedEvidence = sanitizeEvidence([...(sanitized.evidence ?? []), ...toolEvidence]);
      const evidenceCheck = validateEvidence(mergedEvidence, contextPack);
      return {
        ...sanitized,
        answer: enrichedAnswer,
        evidence: mergedEvidence,
        ...evidenceCheck,
        toolTrace: executedTools,
        planner
      };
    } catch (err) {
      warn("[hrp-ai] fallback local:", err?.message ?? err);
      return null;
    }
  }

  return {
    analyzeHrpQuery
  };
}

module.exports = {
  createHrpAiInterpreter
};
