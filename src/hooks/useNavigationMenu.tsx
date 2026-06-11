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

  const isPortalActive = activeView === 'portals' || activeView === 'tv' || activeView === 'categories' ||
    activeView === 'favorite-categories' || activeView === 'favorite-channels' || activeView === 'movies' ||
    activeView === 'movie-categories' || activeView === 'favorite-movie-categories' || activeView === 'favorite-movies' ||
    activeView === 'movie-details' || activeView === 'series' || activeView === 'series-categories' ||
    activeView === 'favorite-series-categories' || activeView === 'favorite-series' || activeView === 'series-details';

  const isM3uActive = activeView === 'm3u' || activeView === 'm3u-channels' || activeView === 'm3u-movies' || activeView === 'm3u-series' || activeView === 'm3u-favorites' || activeView === 'm3u-categories';

  return useMemo(() => [
    {
      id: 'portals',
      label: 'Portal Playlist',
      icon: <Globe className="w-5 h-5" />,
      active: isPortalActive,
      onClick: () => navigate({ type: 'portals' }),
      subItems: activePortal ? [
        { id: 'tv', label: t('channels'), icon: <Tv className="w-4 h-4" />, onClick: () => navigate({ type: 'tv' }), active: activeView === 'tv' },
        { id: 'categories', label: t('categories'), icon: <FolderOpen className="w-4 h-4" />, onClick: () => navigate({ type: 'categories' }), active: activeView === 'categories' },
        { id: 'favorite-channels', label: t('favoriteChannels'), icon: <Heart className="w-4 h-4" />, onClick: () => navigate({ type: 'favorite-channels' }), active: activeView === 'favorite-channels' },
        { id: 'movies', label: t('movies'), icon: <Clapperboard className="w-4 h-4" />, onClick: () => navigate({ type: 'movies' }), active: activeView === 'movies' },
        { id: 'movie-categories', label: t('categories'), icon: <FolderOpen className="w-4 h-4" />, onClick: () => navigate({ type: 'movie-categories' }), active: activeView === 'movie-categories' },
        { id: 'favorite-movies', label: t('favorites'), icon: <Heart className="w-4 h-4" />, onClick: () => navigate({ type: 'favorite-movies' }), active: activeView === 'favorite-movies' },
        { id: 'series', label: t('series'), icon: <Clapperboard className="w-4 h-4" />, onClick: () => navigate({ type: 'series' }), active: activeView === 'series' },
        { id: 'series-categories', label: t('categories'), icon: <FolderOpen className="w-4 h-4" />, onClick: () => navigate({ type: 'series-categories' }), active: activeView === 'series-categories' },
        { id: 'favorite-series', label: t('favorites'), icon: <Heart className="w-4 h-4" />, onClick: () => navigate({ type: 'favorite-series' }), active: activeView === 'favorite-series' },
      ] : undefined,
    },
    {
      id: 'm3u',
      label: 'M3U Playlist',
      icon: <ListMusic className="w-5 h-5" />,
      active: isM3uActive,
      onClick: () => navigate({ type: 'm3u' }),
      subItems: m3uId ? [
        { id: 'm3u-channels', label: t('channels'), icon: <Tv className="w-4 h-4" />, onClick: () => navigate({ type: 'm3u-channels' }), active: activeView === 'm3u-channels' },
        { id: 'm3u-categories', label: t('categories'), icon: <FolderOpen className="w-4 h-4" />, onClick: () => navigate({ type: 'm3u-categories' }), active: activeView === 'm3u-categories' },
        { id: 'm3u-favorites', label: t('favorites'), icon: <Heart className="w-4 h-4" />, onClick: () => navigate({ type: 'm3u-favorites' }), active: activeView === 'm3u-favorites' },
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
      id: 'settings',
      label: t('settings'),
      icon: <Settings className="w-5 h-5" />,
      active: false,
      onClick: () => setIsSettingsOpen(true),
    },
  ], [activeView, activePortal, navigate, setIsSettingsOpen, t, m3uId, isPortalActive, isM3uActive]);
};
