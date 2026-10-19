import { chromium } from 'playwright';
import path from 'path';

async function main() {
  console.log('Testing launchPersistentContext...');
  const userDataDir = path.resolve('./test-chrome-profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    args: ['--start-maximized']
  });
  console.log('Context launched!');
  const page = context.pages()[0] || await context.newPage();
  await page.goto('http://localhost:3050/pipeline');
  console.log('Page loaded! Title:', await page.title());
  await page.waitForTimeout(4000);
  await context.close();
  console.log('Closed.');
}

main().catch(console.error);
