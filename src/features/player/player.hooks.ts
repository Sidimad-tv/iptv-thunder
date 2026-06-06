// =========================
// 🎬 PLAYER HOOK
// =========================
import { useState, useRef } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerChannel } from '@/types';

interface PlayerState {
  current: { url: string; name: string; channelId?: number; isVod?: boolean; movieId?: string; resumePosition?: number } | null;
  buffering: boolean;
}

export const usePlayer = (client: StalkerClient) => {
  const [current, setCurrent] = useState<PlayerState['current']>(null);
  const [buffering, setBuffering] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const play = async (channel: StalkerChannel, queryClient: QueryClient, vodFlag: boolean = false, resumePos: number = 0, movieId?: string) => {
    console.log('🎬 play() called for channel:', channel.id, channel.name);
    
    // Cancel any previous request
    if (abortRef.current) {
      console.log('🎬 Aborting previous request');
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setBuffering(true);

    try {
      // Invalidate stream cache to get fresh URL with correct MAC
      const accountId = client?.['account']?.id || 'default';
      const lastAccount = sessionStorage.getItem('playerLastAccountId');
      if (lastAccount && lastAccount !== accountId) {
        console.log('🎬 Portal changed, clearing stream cache');
        queryClient.removeQueries({ queryKey: ['stream'], exact: false });
      }
      sessionStorage.setItem('playerLastAccountId', accountId);

      const url = await queryClient.fetchQuery({
        queryKey: ['stream', channel.id, accountId],
        queryFn: () => client.getStreamUrl(channel.cmd, {
          genreId: channel.tv_genre_id?.toString() || (channel as any).genreId?.toString()
        }),
        staleTime: 2 * 60 * 1000, // Use cache for 2 minutes (allows prefetch to work)
      });

      setCurrent({ 
        url, 
        name: channel.name, 
        channelId: Number.parseInt(String(channel.id)), 
        isVod: vodFlag,
        movieId,
        resumePosition: resumePos 
      });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to play channel:', error);
      }
    } finally {
      setBuffering(false);
    }
  };

  const close = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setCurrent(null);
    setBuffering(false);
  };

  const setMedia = (media: PlayerState['current']) => {
    setCurrent(media);
  };

  return { current, buffering, play, close, setMedia };
};
