// =========================
// ❤️ FAVORITE MOVIES LIST - Using SQLite Metadata
// =========================
import React, {
  useMemo, useRef, useState, useEffect, useCallback,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useFavorites } from '@/hooks/useFavorites';
import { getImageUrl } from '@/hooks/useImageCache';
import { useTranslation } from '@/hooks/useTranslation';
import { useResumeStore, type WatchStatus } from '@/store/resume.store';
import { StalkerVOD } from '@/types';
import { useLongPress } from '@/hooks/useLongPress';

// ─── Constants ────────────────────────────────────────────────────────────────

const getRowHeight = () => {
  if (globalThis.window === undefined) return 360;
  const width = globalThis.window.innerWidth;
  if (width > 3000) return 440;
  if (width > 2000) return 320;
  return 280;
};
const IMAGE_CACHE_LIMIT = 500;

// ─── Image cache (module-level, survives re-renders, bounded size) ─────────────

const imageCache = new Map<string, string>();

function setCachedImage(key: string, value: string) {
  if (imageCache.size >= IMAGE_CACHE_LIMIT) {
    imageCache.delete(imageCache.keys().next().value as string);
  }
  imageCache.set(key, value);
}

// ─── MovieCard ────────────────────────────────────────────────────────────────

interface MovieCardProps {
  movie: StalkerVOD;
  index: number;
  posterUrl: string;
  onSelect: (movie: StalkerVOD) => void;
  onToggleFavorite: (e: React.MouseEvent, movie: StalkerVOD) => void;
  onLongPress: (movie: StalkerVOD) => void;
  watchStatus?: WatchStatus;
  progressPercentage?: number;
}

const MovieCard = React.memo<MovieCardProps>(({
  movie, index, posterUrl, onSelect, onToggleFavorite, onLongPress, watchStatus, progressPercentage = 0,
}) => {
  const { t } = useTranslation();
  const [imgSrc, setImgSrc] = useState<string | null>(() => imageCache.get(posterUrl) ?? null);
  const [imgError, setImgError] = useState(false);
  const isWatched = watchStatus === 'watched';
  const isInProgress = watchStatus === 'in_progress';

  const { isLongPress, isLongPressRef, ref, ...longPressHandlers } = useLongPress({
    onLongPress: () => onLongPress(movie),
    delay: 500,
  });

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
      // Save focus before navigation for restoration when closing details
      const focusedEl = document.activeElement as HTMLElement;
      if (focusedEl?.dataset.tvId) {
        (globalThis as any).__lastFocusedMovieId = focusedEl.dataset.tvId;
        (globalThis as any).__lastFocusedMovieIndex = focusedEl.dataset.tvIndex;
      }
      // Check if long press was triggered - if so, don't call onSelect
      if (!(globalThis as any).__tvLongPressPreventClick) {
        e.preventDefault();
        onSelect(movie);
      }
    }
  };

  const handleClick = () => {
    // Save focus before navigation for restoration when closing details
    const focusedEl = document.activeElement as HTMLElement;
    if (focusedEl?.dataset.tvId) {
      (globalThis as any).__lastFocusedMovieId = focusedEl.dataset.tvId;
      (globalThis as any).__lastFocusedMovieIndex = focusedEl.dataset.tvIndex;
    }
    // For mouse/touch, let useLongPress handle it
    if (!isLongPress && !(globalThis as any).__tvLongPressPreventClick) {
      onSelect(movie);
    }
  };

  // Get progress data to recalculate percentage using movie.length for consistency
  const { getProgress } = useResumeStore();
  const progress = getProgress(String(movie.id));

  // Recalculate percentage using movie.length from API if available
  const displayPercentage = React.useMemo(() => {
    if (!progress || !isInProgress) return progressPercentage;
    if (movie.length && movie.length > 0) {
      const totalSeconds = movie.length * 60;
      return totalSeconds > 0 ? Math.round((progress.position / totalSeconds) * 100) : progressPercentage;
    }
    return progressPercentage;
  }, [progress, movie.length, isInProgress, progressPercentage]);

  useEffect(() => {
    if (!posterUrl || imageCache.has(posterUrl)) {
      return;
    }

    let cancelled = false;
    getImageUrl(posterUrl)
      .then(url => {
        if (cancelled) return;
        setCachedImage(posterUrl, url);
        setImgSrc(url);
      })
      .catch(() => {
        if (cancelled) return;
        setCachedImage(posterUrl, '/fallback/poster.png');
        setImgSrc('/fallback/poster.png');
      });

    return () => { cancelled = true; };
  }, [posterUrl]);

  return (
    <div
      data-tv-focusable
      data-tv-id={`fav-movie-${(movie as any).item_id || movie.id}`}
      data-tv-group="favorite-movies"
      data-tv-index={index}
      tabIndex={0}
      {...longPressHandlers}
      ref={ref}
      onClick={handleClick}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress(movie);
      }}
      onKeyDown={() => {
        // Let useLongPress handle it
      }}
      className="cursor-pointer group h-[calc(100%-8px)] rounded-lg relative mb-1"
    >
      <div className="relative overflow-hidden rounded-lg hover:border-green-700 hover:shadow-lg transition-all dark:bg-slate-800 bg-white h-full flex flex-col">
        {/* Poster */}
        <div className="flex-1 dark:bg-slate-700 bg-gray-200 relative overflow-hidden">
          {imgSrc && !imgError ? (
            <img
              src={imgSrc}
              alt={movie.name}
              className="absolute inset-0 w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ fontSize: 48 }}>🎬</span>
            </div>
          )}

          {/* Favorite button */}
          <button
            onClick={e => onToggleFavorite(e, movie)}
            className="absolute top-1 right-1 text-xl dark:bg-slate-900/50 bg-black/20 rounded-full p-1 opacity-80 group-hover:opacity-100 focus:opacity-100 transition-opacity dark:hover:bg-slate-900/80 hover:bg-black/30"
            aria-label="Remove from favorites"
          >
            ❤️
          </button>

          {/* Watch Status Badge */}
          {isWatched && (
            <div className="absolute top-2 left-2 bg-green-600/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              {t('watched')}
            </div>
          )}

          {/* Progress Bar */}
          {isInProgress && displayPercentage > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
              <div className="w-full dark:bg-slate-600 bg-gray-400 rounded-full h-1">
                <div
                  className="bg-green-700 h-1 rounded-full transition-all"
                  style={{ width: `${displayPercentage}%` }}
                />
              </div>
              <div className="dark:text-white text-slate-900 text-xs mt-1 text-center">
                {displayPercentage}%
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2 dark:bg-slate-800 bg-white flex-shrink-0 min-h-[60px]">
          <h3 className="font-medium text-sm dark:text-white text-slate-900 line-clamp-2 leading-tight mb-1">
            {movie.name}
          </h3>
          {movie.genre && (
            <span className="text-xs dark:text-slate-500 text-slate-500 truncate block">{movie.genre}</span>
          )}
        </div>
      </div>
    </div>
  );
});

MovieCard.displayName = 'MovieCard';

// ─── FavoriteMoviesList ───────────────────────────────────────────────────────

interface FavoriteMoviesListProps {
  accountId: string;
  search: string;
  onMovieSelect: (movie: StalkerVOD) => void;
}

export const FavoriteMoviesList: React.FC<FavoriteMoviesListProps> = ({
  accountId,
  search,
  onMovieSelect,
}) => {
  const { t } = useTranslation();
  // Use SQLite for favorites with full metadata
  const { favorites: dbFavorites, toggleItemFavorite, isLoading } = useFavorites(accountId);

  // Convert favorites to StalkerVOD format - NO API CALLS NEEDED!
  const favoriteMovies = useMemo(() =>
    dbFavorites
      .filter(f => f.type === 'vod')
      .map(f => {
        const extra = f.extra ? JSON.parse(f.extra) : {};
        return {
          id: Number.parseInt(f.item_id) || 0,
          item_id: f.item_id,
          name: f.name || `Film ${f.item_id}`,
          logo: f.poster,
          poster: f.poster,
          cmd: f.cmd,
          series: '',
          description: extra.description || '',
          year: extra.year,
          genres_str: extra.genre,
          actors: extra.actors,
          director: extra.director,
          country: extra.country,
          length: extra.length,
          rating_imdb: extra.rating_imdb,
          rating_kinopoisk: extra.rating_kinopoisk,
          added: '',
          censored: false,
        } as StalkerVOD & { item_id: string };
      })
      .filter((m, index, self) =>
        index === self.findIndex(t => (t as any).item_id === (m as any).item_id)
      ),
  [dbFavorites]);

  // Apply search filter
  const filtered = useMemo(() =>
    favoriteMovies.filter((m: StalkerVOD) =>
      m.name.toLowerCase().includes(search.toLowerCase())
    ),
  [favoriteMovies, search]);

  // ── Layout ────────────────────────────────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement>(null);
  // Fixed column count for consistency
  const [cols] = useState(6);

  // ── Virtualizer ───────────────────────────────────────────────────────────────
  const rowCount = Math.ceil(filtered.length / cols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => getRowHeight(),
    overscan: 15,
  });

  const getRow = useCallback(
    (rowIndex: number): StalkerVOD[] =>
      filtered.slice(rowIndex * cols, rowIndex * cols + cols),
    [filtered, cols],
  );

  const handleToggleFavorite = useCallback((e: React.MouseEvent, movie: StalkerVOD) => {
    e.stopPropagation();
    const posterUrl = movie.poster || movie.logo || '';
    const itemId = (movie as any).item_id || String(movie.id);
    toggleItemFavorite('vod', itemId, {
      name: movie.name,
      poster: posterUrl,
      cmd: movie.cmd,
    });
  }, [toggleItemFavorite]);

  const handleLongPress = useCallback((movie: StalkerVOD) => {
    const posterUrl = movie.poster || movie.logo || '';
    const itemId = (movie as any).item_id || String(movie.id);
    toggleItemFavorite('vod', itemId, {
      name: movie.name,
      poster: posterUrl,
      cmd: movie.cmd,
    });
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [toggleItemFavorite]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <svg className="animate-spin" style={{ width: 32, height: 32 }} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#334155" strokeWidth="2" />
          <path d="M12 2 A10 10 0 0 1 22 12" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="dark:text-slate-400 text-slate-600 text-sm">{t('loadingFavoriteMovies')}</p>
      </div>
    );
  }

  if (favoriteMovies.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center dark:text-white text-slate-900">
        <div className="text-center">
          <div className="text-6xl mb-4">❤️</div>
          <h2 className="text-2xl font-bold mb-2">{t('noFavoriteMovies')}</h2>
          <p className="dark:text-slate-400 text-slate-600 mb-4">
            {t('addFavoriteMoviesHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-tv-container="main" className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3">
        <div>
          <h2 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{t('favoriteMovies')}</h2>
          <p className="text-xs dark:text-slate-400 text-slate-600">
            {t('moviesCount').replace('{{count}}', String(favoriteMovies.length))}
          </p>
        </div>
      </div>

      {/* Virtualized grid */}
      <div ref={parentRef} className="flex-1 overflow-y-auto p-2 overflow-x-visible pb-4">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map(vRow => (
            <div
              key={vRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: getRowHeight(),
                transform: `translateY(${vRow.start}px)`,
                overflow: 'visible',
                zIndex: 1,
              }}
            >
              <div
                className="grid gap-4 h-full"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, rowGap: '2px' }}
              >
                {getRow(vRow.index).map((movie, colIndex) => {
                  const itemIndex = vRow.index * cols + colIndex;
                  const movieId = (movie as any).item_id || String(movie.id);
                  const progress = useResumeStore.getState().getProgress(movieId);
                  return (
                    <MovieCard
                      key={movieId}
                      movie={movie}
                      index={itemIndex}
                      posterUrl={movie.poster || movie.logo || ''}
                      onSelect={onMovieSelect}
                      onToggleFavorite={handleToggleFavorite}
                      onLongPress={handleLongPress}
                      watchStatus={progress?.status}
                      progressPercentage={progress?.percentage}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
