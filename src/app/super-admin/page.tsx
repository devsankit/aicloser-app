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
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px 32px" }}>
      <SuperAdminView />
    </main>
  );
}
