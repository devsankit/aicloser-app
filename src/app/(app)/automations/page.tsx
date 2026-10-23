import type { Metadata } from "next";
import { AutomationsView } from "@/components/automations/AutomationsView";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = {
  title: "AI Bot & Automations",
  description: "Trigger-condition-action workflow rules, AI conversation summarization, and autonomous sales assistance.",
};

export default async function AutomationsPage() {
  await requirePageRole(["ADMIN", "MANAGER", "SUPER_ADMIN"], "/automations");
  return <AutomationsView />;
}
