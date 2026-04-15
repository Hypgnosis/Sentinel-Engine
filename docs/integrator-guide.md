# Sentinel Engine v5.1 — Integrator Guide

> **Version**: 5.1.0 (Sovereign Absolute — Production)  
> **Project**: `ha-sentinel-core-v21`  
> **Author**: High ArchyTech Solutions  
> **Last Updated**: 2026-04-15  

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication](#authentication)
3. [API Reference (OpenAPI 3.0)](#api-reference)
4. [Integration Examples](#integration-examples)
5. [Multi-Tenancy & Data Sovereignty](#multi-tenancy)
6. [Error Codes](#error-codes)
7. [SLOs & Monitoring](#slos--monitoring)
8. [Operational Runbooks](#operational-runbooks)
9. [Security Model](#security-model)

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                     SENTINEL ENGINE v5.1                          │
│           Sovereign Absolute Architecture (GCP-Native)            │
├──────────────────┬────────────────────┬───────────────────────────┤
│   INFERENCE      │      ETL           │     INFRASTRUCTURE       │
│                  │                    │                           │
│ Cloud Function   │ Cloud Run Job      │ Terraform (IaC)          │
│ Gemini 1.5 Flash │ Freightos/Xeneta   │ Secret Manager           │
│ Shadow Classifier│ Circuit Breaker    │ IAM Service Accounts     │
│ raceToData RAG   │ SHA-256 Dedup      │ Cloud Monitoring + SLOs  │
│ Tenant-scoped    │ Tenant-stamped     │ Row-Level Security       │
│ Postgres + BQ    │                    │ HKDF Key Derivation      │
└──────────────────┴────────────────────┴───────────────────────────┘
         │                    │                       │
         ▼                    ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│   Postgres (Pristine Reservoir) + BigQuery (sentinel_warehouse)  │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────┐│
│  │freight_indices│ │port_congestion│ │chokepoints  │ │risk_matrix││
│  │+ tenant_id   │ │+ tenant_id   │ │+ tenant_id  │ │+ tenant_id││
│  │+ embedding   │ │+ embedding   │ │+ embedding  │ │+ embedding││
│  └──────────────┘ └──────────────┘ └─────────────┘ └──────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## Authentication

All API calls require a **Firebase ID Token** with a custom `tenant_id` claim.

### Obtaining a Token

```javascript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const cred = await signInWithEmailAndPassword(auth, email, password);
const token = await cred.user.getIdToken();
```

### Tenant Provisioning

Tenants are provisioned server-side using Firebase Admin SDK:

```javascript
import admin from 'firebase-admin';
await admin.auth().setCustomUserClaims(uid, { tenant_id: 'acme-logistics' });
```

> **CRITICAL**: Users without a `tenant_id` claim receive `403 SENTINEL_TENANT_REQUIRED`.

---

## API Reference

### OpenAPI 3.0 Specification

```yaml
openapi: "3.0.3"
info:
  title: Sentinel Engine — Sovereign Intelligence API
  version: "4.1.0"
  description: |
    Enterprise logistics intelligence API powered by BigQuery VECTOR_SEARCH RAG
    and Gemini 2.0 Flash structured inference. Multi-tenant, zero-trust.
  contact:
    name: High ArchyTech Solutions
    email: engineering@high-archy.tech
  license:
    name: Proprietary
servers:
  - url: https://us-central1-ha-sentinel-core-v21.cloudfunctions.net
    description: Production (GCP Cloud Functions Gen2)
  - url: http://localhost:8080
    description: Local development

paths:
  /sentinelInference:
    post:
      operationId: sentinelInference
      summary: Execute sovereign logistics intelligence inference
      description: |
        Accepts a natural language query about logistics, freight rates,
        port congestion, chokepoints, or supply chain risks. Returns
        structured JSON with narrative analysis, extracted KPIs, confidence
        scores, and data provenance.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [query]
              properties:
                query:
                  type: string
                  description: Natural language logistics intelligence query
                  example: "What is the current Shanghai-Rotterdam container rate?"
                  minLength: 1
                  maxLength: 4000
      responses:
        "200":
          description: Successful inference
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/InferenceResponse"
        "400":
          description: Bad Request — empty or invalid query
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "401":
          description: Unauthorized — missing or invalid Bearer token
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "403":
          description: Forbidden — no tenant_id claim on token
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "405":
          description: Method Not Allowed — only POST accepted
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "429":
          description: Too Many Requests — rate limit exceeded
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "500":
          description: Internal infrastructure failure
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "503":
          description: No data available — ETL pipeline may need to run
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
    options:
      summary: CORS preflight
      responses:
        "204":
          description: No Content (CORS preflight OK)

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: Firebase ID Token (JWT)
      description: Firebase ID Token with `tenant_id` custom claim

  schemas:
    InferenceResponse:
      type: object
      required: [status, model, timestamp, data, infrastructure, requestId]
      properties:
        status:
          type: string
          enum: [SUCCESS]
        model:
          type: string
          example: "gemini-2.0-flash"
        timestamp:
          type: string
          format: date-time
        requestId:
          type: string
          example: "SEN-1712234567890-A1B2C3"
        infrastructure:
          type: string
          example: "Sentinel v4.1 — GCP_BIGQUERY_VECTOR_RAG"
        data:
          $ref: "#/components/schemas/IntelligencePayload"

    IntelligencePayload:
      type: object
      required: [narrative, confidence, sources, dataAuthority]
      properties:
        narrative:
          type: string
          description: Markdown-formatted analysis with KPIs and recommendations
        metrics:
          type: array
          items:
            $ref: "#/components/schemas/Metric"
        confidence:
          type: number
          format: float
          minimum: 0.0
          maximum: 1.0
          description: Overall confidence score
        sources:
          type: array
          items:
            type: string
          description: Data sources used
        dataAuthority:
          type: string
          enum: [GCP_BIGQUERY_VECTOR_RAG, FIRESTORE_LEGACY]

    Metric:
      type: object
      required: [label, value]
      properties:
        label:
          type: string
          example: "Shanghai-Rotterdam Rate"
        value:
          type: string
          example: "$2,340/FEU"
        trend:
          type: string
          enum: [up, down, stable]
        confidence:
          type: number
          format: float
          minimum: 0.0
          maximum: 1.0

    ErrorResponse:
      type: object
      required: [error, code, message, requestId]
      properties:
        error:
          type: string
        code:
          type: string
        message:
          type: string
        detail:
          type: string
        requestId:
          type: string
```

---

## Integration Examples

### cURL

```bash
curl -X POST \
  https://us-central1-ha-sentinel-core-v21.cloudfunctions.net/sentinelInference \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${FIREBASE_ID_TOKEN}" \
  -d '{"query": "What is the current Shanghai-Rotterdam container rate?"}'
```

### JavaScript (Node.js)

```javascript
const response = await fetch(
  'https://us-central1-ha-sentinel-core-v21.cloudfunctions.net/sentinelInference',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      query: 'Summarize top 5 supply chain risks for Q2 2026',
    }),
  }
);

const { data } = await response.json();
console.log(data.narrative);     // Markdown analysis
console.log(data.metrics);       // Extracted KPIs
console.log(data.confidence);    // 0.0–1.0
console.log(data.dataAuthority); // GCP_BIGQUERY_VECTOR_RAG
```

### Python

```python
import requests

resp = requests.post(
    "https://us-central1-ha-sentinel-core-v21.cloudfunctions.net/sentinelInference",
    headers={
        "Authorization": f"Bearer {firebase_id_token}",
        "Content-Type": "application/json",
    },
    json={"query": "Port congestion levels in Southeast Asia"},
)

data = resp.json()["data"]
print(data["narrative"])
```

---

## Multi-Tenancy

### Row-Level Security Model

Every row in BigQuery includes a `tenant_id` column. Access is enforced at three layers:

| Layer | Mechanism | Enforced By |
|-------|-----------|-------------|
| **Application** | `WHERE tenant_id = @tenantId` in every SQL query | Cloud Function |
| **BigQuery RLS** | `CREATE ROW ACCESS POLICY` on each table | BigQuery DDL |
| **IAM** | Service accounts with least-privilege roles | Terraform / IAM script |

### Tenant Isolation Guarantees

1. The inference function extracts `tenant_id` exclusively from the verified JWT `tenant_id` custom claim
2. The ETL pipeline stamps every ingested row with the configured `TENANT_ID`
3. BigQuery Row Access Policies prevent cross-tenant data leakage even if application logic has bugs
4. No fallback to `uid` — unauthenticated or un-provisioned users get `403`

---

## Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `SENTINEL_EMPTY_QUERY` | Query field is missing or empty |
| 401 | `SENTINEL_AUTH_MISSING` | No Bearer token in Authorization header |
| 401 | `SENTINEL_AUTH_INVALID` | Token expired, revoked, or malformed |
| 403 | `SENTINEL_TENANT_REQUIRED` | User lacks `tenant_id` custom claim |
| 405 | `SENTINEL_METHOD_DENIED` | Non-POST method used |
| 422 | `SCHEMA_VALIDATION_FAILED` | AI produced structurally unverifiable output (Zod gate) |
| 429 | `SENTINEL_RATE_LIMIT_EXCEEDED` | >5 requests in 10 seconds |
| 500 | `DECISION_LATENCY_ERROR` | Internal inference failure |
| 503 | `SOURCE_ALPHA_MISSING` | No data across all RAG tiers |

---

## SLOs & Monitoring

| SLO | Target | Alert Policy |
|-----|--------|-------------|
| **P95 Inference Latency** | < 4,000 ms | `SLO: Inference P95 Latency > 4 seconds` |
| **ETL Data Staleness** | < 60 minutes | `SLO: ETL Data Staleness > 60 minutes` |
| **ETL Job Success Rate** | 100% | `Sentinel ETL — Job Failure` |
| **ETL Job Duration** | < 240 seconds | `Sentinel ETL — Execution Timeout Warning` |

All alerts are configured via `infra/alerts.sh` and notify `engineering@high-archy.tech`.

---

## Operational Runbooks

### 1. ETL Job Failing or Timing Out

```text
1. Check execution history:
   gcloud run jobs executions list --job=sentinel-etl --project=ha-sentinel-core-v21

2. Review structured logs:
   gcloud logging read 'resource.type="cloud_run_job" AND jsonPayload.event="ETL_PIPELINE_FAILURE"' \
     --project=ha-sentinel-core-v21 --limit=10 --format=json

3. Common causes:
   - Secret Manager access denied → check sentinel-etl-sa IAM bindings
   - BigQuery table not found → run bigquery/schemas.sql
   - Vertex AI embedding quota exhausted → check AI Platform quotas
   - Live API timeout → circuit breaker should degrade to static feed
```

### 2. LLM/Embedding Quota Exceeded

```text
1. Check Vertex AI quotas:
   gcloud ai quotas list --project=ha-sentinel-core-v21 --region=us-central1

2. If embedding quota is hit:
   - ETL will fail at the TRANSFORM stage
   - Reduce ETL cron frequency or request quota increase

3. If Gemini inference quota is hit:
   - Inference function returns 500
   - Consider rate limiting adjustments
```

### 3. BigQuery Cost Spike

```text
1. Check active queries:
   bq ls -j --project_id=ha-sentinel-core-v21 -a -n 20

2. Review VECTOR_SEARCH costs:
   - Each inference triggers 4 parallel VECTOR_SEARCH queries
   - Monitor via Cloud Console > BigQuery > Administration > Slots

3. Mitigation:
   - Reduce VECTOR_TOP_K from 15 to 10
   - Add result caching in the Cloud Function
   - Review BQ reservation pricing
```

### 4. Authentication/Authorization Failures

```text
1. User gets 401:
   - Verify token is not expired: jwt.io
   - Check Firebase Auth console for user status

2. User gets 403:
   - Verify tenant_id claim:
     firebase auth:import --list-users | grep <uid>
   - Set claim server-side:
     admin.auth().setCustomUserClaims(uid, { tenant_id: 'their-tenant' })
```

---

## Security Model

### Secrets Management

| Secret | Stored In | Consumed By |
|--------|-----------|-------------|
| `GEMINI_API_KEY` | Secret Manager | Cloud Function (inference) |
| `FREIGHTOS_API_KEY` | Secret Manager | Cloud Run Job (ETL) |
| `XENETA_API_KEY` | Secret Manager | Cloud Run Job (ETL) |

**No secrets in environment variables or source code.**

### IAM Service Accounts

| Service Account | Purpose | Roles |
|-----------------|---------|-------|
| `sentinel-etl-sa` | ETL Cloud Run Job | `bigquery.dataEditor`, `secretmanager.secretAccessor` |
| `sentinel-inference-sa` | Inference Cloud Function | `bigquery.dataViewer`, `aiplatform.user` |

### CORS Policy

Only explicitly allowlisted origins can call the API:
- `http://localhost:3000` (dev)
- `http://localhost:5173` (dev)
- `https://sentinel.high-archy.tech` (production)
- `https://sentinel-engine.netlify.app` (staging)

### V5.1 Security Enhancements

| Feature | Description |
|---------|-------------|
| **Shadow Classifier** | LLM-based sensitivity gate (gemini-2.0-flash-lite) classifies queries before inference. SENSITIVE queries trigger synchronous verification. |
| **raceToData** | Result-aware RAG racing. Empty results from any tier are ignored; only the first tier with data wins. Prevents hallucination from empty context. |
| **HKDF PII Tokenization** | Per-tenant HMAC keys derived via HKDF from the global signing key. Cross-tenant PII correlation is cryptographically impossible. |
| **Fail-Fast Integrity** | Zod schema violations produce typed 422 errors with `failedModules` detail. No degraded data reaches the client. |
| **Configuration Monism** | `DATABASE_URL` is the sole database config. No fallback chains. Missing at boot → hard crash. |

### FIPS 140-2 / HSM Compliance

> **⚠️ V5.2 Roadmap Item**: FIPS 140-2 Level 2 compliance and Hardware Security Module (HSM)
> integration via Cloud KMS are planned for V5.2. The current V5.1 release uses a software-based
> KMS provider (`SoftwareKmsProvider`) with HKDF key derivation. Regulated sectors requiring
> FIPS-validated cryptographic modules should plan deployment for the V5.2 release cycle.

---

## Environment Bootstrap

### Prerequisites

1. GCP project `ha-sentinel-core-v21` with billing enabled
2. `gcloud` CLI authenticated
3. Terraform >= 1.5.0

### Quick Start

```bash
# 1. Enable APIs + create SAs + create secret slots
cd terraform && terraform init && terraform apply

# 2. Provision secrets (manual — one time)
echo -n "your-gemini-key" | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project=ha-sentinel-core-v21
echo -n "your-freightos-key" | gcloud secrets versions add FREIGHTOS_API_KEY --data-file=- --project=ha-sentinel-core-v21
echo -n "your-xeneta-key" | gcloud secrets versions add XENETA_API_KEY --data-file=- --project=ha-sentinel-core-v21

# 3. Create BigQuery tables + RLS policies
bq query --use_legacy_sql=false --project_id=ha-sentinel-core-v21 < bigquery/schemas.sql

# 4. Deploy inference function
cd functions && gcloud functions deploy sentinelInference \
  --gen2 --runtime=nodejs20 --region=us-central1 \
  --trigger-http --memory=512MB --timeout=300s \
  --entry-point=sentinelInference \
  --service-account=sentinel-inference-sa@ha-sentinel-core-v21.iam.gserviceaccount.com \
  --project=ha-sentinel-core-v21

# 5. Deploy ETL pipeline
cd etl && gcloud run jobs deploy sentinel-etl \
  --source=. --region=us-central1 \
  --service-account=sentinel-etl-sa@ha-sentinel-core-v21.iam.gserviceaccount.com \
  --project=ha-sentinel-core-v21

# 6. Configure monitoring alerts + SLOs
chmod +x infra/alerts.sh && ./infra/alerts.sh

# 7. Run evaluation suite
SENTINEL_AUTH_TOKEN=<token> node --test tests/backend-eval.test.js
```
