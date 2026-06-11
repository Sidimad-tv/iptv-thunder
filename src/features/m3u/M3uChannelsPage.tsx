import React from 'react';
import { useM3uStore } from '@/store/m3u.store';
import { M3uChannelList } from './M3uChannelList';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import type { M3uContentType } from './m3u.types';

interface M3uChannelsPageProps {
  contentTypeFilter?: M3uContentType;
  defaultFavoritesOnly?: boolean;
}

export const M3uChannelsPage: React.FC<M3uChannelsPageProps> = ({ contentTypeFilter, defaultFavoritesOnly }) => {
  const activeM3uId = useM3uStore(s => s.activeM3uId);
  const account = useM3uStore(
    s => activeM3uId ? s.accounts.find(a => a.id === activeM3uId) ?? null : null
  );
  const { navigate } = useTypedRouter();

  if (!account) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Active Playlist</h2>
          <p className="text-slate-400 mb-4">Select an M3U playlist to view its channels.</p>
        </div>
      </div>
    );
  }

  return <M3uChannelList account={account} onClose={() => navigate({ type: 'm3u' })} page contentTypeFilter={contentTypeFilter} defaultFavoritesOnly={defaultFavoritesOnly} />;
};
