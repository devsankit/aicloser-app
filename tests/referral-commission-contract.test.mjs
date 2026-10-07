import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("outbound Android app redirect /go/app routes with referral token", async () => {
  await access(new URL("../src/app/go/app/route.ts", import.meta.url));
  const goAppRoute = await source("src/app/go/app/route.ts");
  assert.match(goAppRoute, /play\.google\.com\/store\/apps\/details\?id=com\.gigxomi\.(?:gxclosers|app)/);
  assert.match(goAppRoute, /trackSalesReferralEvent/);
  assert.match(goAppRoute, /target:\s*"android_app"/);
  assert.match(goAppRoute, /referrer=/);
});

test("referral tracking endpoint exists for web click tracking", async () => {
  await access(new URL("../src/app/api/sales/referrals/track/route.ts", import.meta.url));
  const trackRoute = await source("src/app/api/sales/referrals/track/route.ts");
  assert.match(trackRoute, /trackSalesReferralEvent/);
  assert.match(trackRoute, /PRICING_VIEW/);
});

test("commission engine enforces 20% on purchases and 0% on freemium/freelancer", async () => {
  const salesStore = await source("src/lib/gigxomi/sales-store.ts");
  // 20% default commission rule
  assert.match(salesStore, /defaultCommissionPercent:\s*20/);
  assert.match(salesStore, /Default Premium plan purchase commission \(20%\)/);
  // Zero commission on Freemium or Freelancer
  assert.match(salesStore, /Freemium or Freelancer plans carry 0% referral commission/);
  assert.match(salesStore, /(?:defaultCommissionPercent|closerDirectCommissionPercent) \?\? 20/);
  // Dual referral URLs
  assert.match(salesStore, /websiteUrl:\s*buildSiteUrl\(`\/\?ref=\$\{ref\}`\)/);
  assert.match(salesStore, /androidAppUrl:\s*buildSiteUrl\(`\/go\/app\?ref=\$\{ref\}`\)/);
  // Total amount withdrawn report calculation
  assert.match(salesStore, /totalAmountWithdrawn/);
});

test("GXcloser dashboard renders dual referral links, 20% commission rules, and withdrawal request", async () => {
  const dashboard = await source("src/components/sales/sales-dashboard.tsx");
  const referralPanel = await source("src/components/sales/referral-commission-panel.tsx");
  assert.match(dashboard, /ReferralCommissionPanel/);
  assert.match(referralPanel, /Referrals &amp; Commission/);
  assert.match(referralPanel, /Website Referral Link/);
  assert.match(referralPanel, /Android App Referral Link/);
  assert.match(referralPanel, /Direct Client Sale/);
  assert.match(referralPanel, /Available for Withdrawal/);
  assert.match(referralPanel, /Request Withdrawal/);
  assert.match(referralPanel, /Pending Maturation/);
  assert.match(referralPanel, /Total Amount Withdrawn/);
});
