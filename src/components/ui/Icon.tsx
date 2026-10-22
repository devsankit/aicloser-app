import React, { type SVGProps } from "react";
import {
  LayoutDashboard,
  Kanban,
  Users,
  UploadCloud,
  Phone,
  PhoneCall,
  PhoneIncoming,
  MessageSquare,
  FileText,
  ClipboardList,
  Plug,
  Plug2,
  MessageCircle,
  Bot,
  CreditCard,
  Receipt,
  UsersRound,
  Settings,
  Settings2,
  Search,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  GripVertical,
  X,
  Sun,
  Moon,
  Bell,
  Trash2,
  Check,
  ArrowRight,
  Filter,
  Menu,
  PanelLeft,
  PanelRight,
  Mail,
  Clock,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  Tag,
  Building2,
  ExternalLink,
  Sparkles,
  Download,
  ArrowUpDown,
  Shield,
  Inbox,
  Circle,
  CircleDot,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  Pencil,
  Layers,
  Milestone,
  BarChart3,
  TrendingUp,
  Handshake,
  Trophy,
  UserPlus,
  Command,
  Link2,
  Copy,
  GitBranch,
  Flame,
  Target,
  Eye,
  EyeOff,
  Keyboard,
  FileSpreadsheet,
  Smartphone,
  Globe,
  Radio,
  Headphones,
  LogOut,
  Play,
  Pause,
  RefreshCw,
  Zap,
  Coffee,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "home"
  | "kanban"
  | "users"
  | "upload"
  | "phone"
  | "phone-call"
  | "phone-incoming"
  | "message"
  | "form"
  | "plug"
  | "whatsapp"
  | "bot"
  | "card"
  | "receipt"
  | "team"
  | "settings"
  | "search"
  | "plus"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "more"
  | "drag"
  | "close"
  | "sun"
  | "moon"
  | "bell"
  | "trash"
  | "check"
  | "arrow-right"
  | "filter"
  | "menu"
  | "panel"
  | "mail"
  | "clock"
  | "calendar"
  | "calendar-check"
  | "calendar-clock"
  | "tag"
  | "building"
  | "external"
  | "sparkle"
  | "user-plus"
  | "trending-up"
  | "handshake"
  | "trophy"
  | "download"
  | "sort"
  | "shield"
  | "inbox"
  | "status-todo"
  | "status-progress"
  | "status-done"
  | "status-cancelled"
  | "priority-urgent"
  | "priority-high"
  | "priority-medium"
  | "priority-low"
  | "pencil"
  | "layers"
  | "roadmap"
  | "graph"
  | "command"
  | "link"
  | "copy"
  | "branch"
  | "flame"
  | "target"
  | "eye"
  | "eye-off"
  | "keyboard"
  | "panel-right"
  | "x-circle"
  | "check-circle"
  | "alert-circle"
  | "layout-dashboard"
  | "phone-incoming"
  | "receipt"
  | "clipboard-list"
  | "settings-2"
  | "plug-2"
  | "upload-cloud"
  | "sheet"
  | "smartphone"
  | "sim"
  | "globe"
  | "radio"
  | "headphones"
  | "logout"
  | "play"
  | "pause"
  | "refresh"
  | "zap"
  | "coffee"
  | "meta";

const LUCIDE_MAP: Record<string, LucideIcon> = {
  coffee: Coffee,
  zap: Zap,
  refresh: RefreshCw,
  play: Play,
  pause: Pause,
  logout: LogOut,
  home: LayoutDashboard,
  kanban: Kanban,
  users: Users,
  upload: UploadCloud,
  phone: Phone,
  "phone-call": PhoneCall,
  "phone-incoming": PhoneIncoming,
  message: MessageSquare,
  form: ClipboardList,
  plug: Plug2,
  whatsapp: MessageCircle,
  bot: Bot,
  card: CreditCard,
  receipt: Receipt,
  team: UsersRound,
  settings: Settings2,
  search: Search,
  plus: Plus,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  more: MoreHorizontal,
  drag: GripVertical,
  close: X,
  sun: Sun,
  moon: Moon,
  bell: Bell,
  trash: Trash2,
  check: Check,
  "arrow-right": ArrowRight,
  filter: Filter,
  menu: Menu,
  panel: PanelLeft,
  "panel-right": PanelRight,
  mail: Mail,
  clock: Clock,
  calendar: Calendar,
  "calendar-check": CalendarCheck2,
  "calendar-clock": CalendarClock,
  tag: Tag,
  building: Building2,
  external: ExternalLink,
  sparkle: Sparkles,
  "user-plus": UserPlus,
  "trending-up": TrendingUp,
  handshake: Handshake,
  trophy: Trophy,
  download: Download,
  sort: ArrowUpDown,
  shield: Shield,
  inbox: Inbox,
  "status-todo": Circle,
  "status-progress": CircleDot,
  "status-done": CheckCircle2,
  "status-cancelled": XCircle,
  "priority-urgent": AlertCircle,
  "priority-high": ArrowUp,
  "priority-medium": Minus,
  "priority-low": ArrowDown,
  pencil: Pencil,
  layers: Layers,
  roadmap: Milestone,
  graph: BarChart3,
  command: Command,
  link: Link2,
  copy: Copy,
  branch: GitBranch,
  flame: Flame,
  target: Target,
  eye: Eye,
  "eye-off": EyeOff,
  keyboard: Keyboard,
  "x-circle": XCircle,
  "check-circle": CheckCircle2,
  "alert-circle": AlertCircle,
  sheet: FileSpreadsheet,
  smartphone: Smartphone,
  sim: Smartphone,
  globe: Globe,
  radio: Radio,
  headphones: Headphones,
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName | string;
  size?: number;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.75,
  className,
  ...rest
}: IconProps) {
  // Enforce minimum accessible size of 16px so no icon is ever rendered tiny/unreadable
  const computedSize = Math.max(16, size);
  if (name === "meta") {
    return (
      <svg
        viewBox="0 0 24 24"
        width={computedSize}
        height={computedSize}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...rest}
      >
        <path d="M6.5 7.5C4 7.5 2 9.5 2 12s2 4.5 4.5 4.5c2.2 0 4-1.7 5.5-4.5 1.5 2.8 3.3 4.5 5.5 4.5 2.5 0 4.5-2 4.5-4.5s-2-4.5-4.5-4.5c-2.2 0-4 1.7-5.5 4.5-1.5-2.8-3.3-4.5-5.5-4.5z" />
      </svg>
    );
  }

  const Component = LUCIDE_MAP[name];

  if (!Component) {
    return (
      <Circle
        size={computedSize}
        strokeWidth={strokeWidth}
        className={className}
        aria-hidden="true"
        {...rest}
      />
    );
  }

  return (
    <Component
      size={computedSize}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...rest}
    />
  );
}
