const DB_NAME = 'iptv-thunder-cache';
const DB_VERSION = 1;
const STORE = 'cache';

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
  ttl: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IDB blocked'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

async function idbGet(key: string): Promise<CacheEntry | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function idbPut(key: string, value: CacheEntry): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

const memCache = new Map<string, CacheEntry>();

export function getCached<T>(entryId: string, kind: string): { data: T; fresh: boolean } | null {
  const key = `${entryId}:${kind}`;
  const entry = memCache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.fetchedAt;
  return { data: entry.data as T, fresh: age < entry.ttl };
}

export async function hydrateFromIdb(entryId: string, kind: string): Promise<void> {
  const key = `${entryId}:${kind}`;
  if (memCache.has(key)) return;
  const entry = await idbGet(key);
  if (entry) memCache.set(key, entry);
}

export async function setCached<T>(entryId: string, kind: string, data: T, ttlMs: number): Promise<void> {
  const key = `${entryId}:${kind}`;
  const entry: CacheEntry = { data, fetchedAt: Date.now(), ttl: ttlMs };
  memCache.set(key, entry);
  await idbPut(key, entry);
}

export function invalidateCache(entryId: string, kind?: string): void {
  const prefix = kind ? `${entryId}:${kind}` : `${entryId}:`;
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) {
      memCache.delete(key);
      idbDelete(key);
    }
  }
}

export async function clearAllCache(): Promise<void> {
  memCache.clear();
  await idbClear();
}

export function getCacheStats(): { entries: number; age: number } {
  const now = Date.now();
  let maxAge = 0;
  for (const entry of memCache.values()) {
    const age = now - entry.fetchedAt;
    if (age > maxAge) maxAge = age;
  }
  return { entries: memCache.size, age: maxAge };
}
