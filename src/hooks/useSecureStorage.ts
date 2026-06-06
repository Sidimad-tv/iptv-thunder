import { Stronghold, Client } from '@tauri-apps/plugin-stronghold';
import { appDataDir, join } from '@tauri-apps/api/path';

// Secure storage for IPTV authentication using Stronghold v2
const VAULT_PATH = 'iptv_vault';
const CLIENT_NAME = 'auth_client';

let strongholdInstance: Stronghold | null = null;
let clientInstance: Client | null = null;

async function initStronghold(password: string): Promise<{ stronghold: Stronghold; client: Client }> {
  if (strongholdInstance && clientInstance) {
    return { stronghold: strongholdInstance, client: clientInstance };
  }

  const appDir = await appDataDir();
  const vaultPath = await join(appDir, `${VAULT_PATH}.stronghold`);
  const stronghold = await Stronghold.load(vaultPath, password);

  let client: Client;
  try {
    client = await stronghold.loadClient(CLIENT_NAME);
  } catch {
    client = await stronghold.createClient(CLIENT_NAME);
  }

  strongholdInstance = stronghold;
  clientInstance = client;
  return { stronghold, client };
}

export interface SecureAuthData {
  macAddress?: string;
  token?: string;
  serverUrl?: string;
  credentials?: {
    username?: string;
    password?: string;
  };
  cookies?: Record<string, string>;
  expiresAt?: string;
}

export class SecureStorage {
  private readonly password: string;
  private stronghold: Stronghold | null = null;
  private client: Client | null = null;

  constructor(password: string = 'default_secure_password') {
    this.password = password;
  }

  async init(): Promise<void> {
    const { stronghold, client } = await initStronghold(this.password);
    this.stronghold = stronghold;
    this.client = client;
  }

  async saveAuthData(data: SecureAuthData): Promise<void> {
    if (!this.client) await this.init();
    if (!this.client || !this.stronghold) throw new Error('Secure storage not initialized');

    const store = this.client.getStore();
    const key = `auth_${data.macAddress || 'default'}`;
    const jsonData = JSON.stringify(data);
    const encoded = Array.from(new TextEncoder().encode(jsonData));

    await store.insert(key, encoded);
    await this.stronghold.save();
  }

  async getAuthData(macAddress?: string): Promise<SecureAuthData | null> {
    if (!this.client) await this.init();
    if (!this.client) throw new Error('Secure storage not initialized');

    const store = this.client.getStore();
    const key = `auth_${macAddress || 'default'}`;

    try {
      const data = await store.get(key);
      if (!data || data.length === 0) return null;
      const decoded = new TextDecoder().decode(new Uint8Array(data));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  async saveMacAddress(mac: string): Promise<void> {
    if (!this.client) await this.init();
    if (!this.client || !this.stronghold) throw new Error('Secure storage not initialized');

    const store = this.client.getStore();
    const encoded = Array.from(new TextEncoder().encode(mac));
    await store.insert(`mac_${mac}`, encoded);
    await this.stronghold.save();
  }

  async getMacAddress(mac?: string): Promise<string | null> {
    if (!this.client) await this.init();
    if (!this.client) throw new Error('Secure storage not initialized');

    const store = this.client.getStore();
    try {
      const data = await store.get(`mac_${mac || 'default'}`);
      if (!data || data.length === 0) return null;
      return new TextDecoder().decode(new Uint8Array(data));
    } catch {
      return null;
    }
  }

  async saveToken(token: string, identifier: string = 'default'): Promise<void> {
    if (!this.client) await this.init();
    if (!this.client || !this.stronghold) throw new Error('Secure storage not initialized');

    const store = this.client.getStore();
    const encoded = Array.from(new TextEncoder().encode(token));
    await store.insert(`token_${identifier}`, encoded);
    await this.stronghold.save();
  }

  async getToken(identifier: string = 'default'): Promise<string | null> {
    if (!this.client) await this.init();
    if (!this.client) throw new Error('Secure storage not initialized');

    const store = this.client.getStore();
    try {
      const data = await store.get(`token_${identifier}`);
      if (!data || data.length === 0) return null;
      return new TextDecoder().decode(new Uint8Array(data));
    } catch {
      return null;
    }
  }

  async clearAuth(): Promise<void> {
    if (!this.client) await this.init();
    if (!this.client || !this.stronghold) throw new Error('Secure storage not initialized');

    const store = this.client.getStore();
    // Remove all known keys
    const keys = ['auth_default', 'mac_default', 'token_default'];
    for (const key of keys) {
      try {
        await store.remove(key);
      } catch {}
    }
    await this.stronghold.save();
  }

  async unload(): Promise<void> {
    if (this.stronghold) {
      await this.stronghold.save();
      strongholdInstance = null;
      clientInstance = null;
      this.stronghold = null;
      this.client = null;
    }
  }
}

// Singleton instance with default password (should be changed in production)
export const secureStorage = new SecureStorage();

// React hook for secure storage
export function useSecureStorage() {
  return {
    secureStorage,
    init: () => secureStorage.init(),
    saveAuthData: (data: SecureAuthData) => secureStorage.saveAuthData(data),
    getAuthData: () => secureStorage.getAuthData(),
    saveMacAddress: (mac: string) => secureStorage.saveMacAddress(mac),
    getMacAddress: () => secureStorage.getMacAddress(),
    saveToken: (token: string) => secureStorage.saveToken(token),
    getToken: () => secureStorage.getToken(),
    clearAuth: () => secureStorage.clearAuth(),
  };
}
