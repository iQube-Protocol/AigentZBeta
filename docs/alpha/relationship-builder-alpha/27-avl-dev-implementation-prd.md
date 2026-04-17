# AVL Relationship Builder — Dev Implementation PRD

## Build target

Implement AVL Relationship Builder in the existing AigentZBeta / Next.js stack as the replacement product surface for the current Marketa Cartridge.

Keep Marketa as the lead relationship agent and make KNYT Relationship Composer the first live program workspace.

## Immediate operating target

Support the current Kickstarter as **Campaign Wave 1** of the broader KNYT Program while building continuity beyond Kickstarter close.

## Required system capabilities

- first-class `program_id`
- first-class `campaign_wave_id`
- support for `always_on_action_type`
- internal operator mode
- partner mode
- customer communications surface
- seeded cohort import and activation
- Studio / Experience Matrix inputs into Composer
- execution rail abstraction with Make as rail 1
- reporting and reward visibility
- continuity state across waves

## Internal navigation target

- Overview
- Programs
- Composer
- Customers
- Partners
- Packs
- Reports
- QubeTalk
- Settings

## MVP workstreams

### 1. Product reframing
- update Marketa Cartridge product framing to AVL Relationship Builder
- keep route and component backward compatibility where practical

### 2. KNYT Program shell
- add KNYT program home
- model Kickstarter as Campaign Wave 1
- add continuity-aware structures

### 3. KNYT Relationship Composer
- Studio-powered action builder
- pack + offer + workflow composition
- Matrix / ladder / NBE aware

### 4. Customer surface
- support investor, prospect, KS Backers, and continuity cohorts
- support seeded cohort import and email-first execution
- support ladder ascension and Venture Lab pipeline visibility

### 5. Partner workspace
- campaign catalog
- join flow
- setup / execution profiles
- reports
- QubeTalk

### 6. Execution rails
- Make as rail 1
- extensible execution profile model

### 7. Reporting and reward visibility
- lightweight but real campaign-wave and cohort reporting
- continuity-aware reward visibility

## Stage sequence for KS Backers cohort

### Stage 1
Import and activate the seeded KS Backers list through email-first execution.

### Stage 1.5
Clean, groom, dedupe, suppress, score, and canonize the cohort.

### Stage 2
Expand and enrich the cohort through organic, swaps, and later social/SMS rails.
