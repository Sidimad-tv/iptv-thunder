import { render } from '@testing-library/react';
import { MovieCategoriesList } from '../MovieCategoriesList';
import { useFavoriteCategories } from '@/hooks/useFavorites';
import { useMovieCategories } from '../movies.hooks';
import { useTranslation } from '@/hooks/useTranslation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../movies.hooks', () => ({
  useMovieCategories: jest.fn(),
}));

jest.mock('@/hooks/useFavorites', () => ({
  useFavoriteCategories: jest.fn(),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('@/components/ui/CategoryCard', () => ({
  CategoryCard: () => <div>CategoryCard</div>,
}));

const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;
const mockUseMovieCategories = useMovieCategories as jest.MockedFunction<typeof useMovieCategories>;
const mockUseFavoriteCategories = useFavoriteCategories as jest.MockedFunction<typeof useFavoriteCategories>;

const queryClient = new QueryClient();

const mockClient = {
  getAccount: () => ({ id: 'default' }),
} as any;

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('MovieCategoriesList', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTranslation.mockReturnValue({
      t: (key: string) => key,
      language: 'en',
    } as any);

    mockUseMovieCategories.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockUseFavoriteCategories.mockReturnValue({
      isCategoryFavorite: jest.fn(() => false),
      toggleCategory: jest.fn(),
    } as any);
  });

  it('should render without crashing', () => {
    const { container } = renderWithProviders(
      <MovieCategoriesList
        client={mockClient}
        onCategorySelect={jest.fn()}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render loading state', () => {
    mockUseMovieCategories.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { container } = renderWithProviders(
      <MovieCategoriesList
        client={mockClient}
        onCategorySelect={jest.fn()}
      />
    );
    expect(container).toBeInTheDocument();
  });
});
