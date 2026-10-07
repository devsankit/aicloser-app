"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Layers,
  MessageCircle,
  Pause,
  Phone,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";

type WhatsAppTab = "overview" | "templates" | "campaigns" | "contacts" | "import" | "settings";

interface WhatsAppChannelState {
  id?: string;
  tenantId?: string;
  businessPortfolioId?: string | null;
  wabaId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string | null;
  qualityRating?: string | null;
  messagingLimitTier?: string | null;
  status?: string;
  graphApiVersion?: string;
  hasAccessToken?: boolean;
  hasDedicatedWebhookToken?: boolean;
  lastSyncedAt?: string | null;
}

interface ChannelResponse {
  ok: boolean;
  connected: boolean;
  requestedPhone: string;
  matchesRequestedPhone?: boolean;
  mockMode?: boolean;
  bootstrapAvailable?: boolean;
  bootstrapDefaults?: {
    wabaId: string;
    phoneNumberId: string;
    hasAccessToken: boolean;
  };
  channel: WhatsAppChannelState | null;
}

interface WhatsAppTemplateItem {
  id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED";
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerContent?: string | null;
  bodyText: string;
  footerText?: string | null;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  variableCount: number;
  qualityRating?: string | null;
  rejectionReason?: string | null;
  updatedAt: string;
  channel?: {
    displayPhoneNumber: string;
    verifiedName: string | null;
  };
}

interface WhatsAppCampaignItem {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  repliedCount: number;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  template?: { name: string; category: string };
  channel?: { displayPhoneNumber: string };
}

interface MarketingContactItem {
  id: string;
  fullName: string;
  phone: string;
  e164Phone?: string;
  email?: string | null;
  tags?: string[];
  optInStatus: string;
  optInSource?: string | null;
  isBlocked: boolean;
  groups?: Array<{ id: string; name: string }>;
  lastCampaignSentAt?: string | null;
  lastDeliveredAt?: string | null;
  lastReadAt?: string | null;
  lastRepliedAt?: string | null;
  createdAt: string;
}

interface ContactGroupItem {
  id: string;
  name: string;
  description?: string | null;
  contactCount?: number;
  memberCount?: number;
  createdAt: string;
}

interface CampaignPreviewItem {
  name?: string;
  phone?: string;
  messagePreview?: string;
  renderedMessage?: string;
  resolvedVariables?: Record<string, string>;
}

interface ImportResultData {
  jobId?: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
}

export function WhatsAppMarketingDashboard() {
  const [activeTab, setActiveTab] = useState<WhatsAppTab>("overview");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Channel Connection State
  const [channelInfo, setChannelInfo] = useState<ChannelResponse | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Template State
  const [templates, setTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);

  // New Template Draft State
  const [templateDraft, setTemplateDraft] = useState({
    name: "",
    language: "en_US",
    category: "MARKETING" as "MARKETING" | "UTILITY" | "AUTHENTICATION",
    headerType: "NONE" as "NONE" | "TEXT" | "IMAGE",
    headerText: "",
    headerHandle: "",
    bodyText: "Hello {{1}}, we have an exclusive update for you! Reply STOP to opt out.",
    footerText: "Reply STOP to unsubscribe",
    exampleValues: { "1": "Ankit" } as Record<string, string>,
    buttons: [] as Array<{ type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; url?: string; phone_number?: string }>,
  });
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Campaign State
  const [campaigns, setCampaigns] = useState<WhatsAppCampaignItem[]>([]);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [campaignStep, setCampaignStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [campaignDraft, setCampaignDraft] = useState({
    name: "",
    templateId: "",
    groupIds: [] as string[],
    variableMappings: { "1": { source: "contact_field" as const, fieldOrValue: "firstName" } } as Record<
      string,
      { source: "contact_field" | "static"; fieldOrValue: string }
    >,
    scheduledAt: "",
    timezone: "Asia/Kolkata",
  });
  const [campaignPreviews, setCampaignPreviews] = useState<CampaignPreviewItem[]>([]);
  const [isTestingSend, setIsTestingSend] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("9993328124");

  // Contacts & Groups State
  const [contacts, setContacts] = useState<MarketingContactItem[]>([]);
  const [groups, setGroups] = useState<ContactGroupItem[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  // Import State
  const [importSource, setImportSource] = useState<"csv" | "sheets">("csv");
  const [csvInput, setCsvInput] = useState("");
  const [sheetsAccessToken, setSheetsAccessToken] = useState("");
  const [sheetsSpreadsheetId, setSheetsSpreadsheetId] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);

  // Manual Channel Setup form
  const [manualSetup, setManualSetup] = useState({
    phoneNumberId: "",
    wabaId: "",
    businessPortfolioId: "",
    accessToken: "",
  });

  const showToast = (text: string, type: "success" | "error" | "info" = "info") => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Fetch initial channel info
  const loadChannel = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp-marketing/channel");
      const data = await res.json();
      if (data.ok) {
        setChannelInfo(data);
        if (data.channel) {
          setManualSetup({
            phoneNumberId: data.channel.phoneNumberId || "",
            wabaId: data.channel.wabaId || "",
            businessPortfolioId: data.channel.businessPortfolioId || "",
            accessToken: "",
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp-marketing/templates");
      const data = await res.json();
      if (data.ok) setTemplates(data.templates || []);
    } catch {
      // ignore
    }
  }, []);

  // Fetch campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp-marketing/campaigns");
      const data = await res.json();
      if (data.ok) setCampaigns(data.campaigns || []);
    } catch {
      // ignore
    }
  }, []);

  // Fetch contacts
  const loadContacts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (contactSearch) params.set("q", contactSearch);
      if (selectedGroupFilter) params.set("groupId", selectedGroupFilter);
      const res = await fetch(`/api/whatsapp-marketing/contacts?${params.toString()}`);
      const data = await res.json();
      if (data.ok) setContacts(data.contacts || []);
    } catch {
      // ignore
    }
  }, [contactSearch, selectedGroupFilter]);

  // Fetch groups
  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp-marketing/contacts/groups");
      const data = await res.json();
      if (data.ok) setGroups(data.groups || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadChannel();
    void loadTemplates();
    void loadCampaigns();
    void loadGroups();
  }, [loadChannel, loadTemplates, loadCampaigns, loadGroups]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  // Sync templates from Meta
  const handleSyncTemplates = async () => {
    setIsSyncingTemplates(true);
    try {
      const res = await fetch("/api/whatsapp-marketing/templates/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Synced ${data.total} templates (${data.created} created, ${data.updated} updated) from Meta.`, "success");
        await loadTemplates();
      } else {
        showToast(data.error || "Failed to sync templates.", "error");
      }
    } catch {
      showToast("Network error syncing templates.", "error");
    } finally {
      setIsSyncingTemplates(false);
    }
  };

  // Submit new template
  const handleSubmitTemplate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp-marketing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateDraft),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Template "${templateDraft.name}" submitted to Meta for approval.`, "success");
        setIsTemplateModalOpen(false);
        await loadTemplates();
      } else {
        showToast(data.error || "Failed to submit template.", "error");
      }
    } catch {
      showToast("Network error submitting template.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Upload Sample Header Media
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/whatsapp-marketing/templates/media", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.ok && data.handle) {
        setTemplateDraft((prev) => ({
          ...prev,
          headerHandle: data.handle,
        }));
        showToast("Header sample media uploaded to Meta successfully.", "success");
      } else {
        showToast(data.error || "Failed to upload sample media.", "error");
      }
    } catch {
      showToast("Network error uploading media.", "error");
    } finally {
      setUploadingMedia(false);
    }
  };

  // Save Meta Connection
  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    try {
      const res = await fetch("/api/whatsapp-marketing/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualSetup),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(
          data.matchesRequestedPhone
            ? "Connected & verified WhatsApp business number 9993328124 successfully!"
            : "Connected to Meta successfully, but display number does not match 9993328124.",
          data.matchesRequestedPhone ? "success" : "info",
        );
        await loadChannel();
      } else {
        showToast(data.error || "Failed to connect to Meta.", "error");
      }
    } catch {
      showToast("Network error connecting to Meta.", "error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Send Test Message
  const handleSendTestMessage = async (templateId: string) => {
    setIsTestingSend(true);
    try {
      const res = await fetch("/api/whatsapp-marketing/channel/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channelInfo?.channel?.id,
          templateId,
          testPhone: testPhoneNumber,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Test message sent successfully to ${testPhoneNumber}!`, "success");
      } else {
        showToast(data.error || "Failed to send test message.", "error");
      }
    } catch {
      showToast("Network error sending test message.", "error");
    } finally {
      setIsTestingSend(false);
    }
  };

  // Campaign Actions (Pause, Resume, Cancel, Retry, Dispatch)
  const handleCampaignAction = async (campaignId: string, action: string) => {
    try {
      const res = await fetch(`/api/whatsapp-marketing/campaigns/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Campaign action '${action}' completed.`, "success");
        await loadCampaigns();
      } else {
        showToast(data.error || `Failed action ${action}`, "error");
      }
    } catch {
      showToast("Network error executing campaign action.", "error");
    }
  };

  // Dispatch campaign worker batch
  const handleDispatchBatch = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/whatsapp-marketing/campaigns/${campaignId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchLimit: 20 }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Dispatched batch (${data.processed} messages sent).`, "success");
        await loadCampaigns();
      } else {
        showToast(data.error || "Failed to dispatch batch.", "error");
      }
    } catch {
      showToast("Error triggering queue dispatch.", "error");
    }
  };

  // Load Campaign Preview
  const handleLoadCampaignPreview = async () => {
    if (!campaignDraft.templateId) return;
    try {
      const res = await fetch(`/api/whatsapp-marketing/campaigns/${campaignDraft.templateId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: campaignDraft.templateId,
          groupIds: campaignDraft.groupIds,
          variableMappings: campaignDraft.variableMappings,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCampaignPreviews(data.previews || []);
      }
    } catch {
      // ignore
    }
  };

  // Launch Campaign
  const handleCreateCampaign = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp-marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignDraft),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Campaign "${campaignDraft.name}" queued successfully!`, "success");
        setIsCampaignModalOpen(false);
        setCampaignStep(1);
        await loadCampaigns();
      } else {
        showToast(data.error || "Failed to create campaign.", "error");
      }
    } catch {
      showToast("Network error creating campaign.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Contact Suppression
  const handleToggleSuppression = async (phone: string, isSuppressed: boolean) => {
    try {
      const res = await fetch("/api/whatsapp-marketing/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          fullName: "Contact",
          action: isSuppressed ? "UNSUPPRESS" : "SUPPRESS",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Contact ${phone} ${isSuppressed ? "unblocked" : "suppressed / opted-out"}.`, "success");
        await loadContacts();
      }
    } catch {
      showToast("Network error updating contact status.", "error");
    }
  };

  // Create Contact Group
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const res = await fetch("/api/whatsapp-marketing/contacts/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Created contact group "${newGroupName}".`, "success");
        setNewGroupName("");
        await loadGroups();
      }
    } catch {
      showToast("Failed to create contact group.", "error");
    }
  };

  // Run Import
  const handleExecuteImport = async () => {
    if (!consentConfirmed) {
      showToast("You must confirm opt-in consent before importing marketing contacts.", "error");
      return;
    }
    setIsProcessingImport(true);
    try {
      const res = await fetch("/api/whatsapp-marketing/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: importSource === "csv" ? "CSV" : "GOOGLE_SHEETS",
          csvText: importSource === "csv" ? csvInput : undefined,
          googleAccessToken: importSource === "sheets" ? sheetsAccessToken : undefined,
          spreadsheetId: importSource === "sheets" ? sheetsSpreadsheetId : undefined,
          consentDeclared: consentConfirmed,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setImportResult(data);
        showToast(`Imported ${data.validRows} contacts (${data.invalidRows} invalid, ${data.duplicateRows} duplicates).`, "success");
        await loadContacts();
        await loadGroups();
      } else {
        showToast(data.error || "Import failed.", "error");
      }
    } catch {
      showToast("Network error executing import.", "error");
    } finally {
      setIsProcessingImport(false);
    }
  };

  return (
    <div className="whatsapp-marketing-root space-y-6 text-slate-100">
      {/* Toast Banner */}
      {statusMessage && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border ${
            statusMessage.type === "success"
              ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
              : statusMessage.type === "error"
              ? "bg-rose-950/80 border-rose-500/50 text-rose-200"
              : "bg-blue-950/80 border-blue-500/50 text-blue-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : statusMessage.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            )}
            <span className="text-sm font-medium">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#ff6b2f]/10 border border-[#ff6b2f]/30 rounded-xl">
              <MessageCircle className="w-6 h-6 text-[#ff6b2f]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
                WhatsApp Marketing & Template OS
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#ff6b2f]/15 text-[#ff6b2f] border border-[#ff6b2f]/30">
                  Meta v22.0
                </span>
                {channelInfo?.mockMode && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    DRY-RUN / MOCK MODE ACTIVE
                  </span>
                )}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Official Cloud API outbound marketing, Meta-approved template builder, audience segments, and throttled queue dispatch.
              </p>
            </div>
          </div>
        </div>

        {/* Channel connection quick badge */}
        <div className="flex items-center gap-3">
          {channelInfo?.connected && channelInfo.channel ? (
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-900/90 border border-[#ff6b2f]/40 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-[#ff6b2f] animate-pulse" />
              <span className="text-slate-300">
                Line: <strong className="text-white">{channelInfo.channel.displayPhoneNumber}</strong>
              </span>
              {channelInfo.matchesRequestedPhone ? (
                <span className="px-1.5 py-0.5 bg-[#ff6b2f]/20 text-[#ff6b2f] rounded font-semibold text-[10px]">
                  VERIFIED 9993328124
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px]">
                  Custom Line
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-950/40 border border-amber-500/30 rounded-full text-xs text-amber-300">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Meta Channel Disconnected</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex overflow-x-auto gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-xl">
        {[
          { id: "overview", label: "Overview & Analytics", icon: Layers },
          { id: "templates", label: "Templates", icon: FileText, count: templates.length },
          { id: "campaigns", label: "Campaigns", icon: Send, count: campaigns.length },
          { id: "contacts", label: "Contacts & Audiences", icon: Users, count: contacts.length },
          { id: "import", label: "Import Contacts", icon: FileSpreadsheet },
          { id: "settings", label: "Connection & Settings", icon: Smartphone },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as WhatsAppTab)}
              className={`whatsapp-subtab-btn flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? "is-active bg-[#ff6b2f] text-white font-semibold shadow-lg shadow-[#ff6b2f]/25"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Active Channel</span>
                <Phone className="w-4 h-4 text-[#ff6b2f]" />
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold text-white">
                  {channelInfo?.channel?.displayPhoneNumber || "Not Connected"}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b2f]" />
                  Quality: {channelInfo?.channel?.qualityRating || "GREEN"} | Tier: {channelInfo?.channel?.messagingLimitTier || "TIER_1K"}
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Meta Templates</span>
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold text-white">{templates.length} Total</div>
                <div className="text-xs text-slate-400 mt-1">
                  {templates.filter((t) => t.status === "APPROVED").length} Approved by Meta
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Campaigns Dispatched</span>
                <Send className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold text-white">{campaigns.length} Campaigns</div>
                <div className="text-xs text-slate-400 mt-1">
                  {campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0)} Total Messages Sent
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Opted-In Audience</span>
                <UserCheck className="w-4 h-4 text-[#ff6b2f]" />
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold text-white">
                  {contacts.filter((c) => c.optInStatus === "OPTED_IN").length} Contacts
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {contacts.filter((c) => c.optInStatus === "OPTED_OUT").length} Suppressed / Opted Out
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Campaigns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Recent WhatsApp Campaigns</h3>
                <button
                  onClick={() => setActiveTab("campaigns")}
                  className="text-xs text-[#ff6b2f] hover:text-[#ff8552] flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {campaigns.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
                  No campaigns created yet. Start your first campaign to begin marketing.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {campaigns.slice(0, 5).map((cmp) => (
                    <div key={cmp.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white text-sm">{cmp.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Template: <span className="text-slate-300">{cmp.template?.name}</span> • {cmp.totalRecipients} recipients
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            cmp.status === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : cmp.status === "RUNNING"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse"
                              : cmp.status === "PAUSED"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {cmp.status}
                        </span>
                        <div className="text-right text-xs">
                          <div className="text-slate-300 font-semibold">{cmp.sentCount} sent</div>
                          <div className="text-slate-500">{cmp.readCount} read</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
              <h3 className="font-semibold text-white">Quick Management</h3>
              <div className="space-y-2.5">
                <button
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-sm font-medium transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Plus className="w-4 h-4 text-[#ff6b2f]" /> Create Meta Template
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => {
                    setIsCampaignModalOpen(true);
                    setCampaignStep(1);
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-sm font-medium transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Send className="w-4 h-4 text-blue-400" /> Launch Bulk Campaign
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => setActiveTab("import")}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-sm font-medium transition"
                >
                  <span className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-4 h-4 text-purple-400" /> Google Sheets / CSV Import
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={handleSyncTemplates}
                  disabled={isSyncingTemplates}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-sm font-medium transition"
                >
                  <span className="flex items-center gap-2.5">
                    <RefreshCw className={`w-4 h-4 text-amber-400 ${isSyncingTemplates ? "animate-spin" : ""}`} />
                    Sync Templates from Meta
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: TEMPLATES & BUILDER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">WhatsApp Message Templates</h2>
              <p className="text-xs text-slate-400">
                Meta requires pre-approved templates for outbound marketing messages sent outside the customer service window.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleSyncTemplates}
                disabled={isSyncingTemplates}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTemplates ? "animate-spin" : ""}`} />
                Sync from Meta
              </button>
              <button
                onClick={() => setIsTemplateModalOpen(true)}
                className="px-4 py-2 bg-[#ff6b2f] hover:bg-[#e85a20] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-[#ff6b2f]/20"
              >
                <Plus className="w-4 h-4" />
                Create New Template
              </button>
            </div>
          </div>

          {/* Templates Grid / Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white text-base">{tpl.name}</h4>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {tpl.language} • {tpl.category}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        tpl.status === "APPROVED"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : tpl.status === "PENDING"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : tpl.status === "REJECTED"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {tpl.status}
                    </span>
                  </div>

                  {tpl.headerType !== "NONE" && (
                    <div className="mt-3 text-xs bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-slate-400">
                      Header: <strong className="text-slate-300">{tpl.headerType}</strong>
                      {tpl.headerContent && ` — ${tpl.headerContent}`}
                    </div>
                  )}

                  <p className="mt-3 text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 font-mono whitespace-pre-wrap line-clamp-4">
                    {tpl.bodyText}
                  </p>

                  {tpl.footerText && (
                    <p className="mt-2 text-[11px] text-slate-500 italic">
                      Footer: {tpl.footerText}
                    </p>
                  )}

                  {tpl.rejectionReason && (
                    <div className="mt-2.5 p-2 bg-rose-950/40 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                      Meta Rejection: {tpl.rejectionReason}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Quality: {tpl.qualityRating || "UNKNOWN"}
                  </span>
                  <button
                    onClick={() => handleSendTestMessage(tpl.id)}
                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[#ff6b2f] rounded-lg border border-slate-700 font-medium flex items-center gap-1 transition"
                  >
                    <Send className="w-3 h-3" /> Test Send
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: CAMPAIGNS & BROADCASTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Bulk WhatsApp Campaigns</h2>
              <p className="text-xs text-slate-400">
                Segmented outbound broadcasts with variable mapping, rate throttling, and delivery analytics.
              </p>
            </div>
            <button
              onClick={() => {
                setIsCampaignModalOpen(true);
                setCampaignStep(1);
              }}
              className="px-4 py-2 bg-[#ff6b2f] hover:bg-[#e85a20] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-[#ff6b2f]/20"
            >
              <Plus className="w-4 h-4" />
              New Broadcast Campaign
            </button>
          </div>

          <div className="space-y-4">
            {campaigns.map((cmp) => (
              <div
                key={cmp.id}
                className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-white text-base">{cmp.name}</h3>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        cmp.status === "COMPLETED"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : cmp.status === "RUNNING"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                          : cmp.status === "PAUSED"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {cmp.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap gap-4">
                    <span>
                      Template: <strong className="text-slate-300">{cmp.template?.name}</strong>
                    </span>
                    <span>
                      Recipients: <strong className="text-slate-300">{cmp.totalRecipients}</strong>
                    </span>
                    <span>
                      Created: <strong className="text-slate-300">{cmp.createdAt ? new Date(cmp.createdAt).toLocaleDateString() : "—"}</strong>
                    </span>
                  </div>
                </div>

                {/* Metrics Pill Grid */}
                <div className="flex items-center gap-4 text-center">
                  <div className="px-3 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="text-sm font-bold text-white">{cmp.sentCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Sent</div>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="text-sm font-bold text-emerald-400">{cmp.deliveredCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Delivered</div>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="text-sm font-bold text-blue-400">{cmp.readCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Read</div>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="text-sm font-bold text-rose-400">{cmp.failedCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Failed</div>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div className="text-sm font-bold text-purple-400">{cmp.repliedCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Replies</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {cmp.status === "RUNNING" && (
                    <button
                      onClick={() => handleCampaignAction(cmp.id, "PAUSE")}
                      className="p-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 border border-amber-500/30"
                      title="Pause Campaign"
                    >
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </button>
                  )}
                  {cmp.status === "PAUSED" && (
                    <button
                      onClick={() => handleCampaignAction(cmp.id, "RESUME")}
                      className="p-2 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 border border-emerald-500/30"
                      title="Resume Campaign"
                    >
                      <Play className="w-3.5 h-3.5" /> Resume
                    </button>
                  )}
                  {cmp.status === "RUNNING" && (
                    <button
                      onClick={() => handleDispatchBatch(cmp.id)}
                      className="p-2 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700"
                      title="Trigger next worker batch"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-400" /> Dispatch Batch
                    </button>
                  )}
                  {cmp.failedCount > 0 && cmp.status !== "RUNNING" && (
                    <button
                      onClick={() => handleCampaignAction(cmp.id, "RETRY_FAILED")}
                      className="p-2 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700"
                      title="Retry failed recipients"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400" /> Retry Failed
                    </button>
                  )}
                  {cmp.status !== "COMPLETED" && cmp.status !== "CANCELLED" && (
                    <button
                      onClick={() => handleCampaignAction(cmp.id, "CANCEL")}
                      className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg text-xs font-semibold border border-rose-500/20"
                      title="Cancel remaining"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: CONTACTS & GROUPS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "contacts" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Marketing Contacts & Audience Segments</h2>
              <p className="text-xs text-slate-400">
                Audience directory with E.164 phone normalization, opt-in consent records, and suppression lists.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
                <input
                  type="text"
                  placeholder="New group name..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none w-32"
                />
                <button
                  onClick={handleCreateGroup}
                  className="text-xs bg-[#ff6b2f]/15 text-[#ff6b2f] border border-[#ff6b2f]/30 px-2 py-1 rounded font-bold hover:bg-[#ff6b2f]/25"
                >
                  Add Group
                </button>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, phone, or tag..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
              />
            </div>

            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount})
                </option>
              ))}
            </select>
          </div>

          {/* Contacts Table */}
          <div className="overflow-x-auto bg-slate-900/90 border border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4">Contact</th>
                  <th className="p-4">WhatsApp Phone (E.164)</th>
                  <th className="p-4">Opt-In Status</th>
                  <th className="p-4">Groups</th>
                  <th className="p-4">Last Activity</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No marketing contacts found. Use the Import Contacts tab to upload contacts.
                    </td>
                  </tr>
                ) : (
                  contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <div className="font-semibold text-white">{c.fullName}</div>
                        {c.email && <div className="text-slate-400 text-[11px]">{c.email}</div>}
                      </td>
                      <td className="p-4 font-mono font-medium text-slate-300">
                        {c.e164Phone || c.phone}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            c.optInStatus === "OPTED_IN"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : c.optInStatus === "OPTED_OUT"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {c.optInStatus}
                        </span>
                        {c.optInSource && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{c.optInSource}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {c.groups?.map((g: { id: string; name: string }) => (
                            <span
                              key={g.id}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                            >
                              {g.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-slate-400 text-[11px]">
                        {c.lastCampaignSentAt
                          ? `Campaign: ${new Date(c.lastCampaignSentAt).toLocaleDateString()}`
                          : "No campaigns yet"}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleSuppression(c.e164Phone || c.phone, c.optInStatus === "OPTED_OUT")}
                          className={`text-xs px-2.5 py-1 rounded font-medium border transition ${
                            c.optInStatus === "OPTED_OUT"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                          }`}
                        >
                          {c.optInStatus === "OPTED_OUT" ? "Unsuppress" : "Opt-Out"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: IMPORT CONTACTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "import" && (
        <div className="space-y-6 w-full">
          <div>
            <h2 className="text-lg font-bold text-white">Import Contacts from Google Sheets or CSV</h2>
            <p className="text-xs text-slate-400">
              Bulk audience ingestion with automated E.164 phone normalization, deduplication, and policy compliance verification.
            </p>
          </div>

          <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-6">
            {/* Source Toggle */}
            <div className="flex gap-4">
              <button
                onClick={() => setImportSource("csv")}
                className={`flex-1 p-4 rounded-xl border text-center transition ${
                  importSource === "csv"
                    ? "bg-[#ff6b2f]/10 border-[#ff6b2f]/50 text-white font-bold"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Upload className="w-5 h-5 mx-auto mb-1 text-[#ff6b2f]" />
                <span>CSV Text / Paste</span>
              </button>
              <button
                onClick={() => setImportSource("sheets")}
                className={`flex-1 p-4 rounded-xl border text-center transition ${
                  importSource === "sheets"
                    ? "bg-[#ff6b2f]/10 border-[#ff6b2f]/50 text-white font-bold"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                <span>Google Sheets OAuth</span>
              </button>
            </div>

            {importSource === "csv" ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Paste CSV Data (with headers: name, phone, email, group, tags)
                </label>
                <textarea
                  rows={8}
                  placeholder={`name,phone,email,group,tags\nAnkit Rathore,+919993328124,ankit@aicloser.in,Enterprise Leads,hot\nJohn Doe,9876543210,john@example.com,Inbound Trial,warm`}
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:border-[#ff6b2f] focus:outline-none"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Google Spreadsheet ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    value={sheetsSpreadsheetId}
                    onChange={(e) => setSheetsSpreadsheetId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-[#ff6b2f] focus:outline-none mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Google OAuth Read-Only Access Token</label>
                  <input
                    type="password"
                    placeholder="ya29.a0AfH6SM..."
                    value={sheetsAccessToken}
                    onChange={(e) => setSheetsAccessToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-[#ff6b2f] focus:outline-none mt-1"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Token is only used server-side to read spreadsheet values and is never stored.
                  </p>
                </div>
              </div>
            )}

            {/* Mandatory Opt-in Consent Confirmation */}
            <div className="p-4 bg-[#ff6b2f]/10 border border-[#ff6b2f]/30 rounded-xl space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(e) => setConsentConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-[#ff6b2f] focus:ring-[#ff6b2f]"
                />
                <span className="text-xs text-slate-200 leading-relaxed">
                  <strong>Mandatory Compliance Confirmation:</strong> I verify that all contacts in this import list have provided explicit consent to receive WhatsApp marketing communications from our workspace.
                </span>
              </label>
            </div>

            <button
              onClick={handleExecuteImport}
              disabled={isProcessingImport || !consentConfirmed}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
                isProcessingImport || !consentConfirmed
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-[#ff6b2f] text-white hover:bg-[#e85a20] shadow-lg shadow-[#ff6b2f]/20"
              }`}
            >
              {isProcessingImport ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Processing Import...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Start Contact Ingestion
                </>
              )}
            </button>

            {importResult && (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-white">Import Summary:</div>
                <div className="grid grid-cols-4 gap-2 text-center mt-2">
                  <div className="p-2 bg-slate-900 rounded">
                    <div className="font-bold text-white">{importResult.totalRows}</div>
                    <div className="text-slate-500 text-[10px]">Total Rows</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded">
                    <div className="font-bold text-emerald-400">{importResult.validRows}</div>
                    <div className="text-slate-500 text-[10px]">Imported</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded">
                    <div className="font-bold text-amber-400">{importResult.duplicateRows}</div>
                    <div className="text-slate-500 text-[10px]">Duplicates</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded">
                    <div className="font-bold text-rose-400">{importResult.invalidRows}</div>
                    <div className="text-slate-500 text-[10px]">Invalid</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 6: SETTINGS & CONNECTION */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "settings" && (
        <div className="space-y-6 w-full">
          <div>
            <h2 className="text-lg font-bold text-white">Meta WhatsApp Cloud API Connection</h2>
            <p className="text-xs text-slate-400">
              Official Embedded Signup / System User Token configuration verifying phone line 9993328124.
            </p>
          </div>

          <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-6">
            {/* Live Verification Status Card */}
            <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase">Target WhatsApp Business Number</span>
                {channelInfo?.matchesRequestedPhone ? (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED MATCH (9993328124)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <AlertCircle className="w-3.5 h-3.5" /> LINE CHECK PENDING
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <span className="text-slate-500">Configured Phone Number ID:</span>
                  <div className="font-mono text-slate-200 mt-0.5 font-bold">
                    {channelInfo?.channel?.phoneNumberId || "Not registered yet"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">WhatsApp Business Account ID (WABA):</span>
                  <div className="font-mono text-slate-200 mt-0.5 font-bold">
                    {channelInfo?.channel?.wabaId || "Not configured"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Display Name Verified by Meta:</span>
                  <div className="text-white mt-0.5 font-bold">
                    {channelInfo?.channel?.verifiedName || "AIcloser CRM"}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Graph API Version:</span>
                  <div className="font-mono text-[#ff6b2f] mt-0.5 font-bold">v22.0 (Centralized)</div>
                </div>
              </div>
            </div>

            {/* Test Send Tool */}
            <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Test Send Message</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Recipient phone number (e.g. 9993328124)"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white flex-1 focus:outline-none"
                />
                <button
                  onClick={() => templates[0] && handleSendTestMessage(templates[0].id)}
                  disabled={isTestingSend || templates.length === 0}
                  className="px-4 py-2 bg-[#ff6b2f] hover:bg-[#e85a20] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Send Test
                </button>
              </div>
            </div>

            {/* Manual Credential Configuration Form */}
            <form onSubmit={handleSaveConnection} className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Admin Connection Credentials
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setManualSetup({
                      phoneNumberId: "962346373625331",
                      wabaId: "2744233995921639",
                      businessPortfolioId: "100910602174128",
                      accessToken: manualSetup.accessToken,
                    });
                    showToast("Pre-filled verified Meta credentials for 9993328124", "info");
                  }}
                  className="px-2.5 py-1 text-[11px] bg-[#ff6b2f]/10 hover:bg-[#ff6b2f]/20 text-[#ff6b2f] border border-[#ff6b2f]/30 rounded-lg transition font-medium flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Pre-fill Verified Account (9993328124)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Meta Phone Number ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 106429382910394"
                    value={manualSetup.phoneNumberId}
                    onChange={(e) => setManualSetup({ ...manualSetup, phoneNumberId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:border-[#ff6b2f] focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium">WhatsApp Business Account ID (WABA ID)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 102938475619283"
                    value={manualSetup.wabaId}
                    onChange={(e) => setManualSetup({ ...manualSetup, wabaId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:border-[#ff6b2f] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">Meta Business Portfolio ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 100910602174128"
                  value={manualSetup.businessPortfolioId}
                  onChange={(e) => setManualSetup({ ...manualSetup, businessPortfolioId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:border-[#ff6b2f] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">
                  Meta System User / WhatsApp Access Token (Encrypted At Rest)
                </label>
                <input
                  type="password"
                  placeholder="EAAG..."
                  value={manualSetup.accessToken}
                  onChange={(e) => setManualSetup({ ...manualSetup, accessToken: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:border-[#ff6b2f] focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Never logged, exposed in client responses, or committed to git. Encrypted with AES-256-GCM.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="px-6 py-2.5 bg-[#ff6b2f] hover:bg-[#e85a20] text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-[#ff6b2f]/20"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying Connection...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Save & Verify Meta Line
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Webhook Instructions */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-white">Meta Webhook Configuration:</span>
              <p className="text-slate-400">
                In your Meta App Dashboard under WhatsApp &gt; Configuration, point the Callback URL to:
              </p>
              <div className="font-mono p-2 bg-slate-900 rounded border border-slate-800 text-[#ff6b2f] select-all">
                https://closer.gigxomi.com/api/whatsapp-marketing/webhook
              </div>
              <p className="text-slate-500 text-[11px]">
                Verify token: <code className="text-slate-300">gigxomi_whatsapp_marketing_token</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE TEMPLATE BUILDER */}
      {/* ------------------------------------------------------------- */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl my-8">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-white">Create Meta WhatsApp Template</h3>
                <p className="text-xs text-slate-400">
                  Build and submit a template adhering to Meta&apos;s strict category &amp; variable policies.
                </p>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Form Controls */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Template Name</label>
                  <input
                    type="text"
                    placeholder="e.g. agency_growth_invite_v1"
                    value={templateDraft.name}
                    onChange={(e) =>
                      setTemplateDraft({
                        ...templateDraft,
                        name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono mt-1 focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Lowercase letters, numbers, and underscores only.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Category</label>
                    <select
                      value={templateDraft.category}
                      onChange={(e) =>
                        setTemplateDraft({
                          ...templateDraft,
                          category: e.target.value as "MARKETING" | "UTILITY" | "AUTHENTICATION",
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:outline-none"
                    >
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utility</option>
                      <option value="AUTHENTICATION">Authentication</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300">Language</label>
                    <select
                      value={templateDraft.language}
                      onChange={(e) => setTemplateDraft({ ...templateDraft, language: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:outline-none"
                    >
                      <option value="en_US">English (US)</option>
                      <option value="en_GB">English (UK)</option>
                      <option value="hi">Hindi</option>
                    </select>
                  </div>
                </div>

                {/* Header Type */}
                <div>
                  <label className="text-xs font-semibold text-slate-300">Header (Optional)</label>
                  <select
                    value={templateDraft.headerType}
                    onChange={(e) =>
                      setTemplateDraft({
                        ...templateDraft,
                        headerType: e.target.value as "NONE" | "TEXT" | "IMAGE",
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:outline-none"
                  >
                    <option value="NONE">None</option>
                    <option value="TEXT">Text Header</option>
                    <option value="IMAGE">Image Header</option>
                  </select>

                  {templateDraft.headerType === "TEXT" && (
                    <input
                      type="text"
                      placeholder="Header text (max 60 chars)"
                      maxLength={60}
                      value={templateDraft.headerText}
                      onChange={(e) => setTemplateDraft({ ...templateDraft, headerText: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white mt-2 focus:outline-none"
                    />
                  )}

                  {templateDraft.headerType === "IMAGE" && (
                    <div className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Sample Header Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleMediaUpload}
                          className="text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                        />
                      </div>
                      {uploadingMedia && <p className="text-[10px] text-amber-400">Uploading to Meta...</p>}
                      {templateDraft.headerHandle && (
                        <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Handle: {templateDraft.headerHandle.slice(0, 16)}...
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Body Text */}
                <div>
                  <label className="text-xs font-semibold text-slate-300">
                    Body Text (Use {"{{1}}"}, {"{{2}}"} for variables)
                  </label>
                  <textarea
                    rows={4}
                    value={templateDraft.bodyText}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, bodyText: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                {/* Sample Values for Variables */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Sample Variable Values</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Sample value for {{1}}"
                      value={templateDraft.exampleValues["1"] || ""}
                      onChange={(e) =>
                        setTemplateDraft({
                          ...templateDraft,
                          exampleValues: { ...templateDraft.exampleValues, "1": e.target.value },
                        })
                      }
                      className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Sample value for {{2}}"
                      value={templateDraft.exampleValues["2"] || ""}
                      onChange={(e) =>
                        setTemplateDraft({
                          ...templateDraft,
                          exampleValues: { ...templateDraft.exampleValues, "2": e.target.value },
                        })
                      }
                      className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Footer Text */}
                <div>
                  <label className="text-xs font-semibold text-slate-300">Footer Text (Optional)</label>
                  <input
                    type="text"
                    maxLength={60}
                    value={templateDraft.footerText}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, footerText: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Mobile Mockup Preview */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-950/70 border border-slate-800 rounded-2xl">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Live WhatsApp Preview
                </span>

                <div className="w-72 bg-[#0b141a] rounded-[2.5rem] border-[6px] border-slate-800 p-3 shadow-2xl relative">
                  {/* Phone Notch */}
                  <div className="w-24 h-4 bg-slate-800 rounded-b-xl mx-auto mb-3" />

                  {/* WhatsApp Chat Bubble */}
                  <div className="bg-[#005c4b] text-slate-100 p-3.5 rounded-2xl rounded-tl-sm text-xs space-y-2 shadow">
                    {templateDraft.headerType === "TEXT" && templateDraft.headerText && (
                      <div className="font-bold text-white text-xs border-b border-emerald-600/50 pb-1">
                        {templateDraft.headerText}
                      </div>
                    )}

                    {templateDraft.headerType === "IMAGE" && (
                      <div className="w-full h-24 bg-emerald-900/50 rounded-lg flex items-center justify-center text-[10px] text-emerald-300 border border-emerald-600/40">
                        [Header Image Preview]
                      </div>
                    )}

                    <div className="text-slate-100 leading-relaxed font-sans">
                      {templateDraft.bodyText
                        .replace(/\{\{1\}\}/g, templateDraft.exampleValues["1"] || "{{1}}")
                        .replace(/\{\{2\}\}/g, templateDraft.exampleValues["2"] || "{{2}}")}
                    </div>

                    {templateDraft.footerText && (
                      <div className="text-[10px] text-slate-300/80 pt-1 border-t border-emerald-600/30">
                        {templateDraft.footerText}
                      </div>
                    )}

                    <div className="text-[9px] text-slate-300/60 text-right flex items-center justify-end gap-1">
                      <span>10:30 AM</span>
                      <CheckCheck size={11} className="text-emerald-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/40">
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTemplate}
                disabled={loading}
                className="px-6 py-2.5 bg-[#ff6b2f] hover:bg-[#e85a20] text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-[#ff6b2f]/20"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Submitting to Meta...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Submit for Approval
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CAMPAIGN WIZARD */}
      {/* ------------------------------------------------------------- */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-white">Create Broadcast Campaign (Step {campaignStep} of 5)</h3>
                <p className="text-xs text-slate-400">
                  {campaignStep === 1 && "Select template and name your campaign"}
                  {campaignStep === 2 && "Choose your target audience segment"}
                  {campaignStep === 3 && "Map personalization variables"}
                  {campaignStep === 4 && "Preview personalized messages"}
                  {campaignStep === 5 && "Confirm scheduling and launch"}
                </p>
              </div>
              <button
                onClick={() => setIsCampaignModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Step 1: Template & Name */}
              {campaignStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Campaign Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Summer Agency Outreach - Batch 1"
                      value={campaignDraft.name}
                      onChange={(e) => setCampaignDraft({ ...campaignDraft, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300">Select Approved Template</label>
                    <select
                      value={campaignDraft.templateId}
                      onChange={(e) => setCampaignDraft({ ...campaignDraft, templateId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:outline-none"
                    >
                      <option value="">-- Choose Approved Template --</option>
                      {templates
                        .filter((t) => t.status === "APPROVED")
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.language}) - {t.category}
                          </option>
                        ))}
                    </select>
                    {templates.filter((t) => t.status === "APPROVED").length === 0 && (
                      <p className="text-[11px] text-amber-400 mt-1">
                        No approved templates found. Submit a template or sync from Meta first.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Audience Selection (Multi-Source Contact Target Selection) */}
              {campaignStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Choose Target Contacts for Bulk Marketing
                    </label>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Select which audience to broadcast to from your Unified Contacts directory (WhatsApp Scanner, Sheets, Excel, Email Enquiries, or Groups).
                    </p>
                  </div>

                  {/* Target by Ingestion Source Channel */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold text-[#ff6b2f] uppercase tracking-wider block">
                      Target by Contact Ingestion Source
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { label: "All Opted-In Contacts", tag: "" },
                        { label: "WhatsApp QR Scanner (Business & Personal)", tag: "WA Business Scanner" },
                        { label: "Google Sheets Sync", tag: "Google Sheets Sync" },
                        { label: "Excel / CSV Import", tag: "Excel / CSV Import" },
                        { label: "Email Enquiries (Gmail / Zoho / GoDaddy)", tag: "Email Enquiry" },
                        { label: "Website Form Leads", tag: "Inbound Form Lead" },
                      ].map((src, sIdx) => (
                        <label
                          key={sIdx}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 cursor-pointer border border-slate-800/60"
                        >
                          <input
                            type="checkbox"
                            checked={src.tag ? campaignDraft.groupIds.includes(`src:${src.tag}`) : campaignDraft.groupIds.length === 0}
                            onChange={(e) => {
                              if (!src.tag) {
                                setCampaignDraft({ ...campaignDraft, groupIds: [] });
                              } else {
                                const key = `src:${src.tag}`;
                                const next = e.target.checked
                                  ? [...campaignDraft.groupIds.filter((g) => !g.startsWith("src:")), key]
                                  : campaignDraft.groupIds.filter((g) => g !== key);
                                setCampaignDraft({ ...campaignDraft, groupIds: next });
                              }
                            }}
                            className="rounded border-slate-700 text-[#ff6b2f] focus:ring-[#ff6b2f]"
                          />
                          <span className="text-xs text-white">{src.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Target by Specific Contact Groups */}
                  {groups.length > 0 && (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                        Or Target by Contact Group / Segment
                      </span>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {groups.map((g) => {
                          const isChecked = campaignDraft.groupIds.includes(g.id);
                          return (
                            <label
                              key={g.id}
                              className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setCampaignDraft({
                                        ...campaignDraft,
                                        groupIds: [...campaignDraft.groupIds, g.id],
                                      });
                                    } else {
                                      setCampaignDraft({
                                        ...campaignDraft,
                                        groupIds: campaignDraft.groupIds.filter((id) => id !== g.id),
                                      });
                                    }
                                  }}
                                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                                />
                                <span className="text-white">{g.name}</span>
                              </div>
                              <span className="text-slate-500">{g.memberCount} members</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400">
                    Total eligible opted-in recipients matching this selection:{" "}
                    <strong className="text-white">
                      {campaignDraft.groupIds.length === 0
                        ? contacts.filter((c) => c.optInStatus === "OPTED_IN").length
                        : contacts.filter((c) => c.optInStatus === "OPTED_IN").length || "Segment Selected"}
                    </strong>
                  </p>
                </div>
              )}

              {/* Step 3: Variable Mapping */}
              {campaignStep === 3 && (
                <div className="space-y-4">
                  <label className="text-xs font-semibold text-slate-300">Map Variables to Contact Fields</label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="font-mono text-emerald-400 text-xs font-bold w-16">{"{{1}}"}</span>
                      <select
                        value={campaignDraft.variableMappings["1"]?.fieldOrValue || "firstName"}
                        onChange={(e) =>
                          setCampaignDraft({
                            ...campaignDraft,
                            variableMappings: {
                              ...campaignDraft.variableMappings,
                              "1": { source: "contact_field", fieldOrValue: e.target.value },
                            },
                          })
                        }
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white flex-1 focus:outline-none"
                      >
                        <option value="firstName">Contact First Name</option>
                        <option value="fullName">Contact Full Name</option>
                        <option value="phone">Contact Phone Number</option>
                        <option value="email">Contact Email</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="font-mono text-emerald-400 text-xs font-bold w-16">{"{{2}}"}</span>
                      <select
                        value={campaignDraft.variableMappings["2"]?.fieldOrValue || "VIP Offer"}
                        onChange={(e) =>
                          setCampaignDraft({
                            ...campaignDraft,
                            variableMappings: {
                              ...campaignDraft.variableMappings,
                              "2": { source: "static", fieldOrValue: e.target.value },
                            },
                          })
                        }
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white flex-1 focus:outline-none"
                      >
                        <option value="Exclusive Access">Exclusive Access</option>
                        <option value="VIP Offer">VIP Offer</option>
                        <option value="20% Discount">20% Discount</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Preview First 20 */}
              {campaignStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Personalized Message Previews (First 20 Recipients)
                    </label>
                    <button
                      onClick={handleLoadCampaignPreview}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh Preview
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
                    {campaignPreviews.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        Click &quot;Refresh Preview&quot; to generate personalized message samples.
                      </div>
                    ) : (
                      campaignPreviews.map((p, idx) => (
                        <div key={idx} className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs space-y-1">
                          <div className="flex justify-between text-slate-400 text-[11px]">
                            <strong className="text-white">{p.name}</strong>
                            <span className="font-mono">{p.phone}</span>
                          </div>
                          <p className="text-slate-300 font-sans whitespace-pre-wrap">{p.messagePreview}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Final Confirmation & Schedule */}
              {campaignStep === 5 && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                    <h4 className="font-bold text-white text-sm">Campaign Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div>Name: <strong className="text-white">{campaignDraft.name}</strong></div>
                      <div>Recipients: <strong className="text-emerald-400">All Opted-In</strong></div>
                      <div>Sender Line: <strong className="text-white">9993328124</strong></div>
                      <div>Throttle: <strong className="text-white">20 msgs / sec</strong></div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300">Schedule (Leave blank to launch immediately)</label>
                    <input
                      type="datetime-local"
                      value={campaignDraft.scheduledAt}
                      onChange={(e) => setCampaignDraft({ ...campaignDraft, scheduledAt: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Navigation Footer */}
            <div className="p-6 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
              <button
                onClick={() => {
                  if (campaignStep > 1) setCampaignStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5);
                  else setIsCampaignModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                {campaignStep === 1 ? "Cancel" : "Back"}
              </button>

              {campaignStep < 5 ? (
                <button
                  onClick={() => {
                    if (campaignStep === 1 && !campaignDraft.templateId) {
                      showToast("Please choose an approved template.", "error");
                      return;
                    }
                    if (campaignStep === 3) {
                      void handleLoadCampaignPreview();
                    }
                    setCampaignStep((prev) => Math.min(5, prev + 1) as 1 | 2 | 3 | 4 | 5);
                  }}
                  className="px-6 py-2.5 bg-[#ff6b2f] hover:bg-[#e85a20] text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-[#ff6b2f]/20"
                >
                  Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleCreateCampaign}
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#ff6b2f] hover:bg-[#e85a20] text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-[#ff6b2f]/20"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Queuing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Launch Campaign
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
