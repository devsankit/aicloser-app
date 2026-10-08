import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('credential forms never fall back to GET before hydration', () => {
  const source = readFileSync('src/components/sales/sales-auth.tsx', 'utf8');
  const forms = [...source.matchAll(/<form\b[^>]*>/g)].map(match => match[0]);
  assert.equal(forms.length, 3);
  for (const form of forms) assert.match(form, /method="post"/);
  assert.match(forms[0], /action="\/api\/sales\/auth\/signup"/);
  assert.match(forms[1], /action="\/api\/auth\/login\/password"/);
});
