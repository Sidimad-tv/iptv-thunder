import React, { Suspense, lazy } from 'react';
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerGenre, StalkerVOD, StalkerChannel } from '@/types';
import { Route, isMovieDetails, isSeriesDetails } from '@/hooks/useTypedRouter';
import { PortalAccount } from '@/features/portals/portals.types';

// Lazy load components
const TVList = lazy(() => import('@/features/tv/TVList').then(module => ({ default: module.TVList })));
const MovieList = lazy(() => import('@/features/movies/MovieList').then(module => ({ default: module.MovieList })));
const MovieDetails = lazy(() => import('@/features/movies/MovieDetails').then(module => ({ default: module.MovieDetails })));
const SeriesList = lazy(() => import('@/features/series/SeriesList').then(module => ({ default: module.SeriesList })));
const SeriesDetails = lazy(() => import('@/features/series/SeriesDetails').then(module => ({ default: module.SeriesDetails })));
const PortalsPage = lazy(() => import('@/features/portals/PortalsPage'));
const ChannelCategoriesList = lazy(() => import('@/features/tv/ChannelCategoriesList').then(module => ({ default: module.ChannelCategoriesList })));
const FavoriteCategoriesList = lazy(() => import('@/features/tv/FavoriteCategoriesList').then(module => ({ default: module.FavoriteCategoriesList })));
const MovieCategoriesList = lazy(() => import('@/features/movies/MovieCategoriesList').then(module => ({ default: module.MovieCategoriesList })));
const FavoriteChannelsList = lazy(() => import('@/features/tv/FavoriteChannelsList').then(module => ({ default: module.FavoriteChannelsList })));
const FavoriteMovieCategoriesList = lazy(() => import('@/features/movies/FavoriteMovieCategoriesList').then(module => ({ default: module.FavoriteMovieCategoriesList })));
const FavoriteMoviesList = lazy(() => import('@/features/movies/FavoriteMoviesList').then(module => ({ default: module.FavoriteMoviesList })));
const SeriesCategoriesList = lazy(() => import('@/features/series/SeriesCategoriesList').then(module => ({ default: module.SeriesCategoriesList })));
const FavoriteSeriesCategoriesList = lazy(() => import('@/features/series/FavoriteSeriesCategoriesList').then(module => ({ default: module.FavoriteSeriesCategoriesList })));
const FavoriteSeriesList = lazy(() => import('@/features/series/FavoriteSeriesList').then(module => ({ default: module.FavoriteSeriesList })));
const ForYouSection = lazy(() => import('@/features/personalized/ForYouSection').then(module => ({ default: module.ForYouSection })));
const M3uList = lazy(() => import('@/features/m3u/M3uList').then(module => ({ default: module.M3uList })));
const M3uChannelsPage = lazy(() => import('@/features/m3u/M3uChannelsPage').then(module => ({ default: module.M3uChannelsPage })));

interface AppContentProps {
  route: Route;
  activePortal: PortalAccount | null;
  client: StalkerClient | null;
  search: string;
  selectedCategory: StalkerGenre | null;
  handleChannelSelect: (channel: StalkerChannel) => void | Promise<void>;
  navigateToMovie: (movie: StalkerVOD) => void;
  navigateToSeries: (series: StalkerVOD) => void;
  navigateToCategory: (category: StalkerGenre) => void;
  goBack: () => void;
  handleMoviePlay: (movie: StalkerVOD, resumePosition?: number) => void;
  handleEpisodeSelect: (episode: StalkerVOD, resumePosition?: number) => void;
}

export const AppContent: React.FC<AppContentProps> = ({
  route,
  activePortal,
  client,
  search,
  selectedCategory,
  handleChannelSelect,
  navigateToMovie,
  navigateToSeries,
  navigateToCategory,
  goBack,
  handleMoviePlay,
  handleEpisodeSelect,
}) => {
  // Extract typed data from route using type guards
  const selectedMovie = isMovieDetails(route) ? route.movie : null;
  const selectedSeries = isSeriesDetails(route) ? route.series : null;

  // External pages — accessible without portal
  if (route.type === 'scb1' || route.type === 'scb2' || route.type === 'scb3' || route.type === 'imdb') {
    const pages: Record<string, string> = {
      scb1: '/1/SCB1.html',
      scb2: '/1/SCB2.html',
      scb3: '/1/SCB3.html',
      imdb: '/1/SIdimdb/index.html',
    };
    const stableKey = route.type;
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 bg-black">
          <iframe
            key={stableKey}
            src={pages[route.type]}
            className="w-full h-full border-0"
            title={route.type}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    );
  }

  // M3U pages — accessible without portal
  if (route.type === 'm3u') {
    return (
      <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading M3U Playlists...</div>}>
        <M3uList />
      </Suspense>
    );
  }

  if (route.type === 'm3u-channels') {
    return (
      <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading channels...</div>}>
        <M3uChannelsPage />
      </Suspense>
    );
  }

  if (route.type === 'm3u-movies') {
    return (
      <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading movies...</div>}>
        <M3uChannelsPage contentTypeFilter="movie" />
      </Suspense>
    );
  }

  if (route.type === 'm3u-series') {
    return (
      <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading series...</div>}>
        <M3uChannelsPage contentTypeFilter="series" />
      </Suspense>
    );
  }

  if (route.type === 'm3u-favorites') {
    return (
      <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading favorites...</div>}>
        <M3uChannelsPage defaultFavoritesOnly />
      </Suspense>
    );
  }

  if (route.type === 'm3u-categories') {
    return (
      <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading channels...</div>}>
        <M3uChannelsPage />
      </Suspense>
    );
  }

  // Show portals page if no active portal
  if (!activePortal || route.type === 'portals') {
    return (
      <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Portals...</div>}>
        <PortalsPage />
      </Suspense>
    );
  }

  // Show error if no client
  if (!client) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Connection</h2>
          <p className="text-muted-foreground">Unable to connect to the portal. Please try again.</p>
        </div>
      </div>
    );
  }

  switch (route.type) {
    case 'tv':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading TV...</div>}>
          <TVList
            client={client}
            accountId={activePortal.id}
            search={search}
            selectedCategory={selectedCategory}
            onChannelSelect={handleChannelSelect}
          />
        </Suspense>
      );
    
    case 'categories':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Categories...</div>}>
          <ChannelCategoriesList
            client={client}
            search={search}
            onCategorySelect={navigateToCategory}
          />
        </Suspense>
      );
    
    case 'favorite-categories':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Favorite Categories...</div>}>
          <FavoriteCategoriesList
            client={client}
            search={search}
            onCategorySelect={navigateToCategory}
          />
        </Suspense>
      );
    
    case 'favorite-channels':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Favorite Channels...</div>}>
          <FavoriteChannelsList
            client={client}
            accountId={activePortal.id}
            search={search}
            onChannelSelect={handleChannelSelect}
          />
        </Suspense>
      );
    
    case 'movies':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Movies...</div>}>
          <MovieList
            client={client}
            selectedCategory={selectedCategory}
            onMovieSelect={navigateToMovie}
            search={search}
          />
        </Suspense>
      );
    
    case 'movie-categories':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Movie Categories...</div>}>
          <MovieCategoriesList
            client={client}
            search={search}
            onCategorySelect={navigateToCategory}
          />
        </Suspense>
      );
    
    case 'favorite-movie-categories':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Favorite Movie Categories...</div>}>
          <FavoriteMovieCategoriesList
            client={client}
            search={search}
            onCategorySelect={navigateToCategory}
          />
        </Suspense>
      );
    
    case 'movie-details':
      return selectedMovie && client ? (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Movie Details...</div>}>
          <MovieDetails
            movie={selectedMovie}
            client={client}
            onPlay={handleMoviePlay}
            onBack={goBack}
          />
        </Suspense>
      ) : null;
    
    case 'favorite-movies':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Favorite Movies...</div>}>
          <FavoriteMoviesList
            accountId={activePortal.id}
            search={search}
            onMovieSelect={navigateToMovie}
          />
        </Suspense>
      );
    
    case 'series':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Series...</div>}>
          <SeriesList
            client={client}
            onSeriesSelect={navigateToSeries}
            selectedCategory={selectedCategory}
            search={search}
          />
        </Suspense>
      );
    
    case 'series-details':
      return selectedSeries && client ? (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Series Details...</div>}>
          <SeriesDetails
            series={selectedSeries}
            client={client}
            onPlay={handleEpisodeSelect}
            onBack={goBack}
          />
        </Suspense>
      ) : null;
    
    case 'series-categories':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Series Categories...</div>}>
          <SeriesCategoriesList
            client={client}
            search={search}
            onCategorySelect={navigateToCategory}
          />
        </Suspense>
      );
    
    case 'favorite-series-categories':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Favorite Series Categories...</div>}>
          <FavoriteSeriesCategoriesList
            client={client}
            search={search}
            onCategorySelect={navigateToCategory}
          />
        </Suspense>
      );
    
    case 'favorite-series':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading Favorite Series...</div>}>
          <FavoriteSeriesList
            accountId={activePortal.id}
            search={search}
            onSeriesSelect={navigateToSeries}
          />
        </Suspense>
      );

    case 'for-you':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading For You...</div>}>
          <ForYouSection
            client={client}
            onChannelSelect={handleChannelSelect}
            onSeriesSelect={navigateToSeries}
            onMoviePlay={handleMoviePlay}
          />
        </Suspense>
      );

    default:
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Page Not Found</h2>
            <p className="text-muted-foreground">The requested page could not be found.</p>
          </div>
        </div>
      );
  }
};
