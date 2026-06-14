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
    'moonshotai/kimi-k2.6',
    'z-ai/glm-5.1',
    'minimaxai/minimax-m2.7',
    'qwen/qwen3.5-397b-a17b',
    'meta/llama-3.3-70b-instruct',
    'meta/llama-3.2-90b-vision-instruct',
    'meta/llama-3.2-11b-vision-instruct'
  ];
  
  console.log("Starting Benchmark...");
  
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
        return { model, status: 'FAILED', code: response.status };
      }
    } catch (e) {
      return { model, status: 'ERROR', error: e.message };
    }
  });
  
  const results = await Promise.all(promises);
  console.table(results);
}

run();
