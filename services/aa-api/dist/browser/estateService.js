import { supabase } from '../db.js';
export class BrowserEstateService {
    async persistSession(session) {
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
        }
        catch (error) {
            console.warn('[browser-estate] persistSession failed', error);
        }
    }
    async persistSurfaceState(state) {
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
        }
        catch (error) {
            console.warn('[browser-estate] persistSurfaceState failed', error);
        }
    }
    async appendHistory(event) {
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
        }
        catch (error) {
            console.warn('[browser-estate] appendHistory failed', error);
        }
    }
    async appendArtifact(artifact) {
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
        }
        catch (error) {
            console.warn('[browser-estate] appendArtifact failed', error);
        }
    }
    async appendReceipt(receipt) {
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
        }
        catch (error) {
            console.warn('[browser-estate] appendReceipt failed', error);
        }
    }
    async appendSave(save) {
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
        }
        catch (error) {
            console.warn('[browser-estate] appendSave failed', error);
        }
    }
}
export const browserEstateService = new BrowserEstateService();
