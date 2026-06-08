import { invoke } from '@tauri-apps/api/core';

export type BlogEntryType = 'mac' | 'm3u';

export interface BlogPortalEntry {
  name: string;
  type: BlogEntryType;
  portalUrl: string;
  mac?: string;
  m3uUrl?: string;
}

interface BlogSource {
  name: string;
  url: string;
}

export const DEFAULT_BLOG_POSTS: BlogSource[] = [
  { name: 'STBEMU - 5 June', url: 'https://iptvlinkseuro.blogspot.com/2026/06/stbemu-codes-stalker-portal-mac-5-june.html' },
  { name: 'STBEMU - 2 June', url: 'https://iptvlinkseuro.blogspot.com/2026/06/stbemu-codes-stalker-portal-mac-2-june.html' },
  { name: 'STBEMU - 30 May', url: 'https://iptvlinkseuro.blogspot.com/2026/05/stbemu-codes-stalker-portal-mac-30-may.html' },
];

const BLOG_SOURCES_KEY = 'saved-blog-sources-v1';

export function getBlogSources(): BlogSource[] {
  try {
    const raw = localStorage.getItem(BLOG_SOURCES_KEY);
    if (!raw) return [...DEFAULT_BLOG_POSTS];
    const saved: BlogSource[] = JSON.parse(raw);
    // Merge with defaults (defaults first, dedup by url)
    const seen = new Set<string>();
    const merged: BlogSource[] = [];
    for (const src of [...DEFAULT_BLOG_POSTS, ...saved]) {
      if (!seen.has(src.url)) {
        seen.add(src.url);
        merged.push(src);
      }
    }
    return merged;
  } catch { return [...DEFAULT_BLOG_POSTS]; }
}

export function addBlogSource(name: string, url: string): void {
  const sources = getBlogSources().filter(s => s.url !== url);
  sources.unshift({ name, url });
  try { localStorage.setItem(BLOG_SOURCES_KEY, JSON.stringify(sources.slice(0, 30))); } catch {}
}

export function removeBlogSource(url: string): void {
  const sources = getBlogSources().filter(s => s.url !== url);
  try { localStorage.setItem(BLOG_SOURCES_KEY, JSON.stringify(sources)); } catch {}
}

export function importBlogSources(data: string): number {
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return 0;
    let added = 0;
    for (const item of parsed) {
      if (item.url && item.name) {
        addBlogSource(item.name, item.url);
        added++;
      }
    }
    return added;
  } catch { return 0; }
}

export function exportBlogSources(): string {
  return JSON.stringify(getBlogSources(), null, 2);
}

// Saved import URLs (persistent)
const SAVED_URLS_KEY = 'saved-import-urls-v1';

export function getSavedImportUrls(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_URLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addSavedImportUrl(url: string): void {
  const urls = getSavedImportUrls().filter(u => u !== url);
  urls.unshift(url);
  try { localStorage.setItem(SAVED_URLS_KEY, JSON.stringify(urls.slice(0, 20))); } catch {}
}

export function removeSavedImportUrl(url: string): void {
  const urls = getSavedImportUrls().filter(u => u !== url);
  try { localStorage.setItem(SAVED_URLS_KEY, JSON.stringify(urls)); } catch {}
}

export function clearSavedImportUrls(): void {
  try { localStorage.removeItem(SAVED_URLS_KEY); } catch {}
}

// Detect if a URL is an M3U playlist URL
function isM3uUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  return /\.m3u8?(\?|$)/i.test(url)
    || /\/playlist/i.test(url)
    || /get\.php.*type=(m3u|m3u_plus|ts|m3u8)/i.test(url)
    || /\/live\//i.test(url);
}

// Generate a name for an M3U playlist from its URL
function generateM3uName(m3uUrl: string): string {
  try {
    const url = new URL(m3uUrl);
    const host = url.hostname.replace(/^www\./, '');
    const base = host.split('.')[0];
    return (base.charAt(0).toUpperCase() + base.slice(1)).replace(/\d+$/, '') || 'M3U-Playlist';
  } catch {
    return 'M3U-Playlist';
  }
}

function extractPortalUrl(text: string): string | null {
  const m = text.match(/(https?:\/\/[^\s<>"']+(?:\/c\/|\/stalker_portal\/c\/))/i);
  return m ? m[1].replace(/\/+$/, '') : null;
}

function extractMac(text: string): string | null {
  const m = text.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
  return m ? m[0].toUpperCase() : null;
}

function isStalkerMac(mac: string): boolean {
  return mac.startsWith('00:1A:79') || mac.startsWith('A0:BB:3E');
}

function shortMac(mac: string): string {
  return mac.replace(/:/g, '').slice(-4).toUpperCase();
}

const IP_NAME_MAP: Record<string, string> = {
  '178': 'Stalker178',
  '92': 'Stalker92',
  '80': 'Stalker80',
  '217': 'Stalker217',
  '204': 'Stalker204',
  '185': 'Stalker185',
};

function generateName(portalUrl: string, mac: string): string {
  try {
    const url = new URL(portalUrl);
    const hostname = url.hostname;
    const firstPart = hostname.split('.')[0];
    if (IP_NAME_MAP[firstPart]) {
      return IP_NAME_MAP[firstPart] + '-' + shortMac(mac);
    }
    const parts = hostname.replace(/^www\./, '').split('.');
    const base = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return base ? base.replace(/\d+$/, '') + '-' + shortMac(mac) : 'Portal-' + shortMac(mac);
  } catch {
    return 'Portal-' + shortMac(mac);
  }
}

export function parseBlogPostHTML(html: string): BlogPortalEntry[] {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  const seen = new Set<string>();
  const entries: BlogPortalEntry[] = [];
  const lines = text.split('\n');
  let currentUrl: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Check for M3U URLs
    if (isM3uUrl(line)) {
      const key = 'm3u:' + line;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({
          name: generateM3uName(line),
          type: 'm3u',
          portalUrl: line,
          m3uUrl: line,
        });
      }
      continue;
    }

    const url = extractPortalUrl(line);
    if (url) {
      currentUrl = url;
      continue;
    }

    const mac = extractMac(line);
    if (mac && isStalkerMac(mac) && currentUrl) {
      const key = currentUrl + '|' + mac;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({
          name: generateName(currentUrl, mac),
          type: 'mac',
          portalUrl: currentUrl,
          mac,
        });
      }
    }
  }

  return entries;
}

async function fetchViaProxy(url: string): Promise<string> {
  try {
    return await invoke<string>('fetch_url', { url });
  } catch {
    const resp = await fetch('/api/proxy?url=' + encodeURIComponent(url));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.text();
  }
}

export async function fetchLatestBlogPortals(blogUrl?: string): Promise<BlogPortalEntry[]> {
  const seen = new Set<string>();
  const allEntries: BlogPortalEntry[] = [];
  const urls = blogUrl ? [blogUrl] : getBlogSources().map(s => s.url);

  for (const url of urls) {
    try {
      const html = await fetchViaProxy(url);
      const entries = parseBlogPostHTML(html);
      for (const entry of entries) {
        const key = entry.type === 'mac' ? entry.portalUrl + '|' + entry.mac : 'm3u:' + entry.m3uUrl;
        if (!seen.has(key)) {
          seen.add(key);
          allEntries.push(entry);
        }
      }
    } catch {}
  }

  return allEntries;
}

export async function fetchPortalsFromUrl(url: string): Promise<BlogPortalEntry[]> {
  const html = await fetchViaProxy(url);
  return parseBlogPostHTML(html);
}
