// =========================
// 📂 CATEGORIES HOOK - SQLite Storage (Optimized) v4
// =========================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getDB } from './db';
import { StalkerGenre } from '@/types';

const ONE_DAY = 24 * 60 * 60 * 1000;
const CACHE_TTL = ONE_DAY;

interface CategoryItem {
  id: number;
  type: 'live' | 'vod' | 'series';
  portal_id: string;
  name: string;
  alias: string;
  parent_id: number;
  updated_at: number;
}

// Initialize categories table (now handled centrally in db.ts, kept for compatibility)
async function initCategoriesTable(): Promise<void> {
  try {
    const db = await getDB();

    await db.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER,
        type TEXT NOT NULL,
        portal_id TEXT NOT NULL,
        name TEXT NOT NULL,
        alias TEXT,
        parent_id INTEGER DEFAULT 0,
        updated_at INTEGER,
        PRIMARY KEY (id, type, portal_id)
      )
    `);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_categories_full ON categories(portal_id, type, id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_categories_updated ON categories(updated_at)`);

  } catch (error) {
    console.error('[Categories] Error initializing table:', error);
  }
}

// Load categories from SQLite with portal_id filter and atomic cache TTL
export async function loadCategories(
  type: 'live' | 'vod' | 'series',
  portalId: string,
  maxAge: number = CACHE_TTL
): Promise<StalkerGenre[]> {
  try {
    const db = await getDB();
    const minUpdatedAt = Date.now() - maxAge;
    
    // Load all categories for this portal/type (without TTL filter per-row)
    const result = await db.select<CategoryItem[]>(
      `SELECT * FROM categories 
       WHERE type = ? AND portal_id = ?
       ORDER BY name COLLATE NOCASE`,
      [type, portalId]
    );
    
    if (!result.length) return [];
    
    // Check if entire cache snapshot is fresh (atomic check)
    // If maxAge is 0 (force refresh), treat as stale
    const isFresh = maxAge > 0 && result[0].updated_at > minUpdatedAt;
    if (!isFresh) return [];
    
    return result.map(c => ({
      id: c.id.toString(),
      title: c.name,
      alias: c.alias || c.name.toLowerCase(),
      parent_id: c.parent_id,
    })) || [];
  } catch (error) {
    console.error('[Categories] Error loading categories:', error);
    return [];
  }
}

// Save categories to SQLite with UPSERT (atomic update) and portal_id
const BATCH_SIZE = 100;

export async function saveCategories(
  type: 'live' | 'vod' | 'series',
  portalId: string,
  categories: StalkerGenre[]
): Promise<void> {
  try {
    const db = await getDB();
    const now = Date.now();

    // Pre-filter and validate categories
    const validCategories = categories.filter(cat => {
      if (cat.id === '*') return false; // Skip "All" category (string id, can't save to INTEGER column)
      const id = Number(cat.id);
      if (Number.isNaN(id) || id <= 0) {
        console.warn('[Categories] Skipping invalid category ID:', cat.id, cat.title);
        return false;
      }
      return true;
    });

    if (validCategories.length === 0) {
      console.log('[Categories] No valid categories to save');
      return;
    }

    // Extract valid IDs for cleanup
    const validIds = validCategories.map(cat => Number(cat.id));

    // UPSERT: Insert or update existing categories
    for (let i = 0; i < validCategories.length; i += BATCH_SIZE) {
      const chunk = validCategories.slice(i, i + BATCH_SIZE);

      // Build UPSERT query: INSERT ... ON CONFLICT DO UPDATE
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const query = `
        INSERT INTO categories (id, type, portal_id, name, alias, parent_id, updated_at)
        VALUES ${placeholders}
        ON CONFLICT(id, type, portal_id) DO UPDATE SET
          name = excluded.name,
          alias = excluded.alias,
          parent_id = excluded.parent_id,
          updated_at = excluded.updated_at
      `;

      // Flatten parameters
      const params = chunk.flatMap(cat => {
        const id = Number(cat.id);
        const alias = cat.alias || cat.title?.toLowerCase() || '';
        const parentId = cat.parent_id ?? 0;
        return [id, type, portalId, cat.title || '', alias, parentId, now];
      });

      await db.execute(query, params);
    }

    // Remove categories that no longer exist (diff cleanup)
    const idPlaceholders = validIds.map(() => '?').join(', ');
    await db.execute(
      `DELETE FROM categories
       WHERE portal_id = ? AND type = ?
       AND id NOT IN (${idPlaceholders})`,
      [portalId, type, ...validIds]
    );

    console.log('[Categories] Upserted', validCategories.length, type, 'categories for portal', portalId);
  } catch (error) {
    console.error('[Categories] Error saving categories:', error);
  }
}

// Clear all categories cache (for all types and portals)
export async function clearAllCategoriesCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.execute(`DELETE FROM categories`);
  } catch (error) {
    console.error('[Categories] Error clearing cache:', error);
    throw error;
  }
}

// React Query hook for categories with portal_id support
export function useCategories(
  type: 'live' | 'vod' | 'series',
  portalId: string,
  fetchFn?: () => Promise<StalkerGenre[]>
) {
  const queryClient = useQueryClient();

  // Initialize table
  useEffect(() => {
    initCategoriesTable();
  }, []);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', type, portalId],
    queryFn: async () => {
      if (!portalId) {
        console.warn('[Categories] No portalId provided');
      }

      // Try SQLite first with cache TTL
      const cached = await loadCategories(type, portalId, CACHE_TTL);
      if (cached.length > 0) {
        console.log('[Categories] Loaded from SQLite:', cached.length, type, 'for portal', portalId);
        // Add "All" category for all types (title key 'all' — translated in UI via t('all'))
        const allCategory = { id: '*', title: 'all', alias: 'all', parent_id: 0 };
        return [allCategory, ...cached];
      }

      // If no cache and fetchFn provided, fetch from API
      if (fetchFn) {
        console.log('[Categories] Cache miss, fetching from API...');
        const fresh = await fetchFn();
        await saveCategories(type, portalId, fresh);
        // Add "All" category if not present
        const hasAllCategory = fresh.some(cat => cat.id === '*');
        if (!hasAllCategory) {
          const allCategory = { id: '*', title: 'all', alias: 'all', parent_id: 0 };
          return [allCategory, ...fresh];
        }
        return fresh;
      }
      return [];
    },
    staleTime: CACHE_TTL,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    enabled: !!type && !!portalId,
    retry: 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 5000),
  });

  const refreshMutation = useMutation({
    mutationFn: async (force?: boolean) => {
      if (!fetchFn) throw new Error('No fetch function provided');
      
      // If force, bypass cache with TTL=0
      if (!force) {
        const cached = await loadCategories(type, portalId, CACHE_TTL);
        if (cached.length > 0) return cached;
      }
      
      const fresh = await fetchFn();
      await saveCategories(type, portalId, fresh);
      return fresh;
    },
    onSuccess: (data) => {
      // Single update - setQueryData is enough, no need for invalidateQueries
      queryClient.setQueryData(['categories', type, portalId], data);
    },
  });

  return {
    categories,
    isLoading,
    refresh: (force?: boolean) => refreshMutation.mutate(force),
    isRefreshing: refreshMutation.isPending,
  };
}
