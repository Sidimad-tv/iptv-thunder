export interface StalkerAccount {
  id: string;
  name: string;
  portalUrl: string;        // np. "http://example.com:8080/c/" lub "/stalker_portal/c/"
  mac: string;              // format: 00:1A:79:XX:XX:XX
  token?: string;
  expiresAt?: Date;
  expiry?: Date;            // alias dla expiresAt (kompatybilność)
  profile?: any;            // dane z get_profile
  lastUsed: Date;
  isActive: boolean;
  streamingUrl?: string;    // URL do streamingu
  login?: string;           // login użytkownika
}

export interface HandshakeResponse {
  js: {
    token: string;
    [key: string]: any;
  };
}

export interface StalkerAuthResponse {
  token: string;
  expiresAt?: Date;
}

export interface StalkerProfile {
  id: number;
  login: string;
  status: string;
  stb_type: string;
  hd: boolean;
  num_bouquets: number;
  ls: number;
  [key: string]: any;
}

export interface StalkerChannel {
  id: number | string;
  name: string;
  cmd: string;
  logo_url?: string;
  logo?: string;
  number: number;
  censored: boolean;
  cmd_1?: string;
  cmd_2?: string;
  cmd_3?: string;
  tv_genre_id?: number | string;
  hd?: boolean | number;
  enable?: boolean;
}

export interface StalkerGenre {
  id: string;           // np. "179"
  title: string;        // nazwa kategorii
  alias?: string;
  [key: string]: any;
}

export interface ChannelsResponse {
  js: {
    data: StalkerChannel[];
    total_items?: number;
    max_page_items?: number;
  };
}

export interface StalkerVOD {
  id: number;
  name: string;
  cmd: string;
  description: string;
  o_name?: string;
  s_name?: string;
  year?: number;
  rating_imdb?: number;
  rating_kinopoisk?: number;
  country?: string;
  genre?: string;
  genres_str?: string;
  director?: string;
  actors?: string;
  logo?: string;
  season?: number | string;
  episode?: number | string;
  episodeName?: string;
  series?: string | boolean;
  length?: number;
  poster?: string;
  added: string;
  censored: boolean;
  local?: boolean;
  remux?: boolean;
  '3d'?: boolean;
}

export interface StalkerEPG {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  description?: string;
  category_id?: number;
  category?: string;
  channel_id: number;
  ch_short_name?: string;
  display_name?: string;
  rating?: number;
  director?: string;
  actors?: string;
  year?: string;
  icon?: string;
}

export interface FavoriteChannel {
  id: string;
  accountId: string;
  channelId: number;
  channelName: string;
  channelNumber: number;
  addedAt: Date;
}

export interface WatchHistory {
  id: string;
  accountId: string;
  channelId: number;
  channelName: string;
  watchedAt: Date;
  duration: number;
}

export interface AppSettings {
  language: 'en' | 'pl' | 'de';
  autoConnect: boolean;
  bufferTime: number;
  mpvPath?: string;
}

export interface StreamStats {
  url: string;
  successRate: number;
  priority: number;
  attempts: number;
  lastAttempt: number;
}
