import { Store } from '@tauri-apps/plugin-store';
import type { SupportedLanguage } from '@/lib/translations';

let storeInstance: Store | null = null;

const STORE_NAME = 'app_settings';

async function getStore(): Promise<Store> {
  storeInstance ??= await Store.load(STORE_NAME);
  return storeInstance;
}

// Settings types
export interface AppSettings {
  // UI settings
  language: SupportedLanguage;
  sidebarCollapsed: boolean;
  channelViewMode: 'grid' | 'list';

  // Player settings
  autoPlay: boolean;
  autoPlayEpisodes: boolean;
  volume: number;
  muted: boolean;
  videoQuality: 'auto' | '1080p' | '720p' | '480p';

  // EPG settings
  epgEnabled: boolean;
  epgDaysToLoad: number;
  externalEpgUrl: string | null;

  // Network settings
  requestTimeout: number;
  maxConcurrentRequests: number;

  // Cache settings
  imageCacheEnabled: boolean;
  imageCacheMaxSize: number; // MB

  // Advanced
  hardwareAcceleration: boolean;
  debugMode: boolean;

  // Content filtering
  hideAdultCategories: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  sidebarCollapsed: false,
  channelViewMode: 'grid',
  autoPlay: true,
  autoPlayEpisodes: true,
  volume: 1,
  muted: false,
  videoQuality: 'auto',
  epgEnabled: true,
  epgDaysToLoad: 3,
  externalEpgUrl: null,
  requestTimeout: 15000,
  maxConcurrentRequests: 5,
  imageCacheEnabled: true,
  imageCacheMaxSize: 500,
  hardwareAcceleration: true,
  debugMode: false,
  hideAdultCategories: false,
};

/**
 * Get all settings
 */
export async function getSettings(): Promise<AppSettings> {
  const store = await getStore();
  const settings: Record<string, unknown> = {};

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const value = await store.get(key);
    settings[key] = value ?? (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[key];
  }

  return settings as unknown as AppSettings;
}

/**
 * Get single setting
 */
export async function getSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K]> {
  const store = await getStore();
  const value = await store.get<AppSettings[K]>(key);
  
  if (value !== undefined && value !== null) {
    return value;
  }

  // Auto-detect language if not set
  if (key === 'language') {
    const browserLang = navigator.language?.toLowerCase() || 'en';
    let detectedLang: SupportedLanguage;
    if (browserLang.startsWith('pl')) {
      detectedLang = 'pl';
    } else if (browserLang.startsWith('cs')) {
      detectedLang = 'cs';
    } else if (browserLang.startsWith('sk')) {
      detectedLang = 'sk';
    } else if (browserLang.startsWith('be')) {
      detectedLang = 'be';
    } else if (browserLang.startsWith('de')) {
      detectedLang = 'de';
    } else {
      detectedLang = 'en';
    }
    await store.set(key, detectedLang);
    await store.save();
    return detectedLang as AppSettings[K];
  }

  return DEFAULT_SETTINGS[key];
}

/**
 * Save single setting
 */
export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  const store = await getStore();
  await store.set(key, value);
  await store.save();
}

/**
 * Save multiple settings
 */
export async function setSettings(settings: Partial<AppSettings>): Promise<void> {
  const store = await getStore();
  for (const [key, value] of Object.entries(settings)) {
    await store.set(key, value);
  }
  await store.save();
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<void> {
  const store = await getStore();
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await store.set(key, value);
  }
  await store.save();
}

/**
 * Clear all settings
 */
export async function clearSettings(): Promise<void> {
  const store = await getStore();
  await store.clear();
  await store.save();
}

// Keywords that indicate adult content (case-insensitive)
const ADULT_KEYWORDS = [
  '18+', 'adult', 'erot', 'porno', 'xxx', 'sex',
  'взросл', 'adulto', 'erotick', 'erotisch',
  'для взрослых', 'для дорослих'
];

/**
 * Check if a category name contains adult content keywords
 */
export function isAdultCategory(categoryName: string): boolean {
  const lowerName = categoryName.toLowerCase();
  return ADULT_KEYWORDS.some(keyword => lowerName.includes(keyword.toLowerCase()));
}

// React hook
export function useSettings() {
  return {
    getSettings,
    getSetting,
    setSetting,
    setSettings,
    resetSettings,
    clearSettings,
    defaults: DEFAULT_SETTINGS,
  };
}
