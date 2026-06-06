// =========================
// 🔌 TV API (Simplified)
// =========================
import { StalkerClient } from '@/lib/stalkerAPI_new';
import { StalkerGenre, StalkerChannel } from '@/types';


export async function getGenres(client: StalkerClient): Promise<StalkerGenre[]> {
  await client.ensureAuthenticated();

  const response = await (client as any)._makeRequest({
    type: 'itv',
    action: 'get_genres',
    JsHttpRequest: '1-xml',
  });

  const useTauri = client.useTauri;
  const genres: StalkerGenre[] = useTauri ? response?.js : response.data?.js || [];

  if (!genres.some(g => g.id === '*')) {
    const allGenre: StalkerGenre = { id: '*', title: 'Wszystkie kanały' };
    return [allGenre, ...genres];
  }
  return genres;
}

export interface GetChannelsOptions {
  category?: string;
  genre?: string;
  page?: number;
  sortby?: 'added' | 'number' | 'name';
  signal?: AbortSignal;
}

export interface GetChannelsResult {
  channels: StalkerChannel[];
  totalItems: number;
  maxPageItems: number;
  currentPage: number;
  hasMore: boolean;
}

export const getChannels = async (
  client: StalkerClient,
  options: GetChannelsOptions = {}
): Promise<GetChannelsResult> => {
  const {
    category = '*',
    genre = category,
    page = 1,
    sortby = 'added',
    signal
  } = options;

  await client.ensureAuthenticated();

  const params: any = {
    action: 'get_ordered_list',
    type: 'itv',
    sortby,
    p: page.toString(),
    category,
    genre,
    JsHttpRequest: '1-xml',
  };

  const response = await (client as any)._makeRequest(params, signal);

  const useTauri = client.useTauri;
  const data = useTauri
    ? (response?.js?.data || [])
    : (response.data?.js?.data as StalkerChannel[] || []);
  const totalItems = useTauri
    ? (response?.js?.total_items || 0)
    : (response.data?.js?.total_items || 0);
  const maxPageItems = useTauri
    ? (response?.js?.max_page_items || 30)
    : (response.data?.js?.max_page_items || 30);
  const currentPage = page - 1;
  const totalPages = Math.ceil(totalItems / maxPageItems);
  const hasMore = currentPage < totalPages - 1 && data.length > 0;

  const resolveLogoUrl = (logo: string | undefined): string | undefined => {
    if (!logo) return undefined;
    if (logo.startsWith('http')) return logo;
    const portalUrl = client.getAccount().portalUrl;
    const baseUrl = portalUrl.endsWith('/') ? portalUrl : portalUrl + '/';
    return `${baseUrl}misc/logos/${logo}`;
  };

  return {
    channels: data.map((ch: StalkerChannel) => ({
      ...ch,
      logo: resolveLogoUrl(ch.logo),
    })),
    totalItems,
    maxPageItems,
    currentPage,
    hasMore,
  };
};
