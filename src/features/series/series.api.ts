// =========================
// 📺 SERIES API
// =========================
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerVOD, StalkerGenre } from '@/types';

// Private helper functions
function parseResponse(client: StalkerClient, response: any): any[] {
  return client.useTauri
    ? response?.js?.data ?? response?.js ?? []
    : response.data?.js?.data ?? response.data?.js ?? [];
}

function mapSeries(client: StalkerClient, items: StalkerVOD[]): StalkerVOD[] {
  return items.map(s => ({
    ...s,
    logo:   client.resolveLogoUrl(s.logo),
    poster: client.resolvePosterUrl(s),
  }));
}

function normalizeSeriesId(rawId: string): string {
  if (!rawId) return rawId;

  // "28997:28997" → "28997"
  if (rawId.includes(':')) {
    const parts = rawId.split(':');

    // najczęściej poprawne jest DRUGIE
    return parts[1] || parts[0];
  }

  return rawId;
}

export const getSeries = async (
  client: StalkerClient,
  categoryId: string = '',
  page: number = 1
): Promise<StalkerVOD[]> => {
  if (!client.token) {
    await client.handshake();
  }

  const account = client.getAccount();
  const params: any = {
    type: 'series',
    action: 'get_ordered_list',
    p: page.toString(),
    sortby: 'added',
    hd: '0',
    mac: account.mac,
    JsHttpRequest: '1-xml',
  };

  if (categoryId && categoryId !== '*' && categoryId !== '') {
    params.category = categoryId;
  }

  const response = await client._makeRequest(params);

  const items = parseResponse(client, response);

  return mapSeries(client, items);
};

export const getSeriesWithPagination = async (
  client: StalkerClient,
  categoryId: string = '',
  page: number = 1,
  signal?: AbortSignal,
  search?: string,
): Promise<{
  items: StalkerVOD[];
  totalItems: number;
  maxPageItems: number;
  currentPage: number;
  hasMore: boolean;
}> => {
  if (!client.token) {
    await client.handshake();
  }

  const account = client.getAccount();
  const params: any = {
    type: 'series',
    action: 'get_ordered_list',
    p: page.toString(),
    sortby: 'added',
    hd: '0',
    mac: account.mac,
    JsHttpRequest: '1-xml',
    max_page_items: '100',
  };

  if (categoryId && categoryId !== '*' && categoryId !== '') {
    params.category = categoryId;
  }

  if (search && search.trim()) {
    params.search = search.trim();
  }

  const response = await client._makeRequest(params, signal);

  const items = parseResponse(client, response);

  const totalItems = (client.useTauri ? response?.js?.total_items : response.data?.js?.total_items) ?? 0;
  const maxPageItems = (client.useTauri ? response?.js?.max_page_items : response.data?.js?.max_page_items) ?? 30;
  const currentPage = client.useTauri
    ? response?.js?.cur_page
    : response.data?.js?.cur_page || page;

  const totalPages = Math.ceil(totalItems / maxPageItems);
  const hasMore = currentPage < totalPages;

  return {
    items: mapSeries(client, items),
    totalItems,
    maxPageItems,
    currentPage,
    hasMore,
  };
};

export const getSeriesCategories = async (
  client: StalkerClient
): Promise<StalkerGenre[]> => {
  if (!client.token) {
    await client.handshake();
  }

  const account = client.getAccount();
  const params = {
    type: 'series',
    action: 'get_categories',
    mac: account.mac,
    JsHttpRequest: '1-xml',
  };

  const response = await client._makeRequest(params);
  const js = client.useTauri ? response?.js : response.data?.js;
  return Array.isArray(js) ? js : (js?.data || []);
};

export const getSeriesDetails = async (client: StalkerClient, seriesId: string): Promise<StalkerVOD> => {
  return client.getVODDetails(seriesId);
};

export const getSeriesInfo = async (
  client: StalkerClient,
  seriesId: string
): Promise<{
  series: StalkerVOD;
  seasons: string[];
  episodes: StalkerVOD[];
}> => {

  await client.ensureAuthenticated();

  const normalizedId = normalizeSeriesId(seriesId);

  const account = client.getAccount();

  // Primary: use get_ordered_list with movie_id (matches MAG box behavior)
  const response = await client._makeRequest({
    type: 'series',
    action: 'get_ordered_list',
    movie_id: normalizedId,
    mac: account.mac,
    JsHttpRequest: '1-xml',
  });

  const data = client.useTauri ? response?.js : response.data?.js;

  let seriesInfo = data?.series || {};
  let episodesList: any[] = [];

  // Extract episodes from data.data array
  if (Array.isArray(data?.data)) {
    episodesList = data.data;
    // If no series info but data has items, extract series metadata from first item
    if (!seriesInfo?.name && data.data.length > 0) {
      const firstItem = data.data[0];
      seriesInfo = {
        id: firstItem.id,
        name: firstItem.name,
        description: firstItem.description,
        genres_str: firstItem.genres_str,
        genre: firstItem.genre,
        director: firstItem.director,
        actors: firstItem.actors,
        year: firstItem.year,
        rating_imdb: firstItem.rating_imdb,
        rating_kinopoisk: firstItem.rating_kinopoisk,
        country: firstItem.country,
        logo: firstItem.screenshot_uri || firstItem.logo,
        poster: firstItem.screenshot_uri || firstItem.poster,
      };
    }
  } else if (data?.data && typeof data.data === 'object') {
    episodesList = Object.values(data.data);
  }

  // Fallback: try get_series_info if no episodes
  if (episodesList.length === 0) {
    const fallback = await client._makeRequest({
      type: 'series',
      action: 'get_series_info',
      series_id: normalizedId,
      movie_id: normalizedId,
      mac: account.mac,
      JsHttpRequest: '1-xml',
    });

    const fallbackData = client.useTauri ? fallback?.js : fallback.data?.js;

    if (Array.isArray(fallbackData?.episodes)) {
      episodesList = fallbackData.episodes;
    } else if (fallbackData?.episodes && typeof fallbackData.episodes === 'object') {
      episodesList = Object.values(fallbackData.episodes).flat();
    }

    if (!seriesInfo?.name && fallbackData?.series) {
      seriesInfo = fallbackData.series;
    }
  }

  // normalize - handle series array format from get_ordered_list
  const normalizedEpisodes: any[] = [];
  episodesList.forEach((ep: any) => {
    if (Array.isArray(ep.series) && ep.series.length > 0) {
      // Create individual episode for each number in series array
      ep.series.forEach((epNum: number) => {
        normalizedEpisodes.push({
          ...ep,
          id: `${ep.id}:ep${epNum}`, // Unique ID for each episode
          season: ep.name?.match(/Season\s*(\d+)/i)?.[1] || '1',
          episode: String(epNum),
        });
      });
    } else {
      // Fallback for single entries
      normalizedEpisodes.push({
        ...ep,
        season: ep.season ?? ep.season_num ?? ep.name?.match(/Season\s*(\d+)/i)?.[1] ?? '1',
        episode: ep.episode ?? ep.series_number ?? '1',
      });
    }
  });
  episodesList = normalizedEpisodes;

  const seasonsSet = new Set<string>();
  episodesList.forEach((ep: any) => {
    if (ep.season) seasonsSet.add(String(ep.season));
  });

  const seasons = Array.from(seasonsSet).sort(
    (a, b) => Number.parseInt(a) - Number.parseInt(b)
  );

  if (seasons.length === 0 && episodesList.length > 0) {
    seasons.push('1');
  }

  return {
    series: {
      ...seriesInfo,
      logo: client.resolveLogoUrl(seriesInfo?.logo),
      poster: client.resolvePosterUrl(seriesInfo),
    },
    seasons,
    episodes: episodesList.map((ep: any) => {
      const posterUrl = client.resolvePosterUrl(ep);
      return {
        ...ep,
        logo: client.resolveLogoUrl(ep.logo),
        poster: posterUrl,
        screenshot: posterUrl,
      };
    }),
  };
};

export const getSeriesStream = async (client: StalkerClient, cmd: string, episodeNum?: string | number): Promise<string> => {
  return client.getEpisodeStream(cmd, episodeNum || '1');
};

// Group episodes by season
export const groupEpisodesBySeason = (episodes: StalkerVOD[]): Record<string, StalkerVOD[]> => {
  const grouped: Record<string, StalkerVOD[]> = {};
  
  episodes.forEach(episode => {
    const season = episode.season || 'Unknown';
    if (!grouped[season]) {
      grouped[season] = [];
    }
    grouped[season].push(episode);
  });
  
  // Sort episodes within each season
  Object.keys(grouped).forEach(season => {
    grouped[season].sort((a, b) => {
      const episodeA = Number.parseInt(String(a.episode ?? 0));
      const episodeB = Number.parseInt(String(b.episode) || '0');
      return episodeA - episodeB;
    });
  });
  
  return grouped;
};
