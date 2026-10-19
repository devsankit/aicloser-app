import type { Metadata } from "next";
import { WhatsAppMarketingView } from "@/components/whatsapp/WhatsAppMarketingView";

export const metadata: Metadata = { title: "WhatsApp Marketing & Campaigns" };

export default function WhatsAppPage() {
  return <WhatsAppMarketingView />;
}
