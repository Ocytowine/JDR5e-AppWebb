import type {
  CharacterAggregatePayloadV1,
  NarrativeCharacterProjectionV1,
  RuleRegistryV1,
  TacticalCharacterProjectionV1
} from "../bootstrap";
import { cloneJson } from "../core";
import type {
  CharacterProgressionCandidateValidationDecisionV1,
  CharacterProgressionCandidateValidatorV1,
  CharacterProgressionChoiceResolutionV1
} from "./characterProgressionAuthority";

export interface CharacterProgressionGrantV1 {
  kind: string;
  ids: string[];
}

export interface CharacterProgressionLevelEntryV1 {
  grants: CharacterProgressionGrantV1[];
  description: string | null;
}

export interface CharacterProgressionClassCatalogEntryV1 {
  id: string;
  label: string;
  hitDie: number;
  subclassLevel: number | null;
  progression: ReadonlyMap<number, CharacterProgressionLevelEntryV1>;
}

export interface CharacterProgressionSubclassCatalogEntryV1 {
  id: string;
  classId: string;
  label: string;
  progression: ReadonlyMap<number, CharacterProgressionLevelEntryV1>;
}

export interface CharacterProgressionCatalogV1 {
  classes: ReadonlyMap<string, CharacterProgressionClassCatalogEntryV1>;
  subclasses: ReadonlyMap<string, CharacterProgressionSubclassCatalogEntryV1>;
  actions: ReadonlySet<string>;
  reactions: ReadonlySet<string>;
  spells: ReadonlySet<string>;
  features: ReadonlySet<string>;
}

type Candidate = {
  characterState: CharacterAggregatePayloadV1;
  tacticalProjection: TacticalCharacterProjectionV1;
  narrativeProjection: NarrativeCharacterProjectionV1;
};

export type CharacterProgressionCandidatePreparationResultV1 =
  | {
      status: "READY";
      reasonCodes: string[];
      ruleDecisionRefs: string[];
      candidate: Candidate;
    }
  | {
      status: "CONTENT_INCOMPLETE";
      reasonCodes: string[];
      ruleDecisionRefs: string[];
      candidate: null;
    };

const RULE_REFS = {
  globalLevel: { ruleId: "core.character.global-level", ruleVersion: 1 },
  proficiencyBonus: { ruleId: "core.character.proficiency-bonus", ruleVersion: 1 },
  maximumHitPoints: { ruleId: "core.character.maximum-hit-points", ruleVersion: 1 }
} as const;

function decision(
  valid: boolean,
  reasonCodes: string[],
  ruleDecisionRefs: string[] = [],
  publicSummary: CharacterProgressionCandidateValidationDecisionV1["publicSummary"] = null
): CharacterProgressionCandidateValidationDecisionV1 {
  return {
    schemaVersion: 1,
    valid,
    reasonCodes: [...new Set(reasonCodes)],
    ruleDecisionRefs: [...new Set(ruleDecisionRefs)],
    publicSummary
  };
}

function selectedClassId(choices: CharacterProgressionChoiceResolutionV1[]): string | null {
  const classChoice = choices.find(choice => choice.kind === "CLASS");
  if (!classChoice || classChoice.selectionRefs.length !== 1) return null;
  const ref = classChoice.selectionRefs[0] ?? "";
  return ref.startsWith("class:") && ref.length > 6 ? ref.slice(6) : null;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sentenceComplement(value: string): string {
  return value.trim().replace(/[.!?]+$/u, "");
}

function lowerInitial(value: string): string {
  return value.length > 0 ? value[0]!.toLocaleLowerCase("fr-FR") + value.slice(1) : value;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = sortedUnique(left);
  const normalizedRight = sortedUnique(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function normalizedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(normalizedJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key =>
      `${JSON.stringify(key)}:${normalizedJson(record[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  return normalizedJson(left) === normalizedJson(right);
}

function sameUnchangedCharacterFields(
  current: CharacterAggregatePayloadV1,
  candidate: CharacterAggregatePayloadV1
): boolean {
  const mutable = new Set([
    "classes",
    "globalLevel",
    "actionIds",
    "reactionIds",
    "spellIds",
    "featureIds",
    "progressionHistory"
  ]);
  const currentRecord = current as unknown as Record<string, unknown>;
  const candidateRecord = candidate as unknown as Record<string, unknown>;
  return Object.keys(currentRecord)
    .filter(key => !mutable.has(key))
    .every(key => sameJson(currentRecord[key], candidateRecord[key]));
}

function grantsForLevel(
  catalog: CharacterProgressionCatalogV1,
  classId: string,
  subclassId: string | null,
  level: number
): { grants: CharacterProgressionGrantV1[]; description: string | null; reasons: string[] } {
  const classEntry = catalog.classes.get(classId);
  if (!classEntry) return { grants: [], description: null, reasons: ["CLASS_CONTENT_MISSING"] };
  const classLevel = classEntry.progression.get(level);
  if (!classLevel) return { grants: [], description: null, reasons: ["CLASS_LEVEL_CONTENT_MISSING"] };
  const reasons: string[] = [];
  const entries = [classLevel];
  if (classEntry.subclassLevel === level && !subclassId) {
    reasons.push("SUBCLASS_CHOICE_REQUIRED");
  }
  if (subclassId) {
    const subclass = catalog.subclasses.get(subclassId);
    if (!subclass || subclass.classId !== classId) reasons.push("SUBCLASS_CONTENT_MISSING");
    else {
      const subclassLevel = subclass.progression.get(level);
      if (subclassLevel) entries.push(subclassLevel);
    }
  }
  return {
    grants: entries.flatMap(entry => entry.grants),
    description: entries.map(entry => entry.description).filter(Boolean).join(" ") || null,
    reasons
  };
}

function validateGrantReferences(
  catalog: CharacterProgressionCatalogV1,
  grants: CharacterProgressionGrantV1[],
  choices: CharacterProgressionChoiceResolutionV1[]
): string[] {
  const reasons: string[] = [];
  const referenceSets: Record<string, ReadonlySet<string>> = {
    action: catalog.actions,
    reaction: catalog.reactions,
    spell: catalog.spells,
    feature: catalog.features
  };
  for (const grant of grants) {
    if (grant.kind === "bonus" && grant.ids.includes("asi-or-feat")) {
      if (!choices.some(choice => choice.kind === "ABILITY_SCORE_OR_FEAT")) {
        reasons.push("ABILITY_SCORE_OR_FEAT_CHOICE_REQUIRED");
      } else {
        reasons.push("ABILITY_SCORE_OR_FEAT_RULES_NOT_IMPLEMENTED");
      }
      continue;
    }
    const references = referenceSets[grant.kind];
    if (!references) {
      reasons.push("PROGRESSION_GRANT_KIND_UNSUPPORTED");
      continue;
    }
    grant.ids.forEach(id => {
      if (!references.has(id)) reasons.push("PROGRESSION_CONTENT_REFERENCE_MISSING");
    });
  }
  return reasons;
}

function expectedIds(
  current: CharacterAggregatePayloadV1,
  grants: CharacterProgressionGrantV1[],
  kind: string
): string[] {
  const currentIds = kind === "action" ? current.actionIds
    : kind === "reaction" ? current.reactionIds
      : kind === "spell" ? current.spellIds
        : current.featureIds;
  return sortedUnique([
    ...currentIds,
    ...grants.filter(grant => grant.kind === kind).flatMap(grant => grant.ids)
  ]);
}

async function validateRules(
  rules: RuleRegistryV1,
  catalog: CharacterProgressionCatalogV1,
  candidate: Candidate
): Promise<{ reasons: string[]; refs: string[] }> {
  const reasons: string[] = [];
  const refs: string[] = [];
  const classInputs = candidate.characterState.classes.map(entry => ({
    classId: entry.classId,
    level: entry.level,
    hitDie: catalog.classes.get(entry.classId)?.hitDie ?? 0
  }));
  if (classInputs.some(entry => entry.hitDie < 1)) {
    return { reasons: ["CLASS_HIT_DIE_CONTENT_MISSING"], refs };
  }
  const global = await rules.execute(RULE_REFS.globalLevel, { classes: classInputs });
  if (!global.ok) reasons.push("GLOBAL_LEVEL_RULE_UNAVAILABLE");
  else {
    refs.push(`${global.value.ruleId}@${global.value.ruleVersion}`);
    if (global.value.output.level !== candidate.characterState.globalLevel
      || global.value.output.level !== candidate.tacticalProjection.level) {
      reasons.push("GLOBAL_LEVEL_RULE_MISMATCH");
    }
  }
  const proficiency = await rules.execute(RULE_REFS.proficiencyBonus, {
    level: candidate.characterState.globalLevel
  });
  if (!proficiency.ok) reasons.push("PROFICIENCY_RULE_UNAVAILABLE");
  else {
    refs.push(`${proficiency.value.ruleId}@${proficiency.value.ruleVersion}`);
    if (proficiency.value.output.proficiencyBonus !== candidate.tacticalProjection.proficiencyBonus) {
      reasons.push("PROFICIENCY_RULE_MISMATCH");
    }
  }
  const constitutionModifier = Math.floor(
    (candidate.characterState.abilityScores.CON - 10) / 2
  );
  const hitPoints = await rules.execute(
    RULE_REFS.maximumHitPoints,
    { classes: classInputs, constitutionModifier },
    classInputs.map(entry => `class:${entry.classId}`)
  );
  if (!hitPoints.ok) reasons.push("MAXIMUM_HIT_POINTS_RULE_UNAVAILABLE");
  else {
    refs.push(`${hitPoints.value.ruleId}@${hitPoints.value.ruleVersion}`);
    if (hitPoints.value.output.maximumHitPoints !== candidate.tacticalProjection.maximumHitPoints) {
      reasons.push("MAXIMUM_HIT_POINTS_RULE_MISMATCH");
    }
  }
  return { reasons, refs };
}

export async function prepareCharacterProgressionCandidateV1(input: {
  catalog: CharacterProgressionCatalogV1;
  rules: RuleRegistryV1;
  currentCharacter: CharacterAggregatePayloadV1;
  currentTacticalProjection: TacticalCharacterProjectionV1;
  currentNarrativeProjection: NarrativeCharacterProjectionV1;
  choices: CharacterProgressionChoiceResolutionV1[];
}): Promise<CharacterProgressionCandidatePreparationResultV1> {
  if (
    input.currentCharacter.rulesetId !== input.rules.manifest.rulesetId
    || input.currentCharacter.rulesetVersion !== input.rules.manifest.rulesetVersion
  ) {
    return {
      status: "CONTENT_INCOMPLETE",
      reasonCodes: ["PINNED_RULESET_MISMATCH"],
      ruleDecisionRefs: [],
      candidate: null
    };
  }
  const classId = selectedClassId(input.choices);
  if (!classId) {
    return {
      status: "CONTENT_INCOMPLETE",
      reasonCodes: ["CLASS_CHOICE_INVALID"],
      ruleDecisionRefs: [],
      candidate: null
    };
  }
  const currentClass = input.currentCharacter.classes.find(entry => entry.classId === classId);
  if (!currentClass) {
    return {
      status: "CONTENT_INCOMPLETE",
      reasonCodes: ["CLASS_CHOICE_NOT_OWNED"],
      ruleDecisionRefs: [],
      candidate: null
    };
  }
  const nextLevel = currentClass.level + 1;
  const progression = grantsForLevel(
    input.catalog,
    classId,
    currentClass.subclassId,
    nextLevel
  );
  const reasons = [
    ...progression.reasons,
    ...validateGrantReferences(input.catalog, progression.grants, input.choices)
  ];
  if (reasons.length > 0) {
    return {
      status: "CONTENT_INCOMPLETE",
      reasonCodes: [...new Set(reasons)],
      ruleDecisionRefs: [],
      candidate: null
    };
  }
  const classes = input.currentCharacter.classes.map(entry => entry.classId === classId
    ? { ...entry, level: nextLevel }
    : cloneJson(entry));
  const classInputs = classes.map(entry => ({
    classId: entry.classId,
    level: entry.level,
    hitDie: input.catalog.classes.get(entry.classId)?.hitDie ?? 0
  }));
  if (classInputs.some(entry => entry.hitDie < 1)) {
    return {
      status: "CONTENT_INCOMPLETE",
      reasonCodes: ["CLASS_HIT_DIE_CONTENT_MISSING"],
      ruleDecisionRefs: [],
      candidate: null
    };
  }
  const global = await input.rules.execute(RULE_REFS.globalLevel, { classes: classInputs });
  if (!global.ok || typeof global.value.output.level !== "number") {
    return {
      status: "CONTENT_INCOMPLETE",
      reasonCodes: ["GLOBAL_LEVEL_RULE_UNAVAILABLE"],
      ruleDecisionRefs: [],
      candidate: null
    };
  }
  const proficiency = await input.rules.execute(RULE_REFS.proficiencyBonus, {
    level: global.value.output.level
  });
  if (!proficiency.ok || typeof proficiency.value.output.proficiencyBonus !== "number") {
    return {
      status: "CONTENT_INCOMPLETE",
      reasonCodes: ["PROFICIENCY_RULE_UNAVAILABLE"],
      ruleDecisionRefs: [`${global.value.ruleId}@${global.value.ruleVersion}`],
      candidate: null
    };
  }
  const constitutionModifier = Math.floor(
    (input.currentCharacter.abilityScores.CON - 10) / 2
  );
  const hitPoints = await input.rules.execute(
    RULE_REFS.maximumHitPoints,
    { classes: classInputs, constitutionModifier },
    classInputs.map(entry => `class:${entry.classId}`)
  );
  if (!hitPoints.ok || typeof hitPoints.value.output.maximumHitPoints !== "number") {
    return {
      status: "CONTENT_INCOMPLETE",
      reasonCodes: ["MAXIMUM_HIT_POINTS_RULE_UNAVAILABLE"],
      ruleDecisionRefs: [
        `${global.value.ruleId}@${global.value.ruleVersion}`,
        `${proficiency.value.ruleId}@${proficiency.value.ruleVersion}`
      ],
      candidate: null
    };
  }
  const actionIds = expectedIds(input.currentCharacter, progression.grants, "action");
  const reactionIds = expectedIds(input.currentCharacter, progression.grants, "reaction");
  const spellIds = expectedIds(input.currentCharacter, progression.grants, "spell");
  const featureIds = expectedIds(input.currentCharacter, progression.grants, "feature");
  const historyEntry = {
    source: `class:${classId}`,
    level: nextLevel,
    grants: sortedUnique(progression.grants.flatMap(grant =>
      grant.ids.map(id => `${grant.kind}:${id}`)
    ))
  };
  const knownProgression = [
    ...(Array.isArray(input.currentNarrativeProjection.knownToPlayer.progression)
      ? input.currentNarrativeProjection.knownToPlayer.progression.filter(value => typeof value === "string")
      : []),
    ...(progression.description ? [progression.description] : [])
  ];
  const candidate: Candidate = {
    characterState: {
      ...cloneJson(input.currentCharacter),
      classes,
      globalLevel: global.value.output.level,
      actionIds,
      reactionIds,
      spellIds,
      featureIds,
      progressionHistory: [
        ...cloneJson(input.currentCharacter.progressionHistory),
        historyEntry
      ]
    },
    tacticalProjection: {
      ...cloneJson(input.currentTacticalProjection),
      level: global.value.output.level,
      proficiencyBonus: proficiency.value.output.proficiencyBonus,
      maximumHitPoints: hitPoints.value.output.maximumHitPoints,
      actionIds,
      reactionIds,
      spellIds
    },
    narrativeProjection: {
      ...cloneJson(input.currentNarrativeProjection),
      knownToPlayer: {
        ...cloneJson(input.currentNarrativeProjection.knownToPlayer),
        progression: knownProgression
      },
      privateMechanical: {
        ...cloneJson(input.currentNarrativeProjection.privateMechanical),
        globalLevel: global.value.output.level,
        featureIds
      }
    }
  };
  return {
    status: "READY",
    reasonCodes: ["CATALOG_CANDIDATE_PREPARED"],
    ruleDecisionRefs: [
      `${global.value.ruleId}@${global.value.ruleVersion}`,
      `${proficiency.value.ruleId}@${proficiency.value.ruleVersion}`,
      `${hitPoints.value.ruleId}@${hitPoints.value.ruleVersion}`,
      `content.class:${classId}:progression@${nextLevel}`
    ],
    candidate
  };
}

export function createCharacterProgressionCatalogValidatorV1(input: {
  catalog: CharacterProgressionCatalogV1;
  rules: RuleRegistryV1;
}): CharacterProgressionCandidateValidatorV1 {
  return {
    validatorRef: "character-progression-catalog-validator:1",
    async validate({
      campaign,
      currentCharacter,
      currentTacticalProjection,
      currentNarrativeProjection,
      choices,
      candidate
    }) {
      if (
        input.rules.manifest.rulesetId !== campaign.dependencies.rulesetId
        || input.rules.manifest.rulesetVersion !== campaign.dependencies.rulesetVersion
      ) {
        return decision(false, ["PINNED_RULESET_MISMATCH"]);
      }
      const classId = selectedClassId(choices);
      if (!classId) return decision(false, ["CLASS_CHOICE_INVALID"]);
      const currentClass = currentCharacter.classes.find(entry => entry.classId === classId);
      const candidateClass = candidate.characterState.classes.find(entry => entry.classId === classId);
      if (!currentClass || !candidateClass || candidateClass.level !== currentClass.level + 1) {
        return decision(false, ["CLASS_LEVEL_INCREMENT_INVALID"]);
      }
      const expectedClasses = currentCharacter.classes.map(entry => entry.classId === classId
        ? { ...entry, level: entry.level + 1 }
        : entry);
      if (!sameJson(expectedClasses, candidate.characterState.classes)) {
        return decision(false, ["CLASS_PROGRESSION_SHAPE_INVALID"]);
      }
      const progression = grantsForLevel(
        input.catalog,
        classId,
        candidateClass.subclassId,
        candidateClass.level
      );
      const reasons = [
        ...progression.reasons,
        ...validateGrantReferences(input.catalog, progression.grants, choices)
      ];
      if (!sameUnchangedCharacterFields(currentCharacter, candidate.characterState)) {
        reasons.push("UNRELATED_CHARACTER_STATE_CHANGED");
      }
      const idFields = [
        ["action", candidate.characterState.actionIds, candidate.tacticalProjection.actionIds],
        ["reaction", candidate.characterState.reactionIds, candidate.tacticalProjection.reactionIds],
        ["spell", candidate.characterState.spellIds, candidate.tacticalProjection.spellIds],
        ["feature", candidate.characterState.featureIds, candidate.characterState.featureIds]
      ] as const;
      idFields.forEach(([kind, characterIds, tacticalIds]) => {
        const expected = expectedIds(currentCharacter, progression.grants, kind);
        if (!sameIds(characterIds, expected)) reasons.push(`${kind.toUpperCase()}_GRANT_MISMATCH`);
        if (kind !== "feature" && !sameIds(tacticalIds, expected)) {
          reasons.push(`${kind.toUpperCase()}_TACTICAL_PROJECTION_MISMATCH`);
        }
      });
      const expectedHistory = [
        ...currentCharacter.progressionHistory,
        {
          source: `class:${classId}`,
          level: candidateClass.level,
          grants: sortedUnique(progression.grants.flatMap(grant =>
            grant.ids.map(id => `${grant.kind}:${id}`)
          ))
        }
      ];
      if (!sameJson(candidate.characterState.progressionHistory, expectedHistory)) {
        reasons.push("PROGRESSION_HISTORY_MISMATCH");
      }
      if (
        candidate.characterState.characterId !== candidate.tacticalProjection.characterId
        || candidate.characterState.characterId !== candidate.narrativeProjection.characterId
        || currentTacticalProjection.characterId !== candidate.tacticalProjection.characterId
        || currentNarrativeProjection.characterId !== candidate.narrativeProjection.characterId
      ) {
        reasons.push("CHARACTER_PROJECTION_ID_MISMATCH");
      }
      const tacticalMutable = new Set([
        "level",
        "proficiencyBonus",
        "maximumHitPoints",
        "actionIds",
        "reactionIds",
        "spellIds"
      ]);
      const currentTacticalRecord = currentTacticalProjection as unknown as Record<string, unknown>;
      const candidateTacticalRecord = candidate.tacticalProjection as unknown as Record<string, unknown>;
      if (!Object.keys(currentTacticalRecord)
        .filter(key => !tacticalMutable.has(key))
        .every(key => sameJson(currentTacticalRecord[key], candidateTacticalRecord[key]))) {
        reasons.push("UNRELATED_TACTICAL_PROJECTION_CHANGED");
      }
      const expectedKnownProgression = [
        ...(Array.isArray(currentNarrativeProjection.knownToPlayer.progression)
          ? currentNarrativeProjection.knownToPlayer.progression.filter(value => typeof value === "string")
          : []),
        ...(progression.description ? [progression.description] : [])
      ];
      const expectedKnownToPlayer = {
        ...currentNarrativeProjection.knownToPlayer,
        progression: expectedKnownProgression
      };
      if (!sameJson(candidate.narrativeProjection.knownToPlayer, expectedKnownToPlayer)) {
        reasons.push("NARRATIVE_KNOWN_PROGRESSION_MISMATCH");
      }
      const mechanical = candidate.narrativeProjection.privateMechanical as {
        globalLevel?: unknown;
        featureIds?: unknown;
      };
      if (
        mechanical.globalLevel !== candidate.characterState.globalLevel
        || !Array.isArray(mechanical.featureIds)
        || !sameIds(mechanical.featureIds.filter(value => typeof value === "string"), candidate.characterState.featureIds)
      ) {
        reasons.push("NARRATIVE_MECHANICAL_PROJECTION_MISMATCH");
      }
      const expectedPrivateMechanical = {
        ...currentNarrativeProjection.privateMechanical,
        globalLevel: candidate.characterState.globalLevel,
        featureIds: sortedUnique(candidate.characterState.featureIds)
      };
      if (!sameJson(candidate.narrativeProjection.privateMechanical, expectedPrivateMechanical)) {
        reasons.push("NARRATIVE_PRIVATE_MECHANICAL_MISMATCH");
      }
      if (
        candidate.narrativeProjection.name !== currentNarrativeProjection.name
        || candidate.narrativeProjection.raceId !== currentNarrativeProjection.raceId
        || candidate.narrativeProjection.backgroundId !== currentNarrativeProjection.backgroundId
        || !sameJson(candidate.narrativeProjection.languages, currentNarrativeProjection.languages)
        || !sameJson(candidate.narrativeProjection.observable, currentNarrativeProjection.observable)
      ) {
        reasons.push("UNRELATED_NARRATIVE_PROJECTION_CHANGED");
      }
      const ruleValidation = await validateRules(input.rules, input.catalog, candidate);
      reasons.push(...ruleValidation.reasons);
      if (reasons.length > 0) return decision(false, reasons, ruleValidation.refs);
      const classEntry = input.catalog.classes.get(classId)!;
      return decision(true, ["CATALOG_AND_RULESET_VALIDATED"], [
        ...ruleValidation.refs,
        `content.class:${classId}:progression@${candidateClass.level}`
      ], {
        schemaVersion: 1,
        characterId: candidate.characterState.characterId,
        characterDisplayName: candidate.characterState.name,
        previousGlobalLevel: currentCharacter.globalLevel,
        newGlobalLevel: candidate.characterState.globalLevel,
        progressionLabel: `${lowerInitial(classEntry.label)} de niveau ${candidateClass.level}`,
        grantedLabels: progression.description ? [sentenceComplement(progression.description)] : []
      });
    }
  };
}
