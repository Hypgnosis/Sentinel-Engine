const fetch = require('node-fetch'); // we can just use native fetch if Node 18+

async function testLocal() {
  console.log('[LOCAL] Sending POST...');
  try {
    const res = await fetch('http://localhost:8080', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encryptedQuery: 'What are current Shanghai-Rotterdam freight rates?',
        clientContext: 'source_alpha',
      }),
    });

    const data = await res.json();
    console.log('HTTP', res.status);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.log('FAILED:', err.message);
  }
}

testLocal();
