import { StalkerClient } from '@/lib/stalkerAPI_new';

export type StreamState = 'connecting' | 'playing' | 'stalled' | 'retrying' | 'dead';

export interface Track {
  id: string;
  type: 'audio' | 'sub' | 'video';
  title?: string;
  lang?: string;
  selected?: boolean;
}

export interface PlayerProps {
  url: string;
  name: string;
  channelId?: number;
  client?: StalkerClient;
  buffering?: boolean;
  isVod?: boolean;
  movieId?: string;
  resumePosition?: number;
  genreId?: string;
  onClose: () => void;
  onEnded?: () => void;
  onNextEpisode?: () => void;
  onChannelChange?: (channel: any) => void;
}
