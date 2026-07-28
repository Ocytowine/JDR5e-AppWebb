import type {
  CompiledLoreCorpusV1,
  LoreEntityV1,
  LoreFragmentV1,
  LoreKnowledgeLevelV1,
  Sha256Fingerprint
} from "../bootstrap/lore";
import {
  selectLoreInfluencesV1,
  type LoreInfluencePacketV1
} from "./loreInfluenceSelection";

export const NARRATIVE_LORE_BUILD_CATALOG_CONTRACT_V1 = "narrative-lore-build-catalog/1" as const;
export const NARRATIVE_LORE_INFLUENCE_BUDGET_V1 = 16;
export const NARRATIVE_LORE_PLAYER_LEVELS_V1 = ["COMMUN", "LOCAL"] as const satisfies readonly LoreKnowledgeLevelV1[];

export interface NarrativeLoreBuildCatalogSceneV1 {
  schemaVersion: 1;
  entityId: string;
  influencePacket: LoreInfluencePacketV1;
  version: 1;
}

export interface NarrativeLoreBuildCatalogV1 {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_LORE_BUILD_CATALOG_CONTRACT_V1;
  packageId: string;
  packageVersion: number;
  sourceRootFingerprint: Sha256Fingerprint;
  playerKnowledgeLevels: LoreKnowledgeLevelV1[];
  influenceBudget: number;
  entities: LoreEntityV1[];
  fragments: LoreFragmentV1[];
  scenes: NarrativeLoreBuildCatalogSceneV1[];
  sourcePaths: string[];
  diagnostics: string[];
  version: 1;
}

const PLAYABLE_LOCATION_TYPES = new Set(["batiment", "quartier", "ville"]);

export function buildNarrativeLoreBuildCatalogV1(
  corpus: CompiledLoreCorpusV1
): NarrativeLoreBuildCatalogV1 {
  const locationEntities = corpus.entities
    .filter(entity => PLAYABLE_LOCATION_TYPES.has(entity.entityType))
    .sort(compareEntity);
  const scenes = locationEntities.map(entity => {
    const selected = selectLoreInfluencesV1({
      creationType: "PLACE",
      anchorEntityId: entity.entityId,
      entities: corpus.entities,
      fragments: corpus.fragments,
      allowedKnowledgeLevels: NARRATIVE_LORE_PLAYER_LEVELS_V1,
      maximumInfluences: NARRATIVE_LORE_INFLUENCE_BUDGET_V1
    });
    if (!selected.ok) {
      throw new Error(`Lore influence selection failed for ${entity.entityId}: ${selected.issues.join(" | ")}`);
    }
    return {
      schemaVersion: 1 as const,
      entityId: entity.entityId,
      influencePacket: selected.packet,
      version: 1 as const
    };
  });

  const retainedEntityIds = new Set(locationEntities.map(entity => entity.entityId));
  const retainedFragmentIds = new Set<string>();
  for (const scene of scenes) {
    scene.influencePacket.geographicChain.forEach(entityId => retainedEntityIds.add(entityId));
    scene.influencePacket.relatedEntityIds.forEach(entityId => retainedEntityIds.add(entityId));
    scene.influencePacket.influences.forEach(influence => {
      retainedEntityIds.add(influence.entityId);
      retainedFragmentIds.add(influence.fragmentId);
    });
  }
  // A playable location needs all classified fragments so that its adapter can
  // explicitly distinguish visible facts from withheld knowledge.
  for (const fragment of corpus.fragments) {
    if (retainedEntityIds.has(fragment.entityId) && PLAYABLE_LOCATION_TYPES.has(
      corpus.entities.find(entity => entity.entityId === fragment.entityId)?.entityType ?? ""
    )) retainedFragmentIds.add(fragment.fragmentId);
  }

  const entities = corpus.entities.filter(entity => retainedEntityIds.has(entity.entityId)).sort(compareEntity);
  const fragments = corpus.fragments.filter(fragment => retainedFragmentIds.has(fragment.fragmentId)).sort(compareFragment);
  const sourcePaths = [...new Set([
    ...entities.map(entity => entity.provenance.sourcePath),
    ...fragments.map(fragment => fragment.provenance.sourcePath)
  ])].sort();
  return {
    schemaVersion: 1,
    contractVersion: NARRATIVE_LORE_BUILD_CATALOG_CONTRACT_V1,
    packageId: corpus.manifest.packageId,
    packageVersion: corpus.manifest.packageVersion,
    sourceRootFingerprint: corpus.manifest.rootFingerprint,
    playerKnowledgeLevels: [...NARRATIVE_LORE_PLAYER_LEVELS_V1],
    influenceBudget: NARRATIVE_LORE_INFLUENCE_BUDGET_V1,
    entities,
    fragments,
    scenes,
    sourcePaths,
    diagnostics: [...new Set(scenes.flatMap(scene => scene.influencePacket.diagnostics))].sort(),
    version: 1
  };
}

export function assertNarrativeLoreBuildCatalogV1(value: unknown): asserts value is NarrativeLoreBuildCatalogV1 {
  if (!value || typeof value !== "object") throw new Error("Narrative lore build catalog must be an object.");
  const catalog = value as Partial<NarrativeLoreBuildCatalogV1>;
  if (
    catalog.schemaVersion !== 1 ||
    catalog.contractVersion !== NARRATIVE_LORE_BUILD_CATALOG_CONTRACT_V1 ||
    catalog.version !== 1
  ) throw new Error("Unsupported narrative lore build catalog contract.");
  if (!Array.isArray(catalog.entities) || !Array.isArray(catalog.fragments) || !Array.isArray(catalog.scenes)) {
    throw new Error("Narrative lore build catalog collections are missing.");
  }
  if (!Array.isArray(catalog.playerKnowledgeLevels) || catalog.playerKnowledgeLevels.join("|") !== "COMMUN|LOCAL") {
    throw new Error("Narrative lore build catalog player knowledge boundary is invalid.");
  }
  if (catalog.influenceBudget !== NARRATIVE_LORE_INFLUENCE_BUDGET_V1) {
    throw new Error("Narrative lore build catalog influence budget is invalid.");
  }
  if (typeof catalog.sourceRootFingerprint !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(catalog.sourceRootFingerprint)) {
    throw new Error("Narrative lore build catalog source fingerprint is invalid.");
  }
  const entityIds = new Set(catalog.entities.map(entity => entity.entityId));
  const fragmentIds = new Set(catalog.fragments.map(fragment => fragment.fragmentId));
  if (entityIds.size !== catalog.entities.length || fragmentIds.size !== catalog.fragments.length) {
    throw new Error("Narrative lore build catalog identifiers must be unique.");
  }
  for (const scene of catalog.scenes) {
    if (!entityIds.has(scene.entityId) || scene.influencePacket.anchorEntityId !== scene.entityId) {
      throw new Error(`Narrative lore scene ${scene.entityId} has no matching anchor.`);
    }
    if (scene.influencePacket.influences.length > catalog.influenceBudget) {
      throw new Error(`Narrative lore scene ${scene.entityId} exceeds its influence budget.`);
    }
    for (const influence of scene.influencePacket.influences) {
      if (!catalog.playerKnowledgeLevels.includes(influence.knowledgeLevel) || !fragmentIds.has(influence.fragmentId)) {
        throw new Error(`Narrative lore scene ${scene.entityId} crosses its knowledge boundary.`);
      }
    }
  }
}

function compareEntity(left: LoreEntityV1, right: LoreEntityV1): number {
  return left.entityId.localeCompare(right.entityId);
}

function compareFragment(left: LoreFragmentV1, right: LoreFragmentV1): number {
  return left.fragmentId.localeCompare(right.fragmentId);
}
