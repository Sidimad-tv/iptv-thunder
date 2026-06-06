// External store for currentTime to avoid unnecessary re-renders
const currentTimeStore = {
  value: 0,
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    currentTimeStore.listeners.add(listener);
    return () => currentTimeStore.listeners.delete(listener);
  },
  getSnapshot() {
    return currentTimeStore.value;
  },
  setValue(newValue: number) {
    currentTimeStore.value = newValue;
    currentTimeStore.listeners.forEach(listener => listener());
  },
};

export { currentTimeStore };

const timeCache = new Map<string, string>();
const dateCache = new Map<string, string>();

export function formatEPGTime(timestamp: string): string {
  if (timeCache.has(timestamp)) {
    return timeCache.get(timestamp) as string;
  }
  const date = new Date(Number.parseInt(timestamp) * 1000);
  const formatted = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false });
  timeCache.set(timestamp, formatted);
  return formatted;
}

export function formatEPGDate(timestamp: string): string {
  if (dateCache.has(timestamp)) {
    return dateCache.get(timestamp) as string;
  }
  const date = new Date(Number.parseInt(timestamp) * 1000);
  const formatted = date.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
  dateCache.set(timestamp, formatted);
  return formatted;
}

export function isProgramNow(start: string, end: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const startTime = Number.parseInt(start);
  const endTime = Number.parseInt(end);
  return startTime <= now && endTime > now;
}

export function formatDurationTime(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getResolutionLabel(width: number, height: number): string {
  if (height >= 4320) return '8K';
  if (height >= 2160) return '4K';
  if (height >= 1440) return 'QHD';
  if (height >= 1080) return 'FHD';
  if (height >= 720) return 'HD';
  if (height >= 360) return 'SD';
  return `${width}x${height}`;
}
