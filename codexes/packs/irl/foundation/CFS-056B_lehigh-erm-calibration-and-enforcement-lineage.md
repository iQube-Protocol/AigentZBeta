# CFS-056B — Lehigh ERM Calibration and Enforcement Lineage

**Status:** SOURCE GROUNDING — additive to CFS-056/CFS-056A  
**Date:** 2026-08-12

## Source receipts

- `Book4 (1).xlsx` — SHA-256 `d467492f03abf3c20f3b8995abede252cec7fc7a9409a6d7fa37d4b51108a96e`
- `ERM iQube .xlsx` — SHA-256 `fd7393626c4129ca39f18566eb49e771142ba4438a293e80874a2c5e167f52b1`
- `Fine_Penalty Data .docx` — SHA-256 `38ef2988ddb9277fcebdd6ab1e6a759172db960e81d9ccdbd17e63af7cd5e06d`
- `metatMe_DataRisk(1).ipynb` — SHA-256 `6c809698ed1997bacadb6afa43808d5c7b040ab6e8864bc903bca2a2eec1573f`
- `Test metatMe_DataRisk.ipynb` — SHA-256 `8a228d17e6cbd9920ef2dd57379bc5df172f52b367bbf832d2aa83265eeb4a68`

## 1. What these assets add

These artifacts are more operational than the earlier papers. They expose the lineage from expert-labelled record risk → iQube aggregation → empirical dimension weighting → regulatory consequence calibration.

The workbook/notebook lineage supports a four-level decomposition:

```text
record/data type
→ risk-dimension vector
→ iQube/bundle aggregation
→ consequential calibration (enforcement / fine / settlement evidence)
```

This should become an evidence input to IDE v2, not a universal scalar risk oracle.

## 2. Book4 taxonomy confirmation

`Book4 (1).xlsx` contains sheets corresponding to the Lehigh dimensions, including Identifiability, Sensitivity, Confidentiality, Competitiveness, Reputation, Compliance, Financial, Political, Diplomatic, Emotional, Commercial, Legal, Geopolitical, Military, Intelligence, Social, Public Welfare, Strategic, Operational, Environmental, Security, and Health and Safety, alongside matrix/working sheets.

This independently reinforces the original 23-dimension lineage recovered in CFS-056A. Verifiability is handled as a modifier/evidence property in the notebook/paper lineage rather than requiring every workbook to represent it identically.

## 3. Executable scoring ancestor

`Test metatMe_DataRisk.ipynb` contains an executable prototype with:

- qualitative mapping `High=3`, `Medium=2`, `Low=1`;
- record-level lookup from Book4;
- iQube definitions as sets of data types;
- unweighted aggregation;
- weighted aggregation;
- dimension contribution breakdown;
- data-type contribution breakdown;
- Low/Medium/High classification bands;
- empirical dimension-weight derivation from the Book4 label distribution.

The empirical weighting method is:

```text
frequencyScore_d = 3·HighCount_d + 2·MediumCount_d + 1·LowCount_d
weight_d = frequencyScore_d / mean(frequencyScore_all_dimensions)
```

This normalizes dimension weights to mean 1.0.

### Interpretation

This is valuable as a **calibration hypothesis** because it replaces arbitrary/random demonstration weights with weights derived from the expert-labelled corpus. It MUST NOT be treated as proof that frequency equals causal importance. A dimension can be rare but catastrophic, or common but cheap to repair.

IDE v2 should therefore preserve at least three distinct signals:

1. `prevalenceWeight` — how often/severely the corpus labels a dimension;
2. `consequenceWeight` — observed loss/enforcement/repair consequence;
3. `intentMateriality` — relevance to the current intended action.

These signals may inform a risk vector but should not be silently collapsed into one coefficient.

## 4. Regulatory consequence mapping

`Fine_Penalty Data .docx` maps regulatory violations into ERM risk dimensions. Source-derived mappings include:

- GDPR/CCPA → Compliance, Identifiability, Confidentiality, Reputation, Legal, Financial;
- HIPAA → Confidentiality, Health/Safety, Legal, Compliance;
- SOX → Financial, Legal, Compliance, Operational, Security;
- PCI-DSS → Security, Confidentiality, Compliance, Financial, Operational.

It further maps violation patterns such as inadequate consent, unauthorized disclosure, insufficient security, access-control failure, inadequate privacy notice, breach-notification failure, record destruction/forgery, and data-minimization failure to affected dimensions.

The document proposes weighting dimensions using both maximum/observed penalty magnitude and enforcement frequency. This is a useful bridge from abstract risk classification to **observed consequential cost**.

### Important evidence boundary

The fine/penalty document is a research compilation with secondary-source references and example calculations. Its monetary amounts and enforcement-frequency assertions are NOT canonized here as current legal facts. Before production calibration, each observation should be normalized into a dated enforcement receipt and verified against an authoritative regulator/court/standards source where possible.

## 5. IDE v2 consequence evidence object

The extracted model suggests an additive evidence object:

```ts
interface ConsequenceCalibrationEvidence {
  id: string;
  riskDimensionIds: string[];
  regime?: string;
  violationType?: string;
  consequenceType: 'fine' | 'settlement' | 'remediation' | 'operational-loss' | 'reputational-loss' | 'other';
  amount?: number;
  currency?: string;
  frequency?: number;
  observedAt?: string;
  authorityRef?: string;
  sourceRef: string;
  verificationState: 'unverified' | 'secondary' | 'authoritative';
}
```

This should attach to risk vectors and repair paths as evidence. It should not itself define constitutional permissibility.

## 6. Risk-of-Repair implication

The regulatory material makes RoR more concrete. A breach can generate several repair channels simultaneously:

```text
adverse action
→ legal/compliance breach
→ notification/investigation
→ direct fine or settlement
→ technical/process remediation
→ operational interruption
→ reputation / downstream loss
```

Therefore `repairCost` should not be interpreted as only a monetary penalty. IDE v2 should model a repair path as a vector of consequence channels, preserving irreversibility and blast radius separately.

## 7. iQube composition implication

The notebooks model an iQube as a collection of data types and calculate both:

- total bundle risk; and
- contribution by individual data type and risk dimension.

This is directly useful for invariant discovery because it allows the system to ask not only “is this iQube risky?” but:

> Which datum × dimension relation is carrying the material risk, and which invariant would reduce, detect, contain, or make that risk reversible?

That decomposition should be preserved in vP2 experiment receipts.

## 8. Crystal vP2 additions

Add the following pre-freeze experimental factors:

1. **Corpus-prevalence arm:** risk materiality informed by empirical Book4 prevalence weights.
2. **Consequence-calibrated arm:** prevalence plus verified enforcement/repair consequence evidence.
3. **Intent-conditioned arm:** consequence calibration plus current intent materiality.

Do not use these arms to alter the frozen vP1 Crystal.

Useful measurements:

- risk-field recall of known consequence-bearing dimensions;
- false-materiality burden;
- rare/catastrophic dimension recall;
- calibration error between projected and observed consequence;
- repair-path completeness;
- contribution concentration by datum and dimension;
- sensitivity of invariant selection to prevalence vs consequence weighting.

## 9. Canonical extraction decision

Carry forward now:

- record → dimension → iQube compositional decomposition;
- qualitative labels as source observations, not truth;
- empirical prevalence weighting as a testable calibration method;
- separate contribution breakdowns by datum and dimension;
- regulation/violation → risk-dimension mappings as candidate consequence evidence;
- enforcement magnitude/frequency as downstream calibration evidence;
- explicit source/verification state for every consequence observation.

Do NOT canonize now:

- High=3 / Medium=2 / Low=1 as a universal metric;
- 33/66 classification thresholds;
- corpus frequency as causal importance;
- example fine amounts as current authoritative legal constants;
- a single scalar that erases prevalence, severity, intent, repairability, or constitutional constraints.

## 10. Resulting computational chain

```text
Intent
→ Constitutional boundary
→ Record/data evidence
→ Risk-dimension vectors
→ iQube composition
→ prevalence + consequence + verification calibration
→ Intent Risk Field
→ Repair Paths
→ TTV/RoR invariant discovery
→ invariant/evidence bindings
→ governed action
→ observed consequence
→ calibration feedback
```

This is the strongest code-facing extraction from this asset batch.