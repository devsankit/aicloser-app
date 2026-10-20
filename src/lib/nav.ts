import type { IconName } from "@/components/ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "CRM & Telephony",
    items: [
      { href: "/dashboard", label: "Dashboard Overview", icon: "home" },
      { href: "/pipeline", label: "CRM Pipeline & Kanban", icon: "kanban" },
      { href: "/contacts", label: "Contacts", icon: "users" },
      { href: "/lead-import", label: "Lead Import", icon: "upload" },
      { href: "/calls", label: "Call Recordings & Missed", icon: "phone" },
      { href: "/chat", label: "Live Multi-Channel Chat", icon: "message" },
    ],
  },
  {
    label: "Growth & Automation",
    items: [
      { href: "/forms", label: "Lead Form Builder", icon: "form" },
      { href: "/channels", label: "Plugins & Channels", icon: "plug" },
      { href: "/whatsapp", label: "WhatsApp Marketing", icon: "whatsapp" },
      { href: "/automations", label: "AI Bot & Automations", icon: "bot" },
    ],
  },
  {
    label: "Revenue & Settings",
    items: [
      { href: "/payments", label: "Payments & Confirmations", icon: "card" },
      { href: "/team", label: "Team & Users", icon: "team" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];
