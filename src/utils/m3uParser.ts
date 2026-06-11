import { invoke } from '@tauri-apps/api/core';
import type { M3uChannel, M3uContentType, M3uCategory } from '@/features/m3u/m3u.types';

let isTauriEnv: boolean | null = null;
function checkTauri(): boolean {
  if (isTauriEnv === null) isTauriEnv = !!(window as any).__TAURI_INTERNALS__;
  return isTauriEnv;
}

function classifyContentType(group: string, tvgType?: string): M3uChannel['contentType'] {
  if (tvgType && ['live', 'movie', 'series'].includes(tvgType)) return tvgType as M3uContentType;
  const gl = group.toLowerCase();
  if (gl.includes('movie') || gl.includes('film') || gl.includes('vod') || gl.includes('cinema')) return 'movie';
  if (gl.includes('series') || gl.includes('episode') || gl.includes('season') || gl.includes('show')) return 'series';
  return 'live';
}

/** Parse raw M3U text */
export function parseM3uLines(content: string): M3uChannel[] {
  const channels: M3uChannel[] = [];
  const lines = content.split('\n');
  let currentExtinf: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) { currentExtinf = line; continue; }
    if (line.startsWith('#EXTVLCOPT:') || line.startsWith('#KODIPROP:')) continue;
    if (line.startsWith('#')) { currentExtinf = null; continue; }
    if (currentExtinf && (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('rtmp://') || line.startsWith('rtsp://'))) {
      const name = (currentExtinf.match(/,(.+)$/) || [])[1]?.trim() || 'Unknown';
      const logo = (currentExtinf.match(/tvg-logo="([^"]*)"/i) || [])[1] || '';
      const group = (currentExtinf.match(/group-title="([^"]*)"/i) || [])[1] || 'Uncategorized';
      const tvgType = (currentExtinf.match(/tvg-type="([^"]*)"/i) || [])[1] || '';
      channels.push({ id: `m3u-${channels.length}`, name, logo, group, streamUrl: line, contentType: classifyContentType(group, tvgType) });
      currentExtinf = null;
    }
  }
  return channels;
}

function buildCategorized(channels: M3uChannel[]): { categories: M3uCategory[]; channels: M3uChannel[] } {
  const groupMap = new Map<string, M3uChannel[]>();
  for (const ch of channels) {
    const g = ch.group || 'Uncategorized';
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(ch);
  }
  const categories: M3uCategory[] = [{ id: '*', title: 'All' }];
  for (const [g] of [...groupMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    categories.push({ id: `cat-${g}`, title: g });
  }
  return { categories, channels };
}

/** Detect Xtream credentials from M3U URL like get.php?username=X&password=Y */
export function detectXtreamUrl(url: string): { server: string; username: string; password: string } | null {
  const m = url.match(/(https?:\/\/[^/]+)\/get\.php\?username=([^&]*)&password=([^&]*)/i);
  return m ? { server: m[1], username: m[2], password: m[3] } : null;
}

/** Fetch Xtream API data */
async function fetchXtreamApi(server: string, username: string, password: string, action: string): Promise<any[]> {
  const base = server.replace(/\/+$/, '');
  const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${action}`;
  let text: string;
  if (checkTauri()) {
    text = await invoke<string>('fetch_url', { url });
  } else {
    const proxyBase = typeof window !== 'undefined' ? window.location.origin + '/api/proxy' : '';
    const fetchUrl = proxyBase ? `${proxyBase}?url=${encodeURIComponent(url)}` : url;
    const r = await fetch(fetchUrl, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    text = await r.text();
  }
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : [];
}

async function fetchM3uContent(url: string): Promise<string> {
  const timeoutMs = 15000;
  if (checkTauri()) {
    return await invoke<string>('fetch_url', { url });
  }
  const proxyBase = typeof window !== 'undefined' && window.location.origin + '/api/proxy';
  const fetchUrl = proxyBase ? `${proxyBase}?url=${encodeURIComponent(url)}` : url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(fetchUrl, { signal: controller.signal, headers: { 'Accept': '*/*', 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

export interface M3uLoadResult {
  categories: M3uCategory[];
  channels: M3uChannel[];
}

/** Legacy: parse raw text */
export async function parseM3uText(content: string): Promise<M3uChannel[]> {
  return parseM3uLines(content);
}

/** Get the browser proxy URL if available */
export function getProxyUrl(targetUrl: string): string {
  if (checkTauri()) return targetUrl;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  }
  return targetUrl;
}

/** Legacy: fetch all channels */
export async function fetchM3uChannels(url: string): Promise<M3uChannel[]> {
  const raw = await fetchM3uContent(url);
  return parseM3uLines(raw);
}

/** Legacy: fetch Xtream live channels */
export async function fetchXtreamChannels(serverUrl: string, username: string, password: string): Promise<{ name: string; channels: M3uChannel[] }> {
  const server = serverUrl.replace(/\/+$/, '');
  const data = await fetchXtreamApi(server, username, password, 'get_live_streams');
  const channels: M3uChannel[] = data.map((ch: any, i: number) => ({
    id: `xtream-${i}`, name: ch.name || `Channel ${i}`, logo: ch.stream_icon || '',
    group: ch.category_name || 'Uncategorized', streamUrl: `${server}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${ch.stream_id}.m3u8`, contentType: 'live' as M3uContentType,
  }));
  return { name: `Xtream (${channels.length} channels)`, channels };
}

/** Load M3U content: detect Xtream URL → Xtream API, else parse M3U text */
export async function loadM3uContent(account: { url?: string; sourceType: string; serverUrl?: string; username?: string; password?: string; channels?: M3uChannel[] }): Promise<M3uLoadResult> {
  // File source: use saved channels
  if (account.sourceType === 'file' && account.channels?.length) {
    return buildCategorized(account.channels);
  }

  // Xtream source type
  if (account.sourceType === 'xtream' && account.serverUrl && account.username && account.password) {
    const server = account.serverUrl.replace(/\/+$/, '');
    try {
      const [liveData, vodData, seriesData] = await Promise.all([
        fetchXtreamApi(server, account.username, account.password, 'get_live_streams').catch(() => []),
        fetchXtreamApi(server, account.username, account.password, 'get_vod_streams').catch(() => []),
        fetchXtreamApi(server, account.username, account.password, 'get_series').catch(() => []),
      ]);
      const channels: M3uChannel[] = [
        ...liveData.map((ch: any, i: number) => ({ id: `xtream-live-${i}`, name: ch.name || `Channel ${i}`, logo: ch.stream_icon || '', group: ch.category_name || 'Live', streamUrl: `${server}/live/${encodeURIComponent(account.username!)}/${encodeURIComponent(account.password!)}/${ch.stream_id}.m3u8`, contentType: 'live' as M3uContentType })),
        ...vodData.map((ch: any, i: number) => ({ id: `xtream-vod-${i}`, name: ch.name || `Movie ${i}`, logo: ch.stream_icon || '', group: ch.category_name || 'Movies', streamUrl: `${server}/movie/${encodeURIComponent(account.username!)}/${encodeURIComponent(account.password!)}/${ch.stream_id}.${ch.container_extension || 'mp4'}`, contentType: 'movie' as M3uContentType })),
        ...seriesData.map((ch: any, i: number) => ({ id: `xtream-series-${i}`, name: ch.name || `Series ${i}`, logo: ch.cover || ch.stream_icon || '', group: ch.category_name || 'Series', streamUrl: `${server}/series/${encodeURIComponent(account.username!)}/${encodeURIComponent(account.password!)}/${ch.series_id}.m3u8`, contentType: 'series' as M3uContentType })),
      ];
      return buildCategorized(channels);
    } catch (e) {
      throw new Error(`Xtream API error: ${e instanceof Error ? e.message : e}`);
    }
  }

  // URL source: detect Xtream URL or parse M3U
  if (account.url) {
    // Detect Xtream-style URL
    const xtream = detectXtreamUrl(account.url);
    if (xtream) {
      try {
        const [liveData, vodData, seriesData] = await Promise.all([
          fetchXtreamApi(xtream.server, xtream.username, xtream.password, 'get_live_streams').catch(() => []),
          fetchXtreamApi(xtream.server, xtream.username, xtream.password, 'get_vod_streams').catch(() => []),
          fetchXtreamApi(xtream.server, xtream.username, xtream.password, 'get_series').catch(() => []),
        ]);
        const channels: M3uChannel[] = [
          ...liveData.map((ch: any, i: number) => ({ id: `xtr-live-${i}`, name: ch.name || `Channel ${i}`, logo: ch.stream_icon || '', group: ch.category_name || 'Live', streamUrl: `${xtream.server}/live/${encodeURIComponent(xtream.username)}/${encodeURIComponent(xtream.password)}/${ch.stream_id}.m3u8`, contentType: 'live' as M3uContentType })),
          ...vodData.map((ch: any, i: number) => ({ id: `xtr-vod-${i}`, name: ch.name || `Movie ${i}`, logo: ch.stream_icon || '', group: ch.category_name || 'Movies', streamUrl: `${xtream.server}/movie/${encodeURIComponent(xtream.username)}/${encodeURIComponent(xtream.password)}/${ch.stream_id}.${ch.container_extension || 'mp4'}`, contentType: 'movie' as M3uContentType })),
          ...seriesData.map((ch: any, i: number) => ({ id: `xtr-series-${i}`, name: ch.name || `Series ${i}`, logo: ch.cover || ch.stream_icon || '', group: ch.category_name || 'Series', streamUrl: `${xtream.server}/series/${encodeURIComponent(xtream.username)}/${encodeURIComponent(xtream.password)}/${ch.series_id}.m3u8`, contentType: 'series' as M3uContentType })),
        ];
        return buildCategorized(channels);
      } catch { /* fall through to M3U parsing */ }
    }

    // M3U URL: fetch and parse
    const raw = await fetchM3uContent(account.url);
    const channels = parseM3uLines(raw);
    return buildCategorized(channels);
  }

  throw new Error('No source configured');
}
