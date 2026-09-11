'use client';

/**
 * MobilityDoctrineTab — PSC-001 Polity Capability Preservation Standard.
 * Surfaces the foundational doctrine for the HMS Cartridge.
 */

import React from 'react';
import { Shield, Users, TrendingUp, Star, Lock, Award } from 'lucide-react';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

const CAPITAL_CLASSES = [
  { icon: <Users className="h-4 w-4" />,     label: 'Human Capital',       color: 'emerald', desc: 'Knowledge, skills, experience, professional expertise, educational attainment, leadership capacity.' },
  { icon: <Star className="h-4 w-4" />,       label: 'Social Capital',      color: 'sky',     desc: 'Relationships, networks, communities, trust structures, professional affiliations.' },
  { icon: <Award className="h-4 w-4" />,      label: 'Reputational Capital', color: 'violet',  desc: 'Standing, credibility, recognition, professional reputation, institutional trust, accreditation.' },
  { icon: <TrendingUp className="h-4 w-4" />, label: 'Entrepreneurial Capital', color: 'amber', desc: 'Business formation capability, innovation capability, commercial relationships, market access.' },
  { icon: <Star className="h-4 w-4" />,       label: 'Educational Capital', color: 'rose',    desc: 'Learning continuity, academic trajectory, institutional familiarity, developmental stability.' },
  { icon: <Shield className="h-4 w-4" />,     label: 'Civic Capital',       color: 'cyan',    desc: 'Citizenship, community participation, institutional familiarity, legal standing, public trust.' },
];

const INTERVENTION_HIERARCHY = [
  { level: 1, label: 'Capability Preservation',  color: 'emerald' },
  { level: 2, label: 'Continuity Preservation',  color: 'sky'     },
  { level: 3, label: 'Standing Preservation',    color: 'violet'  },
  { level: 4, label: 'Economic Stabilization',   color: 'amber'   },
  { level: 5, label: 'Logistical Execution',     color: 'slate'   },
];

const CONFIDENTIALITY_TIERS = [
  { tier: 'White',      color: 'slate',  desc: 'Public information. No restrictions.' },
  { tier: 'Grey',       color: 'slate',  desc: 'Routine administrative information. Restricted disclosure.' },
  { tier: 'Black',      color: 'slate',  desc: 'Sensitive personal or financial information. Need-to-know basis.' },
  { tier: 'BlakQube', color: 'rose',   desc: 'Information whose disclosure may create material harm to safety, standing, business interests, economic prospects, family wellbeing, or strategic opportunities. Compartmentalized by default.' },
];

export function MobilityDoctrineTab() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Polity Capability Preservation Standard</h2>
          <p className="text-sm text-slate-400">PSC-001 · Version 1.0 · Black Cube</p>
        </div>
      </div>

      {/* Foundational principle */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <blockquote className="border-l-2 border-violet-500/60 pl-3 text-violet-200/90 text-sm italic space-y-2">
          <p>Traditional systems frequently respond to distress. Polity systems preserve capability.</p>
          <p>The objective is not simply to alleviate hardship. The objective is to prevent temporary disruption from causing permanent destruction of human capability, social capital, standing, continuity, and future contribution potential.</p>
        </blockquote>
      </div>

      {/* Asset model */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Six Classes of Citizen Capital</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CAPITAL_CLASSES.map(c => (
            <div key={c.label} className={cls('rounded-lg border px-3 py-2.5 space-y-1', `border-${c.color}-500/20 bg-${c.color}-500/5`)}>
              <div className="flex items-center gap-2">
                <span className={`text-${c.color}-400`}>{c.icon}</span>
                <span className={cls('text-xs font-semibold', `text-${c.color}-300`)}>{c.label}</span>
              </div>
              <p className="text-xs text-slate-400">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Intervention hierarchy */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Polity Intervention Hierarchy</h3>
        <div className="space-y-1.5">
          {INTERVENTION_HIERARCHY.map(item => (
            <div key={item.level} className={cls('flex items-center gap-3 rounded-lg border px-3 py-2', `border-${item.color}-500/20 bg-${item.color}-500/5`)}>
              <span className={cls('text-xs font-bold w-5 shrink-0', `text-${item.color}-400`)}>L{item.level}</span>
              <span className={cls('text-sm', `text-${item.color}-200`)}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confidentiality tiers */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Confidentiality Classification</h3>
        <div className="space-y-1.5">
          {CONFIDENTIALITY_TIERS.map(t => (
            <div key={t.tier} className={cls('rounded-lg border px-3 py-2.5', t.tier === 'BlakQube' ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-700 bg-slate-900/50')}>
              <div className="flex items-center gap-2 mb-0.5">
                {t.tier === 'BlakQube' && <Lock className="h-3 w-3 text-rose-400" />}
                <span className={cls('text-xs font-semibold', t.tier === 'BlakQube' ? 'text-rose-300' : 'text-slate-300')}>{t.tier}</span>
              </div>
              <p className="text-xs text-slate-400">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Guiding principle */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <p className="text-sm text-emerald-200/90">
          Human mobility services are not transportation services. They are capability-preservation systems operating across changing geographies. The role of the polity is stewardship of capability across time.
        </p>
      </div>
    </div>
  );
}
