// =========================
// 🌐 PORTALS TYPES
// =========================
export interface PortalAccount {
  id: string;
  name: string;
  login: string;
  password: string;
  portalUrl: string;
  mac: string;
  token?: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  tags?: string[];
}

export interface PortalFormData {
  name: string;
  login: string;
  password: string;
  portalUrl: string;
  mac: string;
  description?: string;
  tags?: string[];
}

export interface PortalTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
  channels?: number;
  profile?: any;
  accountInfo?: { phone?: string };
}
