// =========================
// 🎬 PLAYER — Platform-Aware Wrapper
// =========================

import React, { useState, useEffect } from 'react';
import { MpvPlayer } from './mpv/MpvPlayer';
import { ExoPlayer } from './exo/ExoPlayer';
import { useResumeStore } from '@/store/resume.store';
import { platform } from '@tauri-apps/plugin-os';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────
const PlayerComponent: React.FC<PlayerProps> = ({
  url, name, channelId, client, buffering = false, isVod = false, movieId, resumePosition = 0, genreId, onClose, onEnded, onNextEpisode, onChannelChange,
}) => {
  const { setPosition } = useResumeStore();
  const [currentPlatform, setCurrentPlatform] = useState<string>('desktop');
  const [isLoading, setIsLoading] = useState(true);

  // Detect platform using OS plugin
  useEffect(() => {
    const detectPlatform = () => {
      try {
        const osPlatform = platform(); // 'android' | 'ios' | 'windows' | 'macOS' | 'linux'
        setCurrentPlatform(osPlatform);
      } catch {
        // Plugin not available - assume desktop
        setCurrentPlatform('desktop');
      } finally {
        setIsLoading(false);
      }
    };
    detectPlatform();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Use ExoPlayer for Android, MPV for desktop (Linux/Windows/macOS)
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
};

export const Player = React.memo(PlayerComponent);
