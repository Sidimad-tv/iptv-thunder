// Backward compatibility re-export
// Use useTypedRouter for new code
export {
  useTypedRouter as useAppRouter,
  type Route,
  type SimpleRoute,
  type ParamRoute,
  isMovieDetails,
  isSeriesDetails,
  getRouteType,
  isRouteType,
} from './useTypedRouter';
