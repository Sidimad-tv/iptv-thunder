import {
  groupEpisodesBySeason,
} from '../series.api';
import type { StalkerVOD } from '@/types';

describe('series.api utility functions', () => {
  describe('groupEpisodesBySeason', () => {
    it('should group episodes by season', () => {
      const episodes: StalkerVOD[] = [
        { id: 1, name: 'Ep 1', cmd: '', description: '', season: '1', episode: '1', added: '123', censored: false },
        { id: 2, name: 'Ep 2', cmd: '', description: '', season: '1', episode: '2', added: '124', censored: false },
        { id: 3, name: 'Ep 3', cmd: '', description: '', season: '2', episode: '1', added: '125', censored: false },
      ];

      const grouped = groupEpisodesBySeason(episodes);
      expect(grouped).toHaveProperty('1');
      expect(grouped).toHaveProperty('2');
      expect(grouped['1']).toHaveLength(2);
      expect(grouped['2']).toHaveLength(1);
    });

    it('should sort episodes within each season', () => {
      const episodes: StalkerVOD[] = [
        { id: 1, name: 'Ep 3', cmd: '', description: '', season: '1', episode: '3', added: '123', censored: false },
        { id: 2, name: 'Ep 1', cmd: '', description: '', season: '1', episode: '1', added: '124', censored: false },
        { id: 3, name: 'Ep 2', cmd: '', description: '', season: '1', episode: '2', added: '125', censored: false },
      ];

      const grouped = groupEpisodesBySeason(episodes);
      expect(grouped['1'][0].episode).toBe('1');
      expect(grouped['1'][1].episode).toBe('2');
      expect(grouped['1'][2].episode).toBe('3');
    });

    it('should handle episodes without season', () => {
      const episodes: StalkerVOD[] = [
        { id: 1, name: 'Ep 1', cmd: '', description: '', episode: '1', added: '123', censored: false },
      ];

      const grouped = groupEpisodesBySeason(episodes);
      expect(grouped).toHaveProperty('Unknown');
      expect(grouped['Unknown']).toHaveLength(1);
    });

    it('should handle episodes without episode number', () => {
      const episodes: StalkerVOD[] = [
        { id: 1, name: 'Ep 1', cmd: '', description: '', season: '1', added: '123', censored: false },
        { id: 2, name: 'Ep 2', cmd: '', description: '', season: '1', episode: '2', added: '124', censored: false },
      ];

      const grouped = groupEpisodesBySeason(episodes);
      expect(grouped['1']).toHaveLength(2);
      // Episodes without episode number should be sorted first (treated as 0)
      expect(grouped['1'][0].episode).toBeUndefined();
    });

    it('should handle empty episodes array', () => {
      const grouped = groupEpisodesBySeason([]);
      expect(grouped).toEqual({});
    });

    it('should handle numeric season values', () => {
      const episodes: StalkerVOD[] = [
        { id: 1, name: 'Ep 1', cmd: '', description: '', season: 1, episode: '1', added: '123', censored: false },
        { id: 2, name: 'Ep 2', cmd: '', description: '', season: 2, episode: '1', added: '124', censored: false },
      ] as any[];

      const grouped = groupEpisodesBySeason(episodes);
      expect(grouped).toHaveProperty('1');
      expect(grouped).toHaveProperty('2');
    });
  });
});
