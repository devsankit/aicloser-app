import "server-only";

import { prisma } from "@/lib/prisma";

const DEFAULT_WEBINAR_ID = "gapp-default-webinar";
const DEFAULT_WEBINAR_SLUG = "gapp";
export const GAPP_SALES_WEBINAR_ID = "agency-growth-webinar";

type WebinarUpdateInput = {
  countdownEnabled?: boolean;
  description?: string;
  registrationEnabled?: boolean;
  scheduledAt?: string;
  title?: string;
};

function defaultScheduledAt() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(20, 0, 0, 0);
  return date;
}

async function syncGappWebinarToSales(webinar: {
  description: string;
  registrationEnabled: boolean;
  scheduledAt: Date;
  title: string;
}) {
  const data = {
    description: webinar.description,
    hostId: null,
    isActive: webinar.registrationEnabled,
    registrationLink: "https://ankit.gigxomi.com/",
    startsAt: webinar.scheduledAt,
    title: webinar.title,
  };
  await prisma.$transaction([
    prisma.salesWebinar.upsert({
      where: { id: GAPP_SALES_WEBINAR_ID },
      update: data,
      create: { id: GAPP_SALES_WEBINAR_ID, ...data },
    }),
    prisma.salesWebinar.updateMany({
      where: {
        id: { not: GAPP_SALES_WEBINAR_ID },
        isActive: true,
        registrationLink: { in: ["/webinar", "/agency-growth"] },
      },
      data: { isActive: false },
    }),
  ]);
}

export async function ensureDefaultGappWebinar() {
  const webinar = await prisma.gappWebinar.upsert({
    where: { id: DEFAULT_WEBINAR_ID },
    update: {
      phonePeEnabled: false,
      priceAmount: 0,
      priceMode: "FREE",
    },
    create: {
      countdownEnabled: true,
      currency: "INR",
      description: "Discover how video editors can build a scalable agency with systems, editors, faster approvals, and a structured delivery workflow.",
      id: DEFAULT_WEBINAR_ID,
      phonePeEnabled: false,
      priceAmount: 0,
      priceMode: "FREE",
      registrationEnabled: true,
      scheduledAt: defaultScheduledAt(),
      slug: DEFAULT_WEBINAR_SLUG,
      title: "Gigxomi Agency Partnership Program Webinar",
    },
  });
  await syncGappWebinarToSales(webinar);
  return webinar;
}

export async function updateGappWebinar(input: WebinarUpdateInput) {
  const webinar = await ensureDefaultGappWebinar();
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) throw new Error("Choose a valid webinar date and time.");
  const updated = await prisma.gappWebinar.update({
    where: { id: webinar.id },
    data: {
      countdownEnabled: input.countdownEnabled,
      description: input.description?.trim().slice(0, 2_000) || undefined,
      phonePeEnabled: false,
      priceAmount: 0,
      priceMode: "FREE",
      registrationEnabled: input.registrationEnabled,
      scheduledAt,
      title: input.title?.trim().slice(0, 180) || undefined,
    },
  });
  await syncGappWebinarToSales(updated);
  return updated;
}

export async function listGappRegistrationsForFollowUp(limit = 100) {
  const webinar = await ensureDefaultGappWebinar();
  const registrations = await prisma.gappWebinarRegistration.findMany({
    where: { webinarId: webinar.id },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 500)),
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return { registrations, webinar };
}
