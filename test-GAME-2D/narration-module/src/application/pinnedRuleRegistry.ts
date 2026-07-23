import {
  coreError,
  type CampaignId,
  type CampaignRepository,
  type Result
} from "../core";
import {
  createMvpRulesetManifestV1,
  loadRuleRegistryV1,
  MVP_RULE_DEFINITIONS_V1,
  MVP_RULE_EXECUTORS_V1,
  type RuleRegistryV1
} from "../bootstrap/rules";

export async function loadPinnedNarrativeRuleRegistryV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): Promise<Result<RuleRegistryV1 | null>> {
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const dependencies = campaign.value.dependencies;
  if (dependencies.rulesetId !== "rules.jdr5e" || dependencies.rulesetVersion !== 2) {
    return { ok: true, value: null };
  }
  const manifest = await createMvpRulesetManifestV1(
    dependencies.contentPackageId,
    dependencies.contentPackageVersion,
    dependencies.contentPackageVersion,
    dependencies.rulesetVersion
  );
  const loaded = await loadRuleRegistryV1({
    contentPackageId: dependencies.contentPackageId,
    contentPackageVersion: dependencies.contentPackageVersion,
    manifest,
    definitions: MVP_RULE_DEFINITIONS_V1,
    executors: MVP_RULE_EXECUTORS_V1
  });
  if (!loaded.ok) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "narrative.pinned-ruleset.invalid", {
        diagnostics: loaded.diagnostics.map(diagnostic => diagnostic.code)
      })
    };
  }
  return { ok: true, value: loaded.value };
}
