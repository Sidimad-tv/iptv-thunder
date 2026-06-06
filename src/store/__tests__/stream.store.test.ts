import { useStreamStore } from '../stream.store';

describe('stream.store', () => {
  beforeEach(() => {
    useStreamStore.setState({ streams: {} });
  });

  describe('success', () => {
    it('should not update for invalid URL', () => {
      useStreamStore.getState().success('invalid-url');
      expect(useStreamStore.getState().streams).toEqual({});
    });

    it('should add new stream with 100% success rate', () => {
      useStreamStore.getState().success('https://example.com/stream1');
      const stats = useStreamStore.getState().streams['https://example.com/stream1'];
      expect(stats).toBeDefined();
      expect(stats?.successes).toBe(1);
      expect(stats?.fails).toBe(0);
      expect(stats?.successRate).toBe(1);
    });

    it('should update existing stream on success', () => {
      useStreamStore.getState().success('https://example.com/stream1');
      useStreamStore.getState().success('https://example.com/stream1');
      const stats = useStreamStore.getState().streams['https://example.com/stream1'];
      expect(stats?.successes).toBe(2);
      expect(stats?.successRate).toBe(1);
    });

    it('should calculate correct success rate', () => {
      useStreamStore.getState().success('https://example.com/stream1');
      useStreamStore.getState().fail('https://example.com/stream1');
      useStreamStore.getState().fail('https://example.com/stream1');
      const stats = useStreamStore.getState().streams['https://example.com/stream1'];
      expect(stats?.successRate).toBeCloseTo(0.333, 2);
    });

    it('should set lastSuccess timestamp', () => {
      const before = Date.now();
      useStreamStore.getState().success('https://example.com/stream1');
      const after = Date.now();
      const stats = useStreamStore.getState().streams['https://example.com/stream1'];
      expect(stats?.lastSuccess).toBeGreaterThanOrEqual(before);
      expect(stats?.lastSuccess).toBeLessThanOrEqual(after);
    });
  });

  describe('fail', () => {
    it('should not update for invalid URL', () => {
      useStreamStore.getState().fail('invalid-url');
      expect(useStreamStore.getState().streams).toEqual({});
    });

    it('should add new stream with 0% success rate', () => {
      useStreamStore.getState().fail('https://example.com/stream1');
      const stats = useStreamStore.getState().streams['https://example.com/stream1'];
      expect(stats).toBeDefined();
      expect(stats?.successes).toBe(0);
      expect(stats?.fails).toBe(1);
      expect(stats?.successRate).toBe(0);
    });

    it('should update existing stream on fail', () => {
      useStreamStore.getState().fail('https://example.com/stream1');
      useStreamStore.getState().fail('https://example.com/stream1');
      const stats = useStreamStore.getState().streams['https://example.com/stream1'];
      expect(stats?.fails).toBe(2);
      expect(stats?.successRate).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should not remove streams under limit', () => {
      useStreamStore.getState().success('https://example.com/stream1');
      useStreamStore.getState().success('https://example.com/stream2');
      useStreamStore.getState().cleanup();
      expect(useStreamStore.getState().getStreamCount()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all streams', () => {
      useStreamStore.getState().success('https://example.com/stream1');
      useStreamStore.getState().success('https://example.com/stream2');
      useStreamStore.getState().clear();
      expect(useStreamStore.getState().getStreamCount()).toBe(0);
    });
  });

  describe('getStreamStats', () => {
    it('should return undefined for invalid URL', () => {
      expect(useStreamStore.getState().getStreamStats('invalid')).toBeUndefined();
    });

    it('should return undefined for non-existent stream', () => {
      expect(useStreamStore.getState().getStreamStats('https://example.com/nonexistent')).toBeUndefined();
    });

    it('should return stream stats', () => {
      useStreamStore.getState().success('https://example.com/stream1');
      const stats = useStreamStore.getState().getStreamStats('https://example.com/stream1');
      expect(stats).toBeDefined();
      expect(stats?.url).toBe('https://example.com/stream1');
    });
  });

  describe('getTopStreams', () => {
    it('should return empty array when no streams', () => {
      expect(useStreamStore.getState().getTopStreams()).toEqual([]);
    });

    it('return streams sorted by success rate', () => {
      useStreamStore.getState().success('https://example.com/stream1');
      useStreamStore.getState().success('https://example.com/stream1');
      useStreamStore.getState().fail('https://example.com/stream2');
      
      const topStreams = useStreamStore.getState().getTopStreams(2);
      expect(topStreams[0].url).toBe('https://example.com/stream1');
      expect(topStreams[1].url).toBe('https://example.com/stream2');
    });

    it('should respect limit parameter', () => {
      useStreamStore.getState().success('https://example.com/stream1');
      useStreamStore.getState().success('https://example.com/stream2');
      useStreamStore.getState().success('https://example.com/stream3');
      
      const topStreams = useStreamStore.getState().getTopStreams(2);
      expect(topStreams).toHaveLength(2);
    });
  });

  describe('getStreamCount', () => {
    it('should return 0 for empty store', () => {
      expect(useStreamStore.getState().getStreamCount()).toBe(0);
    });

    it('should return correct count', () => {
      useStreamStore.getState().success('https://example.com/stream1');
      useStreamStore.getState().success('https://example.com/stream2');
      expect(useStreamStore.getState().getStreamCount()).toBe(2);
    });
  });

  describe('getAverageSuccessRate', () => {
    it('should return 0 for empty store', () => {
      expect(useStreamStore.getState().getAverageSuccessRate()).toBe(0);
    });

    it('should return correct average', () => {
      useStreamStore.getState().success('https://example.com/stream1');
      useStreamStore.getState().fail('https://example.com/stream2');
      
      const avg = useStreamStore.getState().getAverageSuccessRate();
      expect(avg).toBeCloseTo(0.5, 2);
    });
  });

  describe('trimStreams (via cleanup)', () => {
    it('should trim streams when over MAX_STREAMS', () => {
      // Add more streams than MAX_STREAMS (200)
      for (let i = 0; i < 250; i++) {
        useStreamStore.getState().success(`https://example.com/stream${i}`);
      }
      
      const countBefore = useStreamStore.getState().getStreamCount();
      expect(countBefore).toBeGreaterThan(200);
      
      useStreamStore.getState().cleanup();
      
      const countAfter = useStreamStore.getState().getStreamCount();
      expect(countAfter).toBeLessThanOrEqual(200);
    });
  });
});
