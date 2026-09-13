package app

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/HorizenOfficial/vela-common-go/wasm/types"
)

// ── Fixtures ────────────────────────────────────────────────────────────
//
// Chosen so that:
//   - EACH party's own STANDALONE verdict (evaluateSingleParty) is
//     ACCEPTABLE (spend 800 <= limit 1000; exposure+spend 800 <= limit 1000).
//   - The JOINT verdict for {A, B} combined is UNACCEPTABLE (totalSpend 1600
//     > either party's own spendLimit 1000).
//
// This "verdict flips when (and only when) a genuine combination happens
// AND is disclosed" property is what makes the tests below a real proof
// rather than a coincidence: ACCEPTABLE on a recipient's own event proves no
// combination reached them; UNACCEPTABLE proves the joint computation was
// reached AND disclosed to them specifically.

func partyAInputs() ProjectionInputs {
	exposure, spend, spendLimit, riskLimit := int64(0), int64(800), int64(1000), int64(1000)
	return ProjectionInputs{CurrentExposure: &exposure, ProposedSpend: &spend, PrivateSpendLimit: &spendLimit, PrivateRiskLimit: &riskLimit}
}

func partyBInputs() ProjectionInputs {
	exposure, spend, spendLimit, riskLimit := int64(0), int64(800), int64(1000), int64(1000)
	return ProjectionInputs{CurrentExposure: &exposure, ProposedSpend: &spend, PrivateSpendLimit: &spendLimit, PrivateRiskLimit: &riskLimit}
}

func addr(b byte) types.Address {
	var a types.Address
	a[len(a)-1] = b
	return a
}

func twoPartyInputs() MultiPartyProjectionInputs {
	return MultiPartyProjectionInputs{
		"partyA": {RecipientAddress: addr(0xA1), Inputs: partyAInputs()},
		"partyB": {RecipientAddress: addr(0xB2), Inputs: partyBInputs()},
	}
}

// validBinding is the ONE binding that legitimately matches ctxOne (below).
func validBinding() ScopeBinding {
	return ScopeBinding{
		ApplicationID: "1",
		RequestRef:    "request-1",
		OperationType: multiPartyOperationJointConsequenceProjection,
		OutputClass:   multiPartyOutputClassJointVerdict,
	}
}

func ctxOne() multiPartyRequestContext {
	return multiPartyRequestContext{ApplicationID: "1", RequestRef: "request-1"}
}

func computeWithGrant(party string) ScopeGrant {
	return ScopeGrant{Action: ScopeActionComputeWith, Party: party}
}

func discloseToGrant(party, to string) ScopeGrant {
	return ScopeGrant{Action: ScopeActionDiscloseTo, Party: party, To: to}
}

// fullyAuthorizedScope: A and B both consent to combine, and both are
// granted disclosure of the joint verdict.
func fullyAuthorizedScope() MultiPartyDisclosureScope {
	return MultiPartyDisclosureScope{
		Binding: validBinding(),
		Grants: []ScopeGrant{
			computeWithGrant("partyA"),
			computeWithGrant("partyB"),
			discloseToGrant("partyB", "partyA"), // A may see evidence derived from B
			discloseToGrant("partyA", "partyB"), // B may see evidence derived from A
		},
	}
}

// ── Property 1: authorization runs strictly before any cross-party read ──

// TestMultiParty_AuthorizationGateNeverReceivesPrivateInputs proves, by the
// gate function's OWN TYPE SIGNATURE, that resolveAuthorizedCombination
// cannot read, combine, or leak any party's ProjectionInputs: it is called
// here with ONLY namespace refs, binding strings, and a presence set — no
// ProjectionInputs value exists anywhere in this test — and still makes the
// correct authorization decisions.
func TestMultiParty_AuthorizationGateNeverReceivesPrivateInputs(t *testing.T) {
	present := map[string]bool{"partyA": true, "partyB": true}
	ctx := ctxOne()

	// Ambiguous: Grants omitted (nil).
	if _, ok := resolveAuthorizedCombination(MultiPartyDisclosureScope{Binding: validBinding()}, ctx, present); ok {
		t.Fatal("expected ok=false for omitted Grants on a 2-party request")
	}

	// Well-formed, explicit "no one combines".
	scopeNoGrants := MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{}}
	combo, ok := resolveAuthorizedCombination(scopeNoGrants, ctx, present)
	if !ok || len(combo) != 0 {
		t.Fatalf("expected ok=true, empty combination; got ok=%v combo=%v", ok, combo)
	}

	// Well-formed, explicit combination of both via ComputeWith grants.
	scopeBoth := MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{computeWithGrant("partyA"), computeWithGrant("partyB")}}
	combo, ok = resolveAuthorizedCombination(scopeBoth, ctx, present)
	if !ok || len(combo) != 2 {
		t.Fatalf("expected ok=true, 2-party combination; got ok=%v combo=%v", ok, combo)
	}

	// DiscloseTo grants alone never authorize combination (property 4).
	scopeDiscloseOnly := MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{discloseToGrant("partyA", "partyB")}}
	combo, ok = resolveAuthorizedCombination(scopeDiscloseOnly, ctx, present)
	if !ok || len(combo) != 0 {
		t.Fatalf("a DiscloseTo grant must never itself authorize combination; got ok=%v combo=%v", ok, combo)
	}

	// Malformed: names a party absent from the request.
	if _, ok := resolveAuthorizedCombination(MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{computeWithGrant("partyC")}}, ctx, present); ok {
		t.Fatal("expected ok=false for a combination naming an absent party")
	}

	// Malformed: duplicate ComputeWith entry.
	if _, ok := resolveAuthorizedCombination(MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{computeWithGrant("partyA"), computeWithGrant("partyA")}}, ctx, present); ok {
		t.Fatal("expected ok=false for a duplicate combination entry")
	}

	// Degenerate: at most one party present — never ambiguous, no binding
	// check even needed.
	combo, ok = resolveAuthorizedCombination(MultiPartyDisclosureScope{}, multiPartyRequestContext{}, map[string]bool{"partyA": true})
	if !ok || combo != nil {
		t.Fatalf("expected ok=true, nil combination for a single-party set; got ok=%v combo=%v", ok, combo)
	}
}

// ── Property 1, end-to-end: NO PRE-AUTHORIZATION COALESCING ──
//
// TestMultiParty_NoCoalescingBeforeAuthorization is the DIRECT proof the
// operator required: not merely that the final verdict is correct, but that
// the function which reads more than one party's ProjectionInputs into a
// shared computation (combineInputsFn) is PROVABLY NEVER INVOKED when
// authorization is denied or grants no combination — and is invoked EXACTLY
// ONCE, with EXACTLY the authorized group, when it legitimately is. This
// shows the actual "memory shape" of processing: absent authorization, the
// two parties' ProjectionInputs never coexist in any variable this file
// constructs.
func TestMultiParty_NoCoalescingBeforeAuthorization(t *testing.T) {
	original := combineInputsFn
	var invocations int
	var capturedGroup []ProjectionInputs
	combineInputsFn = func(group []ProjectionInputs) string {
		invocations++
		capturedGroup = group
		return original(group)
	}
	defer func() { combineInputsFn = original }()

	inputs := twoPartyInputs()

	t.Run("denial: ambiguous scope never triggers coalescing", func(t *testing.T) {
		invocations = 0
		_ = evaluateMultiParty(MultiPartyDisclosureScope{}, ctxOne(), inputs)
		if invocations != 0 {
			t.Fatalf("combineInputsFn invoked %d times; must be 0 when authorization is denied", invocations)
		}
	})

	t.Run("denial: well-formed scope authorizing NO combination never triggers coalescing", func(t *testing.T) {
		invocations = 0
		scope := MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{}}
		_ = evaluateMultiParty(scope, ctxOne(), inputs)
		if invocations != 0 {
			t.Fatalf("combineInputsFn invoked %d times; must be 0 when Grants authorizes nothing", invocations)
		}
	})

	t.Run("approval: coalescing happens exactly once, with exactly the authorized group", func(t *testing.T) {
		invocations = 0
		capturedGroup = nil
		scope := fullyAuthorizedScope()
		_ = evaluateMultiParty(scope, ctxOne(), inputs)
		if invocations != 1 {
			t.Fatalf("combineInputsFn invoked %d times; want exactly 1 for an authorized 2-party combination", invocations)
		}
		if len(capturedGroup) != 2 {
			t.Fatalf("expected the combined group to contain exactly the 2 authorized parties' inputs, got %d", len(capturedGroup))
		}
	})
}

// TestMultiParty_UnauthorizedCombinationNeverAffectsVerdict is the
// behavioral companion: with NO authorization to combine, each party's
// verdict equals EXACTLY their own standalone verdict (ACCEPTABLE per the
// fixtures) — never the joint UNACCEPTABLE verdict that would result if
// their data had been wrongly combined.
func TestMultiParty_UnauthorizedCombinationNeverAffectsVerdict(t *testing.T) {
	inputs := twoPartyInputs()
	scope := MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{}}

	results := evaluateMultiParty(scope, ctxOne(), inputs)
	if results["partyA"] != VerdictAcceptable {
		t.Fatalf("partyA verdict = %s, want %s (own standalone, unaffected by any combination)", results["partyA"], VerdictAcceptable)
	}
	if results["partyB"] != VerdictAcceptable {
		t.Fatalf("partyB verdict = %s, want %s (own standalone, unaffected by any combination)", results["partyB"], VerdictAcceptable)
	}

	// Fixture sanity check: these inputs WOULD flip to UNACCEPTABLE if
	// actually combined — otherwise this test would pass trivially.
	if got := evaluateCombinedInputs([]ProjectionInputs{partyAInputs(), partyBInputs()}); got != VerdictUnacceptable {
		t.Fatalf("fixture sanity check failed: combined verdict = %s, want %s", got, VerdictUnacceptable)
	}
}

// ── Property 2: sender address alone never grants namespace authority ──

// TestSenderAddressAloneNeverGrantsNamespaceAuthority: `sender` is not even
// a parameter to resolveAuthorizedCombination/evaluateMultiParty, so it is
// structurally incapable of influencing authorization. This test confirms
// that OBSERVABLY: two otherwise-identical requests, submitted by two
// DIFFERENT senders — one of which happens to equal partyB's own on-chain
// recipient address — produce IDENTICAL results.
func TestSenderAddressAloneNeverGrantsNamespaceAuthority(t *testing.T) {
	state := `{"appId":1,"projectionsHandled":0}`
	inputs := twoPartyInputs()
	// No authorization granted at all.
	scope := MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{}}
	req := MultiPartyProjectionRequest{Type: multiPartyProjectionRequestType, RequestRef: "request-1", Inputs: inputs, Scope: scope}
	b, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal fixture request: %v", err)
	}
	payload := string(b)

	senderIsPartyB := inputs["partyB"].RecipientAddress // sender happens to equal a party's own address
	senderArbitrary := addr(0xFF)

	res1 := ProcessRequest(&senderIsPartyB, 1, payload, state)
	res2 := ProcessRequest(&senderArbitrary, 1, payload, state)

	decode := func(res types.ProcessResult) map[types.Address]string {
		out := map[types.Address]string{}
		for _, ev := range res.Events {
			var d map[string]any
			if err := json.Unmarshal(ev.Data, &d); err != nil {
				t.Fatalf("event data not JSON: %v", err)
			}
			v, _ := d["verdict"].(string)
			out[ev.UserID] = v
		}
		return out
	}
	v1, v2 := decode(res1), decode(res2)
	if len(v1) != 2 || len(v2) != 2 {
		t.Fatalf("expected 2 recipient verdicts each; got %d and %d", len(v1), len(v2))
	}
	for a, verdict := range v1 {
		if v2[a] != verdict {
			t.Fatalf("sender identity changed the outcome for recipient %s: %q vs %q — sender must never grant namespace authority", a.Hex(), verdict, v2[a])
		}
		if verdict != VerdictAcceptable {
			t.Fatalf("expected own-standalone ACCEPTABLE (no scope authorized anything); got %s for %s", verdict, a.Hex())
		}
	}
}

// ── Property 4: use ≠ reveal ──

func TestMultiParty_DisclosureIsSeparateFromCombinationConsent(t *testing.T) {
	inputs := twoPartyInputs()

	t.Run("legitimate combination with full disclosure reaches both parties", func(t *testing.T) {
		results := evaluateMultiParty(fullyAuthorizedScope(), ctxOne(), inputs)
		if results["partyA"] != VerdictUnacceptable {
			t.Fatalf("partyA verdict = %s, want joint verdict %s", results["partyA"], VerdictUnacceptable)
		}
		if results["partyB"] != VerdictUnacceptable {
			t.Fatalf("partyB verdict = %s, want joint verdict %s", results["partyB"], VerdictUnacceptable)
		}
	})

	t.Run("ComputeWith granted for both, DiscloseTo granted for only one direction", func(t *testing.T) {
		scope := MultiPartyDisclosureScope{
			Binding: validBinding(),
			Grants: []ScopeGrant{
				computeWithGrant("partyA"),
				computeWithGrant("partyB"),
				discloseToGrant("partyB", "partyA"), // only: A may see evidence derived from B
				// NOTE: no grant disclosing A's evidence to B.
			},
		}
		results := evaluateMultiParty(scope, ctxOne(), inputs)
		if results["partyA"] != VerdictUnacceptable {
			t.Fatalf("partyA verdict = %s, want joint verdict %s (partyA IS authorized for disclosure)", results["partyA"], VerdictUnacceptable)
		}
		if results["partyB"] != VerdictAcceptable {
			t.Fatalf("partyB verdict = %s, want OWN standalone verdict %s (partyB is NOT authorized for disclosure, even though validly combined — USE != REVEAL)", results["partyB"], VerdictAcceptable)
		}
	})

	t.Run("ComputeWith alone (no DiscloseTo grants at all) never implies disclosure to anyone", func(t *testing.T) {
		scope := MultiPartyDisclosureScope{
			Binding: validBinding(),
			Grants:  []ScopeGrant{computeWithGrant("partyA"), computeWithGrant("partyB")},
		}
		results := evaluateMultiParty(scope, ctxOne(), inputs)
		if results["partyA"] != VerdictAcceptable || results["partyB"] != VerdictAcceptable {
			t.Fatalf("expected both parties to receive their OWN standalone verdicts absent any DiscloseTo grant; got A=%s B=%s", results["partyA"], results["partyB"])
		}
	})
}

// ── Property 5: scope binding rejects a mismatched context ──

func TestMultiParty_ScopeBindingRejectsMismatchedContext(t *testing.T) {
	present := map[string]bool{"partyA": true, "partyB": true}
	grants := []ScopeGrant{computeWithGrant("partyA"), computeWithGrant("partyB")}

	base := validBinding()
	ctx := ctxOne()

	cases := []struct {
		name    string
		binding ScopeBinding
	}{
		{"mismatched applicationId", ScopeBinding{ApplicationID: "2", RequestRef: base.RequestRef, OperationType: base.OperationType, OutputClass: base.OutputClass}},
		{"mismatched requestRef", ScopeBinding{ApplicationID: base.ApplicationID, RequestRef: "request-OTHER", OperationType: base.OperationType, OutputClass: base.OutputClass}},
		{"mismatched operationType", ScopeBinding{ApplicationID: base.ApplicationID, RequestRef: base.RequestRef, OperationType: "some_other_operation", OutputClass: base.OutputClass}},
		{"mismatched outputClass", ScopeBinding{ApplicationID: base.ApplicationID, RequestRef: base.RequestRef, OperationType: base.OperationType, OutputClass: "some_other_output_class"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			scope := MultiPartyDisclosureScope{Binding: c.binding, Grants: grants}
			if _, ok := resolveAuthorizedCombination(scope, ctx, present); ok {
				t.Fatalf("expected rejection for %s", c.name)
			}
		})
	}

	// Sanity: the SAME grants with the CORRECT binding are accepted.
	if _, ok := resolveAuthorizedCombination(MultiPartyDisclosureScope{Binding: base, Grants: grants}, ctx, present); !ok {
		t.Fatal("expected the correctly-bound scope to be accepted")
	}
}

// ── Property 5: non-transitivity ──
//
// A scope valid for (A, B, request-1) must NOT authorize (A, C), (B, C), or
// even a LATER (A, B) request with a different RequestRef.
func TestMultiParty_NonTransitivity(t *testing.T) {
	scopeAB := fullyAuthorizedScope() // bound to request-1, grants for A+B only
	ctxRequest1 := ctxOne()
	ctxRequest2 := multiPartyRequestContext{ApplicationID: "1", RequestRef: "request-2"}

	t.Run("reused against (A, C) — B absent from the new request", func(t *testing.T) {
		inputsAC := map[string]bool{"partyA": true, "partyC": true}
		if _, ok := resolveAuthorizedCombination(scopeAB, ctxRequest1, inputsAC); ok {
			t.Fatal("a scope naming B must not authorize a request that never carries B")
		}
	})

	t.Run("reused against (B, C) — A absent from the new request", func(t *testing.T) {
		inputsBC := map[string]bool{"partyB": true, "partyC": true}
		if _, ok := resolveAuthorizedCombination(scopeAB, ctxRequest1, inputsBC); ok {
			t.Fatal("a scope naming A must not authorize a request that never carries A")
		}
	})

	t.Run("reused against a LATER (A, B) request with a different RequestRef", func(t *testing.T) {
		inputsAB := map[string]bool{"partyA": true, "partyB": true}
		if _, ok := resolveAuthorizedCombination(scopeAB, ctxRequest2, inputsAB); ok {
			t.Fatal("a scope bound to request-1 must not authorize a later request-2, even with the same parties")
		}
	})

	t.Run("the ORIGINAL context still authorizes correctly (not a blanket lockout)", func(t *testing.T) {
		inputsAB := map[string]bool{"partyA": true, "partyB": true}
		combo, ok := resolveAuthorizedCombination(scopeAB, ctxRequest1, inputsAB)
		if !ok || len(combo) != 2 {
			t.Fatalf("expected the original, correctly-bound request to still authorize; got ok=%v combo=%v", ok, combo)
		}
	})
}

// ── Property 6: exhaustive failure semantics — five distinct failure modes ──

func multiPartyPayload(t *testing.T, requestRef string, scope MultiPartyDisclosureScope, inputs MultiPartyProjectionInputs) string {
	t.Helper()
	req := MultiPartyProjectionRequest{
		Type:       multiPartyProjectionRequestType,
		RequestRef: requestRef,
		Inputs:     inputs,
		Scope:      scope,
	}
	b, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal fixture request: %v", err)
	}
	return string(b)
}

func assertAllUnresolved(t *testing.T, res types.ProcessResult, wantCount int) {
	t.Helper()
	if res.Error != "" {
		t.Fatalf("unexpected error: %s", res.Error)
	}
	if len(res.Events) != wantCount {
		t.Fatalf("expected %d PlainEvents, got %d", wantCount, len(res.Events))
	}
	for _, ev := range res.Events {
		var d map[string]any
		if err := json.Unmarshal(ev.Data, &d); err != nil {
			t.Fatalf("event data not JSON: %v", err)
		}
		if d["verdict"] != VerdictUnresolved {
			t.Fatalf("recipient %s verdict = %v, want %s", ev.UserID.Hex(), d["verdict"], VerdictUnresolved)
		}
	}
}

// Failure mode 1/5: malformed JSON in the scope field itself.
func TestMultiParty_FailureMode_MalformedScopeJSON(t *testing.T) {
	sender := addr(0x01)
	state := `{"appId":1,"projectionsHandled":0}`
	// "scope" is a string, not an object — the WHOLE request fails to
	// unmarshal, so this is caught before any cross-party access is even
	// possible.
	payload := `{"type":"confidential_multi_party_consequence_projection","requestRef":"request-1","inputs":{"partyA":{"recipientAddress":"0x000000000000000000000000000000000000a001","inputs":{"currentExposure":0,"proposedSpend":800,"privateSpendLimit":1000,"privateRiskLimit":1000}},"partyB":{"recipientAddress":"0x000000000000000000000000000000000000b002","inputs":{"currentExposure":0,"proposedSpend":800,"privateSpendLimit":1000,"privateRiskLimit":1000}}},"scope":"not-an-object"}`

	res := ProcessRequest(&sender, 1, payload, state)
	// Malformed top-level JSON falls back to a single UNRESOLVED event
	// addressed to sender (buildMultiPartyEvents' own fallback branch).
	assertAllUnresolved(t, res, 1)
}

// Failure mode 2/5: scope omitted entirely.
func TestMultiParty_FailureMode_MissingScopeEntirely(t *testing.T) {
	sender := addr(0x01)
	state := `{"appId":1,"projectionsHandled":0}`
	payload := `{"type":"confidential_multi_party_consequence_projection","requestRef":"request-1","inputs":{"partyA":{"recipientAddress":"0x000000000000000000000000000000000000a001","inputs":{"currentExposure":0,"proposedSpend":800,"privateSpendLimit":1000,"privateRiskLimit":1000}},"partyB":{"recipientAddress":"0x000000000000000000000000000000000000b002","inputs":{"currentExposure":0,"proposedSpend":800,"privateSpendLimit":1000,"privateRiskLimit":1000}}}}`

	res := ProcessRequest(&sender, 1, payload, state)
	assertAllUnresolved(t, res, 2)
}

// Failure mode 3/5: scope binding does not match the current request (stale).
func TestMultiParty_FailureMode_StaleBindingMismatch(t *testing.T) {
	sender := addr(0x01)
	state := `{"appId":1,"projectionsHandled":0}`
	inputs := twoPartyInputs()
	scope := fullyAuthorizedScope() // bound to applicationId "1", requestRef "request-1"
	// Submitted as request-2 — the scope's binding no longer matches.
	payload := multiPartyPayload(t, "request-2", scope, inputs)

	res := ProcessRequest(&sender, 1, payload, state)
	assertAllUnresolved(t, res, 2)
}

// Failure mode 4/5: unrecognized operation type.
func TestMultiParty_FailureMode_UnrecognizedOperationType(t *testing.T) {
	sender := addr(0x01)
	state := `{"appId":1,"projectionsHandled":0}`
	inputs := twoPartyInputs()
	scope := fullyAuthorizedScope()
	scope.Binding.OperationType = "some_other_operation"
	payload := multiPartyPayload(t, "request-1", scope, inputs)

	res := ProcessRequest(&sender, 1, payload, state)
	assertAllUnresolved(t, res, 2)
}

// Failure mode 5/5: unrecognized output class.
func TestMultiParty_FailureMode_UnrecognizedOutputClass(t *testing.T) {
	sender := addr(0x01)
	state := `{"appId":1,"projectionsHandled":0}`
	inputs := twoPartyInputs()
	scope := fullyAuthorizedScope()
	scope.Binding.OutputClass = "some_other_output_class"
	payload := multiPartyPayload(t, "request-1", scope, inputs)

	res := ProcessRequest(&sender, 1, payload, state)
	assertAllUnresolved(t, res, 2)
}

// The ambiguous-but-not-malformed case (Grants omitted) — distinct from the
// five failure modes above (which are all malformed/mismatched); this is
// the "the caller never addressed combination at all" ambiguity (property
// 6's other half).
func TestMultiParty_AmbiguousScopeResolvesEveryPartyUnresolved(t *testing.T) {
	inputs := twoPartyInputs()

	cases := []struct {
		name  string
		scope MultiPartyDisclosureScope
	}{
		{"Grants omitted entirely", MultiPartyDisclosureScope{Binding: validBinding()}},
		{"combination names an absent party", MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{computeWithGrant("partyA"), computeWithGrant("partyZ")}}},
		{"combination has a duplicate", MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{computeWithGrant("partyA"), computeWithGrant("partyA")}}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			results := evaluateMultiParty(c.scope, ctxOne(), inputs)
			if len(results) != 2 {
				t.Fatalf("expected a verdict for every party present, got %d", len(results))
			}
			for ref, verdict := range results {
				if verdict != VerdictUnresolved {
					t.Fatalf("%s verdict = %s, want UNRESOLVED (never a silently-computed verdict, never a dropped party)", ref, verdict)
				}
			}
		})
	}
}

// ── End-to-end through the real ProcessRequest entry point ──

func TestProcessRequestMultiParty_LegitimateCombinationDeliversPerPartyEvents(t *testing.T) {
	sender := addr(0x01)
	state := `{"appId":1,"projectionsHandled":0}`
	inputs := twoPartyInputs()
	payload := multiPartyPayload(t, "request-1", fullyAuthorizedScope(), inputs)

	res := ProcessRequest(&sender, 1, payload, state)
	if res.Error != "" {
		t.Fatalf("unexpected error: %s", res.Error)
	}
	if len(res.AppEvents) != 0 {
		t.Fatalf("expected 0 AppEvents (single-party rule 1), got %d", len(res.AppEvents))
	}
	if len(res.Withdrawals) != 0 {
		t.Fatalf("a projector must never move funds; got %d withdrawals", len(res.Withdrawals))
	}
	if len(res.Events) != 2 {
		t.Fatalf("expected exactly 2 PlainEvents (one per party), got %d", len(res.Events))
	}

	byRecipient := map[types.Address]string{}
	for _, ev := range res.Events {
		var decoded map[string]any
		if err := json.Unmarshal(ev.Data, &decoded); err != nil {
			t.Fatalf("event data not JSON: %v", err)
		}
		if len(decoded) != 1 {
			t.Fatalf("verdict event must carry exactly one field, got %d: %v", len(decoded), decoded)
		}
		v, _ := decoded["verdict"].(string)
		byRecipient[ev.UserID] = v

		// No operand leakage, mirroring TestProcessRequestEmitsOnlyACoarseVerdict.
		blob := string(ev.Data)
		for _, forbidden := range []string{"800", "1000", "currentExposure", "proposedSpend", "privateSpendLimit", "privateRiskLimit", "partyA", "partyB"} {
			if strings.Contains(blob, forbidden) {
				t.Fatalf("verdict event leaks %q: %s", forbidden, blob)
			}
		}
	}

	if byRecipient[inputs["partyA"].RecipientAddress] != VerdictUnacceptable {
		t.Fatalf("partyA's own event = %s, want joint verdict %s", byRecipient[inputs["partyA"].RecipientAddress], VerdictUnacceptable)
	}
	if byRecipient[inputs["partyB"].RecipientAddress] != VerdictUnacceptable {
		t.Fatalf("partyB's own event = %s, want joint verdict %s", byRecipient[inputs["partyB"].RecipientAddress], VerdictUnacceptable)
	}

	var newState ApplicationInternalState
	if err := json.Unmarshal(res.State, &newState); err != nil {
		t.Fatalf("state not parseable: %v", err)
	}
	if newState.ProjectionsHandled != 1 {
		t.Fatalf("projectionsHandled = %d, want 1", newState.ProjectionsHandled)
	}
}

func TestProcessRequestMultiParty_UnauthorizedCombinationYieldsOwnStandaloneVerdicts(t *testing.T) {
	sender := addr(0x01)
	state := `{"appId":1,"projectionsHandled":0}`
	inputs := twoPartyInputs()
	scope := MultiPartyDisclosureScope{Binding: validBinding(), Grants: []ScopeGrant{}}
	payload := multiPartyPayload(t, "request-1", scope, inputs)

	res := ProcessRequest(&sender, 1, payload, state)
	if res.Error != "" {
		t.Fatalf("unexpected error: %s", res.Error)
	}
	if len(res.Events) != 2 {
		t.Fatalf("expected exactly 2 PlainEvents, got %d", len(res.Events))
	}
	for _, ev := range res.Events {
		var decoded map[string]any
		if err := json.Unmarshal(ev.Data, &decoded); err != nil {
			t.Fatalf("event data not JSON: %v", err)
		}
		if decoded["verdict"] != VerdictAcceptable {
			t.Fatalf("recipient %s verdict = %v, want own-standalone %s (never the joint UNACCEPTABLE outcome)", ev.UserID.Hex(), decoded["verdict"], VerdictAcceptable)
		}
	}
}

// The single-party path, reached through the SAME ProcessRequest entry
// point, must remain completely unaffected by the new dispatch — a direct,
// end-to-end companion to app_test.go's own TestProcessRequestEmitsOnlyACoarseVerdict.
func TestProcessRequestSingleParty_UnaffectedByMultiPartyDispatch(t *testing.T) {
	sender := addr(0x01)
	state := `{"appId":1,"projectionsHandled":0}`
	secretInputs := `{"currentBalance":1,"currentExposure":0,"proposedSpend":500,"privateSpendLimit":1000,"privateRiskLimit":5000}`

	res := ProcessRequest(&sender, 1, payload(secretInputs), state)
	if res.Error != "" {
		t.Fatalf("unexpected error: %s", res.Error)
	}
	if len(res.Events) != 1 {
		t.Fatalf("expected exactly 1 PlainEvent for the single-party path, got %d", len(res.Events))
	}
	var decoded map[string]any
	if err := json.Unmarshal(res.Events[0].Data, &decoded); err != nil {
		t.Fatalf("event data not JSON: %v", err)
	}
	if decoded["verdict"] != VerdictAcceptable {
		t.Fatalf("verdict = %v, want %s", decoded["verdict"], VerdictAcceptable)
	}
}
