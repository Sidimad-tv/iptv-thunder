import { useTranslation } from '@/hooks';
import type { SimpleRoute } from './useTypedRouter';
import { useMemo } from 'react';
import { Globe, ListMusic, Star, Settings, Tv, Clapperboard, Heart, FolderOpen } from 'lucide-react';

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
      icon: <Globe className="w-5 h-5" />,
      active: activeView === 'portals',
      onClick: () => navigate({ type: 'portals' }),
    },
    {
      id: 'm3u',
      label: 'M3U Playlists',
      icon: <ListMusic className="w-5 h-5" />,
      active: activeView === 'm3u' || activeView === 'm3u-channels' || activeView === 'm3u-movies' || activeView === 'm3u-series',
      onClick: () => navigate({ type: 'm3u' }),
      subItems: m3uId ? [
        { id: 'm3u-channels', label: t('channels'), icon: <Tv className="w-4 h-4" />, onClick: () => navigate({ type: 'm3u-channels' }), active: activeView === 'm3u-channels' },
        { id: 'm3u-movies', label: t('movies'), icon: <Clapperboard className="w-4 h-4" />, onClick: () => navigate({ type: 'm3u-movies' }), active: activeView === 'm3u-movies' },
        { id: 'm3u-series', label: t('series'), icon: <Clapperboard className="w-4 h-4" />, onClick: () => navigate({ type: 'm3u-series' }), active: activeView === 'm3u-series' },
      ] : undefined,
    },
    {
      id: 'for-you',
      label: t('forYou') || 'Dla Ciebie',
      icon: <Star className="w-5 h-5" />,
      active: activeView === 'for-you',
      disabled: !activePortal,
      onClick: () => navigate({ type: 'for-you' }),
    },
    {
      id: 'tv',
      label: t('channels'),
      icon: <Tv className="w-5 h-5" />,
      active: activeView === 'tv' || activeView === 'categories' || activeView === 'favorite-categories' || activeView === 'favorite-channels',
      disabled: !activePortal,
      subItems: [
        { id: 'categories', label: t('categories'), icon: <FolderOpen className="w-4 h-4" />, onClick: () => navigate({ type: 'categories' }), active: activeView === 'categories' },
        { id: 'favorite-categories', label: t('favoriteCategories'), icon: <Heart className="w-4 h-4" />, onClick: () => navigate({ type: 'favorite-categories' }), active: activeView === 'favorite-categories' },
        { id: 'favorite-channels', label: t('favoriteChannels'), icon: <Heart className="w-4 h-4" />, onClick: () => navigate({ type: 'favorite-channels' }), active: activeView === 'favorite-channels' },
      ],
    },
    {
      id: 'movies',
      label: t('movies'),
      icon: <Clapperboard className="w-5 h-5" />,
      active: activeView === 'movies' || activeView === 'movie-categories' || activeView === 'favorite-movie-categories' || activeView === 'favorite-movies' || activeView === 'movie-details',
      disabled: !activePortal,
      subItems: [
        { id: 'movie-categories', label: t('categories'), icon: <FolderOpen className="w-4 h-4" />, onClick: () => navigate({ type: 'movie-categories' }), active: activeView === 'movie-categories' },
        { id: 'favorite-movie-categories', label: t('favoriteCategories'), icon: <Heart className="w-4 h-4" />, onClick: () => navigate({ type: 'favorite-movie-categories' }), active: activeView === 'favorite-movie-categories' },
        { id: 'favorite-movies', label: t('favorites'), icon: <Heart className="w-4 h-4" />, onClick: () => navigate({ type: 'favorite-movies' }), active: activeView === 'favorite-movies' },
      ],
    },
    {
      id: 'series',
      label: t('series'),
      icon: <Clapperboard className="w-5 h-5" />,
      active: activeView === 'series' || activeView === 'series-categories' || activeView === 'favorite-series-categories' || activeView === 'favorite-series' || activeView === 'series-details',
      disabled: !activePortal,
      subItems: [
        { id: 'series-categories', label: t('categories'), icon: <FolderOpen className="w-4 h-4" />, onClick: () => navigate({ type: 'series-categories' }), active: activeView === 'series-categories' },
        { id: 'favorite-series-categories', label: t('favoriteCategories'), icon: <Heart className="w-4 h-4" />, onClick: () => navigate({ type: 'favorite-series-categories' }), active: activeView === 'favorite-series-categories' },
        { id: 'favorite-series', label: t('favorites'), icon: <Heart className="w-4 h-4" />, onClick: () => navigate({ type: 'favorite-series' }), active: activeView === 'favorite-series' },
      ],
    },
    {
      id: 'scb',
      label: 'SCB',
      icon: <Tv className="w-5 h-5" />,
      active: activeView === 'scb1' || activeView === 'scb2' || activeView === 'scb3',
      subItems: [
        { id: 'scb1', label: 'SCB 1', icon: <Tv className="w-4 h-4" />, onClick: () => navigate({ type: 'scb1' }), active: activeView === 'scb1' },
        { id: 'scb2', label: 'SCB 2', icon: <Tv className="w-4 h-4" />, onClick: () => navigate({ type: 'scb2' }), active: activeView === 'scb2' },
        { id: 'scb3', label: 'SCB 3', icon: <Tv className="w-4 h-4" />, onClick: () => navigate({ type: 'scb3' }), active: activeView === 'scb3' },
      ],
    },
    {
      id: 'imdb',
      label: 'IMDb',
      icon: <Clapperboard className="w-5 h-5" />,
      active: activeView === 'imdb',
      onClick: () => navigate({ type: 'imdb' }),
    },
    {
      id: 'settings',
      label: t('settings'),
      icon: <Settings className="w-5 h-5" />,
      active: false,
      onClick: () => setIsSettingsOpen(true),
    },
  ], [activeView, activePortal, navigate, setIsSettingsOpen, t, m3uId]);
};
