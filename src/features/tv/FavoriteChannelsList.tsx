// =========================
// ❤️ FAVORITE CHANNELS LIST
// =========================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFavorites } from '@/hooks/useFavorites';
import { useTranslation } from '@/hooks/useTranslation';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerChannel } from '@/types';
import { useLongPress } from '@/hooks/useLongPress';
import { searchChannels } from '@/hooks/useDatabase';

interface FavoriteChannelsListProps {
  client?: StalkerClient;
  accountId: string;
  search: string;
  onChannelSelect: (channel: StalkerChannel) => void;
}

interface FavoriteChannelCardProps {
  channel: StalkerChannel;
  index: number;
  onSelect: (channel: StalkerChannel) => void;
  onToggleFavorite: (e: React.MouseEvent, channel: StalkerChannel) => void;
  onLongPress: (channel: StalkerChannel) => void;
}

const FavoriteChannelCard: React.FC<FavoriteChannelCardProps> = ({
  channel,
  index,
  onSelect,
  onToggleFavorite,
  onLongPress,
}) => {
  const { isLongPress, ref, isLongPressRef, ...longPressHandlers } = useLongPress({
    onLongPress: () => onLongPress(channel),
    delay: 500,
  });

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
      // Check if long press was triggered - if so, don't call onSelect
      if (!(window as any).__tvLongPressPreventClick) {
        e.preventDefault();
        onSelect(channel);
      }
    }
  };

  const handleClick = () => {
    // For mouse/touch, let useLongPress handle it
    if (!isLongPress && !(window as any).__tvLongPressPreventClick) {
      onSelect(channel);
    }
  };

  return (
    <div
      key={channel.id}
      data-tv-focusable
      data-tv-id={`fav-channel-${channel.id}`}
      data-tv-group="favorite-channels"
      data-tv-index={index}
      data-tv-initial={index === 0}
      tabIndex={0}
      {...longPressHandlers}
      ref={ref}
      onClick={handleClick}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress(channel);
      }}
      onKeyDown={() => {
        // Let useLongPress handle it
      }}
      className="p-2 rounded-lg cursor-pointer dark:hover:bg-slate-700 hover:bg-gray-200 hover:border-green-700 transition-all dark:bg-slate-800 bg-white dark:focus:bg-slate-700 focus:bg-gray-200 dark:focus:border-green-700 focus:border-green-700"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm dark:text-white text-slate-900">
            {channel.name}
          </h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(e, channel);
          }}
          className="ml-2 text-lg hover:scale-110 transition-transform"
        >
          ❤️
        </button>
      </div>
      {channel.logo && (
        <img
          src={channel.logo}
          alt={channel.name}
          className="w-full h-16 object-contain mt-2"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
    </div>
  );
};

export const FavoriteChannelsList: React.FC<FavoriteChannelsListProps> = ({
  accountId,
  search,
  onChannelSelect,
}) => {
  // Use SQLite for favorites - contains all metadata (name, poster/logo, cmd)
  const { favorites: dbFavorites, isLoading, toggleItemFavorite } = useFavorites(accountId);
  const { t } = useTranslation();
  const [favoriteChannels, setFavoriteChannels] = useState<StalkerChannel[]>([]);
  const prevFavoritesRef = useRef<string | null>(null);

  // Convert favorites to StalkerChannel format and enrich missing genre_id from SQLite
  useEffect(() => {
    const favoritesJson = JSON.stringify(dbFavorites);
    
    // Only update if favorites actually changed
    if (prevFavoritesRef.current === favoritesJson) {
      return;
    }
    prevFavoritesRef.current = favoritesJson;

    const loadChannels = async () => {
      const baseChannels = dbFavorites
        .filter(f => f.type === 'live')
        .map(f => {
          let extraData: any = {};
          try {
            extraData = f.extra ? JSON.parse(f.extra) : {};
          } catch {
            extraData = {};
          }
          return {
            id: f.item_id,
            name: f.name || 'Unknown Channel',
            cmd: f.cmd || '',
            logo: f.poster,
            tv_genre_id: extraData.genre_id ? Number(extraData.genre_id) : undefined,
            number: 0,
            censored: false,
          };
        });

      // Enrich missing genre_id from SQLite channels table
      const channelsWithoutGenre = baseChannels.filter(ch => !ch.tv_genre_id);
      if (channelsWithoutGenre.length > 0) {
        try {
          const dbChannels = await searchChannels('', accountId, 10000);
          const dbGenreMap = new Map(dbChannels.map(ch => [ch.id, ch.genreId]));

          const enrichedChannels = baseChannels.map(ch => {
            if (!ch.tv_genre_id) {
              const genreIdFromDb = dbGenreMap.get(String(ch.id));
              if (genreIdFromDb) {
                return { ...ch, tv_genre_id: Number(genreIdFromDb) };
              }
            }
            return ch;
          });
          setFavoriteChannels(enrichedChannels);
        } catch {
          // Fallback to base channels if DB query fails
          setFavoriteChannels(baseChannels);
        }
      } else {
        setFavoriteChannels(baseChannels);
      }
    };

    loadChannels();
  }, [dbFavorites, accountId]);

  // Apply search filter
  const filtered = useMemo(() =>
    favoriteChannels.filter((c) => {
      // Filter out separator channels (names starting with ####)
      if (c.name.startsWith('####')) return false;
      return c.name.toLowerCase().includes(search.toLowerCase());
    }),
  [favoriteChannels, search]);

  const handleLongPress = (channel: StalkerChannel) => {
    toggleItemFavorite('live', String(channel.id), {
      name: channel.name,
      poster: channel.logo,
      cmd: channel.cmd,
      extra: { genre_id: channel.tv_genre_id },
    });
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent, channel: StalkerChannel) => {
    e.stopPropagation();
    toggleItemFavorite('live', String(channel.id), {
      name: channel.name,
      poster: channel.logo,
      cmd: channel.cmd,
      extra: { genre_id: channel.tv_genre_id },
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Skeleton Header */}
        <div className="p-4">
          <div className="h-6 w-48 dark:bg-slate-700 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-32 dark:bg-slate-700 bg-gray-200 rounded animate-pulse"></div>
        </div>
        {/* Skeleton Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="dark:bg-slate-800 bg-white rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="h-4 w-20 dark:bg-slate-700 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-5 h-5 dark:bg-slate-700 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
                <div className="h-16 dark:bg-slate-700 bg-gray-200 rounded animate-pulse mt-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && favoriteChannels.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center dark:text-white text-slate-900">
        <div className="text-center">
          <div className="text-6xl mb-4">❤️</div>
          <h2 className="text-2xl font-bold mb-2">{t('noFavoriteChannels')}</h2>
          <p className="dark:text-slate-400 text-slate-600 mb-4">
            {t('addFavoriteChannelsHint')}
          </p>
          <p className="text-sm dark:text-slate-500 text-slate-500">
            {t('favoriteChannelsAppear')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div>
          <h2 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{t('favoriteChannels')}</h2>
          <p className="text-sm dark:text-slate-400 text-slate-600">
            {t('favoriteChannelsCount', { current: filtered.length, total: favoriteChannels.length })}
          </p>
        </div>
      </div>

      {/* Channels Grid - same layout as TVList */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {filtered.map((channel: StalkerChannel, index: number) => (
            <FavoriteChannelCard
              key={channel.id}
              channel={channel}
              index={index}
              onSelect={onChannelSelect}
              onToggleFavorite={handleToggleFavorite}
              onLongPress={handleLongPress}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
