import "server-only";

import { prisma } from "@/lib/prisma";

export type LeadIqProfile = {
  intentScore: number; // 0-100
  urgencyLevel: "HIGH" | "MEDIUM" | "LOW";
  recommendedAction: string;
  tailoredScript: string;
  whatsappPitchDraft: string;
  objectionCards: Array<{ objection: string; counter: string }>;
};

export async function generateLeadIqProfile(lead: {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  serviceInterest?: string | null;
  source?: string;
  stage: string;
  notes?: string | null;
}): Promise<LeadIqProfile> {
  const name = lead.customerName || "Customer";
  const service = lead.serviceInterest || "growth service";

  // Calculate intent score based on stage
  let intentScore = 45;
  let urgencyLevel: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";

  if (["NEGOTIATION", "PAYMENT_PENDING", "QUALIFIED"].includes(lead.stage)) {
    intentScore = 88;
    urgencyLevel = "HIGH";
  } else if (["INTERESTED", "FOLLOW_UP"].includes(lead.stage)) {
    intentScore = 72;
    urgencyLevel = "HIGH";
  } else if (["CONTACTED", "ASSIGNED"].includes(lead.stage)) {
    intentScore = 55;
    urgencyLevel = "MEDIUM";
  } else if (["NOT_REACHABLE", "RECYCLED"].includes(lead.stage)) {
    intentScore = 28;
    urgencyLevel = "LOW";
  }

  const tailoredScript = `Hi ${name}, this is Sales Closer following up from your inquiry regarding ${service}.

I noticed your requirement came via ${lead.source || "our platform"}. Our agencies typically see an immediate 2.5x increase in qualified lead pipeline within the first 14 days of deployment.

Do you have 2 quick minutes to review the setup, or is WhatsApp more convenient?`;

  const whatsappPitchDraft = `Hi ${name} 👋

Thanks for connecting regarding *${service}*.

Here is a quick summary of what we cover:
1. Dedicated sales closer setup & SIM auto-dialing
2. Full WhatsApp/Instagram conversation integration
3. 100% cloud backup for all customer calls

Would you like to schedule a 10-minute walkthrough today or tomorrow?`;

  const objectionCards = [
    {
      objection: "Send details on WhatsApp first",
      counter: "Absolutely! I will WhatsApp you our 1-page summary right now. Quick question: are you evaluating this for an individual or a full team?",
    },
    {
      objection: "Price is higher than expected",
      counter: "We offer performance-backed milestones so your new revenue pays for the package before the next billing cycle.",
    },
    {
      objection: "Currently busy / call later",
      counter: "No problem at all! Would 4:30 PM today or 11:00 AM tomorrow work better for a 3-minute chat?",
    },
  ];

  return {
    intentScore,
    urgencyLevel,
    recommendedAction:
      intentScore > 80
        ? "Close Deal: Send direct payment link and contract terms"
        : intentScore > 60
        ? "Phone Demo: Schedule 15-min walkthrough or video call"
        : "Nurture: Send WhatsApp case study & schedule callback",
    tailoredScript,
    whatsappPitchDraft,
    objectionCards,
  };
}

// Natural Language CRM Query Engine
export async function executeNaturalLanguageQuery(query: string) {
  const q = query.toLowerCase();

  if (q.includes("call") || q.includes("dial")) {
    const totalCalls = await prisma.salesMobileCall.count();
    const uploadedCalls = await prisma.salesMobileCall.count({ where: { recordingStatus: "UPLOADED" } });
    return {
      query,
      answer: `There are currently ${totalCalls} total SIM calls recorded in the system. ${uploadedCalls} calls have audio recordings uploaded and ready for review.`,
      data: { totalCalls, uploadedCalls },
    };
  }

  if (q.includes("lead") || q.includes("pipeline")) {
    const totalLeads = await prisma.salesLeadAssignment.count();
    const wonLeads = await prisma.salesLeadAssignment.count({
      where: { stage: { in: ["CLOSED_WON", "PAID" as any] } },
    });
    return {
      query,
      answer: `Your CRM currently holds ${totalLeads} active leads across all stages. ${wonLeads} deals have been successfully closed and paid.`,
      data: { totalLeads, wonLeads },
    };
  }

  if (q.includes("agent") || q.includes("closer")) {
    const agents = await prisma.salesAgentProfile.findMany({
      select: {
        agentCode: true,
        status: true,
        user: { select: { displayName: true } },
      },
    });
    return {
      query,
      answer: `You have ${agents.length} registered sales closer agents. Active team: ${agents.map((a) => a.user.displayName).join(", ")}.`,
      data: { agents },
    };
  }

  return {
    query,
    answer: `Query processed over tenant CRM data. To see deep breakdowns, navigate to 'Advanced Reports' or filter the Kanban board.`,
    data: {},
  };
}
