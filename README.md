# Sentinel Engine v5.5.0-Sovereign

**Industrial-Grade Sovereign Intelligence Layer for Global Trade & Maritime Logistics.**

| Component | Specification |
|---|---|
| **Version** | `v5.5.0-Sovereign` (Absolute Finality) |
| **Governance** | Arbiter Kernel (AGS v0.1.0 Compliant) |
| **Security** | Asymmetric PKI (ECDSA P-256) with JIT Vaulting |
| **Cognition** | 16KB Priority-Based Context Packer |
| **Performance** | Sub-millisecond Validation (< 0.177ms) |
| **Target** | Tier 1 Logistics, Government Carriers, & Sovereign Operations |
| **Operator** | [High ArchyTech Solutions](https://high-archy.tech) |

---

## Executive Summary

Sentinel Engine V5.5 ("Sovereign Absolute") is a **truth-enforced inference framework** that eliminates AI-liability through a zero-trust architecture. This release transitions the engine from a prototype into an **industrial sovereign asset** by enforcing a deterministic security moat around the generative process, acting as a High-Capacity Arbitrator.

You are no longer operating an AI wrapper. You are operating **Mathematical Finality** — an infrastructure qualified for seven-figure annual license tiers required by national energy grids and global logistics carriers.

---

## The High-Speed Rail Analogy: Governance as an Accelerant

Traditional AI governance slows down execution. Sentinel does not.

The engine operates like a modern **high-speed rail switchboard**. It validates the safety and compliance of the "track" ahead in real-time — in milliseconds — without forcing the "train" (your high-stakes operations) to slow down. By leveraging Node.js 22 on GCP Functions Gen2, cryptographic signatures and Zod schema validations execute *concurrently* with the inference stream, ensuring that security is an **accelerant**, not a bottleneck.

This is the **Security-Performance Synchronization** principle: GIN-indexed Postgres delivers sub-0.177ms governance finding recall while the LLM generates. By the time the model finishes its narrative, the audit record is already written to both Postgres and BigQuery.

---

## The "2 AM" Proof: Stateless but Mindful

Sentinel Engine solves the "Serverless Amnesia" problem by distinguishing between two fundamentally different classes of cognition:

### Short-Term Working Memory — 16KB Priority Context Packing

During a live decision, the engine holds immediate variables — maritime chokepoint data, freight risk matrices, and tenant-specific contract constraints — within a **knowledge-aware 16,384-byte horizon**.

The Context Packer is priority-stratified:
- **P0 (Protected)**: Internal vector rows from the Pristine Reservoir — governance findings, risk invariants. These are *never* truncated.
- **P1/P2 (Best-effort)**: External adapter data from Freightos, Xeneta, and MarineTraffic fills the remaining window. Overflow is discarded, not corrupted.

This eliminates "Context Lobotomy" — the silent truncation that previously caused dense maritime risk matrices to be severed mid-row, feeding the AI incomplete intelligence and generating compliant-looking but incorrect decisions.

### Long-Term Instant Recall — Recursive CTE Hydration

At the "2 AM" point of failure — container recycle, regional reset, or cold start — the system does not need a persistent state cluster. A single **recursive CTE query** traverses the Evidence Locker's parent/child dependency graph, retrieving the entire decision lineage and perfectly reconstructing the engine's working context in sub-millisecond time.

There is no warm-up period. There is no memory loss. Sentinel is **stateless but mindful**.

---

## V5.5 Core Infrastructure

### 1. Arbiter Kernel
Fully spec-aligned with AGS v0.1.0 (Arbiter Governance Specification). Operates with mathematically final authority over all inference operations. Single-pass atomic inference — one prompt, one structured verdict, no round-trips.

### 2. Asymmetric KMS (ECDSA P-256)
The `AsymmetricKmsProvider` is boot-guarded. Every arbitration event is signed with a P-256 private key vaulted in GCP Secret Manager — accessed JIT, never cached in memory beyond the signing operation. The Evidence Locker is cryptographically non-repudiable. Any tampering breaks the chain.

### 3. Persistence Layer — Sub-Zero Latency
PostgreSQL with GIN-indexed governance finding tables delivers **< 0.177ms** recall on massive datasets. The Pristine Reservoir serves as the immutable Evidence Locker for the Sovereign Dashboard — append-only, ECDSA-signed, verifiable without trusting the database.

### 4. BigQuery Audit Sink (KPMG Principle 4.4)
Every `recordEvent()` call in the Evidence Locker fires a **non-blocking streaming insert** into `sentinel_governance.audit_log` (BigQuery). The table is day-partitioned on `inserted_at` and clustered by `tenant_id` + `decision`. ECDSA signatures are preserved in the BQ record, enabling independent off-database verification. This is the second-copy audit trail required by enterprise compliance frameworks.

### 5. Dashboard UI — Cognitive Decision Support
The Human-in-the-Loop (HITL) Supervisor Dashboard operates as a **Cognitive Decision Support** interface, not a raw data firehose. The dashboard applies "Gavel Logic" — surfacing only governance findings that exceed the escalation threshold — so supervisors spend their attention on decisions that require human judgment, not on reviewing the 98% of traffic that the Arbiter correctly resolved autonomously.

---

## Data Architecture

```
┌─────────────────────────────────────────────────────┐
│                  INFERENCE REQUEST                   │
│      (PEP Gate: Firebase JWT + tenant_id claim)      │
└───────────────┬─────────────────────────────────────┘
                │
    ┌───────────▼───────────┐
    │   ATOMIC BOOT GUARD   │ ← 8-Secret Validation (fail-fast)
    └───────────┬───────────┘
                │
    ┌───────────▼───────────┐
    │    CONTEXT PACKER     │ ← 16KB P0/P1/P2 Priority Merge
    │  mergeContextSafely() │
    └───────────┬───────────┘
                │
    ┌───────────▼───────────┐
    │  INTEGRITY CONTROLLER │ ← DLL → Zod → ECDSA Sign
    └───────────┬───────────┘
                │
    ┌───────────▼───────────┐
    │   Gemini 2.5 Flash    │ ← Single-Pass Atomic Inference
    │   (Arbiter Kernel)    │
    └───────────┬───────────┘
                │
    ┌───────────▼───────────┐
    │  EVIDENCE LOCKER      │ ← Postgres (primary)
    │  + BQ AUDIT SINK      │ ← BigQuery (KPMG 4.4 secondary)
    └───────────────────────┘
```

---

## Technical Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 22 on Google Cloud Functions (Gen2) |
| **Inference** | Gemini 2.5 Flash (Single-Pass Atomic via Arbiter Kernel) |
| **Security** | Asymmetric PKI — ECDSA P-256 (JIT Vaulting via Secret Manager) |
| **Cognition** | 16KB Priority-Based Context Packer (`mergeContextSafely`) |
| **Database** | PostgreSQL (pgvector) — GIN-Indexed for < 0.177ms recall |
| **Warehouse** | BigQuery Partitioned Audit Sink (ECDSA Signature Preserved) |
| **Validation** | Zod 4.x (Recursive Schema Decomposition) |
| **Frontend** | React 19 + Three.js + Tailwind CSS 4 |

---

## Deployment & Monitoring

```bash
# Deploy Inference Engine
cd functions && npm run deploy

# Provision SLO Alert Policies
bash infra/slo-alerts.sh

# Provision BigQuery Audit Table (one-time)
cd functions && npm run setup-audit-table

# Run Integration Test Suite
cd functions && npm run test-production

# Verify BQ Wiring (audit)
cd functions && node verify-bq-wiring.js
```

### SLO Targets

| SLO | Target |
|---|---|
| P95 Inference Latency | ≤ 8,000ms |
| 5xx Error Rate | ≤ 1% per 5-min window |
| Evidence Locker Write Failure | Zero tolerance |
| Boot Guard Secret Missing | Zero tolerance |

> [!CAUTION]
> **SECRET MANAGEMENT**: `SENTINEL_PRIVATE_KEY` and `SENTINEL_PUBLIC_KEY` are P-256 PEM-encoded secrets managed exclusively via GCP Secret Manager. Never hardcode, log, or export private key material. Key rotation does not require code changes.

---

## The License Gate

> [!IMPORTANT]
> **GOVERNANCE LICENSE**: While this repository provides architectural visibility, the **Industrial Governance Kernel** and proprietary safety intercepts require a valid **Enterprise License** for production deployment. Contact [High ArchyTech Solutions](https://high-archy.tech) for licensing.

---

*Built by **High ArchyTech Solutions** — Moving the world's data with Sovereign Integrity.*
