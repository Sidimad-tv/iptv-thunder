import { useCallback } from 'react';

const isTauriEnv = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

const loggedErrors = new Set<string>();
const LOG_ERROR_LIMIT = 20;

function isExpectedError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('404') || msg.includes('not_found')) return true;
    if (msg.includes('error sending request')) return true;
    if (msg.includes('dns error') || msg.includes('failed to lookup address')) return true;
    if (msg.includes('connection refused') || msg.includes('connection reset')) return true;
    if (msg.includes('timeout') || msg.includes('timed out')) return true;
    if (msg.includes('403') || msg.includes('410') || msg.includes('451')) return true;
  }
  return false;
}

function logError(url: string, error: unknown): void {
  if (isExpectedError(error)) return;
  const errorKey = `${url}:${error instanceof Error ? error.message : String(error)}`;
  if (loggedErrors.has(errorKey)) return;
  if (loggedErrors.size >= LOG_ERROR_LIMIT) {
    const toDelete = Math.floor(LOG_ERROR_LIMIT / 2);
    let count = 0;
    for (const key of loggedErrors) {
      if (count >= toDelete) break;
      loggedErrors.delete(key);
      count++;
    }
  }
  loggedErrors.add(errorKey);
  console.error('[getImageUrl] Error:', error);
}

// ── Browser cache: simple blob URL cache ──
const blobCache = new Map<string, string>();
const BLOB_CACHE_MAX = 100;

function cleanupBlobCache() {
  if (blobCache.size > BLOB_CACHE_MAX) {
    const keys = Array.from(blobCache.keys());
    const toRemove = keys.slice(0, keys.length - BLOB_CACHE_MAX);
    for (const key of toRemove) {
      const blobUrl = blobCache.get(key);
      if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
      blobCache.delete(key);
    }
  }
}

async function browserFetchImage(url: string, signal?: AbortSignal): Promise<string> {
  if (!url) return '';

  const cached = blobCache.get(url);
  if (cached) return cached;

  try {
    const resp = await fetch(url, { signal, mode: 'cors', headers: { Accept: 'image/*,*/*' } });
    if (!resp.ok) return url;
    const blob = await resp.blob();
    if (!blob.type.startsWith('image/')) return url;
    const blobUrl = URL.createObjectURL(blob);
    blobCache.set(url, blobUrl);
    cleanupBlobCache();
    return blobUrl;
  } catch {
    return url;
  }
}

// ── Main entry ──
export async function getImageUrl(url: string, fallbackUrl: string = '', signal?: AbortSignal): Promise<string> {
  try {
    let urlStr: string | undefined;
    if (Array.isArray(url)) urlStr = url[0];
    else if (typeof url === 'string') urlStr = url;
    if (urlStr) urlStr = urlStr.replaceAll(/^[\["']+|[\]"']+$/g, '');
    if (!urlStr) return fallbackUrl;
    if (signal?.aborted) throw new Error('Aborted');

    if (!isTauriEnv) {
      return await browserFetchImage(urlStr, signal);
    }

    // Tauri mode: dynamic import full cache system
    const { readFile, writeFile, mkdir, remove, readDir, rename, stat } = await import('@tauri-apps/plugin-fs');
    const { appDataDir, join } = await import('@tauri-apps/api/path');
    const { fetch } = await import('@tauri-apps/plugin-http');

    // Inline Tauri cache logic (simplified)
    const appDir = await appDataDir();
    const cacheDir = await join(appDir, 'image_cache');
    try { await mkdir(cacheDir, { recursive: true }); } catch { }
    const hashData = new TextEncoder().encode(urlStr);
    const hashBuffer = await crypto.subtle.digest('SHA-1', hashData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const filePath = await join(cacheDir, hash + '.img');

    try {
      await stat(filePath);
      const data = await readFile(filePath);
      let binary = '';
      for (let i = 0; i < data.byteLength; i++) binary += String.fromCodePoint(data[i]);
      return `data:image/jpeg;base64,${btoa(binary)}`;
    } catch {
      if (signal?.aborted) throw new Error('Aborted');
      const tauriResp = await fetch(urlStr, {
        method: 'GET',
        headers: { Accept: 'image/*,*/*', 'User-Agent': 'Mozilla/5.0' },
        connectTimeout: 20000,
      });
      if (!tauriResp.ok) throw new Error(`HTTP ${tauriResp.status}`);
      const ab = await tauriResp.arrayBuffer();
      const data = new Uint8Array(ab);
      const tempPath = filePath + '.tmp';
      await writeFile(tempPath, data);
      try { await rename(tempPath, filePath); } catch { try { await remove(filePath); await rename(tempPath, filePath); } catch { } }
      let binary = '';
      for (let i = 0; i < data.byteLength; i++) binary += String.fromCodePoint(data[i]);
      return `data:image/jpeg;base64,${btoa(binary)}`;
    }
  } catch (e) {
    logError(url, e);
    return fallbackUrl;
  }
}

export async function preloadImage(url: string): Promise<boolean> { return false; }
export async function clearImageCache(): Promise<void> {
  for (const blobUrl of blobCache.values()) { if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl); }
  blobCache.clear();
}
export async function getCacheSize(): Promise<number> { return 0; }
export async function getCacheStats() {
  return { size: 0, sizeFormatted: '0 B', fileCount: 0, maxSize: 200 * 1024 * 1024, maxSizeFormatted: '200 MB', usage: 0 };
}
export async function cacheImage(url: string, data: Uint8Array, contentType?: string | null): Promise<string> { return url; }
export async function getCachedImage(url: string): Promise<string | null> { return null; }
export async function getCachedImageData(url: string): Promise<Uint8Array | null> { return null; }
export async function fetchAndCacheImage(url: string, signal?: AbortSignal): Promise<Uint8Array> { throw new Error('Not in Tauri'); }
export async function rebuildLruFromFs(): Promise<void> {}

export function useImageCache() {
  return {
    cacheImage: useCallback(cacheImage, []),
    getCachedImage: useCallback(getCachedImage, []),
    getCachedImageData: useCallback(getCachedImageData, []),
    fetchAndCacheImage: useCallback(fetchAndCacheImage, []),
    getImageUrl: useCallback(getImageUrl, []),
    preloadImage: useCallback(preloadImage, []),
    clearImageCache: useCallback(clearImageCache, []),
    getCacheSize: useCallback(getCacheSize, []),
    getCacheStats: useCallback(getCacheStats, []),
    rebuildLruFromFs: useCallback(rebuildLruFromFs, []),
  };
}
