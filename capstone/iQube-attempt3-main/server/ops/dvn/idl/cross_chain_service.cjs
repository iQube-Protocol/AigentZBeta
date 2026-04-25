// Placeholder IDL for local/dev Express DVN fallback.
// Replace with generated canister IDL when enabling real IC actor calls.
function idlFactory({ IDL }) {
  return IDL.Service({
    submit_dvn_message: IDL.Func([IDL.Nat32, IDL.Nat32, IDL.Vec(IDL.Nat8), IDL.Text], [IDL.Text], []),
    get_dvn_message: IDL.Func([IDL.Text], [IDL.Opt(IDL.Record({ id: IDL.Text }))], ["query"]),
    get_message_attestations: IDL.Func(
      [IDL.Text],
      [IDL.Vec(IDL.Record({ validator: IDL.Text, timestamp: IDL.Nat64 }))],
      ["query"]
    ),
  });
}

module.exports = { idlFactory };
