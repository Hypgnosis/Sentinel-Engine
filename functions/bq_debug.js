const { GoogleGenAI } = require('@google/genai');
const { BigQuery } = require('@google-cloud/bigquery');

const GCP_PROJECT_ID = 'ha-sentinel-core-v21';
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIM = 768;
const BQ_DATASET = 'sentinel_warehouse';

const bigquery = new BigQuery({ projectId: GCP_PROJECT_ID });
const ai = new GoogleGenAI({ vertexai: true, project: GCP_PROJECT_ID, location: 'us-central1' });

const QUERY = 'Summarize the top 5 supply chain risks for Q2 2026. Include severity, probability, and estimated impact windows.';
const TENANT = 'rose_rocket';

async function main() {
  console.log('[1] Generating embedding...');
  const embResult = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: QUERY,
    config: { taskType: 'RETRIEVAL_QUERY' },
  });
  const queryVector = embResult.embeddings[0].values;
  console.log(`[2] Embedding: ${queryVector.length} dims`);

  const vectorLiteral = `[${queryVector.join(',')}]`;
  
  const sql = `
    SELECT base.source, base.route_origin, base.route_destination, base.rate_usd, base.narrative_context, distance
    FROM VECTOR_SEARCH(
      (SELECT * FROM \`${GCP_PROJECT_ID}.${BQ_DATASET}.freight_indices\` WHERE tenant_id = @tenantId),
      'embedding',
      (SELECT ${vectorLiteral} AS embedding),
      top_k => 5,
      distance_type => 'COSINE'
    )
    WHERE base.ingested_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 72 HOUR)
    ORDER BY distance ASC
  `;
  
  console.log(`[3] Query length: ${sql.length} chars`);
  console.log('[3] Running VECTOR_SEARCH...');
  const t0 = Date.now();
  try {
    const [rows] = await bigquery.query({ query: sql, params: { tenantId: TENANT }, location: 'US' });
    console.log(`[4] Results: ${rows.length} rows in ${Date.now() - t0}ms`);
    rows.forEach((r, i) => console.log(`  [${i}] dist=${r.distance?.toFixed(4)} | ${r.route_origin} -> ${r.route_destination} | $${r.rate_usd}`));
  } catch (err) {
    console.error('[ERROR]', err.message);
    if (err.errors) console.error('[ERRORS]', JSON.stringify(err.errors, null, 2));
  }
}

main();
