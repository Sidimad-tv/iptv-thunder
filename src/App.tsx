// =========================
// 🧠 COMPLETE APP WITH ALL FEATURES
// =========================
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { platform } from '@tauri-apps/plugin-os';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { usePortalsStore } from '@/store/portals.store';
import { useM3uStore } from '@/store/m3u.store';
import { useAppStore } from '@/store/app.store';
import { useTVNavigation } from '@/hooks';
import { ToastProvider } from '@/components/ui/Toast';
import { useTypedRouter, isMovieDetails, isSeriesDetails } from '@/hooks/useTypedRouter';
import { usePlaybackManager } from '@/hooks/usePlaybackManager';
import { useNavigationMenu } from '@/hooks/useNavigationMenu';
import { useEpgCacheManager } from '@/features/epg/epg.hooks';
import { AppLayout } from '@/components/AppLayout';
import { AppContent } from '@/components/AppContent';
import { StalkerAccount } from '@/types';
import { addRecentViewed } from '@/hooks/useRecentItems';

// Create a client with persistent cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

// Configure persistent storage (localStorage)
const persister = createAsyncStoragePersister({
  storage: globalThis.localStorage,
});

// Helper function to convert PortalAccount to StalkerAccount
function portalToStalkerAccount(portal: { id: string; name: string; portalUrl: string; mac: string; token?: string; expiresAt?: Date; login?: string }): StalkerAccount {
  return {
    id: portal.id,
    name: portal.name,
    portalUrl: portal.portalUrl,
    mac: portal.mac,
    token: portal.token,
    expiresAt: portal.expiresAt,
    login: portal.login,
    lastUsed: new Date(),
    isActive: true,
  };
}

function AppInner() {
  const [search, setSearch] = React.useState('');
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  // Manage EPG cache globally
  useEpgCacheManager();

  const activePortal = usePortalsStore(s =>
    s.portals.find(p => p.id === s.activePortalId) ?? null
  );
  const activeM3uId = useM3uStore(s => s.activeM3uId);

  const isFullscreen = useAppStore(s => s.isFullscreen);

  // Hide system titlebar on startup (only in Tauri environment)
  useEffect(() => {
    const hideDecorations = async () => {
      try {
        const window = getCurrentWindow();
        await window.setDecorations(false);
      } catch (err) {
        // Not running in Tauri environment or API not available
        console.debug('Not hiding decorations (not in Tauri):', err);
      }
    };
    void hideDecorations();
  }, []);

  // Routing logic
  const {
    route,
    navigate,
    navigateToMovie,
    navigateToSeries,
    navigateToCategory,
    goBack,
    selectedCategory,
    selectedMovie,
    selectedSeries,
    activeView,
  } = useTypedRouter();

  // TV Navigation (D-pad support for Android TV)
  useTVNavigation({
    selector: '[data-tv-focusable]',
    onBack: () => {
      if ((isMovieDetails(route) && selectedMovie) || (isSeriesDetails(route) && selectedSeries) || route.type === 'tv' || route.type === 'movies' || route.type === 'series') {
        goBack();
      }
    },
    onEnter: (_element) => {
      // Element click is handled by the hook, this is for additional logic if needed
    },
  });

  // Create client only when we have an active portal (memoized to avoid recreation on every render)
  const client = useMemo(() => 
    activePortal ? new StalkerClient(portalToStalkerAccount(activePortal)) : null,
    [activePortal?.id]
  );

  // Playback manager
  const {
    player,
    handleChannelSelect,
    handleMoviePlay,
    handleEpisodeSelect,
    handleEpisodeEnded,
    playNextEpisode,
    close: closePlayer,
  } = usePlaybackManager({
    client,
    activePortal,
    selectedSeries,
    queryClient,
  });

  // Navigation menu
  const navigationItems = useNavigationMenu({
    activeView,
    activePortal,
    activeM3uId,
    navigate,
    setIsSettingsOpen,
  });

  // Set active container based on current view
  // Note: We don't set active container for main layout to allow free navigation
  // between sidebar and main content. Container system is only for modals/popups.
  const wasSettingsOpenRef = useRef(false);
  useEffect(() => {
    // Restore focus when Settings closes (but not on initial load)
    if (!isSettingsOpen && wasSettingsOpenRef.current) {
      wasSettingsOpenRef.current = false;
      setTimeout(() => {
        (document.activeElement as HTMLElement)?.blur();
        setTimeout(() => {
          const settingsButton = document.querySelector('[data-tv-id="settings"]') as HTMLElement;
          if (settingsButton) {
            settingsButton.focus();
          }
        }, 50);
      }, 50);
    } else if (isSettingsOpen) {
      wasSettingsOpenRef.current = true;
    }
  }, [isSettingsOpen]);

  return (
    <AppLayout
      activeView={activeView}
      activePortal={activePortal}
      client={client}
      search={search}
      isSettingsOpen={isSettingsOpen}
      isFullscreen={isFullscreen}
      player={player}
      closePlayer={closePlayer}
      navigationItems={navigationItems}
      setIsSettingsOpen={setIsSettingsOpen}
      setSearch={setSearch}
      handleEpisodeEnded={handleEpisodeEnded}
      playNextEpisode={playNextEpisode}
      handleChannelSelect={handleChannelSelect}
    >
      <AppContent
        route={route}
        activePortal={activePortal}
        client={client}
        search={search}
        selectedCategory={selectedCategory}
        handleChannelSelect={handleChannelSelect}
        navigateToMovie={navigateToMovie}
        navigateToSeries={navigateToSeries}
        navigateToCategory={navigateToCategory}
        goBack={goBack}
        handleMoviePlay={handleMoviePlay}
        handleEpisodeSelect={handleEpisodeSelect}
      />
    </AppLayout>
  );
}

export const App: React.FC = () => {
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    try {
      const osPlatform = platform();
      setIsAndroid(osPlatform === 'android');
    } catch (e) {
      console.error('[App] Platform detection failed:', e);
      setIsAndroid(false);
    }
  }, []);

  // Register addRecentViewed bridge for Android player
  useEffect(() => {
    // Only register on Android
    if (!isAndroid) return;

    // Only register if not already registered
    if ((globalThis.window as any).addRecentViewed) return;

    (globalThis.window as any).addRecentViewed = async (type: string, itemId: string, name: string, poster: string, cmd: string, genreId: string): Promise<void> => {
      try {
        console.log('[App] addRecentViewed called:', type, itemId, name);
        
        // Get active portal
        const activePortal = usePortalsStore.getState().getActivePortal();
        if (!activePortal) {
          console.error('[App] No active portal for addRecentViewed');
          return;
        }

        await addRecentViewed(activePortal.id, type as 'live' | 'vod' | 'series', itemId, {
          name,
          poster,
          cmd,
          genre_id: genreId
        });
        
        // Invalidate recent viewed queries to update UI
        queryClient.invalidateQueries({ queryKey: ['recent-viewed'] });
        
        console.log('[App] addRecentViewed success');
      } catch (e) {
        console.error('[App] addRecentViewed failed:', e);
      }
    };

    console.log('[App] addRecentViewed bridge registered globally');
  }, [isAndroid, queryClient]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000, buster: 'iptv-v1' }}
    >
      <div className={`app-wrapper ${isAndroid ? 'android-tv' : ''}`}>
        <ToastProvider>
          <AppInner />
        </ToastProvider>
      </div>
    </PersistQueryClientProvider>
  );
};
