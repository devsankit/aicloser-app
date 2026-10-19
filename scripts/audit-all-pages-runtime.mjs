import { chromium } from "playwright";

const BASE_URL = "http://localhost:3010";

const PAGES = [
  "/dashboard",
  "/pipeline",
  "/contacts",
  "/lead-import",
  "/calls",
  "/chat",
  "/forms",
  "/channels",
  "/whatsapp",
  "/automations",
  "/payments",
  "/team",
  "/settings",
  "/login",
  "/signup",
];

async function runAudit() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Get auth token
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

  const results = [];

  for (const path of PAGES) {
    const pageErrors = [];
    const consoleErrors = [];

    const onPageError = (err) => pageErrors.push(err.message);
    const onConsole = (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    };

    page.on("pageerror", onPageError);
    page.on("console", onConsole);

    try {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1000);

      // Check for React error overlay / nextjs error
      const hasErrorOverlay = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return (
          bodyText.includes("Runtime Error") ||
          bodyText.includes("Objects are not valid as a React child") ||
          bodyText.includes("Application error:") ||
          bodyText.includes("Internal Server Error")
        );
      });

      const title = await page.title();
      const status = (!hasErrorOverlay && pageErrors.length === 0) ? "PASS" : "FAIL";

      results.push({
        path,
        status,
        title,
        pageErrors: pageErrors.length,
        consoleErrors: consoleErrors.length,
        hasErrorOverlay,
      });

      console.log(`[${status}] ${path} - Title: "${title}" (PageErrors: ${pageErrors.length}, ErrorOverlay: ${hasErrorOverlay})`);
      if (pageErrors.length > 0) {
        console.error(`  Errors on ${path}:`, pageErrors);
      }
    } catch (e) {
      results.push({
        path,
        status: "FAIL",
        error: e.message,
      });
      console.error(`[FAIL] ${path} crashed:`, e.message);
    } finally {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
    }
  }

  console.log("\n=======================================================");
  console.log("PAGE AUDIT SUMMARY");
  console.log("=======================================================");
  console.table(results);

  await browser.close();
}

runAudit().catch(console.error);
