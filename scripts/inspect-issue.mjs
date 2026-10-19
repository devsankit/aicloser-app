import { chromium } from 'playwright';

async function checkIssues() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleMsgs = [];
  page.on('console', (msg) => {
    consoleMsgs.push({ type: msg.type(), text: msg.text() });
  });

  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message + '\n' + (err.stack || ''));
  });

  console.log('Navigating to http://localhost:3010/team ...');
  await page.goto('http://localhost:3010/team', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Click the red pill badge if present to open the dialog
  const pillClicked = await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal');
    if (!portal || !portal.shadowRoot) return false;
    const toast = portal.shadowRoot.querySelector('button, [data-nextjs-toast]');
    if (toast) {
      toast.click();
      return true;
    }
    return false;
  });

  await page.waitForTimeout(1000);

  const nextErrorDetails = await page.evaluate(() => {
    const errorEl = document.querySelector('nextjs-portal');
    if (!errorEl) return 'No nextjs-portal found';
    const shadow = errorEl.shadowRoot;
    if (!shadow) return 'Portal found but no shadow root';
    return shadow.innerHTML;
  });

  console.log('--- PAGE ERRORS ---');
  console.log(pageErrors);

  console.log('--- CONSOLE ERRORS & WARNINGS ---');
  const errLogs = consoleMsgs.filter((m) => m.type === 'error' || m.type === 'warning');
  console.log(errLogs);

  console.log('--- NEXTJS OVERLAY RAW TEXT ---');
  // strip tags
  console.log(nextErrorDetails.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000));

  await browser.close();
}

checkIssues().catch(console.error);
