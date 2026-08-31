import assert from "node:assert/strict";
import generatedNarrativeLoreCatalog from "../../../src/narration-ui/generated/narrativeLoreCatalog.generated.json";
import type { AiInformationNeedV8 } from "../../src/ai";
import {
  createTargetedLoreInformationReaderV1,
  validateTargetedLoreInformationLookupResultV1,
  type CampaignFactInformationReaderV1,
  type CampaignLoreProjectionReaderV1,
  type TargetedLoreInformationLookupRequestV1
} from "../../src/application";
import {
  assertNarrativeLoreBuildCatalogV1,
  type NarrativeLoreBuildCatalogV1
} from "../../src/context";

async function main(): Promise<void> {
  assertNarrativeLoreBuildCatalogV1(generatedNarrativeLoreCatalog);
  const catalog: NarrativeLoreBuildCatalogV1 = generatedNarrativeLoreCatalog;
  verifyGovernanceFragments(catalog);

  const reader = createTargetedLoreInformationReaderV1({ catalog });
  const direct = await reader.lookup(request({
    lookupId: "j10i2-direct",
    subjectMention: "Lysenthe",
    proposedSubjectRef: "location:lysenthe"
  }));
  assert.deepEqual(direct.resolvedSubjectRefs, ["lore-entity:chateau_tharqual", "lore-entity:lysenthe"]);
  assert.equal(direct.noCommit, true);
  assert.equal(direct.authority, "READ_ONLY_FACT_LOOKUP");
  assert.deepEqual(validateTargetedLoreInformationLookupResultV1(direct), { ok: true });
  assertCandidate(direct.candidates, "/type_gouvernance", /ducat/iu, "LORE_INITIAL");
  assertCandidate(direct.candidates, "/siege_pouvoir", /Chateau Tharqual/iu, "LORE_INITIAL");
  assertCandidate(direct.candidates, "/proprietaire_principal", /Tharque regent de Lysenthe/iu, "LORE_INITIAL");
  assert.ok(direct.sourceRefs.every(ref => /^lore-(?:fact|fragment):/u.test(ref)));

  const contextual = await reader.lookup(request({
    lookupId: "j10i2-contextual",
    subjectMention: "cette ville",
    proposedSubjectRef: null
  }));
  assert.deepEqual(contextual.resolvedSubjectRefs, ["lore-entity:chateau_tharqual", "lore-entity:lysenthe"]);
  assertCandidate(contextual.candidates, "/siege_pouvoir", /Chateau Tharqual/iu, "LORE_INITIAL");
  for (const [index, requestedDimension] of [
    "autorité responsable de la cité",
    "personne à la tête de la ville",
    "gouvernant en exercice",
    "titulaire du pouvoir local"
  ].entries()) {
    const paraphrase = await reader.lookup(request({
      lookupId: `j10i2-paraphrase-${index}`,
      subjectMention: "cette cité",
      proposedSubjectRef: null,
      requestedDimension
    }));
    assertCandidate(paraphrase.candidates, "/proprietaire_principal", /Tharque regent de Lysenthe/iu, "LORE_INITIAL");
  }

  let requestedTargets: Array<{ entityId: string; fieldPath: string }> = [];
  const projectionReader: CampaignLoreProjectionReaderV1 = {
    async listEffectiveProjections(projectionRequest) {
      requestedTargets = projectionRequest.targets;
      return {
        schemaVersion: 1,
        authority: "CampaignFactDomain",
        campaignId: projectionRequest.campaignId,
        campaignRevision: projectionRequest.campaignRevision,
        projections: [{
          schemaVersion: 1,
          projectionId: "j10i2-ruler-replacement",
          entityId: "chateau_tharqual",
          fieldPath: "/proprietaire_principal",
          disposition: "REPLACE",
          replacementText: "Tharque intérimaire de Lysenthe",
          sourceRefs: ["campaign-event:ruler-replaced"],
          campaignRevision: 7,
          version: 1
        }],
        sourceRefs: ["campaign-event:ruler-replaced"],
        version: 1
      };
    }
  };
  const projectedReader = createTargetedLoreInformationReaderV1({ catalog, projectionReader });
  const projected = await projectedReader.lookup(request({
    lookupId: "j10i2-projected",
    subjectMention: "la ville",
    proposedSubjectRef: "location:archives_de_lysenthe"
  }));
  assert.ok(requestedTargets.some(target => target.entityId === "chateau_tharqual" && target.fieldPath === "/proprietaire_principal"));
  assertCandidate(projected.candidates, "/proprietaire_principal", /Tharque intérimaire/iu, "CAMPAIGN_LORE_PROJECTION");
  assert.doesNotMatch(projected.candidates.find(candidate => candidate.property === "/proprietaire_principal")?.value ?? "", /regent/iu);
  assert.ok(projected.sourceRefs.includes("campaign-event:ruler-replaced"));
  assert.deepEqual(validateTargetedLoreInformationLookupResultV1(projected), { ok: true });

  const campaignFactReader: CampaignFactInformationReaderV1 = {
    async listEffectiveFacts() {
      return [{
        schemaVersion: 1,
        factId: "campaign-fact:lysenthe-government-current",
        slotKey: "lore-entity:lysenthe::/type_gouvernance",
        subjectRef: "lore-entity:lysenthe",
        predicate: "/type_gouvernance",
        objectKind: "TEXT",
        objectRef: null,
        objectText: "principauté provisoire",
        cardinality: "SINGLE",
        validFromGameSecond: 0,
        validUntilGameSecond: null,
        assertedCampaignRevision: 1,
        closedAtCampaignRevision: null,
        visibility: "PUBLIC",
        knowledgeLevel: "COMMUN",
        status: "ACTIVE",
        supersedesFactId: null,
        sourceRefs: ["campaign-event:government-reformed"],
        ownerDomain: "CAMPAIGN_FACT",
        validatorDomains: ["WORLD"],
        persistenceDepth: "CAMPAIGN_FACT",
        assertedByOperationId: "operation:government-reformed",
        version: 1
      }];
    }
  };
  const freeFactProjected = await createTargetedLoreInformationReaderV1({ catalog, campaignFactReader }).lookup(request({
    lookupId: "j10i2-free-campaign-fact-priority",
    subjectMention: "Lysenthe",
    proposedSubjectRef: "location:lysenthe",
    requestedDimension: "type de gouvernement actuel",
    requestedAnswerShape: "OPEN"
  }));
  assertCandidate(freeFactProjected.candidates, "/type_gouvernance", /principauté provisoire/iu, "CAMPAIGN_FACT");
  assert.equal(freeFactProjected.candidates.filter(candidate => candidate.property === "/type_gouvernance").length, 1, "free campaign fact must replace the initial lore value for the same slot");

  const archiveFragment = catalog.fragments.find(fragment => fragment.entityId === "archives_de_lysenthe" && fragment.fieldPath === "/fonction_principale");
  assert.ok(archiveFragment);
  const knowledgeLinked = await reader.lookup({
    ...request({
      lookupId: "j10i2-knowledge-ref",
      subjectMention: "les Archives de Lysenthe",
      proposedSubjectRef: "location:archives_de_lysenthe",
      requestedDimension: "organisation quotidienne",
      requestedAnswerShape: "DESCRIPTION",
      selectorSet: "ARCHIVE_FUNCTION"
    }),
    knowledgeRefs: [`lore-fragment:${archiveFragment.fragmentId}`]
  });
  assert.ok(knowledgeLinked.inspectedTargets.some(target => target.fieldPath === "/fonction_principale" && target.selectedBy === "SUBJECT"));
  assertCandidate(knowledgeLinked.candidates, "/fonction_principale", /conservation des actes/iu, "LORE_INITIAL");

  const location = await reader.lookup(request({
    lookupId: "j10i2-location",
    subjectMention: "le Château Tharqual",
    proposedSubjectRef: "location:chateau_tharqual",
    requestedDimension: "emplacement et itinéraire local",
    requestedAnswerShape: "LOCATION",
    selectorSet: "LOCATION"
  }));
  assertCandidate(location.candidates, "/quartier", /Pierre des Sables/iu, "LORE_INITIAL");
  assertCandidate(location.candidates, "/ville", /Lysenthe/iu, "LORE_INITIAL");
  assertCandidate(location.candidates, "/region", /Ylsséa/iu, "LORE_INITIAL");

  const past = await reader.lookup(request({
    lookupId: "j10i2-past",
    subjectMention: "Lysenthe",
    proposedSubjectRef: "location:lysenthe",
    requestedDimension: "ancien dirigeant",
    temporalScope: "PAST"
  }));
  assert.equal(past.candidates.some(candidate => candidate.property === "/proprietaire_principal"), false);
  assert.deepEqual(past.missingDimensions, [
    "lore-property:lysenthe:type_gouvernance",
    "lore-property:lysenthe:siege_pouvoir",
    "lore-property:chateau_tharqual:proprietaire_principal"
  ]);

  await assert.rejects(
    reader.lookup({ ...request({ lookupId: "j10i2-secret-boundary", subjectMention: "Lysenthe", proposedSubjectRef: "location:lysenthe" }), allowedKnowledgeLevels: ["MJ_SECRET"] }),
    /cannot cross the public\/local knowledge boundary/iu
  );

  const archivePacket = catalog.scenes.find(scene => scene.entityId === "archives_de_lysenthe")?.influencePacket;
  assert.ok(archivePacket);
  assert.ok(
    direct.inspectedTargets.some(target => target.entityId === "chateau_tharqual" && target.fieldPath === "/proprietaire_principal"),
    "la recherche ciblée doit suivre la relation de pouvoir sans dépendre du classement du paquet descriptif"
  );

  console.log("targeted-lore-information-lookup/J10-I2: OK (subject, relations, campaign priority, knowledge refs, temporal boundary, no commit)");
}

function request(overrides: {
  lookupId: string;
  subjectMention: string;
  proposedSubjectRef: string | null;
  requestedDimension?: string;
  requestedAnswerShape?: AiInformationNeedV8["requestedAnswerShape"];
  temporalScope?: AiInformationNeedV8["temporalScope"];
  selectorSet?: "GOVERNANCE" | "ARCHIVE_FUNCTION" | "LOCATION";
}): TargetedLoreInformationLookupRequestV1 {
  const selectorSet = overrides.selectorSet ?? "GOVERNANCE";
  const selectors = selectorSet === "ARCHIVE_FUNCTION"
    ? {
        subjectRef: "lore-entity:archives_de_lysenthe",
        properties: ["lore-property:archives_de_lysenthe:fonction_principale"],
        relations: []
      }
    : selectorSet === "LOCATION"
      ? {
          subjectRef: "lore-entity:chateau_tharqual",
          properties: [
            "lore-property:chateau_tharqual:quartier",
            "lore-property:chateau_tharqual:ville",
            "lore-property:chateau_tharqual:region"
          ],
          relations: []
        }
      : {
          subjectRef: "lore-entity:lysenthe",
          properties: [
            "lore-property:lysenthe:type_gouvernance",
            "lore-property:lysenthe:siege_pouvoir",
            "lore-property:chateau_tharqual:proprietaire_principal"
          ],
          relations: ["lore-edge:lysenthe:siege_pouvoir:chateau_tharqual"]
        };
  return {
    schemaVersion: 1 as const,
    lookupId: overrides.lookupId,
    campaignId: "campaign:j10i2",
    campaignRevision: 7,
    anchorEntityId: "archives_de_lysenthe",
    need: {
      schemaVersion: 1 as const,
      contractVersion: "information-need/2" as const,
      subjectMention: overrides.subjectMention,
      proposedSubjectRef: selectors.subjectRef,
      proposedScopeRefs: [selectors.subjectRef],
      proposedPropertyRefs: selectors.properties,
      proposedRelationRefs: selectors.relations,
      completionPropertyRefs: selectors.properties,
      requestedDimension: overrides.requestedDimension ?? "dirigeant actuel",
      temporalScope: overrides.temporalScope ?? "CURRENT",
      requestedAnswerShape: overrides.requestedAnswerShape ?? "IDENTITY",
      sourceComponentId: "component:j10i2"
    },
    knowledgeRefs: [],
    allowedKnowledgeLevels: ["COMMUN", "LOCAL"]
  };
}

function verifyGovernanceFragments(catalog: NarrativeLoreBuildCatalogV1): void {
  const paths = new Set(catalog.facts.map(fragment => `${fragment.entityId}:${fragment.fieldPath}:${fragment.knowledgeLevel}`));
  assert.ok(paths.has("lysenthe:/type_gouvernance:COMMUN"));
  assert.ok(paths.has("lysenthe:/siege_pouvoir:LOCAL"));
  assert.ok(paths.has("chateau_tharqual:/proprietaire_principal:LOCAL"));
}

function assertCandidate(
  candidates: Array<{ property: string; value: string | null; authority: string }>,
  property: string,
  expected: RegExp,
  authority: string
): void {
  const candidate = candidates.find(entry => entry.property === property);
  assert.ok(candidate, `candidate ${property} absent`);
  assert.match(candidate.value ?? "", expected);
  assert.equal(candidate.authority, authority);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
