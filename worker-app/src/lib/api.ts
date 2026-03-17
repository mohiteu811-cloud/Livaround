import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://livaroundbackend-production.up.railway.app';
const TOKEN_KEY = 'livaround_worker_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  worker?: { id: string; skills: string[]; rating: number; isAvailable: boolean; jobsCompleted?: number };
}

export interface Property {
  id: string;
  name: string;
  city: string;
  address?: string;
  wifiName?: string;
  wifiPassword?: string;
  lockCode?: string;
}

export interface Job {
  id: string;
  propertyId: string;
  property?: Property;
  bookingId?: string;
  booking?: { id: string; guestName: string; checkIn: string; checkOut: string };
  workerId?: string;
  type: 'CLEANING' | 'COOKING' | 'DRIVING' | 'MAINTENANCE';
  status: 'PENDING' | 'DISPATCHED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledAt: string;
  completedAt?: string;
  completionPhotoUrl?: string;
  completionVideoUrl?: string;
  notes?: string;
  checklist?: { item: string; done: boolean }[];
  createdAt: string;
}

export interface Issue {
  id: string;
  jobId: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: string;
  photoUrl?: string;
  videoUrl?: string;
  createdAt: string;
}

export interface Worker {
  id: string;
  userId: string;
  skills: string[];
  isAvailable: boolean;
  rating?: number;
  jobsCompleted: number;
  bio?: string;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<User>('/api/auth/me'),
  },

  jobs: {
    list: (params?: { status?: string; workerId?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Job[]>(`/api/jobs${qs}`);
    },
    available: () => request<Job[]>('/api/jobs/available'),
    claim: (id: string) => request<Job>(`/api/jobs/${id}/claim`, { method: 'POST' }),
    get: (id: string) => request<Job>(`/api/jobs/${id}`),
    accept: (id: string) => request<Job>(`/api/jobs/${id}/accept`, { method: 'POST' }),
    start: (id: string) => request<Job>(`/api/jobs/${id}/start`, { method: 'POST' }),
    complete: (id: string, data?: { completionPhotoUrl?: string; completionVideoUrl?: string }) =>
      request<Job>(`/api/jobs/${id}/complete`, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
    reportIssue: (id: string, data: { description: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; photoUrl?: string; videoUrl?: string }) =>
      request<Issue>(`/api/jobs/${id}/issues`, { method: 'POST', body: JSON.stringify(data) }),
  },

  upload: {
    file: async (uri: string, mimeType: string): Promise<{ url: string; type: 'image' | 'video' }> => {
      const token = await getToken();
      const ext = uri.split('.').pop() ?? 'mp4';
      const body = new FormData();
      body.append('file', { uri, name: `upload.${ext}`, type: mimeType } as unknown as Blob);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Upload failed'); }
      return res.json();
    },
  },

  workers: {
    updateAvailability: (id: string, isAvailable: boolean) =>
      request<Worker>(`/api/workers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isAvailable }),
      }),
    registerPushToken: (id: string, pushToken: string) =>
      request<Worker>(`/api/workers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ pushToken }),
      }),
  },
};
