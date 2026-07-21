/**
 * Constitutional Terminal — the whitelisted, read-only command grammar for the
 * Dev Command Center's Terminal viewport (CFS-020 CDE).
 *
 * THE CONSTITUTIONAL BOUNDARY (CFS-016 D1): the Terminal is a real command
 * surface but NOT a shell. Arbitrary code / shell execution stays human — the
 * execution surface is D2-gated. This module is the ONLY thing that decides
 * whether an input is a legal command: a strict whitelist of the exact first
 * token, with per-command argument validation. Anything outside the whitelist
 * — including shell-injection attempts (`;`-chaining, backticks, `$()`, pipes,
 * redirects) and non-whitelisted binaries (`rm`, `curl`, `node`, `eval`) — is
 * refused with EXACTLY {@link CONSTITUTIONAL_REFUSAL}. There is no eval, no
 * child_process, no dynamic dispatch beyond the whitelist map anywhere that
 * consumes this parser.
 *
 * This file is PURE (no I/O, no fs, no DB, no React) so the whitelist grammar
 * is unit-testable in isolation (tests/dcc-tools.test.ts) and the route that
 * executes it (app/api/dev-command-center/terminal/route.ts) is the only place
 * side effects live.
 */

/** The exact line returned for any input outside the constitutional set. */
export const CONSTITUTIONAL_REFUSAL =
  "not in the constitutional command set (execution stays human under CFS-016 D1) — type 'help'";

/** The whitelisted first tokens. Extend by appending — never widen at runtime. */
export const TERMINAL_COMMANDS = [
  'help',
  'status',
  'receipts',
  'env-check',
  'canisters',
  'repo',
  'session',
  // Server-side observation diagnostics (CFS-020 CDE DevTools scope, 2026-07-07)
  // — all READ-ONLY, composed from existing durable sources.
  'dvn',
  'logs',
  'net',
  'experiments',
] as const;

export type TerminalCommand = (typeof TERMINAL_COMMANDS)[number];

/** The `repo` sub-commands (read-only GitHub navigation). */
export const REPO_SUBCOMMANDS = ['ls', 'cat', 'log', 'branches'] as const;
export type RepoSubcommand = (typeof REPO_SUBCOMMANDS)[number];

/** The `dvn` sub-commands (read-only DVN pipeline snapshot). */
export const DVN_SUBCOMMANDS = ['status', 'pending', 'failed'] as const;
export type DvnSubcommand = (typeof DVN_SUBCOMMANDS)[number];

export interface ParsedTerminal {
  command: TerminalCommand;
  /** For `repo`, the validated sub-command; otherwise null. */
  sub: RepoSubcommand | null;
  /** For `dvn`, the validated sub-command (defaults to `status`); otherwise null. */
  dvnSub: DvnSubcommand | null;
  /** Raw remaining tokens after the command (and, for repo, the sub). */
  args: string[];
  /** Parsed positive-integer count for `receipts [n]` / `repo log [n]` / `logs [n]` / `net [n]`. */
  count: number | null;
  /** Validated path for `repo ls [path]` / `repo cat <file>` (traversal-safe). */
  path: string | null;
}

export type ParseResult =
  | { ok: true; parsed: ParsedTerminal }
  | { ok: false; error: string };

// Shell metacharacters that betray a shell-execution attempt. Their presence
// means the input is not a member of the constitutional set — refused wholesale
// with the constitutional line (never tokenized, never dispatched). Covers
// `;`-chaining, backticks, `$()`, subshells `()`/`{}`, pipes, redirects.
const SHELL_METACHAR = /[;&|`$<>\n\r(){}]/;

const MAX_COUNT = 50;

function isSafeRelPath(p: string): boolean {
  // Read-only repo navigation: reject absolute paths, parent traversal, and
  // NUL. A leading `./` is tolerated (stripped by the caller); everything else
  // must be a plain relative path segment chain.
  if (p.length === 0) return true; // empty = repo root
  if (p.includes('\0')) return false;
  if (p.startsWith('/')) return false;
  const segments = p.split('/');
  return !segments.some((s) => s === '..');
}

/**
 * Parse one line of terminal input against the constitutional whitelist.
 *
 * Pure and total: never throws. Returns `{ ok: false, error }` where `error`
 * is the exact {@link CONSTITUTIONAL_REFUSAL} for anything outside the set (or
 * for a shell-injection attempt), and a specific usage/validation message for
 * a whitelisted command invoked with bad arguments (e.g. path traversal).
 */
export function parseTerminalCommand(raw: string): ParseResult {
  const input = (raw ?? '').trim();
  if (input.length === 0) {
    return { ok: false, error: "type 'help' for the constitutional command set" };
  }

  // Any shell metacharacter ⇒ not in the set (blocks `;`-chaining, backticks,
  // `$()`, pipes, redirects, subshells).
  if (SHELL_METACHAR.test(input)) {
    return { ok: false, error: CONSTITUTIONAL_REFUSAL };
  }

  const tokens = input.split(/\s+/);
  const first = tokens[0];

  if (!(TERMINAL_COMMANDS as readonly string[]).includes(first)) {
    return { ok: false, error: CONSTITUTIONAL_REFUSAL };
  }
  const command = first as TerminalCommand;
  const rest = tokens.slice(1);

  const base: ParsedTerminal = { command, sub: null, dvnSub: null, args: rest, count: null, path: null };

  switch (command) {
    case 'help':
    case 'status':
    case 'env-check':
    case 'canisters':
    case 'session':
    case 'experiments':
      // Zero-arg commands — extra tokens ignored (read-only, harmless).
      return { ok: true, parsed: base };

    case 'receipts': {
      if (rest.length === 0) return { ok: true, parsed: { ...base, count: 10 } };
      const n = Number(rest[0]);
      if (!Number.isInteger(n) || n < 1) {
        return { ok: false, error: 'receipts expects an optional positive integer count, e.g. `receipts 5`' };
      }
      return { ok: true, parsed: { ...base, count: Math.min(n, MAX_COUNT) } };
    }

    case 'logs':
    case 'net': {
      // Optional positive-integer count; default 15. Same validation shape as
      // `receipts` — a malformed count is a usage error, never the refusal line.
      if (rest.length === 0) return { ok: true, parsed: { ...base, count: 15 } };
      const n = Number(rest[0]);
      if (!Number.isInteger(n) || n < 1) {
        return { ok: false, error: `${command} expects an optional positive integer count, e.g. \`${command} 20\`` };
      }
      return { ok: true, parsed: { ...base, count: Math.min(n, MAX_COUNT) } };
    }

    case 'dvn': {
      const sub = rest[0];
      if (sub === undefined) {
        // Bare `dvn` defaults to the status snapshot.
        return { ok: true, parsed: { ...base, dvnSub: 'status' } };
      }
      if (!(DVN_SUBCOMMANDS as readonly string[]).includes(sub)) {
        return { ok: false, error: 'dvn: expected `status` | `pending` | `failed`' };
      }
      return { ok: true, parsed: { ...base, dvnSub: sub as DvnSubcommand } };
    }

    case 'repo': {
      const sub = rest[0];
      if (!sub || !(REPO_SUBCOMMANDS as readonly string[]).includes(sub)) {
        return { ok: false, error: 'repo: expected `ls [path]` | `cat <file>` | `log [n]` | `branches`' };
      }
      const subCmd = sub as RepoSubcommand;
      const subArgs = rest.slice(1);

      if (subCmd === 'branches') {
        return { ok: true, parsed: { ...base, sub: subCmd, args: subArgs } };
      }
      if (subCmd === 'log') {
        if (subArgs.length === 0) return { ok: true, parsed: { ...base, sub: subCmd, args: subArgs, count: 15 } };
        const n = Number(subArgs[0]);
        if (!Number.isInteger(n) || n < 1) {
          return { ok: false, error: 'repo log expects an optional positive integer count, e.g. `repo log 10`' };
        }
        return { ok: true, parsed: { ...base, sub: subCmd, args: subArgs, count: Math.min(n, MAX_COUNT) } };
      }
      if (subCmd === 'ls') {
        const p = (subArgs[0] ?? '').replace(/^\.\//, '');
        if (!isSafeRelPath(p)) {
          return { ok: false, error: 'repo ls: path traversal is not permitted' };
        }
        return { ok: true, parsed: { ...base, sub: subCmd, args: subArgs, path: p } };
      }
      // subCmd === 'cat'
      if (subArgs.length === 0) {
        return { ok: false, error: 'repo cat: a file path is required, e.g. `repo cat README.md`' };
      }
      const file = subArgs[0].replace(/^\.\//, '');
      if (!isSafeRelPath(file) || file.length === 0) {
        return { ok: false, error: 'repo cat: path traversal is not permitted' };
      }
      return { ok: true, parsed: { ...base, sub: subCmd, args: subArgs, path: file } };
    }
  }
}

// ─── Pure output formatters (I/O-free — testable, reused by the route) ──────

/** The `help` output — the command set + the constitutional boundary note. */
export function helpLines(): string[] {
  return [
    'Constitutional command set (read-only — execution stays human under CFS-016 D1):',
    '',
    '  help              this message + the constitutional boundary',
    '  status            platform summary (env, canisters, receipts pipeline)',
    '  env-check         env var presence (names + present/absent — never values)',
    '  canisters         ICP canister reachability / health',
    '  receipts [n]      last n activity receipts (T2-safe fields only)',
    '  session           this dev-loop session\'s current stage',
    '  dvn [sub]         DVN pipeline snapshot — status | pending | failed',
    '  logs [n]          escalation tail — dvn_failed receipts (DB-durable, newest first)',
    '  net [n]           recent server API calls (this compute instance only — resets on cold start)',
    '  experiments       research-object lifecycle states (durable lab record)',
    '  repo ls [path]    list a repo directory',
    '  repo cat <file>   show a file (truncated ~200 lines)',
    '  repo log [n]      recent commits',
    '  repo branches     list branches',
    '',
    'This Terminal is NOT a shell. Anything outside this set — arbitrary',
    'commands, shell chaining, subshells — is refused. The execution surface',
    'is D2-gated: constitutional actions are proposed here, executed by a human.',
  ];
}

export interface EnvPresence {
  name: string;
  present: boolean;
}

/**
 * Render env-var presence as terminal lines. Takes ONLY booleans by
 * construction — a value can never leak through this function. Used by the
 * `env-check` and `status` commands.
 */
export function renderEnvCheck(presence: EnvPresence[]): string[] {
  const lines = ['env-check — presence only (values are never read or shown):', ''];
  for (const { name, present } of presence) {
    lines.push(`  ${present ? '[✓ present]' : '[· absent ]'}  ${name}`);
  }
  const missing = presence.filter((p) => !p.present).map((p) => p.name);
  lines.push('');
  lines.push(
    missing.length === 0
      ? `all ${presence.length} tracked env vars present`
      : `${presence.length - missing.length}/${presence.length} present — missing: ${missing.join(', ')}`,
  );
  return lines;
}
