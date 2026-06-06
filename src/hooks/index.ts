// Unified storage exports for the Modern Tauri 2 Architecture
// Each storage type has a specific purpose - use the right tool for the job

// 🔐 SECURE: Auth tokens, MAC addresses, credentials
// Use for: Passwords, bearer tokens, MAC addresses, any sensitive data
export { secureStorage, useSecureStorage, type SecureAuthData } from './useSecureStorage';

// 🗄️ STRUCTURED: VOD, channels, EPG data
// Use for: Large datasets, searchable content, relational data
export {
  useDatabase,
  // Unified DB access
  getDb, resetDatabase,
  // Channels
  saveChannels, getChannels, getChannelCount, searchChannels,
  // VOD
  saveVod, getVod, getVodCount, searchVod,
  // EPG
  saveEpg, getEpgForChannel, getCurrentEpgForChannel,
  // Cleanup
  clearAllData, clearChannelsForPortal, clearVodForPortal, clearSeriesForPortal,
  // Types
  type Channel, type Vod, type EpgEntry
} from './useDatabase';

// Also export from db.ts directly for low-level access
export {
  withTransaction,
  dbExecute,
  dbSelect,
  cleanupOldData,
  cleanupAllStaleData
} from './db';

// 📁 FILES: Image cache, downloads
// Use for: Binary data, media files, cache that needs file system access
export {
  useImageCache,
  // Core functions
  cacheImage, getCachedImage, getCachedImageData,
  fetchAndCacheImage, getImageUrl, preloadImage,
  clearImageCache, getCacheSize, getCacheStats,
  // Utilities
  rebuildLruFromFs,
} from './useImageCache';

// ⚙️ CONFIG: App settings, preferences
// Use for: User preferences, UI state, configuration
export {
  useSettings,
  getSettings, getSetting, setSetting, setSettings,
  resetSettings, clearSettings,
  type AppSettings
} from './useSettings';

// 🌐 TRANSLATIONS: Internationalization
export { useTranslation } from './useTranslation';

// 📺 TV NAVIGATION: Android TV / D-pad support
export { useTVNavigation } from './tv-navigation/react/useTVNavigation';

// 🧭 TYPED ROUTER: Type-safe routing with discriminated unions
export {
  useTypedRouter,
  type Route,
  type SimpleRoute,
  type ParamRoute,
  isMovieDetails,
  isSeriesDetails,
  getRouteType,
  isRouteType,
} from './useTypedRouter';

// 🧭 APP ROUTER: Backward compatibility alias
export { useAppRouter } from './useAppRouter';

// ❤️ FAVORITES: User favorites (channels, movies, series, categories)
export {
  useFavorites,
  useFavoriteIds,
  useFavoriteCategories,
  // Functions
  loadFavorites, addFavorite, removeFavorite, isFavorite,
  loadFavoriteCategories, loadAllFavoriteCategories,
  addFavoriteCategory, removeFavoriteCategory, toggleFavoriteCategory, isFavoriteCategory,
  initFavoritesTable,
} from './useFavorites';

// 👆 LONG PRESS: Touch-based long press for mobile/Android
export { useLongPress } from './useLongPress';

/**
 * STORAGE ARCHITECTURE GUIDE
 * ==========================
 *
 * STRONGHOLD (secureStorage)
 * ├── Auth tokens (bearer/MAC)
 * ├── Portal credentials
 * └── Any sensitive data
 * ✓ Encrypted, anti-tampering
 *
 * SQLITE (useDatabase)
 * ├── Channels (1000s of rows)
 * ├── VOD movies
 * ├── Series
 * └── EPG data
 * ✓ Fast queries, indexes, relational
 *
 * FILE SYSTEM (useImageCache)
 * ├── Poster images
 * ├── Channel icons
 * └── Thumbnails
 * ✓ Binary storage, native file access
 *
 * STORE (useSettings)
 * ├── UI preferences
 * ├── Player settings
 * └── App configuration
 * ✓ Simple key-value, fast access
 *
 * WHY NOT LOCALSTORAGE?
 * - No encryption (security risk for tokens)
 * - 5MB limit (too small for IPTV data)
 * - Synchronous (blocks UI)
 * - String only (inefficient for binary)
 */
