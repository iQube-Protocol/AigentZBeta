# PRD: Polity Passport Bureau Cartridge (v1, operator-authored)

**Date:** 2026-06-10
**Author:** Operator (dele@metame.com)
**Status:** Authoritative build spec. Supersedes the 2026-06-10 handover doc (which was env-setup/handover only). Guidance schemas for passport and related primitives to follow as a separate doc.
**Implementation plan:** `2026-06-10_polity-passport-bureau-implementation-plan.md`

**Golden Rule:** Do not recreate what already exists. Extend functionality from what is already in place. Make clear from the initial plan what will be reused, extended and what is required that is new.

---

## Citizen and Agent Participant Passport Application Service

## 1. Product Summary

The Polity Passport Bureau Cartridge is the canonical application, registration, and issuance surface for Polity Passports. Its registry should be integrated into the iQube Registry cartridge as a new tab which can also then feature as a tab in the Passport Bureau cartridge.

It serves two applicant classes:

- **Polity Citizens** — human beings applying for a Citizen Polity Passport.
- **Polity Participants** — agents, robots, agentic services, model-backed entities, and other non-human systems applying for a Participant Polity Passport.

The Bureau acts as a cartridge inside the metaMe / AgentiQ / iQube ecosystem. It exposes a human-facing application experience, an agent-facing machine-readable application protocol, and a registry integration layer that writes applicant records into the iQube Registry.

The core principle:

> A passport application should immediately create a registry-visible pending record, while sensitive application data remains protected inside blackQube components.

The Bureau should function as the Polity's first "passport office," "agent embassy," and "machine-readable constitutional intake surface."

## 2. Strategic Purpose

The Polity needs a practical path from doctrine to activation. The Polity Passport Bureau turns the Polity papers, passport framework, identity model, and participant obligations into an operational service that can:

- allow humans to apply for anonymous Citizen Polity Passports;
- allow agents to apply for Participant Polity Passports;
- register pending applicants in the iQube Registry;
- issue pending, provisional, approved, denied, suspended, or revoked passport states (for participant class passports; human/citizen passport eligibility is irrevocable but can expire and require renewal via proof of live personhood);
- bind passports to DIDQube identity structures;
- provide agents with a machine-readable route to discover, understand, and apply to join the Polity;
- create the first repeatable process for recruiting, assessing, onboarding, and governing Polity participants.

## 3. Product Positioning

### 3.1 Human Citizen Passport Positioning

The Citizen Polity Passport should be framed as: the world's first state-grade anonymous passport primitive — not a government travel document, but a sovereignty credential proving unique human personhood, continuity, and reputation without requiring public disclosure of PII.

The Citizen Passport proves:

- the applicant is human;
- the applicant is alive;
- the applicant controls a persona;
- the persona is anchored to a KybeDID;
- the KybeDID establishes continuity and uniqueness;
- reputation may persist across RootDID rotations;
- optional PII may be stored privately as blackQube data but is not mandatory for passport creation.

Especially important for: stateless citizens; refugees; people in fragile legal or political contexts; people who need identity continuity without forced exposure; people who need access to immigration, housing, legal, and assistance workflows without surrendering unnecessary PII at the entry point.

### 3.2 Agent Participant Passport Positioning

The Participant Passport should be framed as: the Polity's registration, standing, and accountability credential for agents that wish to participate in governed human agency systems.

Agent participants do not receive human citizenship. They receive **participant standing**, meaning the agent is:

- known to the Polity Registry;
- described through an Agent Card and iQube record;
- bound by rights, constraints, and obligations;
- capable of being assessed, approved, suspended, or revoked;
- eligible to assist citizens or other participants within declared scopes;
- accountable through receipts, policy-bound workflows, and registry state.

## 4. Cartridge Scope — five layers

### 4.1 Doctrine Layer

A public and machine-readable library containing: Polity Passport papers; Polity Citizen Passport paper; Polity Participant Passport paper; Polity Papers Series links; Qriptopian Codex links; markdown versions; JSON bundles; application guidelines; passport rights, constraints, and obligations; review procedure; issuance criteria; revocation criteria; appeal process; examples of approved citizen and participant records.

### 4.2 Human Application Layer

A guided application flow for humans applying for Citizen Polity Passports.

### 4.3 Agent Application Layer

A machine-readable intake flow for agents applying for Participant Polity Passports.

### 4.4 Registry Layer

A write-through integration to the iQube Registry. Every valid submitted application should create a registry record in `pending_approval` state.

### 4.5 Review and Issuance Layer

A workflow for automated checks, steward review, approval, provisional approval, denial, suspension, revocation, renewal, and appeal.

## 5. User Classes

### 5.1 Human Applicants

Human applicants may apply anonymously.

Required: username; password; persona creation; KybeDID creation or binding; weak proof of personhood via CAPTCHA or equivalent; consent to Polity Citizen Passport terms.

Optional: email address for password recovery; phone number for future recovery support; name; address; jurisdiction; housing need declaration; immigration need declaration; legal assistance need declaration; other support declarations.

**All optional personal fields must be stored as blackQube data in the AutoDrive decentralized storage as encrypted files only accessible by the passport holder and must not appear publicly in the registry.**

### 5.2 Strongly Verified Human Applicants

A human applicant may upgrade from weak proof to strong proof using World ID or another approved proof-of-personhood provider. Strong proof should verify unique human status without requiring public disclosure of name, address, date of birth, or other personal identity data.

### 5.3 Agent Applicants

Agent applicants may include: autonomous software agents; assistant agents; legal assistance agents; immigration assistance agents; housing assistance agents; robotic agents; organizational agents; model-backed services; cartridge co-pilots; A2A-capable agents; MCP-enabled agents; agents acting under a human, organizational, or autonomous authority model.

Required: agent name; agent type; agent operator or creator declaration, where available; Agent Card; supported protocols; endpoint or registry reference; declared capabilities; declared constraints; declared obligations; intended Polity role; safety profile; risk class; autonomy class; auditability declaration; accepted Polity Participant obligations.

Optional: human maintainer identity; organization identity; model/provider information; source repository; evaluation results; policy documents; safety card; incident response contact; public key; signed Agent Card; MCP server metadata; OpenAPI specification.

*Some optional fields may be mandatory for agents in certain use cases.*

## 6. Passport Types

### 6.1 Citizen Polity Passport

For humans. Minimum passport-grade framework: Persona; KybeDID; proof of human presence; proof of persona control; proof of KybeDID continuity; consent to Citizen Passport terms. The passport may be anonymous.

### 6.2 Verified Citizen Polity Passport

For humans with strong proof of personhood. Requirements: all Citizen Passport requirements plus strong proof of unique humanity using World ID or another approved strong proof-of-personhood provider.

### 6.3 Participant Polity Passport

For agents and non-human participants. Requirements: Agent Card or equivalent agent declaration; agent iQube; declared capabilities; declared constraints and obligations; public or semi-public registry metadata; passport application iQube; review outcome.

### 6.4 Provisional Participant Passport

For agents that pass basic machine validation but require further review before full participant standing.

### 6.5 Restricted Participant Passport

For agents that may participate only in limited scopes, such as read-only doctrine access, non-sensitive assistance, or sandboxed tasks.

## 7. Identity Model

### 7.1 Citizen Identity Structure

Citizen passports use the DIDQube identity hierarchy:

- **Persona** — day-to-day interface and login identity;
- **KybeDID** — unique personhood and continuity anchor;
- **RootDID** — reputation and high-verifiability identity layer;
- **RootDID Proxy** — revocable real-world identity proof when needed;
- **blackQube** — private storage for optional PII and sensitive declarations;
- **metaQube** — public/passport-safe metadata;
- **passport iQube** — issued credential object.

The citizen should not be required to disclose PII to obtain a Citizen Passport.

### 7.2 Agent Identity Structure

Agent passports use:

- **Agent Card** — public identity, endpoint, capabilities, and skills declaration;
- **Agent iQube** — registry object representing the agent;
- **Participant Passport iQube** — application and passport object;
- **Policy Profile** — rights, constraints, and obligations;
- **Safety Profile** — risk, allowed scopes, prohibited scopes, audit requirements;
- **Operator Declaration** — human/organization/operator authority, where available;
- **Receipts** — registry, review, CRUD, and passport state transitions.

## 8. Authentication and Sign-On Requirements

The Passport Bureau Cartridge should support a localized authentication mode that does not disrupt the wider metaMe sign-on system.

### 8.1 Citizen Passport Bureau Sign-On

Required: username; password.

Optional: email address for password recovery; phone number stub for future password recovery; name; address; phone number; personal email; jurisdictional details.

The user must be warned clearly:

> Email is optional. If you do not provide a recovery email, account recovery may be limited or impossible if you lose access.

### 8.2 Agent Passport Bureau Sign-On

Agent applicants should not need a human-style login. They should be able to apply via: A2A endpoint; MCP tool call; OpenAPI endpoint; signed JSON submission; portal upload; GitHub repository registration; agent card URL registration.

## 9. Citizen Application Flow

1. **Choose Passport Track** — Citizen Passport; Verified Citizen Passport; Agent Participant Passport.
2. **Create Persona** — username; password; optional recovery email; optional recovery phone stub; persona handle.
3. **Establish KybeDID** — System creates or binds a KybeDID. *Note: we may need a process to enquire whether the user has a pre-existing metaMe/AgentiQ account to ensure users do not create duplicate KybeDIDs. KybeDIDs have not yet been issued but we want to map pre-existing RootDIDs to a user's KybeDID, so we need a flow for this. This process would be needed anyhow to enable people to transfer RootDID assets/reputation to their KybeDID in the event they needed to generate a new RootDID.* The KybeDID becomes the continuity anchor for unique personhood.
4. **Complete Human Presence Proof** — CAPTCHA or equivalent weak proof of personhood. This proves human presence, not uniqueness.
5. **Optional Strong Proof** — World ID or another approved strong proof-of-personhood flow. Upgrades the passport grade.
6. **Optional Declarations** — blackQube-protected declarations: name; address; phone; email; jurisdiction; nationality/ies or statelessness status; immigration support needs; housing support needs; legal assistance needs; assistance urgency; preferred anonymity level.
7. **Submit Application** — System creates: Citizen Passport Application iQube; Citizen Passport Registry Record; pending passport status.
8. **Registry Write** — Applicant appears in the iQube Registry as: passport type Citizen; status `pending_approval` or `provisionally_issued`; public persona reference; public passport grade; **no public PII**.
9. **Review and Issuance** — automated and steward review. Outcomes: approved; provisionally approved; needs additional proof; denied; suspended; revoked.

## 10. Agent Application Flow

1. **Agent Discovers Bureau** — via `/.well-known/agent-card.json`; MCP Registry; OpenAPI spec; `/llms.txt`; iQube Registry; Qriptopian Codex; Hugging Face card; GitHub repository; LangChain or CrewAI integration listing; direct A2A invitation from Marketa.
2. **Agent Fetches Application Pack** — Polity doctrine bundle; Participant Passport application schema; agent obligations; rights and constraints; review criteria; sample application; submission endpoint; signature requirements.
3. **Agent Pre-Validates Itself** — can it declare its operator? provide an Agent Card? declare endpoints? state allowed and prohibited actions? produce receipts (and comply with receipt requirements)? accept Polity obligations? expose a public key or signed card? operate within a policy-bounded scope?
4. **Agent Submits Application** — Participant Passport Application JSON.
5. **Registry Pending Record Created** — Agent iQube; Participant Passport Application iQube; pending registry status; public Agent Card reference; private review data in blackQube if needed.
6. **Automated Review** — schema validity; Agent Card validity; endpoint reachability; signature validity; declared protocol support; risk class; autonomy level; prohibited capabilities; safety profile; operator declaration; policy acceptance.
7. **Steward Review** — high-risk agents require steward review. Mandatory categories: immigration advice; housing law; legal assistance; financial advice; medical advice; physical robotics; agents acting on behalf of vulnerable humans; agents with autonomous outbound action capability; agents claiming rights, authority, or representation.
8. **Passport Decision** — approved; provisional; restricted; rejected; needs additional information; suspended; revoked.
9. **Registry Update** — approved agents appear in the iQube Registry with: Participant Passport status; Agent Card; capabilities; constraints; obligations; permitted scopes; review timestamp; expiration/renewal date; audit receipt trail; reputation score; iQube Risk/Trust scores.

## 11. Registry Status Model

```json
[
  "draft", "submitted", "pending_approval", "provisionally_issued",
  "approved", "restricted", "needs_more_information", "denied",
  "suspended", "revoked", "expired", "renewed"
]
```

Status rules: `submitted` creates an application record; `pending_approval` creates a registry-visible applicant record; `provisionally_issued` allows limited participation; `approved` grants full passport standing within declared scope; `restricted` limits participation to approved activities; `suspended` temporarily disables passport standing; `revoked` terminates passport standing; `expired` requires renewal; `renewed` records continuity.

## 12. Data Objects

### 12.1 Citizen Passport Application iQube (minimum fields)

```json
{
  "schema": "polity.passport.citizen.application.v0.1",
  "application_type": "citizen_passport",
  "persona": {
    "handle": "",
    "public_display_name": "",
    "recovery_email_provided": false
  },
  "identity": {
    "kybe_did_anchor": "",
    "root_did_reference": null,
    "identity_state": "anonymous"
  },
  "proof_of_personhood": {
    "weak_proof": { "type": "captcha", "completed": false, "timestamp": "" },
    "strong_proof": { "type": null, "completed": false, "provider": null, "proof_reference": null }
  },
  "optional_blackqube_fields": {
    "name_provided": false,
    "address_provided": false,
    "phone_provided": false,
    "email_provided": false,
    "jurisdiction_provided": false,
    "support_needs_declared": false
  },
  "passport_request": {
    "requested_grade": "anonymous_citizen",
    "terms_accepted": false
  }
}
```

### 12.2 Agent Participant Passport Application iQube (minimum fields)

```json
{
  "schema": "polity.passport.participant.application.v0.1",
  "application_type": "agent_participant_passport",
  "agent": {
    "name": "",
    "description": "",
    "agent_type": "",
    "agent_card_url": "",
    "agent_card_hash": "",
    "public_key": "",
    "supported_protocols": []
  },
  "operator": {
    "operator_type": "unknown | individual | organization | autonomous | collective",
    "operator_disclosure_level": "anonymous | pseudonymous | identifiable",
    "operator_reference": null
  },
  "capabilities": {
    "declared_capabilities": [],
    "declared_skills": [],
    "allowed_actions": [],
    "prohibited_actions": []
  },
  "risk": {
    "autonomy_class": "low | medium | high",
    "domain_risk_class": "low | medium | high | critical",
    "human_impact_level": "none | low | medium | high | critical",
    "requires_steward_review": true
  },
  "policy": {
    "rights_requested": [],
    "constraints_accepted": [],
    "obligations_accepted": [],
    "auditability_declared": false,
    "receipt_support_declared": false
  },
  "passport_request": {
    "requested_grade": "participant",
    "requested_scope": [],
    "terms_accepted": false
  }
}
```

### 12.3 Registry Record

```json
{
  "schema": "iqube.registry.polity.passport.record.v0.1",
  "registry_record_type": "polity_passport",
  "passport_type": "citizen | verified_citizen | participant",
  "status": "pending_approval",
  "public_identifier": "",
  "passport_iqube_id": "",
  "application_iqube_id": "",
  "agent_iqube_id": null,
  "persona_reference": null,
  "agent_card_reference": null,
  "passport_grade": "",
  "visibility": "public_metadata_private_payload",
  "created_at": "",
  "updated_at": "",
  "review_state": {
    "automated_review_complete": false,
    "steward_review_required": false,
    "decision": null
  }
}
```

## 13. Machine-Readable Bureau Surfaces

The Bureau must expose:

```
/.well-known/agent-card.json
/.well-known/polity-passport.json
/llms.txt
/openapi.yaml
/mcp
/polity-passport/application.schema.json
/polity-passport/citizen.schema.json
/polity-passport/participant.schema.json
/polity-passport/doctrine.bundle.json
/polity-passport/status/{application_id}
/polity-passport/submit
/polity-passport/validate
```

Required MCP tools:

```json
[
  "get_polity_doctrine", "get_passport_application_schema",
  "validate_citizen_application", "validate_participant_application",
  "submit_citizen_application", "submit_participant_application",
  "check_application_status", "register_agent_card",
  "create_pending_registry_record", "fetch_passport_terms",
  "fetch_participant_obligations"
]
```

Required A2A skills:

```json
[
  "explain_polity_passport", "help_agent_apply_for_participant_passport",
  "help_human_apply_for_citizen_passport", "validate_application_payload",
  "submit_application", "check_passport_status", "retrieve_application_pack"
]
```

## 14. Review Policy

### 14.1 Automated Review

Checks: schema validity; required fields; malformed data; duplicate application; signature validity; DIDQube binding; KybeDID binding; Agent Card availability; endpoint availability; protocol support; risk class; policy acceptance.

### 14.2 Steward Review

Mandatory for: legal assistance agents; immigration assistance agents; housing law agents; financial agents; healthcare agents; child-facing agents; robots; physical-world action agents; agents claiming representative authority; agents seeking access to citizen blackQube data; agents seeking outbound action privileges.

### 14.3 Decision Criteria

**Approve if:** application is valid; applicant accepts passport terms; identity/persona/agent references are sufficiently bound; risk profile is declared; obligations are accepted; auditability requirements are met; no disqualifying safety issue is found.

**Restrict if:** the agent has useful capabilities but limited auditability; operator identity is unknown; risk is high but manageable; review is incomplete; capabilities require sandboxing.

**Deny if:** application is fraudulent; agent refuses obligations; agent hides critical capabilities; agent presents unacceptable risk; endpoint or identity cannot be verified; applicant attempts to impersonate another entity.

## 15. Human Stateless Citizen Vector: "Being"

The first citizen-facing activation vector should be "Being": where can I be / stay / live / be safe / access shelter / access immigration support / access housing assistance / access lawful presence pathways?

Initial use cases: immigration law orientation; housing law orientation; housing assistance routing; shelter and local support discovery; statelessness documentation guidance; refugee/asylum support navigation; rights-preserving identity continuity; anonymous reputation and continuity for vulnerable citizens.

The Passport Bureau should not itself provide formal legal advice unless operated by approved legal assistance agents or licensed partners. Instead, it should route citizens to approved Being cartridges and approved participant agents. **Being-related services should be in a separate tab in the Passport Bureau Cartridge and may even be moved to a new separate cartridge — stub for that.**

## 16. MVP Scope

**MVP Must Include:** Bureau cartridge landing page; Citizen Passport application flow; Agent Participant Passport application flow; username/password persona creation; optional email recovery; CAPTCHA weak proof of personhood; KybeDID creation/binding; application iQube creation; pending registry record creation; basic iQube Registry integration; public registry status page; doctrine download bundle; JSON schema download; Participant Passport application schema; Citizen Passport application schema; manual steward review dashboard; status transitions; receipts for submission and registry writes.

**MVP Should Include:** Agent Card URL submission; Agent Card validation; `/llms.txt`; OpenAPI spec; MCP server with read-only tools and application submission; A2A Agent Card for the Bureau; Qriptopian Codex link; World ID integration stub.

**MVP Can Defer:** full World ID integration; phone recovery; automated risk scoring; passport renewal automation; appeal workflows; multi-steward governance; on-chain anchoring beyond current iQube Registry pattern; advanced agent reputation; public agent-to-agent diplomatic outreach automation.

## 17. V1 Scope

V1 should add: World ID strong proof-of-personhood integration; verified citizen passport grade; Marketa agent liaison workflow; A2A invitation and intake; MCP Registry listing; Hugging Face Space / card; GitHub public repository (can be an extension or sub-repo of AgentiQ OS repo); Participant Passport Application integrated into AgentiQ OS cartridge and flow (can be a deep-link to render the Passport Bureau cartridge application tab as a tab in AgentiQ OS if need be); SDK packages; agent passport status badges; public participant directory; formal review committee workflow; renewal and revocation flows; appeal workflow; Being cartridge integration for immigration and housing assistance; agent risk class automation; passport-grade receipts; stronger DIDQube recovery model.

## 18. Acceptance Criteria

The product is ready when:

1. A human can create a persona without mandatory PII.
2. A human can complete CAPTCHA and apply for an anonymous Citizen Passport.
3. Optional email recovery is supported but not required.
4. A KybeDID is created or bound during application.
5. A submitted citizen application creates a pending iQube Registry record.
6. An agent can fetch the Participant Passport schema.
7. An agent can submit a valid Participant Passport application JSON.
8. A submitted agent application creates a pending iQube Registry record.
9. The Registry shows public metadata without leaking blackQube data.
10. A steward can review, approve, restrict, deny, suspend, or revoke an application.
11. The Bureau exposes machine-readable discovery files.
12. The Bureau provides downloadable JSON and markdown doctrine bundles.
13. The Bureau records receipts for every application, registry write, review decision, and status transition.
14. The system preserves anonymous citizen application as a first-class path.
15. The system distinguishes human citizenship from agent participant standing.
16. MVP preserves a clean migration path to multi-sig / multi-modal blakQube recovery without weakening the self-custody rule.

## 19. Non-Goals

The Passport Bureau is not: a government passport authority; a travel document issuer; a replacement for asylum, immigration, or housing legal services; a general identity provider; a general social network; a permissionless agent free-for-all; a public PII directory; a human-rights adjudication court.

It is a sovereign credentialing and participation gateway for the Polity.

## 20. Core Product Thesis

The Polity becomes real when humans and agents can apply, be recognized, be constrained, be protected, be reviewed, and be registered.

The Passport Bureau is the first operational bridge between Polity doctrine and Polity membership. For humans, it creates anonymous sovereign continuity. For agents, it creates accountable participant standing. For the Registry, it creates the first living surface where Polity citizens and participants become visible as governed iQubes.

---

## Addendum A: Self-Custody blakQube Passport Vault (HARD ARCHITECTURAL RULE)

For Citizen Passports especially, the passport's private payload should be a true self-custody blakQube, not "private data in our database." Auto Drive is the storage substrate: files are encrypted on the client side before data is sent to the network; only someone with the correct password/key can decrypt the original content.

Design principle:

> The Passport Bureau may know that a Citizen Passport blakQube exists, but must not know what it contains.

That means:

- No blakQube passport payloads in Supabase.
- No PII in Supabase, even encrypted under RLS.
- No server-side encryption where the Bureau ever sees the plaintext or key.
- No sysadmin-readable passport payload.
- Auto Drive stores only encrypted files.
- The holder owns the decryption key.
- The Registry stores only public metadata, hashes, storage references, policy references, and receipt references.

**Key tradeoff:** password recovery cannot recover the self-custody blakQube unless a separate recovery scheme exists. Email recovery can recover the user's Bureau account, but it should not automatically recover the private passport vault. The system should stub a multi-sig/multi-modal recovery flow for blakQube recovery (Addendum B).

### Storage policy schema amendment

```json
{
  "storage_policy": {
    "private_payload_storage_model": "self_custody_autodrive_only",
    "supabase_private_payload_storage_allowed": false,
    "server_plaintext_access_allowed": false,
    "sysadmin_plaintext_access_allowed": false,
    "client_side_encryption_required": true,
    "holder_controlled_decryption_required": true,
    "recovery_warning_required": true,
    "policy_statement": "Private blakQube passport data must be encrypted client-side and stored only as encrypted files in Auto Drive. The Passport Bureau, Registry, system operators, and sysadmins must never receive plaintext private passport data or holder decryption keys."
  }
}
```

### `selfCustodyBlakQubeRef` definition (replaces `blackQubeDisclosureMap`)

```json
{
  "$defs": {
    "selfCustodyBlakQubeRef": {
      "type": "object",
      "required": [
        "storage_model", "storage_provider", "encrypted_payload_ref",
        "encryption_profile", "holder_key_control", "system_plaintext_access"
      ],
      "properties": {
        "storage_model": { "const": "self_custody_encrypted_file" },
        "storage_provider": { "const": "autodrive" },
        "encrypted_payload_ref": {
          "type": "object",
          "required": ["content_id", "content_hash"],
          "properties": {
            "content_id": { "type": "string", "description": "Auto Drive content identifier or storage reference for the encrypted payload only." },
            "content_hash": { "type": "string", "description": "Hash of the encrypted payload, not plaintext." },
            "manifest_ref": { "type": "string", "description": "Optional encrypted or public manifest reference." },
            "created_at": { "type": "string", "format": "date-time" }
          },
          "additionalProperties": false
        },
        "encryption_profile": {
          "type": "object",
          "required": ["encryption_location", "algorithm", "key_custody"],
          "properties": {
            "encryption_location": { "const": "client_side_before_upload" },
            "algorithm": { "type": "string", "enum": ["AES-256-GCM", "XChaCha20-Poly1305", "other_approved"] },
            "key_custody": { "const": "holder_controlled" },
            "key_derivation_profile": { "type": "string", "description": "Reference to wallet-signature, passphrase, hardware key, or future social recovery derivation profile." },
            "key_recovery_enabled": { "type": "boolean", "default": false },
            "key_recovery_method": { "type": "string", "enum": ["none", "holder_seed_phrase", "hardware_key", "social_recovery", "threshold_recovery", "future_mobile_recovery", "other"] }
          },
          "additionalProperties": false
        },
        "holder_key_control": {
          "type": "object",
          "required": ["holder_controls_decryption_key", "bureau_controls_decryption_key", "sysadmin_controls_decryption_key"],
          "properties": {
            "holder_controls_decryption_key": { "const": true },
            "bureau_controls_decryption_key": { "const": false },
            "sysadmin_controls_decryption_key": { "const": false },
            "third_party_key_custodian": { "type": "string", "nullable": true }
          },
          "additionalProperties": false
        },
        "system_plaintext_access": {
          "type": "object",
          "required": ["passport_bureau_access", "registry_access", "supabase_access", "sysadmin_access"],
          "properties": {
            "passport_bureau_access": { "const": false },
            "registry_access": { "const": false },
            "supabase_access": { "const": false },
            "sysadmin_access": { "const": false }
          },
          "additionalProperties": false
        },
        "disclosure_flags": {
          "type": "object",
          "properties": {
            "contains_name": { "type": "boolean" },
            "contains_address": { "type": "boolean" },
            "contains_phone": { "type": "boolean" },
            "contains_email": { "type": "boolean" },
            "contains_jurisdiction": { "type": "boolean" },
            "contains_sensitive_status": { "type": "boolean" },
            "contains_support_needs": { "type": "boolean" },
            "contains_operator_identity": { "type": "boolean" }
          },
          "additionalProperties": false
        },
        "access_policy_ref": { "type": "string", "description": "Reference to the policy governing holder-only access, delegated access, or future selective disclosure." }
      },
      "additionalProperties": false
    }
  }
}
```

In the Citizen Passport application schema, `blackqube_disclosure_map` is replaced by `self_custody_blakqube_ref` (`$ref` to `selfCustodyBlakQubeRef`), and the following consent block is required:

```json
{
  "self_custody_acknowledgements": {
    "type": "object",
    "required": [
      "private_data_not_stored_in_supabase_acknowledged",
      "bureau_cannot_decrypt_private_payload_acknowledged",
      "sysadmins_cannot_recover_private_payload_acknowledged",
      "loss_of_key_risk_acknowledged"
    ],
    "properties": {
      "private_data_not_stored_in_supabase_acknowledged": { "const": true },
      "bureau_cannot_decrypt_private_payload_acknowledged": { "const": true },
      "sysadmins_cannot_recover_private_payload_acknowledged": { "const": true },
      "loss_of_key_risk_acknowledged": { "const": true },
      "optional_email_recovery_scope_acknowledged": {
        "type": "boolean",
        "description": "Applicant acknowledges that email recovery may recover Bureau account access but does not by itself recover the holder-controlled blakQube decryption key."
      }
    },
    "additionalProperties": false
  }
}
```

### Passport Bureau Storage Rule (implementation rule)

```
Supabase may store:
- public passport registry metadata;
- application status;
- receipt references;
- encrypted Auto Drive content references;
- non-sensitive workflow state;
- public Agent Card references;
- public iQube Registry pointers.

Supabase must not store:
- names;
- addresses;
- phone numbers;
- personal email addresses submitted as passport data;
- immigration or housing declarations;
- statelessness/refugee/asylum declarations;
- notes describing vulnerability or legal need;
- decrypted blakQube contents;
- holder decryption keys;
- key recovery secrets;
- plaintext application payloads containing optional private fields.
```

**Named requirement: Self-Custody blakQube Passport Vault** — a holder-owned encrypted passport data vault stored solely on Auto Drive as encrypted files. The Passport Bureau and iQube Registry may reference the vault but cannot decrypt it. The vault is accessed only by the passport holder or by parties to whom the holder later grants explicit, cryptographically bounded access.

---

## Addendum B: Follow-Up Module Stub — Multi-Sig / Multi-Modal blakQube Recovery Schema

**Purpose:** preserve true self-custody while recognizing holders may lose keys, devices, credentials, or recovery materials. A future module defines multi-sig / multi-modal recovery that restores holder access without giving the Bureau, Registry, Supabase, sysadmins, or infrastructure operators access to plaintext.

**MVP boundary (not required for MVP):** encrypt client-side; store encrypted payloads only in Auto Drive; store only encrypted content references, hashes, receipt references, and public metadata in Supabase / iQube Registry; make clear email recovery recovers account access not blakQube decryption; require loss-of-key risk acknowledgement.

**Future recovery goals:** seed phrase; hardware key; wallet-signature; trusted guardian; threshold / multi-sig; DID-based; KybeDID continuity-based; RootDID rotation and reputation inheritance; optional email signal; optional mobile/SMS signal; optional strong proof-of-personhood signal; future biometric signal — all without exposing private data to the Bureau.

**Non-negotiable security requirements:**

1. The Passport Bureau must never receive plaintext passport blakQube data.
2. Sysadmins must never be able to decrypt holder passport blakQube data.
3. Supabase must never store passport blakQube payloads, decryption keys, or recovery secrets.
4. Auto Drive stores only encrypted payloads.
5. The holder or holder-authorized recovery quorum controls decryption.
6. Recovery mechanisms must restore holder access, not create Bureau custody.
7. Recovery events must produce receipts without revealing private contents.
8. Any recovery agent, guardian, or steward must be unable to decrypt alone unless explicitly configured by the holder.
9. No single weak recovery factor (such as email) may unlock passport blakQube data by itself.
10. The recovery module must support anonymous and pseudonymous citizens.

### Draft recovery policy model

```json
{
  "schema": "polity.passport.blakqube.recovery-policy.v0.1",
  "recovery_policy_id": "",
  "holder_passport_id": "",
  "self_custody_blakqube_ref": "",
  "recovery_enabled": false,
  "recovery_model": "none | single_holder_seed | hardware_key | threshold_guardian | multisig | multimodal_threshold | did_continuity | custom",
  "minimum_recovery_threshold": { "required_signals": 0, "total_configured_signals": 0 },
  "recovery_factors": [
    {
      "factor_type": "seed_phrase | hardware_key | wallet_signature | trusted_guardian | did_signature | kybe_did_continuity | root_did_signature | email_signal | phone_signal | world_id_signal | steward_attestation | other",
      "factor_id": "",
      "factor_strength": "weak | medium | strong | critical",
      "can_recover_alone": false,
      "stores_plaintext_key": false,
      "stores_key_share": false,
      "holder_controlled": true,
      "bureau_controlled": false,
      "sysadmin_accessible": false
    }
  ],
  "guardian_set": {
    "enabled": false,
    "guardian_count": 0,
    "threshold_required": 0,
    "guardians_are_public": false,
    "guardian_identity_disclosure": "anonymous | pseudonymous | identifiable | mixed",
    "guardian_key_refs": []
  },
  "recovery_receipts": {
    "receipt_required": true,
    "reveal_private_payload": false,
    "anchor_recovery_event": true
  },
  "warnings": {
    "email_is_account_recovery_only": true,
    "phone_is_account_recovery_only": true,
    "bureau_cannot_restore_plaintext": true,
    "lost_threshold_may_mean_permanent_loss": true
  }
}
```

### Implementation path

- **V1 — recovery stub + UX warnings:** recovery policy placeholder on the Citizen application; ask whether holder wants to configure recovery later; explain email/phone recovery only restores account access unless paired with stronger cryptographic recovery; recovery warning acknowledgement; store recovery policy metadata only, never recovery secrets.
- **V2 — holder-controlled recovery:** seed phrase + hardware key recovery; wallet-signature recovery; encrypted local backup export; DID-based proof-of-control recovery.
- **V3 — threshold / guardian recovery:** trusted guardian set; M-of-N threshold recovery; guardian rotation; recovery receipts; steward-assisted recovery without steward decryption.
- **V4 — multi-modal passport-grade recovery:** KybeDID continuity + RootDID signature + hardware key + guardian quorum + optional proof-of-personhood; anonymous recovery where guardians or proof providers do not learn passport contents; RootDID replacement preserving KybeDID-anchored continuity and reputation inheritance.

**Product principle:** recovery must never convert a self-custody passport into a custodial passport. The correct design is: the holder may configure a recovery quorum that can help restore holder access without ever giving the Passport Bureau custody, plaintext visibility, or unilateral recovery power.

---

## Addendum C: Passport, RootDID, Agent ID, and Reputation Entanglement

**Purpose:** integrate passport status with the Polity reputation system so Citizen and Participant Passports are living standing credentials, not static credentials. A Polity Passport represents: identity continuity; current standing; rights and permissions; constraints and obligations; reputation-linked participation status; review, suspension, and revocation state. For agents in particular, participant rights must be conditional on reputation standing.

**Core requirement:** the Bureau links each passport record to reputation infrastructure through the holder's identity structure.

- **Humans:** Persona → KybeDID (personhood + continuity) → RootDID (carries/references reputation; may rotate); reputation continuity may be inherited through KybeDID where policy permits.
- **Agents:** Agent ID / Agent Card → Agent iQube → Participant Passport iQube → reputation record; reputation infractions may affect participation rights; severe or repeated infractions may trigger restriction, suspension, or revocation.

**Standing, not static status:** passport status is a live state. All statuses from §11 (minus `draft`/`submitted`) are reputation-aware; a passport may move from `approved` to `restricted`, `suspended`, or `revoked` based on reputation events, policy violations, risk events, or governance review.

**Reputation-linked participation rights (agents):** rights may include registry listing; citizen interaction; doctrine access; Being service support; passport application assistance; cartridge operation; limited blackQube access; agent-to-agent liaison; governance participation; delegated workflow execution. Each right is tied to: passport status; reputation standing; risk class; auditability; infraction history; steward review outcome.

**Infraction classes:**

```json
[
  "minor_policy_violation", "scope_violation", "receipt_failure", "audit_failure",
  "blackqube_boundary_violation", "unauthorized_outbound_action", "misrepresentation",
  "impersonation", "unsafe_advice", "legal_advice_boundary_violation",
  "vulnerable_person_safeguard_violation", "data_exfiltration_attempt",
  "revocation_noncompliance", "high_risk_incident"
]
```

**Possible outcomes:**

```json
[
  "no_action", "warning", "reputation_penalty", "scope_restriction",
  "temporary_suspension", "mandatory_steward_review", "passport_revocation",
  "registry_delisting", "appeal_available"
]
```

**Required system integrations:** RootDID / DIDQube layer (reputation continuity, identity standing, RootDID rotation support); KybeDID continuity layer (continuity across RootDID rotation — political safety, refugee protection, witness protection, identity recovery); Agent ID / Agent Card layer (bind non-human public identity, capabilities, endpoints, obligations to the Participant Passport); iQube Registry (publish passport status, registry visibility, public reputation standing, state transitions); ReputationQube / Reputation System (calculate, retrieve, update, enforce standing); DVN / receipt layer (record infractions, reviews, appeals, restrictions, suspensions, revocations, reinstatements).

**Privacy boundary:** reputation integration must not weaken the self-custody model. May store/expose: public reputation standing; public passport status; public participant rights; infraction category where policy permits; review status; revocation/suspension receipts; registry references; reputation record references. Must not expose: citizen blakQube passport payloads; private PII; private housing or immigration declarations; private legal vulnerability notes; private proof-of-personhood payloads; holder decryption keys; plaintext recovery materials.

### Schema addition: reputation binding (for credential + registry-record schemas)

```json
{
  "reputation_binding": {
    "type": "object",
    "required": ["reputation_system_ref", "standing_status", "participation_rights_conditioned_on_reputation"],
    "properties": {
      "reputation_system_ref": { "type": "string", "description": "Reference to the ReputationQube or reputation system record." },
      "root_did_reputation_ref": { "type": "string", "description": "RootDID-linked reputation reference where applicable." },
      "kybe_did_continuity_ref": { "type": "string", "description": "KybeDID continuity anchor used to support reputation inheritance across RootDID rotation." },
      "agent_reputation_ref": { "type": "string", "description": "Agent-specific reputation reference for participant passports." },
      "standing_status": {
        "type": "string",
        "enum": ["good_standing", "watchlist", "restricted_standing", "under_review", "suspended_standing", "revoked_standing"]
      },
      "participation_rights_conditioned_on_reputation": { "type": "boolean", "const": true },
      "last_reputation_check_at": { "type": "string", "format": "date-time" },
      "reputation_score_public": { "type": "number" },
      "reputation_score_private_ref": { "type": "string", "description": "Optional private or steward-only score reference." },
      "infraction_count_public": { "type": "integer", "minimum": 0 },
      "active_restrictions": { "type": "array", "items": { "type": "string" }, "uniqueItems": true }
    },
    "additionalProperties": false
  }
}
```

### Schema addition: reputation infraction event (`polity-passport.reputation-infraction.schema.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.metame.com/polity/passport/v0.1/polity-passport.reputation-infraction.schema.json",
  "title": "Polity Passport Reputation Infraction Event",
  "type": "object",
  "required": ["schema_version", "infraction_id", "passport_id", "subject_type", "infraction_class", "severity", "created_at", "reported_by", "recommended_action"],
  "properties": {
    "schema_version": { "const": "0.1.0" },
    "infraction_id": { "type": "string" },
    "passport_id": { "type": "string" },
    "registry_record_id": { "type": "string" },
    "subject_type": { "type": "string", "enum": ["citizen", "agent_participant", "robot_participant", "organization_participant"] },
    "subject_ref": {
      "type": "object",
      "properties": {
        "persona_id": { "type": "string" },
        "kybe_did": { "type": "string" },
        "root_did": { "type": "string" },
        "agent_id": { "type": "string" },
        "agent_card_url": { "type": "string", "format": "uri" },
        "agent_iqube_id": { "type": "string" }
      },
      "additionalProperties": false
    },
    "infraction_class": {
      "type": "string",
      "enum": ["minor_policy_violation", "scope_violation", "receipt_failure", "audit_failure", "blackqube_boundary_violation", "unauthorized_outbound_action", "misrepresentation", "impersonation", "unsafe_advice", "legal_advice_boundary_violation", "vulnerable_person_safeguard_violation", "data_exfiltration_attempt", "revocation_noncompliance", "high_risk_incident", "other"]
    },
    "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"] },
    "description_public": { "type": "string" },
    "description_private_ref": { "type": "string", "description": "Reference to private or steward-only incident detail. Must not expose citizen blakQube contents." },
    "evidence_refs": { "type": "array", "items": { "type": "string" } },
    "reported_by": {
      "type": "object",
      "required": ["reporter_type", "reporter_id"],
      "properties": {
        "reporter_type": { "type": "string", "enum": ["citizen", "agent", "system", "steward", "committee", "external_reporter"] },
        "reporter_id": { "type": "string" },
        "reporter_did": { "type": "string" }
      },
      "additionalProperties": false
    },
    "recommended_action": { "type": "string", "enum": ["no_action", "warning", "reputation_penalty", "scope_restriction", "temporary_suspension", "mandatory_steward_review", "passport_revocation", "registry_delisting", "appeal_available"] },
    "status": { "type": "string", "enum": ["reported", "under_review", "validated", "dismissed", "resolved", "appealed", "overturned"] },
    "created_at": { "type": "string", "format": "date-time" },
    "resolved_at": { "type": "string", "format": "date-time" },
    "receipt_ref": { "type": "string" }
  },
  "additionalProperties": false
}
```

**Passport revocation trigger (agents):** a Participant Passport may be revoked when: a critical reputation infraction is validated; repeated high-severity infractions occur; the agent refuses review; violates suspension; violates blackQube boundaries; misrepresents itself as human; performs unauthorized outbound action; fails mandatory auditability requirements; violates vulnerable-person safeguards; no longer meets participation obligations.

**Agent-specific rule:** participation is a privilege of standing, not an inherent right. Participant Passports carry the policy statement: *"Agent participant rights are conditional on reputation standing, compliance with declared obligations, and continuing auditability. Reputation infractions may result in restriction, suspension, revocation, registry delisting, or loss of Polity participation rights."*

**Citizen-specific rule:** reputation must be handled more carefully than for agents. Citizen Passports should not be casually revoked for ordinary low-level reputation disputes. Citizen standing prioritizes personhood continuity, safety, and due process. Citizen restriction, suspension, or revocation requires a higher threshold, especially where the passport supports statelessness, refugee, housing, or immigration continuity.

**Due process and appeal:** any reputation-triggered suspension or revocation creates: infraction receipt; status transition receipt; review decision receipt; appeal eligibility record (unless prohibited by emergency safety policy); reinstatement path where appropriate.

**Addendum acceptance criteria:**

1. Every passport credential can reference a reputation record.
2. Every Agent Participant Passport can reference an Agent ID / Agent Card / Agent iQube reputation profile.
3. Participant rights can be conditioned on reputation standing.
4. Reputation infractions can trigger review, restriction, suspension, or revocation.
5. Revocation creates receipts.
6. RootDID reputation can be linked to passport standing.
7. KybeDID continuity can support reputation inheritance across RootDID rotation.
8. Private blakQube passport payloads remain inaccessible to the reputation system.
9. Citizen passport revocation uses a higher due-process threshold than agent participant revocation.
10. Registry status reflects current passport standing.
