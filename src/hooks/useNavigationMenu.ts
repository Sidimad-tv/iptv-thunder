import { useTranslation } from '@/hooks';
import type { SimpleRoute } from './useTypedRouter';
import { useMemo } from 'react';

interface UseNavigationMenuProps {
  activeView: string;
  activePortal: any;
  navigate: (view: SimpleRoute) => void;
  setIsSettingsOpen: (open: boolean) => void;
  activeM3uId?: string | null;
}

export const useNavigationMenu = ({
  activeView,
  activePortal,
  navigate,
  setIsSettingsOpen,
  activeM3uId,
}: UseNavigationMenuProps) => {
  const { t } = useTranslation();
  const m3uId = activeM3uId ?? null;

  return useMemo(() => [
    {
      id: 'portals',
      label: t('managePortals'),
      icon: '🌐',
      active: activeView === 'portals',
      onClick: () => navigate({ type: 'portals' }),
    },
    {
      id: 'for-you',
      label: t('forYou') || 'Dla Ciebie',
      icon: '⭐',
      active: activeView === 'for-you',
      disabled: !activePortal,
      onClick: () => navigate({ type: 'for-you' }),
    },
    {
      id: 'tv',
      label: t('channels'),
      icon: '📡',
      active: activeView === 'tv' || activeView === 'categories' || activeView === 'favorite-categories' || activeView === 'favorite-channels',
      disabled: !activePortal,
      subItems: [
        {
          id: 'categories',
          label: t('categories'),
          onClick: () => navigate({ type: 'categories' }),
          active: activeView === 'categories',
        },
        {
          id: 'favorite-categories',
          label: t('favoriteCategories'),
          onClick: () => navigate({ type: 'favorite-categories' }),
          active: activeView === 'favorite-categories',
        },
        {
          id: 'favorite-channels',
          label: t('favoriteChannels'),
          onClick: () => navigate({ type: 'favorite-channels' }),
          active: activeView === 'favorite-channels',
        },
      ],
    },
    {
      id: 'movies',
      label: t('movies'),
      icon: '🎬',
      active: activeView === 'movies' || activeView === 'movie-categories' || activeView === 'favorite-movie-categories' || activeView === 'favorite-movies' || activeView === 'movie-details',
      disabled: !activePortal,
      subItems: [
        {
          id: 'movie-categories',
          label: t('categories'),
          onClick: () => navigate({ type: 'movie-categories' }),
          active: activeView === 'movie-categories',
        },
        {
          id: 'favorite-movie-categories',
          label: t('favoriteCategories'),
          onClick: () => navigate({ type: 'favorite-movie-categories' }),
          active: activeView === 'favorite-movie-categories',
        },
        {
          id: 'favorite-movies',
          label: t('favorites'),
          onClick: () => navigate({ type: 'favorite-movies' }),
          active: activeView === 'favorite-movies',
        },
      ],
    },
    {
      id: 'series',
      label: t('series'),
      icon: '📺',
      active: activeView === 'series' || activeView === 'series-categories' || activeView === 'favorite-series-categories' || activeView === 'favorite-series' || activeView === 'series-details',
      disabled: !activePortal,
      subItems: [
        {
          id: 'series-categories',
          label: t('categories'),
          onClick: () => navigate({ type: 'series-categories' }),
          active: activeView === 'series-categories',
        },
        {
          id: 'favorite-series-categories',
          label: t('favoriteCategories'),
          onClick: () => navigate({ type: 'favorite-series-categories' }),
          active: activeView === 'favorite-series-categories',
        },
        {
          id: 'favorite-series',
          label: t('favorites'),
          onClick: () => navigate({ type: 'favorite-series' }),
          active: activeView === 'favorite-series',
        },
      ],
    },
    {
      id: 'm3u',
      label: 'M3U Playlists',
      icon: '📺',
      active: activeView === 'm3u' || activeView === 'm3u-channels' || activeView === 'm3u-movies' || activeView === 'm3u-series',
      onClick: () => navigate({ type: 'm3u' }),
      subItems: m3uId ? [
        { id: 'm3u-channels', label: t('channels'), onClick: () => navigate({ type: 'm3u-channels' }), active: activeView === 'm3u-channels' },
        { id: 'm3u-movies', label: t('movies'), onClick: () => navigate({ type: 'm3u-movies' }), active: activeView === 'm3u-movies' },
        { id: 'm3u-series', label: t('series'), onClick: () => navigate({ type: 'm3u-series' }), active: activeView === 'm3u-series' },
      ] : undefined,
    },
    {
      id: 'scb',
      label: 'SCB',
      icon: '📺',
      active: activeView === 'scb1' || activeView === 'scb2' || activeView === 'scb3',
      subItems: [
        {
          id: 'scb1',
          label: 'SCB 1',
          onClick: () => navigate({ type: 'scb1' }),
          active: activeView === 'scb1',
        },
        {
          id: 'scb2',
          label: 'SCB 2',
          onClick: () => navigate({ type: 'scb2' }),
          active: activeView === 'scb2',
        },
        {
          id: 'scb3',
          label: 'SCB 3',
          onClick: () => navigate({ type: 'scb3' }),
          active: activeView === 'scb3',
        },
      ],
    },
    {
      id: 'imdb',
      label: 'IMDb',
      icon: '🎬',
      active: activeView === 'imdb',
      onClick: () => navigate({ type: 'imdb' }),
    },
    {
      id: 'settings',
      label: t('settings'),
      icon: '⚙️',
      active: false,
      onClick: () => setIsSettingsOpen(true),
    },
  ], [activeView, activePortal, navigate, setIsSettingsOpen, t, m3uId]);
};
