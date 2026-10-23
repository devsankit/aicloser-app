import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// 1. Source Inspection: Verify LeadDrawer.tsx and ChatView.tsx implementations
// ---------------------------------------------------------------------------
const leadDrawerSrc = fs.readFileSync(
  new URL("../src/components/pipeline/LeadDrawer.tsx", import.meta.url),
  "utf8"
);
const chatViewSrc = fs.readFileSync(
  new URL("../src/components/chat/ChatView.tsx", import.meta.url),
  "utf8"
);
const leadImportSrc = fs.readFileSync(
  new URL("../src/components/import/LeadImportView.tsx", import.meta.url),
  "utf8"
);

test("LeadDrawer.tsx implements normalized role filtering excluding all executive roles", () => {
  // Check helper lines 98-99
  assert.match(
    leadDrawerSrc,
    /const r = \(m\.role \|\| ""\)\.trim\(\)\.toUpperCase\(\)\.replace\(\/\\s\+\/g, "_"\);[\s\S]*?if \(r === "SUPER_ADMIN" \|\| r\.includes\("SUPER"\) \|\| r === "ADMIN" \|\| r === "WORKSPACE_ADMIN" \|\| r === "OWNER"\) return;/
  );
  // Check user role fallback line 104-105
  assert.match(
    leadDrawerSrc,
    /const uRole = \(state\.user\?\.role \|\| ""\)\.trim\(\)\.toUpperCase\(\)\.replace\(\/\\s\+\/g, "_"\);[\s\S]*?if \(uRole !== "SUPER_ADMIN" && !uRole\.includes\("SUPER"\) && uRole !== "ADMIN" && uRole !== "WORKSPACE_ADMIN" && uRole !== "OWNER"\)/
  );
  // Check transfer dropdown filter line 384-387
  assert.match(
    leadDrawerSrc,
    /state\.teamMembers[\s\S]*?\.filter\(\(m\) => \{[\s\S]*?const r = \(m\.role \|\| ""\)\.trim\(\)\.toUpperCase\(\)\.replace\(\/\\s\+\/g, "_"\);[\s\S]*?if \(r === "SUPER_ADMIN" \|\| r\.includes\("SUPER"\) \|\| r === "ADMIN" \|\| r === "WORKSPACE_ADMIN" \|\| r === "OWNER"\) return false;[\s\S]*?return true;[\s\S]*?\}\)/
  );
  // Check assignee dropdown filter line 507-511
  assert.match(
    leadDrawerSrc,
    /state\.teamMembers[\s\S]*?\.filter\(\(m\) => \{[\s\S]*?const r = \(m\.role \|\| ""\)\.trim\(\)\.toUpperCase\(\)\.replace\(\/\\s\+\/g, "_"\);[\s\S]*?if \(r === "SUPER_ADMIN" \|\| r\.includes\("SUPER"\) \|\| r === "ADMIN" \|\| r === "WORKSPACE_ADMIN" \|\| r === "OWNER"\) return false;[\s\S]*?return true;[\s\S]*?\}\)/
  );
});

test("ChatView.tsx and LeadDrawer.tsx use congruent role filtering logic", () => {
  assert.match(
    chatViewSrc,
    /const r = \(m\.role \|\| ""\)\.trim\(\)\.toUpperCase\(\)\.replace\(\/\\s\+\/g, "_"\);[\s\S]*?if \(r === "SUPER_ADMIN" \|\| r\.includes\("SUPER"\) \|\| r === "ADMIN" \|\| r === "WORKSPACE_ADMIN" \|\| r === "OWNER"\) return false;[\s\S]*?return true;/
  );
});

// ---------------------------------------------------------------------------
// 2. Behavioral Testing of the Role Filter Algorithm
// ---------------------------------------------------------------------------
function isRoleEligibleForAssignment(role) {
  const r = (role || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (r === "SUPER_ADMIN" || r.includes("SUPER") || r === "ADMIN" || r === "WORKSPACE_ADMIN" || r === "OWNER") return false;
  return true;
}

test("Empirical Role Filter: Canonical roles specified in Dispatch", () => {
  const testMatrix = [
    { role: "SUPER_ADMIN", expected: false, category: "Executive (Super Admin enum)" },
    { role: "Platform Super Admin", expected: false, category: "Executive (Super Admin title)" },
    { role: "ADMIN", expected: false, category: "Executive (Company Admin enum)" },
    { role: "Workspace Admin", expected: false, category: "Executive (Workspace Admin title)" },
    { role: "OWNER", expected: false, category: "Executive (Workspace Owner)" },
    { role: "MANAGER", expected: true, category: "Operational (Sales Manager)" },
    { role: "CLOSER", expected: true, category: "Operational (Closer)" },
    { role: "SALES_AGENT", expected: true, category: "Operational (Sales Agent enum)" },
  ];

  for (const item of testMatrix) {
    const result = isRoleEligibleForAssignment(item.role);
    assert.equal(
      result,
      item.expected,
      `Role '${item.role}' (${item.category}) failed filter assertion: got ${result}, expected ${item.expected}`
    );
  }
});

test("Empirical Role Filter: Adversarial casing and operational CRM roles", () => {
  const adversarialMatrix = [
    // Case sensitivity
    { role: "super_admin", expected: false },
    { role: "admin", expected: false },
    { role: "workspace admin", expected: false },
    { role: "workspace_admin", expected: false },
    { role: "owner", expected: false },
    { role: "manager", expected: true },
    { role: "closer", expected: true },
    { role: "sales_agent", expected: true },

    // Substrings with SUPER
    { role: "Platform Super Admin", expected: false },
    { role: "SUPERVISOR", expected: false },
    { role: "Global Super User", expected: false },

    // Operational roles from Postgres / Prisma schema
    { role: "OPERATIONS", expected: true },
    { role: "EDITOR", expected: true },
    { role: "CUSTOMER", expected: true },
    { role: "SALES CLOSER", expected: true },
    { role: "Senior Sales Closer", expected: true },

    // Nil / Empty / Nullish
    { role: null, expected: true },
    { role: undefined, expected: true },
    { role: "", expected: true },
  ];

  for (const item of adversarialMatrix) {
    const result = isRoleEligibleForAssignment(item.role);
    assert.equal(
      result,
      item.expected,
      `Adversarial role '${item.role}' failed assertion: got ${result}, expected ${item.expected}`
    );
  }
});

test("Empirical Role Filter: Adversarial Untrimmed Whitespace Analysis", () => {
  // Testing behavior with leading/trailing whitespace
  // With updated implementation: (role || "").trim().toUpperCase().replace(/\s+/g, "_")
  // "  Admin  " becomes "ADMIN", which matches "ADMIN" and is excluded
  // "  Workspace Admin  " becomes "WORKSPACE_ADMIN", which matches "WORKSPACE_ADMIN" and is excluded
  // "  Super Admin  " becomes "SUPER_ADMIN", which matches and is excluded
  const untrimmedAdminResult = isRoleEligibleForAssignment("  ADMIN  ");
  const untrimmedWorkspaceAdminResult = isRoleEligibleForAssignment("  Workspace Admin  ");
  const untrimmedSuperResult = isRoleEligibleForAssignment("  Super Admin  ");
  const trimmedAdminResult = isRoleEligibleForAssignment("  ADMIN  ".trim());

  // Document empirical findings: all executive roles are excluded even with leading/trailing spaces
  assert.equal(untrimmedSuperResult, false, "SUPER is caught even with spaces");
  assert.equal(trimmedAdminResult, false, "Trimmed ADMIN is strictly excluded");
  assert.equal(untrimmedAdminResult, false, "Untrimmed ADMIN is strictly excluded thanks to .trim()");
  assert.equal(untrimmedWorkspaceAdminResult, false, "Untrimmed Workspace Admin is strictly excluded thanks to .trim()");
});

// ---------------------------------------------------------------------------
// 3. Empirical XLSX Binary Parser Verification vs Buggy Plaintext Parser
// ---------------------------------------------------------------------------
test("LeadImportView.tsx source contains XLSX library imports and binary arrayBuffer reader", () => {
  assert.match(leadImportSrc, /import \* as XLSX from ["']xlsx["'];/);
  assert.match(leadImportSrc, /const isExcel = file\.name\.toLowerCase\(\)\.endsWith\("\.xlsx"\) \|\| file\.name\.toLowerCase\(\)\.endsWith\("\.xls"\);/);
  assert.match(leadImportSrc, /const buffer = await file\.arrayBuffer\(\);/);
  assert.match(leadImportSrc, /const workbook = XLSX\.read\(buffer, \{ type: "array" \}\);/);
  assert.match(leadImportSrc, /const rawRows = XLSX\.utils\.sheet_to_json<Record<string, unknown>>\(sheet, \{ defval: "" \}\);/);
});

test("Empirical XLSX Parser: Demonstrates old plaintext bug vs new XLSX binary fidelity", () => {
  // Ground truth dataset
  const groundTruthRows = [
    {
      "Lead Name": "Aarav Sharma",
      "Phone": "+919876543210",
      "Email": "aarav.sharma@enterprise.in",
      "Deal Value": "150000",
      "Source": "Meta Ads",
      "Segment": "B2B SaaS",
      "Notes": "Looking for 50 closer seats, high intent ₹ INR"
    },
    {
      "Lead Name": "Neha Gupta",
      "Phone": "+919812345678",
      "Email": "neha.gupta@fintech.co",
      "Deal Value": "75000",
      "Source": "IndiaMART",
      "Segment": "Fintech",
      "Notes": "Needs WhatsApp CRM integration with custom webhook 🚀"
    },
    {
      "Lead Name": "Vikram Malhotra",
      "Phone": "+919988776655",
      "Email": "vikram@agencygrowth.com",
      "Deal Value": "320000",
      "Source": "Website Inbound",
      "Segment": "Marketing Agency",
      "Notes": "Scheduled demo for Monday 11:00 AM IST"
    }
  ];

  // Create an in-memory XLSX workbook
  const worksheet = XLSX.utils.json_to_sheet(groundTruthRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Active_Leads");

  // Add a second sheet to stress-test sheet selection
  const archiveSheet = XLSX.utils.json_to_sheet([{ "Old ID": "999", "Reason": "Lost" }]);
  XLSX.utils.book_append_sheet(workbook, archiveSheet, "Archived_Leads");

  // Generate binary XLSX buffer (equivalent to file.arrayBuffer())
  const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  // 1. SIMULATE OLD BUGGY PLAINTEXT PARSER (as was in LeadImportView previously)
  // file.text() on binary xlsx returns UTF-8 decoded bytes of the raw ZIP container
  const rawText = xlsxBuffer.toString("utf8");
  const buggyLines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const buggyHeaders = buggyLines[0]?.split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));

  // Verify that the old plaintext approach produces ZIP binary garbage
  assert.ok(
    rawText.startsWith("PK\x03\x04") || rawText.includes("PK"),
    "ZIP container header signature 'PK' must be present in raw binary"
  );
  assert.notDeepEqual(
    buggyHeaders,
    Object.keys(groundTruthRows[0]),
    "Old plaintext parser completely fails on XLSX, extracting binary garbage rather than CSV headers"
  );

  // 2. SIMULATE NEW IMPLEMENTED XLSX PARSER (LeadImportView.tsx:173-195)
  // Converting buffer to Uint8Array/ArrayBuffer for XLSX.read(buffer, { type: 'array' })
  const arrayBuffer = xlsxBuffer.buffer.slice(xlsxBuffer.byteOffset, xlsxBuffer.byteOffset + xlsxBuffer.byteLength);
  const parsedWorkbook = XLSX.read(arrayBuffer, { type: "array" });

  // Assert workbook sheets
  assert.equal(parsedWorkbook.SheetNames[0], "Active_Leads");
  assert.equal(parsedWorkbook.SheetNames[1], "Archived_Leads");

  const activeSheet = parsedWorkbook.Sheets[parsedWorkbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(activeSheet, { defval: "" });

  assert.equal(rawRows.length, groundTruthRows.length, "Row count must exactly match ground truth");

  const headers = Object.keys(rawRows[0]);
  const groundTruthHeaders = Object.keys(groundTruthRows[0]);
  assert.deepEqual(headers, groundTruthHeaders, "Headers extracted must 100% match ground truth headers");

  // Transform into LeadImportView format
  const rows = rawRows.map((r) => {
    const obj = {};
    headers.forEach((h) => {
      obj[h] = String(r[h] ?? "").trim();
    });
    return obj;
  });

  // Verify all cell contents, formatting, and unicode characters
  for (let i = 0; i < groundTruthRows.length; i++) {
    for (const h of headers) {
      assert.equal(
        rows[i][h],
        groundTruthRows[i][h],
        `Row ${i} Column '${h}' mismatch: got '${rows[i][h]}', expected '${groundTruthRows[i][h]}'`
      );
    }
  }

  // Verify special characters and emojis preserved
  assert.ok(rows[0]["Notes"].includes("₹ INR"), "Indian Rupee sign must be preserved");
  assert.ok(rows[1]["Notes"].includes("🚀"), "Rocket emoji must be preserved");
});

test("Empirical XLSX Parser: Edge cases (empty sheets, corrupt ZIP, arbitrary bytes, defval fallback)", () => {
  // Edge Case 1: Empty Sheet with only headers
  const emptySheet = XLSX.utils.aoa_to_sheet([["Name", "Phone", "Email"]]);
  const emptyWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(emptyWb, emptySheet, "Empty");
  const emptyBuf = XLSX.write(emptyWb, { type: "buffer", bookType: "xlsx" });

  const parsedEmptyWb = XLSX.read(emptyBuf, { type: "array" });
  const parsedEmptySheet = parsedEmptyWb.Sheets[parsedEmptyWb.SheetNames[0]];
  const emptyRows = XLSX.utils.sheet_to_json(parsedEmptySheet, { defval: "" });
  assert.equal(emptyRows.length, 0, "Sheet with only headers correctly returns 0 data rows");

  // Edge Case 2: Corrupted ZIP buffer throws catchable exception
  const corruptZipBuffer = Buffer.from("PK\x03\x04corrupted_payload_that_fails_unzip");
  assert.throws(
    () => {
      XLSX.read(corruptZipBuffer, { type: "array" });
    },
    /ZIP|unsupported|corrupted|bad/i,
    "Corrupted ZIP must throw catchable exception caught by try/catch in handleFileUpload"
  );

  // Edge Case 3: Arbitrary garbage bytes (non-ZIP) yields 0 data rows, caught by empty check
  const randomBytes = Buffer.from([0x00, 0x11, 0x22, 0x33]);
  const garbageWb = XLSX.read(randomBytes, { type: "array" });
  const garbageRows = XLSX.utils.sheet_to_json(garbageWb.Sheets[garbageWb.SheetNames[0]], { defval: "" });
  assert.equal(garbageRows.length, 0, "Arbitrary non-ZIP bytes produces 0 data rows, safely handled");

  // Edge Case 4: Missing cell values default to "" (defval)
  const sparseRows = [
    { Name: "Lead 1", Phone: "9999999999", Email: "" },
    { Name: "Lead 2", Phone: "", Email: "lead2@example.com" }
  ];
  const sparseSheet = XLSX.utils.json_to_sheet(sparseRows);
  const sparseWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(sparseWb, sparseSheet, "Sparse");
  const sparseBuf = XLSX.write(sparseWb, { type: "buffer", bookType: "xlsx" });

  const parsedSparseWb = XLSX.read(sparseBuf, { type: "array" });
  const rawSparseRows = XLSX.utils.sheet_to_json(parsedSparseWb.Sheets[parsedSparseWb.SheetNames[0]], { defval: "" });

  assert.equal(rawSparseRows[0].Email, "");
  assert.equal(rawSparseRows[1].Phone, "");
});
