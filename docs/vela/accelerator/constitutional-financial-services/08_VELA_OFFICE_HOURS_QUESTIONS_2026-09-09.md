# Vela Office Hours — Technical Clarifications

**For:** Vela technical leads  
**Date:** 9 September 2026  
**Purpose:** Resolve accelerator-build specifics before implementing production assumptions.

## A. Accelerator environment / release

1. **What exact Vela build are accelerator teams expected to target?** Is it the current public docs release, current repository `main`, or a separate closed-beta/accelerator build?

2. **Which deployment environments are actually available to accelerator teams now, and on what timeline?** The masterclass referenced local Docker first, then Base Sepolia and Horizen test deployment, with later mainnet paths. What can we access now?

3. **What is the authoritative status of multi-application support?** Public docs describe one WASM application per environment while the current core repository describes multiple isolated applications. What does the accelerator environment support?

4. **What is the authoritative status of ERC-20 / token allowlist / facilitator support?** Which recently shipped features are supported for accelerator teams versus still under integration?

## B. Nitro / attestation

5. **When can we move our already-working local MoneyPenny WASM/provider into a real Nitro environment?**

6. **What exact attestation evidence should an application verify and retain?** PCR0/PCR1/PCR2, signer identity, AWS certificate chain, nonce/freshness, app/WASM fingerprint, request/output binding?

7. **Which measurement is the canonical production application identity?** The masterclass distinguished PCR0, PCR1 and PCR2. How should an application bind a specific MoneyPenny WASM version to the attested enclave image?

8. **What fields cryptographically bind a signed Vela result to the request, application, prior state and new state?**

9. **What is the recommended external verifier path?** Should our runtime independently verify AWS/Nitro attestation, rely on `TeeAuthenticator`, or retain both on-chain and off-chain evidence?

## C. PCR / upgrade governance

10. **Who controls the trusted PCR update authority in accelerator/testnet/mainnet deployments?**

11. **Can that authority be a multisig, timelock or application-controlled governance address?**

12. **Is there a canonical on-chain history of accepted PCR values and effective versions?**

13. **What is the supported revocation/rollback process after a bad or compromised application image?**

14. **How should private application state migrate across a trusted image/WASM upgrade?**

## D. Application boundary

15. We propose: **metaMe = constitutional plane → MoneyPenny = financial runtime/orchestrator → MoneyPenny Constitutional Consequence & Settlement Kernel = Vela app.** Does this match the Vela team's intended partitioning model?

16. **Can one Vela application safely serve multiple independent organizations/agents with isolated user state and funds?** This matters because we want cohort teams to expose agents/services through MoneyPenny.

17. **If multiple independent service providers use one MoneyPenny app, what are the recommended namespace/state-isolation patterns?**

## E. Guest/runtime constraints

18. **Is no-network access an absolute guest invariant in the accelerator build?**

19. **Are there any supported host functions beyond the documented state/request/event surface?**

20. **What are the practical limits for WASM size, memory, execution duration, private state size and concurrency?**

21. **What TinyGo version/library subset should we pin?**

22. **What determinism pitfalls has the Vela team already encountered in real applications?**

23. **Is the manager polling cadence configurable, and what end-to-end latency should we design for on the accelerator test environment?**

24. **What is the roadmap for the read-only private-state API, and should we avoid designing any dependency on it?**

## F. Private parameters / code visibility

25. **Please confirm the threat model for deployed WASM visibility.** Should we assume the host/operator can inspect the binary?

26. **What is the recommended pattern for proprietary private rules/thresholds?** Constructor state? encrypted application state? per-request parameters? another mechanism?

27. **Are constructor parameters/private initial state ever exposed through deployment metadata, Authority Service or logs?**

## G. Metadata / privacy

28. **Can you provide the authoritative list of public metadata for each request type?** Sender, app ID, request type, token/value, timestamp, event topic, request ID, etc.

29. **How should we use the seeded event-subtype mechanism described in the masterclass to reduce cross-user linkability?**

30. **What metadata privacy improvements are planned, and which should we solve at the application layer today?**

31. **Can requests be submitted through a facilitator in a way that reduces direct sender-address linkage while preserving constitutional attribution outside Vela?**

## H. Authorized disclosure / deanonymization

32. **What exactly does Vela authenticate for a DEANONYMIZATION request?**

33. **Who defines and controls the authorized reporter/auditor role?**

34. **Can the application require its own constitutional authorization/mandate before generating a disclosure report?**

35. **Can disclosure be scoped to specific fields/time windows/purposes rather than a broad state reveal?**

36. **What is retained publicly about the fact that a disclosure report was requested/generated?**

## I. Request semantics / failure / replay

37. **Does the accelerator build support the five opcodes pinned in our repository, including `TRUSTPROCESS` (4), and what are its supported semantics?** `services/vela/velaTypes.ts` already defines `DEPLOYAPP`, `PROCESS`, `DEANONYMIZATION`, `ASSOCIATEKEY`, and `TRUSTPROCESS`. The earlier question treating the fifth opcode as unidentified is superseded.

38. **What are the canonical idempotency/replay guarantees?**

39. **What happens if the manager/enclave/chain fails after request submission but before signed result settlement?**

40. **How should applications reconcile a timeout with a later-completing request?**

41. **What chain-reorg/finality assumptions should we use for request/result receipts?**

## J. State persistence / recovery

42. **How is encrypted application state persisted outside the enclave?**

43. **What keys or sealing mechanism protect state across Nitro restarts?**

44. **What is the disaster-recovery model if an enclave/host is lost?**

45. **How does recovery work after changing the enclave measurement without exposing private state to operators?**

## K. Fuel / economics / settlement

46. **How should an app calculate and expose fuel?**

47. **Which fuel values are developer-selected versus runtime-measured?**

48. **What fee parameters will apply in the accelerator test environment?**

49. **Does a completed Vela request expose enough canonical evidence to attribute confidential-compute cost to a specific service transaction?** We want this for Time-to-Value / Risk / Price research.

50. **What token/settlement assets are supported in the accelerator build?**

## L. Accelerator support / production path

51. **What is the fastest supported path from our existing local Vela provider/WASM to the accelerator test environment?**

52. **What production-readiness criteria will Vela expect before mainnet?**

53. **What security/audit surface does the Vela team recommend independent auditors cover at the application boundary?**

54. **Are there licensing or Early Access terms we need to satisfy before production use of the Vela client libraries/runtime?**

## Strategic closing question

55. **Is there anything in Vela's current architecture that would prevent MoneyPenny from becoming a shared confidential Financial Services Runtime in which multiple independent Horizen/cohort agents contribute services, while Vela executes only the minimum confidential deterministic kernel?**

## Highest-priority questions if time is short

Ask: **1, 2, 3, 5, 6, 10, 15, 16, 25, 28, 37, 51, 55.**


## M. Revised pilot: private multi-party portfolio (priority for office hours)

We propose one app, three private participant accounts and one selectively funded action. MoneyPenny may see the permitted inputs in baseline assembly; contributors must not see each other's private mandates. A-only execution must not consume B/C assets or obligations.

56. Can one coordinator submit inputs from several parties, and what authenticates their individual contribution/consent versus just the submitting key?
57. Can the guest consume several parties' private state in one request? Is state application-scoped, user-scoped or both? What supported mechanism binds input snapshots across those scopes?
58. Can a result contain independently encrypted participant outputs, and how are recipient keys authorized? If not, is runtime-mediated private receipt delivery the recommended baseline?
59. What prevents concurrent requests or replay from applying allocations to stale balances? Is there compare-and-swap or equivalent state sequencing?
60. Are state updates and multi-recipient asset instructions atomic? What happens on partial settlement, timeout, reorg or late completion?
61. What economic isolation does the supported custody/settlement path provide? Can a participant's assets ever collateralize or fund another's action despite separate application accounting?
62. Which aggregate totals, deposits, withdrawals, errors and per-recipient events remain public? Can selective participation or rejection reasons reveal private mandates?
63. How should per-party receipts be verifiably bound to one signed aggregate result without disclosing other outputs? Which commitment/receipt scheme is actually supported?
64. What measured limits apply to a three-party state/schedule with private risk parameters, and can we use a single app without new multi-app infrastructure?

Prioritize **1, 2, 6, 56, 57, 58, 59, 60, 61** for build feasibility; retain the earlier questions as the broader checklist. Record answers with build/version, evidence, owner and affected implementation gate. Missing answers keep those capabilities unresolved; they do not justify inventing an adapter.
