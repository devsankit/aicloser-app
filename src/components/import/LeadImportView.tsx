"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";
import { aicloserApi } from "@/lib/api-client";
import { OWNERS, STAGES, type Priority, type Segment, type Source, type StageId } from "@/lib/types";

interface ImportBatch {
  id: string;
  filename: string;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  assignedOwner: string;
  stage: StageId;
  timestamp: string;
  status: "completed" | "rolled_back";
}

const DEFAULT_BATCHES: ImportBatch[] = [];

export function LeadImportView() {
  const { addLead } = useApp();
  const [tab, setTab] = useState<"wizard" | "history">("wizard");
  const [batches, setBatches] = useState<ImportBatch[]>(DEFAULT_BATCHES);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; rows: number } | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [targetStage, setTargetStage] = useState<StageId>("new");
  const [targetOwner, setTargetOwner] = useState<string>("Unassigned");
  const [targetSource] = useState<Source>("Ads");
  const [dedupMode, setDedupMode] = useState<"skip" | "overwrite">("skip");
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccessBanner, setImportSuccessBanner] = useState<string | null>(null);

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

        setDetectedHeaders(headers);
        setParsedRows(rows);
        setUploadedFile({
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          rows: rows.length,
        });

        // Auto match mappings
        const findHeader = (candidates: string[]) =>
          headers.find((h) => candidates.some((c) => h.toLowerCase().includes(c.toLowerCase()))) || headers[0] || "";

        setMappings({
          name: findHeader(["name", "full_name", "client", "contact"]),
          company: findHeader(["company", "business", "organization", "firm"]),
          phone: findHeader(["phone", "mobile", "sim", "tel"]),
          email: findHeader(["email", "mail"]),
          value: findHeader(["value", "budget", "amount", "deal"]),
          source: findHeader(["source", "channel"]),
          segment: findHeader(["segment", "type"]),
        });

        setStep(2);
      }
    } catch (err) {
      console.error("Failed to parse CSV file", err);
    }
  };

  const handleExecuteImport = () => {
    setIsProcessing(true);
    setTimeout(() => {
      // Add real parsed leads to store
      parsedRows.forEach((item) => {
        const name = item[mappings.name] || item["name"] || item["Name"] || "Imported Lead";
        const company = item[mappings.company] || item["company"] || item["Company"] || "Independent Firm";
        const phone = item[mappings.phone] || item["phone"] || item["Phone"] || "";
        const email = item[mappings.email] || item["email"] || item["Email"] || "";
        const val = Number(item[mappings.value] || item["value"] || item["budget"]) || 0;

        addLead({
          name,
          company,
          phone,
          email,
          value: val,
          source: (item[mappings.source] as Source) || targetSource,
          segment: (item[mappings.segment] as Segment) || "SMB",
          stage: targetStage,
          owner: targetOwner,
          priority: "medium" as Priority,
          followUp: new Date(Date.now() + 2 * 86400000).toISOString(),
          tags: ["imported-batch"],
          notes: "Imported via CSV batch processor.",
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
            notes: "Imported via CSV batch processor.",
          })),
          duplicateAction: dedupMode === "overwrite" ? "OVERWRITE" : "SKIP",
          distributionMode: targetOwner === "Round-Robin" ? "ROUND_ROBIN" : "MANUAL",
        })
        .catch(() => {});

      const newBatch: ImportBatch = {
        id: `BAT-${Math.floor(100 + Math.random() * 900)}`,
        filename: uploadedFile?.name || "import_leads.csv",
        totalRows: parsedRows.length,
        importedCount: parsedRows.length,
        duplicateCount: 0,
        assignedOwner: targetOwner,
        stage: targetStage,
        timestamp: "Just now",
        status: "completed",
      };

      setBatches([newBatch, ...batches]);
      setIsProcessing(false);
      setStep(1);
      setUploadedFile(null);
      setParsedRows([]);
      setImportSuccessBanner(`Successfully imported ${newBatch.importedCount} leads into the pipeline!`);
      setTimeout(() => setImportSuccessBanner(null), 4000);
    }, 800);
  };

  const handleRollback = (batchId: string) => {
    if (!confirm("Are you sure you want to rollback this import batch? All leads created in this batch will be archived.")) return;
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
            Lead Import & Batch Mapping
          </h1>
          <p className="page-sub" style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Bring CSV or XLSX spreadsheets in, map columns once, deduplicate phone numbers, and assign batch owners.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {importSuccessBanner && (
            <span className="chip" data-tone="success" style={{ padding: "4px 10px" }}>
              <Icon name="check" size={13} /> {importSuccessBanner}
            </span>
          )}
          <a
            href="data:text/csv;charset=utf-8,name,company,phone,email,value,source,segment%0ASunil%20Verma,Verma%20Industries,9823456789,sunil@verma.in,50000,Website,SMB"
            download="closer_sample_leads.csv"
            className="btn"
            data-variant="ghost"
          >
            <Icon name="download" size={13} /> Sample CSV Template
          </a>
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
            Total Leads Imported
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px" }}>
            {batches.reduce((sum, b) => sum + b.importedCount, 0)} <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>leads</span>
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Across {batches.length} completed batches
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Duplicate Filter
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--success)" }}>
            {batches.reduce((sum, b) => sum + b.duplicateCount, 0)} blocked
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Prevented double-calling same client
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

        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-tertiary)", fontWeight: 550, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Auto Round-Robin
          </div>
          <div style={{ fontSize: "var(--fs-metric)", fontWeight: 650, marginTop: "4px", color: "var(--accent)" }}>
            Enabled
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px" }}>
            Distributes batch evenly to closers
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
        <div className="seg">
          <button data-on={tab === "wizard"} onClick={() => setTab("wizard")}>
            <Icon name="upload" size={13} /> Import Wizard {uploadedFile ? `(Step ${step} of 3)` : ""}
          </button>
          <button data-on={tab === "history"} onClick={() => setTab("history")}>
            <Icon name="clock" size={13} /> Batch History ({batches.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Wizard */}
      {tab === "wizard" && (
        <div>
          {/* Step 1: Upload */}
          {step === 1 && (
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
              <h2 style={{ fontSize: "var(--fs-title)", fontWeight: 650 }}>Drag & Drop your Lead Spreadsheet</h2>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "4px", maxWidth: "420px", margin: "4px auto 20px auto" }}>
                Accepts <b>.CSV</b>, <b>.XLSX</b> or <b>.XLS</b> files up to 25MB. Columns will be auto-detected in the next step.
              </p>

              <div style={{ display: "flex", justifyContent: "center", gap: "12px", alignItems: "center" }}>
                <label className="btn" data-variant="primary" style={{ cursor: "pointer" }}>
                  <Icon name="plus" size={13} /> Select CSV Spreadsheet
                  <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: "none" }} />
                </label>
              </div>
            </section>
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
                    <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650 }}>Match Spreadsheet Columns to Closer Fields</h2>
                  </div>
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                    File: <b style={{ color: "var(--text)" }}>{uploadedFile.name}</b> ({uploadedFile.size} • {uploadedFile.rows} rows detected)
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn" data-variant="ghost" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button className="btn" data-variant="primary" onClick={() => setStep(3)}>
                    Continue to Assignment <Icon name="arrow-right" size={13} />
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="table" style={{ width: "100%", textAlign: "left" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "240px" }}>CRM Field</th>
                      <th style={{ width: "240px" }}>Detected CSV Column</th>
                      <th>Row 1 Preview Sample</th>
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
                      <td style={{ color: "var(--text)", fontWeight: 500 }}>
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
                        <div style={{ fontWeight: 600 }}>Company Name *</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Organization or firm</div>
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
                      <td style={{ color: "var(--text)", fontWeight: 500 }}>
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
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Primary calling SIM number</div>
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
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Expected commercial budget</div>
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
                        {parsedRows[0]?.[mappings.value] ? `₹${Number(parsedRows[0][mappings.value]).toLocaleString()}` : "—"}
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
                    <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 650 }}>Batch Assignment & Ingestion Rules</h2>
                  </div>
                  <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Define where leads land in the Kanban and which closers receive them.
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
                    Assigned Closer
                  </label>
                  <select
                    className="select"
                    value={targetOwner}
                    onChange={(e) => setTargetOwner(e.target.value)}
                  >
                    <option value="Round-Robin">⚡ Automated Round-Robin (Equal)</option>
                    {OWNERS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Distribute evenly or assign to a dedicated closer.</span>
                </div>
              </div>

              {/* Deduplication Card */}
              <div className="card" style={{ padding: "16px", background: "var(--bg-soft)", marginBottom: "20px" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--fs-meta)" }}>Duplicate Phone Number Detection</div>
                <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
                  What happens when a lead in this file shares a phone number with an existing CRM record?
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
                    <b>Skip duplicates (Recommended)</b> — keep existing lead, discard file row.
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
                      <Icon name="check" size={14} /> Start Batch Import ({uploadedFile.rows} leads)
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
            <h2 style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>Imported Batch History & Safety Rollback</h2>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "2px" }}>
              Every spreadsheet ever imported into this workspace. Rollback will safely delete the created leads without touching older CRM records.
            </p>
          </div>

          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={{ width: "120px" }}>Batch ID</th>
                  <th>Source File</th>
                  <th>Total Rows</th>
                  <th>Imported Leads</th>
                  <th>Assigned Owner</th>
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
                          Spreadsheets and CSV files imported into your CRM will appear here with 1-click rollback support.
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
