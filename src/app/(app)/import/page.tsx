import type { Metadata } from "next";
import { LeadImportView } from "@/components/import/LeadImportView";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Lead Import & Ingestion" };

export default async function ImportPage() {
  await requirePageRole(["ADMIN", "MANAGER", "SUPER_ADMIN"], "/import");
  return <LeadImportView />;
}
