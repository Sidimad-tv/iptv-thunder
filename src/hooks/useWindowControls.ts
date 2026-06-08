import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import type { Window } from '@tauri-apps/api/window';

interface WindowControls {
  isMaximized: boolean;
  handleMaximize: () => Promise<void>;
  handleMinimize: () => Promise<void>;
  handleClose: () => Promise<void>;
}

export const useWindowControls = (): WindowControls => {
  const [isMaximized, setIsMaximized] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);
  const windowRef = useRef<Window | null>(null);

  useEffect(() => {
    let isMounted = true;

    try {
      windowRef.current = getCurrentWindow();
    } catch {
      // Not running in Tauri environment
    }

    const init = async () => {
      try {
        if (!windowRef.current) return;
        const fullscreen = await windowRef.current.isFullscreen();
        if (isMounted) {
          setIsMaximized(fullscreen);
        }
      } catch {
        // Silent fail - component will use default state
      }
    };

    const setupWindowListener = async () => {
      try {
        if (!windowRef.current) return;
        const unlisten = await listen('tauri://resize', async () => {
          try {
            if (!windowRef.current) return;
            const fullscreen = await windowRef.current.isFullscreen();
            if (isMounted) {
              setIsMaximized(fullscreen);
            }
          } catch {
            // Silent fail - component will continue with current state
          }
        });
        if (isMounted) {
          unlistenRef.current = unlisten;
        }
      } catch {
        // Silent fail - component will not sync window state
      }
    };

    (async () => {
      await init();
      await setupWindowListener();
    })();

    return () => {
      isMounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  const handleMaximize = useCallback(async () => {
    try {
      if (!windowRef.current) return;
      // Query actual fullscreen state instead of relying on possibly stale React state
      const currentlyFullscreen = await windowRef.current.isFullscreen();
      if (currentlyFullscreen) {
        await windowRef.current.setFullscreen(false);
        setIsMaximized(false);
      } else {
        await windowRef.current.setFullscreen(true);
        setIsMaximized(true);
      }
    } catch {
      // Silent fail - user can try again
    }
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      if (!windowRef.current) return;
      await windowRef.current.minimize();
    } catch {
      // Silent fail - user can try again
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      if (!windowRef.current) return;
      await windowRef.current.close();
    } catch {
      // Silent fail - user can try again
    }
  }, []);

  return {
    isMaximized,
    handleMaximize,
    handleMinimize,
    handleClose,
  };
};