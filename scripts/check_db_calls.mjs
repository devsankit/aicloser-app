
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const calls = await prisma.salesMobileCall.findMany({
    orderBy: { startedAt: 'desc' },
    take: 15,
    select: { id: true, phoneNumber: true, direction: true, startedAt: true, durationSeconds: true, deviceId: true }
  });
  console.log('CALLS:', JSON.stringify(calls, null, 2));

  const count = await prisma.salesMobileCall.count();
  console.log('COUNT:', count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
