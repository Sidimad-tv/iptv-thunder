import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  isRemoving?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 3000;

const getToastColor = (type: Toast['type']): string => {
  switch (type) {
    case 'success':
      return 'bg-green-600';
    case 'error':
      return 'bg-red-600';
    case 'info':
    default:
      return 'bg-blue-600';
  }
};

const getToastIcon = (type: Toast['type']): string => {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '⚠';
    case 'info':
    default:
      return 'ℹ';
  }
};

const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string, duration?: number) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
}> = ({ toast, onRemove, onMouseEnter, onMouseLeave, onKeyDown }) => {
  return (
    <div
      className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-white flex items-center gap-3 transition-all duration-300 ${getToastColor(toast.type)} ${
        toast.isRemoving ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      }`}
      style={{
        animation: toast.isRemoving ? 'none' : 'slideIn 0.3s ease-out'
      }}
      role="alert"
      aria-atomic="true"
      onMouseEnter={() => onMouseEnter(toast.id)}
      onMouseLeave={() => onMouseLeave(toast.id, toast.duration)}
    >
      <span className="font-bold">{getToastIcon(toast.type)}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        onKeyDown={(e) => onKeyDown(e, toast.id)}
        className="ml-2 hover:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-current rounded p-1"
        aria-label="Close notification"
        tabIndex={0}
      >
        ✕
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounterRef = useRef(0);
  const timeoutRefsRef = useRef<Map<string, number>>(new Map());
  const pausedTimeoutsRef = useRef<Set<string>>(new Set());

  const clearTimeoutForId = useCallback((id: string) => {
    const timeout = timeoutRefsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefsRef.current.delete(id);
    }
    pausedTimeoutsRef.current.delete(id);
  }, []);

  const markToastAsRemoving = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, isRemoving: true } : t));
  }, []);

  const removeToastAfterDelay = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const removeToastWithAnimation = useCallback((id: string) => {
    markToastAsRemoving(id);
    setTimeout(() => {
      removeToastAfterDelay(id);
    }, 300);
  }, [markToastAsRemoving, removeToastAfterDelay]);

  const removeToastImmediately = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const removeToast = useCallback((id: string, withAnimation: boolean = true) => {
    if (withAnimation) {
      removeToastWithAnimation(id);
    } else {
      removeToastImmediately(id);
    }
    clearTimeoutForId(id);
  }, [removeToastWithAnimation, removeToastImmediately, clearTimeoutForId]);

  const clearToasts = useCallback(() => {
    setToasts([]);
    timeoutRefsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefsRef.current.clear();
    pausedTimeoutsRef.current.clear();
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = DEFAULT_DURATION) => {
    const id = `toast-${toastCounterRef.current++}`;
    
    setToasts(prev => {
      const newToasts = [...prev, { id, message, type, duration }];
      return newToasts.slice(-MAX_TOASTS);
    });

    const timeout = setTimeout(() => {
      if (!pausedTimeoutsRef.current.has(id)) {
        removeToast(id);
      }
    }, duration);
    
    timeoutRefsRef.current.set(id, timeout);
  }, [removeToast]);

  const handleMouseEnter = useCallback((id: string) => {
    const timeout = timeoutRefsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefsRef.current.delete(id);
      pausedTimeoutsRef.current.add(id);
    }
  }, []);

  const handleMouseLeave = useCallback((id: string, duration: number = DEFAULT_DURATION) => {
    if (pausedTimeoutsRef.current.has(id)) {
      pausedTimeoutsRef.current.delete(id);
      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);
      timeoutRefsRef.current.set(id, timeout);
    }
  }, [removeToast]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      removeToast(id);
    }
  }, [removeToast]);

  useEffect(() => {
    return () => {
      timeoutRefsRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  const contextValue = useMemo(() => ({ showToast, removeToast, clearToasts }), [showToast, removeToast, clearToasts]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <section
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-label="Toast notifications"
      >
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={removeToast}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onKeyDown={handleKeyDown}
          />
        ))}
        <style>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </section>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
