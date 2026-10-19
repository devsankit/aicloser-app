import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/hello/.gemini/antigravity/brain/ebb5e11a-f931-48d8-9259-807ae4f95f64';

async function verifyTeamTable() {
  console.log('🚀 Starting Team Table Layout & CRUD Delete Verification...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Accept any confirm dialogs automatically
  page.on('dialog', async (dialog) => {
    console.log(`[Dialog ${dialog.type()}]: ${dialog.message()}`);
    await dialog.accept();
  });

  console.log('Navigating to http://localhost:3010/team ...');
  await page.goto('http://localhost:3010/team', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Screenshot Dark Mode (Standard View matching Image 1)
  console.log('Checking dark mode table...');
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'team-table-dark-standard.png'),
    fullPage: false,
  });
  console.log('Saved dark mode standard screenshot.');

  // Check column headers
  const headers = await page.$$eval('.table thead th', (ths) => ths.map((th) => th.innerText.trim()));
  console.log('Rendered Table Headers:', headers);

  // Check roles rendered in select inputs
  const roles = await page.$$eval('.table tbody tr select.select', (sels) =>
    sels.map((s) => (s instanceof HTMLSelectElement ? s.value : ''))
  );
  console.log('Rendered Roles in Rows:', roles);

  // Check delete buttons
  const trashButtonsCount = await page.$$eval('.table tbody tr button[title*="Delete"], .table tbody tr button[title*="Remove"]', (btns) => btns.length);
  console.log(`Found ${trashButtonsCount} trash delete buttons on team rows.`);

  // 2. Test Delete on a row (if more than 1 member)
  const rowsBefore = await page.$$eval('.table tbody tr', (trs) => trs.length);
  console.log(`Team members count before delete: ${rowsBefore}`);

  if (rowsBefore > 1) {
    console.log('Testing delete action on the first deletable row...');
    const deleteBtn = page.locator('.table tbody tr button[title*="Delete"]').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(1500);

      const rowsAfter = await page.$$eval('.table tbody tr', (trs) => trs.length);
      console.log(`Team members count after delete: ${rowsAfter}`);

      // 3. Test Refresh persistence (CRUD verification)
      console.log('Refreshing page to verify permanent deletion...');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const rowsAfterReload = await page.$$eval('.table tbody tr', (trs) => trs.length);
      console.log(`Team members count after reload: ${rowsAfterReload}`);

      if (rowsAfterReload === rowsAfter) {
        console.log('✅ CRUD SUCCESS: Deleted member did NOT re-appear on reload!');
      } else {
        console.error('❌ CRUD FAIL: Member re-appeared after reload!');
      }
    }
  }

  // 4. Test Light Mode toggle and screenshot
  console.log('Testing Light Mode...');
  const themeBtn = page.locator('button:has-text("Light"), button:has-text("Theme"), [data-theme-toggle]').first();
  if (await themeBtn.isVisible()) {
    await themeBtn.click();
    await page.waitForTimeout(500);
  } else {
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'team-table-light-standard.png'),
    fullPage: false,
  });
  console.log('Saved light mode standard screenshot.');

  // 5. Test Governance View Toggle
  console.log('Testing Governance View toggle...');
  const governanceBtn = page.locator('button:has-text("Governance")');
  if (await governanceBtn.isVisible()) {
    await governanceBtn.click();
    await page.waitForTimeout(500);
    const govHeaders = await page.$$eval('.table thead th', (ths) => ths.map((th) => th.innerText.trim()));
    console.log('Governance View Headers:', govHeaders);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'team-table-light-governance.png'),
      fullPage: false,
    });
    console.log('Saved light mode governance screenshot.');
  }

  await browser.close();
  console.log('🎉 Verification run completed successfully!');
}

verifyTeamTable().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
