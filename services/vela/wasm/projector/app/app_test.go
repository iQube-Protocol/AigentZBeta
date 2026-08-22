package app

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/HorizenOfficial/vela-common-go/wasm/types"
)

func payload(inputs string) string {
	return `{"type":"confidential_consequence_projection","inputs":` + inputs + `,"context":{}}`
}

func TestProjectDispositions(t *testing.T) {
	cases := []struct {
		name   string
		inputs string
		want   string
	}{
		{
			"within both limits",
			`{"currentBalance":10000,"currentExposure":2000,"proposedSpend":500,"privateSpendLimit":1000,"privateRiskLimit":5000}`,
			VerdictAcceptable,
		},
		{
			"spend equals limit is acceptable (boundary is inclusive)",
			`{"currentExposure":0,"proposedSpend":1000,"privateSpendLimit":1000,"privateRiskLimit":1000}`,
			VerdictAcceptable,
		},
		{
			"exceeds spend limit",
			`{"currentExposure":2000,"proposedSpend":4000,"privateSpendLimit":1000,"privateRiskLimit":50000}`,
			VerdictUnacceptable,
		},
		{
			"exceeds risk limit though within spend limit",
			`{"currentExposure":4800,"proposedSpend":500,"privateSpendLimit":1000,"privateRiskLimit":5000}`,
			VerdictUnacceptable,
		},
		{
			// A zero limit is a real limit that forbids all spending — it must
			// not be confused with an absent one.
			"zero spend limit forbids any spend",
			`{"currentExposure":0,"proposedSpend":1,"privateSpendLimit":0,"privateRiskLimit":1000}`,
			VerdictUnacceptable,
		},
		{
			"zero spend against a zero limit is acceptable",
			`{"currentExposure":0,"proposedSpend":0,"privateSpendLimit":0,"privateRiskLimit":0}`,
			VerdictAcceptable,
		},
		{
			// The single most important fail-closed case: a missing limit must
			// never read as "no limit" and project ACCEPTABLE.
			"absent spend limit is unresolved, not unlimited",
			`{"currentExposure":0,"proposedSpend":999999,"privateRiskLimit":1000}`,
			VerdictUnresolved,
		},
		{
			"absent risk limit is unresolved",
			`{"currentExposure":0,"proposedSpend":1,"privateSpendLimit":1000}`,
			VerdictUnresolved,
		},
		{
			"absent proposed spend is unresolved",
			`{"currentExposure":0,"privateSpendLimit":1000,"privateRiskLimit":1000}`,
			VerdictUnresolved,
		},
		{
			"negative values are unresolved, not normalised",
			`{"currentExposure":-1,"proposedSpend":1,"privateSpendLimit":1000,"privateRiskLimit":1000}`,
			VerdictUnresolved,
		},
		{
			// Must not wrap into a small number and read as ACCEPTABLE.
			"overflow-scale inputs are unresolved",
			`{"currentExposure":9223372036854775807,"proposedSpend":9223372036854775807,"privateSpendLimit":9223372036854775807,"privateRiskLimit":9223372036854775807}`,
			VerdictUnresolved,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := project(payload(c.inputs)); got != c.want {
				t.Fatalf("project() = %s, want %s", got, c.want)
			}
		})
	}
}

func TestProjectMalformedInputFailsClosed(t *testing.T) {
	for _, p := range []string{
		"",
		"{}",
		"not json",
		`{"type":"something_else","inputs":{"currentExposure":0,"proposedSpend":1,"privateSpendLimit":9,"privateRiskLimit":9}}`,
		`{"inputs":{"currentExposure":0,"proposedSpend":1,"privateSpendLimit":9,"privateRiskLimit":9}}`,
	} {
		if got := project(p); got != VerdictUnresolved {
			t.Fatalf("project(%q) = %s, want UNRESOLVED", p, got)
		}
	}
}

// The verdict is the entire result surface. If this test's expectations widen,
// the confidentiality guarantee has been weakened.
func TestProcessRequestEmitsOnlyACoarseVerdict(t *testing.T) {
	sender := types.Address{}
	state := `{"appId":1,"projectionsHandled":0}`
	secretInputs := `{"currentBalance":987654,"currentExposure":4800,"proposedSpend":500,"privateSpendLimit":1000,"privateRiskLimit":5000}`

	res := ProcessRequest(&sender, 1, payload(secretInputs), state)
	if res.Error != "" {
		t.Fatalf("unexpected error: %s", res.Error)
	}

	// Rule 1: the verdict travels as an encrypted PlainEvent, never a
	// plaintext AppEvent.
	if len(res.Events) != 1 {
		t.Fatalf("expected exactly 1 PlainEvent, got %d", len(res.Events))
	}
	if len(res.AppEvents) != 0 {
		t.Fatalf("expected 0 AppEvents (an AppEvent publishes the verdict in plaintext), got %d", len(res.AppEvents))
	}
	// Rule 2: an unacceptable projection is a successful result.
	if len(res.Withdrawals) != 0 {
		t.Fatalf("a projector must never move funds; got %d withdrawals", len(res.Withdrawals))
	}

	// Rule 3: exactly one field, and no operand or condition name anywhere.
	var decoded map[string]any
	if err := json.Unmarshal(res.Events[0].Data, &decoded); err != nil {
		t.Fatalf("event data is not JSON: %v", err)
	}
	if len(decoded) != 1 {
		t.Fatalf("verdict event must carry exactly one field, got %d: %v", len(decoded), decoded)
	}
	if decoded["verdict"] != VerdictUnacceptable {
		t.Fatalf("verdict = %v, want %s", decoded["verdict"], VerdictUnacceptable)
	}

	blob := string(res.Events[0].Data)
	for _, forbidden := range []string{
		"987654", "4800", "1000", "5000",
		"currentBalance", "currentExposure", "proposedSpend",
		"privateSpendLimit", "privateRiskLimit",
		"limit", "exposure", "balance", "spend", "risk",
	} {
		if strings.Contains(blob, forbidden) {
			t.Fatalf("verdict event leaks %q: %s", forbidden, blob)
		}
	}
}

func TestProcessRequestRefusesDeanonymization(t *testing.T) {
	sender := types.Address{}
	// requestType 2 = DEANONYMIZATION. This app produces no report, and the
	// Executor rejects a missing report, so it must refuse explicitly.
	res := ProcessRequest(&sender, 2, payload(`{"currentExposure":0,"proposedSpend":1,"privateSpendLimit":9,"privateRiskLimit":9}`), `{"appId":1}`)
	if res.Error == "" {
		t.Fatal("expected an error for a DEANONYMIZATION request")
	}
	if len(res.Report) != 0 {
		t.Fatal("this app must never return a report")
	}
}

func TestProcessRequestMissingSenderIsAnError(t *testing.T) {
	res := ProcessRequest(nil, 1, payload(`{"currentExposure":0,"proposedSpend":1,"privateSpendLimit":9,"privateRiskLimit":9}`), `{"appId":1}`)
	if res.Error == "" {
		t.Fatal("a missing sender is a platform malfunction and must error")
	}
}

func TestDepositIsAcceptedAndInert(t *testing.T) {
	sender := types.Address{}
	token := types.Address{}
	state := `{"appId":1,"projectionsHandled":3}`
	res := DepositFunds(&sender, &token, types.NewUint256(100), state)
	if res.Error != "" {
		t.Fatalf("deposit must not fail a projection request: %s", res.Error)
	}
	if string(res.State) != state {
		t.Fatalf("deposit must not modify state; got %s", res.State)
	}
	if len(res.Events) != 0 || len(res.AppEvents) != 0 {
		t.Fatal("deposit must emit nothing")
	}
}

func TestDeployAndLoadModuleProduceUsableState(t *testing.T) {
	d := Deploy(7, "")
	if d.Error != "" {
		t.Fatalf("deploy error: %s", d.Error)
	}
	var s ApplicationInternalState
	if err := json.Unmarshal(d.State, &s); err != nil {
		t.Fatalf("deploy state not parseable: %v", err)
	}
	if s.AppID != 7 {
		t.Fatalf("appId = %d, want 7", s.AppID)
	}

	l := LoadModule(7)
	if l.Error != "" {
		t.Fatalf("load_module error: %s", l.Error)
	}
	if string(l.State) != string(d.State) {
		t.Fatal("load_module must reproduce the default initial state")
	}
}
