import assert from "node:assert/strict";
import {
  createDefaultAiIntentInterpreterConfigV1,
  findUnresolvedCharacterReferenceAmbiguityV1,
  interpretNarrativeInputWithAiV1,
  loadActiveInterpreterCharacterContextV1
} from "../../src/application";
import type {
  AggregateId,
  CampaignId,
  CampaignRepository
} from "../../src/core";

const campaignId = "campaign:character-context" as CampaignId;
const narrativePayload = {
  schemaVersion: 1,
  characterId: "character:aryn",
  name: "Aryn",
  raceId: "humain",
  backgroundId: "garde",
  languages: ["commun", "elfique"],
  observable: {
    physicalDescription: "Une cicatrice au menton.",
    visibleEquipment: [
      { instanceId: "item-instance:aube", itemId: "epee-aube" },
      { instanceId: "item-instance:soir", itemId: "dague-soir" }
    ],
    appearance: {},
    clothingState: "UNKNOWN"
  },
  knownToPlayer: {
    biography: "PUBLIC_BIOGRAPHY_FOR_INTERPRETATION",
    personality: "PUBLIC_PERSONALITY_FOR_INTERPRETATION",
    objectives: "PUBLIC_OBJECTIVE_FOR_INTERPRETATION",
    flaws: "PUBLIC_FLAW_FOR_INTERPRETATION",
    unclassifiedPrivateMemory: "SECRET_UNCLASSIFIED_KNOWN_TO_PLAYER_MUST_NOT_LEAK"
  },
  privateMechanical: {
    abilityScores: { FOR: 20 },
    featureIds: ["public-feature", "secret-feature"]
  }
};
const tacticalPayload = {
  schemaVersion: 1,
  characterId: "character:aryn",
  level: 4,
  abilityModifiers: { FOR: 5, DEX: 2, CON: 1, INT: 0, SAG: 3, CHA: 0 },
  proficiencyBonus: 2,
  currentHitPoints: 7,
  maximumHitPoints: 40,
  temporaryHitPoints: 0,
  armorClass: 18,
  passivePerception: 15,
  movementModes: {},
  vision: {},
  actionIds: ["second-wind", "rayon-de-feu"],
  reactionIds: [],
  spellIds: ["rayon-de-feu"],
  resources: {
    secretResource: { current: 1, maximum: 3 }
  },
  equippedItemInstanceIds: ["item-instance:aube", "item-instance:soir"],
  appearance: {}
};
const characterPayload = {
  schemaVersion: 1,
  characterId: "character:aryn",
  inventory: [
    { instanceId: "item-instance:aube", itemId: "epee-aube", quantity: 1, equippedSlot: "main_droite", storedInInstanceId: null },
    { instanceId: "item-instance:soir", itemId: "dague-soir", quantity: 1, equippedSlot: "main_gauche", storedInInstanceId: null },
    { instanceId: "item-instance:potion", itemId: "potion-cachee", quantity: 2, equippedSlot: null, storedInInstanceId: null }
  ],
  privateSecret: "SECRET_CHARACTER_STATE_MUST_NOT_LEAK"
};

function repository(): CampaignRepository {
  return {
    async listEvents() {
      return {
        ok: true,
        value: [{
          eventType: "campaign.bootstrapped",
          aggregateRefs: [
            {
              aggregateType: "character.narrative-projection",
              aggregateId: "aggregate:narrative",
              aggregateRevision: 0
            },
            {
              aggregateType: "character.tactical-projection",
              aggregateId: "aggregate:tactical",
              aggregateRevision: 0
            },
            {
              aggregateType: "character.state",
              aggregateId: "aggregate:private-character-state",
              aggregateRevision: 0
            }
          ]
        }]
      };
    },
    async getAggregate(
      _campaignId: CampaignId,
      aggregateType: string,
      aggregateId: AggregateId
    ) {
      const payload =
        aggregateType === "campaign.active-character-profile"
          ? {
              schemaVersion: 1,
              narrativeProjectionAggregateId: "aggregate:narrative",
              tacticalProjectionAggregateId: "aggregate:tactical",
              characterStateAggregateId: "aggregate:private-character-state"
            }
          : aggregateType === "character.narrative-projection"
            ? narrativePayload
            : aggregateType === "character.state"
              ? characterPayload
              : tacticalPayload;
      return {
        ok: true,
        value: {
          schemaVersion: 1,
          campaignId,
          aggregateType,
          aggregateId,
          aggregateRevision: 0,
          payloadSchemaVersion: 1,
          payload,
          updatedByCommitId: "commit:bootstrap"
        }
      };
    }
  } as unknown as CampaignRepository;
}

async function run(): Promise<void> {
  const loaded = await loadActiveInterpreterCharacterContextV1({
    repository: repository(),
    campaignId,
    catalog: {
      languages: [
        { id: "commun", label: "Commun" },
        { id: "elfique", label: "Elfique" }
      ],
      actions: [
        { id: "second-wind", label: "Second souffle" }
      ],
      spells: [
        { id: "rayon-de-feu", label: "Rayon de feu" }
      ],
      features: [
        { id: "public-feature", label: "Instinct du veilleur" }
      ],
      items: [
        {
          id: "epee-aube",
          label: "Épée de l'aube",
          aliases: ["lame"]
        },
        {
          id: "dague-soir",
          label: "Épée du soir",
          aliases: ["lame"]
        },
        {
          id: "potion-cachee",
          label: "Potion cachée",
          aliases: ["rouge"]
        }
      ]
    }
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.value === null) {
    throw new Error("character context should be available");
  }
  const context = loaded.value;
  assert.equal(context.authority, "INTERPRETATION_ONLY");
  assert.equal(context.contractVersion, "interpreter-character-context/2");
  assert.equal(context.ownerValidationRequired, true);
  assert.equal(context.character.label, "Aryn");
  assert.deepEqual(
    context.references
      .filter(reference => reference.kind === "LANGUAGE")
      .map(reference => reference.label),
    ["Commun", "Elfique"]
  );
  assert.equal(
    context.references.some(reference =>
      reference.kind === "ACTION"
      && reference.label === "Second souffle"
    ),
    true
  );
  assert.equal(
    context.references.some(reference =>
      reference.kind === "FEATURE"
      && reference.label === "Instinct du veilleur"
    ),
    true
  );
  assert.equal(context.embodiedProfile?.selfNarrative.biography, "PUBLIC_BIOGRAPHY_FOR_INTERPRETATION");
  assert.equal(context.embodiedProfile?.selfNarrative.personality, "PUBLIC_PERSONALITY_FOR_INTERPRETATION");
  assert.equal(context.embodiedProfile?.selfNarrative.objectives, "PUBLIC_OBJECTIVE_FOR_INTERPRETATION");
  assert.equal(context.embodiedProfile?.selfNarrative.flaws, "PUBLIC_FLAW_FOR_INTERPRETATION");
  assert.equal(context.embodiedProfile?.selfNarrative.physicalDescription, "Une cicatrice au menton.");
  assert.equal(
    context.references.some(reference =>
      reference.kind === "SPELL"
      && reference.label === "Rayon de feu"
    ),
    true
  );
  assert.equal(
    context.references.some(reference =>
      reference.label === "Potion cachée"
    ),
    true,
    "un objet possédé doit être projeté pour permettre sa sélection sans donner d'autorité à l'interpréteur"
  );
  const serialized = JSON.stringify(context);
  for (const forbidden of [
    "SECRET_UNCLASSIFIED_KNOWN_TO_PLAYER_MUST_NOT_LEAK",
    "secret-feature",
    "secretResource",
    "SECRET_CHARACTER_STATE_MUST_NOT_LEAK",
    "currentHitPoints",
    "maximumHitPoints",
    "armorClass"
  ]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `${forbidden} must be excluded from interpreter context`
    );
  }
  const ambiguity = findUnresolvedCharacterReferenceAmbiguityV1({
    rawInput: "Je prends ma lame.",
    context
  });
  assert.equal(ambiguity?.alias, "lame");
  assert.equal(
    findUnresolvedCharacterReferenceAmbiguityV1({
      rawInput: "Je prends mon épée.",
      context
    })?.alias,
    "epee",
    "a shared significant label word must also be treated as ambiguous"
  );
  assert.equal(
    findUnresolvedCharacterReferenceAmbiguityV1({
      rawInput: "Je prends l'épée de l'aube.",
      context
    }),
    null,
    "a more precise alias must resolve the otherwise ambiguous wording"
  );

  const baseConfig = createDefaultAiIntentInterpreterConfigV1();
  let capturedTask: unknown = null;
  let capturedFingerprint: string | null = null;
  const capturingConfig = {
    ...baseConfig,
    provider: {
      async generate(request: Parameters<
        typeof baseConfig.provider.generate
      >[0]) {
        capturedTask = request.input.task;
        capturedFingerprint = request.contextFingerprint;
        return baseConfig.provider.generate(request);
      }
    }
  };
  const interpreted = await interpretNarrativeInputWithAiV1({
    campaignId,
    operationId: "operation:ambiguous-character-reference",
    intentId: "intent:ambiguous-character-reference",
    rawInput: "Je prends ma lame.",
    characterContext: context,
    config: capturingConfig
  });
  assert.deepEqual(
    (capturedTask as { characterContext?: unknown }).characterContext,
    context
  );
  assert.match(capturedFingerprint ?? "", /^sha256:[a-f0-9]{64}$/u);
  const firstFingerprint = capturedFingerprint;
  await interpretNarrativeInputWithAiV1({
    campaignId,
    operationId: "operation:ambiguous-character-reference",
    intentId: "intent:ambiguous-character-reference",
    rawInput: "Je prends ma lame.",
    characterContext: {
      ...context,
      character: {
        ...context.character,
        label: "Aryn transformé"
      }
    },
    config: capturingConfig
  });
  assert.notEqual(
    capturedFingerprint,
    firstFingerprint,
    "a changed character projection must change the AI context fingerprint"
  );
  assert.equal(interpreted.interpretation.requiresClarification, true);
  assert.equal(
    interpreted.interpretation.referentResolution?.ambiguity,
    "multiple_candidates"
  );
  assert.match(
    interpreted.interpretation.clarificationQuestion ?? "",
    /Épée de l'aube|Épée du soir/u
  );
  assert.equal(interpreted.interpretation.runtimeDecision.noCommit, true);
  assert.equal(interpreted.interpretation.runtimeDecision.noGameTime, true);
  console.log(
    "interpreter-character-context: minimal projection, privacy and ambiguity guard verified"
  );
}

void run();
