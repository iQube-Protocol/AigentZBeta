import type { QubeTalkAuthority, QubeTalkThread } from "./types";

export const QUBETALK_THREADS: QubeTalkThread[] = ["spec", "api-wiring", "ui-shell", "dev-exec", "ops"];

export const AUTHORITY_POST_PERMISSIONS: Record<QubeTalkAuthority, QubeTalkThread[]> = {
  aigent_z: [...QUBETALK_THREADS],
  chatgpt: [...QUBETALK_THREADS],
  lovable: ["spec", "ui-shell", "dev-exec", "ops"],
  windsurf: ["api-wiring", "ui-shell", "dev-exec", "ops"],
  codex: ["api-wiring", "ui-shell", "dev-exec", "ops"],
};

export function getAllowedThreadsForAuthority(authority: QubeTalkAuthority): QubeTalkThread[] {
  return AUTHORITY_POST_PERMISSIONS[authority] ?? [];
}

export function canAuthorityPublishThread(authority: QubeTalkAuthority, thread: QubeTalkThread): boolean {
  return getAllowedThreadsForAuthority(authority).includes(thread);
}
