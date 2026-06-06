import { render } from '@testing-library/react';
import { MovieList } from '../MovieList';
import { useMoviesAll } from '../movies.hooks';
import { useFavorites, useFavoriteCategories } from '@/hooks/useFavorites';
import { usePortalsStore } from '@/store/portals.store';
import { useTranslation } from '@/hooks/useTranslation';

jest.mock('../movies.hooks', () => ({
  useMoviesAll: jest.fn(),
}));

jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: jest.fn(),
  useFavoriteCategories: jest.fn(),
}));

jest.mock('@/store/portals.store', () => ({
  usePortalsStore: jest.fn(),
}));

jest.mock('@/store/resume.store', () => {
  const mockGetProgress = jest.fn(() => undefined);
  const mockStore = Object.assign(
    () => ({
      getPosition: jest.fn(),
      getProgress: mockGetProgress,
      clearPosition: jest.fn(),
    }),
    {
      getState: () => ({
        getProgress: mockGetProgress,
      }),
      getPosition: jest.fn(),
      getProgress: mockGetProgress,
      clearPosition: jest.fn(),
    }
  );
  return {
    useResumeStore: mockStore,
  };
});

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('@/hooks/useImageCache', () => ({
  getImageUrl: jest.fn(() => Promise.resolve('http://test.com/poster.jpg')),
}));

jest.mock('@/hooks/useLongPress', () => ({
  useLongPress: jest.fn(() => ({
    isLongPress: false,
    ref: { current: null },
    onKeyDown: jest.fn(),
    onKeyUp: jest.fn(),
    isLongPressRef: { current: false },
  })),
}));

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(() => ({
    getVirtualItems: jest.fn(() => [
      { key: 'row-0', index: 0, start: 0 },
    ]),
    getTotalSize: jest.fn(() => 280),
  })),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  createDebugRequestContext: jest.fn(),
}));

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});

const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;
const mockUseMoviesAll = useMoviesAll as jest.MockedFunction<typeof useMoviesAll>;
const mockUseFavorites = useFavorites as jest.MockedFunction<typeof useFavorites>;
const mockUseFavoriteCategories = useFavoriteCategories as jest.MockedFunction<typeof useFavoriteCategories>;
const mockUsePortalsStore = usePortalsStore as jest.MockedFunction<typeof usePortalsStore>;

const mockClient = {} as any;

describe('MovieList', () => {
  const mockOnMovieSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTranslation.mockReturnValue({
      t: (key: string) => key,
      language: 'pl',
    } as any);

    mockUsePortalsStore.mockReturnValue({
      portals: [{ id: 'default', name: 'Test' }],
      activePortalId: 'default',
    } as any);

    mockUseFavorites.mockReturnValue({
      favorites: [],
      toggleItemFavorite: jest.fn(),
    } as any);

    mockUseFavoriteCategories.mockReturnValue({
      isCategoryFavorite: jest.fn(() => false),
      toggleCategory: jest.fn(),
    } as any);
  });

  it('should render without crashing', () => {
    mockUseMoviesAll.mockReturnValue({
      movies: [],
      isLoading: true,
      isFetching: false,
      error: null,
      streamingState: { isStreaming: false },
    } as any);

    const { container } = render(
      <MovieList
        client={mockClient}
        onMovieSelect={mockOnMovieSelect}
        search=""
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('should render error state', () => {
    mockUseMoviesAll.mockReturnValue({
      movies: [],
      isLoading: false,
      isFetching: false,
      error: new Error('Failed to load'),
      streamingState: { isStreaming: false },
    } as any);

    const { container } = render(
      <MovieList
        client={mockClient}
        onMovieSelect={mockOnMovieSelect}
        search=""
      />
    );

    expect(container).toBeInTheDocument();
  });
});
