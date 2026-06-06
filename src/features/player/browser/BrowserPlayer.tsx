import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import type { PlayerProps } from '../mpv/mpv.types';

const BrowserPlayerComponent: React.FC<PlayerProps> = ({
  url, name, isVod, onClose, onEnded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const cleanup = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      mpegtsRef.current.destroy();
      mpegtsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.src = '';
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    cleanup();
    setError(null);
    setIsPlaying(false);

    const loadStream = () => {
      if (url.endsWith('.m3u8') || url.includes('.m3u8')) {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              setError('HLS playback error');
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
          video.play().catch(() => {});
        } else {
          setError('HLS not supported in this browser');
        }
      } else if (url.endsWith('.ts') || url.includes('.ts')) {
        if (mpegts.isSupported()) {
          const player = mpegts.createPlayer({
            type: 'mpegts',
            url: url,
            isLive: !isVod,
          });
          mpegtsRef.current = player;
          player.attachMediaElement(video);
          player.load();
          player.play();
        } else {
          video.src = url;
          video.play().catch(() => setError('Cannot play this stream'));
        }
      } else {
        video.src = url;
        video.play().catch(() => setError('Cannot play this stream'));
      }
    };

    loadStream();

    return cleanup;
  }, [url, cleanup, isVod]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 z-10">
        <span className="text-white text-sm font-medium truncate">{name}</span>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white px-2 py-1"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 relative flex items-center justify-center">
        <video
          ref={videoRef}
          className="max-w-full max-h-full"
          controls
          autoPlay
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={onEnded}
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center p-6">
              <p className="text-red-400 text-lg mb-2">Playback Error</p>
              <p className="text-gray-400 text-sm">{error}</p>
            </div>
          </div>
        )}
        {!isPlaying && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export const BrowserPlayer = React.memo(BrowserPlayerComponent);
