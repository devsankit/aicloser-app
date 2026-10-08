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
test('lead import has one source chooser and no prefilled sample contacts', () => {
  const source = readFileSync('src/components/sales/contacts-hub.tsx', 'utf8');
  assert.ok(source.includes('{!isLeadImportView && <div'));
  assert.ok(source.includes('const [rawPasteText, setRawPasteText] = useState("")'));
  assert.ok(source.includes('Choose an import source'));
  assert.ok(source.includes('setRawPasteText(e.target.value); setImportPreview(null)'));
});
test('discarding an import preview also clears the stale success banner', () => {
  const source = readFileSync('src/components/sales/contacts-hub.tsx', 'utf8');
  assert.ok(source.includes('const discardImportPreview = () =>'));
  assert.ok(source.includes('setImportPreview(null);\n    setBanner(null);'));
  assert.ok(source.includes('onClick={discardImportPreview}'));
});
test('device table is mounted only on the dashboard', () => {
  const source = readFileSync('src/components/sales/sales-dashboard.tsx', 'utf8');
  assert.equal(source.match(/<TeamActivityPanel \/>/g)?.length, 1);
  assert.ok(source.includes('<section className="sales-dashboard-overview">\n'));
  assert.ok(source.includes('<div className="sales-dashboard-device-activity">\n              <TeamActivityPanel />\n            </div>'));
  assert.ok(source.indexOf('sales-dashboard-device-activity') > source.indexOf('AdminTeamReportingPanel'));
});
