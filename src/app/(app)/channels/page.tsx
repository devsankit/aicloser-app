import type { Metadata } from "next";
import { ChannelsView } from "@/components/channels/ChannelsView";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = {
  title: "Plugins & Channels",
  description: "Connect telephony, messaging APIs, calendars, and payment gateways with automated two-way CRM sync.",
};

export default async function ChannelsPage() {
  await requirePageRole(["ADMIN", "MANAGER", "SUPER_ADMIN"], "/channels");
  return <ChannelsView />;
}
