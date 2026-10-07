import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SuperAdminLoginForm } from "@/components/sales/sales-auth";
import { BrandWordmark } from "@/components/ui/brand-wordmark";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Super Admin Login",
  robots: { index: false, follow: false },
};

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] ?? "" : input ?? "";
}

export default async function SuperAdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSessionContext();
  const params = await searchParams;
  if (session.role === "SUPER_ADMIN") {
    redirect("/super-admin");
  }

  return (
    <main className="sales-auth-shell">
      <section className="sales-auth-card">
        <BrandWordmark />
        <div>
          <p className="section-label">Super Admin Command Center</p>
          <h1>Platform Owner Authentication</h1>
          <p>Restricted access for platform administrators to manage closer agents, affiliate commissions, payout withdrawal queues, deals, and platform governance.</p>
        </div>
        <SuperAdminLoginForm error={value(params.error)} message={value(params.message)} redirectTo={value(params.redirectTo) || "/super-admin"} />
        <Link className="sales-auth-link" href="/login">
          Return to Sales Agent Login
        </Link>
      </section>
    </main>
  );
}
