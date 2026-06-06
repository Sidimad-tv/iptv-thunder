export interface BlogPortalEntry {
  name: string;
  portalUrl: string;
  mac: string;
}

const BLOG_POSTS = [
  'https://iptvlinkseuro.blogspot.com/2026/06/stbemu-codes-stalker-portal-mac-5-june.html',
  'https://iptvlinkseuro.blogspot.com/2026/06/stbemu-codes-stalker-portal-mac-2-june.html',
  'https://iptvlinkseuro.blogspot.com/2026/05/stbemu-codes-stalker-portal-mac-30-may.html',
];

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
    // Use IP name map for IP-based URLs
    const firstPart = hostname.split('.')[0];
    if (IP_NAME_MAP[firstPart]) {
      return IP_NAME_MAP[firstPart] + '-' + shortMac(mac);
    }
    const parts = hostname.replace(/^www\./, '').split('.');
    const base = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    // Remove trailing digits for cleaner names
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
          portalUrl: currentUrl,
          mac,
        });
      }
    }
  }

  return entries;
}

export async function fetchLatestBlogPortals(): Promise<BlogPortalEntry[]> {
  const seen = new Set<string>();
  const allEntries: BlogPortalEntry[] = [];

  for (const blogUrl of BLOG_POSTS) {
    try {
      const resp = await fetch('/api/proxy?url=' + encodeURIComponent(blogUrl));
      if (!resp.ok) continue;
      const html = await resp.text();
      const entries = parseBlogPostHTML(html);
      for (const entry of entries) {
        const key = entry.portalUrl + '|' + entry.mac;
        if (!seen.has(key)) {
          seen.add(key);
          allEntries.push(entry);
        }
      }
    } catch {}
  }

  return allEntries;
}
