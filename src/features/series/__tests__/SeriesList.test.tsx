import { render, screen } from '@testing-library/react';
import { SeriesList } from '../SeriesList';
import { useSeriesAll } from '../series.hooks';
import { useFavorites, useFavoriteCategories } from '@/hooks/useFavorites';
import { usePortalsStore } from '@/store/portals.store';
import { useTranslation } from '@/hooks/useTranslation';
import { StalkerVOD, StalkerGenre } from '@/types';

jest.mock('../series.hooks', () => ({
  useSeriesAll: jest.fn(),
}));

jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: jest.fn(),
  useFavoriteCategories: jest.fn(),
}));

jest.mock('@/store/portals.store', () => ({
  usePortalsStore: jest.fn(),
}));

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
const mockUseSeriesAll = useSeriesAll as jest.MockedFunction<typeof useSeriesAll>;
const mockUseFavorites = useFavorites as jest.MockedFunction<typeof useFavorites>;
const mockUseFavoriteCategories = useFavoriteCategories as jest.MockedFunction<typeof useFavoriteCategories>;
const mockUsePortalsStore = usePortalsStore as jest.MockedFunction<typeof usePortalsStore>;

const mockClient = {} as any;

const mockSeries = [
  {
    id: 1,
    name: 'Breaking Bad',
    series: 'Breaking Bad',
    poster: 'http://test.com/poster1.jpg',
    cmd: 'test_cmd_1',
    description: 'A chemistry teacher turns to cooking meth',
    rating_imdb: 9.5,
    year: 2008,
    genres_str: 'Drama',
    added: '2024-01-01',
    censored: false,
  },
  {
    id: 2,
    name: 'The Wire',
    series: 'The Wire',
    poster: 'http://test.com/poster2.jpg',
    cmd: 'test_cmd_2',
    description: 'Crime drama set in Baltimore',
    rating_imdb: 9.3,
    year: 2002,
    genres_str: 'Crime',
    added: '2024-01-01',
    censored: false,
  },
] as StalkerVOD[];

const mockCategory: StalkerGenre = {
  id: '1',
  title: 'Drama',
  alias: 'drama',
};

describe('SeriesList', () => {
  const mockOnSeriesSelect = jest.fn();

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

  it('should render loading state', () => {
    mockUseSeriesAll.mockReturnValue({
      series: [],
      isLoading: true,
      error: null,
    } as any);

    render(
      <SeriesList
        client={mockClient}
        onSeriesSelect={mockOnSeriesSelect}
        search=""
      />
    );

    expect(screen.getByText('loadingSeries')).toBeInTheDocument();
  });

  it('should render error state', () => {
    mockUseSeriesAll.mockReturnValue({
      series: [],
      isLoading: false,
      error: new Error('Failed to load'),
    } as any);

    render(
      <SeriesList
        client={mockClient}
        onSeriesSelect={mockOnSeriesSelect}
        search=""
      />
    );

    expect(screen.getByText('errorLoadingSeries')).toBeInTheDocument();
  });

  it('should render series list when loaded', () => {
    mockUseSeriesAll.mockReturnValue({
      series: mockSeries,
      isLoading: false,
      error: null,
    } as any);

    render(
      <SeriesList
        client={mockClient}
        onSeriesSelect={mockOnSeriesSelect}
        search=""
      />
    );

    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
    expect(screen.getByText('The Wire')).toBeInTheDocument();
  });

  it('should render category header when category is selected', () => {
    mockUseSeriesAll.mockReturnValue({
      series: mockSeries,
      isLoading: false,
      error: null,
    } as any);

    render(
      <SeriesList
        client={mockClient}
        onSeriesSelect={mockOnSeriesSelect}
        selectedCategory={mockCategory}
        search=""
      />
    );

    expect(screen.getByText('Drama')).toBeInTheDocument();
  });

  it('should filter series based on search', () => {
    mockUseSeriesAll.mockReturnValue({
      series: mockSeries,
      isLoading: false,
      error: null,
    } as any);

    render(
      <SeriesList
        client={mockClient}
        onSeriesSelect={mockOnSeriesSelect}
        search="Breaking"
      />
    );

    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
  });
});
