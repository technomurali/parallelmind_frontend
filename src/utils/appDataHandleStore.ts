type StoredHandleRecord = {
  key: string;
  handle: FileSystemDirectoryHandle;
};

const DB_NAME = "parallelmind" as const;
const DB_VERSION = 1 as const;
const STORE_NAME = "fs-handles" as const;

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
};

const withStore = async <T,>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDb();
  return await new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
      db.close();
    };
  });
};

export const APP_DATA_HANDLE_KEY = "appDataFolder" as const;

export async function saveAppDataDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  await withStore("readwrite", (store) =>
    store.put({ key: APP_DATA_HANDLE_KEY, handle } satisfies StoredHandleRecord)
  );
}

export async function loadAppDataDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const record = await withStore<StoredHandleRecord | undefined>("readonly", (store) =>
      store.get(APP_DATA_HANDLE_KEY)
    );
    const handle = (record as any)?.handle;
    return handle && typeof handle === "object" ? (handle as FileSystemDirectoryHandle) : null;
  } catch {
    return null;
  }
}

export async function clearAppDataDirectoryHandle(): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.delete(APP_DATA_HANDLE_KEY));
  } catch {
    // Ignore.
  }
}

