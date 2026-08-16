# Canon II — Personhood, Identity, Standing & Reputation

**Ratified:** 2026-08-16  
**Status:** Canonical / operator-ratified  
**Authority:** Canon II constitutional clarification  
**Scope:** DIDQubes, personhood credentials, personas, Standing, Reputation, and evidentiary attribution

## Constitutional statement

Personhood and identity are distinct constitutional layers. Person-grade credentials establish and preserve the continuity of the person. Persona-grade credentials express contextual identities of that person. The two may be cryptographically associated without becoming constitutionally equivalent.

**Standing accrues to the person. Reputation accrues to the persona. Evidence is the governed bridge between them.**

One event may therefore produce both Standing and Reputation, but they are different outputs, attributed to different constitutional subjects under different validation rules.

## I. DIDQube ontology

A **DIDQube** is a specialized class of **DataQube** for carrying, binding, and governing decentralized identifiers and related credentials concerned with personhood and identity.

The three first-class primitive types of DIDQube are:

1. **KybeDID** — a person-grade DID and personhood/continuity anchor.
2. **RootDID** — a person-grade DID and sovereign root anchor for the person.
3. **PersonaDID** — a persona-grade DID for a contextual identity expression.

These three are first-class primitives, not an exhaustive taxonomy. Derivative DIDQube types may be composed from them and may contain additional DID or Verifiable Credential forms.

A DIDQube may contain person-grade credentials, persona-grade credentials, or a constitutionally permitted combination of both. **Constitutional grade follows the credential and its binding, not merely the DIDQube container.**

This mirrors the broader iQube ontology: just as metaQubes, blakQubes and TokenQubes are first-class iQube primitives from which derivative iQube types may be composed, KybeDID, RootDID and PersonaDID are first-class DIDQube primitives from which derivative personhood and identity Qubes may be composed.

## II. Polity Passport

The **Polity Passport** is a derivative DIDQube constitutional credential containing an **anonymous, person-grade Verifiable Credential that is Kybe-anchored and Kybe-bound**.

Its constitutional authority derives from its personhood binding, not from any persona through which the Passport is presented or used.

A Passport may be associated with a persona operationally without making the Passport persona-grade or making the persona the constitutional owner of the person's personhood, Standing, or sovereignty.

## III. Person and Persona

A **person** is the constitutional subject. Personhood provides continuity independent of identity.

A **persona** is a contextual identity expression of a person. A person may have many personas. Personas may have their own DID credentials, handles, histories, contexts and social relationships. They remain peripheral/contextual to the person and are RootDID-bound where that binding is constitutionally established.

Persona credentials are disposable, replaceable or contextual in a way person-grade KybeDID and RootDID credentials are not.

**Credential composition does not imply constitutional equivalence.** Co-location, association or cryptographic binding of a person-grade DID and a persona-grade DID within a DIDQube does not collapse personhood into identity or identity into personhood.

## IV. Standing and Reputation

**Standing is person-grade. Reputation is persona-grade.**

Standing accrues to the person and persists across the person's contextual personas because it is anchored to personhood rather than to identity.

Reputation accrues to a persona and is contextual to the interactions, domain, community, role and history through which that persona is recognized.

A person may therefore hold one personhood continuity and one person-level Standing state while maintaining multiple personas with different reputations. Those personas need not be publicly correlatable merely because their constitutionally valid actions can ultimately be attributed to the same person.

Standing must not be transferred from the person to a persona. A persona may exercise authority available to its person subject to applicable scope and delegation, but the persona does not become the owner of the person's Standing.

## V. Evidence is the bridge

**Reputation does not become Standing. Evidence is the bridge between Reputation and Standing.**

A persona-mediated action may generate evidence. The same event may produce two distinct outputs:

`Persona action → Evidence → Reputation(persona)`

and, where the evidence is constitutionally valid and attributable through the relevant DIDQube bindings:

`Persona action → Evidence → Standing(person)`

Accordingly:

- social/contextual consequences may contribute to the Reputation of the acting PersonaDID;
- constitutionally validated consequences attributable to the underlying person may contribute to Standing at the KybeDID/RootDID personhood layer;
- reputation may provide evidence relevant to a Standing determination, but reputation itself is never converted mechanically into Standing;
- popularity, likes, followers, ratings or other persona-level social signals cannot manufacture person-level Standing without the required evidentiary and constitutional validation.

This preserves the existing constitutional rule that Standing is not Reputation while defining the lawful relationship between them.

## VI. Canonical invariants

1. **DIDQubes are specialized DataQubes for personhood and identity credentials.**
2. **KybeDID, RootDID and PersonaDID are the three first-class primitive DIDQube types; derivative DIDQube types may be composed from them.**
3. **KybeDID and RootDID are person-grade; PersonaDID is persona-grade.**
4. **A DIDQube may contain person-grade, persona-grade, or mixed credentials; credential composition never collapses their constitutional grades.**
5. **The Polity Passport is a derivative DIDQube containing an anonymous person-grade Verifiable Credential that is Kybe-anchored and Kybe-bound.**
6. **Personhood provides continuity; personas provide contextual identity expression.**
7. **Standing accrues to the person. Reputation accrues to the persona.**
8. **One event may produce both Standing and Reputation, but they are different outputs.**
9. **Evidence is the governed bridge between Reputation and Standing; Reputation does not mechanically convert into Standing.**
10. **Persona-mediated evidence may contribute to person-level Standing only when constitutionally validated and attributable to the person.**
11. **Standing remains person-grade and cannot become the property of a persona.**
12. **Persona reputation may be contextual, plural and independently variable across the several personas of one person.**

## VII. Immediate application — KNYT Bridge / Knightsbridge

This doctrine is immediately applicable to KNYT Bridge participation without changing the constitutional distinction between social recognition and Standing.

Examples such as sharing a crossing story, writing and publishing a story, receiving likes, sharing a MetaKnyt Kickstarter campaign, or subscribing/following a campaign may generate persona-level Reputation signals and evidence of person-level contribution.

The implementation rule is:

**social action → evidence/receipt → persona Reputation + constitutionally validated person Standing, where eligible**

The two outputs must be computed and attributed separately. A like or share is not Standing merely because it is socially valuable; the receipted action and its validated contribution are the evidence from which Standing may be derived.

This permits KNYT/Knightsbridge rewards such as KNYT or other campaign incentives to coexist with Reputation and Standing while keeping all three economically and constitutionally distinct.

## Relationship to prior canon

This clarification deepens and does not supersede:

- `inv.constitutional.011` — Personhood precedes identity.
- `inv.constitutional.012` — Standing follows action.
- `inv.constitutional.013` — Authority follows standing.
- `inv.constitutional.018` — Standing is confidence in the veracity of declarations, not reputation.
- `inv.polity.178` — proof of personhood / KybeDID anchoring.
- `inv.polity.181` — personas are contextual civic surfaces and never replace the sovereign person.

The new doctrine supplies the previously missing relationship: **evidence allows persona-mediated action to produce person-level Standing without collapsing Reputation into Standing or Persona into Person.**
