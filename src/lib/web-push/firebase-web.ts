import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import { aicloserApi } from "@/lib/api-client";

type FirebaseWebConfig = {
  apiKey: string;
  appId: string;
  authDomain: string;
  messagingSenderId: string;
  projectId: string;
  storageBucket?: string;
};

let cachedConfig: FirebaseWebConfig | null = null;
let cachedVapidKey = "";
const FIREBASE_CONFIG_TIMEOUT_MS = 2500;

async function readFirebaseWebConfig(): Promise<FirebaseWebConfig | null> {
  if (cachedConfig) {
    return cachedConfig;
  }

  let data: { vapidKey?: string; config?: Record<string, string> } | null = null;
  try {
    data = await aicloserApi.mobile.getPushConfig();
  } catch {
    return null;
  }

  if (!data?.config) {
    return null;
  }

  const apiKey = String(data.config.apiKey ?? "").trim();
  const appId = String(data.config.appId ?? "").trim();
  const authDomain = String(data.config.authDomain ?? "").trim();
  const messagingSenderId = String(data.config.messagingSenderId ?? "").trim();
  const projectId = String(data.config.projectId ?? "").trim();
  const storageBucket = String(data.config.storageBucket ?? "").trim();
  if (!apiKey || !appId || !authDomain || !messagingSenderId || !projectId) {
    return null;
  }

  cachedVapidKey = String(data.vapidKey ?? "").trim();
  cachedConfig = {
    apiKey,
    appId,
    authDomain,
    messagingSenderId,
    projectId,
    storageBucket: storageBucket || undefined,
  };
  return cachedConfig;
}

export async function getFirebaseWebVapidKey() {
  if (!cachedVapidKey) {
    await readFirebaseWebConfig();
  }
  return cachedVapidKey;
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!(await isSupported())) {
    return null;
  }

  const config = await readFirebaseWebConfig();
  if (!config) {
    return null;
  }

  const app = getApps().length ? getApp() : initializeApp(config);
  return getMessaging(app);
}
