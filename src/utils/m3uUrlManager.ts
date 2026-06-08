export interface SavedM3uUrl {
  name: string;
  url: string;
}

export const DEFAULT_M3U_URLS: SavedM3uUrl[] = [
  { name: 'Sample TV Playlist', url: 'https://example.com/sample.m3u' },
  { name: 'Free IPTV List', url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { name: 'IPTV Cat', url: 'https://iptvcat.com/playlist.m3u' },
];

const STORAGE_KEY = 'saved-m3u-urls-v1';

export function getSavedM3uUrls(): SavedM3uUrl[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_M3U_URLS];
    const saved: SavedM3uUrl[] = JSON.parse(raw);
    const seen = new Set<string>();
    const merged: SavedM3uUrl[] = [];
    for (const src of [...DEFAULT_M3U_URLS, ...saved]) {
      if (!seen.has(src.url)) {
        seen.add(src.url);
        merged.push(src);
      }
    }
    return merged;
  } catch {
    return [...DEFAULT_M3U_URLS];
  }
}

export function addSavedM3uUrl(name: string, url: string): void {
  const urls = getSavedM3uUrls().filter(s => s.url !== url);
  urls.unshift({ name, url });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(urls.slice(0, 30))); } catch {}
}

export function removeSavedM3uUrl(url: string): void {
  const urls = getSavedM3uUrls().filter(s => s.url !== url);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(urls)); } catch {}
}

export function importSavedM3uUrls(data: string): number {
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return 0;
    let added = 0;
    for (const item of parsed) {
      if (item.url && item.name) {
        addSavedM3uUrl(item.name, item.url);
        added++;
      }
    }
    return added;
  } catch {
    return 0;
  }
}

export function exportSavedM3uUrls(): string {
  return JSON.stringify(getSavedM3uUrls(), null, 2);
}
