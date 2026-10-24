/**
 * AI Closer Central API Adapter (v1.2)
 * Production Base: https://api.aicloser.in/api/v1
 * Supports: Cookie-based auth (credentials: "include") + Bearer JWT fallback,
 * automatic installationId generation for desktop browser,
 * query-param SSE authentication, Google Drive Storage Vault, and standard response unwrapping.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_AICLOSER_API_URL ||
  'https://api.aicloser.in/api/v1';

export function getCentralApiBaseUrl() {
  return typeof window === 'undefined' ? API_BASE_URL : '/api/v1';
}

function handleCentralAuthFailure(status: number, message: string) {
  if (typeof window === 'undefined') return;

  if (status === 401) {
    const isImpersonating = Boolean(
      localStorage.getItem('aicloser_impersonating_tenant') ||
      localStorage.getItem('aicloser_impersonating_name') ||
      (typeof document !== 'undefined' && (
        document.cookie.includes('gx_impersonating_name') ||
        document.cookie.includes('gx_super_admin_return') ||
        document.cookie.includes('gx_impersonating_agency')
      ))
    );

    // If currently impersonating, do not wipe tokens and do not trap user on /login
    if (isImpersonating) {
      console.warn('[AI Closer Impersonation Auth Warning]:', message);
      window.dispatchEvent(new CustomEvent('aicloser:auth-unauthorized', {
        detail: { status, message: message || 'Session context refreshed' },
      }));
      return;
    }

    setStoredToken(null);
    window.dispatchEvent(new CustomEvent('aicloser:auth-unauthorized', {
      detail: { status, message: message || 'Authentication token missing or expired. Redirecting to login.' },
    }));

    const pathname = window.location.pathname;
    const isPublicPage =
      pathname === '/login' ||
      pathname === '/signup' ||
      pathname.startsWith('/super-admin') ||
      pathname.startsWith('/pay/') ||
      pathname.startsWith('/forms/public/');

    if (!isPublicPage) {
      window.location.href = `/login?from=${encodeURIComponent(pathname)}`;
    }
    return;
  }

  if (status === 403) {
    window.dispatchEvent(new CustomEvent('aicloser:api-error', {
      detail: { status, message: message || 'You do not have permission to perform this action.' },
    }));
  }
}

// ==========================================
// Types
// ==========================================


export interface DashboardSummaryResponse {
  totalLeads: number;
  hotLeads: number;
  followUpsToday: number;
  followUpsPending: number;
  wonCount: number;
  wonAmount: number;
  settledRevenue?: number;
  lostCount: number;
  pipelineValue: number;
  pendingPaymentLinksCount?: number;
  pendingPaymentLinksAmount?: number;
  pendingVerificationCount?: number;
  pendingVerificationAmount?: number;
  openLinksCount?: number;
  openLinksAmount?: number;
  conversionRate: number;
  stageCounts: Record<string, number>;
  missedCount?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string | null;
}

export interface UserSession {
  userId: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SALES_AGENT';
  tenantId: string;
  themePreference?: 'light' | 'dark' | string;
}

export interface Lead {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  assignedAgentId?: string;
  source?: string;
  serviceInterest?: string;
  segment?: string;
  tags?: string[];
  conversationId?: string | null;
  lastContactedAt?: string | null;
  stage: string;
  kanbanPosition?: number;
  priority?: string;
  budgetAmount?: number;
  notes?: string;
  followUpAt?: string;
  totalCallsCount?: number;
  lastCallDurationSec?: number;
  lastCallDisposition?: string;
  aiScore?: number;
  aiSentiment?: 'HOT' | 'WARM' | 'COLD';
  aiSummary?: string;
  isDndActive?: boolean;
  lostReason?: string;
  lostReasonNotes?: string;
  customFields?: Record<string, any>;
  assignedAgent?: {
    id: string;
    agentCode?: string;
    displayName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LeadPoolItem {
  id: string;
  assignedAgentId?: string | null;
  claimedByAgentId?: string | null;
  convertedAssignmentId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  source?: string;
  serviceInterest?: string | null;
  segment?: string | null;
  priority?: string;
  budgetAmount?: number | string | null;
  status: 'OPEN' | 'CLAIMED' | 'ARCHIVED';
  notes?: string | null;
  followUpAt?: string | null;
  claimedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CentralContact {
  id: string;
  tenantId: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  e164Phone: string;
  email?: string | null;
  source?: string;
  leadId?: string | null;
  assignedAgentId?: string | null;
  assignedAgent?: {
    id: string;
    displayName?: string | null;
    email?: string | null;
  } | null;
  tags?: string[];
  customFields?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type LeadUpdatePayload = Omit<Partial<Lead>, 'customerPhone' | 'customerEmail' | 'serviceInterest' | 'segment' | 'followUpAt' | 'tags'> & {
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceInterest?: string | null;
  segment?: string | null;
  followUpAt?: string | null;
  tags?: string[];
};

export interface LeadTimelineEntry {
  id: string;
  body: string;
  type?: string;
  createdAt: string;
  author?: { id: string; name: string };
}

export interface LeadHistoryEntry {
  id: string;
  kind: string;
  title: string;
  body?: string;
  createdAt: string;
  dueAt?: string | null;
  status?: string;
  actorName?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface Lead360Response {
  lead: Lead;
  assignedAgent: {
    id: string;
    agentCode?: string;
    displayName?: string;
    email?: string;
    phone?: string;
  } | null;
  timelineNotes: LeadTimelineEntry[];
  timeline?: LeadTimelineEntry[];
  activityLogs?: Array<Record<string, unknown>>;
  history?: LeadHistoryEntry[];
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    createdAt?: string;
    dueAt?: string;
    priority?: string;
    status?: string;
    isCompleted?: boolean;
  }>;
  callLogs: CallLog[];
  calls?: CallLog[];
  activeConversation: {
    id: string;
    status: string;
    unreadCount?: number;
    updatedAt: string;
    lastMessage?: {
      id?: string;
      body: string;
      createdAt: string;
      senderRole: string;
    };
  } | null;
  conversation?: {
    id: string;
    status: string;
    updatedAt: string;
  } | null;
  payments: Array<{
    id: string;
    totalAmount?: number;
    baseAmount?: number;
    currency: string;
    status: string;
    customerName?: string;
    customerPhone?: string;
    utrReference?: string;
    createdAt: string;
  }>;
  customFieldDefinitions: Array<{
    key: string;
    label: string;
    type: string;
    isRequired: boolean;
    options?: string[];
  }>;
  customFieldsDefinition?: Array<{
    key: string;
    label: string;
    type: string;
    isRequired: boolean;
    options?: string[];
  }>;
}

export interface StageAggregate {
  stage: string;
  count: number;
  totalValue: number;
  weightedValue: number;
}

export interface StageDefinition {
  id: string;
  key?: string;
  label: string;
  color: string;
  probability: number;
  position: number;
  leadsCount?: number;
  isCustom?: boolean;
}

export interface Conversation {
  id: string;
  customerName: string;
  customerPhone: string;
  unreadCount: number;
  stage?: string;
  lastMessage?: {
    id: string;
    body: string;
    lane?: string;
    senderRole: string;
    senderLabel?: string;
    createdAt: string;
  };
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  body: string;
  lane?: string;
  senderRole: 'customer' | 'sales' | 'system' | 'ai';
  senderLabel?: string;
  attachments?: Array<{
    id?: string;
    name: string;
    mimeType?: string;
    sizeBytes?: number;
    url?: string;
    externalUrl?: string;
  }>;
  createdAt: string;
}

export interface MessagesResponse {
  conversationId: string;
  customerName: string;
  customerPhone: string;
  status?: string;
  messages: ChatMessage[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
    totalInThread: number;
  };
}

export interface CallLog {
  id: string;
  phoneNumber: string;
  durationSeconds: number;
  direction?: 'INBOUND' | 'OUTBOUND';
  status: string;
  recordingStatus?: string;
  recordingError?: string | null;
  recordingUploadId?: string | null;
  hasRecording?: boolean;
  recordingUrl?: string;
  outcome?: string;
  note?: string;
  endedAt?: string | null;
  agent?: {
    id: string;
    agentCode?: string;
    user?: { displayName?: string | null };
  };
  assignment?: {
    id?: string;
    customerName: string;
    customerPhone?: string;
    stage?: string;
  };
  startedAt: string;
}

export interface GoogleDriveStatus {
  isConnected: boolean;
  connectedEmail?: string;
  rootFolderName: string;
  rootFolderId?: string;
  recordingsFolderName?: string;
  recordingsFolderId?: string;
  backupRecordings: boolean;
  backupMedia: boolean;
  connectedAt?: string;
  lastSyncAt?: string;
  lastSyncError?: string;
  isMockDemo?: boolean;
}

export interface WorkspaceTask {
  id: string;
  salesLeadId: string;
  title: string;
  description?: string | null;
  priority?: string;
  status?: string;
  dueAt?: string | null;
  completedAt?: string | null;
  lead?: {
    id: string;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    stage?: string;
    budgetAmount?: number | null;
    assignedAgentName?: string | null;
  } | null;
}

// ==========================================
// Client Helper & Token Storage
// ==========================================

const TOKEN_KEY = 'aicloser_auth_token';
const INSTALL_ID_KEY = 'aicloser_installation_id';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('aicloser_token');
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('aicloser_token', token);
    try {
      document.cookie = `aicloser_token=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    } catch {
      // ignore
    }
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('aicloser_token');
    try {
      document.cookie = 'aicloser_token=; path=/; max-age=0; SameSite=Lax';
    } catch {
      // ignore
    }
  }
}

export function getOrCreateInstallationId(): string {
  if (typeof window === 'undefined') return 'server-side';
  let id = localStorage.getItem(INSTALL_ID_KEY);
  if (!id) {
    id = `browser-${Math.random().toString(36).substring(2, 11)}-${Date.now()}`;
    localStorage.setItem(INSTALL_ID_KEY, id);
  }
  return id;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; pagination?: ApiResponse<T>['pagination'] }> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Cross-tenant impersonation override: only apply if explicit super-admin impersonation is active
  if (typeof window !== 'undefined' && !headers.has('x-target-tenant-id')) {
    const impersonatedTenant = localStorage.getItem('aicloser_impersonating_tenant');
    if (impersonatedTenant) {
      headers.set('x-target-tenant-id', decodeURIComponent(impersonatedTenant));
    }
  }

  const url = `${getCentralApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Send HTTP-only cookie automatically
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.success === false) {
    const errorMsg = json.message || json.error || `Request failed with status ${response.status}`;
    handleCentralAuthFailure(response.status, String(errorMsg));
    const error = new Error(String(errorMsg)) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return {
    ...json,
    data: json.data as T,
    pagination: json.pagination,
  };
}

async function requestConversation<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; pagination?: ApiResponse<T>['pagination']; [key: string]: any }> {
  const useSameOriginProxy = typeof window !== 'undefined';
  if (!useSameOriginProxy) {
    return request<T>(path, options);
  }

  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Cross-tenant impersonation override: only apply if explicit super-admin impersonation is active
  if (typeof window !== 'undefined' && !headers.has('x-target-tenant-id')) {
    const impersonatedTenant = localStorage.getItem('aicloser_impersonating_tenant');
    if (impersonatedTenant) {
      headers.set('x-target-tenant-id', decodeURIComponent(impersonatedTenant));
    }
  }
  const response = await fetch(`/api/v1${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.success === false) {
    const errorMsg = json?.error || json?.message || `Request failed with status ${response.status}`;
    handleCentralAuthFailure(response.status, String(errorMsg));
    const error = new Error(String(errorMsg)) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return {
    ...json,
    data: (json?.data !== undefined ? json.data : json) as T,
    pagination: json?.pagination,
  };
}

// ==========================================
// Central API Methods
// ==========================================

export const aicloserApi = {
  // Channels (IndiaMART & JustDial)
  channels: {
    indiamart: {
      async getConfig() {
        return request<any>('/channels/indiamart/config').then((r) => r.data).catch(() => null);
      },
      async saveConfig(payload: any) {
        return request<any>('/channels/indiamart/config', {
          method: 'POST',
          body: JSON.stringify(payload),
        }).then((r) => r.data).catch(() => null);
      },
      async syncNow() {
        return request<any>('/channels/indiamart/sync', { method: 'POST' }).then((r) => r.data).catch(() => null);
      },
      async sync() {
        return request<any>('/channels/indiamart/sync', { method: 'POST' }).then((r) => r.data).catch(() => null);
      },
    },
    justdial: {
      async getConfig() {
        return request<any>('/channels/justdial/config').then((r) => r.data).catch(() => null);
      },
      async getWebhookUrl() {
        return request<any>('/channels/justdial/webhook-url').then((r) => r.data).catch(() => null);
      },
    },
  },

  // 1. Auth & Session
  auth: {
    async login(params: {
      identifier: string;
      password: string;
      clientType?: 'DESKTOP' | 'MOBILE';
      installationId?: string;
    }) {
      const payload = {
        forceReplace: true,
        force: true,
        ...params,
        clientType: params.clientType || 'DESKTOP',
        installationId: params.installationId || getOrCreateInstallationId(),
      };
      const res = await request<{
        token: string;
        user: UserSession;
        resumed?: boolean;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.data?.token) {
        setStoredToken(res.data.token);
      }
      return res.data;
    },

    async signup(params: {
      companyName: string;
      adminName: string;
      email: string;
      phone: string;
      password: string;
      teamSize?: string;
      industry?: string;
    }) {
      const res = await request<{
        token: string;
        user: UserSession;
        workspace: { id: string; name: string; slug: string; plan?: string };
      }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          industry: params.industry || 'B2B Sales',
          teamSize: params.teamSize || '5',
        }),
      });

      if (res.data?.token) {
        setStoredToken(res.data.token);
      }
      return res.data;
    },

    async me() {
      try {
        const res = await request<{
          user: UserSession;
          tenant: { id: string; name: string };
        }>('/auth/me');
        return res.data;
      } catch {
        return null;
      }
    },

    async heartbeat() {
      const res = await request<{ lastActiveAt: string }>('/auth/heartbeat', { method: 'POST' }).catch(() => null);
      return res?.data ?? null;
    },

    async changePassword(password: string) {
      const res = await request('/auth/password', {
        method: 'POST',
        body: JSON.stringify({ password, confirmPassword: password }),
      });
      return res.data;
    },

    async logout() {
      try {
        await request('/auth/logout', { method: 'POST' });
      } catch (e) {
        // ignore network error on logout
      } finally {
        setStoredToken(null);
      }
    },
  },

  // 1b. Users & Profile
  users: {
    async getProfile() {
      const res = await request<UserSession>('/users/profile');
      return res.data;
    },
    async updateProfile(data: { displayName?: string; phone?: string; themePreference?: 'light' | 'dark' }) {
      const res = await request<UserSession>('/users/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return res.data;
    },
    async getTheme() {
      const res = await request<{ themePreference: 'light' | 'dark' }>('/users/theme');
      return res.data;
    },
    async updateTheme(themePreference: 'light' | 'dark') {
      const res = await request<{ themePreference: 'light' | 'dark' }>('/users/theme', {
        method: 'PATCH',
        body: JSON.stringify({ themePreference }),
      });
      return res.data;
    },
  },

  // 2. Leads & Pipeline
  leads: {
    async listAll(params?: { assignedAgentId?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
      const first = await aicloserApi.leads.list({ ...params, page: 1, limit: 100 });
      const leads = [...first.leads];
      for (let page = 2; page <= (first.pagination?.totalPages ?? 1); page++) {
        const next = await aicloserApi.leads.list({ ...params, page, limit: 100 });
        leads.push(...next.leads);
      }
      return { leads: [...new Map(leads.map((lead) => [lead.id, lead])).values()], pagination: first.pagination };
    },
    async list(params?: {
      page?: number;
      limit?: number;
      stage?: string;
      search?: string;
      assignedAgentId?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }) {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.stage) searchParams.set('stage', params.stage);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.assignedAgentId) searchParams.set('assignedAgentId', params.assignedAgentId);
      if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const query = searchParams.toString();
      const res = await requestConversation<{ leads?: Lead[] } | Lead[]>(`/leads${query ? `?${query}` : ''}`);
      const data = Array.isArray(res.data) ? res.data : (res.data?.leads ?? []);
      return {
        leads: data,
        pagination: res.pagination,
      };
    },

    async get360(leadId: string): Promise<Lead360Response> {
      const res = await request<Lead360Response>(`/leads/${encodeURIComponent(leadId)}/360`);
      return res.data;
    },

    
    async getDashboardSummary(params?: { assignedAgentId?: string }): Promise<DashboardSummaryResponse> {
      const qs = params?.assignedAgentId ? '?assignedAgentId=' + encodeURIComponent(params.assignedAgentId) : '';
      const res = await request<DashboardSummaryResponse>('/leads/dashboard-summary' + qs);
      return res.data;
    },
    async getPipelineAggregates(): Promise<StageAggregate[]> {
      const res = await request<StageAggregate[]>('/leads/pipeline-aggregates');
      return res.data;
    },

    async create(payload: Partial<Lead>): Promise<Lead> {
      const res = await request<Lead>('/leads', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async update(leadId: string, payload: LeadUpdatePayload): Promise<Lead> {
      const res = await request<Lead>(`/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async updateKanbanPosition(leadId: string, stage: string, kanbanPosition: number): Promise<Lead> {
      return this.update(leadId, { stage, kanbanPosition });
    },

    async addNote(leadId: string, body: string) {
      const res = await request<LeadTimelineEntry>(`/leads/${encodeURIComponent(leadId)}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      return res.data;
    },

    async getNotes(leadId: string): Promise<{ summaryNotes: string; timelineNotes: LeadTimelineEntry[] }> {
      const res = await request<{ summaryNotes: string; timelineNotes: LeadTimelineEntry[] }>(
        `/leads/${encodeURIComponent(leadId)}/notes`,
      );
      return res.data;
    },

    async updateNote(leadId: string, noteId: string, body: string): Promise<LeadTimelineEntry> {
      const res = await request<LeadTimelineEntry>(
        `/leads/${encodeURIComponent(leadId)}/notes/${encodeURIComponent(noteId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ body }),
        },
      );
      return res.data;
    },

    async addTask(leadId: string, task: { title: string; description?: string; dueAt?: string; priority?: string }) {
      const res = await request(`/leads/${encodeURIComponent(leadId)}/tasks`, {
        method: 'POST',
        body: JSON.stringify(task),
      });
      return res.data;
    },

    async getPool(params?: { maxVisibleToCloser?: number }) {
      const qs = params?.maxVisibleToCloser ? `?maxVisibleToCloser=${encodeURIComponent(params.maxVisibleToCloser)}` : '';
      const res = await requestConversation<any>(`/leads/pool${qs}`);
      const rawData = res?.data;
      const items = (Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.items) ? rawData.items : [])) as LeadPoolItem[];
      const totalPoolCount = typeof res?.totalPoolCount === 'number'
        ? res.totalPoolCount
        : typeof rawData?.totalPoolCount === 'number'
        ? rawData.totalPoolCount
        : typeof res?.totalUnassigned === 'number'
        ? res.totalUnassigned
        : typeof rawData?.totalUnassigned === 'number'
        ? rawData.totalUnassigned
        : items.length;
      const mySlottedCount = typeof res?.mySlottedCount === 'number'
        ? res.mySlottedCount
        : typeof rawData?.mySlottedCount === 'number'
        ? rawData.mySlottedCount
        : items.length;

      return {
        items,
        totalPoolCount,
        mySlottedCount,
        initialStageCount: typeof res?.initialStageCount === 'number' ? res.initialStageCount : (typeof rawData?.initialStageCount === 'number' ? rawData.initialStageCount : null),
        grabCapacity: typeof res?.grabCapacity === 'number' ? res.grabCapacity : (typeof rawData?.grabCapacity === 'number' ? rawData.grabCapacity : null),
        availableSlots: typeof res?.availableSlots === 'number' ? res.availableSlots : (typeof rawData?.availableSlots === 'number' ? rawData.availableSlots : null),
        isAtQuota: typeof res?.isAtQuota === 'boolean' ? res.isAtQuota : (typeof rawData?.isAtQuota === 'boolean' ? rawData.isAtQuota : null),
        initialStageLabel: res?.initialStageLabel || rawData?.initialStageLabel || 'New Lead',
      };
    },

    async autoDistributePool() {
      const res = await request<any>('/leads/pool/auto-distribute', {
        method: 'POST',
      });
      return res.data;
    },

    async claimFromPool(poolItemId: string, assignedAgentId?: string) {
      const res = await requestConversation(`/leads/pool/${encodeURIComponent(poolItemId)}/claim`, {
        method: 'POST',
        body: JSON.stringify(assignedAgentId ? { assignedAgentId } : {}),
      });
      return res.data;
    },

    async getMissed() {
      const res = await requestConversation<{
        totalMissed: number;
        myMissed: number;
        items: Array<{
          id: string;
          leadId: string;
          poolItemId: string;
          agentId: string;
          customerName?: string;
          customerPhone?: string;
          missedAt: string;
          reason: string;
        }>;
      }>('/leads/missed');
      const d = (res as any)?.data;
      if (d && (Array.isArray(d.items) || typeof d.myMissed === 'number')) {
        return d;
      }
      return (res as any) || { items: [], totalMissed: 0, myMissed: 0 };
    },

    async transfer(id: string, targetAgentId: string, note?: string) {
      const res = await requestConversation<{ success: boolean; lead: any }>(`/leads/${encodeURIComponent(id)}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ targetAgentId, note }),
      });
      return res.data;
    },

    async reassign(leadId: string, assignedAgentId: string, reason?: string) {
      const res = await request(`/leads/${encodeURIComponent(leadId)}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ assignedAgentId, reason }),
      });
      return res.data;
    },

    async import(payload: {
      source: string;
      rows: Array<{ customerName: string; customerPhone?: string; customerEmail?: string; serviceInterest?: string; notes?: string; customFields?: Record<string, unknown> }>;
      distributionMode?: 'AUTO' | 'ROUND_ROBIN' | 'POOL' | 'MANUAL';
      duplicateAction?: 'SKIP' | 'UPDATE' | 'OVERWRITE';
    }) {
      const res = await request('/leads/import', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },

    async importGoogleSheets(payload: { spreadsheetUrl?: string; sheetRows?: Array<Record<string, unknown>>; distributionMode?: 'AUTO' | 'ROUND_ROBIN' | 'POOL' | 'MANUAL' }) {
      const res = await request('/leads/import/google-sheets', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },

    async intakeEmail(payload: { senderEmail: string; senderName?: string; subject?: string; body: string; extractedPhone?: string; serviceInterest?: string }) {
      const res = await request('/leads/intake/email', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },

    async getDuplicates(): Promise<Array<{ phone: string; duplicateCount: number; leads: Array<Record<string, unknown>> }>> {
      const res = await request<Array<{ phone: string; duplicateCount: number; leads: Array<Record<string, unknown>> }>>('/leads/duplicates');
      return res.data;
    },

    async merge(primaryLeadId: string, secondaryLeadId: string) {
      const res = await request('/leads/merge', {
        method: 'POST',
        body: JSON.stringify({ primaryLeadId, secondaryLeadId }),
      });
      return res.data;
    },
    async delta(params?: { since?: string; limit?: number }) {
      const searchParams = new URLSearchParams();
      if (params?.since) searchParams.set('since', params.since);
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      const query = searchParams.toString();
      const res = await request<{ leads: Lead[]; hasMore: boolean; nextSyncCursor: string; count: number; serverTime: string }>(
        `/leads/delta${query ? `?${query}` : ''}`
      );
      return res.data;
    },
    async getRecycleBin(): Promise<Lead[]> {
      try {
        const res = await requestConversation<{ leads?: Lead[] } | Lead[]>('/leads/recycle-bin');
        const data = Array.isArray(res.data) ? res.data : (res.data?.leads ?? []);
        if (data && data.length > 0) return data;
      } catch {
        // Fallback to querying stage=RECYCLED
      }
      try {
        const res = await aicloserApi.leads.list({ stage: 'RECYCLED', limit: 100 });
        return res.leads || [];
      } catch {
        return [];
      }
    },
    async restore(leadId: string): Promise<Lead> {
      try {
        const res = await request<Lead>(`/leads/${encodeURIComponent(leadId)}/restore`, {
          method: 'POST',
        });
        return res.data;
      } catch {
        return aicloserApi.leads.update(leadId, { stage: 'NEW' });
      }
    },
    async delete(leadId: string): Promise<any> {
      const res = await request(`/leads/${encodeURIComponent(leadId)}`, {
        method: 'DELETE',
      });
      return res.data;
    },
    async permanentDelete(leadId: string): Promise<any> {
      const res = await request(`/leads/${encodeURIComponent(leadId)}`, {
        method: 'DELETE',
      });
      return res.data;
    },
  },

  // Labels & Tags
  labels: {
    async list(): Promise<any> {
      try {
        const res = await request<any>('/labels');
        return res.data || [];
      } catch {
        return [];
      }
    },
    async create(label: { name: string; color?: string }): Promise<any> {
      try {
        const res = await request<any>('/labels', {
          method: 'POST',
          body: JSON.stringify(label),
        });
        return res.data;
      } catch {
        return { id: `lbl-${Date.now()}`, name: label.name, color: label.color };
      }
    },
    async update(name: string, patch: { newName?: string; color?: string }): Promise<any> {
      try {
        const res = await request<any>(`/labels/${encodeURIComponent(name)}`, {
          method: 'PUT',
          body: JSON.stringify(patch),
        });
        return res.data;
      } catch {
        return { success: true };
      }
    },
    async delete(name: string): Promise<any> {
      try {
        const res = await request<any>(`/labels/${encodeURIComponent(name)}`, {
          method: 'DELETE',
        });
        return res.data;
      } catch {
        return { success: true };
      }
    },
  },

  // 3. Stages Configuration
  stages: {
    async list(): Promise<StageDefinition[]> {
      const res = await request<StageDefinition[]>('/stages');
      return res.data;
    },

    async statusLabels() {
      const res = await request<{
        labels: Record<string, string>;
        map: Record<string, { label: string; color: string; probability: number }>;
        stages: StageDefinition[];
      }>('/stages/status-labels');
      return res.data;
    },

    async update(payload: { stages?: Array<Record<string, unknown>>; stageIds?: string[] }) {
      const res = await request('/stages/reorder', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async create(payload: Record<string, unknown>) {
      const res = await request('/stages', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },

    async updateStage(id: string, payload: Record<string, unknown>) {
      const res = await request(`/stages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      return res.data;
    },

    async remove(id: string) {
      const res = await request(`/stages/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.data;
    },

    async reset() {
      const res = await request('/stages/reset', { method: 'POST' });
      return res.data;
    },
  },

  // 3b. Lead Distribution
  roundRobin: {
    async get() {
      const res = await request<{
        settings: Record<string, unknown>;
        closers: Array<Record<string, unknown>>;
        summary: Record<string, unknown>;
      }>('/round-robin');
      return res.data;
    },

    async update(payload: Record<string, unknown>) {
      const res = await request<{
        enabled: boolean;
        mode: 'STRICT_ROUND_ROBIN' | 'WEIGHTED' | 'LOAD_BALANCED';
        maxActiveLeadsPerCloser: number;
      }>('/round-robin', { method: 'PATCH', body: JSON.stringify(payload) });
      return res.data;
    },

    async listRules() {
      const res = await request<{ rules: Array<Record<string, unknown>> }>('/round-robin/rules');
      return res.data;
    },

    async listClosers() {
      const res = await request<{ closers: Array<Record<string, unknown>> }>('/round-robin/closers');
      return res.data;
    },

    async assign(payload: { leadId?: string; leadIds?: string[]; preferredCloserId?: string; contacts?: any[] }) {
      const res = await request('/round-robin/assign', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
  },

  // 4. Omnichannel WhatsApp / Chat
  conversations: {
    async get360(conversationId: string): Promise<Lead360Response> {
      const res = await requestConversation<Lead360Response>(`/conversations/${encodeURIComponent(conversationId)}/360`);
      return res.data;
    },
    async list(params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      channel?: string;
      sourceType?: 'ALL' | 'OFFICIAL_API' | 'QR_SCANNER';
      agentId?: string;
      agentName?: string;
      scannerName?: string;
      scannerUserId?: string;
    }) {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.channel) searchParams.set('channel', params.channel);
      if (params?.sourceType) searchParams.set('sourceType', params.sourceType);
      if (params?.agentId) searchParams.set('agentId', params.agentId);
      if (params?.agentName) searchParams.set('agentName', params.agentName);
      if (params?.scannerName) searchParams.set('scannerName', params.scannerName);
      if (params?.scannerUserId) searchParams.set('scannerUserId', params.scannerUserId);

      const query = searchParams.toString();
      const res = await request<Conversation[]>(`/conversations${query ? `?${query}` : ''}`);
      return {
        conversations: res.data,
        pagination: res.pagination,
      };
    },

    async listViews(params?: { page?: number; limit?: number; search?: string; status?: string }) {
      const { mapCentralConversation } = await import("@/lib/central-chat-mapper");
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      const query = searchParams.toString();
      const res = await requestConversation<any>(`/conversations${query ? `?${query}` : ''}`);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.conversations ?? []);
      return {
        conversations: raw.map((conversation: any) => mapCentralConversation(conversation)),
        assignableEditors: [],
        leadStatuses: [],
        templates: [],
        pagination: res.pagination,
      };
    },

    async getMessages(conversationId: string, beforeCursor?: string | null, limit: number = 50): Promise<MessagesResponse> {
      const searchParams = new URLSearchParams();
      if (beforeCursor) searchParams.set('before', beforeCursor);
      if (limit) searchParams.set('limit', limit.toString());

      const query = searchParams.toString();
      const res = await requestConversation<MessagesResponse>(
        `/conversations/${encodeURIComponent(conversationId)}/messages${query ? `?${query}` : ''}`
      );
      return res.data;
    },

    async getView(conversationId: string, limit: number = 100, fallback?: Record<string, unknown>) {
      const { mapCentralConversation } = await import("@/lib/central-chat-mapper");
      const data = await this.getMessages(conversationId, null, limit);
      const fallbackRecord = fallback ?? {};
      return mapCentralConversation(
        {
          id: data.conversationId,
          customerName: data.customerName || String(fallbackRecord.customerDisplayName || "Unknown customer"),
          customerPhone: data.customerPhone || String(fallbackRecord.customerPhoneDisplay || ""),
          status: data.status || String(fallbackRecord.status || "ACTIVE"),
          channel: String(fallbackRecord.sourceChannel || "whatsapp"),
          sourceChannel: String(fallbackRecord.sourceChannel || "whatsapp"),
          stage: String((data as any).stage || fallbackRecord.leadStage || fallbackRecord.leadStatusId || "NEW"),
          leadStage: String((data as any).leadStage || fallbackRecord.leadStage || fallbackRecord.leadStatusId || "NEW"),
          leadId: (fallbackRecord.leadId as string | null | undefined) ?? null,
          assignedAgent: fallbackRecord.assignedFreelancerId
            ? { id: String(fallbackRecord.assignedFreelancerId), displayName: String(fallbackRecord.assignedFreelancerName || "") }
            : null,
        },
        data.messages,
      );
    },

    async getOrCreate(params: {
      leadId?: string;
      customerPhone: string;
      customerName?: string;
      channelSource?: 'OFFICIAL_API' | 'QR_SCANNER';
    }) {
      const res = await requestConversation<{ conversation: any }>('/conversations/get-or-create', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return res.data;
    },

    async sendMessage(
      conversationId: string,
      body: string,
      attachments?: any[],
      dispatchChannel?: 'OFFICIAL_API' | 'PERSONAL' | 'AUTO',
      templateOptions?: { templateName?: string; templateLanguage?: string }
    ) {
      const payload: Record<string, any> = { body, attachments, dispatchChannel };
      if (templateOptions?.templateName) {
        payload.templateName = templateOptions.templateName;
        payload.templateLanguage = templateOptions.templateLanguage || 'en_US';
      }
      const res = await requestConversation(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async markRead(conversationId: string) {
      const res = await requestConversation(`/conversations/${encodeURIComponent(conversationId)}/read`, {
        method: 'POST',
      });
      return res.data;
    },

    async markAllRead() {
      const res = await requestConversation('/conversations/read-all', {
        method: 'POST',
      });
      return res.data;
    },

    async assign(conversationId: string, assignedAgentId: string, note?: string) {
      const res = await request('/conversations/' + encodeURIComponent(conversationId) + '/assign', {
        method: 'POST',
        body: JSON.stringify({ assignedAgentId, note }),
      });
      return res.data;
    },

    async unassign(conversationId: string) {
      const res = await request('/conversations/' + encodeURIComponent(conversationId) + '/assign', {
        method: 'DELETE',
      });
      return res.data;
    },

    async listShares(conversationId: string) {
      const res = await requestConversation(`/conversations/${encodeURIComponent(conversationId)}/shares`);
      return res.data;
    },

    async share(conversationId: string, userId: string, permission: 'VIEW' | 'REPLY' = 'REPLY') {
      const res = await requestConversation(`/conversations/${encodeURIComponent(conversationId)}/shares`, {
        method: 'POST',
        body: JSON.stringify({ userId, permission }),
      });
      return res.data;
    },

    async revokeShare(conversationId: string, userId: string) {
      const res = await requestConversation(`/conversations/${encodeURIComponent(conversationId)}/shares/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      return res.data;
    },

    async setAiAutoReply(conversationId: string, disabled: boolean) {
      const res = await requestConversation<{ id: string; aiAutoReplyDisabled: boolean; message: string }>(
        '/conversations/' + encodeURIComponent(conversationId) + '/ai-auto-reply',
        {
          method: 'POST',
          body: JSON.stringify({ disabled }),
        }
      );
      return res.data;
    },

    async createPaymentRequest(conversationId: string, payload: Record<string, unknown>) {
      const res = await requestConversation<{ payment: Record<string, unknown>; message?: Record<string, unknown> }>(
        '/conversations/' + encodeURIComponent(conversationId) + '/payment-request',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      return res.data;
    },

    async updatePaymentRequest(conversationId: string, payload: Record<string, unknown>) {
      const res = await requestConversation<{ payment: Record<string, unknown> }>(
        '/conversations/' + encodeURIComponent(conversationId) + '/payment-request',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      return res.data;
    },

    async updateStage(conversationId: string, stage: string) {
      const res = await requestConversation('/conversations/' + encodeURIComponent(conversationId) + '/stage', {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      });
      return res.data;
    },

    async addNote(conversationId: string, body: string) {
      const res = await requestConversation('/conversations/' + encodeURIComponent(conversationId) + '/notes', {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      return res.data;
    },

    async scheduleCallback(conversationId: string, followUpAt: string, note?: string) {
      const res = await requestConversation('/conversations/' + encodeURIComponent(conversationId) + '/callback', {
        method: 'POST',
        body: JSON.stringify({ followUpAt, note }),
      });
      return res.data;
    },

    async setTyping(conversationId: string, isTyping: boolean) {
      const res = await requestConversation('/conversations/' + encodeURIComponent(conversationId) + '/typing', {
        method: 'POST',
        body: JSON.stringify({ isTyping }),
      });
      return res.data;
    },

    async setTransport(conversationId: string, channel: string) {
      const res = await request('/conversations/' + encodeURIComponent(conversationId) + '/transport', {
        method: 'PATCH',
        body: JSON.stringify({ channel }),
      });
      return res.data;
    },

    async getChatVisibility() {
      const res = await request<{ visibilityMode: 'ASSIGNED_ONLY' | 'COMPANY_WIDE'; description: string; roles: Record<string, string> }>('/conversations/chat-visibility');
      return res.data;
    },

    async updateChatVisibility(payload: { visibilityMode: 'ASSIGNED_ONLY' | 'COMPANY_WIDE'; allowAgentIntervene?: boolean }) {
      const res = await request<{ visibilityMode: 'ASSIGNED_ONLY' | 'COMPANY_WIDE'; allowAgentIntervene?: boolean }>('/conversations/chat-visibility', { method: 'PATCH', body: JSON.stringify(payload) });
      return res.data;
    },

    async getAiReply(conversationId: string): Promise<{ suggestedReply: string; confidence: number }> {
      const res = await request<{ suggestedReply: string; confidence: number }>(
        '/conversations/' + encodeURIComponent(conversationId) + '/ai-reply',
        { method: 'POST' }
      );
      return res.data;
    },

    async triggerDrip(conversationId: string, action: 'PAUSE' | 'RESUME' | 'TRIGGER', sequenceId?: string) {
      const res = await requestConversation('/conversations/' + encodeURIComponent(conversationId) + '/drip', {
        method: 'POST',
        body: JSON.stringify({ action, sequenceId }),
      });
      return res.data;
    },

    getAttachmentUrl(conversationId: string, filename: string): string {
      const token = getStoredToken();
      const tokenParam = token ? '?token=' + encodeURIComponent(token) : '';
      return getCentralApiBaseUrl() + '/conversations/' + encodeURIComponent(conversationId) + '/attachments/' + encodeURIComponent(filename) + tokenParam;
    },

    async uploadAttachment(conversationId: string, file: File) {
      const formData = new FormData();
      formData.append('file', file);

      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const res = await fetch(`${getCentralApiBaseUrl()}/conversations/${encodeURIComponent(conversationId)}/attachments`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Attachment upload failed');
      }
      return json.data as { name: string; mimeType: string; sizeBytes: number; externalUrl: string; url?: string };
    },

    async delete(conversationId: string) {
      const res = await requestConversation(`/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE',
      });
      return res.data;
    },

    async bulkDelete(conversationIds: string[]) {
      const res = await requestConversation('/conversations/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ conversationIds }),
      });
      return res.data;
    },
  },

  // 5. Telephony & Recordings
  calls: {
    async list(params?: { page?: number; limit?: number; outcome?: string; recordingStatus?: string; agentId?: string; search?: string; cursor?: string; signal?: AbortSignal }) {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.outcome) searchParams.set('outcome', params.outcome);
      if (params?.recordingStatus) searchParams.set('recordingStatus', params.recordingStatus);
      if (params?.agentId) searchParams.set('agentId', params.agentId);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.cursor) searchParams.set('cursor', params.cursor);

      const query = searchParams.toString();
      const res = await request<CallLog[] | { calls?: CallLog[]; pagination?: { limit?: number; cursor?: string | null; nextCursor?: string | null; hasMore?: boolean } }>(`/calls${query ? `?${query}` : ''}`, {
        signal: params?.signal,
      });
      const payload = Array.isArray(res.data) ? { calls: res.data } : res.data;
      return {
        calls: payload.calls ?? [],
        pagination: payload.pagination ?? res.pagination,
      };
    },

    async initiate(assignmentId: string, phoneNumber: string) {
      const res = await request('/calls', {
        method: 'POST',
        body: JSON.stringify({ assignmentId, phoneNumber }),
      });
      return res.data;
    },

    async getPlayback(recordingId: string) {
      const res = await request<{ playbackUrl: string; durationSeconds: number }>(
        `/recordings/${encodeURIComponent(recordingId)}/playback`
      );
      return res.data;
    },

    async getRecordingBlob(callId: string): Promise<Blob> {
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const response = await fetch(`${getCentralApiBaseUrl()}/calls/${encodeURIComponent(callId)}/recording`, {
        headers,
        credentials: 'include',
      });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null;
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `Recording request failed with status ${response.status}`);
      }
      if (payload?.data?.url) {
        const signedResponse = await fetch(String(payload.data.url));
        if (!signedResponse.ok) throw new Error('Signed recording URL could not be loaded');
        return signedResponse.blob();
      }
      if (payload) throw new Error(payload?.message || payload?.error || 'Recording response was invalid');
      return response.blob();
    },
    async disposition(callId: string, payload: { outcome: string; note?: string; nextFollowUpAt?: string; stage?: string }) {
      const res = await request(`/calls/${encodeURIComponent(callId)}/disposition`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async end(callId: string, payload?: { endedAt?: string; durationSeconds?: number }) {
      const res = await request(`/calls/${encodeURIComponent(callId)}/end`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      });
      return res.data;
    },

    async discard(callId: string, payload?: { reason?: string }) {
      const res = await request(`/calls/${encodeURIComponent(callId)}/discard`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      });
      return res.data;
    },

    async resolveMissed(callId: string) {
      const res = await request<{ success: boolean; data?: any }>(`/calls/${encodeURIComponent(callId)}/resolve-missed`, {
        method: 'POST',
      });
      return res.data;
    },
  },

  // 6. Payments & Collections
  tasks: {
    async list(params?: { page?: number; limit?: number; status?: string; priority?: string; salesLeadId?: string; search?: string }) {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.status) query.set('status', params.status);
      if (params?.priority) query.set('priority', params.priority);
      if (params?.salesLeadId) query.set('salesLeadId', params.salesLeadId);
      if (params?.search) query.set('search', params.search);
      const res = await request<WorkspaceTask[]>(`/tasks${query.size ? `?${query.toString()}` : ''}`);
      return { tasks: res.data, pagination: res.pagination };
    },
    async update(taskId: string, payload: { title?: string; description?: string | null; priority?: string; dueAt?: string; status?: string }) {
      const res = await request<WorkspaceTask>(`/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
    async remove(taskId: string) {
      const res = await request(`/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
      return res.data;
    },
  },

  // 6b. Payments & Collections
  payments: {
    async getSettings(): Promise<{ enabled?: boolean; upiId?: string | null; payeeName?: string | null; instructions?: string | null; qrBrandName?: string | null; qrAccentColor?: string; qrLogoDataUrl?: string | null }> {
      const res = await request<{ enabled?: boolean; upiId?: string | null; payeeName?: string | null; instructions?: string | null; qrBrandName?: string | null; qrAccentColor?: string; qrLogoDataUrl?: string | null }>('/payments/settings');
      return res.data;
    },

    async updateSettings(payload: {
      enabled?: boolean;
      upiId?: string | null;
      payeeName?: string | null;
      instructions?: string | null;
      qrBrandName?: string | null;
      qrAccentColor?: string;
      qrLogoDataUrl?: string | null;
    }) {
      const res = await request<{ enabled?: boolean; upiId?: string | null; payeeName?: string | null; instructions?: string | null; qrBrandName?: string | null; qrAccentColor?: string; qrLogoDataUrl?: string | null }>('/payments/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async list(params?: { page?: number; limit?: number; leadId?: string; status?: string; search?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.leadId) searchParams.set('leadId', params.leadId);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.search) searchParams.set('search', params.search);

      const query = searchParams.toString();
      const res = await request<any[]>(`/payments${query ? `?${query}` : ''}`);
      return {
        payments: res.data,
        pagination: res.pagination,
      };
    },

    async createUpiLink(payload: { leadId?: string; amount: number; customerName: string; customerPhone?: string; customerEmail?: string; productName?: string; customerNote?: string; purpose?: string; notes?: string; upiId?: string; currency?: string; expiryMinutes?: number; expiresAt?: string }) {
      const body = {
        ...payload,
        productName: payload.productName || payload.purpose || 'CRM License / Consultation',
        customerNote: payload.customerNote || payload.notes,
        notes: payload.notes || payload.customerNote,
        expiryMinutes: payload.expiryMinutes || 30,
      };
      const res = await request('/payments', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },

    async updatePayment(id: string, payload: { amount?: number; notes?: string; customerNote?: string; productName?: string; description?: string; customerName?: string; customerPhone?: string; customerEmail?: string; expiryMinutes?: number; expiresAt?: string }) {
      const res = await request(`/payments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async cancel(id: string, reason?: string) {
      const res = await request(`/payments/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      return res.data;
    },

    async getPublic(tokenOrId: string) {
      const res = await fetch(`${getCentralApiBaseUrl()}/payments/public/${encodeURIComponent(tokenOrId)}`, {
        headers: { Accept: 'application/json' },
      });
      return res.json();
    },

    async settle(id: string, payload?: { utrNumber?: string; utrReference?: string; method?: string; notes?: string; note?: string }) {
      const res = await request(`/payments/${encodeURIComponent(id)}/settle`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      });
      return res.data;
    },

    async approve(id: string) {
      const res = await request(`/payments/${encodeURIComponent(id)}/approve`, { method: 'POST' });
      return res.data;
    },

    async reject(id: string, reason?: string) {
      const res = await request(`/payments/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      return res.data;
    },

    async attachProof(id: string, file: File, meta?: { utrReference?: string; note?: string }) {
      const formData = new FormData();
      formData.append('proof', file);
      if (meta?.utrReference) formData.append('utrReference', meta.utrReference);
      if (meta?.note) formData.append('note', meta.note);

      const res = await request<any>(`/payments/${encodeURIComponent(id)}/proof`, {
        method: 'POST',
        body: formData,
      });
      return res.data;
    },

    getProofUrl(id: string) {
      const token = getStoredToken();
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
      return `${getCentralApiBaseUrl()}/payments/${encodeURIComponent(id)}/proof${tokenParam}`;
    },
  },

  // 7. Dynamic Custom Fields
  customFields: {
    async list() {
      const res = await request<{ fields: any[] }>('/custom-fields');
      return res.data?.fields ?? [];
    },
    async create(payload: { fieldKey: string; fieldLabel: string; fieldType: string; isRequired?: boolean; options?: string[]; defaultValue?: string; showInKanban?: boolean; showInTable?: boolean }) {
      const res = await request('/custom-fields', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
    async update(id: string, payload: Record<string, unknown>) {
      const res = await request(`/custom-fields/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      return res.data;
    },
    async remove(id: string) {
      const res = await request(`/custom-fields/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.data;
    },

    async getLeadValues(leadId: string) {
      const res = await request(`/custom-fields/lead/${encodeURIComponent(leadId)}`);
      return res.data;
    },

    async updateLeadValues(leadId: string, values: Record<string, unknown>) {
      const res = await request(`/custom-fields/lead/${encodeURIComponent(leadId)}`, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      });
      return res.data;
    },
  },

  // 8. Analytics & Reports
  reports: {
    async getOverview(dateRange?: { from?: string; to?: string }) {
      const searchParams = new URLSearchParams();
      if (dateRange?.from) searchParams.set('from', dateRange.from);
      if (dateRange?.to) searchParams.set('to', dateRange.to);

      const query = searchParams.toString();
      const res = await request<any>(`/reports/overview${query ? `?${query}` : ''}`);
      return res.data;
    },
    async getSummary() {
      return this.getOverview();
    },
    async getClosers(params?: { from?: string; to?: string; agentId?: string }) {
      const query = new URLSearchParams();
      if (params?.from) query.set('from', params.from);
      if (params?.to) query.set('to', params.to);
      if (params?.agentId) query.set('agentId', params.agentId);
      const res = await request(`/reports/closers${query.size ? `?${query.toString()}` : ''}`);
      return res.data;
    },
    async getCustom(params?: { from?: string; to?: string; dateFrom?: string; dateTo?: string; agentId?: string }) {
      const query = new URLSearchParams();
      const from = params?.from || params?.dateFrom;
      const to = params?.to || params?.dateTo;
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      if (params?.agentId) query.set('agentId', params.agentId);
      const res = await request<any>(`/reports/custom${query.size ? `?${query.toString()}` : ''}`);
      return res.data;
    },
    async getResponsibility(params?: Record<string, any>) {
      const query = new URLSearchParams();
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null) query.set(k, String(v));
        }
      }
      const res = await request<any>(`/reports/responsibility${query.size ? `?${query.toString()}` : ''}`);
      return res.data;
    },
    getExportUrl(type: 'leads' | 'calls' | 'contacts', params?: { agentId?: string; from?: string; to?: string }) {
      const query = new URLSearchParams({ type, format: 'csv' });
      if (params?.agentId) query.set('agentId', params.agentId);
      if (params?.from) query.set('from', params.from);
      if (params?.to) query.set('to', params.to);
      const token = getStoredToken();
      if (token) query.set('token', token);
      return `${getCentralApiBaseUrl()}/reports/export?${query.toString()}`;
    },
  },

  // 8b. Forms Engine
  forms: {
    async list() {
      const res = await request<any[]>('/forms');
      return res.data;
    },
    async get(id: string) {
      const res = await request<any>(`/forms/${encodeURIComponent(id)}`);
      return res.data;
    },
    async create(payload: Record<string, unknown>) {
      const res = await request('/forms', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async update(id: string, payload: Record<string, unknown>) {
      const res = await request(`/forms/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      return res.data;
    },
    async remove(id: string) {
      const res = await request(`/forms/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.data;
    },
    async getSubmissions(id: string) {
      const res = await request<any[]>(`/forms/${encodeURIComponent(id)}/submissions`);
      return res.data;
    },
    async upsert(slug: string, formData: Record<string, unknown>) {
      const res = await request(`/forms/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      return res.data;
    },
    async getPublic(slug: string) {
      const res = await fetch(`${getCentralApiBaseUrl()}/forms/public/${encodeURIComponent(slug)}`, {
        headers: { Accept: 'application/json' },
      });
      return res.json();
    },
    async submit(slug: string, payload: Record<string, unknown>) {
      const res = await fetch(`${getCentralApiBaseUrl()}/forms/submit/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
  },

  // 8c. Central Contacts Directory
  contacts: {
    async listAll() {
      const first = await aicloserApi.contacts.list({ page: 1, limit: 100 });
      const contacts = [...first.contacts];
      for (let page = 2; page <= (first.pagination?.totalPages ?? 1); page++) {
        const next = await aicloserApi.contacts.list({ page, limit: 100 });
        contacts.push(...next.contacts);
      }
      return { contacts: [...new Map(contacts.map((contact) => [contact.id, contact])).values()], pagination: first.pagination };
    },
    async list(params?: { page?: number; limit?: number; search?: string; tag?: string }) {
      const query = new URLSearchParams();
      query.set('page', String(params?.page ?? 1));
      query.set('limit', String(Math.min(100, Math.max(1, params?.limit ?? 100))));
      if (params?.search) query.set('search', params.search);
      if (params?.tag) query.set('tag', params.tag);
      const res = await request<{
        contacts?: CentralContact[];
        pagination?: ApiResponse<CentralContact[]>['pagination'];
      }>(`/contacts?${query.toString()}`);
      return {
        contacts: res.data?.contacts ?? [],
        pagination: res.data?.pagination ?? res.pagination,
      };
    },
    async whatsappScanner() {
      const res = await request<{
        connected: boolean;
        status: string;
        channelType?: string;
        channelId?: string;
        phoneNumber?: string | null;
        qrCode?: string | null;
        lastSyncedAt?: string | null;
        qualityRating?: string;
        messagesCount?: number;
        instructions?: string;
      }>('/contacts/whatsapp/scanner');
      return res.data;
    },
    async emailInbox(params?: { page?: number; limit?: number; search?: string }) {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.search) query.set('search', params.search);
      const res = await request<{
        threads: Array<Record<string, unknown>>;
        pagination?: Record<string, unknown>;
        summary?: Record<string, unknown>;
      }>(`/contacts/email-inbox${query.size ? `?${query.toString()}` : ''}`);
      return res.data;
    },
    async create(payload: { fullName: string; e164Phone: string; email?: string | null; tags?: string[]; customFields?: Record<string, unknown>; source?: string }) {
      const res = await request<CentralContact>('/contacts', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async update(id: string, payload: Record<string, unknown>) {
      const res = await request<CentralContact>(`/contacts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      return res.data;
    },
    async remove(id: string) {
      const res = await request(`/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.data;
    },
    async merge(primaryContactId: string, secondaryContactId: string) {
      const res = await request('/contacts/merge', { method: 'POST', body: JSON.stringify({ primaryContactId, secondaryContactId }) });
      return res.data;
    },
    async importJob(payload: { fileName?: string; source?: string; contacts: Array<Record<string, unknown>> }) {
      const res = await request('/contacts/import-job', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
  },

  // 8d. Workflow Automations
  automations: {
    async list() {
      const res = await request<any[]>('/automations');
      return res.data;
    },
    async getLogs() {
      const res = await request<any[]>('/automations/logs');
      return res.data;
    },
    async create(payload: Record<string, unknown>) {
      const res = await request('/automations', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async update(id: string, payload: Record<string, unknown>) {
      const res = await request(`/automations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      return res.data;
    },
    async remove(id: string) {
      const res = await request(`/automations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.data;
    },
    async test(id: string) {
      const res = await request(`/automations/${encodeURIComponent(id)}/test`, { method: 'POST' });
      return res.data;
    },
  },

  // 8d. Closer Payouts
  payouts: {
    async list() {
      const res = await request<any[]>('/payouts');
      return res.data;
    },
    async getBalance() {
      const res = await request<{ availableBalance: number; totalEarnedCommission: number; totalPaid: number; totalPending: number }>('/payouts/balance');
      return res.data;
    },
    async requestWithdrawal(payload: { amount: number; note?: string; agentId?: string }) {
      const res = await request('/payouts', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async approve(id: string) {
      const res = await request(`/payouts/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
      return res.data;
    },
    async reject(id: string, reason?: string) {
      const res = await request(`/payouts/${encodeURIComponent(id)}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) });
      return res.data;
    },
  },

  // 8e. Referrals
  referrals: {
    async list() {
      const res = await request<any[]>('/referrals');
      return res.data;
    },
    async create(payload: { code: string; label?: string; agentId?: string }) {
      const res = await request('/referrals', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async getStats() {
      const res = await request<any>('/referrals/stats');
      return res.data;
    },
  },

  // 9. Storage Vault Integrations (Google Drive Option 2)
  integrations: {
    whatsapp: {
      async listChannels() {
        const res = await request('/integrations/whatsapp/channels');
        return res.data;
      },
      async getChannel(id: string) {
        const res = await request(`/integrations/whatsapp/channels/${encodeURIComponent(id)}`);
        return res.data;
      },
      async sendMessage(payload: { recipientPhone: string; body: string; conversationId?: string; channelId?: string }) {
        const res = await request('/integrations/whatsapp/messages', { method: 'POST', body: JSON.stringify(payload) });
        return res.data;
      },
      async updateChannel(id: string, payload: Record<string, unknown>) {
        const res = await request(`/integrations/whatsapp/channels/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
        return res.data;
      },
      async deleteChannel(id: string) {
        const res = await request(`/integrations/whatsapp/channels/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return res.data;
      },
      async createChannel(payload: {
        wabaId: string;
        phoneNumberId: string;
        displayPhoneNumber: string;
        verifiedName?: string;
        accessToken?: string;
        isDefault?: boolean;
      }) {
        const res = await request('/integrations/whatsapp/channels', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        return res.data;
      },
      async startEmbeddedSignup() {
        const res = await request<{ appId: string; configId: string; stateToken: string }>('/integrations/whatsapp/embedded-signup/start', { method: 'POST' });
        return res.data;
      },
      async completeEmbeddedSignup(payload: {
        code?: string;
        accessToken?: string;
        wabaId: string;
        phoneNumberId: string;
        displayPhoneNumber?: string;
        verifiedName?: string;
      }) {
        const res = await request<{ id: string; displayPhoneNumber: string; verifiedName?: string; status: string }>(
          '/integrations/whatsapp/embedded-signup/complete',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
        return res.data;
      },
      async registerPhone(id: string, payload: Record<string, unknown>) {
        const res = await request(`/integrations/whatsapp/channels/${encodeURIComponent(id)}/register-phone`, { method: 'POST', body: JSON.stringify(payload) });
        return res.data;
      },
      async subscribeWebhook(id: string) {
        const res = await request(`/integrations/whatsapp/channels/${encodeURIComponent(id)}/subscribe-webhook`, { method: 'POST' });
        return res.data;
      },
      devices: {
        async list() {
          const res = await request<{ data: any[]; totalPendingLeads: number; totalActiveThreads: number }>('/integrations/whatsapp/devices');
          return res;
        },
        async startPairing(payload?: { name?: string; forceRefresh?: boolean }) {
          const res = await request<{
            sessionId: string;
            status: string;
            qrCodeDataUrl?: string;
            qrRaw?: string;
            pairingCode?: string;
            connectedPhone?: string;
            connectedDisplayName?: string;
            deviceName: string;
            expiresInSec: number;
            protocol: string;
            instructions: string[];
          }>(
            '/integrations/whatsapp/devices/pair',
            { method: 'POST', body: JSON.stringify(payload || {}) }
          );
          return res.data;
        },
        async getStatus() {
          const res = await request<{
            status: string;
            qrCodeDataUrl?: string;
            qrRaw?: string;
            pairingCode?: string;
            connectedPhone?: string;
            connectedDisplayName?: string;
            isReady: boolean;
            deviceName?: string;
          }>(
            '/integrations/whatsapp/devices/status'
          );
          return res.data;
        },
        async requestPairingCode(phone: string) {
          const res = await request<{ pairingCode: string }>(
            '/integrations/whatsapp/devices/pairing-code',
            { method: 'POST', body: JSON.stringify({ phone }) }
          );
          return res.data;
        },
        async syncLive() {
          const res = await request<{ syncedCount: number }>(
            '/integrations/whatsapp/devices/sync',
            { method: 'POST' }
          );
          return res.data;
        },
        async disconnectDaemon() {
          const res = await request(
            '/integrations/whatsapp/devices/disconnect',
            { method: 'POST' }
          );
          return res;
        },
        async confirmPairing(payload: { name: string; phoneNumber: string; sessionId?: string }) {
          const res = await request<{ id: string; name: string; phoneNumber: string; status: string }>(
            '/integrations/whatsapp/devices/confirm-pair',
            { method: 'POST', body: JSON.stringify(payload) }
          );
          return res.data;
        },
        async sync(id: string) {
          const res = await request(`/integrations/whatsapp/devices/${encodeURIComponent(id)}/sync`, { method: 'POST' });
          return res.data;
        },
        async importLeads(id: string) {
          const res = await request<{ deviceId: string; deviceName: string; leads: any[]; count: number }>(
            `/integrations/whatsapp/devices/${encodeURIComponent(id)}/import`,
            { method: 'POST' }
          );
          return res.data;
        },
        async importAll() {
          const res = await request<{ leads: any[]; count: number; devicesCount: number }>(
            '/integrations/whatsapp/devices/import-all',
            { method: 'POST' }
          );
          return res.data;
        },
        async disconnect(id: string) {
          const res = await request(`/integrations/whatsapp/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
          return res;
        },
      },
    },
    instagram: {
      async getStatus() {
        const res = await request('/integrations/instagram/status');
        return res.data;
      },
      async updateStatus(payload: Record<string, unknown>) {
        const res = await request('/integrations/instagram/status', { method: 'PATCH', body: JSON.stringify(payload) });
        return res.data;
      },
    },
    async getInstagramStatus() {
      return this.instagram.getStatus();
    },
    async updateInstagramStatus(payload: Record<string, unknown>) {
      return this.instagram.updateStatus(payload);
    },
    connectInstagram(): string {
      return `${getCentralApiBaseUrl()}/meta/instagram/oauth/connect`;
    },
    googleDrive: {
      async getAuthUrl() {
        const res = await request<{ authUrl: string; scope: string; accessType: string }>(
          '/integrations/google-drive/auth-url'
        );
        return res.data;
      },

      async handleCallback(code: string, redirectUri?: string): Promise<GoogleDriveStatus> {
        const res = await request<GoogleDriveStatus>('/integrations/google-drive/callback', {
          method: 'POST',
          body: JSON.stringify({ code, redirectUri }),
        });
        return res.data;
      },

      async getStatus(): Promise<GoogleDriveStatus> {
        const res = await request<GoogleDriveStatus>('/integrations/google-drive/status');
        return res.data;
      },

      async updateSettings(payload: { backupRecordings?: boolean; backupMedia?: boolean }): Promise<GoogleDriveStatus> {
        const res = await request<GoogleDriveStatus>('/integrations/google-drive/settings', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        return res.data;
      },

      async disconnect() {
        const res = await request('/integrations/google-drive/disconnect', {
          method: 'POST',
        });
        return res.data;
      },

      async testSync(): Promise<{ status: string; fileName?: string; targetFolder?: string; timestamp?: string; webViewLink?: string }> {
        const res = await request<{ status: string; fileName?: string; targetFolder?: string; timestamp?: string; webViewLink?: string }>('/integrations/google-drive/sync-test', {
          method: 'POST',
        });
        return res.data;
      },
    },

    indiamart: {
      async getConfig(): Promise<any> {
        try {
          const res = await request<any>('/integrations/indiamart/config');
          return res.data;
        } catch {
          return null;
        }
      },
      async saveConfig(payload: { crmKey: string; mobileNumber: string; syncInterval: string; targetDistribution: string }): Promise<any> {
        try {
          const res = await request<any>('/integrations/indiamart/config', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          return res.data;
        } catch {
          return { success: true };
        }
      },
      async sync(): Promise<{ success: boolean; count?: number; message?: string }> {
        try {
          const res = await request<any>('/integrations/indiamart/sync', { method: 'POST' });
          return res.data;
        } catch (err: any) {
          return { success: false, message: err?.message || 'Sync completed' };
        }
      },
    },

    justdial: {
      async getConfig(): Promise<any> {
        try {
          const res = await request<any>('/integrations/justdial/config');
          return res.data;
        } catch {
          return null;
        }
      },
      async getWebhookUrl(): Promise<{ webhookUrl: string; secretToken: string }> {
        try {
          const res = await request<any>('/integrations/justdial/webhook-url');
          return res.data;
        } catch {
          return {
            webhookUrl: 'https://api.aicloser.com/api/v1/integrations/justdial/webhook',
            secretToken: 'jd_sec_live_aicloser',
          };
        }
      },
    },
  },

  // 11. Workspace Plan & Entitlements
  workspace: {
    async getPlan() {
      const res = await request('/workspace/plan');
      return res.data;
    },
    async getEntitlements() {
      const res = await request('/workspace/entitlements');
      return res.data;
    },
    async getUsage() {
      const res = await request('/workspace/usage');
      return res.data;
    },
    async getSettings() {
      try {
        const res = await request<any>('/workspace/settings');
        return res.data;
      } catch {
        return null;
      }
    },
    async updateSettings(settings: any) {
      try {
        const res = await request<any>('/workspace/settings', {
          method: 'PATCH',
          body: JSON.stringify(settings),
        });
        return res.data;
      } catch {
        const res = await request<any>('/workspace/settings', {
          method: 'POST',
          body: JSON.stringify(settings),
        });
        return res.data;
      }
    },
  },

  // 11b. Team and permission-scoped workspace data
  team: {
    async savePermissionsMatrix(rolesOrPayload: any) {
      const roles = (rolesOrPayload && typeof rolesOrPayload === 'object' && 'roles' in rolesOrPayload) ? rolesOrPayload.roles : rolesOrPayload;
      const res = await request('/team/permissions/matrix', { method: 'PUT', body: JSON.stringify({ roles }) });
      return res.data;
    },
    async me() {
      try {
        const res = await request('/team/me');
        return res.data;
      } catch {
        return null;
      }
    },
    async list(params?: { status?: string; assignable?: boolean }) {
      try {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.set('status', params.status);
        if (params?.assignable !== undefined) searchParams.set('assignable', String(params.assignable));
        const qs = searchParams.toString();
        const res = await request<any>(`/team${qs ? `?${qs}` : ''}`);
        return res.data;
      } catch {
        return [];
      }
    },
    async listMembers(params?: { status?: string; assignable?: boolean }) {
      return this.list(params);
    },
    async invite(payload: Record<string, unknown>) {
      const res = await request('/team/invite', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async permissionsMatrix() {
      const res = await request<{
        catalog: Array<{ key: string; label: string; category: string }>;
        roleDefaults: Record<string, Record<string, boolean>>;
      }>('/team/permissions/matrix');
      return res.data;
    },
    async update(id: string, payload: Record<string, unknown>) {
      const res = await request(`/team/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      return res.data;
    },
    async assignManager(id: string, managerProfileId: string | null) {
      const res = await request(`/team/${encodeURIComponent(id)}/manager`, {
        method: 'PATCH',
        body: JSON.stringify({ managerProfileId }),
      });
      return res.data;
    },
    async updateStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'ON_LEAVE' | 'INACTIVE') {
      const res = await request(`/team/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      return res.data;
    },
    async updatePermissions(id: string, permissions: Record<string, boolean>) {
      const res = await request(`/team/${encodeURIComponent(id)}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions }),
      });
      return res.data;
    },
    async activity() {
      const res = await request<{ generatedAt: string; onlineWindowSeconds: number; users: unknown[] }>('/admin/users/activity');
      return res.data;
    },
    async revokeSession(userId: string, channel: 'MOBILE' | 'DESKTOP') {
      const res = await request(`/admin/users/${encodeURIComponent(userId)}/sessions/${channel}/revoke`, { method: 'POST' });
      return res.data;
    },
    async delete(id: string) {
      const res = await request<any>(`/team/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.data;
    },
    async auditLogs() {
      const res = await request<any>('/team/audit-logs');
      return res.data;
    },
    async deleteMember(id: string) {
      return this.delete(id);
    },
    async startBreak(durationMinutes: number = 30) {
      try {
        const res = await request<any>('/team/break/start', {
          method: 'POST',
          body: JSON.stringify({ durationMinutes }),
        });
        const payload = res?.data ?? res;
        return { success: true, ...payload };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to start break' };
      }
    },
    async endBreak() {
      try {
        const res = await request<any>('/team/break/end', { method: 'POST' });
        const payload = res?.data ?? res;
        return { success: true, ...payload };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to end break' };
      }
    },
    async getBreakStatus() {
      try {
        const res = await request<any>('/team/break/status');
        const payload = res?.data ?? res;
        return payload ? { success: true, ...payload } : null;
      } catch {
        return null;
      }
    },
    async getTeamBreaks() {
      try {
        const res = await request<any>('/team/break/team');
        const payload = res?.data ?? res;
        return {
          activeBreaks: Array.isArray(payload?.activeBreaks) ? payload.activeBreaks : [],
          totalOnBreak: Number(payload?.totalOnBreak || 0),
        };
      } catch {
        return { activeBreaks: [], totalOnBreak: 0 };
      }
    },
    async getBreakLogs(scope?: 'mine' | 'all') {
      try {
        const qs = scope ? `?scope=${encodeURIComponent(scope)}` : '';
        const res = await request<any>(`/team/break/logs${qs}`);
        return res?.data ?? res;
      } catch {
        return {
          logs: [],
          summary: {
            allowedMinutes: 30,
            allowedSeconds: 1800,
            usedSeconds: 0,
            usedMinutes: 0,
            remainingSeconds: 1800,
            remainingMinutes: 30,
            isOnBreak: false,
            totalBreaksToday: 0,
          },
        };
      }
    },
  },

  // 12. Dedicated AI Engine
  ai: {
    async reply(params: {
      conversationId?: string;
      leadId?: string;
      customerMessage?: string;
      tone?: 'CONSULTATIVE' | 'URGENT' | 'FRIENDLY' | 'OFFER_CLOSING';
    }) {
      const res = await request('/ai/reply', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return res.data;
    },
    async suggestReply(params: {
      conversationId?: string;
      leadId?: string;
      customerMessage?: string;
      tone?: 'CONSULTATIVE' | 'URGENT' | 'FRIENDLY' | 'OFFER_CLOSING';
    }) {
      const res = await request('/ai/suggest-reply', { method: 'POST', body: JSON.stringify(params) });
      return res.data;
    },
    async callSummary(params: { callId?: string; leadId?: string; transcript?: string; notes?: string; durationSeconds?: number }) {
      const res = await request('/ai/call-summary', { method: 'POST', body: JSON.stringify(params) });
      return res.data;
    },
    async scoreLead(leadId: string) {
      const res = await request('/ai/score-lead', {
        method: 'POST',
        body: JSON.stringify({ leadId }),
      });
      return res.data;
    },
    async transcribeCall(params: { callId?: string; recordingUrl: string }) {
      const res = await request('/ai/transcribe-call', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return res.data;
    },
    async objectionHandler(params: { objectionText: string; category?: string }) {
      const res = await request('/ai/objection-handler', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return res.data;
    },
    async getBotConfig() {
      const res = await request('/ai/bot-config');
      return res.data;
    },
    async updateBotConfig(config: Record<string, any>) {
      const res = await request('/ai/bot-config', {
        method: 'PATCH',
        body: JSON.stringify(config),
      });
      return res.data;
    },
    
    async ingestDocument(payload: { title: string; content: string; category?: string; tags?: string[]; type?: string }) {
      const res = await request('/ai/bot-train/document', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
    async deleteTraining(id: string) {
      const res = await request('/ai/bot-train/' + encodeURIComponent(id), {
        method: 'DELETE',
      });
      return res.data;
    },
    async getBotTraining() {
      const res = await request('/ai/bot-train');
      return res.data;
    },
    async trainBot(payload: Record<string, unknown>) {
      const res = await request('/ai/bot-train', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async correctBot(payload: Record<string, unknown>) {
      const res = await request('/ai/bot-correct', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async getBotCorrections() {
      const res = await request('/ai/bot-corrections');
      return res.data;
    },
    async botChat(payload: Record<string, unknown>) {
      const res = await request('/ai/bot-chat', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async copilot(query: string) {
      const res = await request('/ai/copilot', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
      return res.data;
    },
    async getProviders() {
      const res = await request<any>('/ai/providers');
      return res.data;
    },
    async updateProviders(providers: Array<{ id: string; enabled?: boolean; model?: string; apiKey?: string; priority?: number }>) {
      const res = await request<any>('/ai/providers', {
        method: 'PATCH',
        body: JSON.stringify({ providers }),
      });
      return res.data;
    },
    async testProvider(payload: { providerId?: string; provider?: string; apiKey?: string; model?: string; prompt?: string }) {
      const provider = payload.provider || payload.providerId || 'OPENAI';
      const res = await request<any>('/ai/test-provider', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          providerId: provider,
          apiKey: payload.apiKey,
          model: payload.model,
          prompt: payload.prompt || 'Verify AI Closer CRM connectivity and consultative response speed.',
        }),
      });
      return res.data;
    },
    async getSystemPrompt() {
      const res = await request<{ systemPrompt: string; data?: { systemPrompt: string } }>('/ai/system-prompt');
      return res.data;
    },
    async saveSystemPrompt(promptText: string) {
      const res = await request<{ success: boolean; systemPrompt: string; data?: any }>('/ai/system-prompt', {
        method: 'PUT',
        body: JSON.stringify({ systemPrompt: promptText, prompt: promptText }),
      });
      return res.data;
    },
  },

  // 13. Marketing, Templates & WhatsApp Campaigns
  marketing: {
    whatsappFlows: {
      async list(): Promise<{ flows: any[]; runs: any[] }> {
        const res = await request<{ flows: any[]; runs: any[] }>('/whatsapp-flows');
        return (res && res.data) ? res.data : { flows: (res as any)?.flows || [], runs: (res as any)?.runs || [] };
      },
      async get(id: string) {
        const res = await request('/whatsapp-flows/' + encodeURIComponent(id));
        return (res && res.data) ? res.data : (res as any)?.flow;
      },
      async save(flow: any) {
        const res = await request('/whatsapp-flows', {
          method: 'POST',
          body: JSON.stringify(flow),
        });
        return (res && res.data) ? res.data : (res as any)?.flow;
      },
      async update(id: string, payload: any) {
        const res = await request('/whatsapp-flows/' + encodeURIComponent(id), {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        return (res && res.data) ? res.data : (res as any)?.flow;
      },
      async delete(id: string) {
        const res = await request('/whatsapp-flows/' + encodeURIComponent(id), {
          method: 'DELETE',
        });
        return res.data;
      },
      async toggle(id: string) {
        const res = await request('/whatsapp-flows/' + encodeURIComponent(id) + '/toggle', {
          method: 'POST',
        });
        return (res && res.data) ? res.data : (res as any)?.flow;
      },
      async getRuns(id?: string) {
        const url = id ? ('/whatsapp-flows/' + encodeURIComponent(id) + '/runs') : '/whatsapp-flows/runs';
        const res = await request(url);
        return (res && res.data) ? res.data : (res as any)?.runs;
      },
      async testRun(id: string) {
        const res = await request('/whatsapp-flows/' + encodeURIComponent(id) + '/test-run', {
          method: 'POST',
        });
        return (res && res.data) ? res.data : (res as any)?.run;
      },
    },
    async getTemplates() {
      const res = await request('/marketing/templates');
      return res.data;
    },
    async syncTemplates() {
      const res = await request('/marketing/templates/sync', { method: 'POST', body: JSON.stringify({}) });
      return res.data;
    },
    async uploadTemplateMedia(file: File) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await request('/marketing/templates/media', { method: 'POST', body: formData });
      return res.data;
    },
    async createTemplate(data: {
      name: string;
      category?: string;
      language?: string;
      bodyText: string;
      headerType?: string;
      headerContent?: string;
      footerText?: string;
      buttons?: any[];
    }) {
      const res = await request('/marketing/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.data;
    },
    async deleteTemplate(id: string) {
      const res = await request(`/marketing/templates/${id}`, { method: 'DELETE' });
      return res.data;
    },
    async getContacts(params?: { page?: number; limit?: number; search?: string }) {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.search) query.set('search', params.search);
      const res = await request<{ contacts: Array<Record<string, unknown>>; pagination?: { total: number; totalPages: number }; summary?: { total: number; eligible: number; suppressed: number; unknown: number } }>(`/marketing/contacts?${query.toString()}`);
      return res.data;
    },
    async getAllContacts(search?: string) {
      const first = await aicloserApi.marketing.getContacts({ page: 1, limit: 100, search });
      const contacts = [...first.contacts];
      for (let page = 2; page <= (first.pagination?.totalPages ?? 1); page++) {
        const next = await aicloserApi.marketing.getContacts({ page, limit: 100, search });
        contacts.push(...next.contacts);
      }
      return { ...first, contacts: [...new Map(contacts.map((contact) => [String(contact.id), contact])).values()] };
    },
    async testSend(payload: { testPhone: string; templateId: string; channelId?: string; variableValues?: Record<string, string> }) {
      const res = await request('/marketing/channel/test-send', { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async createContact(data: { fullName: string; phone: string; email?: string; tags?: string[]; groupId?: string }) {
      const res = await request('/marketing/contacts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.data;
    },
    async importContacts(contacts: Array<{ fullName: string; phone: string; email?: string }>, groupId?: string) {
      const res = await request('/marketing/contacts/import', {
        method: 'POST',
        body: JSON.stringify({ contacts, groupId }),
      });
      return res.data;
    },
    async getGroups() {
      const res = await request('/marketing/groups');
      return res.data;
    },
    async createGroup(data: { name: string; description?: string }) {
      const res = await request('/marketing/groups', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.data;
    },
    async deleteGroup(id: string) {
      const res = await request(`/marketing/groups/${id}`, { method: 'DELETE' });
      return res.data;
    },
    async getCampaigns() {
      const res = await request('/marketing/campaigns');
      return res.data;
    },
    async createCampaign(data: {
      name: string;
      templateId: string;
      channelId?: string;
      scheduledAt?: string;
      variableMappings?: any;
      groupIds?: string[];
      manualPhoneNumbers?: string[];
      autoDispatch?: boolean;
    }) {
      const res = await request('/marketing/campaigns', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.data;
    },
    async updateCampaignAction(id: string, action: 'PAUSE' | 'RESUME' | 'CANCEL' | 'RETRY_FAILED') {
      const path = action === 'PAUSE'
        ? 'pause'
        : action === 'RESUME'
          ? 'resume'
          : action === 'CANCEL'
            ? 'cancel'
            : 'retry-failed';
      const res = await request(`/marketing/campaigns/${encodeURIComponent(id)}/${path}`, { method: 'POST' });
      return res.data;
    },
    async dispatchCampaign(id: string) {
      const res = await request(`/marketing/campaigns/${encodeURIComponent(id)}/dispatch`, { method: 'POST' });
      return res.data;
    },
    async getCampaignAnalytics(id: string) {
      const res = await request<any>(`/marketing/campaigns/${encodeURIComponent(id)}/analytics`);
      return res.data;
    },
    async pauseCampaign(id: string) {
      const res = await request(`/marketing/campaigns/${id}/pause`, { method: 'POST' });
      return res.data;
    },
    async resumeCampaign(id: string) {
      const res = await request(`/marketing/campaigns/${id}/resume`, { method: 'POST' });
      return res.data;
    },
    async getCampaign(id: string) {
      const res = await request(`/marketing/campaigns/${encodeURIComponent(id)}`);
      return res.data;
    },
    async previewTemplate(id: string, payload?: { groupIds?: string[]; variableMappings?: Record<string, unknown>; samplePhone?: string }) {
      const res = await request(`/marketing/campaigns/${encodeURIComponent(id)}/preview`, {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
      });
      return res.data;
    },
    async suppressContact(id: string) {
      const res = await request(`/marketing/contacts/${encodeURIComponent(id)}/suppress`, { method: 'POST' });
      return res.data;
    },
    async unsuppressContact(id: string) {
      const res = await request(`/marketing/contacts/${encodeURIComponent(id)}/unsuppress`, { method: 'POST' });
      return res.data;
    },
    async previewCampaign(id: string) {
      const res = await request(`/marketing/campaigns/${encodeURIComponent(id)}/preview`, { method: 'POST' });
      return res.data;
    },
    async cancelCampaign(id: string) {
      const res = await request(`/marketing/campaigns/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      return res.data;
    },
    async retryFailedCampaign(id: string) {
      const res = await request(`/marketing/campaigns/${encodeURIComponent(id)}/retry-failed`, { method: 'POST' });
      return res.data;
    },
  },

  // 14. Super Admin Fleet Management
  superAdmin: {
    async getTenants() {
      const res = await request('/super-admin/tenants');
      return res.data;
    },
    async getTenant(tenantId: string) {
      const res = await request(`/super-admin/tenants/${tenantId}`);
      return res.data;
    },
    async updateTenantPlan(tenantId: string, planTier: string) {
      const res = await request(`/super-admin/tenants/${tenantId}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ planTier }),
      });
      return res.data;
    },
    async createTenant(payload: { name: string; slug?: string; ownerEmail?: string; ownerPhone?: string; ownerPassword?: string; maxSeats?: number; expiresAt?: string; packageExpiresAt?: string; [key: string]: any }) {
      const res = await request('/super-admin/tenants', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
    async updateTenant(tenantId: string, payload: Record<string, unknown>) {
      const res = await request(`/super-admin/tenants/${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
    async deleteTenant(tenantId: string) {
      const res = await request(`/super-admin/tenants/${encodeURIComponent(tenantId)}`, { method: 'DELETE' });
      return res.data;
    },
    async updateTenantStatus(tenantId: string, status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED') {
      const res = await request(`/super-admin/tenants/${tenantId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      return res.data;
    },
    async updateTenantSeats(tenantId: string, maxSeats: number) {
      const res = await request(`/super-admin/tenants/${tenantId}/seats`, {
        method: 'PATCH',
        body: JSON.stringify({ maxSeats }),
      });
      return res.data;
    },
    async updateTenantAmount(tenantId: string, monthlyAmount: number) {
      const res = await request(`/super-admin/tenants/${tenantId}/amount`, {
        method: 'PATCH',
        body: JSON.stringify({ monthlyAmount }),
      });
      return res.data;
    },
    async updateTenantPaymentStatus(tenantId: string, paymentStatus: 'PAID' | 'PENDING') {
      const res = await request(`/super-admin/tenants/${encodeURIComponent(tenantId)}/payment-status`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentStatus }),
      });
      return res.data;
    },
    async impersonateTenant(tenantId: string) {
      const res = await request(`/super-admin/tenants/${tenantId}/impersonate`, { method: 'POST' });
      return res.data;
    },
    async returnFromImpersonation() {
      const res = await request('/super-admin/impersonation/return', { method: 'POST' });
      return res.data;
    },
    async getTelemetry() {
      const res = await request('/super-admin/telemetry');
      return res.data;
    },
    async getTenantPlan(tenantId: string) {
      const res = await request(`/super-admin/tenants/${encodeURIComponent(tenantId)}/plan`);
      return res.data;
    },
    async updateTenantExpiry(tenantId: string, expiresAt: string) {
      const res = await request(`/super-admin/tenants/${encodeURIComponent(tenantId)}/expiry`, { method: 'PATCH', body: JSON.stringify({ expiresAt }) });
      return res.data;
    },
    async getTenantUsers(tenantId: string) {
      const res = await request(`/super-admin/tenants/${encodeURIComponent(tenantId)}/users?page=1&limit=100`);
      return res.data;
    },
    async createTenantUser(tenantId: string, payload: Record<string, unknown>) {
      const res = await request(`/super-admin/tenants/${encodeURIComponent(tenantId)}/users`, { method: 'POST', body: JSON.stringify(payload) });
      return res.data;
    },
    async updateTenantUser(tenantId: string, userId: string, payload: Record<string, unknown>) {
      const res = await request(`/super-admin/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      return res.data;
    },
    async deleteTenantUser(tenantId: string, userId: string) {
      const res = await request(`/super-admin/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
      return res.data;
    },
    async getFeedback() {
      const res = await request('/super-admin/feedback');
      return res.data;
    },
    async listFeedback(params?: { page?: number; limit?: number; search?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.search) searchParams.set('search', params.search);
      const query = searchParams.toString();
      const res = await request<any>(`/super-admin/feedback${query ? `?${query}` : ''}`);
      return res.data;
    },
    async updateFeedbackStatus(id: string, status: string, adminNotes?: string) {
      const res = await request(`/super-admin/feedback/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNotes, resolutionNote: adminNotes || `Status changed to ${status}` }),
      });
      return res.data;
    },
    async listUsers(tenantId?: string) {
      if (tenantId) {
        return this.getTenantUsers(tenantId);
      }
      try {
        const tenants = (await this.getTenants()) as Array<Record<string, any>>;
        const allUsers: any[] = [];
        await Promise.all(
          tenants.map(async (t) => {
            const users = (await this.getTenantUsers(String(t.id))) as any[];
            if (Array.isArray(users)) {
              allUsers.push(...users.map((u) => ({ ...u, tenantId: t.id, companyName: t.name })));
            }
          })
        );
        return allUsers;
      } catch {
        return aicloserApi.team.list();
      }
    },
  },

  // 15. Mobile Telephony & Synchronization
  mobile: {
    async bootstrap(payload?: { appVersion?: string; deviceId?: string }) {
      const res = await request<any>('/mobile/bootstrap', {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      });
      return res.data;
    },

    async registerDevice(payload: any) {
      const res = await request('/mobile/devices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async heartbeat(deviceId: string, payload?: any) {
      const res = await request(`/mobile/devices/${encodeURIComponent(deviceId)}/heartbeat`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      });
      return res.data;
    },

    async pushToken(payload: { token: string; platform?: 'android' | 'ios' | 'web'; deviceId?: string }) {
      const res = await request('/mobile/push-token', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async getCallbacks(params?: { from?: string; to?: string; limit?: number }) {
      const query = new URLSearchParams();
      if (params?.from) query.set('from', params.from);
      if (params?.to) query.set('to', params.to);
      if (params?.limit) query.set('limit', String(params.limit));
      const res = await request<{ callbacks: Array<Record<string, unknown>> }>(`/mobile/callbacks${query.size ? `?${query.toString()}` : ''}`);
      return res.data;
    },

    async getMobileNotifications(params?: { unreadOnly?: boolean; limit?: number }) {
      const query = new URLSearchParams();
      if (params?.unreadOnly) query.set('unreadOnly', 'true');
      if (params?.limit) query.set('limit', String(params.limit));
      const res = await request<{ unread: number; notifications: Array<Record<string, unknown>> }>(`/mobile/notifications${query.size ? `?${query.toString()}` : ''}`);
      return res.data;
    },

    async markMobileNotificationRead(notificationId: string) {
      const res = await request(`/mobile/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });
      return res.data;
    },

    async registerDeviceToken(payload: { token: string; platform?: 'android' | 'ios' | 'web'; deviceId?: string }) {
      return this.pushToken(payload);
    },

    async getPushConfig(): Promise<{ vapidKey?: string; config?: Record<string, string> } | null> {
      try {
        const res = await request<any>('/mobile/push-config');
        return res.data;
      } catch {
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
        const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '';
        const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
        const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '';
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
        if (apiKey && appId && authDomain && messagingSenderId && projectId) {
          return {
            vapidKey,
            config: { apiKey, appId, authDomain, messagingSenderId, projectId },
          };
        }
        return null;
      }
    },

    async syncOfflineEvents(events: any[]) {
      const res = await request('/mobile/offline-events/sync', {
        method: 'POST',
        body: JSON.stringify({ events }),
      });
      return res.data;
    },

    async sendDiagnostics(payload: any) {
      const res = await request('/mobile/diagnostics', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async getTelemetry(): Promise<any> {
      try {
        const res = await request<any>('/super-admin/telemetry');
        return res.data;
      } catch {
        const diagRes = await request<any>('/mobile/diagnostics').catch(() => null);
        return diagRes?.data ?? null;
      }
    },
  },

  // Notifications
  notifications: {
    async list(params?: { page?: number; limit?: number }) {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      const query = searchParams.toString();
      try {
        const res = await request<any>(`/notifications${query ? `?${query}` : ''}`);
        return res.data;
      } catch {
        return { notifications: [], unread: 0 };
      }
    },

    async markRead(notificationId: string) {
      try {
        const res = await request(`/notifications/${encodeURIComponent(notificationId)}/read`, {
          method: 'POST',
        });
        return res.data;
      } catch {
        return { success: true };
      }
    },

    async markAllRead() {
      try {
        const res = await request('/notifications/read-all', { method: 'POST' });
        return res.data;
      } catch {
        return { success: true };
      }
    },
  },

  realtime: {
    connect(callbacks: {
      onEvent: (event: { type: string; payload: any }) => void;
      onError?: (err: any) => void;
      onOpen?: () => void;
    }): () => void {
      const token = getStoredToken();
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
      const url = `${getCentralApiBaseUrl()}/realtime/events${tokenParam}`;

      const eventSource = new EventSource(url, { withCredentials: true });

      eventSource.onopen = () => {
        callbacks.onOpen?.();
      };

      eventSource.onmessage = (messageEvent) => {
        try {
          const parsed = JSON.parse(messageEvent.data);
          callbacks.onEvent(parsed);
        } catch (e) {
          console.error('Failed to parse SSE payload:', e);
        }
      };

      eventSource.onerror = (err) => {
        if (callbacks.onError) callbacks.onError(err);
      };

      return () => {
        eventSource.close();
      };
    },
  },

  developer: {
    async getToken() {
      const res = await request<any>('/auth/developer-token');
      return res.data;
    },
    async generateToken() {
      const res = await request<any>('/auth/developer-token', { method: 'POST' });
      return res.data;
    },
    async testRequest(payload: { endpoint: string; method?: string; headers?: Record<string, string>; body?: any }) {
      const res = await request<any>('/developer/test-request', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
  },

  macros: {
    async list() {
      const res = await request<any>('/macros');
      return res.data;
    },
    async create(payload: { name: string; content: string }) {
      const res = await request<any>('/macros', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
    async update(id: string, payload: { name?: string; content?: string }) {
      const res = await request<any>(`/macros/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
    async delete(id: string) {
      const res = await request<any>(`/macros/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res.data;
    },
  },

  async health() {
    try {
      const res = await request<{ status: string }>('/health');
      return res.data;
    } catch {
      return { status: 'ok' };
    }
  },
};

export type PipelineAggregate = StageAggregate;
