import { render, screen, fireEvent } from '@testing-library/react';
import { FavoriteMovieCategoriesList } from '../FavoriteMovieCategoriesList';
import { useFavoriteCategories } from '@/hooks/useFavorites';
import { useMovieCategories } from '../movies.hooks';
import { useTranslation } from '@/hooks/useTranslation';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerGenre } from '@/types';

// Mock hooks
jest.mock('@/hooks/useFavorites', () => ({
  useFavoriteCategories: jest.fn(),
}));

jest.mock('../movies.hooks', () => ({
  useMovieCategories: jest.fn(),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: jest.fn(),
}));

// Mock StalkerClient
const mockClient = {
  getAccount: jest.fn(() => ({ id: 'test-account' })),
} as unknown as StalkerClient;

const mockUseFavoriteCategories = useFavoriteCategories as jest.MockedFunction<typeof useFavoriteCategories>;
const mockUseMovieCategories = useMovieCategories as jest.MockedFunction<typeof useMovieCategories>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    favoriteMovieCategories: 'Ulubione kategorie filmów',
    yourFavoriteMovieCategories: 'Twoje ulubione kategorie filmów',
    noFavoriteMovieCategories: 'Brak ulubionych kategorii filmów',
    addFavoriteMovieCategoriesHint: 'Nie masz jeszcze żadnych ulubionych kategorii filmów.',
    movieCategoryTip: '💡 Wskazówka: Przejdź do Movies → Categories i kliknij serce.',
    removeFromFavorites: 'Usuń z ulubionych',
    addToFavorites: 'Dodaj do ulubionych',
    all: 'Wszystkie',
  };
  return translations[key] || key;
});

describe('FavoriteMovieCategoriesList', () => {
  const mockCategories: StalkerGenre[] = [
    { id: '1', title: 'Akcja' },
    { id: '2', title: 'Komedia' },
    { id: '3', title: 'Dramat' },
  ];

  const mockOnCategorySelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseTranslation.mockReturnValue({
      t: mockT,
      currentLang: 'pl',
      changeLanguage: jest.fn(),
      isLoading: false,
    } as any);

    mockUseFavoriteCategories.mockReturnValue({
      categoryIds: ['1', '2', '3'],
      isLoading: false,
      isCategoryFavorite: jest.fn((id) => ['1', '2', '3'].includes(id)),
      toggleCategory: jest.fn(),
      isPending: false,
    });

    mockUseMovieCategories.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      refetch: jest.fn(),
      isRefetching: false,
      error: null,
    });
  });

  it('should render loading state', () => {
    mockUseMovieCategories.mockReturnValue({
      data: [],
      isLoading: true,
      refetch: jest.fn(),
      isRefetching: false,
      error: null,
    });

    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    // Check for skeleton loading elements
    const skeletons = screen.getAllByRole('generic').filter(el => 
      el.classList.contains('animate-pulse')
    );
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render error state', () => {
    mockUseMovieCategories.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
      isRefetching: false,
      error: new Error('Failed to load'),
    } as any);

    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    expect(screen.getByText('⚠️')).toBeInTheDocument();
    expect(screen.getByText('Błąd ładowania kategorii')).toBeInTheDocument();
    expect(screen.getByText('Spróbuj ponownie')).toBeInTheDocument();
  });

  it('should render empty state when no favorites', () => {
    mockUseFavoriteCategories.mockReturnValue({
      categoryIds: [],
      isLoading: false,
      isCategoryFavorite: jest.fn(() => false),
      toggleCategory: jest.fn(),
      isPending: false,
    });

    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    expect(screen.getByText('⭐')).toBeInTheDocument();
    expect(screen.getByText('Brak ulubionych kategorii filmów')).toBeInTheDocument();
  });

  it('should render favorite categories', () => {
    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    expect(screen.getByText('Ulubione kategorie filmów')).toBeInTheDocument();
    expect(screen.getByText('Akcja')).toBeInTheDocument();
    expect(screen.getByText('Komedia')).toBeInTheDocument();
    expect(screen.getByText('Dramat')).toBeInTheDocument();
  });

  it('should filter categories by search', () => {
    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
        search="Akcja"
      />
    );

    expect(screen.getByText('Akcja')).toBeInTheDocument();
    expect(screen.queryByText('Komedia')).not.toBeInTheDocument();
    expect(screen.queryByText('Dramat')).not.toBeInTheDocument();
  });

  it('should render no results when search matches nothing', () => {
    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
        search="NonExistent"
      />
    );

    expect(screen.getByText('🔍')).toBeInTheDocument();
    expect(screen.getByText('Nie znaleziono kategorii')).toBeInTheDocument();
  });

  it('should call onCategorySelect when category clicked', () => {
    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    const categoryElement = screen.getByText('Akcja');
    fireEvent.click(categoryElement);

    expect(mockOnCategorySelect).toHaveBeenCalledWith(mockCategories[0]);
  });

  it('should call toggleCategory when favorite button clicked', () => {
    const mockToggleCategory = jest.fn();
    mockUseFavoriteCategories.mockReturnValue({
      categoryIds: ['1', '2', '3'],
      isLoading: false,
      isCategoryFavorite: jest.fn((id) => ['1', '2', '3'].includes(id)),
      toggleCategory: mockToggleCategory,
      isPending: false,
    });

    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    const favoriteButtons = screen.getAllByRole('button', { name: /Usuń z ulubionych/i });
    fireEvent.click(favoriteButtons[0]);

    expect(mockToggleCategory).toHaveBeenCalled();
  });

  it('should show selected category info', () => {
    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    const categoryElement = screen.getByText('Akcja');
    fireEvent.click(categoryElement);

    expect(screen.getAllByText('Akcja').length).toBe(2); // One in grid, one in selected info
    expect(screen.getByText('Pokaż filmy')).toBeInTheDocument();
  });

  it('should call refetch on retry button click', () => {
    const mockRefetch = jest.fn();
    mockUseMovieCategories.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: mockRefetch,
      isRefetching: false,
      error: new Error('Failed to load'),
    } as any);

    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    const retryButton = screen.getByText('Spróbuj ponownie');
    fireEvent.click(retryButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should display favorite count in header', () => {
    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    // The count is shown in the subtitle with the translation
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('should show search query when searching', () => {
    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
        search="Akcja"
      />
    );

    expect(screen.getByText('Wyniki wyszukiwania dla: "Akcja"')).toBeInTheDocument();
  });

  it('should render category icons', () => {
    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    // Check for Lucide icons (List or Film) - these are rendered as SVG elements
    const listIcons = document.querySelectorAll('.lucide-list');
    expect(listIcons.length).toBeGreaterThan(0);
  });

  it('should apply selected styling to clicked category', () => {
    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    const categoryElement = screen.getByText('Akcja');
    fireEvent.click(categoryElement);

    // After clicking, the category should have green styling
    const categoryCard = categoryElement.closest('.cursor-pointer');
    expect(categoryCard).toHaveClass('border-green-700');
  });

  it('should handle show movies button click', () => {
    render(
      <FavoriteMovieCategoriesList 
        client={mockClient} 
        onCategorySelect={mockOnCategorySelect} 
      />
    );

    // First click to select
    fireEvent.click(screen.getByText('Akcja'));

    // Then click the "Pokaż filmy" button
    const showMoviesButton = screen.getByText('Pokaż filmy');
    fireEvent.click(showMoviesButton);

    expect(mockOnCategorySelect).toHaveBeenCalledWith(mockCategories[0]);
  });
});
