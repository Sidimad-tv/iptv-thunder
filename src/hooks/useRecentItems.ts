// =========================
// 🕐 RECENT ITEMS HOOK - SQLite Storage
// =========================
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getDB } from './db';
import { createLogger } from '../lib/logger';

export type RecentItemType = 'live' | 'vod' | 'series';

export interface RecentItem {
  id: number;
  account_id: string;
  type: RecentItemType;
  item_id: string;
  name: string;
  poster?: string;
  cmd?: string;
  parent_id?: string;
  season?: number;
  episode?: number;
  extra?: string;
  genre_id?: string;
  viewed_at: number;
}

let isInitializing = false;
let initPromise: Promise<void> | null = null;
let isTableReady = false;

const logger = createLogger('RecentItems');

function useTableReady() {
  const [ready, setReady] = useState(isTableReady);
  useEffect(() => {
    if (isTableReady) return;
    initRecentViewedTable().then(() => setReady(true)).catch(err => logger.error('Error initializing table:', err));
  }, []);
  return ready;
}

export async function initRecentViewedTable(): Promise<void> {
  if (isInitializing && initPromise !== null) {
    return initPromise;
  }

  if (isTableReady) {
    return;
  }

  isInitializing = true;

  initPromise = (async () => {
    try {
      const db = await getDB();

      await db.execute(`
        CREATE TABLE IF NOT EXISTS recently_viewed (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id TEXT NOT NULL,
          type TEXT NOT NULL,
          item_id TEXT NOT NULL,
          name TEXT NOT NULL,
          poster TEXT,
          cmd TEXT,
          parent_id TEXT,
          season INTEGER,
          episode INTEGER,
          extra JSON,
          genre_id TEXT,
          viewed_at INTEGER NOT NULL,
          UNIQUE(account_id, type, item_id)
        )
      `);

      await db.execute(`CREATE INDEX IF NOT EXISTS idx_recent_account ON recently_viewed(account_id)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_recent_type ON recently_viewed(type)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_recent_viewed ON recently_viewed(viewed_at)`);

      // Add genre_id column for existing databases
      await db.execute(`ALTER TABLE recently_viewed ADD COLUMN genre_id TEXT`).catch(() => {
        // Column might already exist, ignore error
      });

      isTableReady = true;
    } catch (error) {
      logger.error('Error initializing table:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
}

export async function loadRecentViewed(accountId: string, type?: RecentItemType, limit: number = 20): Promise<RecentItem[]> {
  try {
    const db = await getDB();
    const params: any[] = [accountId];
    let query: string;

    if (type) {
      query = `SELECT * FROM recently_viewed WHERE id IN (
        SELECT MAX(id) FROM recently_viewed WHERE account_id = ? AND type = ?
        GROUP BY account_id, type, item_id
      ) ORDER BY viewed_at DESC LIMIT ?`;
      params.push(type, limit);
    } else {
      query = `SELECT * FROM recently_viewed WHERE id IN (
        SELECT MAX(id) FROM recently_viewed WHERE account_id = ?
        GROUP BY account_id, type, item_id
      ) ORDER BY viewed_at DESC LIMIT ?`;
      params.push(limit);
    }

    const result = await db.select<RecentItem[]>(query, params);
    return result || [];
  } catch (error) {
    logger.error('Error loading recent viewed:', error);
    return [];
  }
}

export async function addRecentViewed(
  accountId: string,
  type: RecentItemType,
  itemId: string,
  metadata?: { name?: string; poster?: string; cmd?: string; parent_id?: string; season?: number; episode?: number; extra?: any; genre_id?: string }
): Promise<void> {
  try {
    const db = await getDB();
    const now = Date.now();
    const extraJson = metadata?.extra ? JSON.stringify(metadata.extra) : null;
    
    await db.execute(
      `INSERT INTO recently_viewed (account_id, type, item_id, name, poster, cmd, parent_id, season, episode, extra, genre_id, viewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, type, item_id)
       DO UPDATE SET
         name=excluded.name,
         poster=excluded.poster,
         cmd=excluded.cmd,
         parent_id=excluded.parent_id,
         season=excluded.season,
         episode=excluded.episode,
         extra=excluded.extra,
         genre_id=excluded.genre_id,
         viewed_at=excluded.viewed_at`,
      [accountId, type, itemId, metadata?.name || 'Unknown', metadata?.poster || null, metadata?.cmd || null, metadata?.parent_id || null, metadata?.season || null, metadata?.episode || null, extraJson, metadata?.genre_id || null, now]
    );
    
    // Keep only last 100 items per account
    await db.execute(
      `DELETE FROM recently_viewed 
       WHERE account_id = ? AND id NOT IN (
         SELECT id FROM recently_viewed 
         WHERE account_id = ? 
         ORDER BY viewed_at DESC 
         LIMIT 100
       )`,
      [accountId, accountId]
    );

  } catch (error) {
    logger.error('Error adding recent viewed:', error);
    throw error;
  }
}

export async function clearRecentViewed(accountId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.execute(`DELETE FROM recently_viewed WHERE account_id = ?`, [accountId]);
  } catch (error) {
    logger.error('Error clearing recent viewed:', error);
    throw error;
  }
}

export async function removeRecentViewed(accountId: string, type: RecentItemType, itemId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.execute(
      `DELETE FROM recently_viewed WHERE account_id = ? AND type = ? AND item_id = ?`,
      [accountId, type, itemId]
    );
  } catch (error) {
    logger.error('Error removing recent viewed:', error);
    throw error;
  }
}

export function useRecentViewed(accountId: string, type?: RecentItemType, limit: number = 20) {
  const tableReady = useTableReady();

  const queryKey = type ? ['recent-viewed', accountId, type] : ['recent-viewed', accountId];

  const { data: recentItems = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => loadRecentViewed(accountId, type, limit),
    enabled: !!accountId && tableReady,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    recentItems,
    isLoading,
  };
}
