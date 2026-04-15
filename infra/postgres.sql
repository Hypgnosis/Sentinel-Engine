-- SENTINEL ENGINE V4.5 — PostgreSQL Schema (Pristine Reservoir)
-- ═══════════════════════════════════════════════════════════
-- This schema represents the operational core for the V4.5 
-- high-speed RAG grounding engine.

-- Enable pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────
--  LOGISTICS DOMAIN TABLES
-- ─────────────────────────────────────────────────────

-- Freight Indices (Grounding for Freightos/Xeneta)
CREATE TABLE IF NOT EXISTS freight_indices (
    id SERIAL PRIMARY KEY,
    entity_hash TEXT UNIQUE NOT NULL,
    tenant_id TEXT NOT NULL,
    source TEXT NOT NULL,
    route_origin TEXT,
    route_destination TEXT,
    rate_usd NUMERIC,
    week_over_week_change NUMERIC,
    trend TEXT,
    narrative_context TEXT NOT NULL,
    embedding vector(768), -- Assuming Vertex AI text-embedding-004 (768d)
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Port Congestion (MarineTraffic)
CREATE TABLE IF NOT EXISTS port_congestion (
    id SERIAL PRIMARY KEY,
    entity_hash TEXT UNIQUE NOT NULL,
    tenant_id TEXT NOT NULL,
    source TEXT NOT NULL,
    port_name TEXT NOT NULL,
    vessels_at_anchor INTEGER,
    avg_wait_days NUMERIC,
    severity_level TEXT,
    narrative_context TEXT NOT NULL,
    embedding vector(768),
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Maritime Chokepoints (MarineTraffic)
CREATE TABLE IF NOT EXISTS maritime_chokepoints (
    id SERIAL PRIMARY KEY,
    entity_hash TEXT UNIQUE NOT NULL,
    tenant_id TEXT NOT NULL,
    source TEXT NOT NULL,
    chokepoint_name TEXT NOT NULL,
    status TEXT,
    vessel_queue INTEGER,
    transit_delay_hours NUMERIC,
    narrative_context TEXT NOT NULL,
    embedding vector(768),
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Risk Matrix (Internal)
CREATE TABLE IF NOT EXISTS risk_matrix (
    id SERIAL PRIMARY KEY,
    entity_hash TEXT UNIQUE NOT NULL,
    tenant_id TEXT NOT NULL,
    source TEXT NOT NULL,
    risk_factor TEXT NOT NULL,
    severity TEXT,
    probability TEXT,
    impact_window TEXT,
    narrative_context TEXT NOT NULL,
    embedding vector(768),
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────
--  SECURITY & IDENTITY (V5.0 Provisional)
-- ─────────────────────────────────────────────────────

-- Subject Revocation List (The "Kill Switch")
CREATE TABLE IF NOT EXISTS subject_revocation_list (
    subject_id TEXT PRIMARY KEY,
    revocation_reason TEXT,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_by TEXT
);

-- ─────────────────────────────────────────────────────
--  INDEXES (High-Speed Retrieval)
-- ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_freight_vector ON freight_indices USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_port_vector ON port_congestion USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_choke_vector ON maritime_chokepoints USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_risk_vector ON risk_matrix USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_freight_tenant ON freight_indices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_port_tenant ON port_congestion(tenant_id);
CREATE INDEX IF NOT EXISTS idx_choke_tenant ON maritime_chokepoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_risk_tenant ON risk_matrix(tenant_id);
