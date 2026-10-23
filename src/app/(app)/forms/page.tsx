import type { Metadata } from "next";
import { FormsView } from "@/components/forms/FormsView";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = {
  title: "Lead Form Builder",
  description: "Create, embed, and track high-converting inbound lead capture forms synced directly with Closer CRM pipeline stages.",
};

export default async function FormsPage() {
  await requirePageRole(["ADMIN", "MANAGER", "SUPER_ADMIN"], "/forms");
  return <FormsView />;
}
