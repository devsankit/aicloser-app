import fs from "node:fs";
import path from "node:path";

const p = path.join(process.cwd(), ".gigxomi", "local-platform-store.json");
const d = JSON.parse(fs.readFileSync(p, "utf8"));
const lidConvs = d.conversations.filter(c => {
  const digits = String(c.customerName || "").replace(/\D/g, "");
  return c.customerName?.startsWith("+") && digits.length > 12;
});

console.log("Total conversations with LID as customerName:", lidConvs.length);
console.log("Sample LID conversations (first 10):", JSON.stringify(lidConvs.slice(0, 10).map(c => ({
  id: c.id,
  name: c.customerName,
  phone: c.customerPhone,
  title: c.title,
  source: c.externalSourceType
})), null, 2));

const phoneConvs = d.conversations.filter(c => {
  const digits = String(c.customerName || "").replace(/\D/g, "");
  return c.customerName?.startsWith("+") && digits.length <= 12;
});
console.log("\nConversations with phone as customerName:", phoneConvs.length);
console.log("Sample phone conversations (first 5):", JSON.stringify(phoneConvs.slice(0, 5).map(c => ({
  id: c.id,
  name: c.customerName,
  phone: c.customerPhone
})), null, 2));
