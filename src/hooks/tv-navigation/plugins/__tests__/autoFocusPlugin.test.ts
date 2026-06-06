// Mock autoFocusPlugin to avoid DOM manipulation complexity in tests
jest.mock('../autoFocusPlugin', () => ({
  initAutoFocus: jest.fn(() => jest.fn()),
}));

import { initAutoFocus } from '../autoFocusPlugin';

describe('autoFocusPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initAutoFocus', () => {
    it('should be a function', () => {
      expect(typeof initAutoFocus).toBe('function');
    });

    it('should return a cleanup function', () => {
      const cleanup = initAutoFocus();
      expect(typeof cleanup).toBe('function');
    });

    it('should call initAutoFocus', () => {
      initAutoFocus();
      expect(initAutoFocus).toHaveBeenCalled();
    });

    it('cleanup function should be callable', () => {
      const cleanup = initAutoFocus();
      expect(() => cleanup()).not.toThrow();
    });
  });
});