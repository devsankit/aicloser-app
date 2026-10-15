/**
 * AI Closer Central API Adapter (v1.2)
 * Production Base: https://api.aicloser.in/api/v1
 * Supports: Cookie-based auth (credentials: "include") + Bearer JWT fallback,
 * automatic installationId generation for desktop browser,
 * query-param SSE authentication, Google Drive Storage Vault, and standard response unwrapping.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_AICLOSER_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('localhost')
    ? 'http://localhost:3060/api/v1'
    : 'https://api.aicloser.in/api/v1');

// ==========================================
// Types
// ==========================================

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
}

export interface Lead {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  stage: string;
  kanbanPosition?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
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

export interface LeadTimelineEntry {
  id: string;
  body: string;
  type?: string;
  createdAt: string;
  author?: { id: string; name: string };
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
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
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
  label: string;
  color: string;
  probability: number;
  position: number;
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
  status: string;
  recordingStatus?: string;
  recordingUrl?: string;
  outcome?: string;
  note?: string;
  assignment?: {
    customerName: string;
  };
  startedAt: string;
}

export interface GoogleDriveStatus {
  isConnected: boolean;
  connectedEmail?: string;
  rootFolderName: string;
  rootFolderId?: string;
  backupRecordings: boolean;
  backupMedia: boolean;
  connectedAt?: string;
  isMockDemo?: boolean;
}

// ==========================================
// Client Helper & Token Storage
// ==========================================

const TOKEN_KEY = 'aicloser_auth_token';
const INSTALL_ID_KEY = 'aicloser_installation_id';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
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

  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Send HTTP-only cookie automatically
  });

  const json = await response.json();

  if (!response.ok || json.success === false) {
    const errorMsg = json.error || json.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return {
    data: json.data as T,
    pagination: json.pagination,
  };
}

// ==========================================
// Central API Methods
// ==========================================

export const aicloserApi = {
  // 1. Auth & Session
  auth: {
    async login(params: {
      identifier: string;
      password: string;
      clientType?: 'DESKTOP' | 'MOBILE';
      installationId?: string;
    }) {
      const payload = {
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

    async me() {
      const res = await request<{
        user: UserSession;
        tenant: { id: string; name: string };
      }>('/auth/me');
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

  // 2. Leads & Pipeline
  leads: {
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
      const res = await request<Lead[]>(`/leads${query ? `?${query}` : ''}`);
      return {
        leads: res.data,
        pagination: res.pagination,
      };
    },

    async get360(leadId: string): Promise<Lead360Response> {
      const res = await request<Lead360Response>(`/leads/${encodeURIComponent(leadId)}/360`);
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

    async update(leadId: string, payload: Partial<Lead>): Promise<Lead> {
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
      const res = await request(`/leads/${encodeURIComponent(leadId)}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      return res.data;
    },

    async addTask(leadId: string, task: { title: string; description?: string; dueAt?: string; priority?: string }) {
      const res = await request(`/leads/${encodeURIComponent(leadId)}/tasks`, {
        method: 'POST',
        body: JSON.stringify(task),
      });
      return res.data;
    },

    async getPool() {
      const res = await request<Lead[]>('/leads/pool');
      return res.data;
    },

    async claimFromPool(leadId: string) {
      const res = await request(`/leads/${encodeURIComponent(leadId)}/claim`, {
        method: 'POST',
      });
      return res.data;
    },

    async getDuplicates() {
      const res = await request<any[]>('/leads/duplicates');
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
  },

  // 3. Stages Configuration
  stages: {
    async list(): Promise<StageDefinition[]> {
      const res = await request<StageDefinition[]>('/stages');
      return res.data;
    },
  },

  // 4. Omnichannel WhatsApp / Chat
  conversations: {
    async list(params?: { page?: number; limit?: number; search?: string; status?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);

      const query = searchParams.toString();
      const res = await request<Conversation[]>(`/conversations${query ? `?${query}` : ''}`);
      return {
        conversations: res.data,
        pagination: res.pagination,
      };
    },

    async getMessages(conversationId: string, beforeCursor?: string | null, limit: number = 50): Promise<MessagesResponse> {
      const searchParams = new URLSearchParams();
      if (beforeCursor) searchParams.set('before', beforeCursor);
      if (limit) searchParams.set('limit', limit.toString());

      const query = searchParams.toString();
      const res = await request<MessagesResponse>(
        `/conversations/${encodeURIComponent(conversationId)}/messages${query ? `?${query}` : ''}`
      );
      return res.data;
    },

    async sendMessage(conversationId: string, body: string, attachments?: any[]) {
      const res = await request(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, attachments }),
      });
      return res.data;
    },

    async assign(conversationId: string, assignedAgentId: string) {
      const res = await request('/conversations/' + encodeURIComponent(conversationId) + '/assign', {
        method: 'POST',
        body: JSON.stringify({ assignedAgentId }),
      });
      return res.data;
    },

    async updateStage(conversationId: string, stage: string) {
      const res = await request('/conversations/' + encodeURIComponent(conversationId) + '/stage', {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      });
      return res.data;
    },

    async addNote(conversationId: string, body: string) {
      const res = await request('/conversations/' + encodeURIComponent(conversationId) + '/notes', {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      return res.data;
    },

    async scheduleCallback(conversationId: string, followUpAt: string, note?: string) {
      const res = await request('/conversations/' + encodeURIComponent(conversationId) + '/callback', {
        method: 'POST',
        body: JSON.stringify({ followUpAt, note }),
      });
      return res.data;
    },

    async setTyping(conversationId: string, isTyping: boolean) {
      const res = await request('/conversations/' + encodeURIComponent(conversationId) + '/typing', {
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

    async getAiReply(conversationId: string): Promise<{ suggestedReply: string; confidence: number }> {
      const res = await request<{ suggestedReply: string; confidence: number }>(
        '/conversations/' + encodeURIComponent(conversationId) + '/ai-reply',
        { method: 'POST' }
      );
      return res.data;
    },

    async triggerDrip(conversationId: string, action: 'PAUSE' | 'RESUME' | 'TRIGGER', sequenceId?: string) {
      const res = await request('/conversations/' + encodeURIComponent(conversationId) + '/drip', {
        method: 'POST',
        body: JSON.stringify({ action, sequenceId }),
      });
      return res.data;
    },

    getAttachmentUrl(conversationId: string, filename: string): string {
      const token = getStoredToken();
      const tokenParam = token ? '?token=' + encodeURIComponent(token) : '';
      return API_BASE_URL + '/conversations/' + encodeURIComponent(conversationId) + '/attachments/' + encodeURIComponent(filename) + tokenParam;
    },

    async uploadAttachment(conversationId: string, file: File) {
      const formData = new FormData();
      formData.append('file', file);

      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const res = await fetch(`${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/attachments`, {
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
  },

  // 5. Telephony & Recordings
  calls: {
    async list(params?: { page?: number; limit?: number; outcome?: string; recordingStatus?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.outcome) searchParams.set('outcome', params.outcome);
      if (params?.recordingStatus) searchParams.set('recordingStatus', params.recordingStatus);

      const query = searchParams.toString();
      const res = await request<CallLog[]>(`/calls${query ? `?${query}` : ''}`);
      return {
        calls: res.data,
        pagination: res.pagination,
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
    async disposition(callId: string, payload: { outcome: string; note?: string; nextFollowUpAt?: string; stage?: string }) {
      const res = await request(`/calls/${encodeURIComponent(callId)}/disposition`, {
        method: 'POST',
        body: JSON.stringify(payload),
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
  },

  // 6. Payments & Collections
  payments: {
    async list(params?: { page?: number; limit?: number; leadId?: string; status?: string }) {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.leadId) searchParams.set('leadId', params.leadId);
      if (params?.status) searchParams.set('status', params.status);

      const query = searchParams.toString();
      const res = await request<any[]>(`/payments${query ? `?${query}` : ''}`);
      return {
        payments: res.data,
        pagination: res.pagination,
      };
    },

    async createUpiLink(payload: { leadId?: string; amount: number; customerName: string; customerPhone: string; customerEmail?: string; productName?: string; customerNote?: string }) {
      const res = await request('/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
  },

  // 7. Dynamic Custom Fields
  customFields: {
    async list() {
      const res = await request<any[]>('/custom-fields');
      return res.data;
    },
    async create(payload: { key: string; label: string; type: string; isRequired?: boolean; options?: string[] }) {
      const res = await request('/custom-fields', {
        method: 'POST',
        body: JSON.stringify(payload),
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
  },

  // 9. Storage Vault Integrations (Google Drive Option 2)
  integrations: {
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

      async disconnect() {
        const res = await request('/integrations/google-drive/disconnect', {
          method: 'POST',
        });
        return res.data;
      },

      async testSync() {
        const res = await request('/integrations/google-drive/sync-test', {
          method: 'POST',
        });
        return res.data;
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
    async copilot(query: string) {
      const res = await request('/ai/copilot', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
      return res.data;
    },
  },

  // 13. Marketing, Templates & WhatsApp Campaigns
  marketing: {
    async getTemplates() {
      const res = await request('/marketing/templates');
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
      const res = await request(`/marketing/contacts?${query.toString()}`);
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
    }) {
      const res = await request('/marketing/campaigns', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.data;
    },
    async dispatchCampaign(id: string) {
      const res = await request(`/marketing/campaigns/${id}/dispatch`, { method: 'POST' });
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
  },

  // 10. Realtime SSE Connection
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

    async pushToken(payload: { token: string; platform?: 'android' | 'ios'; deviceId?: string }) {
      const res = await request('/mobile/push-token', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
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
  },

  realtime: {
    connect(callbacks: {
      onEvent: (event: { type: string; payload: any }) => void;
      onError?: (err: any) => void;
    }): () => void {
      const token = getStoredToken();
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
      const url = `${API_BASE_URL}/realtime/events${tokenParam}`;

      const eventSource = new EventSource(url, { withCredentials: true });

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
};
