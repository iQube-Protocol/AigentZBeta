# Qriptopian Native Bridge Content Administration

**Specification:** QRP-BRIDGE-ADMIN · **Version:** 1.0 · **Date:** 2026-09-01  
**Companions:** [MoneyPenny Cartridge](MoneyPenny_Cartridge_Spec_v1.md) · [Financial Services Bridge](Financial_Services_Bridge_Spec_v1.md)  
**Status:** Implementation specification derived from the operator's direction. No interface, migration, upload, publication, or deployment has been performed by writing this document.  
**Delivery:** Third coordinated workstream. Build the shared content administration early enough to populate the cartridge and bridge educational surfaces.

## 1. Result and ownership

An authorized operator manages bridge content through **the platform-native Qriptopian cartridge → Admin → Bridges**. Within Bridges, they select a bridge, its journey/domain where relevant, a stage, and a content slot. They can edit existing bridge copy, upload or select an infographic/video/animation/thumbnail, preview it in the actual presentation, and publish it to that destination.

The same result must be achievable through an authorized agent using the existing content-upload primitive and the shared bridge placement service. An infographic created in Studio or by an external connected agent appears in the native admin interface with the same asset identity, destination, version, and publication state. The agent need not drive the browser to perform this operation.

Qriptopian owns the administration surface. Existing platform content services own storage and asset metadata. Journey Spine owns valid bridge/stage/surface identities. The bridge placement service owns which content revision appears in a registered slot. MoneyPenny and other cartridges consume those references. Editorial administration cannot alter Passport, delegation, financial authority, Standing, or journey evidence.

Canonical names in this specification are Qriptopian, Auto-Drive/Autonomys, Supabase, Bitcent, and KNYT COYN ($KNYT).

## 2. Scope — A-01

Deliver parity with existing bridge editorial administration first, then connect existing asset upload and delivery capabilities. Include CI, KNYTS, the intermediary financial-services journey defined in the companion spec, and editorial slots in the advanced Horizen FS journey where supported. Register other existing bridges discovered in the current implementation through the same registry; do not assume this list exhausts the estate.

Included: copy, images/infographics, thumbnails/posters, videos, rendered animations, existing article/document references, asset selection, basic metadata/accessibility, preview, explicit publication, replacement, and restoration of a previous placement. Reuse existing audio support where a registered surface consumes it. One asset can be placed in multiple authorized destinations without uploading its bytes again.

Excluded from this phase: a new CMS, thin-client-only administration, a visual journey logic builder, generalized executable widgets, microservice deployment, arbitrary HTML/JavaScript uploads, new financial execution controls, elaborate editorial approval chains, and bulk production of the educational collection. Future primitives have an explicit disabled extension seam only.

## 3. Code evidence and reuse boundary

Inspected 2026-09-01: `iQube-Protocol/AigentZBeta`, branch `claude/cs-capstone-estate-and-brief`, commit `f214d2be3` dated 2026-08-25. This local snapshot predates the supplied screenshots and recent work. Implementation phase A0 must reconcile current branches and relevant canonical repositories. Observations below are source findings, not authenticated live verification. No production database or credentials were used.

| Existing source | Verified behavior | Treatment |
|---|---|---|
| `data/codex-configs.ts` | Native Admin → Magazine and Codex and Qriptopia → Admin both mount `QriptopianAdminTab` | Extend the native Admin navigation; preserve both existing entries |
| `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` | Article section/editor, Codex manager, import, metadata editing, upload, archive, replacement and promotion controls | Reuse shell, controls and services; add a Bridges view rather than a parallel application |
| `app/(shell)/admin/codex/components/CodexUploadModal.tsx` | Existing queue, Auto-Drive and Supabase choices, signed upload/register flow, existing codex upload endpoints | Reuse upload machinery; add bridge context without forcing bridge media into a magazine or episode |
| `app/bridge/ci/page.tsx`, `app/bridge/knyts/page.tsx` | Modal Bridge Admin mounts the same `KnytsBridgeAdminPanel` with different section keys | Migrate editorial entry points into native Qriptopian |
| `components/journey/KnytsBridgeAdminPanel.tsx` | Edits headline, short copy, video URL, poster URL, campaign CTA and reward copy | Preserve every supported field and actual reader behavior |
| `services/journey/knytsBridgeEditorialConfig.ts`, `app/api/journey/knyts-bridge/editorial-config/route.ts` | Shared `knyts_bridge_editorial_config` table; public GET, admin-gated PUT, allowed section keys and defaults | Extend this existing substrate behind a bridge-neutral interface; retain old key compatibility |
| `BridgeMediaStage.tsx`, `BridgeOrientSurface.tsx`, `KnytsBridgeChooseSurface.tsx` | Existing media presentation and editorial-config readers | Reuse renderers and resolver seams; verify each field reaches its reader |
| `app/api/threshold/mcp/route.ts`, `app/api/threshold/upload-action/route.ts` | Threshold capability checks and common `executeThresholdContentUpload` | Preserve bearer/session boundary and shared execution |
| `services/threshold/uploadContentAsset.ts` | Upload receipt with asset ID/CID/hash; optional association with `content` manifest | Reuse asset upload; add bridge placement as a distinct operation |
| `app/api/admin/codex/upload-asset/route.ts`, `server/services/autonomysContentService.ts` | Auto-Drive encrypted asset storage and `codex_media_assets` metadata | Reuse canonical storage; reconcile authorization before extending exposure |
| `app/api/admin/codex/storage/register/route.ts` | Supabase-backed assets registered in existing codex tables | Preserve provider identity; a storage URL in a legacy CID field is not an Autonomys CID |
| `app/api/content/media/[id]/route.ts` and Qriptopian cover routes | Existing delivery/decryption/derivative paths | Reuse appropriate resolvers; verify media type, access and browser playback |
| `tests/threshold-upload-path-invariant.test.ts`, `tests/mcp-upload-content-asset.test.ts` | Existing upload-path checks | Extend behavioral coverage; source-string tests alone do not prove publication or rendering |

Important reconciliation findings:

- CI and KNYTS already share their editorial backend. Moving the form is not a reason to copy their data to a second authoritative table.
- The current upload tool schema has asset roles, domain/content association and bundle fields; it does not expose bridge/stage/slot publication. Setting `domain` or `contentId` does not establish a bridge placement.
- The active MCP transport intercepts upload calls and uses the shared executor. The generic gateway retains older upload code. Follow the active call graph rather than promoting an obsolete implementation.
- The inspected shared Threshold executor uses the codex Auto-Drive route. The browser `/api/content/assets/upload` route uses Supabase storage, and redirects Threshold bearers to the Threshold action. They do not currently have identical storage behavior.
- The inspected codex upload route explicitly omits a local authorization check, and article admin routes inspected do not show one. Treat server enforcement across all selected entry points as an integration requirement; UI visibility and a path named `admin` are insufficient. This is not a claim about the current deployed security state.
- MCP image validation occurs at its transport boundary; native connector and browser paths must receive equivalent byte validation in the shared service. Current mappings such as video to `game_video` are legacy storage kinds, not labels for bridge editors.
- `passport-established` has a KNYTS default in the inspected service but is absent from the route's inspected allowed-section list. Reconcile reader, registry, allowed keys and admin controls before declaring parity. The Choose surface consumes video/poster while some other form fields are not rendered there.

## 4. Native navigation and editor — A-02 and A-03

Add a first-class **Bridges** sub-tab under the existing native Qriptopian **Admin** group. Mount the Bridges view through the existing admin component or a shared extracted child. Expose the same view from the existing Qriptopia Admin shortcut. This is a native component route, not an iframe to a Lovable admin page.

Within Bridges use a bridge selector followed by registered journey/domain, stage and slot selectors. Show a breadcrumb such as `Bridges / Constitutional Internet / Financial Services / Learn / Stablecoins`. Labels are readable; stable IDs are retained in state and deep links. Restore the last selection on ordinary return, but never inherit it silently when an explicit new target was supplied.

| Area | Controls and behavior |
|---|---|
| Bridge overview | Registered destinations, publication state, missing assets, and link to the actual bridge |
| Stage/slot list | Current copy, media type, thumbnail, active version, and supported actions |
| Editor | Existing copy fields, asset picker/upload, title, description, alt text, transcript/captions, related content reference |
| Preview | Render the selected content using the bridge/cartridge's actual presentation component; desktop and narrow view |
| Publication | Save draft or explicitly publish the selected revision; current published content stays visible until success |
| Asset details | Existing source/receipt metadata, usage locations, replacement and history; technical details remain secondary |

Do not show editable fields which the selected reader ignores. Preserve their stored values during migration and mark unsupported fields accurately. Existing immediate-save editorial behavior can be presented as **Save & publish**, with the destination clearly shown. No mandatory multi-person approval workflow is introduced.

Each original bridge Admin entry becomes an authorized deep link into this view, carrying its bridge/stage selection and a validated return destination. Retire independent modal editors after parity verification. During transition, any still-mounted legacy form must use the same writer and cannot overwrite newer content with stale values.

## 5. Destination registry and migration mapping — A-04

Use Journey Spine's registered bridge, journey, stage and surface identities. Extend its existing metadata or adjacent registry to describe editorial slots, allowed presentation types and consumed fields. Never generate destinations from arbitrary user strings or confuse intermediary Operate with advanced Horizen Operate.

| Destination | Legacy binding / new composition | Requirement |
|---|---|---|
| KNYTS Home | `home` | Preserve all currently rendered editorial values and defaults |
| KNYTS Orient | `orient` | Same record, now edited in Qriptopian |
| KNYTS Choose | `choose` | Preserve actual video/poster behavior; do not pretend unused copy is published |
| KNYTS established Passport | `passport-established` service default | Reconcile reader/route support in A0; preserve established Passport semantics |
| CI Home / Orient | `ci-home`, `ci-orient` | Preserve distinct narrative and current values |
| CI established Passport | `ci-passport-established` | Edit presentation only |
| CI View blocks | `ci-view-<block.id>` from `CI_BRIDGE_VIEW_CONTENT` | Derive keys from the canonical block registry |
| Intermediary FS in CI/KNYTS | Discover, Learn, Explore, Prepare, Operate, Cross from companion B-04–B-10 | Register slots against the implemented journey IDs; share lessons with explicit narrative variants |
| Advanced Horizen FS | Existing registered advanced stages | Expose relevant editorial slots even without matching entry-bridge View terminology; no change to advanced admission |
| Other/future domain bridges | Current registry plus approved additions | Same editor and slot contract, no copied admin system |

Preserve old row keys and links through an adapter. A naming cleanup or physical table rename is not a release prerequisite. Record a before/after inventory of values, assets, stage consumers and defaults. Do not overwrite existing content with starter copy. A read error remains an error; a legitimately absent configuration may use the registered default.

## 6. Content, assets and placements — A-05

Keep three distinct concepts: the editorial content item, the stored asset/version, and its placement in a journey slot. Use existing `content` and codex asset records where appropriate; a standalone infographic need not become a published Qriptopian magazine article. Do not add bridge media to public article feeds merely to make it discoverable in the admin picker.

Extend the shared editorial substrate with typed asset references and the minimum revision/placement fields needed below. Reconcile existing revision facilities first. These are logical contracts, not claims that matching SQL columns or APIs already exist.

| Contract | Minimum information |
|---|---|
| Destination | Bridge, journey/domain if applicable, stage, slot, locale/narrative variant, registered presentation type |
| Content | Stable content reference when applicable, title/copy, description, related learning/capsule reference |
| Asset reference | Existing asset ID, provider, immutable version/hash, storage reference, media type and dimensions/duration where applicable |
| Presentation | Main asset, poster/thumbnail, alt text, captions/transcript or equivalent, display options supported by the reader |
| Placement revision | Identity, draft/published state, expected previous revision, actor, timestamps, active asset references |
| Operation evidence | Correlation/idempotency reference, upload result, association result, placement result, publication result and failure stage |

A thumbnail/poster is explicitly associated with its parent media/placement. It must not replace the content item's global cover just because the upload endpoint also supports `setPrimary`. Alternate assets and multiple placements remain independent. Copying a placement references the asset; editing one destination does not silently update every destination using that asset.

Published placements resolve a specific version. Updating an asset produces an explicit replacement/revision and impact preview. Restore or unpublish changes the placement pointer; it does not promise deletion from immutable storage or recall of already public downloads. Preserve the existing last valid published content on a failed edit.

## 7. Upload, storage and delivery — A-06

Use the existing Codex upload controls and storage adapters. Bridge context preselects the destination and presentation role without requiring episode numbers, magazine categories, invented rarity, or financial token settings.

Auto-Drive/Autonomys remains the canonical immutable media route where selected by existing policy. Supabase continues to hold application metadata and placements and supports existing working assets and public delivery derivatives. Preserve the present working-file and promotion options rather than forcing every upload into both providers. Display the actual provider and receipt; never relabel a Supabase URL as a CID.

Browser and agent transports authenticate according to their own established session models and then call shared trusted service logic. They must not depend on an unauthenticated HTTP hop to an admin URL. If extracting a server service from the existing route is needed to preserve both authorization models, extend that seam and update the existing path tests accordingly. Never pass a Threshold bearer to browser persona resolution or introduce a second OAuth crossing inside an already authorized upload.

Validate actual bytes, type, permitted size and role compatibility across all paths. Keep existing decodable-image checks; extend validation where needed for the selected media formats. Supported animation in this phase means a validated rendered video or image format, with poster/reduced-motion equivalent. Unsupported executable content remains unavailable.

Upload is not publication. Retain the successful asset receipt if association or placement fails, and retry the failed step using that asset. Correlated retries cannot append duplicate manifest entries, duplicate placements or silently repeat charged storage work. Because storage and database writes may not be atomic together, show partial outcomes and reconcile them explicitly. Background completion/reconciliation must not depend on leaving the admin page open.

Use the existing content-media/cover delivery paths where suitable. Check real MIME headers, decode, video seeking/range behavior and poster delivery. Do not assume an image derivative route is a complete video delivery solution. Public bridge media must have the correct explicit visibility; private financial statements/profile uploads never enter this editorial upload flow.

## 8. Agent and Studio workflow — A-07

Support the requested intent: **"Create a crypto-trading infographic and upload it to the financial-services bridge's Learn stage."**

1. Resolve the existing registered destination and required presentation type. Reuse the explicit task target; ask only when destination or intended publication remains materially ambiguous.
2. Produce the asset in Studio or the connected creation tool, or select an existing asset. Preserve creation provenance and accessibility metadata.
3. Upload via `upload_content_asset`, or reuse a prior successful asset receipt. Current tool roles remain unchanged unless an explicitly compatible extension is required. An infographic can use a supported image role plus presentation metadata; do not invent an unsupported `infographic` role in current calls.
4. Bind the asset/content reference to the registered bridge slot through the same service used by the native editor. Add an authenticated connector action or an additive optional destination contract after reconciling current tools. This bridge-placement operation is proposed functionality, not a currently callable tool asserted by this spec.
5. Publish when the user's instruction and granted authority cover publication. "Upload" alone can leave a draft; "publish to this bridge" should complete the authorized action without an unnecessary extra confirmation. Storage capability alone cannot imply bridge publication authority.
6. Return the real destination, asset identity/hash/storage reference, publication revision/state and any outstanding failure. Open the native admin interface and see exactly the same result.

The user experiences one coherent task even if upload, association and publication require several internal calls. Both agent and UI paths use identical target validation, revision rules and audit evidence. New placement authority uses the existing capability model; its exact capability identifier is selected in A0 rather than fabricated as already granted. A session with `content.asset.upload` but no applicable placement permission can upload within its scope and must receive an honest placement refusal.

## 9. Publication and renderer contract — A-08

The bridge reader resolves the active published placement into the shared media model used by SC-06. It supplies the same content/asset references to full-stage explainers, inline copilot video, right-pane infographics and optional detail modals. Each surface renders supported content through its current components; it does not maintain a second media catalog.

Draft previews are authorized and isolated from the public read path. A successful publish checks the expected revision, valid target, required media and accessible delivery, then changes the published revision atomically at the application layer. Conflict returns a reviewable difference instead of overwriting another editor's work. Reader invalidation must make the new revision visible on ordinary refresh or the existing refresh channel; no bridge rebuild or deployment is required for routine content changes after this work ships.

Media playback, publication and view counts cannot complete constitutional milestones or grant trading authority. Related chips may navigate to an existing capsule or propose an action; they cannot contain arbitrary executable instructions. Canonical facts and nomenclature in educational media follow the companion specifications, including resolution of the KNYT denomination discrepancy before numerical examples are published.

## 10. Authorization and traceability — A-09

Preserve existing administrative entitlement and validate it server-side on asset writes, content edits, placement changes, previews and publication. Selecting a bridge does not confer authority over it. If current admin scope is platform-wide, preserve that policy; if it is cartridge/domain-scoped, enforce the specific destination. Do not introduce a parallel role system.

Use the platform's actual persona/session and Threshold revocation/expiry behavior. Carry the verified actor into shared services, not an untrusted body field. Keep credentials/server keys out of the client. Review applicable table/storage policies and public-read behavior when extending the schema; public visitors may read published editorial content, not drafts or private financial files. Apply the Supabase skill's current security guidance during implementation, including appropriate RLS for exposed tables.

Audit who changed which destination from which revision to which revision, with asset identity/hash and outcome. Public visibility is an explicit content decision. Audit and monitoring views report durable operation state; opening them must not provide liveness to uploads or reconciliation.

## 11. Future presentation primitives — A-10

Reserve a versioned presentation-type extension and registered renderer reference. Future types may include richer interactive models or service-backed experiences. Unknown types are disabled with an understandable fallback. Do not implement a plugin marketplace, arbitrary scripts, microservice credentials or a new execution engine in this phase. Adding a renderer later requires its own authority and lifecycle design; uploading content cannot deploy a service.

## 12. Delivery and correlation

| Phase | Work | Correlation / exit |
|---|---|---|
| A0 | Reconcile current native admin, bridges, upload transports, storage, permissions and registries | Alongside C0/B0; recorded existing/new mapping and current-source gaps |
| A1 | Native Bridges tab; existing CI/KNYTS forms and deep-link migration | Can ship independently; parity demonstrated before old modal retirement |
| A2 | Shared asset picker/upload, typed placements, draft preview and publish | Unblocks cartridge C2/C-15 and bridge B2/B-15 educational population |
| A3 | Studio/agent placement integration and receipt/retry handling | Same stored result through native UI and authorized connector |
| A4 | FS intermediary and advanced editorial slots, migration verification and canary | Before B5/C6 release acceptance; no change to financial/runtime gates |

This does not reorder the cartridge-first product architecture: C0/C1 still establish working surfaces. A0/A1 proceed alongside them so content population is ready when the bridge and cartridge renderers are available. The ten FS-M01–FS-M10 briefs in bridge B-15 become initial content tasks, not ten hardcoded uploader types.

| This specification | Cartridge/bridge integration |
|---|---|
| A-01–A-04 native ownership and destinations | C-01/C-16; B-03/B-13/B-16 |
| A-05/A-06 asset and storage contract | C-15/C-16; SC-06; B-04/B-15 |
| A-07 creation and agent upload | C-15; B-15 educational asset production |
| A-08 shared delivery | C-15; SC-06; B-04–B-07 |
| A-09 authority | SC-01/02; B-12; no change to financial C-07–C-10 |
| A-10 future primitives | B-16 common domain template; future work only |

Candidate architectural refinement: a common Journey Spine editorial portal within native Qriptopian. Candidate invariant: UI and agent publication must resolve to the same asset and placement revision, with no successful-publication claim based only on an upload receipt. These are recommendations embodied in this requested spec; no separate roadmap registration or constitutional ratification is claimed.

## 13. Acceptance criteria

| Test ID | Scenario and required evidence |
|---|---|
| AC-A01 | Native Qriptopian Admin contains Bridges; both existing native admin entry points reach the same view without loading a thin-client admin |
| AC-A02 | Existing CI/KNYTS content, defaults and supported fields survive migration; old Admin links open the correct destination |
| AC-A03 | Registered bridge/stage/slot selection rejects unknown targets and distinguishes intermediary from advanced FS destinations |
| AC-A04 | Existing consumed copy/media fields render after editing; unsupported fields are not falsely presented as effective |
| AC-A05 | Upload/select an infographic, video and thumbnail through the native editor; actual bridge readers display the intended association |
| AC-A06 | Working Supabase and canonical Auto-Drive assets retain accurate provider/identity; promotion/replacement preserves traceable relationships |
| AC-A07 | Thumbnail changes do not overwrite an unrelated article cover or main media; sharing one asset across destinations does not cross-edit placements |
| AC-A08 | Same asset created/uploaded through the authorized agent path appears in the native admin with matching hash, destination and publication revision |
| AC-A09 | Upload-only authority cannot publish; missing, expired, revoked or wrong-target authority fails through UI APIs and connector actions |
| AC-A10 | Direct calls to all reused public mutation endpoints enforce authorization; no unauthenticated internal HTTP dependency is needed for legitimate Threshold uploads |
| AC-A11 | Malformed or mismatched bytes fail consistently through browser, MCP and native connector paths; existing valid asset behavior remains compatible |
| AC-A12 | Successful upload followed by failed placement reports partial state; retry reuses the asset and produces one intended placement |
| AC-A13 | Concurrent edits return a revision conflict; restoration selects the previous published revision without deleting shared assets |
| AC-A14 | Public readers cannot see draft placements; authorized preview uses the real renderer; publication becomes visible without redeploying the bridge |
| AC-A15 | Captions/transcripts, alt text, poster and reduced-motion alternatives work; video playback and seeking succeed on supported desktop/mobile browsers |
| AC-A16 | Legacy URL media still resolves during migration; inaccessible media/read failures produce honest fallbacks rather than empty success |
| AC-A17 | Financial profile documents, permissions, Passport/Standing and journey satisfaction are untouched by editorial updates or media events |
| AC-A18 | A complete create → upload → place → publish → read/render canary verifies asset identity/hash and destination revision across real boundaries; closing admin does not stop necessary completion |
| AC-A19 | Unknown future primitive types remain disabled; media publication cannot execute arbitrary code or deploy a microservice |
| AC-A20 | Existing Qriptopian article, Codex upload and thin-client readers retain compatibility while native Bridges is the canonical editing home |

These are required implementation tests. They were not run as part of writing the specification. Reuse existing suites and add behavioral cases for the identified gaps. Publication acceptance requires evidence from the reader, not merely an HTTP upload success.

## 14. First implementation slice and open dependencies

Start with native Bridges → CI → an existing View block. Preserve its current copy/video, select or upload one infographic with thumbnail, preview and publish it, verify the public reader, then make an authorized agent update to the same slot and verify the native editor shows that revision. Repeat the parity check for KNYTS before retiring the modal editors. Populate the new FS slots when B2/C2 are ready.

Resolve in A0: current repository/deployed divergence; server enforcement on reused upload/admin endpoints; precise bridge IDs and existing revision facilities; registered renderer support; video delivery limits; and the available connector contract for bridge placement. These are bounded integration decisions, not reasons to create a new CMS or postpone drafting the specifications. Current task authorization covers these documents only; implementation, content creation and publication remain subsequent work.
