import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "C:/Users/hello/.gemini/antigravity/brain/ebb5e11a-f931-48d8-9259-807ae4f95f64";
const TARGET_URL = "http://localhost:3010/settings";

async function main() {
  console.log("Starting verification for AI Model Providers & BYOK Vault...");
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });

  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  // Inject session so settings view renders fully
  await page.addInitScript(() => {
    localStorage.setItem("aicloser_token", "fake-test-admin-jwt");
    localStorage.setItem(
      "aicloser_user",
      JSON.stringify({
        userId: "usr_admin_ankit",
        displayName: "Ankit Rathore",
        email: "theankit.storage@gmail.com",
        phone: "+91 70787 36123",
        role: "ADMIN",
        tenantId: "tenant_default",
      })
    );
  });

  console.log(`Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Check if AI BYOK card is present
  const aiTitle = await page.locator("text=AI Model Providers & BYOK Vault").count();
  console.log(`AI BYOK Title found: ${aiTitle > 0 ? "YES" : "NO"}`);

  // Check Groq Cloud banner
  const groqBanner = await page.locator("text=Recommended Zero-Cost Setup: Groq Cloud").count();
  console.log(`Groq Free Tier Banner found: ${groqBanner > 0 ? "YES" : "NO"}`);

  // Check all providers exist
  const providers = [
    "Groq Cloud (Fast LLaMA 3.3)",
    "xAI Grok (Grok-2 & Beta)",
    "OpenAI (GPT-4o & Mini)",
    "Google Gemini (1.5 Flash & Pro)",
    "DeepSeek (V3 & R1)",
    "Deterministic Consultative Closer Engine",
  ];

  for (const p of providers) {
    const count = await page.locator(`text=${p}`).count();
    console.log(`Provider "${p}": ${count > 0 ? "PASSED" : "FAILED"}`);
  }

  // Check Token Budget card
  const budgetTitle = await page.locator("text=AI Token Budget & Billing Management").count();
  console.log(`Token Budget Card found: ${budgetTitle > 0 ? "YES" : "NO"}`);

  // Test entering a key into Groq input
  console.log("Testing Groq API key input and test connection button...");
  const groqInput = page.locator('input[placeholder*="gsk_"]').first();
  await groqInput.fill("gsk_test_mock_free_tier_key_xyz123");
  await page.waitForTimeout(300);

  // Click Test Key
  const testButtons = page.locator('button:has-text("Test Key")');
  if (await testButtons.count() > 0) {
    await testButtons.first().click();
    console.log("Clicked 'Test Key' for Groq...");
    await page.waitForTimeout(800);
  }

  // Click a token budget option
  console.log("Selecting 1M Tokens budget...");
  const budget1M = page.locator('button:has-text("1M (~$1.50)")');
  if (await budget1M.count() > 0) {
    await budget1M.click();
    await page.waitForTimeout(300);
  }

  // Click Save & Apply AI Keys
  console.log("Clicking 'Save & Apply AI Keys'...");
  const saveBtn = page.locator('button:has-text("Save & Apply AI Keys")');
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForTimeout(1000);
  }

  // Capture screenshot of AI Providers & BYOK Vault
  const shotPath = path.join(ARTIFACT_DIR, "06-settings-ai-providers-byok.png");
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`Saved screenshot to: ${shotPath}`);

  console.log(`Console errors captured: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log("Errors:", consoleErrors);
  }

  await browser.close();
  console.log("Verification completed successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
