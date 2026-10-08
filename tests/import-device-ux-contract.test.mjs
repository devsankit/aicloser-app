import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('import review is available in both contact and lead import views', () => {
  const source = readFileSync('src/components/sales/contacts-hub.tsx', 'utf8');
  assert.ok(source.includes('{(importPreview || lastImportReport) ?'));
  assert.ok(source.includes('Import ${importPreview.valid} contacts'));
  assert.ok(source.includes('Email (optional)'));
});
test('Google Contacts phone columns are accepted without an email', () => {
  const source = readFileSync('src/app/api/sales/leads/import/route.ts', 'utf8');
  assert.ok(source.includes('"phone 1 - value"'));
  assert.ok(source.includes('if (!parsed.customerPhone && !parsed.customerEmail)'));
});
test('device table is mounted only on the dashboard', () => {
  const source = readFileSync('src/components/sales/sales-dashboard.tsx', 'utf8');
  assert.equal(source.match(/<TeamActivityPanel \/>/g)?.length, 1);
  assert.ok(source.includes('<section className="sales-dashboard-overview">\n          {canViewTeamData ? <TeamActivityPanel /> : null}'));
});
