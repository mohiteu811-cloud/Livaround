const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('livaround_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('livaround_token');
    const isWorkerRoute = window.location.pathname.startsWith('/worker');
    window.location.href = isWorkerRoute ? '/worker/login' : '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

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

  analytics: {
    dashboard: () => request<DashboardStats>('/api/analytics/dashboard'),
  },

  properties: {
    list: () => request<Property[]>('/api/properties'),
    get: (id: string) => request<Property>(`/api/properties/${id}`),
    create: (data: Partial<Property>) =>
      request<Property>('/api/properties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Property>) =>
      request<Property>(`/api/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/properties/${id}`, { method: 'DELETE' }),
  },

  bookings: {
    list: (params?: { propertyId?: string; status?: string; source?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Booking[]>(`/api/bookings${qs}`);
    },
    get: (id: string) => request<Booking>(`/api/bookings/${id}`),
    create: (data: Partial<Booking>) =>
      request<Booking>('/api/bookings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Booking>) =>
      request<Booking>(`/api/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    checkIn: (id: string) => request<Booking>(`/api/bookings/${id}/checkin`, { method: 'POST' }),
    checkOut: (id: string) => request<Booking>(`/api/bookings/${id}/checkout`, { method: 'POST' }),
    cancel: (id: string) => request<void>(`/api/bookings/${id}`, { method: 'DELETE' }),
  },

  workers: {
    list: (params?: { skill?: string; available?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Worker[]>(`/api/workers${qs}`);
    },
    get: (id: string) => request<Worker>(`/api/workers/${id}`),
    create: (data: Partial<Worker> & { name: string; email: string; skills: string[] }) =>
      request<Worker>('/api/workers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Worker>) =>
      request<Worker>(`/api/workers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateAvailability: (id: string, isAvailable: boolean) =>
      request<Worker>(`/api/workers/${id}`, { method: 'PUT', body: JSON.stringify({ isAvailable }) }),
    delete: (id: string) => request<void>(`/api/workers/${id}`, { method: 'DELETE' }),
  },

  jobs: {
    list: (params?: { propertyId?: string; status?: string; type?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Job[]>(`/api/jobs${qs}`);
    },
    get: (id: string) => request<Job>(`/api/jobs/${id}`),
    create: (data: Partial<Job>) =>
      request<Job>('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
    dispatch: (id: string, workerId: string) =>
      request<Job>(`/api/jobs/${id}/dispatch`, { method: 'POST', body: JSON.stringify({ workerId }) }),
    accept: (id: string) =>
      request<Job>(`/api/jobs/${id}/accept`, { method: 'POST' }),
    start: (id: string) =>
      request<Job>(`/api/jobs/${id}/start`, { method: 'POST' }),
    complete: (id: string) =>
      request<Job>(`/api/jobs/${id}/complete`, { method: 'POST' }),
    cancel: (id: string) =>
      request<Job>(`/api/jobs/${id}/cancel`, { method: 'POST' }),
    reportIssue: (id: string, data: { description: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; photoUrl?: string }) =>
      request<{ id: string }>(`/api/jobs/${id}/issues`, { method: 'POST', body: JSON.stringify(data) }),
  },

  inventory: {
    list: (params?: { propertyId?: string; lowStock?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<InventoryItem[]>(`/api/inventory${qs}`);
    },
    lowStock: () => request<InventoryItem[]>('/api/inventory/low-stock'),
    create: (data: Partial<InventoryItem>) =>
      request<InventoryItem>('/api/inventory', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<InventoryItem>) =>
      request<InventoryItem>(`/api/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/inventory/${id}`, { method: 'DELETE' }),
    cabinets: {
      list: (propertyId?: string) => {
        const qs = propertyId ? `?propertyId=${propertyId}` : '';
        return request<SupplyCabinet[]>(`/api/inventory/cabinets${qs}`);
      },
      create: (data: Partial<SupplyCabinet>) =>
        request<SupplyCabinet>('/api/inventory/cabinets', { method: 'POST', body: JSON.stringify(data) }),
    },
  },
};

// --- Types ---

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  host?: { id: string; name: string };
  worker?: { id: string; skills: string[]; rating: number; isAvailable: boolean };
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  description?: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  amenities: string[];
  images: string[];
  isActive: boolean;
  airbnbUrl?: string;
  createdAt: string;
  _count?: { bookings: number; jobs: number };
}

export interface Booking {
  id: string;
  propertyId: string;
  property?: { id: string; name: string; city: string; country?: string };
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  totalAmount: number;
  currency: string;
  status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  source: string;
  externalId?: string;
  notes?: string;
  createdAt: string;
  _count?: { jobs: number };
}

export interface Worker {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; phone?: string };
  skills: string[];
  isAvailable: boolean;
  location?: string;
  rating?: number;
  jobsCompleted: number;
  bio?: string;
  _count?: { jobs: number };
}

export interface Job {
  id: string;
  propertyId: string;
  property?: { id: string; name: string; city: string };
  bookingId?: string;
  booking?: { id: string; guestName: string; checkIn: string; checkOut: string };
  workerId?: string;
  worker?: Worker & { user: { name: string; phone?: string } };
  type: 'CLEANING' | 'COOKING' | 'DRIVING' | 'MAINTENANCE';
  status: 'PENDING' | 'DISPATCHED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledAt: string;
  completedAt?: string;
  notes?: string;
  checklist?: { item: string; done: boolean }[];
  _count?: { issues: number };
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  propertyId: string;
  property?: { id: string; name: string };
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  unit: string;
  location?: string;
  lastRestocked?: string;
}

export interface SupplyCabinet {
  id: string;
  propertyId: string;
  property?: { id: string; name: string };
  name: string;
  location: string;
  photoUrl?: string;
  qrCode: string;
  description?: string;
}

export interface DashboardStats {
  stats: {
    totalProperties: number;
    activeBookings: number;
    pendingJobs: number;
    totalWorkers: number;
    monthlyRevenue: number;
    monthlyBookings: number;
    completedJobsThisMonth: number;
    lowStockAlerts: number;
    revenueGrowth: number | null;
  };
  recentBookings: Booking[];
  upcomingJobs: Job[];
  jobsByStatus: { status: string; _count: number }[];
  bookingsBySource: { source: string; _count: number; _sum: { totalAmount: number } }[];
  revenueByMonth: { month: string; revenue: number; bookings: number }[];
  lowStockAlerts: InventoryItem[];
}
