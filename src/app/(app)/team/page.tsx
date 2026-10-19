import type { Metadata } from "next";
import { TeamView } from "@/components/team/TeamView";

export const metadata: Metadata = { title: "Team & Users" };

export default function TeamPage() {
  return <TeamView />;
}
