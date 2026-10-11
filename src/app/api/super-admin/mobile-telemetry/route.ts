import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSessionRole(["SUPER_ADMIN"]);

    const [devices, calls, diagnosticEvents, uploads] = await Promise.all([
      prisma.salesMobileDevice.findMany({
        orderBy: { lastSeenAt: "desc" },
        include: {
          agent: {
            include: {
              user: {
                select: {
                  displayName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      }),
      prisma.salesMobileCall.findMany({
        take: 100,
        orderBy: { startedAt: "desc" },
        include: {
          device: {
            select: {
              deviceName: true,
              manufacturer: true,
              model: true,
              androidVersion: true,
              recordingCapability: true,
            },
          },
          agent: {
            include: {
              user: {
                select: {
                  displayName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.salesMobileOfflineEvent.findMany({
        where: { type: "DEVICE_DIAGNOSTIC" },
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          device: {
            select: {
              deviceName: true,
              model: true,
              manufacturer: true,
            },
          },
        },
      }),
      prisma.callRecordingUpload.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const uploadsByCallId = new Map(uploads.map((u) => [u.callId, u]));

    const totalDevices = devices.length;
    const totalCalls = calls.length;
    const uploadedRecordings = calls.filter((c) => c.recordingStatus === "UPLOADED").length;
    const failedRecordings = calls.filter((c) => c.recordingStatus === "FAILED").length;
    const pendingRecordings = calls.filter((c) => c.recordingStatus === "LOCAL_PENDING" || c.recordingStatus === "UPLOADING").length;

    // Plain-language action items for Super Admin
    const actionItems: Array<{
      id: string;
      level: "critical" | "warning" | "info" | "success";
      title: string;
      deviceOrUser: string;
      details: string;
      recommendation: string;
    }> = [];

    // Analyze devices
    for (const dev of devices) {
      const cap = dev.recordingCapability || "UNKNOWN";
      const modelStr = `${dev.manufacturer || ""} ${dev.model || dev.deviceName}`.trim();
      const userStr = dev.agent?.user?.displayName || dev.agent?.user?.email || "Agent";

      if (cap === "UNAVAILABLE" || !dev.recordingEnabled) {
        actionItems.push({
          id: `dev-unavail-${dev.id}`,
          level: "critical",
          title: "Phone Recording Not Enabled",
          deviceOrUser: `${userStr} (${modelStr})`,
          details: `Device is registered, but recording capability is marked as UNAVAILABLE or disabled.`,
          recommendation: `Tell the agent to open Setup or More screen and enable phone recording or grant permissions.`,
        });
      } else if (cap === "DIALER_SHARE") {
        actionItems.push({
          id: `dev-share-${dev.id}`,
          level: "warning",
          title: "Google / Stock Dialer (Manual Share Mode)",
          deviceOrUser: `${userStr} (${modelStr})`,
          details: `This device uses Google Dialer which hides call files from Android storage. Automatic folder scraping is restricted by Google.`,
          recommendation: `Agent must use the Phone app's Share button to send recordings, or enable Microphone fallback.`,
        });
      } else if (cap === "MICROPHONE_FALLBACK") {
        actionItems.push({
          id: `dev-mic-${dev.id}`,
          level: "warning",
          title: "Microphone Fallback Active",
          deviceOrUser: `${userStr} (${modelStr})`,
          details: `Audio is captured from the mic. Only the agent's voice will be loud; client voice may be faint unless speakerphone is used.`,
          recommendation: `For two-sided audio, ensure OEM dialer automatic recording is enabled in Phone settings.`,
        });
      }
    }

    // Analyze failed calls
    const recentFailures = calls.filter((c) => c.recordingStatus === "FAILED" || (c.recordingError && c.recordingError.length > 0));
    for (const call of recentFailures.slice(0, 5)) {
      actionItems.push({
        id: `call-fail-${call.id}`,
        level: "critical",
        title: `Recording Upload Error on ${call.phoneNumber}`,
        deviceOrUser: `${call.agent?.user?.displayName || "Agent"} (${call.device?.model || "Phone"})`,
        details: call.recordingError || "The recording upload failed before completing.",
        recommendation: `Check agent network stability or inspect diagnostic log for this call.`,
      });
    }

    // Success note if everything is smooth
    if (uploadedRecordings > 0 && failedRecordings === 0) {
      actionItems.push({
        id: "sys-healthy",
        level: "success",
        title: "Recordings Syncing Cleanly",
        deviceOrUser: "System Wide",
        details: `${uploadedRecordings} call recordings successfully uploaded and playable on dashboard.`,
        recommendation: "System operating normally.",
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalDevices,
        totalCalls,
        uploadedRecordings,
        failedRecordings,
        pendingRecordings,
        healthyRate: totalCalls > 0 ? Math.round((uploadedRecordings / totalCalls) * 100) : 100,
      },
      actionItems,
      devices: devices.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        manufacturer: d.manufacturer || "",
        model: d.model || "",
        androidVersion: d.androidVersion || "",
        appVersion: d.appVersion || "",
        simLabel: d.simLabel || "",
        officeSimNumber: d.officeSimNumber || "",
        recordingCapability: d.recordingCapability,
        recordingEnabled: d.recordingEnabled,
        lastSeenAt: d.lastSeenAt.toISOString(),
        agentName: d.agent?.user?.displayName || "Unknown",
        agentEmail: d.agent?.user?.email || "",
      })),
      calls: calls.slice(0, 50).map((c) => ({
        id: c.id,
        phoneNumber: c.phoneNumber,
        direction: c.direction,
        status: c.status,
        startedAt: c.startedAt.toISOString(),
        endedAt: c.endedAt?.toISOString() || null,
        durationSeconds: c.durationSeconds || 0,
        recordingStatus: c.recordingStatus,
        recordingPath: c.recordingPath,
        recordingError: c.recordingError,
        recordingSizeBytes: c.recordingSizeBytes,
        agentName: c.agent?.user?.displayName || "Unknown",
        deviceModel: c.device?.model || c.device?.deviceName || "Mobile",
        deviceManufacturer: c.device?.manufacturer || "",
        uploadAttempts: uploadsByCallId.get(c.id)?.attemptCount || 0,
      })),
      diagnosticEvents: diagnosticEvents.map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        deviceName: e.device?.model || e.device?.deviceName || "Unknown Device",
        payload: e.payload,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load mobile telemetry" },
      { status: 500 }
    );
  }
}
