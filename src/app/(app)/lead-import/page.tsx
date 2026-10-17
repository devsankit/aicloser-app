import type { Metadata } from "next";
import { LeadImportView } from "@/components/import/LeadImportView";

export const metadata: Metadata = { title: "Lead Import & Batch Mapping" };

export default function LeadImportPage() {
  return <LeadImportView />;
}
