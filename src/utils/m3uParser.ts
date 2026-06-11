import { invoke } from '@tauri-apps/api/core';
import type { M3uChannel, M3uContentType, M3uCategory } from '@/features/m3u/m3u.types';

interface M3uParseResult {
  categories: M3uCategory[];
  contents: M3uChannel[];
  sorted_channels: Record<string, number[]>;
}

/** Lightweight result from cached Rust parser — only categories, no channel data */
export interface M3uCategoriesResult {
  cache_key: string;
  categories: M3uCategory[];
  total_channels: number;
}

function classifyContentType(group: string, tvgType?: string): M3uChannel['contentType'] {
  if (tvgType && ['live', 'movie', 'series'].includes(tvgType)) return tvgType as M3uContentType;
  const gl = group.toLowerCase();
  if (gl.includes('movie') || gl.includes('film') || gl.includes('vod') || gl.includes('cinema')) return 'movie';
  if (gl.includes('series') || gl.includes('episode') || gl.includes('season') || gl.includes('show')) return 'series';
  return 'live';
}

/** JS-only parser — kept as last resort fallback only */
export function parseM3u(content: string): M3uChannel[] {
  const channels: M3uChannel[] = [];
  const lines = content.split('\n');
  let currentExtinf: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) { currentExtinf = line; continue; }
    if (line.startsWith('#EXTVLCOPT:')) continue;
    if (line.startsWith('#')) continue;
    if (currentExtinf && (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('rtmp://') || line.startsWith('rtsp://'))) {
      const n = currentExtinf.match(/,(.+)$/);
      const name = n ? n[1].trim() : 'Unknown';
      const logo = (currentExtinf.match(/tvg-logo="([^"]*)"/i) || [])[1] || '';
      const group = (currentExtinf.match(/group-title="([^"]*)"/i) || [])[1] || 'Uncategorized';
      const tvgType = (currentExtinf.match(/tvg-type="([^"]*)"/i) || [])[1] || '';
      channels.push({ id: `m3u-${channels.length}`, name, logo, group, streamUrl: line, contentType: classifyContentType(group, tvgType) });
      currentExtinf = null;
    }
  }
  return channels;
}

/**
 * Fetch and parse M3U in Rust — returns LIGHT categories-only result.
 * Full channel data stays cached in Rust for on-demand group loading.
 */
export async function fetchAndParse(url: string): Promise<M3uCategoriesResult> {
  // Attempt 1: Rust fetch-and-parse (fully in backend)
  try {
    const result = await invoke<M3uCategoriesResult>('fetch_and_parse_m3u', { url, urlOverride: null });
    if (result && result.cache_key) return result;
  } catch { /* fall through */ }

  // Attempt 2: Rust fetch + Rust parse
  try {
    const content = await invoke<string>('fetch_url', { url });
    const result = await invoke<M3uCategoriesResult>('parse_m3u_text', { content, cacheKeyHint: null });
    if (result && result.cache_key) return result;
  } catch { /* fall through */ }

  // Attempt 3: browser fetch + Rust parse
  try {
    const resp = await fetch('/api/proxy?url=' + encodeURIComponent(url));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const content = await resp.text();
    const result = await invoke<M3uCategoriesResult>('parse_m3u_text', { content, cacheKeyHint: null });
    if (result && result.cache_key) return result;
  } catch { /* fall through */ }

  throw new Error('Failed to load M3U playlist');
}

/**
 * Legacy: fetch + return all channels as flat array (may be slow for large playlists)
 */
export async function fetchM3uChannels(url: string): Promise<M3uChannel[]> {
  try {
    const full = await invoke<M3uParseResult>('fetch_and_parse_m3u', { url, urlOverride: null });
    return full?.contents ?? [];
  } catch {
    try {
      const content = await invoke<string>('fetch_url', { url });
      const full = await invoke<M3uParseResult>('parse_m3u_text', { content, cacheKeyHint: null });
      return full?.contents ?? [];
    } catch {
      try {
        const resp = await fetch('/api/proxy?url=' + encodeURIComponent(url));
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const content = await resp.text();
        return parseM3u(content);
      } catch {
        throw new Error('Failed to fetch M3U playlist');
      }
    }
  }
}

/** Load channels for a specific group from the Rust-side M3U cache */
export async function getM3uGroupChannels(cacheKey: string, groupId: string): Promise<M3uChannel[]> {
  return await invoke<M3uChannel[]>('get_m3u_group_channels', { cacheKey, groupId });
}

/** Clear the Rust-side M3U parse cache */
export async function clearM3uCache(): Promise<void> {
  try { await invoke('clear_m3u_cache'); } catch { /* ignore */ }
}

/** Parse raw M3U text in Rust backend (legacy full return) */
export async function parseM3uText(content: string): Promise<M3uChannel[]> {
  try {
    const result = await invoke<M3uParseResult>('parse_m3u_text', { content, cacheKeyHint: null });
    if (result?.contents) return result.contents;
  } catch { /* fall through */ }
  return parseM3u(content);
}

/** Parse raw M3U text, returns categorized structure (legacy) */
export async function parseM3uTextCategorized(content: string): Promise<M3uParseResult> {
  try {
    return await invoke<M3uParseResult>('parse_m3u_text', { content, cacheKeyHint: null });
  } catch {
    const channels = parseM3u(content);
    return buildCategorized(channels);
  }
}

function buildCategorized(channels: M3uChannel[]): M3uParseResult {
  const groupMap = new Map<string, number[]>();
  const contents: M3uChannel[] = [];
  for (const [idx, ch] of channels.entries()) {
    const g = ch.group || 'Uncategorized';
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(idx);
    contents.push({ ...ch, tv_genre_id: `cat-${g}`, number: idx + 1 });
  }
  const categories: Array<{ id: string; title: string }> = [{ id: '*', title: 'All' }];
  const sorted_channels: Record<string, number[]> = {};
  for (const [groupName, indices] of [...groupMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const catId = `cat-${groupName}`;
    categories.push({ id: catId, title: groupName });
    sorted_channels[catId] = indices;
  }
  return { categories, contents, sorted_channels };
}

/** Read local M3U file → parse in Rust → return categories result */
export async function parseM3uFileCategorized(file: File): Promise<M3uCategoriesResult> {
  const text = await file.text();
  try {
    return await invoke<M3uCategoriesResult>('parse_m3u_text', { content: text, cacheKeyHint: null });
  } catch {
    const channels = parseM3u(text);
    const built = buildCategorized(channels);
    return {
      cache_key: `file-${file.name}-${Date.now()}`,
      categories: built.categories,
      total_channels: channels.length,
    };
  }
}

/** Read local M3U file → parse in Rust */
export async function parseM3uFile(file: File): Promise<M3uChannel[]> {
  const text = await file.text();
  return parseM3uText(text);
}

export async function fetchXtreamChannels(
  serverUrl: string, username: string, password: string
): Promise<{ name: string; channels: M3uChannel[] }> {
  const base = serverUrl.replace(/\/+$/, '');
  const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
  let content: string;
  try {
    content = await invoke<string>('fetch_url', { url });
  } catch {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    content = await resp.text();
  }

  let data: any[];
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('Invalid response from Xtream API');
  }

  if (!Array.isArray(data)) throw new Error('Invalid response');

  const channels: M3uChannel[] = data.map((ch: any, i: number) => ({
    id: `xtream-${i}`,
    name: ch.name || `Channel ${i}`,
    logo: ch.stream_icon || '',
    group: ch.category_name || 'Uncategorized',
    streamUrl: `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${ch.stream_id}.m3u8`,
  }));

  return { name: `Xtream (${channels.length} channels)`, channels };
}
