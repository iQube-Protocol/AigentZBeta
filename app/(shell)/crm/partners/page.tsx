'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Check, Clock, X, ChevronDown } from 'lucide-react';

interface Partner {
  id: string;
  partner_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  outreach_status: string;
  outreach_channel: string | null;
  partner_type: string | null;
  notes: string | null;
  first_contact_at: string | null;
  last_contact_at: string | null;
  follow_up_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS = ['pending', 'contacted', 'responded', 'committed', 'declined', 'deferred'];
const CHANNEL_OPTIONS = ['email', 'phone', 'dm', 'linkedin', 'telegram', 'in_person'];
const TYPE_OPTIONS = ['media', 'platform', 'community', 'investor', 'brand'];

const statusStyle = (status: string) => {
  switch (status) {
    case 'committed': return 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30';
    case 'contacted': return 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30';
    case 'responded': return 'bg-blue-500/20 text-blue-300 ring-blue-500/30';
    case 'declined':  return 'bg-red-500/20 text-red-300 ring-red-500/30';
    case 'deferred':  return 'bg-amber-500/20 text-amber-300 ring-amber-500/30';
    default:          return 'bg-slate-500/20 text-slate-300 ring-slate-500/30';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'committed': return <Check size={12} />;
    case 'declined':  return <X size={12} />;
    case 'pending':   return <Clock size={12} />;
    default:          return null;
  }
};

const EMPTY_FORM = {
  partner_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  outreach_status: 'pending',
  outreach_channel: '',
  partner_type: '',
  notes: '',
  follow_up_at: '',
};

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function fetchPartners() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/partners');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setPartners(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPartners(); }, []);

  async function handleSave() {
    setSaving(true);
    try {
      let res: Response;
      if (editingId) {
        res = await fetch('/api/crm/partners', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...form }),
        });
      } else {
        res = await fetch('/api/crm/partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      fetchPartners();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p: Partner) {
    setForm({
      partner_name: p.partner_name,
      contact_name: p.contact_name ?? '',
      contact_email: p.contact_email ?? '',
      contact_phone: p.contact_phone ?? '',
      outreach_status: p.outreach_status,
      outreach_channel: p.outreach_channel ?? '',
      partner_type: p.partner_type ?? '',
      notes: p.notes ?? '',
      follow_up_at: p.follow_up_at ? p.follow_up_at.slice(0, 10) : '',
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  const committedCount = partners.filter((p) => p.outreach_status === 'committed').length;
  const contactedCount = partners.filter((p) => ['contacted', 'responded'].includes(p.outreach_status)).length;
  const pendingCount   = partners.filter((p) => p.outreach_status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <Users className="text-fuchsia-400" />
            Partner Outreach
          </h1>
          <p className="text-slate-400 mt-1">KNYT Wheel launch — 16-partner activation blitz</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-fuchsia-500/20 ring-1 ring-fuchsia-500/30 text-fuchsia-300 rounded-lg text-sm hover:bg-fuchsia-500/30 transition"
        >
          <Plus size={16} />
          Add Partner
        </button>
      </div>

      {/* Stats chips */}
      <div className="flex flex-wrap gap-3">
        <div className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 ring-1 ring-white/10">
          <span className="text-slate-400">Total </span>
          <span className="text-white font-semibold">{partners.length}</span>
        </div>
        <div className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <Check size={12} className="inline mr-1 text-emerald-400" />
          <span className="text-emerald-300">Committed </span>
          <span className="text-emerald-400 font-semibold">{committedCount}</span>
        </div>
        <div className="px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500/10 ring-1 ring-cyan-500/20">
          <span className="text-cyan-300">In progress </span>
          <span className="text-cyan-400 font-semibold">{contactedCount}</span>
        </div>
        <div className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 ring-1 ring-white/10">
          <Clock size={12} className="inline mr-1 text-slate-400" />
          <span className="text-slate-400">Pending </span>
          <span className="text-slate-300 font-semibold">{pendingCount}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 bg-red-500/10 ring-1 ring-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Partner' : 'Add Partner'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Partner Name *</label>
              <input
                value={form.partner_name}
                onChange={(e) => setForm({ ...form, partner_name: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="e.g. Wakanda Dream Fund"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Contact Name</label>
              <input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Contact Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Status</label>
              <select
                value={form.outreach_status}
                onChange={(e) => setForm({ ...form, outreach_status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Channel</label>
              <select
                value={form.outreach_channel}
                onChange={(e) => setForm({ ...form, outreach_channel: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              >
                <option value="">Select channel</option>
                {CHANNEL_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Partner Type</label>
              <select
                value={form.partner_type}
                onChange={(e) => setForm({ ...form, partner_type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              >
                <option value="">Select type</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Follow-up Date</label>
              <input
                type="date"
                value={form.follow_up_at}
                onChange={(e) => setForm({ ...form, follow_up_at: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.partner_name}
              className="px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Partner'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
              className="px-4 py-2 text-slate-400 hover:text-white text-sm transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Partner</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Contact</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400 hidden lg:table-cell">Notes</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">Loading…</td>
              </tr>
            ) : partners.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  No partners yet — click "Add Partner" to start tracking
                </td>
              </tr>
            ) : (
              partners.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-6 py-4">
                    <p className="font-medium text-sm text-white">{p.partner_name}</p>
                    {p.partner_type && (
                      <p className="text-xs text-slate-500 capitalize">{p.partner_type}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {p.contact_name && <p className="text-sm text-slate-300">{p.contact_name}</p>}
                    {p.contact_email && <p className="text-xs text-slate-500">{p.contact_email}</p>}
                    {p.outreach_channel && (
                      <p className="text-xs text-slate-600 capitalize">via {p.outreach_channel}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 w-fit px-2 py-1 rounded-full text-xs font-medium ring-1 ${statusStyle(p.outreach_status)}`}>
                      {statusIcon(p.outreach_status)}
                      {p.outreach_status}
                    </span>
                    {p.follow_up_at && (
                      <p className="text-xs text-slate-500 mt-1">
                        Follow-up: {p.follow_up_at.slice(0, 10)}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell max-w-xs">
                    <p className="text-xs text-slate-400 truncate">{p.notes ?? '—'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => startEdit(p)}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-xs transition"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
