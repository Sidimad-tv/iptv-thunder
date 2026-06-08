// =========================
// 📺 SERIES CATEGORIES LIST COMPONENT
// =========================
import React, { useState, useMemo, useEffect } from 'react';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerGenre } from '@/types';
import { useFavoriteCategories } from '@/hooks/useFavorites';
import { useSeriesCategories } from './series.hooks';
import { useTranslation } from '@/hooks/useTranslation';
import { CategoryCard } from '@/components/ui/CategoryCard';
import { getSetting, isAdultCategory } from '@/hooks/useSettings';

interface SeriesCategoriesListProps {
  client: StalkerClient;
  onCategorySelect: (category: StalkerGenre) => void;
  search?: string;
}

export const SeriesCategoriesList: React.FC<SeriesCategoriesListProps> = ({
  client,
  onCategorySelect,
  search = ''
}) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<StalkerGenre | null>(null);
  const accountId = client?.getAccount?.()?.id || 'default';
  const { isCategoryFavorite, toggleCategory } = useFavoriteCategories(accountId, 'series');

  // Load settings for adult filter
  const [settings, setSettings] = useState<{ hideAdultCategories?: boolean } | null>(null);
  useEffect(() => {
    getSetting('hideAdultCategories').then(v => {
      setSettings({ hideAdultCategories: v });
    });
  }, []);

  // Pobieranie kategorii seriali z cache
  const {
    data: categories = [],
    isLoading,
    error,
    refetch
  } = useSeriesCategories(client);

  // Filter out adult categories if setting is enabled
  const filteredByAdult = useMemo(() => {
    const hideAdult = settings?.hideAdultCategories;
    if (!hideAdult) return categories;
    return categories.filter(cat => !isAdultCategory(cat.title));
  }, [categories, settings?.hideAdultCategories]);

  // Note: "All" category is NOT added for series because there are too many (42000+)
  // Loading all series would be extremely slow
  const finalCategories = useMemo(() =>
    filteredByAdult.filter(category =>
      category.title.toLowerCase().includes(search.toLowerCase())
    ),
  [filteredByAdult, search]);

  // Debug: log categories count (disabled in prod)
  // logger.debug('Categories total:', categories.length, 'filtered:', filteredCategories.length, 'search:', search);

  const handleCategoryClick = (category: StalkerGenre) => {

    setSelectedCategory(category);
    onCategorySelect(category);

  };

  const handleToggleFavorite = (e: React.MouseEvent, categoryId: string, categoryName?: string) => {
    e.stopPropagation();
    e.preventDefault();
    toggleCategory(categoryId, categoryName);
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
            {Array.from({ length: 12 }).map((_, i) => (
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
          <h3 className="text-xl font-semibold mb-2">{t('categoryLoadError')}</h3>
          <p className="dark:text-slate-400 text-slate-600 mb-4">
            {t('errorLoadingChannelCategoriesDesc')}
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

  if (finalCategories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center dark:text-white text-slate-900">
          <div className="text-6xl mb-4">📺</div>
          <h3 className="text-xl font-semibold mb-2">
            {search ? t('noResults') : t('noResults')}
          </h3>
          <p className="dark:text-slate-400 text-slate-600">
            {search
              ? `No series categories matching "${search}"`
              : 'This portal has no series categories defined'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header - Unified Style */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{t('seriesCategories')}</h1>
        </div>
        <p className="text-sm dark:text-slate-400 text-slate-600">
          {t('selectSeriesCategory')} ({finalCategories.length} categories)
        </p>
        {search && (
          <p className="text-green-700 text-sm mt-2">
            Search results for: "{search}"
          </p>
        )}
      </div>

      {/* Series Categories Grid */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 sm:gap-3">
          {finalCategories.map((category, categoryIndex) => (
            <CategoryCard
              key={category.id}
              category={category}
              categoryIndex={categoryIndex}
              selectedCategory={selectedCategory}
              isCategoryFavorite={isCategoryFavorite}
              onSelect={handleCategoryClick}
              onToggleFavorite={handleToggleFavorite}
              onLongPress={handleLongPress}
              groupId="series-categories"
            />
          ))}
        </div>

        {/* Selected Category Info */}
        {selectedCategory && (
          <div className="mt-6 p-4 dark:bg-slate-800 dark:bg-opacity-50 bg-white bg-opacity-50 backdrop-blur-sm rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-700 bg-opacity-20 rounded-lg flex items-center justify-center text-2xl">
                {selectedCategory.id === '*' ? '📺' : '🎭'}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-1">
                  {selectedCategory.title}
                </h3>
                <p className="dark:text-slate-400 text-slate-600">
                  {selectedCategory.id === '*' 
                    ? 'All series selected' 
                    : `Series category #${selectedCategory.id} selected`
                  }
                </p>
              </div>
              <button
                onClick={() => onCategorySelect(selectedCategory)}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <span>📺</span>
                Show Series
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
