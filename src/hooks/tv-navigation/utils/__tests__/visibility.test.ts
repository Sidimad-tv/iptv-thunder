import { isVisible, filterVisibleElements } from '../visibility';

// Mock getBoundingClientRect to return dimensions in test environment
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = jest.fn(function(this: HTMLElement) {
    if (this.style.display === 'none') {
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
    }
    const width = parseInt(this.style.width) || 0;
    const height = parseInt(this.style.height) || 0;
    return { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({ width, height }) };
  });
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

// Mock getComputedStyle
const originalGetComputedStyle = globalThis.getComputedStyle;
beforeAll(() => {
  globalThis.getComputedStyle = jest.fn((el: Element) => ({
    display: (el as HTMLElement).style.display || 'block',
    visibility: (el as HTMLElement).style.visibility || 'visible',
    opacity: (el as HTMLElement).style.opacity || '1',
  })) as any;
});

afterAll(() => {
  globalThis.getComputedStyle = originalGetComputedStyle;
});

describe('visibility utils', () => {
  describe('isVisible', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should return true for visible element', () => {
      const el = document.createElement('div');
      el.style.width = '100px';
      el.style.height = '100px';
      document.body.appendChild(el);

      expect(isVisible(el)).toBe(true);
    });

    it('should return false for element with display: none', () => {
      const el = document.createElement('div');
      el.style.display = 'none';
      el.style.width = '100px';
      el.style.height = '100px';
      document.body.appendChild(el);

      expect(isVisible(el)).toBe(false);
    });

    it('should return false for element with visibility: hidden', () => {
      const el = document.createElement('div');
      el.style.visibility = 'hidden';
      el.style.width = '100px';
      el.style.height = '100px';
      document.body.appendChild(el);

      expect(isVisible(el)).toBe(false);
    });

    it('should return false for element with opacity < 0.1', () => {
      const el = document.createElement('div');
      el.style.opacity = '0.05';
      el.style.width = '100px';
      el.style.height = '100px';
      document.body.appendChild(el);

      expect(isVisible(el)).toBe(false);
    });

    it('should return true for element with opacity >= 0.1', () => {
      const el = document.createElement('div');
      el.style.opacity = '0.1';
      el.style.width = '100px';
      el.style.height = '100px';
      document.body.appendChild(el);

      expect(isVisible(el)).toBe(true);
    });

    it('should return false for element with zero width', () => {
      const el = document.createElement('div');
      el.style.width = '0px';
      el.style.height = '100px';
      document.body.appendChild(el);

      expect(isVisible(el)).toBe(false);
    });

    it('should return false for element with zero height', () => {
      const el = document.createElement('div');
      el.style.width = '100px';
      el.style.height = '0px';
      document.body.appendChild(el);

      expect(isVisible(el)).toBe(false);
    });
  });

  describe('filterVisibleElements', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should filter out hidden elements', () => {
      const el1 = document.createElement('div');
      el1.style.width = '100px';
      el1.style.height = '100px';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.style.display = 'none';
      el2.style.width = '100px';
      el2.style.height = '100px';
      document.body.appendChild(el2);

      const el3 = document.createElement('div');
      el3.style.width = '100px';
      el3.style.height = '100px';
      document.body.appendChild(el3);

      const elements = [el1, el2, el3] as HTMLElement[];
      const result = filterVisibleElements(elements);

      expect(result).toHaveLength(2);
      expect(result).toContain(el1);
      expect(result).toContain(el3);
      expect(result).not.toContain(el2);
    });

    it('should return empty array if all elements are hidden', () => {
      const el1 = document.createElement('div');
      el1.style.display = 'none';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.style.visibility = 'hidden';
      document.body.appendChild(el2);

      const elements = [el1, el2] as HTMLElement[];
      const result = filterVisibleElements(elements);

      expect(result).toHaveLength(0);
    });

    it('should return all elements if all are visible', () => {
      const el1 = document.createElement('div');
      el1.style.width = '100px';
      el1.style.height = '100px';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.style.width = '100px';
      el2.style.height = '100px';
      document.body.appendChild(el2);

      const elements = [el1, el2] as HTMLElement[];
      const result = filterVisibleElements(elements);

      expect(result).toHaveLength(2);
      expect(result).toEqual(elements);
    });
  });
});
