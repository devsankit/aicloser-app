import type { Metadata } from "next";
import { FormsView } from "@/components/forms/FormsView";

export const metadata: Metadata = {
  title: "Lead Form Builder",
  description: "Create, embed, and track high-converting inbound lead capture forms synced directly with Closer CRM pipeline stages.",
};

export default function FormsPage() {
  return <FormsView />;
}
