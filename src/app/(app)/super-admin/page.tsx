import type { Metadata } from "next";
import { SuperAdminView } from "@/components/super-admin/SuperAdminView";

export const metadata: Metadata = {
  title: "Super Admin Command Center | AI Closer",
  robots: { index: false, follow: false },
};

export default function SuperAdminPage() {
  return <SuperAdminView />;
}
