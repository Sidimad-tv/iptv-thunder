import { invoke } from '@tauri-apps/api/core';
import type { M3uChannel, M3uContentType, M3uCategory } from '@/features/m3u/m3u.types';

let isTauriEnv: boolean | null = null;
function checkTauri(): boolean {
  if (isTauriEnv === null) isTauriEnv = !!(window as any).__TAURI_INTERNALS__;
  return isTauriEnv;
}

function classifyContentType(group: string, tvgType?: string): M3uContentType {
  if (tvgType === 'live' || tvgType === 'movie' || tvgType === 'series') return tvgType;
  const gl = group.toLowerCase();
  if (gl.includes('movie') || gl.includes('film') || gl.includes('vod') || gl.includes('cinema')) return 'movie';
  if (gl.includes('series') || gl.includes('episode') || gl.includes('season') || gl.includes('show')) return 'series';
  return 'live';
}

function parseOneChannel(extinf: string, line: string, idx: number): M3uChannel {
  const commaIdx = extinf.lastIndexOf(',');
  const name = commaIdx >= 0 ? extinf.substring(commaIdx + 1).trim() : 'Unknown';
  let logo = '', group = 'Uncategorized', tvgType = '';
  let pos = extinf.indexOf('tvg-logo="');
  if (pos >= 0) { const s = pos + 10; const e = extinf.indexOf('"', s); if (e >= 0) logo = extinf.substring(s, e); }
  pos = extinf.indexOf('group-title="');
  if (pos >= 0) { const s = pos + 13; const e = extinf.indexOf('"', s); if (e >= 0) group = extinf.substring(s, e); }
  pos = extinf.indexOf('tvg-type="');
  if (pos >= 0) { const s = pos + 10; const e = extinf.indexOf('"', s); if (e >= 0) tvgType = extinf.substring(s, e); }
  return { id: `m3u-${idx}`, name, logo, group, streamUrl: line, contentType: classifyContentType(group, tvgType) };
}

export function parseM3uLines(content: string): M3uChannel[] {
  const channels: M3uChannel[] = [];
  const lines = content.split('\n');
  let extinf = '';
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (line.length === 0) continue;
    if (line.startsWith('#EXTINF:')) { extinf = line; continue; }
    if (line.startsWith('#EXTVLCOPT:') || line.startsWith('#KODIPROP:')) continue;
    if (line.startsWith('#')) { extinf = ''; continue; }
    if (extinf.length === 0) continue;
    if (!line.startsWith('http://') && !line.startsWith('https://') && !line.startsWith('rtmp://') && !line.startsWith('rtsp://')) continue;
    channels.push(parseOneChannel(extinf, line, channels.length));
    extinf = '';
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

export function detectXtreamUrl(url: string): { server: string; username: string; password: string } | null {
  const m = url.match(/(https?:\/\/[^/]+)\/get\.php\?username=([^&]*)&password=([^&]*)/i);
  return m ? { server: m[1], username: m[2], password: m[3] } : null;
}

async function fetchRaw(url: string): Promise<string> {
  if (checkTauri()) {
    return await invoke<string>('fetch_url', { url });
  }
  const proxyBase = typeof window !== 'undefined' ? window.location.origin + '/api/proxy' : '';
  const fetchUrl = proxyBase ? `${proxyBase}?url=${encodeURIComponent(url)}` : url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(fetchUrl, { signal: controller.signal, headers: { 'Accept': '*/*', 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string): Promise<any> {
  const text = await fetchRaw(url);
  return JSON.parse(text);
}

const XTREAM_CATEGORIES_CACHE = new Map<string, { live: any[]; vod: any[]; series: any[] }>();

export async function fetchXtreamCategories(server: string, username: string, password: string): Promise<any[]> {
  const key = `${server}:${username}`;
  const cached = XTREAM_CATEGORIES_CACHE.get(key);
  if (cached) return cached.live;
  const base = server.replace(/\/+$/, '');
  const [liveCat, vodCat, seriesCat] = await Promise.all([
    fetchJson(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`).catch(() => []),
    fetchJson(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_categories`).catch(() => []),
    fetchJson(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_categories`).catch(() => []),
  ]);
  const liveArr = Array.isArray(liveCat) ? liveCat : liveCat?.categories || [];
  const vodArr = Array.isArray(vodCat) ? vodCat : vodCat?.categories || [];
  const seriesArr = Array.isArray(seriesCat) ? seriesCat : seriesCat?.categories || [];
  XTREAM_CATEGORIES_CACHE.set(key, { live: liveArr, vod: vodArr, series: seriesArr });
  return liveArr;
}

export async function fetchXtreamStreams(
  server: string, username: string, password: string
): Promise<M3uChannel[]> {
  const base = server.replace(/\/+$/, '');
  const u = encodeURIComponent(username);
  const p = encodeURIComponent(password);
  const [liveData, vodData, seriesData] = await Promise.all([
    fetchJson(`${base}/player_api.php?username=${u}&password=${p}&action=get_live_streams`).then(d => Array.isArray(d) ? d : d?.streams || d?.results || []).catch(() => []),
    fetchJson(`${base}/player_api.php?username=${u}&password=${p}&action=get_vod_streams`).then(d => Array.isArray(d) ? d : d?.movies || d?.results || []).catch(() => []),
    fetchJson(`${base}/player_api.php?username=${u}&password=${p}&action=get_series`).then(d => Array.isArray(d) ? d : d?.series || d?.results || []).catch(() => []),
  ]);
  return [
    ...liveData.map((ch: any, i: number) => ({
      id: `xtr-live-${i}`, name: ch.name || `Channel ${i}`, logo: ch.stream_icon || '',
      group: ch.category_name || 'Live', streamUrl: `${base}/live/${u}/${p}/${ch.stream_id}.m3u8`, contentType: 'live' as M3uContentType,
    })),
    ...vodData.map((ch: any, i: number) => ({
      id: `xtr-vod-${i}`, name: ch.name || `Movie ${i}`, logo: ch.stream_icon || ch.cover || '',
      group: ch.category_name || 'Movies', streamUrl: `${base}/movie/${u}/${p}/${ch.stream_id}.${ch.container_extension || 'mp4'}`,
      contentType: 'movie' as M3uContentType,
    })),
    ...seriesData.map((ch: any, i: number) => ({
      id: `xtr-series-${i}`, name: ch.name || `Series ${i}`, logo: ch.cover || ch.stream_icon || '',
      group: ch.category_name || 'Series', streamUrl: `${base}/series/${u}/${p}/${ch.series_id}.m3u8`, contentType: 'series' as M3uContentType,
    })),
  ];
}

export async function loadM3uContent(account: { url?: string; sourceType: string; serverUrl?: string; username?: string; password?: string; channels?: M3uChannel[] }): Promise<{ categories: M3uCategory[]; channels: M3uChannel[] }> {
  if (account.sourceType === 'file' && account.channels?.length) {
    return buildCategorized(account.channels);
  }

  if (account.sourceType === 'xtream' && account.serverUrl && account.username && account.password) {
    const channels = await fetchXtreamStreams(account.serverUrl, account.username, account.password);
    return buildCategorized(channels);
  }

  if (account.url) {
    const xtream = detectXtreamUrl(account.url);
    if (xtream) {
      try {
        const channels = await fetchXtreamStreams(xtream.server, xtream.username, xtream.password);
        return buildCategorized(channels);
      } catch { /* fall through to M3U */ }
    }
    const raw = await fetchRaw(account.url);
    const channels = parseM3uLines(raw);
    return buildCategorized(channels);
  }

  throw new Error('No source configured');
}
