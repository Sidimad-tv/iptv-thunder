import { renderHook } from '@testing-library/react';
import { useNavigationMenu } from '../useNavigationMenu';

// Mock useTranslation
jest.mock('@/hooks', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('useNavigationMenu', () => {
  const mockNavigate = jest.fn();
  const mockSetIsSettingsOpen = jest.fn();
  const activePortal = { id: 'test-portal' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return navigation menu items', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current).toHaveLength(6);
    expect(result.current[0].id).toBe('portals');
    expect(result.current[1].id).toBe('for-you');
    expect(result.current[2].id).toBe('tv');
    expect(result.current[3].id).toBe('movies');
    expect(result.current[4].id).toBe('series');
    expect(result.current[5].id).toBe('settings');
  });

  it('should set active state correctly for portals view', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current[0].active).toBe(true);
    expect(result.current[1].active).toBe(false);
  });

  it('should set active state correctly for tv views', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'categories',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current[2].active).toBe(true);
  });

  it('should set active state correctly for movie views', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'movie-details',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current[3].active).toBe(true);
  });

  it('should set active state correctly for series views', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'series-details',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current[4].active).toBe(true);
  });

  it('should disable items when no active portal', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal: null,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current[1].disabled).toBe(true);
    expect(result.current[2].disabled).toBe(true);
    expect(result.current[3].disabled).toBe(true);
    expect(result.current[4].disabled).toBe(true);
  });

  it('should not disable items when active portal exists', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current[1].disabled).toBe(false);
    expect(result.current[2].disabled).toBe(false);
  });

  it('should call navigate when portals item is clicked', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    result.current[0]?.onClick?.();
    expect(mockNavigate).toHaveBeenCalledWith({ type: 'portals' });
  });

  it('should call navigate when for-you item is clicked', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    result.current[1]?.onClick?.();
    expect(mockNavigate).toHaveBeenCalledWith({ type: 'for-you' });
  });

  it('should call setIsSettingsOpen when settings item is clicked', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    result.current[5]?.onClick?.();
    expect(mockSetIsSettingsOpen).toHaveBeenCalledWith(true);
  });

  it('should include sub-items for tv category', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current[2].subItems).toHaveLength(3);
    expect(result.current[2].subItems?.[0].id).toBe('categories');
    expect(result.current[2].subItems?.[1].id).toBe('favorite-categories');
    expect(result.current[2].subItems?.[2].id).toBe('favorite-channels');
  });

  it('should include sub-items for movies category', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current[3].subItems).toHaveLength(3);
    expect(result.current[3].subItems?.[0].id).toBe('movie-categories');
    expect(result.current[3].subItems?.[1].id).toBe('favorite-movie-categories');
    expect(result.current[3].subItems?.[2].id).toBe('favorite-movies');
  });

  it('should include sub-items for series category', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current[4].subItems).toHaveLength(3);
    expect(result.current[4].subItems?.[0].id).toBe('series-categories');
    expect(result.current[4].subItems?.[1].id).toBe('favorite-series-categories');
    expect(result.current[4].subItems?.[2].id).toBe('favorite-series');
  });

  it('should set active state for sub-items correctly', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'favorite-channels',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    expect(result.current[2].subItems?.[2].active).toBe(true);
  });
});
