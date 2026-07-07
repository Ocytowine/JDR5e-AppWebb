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
import {
  runTemporalPersistenceTests,
  type TemporalPersistenceHarness,
  type TemporalPersistenceRun
} from "../time/verify-temporal-persistence";

declare global {
  interface Window {
    indexedDbContractRun: Promise<{
      contracts: CampaignCoreContractRun;
      bootstrap: CampaignBootstrapContractRun;
      temporal: TemporalPersistenceRun;
      specific: IndexedDbSpecificRun;
    }>;
  }
}

const repositories: IndexedDbCampaignRepository[] = [];
const databaseNames = new Set<string>();
const runId = crypto.randomUUID().replaceAll("-", "");

const harness: CampaignCoreContractHarness & CampaignBootstrapContractHarness & TemporalPersistenceHarness = {
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
  async reopen(repository, clock): Promise<IndexedDbCampaignRepository> {
    const indexedRepository = repository as IndexedDbCampaignRepository;
    const databaseName = indexedRepository.databaseName;
    indexedRepository.close();
    const reopened = await IndexedDbCampaignRepository.open({ databaseName, clock });
    repositories.push(reopened);
    return reopened;
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
  const temporal = await runTemporalPersistenceTests(harness);
  const specific = await runIndexedDbSpecificTests();
  const result = { contracts, bootstrap, temporal, specific };
  const status = document.querySelector("#status");
  if (status) status.textContent = JSON.stringify(result, null, 2);
  return result;
})();
