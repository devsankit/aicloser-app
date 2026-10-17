"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useApp } from "@/lib/store";
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

const DEFAULT_BATCHES: ImportBatch[] = [
  {
    id: "BAT-882",
    filename: "meta_ads_interiors_leads_oct.csv",
    totalRows: 120,
    importedCount: 112,
    duplicateCount: 8,
    assignedOwner: "Round-Robin",
    stage: "new",
    timestamp: "Today, 10:15 AM",
    status: "completed",
  },
  {
    id: "BAT-881",
    filename: "broker_playbook_downloads.xlsx",
    totalRows: 65,
    importedCount: 62,
    duplicateCount: 3,
    assignedOwner: "Aarav Sharma",
    stage: "new",
    timestamp: "Yesterday, 3:45 PM",
    status: "completed",
  },
  {
    id: "BAT-879",
    filename: "webinar_registrations_sep.csv",
    totalRows: 240,
    importedCount: 218,
    duplicateCount: 22,
    assignedOwner: "Meera Joshi",
    stage: "contacted",
    timestamp: "12 Oct 2026",
    status: "completed",
  },
];

const SAMPLE_CSV_PREVIEW = [
  { name: "Vikrant Malhotra", company: "Skyline Real Estate", phone: "9819923412", email: "vikrant@skylinerealty.in", value: "125000", source: "Ads", segment: "SMB" },
  { name: "Kavita Sen", company: "Elysian Design Studio", phone: "9820034567", email: "kavita@elysiandesign.com", value: "88000", source: "Website", segment: "Agency" },
  { name: "Sameer Joshi", company: "Optima Logistics", phone: "9988776655", email: "sameer@optimalogistics.in", value: "195000", source: "Cold call", segment: "Enterprise" },
];

export function LeadImportView() {
  const { addLead } = useApp();
  const [tab, setTab] = useState<"wizard" | "history">("wizard");
  const [batches, setBatches] = useState<ImportBatch[]>(DEFAULT_BATCHES);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; rows: number } | null>(null);
  const [targetStage, setTargetStage] = useState<StageId>("new");
  const [targetOwner, setTargetOwner] = useState<string>("Aarav");
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

  const handleLoadSample = () => {
    setUploadedFile({
      name: "sample_inbound_leads.csv",
      size: "24.6 KB",
      rows: SAMPLE_CSV_PREVIEW.length,
    });
    setStep(2);
  };

  const handleSimulateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        rows: 42,
      });
      setStep(2);
    }
  };

  const handleExecuteImport = () => {
    setIsProcessing(true);
    setTimeout(() => {
      // Add preview leads to store
      SAMPLE_CSV_PREVIEW.forEach((item) => {
        addLead({
          name: item.name,
          company: item.company,
          phone: item.phone,
          email: item.email,
          value: Number(item.value) || 75000,
          source: (item.source as Source) || targetSource,
          segment: (item.segment as Segment) || "SMB",
          stage: targetStage,
          owner: targetOwner,
          priority: "high" as Priority,
          followUp: new Date(Date.now() + 2 * 86400000).toISOString(),
          tags: ["imported-batch"],
          notes: "Imported via CSV batch processor.",
        });
      });

      const newBatch: ImportBatch = {
        id: `BAT-${Math.floor(100 + Math.random() * 900)}`,
        filename: uploadedFile?.name || "import_leads.csv",
        totalRows: uploadedFile?.rows || 3,
        importedCount: uploadedFile?.rows || 3,
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
      setImportSuccessBanner(`Successfully imported ${newBatch.importedCount} leads into the pipeline!`);
      setTimeout(() => setImportSuccessBanner(null), 4000);
    }, 1200);
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
            href="data:text/csv;charset=utf-8,name,company,phone,email,value,source,segment%0AVikrant%20Malhotra,Skyline%20Real%20Estate,9819923412,vikrant@skyline.in,125000,Ads,SMB"
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
            425 <span style={{ fontSize: "var(--fs-body)", fontWeight: 400, color: "var(--text-tertiary)" }}>leads</span>
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
            33 blocked
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
                  <Icon name="plus" size={13} /> Browse Files
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={handleSimulateFileUpload} style={{ display: "none" }} />
                </label>
                <button className="btn" data-variant="ghost" onClick={handleLoadSample}>
                  <Icon name="sparkle" size={13} /> Load Sample 3 Leads (Instant Test)
                </button>
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
                          <option value="name">name (Matched)</option>
                          <option value="full_name">full_name</option>
                          <option value="client">client</option>
                        </select>
                      </td>
                      <td style={{ color: "var(--text)", fontWeight: 500 }}>Vikrant Malhotra</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>Mapped</span>
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
                          <option value="company">company (Matched)</option>
                          <option value="business">business</option>
                        </select>
                      </td>
                      <td style={{ color: "var(--text)", fontWeight: 500 }}>Skyline Real Estate</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>Mapped</span>
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
                          <option value="phone">phone (Matched)</option>
                          <option value="mobile">mobile</option>
                          <option value="contact">contact</option>
                        </select>
                      </td>
                      <td style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>9819923412</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>Mapped</span>
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
                          <option value="email">email (Matched)</option>
                        </select>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>vikrant@skylinerealty.in</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>Mapped</span>
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
                          <option value="value">value (Matched)</option>
                          <option value="budget">budget</option>
                        </select>
                      </td>
                      <td style={{ color: "var(--text)", fontWeight: 600 }}>₹1,25,000</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="chip" data-tone="success" style={{ fontSize: "11px" }}>Mapped</span>
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
                {batches.map((b) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
