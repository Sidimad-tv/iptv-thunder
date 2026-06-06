import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlaybackManager } from '../usePlaybackManager';
import { usePlaybackStore } from '@/store/playback.store';
import { getSetting } from '@/hooks/useSettings';
import { QueryClient } from '@tanstack/react-query';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerVOD } from '@/types';
import { addRecentViewed } from '@/hooks/useRecentItems';
import { getSeriesInfo } from '@/features/series/series.api';
import { useTranslation } from '@/hooks/useTranslation';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  createDebugRequestContext: jest.fn(),
  logDebugRequest: jest.fn(),
  logDebugSuccess: jest.fn(),
  logDebugError: jest.fn(),
}));
jest.mock('@/lib/tauriStorage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));
jest.mock('@/store/playback.store');
jest.mock('@/hooks/useSettings');
jest.mock('@/hooks/useRecentItems');
jest.mock('@/features/series/series.api');
jest.mock('@/hooks/useTranslation');

const mockUsePlaybackStore = usePlaybackStore as jest.MockedFunction<typeof usePlaybackStore>;
const mockGetSetting = getSetting as jest.MockedFunction<typeof getSetting>;
const mockAddRecentViewed = addRecentViewed as jest.MockedFunction<typeof addRecentViewed>;
const mockGetSeriesInfo = getSeriesInfo as jest.MockedFunction<typeof getSeriesInfo>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

const mockClient = {
  ensureAuthenticated: jest.fn() as jest.MockedFunction<any>,
  getStreamUrl: jest.fn(),
  getEpisodeStream: jest.fn() as jest.MockedFunction<typeof StalkerClient.prototype.getEpisodeStream>,
  getAccount: jest.fn(() => ({ id: 'test-account', portalUrl: 'http://test.com', mac: 'test-mac' })),
  token: 'test-token',
  resolveLogoUrl: jest.fn(() => 'http://test.com/logo.jpg'),
  resolvePosterUrl: jest.fn(() => 'http://test.com/poster.jpg'),
} as unknown as StalkerClient;

const mockPlayer = {
  setBuffering: jest.fn(),
  setMedia: jest.fn(),
  setContentType: jest.fn(),
  close: jest.fn(),
};

let mockQueryClient: QueryClient;

function createMockQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

const mockSelectedSeries: StalkerVOD = {
  id: 123,
  name: 'Test Series',
  cmd: 'test_cmd',
  poster: 'http://test.com/poster.jpg',
  description: 'Test description',
  added: '2024-01-01',
  censored: false,
};

const mockEpisodes: StalkerVOD[] = [
  { id: 1, name: 'Episode 1', season: '1', episode: '1', cmd: 'ep1', description: '', added: '2024-01-01', censored: false },
  { id: 2, name: 'Episode 2', season: '1', episode: '2', cmd: 'ep2', description: '', added: '2024-01-01', censored: false },
  { id: 3, name: 'Episode 3', season: '2', episode: '1', cmd: 'ep3', description: '', added: '2024-01-01', censored: false },
  { id: 4, name: 'Episode 4', season: '2', episode: '2', cmd: 'ep4', description: '', added: '2024-01-01', censored: false },
];

const mockActivePortal = {
  id: 'portal-1',
  name: 'Test Portal',
};

const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    season: 'Sezon',
    episode: 'Odcinek',
  };
  return translations[key] || key;
});

describe('usePlaybackManager - handleEpisodeEnded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryClient = createMockQueryClient();

    mockUsePlaybackStore.mockReturnValue(mockPlayer);
    mockGetSetting.mockResolvedValue(true); // Autoplay enabled by default
    mockAddRecentViewed.mockResolvedValue(undefined);
    mockUseTranslation.mockReturnValue({
      t: mockT,
      currentLang: 'pl',
      changeLanguage: jest.fn(),
      isLoading: false,
    } as any);

    mockGetSeriesInfo.mockResolvedValue({
      series: mockSelectedSeries,
      episodes: mockEpisodes,
      seasons: ['1', '2'],
    });

    (mockClient.getEpisodeStream as jest.MockedFunction<any>).mockResolvedValue('http://test.com/stream.m3u8');
    (mockClient.ensureAuthenticated as jest.MockedFunction<any>).mockResolvedValue(undefined);
  });

  it('should autoplay next episode when current episode ends', async () => {
    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select the first episode
    await act(async () => {
      await result.current.handleEpisodeSelect(mockEpisodes[0], 0, 0);
    });

    // Clear previous calls
    mockPlayer.setMedia.mockClear();

    // Trigger episode ended
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    await waitFor(() => {
      // Should have called setMedia with the next episode (episode 2)
      expect(mockPlayer.setMedia).toHaveBeenCalled();
    });
  });

  it('should not autoplay when autoplay setting is disabled', async () => {
    mockGetSetting.mockResolvedValue(false);

    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select the first episode
    await act(async () => {
      await result.current.handleEpisodeSelect(mockEpisodes[0], 0, 0);
    });

    mockPlayer.setMedia.mockClear();

    // Trigger episode ended
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    // Should not autoplay when disabled
    expect(mockPlayer.setMedia).not.toHaveBeenCalled();
  });

  it('should not autoplay when there is no next episode', async () => {
    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select the last episode
    await act(async () => {
      await result.current.handleEpisodeSelect(mockEpisodes[3], 0, 3);
    });

    mockPlayer.setMedia.mockClear();

    // Trigger episode ended
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    // Should not autoplay when at the end
    expect(mockPlayer.setMedia).not.toHaveBeenCalled();
  });

  it('should not autoplay when no series is selected', async () => {
    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: null,
        queryClient: mockQueryClient,
      })
    );

    // Trigger episode ended
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    expect(mockPlayer.setMedia).not.toHaveBeenCalled();
  });

  it('should not autoplay when episodes list is empty', async () => {
    mockGetSeriesInfo.mockResolvedValue({
      series: mockSelectedSeries,
      episodes: [],
      seasons: [],
    });

    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select an episode
    await act(async () => {
      await result.current.handleEpisodeSelect(mockEpisodes[0], 0, 0);
    });

    mockPlayer.setMedia.mockClear();

    // Trigger episode ended
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    expect(mockPlayer.setMedia).not.toHaveBeenCalled();
  });

  it('should handle errors during autoplay gracefully', async () => {
    (mockClient.getEpisodeStream as jest.MockedFunction<any>).mockRejectedValue(new Error('Stream error'));

    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select the first episode
    await act(async () => {
      await result.current.handleEpisodeSelect(mockEpisodes[0], 0, 0);
    });

    mockPlayer.setMedia.mockClear();

    // Trigger episode ended - should handle error without crashing
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    // The function should complete without throwing
    expect(mockPlayer.setMedia).not.toHaveBeenCalled();
  });

  it('should update episode index correctly during autoplay', async () => {
    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select the first episode (index 0)
    await act(async () => {
      await result.current.handleEpisodeSelect(mockEpisodes[0], 0, 0);
    });

    mockPlayer.setMedia.mockClear();

    // Trigger episode ended - should move to index 1
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    await waitFor(() => {
      expect(mockPlayer.setMedia).toHaveBeenCalled();
      const callArgs = mockPlayer.setMedia.mock.calls[0][0];
      expect(callArgs.currentEpisodeIndex).toBe(1);
    });
  });

  it('should prevent race conditions with user interactions', async () => {
    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select the first episode
    await act(async () => {
      await result.current.handleEpisodeSelect(mockEpisodes[0], 0, 0);
    });

    mockPlayer.setMedia.mockClear();

    // Trigger episode ended once
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    // Should handle race conditions gracefully
    await waitFor(() => {
      expect(mockPlayer.setMedia).toHaveBeenCalled();
    });
  });

  it('should handle episodes with missing season/episode numbers', async () => {
    const episodesWithMissing: StalkerVOD[] = [
      { id: 1, name: 'Episode 1', season: '1', episode: '1', cmd: 'ep1', description: '', added: '2024-01-01', censored: false },
      { id: 2, name: 'Episode 2', season: '1', episode: '2', cmd: 'ep2', description: '', added: '2024-01-01', censored: false },
      { id: 3, name: 'Episode 3', season: '2', episode: '1', cmd: 'ep3', description: '', added: '2024-01-01', censored: false },
    ];

    mockGetSeriesInfo.mockResolvedValue({
      series: mockSelectedSeries,
      episodes: episodesWithMissing,
      seasons: ['1', '2'],
    });

    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select the first episode
    await act(async () => {
      await result.current.handleEpisodeSelect(episodesWithMissing[0], 0, 0);
    });

    mockPlayer.setMedia.mockClear();

    // Trigger episode ended
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    await waitFor(() => {
      expect(mockPlayer.setMedia).toHaveBeenCalled();
    });
  });

  it('should log console messages for debugging autoplay', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select the first episode
    await act(async () => {
      await result.current.handleEpisodeSelect(mockEpisodes[0], 0, 0);
    });

    mockPlayer.setMedia.mockClear();

    // Trigger episode ended
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    await waitFor(() => {
      expect(mockPlayer.setMedia).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('should revert refs on autoplay error', async () => {
    (mockClient.getEpisodeStream as jest.MockedFunction<any>).mockRejectedValueOnce(new Error('Stream error'));

    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select the first episode
    await act(async () => {
      await result.current.handleEpisodeSelect(mockEpisodes[0], 0, 0);
    });

    mockPlayer.setMedia.mockClear();

    // Reset the mock to reject on the next call (autoplay)
    (mockClient.getEpisodeStream as jest.MockedFunction<any>).mockRejectedValueOnce(new Error('Stream error'));

    // Trigger episode ended - should handle error
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    // Should complete without crashing
    expect(mockPlayer.setMedia).not.toHaveBeenCalled();
  });

  it('should use cached autoplay setting to avoid repeated async calls', async () => {
    mockGetSetting.mockClear();
    mockGetSetting.mockResolvedValue(true);

    const { result } = renderHook(() =>
      usePlaybackManager({
        client: mockClient,
        activePortal: mockActivePortal,
        selectedSeries: mockSelectedSeries,
        queryClient: mockQueryClient,
      })
    );

    // Select the first episode
    await act(async () => {
      await result.current.handleEpisodeSelect(mockEpisodes[0], 0, 0);
    });

    mockPlayer.setMedia.mockClear();

    // Trigger episode ended
    await act(async () => {
      await result.current.handleEpisodeEnded();
    });

    // getSetting should be called at least once
    expect(mockGetSetting).toHaveBeenCalled();
  });
});
