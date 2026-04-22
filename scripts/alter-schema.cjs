const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://sentinel:53ntin3l3ng1n3v5.2@127.0.0.1:5432/sentinel_reservoir'
});
async function alter() {
  await pool.query(`
    ALTER TABLE standing_authority_matrix 
    RENAME COLUMN authority_id TO unit_id;
  `);
  await pool.query(`
    ALTER TABLE standing_authority_matrix 
    ADD COLUMN IF NOT EXISTS config JSONB,
    ADD COLUMN IF NOT EXISTS grantor_id TEXT,
    ADD COLUMN IF NOT EXISTS signature TEXT;
  `);
  console.log('Schema updated successfully');
  process.exit(0);
}
alter().catch(e => { console.error(e); process.exit(1); });
