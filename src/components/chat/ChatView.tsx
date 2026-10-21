"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CURRENT_USER, useApp } from "@/lib/store";
import { STAGES, type StageId } from "@/lib/types";
import { aicloserApi } from "@/lib/api-client";
import { isScannedWhatsAppLead } from "@/lib/lead-mapper";
import { LeadCommandHistory } from "@/components/pipeline/LeadCommandHistory";

interface ChatMessage {
  id: string;
  sender: "customer" | "closer" | "system";
  senderName?: string;
  text: string;
  time: string;
  createdAt?: string;
  channel?: "whatsapp" | "instagram" | "website";
  status?: "sent" | "delivered" | "read";
}

interface ConversationItem {
  id: string;
  leadId: string;
  customerName: string;
  company: string;
  phone: string;
  channel: "whatsapp" | "instagram" | "website";
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

const QUICK_MACROS = [
  { label: "Callback", text: "I have scheduled a callback for you. Our specialist will connect with you shortly!" },
  { label: "Pricing Sheet", text: "Sharing our complete package comparison. Standard: ₹48k/mo, Pro CRM + Telephony: ₹96k/mo." },
  { label: "UPI Payment QR", text: "You can complete your onboarding advance payment securely via UPI: upi://pay?pa=sales@aicloser&pn=AICloser" },
  { label: "Follow-up", text: "Just checking in regarding our discussion earlier. Would 4:00 PM today work for a brief follow-up call?" },
];

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
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine" | "unassigned">("all");
  const [search, setSearch] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const urlId = sp.get("id") || sp.get("chatId");
      if (urlId) setSelectedChatId(urlId);
    }
  }, []);
  const [inputText, setInputText] = useState("");
  const [showRightDrawer, setShowRightDrawer] = useState(true);
  const [aiAutoReply, setAiAutoReply] = useState(true);
  const [universalAiEnabled, setUniversalAiEnabled] = useState<boolean | null>(null);
  const [togglingAiReply, setTogglingAiReply] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<"history" | "note" | "callback" | "calls">("history");
  const [leadPayment, setLeadPayment] = useState<any>(null);

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
    return conversations.find((c) => c.id === selectedChatId) || conversations[0] || null;
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
    if (!activeLeadProfile?.phone) {
      setLeadPayment(null);
      return;
    }
    let active = true;
    aicloserApi.payments
      .list({ search: activeLeadProfile.phone, limit: 5 } as any)
      .then((res: any) => {
        if (!active) return;
        const payments = res?.payments || [];
        const matching =
          payments.find(
            (p: any) =>
              p.customerPhone === activeLeadProfile.phone ||
              (activeLeadProfile.name && p.customerName?.toLowerCase() === activeLeadProfile.name.toLowerCase())
          ) || payments[0] || null;
        setLeadPayment(matching);
      })
      .catch(() => {
        if (active) setLeadPayment(null);
      });
    return () => {
      active = false;
    };
  }, [activeLeadProfile?.phone, activeLeadProfile?.name]);

  const filteredConversations = useMemo(() => {
    const myName = (state.user?.displayName || CURRENT_USER).toLowerCase();
    const isAgentScope = state.scope.startsWith("agent:");
    const targetAgent = isAgentScope ? state.scope.slice(6).trim().toLowerCase() : null;

    return conversations.filter((c) => {
      const matchChannel = channelFilter === "all" || c.channel === channelFilter;

      let matchScope = true;
      if (targetAgent) {
        // Scoped to a specific teammate selected in topbar: show that teammate's chats!
        const assigned = (c.assignedTo || "").toLowerCase();
        matchScope = assigned.includes(targetAgent) || assigned === targetAgent;
      } else if (scopeFilter === "mine") {
        matchScope = c.assignedTo.toLowerCase() === myName || c.assignedTo === CURRENT_USER;
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

  // Load conversations from live backend API + merge scanned WhatsApp conversations
  useEffect(() => {
    let active = true;

    const fetchAllConversations = () => {
      // Build scanned WhatsApp conversations from state.leads
      const scannedList: ConversationItem[] = state.leads
        .filter((l) => isScannedWhatsAppLead(l))
        .map((l) => {
          const cleanPhone = l.phone || "";
          const rawNote = l.notes || "";
          const snippet =
            rawNote.replace(/^Synced with chat history via WA Business Scanner:\s*"?|"?$/g, "") ||
            "Recent WhatsApp conversation";
          const actualConvId =
            (l as any).conversationId ||
            (l.id.startsWith("sales-conversation-") ? l.id.replace(/^sales-conversation-/, "") : l.id);
          return {
            id: actualConvId,
            leadId: l.id,
            customerName: l.name && !l.name.startsWith("+") ? l.name : cleanPhone || "WhatsApp Contact",
            company: l.company || "WhatsApp Business Lead",
            phone: cleanPhone,
            channel: "whatsapp" as const,
            lastMessage: snippet,
            lastMessageTime: formatMessageTime(l.updatedAt),
            updatedAt: l.updatedAt,
            unreadCount: 0,
            assignedTo: l.owner || "Unassigned",
            messages: [
              {
                id: `msg-${l.id}-1`,
                sender: "customer" as const,
                text: snippet,
                time: formatMessageTime(l.updatedAt),
                status: "read" as const,
              },
            ],
          };
        });

      aicloserApi.conversations
        .list({ limit: 200 })
        .then((res) => {
          if (!active) return;
          const apiMapped: ConversationItem[] = (res?.conversations || []).map((c: any) => ({
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
            lastMessage: c.lastMessageSnippet || c.lastMessage?.body || "Conversation active",
            lastMessageTime: formatMessageTime(c.updatedAt || c.lastMessageTime),
            updatedAt: c.updatedAt,
            unreadCount: c.unreadCount || 0,
            assignedTo: c.assignedAgent?.displayName || "Unassigned",
            aiAutoReplyDisabled: Boolean(c.aiAutoReplyDisabled ?? c.payload?.aiAutoReplyDisabled),
            messages: [],
          }));

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
  }, [state.leads]);

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

  // Sync Per-Conversation AI Copilot status when active thread changes
  useEffect(() => {
    if (activeChat) {
      setAiAutoReply(!activeChat.aiAutoReplyDisabled);
    }
  }, [activeChat?.id, activeChat?.aiAutoReplyDisabled]);

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
              };
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
                  (m.text === newChatMessage.text &&
                    Math.abs(new Date(m.createdAt || 0).getTime() - new Date(newChatMessage.createdAt || 0).getTime()) < 3000)
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
                (m.text === newChatMessage.text &&
                  Math.abs(new Date(m.createdAt || 0).getTime() - new Date(newChatMessage.createdAt || 0).getTime()) < 3000)
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
                messages: c.messages.map((m) => (m.id === wamid ? { ...m, status: mappedStatus } : m)),
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
              };
            });

          setMessagesCache((prev) => {
            const prevMsgs = prev[activeChat.id] || [];
            if (
              prevMsgs.length === mappedMessages.length &&
              prevMsgs[prevMsgs.length - 1]?.id === mappedMessages[mappedMessages.length - 1]?.id
            ) {
              return prev;
            }
            return { ...prev, [activeChat.id]: mappedMessages };
          });

          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== activeChat.id) return c;
              if (
                c.messages.length === mappedMessages.length &&
                c.messages[c.messages.length - 1]?.id === mappedMessages[mappedMessages.length - 1]?.id
              ) {
                return c;
              }
              return { ...c, messages: mappedMessages };
            })
          );
        })
        .catch(() => {});
    }, 6000);

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

  const handleToggleUniversalAi = async () => {
    const nextVal = universalAiEnabled === false ? true : false;
    setUniversalAiEnabled(nextVal);
    showToast(nextVal ? "Universal AI Bot is now Active globally" : "Universal AI Bot is now Paused globally");
    try {
      await aicloserApi.ai.updateBotConfig({ enabled: nextVal });
    } catch (err: any) {
      setUniversalAiEnabled(!nextVal);
      showToast("Failed to toggle Universal AI bot");
    }
  };

  const handleApplyMacro = (text: string) => {
    setInputText(text);
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

  // Share & Assign Modals State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareTargetUser, setShareTargetUser] = useState("Admin");
  const [sharePermission, setSharePermission] = useState<"VIEW" | "REPLY">("REPLY");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [activeShares, setActiveShares] = useState<Array<{ id: string; userId: string; userName?: string; permission: string }>>([]);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetCloser, setAssignTargetCloser] = useState("Admin");
  const [assignHandoverNote, setAssignHandoverNote] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; role?: string }>>([]);

  // Dynamically load all team members, closers, managers, and admins from live APIs & workspace
  useEffect(() => {
    let active = true;

    async function loadTeam() {
      const found = new Map<string, { id: string; name: string; role?: string }>();

      // 1. Prepopulate from current user and distinct lead owners
      found.set("admin", { id: "admin", name: "Admin", role: "Super Admin" });
      if (state.user?.displayName) {
        found.set(state.user.displayName.toLowerCase(), {
          id: state.user.userId || state.user.displayName,
          name: state.user.displayName,
          role: state.user.role || "User",
        });
      }
      state.leads.forEach((l) => {
        if (l.owner && l.owner !== "Unassigned" && !found.has(l.owner.toLowerCase())) {
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
          const name = m.displayName || m.name || m.user?.displayName || m.email;
          if (name && !found.has(name.toLowerCase())) {
            found.set(name.toLowerCase(), {
              id: m.id || m.userId || name,
              name,
              role: m.role || "Agent",
            });
          }
        });
      } catch {}

      // 3. Query modern live /api/v1/team endpoint
      try {
        const teamRes: any = await aicloserApi.team.list();
        const members = Array.isArray(teamRes?.data) ? teamRes.data : Array.isArray(teamRes) ? teamRes : [];
        members.forEach((m: any) => {
          const name = m.name || m.displayName || m.email;
          if (name && !found.has(name.toLowerCase())) {
            found.set(name.toLowerCase(), {
              id: m.id || m.userId || name,
              name,
              role: m.role || "Sales Closer",
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
    try {
      await aicloserApi.conversations.share(activeChat.id, shareTargetUser, sharePermission);
      setActiveShares((prev) => [
        ...prev.filter((s) => s.userId !== shareTargetUser),
        { id: `share-${Date.now()}`, userId: shareTargetUser, userName: shareTargetUser, permission: sharePermission },
      ]);
      setShareSuccess(`Shared with ${shareTargetUser} (${sharePermission === "REPLY" ? "Can Reply" : "View Only"}).`);
      setTimeout(() => setShareSuccess(null), 2500);
    } catch {
      setActiveShares((prev) => [
        ...prev.filter((s) => s.userId !== shareTargetUser),
        { id: `share-${Date.now()}`, userId: shareTargetUser, userName: shareTargetUser, permission: sharePermission },
      ]);
      setShareSuccess(`Shared with ${shareTargetUser}.`);
      setTimeout(() => setShareSuccess(null), 2500);
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
      // 1. Live API: assign conversation on Central API
      await aicloserApi.conversations.assign(activeChat.id, assignTargetCloser).catch(() => {});

      // 2. Local Next.js API: update assignment in local DB / dummy store
      await fetch(`/api/conversations/${encodeURIComponent(activeChat.id)}/assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freelancerId: assignTargetCloser,
          assignmentMode: "replace",
          handoverNote: assignHandoverNote || undefined,
        }),
      }).catch(() => {});

      // 3. If lead is linked in state, update lead owner
      if (activeLead) {
        reassignLead(activeLead.id, assignTargetCloser, assignHandoverNote);
      }

      // 4. Add system message in conversation thread
      const sysMsg: ChatMessage = {
        id: `sys-assign-${Date.now()}`,
        sender: "system",
        text: `Chat assigned to ${assignTargetCloser} by ${state.user?.displayName || CURRENT_USER}${assignHandoverNote ? ` (${assignHandoverNote})` : ""}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        createdAt: new Date().toISOString(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? { ...c, assignedTo: assignTargetCloser, messages: [...c.messages, sysMsg] }
            : c
        )
      );

      setAssignSuccess(`Chat assigned to ${assignTargetCloser}.`);
      setTimeout(() => {
        setAssignSuccess(null);
        setShowAssignModal(false);
      }, 1000);
    } catch (err: any) {
      setAssignError(err?.message || "Could not assign chat.");
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
          width: "320px",
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-sidebar)",
          height: "100%",
          minHeight: 0,
        }}
      >
        {/* Header with Search */}
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650, margin: 0 }}>Inbox</h2>
              {state.scope.startsWith("agent:") && (
                <div style={{ fontSize: "11px", color: "var(--accent)", marginTop: "2px", fontWeight: 550 }}>
                  Viewing: {state.scope.slice(6)}&apos;s Chats
                </div>
              )}
            </div>
            <div className="seg" style={{ transform: "scale(0.9)", transformOrigin: "right center" }}>
              <button
                data-on={scopeFilter === "all" && !state.scope.startsWith("agent:")}
                onClick={() => {
                  setScopeFilter("all");
                  if (state.scope.startsWith("agent:")) setScope("all");
                }}
              >
                All
              </button>
              <button
                data-on={scopeFilter === "mine" || state.scope === "mine"}
                onClick={() => {
                  setScopeFilter("mine");
                  setScope("mine");
                }}
              >
                Mine
              </button>
            </div>
          </div>

          <div className="search" style={{ width: "100%" }}>
            <Icon name="search" size={13} />
            <input
              placeholder="Search chat or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: "var(--fs-caption)" }}
            />
          </div>

          {/* Channel Filters */}
          <div style={{ display: "flex", gap: "4px" }}>
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
                style={{ height: "24px", fontSize: "11px", padding: "0 7px" }}
              >
                {ch.label}
              </button>
            ))}
          </div>

          {/* Universal AI Status Quick Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 8px",
              background: "var(--bg-panel)",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              fontSize: "11px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                className="dot"
                style={{
                  background: universalAiEnabled === false ? "var(--warning)" : "var(--success)",
                }}
              />
              <span style={{ color: "var(--text-secondary)" }}>Universal AI:</span>
              <strong style={{ color: universalAiEnabled === false ? "var(--warning)" : "var(--success)" }}>
                {universalAiEnabled === false ? "Paused" : "Active"}
              </strong>
            </div>
            <button
              className="btn"
              data-size="sm"
              data-variant="ghost"
              onClick={handleToggleUniversalAi}
              style={{ height: "20px", fontSize: "10px", padding: "0 6px" }}
              title="Toggle Universal Bot across all channels without leaving chat"
            >
              {universalAiEnabled === false ? "Resume Global" : "Pause Global"}
            </button>
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

                    {/* Badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "5px" }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 650, fontSize: "var(--fs-body)", color: "var(--text)" }}>
                    {activeChat.customerName}
                  </span>
                  <span className="chip" data-tone="accent" style={{ fontSize: "11px", padding: "1px 6px" }}>
                    <Icon name={channelIcon[activeChat.channel]} size={11} /> {activeChat.channel.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)" }}>
                  {activeChat.company} • {activeChat.phone}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* AI Assistant Toggle */}
              <button
                className="btn"
                data-size="sm"
                data-variant={aiAutoReply ? "accent" : "ghost"}
                onClick={handleToggleAiAutoReply}
                disabled={togglingAiReply}
                title={
                  aiAutoReply
                    ? "AI Copilot is auto-replying to this contact. Click to pause (Human Takeover mode)."
                    : "AI Copilot is paused for this contact. Click to resume."
                }
              >
                <Icon name="sparkle" size={12} /> AI Copilot {aiAutoReply ? "On" : "Paused"}
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
                onClick={() => setShowAssignModal(true)}
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
                          ⚡ {msg.text} • {msg.time}
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
          <div
            style={{
              padding: "8px 18px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-surface)",
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>Quick Macros:</span>
            {QUICK_MACROS.map((m) => (
              <button
                key={m.label}
                className="btn"
                data-size="sm"
                onClick={() => handleApplyMacro(m.text)}
                style={{ height: "24px", fontSize: "11px", padding: "0 8px" }}
              >
                {m.label}
              </button>
            ))}
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
            width: "300px",
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
          }}
        >
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

          {/* Payment & Collection Status */}
          <div className="card" style={{ padding: "12px", background: "var(--bg-surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                Payment Status
              </label>
              {leadPayment ? (
                <span
                  className="chip"
                  data-tone={leadPayment.status === "PAID" ? "success" : leadPayment.status === "CUSTOMER_CONFIRMED" ? "accent" : "warning"}
                  style={{ fontSize: "10px", padding: "1px 6px" }}
                >
                  {leadPayment.status === "PAID" ? "Paid" : leadPayment.status === "CUSTOMER_CONFIRMED" ? "Proof Submitted" : "Pending"}
                </span>
              ) : (
                <span className="chip" data-tone="neutral" style={{ fontSize: "10px", padding: "1px 6px" }}>
                  Unbilled
                </span>
              )}
            </div>

            {leadPayment ? (
              <div style={{ marginTop: "6px" }}>
                <div style={{ fontSize: "var(--fs-metric)", fontWeight: 700 }}>
                  ₹{Number(leadPayment.totalAmount || leadPayment.baseAmount || 0).toLocaleString("en-IN")}
                </div>
                {leadPayment.productName &&
                !leadPayment.productName.toLowerCase().includes("auto-created") &&
                !leadPayment.productName.toLowerCase().includes("enrich this contact") && (
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                    {leadPayment.productName}
                  </div>
                )}
                {leadPayment.publicToken && (
                  <div className="drawer-contact-row" style={{ marginTop: "8px" }}>
                    <div className="drawer-contact-label">
                      <Icon name="link" size={12} />
                      <span style={{ fontSize: "11px" }}>/pay/{leadPayment.publicToken.slice(0, 8)}...</span>
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
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px" }}>
                No active payment link generated for this contact.
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
                <Icon name="link" size={15} /> Share Conversation
              </h2>
              <button type="button" className="icon-btn" onClick={() => setShowShareModal(false)}>
                <Icon name="close" size={14} />
              </button>
            </header>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Direct Link */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Direct Chat Link
                </label>
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  <input
                    className="input"
                    readOnly
                    value={typeof window !== "undefined" ? `${window.location.origin}/chat?id=${activeChat.id}` : ""}
                    style={{ flex: 1, fontSize: "12px" }}
                  />
                  <button
                    type="button"
                    className="btn"
                    data-size="sm"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        navigator.clipboard?.writeText(`${window.location.origin}/chat?id=${activeChat.id}`);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      }
                    }}
                  >
                    <Icon name={shareCopied ? "check" : "copy"} size={13} /> {shareCopied ? "Copied" : "Copy Link"}
                  </button>
                </div>
              </div>

              {/* Share with Team Member via Central API */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  Share Access with Team Closer / Admin
                </label>
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  <select
                    className="select"
                    value={shareTargetUser}
                    onChange={(e) => setShareTargetUser(e.target.value)}
                    style={{ flex: 1, height: "32px", fontSize: "12px" }}
                  >
                    {availableClosers.filter((u) => u !== activeChat.assignedTo).map((u) => {
                      const member = teamMembers.find((m) => m.name === u);
                      return (
                        <option key={u} value={u}>
                          {u} {member?.role ? `(${member.role})` : ""}
                        </option>
                      );
                    })}
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
                {shareSuccess && (
                  <span className="pill" style={{ color: "var(--accent-strong)", background: "var(--bg-soft)", fontSize: "11px", marginTop: "6px", display: "inline-block" }}>
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
                  {availableClosers.map((u) => {
                    const member = teamMembers.find((m) => m.name === u);
                    return (
                      <option key={u} value={u}>
                        {u} {member?.role ? `(${member.role})` : ""}
                      </option>
                    );
                  })}
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
                disabled={assignLoading || assignTargetCloser === activeChat.assignedTo}
                onClick={handleAssignChat}
              >
                {assignLoading ? "Assigning..." : "Confirm Assignment"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
