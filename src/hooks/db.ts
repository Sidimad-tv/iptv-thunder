import Database, { QueryResult } from '@tauri-apps/plugin-sql';
import { appDataDir, join } from '@tauri-apps/api/path';

// =========================
// 🗄️ GLOBAL DB SINGLETON with Write Queue
// =========================

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

// Write queue for serializing DB operations (prevents "database is locked")
let writeQueue: Promise<unknown> = Promise.resolve();

let DB_PATH: string | null = null;
export const CURRENT_SCHEMA_VERSION = 4;

async function getDbPath(): Promise<string> {
  if (!DB_PATH) {
    const appDir = await appDataDir();
    const dbPath = await join(appDir, 'iptv_data.db');
    DB_PATH = `sqlite:${dbPath}`;
  }
  return DB_PATH;
}

/**
 * Queue a write operation with retry logic
 * Prevents "database is locked" by serializing writes
 */
async function queueWrite<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  const execute = async (remainingRetries: number): Promise<T> => {
    try {
      return await fn();
    } catch (error: any) {
      const isLockedError = error?.message?.includes('database is locked') || 
                            error?.message?.includes('busy');
      if (isLockedError && remainingRetries > 0) {
        // Wait with exponential backoff: 50ms, 100ms, 200ms
        const delay = 50 * Math.pow(2, 3 - remainingRetries);
        console.log(`[DB] Database locked, retrying in ${delay}ms... (${remainingRetries} retries left)`);
        await new Promise(r => setTimeout(r, delay));
        return execute(remainingRetries - 1); // Retry locally, don't re-queue
      }
      throw error;
    }
  };

  const promise = writeQueue.then(() => execute(retries)).catch(err => {
    throw err;
  });
  writeQueue = promise.catch(() => {}); // Continue queue even on error
  return promise;
}

/**
 * Transaction helper with automatic queuing (simplified - no explicit BEGIN/COMMIT)
 * SQLite plugin has issues with explicit transactions
 */
export async function withTransaction<T>(
  fn: (db: Database) => Promise<T>
): Promise<T> {
  return queueWrite(async () => {
    const db = await getDB();
    return fn(db);
  });
}

/**
 * Execute SQL with automatic queuing (prevents "database is locked")
 * Use this INSTEAD of db.execute() everywhere
 */
export async function dbExecute(sql: string, params?: unknown[]): Promise<QueryResult> {
  return queueWrite(async () => {
    const db = await getDB();
    return db.execute(sql, params);
  });
}

/**
 * Select SQL - direct access (reads don't block in WAL mode)
 * Use this for SELECT queries
 */
export async function dbSelect<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const db = await getDB();
  return db.select<T[]>(sql, params);
}

/**
 * Get global database instance with unified initialization
 * All modules must use this instead of their own singletons
 */
export async function getDB(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise !== null) return initPromise;

  initPromise = (async () => {
    const dbPath = await getDbPath();
    const db = await Database.load(dbPath);
    
    // Enable WAL mode for better concurrency (reads don't block writes)
    await db.execute('PRAGMA journal_mode = WAL');
    await db.execute('PRAGMA synchronous = NORMAL');
    
    // Run migrations first
    await runMigrations(db);
    
    // Initialize all schemas
    await initChannelsTable(db);
    await initVodTable(db);
    await initSeriesTables(db);
    await initEpgTable(db);
    await initCategoriesTable(db);
    await initFavoritesTable(db);
    await initForeignKeys(db);
    
    dbInstance = db;
    return db;
  })();

  return initPromise;
}

// =========================
// 🔄 SCHEMA MIGRATIONS
// =========================

async function runMigrations(db: Database): Promise<void> {
  // Create schema_version table if not exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `);
  
  // Get current version (default 0)
  const result = await db.select<{version: number}[]>(
    'SELECT version FROM schema_version LIMIT 1'
  );
  const currentVersion = result[0]?.version ?? 0;
  
  // Run migrations in order
  if (currentVersion < 2) {
    await migrateToV2(db);
  }
  
  if (currentVersion < 3) {
    await migrateToV3(db);
  }
  
  if (currentVersion < 4) {
    await migrateToV4(db);
  }
  
  // Update version
  await db.execute('DELETE FROM schema_version');
  await db.execute('INSERT INTO schema_version (version) VALUES (?)', [CURRENT_SCHEMA_VERSION]);
}

async function migrateToV3(db: Database): Promise<void> {
  try {
    const tableInfo = await db.select<{name: string}[]>(`PRAGMA table_info(series)`);
    const columns = new Set(tableInfo.map(c => c.name));

    if (!columns.has('cmd')) {
      await db.execute(`ALTER TABLE series ADD COLUMN cmd TEXT`);
    }
  } catch (e) {
    console.warn('[DB] migrateToV3 skip:', e);
  }
}

async function migrateToV4(_db: Database): Promise<void> {
  // Future migrations placeholder
  try {
    // Add migrations here when needed
  } catch (e) {
    console.warn('[DB] migrateToV4 skip:', e);
  }
}

async function migrateToV2(db: Database): Promise<void> {
  const tables = ['channels', 'vod', 'series', 'epg', 'categories'];

  for (const table of tables) {
    try {
      const tableInfo = await db.select<{name: string}[]>(`PRAGMA table_info(${table})`);
      const columns = new Set(tableInfo.map(c => c.name));

      if (!columns.has('portal_id')) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN portal_id TEXT`);
      }
      if (!columns.has('updated_at')) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN updated_at INTEGER`);
      }
      if (!columns.has('category_id')) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN category_id TEXT`);
      }
    } catch (e) {
      console.warn(`[DB] migrateToV2 skip ${table}:`, e);
    }
  }

  await migrateFavoritesToV2(db);
}

async function migrateFavoritesToV2(db: Database): Promise<void> {
  try {
    const favInfo = await db.select<{name: string}[]>(`PRAGMA table_info(favorites)`);
    if (favInfo.length === 0) return;

    const columns = new Set(favInfo.map(c => c.name));

    if (!columns.has('account_id')) {
      await db.execute(`ALTER TABLE favorites ADD COLUMN account_id TEXT`);
    }
    if (!columns.has('kind')) {
      await db.execute(`ALTER TABLE favorites ADD COLUMN kind TEXT DEFAULT 'item'`);
    }
    if (!columns.has('parent_id')) {
      await db.execute(`ALTER TABLE favorites ADD COLUMN parent_id TEXT`);
    }
    if (!columns.has('extra')) {
      await db.execute(`ALTER TABLE favorites ADD COLUMN extra TEXT`);
    }
  } catch (e) {
    console.warn('[DB] migrateFavoritesToV2 skip:', e);
  }
}

// =========================
// 📺 CHANNELS
// =========================
async function initChannelsTable(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER,
      portal_id TEXT NOT NULL,
      name TEXT NOT NULL,
      stream_url TEXT,
      icon_url TEXT,
      genre_id TEXT,
      genre_name TEXT,
      epg_channel_id TEXT,
      order_num INTEGER DEFAULT 0,
      updated_at INTEGER,
      PRIMARY KEY (id, portal_id)
    )
  `);
  
  // Indexes
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_channels_portal ON channels(portal_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_channels_genre ON channels(portal_id, genre_id)`);
}

// =========================
// 🎬 VOD
// =========================
async function initVodTable(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS vod (
      id INTEGER,
      portal_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      poster_url TEXT,
      poster_local TEXT,
      stream_url TEXT,
      year INTEGER,
      rating REAL,
      duration INTEGER,
      genre TEXT,
      director TEXT,
      actors TEXT,
      category_id TEXT,
      added INTEGER,
      updated_at INTEGER,
      PRIMARY KEY (id, portal_id)
    )
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_vod_portal ON vod(portal_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_vod_genre ON vod(portal_id, genre)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_vod_category ON vod(portal_id, category_id)`);
}

// =========================
// 📺 SERIES
// =========================
async function initSeriesTables(db: Database): Promise<void> {
  // Main series table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS series (
      id INTEGER,
      portal_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      poster_url TEXT,
      year INTEGER,
      rating TEXT,
      genre TEXT,
      category_id TEXT,
      cmd TEXT,
      added INTEGER,
      updated_at INTEGER,
      PRIMARY KEY (id, portal_id)
    )
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_series_portal ON series(portal_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_series_category ON series(portal_id, category_id)`);

  // Seasons
  await db.execute(`
    CREATE TABLE IF NOT EXISTS series_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      series_id INTEGER NOT NULL,
      portal_id TEXT NOT NULL,
      season_number INTEGER NOT NULL,
      name TEXT,
      episode_count INTEGER,
      updated_at INTEGER,
      UNIQUE(series_id, portal_id, season_number)
    )
  `);
  
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_seasons_series ON series_seasons(series_id, portal_id)`);

  // Episodes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS series_episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      series_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      portal_id TEXT NOT NULL,
      episode_number INTEGER NOT NULL,
      name TEXT,
      description TEXT,
      stream_url TEXT,
      container_extension TEXT,
      duration INTEGER,
      updated_at INTEGER,
      UNIQUE(series_id, season_id, portal_id, episode_number)
    )
  `);
  
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_episodes_series ON series_episodes(series_id, portal_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_episodes_season ON series_episodes(season_id)`);
}

// =========================
// 📅 EPG
// =========================
async function initEpgTable(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS epg (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      portal_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      UNIQUE(channel_id, portal_id, start_time)
    )
  `);
  
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_epg_channel ON epg(channel_id, portal_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_epg_time ON epg(start_time, end_time)`);
}

// Enable foreign keys
async function initForeignKeys(db: Database): Promise<void> {
  await db.execute(`PRAGMA foreign_keys = ON`);
}

// =========================
// 📂 CATEGORIES
// =========================
async function initCategoriesTable(db: Database): Promise<void> {
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
}

// =========================
// ❤️ FAVORITES
// =========================
async function initFavoritesTable(db: Database): Promise<void> {
  // Check if table exists and needs migration
  const tableInfo = await db.select<{name: string}[]>(`PRAGMA table_info(favorites)`);
  
  if (tableInfo.length === 0) {
    // Table doesn't exist - create fresh
    await createFavoritesTable(db);
  } else {
    // Table exists - check columns and migrate if needed
    await migrateFavoritesTable(db, tableInfo);
  }
  
  // Drop old tables
  await db.execute(`DROP TABLE IF EXISTS favorite_categories`);
}

async function createFavoritesTable(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      parent_id TEXT,
      name TEXT NOT NULL,
      poster TEXT,
      cmd TEXT,
      season INTEGER,
      episode INTEGER,
      extra TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(account_id, kind, type, item_id)
    )
  `);
  
  // Indexes
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_account ON favorites(account_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_kind ON favorites(kind)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_type ON favorites(type)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_parent ON favorites(parent_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_account_kind ON favorites(account_id, kind)`);
}

async function migrateFavoritesTable(db: Database, tableInfo: {name: string}[]): Promise<void> {
  const columns = new Set(tableInfo.map(c => c.name));

  // Check for required columns
  const requiredColumns = [
    'account_id', 'kind', 'type', 'item_id', 'name', 'created_at'
  ];

  const missingColumns = requiredColumns.filter(col => !columns.has(col));

  if (missingColumns.length > 0) {
    // Drop and recreate (breaking change - data will be lost)
    await db.execute(`DROP TABLE IF EXISTS favorites`);
    await createFavoritesTable(db);
  } else {
    // Table has all required columns - ensure indexes exist
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_account ON favorites(account_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_kind ON favorites(kind)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_type ON favorites(type)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_parent ON favorites(parent_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_account_kind ON favorites(account_id, kind)`);
  }
}

// =========================
// 🛠️ UTILS
// =========================

const DEFAULT_TTL_DAYS = 30; // Keep data for 30 days by default

/**
 * Clean up old data based on TTL (Time To Live)
 * Removes data older than specified days for a given portal
 */
export async function cleanupOldData(portalId: string, days: number = DEFAULT_TTL_DAYS): Promise<void> {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  await queueWrite(async () => {
    const db = await getDB();
    
    // Clean up old data from all tables
    const tables = [
      { name: 'channels', timeCol: 'updated_at' },
      { name: 'vod', timeCol: 'updated_at' },
      { name: 'series', timeCol: 'updated_at' },
      { name: 'epg', timeCol: 'end_time' }, // EPG uses end_time
    ];
    
    for (const table of tables) {
      try {
        const result = await db.execute(
          `DELETE FROM ${table.name} WHERE portal_id = ? AND ${table.timeCol} < ?`,
          [portalId, cutoff]
        );
        // @ts-ignore - rowsAffected may exist
        const deleted = result.rowsAffected || 0;
        if (deleted > 0) {
          console.log(`[DB] Cleaned up ${deleted} old rows from ${table.name} for portal ${portalId}`);
        }
      } catch (e) {
        console.log(`[DB] Cleanup skip ${table.name}:`, e);
      }
    }
  });
}

/**
 * Clean up all stale data across all portals
 * Call this periodically (e.g., on app startup or daily)
 */
export async function cleanupAllStaleData(days: number = DEFAULT_TTL_DAYS): Promise<void> {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  await queueWrite(async () => {
    const db = await getDB();
    let totalDeleted = 0;
    
    const tables = ['channels', 'vod', 'series', 'epg'];
    
    for (const table of tables) {
      try {
        const timeCol = table === 'epg' ? 'end_time' : 'updated_at';
        const result = await db.execute(
          `DELETE FROM ${table} WHERE ${timeCol} < ?`,
          [cutoff]
        );
        // @ts-ignore
        const deleted = result.rowsAffected || 0;
        totalDeleted += deleted;
        if (deleted > 0) {
          console.log(`[DB] Cleaned up ${deleted} old rows from ${table}`);
        }
      } catch (e) {
        console.log(`[DB] Cleanup skip ${table}:`, e);
      }
    }
    
    // Also clean up old EPG data (always remove expired entries)
    try {
      const now = Date.now();
      const epgResult = await db.execute(
        'DELETE FROM epg WHERE end_time < ?',
        [now]
      );
      // @ts-ignore
      const epgDeleted = epgResult.rowsAffected || 0;
      if (epgDeleted > 0) {
        console.log(`[DB] Cleaned up ${epgDeleted} expired EPG entries`);
        totalDeleted += epgDeleted;
      }
    } catch (e) {
      console.log('[DB] EPG cleanup skip:', e);
    }
    
    if (totalDeleted > 0) {
      console.log(`[DB] Total cleaned up: ${totalDeleted} rows`);
      
      // VACUUM to reclaim space after significant deletions
      if (totalDeleted > 1000) {
        await db.execute('VACUUM');
        console.log('[DB] VACUUM completed after cleanup');
      }
    }
  });
}

export async function resetDatabase(): Promise<void> {
  console.log('[DB] Resetting database...');
  
  if (dbInstance) {
    try {
      // VACUUM in background - don't block UI
      dbInstance.execute('VACUUM')
        .then(() => console.log('[DB] VACUUM completed - physical space reclaimed'))
        .catch(() => {/* ignore */});
      
      await dbInstance.close();
    } catch (e) {
      console.warn('[DB] Error closing database:', e);
    }
    dbInstance = null;
    initPromise = null;
  }
  
  await new Promise(resolve => setTimeout(resolve, 100));
  await getDB();
  
  console.log('[DB] Database reset complete');
}
