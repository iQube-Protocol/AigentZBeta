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

	verdict := project(payloadJSON)

	state.ProjectionsHandled++
	newState, err := json.Marshal(&state)
	if err != nil {
		return types.ProcessResult{Error: fmt.Sprintf("failed to marshal new state: %v", err)}
	}

	eventData, err := json.Marshal(VerdictEvent{Verdict: verdict})
	if err != nil {
		return types.ProcessResult{Error: fmt.Sprintf("failed to marshal verdict: %v", err)}
	}

	return types.ProcessResult{
		State: newState,
		// PlainEvent (rule 1) — the Executor encrypts Data to the sender's
		// registered P-521 key. EventSubType is left zero so the on-chain
		// indexed topic reveals nothing; if the requester registered a subtype
		// seed, the Executor overrides it with an unlinkable HMAC value.
		Events: []types.PlainEvent{{UserID: sender, Data: eventData}},
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

	in := req.Inputs
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
