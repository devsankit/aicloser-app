import type { IconName } from "@/components/ui/Icon";

export interface ModuleSpec {
  slug: string;
  title: string;
  icon: IconName;
  blurb: string;
  features: string[];
  api: string;
}

export const MODULES: ModuleSpec[] = [
  {
    slug: "lead-import",
    title: "Lead Import",
    icon: "upload",
    blurb:
      "Bring a spreadsheet or CRM export in, map the columns once, and keep a history of every import batch.",
    features: [
      "CSV / XLSX drop zone with column mapping",
      "Duplicate detection on phone + email",
      "Assign an owner and a stage per batch",
      "Import history with rollback",
    ],
    api: "Will read the file locally, then POST batches to the leads endpoint.",
  },
  {
    slug: "calls",
    title: "Call Recordings & Missed Calls",
    icon: "phone",
    blurb:
      "Every inbound and outbound call on the workspace SIMs, with the recording, transcript and outcome attached to the lead.",
    features: [
      "Live call log with direction and duration",
      "Inline player with transcript and AI summary",
      "Missed-call queue with one-tap callback",
      "Disposition codes that move the lead stage",
    ],
    api: "Needs the telephony provider (Exotel / Twilio) webhooks for call events and recordings.",
  },
  {
    slug: "chat",
    title: "Live Multi-Channel Chat",
    icon: "message",
    blurb:
      "One inbox for website chat, WhatsApp and Instagram — with the lead record open next to the thread.",
    features: [
      "Shared inbox with assignment and presence",
      "Thread side panel showing the CRM record",
      "Saved replies and quick actions",
      "SLA timer per conversation",
    ],
    api: "Needs the messaging provider (WhatsApp Cloud API, Instagram) plus a websocket relay.",
  },
  {
    slug: "forms",
    title: "Lead Form Builder",
    icon: "form",
    blurb:
      "Build a capture form, publish it on a public URL, and every submission lands in the pipeline with the right source.",
    features: [
      "Drag fields, set required and hidden logic",
      "Publish to a public link or embed",
      "UTM + source capture per submission",
      "Submission log with spam scoring",
    ],
    api: "Needs a public submissions endpoint and a form definition store.",
  },
  {
    slug: "channels",
    title: "Plugins & Channels",
    icon: "plug",
    blurb:
      "Connect the tools the team already uses — calendars, email, telephony — and route events into the CRM.",
    features: [
      "Connector catalogue with scopes",
      "Webhook log with replay",
      "Field mapping between systems",
      "Per-connector health and rate limits",
    ],
    api: "Needs OAuth apps per provider and a stored credential vault.",
  },
  {
    slug: "whatsapp",
    title: "WhatsApp Marketing",
    icon: "whatsapp",
    blurb:
      "Campaigns and templates on the official WhatsApp Business API, with delivery and reply tracking tied back to leads.",
    features: [
      "Template editor with approval status",
      "Audience builder from CRM segments",
      "Delivery, read and reply analytics",
      "Opt-out handling",
    ],
    api: "Needs a WhatsApp Business Account, template approval and a send queue.",
  },
  {
    slug: "automations",
    title: "AI Bot & Automations",
    icon: "bot",
    blurb:
      "Rules that react to lead activity — rotate an owner, send a follow-up, summarise a call — plus an AI assistant on top of the pipeline.",
    features: [
      "Trigger → condition → action builder",
      "Run history with per-step logs",
      "AI call summaries and next-step suggestions",
      "Guardrails and spend limits",
    ],
    api: "Needs a job runner plus the LLM API for summaries and suggestions.",
  },
  {
    slug: "payments",
    title: "Payments & Confirmations",
    icon: "card",
    blurb:
      "Collect advances and subscription payments, then close the lead automatically when the payment settles.",
    features: [
      "Payment links attached to a deal",
      "UPI / card / netbanking status",
      "Receipts and GST details",
      "Auto-advance stage on success",
    ],
    api: "Needs a payment gateway (Razorpay) account and webhook verification.",
  },
  {
    slug: "team",
    title: "Team & Users",
    icon: "team",
    blurb:
      "Seats, roles and per-user lead visibility — who can see which pipeline and who can move a deal stage.",
    features: [
      "Invite flow with role presets",
      "Round-robin and capacity rules",
      "Per-user activity and conversion",
      "Audit trail for stage changes",
    ],
    api: "Needs the auth provider and the membership table.",
  },
];

export const moduleBySlug = (slug: string) => MODULES.find((m) => m.slug === slug);
