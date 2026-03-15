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
    window.location.href = '/login';
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
    registerClient: (data: { name: string; email: string; password: string; phone?: string; businessName: string; businessType: string; city: string; gstNumber?: string }) =>
      request<{ token: string; user: User }>('/api/auth/register-client', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request<User>('/api/auth/me'),
  },

  client: {
    me: () => request<ClientProfile>('/api/clients/me'),
    update: (data: Partial<ClientProfile>) =>
      request<ClientProfile>('/api/clients/me', { method: 'PUT', body: JSON.stringify(data) }),
  },

  venues: {
    list: () => request<Venue[]>('/api/venues'),
    create: (data: { name: string; address: string; city: string; latitude?: number; longitude?: number; isDefault?: boolean }) =>
      request<Venue>('/api/venues', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; address: string; city: string; latitude: number; longitude: number; isDefault: boolean }>) =>
      request<Venue>(`/api/venues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/venues/${id}`, { method: 'DELETE' }),
  },

  shifts: {
    list: (params?: { status?: string; upcoming?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Shift[]>(`/api/shifts${qs}`);
    },
    myShifts: (params?: { status?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<ShiftApplication[]>(`/api/shifts${qs}`);
    },
    available: () => request<Shift[]>('/api/shifts/available'),
    get: (id: string) => request<Shift>(`/api/shifts/${id}`),
    create: (data: {
      venueId: string; role: string; date: string; startTime: string; endTime: string;
      hourlyRate: number; currency?: string; workersNeeded?: number;
      notes?: string; requirements?: string[]; urgency?: string;
    }) => request<Shift>('/api/shifts', { method: 'POST', body: JSON.stringify(data) }),
    cancel: (id: string) => request<Shift>(`/api/shifts/${id}/cancel`, { method: 'POST' }),
    apply: (id: string) => request<ShiftApplication>(`/api/shifts/${id}/apply`, { method: 'POST' }),
    withdraw: (shiftId: string, appId: string) =>
      request<ShiftApplication>(`/api/shifts/${shiftId}/applications/${appId}/withdraw`, { method: 'POST' }),
    checkIn: (shiftId: string, appId: string) =>
      request<ShiftCheckIn>(`/api/shifts/${shiftId}/applications/${appId}/checkin`, { method: 'POST' }),
    checkOut: (shiftId: string, appId: string) =>
      request<ShiftCheckIn>(`/api/shifts/${shiftId}/applications/${appId}/checkout`, { method: 'POST' }),
    rate: (shiftId: string, appId: string, data: { rating: number; note?: string }) =>
      request<ShiftApplication>(`/api/shifts/${shiftId}/applications/${appId}/rate`, { method: 'POST', body: JSON.stringify(data) }),
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
    resetPassword: (id: string) => request<{ tempPassword: string }>(`/api/workers/${id}/reset-password`, { method: 'POST' }),
    getLocation: (id: string) => request<WorkerLocation>(`/api/workers/${id}/location`),
  },

  jobs: {
    list: (params?: { propertyId?: string; status?: string; type?: string; archived?: string; weekStart?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Job[]>(`/api/jobs${qs}`);
    },
    available: () => request<Job[]>('/api/jobs/available'),
    claim: (id: string) => request<Job>(`/api/jobs/${id}/claim`, { method: 'POST' }),
    get: (id: string) => request<Job>(`/api/jobs/${id}`),
    create: (data: Partial<Job>) =>
      request<Job>('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
    dispatch: (id: string, workerId: string) =>
      request<Job>(`/api/jobs/${id}/dispatch`, { method: 'POST', body: JSON.stringify({ workerId }) }),
    accept: (id: string) =>
      request<Job>(`/api/jobs/${id}/accept`, { method: 'POST' }),
    start: (id: string) =>
      request<Job>(`/api/jobs/${id}/start`, { method: 'POST' }),
    complete: (id: string, data?: { completionPhotoUrl?: string; completionVideoUrl?: string }) =>
      request<Job>(`/api/jobs/${id}/complete`, { method: 'POST', ...(data ? { body: JSON.stringify(data) } : {}) }),
    cancel: (id: string) =>
      request<Job>(`/api/jobs/${id}/cancel`, { method: 'POST' }),
    archive: (id: string) =>
      request<Job>(`/api/jobs/${id}/archive`, { method: 'POST' }),
    unarchive: (id: string) =>
      request<Job>(`/api/jobs/${id}/unarchive`, { method: 'POST' }),
    reportIssue: (id: string, data: { description: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; photoUrl?: string; videoUrl?: string }) =>
      request<{ id: string }>(`/api/jobs/${id}/issues`, { method: 'POST', body: JSON.stringify(data) }),
    listIssues: (params?: { severity?: string; status?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<JobIssue[]>(`/api/jobs/issues${qs}`);
    },
    resolveIssue: (issueId: string, status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED') =>
      request<JobIssue>(`/api/jobs/issues/${issueId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    dispatchWorkers: (propertyId: string) =>
      request<{ workerId: string; role: string; worker: { user: { name: string } } }[]>(
        `/api/jobs/dispatch-workers?propertyId=${encodeURIComponent(propertyId)}`
      ),
  },

  issues: {
    // Supervisor creates an issue without a mandatory job
    create: (data: { propertyId: string; jobId?: string; description: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; photoUrl?: string; videoUrl?: string }) =>
      request<JobIssue>('/api/issues', { method: 'POST', body: JSON.stringify(data) }),
    // List issues for a property
    list: (propertyId: string, params?: { severity?: string; status?: string }) => {
      const qs = new URLSearchParams({ propertyId, ...params }).toString();
      return request<JobIssue[]>(`/api/issues?${qs}`);
    },
    // Supervisor's supervised properties
    myProperties: () => request<{ id: string; name: string; city: string; _count: { issues: number } }[]>('/api/issues/my-properties'),
  },

  upload: {
    file: async (file: File): Promise<{ url: string; type: 'image' | 'video' }> => {
      const token = getToken();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Upload failed'); }
      return res.json();
    },
  },

  tradeRoles: {
    list: () => request<TradeRole[]>('/api/trade-roles'),
    create: (data: { name: string; description?: string; color?: string }) =>
      request<TradeRole>('/api/trade-roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<TradeRole>) =>
      request<TradeRole>(`/api/trade-roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/trade-roles/${id}`, { method: 'DELETE' }),
  },

  propertyStaff: {
    list: (propertyId: string) => request<PropertyStaffAssignment[]>(`/api/properties/${propertyId}/staff`),
    assign: (propertyId: string, data: { workerId: string; role: 'CARETAKER' | 'CLEANER' }) =>
      request<PropertyStaffAssignment>(`/api/properties/${propertyId}/staff`, { method: 'POST', body: JSON.stringify(data) }),
    remove: (propertyId: string, workerId: string) =>
      request<void>(`/api/properties/${propertyId}/staff/${workerId}`, { method: 'DELETE' }),
    getSettings: (propertyId: string) => request<MaintenanceSettings>(`/api/properties/${propertyId}/maintenance-settings`),
    updateSettings: (propertyId: string, data: Partial<MaintenanceSettings>) =>
      request<MaintenanceSettings>(`/api/properties/${propertyId}/maintenance-settings`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  maintenance: {
    list: (params?: { status?: string; propertyId?: string; priority?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<MaintenanceRequest[]>(`/api/maintenance${qs}`);
    },
    get: (id: string) => request<MaintenanceRequest>(`/api/maintenance/${id}`),
    create: (data: {
      propertyId: string; title: string; description: string;
      priority?: string; tradeRoleId?: string; photoUrl?: string; videoUrl?: string;
    }) => request<MaintenanceRequest>('/api/maintenance', { method: 'POST', body: JSON.stringify(data) }),
    review: (id: string, data: { action: 'APPROVE' | 'REJECT'; assignedWorkerId?: string; scheduledAt?: string; hostNotes?: string }) =>
      request<MaintenanceRequest>(`/api/maintenance/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),
    assign: (id: string, data: { assignedWorkerId: string; scheduledAt?: string }) =>
      request<MaintenanceRequest>(`/api/maintenance/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  },

  owners: {
    list: () => request<OwnerEntry[]>('/api/owners'),
    create: (data: { name: string; email: string; phone?: string }) =>
      request<OwnerEntry & { tempPassword: string }>('/api/owners', { method: 'POST', body: JSON.stringify(data) }),
    linkProperty: (ownerId: string, data: { propertyId: string; involvementLevel: string; ownershipPercent?: number; commissionPct?: number }) =>
      request<PropertyOwnership>(`/api/owners/${ownerId}/properties`, { method: 'POST', body: JSON.stringify(data) }),
    updateLink: (ownerId: string, propertyId: string, data: { involvementLevel?: string; ownershipPercent?: number; commissionPct?: number }) =>
      request<PropertyOwnership>(`/api/owners/${ownerId}/properties/${propertyId}`, { method: 'PUT', body: JSON.stringify(data) }),
    unlinkProperty: (ownerId: string, propertyId: string) =>
      request<void>(`/api/owners/${ownerId}/properties/${propertyId}`, { method: 'DELETE' }),
    delete: (id: string) => request<void>(`/api/owners/${id}`, { method: 'DELETE' }),
    dashboard: () => request<OwnerDashboard>('/api/owners/dashboard'),
  },

  revenueReports: {
    list: (params?: { propertyId?: string; month?: number; year?: number }) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
      ).toString() : '';
      return request<RevenueReport[]>(`/api/revenue-reports${qs}`);
    },
    get: (id: string) => request<RevenueReport>(`/api/revenue-reports/${id}`),
    create: (data: {
      propertyId: string; month: number; year: number;
      grossRevenue: number; airbnbServiceFees: number; netRevenue: number;
      commissionPct: number; airbnbReportUrl?: string; notes?: string;
    }) => request<RevenueReport>('/api/revenue-reports', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<RevenueReport>) =>
      request<RevenueReport>(`/api/revenue-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/revenue-reports/${id}`, { method: 'DELETE' }),
    addExpense: (reportId: string, data: {
      category: string; description: string; amount: number;
      expenseType: string; receiptUrl?: string; requiresApproval?: boolean;
    }) => request<Expense>(`/api/revenue-reports/${reportId}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
    updateExpense: (reportId: string, expenseId: string, data: Partial<Expense>) =>
      request<Expense>(`/api/revenue-reports/${reportId}/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteExpense: (reportId: string, expenseId: string) =>
      request<void>(`/api/revenue-reports/${reportId}/expenses/${expenseId}`, { method: 'DELETE' }),
    ownerReports: () => request<RevenueReport[]>('/api/revenue-reports/owner/reports'),
    reviewExpense: (reportId: string, expenseId: string, data: { action: 'APPROVE' | 'REJECT'; notes?: string }) =>
      request<Expense>(`/api/revenue-reports/${reportId}/expenses/${expenseId}/review`, { method: 'POST', body: JSON.stringify(data) }),
  },

  guide: {
    get: (propertyId: string) => request<PropertyGuide>(`/api/properties/${propertyId}/guide`),
    createArea: (propertyId: string, data: { name: string; floor?: string; description?: string; order?: number }) =>
      request<PropertyArea>(`/api/properties/${propertyId}/guide/areas`, { method: 'POST', body: JSON.stringify(data) }),
    updateArea: (propertyId: string, areaId: string, data: Partial<{ name: string; floor: string; description: string; order: number }>) =>
      request<PropertyArea>(`/api/properties/${propertyId}/guide/areas/${areaId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteArea: (propertyId: string, areaId: string) =>
      request<void>(`/api/properties/${propertyId}/guide/areas/${areaId}`, { method: 'DELETE' }),
    createDoc: (propertyId: string, data: { areaId?: string; title: string; description: string; category?: string; photos?: string[]; tags?: string[]; order?: number }) =>
      request<PropertyDoc>(`/api/properties/${propertyId}/guide/docs`, { method: 'POST', body: JSON.stringify(data) }),
    updateDoc: (propertyId: string, docId: string, data: Partial<PropertyDoc>) =>
      request<PropertyDoc>(`/api/properties/${propertyId}/guide/docs/${docId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDoc: (propertyId: string, docId: string) =>
      request<void>(`/api/properties/${propertyId}/guide/docs/${docId}`, { method: 'DELETE' }),
    createContact: (propertyId: string, data: { agency: string; name?: string; phones?: string[]; company?: string; notes?: string; order?: number }) =>
      request<PropertyContact>(`/api/properties/${propertyId}/guide/contacts`, { method: 'POST', body: JSON.stringify(data) }),
    updateContact: (propertyId: string, contactId: string, data: Partial<PropertyContact>) =>
      request<PropertyContact>(`/api/properties/${propertyId}/guide/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteContact: (propertyId: string, contactId: string) =>
      request<void>(`/api/properties/${propertyId}/guide/contacts/${contactId}`, { method: 'DELETE' }),
    submitAudit: (jobId: string, data: { rating: number; notes: string }) =>
      request<JobAudit>(`/api/jobs/${jobId}/audit`, { method: 'POST', body: JSON.stringify(data) }),
    getAudit: (jobId: string) => request<JobAudit>(`/api/jobs/${jobId}/audit`),
  },

  tradesmen: {
    list: (params?: { trade?: string; propertyId?: string; area?: string }) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][])
      ).toString() : '';
      return request<Tradesman[]>(`/api/tradesmen${qs}`);
    },
    create: (data: { name: string; trade: string; phones?: string[]; company?: string; notes?: string; area?: string; email?: string; propertyIds?: string[] }) =>
      request<Tradesman>('/api/tradesmen', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; trade: string; phones: string[]; company: string; notes: string; area: string; email: string; propertyIds: string[] }>) =>
      request<Tradesman>(`/api/tradesmen/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/tradesmen/${id}`, { method: 'DELETE' }),
    importFromContacts: (propertyId: string) =>
      request<{ created: number; skipped: number; total: number }>('/api/tradesmen/import', { method: 'POST', body: JSON.stringify({ propertyId }) }),
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
  worker?: { id: string; skills: string[]; rating: number; isAvailable: boolean; isSupervisor?: boolean };
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
  wifiName?: string;
  wifiPassword?: string;
  mapUrl?: string;
  checkInInstructions?: string;
  houseRules: string[];
  caretakerType: 'FULL_TIME' | 'PART_TIME';
  createdAt: string;
  _count?: { bookings: number; jobs: number };
}

export interface Booking {
  id: string;
  propertyId: string;
  property?: { id: string; name: string; city: string; country?: string };
  guestName: string;
  guestEmail?: string;
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
  guestCode?: string;
  lockCode?: string;
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
  latitude?: number;
  longitude?: number;
  rating?: number;
  jobsCompleted: number;
  bio?: string;
  _count?: { jobs: number };
  propertyStaff?: { id: string; propertyId: string; role: string; property: { id: string; name: string; type: string } }[];
}

export interface WorkerLocation {
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
  user: { name: string };
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
  completionPhotoUrl?: string;
  completionVideoUrl?: string;
  archivedAt?: string;
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
  photos: string[];
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

export interface JobIssue {
  id: string;
  jobId?: string;
  propertyId?: string;
  reportedById?: string;
  reportedBy?: { id: string; user: { name: string } };
  description: string;
  photoUrl?: string;
  videoUrl?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    type: string;
    scheduledAt: string;
    property?: { id: string; name: string };
    worker?: { user: { name: string } };
  };
}

export interface TradeRole {
  id: string;
  hostId: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
  _count?: { workers: number; maintenanceRequests: number };
}

export interface PropertyStaffAssignment {
  id: string;
  propertyId: string;
  workerId: string;
  role: 'CARETAKER' | 'CLEANER' | 'SUPERVISOR';
  createdAt: string;
  worker: Worker & { tradeRole?: TradeRole };
}

export interface PropertyArea {
  id: string;
  propertyId: string;
  name: string;
  floor?: string;
  description?: string;
  order: number;
  docs: PropertyDoc[];
  createdAt: string;
}

export interface PropertyDoc {
  id: string;
  propertyId: string;
  areaId?: string;
  title: string;
  description: string;
  category: 'STORAGE' | 'APPLIANCE' | 'ELECTRICAL' | 'UTILITY' | 'ACCESS' | 'SAFETY' | 'PROCEDURE' | 'OTHER';
  photos: string[];
  tags: string[];
  order: number;
  createdAt: string;
}

export interface PropertyContact {
  id: string;
  propertyId: string;
  agency: string;
  name?: string;
  phones: string[];
  company?: string;
  notes?: string;
  order: number;
  createdAt: string;
}

export interface Tradesman {
  id: string;
  hostId: string;
  name: string;
  trade: string;
  phones: string[];
  company?: string;
  notes?: string;
  area?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
  properties: {
    id: string;
    tradesmanId: string;
    propertyId: string;
    property: { id: string; name: string; city: string };
  }[];
}

export interface PropertyGuide {
  areas: PropertyArea[];
  ungroupedDocs: PropertyDoc[];
  contacts: PropertyContact[];
}

export interface JobAudit {
  id: string;
  jobId: string;
  supervisorId: string;
  supervisor?: { id: string; user: { name: string } };
  rating: number;
  notes: string;
  createdAt: string;
}

export interface MaintenanceSettings {
  propertyId: string;
  requireApproval: boolean;
  autoAssignTradeRoles: string[];
  allowCaretakerAssign: boolean;
}

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  property?: { id: string; name: string; city: string };
  reportedById: string;
  reportedBy?: { id: string; user: { id: string; name: string } };
  tradeRoleId?: string;
  tradeRole?: TradeRole;
  title: string;
  description: string;
  photoUrl?: string;
  videoUrl?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_ASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
  assignedWorkerId?: string;
  assignedWorker?: { id: string; user: { id: string; name: string } };
  jobId?: string;
  job?: { id: string; status: string };
  hostNotes?: string;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyOwnership {
  id: string;
  ownerId: string;
  propertyId: string;
  property?: { id: string; name: string; city: string };
  involvementLevel: 'NONE' | 'REPORTS_ONLY' | 'FINANCIAL' | 'FULL';
  ownershipPercent?: number;
  commissionPct?: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  reportId: string;
  propertyId: string;
  category: 'HOUSEKEEPING' | 'CONSUMABLES' | 'REPAIRS' | 'UTILITIES' | 'MISCELLANEOUS';
  description: string;
  amount: number;
  expenseType: 'SHARED' | 'OWNER_ONLY';
  receiptUrl?: string;
  requiresApproval: boolean;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedByUserId?: string;
  approvedAt?: string;
  approverNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueReport {
  id: string;
  propertyId: string;
  property?: { id: string; name: string; city: string };
  hostId: string;
  month: number;
  year: number;
  grossRevenue: number;
  airbnbServiceFees: number;
  netRevenue: number;
  commissionPct: number;
  commissionAmount: number;
  airbnbReportUrl?: string;
  status: 'DRAFT' | 'PUBLISHED';
  notes?: string;
  expenses: Expense[];
  createdAt: string;
  updatedAt: string;
}

export interface OwnerEntry {
  id: string;
  user: { id: string; name: string; email: string; phone?: string };
  properties: PropertyOwnership[];
}

export interface OwnerDashboard {
  owner: { id: string };
  properties: {
    propertyId: string;
    involvementLevel: string;
    ownershipPercent?: number;
    property: {
      id: string; name: string; city: string; type: string;
      activeBookings?: Booking[];
      recentRevenue?: number;
      activeJobs?: Job[];
      maintenanceRequests?: MaintenanceRequest[];
    };
  }[];
}

export interface ClientProfile {
  id: string;
  userId: string;
  businessName: string;
  businessType: 'RESTAURANT' | 'HOTEL' | 'VILLA' | 'RETAIL' | 'EVENT' | 'OTHER';
  gstNumber?: string;
  city: string;
  phone?: string;
  venues?: Venue[];
  _count?: { shifts: number };
  createdAt: string;
}

export interface Venue {
  id: string;
  clientId: string;
  name: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt: string;
}

export interface Shift {
  id: string;
  clientId: string;
  client?: { id: string; businessName: string; businessType: string };
  venueId: string;
  venue?: { id: string; name: string; address: string; city: string };
  role: string;
  date: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  currency: string;
  workersNeeded: number;
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  requirements: string[];
  urgency: 'ASAP' | 'SCHEDULED';
  cancelledAt?: string;
  createdAt: string;
  applications?: ShiftApplication[];
  _count?: { applications: number };
}

export interface ShiftApplication {
  id: string;
  shiftId: string;
  shift?: Shift;
  workerId: string;
  worker?: Worker & { user: { name: string; phone?: string; email: string } };
  status: 'PENDING' | 'CONFIRMED' | 'WITHDRAWN' | 'NO_SHOW' | 'COMPLETED';
  confirmedAt?: string;
  clientRating?: number;
  clientNote?: string;
  checkIn?: ShiftCheckIn;
  createdAt: string;
}

export interface ShiftCheckIn {
  id: string;
  applicationId: string;
  checkInAt?: string;
  checkOutAt?: string;
  hoursWorked?: number;
  createdAt: string;
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
