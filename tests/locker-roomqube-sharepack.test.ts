/**
 * Locker / RoomQube / Share Pack — Phase 1 service-layer tests.
 * codexes/packs/agentiq/updates/2026-08-25_locker-roomqube-sharepacks-phase1.md
 *
 * Exercises spec §20 MVP acceptance criteria that are in scope for Phase 1:
 * registration/versioning/dedup (1-6), RoomQube CRUD/placements/membership/
 * QubeTalk activation (11-20), retrieval/communication (21-27, email
 * channel), and the confidential-asset send gate (28).
 *
 * Uses a hand-rolled in-memory fake Supabase client (no local
 * createFakeSupabase() helper exists yet in this worktree to reuse — see
 * the Phase 1 closeout's reuse-audit §0) mocked in place of
 * getSupabaseServer, and exercises the REAL service functions end-to-end
 * against it — not a reimplementation of their logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { personaPublicRef } from '@/services/identity/personaReferences';

// ─────────────────────────────────────────────────────────────────────────
// Fake Supabase client — minimal chainable query builder covering exactly
// the operations services/locker/*.ts issues.
// ─────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

class FakeQueryBuilder implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null; count?: number }> {
  private filters: Array<(row: Row) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private wantsSelect = false;

  constructor(
    private tables: Map<string, Row[]>,
    private table: string,
    private op: 'select' | 'insert' | 'update' | 'delete',
    private payload?: Row | Row[],
  ) {}

  private rows(): Row[] {
    if (!this.tables.has(this.table)) this.tables.set(this.table, []);
    return this.tables.get(this.table)!;
  }

  select(_cols?: string) { this.wantsSelect = true; return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  is(col: string, val: unknown) {
    // Mirrors real Postgres semantics: an unset column defaults to NULL, so
    // `.is(col, null)` must match a row where the fake insert never set the
    // key at all (undefined) as well as one explicitly set to null.
    this.filters.push((r) => (val === null ? (r[col] === null || r[col] === undefined) : r[col] === val));
    return this;
  }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  ilike(col: string, val: string) {
    const needle = String(val).replace(/%/g, '').toLowerCase();
    this.filters.push((r) => String(r[col] ?? '').toLowerCase().includes(needle));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) { this.orderCol = col; this.orderAsc = opts?.ascending !== false; return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }

  private async execute(): Promise<{ data: unknown; error: { message: string; code?: string } | null }> {
    if (this.op === 'insert') {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const inserted = incoming.map((r) => ({ id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...r }));
      this.rows().push(...inserted);
      if (!this.wantsSelect) return { data: null, error: null };
      if (this.singleMode) return { data: inserted[0] ?? null, error: null };
      return { data: inserted, error: null };
    }

    if (this.op === 'update') {
      const matched = this.rows().filter((r) => this.filters.every((f) => f(r)));
      matched.forEach((r) => Object.assign(r, this.payload));
      if (!this.wantsSelect) return { data: null, error: null };
      if (this.singleMode) return { data: matched[0] ?? null, error: null };
      return { data: matched, error: null };
    }

    if (this.op === 'delete') {
      const remaining = this.rows().filter((r) => !this.filters.every((f) => f(r)));
      const removedCount = this.rows().length - remaining.length;
      this.tables.set(this.table, remaining);
      return { data: removedCount > 0 ? [] : null, error: null };
    }

    // select
    let result = this.rows().filter((r) => this.filters.every((f) => f(r)));
    if (this.orderCol) {
      const col = this.orderCol;
      result = [...result].sort((a, b) => {
        const av = String(a[col] ?? '');
        const bv = String(b[col] ?? '');
        return this.orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (this.limitN != null) result = result.slice(0, this.limitN);
    if (this.singleMode === 'single') return { data: result[0] ?? null, error: result[0] ? null : { message: 'not found' } };
    if (this.singleMode === 'maybeSingle') return { data: result[0] ?? null, error: null };
    return { data: result, error: null };
  }

  then<TResult1 = { data: unknown; error: { message: string; code?: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string; code?: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected) as PromiseLike<TResult1 | TResult2>;
  }
}

function createFakeSupabase() {
  const tables = new Map<string, Row[]>();
  return {
    tables,
    from(table: string) {
      return {
        select: (cols?: string) => new FakeQueryBuilder(tables, table, 'select').select(cols),
        insert: (payload: Row | Row[]) => new FakeQueryBuilder(tables, table, 'insert', payload),
        update: (payload: Row) => new FakeQueryBuilder(tables, table, 'update', payload),
        delete: () => new FakeQueryBuilder(tables, table, 'delete'),
      };
    },
  };
}

let fakeDb: ReturnType<typeof createFakeSupabase>;

vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: () => fakeDb,
}));

vi.mock('@/services/content/storageAdapter', () => ({
  StorageAdapterFactory: {
    getAdapter: () => ({
      upload: async (_bucket: string, path: string) => ({
        uri: path,
        provider: 'supabase',
        publicUrl: `https://fake-storage.example/${path}`,
        sizeBytes: 1234,
      }),
    }),
  },
}));

const originalFetch = global.fetch;

beforeEach(() => {
  fakeDb = createFakeSupabase();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
// Asset registry — acceptance #1-6.
// ─────────────────────────────────────────────────────────────────────────

describe('assetRegistry', () => {
  it('registers a new asset with its own version family at version 1', async () => {
    const { registerAsset } = await import('@/services/locker/assetRegistry');
    const result = await registerAsset({
      ownerPersonaId: 'persona-a',
      title: 'MetaProof Investor Deck',
      assetClass: 'deck',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.versionNumber).toBe(1);
    expect(result.value.versionFamilyId).toBeTruthy();
    expect(result.value.versionFamilyId).not.toBe(result.value.id);
  });

  it('registering a new version increments version_number and links supersedesAssetId (acceptance #9, never rewrites the prior row)', async () => {
    const { registerAsset } = await import('@/services/locker/assetRegistry');
    const v1 = await registerAsset({ ownerPersonaId: 'persona-a', title: 'SAFE Agreement', assetClass: 'agreement' });
    expect(v1.ok).toBe(true);
    if (!v1.ok) return;

    const v2 = await registerAsset({
      ownerPersonaId: 'persona-a',
      title: 'SAFE Agreement',
      assetClass: 'agreement',
      newVersionOf: { versionFamilyId: v1.value.versionFamilyId, supersedesAssetId: v1.value.id },
    });
    expect(v2.ok).toBe(true);
    if (!v2.ok) return;
    expect(v2.value.versionNumber).toBe(2);
    expect(v2.value.versionFamilyId).toBe(v1.value.versionFamilyId);
    expect(v2.value.supersedesAssetId).toBe(v1.value.id);

    // The prior version's own row is untouched (acceptance #27 in spirit —
    // registering v2 never mutates v1).
    const v1Row = fakeDb.tables.get('asset_records')!.find((r) => r.id === v1.value.id);
    expect(v1Row?.version_number).toBe(1);
  });

  it('uploadLockerFile stores bytes via the storage adapter, hashes, and detects an exact duplicate (acceptance #4-5)', async () => {
    const { uploadLockerFile } = await import('@/services/locker/assetRegistry');
    const bytes = new TextEncoder().encode('investor deck contents').buffer;

    const first = await uploadLockerFile({
      ownerPersonaId: 'persona-a',
      file: bytes,
      filename: 'deck.pdf',
      mimeType: 'application/pdf',
      assetClass: 'deck',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.exactDuplicateOfAssetId).toBeNull();
    expect(first.value.asset.contentHash).toBeTruthy();
    expect(first.value.rendition.isPrimary).toBe(true);
    expect(first.value.rendition.storageUri).toContain('persona-a/');

    const second = await uploadLockerFile({
      ownerPersonaId: 'persona-a',
      file: bytes,
      filename: 'deck-copy.pdf',
      mimeType: 'application/pdf',
      assetClass: 'deck',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    // Exact duplicate is DETECTED (acceptance #5) but never silently
    // blocked/merged (acceptance #6) — a new row is still registered.
    expect(second.value.exactDuplicateOfAssetId).toBe(first.value.asset.id);
    expect(second.value.asset.id).not.toBe(first.value.asset.id);
  });

  it('resolveAsset ranks an exact alias match above a fuzzy title match (spec §13)', async () => {
    const { registerAsset, resolveAsset } = await import('@/services/locker/assetRegistry');
    await registerAsset({
      ownerPersonaId: 'persona-a',
      title: 'MetaProof Q3 Investor Deck',
      assetClass: 'deck',
      lifecycleStatus: 'current',
      aliases: ['latest-investor-deck'],
    });
    await registerAsset({
      ownerPersonaId: 'persona-a',
      title: 'Investor Overview Slides',
      assetClass: 'deck',
      lifecycleStatus: 'current',
    });

    const result = await resolveAsset('latest-investor-deck', 'persona-a');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.confidence).toBe('exact_alias');
    expect(result.value[0]?.asset.title).toBe('MetaProof Q3 Investor Deck');
  });

  it('resolveAsset returns multiple candidates when ambiguous rather than guessing (acceptance #22)', async () => {
    const { registerAsset, resolveAsset } = await import('@/services/locker/assetRegistry');
    await registerAsset({ ownerPersonaId: 'persona-a', title: 'Investor Deck', assetClass: 'deck', lifecycleStatus: 'current' });
    await registerAsset({ ownerPersonaId: 'persona-a', title: 'Investor Deck v2', assetClass: 'deck', lifecycleStatus: 'current' });

    const result = await resolveAsset('Investor Deck', 'persona-a');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBeGreaterThanOrEqual(2);
  });

  it('an asset lookup by a non-owning caller is denied (T0 ownership check)', async () => {
    const { registerAsset, getAsset } = await import('@/services/locker/assetRegistry');
    const registered = await registerAsset({ ownerPersonaId: 'persona-a', title: 'Confidential Report', assetClass: 'report' });
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    const asOther = await getAsset(registered.value.id, 'persona-b');
    expect(asOther.ok).toBe(false);
    if (asOther.ok) return;
    expect(asOther.code).toBe('forbidden');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// RoomQube — acceptance #11-20.
// ─────────────────────────────────────────────────────────────────────────

describe('roomQube', () => {
  it('creates a RoomQube of any roomType through the SAME primitive (acceptance #16) and seats the owner as a member', async () => {
    const { createRoomQube } = await import('@/services/locker/roomQube');
    for (const roomType of ['data-room', 'research-room', 'partner-room'] as const) {
      const result = await createRoomQube({ ownerPersonaId: 'persona-a', title: `${roomType} test`, roomType });
      expect(result.ok).toBe(true);
    }
    const members = fakeDb.tables.get('roomqube_members') ?? [];
    expect(members.filter((m) => m.role === 'owner').length).toBe(3);
  });

  it('places a Locker-native deck, a Locker-native SAFE, and a referenced (non-locker) essay in one Data Room (acceptance #11-12)', async () => {
    const { registerAsset } = await import('@/services/locker/assetRegistry');
    const { createRoomQube, addAssetToRoomQube, resolveRoomQube } = await import('@/services/locker/roomQube');

    const deck = await registerAsset({ ownerPersonaId: 'persona-a', title: 'Investor Deck', assetClass: 'deck' });
    const safe = await registerAsset({ ownerPersonaId: 'persona-a', title: 'SAFE', assetClass: 'agreement' });
    const essay = await registerAsset({
      ownerPersonaId: 'persona-a',
      title: 'Trusted Intelligence',
      assetClass: 'essay',
      nativeSystem: 'qriptopian',
      nativeReference: { slug: 'trusted-intelligence' },
    });
    expect(deck.ok && safe.ok && essay.ok).toBe(true);
    if (!deck.ok || !safe.ok || !essay.ok) return;

    const room = await createRoomQube({ ownerPersonaId: 'persona-a', title: 'MetaProof Investor Data Room', roomType: 'data-room' });
    expect(room.ok).toBe(true);
    if (!room.ok) return;

    await addAssetToRoomQube({ roomQubeId: room.value.id, assetId: deck.value.id, callerPersonaId: 'persona-a' });
    await addAssetToRoomQube({ roomQubeId: room.value.id, assetId: safe.value.id, callerPersonaId: 'persona-a' });
    await addAssetToRoomQube({ roomQubeId: room.value.id, assetId: essay.value.id, callerPersonaId: 'persona-a' });

    const resolved = await resolveRoomQube(room.value.id, 'persona-a');
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.placements.length).toBe(3);
    // The essay is REFERENCED, not duplicated — its native_system stays
    // 'qriptopian' and no bytes were copied into asset_renditions for it.
    expect(essay.value.nativeSystem).toBe('qriptopian');
  });

  it('the same asset can appear in multiple RoomQubes, and removing one placement never deletes the asset (acceptance #13-14)', async () => {
    const { registerAsset, getAsset } = await import('@/services/locker/assetRegistry');
    const { createRoomQube, addAssetToRoomQube, removeRoomQubePlacement, resolveRoomQube } = await import('@/services/locker/roomQube');

    const asset = await registerAsset({ ownerPersonaId: 'persona-a', title: 'Shared Report', assetClass: 'report' });
    const roomOne = await createRoomQube({ ownerPersonaId: 'persona-a', title: 'Room One', roomType: 'project-room' });
    const roomTwo = await createRoomQube({ ownerPersonaId: 'persona-a', title: 'Room Two', roomType: 'board-room' });
    if (!asset.ok || !roomOne.ok || !roomTwo.ok) throw new Error('setup failed');

    const p1 = await addAssetToRoomQube({ roomQubeId: roomOne.value.id, assetId: asset.value.id, callerPersonaId: 'persona-a' });
    await addAssetToRoomQube({ roomQubeId: roomTwo.value.id, assetId: asset.value.id, callerPersonaId: 'persona-a' });
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;

    await removeRoomQubePlacement(p1.value.id, 'persona-a');

    const roomOneResolved = await resolveRoomQube(roomOne.value.id, 'persona-a');
    const roomTwoResolved = await resolveRoomQube(roomTwo.value.id, 'persona-a');
    expect(roomOneResolved.ok && roomOneResolved.value.placements.length).toBe(0);
    expect(roomTwoResolved.ok && roomTwoResolved.value.placements.length).toBe(1);

    const stillExists = await getAsset(asset.value.id, 'persona-a');
    expect(stillExists.ok).toBe(true);
  });

  it('a placement can follow-current while another is pinned in the same room (acceptance #15)', async () => {
    const { registerAsset } = await import('@/services/locker/assetRegistry');
    const { createRoomQube, addAssetToRoomQube, resolveRoomQube } = await import('@/services/locker/roomQube');

    const deck = await registerAsset({ ownerPersonaId: 'persona-a', title: 'Deck', assetClass: 'deck' });
    const experiment = await registerAsset({ ownerPersonaId: 'persona-a', title: 'Experiment Report', assetClass: 'experiment' });
    const room = await createRoomQube({ ownerPersonaId: 'persona-a', title: 'Research Room', roomType: 'research-room' });
    if (!deck.ok || !experiment.ok || !room.ok) throw new Error('setup failed');

    await addAssetToRoomQube({ roomQubeId: room.value.id, assetId: deck.value.id, callerPersonaId: 'persona-a' });
    await addAssetToRoomQube({
      roomQubeId: room.value.id,
      assetId: experiment.value.id,
      callerPersonaId: 'persona-a',
      versionPolicy: { mode: 'pinned', versionAssetId: experiment.value.id },
    });

    const resolved = await resolveRoomQube(room.value.id, 'persona-a');
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const deckPlacement = resolved.value.placements.find((p) => p.assetId === deck.value.id);
    const expPlacement = resolved.value.placements.find((p) => p.assetId === experiment.value.id);
    expect(deckPlacement?.versionPolicy.mode).toBe('follow-current');
    expect(expPlacement?.versionPolicy).toEqual({ mode: 'pinned', versionAssetId: experiment.value.id });
  });

  it('invites a named person with an explicit role and expiry (acceptance #17)', async () => {
    const { createRoomQube, inviteRoomQubeMember, resolveRoomQube } = await import('@/services/locker/roomQube');
    const room = await createRoomQube({ ownerPersonaId: 'persona-a', title: 'Partner Room', roomType: 'partner-room' });
    if (!room.ok) throw new Error('setup failed');

    const invite = await inviteRoomQubeMember({
      roomQubeId: room.value.id,
      callerPersonaId: 'persona-a',
      subjectType: 'person',
      subjectPersonaId: 'persona-jane',
      role: 'viewer',
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;
    expect(invite.value.role).toBe('viewer');
    expect(invite.value.expiresAt).toBe('2026-12-31T00:00:00.000Z');

    const resolved = await resolveRoomQube(room.value.id, 'persona-a');
    expect(resolved.ok && resolved.value.members.some((m) => m.subjectPersonaId === 'persona-jane')).toBe(true);
  });

  it('opening a RoomQube conversation provisions a QubeTalk group + conversation restricted to room members, and is idempotent (acceptance #18)', async () => {
    const { createRoomQube, inviteRoomQubeMember, openRoomConversation } = await import('@/services/locker/roomQube');
    const room = await createRoomQube({ ownerPersonaId: 'persona-a', title: 'Board Room', roomType: 'board-room' });
    if (!room.ok) throw new Error('setup failed');
    await inviteRoomQubeMember({ roomQubeId: room.value.id, callerPersonaId: 'persona-a', subjectType: 'person', subjectPersonaId: 'persona-jane', role: 'viewer' });

    const opened = await openRoomConversation(room.value.id, 'persona-a');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.qubeTalkContext.groupId).toBeTruthy();
    expect(opened.value.qubeTalkContext.conversationId).toBeTruthy();

    const memberships = fakeDb.tables.get('qubetalk_group_memberships') ?? [];
    const participants = fakeDb.tables.get('qubetalk_participants') ?? [];
    const memberPrincipalRefs = memberships
      .filter((m) => m.group_id === opened.value.qubeTalkContext.groupId)
      .map((m) => participants.find((p) => p.id === m.participant_id)?.principal_ref);
    expect(memberPrincipalRefs).toEqual(expect.arrayContaining([personaPublicRef('persona-a'), personaPublicRef('persona-jane')]));

    const conversations = fakeDb.tables.get('qubetalk_conversations') ?? [];
    expect(conversations.length).toBe(1);

    // Idempotent — a second call does not create a second group/conversation.
    const openedAgain = await openRoomConversation(room.value.id, 'persona-a');
    expect(openedAgain.ok && openedAgain.value.qubeTalkContext.conversationId).toBe(opened.value.qubeTalkContext.conversationId);
    expect((fakeDb.tables.get('qubetalk_conversations') ?? []).length).toBe(1);
  });

  it('removing a member also ends their QubeTalk group membership (acceptance #19)', async () => {
    const { createRoomQube, inviteRoomQubeMember, openRoomConversation, resolveRoomQube } = await import('@/services/locker/roomQube');
    const roomQubeModule = await import('@/services/locker/roomQube');
    const room = await createRoomQube({ ownerPersonaId: 'persona-a', title: 'Cohort Room', roomType: 'cohort-room' });
    if (!room.ok) throw new Error('setup failed');
    const member = await inviteRoomQubeMember({ roomQubeId: room.value.id, callerPersonaId: 'persona-a', subjectType: 'person', subjectPersonaId: 'persona-jane', role: 'viewer' });
    if (!member.ok) throw new Error('setup failed');
    await openRoomConversation(room.value.id, 'persona-a');

    await roomQubeModule.removeRoomQubeMember(member.value.id, 'persona-a');

    const resolved = await resolveRoomQube(room.value.id, 'persona-a');
    expect(resolved.ok && resolved.value.members.some((m) => m.subjectPersonaId === 'persona-jane')).toBe(false);

    const memberships = fakeDb.tables.get('qubetalk_group_memberships') ?? [];
    const participants = fakeDb.tables.get('qubetalk_participants') ?? [];
    const janeParticipant = participants.find((p) => p.principal_ref === personaPublicRef('persona-jane'));
    const janeMembership = memberships.find((m) => m.participant_id === janeParticipant?.id);
    expect(janeMembership?.left_at).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Share Pack — acceptance #21-28.
// ─────────────────────────────────────────────────────────────────────────

describe('sharePack', () => {
  async function setupAssetsAndPack() {
    const { registerAsset, addRendition } = await import('@/services/locker/assetRegistry');
    const { composeSharePack } = await import('@/services/locker/sharePack');

    const deck = await registerAsset({ ownerPersonaId: 'persona-a', title: 'Investor Deck', assetClass: 'deck', lifecycleStatus: 'current' });
    const essay = await registerAsset({ ownerPersonaId: 'persona-a', title: 'Trusted Intelligence', assetClass: 'essay', lifecycleStatus: 'current' });
    if (!deck.ok || !essay.ok) throw new Error('setup failed');

    await addRendition({ assetId: deck.value.id, callerPersonaId: 'persona-a', renditionKind: 'pdf', storageProvider: 'supabase', storageUri: 'deck.pdf', publicUrl: 'https://fake-storage.example/deck.pdf', isPrimary: true, contentHash: 'hash-deck' });
    await addRendition({ assetId: essay.value.id, callerPersonaId: 'persona-a', renditionKind: 'pdf', storageProvider: 'supabase', storageUri: 'essay.pdf', publicUrl: 'https://fake-storage.example/essay.pdf', isPrimary: true, contentHash: 'hash-essay' });

    const pack = await composeSharePack({
      ownerPersonaId: 'persona-a',
      title: 'For Jane — review',
      recipientRefs: ['jane@example.com'],
      messageDraft: 'Please review the attached materials.',
      items: [{ assetId: deck.value.id }, { assetId: essay.value.id }],
    });
    if (!pack.ok) throw new Error('compose failed');
    return { deck: deck.value, essay: essay.value, pack: pack.value };
  }

  it('composes a Share Pack from multiple assets and previews exact recipients/assets before sending (acceptance #23-24)', async () => {
    const { previewSharePack } = await import('@/services/locker/sharePack');
    const { pack } = await setupAssetsAndPack();

    const preview = await previewSharePack(pack.id, 'persona-a');
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.value.pack.recipientRefs).toEqual(['jane@example.com']);
    expect(preview.value.items.length).toBe(2);
  });

  it('approving pins the exact resolved version/rendition (acceptance #25)', async () => {
    const { approveSharePack, previewSharePack } = await import('@/services/locker/sharePack');
    const { deck, pack } = await setupAssetsAndPack();

    const approved = await approveSharePack(pack.id, 'persona-a');
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.value.authorizationState).toBe('approved');

    const preview = await previewSharePack(pack.id, 'persona-a');
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const deckItem = preview.value.items.find((i) => i.assetId === deck.id);
    expect(deckItem?.pinnedVersionAssetId).toBe(deck.id);
    expect(deckItem?.resolvedHash).toBe('hash-deck');
  });

  it('sending requires approval first, then dispatches via the Mailjet REST endpoint and writes a communication receipt (acceptance #25-26)', async () => {
    process.env.MAILJET_API_KEY = 'test-key';
    process.env.MAILJET_SECRET_KEY = 'test-secret';
    process.env.MAILJET_FROM_EMAIL = 'noreply@example.com';

    const { approveSharePack, sendSharePack } = await import('@/services/locker/sharePack');
    const { pack } = await setupAssetsAndPack();

    const prematureSend = await sendSharePack(pack.id, 'persona-a');
    expect(prematureSend.ok).toBe(false);

    await approveSharePack(pack.id, 'persona-a');

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const sent = await sendSharePack(pack.id, 'persona-a');
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.authorizationState).toBe('sent');
    expect(sent.value.communicationReceiptId).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('https://api.mailjet.com/v3.1/send', expect.objectContaining({ method: 'POST' }));

    const receipts = fakeDb.tables.get('activity_receipts') ?? [];
    expect(receipts.some((r) => r.action_type === 'locker_share_pack_sent')).toBe(true);
  });

  it('updating the current investor deck AFTER sending does not change the historical Share Pack (acceptance #27)', async () => {
    process.env.MAILJET_API_KEY = 'test-key';
    process.env.MAILJET_SECRET_KEY = 'test-secret';
    process.env.MAILJET_FROM_EMAIL = 'noreply@example.com';
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' }) as unknown as typeof fetch;

    const { registerAsset } = await import('@/services/locker/assetRegistry');
    const { approveSharePack, sendSharePack, previewSharePack } = await import('@/services/locker/sharePack');
    const { deck, pack } = await setupAssetsAndPack();

    await approveSharePack(pack.id, 'persona-a');
    await sendSharePack(pack.id, 'persona-a');
    const beforeUpdate = await previewSharePack(pack.id, 'persona-a');
    if (!beforeUpdate.ok) throw new Error('preview failed');
    const pinnedBefore = beforeUpdate.value.items.find((i) => i.assetId === deck.id)?.pinnedVersionAssetId;

    // A new version supersedes the deck AFTER the pack was already sent.
    await registerAsset({
      ownerPersonaId: 'persona-a',
      title: 'Investor Deck',
      assetClass: 'deck',
      lifecycleStatus: 'current',
      newVersionOf: { versionFamilyId: deck.versionFamilyId, supersedesAssetId: deck.id },
    });

    const afterUpdate = await previewSharePack(pack.id, 'persona-a');
    if (!afterUpdate.ok) throw new Error('preview failed');
    const pinnedAfter = afterUpdate.value.items.find((i) => i.assetId === deck.id)?.pinnedVersionAssetId;
    expect(pinnedAfter).toBe(pinnedBefore);
  });

  it('refuses to approve-and-send a restricted asset that is not marked approved-to-share (acceptance #28)', async () => {
    const { registerAsset, addRendition } = await import('@/services/locker/assetRegistry');
    const { composeSharePack, approveSharePack } = await import('@/services/locker/sharePack');

    const restricted = await registerAsset({
      ownerPersonaId: 'persona-a',
      title: 'Confidential Cap Table',
      assetClass: 'dataset',
      lifecycleStatus: 'current',
      sensitivity: 'restricted',
      sharingStatus: 'private',
    });
    if (!restricted.ok) throw new Error('setup failed');
    await addRendition({ assetId: restricted.value.id, callerPersonaId: 'persona-a', renditionKind: 'source', storageProvider: 'supabase', storageUri: 'cap.xlsx', isPrimary: true });

    const pack = await composeSharePack({
      ownerPersonaId: 'persona-a',
      title: 'Do not send',
      recipientRefs: ['jane@example.com'],
      items: [{ assetId: restricted.value.id }],
    });
    if (!pack.ok) throw new Error('compose failed');

    const approved = await approveSharePack(pack.value.id, 'persona-a');
    expect(approved.ok).toBe(false);
    if (approved.ok) return;
    expect(approved.code).toBe('authority_required');
  });

  it('a governed share link resolves only once the pack has been sent, and stops working once revoked (spec §15.3)', async () => {
    process.env.MAILJET_API_KEY = 'test-key';
    process.env.MAILJET_SECRET_KEY = 'test-secret';
    process.env.MAILJET_FROM_EMAIL = 'noreply@example.com';
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' }) as unknown as typeof fetch;

    const { approveSharePack, sendSharePack, revokeSharePack, previewSharePack, resolveShareLink } = await import('@/services/locker/sharePack');
    const { pack } = await setupAssetsAndPack();

    const beforePreview = await previewSharePack(pack.id, 'persona-a');
    if (!beforePreview.ok) throw new Error('preview failed');
    const token = beforePreview.value.items[0]!.accessToken;

    const tooEarly = await resolveShareLink(token);
    expect(tooEarly.ok).toBe(false);

    await approveSharePack(pack.id, 'persona-a');
    await sendSharePack(pack.id, 'persona-a');

    const resolved = await resolveShareLink(token);
    expect(resolved.ok).toBe(true);

    await revokeSharePack(pack.id, 'persona-a');
    const afterRevoke = await resolveShareLink(token);
    expect(afterRevoke.ok).toBe(false);
    if (afterRevoke.ok) return;
    expect(afterRevoke.code).toBe('revoked');
  });
});
