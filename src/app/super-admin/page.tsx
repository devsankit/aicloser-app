import type { Metadata } from "next";
import { SuperAdminView } from "@/components/super-admin/SuperAdminView";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = {
  title: "Super Admin Command Center | AI Closer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  await requirePageRole(["SUPER_ADMIN"], "/super-admin");
  return (
    <main style={{ minHeight: "100vh", height: "100%", overflowY: "auto", background: "var(--bg)", padding: "24px 32px 80px" }}>
      <SuperAdminView />
    </main>
  );
}
