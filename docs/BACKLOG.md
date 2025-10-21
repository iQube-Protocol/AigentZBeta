# AigentZ Beta - Product Backlog

**Last Updated**: October 17, 2025  
**Status**: Active tracking of deprioritized and deferred work items

---

## 📋 Purpose

This document tracks work items from sprint plans that have been deprioritized or deferred. Items here remain valuable but are not currently scheduled for active development.

---

## 🎯 DIDQube System Backlog

### **Sprint 2: Cohorts & Escrow** (Deferred)
**Original Timeline**: 2 weeks  
**Status**: Not started  
**Priority**: Medium

- [ ] **Cohort Assignment Logic**
  - Implement automatic cohort assignment based on reputation
  - Define cohort tiers and membership criteria
  - Build cohort management API endpoints

- [ ] **Alias Registration Flow**
  - User interface for registering cohort aliases
  - Validation and uniqueness checks
  - Integration with Escrow canister

- [ ] **Mailbox Relay System**
  - Implement message routing through cohort aliases
  - Build relay logic in Escrow canister
  - Create UI for mailbox management

- [ ] **TTL Expiry Testing**
  - Test time-to-live expiration for aliases
  - Implement cleanup jobs for expired aliases
  - Build monitoring for TTL violations

---

### **Sprint 3: Reputation & Policy** (Deferred)
**Original Timeline**: 2 weeks  
**Status**: Not started  
**Priority**: Medium

- [ ] **Reputation Bucket Proofs**
  - Generate cryptographic proofs for reputation claims
  - Implement zero-knowledge proof system
  - Build verification endpoints

- [ ] **TokenQube Policy Enforcement**
  - Integrate reputation requirements into TokenQube
  - Build policy evaluation engine
  - Create policy testing framework

- [ ] **Reputation Dashboard Enhancements**
  - Advanced analytics and visualizations
  - Historical reputation tracking
  - Comparative reputation metrics

- [ ] **Policy Testing UI**
  - Interface for testing policy rules
  - Simulation of reputation scenarios
  - Policy debugging tools

---

### **Sprint 4: Disputes & Flags** (Deferred)
**Original Timeline**: 2 weeks  
**Status**: Not started  
**Priority**: Low

- [ ] **Flag Submission UI**
  - User interface for flagging personas
  - Evidence attachment system
  - Flag categorization

- [ ] **Dispute Resolution Interface**
  - Admin interface for reviewing disputes
  - Evidence evaluation tools
  - Resolution workflow management

- [ ] **Exoneration System**
  - Process for clearing false flags
  - Reputation restoration logic
  - Appeal mechanism

- [ ] **Admin Dispute Management**
  - Dashboard for dispute oversight
  - Bulk dispute handling
  - Dispute analytics and reporting

---

## 🔗 Cross-Chain Infrastructure Backlog

### **DVN & Proof of State** (Partially Complete)
**Status**: Core functionality complete, enhancements deferred  
**Priority**: Medium

- [ ] **Redeploy proof_of_state Canister**
  - Add missing methods: `issue_receipt`, `batch`, `anchor`
  - Update IDL with complete interface
  - Test end-to-end anchoring flow

- [ ] **Redeploy DVN Canister**
  - Fix dependency canister ID mismatches
  - Update to latest canister versions
  - Verify attestation flow

- [ ] **End-to-End Transaction Flow**
  - Complete EVM → DVN → BTC anchoring pipeline
  - Add comprehensive error handling
  - Build monitoring for full flow

- [ ] **Fallback Implementations**
  - DVN attestation fallback routes
  - Verification fallback logic
  - Graceful degradation strategies

---

### **Operations Console Enhancements** (Deferred)
**Status**: Basic console complete  
**Priority**: Low

- [ ] **Transaction History & Audit Trails**
  - Persistent transaction logging
  - Audit trail visualization
  - Export functionality

- [ ] **Automated Health Checks**
  - Scheduled health monitoring
  - Alerting system for failures
  - Auto-recovery mechanisms

- [ ] **Performance Metrics**
  - Detailed performance dashboards
  - Historical performance tracking
  - Bottleneck identification

- [ ] **Operator Troubleshooting Guides**
  - Common issue resolution guides
  - Diagnostic tools and scripts
  - Runbook documentation

---

### **Three-Tier Batching System** (Deferred)
**Status**: Tier 1 & 2 complete, Tier 3 planned  
**Priority**: Medium  
**Source**: Progress Report 2025-10-12

- [ ] **Server-Side Batching (Tier 3)**
  - Implement Next.js append-only transaction logs
  - Build Merkle tree batcher
  - Create DVN BatchCommit integration
  - Implement PoS batch receipt system
  - Build purge policies for old logs
  - Create audit index and proof APIs

- [ ] **Governance Thresholds**
  - Define batching thresholds
  - Implement governance controls
  - Build threshold monitoring dashboard

---

## 📱 Registry & iQube System Backlog

### **Server-Driven State & Ownership** (Deferred)
**Status**: Transitional state in place  
**Priority**: Medium  
**Source**: PROGRESS_REPORT.md

- [ ] **Migrate Local Flags to Server**
  - Move `minted` flag from localStorage to server
  - Move `owner` flag from localStorage to server
  - Move `active` flag from localStorage to server
  - Implement server-side ownership checks

- [ ] **Real-Time UI Consistency**
  - Standardize `registryTemplateUpdated` events
  - Adopt SWR or similar invalidation strategy
  - Implement optimistic UI updates

---

### **Operator & Audit Enhancements** (Deferred)
**Status**: Basic functionality in place  
**Priority**: Low

- [ ] **Event/Audit Trails**
  - Log mint operations
  - Log save operations
  - Log fork operations
  - Build audit trail viewer

- [ ] **Admin Analytics**
  - Extend `/api/registry/analytics` endpoint
  - Build admin analytics dashboard
  - Add usage metrics and reporting

---

### **Authentication & Access Control** (Deferred)
**Status**: Not started  
**Priority**: High (for production)

- [ ] **Wallet/Session Authentication**
  - Implement wallet connection
  - Build session management
  - Add capability token system

- [ ] **Supabase RLS Policies**
  - Per-user visibility controls
  - Row-level security implementation
  - Access control testing

---

### **CI/CD & Quality Gates** (Deferred)
**Status**: Not started  
**Priority**: Medium

- [ ] **GitHub Actions**
  - Lint workflow
  - Build workflow
  - Test workflow
  - Deploy workflow

- [ ] **E2E Testing**
  - Playwright setup
  - Minting flow smoke tests
  - Registry browsing tests
  - Markdown linting

---

### **UX Refinements** (Deferred)
**Status**: Core UX complete  
**Priority**: Low

- [ ] **Layout Polish**
  - Optional divider between view icons and cart
  - Fine-grained spacing adjustments
  - Pixel-perfect alignment passes

- [ ] **Documentation with Screenshots**
  - Add screenshots to OPERATORS_MANUAL.md
  - Create workflow diagrams
  - Build interactive guides

---

## 🔧 Developer Experience Backlog

### **Build & Development Tools** (Deferred)
**Status**: Basic scripts in place  
**Priority**: Low

- [ ] **Makefile Targets**
  - `make backup` - Create timestamped backup
  - `make restore` - Restore from backup
  - `make dev` - Start development server
  - `make build` - Production build
  - `make test` - Run test suite

---

### **Observability** (Deferred)
**Status**: Not started  
**Priority**: Medium (for production)

- [ ] **Structured Logging**
  - Implement structured logs for API routes
  - Add frontend logging for key flows
  - Build log aggregation

- [ ] **Metrics & Monitoring**
  - Performance budgets for SSR/CSR
  - API endpoint metrics
  - User flow analytics

---

### **Hardening & Scale** (Deferred)
**Status**: Not started  
**Priority**: High (for production)

- [ ] **Caching Strategies**
  - Progressive caching implementation
  - CDN integration
  - Cache invalidation logic

- [ ] **Pagination**
  - Large registry pagination
  - Infinite scroll implementation
  - Performance optimization

---

## 📊 Backlog Management

### **Priority Levels**
- **High**: Required for production readiness
- **Medium**: Valuable enhancements, schedule when capacity allows
- **Low**: Nice-to-have improvements, opportunistic work

### **Status Definitions**
- **Not Started**: No work begun
- **Partially Complete**: Some components implemented
- **Deferred**: Actively deprioritized from current sprint

### **Review Cadence**
- Review backlog monthly
- Reprioritize based on user feedback and business needs
- Move items to active sprint as capacity allows

---

## 🔄 Moving Items from Backlog

When moving an item from backlog to active sprint:

1. Update status in this document
2. Create detailed task breakdown
3. Assign to sprint in project management tool
4. Update relevant workplan document
5. Notify team of scope change

---

## 📝 Notes

- This backlog is a living document
- Items may be promoted, demoted, or removed based on changing priorities
- Always reference source documents for full context
- Keep this document updated as work progresses

---

**Maintained by**: Development Team  
**Review Schedule**: Monthly  
**Last Review**: October 17, 2025
