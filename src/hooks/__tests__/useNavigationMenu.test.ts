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

    expect(result.current).toHaveLength(4);
    expect(result.current[0].id).toBe('portals');
    expect(result.current[1].id).toBe('m3u');
    expect(result.current[2].id).toBe('for-you');
    expect(result.current[3].id).toBe('settings');
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
    expect(result.current[2].active).toBe(false);
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

    expect(result.current[0].active).toBe(true);
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

    expect(result.current[0].active).toBe(true);
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

    expect(result.current[0].active).toBe(true);
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

    expect(result.current[2].disabled).toBe(true);
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

    result.current[2]?.onClick?.();
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

    result.current[3]?.onClick?.();
    expect(mockSetIsSettingsOpen).toHaveBeenCalledWith(true);
  });

  it('should include portal sub-items under Portal Playlist', () => {
    const { result } = renderHook(() =>
      useNavigationMenu({
        activeView: 'portals',
        activePortal,
        navigate: mockNavigate,
        setIsSettingsOpen: mockSetIsSettingsOpen,
        activeM3uId: null,
      })
    );

    const portals = result.current[0];
    expect(portals.subItems).toBeDefined();
    expect(portals.subItems).toHaveLength(9);
    expect(portals.subItems![0].id).toBe('tv');
    expect(portals.subItems![1].id).toBe('categories');
    expect(portals.subItems![2].id).toBe('favorite-channels');
    expect(portals.subItems![3].id).toBe('movies');
    expect(portals.subItems![4].id).toBe('movie-categories');
    expect(portals.subItems![5].id).toBe('favorite-movies');
    expect(portals.subItems![6].id).toBe('series');
    expect(portals.subItems![7].id).toBe('series-categories');
    expect(portals.subItems![8].id).toBe('favorite-series');
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

    const portals = result.current[0];
    expect(portals.subItems![2].active).toBe(true);
  });
});
