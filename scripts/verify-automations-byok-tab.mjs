import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:/Users/hello/.gemini/antigravity/brain/ebb5e11a-f931-48d8-9259-807ae4f95f64";

async function main() {
  console.log("Starting verification for shifted AI BYOK tab in AI Bot & Automations...");
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });

  const page = await context.newPage();

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

  // Step 1: Open /automations
  console.log("Navigating to http://localhost:3010/automations...");
  await page.goto("http://localhost:3010/automations", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Check 5 tabs exist
  const tabNames = [
    "Workflows & Rules",
    "Execution Run History",
    "AI Sales Agent & Prompts",
    "Safety Guardrails & Velocity",
    "AI Providers & BYOK Vault",
  ];

  for (const name of tabNames) {
    const count = await page.locator(`button:has-text("${name}")`).count();
    console.log(`Tab "${name}": ${count > 0 ? "FOUND" : "NOT FOUND"}`);
  }

  // Step 2: Click the AI Providers & BYOK Vault tab
  console.log("Clicking 'AI Providers & BYOK Vault' tab...");
  const byokTabBtn = page.locator('button:has-text("AI Providers & BYOK Vault")');
  await byokTabBtn.click();
  await page.waitForTimeout(800);

  // Check Groq Cloud Free Tier Banner and providers
  const groqBanner = await page.locator("text=Recommended Zero-Cost Setup: Groq Cloud").count();
  console.log(`Groq Banner in Automations: ${groqBanner > 0 ? "FOUND" : "NOT FOUND"}`);

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

  // Test entering a key into Groq input
  console.log("Entering test key into Groq Cloud input...");
  const groqInput = page.locator('input[placeholder*="gsk_"]').first();
  await groqInput.fill("gsk_free_tier_production_demo_key_789");
  await page.waitForTimeout(300);

  // Click Test Key
  const testBtns = page.locator('button:has-text("Test Key")');
  if (await testBtns.count() > 0) {
    await testBtns.first().click();
    console.log("Clicked 'Test Key' for Groq...");
    await page.waitForTimeout(800);
  }

  // Click Save & Apply AI Keys
  console.log("Clicking 'Save & Apply AI Keys'...");
  const saveBtn = page.locator('button:has-text("Save & Apply AI Keys")');
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForTimeout(1000);
  }

  // Capture screenshot of Automations with AI BYOK tab active
  const shotPath1 = path.join(ARTIFACT_DIR, "08-automations-ai-byok-tab.png");
  await page.screenshot({ path: shotPath1, fullPage: true });
  console.log(`Saved screenshot 1 to: ${shotPath1}`);

  // Step 3: Test Settings Launcher link
  console.log("Navigating to http://localhost:3010/settings to test launcher card...");
  await page.goto("http://localhost:3010/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const shotPath2 = path.join(ARTIFACT_DIR, "09-settings-launcher.png");
  await page.screenshot({ path: shotPath2, fullPage: true });
  console.log(`Saved screenshot 2 to: ${shotPath2}`);

  // Click the launcher button
  console.log("Clicking 'Open in Automations ↗' launcher button...");
  const launcher = page.locator('a:has-text("Open in Automations ↗")');
  await launcher.click();
  await page.waitForURL("**/automations?tab=ai_byok", { timeout: 5000 });
  await page.waitForTimeout(1000);

  const isTabActive = await page.locator('button[data-on="true"]:has-text("AI Providers & BYOK Vault")').count();
  console.log(`Target tab active via deep link: ${isTabActive > 0 ? "YES (PASSED)" : "NO"}`);

  await browser.close();
  console.log("All Automations AI BYOK tab verification steps completed!");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
