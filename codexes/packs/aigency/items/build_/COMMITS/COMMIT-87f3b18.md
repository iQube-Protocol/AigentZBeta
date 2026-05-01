# Commit Brief: `87f3b18` — fix NBA action: use source=text_input so inference + thin-client message fire

| Field | Value |
|-------|-------|
| SHA | [`87f3b18`](https://github.com/iQube-Protocol/AigentZBeta/commit/87f3b188cf6643dfff114c0df0caff6afe939485) |
| Author | Claude |
| Date | 2026-04-30T00:56:57Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix NBA action: use source=text_input so inference + thin-client message fire

When the takeover banner's NBA button has targetType='action', the handler
calls handlePrompt(target, { source: "quick_link" }). handlePrompt's
inference gate at line 4090 is:

  const shouldRequestInference =
    !skipInference &&
    (source === "text_input" || (thinShellMode && source !== "menu_action" && source !== "quick_link"));

source="quick_link" makes that resolve to false, so the path early-returns
with persistPersonaMemory only. Two consequences:

  1. INFERENCE_START is never posted to the parent thin-client, so its
     loading affordance (dot animation) never lights up.
  2. The chat agent never runs inference for the action, so the user
     doesn't get the conversational response the NBA implied.

Net effect: clicking NBA feels slow and non-responsive.

NBA actions are semantically "user submitted this in chat" — they should
take the same path as a typed prompt. Switching to source="text_input"
runs inference, posts INFERENCE_START + PROCESSING_START, and produces
the chat reply.

The other two NBA paths (codex / route) intentionally use "quick_link"
because they navigate to a UI surface and shouldn't trigger inference.
This change isolates the action branch only.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

When the takeover banner's NBA button has targetType='action', the handler
calls handlePrompt(target, { source: "quick_link" }). handlePrompt's
inference gate at line 4090 is:

  const shouldRequestInference =
    !skipInference &&
    (source === "text_input" || (thinShellMode && source !== "menu_action" && source !== "quick_link"));

source="quick_link" makes that resolve to false, so the path early-returns
with persistPersonaMemory only. Two consequences:

  1. INFERENCE_START is never posted to the parent thin-client, so its
     loading affordance (dot animation) never lights up.
  2. The chat agent never runs inference for the action, so the user
     doesn't get the conversational response the NBA implied.

Net effect: clicking NBA feels slow and non-responsive.

NBA actions are semantically "user submitted this in chat" — they should
take the same path as a typed prompt. Switching to source="text_input"
runs inference, posts INFERENCE_START + PROCESSING_START, and produces
the chat reply.

The other two NBA paths (codex / route) intentionally use "quick_link"
because they navigate to a UI surface and shouldn't trigger inference.
This change isolates the action branch only.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |

## Stats

 1 file changed, 7 insertions(+), 1 deletion(-)
