export type RegistrationState = boolean | undefined;
export type BillingState = "PAID" | "TRIAL" | "TRIAL_EXPIRED" | "FREE" | "PAYMENT_PENDING" | "UNKNOWN";
export type PhoneMatchState = "MATCH" | "MISMATCH" | "UNKNOWN";

export type RegistrationChannel = {
  provider: string;
  status: string;
  connected: boolean;
  hasIssue: boolean;
  issue: string | null;
  phoneNumber: string | null;
  username: string | null;
  updatedAt: string | null;
};

export type NormalizedRegistrationStatus = {
  registered: RegistrationState;
  freelancerRegistered: RegistrationState;
  appInstalled: RegistrationState;
  onboardingStage: string | null;
  onboardingCompletedAt: string | null;
  billingState: BillingState;
  paid: boolean | undefined;
  planName: string | null;
  planStartsAt: string | null;
  planExpiresAt: string | null;
  planDaysRemaining: number | null;
  packageStatus: string | null;
  channels: RegistrationChannel[];
  agencyWhatsAppNumber: string | null;
  leadWhatsAppNumber: string | null;
  whatsappMatch: PhoneMatchState;
  source: "database";
  checkedAt: string;
  registration: Record<string, unknown> | null;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(...values: unknown[]): boolean | undefined {
  for (const value of values) if (typeof value === "boolean") return value;
  return undefined;
}

function dateValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (typeof value === "string" && value.trim() && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  }
  return null;
}

export function normalizePhoneForMatch(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function paymentEvidence(registration: Record<string, unknown>, subscriptions: Record<string, unknown>[]): boolean {
  const transactions = subscriptions.flatMap((subscription) => {
    const value = subscription.paymentTransactions;
    return Array.isArray(value) ? value.map(objectValue) : [];
  });
  if (transactions.some((transaction) => {
    const amount = Number(transaction.amount ?? 0);
    return transaction.status === "SUCCESS" && Number.isFinite(amount) && amount > 0;
  })) return true;
  if (subscriptions.some((subscription) => {
    const amount = Number(subscription.amount ?? 0);
    return (subscription.paymentStatus === "PAID" || subscription.status === "PAID") && Number.isFinite(amount) && amount > 0;
  })) return true;
  const explicit = registration.paymentSuccess ?? registration.paymentVerified ?? registration.successfulPayment;
  return explicit === true;
}

export function normalizeRegistrationStatus(payload: unknown, leadPhone?: string | null): NormalizedRegistrationStatus {
  const root = objectValue(payload);
  const registration = objectValue(root.registration);
  const onboarding = objectValue(registration.onboarding);
  const rawChannels = Array.isArray(root.channels) ? root.channels : Array.isArray(registration.channels) ? registration.channels : [];
  const channels = rawChannels.map((value) => {
    const channel = objectValue(value);
    return {
      provider: stringValue(channel.provider) ?? "Unknown",
      status: stringValue(channel.status) ?? "Unknown",
      connected: channel.connected === true,
      hasIssue: channel.hasIssue === true || Boolean(stringValue(channel.issue) || stringValue(channel.lastError)),
      issue: stringValue(channel.issue) ?? stringValue(channel.lastError),
      phoneNumber: stringValue(channel.phoneNumber) ?? stringValue(channel.phone),
      username: stringValue(channel.username),
      updatedAt: dateValue(channel.updatedAt),
    } satisfies RegistrationChannel;
  });
  const whatsapp = channels.find((channel) => /whatsapp/i.test(channel.provider));
  const subscriptions = Array.isArray(registration.subscriptions) ? registration.subscriptions.map(objectValue) : [];
  const packageExpiresAt = dateValue(registration.packageExpiresAt, root.packageExpiresAt, ...subscriptions.map((subscription) => subscription.expiresAt));
  const packageStartsAt = dateValue(registration.packageStartsAt, registration.startsAt, ...subscriptions.map((subscription) => subscription.startsAt));
  const expiryMs = packageExpiresAt ? Date.parse(packageExpiresAt) : NaN;
  const expired = Number.isFinite(expiryMs) && expiryMs <= Date.now();
  const registrationStatus = stringValue(registration.status) ?? stringValue(root.status);
  const subscriptionStatuses = subscriptions.map((subscription) => String(subscription.status ?? "").toUpperCase());
  const paymentStatuses = subscriptions.map((subscription) => String(subscription.paymentStatus ?? "").toUpperCase());
  const trialExplicit = root.billingState === "TRIAL" || root.billingState === "TRIAL_EXPIRED" || registration.billingState === "TRIAL" || registration.billingState === "TRIAL_EXPIRED" || root.trial === true || registration.trial === true || subscriptionStatuses.includes("TRIALING") || Boolean(registration.trialExpiresAt || root.trialExpiresAt);
  const paymentPending = paymentStatuses.includes("PENDING") || subscriptionStatuses.includes("PAYMENT_PENDING");
  const freeExplicit = root.billingState === "FREE" || registration.billingState === "FREE" || registrationStatus === "FREE" || registrationStatus === "FREEMIUM" || registration.isFree === true;
  const paid = paymentEvidence(registration, subscriptions);
  const billingState: BillingState = paid
    ? "PAID"
    : trialExplicit && expired
      ? "TRIAL_EXPIRED"
      : trialExplicit
        ? "TRIAL"
        : paymentPending
          ? "PAYMENT_PENDING"
          : freeExplicit
            ? "FREE"
            : "UNKNOWN";
  const registered = booleanValue(root.registered, registration.registered) ?? (Object.keys(registration).length > 0 ? true : undefined);
  const audience = stringValue(registration.audience) ?? stringValue(root.audience);
  const appInstalled = booleanValue(root.appInstalled, root.app_installed, registration.appInstalled, registration.app_installed);
  const freelancerRegistered = booleanValue(root.freelancerRegistered, registration.freelancerRegistered) ?? (audience === "FREELANCER" ? true : undefined);
  const agencyWhatsAppNumber = stringValue(root.agencyWhatsAppNumber) ?? stringValue(registration.agencyWhatsAppNumber) ?? whatsapp?.phoneNumber ?? null;
  const leadWhatsAppNumber = stringValue(leadPhone);
  const leadKey = normalizePhoneForMatch(leadWhatsAppNumber);
  const agencyKey = normalizePhoneForMatch(agencyWhatsAppNumber);
  const whatsappMatch: PhoneMatchState = leadKey && agencyKey ? leadKey === agencyKey ? "MATCH" : "MISMATCH" : "UNKNOWN";
  const planName = stringValue(root.planName) ?? stringValue(registration.planName) ?? stringValue(registration.packageName) ?? stringValue(root.packageName);
  const planDaysRemaining = Number.isFinite(expiryMs) ? Math.max(0, Math.ceil((expiryMs - Date.now()) / 86_400_000)) : null;
  return {
    registered,
    freelancerRegistered,
    appInstalled,
    onboardingStage: stringValue(root.onboardingStage) ?? stringValue(registration.onboardingStage) ?? stringValue(onboarding.stage) ?? stringValue(onboarding.currentStep),
    onboardingCompletedAt: dateValue(root.onboardingCompletedAt, registration.onboardingCompletedAt, onboarding.completedAt),
    billingState,
    paid: paid || billingState === "PAID" ? true : registered === false ? false : undefined,
    planName,
    planStartsAt: packageStartsAt,
    planExpiresAt: packageExpiresAt,
    planDaysRemaining,
    packageStatus: registrationStatus,
    channels,
    agencyWhatsAppNumber,
    leadWhatsAppNumber,
    whatsappMatch,
    source: "database",
    checkedAt: new Date().toISOString(),
    registration: Object.keys(registration).length ? registration : null,
  };
}
