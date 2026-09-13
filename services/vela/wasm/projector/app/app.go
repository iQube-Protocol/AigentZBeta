// Package app implements the MoneyPenny Confidential Consequence Projector.
//
// It projects the consequence of a proposed spend against the principal's
// PRIVATE spend and risk limits, entirely inside the TEE, and returns only a
// coarse verdict. It moves no funds and holds no balances of its own — it is a
// projection workload, not a ledger.
//
// Three design rules, each learned from a Slice 2A/2B finding and each
// load-bearing. Changing any one of them silently breaks the constitutional
// contract the surrounding runtime depends on:
//
//  1. THE VERDICT IS A PlainEvent, NEVER AN AppEvent. An AppEvent is emitted
//     on-chain in plaintext (VELA-PRIVACY-BOUNDARY-001), so returning the
//     verdict that way would publish the one conclusion the confidential
//     computation exists to protect. PlainEvent.Data is encrypted by the
//     Executor to the requester's registered P-521 key.
//
//  2. AN UNACCEPTABLE PROJECTION IS A SUCCESSFUL RESULT, NOT AN ERROR. If the
//     app returned ProcessResult{Error: ...} for "limits exceeded", the
//     Executor would mark the request failed on-chain and the caller could not
//     distinguish "the confidential conditions were evaluated and rejected"
//     from "the enclave broke". UNACCEPTABLE is a valid constitutional
//     outcome; only a genuine malfunction is an Error.
//
//  3. THE VERDICT CARRIES NO OPERANDS AND NO FAILING-CONDITION NAME. Not the
//     balance, not the exposure, not the limits, not which comparison failed.
//     The verdict event is publicly observable in shape and size, so anything
//     richer than a three-valued verdict leaks.
package app

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"

	"github.com/HorizenOfficial/vela-common-go/wasm/types"
)

// Verdict values. Deliberately the only three strings this app can emit.
const (
	VerdictAcceptable   = "ACCEPTABLE"
	VerdictUnacceptable = "UNACCEPTABLE"
	VerdictUnresolved   = "UNRESOLVED"
)

const projectionRequestType = "confidential_consequence_projection"

// ApplicationInternalState is intentionally minimal. A projector keeps no
// balances and no per-user financial state: every projection is a pure
// function of the confidential inputs supplied with the request. The counter
// exists only so the state root advances per request (the platform expects
// state to be returned), and it is not a nonce any caller may rely on.
type ApplicationInternalState struct {
	AppID              uint64 `json:"appId"`
	ProjectionsHandled uint64 `json:"projectionsHandled"`
}

// ProjectionInputs are the PRIVATE facts. They exist only inside the enclave,
// for the duration of one call, and are never echoed into any result.
type ProjectionInputs struct {
	CurrentBalance    *int64 `json:"currentBalance"`
	CurrentExposure   *int64 `json:"currentExposure"`
	ProposedSpend     *int64 `json:"proposedSpend"`
	PrivateSpendLimit *int64 `json:"privateSpendLimit"`
	PrivateRiskLimit  *int64 `json:"privateRiskLimit"`
}

// ProjectionRequest is the decrypted payload shape.
type ProjectionRequest struct {
	Type    string            `json:"type"`
	Inputs  ProjectionInputs  `json:"inputs"`
	Context map[string]string `json:"context"`
}

// VerdictEvent is the ENTIRE result surface. One field. See rule 3.
type VerdictEvent struct {
	Verdict string `json:"verdict"`
}

func Deploy(appId int64, paramsJSON string) types.DeployResult {
	stateJSON, err := json.Marshal(&ApplicationInternalState{AppID: uint64(appId)})
	if err != nil {
		return types.DeployResult{Error: fmt.Sprintf("failed to marshal initial state: %v", err)}
	}
	return types.DeployResult{State: stateJSON, Fuel: types.NewUint256(5)}
}

func LoadModule(appId int64) types.LoadModuleResult {
	stateJSON, err := json.Marshal(&ApplicationInternalState{AppID: uint64(appId)})
	if err != nil {
		return types.LoadModuleResult{Error: fmt.Sprintf("failed to marshal initial state: %v", err)}
	}
	return types.LoadModuleResult{State: stateJSON, Fuel: types.NewUint256(5)}
}

// DepositFunds exists because the platform calls `deposit` whenever a request
// carries a non-zero assetAmount. A projector has no use for funds, so it
// accepts the call, changes nothing, and emits nothing. It deliberately does
// NOT error: erroring would fail the whole projection request just because a
// caller attached dust.
func DepositFunds(_ *types.Address, _ *types.Address, _ *types.Uint256, stateJSON string) types.DepositResult {
	return types.DepositResult{State: []byte(stateJSON), Fuel: types.NewUint256(5)}
}

// ProcessRequest projects the consequence of the proposed spend.
//
// Every non-malfunction path returns a verdict event and no Error — including
// UNACCEPTABLE and UNRESOLVED. See rule 2.
func ProcessRequest(senderPtr *types.Address, requestType int32, payloadJSON, stateJSON string) types.ProcessResult {
	if senderPtr == nil {
		// A genuine malfunction: the platform must always supply a sender for
		// PROCESS. No verdict can be attributed, so this is a real Error.
		return types.ProcessResult{Error: "sender address is missing"}
	}
	sender := *senderPtr

	var state ApplicationInternalState
	if err := json.Unmarshal([]byte(stateJSON), &state); err != nil {
		return types.ProcessResult{Error: fmt.Sprintf("failed to parse application state: %v", err)}
	}

	// This projector has no deanonymization report to produce. Returning a
	// Report for a non-DEANONYMIZATION request (or omitting one for a
	// DEANONYMIZATION request) is rejected by the Executor, so a
	// deanonymization request is refused explicitly rather than silently
	// projected.
	if requestType == 2 {
		return types.ProcessResult{Error: "this application produces no deanonymization report"}
	}

	// Dispatch on the payload's OWN "type" field (never on requestType, which
	// only distinguishes PROCESS from DEANONYMIZATION at the platform level).
	// This is the ONLY place single-party and multi-party requests fork —
	// every payload whose type is anything other than
	// multiPartyProjectionRequestType (including malformed JSON, an empty
	// object, or the existing single-party projectionRequestType) takes
	// EXACTLY the same path it always has: project(payloadJSON), unchanged.
	// See app_test.go's pre-existing suite, which is unmodified and still
	// covers that path completely, and TestMultiParty* in
	// app_multiparty_test.go for the new path.
	var events []types.PlainEvent
	if sniffRequestType(payloadJSON) == multiPartyProjectionRequestType {
		events = buildMultiPartyEvents(sender, state.AppID, payloadJSON)
	} else {
		verdict := project(payloadJSON)
		eventData, err := json.Marshal(VerdictEvent{Verdict: verdict})
		if err != nil {
			return types.ProcessResult{Error: fmt.Sprintf("failed to marshal verdict: %v", err)}
		}
		// PlainEvent (rule 1) — the Executor encrypts Data to the sender's
		// registered P-521 key. EventSubType is left zero so the on-chain
		// indexed topic reveals nothing; if the requester registered a subtype
		// seed, the Executor overrides it with an unlinkable HMAC value.
		events = []types.PlainEvent{{UserID: sender, Data: eventData}}
	}

	state.ProjectionsHandled++
	newState, err := json.Marshal(&state)
	if err != nil {
		return types.ProcessResult{Error: fmt.Sprintf("failed to marshal new state: %v", err)}
	}

	return types.ProcessResult{
		State:  newState,
		Events: events,
		// NO AppEvents. An AppEvent would publish the verdict in plaintext.
		Fuel: types.NewUint256(25),
	}
}

// project is the confidential comparison. Pure, deterministic, total: every
// input shape maps to one of the three verdicts, and it never returns an error.
//
// Anything it cannot evaluate becomes UNRESOLVED rather than a guess in either
// direction — a missing limit must never read as "no limit" (which would
// project ACCEPTABLE and, downstream, authorise a spend against a limit nobody
// supplied).
func project(payloadJSON string) string {
	if payloadJSON == "" || payloadJSON == "{}" {
		return VerdictUnresolved
	}

	var req ProjectionRequest
	if err := json.Unmarshal([]byte(payloadJSON), &req); err != nil {
		return VerdictUnresolved
	}
	if req.Type != projectionRequestType {
		return VerdictUnresolved
	}

	return evaluateSingleParty(req.Inputs)
}

// evaluateSingleParty is the pure per-party numeric comparison — extracted,
// UNCHANGED, from project()'s own body so the multi-party joint projection
// (evaluateCombinedInputs, below) can reuse the SAME fail-closed validation
// discipline per contributor instead of duplicating it
// (CLAUDE.md inv.engineering.036/037). This is a behavior-preserving
// extraction, not a logic change: project()'s own tests
// (TestProjectDispositions, TestProjectMalformedInputFailsClosed) are
// unmodified and pin that nothing changed.
func evaluateSingleParty(in ProjectionInputs) string {
	// Pointer fields distinguish "absent" from "zero". A zero limit is a real,
	// meaningful limit (it forbids all spending); an absent one is unknown.
	if in.CurrentExposure == nil || in.ProposedSpend == nil ||
		in.PrivateSpendLimit == nil || in.PrivateRiskLimit == nil {
		return VerdictUnresolved
	}

	exposure := *in.CurrentExposure
	spend := *in.ProposedSpend
	spendLimit := *in.PrivateSpendLimit
	riskLimit := *in.PrivateRiskLimit

	// Negative values are not a meaningful projection input; refusing to
	// interpret them is safer than normalising them.
	if exposure < 0 || spend < 0 || spendLimit < 0 || riskLimit < 0 {
		return VerdictUnresolved
	}

	// Guard the addition before performing it. On overflow the projection
	// cannot be evaluated — it must not wrap into a small number and read as
	// ACCEPTABLE.
	if exposure > 0 && spend > (1<<62)-exposure {
		return VerdictUnresolved
	}

	if spend <= spendLimit && exposure+spend <= riskLimit {
		return VerdictAcceptable
	}
	return VerdictUnacceptable
}

// ─────────────────────────────────────────────────────────────────────────
// Multi-party confidential consequence projection (ADDITIVE)
// ─────────────────────────────────────────────────────────────────────────
//
// Everything below is a NEW capability alongside the single-party path
// above. It does NOT change projectionRequestType, ProjectionRequest,
// ProjectionInputs' meaning, project(), evaluateSingleParty(), or
// ProcessRequest's behavior for any payload whose "type" is not
// multiPartyProjectionRequestType — see app_test.go, which is unmodified,
// and app_multiparty_test.go, which covers this new path.
//
// WHY THIS EXISTS: a Vela application SHARED by more than one contributing
// party (the accelerator's Use Case Zero pilot — e.g. a shared liquidity/
// coverage pool where more than one party's confidential inputs may need to
// be evaluated together in a single execution). Per
// `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-agent-namespace-investigation.md`
// §5, a TS-side gate (services/vela/velaPartyNamespace.ts) can enforce the
// required isolation property ONLY for evidence handled AFTER it leaves this
// guest — it cannot retroactively fix an unauthorized combination that
// already happened inside the enclave. This section is that missing
// in-enclave enforcement, mirroring velaPartyNamespace.ts's SEMANTICS
// (deterministic per-party namespace ref; a fail-closed, per-request
// disclosure scope) in Go, not importing TypeScript into Go.
//
// SIX MANDATORY PROPERTIES (operator-mandated, 2026-09-13, verbatim across
// two rulings), and exactly how each is satisfied — every one load-bearing
// exactly like the three single-party rules in this file's header:
//
//  1. NO TRUSTING A TS-SIDE GATE TO SANITIZE AFTER EXECUTION, AND NO
//     PRE-AUTHORIZATION COALESCING. The authorization gate
//     (resolveAuthorizedCombination) runs INSIDE this guest — compiled into
//     the WASM binary — BEFORE any two parties' ProjectionInputs are read
//     into a shared computation, and combineInputsFn (the ONLY function
//     that ever receives more than one party's ProjectionInputs at once) is
//     a package-level indirection specifically so a test can PROVE it is
//     never invoked when authorization is denied — not merely that the
//     final verdict looks right. See
//     TestMultiParty_AuthorizationGateNeverReceivesPrivateInputs (the gate's
//     own signature makes private data structurally unreachable to it) and
//     TestMultiParty_NoCoalescingBeforeAuthorization (the direct,
//     invocation-counting proof).
//
//  2. NO CONTRIBUTOR ADDRESS ALONE IS SUFFICIENT NAMESPACE AUTHORITY. The
//     `sender` ProcessRequest already receives is used here EXACTLY as it
//     always was — only to know who technically submitted the call, and
//     only as the fallback recipient for a reply this guest cannot otherwise
//     address (buildMultiPartyEvents' malformed-payload branch). It is NOT
//     EVEN A PARAMETER to resolveAuthorizedCombination or evaluateMultiParty
//     — structurally incapable of influencing any authorization decision.
//     See TestSenderAddressAloneNeverGrantsNamespaceAuthority.
//
//  3. NO MERGING PRIVATE STATE INTO AN UNDIFFERENTIATED STRUCT BEFORE
//     AUTHORIZATION. Each party's ProjectionInputs stays keyed by its own
//     party-namespace ref in MultiPartyProjectionInputs (a map) for the
//     ENTIRE lifetime of a request. resolveAuthorizedCombination decides
//     which refs may combine using ONLY a map[string]bool of which refs are
//     present — it never receives a ProjectionInputs value at all. Only
//     AFTER it returns an authorized combination list does evaluateMultiParty
//     index into the per-party map to build the one `group
//     []ProjectionInputs` slice combineInputsFn reads — the ONLY point in
//     this file where more than one party's private data coexists in one
//     variable.
//
//  4. USE ≠ REVEAL. ScopeAction has exactly two values, checked by two
//     wholly separate functions, neither derived from the other in code:
//       - ScopeActionComputeWith (resolveAuthorizedCombination): "may this
//         party's PRIVATE INPUTS be combined into a joint computation at
//         all?" Grants NOTHING about what any party may SEE as a result.
//       - ScopeActionDiscloseTo (isDiscloseAuthorized): "may the evidence
//         resulting from combining Party's data be disclosed TO recipient
//         To?" A party validly included in the combination (ComputeWith) is
//         NOT, by that fact alone, entitled to see the joint verdict — see
//         chooseVerdictForRecipient, which requires an explicit DiscloseTo
//         grant from every OTHER combined party before returning the joint
//         verdict instead of the recipient's own standalone one. See
//         TestMultiParty_DisclosureIsSeparateFromCombinationConsent.
//
//  5. SCOPE BINDING — NEVER REPLAYABLE INTO A DIFFERENT CALCULATION.
//     ScopeBinding commits a scope to (at minimum) the applicationId, the
//     exact request/transaction (RequestRef — never a class of requests),
//     the contributor namespace refs (via the Grants themselves, which name
//     specific refs), the operation type, and the intended output class.
//     resolveAuthorizedCombination checks ALL FOUR Binding fields against
//     the CURRENT request's own context before consulting a single Grant —
//     a scope valid for one applicationId/RequestRef/operationType/
//     outputClass is REJECTED outright against any other, even with
//     identical parties. See TestMultiParty_ScopeBindingRejectsMismatchedContext
//     and TestMultiParty_NonTransitivity.
//
//  6. EXHAUSTIVE FAILURE SEMANTICS. Malformed JSON in the scope field,
//     missing scope entirely, a stale/mismatched binding, and an
//     unrecognized operation type or output class ALL resolve to
//     VerdictUnresolved for EVERY party, checked BEFORE any cross-party
//     state access — never a "best effort" partial decision. See the five
//     TestMultiParty_FailureMode_* tests, plus
//     TestMultiParty_AmbiguousScopeResolvesEveryPartyUnresolved for the
//     ambiguous-but-not-malformed case (ActionRef/Grants omitted).

const multiPartyProjectionRequestType = "confidential_multi_party_consequence_projection"

// The only operation and output class this guest currently recognizes for
// the multi-party path. A ScopeBinding naming any other value is rejected
// (property 5) — this is the forward-compatibility hook: if a future guest
// revision adds a SECOND multi-party operation on the same applicationId, a
// scope minted for THIS operation can never silently authorize that one,
// even with identical parties and RequestRef.
const (
	multiPartyOperationJointConsequenceProjection = "joint_consequence_projection"
	multiPartyOutputClassJointVerdict             = "joint_verdict"
)

// MultiPartyContribution is one party's contribution: their own PRIVATE
// facts (ProjectionInputs, reused verbatim — the private-facts SHAPE is not
// reinvented, only wrapped with routing/delivery information) plus the
// on-chain address the Executor must encrypt THIS PARTY'S OWN reply event
// to. RecipientAddress is delivery routing information — the same class of
// value as ProcessRequest's existing `sender` parameter (property 2) — not a
// confidential value and not usable as namespace authority.
type MultiPartyContribution struct {
	RecipientAddress types.Address    `json:"recipientAddress"`
	Inputs           ProjectionInputs `json:"inputs"`
}

// MultiPartyProjectionInputs holds every contributing party's data,
// SEPARATELY KEYED (property 3) by that party's deterministic namespace
// ref — the same ref TS-side callers derive via deriveVelaPartyNamespaceRef
// (services/vela/velaPartyNamespace.ts). This guest treats the ref as an
// OPAQUE string; it never recomputes or needs to know the identity values
// behind it.
type MultiPartyProjectionInputs map[string]MultiPartyContribution

// ScopeAction is the ONLY authorization vocabulary a ScopeGrant may carry.
// "Use ≠ reveal" (property 4): consenting that one's data may be used in a
// joint COMPUTATION is a categorically different fact from consenting that
// another party may SEE one's data or a value derived from it.
type ScopeAction string

const (
	// ScopeActionComputeWith: Party consents to have their OWN private
	// inputs combined with the rest of the request's authorized combination
	// set, for ONE joint computation. Grants NOTHING about what any party,
	// including Party themselves, may see as a RESULT.
	ScopeActionComputeWith ScopeAction = "COMPUTE_WITH"
	// ScopeActionDiscloseTo: evidence resulting from combining Party's data
	// may be disclosed TO the recipient named in To. Never implied by
	// ScopeActionComputeWith, and checked as a wholly separate fact.
	ScopeActionDiscloseTo ScopeAction = "DISCLOSE_TO"
)

// ScopeGrant is one explicit, minimal authorization unit. Every cross-party
// effect this guest performs (combining, disclosing) must be justified by
// finding an explicit Grant of the right Action — never inferred, never
// assumed from adjacency or from the OTHER Action.
type ScopeGrant struct {
	Action ScopeAction `json:"action"`
	// Party: for ComputeWith, the party namespace ref consenting to join the
	// combination. For DiscloseTo, the party namespace ref WHOSE evidence
	// may be disclosed.
	Party string `json:"party"`
	// To is meaningful ONLY for DiscloseTo — the recipient party namespace
	// ref authorized to receive Party's evidence. Ignored for ComputeWith.
	To string `json:"to,omitempty"`
}

// ScopeBinding is the scope's CONTEXT COMMITMENT (property 5): a valid scope
// must be bound to the exact request it was issued for, never replayable
// into a different one.
type ScopeBinding struct {
	// ApplicationID must equal the CURRENT guest's own applicationId
	// (state.AppID, decimal-string-formatted) — a scope minted for one Vela
	// application can never authorize anything in another.
	ApplicationID string `json:"applicationId"`
	// RequestRef must equal THIS SPECIFIC request's own
	// MultiPartyProjectionRequest.RequestRef — never a class of requests.
	// The caller must mint a fresh value per genuine request; reusing an old
	// scope's binding against a request carrying a different RequestRef is
	// rejected (TestMultiParty_NonTransitivity).
	RequestRef string `json:"requestRef"`
	// OperationType must equal multiPartyOperationJointConsequenceProjection.
	OperationType string `json:"operationType"`
	// OutputClass must equal multiPartyOutputClassJointVerdict.
	OutputClass string `json:"outputClass"`
}

// MultiPartyDisclosureScope is the request-carried, explicit authorization
// structure: a binding commitment (property 5) plus the explicit grants
// (property 4) that answer every cross-party question this guest ever asks.
type MultiPartyDisclosureScope struct {
	Binding ScopeBinding `json:"binding"`
	Grants  []ScopeGrant `json:"grants"`
}

// MultiPartyProjectionRequest is the decrypted multi-party payload shape —
// an ADDITIVE sibling of ProjectionRequest, never a replacement. RequestRef
// is THIS request's own identity (property 5) — the caller must mint a
// fresh value per genuine submission; Scope.Binding.RequestRef is checked
// against it.
type MultiPartyProjectionRequest struct {
	Type       string                     `json:"type"`
	RequestRef string                     `json:"requestRef"`
	Inputs     MultiPartyProjectionInputs `json:"inputs"`
	Scope      MultiPartyDisclosureScope  `json:"scope"`
	Context    map[string]string          `json:"context"`
}

// sniffRequestType reads ONLY the "type" field, tolerating any other
// malformation, so ProcessRequest can dispatch to the multi-party path
// without perturbing the single-party path's own parse-failure handling —
// project() re-parses the full payload itself and fails closed exactly as it
// always has for every payload that is not the new multi-party type.
func sniffRequestType(payloadJSON string) string {
	var probe struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal([]byte(payloadJSON), &probe); err != nil {
		return ""
	}
	return probe.Type
}

// multiPartyRequestContext is THIS guest's own view of "the current
// request" — used to check a scope's Binding against reality. Every field
// is derived from data the platform itself supplies to this call
// (ApplicationID, from state.AppID) or that the SAME decrypted request
// payload carries (RequestRef) — never from the scope itself.
type multiPartyRequestContext struct {
	ApplicationID string
	RequestRef    string
}

// resolveAuthorizedCombination is THE AUTHORIZATION GATE (properties 1, 3,
// 5 and 6). Its signature is the structural proof for property 1/3: it
// receives ONLY party-namespace refs and plain strings (scope, ctx,
// presentRefs) — never a ProjectionInputs value of any kind. It is
// therefore not merely disciplined but INCAPABLE of reading, combining, or
// leaking any party's private data; it can only decide WHICH refs may later
// be combined by a caller that has its own separate access to the data
// (evaluateMultiParty, below).
//
// Returns (combination, true) when combination is a valid (possibly empty)
// set of party-namespace refs authorized to be combined for THIS EXACT
// request context. Returns (nil, false) when the request is ambiguous,
// malformed, or the scope's binding does not match the current context —
// every such case must resolve to UNRESOLVED for every party instead of
// guessing (property 6).
func resolveAuthorizedCombination(scope MultiPartyDisclosureScope, ctx multiPartyRequestContext, presentRefs map[string]bool) ([]string, bool) {
	if len(presentRefs) <= 1 {
		// At most one party's data exists: there is no cross-party
		// combination for a scope to authorize or deny.
		return nil, true
	}

	// Binding check FIRST (property 5) — a scope not bound to EXACTLY this
	// application/request/operation/output-class context is rejected no
	// matter how its Grants read. A missing RequestRef on either side means
	// binding cannot be verified at all, which is ambiguous, never
	// permissive.
	if ctx.ApplicationID == "" || ctx.RequestRef == "" {
		return nil, false
	}
	if scope.Binding.ApplicationID != ctx.ApplicationID ||
		scope.Binding.RequestRef != ctx.RequestRef ||
		scope.Binding.OperationType != multiPartyOperationJointConsequenceProjection ||
		scope.Binding.OutputClass != multiPartyOutputClassJointVerdict {
		return nil, false
	}

	if scope.Grants == nil {
		// The field was never sent on an apparent multi-party request — the
		// ambiguous case property 6 forbids resolving silently. (An
		// explicit, present-but-empty Grants list is well-formed and simply
		// authorizes no combination — handled by the loop below producing
		// an empty, non-nil combination.)
		return nil, false
	}

	seen := make(map[string]bool, len(scope.Grants))
	combination := make([]string, 0, len(scope.Grants))
	for _, g := range scope.Grants {
		if g.Action != ScopeActionComputeWith {
			continue // ScopeActionDiscloseTo entries are not combination consent (property 4)
		}
		if !presentRefs[g.Party] {
			return nil, false // names a party this request never carried
		}
		if seen[g.Party] {
			return nil, false // duplicate — would double-count in the aggregate
		}
		seen[g.Party] = true
		combination = append(combination, g.Party)
	}
	return combination, true
}

// isDiscloseAuthorized: property 4's SECOND, wholly independent check —
// never derived from resolveAuthorizedCombination's ComputeWith result.
// True iff scope explicitly grants ScopeActionDiscloseTo from subject to
// recipient.
func isDiscloseAuthorized(grants []ScopeGrant, subject, recipient string) bool {
	for _, g := range grants {
		if g.Action == ScopeActionDiscloseTo && g.Party == subject && g.To == recipient {
			return true
		}
	}
	return false
}

// evaluateCombinedInputs computes ONE joint verdict for a GROUP of parties'
// ProjectionInputs that resolveAuthorizedCombination has ALREADY confirmed
// are authorized to be combined for this exact actionRef — this function
// must never be reached with an unauthorized set (see
// TestMultiParty_UnauthorizedCombinationNeverAffectsVerdict).
//
// Reuses the SAME fail-closed numeric discipline as evaluateSingleParty
// (absent/negative/overflow => UNRESOLVED), generalized across N
// contributors: the aggregate proposed spend and exposure are summed, and
// the combination is ACCEPTABLE only if the aggregate respects EVERY
// contributing party's OWN private limits — the most conservative
// combination rule, modelling e.g. a shared/pooled exposure that must clear
// every participant's own risk tolerance, not merely one. This is a
// minimal, deterministic REFERENCE joint-projection; the real Use Case Zero
// business formula is Phase 11's job — this function's purpose is to prove
// the AUTHORIZATION MECHANISM around combination, not to be the final
// formula.
func evaluateCombinedInputs(group []ProjectionInputs) string {
	if len(group) == 0 {
		return VerdictUnresolved
	}

	var totalExposure, totalSpend int64
	for _, in := range group {
		if in.CurrentExposure == nil || in.ProposedSpend == nil ||
			in.PrivateSpendLimit == nil || in.PrivateRiskLimit == nil {
			return VerdictUnresolved
		}
		exposure := *in.CurrentExposure
		spend := *in.ProposedSpend
		if exposure < 0 || spend < 0 || *in.PrivateSpendLimit < 0 || *in.PrivateRiskLimit < 0 {
			return VerdictUnresolved
		}
		if totalExposure > 0 && exposure > (1<<62)-totalExposure {
			return VerdictUnresolved
		}
		totalExposure += exposure
		if totalSpend > 0 && spend > (1<<62)-totalSpend {
			return VerdictUnresolved
		}
		totalSpend += spend
	}

	if totalExposure > 0 && totalSpend > (1<<62)-totalExposure {
		return VerdictUnresolved
	}
	combined := totalExposure + totalSpend

	for _, in := range group {
		if totalSpend > *in.PrivateSpendLimit || combined > *in.PrivateRiskLimit {
			return VerdictUnacceptable
		}
	}
	return VerdictAcceptable
}

func containsString(list []string, target string) bool {
	for _, s := range list {
		if s == target {
			return true
		}
	}
	return false
}

// chooseVerdictForRecipient implements property 4 (use ≠ reveal): a
// recipient's own event carries the JOINT verdict only when (a) they were
// validly combined (ComputeWith, resolveAuthorizedCombination) AND (b) for
// EVERY OTHER member of that combination, an explicit DiscloseTo grant names
// this recipient (isDiscloseAuthorized) — a wholly separate check, never
// derived from (a). Otherwise — the default — they receive ONLY the
// verdict computed from their OWN ProjectionInputs alone, never anything
// derived from another party's data.
func chooseVerdictForRecipient(ref string, grants []ScopeGrant, combination []string, haveJoint bool, jointVerdict string, own ProjectionInputs) string {
	if haveJoint && containsString(combination, ref) {
		fullyDisclosed := true
		for _, other := range combination {
			if other == ref {
				continue
			}
			if !isDiscloseAuthorized(grants, other, ref) {
				fullyDisclosed = false
				break
			}
		}
		if fullyDisclosed {
			return jointVerdict
		}
	}
	return evaluateSingleParty(own)
}

// combineInputsFn is the ONLY place in this file that ever reads more than
// one party's ProjectionInputs into one shared computation. It is a
// package-level variable (not a plain function call) SOLELY so a test can
// install a probe recording whether/when it is invoked, PROVING —
// end-to-end, by direct observation rather than inference from the final
// verdict — that authorization runs strictly before any cross-party data
// access (property 1; see TestMultiParty_NoCoalescingBeforeAuthorization).
// Production code (evaluateMultiParty) must never reassign it; only tests
// do, always restoring the original via defer.
var combineInputsFn = evaluateCombinedInputs

// evaluateMultiParty is the ORCHESTRATOR. It calls the authorization gate
// FIRST (property 1) and reads more than one party's ProjectionInputs
// together (via combineInputsFn) ONLY after that gate has returned an
// authorized set of at least two refs for exactly this request's context.
func evaluateMultiParty(scope MultiPartyDisclosureScope, ctx multiPartyRequestContext, inputs MultiPartyProjectionInputs) map[string]string {
	presentRefs := make(map[string]bool, len(inputs))
	for ref := range inputs {
		presentRefs[ref] = true
	}

	combination, ok := resolveAuthorizedCombination(scope, ctx, presentRefs)
	if !ok {
		results := make(map[string]string, len(inputs))
		for ref := range inputs {
			results[ref] = VerdictUnresolved
		}
		return results
	}

	var jointVerdict string
	// A "combination" of fewer than two members has no cross-party join to
	// perform (mathematically identical to evaluateSingleParty on that one
	// member) — treat only a genuine multi-member combination as "joint".
	haveJoint := len(combination) >= 2
	if haveJoint {
		// The ONLY place in this file where more than one party's
		// ProjectionInputs are read into one shared computation — reached
		// ONLY after resolveAuthorizedCombination has confirmed
		// authorization for EXACTLY this set, for EXACTLY this request's
		// bound context.
		group := make([]ProjectionInputs, 0, len(combination))
		for _, ref := range combination {
			group = append(group, inputs[ref].Inputs)
		}
		jointVerdict = combineInputsFn(group)
	}

	results := make(map[string]string, len(inputs))
	for ref, contribution := range inputs {
		results[ref] = chooseVerdictForRecipient(ref, scope.Grants, combination, haveJoint, jointVerdict, contribution.Inputs)
	}
	return results
}

// plainVerdictEvent builds the ENTIRE result surface for one recipient — one
// field, no operands, exactly like the single-party VerdictEvent (rule 3 of
// the single-party header, extended to every multi-party recipient).
func plainVerdictEvent(addr types.Address, verdict string) types.PlainEvent {
	data, err := json.Marshal(VerdictEvent{Verdict: verdict})
	if err != nil {
		// json.Marshal of a single-string-field struct cannot fail in
		// practice; degrade to UNRESOLVED rather than emit malformed bytes.
		data, _ = json.Marshal(VerdictEvent{Verdict: VerdictUnresolved})
	}
	return types.PlainEvent{UserID: addr, Data: data}
}

// buildMultiPartyEvents is ProcessRequest's entry point for a multi-party
// payload. Total and never errors, mirroring project()'s own contract: any
// malformation resolves to UNRESOLVED rather than types.ProcessResult{Error:
// ...} (single-party rule 2, extended here).
//
// appID is the CURRENT guest's own applicationId (from the platform-supplied
// state, never from the payload) — the anchor half of the scope-binding
// check (property 5); sender is used ONLY as the fallback delivery target
// below and is NEVER passed into resolveAuthorizedCombination/
// evaluateMultiParty (property 2's structural proof).
//
// Event order is made DETERMINISTIC by sorting on namespace ref before
// building the slice — this guest's output must be reproducible across
// independent executions (map iteration order in Go is not), and ordering
// carries no authorization meaning of its own.
func buildMultiPartyEvents(sender types.Address, appID uint64, payloadJSON string) []types.PlainEvent {
	var req MultiPartyProjectionRequest
	if err := json.Unmarshal([]byte(payloadJSON), &req); err != nil ||
		req.Type != multiPartyProjectionRequestType || len(req.Inputs) == 0 {
		// Cannot identify any party to address a reply to (sender is
		// routing information only, used here purely as a fallback delivery
		// target, never as authority over anyone's data). A single
		// UNRESOLVED verdict addressed to the technical sender is the
		// honest, safe response to an unidentifiable multi-party request —
		// never omit a reply, never guess at a party. This also covers
		// "malformed JSON in the scope field": a scope value of the wrong
		// JSON type fails the WHOLE request's unmarshal, landing here,
		// before any cross-party access is even possible (property 6).
		return []types.PlainEvent{plainVerdictEvent(sender, VerdictUnresolved)}
	}

	ctx := multiPartyRequestContext{
		ApplicationID: strconv.FormatUint(appID, 10),
		RequestRef:    req.RequestRef,
	}
	verdicts := evaluateMultiParty(req.Scope, ctx, req.Inputs)

	refs := make([]string, 0, len(req.Inputs))
	for ref := range req.Inputs {
		refs = append(refs, ref)
	}
	sort.Strings(refs)

	events := make([]types.PlainEvent, 0, len(refs))
	for _, ref := range refs {
		events = append(events, plainVerdictEvent(req.Inputs[ref].RecipientAddress, verdicts[ref]))
	}
	return events
}
