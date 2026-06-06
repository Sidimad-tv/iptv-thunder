// =========================
// 🎬 CONTINUE WATCHING COMPONENT
// =========================
import React, { useMemo, useState, useEffect } from 'react';
import { useResumeStore, type WatchStatus } from '@/store/resume.store';
import { usePortalsStore } from '@/store/portals.store';
import { getVodByIds } from '@/hooks/useDatabase';
import { StalkerVOD } from '@/types';
import { getImageUrl } from '@/hooks/useImageCache';
import { useTranslation } from '@/hooks/useTranslation';

interface ContinueWatchingProps {
  onMovieSelect: (movie: StalkerVOD, resumePosition?: number) => void;
}

const CACHE_LIMIT = 100;
const MAX_WATCHED_SHOWN = 15; // Maximum number of recently watched movies to display
// NOTE: imageCache is module-level and not tied to a specific portal.
// IPTV poster URLs typically include the portal domain, so collisions are unlikely when switching portals.
const imageCache = new Map<string, string>();

function setCachedImage(key: string, value: string) {
  if (imageCache.size >= CACHE_LIMIT) {
    imageCache.delete(imageCache.keys().next().value as string);
  }
  imageCache.set(key, value);
}

interface MovieCardWithProgressProps {
  movie: StalkerVOD;
  progress?: { position: number; percentage: number; status: WatchStatus };
  onSelect: (movie: StalkerVOD, resumePosition?: number) => void;
}

const MovieCardWithProgress: React.FC<MovieCardWithProgressProps> = ({
  movie,
  progress,
  onSelect,
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(() =>
    imageCache.get(movie.poster || '') ?? null
  );
  const [imgError, setImgError] = useState(false);
  const isWatched = progress?.status === 'watched';

  // Recalculate percentage using movie.length from API if available for consistency
  const displayPercentage = React.useMemo(() => {
    if (!progress) return 0;
    if (isWatched) return 100;
    if (movie.length && movie.length > 0) {
      const totalSeconds = movie.length * 60;
      return totalSeconds > 0 ? Math.round((progress.position / totalSeconds) * 100) : progress.percentage;
    }
    return progress.percentage;
  }, [progress, movie.length, isWatched]);

  useEffect(() => {
    if (!progress) return;
    const posterUrl = movie.poster || '';
    if (!posterUrl || imageCache.has(posterUrl)) return;

    let cancelled = false;
    getImageUrl(posterUrl)
      .then((url) => {
        if (cancelled) return;
        setCachedImage(posterUrl, url);
        setImgSrc(url);
      })
      .catch(() => {
        if (cancelled) return;
        setImgSrc('/fallback/poster.png');
      });

    return () => { cancelled = true; };
  }, [movie.poster, progress]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}`;
    return `${m}m`;
  };

  if (!progress) return null;

  return (
    <button
      type="button"
      // For watched movies, resume from beginning (position 0); for in-progress, resume from saved position
      onClick={() => onSelect(movie, isWatched ? 0 : progress.position)}
      className="cursor-pointer group flex-shrink-0 w-[180px] bg-transparent border-0 p-0 text-left"
    >
      <div className="relative overflow-hidden rounded-lg border border-slate-700 hover:border-green-700 hover:shadow-lg transition-all bg-slate-800">
        {/* Poster */}
        <div className="aspect-[2/3] bg-slate-700 relative overflow-hidden">
          {imgSrc && !imgError ? (
            <img
              src={imgSrc}
              alt={movie.name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ fontSize: 48 }}>🎬</span>
            </div>
          )}

          {/* Status Badge */}
          {isWatched ? (
            <div className="absolute top-2 left-2 bg-green-600/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              Obejrzane
            </div>
          ) : (
            <div className="absolute top-2 left-2 bg-green-700/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Kontynuuj
            </div>
          )}

          {/* Progress Bar */}
          {!isWatched && displayPercentage > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
              <div className="w-full bg-slate-600 rounded-full h-1.5">
                <div
                  className="bg-green-700 h-1.5 rounded-full transition-all"
                  style={{ width: `${displayPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2 bg-slate-800">
          <h3 className="font-medium text-sm text-white line-clamp-1 mb-1">
            {movie.name}
          </h3>
          {!isWatched && movie.length && movie.length > 0 && (
            <p className="text-xs text-slate-400">
              Pozostało {formatTime(Math.max(0, movie.length * 60 - progress.position))}
            </p>
          )}
          {!isWatched && (!movie.length || movie.length === 0) && displayPercentage > 0 && (
            <p className="text-xs text-slate-400">
              {displayPercentage}% obejrzane
            </p>
          )}
        </div>
      </div>
    </button>
  );
};

export const ContinueWatching: React.FC<ContinueWatchingProps> = ({
  onMovieSelect,
}) => {
  const { t } = useTranslation();
  const [inProgressMovies, setInProgressMovies] = useState<StalkerVOD[]>([]);
  const [inProgressData, setInProgressData] = useState<Map<string, { position: number; percentage: number; status: WatchStatus }>>(new Map());
  const activePortalId = usePortalsStore((s) => s.activePortalId);

  useEffect(() => {
    const loadMovies = async () => {
      if (!activePortalId) return;

      // Get store methods via getState to avoid infinite re-renders
      const { getInProgressMovies, getWatchedMovies } = useResumeStore.getState();
      const inProgress = getInProgressMovies();
      const watched = getWatchedMovies().slice(0, MAX_WATCHED_SHOWN);

      // Combine and get unique IDs
      const allProgress = [...inProgress, ...watched];
      if (allProgress.length === 0) {
        setInProgressMovies([]);
        return;
      }

      // Build progress data map
      const progressMap = new Map<string, { position: number; percentage: number; status: WatchStatus }>();
      allProgress.forEach(({ movieId, progress }) => {
        progressMap.set(movieId, {
          position: progress.position,
          percentage: progress.percentage,
          status: progress.status,
        });
      });
      setInProgressData(progressMap);

      // Load movie data from database in a single query
      const movieIds = allProgress.map(({ movieId }) => movieId);
      try {
        const vodData = await getVodByIds(activePortalId, movieIds);
        const movies: StalkerVOD[] = vodData.map((vod) => ({
          id: Number(vod.id),
          name: vod.name,
          description: vod.description ?? '',
          cmd: vod.streamUrl ?? '',
          poster: vod.posterUrl,
          logo: vod.posterUrl,
          year: vod.year,
          length: vod.duration,
          genre: vod.genre,
          director: undefined,
          actors: undefined,
          added: vod.added ? new Date(vod.added).toISOString() : '',
          censored: false,
        }));
        setInProgressMovies(movies);
      } catch (err) {
        console.error('[ContinueWatching] Failed to load movies:', err);
      }
    };

    loadMovies();
  }, [activePortalId]);

  const inProgress = useMemo(() => {
    return inProgressMovies.filter((m) => inProgressData.get(String(m.id))?.status === 'in_progress');
  }, [inProgressMovies, inProgressData]);

  const watched = useMemo(() => {
    return inProgressMovies.filter((m) => inProgressData.get(String(m.id))?.status === 'watched');
  }, [inProgressMovies, inProgressData]);

  if (inProgressMovies.length === 0) return null;

  return (
    <div className="border-b border-slate-700">
      {/* In Progress Section */}
      {inProgress.length > 0 && (
        <div className="px-4 py-4">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-700" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            {t('continueWatching')}
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {inProgress.map((movie) => (
              <MovieCardWithProgress
                key={String(movie.id)}
                movie={movie}
                progress={inProgressData.get(String(movie.id))}
                onSelect={onMovieSelect}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently Watched Section */}
      {watched.length > 0 && (
        <div className="px-4 py-4 border-t border-slate-700/50">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            {t('recentlyViewed')}
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {watched.map((movie) => (
              <MovieCardWithProgress
                key={String(movie.id)}
                movie={movie}
                progress={inProgressData.get(String(movie.id))}
                onSelect={onMovieSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
