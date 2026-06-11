import { useEffect, useRef } from 'react';
import { useM3uStore } from '@/store/m3u.store';

export function useM3uWarmup() {
  const ran = useRef(false);
  const accounts = useM3uStore(s => s.accounts);
  const activeM3uId = useM3uStore(s => s.activeM3uId);
  const loadChannels = useM3uStore(s => s.loadChannels);

  useEffect(() => {
    if (ran.current) return;
    if (!activeM3uId) return;
    ran.current = true;
    const warm = async () => {
      try {
        await loadChannels(activeM3uId);
      } catch {
        // warmup is best-effort
      }
      // Also preload other accounts in background
      for (const acct of accounts) {
        if (acct.id !== activeM3uId) {
          loadChannels(acct.id).catch(() => {});
        }
      }
    };
    warm();
  }, [accounts, activeM3uId, loadChannels]);
}
