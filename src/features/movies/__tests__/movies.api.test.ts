import {
  normalizeVod,
  normalizeDbVod,
  persistVodQueue,
} from '../movies.api';
import type { StalkerVOD } from '@/types';

describe('movies.api utility functions', () => {
  describe('normalizeVod', () => {
    it('should deduplicate VOD items by id', () => {
      const items: StalkerVOD[] = [
        { id: 1, name: 'Movie 1', cmd: '', description: '', added: '123', censored: false },
        { id: 2, name: 'Movie 2', cmd: '', description: '', added: '124', censored: false },
        { id: 1, name: 'Movie 1 Duplicate', cmd: '', description: '', added: '125', censored: false },
      ];

      const normalized = normalizeVod(items);
      expect(normalized).toHaveLength(2);
      expect(normalized.find(i => i.id === 1)?.name).toBe('Movie 1 Duplicate');
    });

    it('should use o_name if available and different from name', () => {
      const items: StalkerVOD[] = [
        {
          id: 1,
          name: 'Original Name',
          o_name: 'Better Name',
          cmd: '',
          description: '',
          added: '123',
          censored: false,
        },
      ];

      const normalized = normalizeVod(items);
      expect(normalized[0].name).toBe('Better Name');
    });

    it('should use name if o_name is same as name', () => {
      const items: StalkerVOD[] = [
        {
          id: 1,
          name: 'Same Name',
          o_name: 'Same Name',
          cmd: '',
          description: '',
          added: '123',
          censored: false,
        },
      ];

      const normalized = normalizeVod(items);
      expect(normalized[0].name).toBe('Same Name');
    });

    it('should sort by added timestamp descending (newest first)', () => {
      const items: StalkerVOD[] = [
        {
          id: 1,
          name: 'Old Movie',
          added: '2024-01-01',
          cmd: '',
          description: '',
          censored: false,
        },
        {
          id: 2,
          name: 'New Movie',
          added: '2024-12-01',
          cmd: '',
          description: '',
          censored: false,
        },
      ];

      const normalized = normalizeVod(items);
      expect(normalized[0].name).toBe('New Movie');
      expect(normalized[1].name).toBe('Old Movie');
    });

    it('should handle items without added timestamp', () => {
      const items: StalkerVOD[] = [
        {
          id: 1,
          name: 'No Date Movie',
          cmd: '',
          description: '',
          added: '',
          censored: false,
        },
        {
          id: 2,
          name: 'Dated Movie',
          added: '2024-01-01',
          cmd: '',
          description: '',
          censored: false,
        },
      ];

      const normalized = normalizeVod(items);
      expect(normalized[0].name).toBe('Dated Movie');
    });
  });

  describe('normalizeDbVod', () => {
    it('should normalize DB format to StalkerVOD format', () => {
      const dbItems = [
        {
          id: '1',
          name: 'Test Movie',
          description: 'Test Description',
          posterUrl: 'http://example.com/poster.jpg',
          streamUrl: 'http://example.com/stream',
          year: 2024,
          rating: 8.5,
          duration: 120,
          genre: 'Action',
          director: 'Director Name',
          actors: 'Actor 1, Actor 2',
          added: '2024-01-01',
        },
      ];

      const normalized = normalizeDbVod(dbItems);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].id).toBe(1);
      expect(normalized[0].name).toBe('Test Movie');
      expect(normalized[0].logo).toBe('http://example.com/poster.jpg');
      expect(normalized[0].cmd).toBe('http://example.com/stream');
      expect(normalized[0].year).toBe(2024);
      expect(normalized[0].rating_imdb).toBe(8.5);
      expect(normalized[0].length).toBe(120);
    });

    it('should handle missing optional fields', () => {
      const dbItems = [
        {
          id: '1',
          name: 'Test Movie',
          description: '',
          posterUrl: '',
          streamUrl: '',
          year: undefined,
          rating: undefined,
          duration: undefined,
          genre: '',
          director: '',
          actors: '',
          added: undefined,
        },
      ];

      const normalized = normalizeDbVod(dbItems);
      expect(normalized[0].id).toBe(1);
      expect(normalized[0].name).toBe('Test Movie');
      expect(normalized[0].logo).toBe('');
      expect(normalized[0].cmd).toBe('');
    });

    it('should sort by added timestamp descending', () => {
      const dbItems = [
        {
          id: '1',
          name: 'Old Movie',
          posterUrl: '',
          streamUrl: '',
          added: '2024-01-01',
        },
        {
          id: '2',
          name: 'New Movie',
          posterUrl: '',
          streamUrl: '',
          added: '2024-12-01',
        },
      ];

      const normalized = normalizeDbVod(dbItems);
      expect(normalized[0].name).toBe('New Movie');
      expect(normalized[1].name).toBe('Old Movie');
    });
  });

  describe('persistVodQueue', () => {
    it('should queue and execute write operation', async () => {
      const saveVodFn = jest.fn().mockResolvedValue(undefined);
      const vodList = [{ id: '1', name: 'Test' }];
      const accountId = 'account1';
      const categoryId = 'cat1';

      await persistVodQueue(vodList, accountId, categoryId, saveVodFn);

      expect(saveVodFn).toHaveBeenCalledWith(vodList, accountId, categoryId);
    });

    it('should wait for existing write operation before starting new one', async () => {
      const saveVodFn = jest.fn().mockResolvedValue(undefined);
      let resolveFirst = false;
      const saveVodFnSlow = jest.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          const check = () => {
            if (resolveFirst) {
              resolve();
            } else {
              setTimeout(check, 10);
            }
          };
          check();
        });
      });

      const vodList = [{ id: '1', name: 'Test' }];
      const accountId = 'account1';
      const categoryId = 'cat1';

      const firstPromise = persistVodQueue(vodList, accountId, categoryId, saveVodFnSlow);
      const secondPromise = persistVodQueue(vodList, accountId, categoryId, saveVodFn);

      // First write should be in progress
      expect(saveVodFnSlow).toHaveBeenCalledTimes(1);
      expect(saveVodFn).not.toHaveBeenCalled();

      // Allow first write to complete
      resolveFirst = true;
      await firstPromise;
      await secondPromise;

      // Both writes should have completed
      expect(saveVodFnSlow).toHaveBeenCalledTimes(1);
      expect(saveVodFn).toHaveBeenCalledTimes(1);
    });

    it('should remove from queue after completion', async () => {
      const saveVodFn = jest.fn().mockResolvedValue(undefined);
      const vodList = [{ id: '1', name: 'Test' }];
      const accountId = 'account1';
      const categoryId = 'cat1';

      await persistVodQueue(vodList, accountId, categoryId, saveVodFn);

      // Create another write with same queue key - should not wait
      const saveVodFn2 = jest.fn().mockResolvedValue(undefined);
      await persistVodQueue(vodList, accountId, categoryId, saveVodFn2);

      expect(saveVodFn2).toHaveBeenCalled();
    });

    it('should handle write errors gracefully', async () => {
      const saveVodFn = jest.fn().mockRejectedValue(new Error('DB Error'));
      const vodList = [{ id: '1', name: 'Test' }];
      const accountId = 'account1';
      const categoryId = 'cat1';

      await expect(persistVodQueue(vodList, accountId, categoryId, saveVodFn)).rejects.toThrow('DB Error');
    });
  });
});
