import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/hello/.gemini/antigravity/brain/ebb5e11a-f931-48d8-9259-807ae4f95f64';

async function inspectNextIssue() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Navigating to http://localhost:3010/team ...');
  await page.goto('http://localhost:3010/team', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Look for nextjs portal and click the badge
  const clicked = await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal');
    if (!portal || !portal.shadowRoot) return false;
    const toast = portal.shadowRoot.querySelector('[data-nextjs-toast], button, [class*="toast"], [class*="badge"]');
    if (toast) {
      toast.click();
      return true;
    }
    // Try finding any clickable element inside shadowRoot
    const all = portal.shadowRoot.querySelectorAll('*');
    for (const el of all) {
      if (el.textContent && el.textContent.includes('Issue')) {
        el.click();
        return true;
      }
    }
    return false;
  });

  console.log('Clicked badge:', clicked);
  await page.waitForTimeout(1000);

  // Take screenshot with dialog open
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'next-issue-dialog.png'),
    fullPage: false,
  });

  const dialogText = await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal');
    if (!portal || !portal.shadowRoot) return 'No portal';
    return portal.shadowRoot.innerHTML;
  });

  console.log('--- DIALOG HTML ---');
  console.log(dialogText.slice(0, 3000));

  await browser.close();
}

inspectNextIssue().catch(console.error);
