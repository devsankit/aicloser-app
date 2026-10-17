import type { Metadata } from "next";
import { ChannelsView } from "@/components/channels/ChannelsView";

export const metadata: Metadata = {
  title: "Plugins & Channels",
  description: "Connect telephony, messaging APIs, calendars, and payment gateways with automated two-way CRM sync.",
};

export default function ChannelsPage() {
  return <ChannelsView />;
}
