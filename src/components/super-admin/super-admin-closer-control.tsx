"use client";

import { FormEvent, useMemo, useState } from "react";
import { BadgeCheck, Bell, Coins, GraduationCap, KeyRound, Library, Mic2, PhoneCall, Power, Route, Rocket, Smartphone, Trash2, Trophy, Tv, Upload, Users } from "lucide-react";

import { BrandWordmark } from "@/components/ui/brand-wordmark";
import { GappWebinarConsole, type AdminRegistration, type AdminWebinar } from "@/components/super-admin/gapp-webinar-console";
import { CloserIntelligenceConsole, type CloserIntelligenceData } from "@/components/super-admin/closer-intelligence-console";
import type { SalesOperatingSnapshot } from "@/lib/gigxomi/sales-operating-system-store";
import type { SalesAgentStatus, SalesDashboardSnapshot, SalesPayoutStatus } from "@/lib/gigxomi/sales-store";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits: 0, style: "currency" }).format(value);
}

export function SuperAdminCloserControl({
  initialGappRegistrations,
  initialGappWebinar,
  initialOperatingSnapshot,
  initialSnapshot,
  initialIntelligence,
}: {
  initialGappRegistrations: AdminRegistration[];
  initialGappWebinar: AdminWebinar;
  initialOperatingSnapshot: SalesOperatingSnapshot;
  initialSnapshot: SalesDashboardSnapshot;
  initialIntelligence?: CloserIntelligenceData | null;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [operating, setOperating] = useState(initialOperatingSnapshot);
  const [mainView, setMainView] = useState<"intelligence" | "operations">("intelligence");
  const [status, setStatus] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; duplicate: number; invalid: number; errors?: Array<{ row: number; reason: string }> } | null>(null);

  const summary = useMemo(
    () => [
      { label: "Sales agents", value: snapshot.agents.length.toString(), icon: Users },
      { label: "Paid revenue", value: money(snapshot.reports.paidRevenue), icon: BadgeCheck },
      { label: "Pending payouts", value: money(snapshot.reports.pendingPayout), icon: Coins },
      { label: "Open queue", value: snapshot.reports.openQueueLeads.toString(), icon: Rocket },
      { label: "Referral signups", value: snapshot.reports.referralSignups.toString(), icon: Trophy },
      { label: "Module", value: snapshot.settings.moduleEnabled ? "Enabled" : "Disabled", icon: Power },
    ],
    [snapshot],
  );

  async function refresh() {
    const response = await fetch("/api/super-admin/sales", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (payload?.ok) setSnapshot(payload.snapshot);
  }

  async function refreshOperating() {
    const [courses, ladder, webinars, learning, rules] = await Promise.all([
      fetch("/api/sales/lms/courses", { cache: "no-store" }).then((response) => response.json()).catch(() => null),
      fetch("/api/sales/training-ladder", { cache: "no-store" }).then((response) => response.json()).catch(() => null),
      fetch("/api/sales/webinars", { cache: "no-store" }).then((response) => response.json()).catch(() => null),
      fetch("/api/sales/learning-wall", { cache: "no-store" }).then((response) => response.json()).catch(() => null),
      fetch("/api/sales/round-robin/rules", { cache: "no-store" }).then((response) => response.json()).catch(() => null),
    ]);
    setOperating((current) => ({
      ...current,
      courses: courses?.courses ?? current.courses,
      modules: courses?.modules ?? current.modules,
      lessons: courses?.lessons ?? current.lessons,
      progress: ladder?.progress ?? current.progress,
      unlockRules: ladder?.unlockRules ?? current.unlockRules,
      agentLevel: ladder?.agentLevel ?? current.agentLevel,
      mockCalls: ladder?.mockCalls ?? current.mockCalls,
      webinars: webinars?.webinars ?? current.webinars,
      webinarInvites: webinars?.invites ?? current.webinarInvites,
      learningPosts: learning?.posts ?? current.learningPosts,
      roundRobinRules: rules?.rules ?? current.roundRobinRules,
    }));
  }

  async function submitAction(body: Record<string, unknown>, success: string) {
    const response = await fetch("/api/super-admin/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    setStatus(response.ok && payload?.ok ? success : payload?.error ?? "Unable to update sales backend.");
    await refresh();
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitAction(
      {
        action: "settings",
        moduleEnabled: form.get("moduleEnabled") === "on",
        signupRequiresApproval: form.get("signupRequiresApproval") === "on",
        defaultCommissionPercent: Number(form.get("defaultCommissionPercent") ?? 10),
        closerDirectCommissionPercent: Number(form.get("closerDirectCommissionPercent") ?? 20),
        closerSubCommissionPercent: Number(form.get("closerSubCommissionPercent") ?? 10),
        freelancerCommissionPercent: Number(form.get("freelancerCommissionPercent") ?? 10),
        agencyCommissionPercent: Number(form.get("agencyCommissionPercent") ?? 10),
        payoutHoldDays: Number(form.get("payoutHoldDays") ?? 7),
        payoutMinimum: Number(form.get("payoutMinimum") ?? 500),
        enableAnnouncements: form.get("enableAnnouncements") === "on",
        enableMessages: form.get("enableMessages") === "on",
        enableReferralLinks: form.get("enableReferralLinks") === "on",
        enableTeams: form.get("enableTeams") === "on",
        enableEarnings: form.get("enableEarnings") === "on",
        enablePayouts: form.get("enablePayouts") === "on",
        dashboardPrimaryColor: String(form.get("dashboardPrimaryColor") ?? "#D7FF2F"),
        dashboardAccentColor: String(form.get("dashboardAccentColor") ?? "#0A0D0B"),
      },
      "Sales settings saved.",
    );
  }

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitAction(
      {
        action: "commission-rule",
        name: String(form.get("name") ?? ""),
        type: String(form.get("type") ?? "PERCENTAGE"),
        scope: String(form.get("scope") ?? "ALL_AGENTS"),
        appliesTo: String(form.get("appliesTo") ?? "ALL_PACKAGES"),
        groupId: String(form.get("groupId") ?? ""),
        agentId: String(form.get("agentId") ?? ""),
        packageId: String(form.get("packageId") ?? ""),
        value: Number(form.get("value") ?? 0),
        parentCommissionPercent: Number(form.get("parentCommissionPercent") ?? 0),
        minOrderValue: Number(form.get("minOrderValue") ?? 0) || null,
        maxOrderValue: Number(form.get("maxOrderValue") ?? 0) || null,
        priority: Number(form.get("priority") ?? 0),
      },
      "Commission rule saved.",
    );
    event.currentTarget.reset();
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitAction(
      {
        action: "group",
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        defaultCommissionPercent: Number(form.get("defaultCommissionPercent") ?? 10),
        parentCommissionPercent: Number(form.get("parentCommissionPercent") ?? 0),
      },
      "Sales group saved.",
    );
    event.currentTarget.reset();
  }

  async function createAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitAction(
      {
        action: "agent",
        displayName: String(form.get("displayName") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        password: String(form.get("password") ?? ""),
        status: String(form.get("status") ?? "ACTIVE"),
        groupId: String(form.get("groupId") ?? ""),
        parentAgentId: String(form.get("parentAgentId") ?? ""),
        canCreateSubAgents: form.get("canCreateSubAgents") === "on",
        canClaimLeads: form.get("canClaimLeads") === "on",
        maxActiveLeads: Number(form.get("maxActiveLeads") ?? 0) || null,
      },
      "Sales agent created.",
    );
    event.currentTarget.reset();
  }

  async function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitAction({ action: "announcement", title: String(form.get("title") ?? ""), body: String(form.get("body") ?? "") }, "Announcement published.");
    event.currentTarget.reset();
  }

  async function updateAgent(agentId: string, nextStatus: SalesAgentStatus) {
    await submitAction({ action: "agent-status", agentId, status: nextStatus }, `Agent marked ${nextStatus.toLowerCase()}.`);
  }

  async function updateMobileDevice(deviceId: string, isActive: boolean, recordingEnabled: boolean) {
    await submitAction({ action: "mobile-device-status", deviceId, isActive, recordingEnabled }, isActive ? "Mobile device activated." : "Mobile device deactivated.");
  }

  async function updateAgentTeam(event: FormEvent<HTMLFormElement>, agentId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitAction(
      {
        action: "agent-status",
        agentId,
        groupId: String(form.get("groupId") ?? ""),
        parentAgentId: String(form.get("parentAgentId") ?? ""),
        commissionPercent: Number(form.get("commissionPercent") ?? 0) || undefined,
        canCreateSubAgents: form.get("canCreateSubAgents") === "on",
        canClaimLeads: form.get("canClaimLeads") === "on",
        maxActiveLeads: Number(form.get("maxActiveLeads") ?? 0) || undefined,
      },
      "Agent team settings saved.",
    );
  }

  async function resetAgentPassword(event: FormEvent<HTMLFormElement>, agentId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitAction(
      {
        action: "reset-agent-password",
        agentId,
        password: String(form.get("password") ?? ""),
      },
      "Agent password reset.",
    );
    event.currentTarget.reset();
  }

  async function deleteAgent(agentId: string) {
    const agent = snapshot.agents.find((item) => item.id === agentId);
    const confirmed = window.confirm(`Delete ${agent?.displayName ?? "this sales agent"}? Assigned queue leads will return to the open pool.`);
    if (!confirmed) return;
    const response = await fetch("/api/super-admin/sales", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    const payload = await response.json().catch(() => null);
    setStatus(response.ok && payload?.ok ? "Sales agent deleted." : payload?.error ?? "Unable to delete sales agent.");
    await refresh();
  }

  async function submitOperating(url: string, body: Record<string, unknown>, success: string, method = "POST") {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    setStatus(response.ok && payload?.ok ? success : payload?.error ?? "Unable to update sales operating system.");
    await refreshOperating();
  }

  async function importContacts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/sales/leads/import", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.ok) {
      setImportResult({
        imported: Number(payload.imported ?? 0),
        skipped: Number(payload.skipped ?? 0),
        duplicate: Number(payload.duplicate ?? 0),
        invalid: Number(payload.invalid ?? 0),
        errors: payload.errors ?? [],
      });
      setStatus("Contact import completed.");
      form.reset();
      await refresh();
      return;
    }
    setStatus(payload?.error ?? "Contact import failed.");
  }

  async function createQueueLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitAction(
      {
        action: "lead-pool",
        assignedAgentId: String(form.get("assignedAgentId") ?? ""),
        customerName: String(form.get("customerName") ?? ""),
        customerPhone: String(form.get("customerPhone") ?? ""),
        customerEmail: String(form.get("customerEmail") ?? ""),
        source: String(form.get("source") ?? "round_robin"),
        serviceInterest: String(form.get("serviceInterest") ?? ""),
        segment: String(form.get("segment") ?? ""),
        priority: String(form.get("priority") ?? "normal"),
        budgetAmount: Number(form.get("budgetAmount") ?? 0),
        notes: String(form.get("notes") ?? ""),
      },
      "Round-robin lead added.",
    );
    event.currentTarget.reset();
  }

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitAction(
      {
        action: "goal",
        name: String(form.get("name") ?? ""),
        metric: String(form.get("metric") ?? "PAID_REVENUE"),
        scope: String(form.get("scope") ?? "INDIVIDUAL_AGENT"),
        agentId: String(form.get("agentId") ?? ""),
        groupId: String(form.get("groupId") ?? ""),
        target: Number(form.get("target") ?? 0),
        rewardText: String(form.get("rewardText") ?? ""),
      },
      "Sales goal pinned.",
    );
    event.currentTarget.reset();
  }

  async function createReward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitAction(
      {
        action: "reward",
        title: String(form.get("title") ?? ""),
        body: String(form.get("body") ?? ""),
        agentId: String(form.get("agentId") ?? ""),
        groupId: String(form.get("groupId") ?? ""),
      },
      "Sales reward pinned.",
    );
    event.currentTarget.reset();
  }

  async function updatePayout(payoutId: string, nextStatus: SalesPayoutStatus) {
    await submitAction({ action: "payout-status", payoutId, status: nextStatus }, `Payout marked ${nextStatus.toLowerCase()}.`);
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitOperating(
      "/api/sales/lms/courses",
      {
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        assignedRole: String(form.get("assignedRole") ?? ""),
        isPublished: form.get("isPublished") === "on",
        requiredCompletionPercent: Number(form.get("requiredCompletionPercent") ?? 100),
        requiredQuizScore: Number(form.get("requiredQuizScore") ?? 0) || null,
        requiresMockCall: form.get("requiresMockCall") === "on",
        requiresManagerReview: form.get("requiresManagerReview") === "on",
        leadUnlockQuantity: Number(form.get("leadUnlockQuantity") ?? 0),
      },
      "LMS course saved.",
    );
    event.currentTarget.reset();
  }

  async function createLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitOperating(
      "/api/sales/lms/lessons",
      {
        courseId: String(form.get("courseId") ?? ""),
        moduleId: String(form.get("moduleId") ?? ""),
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        videoUrl: String(form.get("videoUrl") ?? ""),
        content: String(form.get("content") ?? ""),
        estimatedDuration: Number(form.get("estimatedDuration") ?? 0) || null,
        quizRequired: form.get("quizRequired") === "on",
        mockCallRequired: form.get("mockCallRequired") === "on",
        managerReviewRequired: form.get("managerReviewRequired") === "on",
      },
      "LMS lesson saved.",
    );
    event.currentTarget.reset();
  }

  async function createLearningPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitOperating(
      "/api/sales/learning-wall",
      {
        title: String(form.get("title") ?? ""),
        body: String(form.get("body") ?? ""),
        category: String(form.get("category") ?? "Sales tip"),
        audience: String(form.get("audience") ?? "all"),
        linkUrl: String(form.get("linkUrl") ?? ""),
        videoUrl: String(form.get("videoUrl") ?? ""),
        isPinned: form.get("isPinned") === "on",
        isActive: form.get("isActive") === "on",
      },
      "Learning wall post published.",
    );
    event.currentTarget.reset();
  }

  async function createRoundRobinRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitOperating(
      "/api/sales/round-robin/rules",
      {
        title: String(form.get("title") ?? ""),
        teamId: String(form.get("teamId") ?? ""),
        isActive: form.get("isActive") === "on",
        maxActiveLeads: Number(form.get("maxActiveLeads") ?? 0) || null,
        requireTrainingLevel: String(form.get("requireTrainingLevel") ?? ""),
        priorityMode: String(form.get("priorityMode") ?? "balanced"),
        batchSize: Number(form.get("batchSize") ?? 1),
      },
      "Round-robin rule saved.",
    );
    event.currentTarget.reset();
  }

  async function reviewMockCall(event: FormEvent<HTMLFormElement>, attemptId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submitOperating(
      `/api/sales/lms/mock-call/${attemptId}/review`,
      {
        status: String(form.get("status") ?? "APPROVED"),
        managerScore: Number(form.get("managerScore") ?? 0) || null,
        feedback: String(form.get("feedback") ?? ""),
      },
      "Mock call reviewed.",
      "PATCH",
    );
    event.currentTarget.reset();
  }

  return (
    <main className="sales-shell">
      <section className="sales-topbar">
        <BrandWordmark />
        <div>
          <p className="section-label">Super Admin</p>
          <h1>Sales backend control room</h1>
          <p className="muted-copy">Approve closers, manage round-robin leads, tiers, goals, commission, referral attribution, wallet, payouts, and announcements.</p>
        </div>
      </section>

      <section className="sales-metric-grid">
        {summary.map((card) => {
          const Icon = card.icon;
          return (
            <article className="sales-card" key={card.label}>
              <Icon size={18} />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          );
        })}
      </section>

      {/* Primary Executive Switcher */}
      <section style={{ display: "flex", gap: "0.75rem", margin: "1.25rem 0", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setMainView("intelligence")}
          style={{
            padding: "0.75rem 1.4rem",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "0.95rem",
            border: mainView === "intelligence" ? "1px solid #D7FF2F" : "1px solid rgba(255, 255, 255, 0.15)",
            background: mainView === "intelligence" ? "#D7FF2F" : "#121714",
            color: mainView === "intelligence" ? "#0A0D0B" : "#A1A1AA",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.15s ease",
          }}
        >
          <Rocket size={18} /> AI Intelligence, Call Audits & Product Roadmap
        </button>

        <button
          type="button"
          onClick={() => setMainView("operations")}
          style={{
            padding: "0.75rem 1.4rem",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "0.95rem",
            border: mainView === "operations" ? "1px solid #D7FF2F" : "1px solid rgba(255, 255, 255, 0.15)",
            background: mainView === "operations" ? "#D7FF2F" : "#121714",
            color: mainView === "operations" ? "#0A0D0B" : "#A1A1AA",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.15s ease",
          }}
        >
          <GraduationCap size={18} /> Closer Team, Settings & LMS Operations
        </button>
      </section>

      {mainView === "intelligence" && initialIntelligence && (
        <CloserIntelligenceConsole
          initialData={initialIntelligence}
          onSwitchToLegacyTab={() => setMainView("operations")}
        />
      )}

      {mainView === "operations" && (
        <>
          <section className="sales-panel sales-full-span">
            <div className="sales-panel-title"><Rocket size={18} /><strong>Sales control actions</strong></div>
            <div className="sales-button-row">
              <a className="sales-primary-button compact" href="#sales-contact-import"><Upload size={15} /> Import Contacts</a>
              <a className="sales-secondary-button compact" href="#sales-agent-create"><Users size={15} /> Add Agent</a>
              <a className="sales-secondary-button compact" href="#sales-agents-table"><KeyRound size={15} /> Reset Password</a>
              <a className="sales-secondary-button compact" href="#webinar-scheduler"><Tv size={15} /> Schedule Webinar</a>
              <a className="sales-secondary-button compact" href="#sales-os-controls"><GraduationCap size={15} /> Training OS</a>
            </div>
          </section>

      <div className="sales-webinar-scheduler" id="webinar-scheduler">
        <GappWebinarConsole
          initialRegistrations={initialGappRegistrations}
          initialWebinar={initialGappWebinar}
          onSaved={refreshOperating}
        />
      </div>

      <section className="sales-dashboard-grid" id="sales-os-controls">
        <form className="sales-panel sales-form-grid" onSubmit={createCourse}>
          <div className="sales-panel-title"><GraduationCap size={18} /><strong>LMS Course</strong></div>
          <input name="title" placeholder="Course title" required />
          <textarea name="description" placeholder="Course description" />
          <select name="assignedRole" defaultValue="TRAINEE">
            <option value="TRAINEE">Trainee</option>
            <option value="SALES_AGENT">Sales agent</option>
            <option value="TEAM_LEADER">Team leader</option>
            <option value="all">All sales users</option>
          </select>
          <div className="sales-form-two">
            <input defaultValue={100} min={0} name="requiredCompletionPercent" placeholder="Completion %" type="number" />
            <input min={0} name="requiredQuizScore" placeholder="Quiz score" type="number" />
          </div>
          <div className="sales-form-two">
            <input min={0} name="leadUnlockQuantity" placeholder="Lead unlock qty" type="number" />
            <label className="sales-toggle-row"><span>Published</span><input defaultChecked name="isPublished" type="checkbox" /></label>
          </div>
          <label className="sales-toggle-row"><span>Requires mock call</span><input name="requiresMockCall" type="checkbox" /></label>
          <label className="sales-toggle-row"><span>Requires manager review</span><input name="requiresManagerReview" type="checkbox" /></label>
          <button className="sales-primary-button" type="submit">Save course</button>
        </form>

        <form className="sales-panel sales-form-grid" onSubmit={createLesson}>
          <div className="sales-panel-title"><Library size={18} /><strong>LMS Lesson / Video</strong></div>
          <select name="courseId" required>
            <option value="">Choose course</option>
            {operating.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
          <select name="moduleId">
            <option value="">No module</option>
            {operating.modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
          </select>
          <input name="title" placeholder="Lesson title" required />
          <input name="videoUrl" placeholder="YouTube / Vimeo / hosted video URL" />
          <textarea name="description" placeholder="Lesson description" />
          <textarea name="content" placeholder="Lesson content or exercise" />
          <input min={0} name="estimatedDuration" placeholder="Estimated minutes" type="number" />
          <label className="sales-toggle-row"><span>Quiz required</span><input name="quizRequired" type="checkbox" /></label>
          <label className="sales-toggle-row"><span>Mock call required</span><input name="mockCallRequired" type="checkbox" /></label>
          <label className="sales-toggle-row"><span>Manager review required</span><input name="managerReviewRequired" type="checkbox" /></label>
          <button className="sales-primary-button" type="submit">Save lesson</button>
        </form>

        <form className="sales-panel sales-form-grid" onSubmit={createLearningPost}>
          <div className="sales-panel-title"><Library size={18} /><strong>Learning Wall</strong></div>
          <input name="title" placeholder="Post title" required />
          <textarea name="body" placeholder="Sales tip, objection answer, pitch update, or policy" required />
          <div className="sales-form-two">
            <input defaultValue="Sales tip" name="category" placeholder="Category" />
            <select name="audience"><option value="all">All agents</option><option value="trainee">Trainees</option><option value="verified">Verified agents</option></select>
          </div>
          <input name="linkUrl" placeholder="Optional link" />
          <input name="videoUrl" placeholder="Optional video URL" />
          <label className="sales-toggle-row"><span>Pinned</span><input name="isPinned" type="checkbox" /></label>
          <label className="sales-toggle-row"><span>Active</span><input defaultChecked name="isActive" type="checkbox" /></label>
          <button className="sales-primary-button" type="submit">Publish post</button>
        </form>

        <form className="sales-panel sales-form-grid" onSubmit={createRoundRobinRule}>
          <div className="sales-panel-title"><Route size={18} /><strong>Round-robin Rule</strong></div>
          <input name="title" placeholder="Fresh trainee guarded distribution" required />
          <select name="teamId"><option value="">All teams</option>{snapshot.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
          <input name="requireTrainingLevel" placeholder="Required training level e.g. UNLOCK_10_LEADS" />
          <select name="priorityMode"><option value="balanced">Balanced</option><option value="hot_first">Hot first</option><option value="least_loaded">Least loaded</option></select>
          <div className="sales-form-two">
            <input min={0} name="maxActiveLeads" placeholder="Max active leads" type="number" />
            <input defaultValue={1} min={1} name="batchSize" placeholder="Batch size" type="number" />
          </div>
          <label className="sales-toggle-row"><span>Active</span><input defaultChecked name="isActive" type="checkbox" /></label>
          <button className="sales-primary-button" type="submit">Save rule</button>
        </form>

        <article className="sales-panel">
          <div className="sales-panel-title"><Mic2 size={18} /><strong>Mock Call Review</strong></div>
          <div className="sales-table">
            {operating.mockCalls.map((call) => (
              <div className="sales-table-row sales-table-row-rich" key={call.id}>
                <div>
                  <strong>{call.scenario.replace(/_/g, " ")}</strong>
                  <span>{snapshot.agents.find((agent) => agent.userId === call.userId)?.displayName ?? "Sales agent"} - {call.status}</span>
                  <small>{call.transcript.slice(0, 160)}</small>
                  <form className="sales-inline-form" onSubmit={(event) => reviewMockCall(event, call.id)}>
                    <select defaultValue={call.status} name="status"><option value="APPROVED">Approve</option><option value="NEEDS_RETRY">Needs retry</option><option value="REJECTED">Reject</option></select>
                    <input defaultValue={call.managerScore ?? ""} min={0} max={100} name="managerScore" placeholder="Score" type="number" />
                    <input defaultValue={call.feedback ?? ""} name="feedback" placeholder="Feedback" />
                    <button className="sales-small-button" type="submit">Review</button>
                  </form>
                </div>
              </div>
            ))}
            {!operating.mockCalls.length ? <p className="muted-copy">No mock calls are waiting for review.</p> : null}
          </div>
        </article>
      </section>

      <section className="sales-dashboard-grid">
        <form className="sales-panel sales-form-grid" id="sales-contact-import" onSubmit={importContacts}>
          <strong>Lead Import</strong>
          <label><span>Excel or CSV file</span><input accept=".csv,.tsv,.xls,.xlsx" name="file" type="file" /></label>
          <div className="sales-import-divider"><span>or</span></div>
          <label><span>Google Sheets link</span><input name="googleSheetUrl" placeholder="https://docs.google.com/spreadsheets/d/..." type="url" /></label>
          <select name="mode" defaultValue="add_to_round_robin_queue">
            <option value="add_to_round_robin_queue">Add to round-robin queue</option>
            <option value="assign_to_selected_agent">Assign to selected agent</option>
            <option value="add_directly_to_crm">Add directly to CRM</option>
          </select>
          <select name="assignedAgentId">
            <option value="">Round-robin / first active agent</option>
            {snapshot.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName} - {agent.status}</option>)}
          </select>
          <p className="muted-copy">Upload one file or paste a Google Sheet shared as “Anyone with the link”. Supported headers: name, phone, whatsapp, email, source, segment, service, package, interest, budget, priority, tags, notes.</p>
          <button className="sales-primary-button" type="submit"><Upload size={15} /> Start import</button>
          {importResult ? (
            <div className="sales-import-result">
              <strong>{importResult.imported} imported</strong>
              <span>{importResult.skipped} skipped</span>
              <span>{importResult.duplicate} duplicates</span>
              <span>{importResult.invalid} invalid</span>
              {importResult.errors?.length ? <small>{importResult.errors.slice(0, 3).map((error) => `Row ${error.row}: ${error.reason}`).join(" | ")}</small> : null}
            </div>
          ) : null}
        </form>

        <form className="sales-panel sales-form-grid" onSubmit={saveSettings}>
          <strong>Backend Options</strong>
          {[
            ["moduleEnabled", "Enable sales module", snapshot.settings.moduleEnabled],
            ["signupRequiresApproval", "Signup requires approval", snapshot.settings.signupRequiresApproval],
            ["enableReferralLinks", "Enable referral links", snapshot.settings.enableReferralLinks],
            ["enableTeams", "Enable teams", snapshot.settings.enableTeams],
            ["enableEarnings", "Enable earnings", snapshot.settings.enableEarnings],
            ["enablePayouts", "Enable payouts", snapshot.settings.enablePayouts],
            ["enableMessages", "Enable messages", snapshot.settings.enableMessages],
            ["enableAnnouncements", "Enable announcements", snapshot.settings.enableAnnouncements],
          ].map(([name, text, checked]) => (
            <label className="sales-toggle-row" key={String(name)}>
              <span>{text}</span>
              <input defaultChecked={Boolean(checked)} name={String(name)} type="checkbox" />
            </label>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <label><span>Closer Direct Sale %</span><input defaultValue={snapshot.settings.closerDirectCommissionPercent ?? 20} min={0} max={100} name="closerDirectCommissionPercent" step="0.5" type="number" required /></label>
            <label><span>Closer Sub-Referral %</span><input defaultValue={snapshot.settings.closerSubCommissionPercent ?? 10} min={0} max={100} name="closerSubCommissionPercent" step="0.5" type="number" required /></label>
            <label><span>Freelancer Referral %</span><input defaultValue={snapshot.settings.freelancerCommissionPercent ?? 10} min={0} max={100} name="freelancerCommissionPercent" step="0.5" type="number" required /></label>
            <label><span>Agency Referral %</span><input defaultValue={snapshot.settings.agencyCommissionPercent ?? 10} min={0} max={100} name="agencyCommissionPercent" step="0.5" type="number" required /></label>
            <label><span>Payout Hold (Days)</span><input defaultValue={snapshot.settings.payoutHoldDays ?? 7} min={0} max={60} name="payoutHoldDays" step="1" type="number" required /></label>
            <label><span>Payout Minimum (₹)</span><input defaultValue={snapshot.settings.payoutMinimum ?? 500} min={1} name="payoutMinimum" step="1" type="number" required /></label>
          </div>
          <label><span>Legacy default commission %</span><input defaultValue={snapshot.settings.defaultCommissionPercent} min={0} name="defaultCommissionPercent" step="0.01" type="number" /></label>
          <label><span>Sales primary color</span><input defaultValue={snapshot.settings.dashboardPrimaryColor || "#D7FF2F"} name="dashboardPrimaryColor" type="color" /></label>
          <label><span>Sales surface color</span><input defaultValue={snapshot.settings.dashboardAccentColor || "#0A0D0B"} name="dashboardAccentColor" type="color" /></label>
          <button className="sales-primary-button" type="submit">Save backend options</button>
        </form>

        <form className="sales-panel sales-form-grid" onSubmit={createRule}>
          <strong>Commission Rule</strong>
          <input name="name" placeholder="Senior closer 15%" required />
          <select name="type"><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></select>
          <select name="scope"><option value="ALL_AGENTS">All agents</option><option value="AGENT_GROUP">Agent group</option><option value="INDIVIDUAL_AGENT">Individual agent</option></select>
          <select name="appliesTo"><option value="ALL_PACKAGES">All packages</option><option value="PACKAGE">Selected package</option><option value="ONE_TIME_DEAL">One-time deal</option></select>
          <select name="groupId"><option value="">Any group</option>{snapshot.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
          <select name="agentId"><option value="">Any agent</option>{snapshot.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}</select>
          <select name="packageId"><option value="">Any package</option>{snapshot.packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}</select>
          <input min={0} name="value" placeholder="Value" required step="0.01" type="number" />
          <input min={0} name="parentCommissionPercent" placeholder="Parent commission %" step="0.01" type="number" />
          <input min={0} name="minOrderValue" placeholder="Min order value" step="1" type="number" />
          <input min={0} name="maxOrderValue" placeholder="Max order value" step="1" type="number" />
          <input defaultValue={1} min={0} name="priority" placeholder="Priority" step="1" type="number" />
          <button className="sales-primary-button" type="submit">Save commission rule</button>
        </form>

        <form className="sales-panel sales-form-grid" onSubmit={createGroup}>
          <strong>Agent Group / Tier</strong>
          <input name="name" placeholder="Senior Closers" required />
          <textarea name="description" placeholder="Group description" />
          <input defaultValue={10} min={0} name="defaultCommissionPercent" placeholder="Default commission %" step="0.01" type="number" />
          <input defaultValue={2} min={0} name="parentCommissionPercent" placeholder="Parent commission %" step="0.01" type="number" />
          <button className="sales-primary-button" type="submit">Save group</button>
        </form>

        <form className="sales-panel sales-form-grid" id="sales-agent-create" onSubmit={createAgent}>
          <strong>Create Agent / Subagent</strong>
          <input name="displayName" placeholder="Agent name" required />
          <input name="email" placeholder="agent@gigxomi.com" required type="email" />
          <input name="phone" placeholder="+91..." required />
          <input minLength={8} name="password" placeholder="Temporary password" required type="password" />
          <select name="status"><option value="ACTIVE">Active now</option><option value="PENDING">Pending approval</option><option value="SUSPENDED">Suspended</option></select>
          <select name="groupId"><option value="">No group</option>{snapshot.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
          <select name="parentAgentId"><option value="">No parent agent</option>{snapshot.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}</select>
          <label className="sales-toggle-row"><span>Can claim queue leads</span><input defaultChecked name="canClaimLeads" type="checkbox" /></label>
          <label className="sales-toggle-row"><span>Can add subagents</span><input name="canCreateSubAgents" type="checkbox" /></label>
          <input min={0} name="maxActiveLeads" placeholder="Max active leads" step="1" type="number" />
          <button className="sales-primary-button" type="submit">Create sales agent</button>
        </form>

        <form className="sales-panel sales-form-grid" onSubmit={createQueueLead}>
          <strong>Round-robin Lead</strong>
          <input name="customerName" placeholder="Customer name" required />
          <input name="customerPhone" placeholder="WhatsApp number" />
          <input name="customerEmail" placeholder="Email" type="email" />
          <input name="serviceInterest" placeholder="Package or editor need" />
          <input name="segment" placeholder="Segment e.g. creator, agency, wedding" />
          <select name="priority"><option value="normal">Normal</option><option value="warm">Warm</option><option value="hot">Hot</option></select>
          <select name="assignedAgentId"><option value="">Round-robin queue</option>{snapshot.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}</select>
          <input min={0} name="budgetAmount" placeholder="Budget" step="1" type="number" />
          <textarea name="notes" placeholder="Lead notes" />
          <button className="sales-primary-button" type="submit">Add queue lead</button>
        </form>

        <form className="sales-panel sales-form-grid" onSubmit={createGoal}>
          <strong>Goal / Scoreboard Target</strong>
          <input name="name" placeholder="Monthly revenue sprint" required />
          <select name="metric">
            <option value="PAID_REVENUE">Paid revenue</option>
            <option value="CLOSED_DEALS">Closed deals</option>
            <option value="REFERRAL_SIGNUPS">Referral signups</option>
            <option value="CONVERSION_RATE">Conversion rate</option>
            <option value="LEADS_CLAIMED">Leads claimed</option>
          </select>
          <select name="scope"><option value="ALL_AGENTS">All agents</option><option value="AGENT_GROUP">Agent group</option><option value="INDIVIDUAL_AGENT">Individual agent</option></select>
          <select name="groupId"><option value="">Any group</option>{snapshot.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
          <select name="agentId"><option value="">Any agent</option>{snapshot.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}</select>
          <input min={1} name="target" placeholder="Target value" required step="1" type="number" />
          <textarea name="rewardText" placeholder="Pinned reward text" />
          <button className="sales-primary-button" type="submit">Pin goal</button>
        </form>

        <form className="sales-panel sales-form-grid" onSubmit={createReward}>
          <strong>Pinned Reward</strong>
          <input name="title" placeholder="Top closer bonus" required />
          <textarea name="body" placeholder="Reward rules and motivation" required />
          <select name="groupId"><option value="">All groups</option>{snapshot.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
          <select name="agentId"><option value="">All agents</option>{snapshot.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.displayName}</option>)}</select>
          <button className="sales-primary-button" type="submit">Pin reward</button>
        </form>

        <article className="sales-panel" id="sales-agents-table">
          <div className="sales-panel-title"><Users size={18} /><strong>Agents & Teams</strong></div>
          <div className="sales-table">
            {snapshot.agents.map((agent) => (
              <div className="sales-table-row" key={agent.id}>
                <div>
                  <strong>{agent.displayName}</strong>
                  <span>{agent.agentCode} - {snapshot.groups.find((group) => group.id === agent.groupId)?.name ?? "No group"} - {agent.email || agent.phone}</span>
                  <form className="sales-inline-form" onSubmit={(event) => updateAgentTeam(event, agent.id)}>
                    <select defaultValue={agent.groupId ?? ""} name="groupId"><option value="">No group</option>{snapshot.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
                    <select defaultValue={agent.parentAgentId ?? ""} name="parentAgentId"><option value="">No parent</option>{snapshot.agents.filter((candidate) => candidate.id !== agent.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName}</option>)}</select>
                    <input defaultValue={agent.commissionPercent ?? ""} min={0} name="commissionPercent" placeholder="Override %" step="0.01" type="number" />
                    <input defaultValue={agent.maxActiveLeads ?? ""} min={0} name="maxActiveLeads" placeholder="Max leads" step="1" type="number" />
                    <label className="sales-toggle-row"><span>Claim</span><input defaultChecked={agent.canClaimLeads} name="canClaimLeads" type="checkbox" /></label>
                    <label className="sales-toggle-row"><span>Subagents</span><input defaultChecked={agent.canCreateSubAgents} name="canCreateSubAgents" type="checkbox" /></label>
                    <button className="sales-small-button" type="submit">Save team</button>
                  </form>
                  <form className="sales-inline-form" onSubmit={(event) => resetAgentPassword(event, agent.id)}>
                    <input minLength={8} name="password" placeholder="New password" required type="password" />
                    <button className="sales-small-button" type="submit"><KeyRound size={14} /> Reset password</button>
                  </form>
                </div>
                <span>{agent.status}</span>
                <button className="sales-small-button" onClick={() => updateAgent(agent.id, "ACTIVE")} type="button">Approve</button>
                <button className="sales-small-button" onClick={() => updateAgent(agent.id, "SUSPENDED")} type="button">Suspend</button>
                <button className="sales-small-button" onClick={() => deleteAgent(agent.id)} type="button"><Trash2 size={14} /> Delete</button>
              </div>
            ))}
          </div>
        </article>

        <article className="sales-panel">
          <div className="sales-panel-title"><Smartphone size={18} /><strong>CRM Mobile Devices</strong></div>
          <div className="sales-table">
            {snapshot.mobileDevices.map((device) => (
              <div className="sales-table-row" key={device.id}>
                <div>
                  <strong>{device.deviceName}</strong>
                  <span>{device.manufacturer} {device.model} - {snapshot.agents.find((agent) => agent.id === device.agentId)?.displayName ?? "Unknown agent"}</span>
                  <small>{device.simLabel || "No office SIM selected"}{device.officeSimNumber ? ` - ${device.officeSimNumber}` : ""}</small>
                  <small>Last seen {new Date(device.lastSeenAt).toLocaleString()} - {device.recordingCapability}</small>
                </div>
                <span>{device.isActive ? "ACTIVE" : "INACTIVE"}</span>
                <button className="sales-small-button" onClick={() => updateMobileDevice(device.id, !device.isActive, device.recordingEnabled)} type="button">{device.isActive ? "Deactivate" : "Activate"}</button>
                <button className="sales-small-button" disabled={device.recordingCapability === "RECORDING_UNAVAILABLE"} onClick={() => updateMobileDevice(device.id, device.isActive, !device.recordingEnabled)} type="button">Recording {device.recordingEnabled ? "on" : "off"}</button>
              </div>
            ))}
            {!snapshot.mobileDevices.length ? <p className="muted-copy">No Gigxomi CRM phones are registered yet.</p> : null}
          </div>
        </article>

        <article className="sales-panel">
          <div className="sales-panel-title"><PhoneCall size={18} /><strong>Mobile Call Monitoring</strong></div>
          <div className="sales-table">
            {snapshot.mobileCalls.slice(0, 50).map((call) => (
              <div className="sales-table-row sales-table-row-rich" key={call.id}>
                <div>
                  <strong>{call.customerName}</strong>
                  <span>{call.status} - {call.durationSeconds}s - {call.recordingStatus}</span>
                  <small>{call.deviceName || "Unknown device"}{call.deviceModel ? ` - ${call.deviceModel}` : ""} - {call.phoneNumber}</small>
                  <small>{new Date(call.startedAt).toLocaleString()}</small>
                  <small>{call.outcome || "No outcome"} - {call.note || "Pending mandatory note"}</small>
                  {call.recordingError ? <small>Recording issue: {call.recordingError}</small> : null}
                </div>
                <span>{call.noteSubmitted ? "NOTED" : "PENDING NOTE"}</span>
                {call.recordingStatus === "UPLOADED" ? <a className="sales-small-button" href={`/api/sales/mobile/calls/${call.id}/recording`} target="_blank">Play</a> : null}
              </div>
            ))}
            {!snapshot.mobileCalls.length ? <p className="muted-copy">No mobile calls have been synced yet.</p> : null}
          </div>
        </article>

        <form className="sales-panel sales-form-grid" onSubmit={createAnnouncement}>
          <div className="sales-panel-title"><Bell size={18} /><strong>Announcement</strong></div>
          <input name="title" placeholder="Announcement title" required />
          <textarea name="body" placeholder="Message for agents" required />
          <button className="sales-primary-button" type="submit">Publish announcement</button>
        </form>

        <article className="sales-panel">
          <div className="sales-panel-title"><Coins size={18} /><strong>Payout Approval</strong></div>
          <div className="sales-table">
            {snapshot.payouts.map((payout) => (
              <div className="sales-table-row" key={payout.id}>
                <div>
                  <strong>{money(payout.amount)}</strong>
                  <span>{snapshot.agents.find((agent) => agent.id === payout.agentId)?.displayName ?? "Unknown agent"} - {payout.note}</span>
                </div>
                <span>{payout.status}</span>
                <button className="sales-small-button" onClick={() => updatePayout(payout.id, "APPROVED")} type="button">Approve</button>
                <button className="sales-small-button" onClick={() => updatePayout(payout.id, "PAID")} type="button">Paid</button>
                <button className="sales-small-button" onClick={() => updatePayout(payout.id, "REJECTED")} type="button">Reject</button>
              </div>
            ))}
          </div>
        </article>
      </section>
        </>
      )}
      {status ? <p className="sales-floating-status">{status}</p> : null}
    </main>
  );
}
