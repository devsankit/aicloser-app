import type { Metadata } from "next";

import { SuperAdminCloserControl } from "@/components/super-admin/super-admin-closer-control";
import type { AdminRegistration, AdminWebinar } from "@/components/super-admin/gapp-webinar-console";
import { requirePageRole } from "@/lib/auth/page-guard";
import { getSessionContext } from "@/lib/auth/session";
import { getSalesOperatingSnapshot } from "@/lib/gigxomi/sales-operating-system-store";
import type { SalesOperatingSnapshot } from "@/lib/gigxomi/sales-operating-system-store";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";

export const metadata: Metadata = {
  title: "Super Admin Command Center | GXclosers",
  robots: { index: false, follow: false },
};

function emptySalesOperatingSnapshot(): SalesOperatingSnapshot {
  return {
    courses: [],
    modules: [],
    lessons: [],
    progress: [],
    unlockRules: [],
    agentLevel: null,
    mockCalls: [],
    webinars: [],
    webinarInvites: [],
    learningPosts: [],
    timeline: [],
    roundRobinRules: [],
  };
}

const defaultWebinar: AdminWebinar = {
  id: "gapp-default-webinar",
  title: "Agency Growth & High-Ticket Closing Masterclass",
  description: "Live training session on closing high-ticket digital services and building recurring agency revenue.",
  scheduledAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  capacity: 500,
  countdownEnabled: true,
  currency: "INR",
  meetingLink: "https://meet.google.com/gx-masterclass",
  phonePeEnabled: false,
  priceAmount: 0,
  priceMode: "FREE",
  registrationEnabled: true,
  thumbnailUrl: null,
};

export default async function SuperAdminPage() {
  await requirePageRole(["SUPER_ADMIN"], "/super-admin");
  const session = await getSessionContext();
  let snapshot;
  let operatingSnapshot = emptySalesOperatingSnapshot();

  try {
    snapshot = await getSalesSnapshotForRole({ userId: session.userId ?? "", role: "SUPER_ADMIN" });
  } catch (error) {
    console.error("Failed to load super-admin sales dashboard snapshot.", error);
  }

  let intelligenceSnapshot = null;

  if (snapshot) {
    try {
      operatingSnapshot = await getSalesOperatingSnapshot({ userId: session.userId ?? "", role: "SUPER_ADMIN" });
    } catch (error) {
      console.error("Failed to load super-admin sales operating snapshot; rendering dashboard with empty operating data.", error);
    }
    try {
      const { getCloserIntelligenceSnapshot } = await import("@/lib/gigxomi/closer-intelligence-store");
      intelligenceSnapshot = await getCloserIntelligenceSnapshot();
    } catch (error) {
      console.error("Failed to load closer intelligence snapshot.", error);
    }
  }

  if (snapshot) {
    return (
      <SuperAdminCloserControl
        initialGappRegistrations={[] as AdminRegistration[]}
        initialGappWebinar={defaultWebinar}
        initialOperatingSnapshot={operatingSnapshot}
        initialSnapshot={snapshot}
        initialIntelligence={intelligenceSnapshot}
      />
    );
  }

  return (
    <main className="sales-auth-shell">
      <section className="sales-auth-card">
        <h1>Super Admin Data Unavailable</h1>
        <p>Could not initialize sales platform snapshot. Verify database connectivity.</p>
      </section>
    </main>
  );
}
