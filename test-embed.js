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
  
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: ["Test sentence"],
        model: "nvidia/nv-embedqa-e5-v5",
        input_type: "query"
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Success! Dimensions:`, data.data[0].embedding.length);
    } else {
      console.log(`❌ Error:`, await response.text());
    }
  } catch (e) {
    console.log(`❌ Network Error:`, e.message);
  }
}

run();
