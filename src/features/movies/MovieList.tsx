// =========================
// 🎬 MOVIES LIST (UI)
// =========================
import React, {
  useMemo, useRef, useState, useEffect, useCallback,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMoviesAll } from './movies.hooks';
import { useFavorites, useFavoriteCategories } from '@/hooks/useFavorites';
import { useTranslation } from '@/hooks/useTranslation';
import { usePortalsStore } from '@/store/portals.store';
import { useResumeStore, type WatchStatus } from '@/store/resume.store';
import { getImageUrl } from '@/hooks/useImageCache';
import { useLongPress } from '@/hooks/useLongPress';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerVOD, StalkerGenre } from '@/types';
import { ContinueWatching } from './ContinueWatching';

// ─── Constants ────────────────────────────────────────────────────────────────

// Responsive row height based on screen size (calculated dynamically)
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
    // Evict oldest entry (Map preserves insertion order)
    imageCache.delete(imageCache.keys().next().value as string);
  }
  imageCache.set(key, value);
}

// ─── SkeletonCard ──────────────────────────────────────────────────────────────

const SkeletonCard = React.memo(() => {
  return (
    <div className="h-full">
      <div className="relative overflow-hidden rounded-lg dark:bg-slate-800 bg-white h-full flex flex-col">
        {/* Poster skeleton */}
        <div className="flex-1 dark:bg-slate-700 bg-gray-200 relative overflow-hidden">
          <div className="absolute inset-0 animate-pulse dark:bg-slate-600 bg-gray-300" />
        </div>
        {/* Info skeleton */}
        <div className="p-2 dark:bg-slate-800 bg-white flex-shrink-0 min-h-[60px] flex items-center">
          <div className="h-4 w-full dark:bg-slate-700 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
});

SkeletonCard.displayName = 'SkeletonCard';

// ─── MovieCard ────────────────────────────────────────────────────────────────

interface MovieCardProps {
  movie: StalkerVOD;
  posterUrl: string;
  onSelect: (movie: StalkerVOD) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (e: React.MouseEvent, movie: StalkerVOD) => void;
  onLongPress: (movie: StalkerVOD) => void;
  watchStatus?: WatchStatus;
  progressPercentage?: number;
  moviesIndex?: number;
}

const MovieCard = React.memo<MovieCardProps>(({
  movie, posterUrl, onSelect, favoriteIds, onToggleFavorite, onLongPress,
  watchStatus, progressPercentage = 0, moviesIndex,
}) => {
  const { t } = useTranslation();
  const [imgSrc,  setImgSrc]  = useState<string | null>(() => imageCache.get(posterUrl) ?? null);
  const [imgError, setImgError] = useState(false);
  const isFavorite = favoriteIds.has(String(movie.id));
  const isWatched = watchStatus === 'watched';
  const isInProgress = watchStatus === 'in_progress';

  const { isLongPress, ref, onKeyDown, onKeyUp, isLongPressRef, ...longPressHandlers } = useLongPress({
    onLongPress: () => onLongPress(movie),
    delay: 500,
  });

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
      // Save focus before navigation for restoration when closing details
      const focusedEl = document.activeElement as HTMLElement;
      console.log('[MovieList] handleKeyUp - activeElement:', focusedEl?.dataset?.tvId, 'index:', focusedEl?.dataset?.tvIndex);
      if (focusedEl?.dataset.tvId) {
        (globalThis as any).__lastFocusedMovieId = focusedEl.dataset.tvId;
        (globalThis as any).__lastFocusedMovieIndex = focusedEl.dataset.tvIndex;
        console.log('[MovieList] Saved focus:', focusedEl.dataset.tvId, 'index:', focusedEl.dataset.tvIndex);
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
      // Already cached — state is set in initializer, nothing to do
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
      data-tv-id={`movie-${movie.id}`}
      data-tv-group="movies"
      data-tv-index={moviesIndex}
      tabIndex={0}
      onClick={handleClick}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress(movie);
      }}
      {...longPressHandlers}
      ref={ref}
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
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? '❤️' : '🤍'}
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
        <div className="p-2 dark:bg-slate-800 bg-white flex-shrink-0 min-h-[60px] flex items-center">
          <h3 className="font-medium text-sm dark:text-white text-slate-900 line-clamp-2 leading-tight">
            {movie.name}
          </h3>
        </div>
      </div>
    </div>
  );
});

MovieCard.displayName = 'MovieCard';

// ─── MovieList ────────────────────────────────────────────────────────────────

interface MovieListProps {
  client: StalkerClient;
  onMovieSelect: (movie: StalkerVOD) => void;
  selectedCategory?: StalkerGenre | null;
  search: string;
}

export const MovieList: React.FC<MovieListProps> = ({
  client, onMovieSelect, selectedCategory, search,
}) => {
  const { t } = useTranslation();
  // ── Data ──────────────────────────────────────────────────────────────────────
  const { movies, isLoading, isFetching, error, streamingState } = useMoviesAll(client, selectedCategory?.id, search);

  // ── Favorites ─────────────────────────────────────────────────────────────────
  const accountId = usePortalsStore(s =>
    s.portals.find(p => p.id === s.activePortalId)?.id ?? 'default'
  );
  const { favorites, toggleItemFavorite } = useFavorites(accountId);
  const { isCategoryFavorite, toggleCategory } = useFavoriteCategories(accountId, 'vod');

  const favoriteIds = useMemo(
    () => new Set(favorites.filter(f => f.type === 'vod').map(f => String(f.item_id).replace(/\.0$/, ''))),
    [favorites],
  );

  // Search is now handled server-side via API (useMoviesAll hook)

  // ── Layout ────────────────────────────────────────────────────────────────────
  const parentRef    = useRef<HTMLDivElement>(null);
  // Fixed column count for consistency
  const [cols] = useState(6);

  // Reset scroll when category changes
  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [selectedCategory?.id]);

  
  // ── Virtualizer ───────────────────────────────────────────────────────────────
  const rowCount = Math.ceil(movies.length / cols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => getRowHeight(),
    overscan: 15, // Increased to keep more elements in DOM for focus restoration
  });

  // Restore scroll position after MovieDetails closes (handle virtualization)
  useEffect(() => {
    const savedIndex = (globalThis as any).__lastFocusedMovieIndex;
    if (savedIndex && savedIndex !== '0') {
      const indexNum = Number(savedIndex);
      console.log('[MovieList] Scrolling to saved index:', indexNum);
      const rowIndex = Math.floor(indexNum / cols);
      // Scroll to the row containing the saved movie
      virtualizer.scrollToIndex(rowIndex, { align: 'center' });
    }
  }, []);

  // Stable row getter — avoids pre-building a rows array for large datasets
  const getRow = useCallback(
    (rowIndex: number): StalkerVOD[] =>
      movies.slice(rowIndex * cols, rowIndex * cols + cols),
    [movies, cols],
  );


  const handleToggleCategoryFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedCategory) {
      toggleCategory(String(selectedCategory.id), selectedCategory.title);
    }
  }, [selectedCategory, toggleCategory]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent, movie: StalkerVOD) => {
    e.stopPropagation();
    const posterUrl = movie.poster || movie.logo || '';
    toggleItemFavorite('vod', String(movie.id), {
      name: movie.name,
      poster: posterUrl,
      cmd: movie.cmd,
      extra: {
        description: movie.description,
        year: movie.year,
        genre: movie.genres_str,
        actors: movie.actors,
        director: movie.director,
        country: movie.country,
        length: movie.length,
        rating_imdb: movie.rating_imdb,
        rating_kinopoisk: movie.rating_kinopoisk,
      },
    });
  }, [toggleItemFavorite]);

  const handleLongPress = useCallback((movie: StalkerVOD) => {
    const posterUrl = movie.poster || movie.logo || '';
    toggleItemFavorite('vod', String(movie.id), {
      name: movie.name,
      poster: posterUrl,
      cmd: movie.cmd,
      extra: {
        description: movie.description,
        year: movie.year,
        genre: movie.genres_str,
        actors: movie.actors,
        director: movie.director,
        country: movie.country,
        length: movie.length,
        rating_imdb: movie.rating_imdb,
        rating_kinopoisk: movie.rating_kinopoisk,
      },
    });
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [toggleItemFavorite]);

  // ── Render ────────────────────────────────────────────────────────────────────

  // Show skeleton grid during initial load or refetch (prevents UI flash)
  const showSkeleton = isLoading || isFetching;
  const skeletonCount = cols * 4; // Show 4 rows of skeletons

  if (showSkeleton && movies.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Category header with skeleton */}
        {selectedCategory && (
          <div className="flex-shrink-0 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-700 rounded-lg flex items-center justify-center text-lg">
                🎬
              </div>
              <div className="flex-1">
                <h2 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{selectedCategory.id === '*' ? t('all') : selectedCategory.title}</h2>
                <div className="h-4 w-24 dark:bg-slate-700 bg-gray-200 rounded animate-pulse mt-1" />
              </div>
            </div>
          </div>
        )}

        {/* Skeleton grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400">{t('error')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Continue Watching Section - Show when no category selected (all movies) */}
      {!selectedCategory && (
        <ContinueWatching onMovieSelect={onMovieSelect} />
      )}

      {/* Category header */}
      {selectedCategory && (
        <div className="flex-shrink-0 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-700 rounded-lg flex items-center justify-center text-lg">
              🎬
            </div>
            <div className="flex-1">
              <h2 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{selectedCategory.id === '*' ? t('all') : selectedCategory.title}</h2>
              <p className="text-xs dark:text-slate-400 text-slate-600">
                {movies.length} {(() => {
                  const count = movies.length;
                  if (count === 1) return t('moviesCount_1');
                  if (count >= 2 && count <= 4) return t('moviesCount_2_4');
                  return t('moviesCount_5_plus');
                })()}
              </p>
            </div>
            {/* Favorite Category Button */}
            <button
              onClick={handleToggleCategoryFavorite}
              className="text-xl hover:scale-110 transition-transform p-2 rounded-full dark:hover:bg-slate-700 hover:bg-gray-200"
              title={isCategoryFavorite(String(selectedCategory.id)) ? t('removeFromFavorites') : t('addToFavorites')}
            >
              {isCategoryFavorite(String(selectedCategory.id)) ? '❤️' : '🤍'}
            </button>
          </div>
        </div>
      )}

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
              data-tv-skip
              tabIndex={-1}
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
                  const movieId = String(movie.id);
                  const moviesIndex = vRow.index * cols + colIndex;
                  const progress = useResumeStore.getState().getProgress(movieId);
                  return (
                    <MovieCard
                      key={movieId}
                      movie={movie}
                      posterUrl={movie.poster || movie.logo || ''}
                      onSelect={onMovieSelect}
                      favoriteIds={favoriteIds}
                      onToggleFavorite={handleToggleFavorite}
                      onLongPress={handleLongPress}
                      watchStatus={progress?.status}
                      progressPercentage={progress?.percentage}
                      moviesIndex={moviesIndex}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Streaming loading indicator */}
        {streamingState.isStreaming && (
          <div className="text-center py-4 dark:text-slate-400 text-slate-600 text-sm">
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {t('loadingMoreTitles')} ({streamingState.loadedPages}/{streamingState.totalPages})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
