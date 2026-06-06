// =========================
// 📂 CHANNEL CATEGORIES LIST COMPONENT
// =========================
import React, { useState, useMemo, useEffect } from 'react';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerGenre } from '@/types';
import { useFavoriteCategories } from '@/hooks/useFavorites';
import { useChannelCategories } from './tv.hooks';
import { useTranslation } from '@/hooks/useTranslation';
import { CategoryCard as UICategoryCard } from '@/components/ui/CategoryCard';
import { getSetting, isAdultCategory } from '@/hooks/useSettings';

interface ChannelCategoriesListProps {
  client: StalkerClient;
  onCategorySelect: (category: StalkerGenre) => void;
  search?: string;
}

export const ChannelCategoriesList: React.FC<ChannelCategoriesListProps> = ({
  client,
  onCategorySelect,
  search = ''
}) => {
  const [selectedCategory, setSelectedCategory] = useState<StalkerGenre | null>(null);
  const accountId = client?.getAccount?.()?.id || 'default';
  const { isCategoryFavorite, toggleCategory } = useFavoriteCategories(accountId, 'live');
  const { t } = useTranslation();

  // Load settings for adult filter
  const [settings, setSettings] = useState<{ hideAdultCategories?: boolean } | null>(null);
  useEffect(() => {
    getSetting('hideAdultCategories').then(v => {
      setSettings({ hideAdultCategories: v });
    });
  }, []);

  // Pobieranie kategorii kanałów
  const {
    data: categories = [],
    isLoading,
    error,
    refetch
  } = useChannelCategories(client);

  // Filter out adult categories if setting is enabled
  const filteredByAdult = useMemo(() => {
    const hideAdult = settings?.hideAdultCategories;
    if (!hideAdult) return categories;
    return categories.filter(cat => !isAdultCategory(cat.title));
  }, [categories, settings?.hideAdultCategories]);

  // Filtrowanie kategorii na podstawie wyszukiwania
  const filteredCategories = useMemo(() =>
    filteredByAdult.filter(category =>
      category.title.toLowerCase().includes(search.toLowerCase())
    ),
  [filteredByAdult, search]);

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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center dark:text-white text-slate-900">
          <div className="animate-spin w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>{t('loadingChannelCategories')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center dark:text-white text-slate-900 max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold mb-2">{t('errorLoadingChannelCategories')}</h3>
          <p className="dark:text-slate-400 text-slate-600 mb-4">
            {t('errorLoadingChannelCategoriesDesc')}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  if (filteredCategories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center dark:text-white text-slate-900">
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-xl font-semibold mb-2">
            {search ? t('noCategoriesFound') : t('noCategoriesAvailable')}
          </h3>
          <p className="dark:text-slate-400 text-slate-600">
            {search 
              ? t('noCategoriesSearchDesc', { search })
              : t('noCategoriesDesc')
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
        <h1 className="text-[calc(1.25rem*var(--ui-scale))] font-bold dark:text-white text-slate-900">{t('channelCategories')}</h1>
        <p className="text-sm dark:text-slate-400 text-slate-600">
          {t('selectChannelCategory')}
        </p>
        {search && (
          <p className="text-green-700 text-sm mt-2">
            {t('searchResultsFor')} "{search}"
          </p>
        )}
      </div>

      {/* Categories Grid */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 sm:gap-3">
          {filteredCategories.map((category, categoryIndex) => (
            <UICategoryCard
              key={category.id}
              category={category}
              categoryIndex={categoryIndex}
              selectedCategory={selectedCategory}
              isCategoryFavorite={isCategoryFavorite}
              onSelect={handleCategoryClick}
              onToggleFavorite={handleToggleFavorite}
              onLongPress={handleLongPress}
              groupId="categories"
            />
          ))}

        </div>
        {selectedCategory && (
          <div className="mt-6 p-4 dark:bg-slate-800 dark:bg-opacity-50 bg-white bg-opacity-50 backdrop-blur-sm rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-700 bg-opacity-20 rounded-lg flex items-center justify-center text-2xl">
                {selectedCategory.id === '*' ? '🌍' : '📺'}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-1">
                  {selectedCategory.title}
                </h3>
                <p className="dark:text-slate-400 text-slate-600">
                  {selectedCategory.id === '*' 
                    ? t('allChannelsSelected') 
                    : t('categoryChannelsSelected', { id: selectedCategory.id })
                  }
                </p>
              </div>
              <button
                onClick={() => onCategorySelect(selectedCategory)}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <span>📺</span>
                {t('showChannels')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
