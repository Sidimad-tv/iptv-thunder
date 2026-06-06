// =========================
// 📺 SERIES FEATURE EXPORTS
// =========================

// Components
export { SeriesList } from './SeriesList';
export { SeriesDetails } from './SeriesDetails';
export { SeriesCategoriesList } from './SeriesCategoriesList';
export { FavoriteSeriesList } from './FavoriteSeriesList';
export { FavoriteSeriesCategoriesList } from './FavoriteSeriesCategoriesList';

// Hooks
export {
  useSeries,
  useSeriesAll,
  useSeriesWithPagination,
  useSeriesCategories,
  useSeriesDetails,
  usePrefetchSeriesStream,
  useSeriesStream,
} from './series.hooks';

// API
export {
  getSeries,
  getSeriesWithPagination,
  getSeriesCategories,
  getSeriesDetails,
  getSeriesStream,
  groupEpisodesBySeason,
} from './series.api';
