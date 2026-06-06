// =========================
// ⭐ FAVORITE MOVIE CATEGORIES LIST COMPONENT
// =========================
import React, { useState, useMemo, useEffect } from 'react';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerGenre } from '@/types';
import { useFavoriteCategories } from '@/hooks/useFavorites';
import { useMovieCategories } from './movies.hooks';
import { useTranslation } from '@/hooks/useTranslation';
import { CategoryCard as UICategoryCard } from '@/components/ui/CategoryCard';
import { getSetting, isAdultCategory } from '@/hooks/useSettings';

interface FavoriteMovieCategoriesListProps {
  client: StalkerClient;
  onCategorySelect: (category: StalkerGenre) => void;
  search?: string;
}

export const FavoriteMovieCategoriesList: React.FC<FavoriteMovieCategoriesListProps> = ({
  client,
  onCategorySelect,
  search = '',
}) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<StalkerGenre | null>(null);
  const accountId = client?.getAccount?.()?.id || 'default';
  const { categoryIds: favoriteCategories, toggleCategory } = useFavoriteCategories(accountId, 'vod');

  // Load settings for adult filter
  const [settings, setSettings] = useState<{ hideAdultCategories?: boolean } | null>(null);
  useEffect(() => {
    getSetting('hideAdultCategories').then(v => {
      setSettings({ hideAdultCategories: v });
    });
  }, []);

  // Pobieranie wszystkich kategorii filmów z cache
  const { 
    data: categories = [], 
    isLoading, 
    error, 
    refetch 
  } = useMovieCategories(client);

  // Filter out adult categories if setting is enabled
  const filteredByAdult = useMemo(() => {
    const hideAdult = settings?.hideAdultCategories;
    if (!hideAdult) return categories;
    return categories.filter(cat => !isAdultCategory(cat.title));
  }, [categories, settings?.hideAdultCategories]);

  // Filtrowanie tylko ulubionych kategorii filmów
  const favoriteCategoriesList = useMemo(() =>
    filteredByAdult.filter(category => favoriteCategories.includes(String(category.id))),
  [filteredByAdult, favoriteCategories]);

  // Dodatkowe filtrowanie na podstawie wyszukiwania
  const filteredCategories = useMemo(() =>
    favoriteCategoriesList.filter(category =>
      category.title.toLowerCase().includes(search.toLowerCase())
    ),
  [favoriteCategoriesList, search]);

  const handleCategoryClick = (category: StalkerGenre) => {
    setSelectedCategory(category);
    onCategorySelect(category);
  };

  const handleToggleFavorite = (e: React.MouseEvent, categoryId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Save current focused element and its index for focus restoration
    const activeElement = document.activeElement as HTMLElement;
    const currentIndex = activeElement?.dataset.tvIndex ? Number.parseInt(activeElement.dataset.tvIndex) : -1;
    const groupId = activeElement?.dataset.tvGroup || 'favorite-movie-categories';
    
    toggleCategory(categoryId);
    
    // Restore focus to next available item after removal
    setTimeout(() => {
      const focusableElements = document.querySelectorAll(`[data-tv-group="${groupId}"][data-tv-focusable]`);
      const newIndex = currentIndex >= focusableElements.length ? Math.max(0, focusableElements.length - 1) : currentIndex;
      const nextElement = focusableElements[newIndex] as HTMLElement;
      if (nextElement) {
        nextElement.focus({ preventScroll: true });
      }
    }, 100);
  };

  const handleLongPress = (category: StalkerGenre) => {
    const categoryId = String(category.id);
    toggleCategory(categoryId, category.title);
    // Haptic feedback if supported
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Skeleton Header */}
        <div className="p-4">
          <div className="h-6 w-48 dark:bg-slate-700 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-64 dark:bg-slate-700 bg-gray-200 rounded animate-pulse"></div>
        </div>
        {/* Skeleton Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="dark:bg-slate-800 bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 dark:bg-slate-700 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="w-6 h-6 dark:bg-slate-700 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
                <div className="h-5 dark:bg-slate-700 bg-gray-200 rounded animate-pulse mb-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center dark:text-white text-slate-900 max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold mb-2">Błąd ładowania kategorii</h3>
          <p className="dark:text-slate-400 text-slate-600 mb-4">
            Nie udało się pobrać ulubionych kategorii filmów. Spróbuj ponownie.
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  if (favoriteCategories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center dark:text-white text-slate-900">
          <div className="text-6xl mb-4">⭐</div>
          <h3 className="text-xl font-semibold mb-2">{t('noFavoriteMovieCategories')}</h3>
          <p className="dark:text-slate-400 text-slate-600 mb-4">
            {t('addFavoriteMovieCategoriesHint')}
          </p>
          <div className="mt-6 p-4 dark:bg-slate-800 dark:bg-opacity-50 bg-white bg-opacity-50 rounded-lg">
            <p className="text-sm dark:text-slate-400 text-slate-600">
              {t('movieCategoryTip')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (filteredCategories.length === 0 && search) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center dark:text-white text-slate-900">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold mb-2">Nie znaleziono kategorii</h3>
          <p className="dark:text-slate-400 text-slate-600">
            Nie znaleziono ulubionych kategorii filmów pasujących do "{search}"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header - Unified Style */}
      <div className="p-4">
        <h1 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{t('favoriteMovieCategories')}</h1>
        <p className="text-sm dark:text-slate-400 text-slate-600">
          {t('yourFavoriteMovieCategories')} ({favoriteCategories.length})
        </p>
        {search && (
          <p className="text-green-700 text-sm mt-2">
            Wyniki wyszukiwania dla: "{search}"
          </p>
        )}
      </div>

      {/* Favorite Movie Categories Grid */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 sm:gap-3 w-full">
          {filteredCategories.map((category, categoryIndex) => (
            <UICategoryCard
              key={category.id}
              category={category}
              categoryIndex={categoryIndex}
              selectedCategory={selectedCategory}
              isCategoryFavorite={() => true}
              onSelect={handleCategoryClick}
              onToggleFavorite={handleToggleFavorite}
              onLongPress={handleLongPress}
              groupId="favorite-movie-categories"
            />
          ))}
        </div>

        {/* Selected Category Info */}
        {selectedCategory && (
          <div className="mt-6 p-4 dark:bg-slate-800 dark:bg-opacity-50 bg-white bg-opacity-50 backdrop-blur-sm rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-700 bg-opacity-20 rounded-lg flex items-center justify-center text-2xl">
                {selectedCategory.id === '*' ? '🎬' : '🎭'}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-1">
                  {selectedCategory.title}
                </h3>
              </div>
              <button
                onClick={() => onCategorySelect(selectedCategory)}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <span>🎬</span> Pokaż filmy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
