import { supabase } from '../db.js';
import type {
  BrowserArtifactRecord,
  BrowserHistoryEventRecord,
  BrowserReceiptRecord,
  BrowserSaveRecord,
  BrowserSessionRecord,
  BrowserSurfaceStateRecord,
} from './types.js';

export class BrowserEstateService {
  async persistSession(session: BrowserSessionRecord): Promise<void> {
    try {
      await supabase.from('browser_sessions').upsert({
        id: session.sessionId,
        user_id: session.userId || session.personaId || session.tenantId || session.sessionId,
        persona_id: session.personaId || null,
        aigent_id: session.activeAgentLabel,
        provider: session.provider,
        provider_session_id: session.providerSessionId,
        execution_mode: session.executionMode,
        trust_mode: session.trustMode,
        privacy_mode: session.privacyMode,
        status: session.status,
        current_url: session.currentUrl,
        current_title: session.currentTitle,
        current_domain: session.currentDomain,
        started_at: session.createdAt,
        updated_at: session.updatedAt,
        ended_at: session.endedAt || null,
      });
    } catch (error) {
      console.warn('[browser-estate] persistSession failed', error);
    }
  }

  async persistSurfaceState(state: BrowserSurfaceStateRecord): Promise<void> {
    try {
      await supabase.from('browser_surface_state').upsert({
        session_id: state.sessionId,
        mounted: state.mounted,
        mount_mode: state.mountMode,
        shell_surface_state: state.shellSurfaceState,
        focused: state.focused,
        takeover_active: state.takeoverActive,
        visible: state.visible,
        bounds: state.bounds,
        last_mounted_at: state.lastMountedAt || null,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('[browser-estate] persistSurfaceState failed', error);
    }
  }

  async appendHistory(event: BrowserHistoryEventRecord): Promise<void> {
    try {
      await supabase.from('browser_history_events').insert({
        id: event.id,
        session_id: event.sessionId,
        occurred_at: event.occurredAt,
        action_type: event.actionType,
        actor_type: event.actorType,
        actor_id: event.actorId || null,
        url: event.url || null,
        title: event.title || null,
        domain: event.domain || null,
        intent: event.intent || null,
        step_label: event.stepLabel || null,
        details: event.details,
        receipt_ref: event.receiptRef || null,
      });
    } catch (error) {
      console.warn('[browser-estate] appendHistory failed', error);
    }
  }

  async appendArtifact(artifact: BrowserArtifactRecord): Promise<void> {
    try {
      await supabase.from('browser_artifacts').insert({
        id: artifact.id,
        session_id: artifact.sessionId,
        user_id: artifact.userId,
        artifact_type: artifact.artifactType,
        source_url: artifact.sourceUrl || null,
        source_title: artifact.sourceTitle || null,
        mime_type: artifact.mimeType || null,
        storage_path: artifact.storagePath || null,
        metadata: artifact.metadata,
        receipt_ref: artifact.receiptRef || null,
        created_at: artifact.createdAt,
      });
    } catch (error) {
      console.warn('[browser-estate] appendArtifact failed', error);
    }
  }

  async appendReceipt(receipt: BrowserReceiptRecord): Promise<void> {
    try {
      await supabase.from('browser_receipts').insert({
        id: receipt.id,
        session_id: receipt.sessionId,
        receipt_type: receipt.receiptType,
        receipt_hash: receipt.receiptHash,
        receipt_uri: receipt.receiptUri || null,
        payload: receipt.payload,
        created_at: receipt.createdAt,
      });
    } catch (error) {
      console.warn('[browser-estate] appendReceipt failed', error);
    }
  }

  async appendSave(save: BrowserSaveRecord): Promise<void> {
    try {
      await supabase.from('browser_saves').insert({
        id: save.id,
        session_id: save.sessionId,
        artifact_id: save.artifactId || null,
        history_event_id: save.historyEventId || null,
        destination_type: save.destinationType,
        destination_id: save.destinationId || null,
        saved_by: save.savedBy || null,
        metadata: save.metadata,
        receipt_ref: save.receiptRef || null,
        created_at: save.createdAt,
      });
    } catch (error) {
      console.warn('[browser-estate] appendSave failed', error);
    }
  }

  async loadSession(sessionId: string): Promise<BrowserSessionRecord | null> {
    try {
      const { data, error } = await supabase.from('browser_sessions').select('*').eq('id', sessionId).maybeSingle();
      if (error || !data) return null;
      return {
        sessionId: data.id,
        provider: data.provider,
        providerSessionId: data.provider_session_id,
        executionMode: data.execution_mode,
        trustMode: data.trust_mode,
        privacyMode: data.privacy_mode,
        status: data.status,
        currentUrl: data.current_url,
        currentTitle: data.current_title,
        currentDomain: data.current_domain,
        createdAt: data.started_at,
        updatedAt: data.updated_at,
        endedAt: data.ended_at,
        tenantId: data.user_id || undefined,
        personaId: data.persona_id || undefined,
        userId: data.user_id || undefined,
        activeAgentLabel: data.aigent_id || 'metaMe Aigent',
      };
    } catch (error) {
      console.warn('[browser-estate] loadSession failed', error);
      return null;
    }
  }

  async loadSurfaceState(sessionId: string): Promise<BrowserSurfaceStateRecord | null> {
    try {
      const { data, error } = await supabase
        .from('browser_surface_state')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        sessionId: data.session_id,
        mounted: Boolean(data.mounted),
        mountMode: data.mount_mode,
        shellSurfaceState: data.shell_surface_state,
        focused: Boolean(data.focused),
        takeoverActive: Boolean(data.takeover_active),
        visible: Boolean(data.visible),
        bounds: (data.bounds || {}) as BrowserSurfaceStateRecord['bounds'],
        lastMountedAt: data.last_mounted_at,
      };
    } catch (error) {
      console.warn('[browser-estate] loadSurfaceState failed', error);
      return null;
    }
  }

  async loadHistory(sessionId: string): Promise<BrowserHistoryEventRecord[]> {
    try {
      const { data, error } = await supabase
        .from('browser_history_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('occurred_at', { ascending: false });
      if (error || !data) return [];
      return data.map((event) => ({
        id: event.id,
        sessionId: event.session_id,
        actionType: event.action_type,
        actorType: event.actor_type,
        actorId: event.actor_id,
        url: event.url,
        title: event.title,
        domain: event.domain,
        intent: event.intent,
        stepLabel: event.step_label,
        details: (event.details || {}) as Record<string, unknown>,
        receiptRef: event.receipt_ref,
        occurredAt: event.occurred_at,
      }));
    } catch (error) {
      console.warn('[browser-estate] loadHistory failed', error);
      return [];
    }
  }

  async loadArtifacts(sessionId: string): Promise<BrowserArtifactRecord[]> {
    try {
      const { data, error } = await supabase
        .from('browser_artifacts')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      return data.map((artifact) => ({
        id: artifact.id,
        sessionId: artifact.session_id,
        userId: artifact.user_id,
        artifactType: artifact.artifact_type,
        sourceUrl: artifact.source_url,
        sourceTitle: artifact.source_title,
        mimeType: artifact.mime_type,
        storagePath: artifact.storage_path,
        metadata: (artifact.metadata || {}) as Record<string, unknown>,
        receiptRef: artifact.receipt_ref,
        createdAt: artifact.created_at,
      }));
    } catch (error) {
      console.warn('[browser-estate] loadArtifacts failed', error);
      return [];
    }
  }

  async loadReceipts(sessionId: string): Promise<BrowserReceiptRecord[]> {
    try {
      const { data, error } = await supabase
        .from('browser_receipts')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      return data.map((receipt) => ({
        id: receipt.id,
        sessionId: receipt.session_id,
        receiptType: receipt.receipt_type,
        receiptHash: receipt.receipt_hash,
        receiptUri: receipt.receipt_uri,
        payload: (receipt.payload || {}) as Record<string, unknown>,
        createdAt: receipt.created_at,
      }));
    } catch (error) {
      console.warn('[browser-estate] loadReceipts failed', error);
      return [];
    }
  }

  async loadSaves(sessionId: string): Promise<BrowserSaveRecord[]> {
    try {
      const { data, error } = await supabase
        .from('browser_saves')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      return data.map((save) => ({
        id: save.id,
        sessionId: save.session_id,
        artifactId: save.artifact_id,
        historyEventId: save.history_event_id,
        destinationType: save.destination_type,
        destinationId: save.destination_id,
        savedBy: save.saved_by,
        metadata: (save.metadata || {}) as Record<string, unknown>,
        receiptRef: save.receipt_ref,
        createdAt: save.created_at,
      }));
    } catch (error) {
      console.warn('[browser-estate] loadSaves failed', error);
      return [];
    }
  }
}

export const browserEstateService = new BrowserEstateService();
