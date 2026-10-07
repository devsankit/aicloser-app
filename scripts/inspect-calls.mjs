import { prisma } from "../src/lib/prisma.js";

async function main() {
  try {
    const count = await prisma.salesMobileCall.count();
    console.log("CALL COUNT:", count);
    const calls = await prisma.salesMobileCall.findMany({ take: 10 });
    console.log("CALLS:", JSON.stringify(calls, null, 2));
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    process.exit(0);
  }
}

main();
