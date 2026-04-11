# The Sentinel Engine (V4.5.2 Hardened)
**Autonomous Logistics Intelligence — PostgreSQL Pristine Reservoir Edition**
⚠️ **Architecture Notice: V4.5.2 "Hardened" Release**
> **Critical Update:** As of version 4.5.2, the Sentinel Engine has fully transitioned from legacy BigQuery warehousing to a high-concurrency **PostgreSQL Pristine Reservoir** (Neon/Supabase). This update locks the engine into `POSTGRES_ONLY` mode, delivering sub-4s latencies and enterprise-grade Row Level Security (RLS).
## 📖 Executive Summary
The Sentinel Engine is a sovereign, real-time AI analytics platform designed for the global logistics and maritime freight sector. V4.5.2 represents a total architectural hardening, moving the "Brain" of the operation into a dedicated vector-enabled PostgreSQL environment. 
By bypassing traditional warehouse latency, the engine delivers instant, cryptographically secure supply chain intelligence with a focus on high-fidelity RAG (Retrieval-Augmented Generation) and zero-trust multi-tenancy.
## 🏗️ Hardened Architecture (V4.5.2)
### 1. The PostgreSQL Pristine Reservoir (Neon/Supabase)
We have deprecated the sluggish multi-hop BigQuery retrieval. The engine now operates on a lightning-fast Postgres layer:
* **Vector Intelligence:** Utilizes `pgvector` with 768-dimensional embeddings (text-embedding-004) for millisecond-range semantic search.
* **Lazy Connection Pooling:** Implements an asynchronous, on-demand connection strategy via Supabase Transaction Poolers (Port 6543) to handle high-concurrency demo spikes without cold-start crashes.
* **8KB Context Window:** An expanded 8192-byte retrieval buffer ensures complex supply chain risk matrices are fed to the LLM with zero truncation artifacts.
### 2. Zero-Trust Identity & Sovereign RLS
Security is not an afterthought; it is built into the database schema:
* **Row Level Security (RLS):** Every table in the Reservoir is protected by mandatory RLS policies. Data is strictly isolated at the SQL level using `tenant_id` anchors.
* **Identity Ledger:** The React edge client mints Firebase JWTs which are cryptographically verified by the engine. The database then enforces tenant isolation via secure session variables, ensuring a "Naked" engine never touches production data.
### 3. High-Performance Serverless Compute
The Sentinel Engine now runs on a "Strategic Hardware" tier in Google Cloud Run:
* **Compute Power:** Upgraded to **1 vCPU** and **512MiB RAM** to eliminate throttling during long-context RAG synthesis.
* **POSTGRES_ONLY Mode:** The engine is hard-locked to the Pristine Reservoir, achieving sub-4s end-to-end response times (P95 < 2.5s).
### 4. Studio-Quality UX & Interactive 3D
The Dashboard features a premium, interactive 3D hero experience powered by **React Three Fiber** and **Drei**.
* **Tactical Finish:** Utilizes `<meshPhysicalMaterial>` with transmission and clearcoat for glass/metal aesthetics.
* **Zero-Snap Transitions:** All 3D state changes (rotation, scale, color) are mathematically interpolated inside a `useFrame` loop for a premium, tactile feel.
## 📊 V4.5.2 Production Benchmarks
The current architecture is live and certified. Telemetry from the `rose_rocket` tenant shows:
* **End-to-End Latency:** **1.8s - 3.9s** (Target: < 4.0s).
* **Structural Integrity:** 100% JSON compliance (Confidence, Authority, Source Arrays).
* **Data Authority:** Verified as `POSTGRES_PRISTINE_RESERVOIR`.
* **Live Dashboard:** [https://sentinel-engine.netlify.app/](https://sentinel-engine.netlify.app/)
## 💻 Technical Stack
* **frontend:** React 19, Vite 8, Tailwind CSS v4, Three.js (R3F).
* **identity:** Firebase Auth (Sovereign JWT).
* **compute:** Google Cloud Run (Node.js 20, 1 vCPU, 512Mi).
* **database:** PostgreSQL (Neon), Supabase (Auth/RLS).
* **intelligence:** Gemini 2.5 Flash, Vertex AI (text-embedding-004).
* **deployment:** Split-Architecture (Netlify Frontend / Cloud Run Backend).

