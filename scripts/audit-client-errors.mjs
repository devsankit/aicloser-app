import { chromium } from 'playwright';

const routes = [
  '/dashboard',
  '/pipeline',
  '/contacts',
  '/calls',
  '/chat',
  '/whatsapp',
  '/automations',
  '/channels',
  '/forms',
  '/payments',
  '/team',
  '/lead-import',
  '/settings',
  '/login'
];

async function runAudit() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const report = {};

  for (const r of routes) {
    const consoleErrors = [];
    const pageErrors = [];

    const onConsole = (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };
    const onPageError = (err) => {
      pageErrors.push(err.message || String(err));
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    try {
      const res = await page.goto('http://127.0.0.1:3050' + r, {
        waitUntil: 'networkidle',
        timeout: 10000
      }).catch(async () => {
        return await page.goto('http://127.0.0.1:3050' + r, { waitUntil: 'domcontentloaded', timeout: 5000 });
      });

      await page.waitForTimeout(1000);

      report[r] = {
        status: res ? res.status() : 'no-response',
        consoleErrors,
        pageErrors
      };
    } catch (e) {
      report[r] = {
        status: 'failed',
        error: e.message,
        consoleErrors,
        pageErrors
      };
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    }
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

runAudit();
