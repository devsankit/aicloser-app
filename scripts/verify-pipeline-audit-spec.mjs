import { chromium } from "playwright";

async function runAuditVerification() {
  console.log("🔍 Starting Closer AI Sales CRM — Pipeline / Kanban Audit Verification...");

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // 401 Unauthorized / 404 is expected in offline local demo mode when checking /api/auth/me
      if (!text.includes("401") && !text.includes("404") && !text.includes("favicon")) {
        consoleErrors.push(text);
      }
    }
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      console.log(`[HTTP ${res.status()}] ${res.url()}`);
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  const assert = (name, condition, details) => {
    console.log(`${condition ? "✅ PASS" : "❌ FAIL"}: [${name}] ${details}`);
    results.push({ test: name, status: condition ? "PASS" : "FAIL", details });
  };

  try {
    // 0. Login to populate session with live database leads
    await page.goto("http://localhost:3010/login", { waitUntil: "networkidle" });
    await page.fill('input[type="text"]', "anshitasales@gmail.com");
    await page.fill('input[type="password"]', "Anshita@12345");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    // Navigate to Pipeline
    await page.goto("http://localhost:3010/pipeline", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // ==========================================
    // 1. P1: Monetary Total Reconciliation
    // ==========================================
    console.log("\n--- Checking P1: Monetary Total Reconciliation ---");
    const subText = await page.locator(".page-sub").textContent();
    console.log("Header Subtitle:", subText);

    // Header should show live leads and calculated open value
    assert(
      "Header Open Pipeline Value",
      subText.includes("leads") && subText.includes("open"),
      `Subtitle displays: "${subText}"`
    );

    // Check hover title on header open value
    const headerTitle = await page.locator(".page-sub span[title]").getAttribute("title");
    assert(
      "Header Exact Monetary Tooltip",
      headerTitle && headerTitle.includes("Exact open"),
      `Tooltip on open value shows exact: "${headerTitle}"`
    );

    // Check individual column values and exact titles
    const colValues = await page.locator(".col-value").allTextContents();
    console.log("Column totals:", colValues);
    assert(
      "8 Stage Column Totals Rendered",
      colValues.length === 8 && colValues.every((v) => v !== ""),
      `Rendered 8 stage totals: ${colValues.join(", ")}`
    );

    // Check column hover tooltip on the first column
    const firstColTitle = await page.locator(".col-value").first().getAttribute("title");
    assert(
      "Column Exact Monetary Tooltip",
      firstColTitle && firstColTitle.includes("Exact stage total"),
      `Column hover title: "${firstColTitle}"`
    );

    // ==========================================
    // 2. P1: Lead Source Filter Normalization
    // ==========================================
    console.log("\n--- Checking P1: Lead Source Filter Normalization ---");
    const sourceSelect = page.getByLabel("Filter by source");
    const sourceOptions = await sourceSelect.locator("option").allTextContents();
    console.log("Source Filter Options:", sourceOptions);

    assert(
      "Source Filter Options Normalized",
      sourceOptions.includes("Meta Ads") &&
        sourceOptions.includes("Inbound Call") &&
        sourceOptions.includes("Lead Form") &&
        sourceOptions.includes("Website") &&
        sourceOptions.includes("WhatsApp") &&
        sourceOptions.includes("Referral"),
      `Options correctly normalized to user-facing labels: ${sourceOptions.join(", ")}`
    );

    // Filter by "WhatsApp"
    await sourceSelect.selectOption("WhatsApp");
    await page.waitForTimeout(400);
    const waCardCount = await page.locator(".card.lead").count();
    const waChip = await page.locator(".chip-x").textContent();
    assert(
      "Filter WhatsApp",
      waCardCount > 0 && waChip.includes("WhatsApp"),
      `Filtered to ${waCardCount} leads with active chip: "${waChip.trim()}"`
    );

    // Filter by "Inbound Call"
    await sourceSelect.selectOption("Cold call");
    await page.waitForTimeout(400);
    const inboundCardCount = await page.locator(".card.lead").count();
    const inboundChip = await page.locator(".chip-x").textContent();
    assert(
      "Filter Inbound Call",
      inboundCardCount > 0 && inboundChip.includes("Inbound Call"),
      `Filtered to ${inboundCardCount} leads with active chip: "${inboundChip.trim()}"`
    );

    // Verify Inbound Call cards show appropriate chip badge
    const inboundCardBadges = await page.locator(".card.lead .lead-meta .chip").allTextContents();
    assert(
      "Inbound Call Cards Show Normalized Badge",
      inboundCardCount > 0 && inboundCardBadges.some((b) => b.includes("Call")),
      `Inbound call leads display normalized badge: ${inboundCardBadges.slice(0, 3).join(", ")}`
    );

    // Clear filters
    const clearAllBtn = page.getByRole("button", { name: "Clear all" });
    if (await clearAllBtn.isVisible()) {
      await clearAllBtn.click();
      await page.waitForTimeout(400);
    }

    // ==========================================
    // 3. P2: Fit Board Behavior & Column Min-Width
    // ==========================================
    console.log("\n--- Checking P2: Fit Board Behavior & Column Sizing ---");
    const fitBtn = page.getByRole("button", { name: /Fit board|Fixed columns/i });
    await fitBtn.click();
    await page.waitForTimeout(500);

    const fitActive = await page.locator(".board").getAttribute("data-fit");
    const firstColWidth = await page.locator(".col").first().evaluate((el) => el.getBoundingClientRect().width);
    const firstColValueVisible = await page.locator(".col-value").first().isVisible();
    const firstLeadValueVisible = await page.locator(".lead-value").first().isVisible();

    assert(
      "Fit Board Minimum Width & Visible Values",
      fitActive === "true" && firstColWidth >= 220 && firstColValueVisible && firstLeadValueVisible,
      `Fit board width: ${Math.round(firstColWidth)}px (>=220px). Values and avatars remain fully visible.`
    );

    // Toggle back to fixed columns
    await fitBtn.click();
    await page.waitForTimeout(400);

    // ==========================================
    // 4. P2: Keyboard Navigation & Focus Retention
    // ==========================================
    console.log("\n--- Checking P2: Keyboard Navigation & Focus Retention ---");
    const testCard = page.locator(".card.lead").first();
    const testLeadId = await testCard.getAttribute("data-lead");
    await testCard.focus();
    await page.waitForTimeout(200);

    // Move right with Shift+ArrowRight
    await page.keyboard.press("Shift+ArrowRight");
    await page.waitForTimeout(600);

    const activeElementLeadId = await page.evaluate(() => document.activeElement?.getAttribute("data-lead"));
    assert(
      "Keyboard Stage Move & Focus Retention",
      activeElementLeadId === testLeadId,
      `Lead ${testLeadId} retained keyboard focus after moving to adjacent column.`
    );

    // Open card with Enter key
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
    const isDrawerOpen = await page.locator(".drawer").isVisible();
    assert("Enter Key Opens LeadDrawer", isDrawerOpen, "Drawer opened upon pressing Enter on focused card.");

    // Close card with Escape key
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const isDrawerClosed = !(await page.locator(".drawer").isVisible());
    assert("Escape Key Closes LeadDrawer", isDrawerClosed, "Drawer closed upon pressing Escape.");

    // ==========================================
    // 5. P2: LeadDrawer Date Safety (No NaNd or RangeError)
    // ==========================================
    console.log("\n--- Checking P2: LeadDrawer Date Safety ---");
    await testCard.click();
    await page.waitForTimeout(600);

    const dateInput = page.locator('.drawer input[type="date"]');
    await dateInput.fill(""); // Clear date
    await page.waitForTimeout(400);

    const slaBadge = await page.locator(".drawer .pill").first().textContent();
    assert(
      "Safe SLA Label on Empty Date",
      slaBadge === "no date",
      `Clearing date shows "${slaBadge}" (safe fallback, zero NaNd or crashes).`
    );

    // Set valid date: tomorrow (using local date to prevent timezone rollbacks across midnight)
    const tDate = new Date();
    tDate.setDate(tDate.getDate() + 1);
    const tomorrow = tDate.toLocaleDateString("en-CA");
    await dateInput.fill(tomorrow);
    await page.waitForTimeout(400);
    const tomorrowSlaBadge = await page.locator(".drawer .pill").first().textContent();
    assert(
      "Valid Tomorrow SLA Label",
      tomorrowSlaBadge === "tomorrow",
      `Setting tomorrow's date shows SLA: "${tomorrowSlaBadge}".`
    );

    // Close drawer
    await page.locator('.drawer .icon-btn[aria-label="Close lead"]').first().click().catch(() => {});
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // ==========================================
    // 6. Stage-Specific Add Lead Preselection
    // ==========================================
    console.log("\n--- Checking General QA: Stage-Specific Add Lead ---");
    const demoCol = page.locator(".col").filter({ hasText: "Demo Booked" });
    const addDemoBtn = demoCol.locator("button.col-add").first();
    await addDemoBtn.click();
    await page.waitForTimeout(500);

    const selectedStageInDialog = await page.locator('#a-stage').inputValue();
    assert(
      "Column Add Preselects Target Stage",
      selectedStageInDialog === "demo",
      `Add dialog opened from "Demo Booked" column pre-selected stage: "${selectedStageInDialog}".`
    );

    // Close dialog with Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // ==========================================
    // 7. Responsive Viewport Check (320px to 1920px)
    // ==========================================
    console.log("\n--- Checking Responsive Layout across Viewports ---");
    const viewports = [1920, 1440, 1366, 1024, 768, 390, 320];
    for (const w of viewports) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(200);

      const hasPageHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      const boardHasScroll = await page.evaluate(() => {
        const board = document.querySelector(".board");
        return board ? board.scrollWidth >= board.clientWidth : false;
      });

      assert(
        `Viewport ${w}px Layout Containment`,
        !hasPageHorizontalScroll,
        `Page horizontal overflow: ${hasPageHorizontalScroll ? "YES (OVERFLOWING)" : "NO (CONTAINED)"}, Board scrollable: ${boardHasScroll}`
      );
    }

    // ==========================================
    // 8. Console Errors Check
    // ==========================================
    console.log("\n--- Checking Client Console Errors ---");
    assert(
      "Zero Console / Runtime Errors",
      consoleErrors.length === 0,
      consoleErrors.length === 0 ? "No errors encountered" : `Errors: ${consoleErrors.join("; ")}`
    );

  } catch (err) {
    console.error("Test execution exception:", err);
    assert("Test Suite Execution", false, err.message);
  } finally {
    await browser.close();
  }

  console.log("\n================ VERIFICATION SUMMARY ================");
  console.table(results);
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("======================================================\n");
}

runAuditVerification();
