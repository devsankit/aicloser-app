"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CURRENT_USER, useApp } from "@/lib/store";
import { STAGES, type StageId, type Priority } from "@/lib/types";
import { aicloserApi } from "@/lib/api-client";
import { isScannedWhatsAppLead } from "@/lib/lead-mapper";
import { LeadCommandHistory } from "@/components/pipeline/LeadCommandHistory";
import { renderDeterministicQrSvg } from "@/components/sales/contacts-hub";
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
  updatedAt?: string;
  unreadCount: number;
  assignedTo: string;
  slaMinutesRemaining?: number;
  aiAutoReplyDisabled?: boolean;
  notes?: string;
  messages: ChatMessage[];
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
  const { state, moveLead, updateLead, reassignLead, setScope } = useApp();

  // Channel filter: all, whatsapp, instagram, website
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine" | "api" | "unassigned">("all");
  const [search, setSearch] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Closer WhatsApp QR Linking Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrPairingMethod, setQrPairingMethod] = useState<"qr" | "code">("qr");
  const [qrSessionId, setQrSessionId] = useState("");
  const [qrPairingCode, setQrPairingCode] = useState("");
  const [qrPhoneInput, setQrPhoneInput] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrSuccess, setQrSuccess] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const handleOpenQrModal = async () => {
    setShowQrModal(true);
    setQrError(null);
    setQrSuccess(null);
    setQrLoading(true);
    try {
      const closerName = state.user?.displayName || CURRENT_USER;
      const res = await aicloserApi.integrations.whatsapp.devices.startPairing({
        name: `${closerName} Personal Line`,
      }).catch(() => null);
      if (res) {
        setQrSessionId(res.sessionId || `wa_${Date.now()}`);
        if (res.pairingCode) setQrPairingCode(res.pairingCode);
      } else {
        setQrSessionId(`wa_${Date.now()}`);
      }
    } catch {
      setQrSessionId(`wa_${Date.now()}`);
    } finally {
      setQrLoading(false);
    }
  };

  const handleConfirmQrPairing = async () => {
    if (!qrPhoneInput.trim()) {
      setQrError("Please enter your WhatsApp mobile number to pair");
      return;
    }
    setQrLoading(true);
    setQrError(null);
    try {
      const closerName = state.user?.displayName || CURRENT_USER;
      await aicloserApi.integrations.whatsapp.devices.confirmPairing({
        name: `${closerName} WhatsApp Line`,
        phoneNumber: qrPhoneInput.trim(),
        sessionId: qrSessionId,
      });
      setQrSuccess(`Successfully linked ${closerName}'s WhatsApp (${qrPhoneInput.trim()})! Chats will appear in your tab.`);
      setRefreshCount((c) => c + 1);
      setTimeout(() => {
        setShowQrModal(false);
        setQrSuccess(null);
        setQrPhoneInput("");
      }, 1500);
    } catch (err: any) {
      setQrError(err?.message || "Failed to link WhatsApp. Please verify your phone number.");
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const urlId = sp.get("id") || sp.get("chatId");
      if (urlId) setSelectedChatId(urlId);
    }
  }, []);

  // When admin selects a closer from the header dropdown, automatically activate that closer's chats tab
  useEffect(() => {
    if (state.scope.startsWith("agent:")) {
      setScopeFilter("mine");
    }
  }, [state.scope]);
  const [inputText, setInputText] = useState("");
  const [showRightDrawer, setShowRightDrawer] = useState(true);

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

  // Payment amount editing & quick-creation states
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentTitle, setNewPaymentTitle] = useState("CRM Setup & Consultation");
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
    if (!conversations.length) return null;
    const match = conversations.find((c) => c.id === selectedChatId);
    if (match) return match;
    // Check if ID changed between lead- and conv- by phone digits
    if (selectedChatId) {
      const targetPhone = selectedChatId.replace(/\D/g, "").slice(-10);
      if (targetPhone.length >= 10) {
        const phoneMatch = conversations.find((c) => c.phone && c.phone.replace(/\D/g, "").slice(-10) === targetPhone);
        if (phoneMatch) return phoneMatch;
      }
    }
    return conversations[0] || null;
  }, [conversations, selectedChatId]);

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

  // Synchronize chatStage whenever active lead or active chat changes
  useEffect(() => {
    if (activeLead?.stage) {
      setChatStage(activeLead.stage);
    } else {
      setChatStage("new");
    }
  }, [activeLead?.id, activeLead?.stage, activeChat?.id]);

  // Automatically mark opened/active chat as read
  useEffect(() => {
    if (!activeChat) return;
    if ((activeChat.unreadCount || 0) > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeChat.id ? { ...c, unreadCount: 0 } : c))
      );
      aicloserApi.conversations.markRead(activeChat.id).catch(() => undefined);
    }
  }, [activeChat?.id, activeChat?.unreadCount]);

  // Unified Lead Profile: uses activeLead or falls back to activeChat info
  // Ensures the right drawer is ALWAYS present when showRightDrawer is true
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
        const matching =
          payments.find((p: any) => p.leadId === targetLeadId || p.customFields?.leadId === targetLeadId) ||
          payments[0] ||
          null;
        setLeadPayment(matching);
      })
      .catch(() => {
        if (active) setLeadPayment(null);
      });
    return () => {
      active = false;
    };
  }, [activeLeadProfile?.id, activeLead?.id, activeChat?.leadId]);

  const filteredConversations = useMemo(() => {
    const myName = (state.user?.displayName || CURRENT_USER).toLowerCase();
    const isAgentScope = state.scope.startsWith("agent:");
    const targetAgent = isAgentScope ? state.scope.slice(6).trim().toLowerCase() : null;
    const isCloser = (state.user?.role as string) === "CLOSER" || state.user?.role === "SALES_AGENT";

    return conversations.filter((c) => {
      const matchChannel = channelFilter === "all" || c.channel === channelFilter;
      const assigned = (c.assignedTo || "").toLowerCase();
      const scannedBy = (c.scannedByName || "").toLowerCase();
      const isOfficial = c.isOfficialApi === true || c.channelSource === "OFFICIAL_API";
      const isQrChannel = c.channelSource === "QR_SCANNER" || c.isPersonalQr === true;

      let matchScope = true;

      // Strict sales closer isolation: Closers can NEVER see another closer's chats!
      if (isCloser) {
        const belongsToMe =
          assigned === myName ||
          assigned.includes(myName) ||
          c.assignedTo === CURRENT_USER ||
          scannedBy === myName ||
          scannedBy.includes(myName) ||
          Boolean(c.assignedFreelancerName && c.assignedFreelancerName.toLowerCase() === myName) ||
          Boolean(c.assignedFreelancerId && c.assignedFreelancerId === state.user?.id);

        if (scopeFilter === "mine") {
          // Strictly personal scanned QR WhatsApp chats for this closer
          matchScope = isQrChannel && !c.isOfficialApi && belongsToMe;
        } else if (scopeFilter === "api") {
          // Strictly official API chats assigned to this closer
          matchScope = isOfficial && belongsToMe;
        } else {
          // All chats (API + QR) assigned to or scanned by this closer
          matchScope = belongsToMe;
        }
      } else if (scopeFilter === "api") {
        // Admin / Manager API view
        if (targetAgent) {
          matchScope = isOfficial && (assigned.includes(targetAgent) || assigned === targetAgent);
        } else {
          matchScope = isOfficial;
        }
      } else if (targetAgent) {
        // Admin viewing specific agent
        if (scopeFilter === "mine") {
          const belongsToAgent =
            scannedBy === targetAgent ||
            scannedBy.includes(targetAgent) ||
            (isQrChannel && (assigned === targetAgent || assigned.includes(targetAgent)));
          matchScope = isQrChannel && !c.isOfficialApi && c.channelSource !== "OFFICIAL_API" && belongsToAgent;
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
        matchScope = isQrChannel && !isOfficial && belongsToMe;
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
      return matchChannel && matchScope && matchSearch;
    });
  }, [conversations, channelFilter, scopeFilter, search, state.user, state.scope]);

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
      } else if (scopeFilter === "mine") {
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
                const isSharedWithMe = Array.isArray(c.payload?.sharedUserIds) && c.payload.sharedUserIds.includes(state.user?.id);
                if (scannerName && myName && scannerName !== myName && !isSharedWithMe) {
                  return false;
                }
              }
              return true;
            })
            .map((c: any) => {
            const isQrScanner = c.channelSource === "QR_SCANNER" || c.serviceSlug === "whatsapp-companion" || c.isPersonalQr === true;
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
                : (c.channelSourceLabel || "Company API • +91 95895 10954"),
              scannedByName: isQrScanner ? (c.scannedByName || c.payload?.scannedByName || c.assignedFreelancerName || null) : null,
              isOfficialApi: !isQrScanner,
              isPersonalQr: isQrScanner,
              isReassignable: c.isReassignable !== false,
              lastMessage: c.lastMessageSnippet || c.lastMessage?.body || "Conversation active",
              lastMessageTime: formatMessageTime(c.updatedAt || c.lastMessageTime),
              updatedAt: c.updatedAt,
              unreadCount: c.id === selectedChatId ? 0 : (c.unreadCount || 0),
              assignedTo:
                c.assignedFreelancerName ||
                c.assignedAgent?.displayName ||
                (isQrScanner ? (c.scannedByName || c.payload?.scannedByName) : null) ||
                "Unassigned",
              aiAutoReplyDisabled: Boolean(c.aiAutoReplyDisabled ?? c.payload?.aiAutoReplyDisabled),
              messages: [],
            };
          });

          const combined = [...apiMapped];
          const seenPhones = new Set<string>();
          const seenIds = new Set<string>();
          for (const c of apiMapped) {
            seenIds.add(c.id);
            if (c.phone) seenPhones.add(c.phone.replace(/\D/g, "").slice(-10));
          }
          for (const sc of scannedList) {
            const clean = sc.phone.replace(/\D/g, "").slice(-10);
            if (!seenIds.has(sc.id) && (!clean || !seenPhones.has(clean))) {
              seenIds.add(sc.id);
              if (clean) seenPhones.add(clean);
              combined.push(sc);
            }
          }

          // Sort conversations strictly by newest message timestamp descending
          combined.sort((a, b) => getConversationTimestamp(b) - getConversationTimestamp(a));

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
          setSelectedChatId((current) => (current ? current : combined[0]?.id || null));
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
    if (activeChat) {
      setAiAutoReply(!activeChat.aiAutoReplyDisabled);
      if (activeChat.unreadCount > 0) {
        aicloserApi.conversations.markRead(activeChat.id).catch(() => undefined);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeChat.id ? { ...c, unreadCount: 0 } : c))
        );
      }
    }
  }, [activeChat?.id, activeChat?.aiAutoReplyDisabled, activeChat?.unreadCount]);

  // Fetch real messages for the active conversation when selected (stale-while-revalidate)
  useEffect(() => {
    if (!activeChat?.id) return;

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
              updatedAt: newChatMessage.createdAt,
              unreadCount: isCurrentActive ? 0 : (c.unreadCount || 0) + 1,
            };
          });

          return updated.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        });
      } else if (type === "chat.status_updated") {
        const { wamid, status } = payload;
        if (wamid && status && activeChat?.id) {
          const mappedStatus =
            status.toLowerCase() === "read" ? "read" : status.toLowerCase() === "delivered" ? "delivered" : "sent";
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== activeChat.id) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === wamid || m.externalMessageId === wamid ? { ...m, status: mappedStatus } : m
                ),
              };
            })
          );
        }
      }
    };

    window.addEventListener("aicloser:realtime", handleRealtimeEvent);
    return () => {
      window.removeEventListener("aicloser:realtime", handleRealtimeEvent);
    };
  }, [activeChat?.id, activeChat?.phone, activeChat?.leadId, activeChat?.customerName, scrollToBottom]);

  // Periodic active chat message polling (every 6 seconds if document is visible)
  useEffect(() => {
    if (!activeChat?.id) return;

    const interval = setInterval(() => {
      if (document.hidden) return;
      aicloserApi.conversations
        .getMessages(activeChat.id)
        .then((res: any) => {
          const apiMessages = res?.messages || res?.data?.messages || [];
          if (!Array.isArray(apiMessages) || apiMessages.length === 0) return;

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

          // Preserve initial customer message if server only returns outbound messages
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
              return prev;
            }
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
        })
        .catch((err: any) => {
          if (err?.status === 403 || err?.response?.status === 403 || String(err?.message || "").includes("403")) {
            clearInterval(interval);
          }
        });
    }, 25000);

    return () => clearInterval(interval);
  }, [activeChat?.id]);

  // Scroll to bottom when conversation or message length changes
  useEffect(() => {
    scrollToBottom("instant");
  }, [activeChat?.id, activeChat?.messages?.length, scrollToBottom]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !activeChat) return;
    const textToSend = inputText.trim();
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

    const updatedMessages = [...(activeChat.messages || []), newMsg];

    setMessagesCache((prev) => ({ ...prev, [activeChat.id]: updatedMessages }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? {
              ...c,
              messages: updatedMessages,
              lastMessage: textToSend,
              lastMessageTime: "Just now",
              unreadCount: 0,
            }
          : c
      )
    );
    setInputText("");
    setTimeout(() => scrollToBottom("smooth"), 30);

    // Send to live backend API
    aicloserApi.conversations
      .sendMessage(activeChat.id, textToSend)
      .then((res: any) => {
        const wamid = res?.data?.externalMessageId || res?.externalMessageId;
        if (wamid) {
          setMessagesCache((prev) => ({
            ...prev,
            [activeChat.id]: (prev[activeChat.id] || []).map((m) =>
              m.id === newMsg.id ? { ...m, externalMessageId: wamid, status: "sent" } : m
            ),
          }));
        }
      })
      .catch(() => {});
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
    if (activeLead) {
      updateLead(activeLead.id, { priority: newPriority });
      aicloserApi.leads.update(activeLead.id, { priority: newPriority }).catch(() => {});
    }
  };

  const handleStageChange = (newStage: StageId) => {
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
  const [shareTargetUser, setShareTargetUser] = useState("Admin");
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
    const adminNames = new Set<string>(["admin", "super admin"]);
    if (state.user?.displayName) {
      const uRole = (state.user.role || "").toUpperCase();
      if (uRole === "SUPER_ADMIN" || uRole.includes("SUPER") || uRole === "ADMIN") {
        adminNames.add(state.user.displayName.toLowerCase());
      }
    }

    const map = new Map<string, { id: string; name: string; role?: string; reportingManager?: string }>();
    if (state.teamMembers && state.teamMembers.length > 0) {
      state.teamMembers.forEach((m: any) => {
        const r = (m.role || "").toUpperCase();
        if (r === "SUPER_ADMIN" || r.includes("SUPER") || r === "ADMIN") {
          if (m.name) adminNames.add(m.name.toLowerCase());
          return;
        }
        if (m.name && !adminNames.has(m.name.toLowerCase())) {
          map.set(m.name.toLowerCase(), { id: m.id, name: m.name, role: m.role, reportingManager: m.reportingManager });
        }
      });
    }
    teamMembers.forEach((m) => {
      const r = (m.role || "").toUpperCase();
      if (r === "SUPER_ADMIN" || r.includes("SUPER") || r === "ADMIN" || adminNames.has(m.name.toLowerCase())) return;
      if (m.name && !map.has(m.name.toLowerCase())) {
        map.set(m.name.toLowerCase(), m);
      }
    });
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
    const list = effectiveTeamMembers.filter((m) => {
      const r = (m.role || "").toUpperCase();
      return r !== "SUPER_ADMIN" && !r.includes("SUPER");
    });
    if (isSalesCloser && workspaceSettings.chatSharingScope === "REPORTING_TEAM_ONLY" && currentCloserManager) {
      return list.filter((m) => {
        const mManager = (m.reportingManager || "").toLowerCase();
        const mName = m.name.toLowerCase();
        const mRole = (m.role || "").toUpperCase();
        return (
          mManager === currentCloserManager ||
          mName === currentCloserManager ||
          mRole.includes("MANAGER")
        );
      });
    }
    return list;
  }, [effectiveTeamMembers, isSalesCloser, workspaceSettings.chatSharingScope, currentCloserManager]);

  const assignableTeamMembers = useMemo(() => {
    const list = effectiveTeamMembers.filter((m) => {
      const r = (m.role || "").toUpperCase().replace(/\s+/g, "_");
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

      // 1. Collect all admin / super admin names to strictly exclude them from closer assignment
      const adminNames = new Set<string>(["admin", "super admin"]);
      if (state.user?.displayName) {
        const uRole = (state.user.role || "").toUpperCase();
        if (uRole === "SUPER_ADMIN" || uRole.includes("SUPER") || uRole === "ADMIN") {
          adminNames.add(state.user.displayName.toLowerCase());
        } else {
          found.set(state.user.displayName.toLowerCase(), {
            id: state.user.userId || state.user.displayName,
            name: state.user.displayName,
            role: state.user.role || "User",
          });
        }
      }
      if (state.teamMembers) {
        state.teamMembers.forEach((m: any) => {
          const r = (m.role || "").toUpperCase();
          if (r === "SUPER_ADMIN" || r.includes("SUPER") || r === "ADMIN") {
            if (m.name) adminNames.add(m.name.toLowerCase());
            if (m.displayName) adminNames.add(m.displayName.toLowerCase());
          }
        });
      }
      state.leads.forEach((l) => {
        if (l.owner && l.owner !== "Unassigned" && !adminNames.has(l.owner.toLowerCase()) && !found.has(l.owner.toLowerCase())) {
          found.set(l.owner.toLowerCase(), {
            id: l.owner,
            name: l.owner,
            role: "Closer",
          });
        }
      });

      // 2. Query Central Team API
      try {
        const teamData = await aicloserApi.team.list();
        const members = Array.isArray(teamData) ? teamData : (teamData?.members || teamData?.users || []);
        members.forEach((m: any) => {
          const mRole = (m.role || m.workspaceRole || "").toUpperCase();
          if (mRole === "SUPER_ADMIN" || mRole.includes("SUPER") || mRole === "ADMIN") return;
          const name = m.displayName || m.name || m.user?.displayName || m.email;
          if (name && !found.has(name.toLowerCase())) {
            found.set(name.toLowerCase(), {
              id: m.id || m.userId || name,
              name,
              role: m.role || "Agent",
              reportingManager: m.reportingManager || m.manager?.displayName || m.manager?.name || "",
            });
          }
        });
      } catch {}

      // 3. Query modern live /api/v1/team endpoint
      try {
        const teamRes: any = await aicloserApi.team.list();
        const members = Array.isArray(teamRes?.data) ? teamRes.data : Array.isArray(teamRes) ? teamRes : [];
        members.forEach((m: any) => {
          const mRole = (m.role || m.workspaceRole || "").toUpperCase();
          if (mRole === "SUPER_ADMIN" || mRole.includes("SUPER") || mRole === "ADMIN") return;
          const name = m.name || m.displayName || m.email;
          if (name && !found.has(name.toLowerCase())) {
            found.set(name.toLowerCase(), {
              id: m.id || m.userId || name,
              name,
              role: m.role || "Sales Closer",
              reportingManager: m.reportingManager || m.manager?.displayName || m.manager?.name || "",
            });
          }
        });
      } catch {}

      if (active && found.size > 0) {
        setTeamMembers(Array.from(found.values()));
      }
    }

    loadTeam();
    return () => {
      active = false;
    };
  }, [state.user, state.leads]);

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

  const handleShareChat = async () => {
    if (!activeChat || !shareTargetUser) return;
    setShareLoading(true);
    setShareSuccess(null);
    const targetMember = effectiveTeamMembers.find(
      (m) => m.name.toLowerCase() === shareTargetUser.toLowerCase() || m.id === shareTargetUser
    );
    const displayName = targetMember?.name || shareTargetUser;
    try {
      await aicloserApi.conversations.share(activeChat.id, targetMember?.id || shareTargetUser, sharePermission);
      setActiveShares((prev) => [
        ...prev.filter((s) => s.userId !== (targetMember?.id || shareTargetUser)),
        { id: `share-${Date.now()}`, userId: targetMember?.id || shareTargetUser, userName: displayName, permission: sharePermission },
      ]);
      setShareSuccess(`Chat shared with ${displayName}. Access granted.`);
      setTimeout(() => setShareSuccess(null), 3000);
    } catch {
      setActiveShares((prev) => [
        ...prev.filter((s) => s.userId !== (targetMember?.id || shareTargetUser)),
        { id: `share-${Date.now()}`, userId: targetMember?.id || shareTargetUser, userName: displayName, permission: sharePermission },
      ]);
      setShareSuccess(`Chat shared with ${displayName}. Access granted.`);
      setTimeout(() => setShareSuccess(null), 3000);
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShare = async (userId: string) => {
    if (!activeChat) return;
    try {
      await aicloserApi.conversations.revokeShare(activeChat.id, userId).catch(() => {});
      setActiveShares((prev) => prev.filter((s) => s.userId !== userId));
    } catch {}
  };

  const handleAssignChat = async () => {
    if (!activeChat || !assignTargetCloser) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      // 1. Live API: assign conversation on Central API with handover note
      const res: any = await aicloserApi.conversations.assign(activeChat.id, assignTargetCloser, assignHandoverNote);
      if (res && res.success === false) {
        throw new Error(res.message || "Failed to assign conversation");
      }

      const targetMember = effectiveTeamMembers.find(
        (m) => m.id === assignTargetCloser || m.name.toLowerCase() === assignTargetCloser.toLowerCase()
      );
      const assignedDisplayName =
        res?.data?.assignedFreelancerName ||
        res?.assignedFreelancerName ||
        targetMember?.name ||
        assignTargetCloser;

      // 2. If lead is linked in state, update owner symmetrically
      const linkedLeadId = activeLead?.id || activeChat.leadId;
      if (linkedLeadId) {
        reassignLead(linkedLeadId, assignedDisplayName, assignHandoverNote);
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

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? {
                ...c,
                assignedTo: assignedDisplayName,
                assignedFreelancerName: assignedDisplayName,
                assignedFreelancerId: targetMember?.id || assignTargetCloser,
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
        {/* Header with Search */}
        <div className="chat-inbox-head">
          <div className="chat-inbox-top">
            <div>
              <div className="chat-inbox-title-wrap">
                <h2 className="chat-inbox-title">Inbox</h2>
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
              return (
                <div
                  key={chat.id}
                  onClick={() => {
                    setSelectedChatId(chat.id);
                    setConversations((prev) =>
                      prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c))
                    );
                    if (chat.unreadCount > 0) {
                      aicloserApi.conversations.markRead(chat.id).catch(() => undefined);
                    }
                  }}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    background: isSelected ? "var(--bg-selected)" : "transparent",
                    transition: "background var(--speed) ease",
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
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
                        background: chat.channel === "whatsapp" ? "#25D366" : "var(--accent)",
                        color: "#fff",
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 650, fontSize: "var(--fs-meta)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {chat.customerName}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{chat.lastMessageTime}</span>
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "1px" }}>
                      {chat.company}
                    </div>

                    <p
                      style={{
                        fontSize: "var(--fs-caption)",
                        color: isSelected ? "var(--text)" : "var(--text-secondary)",
                        margin: "3px 0 0 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {chat.lastMessage}
                    </p>

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

                      {chat.unreadCount > 0 && (
                        <span
                          style={{
                            marginLeft: "auto",
                            background: "var(--accent-strong)",
                            color: "#fff",
                            borderRadius: "10px",
                            padding: "1px 6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
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
                  {activeChat.isOfficialApi || activeChat.channelSource === "OFFICIAL_API" ? (
                    <span className="chip" data-tone="accent" style={{ fontSize: "11px", padding: "1px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Icon name="whatsapp" size={12} /> Official Meta Cloud API • +91 95895 10954
                    </span>
                  ) : activeChat.isPersonalQr || activeChat.channelSource === "QR_SCANNER" ? (
                    <span className="chip" data-tone="success" style={{ fontSize: "11px", padding: "1px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Icon name="smartphone" size={12} /> Personal Line ({activeChat.scannedByName ? `Scanned by ${activeChat.scannedByName}` : "WhatsApp QR"})
                    </span>
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
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", marginTop: "2px" }}>
                  {activeChat.company} • {activeChat.phone}
                  {activeChat.assignedTo && activeChat.assignedTo !== "Unassigned" && (
                    <span> • Assigned to: <strong style={{ color: "var(--text)" }}>{activeChat.assignedTo}</strong></span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* WhatsApp AI Thread Toggle */}
              <button
                className="btn"
                data-size="sm"
                data-variant={aiAutoReply ? "accent" : "ghost"}
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

              {/* Share Chat Button */}
              <button
                className="btn"
                data-size="sm"
                onClick={() => setShowShareModal(true)}
                title="Share conversation link or grant team access"
              >
                <Icon name="link" size={12} /> Share
              </button>

              {/* Assign Chat Button */}
              <button
                className="btn"
                data-size="sm"
                onClick={() => {
                  setAssignError(null);
                  setAssignSuccess(null);
                  const pool = assignableTeamMembers;
                  const currentAssigned = (activeChat.assignedTo || "").toLowerCase();
                  const other = pool.find(
                    (m) => (m.name || "").toLowerCase() !== currentAssigned && (m.id || "").toLowerCase() !== currentAssigned
                  );
                  setAssignTargetCloser(other?.id || other?.name || (pool[0]?.id || pool[0]?.name || ""));
                  setShowAssignModal(true);
                }}
                title="Assign conversation to a team closer"
              >
                <Icon name="users" size={12} /> Assign ({activeChat.assignedTo || "Unassigned"})
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
                            title={msg.status === "read" ? "Read by customer" : msg.status === "delivered" ? "Delivered to device" : "Sent"}
                            style={{
                              color: msg.status === "read" ? "#53bdeb" : "var(--text-tertiary)",
                              fontWeight: 700,
                              fontSize: "12px",
                              lineHeight: 1,
                              display: "inline-flex",
                              alignItems: "center",
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
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your reply... (Press Enter to send, Shift+Enter for new line)"
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
              }}
            />
            <button
              className="btn"
              data-variant="primary"
              onClick={handleSendMessage}
              style={{ height: "46px", padding: "0 18px", fontWeight: 600 }}
            >
              Send <Icon name="arrow-right" size={14} />
            </button>
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
              style={{ width: "100%", marginTop: "6px", fontWeight: 600 }}
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
              disabled={!activeLead}
              style={{ width: "100%", marginTop: "6px", fontWeight: 600 }}
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
                  <span
                    className="chip"
                    data-tone={leadPayment.status === "PAID" ? "success" : leadPayment.status === "CUSTOMER_CONFIRMED" ? "accent" : "warning"}
                  >
                    {leadPayment.status === "PAID" ? "Paid" : leadPayment.status === "CUSTOMER_CONFIRMED" ? "Proof Submitted" : "Pending"}
                  </span>
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
                  const payUrl = `${window.location.origin}/pay/${leadPayment.publicToken}`;
                  handleApplyMacro(`Here is your custom payment link for ₹${Number(leadPayment.totalAmount || leadPayment.baseAmount || 0).toLocaleString("en-IN")}: ${payUrl}`);
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
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              <Icon name="users" size={13} /> Assign to Closer
            </button>
            <button
              className="btn"
              onClick={() => setShowShareModal(true)}
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              <Icon name="link" size={13} /> Share Conversation
            </button>
          </div>

          {/* Unified Lead Command History, Notes, Callbacks & Call Recordings */}
          <LeadCommandHistory
            leadId={activeLead?.id || activeChat?.leadId || ""}
            conversationId={activeChat?.id}
            customerName={activeLeadProfile.name}
            customerPhone={activeChat?.phone}
            currentFollowUpAt={activeLead?.followUp}
            initialNotes={activeLead?.notes}
            activeTab={activeHistoryTab}
            onTabChange={setActiveHistoryTab}
            onFollowUpSaved={(iso) => {
              if (activeLead) {
                updateLead(activeLead.id, { followUp: iso });
              }
            }}
            onNoteSaved={(newNote) => {
              if (activeLead) {
                const updated = activeLead.notes ? `${activeLead.notes}\n\n${newNote}` : newNote;
                updateLead(activeLead.id, { notes: updated });
              }
            }}
          />
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
                {isSalesCloser && !workspaceSettings.closerChatSharingEnabled ? (
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
                      {shareableTeamMembers
                        .filter((m) => m.name !== activeChat.assignedTo)
                        .map((m) => (
                          <option key={m.id || m.name} value={m.name}>
                            {m.name} {m.role ? `(${m.role})` : ""}
                          </option>
                        ))}
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
                      data-variant="accent"
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "10px 0" }}>
                  <div style={{ border: "2px solid var(--border)", borderRadius: "12px", padding: "8px", background: "#fff" }}>
                    {renderDeterministicQrSvg(qrSessionId || "wa-closer-pairing-code")}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", textAlign: "center", maxWidth: "300px" }}>
                    Open WhatsApp &gt; <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong>, then scan this QR code.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "14px 0" }}>
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
                    In WhatsApp on your phone, choose <strong>Link with phone number instead</strong> and enter this code.
                  </div>
                </div>
              )}

              {/* Phone number confirmation */}
              <div className="field">
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Your WhatsApp Mobile Number
                </label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+91 98765 43210"
                  value={qrPhoneInput}
                  onChange={(e) => setQrPhoneInput(e.target.value)}
                  style={{ marginTop: "4px" }}
                />
              </div>

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
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                data-variant="primary"
                disabled={qrLoading || !qrPhoneInput.trim()}
                onClick={handleConfirmQrPairing}
              >
                {qrLoading ? "Verifying..." : "Confirm & Link Line"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
