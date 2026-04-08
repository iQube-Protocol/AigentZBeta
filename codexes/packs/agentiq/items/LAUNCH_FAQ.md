# AgentiQ Alpha — FAQ

## 1. What is the difference between AgentiQ OS and the AgentiQ platform?

AgentiQ OS is the public upstream build layer. It is where contributors package and submit supply. The AgentiQ platform is the governed operations layer that runs intake, validation, Registry publication, orchestration, and platform policy. In plain terms: AgentiQ OS is where you build for the ecosystem; AgentiQ is where the ecosystem governs and routes what gets in.

## 2. What can I submit during alpha?

Alpha accepts four contribution categories: ToolQube, SkillQube, WorkflowQube, and ConnectorQube. A contribution must declare one of those categories in its manifest and follow the AgentiQ OS packaging standards and submission flow.

Out of scope during alpha: raw model weights without a usable wrapper, contributions that require modifying platform-core code, closed binaries without a verifiable interface, and bundles with unbounded data exfiltration risk.

## 3. How does the ingestion pipeline work?

The pipeline is:

```text
submit → fetch source → classify asset → package → validate → assign trust band → review → publish
```

After a submission enters the Registry Ingestion Factory, it moves through intake, packaging, validation, trust-band assignment, and review. If accepted, it becomes Registry-visible supply that can be composed in Studio and delivered through Runtime.

## 4. How long does the pipeline take?

Typical alpha timings are:

- intake to source fetched: under 30 seconds
- classification: under 1 minute
- packaging: under 2 minutes
- validation: roughly 2–10 minutes depending on sandbox checks
- trust-band assignment: under 1 minute
- review and approval: minutes for automated cases, longer when human review is required for higher-trust assets

During alpha, exact timing can vary, especially for submissions that need manual review or resubmission.

## 5. What do trust bands mean, and how do they affect my asset?

Trust bands are quality and readiness signals, not a public prestige system and not a substitute for the full trust-scoring stack. They indicate how far a submission has progressed through validation and how safely it can be composed and exposed.

- **L1 Experimental** — early/unverified; limited availability
- **L2 Verified Community** — community-checked; broader availability
- **L3 Production Candidate** — strong enough for structured composition in Studio
- **L4 Production Approved** — vetted for high-confidence production use
- **L5 Core Sovereign** — platform-core quality

In alpha, most new contributions should expect to start at L1 or L2. Higher bands generally enable broader composition and stronger placement in governed flows.

## 6. Is the trust band system a gatekeeper?

No. The trust-band system is meant to make supply more legible and more useful, not to keep contributors out by default. Governed intake is there so accepted supply can be composed with confidence and delivered into real Runtime flows rather than disappearing into an unstructured plugin list.

## 7. What is Q¢? What is $KNYT? Are they the same?

No. They serve different roles.

- **Q¢ (QriptoCent)** is the platform base rail. It underpins pricing, metering, settlement, and operational flows across AgentiQ OS and the platform.
- **$KNYT** is the contained local economy inside the KNYT cartridge. It is used in alpha for participation and contribution rewards in that world.

Q¢ is platform-wide. $KNYT is KNYT-only.

## 8. What is PCS and why does it matter?

PCS stands for Progressive Creative Sovereignty. It is the progression system that moves a person from basic participation toward higher-agency roles and eventually upstream contribution.

In the alpha, the canonical PCS stages are:

```text
participant → community → correspondent → operator → creator → upstream contributor
```

PCS matters because the alpha is not only trying to prove delivery. It is trying to prove that user participation can become structured progression and eventually feed back into upstream ecosystem creation.

## 9. What is KNYT and how do I participate?

KNYT is the first live world in the AgentiQ alpha. It is where the closed loop becomes visible through participation, signal, remix/contribution cues, and contained reward.

KNYT has its own rendered PCS ladder for this world:

```text
observer → collector → curator → remixer → creator → correspondent → steward → franchise-aligned
```

In alpha, participation is centered on actions such as voting, liking, sparking, remixing, and other community-facing activities surfaced through the KNYT cartridge.

## 10. Who are the Aigents?

The alpha uses a simple role map:

- **Aigent Z** — lead Aigent of the AgentiQ platform layer; handles governance, orchestration, and routing
- **Aigent C** — native guide for AgentiQ OS; helps builders understand what to build, how to package it, and how to submit it
- **Kn0w1** — native Aigent of the KNYT world; guides participation, lore, signal, and the contained $KNYT economy
- **Marketa** — cross-cutting activation and growth Aigent; frames onboarding, launch, and ecosystem narrative
- **metaMe** — the sovereignty guide and experience layer; aligns goals, progression, ladder state, and next-best pathways

## 11. Is my data sovereign? How does metaMe protect it?

metaMe is designed as the governed sovereignty and experience layer. In practical alpha terms, that means it is the place where your goals, progression, and next-best-pathway logic are scoped through cartridge and codex policy boundaries rather than treated as generic shared application state.

Alpha does not claim the full enterprise governance stack is complete, but it does apply the core architectural principle: policy is the perimeter. Access is scoped by cartridge, by role, and by object authority rather than by one flat application boundary.

## 12. What is the path from contributor to upstream creator?

There are two connected paths.

On the builder side, a contributor can submit accepted supply into the Registry, have it composed in Studio, and see it delivered in Runtime.

On the user side, PCS provides the progression path from participation toward higher-agency roles. The canonical path culminates in upstream contributor status. In KNYT, that progression is rendered through the KNYT-specific ladder and reward model.

## 13. How do I know if my submission was accepted?

Every submission receives an `intakeId`. You use that to track the submission status through the Factory. The pipeline status includes the current stage, stage history, and — once assigned — the trust band.

If the asset is approved, it reaches `asset.published` and becomes Registry-visible supply. If it fails, the status response will include the failure reason so you can fix the issue and resubmit.

## 14. What happens after my submission is published?

Once published, your asset appears in the Registry with its trust band. From there it can be discovered and composed in Studio, then delivered downstream through metaMe Runtime and cartridges such as KNYT.

That is the point of the alpha: accepted supply should not stop at publication. It should move through the full loop and generate signal.

## 15. Is this a full public launch?

No. This is a closed-loop alpha proof. It is intended to prove that the end-to-end flywheel works: upstream contribution, governed intake, Registry publication, Studio composition, Runtime delivery, KNYT participation, PCS progression, and contained reward.

Out of scope for alpha includes the full public marketplace, finalized ecosystem-wide tokenomics, and the full trust-scoring and risk/value research stack.