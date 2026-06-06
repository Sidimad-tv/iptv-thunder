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
  // Only proxy HTTP URLs from HTTPS pages to avoid mixed content
  if (originalUrl.startsWith('http://')) {
    return proxyBase + '?url=' + encodeURIComponent(originalUrl);
  }
  return originalUrl;
}

const BrowserPlayerComponent: React.FC<BrowserPlayerProps> = ({
  url, name, isVod, onClose, onEnded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadAttempted, setLoadAttempted] = useState(false);

  // Proxy the URL if needed (HTTPS page + HTTP stream)
  const proxiedUrl = useMemo(() => proxyUrl(url), [url]);

  const cleanup = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.load();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    cleanup();
    setError(null);
    setIsPlaying(false);
    setLoadAttempted(false);

    const isM3u8 = url.includes('.m3u8');
    const isTs = url.includes('.ts') || url.includes('extension=ts') || url.includes('extension=mpegts');

    const loadWithNativeVideo = (src: string) => {
      video.src = src;
      video.load();
      video.play().then(() => {
        setIsPlaying(true);
        setLoadAttempted(true);
      }).catch((e) => {
        setLoadAttempted(true);
        if (e.name === 'NotAllowedError') {
          setError('Click to play (autoplay blocked)');
        } else {
          setError('Cannot play this stream. Try using the Tauri desktop app for better playback support.');
        }
      });
    };

    const tryMpegts = async () => {
      try {
        const mpegts = await import('mpegts.js');
        if (!mpegts.isSupported || !mpegts.isSupported()) {
          loadWithNativeVideo(proxiedUrl);
          return;
        }
        const player = mpegts.createPlayer({
          type: 'mpegts',
          url: proxiedUrl,
          isLive: !isVod,
        }, {
          enableWorker: false,
          liveBufferLatencyChasing: true,
          lazyLoad: true,
          lazyLoadMaxDuration: 30,
        });
        player.attachMediaElement(video);
        player.load();
        player.on('error', (err: any) => {
          player.unload();
          player.detachMediaElement();
          loadWithNativeVideo(proxiedUrl);
        });
        player.on('playing', () => {
          setIsPlaying(true);
          setLoadAttempted(true);
        });
        player.play();
      } catch {
        loadWithNativeVideo(proxiedUrl);
      }
    };

    const tryHls = async () => {
      try {
        const Hls = (await import('hls.js')).default;
        if (!Hls.isSupported || !Hls.isSupported()) {
          loadWithNativeVideo(proxiedUrl);
          return;
        }
        const hls = new Hls();
        hls.loadSource(proxiedUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            hls.destroy();
            loadWithNativeVideo(proxiedUrl);
          }
        });
      } catch {
        loadWithNativeVideo(proxiedUrl);
      }
    };

    if (isM3u8) {
      tryHls();
    } else if (isTs) {
      tryMpegts();
    } else {
      loadWithNativeVideo(proxiedUrl);
    }

    return cleanup;
  }, [url, proxiedUrl, cleanup, isVod]);

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
              <p className="text-gray-400 text-sm mb-4">{error}</p>
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
