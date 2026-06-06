import React from 'react';

interface DeadStateProps {
  errorMsg: string | null;
  onRetry: () => void;
  onClose: () => void;
}

export const DeadState: React.FC<DeadStateProps> = ({ errorMsg, onRetry, onClose }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8 text-center gap-4"
    style={{ background: 'rgba(0,0,0,0.9)' }}>
    <span className="text-red-400" style={{ fontSize: 40 }}>⊘</span>
    <p className="text-white text-lg font-medium">Stream unavailable</p>
    {errorMsg && <p className="text-gray-400 text-sm max-w-sm">{errorMsg}</p>}
    <div className="flex gap-3 mt-2">
      <button onClick={onRetry} data-tv-focusable tabIndex={0}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors">
        Try again
      </button>
      <button onClick={onClose} data-tv-focusable tabIndex={0}
        className="px-5 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors">
        Close
      </button>
    </div>
  </div>
);
