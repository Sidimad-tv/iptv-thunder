// =========================
// ❤️ FAVORITE SERIES LIST - Using SQLite Metadata
// =========================
import React, {
  useMemo, useRef, useState, useEffect, useCallback,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useFavorites } from '@/hooks/useFavorites';
import { getImageUrl } from '@/hooks/useImageCache';
import { useTranslation } from '@/hooks/useTranslation';
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

// ─── SeriesCard ────────────────────────────────────────────────────────────────

interface SeriesCardProps {
  series: StalkerVOD;
  onSelect: (series: StalkerVOD) => void;
  onToggleFavorite: (e: React.MouseEvent, series: StalkerVOD) => void;
  onLongPress: (series: StalkerVOD) => void;
  seriesIndex: number;
}

const SeriesCard = React.memo<SeriesCardProps>(({
  series, onSelect, onToggleFavorite, onLongPress, seriesIndex,
}) => {
  const posterUrl = useMemo(
    () => series.poster || series.logo || '',
    [series.poster, series.logo]
  );
  const [imgSrc, setImgSrc] = useState<string | null>(() => imageCache.get(posterUrl) ?? null);
  const [imgError, setImgError] = useState(false);
  const seriesName = String(series.series || series.name || '');

  const { isLongPress, ref, isLongPressRef: _, ...longPressHandlers } = useLongPress({
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
        onSelect(series);
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
      onSelect(series);
    }
  };

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
      data-tv-id={`fav-series-${series.id}`}
      data-tv-group="favorite-series"
      data-tv-index={seriesIndex}
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
      tabIndex={0}
      role="button"
      className="cursor-pointer group h-[calc(100%-8px)] rounded-lg relative mb-1 bg-transparent border-0 p-0 text-left"
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
            aria-label="Remove from favorites"
          >
            ❤️
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

interface FavoriteSeriesListProps {
  accountId: string;
  search: string;
  onSeriesSelect: (series: StalkerVOD) => void;
}

export const FavoriteSeriesList: React.FC<FavoriteSeriesListProps> = ({
  accountId,
  search,
  onSeriesSelect,
}) => {
  const { t } = useTranslation();
  // Use SQLite for favorites with full metadata
  const { favorites: dbFavorites, toggleItemFavorite, isLoading } = useFavorites(accountId);

  // Convert favorites to StalkerVOD format - NO API CALLS NEEDED!
  const favoriteSeries = useMemo(() =>
    dbFavorites
      .filter(f => f.type === 'series')
      .map(f => {
        const extra = f.extra ? JSON.parse(f.extra) : {};
        return {
          id: Number.parseInt(f.item_id, 10) || 0,
          item_id: f.item_id,
          name: f.name || `Serial ${f.item_id}`,
          logo: f.poster,
          poster: f.poster,
          cmd: f.cmd || '',
          series: f.name || '',
          description: extra.description || '',
          rating_imdb: extra.rating_imdb,
          rating_kinopoisk: extra.rating_kinopoisk,
          director: extra.director,
          actors: extra.actors,
          year: extra.year,
          genre: extra.genres_str,
          genres_str: extra.genres_str,
          country: extra.country,
          added: '',
          censored: false,
        } as StalkerVOD & { item_id: string };
      })
      .filter((s, index, self) =>
        index === self.findIndex(t => t.item_id === s.item_id)
      ),
  [dbFavorites]);

  // ── Search (debounced) ────────────────────────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState<string>(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const filteredSeries = useMemo(() => {
    if (!debouncedSearch) return favoriteSeries;
    const lower = debouncedSearch.toLowerCase();
    return favoriteSeries.filter((s: StalkerVOD) =>
      ((s.name || s.series || '') as string).toLowerCase().includes(lower)
    );
  }, [favoriteSeries, debouncedSearch]);

  // ── Layout ────────────────────────────────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement>(null);
  // Fixed column count for consistency (same as SeriesList)
  const [columnCount] = useState(6);

  // ── Virtualizer ───────────────────────────────────────────────────────────────
  const rowCount = Math.ceil(filteredSeries.length / columnCount);

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
    const itemId = (series as any).item_id || String(series.id);
    toggleItemFavorite('series', itemId, {
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
    const itemId = (series as any).item_id || String(series.id);
    toggleItemFavorite('series', itemId, {
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

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <svg className="animate-spin" style={{ width: 32, height: 32 }} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#334155" strokeWidth="2" />
          <path d="M12 2 A10 10 0 0 1 22 12" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="dark:text-slate-400 text-slate-600 text-sm">{t('loadingFavoriteSeries')}</p>
      </div>
    );
  }

  if (favoriteSeries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <span style={{ fontSize: 48 }}>❤️</span>
        <p className="dark:text-slate-400 text-slate-600 text-sm">{t('noFavoriteSeries')}</p>
        <p className="dark:text-slate-500 text-slate-500 text-xs">{t('addFavoriteSeriesHint')}</p>
      </div>
    );
  }

  return (
    <div data-tv-container="main" className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{t('favoriteSeries')}</h2>
            <p className="text-xs dark:text-slate-400 text-slate-600">
              {filteredSeries.length} {t('seriesCount')}
              {debouncedSearch && favoriteSeries.length !== filteredSeries.length
                ? ` (z ${favoriteSeries.length})`
                : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Virtualized grid */}
      <div ref={parentRef} className="flex-1 overflow-y-auto p-2 overflow-x-visible pb-4">
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
                  const endIndex = Math.min(startIndex + columnCount, filteredSeries.length);
                  const items = filteredSeries.slice(startIndex, endIndex);
                  return items.map((series: StalkerVOD, idx) => {
                    const seriesId = (series as any).item_id || String(series.id);
                    const seriesIndex = startIndex + idx;
                    return (
                      <SeriesCard
                        key={seriesId}
                        series={series}
                        onSelect={onSeriesSelect}
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
  );
};
