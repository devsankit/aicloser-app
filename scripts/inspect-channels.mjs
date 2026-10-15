import fs from "node:fs";

const path = "/var/www/aicloser-app/.gigxomi/local-platform-store.json";
if (fs.existsSync(path)) {
  const store = JSON.parse(fs.readFileSync(path, "utf8"));
  const counts = {};
  for (const c of store.conversations || []) {
    const k = `${c.sourceChannel || "empty"} | ${c.externalSourceType || "empty"}`;
    counts[k] = (counts[k] || 0) + 1;
  }
  console.log("Channel counts:", counts);
} else {
  console.log("File not found on this machine");
}
