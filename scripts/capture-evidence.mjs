import { chromium } from "playwright";
import path from "path";

const BASE_URL = "http://localhost:3050";
const EMAIL = "anshitasales@gmail.com";
const PASSWORD = "Anshita@12345";
const OUT_DIR = "D:\\new aicloser UI\\evidence";

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Screenshot Login Page
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "01-login-screen.png") });
  console.log("Captured 01-login-screen.png");

  // Perform Login
  await page.fill("#auth-identifier", EMAIL);
  await page.fill("#auth-password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 15000 });

  // 2. Screenshot Dashboard Overview with Real Data
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "02-dashboard-real-data.png") });
  console.log("Captured 02-dashboard-real-data.png");

  // 3. Screenshot Pipeline Kanban & Open Lead Drawer
  await page.goto(`${BASE_URL}/pipeline`);
  await page.waitForSelector(".card.lead", { timeout: 15000 });
  const leadCard = await page.$(".card.lead");
  if (leadCard) {
    await leadCard.click();
    await page.waitForSelector(".drawer", { timeout: 5000 });
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "03-pipeline-kanban-drawer.png") });
  console.log("Captured 03-pipeline-kanban-drawer.png");

  // 4. Screenshot Calls Telephony & Audio Player
  await page.goto(`${BASE_URL}/calls`);
  await page.waitForSelector("table tbody tr", { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, "04-calls-audio-playback.png") });
  console.log("Captured 04-calls-audio-playback.png");

  // 5. Screenshot Settings Page
  await page.goto(`${BASE_URL}/settings`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, "05-settings-view.png") });
  console.log("Captured 05-settings-view.png");

  await browser.close();
  console.log("All evidence screenshots captured successfully!");
}

main().catch(console.error);
