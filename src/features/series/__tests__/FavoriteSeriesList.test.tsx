import { render } from '@testing-library/react';
import { FavoriteSeriesList } from '../FavoriteSeriesList';
import { useFavorites } from '@/hooks/useFavorites';
import { useTranslation } from '@/hooks/useTranslation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: jest.fn(),
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
    getVirtualItems: jest.fn(() => []),
    getTotalSize: jest.fn(() => 0),
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
const mockUseFavorites = useFavorites as jest.MockedFunction<typeof useFavorites>;

const queryClient = new QueryClient();

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('FavoriteSeriesList', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTranslation.mockReturnValue({
      t: (key: string) => key,
      language: 'en',
    } as any);

    mockUseFavorites.mockReturnValue({
      favorites: [],
      toggleItemFavorite: jest.fn(),
    } as any);
  });

  it('should render without crashing', () => {
    const { container } = renderWithProviders(
      <FavoriteSeriesList
        accountId="default"
        search=""
        onSeriesSelect={jest.fn()}
      />
    );
    expect(container).toBeInTheDocument();
  });
});
