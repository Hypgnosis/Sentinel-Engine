/**
 * Quick test — hits the live Cloud Function endpoint.
 * Writes result to a file to avoid terminal buffering issues.
 */
const fs = require('fs');
const ENDPOINT = 'https://us-central1-ha-sentinel-core-v21.cloudfunctions.net/sentinelInference';
const OUT_FILE = 'd:\\Documents\\Sentinel Engine\\test_result.json';

async function testSentinel() {
  console.log('[TEST] Sending POST...');
  const start = Date.now();

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encryptedQuery: 'What are current Shanghai-Rotterdam freight rates?',
        clientContext: 'source_alpha',
      }),
    });

    const latency = Date.now() - start;
    const data = await res.json();
    const result = { httpStatus: res.status, latencyMs: latency, response: data };

    fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
    console.log('[TEST] HTTP ' + res.status + ' | ' + latency + 'ms | Written to test_result.json');
  } catch (err) {
    const errResult = { error: err.message };
    fs.writeFileSync(OUT_FILE, JSON.stringify(errResult, null, 2));
    console.log('[TEST] FAILED: ' + err.message);
  }
}

testSentinel();
