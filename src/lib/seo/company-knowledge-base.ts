export const companyKnowledgeBase = {
  brandName: "Gigxomi",
  legalName: "Gigxomi",
  siteUrl: "https://www.gigxomi.com",
  blogUrl: "https://blog.gigxomi.com",
  homeTitle: "Tool to Manage Your Video Editing Gigs",
  tagline: "Business OS for Video Editors",
  homeDescription:
    "Gigxomi helps video editors manage client conversations, editors, managers, tasks, delivery, accounting, and payouts from one connected workspace.",
  businessDescription:
    "Gigxomi is a business operating system for video editors who are starting side gigs, growing an audience-led editing business, or operating a video editing agency.",
  logoPath: "/gigxomi-logo.png",
  iconPath: "/icon.png",
  iconSvgPath: "/icon.svg",
  wordmarkPath: "/gigxomi-wordmark.svg",
  contactEmail: "studio@gigxomi.com",
  supportPhone: "+91 99818 07309",
  supportPhoneE164: "+919981807309",
  whatsappUrl: "https://wa.me/919981807309",
  playStoreUrl: "https://play.google.com/store/apps/details?id=com.gigxomi.app",
  socialProfiles: [
    "https://www.instagram.com/gigxomi/",
    "https://www.linkedin.com/company/gigxomi/",
    "https://www.facebook.com/gigxomi/",
  ],
  keywords: [
    "video editing business management",
    "video editor client management",
    "video editing agency software",
    "manage video editing gigs",
    "WhatsApp Business inbox for video editors",
    "Instagram Business inbox for editors",
    "video editing project management",
    "freelance video editor projects",
    "video editing agency India",
    "video editor business workshop",
  ],
  audiences: ["Employed video editors starting side gigs", "Social-media video editors", "Solo video editors", "Video editing agencies"],
  coreServices: [
    "Short-form video editing",
    "Long-form video editing",
    "UGC and social content editing",
    "Post-production support for agencies",
  ],
  differentiators: [
    "Manage WhatsApp Business and Instagram Business enquiries in one connected inbox.",
    "Coordinate clients, managers, editors, tasks, review, delivery, accounting, and payouts.",
    "Move from solo gigs to a structured video editing agency workspace.",
  ],
  knowledgeBaseSections: [
    {
      title: "Company profile",
      items: [
        "Gigxomi is positioned as a business operating system for video editors.",
        "The platform supports side gigs, solo editing businesses, and video editing agencies.",
        "The core promise is managing video editing gigs from enquiry through client delivery and payout.",
      ],
    },
    {
      title: "Ideal customers",
      items: [
        "Employed editors who want to start side gigs and build an independent business.",
        "Social-media editors who receive enquiries from followers and manage projects alone.",
        "Solo editors and agencies that need structured team delivery and client communication.",
      ],
    },
    {
      title: "Primary SEO topics",
      items: [
        "Tools to manage video editing gigs and clients.",
        "Video editing agency software and business systems.",
        "Freelancer registration and agency project opportunities.",
      ],
    },
  ],
} as const;

export function buildSiteUrl(path = "/") {
  return new URL(path, companyKnowledgeBase.siteUrl).toString();
}
