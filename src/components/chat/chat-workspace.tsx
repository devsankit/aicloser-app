"use client";

import type { ReactNode } from "react";
import { Component, type ErrorInfo, Suspense, Fragment, memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import EmojiPicker, { EmojiStyle, Theme as EmojiPickerTheme, type EmojiClickData } from "emoji-picker-react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BadgeIndianRupee,
  BellRing,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  CircleEllipsis,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Filter,
  Flame,
  History,
  Instagram,
  MessageSquare,
  MessageSquareText,
  Mic,
  Pause,
  Paperclip,
  Phone,
  PhoneCall,
  PhoneForwarded,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Square,
  Smile,
  Star,
  StickyNote,
  Tag,
  Trash2,
  User,
  UserRound,
  X,
  Zap,
} from "lucide-react";

import type {
  DummyAssignableEditor,
  DummyConversationAttachment,
  DummyConversationLane,
  DummyConversationListResponse,
  DummyConversationRole,
  DummyConversationSourceChannel,
  DummyConversationView,
  DummyConversationTemplate,
  DummyLeadStatus,
  DummyLeadStatusTone,
  DummyMessageAttachmentInput,
  DummyPaymentProvider,
} from "@/lib/gigxomi/dummy-platform-store";
import { broadcastChatWorkspaceSync, subscribeToChatWorkspaceSync } from "@/components/chat/chat-sync";
import styles from "./chat-workspace.module.css";
import {
  startWebPushNotifications,
  type WebPushForegroundHandler,
  type WebPushRegistrationStatus,
} from "@/lib/web-push/client-registration";
import {
  isAutomatedAssignmentOutcomeMessageBody,
  isConversationMessageIncomingForAudience,
  normalizeAutomatedChatMessageBody,
} from "@/lib/gigxomi/chat-message-normalization";
import { buildInboundAttachmentAcknowledgement } from "@/lib/gigxomi/closer-message-safety";
import type { NormalizedRegistrationStatus } from "@/lib/gigxomi/registration-status";
import { aicloserApi, getStoredToken, setStoredToken, type Lead360Response, type LeadHistoryEntry } from "@/lib/api-client";
import { toCentralStageValue } from "@/lib/central-chat-mapper";

export interface ChatErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

export interface ChatErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ChatErrorBoundary extends Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || "An unexpected error occurred in Chat.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ChatErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            margin: "24px auto",
            maxWidth: "600px",
            background: "rgba(15, 23, 42, 0.8)",
            borderRadius: "16px",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f8fafc",
            textAlign: "center",
          }}
        >
          <AlertCircle size={36} color="#ef4444" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px" }}>
            {this.props.fallbackTitle || "Social Inbox Encountered an Issue"}
          </h3>
          <p style={{ fontSize: "0.88rem", color: "#94a3b8", margin: "0 0 20px", maxWidth: "420px" }}>
            {this.state.errorMessage || "The chat workspace ran into a client-side display error. Click below to reload the inbox safely."}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, errorMessage: "" });
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              background: "var(--closer-orange, #ff6b2f)",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Reload Inbox
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type ChatWorkspaceProps = {
  audience: DummyConversationRole;
  listLabel: string;
  listTitle?: string;
  mode?: "classic" | "inbox";
  customerId?: string;
  serviceIdFilter?: string;
  tenantId?: string;
  selectedAgentId?: string | null;
  centralToken?: string | null;
};

type PendingUploadTarget = "local";
type PendingAttachment = DummyMessageAttachmentInput;
type QuickFilter = "all" | "unread" | "mine" | "waiting" | "paused";
type AssignedFilter = "all" | "assigned" | "unassigned";
type AgencyFilter = "all" | string;
type ChannelFilter = "all" | "whatsapp" | "whatsapp_company" | "whatsapp_connected" | "instagram";
type ChatNotificationSetupStatus = "idle" | "ready" | "working" | "blocked" | "unsupported" | "missing-config" | "error";
type MicPermissionState = "unknown" | "granted" | "denied" | "prompt" | "unsupported";
type MicErrorInfo = { name: string; message: string };
type MicDiagnostics = {
  origin: string;
  isSecureContext: boolean;
  inIframe: boolean;
  permissionQuery: "granted" | "denied" | "prompt" | "unknown";
  audioInputCount: number | null;
  permissionsPolicyAllowsMicrophone: boolean | null;
  enumerateDevicesError?: string;
};
type RegistrationStatusView = Partial<NormalizedRegistrationStatus> & {
  available?: boolean;
  error?: string;
};
type Mp3EncoderInstance = {
  encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array;
  flush: () => Int8Array;
};
type Mp3EncoderConstructor = new (channels: number, samplerate: number, kbps: number) => Mp3EncoderInstance;

let cachedMp3EncoderConstructor: Mp3EncoderConstructor | null = null;
let mp3EncoderImportPromise: Promise<Mp3EncoderConstructor> | null = null;

const TONE_OPTIONS: Array<{ value: DummyLeadStatusTone; label: string }> = [
  { value: "neutral", label: "Neutral" },
  { value: "accent", label: "Accent" },
  { value: "warning", label: "Warning" },
  { value: "success", label: "Success" },
];

const EDITOR_PLAN_LABELS: Record<string, string> = {
  "editor-testingfreelancer": "Standard",
  "editor-nagouri": "Subscription Monthly",
  "editor-jayanta": "Subscription Quarterly",
  "editor-vaseek": "Subscription Yearly",
};

const MAX_CHAT_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const CHAT_MEDIA_ACCEPT = "image/*,video/*";
const CHAT_DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.ppt,.pptx,.csv,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv,application/rtf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed";

export interface WhatsAppLabelColor {
  tone: DummyLeadStatusTone;
  name: string;
  hex: string;
  bg: string;
  border: string;
}

export const WHATSAPP_LABEL_COLORS: WhatsAppLabelColor[] = [
  { tone: "success", name: "Emerald Green", hex: "#10B981", bg: "rgba(16, 185, 129, 0.18)", border: "rgba(16, 185, 129, 0.5)" },
  { tone: "accent", name: "Electric Cyan", hex: "#06B6D4", bg: "rgba(6, 182, 212, 0.18)", border: "rgba(6, 182, 212, 0.5)" },
  { tone: "neutral", name: "Royal Purple", hex: "#8B5CF6", bg: "rgba(139, 92, 246, 0.18)", border: "rgba(139, 92, 246, 0.5)" },
  { tone: "warning", name: "Amber Gold", hex: "#F59E0B", bg: "rgba(245, 158, 11, 0.18)", border: "rgba(245, 158, 11, 0.5)" },
  { tone: "warning", name: "Coral Rose", hex: "#F43F5E", bg: "rgba(244, 63, 94, 0.18)", border: "rgba(244, 63, 94, 0.5)" },
  { tone: "accent", name: "Neon Lime", hex: "#84CC16", bg: "rgba(132, 204, 22, 0.18)", border: "rgba(132, 204, 22, 0.5)" },
  { tone: "accent", name: "Sky Blue", hex: "#3B82F6", bg: "rgba(59, 130, 246, 0.18)", border: "rgba(59, 130, 246, 0.5)" },
  { tone: "warning", name: "Sunset Orange", hex: "#FB923C", bg: "rgba(251, 146, 60, 0.18)", border: "rgba(251, 146, 60, 0.5)" },
];

export function getLeadBadgeConfig(statusId?: string, label?: string, tone?: string) {
  void statusId;
  const palette = {
    neutral: { bg: "rgba(148, 163, 184, 0.10)", border: "rgba(148, 163, 184, 0.30)", text: "#64748b", dot: "#64748b", glow: "none" },
    accent: { bg: "rgba(59, 130, 246, 0.10)", border: "rgba(59, 130, 246, 0.32)", text: "#2563eb", dot: "#3b82f6", glow: "none" },
    warning: { bg: "rgba(234, 179, 8, 0.10)", border: "rgba(234, 179, 8, 0.30)", text: "#a16207", dot: "#ca8a04", glow: "none" },
    success: { bg: "rgba(16, 185, 129, 0.10)", border: "rgba(16, 185, 129, 0.30)", text: "#047857", dot: "#10b981", glow: "none" },
    danger: { bg: "rgba(244, 63, 94, 0.10)", border: "rgba(244, 63, 94, 0.30)", text: "#be123c", dot: "#e11d48", glow: "none" },
  } as const;
  const selected = palette[tone as keyof typeof palette] ?? palette.neutral;
  return { ...selected, label: label || "" };
}


function formatTimestamp(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
  } catch {
    return "";
  }
}

function formatRelativeThreadTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

function getConversationDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatConversationDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Conversation";

  const today = new Date();
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayDifference = Math.round((currentDay.getTime() - messageDay.getTime()) / 86_400_000);

  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function formatAudioTimestamp(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function normalizeDisplayText(value: string) {
  return value
    .replaceAll("â€¢", "•")
    .replaceAll("â‚¹", "₹")
    .replaceAll("â€“", "–")
    .replaceAll("â€”", "—")
    .replaceAll("â€˜", "'")
    .replaceAll("â€™", "'")
    .replaceAll("â€œ", "\"")
    .replaceAll("â€\u009d", "\"");
}

function formatPresenceAgoLabel(lastActiveMs: number, nowMs: number) {
  if (!Number.isFinite(lastActiveMs) || lastActiveMs <= 0) {
    return "just now";
  }

  const elapsedMs = Math.max(0, nowMs - lastActiveMs);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) {
    return "just now";
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hr ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays === 1 ? "yesterday" : `${elapsedDays} days ago`;
}

function formatPaymentGatewayLabel(gateway?: DummyPaymentProvider) {
  if (!gateway) {
    return "";
  }
  if (gateway === "payu") return "PayU";
  if (gateway === "razorpay") return "Razorpay";
  if (gateway === "zaakpay") return "Zaakpay";
  if (gateway === "phonepe") return "PhonePe";
  return gateway;
}

const AUDIO_MIME_PREFERENCES = ["audio/mpeg", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/ogg"] as const;
const CHAT_VISIBLE_SYNC_INTERVAL_MS = 3000;
const CHAT_SYNC_BURST_DELAYS_MS = [400, 1200] as const;
const CHAT_TYPING_STOP_DEBOUNCE_MS = 2400;
const CHAT_TYPING_FRESH_WINDOW_MS = 15000;
const CHAT_ONLINE_WINDOW_MS = 120000;
const CHAT_PRESENCE_TICK_MS = 30000;
const WHATSAPP_TYPING_HEARTBEAT_MS = 9000;
const CHAT_NOTIFICATION_SOUND_URL = "/sounds/chat-notification.mp3";
const CHAT_FOREGROUND_PUSH_DEDUPE_MS = 8000;
const CHAT_PROFILE_PICTURE_VISIBLE_LIMIT = 18;
const CHAT_PROFILE_PICTURE_BATCH_SIZE = 6;
const CHAT_PROFILE_PICTURE_BATCH_DELAY_MS = 120;

function getSupportedAudioMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }
  for (const mimeType of AUDIO_MIME_PREFERENCES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return "";
}

function toInt16(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, input[index]));
    output[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

function extractErrorInfo(error: unknown): MicErrorInfo {
  if (!error) {
    return { name: "", message: "" };
  }
  if (typeof error === "string") {
    return { name: "", message: error };
  }
  if (typeof error === "object") {
    const maybeName = (error as { name?: unknown }).name;
    const maybeMessage = (error as { message?: unknown }).message;
    return {
      name: typeof maybeName === "string" ? maybeName : "",
      message: typeof maybeMessage === "string" ? maybeMessage : "",
    };
  }
  return { name: "", message: "" };
}

async function getMp3EncoderConstructor(): Promise<Mp3EncoderConstructor> {
  if (cachedMp3EncoderConstructor) {
    return cachedMp3EncoderConstructor;
  }
  if (mp3EncoderImportPromise) {
    return mp3EncoderImportPromise;
  }

  mp3EncoderImportPromise = import("lamejs/lame.all.js")
    .then((module) => {
      const resolved = (module as unknown as { default?: unknown }).default ?? module;
      const ctor = (resolved as { Mp3Encoder?: unknown } | null | undefined)?.Mp3Encoder;
      if (typeof ctor !== "function") {
        throw new Error("Mp3Encoder is not available.");
      }
      cachedMp3EncoderConstructor = ctor as Mp3EncoderConstructor;
      return cachedMp3EncoderConstructor;
    })
    .finally(() => {
      mp3EncoderImportPromise = null;
    });

  return mp3EncoderImportPromise;
}

async function resolveAudioDuration(blob: Blob) {
  if (typeof Audio === "undefined") {
    return null;
  }
  return new Promise<number | null>((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(blob);
    let settled = false;
    const cleanup = (value: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      audio.load();
      resolve(value);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
      cleanup(duration);
    };
    audio.onerror = () => cleanup(null);
    audio.src = url;
    audio.load();
  });
}

async function convertToMp3(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const AudioContextImpl = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextImpl) {
    throw new Error("AudioContext is not available.");
  }
  const Mp3Encoder = await getMp3EncoderConstructor();
  const audioContext = new AudioContextImpl();
  try {
    await audioContext.resume();
  } catch {
    // Resume best-effort to avoid decode failures in suspended contexts.
  }
  const audioBuffer = await audioContext.decodeAudioData(buffer.slice(0));
  const encoder = new Mp3Encoder(1, audioBuffer.sampleRate, 128);
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = 1152;
  const chunks: Uint8Array[] = [];

  for (let index = 0; index < channelData.length; index += blockSize) {
    const chunk = channelData.subarray(index, index + blockSize);
    const mp3buf = encoder.encodeBuffer(toInt16(chunk));
    if (mp3buf.length) {
      chunks.push(new Uint8Array(mp3buf));
    }
  }

  const end = encoder.flush();
  if (end.length) {
    chunks.push(new Uint8Array(end));
  }

  await audioContext.close();
  return {
    blob: new Blob(chunks as unknown as BlobPart[], { type: "audio/mpeg" }),
    duration: audioBuffer.duration,
  };
}

function VoiceNotePlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekSecondsRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const duration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
  const current = Number.isFinite(currentSeconds) && currentSeconds > 0 ? currentSeconds : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDurationSeconds(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentSeconds(audio.currentTime);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [isSeeking]);

  const handleTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        // Ignore autoplay blocks; user can retry.
      }
      return;
    }

    audio.pause();
  };

  const handleSeekPreview = (nextValue: number) => {
    pendingSeekSecondsRef.current = nextValue;
    setIsSeeking(true);
    setCurrentSeconds(nextValue);
  };

  const commitSeek = () => {
    const audio = audioRef.current;
    if (!audio) {
      setIsSeeking(false);
      return;
    }
    const nextTime = pendingSeekSecondsRef.current;
    audio.currentTime = Math.max(0, Math.min(nextTime, duration || nextTime));
    setCurrentSeconds(audio.currentTime);
    setIsSeeking(false);
  };

  const sliderMax = duration || 1;
  const sliderValue = duration ? Math.min(current, duration) : current;

  return (
    <div className="chat-voice-note-player">
      <button
        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
        className="chat-voice-note-play"
        onClick={() => handleTogglePlay().catch(() => undefined)}
        type="button"
      >
        {isPlaying ? <Pause size={16} strokeWidth={2} /> : <Play size={16} strokeWidth={2} />}
      </button>
      <input
        aria-label="Voice note progress"
        className="chat-voice-note-progress"
        disabled={!duration}
        max={sliderMax}
        min={0}
        onChange={(event) => handleSeekPreview(Number(event.target.value))}
        onKeyUp={() => commitSeek()}
        onMouseUp={() => commitSeek()}
        onTouchEnd={() => commitSeek()}
        step={0.01}
        type="range"
        value={sliderValue}
      />
      <span className="chat-voice-note-time">{formatAudioTimestamp(current)} / {formatAudioTimestamp(duration)}</span>
      <audio preload="metadata" ref={audioRef} src={src} />
    </div>
  );
}

function getInitials(name?: string | null, fallback = "?") {
  const normalizedName = String(name ?? "").trim();
  if (!normalizedName || normalizedName === "[object Object]") {
    return fallback;
  }
  const initials = normalizedName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || fallback;
}

function normalizeAvatarImageUrl(value?: string | null) {
  const src = value?.trim() ?? "";
  if (!src) {
    return "";
  }
  return /^(https?:\/\/|\/|data:image\/)/i.test(src) ? src : "";
}

function isMetaHostedAvatarUrl(value?: string | null) {
  const src = value?.trim() ?? "";
  if (!src || /^data:image\//i.test(src)) {
    return false;
  }

  try {
    const parsed = new URL(src);
    const host = parsed.hostname.toLowerCase();
    return host === "graph.facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

function ChatAvatar({
  className,
  imageUrl,
  name,
}: {
  className: string;
  imageUrl?: string | null;
  name: string;
}) {
  const safeImageUrl = normalizeAvatarImageUrl(imageUrl);
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const resolvedImageUrl = safeImageUrl && failedImageUrl !== safeImageUrl ? safeImageUrl : "";
  const rawInitials = getInitials(name, "").slice(0, 2);
  const isLetters = /^[A-Za-z]{1,2}$/.test(rawInitials);

  return (
    <div aria-label={`${name} avatar`} className={className}>
      {resolvedImageUrl ? (
        <Image
          alt=""
          aria-hidden="true"
          className="chat-avatar-image"
          height={96}
          onError={() => setFailedImageUrl(safeImageUrl)}
          src={resolvedImageUrl}
          unoptimized
          width={96}
        />
      ) : isLetters ? (
        <span className="chat-avatar-initials">{rawInitials.toUpperCase()}</span>
      ) : (
        <span className="chat-avatar-initials" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <User size={15} strokeWidth={2.2} />
        </span>
      )}
    </div>
  );
}

function rolePrefix(role: DummyConversationRole) {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "freelancer") return "Editor";
  if (role === "sales") return "Sales";
  return "Customer";
}

function messageLabel(message: DummyConversationView["messages"][number], audience: DummyConversationRole) {
  const rawSenderLabel = message.senderLabel?.trim() || "";
  const senderLabel = /gigxomi|gxclosers|agency\s*(studio|workspace|team)?/i.test(rawSenderLabel)
    ? rolePrefix(message.senderRole)
    : rawSenderLabel || rolePrefix(message.senderRole);
  if (audience !== "customer" && message.senderRole === "freelancer") {
    return /^(freelancer|editor)\b/i.test(senderLabel) ? senderLabel : `Freelancer ${senderLabel}`;
  }
  return senderLabel;
}

function messageSenderIdentity(message: DummyConversationView["messages"][number], audience: DummyConversationRole) {
  const roleLabel = rolePrefix(message.senderRole);
  const rawSenderName = message.senderLabel?.trim() || "";
  const senderName = audience === "freelancer" && message.senderRole === "customer"
    ? "Client"
    : /gigxomi|gxclosers|agency\s*(studio|workspace|team)?/i.test(rawSenderName)
      ? roleLabel
      : rawSenderName || roleLabel;
  const isCurrentViewer = message.senderRole === audience && !isAutomatedAssignmentOutcomeMessageBody(message.body);

  if (isCurrentViewer) {
    return {
      primary: "You",
      secondary: senderName.toLowerCase() === roleLabel.toLowerCase() ? roleLabel : `${senderName} · ${roleLabel}`,
    };
  }

  return {
    primary: senderName,
    secondary: senderName.toLowerCase() === roleLabel.toLowerCase() ? "" : roleLabel,
  };
}

const WHATSAPP_UNSUPPORTED_MESSAGE_PLACEHOLDER = "[unsupported message received on WhatsApp]";
const WHATSAPP_UNSUPPORTED_MESSAGE_NOTICE =
  buildInboundAttachmentAcknowledgement("unknown");

function visibleBody(message: DummyConversationView["messages"][number]) {
  if (message.lane === "customer" && message.senderRole !== "customer") {
    const prefixes = [message.senderLabel, rolePrefix(message.senderRole)]
      .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
      .map((value) => `${value}:`);
    for (const prefixed of prefixes) {
      if (message.body.startsWith(prefixed)) {
        return message.body.slice(prefixed.length).trimStart();
      }
    }
  }
  if (message.body.trim().toLowerCase() === WHATSAPP_UNSUPPORTED_MESSAGE_PLACEHOLDER) {
    return WHATSAPP_UNSUPPORTED_MESSAGE_NOTICE;
  }
  if (/unsupported message type|unsupported received|local file|ask the sender to resend|did not receive readable text/i.test(message.body)) {
    return "Attachment received";
  }
  if (/^\[instagram attachment received\]$/i.test(message.body.trim())) {
    return buildInboundAttachmentAcknowledgement("media");
  }
  return normalizeAutomatedChatMessageBody(message.body);
}

function isSyntheticInboundAttachmentNote(value: string | null | undefined) {
  return /^(got it|attachment received|document received|media received|portfolio link received|.*receive ho (gaya|gayi|ho gayi))/i.test(
    String(value ?? "").trim(),
  );
}

function getInternalDeliveryStatus(
  message: DummyConversationView["messages"][number],
  audience: DummyConversationRole,
  conversation?: DummyConversationView | null,
) {
  if (message.lane !== "internal" || message.senderRole === "customer" || message.senderRole !== audience) {
    return null;
  }

  const counterpartKeys =
    audience === "freelancer"
      ? ["admin:internal", "manager:internal", "admin", "manager"]
      : ["freelancer:internal", "freelancer"];
  const readAt = counterpartKeys
    .map((key) => conversation?.readStateByAudience?.[key as keyof NonNullable<DummyConversationView["readStateByAudience"]>])
    .filter(Boolean)
    .sort()
    .at(-1);
  const readAtMs = readAt ? new Date(readAt).getTime() : 0;
  const messageMs = message.createdAt ? new Date(message.createdAt).getTime() : 0;

  return Number.isFinite(readAtMs) && Number.isFinite(messageMs) && readAtMs >= messageMs ? "read" : "sent";
}

function getOutgoingDeliveryStatus(
  message: DummyConversationView["messages"][number],
  audience: DummyConversationRole,
  conversation?: DummyConversationView | null,
) {
  if (message.senderRole === "customer" || isConversationMessageIncomingForAudience(message, audience)) {
    return null;
  }

  if (message.lane === "internal") {
    return getInternalDeliveryStatus(message, audience, conversation);
  }

  if (message.lane !== "customer") {
    return null;
  }

  return message.deliveryStatus ?? "sent";
}

function summarizeMessagePreview(
  message: DummyConversationView["messages"][number],
  audience: DummyConversationRole,
  options?: { includeLanePrefix?: boolean },
) {
  const body = visibleBody(message).trim();
  const senderPrefix =
    audience !== "customer" && message.senderRole !== "customer"
      ? `${message.senderRole === audience ? "You" : messageLabel(message, audience)}: `
      : "";
  const lanePrefix = options?.includeLanePrefix === false || message.lane !== "internal" ? "" : "Internal: ";

  if (body) {
    return `${lanePrefix}${senderPrefix}${body}`;
  }

  if (message.attachments?.length) {
    if (message.attachments.length === 1) {
      return `${lanePrefix}${senderPrefix}${describeAttachment(message.attachments[0])}`;
    }
    return `${lanePrefix}${senderPrefix}${message.attachments.length} attachments received`;
  }

  return message.lane === "internal" ? "New internal message received" : "New message received";
}

function getDeliveryStatusLabel(status: NonNullable<ReturnType<typeof getOutgoingDeliveryStatus>>) {
  if (status === "failed") {
    return "Not delivered";
  }
  if (status === "read") {
    return "Read";
  }
  if (status === "delivered") {
    return "Delivered";
  }
  return "Sent";
}

function resolveSelectedConversation(preferredId: string, items: DummyConversationView[]) {
  return preferredId && items.some((conversation) => conversation.id === preferredId) ? preferredId : "";
}

function isConversationView(value: unknown): value is DummyConversationView {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DummyConversationView> & {
    assignmentSummary?: unknown;
    laneCapabilities?: unknown;
    visibleLanes?: unknown;
    messages?: unknown;
  };

  return (
    typeof candidate.id === "string" &&
    Array.isArray(candidate.messages) &&
    Array.isArray(candidate.visibleLanes) &&
    typeof candidate.assignmentSummary === "object" &&
    candidate.assignmentSummary !== null &&
    typeof candidate.laneCapabilities === "object" &&
    candidate.laneCapabilities !== null
  );
}

function makeConversationSignature(payload: DummyConversationListResponse) {
  const conversationSignature = (payload.conversations ?? [])
    .map((conversation) => {
      const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
      const typing = Array.isArray(conversation.typing) ? conversation.typing : [];
      const latestMessage = messages.at(-1);
      const latestTyping = typing.at(-1);
      const latestPaymentRequest = conversation.latestPaymentRequest;

      return [
        conversation.id,
        conversation.status ?? "",
        conversation.leadStatusId ?? "",
        conversation.assignedFreelancerId ?? "",
        conversation.assignedFreelancerName ?? "",
        conversation.assignmentSummary?.pendingOfferCount ?? 0,
        conversation.myAssignmentOffer?.status ?? "",
        conversation.myAssignmentOffer?.respondedAt ?? "",
        conversation.ownerName ?? "",
        conversation.ownerRole ?? "",
        conversation.lastCustomerActivityAt ?? "",
        conversation.unreadCount ?? 0,
        conversation.unreadCountByLane?.customer ?? 0,
        conversation.unreadCountByLane?.internal ?? 0,
        conversation.latestMessageLane ?? "",
        conversation.preferredLane ?? "",
        conversation.businessPhoneDisplay ?? "",
        messages.length,
        latestMessage?.id ?? "",
        latestMessage?.createdAt ?? "",
        latestMessage?.body?.length ?? 0,
        latestMessage?.attachments?.length ?? 0,
        latestMessage?.deliveryStatus ?? "",
        conversation.customerProfileImageUrl ?? "",
        latestTyping?.role ?? "",
        latestTyping?.lane ?? "",
        latestTyping?.active ? "1" : "0",
        latestTyping?.updatedAt ?? "",
        latestPaymentRequest?.id ?? "",
        latestPaymentRequest?.status ?? "",
        conversation.internalNotes ?? "",
        conversation.leadStatusId ?? "",
        conversation.leadStatusLabel ?? "",
        conversation.updatedAt ?? "",
      ].join("|");
    })
    .join("\n");

  const supportSignature = [
    (payload.assignableEditors ?? []).map((editor) => `${editor.id}:${editor.name}:${editor.karmaScore}`).join("|"),
    (payload.leadStatuses ?? []).map((status) => `${status.id}:${status.label}:${status.tone}`).join("|"),
    (payload.templates ?? []).map((template) => `${template.id}:${template.title}`).join("|"),
  ].join("\n");

  return `${conversationSignature}\n---support---\n${supportSignature}`;
}

function summarizeAttachmentForStatus(attachment: PendingAttachment) {
  if (attachment.uploadTarget === "youtube") {
    return `${attachment.name} routed to YouTube`;
  }
  if (attachment.durationSeconds) {
    return `Voice note recorded (${attachment.durationSeconds}s)`;
  }
  return `${attachment.name} attached`;
}

function describeAttachment(attachment: DummyConversationAttachment) {
  if (/unsupported received|local file/i.test(`${attachment.name} ${attachment.sizeLabel}`)) {
    if (attachment.kind === "image") return "Image attachment";
    if (attachment.kind === "video") return "Video attachment";
    if (attachment.mimeType === "application/pdf") return "PDF attachment";
    return "File attachment";
  }
  if (attachment.kind === "voice-note") {
    return attachment.durationLabel ? `Voice note - ${attachment.durationLabel}` : "Voice note";
  }
  if (attachment.kind === "youtube-upload") {
    return attachment.collectionName ? `YouTube - ${attachment.collectionName}` : "YouTube upload";
  }
  if (attachment.kind === "payment-request") {
    return attachment.note ?? "Payment request";
  }
  const sizeLabel = attachment.sizeLabel?.trim();
  return sizeLabel ? `${attachment.name} - ${sizeLabel}` : attachment.name;
}

function displayAttachmentName(attachment: DummyConversationAttachment) {
  if (/unsupported received|local file/i.test(`${attachment.name} ${attachment.sizeLabel}`)) {
    if (attachment.kind === "voice-note") return "Voice note";
    if (attachment.kind === "image") return "Image attachment";
    if (attachment.kind === "video") return "Video attachment";
    if (attachment.mimeType === "application/pdf") return "PDF attachment";
    return "File attachment";
  }
  return attachment.kind === "voice-note" ? "Voice note" : attachment.name;
}

function attachmentHasInlinePreview(attachment: DummyConversationAttachment) {
  return Boolean(
    attachment.externalUrl &&
      (attachment.kind === "image" ||
        attachment.kind === "video" ||
        attachment.kind === "audio" ||
        attachment.kind === "voice-note" ||
        attachment.mimeType === "application/pdf"),
  );
}

function getAttachmentUrl(externalUrl: string): string;
function getAttachmentUrl(externalUrl: undefined): undefined;
function getAttachmentUrl(externalUrl: string | undefined) {
  if (!externalUrl || typeof window === "undefined") return externalUrl;

  try {
    const url = new URL(externalUrl, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.includes("/api/meta/whatsapp/media/")) {
      return externalUrl;
    }

    const token = getStoredToken();
    if (token && !url.searchParams.has("token")) {
      url.searchParams.set("token", token);
    }
    return url.toString();
  } catch {
    return externalUrl;
  }
}

function AttachmentPreview({ attachment }: { attachment: DummyConversationAttachment }) {
  if (!attachment.externalUrl) {
    return null;
  }

  const attachmentUrl = getAttachmentUrl(attachment.externalUrl);

  if (attachment.kind === "voice-note") {
    return <VoiceNotePlayer src={attachmentUrl} />;
  }

  if (attachment.kind === "image") {
    return (
      <a className="chat-attachment-preview-link" href={attachmentUrl} rel="noreferrer" target="_blank">
        <Image
          alt={attachment.name}
          className="chat-attachment-image"
          height={720}
          loading="lazy"
          src={attachmentUrl}
          unoptimized
          width={960}
        />
      </a>
    );
  }

  if (attachment.kind === "video") {
    return <video className="chat-attachment-video" controls preload="metadata" src={attachmentUrl} />;
  }

  if (attachment.kind === "audio") {
    return <audio className="chat-attachment-audio" controls preload="metadata" src={attachmentUrl} />;
  }

  if (attachment.mimeType === "application/pdf") {
    return (
      <a
        className="chat-attachment-document-preview chat-attachment-preview-link"
        href={attachmentUrl}
        rel="noreferrer"
        target="_blank"
        style={{ textDecoration: "none", cursor: "pointer", display: "flex" }}
      >
        <span className="chat-attachment-document-icon">
          <FileText size={18} strokeWidth={2} />
        </span>
        <div className="chat-attachment-document-copy">
          <strong>{attachment.name}</strong>
          <span>Click to view PDF document ↗</span>
        </div>
      </a>
    );
  }

  if (attachment.kind === "file" || attachment.externalUrl) {
    return (
      <a
        className="chat-attachment-document-preview chat-attachment-preview-link"
        href={attachmentUrl}
        rel="noreferrer"
        target="_blank"
        style={{ textDecoration: "none", cursor: "pointer", display: "flex" }}
      >
        <span className="chat-attachment-document-icon">
          <FileText size={18} strokeWidth={2} />
        </span>
        <div className="chat-attachment-document-copy">
          <strong>{attachment.name}</strong>
          <span>Click to open file ↗</span>
        </div>
      </a>
    );
  }

  return null;
}

function editorPlanLabel(editorId?: string) {
  return editorId ? EDITOR_PLAN_LABELS[editorId] ?? "Standard" : "Standard";
}

function buildSplitPreview(amount: number, editorId?: string) {
  const planLabel = editorPlanLabel(editorId);
  const platformPercentage = planLabel === "Standard" ? 30 : 5;
  const editorPercentage = 100 - platformPercentage;
  return {
    planLabel,
    platformPercentage,
    editorPercentage,
    editorShare: Math.round((amount * editorPercentage) / 100),
    platformShare: Math.round((amount * platformPercentage) / 100),
  };
}

function toneClassName(tone: DummyLeadStatusTone) {
  return `chat-status-pill tone-${tone}`;
}

function isWaitingConversation(conversation: DummyConversationView) {
  return /review|waiting/i.test(conversation.status || "") || /new|waiting|payment-pending/.test(conversation.leadStatusId || "");
}

function getConversationSourceChannel(
  conversation: Pick<DummyConversationView, "serviceId" | "sourceChannel">,
): DummyConversationSourceChannel {
  if (conversation.sourceChannel === "instagram" || conversation.serviceId === "svc-instagram-inbox") {
    return "instagram";
  }
  if (conversation.sourceChannel === "in-app") {
    return "in-app";
  }
  return "whatsapp";
}

const WHATSAPP_CUSTOMER_CARE_WINDOW_MS = 24 * 60 * 60 * 1000;

function getWhatsAppReplyWindow(
  conversation: DummyConversationView | null | undefined,
  nowMs: number,
) {
  if (!conversation || getConversationSourceChannel(conversation) !== "whatsapp") {
    return null;
  }

  let latestInboundMs = Number(new Date(conversation.lastCustomerActivityAt).getTime());
  for (const message of conversation.messages ?? []) {
    if (message.lane !== "customer" || message.senderRole !== "customer") {
      continue;
    }
    const messageMs = Number(new Date(message.createdAt).getTime());
    if (Number.isFinite(messageMs) && messageMs > latestInboundMs) {
      latestInboundMs = messageMs;
    }
  }

  if (!Number.isFinite(latestInboundMs) || latestInboundMs <= 0) {
    return null;
  }

  const expiresAt = latestInboundMs + WHATSAPP_CUSTOMER_CARE_WINDOW_MS;
  return {
    expiresAt,
    remainingMs: expiresAt - nowMs,
    isOpen: expiresAt > nowMs,
  };
}

function formatReplyWindowRemaining(remainingMs: number) {
  const totalMinutes = Math.max(1, Math.ceil(Math.max(0, remainingMs) / 60_000));
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function parseChannelFilter(value: string | null): ChannelFilter {
  return value === "instagram" || value === "whatsapp" || value === "whatsapp_company" || value === "whatsapp_connected" ? value : "all";
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function mapWebPushStatus(status: WebPushRegistrationStatus): ChatNotificationSetupStatus {
  if (status === "registered") return "ready";
  if (status === "permission-denied") return "blocked";
  if (status === "missing-config") return "missing-config";
  if (status === "unsupported" || status === "token-unavailable") return "unsupported";
  if (status === "failed") return "error";
  return "idle";
}

function getWebPushStatusMessage(status: WebPushRegistrationStatus) {
  switch (status) {
    case "registered":
      return "Chat alerts are enabled for this browser.";
    case "permission-denied":
      return "Notifications are blocked in this browser. Allow notifications from the address bar, then retry.";
    case "missing-config":
      return "Firebase web push config is missing on the server.";
    case "unsupported":
      return "This browser does not support web push notifications.";
    case "token-unavailable":
      return "The browser did not return a push token. Refresh once and try again.";
    case "failed":
      return "Chat alerts could not be enabled right now.";
    default:
      return "Click Enable alerts to allow chat notifications for this browser.";
  }
}

function ChatFilterBar({ children }: { children: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [thumbRatio, setThumbRatio] = useState(0.25);
  const [hasOverflow, setHasOverflow] = useState(true);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const checkScroll = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const overflow = maxScroll > 2;
    setHasOverflow(overflow);
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < maxScroll - 4);
    if (overflow) {
      setScrollProgress(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
      setThumbRatio(Math.min(1, Math.max(0.18, el.clientWidth / el.scrollWidth)));
    } else {
      setScrollProgress(0);
      setThumbRatio(1);
    }
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => checkScroll());
      ro.observe(el);
      Array.from(el.children).forEach((child) => ro?.observe(child));
    }

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      ro?.disconnect();
    };
  }, [checkScroll]);

  const scrollByAmount = (amount: number) => {
    rowRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = rowRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !rowRef.current) return;
    e.preventDefault();
    const x = e.pageX - rowRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    rowRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const el = rowRef.current;
    if (!track || !el) return;
    const rect = track.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: clickRatio * maxScroll, behavior: "smooth" });
  };

  return (
    <div className="chat-filter-wrapper">
      <div className="chat-filter-scroll-container">
        {canScrollLeft ? (
          <button
            type="button"
            className="chat-filter-nav-btn left"
            onClick={() => scrollByAmount(-180)}
            aria-label="Scroll filters left"
          >
            <ChevronLeft size={15} />
          </button>
        ) : null}
        <div
          ref={rowRef}
          className="chat-filter-row"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onWheel={(e) => {
            const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
            if (delta !== 0) {
              e.currentTarget.scrollLeft += delta;
            }
          }}
        >
          {children}
        </div>
        {canScrollRight ? (
          <button
            type="button"
            className="chat-filter-nav-btn right"
            onClick={() => scrollByAmount(180)}
            aria-label="Scroll filters right"
          >
            <ChevronRight size={15} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

type ChatSidebarHeaderProps = {
  title: string;
  subtitle: string;
  titleActions?: ReactNode;
  topTabs?: ReactNode;
  searchValue: string;
  searchPlaceholder: string;
  searchDisabled?: boolean;
  hideSearch?: boolean;
  filterRow?: ReactNode;
  extra?: ReactNode;
  onSearchChange?: (value: string) => void;
};

function ChatSidebarHeader({
  title,
  subtitle,
  titleActions,
  topTabs,
  searchValue,
  searchPlaceholder,
  searchDisabled = false,
  hideSearch = false,
  filterRow,
  extra,
  onSearchChange,
}: ChatSidebarHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(searchValue.trim()));
  const normalizedTitle = title.trim();
  const normalizedSubtitle = subtitle.trim();
  const primaryHeading = normalizedTitle || normalizedSubtitle;
  const secondaryHeading = normalizedTitle && normalizedSubtitle ? normalizedSubtitle : "";
  const hasHeading = Boolean(primaryHeading || secondaryHeading);

  useEffect(() => {
    if (searchValue.trim()) setIsSearchOpen(true);
  }, [searchValue]);

  return (
    <div className="chat-inbox-sidebar-head">
      {hasHeading || titleActions ? (
        <div className={hasHeading ? "chat-inbox-title-row" : "chat-inbox-title-row actions-only"}>
          {hasHeading ? (
            <div>
              {primaryHeading ? <h2>{primaryHeading}</h2> : null}
              {secondaryHeading ? <p className="muted-copy">{secondaryHeading}</p> : null}
            </div>
          ) : null}
          {titleActions ? (
            <div className="chat-inbox-title-actions">{titleActions}</div>
          ) : null}
        </div>
      ) : null}

      {topTabs ? <div className="chat-top-tabs-container">{topTabs}</div> : null}

      {!hideSearch ? <div className={isSearchOpen ? "chat-search-shell is-open" : "chat-search-shell"}>
        {isSearchOpen ? (
          <div className={searchDisabled ? "chat-search-field disabled" : "chat-search-field"}>
            <input
              disabled={searchDisabled}
              onChange={
                onSearchChange
                  ? (event) => onSearchChange(event.target.value)
                  : undefined
              }
              placeholder={searchPlaceholder}
              value={searchValue}
            />
            <Search size={16} strokeWidth={1.8} />
            <button
              type="button"
              className="chat-search-close"
              aria-label="Close chat search"
              title="Close search"
              onClick={() => {
                onSearchChange?.("");
                setIsSearchOpen(false);
              }}
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={searchDisabled ? "chat-search-trigger disabled" : "chat-search-trigger"}
            aria-label="Open chat search"
            title="Search conversations"
            disabled={searchDisabled}
            onClick={() => setIsSearchOpen(true)}
          >
            <Search size={16} strokeWidth={1.8} />
          </button>
        )}
      </div> : null}

      {filterRow}
      {extra}
    </div>
  );
}

function formatPhoneFriendly(phone?: string | null): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (trimmed.startsWith("{") || trimmed.includes("deviceId") || trimmed.includes('"')) {
    return "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  // Check if it's an LID (13+ digits that are raw WhatsApp internal IDs)
  if (digits.length >= 13) {
    return "";
  }
  // Standard Indian 10 digits
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  // 12 digits with 91 prefix
  if (digits.length === 12 && digits.startsWith("91")) {
    const d = digits.slice(2);
    return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  }
  return `+${digits}`;
}

function sanitizeChatDisplayName(name?: string | null, fallbackPhone?: string | null): string {
  const formattedFallback = formatPhoneFriendly(fallbackPhone);
  if (!name) return formattedFallback || "Lead";
  const trimmed = name.trim();
  if (
    trimmed.startsWith("{") ||
    trimmed.includes('"deviceId"') ||
    trimmed.includes("deviceId") ||
    trimmed.startsWith("[") ||
    trimmed.toLowerCase() === "unknown customer" ||
    trimmed.toLowerCase() === "whatsapp customer"
  ) {
    return formattedFallback || "WhatsApp Contact";
  }
  // If name is an LID like +255168335577307 or 255168335577307
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 13 && (trimmed.startsWith("+") || /^\d+$/.test(trimmed))) {
    return formattedFallback || "WhatsApp Contact";
  }
  // If name is just raw 10 or 12 digits without letters, format nicely
  if (/^\+?\d{10,12}$/.test(trimmed)) {
    return formatPhoneFriendly(trimmed) || formattedFallback || "WhatsApp Contact";
  }
  return trimmed;
}

function cleanDisplayPhone(phone?: string | null): string {
  return formatPhoneFriendly(phone);
}

function sanitizeChatSnippet(snippet?: string | null): string {
  if (!snippet) return "";
  const trimmed = snippet.trim();
  if (
    trimmed.includes('"deviceId"') ||
    trimmed.includes('"model"') ||
    trimmed.includes('"manufacturer"') ||
    trimmed.includes("deviceId") ||
    trimmed.includes('"battery"') ||
    trimmed.includes("Device telemetry")
  ) {
    return "📱 Device telemetry & diagnostics";
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.deviceId || parsed.model) return "📱 Device telemetry & diagnostics";
      if (parsed.text || parsed.message || parsed.body) return String(parsed.text || parsed.message || parsed.body);
    } catch {
      // not json
    }
  }
  return trimmed;
}

const ChatThreadRow = memo(function ChatThreadRow({
  audience,
  conversation,
  selected,
  onSelect,
}: {
  audience: DummyConversationRole;
  conversation: DummyConversationView;
  selected: boolean;
  onSelect: (conversation: DummyConversationView) => void;
}) {
  const customerName = sanitizeChatDisplayName(
    conversation.customerDisplayName,
    conversation.customerPhoneDisplay
  );
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const latestMessage = messages.at(-1);
  const latestInternalMessage = [...messages].reverse().find((message) => message.lane === "internal");
  const isSales = audience === "sales";
  const hasInternalSignal = !isSales && ((conversation.unreadCountByLane?.internal ?? 0) > 0 || conversation.latestMessageLane === "internal");
  const sourceChannel = getConversationSourceChannel(conversation);
  const sourceChannelLabel = sourceChannel === "instagram" ? "Instagram" : sourceChannel === "whatsapp" ? "WhatsApp" : "In-app";
  const isMetaAd = Boolean(
    (conversation as any)?.attribution === "ctwa" ||
    (conversation as any)?.ctwa_clid ||
    (conversation as any)?.referralSource?.includes("ad") ||
    /ad|ctwa/i.test(conversation.summary || "")
  );
  const threadTime = formatRelativeThreadTime((conversation as any).lastMessageAt || conversation.updatedAt);
  const summaryPreview =
    latestMessage
      ? summarizeMessagePreview(latestMessage, audience, { includeLanePrefix: false })
      : conversation.summary?.trim() || "";
  const summaryLabel = sanitizeChatSnippet(summaryPreview) || "Open chat";

  // The inbox badge is driven only by the workspace stage returned by the API.
  // Do not translate old MVP labels here; that was the source of stale stages.
  const effectiveStatusId = conversation.leadStatusId;
  const effectiveStatusLabel = conversation.leadStatusLabel;
  const effectiveStatusTone = conversation.leadStatusTone;

  const badgeCfg = getLeadBadgeConfig(
    effectiveStatusId,
    effectiveStatusLabel,
    effectiveStatusTone
  );

  return (
    <button
      className={cx("chat-thread-row", selected && "active")}
      onClick={() => onSelect(conversation)}
      type="button"
      aria-selected={selected}
    >
      <div className="chat-thread-avatar-wrap">
        <ChatAvatar
          className="chat-thread-avatar"
          imageUrl={conversation.customerProfileImageUrl}
          name={customerName}
        />
        {sourceChannel === "whatsapp" || sourceChannel === "instagram" ? (
          <span
            className={cx("chat-thread-channel-badge", sourceChannel)}
            title={`Channel: ${sourceChannelLabel}`}
          >
            {sourceChannel === "instagram" ? <Instagram size={8} /> : <MessageSquare size={8} />}
          </span>
        ) : null}
      </div>

      <div className="chat-thread-copy">
        {/* Line 1: Customer Name + Meta Ad Tag + Timestamp */}
        <div className="chat-thread-topline">
          <div className="chat-thread-name-group">
            <strong className="chat-thread-name" title={customerName}>
              {customerName}
            </strong>
            {isMetaAd ? (
              <span className="chat-thread-ad-tag" title="Source: Meta Ad (CTWA)">
                Ad
              </span>
            ) : null}
            {effectiveStatusLabel ? (
              <span
                className="chat-thread-stage-pill"
                style={{
                  background: badgeCfg.bg,
                  borderColor: badgeCfg.border,
                  color: badgeCfg.text,
                  boxShadow: badgeCfg.glow,
                }}
                title={`Lead Stage: ${badgeCfg.label}`}
              >
                <span
                  className="chat-thread-stage-dot"
                  style={{
                    backgroundColor: badgeCfg.dot,
                    boxShadow: badgeCfg.dot ? `0 0 6px ${badgeCfg.dot}` : undefined,
                  }}
                />
                <span className="chat-thread-stage-label">{badgeCfg.label}</span>
              </span>
            ) : null}
          </div>
          {threadTime ? <span className="chat-thread-time">{threadTime}</span> : null}
        </div>

        {/* Secondary source/contact metadata remains mounted for existing data
            flows, but the reference rail keeps it visually quiet. */}
        <div className="chat-thread-badge-row" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {cleanDisplayPhone(conversation.customerPhoneDisplay) ? (
            <span
              className="chat-thread-phone-display"
              style={{
                fontSize: "0.72rem",
                fontFamily: "monospace",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "5px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
              title={`Customer Phone: ${cleanDisplayPhone(conversation.customerPhoneDisplay)}`}
            >
              <Phone size={10} style={{ color: "var(--closer-orange, #ff6b2f)" }} />
              {cleanDisplayPhone(conversation.customerPhoneDisplay)}
            </span>
          ) : null}
          {sourceChannel === "whatsapp" ? (
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: conversation.externalSourceType === "whatsapp_personal" || conversation.externalSourceType === "whatsapp_business" ? "#38bdf8" : "#34d399",
                background: conversation.externalSourceType === "whatsapp_personal" || conversation.externalSourceType === "whatsapp_business" ? "rgba(2, 132, 199, 0.15)" : "rgba(16, 185, 129, 0.15)",
                padding: "2px 6px",
                borderRadius: "5px",
                border: `1px solid ${conversation.externalSourceType === "whatsapp_personal" || conversation.externalSourceType === "whatsapp_business" ? "rgba(2, 132, 199, 0.35)" : "rgba(16, 185, 129, 0.35)"}`,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
              title={conversation.externalSourceType === "whatsapp_personal" || conversation.externalSourceType === "whatsapp_business" ? "WhatsApp Personal (Closer Synced Device)" : "WhatsApp API (Cloud API)"}
            >
              {conversation.externalSourceType === "whatsapp_personal" || conversation.externalSourceType === "whatsapp_business" ? <Smartphone size={10} /> : <Building2 size={10} />}
              {conversation.externalSourceType === "whatsapp_personal" || conversation.externalSourceType === "whatsapp_business" ? "WhatsApp Personal" : "WhatsApp API"}
            </span>
          ) : null}
        </div>

        {/* Line 3: Last Message Snippet + Unread Counter */}
        <div className="chat-thread-preview-row">
          <p className={cx("chat-thread-preview", hasInternalSignal && "internal")}>
            {summaryLabel}
          </p>
          {(conversation.unreadCount ?? 0) > 0 ? (
            <span className="chat-thread-unread-pill">{conversation.unreadCount}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
});

function ChatSidebarEmptyState({
  title,
  copy,
  badge,
}: {
  title: string;
  copy: string;
  badge: string;
}) {
  return (
    <div className={styles.sidebarEmpty}>
      <span className={styles.sidebarEmptyBadge}>{badge}</span>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function ChatStageEmptyState({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.stageEmpty}>
      <div className={styles.stageEmptyInner}>
        <span className={styles.stageEmptyIcon}>
          <MessageSquareText size={22} strokeWidth={1.8} />
        </span>
        <strong>{title}</strong>
        <p>{copy}</p>
        {action}
      </div>
    </div>
  );
}

function ChatDetailsSheet({
  title,
  eyebrow,
  onClose,
  desktop = false,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  desktop?: boolean;
  children: ReactNode;
}) {
  const sheet = (
    <aside
      className={styles.detailsSheet}
      onClick={(event) => event.stopPropagation()}
      aria-label={eyebrow}
    >
        <div className={styles.sheetHeader}>
          <div className={styles.sheetTitleGroup}>
            <p className="section-label">{eyebrow}</p>
            <strong>{title}</strong>
          </div>
          <button className="chat-head-icon" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
        <div className={styles.detailsScroll}>{children}</div>
    </aside>
  );

  if (desktop) {
    // Desktop details are a real third workspace column, not a portal or
    // overlay. This keeps the inbox, thread, and CRM context visible together.
    return <aside className={styles.detailsDesktop}>{sheet}</aside>;
  }

  return (
    <div className={styles.detailsBackdrop} role="presentation">
      <button
        aria-label="Close customer details"
        className={styles.detailsBackdropClose}
        onClick={onClose}
        type="button"
      />
      {sheet}
    </div>
  );
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

async function fetchConversations(input: {
  audience: DummyConversationRole;
  customerId?: string;
  conversationId?: string;
  includeSupportData?: boolean;
  supportOnly?: boolean;
  limit?: number;
  serviceId?: string;
  tenantId?: string;
  agentId?: string | null;
  signal?: AbortSignal;
}) {
  if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  let conversations: DummyConversationView[] = [];
  let pagination: DummyConversationListResponse["pagination"];
  if (!input.supportOnly) {
    const payload = await aicloserApi.conversations.listViews({ limit: Math.min(input.limit ?? 100, 100), search: undefined });
    conversations = payload.conversations;
    pagination = payload.pagination;
    if (input.conversationId) {
      const selected = conversations.find((conversation) => conversation.id === input.conversationId);
      try {
        // A deep-linked chat may fall outside the first page of the central inbox.
        // Hydrate it directly so refresh never silently opens the wrong conversation.
        const hydrated = await aicloserApi.conversations.getView(input.conversationId, 100, selected as unknown as Record<string, unknown>);
        conversations = selected
          ? conversations.map((conversation) => conversation.id === selected.id ? { ...conversation, ...hydrated } : conversation)
          : [hydrated, ...conversations];
      } catch {
        // Keep the first-page summaries visible if history hydration is temporarily unavailable.
      }
    }
  }

  if (input.includeSupportData) {
    // These workspace resources use the same-origin server bridge so the
    // authenticated session cookie reaches the live API reliably. Calling the
    // live host directly from the browser silently dropped that cookie.
    const [supportResponse, stageResponse] = await Promise.all([
      fetch("/api/v1/chat/support", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null),
      // Use the authenticated same-origin bridge so Chat and CRM Kanban read
      // the same Central API workspace stages without dropping the session.
      fetch("/api/v1/stages", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null),
    ]);
    const supportPayload = supportResponse?.ok
      ? await supportResponse.json().catch(() => null) as {
          data?: { team?: unknown[]; stages?: unknown[] | { stages?: unknown[] }; templates?: unknown[] };
        } | null
      : null;

    const rawTeam = Array.isArray(supportPayload?.data?.team) ? supportPayload.data.team : [];
    const assignableEditors: DummyAssignableEditor[] = rawTeam
      .filter((member: any) => {
        const role = String(member?.role ?? "").toUpperCase();
        const status = String(member?.status ?? "").toUpperCase();
        return role !== "ADMIN" && role !== "SUPER_ADMIN" && status !== "SUSPENDED" && status !== "INACTIVE";
      })
      .map((member: any) => {
        const assigned = Math.max(0, Number(member?.assignedLeadsCount ?? 0));
        const capacity = Math.max(0, Number(member?.maxActiveLeads ?? 0));
        const utilization = capacity > 0 ? assigned / capacity : 0;
        const workloadBand: DummyAssignableEditor["workloadBand"] = utilization >= 0.9
          ? "Near Capacity"
          : utilization >= 0.7
            ? "Busy"
            : utilization >= 0.35
              ? "Moderate"
              : "Low";

        return {
          id: String(member?.id ?? member?.userId ?? ""),
          name: String(member?.displayName ?? member?.email ?? "Team member"),
          specialties: [],
          workloadBand,
          karmaScore: 0,
          onlineStatus: String(member?.status ?? "").toUpperCase() === "ACTIVE" ? "online" : "offline",
          acceptingProjects: member?.canClaimLeads !== false && String(member?.status ?? "").toUpperCase() === "ACTIVE",
        };
      })
      .filter((member) => member.id);

    const stageJson = stageResponse?.ok
      ? await stageResponse.json().catch(() => null) as { data?: unknown; stages?: unknown } | null
      : null;
    const liveStages = Array.isArray(stageJson?.data)
      ? stageJson.data
      : Array.isArray(stageJson?.stages)
        ? stageJson.stages
        : [];
    const stagePayload = liveStages.length > 0 ? liveStages : supportPayload?.data?.stages;
    const rawStages = Array.isArray(stagePayload)
      ? stagePayload
      : stagePayload && typeof stagePayload === "object" && Array.isArray((stagePayload as { stages?: unknown[] }).stages)
        ? (stagePayload as { stages: unknown[] }).stages
        : [];
    const leadStatuses: DummyLeadStatus[] = (Array.isArray(rawStages) ? rawStages : [])
      .map((stage: any, index) => {
        const id = String(stage?.key ?? stage?.id ?? "").trim();
        const label = String(stage?.label ?? stage?.name ?? "").trim();
        const normalized = `${id} ${label}`.toLowerCase();
        const tone: DummyLeadStatusTone = /closed|won|paid|qualified|interested/.test(normalized)
          ? "success"
          : /lost|recycled/.test(normalized)
            ? "neutral"
            : /follow|training|booked|demo|pending/.test(normalized)
              ? "warning"
              : "accent";
        return {
          id,
          label,
          tone,
          order: Number(stage?.order ?? stage?.position ?? index + 1),
          active: stage?.active !== false && stage?.isActive !== false,
        };
      })
      .filter((status) => status.id && status.label);

    const liveStageByAlias = new Map<string, DummyLeadStatus>();
    leadStatuses.forEach((status) => {
      [status.id, status.label]
        .map((value) => value.toLowerCase().replace(/[\s-]+/g, "_"))
        .filter(Boolean)
        .forEach((alias) => liveStageByAlias.set(alias, status));

      // Conversations created before the workspace pipeline was centralized
      // can still carry the older status vocabulary. Point those values at
      // the matching live stage without creating a second/fake stage list.
      const liveKeys = [status.id, status.label]
        .map((value) => value.toLowerCase().replace(/[\s-]+/g, "_"));
      const compatibilityAliases: Record<string, string[]> = {
        new: ["new_lead", "new_leads", "assigned"],
        in_progress: ["interested", "qualified", "interested_qualified"],
        demo_scheduled: ["demo_booked", "training_booked", "webinar_invited", "webinar_attended"],
        follow_up: ["follow_up_needed", "followup"],
        closed_won: ["closed", "won"],
        closed_lost: ["lost", "recycled"],
      };
      Object.entries(compatibilityAliases).forEach(([liveKey, aliases]) => {
        if (liveKeys.some((key) => key === liveKey || key.startsWith(`${liveKey}_`))) {
          aliases.forEach((alias) => liveStageByAlias.set(alias, status));
        }
      });
    });
    conversations = conversations.map((conversation) => {
      const rawStage = String(conversation.leadStage || conversation.leadStatusId || "").trim();
      const liveStage = liveStageByAlias.get(rawStage.toLowerCase().replace(/[\s-]+/g, "_"));
      if (!liveStage) {
        const derivedLabel = rawStage
          ? rawStage.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
          : "";
        return rawStage
          ? { ...conversation, leadStatusId: rawStage.toUpperCase().replace(/[\s-]+/g, "_"), leadStatusLabel: derivedLabel, leadStatusTone: "neutral" as DummyLeadStatusTone }
          : { ...conversation, leadStatusId: "", leadStatusLabel: "", leadStatusTone: "neutral" as DummyLeadStatusTone };
      }
      return {
        ...conversation,
        leadStatusId: liveStage.id,
        leadStatusLabel: liveStage.label,
        leadStatusTone: liveStage.tone,
      };
    });

    const rawTemplates = Array.isArray(supportPayload?.data?.templates)
      ? supportPayload.data.templates
      : [];
    const templates: DummyConversationTemplate[] = rawTemplates
      .map((template: any) => ({
        id: String(template?.id ?? ""),
        title: String(template?.name ?? template?.title ?? "Untitled template"),
        category: String(template?.category ?? "UTILITY"),
        content: String(template?.bodyText ?? template?.body ?? template?.versions?.[0]?.bodyText ?? ""),
      }))
      .filter((template) => template.id);

    return {
      ok: true,
      supportDataIncluded: true,
      conversations,
      assignableEditors,
      leadStatuses,
      templates,
      pagination,
    } as { ok: boolean; supportDataIncluded?: boolean } & DummyConversationListResponse;
  }

  return {
    ok: true,
    supportDataIncluded: false,
    conversations,
    assignableEditors: [],
    leadStatuses: [],
    templates: [],
    pagination,
  } as { ok: boolean; supportDataIncluded?: boolean } & DummyConversationListResponse;
}

function buildAgencyDirectPreview(amount: number) {
  const normalizedAmount = Math.max(0, Math.round(Number(amount || 0)));
  return {
    planLabel: "Agency direct",
    platformPercentage: 0,
    editorPercentage: 100,
    editorShare: normalizedAmount,
    platformShare: 0,
  };
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Blob read failed"));
    reader.readAsDataURL(blob);
  });
}

async function fetchFreelancerPaymentDetails() {
  const response = await fetch("/api/freelancer/payment-details", { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as { paymentDetails?: { upiId?: string; bankAccountName?: string } } | null;
  if (!response.ok) {
    return { upiId: "", payeeName: "" };
  }
  return {
    upiId: payload?.paymentDetails?.upiId?.trim() ?? "",
    payeeName: payload?.paymentDetails?.bankAccountName?.trim() ?? "",
  };
}

async function fetchConversationProfilePicture(conversationId: string, options?: { refresh?: boolean; signal?: AbortSignal }) {
  const params = new URLSearchParams();
  if (options?.refresh) {
    params.set("refresh", "1");
  }
  const url = params.size
    ? `/api/conversations/${conversationId}/whatsapp-profile-picture?${params.toString()}`
    : `/api/conversations/${conversationId}/whatsapp-profile-picture`;
  const response = await fetch(url, { cache: "no-store", signal: options?.signal });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; customerProfileImageUrl?: string } | null;
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error ?? "Profile picture could not be loaded.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload.customerProfileImageUrl?.trim() ?? "";
}

function getLatestIncomingMessage(
  conversation: DummyConversationView | null | undefined,
  audience: DummyConversationRole,
) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  return [...messages]
    .reverse()
    .find((message) => isConversationMessageIncomingForAudience(message, audience)) ?? null;
}

function getConversationMessageKey(message: DummyConversationView["messages"][number]) {
  return `${message.id}:${message.createdAt}`;
}

function summarizeIncomingMessage(
  message: DummyConversationView["messages"][number],
  audience: DummyConversationRole,
) {
  return summarizeMessagePreview(message, audience);
}

function getPreferredConversationLane(conversation: DummyConversationView, audience: DummyConversationRole) {
  if (audience === "customer") {
    return "customer" as const;
  }

  // Sales needs the customer-facing conversation first so the full lead context is visible.
  // Internal/system events remain available through the lane toggle in the header.
  const preferredLane = audience === "sales" ? "customer" : (conversation.unreadCountByLane?.internal ?? 0) > 0 ? "internal" : conversation.preferredLane ?? "customer";
  const visibleLanes = Array.isArray(conversation.visibleLanes) ? conversation.visibleLanes : [];
  return visibleLanes.includes(preferredLane) ? preferredLane : (visibleLanes[0] ?? "customer");
}

function CentralRecordingAudio({ callId }: { callId: string }) {
  const [source, setSource] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setSource("");
    setError("");
    aicloserApi.calls.getRecordingBlob(callId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Recording unavailable");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [callId]);

  if (error) return <span style={{ fontSize: "10px", color: "#fca5a5" }}>{error}</span>;
  if (!source) return <span style={{ fontSize: "10px", opacity: 0.6 }}>Loading recording...</span>;
  return <audio controls preload="metadata" src={source} style={{ width: "100%", height: "30px", marginTop: "4px" }} />;
}

function ChatWorkspaceInner({
  audience,
  customerId = "",
  serviceIdFilter = "",
  tenantId = "",
  selectedAgentId = null,
  centralToken = null,
}: ChatWorkspaceProps) {
  if (centralToken) {
    setStoredToken(centralToken);
  }
  const searchParams = useSearchParams();
  const [titleActionHost, setTitleActionHost] = useState<HTMLElement | null>(null);
  const [chatSearchHost, setChatSearchHost] = useState<HTMLElement | null>(null);
  const requestedConversationId = searchParams?.get("conversationId") ?? "";
  const phonePePaymentStatus = searchParams?.get("phonepePaymentStatus") ?? "";
  const phonePePaymentMessage = searchParams?.get("phonepePaymentMessage") ?? "";
  const instagramConnected = searchParams?.get("instagramConnected") ?? "";
  const instagramError = searchParams?.get("instagramError") ?? "";
  const [conversations, setConversations] = useState<DummyConversationView[]>([]);
  const [assignableEditors, setAssignableEditors] = useState<DummyAssignableEditor[]>([]);
  // Statuses are workspace data. Keep the initial state empty so legacy
  // labels can never appear before the live API responds.
  const [leadStatuses, setLeadStatuses] = useState<DummyLeadStatus[]>([]);
  const [templates, setTemplates] = useState<DummyConversationTemplate[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [isCompactChatLayout, setIsCompactChatLayout] = useState(false);
  const [isMobileThreadViewOpen, setIsMobileThreadViewOpen] = useState(false);
  const [activeLane, setActiveLane] = useState<DummyConversationLane>(audience === "freelancer" ? "customer" : "customer");
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(() => parseChannelFilter(searchParams?.get("channel") ?? null));
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false);
  const [agencyFilter, setAgencyFilter] = useState<AgencyFilter>("all");
  const [searchValue, setSearchValue] = useState("");
  const deferredSearchValue = useDeferredValue(searchValue);
  const [messageDraft, setMessageDraft] = useState("");
  const [whatsappTransport, setWhatsappTransport] = useState<"company" | "connected_user">("company");
  const [hideCustomerMessageFromFreelancer, setHideCustomerMessageFromFreelancer] = useState(false);
  const [assignmentRejectReason, setAssignmentRejectReason] = useState("");
  const [isRejectingAssignment, setIsRejectingAssignment] = useState(false);
  const [composerStatus, setComposerStatus] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatusView | null>(null);
  const [isEmojiTrayOpen, setIsEmojiTrayOpen] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isConvertingVoice, setIsConvertingVoice] = useState(false);
  const [isMicHelpOpen, setIsMicHelpOpen] = useState(false);
  const [micHelpMessage, setMicHelpMessage] = useState("");
  const [micPermissionState, setMicPermissionState] = useState<MicPermissionState>("unknown");
  const [micLastError, setMicLastError] = useState<MicErrorInfo | null>(null);
  const [micDiagnostics, setMicDiagnostics] = useState<MicDiagnostics | null>(null);

  useEffect(() => {
    setTitleActionHost(document.querySelector<HTMLElement>("[data-chat-title-actions]"));
    setChatSearchHost(document.querySelector<HTMLElement>("[data-chat-search-host]"));
  }, []);

  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [assignedFilter, setAssignedFilter] = useState<AssignedFilter>("all");
  const [paymentPendingOnly, setPaymentPendingOnly] = useState(false);
  const [leadStatusFilterId, setLeadStatusFilterId] = useState("all");
  const [isAssignMenuOpen, setIsAssignMenuOpen] = useState(false);
  const [isSendingAssignmentOffer, setIsSendingAssignmentOffer] = useState(false);
  const [isAssigningDirectly, setIsAssigningDirectly] = useState(false);
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);
  const [assignSearchValue, setAssignSearchValue] = useState("");
  const [assignCategoryFilter, setAssignCategoryFilter] = useState("all");
  const [selectedAssignEditorIds, setSelectedAssignEditorIds] = useState<string[]>([]);
  const [assignmentDetailsDraft, setAssignmentDetailsDraft] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"replace" | "viewer">("replace");
  const [isLeadStatusMenuOpen, setIsLeadStatusMenuOpen] = useState(false);
  const leadStatusPickerRef = useRef<HTMLDivElement | null>(null);
  const [leadStatusMenuPosition, setLeadStatusMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [isCreateLabelModalOpen, setIsCreateLabelModalOpen] = useState(false);
  const [customLabelSelectedColor, setCustomLabelSelectedColor] = useState<WhatsAppLabelColor>(WHATSAPP_LABEL_COLORS[0]);
  const [isNotesMenuOpen, setIsNotesMenuOpen] = useState(false);
  const [notesPopoverMode, setNotesPopoverMode] = useState<"notes" | "callback">("notes");
  const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [isNotesSaving, setIsNotesSaving] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusLabel, setEditingStatusLabel] = useState("");
  const [editingStatusTone, setEditingStatusTone] = useState<DummyLeadStatusTone>("neutral");
  const [editingStatusActive, setEditingStatusActive] = useState(true);
  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [newStatusTone, setNewStatusTone] = useState<DummyLeadStatusTone>("accent");

  useEffect(() => {
    if (!isLeadStatusMenuOpen) {
      setLeadStatusMenuPosition(null);
      return;
    }

    const updateLeadStatusMenuPosition = () => {
      const picker = leadStatusPickerRef.current;
      if (!picker) return;
      const rect = picker.getBoundingClientRect();
      const menuWidth = Math.min(280, Math.max(220, window.innerWidth - 32));
      const left = Math.min(Math.max(16, rect.right - menuWidth), Math.max(16, window.innerWidth - menuWidth - 16));
      setLeadStatusMenuPosition({ top: rect.bottom + 6, left });
    };

    updateLeadStatusMenuPosition();
    window.addEventListener("resize", updateLeadStatusMenuPosition);
    window.addEventListener("scroll", updateLeadStatusMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateLeadStatusMenuPosition);
      window.removeEventListener("scroll", updateLeadStatusMenuPosition, true);
    };
  }, [isLeadStatusMenuOpen]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [crmDetails, setCrmDetails] = useState<{
    lead: any;
    calls: Array<{
      id: string;
      customerName: string;
      phoneNumber: string;
      durationSeconds: number;
      outcome: string;
      note: string;
      recordingStatus: string;
      recordingUploadId?: string | null;
      startedAt: string;
    }>;
    salesTimeline: Array<{ id: string; type: string; body: string; createdAt: string }>;
    history: LeadHistoryEntry[];
    deals: any[];
    tasks: any[];
    webinars: any[];
  } | null>(null);
  const [isCrmDetailsLoading, setIsCrmDetailsLoading] = useState(false);
  const [isClientAliasModalOpen, setIsClientAliasModalOpen] = useState(false);
  const [clientAliasValue, setClientAliasValue] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatCustomerName, setNewChatCustomerName] = useState("");
  const [newChatCustomerPhone, setNewChatCustomerPhone] = useState("");
  const [newChatServiceId, setNewChatServiceId] = useState("");
  const [newChatTemplateId, setNewChatTemplateId] = useState("");
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentTitle, setPaymentTitle] = useState("Project advance");
  const [paymentProjectTitle, setPaymentProjectTitle] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentDueLabel, setPaymentDueLabel] = useState("");
  const [freelancerPayeeUpiId, setFreelancerPayeeUpiId] = useState("");
  const [freelancerPayeeName, setFreelancerPayeeName] = useState("");
  const [isFreelancerAccessSaving, setIsFreelancerAccessSaving] = useState(false);
  const [isAiToggleSaving, setIsAiToggleSaving] = useState(false);
  const [dripState, setDripState] = useState<{
    audienceCategory: string;
    currentStage: number;
    paused: boolean;
    completed: boolean;
    lastDripSentAt?: string;
  } | null>(null);
  const [isDripSaving, setIsDripSaving] = useState(false);
  const [isInboxLoading, setIsInboxLoading] = useState(true);
  const [hydratingConversationId, setHydratingConversationId] = useState("");
  const [isMessageSending, setIsMessageSending] = useState(false);
  const [isNotificationSetupSaving, setIsNotificationSetupSaving] = useState(false);
  const [notificationSetupStatus, setNotificationSetupStatus] = useState<ChatNotificationSetupStatus>("idle");
  const [hasLoadedSupportData, setHasLoadedSupportData] = useState(false);
  const [isSupportDataLoading, setIsSupportDataLoading] = useState(false);
  const [presenceNowMs, setPresenceNowMs] = useState(() => Date.now());

  function buildLeadHistory(response: Lead360Response, calls: Array<{ id: string; outcome: string; note: string; durationSeconds: number; startedAt: string }>) {
    const history: LeadHistoryEntry[] = [];
    const seen = new Set<string>();
    const add = (entry: LeadHistoryEntry) => {
      if (!entry.id || seen.has(entry.id)) return;
      seen.add(entry.id);
      history.push({ ...entry, kind: entry.kind || "ACTIVITY", title: entry.title || "Activity" });
    };

    // Central API history is authoritative for audit events. The additional
    // collections below are deliberately merged as a compatibility fallback
    // for older API responses that returned notes/calls/tasks separately.
    for (const entry of response.history ?? []) add(entry);
    for (const entry of response.timelineNotes ?? response.timeline ?? []) {
      add({
        id: `timeline:${entry.id}`,
        kind: entry.type ?? "NOTE",
        title: entry.type === "NOTE" ? "Note added" : entry.type ?? "Activity",
        body: entry.body,
        createdAt: entry.createdAt,
        actorName: entry.author?.name ?? null,
      });
    }
    for (const rawEntry of response.activityLogs ?? []) {
      const entry = rawEntry as Record<string, unknown>;
      const action = String(entry.action ?? "Activity").replace(/_/g, " ");
      const actor = entry.actor as Record<string, unknown> | undefined;
      add({
        id: `activity:${String(entry.id ?? history.length)}`,
        kind: "ACTIVITY",
        title: action,
        body: String(entry.note ?? action),
        createdAt: String(entry.createdAt ?? new Date().toISOString()),
        actorName: actor ? String(actor.displayName ?? actor.email ?? "") || null : null,
        metadata: (entry.metadata as Record<string, unknown> | null | undefined) ?? null,
      });
    }
    for (const task of response.tasks ?? []) {
      if (!task.id || !task.createdAt) continue;
      add({
        id: `task:${task.id}`,
        kind: "CALLBACK",
        title: task.title || "Follow-up scheduled",
        body: task.description || "Follow-up task created for this lead.",
        createdAt: task.createdAt,
        dueAt: task.dueAt ?? null,
        status: task.status,
      });
    }
    for (const call of calls) {
      add({
        id: `call:${call.id}`,
        kind: "CALL",
        title: "Call completed",
        body: [call.outcome, call.note, call.durationSeconds ? `${call.durationSeconds}s` : null].filter(Boolean).join(" · ") || "Call activity recorded.",
        createdAt: call.startedAt,
      });
    }
    for (const payment of response.payments ?? []) {
      add({
        id: `payment:${payment.id}`,
        kind: "PAYMENT",
        title: "Payment request updated",
        body: `${payment.status}${payment.totalAmount != null ? ` · ${payment.currency} ${payment.totalAmount}` : ""}`,
        createdAt: payment.createdAt,
      });
    }

    return history.sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });
  }

  function mapCentralCrmDetails(response: Lead360Response) {
    const calls = (response.callLogs ?? response.calls ?? []).map((call) => ({
      id: call.id,
      customerName: call.assignment?.customerName ?? response.lead.customerName,
      phoneNumber: call.phoneNumber || call.assignment?.customerPhone || response.lead.customerPhone,
      durationSeconds: Number(call.durationSeconds ?? 0),
      outcome: call.outcome ?? "",
      note: call.note ?? "",
      recordingStatus: call.recordingStatus ?? "NONE",
      recordingUploadId: call.recordingUploadId ?? null,
      startedAt: call.startedAt,
    }));
    return {
      lead: response.lead,
      calls,
      salesTimeline: (response.timelineNotes ?? response.timeline ?? []).map((entry) => ({
        id: entry.id,
        type: entry.type ?? "NOTE",
        body: entry.body,
        createdAt: entry.createdAt,
      })),
      history: buildLeadHistory(response, calls),
      deals: response.payments ?? [],
      tasks: response.tasks ?? [],
      webinars: [],
    };
  }

  const recordingIntervalRef = useRef<number | null>(null);
  const lastPayloadSignatureRef = useRef("");
  const readRequestRef = useRef("");
  const messageSendLockRef = useRef(false);
  const inboxLoadPromiseRef = useRef<Promise<void> | null>(null);
  const inboxAbortControllerRef = useRef<AbortController | null>(null);
  const conversationHydrationRequestRef = useRef(0);
  const supportDataLoadPromiseRef = useRef<Promise<void> | null>(null);
  const syncBurstTimeoutsRef = useRef<number[]>([]);
  const latestConversationsRef = useRef<DummyConversationView[]>([]);
  const profilePictureAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const notificationAudioContextRef = useRef<AudioContext | null>(null);
  const notificationAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const customNotificationSoundUnavailableRef = useRef(false);
  const foregroundPushUnsubscribeRef = useRef<(() => void) | null>(null);
  const recentForegroundPushRef = useRef<{ conversationId: string; at: number } | null>(null);
  const hasInitializedNotificationsRef = useRef(false);
  const lastIncomingMessageKeysRef = useRef<Record<string, string>>({});
  const conversationEventsLastSignatureRef = useRef("");
  const conversationEventsRefreshTimeoutRef = useRef<number | null>(null);
  const notificationPermissionRef = useRef<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied",
  );
  const localFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const railScrollRef = useRef<HTMLDivElement | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioMuteRef = useRef<GainNode | null>(null);
  const mp3EncoderRef = useRef<Mp3EncoderInstance | null>(null);
  const mp3ChunksRef = useRef<Uint8Array[]>([]);
  const voiceCaptureModeRef = useRef<"media" | "direct">("media");
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingSecondsRef = useRef(0);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingConversationIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const shouldAutoScrollRef = useRef(true);
  const lastConversationIdRef = useRef<string | null>(null);
  const laneSyncConversationIdRef = useRef<string | null>(null);
  const requestedConversationAppliedRef = useRef("");
  const requestedProfilePictureIdsRef = useRef<Set<string>>(new Set());
  const refreshedProfilePictureIdsRef = useRef<Set<string>>(new Set());
  const failedProfilePictureRetryAtRef = useRef<Map<string, number>>(new Map());
  const typingStopTimeoutRef = useRef<number | null>(null);
  const typingHeartbeatIntervalRef = useRef<number | null>(null);
  const outboundTypingStateRef = useRef<{ conversationId: string; lane: DummyConversationLane; active: boolean } | null>(null);

  const cleanupDirectMp3 = useCallback(() => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.onaudioprocess = null;
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    if (audioMuteRef.current) {
      audioMuteRef.current.disconnect();
      audioMuteRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    mp3EncoderRef.current = null;
    mp3ChunksRef.current = [];
  }, []);

  const agencyFilterOptions = useMemo(() => {
    const items = new Map<
      string,
      {
        tenantId: string;
        agencyName: string;
      }
    >();
    conversations.forEach((conversation) => {
      if (conversation.agencyContext?.tenantId) {
        items.set(conversation.agencyContext.tenantId, {
          tenantId: conversation.agencyContext.tenantId,
          agencyName: conversation.agencyContext.agencyName,
        });
      }
    });
    return Array.from(items.values());
  }, [conversations]);

  const filteredAssignableEditors = useMemo(() => {
    const query = assignSearchValue.trim().toLowerCase();
    const category = assignCategoryFilter.trim().toLowerCase();
    return assignableEditors.filter((editor) => {
      const editorSpecialties = Array.isArray(editor.specialties) ? editor.specialties : [];
      const specialties = editorSpecialties.map((specialty) => specialty.trim().toLowerCase().replace(/\s+/g, " "));
      if (category !== "all" && !specialties.includes(category)) return false;
      if (!query) return true;
      const haystack = `${editor.name} ${editorSpecialties.join(" ")} ${editor.workloadBand} ${editor.karmaScore}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [assignCategoryFilter, assignSearchValue, assignableEditors]);

  const assignCategoryOptions = useMemo(() => {
    const categories = new Map<string, string>();
    assignableEditors.forEach((editor) => {
      const editorSpecialties = Array.isArray(editor.specialties) ? editor.specialties : [];
      editorSpecialties.forEach((specialty) => {
        const normalized = specialty.trim().toLowerCase().replace(/\s+/g, " ");
        if (normalized && !categories.has(normalized)) {
          categories.set(normalized, specialty.trim());
        }
      });
    });
    return Array.from(categories.entries()).map(([value, label]) => ({ value, label })).slice(0, 12);
  }, [assignableEditors]);

  const filteredAssignableEditorIds = useMemo(
    () => filteredAssignableEditors.map((editor) => editor.id),
    [filteredAssignableEditors],
  );
  const allFilteredAssignableEditorsSelected =
    filteredAssignableEditorIds.length > 0 && filteredAssignableEditorIds.every((id) => selectedAssignEditorIds.includes(id));

  const filteredConversations = useMemo(() => {
    const query = deferredSearchValue.trim().toLowerCase();
    const selectedStage = leadStatuses.find((status) => status.id === leadStatusFilterId);
    const normalizeStageAlias = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    const selectedStageAliases = selectedStage
      ? new Set([selectedStage.id, selectedStage.label].map(normalizeStageAlias).filter(Boolean))
      : new Set<string>();
    return conversations.filter((conversation) => {
      const assignmentSummary = conversation.assignmentSummary;
      const sourceChannel = getConversationSourceChannel(conversation);
      const haystack = [
        conversation.customerDisplayName,
        conversation.serviceTitle,
        conversation.summary,
        conversation.leadStatusLabel,
        sourceChannel === "instagram" ? "instagram" : sourceChannel === "whatsapp" ? "whatsapp" : "in app",
        assignmentSummary?.assignedFreelancerName ?? conversation.assignedFreelancerName ?? "",
        conversation.ownerName ?? "",
        conversation.agencyContext?.agencyName ?? "",
        conversation.agencyContext?.location ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (channelFilter === "whatsapp") {
        if (sourceChannel !== "whatsapp") return false;
      } else if (channelFilter === "whatsapp_company") {
        if (conversation.externalSourceType === "whatsapp_personal" || conversation.externalSourceType === "whatsapp_business") return false;
      } else if (channelFilter === "whatsapp_connected") {
        if (conversation.externalSourceType !== "whatsapp_personal" && conversation.externalSourceType !== "whatsapp_business") return false;
      } else if (channelFilter === "instagram") {
        if (sourceChannel !== "instagram") return false;
      }
      if (agencyFilter !== "all" && conversation.agencyContext?.tenantId !== agencyFilter) return false;
      if (query && !haystack.includes(query)) return false;
      if (activeFilter === "unread" && conversation.unreadCount === 0) return false;
      if (activeFilter === "mine") {
        if (audience !== "freelancer" && conversation.ownerRole !== audience && !conversation.ownerName) return false;
      }
      if (activeFilter === "waiting" && !isWaitingConversation(conversation)) return false;
      if (activeFilter === "paused" && !conversation.aiAutoReplyDisabled) return false;
      if (assignedFilter === "assigned" && !assignmentSummary?.assignedFreelancerId) return false;
      if (assignedFilter === "unassigned" && assignmentSummary?.assignedFreelancerId) return false;
      if (paymentPendingOnly && conversation.leadStatusId !== "payment-pending") return false;
      if (leadStatusFilterId !== "all") {
        const conversationStageAliases = [conversation.leadStatusId, conversation.leadStatusLabel, conversation.leadStage]
          .map(normalizeStageAlias)
          .filter(Boolean);
        if (!selectedStage || !conversationStageAliases.some((alias) => selectedStageAliases.has(alias))) return false;
      }
      return true;
    }).sort((a, b) => {
      const timeA = a.messages?.at(-1)?.createdAt || a.lastCustomerActivityAt || a.updatedAt || "";
      const timeB = b.messages?.at(-1)?.createdAt || b.lastCustomerActivityAt || b.updatedAt || "";
      return timeB.localeCompare(timeA);
    });
  }, [activeFilter, agencyFilter, assignedFilter, audience, channelFilter, conversations, deferredSearchValue, leadStatusFilterId, leadStatuses, paymentPendingOnly]);

  const activeConversation = selectedConversationId
    ? filteredConversations.find((conversation) => conversation.id === selectedConversationId) ?? null
    : null;
  const activeAssignment = activeConversation?.assignmentSummary ?? null;
  const activeConversationId = activeConversation?.id ?? null;
  const normalizedVisibleLanes = useMemo<DummyConversationLane[]>(() => {
    const activeVisibleLanes = (Array.isArray(activeConversation?.visibleLanes) ? activeConversation.visibleLanes : []).filter(
      (lane): lane is DummyConversationLane => lane === "customer" || lane === "internal",
    );
    return activeVisibleLanes.length > 0 ? activeVisibleLanes : (["customer", "internal"] as DummyConversationLane[]);
  }, [activeConversation?.visibleLanes]);
  const resolvedLane: DummyConversationLane = useMemo(() => {
    if (audience === "customer") return "customer";
    if (audience === "sales") return "customer";
    return normalizedVisibleLanes.includes(activeLane) ? activeLane : (normalizedVisibleLanes[0] ?? "customer");
  }, [activeLane, audience, normalizedVisibleLanes]);
  const lastActiveConversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isNotesSaving) return;
    const conversationChanged = lastActiveConversationIdRef.current !== activeConversationId;
    lastActiveConversationIdRef.current = activeConversationId;
    if (conversationChanged) {
      setNotesDraft(activeConversation?.internalNotes ?? "");
      setFollowUpDraft(activeConversation?.nextFollowUpAt ? activeConversation.nextFollowUpAt.slice(0, 16) : "");
    } else if (activeConversation?.internalNotes !== undefined) {
      setNotesDraft(activeConversation.internalNotes);
      setFollowUpDraft(activeConversation.nextFollowUpAt ? activeConversation.nextFollowUpAt.slice(0, 16) : "");
    }
  }, [activeConversationId, activeConversation?.internalNotes, activeConversation?.nextFollowUpAt, isNotesSaving]);

  useEffect(() => {
    if (!activeConversation?.id) {
      setDripState(null);
      return;
    }
    let isCancelled = false;
    fetch(`/api/conversations/${activeConversation.id}/drip`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCancelled && data?.drip) {
          setDripState(data.drip);
        }
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!isDetailsOpen || !activeConversation?.id) return;
    let isActive = true;
    setIsCrmDetailsLoading(true);
    const load = activeConversation.leadId
      ? aicloserApi.leads.get360(activeConversation.leadId).then((data) => {
          if (isActive) setCrmDetails(mapCentralCrmDetails(data));
        })
      : fetch(`/api/conversations/${encodeURIComponent(activeConversation.id)}/crm-details`, { cache: "no-store" })
          .then((res) => res.json())
          .then((data) => {
            if (isActive && data?.ok) setCrmDetails(data.customer360);
          });
    load
      .catch(() => undefined)
      .finally(() => {
        if (isActive) setIsCrmDetailsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [isDetailsOpen, activeConversation?.id]);

  // Load the same CRM timeline for the compact notes/callback popover. The
  // customer drawer is intentionally closed while these actions are open.
  useEffect(() => {
    if (!isNotesMenuOpen || !activeConversation?.id) return;
    let isActive = true;
    setIsCrmDetailsLoading(true);
    const load = activeConversation.leadId
      ? aicloserApi.leads.get360(activeConversation.leadId).then((data) => {
          if (isActive) setCrmDetails(mapCentralCrmDetails(data));
        })
      : fetch(`/api/conversations/${encodeURIComponent(activeConversation.id)}/crm-details`, { cache: "no-store" })
          .then((res) => res.json())
          .then((data) => {
            if (isActive && data?.ok) setCrmDetails(data.customer360);
          });
    load
      .catch(() => undefined)
      .finally(() => {
        if (isActive) setIsCrmDetailsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [isNotesMenuOpen, activeConversation?.id, activeConversation?.leadId]);

  useEffect(() => {
    if (!isCompactChatLayout && activeConversation?.id) {
      setIsDetailsOpen(true);
    }
  }, [activeConversation?.id, isCompactChatLayout]);

  const activeFreelancerLanePermission = activeConversation?.freelancerCustomerLanePermission ?? null;
  const activePendingOffer = activeConversation?.myAssignmentOffer ?? activeAssignment?.myOffer ?? null;
  const activeCustomerName = sanitizeChatDisplayName(
    activeConversation?.customerDisplayName,
    activeConversation?.customerPhoneDisplay
  );
  const activeServiceTitle = activeConversation?.serviceTitle?.trim() || "";
  const activeCustomerPhone = cleanDisplayPhone(activeConversation?.customerPhoneDisplay) || "Customer contact hidden";
  const hasConnectedWhatsAppRoute = Boolean(
    activeConversation?.sourceChannel === "whatsapp" && (
      activeConversation.whatsappRoutes?.connectedUser ||
      activeConversation.externalSourceType === "whatsapp_personal" ||
      activeConversation.externalSourceType === "whatsapp_business" ||
      audience === "sales" ||
      audience === "admin" ||
      audience === "manager"
    ),
  );
  const hasCompanyWhatsAppRoute = Boolean(
    activeConversation?.sourceChannel === "whatsapp" && (
      activeConversation.whatsappRoutes?.company !== false ||
      activeConversation.externalSourceType === "company_whatsapp" ||
      !activeConversation.externalSourceType
    ),
  );

  useEffect(() => {
    if (!activeConversation || activeConversation.sourceChannel !== "whatsapp") {
      setWhatsappTransport("company");
      return;
    }
    const requestedTransport = searchParams?.get("transport");
    if (requestedTransport === "connected_user") {
      setWhatsappTransport("connected_user");
      return;
    }
    if (requestedTransport === "company") {
      setWhatsappTransport("company");
      return;
    }
    setWhatsappTransport(
      activeConversation.externalSourceType === "whatsapp_personal" || activeConversation.externalSourceType === "whatsapp_business" || !activeConversation.whatsappRoutes?.company
        ? "connected_user"
        : "company",
    );
  }, [activeConversation?.externalSourceType, activeConversation?.id, activeConversation?.sourceChannel, activeConversation?.whatsappRoutes?.company, searchParams]);
  const whatsappReplyWindow = useMemo(
    () => getWhatsAppReplyWindow(activeConversation, presenceNowMs),
    [activeConversation, presenceNowMs],
  );

  useEffect(() => {
    if (!activeConversation?.id) { setRegistrationStatus(null); return; }
    let cancelled = false;
    fetch(`/api/conversations/${activeConversation.id}/registration-status`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) {
          setRegistrationStatus(payload && typeof payload === "object" ? payload : { available: false });
          const isRegOrTrial = Boolean(
            payload?.registered === true ||
            payload?.billingState === "TRIAL" ||
            payload?.billingState === "PAID" ||
            payload?.billingState === "FREE"
          );
          const currentStage = String(activeConversation?.leadStatusId || "").toLowerCase();
          if (isRegOrTrial && (!currentStage || currentStage === "new" || currentStage === "new-leads")) {
            void handleLeadStatusChange("qualified");
          }
        }
      })
      .catch(() => { if (!cancelled) setRegistrationStatus({ available: false }); });
    return () => { cancelled = true; };
  }, [activeConversation?.id]);
  const activeCustomerHeaderContact = activeCustomerPhone;
  const appInstalled = Boolean(registrationStatus?.appInstalled);
  const registrationStateLabel = (value: boolean | undefined) => value === undefined ? "Unknown" : value ? "Yes" : "No";
  const registrationStateTone = (value: boolean | undefined) => value === undefined ? "neutral" : value ? "yes" : "no";
  const billingStateLabel = registrationStatus?.billingState === "PAID" ? "Paid" : registrationStatus?.billingState === "TRIAL" ? "Trial" : registrationStatus?.billingState === "TRIAL_EXPIRED" ? "Trial expired" : registrationStatus?.billingState === "PAYMENT_PENDING" ? "Payment pending" : registrationStatus?.billingState === "FREE" ? "Free" : "Unknown";
  const whatsappChannel = registrationStatus?.channels?.find((channel) => /whatsapp/i.test(channel.provider));
  const instagramChannel = registrationStatus?.channels?.find((channel) => /instagram/i.test(channel.provider));
  const whatsappMatchLabel = registrationStatus?.whatsappMatch === "MATCH" ? "Match" : registrationStatus?.whatsappMatch === "MISMATCH" ? "Mismatch" : "Unknown";
  useEffect(() => {
    if (isClientAliasModalOpen) {
      setClientAliasValue(activeCustomerName);
    }
  }, [activeCustomerName, isClientAliasModalOpen]);
  useEffect(() => {
    if (isPaymentModalOpen) {
      setPaymentProjectTitle(activeServiceTitle || activeConversation?.summary?.trim() || "General project");
    }
  }, [activeConversation?.id, activeConversation?.summary, activeServiceTitle, isPaymentModalOpen]);
  const paymentSplitPreview = useMemo(() => {
    if ((audience === "admin" || audience === "manager") && resolvedLane === "customer") {
      return buildAgencyDirectPreview(Number(paymentAmount || 0));
    }
    return buildSplitPreview(Number(paymentAmount || 0), activeAssignment?.assignedFreelancerId);
  }, [activeAssignment?.assignedFreelancerId, audience, paymentAmount, resolvedLane]);
  const laneMessages = (Array.isArray(activeConversation?.messages) ? activeConversation.messages : []).filter((message) => message.lane === resolvedLane);
  const isHydratingActiveConversation = Boolean(
    activeConversation?.id && hydratingConversationId === activeConversation.id && laneMessages.length === 0,
  );
  const typingMessage = (Array.isArray(activeConversation?.typing) ? activeConversation.typing : []).find((entry) => {
    if (entry.lane !== resolvedLane || entry.role === audience) {
      return false;
    }
    const updatedMs = Number(new Date(entry.updatedAt).getTime());
    return Number.isFinite(updatedMs) && presenceNowMs - updatedMs <= CHAT_TYPING_FRESH_WINDOW_MS;
  });
  const customerPresenceLabel = useMemo(() => {
    if (!activeConversation || audience === "customer" || resolvedLane !== "customer" || typingMessage) {
      return "";
    }

    let lastActiveMs = Number(new Date(activeConversation.lastCustomerActivityAt).getTime());
    if (!Number.isFinite(lastActiveMs)) {
      lastActiveMs = 0;
    }

    const messages = Array.isArray(activeConversation.messages) ? activeConversation.messages : [];
    const customerMessage = [...messages]
      .reverse()
      .find((message) => message.lane === "customer" && message.senderRole === "customer");
    if (customerMessage?.createdAt) {
      const messageMs = Number(new Date(customerMessage.createdAt).getTime());
      if (Number.isFinite(messageMs) && messageMs > lastActiveMs) {
        lastActiveMs = messageMs;
      }
    }

    const typingList = Array.isArray(activeConversation.typing) ? activeConversation.typing : [];
    const customerTypingUpdate = [...typingList]
      .reverse()
      .find((entry) => entry.lane === "customer" && entry.role === "customer");
    if (customerTypingUpdate?.updatedAt) {
      const typingMs = Number(new Date(customerTypingUpdate.updatedAt).getTime());
      if (Number.isFinite(typingMs) && typingMs > lastActiveMs) {
        lastActiveMs = typingMs;
      }
    }

    if (!lastActiveMs) {
      return "Offline";
    }

  if (presenceNowMs - lastActiveMs <= CHAT_ONLINE_WINDOW_MS) {
    return "Online";
  }

  return `Last reply ${formatPresenceAgoLabel(lastActiveMs, presenceNowMs)}`;
}, [activeConversation, audience, presenceNowMs, resolvedLane, typingMessage]);
  const normalizedDraft = typeof messageDraft === "string" ? messageDraft.trim() : "";
  const hasDraft = normalizedDraft.length > 0;
  const latestPaymentRequest = activeConversation?.latestPaymentRequest;
  const activeLaneCapabilities = activeConversation?.laneCapabilities as
    | Record<DummyConversationLane, { writable?: boolean; reason?: string }>
    | undefined;
  const showConversationRail = !isCompactChatLayout || !isMobileThreadViewOpen;
  const showConversationStage = !isCompactChatLayout || isMobileThreadViewOpen;
  const isFreelancerCustomerLane = audience === "freelancer" && resolvedLane === "customer";
  const isFreelancerCustomerLaneReadOnly =
    audience === "freelancer" && !Boolean(activeLaneCapabilities?.[resolvedLane]?.writable);
  const activeLaneReadOnlyReason =
    activeLaneCapabilities?.[resolvedLane]?.reason ||
    (resolvedLane === "customer"
      ? activeFreelancerLanePermission?.transportState === "blocked"
        ? activeFreelancerLanePermission.transportNote
        : "Direct client chat is still waiting for admin or manager access on this thread."
      : "Only the assigned team member can reply in this project lane.");
  const canManageFreelancerCustomerAccess =
    (audience === "admin" || audience === "manager") && Boolean(activeAssignment?.assignedFreelancerId);
  const canManagePayments = audience === "admin" || audience === "manager";
  const canRequestPaymentInternal = audience === "freelancer" && resolvedLane === "internal";
  const showPaymentAction = (canManagePayments && resolvedLane === "customer") || canRequestPaymentInternal;
  const showReviewFlowAction =
    resolvedLane === "customer" &&
    (audience === "admin" || audience === "manager" || (audience === "freelancer" && Boolean(activeFreelancerLanePermission?.enabled)));
  const paymentActionLabel = canRequestPaymentInternal ? "Generate bill" : "Send payment request";

  const micStatusLabel =
    micPermissionState === "denied"
      ? "Blocked"
      : micPermissionState === "granted"
        ? "Allowed"
        : micPermissionState === "prompt"
          ? "Needs permission"
          : micPermissionState === "unsupported"
            ? "Unsupported"
            : "Unknown";

  const shouldHydrateConversationProfilePicture = useCallback((conversation: DummyConversationView) => {
    if (requestedProfilePictureIdsRef.current.has(conversation.id)) {
      return false;
    }

    const retryAt = failedProfilePictureRetryAtRef.current.get(conversation.id) ?? 0;
    if (retryAt > Date.now()) {
      return false;
    }

    const normalizedImageUrl = normalizeAvatarImageUrl(conversation.customerProfileImageUrl);
    return !normalizedImageUrl || isMetaHostedAvatarUrl(normalizedImageUrl);
  }, []);

  const requestConversationProfilePicture = useCallback(
    (conversation: DummyConversationView, options?: { refresh?: boolean }) => {
      if (!isMountedRef.current || !shouldHydrateConversationProfilePicture(conversation)) {
        return;
      }

      requestedProfilePictureIdsRef.current.add(conversation.id);
      const controller = new AbortController();
      profilePictureAbortControllersRef.current.add(controller);

      void fetchConversationProfilePicture(conversation.id, {
        refresh: options?.refresh ?? isMetaHostedAvatarUrl(conversation.customerProfileImageUrl),
        signal: controller.signal,
      })
        .then((customerProfileImageUrl) => {
          if (!isMountedRef.current || controller.signal.aborted) {
            return;
          }

          failedProfilePictureRetryAtRef.current.delete(conversation.id);
          if (!normalizeAvatarImageUrl(customerProfileImageUrl)) {
            return;
          }

          setConversations((current) =>
            current.map((item) =>
              item.id === conversation.id
                ? {
                    ...item,
                    customerProfileImageUrl,
                  }
                : item,
            ),
          );
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }

          const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
          failedProfilePictureRetryAtRef.current.set(
            conversation.id,
            Date.now() + (status === 404 ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000),
          );
        })
        .finally(() => {
          profilePictureAbortControllersRef.current.delete(controller);
        });
    },
    [shouldHydrateConversationProfilePicture],
  );

  const abortChatBackgroundWork = useCallback(() => {
    inboxAbortControllerRef.current?.abort();
    inboxAbortControllerRef.current = null;
    profilePictureAbortControllersRef.current.forEach((controller) => controller.abort());
    profilePictureAbortControllersRef.current.clear();
    syncBurstTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    syncBurstTimeoutsRef.current = [];
    if (conversationEventsRefreshTimeoutRef.current) {
      window.clearTimeout(conversationEventsRefreshTimeoutRef.current);
      conversationEventsRefreshTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    latestConversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    const visibleCandidates = [
      activeConversation ?? undefined,
      ...filteredConversations.slice(0, CHAT_PROFILE_PICTURE_VISIBLE_LIMIT),
    ].filter((conversation, index, items): conversation is DummyConversationView => {
      if (!conversation) {
        return false;
      }
      return items.findIndex((item) => item?.id === conversation.id) === index;
    });

    const missingProfilePictures = visibleCandidates
      .filter(shouldHydrateConversationProfilePicture)
      .slice(0, CHAT_PROFILE_PICTURE_BATCH_SIZE);

    if (!missingProfilePictures.length) {
      return;
    }

    const timeout = window.setTimeout(() => {
      missingProfilePictures.forEach((conversation) => {
        requestConversationProfilePicture(conversation);
      });
    }, activeConversationId ? 0 : CHAT_PROFILE_PICTURE_BATCH_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [
    activeConversation,
    activeConversationId,
    filteredConversations,
    requestConversationProfilePicture,
    shouldHydrateConversationProfilePicture,
  ]);
  useEffect(() => {
    if (!activeConversationId || refreshedProfilePictureIdsRef.current.has(activeConversationId)) {
      return;
    }

    refreshedProfilePictureIdsRef.current.add(activeConversationId);
    const controller = new AbortController();
    profilePictureAbortControllersRef.current.add(controller);

    void fetchConversationProfilePicture(activeConversationId, { refresh: true, signal: controller.signal })
      .then((customerProfileImageUrl) => {
        if (!isMountedRef.current || controller.signal.aborted) {
          return;
        }

        failedProfilePictureRetryAtRef.current.delete(activeConversationId);
        if (!normalizeAvatarImageUrl(customerProfileImageUrl)) {
          refreshedProfilePictureIdsRef.current.delete(activeConversationId);
          return;
        }

        setConversations((current) =>
          current.map((item) =>
            item.id === activeConversationId
              ? {
                  ...item,
                  customerProfileImageUrl,
                }
              : item,
          ),
        );
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }

        const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
        if (status === 404) {
          failedProfilePictureRetryAtRef.current.set(activeConversationId, Date.now() + 24 * 60 * 60 * 1000);
          refreshedProfilePictureIdsRef.current.delete(activeConversationId);
          return;
        }
        failedProfilePictureRetryAtRef.current.set(activeConversationId, Date.now() + 5 * 60 * 1000);
        refreshedProfilePictureIdsRef.current.delete(activeConversationId);
      })
      .finally(() => {
        profilePictureAbortControllersRef.current.delete(controller);
      });
  }, [activeConversationId]);

  useEffect(() => {
    if (!isCompactChatLayout || !requestedConversationId) {
      return;
    }

    if (filteredConversations.some((conversation) => conversation.id === requestedConversationId)) {
      setIsMobileThreadViewOpen(true);
    }
  }, [filteredConversations, isCompactChatLayout, requestedConversationId]);

  useEffect(() => {
    if (!isCompactChatLayout || activeConversation) {
      return;
    }

    setIsMobileThreadViewOpen(false);
  }, [activeConversation, isCompactChatLayout]);

  useEffect(() => {
    if (!isCompactChatLayout || typeof window === "undefined") {
      return undefined;
    }

    const syncFromLocation = () => {
      if (window.location.hash === "#chat-thread") {
        setIsMobileThreadViewOpen(true);
        return;
      }
      setIsMobileThreadViewOpen(false);
    };

    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("hashchange", syncFromLocation);

    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener("hashchange", syncFromLocation);
    };
  }, [isCompactChatLayout]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 860px)");
    const syncCompactLayout = (event?: MediaQueryList | MediaQueryListEvent) => {
      const matches = event ? event.matches : mediaQuery.matches;
      setIsCompactChatLayout(matches);
    };

    syncCompactLayout();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncCompactLayout);
      return () => mediaQuery.removeEventListener("change", syncCompactLayout);
    }

    mediaQuery.addListener(syncCompactLayout);
    return () => mediaQuery.removeListener(syncCompactLayout);
  }, []);

  useEffect(() => {
    window.addEventListener("gigxomi:internal-navigation-start", abortChatBackgroundWork);
    return () => window.removeEventListener("gigxomi:internal-navigation-start", abortChatBackgroundWork);
  }, [abortChatBackgroundWork]);

  useEffect(() => {
    // React Strict Mode re-runs effect cleanup/setup during local development.
    // Reset the guard on setup so the first inbox response can update state
    // after that cycle instead of leaving the workspace stuck on Loading chats.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortChatBackgroundWork();
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      }
      cleanupDirectMp3();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (notificationAudioContextRef.current) {
        notificationAudioContextRef.current.close().catch(() => undefined);
        notificationAudioContextRef.current = null;
      }
      if (notificationAudioElementRef.current) {
        notificationAudioElementRef.current.pause();
        notificationAudioElementRef.current = null;
      }
      foregroundPushUnsubscribeRef.current?.();
      foregroundPushUnsubscribeRef.current = null;
    };
  }, [abortChatBackgroundWork, cleanupDirectMp3]);

  const playIncomingMessageChime = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    if (!customNotificationSoundUnavailableRef.current) {
      try {
        const audio = notificationAudioElementRef.current ?? new Audio(CHAT_NOTIFICATION_SOUND_URL);
        notificationAudioElementRef.current = audio;
        audio.currentTime = 0;
        audio.volume = 0.82;
        await audio.play();
        return;
      } catch {
        customNotificationSoundUnavailableRef.current = true;
      }
    }

    try {
      const AudioContextImpl =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextImpl) {
        return;
      }

      const context = notificationAudioContextRef.current ?? new AudioContextImpl();
      notificationAudioContextRef.current = context;
      if (context.state === "suspended") {
        await context.resume();
      }

      const now = context.currentTime;
      const masterGain = context.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
      masterGain.connect(context.destination);

      const pulse = (startAt: number, fromHz: number, toHz: number, peak = 0.7) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(fromHz, startAt);
        oscillator.frequency.exponentialRampToValueAtTime(toHz, startAt + 0.2);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);
        oscillator.connect(gain);
        gain.connect(masterGain);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.3);
      };

      pulse(now, 1040, 760, 0.78);
      pulse(now + 0.23, 1320, 920, 0.74);
      pulse(now + 0.5, 1120, 820, 0.68);
    } catch {
      // Browser audio alerts are best-effort only.
    }
  }, []);

  const showChatBrowserNotification = useCallback(
    async ({
      conversation,
      message,
    }: {
      conversation: DummyConversationView;
      message: DummyConversationView["messages"][number];
    }) => {
      if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
        return;
      }

      const deepLinkUrl = `${window.location.pathname}?conversationId=${encodeURIComponent(conversation.id)}`;
      const notificationOptions: NotificationOptions & { badge?: string; renotify?: boolean } = {
        body: summarizeIncomingMessage(message, audience),
        icon: new URL("/gigxomi-logo.png", window.location.origin).toString(),
        badge: new URL("/gigxomi-logo.png", window.location.origin).toString(),
        tag: `gigxomi-chat-${conversation.id}`,
        renotify: true,
        requireInteraction: true,
        data: {
          type: "CHAT_NEW_MESSAGE",
          conversationId: conversation.id,
          deepLinkUrl,
        },
      };

      try {
        const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/") : null;
        if (registration) {
          await registration.showNotification(conversation.customerDisplayName, notificationOptions);
          return;
        }
      } catch {
        // Fall back to the browser Notification constructor below.
      }

      try {
        const notification = new Notification(conversation.customerDisplayName, notificationOptions);
        notification.onclick = () => {
          window.focus();
          setSelectedConversationId(conversation.id);
          setActiveLane(getPreferredConversationLane(conversation, audience));
          notification.close();
        };
      } catch {
        // Browser notifications are best-effort only.
      }
    },
    [audience],
  );

  const handleForegroundChatPush = useCallback<WebPushForegroundHandler>((payload) => {
    if (payload.data?.type !== "CHAT_NEW_MESSAGE") {
      return;
    }

    const conversationId = payload.data.conversationId?.trim();
    if (conversationId) {
      recentForegroundPushRef.current = { conversationId, at: Date.now() };
    }

    void playIncomingMessageChime();
  }, [playIncomingMessageChime]);

  useEffect(() => {
    if (audience === "customer") {
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotificationSetupStatus("unsupported");
      return;
    }

    notificationPermissionRef.current = Notification.permission;
    if (Notification.permission === "denied") {
      setNotificationSetupStatus("blocked");
      return;
    }

    if (Notification.permission !== "granted") {
      setNotificationSetupStatus("idle");
      return;
    }

    let cancelled = false;
    foregroundPushUnsubscribeRef.current?.();
    foregroundPushUnsubscribeRef.current = null;
    void startWebPushNotifications({
      requestPermission: false,
      showForegroundNotification: true,
      onForegroundMessage: handleForegroundChatPush,
    })
      .then((result) => {
        if (cancelled) {
          result.unsubscribe?.();
          return;
        }

        foregroundPushUnsubscribeRef.current = result.unsubscribe ?? null;
        notificationPermissionRef.current = result.permission ?? Notification.permission;
        setNotificationSetupStatus(result.ok ? "ready" : mapWebPushStatus(result.status));
      })
      .catch(() => {
        if (!cancelled) {
          setNotificationSetupStatus("error");
        }
      });

    return () => {
      cancelled = true;
      foregroundPushUnsubscribeRef.current?.();
      foregroundPushUnsubscribeRef.current = null;
    };
  }, [audience, handleForegroundChatPush]);

  const notifyAboutIncomingMessages = useCallback((items: DummyConversationView[]) => {
    const nextKeys: Record<string, string> = {};
    const notifications: Array<{ conversation: DummyConversationView; message: DummyConversationView["messages"][number] }> = [];
    let shouldPlayChime = false;

    for (const conversation of items) {
      const latestIncoming = getLatestIncomingMessage(conversation, audience);
      if (!latestIncoming) {
        continue;
      }

      const key = getConversationMessageKey(latestIncoming);
      nextKeys[conversation.id] = key;

      if (!hasInitializedNotificationsRef.current) {
        continue;
      }

      const previousKey = lastIncomingMessageKeysRef.current[conversation.id];
      if (previousKey === key) {
        continue;
      }

      const recentForegroundPush = recentForegroundPushRef.current;
      const wasJustHandledByPush =
        recentForegroundPush?.conversationId === conversation.id &&
        Date.now() - recentForegroundPush.at < CHAT_FOREGROUND_PUSH_DEDUPE_MS;

      if (!wasJustHandledByPush) {
        shouldPlayChime = true;
      }

      if (!wasJustHandledByPush && notificationPermissionRef.current === "granted" && typeof window !== "undefined") {
        notifications.push({ conversation, message: latestIncoming });
      }
    }

    lastIncomingMessageKeysRef.current = nextKeys;
    if (!hasInitializedNotificationsRef.current) {
      hasInitializedNotificationsRef.current = true;
      return;
    }

    if (shouldPlayChime) {
      void playIncomingMessageChime();
    }

    notifications.slice(0, 3).forEach(({ conversation, message }) => {
      void showChatBrowserNotification({ conversation, message });
    });
  }, [audience, playIncomingMessageChime, showChatBrowserNotification]);
  const serviceOptions = useMemo(() => {
    const serviceMap = new Map<string, { id: string; title: string }>();
    conversations.forEach((conversation) => {
      if (conversation?.serviceId && !serviceMap.has(conversation.serviceId)) {
        serviceMap.set(conversation.serviceId, { id: conversation.serviceId, title: conversation.serviceTitle || "General" });
      }
    });
    return Array.from(serviceMap.values());
  }, [conversations]);

  const applySupportData = useCallback((payload: Awaited<ReturnType<typeof fetchConversations>>) => {
    if (payload.supportDataIncluded === false) {
      return;
    }

    setAssignableEditors(payload.assignableEditors ?? []);
    if (Array.isArray(payload.leadStatuses) && payload.leadStatuses.length > 0) {
      const clean = payload.leadStatuses.filter(
        (s: DummyLeadStatus) => s.id !== "for-review" && s.id !== "delivered" && !s.label?.includes("Editor Assigned"),
      );
      setLeadStatuses(clean);
    }
    setTemplates(payload.templates ?? []);
    setHasLoadedSupportData(true);
  }, []);

  const loadConversations = useCallback((options?: { silent?: boolean; includeSupportData?: boolean }) => {
    if (inboxLoadPromiseRef.current) {
      return inboxLoadPromiseRef.current;
    }

    if (!options?.silent) {
      setIsInboxLoading(true);
    }

    const includeSupportData = options?.includeSupportData ?? false;
    const controller = new AbortController();
    inboxAbortControllerRef.current = controller;
    const request = (async () => {
      try {
        const payload = await fetchConversations({
          audience,
          customerId: audience === "customer" ? customerId : undefined,
          conversationId: requestedConversationId || undefined,
          includeSupportData,
          limit: 1000,
          serviceId: serviceIdFilter,
          tenantId,
          agentId: selectedAgentId,
          signal: controller.signal,
        });
        if (!isMountedRef.current || controller.signal.aborted) {
          return;
        }
        if (includeSupportData) applySupportData(payload);
        const signature = makeConversationSignature(payload);
        if (signature === lastPayloadSignatureRef.current) {
          return;
        }
        lastPayloadSignatureRef.current = signature;
        const nextConversations = payload.conversations ?? [];
        notifyAboutIncomingMessages(nextConversations);
        setConversations(nextConversations);
        setSelectedConversationId((current) => {
          const shouldApplyRequested =
            requestedConversationId &&
            requestedConversationAppliedRef.current !== requestedConversationId &&
            nextConversations.some((conversation) => conversation.id === requestedConversationId);
          if (shouldApplyRequested) {
            requestedConversationAppliedRef.current = requestedConversationId;
            return requestedConversationId;
          }
          return resolveSelectedConversation(current, nextConversations);
        });
      } catch (error: unknown) {
        if (isAbortError(error) || !isMountedRef.current) {
          return;
        }
        if (!options?.silent || !latestConversationsRef.current.length) {
          setComposerStatus("We could not refresh the chat inbox right now. Please retry once.");
        }
      } finally {
        if (isMountedRef.current && !options?.silent) {
          setIsInboxLoading(false);
        }
        if (inboxAbortControllerRef.current === controller) {
          inboxAbortControllerRef.current = null;
        }
        inboxLoadPromiseRef.current = null;
      }
    })();

    inboxLoadPromiseRef.current = request;
    return request;
  }, [applySupportData, audience, customerId, notifyAboutIncomingMessages, requestedConversationId, serviceIdFilter, tenantId, selectedAgentId]);

  const loadSupportData = useCallback(() => {
    if (hasLoadedSupportData) {
      return Promise.resolve();
    }
    if (supportDataLoadPromiseRef.current) {
      return supportDataLoadPromiseRef.current;
    }

    setIsSupportDataLoading(true);
    const request = (async () => {
      if (inboxLoadPromiseRef.current) {
        await inboxLoadPromiseRef.current;
      }
      const payload = await fetchConversations({
        audience,
        customerId: audience === "customer" ? customerId : undefined,
        includeSupportData: true,
        supportOnly: true,
        tenantId,
        agentId: selectedAgentId,
      });
      if (isMountedRef.current) {
        applySupportData(payload);
      }
    })().finally(() => {
      supportDataLoadPromiseRef.current = null;
      setIsSupportDataLoading(false);
    });
    supportDataLoadPromiseRef.current = request;
    return request;
  }, [applySupportData, audience, customerId, hasLoadedSupportData, selectedAgentId, tenantId]);

  const requestChatRefresh = useCallback(() => {
    if (inboxLoadPromiseRef.current) {
      return;
    }
    void loadConversations({ silent: true }).catch(() => undefined);
  }, [loadConversations]);

  const scheduleRealtimeChatRefresh = useCallback(() => {
    if (typeof window === "undefined" || conversationEventsRefreshTimeoutRef.current) {
      return;
    }

    const delay = document.visibilityState === "hidden" ? 250 : 80;
    conversationEventsRefreshTimeoutRef.current = window.setTimeout(() => {
      conversationEventsRefreshTimeoutRef.current = null;
      if (messageSendLockRef.current || inboxLoadPromiseRef.current) {
        return;
      }
      void loadConversations({ silent: true }).catch(() => undefined);
    }, delay);
  }, [loadConversations]);

  const scheduleChatSyncBurst = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    syncBurstTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    syncBurstTimeoutsRef.current = CHAT_SYNC_BURST_DELAYS_MS.map((delay) =>
      window.setTimeout(() => {
        requestChatRefresh();
      }, delay),
    );
  }, [requestChatRefresh]);

  function patchConversationLocally(conversationId: string, patch: Partial<DummyConversationView>) {
    setConversations((current) => current.map((conversation) => (conversation.id === conversationId ? { ...conversation, ...patch } : conversation)));
  }

  function replaceConversationLocally(nextConversation: DummyConversationView) {
    setConversations((current) => {
      const remaining = current.filter((conversation) => conversation.id !== nextConversation.id);
      return [nextConversation, ...remaining];
    });
  }

  function removeOptimisticMessageLocally(conversationId: string, optimisticMessageId: string) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: (Array.isArray(conversation.messages) ? conversation.messages : []).filter((message) => message.id !== optimisticMessageId),
            }
          : conversation,
      ),
    );
  }

  function buildOptimisticOutgoingMessage(
    conversation: DummyConversationView,
    lane: DummyConversationLane,
    body: string,
  ): DummyConversationView["messages"][number] {
    const createdAt = new Date().toISOString();
    const senderLabel =
      audience === "freelancer"
        ? conversation.assignedFreelancerName || "Freelancer"
        : audience === "manager"
          ? conversation.ownerName || "Rahul Manager"
          : audience === "sales"
            ? "Sales"
          : "You";

    return {
      id: `temp-${conversation.id}-${createdAt}`,
      lane,
      senderRole: audience,
      senderLabel,
      body,
      deliveryStatus: lane === "customer" && audience !== "customer" ? "sent" : undefined,
      createdAt,
    };
  }

  function syncConversationLocally(
    nextConversation: unknown,
    reason: "assignment" | "permission" | "message" | "payment" | "lead-status" | "notes" | "new-chat" | "client-alias",
  ) {
    if (!isConversationView(nextConversation)) {
      broadcastChatWorkspaceSync({ reason, conversationId: activeConversationId ?? undefined });
      void loadConversations({ silent: true }).catch(() => undefined);
      return;
    }
    replaceConversationLocally(nextConversation);
    setSelectedConversationId(nextConversation.id);
    broadcastChatWorkspaceSync({ reason, conversationId: nextConversation.id });
  }

  const clearTypingTimers = useCallback(() => {
    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
    if (typingHeartbeatIntervalRef.current) {
      window.clearInterval(typingHeartbeatIntervalRef.current);
      typingHeartbeatIntervalRef.current = null;
    }
  }, []);

  const postTypingStateUpdate = useCallback(
    async (conversationId: string, lane: DummyConversationLane, active: boolean) => {
      try {
        await aicloserApi.conversations.setTyping(conversationId, active);
      } catch {
        // Typing signals are best-effort only.
      }
    },
    [audience],
  );

  const updateOutboundTypingState = useCallback(
    (
      active: boolean,
      options?: {
        conversationId?: string;
        lane?: DummyConversationLane;
        force?: boolean;
      },
    ) => {
      const conversationId = options?.conversationId ?? activeConversationId;
      const lane = options?.lane ?? (audience === "customer" ? "customer" : resolvedLane);
      if (!conversationId) {
        return;
      }

      if (active && audience === "freelancer" && lane === "customer" && isFreelancerCustomerLaneReadOnly) {
        return;
      }

      const current = outboundTypingStateRef.current;
      if (!options?.force && current?.conversationId === conversationId && current.lane === lane && current.active === active) {
        return;
      }

      outboundTypingStateRef.current = { conversationId, lane, active };
      void postTypingStateUpdate(conversationId, lane, active);

      if (!active) {
        if (typingHeartbeatIntervalRef.current) {
          window.clearInterval(typingHeartbeatIntervalRef.current);
          typingHeartbeatIntervalRef.current = null;
        }
        return;
      }

      if (typingHeartbeatIntervalRef.current) {
        window.clearInterval(typingHeartbeatIntervalRef.current);
      }
      typingHeartbeatIntervalRef.current = window.setInterval(() => {
        const latestState = outboundTypingStateRef.current;
        if (!latestState?.active) {
          return;
        }
        void postTypingStateUpdate(latestState.conversationId, latestState.lane, true);
      }, WHATSAPP_TYPING_HEARTBEAT_MS);
    },
    [activeConversationId, audience, isFreelancerCustomerLaneReadOnly, postTypingStateUpdate, resolvedLane],
  );

  const markConversationRead = useCallback(async (conversationId: string) => {
    patchConversationLocally(conversationId, {
      unreadCount: 0,
      unreadCountByLane: {
        customer: 0,
        internal: 0,
      },
    });
    try {
      await aicloserApi.conversations.markRead(conversationId);
      scheduleChatSyncBurst();
    } catch {
      // Silently continue so the user is not disrupted
      void loadConversations({ silent: true }).catch(() => undefined);
    }
  }, [audience, loadConversations, scheduleChatSyncBurst]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      // Render the inbox first. Workspace support data is independent and loads
      // in the background so a slow team/stage endpoint cannot hold the chat rail.
      loadConversations().catch(() => undefined);
      loadSupportData().catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadConversations, loadSupportData]);

  useEffect(() => {
    if (hasLoadedSupportData) {
      return;
    }

    if (!isAssignMenuOpen && !isLeadStatusMenuOpen && !isNewChatOpen && !isPaymentModalOpen) {
      return;
    }

    loadSupportData().catch(() => undefined);
  }, [hasLoadedSupportData, isAssignMenuOpen, isLeadStatusMenuOpen, isNewChatOpen, isPaymentModalOpen, loadSupportData]);

  useEffect(() => {
    if (instagramConnected === "1") {
      setComposerStatus("Instagram Inbox connected. Replies will now use the connected Instagram permissions.");
      return;
    }

    if (instagramError) {
      setComposerStatus(instagramError);
      return;
    }

    if (!phonePePaymentStatus) {
      return;
    }

    if (phonePePaymentStatus === "success") {
      setComposerStatus("PhonePe payment completed and marked paid.");
      return;
    }

    if (phonePePaymentStatus === "failed") {
      setComposerStatus(phonePePaymentMessage || "PhonePe payment failed or was cancelled.");
      return;
    }

    if (phonePePaymentStatus === "pending") {
      setComposerStatus(phonePePaymentMessage || "PhonePe returned before confirmation. Refresh chat after a few seconds.");
      return;
    }

    setComposerStatus(phonePePaymentMessage || "PhonePe payment status could not be confirmed.");
  }, [instagramConnected, instagramError, phonePePaymentMessage, phonePePaymentStatus]);

  useEffect(() => {
    if (!isPaymentModalOpen || audience !== "freelancer") {
      return;
    }

    if (freelancerPayeeUpiId) {
      return;
    }

    fetchFreelancerPaymentDetails()
      .then((details) => {
        setFreelancerPayeeUpiId(details.upiId);
        setFreelancerPayeeName(details.payeeName);
      })
      .catch(() => {
        setFreelancerPayeeUpiId("");
        setFreelancerPayeeName("");
      });
  }, [audience, freelancerPayeeUpiId, isPaymentModalOpen]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !messageSendLockRef.current &&
        !inboxLoadPromiseRef.current
      ) {
        loadConversations({ silent: true }).catch(() => undefined);
      }
    }, CHAT_VISIBLE_SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (audience === "customer" || typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    const disconnect = aicloserApi.realtime.connect({
      onEvent: (event) => {
        const signature = typeof event.payload?.signature === "string" ? event.payload.signature : "";
        if (signature && conversationEventsLastSignatureRef.current === signature) {
          return;
        }
        conversationEventsLastSignatureRef.current = signature;
        scheduleRealtimeChatRefresh();
      },
    });

    return disconnect;
  }, [audience, scheduleRealtimeChatRefresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPresenceNowMs(Date.now());
    }, CHAT_PRESENCE_TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const expectedLane = audience === "customer" ? "customer" : resolvedLane;
    const outboundTyping = outboundTypingStateRef.current;
    if (!outboundTyping?.active) {
      return;
    }

    if (outboundTyping.conversationId === activeConversationId && outboundTyping.lane === expectedLane) {
      return;
    }

    updateOutboundTypingState(false, {
      conversationId: outboundTyping.conversationId,
      lane: outboundTyping.lane,
      force: true,
    });
  }, [activeConversationId, audience, resolvedLane, updateOutboundTypingState]);

  useEffect(() => {
    if (!activeConversationId || isMessageSending || isFreelancerCustomerLaneReadOnly) {
      clearTypingTimers();
      updateOutboundTypingState(false);
      return;
    }

    if (!normalizedDraft) {
      clearTypingTimers();
      updateOutboundTypingState(false);
      return;
    }

    updateOutboundTypingState(true);
    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }
    typingStopTimeoutRef.current = window.setTimeout(() => {
      updateOutboundTypingState(false);
    }, CHAT_TYPING_STOP_DEBOUNCE_MS);
  }, [
    activeConversationId,
    clearTypingTimers,
    isFreelancerCustomerLaneReadOnly,
    isMessageSending,
    normalizedDraft,
    updateOutboundTypingState,
  ]);

  useEffect(() => {
    return () => {
      clearTypingTimers();
      const outboundTyping = outboundTypingStateRef.current;
      if (outboundTyping?.active) {
        void postTypingStateUpdate(outboundTyping.conversationId, outboundTyping.lane, false);
      }
    };
  }, [clearTypingTimers, postTypingStateUpdate]);

  useEffect(() => {
    const refreshVisibleChat = () => {
      requestChatRefresh();
    };
    const refreshAfterVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        requestChatRefresh();
      }
    };

    window.addEventListener("focus", refreshVisibleChat);
    document.addEventListener("visibilitychange", refreshAfterVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshVisibleChat);
      document.removeEventListener("visibilitychange", refreshAfterVisibilityChange);
    };
  }, [requestChatRefresh]);

  useEffect(() => {
    return subscribeToChatWorkspaceSync(() => {
      loadConversations({ silent: true }).catch(() => undefined);
    });
  }, [loadConversations]);

  useEffect(() => {
    if (
      requestedConversationId &&
      requestedConversationAppliedRef.current !== requestedConversationId &&
      conversations.some((conversation) => conversation.id === requestedConversationId)
    ) {
      const timeout = window.setTimeout(() => {
        requestedConversationAppliedRef.current = requestedConversationId;
        setSelectedConversationId(requestedConversationId);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [conversations, requestedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !filteredConversations.length) {
      return;
    }
    if (!filteredConversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId("");
    }
  }, [filteredConversations, selectedConversationId]);

  useEffect(() => {
    if (!activeConversation) {
      laneSyncConversationIdRef.current = null;
      return;
    }
    const conversationChanged = laneSyncConversationIdRef.current !== activeConversation.id;
    const preferredLane = getPreferredConversationLane(activeConversation, audience);
    if (conversationChanged || !normalizedVisibleLanes.includes(activeLane)) {
      laneSyncConversationIdRef.current = activeConversation.id;
      setActiveLane(preferredLane);
    }
  }, [activeConversation, activeLane, audience, normalizedVisibleLanes]);

  useEffect(() => {
    if (!activeConversation || activeConversation.unreadCount === 0 || readRequestRef.current === activeConversation.id) {
      return;
    }
    readRequestRef.current = activeConversation.id;
    const timeout = window.setTimeout(() => {
      markConversationRead(activeConversation.id).finally(() => {
        if (readRequestRef.current === activeConversation.id) {
          readRequestRef.current = "";
        }
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeConversation, markConversationRead]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!composerTextareaRef.current) {
      return;
    }
    composerTextareaRef.current.style.height = "0px";
    composerTextareaRef.current.style.height = `${Math.min(composerTextareaRef.current.scrollHeight, 120)}px`;
  }, [messageDraft]);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = messageScrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const container = messageScrollRef.current;
    if (!container) {
      return;
    }

    const content = container.firstElementChild;

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldAutoScrollRef.current = distanceFromBottom <= 48;
    };

    const keepPinnedToBottom = () => {
      if (!shouldAutoScrollRef.current) {
        return;
      }
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      handleScroll();
      keepPinnedToBottom();
    }) : null;
    resizeObserver?.observe(container);
    if (content instanceof HTMLElement) {
      resizeObserver?.observe(content);
    }

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      resizeObserver?.disconnect();
    };
  }, [activeConversation?.id, laneMessages.length, resolvedLane]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }
    const isNewThread = lastConversationIdRef.current !== activeConversationId;
    if (isNewThread) {
      lastConversationIdRef.current = activeConversationId;
      shouldAutoScrollRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => scrollMessagesToBottom("auto")));
      return;
    }
    if (shouldAutoScrollRef.current) {
      requestAnimationFrame(() => requestAnimationFrame(() => scrollMessagesToBottom("smooth")));
    }
  }, [activeConversationId, laneMessages.length, resolvedLane, scrollMessagesToBottom]);

  useEffect(() => {
    if (!isCompactChatLayout || !isMobileThreadViewOpen || !activeConversationId || typeof window === "undefined") {
      return;
    }

    shouldAutoScrollRef.current = true;
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollMessagesToBottom("auto");
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
    };
  }, [activeConversationId, isCompactChatLayout, isMobileThreadViewOpen, laneMessages.length, resolvedLane, scrollMessagesToBottom]);

  function closeTransientMenus() {
    setIsAttachMenuOpen(false);
    setIsEmojiTrayOpen(false);
    setIsFilterMenuOpen(false);
    setIsAssignMenuOpen(false);
    setIsLeadStatusMenuOpen(false);
    setIsNotesMenuOpen(false);
    setIsChannelMenuOpen(false);
  }

  function resetInboxFilters() {
    setSearchValue("");
    setActiveFilter("all");
    setChannelFilter("all");
    setAgencyFilter("all");
    setAssignedFilter("all");
    setPaymentPendingOnly(false);
    setLeadStatusFilterId("all");
    closeTransientMenus();
  }

  function closeMobileThreadView() {
    if (!isCompactChatLayout || typeof window === "undefined") {
      setIsMobileThreadViewOpen(false);
      return;
    }

    if (window.location.hash === "#chat-thread") {
      window.history.back();
      return;
    }

    setIsMobileThreadViewOpen(false);
  }

  const hydrateConversationHistory = useCallback(async (conversation: DummyConversationView) => {
    if (conversation.messages?.length || hydratingConversationId === conversation.id) {
      return;
    }

    const requestId = conversationHydrationRequestRef.current + 1;
    conversationHydrationRequestRef.current = requestId;
    setHydratingConversationId(conversation.id);
    try {
      const hydrated = await aicloserApi.conversations.getView(
        conversation.id,
        100,
        conversation as unknown as Record<string, unknown>,
      );
      if (!isMountedRef.current || conversationHydrationRequestRef.current !== requestId) {
        return;
      }
      setConversations((current) => current.map((item) => (
        item.id === conversation.id ? { ...item, ...hydrated, messages: hydrated.messages } : item
      )));
    } catch {
      if (isMountedRef.current && conversationHydrationRequestRef.current === requestId) {
        setComposerStatus("We could not load this chat history right now. Please retry once.");
      }
    } finally {
      if (conversationHydrationRequestRef.current === requestId) {
        setHydratingConversationId("");
      }
    }
  }, [hydratingConversationId]);

  const handleSelectConversation = useCallback(
    (conversation: DummyConversationView) => {
      setSelectedConversationId(conversation.id);
      void hydrateConversationHistory(conversation);
      setActiveLane(getPreferredConversationLane(conversation, audience));
      if (typeof window !== "undefined") {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("conversationId", conversation.id);
        if (requestedConversationId && requestedConversationId !== conversation.id) {
          requestedConversationAppliedRef.current = requestedConversationId;
        } else if (!requestedConversationId) {
          requestedConversationAppliedRef.current = conversation.id;
        }
        if (!isCompactChatLayout) {
          window.history.replaceState(window.history.state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
        }
      }
      if (isCompactChatLayout && typeof window !== "undefined") {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("conversationId", conversation.id);
        nextUrl.hash = "chat-thread";
        if (window.location.hash !== "#chat-thread") {
          window.history.pushState({ mobileChatThread: true }, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
        } else {
          window.history.replaceState(window.history.state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
        }
        shouldAutoScrollRef.current = true;
        setIsMobileThreadViewOpen(true);
      }
      setIsAttachMenuOpen(false);
      setIsEmojiTrayOpen(false);
      setIsFilterMenuOpen(false);
      setIsAssignMenuOpen(false);
      setIsLeadStatusMenuOpen(false);
      setIsNotesMenuOpen(false);
      setIsHeaderActionsOpen(false);
      setIsDetailsOpen(!isCompactChatLayout);
      if (conversation.unreadCount > 0) {
        markConversationRead(conversation.id).catch(() => undefined);
      }
    },
    [audience, hydrateConversationHistory, isCompactChatLayout, markConversationRead, requestedConversationId],
  );

  const [isDeletingConversation, setIsDeletingConversation] = useState(false);

  const handleDeleteActiveConversation = async () => {
    if (!activeConversation) return;
    const confirmName = activeCustomerName || "this lead";
    if (!window.confirm(`Delete and remove "${confirmName}" from Closer Desk? This cannot be undone.`)) {
      return;
    }
    const targetId = activeConversation.id;
    setIsDeletingConversation(true);
    try {
      const response = await fetch(`/api/conversations?conversationId=${encodeURIComponent(targetId)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== targetId));
        setSelectedConversationId("");
      } else {
        alert(data.error || "Failed to delete conversation");
      }
    } catch {
      alert("Error deleting conversation. Please try again.");
    } finally {
      setIsDeletingConversation(false);
    }
  };

  async function sendMessage(messageInput: { body?: string; attachments?: PendingAttachment[] }) {
    if (!activeConversation || isMessageSending || messageSendLockRef.current) {
      return;
    }
    if (isFreelancerCustomerLaneReadOnly) {
      setComposerStatus(activeLaneReadOnlyReason);
      return;
    }
    const trimmedBody = messageInput.body?.trim() ?? "";
    const attachments = messageInput.attachments ?? [];
    if (!trimmedBody && !attachments.length) {
      return;
    }

    const conversationId = activeConversation.id;
    const lane = audience === "customer" ? "customer" : resolvedLane;
    const previousDraft = messageDraft;
    const previousAttachMenuState = isAttachMenuOpen;
    const previousEmojiTrayState = isEmojiTrayOpen;
    const optimisticMessage =
      trimmedBody && !attachments.length ? buildOptimisticOutgoingMessage(activeConversation, lane, trimmedBody) : null;

    messageSendLockRef.current = true;
    setIsMessageSending(true);
    setComposerStatus("");
    setMessageDraft("");
    updateOutboundTypingState(false);
    setIsAttachMenuOpen(false);
    setIsEmojiTrayOpen(false);

    if (optimisticMessage) {
      replaceConversationLocally({
        ...activeConversation,
        messages: [...(Array.isArray(activeConversation.messages) ? activeConversation.messages : []), optimisticMessage],
        summary: optimisticMessage.body || activeConversation.summary,
      });
    }

    try {
      await aicloserApi.conversations.sendMessage(conversationId, trimmedBody || " ", attachments);
      setComposerStatus("");
      void loadConversations({ silent: true }).catch(() => undefined);
      scheduleChatSyncBurst();
    } catch (error) {
      if (optimisticMessage) {
        removeOptimisticMessageLocally(conversationId, optimisticMessage.id);
      }
      setMessageDraft(previousDraft);
      setIsAttachMenuOpen(previousAttachMenuState);
      setIsEmojiTrayOpen(previousEmojiTrayState);
      setComposerStatus(error instanceof Error ? error.message : "Message send failed.");
      lastPayloadSignatureRef.current = "";
    } finally {
      setIsMessageSending(false);
      messageSendLockRef.current = false;
    }
  }

  async function handleSendMessage() {
    if (isMessageSending || messageSendLockRef.current) {
      return;
    }
    await sendMessage({ body: normalizedDraft });
  }

  function insertEmoji(emoji: string) {
    setMessageDraft((current) => `${current}${emoji}`);
    composerTextareaRef.current?.focus();
  }

  function handleEmojiClick(emojiData: EmojiClickData) {
    insertEmoji(emojiData.emoji);
  }

  async function getMicrophonePermissionState() {
    if (!navigator.permissions?.query) {
      return "unknown" as const;
    }
    try {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      return status.state as "granted" | "denied" | "prompt";
    } catch {
      return "unknown" as const;
    }
  }

  async function collectMicDiagnostics(): Promise<MicDiagnostics> {
    const permissionQuery = await getMicrophonePermissionState();
    let audioInputCount: number | null = null;
    let enumerateDevicesError: string | undefined;

    if (navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        audioInputCount = devices.filter((device) => device.kind === "audioinput").length;
      } catch (error) {
        const info = extractErrorInfo(error);
        enumerateDevicesError = info.name ? `${info.name}: ${info.message}` : info.message;
      }
    }

    const policy = (document as unknown as { permissionsPolicy?: unknown; featurePolicy?: unknown }).permissionsPolicy ??
      (document as unknown as { featurePolicy?: unknown }).featurePolicy;
    let permissionsPolicyAllowsMicrophone: boolean | null = null;
    try {
      if (policy && typeof (policy as { allowsFeature?: unknown }).allowsFeature === "function") {
        permissionsPolicyAllowsMicrophone = Boolean((policy as { allowsFeature: (name: string) => boolean }).allowsFeature("microphone"));
      }
    } catch {
      // ignore
    }

    return {
      origin: typeof location !== "undefined" ? location.origin : "",
      isSecureContext: typeof window !== "undefined" ? window.isSecureContext : false,
      inIframe: typeof window !== "undefined" ? window.self !== window.top : false,
      permissionQuery,
      audioInputCount,
      permissionsPolicyAllowsMicrophone,
      enumerateDevicesError,
    };
  }

  function openMicHelp(message: string, state: MicPermissionState, errorInfo?: MicErrorInfo | null) {
    forceStopMicrophone({ silent: true });
    setMicPermissionState(state);
    setMicHelpMessage(message);
    setMicLastError(errorInfo ?? null);
    setMicDiagnostics(null);
    setIsMicHelpOpen(true);

    void (async () => {
      const diagnostics = await collectMicDiagnostics();
      if (!isMountedRef.current) {
        return;
      }
      if (diagnostics.permissionQuery !== "unknown") {
        setMicPermissionState(diagnostics.permissionQuery);
      }
      setMicDiagnostics(diagnostics);
    })();
  }

  function stopActiveStream() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    voiceCaptureModeRef.current = "media";
  }

  function forceStopMicrophone(options?: { silent?: boolean }) {
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }

    recordingChunksRef.current = [];
    cleanupDirectMp3();
    stopActiveStream();
    setIsRecording(false);
    setIsConvertingVoice(false);
    recordingSecondsRef.current = 0;
    recordingStartTimeRef.current = null;
    setRecordingSeconds(0);
    if (!options?.silent) {
      setComposerStatus("Microphone stopped.");
    }
  }

  async function finalizeVoiceNote({
    rawBlob,
    rawMimeType,
    allowMp3Conversion,
    defaultNote,
  }: {
    rawBlob: Blob;
    rawMimeType: string;
    allowMp3Conversion: boolean;
    defaultNote: string;
  }) {
    if (!isMountedRef.current) {
      setIsConvertingVoice(false);
      return;
    }

    if (recordingSecondsRef.current <= 0 && recordingStartTimeRef.current !== null) {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      recordingSecondsRef.current = Math.max(Math.round((now - recordingStartTimeRef.current) / 1000), 1);
    }

    let durationSeconds = Math.max(recordingSecondsRef.current, 1);
    recordingSecondsRef.current = 0;
    recordingStartTimeRef.current = null;

    let finalBlob = rawBlob;
    let finalMimeType = rawMimeType || rawBlob.type || "audio/webm";
    let finalName = `voice-note-${Date.now()}.${finalMimeType.includes("mpeg") ? "mp3" : "webm"}`;
    let note = defaultNote;
    let convertedDuration: number | null = null;

    if (allowMp3Conversion && finalMimeType !== "audio/mpeg") {
      try {
        const converted = await convertToMp3(rawBlob);
        finalBlob = converted.blob;
        finalMimeType = "audio/mpeg";
        convertedDuration = converted.duration;
        finalName = `voice-note-${Date.now()}.mp3`;
        note = "Voice note recorded in MP3 format.";
      } catch {
        note = defaultNote;
      }
    }

    const resolvedDuration = await resolveAudioDuration(finalBlob);
    if (resolvedDuration && Number.isFinite(resolvedDuration) && resolvedDuration > 0) {
      durationSeconds = Math.max(1, Math.round(resolvedDuration));
    } else if (convertedDuration && Number.isFinite(convertedDuration) && convertedDuration > 0) {
      durationSeconds = Math.max(1, Math.round(convertedDuration));
    }

    if (!activeConversation || activeConversation.id !== recordingConversationIdRef.current) {
      setComposerStatus("Voice note recorded, but the active chat changed before it could be sent.");
      setIsConvertingVoice(false);
      return;
    }

    await sendMessage({
      attachments: [
        {
          name: finalName,
          mimeType: finalMimeType,
          sizeBytes: finalBlob.size,
          durationSeconds,
          uploadTarget: "local",
          externalUrl: await blobToDataUrl(finalBlob),
          note,
        },
      ],
    });

    if (isMountedRef.current) {
      setIsConvertingVoice(false);
      setRecordingSeconds(0);
    }
  }

  async function handleMicRetry() {
    setIsMicHelpOpen(false);
    setMicLastError(null);
    setMicDiagnostics(null);
    await handleVoiceNoteToggle();
  }

  function handleMicAccessError(error: unknown, permissionState: "unknown" | "granted" | "denied" | "prompt") {
    const info = extractErrorInfo(error);
    const errorName = info.name;

    if (errorName === "NotAllowedError" || errorName === "SecurityError") {
      stopActiveStream();
      if (permissionState === "granted") {
        setComposerStatus("Microphone blocked by the OS or device.");
        openMicHelp(
          "Browser permission is allowed, but the OS or device is blocking the microphone. Check Windows privacy settings and the selected input device, then try again.",
          "granted",
          info,
        );
        return;
      }
      if (permissionState === "prompt" || permissionState === "unknown") {
        setComposerStatus("Microphone permission is required.");
        openMicHelp(
          "Microphone permission is required. Click the lock icon near the address bar, allow Microphone, refresh the page, then try again.",
          permissionState === "prompt" ? "prompt" : "unknown",
          info,
        );
        return;
      }
      setComposerStatus("Microphone access denied or unavailable.");
      openMicHelp("Microphone access is blocked for this site. Reset the permission to Ask/Allow, refresh the page, and try again.", "denied", info);
      return;
    }
    if (errorName === "NotFoundError") {
      stopActiveStream();
      setComposerStatus("No microphone was detected.");
      openMicHelp("No microphone device was found. Plug in or enable a microphone, then try again.", "unknown", info);
      return;
    }
    if (errorName === "NotReadableError" || errorName === "AbortError") {
      stopActiveStream();
      setComposerStatus("Microphone is currently unavailable.");
      openMicHelp("The microphone is already in use by another app. Close other apps using the mic and try again.", "unknown", info);
      return;
    }
    if (errorName === "OverconstrainedError") {
      stopActiveStream();
      setComposerStatus("Microphone settings are not supported.");
      openMicHelp("This device/browser cannot satisfy the microphone request. Try another input device, then try again.", "unknown", info);
      return;
    }
    stopActiveStream();
    setComposerStatus("Microphone access denied or unavailable.");
    openMicHelp(
      `We could not access the microphone${errorName ? ` (${errorName})` : ""}. Allow microphone permission for this site and ensure your device is available, then try again.`,
      permissionState === "denied" ? "denied" : "unknown",
      info,
    );
  }

  async function handleVoiceNoteToggle() {
    if (!activeConversation || isConvertingVoice) {
      return;
    }
    if (!isRecording) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setComposerStatus("Voice recording is not supported in this browser.");
        openMicHelp("This browser does not support microphone recording. Try Chrome or Edge, then allow microphone access for this site.", "unsupported");
        return;
      }
      forceStopMicrophone({ silent: true });
      const permissionState = await getMicrophonePermissionState();
      if (permissionState !== "unknown") {
        setMicPermissionState(permissionState);
      }
      setComposerStatus("Requesting microphone access...");
      try {
        stopActiveStream();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const AudioContextImpl = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        const canUseMediaRecorder = typeof MediaRecorder !== "undefined";
        const canRecordMp3 = canUseMediaRecorder && MediaRecorder.isTypeSupported("audio/mpeg");
        const canUseDirectMp3 = Boolean(AudioContextImpl);
        const shouldTryDirectMp3 = !canRecordMp3 && canUseDirectMp3;
        let Mp3Encoder: Mp3EncoderConstructor | null = null;
        if (shouldTryDirectMp3) {
          try {
            Mp3Encoder = await getMp3EncoderConstructor();
          } catch {
            Mp3Encoder = null;
          }
        }
        const useDirectMp3 = shouldTryDirectMp3 && Boolean(Mp3Encoder);

        if (!useDirectMp3 && !canUseMediaRecorder) {
          stopActiveStream();
          setComposerStatus("Voice recording is not supported in this browser.");
          openMicHelp("MediaRecorder is not available in this browser. Try Chrome or Edge, then allow microphone access for this site.", "unsupported");
          return;
        }
        recordingConversationIdRef.current = activeConversation.id;

        if (useDirectMp3 && AudioContextImpl && Mp3Encoder) {
          const audioContext = new AudioContextImpl();
          try {
            await audioContext.resume();
          } catch {
            // Best-effort resume.
          }
          const source = audioContext.createMediaStreamSource(stream);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          const mute = audioContext.createGain();
          mute.gain.value = 0;
          const encoder = new Mp3Encoder(1, audioContext.sampleRate, 128);

          processor.onaudioprocess = (event) => {
            const channelData = event.inputBuffer.getChannelData(0);
            const mp3buf = encoder.encodeBuffer(toInt16(channelData));
            if (mp3buf.length) {
              mp3ChunksRef.current.push(new Uint8Array(mp3buf));
            }
          };

          source.connect(processor);
          processor.connect(mute);
          mute.connect(audioContext.destination);

          audioContextRef.current = audioContext;
          audioSourceRef.current = source;
          audioProcessorRef.current = processor;
          audioMuteRef.current = mute;
          mp3EncoderRef.current = encoder;
          mp3ChunksRef.current = [];
          voiceCaptureModeRef.current = "direct";
        } else {
          const mimeType = canRecordMp3 ? "audio/mpeg" : getSupportedAudioMimeType();
          const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          mediaRecorderRef.current = recorder;
          recordingChunksRef.current = [];
          voiceCaptureModeRef.current = "media";

          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              recordingChunksRef.current.push(event.data);
            }
          };

          recorder.onstop = async () => {
            const chunks = recordingChunksRef.current;
            recordingChunksRef.current = [];
            if (mediaStreamRef.current) {
              mediaStreamRef.current.getTracks().forEach((track) => track.stop());
              mediaStreamRef.current = null;
            }
            mediaRecorderRef.current = null;

            if (!chunks.length || !isMountedRef.current) {
              setIsConvertingVoice(false);
              return;
            }

            const rawBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            await finalizeVoiceNote({
              rawBlob,
              rawMimeType: recorder.mimeType || rawBlob.type || "audio/webm",
              allowMp3Conversion: recorder.mimeType !== "audio/mpeg",
              defaultNote: "Voice note recorded locally.",
            });
          };

          recorder.start();
        }

        setMicPermissionState("granted");
        setIsRecording(true);
        recordingSecondsRef.current = 0;
        recordingStartTimeRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
        setRecordingSeconds(0);
        if (recordingIntervalRef.current) {
          window.clearInterval(recordingIntervalRef.current);
        }
        recordingIntervalRef.current = window.setInterval(() => {
          setRecordingSeconds((current) => {
            const next = current + 1;
            recordingSecondsRef.current = next;
            return next;
          });
        }, 1000);
        setComposerStatus("Recording voice note... click the stop button to save it in the thread.");
      } catch (error) {
        handleMicAccessError(error, permissionState);
      }
      return;
    }
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (recordingStartTimeRef.current !== null) {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsedSeconds = Math.max(Math.round((now - recordingStartTimeRef.current) / 1000), 1);
      recordingSecondsRef.current = elapsedSeconds;
      recordingStartTimeRef.current = null;
    }
    setIsRecording(false);
    setIsConvertingVoice(true);
    setComposerStatus("Processing voice note...");
    if (voiceCaptureModeRef.current === "direct") {
      const encoder = mp3EncoderRef.current;
      if (!encoder) {
        setIsConvertingVoice(false);
        setComposerStatus("Voice recorder is not available.");
        return;
      }
      const end = encoder.flush();
      if (end.length) {
        mp3ChunksRef.current.push(new Uint8Array(end));
      }
      const rawBlob = new Blob(mp3ChunksRef.current as unknown as BlobPart[], { type: "audio/mpeg" });
      cleanupDirectMp3();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      await finalizeVoiceNote({
        rawBlob,
        rawMimeType: "audio/mpeg",
        allowMp3Conversion: false,
        defaultNote: "Voice note recorded in MP3 format.",
      });
      voiceCaptureModeRef.current = "media";
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      stopActiveStream();
      setIsConvertingVoice(false);
      setComposerStatus("Voice recorder is not available.");
      return;
    }
    if (recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopActiveStream();
      setIsConvertingVoice(false);
      setComposerStatus("Voice recorder is already stopped.");
    }
  }

  function validatePickedFiles(files: File[]) {
    const validFiles: File[] = [];
    const rejectedSize: string[] = [];

    for (const file of files) {
      if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
        rejectedSize.push(file.name);
        continue;
      }
      validFiles.push(file);
    }

    return { validFiles, rejectedSize };
  }

  async function handlePickedFiles(target: PendingUploadTarget, fileList: FileList | null) {
    if (!activeConversation || !fileList?.length) {
      return;
    }
    const files = Array.from(fileList);
    const { validFiles, rejectedSize } = validatePickedFiles(files);

    if (rejectedSize.length) {
      const rejectedLabel = rejectedSize.slice(0, 2).join(", ");
      const suffix = rejectedSize.length > 2 ? ` and ${rejectedSize.length - 2} more` : "";
      setComposerStatus(`${rejectedLabel}${suffix} exceed 20 MB and were skipped.`);
    }

    if (!validFiles.length) {
      return;
    }

    const preparedAttachments = await Promise.all(
      validFiles.map(async (file) => ({
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadTarget: target,
        externalUrl: await blobToDataUrl(file),
      })),
    );

    await sendMessage({
      body: messageDraft,
      attachments: preparedAttachments,
    });
  }

  async function handleAssign(editorId: string, strategy: "offer" | "direct" = "offer") {
    if (!activeConversation || isSendingAssignmentOffer || isAssigningDirectly) {
      return;
    }
    const freelancerIds = editorId ? [editorId] : selectedAssignEditorIds;
    if (!freelancerIds.length) {
      setComposerStatus(strategy === "direct" ? "Choose one team member to assign directly." : "Choose at least one team member to send the assignment.");
      return;
    }
    const hasPrimaryEditor = Boolean(activeAssignment?.assignedFreelancerId);
    if (strategy === "direct" && freelancerIds.length !== 1) {
      setComposerStatus("Choose exactly one team member for direct assignment.");
      return;
    }
    if (hasPrimaryEditor && assignmentMode === "replace" && freelancerIds.length !== 1) {
      setComposerStatus("Choose exactly one team member for the replacement assignment.");
      return;
    }
    const selectedEditor = assignableEditors.find((editor) => editor.id === freelancerIds[0]);
    if (strategy === "direct") {
      const confirmed = window.confirm(
        hasPrimaryEditor
          ? `Assign ${selectedEditor?.name || "this team member"} directly? This skips acceptance and moves ${activeAssignment?.assignedFreelancerName || "the current assignee"} to read-only access.`
          : `Assign ${selectedEditor?.name || "this team member"} directly? This immediately grants reply access, even if the team member is offline.`,
      );
      if (!confirmed) {
        return;
      }
    }
    if (strategy === "direct") {
      setIsAssigningDirectly(true);
    } else {
      setIsSendingAssignmentOffer(true);
    }
    try {
      const response = await fetch(`/api/conversations/${activeConversation.id}/assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freelancerIds,
          projectDetails: assignmentDetailsDraft || activeConversation.internalNotes || activeConversation.summary || activeConversation.serviceTitle,
          assignedBy: audience === "admin" ? "admin" : "manager",
          assignmentMode: strategy === "direct" ? "direct" : hasPrimaryEditor ? assignmentMode : "offer",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setComposerStatus(payload?.error ?? "Unable to assign the team member right now.");
        return;
      }
      setIsAssignMenuOpen(false);
      setAssignSearchValue("");
      setSelectedAssignEditorIds([]);
      setAssignmentDetailsDraft("");
      const deliveredCount = Number(payload?.notificationDelivery?.sent ?? 0);
      setComposerStatus(
        payload?.assignmentMode === "direct"
          ? payload?.deduped
            ? `${payload?.assignedFreelancerName || selectedEditor?.name || "This team member"} is already assigned.`
            : `${payload?.assignedFreelancerName || selectedEditor?.name || "Team member"} was assigned with immediate reply access.${payload?.withdrawnOfferCount ? ` ${payload.withdrawnOfferCount} pending assignment${payload.withdrawnOfferCount === 1 ? " was" : "s were"} withdrawn.` : ""}`
          : payload?.assignmentMode === "viewer"
          ? payload?.deduped
            ? "Those team members already have access to this project lane."
            : `${payload?.addedFreelancerIds?.length ?? freelancerIds.length} read-only viewer${(payload?.addedFreelancerIds?.length ?? freelancerIds.length) === 1 ? " was" : "s were"} added. Only the assigned team member can reply.`
          : payload?.deduped
          ? "This team member already has an active assignment offer. No duplicate was sent."
          : deliveredCount > 0
            ? `${payload?.assignmentMode === "replace" ? "Replacement offer" : "Project offer"} created and ${deliveredCount} device notification${deliveredCount === 1 ? " was" : "s were"} delivered.`
            : "Assignment created, but no device notification was delivered. Ask the team member to refresh push registration.",
      );
      if (payload?.conversation) {
        syncConversationLocally(payload.conversation, "assignment");
      }
      await loadConversations({ silent: true });
    } catch {
      setComposerStatus(
        strategy === "direct"
          ? "Unable to assign this team member directly right now. Please try again."
          : "Unable to send the assignment right now. Please try again.",
      );
    } finally {
      if (strategy === "direct") {
        setIsAssigningDirectly(false);
      } else {
        setIsSendingAssignmentOffer(false);
      }
    }
  }

  async function handleRemoveEditorAssignment() {
    if (!activeConversation || !activeAssignment?.assignedFreelancerId || isRemovingAssignment) {
      return;
    }

    const editorName = activeAssignment.assignedFreelancerName || "the current assignee";
    const confirmed = window.confirm(
      `Remove ${editorName} and leave this project unassigned? This also removes read-only viewers and withdraws pending assignment offers.`,
    );
    if (!confirmed) {
      return;
    }

    setIsRemovingAssignment(true);
    try {
      const response = await fetch(`/api/conversations/${activeConversation.id}/assignment`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setComposerStatus(payload?.error ?? "Unable to remove the assigned team member right now.");
        return;
      }

      setIsAssignMenuOpen(false);
      setAssignSearchValue("");
      setSelectedAssignEditorIds([]);
      setAssignmentDetailsDraft("");
      setAssignmentMode("replace");
      setComposerStatus(
        payload?.deduped
          ? "This project was already unassigned."
          : `${editorName} was removed. The project is now unassigned.`,
      );
      if (payload?.conversation) {
        syncConversationLocally(payload.conversation, "assignment");
      }
      await loadConversations({ silent: true });
    } catch {
      setComposerStatus("Unable to remove the assigned team member right now. Please try again.");
    } finally {
      setIsRemovingAssignment(false);
    }
  }

  async function handleAssignmentResponse(action: "ACCEPT" | "PASS") {
    if (!activeConversation) {
      return;
    }
    const rejectionReason = assignmentRejectReason.trim();
    if (action === "PASS" && !rejectionReason) {
      setIsRejectingAssignment(true);
      setComposerStatus("Please add a rejection reason before rejecting.");
      return;
    }
    const response = await fetch(`/api/conversations/${activeConversation.id}/assignment/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason: action === "PASS" ? rejectionReason : undefined }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setComposerStatus(payload?.error ?? "Unable to update project offer right now.");
      return;
    }
    if (action === "ACCEPT") {
      setActiveLane("internal");
    }
    setIsRejectingAssignment(false);
    setAssignmentRejectReason("");
    setComposerStatus(action === "ACCEPT" ? "Project accepted. Chat access is active." : "Project rejected with reason.");
    if (payload?.conversation) {
      syncConversationLocally(payload.conversation, "assignment");
    }
    await loadConversations({ silent: true });
  }

  async function handleApproveProjectIntake() {
    if (!activeConversation) {
      return;
    }
    const response = await fetch(`/api/conversations/${activeConversation.id}/project-intake/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fallbackToCategory: true }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setComposerStatus(payload?.error ?? "Unable to approve project intake right now.");
      return;
    }
    const deliveredCount = Number(payload?.notificationDelivery?.sent ?? 0);
    setComposerStatus(
      deliveredCount > 0
        ? `Project intake approved and ${deliveredCount} team-member notification${deliveredCount === 1 ? " was" : "s were"} delivered.`
        : "Project intake approved, but no team-member device notification was delivered.",
    );
    if (payload?.conversation) {
      syncConversationLocally(payload.conversation, "assignment");
    }
    await loadConversations({ silent: true });
  }

  async function handleFreelancerCustomerAccessToggle(enabled: boolean) {
    if (!activeConversation || !canManageFreelancerCustomerAccess) {
      return;
    }
    setIsFreelancerAccessSaving(true);
    try {
      const response = await fetch(`/api/conversations/${activeConversation.id}/freelancer-customer-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setComposerStatus(payload?.error ?? "Direct client permission could not be updated.");
        return;
      }
      setComposerStatus(enabled ? "Freelancer can now reply in the customer lane." : "Freelancer is back on internal-only coordination for this thread.");
      if (payload?.conversation) {
        syncConversationLocally(payload.conversation, "permission");
      }
      await loadConversations({ silent: true });
    } finally {
      setIsFreelancerAccessSaving(false);
    }
  }

  async function handleToggleAiAutoReply(disabled: boolean) {
    if (!activeConversation) {
      return;
    }
    setIsAiToggleSaving(true);
    patchConversationLocally(activeConversation.id, {
      aiAutoReplyDisabled: disabled,
      aiAutoReplyDisabledUpdatedAt: new Date().toISOString(),
    });
    try {
      const response = await fetch(`/api/conversations/${activeConversation.id}/ai-auto-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setComposerStatus(payload?.error ?? "Could not update AI Auto-Reply mode.");
        patchConversationLocally(activeConversation.id, {
          aiAutoReplyDisabled: !disabled,
        });
        return;
      }
      setComposerStatus(
        disabled
          ? "Human Mode active. AI Auto-Reply is paused for this thread."
          : "AI Auto-Reply resumed for this thread."
      );
      if (payload?.conversation) {
        syncConversationLocally(payload.conversation, "permission");
      }
      await loadConversations({ silent: true });
    } catch {
      setComposerStatus("Could not update AI Auto-Reply mode.");
      patchConversationLocally(activeConversation.id, {
        aiAutoReplyDisabled: !disabled,
      });
    } finally {
      setIsAiToggleSaving(false);
    }
  }

  async function handleToggleDrip(paused: boolean) {
    if (!activeConversation) return;
    setIsDripSaving(true);
    try {
      await aicloserApi.conversations.triggerDrip(activeConversation.id, paused ? "PAUSE" : "RESUME");
      // The central mutation endpoint returns an acknowledgement rather than
      // the legacy drip projection. Keep the current UI projection intact and
      // update only the state changed by this action.
      setDripState((current) => ({
        audienceCategory: current?.audienceCategory ?? "LEAD",
        currentStage: current?.currentStage ?? 1,
        paused,
        completed: current?.completed ?? false,
        lastDripSentAt: current?.lastDripSentAt,
      }));
      setComposerStatus(
        paused
          ? "WhatsApp lead drip paused for this lead."
          : "WhatsApp lead drip active. Context-aware follow-ups scheduled."
      );
    } catch {
      setComposerStatus("Could not update lead drip status.");
    } finally {
      setIsDripSaving(false);
    }
  }

  async function handleSendReviewFlow() {
    if (!activeConversation) {
      return;
    }
    setComposerStatus("Sending review form...");
    try {
      const response = await fetch(`/api/conversations/${activeConversation.id}/review-flow`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; conversation?: DummyConversationView; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Review form could not be sent.");
      }
      if (payload.conversation) {
        syncConversationLocally(payload.conversation, "message");
      }
      setComposerStatus("Review form sent to customer.");
    } catch (error) {
      setComposerStatus(error instanceof Error ? error.message : "Review form send failed.");
    }
  }

  async function handleLeadStatusChange(leadStatusId: string) {
    if (!activeConversation) {
      return;
    }
    setIsLeadStatusMenuOpen(false);
    const targetStatus = leadStatuses.find((s) => s.id === leadStatusId);
    // Update the selected thread immediately. Meta delivery and the background
    // inbox refresh must never make the closer wait for the visual change.
    syncConversationLocally(
      {
        ...activeConversation,
        leadStatusId,
        leadStatusLabel: targetStatus?.label ?? leadStatusId,
        leadStatusTone: targetStatus?.tone ?? activeConversation.leadStatusTone,
        updatedAt: new Date().toISOString(),
      },
      "lead-status",
    );
    setComposerStatus(`Saving stage: ${targetStatus?.label ?? leadStatusId}...`);
    try {
      await aicloserApi.conversations.updateStage(activeConversation.id, toCentralStageValue(leadStatusId));
    } catch (error) {
      setComposerStatus(error instanceof Error ? error.message : "Lead status could not be updated.");
      return;
    }
    const statusLabel = targetStatus?.label ?? leadStatusId;
    setComposerStatus(`Lead stage updated to "${statusLabel}".`);
    // Auto-pause automated follow-up drip when lead is booked or converted
    if (
      leadStatusId === "closed" ||
      leadStatusId === "training-booked" ||
      leadStatusId.toLowerCase().includes("won") ||
      leadStatusId.toLowerCase().includes("book")
    ) {
      handleToggleDrip(true).catch(() => undefined);
    }
    // Keep the stage control responsive; the inbox refresh can run in the
    // background after the selected conversation has been updated locally.
    void loadConversations({ silent: true }).catch(() => undefined);
  }

  async function handleLeadStatusCrud(action: "create" | "update" | "delete" | "reorder", input?: Partial<DummyLeadStatus> & { statusId?: string; orderedIds?: string[] }) {
    const toneColors: Record<DummyLeadStatusTone, string> = {
      neutral: "#64748B",
      accent: "#3B82F6",
      warning: "#F59E0B",
      success: "#10B981",
    };
    try {
      if (action === "create" && input?.label?.trim()) {
        await aicloserApi.stages.create({
          label: input.label.trim(),
          color: toneColors[input.tone ?? "accent"],
          probability: 0.5,
        });
      } else if (action === "update" && input?.statusId && input.label?.trim()) {
        await aicloserApi.stages.updateStage(input.statusId, {
          label: input.label.trim(),
          color: toneColors[input.tone ?? "neutral"],
        });
      } else if (action === "delete" && input?.statusId) {
        await aicloserApi.stages.remove(input.statusId);
      } else if (action === "reorder" && input?.orderedIds?.length) {
        await aicloserApi.stages.update({ stageIds: input.orderedIds });
      }
    } catch (error) {
      setComposerStatus(error instanceof Error ? error.message : "Could not update live lead stages.");
      return;
    }
    setComposerStatus("Lead status settings updated.");
    if (action === "create") {
      setNewStatusLabel("");
      setNewStatusTone("accent");
    }
    if (action === "update" || action === "delete") {
      setEditingStatusId(null);
      setEditingStatusLabel("");
      setEditingStatusTone("neutral");
      setEditingStatusActive(true);
    }
    await loadConversations({ silent: true, includeSupportData: true });
  }

  function startEditingStatus(status: DummyLeadStatus) {
    setEditingStatusId(status.id);
    setEditingStatusLabel(status.label);
    setEditingStatusTone(status.tone);
    setEditingStatusActive(status.active);
  }

  async function moveStatus(statusId: string, direction: "up" | "down") {
    const index = leadStatuses.findIndex((status) => status.id === statusId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= leadStatuses.length) return;
    const orderedIds = leadStatuses.map((status) => status.id);
    const [moved] = orderedIds.splice(index, 1);
    orderedIds.splice(targetIndex, 0, moved);
    await handleLeadStatusCrud("reorder", { orderedIds });
  }

  async function handleNewChatSubmit() {
    const response = await fetch("/api/conversations/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: audience === "admin" ? "admin" : "manager",
        customerName: newChatCustomerName,
        customerPhone: newChatCustomerPhone,
        serviceId: newChatServiceId || undefined,
        templateId: newChatTemplateId || undefined,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setComposerStatus(payload?.error ?? "Could not create the conversation.");
      return;
    }
    setNewChatCustomerName("");
    setNewChatCustomerPhone("");
    setNewChatServiceId("");
    setNewChatTemplateId("");
    setIsNewChatOpen(false);
    setComposerStatus("New chat created from the CRM template flow.");
    if (payload?.conversation) {
      syncConversationLocally(payload.conversation, "new-chat");
    }
    await loadConversations({ silent: true });
    if (payload?.conversation?.id) {
      setSelectedConversationId(payload.conversation.id);
    }
  }

  async function handlePaymentRequestSubmit() {
    if (!activeConversation) {
      return;
    }

    const amountValue = Number(paymentAmount || 0);
    if (!amountValue || amountValue <= 0) {
      setComposerStatus("Enter a valid payment amount.");
      return;
    }

    const isFreelancerInternal = audience === "freelancer" && resolvedLane === "internal";
    const payload = {
      role: audience,
      amount: amountValue,
      title: paymentTitle,
      note: paymentNote,
      dueLabel: paymentDueLabel || undefined,
      projectId: activeConversation.serviceId || undefined,
      projectTitle: paymentProjectTitle || activeServiceTitle || activeConversation.summary || "General project",
      lane: isFreelancerInternal ? "internal" : "customer",
      payerRole: isFreelancerInternal ? "agency" : "client",
      payeeRole: isFreelancerInternal ? "freelancer" : "agency",
      payeeUpiId: isFreelancerInternal ? freelancerPayeeUpiId : undefined,
      payeeName: isFreelancerInternal ? freelancerPayeeName : undefined,
    };

    const response = await fetch(`/api/conversations/${activeConversation.id}/payment-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const apiPayload = await response.json().catch(() => null);
    if (!response.ok) {
      setComposerStatus(apiPayload?.error ?? "Could not create the payment request.");
      return;
    }

    setIsPaymentModalOpen(false);
    setPaymentAmount("");
    setPaymentTitle("Project advance");
    setPaymentProjectTitle("");
    setPaymentNote("");
    setPaymentDueLabel("");
    setComposerStatus(isFreelancerInternal ? "Internal PhonePe payment link generated." : "PhonePe payment request sent to customer lane.");
    if (apiPayload?.conversation) {
      syncConversationLocally(apiPayload.conversation, "payment");
    }
    await loadConversations({ silent: true });
    setIsDetailsOpen(true);
  }

  async function handleClientAliasSubmit() {
    if (!activeConversation || audience !== "freelancer") {
      return;
    }

    const alias = clientAliasValue.trim();
    if (!alias) {
      setComposerStatus("Client alias is required.");
      return;
    }

    const response = await fetch(`/api/conversations/${activeConversation.id}/client-alias`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setComposerStatus(payload?.error ?? "Could not update client alias.");
      return;
    }

    setIsClientAliasModalOpen(false);
    setComposerStatus("Client alias updated for your freelancer inbox.");
    if (payload?.conversation) {
      syncConversationLocally(payload.conversation, "client-alias");
    }
    await loadConversations({ silent: true });
  }

  function copyPaymentUpiId(upiId: string) {
    const value = upiId.trim();
    if (!value) {
      return;
    }

    navigator.clipboard
      .writeText(value)
      .then(() => setComposerStatus("UPI ID copied."))
      .catch(() => setComposerStatus("Copy failed. Please copy the UPI ID manually."));
  }

  async function handleEnableChatNotifications() {
    if (audience === "customer") {
      return;
    }

    if (isNotificationSetupSaving) {
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotificationSetupStatus("unsupported");
      setComposerStatus("This browser does not support web push notifications.");
      return;
    }

    setIsNotificationSetupSaving(true);
    setNotificationSetupStatus("working");
    setComposerStatus("Enabling chat alerts for this browser...");

    try {
      foregroundPushUnsubscribeRef.current?.();
      foregroundPushUnsubscribeRef.current = null;
      const result = await startWebPushNotifications({
        requestPermission: true,
        showForegroundNotification: true,
        onForegroundMessage: handleForegroundChatPush,
      });

      foregroundPushUnsubscribeRef.current = result.unsubscribe ?? null;
      notificationPermissionRef.current = result.permission ?? Notification.permission;
      setNotificationSetupStatus(result.ok ? "ready" : mapWebPushStatus(result.status));
      setComposerStatus(result.error ? `${getWebPushStatusMessage(result.status)} ${result.error}` : getWebPushStatusMessage(result.status));

      if (result.ok) {
        void playIncomingMessageChime();
      }
    } catch {
      setNotificationSetupStatus("error");
      setComposerStatus("Chat alerts could not be enabled right now.");
    } finally {
      setIsNotificationSetupSaving(false);
    }
  }

  function renderNotificationButton() {
    if (audience === "customer") {
      return null;
    }

    const isReady = notificationSetupStatus === "ready";
    const isBlocked = notificationSetupStatus === "blocked";
    const isWorking = isNotificationSetupSaving || notificationSetupStatus === "working";
    const label = isWorking ? "..." : isReady ? "Alerts on" : isBlocked ? "Blocked" : "Enable alerts";
    const title =
      notificationSetupStatus === "missing-config"
        ? "Firebase web push config is missing on the server"
        : isBlocked
          ? "Notifications are blocked for this browser"
          : isReady
            ? "Chat notifications are enabled"
            : "Enable chat notifications and sound";

    return (
      <button
        aria-label={title}
        className={isReady ? "chat-filter-button chat-notification-button active" : "chat-filter-button chat-notification-button"}
        disabled={isWorking}
        onClick={() => {
          void handleEnableChatNotifications();
        }}
        title={title}
        type="button"
      >
        <BellRing size={14} strokeWidth={1.8} />
        <span className="sr-only">{label}</span>
      </button>
    );
  }

  const titleNotificationAction = titleActionHost
    ? createPortal(renderNotificationButton(), titleActionHost)
    : null;

  const titleSearchAction = chatSearchHost
    ? createPortal(
        <div className="chat-topbar-search">
          <Search size={15} strokeWidth={1.8} aria-hidden="true" />
          <input
            aria-label="Search conversations"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search conversations"
            value={searchValue}
          />
          {searchValue ? (
            <button type="button" aria-label="Clear conversation search" onClick={() => setSearchValue("")}>
              <X size={13} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>,
        chatSearchHost,
      )
    : null;

  function renderLeadStatusPopover() {
    if (!isLeadStatusMenuOpen) {
      return null;
    }

    const statusesToRender = leadStatuses.filter((status) => status.active);

    return (
      <div
        className="chat-control-popover chat-status-manager"
        style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          left: "auto",
          zIndex: 150,
          width: "280px",
          padding: "12px",
          background: "#0c110e",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderRadius: "10px",
          boxShadow: "0 14px 34px rgba(0, 0, 0, 0.65)",
        }}
      >
        <div className="chat-popover-section" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", paddingBottom: "6px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255, 255, 255, 0.7)" }}>
              Select Lead Stage
            </span>
          </div>
          <div className="chat-status-list" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {statusesToRender.map((status) => {
              const currentStatusId = activeConversation?.leadStatusId || "";
              const isCurrent = currentStatusId === status.id;

              return (
                <button
                  className={isCurrent ? `${toneClassName(status.tone)} active` : toneClassName(status.tone)}
                  key={status.id}
                  onClick={() => handleLeadStatusChange(status.id).catch(() => undefined)}
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: isCurrent ? 700 : 500,
                    textAlign: "left",
                    cursor: "pointer",
                    width: "100%",
                    background: isCurrent ? "rgba(255, 107, 47, 0.14)" : "var(--closer-soft, rgba(255, 255, 255, 0.03))",
                    border: isCurrent ? "1px solid rgba(255, 107, 47, 0.45)" : "1px solid var(--closer-line, rgba(255, 255, 255, 0.08))",
                    color: isCurrent ? "#ff6b2f" : "var(--closer-ink, #f3f4f6)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <span
                      className={cx("chat-head-icon-dot", `tone-${status.tone}`)}
                      style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%" }}
                    />
                    <span>{status.label}</span>
                  </span>
                  {isCurrent ? <Check size={14} strokeWidth={2.5} /> : null}
                </button>
              );
            })}
          </div>
          {!statusesToRender.length ? (
            <p className="chat-picker-empty">
              {isSupportDataLoading ? "Loading workspace stages…" : "No live workspace stages are configured."}
            </p>
          ) : null}
        </div>

        {audience !== "sales" ? (
          <div className="chat-popover-section" style={{ marginTop: "12px" }}>
            <p className="chat-popover-title">Manage statuses</p>
            <div className="chat-status-admin-list">
              {leadStatuses.map((status, index) => (
                <div className="chat-status-admin-item" key={status.id}>
                  <button className={toneClassName(status.tone)} onClick={() => startEditingStatus(status)} type="button">
                    {status.label}
                  </button>
                  <div className="chat-status-admin-actions">
                    <button onClick={() => moveStatus(status.id, "up").catch(() => undefined)} type="button">
                      <ArrowUp size={13} />
                    </button>
                    <button onClick={() => moveStatus(status.id, "down").catch(() => undefined)} type="button">
                      <ArrowDown size={13} />
                    </button>
                    {index > 0 ? (
                      <button onClick={() => handleLeadStatusCrud("delete", { statusId: status.id }).catch(() => undefined)} type="button">
                        <X size={13} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {editingStatusId ? (
              <div className="chat-status-editor">
                <input onChange={(event) => setEditingStatusLabel(event.target.value)} placeholder="Rename status" value={editingStatusLabel} />
                <select value={editingStatusTone} onChange={(event) => setEditingStatusTone(event.target.value as DummyLeadStatusTone)}>
                  {TONE_OPTIONS.map((tone) => (
                    <option key={tone.value} value={tone.value}>
                      {tone.label}
                    </option>
                  ))}
                </select>
                <label className="chat-check-row">
                  <input checked={editingStatusActive} onChange={(event) => setEditingStatusActive(event.target.checked)} type="checkbox" />
                  <span>Active</span>
                </label>
                <div className="chat-inline-actions">
                  <button
                    className="ui-button-secondary"
                    onClick={() =>
                      handleLeadStatusCrud("update", {
                        statusId: editingStatusId,
                        label: editingStatusLabel,
                        tone: editingStatusTone,
                        active: editingStatusActive,
                      }).catch(() => undefined)
                    }
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    className="ui-button-ghost"
                    onClick={() => {
                      setEditingStatusId(null);
                      setEditingStatusLabel("");
                      setEditingStatusTone("neutral");
                      setEditingStatusActive(true);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="chat-status-editor">
              <input onChange={(event) => setNewStatusLabel(event.target.value)} placeholder="Create new status" value={newStatusLabel} />
              <select value={newStatusTone} onChange={(event) => setNewStatusTone(event.target.value as DummyLeadStatusTone)}>
                {TONE_OPTIONS.map((tone) => (
                  <option key={tone.value} value={tone.value}>
                    {tone.label}
                  </option>
                ))}
              </select>
              <button className="ui-button-secondary" onClick={() => handleLeadStatusCrud("create", { label: newStatusLabel, tone: newStatusTone, active: true }).catch(() => undefined)} type="button">
                Add status
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  async function handleSaveNotes(customNotes?: string, customFollowUp?: string | null) {
    if (!activeConversation) return;
    const notesToSave = customNotes !== undefined ? customNotes : notesDraft;
    const followUpToSave = customFollowUp !== undefined ? customFollowUp : followUpDraft ? new Date(followUpDraft).toISOString() : null;
    setIsNotesSaving(true);
    // Keep the note visible immediately while the DB write completes. The
    // server response remains authoritative and will reconcile this draft.
    syncConversationLocally(
      {
        ...activeConversation,
        internalNotes: notesToSave,
        nextFollowUpAt: followUpToSave,
        updatedAt: new Date().toISOString(),
      },
      "notes",
    );
    try {
      if (notesToSave.trim()) {
        await aicloserApi.conversations.addNote(activeConversation.id, notesToSave);
      }
      if (followUpToSave) {
        await aicloserApi.conversations.scheduleCallback(
          activeConversation.id,
          followUpToSave,
          notesToSave.trim() || undefined,
        );
      }
      setComposerStatus(followUpToSave ? "Note & follow-up reminder saved." : "Internal note saved.");
      replaceConversationLocally({
        ...activeConversation,
        internalNotes: notesToSave,
        nextFollowUpAt: followUpToSave,
        updatedAt: new Date().toISOString(),
      });
      broadcastChatWorkspaceSync({ reason: "notes", conversationId: activeConversation.id });
      setNotesDraft(notesToSave);
      setFollowUpDraft(followUpToSave ? followUpToSave.slice(0, 16) : "");
      // Refresh the 360 panel so the saved note appears in its activity
      // timeline immediately, without closing and reopening the drawer.
      if (isDetailsOpen || isNotesMenuOpen) {
        const refreshDetails = activeConversation.leadId
          ? aicloserApi.leads.get360(activeConversation.leadId).then((data) => setCrmDetails(mapCentralCrmDetails(data)))
          : fetch(`/api/conversations/${encodeURIComponent(activeConversation.id)}/crm-details`, { cache: "no-store" })
              .then((crmResponse) => crmResponse.json().catch(() => null))
              .then((crmPayload) => {
                if (crmPayload?.ok) setCrmDetails(crmPayload.customer360);
              });
        void refreshDetails
          .catch(() => undefined);
      }
      // The selected conversation is synchronized locally above. Refresh the
      // inbox in the background so saving a note is not held open by a full
      // list reload.
      void loadConversations({ silent: true }).catch(() => undefined);
    } catch (error) {
      setComposerStatus("Failed to save notes.");
    } finally {
      setIsNotesSaving(false);
    }
  }

  function renderNotesPopover() {
    if (!isNotesMenuOpen) {
      return null;
    }

    return (
      <div
        className="chat-control-popover chat-notes-popover"
        style={{
          width: "360px",
          maxWidth: "min(360px, calc(100vw - 32px))",
          boxSizing: "border-box",
          padding: "14px",
          zIndex: 120,
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          left: "auto",
          background: "#0c110e",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderRadius: "10px",
          boxShadow: "0 14px 34px rgba(0, 0, 0, 0.65)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            {notesPopoverMode === "notes" ? (
              <StickyNote size={15} style={{ color: "#38bdf8" }} />
            ) : (
              <CalendarClock size={15} style={{ color: "#ff6b2f" }} />
            )}
            <strong style={{ fontSize: "13px" }}>{notesPopoverMode === "notes" ? "Private notes" : "Schedule follow-up"}</strong>
          </div>
          <button
            type="button"
            onClick={() => setIsNotesMenuOpen(false)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 6px", color: "inherit", opacity: 0.7 }}
            aria-label="Close notes"
          >
            <X size={14} />
          </button>
        </div>
        <p style={{ fontSize: "11px", opacity: 0.7, margin: "0 0 8px", lineHeight: "1.4" }}>
          {notesPopoverMode === "notes"
            ? "Keep private context synced with the mobile app."
            : "Set the next follow-up time for this conversation."}
        </p>
        {notesPopoverMode === "notes" ? (
          <textarea
            aria-label="Internal lead notes"
            className="chat-notes-textarea"
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            placeholder="Client requirement, budget, objections, discussion notes..."
            rows={4}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 10px",
              borderRadius: "8px",
              fontSize: "12px",
              lineHeight: "1.5",
              resize: "vertical",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(0, 0, 0, 0.35)",
              color: "#fff",
              outline: "none",
              marginBottom: "10px",
              fontFamily: "inherit",
            }}
          />
        ) : null}

        {notesPopoverMode === "callback" ? <div style={{ marginBottom: "12px", background: "rgba(255, 255, 255, 0.03)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255, 255, 255, 0.85)", display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Calendar size={13} /> Callback Date & Time
              </span>
            </label>
            {followUpDraft ? (
              <button
                type="button"
                onClick={() => setFollowUpDraft("")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#f87171",
                  fontSize: "11px",
                  cursor: "pointer",
                  padding: "0 4px",
                  textDecoration: "underline",
                }}
              >
                Clear reminder
              </button>
            ) : null}
          </div>
          <input
            type="datetime-local"
            value={followUpDraft}
            onChange={(event) => setFollowUpDraft(event.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "6px 8px",
              borderRadius: "6px",
              fontSize: "12px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(0, 0, 0, 0.4)",
              color: "#fff",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: "6px", marginTop: "7px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(11, 0, 0, 0);
                const tzOffset = tomorrow.getTimezoneOffset() * 60000;
                const localISOTime = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
                setFollowUpDraft(localISOTime);
              }}
              style={{
                background: "rgba(255, 255, 255, 0.07)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "4px",
                fontSize: "10px",
                padding: "3px 7px",
                color: "rgba(255, 255, 255, 0.85)",
                cursor: "pointer",
              }}
            >
              + Tomorrow 11 AM
            </button>
            <button
              type="button"
              onClick={() => {
                const in2Days = new Date();
                in2Days.setDate(in2Days.getDate() + 2);
                in2Days.setHours(15, 0, 0, 0);
                const tzOffset = in2Days.getTimezoneOffset() * 60000;
                const localISOTime = new Date(in2Days.getTime() - tzOffset).toISOString().slice(0, 16);
                setFollowUpDraft(localISOTime);
              }}
              style={{
                background: "rgba(255, 255, 255, 0.07)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "4px",
                fontSize: "10px",
                padding: "3px 7px",
                color: "rgba(255, 255, 255, 0.85)",
                cursor: "pointer",
              }}
            >
              + In 2 Days 3 PM
            </button>
          </div>
        </div> : null}

        {(() => {
          const notesHistory = (crmDetails?.salesTimeline ?? []).filter((item) => String(item.body ?? "").trim());
          const callbackHistory = (crmDetails?.tasks ?? []).filter((task) => task.dueAt || /callback|follow[ -]?up/i.test(String(task.title ?? "")));
          const hasHistory = notesHistory.length > 0 || callbackHistory.length > 0;
          return (
            <div
              aria-label="Notes and callback history"
              style={{
                marginBottom: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.035)",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
                  <History size={13} /> Notes & callback history
                </span>
                <span style={{ fontSize: "10px", opacity: 0.55 }}>{notesHistory.length + callbackHistory.length}</span>
              </div>
              <div style={{ maxHeight: "132px", overflowY: "auto", padding: "4px 10px" }}>
                {isCrmDetailsLoading ? (
                  <p style={{ margin: "8px 0", fontSize: "11px", opacity: 0.6 }}>Loading history...</p>
                ) : !hasHistory ? (
                  <p style={{ margin: "8px 0", fontSize: "11px", opacity: 0.6 }}>No notes or callbacks saved yet.</p>
                ) : (
                  <>
                    {notesHistory.slice(0, 20).map((item) => (
                      <div key={`note-${item.id}`} style={{ padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "10px", opacity: 0.55 }}>
                          <span>Note</span>
                          <span>{item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime()) ? new Date(item.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        </div>
                        <p style={{ margin: "3px 0 0", fontSize: "11px", lineHeight: 1.35 }}>{item.body}</p>
                      </div>
                    ))}
                    {callbackHistory.slice(0, 20).map((task) => (
                      <div key={`callback-${task.id}`} style={{ padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "10px", opacity: 0.55 }}>
                          <span>Callback</span>
                          <span>{task.dueAt && !Number.isNaN(new Date(task.dueAt).getTime()) ? new Date(task.dueAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        </div>
                        <p style={{ margin: "3px 0 0", fontSize: "11px", lineHeight: 1.35 }}>{task.title || "Scheduled callback"}</p>
                        {task.status ? <span style={{ fontSize: "10px", opacity: 0.55 }}>{task.status}</span> : null}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })()}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            type="button"
            className="ui-button-secondary"
            style={{ fontSize: "12px", padding: "5px 12px", height: "auto", cursor: "pointer" }}
            onClick={() => {
              setNotesDraft(activeConversation?.internalNotes ?? "");
              setFollowUpDraft(activeConversation?.nextFollowUpAt ? activeConversation.nextFollowUpAt.slice(0, 16) : "");
              setIsNotesMenuOpen(false);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ui-button-primary"
            style={{ fontSize: "12px", padding: "5px 14px", height: "auto", cursor: "pointer" }}
            disabled={isNotesSaving}
            onClick={() => {
              handleSaveNotes().then(() => setIsNotesMenuOpen(false));
            }}
          >
            {isNotesSaving ? "Saving..." : notesPopoverMode === "notes" ? "Save note" : "Save follow-up"}
          </button>
        </div>
      </div>
    );
  }

  function renderAssignPopover() {
    if (!isAssignMenuOpen) {
      return null;
    }

    const hasPrimaryEditor = Boolean(activeAssignment?.assignedFreelancerId);

    return (
      <div className="chat-control-popover chat-assign-popover" role="dialog" aria-label="Assign chat agent">
        <div className="chat-assign-heading">
          <div>
            <strong>Assign agent</strong>
            <p>Choose an active team member from this workspace.</p>
          </div>
          {hasPrimaryEditor ? <span className="chat-assign-current">Assigned: {activeAssignment?.assignedFreelancerName}</span> : null}
        </div>
        <label className="chat-picker-search">
          <Search size={13} strokeWidth={1.8} />
          <input onChange={(event) => setAssignSearchValue(event.target.value)} placeholder="Search team member" value={assignSearchValue} />
        </label>
        <div className="chat-assign-list">
          {hasLoadedSupportData ? filteredAssignableEditors.map((editor) => (
            <button
              className={cx("chat-assign-item", selectedAssignEditorIds.includes(editor.id) && "selected", editor.id === activeAssignment?.assignedFreelancerId && "current")}
              disabled={editor.id === activeAssignment?.assignedFreelancerId}
              key={editor.id}
              onClick={() => setSelectedAssignEditorIds([editor.id])}
              type="button"
            >
              <span className="chat-assign-avatar"><UserRound size={16} strokeWidth={1.8} /></span>
              <div className="chat-assign-item-copy">
                <strong>{editor.name}</strong>
                <p>{editor.onlineStatus === "online" ? "Online" : "Offline"}</p>
              </div>
              {selectedAssignEditorIds.includes(editor.id) ? <Check size={16} strokeWidth={2.2} /> : null}
            </button>
          )) : null}
          {isSupportDataLoading || !hasLoadedSupportData ? <p className="chat-picker-empty">Loading team members...</p> : null}
          {hasLoadedSupportData && !filteredAssignableEditors.length ? (
            <p className="chat-picker-empty">
              {assignableEditors.length
                ? "No team member matched that search."
                : "No active team members are available in this workspace."}
            </p>
          ) : null}
        </div>
        <div className="chat-assign-footer">
          <button
            className="chat-assign-direct-button"
            disabled={selectedAssignEditorIds.length !== 1 || isSendingAssignmentOffer || isAssigningDirectly || isRemovingAssignment}
            onClick={() => handleAssign("", "direct").catch(() => undefined)}
            type="button"
          >
            {isAssigningDirectly ? "Assigning..." : "Assign agent"}
          </button>
          {hasPrimaryEditor ? (
            <button
              className="chat-assignment-unassign chat-assignment-unassign-compact"
              disabled={isRemovingAssignment || isAssigningDirectly}
              onClick={() => handleRemoveEditorAssignment().catch(() => undefined)}
              type="button"
            >
              <CircleOff size={15} strokeWidth={1.8} />
              <span>{isRemovingAssignment ? "Removing..." : "Remove assignment"}</span>
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const channelCounts = useMemo(() => {
    let company = 0;
    let personal = 0;
    let instagram = 0;
    let all = 0;
    let companyUnread = 0;
    let personalUnread = 0;
    let allUnread = 0;

    for (const c of conversations) {
      all++;
      if (getConversationSourceChannel(c) === "instagram") {
        instagram++;
      }
      const isPersonal = c.externalSourceType === "whatsapp_personal" || c.externalSourceType === "whatsapp_business";
      const unread = c.unreadCount ?? 0;
      if (unread > 0) allUnread += unread;
      if (isPersonal) {
        personal++;
        if (unread > 0) personalUnread += unread;
      } else {
        company++;
        if (unread > 0) companyUnread += unread;
      }
    }

    return { all, company, personal, instagram, allUnread, companyUnread, personalUnread };
  }, [conversations]);

  const handleSelectChannelTab = useCallback((tab: ChannelFilter) => {
    setChannelFilter(tab);
    const matching = conversations.filter((c) => {
      if (tab === "whatsapp_company") {
        return c.externalSourceType !== "whatsapp_personal" && c.externalSourceType !== "whatsapp_business";
      }
      if (tab === "whatsapp_connected") {
        return c.externalSourceType === "whatsapp_personal" || c.externalSourceType === "whatsapp_business";
      }
      if (tab === "instagram") {
        return getConversationSourceChannel(c) === "instagram";
      }
      return true;
    });
    if (!isCompactChatLayout && matching.length > 0) {
      const currentMatches = matching.some((c) => c.id === selectedConversationId);
      if (!currentMatches) {
        setSelectedConversationId(matching[0].id);
      }
    }
  }, [conversations, isCompactChatLayout, selectedConversationId]);

  const channelOptions: Array<{ id: ChannelFilter; label: string; count: number; unread: number; icon: ReactNode }> = [
    { id: "all", label: "All channels", count: channelCounts.all, unread: channelCounts.allUnread, icon: <MessageSquare size={13} strokeWidth={1.9} /> },
    { id: "whatsapp_company", label: "WhatsApp API", count: channelCounts.company, unread: channelCounts.companyUnread, icon: <Building2 size={13} strokeWidth={1.9} /> },
    { id: "whatsapp_connected", label: "WhatsApp Personal", count: channelCounts.personal, unread: channelCounts.personalUnread, icon: <Smartphone size={13} strokeWidth={1.9} /> },
    ...(channelCounts.instagram > 0 || channelFilter === "instagram"
      ? [{ id: "instagram" as ChannelFilter, label: "Instagram", count: channelCounts.instagram, unread: 0, icon: <Instagram size={13} strokeWidth={1.9} /> }]
      : []),
  ];
  const selectedChannel = channelOptions.find((option) => option.id === channelFilter) ?? channelOptions[0];

  const selectedLeadStatus = leadStatuses.find((s) => s.id === leadStatusFilterId);
  const selectedStatusBadge = selectedLeadStatus ? getLeadBadgeConfig(selectedLeadStatus.id, selectedLeadStatus.label, selectedLeadStatus.tone) : null;

  const leadStatusFilterControl = (
    <div ref={leadStatusPickerRef} className="chat-stage-picker">
      {leadStatusFilterId !== "all" && selectedLeadStatus ? (
        <button
          type="button"
          className="chat-filter-chip label-chip active"
          style={{
            background: selectedStatusBadge?.bg,
            borderColor: selectedStatusBadge?.border,
            color: selectedStatusBadge?.text,
            boxShadow: selectedStatusBadge?.glow,
          }}
          onClick={() => setLeadStatusFilterId("all")}
          title={`Active Filter: ${selectedLeadStatus.label}. Click to clear.`}
        >
          <span className="chat-thread-top-label-dot" style={{ backgroundColor: selectedStatusBadge?.dot }} />
          <span>{selectedLeadStatus.label}</span>
          <X size={11} style={{ marginLeft: "4px" }} />
        </button>
      ) : (
        <button
          type="button"
          className={cx("chat-filter-chip", isLeadStatusMenuOpen && "active")}
          onClick={() => setIsLeadStatusMenuOpen((curr) => !curr)}
          title="Filter by CRM lead stage"
        >
          <Tag size={12} strokeWidth={2} />
          <span>Stages</span>
          <ChevronDown size={11} />
        </button>
      )}

      {isLeadStatusMenuOpen && leadStatusMenuPosition && typeof document !== "undefined" ? createPortal(
        <div
          className="chat-stage-menu"
          role="menu"
          aria-label="Filter conversations by lead stage"
          style={{
            position: "fixed",
            top: leadStatusMenuPosition.top,
            left: leadStatusMenuPosition.left,
            zIndex: 1200,
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            width: "min(280px, calc(100vw - 32px))",
            minWidth: "220px",
            maxWidth: "calc(100vw - 32px)",
            boxSizing: "border-box",
            overflow: "visible",
            padding: "6px",
            border: "1px solid var(--crm-border-strong, #cbd5e1)",
            borderRadius: "10px",
            background: "var(--crm-surface, #ffffff)",
            color: "var(--crm-text, #0f172a)",
            boxShadow: "0 14px 28px rgba(15, 23, 42, 0.16)",
          }}
        >
          <button
            type="button"
            className={cx("chat-filter-chip", leadStatusFilterId === "all" && "active")}
            style={{ width: "100%", minHeight: "30px", justifyContent: "flex-start", margin: 0 }}
            onClick={() => {
              setLeadStatusFilterId("all");
              setIsLeadStatusMenuOpen(false);
            }}
          >
            All Stages
          </button>
          {leadStatuses.filter((s) => s.active).map((status) => {
            const badgeCfg = getLeadBadgeConfig(status.id, status.label, status.tone);
            const isSelected = leadStatusFilterId === status.id;
            return (
              <button
                key={status.id}
                type="button"
                className={cx("chat-filter-chip label-chip", isSelected && "active")}
                style={{
                  width: "100%",
                  minHeight: "30px",
                  justifyContent: "flex-start",
                  margin: 0,
                  ...(isSelected ? { background: badgeCfg.bg, borderColor: badgeCfg.border, color: badgeCfg.text } : {}),
                }}
                onClick={() => {
                  setLeadStatusFilterId(status.id);
                  setIsLeadStatusMenuOpen(false);
                }}
              >
                <span className="chat-thread-top-label-dot" style={{ backgroundColor: badgeCfg.dot }} />
                <span>{status.label}</span>
              </button>
            );
          })}
          {leadStatuses.filter((s) => s.active).length === 0 ? (
            <p className="chat-stage-empty" role="status" style={{ margin: "4px 6px", color: "var(--crm-text-muted, #64748b)", fontSize: "0.75rem", lineHeight: 1.35 }}>
              No live stages configured
            </p>
          ) : null}
          <div className="chat-stage-popover-footer" style={{ display: "flex", marginTop: "4px", paddingTop: "6px", borderTop: "1px solid var(--crm-border, #e2e8f0)" }}>
            <button
              type="button"
              className="chat-filter-chip add-label-btn"
              style={{ width: "100%", minHeight: "30px", justifyContent: "center", margin: 0 }}
              onClick={() => {
                setIsLeadStatusMenuOpen(false);
                setIsCreateLabelModalOpen(true);
              }}
            >
              <Plus size={12} />
              <span>Custom Label</span>
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );

  const channelTopTabs = (
    <div className="chat-rail-top-controls">
      <div className="chat-channel-picker" data-open={isChannelMenuOpen ? "true" : "false"}>
        <button
          type="button"
          className="chat-channel-picker-trigger"
          aria-expanded={isChannelMenuOpen}
          aria-haspopup="listbox"
          onClick={() => setIsChannelMenuOpen((current) => !current)}
          title="Filter conversations by channel"
        >
          <span className="chat-channel-picker-icon">{selectedChannel.icon}</span>
          <span className="chat-channel-picker-label">{selectedChannel.label}</span>
          <span className="chat-channel-picker-count">{selectedChannel.count}</span>
          {selectedChannel.unread > 0 ? <span className="chat-top-tab-unread-dot" title={`${selectedChannel.unread} unread`} /> : null}
          <ChevronDown size={13} strokeWidth={1.9} />
        </button>
        {isChannelMenuOpen ? (
          <div className="chat-channel-picker-menu" role="listbox" aria-label="Conversation channels">
            {channelOptions.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.id === channelFilter}
                className={cx("chat-channel-picker-option", option.id === channelFilter && "active")}
                key={option.id}
                onClick={() => {
                  handleSelectChannelTab(option.id);
                  setIsChannelMenuOpen(false);
                }}
              >
                <span className="chat-channel-picker-icon">{option.icon}</span>
                <span>{option.label}</span>
                <span className="chat-channel-picker-count">{option.count}</span>
                {option.unread > 0 ? <span className="chat-top-tab-unread-dot" title={`${option.unread} unread`} /> : null}
                {option.id === channelFilter ? <Check size={13} strokeWidth={2.2} /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {leadStatusFilterControl}
    </div>
  );

  const filterRowElement = (
    <ChatFilterBar>
      <button
        className={activeFilter === "all" && leadStatusFilterId === "all" ? "chat-filter-chip active" : "chat-filter-chip"}
        onClick={() => {
          setActiveFilter("all");
          setLeadStatusFilterId("all");
        }}
        type="button"
      >
        All
      </button>
      <button
        className={activeFilter === "unread" ? "chat-filter-chip active" : "chat-filter-chip"}
        onClick={() => setActiveFilter((current) => (current === "unread" ? "all" : "unread"))}
        type="button"
      >
        Unread
      </button>
      <button
        className={activeFilter === "waiting" ? "chat-filter-chip active" : "chat-filter-chip"}
        onClick={() => setActiveFilter((current) => (current === "waiting" ? "all" : "waiting"))}
        type="button"
      >
        Waiting
      </button>
      <button
        className={activeFilter === "paused" ? "chat-filter-chip active" : "chat-filter-chip"}
        onClick={() => setActiveFilter((current) => (current === "paused" ? "all" : "paused"))}
        type="button"
      >
        Paused
      </button>

      {channelCounts.instagram > 0 || channelFilter === "instagram" ? (
        <button
          aria-label="Show Instagram chats"
          className={channelFilter === "instagram" ? "chat-filter-chip chat-channel-filter-chip active" : "chat-filter-chip chat-channel-filter-chip"}
          onClick={() => setChannelFilter((current) => (current === "instagram" ? "all" : "instagram"))}
          type="button"
        >
          <Instagram size={12} style={{ marginRight: "4px" }} />
          <span>Instagram</span>
        </button>
      ) : null}

      <button
        aria-label="More filters"
        className={isFilterMenuOpen ? "chat-filter-button active" : "chat-filter-button"}
        onClick={() => setIsFilterMenuOpen((current) => !current)}
        type="button"
        title="More filters"
      >
        <Filter size={14} strokeWidth={1.8} />
        <span className="chat-filter-action-label">More filters</span>
      </button>

      {(audience === "admin" || audience === "manager" || audience === "sales") ? (
        <button
          aria-label="New chat"
          className="chat-filter-button"
          onClick={() => { closeTransientMenus(); setIsNewChatOpen(true); }}
          type="button"
          title="New Chat"
        >
          <Plus size={14} strokeWidth={1.8} />
          <span className="chat-filter-action-label">New chat</span>
        </button>
      ) : null}
    </ChatFilterBar>
  );

  if (!activeConversation && filteredConversations.length === 0) {
    const isFilteringInbox =
      Boolean(searchValue.trim()) ||
      activeFilter !== "all" ||
      channelFilter !== "all" ||
      assignedFilter !== "all" ||
      paymentPendingOnly ||
      leadStatusFilterId !== "all";
    const emptySidebarTitle = isInboxLoading
      ? "Loading chats"
      : isFilteringInbox
        ? "No matching threads"
        : "No conversations ready yet";
    const emptySidebarCopy = isInboxLoading
      ? "Loading your latest customer conversations."
      : isFilteringInbox
        ? "Try clearing the current search or filters to bring matching threads back into the rail."
        : "New customer conversations from WhatsApp, Instagram, and your connected channels will appear here.";
    const emptyMainTitle = isInboxLoading
      ? "Loading chats"
      : composerStatus
        ? "Chat inbox needs a refresh"
        : isFilteringInbox
          ? "No threads matched this view"
          : "No conversations yet";
    const emptyMainCopy = isInboxLoading
      ? ""
      : composerStatus
        ? composerStatus
        : isFilteringInbox
          ? "Clear the active search or filters and the full inbox will return here."
          : "New WhatsApp, Instagram, and CRM leads will land here automatically.";

    return (
      <div className={cx(styles.shell, "aicloser-web-chat-shell")}>
        {titleNotificationAction}
        {titleSearchAction}
        <aside className={cx(styles.rail, isCompactChatLayout ? styles.railFullScreen : undefined)}>
          <ChatSidebarHeader
            extra={
              <>
                {isFilterMenuOpen ? (
                  <div className="chat-filter-popover">
                    <label className="chat-control-field">
                      <span>Lead status</span>
                      <select value={leadStatusFilterId} onChange={(event) => setLeadStatusFilterId(event.target.value)}>
                        <option value="all">All statuses</option>
                        {leadStatuses.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="chat-control-field">
                      <span>Assignment</span>
                      <select value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value as AssignedFilter)}>
                        <option value="all">All threads</option>
                        <option value="assigned">Assigned</option>
                        <option value="unassigned">Unassigned</option>
                      </select>
                    </label>
                    <label className="chat-check-row">
                      <input checked={paymentPendingOnly} onChange={(event) => setPaymentPendingOnly(event.target.checked)} type="checkbox" />
                      <span>Payment pending</span>
                    </label>
                  </div>
                ) : null}
              </>
            }
            filterRow={filterRowElement}
            onSearchChange={setSearchValue}
            hideSearch
            searchPlaceholder="Search threads"
            searchValue={searchValue}
            subtitle=""
            title=""
            topTabs={channelTopTabs}
          />

          <div className={cx("chat-inbox-thread-scroll empty", styles.railBody)}>
            <ChatSidebarEmptyState badge={isInboxLoading ? "..." : "0"} copy={emptySidebarCopy} title={emptySidebarTitle} />
          </div>
        </aside>
        {!isCompactChatLayout ? (
          <section className={styles.stage}>
            <ChatStageEmptyState
              action={
                !isInboxLoading ? (
                  <button
                    className="chat-filter-chip active"
                    onClick={() => {
                      if (isFilteringInbox) {
                        resetInboxFilters();
                        return;
                      }
                      loadConversations().catch(() => undefined);
                    }}
                    type="button"
                  >
                    {isFilteringInbox ? "Clear filters" : "Retry inbox"}
                  </button>
                ) : null
              }
              copy={emptyMainCopy}
              title={emptyMainTitle}
            />
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div
        className={cx(styles.shell, "aicloser-web-chat-shell", !isCompactChatLayout && isDetailsOpen ? styles.shellWithDetails : undefined)}
      >
        {titleNotificationAction}
        {titleSearchAction}
        {showConversationRail ? <aside className={cx(styles.rail, isCompactChatLayout ? styles.railFullScreen : undefined)}>
          <ChatSidebarHeader
            extra={
              <>
                {audience === "freelancer" && agencyFilterOptions.length > 1 ? (
                  <div className="chat-agency-filter-row">
                    <button className={agencyFilter === "all" ? "chat-filter-chip active" : "chat-filter-chip"} onClick={() => setAgencyFilter("all")} type="button">
                      All agencies
                    </button>
                    {agencyFilterOptions.map((item) => (
                      <button
                        className={agencyFilter === item.tenantId ? "chat-filter-chip active" : "chat-filter-chip"}
                        key={item.tenantId}
                        onClick={() => setAgencyFilter(item.tenantId)}
                        type="button"
                      >
                        {item.agencyName}
                      </button>
                    ))}
                  </div>
                ) : null}
                {isFilterMenuOpen ? (
                  <div className="chat-filter-popover">
                    {audience === "freelancer" ? (
                      <label className="chat-control-field">
                        <span>Agency</span>
                        <select value={agencyFilter} onChange={(event) => setAgencyFilter(event.target.value)}>
                          <option value="all">All active agencies</option>
                          {agencyFilterOptions.map((item) => (
                            <option key={item.tenantId} value={item.tenantId}>
                              {item.agencyName}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="chat-control-field">
                      <span>Lead status</span>
                      <select value={leadStatusFilterId} onChange={(event) => setLeadStatusFilterId(event.target.value)}>
                        <option value="all">All statuses</option>
                        {leadStatuses.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="chat-control-field">
                      <span>Assignment</span>
                      <select value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value as AssignedFilter)}>
                        <option value="all">All threads</option>
                        <option value="assigned">Assigned</option>
                        <option value="unassigned">Unassigned</option>
                      </select>
                    </label>
                    <label className="chat-check-row">
                      <input checked={paymentPendingOnly} onChange={(event) => setPaymentPendingOnly(event.target.checked)} type="checkbox" />
                      <span>Payment pending</span>
                    </label>
                  </div>
                ) : null}
              </>
            }
            filterRow={filterRowElement}
            onSearchChange={setSearchValue}
            hideSearch
            searchPlaceholder="Search or start a new chat"
            searchValue={searchValue}
            subtitle=""
            title=""
            topTabs={channelTopTabs}
          />

          <div className={styles.railScrollFrame}>
            <div className={cx("chat-inbox-thread-scroll", styles.railBody)} ref={railScrollRef}>
              {filteredConversations.map((conversation) => (
                <ChatThreadRow
                  audience={audience}
                  conversation={conversation}
                  key={conversation.id}
                  onSelect={handleSelectConversation}
                  selected={selectedConversationId === conversation.id}
                />
              ))}
            </div>
          </div>
        </aside> : null}

        {showConversationStage && activeConversation ? <>
          <section className={cx(styles.stage, isCompactChatLayout ? styles.stageFullScreen : undefined)}>
          <header
            className={cx(
              "chat-thread-head crm-chat-head",
              styles.stageHeader,
              isCompactChatLayout ? styles.compactStageHeader : undefined,
              isHeaderActionsOpen ? "has-header-actions-open" : undefined,
            )}
            style={isCompactChatLayout ? undefined : { display: "flex", flexWrap: "wrap", alignItems: "stretch", justifyContent: "flex-start", gap: 0, padding: 0, overflow: "visible" }}
          >
            <div
              className={cx("chat-thread-head-main", isCompactChatLayout ? styles.compactStageHeaderMain : undefined)}
              style={isCompactChatLayout ? undefined : { flex: "0 0 100%", width: "100%", minWidth: 0, boxSizing: "border-box" }}
            >
              {isCompactChatLayout ? (
                <button
                  aria-label="Back to chats"
                  className="chat-head-icon chat-head-back"
                  data-tooltip="Back to chats"
                  onClick={closeMobileThreadView}
                  title="Back to chats"
                  type="button"
                >
                  <ArrowLeft size={16} strokeWidth={1.8} />
                </button>
              ) : null}
              <div
                aria-expanded={isDetailsOpen}
                aria-label={`Open ${activeCustomerName} profile and history`}
                className="chat-profile-trigger"
                onClick={() => {
                  setIsDetailsOpen(true);
                  setIsAssignMenuOpen(false);
                  setIsNotesMenuOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsDetailsOpen(true);
                    setIsAssignMenuOpen(false);
                    setIsNotesMenuOpen(false);
                  }
                }}
                role="button"
                tabIndex={0}
                title="Open profile and customer history"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  padding: 0,
                  outline: "none",
                }}
              >
              <ChatAvatar className="chat-thread-head-avatar" imageUrl={activeConversation.customerProfileImageUrl} name={activeCustomerName} />
              <div className="chat-thread-head-copy">
                <div className="chat-thread-head-title">
                  <strong title={activeCustomerName}>{activeCustomerName}</strong>
                  {activeConversation.sourceChannel === "instagram" ? (
                    <span className="chat-source-chip instagram strong">Instagram</span>
                  ) : activeConversation.externalSourceType === "whatsapp_personal" || activeConversation.externalSourceType === "whatsapp_business" ? (
                    <span
                      className="chat-source-chip personal-wa"
                      style={{
                        background: "rgba(2, 132, 199, 0.18)",
                        color: "#38bdf8",
                        border: "1px solid rgba(2, 132, 199, 0.4)",
                        borderRadius: "5px",
                        padding: "2px 6px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="WhatsApp Personal (Closer Connected Mobile WhatsApp Device)"
                    >
                      <Smartphone size={11} />
                      WhatsApp Personal
                    </span>
                  ) : (
                    <span
                      className="chat-source-chip company-wa"
                      style={{
                        background: "rgba(16, 185, 129, 0.18)",
                        color: "#34d399",
                        border: "1px solid rgba(16, 185, 129, 0.4)",
                        borderRadius: "5px",
                        padding: "2px 6px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="WhatsApp API (Official WhatsApp Cloud API & CRM Platform Intake)"
                    >
                      <Building2 size={11} />
                      WhatsApp API
                    </span>
                  )}
                </div>
                <div className="chat-thread-head-subtitle" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    className="chat-thread-contact-number"
                    title={activeCustomerHeaderContact}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      fontFamily: "monospace",
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    <Phone size={12} style={{ color: "var(--closer-orange, #ff6b2f)" }} />
                    {activeCustomerPhone}
                  </span>
                  {activeCustomerPhone && activeCustomerPhone !== "Customer contact hidden" ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigator.clipboard.writeText(activeCustomerPhone.replace(/\D/g, ""));
                        setComposerStatus("Phone number copied to clipboard.");
                      }}
                      title="Copy customer phone number"
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid rgba(255, 255, 255, 0.16)",
                        borderRadius: "4px",
                        color: "#94a3b8",
                        fontSize: "10.5px",
                        padding: "2px 7px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Copy
                    </button>
                  ) : null}
                  {typingMessage ? <span className="chat-thread-presence is-typing">{typingMessage.label} is typing...</span> : null}
                  {!typingMessage && customerPresenceLabel ? <span className="chat-thread-presence">{customerPresenceLabel}</span> : null}
                  {whatsappReplyWindow ? (
                    <span
                      className={cx(
                        "chat-reply-window",
                        whatsappReplyWindow.isOpen
                          ? whatsappReplyWindow.remainingMs <= 2 * 60 * 60 * 1000
                            ? "warning"
                            : "open"
                          : "closed",
                      )}
                      title={
                        whatsappReplyWindow.isOpen
                          ? `Meta 24-hour WhatsApp customer-care window closes ${!Number.isNaN(new Date(whatsappReplyWindow.expiresAt).getTime()) ? new Date(whatsappReplyWindow.expiresAt).toLocaleString("en-IN") : ""}`
                          : "Meta 24-hour WhatsApp customer-care window is closed"
                      }
                    >
                      <Clock size={11} strokeWidth={2} />
                      <span>
                        {whatsappReplyWindow.isOpen
                          ? `Reply window: ${formatReplyWindowRemaining(whatsappReplyWindow.remainingMs)} left`
                          : "Reply window closed"}
                      </span>
                    </span>
                  ) : null}
                </div>
                {registrationStatus ? (
                  <div className="crm-status-icon-bar" style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "6px", flexWrap: "wrap" }}>
                    {/* 1. Mobile App Installed */}
                    <span
                      className={cx("crm-status-icon-chip", appInstalled ? "is-on" : "is-off")}
                      title={`Mobile App: ${registrationStateLabel(appInstalled)}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "26px",
                        height: "26px",
                        borderRadius: "7px",
                        background: appInstalled ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.025)",
                        border: appInstalled ? "1.5px solid #22c55e" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: appInstalled ? "#4ade80" : "rgba(255, 255, 255, 0.22)",
                        boxShadow: appInstalled ? "0 0 12px rgba(34, 197, 94, 0.8), 0 0 22px rgba(34, 197, 94, 0.35), inset 0 0 8px rgba(34, 197, 94, 0.3)" : "none",
                        opacity: appInstalled ? 1 : 0.38,
                        cursor: "help",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Smartphone size={13} strokeWidth={appInstalled ? 2.5 : 1.8} />
                    </span>

                    {/* 4. WhatsApp Channel */}
                    <span
                      className={cx("crm-status-icon-chip", whatsappChannel?.connected ? "is-on" : whatsappChannel?.hasIssue ? "is-warn" : "is-off")}
                      title={`WhatsApp: ${whatsappChannel?.status || (whatsappChannel?.connected ? "Connected" : "Not connected")}${whatsappChannel?.phoneNumber ? ` (${whatsappChannel?.phoneNumber})` : ""}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "26px",
                        height: "26px",
                        borderRadius: "7px",
                        background: whatsappChannel?.connected
                          ? "rgba(37, 211, 102, 0.22)"
                          : whatsappChannel?.hasIssue
                            ? "rgba(245, 158, 11, 0.18)"
                            : "rgba(255, 255, 255, 0.025)",
                        border: whatsappChannel?.connected
                          ? "1.5px solid #25D366"
                          : whatsappChannel?.hasIssue
                            ? "1.5px solid #f59e0b"
                            : "1px solid rgba(255, 255, 255, 0.08)",
                        color: whatsappChannel?.connected
                          ? "#25D366"
                          : whatsappChannel?.hasIssue
                            ? "#fbbf24"
                            : "rgba(255, 255, 255, 0.22)",
                        boxShadow: whatsappChannel?.connected
                          ? "0 0 14px rgba(37, 211, 102, 0.85), 0 0 24px rgba(37, 211, 102, 0.4), inset 0 0 8px rgba(37, 211, 102, 0.35)"
                          : whatsappChannel?.hasIssue
                            ? "0 0 12px rgba(245, 158, 11, 0.7), inset 0 0 6px rgba(245, 158, 11, 0.25)"
                            : "none",
                        opacity: whatsappChannel?.connected || whatsappChannel?.hasIssue ? 1 : 0.38,
                        cursor: "help",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <MessageSquare size={13} strokeWidth={whatsappChannel?.connected ? 2.5 : 1.8} />
                    </span>

                    {/* 5. Instagram Channel */}
                    <span
                      className={cx("crm-status-icon-chip", instagramChannel?.connected ? "is-on" : instagramChannel?.hasIssue ? "is-warn" : "is-off")}
                      title={`Instagram: ${instagramChannel?.status || (instagramChannel?.connected ? "Connected" : "Not connected")}${instagramChannel?.username ? ` (@${(instagramChannel?.username || '').replace(/^@/, "")})` : ""}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "26px",
                        height: "26px",
                        borderRadius: "7px",
                        background: instagramChannel?.connected
                          ? "linear-gradient(135deg, rgba(225, 48, 108, 0.28), rgba(131, 58, 180, 0.28))"
                          : instagramChannel?.hasIssue
                            ? "rgba(245, 158, 11, 0.18)"
                            : "rgba(255, 255, 255, 0.025)",
                        border: instagramChannel?.connected
                          ? "1.5px solid #E1306C"
                          : instagramChannel?.hasIssue
                            ? "1.5px solid #f59e0b"
                            : "1px solid rgba(255, 255, 255, 0.08)",
                        color: instagramChannel?.connected
                          ? "#f472b6"
                          : instagramChannel?.hasIssue
                            ? "#fbbf24"
                            : "rgba(255, 255, 255, 0.22)",
                        boxShadow: instagramChannel?.connected
                          ? "0 0 14px rgba(225, 48, 108, 0.85), 0 0 24px rgba(225, 48, 108, 0.4), inset 0 0 8px rgba(225, 48, 108, 0.35)"
                          : instagramChannel?.hasIssue
                            ? "0 0 12px rgba(245, 158, 11, 0.7), inset 0 0 6px rgba(245, 158, 11, 0.25)"
                            : "none",
                        opacity: instagramChannel?.connected || instagramChannel?.hasIssue ? 1 : 0.38,
                        cursor: "help",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Instagram size={13} strokeWidth={instagramChannel?.connected ? 2.5 : 1.8} />
                    </span>

                    {/* 6. Billing / Plan */}
                    {(() => {
                      const isPaid = registrationStatus.billingState === "PAID";
                      const isTrial = registrationStatus.billingState === "TRIAL";
                      const isExpired = registrationStatus.billingState === "TRIAL_EXPIRED";
                      const isBillingActive = isPaid || isTrial;
                      const expiryText = registrationStatus.planExpiresAt && !Number.isNaN(new Date(String(registrationStatus.planExpiresAt)).getTime())
                        ? ` · Valid until ${new Date(String(registrationStatus.planExpiresAt)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                        : "";
                      const bg = isPaid
                        ? "rgba(255, 107, 47, 0.22)"
                        : isTrial
                          ? "rgba(56, 189, 248, 0.22)"
                          : isExpired
                            ? "rgba(239, 68, 68, 0.22)"
                            : "rgba(255, 255, 255, 0.025)";
                      const border = isPaid
                        ? "1.5px solid #ff6b2f"
                        : isTrial
                          ? "1.5px solid #38bdf8"
                          : isExpired
                            ? "1.5px solid #ef4444"
                            : "1px solid var(--closer-line, rgba(255, 255, 255, 0.08))";
                      const color = isPaid
                        ? "#ff6b2f"
                        : isTrial
                          ? "#38bdf8"
                          : isExpired
                            ? "#f87171"
                            : "rgba(255, 255, 255, 0.22)";
                      const glow = isPaid
                        ? "0 0 14px rgba(255, 107, 47, 0.65), inset 0 0 8px rgba(255, 107, 47, 0.25)"
                        : isTrial
                          ? "0 0 14px rgba(56, 189, 248, 0.85), 0 0 24px rgba(56, 189, 248, 0.4), inset 0 0 8px rgba(56, 189, 248, 0.35)"
                          : isExpired
                            ? "0 0 14px rgba(239, 68, 68, 0.85), 0 0 24px rgba(239, 68, 68, 0.4), inset 0 0 8px rgba(239, 68, 68, 0.35)"
                            : "none";
                      return (
                        <span
                          className={cx("crm-status-icon-chip", isBillingActive ? "is-on" : isExpired ? "is-warn" : "is-off")}
                          title={`Plan / Billing: ${billingStateLabel}${expiryText}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "26px",
                            height: "26px",
                            borderRadius: "7px",
                            background: bg,
                            border: border,
                            color: color,
                            boxShadow: glow,
                            opacity: isBillingActive || isExpired ? 1 : 0.38,
                            cursor: "help",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <CreditCard size={13} strokeWidth={isBillingActive ? 2.5 : 1.8} />
                        </span>
                      );
                    })()}

                    {/* 7. WhatsApp Number Match & 1-Click Dialer */}
                    {activeConversation.customerPhone ? (
                      <a
                        href={`tel:${activeConversation.customerPhone.replace(/[^\d+]/g, "")}`}
                        className={cx("crm-status-icon-chip", "crm-header-dialer-action", registrationStatus.whatsappMatch === "MATCH" ? "is-on" : "is-warn")}
                        title={`Call ${activeCustomerName} (${activeConversation.customerPhone}) • Phone Match: ${whatsappMatchLabel}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "28px",
                          height: "28px",
                          borderRadius: "7px",
                          textDecoration: "none",
                          background: registrationStatus.whatsappMatch === "MATCH"
                            ? "rgba(34, 197, 94, 0.2)"
                            : "rgba(245, 158, 11, 0.18)",
                          border: registrationStatus.whatsappMatch === "MATCH"
                            ? "1.5px solid #22c55e"
                            : "1.5px solid #f59e0b",
                          color: registrationStatus.whatsappMatch === "MATCH"
                            ? "#4ade80"
                            : "#fbbf24",
                          boxShadow: registrationStatus.whatsappMatch === "MATCH"
                            ? "0 0 12px rgba(34, 197, 94, 0.8), 0 0 22px rgba(34, 197, 94, 0.35), inset 0 0 8px rgba(34, 197, 94, 0.3)"
                            : "0 0 12px rgba(245, 158, 11, 0.7), inset 0 0 6px rgba(245, 158, 11, 0.25)",
                          opacity: 1,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <PhoneCall size={14} strokeWidth={2.5} />
                      </a>
                    ) : (
                      <span
                        className={cx("crm-status-icon-chip", registrationStatus.whatsappMatch === "MATCH" ? "is-on" : "is-warn")}
                        title={`Phone Match: ${whatsappMatchLabel}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "26px",
                          height: "26px",
                          borderRadius: "7px",
                          background: registrationStatus.whatsappMatch === "MATCH"
                            ? "rgba(34, 197, 94, 0.2)"
                            : "rgba(245, 158, 11, 0.18)",
                          border: registrationStatus.whatsappMatch === "MATCH"
                            ? "1.5px solid #22c55e"
                            : "1.5px solid #f59e0b",
                          color: registrationStatus.whatsappMatch === "MATCH"
                            ? "#4ade80"
                            : "#fbbf24",
                          boxShadow: registrationStatus.whatsappMatch === "MATCH"
                            ? "0 0 12px rgba(34, 197, 94, 0.8), 0 0 22px rgba(34, 197, 94, 0.35), inset 0 0 8px rgba(34, 197, 94, 0.3)"
                            : "0 0 12px rgba(245, 158, 11, 0.7), inset 0 0 6px rgba(245, 158, 11, 0.25)",
                          opacity: 1,
                          cursor: "help",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <PhoneCall size={13} strokeWidth={2.5} />
                      </span>
                    )}

                    {/* Dynamic CRM Lead Stage & Status Badge */}
                    {activeConversation.leadStatusLabel ? (
                      <span
                        className="crm-live-status-pill lead-stage"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: "999px",
                          background: "rgba(255, 107, 47, 0.16)",
                          border: "1px solid rgba(255, 107, 47, 0.5)",
                          color: "#ff6b2f",
                          boxShadow: "0 0 10px rgba(255, 107, 47, 0.3)",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ff6b2f", boxShadow: "0 0 6px #ff6b2f" }} />
                        <span>Stage: {activeConversation.leadStatusLabel}</span>
                      </span>
                    ) : (
                      <span
                        className="crm-live-status-pill lead"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: "999px",
                          background: "rgba(34, 197, 94, 0.16)",
                          border: "1px solid rgba(34, 197, 94, 0.5)",
                          color: "#4ade80",
                          boxShadow: "0 0 10px rgba(34, 197, 94, 0.3)",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                        <span>Active Lead</span>
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
              </div>
            </div>

            <div className={cx("chat-header-actions-cluster", isHeaderActionsOpen && "is-open")}>
              <button
                aria-expanded={isHeaderActionsOpen}
                aria-label={isHeaderActionsOpen ? "Hide conversation actions" : "Show conversation actions"}
                className="chat-header-actions-toggle"
                onClick={() => setIsHeaderActionsOpen((current) => !current)}
                title={isHeaderActionsOpen ? "Hide conversation actions" : "Show conversation actions"}
                type="button"
              >
                <CircleEllipsis size={17} strokeWidth={1.8} />
                <span>Actions</span>
              </button>

              <div className="chat-thread-head-toolbar crm-chat-head-actions chat-focused-actions">
              {(audience === "admin" || audience === "manager" || audience === "sales") ? (
                <>
                  <div className="chat-thread-head-action-group chat-status-notes-actions">
                    <div className="chat-notes-action-group">
                      <button
                        type="button"
                        aria-label="Open private notes"
                        className={isNotesMenuOpen && notesPopoverMode === "notes" ? "chat-status-pill chat-notes-action active" : "chat-status-pill chat-notes-action"}
                        onClick={() => {
                          setNotesPopoverMode("notes");
                          setIsNotesMenuOpen((current) => notesPopoverMode === "notes" ? !current : true);
                          setIsLeadStatusMenuOpen(false);
                          setIsAssignMenuOpen(false);
                          setIsDetailsOpen(false);
                        }}
                        title="Open private notes"
                      >
                        <StickyNote size={18} strokeWidth={2.1} />
                      </button>
                      <button
                        type="button"
                        aria-label="Schedule follow-up"
                        className={isNotesMenuOpen && notesPopoverMode === "callback" ? "chat-status-pill chat-callback-action active" : "chat-status-pill chat-callback-action"}
                        onClick={() => {
                          setNotesPopoverMode("callback");
                          setIsNotesMenuOpen((current) => notesPopoverMode === "callback" ? !current : true);
                          setIsLeadStatusMenuOpen(false);
                          setIsAssignMenuOpen(false);
                          setIsDetailsOpen(false);
                        }}
                        title="Schedule follow-up"
                      >
                        <CalendarClock size={18} strokeWidth={2.1} />
                      </button>
                      {renderNotesPopover()}
                    </div>

                    <label className="chat-status-control" title="Update lead status">
                      <span>Status</span>
                      <select
                        aria-label="Update lead status"
                        className="chat-status-select"
                        onChange={(event) => handleLeadStatusChange(event.target.value).catch(() => undefined)}
                        value={activeConversation.leadStatusId || ""}
                        disabled={isSupportDataLoading || !leadStatuses.length}
                      >
                        {!leadStatuses.length ? <option value="">No live stages available</option> : null}
                        {leadStatuses.map((status) => (
                          <option key={status.id} value={status.id}>{status.label}</option>
                        ))}
                      </select>
                    </label>

      {/* WhatsApp-Style Create Custom Label Modal */}
      {isCreateLabelModalOpen ? (
        <div
          className="chat-label-modal-backdrop"
          onClick={() => setIsCreateLabelModalOpen(false)}
        >
          <div
            className="chat-label-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Tag size={18} color="var(--closer-orange, #ff6b2f)" />
                <strong style={{ fontSize: "1.05rem", fontWeight: 700 }}>New Label (WhatsApp style)</strong>
              </div>
              <button
                type="button"
                className="chat-head-icon"
                onClick={() => setIsCreateLabelModalOpen(false)}
                style={{ width: 28, height: 28 }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "0 0 14px" }}>
              Create a custom label to categorize interested leads, track agency owners, or filter conversations.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Label Name
              </label>
              <input
                autoFocus
                type="text"
                value={newStatusLabel}
                onChange={(e) => setNewStatusLabel(e.target.value)}
                placeholder="e.g. Hot Lead, Demo Booked, Agency 10+"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "#f8fafc",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newStatusLabel.trim()) {
                    e.preventDefault();
                    void handleLeadStatusCrud("create", {
                      label: newStatusLabel.trim(),
                      tone: customLabelSelectedColor.tone,
                      active: true,
                    });
                    setIsCreateLabelModalOpen(false);
                  }
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>
                Choose Label Color
              </label>
              <div className="chat-label-color-grid">
                {WHATSAPP_LABEL_COLORS.map((c) => {
                  const isSelected = customLabelSelectedColor.name === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      className={`chat-label-color-option ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        setCustomLabelSelectedColor(c);
                        setNewStatusTone(c.tone);
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: c.hex,
                          boxShadow: isSelected ? `0 0 10px ${c.hex}` : "none",
                          border: isSelected ? "2px solid #fff" : "none",
                        }}
                      />
                      <span style={{ fontSize: "0.68rem", color: isSelected ? "#fff" : "#94a3b8" }}>
                        {c.name.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Preview */}
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", marginBottom: 18 }}>
              <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginBottom: 4 }}>Live Preview:</span>
              <span
                className="chat-thread-top-label-badge"
                style={{
                  background: customLabelSelectedColor.bg,
                  borderColor: customLabelSelectedColor.border,
                  color: customLabelSelectedColor.hex,
                  boxShadow: `0 0 8px ${customLabelSelectedColor.border}`,
                }}
              >
                <span
                  className="chat-thread-top-label-dot"
                  style={{ backgroundColor: customLabelSelectedColor.hex, boxShadow: `0 0 6px ${customLabelSelectedColor.hex}` }}
                />
                <span>{newStatusLabel.trim() || "Label Name Preview"}</span>
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="ui-button-secondary"
                onClick={() => setIsCreateLabelModalOpen(false)}
                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ui-button-primary"
                disabled={!newStatusLabel.trim()}
                onClick={() => {
                  if (!newStatusLabel.trim()) return;
                  void handleLeadStatusCrud("create", {
                    label: newStatusLabel.trim(),
                    tone: customLabelSelectedColor.tone,
                    active: true,
                  });
                  setIsCreateLabelModalOpen(false);
                }}
                style={{ padding: "6px 18px", fontSize: "0.82rem", background: "#ff6b2f", color: "#fff", fontWeight: 700 }}
              >
                Create Label
              </button>
            </div>
          </div>
        </div>
      ) : null}

                    </div>

                  <div className="chat-thread-head-action-group chat-automation-actions">
                    <button
                      type="button"
                      className={activeConversation.aiAutoReplyDisabled ? "chat-ai-toggle chat-ai-toggle-paused" : "chat-ai-toggle chat-ai-toggle-active"}
                      onClick={() => handleToggleAiAutoReply(!activeConversation.aiAutoReplyDisabled)}
                      disabled={isAiToggleSaving}
                      title={
                        activeConversation.aiAutoReplyDisabled
                          ? "Human Mode (AI Paused). Click to turn AI Auto-Reply ON."
                          : "AI Auto-Reply is ON. Click to pause AI and switch to Human Mode."
                      }
                      aria-label={
                        activeConversation.aiAutoReplyDisabled
                          ? "Human Mode (AI Paused). Click to turn AI Auto-Reply ON."
                          : "AI Auto-Reply is ON. Click to pause AI and switch to Human Mode."
                      }
                    >
                      <span className={activeConversation.aiAutoReplyDisabled ? "chat-ai-toggle-dot paused" : "chat-ai-toggle-dot active"} />
                      <span className="chat-ai-toggle-text">
                        {isAiToggleSaving
                          ? "Saving..."
                          : activeConversation.aiAutoReplyDisabled
                          ? "Human Mode"
                          : "AI Active"}
                      </span>
                    </button>

                    {dripState ? (
                      <button
                        type="button"
                        className={cx(
                          "chat-status-pill",
                          dripState.completed
                            ? "tone-success"
                            : dripState.paused
                            ? "tone-neutral"
                            : "tone-accent"
                        )}
                        onClick={() => handleToggleDrip(!dripState.paused)}
                        disabled={isDripSaving || dripState.completed}
                        title={
                          dripState.completed
                            ? "Automated follow-up drip: All 4 stages finished"
                            : dripState.paused
                            ? `Drip PAUSED (${dripState.audienceCategory.replace(/_/g, " ")}). Click to resume automated follow-up sequences.`
                            : `Drip ACTIVE (${dripState.audienceCategory.replace(/_/g, " ")}). Stage ${dripState.currentStage}/4. Click to pause.`
                        }
                        aria-label="Toggle WhatsApp Lead Drip"
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          {dripState.completed ? <CheckCircle2 size={11} /> : dripState.paused ? <Pause size={11} /> : <Clock size={11} />}
                        </span>
                        <span>
                          {isDripSaving
                            ? "Updating..."
                            : dripState.completed
                            ? "Drip Done"
                            : dripState.paused
                            ? "Drip Paused"
                            : `Drip: Stage ${dripState.currentStage}/4`}
                        </span>
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}

              <div className="chat-thread-head-action-group chat-lane-actions">
                {normalizedVisibleLanes.map((lane) => {
                  const laneLabel = lane === "customer" ? "Client lane" : (audience as string) === "sales" ? "Sales team" : audience === "freelancer" ? "Agency lane" : "Freelancer lane";
                  return (
                    <button
                      aria-label={laneLabel}
                      className={resolvedLane === lane ? "chat-head-icon active" : "chat-head-icon"}
                      data-tooltip={laneLabel}
                      key={lane}
                      onClick={() => setActiveLane(lane)}
                      title={laneLabel}
                      type="button"
                    >
                      {lane === "customer" ? <MessageSquareText size={16} strokeWidth={1.8} /> : <ShieldCheck size={16} strokeWidth={1.8} />}
                    </button>
                  );
                })}
              </div>

              {(audience === "admin" || audience === "manager" || audience === "sales") ? (
                <div className="chat-thread-head-action-group chat-assignment-actions">
                  <div className="chat-control-inline">
                    <button
                      aria-label={`Assign conversation: ${activeAssignment?.assignedFreelancerName ?? "Unassigned"}`}
                      className={isAssignMenuOpen ? "chat-head-icon active" : "chat-head-icon"}
                      onClick={() => {
                        setIsAssignMenuOpen((current) => !current);
                        setIsLeadStatusMenuOpen(false);
                        setIsNotesMenuOpen(false);
                        setIsDetailsOpen(false);
                      }}
                      title={`Assign conversation: ${activeAssignment?.assignedFreelancerName ?? "Unassigned"}`}
                      type="button"
                    >
                      <UserRound size={16} strokeWidth={1.8} />
                      <span className="chat-assignment-label">{activeAssignment?.assignedFreelancerName ?? "Assign"}</span>
                    </button>
                    {renderAssignPopover()}
                  </div>
                </div>
              ) : null}

              <div className="chat-thread-head-action-group chat-legacy-actions">
                <button
                  aria-label="CRM details"
                  className={isDetailsOpen ? "chat-head-icon active" : "chat-head-icon"}
                  data-tooltip="CRM details"
                  onClick={() => setIsDetailsOpen((current) => !current)}
                  title="CRM details"
                  type="button"
                >
                  <StickyNote size={18} strokeWidth={1.8} />
                </button>
                {(audience === "sales" || audience === "admin") ? (
                  <button
                    aria-label="Delete conversation"
                    className="chat-head-icon"
                    data-tooltip="Delete lead & conversation"
                    disabled={isDeletingConversation}
                    onClick={() => void handleDeleteActiveConversation()}
                    style={{ color: "#f87171" }}
                    title="Delete lead & conversation from Closer Desk"
                    type="button"
                  >
                    <Trash2 size={16} strokeWidth={1.8} />
                  </button>
                ) : null}
              </div>
              </div>
            </div>
          </header>

          <div className={styles.stageBody}>
            <div className={styles.messageViewportFrame}>
            <div className={cx("chat-message-scroll", styles.messageViewport)} ref={messageScrollRef}>
              <section className="chat-message-group">
              {audience !== "sales" && resolvedLane !== "customer" ? (
                <div className="chat-day-divider">
                  <span>{audience === "freelancer" ? "Agency lane" : "Freelancer coordination"}</span>
                </div>
              ) : null}
              {isHydratingActiveConversation ? (
                <div
                  className="chat-empty-thread-hint"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "48px 20px",
                    textAlign: "center",
                    color: "var(--color-text-muted, #64748b)",
                  }}
                >
                  <strong style={{ fontSize: "14px", color: "var(--color-text, #0f172a)", marginBottom: "4px" }}>
                    Loading chat history…
                  </strong>
                  <p style={{ fontSize: "12px", maxWidth: "340px", margin: 0, lineHeight: 1.5 }}>
                    Fetching the latest messages and attachments.
                  </p>
                </div>
              ) : laneMessages.length === 0 ? (
                <div
                  className="chat-empty-thread-hint"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "48px 20px",
                    textAlign: "center",
                    color: "var(--color-text-muted, #64748b)",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "rgba(16, 185, 129, 0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "12px",
                      color: "#10b981",
                    }}
                  >
                    <MessageSquare size={22} />
                  </div>
                  <strong style={{ fontSize: "14px", color: "var(--color-text, #0f172a)", marginBottom: "4px" }}>
                    No recent WhatsApp chats
                  </strong>
                  <p style={{ fontSize: "12px", maxWidth: "340px", margin: 0, lineHeight: 1.5 }}>
                    This lead was imported without previous chat history. Start a new conversation by sending a template or message below.
                  </p>
                </div>
              ) : (
                laneMessages.map((message, messageIndex) => {
                const isIncoming = isConversationMessageIncomingForAudience(message, audience);
                const body = visibleBody(message).trim();
                const showAvatar = resolvedLane === "internal";
                const senderIdentity = messageSenderIdentity(message, audience);
                const deliveryStatus = getOutgoingDeliveryStatus(message, audience, activeConversation);
                const deliveryError =
                  deliveryStatus === "failed" && typeof message.deliveryError === "string" ? message.deliveryError.trim() : "";
                const previousMessage = messageIndex > 0 ? laneMessages[messageIndex - 1] : null;
                const startsNewDate =
                  !previousMessage || getConversationDateKey(previousMessage.createdAt) !== getConversationDateKey(message.createdAt);
                return (
                  <Fragment key={message.id}>
                  {startsNewDate ? (
                    <div className="chat-day-divider chat-conversation-date-divider" role="separator">
                      <span>{formatConversationDateLabel(message.createdAt)}</span>
                    </div>
                  ) : null}
                  <article className={isIncoming ? "chat-bubble-row incoming" : "chat-bubble-row outgoing"}>
                    {isIncoming && showAvatar ? (
                      <ChatAvatar
                        className="chat-bubble-avatar"
                        imageUrl={message.senderRole === "customer" ? activeConversation.customerProfileImageUrl : undefined}
                        name={messageLabel(message, audience)}
                      />
                    ) : null}
                    <div className="chat-bubble">
                      <p className="message-role" aria-label={`Sent by ${senderIdentity.primary}${senderIdentity.secondary ? `, ${senderIdentity.secondary}` : ""}`}>
                        <span className="message-role-name">{senderIdentity.primary}</span>
                        {senderIdentity.secondary ? <span className="message-role-context">{senderIdentity.secondary}</span> : null}
                      </p>
                      {body ? <p>{body}</p> : null}
                      {message.attachments?.length ? (
                        <div className="chat-attachment-list">
                          {message.attachments.map((attachment) => {
                            const linkedPayment =
                              attachment.kind === "payment-request" && latestPaymentRequest?.id === attachment.paymentRequestId ? latestPaymentRequest : null;
                            const isVoiceNote = attachment.kind === "voice-note";
                            const isImageAttachment = attachment.kind === "image";
                            const isMinimalAttachment = isVoiceNote || isImageAttachment;
                            const hasInlinePreview = attachmentHasInlinePreview(attachment);
                            const attachmentSubtitle = isVoiceNote ? attachment.durationLabel ?? "Voice note" : describeAttachment(attachment);
                            return (
                              <div
                                className={
                                  isVoiceNote
                                    ? "chat-attachment-card voice-note media-clean"
                                    : linkedPayment
                                      ? "chat-attachment-card payment-request-card"
                                      : isImageAttachment
                                        ? "chat-attachment-card media-clean"
                                      : hasInlinePreview
                                        ? "chat-attachment-card has-preview"
                                        : "chat-attachment-card"
                                }
                                key={attachment.id}
                              >
                                {linkedPayment ? (
                                  <div className="chat-payment-layout">
                                    <div className="chat-payment-link-card">
                                      <p className="chat-payment-qr-label">PhonePe checkout</p>
                                      <strong>{formatCurrency(linkedPayment.amount)}</strong>
                                      <span>Secure payment link</span>
                                      {linkedPayment.paymentLink ? (
                                        <a className="chat-bubble-cta chat-payment-link-button" href={linkedPayment.paymentLink} rel="noreferrer" target="_blank">
                                          Pay with PhonePe
                                        </a>
                                      ) : (
                                        <>
                                          <p className="chat-payment-qr-upi">Legacy UPI ID: {linkedPayment.upiId}</p>
                                          <button className="ui-button-secondary chat-payment-qr-copy" onClick={() => copyPaymentUpiId(linkedPayment.upiId)} type="button">
                                            Copy UPI ID
                                          </button>
                                        </>
                                      )}
                                    </div>
                                    <div className="chat-payment-brand-strip">GIGXOMI SECURE PAYMENT</div>
                                    <div className="chat-attachment-body chat-payment-message">
                                      <strong>{linkedPayment.title || "Payment request"}</strong>
                                      <span>{formatCurrency(linkedPayment.amount)} - {linkedPayment.status}</span>
                                      <p>Payer: {linkedPayment.payerRole} - Payee: {linkedPayment.payeeRole}</p>
                                      <p>Method: {linkedPayment.paymentLink ? "PhonePe checkout" : `Legacy UPI ${linkedPayment.upiId}`}</p>
                                      {linkedPayment && audience !== "customer" && !(linkedPayment.lane === "customer" && linkedPayment.payeeRole === "agency") ? (
                                        <p>{linkedPayment.split.platformPercentage}% platform - {linkedPayment.split.editorPercentage}% editor</p>
                                      ) : null}
                                      {linkedPayment.paymentProvider ? <p>Gateway: {formatPaymentGatewayLabel(linkedPayment.paymentProvider)}</p> : null}
                                    </div>
                                  </div>
                                ) : isMinimalAttachment ? null : (
                                  <div className="chat-attachment-body">
                                    <strong>{displayAttachmentName(attachment)}</strong>
                                    <span>{attachmentSubtitle}</span>
                                    {attachment.note && !linkedPayment && !isSyntheticInboundAttachmentNote(attachment.note) ? <p>{normalizeDisplayText(attachment.note)}</p> : null}
                                  </div>
                                )}
                                <AttachmentPreview attachment={attachment} />
                                {attachment.externalUrl && !isMinimalAttachment ? (
                                  <a className="chat-attachment-link" href={getAttachmentUrl(attachment.externalUrl)} rel="noreferrer" target="_blank">
                                    {attachment.mimeType === "application/pdf" ? "Open PDF" : attachment.kind === "file" ? "Open file" : "Open"}
                                  </a>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {deliveryError ? <p className="chat-message-error">{deliveryError}</p> : null}
                      <div className="chat-bubble-meta">
                        <small>{formatTimestamp(message.createdAt)}</small>
                        {deliveryStatus ? (
                          <span
                            aria-label={getDeliveryStatusLabel(deliveryStatus)}
                            className={`chat-message-status ${deliveryStatus}`}
                            title={getDeliveryStatusLabel(deliveryStatus)}
                          >
                            {deliveryStatus === "failed" ? <CircleOff size={15} strokeWidth={2.1} /> : <CheckCheck size={15} strokeWidth={2.1} />}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {!isIncoming && showAvatar ? <ChatAvatar className="chat-bubble-avatar outgoing" name={messageLabel(message, audience)} /> : null}
                  </article>
                  </Fragment>
                );
              }))}
                <div aria-hidden="true" className="chat-message-end-anchor" ref={messageEndRef} />
              </section>
            </div>
            </div>

            <div className={cx("chat-composer-shell", styles.composerDock)}>
            <input
              className="sr-only"
              accept={`${CHAT_MEDIA_ACCEPT},${CHAT_DOCUMENT_ACCEPT}`}
              onChange={(event) => {
                handlePickedFiles("local", event.target.files).catch(() => undefined);
                event.currentTarget.value = "";
              }}
              ref={localFileInputRef}
              type="file"
              multiple
            />
            <input
              className="sr-only"
              accept={CHAT_MEDIA_ACCEPT}
              onChange={(event) => {
                handlePickedFiles("local", event.target.files).catch(() => undefined);
                event.currentTarget.value = "";
              }}
              ref={mediaFileInputRef}
              type="file"
              multiple
            />
            <input
              className="sr-only"
              accept={CHAT_DOCUMENT_ACCEPT}
              onChange={(event) => {
                handlePickedFiles("local", event.target.files).catch(() => undefined);
                event.currentTarget.value = "";
              }}
              ref={documentFileInputRef}
              type="file"
              multiple
            />

            {isAttachMenuOpen && !isFreelancerCustomerLane ? (
              <div className="chat-attach-menu">
                <button className="chat-attach-option" onClick={() => { setIsAttachMenuOpen(false); mediaFileInputRef.current?.click(); }} type="button">
                  <Paperclip size={15} strokeWidth={1.8} />
                  <span>Image or video (max 20 MB)</span>
                </button>
                <button className="chat-attach-option" onClick={() => { setIsAttachMenuOpen(false); documentFileInputRef.current?.click(); }} type="button">
                  <FileText size={15} strokeWidth={1.8} />
                  <span>Document (max 20 MB)</span>
                </button>
                <button className="chat-attach-option" onClick={() => { setIsAttachMenuOpen(false); localFileInputRef.current?.click(); }} type="button">
                  <Paperclip size={15} strokeWidth={1.8} />
                  <span>Browse files</span>
                </button>
                {showPaymentAction ? (
                  <button className="chat-attach-option" onClick={() => { setIsPaymentModalOpen(true); setIsAttachMenuOpen(false); }} type="button">
                    <BadgeIndianRupee size={15} strokeWidth={1.8} />
                    <span>{paymentActionLabel}</span>
                  </button>
                ) : null}
                {showReviewFlowAction ? (
                  <button className="chat-attach-option" onClick={() => { setIsAttachMenuOpen(false); handleSendReviewFlow().catch(() => undefined); }} type="button">
                    <Star size={15} strokeWidth={1.8} />
                    <span>Send review form</span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {isEmojiTrayOpen && !isFreelancerCustomerLaneReadOnly ? (
              <div className="chat-emoji-tray">
                <EmojiPicker
                  autoFocusSearch={false}
                  emojiStyle={EmojiStyle.NATIVE}
                  height={360}
                  lazyLoadEmojis
                  onEmojiClick={handleEmojiClick}
                  previewConfig={{ showPreview: false }}
                  searchDisabled={false}
                  skinTonesDisabled
                  theme={EmojiPickerTheme.DARK}
                  width="100%"
                />
              </div>
            ) : null}

              {isRecording ? <p className="chat-composer-status">Recording voice note... {recordingSeconds}s</p> : null}
              {!isMessageSending && composerStatus ? <p className="chat-composer-status">{composerStatus}</p> : null}
              <div className="chat-instant-reply-bar">
                <button
                  className="chat-instant-reply-button"
                  disabled={isFreelancerCustomerLaneReadOnly}
                  onClick={() => {
                    setMessageDraft("Thanks for your message. We’ve received it and will get back to you shortly.");
                    composerTextareaRef.current?.focus();
                  }}
                  type="button"
                >
                  <Zap size={13} strokeWidth={1.9} /> Instant Reply
                </button>
                <span>Fills the composer; review before sending.</span>
              </div>
              {resolvedLane === "customer" && (hasCompanyWhatsAppRoute || hasConnectedWhatsAppRoute) ? (
                <div className="chat-whatsapp-transport-row">
                  <span>Send via</span>
                  <select
                    aria-label="Choose WhatsApp sender"
                    onChange={(event) => setWhatsappTransport(event.target.value as "company" | "connected_user")}
                    value={whatsappTransport}
                  >
                    {hasCompanyWhatsAppRoute ? <option value="company">🏢 WhatsApp API (Cloud API)</option> : null}
                    {hasConnectedWhatsAppRoute ? (
                      <option value="connected_user">
                        📱 WhatsApp Personal ({activeConversation.whatsappRoutes?.connectedUserLabel || "Synced Device"})
                      </option>
                    ) : null}
                  </select>
                </div>
              ) : null}
              <div className={hasDraft ? "chat-composer-bar has-draft" : "chat-composer-bar"}>
              <button
                aria-label="Open attachment options"
                className="chat-composer-icon"
                onClick={() => {
                  if (isFreelancerCustomerLane) {
                    setComposerStatus("Attachments are available in internal lane only on this thread.");
                    return;
                  }
                  setIsAttachMenuOpen((current) => !current);
                  setIsEmojiTrayOpen(false);
                }}
                type="button"
              >
                <Plus size={18} strokeWidth={1.8} />
              </button>
              <button
                aria-label="Open emoji picker"
                className="chat-composer-icon"
                onClick={() => {
                  if (isFreelancerCustomerLaneReadOnly) {
                    setComposerStatus(activeLaneReadOnlyReason);
                    return;
                  }
                  setIsEmojiTrayOpen((current) => !current);
                  setIsAttachMenuOpen(false);
                }}
                type="button"
              >
                <Smile size={18} strokeWidth={1.8} />
              </button>
              <textarea
                onChange={(event) => setMessageDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !isMessageSending) {
                    event.preventDefault();
                    handleSendMessage().catch(() => undefined);
                  }
                }}
                disabled={isFreelancerCustomerLaneReadOnly}
                placeholder={
                  isFreelancerCustomerLaneReadOnly
                    ? activeLaneReadOnlyReason
                    : isFreelancerCustomerLane
                      ? "Reply to the customer in the routed shared customer lane"
                    : resolvedLane === "internal"
                        ? audience === "sales"
                          ? "Share this chat internally with the sales team"
                          : "Talk internally with manager/admin/editor here"
                        : "Reply to the customer in the routed shared thread"
                }
                ref={composerTextareaRef}
                rows={1}
                value={messageDraft}
              />
              {isRecording ? (
                <button className="chat-composer-send chat-composer-recording" disabled={isFreelancerCustomerLane || isConvertingVoice} onClick={() => handleVoiceNoteToggle().catch(() => undefined)} type="button">
                  <Square size={15} strokeWidth={1.8} />
                </button>
              ) : (
                <button
                  aria-label={hasDraft ? "Send message" : "Record voice note"}
                  className={!hasDraft ? "chat-composer-send chat-composer-send-idle" : "chat-composer-send"}
                  disabled={!hasDraft ? isFreelancerCustomerLane || isConvertingVoice || isMessageSending : isFreelancerCustomerLaneReadOnly || isMessageSending}
                  onClick={() => {
                    if (!hasDraft) {
                      handleVoiceNoteToggle().catch(() => undefined);
                      return;
                    }
                    handleSendMessage().catch(() => undefined);
                  }}
                  type="button"
                >
                  {!hasDraft ? <Mic size={18} strokeWidth={1.8} /> : <ArrowUp size={16} strokeWidth={1.8} />}
                </button>
              )}
            </div>
            </div>
          </div>

          </section>

          {isDetailsOpen ? (
            <ChatDetailsSheet desktop={!isCompactChatLayout} eyebrow="Customer Details" onClose={() => setIsDetailsOpen(false)} title={activeCustomerName}>
              <div className={styles.detailsGrid}>
                {/* 1. Lead stage */}
                <div
                  className="chat-context-card"
                  style={{
                    gridColumn: "1 / -1",
                    background: "var(--crm-surface-soft, rgba(148, 163, 184, 0.08))",
                    border: "1px solid var(--crm-border, rgba(148, 163, 184, 0.28))",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--crm-text-muted, #64748b)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Sparkles size={11} /> Lead Stage
                    </span>
                    <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", fontWeight: 700 }}>
                      ● Synced
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={activeConversation.leadStatusId || ""}
                      disabled={isSupportDataLoading || leadStatuses.length === 0}
                      onChange={(e) => handleLeadStatusChange(e.target.value).catch(() => undefined)}
                      style={{
                        flex: 1,
                        minWidth: "160px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "var(--crm-surface, #fff)",
                        border: "1px solid var(--crm-border, rgba(148, 163, 184, 0.3))",
                        color: "var(--crm-text, #0f172a)",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: leadStatuses.length ? "pointer" : "not-allowed",
                      }}
                    >
                      {!leadStatuses.length ? (
                        <option value="">
                          {isSupportDataLoading ? "Loading workspace stages…" : "No workspace stages configured"}
                        </option>
                      ) : leadStatuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    {activeCustomerPhone && activeConversation.sourceChannel === "whatsapp" ? (
                      <span className="chat-internal-channel-note"><MessageSquare size={12} /> Replies stay inside this WhatsApp chat</span>
                    ) : null}
                  </div>
                </div>

                {/* 3. Call Recordings & Phone History */}
                <div
                  className="chat-context-card"
                  style={{
                    gridColumn: "1 / -1",
                    borderRadius: "10px",
                    padding: "14px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <p className="section-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                      <PhoneCall size={14} /> Call Recordings & History ({crmDetails?.calls?.length ?? 0})
                    </p>
                    {isCrmDetailsLoading ? <span style={{ fontSize: "11px", opacity: 0.6 }}>Loading calls...</span> : null}
                  </div>
                  {crmDetails?.calls && crmDetails.calls.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {crmDetails.calls.map((call) => (
                        <div
                          key={call.id}
                          style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "8px",
                            padding: "10px 12px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <strong style={{ fontSize: "12px" }}>
                              {call.outcome ? call.outcome.replace(/_/g, " ") : "Call completed"}
                            </strong>
                            <span style={{ fontSize: "11px", color: "var(--color-primary)", fontWeight: 600 }}>
                              ⏱ {call.durationSeconds}s
                            </span>
                          </div>
                          <small style={{ display: "block", color: "rgba(255, 255, 255, 0.55)", fontSize: "10px", marginBottom: "6px" }}>
                            {call.startedAt && !Number.isNaN(new Date(call.startedAt).getTime()) ? new Date(call.startedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Recent call"}
                          </small>
                          {call.note ? (
                            <p style={{ margin: "0 0 6px", fontSize: "11px", color: "rgba(255, 255, 255, 0.85)", fontStyle: "italic" }}>
                              &ldquo;{call.note}&rdquo;
                            </p>
                          ) : null}
                          {call.recordingUploadId ? (
                            <CentralRecordingAudio callId={call.id} />
                          ) : (
                            <audio
                              controls
                              preload="none"
                              src={`/api/sales/mobile/calls/${call.id}/recording`}
                              style={{ width: "100%", height: "30px", marginTop: "4px" }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: "11px", opacity: 0.6, margin: 0 }}>
                      {isCrmDetailsLoading ? "Checking call activity..." : "No call activity for this phone yet."}
                    </p>
                  )}
                </div>

                {/* 3. Closer Notes & Follow-up Scheduler */}
                <div
                  className="chat-context-card"
                  style={{
                    gridColumn: "1 / -1",
                    borderRadius: "10px",
                    padding: "14px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <p className="section-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                      <StickyNote size={14} /> Closer Notes & Follow-up
                    </p>
                    {activeConversation?.nextFollowUpAt && !Number.isNaN(new Date(activeConversation.nextFollowUpAt).getTime()) ? (
                      <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", background: "rgba(56, 189, 248, 0.2)", color: "#7dd3fc" }}>
                        ⏰ {new Date(activeConversation.nextFollowUpAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ) : null}
                  </div>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Add customer requirements, objections, notes..."
                    rows={3}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      fontSize: "12px",
                      lineHeight: 1.4,
                      resize: "vertical",
                      marginBottom: "8px",
                    }}
                  />
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
                    <input
                      type="datetime-local"
                      value={followUpDraft}
                      onChange={(e) => setFollowUpDraft(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: "170px",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#fff",
                        fontSize: "11px",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveNotes()}
                      disabled={isNotesSaving}
                      className="ui-button-primary"
                      style={{ fontSize: "11px", padding: "6px 12px", height: "auto", cursor: "pointer" }}
                    >
                      {isNotesSaving ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </div>

                {/* 4. Unified lead history */}
                <div
                  className="chat-context-card"
                  style={{
                    gridColumn: "1 / -1",
                    borderRadius: "10px",
                    padding: "14px",
                    background: "var(--color-surface, #ffffff)",
                    border: "1px solid var(--color-border, #dbe3ec)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <p className="section-label" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <History size={14} /> Lead history
                    </p>
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted, #64748b)" }}>{crmDetails?.history?.length ?? 0} events</span>
                  </div>
                  {isCrmDetailsLoading ? (
                    <p className="muted-copy" style={{ margin: 0 }}>Loading lead history...</p>
                  ) : crmDetails?.history && crmDetails.history.length > 0 ? (
                    <div style={{ maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
                      {crmDetails.history.map((item) => {
                        const eventDate = item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())
                          ? new Date(item.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "";
                        return (
                          <div key={item.id} style={{ display: "grid", gridTemplateColumns: "10px 1fr", gap: "9px", padding: "9px 0", borderBottom: "1px solid var(--color-border, #edf1f5)" }}>
                            <span style={{ width: "8px", height: "8px", marginTop: "4px", borderRadius: "999px", background: "var(--color-primary, #ff6b2f)" }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", color: "var(--color-text-secondary, #475569)", fontSize: "10px" }}>
                                <strong style={{ color: "var(--color-text-primary, #0f172a)", fontSize: "11px" }}>{item.title}</strong>
                                <span style={{ whiteSpace: "nowrap" }}>{eventDate}</span>
                              </div>
                              {item.body ? <p style={{ margin: "3px 0 0", color: "var(--color-text-secondary, #475569)", fontSize: "11px", lineHeight: 1.4 }}>{item.body}</p> : null}
                              {item.actorName ? <span style={{ display: "block", marginTop: "3px", color: "var(--color-text-muted, #64748b)", fontSize: "10px" }}>By {item.actorName}</span> : null}
                              {item.dueAt && !Number.isNaN(new Date(item.dueAt).getTime()) ? <span style={{ display: "block", marginTop: "3px", color: "var(--color-primary, #ff6b2f)", fontSize: "10px" }}>Due {new Date(item.dueAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted-copy" style={{ margin: 0 }}>No history has been recorded for this lead yet.</p>
                  )}
                </div>

              </div>
            </ChatDetailsSheet>
          ) : null}
        </> : !isCompactChatLayout ? (
          <section className={styles.stage}>
            <ChatStageEmptyState
              copy="Choose a thread from the inbox to open it. New messages will keep syncing here without auto-opening the first chat."
              title="Select a conversation"
            />
          </section>
        ) : null}
      </div>

      {isClientAliasModalOpen ? (
        <div className="chat-modal-backdrop">
          <div className="chat-modal">
            <div className="chat-modal-head">
              <div>
                <h3>Client alias</h3>
                <p className="muted-copy">Rename the masked client label for your freelancer inbox without exposing or changing the agency customer record.</p>
              </div>
              <button className="chat-head-icon" onClick={() => setIsClientAliasModalOpen(false)} type="button"><X size={16} /></button>
            </div>
            <div className="chat-modal-grid">
              <label className="chat-control-field chat-control-field-full">
                <span>Alias</span>
                <input maxLength={80} onChange={(event) => setClientAliasValue(event.target.value)} value={clientAliasValue} />
              </label>
              <div className="chat-context-card">
                <p className="section-label">Privacy</p>
                <p>The real customer name and contact remain hidden from freelancer mode. Use a project-safe label such as Finance coach edits.</p>
              </div>
            </div>
            <div className="chat-inline-actions">
              <button className="ui-button-ghost" onClick={() => setIsClientAliasModalOpen(false)} type="button">Cancel</button>
              <button className="ui-button-primary" onClick={() => handleClientAliasSubmit().catch(() => undefined)} type="button">Save alias</button>
            </div>
          </div>
        </div>
      ) : null}

      {isNewChatOpen ? (
        <div className="chat-modal-backdrop">
          <div className="chat-modal">
            <div className="chat-modal-head">
              <div>
                <h3>New chat from template</h3>
                <p className="muted-copy">Create a CRM thread and optionally send a starting template immediately.</p>
              </div>
              <button className="chat-head-icon" onClick={() => setIsNewChatOpen(false)} type="button"><X size={16} /></button>
            </div>
            <div className="chat-modal-grid">
              <label className="chat-control-field"><span>Customer name</span><input value={newChatCustomerName} onChange={(event) => setNewChatCustomerName(event.target.value)} /></label>
              <label className="chat-control-field"><span>Phone</span><input value={newChatCustomerPhone} onChange={(event) => setNewChatCustomerPhone(event.target.value)} /></label>
              <label className="chat-control-field"><span>Linked service</span><select value={newChatServiceId} onChange={(event) => setNewChatServiceId(event.target.value)}><option value="">No linked service</option>{serviceOptions.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select></label>
              <label className="chat-control-field"><span>Template</span><select value={newChatTemplateId} onChange={(event) => setNewChatTemplateId(event.target.value)}><option value="">Start blank</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select></label>
            </div>
            <div className="chat-inline-actions">
              <button className="ui-button-ghost" onClick={() => setIsNewChatOpen(false)} type="button">Cancel</button>
              <button className="ui-button-primary" onClick={() => handleNewChatSubmit().catch(() => undefined)} type="button">Create chat</button>
            </div>
          </div>
        </div>
      ) : null}

      {isPaymentModalOpen ? (
        <div className="chat-modal-backdrop">
          <div className="chat-modal">
            <div className="chat-modal-head">
              <div>
                <h3>{canRequestPaymentInternal ? "Request payment" : "Send payment request"}</h3>
                <p className="muted-copy">
                  {canRequestPaymentInternal
                    ? "Generate an internal PhonePe payment link for agency payment to freelancer."
                    : "Create a PhonePe checkout link and push it into the customer lane."}
                </p>
              </div>
              <button className="chat-head-icon" onClick={() => setIsPaymentModalOpen(false)} type="button"><X size={16} /></button>
            </div>
            <div className="chat-modal-grid">
              <label className="chat-control-field"><span>Amount</span><input min="0" onChange={(event) => setPaymentAmount(event.target.value)} type="number" value={paymentAmount} /></label>
              <label className="chat-control-field"><span>Title / purpose</span><input onChange={(event) => setPaymentTitle(event.target.value)} value={paymentTitle} /></label>
              <label className="chat-control-field"><span>Linked project</span><input onChange={(event) => setPaymentProjectTitle(event.target.value)} value={paymentProjectTitle} /></label>
              <label className="chat-control-field chat-control-field-full"><span>Note</span><textarea onChange={(event) => setPaymentNote(event.target.value)} rows={3} value={paymentNote} /></label>
              <label className="chat-control-field"><span>Due label</span><input onChange={(event) => setPaymentDueLabel(event.target.value)} placeholder="Today, 6 PM" value={paymentDueLabel} /></label>
              <div className="chat-context-card">
                <p className="section-label">Split preview</p>
                <strong>{paymentSplitPreview.planLabel}</strong>
                {canManagePayments && resolvedLane === "customer" ? (
                  <p>Agency receives full amount: {formatCurrency(Number(paymentAmount || 0))}</p>
                ) : (
                  <>
                    <p>Editor {paymentSplitPreview.editorPercentage}% • Platform {paymentSplitPreview.platformPercentage}%</p>
                    <p>Editor {formatCurrency(paymentSplitPreview.editorShare)} • Platform {formatCurrency(paymentSplitPreview.platformShare)}</p>
                  </>
                )}
                {audience === "freelancer" ? <p>Agency pays via PhonePe; payout split is tracked after confirmation.</p> : <p>PhonePe checkout link will be created.</p>}
              </div>
            </div>
            <div className="chat-inline-actions">
              <button className="ui-button-ghost" onClick={() => setIsPaymentModalOpen(false)} type="button">Cancel</button>
              <button className="ui-button-primary" onClick={() => handlePaymentRequestSubmit().catch(() => undefined)} type="button">
                {canRequestPaymentInternal ? "Request payment" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isMicHelpOpen ? (
        <div className="chat-modal-backdrop">
          <div className="chat-modal">
            <div className="chat-modal-head">
              <div>
                <h3>Enable microphone</h3>
                <p className="muted-copy">We need microphone access to record voice notes.</p>
              </div>
              <button className="chat-head-icon" onClick={() => setIsMicHelpOpen(false)} type="button"><X size={16} /></button>
            </div>
            <div className="chat-modal-grid">
              <div className="chat-context-card">
                <p className="section-label">What to do</p>
                <p>{micHelpMessage || "Allow microphone access for this site, then retry the recording."}</p>
                <p>Step 1: Click the lock icon near the address bar and allow Microphone.</p>
                <p>Step 2: Refresh this page and tap the mic button again.</p>
                <p>Step 3: On Windows, enable microphone access for your browser in Settings.</p>
              </div>
              <div className="chat-context-card">
                <p className="section-label">Status</p>
                <strong>{micStatusLabel}</strong>
                <p className="muted-copy">If the status stays blocked, the browser or OS is still denying access.</p>
                {micLastError?.name || micLastError?.message ? (
                  <p className="muted-copy">
                    Last error: {micLastError?.name || "Unknown"}
                    {micLastError?.message ? ` - ${micLastError.message}` : ""}
                  </p>
                ) : null}
                {micDiagnostics ? (
                  <>
                    <p className="muted-copy">
                      Origin: {micDiagnostics.origin || "Unknown"}
                      {micDiagnostics.isSecureContext ? "" : " (not secure)"}
                      {micDiagnostics.inIframe ? " • In iframe" : ""}
                    </p>
                    <p className="muted-copy">
                      Permission query: {micDiagnostics.permissionQuery} • Audio inputs:{" "}
                      {typeof micDiagnostics.audioInputCount === "number" ? micDiagnostics.audioInputCount : "Unknown"}
                    </p>
                    {micDiagnostics.permissionsPolicyAllowsMicrophone !== null ? (
                      <p className="muted-copy">
                        Permissions policy allows mic: {micDiagnostics.permissionsPolicyAllowsMicrophone ? "yes" : "no"}
                      </p>
                    ) : null}
                    {micDiagnostics.enumerateDevicesError ? <p className="muted-copy">Device check error: {micDiagnostics.enumerateDevicesError}</p> : null}
                  </>
                ) : null}
              </div>
            </div>
            <div className="chat-inline-actions">
              <button className="ui-button-ghost" onClick={() => setIsMicHelpOpen(false)} type="button">Close</button>
              <button className="ui-button-ghost" onClick={() => forceStopMicrophone()} type="button">Stop mic</button>
              <button className="ui-button-primary" onClick={() => handleMicRetry().catch(() => undefined)} type="button">
                Try again
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  return (
    <ChatErrorBoundary>
      <Suspense
        fallback={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", color: "#94a3b8" }}>
            Loading social inbox...
          </div>
        }
      >
        <ChatWorkspaceInner {...props} />
      </Suspense>
    </ChatErrorBoundary>
  );
}

