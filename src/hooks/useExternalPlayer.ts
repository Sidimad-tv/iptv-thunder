import { invoke } from '@tauri-apps/api/core';
import { getSetting } from './useSettings';

const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export async function launchExternalPlayer(
  url: string,
  name?: string
): Promise<void> {
  if (!isTauri) {
    window.open(url, '_blank');
    return;
  }

  const savedPath = await getSetting('vlcPath').catch(() => '');
  const program = savedPath || 'vlc';
  await invoke('launch_process', {
    program,
    args: ['--started-from-file', url, '--meta-title', name || 'IPTV Stream'],
  });
}
