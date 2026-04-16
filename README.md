# Sentinel Engine V5.0 — "Sovereign Fortress"

**Industrial-Grade Sovereign Intelligence Layer for Global Trade & Maritime Logistics.**

| | |
|---|---|
| **Version** | `5.0.0-sovereign` (Production) |
| **Architecture** | Atomic Boot Guard / Integrity Controller / Zero-Trust |
| **Target** | Tier 1 Logistics, Government Carriers, & Sovereign Operations |
| **Operator** | [High ArchyTech Solutions](https://high-archy.tech) |

---

## Executive Summary

Sentinel Engine V5.0 ("Sovereign Fortress") is a **truth-enforced inference framework** that eliminates AI-liability through a zero-trust architecture. This release transitions the engine from a prototype into an industrial sovereign asset by enforcing a **deterministic security moat** around the generative process.

---

## V5.0 Core Infrastructure

### 1. Atomic Boot Guard
The engine implements a **fail-fast boot sequence**. All critical environment secrets (`DB_PASSWORD`, `SENTINEL_SIGNING_KEY`, etc.) are validated at the global scope. If the environment is incomplete, the container crashes with `process.exit(1)`, preventing the engine from ever operating in an insecure or degraded state.

### 2. Integrity Controller
A consolidated **Truth-Enforcement Layer** that orchestrates the entire inference pipeline:
- **Phase 1: DLL Intercepts** (Procedural Safety Rules)
- **Phase 2: Zod Schema Lock** (Post-Inference Validation)
- **Phase 3: HMAC Tokenization** (Irreversible PII Anonymization)

### 3. Irreversible PII Anonymization (HMAC)
V5.0 eliminates "Security Theatre" by replacing reversible AES encryption for PII with **one-way HMAC-SHA256 hashing**. PII tokens (SSN, ID, CC) are deterministic but cryptographically irreversible, ensuring complete data sovereignty for enterprise clients.

### 4. 2 AM Correctness Gate
To prevent silent failures during high-concurrency reservoir blackouts, the engine utilizes a **Resilience Mode advisory**. If the circuit breaker is open and stale cache is served, a mandatory `[ADVISORY]` string is physically injected into the narrative, notifying the user of the resilience status.

---

## Data Architecture

```
┌─────────────────────────────────────────────────────┐
│                  INFERENCE REQUEST                   │
│           (PEP Gate: JWT + Firebase Auth)            │
└───────────────┬─────────────────────────────────────┘
                │
    ┌───────────▼───────────┐
    │   ATOMIC BOOT GUARD   │ ← Global Secret Validation
    └───────────┬───────────┘
                │
    ┌───────────▼───────────┐
    │  INTEGRITY CONTROLLER │
    │ (DLL → Zod → HMAC)    │ ← Unified Safety Pipeline
    └───────────┬───────────┘
                │
    ┌───────────▼───────────┐
    │   Gemini 2.5 Flash    │
    │   (Fortress Build)    │
    └───────────┬───────────┘
                │
    ┌───────────▼───────────┐
    │  SWR Cache (Redis)    │ ← Resilience Mode Gate
    │  NLI Prosecutor       │ ← Async Sidecar Status
    └───────────────────────┘
```

---

## Technical Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 20+ on Google Cloud Functions (Gen2) |
| **Inference** | Gemini 2.5 Flash (Primary) |
| **Integrity** | IntegrityController (V5.0 Fortress) |
| **Security** | SecurityManager (HMAC-SHA256 + AES-GCM) |
| **Database** | PostgreSQL (pgvector) — Pool Max: 50 |
| **Warehouse** | BigQuery with `VECTOR_SEARCH` |
| **Cache** | Upstash Redis (Serverless SWR) |
| **Validation** | Zod 4.x (Recursive Schema Decomposition) |
| **Frontend** | React 19 + Three.js + Tailwind CSS 4 |

---

## Deployment & Monitoring

```bash
# Verify Environment
printenv | grep SENTINEL_

# Deploy Inference Engine
cd functions
npm run deploy

# Configure Alerts
cd ../infra
./alerts.sh
```

> [!CAUTION]
> **HANDOVER REQUIREMENT**: Ensure `SENTINEL_ENCRYPTION_KEY` and `SENTINEL_SIGNING_KEY` are mapped directly from GCP Secret Manager. Do not hardcode secrets in deployment environment variables.

---

*Built by **High ArchyTech Solutions** — Moving the world's data with Sovereign Integrity.*
