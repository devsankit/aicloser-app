import type { Metadata } from "next";
import { WhatsAppMarketingView } from "@/components/whatsapp/WhatsAppMarketingView";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "WhatsApp Marketing & Campaigns" };

export default async function WhatsAppPage() {
  await requirePageRole(["ADMIN", "MANAGER", "SUPER_ADMIN"], "/whatsapp");
  return <WhatsAppMarketingView />;
}
