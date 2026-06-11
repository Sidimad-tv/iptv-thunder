import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { M3uAccount, M3uChannel, M3uContentType, M3uCategory } from './m3u.types';
import { useM3uStore } from '@/store/m3u.store';
import { usePlaybackStore } from '@/store/playback.store';
import { Search, RefreshCw, Loader2, Heart, ImageOff } from 'lucide-react';

interface M3uChannelListProps {
  account: M3uAccount;
  onClose: () => void;
  page?: boolean;
  contentTypeFilter?: M3uContentType;
  defaultFavoritesOnly?: boolean;
}

const FAV_KEY_PREFIX = 'm3u-favorites-';
const getFavKey = (accountId: string) => `${FAV_KEY_PREFIX}${accountId}`;
const loadFavorites = (accountId: string): Set<string> => {
  try { return new Set<string>(JSON.parse(localStorage.getItem(getFavKey(accountId)) || '[]')); }
  catch { return new Set<string>(); }
};
const saveFavorites = (accountId: string, favs: Set<string>) => {
  localStorage.setItem(getFavKey(accountId), JSON.stringify(Array.from(favs)));
};

const CARD_HEIGHT = 96;
const ROW_GAP = 12;

function LogoImage({ src, name }: { src: string; name: string }) {
  const [loaded, setLoaded] = React.useState(false);
  const [err, setErr] = React.useState(false);
  useEffect(() => {
    if (!src) { setErr(true); return; }
    setLoaded(false);
    setErr(false);
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setErr(true);
    img.src = src;
  }, [src]);
  if (err || !src) return <div className="w-8 h-8 rounded bg-slate-700/50 flex items-center justify-center"><ImageOff className="w-4 h-4 text-slate-500" /></div>;
  if (!loaded) return <div className="w-8 h-8 rounded bg-slate-700/50 animate-pulse" />;
  return <img src={src} alt={name} className="w-8 h-8 rounded object-cover" loading="lazy" />;
}

interface ChannelCardProps {
  channel: M3uChannel;
  isFavorite: boolean;
  onPlay: (ch: M3uChannel) => void;
  onToggleFavorite: (ch: M3uChannel) => void;
}

const ChannelCard = React.memo<ChannelCardProps>(({ channel: ch, isFavorite, onPlay, onToggleFavorite }) => (
  <div
    tabIndex={0}
    onClick={() => onPlay(ch)}
    className="h-24 p-2 rounded-lg cursor-pointer bg-slate-800/30 hover:bg-slate-700/50 hover:border-green-700 transition-colors focus:bg-slate-700/50 focus:border-green-700 backdrop-blur-sm border border-transparent flex flex-col gap-1 overflow-hidden"
  >
    <div className="flex items-center gap-2 min-w-0">
      <LogoImage src={ch.logo} name={ch.name} />
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-xs text-white truncate leading-tight">{ch.name}</h3>
        <span className="text-[10px] text-slate-500 truncate block">{ch.group}</span>
      </div>
      <button
        tabIndex={-1}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(ch); }}
        className="flex-shrink-0 p-0.5"
      >
        {isFavorite ? (
          <Heart className="w-3 h-3 text-pink-400 fill-pink-400" />
        ) : (
          <Heart className="w-3 h-3 text-slate-500 hover:text-pink-400" />
        )}
      </button>
    </div>
    <span className="text-[10px] text-cyan-400/70 truncate">{ch.streamUrl.length > 50 ? ch.streamUrl.substring(0, 50) + '...' : ch.streamUrl}</span>
  </div>
));

ChannelCard.displayName = 'ChannelCard';

export const M3uChannelList: React.FC<M3uChannelListProps> = ({ account, onClose, page, contentTypeFilter, defaultFavoritesOnly }) => {
  const [allChannels, setAllChannels] = useState<M3uChannel[]>([]);
  const [categories, setCategories] = useState<M3uCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites(account.id));
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [columns, setColumns] = useState(4);

  const storeLoadChannels = useM3uStore(s => s.loadChannels);
  const invalidateCache = useM3uStore(s => s.invalidateCache);

  useEffect(() => {
    setShowFavoritesOnly(defaultFavoritesOnly ?? false);
    if (defaultFavoritesOnly || contentTypeFilter) setActiveGroup('*');
  }, [defaultFavoritesOnly, contentTypeFilter]);

  const loadData = useCallback(async (forceRefresh: boolean) => {
    setLoading(true);
    setError(null);
    try {
      if (forceRefresh) invalidateCache(account.id);
      const result = await storeLoadChannels(account.id, forceRefresh);
      setAllChannels(result.channels);
      setCategories(result.categories);
      if (!contentTypeFilter && !defaultFavoritesOnly) {
        const firstCatId = result.categories[1]?.id || '*';
        setActiveGroup(firstCatId);
      } else {
        setActiveGroup('*');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, [account.id, storeLoadChannels, invalidateCache, contentTypeFilter, defaultFavoritesOnly]);

  useEffect(() => { loadData(false); }, [loadData]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w < 480) setColumns(2);
        else if (w < 640) setColumns(3);
        else if (w < 800) setColumns(4);
        else if (w < 1024) setColumns(5);
        else setColumns(6);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleGroupChange = useCallback((groupId: string) => {
    setActiveGroup(groupId);
    setSearch('');
  }, []);

  const toggleFavorite = useCallback((ch: M3uChannel) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(ch.id)) next.delete(ch.id);
      else next.add(ch.id);
      saveFavorites(account.id, next);
      return next;
    });
  }, [account.id]);

  const channels = useMemo(() => {
    let result = allChannels;
    if (activeGroup && activeGroup !== '*' && !contentTypeFilter && !defaultFavoritesOnly) {
      const groupName = activeGroup.replace(/^cat-/, '');
      result = result.filter((ch) => ch.group === groupName);
    }
    if (contentTypeFilter) {
      result = result.filter((ch) => ch.contentType === contentTypeFilter);
    }
    return result;
  }, [allChannels, activeGroup, contentTypeFilter, defaultFavoritesOnly]);

  const filteredChannels = useMemo(() => {
    let result = channels;
    const s = search.toLowerCase();
    if (s) result = result.filter((ch) => ch.name.toLowerCase().includes(s));
    if (showFavoritesOnly) result = result.filter((ch) => favorites.has(ch.id));
    return result;
  }, [channels, search, showFavoritesOnly, favorites]);

  const handlePlay = useCallback((ch: M3uChannel) => {
    usePlaybackStore.getState().setMedia({
      url: ch.streamUrl,
      name: ch.name,
      isVod: ch.contentType === 'movie' || ch.contentType === 'series',
    });
  }, []);

  const handleRefresh = () => loadData(true);

  const totalItems = filteredChannels.length;
  const rowHeight = CARD_HEIGHT + ROW_GAP;
  const rows = Math.ceil(totalItems / columns);

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const endRow = Math.min(rows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 2);

  const visibleChannels = useMemo(() => {
    const start = startRow * columns;
    const end = Math.min(endRow * columns, totalItems);
    return filteredChannels.slice(start, end);
  }, [filteredChannels, startRow, endRow, columns, totalItems]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const showCategories = categories.length > 0 && !contentTypeFilter && !defaultFavoritesOnly;

  return (
    <div className={page ? '' : "fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4"}>
      <div ref={containerRef} className={page ? 'w-full h-full flex flex-col min-h-0' : "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700/50"}>
        <div className="flex items-center justify-between p-3 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="p-1.5 hover:bg-slate-700/50 text-slate-300 rounded-lg transition-colors shrink-0" title="Back to M3U playlists">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">{account.name}</h2>
              <p className="text-[11px] text-slate-400">{allChannels.length.toLocaleString()} channels</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`p-1.5 rounded-lg transition-colors ${showFavoritesOnly ? 'bg-pink-500/30 text-pink-300 border border-pink-400/30' : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-300'}`}
              title={showFavoritesOnly ? 'Show all channels' : 'Show favorites only'}
            >
              <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            </button>
            <button onClick={handleRefresh} disabled={loading} className="p-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-colors disabled:opacity-50" title="Reload">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {showCategories && (
          <div className="flex overflow-x-auto gap-1 px-3 pt-3 pb-0 shrink-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleGroupChange(cat.id)}
                className={`px-2.5 py-1 text-[11px] rounded-t-md whitespace-nowrap transition-colors shrink-0 ${
                  activeGroup === cat.id ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>
        )}

        <div className="p-3 pb-2 border-b border-slate-700/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
          </div>
        </div>

        {error && (
          <div className="mx-3 mt-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 shrink-0">
            {error}
            <button onClick={handleRefresh} className="ml-2 underline hover:text-red-300">Retry</button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 shrink-0">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading...</span>
          </div>
        )}

        {!loading && !error && (
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
            {totalItems === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm">
                {search ? 'No matches' : (showFavoritesOnly ? 'No favorites yet' : 'No channels found')}
              </div>
            ) : (
              <div className="p-3" style={{ height: rows * rowHeight, position: 'relative' }}>
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    position: 'absolute',
                    top: 0,
                    left: 3,
                    right: 3,
                    transform: `translateY(${startRow * rowHeight}px)`,
                  }}
                >
                  {visibleChannels.map((ch) => (
                    <ChannelCard
                      key={ch.id}
                      channel={ch}
                      isFavorite={favorites.has(ch.id)}
                      onPlay={handlePlay}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!page && <div className="p-2 border-t border-slate-700/50 text-center text-[11px] text-slate-600 shrink-0">Click any channel to play</div>}
      </div>
    </div>
  );
};
