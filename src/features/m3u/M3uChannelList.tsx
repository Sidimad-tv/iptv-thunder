import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { M3uAccount, M3uChannel, M3uContentType, M3uCategory } from './m3u.types';
import { useM3uStore } from '@/store/m3u.store';
import { usePlaybackStore } from '@/store/playback.store';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ChannelLogo } from '@/features/tv/ChannelLogo';

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

export const M3uChannelList: React.FC<M3uChannelListProps> = ({ account, onClose, page, contentTypeFilter, defaultFavoritesOnly }) => {
  const [allChannels, setAllChannels] = useState<M3uChannel[]>([]);
  const [categories, setCategories] = useState<M3uCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites(account.id));
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

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
      const result = await storeLoadChannels(account.id);
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

  const handlePlay = (ch: M3uChannel) => {
    usePlaybackStore.getState().setMedia({
      url: ch.streamUrl,
      name: ch.name,
      isVod: ch.contentType === 'movie' || ch.contentType === 'series',
    });
  };

  const handleRefresh = () => loadData(true);

  return (
    <div className={page ? '' : "fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4"}>
      <div className={page ? 'w-full h-full flex flex-col min-h-0' : "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700/50"}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="p-2 hover:bg-slate-700/50 text-slate-300 rounded-lg transition-colors flex items-center gap-1 text-sm flex-shrink-0" title="Back to M3U playlists">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{account.name}</h2>
              <p className="text-xs text-slate-400">{allChannels.length} channels{contentTypeFilter ? ` (${contentTypeFilter})` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`p-2 rounded-lg transition-colors ${showFavoritesOnly ? 'bg-pink-500/30 text-pink-300 border border-pink-400/30' : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-300'}`}
              title={showFavoritesOnly ? 'Show all channels' : 'Show favorites only'}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            </button>
            <button onClick={handleRefresh} disabled={loading} className="p-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-colors disabled:opacity-50" title="Reload">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {categories.length > 0 && !contentTypeFilter && !defaultFavoritesOnly && (
          <div className="flex overflow-x-auto gap-1 p-4 pb-0 border-b border-slate-700/50">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleGroupChange(cat.id)}
                className={`px-3 py-1.5 text-xs rounded-t-lg whitespace-nowrap transition-colors ${
                  activeGroup === cat.id ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 border-b border-slate-700/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search channels..." className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
            <button onClick={handleRefresh} className="ml-2 underline hover:text-red-300">Retry</button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading channels...</span>
          </div>
        )}

        {!loading && !error && (
          <div className="flex-1 overflow-y-auto p-4">
            {filteredChannels.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                {search ? 'No channels match your search' : (showFavoritesOnly ? 'No favorites yet. Click the heart icon on a channel to add it.' : 'No channels found')}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 min-w-0 overflow-hidden">
                {filteredChannels.map((ch, idx) => (
                  <motion.div
                    key={ch.id}
                    data-tv-focusable data-tv-id={`m3u-channel-${ch.id}`} data-tv-group="m3u-channels"
                    data-tv-index={idx} data-tv-initial={idx === 0}
                    tabIndex={0}
                    onClick={() => handlePlay(ch)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 1.5) }}
                    whileHover={{ scale: 1.05, y: -4, boxShadow: '0 10px 40px rgba(34, 197, 94, 0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    className="p-2 rounded-lg cursor-pointer dark:bg-slate-800/30 bg-gray-100/30 dark:hover:bg-slate-700/50 hover:bg-gray-200/50 dark:hover:border-green-700 hover:border-green-700 transition-all dark:focus:bg-slate-700/50 focus:bg-gray-200/50 dark:focus:border-green-700 focus:border-green-700 backdrop-blur-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm dark:text-white text-slate-900 truncate">{ch.name}</h3>
                      </div>
                      <motion.button
                        tabIndex={-1}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(ch); }}
                        whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                        className="ml-2 text-lg"
                      >
                        <motion.span animate={favorites.has(ch.id) ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3 }}>
                          {favorites.has(ch.id) ? '❤️' : '🤍'}
                        </motion.span>
                      </motion.button>
                    </div>
                    {!!ch.logo && <ChannelLogo logo={ch.logo} name={ch.name} />}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {!page && <div className="p-3 border-t border-slate-700/50 text-center text-xs text-slate-600">Click any channel to play</div>}
      </div>
    </div>
  );
};
