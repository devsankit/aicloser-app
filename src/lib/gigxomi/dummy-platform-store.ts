import {
  agencyDirectoryCards,
  agencyPlans,
  editorAgencyMemberships,
  editorPerformanceProfiles,
  getPublicServiceSignals,
  type HiringStatus,
  type KarmaBand,
  type TeamMembershipStatus,
  type WorkloadBand,
} from "@/lib/gigxomi/business-ecosystem-data";
import {
  isAutomatedAssignmentOutcomeMessageBody,
  isConversationMessageIncomingForAudience,
} from "@/lib/gigxomi/chat-message-normalization";
import {
  buildInboundAttachmentAcknowledgement,
  classifyInboundAttachmentIntent,
} from "@/lib/gigxomi/closer-message-safety";
import { crmContacts, crmStatuses, crmTemplates } from "@/lib/gigxomi/crm-data";
import { normalizeInstagramGraphApiVersion, sendInstagramTextMessage } from "@/lib/gigxomi/meta-instagram";
import { whatsappMessageIdsMatch } from "@/lib/gigxomi/whatsapp-message-id";

const LEGACY_META_WHATSAPP_APP_ID = "1385995129001581";
const LEGACY_META_WHATSAPP_CONFIG_ID = "899249879744989";
const PRODUCTION_META_WHATSAPP_APP_ID = "948301758190635";
const PRODUCTION_META_WHATSAPP_CONFIG_ID = "1982640385723187";
// The public Gigxomi authentication line must retain an intake route even if
// Meta rotates its phone-number ID before the saved connection metadata is
// refreshed. This is deliberately an exact, normalized number match.
const PUBLIC_AUTH_WHATSAPP_PHONE_DIGITS = process.env.CLOSER_WHATSAPP_PHONE_DIGITS?.trim() || "919993328124";
export const GIGXOMI_REVIEW_FLOW_ID = "2443042916182000";
export const GIGXOMI_PROJECT_INTAKE_FLOW_ID = "4530865463862015";
const PROJECT_OFFER_WINDOW_MS = 10 * 60 * 1000;

function replaceLegacyMetaId(value: string, legacyValue: string, productionValue: string) {
  const normalized = value.trim();
  // Explicit app IDs must survive reads: AiCloser and Gigxomi are separate apps.
  return normalized || (legacyValue === LEGACY_META_WHATSAPP_APP_ID ? LEGACY_META_WHATSAPP_APP_ID : "");
}

const DEFAULT_META_WHATSAPP_APP_ID = replaceLegacyMetaId(
  process.env.META_WHATSAPP_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim() || process.env.META_APP_ID?.trim() || "",
  LEGACY_META_WHATSAPP_APP_ID,
  PRODUCTION_META_WHATSAPP_APP_ID,
);
const DEFAULT_META_WHATSAPP_CONFIG_ID = replaceLegacyMetaId(
  process.env.META_WHATSAPP_CONFIG_ID?.trim() || process.env.FACEBOOK_CONFIG_ID?.trim() || process.env.META_CONFIG_ID?.trim() || "",
  LEGACY_META_WHATSAPP_CONFIG_ID,
  PRODUCTION_META_WHATSAPP_CONFIG_ID,
);
const DEFAULT_META_WHATSAPP_SESSION_INFO_VERSION = process.env.META_WHATSAPP_SESSION_INFO_VERSION?.trim() || "3";
const DEFAULT_META_WHATSAPP_EMBEDDED_SIGNUP_VERSION = process.env.META_WHATSAPP_EMBEDDED_SIGNUP_VERSION?.trim() || "v4";
const DEFAULT_META_WHATSAPP_FEATURE_TYPE =
  process.env.META_WHATSAPP_FEATURE_TYPE?.trim() ||
  process.env.NEXT_PUBLIC_META_WHATSAPP_FEATURE_TYPE?.trim() ||
  "whatsapp_business_app_onboarding";

export const META_WHATSAPP_ONBOARDING_URL = buildMetaWhatsAppOnboardingUrlFromSeed({
  metaAppId: DEFAULT_META_WHATSAPP_APP_ID,
  metaConfigId: DEFAULT_META_WHATSAPP_CONFIG_ID,
  sessionInfoVersion: DEFAULT_META_WHATSAPP_SESSION_INFO_VERSION,
  embeddedSignupVersion: DEFAULT_META_WHATSAPP_EMBEDDED_SIGNUP_VERSION,
});

export type DummyServiceStatus = "Draft" | "Pending Review" | "Approved" | "Rejected" | "Paused";
export type DummyConversationStatus = "New" | "Manager Review" | "Assigned" | "Active" | "Closed";
export type DummyConversationLane = "customer" | "internal";
export type DummyConversationRole = "customer" | "manager" | "admin" | "freelancer" | "sales";
export type DummyConversationSourceChannel = "whatsapp" | "instagram" | "in-app";
export type DummyAttachmentTarget = "local" | "youtube";
export type DummyWhatsAppStatus =
  | "Not started"
  | "Onboarding in progress"
  | "Business submitted"
  | "Number connected"
  | "Ready for webhook";
export type DummyInstagramStatus =
  | "Not started"
  | "Not connected"
  | "Plugin enabled"
  | "Connected"
  | "Ready for webhook"
  | "Needs attention";
export type DummyYouTubeStatus = "Not connected" | "Channel mapped" | "Upload ready";
export type DummyWhatsAppPaymentGateway = "payu" | "razorpay" | "zaakpay";
export const DUMMY_WHATSAPP_MANUAL_OVERRIDE_KEYS = [
  "phoneNumber",
  "phoneNumberId",
  "wabaId",
  "businessPortfolioId",
  "businessId",
  "displayName",
  "businessName",
  "systemUserId",
] as const;
export type DummyWhatsAppManualOverrideKey = (typeof DUMMY_WHATSAPP_MANUAL_OVERRIDE_KEYS)[number];
export type DummyWhatsAppManualOverrides = Record<DummyWhatsAppManualOverrideKey, boolean>;

export type DummyWhatsAppDeliveryMode = "local-only" | "whatsapp-sent" | "whatsapp-failed" | "instagram-sent" | "instagram-failed";
export type DummyChatAttachmentKind = "file" | "image" | "video" | "audio" | "voice-note" | "youtube-upload" | "payment-request";
export type DummyLeadStatusTone = "neutral" | "accent" | "warning" | "success";
export type DummyPaymentStatus = "Draft" | "Sent" | "Viewed" | "Paid" | "Failed" | "Cancelled";
export type DummyManagerPermissionKey =
  | "chatInbox"
  | "assignedChats"
  | "quoteReview"
  | "deliveryReview"
  | "walletReview"
  | "escalations"
  | "allContacts";

export type DummyServiceFaq = {
  question: string;
  answer: string;
};

export type DummyServiceMedia = {
  id: string;
  kind: "image" | "video";
  title: string;
  accent: string;
  sourceUrl?: string;
  embedUrl?: string;
};

export type DummyService = {
  id: string;
  slug: string;
  ownerId: string;
  ownerName: string;
  ownerAlias: string;
  title: string;
  summary: string;
  category: "Video Editing" | "Graphic Design";
  specialty: string;
  primaryEditorCategory?: string;
  secondaryEditorCategories?: string[];
  identityVerified?: boolean;
  trustScore?: number;
  description: string;
  targetAudience: string;
  deliveryTime: string;
  revisions: string;
  basePrice: number;
  currency: "INR";
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  deliverables: string[];
  faq: DummyServiceFaq[];
  media: DummyServiceMedia[];
  status: DummyServiceStatus;
  listingEnabled?: boolean;
  availability?: "ACTIVE" | "PAUSED";
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type DummyPublicServiceCard = DummyService & {
  trustBand: KarmaBand;
  workloadBand: WorkloadBand;
  activeAgencySummary: string;
  turnaroundLabel: string;
};

export type DummyConversationAttachment = {
  id: string;
  kind: DummyChatAttachmentKind;
  target: DummyAttachmentTarget;
  name: string;
  mimeType: string;
  sizeLabel: string;
  note?: string;
  durationLabel?: string;
  collectionName?: string;
  externalUrl?: string;
  paymentRequestId?: string;
};

export type DummyLeadStatus = {
  id: string;
  label: string;
  tone: DummyLeadStatusTone;
  order: number;
  active: boolean;
};

export type DummyConversationTemplate = {
  id: string;
  title: string;
  category: string;
  content: string;
};

export type DummyManagerPermissionSet = Record<DummyManagerPermissionKey, boolean>;

export type DummyManagerAccount = {
  id: string;
  tenantId: string;
  authUserId?: string;
  name: string;
  email: string;
  phone?: string;
  queue: string;
  active: boolean;
  permissions: DummyManagerPermissionSet;
};

export type DummyContact = {
  id: string;
  tenantId: string;
  conversationId?: string;
  customerId: string;
  name: string;
  phone: string;
  profileImageUrl?: string;
  tags: string[];
  notes: string;
  currentService: string;
  latestStatusId: string;
  assignedUserId: string;
  lastActivity: string;
};

export type DummyRevenueSplit = {
  planLabel: string;
  platformPercentage: number;
  editorPercentage: number;
  grossAmount: number;
  platformAmount: number;
  editorAmount: number;
};

export type DummyPaymentProofAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeLabel: string;
  note?: string;
  externalUrl?: string;
  uploadedAt: string;
  uploadedByRole: DummyConversationRole;
};

export type DummyPaymentRequest = {
  id: string;
  assignmentId?: string;
  projectId?: string;
  projectTitle?: string;
  title: string;
  note: string;
  amount: number;
  dueLabel?: string;
  lane: DummyConversationLane;
  payerRole: "client" | "agency";
  payeeRole: "agency" | "freelancer";
  status: DummyPaymentStatus;
  paymentProvider?: DummyWhatsAppPaymentGateway;
  paymentOrderId?: string;
  paymentConfigurationName?: string;
  paymentLink?: string;
  upiUrl: string;
  upiId: string;
  payeeName: string;
  templateMessage: string;
  split: DummyRevenueSplit;
  proofAttachments: DummyPaymentProofAttachment[];
  proofSubmittedAt?: string;
  paidConfirmedByRole?: DummyConversationRole;
  paidConfirmedByName?: string;
  paidConfirmedAt?: string;
  createdByRole: DummyConversationRole;
  createdByLabel: string;
  createdAt: string;
  paidAt?: string;
};

export type DummyPaymentProvider = DummyWhatsAppPaymentGateway;

export type DummyWalletCredit = {
  id: string;
  editorId: string;
  editorName: string;
  conversationId: string;
  paymentRequestId: string;
  title: string;
  grossAmount: number;
  platformAmount: number;
  editorAmount: number;
  status: "Pending" | "Available";
  createdAt: string;
};

export type DummyCustomerReview = {
  id: string;
  conversationId: string;
  tenantId: string;
  agencyName: string;
  editorId?: string;
  editorName?: string;
  customerPhone: string;
  rating?: number;
  comment?: string;
  sourceFlowId: string;
  externalMessageId?: string;
  submittedAt: string;
};

export type DummyUpiConfig = {
  tenantId: string;
  enabled: boolean;
  upiId: string;
  payeeName: string;
  currency: "INR";
  notePrefix: string;
  updatedAt: string;
};

export type DummyCustomerPrivacySettings = {
  tenantId: string;
  maskCustomerPhoneForManagers: boolean;
  maskCustomerPhoneForFreelancers: boolean;
  updatedAt: string;
};

export type DummyMessageVisibility = "client_private";
export type DummyConversationReadKey = DummyConversationRole | `${DummyConversationRole}:${DummyConversationLane}`;

export type DummyConversationMessage = {
  id: string;
  clientMessageId?: string;
  lane: DummyConversationLane;
  senderRole: DummyConversationRole;
  senderLabel: string;
  body: string;
  attachments?: DummyConversationAttachment[];
  visibility?: DummyMessageVisibility;
  externalMessageId?: string;
  deliveryStatus?: "failed" | "sent" | "delivered" | "read";
  deliveryError?: string;
  deletedAt?: string;
  deletedByRole?: DummyConversationRole;
  deletedByUserId?: string;
  deletedScope?: "everyone";
  deleteMetaSupported?: boolean;
  deleteMetaSynced?: boolean;
  deleteMetaNote?: string;
  createdAt: string;
};

export type DummyTypingState = {
  role: DummyConversationRole;
  label: string;
  lane: DummyConversationLane;
  active: boolean;
  updatedAt: string;
};

export type DummyConversationAssignmentOfferStatus = "PENDING" | "ACCEPTED" | "PASSED" | "EXPIRED";

export type DummyConversationAssignmentOffer = {
  id: string;
  dispatchRequestId?: string;
  freelancerId: string;
  freelancerName: string;
  projectDetails: string;
  status: DummyConversationAssignmentOfferStatus;
  offeredByRole: "manager" | "admin";
  offeredByName: string;
  createdAt: string;
  respondedAt?: string;
  expiresAt?: string;
  expiredReason?: "timeout" | "accepted_by_other" | "manual" | "fallback";
  source?: "manual" | "targeted" | "fallback";
  category?: string;
  intent?: "primary" | "replacement";
};

export type DummyConversationFreelancerCollaborator = {
  freelancerId: string;
  freelancerName: string;
  addedAt: string;
  addedByRole: "manager" | "admin";
  addedByName: string;
};

export type DummyProjectIntakeReviewStatus = "NONE" | "WAITING_FOR_CLIENT" | "SUBMITTED" | "APPROVED" | "HOLD" | "REJECTED";

export type DummyConversationProjectIntake = {
  intakeFlowId: string;
  targetEditorUsername?: string;
  targetEditorId?: string;
  serviceTitle?: string;
  servicePageUrl?: string;
  startingPriceLabel?: string;
  expectedDeliveryLabel?: string;
  projectName?: string;
  googleDriveLink?: string;
  referenceVideoLink?: string;
  editingNote?: string;
  opsReviewStatus: DummyProjectIntakeReviewStatus;
  submittedAt?: string;
  approvedAt?: string;
  lastFlowMessageId?: string;
};

export type DummyConversation = {
  id: string;
  contactId: string;
  serviceId: string;
  serviceSlug: string;
  serviceTitle: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerProfileImageUrl?: string;
  instagramBusinessAccountId?: string;
  instagramScopedUserId?: string;
  maskedCustomerName: string;
  tenantId: string;
  sourceChannel?: DummyConversationSourceChannel;
  status: DummyConversationStatus;
  leadStatusId: string;
  summary: string;
  internalNotes: string;
  nextFollowUpAt?: string | null;
  assignedFreelancerId?: string;
  assignedFreelancerName?: string;
  freelancerCollaborators?: DummyConversationFreelancerCollaborator[];
  assignmentOffers?: DummyConversationAssignmentOffer[];
  projectIntake?: DummyConversationProjectIntake;
  ownerRole?: "manager" | "admin" | "sales";
  ownerName?: string;
  readStateByAudience: Partial<Record<DummyConversationReadKey, string>>;
  freelancerClientAliases?: Record<string, string>;
  lastCustomerActivityAt: string;
  isInAppCustomerThread: boolean;
  freelancerCustomerLaneAccess?: boolean;
  freelancerCustomerLaneAccessUpdatedAt?: string;
  freelancerCustomerLaneAccessGrantedByRole?: "manager" | "admin";
  freelancerCustomerLaneAccessGrantedByName?: string;
  aiAutoReplyDisabled?: boolean;
  aiAutoReplyDisabledUpdatedAt?: string;
  aiAutoReplyDisabledByRole?: "closer" | "admin" | "manager" | "system";
  aiAutoReplyDisabledByName?: string;
  latestPaymentRequestId?: string;
  paymentRequests: DummyPaymentRequest[];
  messages: DummyConversationMessage[];
  typing: DummyTypingState[];
  createdAt: string;
  updatedAt: string;
};

export type DummyConversationAgencyContext = {
  tenantId: string;
  agencyName: string;
  agencySlug: string;
  agencyProfilePath: string;
  location: string;
  hiringStatus: HiringStatus;
  specialties: string[];
  trustScore: number;
  trustBand: KarmaBand;
  membershipRole: string;
  membershipStatus: TeamMembershipStatus | "Unknown";
  responseSlaLabel: string;
  payoutTrustLabel: string;
  repeatClientLabel: string;
};

export type DummyFreelancerCustomerLanePermission = {
  enabled: boolean;
  updatedAt?: string;
  grantedByRole?: "manager" | "admin";
  grantedByName?: string;
  transportState: "ready" | "demo" | "blocked";
  transportNote: string;
};

export type DummyConversationAgencySummary = {
  tenantId: string;
  agencyName: string;
  agencySlug: string;
  agencyProfilePath: string;
  location: string;
};

export type DummyConversationAssignmentSummary = {
  assignedFreelancerId?: string;
  assignedFreelancerName?: string;
  freelancerCollaborators?: DummyConversationFreelancerCollaborator[];
  ownerName?: string;
  ownerRole?: "manager" | "admin" | "sales";
  offers?: DummyConversationAssignmentOffer[];
  pendingOfferCount?: number;
  myOffer?: DummyConversationAssignmentOffer;
};

export type DummyEditorAvailability = {
  editorId: string;
  onlineStatus: "online" | "offline";
  acceptingProjects: boolean;
  lastOnlineAt?: string;
  updatedAt: string;
};

export type DummyConversationLaneCapability = {
  visible: boolean;
  writable: boolean;
  reason?: string;
};

export type DummyConversationLaneCapabilities = Record<
  DummyConversationLane,
  DummyConversationLaneCapability
>;

export type DummyConversationView = {
  id: string;
  contactId: string;
  serviceId: string;
  serviceSlug: string;
  serviceTitle: string;
  customerDisplayName: string;
  clientAlias?: string;
  customerPhoneDisplay: string;
  businessPhoneDisplay?: string;
  customerProfileImageUrl?: string;
  sourceChannel?: DummyConversationSourceChannel;
  summary: string;
  status: DummyConversationStatus;
  leadStatusId: string;
  leadStatusLabel: string;
  leadStatusTone: DummyLeadStatusTone;
  assignedFreelancerName?: string;
  assignedFreelancerId?: string;
  freelancerCollaborators?: DummyConversationFreelancerCollaborator[];
  ownerName?: string;
  ownerRole?: "manager" | "admin" | "sales";
  visibleLanes: DummyConversationLane[];
  messages: DummyConversationMessage[];
  typing: DummyTypingState[];
  laneCounts: Record<DummyConversationLane, number>;
  unreadCount: number;
  unreadCountByLane: Record<DummyConversationLane, number>;
  readStateByAudience: Partial<Record<DummyConversationReadKey, string>>;
  latestMessageLane: DummyConversationLane;
  preferredLane: DummyConversationLane;
  internalNotes: string;
  nextFollowUpAt?: string | null;
  isInAppCustomerThread: boolean;
  lastCustomerActivityAt: string;
  tenantId?: string;
  updatedAt?: string;
  agencyContext?: DummyConversationAgencyContext;
  agencySummary?: DummyConversationAgencySummary;
  assignmentSummary: DummyConversationAssignmentSummary;
  assignmentOffers?: DummyConversationAssignmentOffer[];
  myAssignmentOffer?: DummyConversationAssignmentOffer;
  projectIntake?: DummyConversationProjectIntake;
  laneCapabilities: DummyConversationLaneCapabilities;
  freelancerCustomerLanePermission?: DummyFreelancerCustomerLanePermission;
  aiAutoReplyDisabled?: boolean;
  aiAutoReplyDisabledUpdatedAt?: string;
  aiAutoReplyDisabledByRole?: "closer" | "admin" | "manager" | "system";
  aiAutoReplyDisabledByName?: string;
  latestPaymentRequest?: DummyPaymentRequest;
  paymentRequests?: DummyPaymentRequest[];
  customerAccountType?: "AGENCY" | "FREELANCER" | "LEAD";
  customerPackageName?: string | null;
  customerPackageStatus?: string | null;
  customerPlanDaysRemaining?: number | null;
  customerAppInstalled?: boolean;
  leadPriority?: string | null;
  leadStage?: string | null;
};

export type DummyAssignableEditor = {
  id: string;
  name: string;
  specialties: string[];
  workloadBand: WorkloadBand;
  karmaScore: number;
  onlineStatus?: "online" | "offline";
  acceptingProjects?: boolean;
  lastOnlineAt?: string;
  isTeamMember?: boolean;
  offerEligible?: boolean;
  directAssignmentEligible?: boolean;
  verificationStatus?: string;
  startingPrice?: number | null;
  portfolioLinks?: string[];
  services?: Array<{
    id: string;
    slug: string;
    title: string;
    category?: string | null;
    price?: number | null;
    deliveryTime?: string | null;
  }>;
};

export type DummyConversationListResponse = {
  conversations: DummyConversationView[];
  assignableEditors: DummyAssignableEditor[];
  leadStatuses: DummyLeadStatus[];
  templates: DummyConversationTemplate[];
};

export type DummyWhatsAppConnectionState = {
  hasAccessToken?: boolean;
  hasAuthorizationCode?: boolean;
  tenantId: string;
  businessName: string;
  displayName: string;
  phoneNumber: string;
  manualOverrides: DummyWhatsAppManualOverrides;
  pluginEnabled: boolean;
  paymentsEnabled: boolean;
  paymentsGateway: DummyWhatsAppPaymentGateway;
  paymentsConfigurationName: string;
  paymentsTemplateName: string;
  subscriptionPaymentTemplateName: string;
  subscriptionPaymentTemplateLanguage: string;
  renewalReminderTemplateName: string;
  renewalReminderTemplateLanguage: string;
  otpTemplateName: string;
  otpTemplateLanguage: string;
  status: DummyWhatsAppStatus;
  note: string;
  metaAppId: string;
  metaConfigId: string;
  sessionInfoVersion: string;
  embeddedSignupVersion: string;
  verifyToken: string;
  publicBaseUrl: string;
  graphApiVersion: string;
  businessId: string;
  businessPortfolioId: string;
  wabaId: string;
  phoneNumberId: string;
  systemUserId: string;
  authorizationCode: string;
  accessToken: string;
  lastLaunchAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastError?: string;
  lastSignupEvent?: string;
  lastSignupEventAt?: string;
  launchChecklist: string[];
  onboardingUrl: string;
  updatedAt: string;
};

export type DummyInstagramConnectionState = {
  tenantId: string;
  pluginEnabled: boolean;
  status: DummyInstagramStatus;
  displayName: string;
  username: string;
  accountId?: string;
  accountType?: string;
  tokenType?: string;
  scopes?: string[];
  connectedAt?: string;
  expiresAt?: string;
  instagramBusinessAccountId: string;
  accessToken: string;
  verifyToken: string;
  graphApiVersion: string;
  note: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastError?: string;
  updatedAt: string;
};

export type DummyYouTubeConnectionState = {
  tenantId: string;
  status: DummyYouTubeStatus;
  channelName: string;
  channelId: string;
  channelHandle: string;
  defaultPrivacy: "private" | "unlisted" | "public";
  defaultPlaylistPrefix: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
  note: string;
  lastUploadAt?: string;
  lastPlaylistName?: string;
  lastError?: string;
  uploadChecklist: string[];
  updatedAt: string;
};

export type DummyYouTubeUploadRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  customerName: string;
  playlistName: string;
  title: string;
  fileName: string;
  mimeType: string;
  uploadedByRole: DummyConversationRole;
  uploadedByLabel: string;
  privacy: DummyYouTubeConnectionState["defaultPrivacy"];
  status: "Queued" | "Uploaded";
  shareUrl: string;
  createdAt: string;
};

export type DummyMessageAttachmentInput = {
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadTarget?: DummyAttachmentTarget;
  durationSeconds?: number;
  note?: string;
  externalUrl?: string;
};

export type DummyContactRecord = DummyContact & {
  phoneDisplay: string;
  latestStatusLabel: string;
  latestStatusTone: DummyLeadStatusTone;
  unreadCount: number;
  assignedUserName: string;
};

type UpsertServiceInput = {
  id?: string;
  ownerName?: string;
  ownerAlias?: string;
  title: string;
  sampleVideoUrl?: string;
  sampleVideoEmbedUrl?: string;
  summary: string;
  category: "Video Editing" | "Graphic Design";
  specialty: string;
  primaryEditorCategory?: string;
  secondaryEditorCategories?: string[];
  description: string;
  targetAudience: string;
  deliveryTime: string;
  revisions: string;
  basePrice: number;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  deliverables: string[];
  faq: DummyServiceFaq[];
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function getMetaOnboardingSeed() {
  try {
    const parsed = new URL(META_WHATSAPP_ONBOARDING_URL);
    const extras = JSON.parse(parsed.searchParams.get("extras") ?? "{}") as {
      sessionInfoVersion?: string | number;
      version?: string;
    };

    return {
      metaAppId: parsed.searchParams.get("app_id") ?? "",
      metaConfigId: parsed.searchParams.get("config_id") ?? "",
      sessionInfoVersion: String(extras.sessionInfoVersion ?? "3"),
      embeddedSignupVersion: String(extras.version ?? "v4"),
    };
  } catch {
    return {
      metaAppId: "",
      metaConfigId: "",
      sessionInfoVersion: "3",
      embeddedSignupVersion: "v4",
    };
  }
}

function normalizeMetaGraphVersion(value?: string) {
  const trimmed = value?.trim();
  return trimmed?.startsWith("v") ? trimmed : "v25.0";
}

function normalizeEmbeddedSignupVersion(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "v4";
  }

  const normalized = trimmed.toLowerCase();
  return normalized === "v4" ? "v4" : "v4";
}

function normalizeTemplateLanguageCode(value?: string) {
  const trimmed = value?.trim();
  return trimmed || "en_US";
}

function buildMetaWhatsAppOnboardingUrlFromSeed(input: {
  metaAppId?: string;
  metaConfigId?: string;
  sessionInfoVersion?: string;
  embeddedSignupVersion?: string;
}) {
  const url = new URL("https://business.facebook.com/messaging/whatsapp/onboard/");
  url.searchParams.set("app_id", input.metaAppId?.trim() || "");
  url.searchParams.set("config_id", input.metaConfigId?.trim() || "");
  url.searchParams.set(
    "extras",
    JSON.stringify({
      ...(DEFAULT_META_WHATSAPP_FEATURE_TYPE ? { featureType: DEFAULT_META_WHATSAPP_FEATURE_TYPE } : {}),
      sessionInfoVersion: input.sessionInfoVersion?.trim() || "3",
      version: normalizeEmbeddedSignupVersion(input.embeddedSignupVersion),
    }),
  );
  return url.toString();
}

function buildMetaWhatsAppOnboardingUrl(input: {
  metaAppId?: string;
  metaConfigId?: string;
  sessionInfoVersion?: string;
  embeddedSignupVersion?: string;
  publicBaseUrl?: string;
}) {
  const baseUrl = normalizePublicBaseUrl(input.publicBaseUrl);
  const url = new URL("https://business.facebook.com/messaging/whatsapp/onboard/");
  url.searchParams.set("app_id", input.metaAppId?.trim() || metaSeed.metaAppId);
  url.searchParams.set("config_id", input.metaConfigId?.trim() || metaSeed.metaConfigId);
  url.searchParams.set("display", "popup");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("override_default_response_type", "true");
  url.searchParams.set("redirect_uri", new URL("/meta/whatsapp/callback", baseUrl).toString());
  url.searchParams.set("fallback_redirect_uri", new URL("/meta/whatsapp/callback", baseUrl).toString());
  url.searchParams.set(
    "extras",
    JSON.stringify({
      ...(DEFAULT_META_WHATSAPP_FEATURE_TYPE ? { featureType: DEFAULT_META_WHATSAPP_FEATURE_TYPE } : {}),
      sessionInfoVersion: input.sessionInfoVersion?.trim() || "3",
      version: normalizeEmbeddedSignupVersion(input.embeddedSignupVersion),
    }),
  );
  return url.toString();
}

function formatCustomerAlias(index: number) {
  return `Client GX-${200 + index}`;
}

function roleLabel(role: DummyConversationRole) {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "freelancer") return "Editor";
  if (role === "sales") return "Sales";
  return "Customer";
}

const agencyResponseSlaByTenant: Record<string, string> = {
  "tenant-gigxomi": "18 min avg",
  "tenant-editors-hub": "24 min avg",
  "tenant-ppw": "42 min avg",
  "tenant-omni-flow": "21 min avg",
};

const agencyRepeatClientByTenant: Record<string, string> = {
  "tenant-gigxomi": "74% repeat clients",
  "tenant-editors-hub": "68% repeat clients",
  "tenant-ppw": "46% repeat clients",
  "tenant-omni-flow": "71% repeat clients",
};

function deriveAgencyTrustScore(tenantId: string) {
  const plan = agencyPlans.find((item) => item.agencyId === tenantId) ?? null;
  if (!plan) {
    return {
      score: 76,
      band: "Stable" as KarmaBand,
    };
  }

  const healthBase =
    plan.subscriptionHealth === "Healthy"
      ? 82
      : plan.subscriptionHealth === "Watchlist"
        ? 72
        : 66;
  const seatUtilization = Math.round((plan.activeSeats / Math.max(plan.seatLimit, 1)) * 10);
  const payoutTrust = Math.min(Math.round(plan.securedPayoutVolume / 50000), 8);
  const score = Math.min(95, healthBase + seatUtilization + payoutTrust);
  const band: KarmaBand = score >= 90 ? "Elite" : score >= 82 ? "Trusted" : score >= 70 ? "Stable" : "At Risk";

  return { score, band };
}

function buildConversationAgencyContext(conversation: DummyConversation): DummyConversationAgencyContext {
  const card = agencyDirectoryCards.find((item) => item.id === conversation.tenantId) ?? agencyDirectoryCards[0];
  const assignedEditorProfile =
    editorPerformanceProfiles.find((item) => item.id === conversation.assignedFreelancerId) ??
    editorPerformanceProfiles.find((item) => item.name === conversation.assignedFreelancerName) ??
    null;
  const membership =
    editorAgencyMemberships.find(
      (item) => item.agencyId === conversation.tenantId && item.editorId === (assignedEditorProfile?.id ?? conversation.assignedFreelancerId),
    ) ?? null;
  const trust = deriveAgencyTrustScore(conversation.tenantId);
  const plan = agencyPlans.find((item) => item.agencyId === conversation.tenantId) ?? null;
  const specialties = (card?.activeServices ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    tenantId: conversation.tenantId,
    agencyName: card?.name ?? "Agency workspace",
    agencySlug: card?.slug ?? conversation.tenantId,
    agencyProfilePath: `/agency/${card?.slug ?? conversation.tenantId}`,
    location: card?.location ?? "Remote",
    hiringStatus: card?.hiringStatus ?? "Selective hiring",
    specialties,
    trustScore: trust.score,
    trustBand: trust.band,
    membershipRole: membership?.role ?? "Assigned editor",
    membershipStatus: membership?.status ?? "Unknown",
    responseSlaLabel: agencyResponseSlaByTenant[conversation.tenantId] ?? "24 min avg",
    payoutTrustLabel: plan ? `INR ${plan.securedPayoutVolume.toLocaleString("en-IN")} secured` : "Payout proof syncing",
    repeatClientLabel: agencyRepeatClientByTenant[conversation.tenantId] ?? "Repeat-client proof syncing",
  };
}

function getDefaultManagerPermissions(overrides?: Partial<DummyManagerPermissionSet>): DummyManagerPermissionSet {
  return {
    chatInbox: true,
    assignedChats: true,
    quoteReview: true,
    deliveryReview: true,
    walletReview: true,
    escalations: true,
    allContacts: false,
    ...overrides,
  };
}

function getEditorPlanLabel(editorId?: string) {
  if (editorId === "editor-jayanta") {
    return "Subscription Monthly";
  }

  if (editorId === "editor-umagfx") {
    return "Subscription Quarterly";
  }

  return "Standard";
}

function buildRevenueSplit(editorId: string | undefined, grossAmount: number): DummyRevenueSplit {
  const planLabel = getEditorPlanLabel(editorId);
  const platformPercentage = planLabel === "Standard" ? 30 : 5;
  const editorPercentage = 100 - platformPercentage;
  const platformAmount = Math.round((grossAmount * platformPercentage) / 100);
  const editorAmount = Math.max(grossAmount - platformAmount, 0);

  return {
    planLabel,
    platformPercentage,
    editorPercentage,
    grossAmount,
    platformAmount,
    editorAmount,
  };
}

function buildAgencyFullRevenueSplit(grossAmount: number): DummyRevenueSplit {
  return {
    planLabel: "Agency direct",
    platformPercentage: 0,
    editorPercentage: 100,
    grossAmount,
    platformAmount: 0,
    editorAmount: grossAmount,
  };
}

function getLeadStatusOrFallback(statusId: string) {
  const exact = leadStatuses.find((status) => status.id === statusId);
  if (exact) return exact;

  // Live CRM rows can use the canonical IDs (`interested`, `closed-won`,
  // `new-leads`) while the older local status catalog uses aliases such as
  // `qualified`, `closed`, and `new`. Preserve the stored ID in the view so
  // a successful status update is visible immediately and the UI can submit
  // the same value back to the API.
  const aliases: Record<string, string> = {
    "new-leads": "new",
    interested: "qualified",
    "interested / qualified": "qualified",
    "training booked": "training-booked",
    "follow-up needed": "follow-up",
    "closed-won": "closed",
    "lost / recycled": "lost",
  };
  const aliased = leadStatuses.find((status) => status.id === aliases[statusId.toLowerCase()]);
  if (aliased) return { ...aliased, id: statusId };
  return leadStatuses[0] ?? { id: statusId || "new", label: "New", tone: "accent", order: 1, active: true };
}

function normalizeConversationSourceChannel(
  conversation: Pick<DummyConversation, "customerId" | "isInAppCustomerThread" | "serviceId" | "sourceChannel">,
): DummyConversationSourceChannel {
  if (conversation.sourceChannel === "instagram" || conversation.sourceChannel === "whatsapp" || conversation.sourceChannel === "in-app") {
    return conversation.sourceChannel;
  }

  if (conversation.serviceId === "svc-instagram-inbox" || conversation.customerId.startsWith("ig-")) {
    return "instagram";
  }

  return conversation.isInAppCustomerThread ? "in-app" : "whatsapp";
}

function normalizeInstagramScopedUserId(value?: string | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/^ig[-:_]/i, "").trim();
}

function getInstagramRecipientId(
  conversation: Pick<DummyConversation, "customerId" | "customerPhone" | "instagramScopedUserId" | "isInAppCustomerThread" | "serviceId" | "sourceChannel">,
) {
  if (normalizeConversationSourceChannel(conversation) !== "instagram") {
    return "";
  }

  return (
    normalizeInstagramScopedUserId(conversation.instagramScopedUserId) ||
    normalizeInstagramScopedUserId(conversation.customerId) ||
    normalizeInstagramScopedUserId(conversation.customerPhone)
  );
}

function getCustomerLaneTransportState(
  conversation: Pick<
    DummyConversation,
    "customerId" | "customerPhone" | "instagramScopedUserId" | "isInAppCustomerThread" | "serviceId" | "sourceChannel" | "tenantId"
  >,
) {
  const sourceChannel = normalizeConversationSourceChannel(conversation);
  if (sourceChannel === "instagram") {
    const connection = getInstagramConnectionState(conversation.tenantId);
    if (connection?.pluginEnabled && connection.accessToken.trim() && connection.instagramBusinessAccountId.trim() && getInstagramRecipientId(conversation)) {
      return {
        state: "ready" as const,
        note: "Replies are routed through Instagram Messaging for this thread.",
      };
    }

    if (process.env.NODE_ENV !== "production") {
      return {
        state: "demo" as const,
        note: "Instagram reply preview is active locally. Add Instagram token and recipient IDs for live delivery.",
      };
    }

    return {
      state: "blocked" as const,
      note: "Instagram delivery is not active for this agency yet. Enable and authenticate the Instagram plugin first.",
    };
  }

  if (conversation.isInAppCustomerThread) {
    return {
      state: "ready" as const,
      note: "Replies stay inside the native Gigxomi customer relay for this thread.",
    };
  }

  const connection = getWhatsAppConnectionState(conversation.tenantId);
  if (connection?.phoneNumberId.trim() && connection.accessToken.trim()) {
    return {
      state: "ready" as const,
      note: "Replies are routed through the agency customer lane while phone visibility stays masked separately.",
    };
  }

  if (process.env.NODE_ENV !== "production") {
    return {
      state: "demo" as const,
      note: "Local relay demo is active here. Live customer delivery still needs tenant WhatsApp setup.",
    };
  }

  return {
    state: "blocked" as const,
    note: "Customer delivery relay is not active for this agency yet.",
  };
}

function canAssignEditorToTenant(editorId: string, tenantId?: string) {
  const normalizedTenantId = tenantId?.trim();
  if (!normalizedTenantId) {
    return true;
  }

  return editorAgencyMemberships.some(
    (membership) =>
      membership.editorId === editorId &&
      membership.agencyId === normalizedTenantId &&
      membership.status === "Active",
  );
}

function formatWhatsAppCustomerLaneBody(_role: DummyConversationRole, body: string, _senderLabel?: string) {
  void _role;
  void _senderLabel;
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    return trimmedBody;
  }

  return trimmedBody;
}

function buildWhatsAppOutboundTextForCustomerLane(
  role: DummyConversationRole,
  body: string,
  senderLabel?: string,
) {
  return formatWhatsAppCustomerLaneBody(role, body, senderLabel).trim();
}

function getDefaultPublicBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://gigxomi.com";
}

function normalizePublicBaseUrl(value?: string) {
  const raw = value?.trim() || getDefaultPublicBaseUrl();
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.endsWith("/api/meta/whatsapp/webhook")) {
      return parsed.origin;
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return raw.replace(/\/api\/meta\/whatsapp\/webhook\/?$/, "").replace(/\/$/, "");
  }
}

export function getWhatsAppWebhookUrl(connection?: Pick<DummyWhatsAppConnectionState, "publicBaseUrl"> | null) {
  const baseUrl = normalizePublicBaseUrl(connection?.publicBaseUrl);
  return `${baseUrl.replace(/\/$/, "")}/api/whatsapp-marketing/webhook`;
}

export function getInstagramWebhookUrl() {
  return `${normalizePublicBaseUrl().replace(/\/$/, "")}/api/meta/instagram/webhook`;
}

function normalizeWhatsAppManualOverrides(
  overrides?: Partial<Record<DummyWhatsAppManualOverrideKey, boolean>> | null,
): DummyWhatsAppManualOverrides {
  return DUMMY_WHATSAPP_MANUAL_OVERRIDE_KEYS.reduce<DummyWhatsAppManualOverrides>(
    (accumulator, key) => {
      accumulator[key] = Boolean(overrides?.[key]);
      return accumulator;
    },
    {
      phoneNumber: false,
      phoneNumberId: false,
      wabaId: false,
      businessPortfolioId: false,
      businessId: false,
      displayName: false,
      businessName: false,
      systemUserId: false,
    },
  );
}

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

function buildDefaultWhatsAppVerifyToken(tenantId: string) {
  const suffix = slugify(tenantId || "tenant") || "tenant";
  return `gigxomi-${suffix}-verify-token`;
}

function buildDefaultInstagramVerifyToken(tenantId: string) {
  const suffix = slugify(tenantId || "tenant") || "tenant";
  return `gigxomi-${suffix}-instagram-verify-token`;
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);
  if (!digits) {
    return value.trim();
  }
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function maskPhoneForAudience(value: string, audience: "admin" | "manager" | "freelancer", options?: { masked?: boolean }) {
  if (audience === "admin") {
    return value;
  }

  if (options?.masked === false) {
    return value;
  }

  const trimmed = value.trim();
  const digits = normalizePhone(trimmed);
  if (!digits) {
    return trimmed;
  }

  if (digits.length <= 4) {
    return `${"*".repeat(Math.max(digits.length - 1, 1))}${digits.slice(-1)}`;
  }

  const visiblePrefixLength = Math.min(2, Math.max(digits.length - 4, 1));
  const prefix = digits.slice(0, visiblePrefixLength);
  const suffix = digits.slice(-4);
  const maskedCount = Math.max(digits.length - visiblePrefixLength - suffix.length, 2);
  const separator = digits.length > 8 ? " " : "";

  return `${trimmed.startsWith("+") ? "+" : ""}${prefix}${separator}${"â€¢".repeat(maskedCount)}${separator}${suffix}`;
}

function createDefaultCustomerPrivacySettings(tenantId = "tenant-gigxomi"): DummyCustomerPrivacySettings {
  return {
    tenantId,
    maskCustomerPhoneForManagers: true,
    maskCustomerPhoneForFreelancers: true,
    updatedAt: nowIso(),
  };
}

function formatBytes(sizeBytes?: number) {
  if (!sizeBytes || Number.isNaN(sizeBytes) || sizeBytes <= 0) {
    return "Local file";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = sizeBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = value >= 100 || unitIndex === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}

function formatDurationLabel(durationSeconds?: number) {
  if (!durationSeconds || durationSeconds <= 0) {
    return "Voice note";
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return minutes ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

function buildWhatsAppChecklist(
  state: Pick<
    DummyWhatsAppConnectionState,
    "displayName" | "status" | "businessPortfolioId" | "wabaId" | "phoneNumberId" | "lastLaunchAt" | "verifyToken" | "publicBaseUrl"
  >,
) {
  const checklist = ["Business details saved"];

  if (state.displayName.trim()) {
    checklist.push("Display name captured");
  }

  if (state.lastLaunchAt) {
    checklist.push("Meta onboarding link opened");
  }

  if (state.verifyToken.trim()) {
    checklist.push("Verify token ready for Meta webhook");
  }

  if (state.publicBaseUrl.trim()) {
    checklist.push("Public callback base URL captured");
  }

  if (state.businessPortfolioId.trim()) {
    checklist.push("Business portfolio ID captured");
  }

  if (state.wabaId.trim()) {
    checklist.push("WhatsApp Business Account ID captured");
  }

  if (state.phoneNumberId.trim()) {
    checklist.push("Phone number ID captured");
  }

  if (state.status === "Ready for webhook") {
    checklist.push("Ready for webhook handoff");
  } else {
    checklist.push("Webhook pending until Cloud API line details are captured");
  }

  return checklist;
}

function normalizeWhatsAppConnectionStatus(input: {
  status: DummyWhatsAppStatus;
  phoneNumberId?: string | null;
  wabaId?: string | null;
  businessId?: string | null;
  businessPortfolioId?: string | null;
}): DummyWhatsAppStatus {
  if (input.status !== "Ready for webhook") {
    return input.status;
  }

  if (String(input.phoneNumberId ?? "").trim()) {
    return "Ready for webhook";
  }

  if (String(input.wabaId ?? "").trim()) {
    return "Number connected";
  }

  if (String(input.businessId ?? "").trim() || String(input.businessPortfolioId ?? "").trim()) {
    return "Business submitted";
  }

  return "Onboarding in progress";
}

function buildYouTubeChecklist(
  state: Pick<
    DummyYouTubeConnectionState,
    "channelName" | "channelId" | "channelHandle" | "clientId" | "refreshToken" | "status" | "defaultPlaylistPrefix"
  >,
) {
  const checklist = ["Agency delivery mapping saved"];

  if (state.channelName.trim()) {
    checklist.push("Channel name captured");
  }

  if (state.channelId.trim()) {
    checklist.push("Channel ID captured");
  }

  if (state.channelHandle.trim()) {
    checklist.push("Channel handle captured");
  }

  if (state.clientId.trim()) {
    checklist.push("OAuth client ID stored");
  }

  if (state.refreshToken.trim()) {
    checklist.push("Refresh token stored");
  }

  if (state.defaultPlaylistPrefix.trim()) {
    checklist.push("Client playlist prefix ready");
  }

  if (state.status === "Upload ready") {
    checklist.push("Ready for routed client uploads");
  } else {
    checklist.push("Uploads stay in dummy mode until channel setup is ready");
  }

  return checklist;
}

const metaSeed = getMetaOnboardingSeed();

function createMedia(seed: string, input?: { sampleVideoUrl?: string; sampleVideoEmbedUrl?: string }): DummyServiceMedia[] {
  const hasVideo = Boolean(input?.sampleVideoUrl?.trim());
  return [
    {
      id: `${seed}-cover`,
      kind: hasVideo ? "video" : "image",
      title: hasVideo ? "Sample showcase" : "Main showcase",
      accent: "linear-gradient(135deg, rgba(10, 13, 11, 0.95), rgba(20, 25, 17, 0.85))",
      sourceUrl: input?.sampleVideoUrl?.trim() || undefined,
      embedUrl: input?.sampleVideoEmbedUrl?.trim() || undefined,
    },
    { id: `${seed}-detail`, kind: "image", title: "Delivery style", accent: "linear-gradient(135deg, rgba(30, 64, 175, 0.8), rgba(59, 130, 246, 0.55))" },
    { id: `${seed}-note`, kind: "image", title: "Client fit", accent: "linear-gradient(135deg, rgba(6, 78, 59, 0.9), rgba(16, 185, 129, 0.55))" },
  ];
}

function createSeedService(seed: {
  id: string;
  ownerId: string;
  title: string;
  summary: string;
  category: "Video Editing" | "Graphic Design";
  specialty: string;
  description: string;
  targetAudience: string;
  deliveryTime: string;
  revisions: string;
  basePrice: number;
  tags: string[];
  status: DummyServiceStatus;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  deliverables: string[];
  faq: DummyServiceFaq[];
  reviewNote?: string;
}) {
  const owner = editorPerformanceProfiles.find((editor) => editor.id === seed.ownerId) ?? editorPerformanceProfiles[0];
  const timestamp = nowIso();

  return {
    id: seed.id,
    slug: slugify(seed.title),
    ownerId: owner.id,
    ownerName: owner.name,
    ownerAlias: owner.publicAlias,
    title: seed.title,
    summary: seed.summary,
    category: seed.category,
    specialty: seed.specialty,
    description: seed.description,
    targetAudience: seed.targetAudience,
    deliveryTime: seed.deliveryTime,
    revisions: seed.revisions,
    basePrice: seed.basePrice,
    currency: "INR",
    tags: seed.tags,
    seoTitle: seed.seoTitle,
    seoDescription: seed.seoDescription,
    seoKeywords: seed.seoKeywords,
    deliverables: seed.deliverables,
    faq: seed.faq,
    media: createMedia(seed.id),
    status: seed.status,
    reviewNote: seed.reviewNote,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies DummyService;
}

export type DummyPlatformSnapshot = {
  services: DummyService[];
  conversations: DummyConversation[];
  whatsappStates: DummyWhatsAppConnectionState[];
  instagramStates: DummyInstagramConnectionState[];
  youtubeStates: DummyYouTubeConnectionState[];
  youtubeUploads: DummyYouTubeUploadRecord[];
  leadStatuses: DummyLeadStatus[];
  conversationTemplates: DummyConversationTemplate[];
  contacts: DummyContact[];
  managers: DummyManagerAccount[];
  upiConfigs: DummyUpiConfig[];
  customerPrivacySettings: DummyCustomerPrivacySettings[];
  walletCredits: DummyWalletCredit[];
  customerReviews: DummyCustomerReview[];
  editorAvailability: DummyEditorAvailability[];
};

declare global {
  var __gigxomiDummyStore: DummyPlatformSnapshot | undefined;
}

const dummyPlatformMemory: DummyPlatformSnapshot = {
  services: globalThis.__gigxomiDummyStore?.services ?? [],
  conversations: globalThis.__gigxomiDummyStore?.conversations ?? [],
  whatsappStates: globalThis.__gigxomiDummyStore?.whatsappStates ?? [],
  instagramStates: globalThis.__gigxomiDummyStore?.instagramStates ?? [],
  youtubeStates: globalThis.__gigxomiDummyStore?.youtubeStates ?? [],
  youtubeUploads: globalThis.__gigxomiDummyStore?.youtubeUploads ?? [],
  leadStatuses: globalThis.__gigxomiDummyStore?.leadStatuses ?? [],
  conversationTemplates: globalThis.__gigxomiDummyStore?.conversationTemplates ?? [],
  contacts: globalThis.__gigxomiDummyStore?.contacts ?? [],
  managers: globalThis.__gigxomiDummyStore?.managers ?? [],
  upiConfigs: globalThis.__gigxomiDummyStore?.upiConfigs ?? [],
  customerPrivacySettings: globalThis.__gigxomiDummyStore?.customerPrivacySettings ?? [],
  walletCredits: globalThis.__gigxomiDummyStore?.walletCredits ?? [],
  customerReviews: globalThis.__gigxomiDummyStore?.customerReviews ?? [],
  editorAvailability: globalThis.__gigxomiDummyStore?.editorAvailability ?? [],
};

globalThis.__gigxomiDummyStore = dummyPlatformMemory;

let services = dummyPlatformMemory.services;
let conversations = dummyPlatformMemory.conversations;
let whatsappStates = dummyPlatformMemory.whatsappStates;
let instagramStates = dummyPlatformMemory.instagramStates;
let youtubeStates = dummyPlatformMemory.youtubeStates;
let youtubeUploads = dummyPlatformMemory.youtubeUploads;
let leadStatuses = dummyPlatformMemory.leadStatuses;
let conversationTemplates = dummyPlatformMemory.conversationTemplates;
let contacts = dummyPlatformMemory.contacts;
let managers = dummyPlatformMemory.managers;
let upiConfigs = dummyPlatformMemory.upiConfigs;
let customerPrivacySettings = dummyPlatformMemory.customerPrivacySettings;
let walletCredits = dummyPlatformMemory.walletCredits;
let customerReviews = dummyPlatformMemory.customerReviews;
let editorAvailability = dummyPlatformMemory.editorAvailability;

if (!dummyPlatformMemory.services.length) {
  dummyPlatformMemory.services = [
  createSeedService({
    id: "svc-public-coach",
    ownerId: "editor-testingfreelancer",
    title: "Short-form content editor for coaches and YouTube channels",
    summary: "Weekly shorts, repurposed clips, hooks, captions, and CTA-safe edits for creator funnels.",
    category: "Video Editing",
    specialty: "Short-form creator growth",
    description:
      "This service is built for coaches, consultants, and personal brands that need fast-moving short-form edits without losing a premium feel. The workflow is optimized for weekly content batches, subtitle clarity, and retention-first hooks.",
    targetAudience: "Coaches, consultants, and education-led personal brands.",
    deliveryTime: "2 Days",
    revisions: "2 revisions included",
    basePrice: 2200,
    tags: ["coaches", "youtube", "short-form", "retainers"],
    status: "Approved",
    seoTitle: "Short-form editor for coaches and YouTube channels | Gigxomi",
    seoDescription: "Hire a short-form editor for weekly coach content, YouTube clips, and repurposed creator reels.",
    seoKeywords: ["short-form editor", "coach video editor", "YouTube shorts editor"],
    deliverables: ["9:16 vertical export", "Hook-first edit pacing", "Burned subtitles", "CTA-safe ending variants"],
    faq: [
      { question: "Can you handle weekly retainers?", answer: "Yes. This service is structured for repeat weekly batches and recurring content calendars." },
      { question: "Do you include subtitles?", answer: "Yes. Simple clean subtitles are included in the base package." },
    ],
  }),
  createSeedService({
    id: "svc-public-wedding",
    ownerId: "editor-testingfreelancer",
    title: "Wedding teaser editor for cinematic highlights and reels",
    summary: "Emotion-first teaser cuts, music-led pacing, and polished highlight reels for premium wedding teams.",
    category: "Video Editing",
    specialty: "Wedding editing",
    description:
      "Built for wedding filmmakers who need fast teaser turnarounds without losing the cinematic polish. The service focuses on emotional pacing, shot sequencing, and platform-ready highlight delivery.",
    targetAudience: "Wedding studios, filmmakers, and seasonal event agencies.",
    deliveryTime: "3 Days",
    revisions: "2 revisions included",
    basePrice: 4500,
    tags: ["wedding", "teaser", "cinematic", "reels"],
    status: "Approved",
    seoTitle: "Wedding teaser editor for cinematic highlight reels | Gigxomi",
    seoDescription: "Book a wedding teaser editor for emotional highlight reels, fast turnarounds, and cinematic pacing.",
    seoKeywords: ["wedding teaser editor", "cinematic wedding reel", "highlight reel editor"],
    deliverables: ["Teaser cut", "Short highlight version", "Platform-safe export", "Color-safe music sync"],
    faq: [
      { question: "Can you deliver same-week teasers?", answer: "Yes, depending on footage size and urgency. Rush delivery can be discussed before start." },
      { question: "Do you work with music-led edits?", answer: "Yes. Music-led pacing is a core part of this service style." },
    ],
  }),
  createSeedService({
    id: "svc-public-thumbnail",
    ownerId: "editor-umagfx",
    title: "Thumbnail and poster design pack for creators and finance channels",
    summary: "CTR-focused thumbnails, title-safe layouts, and creator-friendly poster systems.",
    category: "Graphic Design",
    specialty: "Thumbnail systems",
    description:
      "Designed for creator brands and finance channels that need cleaner click-through visuals. The service prioritizes readability, hierarchy, and repeatable thumbnail systems over one-off random graphics.",
    targetAudience: "Creator channels, finance educators, and teams running repeated content batches.",
    deliveryTime: "1 Day",
    revisions: "3 revisions included",
    basePrice: 1800,
    tags: ["thumbnails", "posters", "design", "finance"],
    status: "Approved",
    seoTitle: "Thumbnail and poster design pack for creators | Gigxomi",
    seoDescription: "Get CTR-focused thumbnails and poster design for creators, finance channels, and content teams.",
    seoKeywords: ["thumbnail designer", "youtube thumbnail design", "creator poster design"],
    deliverables: ["Thumbnail set", "Poster variations", "Editable source-ready layout rules", "Batch design consistency"],
    faq: [
      { question: "Is source editing included?", answer: "Base delivery focuses on final exports, but editable layering guidance is included in the package notes." },
      { question: "Can this match channel branding?", answer: "Yes. Existing brand references can be folded into the layout system." },
    ],
  }),
  createSeedService({
    id: "svc-public-podcast",
    ownerId: "editor-jayanta",
    title: "Podcast editor for weekly YouTube long-form and webinar clips",
    summary: "Long-form polish, talking-head pacing, audio cleanup, and webinar repurposing built for repeat schedules.",
    category: "Video Editing",
    specialty: "Podcast editing",
    description:
      "This service supports repeat podcast and webinar content that needs a reliable long-form editor. It focuses on pacing, silence cleanup, subtitle timing, and content repurposing for recurring weekly output.",
    targetAudience: "Podcasters, webinar operators, and long-form education brands.",
    deliveryTime: "4 Days",
    revisions: "2 revisions included",
    basePrice: 5200,
    tags: ["podcast", "long-form", "webinar", "youtube"],
    status: "Approved",
    seoTitle: "Podcast editor for YouTube long-form and webinars | Gigxomi",
    seoDescription: "Hire a long-form podcast editor for YouTube episodes, webinar clips, pacing cleanup, and recurring weekly delivery.",
    seoKeywords: ["podcast editor", "YouTube long-form editor", "webinar editor"],
    deliverables: ["Long-form episode export", "Audio cleanup pass", "Subtitle-safe timings", "Clip-ready chapter suggestions"],
    faq: [
      { question: "Can you handle weekly episodes?", answer: "Yes. Weekly recurring schedules are the main fit for this service." },
      { question: "Do you repurpose clips too?", answer: "Repurposing can be scoped as an add-on or retained as a batch workflow." },
    ],
  }),
  createSeedService({
    id: "svc-pending-custom",
    ownerId: "editor-testingfreelancer",
    title: "Long-form YouTube editor for finance explainers",
    summary: "Narrative pacing, B-roll layering, subtitle consistency, and weekly delivery for finance creators.",
    category: "Video Editing",
    specialty: "Long-form YouTube",
    description:
      "A repeatable long-form service for education and finance creators who need disciplined pacing, clean structure, and stable delivery windows.",
    targetAudience: "Finance channels and educational creator teams.",
    deliveryTime: "3 Days",
    revisions: "2 revisions included",
    basePrice: 4800,
    tags: ["finance", "youtube", "long-form", "education"],
    status: "Pending Review",
    seoTitle: "Long-form finance YouTube editor | Gigxomi",
    seoDescription: "Long-form editing for finance explainers, education content, and weekly creator uploads.",
    seoKeywords: ["finance video editor", "long-form youtube editor", "education content editor"],
    deliverables: ["Long-form edit", "Structure cleanup", "Subtitle flow", "Platform-ready export"],
    faq: [
      { question: "Can you keep finance content clean and trustworthy?", answer: "Yes. The pacing is built to stay readable and trustworthy rather than over-edited." },
      { question: "Do you support weekly workflows?", answer: "Yes. Repeat weekly uploads are a core use case." },
    ],
    reviewNote: "Pending manager review before public publishing.",
  }),
  createSeedService({
    id: "svc-draft-creator",
    ownerId: "editor-testingfreelancer",
    title: "Creator channel intro and outro motion kit",
    summary: "A draft listing for reusable intro/outro motion packaging.",
    category: "Graphic Design",
    specialty: "Motion design packaging",
    description:
      "Draft service for creator-facing intros, outros, and identity bumpers with simple motion systems and repeatable brand cues.",
    targetAudience: "Creator channels wanting reusable identity motion assets.",
    deliveryTime: "2 Days",
    revisions: "1 revision included",
    basePrice: 2500,
    tags: ["motion", "branding", "creator", "package"],
    status: "Draft",
    seoTitle: "Creator intro and outro motion kit | Gigxomi",
    seoDescription: "Motion design kit for creator intros, outros, and reusable identity packaging.",
    seoKeywords: ["intro outro motion design", "creator motion kit", "channel branding animation"],
    deliverables: ["Intro animation", "Outro animation", "Usage notes", "Branding-safe export variants"],
    faq: [
      { question: "Is this ready for publish?", answer: "Not yet. This listing is still a draft." },
      { question: "Can it be customized?", answer: "Yes. Branding and motion style can be tailored before submission." },
    ],
  }),
  ];
}

services = dummyPlatformMemory.services;

if (!dummyPlatformMemory.leadStatuses.length || dummyPlatformMemory.leadStatuses.some((s) => s.id === "for-review" || s.id === "delivered" || s.label?.includes("Editor Assigned"))) {
  dummyPlatformMemory.leadStatuses = crmStatuses.map((status) => ({
    id: status.id,
    label: status.label,
    tone: status.tone,
    order: status.order,
    active: status.active,
  }));
}

leadStatuses = dummyPlatformMemory.leadStatuses;

if (!dummyPlatformMemory.conversationTemplates.length) {
  dummyPlatformMemory.conversationTemplates = crmTemplates.map((template) => ({
    id: template.id,
    title: template.title,
    category: template.category,
    content: template.content,
  }));
}

conversationTemplates = dummyPlatformMemory.conversationTemplates;

if (!dummyPlatformMemory.contacts.length) {
  dummyPlatformMemory.contacts = crmContacts.map((contact) => ({
    id: contact.id,
    tenantId: "tenant-gigxomi",
    customerId: contact.id.replace("contact-", "customer-"),
    name: contact.name,
    phone: contact.phone,
    tags: contact.tags,
    notes: contact.notes,
    currentService: contact.currentService,
    latestStatusId: contact.latestStatusId,
    assignedUserId: contact.assignedUserId,
    lastActivity: contact.lastActivity,
  }));
}

contacts = dummyPlatformMemory.contacts;

if (!dummyPlatformMemory.managers.length) {
  dummyPlatformMemory.managers = [
    {
      id: "manager-rahul",
      tenantId: "tenant-gigxomi",
      name: "Rahul Manager",
      email: "rahul@gigxomi.local",
      queue: "Inbound and assignments",
      active: true,
      permissions: getDefaultManagerPermissions({ allContacts: true }),
    },
    {
      id: "manager-shweta",
      tenantId: "tenant-gigxomi",
      name: "Shweta Ops",
      email: "shweta@gigxomi.local",
      queue: "Follow-ups and delivery nudges",
      active: true,
      permissions: getDefaultManagerPermissions(),
    },
  ];
}

managers = dummyPlatformMemory.managers;

if (!dummyPlatformMemory.upiConfigs.length) {
  dummyPlatformMemory.upiConfigs = [
    {
      tenantId: "tenant-gigxomi",
      enabled: true,
      upiId: "7974063067@ybl",
      payeeName: "Gigxomi Studio",
      currency: "INR",
      notePrefix: "Gigxomi project",
      updatedAt: nowIso(),
    },
  ];
}

upiConfigs = dummyPlatformMemory.upiConfigs;

if (!dummyPlatformMemory.walletCredits.length) {
  dummyPlatformMemory.walletCredits = [];
}

walletCredits = dummyPlatformMemory.walletCredits;

if (!dummyPlatformMemory.customerReviews.length) {
  dummyPlatformMemory.customerReviews = [];
}

customerReviews = dummyPlatformMemory.customerReviews;

if (!dummyPlatformMemory.editorAvailability.length) {
  dummyPlatformMemory.editorAvailability = [];
}

editorAvailability = dummyPlatformMemory.editorAvailability;

if (!dummyPlatformMemory.conversations.length) {
  dummyPlatformMemory.conversations = [
  {
    id: "conv-finance",
    contactId: "contact-rahul",
    serviceId: "svc-public-coach",
    serviceSlug: "short-form-content-editor-for-coaches-and-youtube-channels",
    serviceTitle: "Short-form content editor for coaches and YouTube channels",
    customerId: "customer-finance",
    customerName: "Finance With Rahul",
    customerPhone: "+91 99881 12233",
    maskedCustomerName: formatCustomerAlias(4),
    tenantId: "tenant-gigxomi",
    status: "Assigned",
    leadStatusId: "assigned",
    summary: "Monthly retainer conversation with budget discussion still active.",
    internalNotes: "Keep quote under INR 5,000 unless the client explicitly asks for extra thumbnail support.",
    assignedFreelancerId: "editor-testingfreelancer",
    assignedFreelancerName: "Testing Freelancer",
    ownerRole: "manager",
    ownerName: "Rahul Manager",
    readStateByAudience: {
      admin: "2026-03-10T04:48:00.000Z",
      manager: "2026-03-10T04:48:00.000Z",
      freelancer: "2026-03-10T04:55:00.000Z",
      customer: "2026-03-10T04:42:00.000Z",
    },
    lastCustomerActivityAt: "2026-03-10T04:42:00.000Z",
    isInAppCustomerThread: false,
    latestPaymentRequestId: undefined,
    paymentRequests: [],
    messages: [
      {
        id: "msg-finance-1",
        lane: "customer",
        senderRole: "customer",
        senderLabel: "Finance With Rahul",
        body: "Hi, I want help with my weekly YouTube clips and short-form repurposing.",
        createdAt: "2026-03-10T04:42:00.000Z",
      },
      {
        id: "msg-finance-2",
        lane: "internal",
        senderRole: "manager",
        senderLabel: "Rahul Manager",
        body: "Client is price-sensitive. Keep the first quote under INR 5,000 unless add-ons are truly needed.",
        createdAt: "2026-03-10T04:48:00.000Z",
      },
      {
        id: "msg-finance-3",
        lane: "customer",
        senderRole: "freelancer",
        senderLabel: "Testing Freelancer",
        body: "I can support two urgent uploads per week if we keep the first batch scope tight.",
        createdAt: "2026-03-10T04:55:00.000Z",
      },
    ],
    typing: [],
    createdAt: "2026-03-10T04:42:00.000Z",
    updatedAt: "2026-03-10T04:55:00.000Z",
  },
  {
    id: "conv-riya",
    contactId: "contact-riya",
    serviceId: "svc-public-wedding",
    serviceSlug: "wedding-teaser-editor-for-cinematic-highlights-and-reels",
    serviceTitle: "Wedding teaser editor for cinematic highlights and reels",
    customerId: "customer-riya",
    customerName: "Riya Sharma",
    customerPhone: "+91 88771 00881",
    maskedCustomerName: formatCustomerAlias(1),
    tenantId: "tenant-gigxomi",
    status: "Manager Review",
    leadStatusId: "new",
    summary: "Wedding teaser inquiry needs shortlist and pricing.",
    internalNotes: "Needs wedding specialist shortlist plus first quote draft before weekend.",
    ownerRole: "admin",
    ownerName: "Gigxomi Studio",
    readStateByAudience: {
      admin: "2026-03-10T07:14:00.000Z",
      manager: "2026-03-10T07:10:00.000Z",
    },
    lastCustomerActivityAt: "2026-03-10T07:10:00.000Z",
    isInAppCustomerThread: false,
    latestPaymentRequestId: undefined,
    paymentRequests: [],
    messages: [
      {
        id: "msg-riya-1",
        lane: "customer",
        senderRole: "customer",
        senderLabel: "Riya Sharma",
        body: "I want a wedding teaser with a cinematic feel and delivery in 3 days.",
        createdAt: "2026-03-10T07:10:00.000Z",
      },
      {
        id: "msg-riya-2",
        lane: "internal",
        senderRole: "admin",
        senderLabel: "Gigxomi Studio",
        body: "Keep this in the queue until we confirm the best wedding editor for the teaser package.",
        createdAt: "2026-03-10T07:14:00.000Z",
      },
    ],
    typing: [],
    createdAt: "2026-03-10T07:10:00.000Z",
    updatedAt: "2026-03-10T07:14:00.000Z",
  },
  ];
}

conversations = dummyPlatformMemory.conversations;
conversations = conversations.map((conversation, index) => normalizeConversation(conversation, index));
dummyPlatformMemory.conversations = conversations;

if (!dummyPlatformMemory.whatsappStates.length) {
  dummyPlatformMemory.whatsappStates = [
  {
    tenantId: "tenant-gigxomi",
    businessName: "Gigxomi Studio",
    displayName: "Gigxomi Studio",
    phoneNumber: agencyDirectoryCards[0]?.whatsappNumber ?? "+91 99933 28124",
    manualOverrides: normalizeWhatsAppManualOverrides(),
    pluginEnabled: false,
    paymentsEnabled: false,
    paymentsGateway: "payu",
    paymentsConfigurationName: "",
    paymentsTemplateName: "gigxomi_order_details",
    subscriptionPaymentTemplateName: "",
    subscriptionPaymentTemplateLanguage: "en_US",
    renewalReminderTemplateName: "",
    renewalReminderTemplateLanguage: "en_US",
    otpTemplateName: "",
    otpTemplateLanguage: "en_US",
    status: "Business submitted",
    note: "Meta onboarding has started. Number validation is pending before webhook work begins.",
    metaAppId: metaSeed.metaAppId,
    metaConfigId: metaSeed.metaConfigId,
    sessionInfoVersion: metaSeed.sessionInfoVersion,
    embeddedSignupVersion: metaSeed.embeddedSignupVersion,
    verifyToken: "gigxomi-local-verify-token",
    publicBaseUrl: getDefaultPublicBaseUrl(),
    graphApiVersion: "v25.0",
    businessId: "",
    businessPortfolioId: "",
    wabaId: "",
    phoneNumberId: "",
    systemUserId: "",
    authorizationCode: "",
    accessToken: "",
    lastLaunchAt: nowIso(),
    lastInboundAt: "",
    lastOutboundAt: "",
    lastError: "",
    lastSignupEvent: "",
    lastSignupEventAt: "",
    launchChecklist: buildWhatsAppChecklist({
      displayName: "Gigxomi Studio",
      status: "Business submitted",
      businessPortfolioId: "",
      wabaId: "",
      phoneNumberId: "",
      lastLaunchAt: nowIso(),
      verifyToken: "gigxomi-local-verify-token",
      publicBaseUrl: getDefaultPublicBaseUrl(),
    }),
    onboardingUrl: META_WHATSAPP_ONBOARDING_URL,
    updatedAt: nowIso(),
  },
  ];
}

whatsappStates = dummyPlatformMemory.whatsappStates;

if (!dummyPlatformMemory.instagramStates.length) {
  dummyPlatformMemory.instagramStates = [];
}

instagramStates = dummyPlatformMemory.instagramStates;

if (!dummyPlatformMemory.youtubeStates.length) {
  dummyPlatformMemory.youtubeStates = [
    {
      tenantId: "tenant-gigxomi",
      status: "Channel mapped",
      channelName: "Gigxomi Studio Delivery",
      channelId: "UCgigxomi-studio-delivery",
      channelHandle: "@gigxomistudio",
      defaultPrivacy: "unlisted",
      defaultPlaylistPrefix: "Client Delivery",
      clientId: "",
      clientSecret: "",
      refreshToken: "",
      accessToken: "",
      note: "Map the agency channel here. Once the channel is marked upload ready, chat uploads can create per-client YouTube delivery playlists.",
      lastUploadAt: "",
      lastPlaylistName: "",
      lastError: "",
      uploadChecklist: buildYouTubeChecklist({
        channelName: "Gigxomi Studio Delivery",
        channelId: "UCgigxomi-studio-delivery",
        channelHandle: "@gigxomistudio",
        clientId: "",
        refreshToken: "",
        status: "Channel mapped",
        defaultPlaylistPrefix: "Client Delivery",
      }),
      updatedAt: nowIso(),
    },
  ];
}

youtubeStates = dummyPlatformMemory.youtubeStates;

if (!dummyPlatformMemory.youtubeUploads.length) {
  dummyPlatformMemory.youtubeUploads = [];
}

youtubeUploads = dummyPlatformMemory.youtubeUploads;

function cleanupTyping(list: DummyTypingState[]) {
  const now = Date.now();
  return list.filter((entry) => now - new Date(entry.updatedAt).getTime() < 6000 && entry.active);
}

function getServiceOwner(ownerId: string) {
  return editorPerformanceProfiles.find((editor) => editor.id === ownerId) ?? editorPerformanceProfiles[0];
}

function enrichPublicService(service: DummyService): DummyPublicServiceCard {
  const signals = getPublicServiceSignals(`${service.ownerName} ${service.title}`);
  return {
    ...service,
    trustBand: signals.trust,
    workloadBand: signals.workload,
    activeAgencySummary: signals.activeAgencySummary,
    turnaroundLabel: signals.turnaround,
  };
}

function isServiceListingEnabled(service: DummyService) {
  return service.listingEnabled !== false;
}

function getServiceAvailability(service: DummyService): "ACTIVE" | "PAUSED" {
  if (service.availability) {
    return service.availability;
  }
  return service.status === "Paused" ? "PAUSED" : "ACTIVE";
}

function canServiceBePublic(service: DummyService) {
  return service.status === "Approved" && isServiceListingEnabled(service) && getServiceAvailability(service) === "ACTIVE";
}

function classifyAttachmentKind(attachment: DummyMessageAttachmentInput): DummyConversationAttachment["kind"] {
  const mimeType = String(attachment.mimeType ?? "").toLowerCase();

  if (attachment.uploadTarget === "youtube") {
    return "youtube-upload";
  }

  if (attachment.durationSeconds) {
    return "voice-note";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  return "file";
}

function summarizeAttachment(attachment: DummyConversationAttachment) {
  if (attachment.kind === "voice-note") {
    return `Voice note (${attachment.durationLabel ?? "recorded"})`;
  }

  if (attachment.kind === "payment-request") {
    return `Payment request: ${attachment.name}`;
  }

  if (attachment.kind === "youtube-upload") {
    return `YouTube upload: ${attachment.name}`;
  }

  return attachment.name;
}

function summarizeMessage(message: Pick<DummyConversationMessage, "body" | "attachments">) {
  const trimmed = message.body.trim();
  if (trimmed) {
    return trimmed;
  }

  if (!message.attachments?.length) {
    return "";
  }

  if (message.attachments.length === 1) {
    return summarizeAttachment(message.attachments[0]);
  }

  return `${message.attachments.length} attachments shared`;
}

function getReadKey(audience: DummyConversationRole, lane: DummyConversationLane) {
  return `${audience}:${lane}` as DummyConversationReadKey;
}

function getReadStateForLane(conversation: DummyConversation, audience: DummyConversationRole, lane: DummyConversationLane) {
  return conversation.readStateByAudience[getReadKey(audience, lane)] ?? conversation.readStateByAudience[audience];
}

function markReadState(
  current: Partial<Record<DummyConversationReadKey, string>>,
  audience: DummyConversationRole,
  timestamp: string,
  lane?: DummyConversationLane,
) {
  if (lane) {
    return {
      ...current,
      [getReadKey(audience, lane)]: timestamp,
    } satisfies Partial<Record<DummyConversationReadKey, string>>;
  }

  return {
    ...current,
    [audience]: timestamp,
    [`${audience}:customer`]: timestamp,
    [`${audience}:internal`]: timestamp,
  } satisfies Partial<Record<DummyConversationReadKey, string>>;
}

function getFreelancerClientAlias(conversation: DummyConversation, aliasKeys?: string[]) {
  const aliases = conversation.freelancerClientAliases ?? {};
  for (const key of aliasKeys ?? []) {
    const alias = aliases[key]?.trim();
    if (alias) {
      return alias;
    }
  }

  const assignedAlias = aliases[conversation.assignedFreelancerId ?? ""]?.trim();
  return assignedAlias || "";
}

function normalizeAssignmentKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getMatchingAssignmentOffer(
  conversation: Pick<DummyConversation, "assignmentOffers">,
  freelancerIds?: string[],
  freelancerNames?: string[],
) {
  const ids = new Set((freelancerIds ?? []).map((value) => value.trim()).filter(Boolean));
  const names = (freelancerNames ?? []).map(normalizeAssignmentKey).filter(Boolean);

  const matchingOffers = (conversation.assignmentOffers ?? []).filter((offer) => {
    if (ids.has(offer.freelancerId)) return true;
    const offerName = normalizeAssignmentKey(offer.freelancerName);
    return Boolean(offerName && names.includes(offerName));
  });

  return matchingOffers.sort((left, right) => {
    const leftPending = left.status === "PENDING" ? 1 : 0;
    const rightPending = right.status === "PENDING" ? 1 : 0;
    if (leftPending !== rightPending) {
      return rightPending - leftPending;
    }
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  })[0];
}

function getMatchingFreelancerCollaborator(
  conversation: Pick<DummyConversation, "freelancerCollaborators">,
  freelancerIds?: string[],
  freelancerNames?: string[],
) {
  const ids = new Set((freelancerIds ?? []).map((value) => value.trim()).filter(Boolean));
  const names = new Set((freelancerNames ?? []).map(normalizeAssignmentKey).filter(Boolean));
  return (conversation.freelancerCollaborators ?? []).find(
    (collaborator) =>
      ids.has(collaborator.freelancerId) || names.has(normalizeAssignmentKey(collaborator.freelancerName)),
  );
}

function dedupeRapidAssignmentOfferMessages(messages: DummyConversationMessage[]) {
  const latestByContent = new Map<string, number>();
  return messages.filter((message) => {
    if (message.lane !== "internal" || !/^Project offer sent to\s+/i.test(message.body.trim())) {
      return true;
    }

    const createdAtMs = new Date(message.createdAt).getTime();
    const key = `${message.senderRole}:${message.senderLabel}:${message.body.trim()}`;
    const previousCreatedAtMs = latestByContent.get(key);
    latestByContent.set(key, createdAtMs);
    return !(
      Number.isFinite(createdAtMs) &&
      typeof previousCreatedAtMs === "number" &&
      Math.abs(createdAtMs - previousCreatedAtMs) <= 15_000
    );
  });
}

function getEditorAvailability(editorId: string): DummyEditorAvailability {
  const existing = editorAvailability.find((item) => item.editorId === editorId);
  return (
    existing ?? {
      editorId,
      onlineStatus: "online",
      acceptingProjects: true,
      updatedAt: nowIso(),
    }
  );
}

function isEditorAcceptingProjects(editorId: string) {
  const availability = getEditorAvailability(editorId);
  return availability.onlineStatus === "online" && availability.acceptingProjects !== false;
}

function normalizeLooseKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function findEditorByUsername(username: string | null | undefined) {
  const key = normalizeLooseKey(username);
  if (!key) {
    return null;
  }

  return (
    editorPerformanceProfiles.find((editor) =>
      [editor.id, editor.name, editor.publicAlias].some((value) => normalizeLooseKey(value) === key),
    ) ?? null
  );
}

function buildProjectDetailsFromIntake(conversation: DummyConversation) {
  const intake = conversation.projectIntake;
  if (!intake) {
    return conversation.internalNotes || conversation.summary || conversation.serviceTitle;
  }

  return [
    intake.projectName ? `Project: ${intake.projectName}` : "",
    intake.serviceTitle ? `Service: ${intake.serviceTitle}` : "",
    intake.googleDriveLink ? `Google Drive: ${intake.googleDriveLink}` : "",
    intake.referenceVideoLink ? `Reference: ${intake.referenceVideoLink}` : "",
    intake.editingNote ? `Editing note: ${intake.editingNote}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim() || conversation.internalNotes || conversation.summary || conversation.serviceTitle;
}

function canFreelancerSeeCustomerMessage(message: DummyConversationMessage) {
  if (message.lane !== "customer") {
    return true;
  }

  return message.visibility !== "client_private";
}

function getVisibleMessages(conversation: DummyConversation, audience: DummyConversationRole) {
  if (audience === "customer") {
    return conversation.messages.filter((message) => message.lane === "customer");
  }

  if (audience === "freelancer") {
    const customerLaneVisible = Boolean(conversation.freelancerCustomerLaneAccess);
    return conversation.messages.filter((message) => {
      if (message.lane !== "customer") {
        return true;
      }

      if (!customerLaneVisible) {
        return false;
      }

      if (message.senderRole === "freelancer") {
        return canFreelancerSeeCustomerMessage(message);
      }

      return canFreelancerSeeCustomerMessage(message);
    });
  }

  return conversation.messages;
}

function getVisibleTyping(conversation: DummyConversation, audience: DummyConversationRole) {
  const cleaned = cleanupTyping(conversation.typing);
  if (audience === "customer") {
    return cleaned.filter((entry) => entry.lane === "customer" && entry.role !== "customer");
  }

  if (!conversation.isInAppCustomerThread) {
    return cleaned.filter((entry) => entry.role !== "customer");
  }

  return cleaned;
}

function getUnreadMessages(conversation: DummyConversation, audience: DummyConversationRole) {
  return getVisibleMessages(conversation, audience).filter((message) => {
    if (!isConversationMessageIncomingForAudience(message, audience)) {
      return false;
    }

    const lastReadAt = getReadStateForLane(conversation, audience, message.lane);
    const lastReadMs = lastReadAt ? new Date(lastReadAt).getTime() : 0;
    return new Date(message.createdAt).getTime() > lastReadMs;
  });
}

function getUnreadCountByLane(conversation: DummyConversation, audience: DummyConversationRole) {
  const counts: Record<DummyConversationLane, number> = {
    customer: 0,
    internal: 0,
  };

  for (const message of getUnreadMessages(conversation, audience)) {
    counts[message.lane] += 1;
  }

  return counts;
}

function getUnreadCount(conversation: DummyConversation, audience: DummyConversationRole) {
  return getUnreadMessages(conversation, audience).length;
}

function syncContactFromConversation(
  conversation: DummyConversation,
  options?: { clearAssignedFreelancerId?: string },
) {
  const existingContact = contacts.find((contact) => contact.id === conversation.contactId);
  const existingAssignedUserId = existingContact?.assignedUserId ?? "";
  const latestMsg = conversation.messages.at(-1);
  const lastActivity =
    latestMsg?.createdAt ||
    conversation.updatedAt ||
    conversation.lastCustomerActivityAt ||
    nowIso();

  const nextContact: DummyContact = {
    id: conversation.contactId,
    tenantId: conversation.tenantId,
    conversationId: conversation.id,
    customerId: conversation.customerId,
    name: conversation.customerName,
    phone: conversation.customerPhone,
    profileImageUrl: conversation.customerProfileImageUrl || existingContact?.profileImageUrl || "",
    tags: existingContact?.tags ?? [],
    notes: conversation.internalNotes || existingContact?.notes || "",
    currentService: conversation.serviceTitle,
    latestStatusId: conversation.leadStatusId,
    assignedUserId:
      conversation.assignedFreelancerId ??
      (options?.clearAssignedFreelancerId === existingAssignedUserId ? "" : existingAssignedUserId),
    lastActivity,
  };

  contacts = existingContact
    ? contacts.map((contact) => (contact.id === conversation.contactId ? nextContact : contact))
    : [nextContact, ...contacts];
  dummyPlatformMemory.contacts = contacts;
}

function normalizeConversation(conversation: DummyConversation, index: number): DummyConversation {
  const latestPaymentRequestId = conversation.latestPaymentRequestId ?? conversation.paymentRequests?.at(-1)?.id;
  const existingContact = contacts.find((contact) => contact.id === conversation.contactId);
  const normalized = {
    ...conversation,
    contactId: conversation.contactId || `contact-${slugify(conversation.customerName || `lead-${index + 1}`)}`,
    customerProfileImageUrl: conversation.customerProfileImageUrl || existingContact?.profileImageUrl || "",
    sourceChannel: normalizeConversationSourceChannel(conversation),
    instagramBusinessAccountId: conversation.instagramBusinessAccountId?.trim() || undefined,
    instagramScopedUserId: normalizeInstagramScopedUserId(conversation.instagramScopedUserId),
    leadStatusId: conversation.leadStatusId || (conversation.status === "Assigned" ? "assigned" : conversation.status === "Closed" ? "closed" : "new"),
    internalNotes: conversation.internalNotes || "",
    nextFollowUpAt: conversation.nextFollowUpAt ?? null,
    readStateByAudience: conversation.readStateByAudience ?? {},
    lastCustomerActivityAt:
      conversation.lastCustomerActivityAt ||
      [...conversation.messages]
        .reverse()
        .find((message) => message.senderRole === "customer" && message.lane === "customer")?.createdAt ||
      conversation.updatedAt,
    isInAppCustomerThread: Boolean(conversation.isInAppCustomerThread),
    freelancerCustomerLaneAccess: Boolean(conversation.freelancerCustomerLaneAccess),
    freelancerCustomerLaneAccessUpdatedAt: conversation.freelancerCustomerLaneAccessUpdatedAt,
    freelancerCustomerLaneAccessGrantedByRole: conversation.freelancerCustomerLaneAccessGrantedByRole,
    freelancerCustomerLaneAccessGrantedByName: conversation.freelancerCustomerLaneAccessGrantedByName,
    aiAutoReplyDisabled: Boolean(conversation.aiAutoReplyDisabled),
    aiAutoReplyDisabledUpdatedAt: conversation.aiAutoReplyDisabledUpdatedAt,
    aiAutoReplyDisabledByRole: conversation.aiAutoReplyDisabledByRole,
    aiAutoReplyDisabledByName: conversation.aiAutoReplyDisabledByName,
    freelancerCollaborators: (conversation.freelancerCollaborators ?? [])
      .filter((collaborator) => collaborator.freelancerId && collaborator.freelancerId !== conversation.assignedFreelancerId)
      .map((collaborator) => ({
        ...collaborator,
        freelancerName: collaborator.freelancerName || collaborator.freelancerId,
        addedAt: collaborator.addedAt || conversation.updatedAt,
        addedByRole: collaborator.addedByRole === "admin" ? "admin" : "manager",
        addedByName: collaborator.addedByName || roleLabel(collaborator.addedByRole === "admin" ? "admin" : "manager"),
      })),
    assignmentOffers: (conversation.assignmentOffers ?? []).map((offer) => ({
      ...offer,
      id: offer.id || makeId("offer"),
      status: offer.status === "ACCEPTED" || offer.status === "PASSED" || offer.status === "EXPIRED" ? offer.status : "PENDING",
      projectDetails: offer.projectDetails || conversation.summary || conversation.internalNotes || conversation.serviceTitle,
      offeredByRole: offer.offeredByRole === "admin" ? "admin" : "manager",
      offeredByName: offer.offeredByName || roleLabel(offer.offeredByRole === "admin" ? "admin" : "manager"),
      createdAt: offer.createdAt || conversation.updatedAt,
      expiresAt: offer.expiresAt || new Date(new Date(offer.createdAt || conversation.updatedAt).getTime() + PROJECT_OFFER_WINDOW_MS).toISOString(),
      source: offer.source === "targeted" || offer.source === "fallback" ? offer.source : "manual",
      category: offer.category || conversation.serviceTitle,
      intent: offer.intent === "replacement" ? "replacement" : "primary",
    })),
    projectIntake: conversation.projectIntake
      ? {
          ...conversation.projectIntake,
          intakeFlowId: conversation.projectIntake.intakeFlowId || GIGXOMI_PROJECT_INTAKE_FLOW_ID,
          opsReviewStatus: conversation.projectIntake.opsReviewStatus || "NONE",
        }
      : undefined,
    freelancerClientAliases: conversation.freelancerClientAliases ?? {},
    latestPaymentRequestId,
    paymentRequests: (conversation.paymentRequests ?? []).map((paymentRequest) => ({
        ...paymentRequest,
        assignmentId: paymentRequest.assignmentId ?? `assignment-${conversation.id}`,
        projectId: paymentRequest.projectId ?? conversation.serviceId,
        projectTitle: paymentRequest.projectTitle ?? conversation.serviceTitle,
        lane: paymentRequest.lane === "internal" ? "internal" : "customer",
        payerRole: paymentRequest.payerRole === "agency" ? "agency" : "client",
        payeeRole: paymentRequest.payeeRole === "freelancer" ? "freelancer" : "agency",
        proofAttachments: paymentRequest.proofAttachments ?? [],
      })),
    messages: dedupeRapidAssignmentOfferMessages(
      (conversation.messages ?? []).map((message) => ({
        ...message,
        clientMessageId: typeof message.clientMessageId === "string" && message.clientMessageId.trim() ? message.clientMessageId.trim() : undefined,
        visibility: message.visibility === "client_private" ? message.visibility : undefined,
      })),
    ),
  } satisfies DummyConversation;

  syncContactFromConversation(normalized);
  return normalized;
}

export function projectConversation(
  conversation: DummyConversation,
  audience: DummyConversationRole,
  options?: { freelancerAliasKeys?: string[]; freelancerNames?: string[] },
): DummyConversationView {
  const freelancerIds = options?.freelancerAliasKeys ?? [];
  const freelancerNames = options?.freelancerNames ?? [];
  const myAssignmentOffer =
    audience === "freelancer"
      ? getMatchingAssignmentOffer(conversation, freelancerIds, freelancerNames)
      : undefined;
  const isPrimaryFreelancer =
    audience === "freelancer" &&
    (freelancerIds.includes(conversation.assignedFreelancerId ?? "") ||
      freelancerNames.some(
        (name) =>
          normalizeAssignmentKey(name) &&
          normalizeAssignmentKey(name) === normalizeAssignmentKey(conversation.assignedFreelancerName),
      ));
  const matchingCollaborator =
    audience === "freelancer"
      ? getMatchingFreelancerCollaborator(conversation, freelancerIds, freelancerNames)
      : undefined;
  const isReadOnlyCollaborator = Boolean(matchingCollaborator) && !isPrimaryFreelancer;
  const isUnassignedOfferOnly =
    audience === "freelancer" &&
    Boolean(myAssignmentOffer) &&
    !isPrimaryFreelancer &&
    !isReadOnlyCollaborator;
  const visibleMessages = getVisibleMessages(conversation, audience);
  const latestMessage = visibleMessages.at(-1);
  const latestUnreadMessage = getUnreadMessages(conversation, audience).at(-1);
  const unreadCountByLane = getUnreadCountByLane(conversation, audience);
  const leadStatus = getLeadStatusOrFallback(conversation.leadStatusId);
  const agencyContext = buildConversationAgencyContext(conversation);
  const transport = getCustomerLaneTransportState(conversation);
  const phoneAudience = audience === "admin" || audience === "sales" ? "admin" : audience === "manager" ? "manager" : "freelancer";
  const privacy = getCustomerPrivacySettings(conversation.tenantId) ?? createDefaultCustomerPrivacySettings(conversation.tenantId);
  const shouldMaskPhone =
    phoneAudience === "manager"
      ? privacy.maskCustomerPhoneForManagers
      : phoneAudience === "freelancer"
        ? privacy.maskCustomerPhoneForFreelancers
        : false;
  const customerLaneWritable =
    audience === "admin" || audience === "manager" || audience === "sales"
      ? true
      : audience === "freelancer"
        ? isPrimaryFreelancer && Boolean(conversation.freelancerCustomerLaneAccess) && transport.state !== "blocked"
        : false;
  const customerLaneVisible = audience === "freelancer" ? Boolean(conversation.freelancerCustomerLaneAccess) : true;
  const customerLaneReason =
    audience === "freelancer"
      ? transport.state === "blocked"
        ? transport.note
        : conversation.freelancerCustomerLaneAccess
          ? "Direct client chat is enabled for this thread."
          : "Direct client chat is still waiting for admin or manager access on this thread."
      : undefined;
  const clientAlias = audience === "freelancer" ? getFreelancerClientAlias(conversation, options?.freelancerAliasKeys) : "";
  const customerDisplayName = audience === "freelancer" ? clientAlias || conversation.maskedCustomerName : conversation.customerName;
  const effectiveUnreadCountByLane: Record<DummyConversationLane, number> =
    audience === "freelancer" && !customerLaneVisible
      ? {
          customer: 0,
          internal: unreadCountByLane.internal,
        }
      : unreadCountByLane;
  const visibleLanes: DummyConversationLane[] =
    audience === "customer" ? ["customer"] : audience === "freelancer" && !customerLaneVisible ? ["internal"] : ["customer", "internal"];
  const sourceChannel = normalizeConversationSourceChannel(conversation);
  const rawBusinessPhone = getWhatsAppConnectionState(conversation.tenantId)?.phoneNumber?.trim() || "";
  const closerConnectedPhone = process.env.CLOSER_WHATSAPP_PHONE_NUMBER?.trim() || "+91 99933 28124";
  const businessPhoneDisplay =
    sourceChannel === "whatsapp" && audience !== "freelancer"
      ? (rawBusinessPhone && !rawBusinessPhone.includes("99818") ? rawBusinessPhone : closerConnectedPhone)
      : "";

  return {
    id: conversation.id,
    contactId: conversation.contactId,
    serviceId: conversation.serviceId,
    serviceSlug: conversation.serviceSlug,
    serviceTitle: conversation.serviceTitle,
    customerDisplayName,
    clientAlias: clientAlias || undefined,
    customerPhoneDisplay: maskPhoneForAudience(conversation.customerPhone, phoneAudience, { masked: shouldMaskPhone }),
    businessPhoneDisplay: businessPhoneDisplay || undefined,
    customerProfileImageUrl: conversation.customerProfileImageUrl,
    sourceChannel,
    summary: latestMessage ? summarizeMessage(latestMessage) || conversation.summary : conversation.summary,
    status: conversation.status,
    leadStatusId: leadStatus.id,
    leadStatusLabel: leadStatus.label,
    leadStatusTone: leadStatus.tone,
    assignedFreelancerId: conversation.assignedFreelancerId,
    assignedFreelancerName: conversation.assignedFreelancerName,
    freelancerCollaborators: conversation.freelancerCollaborators ?? [],
    assignmentOffers: audience === "admin" || audience === "manager" ? conversation.assignmentOffers ?? [] : myAssignmentOffer ? [myAssignmentOffer] : [],
    myAssignmentOffer,
    projectIntake: audience === "admin" || audience === "manager" ? conversation.projectIntake : undefined,
    ownerName: conversation.ownerName,
    ownerRole: conversation.ownerRole,
    visibleLanes,
    messages: visibleMessages,
    typing: getVisibleTyping(conversation, audience),
    laneCounts: {
      customer: visibleMessages.filter((message) => message.lane === "customer").length,
      internal: visibleMessages.filter((message) => message.lane === "internal").length,
    },
    unreadCount: effectiveUnreadCountByLane.customer + effectiveUnreadCountByLane.internal,
    unreadCountByLane: effectiveUnreadCountByLane,
    readStateByAudience: { ...conversation.readStateByAudience },
    latestMessageLane: latestMessage?.lane ?? (audience === "freelancer" && !customerLaneVisible ? "internal" : "customer"),
    preferredLane:
      audience === "customer"
        ? "customer"
        : audience === "freelancer" && !customerLaneVisible
          ? "internal"
          : latestUnreadMessage?.lane ?? latestMessage?.lane ?? "customer",
    internalNotes: conversation.internalNotes,
    nextFollowUpAt: conversation.nextFollowUpAt ?? null,
    isInAppCustomerThread: conversation.isInAppCustomerThread,
    lastCustomerActivityAt: conversation.lastCustomerActivityAt,
    tenantId: conversation.tenantId,
    updatedAt: conversation.updatedAt,
    agencyContext,
    agencySummary: {
      tenantId: agencyContext.tenantId,
      agencyName: agencyContext.agencyName,
      agencySlug: agencyContext.agencySlug,
      agencyProfilePath: agencyContext.agencyProfilePath,
      location: agencyContext.location,
    },
    assignmentSummary: {
      assignedFreelancerId: conversation.assignedFreelancerId,
      assignedFreelancerName: conversation.assignedFreelancerName,
      freelancerCollaborators: conversation.freelancerCollaborators ?? [],
      ownerName: conversation.ownerName,
      ownerRole: conversation.ownerRole,
      offers: audience === "admin" || audience === "manager" ? conversation.assignmentOffers ?? [] : myAssignmentOffer ? [myAssignmentOffer] : [],
      pendingOfferCount: (conversation.assignmentOffers ?? []).filter((offer) => offer.status === "PENDING").length,
      myOffer: myAssignmentOffer,
    },
    laneCapabilities: {
      customer: {
        visible: customerLaneVisible,
        writable: customerLaneWritable,
        reason: customerLaneReason,
      },
      internal: {
        visible: audience !== "customer",
        writable: audience !== "customer" && (audience !== "freelancer" || isPrimaryFreelancer),
        reason:
          audience === "freelancer" && (isReadOnlyCollaborator || isUnassignedOfferOnly)
            ? "Only the primary editor can reply in the freelancer lane. You have read-only access."
            : undefined,
      },
    },
    freelancerCustomerLanePermission: {
      enabled: Boolean(conversation.freelancerCustomerLaneAccess),
      updatedAt: conversation.freelancerCustomerLaneAccessUpdatedAt,
      grantedByRole: conversation.freelancerCustomerLaneAccessGrantedByRole,
      grantedByName: conversation.freelancerCustomerLaneAccessGrantedByName,
      transportState: transport.state,
      transportNote: transport.note,
    },
    latestPaymentRequest: conversation.paymentRequests.find((item) => item.id === conversation.latestPaymentRequestId),
    paymentRequests: conversation.paymentRequests.map((item) => ({ ...item })),
    aiAutoReplyDisabled: Boolean(conversation.aiAutoReplyDisabled),
    aiAutoReplyDisabledUpdatedAt: conversation.aiAutoReplyDisabledUpdatedAt,
    aiAutoReplyDisabledByRole: conversation.aiAutoReplyDisabledByRole,
    aiAutoReplyDisabledByName: conversation.aiAutoReplyDisabledByName,
  };
}

function getConversationIndex(conversationId: string) {
  return conversations.findIndex((conversation) => conversation.id === conversationId);
}

export function getConversationById(conversationId: string) {
  const conversation = conversations.find((item) => item.id === conversationId) ?? null;
  return conversation ? normalizeConversation({ ...conversation, typing: cleanupTyping(conversation.typing) }, 0) : null;
}

function findWhatsAppStateByDisplayNumber(displayPhoneNumber?: string) {
  const normalizedDisplay = normalizePhone(displayPhoneNumber ?? "");
  if (normalizedDisplay) {
    const matchingStates = whatsappStates.filter((state) => normalizePhone(state.phoneNumber) === normalizedDisplay);
    // A moved public number can temporarily have a legacy display-only record
    // plus its live agency-owned Cloud API identity. Always route inbound
    // traffic through the record that has Meta's authoritative phone ID.
    return pickMostRecentWhatsAppState(
      matchingStates.sort((left, right) => Number(Boolean(right.phoneNumberId?.trim())) - Number(Boolean(left.phoneNumberId?.trim()))),
    );
  }

  return null;
}

function pickMostRecentWhatsAppState(states: DummyWhatsAppConnectionState[]) {
  return (
    states
      .slice()
      .sort((left, right) => {
        const rightUpdatedAt = new Date(right.updatedAt ?? "").getTime();
        const leftUpdatedAt = new Date(left.updatedAt ?? "").getTime();
        return (Number.isFinite(rightUpdatedAt) ? rightUpdatedAt : 0) - (Number.isFinite(leftUpdatedAt) ? leftUpdatedAt : 0);
      })[0] ?? null
  );
}

function releaseWhatsAppLineOwnershipFromOtherTenants(tenantId: string, owner: DummyWhatsAppConnectionState) {
  const ownerPhoneNumberId = String(owner.phoneNumberId ?? "").trim();
  const ownerWabaId = String(owner.wabaId ?? "").trim();
  const ownerPhone = normalizePhone(owner.phoneNumber ?? "");

  if (!ownerPhoneNumberId && !ownerWabaId && !ownerPhone) {
    return;
  }

  whatsappStates = whatsappStates.map((state) => {
    if (state.tenantId === tenantId) {
      return state;
    }

    const hasSamePhoneNumberId =
      ownerPhoneNumberId.length > 0 && String(state.phoneNumberId ?? "").trim() === ownerPhoneNumberId;
    const hasSameWabaId = ownerWabaId.length > 0 && String(state.wabaId ?? "").trim() === ownerWabaId;
    const hasSamePhone = ownerPhone.length > 0 && normalizePhone(state.phoneNumber ?? "") === ownerPhone;

    if (!hasSamePhoneNumberId && !hasSameWabaId && !hasSamePhone) {
      return state;
    }

    return {
      ...state,
      phoneNumberId: hasSamePhoneNumberId ? "" : state.phoneNumberId,
      wabaId: hasSameWabaId ? "" : state.wabaId,
      phoneNumber: hasSamePhone ? "" : state.phoneNumber,
      lastError: "",
      note: "This WhatsApp line was moved to another tenant setup, so the old tenant identity was cleared to prevent cross-tenant routing.",
      updatedAt: nowIso(),
      launchChecklist: buildWhatsAppChecklist({
        displayName: state.displayName,
        status: state.status,
        businessPortfolioId: state.businessPortfolioId,
        wabaId: hasSameWabaId ? "" : state.wabaId,
        phoneNumberId: hasSamePhoneNumberId ? "" : state.phoneNumberId,
        lastLaunchAt: state.lastLaunchAt,
        verifyToken: state.verifyToken,
        publicBaseUrl: state.publicBaseUrl,
      }),
    };
  });
  dummyPlatformMemory.whatsappStates = whatsappStates;
}

export function resolveTenantIdFromWhatsAppMetadata(input?: {
  displayPhoneNumber?: string;
  phoneNumberId?: string;
  wabaId?: string;
}) {
  const normalizedPhoneNumberId = String(input?.phoneNumberId ?? "").trim();
  if (normalizedPhoneNumberId) {
    const matchedState = pickMostRecentWhatsAppState(
      whatsappStates.filter((state) => String(state.phoneNumberId ?? "").trim() === normalizedPhoneNumberId),
    );
    if (matchedState) {
      return matchedState.tenantId;
    }
  }

  const matchedDisplayState = findWhatsAppStateByDisplayNumber(input?.displayPhoneNumber);
  if (matchedDisplayState) {
    return matchedDisplayState.tenantId;
  }

  const normalizedWabaId = String(input?.wabaId ?? "").trim();
  if (normalizedWabaId) {
    const matchedState = pickMostRecentWhatsAppState(
      whatsappStates.filter((state) => String(state.wabaId ?? "").trim() === normalizedWabaId),
    );
    if (matchedState) {
      return matchedState.tenantId;
    }
  }

  const normalizedDisplayPhone = normalizePhone(String(input?.displayPhoneNumber ?? ""));
  if (normalizedDisplayPhone === `+${PUBLIC_AUTH_WHATSAPP_PHONE_DIGITS}`) {
    return findWhatsAppStateByDisplayNumber(`+${PUBLIC_AUTH_WHATSAPP_PHONE_DIGITS}`)?.tenantId ?? "tenant-gigxomi";
  }

  return null;
}

function pickMostRecentInstagramState(states: DummyInstagramConnectionState[]) {
  return (
    states
      .slice()
      .sort((left, right) => {
        const rightUpdatedAt = new Date(right.updatedAt ?? "").getTime();
        const leftUpdatedAt = new Date(left.updatedAt ?? "").getTime();
        return (Number.isFinite(rightUpdatedAt) ? rightUpdatedAt : 0) - (Number.isFinite(leftUpdatedAt) ? leftUpdatedAt : 0);
      })[0] ?? null
  );
}

function releaseInstagramOwnershipFromOtherTenants(tenantId: string, owner: DummyInstagramConnectionState) {
  const ownerBusinessAccountId = String(owner.instagramBusinessAccountId ?? "").trim();
  if (!ownerBusinessAccountId) {
    return;
  }

  instagramStates = instagramStates.map((state) => {
    if (state.tenantId === tenantId || String(state.instagramBusinessAccountId ?? "").trim() !== ownerBusinessAccountId) {
      return state;
    }

    return {
      ...state,
      instagramBusinessAccountId: "",
      accessToken: "",
      lastError: "",
      note: "This Instagram business account was moved to another tenant setup, so the old tenant identity was cleared to prevent cross-tenant inbox routing.",
      status: "Plugin enabled" as DummyInstagramStatus,
      updatedAt: nowIso(),
    };
  });
  dummyPlatformMemory.instagramStates = instagramStates;
}

export function resolveTenantIdFromInstagramMetadata(input?: { instagramBusinessAccountId?: string; recipientId?: string }) {
  const ids = [input?.instagramBusinessAccountId, input?.recipientId].map((value) => String(value ?? "").trim()).filter(Boolean);
  for (const id of ids) {
    const matchedState = pickMostRecentInstagramState(
      instagramStates.filter((state) => state.pluginEnabled && String(state.instagramBusinessAccountId ?? "").trim() === id),
    );
    if (matchedState) {
      return matchedState.tenantId;
    }
  }

  return "tenant-gigxomi";
}

function findOpenConversationByCustomerPhone(tenantId: string, customerPhone: string) {
  const normalized = normalizePhone(customerPhone);
  return (
    conversations
      .filter((conversation) => conversation.tenantId === tenantId && normalizePhone(conversation.customerPhone) === normalized)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

function getWhatsAppMediaProxyUrl(input: {
  tenantId: string;
  mediaId: string;
  mimeType?: string;
  fileName?: string;
}) {
  const mediaId = input.mediaId.trim();
  if (!mediaId) {
    return "";
  }

  const searchParams = new URLSearchParams({
    tenantId: input.tenantId.trim() || "tenant-gigxomi",
  });

  if (input.mimeType?.trim()) {
    searchParams.set("mimeType", input.mimeType.trim());
  }

  if (input.fileName?.trim()) {
    searchParams.set("fileName", input.fileName.trim());
  }

  return `/api/meta/whatsapp/media/${encodeURIComponent(mediaId)}?${searchParams.toString()}`;
}

function getMimeExtension(mimeType?: string) {
  const normalized = String(mimeType ?? "").toLowerCase().trim();
  if (!normalized) {
    return "";
  }

  const explicit = normalized.split("/")[1]?.split(";")[0]?.trim() ?? "";
  if (!explicit) {
    return "";
  }

  if (explicit === "jpeg") return "jpg";
  if (explicit === "svg+xml") return "svg";
  return explicit;
}

function getWhatsAppAttachmentName(input: {
  type: "image" | "video" | "audio" | "document" | "sticker";
  mimeType?: string;
  fileName?: string;
  mediaId?: string;
}) {
  const fileName = String(input.fileName ?? "").trim();
  if (fileName) {
    return fileName;
  }

  const extension = getMimeExtension(input.mimeType);
  const suffix = String(input.mediaId ?? "").trim().slice(-8).toLowerCase();
  const baseName =
    input.type === "document"
      ? "WhatsApp document"
      : input.type === "audio"
        ? "WhatsApp audio"
        : input.type === "video"
          ? "WhatsApp video"
          : input.type === "sticker"
            ? "WhatsApp sticker"
            : "WhatsApp image";

  const readableSuffix = suffix ? ` ${suffix}` : "";
  return extension ? `${baseName}${readableSuffix}.${extension}` : `${baseName}${readableSuffix}`;
}

function buildWhatsAppMessageAttachments(message: Record<string, unknown>, tenantId: string): DummyMessageAttachmentInput[] {
  const type = String(message.type ?? "text").trim().toLowerCase();

  const safeInboundAttachment = (name: string, mimeType: string, note?: string): DummyMessageAttachmentInput => ({
    name,
    mimeType,
    note: note || buildInboundAttachmentAcknowledgement(classifyInboundAttachmentIntent(name, mimeType)),
  });

  if (type === "image") {
    const image = (message.image as { id?: string; mime_type?: string; caption?: string } | undefined) ?? {};
    const mediaId = String(image.id ?? "").trim();
    const mimeType = String(image.mime_type ?? "image/jpeg").trim();
    const caption = String(image.caption ?? "").trim();
    if (!mediaId) {
      return [safeInboundAttachment("Image received", mimeType, caption)];
    }
    return [
      {
        name: getWhatsAppAttachmentName({ type: "image", mimeType, mediaId }),
        mimeType,
        note: caption || "Image received on WhatsApp.",
        externalUrl: getWhatsAppMediaProxyUrl({ tenantId, mediaId, mimeType }),
      },
    ];
  }

  if (type === "sticker") {
    const sticker = (message.sticker as { id?: string; mime_type?: string } | undefined) ?? {};
    const mediaId = String(sticker.id ?? "").trim();
    const mimeType = String(sticker.mime_type ?? "image/webp").trim();
    if (!mediaId) {
      return [safeInboundAttachment("Sticker received", mimeType)];
    }
    return [
      {
        name: getWhatsAppAttachmentName({ type: "sticker", mimeType, mediaId }),
        mimeType,
        note: "Sticker received on WhatsApp.",
        externalUrl: getWhatsAppMediaProxyUrl({ tenantId, mediaId, mimeType }),
      },
    ];
  }

  if (type === "document") {
    const document = (message.document as { id?: string; mime_type?: string; filename?: string; caption?: string } | undefined) ?? {};
    const mediaId = String(document.id ?? "").trim();
    const mimeType = String(document.mime_type ?? "application/octet-stream").trim();
    const fileName = String(document.filename ?? "").trim();
    const caption = String(document.caption ?? "").trim();
    if (!mediaId) {
      return [safeInboundAttachment(fileName || "Document received", mimeType, caption)];
    }
    return [
      {
        name: getWhatsAppAttachmentName({ type: "document", mimeType, fileName, mediaId }),
        mimeType,
        note: caption || "Document received on WhatsApp.",
        externalUrl: getWhatsAppMediaProxyUrl({ tenantId, mediaId, mimeType, fileName }),
      },
    ];
  }

  if (type === "audio") {
    const audio = (message.audio as { id?: string; mime_type?: string } | undefined) ?? {};
    const mediaId = String(audio.id ?? "").trim();
    const mimeType = String(audio.mime_type ?? "audio/ogg").trim();
    if (!mediaId) {
      return [safeInboundAttachment("Audio received", mimeType)];
    }
    return [
      {
        name: getWhatsAppAttachmentName({ type: "audio", mimeType, mediaId }),
        mimeType,
        note: "Audio received on WhatsApp.",
        externalUrl: getWhatsAppMediaProxyUrl({ tenantId, mediaId, mimeType }),
      },
    ];
  }

  if (type === "video") {
    const video = (message.video as { id?: string; mime_type?: string; caption?: string } | undefined) ?? {};
    const mediaId = String(video.id ?? "").trim();
    const mimeType = String(video.mime_type ?? "video/mp4").trim();
    const caption = String(video.caption ?? "").trim();
    if (!mediaId) {
      return [safeInboundAttachment("Video received", mimeType, caption)];
    }
    return [
      {
        name: getWhatsAppAttachmentName({ type: "video", mimeType, mediaId }),
        mimeType,
        note: caption || "Video received on WhatsApp.",
        externalUrl: getWhatsAppMediaProxyUrl({ tenantId, mediaId, mimeType }),
      },
    ];
  }

  if (type !== "text" && type !== "button" && type !== "interactive" && type !== "location" && type !== "contacts" && type !== "reaction") {
    return [safeInboundAttachment(`${type || "Message"} received`, "application/x-gigxomi-inbound")];
  }

  return [];
}

function buildInboundLinkAttachment(body: string): DummyMessageAttachmentInput | null {
  const url = String(body ?? "").match(/https?:\/\/[^\s<>()]+/i)?.[0]?.replace(/[.,!?;:]+$/, "");
  if (!url) {
    return null;
  }
  const isPortfolio = /portfolio|work|showreel|behance|dribbble|instagram|youtube/i.test(url);
  return {
    name: isPortfolio ? "Portfolio link" : "Link received",
    mimeType: "text/uri-list",
    externalUrl: url,
    note: buildInboundAttachmentAcknowledgement(isPortfolio ? "portfolio" : "unknown"),
  };
}

function extractWhatsAppMessageBody(message: Record<string, unknown>) {
  const type = String(message.type ?? "text");

  if (type === "text") {
    return String((message.text as { body?: string } | undefined)?.body ?? "").trim();
  }

  if (type === "button") {
    return String((message.button as { text?: string } | undefined)?.text ?? "").trim();
  }

  if (type === "interactive") {
    const interactive = (message.interactive as
      | {
          button_reply?: { title?: string };
          list_reply?: { title?: string; description?: string };
          nfm_reply?: { body?: string; response_json?: string };
        }
      | undefined) ?? { };

    return (
      interactive.button_reply?.title?.trim() ||
      interactive.list_reply?.title?.trim() ||
      interactive.list_reply?.description?.trim() ||
      interactive.nfm_reply?.body?.trim() ||
      (interactive.nfm_reply?.response_json ? "WhatsApp review flow submitted." : "") ||
      ""
    );
  }

  if (type === "image") {
    const caption = String((message.image as { caption?: string } | undefined)?.caption ?? "").trim();
    return caption;
  }

  if (type === "document") {
    const caption = String((message.document as { caption?: string; filename?: string } | undefined)?.caption ?? "").trim();
    const filename = String((message.document as { filename?: string } | undefined)?.filename ?? "").trim();
    return caption || (filename ? `Document: ${filename}` : "");
  }

  if (type === "audio") {
    return "";
  }

  if (type === "video") {
    const caption = String((message.video as { caption?: string } | undefined)?.caption ?? "").trim();
    return caption;
  }

  if (type === "sticker") {
    return "";
  }

  if (type === "location") {
    const location = (message.location as { name?: string; address?: string } | undefined) ?? {};
    const name = String(location.name ?? "").trim();
    const address = String(location.address ?? "").trim();
    const summary = [name, address].filter(Boolean).join(" - ");
    return summary ? `Location shared: ${summary}` : "[Location received on WhatsApp]";
  }

  if (type === "contacts") {
    return "[Contact card received on WhatsApp]";
  }

  if (type === "reaction") {
    return String((message.reaction as { emoji?: string } | undefined)?.emoji ?? "").trim() || "[Reaction received on WhatsApp]";
  }

  if (type === "unsupported") {
    return "";
  }

  return "";
}

function extractWhatsAppFlowReview(message: Record<string, unknown>) {
  if (String(message.type ?? "") !== "interactive") {
    return null;
  }

  const interactive = (message.interactive && typeof message.interactive === "object" ? message.interactive : {}) as {
    nfm_reply?: { response_json?: string; body?: string };
  };
  const responseJson = String(interactive.nfm_reply?.response_json ?? "").trim();
  if (!responseJson) {
    return null;
  }

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(responseJson) as Record<string, unknown>;
  } catch {
    return null;
  }

  const flowToken = String(data.flow_token ?? data.flowToken ?? data.token ?? "").trim();
  const tokenConversationId = flowToken.startsWith("review:") ? flowToken.split(":")[1] : "";
  const conversationId = String(data.conversationId ?? data.conversation_id ?? tokenConversationId ?? "").trim();
  const ratingValue = data.rating ?? data.stars ?? data.score ?? data.review_rating;
  const rating = Number(ratingValue);
  const comment = String(data.comment ?? data.feedback ?? data.review ?? data.message ?? "").trim();

  return {
    conversationId,
    rating: Number.isFinite(rating) ? Math.max(1, Math.min(5, Math.round(rating))) : undefined,
    comment,
    raw: data,
  };
}

function pickFlowString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (value && typeof value === "object") {
      const nested = value as { value?: unknown; text?: unknown; answer?: unknown };
      const nestedValue = String(nested.value ?? nested.text ?? nested.answer ?? "").trim();
      if (nestedValue) {
        return nestedValue;
      }
    }
  }
  return "";
}

function extractWhatsAppProjectIntakeFlow(message: Record<string, unknown>) {
  if (String(message.type ?? "") !== "interactive") {
    return null;
  }

  const interactive = (message.interactive && typeof message.interactive === "object" ? message.interactive : {}) as {
    nfm_reply?: { response_json?: string; body?: string };
  };
  const responseJson = String(interactive.nfm_reply?.response_json ?? "").trim();
  if (!responseJson) {
    return null;
  }

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(responseJson) as Record<string, unknown>;
  } catch {
    return null;
  }

  const flowToken = String(data.flow_token ?? data.flowToken ?? data.token ?? "").trim();
  const tokenConversationId = flowToken.startsWith("project-intake:") ? flowToken.split(":")[1] : "";
  const flowId = String(data.flow_id ?? data.flowId ?? "").trim();
  const looksLikeProjectIntake =
    flowToken.startsWith("project-intake:") ||
    flowId === GIGXOMI_PROJECT_INTAKE_FLOW_ID ||
    Boolean(
      pickFlowString(data, ["projectName", "project_name", "project", "googleDriveLink", "google_drive_link", "editingNote", "editing_note"]),
    );
  if (!looksLikeProjectIntake) {
    return null;
  }

  return {
    conversationId: String(data.conversationId ?? data.conversation_id ?? tokenConversationId ?? "").trim(),
    projectName: pickFlowString(data, ["projectName", "project_name", "project", "project_title"]),
    googleDriveLink: pickFlowString(data, ["googleDriveLink", "google_drive_link", "driveLink", "drive_link"]),
    referenceVideoLink: pickFlowString(data, ["referenceVideoLink", "reference_video_link", "referenceLink", "reference_link"]),
    editingNote: pickFlowString(data, ["editingNote", "editing_note", "notes", "brief"]),
    raw: data,
  };
}

function parseDefaultWhatsAppServiceMessage(body: string) {
  const text = body.trim();
  if (!/i want to discuss this service:/i.test(text) || !/editor:/i.test(text)) {
    return null;
  }

  const readLineValue = (label: string) => {
    const match = text.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im"));
    return match?.[1]?.trim() ?? "";
  };

  const serviceTitle = readLineValue("I want to discuss this service");
  const targetEditorUsername = readLineValue("Editor");
  if (!serviceTitle || !targetEditorUsername) {
    return null;
  }

  return {
    serviceTitle,
    targetEditorUsername,
    servicePageUrl: readLineValue("Service page"),
    startingPriceLabel: readLineValue("Starting price"),
    expectedDeliveryLabel: readLineValue("Expected delivery"),
  };
}

function extractWhatsAppProfileImageUrl(profile: Record<string, unknown> | undefined) {
  if (!profile) {
    return "";
  }

  const candidates = [
    profile.profileImageUrl,
    profile.profile_image_url,
    profile.profilePictureUrl,
    profile.profile_picture_url,
    profile.picture,
    profile.picture_url,
    profile.image,
    profile.image_url,
    profile.avatar,
    profile.avatar_url,
    profile.contactImage,
    profile.contactImageUrl,
    profile.contact_image,
    profile.contact_image_url,
    profile.thumbnail,
    profile.thumbnail_url,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const objectCandidate = candidate as Record<string, unknown>;
      const nestedValue = String(
        objectCandidate.url ??
          objectCandidate.href ??
          objectCandidate.uri ??
          objectCandidate.src ??
          objectCandidate.source ??
          "",
      ).trim();
      if (/^(https?:\/\/|\/|data:image\/)/i.test(nestedValue)) {
        return nestedValue;
      }
    }

    const value = String(candidate ?? "").trim();
    if (/^(https?:\/\/|\/|data:image\/)/i.test(value)) {
      return value;
    }
  }

  return "";
}

function normalizeWhatsAppPhoneLookupKey(value: string) {
  return value.replace(/[^\d]/g, "");
}

function normalizeWhatsAppPhoneCandidates(value: string) {
  const raw = value.trim();
  if (!raw) {
    return [];
  }
  const digitsOnly = normalizeWhatsAppPhoneLookupKey(raw);
  const withPlus = digitsOnly ? `+${digitsOnly}` : "";
  return Array.from(new Set([raw, withPlus, digitsOnly].map((item) => item.trim()).filter(Boolean)));
}

function extractWhatsAppProfileImageFromUnknown(value: unknown): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^(https?:\/\/|\/|data:image\/)/i.test(trimmed) ? trimmed : "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractWhatsAppProfileImageFromUnknown(item);
      if (nested) {
        return nested;
      }
    }
    return "";
  }

  if (typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  const directCandidates = [
    record.url,
    record.href,
    record.uri,
    record.src,
    record.source,
    record.profile_picture_url,
    record.profileImageUrl,
    record.picture_url,
  ];

  for (const candidate of directCandidates) {
    const url = extractWhatsAppProfileImageFromUnknown(candidate);
    if (url) {
      return url;
    }
  }

  const nestedCandidates = [
    record.data,
    record.picture,
    record.profile_picture,
    record.profile,
    record.image,
    record.images,
    record.result,
    record.results,
  ];

  for (const candidate of nestedCandidates) {
    const url = extractWhatsAppProfileImageFromUnknown(candidate);
    if (url) {
      return url;
    }
  }

  return "";
}

async function fetchMetaGraphPayload(input: {
  accessToken: string;
  graphApiVersion: string;
  path: string;
  method?: "GET" | "POST";
  body?: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(new URL(`https://graph.facebook.com/${input.graphApiVersion}/${input.path}`), {
      method: input.method ?? "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        ...(input.body ? { "Content-Type": "application/json" } : {}),
      },
      body: input.body,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : null;

    return {
      ok: response.ok,
      payload,
      resolvedUrl: response.url,
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveWhatsAppProfilePictureByWaId(input: {
  accessToken: string;
  graphApiVersion: string;
  waId: string;
}) {
  const waId = input.waId.trim();
  if (!waId) {
    return "";
  }

  const attempts = [
    `${waId}/profile_picture?type=large`,
    `${waId}/picture?redirect=0&type=large`,
    `${waId}?fields=profile_picture_url,picture{url},profile_picture{url}`,
  ];

  for (const path of attempts) {
    const result = await fetchMetaGraphPayload({
      accessToken: input.accessToken,
      graphApiVersion: input.graphApiVersion,
      path,
    }).catch(() => null);

    const imageUrl = extractWhatsAppProfileImageFromUnknown(result?.payload);
    if (imageUrl) {
      return imageUrl;
    }

    const resolvedUrl = String(result?.resolvedUrl ?? "").trim();
    if (result?.ok && resolvedUrl && !resolvedUrl.includes(`graph.facebook.com/${input.graphApiVersion}/`)) {
      return resolvedUrl;
    }
  }

  return "";
}

async function resolveWhatsAppContactWaIdForProfile(input: {
  accessToken: string;
  graphApiVersion: string;
  phoneNumberId: string;
  customerPhone: string;
}) {
  const contactPhones = normalizeWhatsAppPhoneCandidates(input.customerPhone);
  if (!contactPhones.length) {
    return "";
  }

  const postAttempt = await fetchMetaGraphPayload({
    accessToken: input.accessToken,
    graphApiVersion: input.graphApiVersion,
    path: `${input.phoneNumberId}/contacts`,
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      blocking: "wait",
      force_check: true,
      contacts: contactPhones,
    }),
  }).catch(() => null);

  const postPayload = postAttempt?.payload;
  const postContacts = Array.isArray((postPayload as { contacts?: unknown })?.contacts)
    ? (((postPayload as { contacts?: unknown }).contacts as unknown[]) ?? [])
    : Array.isArray((postPayload as { data?: unknown })?.data)
      ? (((postPayload as { data?: unknown }).data as unknown[]) ?? [])
      : [];
  const postFirst = postContacts.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  const postWaId = String(postFirst?.wa_id ?? postFirst?.id ?? "").trim();
  if (postWaId) {
    return postWaId;
  }

  const query = new URLSearchParams({
    blocking: "wait",
    force_check: "true",
    contacts: JSON.stringify(contactPhones),
  });

  const getAttempt = await fetchMetaGraphPayload({
    accessToken: input.accessToken,
    graphApiVersion: input.graphApiVersion,
    path: `${input.phoneNumberId}/contacts?${query.toString()}`,
  }).catch(() => null);

  const getPayload = getAttempt?.payload;
  const getContacts = Array.isArray((getPayload as { contacts?: unknown })?.contacts)
    ? (((getPayload as { contacts?: unknown }).contacts as unknown[]) ?? [])
    : Array.isArray((getPayload as { data?: unknown })?.data)
      ? (((getPayload as { data?: unknown }).data as unknown[]) ?? [])
      : [];
  const getFirst = getContacts.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  return String(getFirst?.wa_id ?? getFirst?.id ?? "").trim();
}

async function resolveWhatsAppProfilePictureUrlFromMeta(input: {
  accessToken: string;
  graphApiVersion: string;
  phoneNumberId: string;
  customerPhone: string;
}) {
  const candidateWaIds = normalizeWhatsAppPhoneCandidates(input.customerPhone);
  for (const waId of candidateWaIds) {
    const imageUrl = await resolveWhatsAppProfilePictureByWaId({
      accessToken: input.accessToken,
      graphApiVersion: input.graphApiVersion,
      waId,
    });
    if (imageUrl) {
      return imageUrl;
    }
  }

  const resolvedWaId = await resolveWhatsAppContactWaIdForProfile(input);
  if (!resolvedWaId) {
    return "";
  }

  return resolveWhatsAppProfilePictureByWaId({
    accessToken: input.accessToken,
    graphApiVersion: input.graphApiVersion,
    waId: resolvedWaId,
  });
}

function shouldProxyWhatsAppProfileImage(imageUrl: string) {
  try {
    const parsed = new URL(imageUrl);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "graph.facebook.com" ||
      host.endsWith(".facebook.com") ||
      host.endsWith(".whatsapp.net") ||
      host.endsWith(".fbcdn.net")
    );
  } catch {
    return false;
  }
}

async function resolvePersistableWhatsAppProfileImage(input: {
  imageUrl: string;
  accessToken: string;
}) {
  const imageUrl = String(input.imageUrl ?? "").trim();
  if (!imageUrl) {
    return "";
  }

  if (/^data:image\//i.test(imageUrl)) {
    return imageUrl;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const attempts = shouldProxyWhatsAppProfileImage(imageUrl) ? [true, false] : [false, true];
    for (const useAuth of attempts) {
      const response = await fetch(imageUrl, {
        cache: "no-store",
        signal: controller.signal,
        headers: useAuth ? { Authorization: `Bearer ${input.accessToken}` } : undefined,
      }).catch(() => null);

      if (!response?.ok) {
        continue;
      }

      const contentType = String(response.headers.get("content-type") ?? "").trim().toLowerCase();
      if (!contentType.startsWith("image/")) {
        continue;
      }

      const arrayBuffer = await response.arrayBuffer().catch(() => null);
      if (!arrayBuffer || arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > 1024 * 1024) {
        continue;
      }

      const base64 = Buffer.from(arrayBuffer).toString("base64");
      if (!base64) {
        continue;
      }

      return `data:${contentType};base64,${base64}`;
    }
  } finally {
    clearTimeout(timeout);
  }

  return shouldProxyWhatsAppProfileImage(imageUrl) ? "" : imageUrl;
}

export function updateConversationCustomerProfile(
  conversationId: string,
  input: { customerName?: string; customerProfileImageUrl?: string },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const nextName = input.customerName?.trim() || conversation.customerName;
  const nextProfileImageUrl = input.customerProfileImageUrl?.trim() || conversation.customerProfileImageUrl || "";

  if (nextName === conversation.customerName && nextProfileImageUrl === (conversation.customerProfileImageUrl || "")) {
    return conversation;
  }

  conversations[index] = {
    ...conversation,
    customerName: nextName,
    customerProfileImageUrl: nextProfileImageUrl,
    updatedAt: nowIso(),
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;
  return conversations[index];
}

function createWhatsAppIntakeConversation(input: {
  tenantId: string;
  customerName: string;
  customerPhone: string;
  customerProfileImageUrl?: string;
  body: string;
  externalMessageId?: string;
  attachments?: DummyMessageAttachmentInput[];
}) {
  const createdAt = nowIso();
  const normalizedPhone = normalizePhone(input.customerPhone);
  const senderLabel = input.customerName.trim() || "WhatsApp Customer";
  const conversationBase: DummyConversation = {
    id: makeId("conv"),
    contactId: makeId("contact"),
    serviceId: "svc-whatsapp-intake",
    serviceSlug: "whatsapp-intake",
    serviceTitle: "WhatsApp intake thread",
    customerId: `wa-${normalizedPhone || makeId("customer")}`,
    customerName: input.customerName.trim() || "WhatsApp Customer",
    customerPhone: formatPhone(input.customerPhone),
    customerProfileImageUrl: input.customerProfileImageUrl?.trim() || "",
    maskedCustomerName: formatCustomerAlias(conversations.length + 3),
    tenantId: input.tenantId,
    status: "Manager Review",
    leadStatusId: "new",
    summary: input.body.trim(),
    internalNotes: "",
    ownerRole: "manager",
    ownerName: "Rahul Manager",
    readStateByAudience: {
      customer: createdAt,
    },
    lastCustomerActivityAt: createdAt,
    isInAppCustomerThread: false,
    latestPaymentRequestId: undefined,
    paymentRequests: [],
    messages: [],
    typing: [],
    createdAt,
    updatedAt: createdAt,
  };

  const attachments = createMessageAttachments(conversationBase, "customer", senderLabel, input.attachments);
  const firstMessage: DummyConversationMessage = {
    id: makeId("msg"),
    lane: "customer",
    senderRole: "customer",
    senderLabel,
    body: input.body.trim(),
    attachments: attachments.length ? attachments : undefined,
    externalMessageId: input.externalMessageId?.trim() || undefined,
    createdAt,
  };
  const conversation: DummyConversation = {
    ...conversationBase,
    summary: summarizeMessage(firstMessage) || conversationBase.summary,
    messages: [firstMessage],
  };

  conversations = [normalizeConversation(conversation, conversations.length), ...conversations];
  dummyPlatformMemory.conversations = conversations;
  return conversation;
}

function createWhatsAppBusinessAppEchoConversation(input: {
  tenantId: string;
  customerPhone: string;
  body: string;
  externalMessageId?: string;
  attachments?: DummyMessageAttachmentInput[];
}) {
  const createdAt = nowIso();
  const normalizedPhone = normalizePhone(input.customerPhone);
  const customerName = "WhatsApp Contact";
  const conversationBase: DummyConversation = {
    id: makeId("conv"),
    contactId: makeId("contact"),
    serviceId: "svc-whatsapp-intake",
    serviceSlug: "whatsapp-intake",
    serviceTitle: "WhatsApp intake thread",
    customerId: `wa-${normalizedPhone || makeId("customer")}`,
    customerName,
    customerPhone: formatPhone(input.customerPhone),
    customerProfileImageUrl: "",
    maskedCustomerName: formatCustomerAlias(conversations.length + 3),
    tenantId: input.tenantId,
    status: "Manager Review",
    leadStatusId: "new",
    summary: input.body.trim(),
    internalNotes: "",
    ownerRole: "manager",
    ownerName: "Rahul Manager",
    readStateByAudience: {
      admin: createdAt,
    },
    lastCustomerActivityAt: createdAt,
    isInAppCustomerThread: false,
    latestPaymentRequestId: undefined,
    paymentRequests: [],
    messages: [],
    typing: [],
    createdAt,
    updatedAt: createdAt,
  };

  const senderLabel = getConversationMessageSenderLabel(conversationBase, "admin", "customer");
  const attachments = createMessageAttachments(conversationBase, "admin", senderLabel, input.attachments);
  const firstMessage: DummyConversationMessage = {
    id: makeId("msg"),
    lane: "customer",
    senderRole: "admin",
    senderLabel,
    body: input.body.trim(),
    attachments: attachments.length ? attachments : undefined,
    externalMessageId: input.externalMessageId?.trim() || undefined,
    deliveryStatus: "sent",
    createdAt,
  };
  const conversation: DummyConversation = {
    ...conversationBase,
    summary: summarizeMessage(firstMessage) || conversationBase.summary,
    messages: [firstMessage],
  };

  conversations = [normalizeConversation(conversation, conversations.length), ...conversations];
  dummyPlatformMemory.conversations = conversations;
  return conversation;
}

function findOpenConversationByInstagramScopedUserId(tenantId: string, scopedUserId: string) {
  const normalized = normalizeInstagramScopedUserId(scopedUserId);
  if (!normalized) {
    return undefined;
  }

  return conversations
    .filter((conversation) => conversation.tenantId === tenantId && normalizeConversationSourceChannel(conversation) === "instagram")
    .filter((conversation) => getInstagramRecipientId(conversation) === normalized)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function createInstagramConversation(input: {
  tenantId: string;
  instagramBusinessAccountId?: string;
  instagramScopedUserId: string;
  customerName?: string;
  body: string;
  attachments?: DummyMessageAttachmentInput[];
  externalMessageId?: string;
}) {
  const scopedUserId = normalizeInstagramScopedUserId(input.instagramScopedUserId);
  if (!scopedUserId) {
    return null;
  }

  const createdAt = nowIso();
  const senderLabel = input.customerName?.trim() || "Instagram Customer";
  const conversationBase: DummyConversation = {
    id: makeId("conv"),
    contactId: makeId("contact"),
    serviceId: "svc-instagram-inbox",
    serviceSlug: "instagram-inbox",
    serviceTitle: "Instagram inbox thread",
    customerId: `ig-${scopedUserId}`,
    customerName: senderLabel,
    customerPhone: scopedUserId,
    instagramBusinessAccountId: input.instagramBusinessAccountId?.trim() || undefined,
    instagramScopedUserId: scopedUserId,
    maskedCustomerName: formatCustomerAlias(conversations.length + 3),
    tenantId: input.tenantId,
    sourceChannel: "instagram",
    status: "Manager Review",
    leadStatusId: "new",
    summary: input.body.trim(),
    internalNotes: "",
    ownerRole: "manager",
    ownerName: "Rahul Manager",
    readStateByAudience: {
      customer: createdAt,
    },
    lastCustomerActivityAt: createdAt,
    isInAppCustomerThread: false,
    latestPaymentRequestId: undefined,
    paymentRequests: [],
    messages: [],
    typing: [],
    createdAt,
    updatedAt: createdAt,
  };

  const firstAttachments = createMessageAttachments(
    conversationBase,
    "customer",
    senderLabel,
    input.attachments,
  );
  const firstMessage: DummyConversationMessage = {
    id: makeId("msg"),
    lane: "customer",
    senderRole: "customer",
    senderLabel,
    body: input.body.trim(),
    attachments: firstAttachments.length ? firstAttachments : undefined,
    externalMessageId: input.externalMessageId?.trim() || undefined,
    createdAt,
  };
  const conversation: DummyConversation = {
    ...conversationBase,
    summary: summarizeMessage(firstMessage) || conversationBase.summary,
    messages: [firstMessage],
  };

  conversations = [normalizeConversation(conversation, conversations.length), ...conversations];
  dummyPlatformMemory.conversations = conversations;
  return conversation;
}

function hasConversationMessageWithExternalId(conversation: DummyConversation, externalMessageId?: string | null) {
  const normalized = String(externalMessageId ?? "").trim();
  if (!normalized) {
    return false;
  }

  return conversation.messages.some((message) => message.externalMessageId?.trim() === normalized);
}

function hasConversationMessageWithClientMessageId(conversation: DummyConversation, clientMessageId?: string | null) {
  const normalized = String(clientMessageId ?? "").trim();
  if (!normalized) {
    return false;
  }

  return conversation.messages.some((message) => message.clientMessageId?.trim() === normalized);
}

export function getConversationMessageByClientMessageId(conversation: DummyConversation, clientMessageId?: string | null) {
  const normalized = String(clientMessageId ?? "").trim();
  if (!normalized) {
    return null;
  }

  return conversation.messages.find((message) => message.clientMessageId?.trim() === normalized) ?? null;
}

function getDeliveryStatusRank(status?: DummyConversationMessage["deliveryStatus"]) {
  if (status === "read") {
    return 4;
  }
  if (status === "delivered") {
    return 3;
  }
  if (status === "sent") {
    return 2;
  }
  if (status === "failed") {
    return 1;
  }
  return 0;
}

function resolveConversationMessageDeliveryStatus(
  current?: DummyConversationMessage["deliveryStatus"],
  incoming?: DummyConversationMessage["deliveryStatus"],
) {
  if (!incoming) {
    return current;
  }

  if (incoming === "failed") {
    return current && getDeliveryStatusRank(current) > getDeliveryStatusRank(incoming) ? current : incoming;
  }

  return getDeliveryStatusRank(incoming) > getDeliveryStatusRank(current) ? incoming : current;
}

function normalizeConversationDeliveryError(value?: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function getConversationMessageDeliveryMeta(delivery: {
  ok: boolean;
  mode: DummyWhatsAppDeliveryMode;
  error?: string;
  messageId?: string;
}) {
  if (delivery.mode === "whatsapp-sent" || delivery.mode === "instagram-sent") {
    return {
      externalMessageId: delivery.messageId?.trim() || undefined,
      deliveryStatus: "sent" as const,
      deliveryError: undefined,
    };
  }

  if (delivery.mode === "local-only") {
    return {
      deliveryStatus: "failed" as const,
      deliveryError:
        normalizeConversationDeliveryError(delivery.error) ||
        "Message stayed local and was not delivered to the customer channel.",
    };
  }

  if (delivery.mode === "whatsapp-failed" || delivery.mode === "instagram-failed") {
    return {
      deliveryStatus: "failed" as const,
      deliveryError:
        normalizeConversationDeliveryError(delivery.error) ||
        (delivery.mode === "instagram-failed"
          ? "Instagram could not deliver this message to the customer."
          : "WhatsApp could not deliver this message to the customer."),
    };
  }

  return {
    externalMessageId: undefined,
    deliveryStatus: undefined,
    deliveryError: undefined,
  };
}

function normalizeWhatsAppMessageDeliveryStatus(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "read") {
    return "read" as const;
  }
  if (normalized === "delivered") {
    return "delivered" as const;
  }
  if (normalized === "sent") {
    return "sent" as const;
  }
  return null;
}

function updateConversationMessageMeta(
  conversationId: string,
  input: {
    messageId: string;
    externalMessageId?: string;
    deliveryStatus?: DummyConversationMessage["deliveryStatus"];
    deliveryError?: string;
  },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const normalizedMessageId = input.messageId.trim();
  if (!normalizedMessageId) {
    return conversation;
  }

  let changed = false;
  const nextMessages = conversation.messages.map((message) => {
    if (message.id !== normalizedMessageId) {
      return message;
    }

    const nextExternalMessageId = input.externalMessageId?.trim() || message.externalMessageId;
    const nextDeliveryStatus = resolveConversationMessageDeliveryStatus(message.deliveryStatus, input.deliveryStatus);
    const normalizedDeliveryError = normalizeConversationDeliveryError(input.deliveryError);
    const nextDeliveryError =
      nextDeliveryStatus === "failed"
        ? normalizedDeliveryError || message.deliveryError || "WhatsApp could not deliver this message to the customer."
        : input.deliveryStatus
          ? undefined
          : normalizedDeliveryError !== undefined
            ? normalizedDeliveryError
            : message.deliveryError;

    if (
      nextExternalMessageId === message.externalMessageId &&
      nextDeliveryStatus === message.deliveryStatus &&
      nextDeliveryError === message.deliveryError
    ) {
      return message;
    }

    changed = true;
    return {
      ...message,
      externalMessageId: nextExternalMessageId,
      deliveryStatus: nextDeliveryStatus,
      deliveryError: nextDeliveryError,
    };
  });

  if (!changed) {
    return conversation;
  }

  conversations[index] = {
    ...conversation,
    messages: nextMessages,
    updatedAt: nowIso(),
  };
  dummyPlatformMemory.conversations = conversations;
  return conversations[index];
}

function updateConversationMessageDeliveryByExternalId(
  tenantId: string,
  externalMessageId: string,
  deliveryStatus?: DummyConversationMessage["deliveryStatus"],
) {
  const normalizedExternalMessageId = externalMessageId.trim();
  if (!normalizedExternalMessageId || !deliveryStatus) {
    return null;
  }

  const conversationIndex = conversations.findIndex(
    (conversation) =>
      conversation.tenantId === tenantId &&
      conversation.messages.some((message) => whatsappMessageIdsMatch(message.externalMessageId, normalizedExternalMessageId)),
  );

  if (conversationIndex === -1) {
    return null;
  }

  const conversation = conversations[conversationIndex];
  let changed = false;
  const nextMessages = conversation.messages.map((message) => {
    if (!whatsappMessageIdsMatch(message.externalMessageId, normalizedExternalMessageId)) {
      return message;
    }

    if (getDeliveryStatusRank(deliveryStatus) <= getDeliveryStatusRank(message.deliveryStatus)) {
      return message;
    }

    changed = true;
    return {
      ...message,
      deliveryStatus,
      deliveryError: deliveryStatus === "failed" ? message.deliveryError : undefined,
    };
  });

  if (!changed) {
    return conversation;
  }

  conversations[conversationIndex] = {
    ...conversation,
    messages: nextMessages,
    updatedAt: nowIso(),
  };
  dummyPlatformMemory.conversations = conversations;
  return conversations[conversationIndex];
}

function parseListValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value;
  }

  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFaq(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "object" && entry && "question" in entry && "answer" in entry) {
          return {
            question: String(entry.question ?? "").trim(),
            answer: String(entry.answer ?? "").trim(),
          };
        }
        return null;
      })
      .filter((entry): entry is DummyServiceFaq => Boolean(entry?.question && entry?.answer));
  }

  return parseListValue(typeof value === "string" ? value : "")
    .map((line) => {
      const [question, ...answerParts] = line.split("|");
      return {
        question: question?.trim() ?? "",
        answer: answerParts.join("|").trim(),
      };
    })
    .filter((entry) => entry.question && entry.answer);
}

export function listFreelancerServices(ownerId = "editor-testingfreelancer") {
  return services.filter((service) => service.ownerId === ownerId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function listPendingServiceReviews() {
  return services.filter((service) => service.status === "Pending Review").sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function listPublicServices() {
  return services.filter((service) => canServiceBePublic(service)).map(enrichPublicService);
}

export function getPublicCatalogStats() {
  const publicServices = listPublicServices();
  const owners = new Set(publicServices.map((service) => service.ownerId));

  return {
    totalEditors: owners.size,
    totalServices: publicServices.length,
    videoEditors: new Set(publicServices.filter((service) => service.category === "Video Editing").map((service) => service.ownerId)).size,
    designEditors: new Set(publicServices.filter((service) => service.category === "Graphic Design").map((service) => service.ownerId)).size,
  };
}

export function getServiceById(serviceId: string) {
  return services.find((service) => service.id === serviceId) ?? null;
}

export function getServiceBySlug(slug: string, includeNonPublic = false) {
  return services.find((service) => service.slug === slug && (includeNonPublic || canServiceBePublic(service))) ?? null;
}

export function upsertFreelancerService(input: Partial<UpsertServiceInput> & { id?: string; ownerId?: string }) {
  const owner = getServiceOwner(input.ownerId ?? "editor-testingfreelancer");
  const faq = parseFaq(input.faq);
  const timestamp = nowIso();

  const payload: UpsertServiceInput = {
    title: String(input.title ?? "").trim(),
    summary: String(input.summary ?? "").trim(),
    category: (input.category as UpsertServiceInput["category"]) ?? "Video Editing",
    specialty: String(input.specialty ?? "").trim() || "Creator service",
    primaryEditorCategory: String(input.primaryEditorCategory ?? input.specialty ?? "").trim(),
    secondaryEditorCategories: Array.isArray(input.secondaryEditorCategories)
      ? input.secondaryEditorCategories.map((item) => String(item).trim()).filter(Boolean).slice(0, 2)
      : [],
    description: String(input.description ?? "").trim(),
    targetAudience: String(input.targetAudience ?? "").trim() || "Creators and agencies",
    deliveryTime: String(input.deliveryTime ?? "").trim() || "2 Days",
    revisions: String(input.revisions ?? "").trim() || "2 revisions included",
    basePrice: Number(input.basePrice ?? 0),
    tags: parseListValue(input.tags),
    seoTitle: String(input.seoTitle ?? input.title ?? "").trim(),
    seoDescription: String(input.seoDescription ?? input.summary ?? "").trim(),
    seoKeywords: parseListValue(input.seoKeywords ?? input.tags),
    deliverables: parseListValue(input.deliverables),
    faq: faq.length
      ? faq
      : [
          { question: "What is included in the base price?", answer: "Base delivery includes the core edit/package listed in the service overview." },
          { question: "Can this scale into repeat work?", answer: "Yes. Repeat workflows can be discussed once the first delivery scope is approved." },
        ],
  };

  if (input.id) {
    services = services.map((service) =>
      service.id === input.id
        ? {
            ...service,
            ...payload,
            slug: slugify(payload.title || service.title),
            listingEnabled: service.listingEnabled ?? true,
            availability: service.availability ?? (service.status === "Paused" ? "PAUSED" : "ACTIVE"),
            updatedAt: timestamp,
          }
        : service,
    );
    dummyPlatformMemory.services = services;
    return getServiceById(input.id);
  }

  const service: DummyService = {
    id: makeId("svc"),
    slug: slugify(payload.title || `draft-${timestamp}`),
    ownerId: owner.id,
    ownerName: owner.name,
    ownerAlias: owner.publicAlias,
    media: createMedia(makeId("media"), {
      sampleVideoUrl: String(input.sampleVideoUrl ?? "").trim(),
      sampleVideoEmbedUrl: String(input.sampleVideoEmbedUrl ?? "").trim(),
    }),
    currency: "INR",
    status: "Draft",
    listingEnabled: true,
    availability: "ACTIVE",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...payload,
  };

  services = [service, ...services];
  dummyPlatformMemory.services = services;
  return service;
}

export function submitServiceForReview(serviceId: string) {
  services = services.map((service) =>
    service.id === serviceId
      ? {
          ...service,
          status: "Pending Review",
          listingEnabled: true,
          availability: "ACTIVE",
          reviewNote: "Submitted for manager/admin review.",
          updatedAt: nowIso(),
        }
      : service,
  );
  dummyPlatformMemory.services = services;

  return getServiceById(serviceId);
}

export function reviewService(serviceId: string, action: "approve" | "reject", note?: string) {
  services = services.map((service) =>
    service.id === serviceId
      ? {
          ...service,
          status: action === "approve" ? "Approved" : "Rejected",
          availability: action === "approve" ? "ACTIVE" : service.availability ?? "ACTIVE",
          listingEnabled: action === "approve" ? service.listingEnabled ?? true : service.listingEnabled,
          reviewNote:
            note?.trim() ||
            (action === "approve" ? "Approved for public discovery and service detail page." : "Needs revision before it can be published."),
          updatedAt: nowIso(),
        }
      : service,
  );
  dummyPlatformMemory.services = services;

  return getServiceById(serviceId);
}

export function setFreelancerServiceAvailability(
  serviceId: string,
  input: {
    listingEnabled?: boolean;
    availability?: "ACTIVE" | "PAUSED";
  },
) {
  services = services.map((service) => {
    if (service.id !== serviceId) {
      return service;
    }

    const nextListingEnabled = input.listingEnabled ?? service.listingEnabled ?? true;
    const nextAvailability = input.availability ?? service.availability ?? (service.status === "Paused" ? "PAUSED" : "ACTIVE");
    const shouldPause = nextAvailability === "PAUSED";
    const nextStatus =
      shouldPause
        ? "Paused"
        : service.status === "Paused"
          ? "Approved"
          : service.status;

    return {
      ...service,
      listingEnabled: nextListingEnabled,
      availability: nextAvailability,
      status: nextStatus,
      reviewNote:
        shouldPause
          ? "Paused by freelancer from listing controls."
          : nextListingEnabled
            ? service.reviewNote
            : "Listing is turned off by freelancer and hidden from discovery.",
      updatedAt: nowIso(),
    };
  });
  dummyPlatformMemory.services = services;
  return getServiceById(serviceId);
}

export function listConversationsForAudience(
  audience: DummyConversationRole,
  options?: {
    freelancerId?: string;
    freelancerIds?: string[];
    freelancerNames?: string[];
    customerId?: string;
    activeAgencyIds?: string[];
    tenantId?: string;
    includeSupportData?: boolean;
    conversationId?: string;
    limit?: number;
  },
): DummyConversationListResponse {
  expireStaleConversationOffers();
  const normalizeAssignmentKey = (value: string | null | undefined) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const relevant = conversations
    .map((conversation, index) => normalizeConversation({ ...conversation, typing: cleanupTyping(conversation.typing) }, index))
    .filter((conversation) => {
      if (audience === "freelancer") {
        const freelancerId = options?.freelancerId ?? "editor-testingfreelancer";
        const freelancerIds = options?.freelancerIds?.length ? options.freelancerIds : [freelancerId];
        const freelancerNames = options?.freelancerNames?.length ? options.freelancerNames : [];
        const matchesFreelancer =
          freelancerIds.includes(conversation.assignedFreelancerId ?? "") ||
          freelancerNames.some(
            (name) => normalizeAssignmentKey(name) && normalizeAssignmentKey(name) === normalizeAssignmentKey(conversation.assignedFreelancerName),
          );
        const matchesCollaborator = Boolean(
          getMatchingFreelancerCollaborator(conversation, freelancerIds, freelancerNames),
        );
        const matchingOffer = getMatchingAssignmentOffer(conversation, freelancerIds, freelancerNames);
        const hasUnreadOfferOutcome = getUnreadMessages(conversation, "freelancer").some(
          (message) => message.lane === "internal" && isAutomatedAssignmentOutcomeMessageBody(message.body),
        );
        const offerKeepsConversationVisible = Boolean(
          matchingOffer &&
            (matchingOffer.status === "PENDING" || matchingOffer.status === "ACCEPTED" || hasUnreadOfferOutcome),
        );
        // Explicit project access is sufficient. General-marketplace editors
        // can receive or accept one project without joining the agency Team.
        return Boolean(matchesFreelancer || matchesCollaborator || offerKeepsConversationVisible);
      }

      if (audience === "customer") {
        return conversation.customerId === (options?.customerId ?? "customer-demo");
      }

      if (audience === "sales") {
        const targetTenant = options?.tenantId?.trim();
        const matchesTenant =
          !targetTenant ||
          conversation.tenantId === targetTenant ||
          (targetTenant.startsWith("tenant-gigxomi-sales-agent-") &&
            (conversation.tenantId === "tenant-gigxomi" || conversation.tenantId === targetTenant));
        if (!matchesTenant) {
          return false;
        }
        const sourceChannel = normalizeConversationSourceChannel(conversation);
        if (sourceChannel === "instagram") {
          const igConnection = getInstagramConnectionState(targetTenant);
          return Boolean(
            igConnection?.pluginEnabled &&
              (igConnection.status === "Connected" || igConnection.status === "Ready for webhook"),
          );
        }
        if (sourceChannel === "whatsapp") {
          const waConnection = getWhatsAppConnectionState(targetTenant);
          const hasCloudApi = Boolean(
            waConnection &&
              (waConnection.status === "Number connected" || waConnection.status === "Ready for webhook") &&
              (waConnection.phoneNumberId?.trim() || waConnection.wabaId?.trim()),
          );
          if (hasCloudApi || conversation.serviceId === "svc-manual-chat" || conversation.isInAppCustomerThread) {
            return true;
          }
          return false;
        }
        return true;
      }

      if (options?.tenantId?.trim()) {
        return conversation.tenantId === options.tenantId.trim();
      }

      return true;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const freelancerAliasKeys =
    audience === "freelancer"
      ? Array.from(new Set([options?.freelancerId, ...(options?.freelancerIds ?? [])].filter(Boolean))) as string[]
      : [];

  const MAX_CONVERSATIONS = options?.limit ?? (audience === "sales" ? 1000 : 150);
  const targetId = options?.conversationId?.trim();
  let targetConversation: DummyConversation | undefined;
  if (targetId) {
    targetConversation = relevant.find((c) => c.id === targetId);
  }
  const topConversations = relevant.slice(0, MAX_CONVERSATIONS);
  if (targetConversation && !topConversations.some((c) => c.id === targetId)) {
    topConversations.unshift(targetConversation);
  }

  return {
    conversations: topConversations.map((conversation) =>
      projectConversation(conversation, audience, { freelancerAliasKeys, freelancerNames: options?.freelancerNames }),
    ),
    assignableEditors:
      options?.includeSupportData !== false && (audience === "manager" || audience === "admin")
        ? editorPerformanceProfiles
            .filter((editor) => canAssignEditorToTenant(editor.id, options?.tenantId))
            .map((editor) => {
              const availability = getEditorAvailability(editor.id);
              return {
                id: editor.id,
                name: editor.name,
                specialties: editor.specialties,
                workloadBand: editor.workloadBand,
                karmaScore: editor.karma.score,
                onlineStatus: availability.onlineStatus,
                acceptingProjects: availability.acceptingProjects,
                lastOnlineAt: availability.lastOnlineAt,
              };
            })
        : [],
    leadStatuses:
      (leadStatuses && leadStatuses.length > 0)
        ? leadStatuses.filter((status) => status.active).sort((left, right) => left.order - right.order)
        : crmStatuses.map((status) => ({ id: status.id, label: status.label, tone: status.tone, order: status.order, active: status.active })),
    templates: options?.includeSupportData !== false ? conversationTemplates : [],
  } satisfies DummyConversationListResponse;
}

export function setEditorProjectAvailability(
  editorId: string,
  input: { onlineStatus?: "online" | "offline"; acceptingProjects?: boolean },
) {
  const normalizedEditorId = editorId.trim();
  if (!normalizedEditorId) {
    return null;
  }

  const updatedAt = nowIso();
  const existing = getEditorAvailability(normalizedEditorId);
  const next: DummyEditorAvailability = {
    ...existing,
    onlineStatus: input.onlineStatus ?? existing.onlineStatus,
    acceptingProjects: input.acceptingProjects ?? existing.acceptingProjects,
    lastOnlineAt: input.onlineStatus === "online" ? updatedAt : existing.lastOnlineAt,
    updatedAt,
  };

  const existingIndex = editorAvailability.findIndex((item) => item.editorId === normalizedEditorId);
  editorAvailability =
    existingIndex >= 0
      ? editorAvailability.map((item) => (item.editorId === normalizedEditorId ? next : item))
      : [next, ...editorAvailability];
  dummyPlatformMemory.editorAvailability = editorAvailability;
  return next;
}

export function listEditorProjectAvailability() {
  return editorPerformanceProfiles.map((editor) => getEditorAvailability(editor.id));
}

export function createCustomerConversation(input: {
  serviceId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  message?: string;
}) {
  const service = getServiceById(input.serviceId);
  if (!service) {
    return null;
  }

  const createdAt = nowIso();
  const conversation: DummyConversation = {
    id: makeId("conv"),
    contactId: makeId("contact"),
    serviceId: service.id,
    serviceSlug: service.slug,
    serviceTitle: service.title,
    customerId: input.customerId ?? "customer-demo",
    customerName: input.customerName?.trim() || "Test Customer",
    customerPhone: input.customerPhone?.trim() || "+91 99999 99999",
    maskedCustomerName: formatCustomerAlias(conversations.length + 3),
    tenantId: "tenant-gigxomi",
    status: "New",
    leadStatusId: "new",
    summary: input.message?.trim() || `Interested in ${service.title}`,
    internalNotes: "",
    ownerRole: "manager",
    ownerName: "Rahul Manager",
    readStateByAudience: {
      customer: createdAt,
    },
    lastCustomerActivityAt: createdAt,
    isInAppCustomerThread: true,
    latestPaymentRequestId: undefined,
    paymentRequests: [],
    messages: [
      {
        id: makeId("msg"),
        lane: "customer",
        senderRole: "customer",
        senderLabel: input.customerName?.trim() || "Test Customer",
        body: input.message?.trim() || `Hi, I want to discuss ${service.title}.`,
        createdAt,
      },
    ],
    typing: [],
    createdAt,
    updatedAt: createdAt,
  };

  conversations = [normalizeConversation(conversation, conversations.length), ...conversations];
  dummyPlatformMemory.conversations = conversations;
  return conversation;
}

function createMessageAttachments(
  conversation: DummyConversation,
  senderRole: DummyConversationRole,
  senderLabel: string,
  attachments: DummyMessageAttachmentInput[] = [],
) {
  if (!attachments.length) {
    return [];
  }

  return attachments.map((attachment) => {
    const kind = classifyAttachmentKind(attachment);
    const mimeType = String(attachment.mimeType ?? "application/octet-stream").trim() || "application/octet-stream";
    const sizeLabel = kind === "voice-note" ? formatDurationLabel(attachment.durationSeconds) : formatBytes(attachment.sizeBytes);

    if (attachment.uploadTarget === "youtube") {
      const connection = getYouTubeConnectionState(conversation.tenantId);
      const playlistPrefix = connection?.defaultPlaylistPrefix?.trim() || "Client Delivery";
      const playlistName = `${playlistPrefix} - ${conversation.customerName}`;
      const isReady = connection?.status === "Upload ready";
      const uploadId = makeId("yt-upload");
      const shareUrl = isReady ? `https://youtu.be/${uploadId.replace("yt-upload-", "")}` : "";
      const note = isReady
        ? `${connection?.channelName || "Agency channel"} upload recorded as ${connection?.defaultPrivacy || "unlisted"} in ${playlistName}.`
        : "YouTube setup is not fully ready yet. This upload is queued in dummy mode.";

      youtubeUploads = [
        {
          id: uploadId,
          tenantId: conversation.tenantId,
          conversationId: conversation.id,
          customerName: conversation.customerName,
          playlistName,
          title: `${conversation.customerName} - ${attachment.name}`,
          fileName: attachment.name,
          mimeType,
          uploadedByRole: senderRole,
          uploadedByLabel: senderLabel,
          privacy: connection?.defaultPrivacy ?? "unlisted",
          status: isReady ? "Uploaded" : "Queued",
          shareUrl,
          createdAt: nowIso(),
        },
        ...youtubeUploads,
      ];
      dummyPlatformMemory.youtubeUploads = youtubeUploads;

      if (connection) {
        updateYouTubeConnectionState(conversation.tenantId, {
          lastUploadAt: nowIso(),
          lastPlaylistName: playlistName,
          lastError: isReady ? "" : "YouTube setup is not fully ready yet. Uploads are queued locally.",
        });
      }

      return {
        id: makeId("att"),
        kind: "youtube-upload" as const,
        target: "youtube" as const,
        name: attachment.name,
        mimeType,
        sizeLabel: formatBytes(attachment.sizeBytes),
        note: attachment.note?.trim() || note,
        collectionName: playlistName,
        externalUrl: shareUrl || undefined,
      };
    }

    return {
      id: makeId("att"),
      kind,
      target: "local" as const,
      name: attachment.name,
      mimeType,
      sizeLabel,
      durationLabel: kind === "voice-note" ? formatDurationLabel(attachment.durationSeconds) : undefined,
      externalUrl: attachment.externalUrl,
      note:
        attachment.note?.trim() ||
        (kind === "voice-note"
          ? "Recorded locally in the routed inbox."
          : kind === "video"
            ? "Stored in the dummy chat flow."
            : undefined),
    };
  });
}

function getConversationMessageSenderLabel(
  conversation: DummyConversation,
  role: DummyConversationRole,
  _lane: DummyConversationLane,
) {
  void _lane;
  if (role === "freelancer") {
    return conversation.assignedFreelancerName || "Freelancer";
  }
  if (role === "admin") {
    return "Gigxomi Studio";
  }
  if (role === "manager") {
    return conversation.ownerName || "Manager";
  }
  return conversation.customerName;
}

export function appendConversationMessage(
  conversationId: string,
  input: {
    role: DummyConversationRole;
    body: string;
    lane: DummyConversationLane;
    visibility?: DummyMessageVisibility;
    clientMessageId?: string;
    externalMessageId?: string;
    deliveryStatus?: DummyConversationMessage["deliveryStatus"];
    deliveryError?: string;
    attachments?: DummyMessageAttachmentInput[];
  },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const createdAt = nowIso();
  const effectiveLane = input.role === "customer" ? "customer" : input.lane;
  const senderLabel = getConversationMessageSenderLabel(conversation, input.role, effectiveLane);
  const attachments = createMessageAttachments(conversation, input.role, senderLabel, input.attachments);
  const visibility =
    input.visibility === "client_private" && (input.role === "admin" || input.role === "manager")
      ? "client_private"
      : undefined;
  const externalMessageId = input.externalMessageId?.trim();
  if (externalMessageId && hasConversationMessageWithExternalId(conversation, externalMessageId)) {
    return conversation;
  }
  const clientMessageId = input.clientMessageId?.trim();
  if (clientMessageId && hasConversationMessageWithClientMessageId(conversation, clientMessageId)) {
    return conversation;
  }

  const nextMessage: DummyConversationMessage = {
    id: makeId("msg"),
    clientMessageId: clientMessageId || undefined,
    lane: effectiveLane,
    senderRole: input.role,
    senderLabel,
    body: input.body.trim(),
    attachments: attachments.length ? attachments : undefined,
    visibility,
    externalMessageId: externalMessageId || undefined,
    deliveryStatus: input.deliveryStatus,
    deliveryError: normalizeConversationDeliveryError(input.deliveryError),
    createdAt,
  };

  const nextStatus =
    input.role === "customer"
      ? conversation.assignedFreelancerId
        ? "Active"
        : "Manager Review"
      : conversation.assignedFreelancerId
        ? "Active"
        : conversation.status;
  const nextReadState = markReadState(conversation.readStateByAudience, input.role, createdAt, effectiveLane);

  conversations[index] = {
    ...conversation,
    status: nextStatus,
    messages: [...conversation.messages, nextMessage],
    typing: conversation.typing.filter((entry) => !(entry.role === input.role && entry.lane === nextMessage.lane)),
    summary: summarizeMessage(nextMessage) || conversation.summary,
    readStateByAudience: nextReadState,
    lastCustomerActivityAt: input.role === "customer" ? createdAt : conversation.lastCustomerActivityAt,
    updatedAt: createdAt,
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;

  return conversations[index];
}

export async function sendConversationReviewFlow(
  conversationId: string,
  input: {
    actorRole: Exclude<DummyConversationRole, "customer" | "sales">;
    actorLabel?: string;
  },
) {
  const conversation = getConversationById(conversationId);
  if (!conversation) {
    return null;
  }

  const actorRole = input.actorRole;
  const canSend =
    actorRole === "admin" ||
    actorRole === "manager" ||
    (actorRole === "freelancer" && Boolean(conversation.freelancerCustomerLaneAccess) && Boolean(conversation.assignedFreelancerId));

  if (!canSend) {
    return {
      conversation,
      delivery: {
        ok: false,
        mode: "local-only" as DummyWhatsAppDeliveryMode,
        error: "This user cannot send a customer review form for this conversation.",
      },
    };
  }

  const delivery = await sendWhatsAppReviewFlow({
    tenantId: conversation.tenantId,
    to: conversation.customerPhone,
    conversationId: conversation.id,
    customerName: conversation.customerName,
    assignedFreelancerId: conversation.assignedFreelancerId,
  });

  const updatedConversation = appendConversationMessage(conversation.id, {
    role: actorRole,
    lane: "customer",
    body: "Review form sent to customer.",
    ...getConversationMessageDeliveryMeta(delivery),
  });

  return {
    conversation: updatedConversation ?? getConversationById(conversation.id) ?? conversation,
    delivery,
  };
}

function recordCustomerReviewFromFlow(input: {
  conversation: DummyConversation;
  rating?: number;
  comment?: string;
  externalMessageId?: string;
}) {
  if (
    input.externalMessageId &&
    customerReviews.some((review) => review.externalMessageId === input.externalMessageId)
  ) {
    return;
  }

  const agencyContext = buildConversationAgencyContext(input.conversation);
  const submittedAt = nowIso();
  const review: DummyCustomerReview = {
    id: makeId("review"),
    conversationId: input.conversation.id,
    tenantId: input.conversation.tenantId,
    agencyName: agencyContext.agencyName,
    editorId: input.conversation.assignedFreelancerId,
    editorName: input.conversation.assignedFreelancerName,
    customerPhone: input.conversation.customerPhone,
    rating: input.rating,
    comment: input.comment,
    sourceFlowId: GIGXOMI_REVIEW_FLOW_ID,
    externalMessageId: input.externalMessageId,
    submittedAt,
  };

  customerReviews = [review, ...customerReviews].slice(0, 500);
  dummyPlatformMemory.customerReviews = customerReviews;
  appendConversationMessage(input.conversation.id, {
    role: "admin",
    lane: "internal",
    body: `Customer review received${review.rating ? `: ${review.rating}/5` : ""}${review.comment ? ` - ${review.comment}` : ""}`,
    externalMessageId: input.externalMessageId ? `${input.externalMessageId}:review-internal` : undefined,
  });
}

export function deleteConversationMessageForEveryone(
  conversationId: string,
  messageId: string,
  input: {
    deletedByRole: DummyConversationRole;
    deletedByUserId: string;
  },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const message = conversation.messages.find((item) => item.id === messageId);
  if (!message) {
    return { error: "message_not_found" as const };
  }

  if (message.deletedAt) {
    return {
      conversation,
      message,
      metaDeleteSupported: Boolean(message.deleteMetaSupported),
      metaDeleteSynced: Boolean(message.deleteMetaSynced),
      metaDeleteNote: message.deleteMetaNote ?? null,
    };
  }

  const deletedAt = nowIso();
  const hasMetaMessage = Boolean(message.externalMessageId?.trim()) || normalizeConversationSourceChannel(conversation) === "whatsapp";
  const metaDeleteNote = hasMetaMessage
    ? "Meta WhatsApp Cloud API does not expose a supported operation to erase an already delivered WhatsApp message from the customer's WhatsApp chat. Gigxomi marked the message deleted in its own database and app views."
    : null;
  const tombstoneBody = "This message was deleted.";
  const nextMessages = conversation.messages.map((item) =>
    item.id === messageId
      ? {
          ...item,
          body: tombstoneBody,
          attachments: undefined,
          deletedAt,
          deletedByRole: input.deletedByRole,
          deletedByUserId: input.deletedByUserId,
          deletedScope: "everyone" as const,
          deleteMetaSupported: !hasMetaMessage,
          deleteMetaSynced: !hasMetaMessage,
          deleteMetaNote: metaDeleteNote ?? undefined,
        }
      : item,
  );

  conversations[index] = {
    ...conversation,
    messages: nextMessages,
    summary: conversation.messages.at(-1)?.id === messageId ? tombstoneBody : conversation.summary,
    updatedAt: deletedAt,
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;

  return {
    conversation: conversations[index],
    message: conversations[index].messages.find((item) => item.id === messageId) ?? null,
    metaDeleteSupported: !hasMetaMessage,
    metaDeleteSynced: !hasMetaMessage,
    metaDeleteNote,
  };
}

export function setConversationTyping(
  conversationId: string,
  input: {
    role: DummyConversationRole;
    lane: DummyConversationLane;
    active: boolean;
  },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const label =
    input.role === "admin"
      ? "Admin"
      : input.role === "manager"
        ? "Manager"
        : input.role === "freelancer"
          ? "Editor"
          : "Customer";

  const effectiveLane = input.lane;
  const remaining = conversation.typing.filter((entry) => !(entry.role === input.role && entry.lane === effectiveLane));

  conversations[index] = {
    ...conversation,
    typing: input.active
      ? [
          ...remaining,
          {
            role: input.role,
            label,
            lane: effectiveLane,
            active: true,
            updatedAt: nowIso(),
          },
        ]
      : remaining,
  };
  dummyPlatformMemory.conversations = conversations;

  return conversations[index];
}

export function assignConversation(
  conversationId: string,
  freelancerId: string | string[],
  assignedBy: "manager" | "admin",
  freelancerNameOverride?: string,
  options?: {
    projectDetails?: string;
    offeredByName?: string;
    freelancerNamesById?: Record<string, string>;
    source?: "manual" | "targeted" | "fallback";
    category?: string;
    allowOfflineEditors?: boolean;
    dispatchRequestId?: string;
    intent?: "primary" | "replacement";
  },
) {
  const index = getConversationIndex(conversationId);
  const freelancerIds = Array.from(new Set((Array.isArray(freelancerId) ? freelancerId : [freelancerId]).map((id) => id.trim()).filter(Boolean)));

  if (index === -1 || !freelancerIds.length) {
    return null;
  }

  const conversation = conversations[index];
  const updatedAt = nowIso();
  const existingOffers = conversation.assignmentOffers ?? [];
  const nextOffers = [...existingOffers];
  const offeredNames: string[] = [];
  let alreadyPending = false;

  for (const id of freelancerIds) {
    const existingIndex = nextOffers.findIndex((offer) => offer.freelancerId === id && offer.status === "PENDING");
    if (existingIndex >= 0) {
      alreadyPending = true;
      continue;
    }
    if (!options?.allowOfflineEditors && !isEditorAcceptingProjects(id)) {
      continue;
    }
    const freelancer = editorPerformanceProfiles.find((editor) => editor.id === id);
    const freelancerName =
      freelancer?.name ??
      options?.freelancerNamesById?.[id]?.trim() ??
      (freelancerIds.length === 1 ? freelancerNameOverride?.trim() : "") ??
      id;
    if (!freelancerName) continue;
    offeredNames.push(freelancerName);
    const offer = {
      id: makeId("offer"),
      dispatchRequestId: options?.dispatchRequestId,
      freelancerId: freelancer?.id ?? id,
      freelancerName,
      projectDetails: options?.projectDetails?.trim() || conversation.internalNotes || conversation.summary || conversation.serviceTitle,
      status: "PENDING" as const,
      offeredByRole: assignedBy,
      offeredByName: options?.offeredByName?.trim() || roleLabel(assignedBy),
      createdAt: updatedAt,
      respondedAt: undefined,
      expiresAt: new Date(new Date(updatedAt).getTime() + PROJECT_OFFER_WINDOW_MS).toISOString(),
      expiredReason: undefined,
      source: options?.source ?? "manual",
      category: options?.category ?? conversation.serviceTitle,
      intent: options?.intent ?? "primary",
    };
    nextOffers.push(offer);
  }

  if (!offeredNames.length) {
    return alreadyPending ? conversation : null;
  }

  const assignmentNote: DummyConversationMessage = {
    id: makeId("msg"),
    lane: "internal",
    senderRole: assignedBy,
    senderLabel: options?.offeredByName?.trim() || roleLabel(assignedBy),
    body: `${options?.intent === "replacement" ? "Primary editor replacement offer" : "Project offer"} sent to ${offeredNames.join(", ")}.\n\n${options?.projectDetails?.trim() || conversation.internalNotes || conversation.summary || conversation.serviceTitle}`,
    createdAt: updatedAt,
  };

  conversations[index] = {
    ...conversation,
    status: conversation.assignedFreelancerId ? conversation.status : "Manager Review",
    assignmentOffers: nextOffers,
    freelancerCustomerLaneAccess: conversation.assignedFreelancerId ? conversation.freelancerCustomerLaneAccess : false,
    freelancerCustomerLaneAccessUpdatedAt: conversation.assignedFreelancerId
      ? conversation.freelancerCustomerLaneAccessUpdatedAt
      : updatedAt,
    freelancerCustomerLaneAccessGrantedByRole: conversation.assignedFreelancerId
      ? conversation.freelancerCustomerLaneAccessGrantedByRole
      : undefined,
    freelancerCustomerLaneAccessGrantedByName: conversation.assignedFreelancerId
      ? conversation.freelancerCustomerLaneAccessGrantedByName
      : undefined,
    ownerRole: assignedBy,
    ownerName: assignedBy === "admin" ? "Gigxomi Studio" : conversation.ownerName || "Rahul Manager",
    messages: [...conversation.messages, assignmentNote],
    updatedAt,
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;

  return conversations[index];
}

export function assignConversationDirectly(
  conversationId: string,
  freelancerId: string,
  assignedBy: "manager" | "admin",
  options?: {
    assignedByName?: string;
    freelancerName?: string;
    projectDetails?: string;
  },
) {
  const index = getConversationIndex(conversationId);
  const normalizedFreelancerId = freelancerId.trim();
  if (index === -1 || !normalizedFreelancerId) {
    return null;
  }

  const conversation = conversations[index];
  const updatedAt = nowIso();
  const profile = editorPerformanceProfiles.find((editor) => editor.id === normalizedFreelancerId);
  const freelancerName = profile?.name ?? options?.freelancerName?.trim() ?? normalizedFreelancerId;
  const previousPrimaryId = conversation.assignedFreelancerId;
  const previousPrimaryName = conversation.assignedFreelancerName;
  const isReplacingPrimary = Boolean(previousPrimaryId && previousPrimaryId !== normalizedFreelancerId);
  const pendingOfferCount = (conversation.assignmentOffers ?? []).filter((offer) => offer.status === "PENDING").length;

  if (previousPrimaryId === normalizedFreelancerId && pendingOfferCount === 0) {
    return conversation;
  }

  const nextCollaborators = [...(conversation.freelancerCollaborators ?? [])].filter(
    (collaborator) => collaborator.freelancerId !== normalizedFreelancerId,
  );
  if (
    isReplacingPrimary &&
    previousPrimaryId &&
    !nextCollaborators.some((collaborator) => collaborator.freelancerId === previousPrimaryId)
  ) {
    nextCollaborators.push({
      freelancerId: previousPrimaryId,
      freelancerName: previousPrimaryName || previousPrimaryId,
      addedAt: updatedAt,
      addedByRole: assignedBy,
      addedByName: options?.assignedByName?.trim() || roleLabel(assignedBy),
    });
  }

  const projectDetails = options?.projectDetails?.trim() || buildProjectDetailsFromIntake(conversation);
  const auditParts = [
    `${options?.assignedByName?.trim() || roleLabel(assignedBy)} manually assigned ${freelancerName} as the primary editor. Offer acceptance was skipped and reply access is active immediately.`,
  ];
  if (isReplacingPrimary) {
    auditParts.push(`${previousPrimaryName || "The previous primary editor"} now has read-only lane access.`);
  }
  if (pendingOfferCount) {
    auditParts.push(`${pendingOfferCount} pending project offer${pendingOfferCount === 1 ? " was" : "s were"} withdrawn.`);
  }
  if (projectDetails) {
    auditParts.push(`Project details:\n${projectDetails}`);
  }

  const assignmentNote: DummyConversationMessage = {
    id: makeId("msg"),
    lane: "internal",
    senderRole: assignedBy,
    senderLabel: options?.assignedByName?.trim() || roleLabel(assignedBy),
    body: auditParts.join("\n\n"),
    createdAt: updatedAt,
  };

  conversations[index] = {
    ...conversation,
    status: "Assigned",
    leadStatusId: "assigned",
    assignedFreelancerId: profile?.id ?? normalizedFreelancerId,
    assignedFreelancerName: freelancerName,
    freelancerCollaborators: nextCollaborators,
    assignmentOffers: (conversation.assignmentOffers ?? []).map((offer) =>
      offer.status === "PENDING"
        ? { ...offer, status: "EXPIRED" as const, respondedAt: updatedAt, expiredReason: "manual" as const }
        : offer,
    ),
    freelancerCustomerLaneAccess: isReplacingPrimary ? conversation.freelancerCustomerLaneAccess : false,
    freelancerCustomerLaneAccessUpdatedAt: isReplacingPrimary ? conversation.freelancerCustomerLaneAccessUpdatedAt : updatedAt,
    freelancerCustomerLaneAccessGrantedByRole: isReplacingPrimary
      ? conversation.freelancerCustomerLaneAccessGrantedByRole
      : undefined,
    freelancerCustomerLaneAccessGrantedByName: isReplacingPrimary
      ? conversation.freelancerCustomerLaneAccessGrantedByName
      : undefined,
    ownerRole: assignedBy,
    ownerName: assignedBy === "admin" ? "Gigxomi Studio" : conversation.ownerName || "Rahul Manager",
    messages: [...conversation.messages, assignmentNote],
    readStateByAudience: markReadState(conversation.readStateByAudience, assignedBy, updatedAt, "internal"),
    updatedAt,
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;

  return conversations[index];
}

export function addConversationFreelancerCollaborators(
  conversationId: string,
  freelancerIds: string[],
  addedBy: "manager" | "admin",
  options?: {
    addedByName?: string;
    freelancerNamesById?: Record<string, string>;
  },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  if (!conversation.assignedFreelancerId) {
    return { error: "Assign a primary editor before adding lane viewers." } as const;
  }

  const updatedAt = nowIso();
  const existing = conversation.freelancerCollaborators ?? [];
  const nextCollaborators = [...existing];
  const addedNames: string[] = [];
  for (const rawId of Array.from(new Set(freelancerIds.map((value) => value.trim()).filter(Boolean)))) {
    if (rawId === conversation.assignedFreelancerId || nextCollaborators.some((item) => item.freelancerId === rawId)) {
      continue;
    }
    const profile = editorPerformanceProfiles.find((editor) => editor.id === rawId);
    const freelancerName = profile?.name ?? options?.freelancerNamesById?.[rawId]?.trim() ?? rawId;
    nextCollaborators.push({
      freelancerId: profile?.id ?? rawId,
      freelancerName,
      addedAt: updatedAt,
      addedByRole: addedBy,
      addedByName: options?.addedByName?.trim() || roleLabel(addedBy),
    });
    addedNames.push(freelancerName);
  }

  if (!addedNames.length) {
    return conversation;
  }

  const collaboratorNote: DummyConversationMessage = {
    id: makeId("msg"),
    lane: "internal",
    senderRole: addedBy,
    senderLabel: options?.addedByName?.trim() || roleLabel(addedBy),
    body: `${addedNames.join(", ")} added as read-only project viewer${addedNames.length === 1 ? "" : "s"}. Only ${conversation.assignedFreelancerName || "the primary editor"} can reply.`,
    createdAt: updatedAt,
  };

  conversations[index] = {
    ...conversation,
    freelancerCollaborators: nextCollaborators,
    messages: [...conversation.messages, collaboratorNote],
    updatedAt,
  };
  dummyPlatformMemory.conversations = conversations;
  return conversations[index];
}

export function updateConversationAiAutoReply(
  conversationId: string,
  disabled: boolean,
  updatedByRole: "closer" | "admin" | "manager" | "system" = "closer",
  updatedByName?: string,
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }
  const updatedAt = nowIso();
  const actorLabel = updatedByName || (updatedByRole === "closer" ? "Closer" : roleLabel(updatedByRole === "system" ? "admin" : updatedByRole));
  const note: DummyConversationMessage = {
    id: makeId("msg"),
    lane: "internal",
    senderRole: updatedByRole === "closer" ? "admin" : updatedByRole === "system" ? "admin" : updatedByRole,
    senderLabel: actorLabel,
    body: disabled
      ? `🤖 AI Auto-Reply was paused by ${actorLabel}. Thread is now in Human Mode.`
      : `🤖 AI Auto-Reply was resumed by ${actorLabel}. AI Sales Consultant will respond to incoming messages.`,
    createdAt: updatedAt,
  };
  conversations[index] = {
    ...conversations[index],
    aiAutoReplyDisabled: disabled,
    aiAutoReplyDisabledUpdatedAt: updatedAt,
    aiAutoReplyDisabledByRole: updatedByRole,
    aiAutoReplyDisabledByName: actorLabel,
    messages: [...conversations[index].messages, note],
    updatedAt,
  };
  dummyPlatformMemory.conversations = conversations;
  return conversations[index];
}

export function unassignConversationEditors(
  conversationId: string,
  removedBy: "manager" | "admin",
  options?: { removedByName?: string },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const updatedAt = nowIso();
  const removedPrimaryId = conversation.assignedFreelancerId;
  const removedPrimaryName = conversation.assignedFreelancerName;
  const removedViewerCount = (conversation.freelancerCollaborators ?? []).length;
  const pendingOfferCount = (conversation.assignmentOffers ?? []).filter((offer) => offer.status === "PENDING").length;
  const hasEditorAccess = Boolean(removedPrimaryId || removedViewerCount || pendingOfferCount);

  if (!hasEditorAccess) {
    return conversation;
  }

  const removalNote: DummyConversationMessage = {
    id: makeId("msg"),
    lane: "internal",
    senderRole: removedBy,
    senderLabel: options?.removedByName?.trim() || roleLabel(removedBy),
    body: `${removedPrimaryName || "The assigned editor"} was removed. This project is now unassigned.${
      removedViewerCount ? ` ${removedViewerCount} read-only viewer${removedViewerCount === 1 ? " was" : "s were"} also removed.` : ""
    }${pendingOfferCount ? ` ${pendingOfferCount} pending offer${pendingOfferCount === 1 ? " was" : "s were"} withdrawn.` : ""}`,
    createdAt: updatedAt,
  };

  conversations[index] = {
    ...conversation,
    status: "Manager Review",
    leadStatusId: conversation.leadStatusId === "assigned" ? "new" : conversation.leadStatusId,
    assignedFreelancerId: undefined,
    assignedFreelancerName: undefined,
    freelancerCollaborators: [],
    assignmentOffers: (conversation.assignmentOffers ?? []).map((offer) =>
      offer.status === "PENDING"
        ? { ...offer, status: "EXPIRED" as const, respondedAt: updatedAt, expiredReason: "manual" as const }
        : offer,
    ),
    freelancerCustomerLaneAccess: false,
    freelancerCustomerLaneAccessUpdatedAt: updatedAt,
    freelancerCustomerLaneAccessGrantedByRole: undefined,
    freelancerCustomerLaneAccessGrantedByName: undefined,
    messages: [...conversation.messages, removalNote],
    updatedAt,
  };
  syncContactFromConversation(conversations[index], { clearAssignedFreelancerId: removedPrimaryId });
  dummyPlatformMemory.conversations = conversations;

  return conversations[index];
}

export function respondToConversationAssignment(
  conversationId: string,
  input: {
    action: "ACCEPT" | "PASS";
    actorRole: "admin" | "manager" | "freelancer";
    actorName: string;
    actorUserId?: string;
    actorCandidateIds?: string[];
    actorCandidateNames?: string[];
    rejectionReason?: string;
  },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const updatedAt = nowIso();
  const candidateIds = Array.from(new Set([input.actorUserId, ...(input.actorCandidateIds ?? [])].filter(Boolean))) as string[];
  const candidateNames = Array.from(new Set([input.actorName, ...(input.actorCandidateNames ?? [])].filter(Boolean))) as string[];
  const offer = getMatchingAssignmentOffer(conversation, candidateIds, candidateNames);
  if (input.actorRole === "freelancer" && !offer) {
    return { error: "This project offer is not assigned to your editor account." } as const;
  }
  if (input.actorRole === "freelancer" && offer?.status !== "PENDING") {
    return { error: "This project offer has already been responded to." } as const;
  }
  if (input.actorRole === "freelancer" && offer?.expiresAt && new Date(offer.expiresAt).getTime() <= Date.now()) {
    return { error: "This project offer has expired." } as const;
  }
  const isReplacementAcceptance =
    input.action === "ACCEPT" && offer?.intent === "replacement" && Boolean(conversation.assignedFreelancerId);
  if (
    input.action === "ACCEPT" &&
    conversation.assignedFreelancerId &&
    conversation.assignedFreelancerId !== offer?.freelancerId &&
    !isReplacementAcceptance
  ) {
    return { error: "Another editor has already accepted this project." } as const;
  }
  const rejectionReason = input.rejectionReason?.trim() ?? "";
  if (input.action === "PASS" && !rejectionReason) {
    return { error: "Please add a rejection reason before rejecting this project." } as const;
  }

  const responseName = offer?.freelancerName || input.actorName;
  const nextOffers = (conversation.assignmentOffers ?? []).map((item) => {
    if (offer && item.id === offer.id) {
      return { ...item, status: input.action === "ACCEPT" ? ("ACCEPTED" as const) : ("PASSED" as const), respondedAt: updatedAt };
    }
    if (input.action === "ACCEPT" && item.status === "PENDING") {
      return { ...item, status: "EXPIRED" as const, respondedAt: updatedAt, expiredReason: "accepted_by_other" as const };
    }
    return item;
  });
  const intakeDetails = input.action === "ACCEPT" ? buildProjectDetailsFromIntake(conversation) : "";
  const nextAssignedFreelancerId =
    input.action === "ACCEPT" ? offer?.freelancerId ?? conversation.assignedFreelancerId : conversation.assignedFreelancerId;
  const nextCollaborators = [...(conversation.freelancerCollaborators ?? [])].filter(
    (collaborator) => collaborator.freelancerId !== nextAssignedFreelancerId,
  );
  if (
    isReplacementAcceptance &&
    conversation.assignedFreelancerId &&
    !nextCollaborators.some((collaborator) => collaborator.freelancerId === conversation.assignedFreelancerId)
  ) {
    nextCollaborators.push({
      freelancerId: conversation.assignedFreelancerId,
      freelancerName: conversation.assignedFreelancerName || conversation.assignedFreelancerId,
      addedAt: updatedAt,
      addedByRole: offer?.offeredByRole ?? "admin",
      addedByName: offer?.offeredByName || "Gigxomi Studio",
    });
  }
  const responseNote: DummyConversationMessage = {
    id: makeId("msg"),
    lane: "internal",
    senderRole: input.actorRole,
    senderLabel: input.actorName || roleLabel(input.actorRole),
    body:
      input.action === "ACCEPT"
        ? isReplacementAcceptance
          ? `${responseName} accepted the replacement offer and is now the primary editor. ${conversation.assignedFreelancerName || "The previous primary editor"} now has read-only access.${intakeDetails ? `\n\nProject details:\n${intakeDetails}` : ""}`
          : `${responseName} accepted this project. Chat access is now assigned to ${responseName}.${intakeDetails ? `\n\nProject details:\n${intakeDetails}` : ""}`
        : `${responseName} rejected this project offer.\n\nReason: ${rejectionReason}`,
    createdAt: updatedAt,
  };

  conversations[index] = {
    ...conversation,
    status: input.action === "ACCEPT" ? "Assigned" : conversation.status,
    leadStatusId: input.action === "ACCEPT" ? "assigned" : conversation.leadStatusId,
    assignedFreelancerId: nextAssignedFreelancerId,
    assignedFreelancerName: input.action === "ACCEPT" ? responseName : conversation.assignedFreelancerName,
    freelancerCollaborators: input.action === "ACCEPT" ? nextCollaborators : conversation.freelancerCollaborators,
    assignmentOffers: nextOffers,
    freelancerCustomerLaneAccess:
      input.action === "ACCEPT" && !isReplacementAcceptance ? false : conversation.freelancerCustomerLaneAccess,
    freelancerCustomerLaneAccessUpdatedAt:
      input.action === "ACCEPT" && !isReplacementAcceptance ? updatedAt : conversation.freelancerCustomerLaneAccessUpdatedAt,
    freelancerCustomerLaneAccessGrantedByRole:
      input.action === "ACCEPT" && !isReplacementAcceptance ? undefined : conversation.freelancerCustomerLaneAccessGrantedByRole,
    freelancerCustomerLaneAccessGrantedByName:
      input.action === "ACCEPT" && !isReplacementAcceptance ? undefined : conversation.freelancerCustomerLaneAccessGrantedByName,
    messages: [...conversation.messages, responseNote],
    readStateByAudience: markReadState(conversation.readStateByAudience, input.actorRole, updatedAt, "internal"),
    updatedAt,
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;

  return conversations[index];
}

export function expireStaleConversationOffers(conversationId?: string) {
  const now = Date.now();
  const updatedAt = nowIso();
  let changed = false;
  conversations = conversations.map((conversation) => {
    if (conversationId && conversation.id !== conversationId) {
      return conversation;
    }
    const offers = conversation.assignmentOffers ?? [];
    if (!offers.some((offer) => offer.status === "PENDING" && offer.expiresAt && new Date(offer.expiresAt).getTime() <= now)) {
      return conversation;
    }

    changed = true;
    const nextOffers = offers.map((offer) =>
      offer.status === "PENDING" && offer.expiresAt && new Date(offer.expiresAt).getTime() <= now
        ? { ...offer, status: "EXPIRED" as const, respondedAt: updatedAt, expiredReason: "timeout" as const }
        : offer,
    );
    const timeoutNames = offers
      .filter((offer) => offer.status === "PENDING" && offer.expiresAt && new Date(offer.expiresAt).getTime() <= now)
      .map((offer) => offer.freelancerName);
    return {
      ...conversation,
      assignmentOffers: nextOffers,
      messages: [
        ...conversation.messages,
        {
          id: makeId("msg"),
          lane: "internal" as const,
          senderRole: "admin" as const,
          senderLabel: "Gigxomi routing",
          body: `Project offer timed out for ${timeoutNames.join(", ")}. Response-time Karma can be reviewed by ops.`,
          createdAt: updatedAt,
        },
      ],
      updatedAt,
    };
  });

  if (changed) {
    dummyPlatformMemory.conversations = conversations;
  }
  return changed;
}

export function approveProjectIntakeAndOffer(
  conversationId: string,
  input: { approvedByRole: "admin" | "manager"; approvedByName: string; fallbackToCategory?: boolean },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const intake = conversation.projectIntake;
  if (!intake) {
    return { error: "No project intake is attached to this conversation." } as const;
  }
  if (intake.opsReviewStatus !== "SUBMITTED" && intake.opsReviewStatus !== "APPROVED") {
    return { error: "Client intake must be submitted before ops can offer the project." } as const;
  }

  const targetEditor = intake.targetEditorId
    ? editorPerformanceProfiles.find((editor) => editor.id === intake.targetEditorId) ?? null
    : findEditorByUsername(intake.targetEditorUsername);
  const category = intake.serviceTitle || conversation.serviceTitle;
  const projectDetails = buildProjectDetailsFromIntake(conversation);
  const targetIds =
    targetEditor && isEditorAcceptingProjects(targetEditor.id)
      ? [targetEditor.id]
      : input.fallbackToCategory === false
        ? []
        : editorPerformanceProfiles
            .filter((editor) => editor.id !== targetEditor?.id)
            .filter((editor) => isEditorAcceptingProjects(editor.id))
            .filter((editor) =>
              editor.specialties.some((specialty) => normalizeLooseKey(category).includes(normalizeLooseKey(specialty)) || normalizeLooseKey(specialty).includes(normalizeLooseKey(category))),
            )
            .map((editor) => editor.id);

  if (!targetIds.length) {
    return { error: "No online accepting editor was found for this intake." } as const;
  }

  updateConversationProjectIntake(conversationId, {
    opsReviewStatus: "APPROVED",
    approvedAt: nowIso(),
  });

  return assignConversation(conversationId, targetIds, input.approvedByRole, undefined, {
    projectDetails,
    offeredByName: input.approvedByName,
    source: targetEditor && targetIds.includes(targetEditor.id) ? "targeted" : "fallback",
    category,
  });
}

export function updateFreelancerCustomerLaneAccess(
  conversationId: string,
  input: {
    enabled: boolean;
    grantedByRole: "manager" | "admin";
    grantedByName: string;
  },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  if (!conversation.assignedFreelancerId || !conversation.assignedFreelancerName) {
    return { error: "Assign a freelancer before changing direct client permissions." } as const;
  }

  const updatedAt = nowIso();
  const laneNote: DummyConversationMessage = {
    id: makeId("msg"),
    lane: "internal",
    senderRole: input.grantedByRole,
    senderLabel: input.grantedByName || roleLabel(input.grantedByRole),
    body: input.enabled
      ? `${conversation.assignedFreelancerName} can now reply in the customer lane as ${buildConversationAgencyContext(conversation).agencyName}.`
      : `${conversation.assignedFreelancerName} has been moved back to internal-only coordination for this thread.`,
    createdAt: updatedAt,
  };

  conversations[index] = {
    ...conversation,
    freelancerCustomerLaneAccess: input.enabled,
    freelancerCustomerLaneAccessUpdatedAt: updatedAt,
    freelancerCustomerLaneAccessGrantedByRole: input.grantedByRole,
    freelancerCustomerLaneAccessGrantedByName: input.grantedByName || roleLabel(input.grantedByRole),
    messages: [...conversation.messages, laneNote],
    updatedAt,
  };
  dummyPlatformMemory.conversations = conversations;

  return conversations[index];
}

export function markConversationRead(conversationId: string, audience: DummyConversationRole, lane?: DummyConversationLane) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const visibleMessages = getVisibleMessages(conversation, audience).filter((message) => !lane || message.lane === lane);
  const latestVisible = visibleMessages.at(-1);
  if (!latestVisible) {
    return conversation;
  }

  conversations[index] = {
    ...conversation,
    readStateByAudience: markReadState(conversation.readStateByAudience, audience, latestVisible.createdAt, lane),
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;
  return conversations[index];
}

export function updateFreelancerClientAlias(conversationId: string, freelancerKeys: string[], alias: string) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const keys = Array.from(new Set(freelancerKeys.map((key) => key.trim()).filter(Boolean)));
  if (!keys.length) {
    return conversation;
  }

  const aliases = { ...(conversation.freelancerClientAliases ?? {}) };
  const nextAlias = alias.trim().slice(0, 80);
  for (const key of keys) {
    if (nextAlias) {
      aliases[key] = nextAlias;
    } else {
      delete aliases[key];
    }
  }

  conversations[index] = {
    ...conversation,
    freelancerClientAliases: aliases,
    updatedAt: nowIso(),
  };
  dummyPlatformMemory.conversations = conversations;

  return conversations[index];
}

export function updateConversationLeadStatus(conversationId: string, leadStatusId: string) {
  const index = getConversationIndex(conversationId);
  const nextStatus = getLeadStatusOrFallback(leadStatusId);
  if (index === -1 || !nextStatus.active) {
    return null;
  }

  conversations[index] = {
    ...conversations[index],
    leadStatusId: nextStatus.id,
    updatedAt: nowIso(),
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;
  return conversations[index];
}

export function updateConversationInternalNotes(conversationId: string, notes: string, nextFollowUpAt?: string | null) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  conversations[index] = {
    ...conversations[index],
    internalNotes: notes.trim(),
    ...(nextFollowUpAt !== undefined ? { nextFollowUpAt: nextFollowUpAt ? nextFollowUpAt.trim() : null } : {}),
    updatedAt: nowIso(),
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;
  return conversations[index];
}

export function listLeadStatuses() {
  return leadStatuses.slice().sort((left, right) => left.order - right.order);
}

export function manageLeadStatuses(input: {
  action: "create" | "update" | "delete" | "reorder";
  statusId?: string;
  label?: string;
  tone?: DummyLeadStatusTone;
  active?: boolean;
  orderedIds?: string[];
}) {
  if (input.action === "create") {
    const next: DummyLeadStatus = {
      id: `custom-${slugify(input.label || makeId("status")) || makeId("status")}`,
      label: input.label?.trim() || "Custom status",
      tone: input.tone ?? "neutral",
      order: leadStatuses.length + 1,
      active: input.active ?? true,
    };
    leadStatuses = [...leadStatuses, next];
  }

  if (input.action === "update" && input.statusId) {
    leadStatuses = leadStatuses.map((status) =>
      status.id === input.statusId
        ? {
            ...status,
            label: input.label?.trim() || status.label,
            tone: input.tone ?? status.tone,
            active: input.active ?? status.active,
          }
        : status,
    );
  }

  if (input.action === "delete" && input.statusId) {
    const isUsed = conversations.some((conversation) => conversation.leadStatusId === input.statusId);
    if (!isUsed) {
      leadStatuses = leadStatuses.filter((status) => status.id !== input.statusId);
    }
  }

  if (input.action === "reorder" && input.orderedIds?.length) {
    const orderMap = new Map(input.orderedIds.map((id, index) => [id, index + 1]));
    leadStatuses = leadStatuses.map((status) => ({
      ...status,
      order: orderMap.get(status.id) ?? status.order,
    }));
  }

  leadStatuses = leadStatuses
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((status, index) => ({ ...status, order: index + 1 }));
  dummyPlatformMemory.leadStatuses = leadStatuses;
  return listLeadStatuses();
}

export function listConversationTemplates() {
  return conversationTemplates.slice();
}

export async function createManualConversation(input: {
  role: "manager" | "admin" | "sales";
  tenantId?: string;
  customerName: string;
  customerPhone: string;
  serviceId?: string;
  templateId?: string;
}) {
  const createdAt = nowIso();
  const tenantId = input.tenantId?.trim() || "tenant-gigxomi";
  const service = input.serviceId ? getServiceById(input.serviceId) : null;
  const template = input.templateId ? conversationTemplates.find((item) => item.id === input.templateId) : null;
  const conversation: DummyConversation = {
    id: makeId("conv"),
    contactId: makeId("contact"),
    serviceId: service?.id ?? "svc-manual-chat",
    serviceSlug: service?.slug ?? "manual-chat",
    serviceTitle: service?.title ?? "Manual CRM chat",
    customerId: `manual-${slugify(input.customerName) || makeId("customer")}`,
    customerName: input.customerName.trim() || "New contact",
    customerPhone: formatPhone(input.customerPhone),
    maskedCustomerName: formatCustomerAlias(conversations.length + 5),
    tenantId,
    status: "Manager Review",
    leadStatusId: "new",
    summary: template?.content?.trim() || `Conversation created for ${input.customerName.trim() || "new contact"}`,
    internalNotes: "",
    ownerRole: input.role,
    ownerName: input.role === "admin" ? "Gigxomi Studio" : input.role === "sales" ? "GXclosers" : "Rahul Manager",
    readStateByAudience: {
      [input.role]: createdAt,
    },
    lastCustomerActivityAt: createdAt,
    isInAppCustomerThread: false,
    latestPaymentRequestId: undefined,
    paymentRequests: [],
    messages:
      template?.content?.trim()
        ? [
            {
              id: makeId("msg"),
              lane: "customer",
              senderRole: input.role,
              senderLabel: input.role === "admin" ? "Gigxomi Studio" : input.role === "sales" ? "GXclosers" : "Rahul Manager",
              body: template.content.trim(),
              createdAt,
            },
          ]
        : [],
    typing: [],
    createdAt,
    updatedAt: createdAt,
  };

  const normalized = normalizeConversation(conversation, conversations.length);
  conversations = [normalized, ...conversations];
  syncContactFromConversation(normalized);
  dummyPlatformMemory.conversations = conversations;

  let delivery: { ok: boolean; mode: DummyWhatsAppDeliveryMode; error?: string } = { ok: true, mode: "local-only" };
  if (template?.content?.trim()) {
    delivery = await sendWhatsAppText({
      tenantId: normalized.tenantId,
      to: normalized.customerPhone,
      body: formatWhatsAppCustomerLaneBody(input.role, template.content.trim()),
    });
  }

  return {
    conversation: normalized,
    delivery,
  };
}

export function listContacts(audience: "admin" | "manager" = "admin", tenantId?: string) {
  // Ensure all conversations are mapped to contacts
  conversations.forEach((conversation) => {
    if (!contacts.some((contact) => contact.id === conversation.contactId || (conversation.customerPhone && contact.phone === conversation.customerPhone))) {
      syncContactFromConversation(conversation);
    }
  });

  return contacts
    .filter((contact) => !tenantId?.trim() || contact.tenantId === tenantId.trim())
    .map((contact) => {
      const linkedConversation = conversations.find(
        (conversation) => conversation.contactId === contact.id || (contact.phone && conversation.customerPhone === contact.phone),
      );
      const leadStatus = getLeadStatusOrFallback(linkedConversation?.leadStatusId ?? contact.latestStatusId);
      const assignedEditor = editorPerformanceProfiles.find((editor) => editor.id === (linkedConversation?.assignedFreelancerId ?? contact.assignedUserId));
      const assignedManager = managers.find((manager) => manager.id === contact.assignedUserId);
      const privacy = getCustomerPrivacySettings(contact.tenantId) ?? createDefaultCustomerPrivacySettings(contact.tenantId);
      const shouldMaskPhone = audience === "manager" ? privacy.maskCustomerPhoneForManagers : false;
      const latestActivity =
        linkedConversation?.messages.at(-1)?.createdAt ||
        linkedConversation?.updatedAt ||
        linkedConversation?.lastCustomerActivityAt ||
        contact.lastActivity;

      return {
        ...contact,
        notes: linkedConversation?.internalNotes || contact.notes || "",
        lastActivity: latestActivity,
        phone: maskPhoneForAudience(contact.phone, audience, { masked: shouldMaskPhone }),
        phoneDisplay: maskPhoneForAudience(contact.phone, audience, { masked: shouldMaskPhone }),
        latestStatusId: leadStatus.id,
        latestStatusLabel: leadStatus.label,
        latestStatusTone: leadStatus.tone,
        unreadCount: linkedConversation ? getUnreadCount(linkedConversation, "admin") : 0,
        assignedUserName: assignedEditor?.name ?? assignedManager?.name ?? "Unassigned",
      } satisfies DummyContactRecord;
    })
    .sort((left, right) => right.lastActivity.localeCompare(left.lastActivity));
}

export function updateContact(
  contactId: string,
  updates: Partial<Pick<DummyContact, "tags" | "notes" | "latestStatusId" | "assignedUserId">>,
  tenantId?: string,
) {
  const existing = contacts.find((contact) => contact.id === contactId);
  if (!existing) {
    return null;
  }

  if (tenantId?.trim() && existing.tenantId !== tenantId.trim()) {
    return null;
  }

  contacts = contacts.map((contact) =>
    contact.id === contactId
      ? {
          ...contact,
          tags: updates.tags ?? contact.tags,
          notes: updates.notes ?? contact.notes,
          latestStatusId: updates.latestStatusId ?? contact.latestStatusId,
          assignedUserId: updates.assignedUserId ?? contact.assignedUserId,
        }
      : contact,
  );
  dummyPlatformMemory.contacts = contacts;

  const conversationIndex = conversations.findIndex((conversation) => conversation.contactId === contactId);
  if (conversationIndex !== -1) {
    const assignedEditor = editorPerformanceProfiles.find((editor) => editor.id === updates.assignedUserId);
    const assignedManager = managers.find((manager) => manager.id === updates.assignedUserId);
    conversations[conversationIndex] = {
      ...conversations[conversationIndex],
      leadStatusId: updates.latestStatusId ?? conversations[conversationIndex].leadStatusId,
      internalNotes: updates.notes ?? conversations[conversationIndex].internalNotes,
      assignedFreelancerId: assignedEditor ? assignedEditor.id : conversations[conversationIndex].assignedFreelancerId,
      assignedFreelancerName: assignedEditor ? assignedEditor.name : conversations[conversationIndex].assignedFreelancerName,
      freelancerCustomerLaneAccess: assignedEditor ? false : conversations[conversationIndex].freelancerCustomerLaneAccess,
      freelancerCustomerLaneAccessUpdatedAt: assignedEditor ? nowIso() : conversations[conversationIndex].freelancerCustomerLaneAccessUpdatedAt,
      freelancerCustomerLaneAccessGrantedByRole: assignedEditor ? undefined : conversations[conversationIndex].freelancerCustomerLaneAccessGrantedByRole,
      freelancerCustomerLaneAccessGrantedByName: assignedEditor ? undefined : conversations[conversationIndex].freelancerCustomerLaneAccessGrantedByName,
      ownerName: assignedManager ? assignedManager.name : conversations[conversationIndex].ownerName,
      updatedAt: nowIso(),
    };
    dummyPlatformMemory.conversations = conversations;
  }

  return listContacts("admin", tenantId).find((contact) => contact.id === contactId) ?? null;
}

export function listManagers(tenantId?: string) {
  return managers.filter((manager) => !tenantId?.trim() || manager.tenantId === tenantId.trim()).slice();
}

export function createManagerAccount(input: { name: string; email: string; queue: string; tenantId?: string }) {
  const tenantId = input.tenantId?.trim() || "tenant-gigxomi";
  const manager: DummyManagerAccount = {
    id: makeId("manager"),
    tenantId,
    name: input.name.trim() || "New manager",
    email: input.email.trim() || `${slugify(input.name || "manager")}@gigxomi.local`,
    queue: input.queue.trim() || "General operations",
    active: true,
    permissions: getDefaultManagerPermissions(),
  };

  managers = [manager, ...managers];
  dummyPlatformMemory.managers = managers;
  return manager;
}

export function updateManagerPermissions(managerId: string, permissions: Partial<DummyManagerPermissionSet>) {
  const existing = managers.find((manager) => manager.id === managerId);
  if (!existing) {
    return null;
  }

  managers = managers.map((manager) =>
    manager.id === managerId
      ? {
          ...manager,
          permissions: {
            ...manager.permissions,
            ...permissions,
          },
        }
      : manager,
  );
  dummyPlatformMemory.managers = managers;
  return managers.find((manager) => manager.id === managerId) ?? null;
}

export function getManagerById(managerId = "manager-rahul") {
  return managers.find((manager) => manager.id === managerId) ?? managers[0] ?? null;
}

export function getCustomerPrivacySettings(tenantId = "tenant-gigxomi") {
  return customerPrivacySettings.find((settings) => settings.tenantId === tenantId) ?? createDefaultCustomerPrivacySettings(tenantId);
}

export function updateCustomerPrivacySettings(
  tenantId = "tenant-gigxomi",
  updates: Partial<Pick<DummyCustomerPrivacySettings, "maskCustomerPhoneForManagers" | "maskCustomerPhoneForFreelancers">> = {},
) {
  const existing = getCustomerPrivacySettings(tenantId);
  const next: DummyCustomerPrivacySettings = {
    tenantId,
    maskCustomerPhoneForManagers: updates.maskCustomerPhoneForManagers ?? existing.maskCustomerPhoneForManagers,
    maskCustomerPhoneForFreelancers: updates.maskCustomerPhoneForFreelancers ?? existing.maskCustomerPhoneForFreelancers,
    updatedAt: nowIso(),
  };

  customerPrivacySettings = customerPrivacySettings.some((settings) => settings.tenantId === tenantId)
    ? customerPrivacySettings.map((settings) => (settings.tenantId === tenantId ? next : settings))
    : [next, ...customerPrivacySettings];
  dummyPlatformMemory.customerPrivacySettings = customerPrivacySettings;
  return next;
}

export function getUpiConfig(tenantId = "tenant-gigxomi") {
  return upiConfigs.find((config) => config.tenantId === tenantId) ?? null;
}

export function updateUpiConfig(
  tenantId = "tenant-gigxomi",
  updates: Partial<Pick<DummyUpiConfig, "enabled" | "upiId" | "payeeName" | "currency" | "notePrefix">> = {},
) {
  const existing = getUpiConfig(tenantId);
  const next: DummyUpiConfig = {
    tenantId,
    enabled: updates.enabled ?? existing?.enabled ?? true,
    upiId: updates.upiId ?? existing?.upiId ?? "7974063067@ybl",
    payeeName: updates.payeeName ?? existing?.payeeName ?? "Gigxomi Studio",
    currency: updates.currency ?? existing?.currency ?? "INR",
    notePrefix: updates.notePrefix ?? existing?.notePrefix ?? "Gigxomi project",
    updatedAt: nowIso(),
  };

  upiConfigs = existing ? upiConfigs.map((config) => (config.tenantId === tenantId ? next : config)) : [next, ...upiConfigs];
  dummyPlatformMemory.upiConfigs = upiConfigs;
  return next;
}

function buildUpiUrl(config: DummyUpiConfig, paymentRequest: Pick<DummyPaymentRequest, "amount" | "title">) {
  const params = new URLSearchParams({
    pa: config.upiId,
    pn: config.payeeName,
    am: String(paymentRequest.amount),
    cu: config.currency,
    tn: `${config.notePrefix}: ${paymentRequest.title}`.trim(),
  });
  return `upi://pay?${params.toString()}`;
}

function formatPaymentGatewayLabel(gateway?: DummyWhatsAppPaymentGateway) {
  if (!gateway) {
    return "";
  }

  switch (gateway) {
    case "payu":
      return "PayU";
    case "razorpay":
      return "Razorpay";
    case "zaakpay":
      return "Zaakpay";
    default:
      return gateway;
  }
}

function buildWhatsAppAmount(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  const subunits = Math.max(0, Math.round(normalized * 100));
  return { value: subunits, offset: 100 };
}

function buildWhatsAppOrderDetailsPayload(input: {
  orderId: string;
  amount: number;
  title: string;
  currency: string;
  paymentGateway: DummyWhatsAppPaymentGateway;
  paymentConfigurationName: string;
}) {
  const totalAmount = buildWhatsAppAmount(input.amount);
  return {
    reference_id: input.orderId,
    type: "digital_goods",
    currency: input.currency,
    total_amount: totalAmount,
    payment_settings: {
      payment_gateway: input.paymentGateway,
      payment_configuration_name: input.paymentConfigurationName,
    },
    items: [
      {
        name: input.title,
        amount: totalAmount,
        quantity: 1,
      },
    ],
  };
}

export async function createConversationPaymentRequest(
  conversationId: string,
  input: {
    role: "manager" | "admin" | "freelancer";
    amount: number;
    title: string;
    note: string;
    dueLabel?: string;
    lane?: DummyConversationLane;
    payerRole?: "client" | "agency";
    payeeRole?: "agency" | "freelancer";
    payeeUpiId?: string;
    payeeName?: string;
    assignmentId?: string;
    projectId?: string;
    projectTitle?: string;
    paymentRequestId?: string;
    paymentLink?: string;
    paymentOrderId?: string;
    paymentProvider?: string;
  },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];

  const normalizedAmount = Math.max(0, Math.round(Number(input.amount ?? 0)));
  if (!normalizedAmount) {
    return { error: "Enter a valid payment amount." };
  }

  const lane: DummyConversationLane = input.lane === "internal" ? "internal" : "customer";
  const payerRole: "client" | "agency" = input.payerRole ?? (lane === "customer" ? "client" : "agency");
  const payeeRole: "agency" | "freelancer" = input.payeeRole ?? (lane === "customer" ? "agency" : "freelancer");

  const platformUpiConfig = getUpiConfig(conversation.tenantId) ?? updateUpiConfig(conversation.tenantId);
  const resolvedPayeeUpiId = (input.payeeUpiId ?? "").trim() || platformUpiConfig.upiId;
  const resolvedPayeeName =
    (input.payeeName ?? "").trim() ||
    (payeeRole === "freelancer"
      ? conversation.assignedFreelancerName || platformUpiConfig.payeeName || "Gigxomi editor"
      : platformUpiConfig.payeeName || "Gigxomi");

  const upiConfigForRequest: DummyUpiConfig = {
    ...platformUpiConfig,
    upiId: resolvedPayeeUpiId,
    payeeName: resolvedPayeeName,
  };

  const whatsappConnection = getWhatsAppConnectionState(conversation.tenantId);
  const paymentGateway = whatsappConnection?.paymentsGateway ?? "payu";
  const paymentConfigurationName = whatsappConnection?.paymentsConfigurationName?.trim() ?? "";
  const paymentTemplateName = whatsappConnection?.paymentsTemplateName?.trim() || "gigxomi_order_details";
  const useWhatsAppCheckout = lane === "customer" && Boolean(whatsappConnection?.paymentsEnabled && paymentConfigurationName && paymentTemplateName);
  const paymentOrderId = input.paymentOrderId?.trim() || (useWhatsAppCheckout ? makeId("order") : undefined);
  const paymentProvider = useWhatsAppCheckout ? paymentGateway : undefined;
  const paymentGatewayLabel = formatPaymentGatewayLabel(paymentProvider);
  const split =
    lane === "customer" && payeeRole === "agency"
      ? buildAgencyFullRevenueSplit(normalizedAmount)
      : buildRevenueSplit(conversation.assignedFreelancerId, normalizedAmount);
  const createdAt = nowIso();
  const assignmentId = input.assignmentId?.trim() || `assignment-${conversation.id}`;
  const projectId = input.projectId?.trim() || conversation.serviceId;
  const projectTitle = input.projectTitle?.trim() || conversation.serviceTitle || "Linked work";
  const paymentRequestBase = {
    amount: normalizedAmount,
    title: input.title.trim() || "Project payment",
  };
  const upiUrl = input.paymentLink?.trim() || buildUpiUrl(upiConfigForRequest, paymentRequestBase);
  const roleText = roleLabel(input.role);

  const templateMessage = lane === "internal"
    ? `*${roleText}:* Internal billing request of INR ${normalizedAmount.toLocaleString("en-IN")} for ${paymentRequestBase.title}. Payer: ${payerRole}.`
    : useWhatsAppCheckout
      ? `*${roleText}:* Payment request for INR ${normalizedAmount.toLocaleString("en-IN")} via WhatsApp checkout${
          paymentGatewayLabel ? ` (${paymentGatewayLabel})` : ""
        }${paymentOrderId ? ` | Order ${paymentOrderId}` : ""}${input.dueLabel ? ` | Due: ${input.dueLabel}` : ""}`
      : `*${roleText}:* Please complete the payment of INR ${normalizedAmount.toLocaleString("en-IN")} for ${paymentRequestBase.title}. ` +
        `UPI ID: ${resolvedPayeeUpiId}${input.dueLabel ? ` | Due: ${input.dueLabel}` : ""}`;

  const paymentRequest: DummyPaymentRequest = {
    id: input.paymentRequestId?.trim() || makeId("payreq"),
    assignmentId,
    projectId,
    projectTitle,
    title: paymentRequestBase.title,
    note: input.note.trim(),
    amount: normalizedAmount,
    dueLabel: input.dueLabel?.trim() || undefined,
    lane,
    payerRole,
    payeeRole,
    status: "Sent",
    paymentProvider,
    paymentOrderId,
    paymentConfigurationName: paymentProvider ? paymentConfigurationName : undefined,
    upiUrl,
    upiId: resolvedPayeeUpiId,
    payeeName: resolvedPayeeName,
    templateMessage,
    split,
    proofAttachments: [],
    createdByRole: input.role,
    createdByLabel:
      input.role === "admin"
        ? "Gigxomi Studio"
        : input.role === "manager"
          ? "Rahul Manager"
          : conversation.assignedFreelancerName || "Freelancer",
    createdAt,
  };

  const attachment: DummyConversationAttachment = {
    id: makeId("att"),
    kind: "payment-request",
    target: "local",
    name: paymentRequest.title,
    mimeType: "application/payment-request+json",
    sizeLabel: `INR ${paymentRequest.amount.toLocaleString("en-IN")}`,
    note: [
      `Payer: ${payerRole}`,
      `Payee: ${payeeRole}`,
      projectTitle ? `Work: ${projectTitle}` : "",
      `UPI: ${paymentRequest.upiId}`,
      ...(lane === "customer" && payeeRole === "agency"
        ? [`Agency receives INR ${paymentRequest.amount.toLocaleString("en-IN")}`]
        : [
            `Editor gets INR ${paymentRequest.split.editorAmount.toLocaleString("en-IN")}`,
            `Platform keeps INR ${paymentRequest.split.platformAmount.toLocaleString("en-IN")}`,
          ]),
      paymentGatewayLabel ? `Gateway: ${paymentGatewayLabel}` : "",
      paymentOrderId ? `Order ID: ${paymentOrderId}` : "",
      paymentProvider && paymentConfigurationName ? `Config: ${paymentConfigurationName}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    paymentRequestId: paymentRequest.id,
  };

  const message: DummyConversationMessage = {
    id: makeId("msg"),
    lane,
    senderRole: input.role,
    senderLabel: paymentRequest.createdByLabel,
    body:
      lane === "internal"
        ? `Internal bill generated for INR ${paymentRequest.amount.toLocaleString("en-IN")}.`
        : `Payment request for INR ${paymentRequest.amount.toLocaleString("en-IN")} sent.`,
    attachments: [attachment],
    createdAt,
  };

  conversations[index] = {
    ...conversation,
    leadStatusId: lane === "customer" ? "payment-pending" : conversation.leadStatusId,
    paymentRequests: [...conversation.paymentRequests, paymentRequest],
    latestPaymentRequestId: paymentRequest.id,
    messages: [...conversation.messages, message],
    readStateByAudience: markReadState(conversation.readStateByAudience, input.role, createdAt, lane),
    updatedAt: createdAt,
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;

  const sourceChannel = normalizeConversationSourceChannel(conversation);
  const delivery =
    lane !== "customer"
      ? { ok: true, mode: "local-only" as const }
      : sourceChannel === "instagram"
        ? await sendInstagramText({
            conversation,
            body: templateMessage,
          })
      : useWhatsAppCheckout
        ? await sendWhatsAppOrderDetails({
            tenantId: conversation.tenantId,
            to: conversation.customerPhone,
            templateName: paymentTemplateName,
            orderDetails: buildWhatsAppOrderDetailsPayload({
              orderId: paymentOrderId ?? paymentRequest.id,
              amount: paymentRequest.amount,
              title: paymentRequest.title,
              currency: upiConfigForRequest.currency,
              paymentGateway,
              paymentConfigurationName,
            }),
          })
        : await sendWhatsAppText({
            tenantId: conversation.tenantId,
            to: conversation.customerPhone,
            body: templateMessage,
          });

  return {
    conversation: conversations[index],
    paymentRequest,
    delivery,
  };
}

export function updatePaymentRequestStatus(
  conversationId: string,
  paymentRequestId: string,
  statusOrInput:
    | DummyPaymentStatus
    | {
        status: DummyPaymentStatus;
        actorRole?: DummyConversationRole;
        actorName?: string;
        proofAttachments?: Array<{
          name: string;
          mimeType?: string;
          sizeLabel?: string;
          note?: string;
          externalUrl?: string;
        }>;
      },
) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }

  const conversation = conversations[index];
  const updatedAt = nowIso();
  const paymentRequestIndex = conversation.paymentRequests.findIndex((paymentRequest) => paymentRequest.id === paymentRequestId);
  if (paymentRequestIndex === -1) {
    return null;
  }

  const input =
    typeof statusOrInput === "string"
      ? {
          status: statusOrInput,
        }
      : statusOrInput;

  const status = input.status;
  const paymentRequest = conversation.paymentRequests[paymentRequestIndex];
  const actorRole = input.actorRole;
  const actorName = (input.actorName ?? "").trim();

  if (status === "Paid") {
    const canConfirmPaid = paymentRequest.payeeRole === "freelancer"
      ? actorRole === "freelancer" || actorRole === "admin"
      : actorRole === "manager" || actorRole === "admin";

    if (!canConfirmPaid) {
      return { error: "Only the designated payee-side team can confirm this payment as paid." };
    }
  }

  const normalizedProofAttachments = (input.proofAttachments ?? [])
    .filter((attachment) => typeof attachment?.name === "string" && attachment.name.trim().length > 0)
    .map((attachment) => ({
      id: makeId("proof"),
      name: attachment.name.trim(),
      mimeType: (attachment.mimeType ?? "application/octet-stream").trim() || "application/octet-stream",
      sizeLabel: (attachment.sizeLabel ?? "Attachment").trim() || "Attachment",
      note: attachment.note?.trim() || undefined,
      externalUrl: attachment.externalUrl?.trim() || undefined,
      uploadedAt: updatedAt,
      uploadedByRole: actorRole ?? paymentRequest.createdByRole,
    }));

  const nextStatus = normalizedProofAttachments.length && status === "Sent" ? "Viewed" : status;

  const updatedPaymentRequest: DummyPaymentRequest = {
    ...paymentRequest,
    status: nextStatus,
    paidAt: nextStatus === "Paid" ? updatedAt : paymentRequest.paidAt,
    paidConfirmedAt: nextStatus === "Paid" ? updatedAt : paymentRequest.paidConfirmedAt,
    paidConfirmedByRole: nextStatus === "Paid" ? actorRole ?? paymentRequest.paidConfirmedByRole : paymentRequest.paidConfirmedByRole,
    paidConfirmedByName: nextStatus === "Paid" ? (actorName || paymentRequest.paidConfirmedByName) : paymentRequest.paidConfirmedByName,
    proofSubmittedAt: normalizedProofAttachments.length ? updatedAt : paymentRequest.proofSubmittedAt,
    proofAttachments: normalizedProofAttachments.length ? [...paymentRequest.proofAttachments, ...normalizedProofAttachments] : paymentRequest.proofAttachments,
  };

  const nextPaymentRequests = conversation.paymentRequests.map((existing) => (existing.id === paymentRequestId ? updatedPaymentRequest : existing));

  const wasAlreadyPaid = paymentRequest.status === "Paid";
  if (nextStatus === "Paid" && !wasAlreadyPaid && conversation.assignedFreelancerId && conversation.assignedFreelancerName) {
    walletCredits = [
      {
        id: makeId("wallet"),
        editorId: conversation.assignedFreelancerId,
        editorName: conversation.assignedFreelancerName,
        conversationId: conversation.id,
        paymentRequestId: updatedPaymentRequest.id,
        title: updatedPaymentRequest.title,
        grossAmount: updatedPaymentRequest.split.grossAmount,
        platformAmount: updatedPaymentRequest.split.platformAmount,
        editorAmount: updatedPaymentRequest.split.editorAmount,
        status: "Available",
        createdAt: updatedAt,
      },
      ...walletCredits,
    ];
    dummyPlatformMemory.walletCredits = walletCredits;
  }

  conversations[index] = {
    ...conversation,
    leadStatusId: nextStatus === "Paid" ? "in-progress" : conversation.leadStatusId,
    paymentRequests: nextPaymentRequests,
    latestPaymentRequestId: updatedPaymentRequest.id,
    updatedAt,
  };
  syncContactFromConversation(conversations[index]);
  dummyPlatformMemory.conversations = conversations;
  return conversations[index];
}
export function getWhatsAppConnectionState(tenantId = "tenant-gigxomi") {
  const state = whatsappStates.find((entry) => entry.tenantId === tenantId);
  if (!state) {
    return null;
  }

  const metaAppId = replaceLegacyMetaId(
    state.metaAppId ?? "",
    LEGACY_META_WHATSAPP_APP_ID,
    PRODUCTION_META_WHATSAPP_APP_ID,
  );
  const metaConfigId = replaceLegacyMetaId(
    state.metaConfigId ?? "",
    LEGACY_META_WHATSAPP_CONFIG_ID,
    PRODUCTION_META_WHATSAPP_CONFIG_ID,
  );
  const sessionInfoVersion = state.sessionInfoVersion?.trim() || metaSeed.sessionInfoVersion || "3";
  const embeddedSignupVersion = normalizeEmbeddedSignupVersion(state.embeddedSignupVersion || metaSeed.embeddedSignupVersion);
  const graphApiVersion = normalizeMetaGraphVersion(state.graphApiVersion);
  const status = normalizeWhatsAppConnectionStatus(state);

  return {
    ...state,
    status,
    metaAppId,
    metaConfigId,
    manualOverrides: normalizeWhatsAppManualOverrides((state as Partial<DummyWhatsAppConnectionState>).manualOverrides),
    sessionInfoVersion,
    embeddedSignupVersion,
    graphApiVersion,
    onboardingUrl: buildMetaWhatsAppOnboardingUrl({
      metaAppId,
      metaConfigId,
      sessionInfoVersion,
      embeddedSignupVersion,
      publicBaseUrl: state.publicBaseUrl,
    }),
    authorizationCode: state.authorizationCode ?? "",
    lastSignupEvent: state.lastSignupEvent ?? "",
    lastSignupEventAt: state.lastSignupEventAt ?? "",
    launchChecklist: buildWhatsAppChecklist({
      displayName: state.displayName,
      status,
      businessPortfolioId: state.businessPortfolioId,
      wabaId: state.wabaId,
      phoneNumberId: state.phoneNumberId,
      lastLaunchAt: state.lastLaunchAt,
      verifyToken: state.verifyToken,
      publicBaseUrl: state.publicBaseUrl,
    }),
  };
}

export function listWhatsAppConnectionStates() {
  return whatsappStates
    .map((state) => getWhatsAppConnectionState(state.tenantId))
    .filter((state): state is NonNullable<ReturnType<typeof getWhatsAppConnectionState>> => Boolean(state));
}

export function findWhatsAppConnectionStateByVerifyToken(verifyToken?: string | null) {
  const normalizedVerifyToken = String(verifyToken ?? "").trim();
  if (!normalizedVerifyToken) {
    return null;
  }

  const matchedState = whatsappStates.find((state) => String(state.verifyToken ?? "").trim() === normalizedVerifyToken);
  return matchedState ? getWhatsAppConnectionState(matchedState.tenantId) : null;
}

export function updateWhatsAppConnectionState(
  tenantId = "tenant-gigxomi",
  updates: Partial<
    Pick<
      DummyWhatsAppConnectionState,
      | "pluginEnabled"
      | "businessName"
      | "displayName"
      | "phoneNumber"
      | "paymentsEnabled"
      | "paymentsGateway"
      | "paymentsConfigurationName"
      | "paymentsTemplateName"
      | "subscriptionPaymentTemplateName"
      | "subscriptionPaymentTemplateLanguage"
      | "renewalReminderTemplateName"
      | "renewalReminderTemplateLanguage"
      | "otpTemplateName"
      | "otpTemplateLanguage"
      | "status"
      | "note"
      | "metaAppId"
      | "metaConfigId"
      | "sessionInfoVersion"
      | "embeddedSignupVersion"
      | "verifyToken"
      | "publicBaseUrl"
      | "graphApiVersion"
      | "businessId"
      | "businessPortfolioId"
      | "wabaId"
      | "phoneNumberId"
      | "systemUserId"
      | "manualOverrides"
      | "authorizationCode"
      | "accessToken"
      | "lastLaunchAt"
      | "lastInboundAt"
      | "lastOutboundAt"
      | "lastError"
      | "lastSignupEvent"
      | "lastSignupEventAt"
    >
  >,
) {
  const sanitizedUpdates = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)) as typeof updates;
  const {
    subscriptionPaymentTemplateName,
    subscriptionPaymentTemplateLanguage,
    renewalReminderTemplateName,
    renewalReminderTemplateLanguage,
    otpTemplateName,
    otpTemplateLanguage,
    publicBaseUrl,
    graphApiVersion,
    embeddedSignupVersion,
    metaAppId,
    metaConfigId,
    sessionInfoVersion,
    manualOverrides,
    ...passthroughUpdates
  } = sanitizedUpdates;
  const existing = getWhatsAppConnectionState(tenantId);
  if (!existing) {
    const nextBase: Omit<DummyWhatsAppConnectionState, "launchChecklist"> = {
      tenantId,
      businessName: sanitizedUpdates.businessName ?? "Agency tenant",
      displayName: sanitizedUpdates.displayName ?? "Agency tenant",
      phoneNumber: sanitizedUpdates.phoneNumber ?? "",
      manualOverrides: normalizeWhatsAppManualOverrides(manualOverrides),
      pluginEnabled: sanitizedUpdates.pluginEnabled ?? false,
      paymentsEnabled: sanitizedUpdates.paymentsEnabled ?? false,
      paymentsGateway: sanitizedUpdates.paymentsGateway ?? "payu",
      paymentsConfigurationName: sanitizedUpdates.paymentsConfigurationName ?? "",
      paymentsTemplateName: sanitizedUpdates.paymentsTemplateName ?? "gigxomi_order_details",
      subscriptionPaymentTemplateName: String(subscriptionPaymentTemplateName ?? "").trim(),
      subscriptionPaymentTemplateLanguage: normalizeTemplateLanguageCode(subscriptionPaymentTemplateLanguage),
      renewalReminderTemplateName: String(renewalReminderTemplateName ?? "").trim(),
      renewalReminderTemplateLanguage: normalizeTemplateLanguageCode(renewalReminderTemplateLanguage),
      otpTemplateName: String(otpTemplateName ?? "").trim(),
      otpTemplateLanguage: normalizeTemplateLanguageCode(otpTemplateLanguage),
      status: normalizeWhatsAppConnectionStatus({
        status: sanitizedUpdates.status ?? "Not started",
        phoneNumberId: sanitizedUpdates.phoneNumberId,
        wabaId: sanitizedUpdates.wabaId,
        businessId: sanitizedUpdates.businessId,
        businessPortfolioId: sanitizedUpdates.businessPortfolioId,
      }),
      note: sanitizedUpdates.note ?? "Waiting for onboarding details.",
      metaAppId: metaAppId ?? metaSeed.metaAppId,
      metaConfigId: metaConfigId ?? metaSeed.metaConfigId,
      sessionInfoVersion: sessionInfoVersion ?? metaSeed.sessionInfoVersion,
      embeddedSignupVersion: normalizeEmbeddedSignupVersion(embeddedSignupVersion ?? metaSeed.embeddedSignupVersion),
      verifyToken: sanitizedUpdates.verifyToken ?? buildDefaultWhatsAppVerifyToken(tenantId),
      publicBaseUrl: normalizePublicBaseUrl(publicBaseUrl),
      graphApiVersion: normalizeMetaGraphVersion(graphApiVersion),
      businessId: sanitizedUpdates.businessId ?? "",
      businessPortfolioId: sanitizedUpdates.businessPortfolioId ?? "",
      wabaId: sanitizedUpdates.wabaId ?? "",
      phoneNumberId: sanitizedUpdates.phoneNumberId ?? "",
      systemUserId: sanitizedUpdates.systemUserId ?? "",
      authorizationCode: sanitizedUpdates.authorizationCode ?? "",
      accessToken: sanitizedUpdates.accessToken ?? "",
      lastLaunchAt: sanitizedUpdates.lastLaunchAt,
      lastInboundAt: sanitizedUpdates.lastInboundAt,
      lastOutboundAt: sanitizedUpdates.lastOutboundAt,
      lastError: sanitizedUpdates.lastError ?? "",
      lastSignupEvent: sanitizedUpdates.lastSignupEvent ?? "",
      lastSignupEventAt: sanitizedUpdates.lastSignupEventAt,
      onboardingUrl: buildMetaWhatsAppOnboardingUrl({
        metaAppId: metaAppId ?? metaSeed.metaAppId,
        metaConfigId: metaConfigId ?? metaSeed.metaConfigId,
        sessionInfoVersion: sessionInfoVersion ?? metaSeed.sessionInfoVersion,
        embeddedSignupVersion: embeddedSignupVersion ?? metaSeed.embeddedSignupVersion,
        publicBaseUrl,
      }),
      updatedAt: nowIso(),
    };
    const next: DummyWhatsAppConnectionState = {
      ...nextBase,
      launchChecklist: buildWhatsAppChecklist({
        displayName: nextBase.displayName,
        status: nextBase.status,
        businessPortfolioId: nextBase.businessPortfolioId,
        wabaId: nextBase.wabaId,
        phoneNumberId: nextBase.phoneNumberId,
        lastLaunchAt: nextBase.lastLaunchAt,
        verifyToken: nextBase.verifyToken,
        publicBaseUrl: nextBase.publicBaseUrl,
      }),
    };
    whatsappStates = [next, ...whatsappStates];
    dummyPlatformMemory.whatsappStates = whatsappStates;
    releaseWhatsAppLineOwnershipFromOtherTenants(tenantId, next);
    return next;
  }

  whatsappStates = whatsappStates.map((state) => {
    if (state.tenantId !== tenantId) {
      return state;
    }

    const next: DummyWhatsAppConnectionState = {
      ...state,
      ...passthroughUpdates,
      manualOverrides: normalizeWhatsAppManualOverrides({
        ...normalizeWhatsAppManualOverrides((state as Partial<DummyWhatsAppConnectionState>).manualOverrides),
        ...manualOverrides,
      }),
      pluginEnabled: sanitizedUpdates.pluginEnabled ?? state.pluginEnabled ?? false,
      paymentsEnabled: sanitizedUpdates.paymentsEnabled ?? state.paymentsEnabled ?? false,
      paymentsGateway: state.paymentsGateway ?? "payu",
      paymentsConfigurationName: state.paymentsConfigurationName ?? "",
      paymentsTemplateName: state.paymentsTemplateName ?? "gigxomi_order_details",
      subscriptionPaymentTemplateName: String(
        subscriptionPaymentTemplateName ?? state.subscriptionPaymentTemplateName ?? "",
      ).trim(),
      subscriptionPaymentTemplateLanguage: normalizeTemplateLanguageCode(
        subscriptionPaymentTemplateLanguage ?? state.subscriptionPaymentTemplateLanguage,
      ),
      renewalReminderTemplateName: String(
        renewalReminderTemplateName ?? state.renewalReminderTemplateName ?? "",
      ).trim(),
      renewalReminderTemplateLanguage: normalizeTemplateLanguageCode(
        renewalReminderTemplateLanguage ?? state.renewalReminderTemplateLanguage,
      ),
      authorizationCode: sanitizedUpdates.authorizationCode ?? state.authorizationCode ?? "",
      lastSignupEvent: sanitizedUpdates.lastSignupEvent ?? state.lastSignupEvent ?? "",
      lastSignupEventAt: sanitizedUpdates.lastSignupEventAt ?? state.lastSignupEventAt ?? "",
      otpTemplateName: String(otpTemplateName ?? state.otpTemplateName ?? "").trim(),
      otpTemplateLanguage: normalizeTemplateLanguageCode(otpTemplateLanguage ?? state.otpTemplateLanguage),
      metaAppId: metaAppId?.trim() || state.metaAppId?.trim() || metaSeed.metaAppId,
      metaConfigId: metaConfigId?.trim() || state.metaConfigId?.trim() || metaSeed.metaConfigId,
      sessionInfoVersion: sessionInfoVersion?.trim() || state.sessionInfoVersion?.trim() || metaSeed.sessionInfoVersion,
      publicBaseUrl: normalizePublicBaseUrl(publicBaseUrl ?? state.publicBaseUrl),
      graphApiVersion: normalizeMetaGraphVersion(graphApiVersion ?? state.graphApiVersion),
      embeddedSignupVersion: normalizeEmbeddedSignupVersion(embeddedSignupVersion ?? state.embeddedSignupVersion),
      onboardingUrl: buildMetaWhatsAppOnboardingUrl({
        metaAppId: metaAppId?.trim() || state.metaAppId?.trim() || metaSeed.metaAppId,
        metaConfigId: metaConfigId?.trim() || state.metaConfigId?.trim() || metaSeed.metaConfigId,
        sessionInfoVersion: sessionInfoVersion?.trim() || state.sessionInfoVersion?.trim() || metaSeed.sessionInfoVersion,
        embeddedSignupVersion: embeddedSignupVersion ?? state.embeddedSignupVersion,
        publicBaseUrl: publicBaseUrl ?? state.publicBaseUrl,
      }),
      updatedAt: nowIso(),
      launchChecklist: state.launchChecklist,
    };
    next.status = normalizeWhatsAppConnectionStatus(next);

    return {
      ...next,
      launchChecklist: buildWhatsAppChecklist({
        displayName: next.displayName,
        status: next.status,
        businessPortfolioId: next.businessPortfolioId,
        wabaId: next.wabaId,
        phoneNumberId: next.phoneNumberId,
        lastLaunchAt: next.lastLaunchAt,
        verifyToken: next.verifyToken,
        publicBaseUrl: next.publicBaseUrl,
      }),
    };
  });
  dummyPlatformMemory.whatsappStates = whatsappStates;

  const updatedState = getWhatsAppConnectionState(tenantId);
  if (updatedState) {
    releaseWhatsAppLineOwnershipFromOtherTenants(tenantId, updatedState);
  }

  return getWhatsAppConnectionState(tenantId);
}

export function getInstagramConnectionState(tenantId = "tenant-gigxomi") {
  const state = instagramStates.find((entry) => entry.tenantId === tenantId);
  if (!state) {
    return null;
  }

  return {
    ...state,
    graphApiVersion: normalizeInstagramGraphApiVersion(state.graphApiVersion),
    verifyToken: state.verifyToken?.trim() || buildDefaultInstagramVerifyToken(tenantId),
  };
}

export function listInstagramConnectionStates() {
  return instagramStates
    .map((state) => getInstagramConnectionState(state.tenantId))
    .filter((state): state is NonNullable<ReturnType<typeof getInstagramConnectionState>> => Boolean(state));
}

export function findInstagramConnectionStateByVerifyToken(verifyToken?: string | null) {
  const normalizedVerifyToken = String(verifyToken ?? "").trim();
  if (!normalizedVerifyToken) {
    return null;
  }

  const matchedState = instagramStates.find((state) => String(state.verifyToken ?? "").trim() === normalizedVerifyToken);
  return matchedState ? getInstagramConnectionState(matchedState.tenantId) : null;
}

export function updateInstagramConnectionState(
  tenantId = "tenant-gigxomi",
  updates: Partial<DummyInstagramConnectionState>,
) {
  const sanitizedUpdates = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)) as typeof updates;
  const existing = getInstagramConnectionState(tenantId);
  if (!existing) {
    const next: DummyInstagramConnectionState = {
      tenantId,
      pluginEnabled: sanitizedUpdates.pluginEnabled ?? false,
      status: sanitizedUpdates.status ?? (sanitizedUpdates.pluginEnabled ? "Plugin enabled" : "Not started"),
      displayName: String(sanitizedUpdates.displayName ?? "Agency Instagram").trim(),
      username: String(sanitizedUpdates.username ?? "").trim(),
      accountId: String(sanitizedUpdates.accountId ?? "").trim(),
      accountType: String(sanitizedUpdates.accountType ?? "").trim(),
      tokenType: String(sanitizedUpdates.tokenType ?? "").trim(),
      scopes: Array.isArray(sanitizedUpdates.scopes) ? sanitizedUpdates.scopes : [],
      connectedAt: String(sanitizedUpdates.connectedAt ?? "").trim(),
      expiresAt: String(sanitizedUpdates.expiresAt ?? "").trim(),
      instagramBusinessAccountId: String(sanitizedUpdates.instagramBusinessAccountId ?? "").trim(),
      accessToken: String(sanitizedUpdates.accessToken ?? "").trim(),
      verifyToken: String(sanitizedUpdates.verifyToken ?? buildDefaultInstagramVerifyToken(tenantId)).trim(),
      graphApiVersion: normalizeInstagramGraphApiVersion(sanitizedUpdates.graphApiVersion),
      note:
        String(sanitizedUpdates.note ?? "").trim() ||
        "Enable the Instagram plugin, then connect the tenant Instagram professional account before live DM routing.",
      lastInboundAt: sanitizedUpdates.lastInboundAt,
      lastOutboundAt: sanitizedUpdates.lastOutboundAt,
      lastError: String(sanitizedUpdates.lastError ?? "").trim(),
      updatedAt: nowIso(),
    };
    instagramStates = [next, ...instagramStates];
    dummyPlatformMemory.instagramStates = instagramStates;
    releaseInstagramOwnershipFromOtherTenants(tenantId, next);
    return next;
  }

  instagramStates = instagramStates.map((state) => {
    if (state.tenantId !== tenantId) {
      return state;
    }

    const next: DummyInstagramConnectionState = {
      ...state,
      ...sanitizedUpdates,
      pluginEnabled: sanitizedUpdates.pluginEnabled ?? state.pluginEnabled ?? false,
      status:
        sanitizedUpdates.status ??
        (sanitizedUpdates.pluginEnabled ?? state.pluginEnabled ? (state.status === "Not started" ? "Plugin enabled" : state.status) : "Not started"),
      displayName: String(sanitizedUpdates.displayName ?? state.displayName ?? "Agency Instagram").trim(),
      username: String(sanitizedUpdates.username ?? state.username ?? "").trim(),
      accountId: String(sanitizedUpdates.accountId ?? state.accountId ?? "").trim(),
      accountType: String(sanitizedUpdates.accountType ?? state.accountType ?? "").trim(),
      tokenType: String(sanitizedUpdates.tokenType ?? state.tokenType ?? "").trim(),
      scopes: Array.isArray(sanitizedUpdates.scopes) ? sanitizedUpdates.scopes : state.scopes ?? [],
      connectedAt: String(sanitizedUpdates.connectedAt ?? state.connectedAt ?? "").trim(),
      expiresAt: String(sanitizedUpdates.expiresAt ?? state.expiresAt ?? "").trim(),
      instagramBusinessAccountId: String(sanitizedUpdates.instagramBusinessAccountId ?? state.instagramBusinessAccountId ?? "").trim(),
      accessToken: String(sanitizedUpdates.accessToken ?? state.accessToken ?? "").trim(),
      verifyToken: String(sanitizedUpdates.verifyToken ?? state.verifyToken ?? buildDefaultInstagramVerifyToken(tenantId)).trim(),
      graphApiVersion: normalizeInstagramGraphApiVersion(sanitizedUpdates.graphApiVersion ?? state.graphApiVersion),
      note: String(sanitizedUpdates.note ?? state.note ?? "").trim(),
      lastError: String(sanitizedUpdates.lastError ?? state.lastError ?? "").trim(),
      updatedAt: nowIso(),
    };

    if (next.pluginEnabled && next.accessToken && next.instagramBusinessAccountId && next.status !== "Ready for webhook") {
      next.status = "Connected";
    }

    return next;
  });
  dummyPlatformMemory.instagramStates = instagramStates;

  const updatedState = getInstagramConnectionState(tenantId);
  if (updatedState) {
    releaseInstagramOwnershipFromOtherTenants(tenantId, updatedState);
  }

  return getInstagramConnectionState(tenantId);
}

export function getYouTubeConnectionState(tenantId = "tenant-gigxomi") {
  return youtubeStates.find((state) => state.tenantId === tenantId) ?? null;
}

export function updateYouTubeConnectionState(
  tenantId = "tenant-gigxomi",
  updates: Partial<
    Pick<
      DummyYouTubeConnectionState,
      | "status"
      | "channelName"
      | "channelId"
      | "channelHandle"
      | "defaultPrivacy"
      | "defaultPlaylistPrefix"
      | "clientId"
      | "clientSecret"
      | "refreshToken"
      | "accessToken"
      | "note"
      | "lastUploadAt"
      | "lastPlaylistName"
      | "lastError"
    >
  >,
) {
  const sanitizedUpdates = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)) as typeof updates;
  const existing = getYouTubeConnectionState(tenantId);

  if (!existing) {
    const nextBase: Omit<DummyYouTubeConnectionState, "uploadChecklist"> = {
      tenantId,
      status: sanitizedUpdates.status ?? "Not connected",
      channelName: sanitizedUpdates.channelName ?? "",
      channelId: sanitizedUpdates.channelId ?? "",
      channelHandle: sanitizedUpdates.channelHandle ?? "",
      defaultPrivacy: sanitizedUpdates.defaultPrivacy ?? "unlisted",
      defaultPlaylistPrefix: sanitizedUpdates.defaultPlaylistPrefix ?? "Client Delivery",
      clientId: sanitizedUpdates.clientId ?? "",
      clientSecret: sanitizedUpdates.clientSecret ?? "",
      refreshToken: sanitizedUpdates.refreshToken ?? "",
      accessToken: sanitizedUpdates.accessToken ?? "",
      note: sanitizedUpdates.note ?? "Configure the agency channel used for routed client uploads.",
      lastUploadAt: sanitizedUpdates.lastUploadAt,
      lastPlaylistName: sanitizedUpdates.lastPlaylistName,
      lastError: sanitizedUpdates.lastError ?? "",
      updatedAt: nowIso(),
    };

    const next: DummyYouTubeConnectionState = {
      ...nextBase,
      uploadChecklist: buildYouTubeChecklist({
        channelName: nextBase.channelName,
        channelId: nextBase.channelId,
        channelHandle: nextBase.channelHandle,
        clientId: nextBase.clientId,
        refreshToken: nextBase.refreshToken,
        status: nextBase.status,
        defaultPlaylistPrefix: nextBase.defaultPlaylistPrefix,
      }),
    };

    youtubeStates = [next, ...youtubeStates];
    dummyPlatformMemory.youtubeStates = youtubeStates;
    return next;
  }

  youtubeStates = youtubeStates.map((state) => {
    if (state.tenantId !== tenantId) {
      return state;
    }

    const next = {
      ...state,
      ...sanitizedUpdates,
      updatedAt: nowIso(),
    };

    return {
      ...next,
      uploadChecklist: buildYouTubeChecklist({
        channelName: next.channelName,
        channelId: next.channelId,
        channelHandle: next.channelHandle,
        clientId: next.clientId,
        refreshToken: next.refreshToken,
        status: next.status,
        defaultPlaylistPrefix: next.defaultPlaylistPrefix,
      }),
    };
  });

  dummyPlatformMemory.youtubeStates = youtubeStates;
  return getYouTubeConnectionState(tenantId);
}

export function listYouTubeUploads(tenantId = "tenant-gigxomi") {
  return youtubeUploads.filter((upload) => upload.tenantId === tenantId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function updateConversationProjectIntake(conversationId: string, intake: Partial<DummyConversationProjectIntake>) {
  const index = getConversationIndex(conversationId);
  if (index === -1) {
    return null;
  }
  const conversation = conversations[index];
  const updatedAt = nowIso();
  conversations[index] = {
    ...conversation,
    projectIntake: {
      intakeFlowId: GIGXOMI_PROJECT_INTAKE_FLOW_ID,
      opsReviewStatus: "NONE",
      ...(conversation.projectIntake ?? {}),
      ...intake,
    },
    updatedAt,
  };
  dummyPlatformMemory.conversations = conversations;
  return conversations[index];
}

async function handleDefaultServiceMessageIntake(conversation: DummyConversation, bodyText: string) {
  const parsed = parseDefaultWhatsAppServiceMessage(bodyText);
  if (!parsed) {
    return null;
  }

  const targetEditor = findEditorByUsername(parsed.targetEditorUsername);
  const existingIntake = conversation.projectIntake;
  const updatedConversation = updateConversationProjectIntake(conversation.id, {
    targetEditorUsername: parsed.targetEditorUsername,
    targetEditorId: targetEditor?.id,
    serviceTitle: parsed.serviceTitle,
    servicePageUrl: parsed.servicePageUrl,
    startingPriceLabel: parsed.startingPriceLabel,
    expectedDeliveryLabel: parsed.expectedDeliveryLabel,
    opsReviewStatus: existingIntake?.opsReviewStatus === "SUBMITTED" ? "SUBMITTED" : "WAITING_FOR_CLIENT",
  });

  if (existingIntake?.lastFlowMessageId) {
    return updatedConversation;
  }

  const delivery = await sendWhatsAppProjectIntakeFlow({
    tenantId: conversation.tenantId,
    to: conversation.customerPhone,
    conversationId: conversation.id,
    customerName: conversation.customerName,
    serviceTitle: parsed.serviceTitle,
    targetEditorUsername: parsed.targetEditorUsername,
  });

  updateConversationProjectIntake(conversation.id, {
    lastFlowMessageId: delivery.messageId,
    opsReviewStatus: "WAITING_FOR_CLIENT",
  });
  appendConversationMessage(conversation.id, {
    role: "admin",
    lane: "internal",
    body: `Project intake Flow ${GIGXOMI_PROJECT_INTAKE_FLOW_ID} sent to the client.${parsed.serviceTitle ? `\nService: ${parsed.serviceTitle}` : ""}\nTarget editor: ${parsed.targetEditorUsername}`,
  });
  return getConversationById(conversation.id);
}

function recordProjectIntakeFromFlow(input: {
  conversation: DummyConversation;
  projectName?: string;
  googleDriveLink?: string;
  referenceVideoLink?: string;
  editingNote?: string;
  externalMessageId?: string;
}) {
  const submittedAt = nowIso();
  const updatedConversation = updateConversationProjectIntake(input.conversation.id, {
    projectName: input.projectName,
    googleDriveLink: input.googleDriveLink,
    referenceVideoLink: input.referenceVideoLink,
    editingNote: input.editingNote,
    opsReviewStatus: "SUBMITTED",
    submittedAt,
  });
  appendConversationMessage(input.conversation.id, {
    role: "admin",
    lane: "internal",
    body: [
      "Client submitted the project intake form. Ops review is required before offering it to an editor.",
      input.projectName ? `Project: ${input.projectName}` : "",
      input.googleDriveLink ? `Google Drive: ${input.googleDriveLink}` : "",
      input.referenceVideoLink ? `Reference: ${input.referenceVideoLink}` : "",
      input.editingNote ? `Editing note: ${input.editingNote}` : "",
    ].filter(Boolean).join("\n"),
    externalMessageId: input.externalMessageId,
  });
  return updatedConversation;
}

export async function ingestWhatsAppWebhookPayload(payload: unknown) {
  const body = (payload && typeof payload === "object" ? payload : {}) as {
    entry?: Array<{
      id?: string;
      changes?: Array<{
        value?: {
          metadata?: {
            display_phone_number?: string;
            phone_number_id?: string;
          };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: Array<Record<string, unknown>>;
          statuses?: Array<Record<string, unknown>>;
          payments?: Array<Record<string, unknown>>;
          payment?: Record<string, unknown>;
        };
      }>;
    }>;
  };

  let processedMessages = 0;
  let processedStatuses = 0;
  let processedPayments = 0;
  const conversationsTouched = new Set<string>();
  const summaries: string[] = [];

  const logWhatsAppOnboardingStep = (step: string, details?: unknown) => {
    console.info(`[WHATSAPP_ONBOARDING] ${step}`, details ?? {});
  };

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const metadataPhoneNumberId = String(value.metadata?.phone_number_id ?? "").trim();
      const metadataDisplayPhoneNumber = String(value.metadata?.display_phone_number ?? "").trim();
      const metadataWabaId = String(entry.id ?? "").trim();
      const tenantId = resolveTenantIdFromWhatsAppMetadata({
        displayPhoneNumber: metadataDisplayPhoneNumber,
        phoneNumberId: metadataPhoneNumberId,
        wabaId: metadataWabaId,
      });
      if (!tenantId) {
        summaries.push(
          `Unmapped WhatsApp webhook for ${metadataPhoneNumberId || metadataDisplayPhoneNumber || metadataWabaId || "unknown line"}.`,
        );
        continue;
      }
      const currentConnection = getWhatsAppConnectionState(tenantId);
      updateWhatsAppConnectionState(tenantId, {
        phoneNumberId: metadataPhoneNumberId || currentConnection?.phoneNumberId,
        phoneNumber: metadataDisplayPhoneNumber || currentConnection?.phoneNumber,
        wabaId: metadataWabaId || currentConnection?.wabaId,
        lastInboundAt: nowIso(),
        lastError: "",
        status:
          currentConnection?.status === "Not started" || currentConnection?.status === "Business submitted"
            ? "Number connected"
            : undefined,
      });
      const contacts = new Map<string, { name: string; profileImageUrl: string }>();
      const resolvedProfileImageByPhone = new Map<string, string>();
      const connectionForProfileLookup = getWhatsAppConnectionState(tenantId);
      const profileLookupAccessToken = String(connectionForProfileLookup?.accessToken ?? "").trim();
      const profileLookupPhoneNumberId = String(metadataPhoneNumberId || connectionForProfileLookup?.phoneNumberId || "").trim();
      const profileLookupGraphApiVersion = normalizeMetaGraphVersion(connectionForProfileLookup?.graphApiVersion);

      for (const contact of value.contacts ?? []) {
        const contactRecord = contact && typeof contact === "object" ? (contact as Record<string, unknown>) : {};
        const mergedProfile = {
          ...contactRecord,
          ...((contactRecord.profile && typeof contactRecord.profile === "object"
            ? contactRecord.profile
            : {}) as Record<string, unknown>),
        };
        const contactWaId = String(contact.wa_id ?? "").trim();
        const normalizedWaId = normalizeWhatsAppPhoneLookupKey(contactWaId);
        const profileImageUrl = extractWhatsAppProfileImageUrl(mergedProfile);
        const contactValue = {
          name: String(contact.profile?.name ?? "WhatsApp Customer"),
          profileImageUrl,
        };
        contacts.set(contactWaId, contactValue);
        if (normalizedWaId) {
          contacts.set(normalizedWaId, contactValue);
        }
        if (profileImageUrl) {
          resolvedProfileImageByPhone.set(contactWaId, profileImageUrl);
          if (normalizedWaId) {
            resolvedProfileImageByPhone.set(normalizedWaId, profileImageUrl);
          }
        }
      }

      for (const message of value.messages ?? []) {
        const bodyText = extractWhatsAppMessageBody(message);
        const flowReview = extractWhatsAppFlowReview(message);
        const projectIntakeFlow = extractWhatsAppProjectIntakeFlow(message);
        const attachments = buildWhatsAppMessageAttachments(message, tenantId);
        const linkAttachment = buildInboundLinkAttachment(bodyText);
        if (linkAttachment && !attachments.some((attachment) => attachment.externalUrl === linkAttachment.externalUrl)) {
          attachments.push(linkAttachment);
        }
        const customerPhone = String(message.from ?? "").trim();
        const normalizedCustomerPhone = normalizeWhatsAppPhoneLookupKey(customerPhone);
        const contactProfile = contacts.get(customerPhone) ?? (normalizedCustomerPhone ? contacts.get(normalizedCustomerPhone) : undefined);
        const customerName = contactProfile?.name ?? "WhatsApp Customer";
        let customerProfileImageUrl =
          contactProfile?.profileImageUrl ??
          resolvedProfileImageByPhone.get(customerPhone) ??
          (normalizedCustomerPhone ? resolvedProfileImageByPhone.get(normalizedCustomerPhone) : "") ??
          "";
        const externalMessageId = String((message as { id?: unknown }).id ?? "").trim();

        if ((!bodyText && !attachments.length) || !customerPhone) {
          continue;
        }

        const existingConversation = findOpenConversationByCustomerPhone(tenantId, customerPhone);
        if (existingConversation && hasConversationMessageWithExternalId(existingConversation, externalMessageId)) {
          continue;
        }

        if (!customerProfileImageUrl) {
          const existingConversationImage = String(existingConversation?.customerProfileImageUrl ?? "").trim();
          if (existingConversationImage) {
            customerProfileImageUrl = existingConversationImage;
          }
        }

        if (!customerProfileImageUrl && profileLookupAccessToken && profileLookupPhoneNumberId) {
          const lookedUpProfileImage = await resolveWhatsAppProfilePictureUrlFromMeta({
            accessToken: profileLookupAccessToken,
            graphApiVersion: profileLookupGraphApiVersion,
            phoneNumberId: profileLookupPhoneNumberId,
            customerPhone,
          }).catch(() => "");

          const persistableProfileImage = lookedUpProfileImage
            ? await resolvePersistableWhatsAppProfileImage({
                imageUrl: lookedUpProfileImage,
                accessToken: profileLookupAccessToken,
              }).catch(() => "")
            : "";

          if (persistableProfileImage) {
            customerProfileImageUrl = persistableProfileImage;
            resolvedProfileImageByPhone.set(customerPhone, persistableProfileImage);
            if (normalizedCustomerPhone) {
              resolvedProfileImageByPhone.set(normalizedCustomerPhone, persistableProfileImage);
            }
          }
        }

        const conversation =
          existingConversation ??
          createWhatsAppIntakeConversation({
            tenantId,
            customerName,
            customerPhone,
            customerProfileImageUrl,
            body: bodyText,
            externalMessageId,
            attachments,
          });

        const reviewConversation =
          flowReview?.conversationId ? getConversationById(flowReview.conversationId) ?? conversation : conversation;
        if (flowReview) {
          recordCustomerReviewFromFlow({
            conversation: reviewConversation,
            rating: flowReview.rating,
            comment: flowReview.comment,
            externalMessageId,
          });
        }

        const projectIntakeConversation =
          projectIntakeFlow?.conversationId ? getConversationById(projectIntakeFlow.conversationId) ?? conversation : conversation;
        if (projectIntakeFlow) {
          recordProjectIntakeFromFlow({
            conversation: projectIntakeConversation,
            projectName: projectIntakeFlow.projectName,
            googleDriveLink: projectIntakeFlow.googleDriveLink,
            referenceVideoLink: projectIntakeFlow.referenceVideoLink,
            editingNote: projectIntakeFlow.editingNote,
            externalMessageId,
          });
        }

        // Cloud API does not expose a live customer typing event, so we pulse typing
        // when inbound customer activity arrives to keep presence feedback visible.
        setConversationTyping(conversation.id, {
          role: "customer",
          lane: "customer",
          active: true,
        });

        if (existingConversation) {
          if (customerProfileImageUrl || customerName !== "WhatsApp Customer") {
            updateConversationCustomerProfile(existingConversation.id, {
              customerName,
              customerProfileImageUrl,
            });
          }
          appendConversationMessage(existingConversation.id, {
            role: "customer",
            lane: "customer",
            body: bodyText,
            externalMessageId,
            attachments,
          });
        }

        if (!projectIntakeFlow) {
          await handleDefaultServiceMessageIntake(conversation, bodyText);
        }

        processedMessages += 1;
        conversationsTouched.add(conversation.id);
        const messageSummary = bodyText || attachments.map((attachment) => attachment.name).join(", ") || "[Inbound WhatsApp message]";
        summaries.push(`${customerName}: ${messageSummary}`);
        logWhatsAppOnboardingStep("WHATSAPP_MESSAGE_STORED", {
          tenantId,
          conversationId: conversation.id,
          externalMessageId,
          hasBody: Boolean(bodyText),
          bodyLength: bodyText.length,
          attachmentCount: attachments.length,
        });
        logWhatsAppOnboardingStep("WHATSAPP_CONVERSATION_UPDATED", {
          tenantId,
          conversationId: conversation.id,
          existingConversation: Boolean(existingConversation),
          externalMessageId,
          summaryCount: summaries.length,
        });
      }

      for (const message of (value as { message_echoes?: Array<Record<string, unknown>> }).message_echoes ?? []) {
        const bodyText = extractWhatsAppMessageBody(message);
        const attachments = buildWhatsAppMessageAttachments(message, tenantId);
        const linkAttachment = buildInboundLinkAttachment(bodyText);
        if (linkAttachment && !attachments.some((attachment) => attachment.externalUrl === linkAttachment.externalUrl)) {
          attachments.push(linkAttachment);
        }
        const customerPhone = String((message as { to?: unknown }).to ?? "").trim();
        const externalMessageId = String((message as { id?: unknown }).id ?? "").trim();

        if ((!bodyText && !attachments.length) || !customerPhone) {
          continue;
        }

        const existingConversation = findOpenConversationByCustomerPhone(tenantId, customerPhone);
        if (existingConversation && hasConversationMessageWithExternalId(existingConversation, externalMessageId)) {
          continue;
        }

        const conversation =
          existingConversation ??
          createWhatsAppBusinessAppEchoConversation({
            tenantId,
            customerPhone,
            body: bodyText,
            externalMessageId,
            attachments,
          });

        if (existingConversation) {
          appendConversationMessage(existingConversation.id, {
            role: "admin",
            lane: "customer",
            body: bodyText,
            externalMessageId,
            attachments,
            deliveryStatus: "sent",
          });
        }

        processedMessages += 1;
        conversationsTouched.add(conversation.id);
        const messageSummary = bodyText || attachments.map((attachment) => attachment.name).join(", ") || "[WhatsApp Business App message]";
        summaries.push(`Business app: ${messageSummary}`);
        logWhatsAppOnboardingStep("WHATSAPP_MESSAGE_STORED", {
          tenantId,
          conversationId: conversation.id,
          externalMessageId,
          hasBody: Boolean(bodyText),
          bodyLength: bodyText.length,
          attachmentCount: attachments.length,
        });
        logWhatsAppOnboardingStep("WHATSAPP_CONVERSATION_UPDATED", {
          tenantId,
          conversationId: conversation.id,
          existingConversation: Boolean(existingConversation),
          externalMessageId,
          summaryCount: summaries.length,
        });
      }

      for (const status of value.statuses ?? []) {
        const deliveryStatus = normalizeWhatsAppMessageDeliveryStatus(
          String((status as { status?: unknown }).status ?? "").trim(),
        );
        const externalMessageId = String(
          (status as { id?: unknown }).id ??
            (status as { message_id?: unknown }).message_id ??
            (status as { messageId?: unknown }).messageId ??
            "",
        ).trim();

        if (deliveryStatus && externalMessageId) {
          const updatedConversation = updateConversationMessageDeliveryByExternalId(tenantId, externalMessageId, deliveryStatus);
          logWhatsAppOnboardingStep(
            updatedConversation ? "WHATSAPP_MESSAGE_STATUS_APPLIED" : "WHATSAPP_MESSAGE_STATUS_UNMATCHED",
            {
              tenantId,
              externalMessageId,
              deliveryStatus,
              conversationId: updatedConversation?.id,
            },
          );
        }
      }

      processedStatuses += (value.statuses ?? []).length;
      const paymentUpdates = collectWhatsAppPaymentUpdates(value);
      for (const update of paymentUpdates) {
        const mappedStatus = mapWhatsAppPaymentStatus(update.status);
        if (!mappedStatus) {
          continue;
        }

        const target =
          update.paymentRequestId && update.paymentRequestId.trim()
            ? findConversationByPaymentRequestId(update.paymentRequestId.trim())
            : update.orderId && update.orderId.trim()
              ? findConversationByPaymentOrderId(update.orderId.trim())
              : null;

        if (!target) {
          continue;
        }

        updatePaymentRequestStatus(target.conversationId, target.paymentRequestId, mappedStatus);
        processedPayments += 1;
      }
    }
  }

  const result = {
    processedMessages,
    processedStatuses,
    processedPayments,
    conversationsTouched: Array.from(conversationsTouched),
    summaries,
  };
  logWhatsAppOnboardingStep(processedMessages > 0 ? "WHATSAPP_WEBHOOK_MESSAGE_VISIBLE_READY" : "WHATSAPP_WEBHOOK_PROCESSED_NO_MESSAGES", {
    payload,
    result,
  });
  return result;
}

function buildInstagramMessageAttachments(event: Record<string, unknown>): DummyMessageAttachmentInput[] {
  const message = event.message && typeof event.message === "object" ? (event.message as Record<string, unknown>) : {};
  const rawAttachments = Array.isArray(message.attachments) ? message.attachments : [];

  return rawAttachments.map((rawAttachment) => {
    const attachment = rawAttachment && typeof rawAttachment === "object" ? (rawAttachment as Record<string, unknown>) : {};
    const type = String(attachment.type ?? "attachment").trim().toLowerCase() || "attachment";
    const payload = attachment.payload && typeof attachment.payload === "object" ? (attachment.payload as Record<string, unknown>) : {};
    const externalUrl = String(payload.url ?? attachment.url ?? "").trim();
    const name = type === "image" ? "Instagram image" : type === "video" ? "Instagram video" : type === "audio" ? "Instagram audio" : "Instagram attachment";
    const mimeType = type === "image" ? "image/*" : type === "video" ? "video/*" : type === "audio" ? "audio/*" : "application/octet-stream";
    const intent = classifyInboundAttachmentIntent(name, mimeType);
    return {
      name: externalUrl && /portfolio|work|behance|dribbble|instagram|youtube/i.test(externalUrl) ? "Instagram portfolio link" : name,
      mimeType: externalUrl ? "text/uri-list" : mimeType,
      externalUrl: /^https?:\/\//i.test(externalUrl) ? externalUrl : undefined,
      note: buildInboundAttachmentAcknowledgement(externalUrl ? "portfolio" : intent),
    };
  });
}

function extractInstagramMessageText(event: Record<string, unknown>) {
  const message = event.message && typeof event.message === "object" ? (event.message as Record<string, unknown>) : {};
  const postback = event.postback && typeof event.postback === "object" ? (event.postback as Record<string, unknown>) : {};
  const text = String(message.text ?? postback.title ?? postback.payload ?? "").trim();
  if (text) {
    return text;
  }

  if (Array.isArray(message.attachments) && message.attachments.length) {
    const attachments = buildInstagramMessageAttachments(event);
    return attachments[0]?.note || buildInboundAttachmentAcknowledgement("unknown");
  }

  return "";
}

function extractInstagramMessageId(event: Record<string, unknown>) {
  const message = event.message && typeof event.message === "object" ? (event.message as Record<string, unknown>) : {};
  return String(message.mid ?? message.id ?? event.message_id ?? "").trim();
}

export async function ingestInstagramWebhookPayload(payload: unknown, options?: { tenantId?: string }) {
  const body = (payload && typeof payload === "object" ? payload : {}) as {
    entry?: Array<{
      id?: string;
      messaging?: Array<Record<string, unknown>>;
    }>;
  };

  let processedMessages = 0;
  const conversationsTouched = new Set<string>();
  const summaries: string[] = [];

  for (const entry of body.entry ?? []) {
    const instagramBusinessAccountId = String(entry.id ?? "").trim();
    for (const event of entry.messaging ?? []) {
      const sender = event.sender && typeof event.sender === "object" ? (event.sender as Record<string, unknown>) : {};
      const recipient = event.recipient && typeof event.recipient === "object" ? (event.recipient as Record<string, unknown>) : {};
      const senderId = normalizeInstagramScopedUserId(String(sender.id ?? ""));
      const recipientId = normalizeInstagramScopedUserId(String(recipient.id ?? instagramBusinessAccountId));
      const tenantId =
        options?.tenantId?.trim() ||
        resolveTenantIdFromInstagramMetadata({
          instagramBusinessAccountId,
          recipientId,
        });
      const connection = getInstagramConnectionState(tenantId);
      if (!connection?.pluginEnabled) {
        continue;
      }
      const bodyText = extractInstagramMessageText(event);
      const attachments = buildInstagramMessageAttachments(event);
      const linkAttachment = buildInboundLinkAttachment(bodyText);
      if (linkAttachment && !attachments.some((attachment) => attachment.externalUrl === linkAttachment.externalUrl)) {
        attachments.push(linkAttachment);
      }
      const externalMessageId = extractInstagramMessageId(event);

      if (!senderId || senderId === recipientId || (!bodyText && !attachments.length)) {
        continue;
      }

      const existingConversation = findOpenConversationByInstagramScopedUserId(tenantId, senderId);
      if (existingConversation && hasConversationMessageWithExternalId(existingConversation, externalMessageId)) {
        continue;
      }

      const conversation =
        existingConversation ??
        createInstagramConversation({
          tenantId,
          instagramBusinessAccountId: recipientId || instagramBusinessAccountId,
          instagramScopedUserId: senderId,
          body: bodyText,
          attachments,
          externalMessageId,
        });

      if (!conversation) {
        continue;
      }

      setConversationTyping(conversation.id, {
        role: "customer",
        lane: "customer",
        active: true,
      });

      if (existingConversation) {
        appendConversationMessage(existingConversation.id, {
          role: "customer",
          lane: "customer",
          body: bodyText,
          attachments,
          externalMessageId,
        });
      }

      processedMessages += 1;
      conversationsTouched.add(conversation.id);
      summaries.push(`Instagram ${senderId}: ${bodyText}`);
      updateInstagramConnectionState(tenantId, {
        instagramBusinessAccountId: connection.instagramBusinessAccountId || recipientId || instagramBusinessAccountId,
        lastInboundAt: nowIso(),
        lastError: "",
        status: connection.status === "Plugin enabled" ? "Connected" : connection.status,
      });
    }
  }

  return {
    processedMessages,
    conversationsTouched: Array.from(conversationsTouched),
    summaries,
  };
}

function mapWhatsAppPaymentStatus(status?: string) {
  const normalized = (status ?? "").toLowerCase().trim();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("paid") || normalized.includes("success") || normalized.includes("captured") || normalized.includes("completed")) {
    return "Paid" as DummyPaymentStatus;
  }
  if (normalized.includes("fail") || normalized.includes("declin") || normalized.includes("error")) {
    return "Failed" as DummyPaymentStatus;
  }
  if (normalized.includes("cancel")) {
    return "Cancelled" as DummyPaymentStatus;
  }
  if (normalized.includes("view") || normalized.includes("opened")) {
    return "Viewed" as DummyPaymentStatus;
  }
  if (normalized.includes("pending") || normalized.includes("processing")) {
    return "Sent" as DummyPaymentStatus;
  }
  return null;
}

function collectWhatsAppPaymentUpdates(value: {
  statuses?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  payment?: Record<string, unknown>;
}) {
  const updates: Array<{ orderId?: string; paymentRequestId?: string; status?: string }> = [];
  const statusItems = value.statuses ?? [];

  for (const status of statusItems) {
    const statusValue =
      String((status as { status?: unknown }).status ?? (status as { payment_status?: unknown }).payment_status ?? (status as { paymentStatus?: unknown }).paymentStatus ?? "").trim();
    const orderId =
      String(
        (status as { order_id?: unknown }).order_id ??
          (status as { orderId?: unknown }).orderId ??
          (status as { reference_id?: unknown }).reference_id ??
          (status as { referenceId?: unknown }).referenceId ??
          (status as { order?: { id?: unknown } }).order?.id ??
          (status as { order?: { reference_id?: unknown } }).order?.reference_id ??
          (status as { payment?: { reference_id?: unknown } }).payment?.reference_id ??
          "",
      ).trim();
    const paymentRequestId =
      String((status as { payment_request_id?: unknown }).payment_request_id ?? (status as { paymentRequestId?: unknown }).paymentRequestId ?? "").trim();

    if (statusValue || orderId || paymentRequestId) {
      updates.push({ status: statusValue || undefined, orderId: orderId || undefined, paymentRequestId: paymentRequestId || undefined });
    }
  }

  for (const payment of value.payments ?? []) {
    const statusValue =
      String((payment as { status?: unknown }).status ?? (payment as { payment_status?: unknown }).payment_status ?? (payment as { paymentStatus?: unknown }).paymentStatus ?? "").trim();
    const orderId =
      String(
        (payment as { order_id?: unknown }).order_id ??
          (payment as { orderId?: unknown }).orderId ??
          (payment as { reference_id?: unknown }).reference_id ??
          (payment as { referenceId?: unknown }).referenceId ??
          "",
      ).trim();
    const paymentRequestId =
      String((payment as { payment_request_id?: unknown }).payment_request_id ?? (payment as { paymentRequestId?: unknown }).paymentRequestId ?? "").trim();

    if (statusValue || orderId || paymentRequestId) {
      updates.push({ status: statusValue || undefined, orderId: orderId || undefined, paymentRequestId: paymentRequestId || undefined });
    }
  }

  if (value.payment) {
    const payment = value.payment;
    const statusValue =
      String((payment as { status?: unknown }).status ?? (payment as { payment_status?: unknown }).payment_status ?? (payment as { paymentStatus?: unknown }).paymentStatus ?? "").trim();
    const orderId =
      String(
        (payment as { order_id?: unknown }).order_id ??
          (payment as { orderId?: unknown }).orderId ??
          (payment as { reference_id?: unknown }).reference_id ??
          (payment as { referenceId?: unknown }).referenceId ??
          "",
      ).trim();
    const paymentRequestId =
      String((payment as { payment_request_id?: unknown }).payment_request_id ?? (payment as { paymentRequestId?: unknown }).paymentRequestId ?? "").trim();

    if (statusValue || orderId || paymentRequestId) {
      updates.push({ status: statusValue || undefined, orderId: orderId || undefined, paymentRequestId: paymentRequestId || undefined });
    }
  }

  return updates;
}

function findConversationByPaymentRequestId(paymentRequestId: string) {
  for (const conversation of conversations) {
    const match = conversation.paymentRequests.find((item) => item.id === paymentRequestId);
    if (match) {
      return { conversationId: conversation.id, paymentRequestId: match.id };
    }
  }
  return null;
}

function findConversationByPaymentOrderId(orderId: string) {
  for (const conversation of conversations) {
    const match = conversation.paymentRequests.find((item) => item.paymentOrderId === orderId);
    if (match) {
      return { conversationId: conversation.id, paymentRequestId: match.id };
    }
  }
  return null;
}

function normalizeWhatsAppDeliveryError(value?: string) {
  const rawMessage = String(value ?? "").trim();
  if (!rawMessage) {
    return "WhatsApp delivery could not be completed right now.";
  }
  if (/timed out/i.test(rawMessage) || /AbortError/i.test(rawMessage) || /The operation was aborted/i.test(rawMessage)) {
    return "WhatsApp send timed out while waiting for Meta. Please retry once. If it keeps happening, refresh the WhatsApp line status.";
  }
  if (/\b133010\b/i.test(rawMessage) || /Account not registered/i.test(rawMessage)) {
    return "This WhatsApp line is connected in Meta but is not fully registered for Cloud API sending yet. Finish the Meta number registration step, then use Refresh line status or Reconnect WhatsApp in Gigxomi.";
  }
  if (/Unsupported post request/i.test(rawMessage) && /Object with ID/i.test(rawMessage)) {
    return "Gigxomi is still using the WhatsApp account ID instead of the phone number ID for this line. Refresh the WhatsApp setup once and try again.";
  }
  if (/Error validating access token/i.test(rawMessage)) {
    return "WhatsApp access token has expired for this tenant. Refresh the WhatsApp setup to resume customer-lane sending.";
  }
  if (/OAuthException/i.test(rawMessage)) {
    return "WhatsApp authorization needs attention for this tenant. Refresh the WhatsApp setup and try again.";
  }
  return rawMessage;
}

function shouldRetryOtpTemplateWithAlternatePayload(error?: string) {
  const normalized = String(error ?? "").toLowerCase();
  return (
    normalized.includes("parameter") ||
    normalized.includes("param") ||
    normalized.includes("button") ||
    normalized.includes("sub_type") ||
    normalized.includes("copy_code") ||
    normalized.includes("coupon_code") ||
    normalized.includes("template")
  );
}

function buildAuthenticationTemplateComponentVariants(code: string) {
  return [
    [
      {
        type: "body",
        parameters: [{ type: "text", text: code }],
      },
      {
        type: "button",
        sub_type: "copy_code",
        index: "0",
        parameters: [{ type: "text", text: code }],
      },
    ],
    [
      {
        type: "body",
        parameters: [{ type: "text", text: code }],
      },
      {
        type: "button",
        sub_type: "COPY_CODE",
        index: "0",
        parameters: [{ type: "text", text: code }],
      },
    ],
    [
      {
        type: "body",
        parameters: [{ type: "text", text: code }],
      },
      {
        type: "button",
        sub_type: "copy_code",
        index: "0",
        parameters: [{ type: "coupon_code", coupon_code: code }],
      },
    ],
    [
      {
        type: "body",
        parameters: [{ type: "text", text: code }],
      },
    ],
  ] satisfies Array<Array<Record<string, unknown>>>;
}

async function postToMetaMessagesApi(
  accessToken: string,
  graphApiVersion: string,
  phoneNumberId: string,
  body: Record<string, unknown>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    return await fetch(`https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWhatsAppOrderDetails(params: {
  tenantId: string;
  to: string;
  templateName: string;
  orderDetails: ReturnType<typeof buildWhatsAppOrderDetailsPayload>;
}) {
  const connection = getWhatsAppConnectionState(params.tenantId);
  if (!connection) {
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: "WhatsApp connection is not configured for this tenant.",
    };
  }

  const recipient = normalizePhone(params.to);
  if (!recipient) {
    const error = "Recipient number is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  if (!connection.phoneNumberId.trim() || !connection.accessToken.trim()) {
    const error =
      connection.lastError?.trim() ||
      connection.note?.trim() ||
      "Phone number ID or access token is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  if (!params.templateName.trim()) {
    const error = "Payment template name is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  if (!params.orderDetails.payment_settings?.payment_configuration_name) {
    const error = "Payment configuration name is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  try {
    const response = await postToMetaMessagesApi(connection.accessToken, connection.graphApiVersion, connection.phoneNumberId, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: "en_US" },
          components: [
            {
              type: "button",
              sub_type: "order_details",
              index: "0",
              parameters: [
                {
                  type: "order_details",
                  order_details: params.orderDetails,
                },
              ],
            },
          ],
        },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    };

    if (!response.ok) {
      const error = normalizeWhatsAppDeliveryError(payload.error?.message || "Meta Graph API rejected the payment request send.");
      updateWhatsAppConnectionState(params.tenantId, {
        lastError: error,
        status: /\b133010\b/i.test(error) || /not fully registered/i.test(error) ? "Number connected" : connection.status,
        note: /\b133010\b/i.test(error) || /not fully registered/i.test(error)
          ? "Meta accepted the tenant setup, but this phone number is still not fully registered for Cloud API sending. Refresh line status after Meta activates the number or reconnect the setup."
          : connection.note,
      });
      return {
        ok: false,
        mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
        error,
      };
    }

    updateWhatsAppConnectionState(params.tenantId, {
      lastOutboundAt: nowIso(),
      lastError: "",
      status: connection.status === "Business submitted" ? "Number connected" : connection.status,
    });

    return {
      ok: true,
      mode: "whatsapp-sent" as DummyWhatsAppDeliveryMode,
      messageId: payload.messages?.[0]?.id ?? "",
    };
  } catch (error) {
    const message = normalizeWhatsAppDeliveryError(error instanceof Error ? error.message : "Unable to reach the Meta Graph API.");
    updateWhatsAppConnectionState(params.tenantId, { lastError: message });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: message,
    };
  }
}

async function sendWhatsAppTextMessage(params: {
  tenantId: string;
  to: string;
  body: string;
}) {
  const connection = getWhatsAppConnectionState(params.tenantId);
  if (!connection) {
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: "WhatsApp connection is not configured for this tenant.",
    };
  }

  const recipient = normalizePhone(params.to);
  if (!recipient) {
    const error = "Recipient number is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  const effectivePhoneNumberId =
    connection.phoneNumberId.trim() ||
    process.env.META_CAPI_WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    process.env.GIGXOMI_PUBLIC_AUTH_WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    "";
  const effectiveAccessToken =
    connection.accessToken.trim() ||
    process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.META_CAPI_WHATSAPP_ACCESS_TOKEN?.trim() ||
    "";

  if (!effectivePhoneNumberId || !effectiveAccessToken) {
    const error =
      connection.lastError?.trim() ||
      connection.note?.trim() ||
      "Phone number ID or access token is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  try {
    const response = await postToMetaMessagesApi(effectiveAccessToken, connection.graphApiVersion, effectivePhoneNumberId, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: {
          preview_url: false,
          body: params.body,
        },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    };

    if (!response.ok) {
      const error = normalizeWhatsAppDeliveryError(payload.error?.message || "Meta Graph API rejected the message send.");
      updateWhatsAppConnectionState(params.tenantId, {
        lastError: error,
        status: /\b133010\b/i.test(error) || /not fully registered/i.test(error) ? "Number connected" : connection.status,
        note: /\b133010\b/i.test(error) || /not fully registered/i.test(error)
          ? "Meta accepted the tenant setup, but this phone number is still not fully registered for Cloud API sending. Refresh line status after Meta activates the number or reconnect the setup."
          : connection.note,
      });
      return {
        ok: false,
        mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
        error,
      };
    }

    updateWhatsAppConnectionState(params.tenantId, {
      lastOutboundAt: nowIso(),
      lastError: "",
      status: connection.status === "Business submitted" ? "Number connected" : connection.status,
    });

    return {
      ok: true,
      mode: "whatsapp-sent" as DummyWhatsAppDeliveryMode,
      messageId: payload.messages?.[0]?.id ?? "",
    };
  } catch (error) {
    const isAbort = error instanceof Error && (error.name === "AbortError" || /abort/i.test(error.message));
    const rawMessage = isAbort
      ? "Meta WhatsApp delivery timed out after 20s. Check Meta phone number ID and connection token."
      : error instanceof Error
        ? error.message
        : "Unable to reach the Meta Graph API.";
    const message = normalizeWhatsAppDeliveryError(rawMessage);
    updateWhatsAppConnectionState(params.tenantId, { lastError: message });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: message,
    };
  }
}

async function sendWhatsAppCallToActionTemplate(params: {
  tenantId: string;
  to: string;
  templateName: string;
  languageCode: string;
  bodyVariables?: string[];
  buttonUrlVariable?: string;
}) {
  const connection = getWhatsAppConnectionState(params.tenantId);
  if (!connection) {
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: "WhatsApp connection is not configured for this tenant.",
    };
  }

  const recipient = normalizePhone(params.to);
  if (!recipient) {
    const error = "Recipient number is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  if (!connection.phoneNumberId.trim() || !connection.accessToken.trim()) {
    const error =
      connection.lastError?.trim() ||
      connection.note?.trim() ||
      "Phone number ID or access token is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  if (!params.templateName.trim()) {
    const error = "Template name is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  const components: Array<Record<string, unknown>> = [];
  const bodyVariables = (params.bodyVariables ?? []).map((value) => value.trim()).filter(Boolean);
  if (bodyVariables.length) {
    components.push({
      type: "body",
      parameters: bodyVariables.map((value) => ({
        type: "text",
        text: value.slice(0, 1024),
      })),
    });
  }

  if (params.buttonUrlVariable?.trim()) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        {
          type: "text",
          text: params.buttonUrlVariable.trim().slice(0, 1024),
        },
      ],
    });
  }

  try {
    const response = await postToMetaMessagesApi(connection.accessToken, connection.graphApiVersion, connection.phoneNumberId, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "template",
      template: {
        name: params.templateName,
        language: {
          policy: "deterministic",
          code: normalizeTemplateLanguageCode(params.languageCode),
        },
        ...(components.length ? { components } : {}),
      },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    };

    if (!response.ok) {
      const error = normalizeWhatsAppDeliveryError(payload.error?.message || "Meta Graph API rejected the template send.");
      updateWhatsAppConnectionState(params.tenantId, {
        lastError: error,
        status: /\b133010\b/i.test(error) || /not fully registered/i.test(error) ? "Number connected" : connection.status,
        note: /\b133010\b/i.test(error) || /not fully registered/i.test(error)
          ? "Meta accepted the tenant setup, but this phone number is still not fully registered for Cloud API sending. Refresh line status after Meta activates the number or reconnect the setup."
          : connection.note,
      });
      return {
        ok: false,
        mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
        error,
      };
    }

    updateWhatsAppConnectionState(params.tenantId, {
      lastOutboundAt: nowIso(),
      lastError: "",
      status: connection.status === "Business submitted" ? "Number connected" : connection.status,
    });

    return {
      ok: true,
      mode: "whatsapp-sent" as DummyWhatsAppDeliveryMode,
      messageId: payload.messages?.[0]?.id ?? "",
    };
  } catch (error) {
    const message = normalizeWhatsAppDeliveryError(error instanceof Error ? error.message : "Unable to reach the Meta Graph API.");
    updateWhatsAppConnectionState(params.tenantId, { lastError: message });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: message,
    };
  }
}

async function sendWhatsAppAuthenticationTemplate(params: {
  tenantId: string;
  to: string;
  templateName: string;
  languageCode: string;
  code: string;
}) {
  const connection = getWhatsAppConnectionState(params.tenantId);
  if (!connection) {
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: "WhatsApp connection is not configured for this tenant.",
    };
  }

  const recipient = normalizePhone(params.to);
  if (!recipient) {
    const error = "Recipient number is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  if (!connection.phoneNumberId.trim() || !connection.accessToken.trim()) {
    const error =
      connection.lastError?.trim() ||
      connection.note?.trim() ||
      "Phone number ID or access token is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  if (!params.templateName.trim()) {
    const error = "OTP template name is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  const languageCode = normalizeTemplateLanguageCode(params.languageCode);
  const componentVariants = buildAuthenticationTemplateComponentVariants(params.code);
  let lastError = "Meta Graph API rejected the authentication template send.";

  for (let index = 0; index < componentVariants.length; index += 1) {
    try {
      const response = await postToMetaMessagesApi(connection.accessToken, connection.graphApiVersion, connection.phoneNumberId, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "template",
        template: {
          name: params.templateName,
          language: {
            policy: "deterministic",
            code: languageCode,
          },
          components: componentVariants[index],
        },
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        messages?: Array<{ id?: string }>;
      };

      if (!response.ok) {
        lastError = normalizeWhatsAppDeliveryError(payload.error?.message || lastError);
        const shouldRetry =
          index < componentVariants.length - 1 && shouldRetryOtpTemplateWithAlternatePayload(lastError);
        if (shouldRetry) {
          continue;
        }

        updateWhatsAppConnectionState(params.tenantId, {
          lastError,
          status: /\b133010\b/i.test(lastError) || /not fully registered/i.test(lastError) ? "Number connected" : connection.status,
          note:
            /\b133010\b/i.test(lastError) || /not fully registered/i.test(lastError)
              ? "Meta accepted the tenant setup, but this phone number is still not fully registered for Cloud API sending. Refresh line status after Meta activates the number or reconnect the setup."
              : connection.note,
        });
        return {
          ok: false,
          mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
          error: lastError,
        };
      }

      updateWhatsAppConnectionState(params.tenantId, {
        lastOutboundAt: nowIso(),
        lastError: "",
        status: connection.status === "Business submitted" ? "Number connected" : connection.status,
      });

      return {
        ok: true,
        mode: "whatsapp-sent" as DummyWhatsAppDeliveryMode,
        messageId: payload.messages?.[0]?.id ?? "",
      };
    } catch (error) {
      lastError = normalizeWhatsAppDeliveryError(error instanceof Error ? error.message : "Unable to reach the Meta Graph API.");
      updateWhatsAppConnectionState(params.tenantId, { lastError });
      return {
        ok: false,
        mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
        error: lastError,
      };
    }
  }

  updateWhatsAppConnectionState(params.tenantId, { lastError });
  return {
    ok: false,
    mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
    error: lastError,
  };
}

async function sendWhatsAppTypingIndicator(params: { tenantId: string; messageId: string }) {
  const connection = getWhatsAppConnectionState(params.tenantId);
  if (!connection) {
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: "WhatsApp connection is not configured for this tenant.",
    };
  }

  const messageId = params.messageId.trim();
  if (!messageId) {
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error: "Missing inbound WhatsApp message id for typing indicator.",
    };
  }

  if (!connection.phoneNumberId.trim() || !connection.accessToken.trim()) {
    const error =
      connection.lastError?.trim() ||
      connection.note?.trim() ||
      "Phone number ID or access token is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  try {
    const response = await postToMetaMessagesApi(connection.accessToken, connection.graphApiVersion, connection.phoneNumberId, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: {
        type: "text",
      },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };

    if (!response.ok) {
      const error = normalizeWhatsAppDeliveryError(payload.error?.message || "Meta Graph API rejected the typing indicator request.");
      updateWhatsAppConnectionState(params.tenantId, { lastError: error });
      return {
        ok: false,
        mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
        error,
      };
    }

    updateWhatsAppConnectionState(params.tenantId, {
      lastOutboundAt: nowIso(),
      lastError: "",
    });

    return {
      ok: true,
      mode: "whatsapp-sent" as DummyWhatsAppDeliveryMode,
    };
  } catch (error) {
    const message = normalizeWhatsAppDeliveryError(error instanceof Error ? error.message : "Unable to reach the Meta Graph API.");
    updateWhatsAppConnectionState(params.tenantId, { lastError: message });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: message,
    };
  }
}

export async function sendConversationTypingIndicator(input: {
  conversationId: string;
  role: DummyConversationRole;
  lane: DummyConversationLane;
  active: boolean;
}) {
  if (!input.active || input.role === "customer" || input.lane !== "customer") {
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error: "Typing indicator is only sent for active agent typing in the customer lane.",
    };
  }

  const conversation = getConversationById(input.conversationId);
  if (!conversation || conversation.isInAppCustomerThread) {
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error: "Conversation is not eligible for WhatsApp typing indicators.",
    };
  }

  const inboundMessageWithId = [...conversation.messages]
    .reverse()
    .find(
      (message) =>
        message.lane === "customer" &&
        message.senderRole === "customer" &&
        Boolean(message.externalMessageId?.trim()),
    );

  if (!inboundMessageWithId?.externalMessageId) {
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error: "No inbound WhatsApp message id is available for this thread yet.",
    };
  }

  return sendWhatsAppTypingIndicator({
    tenantId: conversation.tenantId,
    messageId: inboundMessageWithId.externalMessageId,
  });
}

async function sendWhatsAppText(params: { tenantId: string; to: string; body: string }) {
  const connection = getWhatsAppConnectionState(params.tenantId);
  if (!connection) {
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: "WhatsApp connection is not configured for this tenant.",
    };
  }

  const recipient = normalizePhone(params.to);
  if (!recipient) {
    const error = "Recipient number is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  if (!connection.phoneNumberId.trim() || !connection.accessToken.trim()) {
    const error =
      connection.lastError?.trim() ||
      connection.note?.trim() ||
      "Phone number ID or access token is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  try {
    const response = await postToMetaMessagesApi(connection.accessToken, connection.graphApiVersion, connection.phoneNumberId, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: {
          preview_url: false,
          body: params.body,
        },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    };

    if (!response.ok) {
      const error = normalizeWhatsAppDeliveryError(payload.error?.message || "Meta Graph API rejected the message send.");
      updateWhatsAppConnectionState(params.tenantId, {
        lastError: error,
        status: /\b133010\b/i.test(error) || /not fully registered/i.test(error) ? "Number connected" : connection.status,
        note: /\b133010\b/i.test(error) || /not fully registered/i.test(error)
          ? "Meta accepted the tenant setup, but this phone number is still not fully registered for Cloud API sending. Refresh line status after Meta activates the number or reconnect the setup."
          : connection.note,
      });
      return {
        ok: false,
        mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
        error,
      };
    }

    updateWhatsAppConnectionState(params.tenantId, {
      lastOutboundAt: nowIso(),
      lastError: "",
      status: connection.status === "Business submitted" ? "Number connected" : connection.status,
    });

    return {
      ok: true,
      mode: "whatsapp-sent" as DummyWhatsAppDeliveryMode,
      messageId: payload.messages?.[0]?.id ?? "",
    };
  } catch (error) {
    const message = normalizeWhatsAppDeliveryError(error instanceof Error ? error.message : "Unable to reach the Meta Graph API.");
    updateWhatsAppConnectionState(params.tenantId, { lastError: message });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: message,
    };
  }
}

async function sendWhatsAppReviewFlow(params: {
  tenantId: string;
  to: string;
  conversationId: string;
  customerName?: string;
  assignedFreelancerId?: string;
}) {
  const connection = getWhatsAppConnectionState(params.tenantId);
  if (!connection) {
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: "WhatsApp connection is not configured for this tenant.",
    };
  }

  const recipient = normalizePhone(params.to);
  if (!recipient) {
    const error = "Recipient number is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  if (!connection.phoneNumberId.trim() || !connection.accessToken.trim()) {
    const error =
      connection.lastError?.trim() ||
      connection.note?.trim() ||
      "Phone number ID or access token is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  try {
    const response = await postToMetaMessagesApi(connection.accessToken, connection.graphApiVersion, connection.phoneNumberId, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "interactive",
      interactive: {
        type: "flow",
        header: {
          type: "text",
          text: "Gigxomi review",
        },
        body: {
          text: `Hi ${params.customerName?.trim() || "there"}, please rate your Gigxomi project delivery.`,
        },
        footer: {
          text: "Your feedback helps improve the editor and agency profile.",
        },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_id: GIGXOMI_REVIEW_FLOW_ID,
            flow_cta: "Leave review",
            flow_token: `review:${params.conversationId}:${Date.now()}`,
            flow_action_payload: {
              data: {
                conversationId: params.conversationId,
                tenantId: params.tenantId,
                assignedFreelancerId: params.assignedFreelancerId ?? "",
              },
            },
          },
        },
      },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    };

    if (!response.ok) {
      const error = normalizeWhatsAppDeliveryError(payload.error?.message || "Meta Graph API rejected the review flow send.");
      updateWhatsAppConnectionState(params.tenantId, { lastError: error });
      return {
        ok: false,
        mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
        error,
      };
    }

    updateWhatsAppConnectionState(params.tenantId, {
      lastOutboundAt: nowIso(),
      lastError: "",
      status: connection.status === "Business submitted" ? "Number connected" : connection.status,
    });

    return {
      ok: true,
      mode: "whatsapp-sent" as DummyWhatsAppDeliveryMode,
      messageId: payload.messages?.[0]?.id ?? "",
    };
  } catch (error) {
    const message = normalizeWhatsAppDeliveryError(error instanceof Error ? error.message : "Unable to reach the Meta Graph API.");
    updateWhatsAppConnectionState(params.tenantId, { lastError: message });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: message,
    };
  }
}

async function sendWhatsAppProjectIntakeFlow(params: {
  tenantId: string;
  to: string;
  conversationId: string;
  customerName?: string;
  serviceTitle?: string;
  targetEditorUsername?: string;
}) {
  const connection = getWhatsAppConnectionState(params.tenantId);
  if (!connection) {
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: "WhatsApp connection is not configured for this tenant.",
    };
  }

  const recipient = normalizePhone(params.to);
  if (!recipient) {
    const error = "Recipient number is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  if (!connection.phoneNumberId.trim() || !connection.accessToken.trim()) {
    const error = connection.lastError?.trim() || connection.note?.trim() || "Phone number ID or access token is missing.";
    updateWhatsAppConnectionState(params.tenantId, { lastError: error });
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error,
    };
  }

  try {
    const response = await postToMetaMessagesApi(connection.accessToken, connection.graphApiVersion, connection.phoneNumberId, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "interactive",
      interactive: {
        type: "flow",
        header: {
          type: "text",
          text: "Gigxomi project intake",
        },
        body: {
          text: "To edit your video, please fill this form.",
        },
        footer: {
          text: params.serviceTitle?.trim() || "Gigxomi video editing",
        },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_id: GIGXOMI_PROJECT_INTAKE_FLOW_ID,
            flow_cta: "Fill project form",
            flow_token: `project-intake:${params.conversationId}:${Date.now()}`,
            flow_action_payload: {
              data: {
                conversationId: params.conversationId,
                tenantId: params.tenantId,
                serviceTitle: params.serviceTitle ?? "",
                targetEditorUsername: params.targetEditorUsername ?? "",
                coverImageUrl: "/gigxomi-project-intake-cover.svg",
              },
            },
          },
        },
      },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    };

    if (!response.ok) {
      const error = normalizeWhatsAppDeliveryError(payload.error?.message || "Meta Graph API rejected the project intake flow send.");
      updateWhatsAppConnectionState(params.tenantId, { lastError: error });
      return {
        ok: false,
        mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
        error,
      };
    }

    updateWhatsAppConnectionState(params.tenantId, {
      lastOutboundAt: nowIso(),
      lastError: "",
      status: connection.status === "Business submitted" ? "Number connected" : connection.status,
    });

    return {
      ok: true,
      mode: "whatsapp-sent" as DummyWhatsAppDeliveryMode,
      messageId: payload.messages?.[0]?.id ?? "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send project intake flow.";
    const normalized = normalizeWhatsAppDeliveryError(message);
    updateWhatsAppConnectionState(params.tenantId, { lastError: normalized });
    return {
      ok: false,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: normalized,
    };
  }
}

async function sendInstagramText(params: { conversation: DummyConversation; body: string }) {
  const hasCustomerInitiatedThread = params.conversation.messages.some(
    (message) => message.senderRole === "customer" && Boolean(message.externalMessageId?.trim()),
  );
  if (!hasCustomerInitiatedThread) {
    return {
      ok: false,
      mode: "instagram-failed" as DummyWhatsAppDeliveryMode,
      error: "Instagram replies are allowed only after the customer starts the conversation.",
    };
  }

  const connection = getInstagramConnectionState(params.conversation.tenantId);
  if (!connection?.pluginEnabled) {
    return {
      ok: false,
      mode: "local-only" as DummyWhatsAppDeliveryMode,
      error: "Instagram plugin is not enabled for this agency.",
    };
  }

  const recipientId = getInstagramRecipientId(params.conversation);
  const result = await sendInstagramTextMessage({
    accessToken: connection.accessToken,
    recipientId,
    body: params.body,
    graphApiVersion: connection.graphApiVersion,
    instagramBusinessAccountId: connection.instagramBusinessAccountId,
  });

  updateInstagramConnectionState(params.conversation.tenantId, {
    lastOutboundAt: result.ok ? nowIso() : connection.lastOutboundAt,
    lastError: result.ok ? "" : result.error,
    status: result.ok && connection.status === "Plugin enabled" ? "Connected" : connection.status,
  });

  return result;
}

function decodeAttachmentDataUrl(input: string) {
  const value = input.trim();
  const match = value.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);
  if (!match) {
    return null;
  }
  const mimeType = (match[1] || "application/octet-stream").trim().toLowerCase();
  const base64 = match[2]?.trim();
  if (!base64) {
    return null;
  }
  try {
    return {
      mimeType,
      bytes: Buffer.from(base64, "base64"),
    };
  } catch {
    return null;
  }
}

async function uploadWhatsAppMediaFromAttachment(params: {
  tenantId: string;
  attachment: DummyMessageAttachmentInput;
}) {
  const connection = getWhatsAppConnectionState(params.tenantId);
  if (!connection?.accessToken?.trim() || !connection.phoneNumberId?.trim()) {
    return { ok: false as const, error: "WhatsApp media upload is not configured." };
  }
  const source = String(params.attachment.externalUrl ?? "").trim();
  const decoded = decodeAttachmentDataUrl(source);
  if (!decoded) {
    return { ok: false as const, error: "Attachment upload source is missing or not supported." };
  }

  const formData = new FormData();
  formData.set("messaging_product", "whatsapp");
  const fileName = params.attachment.name?.trim() || `upload-${Date.now()}`;
  const mimeType = params.attachment.mimeType?.trim() || decoded.mimeType || "application/octet-stream";
  formData.set("file", new Blob([decoded.bytes], { type: mimeType }), fileName);

  const endpoint = new URL(`https://graph.facebook.com/${connection.graphApiVersion}/${connection.phoneNumberId}/media`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
    },
    body: formData,
  }).catch((error) => ({
    ok: false,
    status: 0,
    json: async () => ({ error: { message: error instanceof Error ? error.message : "Upload failed." } }),
  } as unknown as Response));

  const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) {
    return { ok: false as const, error: normalizeWhatsAppDeliveryError(payload.error?.message || "Meta media upload failed.") };
  }
  return { ok: true as const, mediaId: payload.id, mimeType };
}

async function sendWhatsAppMediaAttachment(params: {
  tenantId: string;
  to: string;
  attachment: DummyMessageAttachmentInput;
}) {
  const connection = getWhatsAppConnectionState(params.tenantId);
  if (!connection) {
    return { ok: false as const, mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode, error: "WhatsApp connection is not configured." };
  }
  const recipient = normalizePhone(params.to);
  if (!recipient) {
    return { ok: false as const, mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode, error: "Recipient number is missing." };
  }

  const uploaded = await uploadWhatsAppMediaFromAttachment({
    tenantId: params.tenantId,
    attachment: params.attachment,
  });
  if (!uploaded.ok) {
    return { ok: false as const, mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode, error: uploaded.error };
  }

  const kind = classifyAttachmentKind(params.attachment);
  const type: "image" | "audio" | "video" | "document" =
    kind === "image" ? "image" : kind === "video" ? "video" : kind === "voice-note" || kind === "audio" ? "audio" : "document";
  const mediaPayload =
    type === "image"
      ? { image: { id: uploaded.mediaId, ...(params.attachment.note?.trim() ? { caption: params.attachment.note.trim().slice(0, 1024) } : {}) } }
      : type === "video"
        ? { video: { id: uploaded.mediaId, ...(params.attachment.note?.trim() ? { caption: params.attachment.note.trim().slice(0, 1024) } : {}) } }
        : type === "audio"
          ? { audio: { id: uploaded.mediaId } }
          : { document: { id: uploaded.mediaId, ...(params.attachment.name?.trim() ? { filename: params.attachment.name.trim().slice(0, 255) } : {}) } };

  const response = await postToMetaMessagesApi(connection.accessToken, connection.graphApiVersion, connection.phoneNumberId, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type,
    ...mediaPayload,
  });
  const payload = (await response.json().catch(() => ({}))) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
  if (!response.ok) {
    return {
      ok: false as const,
      mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
      error: normalizeWhatsAppDeliveryError(payload.error?.message || "Meta media message send failed."),
    };
  }

  updateWhatsAppConnectionState(params.tenantId, {
    lastOutboundAt: nowIso(),
    lastError: "",
    status: connection.status === "Business submitted" ? "Number connected" : connection.status,
  });
  return { ok: true as const, mode: "whatsapp-sent" as DummyWhatsAppDeliveryMode, messageId: payload.messages?.[0]?.id ?? "" };
}

export async function deliverConversationMessage(
  conversationId: string,
  input: {
    role: DummyConversationRole;
    body: string;
    lane: DummyConversationLane;
    visibility?: DummyMessageVisibility;
    clientMessageId?: string;
    attachments?: DummyMessageAttachmentInput[];
  },
) {
  const effectiveLane = input.role === "customer" ? "customer" : input.lane;
  const conversation = getConversationById(conversationId);
  if (!conversation) {
    return null;
  }
  const existingClientMessage = getConversationMessageByClientMessageId(conversation, input.clientMessageId);
  if (existingClientMessage) {
    return {
      conversation,
      delivery: {
        ok: true,
        mode: "local-only" as DummyWhatsAppDeliveryMode,
      },
    };
  }

  if (input.role === "customer" || effectiveLane === "internal") {
    const nextConversation = appendConversationMessage(conversationId, { ...input, lane: effectiveLane });
    return {
      conversation: nextConversation ?? conversation,
      delivery: {
        ok: true,
        mode: "local-only" as DummyWhatsAppDeliveryMode,
      },
    };
  }

  const senderLabel = getConversationMessageSenderLabel(conversation, input.role, effectiveLane);
  const outboundText = buildWhatsAppOutboundTextForCustomerLane(input.role, input.body, senderLabel);
  const sourceChannel = normalizeConversationSourceChannel(conversation);
  if (sourceChannel === "instagram") {
    const delivery =
      outboundText.length > 0
        ? await sendInstagramText({
            conversation,
            body: outboundText,
          })
        : ({
            ok: true,
            mode: "local-only" as DummyWhatsAppDeliveryMode,
          });

    const attachmentFailure =
      input.attachments?.length && delivery.ok
        ? {
            ok: false as const,
            mode: "instagram-failed" as DummyWhatsAppDeliveryMode,
            error: "Instagram customer-lane attachment sending is not enabled yet. Send a text reply or use internal coordination for files.",
          }
        : null;
    const finalDelivery = attachmentFailure ?? delivery;
    const nextConversation = appendConversationMessage(conversationId, {
      ...input,
      lane: effectiveLane,
      ...getConversationMessageDeliveryMeta(finalDelivery),
    });

    return {
      conversation: nextConversation ?? getConversationById(conversationId) ?? conversation,
      delivery: finalDelivery,
    };
  }

  const textDelivery =
    outboundText.length > 0
      ? await sendWhatsAppText({
          tenantId: conversation.tenantId,
          to: conversation.customerPhone,
          body: outboundText,
        })
      : ({
          ok: true,
          mode: "local-only" as DummyWhatsAppDeliveryMode,
        });

  const mediaDeliveries =
    input.attachments?.length
      ? await Promise.all(
          input.attachments.map((attachment) =>
            sendWhatsAppMediaAttachment({
              tenantId: conversation.tenantId,
              to: conversation.customerPhone,
              attachment,
            }).catch((error) => ({
              ok: false as const,
              mode: "whatsapp-failed" as DummyWhatsAppDeliveryMode,
              error: error instanceof Error ? error.message : "Media send failed.",
            })),
          ),
        )
      : [];
  const firstMediaFailure = mediaDeliveries.find((item) => !item.ok);
  const firstMediaSuccess = mediaDeliveries.find((item) => item.ok);
  const delivery = firstMediaFailure ?? firstMediaSuccess ?? textDelivery;

  const nextConversation = appendConversationMessage(conversationId, {
    ...input,
    lane: effectiveLane,
    ...getConversationMessageDeliveryMeta(delivery),
  });

  return {
    conversation: nextConversation ?? getConversationById(conversationId) ?? conversation,
    delivery,
  };
}

export async function retryConversationMessageDelivery(
  conversationId: string,
  input: {
    role: DummyConversationRole;
    body: string;
    lane: DummyConversationLane;
    clientMessageId?: string;
  },
) {
  const effectiveLane = input.role === "customer" ? "customer" : input.lane;
  const conversation = getConversationById(conversationId);
  if (!conversation) {
    return null;
  }

  if (input.role === "customer" || effectiveLane === "internal") {
    return {
      conversation,
      delivery: {
        ok: true,
        mode: "local-only" as DummyWhatsAppDeliveryMode,
      },
    };
  }

  const targetMessage =
    getConversationMessageByClientMessageId(conversation, input.clientMessageId) ??
    [...conversation.messages]
      .reverse()
      .find(
        (message) =>
          message.lane === effectiveLane &&
          message.senderRole === input.role &&
          message.body.trim() === input.body.trim(),
      ) ?? conversation.messages.at(-1);

  if (
    targetMessage &&
    targetMessage.senderRole === input.role &&
    targetMessage.lane === effectiveLane &&
    targetMessage.externalMessageId?.trim() &&
    ["sent", "delivered", "read"].includes(String(targetMessage.deliveryStatus ?? "").toLowerCase())
  ) {
    return {
      conversation,
      delivery: {
        ok: true,
        mode: "local-only" as DummyWhatsAppDeliveryMode,
      },
    };
  }
  const senderLabel = getConversationMessageSenderLabel(conversation, input.role, effectiveLane);

  const outboundText = targetMessage
    ? buildWhatsAppOutboundTextForCustomerLane(input.role, targetMessage.body ?? input.body, targetMessage.senderLabel)
    : buildWhatsAppOutboundTextForCustomerLane(input.role, input.body, senderLabel);
  const sourceChannel = normalizeConversationSourceChannel(conversation);
  const delivery =
    outboundText.length > 0
      ? sourceChannel === "instagram"
        ? await sendInstagramText({
            conversation,
            body: outboundText,
          })
        : await sendWhatsAppText({
            tenantId: conversation.tenantId,
            to: conversation.customerPhone,
            body: outboundText,
          })
      : ({
          ok: true,
          mode: "local-only" as DummyWhatsAppDeliveryMode,
        });

  const refreshedConversation = getConversationById(conversationId);
  const normalizedClientMessageId = input.clientMessageId?.trim() || "";
  const hasMatchingMessage = Boolean(
    refreshedConversation?.messages.some(
      (message) =>
        (normalizedClientMessageId && message.clientMessageId?.trim() === normalizedClientMessageId) ||
        (message.lane === effectiveLane &&
          message.senderRole === input.role &&
          message.body.trim() === input.body.trim()),
    ),
  );
  const deliveryMeta = getConversationMessageDeliveryMeta(delivery);

  if (hasMatchingMessage && targetMessage?.id) {
    const updatedConversation = updateConversationMessageMeta(conversationId, {
      messageId: targetMessage.id,
      ...deliveryMeta,
    });
    return {
      conversation: updatedConversation ?? getConversationById(conversationId) ?? conversation,
      delivery,
    };
  }

  if (!hasMatchingMessage) {
    const appendedConversation = appendConversationMessage(conversationId, {
      ...input,
      lane: effectiveLane,
      ...deliveryMeta,
    });
    return {
      conversation: appendedConversation ?? getConversationById(conversationId) ?? conversation,
      delivery,
    };
  }

  return {
    conversation: getConversationById(conversationId) ?? conversation,
    delivery,
  };
}

export async function sendStandaloneWhatsAppMessage(input: { tenantId?: string; to: string; body: string }) {
  return sendWhatsAppText({
    tenantId: input.tenantId ?? "tenant-gigxomi",
    to: input.to,
    body: input.body.trim(),
  });
}

export async function sendStandaloneInstagramMessage(input: { tenantId?: string; to: string; body: string }) {
  const tenantId = input.tenantId ?? "tenant-gigxomi";
  const connection = getInstagramConnectionState(tenantId);
  if (!connection?.pluginEnabled) {
    return { ok: false as const, mode: "local-only" as const, error: "Instagram plugin is not enabled for this agency." };
  }

  const result = await sendInstagramTextMessage({
    accessToken: connection.accessToken,
    recipientId: input.to.trim(),
    body: input.body.trim(),
    graphApiVersion: connection.graphApiVersion,
    instagramBusinessAccountId: connection.instagramBusinessAccountId,
  });
  updateInstagramConnectionState(tenantId, {
    lastOutboundAt: result.ok ? nowIso() : connection.lastOutboundAt,
    lastError: result.ok ? "" : result.error,
    status: result.ok && connection.status === "Plugin enabled" ? "Connected" : connection.status,
  });
  return result;
}

export async function sendStandaloneWhatsAppCallToActionTemplate(input: {
  tenantId?: string;
  to: string;
  templateName: string;
  languageCode?: string;
  bodyVariables?: string[];
  buttonUrlVariable?: string;
}) {
  return sendWhatsAppCallToActionTemplate({
    tenantId: input.tenantId ?? "tenant-gigxomi",
    to: input.to,
    templateName: input.templateName,
    languageCode: input.languageCode ?? "en_US",
    bodyVariables: input.bodyVariables,
    buttonUrlVariable: input.buttonUrlVariable,
  });
}

export async function sendStandaloneWhatsAppOtpMessage(input: {
  tenantId?: string;
  to: string;
  code: string;
  fallbackBody?: string;
}) {
  const tenantId = input.tenantId ?? "tenant-gigxomi";
  const connection = getWhatsAppConnectionState(tenantId);
  const templateName = String(connection?.otpTemplateName ?? "").trim();

  if (templateName) {
    return sendWhatsAppAuthenticationTemplate({
      tenantId,
      to: input.to,
      templateName,
      languageCode: String(connection?.otpTemplateLanguage ?? "en_US"),
      code: input.code.trim(),
    });
  }

  return sendWhatsAppText({
    tenantId,
    to: input.to,
    body: (input.fallbackBody ?? `${input.code.trim()} is your Gigxomi verification code.`).trim(),
  });
}

export function getDummyPlatformSnapshot(): DummyPlatformSnapshot {
  return JSON.parse(
    JSON.stringify({
      services,
      conversations,
      whatsappStates,
      instagramStates,
      youtubeStates,
      youtubeUploads,
      leadStatuses,
      conversationTemplates,
      contacts,
      managers,
      upiConfigs,
      customerPrivacySettings,
      walletCredits,
      customerReviews,
      editorAvailability,
    }),
  ) as DummyPlatformSnapshot;
}

export function hydrateDummyPlatformSnapshot(snapshot: Partial<DummyPlatformSnapshot>) {
  if (snapshot.services) {
    services = JSON.parse(JSON.stringify(snapshot.services)) as DummyService[];
    dummyPlatformMemory.services = services;
  } else if (!dummyPlatformMemory.services) {
    services = [];
    dummyPlatformMemory.services = services;
  }

  if (snapshot.conversations) {
    conversations = (JSON.parse(JSON.stringify(snapshot.conversations)) as DummyConversation[]).map((conversation, index) => normalizeConversation(conversation, index));
    dummyPlatformMemory.conversations = conversations;
  } else if (!dummyPlatformMemory.conversations) {
    conversations = [];
    dummyPlatformMemory.conversations = conversations;
  }

  if (snapshot.whatsappStates) {
    whatsappStates = JSON.parse(JSON.stringify(snapshot.whatsappStates)) as DummyWhatsAppConnectionState[];
    dummyPlatformMemory.whatsappStates = whatsappStates;
  } else if (!dummyPlatformMemory.whatsappStates) {
    whatsappStates = [];
    dummyPlatformMemory.whatsappStates = whatsappStates;
  }

  if (snapshot.instagramStates) {
    instagramStates = JSON.parse(JSON.stringify(snapshot.instagramStates)) as DummyInstagramConnectionState[];
    dummyPlatformMemory.instagramStates = instagramStates;
  } else if (!dummyPlatformMemory.instagramStates) {
    instagramStates = [];
    dummyPlatformMemory.instagramStates = instagramStates;
  }

  if (snapshot.youtubeStates) {
    youtubeStates = JSON.parse(JSON.stringify(snapshot.youtubeStates)) as DummyYouTubeConnectionState[];
    dummyPlatformMemory.youtubeStates = youtubeStates;
  } else if (!dummyPlatformMemory.youtubeStates) {
    youtubeStates = [];
    dummyPlatformMemory.youtubeStates = youtubeStates;
  }

  if (snapshot.youtubeUploads) {
    youtubeUploads = JSON.parse(JSON.stringify(snapshot.youtubeUploads)) as DummyYouTubeUploadRecord[];
    dummyPlatformMemory.youtubeUploads = youtubeUploads;
  } else if (!dummyPlatformMemory.youtubeUploads) {
    youtubeUploads = [];
    dummyPlatformMemory.youtubeUploads = youtubeUploads;
  }

  const hasObsoleteAgencyStatuses =
    Array.isArray(snapshot.leadStatuses) &&
    snapshot.leadStatuses.some((s) => s.id === "for-review" || s.id === "delivered" || s.label?.includes("Editor Assigned"));

  if (snapshot.leadStatuses && snapshot.leadStatuses.length > 0 && !hasObsoleteAgencyStatuses) {
    leadStatuses = JSON.parse(JSON.stringify(snapshot.leadStatuses)) as DummyLeadStatus[];
    dummyPlatformMemory.leadStatuses = leadStatuses;
  } else {
    leadStatuses = crmStatuses.map((status) => ({
      id: status.id,
      label: status.label,
      tone: status.tone,
      order: status.order,
      active: status.active,
    }));
    dummyPlatformMemory.leadStatuses = leadStatuses;
  }

  if (snapshot.conversationTemplates) {
    conversationTemplates = JSON.parse(JSON.stringify(snapshot.conversationTemplates)) as DummyConversationTemplate[];
    dummyPlatformMemory.conversationTemplates = conversationTemplates;
  } else if (!dummyPlatformMemory.conversationTemplates) {
    conversationTemplates = [];
    dummyPlatformMemory.conversationTemplates = conversationTemplates;
  }

  if (snapshot.contacts) {
    contacts = JSON.parse(JSON.stringify(snapshot.contacts)) as DummyContact[];
    dummyPlatformMemory.contacts = contacts;
  } else if (!dummyPlatformMemory.contacts) {
    contacts = [];
    dummyPlatformMemory.contacts = contacts;
  }

  if (snapshot.customerPrivacySettings) {
    customerPrivacySettings = JSON.parse(JSON.stringify(snapshot.customerPrivacySettings)) as DummyCustomerPrivacySettings[];
    dummyPlatformMemory.customerPrivacySettings = customerPrivacySettings;
  } else if (!dummyPlatformMemory.customerPrivacySettings) {
    customerPrivacySettings = [];
    dummyPlatformMemory.customerPrivacySettings = customerPrivacySettings;
  }

  if (snapshot.managers) {
    managers = JSON.parse(JSON.stringify(snapshot.managers)) as DummyManagerAccount[];
    dummyPlatformMemory.managers = managers;
  } else if (!dummyPlatformMemory.managers) {
    managers = [];
    dummyPlatformMemory.managers = managers;
  }

  if (snapshot.upiConfigs) {
    upiConfigs = JSON.parse(JSON.stringify(snapshot.upiConfigs)) as DummyUpiConfig[];
    dummyPlatformMemory.upiConfigs = upiConfigs;
  } else if (!dummyPlatformMemory.upiConfigs) {
    upiConfigs = [];
    dummyPlatformMemory.upiConfigs = upiConfigs;
  }

  if (snapshot.walletCredits) {
    walletCredits = JSON.parse(JSON.stringify(snapshot.walletCredits)) as DummyWalletCredit[];
    dummyPlatformMemory.walletCredits = walletCredits;
  } else if (!dummyPlatformMemory.walletCredits) {
    walletCredits = [];
    dummyPlatformMemory.walletCredits = walletCredits;
  }

  if (snapshot.customerReviews) {
    customerReviews = JSON.parse(JSON.stringify(snapshot.customerReviews)) as DummyCustomerReview[];
    dummyPlatformMemory.customerReviews = customerReviews;
  } else if (!dummyPlatformMemory.customerReviews) {
    customerReviews = [];
    dummyPlatformMemory.customerReviews = customerReviews;
  }

  if (snapshot.editorAvailability) {
    editorAvailability = JSON.parse(JSON.stringify(snapshot.editorAvailability)) as DummyEditorAvailability[];
    dummyPlatformMemory.editorAvailability = editorAvailability;
  } else if (!dummyPlatformMemory.editorAvailability) {
    editorAvailability = [];
    dummyPlatformMemory.editorAvailability = editorAvailability;
  }

  conversations = conversations.map((conversation, index) => normalizeConversation(conversation, index));
  dummyPlatformMemory.conversations = conversations;
}

export function deleteConversation(conversationId: string): boolean {
  const targetId = String(conversationId || "").trim();
  if (!targetId) return false;
  const initialLength = conversations.length;
  conversations = conversations.filter((c) => c.id !== targetId);
  dummyPlatformMemory.conversations = conversations;
  contacts = contacts.filter((c) => c.conversationId !== targetId);
  dummyPlatformMemory.contacts = contacts;
  return conversations.length < initialLength;
}
