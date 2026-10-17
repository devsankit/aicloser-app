import React, { type SVGProps } from "react";
import {
  Home,
  Kanban,
  Users,
  Upload,
  Phone,
  MessageSquare,
  FileText,
  Plug,
  MessageCircle,
  Bot,
  CreditCard,
  UsersRound,
  Settings,
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
  Command,
  Link2,
  Copy,
  GitBranch,
  Flame,
  Target,
  Eye,
  Keyboard,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "home"
  | "kanban"
  | "users"
  | "upload"
  | "phone"
  | "message"
  | "form"
  | "plug"
  | "whatsapp"
  | "bot"
  | "card"
  | "team"
  | "settings"
  | "search"
  | "plus"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
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
  | "tag"
  | "building"
  | "external"
  | "sparkle"
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
  | "chevron-up"
  | "target"
  | "eye"
  | "keyboard"
  | "panel-right";

const LUCIDE_MAP: Record<IconName, LucideIcon> = {
  home: Home,
  kanban: Kanban,
  users: Users,
  upload: Upload,
  phone: Phone,
  message: MessageSquare,
  form: FileText,
  plug: Plug,
  whatsapp: MessageCircle,
  bot: Bot,
  card: CreditCard,
  team: UsersRound,
  settings: Settings,
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
  tag: Tag,
  building: Building2,
  external: ExternalLink,
  sparkle: Sparkles,
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
  keyboard: Keyboard,
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName | string;
  size?: number;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  className,
  ...rest
}: IconProps) {
  // Ensure icons have an accessible minimum size of 16px for clarity
  const computedSize = Math.max(16, size);
  const Component = LUCIDE_MAP[name as IconName];

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
