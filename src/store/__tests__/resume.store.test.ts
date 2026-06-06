import { useResumeStore } from '../resume.store';

describe('resume.store', () => {
  beforeEach(() => {
    useResumeStore.setState({ movies: {} });
  });

  describe('setPosition', () => {
    it('should not save position for invalid movieId', () => {
      useResumeStore.getState().setPosition('', 100);
      expect(useResumeStore.getState().movies).toEqual({});
    });

    it('should not save position less than 30 seconds', () => {
      useResumeStore.getState().setPosition('movie1', 20, 600);
      expect(useResumeStore.getState().movies.movie1).toBeUndefined();
    });

    it('should save position for valid movie with 30+ seconds', () => {
      useResumeStore.getState().setPosition('movie1', 60, 600);
      const progress = useResumeStore.getState().movies.movie1;
      expect(progress).toBeDefined();
      expect(progress?.position).toBe(60);
      expect(progress?.status).toBe('in_progress');
      expect(progress?.percentage).toBe(10);
    });

    it('should mark as watched when 90%+ completed', () => {
      useResumeStore.getState().setPosition('movie1', 540, 600);
      const progress = useResumeStore.getState().movies.movie1;
      expect(progress?.status).toBe('watched');
      expect(progress?.percentage).toBe(90);
    });

    it('should clear position when time is 0', () => {
      useResumeStore.getState().setPosition('movie1', 100, 600);
      expect(useResumeStore.getState().movies.movie1).toBeDefined();
      
      useResumeStore.getState().setPosition('movie1', 0);
      expect(useResumeStore.getState().movies.movie1).toBeUndefined();
    });

    it('should preserve watched status when updating', () => {
      useResumeStore.getState().markAsWatched('movie1', 600);
      expect(useResumeStore.getState().movies.movie1?.status).toBe('watched');
      
      useResumeStore.getState().setPosition('movie1', 50, 600);
      expect(useResumeStore.getState().movies.movie1?.status).toBe('watched');
    });
  });

  describe('getPosition', () => {
    it('should return 0 for non-existent movie', () => {
      expect(useResumeStore.getState().getPosition('nonexistent')).toBe(0);
    });

    it('should return saved position', () => {
      useResumeStore.getState().setPosition('movie1', 120, 600);
      expect(useResumeStore.getState().getPosition('movie1')).toBe(120);
    });
  });

  describe('getProgress', () => {
    it('should return undefined for non-existent movie', () => {
      expect(useResumeStore.getState().getProgress('nonexistent')).toBeUndefined();
    });

    it('should return full progress object', () => {
      useResumeStore.getState().setPosition('movie1', 120, 600);
      const progress = useResumeStore.getState().getProgress('movie1');
      expect(progress).toBeDefined();
      expect(progress?.position).toBe(120);
      expect(progress?.duration).toBe(600);
      expect(progress?.percentage).toBe(20);
    });
  });

  describe('clearPosition', () => {
    it('should not clear for invalid movieId', () => {
      useResumeStore.getState().setPosition('movie1', 100, 600);
      useResumeStore.getState().clearPosition('');
      expect(useResumeStore.getState().movies.movie1).toBeDefined();
    });

    it('should clear position for valid movieId', () => {
      useResumeStore.getState().setPosition('movie1', 100, 600);
      useResumeStore.getState().clearPosition('movie1');
      expect(useResumeStore.getState().movies.movie1).toBeUndefined();
    });
  });

  describe('markAsWatched', () => {
    it('should not mark as watched for invalid movieId', () => {
      useResumeStore.getState().markAsWatched('', 600);
      expect(useResumeStore.getState().movies).toEqual({});
    });

    it('should mark movie as watched with 100%', () => {
      useResumeStore.getState().markAsWatched('movie1', 600);
      const progress = useResumeStore.getState().movies.movie1;
      expect(progress?.status).toBe('watched');
      expect(progress?.percentage).toBe(100);
      expect(progress?.position).toBe(600);
    });
  });

  describe('getWatchStatus', () => {
    it('should return not_started for new movie', () => {
      expect(useResumeStore.getState().getWatchStatus('movie1')).toBe('not_started');
    });

    it('return correct status for in_progress movie', () => {
      useResumeStore.getState().setPosition('movie1', 60, 600);
      expect(useResumeStore.getState().getWatchStatus('movie1')).toBe('in_progress');
    });

    it('return correct status for watched movie', () => {
      useResumeStore.getState().markAsWatched('movie1', 600);
      expect(useResumeStore.getState().getWatchStatus('movie1')).toBe('watched');
    });
  });

  describe('getInProgressMovies', () => {
    it('should return empty array when no movies', () => {
      expect(useResumeStore.getState().getInProgressMovies()).toEqual([]);
    });

    it('should return only in_progress movies sorted by lastWatched', () => {
      useResumeStore.getState().setPosition('movie1', 60, 600);
      useResumeStore.getState().markAsWatched('movie2', 600);
      
      const inProgress = useResumeStore.getState().getInProgressMovies();
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].movieId).toBe('movie1');
    });
  });

  describe('getWatchedMovies', () => {
    it('should return empty array when no movies', () => {
      expect(useResumeStore.getState().getWatchedMovies()).toEqual([]);
    });

    it('should return only watched movies sorted by lastWatched', () => {
      useResumeStore.getState().setPosition('movie1', 60, 600);
      useResumeStore.getState().markAsWatched('movie2', 600);
      
      const watched = useResumeStore.getState().getWatchedMovies();
      expect(watched).toHaveLength(1);
      expect(watched[0].movieId).toBe('movie2');
    });
  });

  describe('cleanupOldEntries', () => {
    it('should remove expired entries', () => {
      const oldDate = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago
      
      useResumeStore.setState({
        movies: {
          movie1: { position: 100, duration: 600, status: 'in_progress', lastWatched: oldDate, percentage: 16 },
          movie2: { position: 200, duration: 600, status: 'in_progress', lastWatched: Date.now(), percentage: 33 },
        },
      });
      
      useResumeStore.getState().cleanupOldEntries();
      
      expect(useResumeStore.getState().movies.movie1).toBeUndefined();
      expect(useResumeStore.getState().movies.movie2).toBeDefined();
    });
  });
});
