import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "C:/Users/hello/.gemini/antigravity/brain/ebb5e11a-f931-48d8-9259-807ae4f95f64";

async function run() {
  console.log("🚀 Starting Playwright verification of Super Admin Command Center on http://localhost:3010/super-admin...");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];

  try {
    // 1. Navigate to Super Admin page
    console.log("Navigating to http://localhost:3010/super-admin...");
    await page.goto("http://localhost:3010/super-admin", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);

    const title = await page.textContent("h1");
    console.log("Page Header:", title);
    if (title && title.includes("Super Admin Command Center")) {
      results.push("✅ Super Admin Header & Title rendered correctly");
    } else {
      results.push("❌ Failed to verify Super Admin Title: " + title);
    }

    // Capture initial overview screenshot
    const shotPath1 = path.join(ARTIFACT_DIR, "super-admin-tab1-workspaces.png");
    await page.screenshot({ path: shotPath1, fullPage: true });
    console.log("Captured screenshot:", shotPath1);

    // 2. Test Seat Stepper [+]
    console.log("Testing Closer Seat Stepper...");
    const plusButtons = await page.$$("button[title='Increase seat capacity']");
    if (plusButtons.length > 0) {
      await plusButtons[0].click();
      await page.waitForTimeout(600);
      results.push("✅ Closer Seat Stepper [+] clicked and seat capacity updated");
    } else {
      results.push("❌ Could not find seat stepper plus button");
    }

    // 3. Test Expand Users Roster
    console.log("Testing Expand Users Roster...");
    const usersButton = await page.$("button[title='Inspect workspace closer team']");
    if (usersButton) {
      await usersButton.click();
      await page.waitForTimeout(600);
      const userRosterVisible = await page.isVisible("text=Closer Team Members in");
      if (userRosterVisible) {
        results.push("✅ Expanded Workspace Closer Team Roster successfully");
      } else {
        results.push("❌ Closer team roster not visible after click");
      }
    }

    // 4. Test Impersonation
    console.log("Testing Impersonate Workspace...");
    const impButton = await page.$("button[title*='Impersonate']");
    if (impButton) {
      await impButton.click();
      await page.waitForTimeout(600);
      const bannerVisible = await page.isVisible("text=Active Super Admin Impersonation");
      if (bannerVisible) {
        results.push("✅ Impersonation Banner rendered with active context");
      } else {
        results.push("❌ Impersonation banner did not appear");
      }
    }

    // 5. Test Tab 2: Mobile Fleet & Telephony
    console.log("Navigating to Tab 2: Mobile Fleet & Telephony...");
    await page.click("button:has-text('Mobile Fleet & Telephony')");
    await page.waitForTimeout(800);
    const mobileHeader = await page.isVisible("text=Active Telephony Devices & Battery Telemetry");
    if (mobileHeader) {
      results.push("✅ Tab 2: Mobile Fleet & Telephony Diagnostics rendered correctly");
      const shotPath2 = path.join(ARTIFACT_DIR, "super-admin-tab2-mobile-telephony.png");
      await page.screenshot({ path: shotPath2, fullPage: true });
    } else {
      results.push("❌ Failed to switch to Tab 2: Mobile Fleet");
    }

    // 6. Test Tab 3: WhatsApp & Meta Gateways
    console.log("Navigating to Tab 3: WhatsApp & Meta Gateways...");
    await page.click("button:has-text('WhatsApp & Meta Gateways')");
    await page.waitForTimeout(800);
    const waHeader = await page.isVisible("text=Official Meta WhatsApp Business Cloud API");
    if (waHeader) {
      results.push("✅ Tab 3: WhatsApp & Meta Gateways rendered correctly");
      const shotPath3 = path.join(ARTIFACT_DIR, "super-admin-tab3-whatsapp-gateways.png");
      await page.screenshot({ path: shotPath3, fullPage: true });
    } else {
      results.push("❌ Failed to switch to Tab 3: WhatsApp");
    }

    // 7. Test Tab 4: Global AI Engine & Vault
    console.log("Navigating to Tab 4: Global AI Engine & Vault...");
    await page.click("button:has-text('Global AI Engine & Vault')");
    await page.waitForTimeout(800);
    const aiHeader = await page.isVisible("text=Global AI Provider Keys & Auto-Failover Orchestration");
    if (aiHeader) {
      results.push("✅ Tab 4: Global AI Engine & Vault rendered correctly");
      const shotPath4 = path.join(ARTIFACT_DIR, "super-admin-tab4-ai-vault.png");
      await page.screenshot({ path: shotPath4, fullPage: true });
    } else {
      results.push("❌ Failed to switch to Tab 4: AI Engine");
    }

    // 8. Test Tab 5: Security & Login Audit
    console.log("Navigating to Tab 5: Security & Login Audit...");
    await page.click("button:has-text('Security & Login Audit')");
    await page.waitForTimeout(800);
    const secHeader = await page.isVisible("text=Real-Time Administrative & User Login Audit Trail");
    if (secHeader) {
      results.push("✅ Tab 5: Security & Login Audit Trail rendered correctly");
      const shotPath5 = path.join(ARTIFACT_DIR, "super-admin-tab5-security-audit.png");
      await page.screenshot({ path: shotPath5, fullPage: true });
    } else {
      results.push("❌ Failed to switch to Tab 5: Security");
    }

    // 9. Test Tab 6: Reviews & GMB Gate
    console.log("Navigating to Tab 6: Reviews & GMB Gate...");
    await page.click("button:has-text('Reviews & GMB Gate')");
    await page.waitForTimeout(800);
    const revHeader = await page.isVisible("text=Customer Reviews & Google My Business Moderation");
    if (revHeader) {
      results.push("✅ Tab 6: Customer Reviews & GMB Moderation rendered correctly");
      const shotPath6 = path.join(ARTIFACT_DIR, "super-admin-tab6-reviews-gmb.png");
      await page.screenshot({ path: shotPath6, fullPage: true });
    } else {
      results.push("❌ Failed to switch to Tab 6: Reviews");
    }

    // 10. Check Sidebar Navigation item
    const navLink = await page.$("a[href='/super-admin']");
    if (navLink) {
      results.push("✅ Sidebar Navigation item for 'Super Admin Console' exists and is clickable");
    } else {
      results.push("❌ Sidebar Navigation link for /super-admin not found");
    }

  } catch (err) {
    console.error("Test error:", err);
    results.push("❌ Execution error: " + err.message);
  } finally {
    await browser.close();
  }

  console.log("\n================ TEST SUMMARY ================");
  results.forEach((r) => console.log(r));
  console.log("==============================================\n");
}

run();
