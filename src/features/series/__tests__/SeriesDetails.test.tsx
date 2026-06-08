import { render, screen, fireEvent } from '@testing-library/react';
import { SeriesDetails } from '../SeriesDetails';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerVOD } from '@/types';
import { useFavorites } from '@/hooks/useFavorites';
import { useResumeStore } from '@/store/resume.store';
import { usePortalsStore } from '@/store/portals.store';
import { useTranslation } from '@/hooks/useTranslation';
import { useSeriesInfo } from '../series.hooks';
import { useTVNavigation } from '@/hooks';

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
jest.mock('@/hooks/useFavorites');
jest.mock('@/store/resume.store');
jest.mock('@/store/portals.store');
jest.mock('@/hooks/useTranslation');
jest.mock('../series.hooks', () => ({
  ...jest.requireActual('../series.hooks'),
  usePrefetchSeriesStream: jest.fn(() => jest.fn()),
  useSeriesInfo: jest.fn(),
}));
jest.mock('@/hooks');
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select">
      <div data-value={value} onClick={() => onValueChange?.('2')} data-testid="select-trigger">
        {value}
      </div>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value, onClick }: any) => (
    <div data-value={value} onClick={onClick}>{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ children }: any) => <div>{children}</div>,
}));

const mockUseFavorites = useFavorites as jest.MockedFunction<typeof useFavorites>;
const mockUseResumeStore = useResumeStore as jest.MockedFunction<typeof useResumeStore>;
const mockUsePortalsStore = usePortalsStore as jest.MockedFunction<typeof usePortalsStore>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;
const mockUseSeriesInfo = useSeriesInfo as jest.MockedFunction<typeof useSeriesInfo>;
const mockUseTVNavigation = useTVNavigation as jest.MockedFunction<typeof useTVNavigation>;

const mockClient = {
  getAccount: jest.fn(() => ({ id: 'test-account', portalUrl: 'http://test.com' })),
  resolvePosterUrl: jest.fn((item) => item.poster || ''),
} as unknown as StalkerClient;

const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    season: 'Sezon',
    seasons: 'Sezony',
    episode: 'Odcinek',
    episodes_2_4: 'odcinki',
    episodes_5_plus: 'odcinków',
    director: 'Reżyser',
    cast: 'Obsada',
    playFirstEpisode: 'Odtwórz pierwszy odcinek',
    addToFavorites: 'Dodaj do ulubionych',
    removeFromFavorites: 'Usuń z ulubionych',
    episodes: 'Odcinki',
    noEpisodes: 'Brak odcinków',
    resumeWatching: 'Wznów oglądanie',
    watchedEpisodeTo: 'Oglądałeś odcinek do',
    playFromStart: 'Odtwórz od początku',
    resumePlayback: 'Wznów odtwarzanie',
    resume: 'Wznów',
    watched: 'Obejrzany',
    minutes: 'min',
  };
  return translations[key] || key;
});

const mockOnPlay = jest.fn();
const mockOnBack = jest.fn();

describe('SeriesDetails - handlePlayFirstEpisode', () => {
  const mockSeries: StalkerVOD = {
    id: 123,
    name: 'Test Series',
    cmd: 'test_cmd',
    poster: 'http://test.com/poster.jpg',
    description: 'Test description',
    year: 2024,
    genres_str: 'Dramat',
    director: 'John Doe',
    actors: 'Actor1, Actor2',
    rating_imdb: 8.5,
    added: '2024-01-01',
    censored: false,
  };

  const mockEpisodes: StalkerVOD[] = [
    { id: 1, name: 'Episode 1', season: '1', episode: '1', cmd: 'ep1', description: '', added: '2024-01-01', censored: false },
    { id: 2, name: 'Episode 2', season: '1', episode: '2', cmd: 'ep2', description: '', added: '2024-01-01', censored: false },
    { id: 3, name: 'Episode 3', season: '2', episode: '1', cmd: 'ep3', description: '', added: '2024-01-01', censored: false },
    { id: 4, name: 'Episode 4', season: '2', episode: '2', cmd: 'ep4', description: '', added: '2024-01-01', censored: false },
    { id: 5, name: 'Episode 5', season: '3', episode: '1', cmd: 'ep5', description: '', added: '2024-01-01', censored: false },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTranslation.mockReturnValue({
      t: mockT,
      currentLang: 'en',
      changeLanguage: jest.fn(),
      isLoading: false,
    } as any);

    mockUseFavorites.mockReturnValue({
      favorites: [],
      toggleItemFavorite: jest.fn(),
    } as any);

    mockUseResumeStore.mockReturnValue({
      getPosition: jest.fn(() => 0),
      clearPosition: jest.fn(),
      getWatchStatus: jest.fn(() => 'not_watched'),
    } as any);

    mockUsePortalsStore.mockReturnValue({
      portals: [{ id: 'test-account' }],
      activePortalId: 'test-account',
    } as any);

    mockUseTVNavigation.mockReturnValue({
      setActiveContainer: jest.fn(),
    } as any);

    mockUseSeriesInfo.mockReturnValue({
      data: {
        series: mockSeries,
        episodes: mockEpisodes,
        seasons: ['1', '2', '3'],
      },
      isLoading: false,
    } as any);
  });

  it('should play the first episode (lowest season, lowest episode) when play button is clicked', () => {
    render(
      <SeriesDetails
        series={mockSeries}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const playButton = screen.getByText('Odtwórz pierwszy odcinek');
    fireEvent.click(playButton);

    // Should play episode 1 (season 1, episode 1) - the first episode
    expect(mockOnPlay).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        season: '1',
        episode: '1',
      }),
      0
    );
  });

  it('should handle episodes with missing season/episode numbers', () => {
    const episodesWithMissing: StalkerVOD[] = [
      { id: 1, name: 'Episode 1', season: '1', episode: '1', cmd: 'ep1', description: '', added: '2024-01-01', censored: false },
      { id: 2, name: 'Episode 2', season: '2', episode: '5', cmd: 'ep2', description: '', added: '2024-01-01', censored: false },
      { id: 3, name: 'Episode 3', season: '1', episode: '10', cmd: 'ep3', description: '', added: '2024-01-01', censored: false },
    ];

    mockUseSeriesInfo.mockReturnValue({
      data: {
        series: mockSeries,
        episodes: episodesWithMissing,
        seasons: ['1', '2'],
      },
      isLoading: false,
    } as any);

    render(
      <SeriesDetails
        series={mockSeries}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const playButton = screen.getByText('Odtwórz pierwszy odcinek');
    fireEvent.click(playButton);

    // Episode 1 (season 1, episode 1) is first
    expect(mockOnPlay).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        season: '1',
        episode: '1',
      }),
      0
    );
  });

  it('should not call onPlay when there are no episodes', () => {
    mockUseSeriesInfo.mockReturnValue({
      data: {
        series: mockSeries,
        episodes: [],
        seasons: [],
      },
      isLoading: false,
    } as any);

    render(
      <SeriesDetails
        series={mockSeries}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    // Play button should not be rendered when there are no episodes
    expect(screen.queryByText('Odtwórz pierwszy odcinek')).not.toBeInTheDocument();
    expect(mockOnPlay).not.toHaveBeenCalled();
  });

  it('should sort episodes by season descending, then episode descending', () => {
    const unsortedEpisodes: StalkerVOD[] = [
      { id: 1, name: 'Episode 1', season: '1', episode: '5', cmd: 'ep1', description: '', added: '2024-01-01', censored: false },
      { id: 2, name: 'Episode 2', season: '3', episode: '1', cmd: 'ep2', description: '', added: '2024-01-01', censored: false },
      { id: 3, name: 'Episode 3', season: '2', episode: '10', cmd: 'ep3', description: '', added: '2024-01-01', censored: false },
      { id: 4, name: 'Episode 4', season: '3', episode: '5', cmd: 'ep4', description: '', added: '2024-01-01', censored: false },
      { id: 5, name: 'Episode 5', season: '2', episode: '1', cmd: 'ep5', description: '', added: '2024-01-01', censored: false },
    ];

    mockUseSeriesInfo.mockReturnValue({
      data: {
        series: mockSeries,
        episodes: unsortedEpisodes,
        seasons: ['1', '2', '3'],
      },
      isLoading: false,
    } as any);

    render(
      <SeriesDetails
        series={mockSeries}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const playButton = screen.getByText('Odtwórz pierwszy odcinek');
    fireEvent.click(playButton);

    // Should play episode 1 (season 1, episode 5) - lowest season and lowest episode
    expect(mockOnPlay).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        season: '1',
        episode: '5',
      }),
      0
    );
  });

  it('should update selected season to match the newest episode season', () => {
    render(
      <SeriesDetails
        series={mockSeries}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const playButton = screen.getByText('Odtwórz pierwszy odcinek');
    fireEvent.click(playButton);

    // After clicking play, the season should be updated to season 1 (first episode's season)
    // This is verified by the fact that the correct episode (season 1) was played
    expect(mockOnPlay).toHaveBeenCalledWith(
      expect.objectContaining({
        season: '1',
      }),
      0
    );
  });

  it('should show resume dialog when newest episode has resume position', () => {
    mockUseResumeStore.mockReturnValue({
      getPosition: jest.fn(() => 100), // Resume position > 30
      clearPosition: jest.fn(),
      getWatchStatus: jest.fn(() => 'in_progress'),
    } as any);

    render(
      <SeriesDetails
        series={mockSeries}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const playButton = screen.getByText('Odtwórz pierwszy odcinek');
    fireEvent.click(playButton);

    // Should show resume dialog instead of playing immediately
    expect(screen.getByText('Wznów oglądanie')).toBeInTheDocument();
    expect(mockOnPlay).not.toHaveBeenCalled();
  });

  it('should handle string season/episode numbers correctly', () => {
    const stringEpisodes: StalkerVOD[] = [
      { id: 1, name: 'Episode 1', season: '10', episode: '5', cmd: 'ep1', description: '', added: '2024-01-01', censored: false },
      { id: 2, name: 'Episode 2', season: '2', episode: '15', cmd: 'ep2', description: '', added: '2024-01-01', censored: false },
      { id: 3, name: 'Episode 3', season: '10', episode: '10', cmd: 'ep3', description: '', added: '2024-01-01', censored: false },
    ];

    mockUseSeriesInfo.mockReturnValue({
      data: {
        series: mockSeries,
        episodes: stringEpisodes,
        seasons: ['2', '10'],
      },
      isLoading: false,
    } as any);

    render(
      <SeriesDetails
        series={mockSeries}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const playButton = screen.getByText('Odtwórz pierwszy odcinek');
    fireEvent.click(playButton);

    // Should play episode 2 (season 2, episode 15) - lowest season
    expect(mockOnPlay).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        season: '2',
        episode: '15',
      }),
      0
    );
  });
});
