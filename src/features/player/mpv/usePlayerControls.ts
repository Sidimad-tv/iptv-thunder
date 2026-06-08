import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app.store';
import { usePlaybackStore } from '@/store/playback.store';
import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';
import { command, setProperty } from 'tauri-plugin-libmpv-api';

interface UsePlayerControlsReturn {
  volume: number;
  isFullscreen: boolean;
  isPip: boolean;
  showUi: boolean;
  handleMouseMove: () => void;
  handlePlayPause: () => Promise<void>;
  handleFullscreen: () => Promise<void>;
  handlePip: () => Promise<void>;
  handleClose: (onClose: () => void) => Promise<void>;
  handleVolumeChange: (newVol: number) => Promise<void>;
  handleSeek: (seconds: number) => Promise<void>;
  seekTo: (targetTime: number, duration: number) => Promise<void>;
  exitFullscreen: () => Promise<void>;
}

export function usePlayerControls(): UsePlayerControlsReturn {
  const storedVolume = usePlaybackStore(state => state.settings.volume);
  const setStoredVolume = usePlaybackStore(state => state.setVolume);
  const [volume, setVolume] = useState(() => Math.round(storedVolume * 100));
  const setFullscreen = useAppStore(state => state.setFullscreen);
  const isFullscreen = useAppStore(state => state.isFullscreen);
  const setPip = useAppStore(state => state.setPip);
  const isPip = useAppStore(state => state.isPip);
  const [showUi, setShowUi] = useState(true);
  const uiHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const lastMoveRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const handleMouseMove = useCallback(() => {
    const now = Date.now();
    if (now - lastMoveRef.current < 100) return;
    lastMoveRef.current = now;

    setShowUi(true);
    if (uiHideTimerRef.current) clearTimeout(uiHideTimerRef.current);
    uiHideTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setShowUi(false);
    }, 3000);
  }, []);

  const handleFullscreen = useCallback(async () => {
    try {
      const window = getCurrentWindow();
      const newState = !isFullscreen;

      if (newState) {
        await window.setDecorations(true);
        await window.setFullscreen(true);
      } else {
        await window.setFullscreen(false);
        await window.setDecorations(false);
      }

      setFullscreen(newState);
      setShowUi(!newState);
    } catch (e) { console.error('Fullscreen failed:', e); }
  }, [isFullscreen, setFullscreen]);

  const handlePip = useCallback(async () => {
    try {
      const window = getCurrentWindow();
      const newState = !isPip;

      if (newState) {
        await window.setAlwaysOnTop(true);
        await window.setSize(new LogicalSize(640, 360));
        await window.setPosition(new LogicalPosition(50, 50));
        await window.setDecorations(true);
        if (isFullscreen) {
          await window.setFullscreen(false);
          setFullscreen(false);
        }
      } else {
        await window.setAlwaysOnTop(false);
        await window.setSize(new LogicalSize(1280, 720));
        await window.setPosition(new LogicalPosition(0, 0));
        await window.setDecorations(false);
      }

      setPip(newState);
    } catch (e) { console.error('PiP failed:', e); }
  }, [isPip, isFullscreen, setFullscreen, setPip]);

  const exitFullscreen = useCallback(async () => {
    if (!isFullscreen) return;
    try {
      const window = getCurrentWindow();
      await window.setFullscreen(false);
      await window.setDecorations(false);
      setFullscreen(false);
      setShowUi(true);
    } catch (e) { console.error('Exit fullscreen failed:', e); }
  }, [isFullscreen, setFullscreen]);

  const handleClose = useCallback(async (onClose: () => void) => {
    await exitFullscreen();
    onClose();
  }, [exitFullscreen]);

  const handlePlayPause = useCallback(async () => {
    try {
      await command('cycle', ['pause']);
    } catch (e) { console.error('Play/Pause failed:', e); }
  }, []);

  const handleVolumeChange = useCallback(async (newVol: number) => {
    try {
      await setProperty('volume', newVol);
      setVolume(newVol);
      setStoredVolume(newVol / 100);
    } catch (e) { console.error('Volume failed:', e); }
  }, [setStoredVolume]);

  const handleSeek = useCallback(async (seconds: number) => {
    try {
      await command('seek', [seconds, 'relative']);
    } catch (e) { console.error('Seek failed:', e); }
  }, []);

  const seekTo = useCallback(async (targetTime: number, duration: number) => {
    if (!duration) return;
    try {
      await command('seek', [targetTime, 'absolute']);
    } catch (e) { console.error('SeekTo failed:', e); }
  }, []);

  return {
    volume,
    isFullscreen,
    isPip,
    showUi,
    handleMouseMove,
    handlePlayPause,
    handleFullscreen,
    handlePip,
    handleClose,
    handleVolumeChange,
    handleSeek,
    seekTo,
    exitFullscreen,
  };
}
