import {
  MpvObservableProperty,
} from 'tauri-plugin-libmpv-api';

export const MAX_RETRIES_PER_URL = 3;
export const DEAD_TIMEOUT_MS = 5_000;

export const OBSERVED_PROPERTIES = [
  ['pause', 'flag'],
  ['time-pos', 'double', 'none'],
  ['duration', 'double', 'none'],
  ['filename', 'string', 'none'],
  ['video-params', 'node', 'none'],
  ['track-list', 'node', 'none'],
  ['aid', 'string', 'none'],
  ['sid', 'string', 'none'],
  ['cache-buffering-state', 'double', 'none'],
  ['video-bitrate', 'double', 'none'],
  ['volume', 'double', 'none'],
  ['end-file', 'node', 'none'],
] as const satisfies MpvObservableProperty[];
