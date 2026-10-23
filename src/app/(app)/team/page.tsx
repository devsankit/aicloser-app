import type { Metadata } from "next";
import { TeamView } from "@/components/team/TeamView";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Team & Users" };

export default async function TeamPage() {
  await requirePageRole(["ADMIN", "MANAGER"], "/team");
  return <TeamView />;
}
