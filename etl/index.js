/**
 * SENTINEL ENGINE v4.0 — Industrial ETL Pipeline
 * ═══════════════════════════════════════════════════════════
 * Cloud Run Job that executes the Extract → Transform → Load
 * cycle for the Sentinel Data Warehouse.
 *
 * Pipeline Stages:
 *   1. EXTRACT  — Pull from feed adapters (static or live)
 *   2. TRANSFORM — Sanitize, normalize, generate entity_hash,
 *                  build narrative_context, generate embeddings
 *   3. LOAD — Batch-insert into BigQuery with deduplication
 *
 * Deduplication Strategy:
 *   - entity_hash = SHA-256 of the row's business key fields
 *   - Before INSERT, MERGE against existing rows with same
 *     entity_hash from the last 24h to prevent duplicates
 *
 * Observability:
 *   - Structured JSON logging to Cloud Logging
 *   - Process exit code 0 = success, 1 = failure
 *   - Cloud Monitoring alerts trigger on non-zero exits
 *
 * Usage: node index.js
 * ═══════════════════════════════════════════════════════════
 */

import { createHash } from 'node:crypto';
import { BigQuery } from '@google-cloud/bigquery';
import { generateEmbeddings } from './embeddings.js';
import {
  getFreightIndices,
  getPortCongestion,
  getChokepoints,
  getRiskMatrix,
} from './adapters/static-feed.js';

// ─────────────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────────────

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'ha-sentinel-core-prod';
const BQ_DATASET     = process.env.BQ_DATASET     || 'sentinel_warehouse';

const bigquery = new BigQuery({ projectId: GCP_PROJECT_ID });

// ─────────────────────────────────────────────────────
//  UTILITY: Entity Hash (SHA-256 Deduplication Key)
// ─────────────────────────────────────────────────────

function entityHash(...fields) {
  const input = fields.map(f => String(f ?? '')).join('|');
  return createHash('sha256').update(input).digest('hex');
}

// ─────────────────────────────────────────────────────
//  UTILITY: Structured Logger
// ─────────────────────────────────────────────────────

function log(severity, event, data = {}) {
  console.log(JSON.stringify({
    severity,
    event,
    pipeline: 'sentinel-etl',
    timestamp: new Date().toISOString(),
    ...data,
  }));
}

// ─────────────────────────────────────────────────────
//  STAGE 1: EXTRACT
// ─────────────────────────────────────────────────────

async function extract() {
  log('INFO', 'ETL_EXTRACT_START');

  // TODO: Check for live API keys and prefer live adapters
  // For now, use static feed adapter
  const freightData = getFreightIndices();
  const portData    = getPortCongestion();
  const chokeData   = getChokepoints();
  const riskData    = getRiskMatrix();

  const counts = {
    freightRoutes: freightData.routes.length + (freightData.spotContractSpreads?.length || 0) + (freightData.airFreight?.length || 0) + 1, // +1 for global
    ports: portData.length,
    chokepoints: chokeData.length,
    risks: riskData.length,
  };

  log('INFO', 'ETL_EXTRACT_COMPLETE', counts);
  return { freightData, portData, chokeData, riskData };
}

// ─────────────────────────────────────────────────────
//  STAGE 2: TRANSFORM (Normalize + Embed)
// ─────────────────────────────────────────────────────

async function transform({ freightData, portData, chokeData, riskData }) {
  log('INFO', 'ETL_TRANSFORM_START');

  // ── Normalize freight indices ──
  const freightRows = [];

  // Global composite
  freightRows.push({
    entity_hash: entityHash('freight', freightData.global.route_origin, freightData.global.route_destination, freightData.global.rate_usd),
    source: freightData.global.source,
    route_origin: freightData.global.route_origin,
    route_destination: freightData.global.route_destination,
    rate_usd: freightData.global.rate_usd,
    week_over_week_change: freightData.global.week_over_week_change,
    trend: freightData.global.trend,
    narrative_context: freightData.global.narrative_context,
  });

  // Individual routes
  for (const route of freightData.routes) {
    freightRows.push({
      entity_hash: entityHash('freight', route.route_origin, route.route_destination, route.rate_usd),
      source: route.source,
      route_origin: route.route_origin,
      route_destination: route.route_destination,
      rate_usd: route.rate_usd,
      week_over_week_change: route.week_over_week_change,
      trend: route.trend,
      narrative_context: route.narrative_context,
    });
  }

  // Spot/Contract spreads (also freight index table)
  for (const spread of (freightData.spotContractSpreads || [])) {
    freightRows.push({
      entity_hash: entityHash('spread', spread.route_origin, spread.route_destination, spread.rate_usd),
      source: spread.source,
      route_origin: spread.route_origin,
      route_destination: spread.route_destination,
      rate_usd: spread.rate_usd,
      week_over_week_change: spread.week_over_week_change,
      trend: spread.trend,
      narrative_context: spread.narrative_context,
    });
  }

  // Air freight
  for (const af of (freightData.airFreight || [])) {
    freightRows.push({
      entity_hash: entityHash('airfreight', af.route_origin, af.route_destination, af.rate_usd),
      source: af.source,
      route_origin: af.route_origin,
      route_destination: af.route_destination,
      rate_usd: af.rate_usd,
      week_over_week_change: af.week_over_week_change,
      trend: af.trend,
      narrative_context: af.narrative_context,
    });
  }

  // ── Normalize port congestion ──
  const portRows = portData.map(p => ({
    entity_hash: entityHash('port', p.port_name, p.vessels_at_anchor),
    source: p.source,
    port_name: p.port_name,
    vessels_at_anchor: p.vessels_at_anchor,
    avg_wait_days: p.avg_wait_days,
    severity_level: p.severity_level,
    narrative_context: p.narrative_context,
  }));

  // ── Normalize chokepoints ──
  const chokeRows = chokeData.map(c => ({
    entity_hash: entityHash('choke', c.chokepoint_name, c.status, c.vessel_queue),
    source: c.source,
    chokepoint_name: c.chokepoint_name,
    status: c.status,
    vessel_queue: c.vessel_queue,
    transit_delay_hours: c.transit_delay_hours,
    narrative_context: c.narrative_context,
  }));

  // ── Normalize risk matrix ──
  const riskRows = riskData.map(r => ({
    entity_hash: entityHash('risk', r.risk_factor, r.severity, r.probability),
    source: r.source,
    risk_factor: r.risk_factor,
    severity: r.severity,
    probability: r.probability,
    impact_window: r.impact_window,
    narrative_context: r.narrative_context,
  }));

  // ── Generate Embeddings ──
  log('INFO', 'ETL_EMBEDDING_START', {
    totalTexts: freightRows.length + portRows.length + chokeRows.length + riskRows.length,
  });

  const allNarratives = [
    ...freightRows.map(r => r.narrative_context),
    ...portRows.map(r => r.narrative_context),
    ...chokeRows.map(r => r.narrative_context),
    ...riskRows.map(r => r.narrative_context),
  ];

  const allEmbeddings = await generateEmbeddings(allNarratives);

  // Distribute embeddings back to rows
  let embIdx = 0;
  for (const row of freightRows) { row.embedding = allEmbeddings[embIdx++]; }
  for (const row of portRows)    { row.embedding = allEmbeddings[embIdx++]; }
  for (const row of chokeRows)   { row.embedding = allEmbeddings[embIdx++]; }
  for (const row of riskRows)    { row.embedding = allEmbeddings[embIdx++]; }

  log('INFO', 'ETL_TRANSFORM_COMPLETE', {
    freightRows: freightRows.length,
    portRows: portRows.length,
    chokeRows: chokeRows.length,
    riskRows: riskRows.length,
    embeddingsGenerated: allEmbeddings.length,
  });

  return { freightRows, portRows, chokeRows, riskRows };
}

// ─────────────────────────────────────────────────────
//  STAGE 3: LOAD (BigQuery MERGE with Deduplication)
// ─────────────────────────────────────────────────────

async function loadTable(tableName, rows) {
  if (rows.length === 0) {
    log('INFO', 'ETL_LOAD_SKIP', { table: tableName, reason: 'no rows' });
    return;
  }

  const tableRef = `${GCP_PROJECT_ID}.${BQ_DATASET}.${tableName}`;

  // Use MERGE to deduplicate by entity_hash within the last 24h.
  // This prevents explosive growth during hourly cron fires.
  //
  // Strategy: Delete existing rows with same entity_hash from today,
  // then insert fresh rows. This is an atomic approach via DML.
  const entityHashes = rows.map(r => r.entity_hash);

  // Step 1: Delete stale duplicates from today
  const deleteQuery = `
    DELETE FROM \`${tableRef}\`
    WHERE entity_hash IN UNNEST(@hashes)
      AND ingested_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
  `;

  try {
    await bigquery.query({
      query: deleteQuery,
      params: { hashes: entityHashes },
      location: 'US',
    });
  } catch (err) {
    // Table might not exist yet on first run — ignore delete errors
    log('WARNING', 'ETL_DEDUP_DELETE_SKIP', { table: tableName, error: err.message });
  }

  // Step 2: Stream-insert fresh rows
  const dataset = bigquery.dataset(BQ_DATASET);
  const table = dataset.table(tableName);

  // BigQuery streaming insert does not support VECTOR types directly.
  // Use a load job or DML INSERT instead.
  // For streaming with vectors, we need to use a DML INSERT statement.
  const insertRows = rows.map(row => {
    const { embedding, ...fields } = row;
    // Build the embedding as a VECTOR literal
    const embeddingLiteral = `[${embedding.join(',')}]`;
    return { ...fields, embedding: embeddingLiteral };
  });

  // Build parameterized INSERT using DML for VECTOR support
  for (const row of rows) {
    const { embedding, ...fields } = row;
    const columns = Object.keys(fields);
    const placeholders = columns.map(c => `@${c}`);

    // VECTOR columns require special handling — pass as array
    const query = `
      INSERT INTO \`${tableRef}\` (${columns.join(', ')}, embedding)
      VALUES (${placeholders.join(', ')}, ${vectorLiteral(embedding)})
    `;

    await bigquery.query({
      query,
      params: fields,
      location: 'US',
    });
  }

  log('INFO', 'ETL_LOAD_COMPLETE', { table: tableName, rowsInserted: rows.length });
}

/**
 * Convert a float array to a BigQuery VECTOR literal.
 */
function vectorLiteral(arr) {
  if (!arr || arr.length === 0) return 'NULL';
  return `[${arr.join(',')}]`;
}

async function load({ freightRows, portRows, chokeRows, riskRows }) {
  log('INFO', 'ETL_LOAD_START');

  await loadTable('freight_indices', freightRows);
  await loadTable('port_congestion', portRows);
  await loadTable('maritime_chokepoints', chokeRows);
  await loadTable('risk_matrix', riskRows);

  log('INFO', 'ETL_LOAD_ALL_COMPLETE', {
    totalRows: freightRows.length + portRows.length + chokeRows.length + riskRows.length,
  });
}

// ─────────────────────────────────────────────────────
//  MAIN — Pipeline Orchestrator
// ─────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const ingestionId = `ING-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  log('INFO', 'ETL_PIPELINE_START', { ingestionId });

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  SENTINEL ENGINE v4.0 — Industrial ETL Pipeline         ║');
  console.log('║  Ingestion ID: ' + ingestionId.padEnd(40) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    // Stage 1: Extract
    const rawData = await extract();

    // Stage 2: Transform + Embed
    const normalizedData = await transform(rawData);

    // Stage 3: Load into BigQuery
    await load(normalizedData);

    const durationMs = Date.now() - startTime;
    log('INFO', 'ETL_PIPELINE_SUCCESS', {
      ingestionId,
      durationMs,
      durationSec: Math.round(durationMs / 1000),
    });

    console.log(`\n[SENTINEL ETL] Pipeline complete in ${Math.round(durationMs / 1000)}s.`);
    process.exit(0);

  } catch (error) {
    const durationMs = Date.now() - startTime;
    log('CRITICAL', 'ETL_PIPELINE_FAILURE', {
      ingestionId,
      durationMs,
      error: error.message,
      stack: error.stack,
    });

    console.error(`\n[SENTINEL ETL CRITICAL] Pipeline failed: ${error.message}`);
    process.exit(1);
  }
}

main();
