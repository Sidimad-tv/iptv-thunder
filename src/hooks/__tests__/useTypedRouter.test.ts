import {
  isMovieDetails,
  isSeriesDetails,
  getRouteType,
  isRouteType,
  useTypedRouter,
  type Route,
} from '../useTypedRouter';
import { renderHook, act } from '@testing-library/react';

describe('useTypedRouter utilities', () => {
  describe('isMovieDetails', () => {
    it('should return true for movie-details route', () => {
      const route: Route = { type: 'movie-details', movie: { id: 1, name: 'Movie' } as any };
      expect(isMovieDetails(route)).toBe(true);
    });

    it('should return false for other routes', () => {
      const route: Route = { type: 'movies' };
      expect(isMovieDetails(route)).toBe(false);
    });

    it('should return false for series-details route', () => {
      const route: Route = { type: 'series-details', series: { id: 1, name: 'Series' } as any };
      expect(isMovieDetails(route)).toBe(false);
    });
  });

  describe('isSeriesDetails', () => {
    it('should return true for series-details route', () => {
      const route: Route = { type: 'series-details', series: { id: 1, name: 'Series' } as any };
      expect(isSeriesDetails(route)).toBe(true);
    });

    it('should return false for other routes', () => {
      const route: Route = { type: 'series' };
      expect(isSeriesDetails(route)).toBe(false);
    });

    it('should return false for movie-details route', () => {
      const route: Route = { type: 'movie-details', movie: { id: 1, name: 'Movie' } as any };
      expect(isSeriesDetails(route)).toBe(false);
    });
  });

  describe('getRouteType', () => {
    it('should return the route type string', () => {
      const route: Route = { type: 'movies' };
      expect(getRouteType(route)).toBe('movies');
    });

    it('should return movie-details for movie details route', () => {
      const route: Route = { type: 'movie-details', movie: { id: 1, name: 'Movie' } as any };
      expect(getRouteType(route)).toBe('movie-details');
    });

    it('should return series-details for series details route', () => {
      const route: Route = { type: 'series-details', series: { id: 1, name: 'Series' } as any };
      expect(getRouteType(route)).toBe('series-details');
    });
  });

  describe('isRouteType', () => {
    it('should return true when route type matches', () => {
      const route: Route = { type: 'movies' };
      expect(isRouteType(route, 'movies')).toBe(true);
    });

    it('should return false when route type does not match', () => {
      const route: Route = { type: 'movies' };
      expect(isRouteType(route, 'series')).toBe(false);
    });

    it('should work with param routes', () => {
      const route: Route = { type: 'movie-details', movie: { id: 1, name: 'Movie' } as any };
      expect(isRouteType(route, 'movie-details')).toBe(true);
    });
  });
});

describe('useTypedRouter hook', () => {
  it('should return router state and functions', () => {
    const { result } = renderHook(() => useTypedRouter());

    expect(result.current).toHaveProperty('route');
    expect(result.current).toHaveProperty('setRoute');
    expect(result.current).toHaveProperty('navigate');
    expect(result.current).toHaveProperty('navigateToMovie');
    expect(result.current).toHaveProperty('navigateToSeries');
    expect(result.current).toHaveProperty('navigateToCategory');
    expect(result.current).toHaveProperty('goBack');
    expect(result.current).toHaveProperty('selectedCategory');
    expect(result.current).toHaveProperty('setSelectedCategory');
    expect(result.current).toHaveProperty('selectedMovie');
    expect(result.current).toHaveProperty('selectedSeries');
    expect(result.current).toHaveProperty('activeView');
  });

  it('should start with portals route', () => {
    const { result } = renderHook(() => useTypedRouter());
    expect(result.current.route).toEqual({ type: 'portals' });
    expect(result.current.activeView).toBe('portals');
  });

  it('should navigate to simple route', () => {
    const { result } = renderHook(() => useTypedRouter());

    act(() => {
      result.current.navigate({ type: 'movies' });
    });

    expect(result.current.route).toEqual({ type: 'movies' });
    expect(result.current.activeView).toBe('movies');
  });

  it('should navigate to movie details', () => {
    const { result } = renderHook(() => useTypedRouter());
    const movie = { id: 1, name: 'Test Movie' } as any;

    act(() => {
      result.current.navigateToMovie(movie);
    });

    expect(result.current.route).toEqual({ type: 'movie-details', movie });
    expect(result.current.selectedMovie).toEqual(movie);
  });

  it('should navigate to series details', () => {
    const { result } = renderHook(() => useTypedRouter());
    const series = { id: 1, name: 'Test Series' } as any;

    act(() => {
      result.current.navigateToSeries(series);
    });

    expect(result.current.route).toEqual({ type: 'series-details', series });
    expect(result.current.selectedSeries).toEqual(series);
  });

  it('should go back to previous route', () => {
    const { result } = renderHook(() => useTypedRouter());

    act(() => {
      result.current.navigate({ type: 'movies' });
    });

    act(() => {
      result.current.navigate({ type: 'tv' });
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.route).toEqual({ type: 'movies' });
  });

  it('should clear selected category when going back from content to category view', () => {
    const { result } = renderHook(() => useTypedRouter());
    const category = { id: '1', title: 'Test' } as any;

    act(() => {
      result.current.setSelectedCategory(category);
      result.current.navigate({ type: 'movie-categories' });
    });

    act(() => {
      result.current.navigate({ type: 'movies' });
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.route).toEqual({ type: 'movie-categories' });
    expect(result.current.selectedCategory).toBeNull();
  });

  it('should navigate to category', () => {
    const { result } = renderHook(() => useTypedRouter());
    const category = { id: '1', title: 'Test' } as any;

    act(() => {
      result.current.navigate({ type: 'movie-categories' });
    });

    act(() => {
      result.current.navigateToCategory(category);
    });

    expect(result.current.route).toEqual({ type: 'movies' });
    expect(result.current.selectedCategory).toEqual(category);
  });

  it('should navigate to tv when in categories view', () => {
    const { result } = renderHook(() => useTypedRouter());
    const category = { id: '1', title: 'Test' } as any;

    act(() => {
      result.current.navigate({ type: 'categories' });
    });

    act(() => {
      result.current.navigateToCategory(category);
    });

    expect(result.current.route).toEqual({ type: 'tv' });
  });

  it('should set selected category', () => {
    const { result } = renderHook(() => useTypedRouter());
    const category = { id: '1', title: 'Test' } as any;

    act(() => {
      result.current.setSelectedCategory(category);
    });

    expect(result.current.selectedCategory).toEqual(category);
  });
});
