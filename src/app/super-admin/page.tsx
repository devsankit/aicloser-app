import type { Metadata } from "next";

import { SuperAdminPlatformOverview } from "@/components/super-admin/super-admin-platform-overview";
import { requirePageRole } from "@/lib/auth/page-guard";
import { getSuperAdminPlatformSummary } from "@/lib/super-admin/platform-summary";

export const metadata: Metadata = {
  title: "Super Admin Command Center | AI Closer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const session = await requirePageRole(["SUPER_ADMIN"], "/super-admin");
  const { businesses, stats } = await getSuperAdminPlatformSummary();

  return <SuperAdminPlatformOverview adminUser={{ displayName: session.displayName, email: session.email, role: session.role }} businesses={businesses} stats={stats} />;
}
