import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface BrowserPlayerProps {
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

const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
const proxyBase = typeof window !== 'undefined' ? window.location.origin + '/api/proxy' : '';

function proxyUrl(originalUrl: string): string {
  if (!isHttps || originalUrl.startsWith(proxyBase)) return originalUrl;
  if (originalUrl.startsWith('http://')) {
    return proxyBase + '?url=' + encodeURIComponent(originalUrl);
  }
  return originalUrl;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

const BrowserPlayerComponent: React.FC<BrowserPlayerProps> = ({
  url, name, isVod, onClose, onEnded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadAttempted, setLoadAttempted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const proxiedUrl = useMemo(() => proxyUrl(url), [url]);

  const cleanup = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.load();
    }
  }, []);

  const playStream = useCallback(async (streamUrl: string, attempt: number = 0) => {
    setError(null);
    setIsPlaying(false);
    setLoadAttempted(true);

    const video = videoRef.current;
    if (!video) return;

    const originalUrl = url;
    const isM3u8 = originalUrl.includes('.m3u8') || originalUrl.includes('extension%3Dm3u8');
    const isMpd = originalUrl.includes('.mpd') || originalUrl.includes('extension%3Dmpd');
    const isTs = /extension(=|%3D)(ts|mpegts|m2ts|flv)/i.test(originalUrl) || /\.(ts|mpegts|m2ts|flv)(\?|$|&)/i.test(originalUrl) || originalUrl.includes('video/mp2t');

    const handleError = (e: any, message: string) => {
      console.error(`[Player] ${message} (Attempt ${attempt + 1}/${MAX_RETRIES}):`, e);
      if (attempt < MAX_RETRIES) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          playStream(streamUrl, attempt + 1);
        }, RETRY_DELAY_MS * (attempt + 1));
      } else {
        setError(message + '. Max retries reached. Try another stream or app.');
        setIsPlaying(false);
      }
    };

    const loadWithNativeVideo = (src: string) => {
      video.src = src;
      video.load();
      video.play().then(() => {
        setIsPlaying(true);
      }).catch((e: DOMException) => {
        if (e.name === 'NotAllowedError') {
          handleError(e, 'Click to play (autoplay blocked)');
        } else if (e.name === 'MediaError') {
          handleError(e, 'Unsupported video/audio codec or format.');
        } else {
          handleError(e, 'Cannot play stream with native video.');
        }
      });
    };

    try {
      if (isM3u8) {
        const Hls = (await import('hls.js')).default;
        if (!Hls.isSupported || !Hls.isSupported()) {
          loadWithNativeVideo(streamUrl);
          return;
        }
        const hls = new Hls({
          // Config for retries
          fragLoadingMaxRetry: MAX_RETRIES,
          levelLoadingMaxRetry: MAX_RETRIES,
          manifestLoadingMaxRetry: MAX_RETRIES,
          autoStartLoad: true,
          maxBufferLength: 30, // seconds
          maxMaxBufferLength: 60, // seconds
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (data.fatal) {
            hls.destroy();
            handleError(data, `HLS fatal error: ${data.details}.`);
          } else {
            // Non-fatal, hls.js might recover or try again
            console.warn('[Player] HLS non-fatal error:', data.details);
          }
        });
      } else if (isMpd) {
        const dashjs = (await import('dashjs')).default;
        if (!dashjs.supportsMediaSource) {
          loadWithNativeVideo(streamUrl);
          return;
        }
        const player = dashjs.MediaPlayer().create();
        player.initialize(video, streamUrl, !isVod);
        player.on('error', (e: any) => {
          player.reset();
          handleError(e, 'DASH playback error.');
        });
        player.on('playback_started', () => {
          setIsPlaying(true);
        });
      } else if (isTs) {
        const mpegts = (await import('mpegts.js')).default as any;
        if (!mpegts.isSupported || !mpegts.isSupported()) {
          loadWithNativeVideo(streamUrl);
          return;
        }
        const player = mpegts.createPlayer({
          type: 'mpegts',
          url: streamUrl,
          isLive: !isVod,
        }, {
          enableWorker: false,
          liveBufferLatencyChasing: true,
          lazyLoad: true,
          lazyLoadMaxDuration: 30,
          // mpegts.js does not have explicit retry config, relying on `on('error')`
        });
        player.attachMediaElement(video);
        player.load();
        player.on('error', (e: any) => {
          player.unload();
          player.detachMediaElement();
          handleError(e, 'MPEG-TS playback error.');
        });
        player.on('playing', () => {
          setIsPlaying(true);
        });
        player.play();
      } else {
        loadWithNativeVideo(streamUrl);
      }
    } catch (e) {
      handleError(e, 'Player initialization failed.');
    }
  }, [proxiedUrl, isVod]); // proxiedUrl as dependency

  useEffect(() => {
    if (!url) return;
    cleanup();
    setRetryCount(0);
    setLoadAttempted(false); // Reset loadAttempted to show spinner initially
    playStream(proxiedUrl, 0);
  }, [url, proxiedUrl, cleanup, playStream]);

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
          onClick={() => { if (videoRef.current?.paused) videoRef.current.play().catch(() => {}); }}
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center p-6 max-w-md">
              <p className="text-red-400 text-lg mb-2">Playback Error</p>
              <p className="text-gray-400 text-sm mb-4">{error} {retryCount > 0 && `(Retried ${retryCount} time${retryCount > 1 ? 's' : ''})`}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
        {!isPlaying && !error && loadAttempted && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400">Loading...</p>
          </div>
        )}
        {!isPlaying && !error && !loadAttempted && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export const BrowserPlayer = React.memo(BrowserPlayerComponent);
