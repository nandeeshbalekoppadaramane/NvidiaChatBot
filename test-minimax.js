const { Client } = require('pg');

async function run() {
  const connectionString = require('fs')
    .readFileSync('.env', 'utf8')
    .match(/POSTGRES_URL=(.*)/)[1];
    
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query('SELECT "apiKey" FROM "UserSettings" LIMIT 1');
  const apiKey = res.rows[0].apiKey;
  await client.end();
  
  const model = 'minimaxai/minimax-m2.7';
  console.log("Testing Minimax with sentence: 'Saying I am working if you are working'");
  
  const start = Date.now();
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{role: 'user', content: 'Saying I am working if you are working'}],
        max_tokens: 100
      })
    });
    
    const duration = Date.now() - start;
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ OK (${duration}ms):`, data.choices[0].message.content);
    } else {
      const errText = await response.text();
      console.log(`❌ FAILED (${duration}ms) - Status ${response.status}:`, errText);
    }
  } catch (e) {
    console.log(`❌ ERROR:`, e.message);
  }
}

run();
