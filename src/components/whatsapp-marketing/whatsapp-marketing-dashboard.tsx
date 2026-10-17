"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { AdminWhatsAppSetupPanel } from "@/components/admin/admin-dummy-controls";
import { aicloserApi } from "@/lib/api-client";

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
  tenantId?: string;
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

type TemplateHeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type TemplateButtonDraft = {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
  example?: string;
};
type TemplateCarouselCardDraft = {
  bodyText: string;
  headerHandle: string;
  exampleValues: Record<string, string>;
  buttons: TemplateButtonDraft[];
};

function extractTemplateVariables(...texts: Array<string | null | undefined>) {
  const variables = new Set<number>();
  for (const text of texts) {
    for (const match of text?.matchAll(/\{\{(\d+)\}\}/g) || []) {
      variables.add(Number(match[1]));
    }
  }
  return [...variables].sort((a, b) => a - b);
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

  // Template State
  const [templates, setTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);
  const templateBuilderRef = useRef<HTMLDivElement>(null);

  // New Template Draft State
  const [templateDraft, setTemplateDraft] = useState({
    name: "",
    language: "en_US",
    category: "MARKETING" as "MARKETING" | "UTILITY" | "AUTHENTICATION",
    templateType: "STANDARD" as "STANDARD" | "CAROUSEL",
    headerType: "NONE" as TemplateHeaderType,
    headerText: "",
    headerHandle: "",
    bodyText: "Hello {{1}}, we have an exclusive update for you! Reply STOP to opt out.",
    footerText: "Reply STOP to unsubscribe",
    exampleValues: { "1": "Ankit" } as Record<string, string>,
    buttons: [] as TemplateButtonDraft[],
    carouselCards: [] as TemplateCarouselCardDraft[],
  });
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [hasSavedTemplateDraft, setHasSavedTemplateDraft] = useState(false);

  // Campaign State
  const [campaigns, setCampaigns] = useState<WhatsAppCampaignItem[]>([]);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [campaignStep, setCampaignStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [campaignAudienceMode, setCampaignAudienceMode] = useState<"all" | "groups">("all");
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
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testTemplateId, setTestTemplateId] = useState("");

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

  const templateDraftStorageKey = channelInfo?.tenantId ? `aicloser.whatsapp.templateDraft:${channelInfo.tenantId}` : null;

  const templateVariables = extractTemplateVariables(
    templateDraft.bodyText,
    templateDraft.headerText,
    ...templateDraft.carouselCards.map((card) => card.bodyText),
    ...templateDraft.buttons.flatMap((button) => [button.url, button.example]),
  );
  const selectedCampaignTemplate = templates.find((template) => template.id === campaignDraft.templateId);
  const campaignVariableNumbers = extractTemplateVariables(selectedCampaignTemplate?.bodyText);

  const showToast = (text: string, type: "success" | "error" | "info" = "info") => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Fetch initial channel info
  const loadChannel = useCallback(async () => {
    try {
      const channels = await aicloserApi.integrations.whatsapp.listChannels() as WhatsAppChannelState[];
      const channel = channels[0] ?? null;
      setChannelInfo({ ok: true, connected: Boolean(channel), requestedPhone: "", tenantId: channel?.tenantId, channel });
    } catch {
      // ignore
    }
  }, []);

  // Fetch templates
  const loadTemplates = useCallback(async () => {
    try {
      const data = await aicloserApi.marketing.getTemplates() as WhatsAppTemplateItem[];
      setTemplates(data || []);
    } catch {
      // ignore
    }
  }, []);

  // Fetch campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      const data = await aicloserApi.marketing.getCampaigns() as WhatsAppCampaignItem[];
      setCampaigns(data || []);
    } catch {
      // ignore
    }
  }, []);

  // Fetch contacts
  const loadContacts = useCallback(async () => {
    try {
      const data = await aicloserApi.marketing.getAllContacts(contactSearch || undefined);
      const mapped = (data.contacts || []).map((contact) => ({
        ...contact,
        phone: String(contact.e164Phone ?? contact.phone ?? ""),
        isBlocked: contact.optInStatus === "OPTED_OUT" || contact.optInStatus === "BLOCKED",
        groups: Array.isArray(contact.groupMemberships)
          ? contact.groupMemberships.map((membership) => ({
              id: String((membership as Record<string, unknown>).groupId ?? ""),
              name: String(((membership as Record<string, unknown>).group as Record<string, unknown> | undefined)?.name ?? ""),
            }))
          : [],
      })) as MarketingContactItem[];
      setContacts(selectedGroupFilter ? mapped.filter((contact) => contact.groups?.some((group) => group.id === selectedGroupFilter)) : mapped);
    } catch (error) {
      setContacts([]);
      setStatusMessage({ text: error instanceof Error ? error.message : "Could not load contacts.", type: "error" });
    }
  }, [contactSearch, selectedGroupFilter]);

  // Fetch groups
  const loadGroups = useCallback(async () => {
    try {
      const data = await aicloserApi.marketing.getGroups() as Array<Record<string, unknown>>;
      setGroups((data || []).map((group) => ({
        ...group,
        memberCount: Number((group._count as Record<string, unknown> | undefined)?.memberships ?? group.memberCount ?? 0),
      })) as ContactGroupItem[]);
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
    if (!templateDraftStorageKey) return;
    try {
      const savedDraft = window.localStorage.getItem(templateDraftStorageKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft) as Partial<typeof templateDraft>;
        setTemplateDraft((current) => ({ ...current, ...parsed }));
        setHasSavedTemplateDraft(true);
      }
    } catch {
      window.localStorage.removeItem(templateDraftStorageKey);
    }
  }, [templateDraftStorageKey]);

  useEffect(() => {
    if (isTemplateModalOpen) {
      window.requestAnimationFrame(() => templateBuilderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [isTemplateModalOpen]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  // Sync templates from Meta
  const handleSyncTemplates = async () => {
    setIsSyncingTemplates(true);
    try {
      await aicloserApi.marketing.syncTemplates();
      showToast("Templates sync completed from Meta.", "success");
      await loadTemplates();
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
      if (templateDraft.templateType === "CAROUSEL") {
        showToast("Carousel templates are not available in the central API contract yet.", "error");
        return;
      }
      const data = await aicloserApi.marketing.createTemplate({
        name: templateDraft.name,
        language: templateDraft.language,
        category: templateDraft.category,
        bodyText: templateDraft.bodyText,
        headerType: templateDraft.headerType,
        headerContent: templateDraft.headerType === "TEXT" ? templateDraft.headerText : templateDraft.headerHandle || undefined,
        footerText: templateDraft.footerText,
        buttons: templateDraft.buttons,
      });
      if (templateDraftStorageKey) window.localStorage.removeItem(templateDraftStorageKey);
      setHasSavedTemplateDraft(false);
      showToast(`Template "${templateDraft.name}" submitted to Meta for approval. Status: ${(data as Record<string, unknown>)?.status || "PENDING"}.`, "success");
      setIsTemplateModalOpen(false);
      await loadTemplates();
    } catch {
      showToast("Network error submitting template.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplateDraft = () => {
    if (!templateDraft.name.trim()) {
      showToast("Add a template name before saving this draft.", "error");
      return;
    }
    if (!templateDraftStorageKey) {
      showToast("Workspace context is still loading. Try Save Draft again in a moment.", "info");
      return;
    }
    window.localStorage.setItem(templateDraftStorageKey, JSON.stringify(templateDraft));
    setHasSavedTemplateDraft(true);
    showToast("Template draft saved. You can reopen it from this account/browser.", "success");
  };

  const handleClearTemplateDraft = () => {
    if (templateDraftStorageKey) window.localStorage.removeItem(templateDraftStorageKey);
    setHasSavedTemplateDraft(false);
    setTemplateDraft({
      name: "",
      language: "en_US",
      category: "MARKETING",
      templateType: "STANDARD",
      headerType: "NONE",
      headerText: "",
      headerHandle: "",
      bodyText: "Hello {{1}}, we have an exclusive update for you! Reply STOP to opt out.",
      footerText: "Reply STOP to unsubscribe",
      exampleValues: { "1": "Ankit" },
      buttons: [],
      carouselCards: [],
    });
    showToast("Saved template draft cleared.", "info");
  };

  // Upload Sample Header Media
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, carouselCardIndex?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const data = await aicloserApi.marketing.uploadTemplateMedia(file) as { mediaHandle?: string };
      const mediaHandle = data?.mediaHandle;
      if (mediaHandle) {
        setTemplateDraft((prev) => {
          if (carouselCardIndex === undefined) return { ...prev, headerHandle: mediaHandle };
          return {
            ...prev,
            carouselCards: prev.carouselCards.map((card, index) =>
              index === carouselCardIndex ? { ...card, headerHandle: mediaHandle } : card,
            ),
          };
        });
        showToast("Header sample media uploaded to Meta successfully.", "success");
      } else {
        showToast("Failed to upload sample media.", "error");
      }
    } catch {
      showToast("Network error uploading media.", "error");
    } finally {
      setUploadingMedia(false);
    }
  };


  // Send Test Message
  const handleSendTestMessage = async (templateId: string) => {
    if (!testPhoneNumber.trim()) {
      showToast("Add one recipient number for the test message. A contact list is not required.", "error");
      return;
    }
    const selectedTemplateId = templateId || testTemplateId;
    if (!selectedTemplateId) {
      showToast("Choose an approved template for the test message.", "error");
      return;
    }
    setIsTestingSend(true);
    try {
      await aicloserApi.marketing.testSend({
        testPhone: testPhoneNumber.trim(),
        templateId: selectedTemplateId,
        channelId: channelInfo?.channel?.id,
      });
      showToast(`Test message sent successfully to ${testPhoneNumber}!`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to send the test message.", "error");
    } finally {
      setIsTestingSend(false);
    }
  };

  // Campaign Actions (Pause, Resume, Cancel, Retry, Dispatch)
  const handleCampaignAction = async (campaignId: string, action: string) => {
    try {
      await aicloserApi.marketing.updateCampaignAction(campaignId, action as "PAUSE" | "RESUME" | "CANCEL" | "RETRY_FAILED");
      showToast(`Campaign action '${action}' completed.`, "success");
      await loadCampaigns();
    } catch {
      showToast("Network error executing campaign action.", "error");
    }
  };

  // Dispatch campaign worker batch
  const handleDispatchBatch = async (campaignId: string) => {
    try {
      await aicloserApi.marketing.dispatchCampaign(campaignId);
      showToast("Campaign dispatched to the delivery queue.", "success");
      await loadCampaigns();
    } catch {
      showToast("Error triggering queue dispatch.", "error");
    }
  };

  // Load Campaign Preview
  const handleLoadCampaignPreview = async () => {
    if (!campaignDraft.templateId) return;
    try {
      const data = await aicloserApi.marketing.previewTemplate(campaignDraft.templateId, {
        groupIds: campaignAudienceMode === "groups" ? campaignDraft.groupIds : undefined,
        variableMappings: campaignDraft.variableMappings,
      }) as { previews?: CampaignPreviewItem[]; renderedBody?: string; samplePhone?: string };
      setCampaignPreviews(
        data.previews?.map((preview) => ({
          ...preview,
          messagePreview: preview.renderedMessage || preview.messagePreview,
        })) || (data.renderedBody ? [{ name: "Template preview", phone: data.samplePhone || "", renderedMessage: data.renderedBody }] : []),
      );
    } catch {
      // ignore
    }
  };

  // Launch Campaign
  const handleCreateCampaign = async () => {
    setLoading(true);
    try {
      const created = await aicloserApi.marketing.createCampaign({
        name: campaignDraft.name,
        templateId: campaignDraft.templateId,
        scheduledAt: campaignDraft.scheduledAt || undefined,
        variableMappings: campaignDraft.variableMappings,
        groupIds: campaignAudienceMode === "groups" ? campaignDraft.groupIds : undefined,
      });
      const campaignId = String((created as { id?: string; campaign?: { id?: string } } | null)?.id || (created as { campaign?: { id?: string } } | null)?.campaign?.id || "");
      if (campaignId) await aicloserApi.marketing.dispatchCampaign(campaignId);
      showToast(`Campaign "${campaignDraft.name}" dispatched to the live WhatsApp queue.`, "success");
      setIsCampaignModalOpen(false);
      setCampaignStep(1);
      await loadCampaigns();
    } catch {
      showToast("Network error creating campaign.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Contact Suppression
  const handleToggleSuppression = async (contactId: string, phone: string, isSuppressed: boolean) => {
    try {
      if (isSuppressed) await aicloserApi.marketing.unsuppressContact(contactId);
      else await aicloserApi.marketing.suppressContact(contactId);
      showToast(`Contact ${phone} ${isSuppressed ? "unblocked" : "suppressed / opted-out"}.`, "success");
      await loadContacts();
    } catch {
      showToast("Network error updating contact status.", "error");
    }
  };

  // Create Contact Group
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await aicloserApi.marketing.createGroup({ name: newGroupName.trim() });
      showToast(`Created contact group "${newGroupName}".`, "success");
      setNewGroupName("");
      await loadGroups();
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
      if (importSource !== "csv") {
        throw new Error("Central API sheet import is handled from Lead Import with server-side Google Sheets access. Use that flow so credentials never enter the browser.");
      }
      const lines = csvInput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("Paste a CSV header and at least one contact row.");
      const headers = lines[0].split(",").map((header) => header.trim().replace(/^"|"$/g, "").toLowerCase());
      const contacts = lines.slice(1).map((line) => {
        const values = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
        const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
        return {
          fullName: String(row.name || row.full_name || row.customer_name || row["full name"] || "Marketing contact"),
          phone: String(row.phone || row.mobile || row.customer_phone || ""),
          email: String(row.email || row.customer_email || "") || undefined,
        };
      }).filter((contact) => contact.phone.length >= 7);
      const data = await aicloserApi.marketing.importContacts(contacts) as any;
      const importedCount = Number(data?.importedCount ?? data?.data?.importedCount ?? 0);
      setImportResult({ totalRows: Math.max(lines.length - 1, 0), validRows: importedCount, invalidRows: Math.max(lines.length - 1 - importedCount, 0), duplicateRows: 0 });
      showToast(`Imported ${importedCount} contacts through the central API.`, "success");
      await loadContacts();
      await loadGroups();
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
              {channelInfo.channel.displayPhoneNumber ? (
                <span className="px-1.5 py-0.5 bg-[#ff6b2f]/20 text-[#ff6b2f] rounded font-semibold text-[10px]">
                  VERIFIED
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
                  onClick={() => {
                    setActiveTab("templates");
                    setIsTemplateModalOpen(true);
                  }}
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
                  onClick={() => setActiveTab("contacts")}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-sm font-medium transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-[#ff6b2f]" /> Choose Contacts &amp; Audiences
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
                      No opted-in marketing contacts found. Add contacts from the separate Lead Import menu, then return here to choose an audience.
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
                          onClick={() => handleToggleSuppression(c.id, c.e164Phone || c.phone, c.optInStatus === "OPTED_OUT")}
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
                  placeholder={`name,phone,email,group,tags\nExample Contact,+<country_code><number>,contact@example.com,Enterprise Leads,hot\nJohn Doe,+<country_code><number>,john@example.com,Inbound Trial,warm`}
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
              Connect this workspace through Meta Embedded Signup. Each tenant keeps its own WhatsApp line, WABA, phone ID, and encrypted token.
            </p>
          </div>

          <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-6">
            {/* Live Verification Status Card */}
            <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase">Target WhatsApp Business Number</span>
                {channelInfo?.matchesRequestedPhone ? (
                  <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> CONNECTED {channelInfo.channel?.displayPhoneNumber || "WHATSAPP LINE"}
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Send a single test</h4>
                  <p className="text-[11px] text-slate-400 mt-1">Enter one number to test a template. This path never asks for a contact list.</p>
                </div>
                <span className="text-[10px] rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-400">Optional</span>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_1.35fr_auto]">
                <select
                  value={testTemplateId}
                  onChange={(e) => setTestTemplateId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="">Choose approved template</option>
                  {templates.filter((template) => template.status === "APPROVED").map((template) => (
                    <option key={template.id} value={template.id}>{template.name} ({template.language})</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Recipient phone number with country code"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white flex-1 focus:outline-none"
                />
                <button
                  onClick={() => handleSendTestMessage(testTemplateId)}
                  disabled={isTestingSend || templates.filter((template) => template.status === "APPROVED").length === 0}
                  className="px-4 py-2 bg-[#ff6b2f] hover:bg-[#e85a20] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Send Test
                </button>
              </div>
            </div>

            {/* Tenant-scoped Meta Embedded Signup. No global phone IDs or client-side tokens. */}
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Connect this workspace via Meta</h4>
                <p className="text-[11px] text-slate-400">
                  Each workspace authorizes its own WhatsApp Business account. Meta returns that workspace&apos;s WABA, phone ID, and token after signup; AI Closer stores them encrypted and uses them only for this tenant.
                </p>
              </div>
              <AdminWhatsAppSetupPanel
                tenantId={channelInfo?.tenantId}
                fallbackPhoneNumber={channelInfo?.channel?.displayPhoneNumber}
                variant="compact"
                settingsHref={null}
              />
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE TEMPLATE BUILDER */}
      {/* ------------------------------------------------------------- */}
      {isTemplateModalOpen && (
        <div ref={templateBuilderRef} className="wa-template-builder mt-6 w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="w-full">
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

                <div>
                  <label className="text-xs font-semibold text-slate-300">Template format</label>
                  <select
                    value={templateDraft.templateType}
                    onChange={(e) => {
                      const templateType = e.target.value as "STANDARD" | "CAROUSEL";
                      setTemplateDraft({
                        ...templateDraft,
                        templateType,
                        carouselCards: templateType === "CAROUSEL" && templateDraft.carouselCards.length < 2
                          ? [
                              ...templateDraft.carouselCards,
                              { bodyText: "", headerHandle: "", exampleValues: {}, buttons: [] },
                              { bodyText: "", headerHandle: "", exampleValues: {}, buttons: [] },
                            ].slice(0, 2)
                          : templateDraft.carouselCards,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white mt-1 focus:outline-none"
                  >
                    <option value="STANDARD">Standard template</option>
                    <option value="CAROUSEL">Carousel template (2–10 cards)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Use standard templates for text, image, video or PDF headers; carousel cards are submitted as Meta carousel components.</p>
                </div>

                {/* Header Type */}
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-semibold text-slate-300">Header format for Meta approval</label>
                    <span className="text-[10px] text-slate-500">Choose one</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Header format">
                    {([
                      ["NONE", "No header", "Text only"],
                      ["TEXT", "Text", "Up to 60 chars"],
                      ["IMAGE", "Image", "JPG / PNG"],
                      ["VIDEO", "Video", "MP4"],
                      ["DOCUMENT", "PDF / Document", "PDF"],
                    ] as const).map(([value, label, helper]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={templateDraft.headerType === value}
                        onClick={() => setTemplateDraft({ ...templateDraft, headerType: value, headerHandle: value === templateDraft.headerType ? templateDraft.headerHandle : "" })}
                        className={`min-h-[58px] rounded-xl border px-2 py-2 text-left transition ${
                          templateDraft.headerType === value
                            ? "border-[#ff6b2f] bg-[#ff6b2f]/15 text-white shadow-sm"
                            : "border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        <span className="block text-[11px] font-semibold leading-tight">{label}</span>
                        <span className="mt-1 block text-[9px] opacity-75">{helper}</span>
                      </button>
                    ))}
                  </div>

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

                  {(["IMAGE", "VIDEO", "DOCUMENT"] as TemplateHeaderType[]).includes(templateDraft.headerType) && (
                    <div className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Sample {templateDraft.headerType === "DOCUMENT" ? "PDF / Document" : templateDraft.headerType.toLowerCase()} header
                        </span>
                        <input
                          type="file"
                          accept={templateDraft.headerType === "IMAGE" ? "image/*" : templateDraft.headerType === "VIDEO" ? "video/*" : "application/pdf,.pdf"}
                          onChange={handleMediaUpload}
                          className="text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                        />
                      </div>
                      <p className="text-[10px] leading-relaxed text-slate-500">
                        Upload a sample file so Meta can review this header format. The file is sent through Meta&apos;s media upload before approval.
                      </p>
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

                {templateDraft.templateType === "CAROUSEL" && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-300">Carousel cards</label>
                        <p className="text-[10px] text-slate-500 mt-1">Each card can use an image header and its own variables.</p>
                      </div>
                      <button
                        type="button"
                        disabled={templateDraft.carouselCards.length >= 10}
                        onClick={() =>
                          setTemplateDraft({
                            ...templateDraft,
                            carouselCards: [...templateDraft.carouselCards, { bodyText: "", headerHandle: "", exampleValues: {}, buttons: [] }],
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-[10px] font-semibold text-emerald-400 hover:border-emerald-500 disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3 inline mr-1" /> Add card
                      </button>
                    </div>
                    {templateDraft.carouselCards.map((card, cardIndex) => {
                      const cardVariables = extractTemplateVariables(card.bodyText);
                      return (
                        <div key={cardIndex} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Card {cardIndex + 1}</span>
                            <button
                              type="button"
                              disabled={templateDraft.carouselCards.length <= 2}
                              onClick={() => setTemplateDraft({ ...templateDraft, carouselCards: templateDraft.carouselCards.filter((_, index) => index !== cardIndex) })}
                              className="text-[10px] text-slate-500 hover:text-red-400 disabled:opacity-30"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400">Image header (optional)</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => void handleMediaUpload(e, cardIndex)}
                              className="max-w-[180px] text-[10px] text-slate-300 file:mr-1 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-slate-300"
                            />
                          </div>
                          {card.headerHandle && <p className="text-[10px] text-emerald-400">Media uploaded for this card.</p>}
                          <textarea
                            rows={2}
                            value={card.bodyText}
                            placeholder="Card text, e.g. Explore {{1}}"
                            onChange={(e) => {
                              const carouselCards = [...templateDraft.carouselCards];
                              carouselCards[cardIndex] = { ...card, bodyText: e.target.value };
                              setTemplateDraft({ ...templateDraft, carouselCards });
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px] text-white focus:outline-none font-mono"
                          />
                          {cardVariables.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {cardVariables.map((variableNumber) => (
                                <input
                                  key={variableNumber}
                                  placeholder={`Card {{${variableNumber}}} sample`}
                                  value={card.exampleValues[String(variableNumber)] || ""}
                                  onChange={(e) => {
                                    const carouselCards = [...templateDraft.carouselCards];
                                    carouselCards[cardIndex] = {
                                      ...card,
                                      exampleValues: { ...card.exampleValues, [String(variableNumber)]: e.target.value },
                                    };
                                    setTemplateDraft({ ...templateDraft, carouselCards });
                                  }}
                                  className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px] text-white focus:outline-none"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Sample Values for Variables */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-semibold text-slate-300">Sample Variable Values</label>
                    <span className="text-[10px] text-slate-500">{templateVariables.length} detected</span>
                  </div>
                  {templateVariables.length === 0 ? (
                    <p className="text-[11px] text-slate-500">Add {"{{1}}"}, {"{{2}}"}, etc. to the body to generate review fields here.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {templateVariables.map((variableNumber) => (
                        <label key={variableNumber} className="space-y-1">
                          <span className="text-[10px] font-mono text-emerald-400">{"{{"}{variableNumber}{"}}"}</span>
                          <input
                            type="text"
                            placeholder={"Sample value for {{" + variableNumber + "}}"}
                            value={templateDraft.exampleValues[String(variableNumber)] || ""}
                            onChange={(e) =>
                              setTemplateDraft({
                                ...templateDraft,
                                exampleValues: { ...templateDraft.exampleValues, [String(variableNumber)]: e.target.value },
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                          />
                        </label>
                      ))}
                    </div>
                  )}
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

                {/* Buttons */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300">Buttons (Optional)</label>
                      <p className="text-[10px] text-slate-500 mt-1">Quick replies, URL and phone buttons supported by Meta.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateDraft({
                          ...templateDraft,
                          buttons: [...templateDraft.buttons, { type: "QUICK_REPLY", text: "" }],
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-[10px] font-semibold text-emerald-400 hover:border-emerald-500"
                    >
                      <Plus className="w-3 h-3 inline mr-1" /> Add button
                    </button>
                  </div>
                  {templateDraft.buttons.map((button, buttonIndex) => (
                    <div key={buttonIndex} className="grid grid-cols-[110px_1fr_auto] gap-2 items-start">
                      <select
                        value={button.type}
                        onChange={(e) => {
                          const buttons = [...templateDraft.buttons];
                          buttons[buttonIndex] = { ...button, type: e.target.value as TemplateButtonDraft["type"] };
                          setTemplateDraft({ ...templateDraft, buttons });
                        }}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-white focus:outline-none"
                      >
                        <option value="QUICK_REPLY">Quick reply</option>
                        <option value="URL">URL</option>
                        <option value="PHONE_NUMBER">Phone</option>
                      </select>
                      <div className="space-y-2">
                        <input
                          value={button.text}
                          maxLength={25}
                          placeholder="Button label"
                          onChange={(e) => {
                            const buttons = [...templateDraft.buttons];
                            buttons[buttonIndex] = { ...button, text: e.target.value };
                            setTemplateDraft({ ...templateDraft, buttons });
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-white focus:outline-none"
                        />
                        {button.type === "URL" && (
                          <>
                            <input
                              value={button.url || ""}
                              placeholder="https://example.com/{{1}}"
                              onChange={(e) => {
                                const buttons = [...templateDraft.buttons];
                                buttons[buttonIndex] = { ...button, url: e.target.value };
                                setTemplateDraft({ ...templateDraft, buttons });
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-white focus:outline-none"
                            />
                            {button.url?.includes("{{") && (
                              <input
                                value={button.example || ""}
                                placeholder="Sample URL variable"
                                onChange={(e) => {
                                  const buttons = [...templateDraft.buttons];
                                  buttons[buttonIndex] = { ...button, example: e.target.value };
                                  setTemplateDraft({ ...templateDraft, buttons });
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-white focus:outline-none"
                              />
                            )}
                          </>
                        )}
                        {button.type === "PHONE_NUMBER" && (
                          <input
                            value={button.phone_number || ""}
                            placeholder="+919876543210"
                            onChange={(e) => {
                              const buttons = [...templateDraft.buttons];
                              buttons[buttonIndex] = { ...button, phone_number: e.target.value };
                              setTemplateDraft({ ...templateDraft, buttons });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-white focus:outline-none"
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTemplateDraft({ ...templateDraft, buttons: templateDraft.buttons.filter((_, index) => index !== buttonIndex) })}
                        className="p-2 text-slate-500 hover:text-red-400"
                        aria-label={`Remove button ${buttonIndex + 1}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Mobile Mockup Preview */}
              <div className="flex min-h-[620px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 p-5 sm:p-6">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Live WhatsApp Preview
                </span>

                <div className="relative flex w-full max-w-[318px] min-h-[520px] aspect-[9/19] flex-col overflow-hidden rounded-[3rem] border-[8px] border-slate-800 bg-[#0b141a] p-4 shadow-2xl sm:min-h-[590px] sm:p-5">
                  {/* Phone Notch */}
                  <div className="mx-auto mb-5 h-5 w-28 shrink-0 rounded-b-2xl bg-slate-800" />

                  {/* WhatsApp Chat Bubble */}
                  <div className="rounded-2xl rounded-tl-sm bg-[#005c4b] p-4 text-sm text-slate-100 shadow sm:p-5">
                    {templateDraft.headerType === "TEXT" && templateDraft.headerText && (
                      <div className="border-b border-emerald-600/50 pb-2 text-sm font-bold text-white">
                        {templateDraft.headerText}
                      </div>
                    )}

                    {(["IMAGE", "VIDEO", "DOCUMENT"] as TemplateHeaderType[]).includes(templateDraft.headerType) && (
                      <div className="flex h-36 w-full items-center justify-center rounded-xl border border-emerald-600/40 bg-emerald-900/50 text-xs text-emerald-300">
                        [{templateDraft.headerType} Header Preview]
                      </div>
                    )}

                    <div className="font-sans leading-relaxed text-slate-100">
                      {templateVariables.reduce(
                        (preview, variableNumber) =>
                          preview.replaceAll(`{{${variableNumber}}}`, templateDraft.exampleValues[String(variableNumber)] || `{{${variableNumber}}}`),
                        templateDraft.bodyText,
                      )}
                    </div>

                    {templateDraft.footerText && (
                      <div className="border-t border-emerald-600/30 pt-2 text-xs text-slate-300/80">
                        {templateDraft.footerText}
                      </div>
                    )}

                    {templateDraft.buttons.length > 0 && (
                      <div className="space-y-1.5 border-t border-emerald-600/30 pt-2">
                        {templateDraft.buttons.map((button, index) => (
                          <div key={index} className="rounded-md border border-emerald-500/30 py-1.5 text-center text-xs font-semibold text-emerald-200">
                            {button.text || `Button ${index + 1}`}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-300/60">
                      <span>10:30 AM</span>
                      <CheckCheck size={11} className="text-emerald-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
              <div className="flex items-center gap-2">
                {hasSavedTemplateDraft ? (
                  <button
                    onClick={handleClearTemplateDraft}
                    className="px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-300"
                  >
                    Clear saved draft
                  </button>
                ) : null}
                <button
                  onClick={handleSaveTemplateDraft}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 hover:border-[#ff6b2f] hover:text-white"
                >
                  Save Draft
                </button>
              </div>
              <div className="flex items-center justify-end gap-3">
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
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CAMPAIGN WIZARD */}
      {/* ------------------------------------------------------------- */}
      {isCampaignModalOpen && (
        <div className="whatsapp-campaign-wizard mt-6 w-full">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-white">Create broadcast campaign</h3>
                <p className="text-xs text-slate-400">
                  {campaignStep === 1 && "Select template and name your campaign"}
                  {campaignStep === 2 && "Choose all opted-in contacts or saved groups"}
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

            <div className="grid grid-cols-5 gap-2 border-b border-slate-800 bg-slate-950/40 px-6 py-3">
              {["Setup", "Audience", "Personalize", "Preview", "Launch"].map((label, index) => {
                const step = index + 1;
                return (
                  <div key={label} className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide ${campaignStep >= step ? "text-[#ff6b2f]" : "text-slate-500"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${campaignStep >= step ? "border-[#ff6b2f] bg-[#ff6b2f]/15" : "border-slate-700"}`}>{step}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                );
              })}
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
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Choose your audience</label>
                    <p className="text-[11px] text-slate-400">A bulk campaign sends only to opted-in, non-blocked marketing contacts. Choose one audience source below.</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCampaignAudienceMode("all");
                        setCampaignDraft((current) => ({ ...current, groupIds: [] }));
                      }}
                      className={`text-left rounded-xl border p-4 transition ${campaignAudienceMode === "all" ? "border-[#ff6b2f] bg-[#ff6b2f]/10" : "border-slate-800 bg-slate-950 hover:border-slate-700"}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">All opted-in contacts</span>
                        <span className={`h-4 w-4 rounded-full border-2 ${campaignAudienceMode === "all" ? "border-[#ff6b2f] bg-[#ff6b2f]" : "border-slate-600"}`} />
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-400">Use the complete eligible audience from this workspace.</span>
                      <span className="mt-3 block text-xs font-semibold text-emerald-400">{contacts.filter((c) => c.optInStatus === "OPTED_IN").length} eligible contacts</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCampaignAudienceMode("groups")}
                      className={`text-left rounded-xl border p-4 transition ${campaignAudienceMode === "groups" ? "border-[#ff6b2f] bg-[#ff6b2f]/10" : "border-slate-800 bg-slate-950 hover:border-slate-700"}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">Contact groups</span>
                        <span className={`h-4 w-4 rounded-full border-2 ${campaignAudienceMode === "groups" ? "border-[#ff6b2f] bg-[#ff6b2f]" : "border-slate-600"}`} />
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-400">Send to one or more saved groups only.</span>
                      <span className="mt-3 block text-xs font-semibold text-slate-300">{groups.length} groups available</span>
                    </button>
                  </div>

                  {campaignAudienceMode === "groups" && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff6b2f]">Select groups</span>
                      {groups.length === 0 ? (
                        <p className="text-xs text-slate-400">No groups yet. Create one in Contacts &amp; Audiences or switch to all opted-in contacts.</p>
                      ) : (
                        <div className="max-h-40 space-y-1.5 overflow-y-auto">
                          {groups.map((group) => {
                            const isChecked = campaignDraft.groupIds.includes(group.id);
                            return (
                              <label key={group.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-800/70 p-2 text-xs hover:bg-slate-900">
                                <span className="flex items-center gap-2 text-white">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(event) => setCampaignDraft((current) => ({
                                      ...current,
                                      groupIds: event.target.checked
                                        ? [...current.groupIds, group.id]
                                        : current.groupIds.filter((id) => id !== group.id),
                                    }))}
                                    className="rounded border-slate-700 text-[#ff6b2f] focus:ring-[#ff6b2f]"
                                  />
                                  {group.name}
                                </span>
                                <span className="text-slate-500">{group.memberCount ?? group.contactCount ?? 0} members</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[11px] text-slate-400">One phone number only? Use the optional single test flow—bulk audience selection will not be required.</p>
                    <button type="button" onClick={() => { setIsCampaignModalOpen(false); setActiveTab("settings"); }} className="text-xs font-semibold text-[#ff6b2f] hover:text-[#ff8552]">Go to single test</button>
                  </div>
                </div>
              )}

              {/* Step 3: Variable Mapping */}
              {campaignStep === 3 && (
                <div className="space-y-4">
                  <label className="text-xs font-semibold text-slate-300">Map Variables to Contact Fields</label>
                  {campaignVariableNumbers.length === 0 ? (
                    <p className="p-3 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-500">
                      The selected template has no variables to map.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {campaignVariableNumbers.map((variableNumber) => {
                        const mapping = campaignDraft.variableMappings[String(variableNumber)] || { source: "contact_field" as const, fieldOrValue: "firstName" };
                        const selectedValue = mapping.source === "static" ? `static:${mapping.fieldOrValue}` : mapping.fieldOrValue;
                        return (
                          <div key={variableNumber} className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="font-mono text-emerald-400 text-xs font-bold w-16">{"{{"}{variableNumber}{"}}"}</span>
                            <select
                              value={selectedValue}
                              onChange={(e) => {
                                const value = e.target.value;
                                const isStatic = value.startsWith("static:");
                                setCampaignDraft({
                                  ...campaignDraft,
                                  variableMappings: {
                                    ...campaignDraft.variableMappings,
                                    [String(variableNumber)]: {
                                      source: isStatic ? "static" : "contact_field",
                                      fieldOrValue: isStatic ? value.slice(7) : value,
                                    },
                                  },
                                });
                              }}
                              className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white flex-1 focus:outline-none"
                            >
                              <option value="firstName">Contact First Name</option>
                              <option value="fullName">Contact Full Name</option>
                              <option value="phone">Contact Phone Number</option>
                              <option value="email">Contact Email</option>
                              <option value="static:Exclusive Access">Static: Exclusive Access</option>
                              <option value="static:VIP Offer">Static: VIP Offer</option>
                              <option value="static:20% Discount">Static: 20% Discount</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                      <div>Recipients: <strong className="text-emerald-400">{campaignAudienceMode === "all" ? "All opted-in contacts" : `${campaignDraft.groupIds.length} selected group${campaignDraft.groupIds.length === 1 ? "" : "s"}`}</strong></div>
                      <div>Sender Line: <strong className="text-white">{channelInfo?.channel?.displayPhoneNumber || "Not connected"}</strong></div>
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
