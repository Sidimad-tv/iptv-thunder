// =========================
// 🎨 CUSTOM TITLE BAR
// =========================
import { useEffect, useCallback, useRef } from 'react';
import { Copy, Maximize2, Minimize2, X } from 'lucide-react';
import { useWindowControls } from '@/hooks/useWindowControls';
import { useTranslation } from '@/hooks/useTranslation';

export const TitleBar = () => {
  const { isMaximized, handleMaximize, handleMinimize, handleClose } = useWindowControls();
  const { t } = useTranslation();
  const handleCloseRef = useRef(handleClose);

  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.altKey && e.key === 'F4') {
      e.preventDefault();
      void handleCloseRef.current();
    }
  }, []);

  useEffect(() => {
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between w-full px-4 py-1.5 dark:bg-slate-900/80 bg-white/80 backdrop-blur-md border-b dark:border-slate-700/30 border-gray-200/30 select-none relative z-50"
    >
      <div className="flex items-center gap-2">
        <img src="https://cdn.jsdelivr.net/gh/Sidimadtv/all/sidi/assets/images/logo.png" alt="S!d!m@dtv-STB" className="h-6 w-auto" />
        <span className="text-green-500 font-bold text-sm tracking-wider ml-2">S!d!m@dtv-STB</span>
      </div>

      <div className="flex items-center gap-1" data-tauri-drag-region="false">
        <button
          onClick={handleMinimize}
          className="w-10 h-8 flex items-center justify-center rounded hover:bg-slate-700/30 dark:hover:bg-slate-700/50 transition-colors group"
          title="Minimalizuj"
          aria-label={t('minimizeWindow')}
          type="button"
        >
          <Minimize2 className="w-4 h-4 dark:text-slate-400 text-slate-600 group-hover:dark:text-white group-hover:text-slate-900 transition-colors" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-8 flex items-center justify-center rounded hover:bg-slate-700/30 dark:hover:bg-slate-700/50 transition-colors group"
          title={isMaximized ? "Przywróć" : "Maksymalizuj"}
          aria-label={isMaximized ? t('restoreWindow') : t('maximizeWindow')}
          type="button"
        >
          {isMaximized ? (
            <Copy className="w-4 h-4 dark:text-slate-400 text-slate-600 group-hover:dark:text-white group-hover:text-slate-900 transition-colors" />
          ) : (
            <Maximize2 className="w-4 h-4 dark:text-slate-400 text-slate-600 group-hover:dark:text-white group-hover:text-slate-900 transition-colors" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-8 flex items-center justify-center rounded hover:bg-red-500/20 transition-colors group"
          title="Zamknij"
          aria-label={t('closeWindow')}
          type="button"
        >
          <X className="w-4 h-4 dark:text-slate-400 text-slate-600 group-hover:dark:text-red-400 group-hover:text-red-500 transition-colors" />
        </button>
      </div>
    </div>
  );
};
