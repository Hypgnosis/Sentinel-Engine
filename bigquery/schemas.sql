-- ═══════════════════════════════════════════════════════════════════
--  SENTINEL ENGINE v4.0 — CANONICAL BigQuery DDL
--  The Logistics Data Warehouse. Core proprietary asset.
--
--  Key Design Decisions:
--    - VECTOR<FLOAT64>(768) — Native BQ vector type, optimized for
--      VECTOR_SEARCH indexing with Vertex AI text-embedding-004.
--    - entity_hash — SHA-256 deduplication key. Prevents explosive
--      table growth during hourly ETL cron cycles.
--    - PARTITION BY DATE(ingested_at) — Time-series partitioning
--      for cost-efficient 24-hour relevance windows.
--
--  Usage: bq query --use_legacy_sql=false < schemas.sql
-- ═══════════════════════════════════════════════════════════════════

-- Create the dataset
CREATE SCHEMA IF NOT EXISTS sentinel_warehouse
  OPTIONS (location = 'US');

-- ─────────────────────────────────────────────────────
--  1. FREIGHT INDICES
--  Routes, rates, WoW changes. Freightos/Xeneta/BDI.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentinel_warehouse.freight_indices (
  entity_hash             STRING      NOT NULL,
  ingested_at             TIMESTAMP   DEFAULT CURRENT_TIMESTAMP(),
  source                  STRING,
  route_origin            STRING,
  route_destination       STRING,
  rate_usd                FLOAT64,
  week_over_week_change   FLOAT64,
  trend                   STRING,
  narrative_context       STRING,
  embedding               VECTOR<FLOAT64>(768)
) PARTITION BY DATE(ingested_at);

-- ─────────────────────────────────────────────────────
--  2. PORT CONGESTION
--  Vessel counts, wait times, severity classification.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentinel_warehouse.port_congestion (
  entity_hash             STRING      NOT NULL,
  ingested_at             TIMESTAMP   DEFAULT CURRENT_TIMESTAMP(),
  source                  STRING,
  port_name               STRING,
  vessels_at_anchor       INT64,
  avg_wait_days           FLOAT64,
  severity_level          STRING,
  narrative_context       STRING,
  embedding               VECTOR<FLOAT64>(768)
) PARTITION BY DATE(ingested_at);

-- ─────────────────────────────────────────────────────
--  3. MARITIME CHOKEPOINTS
--  Transit delays, queue status, geopolitical flags.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentinel_warehouse.maritime_chokepoints (
  entity_hash             STRING      NOT NULL,
  ingested_at             TIMESTAMP   DEFAULT CURRENT_TIMESTAMP(),
  source                  STRING,
  chokepoint_name         STRING,
  status                  STRING,
  vessel_queue            INT64,
  transit_delay_hours     FLOAT64,
  narrative_context       STRING,
  embedding               VECTOR<FLOAT64>(768)
) PARTITION BY DATE(ingested_at);

-- ─────────────────────────────────────────────────────
--  4. RISK MATRIX
--  Geopolitical, environmental, regulatory risk factors.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentinel_warehouse.risk_matrix (
  entity_hash             STRING      NOT NULL,
  ingested_at             TIMESTAMP   DEFAULT CURRENT_TIMESTAMP(),
  source                  STRING,
  risk_factor             STRING,
  severity                STRING,
  probability             STRING,
  impact_window           STRING,
  narrative_context       STRING,
  embedding               VECTOR<FLOAT64>(768)
) PARTITION BY DATE(ingested_at);
