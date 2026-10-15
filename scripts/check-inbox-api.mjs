import { listConversationsForAudienceFromFile } from "../src/lib/gigxomi/dummy-platform-file-store.ts";

async function main() {
  const result = await listConversationsForAudienceFromFile("sales", { limit: 10 });
  console.log("Conversations count from file store:", result.conversations?.length);
  const sample = (result.conversations || []).slice(0, 10).map(c => ({
    id: c.id,
    name: c.customerDisplayName,
    phone: c.customerPhoneDisplay,
    title: c.title
  }));
  console.log("Sample:", JSON.stringify(sample, null, 2));
}

main().catch(console.error);
