# Import, device activity, footer and signup fixes

- CRM commit: `95be0b9` (pushed). Unfinished Meta changes excluded.
- Contact import review was gated behind the lead-import view. Removed the gate and added a save action beside the paste preview button.
- Phone-only contacts already satisfy server validation; email remains optional. Added Google Contacts phone/email header aliases to spreadsheet import.
- Device activity moved from roles/reports to the dashboard, with table spacing and human-readable status badges.
- Signup investigation: the submitted email did not exist, but the submitted phone already matched an existing account. Read-only production check returned only conflict flags; no account was created or changed.
- Signup duplicate error now distinguishes email from phone without revealing another account's identity. Phone uniqueness is preserved.
- Local TypeScript check passed. Local suite: 62 passing; released server suite: 61 passing (local extra Meta test is not released).
- Public website has newer, uncommitted server-side blogs/legal/contact edits. No wholesale checkout or pull was applied there.
- Footer change uses the current server MarketingFooter, adds scoped responsive CSS, and removes the legacy homepage footer in favour of the same shared component as Contact.
- Original server footer files backed up under `/var/www/aicloser-public/work/footer-backup-20261008/`.
- Real authenticated CSV commit and dashboard visual checks still require an authenticated browser session; source contracts are not a substitute for that end-to-end check.
