import type { Metadata } from "next";
import { LeadImportView } from "@/components/import/LeadImportView";

export const metadata: Metadata = { title: "Lead Import & Ingestion" };

export default function ImportPage() {
  return <LeadImportView />;
}
