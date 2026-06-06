import axios, { AxiosInstance } from 'axios';
import { TauriHttpClient } from './tauriHttp';
import { StalkerAccount, HandshakeResponse, StalkerProfile, StalkerChannel, StalkerGenre, StalkerVOD, StalkerEPG } from '@/types';
import { createLogger, createDebugRequestContext, logDebugRequest, logDebugSuccess, logDebugError } from './logger';
import { platform } from '@tauri-apps/plugin-os';

// Re-export types for consumers
export type { StalkerAccount, StalkerProfile, StalkerChannel, StalkerGenre, StalkerVOD, StalkerEPG } from '@/types';

// Import Tauri API to ensure it's available
import '@tauri-apps/api';

// Extend Window interface for TypeScript
declare global {
  interface Window {
    __STALKER_CLIENT_LOGGED__?: boolean;
  }
}

const USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250 Safari/533.3';

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
const DEFAULT_LANGUAGE = navigator.language || 'en-US';

export class StalkerClient {
  private readonly axios: AxiosInstance;
  private readonly tauriHttp: TauriHttpClient | null;
  private readonly account: StalkerAccount;
  private readonly logger = createLogger('StalkerClient');
  public readonly useTauri: boolean;
  token: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(account: StalkerAccount, options?: { timezone?: string; timeout?: number }) {
    this.account = account;
    const timezone = options?.timezone ?? DEFAULT_TIMEZONE;
    
    // Detect Tauri environment using OS plugin (most reliable)
    let osPlatform: string | null;
    try {
      osPlatform = platform(); // Returns 'android' | 'ios' | 'windows' | 'macos' | 'linux' | etc.
    } catch (e) {
      // OS plugin not available - not in Tauri
      this.logger.debug('Platform detection failed, not in Tauri', e);
      osPlatform = null;
    }

    // Fallback detection methods
    const hasTauriAPI = globalThis.window !== undefined && '__TAURI__' in globalThis.window;
    const isTauriBuild = (globalThis as any).__TAURI_BUILD__ === true;
    const isLocalhost = globalThis.window !== undefined &&
                       (globalThis.window.location.hostname === 'localhost' ||
                        globalThis.window.location.hostname === '127.0.0.1' ||
                        globalThis.window.location.hostname === 'tauri.localhost' || // Android/iOS WebView
                        globalThis.window.location.protocol === 'tauri:');

    // Use Tauri HTTP if OS plugin detected a platform OR any fallback indicator
    this.useTauri = !!osPlatform || hasTauriAPI || isTauriBuild || isLocalhost;

    // Sanitize portalUrl - remove null bytes and other problematic characters
    const sanitizedPortalUrl = account.portalUrl.replaceAll('\x00', '').trim();

    // Ensure URL ends with /c/ (required by Stalker middleware)
    let baseURL = sanitizedPortalUrl.endsWith('/')
      ? sanitizedPortalUrl
      : sanitizedPortalUrl + '/';

    if (!baseURL.endsWith('/c/') && !baseURL.endsWith('/stalker_portal/')) {
      baseURL = baseURL.replace(/\/$/, '');
      baseURL += '/c/';
    }

    // Log only once per session to avoid spam
    if (!globalThis.window.__STALKER_CLIENT_LOGGED__) {
      console.log('StalkerClient environment detection:', {
        useTauri: this.useTauri,
        osPlatform,
        hasTauriAPI,
        isTauriBuild,
        isLocalhost,
        hostname: globalThis.window.location.hostname,
        protocol: globalThis.window.location.protocol,
        tauriEnv: (globalThis as any).__TAURI_BUILD__
      });
      globalThis.window.__STALKER_CLIENT_LOGGED__ = true;
    }

    if (this.useTauri) {
      // Use Tauri HTTP client - no CORS issues!
      // Cookie with MAC is required for EPG and other requests
      const cookieHeader = `mac=${this.account.mac}; stb_lang=${DEFAULT_LANGUAGE}; timezone=${timezone}`;
      this.tauriHttp = new TauriHttpClient(baseURL, {
        'User-Agent': USER_AGENT,
        'X-User-Agent': USER_AGENT,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': cookieHeader,
        'Connection': 'keep-alive',
      });
      this.axios = {} as AxiosInstance; // Placeholder - won't be used
    } else {
      // Use Axios for browser development - will have CORS issues
      const cookieHeader = `mac=${this.account.mac}; stb_lang=${DEFAULT_LANGUAGE}; timezone=${timezone}`;
      const timeout = options?.timeout ?? 15000;
      this.axios = axios.create({
        baseURL,
        timeout,
        withCredentials: true,
        headers: {
          'User-Agent': USER_AGENT,
          'X-User-Agent': USER_AGENT,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': cookieHeader,
          'Connection': 'keep-alive',
        },
      });
      this.tauriHttp = null;
    }
  }

  /**
   * Główny handshake – zwraca token
   */
  async handshake(): Promise<string> {
    const params = {
      type: 'stb',
      action: 'handshake',
      mac: this.account.mac,
      JsHttpRequest: '1-xml',
    };

    // Request debug tracking
    const ctx = createDebugRequestContext('handshake', params);

    let response: any;
    
    try {
      if (this.useTauri && this.tauriHttp) {
        response = await this.tauriHttp.get('portal.php', params);
      } else {
        response = await this.axios.get('portal.php', { params });
      }

      const data = this.useTauri ? response : response.data as HandshakeResponse;

      if (!data?.js?.token) {
        throw new Error('Handshake failed - no token received');
      }

      this.token = data.js.token;
      this.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      try {
        (this.account as any).token = data.js.token;
        (this.account as any).expiresAt = this.tokenExpiresAt;
      } catch (e) {
        this.logger.debug('Could not update account token (frozen)', e);
      }

      if (!this.useTauri && this.axios.defaults) {
        this.axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      } else if (this.useTauri && this.tauriHttp) {
        this.tauriHttp.setHeader('Authorization', `Bearer ${this.token}`);
      }

      if (!this.token) {
        throw new Error('Handshake failed - token is null');
      }

      logDebugSuccess(ctx, { token: this.token.substring(0, 10) + '...' });
      this.logger.info('Handshake successful');
      return this.token;

    } catch (error) {
      logDebugError(ctx, error);
      this.logger.error('Handshake failed', error);
      throw error;
    }
  }

  /**
   * Pobranie profilu użytkownika (ważne – potwierdza aktywne konto)
   */
  async getProfileAndAuth(): Promise<StalkerProfile> {
    await this.ensureAuthenticated();

    const params = {
      type: 'stb',
      action: 'get_profile',
      mac: this.account.mac,
      hd: '1',
      JsHttpRequest: '1-xml',
    };

    let response: any;
    
    if (this.useTauri && this.tauriHttp) {
      response = await this.tauriHttp.get('portal.php', params);
    } else {
      response = await this.axios.get('portal.php', { params });
    }

    const profile = this.useTauri ? response?.js : response.data?.js;

    if (!profile) {
      throw new Error('Get profile failed');
    }

    return profile;
  }

  /**
   * Alias for getProfileAndAuth() - for backward compatibility
   */
  async getProfile(): Promise<StalkerProfile> {
    return this.getProfileAndAuth();
  }

  /**
   * Get channel list (alias for getChannelsWithPagination without pagination)
   */
  async getChannels(genreId: string = '*'): Promise<StalkerChannel[]> {
    const result = await this.getChannelsWithPagination(genreId, 1);
    return result.channels;
  }

  /**
   * Get channel genres
   */
  async getGenres(): Promise<StalkerGenre[]> {
    await this.ensureAuthenticated();

    const params = {
      type: 'itv',
      action: 'get_genres',
      mac: this.account.mac,
      JsHttpRequest: '1-xml',
    };

    const response = await this._makeRequest(params);
    return this.useTauri ? (response?.js || []) : (response.data?.js || []);
  }

  /**
   * Get VOD list (alias for getVODListWithPagination without pagination)
   */
  async getVODList(page: number = 1): Promise<StalkerVOD[]> {
    const result = await this.getVODListWithPagination('', page);
    return result.items;
  }

  /**
   * Create link for streaming
   */
  async createLink(cmd: string, streamId?: number): Promise<string> {
    return this.getStreamUrl(cmd, streamId ? { streamId: String(streamId) } : undefined);
  }

  /**
   * Check if token is valid
   */
  isTokenValid(): boolean {
    if (!this.token) return false;
    if (!this.tokenExpiresAt) return false;
    return new Date() < this.tokenExpiresAt;
  }

  /**
   * Pobieranie informacji o koncie (data ważności)
   */
  async getAccountInfo(): Promise<{ mac?: string; phone?: string }> {
    await this.ensureAuthenticated();

    const params = {
      type: 'account_info',
      action: 'get_main_info',
      JsHttpRequest: '1-xml',
    };

    let response: any;

    if (this.useTauri && this.tauriHttp) {
      response = await this.tauriHttp.get('portal.php', params);
    } else {
      response = await this.axios.get('portal.php', { params });
    }

    const data = this.useTauri ? response?.js : response.data?.js;

    if (!data) {
      this.logger.debug('getAccountInfo failed - no data');
      return {};
    }

    return data;
  }

  /**
   * Pełne logowanie (handshake + get_profile)
   */
  async login(): Promise<StalkerAccount> {
    await this.handshake();
    await this.getProfileAndAuth();
    return this.account;
  }

  /**
   * Pobieranie listy VOD z informacjami o paginacji
   */
  async getVODListWithPagination(categoryId: string = '', page: number = 1, options?: { signal?: AbortSignal; search?: string }): Promise<{items: StalkerVOD[], totalItems: number, maxPageItems: number, currentPage: number, hasMore: boolean}> {
    await this.ensureAuthenticated();

    const params = this.buildVODListParams(categoryId, page, options?.search);
    const response = await this._makeRequest(params, options?.signal);
    const parsed = this.parseVODResponse(response);

    if (options?.search?.trim()) {
      return this.fetchAllSearchResults(params, parsed, categoryId, options.signal);
    }

    return this.buildVODResult(parsed, page);
  }

  private buildVODListParams(categoryId: string, page: number, search?: string): Record<string, string> {
    const params: Record<string, string> = {
      type: 'vod',
      action: 'get_ordered_list',
      p: page.toString(),
      sortby: 'added',
      hd: '0',
      mac: this.account.mac,
      JsHttpRequest: '1-xml',
      max_page_items: '100',
    };

    if (categoryId && categoryId !== '*' && categoryId !== '') {
      params.category = categoryId;
    }

    const searchTrimmed = search?.trim();
    if (searchTrimmed) {
      params.search = searchTrimmed.toLowerCase();
    }

    return params;
  }

  private parseVODResponse(response: any): { vods: any[], totalItems: number, maxPageItems: number } {
    const js = this.useTauri ? response?.js : response?.data?.js;
    const vods = js?.data || js || [];
    return {
      vods,
      totalItems: js?.total_items ?? 0,
      maxPageItems: js?.max_page_items ?? 30,
    };
  }

  private async fetchAllSearchResults(params: Record<string, string>, parsed: { vods: any[], totalItems: number, maxPageItems: number }, categoryId: string, signal?: AbortSignal): Promise<{items: StalkerVOD[], totalItems: number, maxPageItems: number, currentPage: number, hasMore: boolean}> {
    const { vods, totalItems, maxPageItems } = parsed;
    const totalPages = Math.ceil(totalItems / maxPageItems);

    let allVods = [...vods];

    if (totalPages > 1) {
      for (let p = 2; p <= totalPages; p++) {
        const pageResp = await this._makeRequest({ ...params, p: p.toString() }, signal);
        const pageParsed = this.parseVODResponse(pageResp);
        allVods.push(...pageParsed.vods);
      }
    }

    const filteredVods = categoryId
      ? allVods.filter((v: any) => String(v.category_id) === String(categoryId))
      : allVods;

    return {
      items: this.enrichVODs(filteredVods),
      totalItems: filteredVods.length,
      maxPageItems,
      currentPage: 0,
      hasMore: false
    };
  }

  private buildVODResult(parsed: { vods: any[], totalItems: number, maxPageItems: number }, page: number) {
    const { vods, totalItems, maxPageItems } = parsed;
    const currentPage = page - 1;
    const totalPages = Math.ceil(totalItems / maxPageItems);
    const hasMore = currentPage < totalPages - 1 && vods.length > 0;

    return {
      items: this.enrichVODs(vods),
      totalItems,
      maxPageItems,
      currentPage,
      hasMore
    };
  }

  private enrichVODs(vods: any[]): StalkerVOD[] {
    return vods.map((vod: StalkerVOD) => ({
      ...vod,
      logo: this.resolveLogoUrl(vod.logo),
      poster: this.resolvePosterUrl(vod),
    }));
  }

  /**
   * Pobieranie kategorii VOD
   */
  async getVODCategories(): Promise<StalkerGenre[]> {
    await this.ensureAuthenticated();

    // Wywołaj getProfileAndAuth aby aktywować sesję - to może być wymagane aby dostać pełną listę kategorii
    this.logger.debug('Calling getProfileAndAuth for VOD categories');
    await this.getProfileAndAuth();

    const params = {
      type: 'vod',
      action: 'get_categories',
      mac: this.account.mac,
      JsHttpRequest: '1-xml',
    };
    const response = await this._makeRequest(params);
    
    return this.useTauri ? (response?.js || []) : (response.data?.js || []);
  }

  /**
 * Pobieranie szczegółów pojedynczego VOD
 */
async getVODDetails(vodId: string): Promise<StalkerVOD> {
  if (!this.token) await this.handshake();

  const params = {
    type: 'vod',
    action: 'get_details',
    vod_id: vodId,
    mac: this.account.mac,
    JsHttpRequest: '1-xml',
  };

  const response = await this._makeRequest(params);
  return this.useTauri ? response?.js : response.data?.js;
}

  async _makeRequest(params: any, signal?: AbortSignal): Promise<any> {
    await this.ensureAuthenticated();
    return this._makeGenericRequest('portal.php', params, signal);
  }

  private async _makeGenericRequest(endpoint: string, params: any, signal?: AbortSignal): Promise<any> {
    if (signal?.aborted) {
      throw new Error('Request aborted');
    }

    // Debug tracking
    const ctx = createDebugRequestContext(params.action || endpoint, { endpoint, params });
    logDebugRequest(ctx);
    
    let response: any;
    try {
      if (this.useTauri && this.tauriHttp) {
        response = await this.tauriHttp.get(endpoint, params);
      } else {
        response = await this.axios.get(endpoint, { params, signal });
      }
      
      logDebugSuccess(ctx, this.useTauri ? response : response.data);
      return response;
      
    } catch (error) {
      logDebugError(ctx, error);
      this.logger.error(`Request failed: ${params.action || endpoint}`, error);
      throw error;
    }
  }

  /**
   * Pobranie linku do strumienia VOD
   */
  async getVODUrl(vodCmd: string): Promise<string> {
    await this.ensureAuthenticated();

    const response = await this._makeRequest({
      type: 'vod',
      action: 'create_link',
      cmd: vodCmd,
      mac: this.account.mac,
      JsHttpRequest: '1-xml',
    });

    const url = this.useTauri ? response?.js?.cmd : response.data?.js?.cmd;
    if (!url) {
      throw new Error(`Failed to get VOD stream URL`);
    }

    return url;
  }

  /**
   * Pobranie short EPG dla kanału (bez parametrów from/to - te są tylko dla pełnego EPG)
   */
  async getEPG(channelId: number, size: number = 10): Promise<StalkerEPG[]> {
    await this.ensureAuthenticated();

    const params: any = {
      type: 'itv',
      action: 'get_short_epg',
      ch_id: channelId.toString(),
      size: size.toString(),
      JsHttpRequest: '1-xml',
    };

    const response = await this._makeRequest(params);
    const rawEpg = this.useTauri ? (response?.js || []) : (response.data?.js || []);

    if (!Array.isArray(rawEpg)) {
      return [];
    }
    
    // Map API fields to StalkerEPG interface
    // API returns: start_timestamp, stop_timestamp, descr, ch_id
    // StalkerEPG expects: start_time, end_time, description, channel_id
    return rawEpg.map((item: any) => ({
      id: Number(item.id),
      name: item.name,
      description: item.descr || item.description || '',
      start_time: String(item.start_timestamp || item.start_time || ''),
      end_time: String(item.stop_timestamp || item.end_time || ''),
      channel_id: Number(item.ch_id || item.channel_id || 0),
      category_id: item.category_id,
      ch_short_name: item.ch_short_name,
      display_name: item.display_name,
      rating: item.rating,
      director: item.director,
      actors: item.actor || item.actors,
      year: item.year,
      icon: item.icon,
    }));
  }

  getAccount(): StalkerAccount {
    return this.account;
  }

  // ==================== AUTH & HTTP HELPERS ====================

  /**
   * Ensure we have a valid token (handshake if needed)
   */
  async ensureAuthenticated(): Promise<void> {
    if (this.token && this.isTokenValid()) {
      return;
    }
    await this.handshake();
  }

  /**
   * Check if error is auth-related
   */
  private isAuthError(error: any): boolean {
    const msg = String(error?.message || '').toLowerCase();
    return (
      msg.includes('403') ||
      msg.includes('access denied') ||
      msg.includes('token') ||
      msg.includes('authorization') ||
      msg.includes('unauthorized')
    );
  }

  /**
   * Execute operation with automatic retry on auth errors
   */
  private async withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (this.isAuthError(error)) {
        await this.handshake();
        return await operation();
      }
      throw error;
    }
  }
  // ==================== URL RESOLVERS ====================

  /**
   * Resolve logo URL - handles both absolute and relative logo paths
   */
  resolveLogoUrl(logo: string | undefined): string | undefined {
    if (!logo) return undefined;
    if (logo.startsWith('http')) return logo;
    return `${this.account.portalUrl}misc/logos/${logo}`;
  }

  /**
   * Normalize portal URL to ensure it has a protocol
   */
  private normalizeBaseUrl(): string {
    let baseUrl = this.account.portalUrl;
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'http://' + baseUrl;
    }
    return baseUrl;
  }

  /**
   * Resolve poster URL - handles different field names for VOD posters
   * Returns array of possible URLs for fallback handling
   */
  resolvePosterUrl(vod: any): string | undefined {
    const posterFields = ['screenshot_uri', 'poster', 'screenshot', 'img', 'fname', 'cover', 'thumbnail', 'picture', 'image'];

    for (const field of posterFields) {
      const value = vod[field];
      if (this.isValidPosterValue(value)) {
        const fullValue = value.trim();

        if (fullValue.startsWith('http')) {
          return fullValue;
        }

        const baseUrl = this.normalizeBaseUrl();
        const pathPart = fullValue.startsWith('/') ? fullValue.substring(1) : fullValue;
        return `${baseUrl}misc/posters/${pathPart}`;
      }
    }

    if (vod.id) {
      const baseUrl = this.normalizeBaseUrl();
      return `${baseUrl}misc/posters/${vod.id}.jpg`;
    }

    return undefined;
  }

  /**
   * Check if a value is a valid non-empty string for poster
   */
  private isValidPosterValue(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '';
  }

  async getChannelsWithPagination(genreId: string = '*', page: number = 1, signal?: AbortSignal): Promise<{channels: StalkerChannel[], totalItems: number, maxPageItems: number, currentPage: number, hasMore: boolean}> {
    await this.ensureAuthenticated();
    
    return this.withAuthRetry(async () => {
      const result = await this._getChannelsInternal(genreId, page, signal);
      const totalPages = Math.ceil(result.totalItems / result.maxPageItems);
      const currentPageZeroBased = page - 1;
      const hasMore = currentPageZeroBased < totalPages - 1 && result.channels.length > 0;
      return {
        ...result,
        hasMore
      };
    });
  }

  private async _getChannelsInternal(genreId: string, page: number, signal?: AbortSignal): Promise<{channels: StalkerChannel[], totalItems: number, maxPageItems: number, currentPage: number}> {
    const params: any = {
      type: 'itv',
      action: 'get_ordered_list',
      mac: this.account.mac,
      p: page.toString(),
      sortby: 'number',
      hd: '0',
      fav: '0',
      JsHttpRequest: '1-xml'
    };

    if (genreId !== '*') {
      params.genre = genreId;
    }

    const response = await this._makeRequest(params, signal);

    const data = this.useTauri ? (response?.js?.data || []) : (response.data?.js?.data as StalkerChannel[] || []);
    const totalItems = this.useTauri ? (response?.js?.total_items || 0) : (response.data?.js?.total_items || 0);
    const maxPageItems = this.useTauri ? response?.js?.max_page_items : response.data?.js?.max_page_items;
    const currentPage = this.useTauri ? response?.js?.cur_page : response.data?.js?.cur_page || page;

    return {
      channels: data.map((ch: StalkerChannel) => ({
        ...ch,
        logo: this.resolveLogoUrl(ch.logo),
      })),
      totalItems,
      maxPageItems,
      currentPage
    };
  }

  /**
   * Pobieranie linku do odtwarzania (cmd → pełny URL strumienia)
   */
  async getStreamUrl(cmd: string, options?: { signal?: AbortSignal; genreId?: string; streamId?: string }): Promise<string> {
    await this.ensureAuthenticated();

    // Replace MAC in cmd with current account MAC
    const currentMac = this.account.mac;
    const cmdWithCorrectMac = cmd.replace(/mac=([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/, `mac=${currentMac}`);

    // Extract stream ID from cmd if not provided in options (e.g., stream=1929427)
    const extractedStreamId = /stream[=:](\d+)/.exec(cmdWithCorrectMac)?.[1];
    const streamId = options?.streamId ?? extractedStreamId;

    const params: any = {
      type: cmdWithCorrectMac.startsWith('eyJ') ? 'vod' : 'itv',
      action: 'create_link',
      cmd: cmdWithCorrectMac,
      mac: currentMac,
      JsHttpRequest: '1-xml',
    };
    if (streamId) params.stream = streamId;
    if (options?.genreId) params.genre = options.genreId;

    const response = await this._makeRequest(params, options?.signal);
    const streamUrl = this.useTauri ? response?.js?.cmd : response.data?.js?.cmd;

    if (!streamUrl) {
      throw new Error('Portal returned empty stream URL');
    }

    return streamUrl.replace(/^ffmpeg\s+/, '');
  }

  /**
   * Get episode stream URL with proper authentication and error handling
   */
  async getEpisodeStream(cmd: string, episode: string | number, options?: { signal?: AbortSignal }): Promise<string> {
    await this.ensureAuthenticated();

    const params: any = {
      action: 'create_link',
      cmd: cmd,
      type: 'vod',
      series: String(episode || '1'),
      disable_ad: '0',
      download: '0',
      mac: this.account.mac,
      JsHttpRequest: '1-xml',
    };

    const response = await this._makeRequest(params, options?.signal);
    const streamUrl = this.useTauri ? response?.js?.cmd : response.data?.js?.cmd;

    if (!streamUrl) {
      throw new Error('No stream URL in response for episode');
    }

    return streamUrl.replace(/^ffmpeg\s+/, '');
  }

}
