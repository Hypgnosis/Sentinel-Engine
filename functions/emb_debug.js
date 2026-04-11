const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ vertexai: true, project: 'ha-sentinel-core-v21', location: 'us-central1' });

async function main() {
  const emb = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: 'What is the current container shipping rate from Shanghai to Rotterdam?',
    config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 768 },
  });
  const values = emb.embeddings[0].values;
  const literal = `[${values.join(',')}]`;
  
  // Check for problematic values
  const problems = values.filter(v => !isFinite(v) || isNaN(v));
  console.log(`Total values: ${values.length}`);
  console.log(`Problematic values: ${problems.length}`);
  console.log(`Literal length: ${literal.length} chars`);
  console.log(`First 100 chars: ${literal.substring(0, 100)}`);
  
  // Check if any value uses scientific notation
  const sciNotation = values.filter(v => String(v).includes('e'));
  console.log(`Values with scientific notation: ${sciNotation.length}`);
  if (sciNotation.length > 0) {
    console.log(`Examples: ${sciNotation.slice(0, 5).join(', ')}`);
  }

  // Build the exact SQL line 2 and show char at position 19
  const sql = `
      SELECT base.source, base.route_origin, base.route_destination, base.rate_usd, base.trend, base.narrative_context, base.ingested_at, distance
      FROM VECTOR_SEARCH(
        (SELECT * FROM \`ha-sentinel-core-v21.sentinel_warehouse.freight_indices\` WHERE tenant_id = @tenantId),
        'embedding',
        (SELECT ${literal} AS embedding),
        top_k => 10,
        distance_type => 'COSINE'
      )
      WHERE base.ingested_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 72 HOUR)
      ORDER BY distance ASC
    `;
  
  const lines = sql.split('\n');
  console.log(`\nTotal SQL lines: ${lines.length}`);
  console.log(`Line 2 (first 50 chars): "${lines[1].substring(0, 50)}"`);
  console.log(`Line 2 char at pos 19: "${lines[1][18]}"`);
  
  // The VECTOR_SEARCH embedding line
  const embLine = lines.find(l => l.includes('AS embedding'));
  console.log(`\nEmbedding line length: ${embLine?.length}`);
}

main();
