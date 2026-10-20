import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SuperAdminLoginForm } from "@/components/super-admin/SuperAdminLoginForm";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Super Admin Portal | AIcloser",
  description: "Platform owner authentication and workspace governance.",
  robots: { index: false, follow: false },
};

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] ?? "" : input ?? "";
}

export default async function SuperAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  const params = await searchParams;

  if (session.role === "SUPER_ADMIN" && session.userId) {
    redirect("/super-admin");
  }

  return (
    <main className="auth-page">
      <SuperAdminLoginForm
        error={value(params.error)}
        message={value(params.message)}
        redirectTo={value(params.redirectTo) || "/super-admin"}
      />
    </main>
  );
}
