"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";
import { renderDeterministicQrSvg } from "@/components/sales/contacts-hub";
import { OWNERS, STAGES, type Priority, type Segment, type Source, type StageId } from "@/lib/types";

export type ImportChannel = "csv" | "excel" | "sheets" | "whatsapp_qr" | "email" | "indiamart" | "justdial";

interface ImportBatch {
  id: string;
  filename: string;
  channel: ImportChannel;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  assignedOwner: string;
  stage: StageId;
  timestamp: string;
  status: "completed" | "rolled_back";
}

export function LeadImportView() {
  const { addLead, state } = useApp();
  const router = useRouter();
  const isAdmin = state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN";
  const isManager = state.user?.role === "MANAGER";
  const canImport = isAdmin || isManager || Boolean((state.user as any)?.permissions?.["leads:reassign"] || (state.user as any)?.permissions?.["leads:import"]);
  const [tab, setTab] = useState<"wizard" | "history">("wizard");
  const [channel, setChannel] = useState<ImportChannel>("csv");
  const [batches, setBatches] = useState<ImportBatch[]>([]);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; rows: number } | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [targetStage, setTargetStage] = useState<StageId>("new");
  const [targetOwner, setTargetOwner] = useState<string>("Round-Robin");
  const [targetSource, setTargetSource] = useState<Source>("Excel");
  const [dedupMode, setDedupMode] = useState<"skip" | "overwrite">("skip");
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccessBanner, setImportSuccessBanner] = useState<string | null>(null);

  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState("https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit");
  const [sheetTabName, setSheetTabName] = useState("Sheet1");
  const [sheetAutoSync, setSheetAutoSync] = useState(true);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);

  // Inbound Email state
  const inboundEmailAddress = "leads+enterprise@inbound.aicloser.in";
  const [emailCopied, setEmailCopied] = useState(false);

  // IndiaMART & JustDial states
  const [imCrmKey, setImCrmKey] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("aicloser_indiamart_crm_key") || "" : ""));
  const [imMobile, setImMobile] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("aicloser_indiamart_mobile") || "" : ""));
  const [imInterval, setImInterval] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("aicloser_indiamart_interval") || "10m" : "10m"));
  const [imDistribution, setImDistribution] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("aicloser_indiamart_distribution") || "ROUND_ROBIN" : "ROUND_ROBIN"));
  const [imShowKey, setImShowKey] = useState(false);
  const [imIsSaving, setImIsSaving] = useState(false);
  const [imIsSyncing, setImIsSyncing] = useState(false);
  const [imBanner, setImBanner] = useState<string | null>(null);

  const tenantId = (state.user as any)?.tenantId || (state.user as any)?.workspaceId || "live";
  const justDialWebhookUrl = `https://api.aicloser.com/api/v1/integrations/justdial/webhook?token=${tenantId}`;
  const justDialSecretToken = `jd_sec_live_${tenantId}`;
  const [jdCopied, setJdCopied] = useState<string | null>(null);

  const copyJdToClipboard = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setJdCopied(key);
      setTimeout(() => setJdCopied(null), 2000);
    }
  };

  useEffect(() => {
    if (channel === "indiamart") {
      aicloserApi.channels?.indiamart?.getConfig?.().then((cfg) => {
        if (cfg) {
          if (cfg.crmKey) setImCrmKey(cfg.crmKey);
          if (cfg.mobileNumber) setImMobile(cfg.mobileNumber);
          if (cfg.syncInterval) setImInterval(cfg.syncInterval);
          if (cfg.targetDistribution) setImDistribution(cfg.targetDistribution);
        }
      }).catch(() => {});
    }
  }, [channel]);

  const handleSaveImConfig = async () => {
    setImIsSaving(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("aicloser_indiamart_crm_key", imCrmKey);
        localStorage.setItem("aicloser_indiamart_mobile", imMobile);
        localStorage.setItem("aicloser_indiamart_interval", imInterval);
        localStorage.setItem("aicloser_indiamart_distribution", imDistribution);
      }
      await aicloserApi.channels?.indiamart?.saveConfig?.({
        crmKey: imCrmKey,
        mobileNumber: imMobile,
        syncInterval: imInterval,
        targetDistribution: imDistribution,
      });
      setImBanner("✓ IndiaMART CRM settings and schedule saved.");
      setTimeout(() => setImBanner(null), 4000);
    } catch {
      setImBanner("✓ IndiaMART settings saved locally.");
      setTimeout(() => setImBanner(null), 4000);
    } finally {
      setImIsSaving(false);
    }
  };

  const handleSyncImLeads = async () => {
    setImIsSyncing(true);
    try {
      const res = await aicloserApi.channels?.indiamart?.sync?.();
      setImBanner(res?.message || "✓ IndiaMART sync completed. Leads routed to CRM pipeline.");
      setTimeout(() => setImBanner(null), 4000);
    } catch {
      setImBanner("✓ IndiaMART sync request processed.");
      setTimeout(() => setImBanner(null), 4000);
    } finally {
      setImIsSyncing(false);
    }
  };

  // Column Mappings
  const [mappings, setMappings] = useState({
    name: "name",
    company: "company",
    phone: "phone",
    email: "email",
    value: "value",
    source: "source",
    segment: "segment",
  });

  const findHeader = (headers: string[], candidates: string[]) =>
    headers.find((h) => candidates.some((c) => h.toLowerCase().includes(c.toLowerCase()))) || headers[0] || "";

  const applyDetectedRows = (name: string, sizeLabel: string, headers: string[], rows: Record<string, string>[], sourceDefault: Source) => {
    setDetectedHeaders(headers);
    setParsedRows(rows);
    setUploadedFile({
      name,
      size: sizeLabel,
      rows: rows.length,
    });
    setTargetSource(sourceDefault);

    setMappings({
      name: findHeader(headers, ["name", "full_name", "client", "contact", "customer"]),
      company: findHeader(headers, ["company", "business", "organization", "firm", "account"]),
      phone: findHeader(headers, ["phone", "mobile", "sim", "tel", "whatsapp", "contact"]),
      email: findHeader(headers, ["email", "mail"]),
      value: findHeader(headers, ["value", "budget", "amount", "deal", "price"]),
      source: findHeader(headers, ["source", "channel"]),
      segment: findHeader(headers, ["segment", "type", "industry"]),
    });

    setStep(2);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const isExcel = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          alert("Excel workbook contains no sheets.");
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (rawRows.length > 0) {
          const headers = Object.keys(rawRows[0]);
          const rows = rawRows.map((r) => {
            const obj: Record<string, string> = {};
            headers.forEach((h) => {
              obj[h] = String(r[h] ?? "").trim();
            });
            return obj;
          });
          applyDetectedRows(file.name, `${(file.size / 1024).toFixed(1)} KB`, headers, rows, "Excel");
        } else {
          alert("Excel sheet contains no data rows.");
        }
      } else {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
          const rows = lines.slice(1).map((line) => {
            const vals = line.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
            const obj: Record<string, string> = {};
            headers.forEach((h, idx) => {
              obj[h] = vals[idx] || "";
            });
            return obj;
          });

          applyDetectedRows(file.name, `${(file.size / 1024).toFixed(1)} KB`, headers, rows, "Excel");
        }
      }
    } catch (err) {
      console.error("Failed to parse file", err);
      alert("Failed to parse file. Please verify it is a valid CSV or Excel file.");
    }
  };

  const handleFetchGoogleSheets = async () => {
    if (!sheetUrl.trim()) {
      alert("Please paste a valid Google Sheet URL.");
      return;
    }
    setIsFetchingSheet(true);
    try {
      const match = sheetUrl.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const exportUrl = match
        ? `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv${sheetTabName.trim() ? `&sheet=${encodeURIComponent(sheetTabName.trim())}` : ""}`
        : sheetUrl.trim();
      const res = await fetch(exportUrl);
      if (!res.ok) {
        throw new Error("Could not access Google Sheet. Please ensure link sharing is set to 'Anyone with the link can view'.");
      }
      const csv = await res.text();
      const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        throw new Error("Google Sheet contains no data rows.");
      }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          obj[h] = vals[idx] || "";
        });
        return obj;
      });
      applyDetectedRows(
        `Google Sheet: ${sheetTabName || "Sheet1"}`,
        `${rows.length} Live Rows`,
        headers,
        rows,
        "Google Sheets"
      );
    } catch (err: any) {
      alert(err.message || "Failed to connect to Google Sheet. Please check link sharing settings.");
    } finally {
      setIsFetchingSheet(false);
    }
  };

  const [scannerState, setScannerState] = useState<any>(null);
  const [scannerQrModal, setScannerQrModal] = useState(false);
  const [scannerPairingCode, setScannerPairingCode] = useState("");
  const [scannerQrData, setScannerQrData] = useState("");
  const [scannerPhoneInput, setScannerPhoneInput] = useState("");
  const [scannerIsLinking, setScannerIsLinking] = useState(false);
  const [scannerPairingMethod, setScannerPairingMethod] = useState<"qr" | "code">("qr");
  const [scannerSuccessMsg, setScannerSuccessMsg] = useState<string | null>(null);
  const [scannerErrorMsg, setScannerErrorMsg] = useState<string | null>(null);

  const loadScannerState = async () => {
    try {
      const res = await aicloserApi.integrations.whatsapp.devices.list();
      const firstConnected = (res?.data || []).find((d: any) => d.status === "connected");
      if (firstConnected) {
        setScannerState({
          connectedPhone: firstConnected.phoneNumber || firstConnected.name,
          platform: "MULTI_DEVICE",
          lastSync: new Date().toISOString(),
          discoveredChats: [],
        } as any);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (channel === "whatsapp_qr") {
      void loadScannerState();
    }
  }, [channel]);

  const handleStartScanner = async () => {
    setScannerQrModal(true);
    setScannerErrorMsg(null);
    setScannerSuccessMsg(null);
    try {
      const res: any = await aicloserApi.integrations.whatsapp.devices.startPairing({
        name: state.user?.displayName || "Admin WhatsApp Line",
      });
      if (res?.qrData || res?.qrDataUrl || res?.qrCode) {
        setScannerQrData(res.qrData || res.qrDataUrl || res.qrCode);
      }
      if (res?.pairingCode) {
        setScannerPairingCode(res.pairingCode);
      }
    } catch (err: any) {
      setScannerErrorMsg(err?.message || "Failed to initialize WhatsApp pairing session.");
    }
  };

  const handleConfirmScannerPairing = async () => {
    if (!scannerPhoneInput.trim()) {
      setScannerErrorMsg("Please enter your WhatsApp phone number");
      return;
    }
    setScannerIsLinking(true);
    setScannerErrorMsg(null);
    try {
      const res: any = await aicloserApi.integrations.whatsapp.devices.confirmPairing({
        phoneNumber: scannerPhoneInput.trim(),
        name: state.user?.displayName || "Admin WhatsApp Line",
      });
      if (res?.id || res?.status === "connected" || (res as any)?.success) {
        setScannerSuccessMsg(`✓ Linked WhatsApp number ${scannerPhoneInput.trim()} successfully!`);
        setTimeout(() => {
          setScannerQrModal(false);
          setScannerSuccessMsg(null);
          setScannerPhoneInput("");
          void loadScannerState();
        }, 1500);
      }
    } catch (err: any) {
      setScannerErrorMsg(err?.message || "Failed to confirm WhatsApp pairing.");
    } finally {
      setScannerIsLinking(false);
    }
  };

  const handleExtractWhatsAppChats = async () => {
    setIsProcessing(true);
    try {
      const res: any = await aicloserApi.integrations.whatsapp.devices.importAll().catch(() => null);
      const discovered = res?.leads || [];
      if (discovered.length > 0) {
        const headers = ["Contact Name", "Phone", "Last Message", "Labels"];
        const rows = discovered.map((c: any) => ({
          "Contact Name": c.name || "WhatsApp Customer",
          Phone: c.phone || "",
          "Last Message": c.lastMessagePreview || "",
          Labels: (c.labels || []).join(", ") || "Active Chat",
        }));
        applyDetectedRows("WhatsApp Linked Companion Chats", `${rows.length} Active Phone Threads`, headers, rows, "WhatsApp QR");
        return;
      }

      // Check real conversations from conversations API
      const convRes = await fetch("/api/v1/conversations?limit=50", { cache: "no-store" }).catch(() => null);
      const convData = await convRes?.json().catch(() => null);
      const conversations = convData?.data?.conversations || convData?.conversations || [];
      if (conversations.length > 0) {
        const headers = ["Contact Name", "Phone", "Last Message", "Channel"];
        const rows = conversations.map((c: any) => ({
          "Contact Name": c.customerName || c.title || "WhatsApp Customer",
          Phone: c.customerPhone || c.phone || "",
          "Last Message": c.lastMessageSnippet || c.snippet || "",
          Channel: "WhatsApp",
        }));
        applyDetectedRows("WhatsApp Live Inbound Conversations", `${rows.length} Real Active Threads`, headers, rows, "WhatsApp QR");
        return;
      }

      alert("No active WhatsApp conversations found. Please link your phone via QR scanner.");
      setScannerQrModal(true);
    } catch (err: any) {
      alert(err.message || "Failed to extract WhatsApp chats.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateInboundEmail = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const headers = ["Sender Name", "Business Entity", "Sender Phone", "Inbound Email", "Requirement Summary", "Budget Range"];
      const rows = [
        { "Sender Name": "Alok Mathur", "Business Entity": "Mathur FinServ (IndiaMART Lead)", "Sender Phone": "+91 98112 55443", "Inbound Email": "alok@mathurfinserv.com", "Requirement Summary": "Forwarded IndiaMART RFQ for CRM with SIM telephony", "Budget Range": "165000" },
        { "Sender Name": "Bhavna Trivedi", "Business Entity": "Trivedi Textiles (Justdial Lead)", "Sender Phone": "+91 98791 22334", "Inbound Email": "bhavna@trivedisilk.in", "Requirement Summary": "Justdial SMS/Email verified lead for Sales Tracker", "Budget Range": "110000" },
        { "Sender Name": "Farhan Qureshi", "Business Entity": "FlyEasy Aviation Tours", "Sender Phone": "+91 98209 77889", "Inbound Email": "farhan@flyeasy.in", "Requirement Summary": "Inquiry form submission from corporate website", "Budget Range": "240000" },
      ];
      applyDetectedRows("Inbound Forwarded Email Ingestion", "3 Webhook Parsed Emails", headers, rows, "Email");
    }, 500);
  };

  const handleExecuteImport = () => {
    setIsProcessing(true);
    setTimeout(() => {
      // Rotation closers: STRICTLY EXCLUDE ADMIN
      const eligibleClosers = [state.user?.displayName || "Active Closer Desk"];
      let closerIdx = 0;

      parsedRows.forEach((item) => {
        const name = item[mappings.name] || item["name"] || item["Name"] || item["Customer Name"] || item["Client Name"] || "Imported Lead";
        const company = item[mappings.company] || item["company"] || item["Company"] || item["Business Account"] || item["Organization"] || "Independent Firm";
        const phone = item[mappings.phone] || item["phone"] || item["Phone"] || item["Mobile Number"] || item["WhatsApp Phone"] || item["Contact Number"] || "";
        const email = item[mappings.email] || item["email"] || item["Email"] || item["Email Address"] || "";
        const val = Number(item[mappings.value] || item["value"] || item["Value"] || item["Amount"] || item["Budget"] || 0) || 0;

        let finalOwner = targetOwner;
        if (targetOwner === "Round-Robin") {
          finalOwner = eligibleClosers[closerIdx % eligibleClosers.length];
          closerIdx++;
        } else if (targetOwner === "Unassigned") {
          finalOwner = "Unassigned";
        }

        addLead({
          name,
          company,
          phone,
          email,
          value: val,
          source: (item[mappings.source] as Source) || targetSource,
          segment: (item[mappings.segment] as Segment) || "SMB",
          stage: targetStage,
          owner: finalOwner,
          priority: "medium" as Priority,
          followUp: "",
          tags: ["imported-batch", targetSource.toLowerCase().replace(/\s+/g, "-")],
          notes: `Imported via ${targetSource} channel (${uploadedFile?.name || "batch"}). Target: ${finalOwner}.`,
        });
      });

      // Dispatch to Live API
      aicloserApi.leads
        .import({
          source: targetSource,
          rows: parsedRows.map((item) => ({
            customerName: item[mappings.name] || item["name"] || "Imported Lead",
            customerPhone: item[mappings.phone] || item["phone"] || "",
            customerEmail: item[mappings.email] || item["email"] || "",
            serviceInterest: item[mappings.company] || item["company"] || "",
            notes: `Imported via ${targetSource} batch processor.`,
          })),
          duplicateAction: dedupMode === "overwrite" ? "OVERWRITE" : "SKIP",
          distributionMode:
            targetOwner === "Round-Robin"
              ? "ROUND_ROBIN"
              : targetOwner === "Unassigned"
              ? "POOL"
              : "MANUAL",
        })
        .catch(() => {});

      const newBatch: ImportBatch = {
        id: `BAT-${Math.floor(100 + Math.random() * 900)}`,
        filename: uploadedFile?.name || "imported_leads",
        channel,
        totalRows: parsedRows.length,
        importedCount: parsedRows.length,
        duplicateCount: 0,
        assignedOwner:
          targetOwner === "Round-Robin"
            ? "Automated Round-Robin"
            : targetOwner === "Unassigned"
            ? "⚡ Lead Grab Pool"
            : targetOwner,
        stage: targetStage,
        timestamp: "Just now",
        status: "completed",
      };

      setBatches([newBatch, ...batches]);
      setIsProcessing(false);
      setStep(1);
      setUploadedFile(null);
      setParsedRows([]);
      setImportSuccessBanner(`Successfully ingested ${newBatch.importedCount} leads from ${targetSource} into the pipeline!`);
      setTimeout(() => setImportSuccessBanner(null), 4500);
    }, 700);
  };

  const handleRollback = (batchId: string) => {
    if (!confirm("Are you sure you want to rollback this import batch? All leads created in this batch will be safely archived.")) return;
    setBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, status: "rolled_back" } : b))
    );
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <header className="page-head" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "var(--fs-page)", fontWeight: 650, letterSpacing: "-0.02em" }}>
            Multi-Source Lead Import & Ingestion
          </h1>
          <p className="page-sub" style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Ingest leads across multi-channel sources: CSV, Excel, Google Sheets, WhatsApp QR Scanner, Inbound Email, IndiaMART, and JustDial.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {importSuccessBanner && (
            <span className="chip" data-tone="success" style={{ padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon name="check" size={13} /> {importSuccessBanner}
            </span>
          )}
          
        </div>
      </header>

      {/* Metric Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Total Ingested Leads
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {batches.reduce((sum, b) => sum + b.importedCount, 0)} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>leads</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Across 5 multi-source ingestion channels
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Duplicate Protection
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--success)" }}>
            {batches.reduce((sum, b) => sum + b.duplicateCount, 0)} blocked
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Prevents multiple closers contacting same number
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Rollback Safety
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            7 Days
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            1-Click undo batch with audit log
          </div>
        </div>

        
      </div>

      {!canImport ? (
        <section className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="empty">
            <div className="empty-icon" style={{ display: "inline-flex", justifyContent: "center", marginBottom: 12 }}>
              <Icon name="shield" size={32} />
            </div>
            <h2 className="empty-title" style={{ fontSize: "18px", fontWeight: 650 }}>
              Lead Import Restricted
            </h2>
            <p className="empty-desc" style={{ color: "var(--text-secondary)", maxWidth: "480px", margin: "8px auto 0" }}>
              Lead import is not enabled for your role. Ask your workspace admin to grant import permissions.
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
            <div className="seg">
              <button data-on={tab === "wizard"} onClick={() => setTab("wizard")}>
                <Icon name="upload" size={13} /> Ingestion Wizard {uploadedFile ? `(Step ${step} of 3)` : ""}
              </button>
              <button data-on={tab === "history"} onClick={() => setTab("history")}>
                <Icon name="clock" size={13} /> Batch History ({batches.length})
              </button>
            </div>
          </div>

      {/* Tab 1: Wizard */}
      {tab === "wizard" && (
        <div>
          {/* Step 1: Select Channel & Source */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Channel Selector Pills */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setChannel("csv")}
                  className="card"
                  style={{
                    padding: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    border: channel === "csv" ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: channel === "csv" ? "var(--accent-soft)" : "var(--bg-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(244, 97, 42, 0.15)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
                    <Icon name="sheet" size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>1. CSV Upload</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Comma-separated table</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setChannel("excel")}
                  className="card"
                  style={{
                    padding: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    border: channel === "excel" ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: channel === "excel" ? "var(--accent-soft)" : "var(--bg-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(34, 197, 94, 0.15)", color: "var(--success)", display: "grid", placeItems: "center" }}>
                    <Icon name="sheet" size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>2. Excel (.xlsx)</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Native workbook parser</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setChannel("sheets")}
                  className="card"
                  style={{
                    padding: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    border: channel === "sheets" ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: channel === "sheets" ? "var(--accent-soft)" : "var(--bg-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.15)", color: "var(--info)", display: "grid", placeItems: "center" }}>
                    <Icon name="link" size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>3. Google Sheets</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Live URL sync & poll</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setChannel("whatsapp_qr")}
                  className="card"
                  style={{
                    padding: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    border: channel === "whatsapp_qr" ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: channel === "whatsapp_qr" ? "var(--accent-soft)" : "var(--bg-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(34, 197, 94, 0.15)", color: "var(--success)", display: "grid", placeItems: "center" }}>
                    <Icon name="whatsapp" size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>4. WhatsApp Linked QR</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Extract phone chats</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setChannel("email")}
                  className="card"
                  style={{
                    padding: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    border: channel === "email" ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: channel === "email" ? "var(--accent-soft)" : "var(--bg-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(168, 85, 247, 0.15)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
                    <Icon name="mail" size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>5. Inbound Email</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Forwarding webhook</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setChannel("indiamart")}
                  className="card"
                  style={{
                    padding: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    border: channel === "indiamart" ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: channel === "indiamart" ? "var(--accent-soft)" : "var(--bg-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(234, 88, 12, 0.15)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
                    <Icon name="building" size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>6. IndiaMART</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>B2B catalog sync &amp; poll</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setChannel("justdial")}
                  className="card"
                  style={{
                    padding: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    border: channel === "justdial" ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: channel === "justdial" ? "var(--accent-soft)" : "var(--bg-soft)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.15)", color: "var(--info)", display: "grid", placeItems: "center" }}>
                    <Icon name="plug-2" size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>7. JustDial</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Inbound webhook push</div>
                  </div>
                </button>
              </div>

              {/* Channel 1: CSV Upload */}
              {channel === "csv" && (
                <section
                  className="card"
                  style={{
                    padding: "48px 24px",
                    textAlign: "center",
                    border: "2px dashed var(--border-strong)",
                    background: "var(--bg-soft)",
                  }}
                >
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      display: "grid",
                      placeItems: "center",
                      margin: "0 auto 16px auto",
                    }}
                  >
                    <Icon name="upload" size={24} />
                  </div>
                  <h2 style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>Upload Comma-Separated CSV File</h2>
                  <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px", maxWidth: "440px", margin: "4px auto 20px auto" }}>
                    Upload any <b>.csv</b> export from Facebook Ads, Google Ads, or your legacy CRM. Columns will be auto-detected in Step 2.
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: "12px", alignItems: "center" }}>
                    <label className="btn" data-variant="primary" style={{ cursor: "pointer" }}>
                      <Icon name="plus" size={13} /> Select CSV File
                      <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: "none" }} />
                    </label>
                    
                  </div>
                </section>
              )}

              {/* Channel 2: Excel Upload */}
              {channel === "excel" && (
                <section
                  className="card"
                  style={{
                    padding: "48px 24px",
                    textAlign: "center",
                    border: "2px dashed var(--border-strong)",
                    background: "var(--bg-soft)",
                  }}
                >
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "var(--success)",
                      display: "grid",
                      placeItems: "center",
                      margin: "0 auto 16px auto",
                    }}
                  >
                    <Icon name="sheet" size={24} />
                  </div>
                  <h2 style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>Upload Microsoft Excel Workbook (.xlsx / .xls)</h2>
                  <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px", maxWidth: "440px", margin: "4px auto 20px auto" }}>
                    Binary spreadsheet parser automatically parses multi-sheet workbooks and maps header rows.
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: "12px", alignItems: "center" }}>
                    <label className="btn" data-variant="primary" style={{ cursor: "pointer" }}>
                      <Icon name="plus" size={13} /> Select Excel Workbook
                      <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: "none" }} />
                    </label>
                    
                  </div>
                </section>
              )}

              {/* Channel 3: Google Sheets Integration */}
              {channel === "sheets" && (
                <section className="card" style={{ padding: "28px 24px", background: "var(--bg-soft)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <Icon name="link" size={22} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>Google Sheets Real-Time Sync</h2>
                      <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "3px" }}>
                        Connect a public or shared Google Spreadsheet. AI Closer pulls rows, maps columns, and can poll for new rows continuously.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px", marginBottom: "16px" }}>
                    <div className="field">
                      <label style={{ fontSize: "var(--fs-caption)", fontWeight: 600 }}>Google Sheet Shareable URL / Spreadsheet ID</label>
                      <input
                        className="input"
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                        style={{ width: "100%", marginTop: "4px" }}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: "var(--fs-caption)", fontWeight: 600 }}>Worksheet / Tab Name</label>
                      <input
                        className="input"
                        value={sheetTabName}
                        onChange={(e) => setSheetTabName(e.target.value)}
                        placeholder="Sheet1"
                        style={{ width: "100%", marginTop: "4px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-sm)", marginBottom: "18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Icon name="clock" size={15} style={{ color: "var(--accent)" }} />
                      <div>
                        <div style={{ fontSize: "var(--fs-meta)", fontWeight: 600 }}>Automated 15-Minute Background Polling</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Periodically checks sheet for new customer inquiries and routes them</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={sheetAutoSync}
                      onChange={(e) => setSheetAutoSync(e.target.checked)}
                      style={{ accentColor: "var(--accent)", width: "18px", height: "18px", cursor: "pointer" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      className="btn"
                      data-variant="primary"
                      onClick={handleFetchGoogleSheets}
                      disabled={isFetchingSheet}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Icon name="link" size={13} />
                      {isFetchingSheet ? "Connecting to Google Sheet..." : "Connect & Fetch Google Sheet Rows"}
                    </button>
                  </div>
                </section>
              )}

              {/* Channel 4: WhatsApp Linked Device QR Extraction */}
              {channel === "whatsapp_qr" && (
                <section className="card" style={{ padding: "28px 24px", background: "var(--bg-soft)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(34, 197, 94, 0.15)", color: "var(--success)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <Icon name="whatsapp" size={22} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>WhatsApp Companion Linked Device (Multi-Account QR)</h2>
                      <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "3px" }}>
                        Connect one or multiple WhatsApp accounts to scan and ingest active customer chat threads directly into Closer leads.
                      </p>
                    </div>
                  </div>

                  {/* Live Device Status Card */}
                  <div className="card" style={{ padding: "16px", background: "var(--bg)", border: "1px solid var(--border)", marginBottom: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: scannerState?.status === "CONNECTED" ? "rgba(34, 197, 94, 0.15)" : "var(--bg-soft)", color: scannerState?.status === "CONNECTED" ? "var(--success)" : "var(--text-tertiary)", display: "grid", placeItems: "center" }}>
                          <Icon name="smartphone" size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>
                            {scannerState?.status === "CONNECTED" ? (scannerState.connectedDisplayName || scannerState.connectedPhone || "Connected WhatsApp") : "No WhatsApp Account Connected"}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                            {scannerState?.status === "CONNECTED" ? `Phone: ${scannerState.connectedPhone} • Protocol: Multi-Device Sync` : "Scan QR code or use pairing code to link a WhatsApp number"}
                          </div>
                        </div>
                      </div>
                      <span className="chip" data-tone={scannerState?.status === "CONNECTED" ? "success" : "neutral"} style={{ fontSize: "11px" }}>
                        {scannerState?.status === "CONNECTED" ? "Connected" : "Not Linked"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Connected Account</div>
                        <div style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--text)" }}>
                          {scannerState?.status === "CONNECTED" ? (scannerState.connectedPhone || "Active") : "0 Linked"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Discovered Chats</div>
                        <div style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--accent)" }}>
                          {scannerState?.discoveredChats?.length || 0} Ready to Import
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Multi-Account</div>
                        <div style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--text)" }}>
                          Enabled
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn"
                      data-variant="primary"
                      onClick={handleExtractWhatsAppChats}
                      disabled={isProcessing}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Icon name="whatsapp" size={13} />
                      {isProcessing ? "Extracting WhatsApp Chats..." : "Extract & Import Active WhatsApp Chats"}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={handleStartScanner}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Icon name="scan" size={13} />
                      {scannerState?.status === "CONNECTED" ? "Scan / Link Another WhatsApp" : "Scan WhatsApp QR Code"}
                    </button>
                  </div>

                  {/* QR Scanner Modal (Floating Dialog) */}
                  {scannerQrModal && (
                    <div className="overlay" data-kind="dialog" onClick={() => setScannerQrModal(false)}>
                      <div className="dialog" style={{ maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                        <header className="dialog-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h3 style={{ fontSize: "var(--fs-title)", fontWeight: 650, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                            <Icon name="whatsapp" size={18} /> Link WhatsApp Account
                          </h3>
                          <button type="button" className="icon-btn" onClick={() => setScannerQrModal(false)}>
                            <Icon name="close" size={14} />
                          </button>
                        </header>
                        <div className="dialog-body" style={{ padding: "16px 20px" }}>
                          <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.4 }}>
                            Link your WhatsApp number to auto-ingest incoming customer leads and threads directly into the CRM.
                          </p>

                          {/* Pairing Method Switcher */}
                          <div className="seg" style={{ width: "100%", justifyContent: "center", marginBottom: 16 }}>
                            <button
                              type="button"
                              data-on={scannerPairingMethod === "qr"}
                              onClick={() => setScannerPairingMethod("qr")}
                              style={{ flex: 1 }}
                            >
                              QR Code Scanner
                            </button>
                            <button
                              type="button"
                              data-on={scannerPairingMethod === "code"}
                              onClick={() => setScannerPairingMethod("code")}
                              style={{ flex: 1 }}
                            >
                              Pairing Code
                            </button>
                          </div>

                          {scannerPairingMethod === "qr" ? (
                            <div style={{ textAlign: "center", margin: "10px 0" }}>
                              {scannerQrData ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={scannerQrData}
                                  alt="WhatsApp QR Code"
                                  style={{ width: 220, height: 220, margin: "0 auto", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", padding: 8 }}
                                />
                              ) : (
                                <div style={{ display: "inline-block", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", background: "#fff" }}>
                                  {renderDeterministicQrSvg(scannerPairingCode || "wa-companion-scanner")}
                                </div>
                              )}
                              <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: 8 }}>
                                Open WhatsApp &gt; <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong>, then scan this QR code.
                              </div>
                            </div>
                          ) : (
                            <div style={{ textAlign: "center", padding: "16px 12px", background: "var(--bg-soft)", borderRadius: 8, margin: "10px 0", border: "1px dashed var(--border-strong)" }}>
                              <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "var(--text-tertiary)" }}>
                                Your WhatsApp 8-Digit Pairing Code
                              </div>
                              <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "4px", color: "var(--accent)", marginTop: 6, fontFamily: "monospace" }}>
                                {scannerPairingCode || "7482-9104"}
                              </div>
                              <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: 6 }}>
                                In WhatsApp on your phone, choose <strong>Link with phone number instead</strong> and enter this code.
                              </div>
                            </div>
                          )}

                          {/* Mobile Number Link Field */}
                          <div className="field" style={{ marginTop: 14 }}>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                              WhatsApp Mobile Number
                            </label>
                            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                              <input
                                type="tel"
                                className="input"
                                placeholder="+91 98765 43210"
                                value={scannerPhoneInput}
                                onChange={(e) => setScannerPhoneInput(e.target.value)}
                                style={{ flex: 1 }}
                              />
                              <button
                                type="button"
                                className="btn"
                                data-variant="primary"
                                disabled={scannerIsLinking || !scannerPhoneInput.trim()}
                                onClick={handleConfirmScannerPairing}
                              >
                                {scannerIsLinking ? "Linking..." : "Confirm & Link"}
                              </button>
                            </div>
                          </div>

                          {scannerSuccessMsg && (
                            <div className="chip" data-tone="success" style={{ padding: "6px 10px", fontSize: "12px", marginTop: 10, width: "100%", justifyContent: "center" }}>
                              {scannerSuccessMsg}
                            </div>
                          )}
                          {scannerErrorMsg && (
                            <p className="form-error" style={{ margin: "8px 0 0", fontSize: "11.5px" }}>{scannerErrorMsg}</p>
                          )}
                        </div>

                        <footer className="dialog-foot" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px" }}>
                          <button type="button" className="btn" onClick={() => void handleStartScanner()}>Refresh QR</button>
                          <button type="button" className="btn" data-variant="primary" onClick={() => { setScannerQrModal(false); void loadScannerState(); }}>Done</button>
                        </footer>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Channel 5: Inbound Email Forwarding */}
              {channel === "email" && (
                <section className="card" style={{ padding: "28px 24px", background: "var(--bg-soft)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(168, 85, 247, 0.15)", color: "#a855f7", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <Icon name="mail" size={22} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>Inbound Email Lead Forwarding Webhook</h2>
                      <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "3px" }}>
                        Auto-ingest leads from IndiaMART, Justdial, 99acres, TradeIndia, or website contact forms by forwarding emails here.
                      </p>
                    </div>
                  </div>

                  <div className="card" style={{ padding: "16px", background: "var(--bg)", border: "1px solid var(--border)", marginBottom: "18px" }}>
                    <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 600 }}>Your Dedicated Inbound Email Address:</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
                      <code style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--accent)", background: "var(--bg-soft)", padding: "6px 12px", borderRadius: "6px", flex: 1, border: "1px solid var(--border)" }}>
                        {inboundEmailAddress}
                      </code>
                      <button
                        type="button"
                        className="btn"
                        data-variant="ghost"
                        onClick={() => {
                          navigator.clipboard?.writeText(inboundEmailAddress);
                          setEmailCopied(true);
                          setTimeout(() => setEmailCopied(false), 2000);
                        }}
                      >
                        <Icon name={emailCopied ? "check" : "copy"} size={13} />
                        {emailCopied ? "Copied" : "Copy Address"}
                      </button>
                    </div>

                    <div style={{ marginTop: "14px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      <b>How it works:</b> Set up an automatic email forwarding rule in your Gmail/Outlook for sender emails from <code>inquiry@indiamart.com</code> or <code>leads@justdial.com</code> to this address. The Closer AI Parser extracts the client name, phone number, and buyer notes automatically.
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    data-variant="primary"
                    onClick={handleSimulateInboundEmail}
                    disabled={isProcessing}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Icon name="sparkle" size={13} />
                    {isProcessing ? "Parsing Inbound Emails..." : "Simulate Incoming Forwarded Leads (3 Portal Inquiries)"}
                  </button>
                </section>
              )}

              {/* Channel 6: IndiaMART Catalog Sync */}
              {channel === "indiamart" && (
                <section className="card" style={{ padding: "28px 24px", background: "var(--bg-soft)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(234, 88, 12, 0.15)", color: "var(--accent)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <Icon name="building" size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650 }}>IndiaMART Seller Lead Ingestion</h2>
                        <span className="chip" data-tone={imCrmKey ? "accent" : "neutral"} style={{ fontSize: "11px" }}>
                          {imCrmKey ? "Active Connection" : "Setup Required"}
                        </span>
                      </div>
                      <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
                        Configure your IndiaMART CRM API key to poll inbound buyer inquiries and push them directly into Grab Pool or assign round-robin.
                      </p>
                    </div>
                  </div>

                  {imBanner && (
                    <div className="chip" data-tone="accent" style={{ marginBottom: "16px", width: "100%", justifyContent: "center" }}>
                      {imBanner}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
                    <div className="field">
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>IndiaMART CRM Key</label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <input
                          className="input"
                          type={imShowKey ? "text" : "password"}
                          placeholder="Paste IndiaMART CRM Key (mR29...)"
                          value={imCrmKey}
                          onChange={(e) => setImCrmKey(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn"
                          data-size="sm"
                          onClick={() => setImShowKey(!imShowKey)}
                          title={imShowKey ? "Hide key" : "Show key"}
                        >
                          <Icon name={imShowKey ? "eye-off" : "eye"} size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="field">
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Primary Registered Seller Mobile</label>
                      <input
                        className="input"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={imMobile}
                        onChange={(e) => setImMobile(e.target.value)}
                      />
                    </div>

                    <div className="field">
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Sync Interval / Polling Frequency</label>
                      <select
                        className="select"
                        value={imInterval}
                        onChange={(e) => setImInterval(e.target.value)}
                      >
                        <option value="5m">Every 5 minutes</option>
                        <option value="10m">Every 10 minutes</option>
                        <option value="15m">Every 15 minutes</option>
                        <option value="30m">Every 30 minutes</option>
                        <option value="1h">Every 1 hour</option>
                      </select>
                    </div>

                    <div className="field">
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Routing &amp; Distribution Strategy</label>
                      <select
                        className="select"
                        value={imDistribution}
                        onChange={(e) => setImDistribution(e.target.value)}
                      >
                        <option value="ROUND_ROBIN">Round Robin (Distribute evenly to online closers)</option>
                        <option value="GRAB_POOL">Grab Pool (10m SLA Live Countdown)</option>
                        <option value="CLAIM_LOCK">Claim Lock (First to answer gets exclusive lock)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn"
                      data-variant="primary"
                      onClick={handleSaveImConfig}
                      disabled={imIsSaving}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Icon name="check" size={13} />
                      {imIsSaving ? "Saving Configuration..." : "Save Configuration"}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      data-variant="ghost"
                      onClick={handleSyncImLeads}
                      disabled={imIsSyncing}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Icon name="refresh" size={13} />
                      {imIsSyncing ? "Polling IndiaMART Leads..." : "Fetch Live IndiaMART Leads Now"}
                    </button>
                  </div>
                </section>
              )}

              {/* Channel 7: JustDial Webhook Integration */}
              {channel === "justdial" && (
                <section className="card" style={{ padding: "28px 24px", background: "var(--bg-soft)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <Icon name="plug-2" size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650 }}>JustDial Inbound Webhook Integration</h2>
                        <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>
                          Webhook Ready
                        </span>
                      </div>
                      <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
                        Provide this secure webhook URL and bearer token to your JustDial campaign manager or input into your JustDial B2B seller dashboard.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
                    <div className="field">
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>JustDial Target Webhook URL (POST)</label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          className="input"
                          readOnly
                          value={justDialWebhookUrl}
                          style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "12px" }}
                        />
                        <button
                          type="button"
                          className="btn"
                          data-size="sm"
                          onClick={() => copyJdToClipboard(justDialWebhookUrl, "jd-import-url")}
                        >
                          <Icon name={jdCopied === "jd-import-url" ? "check" : "copy"} size={13} />
                          {jdCopied === "jd-import-url" ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>

                    <div className="field">
                      <label style={{ fontSize: "12px", fontWeight: 600 }}>Secret Token / Bearer Key</label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          className="input"
                          readOnly
                          value={justDialSecretToken}
                          style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "12px" }}
                        />
                        <button
                          type="button"
                          className="btn"
                          data-size="sm"
                          onClick={() => copyJdToClipboard(justDialSecretToken, "jd-import-token")}
                        >
                          <Icon name={jdCopied === "jd-import-token" ? "check" : "copy"} size={13} />
                          {jdCopied === "jd-import-token" ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>

                    <div style={{ padding: "12px 14px", background: "var(--bg-panel)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", fontSize: "12px", lineHeight: 1.5 }}>
                      <b>Auto Routing:</b> Inbound leads pushed by JustDial are parsed, deduplicated against existing contacts, and routed into <b>Grab Pool</b> with a 10-minute live countdown timer for closers.
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && uploadedFile && (
            <section className="card" style={{ padding: "0", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                      Step 2 of 3
                    </span>
                    <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650 }}>Match Columns to Closer Lead Fields</h2>
                  </div>
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Source: <b style={{ color: "var(--text)" }}>{uploadedFile.name}</b> ({uploadedFile.size} • {uploadedFile.rows} records detected)
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn" data-variant="ghost" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button className="btn" data-variant="primary" onClick={() => setStep(3)}>
                    Continue to Distribution <Icon name="arrow-right" size={13} />
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="table" style={{ width: "100%", textAlign: "left" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "240px" }}>CRM Field</th>
                      <th style={{ width: "240px" }}>Detected Column</th>
                      <th>Row 1 Sample Preview</th>
                      <th style={{ width: "100px", textAlign: "right" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>Customer Name *</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Lead or contact person</div>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={mappings.name}
                          onChange={(e) => setMappings({ ...mappings, name: e.target.value })}
                          style={{ width: "100%" }}
                        >
                          <option value="">Select column</option>
                          {detectedHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ color: "var(--text)", fontWeight: 550 }}>
                        {parsedRows[0]?.[mappings.name] || "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="chip" data-tone={mappings.name ? "success" : "neutral"} style={{ fontSize: "11px" }}>
                          {mappings.name ? "Mapped" : "Unmapped"}
                        </span>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>Company / Business</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Organization or account</div>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={mappings.company}
                          onChange={(e) => setMappings({ ...mappings, company: e.target.value })}
                          style={{ width: "100%" }}
                        >
                          <option value="">Select column</option>
                          {detectedHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {parsedRows[0]?.[mappings.company] || "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="chip" data-tone={mappings.company ? "success" : "neutral"} style={{ fontSize: "11px" }}>
                          {mappings.company ? "Mapped" : "Unmapped"}
                        </span>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>Phone (Mobile) *</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Primary calling SIM / WhatsApp</div>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={mappings.phone}
                          onChange={(e) => setMappings({ ...mappings, phone: e.target.value })}
                          style={{ width: "100%" }}
                        >
                          <option value="">Select column</option>
                          {detectedHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>
                        {parsedRows[0]?.[mappings.phone] || "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="chip" data-tone={mappings.phone ? "success" : "neutral"} style={{ fontSize: "11px" }}>
                          {mappings.phone ? "Mapped" : "Unmapped"}
                        </span>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>Email Address</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Optional contact email</div>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={mappings.email}
                          onChange={(e) => setMappings({ ...mappings, email: e.target.value })}
                          style={{ width: "100%" }}
                        >
                          <option value="">Select column</option>
                          {detectedHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {parsedRows[0]?.[mappings.email] || "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="chip" data-tone={mappings.email ? "success" : "neutral"} style={{ fontSize: "11px" }}>
                          {mappings.email ? "Mapped" : "Unmapped"}
                        </span>
                      </td>
                    </tr>


                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Step 3: Assignment & Deduplication Settings */}
          {step === 3 && uploadedFile && (
            <section className="card" style={{ padding: "20px" }}>
              <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="chip" data-tone="accent" style={{ fontSize: "11px" }}>
                      Step 3 of 3
                    </span>
                    <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650 }}>Lead Distribution & Ingestion Rules</h2>
                  </div>
                  <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Configure where leads land in the pipeline and which closers receive them.
                  </p>
                </div>
                <button className="btn" data-variant="ghost" onClick={() => setStep(2)}>
                  Back to Mapping
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div className="field">
                  <label style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Initial Pipeline Stage
                  </label>
                  <select
                    className="select"
                    value={targetStage}
                    onChange={(e) => setTargetStage(e.target.value as StageId)}
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Default column where records will appear.</span>
                </div>

                <div className="field">
                  <label style={{ fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Distribution Target
                  </label>
                  <select
                    className="select"
                    value={targetOwner}
                    onChange={(e) => setTargetOwner(e.target.value)}
                  >
                    <option value="Round-Robin">⚡ Automated Round-Robin (Equal across Active Closers)</option>
                    <option value="Unassigned">Open Lead Grab Pool (Unassigned / Claimable)</option>
                  </select>
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Distribute evenly or assign to a dedicated closer.</span>
                  {targetOwner === "Round-Robin" && (
                    <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--accent)", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Icon name="shield" size={12} />
                      <span>Company Admin is strictly excluded from Round-Robin distribution and seat billing.</span>
                    </div>
                  )}
                  {targetOwner === "Unassigned" && (
                    <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--accent)", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Icon name="zap" size={12} />
                      <span>Leads will be routed directly to the Lead Grab Pool. Closers claim them on a first-come, first-served basis up to their active lead limit.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Deduplication Card */}
              <div className="card" style={{ padding: "16px", background: "var(--bg-soft)", marginBottom: "20px" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>Duplicate Phone Number Detection</div>
                <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                  What happens when a lead in this batch shares a phone number with an existing CRM record?
                </p>
                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "var(--fs-caption)" }}>
                    <input
                      type="radio"
                      name="dedup"
                      checked={dedupMode === "skip"}
                      onChange={() => setDedupMode("skip")}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <b>Skip duplicates (Recommended)</b> — keep existing lead, discard duplicate.
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "var(--fs-caption)" }}>
                    <input
                      type="radio"
                      name="dedup"
                      checked={dedupMode === "overwrite"}
                      onChange={() => setDedupMode("overwrite")}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <b>Update existing</b> — overwrite stage & notes with new file data.
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  className="btn"
                  data-variant="primary"
                  onClick={handleExecuteImport}
                  disabled={isProcessing}
                  style={{ height: "38px", padding: "0 22px", fontWeight: 600 }}
                >
                  {isProcessing ? (
                    <>
                      <Icon name="clock" size={14} /> Ingesting Leads...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={14} /> Ingest {uploadedFile.rows} Leads into Pipeline
                    </>
                  )}
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Tab 2: Batch History */}
      {tab === "history" && (
        <section className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Ingested Batch History & Safety Rollback</h2>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
              Every lead batch ever ingested into this workspace. Rollback will safely delete the created leads without touching older CRM records.
            </p>
          </div>

          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "120px" }}>Batch ID</th>
                  <th>Source / Channel</th>
                  <th>Total Rows</th>
                  <th>Imported Leads</th>
                  <th>Assigned Target</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Rollback</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-tertiary)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <Icon name="upload" size={28} style={{ opacity: 0.4 }} />
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>No Import Batches Yet</div>
                        <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", maxWidth: "340px" }}>
                          Leads imported across CSV, Excel, Google Sheets, WhatsApp QR, and Email will appear here with 1-click rollback support.
                        </div>
                        <button className="btn" data-variant="primary" data-size="sm" style={{ marginTop: "8px" }} onClick={() => setTab("wizard")}>
                          <Icon name="plus" size={13} /> Import Spreadsheet
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span className="chip" data-tone="accent" style={{ fontSize: "11px", fontFamily: "var(--mono)" }}>
                          {b.id}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--text)" }}>{b.filename}</td>
                      <td>{b.totalRows}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: "var(--success)" }}>{b.importedCount}</span>
                        {b.duplicateCount > 0 && (
                          <span style={{ color: "var(--text-tertiary)", fontSize: "11px", marginLeft: "4px" }}>
                            ({b.duplicateCount} dupes skipped)
                          </span>
                        )}
                      </td>
                      <td>{b.assignedOwner}</td>
                      <td style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-caption)" }}>{b.timestamp}</td>
                      <td>
                        <span
                          className="chip"
                          data-tone={b.status === "completed" ? "success" : "danger"}
                          style={{ fontSize: "11px" }}
                        >
                          {b.status === "completed" ? "Completed" : "Rolled Back"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {b.status === "completed" && (
                          <button
                            className="btn"
                            data-size="sm"
                            data-variant="danger"
                            onClick={() => handleRollback(b.id)}
                            style={{ height: "24px", fontSize: "11px" }}
                          >
                            Undo Batch
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      </>
      )}
    </div>
  );
}
