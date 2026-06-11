export type M3uSourceType = 'url' | 'xtream' | 'file';

export type M3uContentType = 'live' | 'movie' | 'series';

export interface M3uChannel {
  id: string;
  name: string;
  logo: string;
  group: string;
  streamUrl: string;
  tv_genre_id?: string;
  number?: number;
  contentType?: M3uContentType;
}

export interface M3uCategory {
  id: string;
  title: string;
}

export interface M3uAccount {
  id: string;
  name: string;
  sourceType: M3uSourceType;
  // Direct M3U URL
  url?: string;
  // Xtream credentials
  serverUrl?: string;
  username?: string;
  password?: string;
  // Loaded content info
  channelCount?: number;
  lastLoaded?: Date;
  channels?: M3uChannel[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  tags?: string[];
}

export interface M3uFormData {
  name: string;
  sourceType: M3uSourceType;
  url: string;
  serverUrl: string;
  username: string;
  password: string;
  description?: string;
  tags?: string[];
}
