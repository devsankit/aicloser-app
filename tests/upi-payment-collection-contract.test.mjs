import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schema = read("prisma/schema.prisma");
const service = read("src/lib/upi-payment-collection.ts");
const publicPage = read("src/app/pay/[token]/page.tsx");
const publicRoute = read("src/app/api/payment-links/public/[token]/route.ts");
const confirmRoute = read("src/app/api/payment-links/public/[token]/confirm/route.ts");
const approvalRoute = read("src/app/api/payment-links/[id]/approve/route.ts");
const rejectionRoute = read("src/app/api/payment-links/[id]/reject/route.ts");

test("UPI collection is durable, tenant-aware, and uses local QR generation", () => {
  assert.match(schema, /model UpiPaymentSetting/);
  assert.match(schema, /model UpiPaymentLink/);
  assert.match(schema, /model UpiPaymentEvent/);
  assert.match(schema, /tenantId\s+String/);
  assert.match(service, /QRCode\.toDataURL/);
  assert.match(service, /randomBytes\(24\)/);
  assert.match(service, /upi-payment-proofs/);
  assert.doesNotMatch(service, /qrserver|firebase|googleapis/i);
});

test("public payment pages and APIs are excluded from search indexing", () => {
  assert.match(publicPage, /index: false/);
  assert.match(publicPage, /noarchive: true/);
  assert.match(publicRoute, /X-Robots-Tag/);
  assert.match(confirmRoute, /X-Robots-Tag/);
});

test("customer confirmation does not equal approval", () => {
  assert.match(service, /status: "CUSTOMER_CONFIRMED"/);
  assert.match(service, /status: "PAID"/);
  assert.match(approvalRoute, /requireSessionRole\(\["ADMIN", "SALES_AGENT"\]\)/);
  assert.match(approvalRoute, /tenantForSession/);
  assert.match(service, /closerCanApprovePayment/);
  assert.match(service, /Closer approval is not enabled for this workspace/);
  assert.match(rejectionRoute, /requireSessionRole\(\["ADMIN"\]\)/);
  assert.doesNotMatch(approvalRoute, /SUPER_ADMIN/);
});
