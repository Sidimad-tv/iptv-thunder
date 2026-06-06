import {
  getCurrentProgram,
  getNextProgram,
  getProgramsForTimeRange,
  formatEPGTime,
  formatEPGDate,
  getEPGTimeRange,
} from '../epg.api';
import type { StalkerEPG } from '@/types';

describe('epg.api utility functions', () => {
  describe('getCurrentProgram', () => {
    it('should return current program', () => {
      const now = Math.floor(Date.now() / 1000);
      const epg: StalkerEPG[] = [
        {
          id: 1,
          name: 'Past Program',
          start_time: (now - 3600).toString(),
          end_time: (now - 1800).toString(),
          description: '',
          channel_id: 1,
        },
        {
          id: 2,
          name: 'Current Program',
          start_time: (now - 900).toString(),
          end_time: (now + 900).toString(),
          description: '',
          channel_id: 1,
        },
        {
          id: 3,
          name: 'Future Program',
          start_time: (now + 1800).toString(),
          end_time: (now + 3600).toString(),
          description: '',
          channel_id: 1,
        },
      ];

      const current = getCurrentProgram(epg);
      expect(current).toBeDefined();
      expect(current?.name).toBe('Current Program');
    });

    it('should return null if no current program', () => {
      const now = Math.floor(Date.now() / 1000);
      const epg: StalkerEPG[] = [
        {
          id: 1,
          name: 'Past Program',
          start_time: (now - 3600).toString(),
          end_time: (now - 1800).toString(),
          description: '',
          channel_id: 1,
        },
      ];

      const current = getCurrentProgram(epg);
      expect(current).toBeNull();
    });
  });

  describe('getNextProgram', () => {
    it('should return next program', () => {
      const now = Math.floor(Date.now() / 1000);
      const epg: StalkerEPG[] = [
        {
          id: 1,
          name: 'Current Program',
          start_time: (now - 900).toString(),
          end_time: (now + 900).toString(),
          description: '',
          channel_id: 1,
        },
        {
          id: 2,
          name: 'Next Program',
          start_time: (now + 1800).toString(),
          end_time: (now + 3600).toString(),
          description: '',
          channel_id: 1,
        },
      ];

      const next = getNextProgram(epg);
      expect(next).toBeDefined();
      expect(next?.name).toBe('Next Program');
    });

    it('should return null if no next program', () => {
      const now = Math.floor(Date.now() / 1000);
      const epg: StalkerEPG[] = [
        {
          id: 1,
          name: 'Current Program',
          start_time: (now - 900).toString(),
          end_time: (now + 900).toString(),
          description: '',
          channel_id: 1,
        },
      ];

      const next = getNextProgram(epg);
      expect(next).toBeNull();
    });
  });

  describe('getProgramsForTimeRange', () => {
    it('should return programs in time range', () => {
      const now = Math.floor(Date.now() / 1000);
      const epg: StalkerEPG[] = [
        {
          id: 1,
          name: 'Program 1',
          start_time: (now - 3600).toString(),
          end_time: (now - 1800).toString(),
          description: '',
          channel_id: 1,
        },
        {
          id: 2,
          name: 'Program 2',
          start_time: (now - 900).toString(),
          end_time: (now + 900).toString(),
          description: '',
          channel_id: 1,
        },
        {
          id: 3,
          name: 'Program 3',
          start_time: (now + 1800).toString(),
          end_time: (now + 3600).toString(),
          description: '',
          channel_id: 1,
        },
      ];

      const programs = getProgramsForTimeRange(epg, now - 3600, now + 3600);
      expect(programs).toHaveLength(3);
    });

    it('should filter programs outside time range', () => {
      const now = Math.floor(Date.now() / 1000);
      const epg: StalkerEPG[] = [
        {
          id: 1,
          name: 'Program 1',
          start_time: (now - 7200).toString(),
          end_time: (now - 5400).toString(),
          description: '',
          channel_id: 1,
        },
        {
          id: 2,
          name: 'Program 2',
          start_time: (now + 5400).toString(),
          end_time: (now + 7200).toString(),
          description: '',
          channel_id: 1,
        },
      ];

      const programs = getProgramsForTimeRange(epg, now - 3600, now + 3600);
      expect(programs).toHaveLength(0);
    });
  });

  describe('formatEPGTime', () => {
    it('should format timestamp to time string', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const formatted = formatEPGTime(timestamp);
      expect(formatted).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should handle string timestamp', () => {
      const formatted = formatEPGTime('1234567890');
      expect(formatted).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('formatEPGDate', () => {
    it('should format timestamp to date string', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const formatted = formatEPGDate(timestamp);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should handle string timestamp', () => {
      const formatted = formatEPGDate('1234567890');
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('getEPGTimeRange', () => {
    it('should return time range for 24 hours', () => {
      const range = getEPGTimeRange(24);
      expect(range).toHaveProperty('from');
      expect(range).toHaveProperty('to');
      // Range is 2 hours back + 24 hours forward = 26 hours total
      expect(range.to - range.from).toBe(26 * 3600);
    });

    it('should return time range for custom hours', () => {
      const range = getEPGTimeRange(12);
      // Range is 2 hours back + 12 hours forward = 14 hours total
      expect(range.to - range.from).toBe(14 * 3600);
    });

    it('should use default of 24 hours', () => {
      const range = getEPGTimeRange();
      // Range is 2 hours back + 24 hours forward = 26 hours total
      expect(range.to - range.from).toBe(26 * 3600);
    });
  });
});
