import {
  IndexedDbCampaignRepository,
  type IndexedDbFailurePoint,
  type RepositoryClock
} from "../../src/core/index";
import {
  runCampaignCoreContractTests,
  type CampaignCoreContractHarness,
  type CampaignCoreContractRun
} from "../contracts/verify-campaign-core";
import {
  runCampaignBootstrapContractTests,
  type CampaignBootstrapContractHarness,
  type CampaignBootstrapContractRun
} from "../contracts/verify-campaign-bootstrap";
import { runIndexedDbSpecificTests, type IndexedDbSpecificRun } from "./indexeddb-specific";

declare global {
  interface Window {
    indexedDbContractRun: Promise<{
      contracts: CampaignCoreContractRun;
      bootstrap: CampaignBootstrapContractRun;
      specific: IndexedDbSpecificRun;
    }>;
  }
}

const repositories: IndexedDbCampaignRepository[] = [];
const databaseNames = new Set<string>();
const runId = crypto.randomUUID().replaceAll("-", "");

const harness: CampaignCoreContractHarness & CampaignBootstrapContractHarness = {
  name: "indexeddb-chromium",
  async create(options: {
    suffix: string;
    clock: RepositoryClock;
    failureInjector?: (point: string) => void;
  }): Promise<IndexedDbCampaignRepository> {
    const databaseName = `jdr5e-contract-${runId}-${options.suffix}`;
    databaseNames.add(databaseName);
    const repository = await IndexedDbCampaignRepository.open({
      databaseName,
      clock: options.clock,
      failureInjector: options.failureInjector as ((point: IndexedDbFailurePoint) => void) | undefined
    });
    repositories.push(repository);
    return repository;
  },
  async dispose(): Promise<void> {
    repositories.splice(0).forEach(repository => repository.close());
    for (const databaseName of databaseNames) {
      await IndexedDbCampaignRepository.deleteDatabase(databaseName);
    }
    databaseNames.clear();
  }
};

window.indexedDbContractRun = (async () => {
  const contracts = await runCampaignCoreContractTests(harness);
  const bootstrap = await runCampaignBootstrapContractTests(harness);
  const specific = await runIndexedDbSpecificTests();
  const result = { contracts, bootstrap, specific };
  const status = document.querySelector("#status");
  if (status) status.textContent = JSON.stringify(result, null, 2);
  return result;
})();
