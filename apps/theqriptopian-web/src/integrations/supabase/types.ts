export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_keys: {
        Row: {
          agent_id: string
          agent_name: string
          btc_address: string | null
          btc_private_key_encrypted: string | null
          created_at: string | null
          evm_address: string | null
          evm_private_key_encrypted: string | null
          id: string
          key_version: number | null
          last_used_at: string | null
          persona_id: string | null
          solana_address: string | null
          solana_private_key_encrypted: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          agent_name: string
          btc_address?: string | null
          btc_private_key_encrypted?: string | null
          created_at?: string | null
          evm_address?: string | null
          evm_private_key_encrypted?: string | null
          id?: string
          key_version?: number | null
          last_used_at?: string | null
          persona_id?: string | null
          solana_address?: string | null
          solana_private_key_encrypted?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          agent_name?: string
          btc_address?: string | null
          btc_private_key_encrypted?: string | null
          created_at?: string | null
          evm_address?: string | null
          evm_private_key_encrypted?: string | null
          id?: string
          key_version?: number | null
          last_used_at?: string | null
          persona_id?: string | null
          solana_address?: string | null
          solana_private_key_encrypted?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_keys_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_keys_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_with_fio_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_keys_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_with_reputation"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_policies: {
        Row: {
          asset_id: string
          created_at: string | null
          id: string
          pay_to_did: string
          price_amount: number | null
          price_asset: string | null
          rights: string[]
          tokenqube_template: string | null
          visibility: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          id?: string
          pay_to_did: string
          price_amount?: number | null
          price_asset?: string | null
          rights?: string[]
          tokenqube_template?: string | null
          visibility?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          id?: string
          pay_to_did?: string
          price_amount?: number | null
          price_asset?: string | null
          rights?: string[]
          tokenqube_template?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_policies_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "content_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          closing_balance: number | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          parsed_at: string
          period_end: string | null
          period_start: string | null
          user_id: string
        }
        Insert: {
          closing_balance?: number | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          parsed_at?: string
          period_end?: string | null
          period_start?: string | null
          user_id: string
        }
        Update: {
          closing_balance?: number | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          parsed_at?: string
          period_end?: string | null
          period_start?: string | null
          user_id?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          amount_qcent: number
          claimant_did: string
          created_at: string | null
          id: string
          iqube_id: string
          redeem_to: string | null
          rights: string[] | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount_qcent: number
          claimant_did: string
          created_at?: string | null
          id?: string
          iqube_id: string
          redeem_to?: string | null
          rights?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_qcent?: number
          claimant_did?: string
          created_at?: string | null
          id?: string
          iqube_id?: string
          redeem_to?: string | null
          rights?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cohort_membership: {
        Row: {
          cohort_id: string
          commitment: string
          created_at: string | null
          epoch: number
          risk_tier: number
        }
        Insert: {
          cohort_id: string
          commitment: string
          created_at?: string | null
          epoch: number
          risk_tier: number
        }
        Update: {
          cohort_id?: string
          commitment?: string
          created_at?: string | null
          epoch?: number
          risk_tier?: number
        }
        Relationships: []
      }
      content: {
        Row: {
          author_id: string | null
          author_type: string | null
          content: Json
          created_at: string | null
          domain: string
          event_data: Json | null
          excerpt: string | null
          format: string
          id: string
          logos_sidebar: Json | null
          market_data: Json | null
          published_at: string | null
          related_content: string[] | null
          slug: string | null
          status: string | null
          tags: string[] | null
          thumbnail: string | null
          title: string
          type: string
          updated_at: string | null
          verification_did: string | null
          verification_proof: Json | null
        }
        Insert: {
          author_id?: string | null
          author_type?: string | null
          content?: Json
          created_at?: string | null
          domain: string
          event_data?: Json | null
          excerpt?: string | null
          format: string
          id?: string
          logos_sidebar?: Json | null
          market_data?: Json | null
          published_at?: string | null
          related_content?: string[] | null
          slug?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail?: string | null
          title: string
          type: string
          updated_at?: string | null
          verification_did?: string | null
          verification_proof?: Json | null
        }
        Update: {
          author_id?: string | null
          author_type?: string | null
          content?: Json
          created_at?: string | null
          domain?: string
          event_data?: Json | null
          excerpt?: string | null
          format?: string
          id?: string
          logos_sidebar?: Json | null
          market_data?: Json | null
          published_at?: string | null
          related_content?: string[] | null
          slug?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          verification_did?: string | null
          verification_proof?: Json | null
        }
        Relationships: []
      }
      content_assets: {
        Row: {
          bytes: number | null
          created_at: string | null
          description: string | null
          id: string
          media_kind: string | null
          owner_did: string
          registry_ref: string | null
          sha256: string | null
          status: string | null
          storage_uri: string
          tags: string[] | null
          tenant_id: string
          title: string | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          media_kind?: string | null
          owner_did: string
          registry_ref?: string | null
          sha256?: string | null
          status?: string | null
          storage_uri: string
          tags?: string[] | null
          tenant_id: string
          title?: string | null
        }
        Update: {
          bytes?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          media_kind?: string | null
          owner_did?: string
          registry_ref?: string | null
          sha256?: string | null
          status?: string | null
          storage_uri?: string
          tags?: string[] | null
          tenant_id?: string
          title?: string | null
        }
        Relationships: []
      }
      custody_events: {
        Row: {
          created_at: string | null
          from_did: string
          id: string
          iqube_id: string
          meta: Json | null
          rights: string[] | null
          to_did: string
        }
        Insert: {
          created_at?: string | null
          from_did: string
          id?: string
          iqube_id: string
          meta?: Json | null
          rights?: string[] | null
          to_did: string
        }
        Update: {
          created_at?: string | null
          from_did?: string
          id?: string
          iqube_id?: string
          meta?: Json | null
          rights?: string[] | null
          to_did?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          blak_uri: string | null
          created_at: string
          hashes: Json | null
          id: string
          message_id: string | null
          meta_cid: string | null
          pod_proof: Json | null
          status: string
        }
        Insert: {
          blak_uri?: string | null
          created_at?: string
          hashes?: Json | null
          id?: string
          message_id?: string | null
          meta_cid?: string | null
          pod_proof?: Json | null
          status?: string
        }
        Update: {
          blak_uri?: string | null
          created_at?: string
          hashes?: Json | null
          id?: string
          message_id?: string | null
          meta_cid?: string | null
          pod_proof?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "x402_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      did_binding: {
        Row: {
          alias_commitment: string
          cohort_id: string | null
          created_at: string | null
          escrow_expiry: string | null
          id: string
          persona_id: string | null
          state_type: string | null
        }
        Insert: {
          alias_commitment: string
          cohort_id?: string | null
          created_at?: string | null
          escrow_expiry?: string | null
          id?: string
          persona_id?: string | null
          state_type?: string | null
        }
        Update: {
          alias_commitment?: string
          cohort_id?: string | null
          created_at?: string | null
          escrow_expiry?: string | null
          id?: string
          persona_id?: string | null
          state_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "did_binding_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "did_binding_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_with_fio_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "did_binding_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_with_reputation"
            referencedColumns: ["id"]
          },
        ]
      }
      did_identities: {
        Row: {
          agent_handle: string | null
          created_at: string | null
          did: string
          id: string
          kybe_did: string | null
        }
        Insert: {
          agent_handle?: string | null
          created_at?: string | null
          did: string
          id?: string
          kybe_did?: string | null
        }
        Update: {
          agent_handle?: string | null
          created_at?: string | null
          did?: string
          id?: string
          kybe_did?: string | null
        }
        Relationships: []
      }
      dvn_attestations: {
        Row: {
          created_at: string | null
          dvn_root: string
          id: string
          message_id: string
          proof: Json | null
        }
        Insert: {
          created_at?: string | null
          dvn_root: string
          id?: string
          message_id: string
          proof?: Json | null
        }
        Update: {
          created_at?: string | null
          dvn_root?: string
          id?: string
          message_id?: string
          proof?: Json | null
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          asset_id: string
          created_at: string | null
          expires_at: string | null
          holder_did: string
          id: string
          rights: string[]
          tokenqube_id: string | null
          x402_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          expires_at?: string | null
          holder_did: string
          id?: string
          rights: string[]
          tokenqube_id?: string | null
          x402_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          expires_at?: string | null
          holder_did?: string
          id?: string
          rights?: string[]
          tokenqube_id?: string | null
          x402_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "content_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_x402_id_fkey"
            columns: ["x402_id"]
            isOneToOne: false
            referencedRelation: "x402_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      executions: {
        Row: {
          avg_price: number
          capture_bps: number | null
          chain: string
          execution_venue: string | null
          id: string
          intent_id: string | null
          metadata: Json | null
          qty_filled: number
          side: string
          timestamp: string
          user_id: string
        }
        Insert: {
          avg_price: number
          capture_bps?: number | null
          chain: string
          execution_venue?: string | null
          id?: string
          intent_id?: string | null
          metadata?: Json | null
          qty_filled: number
          side: string
          timestamp?: string
          user_id: string
        }
        Update: {
          avg_price?: number
          capture_bps?: number | null
          chain?: string
          execution_venue?: string | null
          id?: string
          intent_id?: string | null
          metadata?: Json | null
          qty_filled?: number
          side?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executions_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "trading_intents"
            referencedColumns: ["intent_id"]
          },
        ]
      }
      financial_aggregates: {
        Row: {
          avg_daily_surplus: number | null
          cash_buffer_days: number | null
          closing_balance: number | null
          computed_at: string
          confidence_score: number | null
          created_at: string
          id: string
          surplus_volatility: number | null
          top_categories: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_daily_surplus?: number | null
          cash_buffer_days?: number | null
          closing_balance?: number | null
          computed_at?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          surplus_volatility?: number | null
          top_categories?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_daily_surplus?: number | null
          cash_buffer_days?: number | null
          closing_balance?: number | null
          computed_at?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          surplus_volatility?: number | null
          top_categories?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fio_cache: {
        Row: {
          expires_at: string | null
          handle: string
          owner_pubkey: string | null
          raw_response: Json | null
        }
        Insert: {
          expires_at?: string | null
          handle: string
          owner_pubkey?: string | null
          raw_response?: Json | null
        }
        Update: {
          expires_at?: string | null
          handle?: string
          owner_pubkey?: string | null
          raw_response?: Json | null
        }
        Relationships: []
      }
      hcp_profile: {
        Row: {
          persona_id: string
          preference_ptr: string | null
          revocation: Json | null
          scopes: Json | null
          updated_at: string | null
        }
        Insert: {
          persona_id: string
          preference_ptr?: string | null
          revocation?: Json | null
          scopes?: Json | null
          updated_at?: string | null
        }
        Update: {
          persona_id?: string
          preference_ptr?: string | null
          revocation?: Json | null
          scopes?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hcp_profile_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: true
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcp_profile_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: true
            referencedRelation: "persona_with_fio_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcp_profile_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: true
            referencedRelation: "persona_with_reputation"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_aliases: {
        Row: {
          alias_type: string
          alias_value: string
          entity_did: string
          expires_at: string | null
          id: string
          last_verified_at: string | null
          proof_ref: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          alias_type: string
          alias_value: string
          entity_did: string
          expires_at?: string | null
          id?: string
          last_verified_at?: string | null
          proof_ref?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          alias_type?: string
          alias_value?: string
          entity_did?: string
          expires_at?: string | null
          id?: string
          last_verified_at?: string | null
          proof_ref?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      iqube_capabilities: {
        Row: {
          acl_delta_sig: string | null
          audience_alias: Json | null
          audience_did: string
          created_at: string
          id: string
          iqube_ref: string
          scope: Json
          state: string
          ttl: string | null
        }
        Insert: {
          acl_delta_sig?: string | null
          audience_alias?: Json | null
          audience_did: string
          created_at?: string
          id?: string
          iqube_ref: string
          scope: Json
          state?: string
          ttl?: string | null
        }
        Update: {
          acl_delta_sig?: string | null
          audience_alias?: Json | null
          audience_did?: string
          created_at?: string
          id?: string
          iqube_ref?: string
          scope?: Json
          state?: string
          ttl?: string | null
        }
        Relationships: []
      }
      iqube_events: {
        Row: {
          created_at: string
          id: string
          identity_snapshot: Json | null
          iqube_ref: string
          state_proof: Json | null
          type: string
          x402_message_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          identity_snapshot?: Json | null
          iqube_ref: string
          state_proof?: Json | null
          type: string
          x402_message_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          identity_snapshot?: Json | null
          iqube_ref?: string
          state_proof?: Json | null
          type?: string
          x402_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iqube_events_x402_message_id_fkey"
            columns: ["x402_message_id"]
            isOneToOne: false
            referencedRelation: "x402_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      iqube_templates: {
        Row: {
          accuracy_score: number
          blakqube_labels: string[] | null
          business_model: string | null
          created_at: string
          description: string
          id: string
          instance_type: string | null
          iqube_type: string | null
          metaqube_extras: Json | null
          name: string
          owner: string | null
          parent_template_id: string | null
          price: number | null
          provenance: number | null
          public_read: boolean
          risk_score: number
          sensitivity_score: number | null
          updated_at: string
          user_id: string | null
          verifiability_score: number
          version: number | null
          visibility: string | null
        }
        Insert: {
          accuracy_score: number
          blakqube_labels?: string[] | null
          business_model?: string | null
          created_at?: string
          description?: string
          id?: string
          instance_type?: string | null
          iqube_type?: string | null
          metaqube_extras?: Json | null
          name: string
          owner?: string | null
          parent_template_id?: string | null
          price?: number | null
          provenance?: number | null
          public_read?: boolean
          risk_score: number
          sensitivity_score?: number | null
          updated_at?: string
          user_id?: string | null
          verifiability_score: number
          version?: number | null
          visibility?: string | null
        }
        Update: {
          accuracy_score?: number
          blakqube_labels?: string[] | null
          business_model?: string | null
          created_at?: string
          description?: string
          id?: string
          instance_type?: string | null
          iqube_type?: string | null
          metaqube_extras?: Json | null
          name?: string
          owner?: string | null
          parent_template_id?: string | null
          price?: number | null
          provenance?: number | null
          public_read?: boolean
          risk_score?: number
          sensitivity_score?: number | null
          updated_at?: string
          user_id?: string | null
          verifiability_score?: number
          version?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iqube_templates_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "iqube_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          is_root: boolean | null
          metadata: Json | null
          source: string | null
          tags: string[] | null
          tenant_id: string | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_root?: boolean | null
          metadata?: Json | null
          source?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_root?: boolean | null
          metadata?: Json | null
          source?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      kybe_identity: {
        Row: {
          encrypted_soul_key: string | null
          id: string
          issued_at: string | null
          kybe_did: string
          state: string | null
          updated_at: string | null
        }
        Insert: {
          encrypted_soul_key?: string | null
          id?: string
          issued_at?: string | null
          kybe_did: string
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          encrypted_soul_key?: string | null
          id?: string
          issued_at?: string | null
          kybe_did?: string
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mailbox: {
        Row: {
          created_at: string | null
          last_pull: string | null
          mailbox_id: string
          relay_hint: string | null
        }
        Insert: {
          created_at?: string | null
          last_pull?: string | null
          mailbox_id: string
          relay_hint?: string | null
        }
        Update: {
          created_at?: string | null
          last_pull?: string | null
          mailbox_id?: string
          relay_hint?: string | null
        }
        Relationships: []
      }
      persona: {
        Row: {
          app_origin: string | null
          created_at: string | null
          default_identity_state: string
          fio_handle: string | null
          fio_handle_expiration: string | null
          fio_handle_verified: boolean | null
          fio_last_verified_at: string | null
          fio_public_key: string | null
          fio_registered_at: string | null
          fio_registration_status: string | null
          fio_tx_id: string | null
          id: string
          root_id: string | null
          world_id_status: string | null
        }
        Insert: {
          app_origin?: string | null
          created_at?: string | null
          default_identity_state?: string
          fio_handle?: string | null
          fio_handle_expiration?: string | null
          fio_handle_verified?: boolean | null
          fio_last_verified_at?: string | null
          fio_public_key?: string | null
          fio_registered_at?: string | null
          fio_registration_status?: string | null
          fio_tx_id?: string | null
          id?: string
          root_id?: string | null
          world_id_status?: string | null
        }
        Update: {
          app_origin?: string | null
          created_at?: string | null
          default_identity_state?: string
          fio_handle?: string | null
          fio_handle_expiration?: string | null
          fio_handle_verified?: boolean | null
          fio_last_verified_at?: string | null
          fio_public_key?: string | null
          fio_registered_at?: string | null
          fio_registration_status?: string | null
          fio_tx_id?: string | null
          id?: string
          root_id?: string | null
          world_id_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persona_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "root_identity"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_agent_binding: {
        Row: {
          agent_id: string
          created_at: string | null
          is_primary: boolean | null
          persona_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          is_primary?: boolean | null
          persona_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          is_primary?: boolean | null
          persona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_agent_binding_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_agent_binding_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_with_fio_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_agent_binding_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_with_reputation"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          persona_id: string | null
          trading_preferences: Json | null
          updated_at: string | null
          wallet_addresses: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          persona_id?: string | null
          trading_preferences?: Json | null
          updated_at?: string | null
          wallet_addresses?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          persona_id?: string | null
          trading_preferences?: Json | null
          updated_at?: string | null
          wallet_addresses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_with_fio_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_with_reputation"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          ask: number | null
          bid: number | null
          extra: Json | null
          id: string
          mid: number | null
          source: string | null
          symbol: string
          tenant_id: string
          ts: string
        }
        Insert: {
          ask?: number | null
          bid?: number | null
          extra?: Json | null
          id?: string
          mid?: number | null
          source?: string | null
          symbol: string
          tenant_id: string
          ts?: string
        }
        Update: {
          ask?: number | null
          bid?: number | null
          extra?: Json | null
          id?: string
          mid?: number | null
          source?: string | null
          symbol?: string
          tenant_id?: string
          ts?: string
        }
        Relationships: []
      }
      recommendation_history: {
        Row: {
          confidence_score: number | null
          created_at: string
          daily_loss_limit_bps: number | null
          id: string
          inventory_max: number | null
          inventory_min: number | null
          max_notional_usd: number | null
          min_edge_bps: number | null
          reasoning: string | null
          recommendation_id: string | null
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          daily_loss_limit_bps?: number | null
          id?: string
          inventory_max?: number | null
          inventory_min?: number | null
          max_notional_usd?: number | null
          min_edge_bps?: number | null
          reasoning?: string | null
          recommendation_id?: string | null
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          daily_loss_limit_bps?: number | null
          id?: string
          inventory_max?: number | null
          inventory_min?: number | null
          max_notional_usd?: number | null
          min_edge_bps?: number | null
          reasoning?: string | null
          recommendation_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_history_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "trading_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_bucket: {
        Row: {
          bucket_level: number | null
          created_at: string | null
          evidence_count: number | null
          id: string
          last_synced_at: string | null
          partition_id: string
          persona_id: string | null
          rqh_bucket_id: string | null
          score: number | null
          skill_category: string
          updated_at: string | null
        }
        Insert: {
          bucket_level?: number | null
          created_at?: string | null
          evidence_count?: number | null
          id?: string
          last_synced_at?: string | null
          partition_id: string
          persona_id?: string | null
          rqh_bucket_id?: string | null
          score?: number | null
          skill_category: string
          updated_at?: string | null
        }
        Update: {
          bucket_level?: number | null
          created_at?: string | null
          evidence_count?: number | null
          id?: string
          last_synced_at?: string | null
          partition_id?: string
          persona_id?: string | null
          rqh_bucket_id?: string | null
          score?: number | null
          skill_category?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reputation_bucket_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_bucket_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_with_fio_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_bucket_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona_with_reputation"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_evidence: {
        Row: {
          created_at: string | null
          evidence_data: Json | null
          evidence_type: string
          id: string
          reputation_bucket_id: string | null
          rqh_evidence_id: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          evidence_data?: Json | null
          evidence_type: string
          id?: string
          reputation_bucket_id?: string | null
          rqh_evidence_id?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          evidence_data?: Json | null
          evidence_type?: string
          id?: string
          reputation_bucket_id?: string | null
          rqh_evidence_id?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reputation_evidence_reputation_bucket_id_fkey"
            columns: ["reputation_bucket_id"]
            isOneToOne: false
            referencedRelation: "reputation_bucket"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      root_identity: {
        Row: {
          created_at: string | null
          did_uri: string
          id: string
          kybe_hash: string | null
          kybe_id: string | null
          kyc_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          did_uri: string
          id?: string
          kybe_hash?: string | null
          kybe_id?: string | null
          kyc_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          did_uri?: string
          id?: string
          kybe_hash?: string | null
          kybe_id?: string | null
          kyc_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "root_identity_kybe_id_fkey"
            columns: ["kybe_id"]
            isOneToOne: false
            referencedRelation: "kybe_identity"
            referencedColumns: ["id"]
          },
        ]
      }
      root_prompts: {
        Row: {
          applicable_to: string[] | null
          created_at: string | null
          id: string
          is_active: boolean | null
          prompt_content: string
          prompt_name: string
          updated_at: string | null
          version: string
        }
        Insert: {
          applicable_to?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          prompt_content: string
          prompt_name: string
          updated_at?: string | null
          version: string
        }
        Update: {
          applicable_to?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          prompt_content?: string
          prompt_name?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string | null
          entries_synced: number | null
          error_message: string | null
          id: string
          status: string
          sync_type: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          entries_synced?: number | null
          error_message?: string | null
          id?: string
          status: string
          sync_type: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          entries_synced?: number | null
          error_message?: string | null
          id?: string
          status?: string
          sync_type?: string
          tenant_id?: string
        }
        Relationships: []
      }
      tenant_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: number
          is_active: boolean
          label: string | null
          tenant_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: number
          is_active?: boolean
          label?: string | null
          tenant_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: number
          is_active?: boolean
          label?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          agent_name: string | null
          created_at: string
          display_name: string | null
          id: string
          metadata: Json | null
          name: string
          parent_project: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          agent_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          metadata?: Json | null
          name: string
          parent_project?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          parent_project?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trading_intents: {
        Row: {
          amount_qc: number
          avg_price: number | null
          cancelled_at: string | null
          capture_bps: number | null
          chain: string
          created_at: string
          filled_at: string | null
          id: string
          intent_id: string
          limit_price: number | null
          max_slippage_bps: number
          metadata: Json | null
          min_edge_bps: number
          order_type: string
          qty_filled: number | null
          side: string
          status: string
          stop_loss: number | null
          take_profit: number | null
          time_in_force: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_qc: number
          avg_price?: number | null
          cancelled_at?: string | null
          capture_bps?: number | null
          chain: string
          created_at?: string
          filled_at?: string | null
          id?: string
          intent_id?: string
          limit_price?: number | null
          max_slippage_bps: number
          metadata?: Json | null
          min_edge_bps: number
          order_type?: string
          qty_filled?: number | null
          side: string
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          time_in_force?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_qc?: number
          avg_price?: number | null
          cancelled_at?: string | null
          capture_bps?: number | null
          chain?: string
          created_at?: string
          filled_at?: string | null
          id?: string
          intent_id?: string
          limit_price?: number | null
          max_slippage_bps?: number
          metadata?: Json | null
          min_edge_bps?: number
          order_type?: string
          qty_filled?: number | null
          side?: string
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          time_in_force?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_recommendations: {
        Row: {
          created_at: string
          daily_loss_limit_bps: number | null
          id: string
          inventory_max: number | null
          inventory_min: number | null
          max_notional_usd: number | null
          min_edge_bps: number | null
          reasoning: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_loss_limit_bps?: number | null
          id?: string
          inventory_max?: number | null
          inventory_min?: number | null
          max_notional_usd?: number | null
          min_edge_bps?: number | null
          reasoning?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_loss_limit_bps?: number | null
          id?: string
          inventory_max?: number | null
          inventory_min?: number | null
          max_notional_usd?: number | null
          min_edge_bps?: number | null
          reasoning?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_library: {
        Row: {
          added_at: string
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_library_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "iqube_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      x402_messages: {
        Row: {
          bridge_message_id: string | null
          created_at: string
          headers: Json
          id: string
          identity_proofs: Json | null
          intent: string
          payload: Json
          proofs: Json | null
          resolved_recipient_did: string | null
          resolved_sender_did: string | null
          state: string
          updated_at: string
        }
        Insert: {
          bridge_message_id?: string | null
          created_at?: string
          headers: Json
          id?: string
          identity_proofs?: Json | null
          intent: string
          payload: Json
          proofs?: Json | null
          resolved_recipient_did?: string | null
          resolved_sender_did?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          bridge_message_id?: string | null
          created_at?: string
          headers?: Json
          id?: string
          identity_proofs?: Json | null
          intent?: string
          payload?: Json
          proofs?: Json | null
          resolved_recipient_did?: string | null
          resolved_sender_did?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      x402_settlements: {
        Row: {
          amount: string
          asset: string
          created_at: string
          escrow_tx: string | null
          id: string
          message_id: string | null
          release_tx: string | null
          status: string
        }
        Insert: {
          amount: string
          asset: string
          created_at?: string
          escrow_tx?: string | null
          id?: string
          message_id?: string | null
          release_tx?: string | null
          status?: string
        }
        Update: {
          amount?: string
          asset?: string
          created_at?: string
          escrow_tx?: string | null
          id?: string
          message_id?: string | null
          release_tx?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "x402_settlements_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "x402_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      x402_transactions: {
        Row: {
          amount: number
          asset_id: string
          asset_symbol: string
          buyer_did: string
          created_at: string | null
          dest_chain: string | null
          facilitator_ref: string | null
          id: string
          request_id: string
          seller_did: string
          src_chain: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          asset_id: string
          asset_symbol: string
          buyer_did: string
          created_at?: string | null
          dest_chain?: string | null
          facilitator_ref?: string | null
          id?: string
          request_id: string
          seller_did: string
          src_chain?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          asset_id?: string
          asset_symbol?: string
          buyer_did?: string
          created_at?: string | null
          dest_chain?: string | null
          facilitator_ref?: string | null
          id?: string
          request_id?: string
          seller_did?: string
          src_chain?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "x402_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "content_assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      persona_with_fio_status: {
        Row: {
          app_origin: string | null
          created_at: string | null
          days_until_expiration: number | null
          default_identity_state: string | null
          fio_handle: string | null
          fio_handle_expiration: string | null
          fio_handle_verified: boolean | null
          fio_last_verified_at: string | null
          fio_public_key: string | null
          fio_registered_at: string | null
          fio_registration_status: string | null
          fio_status: string | null
          fio_tx_id: string | null
          id: string | null
          root_id: string | null
          world_id_status: string | null
        }
        Insert: {
          app_origin?: string | null
          created_at?: string | null
          days_until_expiration?: never
          default_identity_state?: string | null
          fio_handle?: string | null
          fio_handle_expiration?: string | null
          fio_handle_verified?: boolean | null
          fio_last_verified_at?: string | null
          fio_public_key?: string | null
          fio_registered_at?: string | null
          fio_registration_status?: string | null
          fio_status?: never
          fio_tx_id?: string | null
          id?: string | null
          root_id?: string | null
          world_id_status?: string | null
        }
        Update: {
          app_origin?: string | null
          created_at?: string | null
          days_until_expiration?: never
          default_identity_state?: string | null
          fio_handle?: string | null
          fio_handle_expiration?: string | null
          fio_handle_verified?: boolean | null
          fio_last_verified_at?: string | null
          fio_public_key?: string | null
          fio_registered_at?: string | null
          fio_registration_status?: string | null
          fio_status?: never
          fio_tx_id?: string | null
          id?: string | null
          root_id?: string | null
          world_id_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persona_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "root_identity"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_with_reputation: {
        Row: {
          app_origin: string | null
          created_at: string | null
          default_identity_state: string | null
          fio_days_until_expiration: number | null
          fio_handle: string | null
          fio_handle_expiration: string | null
          fio_handle_verified: boolean | null
          fio_last_verified_at: string | null
          fio_public_key: string | null
          fio_registered_at: string | null
          fio_registration_status: string | null
          fio_status: string | null
          fio_tx_id: string | null
          id: string | null
          reputation_bucket: number | null
          reputation_category: string | null
          reputation_evidence_count: number | null
          reputation_last_synced: string | null
          reputation_partition_id: string | null
          reputation_score: number | null
          root_id: string | null
          world_id_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persona_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "root_identity"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      days_until_fio_expiration: {
        Args: { expiration: string }
        Returns: number
      }
      get_agent_addresses: {
        Args: { p_agent_id: string }
        Returns: {
          agent_id: string
          btc_address: string
          evm_address: string
          solana_address: string
        }[]
      }
      is_fio_handle_expired: { Args: { expiration: string }; Returns: boolean }
      sync_reputation_from_rqh: {
        Args: {
          p_bucket_level: number
          p_evidence_count: number
          p_partition_id: string
          p_rqh_bucket_id?: string
          p_score: number
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
