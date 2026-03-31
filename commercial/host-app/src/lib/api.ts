import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://livaroundbackend-production.up.railway.app';
const TOKEN_KEY = 'livaround_host_token';

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

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  host?: { id: string; name: string };
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  isActive: boolean;
  images?: string[];
}

export interface Booking {
  id: string;
  propertyId: string;
  property?: { id: string; name: string };
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  totalAmount: number;
  currency: string;
  status: string;
  source: string;
  guestCode?: string;
  lockCode?: string;
  notes?: string;
}

export interface Job {
  id: string;
  propertyId: string;
  property?: { id: string; name: string };
  bookingId?: string;
  workerId?: string;
  worker?: { id: string; user: { name: string } };
  type: string;
  status: string;
  scheduledAt: string;
  completedAt?: string;
  notes?: string;
  checklist?: { item: string; done: boolean }[];
}

export interface Worker {
  id: string;
  skills: string[];
  isAvailable: boolean;
  isGigWorker?: boolean;
  jobsCompleted: number;
  user: { id: string; name: string; email: string; phone?: string };
  name?: string;
  email?: string;
  phone?: string;
}

export interface Conversation {
  id: string;
  bookingId: string;
  booking?: {
    id: string;
    checkIn: string;
    checkOut: string;
    status: string;
    property: { id: string; name: string };
  };
  guestName: string;
  guestCode: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadByHost: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: 'HOST' | 'GUEST' | 'WORKER' | 'SYSTEM';
  senderName: string;
  content: string;
  imageUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
  voiceTranscript?: string;
  voiceTranslation?: string;
  voiceLanguage?: string;
  isSystemMessage: boolean;
  readByHost: boolean;
  readByGuest: boolean;
  createdAt: string;
}

export interface DashboardSummary {
  todayCheckIns: number;
  todayCheckOuts: number;
  pendingJobs: number;
  activeBookings: number;
  unreadMessages: number;
  openIssues: number;
  propertyCount: number;
  subscription: {
    plan: string;
    status: string;
    features: Record<string, boolean>;
  };
}

export interface Issue {
  id: string;
  jobId?: string;
  propertyId: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  photoUrl?: string;
  videoUrl?: string;
  createdAt: string;
}

// ── API Client ───────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data: { name: string; email: string; password: string; phone?: string }) =>
      request<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request<User>('/api/auth/me'),
  },

  hostApp: {
    dashboard: () => request<DashboardSummary>('/api/host-app/dashboard'),
    bookingsCalendar: (month: string) =>
      request<Booking[]>(`/api/host-app/bookings-calendar?month=${month}`),
    registerPushToken: (pushToken: string) =>
      request<{ ok: boolean }>('/api/host-app/register-push-token', {
        method: 'POST',
        body: JSON.stringify({ pushToken }),
      }),
  },

  properties: {
    list: () => request<Property[]>('/api/properties'),
    get: (id: string) => request<Property>(`/api/properties/${id}`),
  },

  bookings: {
    list: (params?: { propertyId?: string; status?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Booking[]>(`/api/bookings${qs}`);
    },
    get: (id: string) => request<Booking>(`/api/bookings/${id}`),
    create: (data: {
      propertyId: string;
      guestName: string;
      guestEmail?: string;
      guestPhone?: string;
      checkIn: string;
      checkOut: string;
      guestCount?: number;
      totalAmount: number;
      currency?: string;
      source?: string;
      notes?: string;
      lockCode?: string;
    }) =>
      request<Booking>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Booking>) =>
      request<Booking>(`/api/bookings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/api/bookings/${id}`, { method: 'DELETE' }),
    checkin: (id: string) =>
      request<Booking>(`/api/bookings/${id}/checkin`, { method: 'POST' }),
    checkout: (id: string) =>
      request<Booking>(`/api/bookings/${id}/checkout`, { method: 'POST' }),
  },

  jobs: {
    list: (params?: { status?: string; propertyId?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Job[]>(`/api/jobs${qs}`);
    },
    get: (id: string) => request<Job>(`/api/jobs/${id}`),
    create: (data: {
      propertyId: string;
      bookingId?: string;
      type: string;
      scheduledAt: string;
      notes?: string;
      workerId?: string;
      checklist?: { item: string; done: boolean }[];
    }) =>
      request<Job>('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    dispatch: (id: string, workerId: string) =>
      request<Job>(`/api/jobs/${id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({ workerId }),
      }),
    accept: (id: string) =>
      request<Job>(`/api/jobs/${id}/accept`, { method: 'POST' }),
    start: (id: string) =>
      request<Job>(`/api/jobs/${id}/start`, { method: 'POST' }),
    complete: (id: string, data?: { completionPhotoUrl?: string; completionVideoUrl?: string }) =>
      request<Job>(`/api/jobs/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
    cancel: (id: string) =>
      request<Job>(`/api/jobs/${id}/cancel`, { method: 'POST' }),
    archive: (id: string) =>
      request<Job>(`/api/jobs/${id}/archive`, { method: 'POST' }),
    dispatchWorkers: (propertyId: string) =>
      request<Worker[]>(`/api/jobs/dispatch-workers?propertyId=${propertyId}`),
    issues: (id: string) =>
      request<Issue[]>(`/api/jobs/${id}/issues`),
    reportIssue: (id: string, data: { description: string; severity: string; photoUrl?: string; videoUrl?: string }) =>
      request<Issue>(`/api/jobs/${id}/issues`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  workers: {
    list: () => request<Worker[]>('/api/workers'),
    get: (id: string) => request<Worker>(`/api/workers/${id}`),
    create: (data: { name: string; email: string; phone?: string; skills: string[] }) =>
      request<Worker & { tempPassword: string }>('/api/workers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { name?: string; phone?: string; skills?: string[]; isAvailable?: boolean }) =>
      request<Worker>(`/api/workers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/api/workers/${id}`, { method: 'DELETE' }),
    resetPassword: (id: string) =>
      request<{ tempPassword: string }>(`/api/workers/${id}/reset-password`, { method: 'POST' }),
  },

  issues: {
    list: (params?: { severity?: string; status?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Issue[]>(`/api/jobs/issues${qs}`);
    },
    update: (id: string, data: { status: string }) =>
      request<Issue>(`/api/jobs/issues/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  conversations: {
    list: () => request<Conversation[]>('/api/conversations'),
    get: (id: string, before?: string) => {
      const qs = before ? `?before=${before}` : '';
      return request<{ conversation: Conversation; messages: Message[]; hasMore: boolean }>(
        `/api/conversations/${id}${qs}`
      );
    },
    sendMessage: (id: string, content: string, imageUrl?: string, voiceUrl?: string, voiceDuration?: number, visibility?: string) =>
      request<Message>(`/api/conversations/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, imageUrl, voiceUrl, voiceDuration, visibility }),
      }),
    markRead: (id: string) =>
      request<{ ok: boolean }>(`/api/conversations/${id}/read`, { method: 'PATCH' }),
  },

  internalConversations: {
    list: () => request<any[]>('/api/internal-conversations'),
    get: (id: string, before?: string) => {
      const qs = before ? `?before=${before}` : '';
      return request<{ conversation: any; messages: any[]; hasMore: boolean }>(
        `/api/internal-conversations/${id}${qs}`
      );
    },
    create: (workerId: string, propertyId?: string) =>
      request<any>('/api/internal-conversations', {
        method: 'POST',
        body: JSON.stringify({ workerId, propertyId, channelType: 'HOST_WORKER' }),
      }),
    sendMessage: (id: string, content: string, imageUrl?: string, voiceUrl?: string, voiceDuration?: number, visibility?: string) =>
      request<any>(`/api/internal-conversations/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, imageUrl, voiceUrl, voiceDuration, visibility }),
      }),
    markRead: (id: string) =>
      request<{ ok: boolean }>(`/api/internal-conversations/${id}/read`, { method: 'PATCH' }),
  },

  aiSuggestions: {
    list: (status?: string) => {
      const qs = status ? `?status=${status}` : '';
      return request<any[]>(`/api/ai-suggestions${qs}`);
    },
    forConversation: (conversationId: string) =>
      request<any[]>(`/api/ai-suggestions/conversation/${conversationId}`),
    approve: (id: string, overrides?: any) =>
      request<{ ok: boolean; createdIssueId?: string; createdJobId?: string }>(
        `/api/ai-suggestions/${id}/approve`,
        { method: 'POST', body: JSON.stringify(overrides || {}) }
      ),
    dismiss: (id: string) =>
      request<{ ok: boolean }>(`/api/ai-suggestions/${id}/dismiss`, { method: 'POST' }),
  },

  billing: {
    features: () => request<{ plan: string; features: Record<string, boolean> }>('/api/billing/features'),
    status: () => request<any>('/api/billing/status'),
  },

  upload: {
    file: async (uri: string, mimeType: string): Promise<{ url: string; type: 'image' | 'video' }> => {
      const token = await getToken();
      const ext = uri.split('.').pop() ?? 'jpg';
      const body = new FormData();
      body.append('file', { uri, name: `upload.${ext}`, type: mimeType } as unknown as Blob);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || 'Upload failed');
      }
      return res.json();
    },
  },
};
