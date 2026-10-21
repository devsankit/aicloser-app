import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";

export type CustomerFeedbackItem = {
  id: string;
  rating: number;
  name: string;
  contact: string;
  comment: string;
  source: string;
  status: "NEW" | "CONTACTED" | "RESOLVED";
  createdAt: string;
  resolvedAt?: string | null;
  adminNotes?: string | null;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FEEDBACK_FILE = path.join(DATA_DIR, "customer-feedback.json");
const MAX_STORED_FEEDBACK = 500;

let writeQueue = Promise.resolve();

export async function getStoredFeedback(): Promise<CustomerFeedbackItem[]> {
  try {
    if (!existsSync(FEEDBACK_FILE)) return [];
    const data = await readFile(FEEDBACK_FILE, "utf8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error reading customer-feedback.json:", error);
    return [];
  }
}

export async function saveStoredFeedback(items: CustomerFeedbackItem[]): Promise<void> {
  const capped = items.slice(0, MAX_STORED_FEEDBACK);
  writeQueue = writeQueue.then(async () => {
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
    const tempFile = path.join(DATA_DIR, `feedback-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    await writeFile(tempFile, JSON.stringify(capped, null, 2), "utf8");
    await rename(tempFile, FEEDBACK_FILE);
  });
  return writeQueue;
}
