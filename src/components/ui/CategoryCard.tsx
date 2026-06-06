import React from 'react';
import { StalkerGenre } from '@/types';
import { useLongPress } from '@/hooks/useLongPress';
import { useTranslation } from '@/hooks/useTranslation';
import { Film, List, Heart, Check } from 'lucide-react';

interface CategoryCardProps {
  category: StalkerGenre;
  categoryIndex: number;
  selectedCategory: StalkerGenre | null;
  isCategoryFavorite?: (id: string) => boolean;
  onSelect: (category: StalkerGenre) => void;
  onToggleFavorite?: (e: React.MouseEvent, categoryId: string, categoryName?: string) => void;
  onLongPress: (category: StalkerGenre) => void;
  groupId?: string;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  categoryIndex,
  selectedCategory,
  isCategoryFavorite,
  onSelect,
  onToggleFavorite,
  onLongPress,
  groupId = 'category-cards',
}) => {
  const { isLongPress, ref, isLongPressRef, ...longPressHandlers } = useLongPress({
    onLongPress: () => onLongPress(category),
    delay: 500,
  });

  const { t } = useTranslation();
  const isFavorite = isCategoryFavorite?.(String(category.id));
  const rawName = category.name || category.title || '';
  const categoryName = category.id === '*' ? t('all') : rawName;
  const categoryId = String(category.id);

  const handleClick = (e: React.MouseEvent) => {
    // Use the hook's isLongPress state instead of global variable
    if (isLongPress) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onSelect(category);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(category);
    }
  };

  return (
    <div
      ref={ref}
      data-tv-focusable
      data-tv-id={`category-${category.id}`}
      data-tv-group={groupId}
      data-tv-index={categoryIndex}
      data-tv-initial={categoryIndex === 0}
      {...longPressHandlers}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress(category);
      }}
      role="button"
      tabIndex={0}
      className={`
        relative dark:bg-slate-800 dark:bg-opacity-50 bg-white bg-opacity-50 backdrop-blur-sm dark:border border-slate-600 border-gray-300 rounded-lg p-2 sm:p-3 md:p-4 h-full min-h-[80px] sm:min-h-[100px] md:min-h-[120px]
        cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl
        ${selectedCategory?.id === category.id
          ? 'border-green-700 bg-green-700 bg-opacity-10 shadow-lg shadow-green-700/25'
          : 'dark:border-slate-600 border-gray-300 hover:border-green-700'
        }
      `}
    >
      {/* Category Icon/Number */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className={`
          w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-xl font-bold
          ${selectedCategory?.id === category.id
            ? 'bg-green-700 text-white'
            : 'dark:bg-slate-700 bg-gray-200 dark:text-slate-300 text-slate-600'
          }
        `}>
          {category.id === '*' ? <Film className="w-4 h-4 sm:w-5 sm:h-5" /> : <List className="w-4 h-4 sm:w-5 sm:h-5" />}
        </div>
        <div className="flex items-center gap-2">
          {selectedCategory?.id === category.id && (
            <div className="w-2 h-2 bg-green-700 rounded-full animate-pulse"></div>
          )}
          {/* Favorite Button */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(e, categoryId, categoryName);
              }}
              className="hover:scale-110 transition-transform cursor-pointer bg-transparent border-0 p-0"
              title={isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
              aria-label={isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
              aria-pressed={isFavorite}
            >
              <Heart className={isFavorite ? 'fill-red-500 text-red-500 w-5 h-5' : 'w-5 h-5'} />
            </button>
          )}
        </div>
      </div>

      {/* Category Name */}
      <h3 className={`
        font-semibold text-sm sm:text-base mb-1 line-clamp-2
        ${selectedCategory?.id === category.id ? 'text-green-700' : 'dark:text-white text-slate-900'}
      `}>
        {categoryName}
      </h3>

      {/* Selection Indicator */}
      {selectedCategory?.id === category.id && (
        <div className="absolute top-2 right-2">
          <div className="w-6 h-6 bg-green-700 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* Hover Effect Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-700 to-transparent opacity-0 hover:opacity-5 transition-opacity duration-200 rounded-xl pointer-events-none" />
    </div>
  );
};
