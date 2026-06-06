import {
  getCenter,
  getDistance,
  isSameRow,
  isSameColumn,
  overlapsVertically,
  overlapsHorizontally,
  isInDirection,
  getRowKey,
  getColumnKey,
} from '../geometry';

describe('geometry utils', () => {
  describe('getCenter', () => {
    it('should calculate center of rect', () => {
      const rect: DOMRect = {
        left: 10,
        top: 20,
        width: 100,
        height: 50,
        right: 110,
        bottom: 70,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      };

      const center = getCenter(rect);
      expect(center.x).toBe(60);
      expect(center.y).toBe(45);
    });

    it('should handle zero width/height', () => {
      const rect: DOMRect = {
        left: 10,
        top: 20,
        width: 0,
        height: 0,
        right: 10,
        bottom: 20,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      };

      const center = getCenter(rect);
      expect(center.x).toBe(10);
      expect(center.y).toBe(20);
    });
  });

  describe('getDistance', () => {
    it('should calculate distance between rects', () => {
      const rect1: DOMRect = {
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        right: 10,
        bottom: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      const rect2: DOMRect = {
        left: 10,
        top: 0,
        width: 10,
        height: 10,
        right: 20,
        bottom: 10,
        x: 10,
        y: 0,
        toJSON: () => ({}),
      };

      const result = getDistance(rect1, rect2);
      expect(result.dx).toBe(10);
      expect(result.dy).toBe(0);
      expect(result.distance).toBe(10);
    });

    it('should calculate diagonal distance', () => {
      const rect1: DOMRect = {
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        right: 10,
        bottom: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      const rect2: DOMRect = {
        left: 10,
        top: 10,
        width: 10,
        height: 10,
        right: 20,
        bottom: 20,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      };

      const result = getDistance(rect1, rect2);
      expect(result.dx).toBe(10);
      expect(result.dy).toBe(10);
      expect(result.distance).toBeCloseTo(14.14, 1);
    });
  });

  describe('isSameRow', () => {
    it('should return true for elements in same row', () => {
      const rect1: DOMRect = {
        left: 0,
        top: 0,
        width: 10,
        height: 20,
        right: 10,
        bottom: 20,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      const rect2: DOMRect = {
        left: 10,
        top: 5,
        width: 10,
        height: 20,
        right: 20,
        bottom: 25,
        x: 10,
        y: 5,
        toJSON: () => ({}),
      };

      expect(isSameRow(rect1, rect2)).toBe(true);
    });

    it('should return false for elements in different rows', () => {
      const rect1: DOMRect = {
        left: 0,
        top: 0,
        width: 10,
        height: 20,
        right: 10,
        bottom: 20,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      const rect2: DOMRect = {
        left: 0,
        top: 50,
        width: 10,
        height: 20,
        right: 10,
        bottom: 70,
        x: 0,
        y: 50,
        toJSON: () => ({}),
      };

      expect(isSameRow(rect1, rect2)).toBe(false);
    });
  });

  describe('isSameColumn', () => {
    it('should return true for elements in same column', () => {
      const rect1: DOMRect = {
        left: 0,
        top: 0,
        width: 20,
        height: 10,
        right: 20,
        bottom: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      const rect2: DOMRect = {
        left: 5,
        top: 10,
        width: 20,
        height: 10,
        right: 25,
        bottom: 20,
        x: 5,
        y: 10,
        toJSON: () => ({}),
      };

      expect(isSameColumn(rect1, rect2)).toBe(true);
    });

    it('should return false for elements in different columns', () => {
      const rect1: DOMRect = {
        left: 0,
        top: 0,
        width: 20,
        height: 10,
        right: 20,
        bottom: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      const rect2: DOMRect = {
        left: 50,
        top: 0,
        width: 20,
        height: 10,
        right: 70,
        bottom: 10,
        x: 50,
        y: 0,
        toJSON: () => ({}),
      };

      expect(isSameColumn(rect1, rect2)).toBe(false);
    });
  });

  describe('overlapsVertically', () => {
    it('should return true for overlapping rects', () => {
      const rect1: DOMRect = {
        left: 0,
        top: 0,
        width: 10,
        height: 20,
        right: 10,
        bottom: 20,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      const rect2: DOMRect = {
        left: 10,
        top: 10,
        width: 10,
        height: 20,
        right: 20,
        bottom: 30,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      };

      expect(overlapsVertically(rect1, rect2)).toBe(true);
    });

    it('should return false for non-overlapping rects', () => {
      const rect1: DOMRect = {
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        right: 10,
        bottom: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      const rect2: DOMRect = {
        left: 0,
        top: 20,
        width: 10,
        height: 10,
        right: 10,
        bottom: 30,
        x: 0,
        y: 20,
        toJSON: () => ({}),
      };

      expect(overlapsVertically(rect1, rect2)).toBe(false);
    });
  });

  describe('overlapsHorizontally', () => {
    it('should return true for overlapping rects', () => {
      const rect1: DOMRect = {
        left: 0,
        top: 0,
        width: 20,
        height: 10,
        right: 20,
        bottom: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      const rect2: DOMRect = {
        left: 10,
        top: 0,
        width: 20,
        height: 10,
        right: 30,
        bottom: 10,
        x: 10,
        y: 0,
        toJSON: () => ({}),
      };

      expect(overlapsHorizontally(rect1, rect2)).toBe(true);
    });

    it('should return false for non-overlapping rects', () => {
      const rect1: DOMRect = {
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        right: 10,
        bottom: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      const rect2: DOMRect = {
        left: 20,
        top: 0,
        width: 10,
        height: 10,
        right: 30,
        bottom: 10,
        x: 20,
        y: 0,
        toJSON: () => ({}),
      };

      expect(overlapsHorizontally(rect1, rect2)).toBe(false);
    });
  });

  describe('isInDirection', () => {
    const from: DOMRect = {
      left: 0,
      top: 0,
      width: 10,
      height: 10,
      right: 10,
      bottom: 10,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };

    it('should return false for back direction', () => {
      const to: DOMRect = {
        left: 10,
        top: 0,
        width: 10,
        height: 10,
        right: 20,
        bottom: 10,
        x: 10,
        y: 0,
        toJSON: () => ({}),
      };

      expect(isInDirection(from, to, 'back')).toBe(false);
    });

    it('should detect right direction', () => {
      const to: DOMRect = {
        left: 20,
        top: 0,
        width: 10,
        height: 10,
        right: 30,
        bottom: 10,
        x: 20,
        y: 0,
        toJSON: () => ({}),
      };

      expect(isInDirection(from, to, 'right')).toBe(true);
    });

    it('should detect left direction', () => {
      const to: DOMRect = {
        left: -20,
        top: 0,
        width: 10,
        height: 10,
        right: -10,
        bottom: 10,
        x: -20,
        y: 0,
        toJSON: () => ({}),
      };

      expect(isInDirection(from, to, 'left')).toBe(true);
    });

    it('should detect down direction', () => {
      const to: DOMRect = {
        left: 0,
        top: 20,
        width: 10,
        height: 10,
        right: 10,
        bottom: 30,
        x: 0,
        y: 20,
        toJSON: () => ({}),
      };

      expect(isInDirection(from, to, 'down')).toBe(true);
    });

    it('should detect up direction', () => {
      const to: DOMRect = {
        left: 0,
        top: -20,
        width: 10,
        height: 10,
        right: 10,
        bottom: -10,
        x: 0,
        y: -20,
        toJSON: () => ({}),
      };

      expect(isInDirection(from, to, 'up')).toBe(true);
    });
  });

  describe('getRowKey', () => {
    it('should calculate row key with default bucket size', () => {
      const rect: DOMRect = {
        left: 0,
        top: 75,
        width: 10,
        height: 10,
        right: 10,
        bottom: 85,
        x: 0,
        y: 75,
        toJSON: () => ({}),
      };

      expect(getRowKey(rect)).toBe(2); // 75 / 50 = 1.5, rounded = 2
    });

    it('should calculate row key with custom bucket size', () => {
      const rect: DOMRect = {
        left: 0,
        top: 100,
        width: 10,
        height: 10,
        right: 10,
        bottom: 110,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      };

      expect(getRowKey(rect, 25)).toBe(4); // 100 / 25 = 4
    });
  });

  describe('getColumnKey', () => {
    it('should calculate column key with default bucket size', () => {
      const rect: DOMRect = {
        left: 75,
        top: 0,
        width: 10,
        height: 10,
        right: 85,
        bottom: 10,
        x: 75,
        y: 0,
        toJSON: () => ({}),
      };

      expect(getColumnKey(rect)).toBe(2); // 75 / 50 = 1.5, rounded = 2
    });

    it('should calculate column key with custom bucket size', () => {
      const rect: DOMRect = {
        left: 100,
        top: 0,
        width: 10,
        height: 10,
        right: 110,
        bottom: 10,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      };

      expect(getColumnKey(rect, 25)).toBe(4); // 100 / 25 = 4
    });
  });
});
