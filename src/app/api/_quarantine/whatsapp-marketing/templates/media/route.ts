import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { uploadTemplateSampleMedia } from "@/lib/whatsapp-marketing/meta-client";
import { decryptSecureToken } from "@/lib/whatsapp-marketing/config";

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const channelId = formData.get("channelId") as string | null;
    const tenantIdParam = formData.get("tenantId") as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No media file provided." }, { status: 400 });
    }

    // Size limit: 16MB for sample media
    if (file.size > 16 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File exceeds maximum size of 16MB." }, { status: 400 });
    }

    const tenantId = resolveSessionTenantId(auth.session, tenantIdParam);

    let channel = null;
    if (channelId) {
      channel = await prisma.whatsAppChannel.findFirst({ where: { id: channelId, tenantId } });
    } else {
      channel = await prisma.whatsAppChannel.findFirst({ where: { tenantId, status: "ACTIVE" } });
    }

    if (!channel) {
      return NextResponse.json({ ok: false, error: "Active WhatsApp Channel not found." }, { status: 400 });
    }

    const accessToken = decryptSecureToken(channel.encryptedAccessToken || "");
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Channel access token missing." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "image/jpeg";
    const fileName = file.name || "sample_header.jpg";

    const appId = process.env.META_WHATSAPP_APP_ID || channel.businessPortfolioId || "app";

    const uploadRes = await uploadTemplateSampleMedia({
      appId,
      fileBuffer: buffer,
      mimeType,
      fileName,
      accessToken,
    });

    if (!uploadRes.ok) {
      return NextResponse.json({ ok: false, error: uploadRes.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      handle: uploadRes.data.handle,
      fileName,
      fileSize: file.size,
      mimeType,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Media upload failed." },
      { status: 500 },
    );
  }
}
