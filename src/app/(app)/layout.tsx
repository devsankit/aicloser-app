import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getSessionContext } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSessionContext();

  if (!session.userId || session.role === "GUEST") {
    redirect("/login");
  }

  return <AppShell initialRole={session.role}>{children}</AppShell>;
}
