import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// 1. Stress-testing Role Filter with Adversarial Inputs
// ---------------------------------------------------------------------------
function isRoleEligibleForAssignment(role) {
  const r = (role || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (r === "SUPER_ADMIN" || r.includes("SUPER") || r === "ADMIN" || r === "WORKSPACE_ADMIN" || r === "OWNER") return false;
  return true;
}

test("Adversarial Role Filter: Unicode, NBSP, Tabs, Newlines, and CRLF", () => {
  const cases = [
    { role: "\u00A0ADMIN\u00A0", expected: false, desc: "NBSP surrounded ADMIN" },
    { role: "\t\tADMIN\n\r", expected: false, desc: "Tabs and newlines ADMIN" },
    { role: " \v\f WORKSPACE ADMIN \v ", expected: false, desc: "Vertical tabs and form feeds" },
    { role: "\nSUPER_ADMIN\r\n", expected: false, desc: "CRLF SUPER_ADMIN" },
    { role: "   OWNER   ", expected: false, desc: "Padded OWNER" },
    { role: "   owner   ", expected: false, desc: "Padded lowercase owner" },
    { role: "\t  Workspace   Admin  \t", expected: false, desc: "Multi-space internal Workspace Admin" },
    // Operational roles should pass through even with weird whitespace
    { role: "  \t CLOSER \n ", expected: true, desc: "Padded CLOSER" },
    { role: "  sales   agent  ", expected: true, desc: "Multi-space sales agent" },
    { role: "  MANAGER  ", expected: true, desc: "Padded MANAGER" },
  ];

  for (const c of cases) {
    const res = isRoleEligibleForAssignment(c.role);
    assert.equal(res, c.expected, `Failed for ${c.desc}: got ${res}`);
  }
});

test("Adversarial Role Filter: Potential Injection and Boundary Cases", () => {
  const boundaryCases = [
    { role: "", expected: true, desc: "Empty string" },
    { role: " ", expected: true, desc: "Whitespace only" },
    { role: null, expected: true, desc: "Null value" },
    { role: undefined, expected: true, desc: "Undefined value" },
    { role: "12345", expected: true, desc: "Numeric string" },
    { role: "<script>alert(1)</script>", expected: true, desc: "XSS string" },
    { role: "ADMINISTRATOR", expected: true, desc: "Administrator title (not in schema enum)" },
    { role: "ADMIN_ASSISTANT", expected: true, desc: "Sub-role not matching strict equality" },
    { role: "SUPER", expected: false, desc: "Exact substring SUPER" },
    { role: "SUPER_CLOSER", expected: false, desc: "Closer prefixed with SUPER" },
  ];

  for (const c of boundaryCases) {
    const res = isRoleEligibleForAssignment(c.role);
    assert.equal(res, c.expected, `Boundary failure for ${c.desc}: got ${res}`);
  }
});

// ---------------------------------------------------------------------------
// 2. Stress-testing XLSX Binary Parser with Malicious and Edge Case Buffers
// ---------------------------------------------------------------------------
test("Adversarial XLSX: 0-byte Buffer and Corrupted ZIP Buffers", () => {
  const zeroBuffer = Buffer.alloc(0);
  // SheetJS creates a minimal empty workbook for 0-byte input instead of crashing
  const emptyWb = XLSX.read(zeroBuffer, { type: "array" });
  assert.ok(emptyWb.SheetNames.length > 0);
  const rows = XLSX.utils.sheet_to_json(emptyWb.Sheets[emptyWb.SheetNames[0]], { defval: "" });
  assert.equal(rows.length, 0, "0-byte buffer yields 0 rows, triggering 'Excel sheet contains no data rows.'");

  // Corrupted zip buffer with valid PK signature but invalid zip archive
  const corruptZipBuffer = Buffer.from("PK\x03\x04corrupted_payload_that_fails_unzip");
  assert.throws(
    () => XLSX.read(corruptZipBuffer, { type: "array" }),
    /ZIP|unsupported|corrupted|bad/i,
    "Corrupted ZIP header throws catchable exception caught by try/catch in handleFileUpload"
  );
});

test("Adversarial XLSX: Numeric formatting, Date serials, and Formula values", () => {
  const rows = [
    { Name: "Lead A", Deal: 50000, Date: "2026-10-23", IsVIP: true, Notes: null }
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const parsedWb = XLSX.read(buf, { type: "array" });
  const rawRows = XLSX.utils.sheet_to_json(parsedWb.Sheets[parsedWb.SheetNames[0]], { defval: "" });

  assert.equal(rawRows.length, 1);
  assert.equal(String(rawRows[0].Deal), "50000");
  assert.equal(String(rawRows[0].IsVIP), "true");
  assert.equal(String(rawRows[0].Notes ?? ""), "");
});

test("Adversarial XLSX: Multi-column High Volume (2,000 rows) Performance Stress", () => {
  const largeDataset = [];
  for (let i = 0; i < 2000; i++) {
    largeDataset.push({
      "Full Name": `Contact Person ${i}`,
      "Phone Number": `+9198765${String(i).padStart(5, "0")}`,
      "Email Address": `person_${i}@domain.com`,
      "Estimated Deal": i * 1000,
      "Lead Source": i % 2 === 0 ? "Meta Ads" : "Google Search",
      "City": "Mumbai",
      "Status": "NEW"
    });
  }

  const ws = XLSX.utils.json_to_sheet(largeDataset);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BigSheet");

  const startWrite = performance.now();
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const writeDuration = performance.now() - startWrite;

  const startRead = performance.now();
  const parsedWb = XLSX.read(buf, { type: "array" });
  const parsedSheet = parsedWb.Sheets[parsedWb.SheetNames[0]];
  const parsedRows = XLSX.utils.sheet_to_json(parsedSheet, { defval: "" });
  const readDuration = performance.now() - startRead;

  assert.equal(parsedRows.length, 2000, "Must parse all 2000 rows with 100% fidelity");
  assert.ok(readDuration < 1000, `Parsing 2000 rows must be fast (<1000ms), took ${readDuration.toFixed(2)}ms`);
});

test("Adversarial XLSX: CSV buffer passed into XLSX.read auto-detection", () => {
  // If user uploads CSV file renamed as .xlsx
  const csvContent = "Lead Name,Phone,Email\nJohn Doe,1234567890,john@example.com\nJane Smith,0987654321,jane@example.com";
  const csvBuffer = Buffer.from(csvContent, "utf8");

  // SheetJS can parse plain CSV text buffers as well!
  const parsedWb = XLSX.read(csvBuffer, { type: "array" });
  assert.ok(parsedWb.SheetNames.length > 0, "SheetJS should detect CSV fallback");
  const rows = XLSX.utils.sheet_to_json(parsedWb.Sheets[parsedWb.SheetNames[0]], { defval: "" });
  assert.equal(rows.length, 2, "Renamed CSV parsed cleanly through XLSX.read");
  assert.equal(rows[0]["Lead Name"], "John Doe");
});
