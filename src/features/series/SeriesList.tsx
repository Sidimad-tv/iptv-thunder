// =========================
// 📺 SERIES LIST (UI)
// =========================
import React, {
  useMemo, useRef, useState, useEffect, useCallback,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSeriesAll } from './series.hooks';
import { useFavorites, useFavoriteCategories } from '@/hooks/useFavorites';
import { usePortalsStore } from '@/store/portals.store';
import { useTranslation } from '@/hooks/useTranslation';
import { getImageUrl } from '@/hooks/useImageCache';
import { useLongPress } from '@/hooks/useLongPress';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerVOD, StalkerGenre } from '@/types';

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
    imageCache.delete(imageCache.keys().next().value as string);
  }
  imageCache.set(key, value);
}

// ─── SeriesCard ────────────────────────────────────────────────────────────────

interface SeriesCardProps {
  series: StalkerVOD;
  onSelect: (seriesName: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (e: React.MouseEvent, series: StalkerVOD) => void;
  onLongPress: (series: StalkerVOD) => void;
  seriesIndex: number;
}

const SeriesCard = React.memo<SeriesCardProps>(({
  series, onSelect, favoriteIds, onToggleFavorite, onLongPress, seriesIndex,
}) => {
  const posterUrl = useMemo(
    () => series.poster || series.logo || '',
    [series.poster, series.logo]
  );
  const [imgSrc, setImgSrc] = useState<string | null>(() => imageCache.get(posterUrl) ?? null);
  const [imgError, setImgError] = useState(false);
  const isFavorite = favoriteIds.has(String(series.id));
  const seriesName = String(series.series || series.name || '');

  const { isLongPress, ref, isLongPressRef, ...longPressHandlers } = useLongPress({
    onLongPress: () => onLongPress(series),
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
        onSelect(String(series.id));
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
      onSelect(String(series.id));
    }
  };

  // Reset state when posterUrl changes (fix for virtualization reuse)
  useEffect(() => {
    setImgSrc(imageCache.get(posterUrl) ?? null);
    setImgError(false);
  }, [posterUrl]);

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
      data-tv-id={`series-${series.id}`}
      data-tv-group="series"
      data-tv-index={seriesIndex}
      tabIndex={0}
      {...longPressHandlers}
      ref={ref}
      onClick={handleClick}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress(series);
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
              alt={series.name}
              className="absolute inset-0 w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ fontSize: 48 }}>📺</span>
            </div>
          )}

          {/* Favorite button */}
          <button
            onClick={e => onToggleFavorite(e, series)}
            className="absolute top-1 right-1 text-xl dark:bg-slate-900/50 bg-black/20 rounded-full p-1 opacity-80 group-hover:opacity-100 focus:opacity-100 transition-opacity dark:hover:bg-slate-900/80 hover:bg-black/30"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? '❤️' : '🤍'}
          </button>
        </div>

        {/* Info */}
        <div className="p-2 dark:bg-slate-800 bg-white flex-shrink-0 min-h-[60px] flex items-center">
          <h3 className="font-medium text-sm dark:text-white text-slate-900 line-clamp-2 leading-tight">
            {seriesName || series.name || 'Unknown'}
          </h3>
        </div>
      </div>
    </div>
  );
});

SeriesCard.displayName = 'SeriesCard';

interface SeriesListProps {
  client: StalkerClient;
  onSeriesSelect: (series: StalkerVOD) => void;
  selectedCategory?: StalkerGenre | null;
  search: string;
}

export const SeriesList: React.FC<SeriesListProps> = ({
  client, onSeriesSelect, selectedCategory, search,
}) => {
  const { t } = useTranslation();
  // ── Data ──────────────────────────────────────────────────────────────────────
  const { series: seriesData, isLoading, error } = useSeriesAll(client, selectedCategory?.id, search);

  // ── Favorites ─────────────────────────────────────────────────────────────────
  const accountId = usePortalsStore(s =>
    s.portals.find(p => p.id === s.activePortalId)?.id ?? 'default'
  );
  const { favorites, toggleItemFavorite } = useFavorites(accountId);
  const { isCategoryFavorite, toggleCategory } = useFavoriteCategories(accountId, 'series');

  const favoriteIds = useMemo(
    () => new Set(favorites.filter(f => f.type === 'series').map(f => String(f.item_id).replace(/\.0$/, ''))),
    [favorites]
  );

  // Search is now handled server-side via API (useSeriesAll hook)

  // ── Layout ────────────────────────────────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement>(null);
  // Fixed column count for consistency
  const [columnCount] = useState(6);

  // Reset scroll when category changes
  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [selectedCategory?.id]);

  
  // ── Virtualizer ───────────────────────────────────────────────────────────────
  const rowCount = Math.ceil(seriesData.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => getRowHeight(),
    overscan: 15,
  });


  const handleToggleFavorite = useCallback((e: React.MouseEvent, series: StalkerVOD) => {
    e.stopPropagation();
    const posterUrl = series.poster || series.logo || '';
    const name = series.name || series.series || '';
    toggleItemFavorite('series', String(series.id), {
      name: name as string,
      poster: posterUrl,
      cmd: series.cmd,
      extra: {
        description: series.description,
        rating_imdb: series.rating_imdb,
        rating_kinopoisk: series.rating_kinopoisk,
        director: series.director,
        actors: series.actors,
        year: series.year,
        genres_str: series.genres_str,
        country: series.country,
      },
    });
  }, [toggleItemFavorite]);

  const handleLongPress = useCallback((series: StalkerVOD) => {
    const posterUrl = series.poster || series.logo || '';
    const name = series.name || series.series || '';
    toggleItemFavorite('series', String(series.id), {
      name: name as string,
      poster: posterUrl,
      cmd: series.cmd,
      extra: {
        description: series.description,
        rating_imdb: series.rating_imdb,
        rating_kinopoisk: series.rating_kinopoisk,
        director: series.director,
        actors: series.actors,
        year: series.year,
        genres_str: series.genres_str,
        country: series.country,
      },
    });
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [toggleItemFavorite]);


  const handleToggleCategoryFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedCategory) {
      toggleCategory(String(selectedCategory.id), selectedCategory.title);
    }
  }, [selectedCategory, toggleCategory]);

  const handleSeriesSelect = (seriesId: string) => {
    const series = seriesData?.find(s => String(s.id) === seriesId);
    if (series) {
      onSeriesSelect(series);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <svg className="animate-spin" style={{ width: 32, height: 32 }} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#334155" strokeWidth="2" />
          <path d="M12 2 A10 10 0 0 1 22 12" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="dark:text-slate-400 text-slate-600 text-sm">{t('loadingSeries')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400">{t('errorLoadingSeries')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Series Grid - Full Width */}
      <div className="w-full flex flex-col overflow-hidden">
        {/* Category header */}
        {selectedCategory && (
          <div className="flex-shrink-0 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-700 rounded-lg flex items-center justify-center text-lg">
                📺
              </div>
              <div className="flex-1">
                <h2 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{selectedCategory.id === '*' ? t('all') : selectedCategory.title}</h2>
                <p className="text-xs dark:text-slate-400 text-slate-600">
                  {seriesData.length} {(() => {
                    const count = seriesData.length;
                    if (count === 1) return t('seriesCount_1');
                    if (count >= 2 && count <= 4) return t('seriesCount_2_4');
                    return t('seriesCount_5_plus');
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
        <div ref={parentRef} className="flex-1 overflow-y-auto p-4">
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map(vRow => (
              <div
                key={vRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: getRowHeight(),
                  transform: `translateY(${vRow.start}px)`,
                }}
              >
                <div
                  className="grid gap-4 h-full"
                  style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
                >
                  {(() => {
                    const startIndex = vRow.index * columnCount;
                    const endIndex = Math.min(startIndex + columnCount, seriesData.length);
                    const items = seriesData.slice(startIndex, endIndex);
                    return items.map((series: StalkerVOD, idx) => {
                      const seriesId = String(series.id);
                      const seriesIndex = startIndex + idx;
                      return (
                        <SeriesCard
                          key={seriesId}
                          series={series}
                          onSelect={handleSeriesSelect}
                          favoriteIds={favoriteIds}
                          onToggleFavorite={handleToggleFavorite}
                          onLongPress={handleLongPress}
                          seriesIndex={seriesIndex}
                        />
                      );
                    });
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
