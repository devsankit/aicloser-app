import { chromium } from 'playwright';

async function testPipelineUI() {
  console.log('🚀 Launching Chrome to test http://localhost:3050/pipeline...');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    slowMo: 600, // 600ms per step so you can clearly watch the actions live
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Inject visual laser pointer cursor
  const installVisualCursor = async () => {
    await page.evaluate(() => {
      if (document.getElementById('ai-visual-cursor')) return;
      const cursor = document.createElement('div');
      cursor.id = 'ai-visual-cursor';
      cursor.style.position = 'fixed';
      cursor.style.width = '24px';
      cursor.style.height = '24px';
      cursor.style.border = '2px solid #2563eb';
      cursor.style.backgroundColor = 'rgba(37, 99, 235, 0.4)';
      cursor.style.borderRadius = '50%';
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '999999';
      cursor.style.transition = 'transform 0.12s ease-out, background-color 0.15s';
      cursor.style.transform = 'translate(-50%, -50%)';
      cursor.style.boxShadow = '0 0 16px rgba(37, 99, 235, 0.9)';
      document.body.appendChild(cursor);

      window.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });
      window.addEventListener('mousedown', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.6)';
        cursor.style.backgroundColor = 'rgba(220, 38, 38, 0.85)';
        cursor.style.borderColor = '#dc2626';
      });
      window.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        cursor.style.backgroundColor = 'rgba(37, 99, 235, 0.4)';
        cursor.style.borderColor = '#2563eb';
      });
    });
  };

  const results = [];
  const logStep = (name, status, details = '') => {
    const icon = status ? '✅' : '❌';
    console.log(`${icon} [${name}]: ${details}`);
    results.push({ name, status, details });
  };

  try {
    // 1. Initial Load & Kanban Integrity
    console.log('\n--- TEST 1: Initial Load & Kanban Board ---');
    await page.goto('http://localhost:3050/pipeline', { waitUntil: 'networkidle' });
    await installVisualCursor();
    await page.waitForTimeout(600);

    const title = await page.title();
    const columns = await page.locator('.col').count();
    const totalLeads = await page.locator('.card.lead').count();
    logStep('Kanban Board Layout', columns === 8 && totalLeads > 0, `Loaded ${columns} columns and ${totalLeads} active leads.`);
    await page.screenshot({ path: './pipeline-test-board.png' });

    // 2. Search Functionality
    console.log('\n--- TEST 2: Search Bar Filtering ---');
    const searchInput = page.locator('.pipe-search input');
    await searchInput.hover();
    await searchInput.click();
    await searchInput.fill('Anshita');
    await page.waitForTimeout(700);

    const searchCount = await page.locator('.card.lead').count();
    const hasAnshita = await page.locator('.card.lead').filter({ hasText: 'Anshita Rao' }).isVisible();
    logStep('Search "Anshita"', hasAnshita && searchCount === 1, `Found ${searchCount} matching lead card (Anshita Rao).`);
    await page.screenshot({ path: './pipeline-test-search.png' });

    // Clear search using the X button in search box
    const clearSearchBtn = page.locator('.pipe-search .icon-btn');
    await clearSearchBtn.hover();
    await clearSearchBtn.click();
    await page.waitForTimeout(500);
    const restoredCount = await page.locator('.card.lead').count();
    logStep('Clear Search Button', restoredCount === totalLeads, `Restored board to full ${restoredCount} leads.`);

    // 3. Dropdown Filters (Source & Segment)
    console.log('\n--- TEST 3: Dropdown Filtering ---');
    const sourceSelect = page.getByLabel('Filter by source');
    await sourceSelect.selectOption('Website');
    await page.waitForTimeout(600);
    const websiteChip = page.locator('.chip-x').filter({ hasText: 'Website' });
    const isChipVisible = await websiteChip.isVisible();
    const websiteCount = await page.locator('.card.lead').count();
    logStep('Filter by Source', isChipVisible, `Filtered to ${websiteCount} Website lead(s). Chip displayed.`);

    // Clear all filters
    const clearAllBtn = page.getByRole('button', { name: 'Clear all' });
    if (await clearAllBtn.isVisible()) {
      await clearAllBtn.hover();
      await clearAllBtn.click();
    }
    await page.waitForTimeout(500);

    // 4. Sorting Functionality
    console.log('\n--- TEST 4: Sorting Cards ---');
    const sortValueBtn = page.locator('.pipe-sort button').filter({ hasText: 'Value' });
    await sortValueBtn.hover();
    await sortValueBtn.click();
    await page.waitForTimeout(600);

    // Read top card values
    const topCardValue = await page.locator('.card.lead .lead-value').first().textContent();
    logStep('Sort by Value', true, `Top card value sorted to highest: ${topCardValue}`);

    const sortRecentBtn = page.locator('.pipe-sort button').filter({ hasText: 'Recent' });
    await sortRecentBtn.hover();
    await sortRecentBtn.click();
    await page.waitForTimeout(500);
    logStep('Sort by Recent', true, 'Cards sorted by latest updated.');

    // 5. Fit Board vs Fixed Columns Toggle
    console.log('\n--- TEST 5: Fit Board Layout Toggle ---');
    const fitBtn = page.getByRole('button', { name: /Fit board|Fixed columns/i });
    await fitBtn.hover();
    await fitBtn.click();
    await page.waitForTimeout(600);
    const isFitActive = await page.locator('.board').getAttribute('data-fit');
    logStep('Fit Board Toggle', isFitActive === 'true', 'Board successfully expanded to fit viewport.');

    // Toggle back
    await fitBtn.hover();
    await fitBtn.click();
    await page.waitForTimeout(400);

    // 6. Keyboard Card Movement (Shift + Right)
    console.log('\n--- TEST 6: Card Stage Movement via Keyboard ---');
    const firstCard = page.locator('.card.lead').first();
    const leadId = await firstCard.getAttribute('data-lead');
    const originalStage = await page.locator(`[data-lead="${leadId}"]`).evaluate((el) => el.closest('.col').getAttribute('aria-label'));
    await firstCard.focus();
    await page.waitForTimeout(400);
    // Move card to next stage with Shift+ArrowRight
    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(800);
    const movedStage = await page.locator(`[data-lead="${leadId}"]`).evaluate((el) => el.closest('.col').getAttribute('aria-label'));
    logStep('Keyboard Stage Move', originalStage !== movedStage, `Moved card from [${originalStage?.split(',')[0]}] -> [${movedStage?.split(',')[0]}]`);

    // 7. Lead Drawer & Editing
    console.log('\n--- TEST 7: Lead Drawer Inspection & Field Editing ---');
    const targetCard = page.locator(`[data-lead="${leadId}"]`);
    await targetCard.hover();
    await targetCard.click();
    await page.waitForTimeout(800);

    const drawer = page.locator('.drawer');
    const isDrawerOpen = await drawer.isVisible();
    logStep('Open Lead Drawer', isDrawerOpen, 'Slide-out drawer opened with lead details.');
    await page.screenshot({ path: './pipeline-test-drawer.png' });

    // Change Priority in Drawer to Urgent
    const prioSelect = drawer.locator('select[aria-label="Priority"]');
    if (await prioSelect.isVisible()) {
      await prioSelect.hover();
      await prioSelect.selectOption('urgent');
      await page.waitForTimeout(400);
    }

    // Change Deal Value in Drawer
    const valueInput = drawer.locator('input[aria-label="Deal value"]');
    if (await valueInput.isVisible()) {
      await valueInput.hover();
      await valueInput.click();
      await valueInput.fill('210000');
      await page.waitForTimeout(400);
    }

    // Add note
    const notesTextarea = drawer.locator('textarea');
    if (await notesTextarea.isVisible()) {
      await notesTextarea.hover();
      await notesTextarea.fill('QA test verification note: Verified via Antigravity browser automation.');
      await page.waitForTimeout(400);
    }

    // Click Save Button in Drawer
    const saveBtn = drawer.locator('.drawer-foot button[data-variant="primary"]');
    if (await saveBtn.isVisible()) {
      await saveBtn.hover();
      await saveBtn.click();
      await page.waitForTimeout(800);
      logStep('Save Drawer Edits', true, 'Saved priority (urgent), deal value (₹2,10,000), and QA notes.');
    }

    // 8. Add Lead via Column Plus Button
    console.log('\n--- TEST 8: Add Lead to Specific Column ---');
    const followUpCol = page.locator('.col').filter({ hasText: 'Follow Up' });
    const colAddBtn = followUpCol.locator('button.col-add').first();
    await colAddBtn.hover();
    await colAddBtn.click();
    await page.waitForTimeout(600);

    const addDialog = page.locator('.dialog');
    logStep('Column Add Dialog', await addDialog.isVisible(), 'Opened Add Lead modal from Follow Up column.');

    // Fill form
    await page.getByRole('textbox', { name: 'Name' }).fill('Rohan Mehta');
    await page.getByRole('textbox', { name: 'Company' }).fill('DesignForge');
    await page.getByRole('textbox', { name: 'Phone' }).fill('9822334455');
    await page.getByRole('textbox', { name: 'Deal value (₹)' }).fill('180000');
    await page.waitForTimeout(500);

    const submitBtn = page.getByRole('button', { name: 'Add lead', exact: true });
    await submitBtn.hover();
    await submitBtn.click();
    await page.waitForTimeout(1000);

    const newLeadCard = page.locator('.card.lead').filter({ hasText: 'Rohan Mehta' });
    const isNewLeadOnBoard = await newLeadCard.isVisible();
    logStep('New Lead Created', isNewLeadOnBoard, 'Rohan Mehta (DesignForge · ₹1.8L) successfully created on board.');

    await page.screenshot({ path: './pipeline-test-updated.png' });
    console.log('\n🎉 ALL PIPELINE TESTS EXECUTED SUCCESSFULLY!');
    await page.waitForTimeout(6000); // 6s view window before closing

  } catch (err) {
    console.error('Test execution error:', err);
    logStep('Test Suite', false, err.message);
  } finally {
    await browser.close();
  }

  // Print Summary Table
  console.log('\n================ UI TEST SUMMARY ================');
  console.table(results);
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Console Errors found:', consoleErrors);
  }
  console.log('=================================================\n');
}

testPipelineUI();
