import {
  coreError,
  type CampaignId,
  type CampaignRepository,
  type JsonObject,
  type Result
} from "../core";
import type {
  AbilityIdV1,
  NarrativeCharacterProjectionV1,
  TacticalCharacterProjectionV1
} from "../bootstrap/character/types";
import {
  projectRelevantMechanicalCharacterContextV1,
  type RelevantMechanicalCharacterContextV1
} from "./skillCheckProposal";

export async function loadActiveMechanicalCharacterContextV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  ability: AbilityIdV1;
  skillId: string | null;
  passiveKind?: "PERCEPTION" | null;
}): Promise<Result<RelevantMechanicalCharacterContextV1 | null>> {
  const events = await input.repository.listEvents(input.campaignId, null, 100);
  if (!events.ok) return events;
  const bootstrap = events.value.find(event => event.eventType === "campaign.bootstrapped");
  if (bootstrap === undefined) return { ok: true, value: null };
  const tacticalRef = bootstrap.aggregateRefs.find(ref => ref.aggregateType === "character.tactical-projection");
  const narrativeRef = bootstrap.aggregateRefs.find(ref => ref.aggregateType === "character.narrative-projection");
  if (tacticalRef === undefined || narrativeRef === undefined) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "narrative.character-projections.missing-bootstrap-refs", {})
    };
  }
  const [tacticalRecord, narrativeRecord] = await Promise.all([
    input.repository.getAggregate(input.campaignId, tacticalRef.aggregateType, tacticalRef.aggregateId),
    input.repository.getAggregate(input.campaignId, narrativeRef.aggregateType, narrativeRef.aggregateId)
  ]);
  if (!tacticalRecord.ok) return tacticalRecord;
  if (!narrativeRecord.ok) return narrativeRecord;
  const tactical = parseTacticalProjection(tacticalRecord.value.payload);
  const narrative = parseNarrativeProjection(narrativeRecord.value.payload);
  if (tactical === null || narrative === null) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "narrative.character-projections.invalid-payload", {})
    };
  }
  try {
    return {
      ok: true,
      value: projectRelevantMechanicalCharacterContextV1({
        tactical,
        narrative,
        ability: input.ability,
        skillId: input.skillId,
        passiveScore: input.passiveKind === "PERCEPTION" ? tactical.passivePerception : null
      })
    };
  } catch (error) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "narrative.character-projections.inconsistent", {
        message: error instanceof Error ? error.message : "unknown projection error"
      })
    };
  }
}

function parseTacticalProjection(payload: JsonObject): TacticalCharacterProjectionV1 | null {
  const value = payload as Partial<TacticalCharacterProjectionV1>;
  const modifiers = value.abilityModifiers;
  if (
    value.schemaVersion !== 1 ||
    typeof value.characterId !== "string" ||
    typeof value.proficiencyBonus !== "number" ||
    typeof value.passivePerception !== "number" ||
    modifiers === undefined ||
    !["FOR", "DEX", "CON", "INT", "SAG", "CHA"].every(key => typeof modifiers[key as AbilityIdV1] === "number")
  ) return null;
  return value as TacticalCharacterProjectionV1;
}

function parseNarrativeProjection(payload: JsonObject): NarrativeCharacterProjectionV1 | null {
  const value = payload as Partial<NarrativeCharacterProjectionV1>;
  if (
    value.schemaVersion !== 1 ||
    typeof value.characterId !== "string" ||
    typeof value.backgroundId !== "string" ||
    value.privateMechanical === undefined ||
    !Array.isArray(value.privateMechanical.skills) ||
    !Array.isArray(value.privateMechanical.expertise)
  ) return null;
  return value as NarrativeCharacterProjectionV1;
}
