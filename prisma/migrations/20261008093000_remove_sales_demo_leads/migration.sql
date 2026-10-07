-- Remove only the four development-only lead-pool rows that were previously
-- auto-created by the dashboard bootstrap. Customer-created leads are not
-- affected.
DELETE FROM "SalesLeadPoolItem"
WHERE "id" IN (
  'sales-pool-sample-b2b-saas',
  'sales-pool-sample-fintech-calling',
  'sales-pool-sample-edtech-team',
  'sales-pool-sample-insurance-agency'
);
