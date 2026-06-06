// =========================
// 🎯 FOR YOU SECTION - Netflix Style Horizontal Carousels
// =========================
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePortalsStore } from '@/store/portals.store';
import { useRecentViewed, removeRecentViewed, type RecentItem } from '@/hooks/useRecentItems';
import { useResumeStore } from '@/store/resume.store';
import { motion } from 'framer-motion';
import { Star, Tv, Film, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaCard } from '@/components/ui/MediaCard';
import { useCarousel } from '@/hooks/useCarousel';
import { StalkerChannel, StalkerVOD } from '@/types';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { useQueryClient } from '@tanstack/react-query';

interface ForYouSectionProps {
  client: StalkerClient;
  onChannelSelect?: (channel: StalkerChannel) => void;
  onSeriesSelect?: (series: StalkerVOD) => void;
  onMoviePlay?: (movie: StalkerVOD, resumePosition?: number) => void;
}

// =========================
// 📺 HORIZONTAL CAROUSEL ROW COMPONENT
// =========================
interface CarouselRowProps {
  title: string;
  icon: React.ReactNode;
  items: RecentItem[];
  onItemClick: (item: RecentItem) => void;
  onItemRemove: (item: RecentItem) => void;
  getProgressPercentage: (item: RecentItem) => number;
  formatTimeAgo: (timestamp: number, isLive?: boolean) => string;
  tvGroup: string;
}

const CarouselRow: React.FC<CarouselRowProps> = ({
  title,
  icon,
  items,
  onItemClick,
  onItemRemove,
  getProgressPercentage,
  formatTimeAgo,
  tvGroup,
}) => {
  const {
    scrollRef,
    canScrollLeft,
    canScrollRight,
    visibleRange,
    isTV,
    scroll,
    getCardWidth,
  } = useCarousel({
    items,
    virtualization: false,
  });

  if (items.length === 0) return null;

  return (
    <div className="mb-[calc(0.5rem*var(--ui-scale))]">
      {/* Title */}
      <div className="flex items-center gap-[calc(0.5rem*var(--ui-scale))] mb-[calc(1rem*var(--ui-scale))] px-[calc(1.5rem*var(--ui-scale))]">
        {icon}
        <h2 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{title}</h2>
      </div>

      {/* Carousel Container */}
      <div className="relative group -mt-[calc(1rem*var(--ui-scale))]">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 w-[calc(3rem*var(--ui-scale))] bg-gradient-to-r dark:from-slate-950/90 dark:to-transparent from-white/90 to-transparent hover:dark:from-slate-950 hover:from-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-[calc(2rem*var(--ui-scale))] h-[calc(2rem*var(--ui-scale))] dark:text-white text-slate-900 drop-shadow-lg" />
          </button>
        )}

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          data-tv-container={tvGroup}
          data-tv-carousel-container={tvGroup}
          className="flex gap-0 overflow-x-auto px-[calc(1.5rem*var(--ui-scale))] pt-[calc(1.5rem*var(--ui-scale))] pb-[calc(0.5rem*var(--ui-scale))] scroll-smooth snap-x snap-mandatory"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollPaddingLeft: 'calc(1.5rem * var(--ui-scale))',
            scrollPaddingRight: 'calc(1.5rem * var(--ui-scale))',
          }}
        >
          {/* Left placeholder for virtualization - hidden on TV */}
          {!isTV && visibleRange.start > 0 && (
            <div 
              className="flex-shrink-0 snap-start"
              style={{ 
                width: `${visibleRange.start * getCardWidth()}px`,
                minWidth: `${visibleRange.start * getCardWidth()}px`,
              }}
              aria-hidden="true"
              data-tv-skip
            />
          )}
          
          {/* Visible items only */}
          {items.slice(visibleRange.start, visibleRange.end).map((item, idx) => {
            const index = visibleRange.start + idx;
            return (
              <MediaCard
                key={`${item.type}-${item.item_id}`}
                id={item.item_id}
                name={item.name}
                poster={item.poster}
                type={item.type}
                onSelect={() => onItemClick(item)}
                onRemove={() => onItemRemove(item)}
                timeAgo={formatTimeAgo(item.viewed_at, item.type === 'live')}
                season={item.season}
                episode={item.episode}
                progressPercentage={getProgressPercentage(item)}
                index={index}
                tvGroup={tvGroup}
                tvInitial={index === 0}
              />
            );
          })}
          
          {/* Right placeholder for virtualization - hidden on TV */}
          {!isTV && visibleRange.end < items.length && (
            <div 
              className="flex-shrink-0"
              style={{ 
                width: `${(items.length - visibleRange.end) * getCardWidth()}px`,
                minWidth: `${(items.length - visibleRange.end) * getCardWidth()}px`,
              }}
              aria-hidden="true"
              data-tv-skip
            />
          )}
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 w-[calc(3rem*var(--ui-scale))] bg-gradient-to-l dark:from-slate-950/90 dark:to-transparent from-white/90 to-transparent hover:dark:from-slate-950 hover:from-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-[calc(2rem*var(--ui-scale))] h-[calc(2rem*var(--ui-scale))] dark:text-white text-slate-900 drop-shadow-lg" />
          </button>
        )}
      </div>
    </div>
  );
};

export const ForYouSection: React.FC<ForYouSectionProps> = ({
  client,
  onChannelSelect,
  onSeriesSelect,
  onMoviePlay,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const activePortal = usePortalsStore(s =>
    s.portals.find(p => p.id === s.activePortalId) ?? null
  );
  const { recentItems, isLoading } = useRecentViewed(activePortal?.id || '', undefined, 50) as {
    recentItems: RecentItem[],
    isLoading: boolean
  };
  const { getInProgressMovies } = useResumeStore();

  // Re-resolve poster URLs using the client
  const resolvedRecentItems = useMemo(() => recentItems.map(item => {
    // If the stored poster is already an absolute URL, keep it
    if (item.poster?.startsWith('http')) {
      return item;
    }
    // For relative URLs or missing posters, try to resolve
    if (item.type === 'live') {
      return {
        ...item,
        poster: client.resolveLogoUrl(item.poster)
      };
    }
    // For vod/series, construct a minimal VOD object to resolve poster URL
    if (item.type === 'vod' || item.type === 'series') {
      const minimalVod = {
        id: Number(item.item_id) || 0,
        name: item.name,
        cmd: item.cmd ?? '',
        poster: item.poster,
        screenshot_uri: item.poster,
        logo: item.poster,
      };
      const resolvedPoster = client.resolvePosterUrl(minimalVod);
      return {
        ...item,
        poster: resolvedPoster
      };
    }
    return item;
  }), [recentItems, client]);

  const formatTimeAgo = useCallback((timestamp: number, isLive?: boolean) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 30) return isLive ? t('now') : t('justNow');
    if (seconds < 60) return t('justNow');
    if (seconds < 3600) return t('minutesAgo', { count: Math.floor(seconds / 60) });
    if (seconds < 86400) return t('hoursAgo', { count: Math.floor(seconds / 3600) });
    if (seconds < 604800) return t('daysAgo', { count: Math.floor(seconds / 86400) });
    return t('longTimeAgo');
  }, [t]);

  const handleItemRemove = useCallback(async (item: RecentItem) => {
    if (!activePortal?.id) return;

    try {
      await removeRecentViewed(activePortal.id, item.type, item.item_id);
      // Invalidate the query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['recent-viewed', activePortal.id] });
    } catch (error) {
      console.error('Error removing item:', error);
    }
  }, [activePortal?.id, queryClient]);

  if (!activePortal) {
    return null;
  }

  // Get in-progress movie IDs for progress indicators
  const inProgressMovies = getInProgressMovies();
  const inProgressMap = new Map(inProgressMovies.map(m => [m.movieId, m.progress]));

  // Group items by type
  const liveItems = resolvedRecentItems.filter(item => item.type === 'live');
  const vodItems = resolvedRecentItems.filter(item => item.type === 'vod');
  const seriesItems = resolvedRecentItems.filter(item => item.type === 'series');

  // Type-safe mappers from RecentItem to domain types
  const mapToChannel = (item: RecentItem): StalkerChannel => ({
    id: item.item_id,
    name: item.name,
    cmd: item.cmd ?? '',
    logo: item.poster,
    number: 0,
    censored: false,
    tv_genre_id: item.genre_id ? Number.parseInt(item.genre_id) : undefined,
  });

  const mapToVOD = (item: RecentItem): StalkerVOD => ({
    id: item.item_id as any,
    name: item.name,
    cmd: item.cmd ?? '',
    description: '',
    added: new Date().toISOString(),
    censored: false,
    poster: item.poster,
    logo: item.poster,
  });

  const handleItemClick = (item: RecentItem) => {
    switch (item.type) {
      case 'live':
        onChannelSelect?.(mapToChannel(item));
        break;
      case 'vod': {
        const progress = inProgressMap.get(item.item_id);
        onMoviePlay?.(mapToVOD(item), progress?.position);
        break;
      }
      case 'series':
        onSeriesSelect?.(mapToVOD(item));
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="p-[calc(1.5rem*var(--ui-scale))]">
        <div className="flex items-center gap-[calc(0.5rem*var(--ui-scale))] mb-[calc(1rem*var(--ui-scale))]">
          <Star className="w-[calc(1.25rem*var(--ui-scale))] h-[calc(1.25rem*var(--ui-scale))] text-green-500" />
          <h2 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{t('forYou')}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-[calc(1rem*var(--ui-scale))]">
          {Array.from({ length: 6 }, (_, i) => `skeleton-${i}`).map((id) => (
            <div key={id} className="h-[calc(8rem*var(--ui-scale))] dark:bg-slate-800/50 bg-gray-100/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (resolvedRecentItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-[calc(1.5rem*var(--ui-scale))]"
      >
        <div className="flex items-center gap-[calc(0.5rem*var(--ui-scale))] mb-[calc(1rem*var(--ui-scale))]">
          <Star className="w-[calc(1.25rem*var(--ui-scale))] h-[calc(1.25rem*var(--ui-scale))] text-green-500" />
          <h2 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{t('forYou') || 'Dla Ciebie'}</h2>
        </div>
        <div className="dark:bg-slate-800/30 bg-gray-100/30 rounded-xl p-[calc(2rem*var(--ui-scale))] text-center backdrop-blur-sm border dark:border-slate-700/50 border-gray-200/50">
          <Clock className="w-[calc(3rem*var(--ui-scale))] h-[calc(3rem*var(--ui-scale))] mx-auto mb-[calc(0.75rem*var(--ui-scale))] dark:text-slate-500 text-slate-400" />
          <p className="text-[calc(0.875rem*var(--ui-scale))] dark:text-slate-400 text-slate-600">
            {t('noWatchHistory') || 'Rozpocznij oglądanie, aby zobaczyć rekomendacje'}
          </p>
        </div>
      </motion.div>
    );
  }

  const getProgressPercentage = (item: RecentItem) => {
    if (item.type !== 'vod') return 0;
    const progress = inProgressMap.get(item.item_id);
    return progress?.percentage || 0;
  };

  // Check for reduced motion preference
  const prefersReducedMotion = globalThis.window?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-[calc(1.5rem*var(--ui-scale))] pt-[calc(0.5rem*var(--ui-scale))] min-w-0 overflow-x-hidden"
    >
      {/* Header with title and actions */}
      <div className="flex items-center justify-between mb-[calc(0.5rem*var(--ui-scale))] px-[calc(1.5rem*var(--ui-scale))]">
        <div className="flex items-center gap-[calc(0.75rem*var(--ui-scale))]">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: prefersReducedMotion ? 1 : [1, 1.1, 1],
              opacity: 1,
            }}
            transition={{
              duration: prefersReducedMotion ? 0.3 : 2,
              repeat: prefersReducedMotion ? 1 : Infinity,
              ease: 'easeInOut',
            }}
          >
            <Star className="w-[calc(1.5rem*var(--ui-scale))] h-[calc(1.5rem*var(--ui-scale))] text-green-500" />
          </motion.div>
          <div>
            <h2 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{t('forYou') || 'Dla Ciebie'}</h2>
            <p className="text-[calc(0.875rem*var(--ui-scale))] dark:text-slate-400 text-slate-600">
              {resolvedRecentItems.length} {t('recentlyViewed') || 'ostatnio oglądanych'}
            </p>
          </div>
        </div>
      </div>

      {/* Netflix-style horizontal carousels */}
      <div className="gap-[calc(0.25rem*var(--ui-scale))] space-y-[calc(0.25rem*var(--ui-scale))] mt-[calc(0.25rem*var(--ui-scale))]">
        {/* Live Channels Row */}
        <CarouselRow
          title={t('recentChannels')}
          icon={<Tv className="w-[calc(1.25rem*var(--ui-scale))] h-[calc(1.25rem*var(--ui-scale))] text-blue-500" />}
          items={liveItems}
          onItemClick={handleItemClick}
          onItemRemove={handleItemRemove}
          getProgressPercentage={getProgressPercentage}
          formatTimeAgo={formatTimeAgo}
          tvGroup="for-you-live"
        />

        {/* Movies Row */}
        <CarouselRow
          title={t('recentMovies')}
          icon={<Film className="w-[calc(1.25rem*var(--ui-scale))] h-[calc(1.25rem*var(--ui-scale))] text-purple-500" />}
          items={vodItems}
          onItemClick={handleItemClick}
          onItemRemove={handleItemRemove}
          getProgressPercentage={getProgressPercentage}
          formatTimeAgo={formatTimeAgo}
          tvGroup="for-you-movies"
        />

        {/* Series Row */}
        <CarouselRow
          title={t('recentSeries')}
          icon={<Film className="w-[calc(1.25rem*var(--ui-scale))] h-[calc(1.25rem*var(--ui-scale))] text-orange-500" />}
          items={seriesItems}
          onItemClick={handleItemClick}
          onItemRemove={handleItemRemove}
          getProgressPercentage={getProgressPercentage}
          formatTimeAgo={formatTimeAgo}
          tvGroup="for-you-series"
        />
      </div>
    </motion.div>
  );
};
