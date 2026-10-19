import { chromium } from 'playwright';

async function runVisualMouseTest() {
  console.log('🚀 Launching visible Google Chrome on your desktop...');
  
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    slowMo: 700, // 700ms pause on each action so you can follow the action
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null
  });

  const page = await context.newPage();

  // Helper function to install a visual cursor follower on the page
  const installVisualCursor = async () => {
    await page.evaluate(() => {
      if (document.getElementById('ai-visual-cursor')) return;
      const cursor = document.createElement('div');
      cursor.id = 'ai-visual-cursor';
      cursor.style.position = 'fixed';
      cursor.style.width = '24px';
      cursor.style.height = '24px';
      cursor.style.border = '2px solid #ef4444';
      cursor.style.backgroundColor = 'rgba(239, 68, 68, 0.35)';
      cursor.style.borderRadius = '50%';
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '999999';
      cursor.style.transition = 'transform 0.15s ease-out, background-color 0.2s';
      cursor.style.transform = 'translate(-50%, -50%)';
      cursor.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.8)';
      document.body.appendChild(cursor);

      window.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });
      window.addEventListener('mousedown', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
        cursor.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';
      });
      window.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        cursor.style.backgroundColor = 'rgba(239, 68, 68, 0.35)';
      });
    });
  };

  console.log('🌐 Step 1: Navigating to Closer UI Dashboard...');
  await page.goto('http://localhost:3050/dashboard', { waitUntil: 'networkidle' });
  await installVisualCursor();

  console.log('🌓 Step 2: Hovering and toggling Light / Dark Theme...');
  const lightBtn = page.getByRole('button', { name: 'Light' });
  await lightBtn.hover();
  await page.waitForTimeout(600);
  await lightBtn.click();

  await page.waitForTimeout(1000);
  const darkBtn = page.getByRole('button', { name: 'Dark' });
  await darkBtn.hover();
  await page.waitForTimeout(600);
  await darkBtn.click();

  console.log('📊 Step 3: Moving cursor to CRM Pipeline & Kanban in sidebar...');
  const pipelineLink = page.getByRole('link', { name: /CRM Pipeline/i });
  await pipelineLink.hover();
  await page.waitForTimeout(600);
  await pipelineLink.click();
  
  await page.waitForLoadState('networkidle');
  await installVisualCursor();
  await page.waitForTimeout(1000);

  console.log('➕ Step 4: Clicking "New lead C" button in sidebar...');
  const newLeadBtn = page.locator('button.rail-btn').first();
  await newLeadBtn.hover();
  await page.waitForTimeout(600);
  await newLeadBtn.click();
  await page.waitForTimeout(800);

  console.log('✍️ Step 5: Typing lead information into the dialog...');
  const nameInput = page.getByRole('textbox', { name: 'Name' });
  await nameInput.hover();
  await nameInput.click();
  await nameInput.fill('Aanya Sharma');

  const compInput = page.getByRole('textbox', { name: 'Company' });
  await compInput.hover();
  await compInput.click();
  await compInput.fill('Zenith Studios');

  const phoneInput = page.getByRole('textbox', { name: 'Phone' });
  await phoneInput.hover();
  await phoneInput.click();
  await phoneInput.fill('9876543210');

  const valueInput = page.getByRole('textbox', { name: 'Deal value (₹)' });
  await valueInput.hover();
  await valueInput.click();
  await valueInput.fill('250000');
  await page.waitForTimeout(800);

  console.log('💾 Step 6: Hovering and clicking "Add lead" button...');
  const addLeadBtn = page.getByRole('button', { name: 'Add lead', exact: true });
  await addLeadBtn.hover();
  await page.waitForTimeout(800);
  await addLeadBtn.click();
  await page.waitForTimeout(1500);

  console.log('📂 Step 7: Locating and clicking the new Aanya Sharma lead card...');
  const newCard = page.getByRole('button', { name: /Aanya Sharma/i }).first();
  await newCard.hover();
  await page.waitForTimeout(800);
  await newCard.click();

  console.log('🎉 Step 8: Lead Drawer opened! Keeping window open for 15 seconds for you to inspect...');
  await page.waitForTimeout(15000);

  console.log('✅ Visual test completed! Closing browser.');
  await browser.close();
}

runVisualMouseTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
