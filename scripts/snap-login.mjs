import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://localhost:3050/login", { waitUntil: "networkidle" });
  await page.screenshot({ path: "public/login-preview.png", fullPage: true });
  await browser.close();
  console.log("LOGIN_SCREENSHOT_CAPTURED");
}

main().catch(console.error);
