export type AutobindMode = 'off' | 'soft' | 'public';

function boolEnv(name: string, def: boolean): boolean {
  const v = (process.env[name] || '').toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return def;
}

export function autobindMode(): AutobindMode {
  const m = (process.env.IDENTITY_FIO_AUTOBIND || 'off').toLowerCase();
  if (m === 'soft' || m === 'public') return m as AutobindMode;
  return 'off';
}

export function requireConsent(): boolean {
  return boolEnv('IDENTITY_FIO_REQUIRE_CONSENT', true);
}

export function aliasTtlDays(): number {
  const n = Number(process.env.IDENTITY_FIO_ALIAS_TTL_DAYS || '90');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
}

export function auditExposeAlias(): boolean {
  return boolEnv('AUDIT_EXPOSE_ALIAS', false);
}
