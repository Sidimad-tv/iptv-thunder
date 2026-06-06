import { usePlaybackStore } from '../playback.store';

describe('playback.store', () => {
  const initialState = {
    current: null,
    buffering: false,
    error: null,
    contentType: null,
    settings: { volume: 1, muted: false },
  };

  beforeEach(() => {
    usePlaybackStore.setState(initialState);
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = usePlaybackStore.getState();
      expect(state.current).toBeNull();
      expect(state.buffering).toBe(false);
      expect(state.error).toBeNull();
      expect(state.contentType).toBeNull();
      expect(state.settings.volume).toBe(1);
      expect(state.settings.muted).toBe(false);
    });
  });

  describe('setMedia', () => {
    it('should set media and clear error', () => {
      usePlaybackStore.setState({ error: 'Some error' });
      
      const media = { url: 'http://test.com/video', name: 'Test Video' };
      usePlaybackStore.getState().setMedia(media);
      
      const state = usePlaybackStore.getState();
      expect(state.current).toEqual(media);
      expect(state.error).toBeNull();
    });

    it('should set media to null', () => {
      usePlaybackStore.setState({ current: { url: 'http://test.com', name: 'Test' } });
      usePlaybackStore.getState().setMedia(null);
      expect(usePlaybackStore.getState().current).toBeNull();
    });
  });

  describe('setBuffering', () => {
    it('should set buffering to true', () => {
      usePlaybackStore.getState().setBuffering(true);
      expect(usePlaybackStore.getState().buffering).toBe(true);
    });

    it('should set buffering to false', () => {
      usePlaybackStore.setState({ buffering: true });
      usePlaybackStore.getState().setBuffering(false);
      expect(usePlaybackStore.getState().buffering).toBe(false);
    });
  });

  describe('setContentType', () => {
    it('should set content type to tv', () => {
      usePlaybackStore.getState().setContentType('tv');
      expect(usePlaybackStore.getState().contentType).toBe('tv');
    });

    it('should set content type to movies', () => {
      usePlaybackStore.getState().setContentType('movies');
      expect(usePlaybackStore.getState().contentType).toBe('movies');
    });

    it('should set content type to series', () => {
      usePlaybackStore.getState().setContentType('series');
      expect(usePlaybackStore.getState().contentType).toBe('series');
    });

    it('should set content type to null', () => {
      usePlaybackStore.setState({ contentType: 'tv' as const });
      usePlaybackStore.getState().setContentType(null);
      expect(usePlaybackStore.getState().contentType).toBeNull();
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      usePlaybackStore.getState().setError('Network error');
      expect(usePlaybackStore.getState().error).toBe('Network error');
    });

    it('should clear error', () => {
      usePlaybackStore.setState({ error: 'Some error' });
      usePlaybackStore.getState().setError(null);
      expect(usePlaybackStore.getState().error).toBeNull();
    });
  });

  describe('setVolume', () => {
    it('should set volume', () => {
      usePlaybackStore.getState().setVolume(0.5);
      expect(usePlaybackStore.getState().settings.volume).toBe(0.5);
    });

    it('should set volume to 0', () => {
      usePlaybackStore.getState().setVolume(0);
      expect(usePlaybackStore.getState().settings.volume).toBe(0);
    });

    it('should set volume to max', () => {
      usePlaybackStore.getState().setVolume(1);
      expect(usePlaybackStore.getState().settings.volume).toBe(1);
    });
  });

  describe('setMuted', () => {
    it('should set muted to true', () => {
      usePlaybackStore.getState().setMuted(true);
      expect(usePlaybackStore.getState().settings.muted).toBe(true);
    });

    it('should set muted to false', () => {
      usePlaybackStore.setState({ settings: { volume: 1, muted: true } });
      usePlaybackStore.getState().setMuted(false);
      expect(usePlaybackStore.getState().settings.muted).toBe(false);
    });
  });

  describe('stop', () => {
    it('should clear current media but keep contentType', () => {
      usePlaybackStore.setState({ 
        current: { url: 'http://test.com', name: 'Test' },
        buffering: true,
        error: 'Some error',
        contentType: 'tv' as const,
      });
      
      usePlaybackStore.getState().stop();
      
      const state = usePlaybackStore.getState();
      expect(state.current).toBeNull();
      expect(state.buffering).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('close', () => {
    it('should clear all playback state', () => {
      usePlaybackStore.setState({ 
        current: { url: 'http://test.com', name: 'Test' },
        buffering: true,
        error: 'Some error',
        contentType: 'tv' as const,
      });
      
      usePlaybackStore.getState().close();
      
      const state = usePlaybackStore.getState();
      expect(state.current).toBeNull();
      expect(state.buffering).toBe(false);
      expect(state.error).toBeNull();
      expect(state.contentType).toBeNull();
    });
  });

  describe('media with full properties', () => {
    it('should handle media with all properties', () => {
      const media = {
        url: 'http://test.com/video',
        name: 'Test Video',
        channelId: 123,
        isVod: true,
        movieId: 'movie-1',
        resumePosition: 300,
        portalUrl: 'http://portal.com',
        mac: '00:11:22:33:44:55',
        token: 'abc123',
        genreId: 'genre-1',
      };
      
      usePlaybackStore.getState().setMedia(media as any);
      expect(usePlaybackStore.getState().current).toEqual(expect.objectContaining({
        url: 'http://test.com/video',
        name: 'Test Video',
        channelId: 123,
        isVod: true,
        movieId: 'movie-1',
      }));
    });
  });
});
