import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/SettingsView";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Settings & Preferences" };

export default async function SettingsPage() {
  await requirePageRole(
    ["ADMIN", "SUPER_ADMIN", "MANAGER", "SALES_AGENT", "FREELANCER"],
    "/settings"
  );
  return <SettingsView />;
}
