import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:/Users/hello/.gemini/antigravity/brain/ebb5e11a-f931-48d8-9259-807ae4f95f64";
const TARGET_URL = "http://localhost:3010/settings";

async function main() {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
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

  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Scroll to AI Model Providers & BYOK Vault card
  const aiSection = page.locator('section:has-text("AI Model Providers & BYOK Vault")');
  await aiSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const shotPath = path.join(ARTIFACT_DIR, "07-settings-ai-vault-top.png");
  await aiSection.screenshot({ path: shotPath });
  console.log(`Saved element screenshot to: ${shotPath}`);

  await browser.close();
}

main().catch(console.error);
