import type { Metadata } from "next";

import { SuperAdminCloserControl } from "@/components/super-admin/super-admin-closer-control";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = {
  title: "Super Admin Command Center | AI Closer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const session = await requirePageRole(["SUPER_ADMIN"], "/super-admin");
  return (
    <SuperAdminCloserControl
      adminUser={{ displayName: session.displayName, email: session.email, role: session.role }}
      initialUsers={[]}
      initialStats={{ totalUsers: 0, activeUsers: 0, totalSeats: 0, newUsersToday: 0 }}
    />
  );
}
