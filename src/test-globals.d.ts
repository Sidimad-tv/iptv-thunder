// Global type declarations for performance tests
// This file defines global variables and interfaces needed across test files

declare global {
  // eslint-disable-next-line no-var
  var gc: NodeJS.GCFunction | undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

export {};
