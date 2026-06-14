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
  
  if (!apiKey) {
    console.log("No API Key found.");
    return;
  }
  
  const models = [
    'nvidia/nemotron-4-340b-instruct',
    'mistralai/mistral-large-3-675b-instruct-2512',
    'microsoft/phi-4-multimodal-instruct'
  ];
  
  console.log("Testing 3 new models...");
  
  const promises = models.map(async (model) => {
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
          messages: [{role: 'user', content: 'Say OK'}],
          max_tokens: 10
        })
      });
      
      const duration = Date.now() - start;
      if (response.ok) {
        return { model, status: 'OK', durationMs: duration };
      } else {
        const errText = await response.text();
        return { model, status: 'FAILED', code: response.status, error: errText.slice(0, 100) };
      }
    } catch (e) {
      return { model, status: 'ERROR', error: e.message };
    }
  });
  
  const results = await Promise.all(promises);
  console.table(results);
}

run();
