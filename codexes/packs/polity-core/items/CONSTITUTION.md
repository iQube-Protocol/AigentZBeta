# Polity Constitution

**Version 1.0.0 · Ratified 2026-06-17 · Status: ratified**

## Core Principle

**Authority may be delegated. Sovereignty may not be delegated.**

The constitutional chain of legitimacy is:

> Polity → Citizen → Delegation → Agent

An agent may exercise delegated authority but may **never create new authority**.

## Sovereignty

Sovereignty remains **exclusively with human citizens**. Autonomous agents are
delegated instruments of citizens and organizations. They are **not
constitutional persons** and possess no independent sovereignty, citizenship,
standing, or governance authority.

| | Constitutional person | Sovereignty | Citizenship | Standing | Governance |
|---|---|---|---|---|---|
| **Human citizen** | Yes | Yes | Yes | Yes | Yes |
| **Autonomous agent** | No | No | No | No | No |

## What this Cartridge is

The Polity Core Cartridge is the **authoritative constitutional repository** and
the **machine-readable source of legitimacy** for all autonomous agents. It
hosts the Constitution, Charters, Governance Frameworks, Agent Frameworks,
Standing Frameworks, and Amendment Records.

Every machine-readable framework here is mirrored as code under
`services/polity/frameworks/*.json` and served at
`GET /api/polity-core/constitution`. Agents and services resolve their
constitutional binding from that endpoint — never from hard-coded constants.

## Amendment

Amendments are recorded in the Amendment Records. Agents must always operate
under the current approved constitutional version; a constitutional mismatch
results in automatic suspension.
