const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const calls = await prisma.salesMobileCall.findMany({
      select: {
        id: true,
        phone: true,
        direction: true,
        durationSeconds: true,
        recordingUrl: true,
        recordingDurationSeconds: true,
        recordingSizeBytes: true,
        recordingError: true,
        recordingSource: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    console.log("CALLS:", JSON.stringify(calls, null, 2));
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
