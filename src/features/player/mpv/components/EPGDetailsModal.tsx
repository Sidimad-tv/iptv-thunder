import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { StalkerEPG } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';
import { formatEPGTime, formatEPGDate, isProgramNow } from '../mpv.utils';

interface EPGDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  epgData: StalkerEPG[] | undefined;
  channelName: string;
  isLoading: boolean;
}

export const EPGDetailsModal = React.memo<EPGDetailsModalProps>(({ isOpen, onClose, epgData, channelName, isLoading }) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClickOutside]);

  // Track expanded descriptions by program ID
  const [expandedPrograms, setExpandedPrograms] = useState<Set<number>>(new Set());

  // Toggle expanded state for program description
  const toggleExpanded = useCallback((programId: number) => {
    setExpandedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(programId)) {
        next.delete(programId);
      } else {
        next.add(programId);
      }
      return next;
    });
  }, []);

  // Group programs by date - memoized to avoid recalculation on every render
  const groupedPrograms = useMemo(() =>
    epgData?.reduce((acc, program) => {
      const date = formatEPGDate(program.start_time);
      if (!acc[date]) acc[date] = [];
      acc[date].push(program);
      return acc;
    }, {} as Record<string, StalkerEPG[]>),
  [epgData]);

  if (!isOpen) return null;

  // Extract nested ternary into independent variable for better readability
  let content;
  if (isLoading) {
    content = (
      <div className="flex items-center justify-center py-8 lg:py-12">
        <div className="animate-spin w-6 h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  } else if (!epgData || epgData.length === 0) {
    content = (
      <div className="text-center py-8 lg:py-12">
        <p className="text-gray-500 text-sm lg:text-base xl:text-lg">{t('noEpgData')}</p>
      </div>
    );
  } else {
    content = (
      <div className="space-y-4 lg:space-y-6">
              {Object.entries(groupedPrograms || {}).map(([date, programs]) => (
                <div key={date}>
                  <h4 className="text-sm lg:text-base xl:text-lg font-medium text-blue-400 mb-2 lg:mb-3 sticky top-0 bg-zinc-900 py-1">{date}</h4>
                  <div className="space-y-2 lg:space-y-3">
                    {programs.map((program) => {
                      const nowPlaying = isProgramNow(program.start_time, program.end_time);
                      const isExpanded = expandedPrograms.has(program.id);
                      return (
                        <div
                          key={program.id}
                          className={`p-3 lg:p-4 xl:p-5 rounded-lg transition-colors ${
                            nowPlaying ? 'bg-blue-600/20 border border-blue-500/50' : 'bg-zinc-800/50 hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-start gap-3 lg:gap-4 xl:gap-5">
                            <div className="flex-shrink-0 text-xs lg:text-sm xl:text-base text-gray-400 font-mono pt-0.5">
                              {formatEPGTime(program.start_time)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
                                <span className={`font-medium text-sm lg:text-base xl:text-lg ${nowPlaying ? 'text-blue-300' : 'text-gray-200'}`}>
                                  {program.name}
                                </span>
                                {program.category && (
                                  <span className="text-xs lg:text-sm xl:text-base px-2 py-0.5 lg:px-3 lg:py-1 rounded bg-blue-600/30 text-blue-300">
                                    {program.category}
                                  </span>
                                )}
                                {nowPlaying && (
                                  <span className="text-xs lg:text-sm xl:text-base px-2 py-0.5 lg:px-3 lg:py-1 rounded-full bg-blue-600 text-white animate-pulse">
                                    {t('nowPlayingLabel')}
                                  </span>
                                )}
                              </div>
                              {program.description && (
                                <p
                                  className={`text-xs lg:text-sm xl:text-base text-gray-500 mt-1 lg:mt-2 cursor-pointer ${isExpanded ? '' : 'line-clamp-2'}`}
                                  onClick={() => toggleExpanded(program.id)}
                                >
                                  {program.description}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0 text-xs lg:text-sm xl:text-base text-gray-500 font-mono">
                              {formatEPGTime(program.end_time)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div ref={modalRef} className="bg-zinc-900 rounded-xl max-w-2xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl w-full mx-4 lg:mx-8 max-h-[80vh] lg:max-h-[85vh] flex flex-col shadow-2xl border border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 lg:p-6 xl:p-8 border-b border-zinc-700">
          <div>
            <h3 className="text-lg lg:text-2xl xl:text-3xl font-semibold text-white">📺 {channelName}</h3>
            <p className="text-sm lg:text-base xl:text-lg text-gray-400">Program TV - EPG</p>
          </div>
          <button onClick={onClose} data-tv-focusable tabIndex={0} className="w-8 h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors">
            <span className="text-gray-400 text-lg lg:text-xl xl:text-2xl">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-8">
          {content}
        </div>

        {/* Footer */}
        <div className="p-3 lg:p-4 xl:p-5 border-t border-zinc-700 text-center">
          <button onClick={onClose} data-tv-focusable tabIndex={0} className="px-6 py-2 lg:px-8 lg:py-3 xl:px-10 xl:py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm lg:text-base xl:text-lg transition-colors">
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
});
EPGDetailsModal.displayName = 'EPGDetailsModal';
