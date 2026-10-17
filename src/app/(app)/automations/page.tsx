import type { Metadata } from "next";
import { AutomationsView } from "@/components/automations/AutomationsView";

export const metadata: Metadata = {
  title: "AI Bot & Automations",
  description: "Trigger-condition-action workflow rules, AI conversation summarization, and autonomous sales assistance.",
};

export default function AutomationsPage() {
  return <AutomationsView />;
}
