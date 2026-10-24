"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CURRENT_USER, useApp } from "@/lib/store";
import { STAGES, type StageId, type Priority, stageMeta, PRIORITY_LABEL } from "@/lib/types";
import { aicloserApi } from "@/lib/api-client";
import { isScannedWhatsAppLead } from "@/lib/lead-mapper";
import { LeadCommandHistory } from "@/components/pipeline/LeadCommandHistory";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ResizeHandle } from "@/components/ui/ResizeHandle";

interface ChatMessage {
  id: string;
  sender: "customer" | "closer" | "system";
  senderName?: string;
  text: string;
  time: string;
  createdAt?: string;
  channel?: "whatsapp" | "instagram" | "website";
  status?: "sent" | "delivered" | "read";
  externalMessageId?: string;
}

interface ConversationItem {
  id: string;
  leadId: string;
  customerName: string;
  company: string;
  phone: string;
  channel: "whatsapp" | "instagram" | "website";
  channelSource?: "OFFICIAL_API" | "QR_SCANNER" | "INSTAGRAM" | "WEBSITE";
  channelSourceLabel?: string;
  scannedByName?: string | null;
  isOfficialApi?: boolean;
  isPersonalQr?: boolean;
  isReassignable?: boolean;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageAt?: string;
  updatedAt?: string;
  unreadCount: number;
  assignedTo: string;
  slaMinutesRemaining?: number;
  aiAutoReplyDisabled?: boolean;
  notes?: string;
  messages: ChatMessage[];
  payload?: any;
  sharedUserIds?: string[];
  shares?: any[];
  isSharedWithMe?: boolean;
  assignedFreelancerId?: string | null;
  assignedFreelancerName?: string | null;
  isDraft?: boolean;
  is24HourWindowOpen?: boolean;
  lastInboundAt?: string | null;
  windowExpiresAt?: string | null;
}


function formatMessageTime(dateString?: string | null): string {
  if (!dateString) return "Recent";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(dateString);
  }
}

function playNotificationChime() {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio("/sounds/chat-notification.mp3");
    audio.volume = 0.6;
    audio.play().catch(() => {
      // AudioContext fallback for instant synthesized chime
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } catch {}
    });
  } catch {}
}

function getMessageDateKey(dateString?: string): string {
  if (!dateString) return "Today";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Today";
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "Today";
  }
}

function getConversationTimestamp(c: ConversationItem): number {
  if (c.messages && c.messages.length > 0) {
    const lastMsg = c.messages[c.messages.length - 1];
    if (lastMsg?.createdAt) {
      const t = new Date(lastMsg.createdAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
  }
  if (c.lastMessageAt) {
    const t = new Date(c.lastMessageAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (c.updatedAt) {
    const t = new Date(c.updatedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

/**
 * Linkification helper: Parses text and converts URLs into clickable, copyable anchor tags.
 * Preserves normal text spans so full selection & copy works seamlessly.
 */
function renderMessageContent(text: string, isCloser: boolean) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(/^(https?:\/\/|www\.)/i)) {
      const href = part.toLowerCase().startsWith("www.") ? `https://${part}` : part;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-bubble-link"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function ChatView() {
  const { state, moveLead, updateLead, reassignLead, setScope, deleteLead } = useApp();

  // Channel filter: all, whatsapp, instagram, website
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine" | "api" | "unassigned">("all");
  const [search, setSearch] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Inbox Header Filters (Status/Stage, Priority, Callback/SLA, Workspace Labels)
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [callbackFilter, setCallbackFilter] = useState<string>("all");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [workspaceLabels, setWorkspaceLabels] = useState<Array<{ id: string; name: string; color?: string }>>([]);

  // Multi-Selection & Bulk Delete state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Per-chat action menu state
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [menuSubView, setMenuSubView] = useState<"root" | "stage" | "priority" | "label">("root");
  const [singleDeleteChat, setSingleDeleteChat] = useState<ConversationItem | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [callbackModalChat, setCallbackModalChat] = useState<ConversationItem | null>(null);
  const [callbackDateTime, setCallbackDateTime] = useState<string>("");
  const [callbackNote, setCallbackNote] = useState<string>("");
  const [schedulingCallback, setSchedulingCallback] = useState(false);

  // Closer WhatsApp QR Linking Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrPairingMethod, setQrPairingMethod] = useState<"qr" | "code">("qr");
  const [qrSessionId, setQrSessionId] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [qrPairingCode, setQrPairingCode] = useState("");
  const [qrPhoneInput, setQrPhoneInput] = useState("");
  const [waDeviceStatus, setWaDeviceStatus] = useState<string>("DISCONNECTED");
  const [connectedPhone, setConnectedPhone] = useState<string>("");
  const [hasConnectedCompanion, setHasConnectedCompanion] = useState<boolean | null>(null);
  const [userCompanionPhone, setUserCompanionPhone] = useState<string>("");
  const [checkingCompanion, setCheckingCompanion] = useState<boolean>(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [qrSuccess, setQrSuccess] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [selectedDispatchChannel, setSelectedDispatchChannel] = useState<"AUTO" | "OFFICIAL_API" | "PERSONAL">("AUTO");
  const urlResolvedRef = useRef<boolean>(false);

  // Check personal companion WhatsApp connection for current user
  const checkCompanionConnection = useCallback(async () => {
    try {
      setCheckingCompanion(true);
      const myUserId = (state.user as any)?.userId || (state.user as any)?.id;

      // 1. Check live Baileys daemon status
      const statusRes = await aicloserApi.integrations.whatsapp.devices.getStatus().catch(() => null);
      const isDaemonConnected = statusRes?.status === "CONNECTED" && Boolean(statusRes.connectedPhone);

      // 2. Check registered devices list
      const res: any = await aicloserApi.integrations.whatsapp.devices.list().catch(() => null);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

      // A user ONLY has a connected personal companion if:
      // - The daemon is live CONNECTED
      // - AND the device was scanned by THIS specific user (d.scannedByUserId === myUserId)
      const userDevice = list.find((d: any) =>
        d.status === "connected" && d.scannedByUserId && d.scannedByUserId === myUserId
      );

      if (isDaemonConnected && userDevice) {
        setHasConnectedCompanion(true);
        setUserCompanionPhone(userDevice.phoneNumber || statusRes.connectedPhone || "");
        setWaDeviceStatus("CONNECTED");
        setConnectedPhone(userDevice.phoneNumber || statusRes.connectedPhone || "");
      } else {
        setHasConnectedCompanion(false);
        setUserCompanionPhone("");
        setWaDeviceStatus(statusRes?.status || "DISCONNECTED");
        if (statusRes?.qrCodeDataUrl) {
          setQrCodeDataUrl(statusRes.qrCodeDataUrl);
        }
      }
    } catch {
      setHasConnectedCompanion(false);
    } finally {
      setCheckingCompanion(false);
    }
  }, [state.user]);

  useEffect(() => {
    checkCompanionConnection();
  }, [checkCompanionConnection]);

  // Virtual Draft Conversation (Prevents blank/ghost conversations in DB until first message)
  const [draftChat, setDraftChat] = useState<ConversationItem | null>(null);

  // Meta 24-Hour WhatsApp Template Selection Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);

  const handleOpenQrModal = async () => {
    setShowQrModal(true);
    setQrError(null);
    setQrSuccess(null);
    setQrLoading(true);
    try {
      const closerName = state.user?.displayName || CURRENT_USER;
      // First check if already connected
      const statusRes = await aicloserApi.integrations.whatsapp.devices.getStatus().catch(() => null);
      if (statusRes?.status === "CONNECTED" && statusRes.connectedPhone) {
        setWaDeviceStatus("CONNECTED");
        setConnectedPhone(statusRes.connectedPhone);
        setHasConnectedCompanion(true);
        setUserCompanionPhone(statusRes.connectedPhone);
        setQrLoading(false);
        return;
      }

      // Initiate/fetch QR pairing session
      const res = await aicloserApi.integrations.whatsapp.devices.startPairing({
        name: `${closerName} Personal Line`,
      }).catch(() => null);

      if (res) {
        setQrSessionId(res.sessionId || `wa_${Date.now()}`);
        if (res.qrCodeDataUrl) setQrCodeDataUrl(res.qrCodeDataUrl);
        if (res.pairingCode) setQrPairingCode(res.pairingCode);
        if (res.status) setWaDeviceStatus(res.status);
        if (res.connectedPhone) setConnectedPhone(res.connectedPhone);
      } else {
        setQrSessionId(`wa_${Date.now()}`);
      }
    } catch {
      setQrSessionId(`wa_${Date.now()}`);
    } finally {
      setQrLoading(false);
    }
  };

  const handleRefreshQr = async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const closerName = state.user?.displayName || CURRENT_USER;
      const res = await aicloserApi.integrations.whatsapp.devices.startPairing({
        name: `${closerName} Personal Line`,
        forceRefresh: true,
      });
      if (res?.qrCodeDataUrl) {
        setQrCodeDataUrl(res.qrCodeDataUrl);
      }
      if (res?.status) setWaDeviceStatus(res.status);
    } catch (err: any) {
      setQrError(err?.message || "Failed to refresh QR code.");
    } finally {
      setQrLoading(false);
    }
  };

  const handleRequestPairingCode = async () => {
    const clean = qrPhoneInput.replace(/\D/g, "");
    if (!clean || clean.length < 8) {
      setQrError("Please enter your WhatsApp phone number with country code (e.g. +91 98765 43210)");
      return;
    }
    setIsRequestingCode(true);
    setQrError(null);
    try {
      const res = await aicloserApi.integrations.whatsapp.devices.requestPairingCode(clean);
      if (res?.pairingCode) {
        setQrPairingCode(res.pairingCode);
        setQrSuccess("Pairing code generated! Enter this code in WhatsApp on your phone.");
        setTimeout(() => setQrSuccess(null), 5000);
      }
    } catch (err: any) {
      setQrError(err?.message || "Failed to generate pairing code. Please try again.");
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleDisconnectLine = async () => {
    if (!window.confirm("Are you sure you want to disconnect this WhatsApp line?")) return;
    setQrLoading(true);
    try {
      await aicloserApi.integrations.whatsapp.devices.disconnectDaemon();
      setWaDeviceStatus("DISCONNECTED");
      setConnectedPhone("");
      setHasConnectedCompanion(false);
      setUserCompanionPhone("");
      setQrCodeDataUrl("");
      setQrPairingCode("");
      setQrSuccess("WhatsApp line disconnected successfully.");
      setTimeout(() => setQrSuccess(null), 3000);
      handleRefreshQr();
    } catch (err: any) {
      setQrError(err?.message || "Failed to disconnect.");
    } finally {
      setQrLoading(false);
    }
  };

  const handleSyncLiveChats = async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await aicloserApi.integrations.whatsapp.devices.syncLive();
      setQrSuccess(`Synced ${res?.syncedCount || 0} chats into your inbox!`);
      setRefreshCount((c) => c + 1);
      setTimeout(() => setQrSuccess(null), 3000);
    } catch (err: any) {
      setQrError(err?.message || "Failed to sync chats.");
    } finally {
      setQrLoading(false);
    }
  };

  // Auto-polling for WhatsApp scan status while modal is open
  useEffect(() => {
    if (!showQrModal) return;
    let cancelled = false;

    const interval = setInterval(async () => {
      try {
        const res = await aicloserApi.integrations.whatsapp.devices.getStatus();
        if (cancelled || !res) return;

        if (res.qrCodeDataUrl && res.qrCodeDataUrl !== qrCodeDataUrl) {
          setQrCodeDataUrl(res.qrCodeDataUrl);
        }
        if (res.status) {
          setWaDeviceStatus(res.status);
        }
        if (res.connectedPhone) {
          setConnectedPhone(res.connectedPhone);
        }
        if (res.status === "CONNECTED") {
          setHasConnectedCompanion(true);
          setUserCompanionPhone(res.connectedPhone || "");
          setQrSuccess(`WhatsApp Connected (${res.connectedPhone || "Line"})! Syncing chats...`);
          aicloserApi.integrations.whatsapp.devices.syncLive().catch(() => {});
          setRefreshCount((c) => c + 1);
          setTimeout(() => {
            if (!cancelled) {
              setShowQrModal(false);
              setQrSuccess(null);
            }
          }, 2000);
        }
      } catch {}
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [showQrModal, qrCodeDataUrl]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const urlChannel = sp.get("channel");
      if (urlChannel === "api") {
        setScopeFilter("api");
        setSelectedDispatchChannel("OFFICIAL_API");
      } else if (urlChannel === "mine") {
        setScopeFilter("mine");
        setSelectedDispatchChannel("PERSONAL");
      }
      const urlId = sp.get("id") || sp.get("chatId");
      if (urlId) setSelectedChatId(urlId);
    }
  }, []);

  // Automatically open QR modal when user navigates to Personal WhatsApp channel but has not connected their device
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const urlChannel = sp.get("channel");
      if (urlChannel === "mine" && hasConnectedCompanion === false && !checkingCompanion) {
        handleOpenQrModal();
      }
    }
  }, [hasConnectedCompanion, checkingCompanion]);

  // When admin selects a closer from the header dropdown, automatically activate that closer's chats tab
  useEffect(() => {
    if (state.scope.startsWith("agent:")) {
      setScopeFilter("mine");
    }
  }, [state.scope]);
  const [inputText, setInputText] = useState("");
  const [showRightDrawer, setShowRightDrawer] = useState(true);

  // Lazy Notification Permission State (ITEM-51)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    return typeof Notification !== "undefined" ? Notification.permission : "default";
  });
  const handleRequestNotifPermission = async () => {
    if (typeof Notification !== "undefined") {
      try {
        const res = await Notification.requestPermission();
        setNotifPermission(res);
      } catch {}
    }
  };

  // Adjustable panel widths with localStorage persistence
  const [inboxWidth, setInboxWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aicloser_chat_inbox_width");
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 460) return parsed;
      }
    }
    return 320;
  });

  const handleSetInboxWidth = useCallback((w: number) => {
    const clamped = Math.max(260, Math.min(460, w));
    setInboxWidth(clamped);
    if (typeof window !== "undefined") {
      localStorage.setItem("aicloser_chat_inbox_width", String(clamped));
    }
  }, []);

  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aicloser_chat_drawer_width");
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 560) return parsed;
      }
    }
    return 320;
  });

  const handleSetDrawerWidth = useCallback((w: number) => {
    const clamped = Math.max(260, Math.min(560, w));
    setDrawerWidth(clamped);
    if (typeof window !== "undefined") {
      localStorage.setItem("aicloser_chat_drawer_width", String(clamped));
    }
  }, []);
  const [aiAutoReply, setAiAutoReply] = useState(true);
  const [universalAiEnabled, setUniversalAiEnabled] = useState<boolean | null>(null);
  const [togglingAiReply, setTogglingAiReply] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<"history" | "note" | "callback" | "calls">("history");
  const [leadPayment, setLeadPayment] = useState<any>(null);
  const [leadPaymentSecondsLeft, setLeadPaymentSecondsLeft] = useState<number | null>(null);

  // Payment amount editing & quick-creation states
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentTitle, setNewPaymentTitle] = useState("CRM Setup & Consultation");
  const [newPaymentExpiry, setNewPaymentExpiry] = useState<number>(30);
  const [creatingPayment, setCreatingPayment] = useState(false);

  // Copyability & clipboard feedback states
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedContact, setCopiedContact] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  }, []);

  const handleCopyMessage = useCallback(async (msgId: string, text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== "undefined") {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedMessageId(msgId);
      showToast("Message copied to clipboard");
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error("Failed to copy message", err);
    }
  }, [showToast]);

  const handleCopyContact = useCallback(async (key: string, value: string, label: string) => {
    if (!value) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (typeof document !== "undefined") {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedContact(key);
      showToast(`${label} copied to clipboard`);
      setTimeout(() => setCopiedContact(null), 2000);
    } catch (err) {
      console.error("Failed to copy contact info", err);
    }
  }, [showToast]);

  const [chatStage, setChatStage] = useState<StageId>("new");

  // In-memory cache of messages by conversation ID for zero-lag instant tab switching
  const [messagesCache, setMessagesCache] = useState<Record<string, ChatMessage[]>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior });
      } else if (messageContainerRef.current) {
        messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
      }
    });
  }, []);

  // Conversations loaded from live API
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  const activeChat = useMemo(() => {
    if (draftChat && (!selectedChatId || selectedChatId === draftChat.id)) {
      return draftChat;
    }
    if (!conversations.length) return draftChat || null;
    const match = conversations.find((c) => c.id === selectedChatId);
    if (match) return match;
    if (draftChat && selectedChatId === draftChat.id) return draftChat;
    // Check if ID changed between lead- and conv- by phone digits
    if (selectedChatId) {
      const targetPhone = selectedChatId.replace(/\D/g, "").slice(-10);
      if (targetPhone.length >= 10) {
        const phoneMatch = conversations.find((c) => c.phone && c.phone.replace(/\D/g, "").slice(-10) === targetPhone);
        if (phoneMatch) return phoneMatch;
      }
    }
    return draftChat || conversations[0] || null;
  }, [conversations, selectedChatId, draftChat]);

  const isOfficialChat = Boolean(
    activeChat &&
      activeChat.channel === "whatsapp" &&
      (selectedDispatchChannel === "OFFICIAL_API" ||
        (selectedDispatchChannel !== "PERSONAL" &&
          (activeChat.isOfficialApi || activeChat.channelSource === "OFFICIAL_API")))
  );

  const isPersonalChat = Boolean(
    activeChat &&
      (activeChat.isPersonalQr ||
        activeChat.channelSource === "QR_SCANNER" ||
        (activeChat as any).serviceSlug === "manual-chat" ||
        scopeFilter === "mine" ||
        selectedDispatchChannel === "PERSONAL")
  );

  const isPersonalDispatch =
    selectedDispatchChannel === "PERSONAL" ||
    (selectedDispatchChannel === "AUTO" && isPersonalChat);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res: any = await aicloserApi.marketing.getTemplates();
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.templates)
        ? res.templates
        : Array.isArray(res?.data)
        ? res.data
        : [];
      const mapped = list.map((t: any, idx: number) => ({
        id: t.id || `tmpl-${idx}`,
        name: t.name || t.templateName || "template",
        category: t.category || "UTILITY",
        language: t.language || "en_US",
        status: t.status || "APPROVED",
        bodyText: t.bodyText || t.body || t.components?.find((c: any) => c.type === "BODY")?.text || "",
      }));
      setTemplates(mapped);
      if (mapped.length > 0 && !selectedTemplate) {
        setSelectedTemplate(mapped[0]);
      }
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [selectedTemplate]);

  const handleSendTemplate = async () => {
    if (!selectedTemplate || !activeChat || isSendingTemplate) return;
    setIsSendingTemplate(true);
    try {
      let targetConvId = activeChat.id;

      // 1. If currently in DRAFT mode, create conversation in database first!
      if (activeChat.isDraft) {
        const createRes = await aicloserApi.conversations.getOrCreate({
          leadId: activeChat.leadId || undefined,
          customerPhone: activeChat.phone,
          customerName: activeChat.customerName || undefined,
          channelSource: "OFFICIAL_API",
        });
        const createdConv = (createRes as any)?.data?.conversation || (createRes as any)?.conversation;
        if (!createdConv?.id) {
          throw new Error("Failed to initialize conversation for template dispatch.");
        }
        targetConvId = createdConv.id;
        setDraftChat(null);
        setSelectedChatId(targetConvId);
      }

      // 2. Dispatch template via API
      const res: any = await aicloserApi.conversations.sendMessage(
        targetConvId,
        selectedTemplate.bodyText || `[Template: ${selectedTemplate.name}]`,
        undefined,
        "OFFICIAL_API",
        {
          templateName: selectedTemplate.name,
          templateLanguage: selectedTemplate.language || "en_US",
        }
      );

      const newMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: "closer",
        senderName: state.user?.displayName || CURRENT_USER,
        text: selectedTemplate.bodyText || `[Template: ${selectedTemplate.name}]`,
        createdAt: new Date().toISOString(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        channel: "whatsapp",
        status: "sent",
        externalMessageId: res?.data?.externalMessageId || res?.externalMessageId,
      };

      setMessagesCache((prev) => ({
        ...prev,
        [targetConvId]: [...(prev[targetConvId] || []), newMsg],
      }));

      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConvId
            ? {
                ...c,
                messages: [...(c.messages || []), newMsg],
                lastMessage: newMsg.text,
                lastMessageTime: "Just now",
                isDraft: false,
              }
            : c
        )
      );

      setShowTemplateModal(false);
      showToast(`Template "${selectedTemplate.name}" sent to customer!`);
      setTimeout(() => scrollToBottom("smooth"), 50);
      setRefreshCount((rc) => rc + 1);
    } catch (err: any) {
      showToast(err?.message || "Failed to send template");
    } finally {
      setIsSendingTemplate(false);
    }
  };

  const activeLead = useMemo(() => {
    if (!activeChat) return null;
    const cleanPhone = activeChat.phone ? activeChat.phone.replace(/\D/g, "").slice(-10) : "";
    return state.leads.find((l) => {
      if (activeChat.leadId && l.id === activeChat.leadId) return true;
      if (cleanPhone && l.phone) {
        return l.phone.replace(/\D/g, "").slice(-10) === cleanPhone;
      }
      return false;
    }) || null;
  }, [activeChat, state.leads]);

  const isAdLead = useMemo(() => {
    if (!activeChat) return false;
    if (activeLead?.source === "Ads" || (activeLead?.rawSource || "").toLowerCase().includes("ad")) return true;
    if (activeChat.payload?.source === "Ads" || activeChat.payload?.leadSource === "Ads") return true;
    if (activeChat.payload?.referral?.source_type === "ad") return true;
    if ((activeChat as any).isAdLead === true) return true;
    return false;
  }, [activeChat, activeLead]);

  const windowInfo = useMemo(() => {
    if (!activeChat) return { isOpen: true, hours: 24, remainingMs: 0, remainingText: "" };
    if (!isOfficialChat) return { isOpen: true, hours: 0, remainingMs: 0, remainingText: "" };

    const windowHours = isAdLead ? 72 : 24;
    const limitMs = windowHours * 60 * 60 * 1000;

    // Check backend-computed expiration
    if (activeChat.windowExpiresAt) {
      const expTime = new Date(activeChat.windowExpiresAt).getTime();
      const now = Date.now();
      const rem = expTime - now;
      if (rem > 0) {
        const h = Math.floor(rem / (1000 * 60 * 60));
        const m = Math.floor((rem % (1000 * 60 * 60)) / (1000 * 60));
        return { isOpen: true, hours: windowHours, remainingMs: rem, remainingText: `${h}h ${m}m remaining` };
      } else {
        return { isOpen: false, hours: windowHours, remainingMs: 0, remainingText: "Expired" };
      }
    }

    // Inspect messages for last customer inbound
    const msgs = activeChat.messages || [];
    const inboundMsgs = msgs.filter(
      (m: any) =>
        m.sender === "customer" ||
        m.sender === "user" ||
        m.senderRole === "customer" ||
        m.senderRole === "CUSTOMER" ||
        (!m.fromMe && m.direction !== "OUTBOUND" && m.sender !== "closer")
    );
    if (inboundMsgs.length === 0) {
      return { isOpen: false, hours: windowHours, remainingMs: 0, remainingText: "No customer message yet" };
    }
    const lastInbound = inboundMsgs[inboundMsgs.length - 1];
    if (!lastInbound?.createdAt) {
      return { isOpen: false, hours: windowHours, remainingMs: 0, remainingText: "Expired" };
    }
    const elapsed = Date.now() - new Date(lastInbound.createdAt).getTime();
    const rem = limitMs - elapsed;
    if (rem > 0) {
      const h = Math.floor(rem / (1000 * 60 * 60));
      const m = Math.floor((rem % (1000 * 60 * 60)) / (1000 * 60));
      return { isOpen: true, hours: windowHours, remainingMs: rem, remainingText: `${h}h ${m}m remaining` };
    }
    return { isOpen: false, hours: windowHours, remainingMs: 0, remainingText: "Expired" };
  }, [activeChat, isOfficialChat, isAdLead]);

  const is24HourWindowOpen = windowInfo.isOpen;

  // Synchronize chatStage whenever active lead or active chat changes
  useEffect(() => {
    if (activeLead?.stage) {
      setChatStage(activeLead.stage);
    } else {
      setChatStage("new");
    }
  }, [activeLead?.id, activeLead?.stage, activeChat?.id]);

  // Synchronize outbound dispatch channel when active chat switches
  useEffect(() => {
    if (activeChat) {
      if (activeChat.isPersonalQr || activeChat.channelSource === "QR_SCANNER") {
        setSelectedDispatchChannel("PERSONAL");
      } else if (activeChat.isOfficialApi || activeChat.channelSource === "OFFICIAL_API") {
        setSelectedDispatchChannel("OFFICIAL_API");
      } else {
        setSelectedDispatchChannel("AUTO");
      }
    }
  }, [activeChat?.id, activeChat?.isPersonalQr, activeChat?.channelSource]);

  // Automatically mark opened/active chat as read
  useEffect(() => {
    if (!activeChat || activeChat.isDraft) return;
    if ((activeChat.unreadCount || 0) > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeChat.id ? { ...c, unreadCount: 0 } : c))
      );
      aicloserApi.conversations.markRead(activeChat.id).catch(() => undefined);
    }
  }, [activeChat?.id, activeChat?.unreadCount]);

  // Unified Lead Profile: uses activeLead or falls back to activeChat info
  // Ensures the right drawer is ALWAYS present when showRightDrawer is true
  // Real customer presence: checks if customer has messaged recently
  const isCustomerRecentlyActive = useMemo(() => {
    if (!activeChat?.messages?.length) return false;
    const customerMsgs = activeChat.messages.filter(
      (m: any) =>
        m.sender === "customer" ||
        m.senderRole === "customer" ||
        m.senderRole === "CUSTOMER" ||
        (!m.fromMe && m.direction !== "OUTBOUND" && m.sender !== "closer")
    );
    if (!customerMsgs.length) return false;
    const lastCustomerMsg = customerMsgs[customerMsgs.length - 1];
    if (!lastCustomerMsg?.createdAt) return false;
    const diffMs = Date.now() - new Date(lastCustomerMsg.createdAt).getTime();
    return !isNaN(diffMs) && diffMs < 1000 * 60 * 10; // Customer active within last 10 minutes
  }, [activeChat]);

  const isReadOnlyShare = useMemo(() => {
    if (!activeChat) return false;
    const roleUpper = String(state.user?.role || "").toUpperCase();
    if (roleUpper === "ADMIN" || roleUpper === "SUPER_ADMIN") return false;

    const myName = (state.user?.displayName || CURRENT_USER).toLowerCase();
    const currentUserId = state.user?.userId || (state.user as any)?.id;
    const currentProfileId = (state.user as any)?.agentProfileId || (state.user as any)?.profileId;

    const assigned = (activeChat.assignedTo || "").toLowerCase();
    const scannedBy = (activeChat.scannedByName || "").toLowerCase();
    const isOwner =
      assigned === myName ||
      assigned.includes(myName) ||
      scannedBy === myName ||
      scannedBy.includes(myName) ||
      Boolean(activeChat.assignedFreelancerName && activeChat.assignedFreelancerName.toLowerCase() === myName) ||
      Boolean(activeChat.assignedFreelancerId && (
        (currentUserId && activeChat.assignedFreelancerId === currentUserId) ||
        (currentProfileId && activeChat.assignedFreelancerId === currentProfileId)
      ));

    if (isOwner) return false;

    const sharesList = Array.isArray(activeChat.shares)
      ? activeChat.shares
      : Array.isArray(activeChat.payload?.shares)
      ? activeChat.payload.shares
      : [];

    const myShare = sharesList.find((s: any) =>
      !s.revokedAt && (
        (currentUserId && (s.userId === currentUserId || s.agentProfileId === currentUserId)) ||
        (currentProfileId && (s.agentProfileId === currentProfileId || s.userId === currentProfileId)) ||
        (myName && (s.userId?.toLowerCase() === myName || s.userName?.toLowerCase() === myName))
      )
    );

    if (myShare && myShare.permission === "VIEW") {
      return true;
    }
    return false;
  }, [activeChat, state.user]);

  const activeLeadProfile = useMemo(() => {
    if (activeLead) return { ...activeLead, stage: chatStage };
    if (!activeChat) return null;
    const cleanPhone = activeChat.phone ? activeChat.phone.replace(/\D/g, "").slice(-10) : "";
    return {
      id: activeChat.leadId || `lead-${activeChat.id}`,
      name: activeChat.customerName && activeChat.customerName !== "Customer"
        ? activeChat.customerName
        : `Unknown caller • ${cleanPhone || "Direct"}`,
      company: activeChat.company || "Phone enquiry",
      phone: activeChat.phone || "",
      email: "",
      owner: activeChat.assignedTo || "Unassigned",
      priority: "medium" as const,
      followUp: null,
      tags: ["chat-inbound"],
      updatedAt: new Date().toISOString(),
      code: "CLO-" + (activeChat.id ? activeChat.id.slice(-4).toUpperCase() : "LIVE"),
      stage: chatStage,
      value: 0,
      source: `${activeChat.channel === "whatsapp" ? "WhatsApp" : activeChat.channel === "instagram" ? "Instagram" : "Website"} Inbound`,
      segment: "SMB",
      notes: activeChat.notes || "",
    };
  }, [activeLead, activeChat, chatStage]);

  useEffect(() => {
    const targetLeadId = activeLeadProfile?.id || activeLead?.id || activeChat?.leadId;
    if (!targetLeadId) {
      setLeadPayment(null);
      return;
    }
    let active = true;
    aicloserApi.payments
      .list({ leadId: targetLeadId, limit: 5 })
      .then((res: any) => {
        if (!active) return;
        const payments = res?.payments || [];
        const phoneDigits = activeLeadProfile?.phone?.replace(/\D/g, '').slice(-10) || activeChat?.phone?.replace(/\D/g, '').slice(-10) || '';
        const matching =
          payments.find((p: any) =>
            p.leadId === targetLeadId ||
            p.customFields?.leadId === targetLeadId ||
            (phoneDigits && p.customerPhone && p.customerPhone.replace(/\D/g, '').slice(-10) === phoneDigits)
          ) || null;
        setLeadPayment(matching);
      })
      .catch(() => {
        if (active) setLeadPayment(null);
      });
    return () => {
      active = false;
    };
  }, [activeLeadProfile?.id, activeLead?.id, activeChat?.leadId]);

  // Live ticking countdown for payment link expiration
  useEffect(() => {
    if (!leadPayment) {
      setLeadPaymentSecondsLeft(null);
      return;
    }
    const computeSecs = () => {
      if (typeof leadPayment.remainingSeconds === "number") {
        return leadPayment.remainingSeconds;
      }
      if (leadPayment.expiresAt) {
        return Math.max(0, Math.floor((new Date(leadPayment.expiresAt).getTime() - Date.now()) / 1000));
      }
      return null;
    };
    const initial = computeSecs();
    setLeadPaymentSecondsLeft(initial);
    if (initial === null || initial <= 0) return;

    const interval = setInterval(() => {
      setLeadPaymentSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [leadPayment?.id, leadPayment?.expiresAt, leadPayment?.remainingSeconds]);

  const formatTimerShort = (seconds: number | null) => {
    if (seconds === null) return null;
    if (seconds <= 0) return "Expired";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper to find linked lead for any conversation
  const getLinkedLead = useCallback(
    (c: ConversationItem) => {
      const cleanPhone = c.phone ? c.phone.replace(/\D/g, "").slice(-10) : "";
      return (
        state.leads.find((l) => {
          if (c.leadId && l.id === c.leadId) return true;
          if (cleanPhone && l.phone && l.phone.replace(/\D/g, "").slice(-10) === cleanPhone) return true;
          return false;
        }) || null
      );
    },
    [state.leads]
  );

  // Load workspace labels for inbox filter
  useEffect(() => {
    let active = true;
    aicloserApi.labels
      .list()
      .then((list: any) => {
        if (active && Array.isArray(list)) {
          setWorkspaceLabels(list);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const allAvailableLabels = useMemo(() => {
    const set = new Set<string>();
    workspaceLabels.forEach((lbl) => {
      if (lbl?.name) set.add(lbl.name);
    });
    state.leads.forEach((l) => {
      if (Array.isArray(l.tags)) {
        l.tags.forEach((t) => {
          if (t) set.add(t);
        });
      }
    });
    return Array.from(set).sort();
  }, [workspaceLabels, state.leads]);

  // Click outside listener for per-chat three-dot menu
  useEffect(() => {
    if (!menuChatId) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".chat-card-menu-popover") && !target?.closest(".chat-card-menu-btn")) {
        setMenuChatId(null);
        setMenuSubView("root");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [menuChatId]);

  // Action handlers: Single Delete, Bulk Delete, Quick Stage, Quick Priority, Quick Label, Schedule Callback
  const handleConfirmSingleDelete = async () => {
    if (!singleDeleteChat) return;
    setIsDeletingSingle(true);
    try {
      const chatIdToDelete = singleDeleteChat.id;
      await aicloserApi.conversations.delete(chatIdToDelete);

      // Immediate UI removal
      setConversations((prev) => prev.filter((c) => c.id !== chatIdToDelete));

      // Remove linked lead from UI store
      const lead = getLinkedLead(singleDeleteChat);
      if (lead?.id) {
        deleteLead(lead.id);
      }

      // Re-assign active chat selection if deleted
      if (selectedChatId === chatIdToDelete) {
        const remaining = conversations.filter((c) => c.id !== chatIdToDelete);
        setSelectedChatId(remaining[0]?.id || null);
      }

      showToast("Moved chat and contact to Recycle Bin");
      setSingleDeleteChat(null);
    } catch (err: any) {
      showToast(err?.message || "Failed to delete chat");
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    const idsToDelete = Array.from(selectedChatIds);
    if (idsToDelete.length === 0) return;
    setIsDeletingBulk(true);
    try {
      await aicloserApi.conversations.bulkDelete(idsToDelete);

      // Remove from conversations
      setConversations((prev) => prev.filter((c) => !selectedChatIds.has(c.id)));

      // Remove linked leads from store
      idsToDelete.forEach((cId) => {
        const chatItem = conversations.find((c) => c.id === cId);
        if (chatItem) {
          const lead = getLinkedLead(chatItem);
          if (lead?.id) {
            deleteLead(lead.id);
          }
        }
      });

      // Update active selection if deleted
      if (selectedChatId && selectedChatIds.has(selectedChatId)) {
        const remaining = conversations.filter((c) => !selectedChatIds.has(c.id));
        setSelectedChatId(remaining[0]?.id || null);
      }

      const count = idsToDelete.length;
      setSelectedChatIds(new Set());
      setIsSelectionMode(false);
      setShowBulkDeleteModal(false);
      showToast(`Moved ${count} chat(s) and contact(s) to Recycle Bin`);
    } catch (err: any) {
      showToast(err?.message || "Failed to delete selected chats");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleQuickStageChange = async (chat: ConversationItem, stageId: StageId) => {
    try {
      const lead = getLinkedLead(chat);
      if (lead?.id) {
        moveLead(lead.id, stageId);
      }
      if (chat.id === activeChat?.id) {
        setChatStage(stageId);
      }
      aicloserApi.conversations.updateStage(chat.id, stageId).catch(() => {});
      const meta = stageMeta(stageId);
      showToast(`Stage updated to ${meta.label}`);
      setMenuChatId(null);
      setMenuSubView("root");
    } catch (err: any) {
      showToast(err?.message || "Failed to update stage");
    }
  };

  const handleQuickPriorityChange = (chat: ConversationItem, priority: Priority) => {
    try {
      const lead = getLinkedLead(chat);
      if (lead?.id) {
        updateLead(lead.id, { priority });
      }
      showToast(`Priority updated to ${PRIORITY_LABEL[priority]}`);
      setMenuChatId(null);
      setMenuSubView("root");
    } catch (err: any) {
      showToast(err?.message || "Failed to update priority");
    }
  };

  const handleQuickToggleLabel = (chat: ConversationItem, labelName: string) => {
    try {
      const lead = getLinkedLead(chat);
      if (lead?.id) {
        const currentTags = lead.tags || [];
        const exists = currentTags.includes(labelName);
        const nextTags = exists
          ? currentTags.filter((t) => t !== labelName)
          : [...currentTags, labelName];
        updateLead(lead.id, { tags: nextTags });
        showToast(exists ? `Removed "${labelName}"` : `Added "${labelName}"`);
      } else {
        showToast("No contact profile to assign label");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to update label");
    }
  };

  const handleOpenCallbackModal = (chat: ConversationItem) => {
    setMenuChatId(null);
    setMenuSubView("root");
    setCallbackModalChat(chat);
    const lead = getLinkedLead(chat);
    if (lead?.followUp) {
      try {
        const d = new Date(lead.followUp);
        const pad = (n: number) => String(n).padStart(2, "0");
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setCallbackDateTime(formatted);
      } catch {
        setCallbackDateTime("");
      }
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const pad = (n: number) => String(n).padStart(2, "0");
      const formatted = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
      setCallbackDateTime(formatted);
    }
    setCallbackNote("");
  };

  const handleConfirmScheduleCallback = async () => {
    if (!callbackModalChat || !callbackDateTime) return;
    setSchedulingCallback(true);
    try {
      const isoDate = new Date(callbackDateTime).toISOString();
      await aicloserApi.conversations.scheduleCallback(
        callbackModalChat.id,
        isoDate,
        callbackNote.trim() || undefined
      );

      const lead = getLinkedLead(callbackModalChat);
      if (lead?.id) {
        updateLead(lead.id, {
          followUp: isoDate,
          notes: callbackNote.trim()
            ? `${lead.notes || ""}\nCallback: ${callbackNote.trim()}`
            : lead.notes,
        });
      }

      showToast("Callback scheduled successfully");
      setCallbackModalChat(null);
    } catch (err: any) {
      showToast(err?.message || "Failed to schedule callback");
    } finally {
      setSchedulingCallback(false);
    }
  };

  const filteredConversations = useMemo(() => {
    const userRole = state.user?.role || "ADMIN";
    const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "MANAGER";
    const myName = (state.user?.displayName || CURRENT_USER).toLowerCase();
    const isAgentScope = state.scope.startsWith("agent:");
    const targetAgent = isAgentScope ? state.scope.slice(6).trim().toLowerCase() : null;
    const isCloser = (state.user?.role as string) === "CLOSER" || state.user?.role === "SALES_AGENT";

    const baseList = draftChat
      ? [draftChat, ...conversations.filter((c) => c.id !== draftChat.id)]
      : conversations;

    return baseList.filter((c) => {
      const matchChannel = channelFilter === "all" || c.channel === channelFilter;
      const assigned = (c.assignedTo || "").toLowerCase();
      const scannedBy = (c.scannedByName || "").toLowerCase();
      const isOfficial = c.isOfficialApi === true || c.channelSource === "OFFICIAL_API";
      const isQrChannel = c.channelSource === "QR_SCANNER" || c.isPersonalQr === true;

      let matchScope = true;

      if (c.isDraft) {
        if (scopeFilter === "mine") {
          matchScope = c.isPersonalQr || c.channelSource === "QR_SCANNER" || (!c.isOfficialApi && c.channelSource !== "OFFICIAL_API");
        } else if (scopeFilter === "api") {
          matchScope = c.isOfficialApi || c.channelSource === "OFFICIAL_API";
        } else {
          matchScope = true;
        }
      } else if (isCloser) {
        const currentUserId = state.user?.userId || (state.user as any)?.id;
        const currentDisplayName = state.user?.displayName || CURRENT_USER;
        const currentProfileId = (state.user as any)?.agentProfileId || (state.user as any)?.profileId;

        const isSharedWithMe = Boolean(
          c.isSharedWithMe ||
          (Array.isArray(c.sharedUserIds) && (
            (currentUserId && c.sharedUserIds.includes(currentUserId)) ||
            (currentProfileId && c.sharedUserIds.includes(currentProfileId)) ||
            (currentDisplayName && c.sharedUserIds.includes(currentDisplayName))
          )) ||
          (Array.isArray(c.payload?.sharedUserIds) && (
            (currentUserId && c.payload.sharedUserIds.includes(currentUserId)) ||
            (currentProfileId && c.payload.sharedUserIds.includes(currentProfileId)) ||
            (currentDisplayName && c.payload.sharedUserIds.includes(currentDisplayName))
          )) ||
          (Array.isArray(c.shares) && c.shares.some((s: any) =>
            !s.revokedAt && (
              (currentUserId && (s.userId === currentUserId || s.agentProfileId === currentUserId)) ||
              (currentProfileId && (s.agentProfileId === currentProfileId || s.userId === currentProfileId)) ||
              (currentDisplayName && (s.userId?.toLowerCase() === currentDisplayName.toLowerCase() || s.userName?.toLowerCase() === currentDisplayName.toLowerCase()))
            )
          )) ||
          (Array.isArray(c.payload?.shares) && c.payload.shares.some((s: any) =>
            !s.revokedAt && (
              (currentUserId && (s.userId === currentUserId || s.agentProfileId === currentUserId)) ||
              (currentProfileId && (s.agentProfileId === currentProfileId || s.userId === currentProfileId)) ||
              (currentDisplayName && (s.userId?.toLowerCase() === currentDisplayName.toLowerCase() || s.userName?.toLowerCase() === currentDisplayName.toLowerCase()))
            )
          ))
        );

        const belongsToMe =
          assigned === myName ||
          assigned.includes(myName) ||
          c.assignedTo === CURRENT_USER ||
          scannedBy === myName ||
          scannedBy.includes(myName) ||
          Boolean(c.assignedFreelancerName && c.assignedFreelancerName.toLowerCase() === myName) ||
          Boolean(c.assignedFreelancerId && (
            (currentUserId && c.assignedFreelancerId === currentUserId) ||
            (currentProfileId && c.assignedFreelancerId === currentProfileId)
          )) ||
          isSharedWithMe;

        if (scopeFilter === "mine") {
          // Strictly personal scanned QR WhatsApp companion chats
          matchScope = (c.isPersonalQr || c.channelSource === "QR_SCANNER" || (!c.isOfficialApi && c.channelSource !== "OFFICIAL_API")) && belongsToMe;
        } else if (scopeFilter === "api") {
          // Strictly official API chats assigned to or shared with this closer
          matchScope = (c.isOfficialApi || c.channelSource === "OFFICIAL_API") && (isAdmin || belongsToMe);
        } else {
          // All chats (API + QR) assigned to, scanned by, or shared with this closer
          matchScope = belongsToMe;
        }
      } else if (scopeFilter === "api") {
        // Admin / Manager API view
        if (targetAgent) {
          matchScope = (c.isOfficialApi || c.channelSource === "OFFICIAL_API") && (assigned.includes(targetAgent) || assigned === targetAgent);
        } else {
          matchScope = c.isOfficialApi || c.channelSource === "OFFICIAL_API";
        }
      } else if (targetAgent) {
        // Admin viewing specific agent
        if (scopeFilter === "mine") {
          const belongsToAgent =
            scannedBy === targetAgent ||
            scannedBy.includes(targetAgent) ||
            (isQrChannel && (assigned === targetAgent || assigned.includes(targetAgent)));
          matchScope = (c.isPersonalQr || c.channelSource === "QR_SCANNER" || (!c.isOfficialApi && c.channelSource !== "OFFICIAL_API")) && belongsToAgent;
        } else if (scopeFilter === "all") {
          matchScope =
            assigned.includes(targetAgent) ||
            assigned === targetAgent ||
            scannedBy.includes(targetAgent) ||
            scannedBy === targetAgent;
        }
      } else if (scopeFilter === "mine") {
        // Strictly personal QR WhatsApp chats (scanned by or linked to logged-in user)
        const belongsToMe =
          scannedBy === myName ||
          scannedBy.includes(myName) ||
          (isQrChannel && (assigned === myName || assigned.includes(myName)));
        matchScope = (c.isPersonalQr || c.channelSource === "QR_SCANNER" || (!c.isOfficialApi && c.channelSource !== "OFFICIAL_API")) && belongsToMe;
      } else if (scopeFilter === "unassigned") {
        matchScope = c.assignedTo === "Unassigned";
      }

      const q = search.trim().toLowerCase();
      const qDigits = q.replace(/\D/g, "");
      const phoneDigits = (c.phone || "").replace(/\D/g, "");
      const phoneMatches = c.phone.includes(q) || (qDigits.length >= 4 && phoneDigits.includes(qDigits));
      const matchSearch =
        !q ||
        c.customerName.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        phoneMatches;

      // Linked lead matching for stage, priority, callback/SLA, and label filters
      const linkedLead = getLinkedLead(c);

      // A. Status / Stage filter
      let matchStage = true;
      if (stageFilter !== "all") {
        const leadStage = (linkedLead?.stage || (c as any).stage || "new").toLowerCase();
        if (stageFilter === "new") {
          matchStage = leadStage === "new";
        } else if (stageFilter === "follow_up") {
          matchStage = leadStage === "follow_up";
        } else if (stageFilter === "qualified") {
          matchStage = ["qualified", "demo", "negotiation", "in_progress", "contacted"].includes(leadStage);
        } else if (stageFilter === "won") {
          matchStage = leadStage === "won";
        } else if (stageFilter === "lost") {
          matchStage = leadStage === "lost";
        } else {
          matchStage = leadStage === stageFilter.toLowerCase();
        }
      }

      // B. Priority filter
      let matchPriority = true;
      if (priorityFilter !== "all") {
        const leadPriority = (linkedLead?.priority || "medium").toLowerCase();
        matchPriority = leadPriority === priorityFilter.toLowerCase();
      }

      // C. Callback / SLA filter
      let matchCallback = true;
      if (callbackFilter !== "all") {
        const followUp = linkedLead?.followUp;
        if (callbackFilter === "has_callback") {
          matchCallback = Boolean(followUp);
        } else if (callbackFilter === "due_today") {
          if (!followUp) {
            matchCallback = false;
          } else {
            const d = new Date(followUp);
            const today = new Date();
            matchCallback =
              !isNaN(d.getTime()) &&
              d.getFullYear() === today.getFullYear() &&
              d.getMonth() === today.getMonth() &&
              d.getDate() === today.getDate();
          }
        } else if (callbackFilter === "overdue") {
          if (!followUp) {
            matchCallback = false;
          } else {
            const d = new Date(followUp);
            matchCallback = !isNaN(d.getTime()) && d.getTime() < Date.now();
          }
        }
      }

      // D. Label / Tag filter
      let matchLabel = true;
      if (labelFilter !== "all") {
        const tags = linkedLead?.tags || [];
        matchLabel = Array.isArray(tags) && tags.includes(labelFilter);
      }

      return (
        matchChannel &&
        matchScope &&
        matchSearch &&
        matchStage &&
        matchPriority &&
        matchCallback &&
        matchLabel
      );
    });
  }, [
    conversations,
    channelFilter,
    scopeFilter,
    search,
    stageFilter,
    priorityFilter,
    callbackFilter,
    labelFilter,
    getLinkedLead,
    state.user,
    state.scope,
  ]);

  // Synchronize selectedChatId with active filteredConversations to prevent ghost chats from other scopes
  useEffect(() => {
    if (filteredConversations.length > 0) {
      if (!selectedChatId || !filteredConversations.some((c) => c.id === selectedChatId)) {
        setSelectedChatId(filteredConversations[0].id);
      }
    } else if (filteredConversations.length === 0 && selectedChatId) {
      setSelectedChatId(null);
    }
  }, [filteredConversations, selectedChatId]);

  // Load conversations from live backend API + merge scanned WhatsApp conversations
  useEffect(() => {
    let active = true;

    const fetchAllConversations = () => {
      // Build scanned WhatsApp conversations from state.leads (Strictly isolated by closer role)
      const scannedList: ConversationItem[] = state.leads
        .filter((l) => {
          if (!isScannedWhatsAppLead(l)) return false;
          // Sales Agents can ONLY see personal scanned leads that they personally scanned or own
          if (state.user?.role === "SALES_AGENT" || (state.user?.role as any) === "CLOSER") {
            const myName = state.user?.displayName || "";
            if (l.owner && l.owner !== "Unassigned" && l.owner !== myName) {
              return false;
            }
          }
          return true;
        })
        .map((l) => {
          const cleanPhone = l.phone || "";
          const rawNote = l.notes || "";
          const snippet =
            rawNote.replace(/^Synced with chat history via WA Business Scanner:\s*"?|"?$/g, "") ||
            "Recent WhatsApp conversation";
          const actualConvId =
            (l as any).conversationId ||
            (l.id.startsWith("sales-conversation-") ? l.id.replace(/^sales-conversation-/, "") : l.id);
          const scannedByName = l.owner && l.owner !== "Unassigned" ? l.owner : (state.user?.displayName || "Closer");
          return {
            id: actualConvId,
            leadId: l.id,
            customerName: l.name && !l.name.startsWith("+") ? l.name : cleanPhone || "WhatsApp Contact",
            company: l.company || "WhatsApp Business Lead",
            phone: cleanPhone,
            channel: "whatsapp" as const,
            channelSource: "QR_SCANNER" as const,
            channelSourceLabel: `QR: ${scannedByName}`,
            scannedByName,
            isOfficialApi: false,
            isPersonalQr: true,
            isReassignable: false,
            lastMessage: snippet,
            lastMessageTime: formatMessageTime(l.updatedAt),
            updatedAt: l.updatedAt,
            unreadCount: 0,
            assignedTo: scannedByName,
            messages: [
              {
                id: `msg-${l.id}-1`,
                sender: "customer" as const,
                text: snippet,
                time: formatMessageTime(l.updatedAt),
                createdAt: l.updatedAt || new Date().toISOString(),
                status: "read" as const,
              },
            ],
          };
        });

      const apiParams: any = { limit: 200 };
      const isCloser = (state.user?.role as string) === "CLOSER" || state.user?.role === "SALES_AGENT";
      if (state.scope.startsWith("agent:")) {
        const targetAgent = state.scope.slice(6).trim();
        if (scopeFilter === "mine") {
          apiParams.sourceType = "QR_SCANNER";
          apiParams.scannerName = targetAgent;
        } else if (scopeFilter === "api") {
          apiParams.sourceType = "OFFICIAL_API";
          apiParams.agentName = targetAgent;
        } else {
          apiParams.agentName = targetAgent;
        }
      } else if (!isCloser && scopeFilter === "mine") {
        apiParams.sourceType = "QR_SCANNER";
        if (state.user?.displayName) {
          apiParams.scannerName = state.user.displayName;
        }
      } else if (scopeFilter === "api") {
        apiParams.sourceType = "OFFICIAL_API";
      }

      aicloserApi.conversations
        .list(apiParams)
        .then((res) => {
          if (!active) return;
          const apiMapped: ConversationItem[] = (res?.conversations || [])
            .filter((c: any) => {
              const isQrScanner = c.channelSource === "QR_SCANNER" || c.serviceSlug === "whatsapp-companion" || c.isPersonalQr === true;
              if (isQrScanner && (state.user?.role === "SALES_AGENT" || (state.user?.role as any) === "CLOSER")) {
                const scannerName = c.scannedByName || c.payload?.scannedByName || c.assignedFreelancerName;
                const myName = state.user?.displayName;
                const currentUserId = state.user?.userId || (state.user as any)?.id;
                const currentProfileId = (state.user as any)?.agentProfileId || (state.user as any)?.profileId;
                const isSharedWithMe = Boolean(
                  c.isSharedWithMe ||
                  (Array.isArray(c.payload?.sharedUserIds) && (
                    (currentUserId && c.payload.sharedUserIds.includes(currentUserId)) ||
                    (currentProfileId && c.payload.sharedUserIds.includes(currentProfileId)) ||
                    (myName && c.payload.sharedUserIds.includes(myName))
                  )) ||
                  (Array.isArray(c.payload?.shares) && c.payload.shares.some((s: any) =>
                    !s.revokedAt && (s.userId === currentUserId || s.agentProfileId === currentProfileId || s.userId === myName)
                  ))
                );
                if (scannerName && myName && scannerName !== myName && !isSharedWithMe) {
                  return false;
                }
              }
              return true;
            })
            .map((c: any) => {
              const isQrScanner = c.channelSource === "QR_SCANNER" || c.serviceSlug === "whatsapp-companion" || c.isPersonalQr === true;
              const currentUserId = state.user?.userId || (state.user as any)?.id;
              const currentDisplayName = state.user?.displayName || CURRENT_USER;
              const currentProfileId = (state.user as any)?.agentProfileId || (state.user as any)?.profileId;
              const currentEmail = state.user?.email;

              const sharedUserIdsList: string[] = Array.isArray(c.payload?.sharedUserIds)
                ? c.payload.sharedUserIds
                : Array.isArray(c.sharedUserIds)
                ? c.sharedUserIds
                : [];

              const sharesList: any[] = Array.isArray(c.payload?.shares)
                ? c.payload.shares
                : Array.isArray(c.shares)
                ? c.shares
                : [];

              const isSharedWithMe = Boolean(
                c.isSharedWithMe ||
                (currentUserId && sharedUserIdsList.includes(currentUserId)) ||
                (currentProfileId && sharedUserIdsList.includes(currentProfileId)) ||
                (currentDisplayName && sharedUserIdsList.includes(currentDisplayName)) ||
                (currentEmail && sharedUserIdsList.includes(currentEmail)) ||
                sharesList.some((s: any) =>
                  !s.revokedAt && (
                    (currentUserId && (s.userId === currentUserId || s.agentProfileId === currentUserId)) ||
                    (currentProfileId && (s.agentProfileId === currentProfileId || s.userId === currentProfileId)) ||
                    (currentDisplayName && (s.userId?.toLowerCase() === currentDisplayName.toLowerCase() || s.userName?.toLowerCase() === currentDisplayName.toLowerCase())) ||
                    (currentEmail && s.userId?.toLowerCase() === currentEmail.toLowerCase())
                  )
                )
              );

              return {
                id: c.id,
                leadId: c.leadId || `ld-${c.id.slice(-4)}`,
                customerName: c.customerName || "Customer",
                company: c.lead?.company || "Direct Account",
                phone: c.customerPhone || "",
                channel: (c.channel === "instagram"
                  ? "instagram"
                  : c.channel === "website"
                  ? "website"
                  : "whatsapp") as "whatsapp" | "instagram" | "website",
                channelSource: isQrScanner ? "QR_SCANNER" : (c.channelSource || "OFFICIAL_API"),
                channelSourceLabel: isQrScanner
                  ? (c.channelSourceLabel || (c.scannedByName ? `QR: ${c.scannedByName}` : "Personal WhatsApp QR"))
                  : (c.channelSourceLabel || (c.displayPhoneNumber ? `Cloud API • ${c.displayPhoneNumber}` : "Official WhatsApp Cloud API")),
                scannedByName: isQrScanner ? (c.scannedByName || c.payload?.scannedByName || c.assignedFreelancerName || null) : null,
                isOfficialApi: !isQrScanner,
                isPersonalQr: isQrScanner,
                isReassignable: c.isReassignable !== false,
                lastMessage: c.lastMessageSnippet || c.lastMessage?.body || "Conversation active",
                lastMessageTime: formatMessageTime(c.lastMessage?.createdAt || c.lastMessageAt || c.updatedAt || c.lastMessageTime),
                lastMessageAt: c.lastMessage?.createdAt || c.lastMessageAt || c.updatedAt,
                updatedAt: c.lastMessage?.createdAt || c.lastMessageAt || c.updatedAt,
                unreadCount: c.id === selectedChatId ? 0 : (c.unreadCount || 0),
                assignedTo:
                  c.assignedFreelancerName ||
                  c.assignedAgent?.displayName ||
                  (isQrScanner ? (c.scannedByName || c.payload?.scannedByName) : null) ||
                  "Unassigned",
                aiAutoReplyDisabled: Boolean(c.aiAutoReplyDisabled ?? c.payload?.aiAutoReplyDisabled),
                messages: [],
                payload: c.payload,
                sharedUserIds: sharedUserIdsList,
                shares: sharesList,
                isSharedWithMe,
                assignedFreelancerId: c.assignedFreelancerId || c.payload?.assignedFreelancerId || null,
                assignedFreelancerName: c.assignedFreelancerName || c.payload?.assignedFreelancerName || c.assignedAgent?.displayName || null,
                isDraft: false,
                is24HourWindowOpen: c.is24HourWindowOpen ?? c.payload?.is24HourWindowOpen,
                lastInboundAt: c.lastInboundAt ?? c.payload?.lastInboundAt,
                windowExpiresAt: c.windowExpiresAt ?? c.payload?.windowExpiresAt,
              };
            });

          const combined = [...apiMapped];
          const seenIds = new Set<string>();
          for (const c of apiMapped) {
            seenIds.add(c.id);
          }
          for (const sc of scannedList) {
            if (!seenIds.has(sc.id)) {
              seenIds.add(sc.id);
              combined.push(sc);
            }
          }

          // Sort conversations strictly by newest message timestamp descending
          combined.sort((a, b) => getConversationTimestamp(b) - getConversationTimestamp(a));

          let targetChatId: string | null = null;
          if (typeof window !== "undefined") {
            const sp = new URLSearchParams(window.location.search);
            const urlId = sp.get("id") || sp.get("chatId");
            const urlLeadId = sp.get("leadId");
            const urlPhone = sp.get("phone");
            const urlChannel = sp.get("channel"); // "api" | "mine"

            if (urlId && combined.some((c) => c.id === urlId)) {
              targetChatId = urlId;
              setDraftChat(null);
            } else if (urlLeadId || urlPhone) {
              const cleanPhone = urlPhone ? urlPhone.replace(/\D/g, "").slice(-10) : "";
              const match = combined.find((c) => {
                const leadMatch = urlLeadId && (c.leadId === urlLeadId || c.payload?.leadId === urlLeadId);
                const phoneMatch = cleanPhone && c.phone && c.phone.replace(/\D/g, "").slice(-10) === cleanPhone;
                if (!leadMatch && !phoneMatch) return false;
                if (urlChannel === "api") return c.isOfficialApi || c.channelSource === "OFFICIAL_API";
                if (urlChannel === "mine") return c.isPersonalQr || c.channelSource === "QR_SCANNER";
                return true;
              }) || combined.find((c) => {
                const leadMatch = urlLeadId && (c.leadId === urlLeadId || c.payload?.leadId === urlLeadId);
                const phoneMatch = cleanPhone && c.phone && c.phone.replace(/\D/g, "").slice(-10) === cleanPhone;
                return leadMatch || phoneMatch;
              });

              if (match) {
                targetChatId = match.id;
                setDraftChat(null);
              } else if (urlPhone || urlLeadId) {
                const leadObj = state.leads.find((l) => l.id === urlLeadId || (cleanPhone && l.phone?.replace(/\D/g, "").slice(-10) === cleanPhone));
                const isApi = urlChannel === "api";
                const isMine = urlChannel === "mine";
                const draftId = `draft-${urlLeadId || cleanPhone || Date.now()}`;
                const newDraft: ConversationItem = {
                  id: draftId,
                  isDraft: true,
                  leadId: urlLeadId || leadObj?.id || "",
                  customerName: leadObj?.name || (urlPhone ? `Lead (${urlPhone})` : "New Customer"),
                  company: leadObj?.company || "Direct Lead",
                  phone: urlPhone || leadObj?.phone || "",
                  channel: "whatsapp",
                  channelSource: isMine ? "QR_SCANNER" : "OFFICIAL_API",
                  channelSourceLabel: isMine ? "Personal WhatsApp QR (Draft)" : "Official WhatsApp Cloud API (Draft)",
                  isOfficialApi: isApi || !isMine,
                  isPersonalQr: isMine,
                  lastMessage: "Draft conversation — not yet created in database",
                  lastMessageTime: "Draft",
                  unreadCount: 0,
                  assignedTo: state.user?.displayName || "You",
                  messages: [],
                };
                setDraftChat(newDraft);
                targetChatId = draftId;
              }
            }
          }

          setConversations((prev) => {
            // Preserve any active message threads already in memory
            return combined.map((c) => {
              const existing = prev.find((p) => p.id === c.id);
              if (existing && existing.messages?.length > 0) {
                return { ...c, messages: existing.messages };
              }
              return c;
            });
          });
          setSelectedChatId((current) => {
            if (targetChatId) return targetChatId;
            if (current && combined.some((c) => c.id === current)) return current;
            return combined[0]?.id || null;
          });
        })
        .catch(() => {
          if (!active) return;
          setConversations(scannedList);
          setSelectedChatId((current) => (current ? current : scannedList[0]?.id || null));
        });
    };

    fetchAllConversations();
    const refreshInterval = setInterval(() => {
      if (!document.hidden) {
        fetchAllConversations();
      }
    }, 25000);

    return () => {
      active = false;
      clearInterval(refreshInterval);
    };
  }, [state.leads, refreshCount, state.scope, scopeFilter]);

  // Load Universal Bot Master Status
  useEffect(() => {
    aicloserApi.ai
      .getBotConfig()
      .then((cfg: any) => {
        const val = cfg?.data?.enabled ?? cfg?.enabled;
        if (typeof val === "boolean") {
          setUniversalAiEnabled(val);
        }
      })
      .catch(() => undefined);
  }, []);

  // Sync Per-Conversation AI Copilot status when active thread changes & auto-clear unread
  useEffect(() => {
    if (activeChat && !activeChat.isDraft) {
      setAiAutoReply(!activeChat.aiAutoReplyDisabled);
      if (activeChat.unreadCount > 0) {
        aicloserApi.conversations.markRead(activeChat.id).catch(() => undefined);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeChat.id ? { ...c, unreadCount: 0 } : c))
        );
      }
    }
  }, [activeChat?.id, activeChat?.aiAutoReplyDisabled, activeChat?.unreadCount, activeChat?.isDraft]);

  // Fetch real messages for the active conversation when selected (stale-while-revalidate)
  useEffect(() => {
    if (!activeChat?.id) return;
    if (activeChat.isDraft || activeChat.id.startsWith("draft-")) {
      setLoadingMessages(false);
      return;
    }

    // Immediately display cached messages if available for fast UI response
    if (messagesCache[activeChat.id] && messagesCache[activeChat.id].length > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeChat.id ? { ...c, messages: messagesCache[activeChat.id] } : c))
      );
      setTimeout(() => scrollToBottom("instant"), 10);
    } else {
      setLoadingMessages(true);
    }

    let active = true;

    aicloserApi.conversations
      .getMessages(activeChat.id)
      .then((res: any) => {
        if (!active) return;
        const threadAiDisabled = res?.aiAutoReplyDisabled ?? res?.data?.aiAutoReplyDisabled;
        if (typeof threadAiDisabled === "boolean") {
          setAiAutoReply(!threadAiDisabled);
          setConversations((prev) =>
            prev.map((c) => (c.id === activeChat.id ? { ...c, aiAutoReplyDisabled: threadAiDisabled } : c))
          );
        }
        const apiMessages = res?.messages || res?.data?.messages || [];
        if (Array.isArray(apiMessages) && apiMessages.length > 0) {
          const mappedMessages: ChatMessage[] = apiMessages
            .filter((m: any) => Boolean((m.body && m.body.trim()) || (m.text && m.text.trim()) || m.attachments?.length))
            .map((m: any) => {
              const isOutbound =
                m.fromMe === true ||
                m.direction === "OUTBOUND" ||
                m.senderRole === "sales" ||
                m.senderRole === "admin" ||
                m.senderRole === "closer" ||
                m.senderRole === "agent" ||
                m.senderRole === "CLOSER" ||
                m.senderRole === "ADMIN" ||
                m.senderRole === "ai" ||
                m.sender === "closer" ||
                m.sender === "admin" ||
                (typeof m.senderLabel === "string" &&
                  (m.senderLabel.toLowerCase() === "admin" ||
                    m.senderLabel.toLowerCase() === "sales closer"));

              const isSystem = m.senderRole === "system" || m.sender === "system";

              return {
                id: m.id || `msg-${Math.random()}`,
                sender: isOutbound ? "closer" : isSystem ? "system" : "customer",
                senderName: isOutbound
                  ? (m.senderName || m.senderLabel || m.authorName || (activeChat.assignedTo !== "Unassigned" ? activeChat.assignedTo : "You"))
                  : (activeChat.customerName || "Customer"),
                text: m.body || m.text || "",
                createdAt: m.createdAt,
                time: formatMessageTime(m.createdAt),
                channel: activeChat.channel,
                status: (m.status || m.deliveryStatus || "read") as "sent" | "delivered" | "read",
                externalMessageId: m.externalMessageId || m.wamid || undefined,
              };
            });

          // Sort messages chronologically (oldest at top, newest at bottom, exactly like WhatsApp on phone)
          mappedMessages.sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeA - timeB;
          });

          setMessagesCache((prev) => ({ ...prev, [activeChat.id]: mappedMessages }));
          setConversations((prev) =>
            prev.map((c) => (c.id === activeChat.id ? { ...c, messages: mappedMessages } : c))
          );
          setTimeout(() => scrollToBottom("instant"), 30);
        } else if (!messagesCache[activeChat.id] || messagesCache[activeChat.id].length === 0) {
          // If no message records exist yet in database, synthesize initial inbound bubble if lastMessage is present
          if (activeChat.lastMessage && activeChat.lastMessage !== "Conversation active") {
            const initMsg: ChatMessage = {
              id: `init-${activeChat.id}`,
              sender: "customer",
              text: activeChat.lastMessage,
              createdAt: activeChat.updatedAt || new Date().toISOString(),
              time: activeChat.lastMessageTime || "Recent",
              channel: activeChat.channel,
              status: "delivered",
            };
            setMessagesCache((prev) => ({ ...prev, [activeChat.id]: [initMsg] }));
            setConversations((prev) =>
              prev.map((c) =>
                c.id === activeChat.id && c.messages.length === 0 ? { ...c, messages: [initMsg] } : c
              )
            );
            setTimeout(() => scrollToBottom("instant"), 30);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingMessages(false);
      });

    return () => {
      active = false;
    };
  }, [activeChat?.id, scrollToBottom]);

  // Realtime Server-Sent Events (SSE) listener for live WhatsApp message sync
  useEffect(() => {
    const handleRealtimeEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; payload: any }>;
      const { type, payload } = customEvent.detail || {};
      if (!type || !payload) return;

      if (type === "chat.message" || type === "message.received") {
        const rawMsg = payload.message || {};
        const incomingPhone = (payload.customerPhone || "").replace(/\D/g, "").slice(-10);
        const incomingConvId = payload.conversationId;
        const incomingLeadId = payload.leadId;

        const isOutbound =
          rawMsg.fromMe === true ||
          rawMsg.direction === "OUTBOUND" ||
          rawMsg.senderRole === "sales" ||
          rawMsg.senderRole === "admin" ||
          rawMsg.senderRole === "closer" ||
          rawMsg.senderRole === "agent" ||
          rawMsg.senderRole === "CLOSER" ||
          rawMsg.senderRole === "ADMIN" ||
          rawMsg.senderRole === "ai" ||
          rawMsg.sender === "closer" ||
          rawMsg.sender === "admin" ||
          (typeof rawMsg.senderLabel === "string" &&
            (rawMsg.senderLabel.toLowerCase() === "admin" ||
              rawMsg.senderLabel.toLowerCase() === "sales closer"));

        const isSystem = rawMsg.senderRole === "system" || rawMsg.sender === "system";
        const textBody = rawMsg.body || rawMsg.text || "";
        if (!textBody && !rawMsg.attachments?.length) return;

        // Inbound WhatsApp notification: Audio Chime + Desktop Notification
        if (!isOutbound && !isSystem) {
          playNotificationChime();
          if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
            try {
              new Notification(`New WhatsApp from ${payload.customerName || "Customer"}`, {
                body: (textBody || "New message received").slice(0, 100),
                icon: "/favicon.ico",
              });
            } catch {}
          }
        }

        const newChatMessage: ChatMessage = {
          id: rawMsg.id || `realtime-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sender: isOutbound ? "closer" : isSystem ? "system" : "customer",
          senderName: isOutbound
            ? (rawMsg.senderName || rawMsg.senderLabel || "You")
            : (payload.customerName || activeChat?.customerName || "Customer"),
          text: textBody,
          createdAt: rawMsg.createdAt || new Date().toISOString(),
          time: formatMessageTime(rawMsg.createdAt || new Date().toISOString()),
          channel: "whatsapp",
          status: (rawMsg.status || rawMsg.deliveryStatus || "delivered") as "sent" | "delivered" | "read",
        };

        const activeCleanPhone = (activeChat?.phone || "").replace(/\D/g, "").slice(-10);
        const isCurrentActive = Boolean(
          activeChat?.id &&
          ((incomingConvId && incomingConvId === activeChat.id) ||
           (incomingLeadId && incomingLeadId === activeChat.leadId) ||
           (incomingPhone && activeCleanPhone && incomingPhone === activeCleanPhone))
        );

        if (isCurrentActive && activeChat?.id) {
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== activeChat.id) return c;
              const exists = c.messages.some(
                (m) =>
                  m.id === newChatMessage.id ||
                  (m.sender === newChatMessage.sender &&
                    m.text === newChatMessage.text &&
                    Math.abs(new Date(m.createdAt || 0).getTime() - new Date(newChatMessage.createdAt || 0).getTime()) < 30000)
              );
              if (exists) return c;
              return {
                ...c,
                lastMessage: newChatMessage.text,
                lastMessageTime: newChatMessage.time,
                updatedAt: newChatMessage.createdAt,
                messages: [...c.messages, newChatMessage],
              };
            })
          );
          setMessagesCache((prev) => {
            const currentCache = prev[activeChat.id] || [];
            const exists = currentCache.some(
              (m) =>
                m.id === newChatMessage.id ||
                (m.sender === newChatMessage.sender &&
                  m.text === newChatMessage.text &&
                  Math.abs(new Date(m.createdAt || 0).getTime() - new Date(newChatMessage.createdAt || 0).getTime()) < 30000)
            );
            if (exists) return prev;
            return { ...prev, [activeChat.id]: [...currentCache, newChatMessage] };
          });
          setTimeout(() => scrollToBottom("smooth"), 30);
        }

        // Also update conversation in left list
        setConversations((prev) => {
          const updated = prev.map((c) => {
            const cPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
            const matches =
              (incomingConvId && c.id === incomingConvId) ||
              (incomingLeadId && c.leadId === incomingLeadId) ||
              (incomingPhone && cPhone && incomingPhone === cPhone);

            if (!matches) return c;
            return {
              ...c,
              lastMessage: newChatMessage.text,
              lastMessageTime: newChatMessage.time,
              lastMessageAt: newChatMessage.createdAt,
              updatedAt: newChatMessage.createdAt,
              unreadCount: isCurrentActive ? 0 : (c.unreadCount || 0) + 1,
            };
          });

          return updated.sort((a, b) => getConversationTimestamp(b) - getConversationTimestamp(a));
        });
      } else if (type === "chat.status_updated") {
        const { wamid, status } = payload;
        if (wamid && status) {
          const mappedStatus =
            status.toLowerCase() === "read" ? "read" : status.toLowerCase() === "delivered" ? "delivered" : "sent";
          setConversations((prev) =>
            prev.map((c) => ({
              ...c,
              messages: c.messages.map((m) =>
                m.id === wamid || m.externalMessageId === wamid ? { ...m, status: mappedStatus } : m
              ),
            }))
          );
          if (activeChat?.id) {
            setMessagesCache((prev) => {
              const currentCache = prev[activeChat.id];
              if (!currentCache) return prev;
              return {
                ...prev,
                [activeChat.id]: currentCache.map((m) =>
                  m.id === wamid || m.externalMessageId === wamid ? { ...m, status: mappedStatus } : m
                ),
              };
            });
          }
        }
      } else if (
        type === "conversation.shared" ||
        type === "conversation.share_revoked" ||
        type === "conversation.assigned" ||
        type === "lead.assigned" ||
        type === "chat.conversation_assigned"
      ) {
        setRefreshCount((prev) => prev + 1);
      }
    };

    window.addEventListener("aicloser:realtime", handleRealtimeEvent);
    return () => {
      window.removeEventListener("aicloser:realtime", handleRealtimeEvent);
    };
  }, [activeChat?.id, activeChat?.phone, activeChat?.leadId, activeChat?.customerName, scrollToBottom]);

  // Periodic active chat message polling with exponential backoff & SSE sync (ITEM-06)
  useEffect(() => {
    if (!activeChat?.id || activeChat.isDraft || activeChat.id.startsWith("draft-")) return;

    let timeoutId: NodeJS.Timeout;
    let delay = 6000;
    let cancelled = false;

    const resetDelay = () => {
      delay = 6000;
    };

    window.addEventListener("focus", resetDelay);
    window.addEventListener("aicloser:realtime", resetDelay);

    const poll = async () => {
      if (cancelled) return;
      if (!document.hidden) {
        try {
          const res: any = await aicloserApi.conversations.getMessages(activeChat.id);
          const apiMessages = res?.messages || res?.data?.messages || [];
          if (Array.isArray(apiMessages) && apiMessages.length > 0) {
            const mappedMessages: ChatMessage[] = apiMessages
              .filter((m: any) => Boolean((m.body && m.body.trim()) || (m.text && m.text.trim()) || m.attachments?.length))
              .map((m: any) => {
                const isOutbound =
                  m.fromMe === true ||
                  m.direction === "OUTBOUND" ||
                  m.senderRole === "sales" ||
                  m.senderRole === "admin" ||
                  m.senderRole === "closer" ||
                  m.senderRole === "agent" ||
                  m.senderRole === "CLOSER" ||
                  m.senderRole === "ADMIN" ||
                  m.senderRole === "ai" ||
                  m.sender === "closer" ||
                  m.sender === "admin" ||
                  (typeof m.senderLabel === "string" &&
                    (m.senderLabel.toLowerCase() === "admin" ||
                      m.senderLabel.toLowerCase() === "sales closer"));

                const isSystem = m.senderRole === "system" || m.sender === "system";

                return {
                  id: m.id || `msg-${Math.random()}`,
                  sender: isOutbound ? "closer" : isSystem ? "system" : "customer",
                  senderName: isOutbound
                    ? (m.senderName || m.senderLabel || m.authorName || (activeChat.assignedTo !== "Unassigned" ? activeChat.assignedTo : "You"))
                    : (activeChat.customerName || "Customer"),
                  text: m.body || m.text || "",
                  createdAt: m.createdAt,
                  time: formatMessageTime(m.createdAt),
                  channel: activeChat.channel,
                  status: (m.status || m.deliveryStatus || "read") as "sent" | "delivered" | "read",
                  externalMessageId: m.externalMessageId || m.wamid || undefined,
                };
              });

            mappedMessages.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

            const initialCustomerMsg = activeChat.messages.find((m) => m.sender === "customer");
            const serverHasCustomerMsg = mappedMessages.some((m) => m.sender === "customer");
            const finalMessages = (!serverHasCustomerMsg && initialCustomerMsg)
              ? [initialCustomerMsg, ...mappedMessages].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
              : mappedMessages;

            setMessagesCache((prev) => {
              const prevMsgs = prev[activeChat.id] || [];
              if (
                prevMsgs.length === finalMessages.length &&
                prevMsgs[prevMsgs.length - 1]?.id === finalMessages[finalMessages.length - 1]?.id
              ) {
                delay = Math.min(30000, Math.round(delay * 1.5));
                return prev;
              }
              delay = 6000;
              return { ...prev, [activeChat.id]: finalMessages };
            });

            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== activeChat.id) return c;
                if (
                  c.messages.length === finalMessages.length &&
                  c.messages[c.messages.length - 1]?.id === finalMessages[finalMessages.length - 1]?.id
                ) {
                  return c;
                }
                return { ...c, messages: finalMessages };
              })
            );
          } else {
            delay = Math.min(30000, Math.round(delay * 1.5));
          }
        } catch (err: any) {
          if (err?.status === 403 || err?.response?.status === 403 || String(err?.message || "").includes("403")) {
            cancelled = true;
            return;
          }
          delay = Math.min(30000, Math.round(delay * 1.5));
        }
      }
      if (!cancelled) {
        timeoutId = setTimeout(poll, delay);
      }
    };

    timeoutId = setTimeout(poll, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      window.removeEventListener("focus", resetDelay);
      window.removeEventListener("aicloser:realtime", resetDelay);
    };
  }, [activeChat?.id, activeChat?.messages, activeChat?.assignedTo, activeChat?.channel, activeChat?.customerName]);

  // Scroll to bottom when conversation or message length changes
  useEffect(() => {
    scrollToBottom("instant");
  }, [activeChat?.id, activeChat?.messages?.length, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChat || isReadOnlyShare) return;

    const isPersonalChat = Boolean(
      activeChat.isPersonalQr ||
      activeChat.channelSource === "QR_SCANNER" ||
      (activeChat as any).serviceSlug === "manual-chat" ||
      scopeFilter === "mine"
    );
    const isPersonalDispatch =
      selectedDispatchChannel === "PERSONAL" ||
      (selectedDispatchChannel === "AUTO" && isPersonalChat);

    // Gate 1: Check Personal Companion WhatsApp connection
    if (isPersonalDispatch) {
      if (hasConnectedCompanion === false) {
        showToast("Personal WhatsApp is not connected. Please scan your QR code first.");
        handleOpenQrModal();
        return;
      }
    }

    // Gate 2: Check Meta Cloud API 24h / 72h service window
    if (isOfficialChat && !windowInfo.isOpen && (selectedDispatchChannel === "OFFICIAL_API" || (!isPersonalDispatch && selectedDispatchChannel === "AUTO"))) {
      setShowTemplateModal(true);
      fetchTemplates();
      showToast(`Meta ${windowInfo.hours}h customer service window is closed. Please send an approved template.`);
      return;
    }

    const textToSend = inputText.trim();
    let targetConvId = activeChat.id;

    if (activeChat.isDraft) {
      try {
        const createRes: any = await aicloserApi.conversations.getOrCreate({
          leadId: activeChat.leadId || undefined,
          customerPhone: activeChat.phone,
          customerName: activeChat.customerName || undefined,
          channelSource: selectedDispatchChannel === "PERSONAL" ? "QR_SCANNER" : "OFFICIAL_API",
        });
        const createdConv = createRes?.data?.conversation || createRes?.conversation;
        if (!createdConv?.id) {
          throw new Error("Failed to initialize conversation.");
        }
        targetConvId = createdConv.id;
        const newConvItem: ConversationItem = {
          ...activeChat,
          id: targetConvId,
          isDraft: false,
        };
        setDraftChat(null);
        setConversations((prev) => {
          if (prev.some((c) => c.id === targetConvId)) return prev;
          return [newConvItem, ...prev];
        });
        setSelectedChatId(targetConvId);
      } catch (err: any) {
        showToast(err?.message || "Failed to initialize conversation for message");
        return;
      }
    }

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "closer",
      senderName: state.user?.displayName || CURRENT_USER,
      text: textToSend,
      createdAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      channel: activeChat.channel,
      status: "sent",
    };

    const updatedMessages = [...(messagesCache[targetConvId] || activeChat.messages || []), newMsg];

    setMessagesCache((prev) => ({ ...prev, [targetConvId]: updatedMessages }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetConvId
          ? {
              ...c,
              messages: updatedMessages,
              lastMessage: textToSend,
              lastMessageTime: "Just now",
              unreadCount: 0,
              isDraft: false,
            }
          : c
      )
    );
    setInputText("");
    setTimeout(() => scrollToBottom("smooth"), 30);

    // Send to live backend API with selected delivery channel (Official API vs Personal WhatsApp)
    aicloserApi.conversations
      .sendMessage(targetConvId, textToSend, undefined, selectedDispatchChannel)
      .then((res: any) => {
        const wamid = res?.data?.externalMessageId || res?.externalMessageId;
        if (wamid) {
          setMessagesCache((prev) => ({
            ...prev,
            [targetConvId]: (prev[targetConvId] || []).map((m) =>
              m.id === newMsg.id ? { ...m, externalMessageId: wamid, status: "sent" } : m
            ),
          }));
        }
        if (res?.data?.outboundDispatchError) {
          showToast(res.data.outboundDispatchError);
        }
      })
      .catch((err: any) => {
        const errMsg = err?.message || err?.error || "Failed to deliver message";
        const errCode = err?.code || "";

        // Mark message as failed so it never fakes delivery
        setMessagesCache((prev) => ({
          ...prev,
          [targetConvId]: (prev[targetConvId] || []).map((m) =>
            m.id === newMsg.id ? { ...m, status: "failed" } : m
          ),
        }));

        if (
          errCode === "PERSONAL_WA_NOT_CONNECTED" ||
          String(errMsg).toLowerCase().includes("personal whatsapp is not connected")
        ) {
          // Immediately purge the optimistic message from cache so it never appears sent or delivered!
          setMessagesCache((prev) => ({
            ...prev,
            [targetConvId]: (prev[targetConvId] || []).filter((m) => m.id !== newMsg.id),
          }));
          setConversations((prev) =>
            prev.map((c) =>
              c.id === targetConvId
                ? {
                    ...c,
                    messages: (c.messages || []).filter((m) => m.id !== newMsg.id),
                  }
                : c
            )
          );
          setHasConnectedCompanion(false);
          handleOpenQrModal();
          showToast("Personal WhatsApp is not connected. Scan QR code to connect device.");
        } else if (
          errCode === "META_WINDOW_CLOSED" ||
          String(errMsg).toLowerCase().includes("24-hour") ||
          String(errMsg).toLowerCase().includes("72-hour") ||
          String(errMsg).toLowerCase().includes("service window") ||
          String(errMsg).includes("131047")
        ) {
          setShowTemplateModal(true);
          fetchTemplates();
          showToast(`Meta service window expired. Please select an approved template.`);
        } else {
          showToast(errMsg);
        }
      });
  };

  const handleToggleAiAutoReply = async () => {
    if (!activeChat) return;
    const nextVal = !aiAutoReply;
    setAiAutoReply(nextVal);
    setTogglingAiReply(true);

    // Optimistically update conversation state
    setConversations((prev) =>
      prev.map((c) => (c.id === activeChat.id ? { ...c, aiAutoReplyDisabled: !nextVal } : c))
    );

    showToast(nextVal ? "AI Copilot resumed for this contact" : "AI Copilot paused (Manual human takeover)");

    try {
      await aicloserApi.conversations.setAiAutoReply(activeChat.id, !nextVal);
    } catch (err: any) {
      console.error("Failed to update AI auto reply", err);
      // Rollback on error
      setAiAutoReply(!nextVal);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeChat.id ? { ...c, aiAutoReplyDisabled: nextVal } : c))
      );
      showToast("Failed to update AI setting");
    } finally {
      setTogglingAiReply(false);
    }
  };

  const handleMarkAllRead = async () => {
    setConversations((prev) => prev.map((c) => ({ ...c, unreadCount: 0 })));
    showToast("All conversations marked as read");
    try {
      await aicloserApi.conversations.markAllRead();
    } catch (err) {
      console.error("Failed to mark all read", err);
    }
  };

  const handleSavePaymentAmount = async () => {
    if (!leadPayment?.id) return;
    const num = Number(editPaymentAmount);
    if (isNaN(num) || num <= 0) {
      showToast("Please enter a valid amount greater than ₹0");
      return;
    }
    setSavingPayment(true);
    try {
      await aicloserApi.payments.updatePayment(leadPayment.id, { amount: num });
      setLeadPayment((prev: any) => ({ ...prev, totalAmount: num, baseAmount: num }));
      setIsEditingPayment(false);
      showToast(`Payment amount updated to ₹${num.toLocaleString("en-IN")}`);
    } catch (err: any) {
      showToast(err?.message || "Failed to update payment amount");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleCreateNewPaymentLink = async () => {
    const num = Number(newPaymentAmount);
    if (isNaN(num) || num <= 0) {
      showToast("Please enter a valid amount greater than ₹0");
      return;
    }
    setCreatingPayment(true);
    try {
      const created = await aicloserApi.payments.createUpiLink({
        leadId: activeLeadProfile?.id || activeLead?.id || activeChat?.leadId,
        amount: num,
        customerName: activeLeadProfile?.name || activeChat?.customerName || "Customer",
        customerPhone: activeLeadProfile?.phone || activeChat?.phone,
        productName: newPaymentTitle.trim() || "CRM Setup & Consultation",
        expiryMinutes: newPaymentExpiry || 30,
      });
      const paymentObj = (created as any)?.payment || created;
      setLeadPayment(paymentObj);
      setIsCreatingPayment(false);
      setNewPaymentAmount("");
      showToast(`Payment link created for ₹${num.toLocaleString("en-IN")}`);
    } catch (err: any) {
      showToast(err?.message || "Failed to create payment link");
    } finally {
      setCreatingPayment(false);
    }
  };

  const handleApplyMacro = (text: string) => {
    setInputText(text);
  };

  const handlePriorityChange = (newPriority: Priority) => {
    if (isReadOnlyShare) return;
    if (activeLead) {
      updateLead(activeLead.id, { priority: newPriority });
      aicloserApi.leads.update(activeLead.id, { priority: newPriority }).catch(() => {});
    }
  };

  const handleStageChange = (newStage: StageId) => {
    if (isReadOnlyShare) return;
    setChatStage(newStage);
    if (activeLead) {
      moveLead(activeLead.id, newStage);
      aicloserApi.leads.update(activeLead.id, { stage: newStage }).catch(() => {});
    }
    if (activeChat) {
      aicloserApi.conversations.updateStage(activeChat.id, newStage).catch(() => {});

      const sysMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        sender: "system",
        text: `Lead moved to ${newStage.replace("_", " ").toUpperCase()} by ${state.user?.displayName || CURRENT_USER}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        createdAt: new Date().toISOString(),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChat.id ? { ...c, messages: [...c.messages, sysMsg] } : c
        )
      );
      setTimeout(() => scrollToBottom("smooth"), 30);
    }
  };

  // Quick Macros CRUD State
  const [macros, setMacros] = useState<Array<{ id: string; name: string; content: string }>>([]);
  const [showMacroModal, setShowMacroModal] = useState(false);
  const [editingMacro, setEditingMacro] = useState<{ id: string; name: string; content: string } | null>(null);
  const [macroFormName, setMacroFormName] = useState("");
  const [macroFormContent, setMacroFormContent] = useState("");
  const [savingMacro, setSavingMacro] = useState(false);
  const [macroError, setMacroError] = useState<string | null>(null);

  const loadMacros = useCallback(async () => {
    try {
      const res: any = await aicloserApi.macros.list();
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.macros) ? res.macros : Array.isArray(res) ? res : [];
      if (list.length > 0) {
        setMacros(
          list.map((m: any) => ({
            id: m.id || String(Math.random()),
            name: m.name || m.title || m.label || "Macro",
            content: m.content || m.text || m.body || "",
          }))
        );
      } else {
        setMacros([]);
      }
    } catch {
      setMacros([]);
    }
  }, []);

  useEffect(() => {
    loadMacros();
  }, [loadMacros]);

  const handleSaveMacro = async () => {
    if (!macroFormName.trim() || !macroFormContent.trim()) {
      setMacroError("Both macro name and message content are required");
      return;
    }
    setSavingMacro(true);
    setMacroError(null);
    try {
      if (editingMacro) {
        await aicloserApi.macros.update(editingMacro.id, {
          name: macroFormName.trim(),
          content: macroFormContent.trim(),
        });
        setMacros((prev) =>
          prev.map((m) =>
            m.id === editingMacro.id
              ? { ...m, name: macroFormName.trim(), content: macroFormContent.trim() }
              : m
          )
        );
        showToast(`Macro "${macroFormName.trim()}" updated`);
      } else {
        const created: any = await aicloserApi.macros.create({
          name: macroFormName.trim(),
          content: macroFormContent.trim(),
        });
        const newMacro = {
          id: created?.id || created?.data?.id || `macro-${Date.now()}`,
          name: macroFormName.trim(),
          content: macroFormContent.trim(),
        };
        setMacros((prev) => [...prev, newMacro]);
        showToast(`Macro "${macroFormName.trim()}" created`);
      }
      setEditingMacro(null);
      setMacroFormName("");
      setMacroFormContent("");
    } catch (err: any) {
      setMacroError(err?.message || "Failed to save macro");
    } finally {
      setSavingMacro(false);
    }
  };

  const handleDeleteMacro = async (id: string) => {
    try {
      await aicloserApi.macros.delete(id);
      setMacros((prev) => prev.filter((m) => m.id !== id));
      if (editingMacro?.id === id) {
        setEditingMacro(null);
        setMacroFormName("");
        setMacroFormContent("");
      }
      showToast("Macro deleted");
    } catch (err: any) {
      showToast(err?.message || "Failed to delete macro");
    }
  };

  // Share & Assign Modals State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareTargetUser, setShareTargetUser] = useState("");
  const [sharePermission, setSharePermission] = useState<"VIEW" | "REPLY">("REPLY");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [activeShares, setActiveShares] = useState<Array<{ id: string; userId: string; userName?: string; permission: string }>>([]);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetCloser, setAssignTargetCloser] = useState("");
  const [assignHandoverNote, setAssignHandoverNote] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; role?: string; reportingManager?: string }>>([]);

  // Workspace Governance Controls
  const [workspaceSettings, setWorkspaceSettings] = useState<{
    chatSharingScope: "REPORTING_TEAM_ONLY" | "WORKSPACE_WIDE";
    leadAssignmentScope: "REPORTING_TEAM_ONLY" | "WORKSPACE_WIDE";
    closerLeadReassignmentEnabled: boolean;
    closerChatSharingEnabled: boolean;
  }>({
    chatSharingScope: "WORKSPACE_WIDE",
    leadAssignmentScope: "WORKSPACE_WIDE",
    closerLeadReassignmentEnabled: true,
    closerChatSharingEnabled: true,
  });

  useEffect(() => {
    const readSettings = () => {
      try {
        const stored = localStorage.getItem("closer.workspace.settings.v1");
        if (stored) {
          const parsed = JSON.parse(stored);
          setWorkspaceSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch {}
      aicloserApi.workspace
        .getSettings()
        .then((res: any) => {
          if (res?.settings) {
            setWorkspaceSettings((prev) => ({ ...prev, ...res.settings }));
          } else if (res && typeof res === "object") {
            setWorkspaceSettings((prev) => ({ ...prev, ...res }));
          }
        })
        .catch(() => undefined);
    };

    readSettings();
    window.addEventListener("aicloser:workspace_settings_updated", readSettings);
    return () => {
      window.removeEventListener("aicloser:workspace_settings_updated", readSettings);
    };
  }, []);

  const effectiveTeamMembers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string; reportingManager?: string }>();

    // 1. From store teamMembers
    if (state.teamMembers && state.teamMembers.length > 0) {
      state.teamMembers.forEach((m: any) => {
        const r = (m.role || "").toUpperCase();
        if (r === "SUPER_ADMIN" || r.includes("SUPER")) return;
        const name = m.displayName || m.name;
        if (name && !map.has(name.toLowerCase())) {
          map.set(name.toLowerCase(), {
            id: m.userId || m.id || name,
            name,
            role: m.role || "Closer",
            reportingManager: m.reportingManager || "",
          });
        }
      });
    }

    // 2. From locally fetched teamMembers
    teamMembers.forEach((m) => {
      const r = (m.role || "").toUpperCase();
      if (r === "SUPER_ADMIN" || r.includes("SUPER")) return;
      if (m.name && !map.has(m.name.toLowerCase())) {
        map.set(m.name.toLowerCase(), m);
      }
    });

    // 3. Current user fallback
    if (state.user?.displayName) {
      const uRole = (state.user.role || "").toUpperCase();
      if (uRole !== "SUPER_ADMIN" && !uRole.includes("SUPER")) {
        const myName = state.user.displayName;
        if (!map.has(myName.toLowerCase())) {
          map.set(myName.toLowerCase(), {
            id: state.user.userId || myName,
            name: myName,
            role: state.user.role || "User",
          });
        }
      }
    }

    return Array.from(map.values());
  }, [state.teamMembers, teamMembers, state.user]);

  const isSalesCloser = (state.user?.role as string) === "CLOSER" || state.user?.role === "SALES_AGENT";
  const myCloserName = (state.user?.displayName || CURRENT_USER).toLowerCase();
  const currentCloserMember = useMemo(() => {
    return (
      effectiveTeamMembers.find(
        (m) => m.name.toLowerCase() === myCloserName || m.id === state.user?.userId
      ) || null
    );
  }, [effectiveTeamMembers, myCloserName, state.user?.userId]);

  const currentCloserManager = (currentCloserMember?.reportingManager || "").toLowerCase();

  const shareableTeamMembers = useMemo(() => {
    const myId = state.user?.userId;
    const myName = (state.user?.displayName || "").toLowerCase();

    // Shareable teammates: all active workspace members except the current user (cannot share with self)
    const list = effectiveTeamMembers.filter((m) => {
      const r = (m.role || "").toUpperCase();
      if (r === "SUPER_ADMIN" || r.includes("SUPER")) return false;
      if (myId && m.id === myId) return false;
      if (myName && m.name.toLowerCase() === myName) return false;
      return true;
    });

    if (isSalesCloser && workspaceSettings.chatSharingScope === "REPORTING_TEAM_ONLY" && currentCloserManager) {
      return list.filter((m) => {
        const mManager = (m.reportingManager || "").toLowerCase();
        const mName = m.name.toLowerCase();
        const mRole = (m.role || "").toUpperCase();
        return (
          mManager === currentCloserManager ||
          mName === currentCloserManager ||
          mRole.includes("MANAGER") ||
          mRole === "ADMIN"
        );
      });
    }
    return list;
  }, [effectiveTeamMembers, isSalesCloser, workspaceSettings.chatSharingScope, currentCloserManager, state.user]);

  const assignableTeamMembers = useMemo(() => {
    const list = effectiveTeamMembers.filter((m) => {
      const r = (m.role || "").trim().toUpperCase().replace(/\s+/g, "_");
      // Mandatory B2B SaaS rule: Platform Super Admin & Workspace Admins are STRICTLY excluded from assignment
      if (r === "SUPER_ADMIN" || r.includes("SUPER") || r === "ADMIN" || r === "WORKSPACE_ADMIN" || r === "OWNER") return false;
      return true;
    });

    if (isSalesCloser && workspaceSettings.leadAssignmentScope === "REPORTING_TEAM_ONLY" && currentCloserManager) {
      return list.filter((m) => {
        const mManager = (m.reportingManager || "").toLowerCase();
        const mName = m.name.toLowerCase();
        return (
          mManager === currentCloserManager ||
          mName === currentCloserManager
        );
      });
    }
    return list;
  }, [effectiveTeamMembers, isSalesCloser, workspaceSettings.leadAssignmentScope, currentCloserManager]);

  // Dynamically load all team members, closers, and managers from live APIs & workspace
  useEffect(() => {
    let active = true;

    async function loadTeam() {
      const found = new Map<string, { id: string; name: string; role?: string; reportingManager?: string }>();

      // 1. Current user
      if (state.user?.displayName) {
        const uRole = (state.user.role || "").toUpperCase();
        if (uRole !== "SUPER_ADMIN" && !uRole.includes("SUPER")) {
          found.set(state.user.displayName.toLowerCase(), {
            id: state.user.userId || state.user.displayName,
            name: state.user.displayName,
            role: state.user.role || "User",
          });
        }
      }

      // 2. From store teamMembers
      if (state.teamMembers && state.teamMembers.length > 0) {
        state.teamMembers.forEach((m: any) => {
          const r = (m.role || "").toUpperCase();
          if (r === "SUPER_ADMIN" || r.includes("SUPER")) return;
          const name = m.displayName || m.name;
          if (name && !found.has(name.toLowerCase())) {
            found.set(name.toLowerCase(), {
              id: m.userId || m.id || name,
              name,
              role: m.role || "Closer",
              reportingManager: m.reportingManager || "",
            });
          }
        });
      }

      // 3. Query Central Team API
      try {
        const teamData: any = await aicloserApi.team.list();
        const members = Array.isArray(teamData)
          ? teamData
          : Array.isArray(teamData?.members)
          ? teamData.members
          : Array.isArray(teamData?.data?.members)
          ? teamData.data.members
          : [];
        members.forEach((m: any) => {
          const mRole = (m.role || m.workspaceRole || m.user?.role || "").toUpperCase();
          if (mRole === "SUPER_ADMIN" || mRole.includes("SUPER")) return;
          const name = m.displayName || m.name || m.user?.displayName || m.email;
          if (name && !found.has(name.toLowerCase())) {
            found.set(name.toLowerCase(), {
              id: m.userId || m.id || name,
              name,
              role: m.role || m.workspaceRole || "Agent",
              reportingManager: m.reportingManager?.name || m.reportingManager || m.manager?.displayName || m.manager?.name || "",
            });
          }
        });
      } catch {}

      // 4. Leads owner fallback
      state.leads.forEach((l) => {
        if (l.owner && l.owner !== "Unassigned" && !found.has(l.owner.toLowerCase())) {
          found.set(l.owner.toLowerCase(), {
            id: l.owner,
            name: l.owner,
            role: "Closer",
          });
        }
      });

      if (active && found.size > 0) {
        setTeamMembers(Array.from(found.values()));
      }
    }

    loadTeam();
    return () => {
      active = false;
    };
  }, [state.user, state.leads, state.teamMembers]);

  const availableClosers = useMemo(() => {
    if (teamMembers.length > 0) {
      return teamMembers.map((m) => m.name);
    }
    const set = new Set<string>(["Admin"]);
    if (state.user?.displayName) set.add(state.user.displayName);
    state.leads.forEach((l) => {
      if (l.owner && l.owner !== "Unassigned") set.add(l.owner);
    });
    return Array.from(set);
  }, [teamMembers, state.user, state.leads]);

  const loadConversationShares = useCallback(async (convId: string) => {
    try {
      const res = await aicloserApi.conversations.listShares(convId);
      if (Array.isArray(res)) {
        setActiveShares(res);
      } else if (Array.isArray((res as any)?.shares)) {
        setActiveShares((res as any).shares);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (showShareModal && activeChat?.id) {
      loadConversationShares(activeChat.id);
    }
  }, [showShareModal, activeChat?.id, loadConversationShares]);

  // Pre-select first eligible team member when Share modal opens or candidate list changes
  useEffect(() => {
    if (showShareModal && shareableTeamMembers.length > 0) {
      const candidates = shareableTeamMembers.filter(
        (m) => !activeChat?.assignedTo || m.name.toLowerCase() !== activeChat.assignedTo.toLowerCase()
      );
      if (candidates.length > 0) {
        const currentValid = candidates.some((c) => (c.id && c.id === shareTargetUser) || c.name === shareTargetUser);
        if (!currentValid) {
          setShareTargetUser(candidates[0].id || candidates[0].name);
        }
      }
    }
  }, [showShareModal, shareableTeamMembers, activeChat?.assignedTo, shareTargetUser]);

  const handleShareChat = async () => {
    if (!activeChat || !shareTargetUser) return;
    setShareLoading(true);
    setShareSuccess(null);
    const targetMember = effectiveTeamMembers.find(
      (m) => (m.id && m.id === shareTargetUser) || m.name.toLowerCase() === shareTargetUser.toLowerCase()
    );
    const displayName = targetMember?.name || shareTargetUser;
    const targetParam = targetMember?.id || shareTargetUser;
    const shareObj = { id: `share-${Date.now()}`, userId: targetParam, userName: displayName, permission: sharePermission };
    try {
      await aicloserApi.conversations.share(activeChat.id, targetParam, sharePermission);
      setActiveShares((prev) => [
        ...prev.filter((s) => s.userId !== targetParam),
        shareObj,
      ]);
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeChat.id) return c;
          const currentShares = Array.isArray(c.shares) ? c.shares : [];
          const currentSharedUserIds = Array.isArray(c.sharedUserIds) ? c.sharedUserIds : [];
          const updatedShares = [...currentShares.filter((s: any) => s.userId !== targetParam), shareObj];
          const updatedSharedUserIds = Array.from(new Set([...currentSharedUserIds, targetParam]));
          return {
            ...c,
            shares: updatedShares,
            sharedUserIds: updatedSharedUserIds,
            payload: {
              ...(c.payload || {}),
              shares: updatedShares,
              sharedUserIds: updatedSharedUserIds,
            },
          };
        })
      );
      setShareSuccess(`Chat shared with ${displayName}. Access granted.`);
      showToast(`Chat shared with ${displayName}`);
      setTimeout(() => setShareSuccess(null), 3000);
    } catch (err: any) {
      console.error("Failed to share chat:", err);
      showToast(`Failed to share conversation: ${err?.message || "Server error"}`);
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShare = async (userId: string) => {
    if (!activeChat) return;
    try {
      await aicloserApi.conversations.revokeShare(activeChat.id, userId).catch(() => {});
      setActiveShares((prev) => prev.filter((s) => s.userId !== userId));
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeChat.id) return c;
          const updatedShares = (Array.isArray(c.shares) ? c.shares : []).filter((s: any) => s.userId !== userId);
          const updatedSharedUserIds = (Array.isArray(c.sharedUserIds) ? c.sharedUserIds : []).filter((id: string) => id !== userId);
          return {
            ...c,
            shares: updatedShares,
            sharedUserIds: updatedSharedUserIds,
            payload: {
              ...(c.payload || {}),
              shares: updatedShares,
              sharedUserIds: updatedSharedUserIds,
            },
          };
        })
      );
    } catch {}
  };

  const handleAssignChat = async () => {
    if (!activeChat || !assignTargetCloser) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      const targetMember = effectiveTeamMembers.find(
        (m) => m.id === assignTargetCloser || m.name.toLowerCase() === assignTargetCloser.toLowerCase()
      );
      const targetAgentId = targetMember?.id || assignTargetCloser;
      const assignedDisplayName = targetMember?.name || assignTargetCloser;

      // 1. Live API: assign conversation on Central API with handover note
      const res: any = await aicloserApi.conversations.assign(activeChat.id, targetAgentId, assignHandoverNote);
      if (res && res.success === false) {
        throw new Error(res.message || "Failed to assign conversation");
      }

      // 2. Symmetrically update linked lead and team state
      const linkedLeadId = activeLead?.id || activeChat.leadId;
      if (linkedLeadId) {
        await reassignLead(linkedLeadId, targetAgentId, assignHandoverNote);
      }

      // 3. Add system message in conversation thread and messagesCache
      const sysMsg: ChatMessage = {
        id: `sys-assign-${Date.now()}`,
        sender: "system",
        text: `Chat assigned to ${assignedDisplayName} by ${state.user?.displayName || CURRENT_USER}${assignHandoverNote ? ` (${assignHandoverNote})` : ""}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        createdAt: new Date().toISOString(),
      };

      setMessagesCache((prev) => ({
        ...prev,
        [activeChat.id]: [...(prev[activeChat.id] || []), sysMsg],
      }));

      // If user is a sales closer (not admin), reassigning completely transfers this chat away!
      const isRegularCloser = state.user?.role === "SALES_AGENT" || (state.user?.role as string) === "CLOSER";
      if (isRegularCloser) {
        setConversations((prev) => prev.filter((c) => c.id !== activeChat.id));
        showToast(`Lead & Chat transferred to ${assignedDisplayName}`);
        setTimeout(() => {
          setShowAssignModal(false);
        }, 800);
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeChat.id
              ? {
                  ...c,
                  assignedTo: assignedDisplayName,
                  assignedFreelancerName: assignedDisplayName,
                  assignedFreelancerId: targetAgentId,
                  messages: [...c.messages, sysMsg],
                }
              : c
          )
        );
        setAssignSuccess(`Chat assigned to ${assignedDisplayName}.`);
        showToast(`Assigned to ${assignedDisplayName}`);
        setTimeout(() => {
          setAssignSuccess(null);
          setShowAssignModal(false);
        }, 1200);
      }
    } catch (err: any) {
      console.error("Assignment failed:", err);
      setAssignError(err?.message || "Failed to assign conversation. Please try again.");
    } finally {
      setAssignLoading(false);
    }
  };

  const channelIcon: Record<string, IconName> = {
    whatsapp: "whatsapp",
    instagram: "sparkle",
    website: "message",
  };

  return (
    <div className="chat-workspace">
      <h1 className="sr-only">Live multi-channel chat</h1>

      {/* 1. Left Column: Conversations List */}
      <aside
        aria-label="Conversations"
        style={{
          width: `${inboxWidth}px`,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-sidebar)",
          height: "100%",
          minHeight: 0,
          position: "relative",
        }}
      >
        <ResizeHandle
          edge="right"
          label="Resize conversations inbox"
          resetTo={320}
          min={260}
          max={460}
          getWidth={() => inboxWidth}
          setWidth={handleSetInboxWidth}
        />
        {/* Header with Search & Filters */}
        <div className="chat-inbox-head">
          <div className="chat-inbox-top">
            <div>
              <div className="chat-inbox-title-wrap">
                <h2 className="chat-inbox-title">Inbox</h2>
                <button
                  type="button"
                  className="btn chat-link-qr-btn"
                  data-size="sm"
                  data-variant={isSelectionMode ? "primary" : "ghost"}
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    setSelectedChatIds(new Set());
                  }}
                  title="Toggle multi-chat checkbox selection"
                >
                  <Icon name="check" size={12} /> {isSelectionMode ? "Done" : "Select"}
                </button>
                <button
                  type="button"
                  className="btn chat-link-qr-btn"
                  data-size="sm"
                  data-variant="ghost"
                  onClick={handleOpenQrModal}
                  title="Link personal WhatsApp via QR code or pairing code"
                >
                  <Icon name="smartphone" size={12} /> Link QR
                </button>
              </div>
              {state.scope.startsWith("agent:") && (
                <div className="chat-scope-banner">
                  Viewing: {state.scope.slice(6)}&apos;s Chats
                </div>
              )}
            </div>
            <div className="seg" data-size="sm">
              <button
                data-on={scopeFilter === "all"}
                onClick={() => {
                  setScopeFilter("all");
                  if (state.scope.startsWith("agent:")) setScope("all");
                }}
                title={state.scope.startsWith("agent:") ? `All conversations for ${state.scope.slice(6)}` : "All accessible conversations"}
              >
                All
              </button>
              <button
                data-on={scopeFilter === "mine"}
                onClick={() => {
                  setScopeFilter("mine");
                }}
                title={state.scope.startsWith("agent:") ? `${state.scope.slice(6)}'s scanned WhatsApp QR chats` : "My assigned & personal QR chats"}
              >
                {state.scope.startsWith("agent:") ? state.scope.slice(6) : "Mine"}
              </button>
              <button
                data-on={scopeFilter === "api"}
                onClick={() => {
                  setScopeFilter("api");
                }}
                title={state.scope.startsWith("agent:") ? `${state.scope.slice(6)}'s Official Meta WhatsApp Cloud API conversations` : "Official Meta WhatsApp Cloud API conversations"}
              >
                API
              </button>
            </div>
          </div>

          <div className="search chat-search-wrap">
            <Icon name="search" size={13} />
            <input
              placeholder="Search chat or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="chat-search-input"
            />
          </div>

          {/* Header Filter Controls (Status/Stage, Priority, Callback/SLA, Workspace Labels) */}
          <div className="chat-filters-grid">
            {/* 1. Status / Stage Filter */}
            <select
              className="chat-filter-select"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              title="Filter by Lead Stage"
              aria-label="Filter by Lead Stage"
            >
              <option value="all">All Stages</option>
              <option value="new">New</option>
              <option value="follow_up">Follow-up</option>
              <option value="qualified">Qualified</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>

            {/* 2. Priority Filter */}
            <select
              className="chat-filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              title="Filter by Lead Priority"
              aria-label="Filter by Lead Priority"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* 3. Callback / SLA Filter */}
            <select
              className="chat-filter-select"
              value={callbackFilter}
              onChange={(e) => setCallbackFilter(e.target.value)}
              title="Filter by Callback / Follow-up"
              aria-label="Filter by Callback / Follow-up"
            >
              <option value="all">All Follow-ups</option>
              <option value="due_today">Due Today</option>
              <option value="overdue">Overdue</option>
              <option value="has_callback">Has Callback</option>
            </select>

            {/* 4. Label Filter */}
            <select
              className="chat-filter-select"
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              title="Filter by Label"
              aria-label="Filter by Label"
            >
              <option value="all">All Labels</option>
              {allAvailableLabels.map((lbl) => (
                <option key={lbl} value={lbl}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          {/* Channel Filters (Scrollable, Clean Linear Navigation) */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              whiteSpace: "nowrap",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
              paddingBottom: "2px",
            }}
          >
            {[
              { id: "all", label: "All" },
              { id: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
              { id: "instagram", label: "Instagram", icon: "sparkle" },
              { id: "website", label: "Web", icon: "message" },
            ].map((ch) => (
              <button
                key={ch.id}
                className="btn"
                data-size="sm"
                data-variant={channelFilter === ch.id ? "primary" : "ghost"}
                onClick={() => setChannelFilter(ch.id)}
                style={{
                  height: "26px",
                  fontSize: "11px",
                  padding: "0 10px",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sticky Batch Selection Bar */}
        {isSelectionMode && (
          <div className="chat-batch-bar">
            <div className="chat-batch-left">
              <label className="chat-batch-select-all">
                <input
                  type="checkbox"
                  className="chat-checkbox"
                  checked={
                    filteredConversations.length > 0 &&
                    filteredConversations.every((c) => selectedChatIds.has(c.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedChatIds(new Set(filteredConversations.map((c) => c.id)));
                    } else {
                      setSelectedChatIds(new Set());
                    }
                  }}
                />
                <span>Select All ({filteredConversations.length})</span>
              </label>
              <span className="chat-batch-count">
                {selectedChatIds.size} selected
              </span>
            </div>
            <div className="chat-batch-actions">
              <button
                type="button"
                className="btn"
                data-size="sm"
                data-variant="danger"
                disabled={selectedChatIds.size === 0}
                onClick={() => setShowBulkDeleteModal(true)}
              >
                <Icon name="trash" size={12} /> Delete ({selectedChatIds.size})
              </button>
              <button
                type="button"
                className="btn"
                data-size="sm"
                data-variant="ghost"
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedChatIds(new Set());
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Conversation Rows */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {filteredConversations.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "12px" }}>
              <div style={{ display: "inline-flex", padding: 10, borderRadius: "50%", background: "var(--bg-soft)", marginBottom: 8 }}>
                <Icon name="message" size={20} />
              </div>
              <div style={{ fontWeight: 600, color: "var(--text)" }}>Inbox Empty</div>
              <div style={{ color: "var(--text-tertiary)", marginTop: 4, fontSize: "11px" }}>
                Real messages from WhatsApp, Instagram, and web forms will appear here automatically.
              </div>
            </div>
          ) : (
            filteredConversations.map((chat) => {
              const isSelected = activeChat ? chat.id === activeChat.id : false;
              const linkedLead = getLinkedLead(chat);
              const isCloser =
                (state.user?.role as string) === "CLOSER" || state.user?.role === "SALES_AGENT";
              const isOfficial =
                chat.isOfficialApi === true || chat.channelSource === "OFFICIAL_API";
              const canDeleteChat = !isCloser || !isOfficial;

              return (
                <div
                  key={chat.id}
                  className="chat-card-row"
                  data-selected={isSelected}
                  onClick={() => {
                    setSelectedChatId(chat.id);
                    setConversations((prev) =>
                      prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c))
                    );
                    if (chat.unreadCount > 0) {
                      aicloserApi.conversations.markRead(chat.id).catch(() => undefined);
                    }
                  }}
                >
                  {/* Multi-Selection Checkbox */}
                  {isSelectionMode && (
                    <div style={{ display: "flex", alignItems: "center", paddingTop: "8px" }}>
                      <input
                        type="checkbox"
                        className="chat-checkbox"
                        checked={selectedChatIds.has(chat.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedChatIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(chat.id)) next.delete(chat.id);
                            else next.add(chat.id);
                            return next;
                          });
                        }}
                      />
                    </div>
                  )}

                  {/* Avatar with Channel Icon */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "var(--bg-soft)",
                        border: "1px solid var(--border-strong)",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 600,
                        fontSize: "13px",
                        color: "var(--text)",
                      }}
                    >
                      {chat.customerName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <span
                      style={{
                        position: "absolute",
                        bottom: "-2px",
                        right: "-2px",
                        background: chat.channel === "whatsapp" ? "var(--success)" : "var(--accent)",
                        color: "var(--ink-text)",
                        borderRadius: "50%",
                        width: "16px",
                        height: "16px",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <Icon name={channelIcon[chat.channel] || "message"} size={9} />
                    </span>
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0, paddingRight: isSelectionMode ? "0px" : "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: chat.unreadCount > 0 ? 750 : 650, fontSize: "var(--fs-meta)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {chat.customerName}
                      </span>
                      <span style={{ fontSize: "11px", color: chat.unreadCount > 0 ? "var(--success)" : "var(--text-tertiary)", fontWeight: chat.unreadCount > 0 ? 600 : 400 }}>
                        {chat.lastMessageTime}
                      </span>
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "1px" }}>
                      {chat.company}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                      <p
                        style={{
                          fontSize: "var(--fs-caption)",
                          color: chat.unreadCount > 0 ? "var(--text)" : (isSelected ? "var(--text)" : "var(--text-secondary)"),
                          fontWeight: chat.unreadCount > 0 ? 600 : 400,
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {chat.lastMessage}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span
                          style={{
                            background: "#25D366",
                            color: "#ffffff",
                            borderRadius: "10px",
                            minWidth: "18px",
                            height: "18px",
                            padding: "0 5px",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            lineHeight: 1,
                          }}
                        >
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Channel Source & Closer Badges (Scrollable horizontally without wrapping) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        marginTop: "5px",
                        overflowX: "auto",
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                        flexWrap: "nowrap",
                        maxWidth: "100%",
                      }}
                    >
                      {chat.isOfficialApi || chat.channelSource === "OFFICIAL_API" ? (
                        <span className="chip" data-tone="accent" style={{ fontSize: "10px", padding: "1px 6px", height: "18px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0, whiteSpace: "nowrap" }}>
                          <Icon name="whatsapp" size={10} /> Official API
                        </span>
                      ) : chat.isPersonalQr || chat.channelSource === "QR_SCANNER" ? (
                        <span className="chip" data-tone="success" style={{ fontSize: "10px", padding: "1px 6px", height: "18px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0, whiteSpace: "nowrap" }}>
                          <Icon name="smartphone" size={10} /> {chat.scannedByName ? `QR: ${chat.scannedByName}` : "Personal QR"}
                        </span>
                      ) : chat.channel === "instagram" ? (
                        <span className="chip" data-tone="warning" style={{ fontSize: "10px", padding: "1px 6px", height: "18px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0, whiteSpace: "nowrap" }}>
                          <Icon name="sparkle" size={10} /> Instagram DM
                        </span>
                      ) : (
                        <span className="chip" style={{ fontSize: "10px", padding: "1px 6px", height: "18px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0, whiteSpace: "nowrap" }}>
                          <Icon name="message" size={10} /> Web
                        </span>
                      )}

                      {chat.assignedTo && chat.assignedTo !== "Unassigned" && (
                        <span className="chip" data-tone="neutral" style={{ fontSize: "10px", padding: "1px 6px", height: "18px", flexShrink: 0, whiteSpace: "nowrap" }}>
                          {chat.assignedTo}
                        </span>
                      )}

                      {chat.isSharedWithMe && (
                        <span className="chip" data-tone="accent" style={{ fontSize: "10px", padding: "1px 6px", height: "18px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0, whiteSpace: "nowrap" }}>
                          <Icon name="share" size={10} /> Shared
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover Three-Dot Action Menu Button */}
                  {!isSelectionMode && (
                    <button
                      type="button"
                      className="chat-card-menu-btn"
                      data-open={menuChatId === chat.id}
                      title="Chat actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (menuChatId === chat.id) {
                          setMenuChatId(null);
                          setMenuSubView("root");
                        } else {
                          setMenuChatId(chat.id);
                          setMenuSubView("root");
                        }
                      }}
                    >
                      <Icon name="more" size={13} />
                    </button>
                  )}

                  {/* Contextual Action Menu Popover */}
                  {!isSelectionMode && menuChatId === chat.id && (
                    <div
                      className="chat-card-menu-popover"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {menuSubView === "root" && (
                        <>
                          <button
                            type="button"
                            className="chat-card-menu-item"
                            onClick={() => setMenuSubView("stage")}
                          >
                            <Icon name="zap" size={13} /> Quick Stage change
                          </button>
                          <button
                            type="button"
                            className="chat-card-menu-item"
                            onClick={() => setMenuSubView("priority")}
                          >
                            <Icon name="target" size={13} /> Quick Priority change
                          </button>
                          <button
                            type="button"
                            className="chat-card-menu-item"
                            onClick={() => setMenuSubView("label")}
                          >
                            <Icon name="tag" size={13} /> Add / remove label
                          </button>
                          <button
                            type="button"
                            className="chat-card-menu-item"
                            onClick={() => handleOpenCallbackModal(chat)}
                          >
                            <Icon name="calendar-clock" size={13} /> Schedule Callback
                          </button>
                          <div className="chat-card-menu-divider" />
                          <button
                            type="button"
                            className="chat-card-menu-item"
                            data-tone="danger"
                            disabled={!canDeleteChat}
                            title={
                              !canDeleteChat
                                ? "Company API chats can only be deleted by Admin"
                                : "Move chat and linked contact to Recycle Bin"
                            }
                            onClick={() => {
                              if (!canDeleteChat) return;
                              setMenuChatId(null);
                              setSingleDeleteChat(chat);
                            }}
                          >
                            <Icon name="trash" size={13} /> Delete Chat & Contact
                          </button>
                          {!canDeleteChat && (
                            <span style={{ fontSize: "10px", color: "var(--text-tertiary)", padding: "2px 6px" }}>
                              Company API chats: Admin delete only
                            </span>
                          )}
                        </>
                      )}

                      {menuSubView === "stage" && (
                        <>
                          <div className="chat-card-menu-head">
                            <button
                              type="button"
                              className="chat-card-menu-back-btn"
                              onClick={() => setMenuSubView("root")}
                            >
                              <Icon name="chevron-left" size={11} /> Back
                            </button>
                            <span>Quick Stage</span>
                          </div>
                          {STAGES.map((s) => {
                            const currentStage = (linkedLead?.stage || (chat as any).stage || "new").toLowerCase();
                            const isActive = currentStage === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                className="chat-card-menu-subitem"
                                data-active={isActive}
                                onClick={() => handleQuickStageChange(chat, s.id)}
                              >
                                <span>{s.label}</span>
                                {isActive && <Icon name="check" size={11} />}
                              </button>
                            );
                          })}
                        </>
                      )}

                      {menuSubView === "priority" && (
                        <>
                          <div className="chat-card-menu-head">
                            <button
                              type="button"
                              className="chat-card-menu-back-btn"
                              onClick={() => setMenuSubView("root")}
                            >
                              <Icon name="chevron-left" size={11} /> Back
                            </button>
                            <span>Quick Priority</span>
                          </div>
                          {(["urgent", "high", "medium", "low"] as Priority[]).map((p) => {
                            const currentPrio = (linkedLead?.priority || "medium").toLowerCase();
                            const isActive = currentPrio === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                className="chat-card-menu-subitem"
                                data-active={isActive}
                                onClick={() => handleQuickPriorityChange(chat, p)}
                              >
                                <span>{PRIORITY_LABEL[p]}</span>
                                {isActive && <Icon name="check" size={11} />}
                              </button>
                            );
                          })}
                        </>
                      )}

                      {menuSubView === "label" && (
                        <>
                          <div className="chat-card-menu-head">
                            <button
                              type="button"
                              className="chat-card-menu-back-btn"
                              onClick={() => setMenuSubView("root")}
                            >
                              <Icon name="chevron-left" size={11} /> Back
                            </button>
                            <span>Toggle Labels</span>
                          </div>
                          <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
                            {allAvailableLabels.length === 0 ? (
                              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", padding: "6px" }}>
                                No workspace labels
                              </div>
                            ) : (
                              allAvailableLabels.map((lbl) => {
                                const hasTag = linkedLead?.tags?.includes(lbl);
                                return (
                                  <button
                                    key={lbl}
                                    type="button"
                                    className="chat-card-menu-subitem"
                                    data-active={hasTag}
                                    onClick={() => handleQuickToggleLabel(chat, lbl)}
                                  >
                                    <span>{lbl}</span>
                                    {hasTag && <Icon name="check" size={11} />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* 2. Middle Column: Active Chat Thread Workspace */}
      {!activeChat ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", padding: 40, height: "100%" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Icon name="message" size={24} />
          </div>
          <div style={{ fontWeight: 650, fontSize: "15px", color: "var(--text)" }}>No Active Conversation</div>
          <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: 4, maxWidth: 320, textAlign: "center" }}>
            Incoming WhatsApp, Instagram, and web chats will appear in the inbox on the left.
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
            height: "100%",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Thread Header */}
          <header
            style={{
              height: "54px",
              flexShrink: 0,
              borderBottom: "1px solid var(--border)",
              padding: "0 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 650, fontSize: "var(--fs-body)", color: "var(--text)" }}>
                    {activeChat.customerName}
                  </span>
                  {activeChat.isDraft && (
                    <span className="chip" data-tone="warning" style={{ fontSize: "11px", padding: "1px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Icon name="pencil" size={12} /> Draft
                    </span>
                  )}
                  {activeChat.isOfficialApi || activeChat.channelSource === "OFFICIAL_API" ? (
                    <span
                      className="chip"
                      data-tone={windowInfo.isOpen ? (isAdLead ? "accent" : "success") : "warning"}
                      style={{ fontSize: "11px", padding: "1px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      title={windowInfo.isOpen ? `Meta ${isAdLead ? "72h Ad" : "24h"} messaging window is open (${windowInfo.remainingText})` : `Meta ${windowInfo.hours}h messaging window is closed (template required)`}
                    >
                      <Icon name="bolt" size={12} /> {activeChat.channelSourceLabel || "Official API"} • {windowInfo.isOpen ? `${isAdLead ? "Ad Window" : "Window"}: ${windowInfo.remainingText}` : "Window Closed"}
                    </span>
                  ) : activeChat.isPersonalQr || activeChat.channelSource === "QR_SCANNER" || isPersonalChat ? (
                    hasConnectedCompanion === false ? (
                      <button
                        type="button"
                        className="chip"
                        data-tone="danger"
                        onClick={handleOpenQrModal}
                        title="Your personal WhatsApp is not connected. Click to scan QR code."
                        style={{ cursor: "pointer", fontSize: "11px", padding: "1px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <Icon name="smartphone" size={12} /> Personal Line (Not Connected — Scan QR)
                      </button>
                    ) : (
                      <span className="chip" data-tone="success" style={{ fontSize: "11px", padding: "1px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Icon name="smartphone" size={12} /> Personal Line ({userCompanionPhone ? `+${userCompanionPhone}` : (activeChat.scannedByName ? `Scanned by ${activeChat.scannedByName}` : "Active")})
                      </span>
                    )
                  ) : activeChat.channel === "instagram" ? (
                    <span className="chip" data-tone="warning" style={{ fontSize: "11px", padding: "1px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Icon name="sparkle" size={12} /> Instagram DM
                    </span>
                  ) : (
                    <span className="chip" style={{ fontSize: "11px", padding: "1px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Icon name="message" size={12} /> Web Chat
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span>{activeChat.company} • {activeChat.phone}</span>
                  {activeChat.assignedTo && activeChat.assignedTo !== "Unassigned" && (
                    <span> • Assigned to: <strong style={{ color: "var(--text)" }}>{activeChat.assignedTo}</strong></span>
                  )}
                  {activeChat.isSharedWithMe && (
                    <span className="chip" data-tone="accent" style={{ fontSize: "10px", padding: "1px 6px" }}>
                      Shared with you
                    </span>
                  )}
                  <span>•</span>
                  <span className="chat-status-indicator" style={{ color: isCustomerRecentlyActive ? "var(--success)" : "var(--text-tertiary)" }}>
                    <span className="chat-status-dot" data-status={isCustomerRecentlyActive ? "active" : "offline"} />
                    {isCustomerRecentlyActive ? "Customer active now" : (activeChat.lastMessageTime && activeChat.lastMessageTime !== "Draft" ? `Last activity ${activeChat.lastMessageTime}` : "Direct Contact")}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* WhatsApp AI Thread Toggle */}
              <button
                className="btn"
                data-size="sm"
                data-variant={aiAutoReply ? undefined : "ghost"}
                onClick={handleToggleAiAutoReply}
                disabled={togglingAiReply}
                title={
                  aiAutoReply
                    ? "WhatsApp AI is answering this contact. Click to pause for human takeover."
                    : "WhatsApp AI is paused for this contact. Click to resume."
                }
              >
                <Icon name="sparkle" size={12} /> WhatsApp AI {aiAutoReply ? "On" : "Paused"}
              </button>

              {/* Direct Call Button */}
              <a href={`tel:${activeChat.phone}`} className="btn" data-size="sm" title="Initiate SIM Call">
                <Icon name="phone" size={12} /> Call SIM
              </a>

              {/* Toggle CRM Details Drawer */}
              <button
                className="btn"
                data-size="sm"
                data-variant={showRightDrawer ? "primary" : "ghost"}
                onClick={() => setShowRightDrawer(!showRightDrawer)}
                title="Toggle CRM 360 profile sidebar"
              >
                <Icon name="panel" size={13} />
              </button>
            </div>
          </header>

          {activeChat.isDraft && (
            <div className="chat-draft-banner">
              <Icon name="pencil" size={13} />
              <span>
                <strong>Draft Mode:</strong> This conversation is not yet created in the database. Composing or sending your first message will automatically initialize it.
              </span>
            </div>
          )}

          {isReadOnlyShare && (
            <div style={{ padding: "6px 18px", background: "var(--bg-soft)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)" }}>
              <Icon name="lock" size={12} />
              <span>Read-only shared conversation. You can view message history but cannot reply.</span>
            </div>
          )}

          {toastMessage && (
            <div className="chat-toast-banner" role="status" aria-live="polite">
              <Icon name="check" size={13} /> {toastMessage}
            </div>
          )}

          {/* Message Area - Scrollable thread with auto-scroll */}
          <div
            ref={messageContainerRef}
            role="log"
            aria-label="Conversation"
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              overflowY: "auto",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "var(--bg)",
            }}
          >
            {loadingMessages && activeChat.messages.length === 0 ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "40px", color: "var(--text-tertiary)", fontSize: "12px", gap: "8px" }}>
                <Icon name="sparkle" size={14} /> Loading conversation history...
              </div>
            ) : activeChat.messages.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "12px" }}>
                <div style={{ display: "inline-flex", padding: 10, borderRadius: "50%", background: "var(--bg-soft)", marginBottom: 8 }}>
                  <Icon name="message" size={20} />
                </div>
                <div style={{ fontWeight: 650, color: "var(--text)", fontSize: "13px" }}>No messages in thread yet</div>
                <div style={{ color: "var(--text-tertiary)", marginTop: 4, fontSize: "11px", maxWidth: 320, margin: "4px auto 0" }}>
                  Type a reply below or pick a quick sales macro to start chatting with {activeChat.customerName}.
                </div>
              </div>
            ) : (
              activeChat.messages.map((msg, index) => {
                const prevMsg = activeChat.messages[index - 1];
                const currentDateKey = getMessageDateKey(msg.createdAt);
                const prevDateKey = prevMsg ? getMessageDateKey(prevMsg.createdAt) : null;
                const showDateHeader = index === 0 || currentDateKey !== prevDateKey;

                if (msg.sender === "system") {
                  return (
                    <div key={msg.id}>
                      {showDateHeader && (
                        <div style={{ textAlign: "center", margin: "8px 0" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--text-tertiary)",
                              background: "var(--bg-soft)",
                              padding: "2px 10px",
                              borderRadius: "12px",
                              border: "1px solid var(--border)",
                            }}
                          >
                            {currentDateKey}
                          </span>
                        </div>
                      )}
                      <div style={{ textAlign: "center", margin: "6px 0" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            background: "var(--bg-soft)",
                            padding: "3px 10px",
                            borderRadius: "var(--r-sm)",
                            border: "1px dashed var(--border-strong)",
                          }}
                        >
                          {msg.text} • {msg.time}
                        </span>
                      </div>
                    </div>
                  );
                }

                const isCloser = msg.sender === "closer";
                return (
                  <div key={msg.id}>
                    {showDateHeader && (
                      <div style={{ textAlign: "center", margin: "8px 0" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-tertiary)",
                            background: "var(--bg-soft)",
                            padding: "2px 10px",
                            borderRadius: "12px",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {currentDateKey}
                        </span>
                      </div>
                    )}

                    <div className="chat-bubble-wrap" data-sender={isCloser ? "closer" : "customer"}>
                      <div className="chat-bubble-actions">
                        <button
                          type="button"
                          className="chat-action-btn"
                          title="Copy message text"
                          data-state={copiedMessageId === msg.id ? "copied" : "idle"}
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          aria-label="Copy message text"
                        >
                          <Icon name={copiedMessageId === msg.id ? "check" : "copy"} size={12} />
                        </button>
                      </div>

                      <div className="chat-bubble" data-sender={isCloser ? "closer" : "customer"}>
                        {renderMessageContent(msg.text, isCloser)}
                      </div>

                      {/* Sender name & WhatsApp ticks */}
                      <div
                        style={{
                          fontSize: "10px",
                          color: "var(--text-tertiary)",
                          marginTop: "3px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span style={{ fontWeight: 600, opacity: 0.85, fontSize: "9.5px" }}>
                          {isCloser
                            ? (msg.senderName || activeChat.assignedTo || (state.user?.displayName || CURRENT_USER))
                            : (activeChat.customerName || "Customer")}
                        </span>
                        <span>•</span>
                        <span>{msg.time}</span>
                        {isCloser && (
                          <span
                            title={msg.status === "read" ? "Read by customer (Blue ticks)" : msg.status === "delivered" ? "Delivered to customer's phone" : "Sent"}
                            style={{
                              color: msg.status === "read" ? "#53bdeb" : "var(--text-tertiary)",
                              fontWeight: 700,
                              fontSize: "12px",
                              lineHeight: 1,
                              display: "inline-flex",
                              alignItems: "center",
                              marginLeft: "2px",
                            }}
                          >
                            {msg.status === "sent" ? "✓" : "✓✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} style={{ height: "1px" }} />
          </div>

          {/* Quick Sales Macros */}
          <div className="macro-bar">
            <span className="macro-label">Quick Macros:</span>
            {macros.map((m) => (
              <button
                key={m.id}
                type="button"
                className="macro-chip"
                onClick={() => handleApplyMacro(m.content)}
                title={m.content}
              >
                {m.name}
              </button>
            ))}
            <button
              type="button"
              className="macro-chip"
              onClick={() => {
                setEditingMacro(null);
                setMacroFormName("");
                setMacroFormContent("");
                setMacroError(null);
                setShowMacroModal(true);
              }}
              title="Manage Macros"
            >
              <Icon name="plus" size={11} /> Manage
            </button>
          </div>

          {/* Personal WhatsApp Not Connected Banner */}
          {isPersonalDispatch && hasConnectedCompanion === false && (
            <div className="chat-companion-alert" data-tone="danger">
              <div className="chat-window-alert-content">
                <div className="chat-window-alert-icon">
                  <Icon name="smartphone" size={16} />
                </div>
                <div className="chat-window-alert-text">
                  <strong>Personal WhatsApp Not Connected:</strong> You have not scanned your WhatsApp QR code on this account. Messages cannot be sent until you link your device.
                </div>
              </div>
              <div className="chat-window-alert-actions">
                <button
                  type="button"
                  className="btn"
                  data-size="sm"
                  data-variant="accent"
                  onClick={handleOpenQrModal}
                >
                  <Icon name="qr" size={13} /> Scan QR Code
                </button>
              </div>
            </div>
          )}

          {/* Official API Service Window Open Indicator */}
          {selectedDispatchChannel === "OFFICIAL_API" && isOfficialChat && windowInfo.isOpen && (
            <div style={{ padding: "6px 18px", background: isAdLead ? "var(--accent-soft)" : "var(--success-soft)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--fs-caption)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: isAdLead ? "var(--accent)" : "var(--success)", fontWeight: 500 }}>
                <Icon name="bolt" size={12} />
                Meta {isAdLead ? "72h Ad" : "24h"} Messaging Window Open: <strong>{windowInfo.remainingText}</strong> • Direct reply enabled
              </span>
              <button
                type="button"
                className="btn"
                data-size="sm"
                data-variant="ghost"
                onClick={() => {
                  setShowTemplateModal(true);
                  fetchTemplates();
                }}
              >
                <Icon name="sparkle" size={12} /> Template
              </button>
            </div>
          )}

          {/* Official API Service Window Closed Banner */}
          {selectedDispatchChannel === "OFFICIAL_API" && isOfficialChat && !windowInfo.isOpen && (
            <div className="chat-window-alert">
              <div className="chat-window-alert-content">
                <div className="chat-window-alert-icon">
                  <Icon name="alert-circle" size={16} />
                </div>
                <div className="chat-window-alert-text">
                  <strong>Meta {windowInfo.hours}h Service Window Closed:</strong> Free-form messaging is locked by WhatsApp. You must send an approved template to start or re-engage this customer.
                </div>
              </div>
              <div className="chat-window-alert-actions">
                <button
                  type="button"
                  className="btn"
                  data-size="sm"
                  data-variant="accent"
                  onClick={() => {
                    setShowTemplateModal(true);
                    fetchTemplates();
                  }}
                >
                  <Icon name="sparkle" size={12} /> Select Template
                </button>
                <button
                  type="button"
                  className="btn"
                  data-size="sm"
                  data-variant="outline"
                  onClick={() => {
                    setSelectedDispatchChannel("PERSONAL");
                    if (hasConnectedCompanion === false) {
                      handleOpenQrModal();
                    }
                  }}
                >
                  <Icon name="whatsapp" size={12} /> Switch to Personal
                </button>
              </div>
            </div>
          )}

          {/* Message Input Bar - Anchored at bottom, keyboard always visible */}
          <footer
            style={{
              padding: "12px 18px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-panel)",
              display: "flex",
              gap: "10px",
              alignItems: "flex-end",
              flexShrink: 0,
            }}
          >
            {isReadOnlyShare ? (
              <div
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: "var(--r-md)",
                  background: "var(--bg-soft)",
                  border: "1px dashed var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--text-secondary)",
                  fontSize: "var(--fs-caption)",
                }}
              >
                <Icon name="lock" size={14} />
                <span>You have read-only access to this shared conversation. Replying is disabled.</span>
              </div>
            ) : (
              <>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={
                    (selectedDispatchChannel === "OFFICIAL_API" && isOfficialChat && !windowInfo.isOpen) ||
                    (isPersonalDispatch && hasConnectedCompanion === false)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    isPersonalDispatch && hasConnectedCompanion === false
                      ? "Personal WhatsApp not connected — click 'Scan QR Code' to link your phone"
                      : selectedDispatchChannel === "OFFICIAL_API" && isOfficialChat && !windowInfo.isOpen
                      ? `Meta ${windowInfo.hours}h window closed — click 'Template' to send an approved template`
                      : "Type your reply... (Press Enter to send, Shift+Enter for new line)"
                  }
                  style={{
                    flex: 1,
                    height: "46px",
                    minHeight: "46px",
                    maxHeight: "120px",
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--border-input)",
                    background: "var(--bg-surface)",
                    color: "var(--text)",
                    fontSize: "var(--fs-body)",
                    resize: "none",
                    outline: "none",
                    opacity: ((selectedDispatchChannel === "OFFICIAL_API" && isOfficialChat && !windowInfo.isOpen) || (isPersonalDispatch && hasConnectedCompanion === false)) ? 0.6 : 1,
                  }}
                />
                <div className="seg" data-size="sm" title="Message Dispatch Channel">
                  <button
                    type="button"
                    data-on={selectedDispatchChannel === "OFFICIAL_API"}
                    onClick={() => {
                      setSelectedDispatchChannel("OFFICIAL_API");
                      if (draftChat) {
                        setDraftChat((prev) => prev ? { ...prev, channelSource: "OFFICIAL_API", isOfficialApi: true, isPersonalQr: false, channelSourceLabel: "Official WhatsApp Cloud API (Draft)" } : null);
                      }
                    }}
                    title="Send via Official Meta WhatsApp Cloud API"
                  >
                    <Icon name="bolt" size={12} />
                    <span>API</span>
                  </button>
                  <button
                    type="button"
                    data-on={selectedDispatchChannel === "PERSONAL"}
                    onClick={() => {
                      setSelectedDispatchChannel("PERSONAL");
                      if (draftChat) {
                        setDraftChat((prev) => prev ? { ...prev, channelSource: "QR_SCANNER", isOfficialApi: false, isPersonalQr: true, channelSourceLabel: "Personal WhatsApp QR (Draft)" } : null);
                      }
                      if (hasConnectedCompanion === false) {
                        handleOpenQrModal();
                      }
                    }}
                    title="Send via Personal Scanned WhatsApp (Direct Companion Phone)"
                  >
                    <Icon name="whatsapp" size={12} />
                    <span>Personal</span>
                  </button>
                </div>
                {isPersonalDispatch && hasConnectedCompanion === false ? (
                  <button
                    type="button"
                    className="btn"
                    data-variant="accent"
                    onClick={handleOpenQrModal}
                    style={{ height: "46px", padding: "0 18px", fontWeight: 600 }}
                  >
                    <Icon name="qr" size={14} /> Scan QR Code
                  </button>
                ) : selectedDispatchChannel === "OFFICIAL_API" && isOfficialChat && !windowInfo.isOpen ? (
                  <button
                    type="button"
                    className="btn"
                    data-variant="accent"
                    onClick={() => {
                      setShowTemplateModal(true);
                      fetchTemplates();
                    }}
                    style={{ height: "46px", padding: "0 18px", fontWeight: 600 }}
                  >
                    <Icon name="sparkle" size={14} /> Template
                  </button>
                ) : (
                  <button
                    className="btn"
                    data-variant="primary"
                    onClick={handleSendMessage}
                    style={{ height: "46px", padding: "0 18px", fontWeight: 600 }}
                  >
                    Send <Icon name="arrow-right" size={14} />
                  </button>
                )}
              </>
            )}
          </footer>
        </div>
      )}

      {/* 3. Right Column: CRM 360° Lead Context */}
      {showRightDrawer && activeLeadProfile && (
        <aside
          aria-label="Lead context"
          style={{
            width: `${drawerWidth}px`,
            flexShrink: 0,
            borderLeft: "1px solid var(--border)",
            background: "var(--bg-sidebar)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: "16px",
            gap: "16px",
            height: "100%",
            minHeight: 0,
            position: "relative",
          }}
        >
          <ResizeHandle
            edge="left"
            label="Resize lead profile sidebar"
            resetTo={320}
            min={260}
            max={560}
            getWidth={() => drawerWidth}
            setWidth={handleSetDrawerWidth}
          />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase" }}>
                Lead Profile
              </span>
              <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                {activeLeadProfile.code}
              </span>
            </div>
            <h3 style={{ fontSize: "var(--fs-title)", fontWeight: 650, margin: "6px 0 2px 0" }}>
              {activeLeadProfile.name}
            </h3>
            <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
              {activeLeadProfile.company}
            </div>

            {/* Quick Contact Info with 1-click Copy */}
            {(activeLeadProfile.phone || activeLeadProfile.email) && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {activeLeadProfile.phone && (
                  <div className="drawer-contact-row">
                    <div className="drawer-contact-label">
                      <Icon name="phone" size={12} />
                      <span>{activeLeadProfile.phone}</span>
                    </div>
                    <button
                      type="button"
                      className="drawer-copy-btn"
                      data-state={copiedContact === "phone" ? "copied" : "idle"}
                      onClick={() => handleCopyContact("phone", activeLeadProfile.phone, "Phone number")}
                      title="Copy phone number"
                    >
                      <Icon name={copiedContact === "phone" ? "check" : "copy"} size={11} />
                      {copiedContact === "phone" ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
                {activeLeadProfile.email && (
                  <div className="drawer-contact-row">
                    <div className="drawer-contact-label">
                      <Icon name="mail" size={12} />
                      <span>{activeLeadProfile.email}</span>
                    </div>
                    <button
                      type="button"
                      className="drawer-copy-btn"
                      data-state={copiedContact === "email" ? "copied" : "idle"}
                      onClick={() => handleCopyContact("email", activeLeadProfile.email, "Email")}
                      title="Copy email address"
                    >
                      <Icon name={copiedContact === "email" ? "check" : "copy"} size={11} />
                      {copiedContact === "email" ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stage Selector */}
          <div className="card" style={{ padding: "12px", background: "var(--bg-surface)" }}>
            <label htmlFor="chat-stage" style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
              Pipeline Stage
            </label>
            <select
              className="select"
              id="chat-stage"
              value={activeLeadProfile.stage}
              onChange={(e) => handleStageChange(e.target.value as StageId)}
              disabled={isReadOnlyShare}
              style={{ width: "100%", marginTop: "6px", fontWeight: 600, opacity: isReadOnlyShare ? 0.6 : 1 }}
            >
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Selector */}
          <div className="card" style={{ padding: "12px", background: "var(--bg-surface)" }}>
            <label htmlFor="chat-priority" style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
              Lead Priority
            </label>
            <select
              className="select"
              id="chat-priority"
              value={activeLead?.priority || "medium"}
              onChange={(e) => handlePriorityChange(e.target.value as Priority)}
              disabled={!activeLead || isReadOnlyShare}
              style={{ width: "100%", marginTop: "6px", fontWeight: 600, opacity: (!activeLead || isReadOnlyShare) ? 0.6 : 1 }}
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Payment & Collection Status */}
          <div className="payment-card-wrap">
            <div className="payment-card-head">
              <span className="payment-card-title">
                Payment Status
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {leadPayment ? (
                  <>
                    <span
                      className="chip"
                      data-tone={
                        leadPayment.status === "PAID"
                          ? "success"
                          : leadPayment.status === "CUSTOMER_CONFIRMED"
                          ? "accent"
                          : (leadPayment.status === "EXPIRED" || (leadPaymentSecondsLeft !== null && leadPaymentSecondsLeft <= 0))
                          ? "danger"
                          : "warning"
                      }
                    >
                      {leadPayment.status === "PAID"
                        ? "Paid"
                        : leadPayment.status === "CUSTOMER_CONFIRMED"
                        ? "Proof Submitted"
                        : (leadPayment.status === "EXPIRED" || (leadPaymentSecondsLeft !== null && leadPaymentSecondsLeft <= 0))
                        ? "Expired"
                        : "Active"}
                    </span>
                    {leadPayment.status !== "PAID" && (
                      <span
                        className="chip"
                        data-tone={
                          (leadPayment.status === "EXPIRED" || (leadPaymentSecondsLeft !== null && leadPaymentSecondsLeft <= 0))
                            ? "danger"
                            : "accent"
                        }
                        style={{ fontSize: "10px", padding: "1px 6px" }}
                        title={leadPayment.expiresAt ? `Expires: ${new Date(leadPayment.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : undefined}
                      >
                        <Icon name="clock" size={10} />
                        {formatTimerShort(leadPaymentSecondsLeft)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="chip" data-tone="neutral">
                    Unbilled
                  </span>
                )}
              </div>
            </div>

            {leadPayment ? (
              <div style={{ marginTop: "8px" }}>
                {!isEditingPayment ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div className="payment-card-amount">
                        ₹{Number(leadPayment.totalAmount || leadPayment.baseAmount || 0).toLocaleString("en-IN")}
                      </div>
                      {leadPayment.productName &&
                      !leadPayment.productName.toLowerCase().includes("auto-created") &&
                      !leadPayment.productName.toLowerCase().includes("enrich this contact") && (
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                          {leadPayment.productName}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        type="button"
                        className="btn"
                        data-size="sm"
                        data-variant="ghost"
                        onClick={() => {
                          setEditPaymentAmount(String(leadPayment.totalAmount || leadPayment.baseAmount || ""));
                          setIsEditingPayment(true);
                          setIsCreatingPayment(false);
                        }}
                        title="Edit payment amount"
                      >
                        <Icon name="pencil" size={11} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        data-size="sm"
                        data-variant="ghost"
                        onClick={() => {
                          setIsCreatingPayment(true);
                          setIsEditingPayment(false);
                        }}
                        title="Create new payment link with another amount"
                      >
                        <Icon name="plus" size={11} /> New
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 550 }}>Edit Amount (₹):</div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="number"
                        className="input"
                        value={editPaymentAmount}
                        onChange={(e) => setEditPaymentAmount(e.target.value)}
                        placeholder="e.g. 999"
                        autoFocus
                      />
                      <button
                        className="btn"
                        data-size="sm"
                        data-variant="primary"
                        onClick={handleSavePaymentAmount}
                        disabled={savingPayment}
                      >
                        {savingPayment ? "Saving..." : "Save"}
                      </button>
                      <button
                        className="btn"
                        data-size="sm"
                        data-variant="ghost"
                        onClick={() => setIsEditingPayment(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {leadPayment.publicToken && (
                  <div className="payment-card-foot">
                    <div className="drawer-contact-label">
                      <Icon name="link" size={12} />
                      <span style={{ fontSize: "11px", fontFamily: "var(--mono)" }}>/pay/{leadPayment.publicToken.slice(0, 8)}...</span>
                    </div>
                    <button
                      type="button"
                      className="drawer-copy-btn"
                      data-state={copiedContact === "payment-link" ? "copied" : "idle"}
                      onClick={() => {
                        const payUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${leadPayment.publicToken}`;
                        handleCopyContact("payment-link", payUrl, "Payment link");
                      }}
                      title="Copy payment link"
                    >
                      <Icon name={copiedContact === "payment-link" ? "check" : "copy"} size={11} />
                      {copiedContact === "payment-link" ? "Copied" : "Copy Link"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty" style={{ padding: "16px 8px" }}>
                <div className="empty-title" style={{ fontSize: "12px" }}>No active payment link</div>
                <div className="empty-desc" style={{ fontSize: "11px" }}>Generate a dynamic UPI payment link for this lead.</div>
                {!isCreatingPayment && (
                  <button
                    type="button"
                    className="btn"
                    data-size="sm"
                    data-variant="outline"
                    onClick={() => {
                      setIsCreatingPayment(true);
                      setIsEditingPayment(false);
                    }}
                    style={{ marginTop: "8px", width: "100%" }}
                  >
                    <Icon name="plus" size={11} /> Generate Payment Link
                  </button>
                )}
              </div>
            )}

            {/* Quick Creation Form (Inline) */}
            {isCreatingPayment && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px",
                  background: "var(--bg-panel)",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text)" }}>New Payment Link</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Amount (₹)</label>
                  <input
                    type="number"
                    className="input"
                    value={newPaymentAmount}
                    onChange={(e) => setNewPaymentAmount(e.target.value)}
                    placeholder="e.g. 1499"
                    style={{ height: "28px", fontSize: "12px" }}
                    autoFocus
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Title / Service</label>
                  <input
                    type="text"
                    className="input"
                    value={newPaymentTitle}
                    onChange={(e) => setNewPaymentTitle(e.target.value)}
                    placeholder="CRM Setup & Consultation"
                    style={{ height: "28px", fontSize: "12px" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Link Validity / Expiry</label>
                  <div className="seg" role="tablist" style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={newPaymentExpiry === 15}
                      data-on={newPaymentExpiry === 15}
                      onClick={() => setNewPaymentExpiry(15)}
                      style={{ fontSize: "10.5px", padding: "3px 0" }}
                    >
                      15m
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={newPaymentExpiry === 30}
                      data-on={newPaymentExpiry === 30}
                      onClick={() => setNewPaymentExpiry(30)}
                      style={{ fontSize: "10.5px", padding: "3px 0" }}
                    >
                      30m
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={newPaymentExpiry === 60}
                      data-on={newPaymentExpiry === 60}
                      onClick={() => setNewPaymentExpiry(60)}
                      style={{ fontSize: "10.5px", padding: "3px 0" }}
                    >
                      1h
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={newPaymentExpiry === 1440}
                      data-on={newPaymentExpiry === 1440}
                      onClick={() => setNewPaymentExpiry(1440)}
                      style={{ fontSize: "10.5px", padding: "3px 0" }}
                    >
                      24h
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "2px" }}>
                  <button
                    className="btn"
                    data-size="sm"
                    data-variant="ghost"
                    onClick={() => setIsCreatingPayment(false)}
                    style={{ height: "26px", fontSize: "11px" }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    data-size="sm"
                    data-variant="primary"
                    onClick={handleCreateNewPaymentLink}
                    disabled={creatingPayment}
                    style={{ height: "26px", fontSize: "11px" }}
                  >
                    {creatingPayment ? "Creating..." : "Create Link"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              className="btn"
              data-variant="accent"
              onClick={() => {
                if (leadPayment?.publicToken) {
                  const isExp = leadPayment.status === "EXPIRED" || (leadPaymentSecondsLeft !== null && leadPaymentSecondsLeft <= 0);
                  if (isExp) {
                    showToast("This payment link has expired. Please generate a new link before sending.");
                    setIsCreatingPayment(true);
                    return;
                  }
                  const payUrl = `${window.location.origin}/pay/${leadPayment.publicToken}`;
                  const expiryNote = leadPaymentSecondsLeft !== null && leadPaymentSecondsLeft > 0
                    ? ` (Valid for next ${formatTimerShort(leadPaymentSecondsLeft)})`
                    : "";
                  handleApplyMacro(`Here is your custom payment link for ₹${Number(leadPayment.totalAmount || leadPayment.baseAmount || 0).toLocaleString("en-IN")}: ${payUrl}${expiryNote}`);
                } else {
                  const qs = new URLSearchParams({
                    customerName: activeLeadProfile.name || "",
                    customerPhone: activeLeadProfile.phone || "",
                    customerEmail: activeLeadProfile.email || "",
                  }).toString();
                  window.location.href = `/payment-links?${qs}`;
                }
              }}
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              <Icon name="card" size={13} /> {leadPayment?.publicToken ? "Insert Payment Link in Chat" : "Create UPI Payment Link"}
            </button>
            <button
              className="btn"
              onClick={() => setActiveHistoryTab("callback")}
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              <Icon name="calendar-clock" size={13} /> Schedule Callback
            </button>
            <button
              className="btn"
              onClick={() => setShowAssignModal(true)}
              disabled={isReadOnlyShare}
              style={{ width: "100%", justifyContent: "flex-start", opacity: isReadOnlyShare ? 0.6 : 1 }}
            >
              <Icon name="users" size={13} /> Assign to Closer
            </button>
            <button
              className="btn"
              onClick={() => setShowShareModal(true)}
              disabled={isReadOnlyShare}
              style={{ width: "100%", justifyContent: "flex-start", opacity: isReadOnlyShare ? 0.6 : 1 }}
            >
              <Icon name="link" size={13} /> Share Conversation
            </button>
          </div>

          {/* Unified Lead Command History, Notes, Callbacks & Call Recordings */}
          <ErrorBoundary fallbackTitle="Activity & Notes history temporarily unavailable">
            <LeadCommandHistory
              leadId={activeLead?.id || activeChat?.leadId || ""}
              conversationId={activeChat?.id}
              customerName={activeLeadProfile.name}
              customerPhone={activeChat?.phone}
              currentFollowUpAt={activeLead?.followUp}
              initialNotes={typeof activeLead?.notes === "string" ? activeLead.notes : (activeLead?.notes ? JSON.stringify(activeLead.notes) : "")}
              activeTab={activeHistoryTab}
              onTabChange={setActiveHistoryTab}
              onFollowUpSaved={(iso) => {
                if (activeLead) {
                  updateLead(activeLead.id, { followUp: iso });
                }
              }}
            />
          </ErrorBoundary>
        </aside>
      )}

      {/* Share Conversation Modal */}
      {showShareModal && activeChat && (
        <div className="overlay" data-kind="dialog" onClick={() => setShowShareModal(false)}>
          <div className="dialog" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <header className="dialog-head">
              <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "14px" }}>
                <Icon name="link" size={15} /> Share Conversation Access
              </h2>
              <button type="button" className="icon-btn" onClick={() => setShowShareModal(false)}>
                <Icon name="close" size={14} />
              </button>
            </header>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Share with Team Member via Central API */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Grant Access to Team Member
                </label>
                {isSalesCloser && workspaceSettings.closerChatSharingEnabled === false ? (
                  <div className="chip" data-tone="warning" style={{ width: "100%", height: "auto", padding: "8px 10px", whiteSpace: "normal", marginTop: "4px" }}>
                    Chat sharing by sales closers is restricted by workspace governance. Contact your administrator to request sharing capabilities.
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <select
                      className="select"
                      value={shareTargetUser}
                      onChange={(e) => setShareTargetUser(e.target.value)}
                      style={{ flex: 1, height: "32px", fontSize: "12px" }}
                    >
                      {(() => {
                        const myId = state.user?.userId || (state.user as any)?.id;
                        const myName = (state.user?.displayName || "").toLowerCase();
                        let candidates = shareableTeamMembers.filter(
                          (m) => !activeChat.assignedTo || m.name.toLowerCase() !== activeChat.assignedTo.toLowerCase()
                        );
                        if (candidates.length === 0 && state.teamMembers && state.teamMembers.length > 0) {
                          candidates = state.teamMembers
                            .filter((m) => {
                              const r = (m.role || "").toUpperCase();
                              if (r === "SUPER_ADMIN" || r.includes("SUPER")) return false;
                              if (myId && (m.id === myId || (m as any).userId === myId)) return false;
                              if (myName && m.name.toLowerCase() === myName) return false;
                              return true;
                            })
                            .map((m) => ({ id: m.id, name: m.name, role: m.role }));
                        }
                        if (candidates.length === 0) {
                          return <option value="" disabled>No teammates available to share</option>;
                        }
                        return candidates.map((m) => (
                          <option key={m.id || m.name} value={m.id || m.name}>
                            {m.name} {m.role ? `(${m.role})` : ""}
                          </option>
                        ));
                      })()}
                    </select>
                    <select
                      className="select"
                      value={sharePermission}
                      onChange={(e) => setSharePermission(e.target.value as "VIEW" | "REPLY")}
                      style={{ width: "95px", height: "32px", fontSize: "12px" }}
                    >
                      <option value="VIEW">View Only</option>
                      <option value="REPLY">Can Reply</option>
                    </select>
                    <button
                      type="button"
                      className="btn"
                      data-variant="primary"
                      data-size="sm"
                      disabled={shareLoading}
                      onClick={handleShareChat}
                    >
                      {shareLoading ? "Sharing..." : "Share"}
                    </button>
                  </div>
                )}
                {shareSuccess && (
                  <span className="chip" data-tone="success" style={{ fontSize: "11px", marginTop: "6px", display: "inline-block" }}>
                    ✓ {shareSuccess}
                  </span>
                )}
              </div>

              {/* List of Active Shares */}
              {activeShares.length > 0 && (
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                    Currently Shared With
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                    {activeShares.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 8px",
                          background: "var(--bg-soft)",
                          borderRadius: "var(--r-sm)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span style={{ fontSize: "12px", fontWeight: 550 }}>{s.userName || s.userId}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="chip" data-tone="accent" style={{ fontSize: "10px", padding: "0 4px" }}>
                            {s.permission}
                          </span>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Revoke access"
                            onClick={() => handleRevokeShare(s.userId)}
                            style={{ width: "20px", height: "20px" }}
                          >
                            <Icon name="close" size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <footer className="dialog-foot">
              <button type="button" className="btn" onClick={() => setShowShareModal(false)}>
                Done
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Manage Macros Modal */}
      {showMacroModal && (
        <div className="overlay" data-kind="dialog" onClick={() => setShowMacroModal(false)}>
          <div className="dialog" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <header className="dialog-head">
              <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "14px" }}>
                <Icon name="sparkle" size={15} /> Manage Quick Macros
              </h2>
              <button type="button" className="icon-btn" onClick={() => setShowMacroModal(false)}>
                <Icon name="close" size={14} />
              </button>
            </header>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Add / Edit Form */}
              <div className="card" style={{ padding: "12px", background: "var(--bg-surface)" }}>
                <div style={{ fontSize: "12px", fontWeight: 650, marginBottom: "8px" }}>
                  {editingMacro ? "Edit Macro" : "Create New Macro"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div className="field">
                    <label style={{ fontSize: "11px", fontWeight: 600 }}>Macro Button Name</label>
                    <input
                      className="input"
                      value={macroFormName}
                      onChange={(e) => setMacroFormName(e.target.value)}
                      placeholder="e.g. Callback, UPI QR, Pricing Sheet"
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: "11px", fontWeight: 600 }}>Message Content</label>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={macroFormContent}
                      onChange={(e) => setMacroFormContent(e.target.value)}
                      placeholder="The exact message text to insert into conversation..."
                    />
                  </div>
                  {macroError && (
                    <span className="chip" data-tone="danger" style={{ fontSize: "11px" }}>
                      {macroError}
                    </span>
                  )}
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "4px" }}>
                    {editingMacro && (
                      <button
                        type="button"
                        className="btn"
                        data-size="sm"
                        data-variant="ghost"
                        onClick={() => {
                          setEditingMacro(null);
                          setMacroFormName("");
                          setMacroFormContent("");
                          setMacroError(null);
                        }}
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn"
                      data-size="sm"
                      data-variant="primary"
                      disabled={savingMacro}
                      onClick={handleSaveMacro}
                    >
                      {savingMacro ? "Saving..." : editingMacro ? "Update Macro" : "Add Macro"}
                    </button>
                  </div>
                </div>
              </div>

              {/* List of Existing Macros */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Saved Macros ({macros.length})
                </label>
                {macros.length === 0 ? (
                  <div className="empty" style={{ padding: "20px 12px" }}>
                    <div className="empty-title" style={{ fontSize: "13px" }}>No custom macros configured</div>
                    <div className="empty-desc" style={{ fontSize: "11px" }}>Add your first macro above for 1-click quick responses.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px", maxHeight: "240px", overflowY: "auto" }}>
                    {macros.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          padding: "8px 10px",
                          background: "var(--bg-soft)",
                          borderRadius: "var(--r-sm)",
                          border: "1px solid var(--border)",
                          gap: "8px",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>{m.name}</div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--text-secondary)",
                              marginTop: "2px",
                              whiteSpace: "pre-wrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {m.content}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Edit macro"
                            onClick={() => {
                              setEditingMacro(m);
                              setMacroFormName(m.name);
                              setMacroFormContent(m.content);
                              setMacroError(null);
                            }}
                          >
                            <Icon name="pencil" size={12} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Delete macro"
                            onClick={() => handleDeleteMacro(m.id)}
                          >
                            <Icon name="trash" size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <footer className="dialog-foot">
              <button type="button" className="btn" onClick={() => setShowMacroModal(false)}>
                Done
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Assign Conversation Modal */}
      {showAssignModal && activeChat && (
        <div className="overlay" data-kind="dialog" onClick={() => setShowAssignModal(false)}>
          <div className="dialog" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <header className="dialog-head">
              <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "14px" }}>
                <Icon name="users" size={15} /> Assign Conversation
              </h2>
              <button type="button" className="icon-btn" onClick={() => setShowAssignModal(false)}>
                <Icon name="close" size={14} />
              </button>
            </header>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {activeChat.isPersonalQr && (
                <div className="card" style={{ padding: "10px 12px", background: "var(--bg-panel)", borderLeft: "3px solid var(--accent)" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name="smartphone" size={13} /> Personal QR Scanned Line
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    This conversation is linked to a customer WhatsApp line. Assigning it will transfer the full lead, history, and active chat to the selected sales closer.
                  </div>
                </div>
              )}

              {isSalesCloser && !workspaceSettings.closerLeadReassignmentEnabled && (
                <div className="chip" data-tone="warning" style={{ width: "100%", height: "auto", padding: "8px 10px", whiteSpace: "normal" }}>
                  Lead reassignment by sales closers is restricted by workspace governance policy. Contact your sales manager or workspace admin.
                </div>
              )}

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Current Assignee
                </label>
                <div style={{ marginTop: "4px" }}>
                  <span className="chip" data-tone={activeChat.assignedTo && activeChat.assignedTo !== "Unassigned" ? "accent" : "warning"}>
                    {activeChat.assignedTo || "Unassigned"}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="assign-target-select" style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Assign to Closer / Agent
                </label>
                <select
                  id="assign-target-select"
                  className="select"
                  value={assignTargetCloser}
                  onChange={(e) => setAssignTargetCloser(e.target.value)}
                  style={{ width: "100%", marginTop: "4px", height: "32px", fontSize: "12px" }}
                >
                  <option value="" disabled>Choose closer / agent...</option>
                  {assignableTeamMembers
                    .filter((member) => (member.name || "").toLowerCase() !== (activeChat.assignedTo || "").toLowerCase() && (member.id || "").toLowerCase() !== (activeChat.assignedTo || "").toLowerCase())
                    .map((member) => (
                      <option key={member.id || member.name} value={member.id || member.name}>
                        {member.name} {member.role ? `(${member.role})` : ""}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="assign-handover-note" style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Handover Note / Context
                </label>
                <input
                  id="assign-handover-note"
                  className="input"
                  value={assignHandoverNote}
                  onChange={(e) => setAssignHandoverNote(e.target.value)}
                  placeholder="e.g. Lead interested in CRM pro plan; callback requested for 4 PM"
                  style={{ marginTop: "4px", fontSize: "12px" }}
                />
              </div>

              {assignSuccess && (
                <span className="pill" style={{ color: "var(--accent-strong)", background: "var(--bg-soft)", fontSize: "11px" }}>
                  ✓ {assignSuccess}
                </span>
              )}
              {assignError && (
                <p className="form-error" style={{ margin: 0, fontSize: "11.5px" }}>{assignError}</p>
              )}
            </div>
            <footer className="dialog-foot">
              <button type="button" className="btn" onClick={() => setShowAssignModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                disabled={
                  assignLoading ||
                  !assignTargetCloser ||
                  (assignableTeamMembers.find((m) => m.id === assignTargetCloser || m.name === assignTargetCloser)?.name.toLowerCase() === (activeChat.assignedTo || "").toLowerCase())
                }
                onClick={handleAssignChat}
              >
                {assignLoading ? "Assigning..." : "Confirm Assignment"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Closer Link Personal WhatsApp QR Modal */}
      {showQrModal && (
        <div className="overlay" data-kind="dialog" onClick={() => setShowQrModal(false)}>
          <div className="dialog" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <header className="dialog-head">
              <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "14px" }}>
                <Icon name="smartphone" size={16} /> Link Personal WhatsApp Line
              </h2>
              <button type="button" className="icon-btn" onClick={() => setShowQrModal(false)}>
                <Icon name="close" size={14} />
              </button>
            </header>

            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                Link your personal or business WhatsApp to receive client messages directly in your <strong style={{ color: "var(--text)" }}>Mine</strong> tab. Leads captured on your line remain strictly isolated to you and workspace admins.
              </div>

              {waDeviceStatus === "CONNECTED" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", padding: "16px 0" }}>
                  <div className="chip" data-tone="success" style={{ padding: "8px 14px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="dot" style={{ background: "var(--success)" }} />
                    <strong>WhatsApp Line Active</strong>
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>
                    {connectedPhone || "Connected Line"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", textAlign: "center", maxWidth: "340px" }}>
                    Your WhatsApp session is live and connected. Outbound replies will be sent directly through your linked phone.
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                    <button
                      type="button"
                      className="btn"
                      data-variant="primary"
                      data-size="sm"
                      disabled={qrLoading}
                      onClick={handleSyncLiveChats}
                    >
                      <Icon name="refresh" size={13} className={qrLoading ? "spin" : ""} /> Sync Recent Chats
                    </button>
                    <button
                      type="button"
                      className="btn"
                      data-variant="danger"
                      data-size="sm"
                      disabled={qrLoading}
                      onClick={handleDisconnectLine}
                    >
                      Disconnect Line
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Method Switcher */}
                  <div className="seg" style={{ width: "100%", justifyContent: "center" }}>
                    <button
                      type="button"
                      data-on={qrPairingMethod === "qr"}
                      onClick={() => setQrPairingMethod("qr")}
                      style={{ flex: 1 }}
                    >
                      QR Code Scanner
                    </button>
                    <button
                      type="button"
                      data-on={qrPairingMethod === "code"}
                      onClick={() => setQrPairingMethod("code")}
                      style={{ flex: 1 }}
                    >
                      Pairing Code
                    </button>
                  </div>

                  {qrPairingMethod === "qr" ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "10px 0" }}>
                      <div
                        style={{
                          border: "2px solid var(--border)",
                          borderRadius: "12px",
                          padding: "10px",
                          background: "#fff",
                          minHeight: "244px",
                          minWidth: "244px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {qrLoading && !qrCodeDataUrl ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "#666" }}>
                            <Icon name="refresh" size={24} className="spin" />
                            <span style={{ fontSize: "12px" }}>Generating WhatsApp QR...</span>
                          </div>
                        ) : qrCodeDataUrl ? (
                          <img
                            src={qrCodeDataUrl}
                            alt="WhatsApp Multi-Device QR Code"
                            width={224}
                            height={224}
                            style={{ display: "block", borderRadius: "6px" }}
                          />
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "#666" }}>
                            <span style={{ fontSize: "12px" }}>No QR available</span>
                            <button type="button" className="btn" data-size="sm" onClick={handleRefreshQr}>
                              Reload QR
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", textAlign: "center", maxWidth: "340px", lineHeight: 1.4 }}>
                        1. Open WhatsApp on your phone<br />
                        2. Tap <strong>Menu (⋮)</strong> or <strong>Settings</strong> &gt; <strong>Linked Devices</strong><br />
                        3. Tap <strong>Link a Device</strong> and point your camera at this code
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--accent)" }}>
                        <span className="dot" style={{ background: "var(--accent)" }} />
                        <span>Live scanner waiting for scan...</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "10px 0" }}>
                      <div className="field" style={{ width: "100%" }}>
                        <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                          Enter Your WhatsApp Number (with country code)
                        </label>
                        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                          <input
                            type="tel"
                            className="input"
                            placeholder="+91 98765 43210"
                            value={qrPhoneInput}
                            onChange={(e) => setQrPhoneInput(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="btn"
                            data-variant="primary"
                            data-size="sm"
                            disabled={isRequestingCode || !qrPhoneInput.trim()}
                            onClick={handleRequestPairingCode}
                          >
                            {isRequestingCode ? "Requesting..." : "Get Code"}
                          </button>
                        </div>
                      </div>

                      {qrPairingCode && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                          <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "var(--text-tertiary)" }}>
                            Your WhatsApp 8-Digit Pairing Code
                          </div>
                          <div
                            style={{
                              fontSize: "24px",
                              fontWeight: 700,
                              letterSpacing: "4px",
                              color: "var(--accent)",
                              background: "var(--bg-soft)",
                              padding: "8px 20px",
                              borderRadius: "8px",
                              border: "1px dashed var(--accent)",
                              fontFamily: "monospace",
                            }}
                          >
                            {qrPairingCode}
                          </div>
                          <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", textAlign: "center", maxWidth: "320px" }}>
                            In WhatsApp &gt; <strong>Linked Devices</strong> &gt; <strong>Link with phone number instead</strong> &gt; enter this code.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {qrSuccess && (
                <div className="chip" data-tone="success" style={{ padding: "6px 10px", fontSize: "12px" }}>
                  {qrSuccess}
                </div>
              )}
              {qrError && (
                <p className="form-error" style={{ margin: 0, fontSize: "11.5px" }}>{qrError}</p>
              )}
            </div>

            <footer className="dialog-foot">
              <button type="button" className="btn" onClick={() => setShowQrModal(false)}>
                Close
              </button>
              {waDeviceStatus !== "CONNECTED" && qrPairingMethod === "qr" && (
                <button
                  type="button"
                  className="btn"
                  data-variant="ghost"
                  disabled={qrLoading}
                  onClick={handleRefreshQr}
                >
                  <Icon name="refresh" size={13} className={qrLoading ? "spin" : ""} /> Refresh QR
                </button>
              )}
            </footer>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal (Recycle Bin) */}
      {showBulkDeleteModal && (
        <div className="overlay" data-kind="dialog" onClick={() => setShowBulkDeleteModal(false)}>
          <div className="dialog" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <header className="dialog-head">
              <div className="dialog-icon" style={{ color: "var(--danger)" }}>
                <Icon name="trash" size={16} />
              </div>
              <h2>Move {selectedChatIds.size} Selected to Recycle Bin?</h2>
              <button type="button" className="icon-btn" onClick={() => setShowBulkDeleteModal(false)}>
                <Icon name="close" size={14} />
              </button>
            </header>
            <div className="dialog-body">
              <p style={{ fontSize: "var(--fs-meta)", color: "var(--text)", margin: 0, lineHeight: 1.5 }}>
                Move <strong>{selectedChatIds.size}</strong> selected chat(s) and linked contact(s) to Recycle Bin?
              </p>
              <div className="chip" data-tone="warning" style={{ width: "100%", height: "auto", padding: "8px 10px", whiteSpace: "normal", fontSize: "11px" }}>
                Soft-deleted items are safely preserved in the workspace Recycle Bin and can be restored by workspace administrators within 30 days.
              </div>
            </div>
            <footer className="dialog-foot">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isDeletingBulk}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="danger"
                disabled={isDeletingBulk || selectedChatIds.size === 0}
                onClick={handleConfirmBulkDelete}
              >
                {isDeletingBulk ? "Moving..." : `Delete (${selectedChatIds.size})`}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Single Chat Soft-Delete Modal (Recycle Bin) */}
      {singleDeleteChat && (
        <div className="overlay" data-kind="dialog" onClick={() => setSingleDeleteChat(null)}>
          <div className="dialog" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <header className="dialog-head">
              <div className="dialog-icon" style={{ color: "var(--danger)" }}>
                <Icon name="trash" size={16} />
              </div>
              <h2>Move Chat & Contact to Recycle Bin?</h2>
              <button type="button" className="icon-btn" onClick={() => setSingleDeleteChat(null)}>
                <Icon name="close" size={14} />
              </button>
            </header>
            <div className="dialog-body">
              <p style={{ fontSize: "var(--fs-meta)", color: "var(--text)", margin: 0, lineHeight: 1.5 }}>
                Move conversation with <strong>{singleDeleteChat.customerName}</strong> ({singleDeleteChat.phone || "No phone"}) and linked contact to Recycle Bin?
              </p>
              <div className="chip" data-tone="warning" style={{ width: "100%", height: "auto", padding: "8px 10px", whiteSpace: "normal", fontSize: "11px" }}>
                Soft-deleted chats and contacts are safely archived in the Recycle Bin and can be restored by administrators.
              </div>
            </div>
            <footer className="dialog-foot">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => setSingleDeleteChat(null)}
                disabled={isDeletingSingle}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="danger"
                disabled={isDeletingSingle}
                onClick={handleConfirmSingleDelete}
              >
                {isDeletingSingle ? "Moving..." : "Move to Recycle Bin"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Schedule Callback Modal */}
      {callbackModalChat && (
        <div className="overlay" data-kind="dialog" onClick={() => setCallbackModalChat(null)}>
          <div className="dialog" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <header className="dialog-head">
              <div className="dialog-icon" style={{ color: "var(--accent)" }}>
                <Icon name="calendar-clock" size={16} />
              </div>
              <h2>Schedule Callback</h2>
              <button type="button" className="icon-btn" onClick={() => setCallbackModalChat(null)}>
                <Icon name="close" size={14} />
              </button>
            </header>
            <div className="dialog-body">
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Set up a callback reminder for <strong>{callbackModalChat.customerName}</strong> ({callbackModalChat.phone || "Direct"}).
              </div>
              <div className="field">
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Callback Date & Time
                </label>
                <input
                  type="datetime-local"
                  className="input"
                  value={callbackDateTime}
                  onChange={(e) => setCallbackDateTime(e.target.value)}
                />
              </div>
              <div className="field">
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Follow-up Note / Context
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Follow up on demo feedback & invoice"
                  value={callbackNote}
                  onChange={(e) => setCallbackNote(e.target.value)}
                />
              </div>
            </div>
            <footer className="dialog-foot">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => setCallbackModalChat(null)}
                disabled={schedulingCallback}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                disabled={!callbackDateTime || schedulingCallback}
                onClick={handleConfirmScheduleCallback}
              >
                {schedulingCallback ? "Scheduling..." : "Save Callback"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Meta WhatsApp 24-Hour Service Window Template Selection Modal */}
      {showTemplateModal && (
        <div className="overlay" data-kind="dialog" onClick={() => setShowTemplateModal(false)}>
          <div className="dialog" style={{ maxWidth: 580, width: "95vw" }} onClick={(e) => e.stopPropagation()}>
            <header className="dialog-head">
              <div className="dialog-icon" style={{ color: "var(--accent)" }}>
                <Icon name="sparkle" size={16} />
              </div>
              <h2>Send Approved WhatsApp Template</h2>
              <button type="button" className="icon-btn" onClick={() => setShowTemplateModal(false)}>
                <Icon name="close" size={14} />
              </button>
            </header>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                The Meta 24-hour customer service window for <strong>{activeChat?.customerName || "this contact"}</strong> is currently closed.
                Selecting and sending a pre-approved template will re-open the 24-hour communication window once they reply.
              </div>

              {/* Template Search Filter */}
              <div className="field">
                <input
                  type="text"
                  className="input"
                  placeholder="Search approved templates..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Templates List */}
              {loadingTemplates ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "32px", color: "var(--text-tertiary)", fontSize: "12px" }}>
                  <Icon name="sparkle" size={14} /> Loading Meta approved templates...
                </div>
              ) : (
                (() => {
                  const filtered = templates.filter(
                    (t) =>
                      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      t.bodyText.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      t.category.toLowerCase().includes(templateSearch.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="empty" style={{ padding: "32px 16px" }}>
                        <div className="empty-icon">
                          <Icon name="sparkle" size={18} />
                        </div>
                        <div className="empty-title" style={{ fontSize: "13px" }}>No Approved Templates Found</div>
                        <div className="empty-desc" style={{ fontSize: "11px" }}>
                          No templates matched your search. Check Marketing &gt; Templates to sync WhatsApp templates.
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="template-list">
                      {filtered.map((tmpl) => {
                        const isSelected = selectedTemplate?.id === tmpl.id || selectedTemplate?.name === tmpl.name;
                        return (
                          <div
                            key={tmpl.id}
                            className="template-item"
                            data-selected={isSelected}
                            onClick={() => setSelectedTemplate(tmpl)}
                          >
                            <div className="template-item-head">
                              <span className="template-item-name">{tmpl.name}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span className="chip" data-tone="accent" style={{ fontSize: "10px", padding: "1px 6px" }}>
                                  {tmpl.category}
                                </span>
                                <span className="chip" data-tone="success" style={{ fontSize: "10px", padding: "1px 6px" }}>
                                  {tmpl.language}
                                </span>
                              </div>
                            </div>
                            <div className="template-item-body">{tmpl.bodyText || "(No body preview available)"}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
            <footer className="dialog-foot">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => setShowTemplateModal(false)}
                disabled={isSendingTemplate}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                disabled={!selectedTemplate || isSendingTemplate}
                onClick={handleSendTemplate}
              >
                {isSendingTemplate ? "Sending Template..." : "Send Approved Template"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
