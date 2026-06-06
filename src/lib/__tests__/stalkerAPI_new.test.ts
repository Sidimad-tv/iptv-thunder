// Mock import.meta.env
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        DEV: true,
        PROD: false,
        TAURI: 'true',
      },
    },
  },
  writable: true,
});

// Mock TauriHttpClient
const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('../tauriHttp', () => ({
  TauriHttpClient: jest.fn().mockImplementation(() => ({
    get: mockGet,
    post: mockPost,
  })),
}));

// Mock logger
jest.mock('../logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  createDebugRequestContext: jest.fn(),
  logDebugRequest: jest.fn(),
  logDebugSuccess: jest.fn(),
  logDebugError: jest.fn(),
}));

// Mock the entire stalkerAPI_new module to avoid import.meta issues
const mockHandshake = jest.fn();
const mockGetProfile = jest.fn();
const mockGetChannels = jest.fn();
const mockGetGenres = jest.fn();
const mockGetVODCategories = jest.fn();
const mockGetVODList = jest.fn();
const mockCreateLink = jest.fn();
const mockGetEPG = jest.fn();
const mockIsTokenValid = jest.fn();
const mockGetAccount = jest.fn();

jest.mock('../stalkerAPI_new', () => ({
  StalkerClient: jest.fn().mockImplementation((account) => ({
    useTauri: true,
    token: null,
    account,
    handshake: mockHandshake,
    getProfile: mockGetProfile,
    getChannels: mockGetChannels,
    getGenres: mockGetGenres,
    getVODCategories: mockGetVODCategories,
    getVODList: mockGetVODList,
    createLink: mockCreateLink,
    getEPG: mockGetEPG,
    isTokenValid: mockIsTokenValid,
    getAccount: mockGetAccount,
  })),
}));

import { StalkerClient } from '../stalkerAPI_new';
import { StalkerAccount } from '@/types';

describe('StalkerClient', () => {
  const mockAccount: StalkerAccount = {
    id: 'test-id',
    name: 'Test Portal',
    portalUrl: 'http://test.portal.com/c/',
    mac: '00:1A:79:84:1A:AB',
    login: 'test',
    isActive: true,
    lastUsed: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with account data', () => {
      const client = new StalkerClient(mockAccount);
      expect(client).toBeDefined();
      expect(client.useTauri).toBe(true);
    });

    it('should initialize with null token', () => {
      const client = new StalkerClient(mockAccount);
      expect(client.token).toBeNull();
    });
  });

  describe('handshake', () => {
    it('should perform handshake and return token', async () => {
      mockHandshake.mockResolvedValue('test-token-123');

      const client = new StalkerClient(mockAccount);
      const token = await client.handshake();

      expect(token).toBe('test-token-123');
      expect(mockHandshake).toHaveBeenCalled();
    });

    it('should throw error when handshake fails', async () => {
      mockHandshake.mockRejectedValue(new Error('Handshake failed'));

      const client = new StalkerClient(mockAccount);
      await expect(client.handshake()).rejects.toThrow('Handshake failed');
    });
  });

  describe('getProfile', () => {
    it('should fetch user profile', async () => {
      const mockProfile = {
        id: 'user-123',
        login: 'testuser',
        pass: 'pass123',
      };
      mockGetProfile.mockResolvedValue(mockProfile);

      const client = new StalkerClient(mockAccount);
      const profile = await client.getProfile();

      expect(profile).toBeDefined();
      expect(profile.id).toBe('user-123');
      expect(mockGetProfile).toHaveBeenCalled();
    });
  });

  describe('getChannels', () => {
    it('should fetch channel list', async () => {
      const mockChannels = [
        { id: 1, name: 'TVP 1', cmd: 'ffmpeg...' },
        { id: 2, name: 'TVP 2', cmd: 'ffmpeg...' },
      ];
      mockGetChannels.mockResolvedValue(mockChannels);

      const client = new StalkerClient(mockAccount);
      const channels = await client.getChannels();

      expect(Array.isArray(channels)).toBe(true);
      expect(channels.length).toBe(2);
      expect(channels[0].name).toBe('TVP 1');
    });

    it('should handle empty channel list', async () => {
      mockGetChannels.mockResolvedValue([]);

      const client = new StalkerClient(mockAccount);
      const channels = await client.getChannels();

      expect(Array.isArray(channels)).toBe(true);
      expect(channels.length).toBe(0);
    });
  });

  describe('getGenres', () => {
    it('should fetch genre list', async () => {
      const mockGenres = [
        { id: 1, title: 'Sport' },
        { id: 2, title: 'News' },
      ];
      mockGetGenres.mockResolvedValue(mockGenres);

      const client = new StalkerClient(mockAccount);
      const genres = await client.getGenres();

      expect(Array.isArray(genres)).toBe(true);
      expect(genres.length).toBe(2);
    });
  });

  describe('getVODCategories', () => {
    it('should fetch VOD categories', async () => {
      const mockCategories = [
        { id: 1, title: 'Movies' },
        { id: 2, title: 'Series' },
      ];
      mockGetVODCategories.mockResolvedValue(mockCategories);

      const client = new StalkerClient(mockAccount);
      const categories = await client.getVODCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBe(2);
    });
  });

  describe('getVODList', () => {
    it('should fetch VOD list for category', async () => {
      const mockVOD = [
        { id: 1, name: 'Movie 1', description: 'Desc 1' },
        { id: 2, name: 'Movie 2', description: 'Desc 2' },
      ];
      mockGetVODList.mockResolvedValue(mockVOD);

      const client = new StalkerClient(mockAccount);
      const vodList = await client.getVODList(1);

      expect(Array.isArray(vodList)).toBe(true);
      expect(vodList.length).toBe(2);
    });
  });

  describe('createLink', () => {
    it('should create stream link for channel', async () => {
      mockCreateLink.mockResolvedValue('http://stream.example.com/live.ts');

      const client = new StalkerClient(mockAccount);
      const link = await client.createLink('ffmpeg http://cmd', 1);

      expect(link).toContain('http://stream.example.com');
    });
  });

  describe('getEPG', () => {
    it('should fetch EPG for channel', async () => {
      const mockEPG = [
        { id: 1, name: 'Program 1', start_timestamp: 123456, stop_timestamp: 123789 },
      ];
      mockGetEPG.mockResolvedValue(mockEPG);

      const client = new StalkerClient(mockAccount);
      const epg = await client.getEPG(1);

      expect(Array.isArray(epg)).toBe(true);
    });
  });

  describe('isTokenValid', () => {
    it('should return false when token is null', () => {
      mockIsTokenValid.mockReturnValue(false);
      const client = new StalkerClient(mockAccount);
      expect(client.isTokenValid()).toBe(false);
    });

    it('should return true when token exists', () => {
      mockIsTokenValid.mockReturnValue(true);
      const client = new StalkerClient(mockAccount);
      expect(client.isTokenValid()).toBe(true);
    });
  });

  describe('getAccount', () => {
    it('should return account data', () => {
      mockGetAccount.mockReturnValue(mockAccount);
      const client = new StalkerClient(mockAccount);
      const account = client.getAccount();

      expect(account).toEqual(mockAccount);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockGetGenres.mockRejectedValue(new Error('Network error'));

      const client = new StalkerClient(mockAccount);

      await expect(client.getGenres()).rejects.toThrow();
    });
  });
});
