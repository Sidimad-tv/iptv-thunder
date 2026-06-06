// =========================
// ⭐ FAVORITE CATEGORIES LIST COMPONENT
// =========================
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerGenre } from '@/types';
import { useFavoriteCategories } from '@/hooks/useFavorites';
import { getGenres } from './tv.api';
import { useTranslation } from '@/hooks/useTranslation';
import { CategoryCard as UICategoryCard } from '@/components/ui/CategoryCard';
import { getSetting, isAdultCategory } from '@/hooks/useSettings';

interface FavoriteCategoriesListProps {
  client: StalkerClient;
  onCategorySelect: (category: StalkerGenre) => void;
  search?: string;
}

export const FavoriteCategoriesList: React.FC<FavoriteCategoriesListProps> = ({
  client,
  onCategorySelect,
  search = '',
}) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<StalkerGenre | null>(null);
  const accountId = client?.getAccount?.()?.id || 'default';
  const { categoryIds: favoriteCategories, toggleCategory } = useFavoriteCategories(accountId, 'live');

  // Load settings for adult filter
  const [settings, setSettings] = useState<{ hideAdultCategories?: boolean } | null>(null);
  useEffect(() => {
    getSetting('hideAdultCategories').then(v => {
      setSettings({ hideAdultCategories: v });
    });
  }, []);

  // Pobieranie wszystkich kategorii kanałów z cache
  const {
    data: categories = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['channel-genres', client.getAccount().id],
    queryFn: () => getGenres(client),
    staleTime: 30 * 60 * 1000, // 30 minutes cache
    retry: 2,
  });

  // Filter out adult categories if setting is enabled
  const filteredByAdult = useMemo(() => {
    const hideAdult = settings?.hideAdultCategories;
    if (!hideAdult) return categories;
    return categories.filter(cat => !isAdultCategory(cat.title));
  }, [categories, settings?.hideAdultCategories]);

  const favoriteCategoriesList = useMemo(() =>
    filteredByAdult.filter(category => favoriteCategories.includes(String(category.id))),
  [filteredByAdult, favoriteCategories]);

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
    const groupId = activeElement?.dataset.tvGroup || 'favorite-categories';
    
    const category = categories.find(c => String(c.id) === categoryId);
    toggleCategory(categoryId, category?.title);
    
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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center dark:text-white text-slate-900">
          <div className="animate-spin w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>{t('loadingFavoriteCategories')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center dark:text-white text-slate-900 max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold mb-2">{t('categoryLoadError')}</h3>
          <p className="dark:text-slate-400 text-slate-600 mb-4">
            {t('categoryLoadErrorDesc')}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors"
          >
            {t('tryAgain')}
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
          <h3 className="text-xl font-semibold mb-2">{t('noFavoriteCategories')}</h3>
          <p className="dark:text-slate-400 text-slate-600 mb-4">
            {t('addFavoriteCategoriesHint')}
          </p>
          <div className="mt-6 p-4 dark:bg-slate-800 dark:bg-opacity-50 bg-white bg-opacity-50 rounded-lg">
            <p className="text-sm dark:text-slate-400 text-slate-600">
              {t('categoryTip')}
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
            Nie znaleziono ulubionych kategorii pasujących do "{search}"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header - Unified Style */}
      <div className="p-4">
        <h1 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{t('favoriteChannelCategories')}</h1>
        <p className="text-sm dark:text-slate-400 text-slate-600">
          {t('yourFavoriteChannelCategories')} ({favoriteCategories.length})
        </p>
        {search && (
          <p className="text-green-700 text-sm mt-2">
            {t('searchResultsFor')} "{search}"
          </p>
        )}
      </div>

      {/* Favorite Categories Grid */}
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
              groupId="favorite-categories"
            />
          ))}
        </div>

        {/* Selected Category Info */}
        {selectedCategory && (
          <div className="mt-8 p-6 dark:bg-slate-800 dark:bg-opacity-50 bg-white bg-opacity-50 backdrop-blur-sm rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-green-700 bg-opacity-20 rounded-xl flex items-center justify-center text-3xl">
                {selectedCategory.id === '*' ? '🌍' : '📺'}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-1">
                  {selectedCategory.title}
                </h3>
                <p className="dark:text-slate-400 text-slate-600">
                  {selectedCategory.id === '*' 
                    ? 'Wybrano wszystkie kanały' 
                    : `Wybrano kategorię kanałów #${selectedCategory.id}`
                  }
                </p>
              </div>
              <button
                onClick={() => onCategorySelect(selectedCategory)}
                className="px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <span>📺</span>
                Pokaż kanały
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
