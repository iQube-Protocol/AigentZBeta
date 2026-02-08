import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import {
  createExperienceQube as createStoreExperienceQube,
  createSession as createStoreSession,
  deleteExperienceQube as deleteStoreExperienceQube,
  deleteSession as deleteStoreSession,
  getAllExperienceQubes,
  getSession as getStoreSession,
  getExperienceQube as getStoreExperienceQube,
  getAllSessions,
  updateExperienceQube as updateStoreExperienceQube,
  updateSession as updateStoreSession,
  type ComposerSessionData,
  type ExperienceQubeData,
} from "@/services/composer/composerStore";
import {
  deleteExperienceLocal,
  deleteSessionLocal,
  getExperienceLocal,
  getSessionLocal,
  listExperiencesLocal,
  listSessionsLocal,
  upsertExperienceLocal,
  upsertSessionLocal,
} from "@/services/composer/composerLocalDb";

const EXPERIENCE_TABLE = "composer_experience_qubes";
const SESSION_TABLE = "composer_sessions";

type ExperienceRow = {
  id: string;
  tenant_id: string;
  creator_id: string;
  template_id: string;
  status: string;
  meta_qube: Record<string, any>;
  blak_qube: Record<string, any>;
  token_qube: Record<string, any>;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  template_id: string;
  current_step: number;
  status: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

function mapExperienceToRow(experience: ExperienceQubeData): ExperienceRow {
  return {
    id: experience.id,
    tenant_id: experience.tenant_id,
    creator_id: experience.creator_id,
    template_id: experience.template_id,
    status: experience.status,
    meta_qube: {
      name: experience.name,
      description: experience.description,
      category: experience.metadata.category,
      tags: (experience.metadata as any).tags,
      version: experience.metadata.version,
      created_at: experience.metadata.created_at,
      updated_at: experience.metadata.updated_at,
    },
    blak_qube: {
      configuration: experience.configuration,
      components: experience.components,
      execution: experience.execution,
    },
    token_qube: experience.access,
    created_at: experience.metadata.created_at,
    updated_at: experience.metadata.updated_at,
  };
}

function normalizeAccess(input: Record<string, any> | null | undefined): ExperienceQubeData["access"] {
  const access = input || {};
  const visibility = access.visibility === "tenant" || access.visibility === "public" ? access.visibility : "private";
  return {
    visibility,
    required_entitlements: Array.isArray(access.required_entitlements) ? access.required_entitlements : [],
    allowed_roles: Array.isArray(access.allowed_roles) ? access.allowed_roles : [],
  };
}

function mapRowToExperience(row: ExperienceRow): ExperienceQubeData {
  const meta = row.meta_qube || {};
  const blak = row.blak_qube || {};
  return {
    id: row.id,
    name: meta.name || "ExperienceQube",
    description: meta.description || "",
    tenant_id: row.tenant_id,
    creator_id: row.creator_id,
    template_id: row.template_id,
    status: row.status as ExperienceQubeData["status"],
    components: blak.components || [],
    configuration: blak.configuration || {},
    metadata: {
      created_at: meta.created_at || row.created_at,
      updated_at: meta.updated_at || row.updated_at,
      version: meta.version || "1.0.0",
      tags: meta.tags || [],
      category: meta.category || "content",
    },
    execution: blak.execution || {
      auto_start: false,
      retry_policy: "none",
      timeout_seconds: 300,
      max_concurrent_users: 10,
    },
    access: normalizeAccess(row.token_qube),
  };
}

function mapSessionToRow(session: ComposerSessionData): SessionRow {
  return {
    id: session.id,
    tenant_id: session.tenant_id,
    user_id: session.user_id,
    template_id: session.template_id,
    current_step: session.current_step,
    status: session.status,
    data: session.data || {},
    created_at: session.created_at,
    updated_at: session.updated_at,
    expires_at: session.expires_at,
  };
}

function mapRowToSession(row: SessionRow): ComposerSessionData {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    template_id: row.template_id,
    current_step: row.current_step,
    status: row.status as ComposerSessionData["status"],
    data: row.data || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
  };
}

function getSupabase() {
  return getSupabaseServer();
}

export async function createExperienceRecord(experience: ExperienceQubeData): Promise<ExperienceQubeData> {
  const supabase = getSupabase();
  if (!supabase) {
    createStoreExperienceQube(experience);
    return experience;
  }

  const row = mapExperienceToRow(experience);
  const { data, error } = await supabase
    .from(EXPERIENCE_TABLE)
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error || !data) {
    console.warn("Composer persistence fallback (create experience)", error?.message || error);
    createStoreExperienceQube(experience);
    await upsertExperienceLocal(experience);
    return experience;
  }

  return mapRowToExperience(data as ExperienceRow);
}

export async function getExperienceRecord(id: string): Promise<ExperienceQubeData | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return (await getExperienceLocal(id)) || getStoreExperienceQube(id) || null;
  }

  const { data, error } = await supabase.from(EXPERIENCE_TABLE).select("*").eq("id", id).single();
  if (error || !data) {
    if (error) {
      console.warn("Composer persistence fallback (get experience)", error.message);
    }
    return (await getExperienceLocal(id)) || getStoreExperienceQube(id) || null;
  }

  return mapRowToExperience(data as ExperienceRow);
}

export async function listExperienceRecords(params: {
  tenant_id?: string;
  creator_id?: string;
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: ExperienceQubeData[]; total: number }> {
  const supabase = getSupabase();
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  if (!supabase) {
    let items = await listExperiencesLocal(params);
    if (items.length === 0) {
      items = getAllExperienceQubes();
    }
    if (params.tenant_id) items = items.filter((exp) => exp.tenant_id === params.tenant_id);
    if (params.creator_id) items = items.filter((exp) => exp.creator_id === params.creator_id);
    if (params.status) items = items.filter((exp) => exp.status === params.status);
    if (params.category) items = items.filter((exp) => exp.metadata.category === params.category);
    items.sort(
      (a, b) => new Date(b.metadata.updated_at).getTime() - new Date(a.metadata.updated_at).getTime()
    );
    const total = items.length;
    return { items: items.slice(offset, offset + limit), total };
  }

  let query = supabase.from(EXPERIENCE_TABLE).select("*");
  if (params.tenant_id) query = query.eq("tenant_id", params.tenant_id);
  if (params.creator_id) query = query.eq("creator_id", params.creator_id);
  if (params.status) query = query.eq("status", params.status);

  const { data, error } = await query;
  if (error || !data) {
    console.warn("Composer persistence fallback (list experiences)", error?.message || error);
    const items = await listExperiencesLocal(params);
    if (items.length === 0) {
      const storeItems = getAllExperienceQubes();
      return { items: storeItems, total: storeItems.length };
    }
    return { items, total: items.length };
  }

  let items = (data as ExperienceRow[]).map(mapRowToExperience);
  if (params.category) items = items.filter((exp) => exp.metadata.category === params.category);
  items.sort((a, b) => new Date(b.metadata.updated_at).getTime() - new Date(a.metadata.updated_at).getTime());
  const total = items.length;
  return { items: items.slice(offset, offset + limit), total };
}

export async function updateExperienceRecord(
  id: string,
  updates: Partial<ExperienceQubeData>
): Promise<ExperienceQubeData | null> {
  const supabase = getSupabase();
  if (!supabase) {
    const success = updateStoreExperienceQube(id, updates);
    if (success) {
      const next = getStoreExperienceQube(id);
      if (next) await upsertExperienceLocal(next);
    }
    return success ? getStoreExperienceQube(id) || null : null;
  }

  const existing = await getExperienceRecord(id);
  if (!existing) return null;
  const merged: ExperienceQubeData = {
    ...existing,
    ...updates,
    metadata: {
      ...existing.metadata,
      ...(updates.metadata || {}),
      updated_at: new Date().toISOString(),
    },
  };

  const row = mapExperienceToRow(merged);
  const { data, error } = await supabase
    .from(EXPERIENCE_TABLE)
    .update(row)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("Composer persistence fallback (update experience)", error?.message || error);
    const success = updateStoreExperienceQube(id, merged);
    if (success) await upsertExperienceLocal(merged);
    return success ? getStoreExperienceQube(id) || null : null;
  }

  return mapRowToExperience(data as ExperienceRow);
}

export async function deleteExperienceRecord(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    const deleted = deleteStoreExperienceQube(id);
    if (deleted) await deleteExperienceLocal(id);
    return deleted;
  }

  const { error } = await supabase.from(EXPERIENCE_TABLE).delete().eq("id", id);
  if (error) {
    console.warn("Composer persistence fallback (delete experience)", error.message);
    const deleted = deleteStoreExperienceQube(id);
    if (deleted) await deleteExperienceLocal(id);
    return deleted;
  }

  return true;
}

export async function createSessionRecord(session: ComposerSessionData): Promise<ComposerSessionData> {
  const supabase = getSupabase();
  if (!supabase) {
    createStoreSession(session);
    await upsertSessionLocal(session);
    return session;
  }

  const row = mapSessionToRow(session);
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error || !data) {
    console.warn("Composer persistence fallback (create session)", error?.message || error);
    createStoreSession(session);
    await upsertSessionLocal(session);
    return session;
  }

  return mapRowToSession(data as SessionRow);
}

export async function getSessionRecord(id: string): Promise<ComposerSessionData | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return (await getSessionLocal(id)) || getStoreSession(id) || null;
  }

  const { data, error } = await supabase.from(SESSION_TABLE).select("*").eq("id", id).single();
  if (error || !data) {
    if (error) console.warn("Composer persistence fallback (get session)", error.message);
    return (await getSessionLocal(id)) || getStoreSession(id) || null;
  }

  return mapRowToSession(data as SessionRow);
}

export async function updateSessionRecord(
  id: string,
  updates: Partial<ComposerSessionData>
): Promise<ComposerSessionData | null> {
  const supabase = getSupabase();
  if (!supabase) {
    const success = updateStoreSession(id, updates);
    if (success) {
      const next = getStoreSession(id);
      if (next) await upsertSessionLocal(next);
    }
    return success ? getStoreSession(id) || null : null;
  }

  const existing = await getSessionRecord(id);
  if (!existing) return null;
  const merged: ComposerSessionData = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  const row = mapSessionToRow(merged);
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .update(row)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("Composer persistence fallback (update session)", error?.message || error);
    const success = updateStoreSession(id, merged);
    if (success) await upsertSessionLocal(merged);
    return success ? getStoreSession(id) || null : null;
  }

  return mapRowToSession(data as SessionRow);
}

export async function deleteSessionRecord(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    const deleted = deleteStoreSession(id);
    if (deleted) await deleteSessionLocal(id);
    return deleted;
  }

  const { error } = await supabase.from(SESSION_TABLE).delete().eq("id", id);
  if (error) {
    console.warn("Composer persistence fallback (delete session)", error.message);
    const deleted = deleteStoreSession(id);
    if (deleted) await deleteSessionLocal(id);
    return deleted;
  }

  return true;
}

export async function listSessionRecords(params: {
  tenant_id?: string;
  user_id?: string;
  status?: string;
}): Promise<ComposerSessionData[]> {
  const supabase = getSupabase();
  if (!supabase) {
    let sessions = await listSessionsLocal(params);
    if (sessions.length === 0) sessions = getAllSessions();
    if (params.user_id) sessions = sessions.filter((s) => s.user_id === params.user_id);
    if (params.tenant_id) sessions = sessions.filter((s) => s.tenant_id === params.tenant_id);
    if (params.status) sessions = sessions.filter((s) => s.status === params.status);
    return sessions;
  }

  let query = supabase.from(SESSION_TABLE).select("*");
  if (params.user_id) query = query.eq("user_id", params.user_id);
  if (params.tenant_id) query = query.eq("tenant_id", params.tenant_id);
  if (params.status) query = query.eq("status", params.status);

  const { data, error } = await query;
  if (error || !data) {
    console.warn("Composer persistence fallback (list sessions)", error?.message || error);
    const sessions = await listSessionsLocal(params);
    if (sessions.length === 0) return getAllSessions();
    return sessions;
  }

  return (data as SessionRow[]).map(mapRowToSession);
}
