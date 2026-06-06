import { renderHook, act } from '@testing-library/react';
import { useWindowControls } from '../useWindowControls';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

// Mock Tauri APIs
jest.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: jest.fn(),
}));

jest.mock('@tauri-apps/api/event', () => ({
  listen: jest.fn(),
}));

describe('useWindowControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return window controls', () => {
    const { result } = renderHook(() => useWindowControls());

    expect(result.current).toHaveProperty('isMaximized');
    expect(result.current).toHaveProperty('handleMaximize');
    expect(result.current).toHaveProperty('handleMinimize');
    expect(result.current).toHaveProperty('handleClose');
  });

  it('should initialize with isMaximized as false', async () => {
    const mockWindow = {
      isMaximized: jest.fn().mockResolvedValue(false),
    };
    (getCurrentWindow as jest.Mock).mockReturnValue(mockWindow);

    const { result } = renderHook(() => useWindowControls());

    // Wait for useEffect to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isMaximized).toBe(false);
  });

  it('should initialize with isMaximized as true', async () => {
    const mockWindow = {
      isMaximized: jest.fn().mockResolvedValue(true),
    };
    (getCurrentWindow as jest.Mock).mockReturnValue(mockWindow);

    const { result } = renderHook(() => useWindowControls());

    // Wait for useEffect to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isMaximized).toBe(true);
  });

  it('should handle maximize when not maximized', async () => {
    const mockWindow = {
      isMaximized: jest.fn().mockResolvedValue(false),
      maximize: jest.fn().mockResolvedValue(undefined),
    };
    (getCurrentWindow as jest.Mock).mockReturnValue(mockWindow);

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await result.current.handleMaximize();
    });

    expect(mockWindow.maximize).toHaveBeenCalled();
  });

  it('should handle unmaximize when maximized', async () => {
    const mockWindow = {
      isMaximized: jest.fn().mockResolvedValue(true),
      unmaximize: jest.fn().mockResolvedValue(undefined),
    };
    (getCurrentWindow as jest.Mock).mockReturnValue(mockWindow);

    const { result } = renderHook(() => useWindowControls());

    // Wait for useEffect to complete to set isMaximized to true
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.handleMaximize();
    });

    expect(mockWindow.unmaximize).toHaveBeenCalled();
  });

  it('should handle minimize', async () => {
    const mockWindow = {
      minimize: jest.fn().mockResolvedValue(undefined),
    };
    (getCurrentWindow as jest.Mock).mockReturnValue(mockWindow);

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await result.current.handleMinimize();
    });

    expect(mockWindow.minimize).toHaveBeenCalled();
  });

  it('should handle close', async () => {
    const mockWindow = {
      close: jest.fn().mockResolvedValue(undefined),
    };
    (getCurrentWindow as jest.Mock).mockReturnValue(mockWindow);

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await result.current.handleClose();
    });

    expect(mockWindow.close).toHaveBeenCalled();
  });

  it('should handle errors gracefully in handleMaximize', async () => {
    const mockWindow = {
      maximize: jest.fn().mockRejectedValue(new Error('Error')),
    };
    (getCurrentWindow as jest.Mock).mockReturnValue(mockWindow);

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await expect(result.current.handleMaximize()).resolves.not.toThrow();
    });
  });

  it('should handle errors gracefully in handleMinimize', async () => {
    const mockWindow = {
      minimize: jest.fn().mockRejectedValue(new Error('Error')),
    };
    (getCurrentWindow as jest.Mock).mockReturnValue(mockWindow);

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await expect(result.current.handleMinimize()).resolves.not.toThrow();
    });
  });

  it('should handle errors gracefully in handleClose', async () => {
    const mockWindow = {
      close: jest.fn().mockRejectedValue(new Error('Error')),
    };
    (getCurrentWindow as jest.Mock).mockReturnValue(mockWindow);

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await expect(result.current.handleClose()).resolves.not.toThrow();
    });
  });

  it('should cleanup listener on unmount', async () => {
    const mockUnlisten = jest.fn();
    (listen as jest.Mock).mockResolvedValue(mockUnlisten);
    const mockWindow = {
      isMaximized: jest.fn().mockResolvedValue(false),
    };
    (getCurrentWindow as jest.Mock).mockReturnValue(mockWindow);

    const { unmount } = renderHook(() => useWindowControls());

    // Wait for useEffect to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    unmount();

    expect(mockUnlisten).toHaveBeenCalled();
  });
});
