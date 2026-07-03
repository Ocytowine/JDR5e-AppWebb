export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => {
      // `onabort` is the terminal signal and preserves the transaction error.
    };
  });
}

export async function runTransaction<T>(
  database: IDBDatabase,
  stores: readonly string[],
  mode: IDBTransactionMode,
  body: (transaction: IDBTransaction) => Promise<T>
): Promise<T> {
  const transaction = database.transaction([...stores], mode);
  const completion = transactionComplete(transaction);
  try {
    const value = await body(transaction);
    await completion;
    return value;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already be inactive or aborted.
    }
    try {
      await completion;
    } catch {
      // Preserve the original domain or persistence error.
    }
    throw error;
  }
}

export function openDatabase(
  factory: IDBFactory,
  name: string,
  version: number,
  upgrade: (database: IDBDatabase, transaction: IDBTransaction | null) => void,
  blocked?: () => void
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = () => upgrade(request.result, request.transaction);
    request.onblocked = () => blocked?.();
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
    request.onsuccess = () => resolve(request.result);
  });
}

export function deleteDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("IndexedDB delete failed."));
    request.onblocked = () => reject(new Error("IndexedDB delete is blocked by an open connection."));
  });
}

export function cursorValues<T>(request: IDBRequest<IDBCursorWithValue | null>, limit: number): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const values: T[] = [];
    request.onerror = () => reject(request.error ?? new Error("IndexedDB cursor failed."));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || values.length >= limit) {
        resolve(values);
        return;
      }
      values.push(cursor.value as T);
      cursor.continue();
    };
  });
}

export interface CursorPage<T> {
  values: T[];
  lastKey: IDBValidKey | null;
}

export function cursorPage<T>(
  request: IDBRequest<IDBCursorWithValue | null>,
  limit: number
): Promise<CursorPage<T>> {
  return new Promise<CursorPage<T>>((resolve, reject) => {
    const values: T[] = [];
    let lastKey: IDBValidKey | null = null;
    request.onerror = () => reject(request.error ?? new Error("IndexedDB cursor failed."));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || values.length >= limit) {
        resolve({ values, lastKey });
        return;
      }
      values.push(cursor.value as T);
      lastKey = cursor.key;
      cursor.continue();
    };
  });
}
