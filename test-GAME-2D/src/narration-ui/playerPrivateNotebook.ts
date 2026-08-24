export const PLAYER_PRIVATE_NOTEBOOK_CONTRACT_V1 = "player-private-notebook/1" as const;
export const PLAYER_PRIVATE_NOTEBOOK_DATABASE_V1 = "jdr5e-player-private-notebook-v1";
export const PLAYER_PRIVATE_NOTEBOOK_STORE_V1 = "notebook_documents";
export const PLAYER_PRIVATE_NOTEBOOK_TITLE_LIMIT_V1 = 80;
export const PLAYER_PRIVATE_NOTEBOOK_TEXT_LIMIT_V1 = 20_000;
export const PLAYER_PRIVATE_NOTEBOOK_TAB_LIMIT_V1 = 20;

export interface PlayerPrivateNotebookScopeV1 {
  campaignId: string;
  characterRef: string;
}

export interface PlayerPrivateNotebookTabV1 {
  schemaVersion: 1;
  tabId: string;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerPrivateNotebookDocumentV1 {
  schemaVersion: 1;
  contractVersion: typeof PLAYER_PRIVATE_NOTEBOOK_CONTRACT_V1;
  scopeKey: string;
  campaignId: string;
  characterRef: string;
  revision: number;
  tabs: PlayerPrivateNotebookTabV1[];
}

export interface PlayerPrivateNotebookRepository {
  read(scope: PlayerPrivateNotebookScopeV1): Promise<PlayerPrivateNotebookDocumentV1>;
  compareAndSwap(input: {
    scope: PlayerPrivateNotebookScopeV1;
    expectedRevision: number;
    next: PlayerPrivateNotebookDocumentV1;
  }): Promise<PlayerPrivateNotebookDocumentV1>;
  close(): void;
}

export type PlayerPrivateNotebookErrorCodeV1 =
  | "INVALID_SCOPE"
  | "INVALID_DOCUMENT"
  | "INVALID_TAB"
  | "STALE_REVISION"
  | "STORAGE_UNAVAILABLE";

export class PlayerPrivateNotebookErrorV1 extends Error {
  constructor(
    readonly code: PlayerPrivateNotebookErrorCodeV1,
    message: string
  ) {
    super(message);
    this.name = "PlayerPrivateNotebookErrorV1";
  }
}

export class PlayerPrivateNotebookServiceV1 {
  constructor(
    private readonly repository: PlayerPrivateNotebookRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = defaultTabId
  ) {}

  read(scope: PlayerPrivateNotebookScopeV1) {
    return this.repository.read(scope);
  }

  createTab(input: {
    scope: PlayerPrivateNotebookScopeV1;
    expectedRevision: number;
    title?: string;
  }) {
    return this.mutate(input.scope, input.expectedRevision, tabs => {
      if (tabs.length >= PLAYER_PRIVATE_NOTEBOOK_TAB_LIMIT_V1) {
        throw new PlayerPrivateNotebookErrorV1("INVALID_DOCUMENT", "Nombre maximal d'intercalaires atteint.");
      }
      const timestamp = this.now().toISOString();
      return [...tabs, {
        schemaVersion: 1,
        tabId: this.createId(),
        title: input.title?.trim() || `Notes ${tabs.length + 1}`,
        text: "",
        createdAt: timestamp,
        updatedAt: timestamp
      }];
    });
  }

  renameTab(input: {
    scope: PlayerPrivateNotebookScopeV1;
    expectedRevision: number;
    tabId: string;
    title: string;
  }) {
    return this.updateTab(input, tab => ({ ...tab, title: input.title.trim() }));
  }

  updateTabText(input: {
    scope: PlayerPrivateNotebookScopeV1;
    expectedRevision: number;
    tabId: string;
    text: string;
  }) {
    return this.updateTab(input, tab => ({ ...tab, text: input.text }));
  }

  reorderTab(input: {
    scope: PlayerPrivateNotebookScopeV1;
    expectedRevision: number;
    tabId: string;
    toIndex: number;
  }) {
    return this.mutate(input.scope, input.expectedRevision, tabs => {
      const fromIndex = tabs.findIndex(tab => tab.tabId === input.tabId);
      if (fromIndex < 0 || !Number.isInteger(input.toIndex) || input.toIndex < 0 || input.toIndex >= tabs.length) {
        throw new PlayerPrivateNotebookErrorV1("INVALID_TAB", "Intercalaire ou position invalide.");
      }
      const next = [...tabs];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(input.toIndex, 0, moved!);
      return next;
    });
  }

  deleteTab(input: {
    scope: PlayerPrivateNotebookScopeV1;
    expectedRevision: number;
    tabId: string;
  }) {
    return this.mutate(input.scope, input.expectedRevision, tabs => {
      if (!tabs.some(tab => tab.tabId === input.tabId)) {
        throw new PlayerPrivateNotebookErrorV1("INVALID_TAB", "Intercalaire introuvable.");
      }
      return tabs.filter(tab => tab.tabId !== input.tabId);
    });
  }

  private updateTab(
    input: {
      scope: PlayerPrivateNotebookScopeV1;
      expectedRevision: number;
      tabId: string;
    },
    update: (tab: PlayerPrivateNotebookTabV1) => PlayerPrivateNotebookTabV1
  ) {
    return this.mutate(input.scope, input.expectedRevision, tabs => {
      if (!tabs.some(tab => tab.tabId === input.tabId)) {
        throw new PlayerPrivateNotebookErrorV1("INVALID_TAB", "Intercalaire introuvable.");
      }
      const updatedAt = this.now().toISOString();
      return tabs.map(tab => tab.tabId === input.tabId
        ? { ...update(tab), updatedAt }
        : tab);
    });
  }

  private async mutate(
    scope: PlayerPrivateNotebookScopeV1,
    expectedRevision: number,
    update: (tabs: PlayerPrivateNotebookTabV1[]) => PlayerPrivateNotebookTabV1[]
  ): Promise<PlayerPrivateNotebookDocumentV1> {
    const current = await this.repository.read(scope);
    if (current.revision !== expectedRevision) {
      throw new PlayerPrivateNotebookErrorV1("STALE_REVISION", "Le carnet a été modifié dans un autre onglet.");
    }
    const next: PlayerPrivateNotebookDocumentV1 = {
      ...current,
      revision: current.revision + 1,
      tabs: update(current.tabs.map(tab => ({ ...tab })))
    };
    validateDocument(next, scope);
    return this.repository.compareAndSwap({ scope, expectedRevision, next });
  }
}

export class MemoryPlayerPrivateNotebookRepositoryV1 implements PlayerPrivateNotebookRepository {
  private readonly documents = new Map<string, PlayerPrivateNotebookDocumentV1>();

  async read(scope: PlayerPrivateNotebookScopeV1): Promise<PlayerPrivateNotebookDocumentV1> {
    const key = notebookScopeKeyV1(scope);
    return clone(this.documents.get(key) ?? emptyDocument(scope));
  }

  async compareAndSwap(input: {
    scope: PlayerPrivateNotebookScopeV1;
    expectedRevision: number;
    next: PlayerPrivateNotebookDocumentV1;
  }): Promise<PlayerPrivateNotebookDocumentV1> {
    validateDocument(input.next, input.scope);
    if (input.next.revision !== input.expectedRevision + 1) {
      throw new PlayerPrivateNotebookErrorV1("INVALID_DOCUMENT", "La révision privée suivante doit être monotone.");
    }
    const key = notebookScopeKeyV1(input.scope);
    const current = this.documents.get(key) ?? emptyDocument(input.scope);
    if (current.revision !== input.expectedRevision) {
      throw new PlayerPrivateNotebookErrorV1("STALE_REVISION", "Révision privée obsolète.");
    }
    const stored = clone(input.next);
    this.documents.set(key, stored);
    return clone(stored);
  }

  close(): void {}
}

export class IndexedDbPlayerPrivateNotebookRepositoryV1 implements PlayerPrivateNotebookRepository {
  private constructor(private readonly database: IDBDatabase) {}

  static async open(options: {
    indexedDB?: IDBFactory;
    databaseName?: string;
  } = {}): Promise<IndexedDbPlayerPrivateNotebookRepositoryV1> {
    const factory = options.indexedDB ?? globalThis.indexedDB;
    if (factory === undefined) {
      throw new PlayerPrivateNotebookErrorV1("STORAGE_UNAVAILABLE", "IndexedDB n'est pas disponible.");
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(options.databaseName ?? PLAYER_PRIVATE_NOTEBOOK_DATABASE_V1, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(PLAYER_PRIVATE_NOTEBOOK_STORE_V1)) {
          request.result.createObjectStore(PLAYER_PRIVATE_NOTEBOOK_STORE_V1, { keyPath: "scopeKey" });
        }
      };
      request.onerror = () => reject(new PlayerPrivateNotebookErrorV1("STORAGE_UNAVAILABLE", "Ouverture du carnet impossible."));
      request.onsuccess = () => resolve(request.result);
    });
    return new IndexedDbPlayerPrivateNotebookRepositoryV1(database);
  }

  async read(scope: PlayerPrivateNotebookScopeV1): Promise<PlayerPrivateNotebookDocumentV1> {
    const key = notebookScopeKeyV1(scope);
    const transaction = this.database.transaction(PLAYER_PRIVATE_NOTEBOOK_STORE_V1, "readonly");
    const stored = await requestValue<PlayerPrivateNotebookDocumentV1 | undefined>(
      transaction.objectStore(PLAYER_PRIVATE_NOTEBOOK_STORE_V1).get(key)
    );
    const document = stored ?? emptyDocument(scope);
    validateDocument(document, scope);
    return clone(document);
  }

  compareAndSwap(input: {
    scope: PlayerPrivateNotebookScopeV1;
    expectedRevision: number;
    next: PlayerPrivateNotebookDocumentV1;
  }): Promise<PlayerPrivateNotebookDocumentV1> {
    validateDocument(input.next, input.scope);
    if (input.next.revision !== input.expectedRevision + 1) {
      return Promise.reject(new PlayerPrivateNotebookErrorV1("INVALID_DOCUMENT", "La révision privée suivante doit être monotone."));
    }
    const key = notebookScopeKeyV1(input.scope);
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(PLAYER_PRIVATE_NOTEBOOK_STORE_V1, "readwrite");
      const store = transaction.objectStore(PLAYER_PRIVATE_NOTEBOOK_STORE_V1);
      let failure: unknown = null;
      const get = store.get(key);
      get.onerror = () => {
        failure = new PlayerPrivateNotebookErrorV1("STORAGE_UNAVAILABLE", "Lecture privée impossible.");
        transaction.abort();
      };
      get.onsuccess = () => {
        const current = get.result as PlayerPrivateNotebookDocumentV1 | undefined;
        if ((current?.revision ?? 0) !== input.expectedRevision) {
          failure = new PlayerPrivateNotebookErrorV1("STALE_REVISION", "Révision privée obsolète.");
          transaction.abort();
          return;
        }
        store.put(clone(input.next));
      };
      transaction.oncomplete = () => resolve(clone(input.next));
      transaction.onabort = () => reject(failure ?? new PlayerPrivateNotebookErrorV1("STORAGE_UNAVAILABLE", "Écriture privée annulée."));
      transaction.onerror = () => {};
    });
  }

  close(): void {
    this.database.close();
  }
}

export function notebookScopeKeyV1(scope: PlayerPrivateNotebookScopeV1): string {
  validateScope(scope);
  return `${encodeURIComponent(scope.campaignId)}::${encodeURIComponent(scope.characterRef)}`;
}

function emptyDocument(scope: PlayerPrivateNotebookScopeV1): PlayerPrivateNotebookDocumentV1 {
  return {
    schemaVersion: 1,
    contractVersion: PLAYER_PRIVATE_NOTEBOOK_CONTRACT_V1,
    scopeKey: notebookScopeKeyV1(scope),
    campaignId: scope.campaignId,
    characterRef: scope.characterRef,
    revision: 0,
    tabs: []
  };
}

function validateScope(scope: PlayerPrivateNotebookScopeV1): void {
  if (![scope.campaignId, scope.characterRef].every(value => typeof value === "string" && value.trim().length > 0 && value.length <= 240)) {
    throw new PlayerPrivateNotebookErrorV1("INVALID_SCOPE", "Portée privée invalide.");
  }
}

function validateDocument(document: PlayerPrivateNotebookDocumentV1, scope: PlayerPrivateNotebookScopeV1): void {
  validateScope(scope);
  if (
    document.schemaVersion !== 1
    || document.contractVersion !== PLAYER_PRIVATE_NOTEBOOK_CONTRACT_V1
    || document.scopeKey !== notebookScopeKeyV1(scope)
    || document.campaignId !== scope.campaignId
    || document.characterRef !== scope.characterRef
    || !Number.isInteger(document.revision)
    || document.revision < 0
    || !Array.isArray(document.tabs)
    || document.tabs.length > PLAYER_PRIVATE_NOTEBOOK_TAB_LIMIT_V1
    || new Set(document.tabs.map(tab => tab.tabId)).size !== document.tabs.length
  ) throw new PlayerPrivateNotebookErrorV1("INVALID_DOCUMENT", "Document privé invalide.");
  for (const tab of document.tabs) {
    if (
      tab.schemaVersion !== 1
      || !tab.tabId.trim()
      || !tab.title.trim()
      || tab.title.length > PLAYER_PRIVATE_NOTEBOOK_TITLE_LIMIT_V1
      || tab.text.length > PLAYER_PRIVATE_NOTEBOOK_TEXT_LIMIT_V1
      || !validDate(tab.createdAt)
      || !validDate(tab.updatedAt)
    ) throw new PlayerPrivateNotebookErrorV1("INVALID_TAB", "Intercalaire privé invalide.");
  }
}

function validDate(value: string): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function defaultTabId(): string {
  return `notebook-tab:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new PlayerPrivateNotebookErrorV1("STORAGE_UNAVAILABLE", "Lecture IndexedDB impossible."));
  });
}
