import type { Metadata } from "next";
import { LeadImportView } from "@/components/import/LeadImportView";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Lead Import & Batch Mapping" };

export default async function LeadImportPage() {
  await requirePageRole(["ADMIN", "MANAGER", "SUPER_ADMIN"], "/lead-import");
  return <LeadImportView />;
}
