import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

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

export async function getStoredFeedback(): Promise<CustomerFeedbackItem[]> {
  try {
    if (!existsSync(FEEDBACK_FILE)) return [];
    const data = await readFile(FEEDBACK_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading customer-feedback.json:", error);
    return [];
  }
}

export async function saveStoredFeedback(items: CustomerFeedbackItem[]): Promise<void> {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FEEDBACK_FILE, JSON.stringify(items, null, 2), "utf8");
}
