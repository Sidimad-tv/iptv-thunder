import React, { useEffect, useState } from 'react';
import { StalkerEPG } from '@/types';
import { StreamState } from '../mpv.types';
import { formatEPGTime, getResolutionLabel } from '../mpv.utils';

interface EPGProgressProps {
  startTime: number;
  endTime: number;
}

const EPGProgress: React.FC<EPGProgressProps> = ({ startTime, endTime }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const now = Math.floor(Date.now() / 1000);
      const total = endTime - startTime;
      const current = Math.max(0, Math.min(now - startTime, total));
      setProgress(total > 0 ? (current / total) * 100 : 0);
    };
    updateProgress();
    const interval = setInterval(updateProgress, 30000);
    return () => clearInterval(interval);
  }, [startTime, endTime]);

  return (
    <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden flex-shrink-0" title={`${Math.round(progress)}%`}>
      <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
    </div>
  );
};

interface PlayerHeaderProps {
  name: string;
  streamState: StreamState;
  usingMpv: boolean;
  videoParams: { width?: number; height?: number; fps?: number } | null;
  totalRetries: number;
  currentUrlIdx: number;
  urlCount: number;
  currentProgram: Pick<StalkerEPG, 'name' | 'description' | 'start_time' | 'end_time' | 'year' | 'rating' | 'category'> | null;
  isVod: boolean;
  isLoading: boolean;
  statusMsg: string;
  isFullscreen: boolean;
  showUi: boolean;
}

// Extracted Video Params Badge component
const VideoParamsBadge: React.FC<{ videoParams: { width?: number; height?: number } | null }> = ({ videoParams }) => {
  if (!videoParams?.width || !videoParams?.height) return null;
  return (
    <span className="text-sm px-3 py-1 rounded-full flex-shrink-0"
      style={{ background: '#3b82f622', color: '#3b82f6', border: '1px solid #3b82f644' }}>
      {getResolutionLabel(videoParams.width, videoParams.height)}
    </span>
  );
};

// Extracted EPG Info Row component
const EPGInfoRow: React.FC<{
  currentProgram: PlayerHeaderProps['currentProgram'];
  isVod: boolean;
}> = ({ currentProgram, isVod }) => {
  if (!currentProgram || isVod) return null;
  return (
    <div className="flex items-center gap-2 mt-1 ml-[22px]">
      <span className="text-xs text-gray-500">
        {formatEPGTime(currentProgram.start_time)} - {formatEPGTime(currentProgram.end_time)}
      </span>
      <EPGProgress startTime={Number.parseInt(currentProgram.start_time)} endTime={Number.parseInt(currentProgram.end_time)} />
      {currentProgram.year && (
        <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{currentProgram.year}</span>
      )}
      {currentProgram.rating && currentProgram.rating > 0 && (
        <span className="text-xs px-2 py-0.5 rounded bg-yellow-600/30 text-yellow-400">★ {currentProgram.rating}</span>
      )}
      {currentProgram.description && (
        <span className="text-xs text-gray-400 truncate max-w-md italic" title={currentProgram.description}>
          • {currentProgram.description}
        </span>
      )}
    </div>
  );
};

// Constants defined outside component to avoid re-creation on every render
const STATE_COLOR: Record<StreamState, string> = {
  connecting: '#888780', playing: '#1D9E75', stalled: '#BA7517', retrying: '#D85A30', dead: '#A32D2D',
};
const STATE_LABEL: Record<StreamState, string> = {
  connecting: 'Connecting', playing: 'Live', stalled: 'Stalled', retrying: 'Retrying', dead: 'Dead',
};

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({
  name, streamState, usingMpv, videoParams, totalRetries, currentUrlIdx, urlCount,
  currentProgram, isVod, isLoading, statusMsg, isFullscreen, showUi
}) => {

  if (isFullscreen && !showUi) return null;

  return (
    <div className="flex-shrink-0 px-4 py-3 z-10"
      style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)' }}>
      {/* Row 1: Channel name and status badges */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 min-w-0">
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: STATE_COLOR[streamState],
            boxShadow: streamState === 'playing' ? `0 0 0 4px ${STATE_COLOR.playing}44` : 'none',
            transition: 'background 0.3s',
          }} />
          <h2 id="player-title" className="text-white text-xl font-semibold truncate">{name}</h2>
          <span className="text-sm px-3 py-1 rounded-full flex-shrink-0" style={{
            background: `${STATE_COLOR[streamState]}22`, color: STATE_COLOR[streamState],
            border: `1px solid ${STATE_COLOR[streamState]}55`,
          }}>{isVod && streamState === 'playing' ? 'Playing' : STATE_LABEL[streamState]}</span>
          {usingMpv && (
            <span className="text-sm px-3 py-1 rounded-full flex-shrink-0"
              style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44' }}>
              MPV
            </span>
          )}
          <VideoParamsBadge videoParams={videoParams} />
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {totalRetries > 0 && (
            <span className="text-xs text-gray-500">{totalRetries} retry{totalRetries === 1 ? '' : 's'}</span>
          )}
          {currentUrlIdx > 0 && (
            <span className="text-xs text-yellow-500">fallback {currentUrlIdx}/{urlCount - 1}</span>
          )}
        </div>
      </div>

      {/* Row 2: Current Program Name (Live TV only) */}
      {currentProgram && !isVod && (
        <div className="mt-1 ml-[22px] flex items-center gap-2 flex-wrap" style={{ display: 'block' }}>
          <span
            className="text-base font-medium"
            style={{ color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px' }}
            title={currentProgram.description || currentProgram.name}
          >
            📺 {currentProgram.name}
          </span>
          {currentProgram.category && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-600/30 text-blue-300">{currentProgram.category}</span>
          )}
        </div>
      )}
      {!currentProgram && !isVod && (
        <div className="mt-1 ml-[22px]">
          <span className="text-sm text-gray-600 italic">Brak EPG</span>
        </div>
      )}

      {/* Row 3: Detailed EPG info (Live TV only) */}
      <EPGInfoRow currentProgram={currentProgram} isVod={isVod} />

      {(isLoading) && statusMsg && (
        <p className="mt-1.5 text-gray-400 text-xs ml-[22px]">{statusMsg}</p>
      )}
    </div>
  );
};
