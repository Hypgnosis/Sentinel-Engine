const postgres = require('postgres');

async function test() {
  const sql = postgres({
    host: '127.0.0.1',
    port: 5432,
    username: 'sentinel',
    password: process.env.DB_PASSWORD || 'S3nt1n3l!F0rtr3ss_2026_Gx9#',
    database: 'sentinel_reservoir',
    ssl: false,
    debug: console.log
  });

  try {
    const res = await sql`SELECT 1 as connected`;
    console.log("Success:", res);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit();
  }
}

test();
