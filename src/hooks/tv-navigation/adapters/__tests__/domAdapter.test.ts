import { buildNavigationState, findElementById } from '../domAdapter';

// Mock getBoundingClientRect
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = jest.fn(function(this: HTMLElement) {
    const width = parseInt(this.style.width) || 100;
    const height = parseInt(this.style.height) || 100;
    const top = parseInt(this.style.top) || 0;
    const left = parseInt(this.style.left) || 0;
    return { width, height, top, left, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({ width, height }) };
  });
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

describe('domAdapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('buildNavigationState', () => {
    it('should build navigation state from elements', () => {
      const el1 = document.createElement('div');
      el1.dataset.tvId = 'node-1';
      el1.dataset.tvGroup = 'test-group';
      el1.dataset.tvContainer = 'test-container';
      el1.dataset.tvIndex = '0';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.dataset.tvId = 'node-2';
      el2.dataset.tvGroup = 'test-group';
      el2.dataset.tvContainer = 'test-container';
      el2.dataset.tvIndex = '1';
      document.body.appendChild(el2);

      const state = buildNavigationState([el1, el2], 'node-1');

      expect(state.currentId).toBe('node-1');
      expect(state.nodes).toHaveLength(2);
      expect(state.nodes[0].id).toBe('node-1');
      expect(state.nodes[1].id).toBe('node-2');
    });

    it('should filter out elements with tv-skip attribute', () => {
      const el1 = document.createElement('div');
      el1.dataset.tvId = 'node-1';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.dataset.tvId = 'node-2';
      el2.dataset.tvSkip = 'true';
      document.body.appendChild(el2);

      const state = buildNavigationState([el1, el2]);

      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe('node-1');
    });

    it('should filter out elements with tv-div IDs', () => {
      const el1 = document.createElement('div');
      el1.dataset.tvId = 'node-1';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.dataset.tvId = 'tv-div-123';
      document.body.appendChild(el2);

      const state = buildNavigationState([el1, el2]);

      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe('node-1');
    });

    it('should generate IDs for elements without tv-id or id', () => {
      const el1 = document.createElement('div');
      document.body.appendChild(el1);

      const state = buildNavigationState([el1]);

      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toMatch(/^tv-/);
    });

    it('should extract group and container from parent elements', () => {
      const container = document.createElement('div');
      container.dataset.tvContainer = 'test-container';
      document.body.appendChild(container);

      const group = document.createElement('div');
      group.dataset.tvGroup = 'test-group';
      container.appendChild(group);

      const el = document.createElement('div');
      el.dataset.tvId = 'node-1';
      group.appendChild(el);

      const state = buildNavigationState([el]);

      expect(state.nodes[0].groupId).toBe('test-group');
      expect(state.nodes[0].containerId).toBe('test-container');
    });

    it('should detect disabled elements', () => {
      const el1 = document.createElement('div');
      el1.dataset.tvId = 'node-1';
      el1.setAttribute('disabled', 'true');
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.dataset.tvId = 'node-2';
      el2.setAttribute('aria-disabled', 'true');
      document.body.appendChild(el2);

      const el3 = document.createElement('div');
      el3.dataset.tvId = 'node-3';
      el3.dataset.tvDisabled = 'true';
      document.body.appendChild(el3);

      const state = buildNavigationState([el1, el2, el3]);

      expect(state.nodes[0].disabled).toBe(true);
      expect(state.nodes[1].disabled).toBe(true);
      expect(state.nodes[2].disabled).toBe(true);
    });

    it('should extract index from tv-index', () => {
      const el = document.createElement('div');
      el.dataset.tvId = 'node-1';
      el.dataset.tvIndex = '5';
      document.body.appendChild(el);

      const state = buildNavigationState([el]);

      expect(state.nodes[0].index).toBe(5);
    });

    it('should detect search elements', () => {
      const el = document.createElement('div');
      el.dataset.tvId = 'node-1';
      el.dataset.tvSearch = 'true';
      document.body.appendChild(el);

      const state = buildNavigationState([el]);

      expect(state.nodes[0].isSearch).toBe(true);
    });

    it('should detect initial elements', () => {
      const el = document.createElement('div');
      el.dataset.tvId = 'node-1';
      el.dataset.tvInitial = 'true';
      document.body.appendChild(el);

      const state = buildNavigationState([el]);

      expect(state.nodes[0].isInitial).toBe(true);
    });

    it('should detect active elements', () => {
      const el = document.createElement('div');
      el.dataset.tvId = 'node-1';
      el.dataset.tvActive = 'true';
      document.body.appendChild(el);

      const state = buildNavigationState([el]);

      expect(state.nodes[0].isActive).toBe(true);
    });

    it('should use provided currentId', () => {
      const el = document.createElement('div');
      el.dataset.tvId = 'node-1';
      document.body.appendChild(el);

      const state = buildNavigationState([el], 'custom-id');

      expect(state.currentId).toBe('custom-id');
    });

    it('should fallback to active element if no currentId provided', () => {
      const el1 = document.createElement('div');
      el1.dataset.tvId = 'node-1';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.dataset.tvId = 'node-2';
      el2.dataset.tvActive = 'true';
      document.body.appendChild(el2);

      // Mock document.activeElement
      Object.defineProperty(document, 'activeElement', {
        value: el2,
        writable: true,
      });

      const state = buildNavigationState([el1, el2]);

      expect(state.currentId).toBe('node-2');
    });

    it('should compute grid data for indexed nodes', () => {
      const el1 = document.createElement('div');
      el1.dataset.tvId = 'node-1';
      el1.dataset.tvGroup = 'movies';
      el1.dataset.tvContainer = 'main';
      el1.dataset.tvIndex = '0';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.dataset.tvId = 'node-2';
      el2.dataset.tvGroup = 'movies';
      el2.dataset.tvContainer = 'main';
      el2.dataset.tvIndex = '1';
      document.body.appendChild(el2);

      const state = buildNavigationState([el1, el2]);

      expect(state.grid).toBeDefined();
      if (state.grid) {
        expect(state.grid.size).toBeGreaterThan(0);
      }
    });
  });

  describe('findElementById', () => {
    it('should find element by tv-id', () => {
      const el1 = document.createElement('div');
      el1.dataset.tvId = 'node-1';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.dataset.tvId = 'node-2';
      document.body.appendChild(el2);

      const found = findElementById([el1, el2], 'node-1');

      expect(found).toBe(el1);
    });

    it('should find element by id', () => {
      const el1 = document.createElement('div');
      el1.id = 'node-1';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.id = 'node-2';
      document.body.appendChild(el2);

      const found = findElementById([el1, el2], 'node-1');

      expect(found).toBe(el1);
    });

    it('should return undefined if element not found', () => {
      const el = document.createElement('div');
      el.dataset.tvId = 'node-1';
      document.body.appendChild(el);

      const found = findElementById([el], 'node-999');

      expect(found).toBeUndefined();
    });

    it('should find element by generated id', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      // Build state first to generate ID
      const state = buildNavigationState([el]);
      const generatedId = state.nodes[0].id;

      const found = findElementById([el], generatedId);

      expect(found).toBe(el);
    });
  });
});
