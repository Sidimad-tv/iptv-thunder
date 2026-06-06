import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StalkerVOD } from '@/types';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { useFavorites } from '@/hooks/useFavorites';
import { useResumeStore } from '@/store/resume.store';
import { usePortalsStore } from '@/store/portals.store';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationKey } from '@/lib/translations';
import { useTVNavigation } from '@/hooks';
import { useSeriesInfo, usePrefetchSeriesStream } from './series.hooks';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Heart, ArrowLeft, X } from 'lucide-react';

interface SeriesMetadataProps {
  fullSeries: StalkerVOD;
  seriesInfo: any;
  seasons: string[];
  episodes: any[];
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  getEpisodeCountText: (count: number) => string;
}

const SeriesMetadata: React.FC<SeriesMetadataProps> = ({
  fullSeries,
  seriesInfo,
  seasons,
  episodes,
  t,
  getEpisodeCountText,
}) => {
  const actorsList = fullSeries.actors
    ? fullSeries.actors.split(',').map((a: string) => a.trim()).filter(Boolean)
    : [];

  const directorsList = fullSeries.director
    ? fullSeries.director.split(',').map((d: string) => d.trim()).filter(Boolean)
    : [];

  return (
    <>
      {/* Meta info */}
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 text-xs sm:text-sm flex-wrap">
        {fullSeries.year && <span className="text-slate-300">{fullSeries.year}</span>}
        {(fullSeries.genres_str || seriesInfo?.series?.genres_str) && (
          <span className="text-slate-400">{fullSeries.genres_str || seriesInfo?.series?.genres_str}</span>
        )}
        {seasons.length > 0 && (
          <span className="text-slate-400">{seasons.length} {seasons.length === 1 ? t('season') : t('seasons')}</span>
        )}
        {episodes.length > 0 && (
          <span className="text-slate-400">{episodes.length} {getEpisodeCountText(episodes.length)}</span>
        )}
        {(fullSeries.rating_imdb || seriesInfo?.series?.rating_imdb) && (
          <span className="px-2 py-0.5 bg-yellow-600/80 rounded text-white text-xs flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {fullSeries.rating_imdb || seriesInfo?.series?.rating_imdb}
          </span>
        )}
      </div>

      {/* Description */}
      {(fullSeries.description || seriesInfo?.series?.description) && (
        <p className="text-slate-300 mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base">
          {fullSeries.description || seriesInfo?.series?.description}
        </p>
      )}

      {/* Directors */}
      {(directorsList.length > 0 || fullSeries.director || seriesInfo?.series?.director) && (
        <div className="mb-2 sm:mb-3">
          <span className="text-slate-400 text-xs sm:text-sm">{t('director')}: </span>
          <span className="text-slate-300 text-xs sm:text-sm">
            {directorsList.length > 0
              ? directorsList.join(', ')
              : fullSeries.director || seriesInfo?.series?.director}
          </span>
        </div>
      )}

      {/* Cast */}
      {(actorsList.length > 0 || fullSeries.actors || seriesInfo?.series?.actors) && (
        <div className="mb-3 sm:mb-4">
          <span className="text-slate-400 text-xs sm:text-sm">{t('cast')}: </span>
          <span className="text-slate-300 text-xs sm:text-sm">
            {actorsList.length > 0
              ? actorsList.join(', ')
              : fullSeries.actors || seriesInfo?.series?.actors}
          </span>
        </div>
      )}
    </>
  );
};

interface EpisodeListProps {
  currentEpisodes: StalkerVOD[];
  selectedSeason: string;
  fullSeries: StalkerVOD;
  episodesLoading: boolean;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  getPosition: (id: string) => number;
  getWatchStatus: (id: string) => string;
  handleEpisodePlay: (episode: StalkerVOD) => void;
}

const EpisodeList: React.FC<EpisodeListProps> = ({
  currentEpisodes,
  selectedSeason,
  fullSeries,
  episodesLoading,
  t,
  getPosition,
  getWatchStatus,
  handleEpisodePlay,
}) => {
  if (episodesLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
      </div>
    );
  }

  if (currentEpisodes.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        {t('noEpisodes')}
      </div>
    );
  }

  return (
    <div className="space-y-0 divide-y divide-slate-800">
      {currentEpisodes.map((episode, index) => {
        const resumePos = getPosition(String(episode.id));
        const watchStatus = getWatchStatus(String(episode.id));
        const hasResume = resumePos > 30 && watchStatus === 'in_progress';
        const isWatched = watchStatus === 'watched';
        const epNum = index + 1;
        const displayName = `${t('episode')} ${epNum}`;

        return (
          <div
            key={`${selectedSeason}-${episode.episode || index}-${episode.id}`}
            id={`episode-${episode.id}`}
            data-tv-focusable
            data-tv-id={`episode-${episode.id}`}
            data-tv-group="series-episodes"
            data-tv-index={index}
            tabIndex={0}
            onClick={() => handleEpisodePlay(episode)}
            className="group flex items-start gap-3 sm:gap-4 lg:gap-6 py-4 sm:py-6 cursor-pointer hover:bg-slate-800/50 transition-colors"
          >
            {/* Episode number */}
            <span className="text-lg sm:text-xl lg:text-2xl font-light text-slate-500 w-6 sm:w-8 text-center pt-2 sm:pt-8">
              {epNum}
            </span>

            {/* Thumbnail */}
            <div className="relative w-24 sm:w-32 lg:w-40 aspect-video bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
              {episode.logo || fullSeries.poster ? (
                <img
                  src={episode.logo || fullSeries.poster}
                  alt={episode.name || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl sm:text-3xl text-slate-600">
                  {epNum}
                </div>
              )}
              
              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 py-1 sm:py-2">
              <div className="flex flex-col sm:flex-row items-start sm:justify-between sm:items-center gap-2 sm:gap-4">
                <div>
                  <h3 className="text-base sm:text-lg lg:text-lg font-medium text-white mb-1 sm:mb-2 group-hover:text-green-700 transition-colors">
                    {displayName}
                  </h3>
                  {episode.description && (
                    <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 mb-1 sm:mb-2">
                      {episode.description}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                  {hasResume && (
                    <span className="text-xs bg-green-700 text-white px-2 py-1 rounded">
                      {t('resume')}
                    </span>
                  )}
                  {isWatched && (
                    <span className="text-xs bg-slate-700 text-white px-2 py-1 rounded">
                      {t('watched')}
                    </span>
                  )}
                  {episode.length && (
                    <span className="text-sm text-slate-400">
                      {Math.floor(episode.length / 60)} {t('minutes')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface ResumeDialogProps {
  showResumeDialog: boolean;
  selectedEpisode: StalkerVOD | null;
  resumePosition: number;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  formatTime: (seconds: number) => string;
  onPlayFromStart: () => void;
  onResume: () => void;
  onClose: () => void;
}

const ResumeDialog: React.FC<ResumeDialogProps> = ({
  showResumeDialog,
  selectedEpisode,
  resumePosition,
  t,
  formatTime,
  onPlayFromStart,
  onResume,
  onClose,
}) => {
  if (!showResumeDialog || !selectedEpisode) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" data-tv-container="resume-dialog">
      <div className="bg-slate-900 rounded-2xl p-4 sm:p-6 lg:p-8 max-w-sm sm:max-w-md w-full mx-4">
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <h3 className="text-xl sm:text-2xl font-semibold text-white">{t('resumeWatching')}</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 text-slate-400 hover:text-white transition-colors"
            data-tv-focusable
            data-tv-id="resume-close-btn"
            data-tv-group="resume-actions"
            tabIndex={0}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <p className="text-slate-400 mb-6 sm:mb-8 text-sm sm:text-base">
          <span className="text-slate-300">{t('watchedEpisodeTo')} <span className="text-white font-medium">{formatTime(resumePosition)}</span></span>
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Button variant="secondary" onClick={onPlayFromStart} className="flex-1" data-tv-focusable data-tv-id="resume-from-start" data-tv-group="resume-actions" data-tv-initial tabIndex={0}>
            {t('playFromStart')}
          </Button>
          <Button onClick={onResume} className="flex-1" data-tv-focusable data-tv-id="resume-playback" data-tv-group="resume-actions" tabIndex={0}>
            {t('resumePlayback')}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface SeasonSelectorProps {
  seasons: string[];
  selectedSeason: string;
  episodesBySeason: Record<string, StalkerVOD[]>;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  getEpisodeCountText: (count: number) => string;
  onSeasonChange: (season: string) => void;
}

const SeasonSelector: React.FC<SeasonSelectorProps> = ({
  seasons,
  selectedSeason,
  episodesBySeason,
  t,
  getEpisodeCountText,
  onSeasonChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectingSeasonRef = useRef(false);

  const prevIsOpen = useRef(isOpen);

  // Restore focus to trigger when dropdown closes, focus first season when opens
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setTimeout(() => {
        const firstSeason = document.querySelector('[data-tv-group="seasons"]') as HTMLElement;
        if (firstSeason) {
          firstSeason.focus();
        }
      }, 50);
    }
    if (!isOpen && prevIsOpen.current) {
      setTimeout(() => {
        const trigger = document.querySelector('[data-tv-id="series-season-select"]') as HTMLElement;
        if (trigger) {
          trigger.focus();
        }
      }, 50);
    }
    selectingSeasonRef.current = false;
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  if (seasons.length <= 1) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        data-tv-focusable
        data-tv-id="series-season-select"
        data-tv-group="series-controls"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 w-fit cursor-pointer flex items-center gap-2"
      >
        <span>{t('season')} {selectedSeason} ({episodesBySeason[selectedSeason]?.length || 0} {getEpisodeCountText(episodesBySeason[selectedSeason]?.length || 0)})</span>
        <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown - always render but hide with display */}
      <div 
        ref={dropdownRef}
        className={`absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 min-w-full ${isOpen ? 'block' : 'hidden'}`}
      >
            {seasons.map((season: string, index: number) => (
              <button
                key={season}
                data-tv-focusable
                data-tv-id={`season-${season}`}
                data-tv-group="seasons"
                data-tv-disabled={isOpen ? undefined : 'true'}
                tabIndex={isOpen ? 0 : -1}
                data-tv-initial={index === 0 ? 'true' : undefined}
                onClick={() => {
                  selectingSeasonRef.current = true;
                  onSeasonChange(season);
                  setIsOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
                    e.preventDefault();
                    selectingSeasonRef.current = true;
                    onSeasonChange(season);
                    setIsOpen(false);
                  }
                }}
                onFocus={(e) => {
                  e.stopPropagation();
                }}
                className={`w-full px-4 py-3 cursor-pointer hover:bg-slate-700 focus:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${season === selectedSeason ? 'bg-slate-600' : ''}`}
              >
                {t('season')} {season} ({episodesBySeason[season]?.length || 0} {getEpisodeCountText(episodesBySeason[season]?.length || 0)})
              </button>
            ))}
        </div>
    </div>
  );
};


interface SeriesDetailsProps {
  series: StalkerVOD;
  client: StalkerClient;
  onPlay: (episode: StalkerVOD, resumePosition?: number) => void;
  onBack: () => void;
}

export const SeriesDetails: React.FC<SeriesDetailsProps> = ({
  series,
  client,
  onPlay,
  onBack,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { setActiveContainer } = useTVNavigation({
    onBack,
  });

  useEffect(() => {
    if (containerRef.current) {
      setActiveContainer(containerRef.current);
      setTimeout(() => {
        const firstInput = containerRef.current?.querySelector('[data-tv-initial]') as HTMLElement;
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
    }
    return () => {
      setActiveContainer(null);
    };
  }, [setActiveContainer]);
  const accountId = usePortalsStore((s) =>
    s.portals.find((p) => p.id === s.activePortalId)?.id ?? 'default'
  );

  const { favorites, toggleItemFavorite } = useFavorites(accountId);
  const { getPosition, clearPosition, getWatchStatus } = useResumeStore();

  const [selectedSeason, setSelectedSeason] = useState<string>('1');
  const [selectedEpisode, setSelectedEpisode] = useState<StalkerVOD | null>(null);
  const [resumePosition, setResumePosition] = useState(0);
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  const { data: seriesInfo, isLoading: episodesLoading } = useSeriesInfo(
    client,
    String(series.id)
  );

  // Merge: seriesInfo from API + favorites data (favorites takes priority for metadata)
  const apiSeries = seriesInfo?.series;
  const fullSeries = apiSeries?.id
    ? {
        ...apiSeries,
        ...series,
        // Explicitly preserve metadata from favorites if API returns empty values
        genres_str: series.genres_str || apiSeries.genres_str,
        genre: series.genre || apiSeries.genre,
        director: series.director || apiSeries.director,
        actors: series.actors || apiSeries.actors,
        description: series.description || apiSeries.description,
        year: series.year || apiSeries.year,
        rating_imdb: series.rating_imdb || apiSeries.rating_imdb,
        rating_kinopoisk: series.rating_kinopoisk || apiSeries.rating_kinopoisk,
        country: series.country || apiSeries.country,
      }
    : series;
  const episodes = seriesInfo?.episodes || [];
  const seasons = seriesInfo?.seasons || [];

  // Prefetch stream URL for all episodes when data loads
  const prefetchStream = usePrefetchSeriesStream(client);
  useEffect(() => {
    if (episodes.length > 0) {
      // Prefetch all episodes with delay to avoid server overload
      episodes.forEach((episode, index) => {
        if (episode?.cmd) {
          setTimeout(() => {
            prefetchStream(episode);
          }, index * 500); // 500ms delay between each prefetch
        }
      });
    }
  }, [episodes, prefetchStream]);

  // Set first available season after loading data
  useEffect(() => {
    if (seasons.length > 0 && !seasons.includes(selectedSeason)) {
      setSelectedSeason(seasons[0]);
    }
  }, [seasons, selectedSeason]);

  const isFavorite = favorites.some(
    (f) => f.type === 'series' && f.item_id.replace(/\.0$/, '') === String(series.id).replace(/\.0$/, '')
  );

  // Group episodes by season
  const episodesBySeason = useMemo(() => {
    const grouped: Record<string, StalkerVOD[]> = {};

    episodes.forEach((ep: StalkerVOD) => {
      const season = String(ep.season || '1');
      if (!grouped[season]) grouped[season] = [];
      grouped[season].push(ep);
    });

    // Sort episodes within season
    Object.keys(grouped).forEach((season) => {
      grouped[season].sort((a, b) => {
        const epA = Number.parseInt(String(a.episode) || '0');
        const epB = Number.parseInt(String(b.episode) || '0');
        return epA - epB;
      });
    });

    return grouped;
  }, [episodes]);

  const currentEpisodes = episodesBySeason[selectedSeason] || [];

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getEpisodeCountText = (count: number): string => {
    if (count === 1) return t('episode').toLowerCase();
    if (count >= 2 && count <= 4) return t('episodes_2_4');
    return t('episodes_5_plus');
  };

  const handleEpisodePlay = (episode: StalkerVOD) => {
    const savedPos = getPosition(String(episode.id));
    const watchStatus = getWatchStatus(String(episode.id));
    
    if (savedPos > 30 || (watchStatus === 'in_progress' && savedPos > 0)) {
      setSelectedEpisode(episode);
      setResumePosition(savedPos);
      setShowResumeDialog(true);
    } else {
      onPlay(episode, 0);
    }
  };

  const handlePlayFromStart = () => {
    if (selectedEpisode) {
      clearPosition(String(selectedEpisode.id));
      setShowResumeDialog(false);
      onPlay(selectedEpisode, 0);
    }
  };

  const handleResume = () => {
    if (selectedEpisode) {
      setShowResumeDialog(false);
      onPlay(selectedEpisode, resumePosition);
    }
  };

  const handlePosterClick = () => {
    handlePlayFirstEpisode();
  };

  const handlePlayFirstEpisode = () => {
    // Collect all episodes from all seasons
    const allEpisodes: StalkerVOD[] = [];
    Object.keys(episodesBySeason).forEach((season) => {
      allEpisodes.push(...episodesBySeason[season]);
    });

    if (allEpisodes.length === 0) {
      return;
    }

    // Sort by season (ascending) and episode number (ascending) to find the first episode
    const sortedEpisodes = [...allEpisodes].sort((a, b) => {
      const seasonA = Number.parseInt(String(a.season) || '0');
      const seasonB = Number.parseInt(String(b.season) || '0');
      const episodeA = Number.parseInt(String(a.episode) || '0');
      const episodeB = Number.parseInt(String(b.episode) || '0');

      if (seasonA !== seasonB) {
        return seasonA - seasonB; // Lower season first
      }
      return episodeA - episodeB; // Lower episode first within the same season
    });

    const firstEpisode = sortedEpisodes[0];

    // Update selected season to match the episode's season
    const episodeSeason = String(firstEpisode.season || '1');
    if (seasons.includes(episodeSeason)) {
      setSelectedSeason(episodeSeason);
    }

    handleEpisodePlay(firstEpisode);
  };

  const handleToggleFavorite = () => {
    const posterUrl = fullSeries.poster || fullSeries.logo || '';
    const seriesId = String(fullSeries.id);
    toggleItemFavorite('series', seriesId, {
      name: fullSeries.name,
      poster: posterUrl,
      cmd: fullSeries.cmd,
      extra: {
        description: fullSeries.description,
        rating_imdb: fullSeries.rating_imdb,
        rating_kinopoisk: fullSeries.rating_kinopoisk,
        director: fullSeries.director,
        actors: fullSeries.actors,
        year: fullSeries.year,
        genres_str: fullSeries.genres_str,
        country: fullSeries.country,
      },
    });
  };

  return (
    <>
      <div ref={containerRef} className="flex-1 overflow-y-auto" data-tv-container="main">
        <div className="max-w-7xl 3xl:max-w-8xl 4ktv:max-w-[2400px] mx-auto p-4 sm:p-6 lg:p-8 4ktv:p-12">
          {/* Header z przyciskiem wstecz po prawej */}
          <div className="flex items-start justify-between mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl 3xl:text-5xl 4ktv:text-6xl font-bold text-white pr-4 sm:pr-8">{fullSeries.name}</h1>
            <button
              data-tv-focusable
              data-tv-id="series-back-btn"
              data-tv-group="series-actions"
              data-tv-initial
              tabIndex={0}
              onClick={onBack}
              className="flex items-center justify-center w-10 h-10 bg-slate-800/80 hover:bg-slate-700/80 rounded-full text-white transition-all backdrop-blur-sm flex-shrink-0"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          {/* Netflix Style Layout - Poster left, info right */}
          <div className="flex flex-col md:flex-row gap-4 sm:gap-6 lg:gap-6 4ktv:gap-16 mb-6 sm:mb-10">
            {/* Poster with Play Button */}
            <div className="flex-shrink-0 w-40 sm:w-52 md:w-60 lg:w-64 3xl:w-72 4ktv:w-[480px]">
              <div className="relative rounded-lg overflow-hidden group cursor-pointer"
                   data-tv-focusable
                   data-tv-id="series-poster"
                   data-tv-group="series-actions"
                   tabIndex={0}
                   onClick={handlePosterClick}>
                {fullSeries.poster ? (
                  <img
                    src={fullSeries.poster}
                    alt={fullSeries.name}
                    className="w-full aspect-[2/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-slate-800 flex items-center justify-center">
                    <span className="text-6xl">📺</span>
                  </div>
                )}
                {/* Play Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-black fill-black ml-1" />
                  </div>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="flex-1">
              <SeriesMetadata
                fullSeries={fullSeries}
                seriesInfo={seriesInfo}
                seasons={seasons}
                episodes={episodes}
                t={t}
                getEpisodeCountText={getEpisodeCountText}
              />

              {/* Buttons */}
              <div className="flex flex-wrap gap-3 sm:gap-4 mt-4 sm:mt-6">
                {episodes.length > 0 && (
                  <button
                    data-tv-focusable
                    data-tv-id="series-play-first"
                    data-tv-group="series-actions"
                    tabIndex={0}
                    onClick={handlePlayFirstEpisode}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-white hover:bg-slate-100 rounded-lg text-slate-900 font-semibold transition-colors text-sm sm:text-base"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    {t('playFirstEpisode')}
                  </button>
                )}
                <button
                  data-tv-focusable
                  data-tv-id="series-favorite-btn"
                  data-tv-group="series-actions"
                  tabIndex={0}
                  onClick={handleToggleFavorite}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors text-sm sm:text-base"
                >
                  <Heart className={isFavorite ? 'fill-red-500 text-red-500 w-5 h-5' : 'w-5 h-5'} />
                  {isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
                </button>
              </div>
            </div>
          </div>

          {/* Episodes Section */}
          <div>
          {/* Header with season selector */}
          <div className="flex flex-col sm:flex-row items-start sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl 3xl:text-3xl font-bold text-white">{t('episodes')}</h2>
            <SeasonSelector
              seasons={seasons}
              selectedSeason={selectedSeason}
              episodesBySeason={episodesBySeason}
              t={t}
              getEpisodeCountText={getEpisodeCountText}
              onSeasonChange={setSelectedSeason}
            />
          </div>

          <EpisodeList
            currentEpisodes={currentEpisodes}
            selectedSeason={selectedSeason}
            fullSeries={fullSeries}
            episodesLoading={episodesLoading}
            t={t}
            getPosition={getPosition}
            getWatchStatus={getWatchStatus}
            handleEpisodePlay={handleEpisodePlay}
          />
          </div>
        </div>
      </div>

      <ResumeDialog
        showResumeDialog={showResumeDialog}
        selectedEpisode={selectedEpisode}
        resumePosition={resumePosition}
        t={t}
        formatTime={formatTime}
        onPlayFromStart={handlePlayFromStart}
        onResume={handleResume}
        onClose={() => setShowResumeDialog(false)}
      />
    </>
  );
};






