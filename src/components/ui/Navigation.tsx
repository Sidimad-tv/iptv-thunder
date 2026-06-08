// =========================
// 🧭 NAVIGATION COMPONENT
// =========================
import React, { useState, memo, useRef, useMemo } from 'react';
import { ChevronDown, Power, Lock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { exit } from '@tauri-apps/plugin-process';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';

// Detect Android platform
const isAndroid = () => {
  return typeof window !== 'undefined' && 
         ((window as any).AndroidTV !== undefined || 
          (globalThis as any).navigator?.userAgent?.toLowerCase().includes('android'));
};

export type NavigationItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  subItems?: Array<{
    id: string;
    label: string;
    onClick?: () => void;
    active?: boolean;
  }>;
};

// TV navigation index multiplier - creates spacing between main items for submenu indices
const TV_INDEX_MULTIPLIER = 10;

// Determine if a submenu should be expanded based on state and active sub-items
const shouldExpandSubmenu = (
  itemId: string,
  expandedItem: string | null,
  manuallyInteracted: Set<string>,
  hasSubItems: boolean,
  subItems?: NavigationItem['subItems']
): boolean => {
  if (!hasSubItems || !subItems) return false;
  return expandedItem === itemId || (!expandedItem && !manuallyInteracted.has(itemId) && subItems.some((sub) => sub.active));
};

// Generate button classes based on item state
const getButtonClass = (isActive: boolean, isDisabled: boolean, hasSubItems: boolean): string => {
  if (isActive && !hasSubItems) {
    return 'bg-green-700/90 text-white';
  }
  if (isDisabled) {
    return 'dark:bg-slate-700/20 bg-gray-200/30 dark:text-slate-500 text-slate-500 cursor-not-allowed';
  }
  return 'dark:bg-slate-800/30 bg-gray-100/30 dark:text-slate-300 text-slate-600 dark:hover:bg-slate-700/50 hover:bg-gray-200/50 hover:text-white';
};

interface NavigationProps {
  items: NavigationItem[];
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = memo(({ items, className = '' }) => {
  const { t } = useTranslation();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const manuallyInteracted = useRef<Set<string>>(new Set());

  const toggleSubmenu = (itemId: string) => {
    manuallyInteracted.current.add(itemId);
    setExpandedItem(expandedItem === itemId ? null : itemId);
  };

  // Memoize computed values for each navigation item
  const computedItems = useMemo(() => {
    return items.map((item, index) => {
      const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
      const isExpanded = shouldExpandSubmenu(item.id, expandedItem, manuallyInteracted.current, hasSubItems, item.subItems);
      const baseIndex = index * TV_INDEX_MULTIPLIER;
      const buttonClass = getButtonClass(Boolean(item.active), Boolean(item.disabled), hasSubItems);
      return { item, hasSubItems, isExpanded, baseIndex, buttonClass };
    });
  }, [items, expandedItem]);

  const handleCloseApp = async () => {
    try {
      await exit(0);
    } catch {
      try {
        await invoke('exit_app');
      } catch {
        window.close();
      }
    }
  };

  return (
    <div
      id="navigation"
      data-tv-container="navigation"
      className={`flex flex-col h-full w-44 md:w-52 lg:w-56 xl:w-64 2xl:w-72 dark:bg-slate-900/40 bg-white/40 backdrop-blur-md border-r dark:border-slate-700/30 border-gray-200/30 ${className}`}
    >
      {/* Header */}
      <div className="p-3 md:p-4 lg:p-5 border-b dark:border-slate-700/30 border-gray-200/30">
        <div className="flex items-center justify-center">
          <img src="https://cdn.jsdelivr.net/gh/Sidimadtv/all/sidi/assets/images/logo.png" alt="S!d!m@dtv-STB" className="h-8 md:h-10 lg:h-12 w-auto max-w-full" />
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-2 md:p-3 lg:p-4 gap-2 md:gap-3 space-y-2 md:space-y-3 overflow-y-auto scrollbar-hide">
        {computedItems.map(({ item, hasSubItems, isExpanded, baseIndex, buttonClass }) => {

          return (
            <div key={item.id} className="relative group">
              <motion.button
                data-tv-id={item.id}
                data-tv-focusable
                data-tv-index={baseIndex}
                data-tv-group="navbar"
                data-tv-initial={item.id === items[0]?.id}
                data-tv-active={item.active || undefined}
                tabIndex={0}
                onClick={() => {
                  if (hasSubItems) {
                    toggleSubmenu(item.id);
                  } else if (item.onClick) {
                    item.onClick();
                  }
                }}
                disabled={item.disabled}
                aria-expanded={hasSubItems ? isExpanded : undefined}
                aria-controls={hasSubItems ? `submenu-${item.id}` : undefined}
                className={`w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl flex items-center gap-3 md:gap-4 transition-all duration-200 relative overflow-hidden group ${buttonClass}`}
              >
                {/* Active state gradient overlay */}
                {item.active && !hasSubItems && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: 10, ease: 'linear' }}
                  />
                )}
                
                <span className={`text-lg md:text-xl relative z-10 flex-shrink-0 ${item.active && !hasSubItems ? 'animate-pulse' : ''}`}>
                  {item.icon}
                </span>
                
                <span className="font-medium relative z-10 flex-1 dark:text-white text-slate-900">
                  {item.label}
                </span>
                
                {hasSubItems && (
                  <motion.div
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: isExpanded ? 180 : 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 relative z-10 dark:text-white text-slate-900" />
                  </motion.div>
                )}
                
                {item.disabled && (
                  <Lock className="ml-auto w-4 h-4 dark:text-slate-500 text-slate-500" />
                )}
                
                {/* Active indicator */}
                {item.active && !hasSubItems && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full animate-pulse" />
                )}
              </motion.button>


              {/* Submenu */}
              {isAndroid() ? (
                // No animations on Android to prevent navigation issues
                hasSubItems && isExpanded && item.subItems && (
                  <div
                    data-tv-group={item.id}
                    className="mt-6 ml-5 gap-3 space-y-3 overflow-visible p-2"
                  >
                    {item.subItems.map((subItem, subIndex) => (
                      <button
                        key={subItem.id}
                        data-tv-id={subItem.id}
                        data-tv-focusable
                        data-tv-group={item.id}
                        data-tv-index={baseIndex + subIndex + 1}
                        data-tv-initial={subIndex === 0}
                        tabIndex={0}
                        onClick={subItem.onClick}
                        className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 text-base dark:bg-slate-800/20 bg-gray-100/20 dark:text-slate-300 text-slate-600 dark:hover:bg-slate-700/40 hover:bg-gray-200/40 hover:text-white"
                      >
                        <span className="text-base dark:text-white text-slate-900">▸</span>
                        <span className="dark:text-white text-slate-900">{subItem.label}</span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                // AnimatePresence with animations on desktop
                <AnimatePresence>
                  {hasSubItems && isExpanded && item.subItems && (
                    <motion.div
                      data-tv-group={item.id}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-6 ml-5 gap-3 space-y-3 overflow-visible p-2"
                    >
                      {item.subItems.map((subItem, subIndex) => (
                        <motion.button
                          key={subItem.id}
                          data-tv-id={subItem.id}
                          data-tv-focusable
                          data-tv-group={item.id}
                          data-tv-index={baseIndex + subIndex + 1}
                          data-tv-initial={subIndex === 0}
                          tabIndex={0}
                          onClick={subItem.onClick}
                          whileHover={{ scale: 1.02, x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 text-base dark:bg-slate-800/20 bg-gray-100/20 dark:text-slate-300 text-slate-600 dark:hover:bg-slate-700/40 hover:bg-gray-200/40 hover:text-white"
                        >
                          <span className="text-base dark:text-white text-slate-900">▸</span>
                          <span className="dark:text-white text-slate-900">{subItem.label}</span>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 md:p-3 lg:p-4 gap-2 md:gap-3 lg:gap-4 border-t dark:border-slate-700/30 border-gray-200/30 space-y-2 md:space-y-3 lg:space-y-4">
        {/* Close App Button - subtle style */}
        <motion.button
          data-tv-id="close-app"
          data-tv-focusable
          data-tv-index={60}
          tabIndex={0}
          onClick={handleCloseApp}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl flex items-center justify-center gap-2 md:gap-3 transition-all duration-200 dark:bg-slate-800/30 bg-gray-100/30 dark:text-slate-400 text-slate-600 dark:hover:bg-red-500/10 hover:bg-red-500/10 dark:hover:text-red-400 hover:text-red-400"
        >
          <Power className="w-4 md:w-5 h-4 md:h-5" />
          <span className="text-sm md:text-base font-medium dark:text-white text-slate-900">{t('exit')}</span>
        </motion.button>

      </div>
    </div>
  );
});
