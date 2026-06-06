// =========================
// 📅 EPG API
// =========================
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerEPG } from '@/types';
import { invoke } from '@tauri-apps/api/core';

export const getChannelEPG = async (
  client: StalkerClient, 
  channelId: number, 
  _from?: number, 
  _to?: number
): Promise<StalkerEPG[]> => {
  // Always use short EPG - get_epg endpoint is disabled
  // Increase size to get more programs with full descriptions
  return client.getEPG(channelId, 50);
};

export const getChannelsEPG = async (
  client: StalkerClient,
  channelIds: number[],
  _from?: number,
  _to?: number
): Promise<Record<number, StalkerEPG[]>> => {
  const epgData: Record<number, StalkerEPG[]> = {};

  // Fetch EPG in batches to avoid overwhelming the portal
  const BATCH = 5;
  for (let i = 0; i < channelIds.length; i += BATCH) {
    const batch = channelIds.slice(i, i + BATCH);
    const promises = batch.map(async (channelId) => {
      try {
        const epg = await client.getEPG(channelId);
        return { channelId, epg };
      } catch (error) {
        console.error(`Failed to fetch EPG for channel ${channelId}:`, error);
        return { channelId, epg: [] };
      }
    });

    const results = await Promise.all(promises);
    results.forEach(({ channelId, epg }) => {
      epgData[channelId] = epg;
    });
  }

  return epgData;
};

export const getCurrentProgram = (epg: StalkerEPG[]): StalkerEPG | null => {
  const now = Math.floor(Date.now() / 1000);
  
  return epg.find(program => {
    const startTime = Number.parseInt(program.start_time);
    const endTime = Number.parseInt(program.end_time);
    return startTime <= now && endTime > now;
  }) || null;
};

export const getNextProgram = (epg: StalkerEPG[]): StalkerEPG | null => {
  const now = Math.floor(Date.now() / 1000);
  
  return epg.find(program => {
    const startTime = Number.parseInt(program.start_time);
    return startTime > now;
  }) || null;
};

export const getProgramsForTimeRange = (
  epg: StalkerEPG[], 
  from: number, 
  to: number
): StalkerEPG[] => {
  return epg.filter(program => {
    const startTime = Number.parseInt(program.start_time);
    const endTime = Number.parseInt(program.end_time);
    return (startTime >= from && startTime < to) || 
           (endTime > from && endTime <= to) ||
           (startTime <= from && endTime >= to);
  });
};

export const formatEPGTime = (timestamp: string | number): string => {
  const date = new Date(Number.parseInt(timestamp.toString()) * 1000);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

export const formatEPGDate = (timestamp: string | number): string => {
  const date = new Date(Number.parseInt(timestamp.toString()) * 1000);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric' 
  });
};

export const getEPGTimeRange = (hours: number = 24): { from: number; to: number } => {
  const now = Math.floor(Date.now() / 1000);
  // Round to 5-minute intervals to keep query key stable and prevent constant refetching
  const roundedNow = Math.floor(now / 300) * 300;
  const from = roundedNow - (2 * 3600); // 2 hours ago
  const to = roundedNow + (hours * 3600); // X hours from now
  return { from, to };
};

// Simple XML parser for external EPG (XMLTV format)
// Maps URLs to full XML data and caches results
const epgCache = new Map<string, { data: string; timestamp: number }>();
const epgDocCache = new Map<string, { doc: Document; timestamp: number }>();
const epgParsedCache = new Map<string, { data: StalkerEPG[]; timestamp: number }>();
const pendingXmlFetches = new Map<string, Promise<string | null>>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Clear all EPG caches (useful for testing after matching logic changes)
export const clearEpgCache = () => {
  epgCache.clear();
  epgDocCache.clear();
  epgParsedCache.clear();
  // Don't clear pendingXmlFetches - let pending requests complete naturally
  // Clearing it while requests are in progress causes Tauri callback errors
};
const MAX_EPG_CACHE = 50;

const cleanupEPGCache = () => {
  if (epgCache.size <= MAX_EPG_CACHE) return;

  const sorted = Array.from(epgCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .slice(-MAX_EPG_CACHE);

  epgCache.clear();
  sorted.forEach(([k, v]) => epgCache.set(k, v));
};

const getCacheKey = (url: string): string => url;
const getParsedCacheKey = (url: string, channelId: number): string => `${url}_${channelId}`;

// Helper to clean IPTV channel names for better matching
const cleanChannelName = (name: string): string => {
  return name
    .replace(/^[^a-zA-Z0-9]+/, '') // Remove leading non-alphanumeric (like "JOYN|")
    .replace(/^[a-zA-Z0-9+]+\|/, '') // Remove prefix like "PLAY+|" (word followed by |) - added + to regex
    .replaceAll(/[ᴿᴬᵂᴴᴰᵁ]+/g, '') // Remove superscript chars (ᴿᴬᵂ etc.)
    .replaceAll(/\+/g, '') // Remove + signs for better matching (Canal+ -> Canal)
    .replaceAll(/\|/g, ' ') // Replace remaining pipes with spaces
    .replaceAll(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase();
};

// Common generic terms that shouldn't be used for matching alone
const GENERIC_TERMS = new Set(['international', 'channel', 'tv', 'television', 'network', 'hd', 'sd', 'raw', 'live', 'news', 'sports', 'movies', 'music']);

// Extract trailing numbers from channel name for exact matching (e.g., "Canal+ Extra 2" -> 2)
const extractChannelNumber = (name: string): number | null => {
  const match = /(\d+)\s*$/.exec(name);
  return match ? Number.parseInt(match[1], 10) : null;
};

const parseXMLTV = (xmlDataOrDoc: string | Document, channelId: number, channelName?: string): StalkerEPG[] => {
  const programs: StalkerEPG[] = [];
  
  try {
    let xmlDoc: Document;
    
    if (typeof xmlDataOrDoc === 'string') {
      const parser = new DOMParser();
      xmlDoc = parser.parseFromString(xmlDataOrDoc, 'text/xml');
    } else {
      xmlDoc = xmlDataOrDoc;
    }
    
    // First, build a map of channel IDs to find matching channel
    const channels = xmlDoc.getElementsByTagName('channel');
    let targetChannelId: string | null = null;
    let bestMatchScore = 0;
    
    const cleanedIptvName = channelName ? cleanChannelName(channelName) : '';
    const iptvWords = new Set(cleanedIptvName.split(' ').filter(w => w.length > 2 && !GENERIC_TERMS.has(w)));
    const iptvChannelNumber = channelName ? extractChannelNumber(channelName) : null;
    
    Array.from(channels).forEach((ch) => {
      const id = ch.getAttribute('id');
      const displayName = ch.getElementsByTagName('display-name')[0]?.textContent || '';
      
      // Clean XMLTV name too
      const cleanedXmltvName = cleanChannelName(displayName);
      const xmltvWords = new Set(cleanedXmltvName.split(' ').filter(w => w.length > 2 && !GENERIC_TERMS.has(w)));
      const xmltvChannelNumber = extractChannelNumber(displayName);
      
      // Match by cleaned channel name
      if (id && cleanedIptvName && cleanedXmltvName) {
        let score = 0;
        
        // Exact match = highest score
        if (cleanedIptvName === cleanedXmltvName) {
          score = 1000;
        }
        // One contains the other fully (e.g., "cnn" in "cnn international")
        else if (cleanedXmltvName.includes(cleanedIptvName) || cleanedIptvName.includes(cleanedXmltvName)) {
          // Prefer shorter/more specific matches (CNN should beat "CNN International News HD")
          score = 100 + Math.max(cleanedIptvName.length, cleanedXmltvName.length) - Math.abs(cleanedIptvName.length - cleanedXmltvName.length);
        }
        // Word-by-word match for non-generic terms
        else {
          const matchingWords = Array.from(iptvWords).filter(word => xmltvWords.has(word));
          if (matchingWords.length >= 2 || (matchingWords.length === 1 && iptvWords.size === 1)) {
            // Score by number of matching specific words
            score = matchingWords.length * 10;
          } else if (matchingWords.length === 1 && iptvWords.size > 1) {
            // Single matching word when channel has multiple words - still give it a score
            // but lower than multi-word matches to prefer more specific matches
            score = 5;
          }
        }
        
        // Prefer shorter, more specific channel names (CNN beats "1+1 CNN International HD")
        if (score > 0) {
          score -= cleanedXmltvName.length * 0.1;
        }
        
        // Apply channel number penalty: if both have numbers but they don't match, heavily penalize
        // This prevents "Canal+ Extra 2" from matching "Canal+ Extra"
        if (iptvChannelNumber !== null && xmltvChannelNumber !== null && iptvChannelNumber !== xmltvChannelNumber) {
          score -= 500;
        }
        
        if (score > bestMatchScore) {
          bestMatchScore = score;
          targetChannelId = id;
        }
      }
    });
    
    // If no channel name match, try direct ID match
    targetChannelId ??= channelId.toString();
    
    
    // Find programme elements for this channel only
    const programmes = xmlDoc.getElementsByTagName('programme');
    
    Array.from(programmes).forEach((prog) => {
      const progChannel = prog.getAttribute('channel');
      
      // Filter by channel
      if (progChannel && progChannel !== targetChannelId) {
        return;
      }
      
      const start = prog.getAttribute('start');
      const stop = prog.getAttribute('stop');
      const title = prog.querySelector('title')?.textContent || 'Unknown';
      const desc = prog.querySelector('desc')?.textContent || '';
      const category = prog.querySelector('category')?.textContent || undefined;

      if (start && stop) {
        const startTime = parseXMLTVTime(start);
        const stopTime = parseXMLTVTime(stop);

        programs.push({
          // Use a number ID based on startTime to avoid NaN issues with string-based numbers
          id: startTime,
          name: title,
          start_time: startTime.toString(),
          end_time: stopTime.toString(),
          description: desc,
          category,
          channel_id: channelId,
        });
      }
    });
    
    
  } catch (error) {
    console.error('Failed to parse external EPG:', error);
  }
  
  return programs;
};

// Parse XMLTV timestamp format
const parseXMLTVTime = (timeStr: string): number => {
  // Format examples: 
  // "20260126180000 +0100"
  // "20260126180000"
  const parts = timeStr.split(' ');
  const dt = parts[0];
  const offset = parts[1];

  const year = dt.substring(0, 4);
  const month = dt.substring(4, 6);
  const day = dt.substring(6, 8);
  const hour = dt.substring(8, 10);
  const minute = dt.substring(10, 12);
  const second = dt.substring(12, 14);

  // Format as ISO 8601 string: YYYY-MM-DDTHH:mm:ss+HH:mm
  let isoStr = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  
  if (offset) {
    // Convert +0200 to +02:00
    const formattedOffset = offset.length >= 5 
      ? offset.substring(0, 3) + ':' + offset.substring(3, 5)
      : offset;
    isoStr += formattedOffset;
  }

  const date = new Date(isoStr);
  
  // Fallback to old behavior if date is invalid
  if (Number.isNaN(date.getTime())) {
    const fallbackMonth = Number.parseInt(month) - 1;
    return Math.floor(new Date(
      Number.parseInt(year), 
      fallbackMonth, 
      Number.parseInt(day), 
      Number.parseInt(hour), 
      Number.parseInt(minute), 
      Number.parseInt(second)
    ).getTime() / 1000);
  }

  return Math.floor(date.getTime() / 1000);
};

// Check if URL ends with .gz
const isGzippedUrl = (url: string): boolean => url.toLowerCase().endsWith('.gz');

const checkParsedCache = (parsedCacheKey: string, from?: number, to?: number): StalkerEPG[] | null => {
  const now = Date.now();
  const parsedCached = epgParsedCache.get(parsedCacheKey);
  
  if (!parsedCached || (now - parsedCached.timestamp) >= CACHE_TTL_MS) {
    return null;
  }
  
  const programs = parsedCached.data;
  
  if (from && to) {
    return programs.filter(prog => {
      const start = Number.parseInt(prog.start_time);
      const end = Number.parseInt(prog.end_time);
      return (start >= from && start <= to) || (end >= from && end <= to);
    });
  }
  
  return programs;
};

const checkRawCache = (cacheKey: string): string | null => {
  const now = Date.now();
  const cached = epgCache.get(cacheKey);
  
  if (!cached || (now - cached.timestamp) >= CACHE_TTL_MS) {
    return null;
  }
  
  return cached.data;
};

const fetchXmlData = async (url: string): Promise<string | null> => {
  try {
    if (isGzippedUrl(url)) {
      return (await invoke('fetch_epg_gz', { url }) as unknown) as string | null;
    }

    const acceptHeader = 'Accept: application/xml';
    // Using a safe invoke wrapper to avoid callback issues during quick navigation
    const response = await invoke('stalker_request', {
      url: url,
      method: 'GET',
      headers: [acceptHeader],
      body: null,
    }).catch(() => {
      // Silently fail for aborted requests to avoid console spam
      return null;
    });

    if (!response) return null;

    const responseBody = typeof response === 'string' ? response : (response as any)?.body;

    if (!responseBody || typeof responseBody !== 'string' || responseBody.trim() === '') {
      return null;
    }
    
    return responseBody;
  } catch (error) {
    return null;
  }
};

const filterByTimeRange = (programs: StalkerEPG[], from?: number, to?: number): StalkerEPG[] => {
  if (!from || !to) {
    return programs;
  }
  
  return programs.filter(prog => {
    const start = Number.parseInt(prog.start_time);
    const end = Number.parseInt(prog.end_time);
    return (start >= from && start <= to) || (end >= from && end <= to);
  });
};

export const fetchExternalEPG = async (
  url: string,
  channelId: number,
  from?: number,
  to?: number,
  channelName?: string,
  signal?: AbortSignal
): Promise<StalkerEPG[]> => {
  try {
    const cacheKey = getCacheKey(url);
    const parsedCacheKey = getParsedCacheKey(url, channelId);

    // 1. Check parsed programs cache (per channel)
    const cachedPrograms = checkParsedCache(parsedCacheKey, from, to);
    if (cachedPrograms) {
      return cachedPrograms;
    }

    // 2. Check already parsed XML Document cache (global)
    const cachedDocEntry = epgDocCache.get(cacheKey);
    const now = Date.now();
    
    if (cachedDocEntry && (now - cachedDocEntry.timestamp) < CACHE_TTL_MS) {
      const programs = parseXMLTV(cachedDocEntry.doc, channelId, channelName);
      epgParsedCache.set(parsedCacheKey, { data: programs, timestamp: now });
      return filterByTimeRange(programs, from, to);
    }

    // 3. Get raw XML data (from cache or network)
    let xmlData = checkRawCache(cacheKey);
    
    if (!xmlData) {
      let pendingFetch = pendingXmlFetches.get(cacheKey);
      if (!pendingFetch) {
        pendingFetch = fetchXmlData(url).then(data => {
          if (data) {
            epgCache.set(cacheKey, { data, timestamp: Date.now() });
            cleanupEPGCache();
          }
          pendingXmlFetches.delete(cacheKey);
          return data;
        });
        pendingXmlFetches.set(cacheKey, pendingFetch);
      }
      
      xmlData = await pendingFetch;
      if (!xmlData) return [];
    }

    if (signal?.aborted) throw new Error('Aborted');

    // 4. Parse XML and cache the Document object
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
    epgDocCache.set(cacheKey, { doc: xmlDoc, timestamp: Date.now() });

    if (signal?.aborted) throw new Error('Aborted');

    // 5. Extract programs for this channel
    const programs = parseXMLTV(xmlDoc, channelId, channelName);
    epgParsedCache.set(parsedCacheKey, { data: programs, timestamp: Date.now() });

    return filterByTimeRange(programs, from, to);
  } catch (error) {
    if (error instanceof Error && error.message === 'Aborted') return [];
    console.error(`Failed to fetch external EPG:`, error);
    return [];
  }
};
