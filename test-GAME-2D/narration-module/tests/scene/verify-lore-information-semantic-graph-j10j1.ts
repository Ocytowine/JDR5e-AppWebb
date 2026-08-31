import assert from "node:assert/strict";
import generatedNarrativeLoreCatalog from "../../../src/narration-ui/generated/narrativeLoreCatalog.generated.json";
import {
  buildLoreInformationSemanticCatalogV1,
  createTargetedLoreInformationReaderV1,
  edgeRef,
  propertyRef,
  validateTargetedLoreInformationLookupResultV1,
  type TargetedLoreInformationLookupRequestV1
} from "../../src/application";
import {
  assertNarrativeLoreBuildCatalogV1,
  type NarrativeLoreBuildCatalogV1
} from "../../src/context";

async function main(): Promise<void> {
  assertNarrativeLoreBuildCatalogV1(generatedNarrativeLoreCatalog);
  const catalog: NarrativeLoreBuildCatalogV1 = generatedNarrativeLoreCatalog;
  const semantic = buildLoreInformationSemanticCatalogV1({
    catalog,
    anchorEntityId: "archives_de_lysenthe"
  });
  assert.ok(semantic);
  const realmRef = "lore-entity:astryade";
  const titleRef = propertyRef("astryade", "/titre_dirigeant");
  const identityRef = propertyRef("astryade", "/identite_dirigeant");
  const seatEdgeRef = edgeRef("astryade", "siege_pouvoir", "tour_du_primarque");
  const seatOwnerRef = propertyRef("tour_du_primarque", "/proprietaire_principal");
  assert.ok(semantic.subjects.some(subject => subject.ref === realmRef));
  assert.equal(semantic.properties.find(property => property.ref === titleRef)?.availability, "PRESENT");
  assert.equal(semantic.properties.find(property => property.ref === identityRef)?.availability, "DECLARED_MISSING");
  assert.ok(semantic.relations.some(relation => relation.ref === seatEdgeRef));
  assert.equal(JSON.stringify(semantic).includes("Primarque d'Astryade"), false, "le catalogue d'interprétation ne doit exposer aucune valeur factuelle");

  const reader = createTargetedLoreInformationReaderV1({ catalog });
  const directNeed = request({
    lookupId: "j10j1-direct",
    subjectMention: "surface arbitraire sans valeur pour le runtime",
    requestedDimension: "description arbitraire sans valeur pour le runtime",
    proposedSubjectRef: realmRef,
    proposedScopeRefs: [realmRef],
    proposedPropertyRefs: [titleRef],
    completionPropertyRefs: [titleRef, identityRef]
  });
  const direct = await reader.lookup(directNeed);
  assert.deepEqual(validateTargetedLoreInformationLookupResultV1(direct), { ok: true });
  assert.equal(direct.candidates.find(candidate => candidate.property === "/titre_dirigeant")?.value, "Primarque d'Astryade");
  assert.deepEqual(direct.missingDimensions, [identityRef]);
  assert.deepEqual(direct.missingProperties, [{
    propertyRef: identityRef,
    publicLabel: "identité personnelle de la personne qui dirige actuellement cette entité",
    subjectRef: realmRef,
    fieldPath: "/identite_dirigeant",
    knowledgeLevel: "COMMUN",
    creationMode: "IDENTITY",
    identityRolePropertyRef: titleRef
  }]);

  const sameSelectorsDifferentProse = await reader.lookup({
    ...directNeed,
    lookupId: "j10j1-prose-independent",
    need: {
      ...directNeed.need,
      subjectMention: "XYZ 9482",
      requestedDimension: "Q-17 sans correspondance lexicale"
    }
  });
  assert.deepEqual(
    sameSelectorsDifferentProse.candidates.map(candidate => [candidate.subjectRef, candidate.property, candidate.value]),
    direct.candidates.map(candidate => [candidate.subjectRef, candidate.property, candidate.value])
  );
  assert.deepEqual(sameSelectorsDifferentProse.missingDimensions, direct.missingDimensions);

  const traversed = await reader.lookup(request({
    lookupId: "j10j1-edge",
    subjectMention: "opaque",
    requestedDimension: "opaque",
    proposedSubjectRef: realmRef,
    proposedScopeRefs: [realmRef],
    proposedPropertyRefs: [seatOwnerRef],
    proposedRelationRefs: [seatEdgeRef],
    completionPropertyRefs: [seatOwnerRef]
  }));
  assert.equal(traversed.candidates.find(candidate => candidate.property === "/proprietaire_principal")?.value, "Primarque d'Astryade");
  assert.ok(traversed.inspectedTargets.some(target => target.selectedBy === "RELATION"));

  console.log("lore-information-semantic-graph/J10-J1: OK (authored open data, opaque selectors, exact properties, bounded edge traversal, partial result)");
}

function request(input: {
  lookupId: string;
  subjectMention: string;
  requestedDimension: string;
  proposedSubjectRef: string;
  proposedScopeRefs: string[];
  proposedPropertyRefs: string[];
  proposedRelationRefs?: string[];
  completionPropertyRefs: string[];
}): TargetedLoreInformationLookupRequestV1 {
  return {
    schemaVersion: 1,
    lookupId: input.lookupId,
    campaignId: "campaign:j10j1",
    campaignRevision: 1,
    anchorEntityId: "archives_de_lysenthe",
    need: {
      schemaVersion: 1,
      contractVersion: "information-need/2",
      subjectMention: input.subjectMention,
      proposedSubjectRef: input.proposedSubjectRef,
      proposedScopeRefs: input.proposedScopeRefs,
      proposedPropertyRefs: input.proposedPropertyRefs,
      proposedRelationRefs: input.proposedRelationRefs ?? [],
      completionPropertyRefs: input.completionPropertyRefs,
      requestedDimension: input.requestedDimension,
      temporalScope: "CURRENT",
      requestedAnswerShape: "IDENTITY",
      sourceComponentId: "component:j10j1"
    },
    knowledgeRefs: [],
    allowedKnowledgeLevels: ["COMMUN", "LOCAL"]
  };
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
