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
  description?: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  amenities?: string[];
  isActive: boolean;
  images?: string[];
  wifiName?: string;
  wifiPassword?: string;
  mapUrl?: string;
  checkInInstructions?: string;
  houseRules?: string[];
  _count?: { bookings: number; jobs: number };
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
  createdAt?: string;
}

export interface GuestServiceRequest {
  id: string;
  bookingId: string;
  propertyId: string;
  type: 'HOUSEKEEPING' | 'COOK' | 'DRIVER' | 'CAR_RENTAL' | 'ARRIVAL_TIME' | 'EARLY_CHECK_IN' | 'DEPARTURE_TIME' | 'OTHER';
  requestedDate?: string;
  requestedTime?: string;
  notes?: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED';
  createdAt: string;
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
  archivedAt?: string;
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

export interface WorkerLocation {
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
  user: { name: string };
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
  worker: Worker;
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

export interface OwnerEntry {
  id: string;
  user: { id: string; name: string; email: string; phone?: string };
  properties: PropertyOwnership[];
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
  category: string;
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

export interface PropertyGuide {
  areas: PropertyArea[];
  ungroupedDocs: PropertyDoc[];
  contacts: PropertyContact[];
}

export interface RevenueReport {
  id: string;
  propertyId: string;
  property?: { id: string; name: string; city: string };
  month: number;
  year: number;
  grossRevenue: number;
  netRevenue: number;
  commissionPct: number;
  commissionAmount: number;
  status: string;
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
    updateSettings: (data: { autoDispatch?: boolean }) =>
      request<{ ok: boolean }>('/api/host-app/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getSettings: () => request<{ autoDispatch: boolean }>('/api/host-app/settings'),
  },

  properties: {
    list: () => request<Property[]>('/api/properties'),
    get: (id: string) => request<Property>(`/api/properties/${id}`),
    create: (data: Partial<Property>) =>
      request<Property>('/api/properties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Property>) =>
      request<Property>(`/api/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/properties/${id}`, { method: 'DELETE' }),
    getStaff: (propertyId: string) => request<PropertyStaffAssignment[]>(`/api/properties/${propertyId}/staff`),
  },

  propertyStaff: {
    list: (propertyId: string) => request<PropertyStaffAssignment[]>(`/api/properties/${propertyId}/staff`),
    assign: (propertyId: string, data: { workerId: string; role: string }) =>
      request<PropertyStaffAssignment>(`/api/properties/${propertyId}/staff`, { method: 'POST', body: JSON.stringify(data) }),
    remove: (propertyId: string, workerId: string) =>
      request<void>(`/api/properties/${propertyId}/staff/${workerId}`, { method: 'DELETE' }),
    getSettings: (propertyId: string) => request<MaintenanceSettings>(`/api/properties/${propertyId}/maintenance-settings`),
    updateSettings: (propertyId: string, data: Partial<MaintenanceSettings>) =>
      request<MaintenanceSettings>(`/api/properties/${propertyId}/maintenance-settings`, { method: 'PUT', body: JSON.stringify(data) }),
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
    guestRequests: (id: string) =>
      request<GuestServiceRequest[]>(`/api/bookings/${id}/guest-requests`),
    respondToGuestRequest: (bookingId: string, reqId: string, status: 'CONFIRMED' | 'DECLINED') =>
      request<{ id: string; status: string }>(`/api/bookings/${bookingId}/guest-requests/${reqId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  jobs: {
    list: (params?: { status?: string; propertyId?: string; archived?: string; weekStart?: string }) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
      ).toString() : '';
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
    unarchive: (id: string) =>
      request<Job>(`/api/jobs/${id}/unarchive`, { method: 'POST' }),
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
    getLocation: (id: string) =>
      request<WorkerLocation>(`/api/workers/${id}/location`),
  },

  issues: {
    list: (params?: { severity?: string; status?: string; propertyId?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Issue[]>(`/api/issues${qs}`);
    },
    get: (id: string) => request<Issue & { aiSuggestions?: any[]; job?: any; property?: any; reportedBy?: any }>(`/api/issues/${id}`),
    updateStatus: (id: string, status: string) =>
      request<Issue>(`/api/issues/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  maintenance: {
    list: (params?: { status?: string; propertyId?: string; priority?: string }) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
      ).toString() : '';
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
  },

  tradeRoles: {
    list: () => request<TradeRole[]>('/api/trade-roles'),
    create: (data: { name: string; description?: string; color?: string }) =>
      request<TradeRole>('/api/trade-roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<TradeRole>) =>
      request<TradeRole>(`/api/trade-roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/trade-roles/${id}`, { method: 'DELETE' }),
  },

  tradesmen: {
    list: (params?: { trade?: string; propertyId?: string }) => {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Tradesman[]>(`/api/tradesmen${qs}`);
    },
    create: (data: { name: string; trade: string; phones?: string[]; company?: string; notes?: string; area?: string; email?: string; propertyIds?: string[] }) =>
      request<Tradesman>('/api/tradesmen', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; trade: string; phones: string[]; company: string; notes: string; area: string; email: string; propertyIds: string[] }>) =>
      request<Tradesman>(`/api/tradesmen/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/tradesmen/${id}`, { method: 'DELETE' }),
  },

  revenueReports: {
    list: (params?: { propertyId?: string; month?: number; year?: number }) => {
      const qs = params ? '?' + new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
      ).toString() : '';
      return request<RevenueReport[]>(`/api/revenue-reports${qs}`);
    },
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
    loopInWorker: (id: string, workerId: string) =>
      request<Conversation>(`/api/conversations/${id}/loop-in-worker`, {
        method: 'PATCH',
        body: JSON.stringify({ workerId }),
      }),
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
