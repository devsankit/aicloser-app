import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:/Users/hello/.gemini/antigravity/brain/ebb5e11a-f931-48d8-9259-807ae4f95f64";

async function main() {
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

  await page.goto("http://localhost:3010/automations?tab=ai_byok", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const shotPath = path.join(ARTIFACT_DIR, "10-automations-byok-top-view.png");
  await page.screenshot({ path: shotPath });
  console.log(`Saved screenshot to: ${shotPath}`);

  await browser.close();
}

main().catch(console.error);
