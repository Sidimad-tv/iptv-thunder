import React, { useState, useEffect, useMemo } from 'react';
import { MpvPlayer } from './mpv/MpvPlayer';
import { ExoPlayer } from './exo/ExoPlayer';
import { BrowserPlayer } from './browser/BrowserPlayer';
import { useResumeStore } from '@/store/resume.store';

interface PlayerProps {
  url: string;
  name: string;
  channelId?: number;
  client?: any;
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

const isTauriEnv = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

const PlayerComponent: React.FC<PlayerProps> = ({
  url, name, channelId, client, buffering = false, isVod = false, movieId, resumePosition = 0, genreId, onClose, onEnded, onNextEpisode, onChannelChange,
}) => {
  const { setPosition } = useResumeStore();
  const [currentPlatform, setCurrentPlatform] = useState<string>('desktop');
  const [isLoading, setIsLoading] = useState(true);

  const isBrowser = !isTauriEnv;

  useEffect(() => {
    if (isBrowser) {
      setIsLoading(false);
      return;
    }
    const detectPlatform = async () => {
      try {
        const { platform } = await import('@tauri-apps/plugin-os');
        const osPlatform = platform();
        setCurrentPlatform(osPlatform);
      } catch {
        setCurrentPlatform('desktop');
      } finally {
        setIsLoading(false);
      }
    };
    detectPlatform();
  }, [isBrowser]);

  const player = useMemo(() => {
    if (isLoading) return null;

    if (isBrowser) {
      return (
        <BrowserPlayer
          url={url}
          name={name}
          channelId={channelId}
          client={client}
          buffering={buffering}
          isVod={isVod}
          movieId={movieId}
          resumePosition={resumePosition}
          genreId={genreId}
          onClose={onClose}
          onEnded={onEnded}
        />
      );
    }

    const isMobile = currentPlatform === 'android' || currentPlatform === 'ios';

    if (isMobile) {
      return (
        <ExoPlayer
          url={url}
          name={name}
          channelId={channelId}
          client={client}
          buffering={buffering}
          isVod={isVod}
          movieId={movieId}
          resumePosition={resumePosition}
          setPosition={setPosition}
          genreId={genreId}
          onChannelChange={onChannelChange}
          onClose={onClose}
          onEnded={onEnded}
        />
      );
    }

    return (
      <MpvPlayer
        url={url}
        name={name}
        channelId={channelId}
        client={client}
        buffering={buffering}
        isVod={isVod}
        movieId={movieId}
        resumePosition={resumePosition}
        genreId={genreId}
        onChannelChange={onChannelChange}
        onClose={onClose}
        onEnded={onEnded}
        onNextEpisode={onNextEpisode}
      />
    );
  }, [isLoading, isBrowser, currentPlatform, url, name, channelId, client, buffering, isVod, movieId, resumePosition, genreId, onClose, onEnded, onNextEpisode, onChannelChange, setPosition]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return player;
};

export const Player = React.memo(PlayerComponent);
