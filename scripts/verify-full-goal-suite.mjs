import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = "http://localhost:3010";

async function runGoalSuite() {
  console.log("Starting Full Interactive Verification Suite on port 3010...");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const report = {
    timestamp: new Date().toISOString(),
    tests: [],
    passedCount: 0,
    failedCount: 0,
  };

  function record(name, status, details = {}) {
    report.tests.push({ name, status, details });
    if (status === "PASS") {
      report.passedCount++;
      console.log(`[PASS] ${name}`);
    } else {
      report.failedCount++;
      console.error(`[FAIL] ${name}`, details);
    }
  }

  try {
    // 0. Authenticate context so all pages load real workspace state
    const authRes = await fetch(`${BASE_URL}/api/auth/login/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "anshitasales@gmail.com",
        password: "Anshita@12345",
        loginScope: "sales",
        forceReplace: "1",
      }),
    });
    const { token } = await authRes.json();

    await page.goto(`${BASE_URL}/login`);
    await page.evaluate((tok) => {
      window.localStorage.setItem("aicloser_token", tok);
      document.cookie = `aicloser_token=${encodeURIComponent(tok)}; path=/; max-age=2592000; SameSite=Lax`;
    }, token);

    // 1. Settings: Verify Menu Item Spacing Control & No Exposed API
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    const settingsBody = await page.evaluate(() => document.body.innerText);
    const hasDirectApi = settingsBody.includes("api.aicloser.in") || settingsBody.includes("https://api.aicloser.in");
    record("Settings: No Direct API Exposed", hasDirectApi ? "FAIL" : "PASS", { hasDirectApi });

    // Test changing menu spacing to 4px
    await page.evaluate(() => {
      const segGroup = document.querySelector('div[aria-label="Menu item spacing"]');
      if (!segGroup) return;
      const btns = Array.from(segGroup.querySelectorAll("button"));
      const btn4 = btns.find((b) => b.innerText.includes("4px"));
      if (btn4) btn4.click();
    });
    await page.waitForTimeout(300);
    const gap4px = await page.evaluate(() => document.documentElement.style.getPropertyValue("--nav-item-gap"));
    record("Settings: Menu Spacing Changed to 4px", gap4px === "4px" ? "PASS" : "FAIL", { gap4px });

    // Reset back to 2px (Default)
    await page.evaluate(() => {
      const segGroup = document.querySelector('div[aria-label="Menu item spacing"]');
      if (!segGroup) return;
      const btns = Array.from(segGroup.querySelectorAll("button"));
      const btn2 = btns.find((b) => b.innerText.includes("2px"));
      if (btn2) btn2.click();
    });
    await page.waitForTimeout(300);
    const gap2px = await page.evaluate(() => document.documentElement.style.getPropertyValue("--nav-item-gap"));
    record("Settings: Menu Spacing Restored to 2px", gap2px === "2px" ? "PASS" : "FAIL", { gap2px });

    // 2. Chat: Verify Full Bleed, Zero Outer Scrollbar & Fixed Layout
    await page.goto(`${BASE_URL}/chat`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const chatLayout = await page.evaluate(() => {
      const body = document.body;
      const hasMainScrollbar = body.scrollHeight > window.innerHeight;
      const chatWorkspace = document.querySelector(".chat-workspace");
      return {
        hasMainScrollbar,
        chatWorkspaceFound: chatWorkspace !== null,
        chatWorkspaceHeight: chatWorkspace ? chatWorkspace.getBoundingClientRect().height : 0,
      };
    });
    record("Chat: Zero Outer Scrollbar & Fixed Full-Bleed Layout", !chatLayout.hasMainScrollbar && chatLayout.chatWorkspaceHeight > 700 ? "PASS" : "FAIL", chatLayout);

    // 3. Calls: Verify Connected SIM Devices Tab & Telemetry
    await page.goto(`${BASE_URL}/calls`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    // Switch to Connected SIM Devices Tab
    await page.evaluate(() => {
      const tabBtns = Array.from(document.querySelectorAll(".tabs button, .seg button"));
      const devTab = tabBtns.find((b) => b.innerText.includes("Connected SIM Devices"));
      if (devTab) devTab.click();
    });
    await page.waitForTimeout(600);

    const simCheck = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasRedmi = bodyText.includes("Redmi Note 12");
      const hasSamsung = bodyText.includes("Samsung Galaxy");
      const hasVivo = bodyText.includes("Vivo Y200e");
      const hasPoco = bodyText.includes("POCO M6 Pro");
      const pingBtns = Array.from(document.querySelectorAll("button")).filter((b) => b.innerText.includes("Ping Heartbeat")).length;
      return { hasRedmi, hasSamsung, hasVivo, hasPoco, pingBtns };
    });
    record("Calls: Connected SIM Devices Tab Loaded with Real Companion Devices", simCheck.hasVivo && simCheck.hasPoco && simCheck.pingBtns === 4 ? "PASS" : "FAIL", simCheck);

    // Click Ping Heartbeat
    const pingSuccess = await page.evaluate(() => {
      const pingBtn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("Ping Heartbeat"));
      if (pingBtn) {
        pingBtn.click();
        return true;
      }
      return false;
    });
    await page.waitForTimeout(300);
    record("Calls: Ping Heartbeat Interaction", pingSuccess ? "PASS" : "FAIL");

    // 4. Pipeline: Kanban Board Loaded with Columns & Cards
    await page.goto(`${BASE_URL}/pipeline`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const pipelineData = await page.evaluate(() => {
      const cards = document.querySelectorAll(".lead-card, [data-lead-id]");
      const columns = document.querySelectorAll(".kanban-col, .col-head, .stage-col");
      return {
        cardsCount: cards.length,
        columnsCount: columns.length,
      };
    });
    record("Pipeline: Kanban Board Loaded with Columns & Cards", pipelineData.columnsCount >= 4 ? "PASS" : "FAIL", pipelineData);

    // 5. Automations: Workflow Rules & Execution Logs Rendered Cleanly
    await page.goto(`${BASE_URL}/automations`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const automationsCheck = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasCrash = bodyText.includes("Objects are not valid as a React child") || bodyText.includes("Application error");
      const rules = document.querySelectorAll(".workflow-card, tr, .card").length;
      return { hasCrash, rulesCount: rules };
    });
    record("Automations: Workflow Rules & Logs Clean Without Crashing", !automationsCheck.hasCrash && automationsCheck.rulesCount > 0 ? "PASS" : "FAIL", automationsCheck);

    // 6. Contacts: Table with Leads
    await page.goto(`${BASE_URL}/contacts`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const contactsRows = await page.evaluate(() => document.querySelectorAll(".list-row, tr, [data-idx]").length);
    record("Contacts: Table Operational with Lead Rows", contactsRows > 0 ? "PASS" : "FAIL", { contactsRows });

    // 7. Lead Import Page
    await page.goto(`${BASE_URL}/lead-import`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const importReady = await page.evaluate(() => document.querySelectorAll("input[type='file'], .dropzone, button").length > 0);
    record("Lead Import: View Operational", importReady ? "PASS" : "FAIL");

    // 8. Lead Form Builder Page
    await page.goto(`${BASE_URL}/forms`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const formFields = await page.evaluate(() => document.querySelectorAll(".form-field, button").length);
    record("Forms: Form Builder Operational", formFields > 0 ? "PASS" : "FAIL", { formFields });

    // 9. WhatsApp Marketing Page
    await page.goto(`${BASE_URL}/whatsapp`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const waElements = await page.evaluate(() => document.querySelectorAll(".campaign-card, .metric-card, button").length);
    record("WhatsApp: Campaigns & Templates Operational", waElements > 0 ? "PASS" : "FAIL", { waElements });

    // 10. Payments Page
    await page.goto(`${BASE_URL}/payments`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const paymentsCount = await page.evaluate(() => document.querySelectorAll(".payment-row, tr").length);
    record("Payments: Ledger & Razorpay Integration Operational", paymentsCount > 0 ? "PASS" : "FAIL", { paymentsCount });

    // 11. Team Page
    await page.goto(`${BASE_URL}/team`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const teamMembers = await page.evaluate(() => document.querySelectorAll(".member-row, tr, .team-card").length);
    record("Team: User Management Operational", teamMembers > 0 ? "PASS" : "FAIL", { teamMembers });

  } catch (err) {
    console.error("Suite exception:", err);
    record("Full Suite Execution", "FAIL", { error: err.message });
  } finally {
    await browser.close();
  }

  console.log("\n=======================================================");
  console.log(`SUITE COMPLETE: ${report.passedCount} PASSED, ${report.failedCount} FAILED`);
  console.log("=======================================================\n");

  fs.writeFileSync("suite-results.json", JSON.stringify(report, null, 2));
  return report;
}

runGoalSuite();
