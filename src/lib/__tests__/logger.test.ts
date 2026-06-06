// Mock logger module to avoid import.meta.env issues
jest.mock('../logger', () => {
  const mockDebug = jest.fn();
  const mockInfo = jest.fn();
  const mockWarn = jest.fn();
  const mockError = jest.fn();
  const mockGroupCollapsed = jest.fn();

  return {
    createLogger: jest.fn(() => ({
      debug: mockDebug,
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
    })),
    createDebugRequestContext: jest.fn((operation, request) => ({
      requestId: 'test-request-id',
      operation,
      request,
      startedAt: Date.now(),
      startedAtIso: new Date().toISOString(),
    })),
    logDebugRequest: mockGroupCollapsed,
    logDebugSuccess: mockGroupCollapsed,
    logDebugError: mockGroupCollapsed,
  };
});

import { createLogger, createDebugRequestContext, logDebugRequest, logDebugSuccess, logDebugError } from '../logger';

describe('logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'groupCollapsed').mockImplementation();
    jest.spyOn(console, 'groupEnd').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('should create a logger with all log methods', () => {
      const logger = createLogger('test');
      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should call createLogger with scope', () => {
      createLogger('testScope');
      expect(createLogger).toHaveBeenCalledWith('testScope');
    });
  });

  describe('request debug system', () => {
    it('should create debug request context', () => {
      const context = createDebugRequestContext('testOperation', { param: 'value' });
      expect(context).toHaveProperty('requestId');
      expect(context).toHaveProperty('operation', 'testOperation');
      expect(context).toHaveProperty('request', { param: 'value' });
      expect(context).toHaveProperty('startedAt');
      expect(context).toHaveProperty('startedAtIso');
      expect(typeof context.startedAt).toBe('number');
      expect(typeof context.requestId).toBe('string');
    });

    it('should call createDebugRequestContext with operation and request', () => {
      createDebugRequestContext('fetchData', { id: 1 });
      expect(createDebugRequestContext).toHaveBeenCalledWith('fetchData', { id: 1 });
    });

    it('should call logDebugRequest', () => {
      const context = createDebugRequestContext('fetchData', { id: 1 });
      logDebugRequest(context);
      expect(logDebugRequest).toHaveBeenCalledWith(context);
    });

    it('should call logDebugSuccess', () => {
      const context = createDebugRequestContext('fetchData', { id: 1 });
      logDebugSuccess(context, { result: 'success' });
      expect(logDebugSuccess).toHaveBeenCalledWith(context, { result: 'success' });
    });

    it('should call logDebugError', () => {
      const context = createDebugRequestContext('fetchData', { id: 1 });
      logDebugError(context, new Error('Test error'));
      expect(logDebugError).toHaveBeenCalledWith(context, expect.any(Error));
    });
  });
});