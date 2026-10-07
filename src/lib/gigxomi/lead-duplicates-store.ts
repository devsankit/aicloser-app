import "server-only";

import { prisma } from "@/lib/prisma";

export type DuplicateCluster = {
  key: string; // phone or email
  count: number;
  leads: Array<{
    id: string;
    customerName: string;
    customerPhone: string | null;
    customerEmail: string | null;
    source: string;
    stage: string;
    createdAt: string;
    notes: string | null;
  }>;
};

export async function findDuplicateLeads(): Promise<DuplicateCluster[]> {
  const allLeads = await prisma.salesLeadAssignment.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      source: true,
      stage: true,
      createdAt: true,
      notes: true,
    },
  });

  const phoneClusters = new Map<string, typeof allLeads>();
  for (const lead of allLeads) {
    if (!lead.customerPhone) continue;
    const cleanPhone = lead.customerPhone.replace(/\D/g, "");
    const normalized = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
    if (normalized.length >= 7) {
      const list = phoneClusters.get(normalized) || [];
      list.push(lead);
      phoneClusters.set(normalized, list);
    }
  }

  const clusters: DuplicateCluster[] = [];
  for (const [phone, list] of phoneClusters.entries()) {
    if (list.length > 1) {
      clusters.push({
        key: `Phone: ${phone}`,
        count: list.length,
        leads: list.map((l) => ({
          ...l,
          createdAt: l.createdAt.toISOString(),
        })),
      });
    }
  }

  return clusters;
}

export async function mergeLeads(primaryLeadId: string, secondaryLeadId: string) {
  const primary = await prisma.salesLeadAssignment.findUnique({ where: { id: primaryLeadId } });
  const secondary = await prisma.salesLeadAssignment.findUnique({ where: { id: secondaryLeadId } });

  if (!primary || !secondary) throw new Error("One or both leads not found");

  // Re-link mobile calls from secondary to primary
  await prisma.salesMobileCall.updateMany({
    where: { assignmentId: secondaryLeadId },
    data: { assignmentId: primaryLeadId },
  });

  // Consolidate tags
  const combinedTags = Array.from(new Set([...primary.tags, ...secondary.tags]));

  // Consolidate notes
  const combinedNotes = [
    primary.notes,
    secondary.notes ? `[Merged from ${secondary.customerName} (${secondary.id})]: ${secondary.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Update primary lead
  const updatedPrimary = await prisma.salesLeadAssignment.update({
    where: { id: primaryLeadId },
    data: {
      tags: combinedTags,
      notes: combinedNotes,
      customerEmail: primary.customerEmail || secondary.customerEmail,
      customerPhone: primary.customerPhone || secondary.customerPhone,
      budgetAmount: primary.budgetAmount || secondary.budgetAmount,
    },
  });

  // Delete secondary lead
  await prisma.salesLeadAssignment.delete({ where: { id: secondaryLeadId } });

  return { ok: true, primary: updatedPrimary };
}
