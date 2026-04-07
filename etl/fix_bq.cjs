const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const bq = new BigQuery({ projectId: 'ha-sentinel-core-v21' });

async function run() {
  console.log("Dropping tables...");
  await bq.query('DROP TABLE IF EXISTS sentinel_warehouse.port_congestion;');
  await bq.query('DROP TABLE IF EXISTS sentinel_warehouse.freight_indices;');
  await bq.query('DROP TABLE IF EXISTS sentinel_warehouse.maritime_chokepoints;');
  await bq.query('DROP TABLE IF EXISTS sentinel_warehouse.risk_matrix;');
  
  console.log("Applying schemas.sql...");
  const sql = fs.readFileSync('../bigquery/schemas.sql', 'utf-8');
  await bq.query(sql);
  console.log("Done!");
}
run().catch(console.error);
