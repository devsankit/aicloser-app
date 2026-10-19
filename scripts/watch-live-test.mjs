import { chromium } from 'playwright';
import { exec } from 'child_process';

function focusChromeWindow() {
  const psCommand = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  }
"@
$proc = Get-Process chrome | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($proc) {
  [Win32]::ShowWindow($proc.MainWindowHandle, 3)
  [Win32]::SetForegroundWindow($proc.MainWindowHandle)
}
`;
  exec(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, ' ')}"`);
}

async function runWatchableLiveTest() {
  console.log('🚀 Launching Google Chrome directly onto your active screen...');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    slowMo: 1200, // 1.2s delay between actions so you can clearly see every move!
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--window-position=0,0'
    ]
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  // Bring Chrome window to front using OS API
  focusChromeWindow();

  // Helper function to install an on-screen HUD and visual cursor pointer
  const installOverlayHUD = async () => {
    await page.evaluate(() => {
      // 1. Live Banner HUD
      if (!document.getElementById('ai-test-hud')) {
        const hud = document.createElement('div');
        hud.id = 'ai-test-hud';
        hud.style.position = 'fixed';
        hud.style.top = '12px';
        hud.style.left = '50%';
        hud.style.transform = 'translateX(-50%)';
        hud.style.background = 'linear-gradient(135deg, #1e1b4b, #312e81)';
        hud.style.border = '2px solid #818cf8';
        hud.style.borderRadius = '9999px';
        hud.style.padding = '8px 24px';
        hud.style.color = '#ffffff';
        hud.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        hud.style.fontSize = '14px';
        hud.style.fontWeight = '600';
        hud.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(129, 140, 248, 0.5)';
        hud.style.zIndex = '9999999';
        hud.style.pointerEvents = 'none';
        hud.style.display = 'flex';
        hud.style.alignItems = 'center';
        hud.style.gap = '10px';
        hud.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;"></span><span id="ai-test-text">🤖 Antigravity AI: Initializing Test Suite...</span>';
        document.body.appendChild(hud);
      }

      // 2. High-visibility Laser Pointer Cursor
      if (!document.getElementById('ai-laser-pointer')) {
        const cursor = document.createElement('div');
        cursor.id = 'ai-laser-pointer';
        cursor.style.position = 'fixed';
        cursor.style.width = '30px';
        cursor.style.height = '30px';
        cursor.style.border = '3px solid #ef4444';
        cursor.style.backgroundColor = 'rgba(239, 68, 68, 0.45)';
        cursor.style.borderRadius = '50%';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '99999999';
        cursor.style.transition = 'transform 0.15s ease-out, background-color 0.2s';
        cursor.style.transform = 'translate(-50%, -50%)';
        cursor.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.95)';
        document.body.appendChild(cursor);

        window.addEventListener('mousemove', (e) => {
          cursor.style.left = e.clientX + 'px';
          cursor.style.top = e.clientY + 'px';
        });
        window.addEventListener('mousedown', () => {
          cursor.style.transform = 'translate(-50%, -50%) scale(0.55)';
          cursor.style.backgroundColor = 'rgba(239, 68, 68, 0.95)';
        });
        window.addEventListener('mouseup', () => {
          cursor.style.transform = 'translate(-50%, -50%) scale(1)';
          cursor.style.backgroundColor = 'rgba(239, 68, 68, 0.45)';
        });
      }
    });
  };

  const setStatus = async (text) => {
    console.log(`▶️ ${text}`);
    await page.evaluate((msg) => {
      const el = document.getElementById('ai-test-text');
      if (el) el.innerText = `🤖 Antigravity AI: ${msg}`;
    }, text);
    focusChromeWindow();
    await page.waitForTimeout(600);
  };

  // STEP 1: Navigate to Pipeline
  await setStatus('Navigating to http://localhost:3050/pipeline...');
  await page.goto('http://localhost:3050/pipeline', { waitUntil: 'networkidle' });
  await installOverlayHUD();
  focusChromeWindow();
  await page.waitForTimeout(1000);

  // STEP 2: Light / Dark Theme Toggle
  await setStatus('Step 1/8: Testing Light Theme toggle in top bar...');
  const lightBtn = page.getByRole('button', { name: 'Light' });
  await lightBtn.hover();
  await page.waitForTimeout(800);
  await lightBtn.click();
  await page.waitForTimeout(1200);

  await setStatus('Step 2/8: Testing Dark Theme toggle in top bar...');
  const darkBtn = page.getByRole('button', { name: 'Dark' });
  await darkBtn.hover();
  await page.waitForTimeout(800);
  await darkBtn.click();
  await page.waitForTimeout(1200);

  // STEP 3: Search Bar Filter
  await setStatus('Step 3/8: Searching for lead "Anshita" in search bar...');
  const searchInput = page.locator('.pipe-search input');
  await searchInput.hover();
  await searchInput.click();
  await searchInput.fill('Anshita');
  await page.waitForTimeout(1500);

  await setStatus('Clearing search filter with X icon...');
  const clearSearchBtn = page.locator('.pipe-search .icon-btn');
  await clearSearchBtn.hover();
  await clearSearchBtn.click();
  await page.waitForTimeout(1200);

  // STEP 4: Sort by Deal Value
  await setStatus('Step 4/8: Sorting Kanban board by highest Deal Value...');
  const sortValueBtn = page.locator('.pipe-sort button').filter({ hasText: 'Value' });
  await sortValueBtn.hover();
  await sortValueBtn.click();
  await page.waitForTimeout(1500);

  // STEP 5: Fit Board Toggle
  await setStatus('Step 5/8: Testing "Fit board" full-width responsive toggle...');
  const fitBtn = page.getByRole('button', { name: /Fit board|Fixed columns/i });
  await fitBtn.hover();
  await fitBtn.click();
  await page.waitForTimeout(1500);
  await fitBtn.hover();
  await fitBtn.click();
  await page.waitForTimeout(1000);

  // STEP 6: Shift + Right Arrow Keyboard Navigation
  await setStatus('Step 6/8: Testing keyboard shortcut Shift + ArrowRight to advance lead...');
  const firstCard = page.locator('.card.lead').first();
  const leadId = await firstCard.getAttribute('data-lead');
  await firstCard.focus();
  await page.waitForTimeout(800);
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(1500);

  // STEP 7: Open Lead Drawer & Edit Fields
  await setStatus('Step 7/8: Opening Lead Drawer and editing Priority & Deal Value...');
  const targetCard = page.locator(`[data-lead="${leadId}"]`);
  await targetCard.hover();
  await targetCard.click();
  await page.waitForTimeout(1200);

  const drawer = page.locator('.drawer');
  const prioSelect = drawer.locator('select[aria-label="Priority"]');
  if (await prioSelect.isVisible()) {
    await prioSelect.hover();
    await prioSelect.selectOption('urgent');
    await page.waitForTimeout(800);
  }

  const valueInput = drawer.locator('input[aria-label="Deal value"]');
  if (await valueInput.isVisible()) {
    await valueInput.hover();
    await valueInput.click();
    await valueInput.fill('225000');
    await page.waitForTimeout(800);
  }

  const saveBtn = drawer.locator('.drawer-foot button[data-variant="primary"]');
  if (await saveBtn.isVisible()) {
    await saveBtn.hover();
    await saveBtn.click();
    await page.waitForTimeout(1500);
  }

  // STEP 8: Create New Lead from Follow Up Column
  await setStatus('Step 8/8: Adding a new lead to the "Follow Up" column via + button...');
  const followUpCol = page.locator('.col').filter({ hasText: 'Follow Up' });
  const colAddBtn = followUpCol.locator('button.col-add').first();
  await colAddBtn.hover();
  await colAddBtn.click();
  await page.waitForTimeout(1200);

  await setStatus('Filling out modal form for Rohan Mehta (DesignForge)...');
  await page.getByRole('textbox', { name: 'Name' }).fill('Rohan Mehta');
  await page.waitForTimeout(600);
  await page.getByRole('textbox', { name: 'Company' }).fill('DesignForge');
  await page.waitForTimeout(600);
  await page.getByRole('textbox', { name: 'Phone' }).fill('9822334455');
  await page.waitForTimeout(600);
  await page.getByRole('textbox', { name: 'Deal value (₹)' }).fill('180000');
  await page.waitForTimeout(1000);

  const submitBtn = page.getByRole('button', { name: 'Add lead', exact: true });
  await submitBtn.hover();
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // COMPLETION: BROWSER WILL STAY OPEN FOREVER!
  await setStatus('🎉 ALL TESTS COMPLETED! Leaving this browser window open on your screen forever.');
  console.log('✅ TEST COMPLETE! Browser will remain open indefinitely for your inspection.');

  // Keep Node process alive so browser NEVER closes
  await new Promise(() => {});
}

runWatchableLiveTest().catch((err) => {
  console.error('Execution error:', err);
});
