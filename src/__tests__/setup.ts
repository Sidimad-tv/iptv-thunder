import '@testing-library/jest-dom';

// Mock @tauri-apps/plugin-store to prevent worker crashes
jest.mock('@tauri-apps/plugin-store', () => {
  const createMockStore = () => ({
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    load: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    keys: jest.fn().mockResolvedValue([]),
    entries: jest.fn().mockResolvedValue([]),
    length: jest.fn().mockResolvedValue(0),
    close: jest.fn().mockResolvedValue(undefined),
  });

  return {
    Store: {
      load: jest.fn().mockResolvedValue(createMockStore()),
    },
    load: jest.fn().mockResolvedValue(createMockStore()),
  };
});

declare global {
  var __TAURI__: any;
  var __TAURI_BUILD__: boolean;
}

interface TauriInternalsMock {
  invoke: jest.Mock;
  convertFileSrc: (path: string) => string;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternalsMock;
  }
}

// Mock Tauri API
globalThis.__TAURI__ = {};

// Mock Tauri internals (prevents worker crashes in @tauri-apps/api)
globalThis.window = globalThis.window || {};
globalThis.window.__TAURI_INTERNALS__ = {
  invoke: jest.fn(),
  convertFileSrc: (path: string) => path,
};

// Mock Tauri build flag (used by stalkerAPI_new.ts)
globalThis.__TAURI_BUILD__ = true;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234',
  },
});
