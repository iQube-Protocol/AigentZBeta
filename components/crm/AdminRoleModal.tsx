'use client';

import { useState, useEffect } from 'react';
import { X, Shield, Users, Building, Store, Tag, Loader2, AlertCircle, CheckCircle, Code, GitPullRequest, Rocket, Eye } from 'lucide-react';

interface AdminRoleModalProps {
  onClose: () => void;
  onSuccess?: (role: any) => void;
  existingRole?: { id: string; rootDid: string; roleType: string; franchiseId?: string; tenantId?: string; categoryId?: string; permissions: any };
  grantorRootDid?: string; // Root DID of the admin granting this role
}

const ROLE_TYPES = [
  { value: 'uber_admin', label: 'Uber Admin', description: 'Full estate-wide access', icon: Shield, level: 1 },
  { value: 'category_uber_admin', label: 'Category Uber Admin', description: 'Full access within a category', icon: Tag, level: 2 },
  { value: 'platform_super_admin', label: 'Platform Super Admin', description: 'Platform-level administration', icon: Building, level: 3 },
  { value: 'franchise_super_admin', label: 'Franchise Super Admin', description: 'Full franchise access', icon: Building, level: 4 },
  { value: 'tenant_super_admin', label: 'Tenant Super Admin', description: 'Full tenant access', icon: Store, level: 5 },
  { value: 'category_admin', label: 'Category Admin', description: 'Category-specific access', icon: Tag, level: 6 },
  { value: 'code_contributor', label: 'Code Contributor', description: 'Code/PR contribution access', icon: Code, level: 7 },
  { value: 'deployment_admin', label: 'Deployment Admin', description: 'Deployment and release access', icon: Rocket, level: 7 },
  { value: 'code_reviewer', label: 'Code Reviewer', description: 'PR review and approval', icon: Eye, level: 7 },
];

const PERMISSIONS = [
  { key: 'read', label: 'Read', description: 'View data' },
  { key: 'write', label: 'Write', description: 'Create and edit' },
  { key: 'delete', label: 'Delete', description: 'Remove data' },
  { key: 'manage_users', label: 'Manage Users', description: 'User administration' },
  { key: 'manage_admins', label: 'Manage Admins', description: 'Admin role assignment' },
  { key: 'manage_settings', label: 'Manage Settings', description: 'System configuration' },
  { key: 'view_audit_logs', label: 'View Audit Logs', description: 'Access audit trail' },
  { key: 'export_data', label: 'Export Data', description: 'Data export capability' },
  { key: 'code_commit', label: 'Code Commit', description: 'Push code changes' },
  { key: 'pr_create', label: 'Create PRs', description: 'Create pull requests' },
  { key: 'pr_review', label: 'Review PRs', description: 'Review and approve PRs' },
  { key: 'deploy_staging', label: 'Deploy Staging', description: 'Deploy to staging' },
  { key: 'deploy_production', label: 'Deploy Production', description: 'Deploy to production' },
];

export default function AdminRoleModal({ onClose, onSuccess, existingRole, grantorRootDid: initialGrantorDid }: AdminRoleModalProps) {
  // Per DiDQube policy: Admin roles use Root DIDs (not KybeDIDs)
  // KybeDID = proof-of-personhood anchor (rarely shared)
  // Root DID = deep identity for regulated/admin contexts
  const [rootDid, setRootDid] = useState(existingRole?.rootDid || '');
  const [grantorRootDid, setGrantorRootDid] = useState(initialGrantorDid || '');
  const [roleType, setRoleType] = useState(existingRole?.roleType || 'tenant_super_admin');
  const [franchiseId, setFranchiseId] = useState(existingRole?.franchiseId || '');
  const [tenantId, setTenantId] = useState(existingRole?.tenantId || '');
  const [categoryId, setCategoryId] = useState(existingRole?.categoryId || '');
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    existingRole?.permissions || { read: true, write: true, delete: false, manage_users: false, manage_admins: false, manage_settings: false, view_audit_logs: true, export_data: false }
  );
  const [franchises, setFranchises] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    if (franchiseId) fetchTenants(franchiseId);
  }, [franchiseId]);

  const fetchOptions = async () => {
    try {
      const [franchiseRes, categoryRes] = await Promise.all([
        fetch('/api/crm/franchises'),
        fetch('/api/crm/admin/categories'),
      ]);
      if (franchiseRes.ok) { const data = await franchiseRes.json(); setFranchises(data.franchises || []); }
      if (categoryRes.ok) { const data = await categoryRes.json(); setCategories(data.categories || []); }
    } catch (err) { console.error('Failed to fetch options:', err); }
  };

  const fetchTenants = async (fId: string) => {
    try {
      const res = await fetch(`/api/crm/tenants?franchiseId=${fId}`);
      if (res.ok) { const data = await res.json(); setTenants(data.tenants || []); }
    } catch (err) { console.error('Failed to fetch tenants:', err); }
  };

  const togglePermission = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const needsFranchise = ['franchise_super_admin'].includes(roleType);
  const needsTenant = ['tenant_super_admin'].includes(roleType);
  const needsCategory = ['category_uber_admin', 'category_admin'].includes(roleType);

  const selectAllPermissions = () => {
    const allSelected = PERMISSIONS.every(p => permissions[p.key]);
    const newPermissions: Record<string, boolean> = {};
    PERMISSIONS.forEach(p => { newPermissions[p.key] = !allSelected; });
    setPermissions(newPermissions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootDid.trim()) { setError('Please enter the assignee Root DID'); return; }
    if (!grantorRootDid.trim()) { setError('Please enter the grantor Root DID (your Root DID)'); return; }
    if (needsFranchise && !franchiseId) { setError('Please select a franchise'); return; }
    if (needsTenant && !tenantId) { setError('Please select a tenant'); return; }
    if (needsCategory && !categoryId) { setError('Please select a category'); return; }

    setLoading(true);
    setError(null);

    // Auto-prefix with did:root: if not already a DID
    const normalizeRootDid = (did: string) => {
      const trimmed = did.trim();
      if (trimmed.startsWith('did:')) return trimmed;
      return `did:root:${trimmed}`;
    };

    const normalizedGrantorDid = normalizeRootDid(grantorRootDid);
    const normalizedAssigneeDid = normalizeRootDid(rootDid);

    try {
      const endpoint = existingRole ? `/api/crm/admin/roles/${existingRole.id}` : '/api/crm/admin/roles';
      const method = existingRole ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootDid: normalizedAssigneeDid,
          grantorRootDid: normalizedGrantorDid,
          roleType,
          franchiseId: needsFranchise || needsTenant ? franchiseId : undefined,
          tenantId: needsTenant ? tenantId : undefined,
          categoryId: needsCategory ? categoryId : undefined,
          permissions,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save admin role');
      }

      const role = await response.json();
      setSuccess(true);
      if (onSuccess) onSuccess(role);
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to save admin role');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-2xl p-8 w-full max-w-md ring-1 ring-white/10 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Admin Role {existingRole ? 'Updated' : 'Assigned'}!</h3>
          <p className="text-slate-400">{ROLE_TYPES.find(r => r.value === roleType)?.label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden ring-1 ring-white/10 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Shield className="text-cyan-400" size={20} />
              {existingRole ? 'Edit Admin Role' : 'Assign Admin Role'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">Configure admin access and permissions</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition" aria-label="Close">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {error && (
              <div className="rounded-lg p-3 bg-red-500/10 ring-1 ring-red-500/20 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}

            {/* DiDQube Identity Hierarchy Note */}
            <div className="rounded-lg p-3 bg-blue-500/10 ring-1 ring-blue-500/20 text-xs text-blue-300">
              <strong>DiDQube Policy:</strong> Admin roles use Root DIDs (deep identity) — not KybeDIDs (personhood anchor) or Personas (day-to-day identity).
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Grantor Root DID * <span className="text-slate-500">(Your Root DID)</span></label>
              <input type="text" value={grantorRootDid} onChange={(e) => setGrantorRootDid(e.target.value)} placeholder="did:root:..."
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500" required />
              <p className="text-xs text-slate-500 mt-1">The Root DID of the admin granting this role</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Assignee Root DID * <span className="text-slate-500">(New Admin)</span></label>
              <input type="text" value={rootDid} onChange={(e) => setRootDid(e.target.value)} placeholder="did:root:..."
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500" required />
              <p className="text-xs text-slate-500 mt-1">The Root DID of the person being granted admin access</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Role Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_TYPES.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button key={role.value} type="button" onClick={() => setRoleType(role.value)}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition text-left ${
                        roleType === role.value ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}>
                      <Icon size={16} />
                      <div>
                        <p className="text-sm font-medium">{role.label}</p>
                        <p className="text-xs text-slate-500">Level {role.level}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {(needsFranchise || needsTenant) && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Franchise *</label>
                <select value={franchiseId} onChange={(e) => { setFranchiseId(e.target.value); setTenantId(''); }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" title="Select franchise">
                  <option value="">Select franchise...</option>
                  {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}

            {needsTenant && franchiseId && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tenant *</label>
                <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" title="Select tenant">
                  <option value="">Select tenant...</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {needsCategory && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Category *</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" title="Select category">
                  <option value="">Select category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-300">Permissions</label>
                <button type="button" onClick={selectAllPermissions}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition">
                  {PERMISSIONS.every(p => permissions[p.key]) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSIONS.map((perm) => (
                  <button key={perm.key} type="button" onClick={() => togglePermission(perm.key)}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition text-left ${
                      permissions[perm.key] ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400'
                    }`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      permissions[perm.key] ? 'bg-emerald-500 border-emerald-500' : 'border-white/30'
                    }`}>
                      {permissions[perm.key] && <CheckCircle size={12} className="text-white" />}
                    </div>
                    <span className="text-sm">{perm.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition">
              {loading ? <><Loader2 size={16} className="animate-spin" />Saving...</> : <><Shield size={16} />{existingRole ? 'Update' : 'Assign'} Role</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
