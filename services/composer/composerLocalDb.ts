import fs from "fs/promises";
import path from "path";
import type { ComposerSessionData, ExperienceQubeData } from "@/services/composer/composerStore";
import { createAutoDriveApi } from "@autonomys/auto-drive";

type LocalDbShape = {
  sessions: Record<string, ComposerSessionData>;
  experiences: Record<string, ExperienceQubeData>;
  updated_at: string;
};

const LOCAL_DB_DIR = path.join(process.cwd(), "apps", "metame", ".local");
const LOCAL_DB_PATH = path.join(LOCAL_DB_DIR, "composer-db.json");

async function ensureLocalDb(): Promise<LocalDbShape> {
  try {
    await fs.mkdir(LOCAL_DB_DIR, { recursive: true });
    const raw = await fs.readFile(LOCAL_DB_PATH, "utf-8");
    return JSON.parse(raw) as LocalDbShape;
  } catch {
    return {
      sessions: {},
      experiences: {},
      updated_at: new Date().toISOString(),
    };
  }
}

async function writeLocalDb(payload: LocalDbShape) {
  const next = { ...payload, updated_at: new Date().toISOString() };
  await fs.mkdir(LOCAL_DB_DIR, { recursive: true });
  await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(next, null, 2), "utf-8");
  await syncAutoDrive(next);
}

async function syncAutoDrive(payload: LocalDbShape) {
  const apiKey = process.env.AUTONOMYS_API_KEY;
  if (!apiKey) return;
  try {
    const network = process.env.AUTONOMYS_NETWORK_ID === "testnet" ? "testnet" : "mainnet";
    const api = createAutoDriveApi({ apiKey, network: network as any });
    if (typeof (api as any).uploadObjectAsJSON === "function") {
      await (api as any).uploadObjectAsJSON(payload, "composer-db.json");
    }
  } catch (error) {
    console.warn("AutoDrive sync failed for Composer local DB:", error);
  }
}

export async function upsertSessionLocal(session: ComposerSessionData): Promise<ComposerSessionData> {
  const db = await ensureLocalDb();
  db.sessions[session.id] = session;
  await writeLocalDb(db);
  return session;
}

export async function getSessionLocal(id: string): Promise<ComposerSessionData | null> {
  const db = await ensureLocalDb();
  return db.sessions[id] || null;
}

export async function listSessionsLocal(params: {
  tenant_id?: string;
  user_id?: string;
  status?: string;
}): Promise<ComposerSessionData[]> {
  const db = await ensureLocalDb();
  let sessions = Object.values(db.sessions);
  if (params.tenant_id) sessions = sessions.filter((s) => s.tenant_id === params.tenant_id);
  if (params.user_id) sessions = sessions.filter((s) => s.user_id === params.user_id);
  if (params.status) sessions = sessions.filter((s) => s.status === params.status);
  return sessions;
}

export async function deleteSessionLocal(id: string): Promise<boolean> {
  const db = await ensureLocalDb();
  if (!db.sessions[id]) return false;
  delete db.sessions[id];
  await writeLocalDb(db);
  return true;
}

export async function upsertExperienceLocal(experience: ExperienceQubeData): Promise<ExperienceQubeData> {
  const db = await ensureLocalDb();
  db.experiences[experience.id] = experience;
  await writeLocalDb(db);
  return experience;
}

export async function getExperienceLocal(id: string): Promise<ExperienceQubeData | null> {
  const db = await ensureLocalDb();
  return db.experiences[id] || null;
}

export async function listExperiencesLocal(params: {
  tenant_id?: string;
  creator_id?: string;
  status?: string;
  category?: string;
}): Promise<ExperienceQubeData[]> {
  const db = await ensureLocalDb();
  let items = Object.values(db.experiences);
  if (params.tenant_id) items = items.filter((exp) => exp.tenant_id === params.tenant_id);
  if (params.creator_id) items = items.filter((exp) => exp.creator_id === params.creator_id);
  if (params.status) items = items.filter((exp) => exp.status === params.status);
  if (params.category) items = items.filter((exp) => exp.metadata.category === params.category);
  return items;
}

export async function deleteExperienceLocal(id: string): Promise<boolean> {
  const db = await ensureLocalDb();
  if (!db.experiences[id]) return false;
  delete db.experiences[id];
  await writeLocalDb(db);
  return true;
}
