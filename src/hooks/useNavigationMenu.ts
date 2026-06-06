import { useTranslation } from '@/hooks';
import type { SimpleRoute } from './useTypedRouter';
import { useMemo } from 'react';

interface UseNavigationMenuProps {
  activeView: string;
  activePortal: any;
  navigate: (view: SimpleRoute) => void;
  setIsSettingsOpen: (open: boolean) => void;
}

export const useNavigationMenu = ({
  activeView,
  activePortal,
  navigate,
  setIsSettingsOpen,
}: UseNavigationMenuProps) => {
  const { t } = useTranslation();

  return useMemo(() => [
    {
      id: 'portals',
      label: t('managePortals'),
      icon: '🌐',
      active: activeView === 'portals',
      onClick: () => {
        navigate({ type: 'portals' });
      },
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
      id: 'settings',
      label: t('settings'),
      icon: '⚙️',
      active: false,
      onClick: () => setIsSettingsOpen(true),
    },
  ], [activeView, activePortal, navigate, setIsSettingsOpen, t]);
};
