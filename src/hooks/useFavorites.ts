// =========================
// ❤️ FAVORITES HOOK - SQLite Storage
// =========================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { getDB, dbExecute } from './db';
import { createLogger } from '../lib/logger';
import { isBrowser, getCachedFavorites, setCachedFavorites, getCachedFavoriteCategories, setCachedFavoriteCategories } from '@/lib/browserDb';

type FavoriteType = 'live' | 'vod' | 'series';

interface FavoriteItem {
  id: number;
  account_id: string;
  kind: 'item' | 'category';
  type: FavoriteType;
  item_id: string;
  parent_id?: string;
  name: string;
  poster?: string;
  cmd?: string;
  season?: number;
  episode?: number;
  extra?: string;
  created_at: number;
}

// Singleton state
let dbReady = false;
let dbReadyPromise: Promise<void> | null = null;

const logger = createLogger('Favorites');

// Shared hook for table initialization - relies on db.ts getDB() which already initializes all tables
function useTableReady() {
  const [ready, setReady] = useState(dbReady);
  useEffect(() => {
    if (dbReady) return;
    if (isBrowser()) {
      dbReady = true;
      setReady(true);
      return;
    }
    dbReadyPromise ??= getDB().then(() => { dbReady = true; }).catch(err => logger.error('DB init error:', err));
    dbReadyPromise.then(() => setReady(true)).catch(err => logger.error('Error waiting for DB:', err));
  }, []);
  return ready;
}

// Note: getDB is imported from ./db - unified singleton, already initializes favorites table

// Initialize favorites table (kept for backward compatibility, delegates to getDB)
export async function initFavoritesTable(): Promise<void> {
  await getDB();
}

// Load favorites (items only, not categories)
export async function loadFavorites(accountId: string): Promise<FavoriteItem[]> {
  if (isBrowser()) {
    const cached = getCachedFavorites(accountId);
    if (cached) return cached as FavoriteItem[];
  }
  try {
    const db = await getDB();
    const result = await db.select<FavoriteItem[]>(
      "SELECT * FROM favorites WHERE account_id = ? AND kind = 'item' ORDER BY created_at DESC",
      [accountId]
    );
    const items = result || [];
    if (isBrowser()) setCachedFavorites(accountId, items);
    return items;
  } catch (error) {
    logger.error('Error loading favorites:', error);
    return [];
  }
}

// Add/update favorite item (UPSERT)
export async function addFavorite(
  accountId: string,
  type: FavoriteType,
  itemId: string,
  metadata?: { name?: string; poster?: string; cmd?: string; parent_id?: string; season?: number; episode?: number; extra?: any }
): Promise<void> {
  if (isBrowser()) {
    const items = getCachedFavorites(accountId) || [];
    const exists = items.some((f: any) => f.type === type && String(f.item_id).replace(/\.0$/, '') === String(itemId).replace(/\.0$/, ''));
    if (!exists) {
      items.push({
        id: Date.now(),
        account_id: accountId,
        kind: 'item',
        type,
        item_id: itemId,
        parent_id: metadata?.parent_id,
        name: metadata?.name || 'Unknown',
        poster: metadata?.poster,
        cmd: metadata?.cmd,
        season: metadata?.season,
        episode: metadata?.episode,
        extra: metadata?.extra ? JSON.stringify(metadata.extra) : null,
        created_at: Date.now(),
      } as FavoriteItem);
      setCachedFavorites(accountId, items);
    }
    return;
  }
  try {
    const now = Date.now();
    const extraJson = metadata?.extra ? JSON.stringify(metadata.extra) : null;
    await dbExecute(
      `INSERT INTO favorites (account_id, kind, type, item_id, parent_id, name, poster, cmd, season, episode, extra, created_at) 
       VALUES (?, 'item', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, kind, type, item_id)
       DO UPDATE SET
         parent_id=excluded.parent_id,
         name=excluded.name,
         poster=excluded.poster,
         cmd=excluded.cmd,
         season=excluded.season,
         episode=excluded.episode,
         extra=excluded.extra`,
      [accountId, type, itemId, metadata?.parent_id || null, metadata?.name || 'Unknown', metadata?.poster || null, metadata?.cmd || null, metadata?.season || null, metadata?.episode || null, extraJson, now]
    );
  } catch (error) {
    logger.error('Error upserting favorite:', error);
    throw error;
  }
}

// Remove item from favorites
export async function removeFavorite(
  accountId: string,
  type: FavoriteType,
  itemId: string
): Promise<void> {
  if (isBrowser()) {
    const items = getCachedFavorites(accountId) || [];
    const normalized = itemId.replace(/\.0$/, '');
    const filtered = items.filter((f: any) =>
      !(f.type === type && String(f.item_id).replace(/\.0$/, '') === normalized)
    );
    setCachedFavorites(accountId, filtered);
    return;
  }
  try {
    // Normalize: remove .0 suffix for comparison since item_id may be stored with or without it
    const normalizedId = itemId.replace(/\.0$/, '');
    // Delete where item_id matches either format (with or without .0)
    await dbExecute(
      "DELETE FROM favorites WHERE account_id = ? AND kind = 'item' AND type = ? AND item_id IN (?, ?)",
      [accountId, type, normalizedId, `${normalizedId}.0`]
    );
  } catch (error) {
    logger.error('Error removing favorite:', error);
    throw error;
  }
}

// Add item to favorites
export async function addToFavorites(
  accountId: string,
  type: FavoriteType,
  itemId: string,
  metadata?: { name?: string; poster?: string; cmd?: string; parent_id?: string; season?: number; episode?: number; extra?: any }
): Promise<void> {
  await addFavorite(accountId, type, itemId, metadata);
}

// Remove item from favorites
export async function removeFromFavorites(
  accountId: string,
  type: FavoriteType,
  itemId: string
): Promise<void> {
  await removeFavorite(accountId, type, itemId);
}

// Check if item is favorite
export async function isFavorite(
  accountId: string,
  type: FavoriteType,
  itemId: string
): Promise<boolean> {
  if (isBrowser()) {
    const items = getCachedFavorites(accountId) || [];
    const normalized = String(itemId).replace(/\.0$/, '');
    return items.some((f: any) =>
      f.type === type && String(f.item_id).replace(/\.0$/, '') === normalized
    );
  }
  try {
    const db = await getDB();
    const result = await db.select<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM favorites WHERE account_id = ? AND kind = 'item' AND type = ? AND item_id = ?",
      [accountId, type, itemId]
    );
    return result && result.length > 0 && result[0].count > 0;
  } catch (error) {
    logger.error('Error checking favorite:', error);
    return false;
  }
}

// =========================
// FAVORITE CATEGORIES - Unified with favorites table using kind='category'
// =========================

// Load favorite categories
export async function loadFavoriteCategories(
  accountId: string,
  type: FavoriteType
): Promise<string[]> {
  if (isBrowser()) {
    const cached = getCachedFavoriteCategories(accountId, type);
    if (cached) return cached;
  }
  try {
    const db = await getDB();
    const result = await db.select<FavoriteItem[]>(
      "SELECT item_id FROM favorites WHERE account_id = ? AND kind = 'category' AND type = ?",
      [accountId, type]
    );
    const ids = result.map(r => r.item_id);
    if (isBrowser()) setCachedFavoriteCategories(accountId, type, ids);
    return ids;
  } catch (error) {
    logger.error('Error loading favorite categories:', error);
    return [];
  }
}

// Load all favorite categories for account (all types)
export async function loadAllFavoriteCategories(accountId: string): Promise<Record<string, string[]>> {
  if (isBrowser()) {
    const result: Record<string, string[]> = { live: [], vod: [], series: [] };
    for (const t of ['live', 'vod', 'series'] as FavoriteType[]) {
      result[t] = getCachedFavoriteCategories(accountId, t) || [];
    }
    return result;
  }
  try {
    const db = await getDB();
    const result = await db.select<FavoriteItem[]>(
      "SELECT type, item_id FROM favorites WHERE account_id = ? AND kind = 'category'",
      [accountId]
    );
    const grouped: Record<string, string[]> = { live: [], vod: [], series: [] };
    result.forEach(r => {
      if (grouped[r.type]) grouped[r.type].push(r.item_id);
    });
    return grouped;
  } catch (error) {
    logger.error('Error loading all favorite categories:', error);
    return { live: [], vod: [], series: [] };
  }
}

// Add favorite category
export async function addFavoriteCategory(
  accountId: string,
  type: FavoriteType,
  categoryId: string,
  name?: string
): Promise<void> {
  if (isBrowser()) {
    const ids = getCachedFavoriteCategories(accountId, type) || [];
    if (!ids.includes(categoryId)) {
      setCachedFavoriteCategories(accountId, type, [...ids, categoryId]);
    }
    return;
  }
  try {
    const db = await getDB();
    const now = Date.now();
    await db.execute(
      `INSERT INTO favorites (account_id, kind, type, item_id, name, created_at) 
       VALUES (?, 'category', ?, ?, ?, ?)
       ON CONFLICT(account_id, kind, type, item_id)
       DO UPDATE SET name=excluded.name`,
      [accountId, type, categoryId, name || 'Unknown', now]
    );
  } catch (error) {
    logger.error('Error adding favorite category:', error);
    throw error;
  }
}

// Remove favorite category
export async function removeFavoriteCategory(
  accountId: string,
  type: FavoriteType,
  categoryId: string
): Promise<void> {
  if (isBrowser()) {
    const ids = getCachedFavoriteCategories(accountId, type) || [];
    setCachedFavoriteCategories(accountId, type, ids.filter(id => id !== categoryId));
    return;
  }
  try {
    const db = await getDB();
    await db.execute(
      "DELETE FROM favorites WHERE account_id = ? AND kind = 'category' AND type = ? AND item_id = ?",
      [accountId, type, categoryId]
    );
  } catch (error) {
    logger.error('Error removing favorite category:', error);
    throw error;
  }
}

// Toggle favorite category
export async function toggleFavoriteCategory(
  accountId: string,
  type: FavoriteType,
  categoryId: string,
  name?: string
): Promise<boolean> {
  const isFav = await isFavoriteCategory(accountId, type, categoryId);
  if (isFav) {
    await removeFavoriteCategory(accountId, type, categoryId);
    return false;
  } else {
    await addFavoriteCategory(accountId, type, categoryId, name);
    return true;
  }
}

// Check if category is favorite
export async function isFavoriteCategory(
  accountId: string,
  type: FavoriteType,
  categoryId: string
): Promise<boolean> {
  if (isBrowser()) {
    const ids = getCachedFavoriteCategories(accountId, type) || [];
    return ids.includes(categoryId);
  }
  try {
    const db = await getDB();
    const result = await db.select<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM favorites WHERE account_id = ? AND kind = 'category' AND type = ? AND item_id = ?",
      [accountId, type, categoryId]
    );
    return result && result.length > 0 && result[0].count > 0;
  } catch (error) {
    logger.error('Error checking favorite category:', error);
    return false;
  }
}

// React Query hook
export function useFavorites(accountId: string) {
  const queryClient = useQueryClient();
  const tableReady = useTableReady();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites', accountId],
    queryFn: () => loadFavorites(accountId),
    enabled: !!accountId && tableReady,
    staleTime: Infinity,
  });

  // O(1) lookup Set (items only - kind='item')
  const favoriteSet = useMemo(() => {
    return new Set(
      favorites
        .filter(f => f.kind === 'item')
        .map(f => `${f.type}:${f.item_id.replace(/\.0$/, '')}`) // Normalize: remove .0 suffix
    );
  }, [favorites]);

  const isItemFavorite = (type: FavoriteType, itemId: string): boolean => {
    const key = `${type}:${itemId.replace(/\.0$/, '')}`; // Normalize the lookup key too
    return favoriteSet.has(key);
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ type, itemId, isFavorite, metadata }: { 
      type: FavoriteType; 
      itemId: string; 
      isFavorite: boolean; 
      metadata?: { name?: string; poster?: string; cmd?: string; parent_id?: string; season?: number; episode?: number; extra?: any };
    }) => {
      // Pass itemId as-is to database (it may have .0 suffix stored)
      if (isFavorite) {
        await addToFavorites(accountId, type, itemId, metadata);
      } else {
        await removeFromFavorites(accountId, type, itemId);
      }
    },
    // Optimistic update
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['favorites', accountId] });
      const prev = queryClient.getQueryData<FavoriteItem[]>(['favorites', accountId]);
      
      queryClient.setQueryData(['favorites', accountId], (old: FavoriteItem[] = []) => {
        const itemIdStr = String(vars.itemId);
        if (vars.isFavorite) {
          // Check if already exists to avoid duplicates (compare normalized)
          const exists = old.some(f => f.type === vars.type && String(f.item_id).replace(/\.0$/, '') === itemIdStr.replace(/\.0$/, ''));
          if (exists) return old;
          return [...old, {
            id: Date.now(), // temp id
            account_id: accountId,
            kind: 'item',
            type: vars.type,
            item_id: itemIdStr,
            parent_id: vars.metadata?.parent_id,
            name: vars.metadata?.name || 'Unknown',
            poster: vars.metadata?.poster,
            cmd: vars.metadata?.cmd,
            season: vars.metadata?.season,
            episode: vars.metadata?.episode,
            extra: vars.metadata?.extra ? JSON.stringify(vars.metadata.extra) : undefined,
            created_at: Date.now(),
          }];
        } else {
          // Remove matching item (compare normalized)
          return old.filter(f => !(f.type === vars.type && String(f.item_id).replace(/\.0$/, '') === itemIdStr.replace(/\.0$/, '')));
        }
      });
      
      return { prev };
    },
    onError: (error, _vars, context) => {
      logger.error('Toggle mutation error:', error);
      // Revert optimistic update on error
      if (context?.prev) {
        queryClient.setQueryData(['favorites', accountId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', accountId] });
    },
  });

  const toggleItemFavorite = (type: FavoriteType, itemId: string, metadata?: { name?: string; poster?: string; cmd?: string; parent_id?: string; season?: number; episode?: number; extra?: any }) => {
    const currentlyFavorite = isItemFavorite(type, itemId);
    toggleMutation.mutate({ type, itemId, isFavorite: !currentlyFavorite, metadata });
  };

  return {
    favorites: favorites
      .filter(f => f.kind === 'item') // exclude categories
      .filter((f, index, self) => // deduplicate by type+item_id (normalized)
        index === self.findIndex(t => t.type === f.type && t.item_id.replace(/\.0$/, '') === f.item_id.replace(/\.0$/, ''))
      ),
    isLoading,
    isItemFavorite,
    toggleItemFavorite,
    addToFavorites: (type: FavoriteType, itemId: string, metadata?: { name?: string; poster?: string; cmd?: string; parent_id?: string; season?: number; episode?: number; extra?: any }) => {
      toggleMutation.mutate({ type, itemId, isFavorite: true, metadata });
    },
    removeFromFavorites: (type: FavoriteType, itemId: string) => {
      toggleMutation.mutate({ type, itemId, isFavorite: false });
    },
    isPending: toggleMutation.isPending,
  };
}

// Get favorite IDs as array of strings (for compatibility)
export function useFavoriteIds(accountId: string, type: FavoriteType) {
  const { favorites, isLoading } = useFavorites(accountId);
  
  const ids = favorites
    .filter(f => f.type === type)
    .map(f => f.item_id);

  return { ids, isLoading };
}

// =========================
// USE FAVORITE CATEGORIES HOOK
// =========================

export function useFavoriteCategories(accountId: string, type: FavoriteType) {
  const queryClient = useQueryClient();
  const tableReady = useTableReady();

  const { data: categoryIds = [], isLoading } = useQuery({
    queryKey: ['favorite-categories', accountId, type],
    queryFn: () => loadFavoriteCategories(accountId, type),
    enabled: !!accountId && tableReady,
    staleTime: Infinity,
  });

  const toggleCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, name }: { categoryId: string; name?: string }) => {
      return toggleFavoriteCategory(accountId, type, categoryId, name);
    },
    onMutate: async ({ categoryId }) => {
      await queryClient.cancelQueries({ queryKey: ['favorite-categories', accountId, type] });
      const prev = queryClient.getQueryData<string[]>(['favorite-categories', accountId, type]);

      queryClient.setQueryData(['favorite-categories', accountId, type], (old: string[] = []) => {
        if (old.includes(categoryId)) {
          return old.filter(id => id !== categoryId);
        } else {
          return [...old, categoryId];
        }
      });

      return { prev };
    },
    onError: (_, __, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['favorite-categories', accountId, type], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-categories', accountId, type] });
    },
  });

  const toggleCategory = (categoryId: string, name?: string) => {
    toggleCategoryMutation.mutate({ categoryId, name });
  };

  const isCategoryFavorite = (categoryId: string): boolean => {
    return categoryIds.includes(categoryId);
  };

  return {
    categoryIds,
    isLoading,
    isCategoryFavorite,
    toggleCategory,
    isPending: toggleCategoryMutation.isPending,
  };
}
