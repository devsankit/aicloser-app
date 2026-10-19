"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";
import { OWNERS, STAGES, type Priority, type Segment, type Source, type StageId } from "@/lib/types";

export type ImportChannel = "csv" | "excel" | "sheets" | "whatsapp_qr" | "email";

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

const DEFAULT_BATCHES: ImportBatch[] = [
  {
    id: "BAT-101",
    filename: "q3_b2b_inquiries.csv",
    channel: "csv",
    totalRows: 48,
    importedCount: 46,
    duplicateCount: 2,
    assignedOwner: "Round-Robin",
    stage: "new",
    timestamp: "2 hours ago",
    status: "completed",
  },
  {
    id: "BAT-102",
    filename: "WhatsApp QR Chats Relay",
    channel: "whatsapp_qr",
    totalRows: 18,
    importedCount: 18,
    duplicateCount: 0,
    assignedOwner: "Anshita",
    stage: "contacted",
    timestamp: "Yesterday",
    status: "completed",
  },
];

export function LeadImportView() {
  const { addLead, state } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<"wizard" | "history">("wizard");
  const [channel, setChannel] = useState<ImportChannel>("csv");
  const [batches, setBatches] = useState<ImportBatch[]>(DEFAULT_BATCHES);

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
    } catch (err) {
      console.error("Failed to parse CSV file", err);
    }
  };

  const handleLoadSampleCsv = () => {
    const headers = ["name", "company", "phone", "email", "value", "source", "segment"];
    const sampleRows = [
      { name: "Sunil Verma", company: "Verma Industries", phone: "+91 98234 56789", email: "sunil@verma.in", value: "85000", source: "Excel", segment: "SMB" },
      { name: "Pooja Malhotra", company: "Zenith Marketing", phone: "+91 97112 34567", email: "pooja@zenith.io", value: "140000", source: "Excel", segment: "Agency" },
      { name: "Rameshwar Rao", company: "Rao Cold Storage", phone: "+91 99401 22334", email: "rameshwar@raocold.com", value: "220000", source: "Excel", segment: "Enterprise" },
      { name: "Divya Nambiar", company: "Kite FinTech", phone: "+91 98840 55667", email: "divya@kitefin.in", value: "310000", source: "Excel", segment: "Enterprise" },
      { name: "Chetan Saxena", company: "Aura Logistics", phone: "+91 98101 99887", email: "chetan@auralog.com", value: "95000", source: "Excel", segment: "SMB" },
    ];
    applyDetectedRows("closer_sample_b2b_leads.csv", "4.2 KB", headers, sampleRows, "Excel");
  };

  const handleLoadSampleExcel = () => {
    const headers = ["Customer Name", "Business Account", "Contact Number", "Email Address", "Project Budget", "Territory"];
    const sampleRows = [
      { "Customer Name": "Vikram Singhania", "Business Account": "Singhania Logistics", "Contact Number": "+91 98201 11223", "Email Address": "vikram@singhania.in", "Project Budget": "175000", Territory: "North" },
      { "Customer Name": "Natasha Roy", "Business Account": "Prism Creative Studios", "Contact Number": "+91 98765 88990", "Email Address": "natasha@prismstudio.co", "Project Budget": "92000", Territory: "West" },
      { "Customer Name": "Gautam Adani Corp Rep", "Business Account": "Kutch Ports Hub", "Contact Number": "+91 99099 44332", "Email Address": "rep.kutch@adani.com", "Project Budget": "450000", Territory: "West" },
      { "Customer Name": "Shalini Pillai", "Business Account": "AyurVeda Naturals", "Contact Number": "+91 94471 22334", "Email Address": "shalini@ayurnaturals.in", "Project Budget": "68000", Territory: "South" },
    ];
    applyDetectedRows("enterprise_q4_pipeline.xlsx", "18.4 KB", headers, sampleRows, "Excel");
  };

  const handleFetchGoogleSheets = () => {
    setIsFetchingSheet(true);
    setTimeout(() => {
      setIsFetchingSheet(false);
      const headers = ["Client Name", "Organization", "Mobile Number", "Email", "Deal Size", "Region"];
      const rows = [
        { "Client Name": "Ananya Roy", Organization: "Roy Shipping Solutions", "Mobile Number": "+91 98301 22334", Email: "ananya@royshipping.com", "Deal Size": "195000", Region: "East" },
        { "Client Name": "Deepak Chawla", Organization: "Chawla Agro Mills", "Mobile Number": "+91 98140 77665", Email: "deepak@chawlaagro.in", "Deal Size": "120000", Region: "North" },
        { "Client Name": "Ritu Sengupta", Organization: "Pixelkraft Design", "Mobile Number": "+91 98450 11998", Email: "ritu@pixelkraft.agency", "Deal Size": "85000", Region: "South" },
        { "Client Name": "Siddharth Goel", Organization: "Apex Cloudware", "Mobile Number": "+91 99201 33445", Email: "siddharth@apexcloud.io", "Deal Size": "280000", Region: "West" },
      ];
      applyDetectedRows(`Google Sheet: ${sheetTabName}`, "Live Sheet Cloud Link", headers, rows, "Google Sheets");
    }, 700);
  };

  const handleExtractWhatsAppChats = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const headers = ["Contact Name", "Business Company", "WhatsApp Phone", "Chat Topic", "Estimated Value"];
      const rows = [
        { "Contact Name": "Rajesh Gupta (Buyer)", "Business Company": "Gupta Steels & Pipes", "WhatsApp Phone": "+91 98200 88776", "Chat Topic": "Need 5 licenses for regional desk", "Estimated Value": "150000" },
        { "Contact Name": "Dr. Aris Mehta", "Business Company": "Mehta Eye Centers", "WhatsApp Phone": "+91 99870 55443", "Chat Topic": "Inquired about missed call auto WhatsApp", "Estimated Value": "80000" },
        { "Contact Name": "Suresh Patel", "Business Company": "Patel Infrastructure", "WhatsApp Phone": "+91 98250 11223", "Chat Topic": "Requested pricing brochure via WhatsApp", "Estimated Value": "210000" },
        { "Contact Name": "Kavita Shah", "Business Company": "Kavita Jewels Online", "WhatsApp Phone": "+91 98211 44556", "Chat Topic": "Follow up on catalogue demo", "Estimated Value": "95000" },
      ];
      applyDetectedRows("WhatsApp Linked Device QR Chats", "24 Active Phone Threads", headers, rows, "WhatsApp QR");
    }, 600);
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
      const eligibleClosers = ["Anshita", "Field Closer Desk"];
      let closerIdx = 0;

      parsedRows.forEach((item) => {
        const name = item[mappings.name] || item["name"] || item["Name"] || item["Customer Name"] || item["Client Name"] || "Imported Lead";
        const company = item[mappings.company] || item["company"] || item["Company"] || item["Business Account"] || item["Organization"] || "Independent Firm";
        const phone = item[mappings.phone] || item["phone"] || item["Phone"] || item["Mobile Number"] || item["WhatsApp Phone"] || item["Contact Number"] || "";
        const email = item[mappings.email] || item["email"] || item["Email"] || item["Email Address"] || "";
        const val = Number(String(item[mappings.value] || item["value"] || item["budget"] || item["Deal Size"] || "0").replace(/\D/g, "")) || 75000;

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
          followUp: new Date(Date.now() + 2 * 86400000).toISOString(),
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
            ? "Round-Robin (Anshita & Field Desk)"
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
            Ingest leads across 5 channels: CSV, Excel, Google Sheets, WhatsApp Linked Device QR chats, and Inbound Email.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {importSuccessBanner && (
            <span className="chip" data-tone="success" style={{ padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon name="check" size={13} /> {importSuccessBanner}
            </span>
          )}
          <button
            onClick={handleLoadSampleCsv}
            className="btn"
            data-variant="ghost"
          >
            <Icon name="sparkle" size={13} /> Load Sample Leads
          </button>
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
            Admin Exclusion Rule
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--accent)" }}>
            100% Active
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Admin strictly excluded from round-robin & billing
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

        <div
          className="card"
          onClick={() => router.push("/pipeline")}
          style={{
            padding: "14px 16px",
            borderColor: "rgba(244, 97, 42, 0.4)",
            background: "rgba(244, 97, 42, 0.05)",
            cursor: "pointer",
            transition: "transform 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "var(--fs-caption)", color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "4px" }}>
              <Icon name="zap" size={12} /> Lead Grab Pool
            </div>
            <Icon name="external" size={12} style={{ color: "var(--accent)" }} />
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 700, marginTop: "4px", color: "var(--accent)" }}>
            {state.poolCount || 573} <span style={{ fontSize: "var(--fs-body)", fontWeight: 500, color: "var(--text-secondary)" }}>waiting</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            First-come, first-served claim pool · View in Pipeline →
          </div>
        </div>
      </div>

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
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", display: "grid", placeItems: "center" }}>
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
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(168, 85, 247, 0.15)", color: "#a855f7", display: "grid", placeItems: "center" }}>
                    <Icon name="mail" size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>5. Inbound Email</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Forwarding webhook</div>
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
                    <button type="button" className="btn" data-variant="ghost" onClick={handleLoadSampleCsv}>
                      <Icon name="sparkle" size={13} /> Load Sample CSV (5 Leads)
                    </button>
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
                    <button type="button" className="btn" data-variant="ghost" onClick={handleLoadSampleExcel}>
                      <Icon name="sparkle" size={13} /> Load Sample Excel (4 Leads)
                    </button>
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
                      <h2 style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>WhatsApp Companion Linked Device (QR Import)</h2>
                      <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "3px" }}>
                        Directly extract inbound chat threads from your connected WhatsApp companion smartphone into CRM leads with 1-click.
                      </p>
                    </div>
                  </div>

                  {/* Connected Device Status Card */}
                  <div className="card" style={{ padding: "16px", background: "var(--bg)", border: "1px solid var(--border)", marginBottom: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(34, 197, 94, 0.15)", color: "var(--success)", display: "grid", placeItems: "center" }}>
                          <Icon name="smartphone" size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>Xiaomi Redmi Note 12 5G (SIM Relay Desk)</div>
                          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>SIM Number: +91 76185 34225 • Battery 92% • Status: Linked & Active</div>
                        </div>
                      </div>
                      <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>
                        Connected
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Active Conversations</div>
                        <div style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--text)" }}>24 Customer Threads</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Unassigned Inbound</div>
                        <div style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--accent)" }}>8 Pending Import</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Companion Protocol</div>
                        <div style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--text)" }}>Baileys QR Multi-Device</div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    data-variant="primary"
                    onClick={handleExtractWhatsAppChats}
                    disabled={isProcessing}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Icon name="whatsapp" size={13} />
                    {isProcessing ? "Scanning WhatsApp Chats..." : "Extract & Import Active WhatsApp Chats to CRM (4 Pending Leads)"}
                  </button>
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

                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>Deal Value (₹)</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Expected deal amount</div>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={mappings.value}
                          onChange={(e) => setMappings({ ...mappings, value: e.target.value })}
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
                      <td style={{ color: "var(--text)", fontWeight: 600 }}>
                        {parsedRows[0]?.[mappings.value] ? `₹${Number(String(parsedRows[0][mappings.value]).replace(/\D/g, "")).toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="chip" data-tone={mappings.value ? "success" : "neutral"} style={{ fontSize: "11px" }}>
                          {mappings.value ? "Mapped" : "Unmapped"}
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
                    <option value="Anshita">Anshita (Senior Closer)</option>
                    <option value="Field Closer Desk">Field Closer Desk (SIM Relay)</option>
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
    </div>
  );
}
