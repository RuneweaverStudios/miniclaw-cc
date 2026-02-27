// API client using fetch with proper typing
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      ...this.defaultHeaders,
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          message: 'An unknown error occurred',
        }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

// Type definitions for API responses
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface Server {
  id: string;
  name: string;
  instanceType: string;
  region: string;
  status: 'pending' | 'running' | 'stopped' | 'terminated' | 'error';
  stackId: string;
  userId: string;
  publicIp?: string;
  privateIp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stack {
  id: string;
  name: string;
  description: string;
  version: string;
  services: string[];
  cpu: number;
  memory: number;
  price: number;
  available: boolean;
}

export interface PoolStats {
  totalServers: number;
  runningServers: number;
  availableServers: number;
  pendingServers: number;
  errorServers: number;
}

export interface BillingUsage {
  period: string;
  computeHours: number;
  storageGb: number;
  networkGb: number;
  totalCost: number;
}

export interface Metrics {
  cpu: { timestamp: string; value: number }[];
  memory: { timestamp: string; value: number }[];
  network: { timestamp: string; value: number }[];
}

// Auth API
export const authApi = {
  signup: (data: {
    email: string;
    password: string;
    name: string;
    stack?: string;
  }) => api.post<{ user: User; token: string }>('/auth/signup', data),

  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<User>('/auth/me'),
};

// Servers API
export const serversApi = {
  list: () => api.get<Server[]>('/servers'),

  get: (id: string) => api.get<Server>(`/servers/${id}`),

  create: (data: {
    name: string;
    stackId: string;
    region: string;
  }) => api.post<Server>('/servers', data),

  start: (id: string) => api.post<Server>(`/servers/${id}/start`),

  stop: (id: string) => api.post<Server>(`/servers/${id}/stop`),

  restart: (id: string) => api.post<Server>(`/servers/${id}/restart`),

  terminate: (id: string) => api.delete<Server>(`/servers/${id}`),

  getMetrics: (id: string, period?: string) =>
    api.get<Metrics>(`/servers/${id}/metrics${period ? `?period=${period}` : ''}`),
};

// Stacks API
export const stacksApi = {
  list: () => api.get<Stack[]>('/stacks'),

  get: (id: string) => api.get<Stack>(`/stacks/${id}`),
};

// Pool API (admin)
export const poolApi = {
  getStats: () => api.get<PoolStats>('/pool/stats'),

  adjustSize: (data: { region: string; instanceType: string; size: number }) =>
    api.post<void>('/pool/adjust', data),

  getHistory: () => api.get<{ timestamp: string; event: string }[]>('/pool/history'),
};

// Users API (admin)
export const usersApi = {
  list: () => api.get<User[]>('/admin/users'),

  get: (id: string) => api.get<User>(`/admin/users/${id}`),

  updateRole: (id: string, role: 'user' | 'admin') =>
    api.patch<User>(`/admin/users/${id}/role`, { role }),

  deactivate: (id: string) => api.post<void>(`/admin/users/${id}/deactivate`),
};

// Billing API
export const billingApi = {
  getUsage: (period?: string) =>
    api.get<BillingUsage>(`/billing/usage${period ? `?period=${period}` : ''}`),

  getInvoices: () =>
    api.get<{ id: string; amount: number; date: string; status: string }[]>(
      '/billing/invoices'
    ),
};
