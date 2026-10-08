"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  FileSpreadsheet,
  Globe,
  Inbox,
  Layers,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import type {
  UnifiedContactItem,
  UnifiedContactSourceCategory,
} from "@/app/api/sales/contacts/route";
import type {
  WhatsAppAccountType,
  WhatsAppScannerSessionState,
  WhatsAppSyncMode,
} from "@/app/api/sales/whatsapp-scanner/route";
import type {
  ConnectedEmailAccount,
  EmailProviderPresetId,
  ParsedEmailEnquiry,
} from "@/app/api/sales/email-inbox/route";

type ActiveImportDrawer =
  | null
  | "whatsapp_scanner"
  | "sheets_excel"
  | "email_inbox"
  | "manual_add";

type ContactsHubProps = {
  tenantId?: string;
  view?: "contacts" | "lead-import";
  canManageContacts?: boolean;
  onOpenMultiChannelChat?: (conversationId?: string) => void;
  onOpenPluginsHub?: () => void;
  onOpenBulkMarketing?: (contactIds?: string[]) => void;
  onRefreshDashboard?: () => void;
  initialDrawer?: ActiveImportDrawer;
};

type ImportPreview = {
  source: string;
  rows: Array<{
    row: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    source: string;
    tags: string;
    notes: string;
  }>;
  totalRows: number;
  valid: number;
  duplicate: number;
  skipped: number;
  invalid: number;
  errors?: Array<{ row: number; reason: string }>;
};

type ImportReport = ImportPreview & {
  imported: number;
};

const SOURCE_FILTER_TABS: Array<{
  id: UnifiedContactSourceCategory | "ALL";
  label: string;
}> = [
  { id: "ALL", label: "All Contacts" },
  { id: "WHATSAPP_SCANNER", label: "WhatsApp QR & Scraper" },
  { id: "WHATSAPP_CLOUD_API", label: "WhatsApp Cloud API" },
  { id: "EMAIL_ENQUIRY", label: "Email Enquiries (Gmail/Zoho/GoDaddy)" },
  { id: "SHEETS_EXCEL", label: "Google Sheets & Excel" },
  { id: "INSTAGRAM_DM", label: "Instagram DM" },
  { id: "SIM_MANUAL", label: "CRM & SIM Calls" },
];

function ContactSourceMark({ source }: { source: UnifiedContactSourceCategory }) {
  const icon =
    source === "WHATSAPP_SCANNER" || source === "WHATSAPP_CLOUD_API" ? (
      <MessageCircle size={12} strokeWidth={2.2} />
    ) : source === "EMAIL_ENQUIRY" ? (
      <Mail size={12} strokeWidth={2.2} />
    ) : source === "SHEETS_EXCEL" ? (
      <FileSpreadsheet size={12} strokeWidth={2.2} />
    ) : source === "INSTAGRAM_DM" ? (
      <Sparkles size={12} strokeWidth={2.2} />
    ) : source === "SIM_MANUAL" ? (
      <PhoneCall size={12} strokeWidth={2.2} />
    ) : (
      <Globe size={12} strokeWidth={2.2} />
    );

  return <span className="crm-source-mark" aria-hidden="true">{icon}</span>;
}

const EMAIL_PRESET_CARDS: Array<{
  id: EmailProviderPresetId;
  name: string;
  badge: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  accent: string;
  hint: string;
}> = [
  {
    id: "GMAIL",
    name: "Gmail / Google Workspace",
    badge: "OAuth / App Password",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    accent: "#ef4444",
    hint: "Connect personal @gmail.com or Google Workspace inbox to capture enquiry leads & phone numbers.",
  },
  {
    id: "ZOHO_IN",
    name: "Zoho Mail (.in / Custom Domain)",
    badge: "imappro.zoho.in:993",
    imapHost: "imappro.zoho.in",
    imapPort: 993,
    smtpHost: "smtppro.zoho.in",
    smtpPort: 465,
    accent: "#f59e0b",
    hint: "Supports Zoho Mail India (.in) and custom organization domains hosted on Zoho.",
  },
  {
    id: "ZOHO_COM",
    name: "Zoho Mail Global (.com)",
    badge: "imappro.zoho.com:993",
    imapHost: "imappro.zoho.com",
    imapPort: 993,
    smtpHost: "smtppro.zoho.com",
    smtpPort: 465,
    accent: "#eab308",
    hint: "Supports global @zoho.com and US/EU Zoho organization mailboxes.",
  },
  {
    id: "GODADDY_M365",
    name: "GoDaddy Mail (Microsoft 365)",
    badge: "outlook.office365.com:993",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    accent: "#06b6d4",
    hint: "Connect GoDaddy Professional Email powered by Microsoft 365.",
  },
  {
    id: "GODADDY_WORKSPACE",
    name: "GoDaddy Workspace Mail",
    badge: "imap.secureserver.net:993",
    imapHost: "imap.secureserver.net",
    imapPort: 993,
    smtpHost: "smtpout.secureserver.net",
    smtpPort: 465,
    accent: "#14b8a6",
    hint: "Connect standard GoDaddy Workspace / cPanel webmail boxes.",
  },
  {
    id: "CUSTOM_IMAP_SMTP",
    name: "Custom SMTP & IMAP",
    badge: "Universal Mail Server",
    imapHost: "mail.yourdomain.com",
    imapPort: 993,
    smtpHost: "mail.yourdomain.com",
    smtpPort: 465,
    accent: "#8b5cf6",
    hint: "Connect Hostinger, Titan, cPanel, AWS WorkMail, or any custom IMAP + SMTP server.",
  },
];

function renderDeterministicQrSvg(seed: string) {
  const size = 21;
  const cells: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        cells[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 8 && c < 8) ||
        (r < 8 && c >= size - 8) ||
        (r >= size - 8 && c < 8);
      if (inFinder) continue;
      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      cells[r][c] = (Math.abs(hash) % 10) < 5;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="176"
      height="176"
      style={{
        background: "#ffffff",
        padding: 10,
        borderRadius: 14,
        border: "2px solid rgba(16, 185, 129, 0.35)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
      }}
      aria-label="WhatsApp Linked Device QR Code"
    >
      {cells.map((row, rIdx) =>
        row.map((filled, cIdx) =>
          filled ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx}
              y={rIdx}
              width={0.92}
              height={0.92}
              rx={0.15}
              fill="#0f172a"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

export function ContactsHub({
  tenantId,
  view = "contacts",
  canManageContacts = false,
  onOpenMultiChannelChat,
  onOpenPluginsHub,
  onOpenBulkMarketing,
  onRefreshDashboard,
  initialDrawer = null,
}: ContactsHubProps) {
  const isLeadImportView = view === "lead-import";
  const [contacts, setContacts] = useState<UnifiedContactItem[]>([]);
  const [counts, setCounts] = useState<Record<UnifiedContactSourceCategory | "ALL", number>>({
    ALL: 0,
    WHATSAPP_SCANNER: 0,
    WHATSAPP_CLOUD_API: 0,
    EMAIL_ENQUIRY: 0,
    SHEETS_EXCEL: 0,
    INSTAGRAM_DM: 0,
    SIM_MANUAL: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<UnifiedContactSourceCategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeDrawer, setActiveDrawer] = useState<ActiveImportDrawer>(initialDrawer);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [distributing, setDistributing] = useState(false);
  const [distributeSuccess, setDistributeSuccess] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [lastImportReport, setLastImportReport] = useState<ImportReport | null>(null);
  const [pendingImportBatch, setPendingImportBatch] = useState<{ importBatchId: string; poolItemIds: string[] } | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`aicloser-import-batch:${tenantId}`) || "null");
      setPendingImportBatch(saved && typeof saved.importBatchId === "string" && Array.isArray(saved.poolItemIds) ? saved : null);
    } catch { setPendingImportBatch(null); }
  }, [tenantId]);
  const [editingContact, setEditingContact] = useState<UnifiedContactItem | null>(null);
  const [contactDraft, setContactDraft] = useState({ name: "", phone: "", email: "", tags: "", notes: "" });

  // 1. WhatsApp QR Scanner & Scraper State
  const [scannerState, setScannerState] = useState<WhatsAppScannerSessionState | null>(null);
  const [waAccountType, setWaAccountType] = useState<WhatsAppAccountType>("WHATSAPP_BUSINESS");
  const [waSyncMode, setWaSyncMode] = useState<WhatsAppSyncMode>("FULL_INBOX_SYNC");
  const [waVisibility, setWaVisibility] = useState<"TEAM_SHARED" | "PRIVATE">("TEAM_SHARED");
  const [waIncludeGroups, setWaIncludeGroups] = useState(true);
  const [waConnectedPhoneInput, setWaConnectedPhoneInput] = useState("+91 99818 07309");
  const [waPairingMethod, setWaPairingMethod] = useState<"QR_CAMERA" | "PAIRING_CODE">("QR_CAMERA");

  // 2. Google Sheets & Excel/CSV State
  const [sheetsTab, setSheetsTab] = useState<"excel_file" | "google_sheets" | "raw_paste">("excel_file");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [rawPasteText, setRawPasteText] = useState(
    "Aarav Khanna, +91 98112 34901, aarav@khannaventures.in\nPriya Nair, +91 98450 11229, priya@nairstudio.com\nRishi Oberoi, +91 98209 88321, rishi@oberoirealty.in",
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contactsTableShellRef = useRef<HTMLDivElement | null>(null);
  const [contactsTableScroll, setContactsTableScroll] = useState({ left: 0, max: 0 });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 3. Email Inbox (Gmail, Zoho, GoDaddy, Custom IMAP/SMTP) State
  const [emailAccounts, setEmailAccounts] = useState<ConnectedEmailAccount[]>([]);
  const [parsedEnquiries, setParsedEnquiries] = useState<ParsedEmailEnquiry[]>([]);
  const [selectedEmailPreset, setSelectedEmailPreset] = useState<EmailProviderPresetId>("GMAIL");
  const [emailAddressInput, setEmailAddressInput] = useState("enquiries@yourcompany.com");
  const [emailPasswordInput, setEmailPasswordInput] = useState("");
  const [customImapHost, setCustomImapHost] = useState("imap.gmail.com");
  const [customImapPort, setCustomImapPort] = useState(993);
  const [customSmtpHost, setCustomSmtpHost] = useState("smtp.gmail.com");
  const [customSmtpPort, setCustomSmtpPort] = useState(465);
  const [routeEmailsToInbox, setRouteEmailsToInbox] = useState(true);
  const [rawEmailTestSubject, setRawEmailTestSubject] = useState(
    "New Website Enquiry: Need 12 WhatsApp CRM Seats & Zoho Mail Integration",
  );
  const [rawEmailTestFrom, setRawEmailTestFrom] = useState("Website Lead Form <no-reply@yourwebsite.com>");
  const [rawEmailTestReplyTo, setRawEmailTestReplyTo] = useState("Nikhil Singhania <nikhil@singhaniagroup.in>");
  const [rawEmailTestBody, setRawEmailTestBody] = useState(
    "Customer Name: Nikhil Singhania\nEmail: nikhil@singhaniagroup.in\nMobile: +91 98207 44190\nRequirement: Looking to connect our WhatsApp Business QR and Zoho Mail enquiries into one shared closer inbox. Call me today.",
  );

  // 4. Manual Contact Add State
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualTags, setManualTags] = useState("Direct Lead, High Priority");
  const [manualNotes, setManualNotes] = useState("");

  const loadAllContactsAndIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      const [contactsRes, scannerRes, emailRes] = await Promise.all([
        fetch(`/api/sales/contacts${qs}`, { cache: "no-store" }),
        fetch(`/api/sales/whatsapp-scanner${qs}`, { cache: "no-store" }),
        fetch(`/api/sales/email-inbox${qs}`, { cache: "no-store" }),
      ]);

      const contactsJson = await contactsRes.json().catch(() => null);
      if (contactsJson?.ok) {
        setContacts(contactsJson.contacts || []);
        if (contactsJson.countsByCategory) {
          setCounts(contactsJson.countsByCategory);
        }
      }

      const scannerJson = await scannerRes.json().catch(() => null);
      if (scannerJson?.ok && scannerJson.scanner) {
        setScannerState(scannerJson.scanner);
        setWaAccountType(scannerJson.scanner.accountType || "WHATSAPP_BUSINESS");
        setWaSyncMode(scannerJson.scanner.syncMode || "FULL_INBOX_SYNC");
        setWaVisibility(scannerJson.scanner.visibilityMode || "TEAM_SHARED");
      }

      const emailJson = await emailRes.json().catch(() => null);
      if (emailJson?.ok) {
        setEmailAccounts(emailJson.accounts || []);
        setParsedEnquiries(emailJson.enquiries || []);
      }
    } catch {
      // ignore transient errors
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadAllContactsAndIntegrations();
  }, [loadAllContactsAndIntegrations]);

  useEffect(() => {
    if (initialDrawer) {
      setActiveDrawer(initialDrawer);
    }
  }, [initialDrawer]);

  // Live Auto-Polling for WhatsApp Multi-Device QR and Connection Status
  useEffect(() => {
    if (activeDrawer !== "whatsapp_scanner") return;
    let isMounted = true;

    const pollScannerStatus = async () => {
      try {
        const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
        const res = await fetch(`/api/sales/whatsapp-scanner${qs}`, { cache: "no-store" });
        const data = await res.json();
        if (data?.ok && data.scanner && isMounted) {
          setScannerState((prev) => {
            if (
              prev?.status !== data.scanner.status ||
              prev?.qrCodeDataUrl !== data.scanner.qrCodeDataUrl ||
              prev?.pairingCode !== data.scanner.pairingCode ||
              prev?.connectedPhone !== data.scanner.connectedPhone
            ) {
              return data.scanner;
            }
            return prev;
          });
          if (data.scanner.connectedPhone && (!waConnectedPhoneInput || waConnectedPhoneInput === "+91 99818 07309")) {
            setWaConnectedPhoneInput(data.scanner.connectedPhone);
          }
        }
      } catch {}
    };

    void pollScannerStatus();
    const interval = setInterval(pollScannerStatus, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeDrawer, tenantId, waConnectedPhoneInput]);

  const handleSelectEmailPreset = (presetId: EmailProviderPresetId) => {
    setSelectedEmailPreset(presetId);
    const card = EMAIL_PRESET_CARDS.find((c) => c.id === presetId);
    if (card) {
      setCustomImapHost(card.imapHost);
      setCustomImapPort(card.imapPort);
      setCustomSmtpHost(card.smtpHost);
      setCustomSmtpPort(card.smtpPort);
    }
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter((item) => {
      if (activeFilter !== "ALL" && item.sourceCategory !== activeFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.sourceLabel.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [contacts, activeFilter, searchQuery]);

  const syncContactsTableScroll = useCallback(() => {
    const node = contactsTableShellRef.current;
    if (!node) return;
    setContactsTableScroll({
      left: node.scrollLeft,
      max: Math.max(0, node.scrollWidth - node.clientWidth),
    });
  }, []);

  const scrollContactsTable = useCallback((delta: number) => {
    const node = contactsTableShellRef.current;
    if (!node) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollBy({ left: delta, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const node = contactsTableShellRef.current;
    if (!node) return;

    syncContactsTableScroll();
    const handleResize = () => syncContactsTableScroll();
    window.addEventListener("resize", handleResize);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(node);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, [filteredContacts.length, syncContactsTableScroll]);

  // --- Actions ---
  const handleGenerateQr = async () => {
    setBusyAction("generate_qr");
    setBanner(null);
    try {
      const res = await fetch("/api/sales/whatsapp-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          action: "generate_qr",
          accountType: waAccountType,
          syncMode: waSyncMode,
          visibilityMode: waVisibility,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setScannerState(data.scanner);
        setBanner({ tone: "success", text: data.message });
      } else {
        setBanner({ tone: "error", text: data.error || "Could not generate QR session." });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleRequestPairingCode = async () => {
    setBusyAction("request_pairing_code");
    setBanner(null);
    try {
      const res = await fetch("/api/sales/whatsapp-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          action: "request_pairing_code",
          accountType: waAccountType,
          syncMode: waSyncMode,
          connectedPhone: waConnectedPhoneInput,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setScannerState(data.scanner);
        setBanner({ tone: "success", text: data.message });
      } else {
        setBanner({ tone: "error", text: data.error || "Failed to generate pairing code." });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setBusyAction("disconnect_wa");
    setBanner(null);
    try {
      const res = await fetch("/api/sales/whatsapp-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          action: "disconnect",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setScannerState(data.scanner);
        setBanner({ tone: "success", text: "WhatsApp session disconnected." });
      } else {
        setBanner({ tone: "error", text: data.error || "Failed to disconnect." });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunWhatsAppScanAndScrape = async () => {
    setBusyAction("complete_scan");
    setBanner(null);
    try {
      const res = await fetch("/api/sales/whatsapp-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          action: "complete_scan",
          accountType: waAccountType,
          syncMode: waSyncMode,
          visibilityMode: waVisibility,
          connectedPhone: waConnectedPhoneInput,
          includeGroups: waIncludeGroups,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setScannerState(data.scanner);
        setBanner({ tone: "success", text: data.message });
        await loadAllContactsAndIntegrations();
        onRefreshDashboard?.();
      } else {
        setBanner({ tone: "error", text: data.error || "WhatsApp sync failed." });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const buildImportFormData = (preview: boolean) => {
    const formData = new FormData();
    formData.set("mode", "add_to_round_robin_queue");
    if (preview) formData.set("preview", "true");
    if (sheetsTab === "excel_file" && selectedFile) {
      formData.set("file", selectedFile);
    } else if (sheetsTab === "google_sheets" && googleSheetUrl.trim()) {
      formData.set("googleSheetUrl", googleSheetUrl.trim());
    }
    return formData;
  };

  const handleImportFileOrGoogleSheet = async (event: FormEvent) => {
    event.preventDefault();
    setBusyAction("preview_import");
    setBanner(null);
    try {
      if (sheetsTab === "raw_paste") {
        const res = await fetch("/api/sales/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, rawText: rawPasteText, sourceLabel: "csv_phone_contact_import", preview: true }),
        });
        const data = await res.json();
        if (data.ok) {
          setImportPreview(data);
          setLastImportReport(null);
          setBanner({ tone: "success", text: "Preview ready. Review the rows before saving them to Contacts." });
        } else {
          setBanner({ tone: "error", text: data.error || "Unable to preview phone contacts." });
        }
        return;
      }

      if ((sheetsTab === "excel_file" && !selectedFile) || (sheetsTab === "google_sheets" && !googleSheetUrl.trim())) {
        setBanner({
          tone: "error",
          text: sheetsTab === "excel_file" ? "Select an Excel or CSV file first." : "Paste a Google Sheets link first.",
        });
        return;
      }

      const res = await fetch("/api/sales/leads/import", { method: "POST", body: buildImportFormData(true) });
      const data = await res.json();
      if (data.ok) {
        setImportPreview(data);
        setLastImportReport(null);
        setBanner({ tone: "success", text: "Preview ready. Review the rows before saving them to Contacts." });
      } else {
        setBanner({ tone: "error", text: data.error || "Unable to preview import." });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleCommitImport = async () => {
    if (!importPreview) return;
    setBusyAction("commit_import");
    setBanner(null);
    try {
      let data: Record<string, any>;
      if (sheetsTab === "raw_paste") {
        const res = await fetch("/api/sales/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, rawText: rawPasteText, sourceLabel: "csv_phone_contact_import" }),
        });
        data = await res.json();
      } else {
        const res = await fetch("/api/sales/leads/import", { method: "POST", body: buildImportFormData(false) });
        data = await res.json();
      }
      if (data.ok) {
        const report = {
          ...importPreview,
          imported: Number(data.imported ?? 0),
          duplicate: Number(data.duplicate ?? importPreview.duplicate),
          skipped: Number(data.skipped ?? importPreview.skipped),
          invalid: Number(data.invalid ?? importPreview.invalid),
        };
        setLastImportReport(report);
        if (typeof data.importBatchId === "string" && Array.isArray(data.poolItemIds) && data.poolItemIds.length) {
          const batch = { importBatchId: data.importBatchId, poolItemIds: data.poolItemIds as string[] };
          setPendingImportBatch(batch);
          localStorage.setItem(`aicloser-import-batch:${tenantId}`, JSON.stringify(batch));
        }
        setImportPreview(null);
        setSelectedFile(null);
        setBanner({ tone: "success", text: `Saved ${report.imported} contacts. ${report.duplicate} duplicates were skipped.` });
        await loadAllContactsAndIntegrations();
        onRefreshDashboard?.();
      } else {
        setBanner({ tone: "error", text: data.error || "Import could not be saved." });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleConnectEmailAccount = async (event: FormEvent) => {
    event.preventDefault();
    setBusyAction("connect_email");
    setBanner(null);
    try {
      const res = await fetch("/api/sales/email-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          action: "connect",
          provider: selectedEmailPreset,
          emailAddress: emailAddressInput,
          passwordOrToken: emailPasswordInput,
          imapHost: customImapHost,
          imapPort: customImapPort,
          smtpHost: customSmtpHost,
          smtpPort: customSmtpPort,
          routeEnquiriesToInbox: routeEmailsToInbox,
          extractPhonesFromBody: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEmailAccounts(data.accounts || []);
        setBanner({ tone: "success", text: data.message });
      } else {
        setBanner({ tone: "error", text: data.error || "Could not connect email inbox." });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleSyncEmailEnquiries = async () => {
    setBusyAction("sync_email_enquiries");
    setBanner(null);
    try {
      const res = await fetch("/api/sales/email-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          action: "sync_enquiries",
          provider: selectedEmailPreset,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEmailAccounts(data.accounts || []);
        setParsedEnquiries(data.enquiries || []);
        setBanner({ tone: "success", text: data.message });
        await loadAllContactsAndIntegrations();
        onRefreshDashboard?.();
      } else {
        setBanner({ tone: "error", text: data.error || "Email enquiry sync failed." });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleParseCustomEmail = async () => {
    setBusyAction("parse_custom_email");
    setBanner(null);
    try {
      const res = await fetch("/api/sales/email-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          action: "parse_custom_email",
          provider: selectedEmailPreset,
          rawEmail: {
            subject: rawEmailTestSubject,
            fromHeader: rawEmailTestFrom,
            replyToHeader: rawEmailTestReplyTo,
            body: rawEmailTestBody,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setParsedEnquiries(data.enquiries || []);
        setBanner({ tone: "success", text: data.message });
        await loadAllContactsAndIntegrations();
        onRefreshDashboard?.();
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddManualContact = async (event: FormEvent) => {
    event.preventDefault();
    if (!manualName.trim() && !manualPhone.trim()) return;
    setBusyAction("manual_add");
    setBanner(null);
    try {
      const res = await fetch("/api/sales/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          contacts: [
            {
              name: manualName.trim(),
              phone: manualPhone.trim(),
              email: manualEmail.trim(),
              source: "manual_crm_contact",
              tags: manualTags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              notes: manualNotes.trim(),
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBanner({ tone: "success", text: data.message });
        setManualName("");
        setManualPhone("");
        setManualEmail("");
        setManualNotes("");
        setActiveDrawer(null);
        await loadAllContactsAndIntegrations();
        onRefreshDashboard?.();
      }
    } finally {
      setBusyAction(null);
    }
  };

  const openContactEditor = (contact: UnifiedContactItem) => {
    setEditingContact(contact);
    setContactDraft({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      tags: contact.tags.join(", "),
      notes: contact.notes,
    });
  };

  const handleUpdateContact = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingContact) return;
    setBusyAction("edit_contact");
    setBanner(null);
    try {
      const res = await fetch("/api/sales/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          leadId: editingContact.leadId,
          marketingContactId: editingContact.marketingContactId,
          name: contactDraft.name,
          phone: contactDraft.phone,
          email: contactDraft.email,
          tags: contactDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          notes: contactDraft.notes,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setBanner({ tone: "error", text: data.error || "Contact could not be updated." });
        return;
      }
      setEditingContact(null);
      setBanner({ tone: "success", text: "Contact updated successfully." });
      await loadAllContactsAndIntegrations();
      onRefreshDashboard?.();
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportCsv = () => {
    const headers = ["Name", "Phone", "Email", "Source", "Stage", "Tags", "Assigned Rep", "Last Activity"];
    const rows = filteredContacts.map((c) => [
      `"${(c.name || "").replace(/"/g, '""')}"`,
      `"${(c.phone || "").replace(/"/g, '""')}"`,
      `"${(c.email || "").replace(/"/g, '""')}"`,
      `"${(c.sourceLabel || "").replace(/"/g, '""')}"`,
      `"${c.stage}"`,
      `"${c.tags.join(", ").replace(/"/g, '""')}"`,
      `"${(c.assignedAgentName || "").replace(/"/g, '""')}"`,
      `"${c.lastActivityAt}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aicloser-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const headers = ["Name", "Phone", "Email", "Source", "Stage", "Tags", "Assigned Rep", "Last Activity"];
    const rows = filteredContacts.map((c) => [c.name, c.phone, c.email, c.sourceLabel, c.stage, c.tags.join(", "), c.assignedAgentName, c.lastActivityAt]);
    const worksheet = [headers, ...rows]
      .map((row) => row.map((value) => String(value || "").replace(/\t|\r?\n/g, " ")).join("\t"))
      .join("\n");
    const blob = new Blob([worksheet], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aicloser-contacts-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    const selectedItems = contacts.filter((c) => selectedIds.has(c.id));
    const leadIds = selectedItems.map((c) => c.leadId).filter(Boolean) as string[];
    const marketingContactIds = selectedItems.map((c) => c.marketingContactId).filter(Boolean) as string[];
    await fetch("/api/sales/contacts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, leadIds, marketingContactIds }),
    });
    setSelectedIds(new Set());
    await loadAllContactsAndIntegrations();
    onRefreshDashboard?.();
  };

  const handleDeleteContact = async (contact: UnifiedContactItem) => {
    if (!canManageContacts || !window.confirm(`Delete ${contact.name || "this contact"}?`)) return;
    setBusyAction(`delete_contact_${contact.id}`);
    try {
      await fetch("/api/sales/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          leadIds: contact.leadId ? [contact.leadId] : [],
          marketingContactIds: contact.marketingContactId ? [contact.marketingContactId] : [],
        }),
      });
      setBanner({ tone: "success", text: "Contact deleted successfully." });
      await loadAllContactsAndIntegrations();
      onRefreshDashboard?.();
    } finally {
      setBusyAction(null);
    }
  };

  const handleAutoDistribute = async () => {
    const targetContacts = selectedIds.size > 0
      ? contacts.filter((c) => selectedIds.has(c.id))
      : [];

    if (targetContacts.length === 0 && !pendingImportBatch?.poolItemIds.length) {
      alert("Select the imported contacts you want to distribute first.");
      return;
    }

    setDistributing(true);
    try {
      const payload = {
        tenantId,
        action: "distribute",
        leadIds: targetContacts.map((c) => c.leadId).filter(Boolean),
        poolItemIds: selectedIds.size > 0 ? targetContacts.map((c) => c.poolItemId).filter(Boolean) : pendingImportBatch?.poolItemIds ?? [],
        contacts: targetContacts.filter((c) => !c.poolItemId).map((c) => ({
          id: c.id,
          leadId: c.leadId,
          name: c.name,
          phone: c.phone,
          email: c.email,
          tags: c.tags,
          source: c.sourceLabel,
        })),
      };

      const res = await fetch("/api/sales/round-robin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setDistributeSuccess(data.message || "Auto-distributed contacts across sales agents!");
        if (selectedIds.size === 0) {
          setPendingImportBatch(null);
          localStorage.removeItem(`aicloser-import-batch:${tenantId}`);
        }
        setSelectedIds(new Set());
        await loadAllContactsAndIntegrations();
        onRefreshDashboard?.();
        setTimeout(() => setDistributeSuccess(null), 8000);
      } else {
        alert(data.error || "Failed to auto-distribute contacts.");
      }
    } catch (err) {
      alert("Distribution error: " + String(err));
    } finally {
      setDistributing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const handleImportCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, action: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="crm-contacts-hub" style={{ display: "grid", gap: 20 }}>
      {/* Shared header; source workflows live on the dedicated Lead Import page. */}
      <div
        className="crm-panel crm-contacts-hero"
        style={{
          padding: 22,
          borderRadius: 18,
          background:
            "linear-gradient(135deg, rgba(255, 107, 47, 0.10) 0%, rgba(16, 185, 129, 0.06) 55%, rgba(59, 130, 246, 0.06) 100%)",
          border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
        }}
      >
        <div
          className="crm-contacts-hero-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div className="crm-contacts-eyebrows">
              <span className="crm-eyebrow crm-eyebrow-primary">
                Unified Omnichannel Directory
              </span>
              <span className="crm-eyebrow crm-eyebrow-success">
                {counts.ALL} Total Verified Contacts
              </span>
            </div>
            <h2 className="crm-contacts-title">
              {isLeadImportView ? "Lead Import Center" : "All Contacts"}
            </h2>
            <p className="crm-contacts-description">
              {isLeadImportView
                ? "Bring contacts in from five sources, review the data, then save only the rows you approve."
                : "One clean, deduplicated directory for every contact from WhatsApp, email, sheets, CSV, imports, and the CRM."}
            </p>
          </div>

          <div className="crm-hero-actions">
            {canManageContacts ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActiveDrawer("manual_add")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
              >
                <Plus size={15} /> Add Contact
              </button>
            ) : null}
            <div className="crm-export-menu">
              <button
                aria-expanded={isExportMenuOpen}
                type="button"
                className="secondary-button"
                onClick={() => setIsExportMenuOpen((open) => !open)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
              >
                <Download size={15} /> Export
              </button>
              {isExportMenuOpen ? (
                <div aria-label="Export contacts" className="crm-export-popover" role="menu">
                  <button onClick={() => { handleExportCsv(); setIsExportMenuOpen(false); }} role="menuitem" type="button">
                    <Download size={14} /> CSV file
                  </button>
                  <button onClick={handleExportExcel} role="menuitem" type="button">
                    <FileSpreadsheet size={14} /> Excel file
                  </button>
                  <small>{filteredContacts.length} filtered contacts</small>
                </div>
              ) : null}
            </div>
            {onOpenPluginsHub ? (
              <button
                type="button"
                className="secondary-button"
                onClick={onOpenPluginsHub}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
              >
                <Layers size={15} /> Open All Plugins
              </button>
            ) : null}
          </div>
        </div>

        {isLeadImportView ? (
        <div className="crm-import-grid crm-import-launchers">
          {/* Card 1: WhatsApp QR Scanner & Contact Scraper */}
          <div
            className={`crm-import-card${activeDrawer === "whatsapp_scanner" ? " is-active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() =>
              setActiveDrawer(activeDrawer === "whatsapp_scanner" ? null : "whatsapp_scanner")
            }
            onKeyDown={(event) =>
              handleImportCardKeyDown(event, () =>
                setActiveDrawer(activeDrawer === "whatsapp_scanner" ? null : "whatsapp_scanner"),
              )
            }
            style={{
              cursor: "pointer",
              padding: 16,
              borderRadius: 14,
              background:
                activeDrawer === "whatsapp_scanner"
                  ? "rgba(16, 185, 129, 0.14)"
                  : "var(--surface-strong, rgba(15, 23, 42, 0.55))",
              border:
                activeDrawer === "whatsapp_scanner"
                  ? "2px solid #10b981"
                  : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
              transition: "all 0.16s ease",
            }}
          >
            <div className="crm-import-card-top">
              <span className="crm-import-icon crm-import-icon-success">
                <QrCode size={19} />
              </span>
              <span className={`crm-import-status ${scannerState?.status === "CONNECTED" ? "is-connected" : "is-warning"}`}>
                {scannerState?.status === "CONNECTED" ? "QR Linked" : "2 Sync Modes"}
              </span>
            </div>
            <strong className="crm-import-card-title">
              1. WhatsApp QR Scanner & Scraper
            </strong>
            <p className="crm-import-card-copy">
              Scan <strong>WhatsApp Business</strong> or <strong>Normal WhatsApp</strong>: (A) Sync Chats + Contacts to Inbox, or (B) Scrape Contact Numbers Only.
            </p>
          </div>

          {/* Card 2: Google Sheets Live Sync */}
          <div
            className={`crm-import-card${activeDrawer === "sheets_excel" && sheetsTab === "google_sheets" ? " is-active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              setSheetsTab("google_sheets");
              setActiveDrawer(activeDrawer === "sheets_excel" && sheetsTab === "google_sheets" ? null : "sheets_excel");
            }}
            onKeyDown={(event) =>
              handleImportCardKeyDown(event, () => {
                setSheetsTab("google_sheets");
                setActiveDrawer(activeDrawer === "sheets_excel" && sheetsTab === "google_sheets" ? null : "sheets_excel");
              })
            }
            style={{
              cursor: "pointer",
              padding: 16,
              borderRadius: 14,
              background:
                activeDrawer === "sheets_excel" && sheetsTab === "google_sheets"
                  ? "rgba(59, 130, 246, 0.14)"
                  : "var(--surface-strong, rgba(15, 23, 42, 0.55))",
              border:
                activeDrawer === "sheets_excel" && sheetsTab === "google_sheets"
                  ? "2px solid #3b82f6"
                  : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
              transition: "all 0.16s ease",
            }}
          >
            <div className="crm-import-card-top">
              <span className="crm-import-icon crm-import-icon-info">
                <Globe size={19} />
              </span>
              <span className="crm-import-status is-info">
                Live URL Import
              </span>
            </div>
            <strong className="crm-import-card-title">
              2. Import from Google Sheets
            </strong>
            <p className="crm-import-card-copy">
              Paste any Google Sheet link to pull phone numbers, names, emails, and tags straight into Contacts.
            </p>
          </div>

          {/* Card 3: Excel workbook upload */}
          <div
            className={`crm-import-card${activeDrawer === "sheets_excel" && sheetsTab === "excel_file" ? " is-active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              setSheetsTab("excel_file");
              setActiveDrawer(activeDrawer === "sheets_excel" && sheetsTab === "excel_file" ? null : "sheets_excel");
            }}
            onKeyDown={(event) =>
              handleImportCardKeyDown(event, () => {
                setSheetsTab("excel_file");
                setActiveDrawer(activeDrawer === "sheets_excel" && sheetsTab === "excel_file" ? null : "sheets_excel");
              })
            }
            style={{
              cursor: "pointer",
              padding: 16,
              borderRadius: 14,
              background:
                activeDrawer === "sheets_excel" && sheetsTab === "excel_file"
                  ? "rgba(255, 107, 47, 0.14)"
                  : "var(--surface-strong, rgba(15, 23, 42, 0.55))",
              border:
                activeDrawer === "sheets_excel" && sheetsTab === "excel_file"
                  ? "2px solid #ff6b2f"
                  : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
              transition: "all 0.16s ease",
            }}
          >
            <div className="crm-import-card-top">
              <span className="crm-import-icon crm-import-icon-primary">
                <FileSpreadsheet size={19} />
              </span>
              <span className="crm-import-status is-primary">
                .XLSX / .XLS
              </span>
            </div>
            <strong className="crm-import-card-title">
              3. Import Excel Sheet
            </strong>
            <p className="crm-import-card-copy">
              Upload an Excel workbook and preview the rows before saving them to Contacts.
            </p>
          </div>

          {/* Card 4: CSV / phone contact paste */}
          <div
            className={`crm-import-card${activeDrawer === "sheets_excel" && sheetsTab === "raw_paste" ? " is-active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              setSheetsTab("raw_paste");
              setActiveDrawer(activeDrawer === "sheets_excel" && sheetsTab === "raw_paste" ? null : "sheets_excel");
            }}
            onKeyDown={(event) => handleImportCardKeyDown(event, () => {
              setSheetsTab("raw_paste");
              setActiveDrawer(activeDrawer === "sheets_excel" && sheetsTab === "raw_paste" ? null : "sheets_excel");
            })}
            style={{ cursor: "pointer", padding: 16, borderRadius: 14 }}
          >
            <div className="crm-import-card-top">
              <span className="crm-import-icon crm-import-icon-primary"><Upload size={19} /></span>
              <span className="crm-import-status is-primary">CSV / Paste</span>
            </div>
            <strong className="crm-import-card-title">4. CSV / Phone Contacts</strong>
            <p className="crm-import-card-copy">
              Paste copied CSV rows or phone contacts, review the list, then save the approved records.
            </p>
          </div>

          {/* Card 5: Connect Email Inbox (Gmail, Zoho, GoDaddy, SMTP) */}
          <div
            className={`crm-import-card${activeDrawer === "email_inbox" ? " is-active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() =>
              setActiveDrawer(activeDrawer === "email_inbox" ? null : "email_inbox")
            }
            onKeyDown={(event) =>
              handleImportCardKeyDown(event, () =>
                setActiveDrawer(activeDrawer === "email_inbox" ? null : "email_inbox"),
              )
            }
            style={{
              cursor: "pointer",
              padding: 16,
              borderRadius: 14,
              background:
                activeDrawer === "email_inbox"
                  ? "rgba(139, 92, 246, 0.14)"
                  : "var(--surface-strong, rgba(15, 23, 42, 0.55))",
              border:
                activeDrawer === "email_inbox"
                  ? "2px solid #8b5cf6"
                  : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
              transition: "all 0.16s ease",
            }}
          >
            <div className="crm-import-card-top">
              <span className="crm-import-icon crm-import-icon-neutral">
                <Mail size={19} />
              </span>
              <span className="crm-import-status is-neutral">
                {emailAccounts.length ? `${emailAccounts.length} Connected` : "Gmail • Zoho • GoDaddy"}
              </span>
            </div>
            <strong className="crm-import-card-title">
              5. Email SMTP Import
            </strong>
            <p className="crm-import-card-copy">
              Connect <strong>Gmail</strong>, <strong>Zoho Mail</strong>, <strong>GoDaddy</strong>, or <strong>SMTP/IMAP</strong> to auto-extract enquiry leads & phones.
            </p>
          </div>
        </div>
        ) : null}
      </div>

      {/* Status Notification Banner */}
      {banner ? (
        <div
          className={`crm-notice crm-notice-${banner.tone}`}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background:
              banner.tone === "success" ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.14)",
            border: `1px solid ${banner.tone === "success" ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            color: banner.tone === "success" ? "#10b981" : "#ef4444",
            fontWeight: 600,
            fontSize: "0.88rem",
          }}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      {isLeadImportView && (importPreview || lastImportReport) ? (
        <section className="crm-panel crm-import-review" aria-live="polite" style={{ padding: 20, borderRadius: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <span className="crm-eyebrow crm-eyebrow-primary">Import report</span>
              <h3 style={{ margin: "6px 0 4px", fontSize: "1.08rem" }}>
                {importPreview ? "Review before saving" : "Last import completed"}
              </h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                {importPreview
                  ? `${importPreview.valid} valid rows from ${importPreview.source === "google_sheets" ? "Google Sheets" : "your file"} are ready for review.`
                  : `${lastImportReport?.imported ?? 0} contacts were saved to the workspace.`}
              </p>
            </div>
            {importPreview ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="secondary-button" onClick={() => setImportPreview(null)}>Discard preview</button>
                <button type="button" className="primary-button" disabled={busyAction === "commit_import"} onClick={() => void handleCommitImport()}>
                  {busyAction === "commit_import" ? "Saving..." : "Save approved contacts"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="crm-import-report-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 16 }}>
            {[
              ["Valid rows", importPreview?.valid ?? lastImportReport?.valid ?? 0],
              ["Duplicates", importPreview?.duplicate ?? lastImportReport?.duplicate ?? 0],
              ["Skipped", importPreview?.skipped ?? lastImportReport?.skipped ?? 0],
              ["Errors", importPreview?.invalid ?? lastImportReport?.invalid ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="crm-import-report-metric" style={{ padding: "10px 12px", borderRadius: 10 }}>
                <span style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>{label}</span>
                <strong style={{ display: "block", marginTop: 3, fontSize: 18 }}>{value}</strong>
              </div>
            ))}
          </div>

          {importPreview ? (
            <div className="crm-import-preview-table" style={{ overflowX: "auto", marginTop: 16 }}>
              <table className="crm-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr><th>Row</th><th>Name</th><th>Phone</th><th>Email</th><th>Source</th><th>Tags</th></tr></thead>
                <tbody>
                  {importPreview.rows.length ? importPreview.rows.map((row) => (
                    <tr key={`${row.row}-${row.customerPhone}-${row.customerEmail}`}>
                      <td>{row.row}</td><td>{row.customerName}</td><td>{row.customerPhone || "—"}</td><td>{row.customerEmail || "—"}</td><td>{row.source}</td><td>{row.tags || "—"}</td>
                    </tr>
                  )) : <tr><td colSpan={6}>No valid rows found in this source.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* =========================================================================
          DRAWER 1: DUAL-MODE WHATSAPP QR SCANNER & CONTACT SCRAPER
      ========================================================================= */}
      {activeDrawer === "whatsapp_scanner" ? (
        <div
          className="crm-panel"
          style={{
            padding: 22,
            borderRadius: 18,
            border: "2px solid rgba(16, 185, 129, 0.45)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                }}
              >
                WhatsApp Linked Devices Engine • Business & Personal
              </span>
              <h3 style={{ margin: "6px 0 4px", fontSize: "1.18rem", fontWeight: 800 }}>
                Scan WhatsApp QR Code — Choose Inbox Chat Sync OR Contact Numbers Scraper
              </h3>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--muted)" }}>
                Link either your <strong>WhatsApp Business App</strong> or <strong>Normal WhatsApp App</strong>. Choose whether to sync full chat threads into the Multi-Channel Inbox or scrape phone numbers only.
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setActiveDrawer(null)}
              style={{ padding: "6px 10px" }}
            >
              <X size={16} />
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
              gap: 18,
              alignItems: "start",
            }}
          >
            {/* Left Column: Step 1 (Account Type) + Step 2 (Two Explicit Sync Modes) */}
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Step 1: Select WhatsApp Account Type to Scan
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setWaAccountType("WHATSAPP_BUSINESS")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      textAlign: "left",
                      cursor: "pointer",
                      background:
                        waAccountType === "WHATSAPP_BUSINESS"
                          ? "rgba(16, 185, 129, 0.16)"
                          : "var(--surface-strong, rgba(15, 23, 42, 0.45))",
                      border:
                        waAccountType === "WHATSAPP_BUSINESS"
                          ? "2px solid #10b981"
                          : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                      color: "inherit",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.88rem" }}>
                      <Smartphone size={16} color="#10b981" />
                      WhatsApp Business
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
                      Sync Business chats, labels, catalog leads & customer numbers.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWaAccountType("WHATSAPP_PERSONAL")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      textAlign: "left",
                      cursor: "pointer",
                      background:
                        waAccountType === "WHATSAPP_PERSONAL"
                          ? "rgba(59, 130, 246, 0.16)"
                          : "var(--surface-strong, rgba(15, 23, 42, 0.45))",
                      border:
                        waAccountType === "WHATSAPP_PERSONAL"
                          ? "2px solid #3b82f6"
                          : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                      color: "inherit",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.88rem" }}>
                      <MessageCircle size={16} color="#3b82f6" />
                      Normal WhatsApp
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
                      Scan any personal or sales rep WhatsApp via Linked Devices.
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Step 2: Choose What Happens After QR Scan (2 Modes)
                </label>
                <div style={{ display: "grid", gap: 10 }}>
                  {/* Mode A: FULL_INBOX_SYNC */}
                  <div
                    onClick={() => setWaSyncMode("FULL_INBOX_SYNC")}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      cursor: "pointer",
                      background:
                        waSyncMode === "FULL_INBOX_SYNC"
                          ? "rgba(255, 107, 47, 0.14)"
                          : "var(--surface-strong, rgba(15, 23, 42, 0.45))",
                      border:
                        waSyncMode === "FULL_INBOX_SYNC"
                          ? "2px solid #ff6b2f"
                          : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 8 }}>
                        <MessageSquare size={16} color="#ff6b2f" />
                        Option A: Sync WhatsApp Chats + Contact Numbers to Multi-Channel Inbox
                      </strong>
                      <input
                        type="radio"
                        checked={waSyncMode === "FULL_INBOX_SYNC"}
                        onChange={() => setWaSyncMode("FULL_INBOX_SYNC")}
                      />
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.45 }}>
                      Streams your {waAccountType === "WHATSAPP_BUSINESS" ? "WhatsApp Business" : "Normal WhatsApp"} chats & messages directly into <strong>Live Multi-Channel Chat</strong> with customer phone numbers AND saves all contacts to your CRM.
                    </p>
                  </div>

                  {/* Mode B: CONTACTS_ONLY_SCRAPER */}
                  <div
                    onClick={() => setWaSyncMode("CONTACTS_ONLY_SCRAPER")}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      cursor: "pointer",
                      background:
                        waSyncMode === "CONTACTS_ONLY_SCRAPER"
                          ? "rgba(16, 185, 129, 0.14)"
                          : "var(--surface-strong, rgba(15, 23, 42, 0.45))",
                      border:
                        waSyncMode === "CONTACTS_ONLY_SCRAPER"
                          ? "2px solid #10b981"
                          : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 8 }}>
                        <Users size={16} color="#10b981" />
                        Option B: Scrape & Import Contact Numbers Only (Zero Chat Clutter)
                      </strong>
                      <input
                        type="radio"
                        checked={waSyncMode === "CONTACTS_ONLY_SCRAPER"}
                        onChange={() => setWaSyncMode("CONTACTS_ONLY_SCRAPER")}
                      />
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.45 }}>
                      Scrapes all 1:1 chat phone numbers, display names, and WhatsApp Group participants into the <strong>Contacts Directory</strong> without importing old chat messages into your inbox.
                    </p>
                  </div>
                </div>
              </div>

              {waSyncMode === "CONTACTS_ONLY_SCRAPER" ? (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.83rem",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={waIncludeGroups}
                    onChange={(e) => setWaIncludeGroups(e.target.checked)}
                  />
                  <span>
                    <strong>Also scrape WhatsApp Group participants</strong> (extracts member phone numbers & group tags)
                  </span>
                </label>
              ) : (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.83rem",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255, 107, 47, 0.08)",
                    border: "1px solid rgba(255, 107, 47, 0.25)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={waVisibility === "TEAM_SHARED"}
                    onChange={(e) => setWaVisibility(e.target.checked ? "TEAM_SHARED" : "PRIVATE")}
                  />
                  <span>
                    <strong>Share synced chats with Team Multi-Channel Inbox</strong> (teammates can view & reply even if their own WhatsApp is not connected)
                  </span>
                </label>
              )}
            </div>

            {/* Right Column: Live QR Code + Action Buttons */}
            <div
              style={{
                padding: 18,
                borderRadius: 16,
                background: "var(--surface-strong, rgba(15, 23, 42, 0.55))",
                border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                display: "grid",
                gap: 14,
                justifyItems: "center",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "#10b981" }}>
                  <QrCode size={16} />
                  {waAccountType === "WHATSAPP_BUSINESS" ? "WhatsApp Business Multi-Device" : "Normal WhatsApp Multi-Device"}
                </div>
                <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.25)", padding: 3, borderRadius: 8 }}>
                  <button
                    type="button"
                    onClick={() => setWaPairingMethod("QR_CAMERA")}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: waPairingMethod === "QR_CAMERA" ? "#10b981" : "transparent",
                      color: waPairingMethod === "QR_CAMERA" ? "#fff" : "var(--muted)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Camera QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaPairingMethod("PAIRING_CODE")}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: waPairingMethod === "PAIRING_CODE" ? "#10b981" : "transparent",
                      color: waPairingMethod === "PAIRING_CODE" ? "#fff" : "var(--muted)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Pairing Code
                  </button>
                </div>
              </div>

              {scannerState?.status === "CONNECTED" ? (
                <div
                  style={{
                    width: "100%",
                    padding: "16px 14px",
                    borderRadius: 14,
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "2px solid #10b981",
                    display: "grid",
                    gap: 10,
                    placeItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "#10b981",
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                    }}
                  >
                    <CheckCircle2 size={24} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <strong style={{ fontSize: "1rem", color: "#10b981", display: "block" }}>
                      WhatsApp Account Linked!
                    </strong>
                    <span style={{ fontSize: "0.85rem", color: "var(--foreground)", fontWeight: 600 }}>
                      {scannerState.connectedPhone || waConnectedPhoneInput}{" "}
                      {scannerState.connectedDisplayName ? `(${scannerState.connectedDisplayName})` : ""}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      justifyContent: "center",
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>
                      📦 <strong>{scannerState.stats?.totalScrapedContacts || 0}</strong> Contacts Scraped
                    </span>
                    <span>
                      💬 <strong>{scannerState.stats?.totalSyncedChatThreads || 0}</strong> Chat Threads
                    </span>
                    <span>
                      👥 <strong>{scannerState.stats?.totalGroupContactsScraped || 0}</strong> Group Contacts
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectWhatsApp}
                    disabled={busyAction === "disconnect_wa"}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      color: "#ef4444",
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    {busyAction === "disconnect_wa" ? "Disconnecting..." : "Unlink / Connect Another Number"}
                  </button>
                </div>
              ) : waPairingMethod === "PAIRING_CODE" ? (
                <div
                  style={{
                    width: "100%",
                    maxWidth: 320,
                    display: "grid",
                    gap: 12,
                    padding: 16,
                    borderRadius: 14,
                    background: "rgba(15, 23, 42, 0.45)",
                    border: "1px solid var(--closer-line)",
                    textAlign: "left",
                  }}
                >
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                    WhatsApp Phone Number (with Country Code)
                  </label>
                  <input
                    type="text"
                    value={waConnectedPhoneInput}
                    onChange={(e) => setWaConnectedPhoneInput(e.target.value)}
                    placeholder="+91 99818 07309"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}
                  />
                  {scannerState?.pairingCode ? (
                    <div style={{ display: "grid", gap: 8, placeItems: "center", textAlign: "center", marginTop: 4 }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Enter this 8-digit code in WhatsApp:</span>
                      <div
                        style={{
                          padding: "10px 18px",
                          background: "#020617",
                          border: "2px solid #10b981",
                          borderRadius: 10,
                          letterSpacing: 6,
                          fontSize: "1.3rem",
                          fontWeight: 800,
                          color: "#10b981",
                          fontFamily: "monospace",
                        }}
                      >
                        {scannerState.pairingCode}
                      </div>
                      <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)", lineHeight: 1.4 }}>
                        1. Open WhatsApp Business &gt; Linked Devices &gt; Link a device<br />
                        2. Tap <strong>Link with phone number instead</strong> at the bottom<br />
                        3. Enter the code above
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busyAction === "request_pairing_code" || !waConnectedPhoneInput.trim()}
                      onClick={handleRequestPairingCode}
                      style={{ fontSize: 12, padding: "8px 14px", background: "#10b981", borderColor: "#10b981", color: "#fff", width: "100%" }}
                    >
                      {busyAction === "request_pairing_code" ? "Generating Pairing Code..." : "Get 8-Digit Pairing Code"}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8, placeItems: "center" }}>
                  {scannerState?.qrCodeDataUrl ? (
                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                        padding: 10,
                        background: "#ffffff",
                        borderRadius: 14,
                        boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
                        border: "2px solid #10b981",
                      }}
                    >
                      <img
                        src={scannerState.qrCodeDataUrl}
                        alt="Real WhatsApp Multi-Device QR Code"
                        width={184}
                        height={184}
                        style={{ display: "block", borderRadius: 6, imageRendering: "pixelated" }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: 14,
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "rgba(15, 23, 42, 0.9)",
                          color: "#10b981",
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          border: "1px solid rgba(16, 185, 129, 0.4)",
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                        LIVE QR READY
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 184,
                        height: 184,
                        borderRadius: 14,
                        background: "rgba(15, 23, 42, 0.4)",
                        border: "1px dashed rgba(16, 185, 129, 0.4)",
                        display: "grid",
                        placeItems: "center",
                        padding: 14,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ display: "grid", gap: 8, placeItems: "center" }}>
                        <RefreshCw size={24} color="#10b981" />
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>Connecting to WhatsApp Web...</span>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={handleGenerateQr}
                          style={{ fontSize: 11, padding: "4px 10px" }}
                        >
                          Generate Live QR
                        </button>
                      </div>
                    </div>
                  )}
                  <span style={{ fontSize: "0.74rem", color: "var(--muted)", maxWidth: 280, lineHeight: 1.35 }}>
                    Open {waAccountType === "WHATSAPP_BUSINESS" ? "WhatsApp Business" : "WhatsApp"} &gt; Settings &gt; Linked Devices &gt; Link a device &gt; Scan this QR.
                  </span>
                </div>
              )}

              {waPairingMethod !== "PAIRING_CODE" ? (
                <div style={{ width: "100%", maxWidth: 320, textAlign: "left" }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "var(--muted)" }}>
                    WhatsApp Phone Number
                  </label>
                  <input
                    type="text"
                    value={waConnectedPhoneInput}
                    onChange={(e) => setWaConnectedPhoneInput(e.target.value)}
                    placeholder="+91 99818 07309"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}
                  />
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busyAction === "generate_qr"}
                  onClick={handleGenerateQr}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                >
                  <RefreshCw size={14} /> Refresh QR
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={busyAction === "complete_scan"}
                  onClick={handleRunWhatsAppScanAndScrape}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    background: waSyncMode === "FULL_INBOX_SYNC" ? "#ff6b2f" : "#10b981",
                    borderColor: waSyncMode === "FULL_INBOX_SYNC" ? "#ff6b2f" : "#10b981",
                    color: "#fff",
                  }}
                >
                  <Sparkles size={15} />
                  {busyAction === "complete_scan"
                    ? "Syncing WhatsApp..."
                    : waSyncMode === "FULL_INBOX_SYNC"
                      ? "Scan & Sync Chats + Contacts to Inbox"
                      : "Scan & Scrape Contact Numbers Only"}
                </button>
              </div>

              {scannerState?.status === "CONNECTED" ? (
                <div
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    fontSize: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <span>
                    Connected: <strong>{scannerState.connectedPhone}</strong> • Scraped:{" "}
                    <strong>{scannerState.stats?.totalScrapedContacts || 0} contacts</strong> • Inbox Threads:{" "}
                    <strong>{scannerState.stats?.totalSyncedChatThreads || 0}</strong>
                  </span>
                  {onOpenMultiChannelChat && (scannerState.stats?.totalSyncedChatThreads || 0) > 0 ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onOpenMultiChannelChat()}
                      style={{ padding: "4px 10px", fontSize: 11 }}
                    >
                      View in Inbox →
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* =========================================================================
          DRAWER 2: GOOGLE SHEETS, EXCEL (.XLSX/.XLS) & CSV BULK IMPORTER
      ========================================================================= */}
      {activeDrawer === "sheets_excel" ? (
        <div
          className="crm-panel"
          style={{
            padding: 22,
            borderRadius: 18,
            border: "2px solid rgba(59, 130, 246, 0.45)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "rgba(59, 130, 246, 0.15)",
                  color: "#3b82f6",
                }}
              >
                Spreadsheet & Bulk Phone Number Importer
              </span>
              <h3 style={{ margin: "6px 0 4px", fontSize: "1.18rem", fontWeight: 800 }}>
                Import Contacts from Excel (.xlsx / .xls), CSV, or Google Sheets
              </h3>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--muted)" }}>
                Automatically normalizes phone numbers to E.164 (<code>+91...</code>), deduplicates existing contacts, and syncs to Contacts + CRM Pipeline.
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setActiveDrawer(null)}
              style={{ padding: "6px 10px" }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button
              type="button"
              className={sheetsTab === "excel_file" ? "primary-button" : "secondary-button"}
              onClick={() => setSheetsTab("excel_file")}
              style={{ fontSize: 13 }}
            >
              <FileSpreadsheet size={15} style={{ marginRight: 6 }} />
              Excel (.xlsx / .xls) or CSV File
            </button>
            <button
              type="button"
              className={sheetsTab === "google_sheets" ? "primary-button" : "secondary-button"}
              onClick={() => setSheetsTab("google_sheets")}
              style={{ fontSize: 13 }}
            >
              <Globe size={15} style={{ marginRight: 6 }} />
              Google Sheets Link
            </button>
            <button
              type="button"
              className={sheetsTab === "raw_paste" ? "primary-button" : "secondary-button"}
              onClick={() => setSheetsTab("raw_paste")}
              style={{ fontSize: 13 }}
            >
              <Upload size={15} style={{ marginRight: 6 }} />
              Quick Paste Phone Numbers / CSV Rows
            </button>
          </div>

          <form onSubmit={handleImportFileOrGoogleSheet} style={{ display: "grid", gap: 14 }}>
            {sheetsTab === "excel_file" ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: 24,
                  borderRadius: 14,
                  border: "2px dashed var(--closer-line, rgba(148, 163, 184, 0.4))",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "var(--surface-strong, rgba(15, 23, 42, 0.35))",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv"
                  style={{ display: "none" }}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                <FileSpreadsheet size={28} color="#ff6b2f" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {selectedFile
                    ? `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`
                    : "Click to select an Excel (.xlsx, .xls) or .csv contact sheet"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 4 }}>
                  Supported headers: <code>Name</code>, <code>Phone</code> / <code>Mobile</code> / <code>WhatsApp</code>, <code>Email</code>, <code>Service</code>, <code>Tags</code>
                </div>
              </div>
            ) : null}

            {sheetsTab === "google_sheets" ? (
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Google Sheets Share URL (Set share access to &ldquo;Anyone with the link&rdquo;)
                </label>
                <input
                  type="url"
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0"
                  style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13 }}
                />
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Tip: Want to import immediately without setting up a public link? Switch to <strong>Quick Paste Phone Numbers / CSV Rows</strong> to paste copied Google Sheet rows directly.
                </div>
              </div>
            ) : null}

            {sheetsTab === "raw_paste" ? (
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Paste Rows from Excel / Google Sheets or Raw Phone Numbers (One per line: <code>Name, Phone, Email</code>)
                </label>
                <textarea
                  rows={5}
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  style={{ padding: 12, borderRadius: 10, fontFamily: "monospace", fontSize: 12.5 }}
                />
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="submit"
                className="primary-button crm-distribute-button"
                disabled={busyAction === "import_sheet_file"}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Upload size={15} />
                {busyAction === "import_sheet_file" ? "Importing Contacts..." : "Import Contacts Now"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* =========================================================================
          DRAWER 3: EMAIL INBOX & ENQUIRY LEAD SYNC (GMAIL, ZOHO, GODADDY, SMTP)
      ========================================================================= */}
      {activeDrawer === "email_inbox" ? (
        <div
          className="crm-panel"
          style={{
            padding: 22,
            borderRadius: 18,
            border: "2px solid rgba(139, 92, 246, 0.45)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "rgba(139, 92, 246, 0.15)",
                  color: "#8b5cf6",
                }}
              >
                Multi-Provider Email CRM • Gmail • Zoho Mail • GoDaddy • Custom IMAP/SMTP
              </span>
              <h3 style={{ margin: "6px 0 4px", fontSize: "1.18rem", fontWeight: 800 }}>
                Connect Email Inbox & Auto-Capture Enquiry Leads + Phone Numbers
              </h3>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--muted)" }}>
                Connect <strong>Gmail</strong>, <strong>Zoho Mail</strong>, <strong>GoDaddy Mail</strong>, or <strong>Custom SMTP/IMAP</strong>. Our 5-stage parser unwraps <code>Reply-To</code> webforms, extracts phone numbers from email bodies, creates CRM Contacts, and routes threads to Multi-Channel Chat.
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setActiveDrawer(null)}
              style={{ padding: "6px 10px" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* 6 Provider Preset Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 10,
              marginBottom: 18,
            }}
          >
            {EMAIL_PRESET_CARDS.map((card) => {
              const active = selectedEmailPreset === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleSelectEmailPreset(card.id)}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    textAlign: "left",
                    cursor: "pointer",
                    background: active
                      ? "rgba(139, 92, 246, 0.16)"
                      : "var(--surface-strong, rgba(15, 23, 42, 0.45))",
                    border: active
                      ? `2px solid ${card.accent}`
                      : "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <strong style={{ fontSize: "0.84rem" }}>{card.name}</strong>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: card.accent, marginBottom: 4 }}>
                    {card.badge}
                  </div>
                  <div style={{ fontSize: "0.73rem", color: "var(--muted)", lineHeight: 1.35 }}>
                    {card.hint}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 18,
            }}
          >
            {/* Left: Connect IMAP/SMTP Account Form */}
            <form
              onSubmit={handleConnectEmailAccount}
              style={{
                padding: 16,
                borderRadius: 14,
                background: "var(--surface-strong, rgba(15, 23, 42, 0.45))",
                border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                display: "grid",
                gap: 12,
              }}
            >
              <strong style={{ fontSize: "0.92rem" }}>
                Configure {EMAIL_PRESET_CARDS.find((c) => c.id === selectedEmailPreset)?.name}
              </strong>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={emailAddressInput}
                    onChange={(e) => setEmailAddressInput(e.target.value)}
                    placeholder="sales@yourcompany.com"
                    required
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    App Password / SMTP Password
                  </label>
                  <input
                    type="password"
                    value={emailPasswordInput}
                    onChange={(e) => setEmailPasswordInput(e.target.value)}
                    placeholder="••••••••••••••••"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    IMAP Host
                  </label>
                  <input
                    type="text"
                    value={customImapHost}
                    onChange={(e) => setCustomImapHost(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 8, fontSize: 12, fontFamily: "monospace" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    Port
                  </label>
                  <input
                    type="number"
                    value={customImapPort}
                    onChange={(e) => setCustomImapPort(Number(e.target.value))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 8, fontSize: 12, fontFamily: "monospace" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={customSmtpHost}
                    onChange={(e) => setCustomSmtpHost(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 8, fontSize: 12, fontFamily: "monospace" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    Port
                  </label>
                  <input
                    type="number"
                    value={customSmtpPort}
                    onChange={(e) => setCustomSmtpPort(Number(e.target.value))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 8, fontSize: 12, fontFamily: "monospace" }}
                  />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={routeEmailsToInbox}
                  onChange={(e) => setRouteEmailsToInbox(e.target.checked)}
                />
                <span>
                  Auto-extract phone numbers (`+91...`) from email bodies & route enquiries to <strong>Live Multi-Channel Chat</strong>
                </span>
              </label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={busyAction === "connect_email"}
                  style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <ShieldCheck size={15} />
                  {busyAction === "connect_email" ? "Verifying TLS & Connecting..." : "Connect Email Account"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busyAction === "sync_email_enquiries"}
                  onClick={handleSyncEmailEnquiries}
                  style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <RefreshCw size={14} />
                  {busyAction === "sync_email_enquiries"
                    ? "Extracting Leads..."
                    : "Sync Enquiry Leads Now"}
                </button>
              </div>

              {emailAccounts.length > 0 ? (
                <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                    CONNECTED MAILBOXES ({emailAccounts.length})
                  </span>
                  {emailAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        fontSize: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>
                        <strong>{acc.emailAddress}</strong> ({acc.providerLabel})
                      </span>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>
                        {acc.totalEnquiriesCaptured} leads synced
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </form>

            {/* Right: Live Enquiry Email Lead & Phone Extractor Tester */}
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: "var(--surface-strong, rgba(15, 23, 42, 0.45))",
                border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                display: "grid",
                gap: 10,
              }}
            >
              <strong style={{ fontSize: "0.92rem" }}>
                Live Enquiry Email Parser (Unwraps Webforms & Extracts Phone Numbers)
              </strong>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                    From Header
                  </label>
                  <input
                    type="text"
                    value={rawEmailTestFrom}
                    onChange={(e) => setRawEmailTestFrom(e.target.value)}
                    style={{ width: "100%", padding: "6px 9px", borderRadius: 8, fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                    Reply-To (Real Customer Email)
                  </label>
                  <input
                    type="text"
                    value={rawEmailTestReplyTo}
                    onChange={(e) => setRawEmailTestReplyTo(e.target.value)}
                    style={{ width: "100%", padding: "6px 9px", borderRadius: 8, fontSize: 12 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                  Subject Line
                </label>
                <input
                  type="text"
                  value={rawEmailTestSubject}
                  onChange={(e) => setRawEmailTestSubject(e.target.value)}
                  style={{ width: "100%", padding: "6px 9px", borderRadius: 8, fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                  Email Body (Phone number & name are automatically extracted)
                </label>
                <textarea
                  rows={4}
                  value={rawEmailTestBody}
                  onChange={(e) => setRawEmailTestBody(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 8, fontSize: 12, fontFamily: "monospace" }}
                />
              </div>
              <button
                type="button"
                className="primary-button"
                disabled={busyAction === "parse_custom_email"}
                onClick={handleParseCustomEmail}
                style={{ justifySelf: "start", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Send size={14} />
                {busyAction === "parse_custom_email"
                  ? "Parsing & Creating Contact..."
                  : "Parse Enquiry Email → Create Contact & Inbox Thread"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* =========================================================================
          DRAWER 4: MANUAL ADD CONTACT
      ========================================================================= */}
      {activeDrawer === "manual_add" ? (
        <div className="crm-panel" style={{ padding: 20, borderRadius: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Add New Contact to Unified Directory</h3>
            <button type="button" className="secondary-button" onClick={() => setActiveDrawer(null)}>
              <X size={15} />
            </button>
          </div>
          <form
            onSubmit={handleAddManualContact}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}
          >
            <input
              type="text"
              placeholder="Full Name *"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              required
              style={{ padding: "9px 12px", borderRadius: 8 }}
            />
            <input
              type="tel"
              placeholder="Phone (+91 98200 00000) *"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              required
              style={{ padding: "9px 12px", borderRadius: 8 }}
            />
            <input
              type="email"
              placeholder="Email Address"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8 }}
            />
            <input
              type="text"
              placeholder="Tags (comma separated)"
              value={manualTags}
              onChange={(e) => setManualTags(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8 }}
            />
            <input
              type="text"
              placeholder="Notes / Enquiry Summary"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8 }}
            />
            <button type="submit" className="primary-button" disabled={busyAction === "manual_add"}>
              {busyAction === "manual_add" ? "Saving..." : "Save Contact"}
            </button>
          </form>
        </div>
      ) : null}

      {editingContact ? (
        <section className="crm-panel crm-contact-editor" aria-label="Edit contact" style={{ padding: 20, borderRadius: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <span className="crm-eyebrow crm-eyebrow-primary">Admin contact controls</span>
              <h3 style={{ margin: "5px 0 0", fontSize: "1.05rem" }}>Edit contact</h3>
            </div>
            <button type="button" className="secondary-button" onClick={() => setEditingContact(null)} aria-label="Close contact editor"><X size={15} /></button>
          </div>
          <form onSubmit={handleUpdateContact} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <label className="sales-form-field"><span>Name</span><input value={contactDraft.name} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} required /></label>
            <label className="sales-form-field"><span>Phone</span><input value={contactDraft.phone} onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })} required /></label>
            <label className="sales-form-field"><span>Email</span><input type="email" value={contactDraft.email} onChange={(event) => setContactDraft({ ...contactDraft, email: event.target.value })} /></label>
            <label className="sales-form-field"><span>Tags</span><input value={contactDraft.tags} onChange={(event) => setContactDraft({ ...contactDraft, tags: event.target.value })} /></label>
            <label className="sales-form-field" style={{ gridColumn: "1 / -1" }}><span>Notes</span><textarea rows={3} value={contactDraft.notes} onChange={(event) => setContactDraft({ ...contactDraft, notes: event.target.value })} /></label>
            <button type="submit" className="primary-button" disabled={busyAction === "edit_contact"}>{busyAction === "edit_contact" ? "Updating..." : "Update contact"}</button>
          </form>
        </section>
      ) : null}

      {!isLeadImportView ? (
      <>
      {/* =========================================================================
          UNIFIED CONTACTS DIRECTORY TABLE & SOURCE FILTER PILLS
      ========================================================================= */}
      <div className="crm-panel crm-directory-panel" style={{ padding: 20, borderRadius: 18 }}>
        {/* Filter Pills & Search */}
        <div
          className="crm-directory-toolbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div className="crm-source-tabs">
            {SOURCE_FILTER_TABS.map((tab) => {
              const active = activeFilter === tab.id;
              const count = counts[tab.id] ?? 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`crm-source-tab${active ? " is-active" : ""}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: active
                      ? "1px solid #ff6b2f"
                      : "1px solid var(--closer-line, rgba(148, 163, 184, 0.28))",
                    background: active ? "#ff6b2f" : "transparent",
                    color: active ? "#ffffff" : "inherit",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    className="crm-source-tab-count"
                    style={{
                      padding: "1px 6px",
                      borderRadius: 999,
                      fontSize: 11,
                      background: active ? "rgba(255,255,255,0.22)" : "rgba(148, 163, 184, 0.16)",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="crm-directory-actions">
            <div className="crm-search-field">
              <Search
                size={15}
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, +91 phone, email, tag..."
                className="crm-directory-search"
                style={{ padding: "7px 12px 7px 32px", borderRadius: 999, fontSize: 12.5, minWidth: 250 }}
              />
            </div>
            {canManageContacts && selectedIds.size > 0 ? (
              <button
                type="button"
                className="secondary-button"
                onClick={handleBulkDelete}
                style={{ color: "#ef4444", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}
              >
                <Trash2 size={14} /> Delete ({selectedIds.size})
              </button>
            ) : null}

            {/* Auto-Distribute to Sales Team (Round-Robin) */}
            <button
              type="button"
              className="secondary-button"
              onClick={handleAutoDistribute}
              disabled={distributing || (selectedIds.size === 0 && !pendingImportBatch?.poolItemIds.length)}
              title="Distribute selected contacts across active sales reps"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.35)",
              }}
            >
              <Users size={14} />
              {distributing
                ? "Distributing..."
                : selectedIds.size > 0
                  ? `Auto-Distribute (${selectedIds.size})`
                  : `Distribute import batch (${pendingImportBatch?.poolItemIds.length ?? 0})`}
            </button>

            {/* Send to WhatsApp Bulk Campaign */}
            {onOpenBulkMarketing ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => onOpenBulkMarketing(selectedIds.size > 0 ? Array.from(selectedIds) : undefined)}
                title="Send selected contacts to WhatsApp Bulk Marketing Broadcast"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "7px 12px",
                }}
              >
                <Send size={13} />
                Bulk Campaign {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </button>
            ) : null}
          </div>
        </div>

        {/* Distribution Feedback Banner */}
        {distributeSuccess ? (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(16, 185, 129, 0.14)",
              border: "1px solid rgba(16, 185, 129, 0.38)",
              color: "#10b981",
              fontSize: 12.5,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} />
              <span>{distributeSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setDistributeSuccess(null)}
              style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {/* Contacts Table */}
        <div className="crm-table-scroll-region">
          <div className="crm-table-scroll-toolbar">
            <span className="crm-table-scroll-hint">Scroll horizontally to view all contact details</span>
            <div className="crm-table-scroll-controls" role="group" aria-label="Contacts table horizontal scroll controls">
              <button
                type="button"
                className="crm-table-scroll-button"
                onClick={() => scrollContactsTable(-280)}
                disabled={contactsTableScroll.left <= 0}
                aria-label="Scroll contacts table left"
                title="Show columns to the left"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <input
                type="range"
                className="crm-table-scroll-slider"
                min={0}
                max={Math.max(1, contactsTableScroll.max)}
                step={1}
                value={Math.min(contactsTableScroll.left, contactsTableScroll.max)}
                onChange={(event) => {
                  const nextLeft = Number(event.target.value);
                  if (contactsTableShellRef.current) {
                    contactsTableShellRef.current.scrollLeft = nextLeft;
                  }
                  setContactsTableScroll((previous) => ({ ...previous, left: nextLeft }));
                }}
                disabled={contactsTableScroll.max === 0}
                aria-label="Horizontal contacts table scroll position"
                aria-valuetext={
                  contactsTableScroll.max === 0
                    ? "All columns visible"
                    : `${Math.round((contactsTableScroll.left / contactsTableScroll.max) * 100)}% across table`
                }
              />
              <button
                type="button"
                className="crm-table-scroll-button"
                onClick={() => scrollContactsTable(280)}
                disabled={contactsTableScroll.left >= contactsTableScroll.max}
                aria-label="Scroll contacts table right"
                title="Show columns to the right"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            ref={contactsTableShellRef}
            className="crm-table-shell"
            onScroll={syncContactsTableScroll}
            tabIndex={0}
            aria-label="Contacts table. Use the horizontal scrollbar or slider to view all columns."
          >
          <table className="crm-data-table crm-contacts-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr
                className="crm-table-header"
                style={{
                  borderBottom: "1px solid var(--closer-line, rgba(148, 163, 184, 0.25))",
                  textAlign: "left",
                  color: "var(--muted)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <th style={{ padding: "10px 8px", width: 32 }}>
                  <input
                    type="checkbox"
                    checked={filteredContacts.length > 0 && selectedIds.size === filteredContacts.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th style={{ padding: "10px 8px" }}>Contact Name</th>
                <th style={{ padding: "10px 8px" }}>Phone Number (E.164)</th>
                <th style={{ padding: "10px 8px" }}>Email</th>
                <th style={{ padding: "10px 8px" }}>Source Channel</th>
                <th style={{ padding: "10px 8px" }}>Stage & Tags</th>
                <th style={{ padding: "10px 8px" }}>Assigned Rep</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>Quick Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>
                    Loading unified contacts directory...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                    No contacts match this filter yet. Use the{" "}
                    <strong>WhatsApp QR Scanner</strong>, <strong>Google Sheets</strong>,{" "}
                    <strong>Excel/CSV</strong>, or <strong>Email Enquiry Sync</strong> cards above to import contacts!
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => {
                  const isSelected = selectedIds.has(contact.id);
                  const cleanDigits = (contact.phone || "").replace(/\D/g, "");
                  return (
                    <tr
                      key={contact.id}
                      className={isSelected ? "is-selected" : undefined}
                      style={{
                        borderBottom: "1px solid var(--closer-line, rgba(148, 163, 184, 0.16))",
                        background: isSelected ? "rgba(255, 107, 47, 0.06)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "11px 8px" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const next = new Set(selectedIds);
                            if (next.has(contact.id)) next.delete(contact.id);
                            else next.add(contact.id);
                            setSelectedIds(next);
                          }}
                        />
                      </td>
                      <td className="crm-contact-name-cell" style={{ padding: "11px 8px", fontWeight: 700 }}>
                        <div className="crm-contact-name-wrap">
                          <span className="crm-contact-avatar" aria-hidden="true">
                            {(contact.name || "?").trim().slice(0, 1).toUpperCase()}
                          </span>
                          <span className="crm-contact-name">{contact.name}</span>
                          {contact.hasInboxThread ? (
                            <span
                              title="Active thread in Live Multi-Channel Chat"
                              className="crm-inline-status"
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: "rgba(16, 185, 129, 0.16)",
                                color: "#10b981",
                                fontWeight: 700,
                              }}
                            >
                              Inbox Synced
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td style={{ padding: "11px 8px", fontFamily: "monospace", fontWeight: 600 }}>
                        {contact.phone || "—"}
                      </td>
                      <td style={{ padding: "11px 8px", color: "var(--muted)" }}>
                        {contact.email || "—"}
                      </td>
                      <td style={{ padding: "11px 8px" }}>
                        <span
                          className={`crm-source-badge crm-source-${contact.sourceCategory.toLowerCase()}`}
                        >
                          <ContactSourceMark source={contact.sourceCategory} />
                          {contact.sourceLabel}
                        </span>
                      </td>
                      <td style={{ padding: "11px 8px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                          <span
                            className="crm-stage-badge"
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: 6,
                              background: "rgba(148, 163, 184, 0.15)",
                            }}
                          >
                            {contact.stage}
                          </span>
                          {contact.tags.slice(0, 2).map((tag) => (
                            <span
                              className="crm-tag-badge"
                              key={tag}
                              style={{
                                fontSize: 10.5,
                                padding: "2px 7px",
                                borderRadius: 6,
                                background: "rgba(255, 107, 47, 0.1)",
                                color: "#ff6b2f",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "11px 8px", fontSize: 12.5 }}>{contact.assignedAgentName}</td>
                      <td style={{ padding: "11px 8px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          {canManageContacts ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => openContactEditor(contact)}
                              title="Edit contact"
                              style={{ padding: "5px 9px", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                          ) : null}
                          {canManageContacts ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => void handleDeleteContact(contact)}
                              title="Delete contact"
                              disabled={busyAction === `delete_contact_${contact.id}`}
                              style={{ padding: "5px 9px", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4, color: "#ef4444" }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          ) : null}
                          {onOpenMultiChannelChat ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => onOpenMultiChannelChat(contact.conversationId)}
                              title="Open in Multi-Channel Chat Inbox"
                              style={{ padding: "5px 9px", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <Inbox size={13} /> Inbox Chat
                            </button>
                          ) : null}
                          {cleanDigits ? (
                            <a
                              href={`https://wa.me/${cleanDigits}`}
                              target="_blank"
                              rel="noreferrer"
                              className="secondary-button"
                              style={{ padding: "5px 9px", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                            >
                              <MessageCircle size={13} /> WA
                            </a>
                          ) : null}
                          {cleanDigits ? (
                            <a
                              href={`tel:+${cleanDigits}`}
                              className="secondary-button"
                              style={{ padding: "5px 9px", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                            >
                              <PhoneCall size={13} /> Call
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      </>
      ) : null}

      {/* Parsed Email Enquiries Preview (when any exist) */}
      {parsedEnquiries.length > 0 ? (
        <div className="crm-panel" style={{ padding: 18, borderRadius: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <strong style={{ fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} color="#10b981" />
              Recent Email Enquiries Parsed into Contacts & Inbox ({parsedEnquiries.length})
            </strong>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
            {parsedEnquiries.slice(0, 6).map((enq) => (
              <div
                key={enq.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "var(--surface-strong, rgba(15, 23, 42, 0.45))",
                  border: "1px solid var(--closer-line, rgba(148, 163, 184, 0.22))",
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{enq.subject}</div>
                <div style={{ color: "var(--muted)", marginBottom: 4 }}>
                  Lead: <strong>{enq.resolvedCustomerName}</strong> ({enq.resolvedCustomerEmail})
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", color: "#10b981", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Phone size={12} /> {enq.extractedPhone || "Email-only"}
                  </span>
                  <span style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600 }}>
                    {enq.provider} • Synced
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
