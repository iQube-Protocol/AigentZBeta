/**
 * Icon Mapping Utility
 *
 * Maps icon names from codex configuration to Lucide React components
 */

import {
  BookOpen,
  Users,
  Scroll,
  Gamepad2,
  Globe,
  Crown,
  Sparkles,
  Home,
  Mountain,
  Shield,
  Star,
  Coins,
  Brain,
  Gift,
  FileText,
  Code,
  GraduationCap,
  Newspaper,
  Zap,
  Circle,
  BookMarked,
  TrendingUp,
  Megaphone,
  Wand2,
  Cpu,
  Settings,
  Layers,
  Route,
  Bitcoin,
  Grid3x3,
  BarChart3,
  MessageSquare,
  Package,
  PackageCheck,
  Boxes,
  Hexagon,
  Target,
  Activity,
  FolderOpen,
  Heart,
  Briefcase,
  type LucideIcon
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Users,
  Scroll,
  Gamepad2,
  Globe,
  Crown,
  Sparkles,
  Home,
  Mountain,
  Shield,
  Star,
  Coins,
  Brain,
  Gift,
  FileText,
  Code,
  GraduationCap,
  Newspaper,
  Zap,
  Circle,
  BookMarked,
  TrendingUp,
  Megaphone,
  Wand2,
  Cpu,
  Settings,
  Layers,
  Route,
  Bitcoin,
  Grid3x3,
  BarChart: BarChart3,
  BarChart3,
  MessageSquare,
  Package,
  PackageCheck,
  Boxes,
  Hexagon,
  Target,
  Activity,
  FolderOpen,
  Heart,
  Briefcase,
};

/**
 * Get Lucide icon component by name
 * Falls back to Circle if icon not found
 */
export function getIconComponent(iconName?: string): LucideIcon {
  if (!iconName) return Circle;
  return ICON_MAP[iconName] || Circle;
}

/**
 * Get all available icon names
 */
export function getAvailableIcons(): string[] {
  return Object.keys(ICON_MAP);
}
