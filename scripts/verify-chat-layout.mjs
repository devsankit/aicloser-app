import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Obtain fresh auth token
  const authRes = await fetch("http://localhost:3010/api/auth/login/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: "anshitasales@gmail.com",
      password: "Anshita@12345",
      loginScope: "sales",
      forceReplace: "1",
    }),
  });
  const authData = await authRes.json();
  const token = authData.token;
  console.log("Got fresh live token:", !!token);

  await page.goto("http://localhost:3010/login");
  await page.evaluate((tok) => {
    window.localStorage.setItem("aicloser_token", tok);
    document.cookie = `aicloser_token=${encodeURIComponent(tok)}; path=/; max-age=2592000; SameSite=Lax`;
  }, token);

  // 1. Verify /chat with live messages
  console.log("Navigating to /chat with live token...");
  await page.goto("http://localhost:3010/chat", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const chatMetrics = await page.evaluate(() => {
    const main = document.querySelector("main");
    const chatWorkspace = document.querySelector(".chat-workspace");
    const convRows = document.querySelectorAll("aside[aria-label='Conversations'] div[style*='cursor: pointer']");
    return {
      mainClass: main?.className,
      mainScrollHeight: main?.scrollHeight,
      mainClientHeight: main?.clientHeight,
      hasMainVerticalScrollbar: (main?.scrollHeight || 0) > (main?.clientHeight || 0),
      chatHeight: chatWorkspace?.clientHeight,
      conversationsCount: convRows.length,
    };
  });
  console.log("Live Chat Metrics:", JSON.stringify(chatMetrics, null, 2));
  await page.screenshot({ path: "01-chat-live-fixed.png" });
  console.log("Screenshot saved to 01-chat-live-fixed.png");

  // 2. Verify /calls Connected SIM Devices Tab
  console.log("Navigating to /calls...");
  await page.goto("http://localhost:3010/calls", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Find the exact Connected SIM Devices tab button
  const simTabButton = page.locator("div.seg button").filter({ hasText: "Connected SIM Devices" });
  await simTabButton.click();
  await page.waitForTimeout(1000);

  const deviceCards = await page.locator(".card").filter({ hasText: "Owner:" }).count();
  console.log("Connected SIM Devices cards visible:", deviceCards);
  await page.screenshot({ path: "02-calls-sim-devices-tab.png" });
  console.log("Screenshot saved to 02-calls-sim-devices-tab.png");

  // 3. Verify /settings Menu item spacing
  console.log("Navigating to /settings...");
  await page.goto("http://localhost:3010/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Click each spacing option to test reactivity
  const spacingButtons = page.locator(".setting-row").filter({ hasText: "Menu item spacing" }).locator("button");
  const count = await spacingButtons.count();
  console.log("Found spacing buttons:", count);

  // Click 4px (Relaxed)
  await spacingButtons.nth(2).click();
  await page.waitForTimeout(500);
  const gapValue = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--nav-item-gap"));
  console.log("Computed --nav-item-gap after clicking 4px:", gapValue.trim());

  // Click 2px (Default)
  await spacingButtons.nth(1).click();
  await page.waitForTimeout(500);
  const gapValue2 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--nav-item-gap"));
  console.log("Computed --nav-item-gap after clicking 2px:", gapValue2.trim());

  await page.screenshot({ path: "03-settings-spacing-control.png" });
  console.log("Screenshot saved to 03-settings-spacing-control.png");

  await browser.close();
}

run().catch(console.error);
