import { render, screen, fireEvent } from '@testing-library/react';
import { MovieDetails } from '../MovieDetails';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerVOD } from '@/types';
import { useFavorites } from '@/hooks/useFavorites';
import { useResumeStore } from '@/store/resume.store';
import { usePortalsStore } from '@/store/portals.store';
import { useTranslation } from '@/hooks/useTranslation';
import { useMovieDetails, usePrefetchMovieStream } from '../movies.hooks';

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
jest.mock('../movies.hooks', () => ({
  ...jest.requireActual('../movies.hooks'),
  useMovieDetails: jest.fn(),
  usePrefetchMovieStream: jest.fn(() => jest.fn()),
}));

const mockUseFavorites = useFavorites as jest.MockedFunction<typeof useFavorites>;
const mockUseResumeStore = useResumeStore as jest.MockedFunction<typeof useResumeStore>;
const mockUsePortalsStore = usePortalsStore as jest.MockedFunction<typeof usePortalsStore>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;
const mockUseMovieDetails = useMovieDetails as jest.MockedFunction<typeof useMovieDetails>;
const mockUsePrefetchMovieStream = usePrefetchMovieStream as jest.MockedFunction<typeof usePrefetchMovieStream>;

const mockClient = {
  getAccount: jest.fn(() => ({ id: 'test-account', portalUrl: 'http://test.com' })),
  resolvePosterUrl: jest.fn((item) => item.poster || ''),
} as unknown as StalkerClient;

const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    play: 'Odtwórz',
    addToFavorites: 'Dodaj do ulubionych',
    removeFromFavorites: 'Usuń z ulubionych',
    watchedProgress: 'Obejrzano: {{position}} z {{total}}',
    resume: 'Wznów',
    playFromStart: 'Odtwórz od początku',
    close: 'Zamknij',
    director: 'Reżyser',
    cast: 'Obsada',
    genre: 'Gatunek',
    year: 'Rok',
    duration: 'Czas trwania',
    minutes: 'min',
  };
  return translations[key] || key;
});

const mockOnPlay = jest.fn();
const mockOnBack = jest.fn();

describe('MovieDetails', () => {
  const mockMovie: StalkerVOD = {
    id: 123,
    name: 'Test Movie',
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
    length: 120,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTranslation.mockReturnValue({
      t: mockT,
      currentLang: 'pl',
      changeLanguage: jest.fn(),
      isLoading: false,
    } as any);

    mockUseFavorites.mockReturnValue({
      isItemFavorite: jest.fn(() => false),
      toggleItemFavorite: jest.fn(),
    } as any);

    mockUseResumeStore.mockReturnValue({
      getPosition: jest.fn(() => 0),
      clearPosition: jest.fn(),
      getProgress: jest.fn(() => null),
    } as any);

    mockUsePortalsStore.mockReturnValue({
      portals: [{ id: 'test-account' }],
      activePortalId: 'test-account',
    } as any);

    mockUseMovieDetails.mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    mockUsePrefetchMovieStream.mockReturnValue(jest.fn());
  });

  it('should render movie details correctly', () => {
    render(
      <MovieDetails
        movie={mockMovie}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('Dramat')).toBeInTheDocument();
  });

  it('should call onPlay when play button is clicked', () => {
    render(
      <MovieDetails
        movie={mockMovie}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const playButton = screen.getByText('Odtwórz');
    fireEvent.click(playButton);

    expect(mockOnPlay).toHaveBeenCalledWith(mockMovie, 0);
  });

  it('should show resume dialog when movie has resume position', () => {
    mockUseResumeStore.mockReturnValue({
      getPosition: jest.fn(() => 100),
      clearPosition: jest.fn(),
      getProgress: jest.fn(() => ({
        position: 100,
        duration: 7200,
        status: 'in_progress',
        percentage: 1,
      })),
    } as any);

    render(
      <MovieDetails
        movie={mockMovie}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const playButton = screen.getByText('Odtwórz');
    fireEvent.click(playButton);

    expect(screen.getByText('Wznów')).toBeInTheDocument();
    expect(mockOnPlay).not.toHaveBeenCalled();
  });

  it('should play from start when resume dialog "play from start" is clicked', () => {
    mockUseResumeStore.mockReturnValue({
      getPosition: jest.fn(() => 100),
      clearPosition: jest.fn(),
      getProgress: jest.fn(() => ({
        position: 100,
        duration: 7200,
        status: 'in_progress',
        percentage: 1,
      })),
    } as any);

    render(
      <MovieDetails
        movie={mockMovie}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const playButton = screen.getByText('Odtwórz');
    fireEvent.click(playButton);

    const playFromStartButton = screen.getByText('fromStart');
    fireEvent.click(playFromStartButton);

    expect(mockOnPlay).toHaveBeenCalledWith(mockMovie, 0);
  });

  it('should resume from position when resume dialog "resume" is clicked', () => {
    mockUseResumeStore.mockReturnValue({
      getPosition: jest.fn(() => 100),
      clearPosition: jest.fn(),
      getProgress: jest.fn(() => ({
        position: 100,
        duration: 7200,
        status: 'in_progress',
        percentage: 1,
      })),
    } as any);

    render(
      <MovieDetails
        movie={mockMovie}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const playButton = screen.getByText('Odtwórz');
    fireEvent.click(playButton);

    const resumeButton = screen.getByText('Wznów');
    fireEvent.click(resumeButton);

    expect(mockOnPlay).toHaveBeenCalledWith(mockMovie, 100);
  });

  it('should toggle favorite when favorite button is clicked', () => {
    const mockToggleFavorite = jest.fn();
    mockUseFavorites.mockReturnValue({
      isItemFavorite: jest.fn(() => false),
      toggleItemFavorite: mockToggleFavorite,
    } as any);

    render(
      <MovieDetails
        movie={mockMovie}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const favoriteButton = screen.getByText('Dodaj do ulubionych');
    fireEvent.click(favoriteButton);

    expect(mockToggleFavorite).toHaveBeenCalled();
  });

  it('should call onBack when back button is clicked', () => {
    render(
      <MovieDetails
        movie={mockMovie}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    const backButton = document.querySelector('[data-tv-group="movie-details-close"]');
    fireEvent.click(backButton!);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it('should display movie details from API when available', () => {
    const detailedMovie = {
      ...mockMovie,
      description: 'Detailed description from API',
      length: 150,
    };

    mockUseMovieDetails.mockReturnValue({
      data: detailedMovie,
      isLoading: false,
    } as any);

    render(
      <MovieDetails
        movie={mockMovie}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText('Detailed description from API')).toBeInTheDocument();
  });

  it('should handle movie with invalid id', () => {
    const invalidMovie = {
      ...mockMovie,
      id: 0,
    };

    render(
      <MovieDetails
        movie={invalidMovie}
        client={mockClient}
        onPlay={mockOnPlay}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
  });
});
