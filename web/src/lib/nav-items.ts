import { Compass, Send, Radar, BarChart3, BookOpen, FileText, Settings, Cpu, MousePointerClick } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// The desk (`/`) is the only primary destination. Everything else is a
// secondary tool reached from the More menu — kept, not removed.
export type NavItem = {
  href: string;
  label: string;
  hint?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const SECONDARY_ITEMS: NavItem[] = [
  { href: "/explore", label: "Scan job boards", hint: "Free reverse-ATS scan", icon: Compass },
  { href: "/followups", label: "Follow-ups", icon: Send },
  { href: "/portals", label: "Portals", icon: Radar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/evidence", label: "Career evidence", icon: BookOpen },
  { href: "/cv", label: "CV", icon: FileText },
  { href: "/jobs", label: "Workers", hint: "Every evaluation you ran", icon: Cpu },
  { href: "/apply", label: "Assisted apply (legacy)", hint: "Form prefill, outside the desk flow", icon: MousePointerClick },
  { href: "/config", label: "Config", icon: Settings },
];

export function isActivePath(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
