'use client';

import Link from 'next/link';
import {
  Activity,
  BookOpen,
  DollarSign,
  Image,
  LayoutGrid,
  Layers,
  Monitor,
  Newspaper,
  TrendingUp,
  Upload,
} from 'lucide-react';

const SECTIONS = [
  {
    title: 'Bulk Import',
    description: 'Import multiple content items',
    icon: Upload,
    href: '/admin/content/import',
    iconColor: 'text-teal-400',
  },
  {
    title: 'Home Hero',
    description: '3 main hero articles',
    icon: LayoutGrid,
    href: '/admin/content/home-hero',
    iconColor: 'text-teal-400',
  },
  {
    title: 'Latest News',
    description: 'News carousel',
    icon: Newspaper,
    href: '/admin/content/latest-news',
    iconColor: 'text-teal-400',
  },
  {
    title: 'Second Hero',
    description: 'Bottom featured article',
    icon: Image,
    href: '/admin/content/second-hero',
    iconColor: 'text-teal-400',
  },
  {
    title: 'PennyDrops',
    description: 'Financial insights',
    icon: DollarSign,
    href: '/admin/content/pennydrops',
    iconColor: 'text-teal-400',
  },
  {
    title: 'Scrolls',
    description: 'metaKnyts & The SynthSims',
    icon: BookOpen,
    href: '/admin/content/scrolls',
    iconColor: 'text-teal-400',
  },
  {
    title: 'Kn0wdZ',
    description: 'Dev & Creative resources',
    icon: Monitor,
    href: '/admin/content/21knowdz',
    iconColor: 'text-teal-400',
  },
  {
    title: 'StayBull',
    description: 'Market updates',
    icon: TrendingUp,
    href: '/admin/content/staybull',
    iconColor: 'text-teal-400',
  },
  {
    title: 'SmartTriad Codex Manager',
    description: 'Episodes, covers, Autonomys uploads',
    icon: Layers,
    href: '/admin/smarttriad/codex',
    iconColor: 'text-teal-400',
  },
  {
    title: 'Embed Health Check',
    description: 'Test iframe compatibility',
    icon: Activity,
    href: '/admin/embed-health',
    iconColor: 'text-teal-400',
  },
];

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#0a0d14] px-8 py-10">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Content Management</h1>
          <p className="mt-1 text-sm text-gray-400">Manage content across all sections of the application</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-1.5">
          <span className="h-4 w-4 rounded-full border-2 border-teal-400 bg-transparent" />
          <span className="text-sm font-medium text-teal-400">Legacy Auth</span>
        </div>
      </div>

      {/* Auth banner */}
      <div className="mb-8 flex items-center gap-2 rounded-lg border border-yellow-800/40 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-300">
        <span>💡</span>
        <span>
          You&apos;re using legacy authentication.{' '}
          <Link href="/settings/profile" className="font-medium text-teal-400 hover:underline">
            Set up DID authentication
          </Link>{' '}
          for enhanced security with AA-API.
        </span>
      </div>

      {/* Section grid */}
      <div className="grid grid-cols-3 gap-4">
        {SECTIONS.map(({ title, description, icon: Icon, href, iconColor }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-xl border border-white/5 bg-[#141927] p-5 transition-colors hover:border-teal-500/30 hover:bg-[#1a2133]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0d1520]">
              <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p className="text-sm text-gray-400">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
