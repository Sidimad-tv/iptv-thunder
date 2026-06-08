import { invoke } from '@tauri-apps/api/core';
import type { M3uChannel } from '@/features/m3u/m3u.types';

export function parseM3u(content: string): M3uChannel[] {
  const channels: M3uChannel[] = [];
  const lines = content.split('\n');
  let currentExtinf: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentExtinf = line;
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:')) continue;
    if (line.startsWith('#')) continue;

    if (currentExtinf && (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('rtmp://') || line.startsWith('rtsp://'))) {
      const nameMatch = currentExtinf.match(/,(.+)$/);
      const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
      const logoMatch = currentExtinf.match(/tvg-logo="([^"]*)"/i);
      const logo = logoMatch ? logoMatch[1] : '';
      const groupMatch = currentExtinf.match(/group-title="([^"]*)"/i);
      const group = groupMatch ? groupMatch[1] : 'Uncategorized';

      channels.push({
        id: `m3u-${channels.length}`,
        name,
        logo,
        group,
        streamUrl: line,
      });
      currentExtinf = null;
    }
  }

  return channels;
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

export async function fetchM3uChannels(url: string): Promise<M3uChannel[]> {
  const content = await fetchViaProxy(url);
  return parseM3u(content);
}

export async function parseM3uFile(file: File): Promise<M3uChannel[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        resolve(parseM3u(content));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export async function fetchXtreamChannels(serverUrl: string, username: string, password: string): Promise<{ name: string; channels: M3uChannel[] }> {
  const base = serverUrl.replace(/\/+$/, '');
  const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;

  const content = await fetchViaProxy(url);
  const data = JSON.parse(content);
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
