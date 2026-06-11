import { useState, useRef, useCallback, useEffect } from 'react';
import { StalkerGenre, StalkerVOD } from '@/types';

// =========================
// 🎯 TYPED ROUTER - Discriminated Union Pattern
// =========================

// Base routes without parameters
type SimpleRoute =
  | { type: 'portals' }
  | { type: 'for-you' }
  | { type: 'tv' }
  | { type: 'movies' }
  | { type: 'series' }
  | { type: 'categories' }
  | { type: 'favorite-categories' }
  | { type: 'favorite-channels' }
  | { type: 'movie-categories' }
  | { type: 'favorite-movie-categories' }
  | { type: 'favorite-movies' }
  | { type: 'series-categories' }
  | { type: 'favorite-series-categories' }
  | { type: 'favorite-series' }
  | { type: 'scb1' }
  | { type: 'scb2' }
  | { type: 'scb3' }
  | { type: 'imdb' }
  | { type: 'm3u' }
  | { type: 'm3u-channels' }
  | { type: 'm3u-movies' }
  | { type: 'm3u-series' }
  | { type: 'm3u-favorites' }
  | { type: 'm3u-categories' };

// Routes with parameters
type ParamRoute =
  | { type: 'movie-details'; movie: StalkerVOD }
  | { type: 'series-details'; series: StalkerVOD };

// All routes combined
export type Route = SimpleRoute | ParamRoute;

// Type guards
export const isMovieDetails = (route: Route): route is { type: 'movie-details'; movie: StalkerVOD } =>
  route.type === 'movie-details';

export const isSeriesDetails = (route: Route): route is { type: 'series-details'; series: StalkerVOD } =>
  route.type === 'series-details';

// Get simple route type string (for comparisons)
export const getRouteType = (route: Route): string => route.type;

// Check if route matches a specific type
export const isRouteType = (route: Route, type: Route['type']): boolean => route.type === type;

// =========================
// 🎮 ROUTER HOOK
// =========================

export const useTypedRouter = () => {
  const [route, setRoute] = useState<Route>({ type: 'portals' });
  const [selectedCategory, setSelectedCategory] = useState<StalkerGenre | null>(null);

  // Track previous route for back navigation
  const previousRouteRef = useRef<Route>({ type: 'movies' });

  // Navigate to a simple route
  const navigate = useCallback((newRoute: SimpleRoute) => {
    setRoute(currentRoute => {
      previousRouteRef.current = currentRoute;
      return newRoute;
    });
  }, []);

  // Navigate to movie details (with data)
  const navigateToMovie = useCallback((movie: StalkerVOD) => {
    previousRouteRef.current = route;
    setRoute({ type: 'movie-details', movie });
  }, [route]);

  // Navigate to series details (with data)
  const navigateToSeries = useCallback((series: StalkerVOD) => {
    previousRouteRef.current = route;
    setRoute({ type: 'series-details', series });
  }, [route]);

  // Go back from details view
  const goBack = useCallback(() => {
    const targetRoute = previousRouteRef.current;
    // Clear selected category when going back to category views
    if (targetRoute.type === 'movie-categories' ||
        targetRoute.type === 'favorite-movie-categories' ||
        targetRoute.type === 'series-categories' ||
        targetRoute.type === 'favorite-series-categories' ||
        targetRoute.type === 'categories' ||
        targetRoute.type === 'favorite-categories') {
      setSelectedCategory(null);
    }
    setRoute(targetRoute);
  }, [route]);

  // Focus management - save/restore focus on route changes
  const lastFocusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const currentRouteType = route.type;
    const previousRouteType = previousRouteRef.current.type;

    if (previousRouteType && currentRouteType !== previousRouteType) {
      // Save focus for previous route
      const focusedElement = document.activeElement as HTMLElement;
      const focusedGroup = focusedElement?.dataset.tvGroup;

      // Don't save navbar element as focus for main content routes
      const isPreviousNavbarRoute = previousRouteType === 'portals' || previousRouteType === 'for-you' ||
                                    previousRouteType === 'tv' || previousRouteType === 'movies' ||
                                    previousRouteType === 'series' || previousRouteType === 'm3u' ||
                                    previousRouteType === 'm3u-channels' || previousRouteType === 'm3u-movies' ||
                                    previousRouteType === 'm3u-series' || previousRouteType === 'm3u-favorites' ||
                                    previousRouteType === 'm3u-categories';
      const isNavbarElement = focusedGroup === 'navbar';

      // Only save focus if:
      // 1. Previous route is NOT a navbar route, OR
      // 2. The focused element is NOT a navbar element
      // 3. Current route is NOT a navbar route (don't save navbar focus when going to main content)
      const isCurrentNavbarRoute = currentRouteType === 'portals' || currentRouteType === 'for-you' ||
                                   currentRouteType === 'tv' || currentRouteType === 'movies' ||
                                   currentRouteType === 'series' || currentRouteType === 'm3u' ||
                                   currentRouteType === 'm3u-channels' || currentRouteType === 'm3u-movies' ||
                                   currentRouteType === 'm3u-series' || currentRouteType === 'm3u-favorites' ||
                                   currentRouteType === 'm3u-categories';

      if ((!isPreviousNavbarRoute || !isNavbarElement) && !isCurrentNavbarRoute && focusedElement?.dataset.tvFocusable) {
        lastFocusRef.current[previousRouteType] = focusedElement.id || focusedElement.dataset.tvId || '';
      }

      // Restore focus for current route
      const savedFocusId = lastFocusRef.current[currentRouteType];
      const isNavbarRoute = currentRouteType === 'portals' || currentRouteType === 'for-you' ||
                           currentRouteType === 'tv' || currentRouteType === 'movies' ||
                           currentRouteType === 'series' || currentRouteType === 'm3u' ||
                           currentRouteType === 'm3u-channels' || currentRouteType === 'm3u-movies' ||
                           currentRouteType === 'm3u-series' || currentRouteType === 'm3u-favorites' ||
                           currentRouteType === 'm3u-categories';

      if (savedFocusId) {
        setTimeout(() => {
          const savedElement = document.getElementById(savedFocusId) || document.querySelector(`[data-tv-id="${savedFocusId}"]`);
          const isSubmenuItem = savedElement?.dataset?.tvGroup &&
                               savedElement.dataset.tvGroup !== 'navbar' &&
                               savedElement.dataset.tvGroup !== 'portals-content';
          const isSavedNavbarElement = savedElement?.dataset?.tvGroup === 'navbar';

          if (isNavbarRoute && isSubmenuItem) {
            const navbarElement = document.querySelector(`[data-tv-id="${currentRouteType}"]`) as HTMLElement;
            if (navbarElement) {
              navbarElement.focus();
            }
            return;
          }

          if (!isNavbarRoute && (isSavedNavbarElement || isSubmenuItem)) {
            return;
          }

          if (savedElement && 'focus' in savedElement) {
            savedElement.focus();
          }
        }, 50);
      } else if (isNavbarRoute) {
        setTimeout(() => {
          // Don't focus if user already has focus in sidebar
          const activeElement = document.activeElement as HTMLElement;
          const isInSidebar = activeElement?.closest('[data-tv-container="navigation"]') !== null;
          if (isInSidebar) {
            return;
          }
          const navbarElement = document.querySelector(`[data-tv-id="${currentRouteType}"]`) as HTMLElement;
          if (navbarElement) {
            navbarElement.focus();
          }
        }, 50);
      }
    }
  }, [route]);

  // Handle category selection with context-aware navigation
  const navigateToCategory = useCallback((category: StalkerGenre) => {
    setSelectedCategory(category);

    setRoute(currentRoute => {
      previousRouteRef.current = currentRoute;
      switch (currentRoute.type) {
        case 'movie-categories':
        case 'favorite-movie-categories':
          previousRouteRef.current = currentRoute;
          return { type: 'movies' };
        case 'series-categories':
        case 'favorite-series-categories':
          previousRouteRef.current = currentRoute;
          return { type: 'series' };
        case 'categories':
        case 'favorite-categories':
          previousRouteRef.current = currentRoute;
          return { type: 'tv' };
        case 'movies':
        case 'series':
        case 'tv':
        case 'portals':
        case 'for-you':
        case 'favorite-channels':
        case 'favorite-movies':
        case 'favorite-series':
        case 'movie-details':
        case 'series-details':
        case 'scb1':
        case 'scb2':
        case 'scb3':
        case 'imdb':
        case 'm3u':
        case 'm3u-channels':
        case 'm3u-movies':
        case 'm3u-series':
        case 'm3u-favorites':
        case 'm3u-categories':
          // Already in the correct content view or not applicable
          return currentRoute;
      }
    });
  }, []);

  // Derived values for backwards compatibility
  const selectedMovie = isMovieDetails(route) ? route.movie : null;
  const selectedSeries = isSeriesDetails(route) ? route.series : null;

  return {
    // Core routing
    route,
    setRoute,
    navigate,

    // Typed navigation helpers
    navigateToMovie,
    navigateToSeries,
    navigateToCategory,
    goBack,

    // Data
    selectedCategory,
    setSelectedCategory,
    selectedMovie,
    selectedSeries,

    // For components still using string-based checks
    activeView: route.type,
  };
};

// Type export for external usage
export type { SimpleRoute, ParamRoute };
