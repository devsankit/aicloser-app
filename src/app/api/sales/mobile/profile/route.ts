import { NextResponse } from "next/server";

import { requireSalesMobileSession } from "@/lib/api/require-sales-mobile-session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const authorization = await requireSalesMobileSession();
  if (!authorization.ok) return authorization.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim().replace(/\s+/g, " ") : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (displayName.length < 2 || displayName.length > 80) {
    return NextResponse.json({ ok: false, error: "Enter a name between 2 and 80 characters." }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const user = await prisma.appAuthUser.update({
      where: { id: authorization.session.userId },
      data: { displayName, email: email || null },
      select: { id: true, displayName: true, email: true, phone: true },
    });
    return NextResponse.json({
      ok: true,
      user: { userId: user.id, displayName: user.displayName, email: user.email, phone: user.phone },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "That email is already in use or the profile could not be saved." }, { status: 409 });
  }
}
