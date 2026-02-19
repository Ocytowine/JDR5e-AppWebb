import fs from "node:fs";
import path from "node:path";
import { resolveActionCostContext } from "../src/game/engine/rules/actionEconomy.ts";
import {
  hasDualWieldActionTag,
  normalizeDualWieldActionTags
} from "../src/game/engine/rules/weaponPairingRules.ts";
import {
  runtimeMarkerAppliesToResolution,
  type RuntimeMarkerPayload
} from "../src/game/engine/runtime/runtimeMarkers.ts";

type AnyRecord = Record<string, any>;

type TestContext = {
  turnActionUsed: boolean;
  turnAttackActionUsed: boolean;
  turnSpellCast: boolean;
  turnCantripCast: boolean;
  weaponMasteries: string[];
};

const ROOT = path.resolve(__dirname, "..");
const FIGHTER_FEATURE_DIR = path.join(
  ROOT,
  "src",
  "data",
  "characters",
  "features",
  "fighter"
);
const CLASS_PATH = path.join(
  ROOT,
  "src",
  "data",
  "characters",
  "classes",
  "Guerrier",
  "class.json"
);
const SUBCLASS_PATH = path.join(
  ROOT,
  "src",
  "data",
  "characters",
  "classes",
  "Guerrier",
  "eldritch-knight.json"
);

const FEATURE_FILES = [
  "action-surge-2.json",
  "action-surge.json",
  "arcane-charge.json",
  "eldritch-knight-spellcasting.json",
  "eldritch-strike.json",
  "extra-attack-2.json",
  "extra-attack-3.json",
  "extra-attack.json",
  "improved-war-magic.json",
  "indomitable-2.json",
  "indomitable-3.json",
  "indomitable.json",
  "second-wind-feature.json",
  "tactical-mastery.json",
  "tactical-mind.json",
  "tactical-shift.json",
  "war-magic.json",
  "weapon-mastery.json"
] as const;

type FeatureFile = (typeof FEATURE_FILES)[number];

function readJson(filePath: string): AnyRecord {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function normalizeMasteryId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function buildProgressionFeatureLevels(definition: AnyRecord): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const progression = definition?.progression && typeof definition.progression === "object"
    ? definition.progression
    : {};
  for (const [lvlKey, step] of Object.entries(progression)) {
    const lvl = Number(lvlKey);
    if (!Number.isFinite(lvl)) continue;
    const grants = Array.isArray((step as AnyRecord)?.grants) ? (step as AnyRecord).grants : [];
    for (const grant of grants) {
      if (String(grant?.kind ?? "") !== "feature") continue;
      const ids = Array.isArray(grant?.ids) ? grant.ids : [];
      for (const id of ids) {
        const key = String(id);
        const list = out.get(key) ?? [];
        list.push(lvl);
        out.set(key, list);
      }
    }
  }
  return out;
}

function makeAction(params: {
  id: string;
  category?: string;
  costType?: string;
  tags?: string[];
}): AnyRecord {
  return {
    id: params.id,
    name: params.id,
    category: params.category ?? "attack",
    actionCost: { actionType: params.costType ?? "action", movementCost: 0 },
    tags: params.tags ?? []
  };
}

function featureModifierMatches(args: {
  modifier: AnyRecord;
  actor: AnyRecord;
  action: AnyRecord;
  weapon: AnyRecord | null;
  ctx: TestContext;
}): boolean {
  const { modifier, actor, action, weapon, ctx } = args;
  const when = modifier?.when && typeof modifier.when === "object" ? modifier.when : {};

  const actorType = String(when.actorType ?? "").trim();
  if (actorType && actorType !== String(actor?.type ?? "")) return false;

  if (when.actionCategory && String(when.actionCategory) !== String(action?.category ?? "")) {
    return false;
  }

  if (when.actionCostType) {
    const costType = String(action?.actionCost?.actionType ?? "");
    if (String(when.actionCostType) !== costType) return false;
  }

  const tags = normalizeDualWieldActionTags(Array.isArray(action?.tags) ? action.tags : []);

  if (Array.isArray(when.actionTagsAny) && when.actionTagsAny.length > 0) {
    const any = when.actionTagsAny.some((tag: unknown) =>
      tags.includes(String(tag))
    );
    if (!any) return false;
  }

  if (Array.isArray(when.actionTagsAll) && when.actionTagsAll.length > 0) {
    const all = when.actionTagsAll.every((tag: unknown) =>
      tags.includes(String(tag))
    );
    if (!all) return false;
  }

  if (Array.isArray(when.actionTagsNone) && when.actionTagsNone.length > 0) {
    const hasForbidden = when.actionTagsNone.some((tag: unknown) =>
      tags.includes(String(tag))
    );
    if (hasForbidden) return false;
  }

  if (when.weaponCategory || Array.isArray(when.weaponCategories)) {
    const category = String(weapon?.category ?? "");
    const expected = Array.isArray(when.weaponCategories)
      ? when.weaponCategories.map((entry: unknown) => String(entry))
      : [String(when.weaponCategory)];
    if (!category || !expected.includes(category)) return false;
  }

  if (typeof when.requiresTurnActionUsed === "boolean") {
    if (ctx.turnActionUsed !== Boolean(when.requiresTurnActionUsed)) return false;
  }

  if (typeof when.requiresTurnAttackActionUsed === "boolean") {
    if (ctx.turnAttackActionUsed !== Boolean(when.requiresTurnAttackActionUsed)) return false;
  }

  if (typeof when.requiresTurnSpellCast === "boolean") {
    if (ctx.turnSpellCast !== Boolean(when.requiresTurnSpellCast)) return false;
  }

  if (typeof when.requiresTurnCantripCast === "boolean") {
    if (ctx.turnCantripCast !== Boolean(when.requiresTurnCantripCast)) return false;
  }

  if (Array.isArray(when.weaponMasteriesAny) && when.weaponMasteriesAny.length > 0) {
    if (String(actor?.type ?? "") !== "player") return false;
    const mastered = ctx.weaponMasteries.map(id => normalizeMasteryId(id));
    const any = when.weaponMasteriesAny.some((id: unknown) =>
      mastered.includes(normalizeMasteryId(id))
    );
    if (!any) return false;
  }

  if (Array.isArray(when.weaponMasteriesAll) && when.weaponMasteriesAll.length > 0) {
    if (String(actor?.type ?? "") !== "player") return false;
    const mastered = ctx.weaponMasteries.map(id => normalizeMasteryId(id));
    const all = when.weaponMasteriesAll.every((id: unknown) =>
      mastered.includes(normalizeMasteryId(id))
    );
    if (!all) return false;
  }

  return true;
}

function runtimeRuleMatchesWhen(params: {
  when: AnyRecord;
  actor: AnyRecord;
  action: AnyRecord;
  weapon: AnyRecord | null;
  outcomeKind?: string | null;
  ctx: TestContext;
}): boolean {
  const { when, actor, action, weapon, outcomeKind, ctx } = params;
  if (
    !featureModifierMatches({
      modifier: { when },
      actor,
      action,
      weapon,
      ctx
    })
  ) {
    return false;
  }
  if (typeof when.actionId === "string" && String(when.actionId) !== String(action.id ?? "")) {
    return false;
  }
  if (Array.isArray(when.actionIdsAny) && when.actionIdsAny.length > 0) {
    const expected = when.actionIdsAny.map((value: unknown) => String(value));
    if (!expected.includes(String(action.id ?? ""))) return false;
  }
  if (Array.isArray(when.outcomeAny) && when.outcomeAny.length > 0) {
    const expected = when.outcomeAny.map((value: unknown) => String(value).trim().toLowerCase());
    const current = String(outcomeKind ?? "").trim().toLowerCase();
    if (!current || !expected.includes(current)) return false;
  }
  if (Array.isArray(when.outcomeNone) && when.outcomeNone.length > 0) {
    const forbidden = when.outcomeNone.map((value: unknown) => String(value).trim().toLowerCase());
    const current = String(outcomeKind ?? "").trim().toLowerCase();
    if (forbidden.includes(current)) return false;
  }
  return true;
}

function resolveCostContextForFeature(params: {
  feature: AnyRecord;
  action: AnyRecord;
  weapon?: AnyRecord | null;
  usedMainActionCount?: number;
  usedAttackActionCount?: number;
  turnUsageCounts?: Record<string, number>;
  ctx?: Partial<TestContext>;
}): AnyRecord {
  const ctx: TestContext = {
    turnActionUsed: false,
    turnAttackActionUsed: false,
    turnSpellCast: false,
    turnCantripCast: false,
    weaponMasteries: [],
    ...(params.ctx ?? {})
  };
  const actor = { id: "pj", type: "player" };
  const modifiers = Array.isArray(params.feature?.rules?.modifiers)
    ? params.feature.rules.modifiers
    : [];

  return resolveActionCostContext({
    action: params.action,
    actor: actor as any,
    weapon: (params.weapon ?? null) as any,
    usedMainActionCount: Number(params.usedMainActionCount ?? 0),
    usedAttackActionCount: Number(params.usedAttackActionCount ?? 0),
    turnUsageCounts: params.turnUsageCounts ?? {},
    getFeatureRuleModifiersForActor: () => modifiers,
    featureModifierMatches: ({ modifier, actor: matchActor, action, weapon }) =>
      featureModifierMatches({
        modifier,
        actor: matchActor as AnyRecord,
        action: action as AnyRecord,
        weapon: (weapon ?? null) as AnyRecord | null,
        ctx
      }),
    normalizeActionTags: normalizeDualWieldActionTags,
    hasDualWieldActionTag
  });
}

function getResourceMaxAtLevel(feature: AnyRecord, resourceId: string, level: number): number | null {
  const grants = Array.isArray(feature?.grants) ? feature.grants : [];
  const resourceGrant = grants.find((grant: AnyRecord) => {
    if (String(grant?.kind ?? "") !== "resource") return false;
    const ids = Array.isArray(grant?.ids) ? grant.ids : [];
    return ids.map((v: unknown) => String(v)).includes(resourceId);
  });
  if (!resourceGrant) return null;
  const maxByLevel = resourceGrant?.meta?.maxByLevel;
  if (!maxByLevel || typeof maxByLevel !== "object") return null;
  let best: number | null = null;
  let bestLevel = -Infinity;
  for (const [lvlKey, value] of Object.entries(maxByLevel)) {
    const lvl = Number(lvlKey);
    const n = Number(value);
    if (!Number.isFinite(lvl) || !Number.isFinite(n)) continue;
    if (lvl <= level && lvl > bestLevel) {
      bestLevel = lvl;
      best = n;
    }
  }
  return best;
}

function applyRuntimeEffects(params: {
  rules: AnyRecord[];
  action: AnyRecord;
  outcomeKind?: string | null;
  playerState: { x: number; y: number; movementSpeed: number; statuses: AnyRecord[] };
  primaryTarget?: { x: number; y: number } | null;
  ctx?: Partial<TestContext>;
}): {
  bonusMainActionsDelta: number;
  movementBudgetDelta: number;
  playerState: { x: number; y: number; movementSpeed: number; statuses: AnyRecord[] };
} {
  const ctx: TestContext = {
    turnActionUsed: false,
    turnAttackActionUsed: false,
    turnSpellCast: false,
    turnCantripCast: false,
    weaponMasteries: [],
    ...(params.ctx ?? {})
  };
  let nextPlayer = { ...params.playerState, statuses: [...params.playerState.statuses] };
  let bonusMainActionsDelta = 0;
  let movementBudgetDelta = 0;

  for (const rule of params.rules) {
    const when = rule?.when && typeof rule.when === "object" ? rule.when : {};
    const matches = runtimeRuleMatchesWhen({
      when,
      actor: { id: "pj", type: "player" },
      action: params.action,
      weapon: null,
      outcomeKind: params.outcomeKind,
      ctx
    });
    if (!matches) continue;

    const effects = Array.isArray(rule?.effects) ? rule.effects : [];
    for (const effect of effects) {
      const kind = String(effect?.kind ?? "");
      if (kind === "grantMainAction") {
        const amount = Number(effect?.amount ?? 0);
        if (Number.isFinite(amount) && amount > 0) {
          bonusMainActionsDelta += Math.max(1, Math.floor(amount));
        }
        continue;
      }

      if (kind === "grantMovementBySpeedFraction") {
        const fraction = Number(effect?.fraction ?? 0);
        const minCells = Number(effect?.minCells ?? 1);
        if (Number.isFinite(fraction) && fraction > 0) {
          const speedCells = Math.max(0, Math.floor(Number(nextPlayer.movementSpeed ?? 0)));
          const gained = Math.max(
            Math.max(0, Math.floor(Number.isFinite(minCells) ? minCells : 0)),
            Math.floor(speedCells * fraction)
          );
          if (gained > 0) movementBudgetDelta += gained;
        }
        continue;
      }

      if (kind === "addStatus") {
        const statusId = String(effect?.statusId ?? "").trim();
        if (!statusId) continue;
        nextPlayer.statuses = [
          ...nextPlayer.statuses.filter(status => String(status?.id ?? "") !== statusId),
          {
            id: statusId,
            remainingTurns: Math.max(1, Math.floor(Number(effect?.remainingTurns ?? 1))),
            durationTick:
              String(effect?.durationTick ?? "start") === "end" ||
              String(effect?.durationTick ?? "start") === "round"
                ? String(effect?.durationTick)
                : "start"
          }
        ];
        continue;
      }

      if (kind === "teleportNearPrimaryTarget") {
        const maxCells = Math.max(1, Math.floor(Number(effect?.maxCells ?? 0)));
        const target = params.primaryTarget ?? null;
        if (!target) continue;
        const candidates = [
          { x: target.x - 1, y: target.y - 1 },
          { x: target.x - 1, y: target.y },
          { x: target.x - 1, y: target.y + 1 },
          { x: target.x, y: target.y - 1 },
          { x: target.x, y: target.y + 1 },
          { x: target.x + 1, y: target.y - 1 },
          { x: target.x + 1, y: target.y },
          { x: target.x + 1, y: target.y + 1 }
        ];
        const reachable = candidates.find(cell => {
          const dx = Math.abs(cell.x - nextPlayer.x);
          const dy = Math.abs(cell.y - nextPlayer.y);
          return Math.max(dx, dy) <= maxCells;
        });
        if (reachable) {
          nextPlayer = { ...nextPlayer, x: reachable.x, y: reachable.y };
        }
      }
    }
  }

  return { bonusMainActionsDelta, movementBudgetDelta, playerState: nextPlayer };
}

function main(): void {
  const classData = readJson(CLASS_PATH);
  const subclassData = readJson(SUBCLASS_PATH);
  const classLevels = buildProgressionFeatureLevels(classData);
  const subclassLevels = buildProgressionFeatureLevels(subclassData);

  const featuresById = new Map<string, AnyRecord>();
  for (const file of FEATURE_FILES) {
    const feature = readJson(path.join(FIGHTER_FEATURE_DIR, file));
    featuresById.set(String(feature.id), feature);
  }

  const checks: Array<() => void> = [];

  const expectGrantedAt = (featureId: string, expected: number[], scope: "class" | "subclass") => {
    checks.push(() => {
      const found = scope === "class" ? classLevels.get(featureId) ?? [] : subclassLevels.get(featureId) ?? [];
      const sortedFound = [...found].sort((a, b) => a - b);
      const sortedExpected = [...expected].sort((a, b) => a - b);
      assert(
        JSON.stringify(sortedFound) === JSON.stringify(sortedExpected),
        `${featureId}: niveaux ${scope} attendus=${sortedExpected.join(",")} obtenus=${sortedFound.join(",")}`
      );
      console.log(`[OK] ${featureId}: progression ${scope} -> ${sortedFound.join(",") || "aucun"}`);
    });
  };

  expectGrantedAt("weapon-mastery", [1], "class");
  expectGrantedAt("second-wind-feature", [1], "class");
  expectGrantedAt("action-surge", [2], "class");
  expectGrantedAt("tactical-mind", [2], "class");
  expectGrantedAt("extra-attack", [5], "class");
  expectGrantedAt("tactical-shift", [5], "class");
  expectGrantedAt("indomitable", [9], "class");
  expectGrantedAt("tactical-mastery", [9], "class");
  expectGrantedAt("extra-attack-2", [11], "class");
  expectGrantedAt("indomitable-2", [13], "class");
  expectGrantedAt("action-surge-2", [17], "class");
  expectGrantedAt("indomitable-3", [17], "class");
  expectGrantedAt("extra-attack-3", [20], "class");
  expectGrantedAt("eldritch-knight-spellcasting", [3], "subclass");
  expectGrantedAt("war-magic", [7], "subclass");
  expectGrantedAt("eldritch-strike", [10], "subclass");
  expectGrantedAt("arcane-charge", [15], "subclass");
  expectGrantedAt("improved-war-magic", [18], "subclass");

  checks.push(() => {
    const f = featuresById.get("second-wind-feature")!;
    assert(getResourceMaxAtLevel(f, "second-wind", 1) === 2, "second-wind lvl1 attendu 2");
    assert(getResourceMaxAtLevel(f, "second-wind", 4) === 3, "second-wind lvl4 attendu 3");
    assert(getResourceMaxAtLevel(f, "second-wind", 10) === 4, "second-wind lvl10 attendu 4");
    assert(getResourceMaxAtLevel(f, "second-wind", 20) === 4, "second-wind lvl20 attendu 4");
    console.log("[OK] second-wind-feature: scaling resource valide");
  });

  checks.push(() => {
    const f = featuresById.get("action-surge")!;
    assert(getResourceMaxAtLevel(f, "action-surge", 2) === 1, "action-surge lvl2 attendu 1");
    assert(getResourceMaxAtLevel(f, "action-surge", 17) === 2, "action-surge lvl17 attendu 2");
    console.log("[OK] action-surge: scaling resource valide");
  });

  checks.push(() => {
    const f = featuresById.get("indomitable")!;
    assert(getResourceMaxAtLevel(f, "indomitable", 9) === 1, "indomitable lvl9 attendu 1");
    assert(getResourceMaxAtLevel(f, "indomitable", 13) === 2, "indomitable lvl13 attendu 2");
    assert(getResourceMaxAtLevel(f, "indomitable", 17) === 3, "indomitable lvl17 attendu 3");
    console.log("[OK] indomitable: scaling resource valide");
  });

  const testExtraAttack = (featureId: string, maxPerTurn: number) => {
    checks.push(() => {
      const feature = featuresById.get(featureId)!;
      const action = makeAction({ id: "melee-strike", category: "attack", costType: "action", tags: [] });

      const yes = resolveCostContextForFeature({
        feature,
        action,
        usedMainActionCount: 1,
        usedAttackActionCount: 1,
        turnUsageCounts: {},
        ctx: { turnAttackActionUsed: true }
      });
      assert(yes.costType === "free", `${featureId}: cout attendu free si attaque deja lancee`);
      assert(
        yes.bypassUsageKey === "fighter:extra-attack:free-attacks",
        `${featureId}: usageKey inattendu`
      );
      assert(yes.bypassMaxPerTurn === maxPerTurn, `${featureId}: maxPerTurn attendu ${maxPerTurn}`);

      const noAttack = resolveCostContextForFeature({
        feature,
        action,
        usedMainActionCount: 0,
        usedAttackActionCount: 0,
        turnUsageCounts: {},
        ctx: { turnAttackActionUsed: false }
      });
      assert(noAttack.costType === "action", `${featureId}: devrait rester action sans attaque prealable`);

      const spellTagged = resolveCostContextForFeature({
        feature,
        action: makeAction({
          id: "melee-strike",
          category: "attack",
          costType: "action",
          tags: ["spell"]
        }),
        usedMainActionCount: 1,
        usedAttackActionCount: 1,
        turnUsageCounts: {},
        ctx: { turnAttackActionUsed: true }
      });
      assert(spellTagged.costType === "action", `${featureId}: ne doit pas s'appliquer sur tag spell`);

      const atLimit = resolveCostContextForFeature({
        feature,
        action,
        usedMainActionCount: 1,
        usedAttackActionCount: 1,
        turnUsageCounts: { "fighter:extra-attack:free-attacks": maxPerTurn },
        ctx: { turnAttackActionUsed: true }
      });
      assert(atLimit.costType === "action", `${featureId}: limite tour atteinte -> doit revenir en action`);

      console.log(`[OK] ${featureId}: runtime modifier actionCost valide`);
    });
  };

  testExtraAttack("extra-attack", 1);
  testExtraAttack("extra-attack-2", 2);
  testExtraAttack("extra-attack-3", 3);

  checks.push(() => {
    const feature = featuresById.get("war-magic")!;
    const action = makeAction({ id: "melee-strike", category: "attack", costType: "action", tags: [] });

    const ok = resolveCostContextForFeature({
      feature,
      action,
      usedMainActionCount: 1,
      usedAttackActionCount: 0,
      turnUsageCounts: {},
      ctx: { turnCantripCast: true }
    });
    assert(ok.costType === "bonus", "war-magic: cout attendu bonus apres cantrip");
    assert(ok.bypassUsageKey === "fighter:war-magic:bonus-attack", "war-magic: usageKey inattendu");

    const no = resolveCostContextForFeature({
      feature,
      action,
      usedMainActionCount: 1,
      usedAttackActionCount: 0,
      turnUsageCounts: {},
      ctx: { turnCantripCast: false }
    });
    assert(no.costType === "action", "war-magic: sans cantrip, cout doit rester action");

    console.log("[OK] war-magic: runtime modifier valide");
  });

  checks.push(() => {
    const feature = featuresById.get("improved-war-magic")!;
    const action = makeAction({ id: "melee-strike", category: "attack", costType: "action", tags: [] });

    const ok = resolveCostContextForFeature({
      feature,
      action,
      usedMainActionCount: 1,
      usedAttackActionCount: 0,
      turnUsageCounts: {},
      ctx: { turnSpellCast: true }
    });
    assert(ok.costType === "bonus", "improved-war-magic: cout attendu bonus apres sort");
    assert(
      ok.bypassUsageKey === "fighter:war-magic:bonus-attack",
      "improved-war-magic: usageKey inattendu"
    );

    const no = resolveCostContextForFeature({
      feature,
      action,
      usedMainActionCount: 1,
      usedAttackActionCount: 0,
      turnUsageCounts: {},
      ctx: { turnSpellCast: false }
    });
    assert(no.costType === "action", "improved-war-magic: sans sort, cout doit rester action");

    console.log("[OK] improved-war-magic: runtime modifier valide");
  });

  checks.push(() => {
    const feature = featuresById.get("weapon-mastery")!;
    const dualAction = makeAction({
      id: "offhand-test",
      category: "attack",
      costType: "bonus",
      tags: ["offhand-attack", "wm-active:coup-double"]
    });

    const ok = resolveCostContextForFeature({
      feature,
      action: dualAction,
      turnUsageCounts: {},
      ctx: { weaponMasteries: ["coup-double"] }
    });
    assert(ok.costType === "free", "weapon-mastery: coup-double doit bypass le cout bonus");
    assert(
      ok.bypassUsageKey === "mastery:coup-double:bonus-action-bypass",
      "weapon-mastery: usageKey inattendu"
    );
    assert(ok.bypassMaxPerTurn === 1, "weapon-mastery: maxPerTurn attendu 1");

    const noMastery = resolveCostContextForFeature({
      feature,
      action: dualAction,
      turnUsageCounts: {},
      ctx: { weaponMasteries: [] }
    });
    assert(noMastery.costType === "bonus", "weapon-mastery: sans maitrise, cout doit rester bonus");

    const atLimit = resolveCostContextForFeature({
      feature,
      action: dualAction,
      turnUsageCounts: { "mastery:coup-double:bonus-action-bypass": 1 },
      ctx: { weaponMasteries: ["coup-double"] }
    });
    assert(atLimit.costType === "bonus", "weapon-mastery: limite usage atteinte -> cout bonus");

    console.log("[OK] weapon-mastery: runtime modifier dual-wield valide");
  });

  checks.push(() => {
    const feature = featuresById.get("action-surge")!;
    const rules = Array.isArray(feature?.rules?.runtimeEffects) ? feature.rules.runtimeEffects : [];

    const applied = applyRuntimeEffects({
      rules,
      action: makeAction({ id: "action-surge", category: "support", costType: "bonus", tags: [] }),
      playerState: { x: 0, y: 0, movementSpeed: 6, statuses: [] }
    });
    assert(applied.bonusMainActionsDelta === 1, "action-surge: grantMainAction attendu +1");

    const notApplied = applyRuntimeEffects({
      rules,
      action: makeAction({ id: "second-wind", category: "support", costType: "bonus", tags: [] }),
      playerState: { x: 0, y: 0, movementSpeed: 6, statuses: [] }
    });
    assert(notApplied.bonusMainActionsDelta === 0, "action-surge: ne doit pas trigger sur autre action");

    console.log("[OK] action-surge: runtimeEffects apres resolution valides");
  });

  checks.push(() => {
    const feature = featuresById.get("tactical-shift")!;
    const rules = Array.isArray(feature?.rules?.runtimeEffects) ? feature.rules.runtimeEffects : [];

    const applied = applyRuntimeEffects({
      rules,
      action: makeAction({ id: "second-wind", category: "support", costType: "bonus", tags: [] }),
      playerState: { x: 1, y: 1, movementSpeed: 6, statuses: [] }
    });

    assert(applied.movementBudgetDelta === 3, "tactical-shift: mouvement bonus attendu 3 cases (6*0.5)");
    const disengaging = applied.playerState.statuses.find(s => String(s?.id ?? "") === "disengaging");
    assert(Boolean(disengaging), "tactical-shift: statut disengaging attendu");
    assert(Number(disengaging.remainingTurns ?? 0) === 1, "tactical-shift: remainingTurns attendu 1");

    console.log("[OK] tactical-shift: runtimeEffects mouvement + statut valides");
  });

  checks.push(() => {
    const feature = featuresById.get("arcane-charge")!;
    const rules = Array.isArray(feature?.rules?.runtimeEffects) ? feature.rules.runtimeEffects : [];

    const applied = applyRuntimeEffects({
      rules,
      action: makeAction({ id: "action-surge", category: "support", costType: "bonus", tags: [] }),
      playerState: { x: 0, y: 0, movementSpeed: 6, statuses: [] },
      primaryTarget: { x: 4, y: 4 }
    });

    const moved = applied.playerState.x !== 0 || applied.playerState.y !== 0;
    assert(moved, "arcane-charge: teleportation attendue apres action-surge");
    const distTarget = Math.max(
      Math.abs(applied.playerState.x - 4),
      Math.abs(applied.playerState.y - 4)
    );
    assert(distTarget === 1, "arcane-charge: destination adjacente a la cible attendue");

    console.log("[OK] arcane-charge: runtimeEffects teleportation valide");
  });

  checks.push(() => {
    const feature = featuresById.get("eldritch-strike")!;
    const markerRule = Array.isArray(feature?.rules?.runtimeMarkers)
      ? feature.rules.runtimeMarkers[0]
      : null;
    assert(Boolean(markerRule), "eldritch-strike: runtimeMarker manquant");

    const matchesWhen = runtimeRuleMatchesWhen({
      when: markerRule.when ?? {},
      actor: { id: "pj", type: "player" },
      action: makeAction({ id: "melee-strike", category: "attack", costType: "action", tags: [] }),
      weapon: { category: "melee" },
      outcomeKind: "hit",
      ctx: {
        turnActionUsed: false,
        turnAttackActionUsed: false,
        turnSpellCast: false,
        turnCantripCast: false,
        weaponMasteries: []
      }
    });
    assert(matchesWhen, "eldritch-strike: condition when doit matcher sur hit melee non-spell");

    const payload: RuntimeMarkerPayload = {
      version: 1,
      markerId: String(markerRule.id),
      sourceId: "pj",
      lifecycle: "until_end_of_source_next_turn",
      phase: "active",
      effect: {
        resolutionKind: "SAVING_THROW",
        actionTagsAny: ["spell"],
        actionTagsAll: [],
        actionTagsNone: [],
        actorMustMatchSource: true,
        rollMode: "disadvantage",
        consumeOnTrigger: true
      }
    };

    assert(
      runtimeMarkerAppliesToResolution(payload, {
        resolutionKind: "SAVING_THROW",
        actionTags: ["spell"],
        actorId: "pj"
      }),
      "eldritch-strike: le marker doit s'appliquer au prochain JS de sort du meme acteur"
    );

    assert(
      !runtimeMarkerAppliesToResolution(payload, {
        resolutionKind: "SAVING_THROW",
        actionTags: ["spell"],
        actorId: "enemy-1"
      }),
      "eldritch-strike: le marker ne doit pas s'appliquer pour un autre acteur"
    );

    console.log("[OK] eldritch-strike: runtimeMarker valide");
  });

  checks.push(() => {
    const f = featuresById.get("tactical-mastery")!;
    const grant = Array.isArray(f?.grants) ? f.grants.find((g: AnyRecord) => g.kind === "weaponMastery") : null;
    assert(Boolean(grant), "tactical-mastery: grant weaponMastery manquant");
    const ids = Array.isArray(grant?.ids) ? grant.ids.map((id: unknown) => String(id)).sort() : [];
    assert(
      JSON.stringify(ids) === JSON.stringify(["poussee", "ralentissement", "sape"].sort()),
      `tactical-mastery: ids inattendus (${ids.join(",")})`
    );
    console.log("[OK] tactical-mastery: grants weapon mastery valides");
  });

  checks.push(() => {
    const f = featuresById.get("tactical-mind")!;
    const hasTriggers = Array.isArray(f?.rules?.triggers) && f.rules.triggers.length > 0;
    assert(hasTriggers, "tactical-mind: trigger declaratif attendu");
    const runtimeEffects = Array.isArray(f?.rules?.runtimeEffects) ? f.rules.runtimeEffects : [];
    assert(runtimeEffects.length > 0, "tactical-mind: runtimeEffects attendu");
    const retryRule = runtimeEffects.find(
      (entry: AnyRecord) => String(entry?.id ?? "") === "tactical-mind-retry-check"
    );
    assert(Boolean(retryRule), "tactical-mind: regle tactical-mind-retry-check manquante");
    const effects = Array.isArray((retryRule as AnyRecord)?.effects)
      ? ((retryRule as AnyRecord).effects as AnyRecord[])
      : [];
    const retryEffect = effects.find(
      effect => String(effect?.kind ?? "") === "retryAbilityCheckWithResourceBonus"
    );
    assert(Boolean(retryEffect), "tactical-mind: effet retryAbilityCheckWithResourceBonus manquant");
    assert(
      String((retryEffect as AnyRecord)?.resourceName ?? "") === "second-wind",
      "tactical-mind: resourceName attendu second-wind"
    );
    assert(
      Number((retryEffect as AnyRecord)?.resourceAmount ?? 0) === 1,
      "tactical-mind: resourceAmount attendu 1"
    );
    assert(
      String((retryEffect as AnyRecord)?.bonusFormula ?? "") === "1d10",
      "tactical-mind: bonusFormula attendu 1d10"
    );
    console.log("[OK] tactical-mind: runtime effect data-driven valide");
  });

  checks.push(() => {
    const declarativeOnly = [
      "action-surge-2",
      "indomitable-2",
      "indomitable-3",
      "eldritch-knight-spellcasting"
    ];
    for (const id of declarativeOnly) {
      const f = featuresById.get(id)!;
      const hasExecRules =
        Array.isArray(f?.rules?.modifiers) ||
        Array.isArray(f?.rules?.runtimeEffects) ||
        Array.isArray(f?.rules?.runtimeMarkers);
      assert(!hasExecRules, `${id}: devrait rester declarative-only`);
    }
    console.log("[OK] features declaratives: action-surge-2 / indomitable-2 / indomitable-3 / eldritch-knight-spellcasting");
  });

  let failed = 0;
  for (const run of checks) {
    try {
      run();
    } catch (err) {
      failed += 1;
      console.error("[ERR]", err instanceof Error ? err.message : String(err));
    }
  }

  const total = checks.length;
  if (failed > 0) {
    console.error(`\nEchec: ${failed}/${total} checks ont echoue.`);
    process.exit(1);
  }

  console.log(`\nSucces: ${total}/${total} checks runtime fighter OK.`);
}

main();
