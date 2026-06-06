export function isTauri(): boolean {
  return typeof window !== 'undefined' &&
    typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function';
}

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && !isTauri();
}

// In-memory store keyed by storageKey + itemKey, with TTL support
class MemoryStore {
  private data = new Map<string, { value: any; expiry: number }>();

  get(key: string): any {
    const entry = this.data.get(key);
    if (!entry) return undefined;
    if (entry.expiry > 0 && Date.now() > entry.expiry) {
      this.data.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: any, ttlMs: number = 0) {
    this.data.set(key, { value, expiry: ttlMs > 0 ? Date.now() + ttlMs : 0 });
  }

  delete(key: string) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }
}

const globalStore = new MemoryStore();

// Category cache helpers
const CATEGORY_PREFIX = 'categories:';

export function getCachedCategories(type: string, portalId: string): any[] | undefined {
  if (!isBrowser()) return undefined;
  return globalStore.get(CATEGORY_PREFIX + `${type}:${portalId}`);
}

export function setCachedCategories(type: string, portalId: string, categories: any[], ttlMs: number = 86400000) {
  if (!isBrowser()) return;
  globalStore.set(CATEGORY_PREFIX + `${type}:${portalId}`, categories, ttlMs);
}

export function clearCachedCategories() {
  globalStore.clear();
}

// Favorite cache helpers
const FAVORITE_PREFIX = 'favorites:';
const FAV_CATEGORY_PREFIX = 'favcat:';

export function getCachedFavorites(accountId: string): any[] | undefined {
  if (!isBrowser()) return undefined;
  return globalStore.get(FAVORITE_PREFIX + accountId);
}

export function setCachedFavorites(accountId: string, favorites: any[]) {
  if (!isBrowser()) return;
  globalStore.set(FAVORITE_PREFIX + accountId, favorites, 0);
}

export function getCachedFavoriteCategories(accountId: string, type: string): string[] | undefined {
  if (!isBrowser()) return undefined;
  return globalStore.get(FAV_CATEGORY_PREFIX + `${accountId}:${type}`);
}

export function setCachedFavoriteCategories(accountId: string, type: string, categoryIds: string[]) {
  if (!isBrowser()) return;
  globalStore.set(FAV_CATEGORY_PREFIX + `${accountId}:${type}`, categoryIds, 0);
}

// Recent items cache helpers
const RECENT_PREFIX = 'recent:';

export function getCachedRecentItems(accountId: string, type?: string): any[] | undefined {
  if (!isBrowser()) return undefined;
  return globalStore.get(RECENT_PREFIX + `${accountId}:${type || 'all'}`);
}

export function setCachedRecentItems(accountId: string, items: any[], type?: string) {
  if (!isBrowser()) return;
  globalStore.set(RECENT_PREFIX + `${accountId}:${type || 'all'}`, items, 0);
}
